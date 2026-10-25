'use strict';
/* ---------- Erweiterungen ----------
   Eine Erweiterung ist ein Ordner mit
     erweiterung.json   { id, name, version, beschreibung, minApp, perms: {schlüssel: Text},
                          tablet: { label, seite }, verwaltung: { label, recht } }
     server.js          module.exports = { activate(ctx) }   (optional)
     public/            Dateien, erreichbar unter /x/<id>/ (z. B. Tablet-Seite index.html, admin.js für die Verwaltung)
   Gesucht wird in den mitgelieferten Erweiterungen (/app/erweiterungen) und im Ordner EXT_DIR
   (Home Assistant: /share/clubwerk/erweiterungen, per Samba erreichbar).
   Aktiv/inaktiv wird in der Verwaltung geschaltet und gilt sofort – Daten bleiben beim Ausschalten erhalten. */
const fs = require('fs');
const path = require('path');
const express = require('express');
const { db, getSetting, setSetting, audit, auditDiff } = require('./db');
const auth = require('./auth');
const APP_VERSION = require('../package.json').version;
// Verkauf hat eine eigene Modulversion (package.json „verkaufVersion“) – die Add-on-Version zählt alles zusammen
const VERKAUF_VERSION = require('../package.json').verkaufVersion || APP_VERSION;
const memberapp = require('./memberapp');

const UPLOAD_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'erweiterungen');   // über die Verwaltung hochgeladen
const SOURCES = [
  { dir: path.join(__dirname, '..', 'erweiterungen'), source: 'mitgeliefert' },
  { dir: UPLOAD_DIR, source: 'hochgeladen' },
  { dir: process.env.EXT_DIR || '/share/clubwerk/erweiterungen', source: 'nachinstalliert' },
];
const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const crypto = require('crypto');
/* Nur geprüfte Erweiterungen laufen: Alles, was nicht mitgeliefert ist (hochgeladen oder per Samba in den Ordner gelegt),
   wird erst ausgeführt, wenn das Adminkonto genau diesen Stand freigegeben hat. Ändert sich auch nur eine Datei,
   ist die Freigabe weg. So kann niemand über den freigegebenen Netzwerkordner Programmcode einschleusen. */
function dirHash(dir) {
  const h = crypto.createHash('sha256'); let n = 0, size = 0;
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(d, e.name);
      if (e.isSymbolicLink()) throw new Error('enthält Verknüpfungen (Symlinks)');
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) { const b = fs.readFileSync(full); size += b.length; if (++n > 2000 || size > 50 * 1024 * 1024) throw new Error('zu groß'); h.update(path.relative(dir, full) + '\0').update(b).update('\0'); }
    }
  };
  walk(dir);
  return h.digest('hex');
}
const approvedKey = id => `plugin_approved_${id}`;
/* Freigegebene Erweiterungen aus dem Netzwerkordner laufen aus einer eigenen Kopie in /data (nicht per Samba erreichbar).
   Änderungen im Netzwerkordner erreichen so weder den Programmcode noch die Dateien der Verwaltungsseite –
   sie erscheinen nur als „neue Version zum Prüfen“. */
const APPROVED_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'erweiterungen-freigegeben');
function snapshot(id, src, expected) {
  fs.mkdirSync(APPROVED_DIR, { recursive: true, mode: 0o700 });
  const tmp = path.join(APPROVED_DIR, `.${id}-${Date.now()}`);
  fs.cpSync(src, tmp, { recursive: true, dereference: false, verbatimSymlinks: true });
  const got = dirHash(tmp);   // Kopie selbst prüfen – falls sich der Ordner während des Kopierens geändert hat
  if (expected && got !== expected) { fs.rmSync(tmp, { recursive: true, force: true }); throw new Error('Die Dateien haben sich während der Freigabe geändert – bitte die Liste neu laden und erneut prüfen.'); }
  const dest = path.join(APPROVED_DIR, id);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(tmp, dest);
  return got;
}
const RESERVED_PERMS = new Set(['benutzer', 'einstellungen', 'deinstallieren']);
const plugins = new Map();   // id -> { meta, dir, source, error, hooks }

/* Eingebaute Module: verhalten sich in der Verwaltung wie Erweiterungen (ein-/ausschaltbar),
   ihr Code steckt aber im Kern. Getränke = Tablet-Buchung, Artikel, Lieferungen, Bestand, Veranstaltungen, Abrechnung … */
const DRINK_PERMS = ['lieferungen', 'bestand', 'bestellung', 'buchungen', 'export', 'abrechnung', 'veranstaltungen', 'uebernahme', 'artikel'];
plugins.set('getraenke', {
  builtin: true, dir: null, source: 'mitgeliefert', error: null, hooks: {},   // ein Modul wie alle anderen (nur der Code steckt im Kern)
  meta: { id: 'getraenke', name: 'Verkauf', version: VERKAUF_VERSION, standardAktiv: true, kurz: 'Am Tablet buchen statt Strichliste.',
    beschreibung: 'Verkauf am Tablet statt Strichliste – Getränke, Speisen, Vereinsartikel, Bälle … Artikel und Preise, Konten & PINs, Lieferungen & Belege einlesen, Bestand, Bestellung, Veranstaltungen, Gäste-Deckel, Abrechnung & Export.',
    perms: Object.fromEntries(DRINK_PERMS.map(k => [k, auth.PERMS[k]])), tablet: { label: 'Verkauf', seite: '' } },
});

/* Saubere Adressen am Tablet: /plaetze/, /helferdienste/ … statt /x/<id>/. Der Pfad kommt aus „tablet.pfad“ im Manifest (sonst die ID);
   belegte Namen (Dateien der Hauptseite, api, x …) bleiben bei /x/<id>/. Verkauf liegt unter /verkauf. */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
let reservedCache = null;
function reservedPaths() {
  if (!reservedCache) {
    reservedCache = new Set(['api', 'x', 'app', 'm', 'p', 'verkauf', 'logo', 'gate', 'admin', 'index', 'manifest', 'vereinsicon']);
    try { for (const f of fs.readdirSync(PUBLIC_DIR)) reservedCache.add(f.replace(/\.[^.]*$/, '').toLowerCase()); } catch (e) { /* egal */ }
  }
  return reservedCache;
}
function tabletSlug(p) {
  if (!p || !p.meta.tablet) return null;
  if (p.builtin) return p.meta.id === 'getraenke' ? 'verkauf' : null;
  const want = String(p.meta.tablet.pfad || p.meta.id).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(want) || reservedPaths().has(want)) return null;
  for (const q of plugins.values()) if (q !== p && !q.builtin && q.meta.tablet && String(q.meta.tablet.pfad || q.meta.id).toLowerCase() === want && q.meta.id < p.meta.id) return null;   // doppelt: der erste gewinnt
  return want;
}
/** HTML der Tablet-Seite mit <base>, damit relative Adressen auf /x/<id>/ zeigen – null, wenn es keine eigene Seite gibt */
function tabletPage(id, baseHref) {
  const p = plugins.get(id);
  if (!p || p.builtin || p.error || !tabletSlug(p) || p.meta.tablet.seite) return null;
  try { return fs.readFileSync(path.join(p.dir, 'public', 'index.html'), 'utf8').replace(/<head([^>]*)>/i, `<head$1>\n<base href="${baseHref}">`); } catch (e) { return null; }
}
/** Adresse der Tablet-Seite (relativ zur Startseite) */
function tabletHref(p) {
  const slug = tabletSlug(p), seite = String(p.meta.tablet.seite || '');
  if (p.builtin) return slug || '';
  return slug && !seite ? `${slug}/` : `x/${p.meta.id}/${seite}`;
}

const verNum = v => String(v || '0').split('.').map(n => parseInt(n, 10) || 0).reduce((a, n) => a * 1000 + n, 0);
const activeKey = id => `ext_${id}_active`;
const isUninstalled = id => getSetting(`ext_${id}_uninstalled`, '0') === '1';
function isActive(id) {
  const p = plugins.get(id);
  return Boolean(p && !p.error && !isUninstalled(id) && getSetting(activeKey(id), p.meta.standardAktiv ? '1' : '0') === '1');
}

function discover() {
  for (const { dir, source } of SOURCES) {
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch (e) { continue; }
    for (const name of names) {
      const pdir = path.join(dir, name);
      let meta;
      try { meta = JSON.parse(fs.readFileSync(path.join(pdir, 'erweiterung.json'), 'utf8')); } catch (e) { continue; }
      const id = String(meta.id || '');
      if (!ID_RE.test(id)) { console.error(`Erweiterung in ${pdir}: ungültige id`); continue; }
      if (plugins.has(id)) { console.error(`Erweiterung „${id}“ doppelt – ${pdir} wird ignoriert`); continue; }
      const p = { meta: { name: id, version: '0', ...meta, id }, dir: pdir, source, error: null, hooks: {} };
      if (source !== 'mitgeliefert') p.meta.standardAktiv = false;   // fremde Erweiterungen schalten sich nie selbst ein
      if (meta.minApp && verNum(APP_VERSION) < verNum(meta.minApp)) p.error = `braucht Clubwerk ${meta.minApp} oder neuer (installiert: ${APP_VERSION})`;
      if (!p.error && source === 'hochgeladen') {   // liegt in /data – nicht per Samba erreichbar
        let hash = null; try { hash = dirHash(pdir); } catch (e) { p.error = 'Erweiterung ' + e.message; }
        p.hash = hash;
        if (hash && getSetting(approvedKey(id), '') !== hash) { p.unapproved = true; p.error = 'Noch nicht freigegeben (geändert). Das Adminkonto muss sie unter Einstellungen → Module prüfen und freigeben.'; }
      } else if (!p.error && source === 'nachinstalliert') {
        let live = null; try { live = dirHash(pdir); } catch (e) { p.error = 'Erweiterung ' + e.message; }
        p.hash = live;
        const snap = path.join(APPROVED_DIR, id); let snapHash = null;
        try { if (fs.existsSync(snap)) snapHash = dirHash(snap); } catch (e) { snapHash = null; }
        const ok = snapHash && getSetting(approvedKey(id), '') === snapHash;
        if (ok) {
          // freigegebene Kopie verwenden (auch ihre erweiterung.json)
          try { const m2 = JSON.parse(fs.readFileSync(path.join(snap, 'erweiterung.json'), 'utf8')); if (m2.id === id) Object.assign(p.meta, { name: id, version: '0', ...m2, id, standardAktiv: false }); } catch (e) { /* */ }
          p.dir = snap; p.liveDir = pdir;
          if (live && live !== snapHash) { p.pending = true; p.error = null; }
        } else if (!p.error) {
          p.unapproved = true;
          p.error = 'Noch nicht freigegeben. Das Adminkonto muss sie unter Einstellungen → Module prüfen und freigeben.';
        }
      }
      plugins.set(id, p);
    }
  }
}

function load({ app, admin, helpers }) {
  discover();
  for (const p of plugins.values()) {
    if (p.builtin) continue;
    const id = p.meta.id;
    // Rechte der Erweiterung bekannt machen (nur sichtbar, solange sie aktiv ist)
    if (p.error) continue;   // nicht freigegeben oder fehlerhaft: kein Code, keine Dateien, keine Rechte
    for (const [k, v] of Object.entries(p.meta.perms || {})) if (/^[a-z0-9_]{2,40}$/.test(k) && !auth.PERMS[k] && !RESERVED_PERMS.has(k)) auth.PERMS[k] = String(v);
    const guard = (req, res, next) => (isActive(id) ? next() : res.status(404).json({ error: 'Diese Erweiterung ist nicht aktiv.' }));
    // Seiten und Dateien einer ausgeschalteten Erweiterung: Text für Seiten, JSON für alles unter /api/
    const inactive = (req, res) => (req.originalUrl.startsWith('/api/') ? res.status(404).json({ error: 'Diese Erweiterung ist nicht aktiv.' }) : res.status(404).type('text/plain; charset=utf-8').send('Erweiterung nicht aktiv'));
    const pub = path.join(p.dir, 'public');
    const slug = tabletSlug(p);
    if (fs.existsSync(pub) && slug && !p.meta.tablet.seite && fs.existsSync(path.join(pub, 'index.html'))) {
      // Seite unter /<pfad>/ ausliefern; <base> lässt alle relativen Adressen (Skripte, Stile, API) weiter auf /x/<id>/ zeigen –
      // so funktioniert sie auch hinter der Home-Assistant-Seitenleiste (Ingress) unverändert
      const page = (req, res) => {
        if (!isActive(id)) return inactive(req, res);
        if (!req.path.endsWith('/')) return res.redirect(302, `${slug}/` + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
        const html = tabletPage(id, `../x/${id}/`);
        if (!html) return res.status(404).end();
        res.setHeader('Cache-Control', 'no-cache'); res.type('html').send(html);
      };
      app.get([`/${slug}`, `/${slug}/`, `/${slug}/index.html`], page);
      // alte Adresse /x/<id>/ → neue Adresse (Lesezeichen und Tablets mit gespeicherter Seite)
      app.get([`/x/${id}/`, `/x/${id}/index.html`], (req, res) => res.redirect(302, `../../${slug}/` + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));
    }
    if (fs.existsSync(pub)) app.use(`/x/${id}`, (req, res, next) => (isActive(id) ? next() : inactive(req, res)),
      express.static(pub, { setHeaders: res => res.setHeader('Cache-Control', 'no-cache') }));
    const serverFile = path.join(p.dir, 'server.js');
    if (!fs.existsSync(serverFile)) continue;
    try {
      const tablet = express.Router(), adminR = express.Router(), member = express.Router(), publicR = express.Router();
      app.use(`/api/tablet/x/${id}`, guard, tablet);       // Passwortschutz der Buchungsseite greift hier mit
      admin.use(`/x/${id}`, guard, adminR);                 // nur angemeldete Admins
      const ctx = {
        id, meta: p.meta, appVersion: APP_VERSION, tablet, admin: adminR, db, getSetting, setSetting, audit, auditDiff, auth,
        isActive: () => isActive(id), require: name => require(name), ...helpers,
        setting: (k, d) => getSetting(`ext_${id}_${k}`, d), setSetting2: (k, v) => setSetting(`ext_${id}_${k}`, v),
        hooks: p.hooks, mail: require('./mail'),   // zentraler E-Mail-Versand (Einstellungen → Postfach)
        // Push-Benachrichtigungen (Mitglieder-App): Anlässe meldet das Modul über hooks.pushEvents an; send(ids, 'anlass', { title, body, url, tag })
        push: { send: (ids, ev, msg) => require('./push').send(ids, `${id}.${ev}`, msg), enabled: ev => require('./push').enabled(`${id}.${ev}`), lead: ev => require('./push').lead(`${id}.${ev}`) },
        bank: require('./bank'),   // Bankkonten des Vereins: list() · get(id) · def() · forDepartment(id) · pick({ id, department })
        // Übersetzen: ctx.T('Text {0}', [wert]) in der Sprache der Anfrage bzw. der Vereinssprache (Fehlermeldungen, E-Mails, Excel und PDF übersetzt der Kern selbst)
        T: (t, v) => require('./i18n').T(t, v), lang: () => require('./i18n').current(),
        member, access: memberapp.access,
        // öffentlich erreichbar über den Port der Mitglieder-App (z. B. Online-Mitgliedsantrag): /api/p/<id>/…, Seiten aus public/online unter /p/<id>/
        public: publicR,
        /** Hooks anderer aktiver Module aufrufen: callHooks('name', …) → [{ id, result }] (Fehler einzelner Module werden übersprungen) */
        callHooks: async (name, ...args) => {
          const out = [];
          for (const q of plugins.values()) {
            if (q.meta.id === id || typeof q.hooks[name] !== 'function' || !isActive(q.meta.id)) continue;
            try { out.push({ id: q.meta.id, name: q.meta.name, result: await q.hooks[name](...args) }); } catch (e) { console.error(`Hook ${name} (${q.meta.id}):`, e.message); }
          }
          return out;
        },
        /** wie callHooks, aber für Hooks, die sofort antworten (keine Promises) – für Abfragen mitten in einer Berechnung */
        callHooksSync: (name, ...args) => {
          const out = [];
          for (const q of plugins.values()) {
            if (q.meta.id === id || typeof q.hooks[name] !== 'function' || !isActive(q.meta.id)) continue;
            try { out.push({ id: q.meta.id, name: q.meta.name, result: q.hooks[name](...args) }); } catch (e) { console.error(`Hook ${name} (${q.meta.id}):`, e.message); }
          }
          return out;
        },
        isModuleActive: other => isActive(other),
        /** Adresse der Mitglieder-App (https) für Links in E-Mails, z. B. Kalender – leer, wenn keine eingetragen ist */
        appUrl: () => memberapp.appUrl(),
        // Home-Assistant-Geräte gehören genau einem Modul: z. B. kann der Türöffner nicht als Beregnungs-Zone eingetragen werden
        entityOwner: ent => { for (const q of plugins.values()) { if (q.meta.id === id || typeof q.hooks.usedEntities !== 'function') continue; try { if (q.hooks.usedEntities().includes(ent)) return q.meta.name; } catch (e) { /* */ } } return null; },   // Mitglieder-App: Router unter /api/m/<id>, Freischaltungen je Mitglied
      };
      if (p.meta.mitgliederApp) memberapp.register(id, { name: p.meta.name, label: p.meta.mitgliederApp.label || p.meta.name, order: p.meta.mitgliederApp.order,
        dir: p.dir, router: member, hooks: p.hooks, isActive: () => isActive(id), perm: p.meta.verwaltung ? p.meta.verwaltung.recht : null,
        open: p.meta.mitgliederApp.alle === true, away: p.meta.mitgliederApp.unterwegs !== false,
        nonMembers: p.meta.mitgliederApp.keinMitglied === true,   // auch für Konten „Kein Mitglied“ (z. B. Trainer) – nur mit eigener Freischaltung
          // schaltet etwas im Verein (Türen, Beregnung): nach einer Kopplung von unterwegs ohne zweiten Faktor erst nach dem ersten Besuch im Vereins-WLAN
          sensitive: p.meta.mitgliederApp.vertraulich === true || p.meta.mitgliederApp.unterwegs === false });   // alle = für jedes gekoppelte Handy ohne eigene Freischaltung
      memberapp.registerPublic(id, { router: publicR, dir: p.dir, isActive: () => isActive(id) });
      require(serverFile).activate(ctx);
    } catch (e) {
      p.error = 'Fehler beim Laden: ' + e.message;
      console.error(`Erweiterung „${id}“:`, e);
    }
  }
  const n = [...plugins.values()];
  if (n.length) console.log('Erweiterungen:', n.map(p => `${p.meta.id} ${p.meta.version}${p.error ? ' (Fehler)' : isActive(p.meta.id) ? ' (aktiv)' : ''}`).join(', '));
}

function list() {
  return [...plugins.values()].sort((a, b) => String(a.meta.name).localeCompare(String(b.meta.name), 'de')).map(p => ({ id: p.meta.id, name: p.meta.name, version: p.meta.version, description: p.meta.beschreibung || '', short: p.meta.kurz ? String(p.meta.kurz).slice(0, 140) : String(p.meta.beschreibung || '').split(/(?<=[.:–])\s/)[0].slice(0, 140),
    source: p.source, error: p.error, unapproved: Boolean(p.unapproved), pending: Boolean(p.pending), hash: (p.unapproved || p.pending) && p.hash ? p.hash : undefined, active: isActive(p.meta.id), installed: !isUninstalled(p.meta.id), perms: Object.keys(p.meta.perms || {}),
    tablet: p.meta.tablet || null, verwaltung: p.meta.verwaltung || null, builtin: Boolean(p.builtin),
    configIO: !p.error && typeof p.hooks.exportConfig === 'function' && typeof p.hooks.importConfig === 'function',
    adminScript: !p.builtin && !p.error && fs.existsSync(path.join(p.dir, 'public', 'admin.js')) }));
}

function setActive(id, on, user) {
  const p = plugins.get(id);
  if (!p) throw new Error('Erweiterung nicht gefunden.');
  if (on && p.error) throw new Error(p.error);
  if (on && isUninstalled(id)) throw new Error('Das Modul ist nicht installiert – erst installieren.');
  const was = isActive(id);
  setSetting(activeKey(id), on ? '1' : '0');
  audit(user, on ? 'Erweiterung aktiviert' : 'Erweiterung deaktiviert', `${p.meta.name} ${p.meta.version}`);
  // Hook „deactivate“: laufende Vorgänge beenden (z. B. Beregnung: offene Ventile schließen) – darf das Ausschalten nicht verhindern
  if (was && !on && typeof p.hooks.deactivate === 'function') {
    Promise.resolve().then(() => p.hooks.deactivate(user)).catch(e => console.error(`Erweiterung „${id}“ beim Deaktivieren:`, e.message));
  }
}

/** Einträge für die Kopfzeile am Tablet: aktive Erweiterungen (falls sie sich zeigen wollen) */
function tabletNav() {
  const out = [];
  for (const p of plugins.values()) {
    if (!isActive(p.meta.id) || !p.meta.tablet) continue;
    try { if (p.hooks.tabletVisible && !p.hooks.tabletVisible()) continue; } catch (e) { continue; }
    out.push({ id: p.meta.id, label: String(p.meta.tablet.label || p.meta.name), href: tabletHref(p) });
  }
  return out;
}

/** Rechte nur von aktiven Erweiterungen anzeigen */
function visiblePerms() {
  const hidden = new Set();
  for (const p of plugins.values()) if (!isActive(p.meta.id)) Object.keys(p.meta.perms || {}).forEach(k => hidden.add(k));
  return Object.fromEntries(Object.entries(auth.PERMS).filter(([k]) => !hidden.has(k)));
}

auth.setPermFilter(k => { for (const p of plugins.values()) if (p.meta.perms && p.meta.perms[k] !== undefined && !isActive(p.meta.id)) return false; return true; });
const withHook = name => [...plugins.values()].filter(p => !p.builtin && !p.error && isActive(p.meta.id) && typeof p.hooks[name] === 'function');
const activeIds = () => [...plugins.values()].filter(p => isActive(p.meta.id)).map(p => p.meta.id);

/* ---------- Erweiterung als ZIP hochladen (wird beim nächsten Neustart geladen) ---------- */
async function installZip(buf) {
  const JSZip = require('jszip');
  let zip;
  try { zip = await JSZip.loadAsync(buf); } catch (e) { throw new Error('Die Datei ist kein gültiges ZIP-Archiv.'); }
  const files = Object.values(zip.files).filter(f => !f.dir && !/(^|\/)(__MACOSX|\.DS_Store)/.test(f.name));
  if (!files.length || files.length > 500) throw new Error('Das ZIP enthält keine oder zu viele Dateien.');
  // angegebene Größe vor dem Entpacken prüfen (gegen „ZIP-Bomben“)
  if (require('./util').zipSize(files) > 20 * 1024 * 1024) throw new Error('Die Erweiterung ist zu groß (höchstens 20 MB).');
  // erweiterung.json direkt im ZIP oder in genau einem Ordner darin
  const metaFile = files.filter(f => /(^|\/)erweiterung\.json$/.test(f.name)).sort((a, b) => a.name.length - b.name.length)[0];
  if (!metaFile) throw new Error('Im ZIP fehlt die Datei „erweiterung.json“.');
  const root = metaFile.name.slice(0, -'erweiterung.json'.length);
  let meta;
  try { meta = JSON.parse(await metaFile.async('string')); } catch (e) { throw new Error('„erweiterung.json“ ist kein gültiges JSON.'); }
  const id = String(meta.id || '');
  if (!ID_RE.test(id)) throw new Error('Ungültige id in „erweiterung.json“ (nur Kleinbuchstaben, Ziffern, Bindestrich).');
  const existing = plugins.get(id);
  if (existing && existing.source !== 'hochgeladen') throw new Error(`„${id}“ ist bereits als mitgeliefertes Modul vorhanden und kann nicht ersetzt werden.`);
  if (meta.minApp && verNum(APP_VERSION) < verNum(meta.minApp)) throw new Error(`Diese Erweiterung braucht Clubwerk ${meta.minApp} oder neuer (installiert: ${APP_VERSION}).`);
  let total = 0;
  const out = [];
  const unsafe = require('./util').zipUnsafe(zip);
  if (unsafe) throw new Error(`Ungültiger Dateipfad im ZIP: ${unsafe.unsafeOriginalName}`);
  for (const f of files) {
    if (!f.name.startsWith(root)) continue;
    const rel = f.name.slice(root.length);
    if (!rel || rel.includes('..') || rel.startsWith('/') || /[\\:]/.test(rel)) throw new Error(`Ungültiger Dateipfad im ZIP: ${f.name}`);
    const data = await f.async('nodebuffer');
    total += data.length;
    if (total > 20 * 1024 * 1024) throw new Error('Die Erweiterung ist zu groß (höchstens 20 MB).');
    out.push([rel, data]);
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const tmp = path.join(UPLOAD_DIR, `.${id}-${Date.now()}`);
  for (const [rel, data] of out) { const t = path.join(tmp, rel); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.writeFileSync(t, data); }
  const dest = path.join(UPLOAD_DIR, id);
  const update = fs.existsSync(dest);
  if (update) fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(tmp, dest);
  // Hochgeladen vom Adminkonto = geprüft und freigegeben (genau dieser Stand)
  setSetting(approvedKey(id), dirHash(dest));
  return { id, name: meta.name || id, version: meta.version || '', update };
}
/** Erweiterung aus dem Netzwerkordner freigeben – genau den Stand mit der Prüfsumme, die dem Admin angezeigt wurde; wirksam nach Neustart */
function approve(id, expected) {
  const p = plugins.get(id);
  if (!p || p.source === 'mitgeliefert' || p.builtin) throw new Error('Nur hochgeladene oder nachinstallierte Erweiterungen brauchen eine Freigabe.');
  if (!/^[0-9a-f]{64}$/.test(String(expected || ''))) throw new Error('Prüfsumme fehlt – bitte die Liste neu laden.');
  const src = p.liveDir || p.dir;
  if (dirHash(src) !== expected) throw new Error('Die Dateien wurden seit dem Anzeigen geändert – bitte die Liste neu laden und erneut prüfen.');
  const hash = p.source === 'nachinstalliert' ? snapshot(id, src, expected) : expected;
  setSetting(approvedKey(id), hash);
  return { name: p.meta.name, hash };
}
function removeUploaded(id) {
  const p = plugins.get(id);
  if (!p || p.source !== 'hochgeladen') throw new Error('Nur hochgeladene Erweiterungen lassen sich hier entfernen.');
  fs.rmSync(path.join(UPLOAD_DIR, id), { recursive: true, force: true });
  return p.meta.name;
}
const get = id => plugins.get(id);

/** Ordner der geladenen, freigegebenen Erweiterungen (für deren Sprachdateien) */
const dirs = () => [...plugins.values()].filter(p => p.dir && !p.error && !p.unapproved && !p.pending).map(p => p.dir);

module.exports = { tabletSlug, tabletPage, dirs, APPROVED_DIR, load, list, setActive, isActive, tabletNav, visiblePerms, activeIds, withHook, installZip, removeUploaded, approve, get };
