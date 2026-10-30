'use strict';
/* ---------- Teil-Wiederherstellung: einzelne Module und Teile aus einer Komplettsicherung übernehmen (ab 3.100) ----------
   Ablauf (Verein › Datensicherung › „Aus Sicherung übernehmen …“, nur Benutzer mit allen Rechten):
   1. Öffnen: Sicherung entschlüsseln (fullbackup.extract) in einen temporären Ordner außerhalb von /data (nie in Sicherungen).
      Dort startet eine **Lesekopie**: derselbe Clubwerk-Code als Kindprozess (CW_LESEKOPIE=1, src/abschottung.js – nichts nach
      außen, keine fremden Programme) mit der alten Datenbank. Sie bringt die Datenbank auf den heutigen Stand (Migrationen),
      ruft für jedes dort eingeschaltete Modul dessen exportConfig auf und liest die Konten am Tablet, schickt alles über den
      IPC-Kanal und beendet sich. Danach wird der Ordner restlos gelöscht – es bleibt nur das Ergebnis im Arbeitsspeicher.
      Tresor der Sicherung: Code bzw. Passwort geht nur über den IPC-Kanal, nie in Dateien, Umgebung oder Protokoll.
   2. Inhaltsliste mit Teilen je Modul; Abhängigkeiten werden automatisch mit gewählt.
   3. Vorschau: dieselbe Übernahme in einem Sicherungspunkt, der danach verworfen wird (importConfig mit dry).
   4. Übernehmen: vorher Schnappschuss, dann importConfig der Module (gleicher Name → aktualisieren, sonst neu, nie löschen) –
      es gibt nur diesen einen Weg, denselben wie beim Funktionsimport. Vertrauliche Felder landen über die Tresor-Kopie im
      Arbeitsspeicher und werden mit dem Schlüssel dieser Installation verschlüsselt. Eintrag ins Protokoll (ohne Inhalte).
   Bewegungsdaten (Mitglieder mit Bank und Mandaten, Verkäufe, Buchungen, Stunden, offene Posten) folgen in Stufe 2
   (planung/teil-wiederherstellung.md). Konten merken sich ihre Herkunft (teil_herkunft), damit Stufe 2 sie wiederfindet. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PREFIX = 'clubwerk-teil-';
const LESEN_MS = Number(process.env.CW_TEIL_LESEN_SEK || 180) * 1000;   // höchstens so lange darf die Lesekopie brauchen
const OFFEN_MS = 30 * 60000;                                            // geöffnete Sicherung verfällt nach 30 Minuten
const MAX_ERGEBNIS = 64 * 1024 * 1024;                                  // Ergebnis der Lesekopie (JSON) höchstens 64 MB
const MAX_KONTEN = 20000;
const KONTO_ARTEN = ['mitglied', 'mannschaft', 'verein', 'gast', 'extern', 'nichtmitglied'];
const VEREIN_KEYS = ['club_name', 'club_street', 'club_city', 'club_email', 'club_phone', 'club_color', 'club_color2', 'club_logo', 'club_logo_type'];
const LOGO_ARTEN = ['svg', 'png', 'jpg', 'webp'];
/* Module, deren Export Felder aus dem Tresor enthält (vault.js SPEC) – ohne geöffneten Tresor der Sicherung nicht übernehmbar */
const VERTRAULICH = new Set(['buchhaltung']);
/* Teile je Modul (Schlüssel im Export). Module ohne Eintrag sind ein Teil „Einrichtung“ (ganzer Export). */
const TEILE = {
  getraenke: [
    { key: 'articles', label: 'Artikel (mit Bildern)', zahl: d => `${(d.articles || []).length} Artikel, ${(d.articles || []).filter(a => a.image).length} Bilder` },
    { key: 'suppliers', label: 'Lieferanten-Zuordnungen', zahl: d => `${(d.suppliers || []).length} Zuordnungen`, braucht: ['articles'], warum: 'die Zuordnungen zeigen auf Artikel' },
    { key: 'settings', label: 'Reihenfolge der Kategorien und „Gerade oft hier“' },
  ],
};
const NAMEN = { depts: 'Abteilungen', fees: 'Beitragsarten', places: 'Orte', teams: 'Mannschaften', partners: 'Firmen', staff: 'Personen', labels: 'Buchungsarten',
  resources: 'Plätze/Geräte', doors: 'Türen', profiles: 'Zeitprofile', plaetze: 'Plätze', blockDays: 'Sperrzeiträume' };
const ueberblick = d => Object.entries(d || {}).filter(([k, v]) => NAMEN[k] && Array.isArray(v) && v.length).map(([k, v]) => `${v.length} ${NAMEN[k]}`).join(', ') || 'Einstellungen';

/* ======================= Lesekopie (Kindprozess mit der alten Datenbank) ======================= */
function lesekopie({ plugins, db, vault, getSetting }) {
  process.once('message', async m => {
    const out = { module: [], konten: [], verein: {}, tresor: vault.on() ? 'zu' : 'aus' };
    try {
      const geheim = m && typeof m.tresor === 'string' ? m.tresor.slice(0, 300) : '';
      if (vault.on() && geheim) {
        try { vault.unlockWithCode(geheim); } catch (e) { /* kein Code */ }
        for (const u of db.prepare('SELECT user_id FROM vault_wrap WHERE user_id > 0').all()) { if (!vault.locked()) break; vault.onLogin(u.user_id, geheim); }
      }
      if (vault.on()) { out.tresor = vault.locked() ? 'zu' : 'offen'; if (geheim && vault.locked()) out.tresorFalsch = true; }
      for (const p of plugins.list()) {
        if (!p.active || !p.configIO) continue;
        const e = { id: p.id, name: p.name, version: p.version, vertraulich: VERTRAULICH.has(p.id) && out.tresor === 'zu' };
        try { e.data = await plugins.get(p.id).hooks.exportConfig(); } catch (err) { e.fehler = String(err.message || err).slice(0, 200); }
        out.module.push(e);
      }
      out.konten = db.prepare('SELECT id, name, kind, first_name, last_name, active, pin_hash, pin_changed_at FROM members WHERE deleted = 0 AND pending = 0 ORDER BY id LIMIT ?').all(MAX_KONTEN);
      for (const k of VEREIN_KEYS) { const v = getSetting(k, null); if (v != null && v !== '') out.verein[k] = v; }
      if (JSON.stringify(out).length > MAX_ERGEBNIS) throw new Error('Die Sicherung ist für die Übernahme zu groß.');
      process.send({ ok: true, out }, () => process.exit(0));
    } catch (e) { process.send({ ok: false, error: String(e.message || e).slice(0, 300) }, () => process.exit(1)); }
  });
  process.send({ bereit: true });
}

/* ======================= Hauptprozess ======================= */
let cur = null;   // { id, userId, at, created, app, club, quelle, module, konten, verein, tresor, tresorFalsch, upload }

/** Reste nach einem Absturz löschen (beim Start) – nur Ordner, deren Clubwerk nicht mehr läuft */
function cleanup() {
  const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
  try {
    for (const n of fs.readdirSync(os.tmpdir()).filter(x => x.startsWith(PREFIX))) {
      const d = path.join(os.tmpdir(), n); let owner = 0;
      try { owner = Number(fs.readFileSync(path.join(d, 'clubwerk.pid'), 'utf8')); } catch (e) { /* ohne Kennung: Rest */ }
      if (!owner || owner === process.pid || !alive(owner)) fs.rmSync(d, { recursive: true, force: true });
    }
  } catch (e) { /* kein tmp */ }
}

function schliessen() {
  if (cur && cur.upload) { try { fs.unlinkSync(cur.upload); } catch (e) { /* schon weg */ } }
  cur = null;
}
const offen = userId => {
  if (cur && Date.now() - cur.at > OFFEN_MS) schliessen();
  return cur && cur.userId === userId ? cur : null;
};

const verNr = v => String(v || '').split('.').map(x => parseInt(x, 10) || 0);
const neuer = (a, b) => { const x = verNr(a), y = verNr(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

/** Kennung der Installation, aus der die Sicherung stammt (für die Herkunft der Konten) – direkt aus der Datei gelesen, vor jeder Migration */
function herkunftVon(dbFile) {
  const Database = require('better-sqlite3');
  const d = new Database(dbFile, { readonly: true, fileMustExist: true });
  try {
    const s = d.prepare("SELECT value FROM settings WHERE key = 'install_id'").get();
    if (s && s.value) return s.value;
    const m = d.prepare('SELECT MIN(created_at) t FROM members').get();   // ältere Sicherungen: erstes Konto – bleibt über alle Sicherungen gleich
    return 'alt-' + crypto.createHash('sha256').update(String(m && m.t)).digest('hex').slice(0, 16);
  } finally { d.close(); }
}

/** Lesekopie starten, Ergebnis abholen, Ordner danach löschen */
function lesen(dir, tresor) {
  return new Promise((resolve, reject) => {
    const env = { PATH: process.env.PATH, TZ: process.env.TZ || '', NODE_ENV: process.env.NODE_ENV || 'production', LANG: process.env.LANG || '',
      DATA_DIR: dir, PORT: '0', HOST: '127.0.0.1', MEMBER_PORT: '0', BEREGNUNG_PORT: '0', EXT_DIR: path.join(dir, 'keine-erweiterungen'),
      CW_LESEKOPIE: '1', CW_TEST_NO_SETUP_CODE: '1', NODE_OPTIONS: '--max-old-space-size=512' };
    fs.mkdirSync(env.EXT_DIR, { recursive: true });
    const proc = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env, cwd: path.join(__dirname, '..'), stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let fertig = false, log = '';
    proc.stderr.on('data', d => { log = (log + d).slice(-2000); });
    const ende = (err, out) => {
      if (fertig) return; fertig = true; clearTimeout(t);
      try { proc.kill('SIGKILL'); } catch (e) { /* schon weg */ }
      if (err) { if (log) console.error('Teil-Wiederherstellung, Lesekopie:', log.split('\n').filter(Boolean).slice(-3).join(' | ')); reject(err); } else resolve(out);
    };
    const t = setTimeout(() => ende(new Error('Das Lesen der Sicherung dauert zu lange – abgebrochen.')), LESEN_MS);
    proc.on('message', m => {
      if (m && m.bereit) proc.send({ tresor: tresor || '' });
      else if (m && m.ok) ende(null, m.out);
      else if (m) ende(new Error(m.error || 'Die Sicherung ließ sich nicht lesen.'));
    });
    proc.on('error', e => ende(new Error('Die Sicherung ließ sich nicht lesen: ' + e.message)));
    proc.on('exit', () => ende(new Error('Die Sicherung ließ sich nicht lesen (ältere oder beschädigte Datenbank).')));
  });
}

/** Sicherung öffnen: entschlüsseln, prüfen, Lesekopie, aufräumen */
async function oeffnen({ src, upload, password, key, tresor, user, appVersion, fullbackup, backup }) {
  const head = fullbackup.readHeader(src).head;
  if (head.app && neuer(head.app, appVersion)) throw new Error(`Diese Sicherung stammt aus Clubwerk ${head.app} – hier läuft ${appVersion}. Bitte zuerst Clubwerk aktualisieren.`);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));   // 0700, nie unter /data
  try {
    fs.writeFileSync(path.join(base, 'clubwerk.pid'), String(process.pid));
    const dir = path.join(base, 'daten');
    const man = await fullbackup.extract(src, password ? { password, outDir: dir } : { key, outDir: dir });
    const err = backup.validate(path.join(dir, fullbackup.DB_NAME));
    if (err) throw new Error(err);
    const quelle = herkunftVon(path.join(dir, fullbackup.DB_NAME));
    const out = await lesen(dir, tresor);
    if (cur && cur.upload && cur.upload !== upload) { try { fs.unlinkSync(cur.upload); } catch (e) { /* */ } }
    cur = { id: crypto.randomBytes(12).toString('hex'), userId: user.id, at: Date.now(), created: man.created, app: man.app || head.app || '', club: man.club || '',
      quelle, upload, ...out };
    return cur;
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
}

/* ---------- Inhaltsliste ---------- */
function inhalt(c, plugins) {
  const gruppen = [];
  if (Object.keys(c.verein).length) gruppen.push({ id: 'kern', name: 'Verein', teile: [{ id: 'kern:verein', label: 'Vereinsname, Anschrift, Logo und Farbe', detail: c.verein.club_name || '' }] });
  for (const m of [...c.module].sort((a, b) => (b.id === 'getraenke') - (a.id === 'getraenke'))) {   // Verkauf gleich nach dem Verein
    const p = plugins.get(m.id);
    const aktiv = p && plugins.isActive(m.id) && typeof p.hooks.importConfig === 'function';
    const sperre = !aktiv ? 'In dieser Installation nicht eingeschaltet – zuerst unter Einstellungen › Module einschalten.'
      : m.fehler ? 'Lässt sich aus der Sicherung nicht lesen.'
      : m.vertraulich ? 'Enthält Daten aus dem Tresor der Sicherung – dafür beim Öffnen unter „Tresor der Sicherung“ den Wiederherstellungscode oder das Passwort eines damaligen Admins eingeben.' : '';
    const teile = TEILE[m.id] && m.data ? TEILE[m.id].map(t => ({ id: `${m.id}:${t.key}`, label: t.label, detail: t.zahl ? t.zahl(m.data) : '',
      braucht: (t.braucht || []).map(k => `${m.id}:${k}`), warum: t.warum || '' })) : [{ id: `${m.id}:*`, label: 'Einrichtung', detail: ueberblick(m.data) }];
    if (m.id === 'getraenke') teile.push({ id: 'getraenke:_konten', label: 'Konten am Tablet (Name, Art, PIN)', detail: `${c.konten.length} Konten – ohne offene Beträge und Buchungen` });
    gruppen.push({ id: m.id, name: p ? p.meta.name : m.name, sperre, teile });
  }
  return gruppen;
}
/** Auswahl prüfen und um Abhängigkeiten ergänzen → { ids, dazu: [{ id, warum }] } */
function auswahl(c, plugins, ids) {
  const alle = new Map();
  for (const g of inhalt(c, plugins)) for (const t of g.teile) alle.set(t.id, { ...t, gruppe: g });
  const set = new Set(), dazu = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    const t = alle.get(String(id));
    if (!t) throw new Error('Unbekannter Teil der Sicherung.');
    if (t.gruppe.sperre) throw new Error(`${t.gruppe.name}: ${t.gruppe.sperre}`);
    set.add(t.id);
  }
  for (const id of [...set]) for (const b of alle.get(id).braucht || []) if (!set.has(b)) { set.add(b); dazu.push({ id: b, label: alle.get(b).label, warum: alle.get(id).warum }); }
  if (!set.size) throw new Error('Bitte mindestens einen Teil wählen.');
  return { ids: set, dazu };
}

/* ---------- Übernehmen (bzw. Vorschau mit dry) ---------- */
function zaehler3() {
  const m = new Map();
  const z = (label, art) => { const e = m.get(label) || { neu: 0, aktualisiert: 0, 'unverändert': 0 }; e[art]++; m.set(label, e); };
  z.text = () => [...m].map(([l, e]) => `${l}: ${['neu', 'aktualisiert', 'unverändert'].filter(a => e[a]).map(a => `${e[a]} ${a}`).join(', ')}`).join(' · ') || 'nichts zu übernehmen';
  return z;
}
/** Konten am Tablet: Herkunft → dasselbe Konto; sonst gleicher Name (ohne Groß-/Kleinschreibung, wie beim Anlegen) → aktualisieren; sonst neu.
    Nie löschen, die Art eines vorhandenen Kontos bleibt, eine hier schon vergebene PIN bleibt. Offene Beträge gehören zu den Verkäufen
    (Stufe 2) und kommen nicht mit. Ist hier die Mitgliederverwaltung eingeschaltet, entstehen Mitglieder nur dort (wie beim Anlegen von Hand):
    vorhandene Mitglieder-Konten werden ergänzt, neue nicht angelegt. */
function kontenUebernehmen(db, c, { mvAktiv }) {
  const z = zaehler3(); let ohne = 0;
  const her = db.prepare("SELECT neu_id FROM teil_herkunft WHERE quelle = ? AND tabelle = 'members' AND alt_id = ?");
  const merk = db.prepare("INSERT INTO teil_herkunft(quelle, tabelle, alt_id, neu_id) VALUES (?, 'members', ?, ?) ON CONFLICT(quelle, tabelle, alt_id) DO UPDATE SET neu_id = excluded.neu_id");
  const byId = db.prepare('SELECT * FROM members WHERE id = ? AND deleted = 0');
  const schl = (name, kind) => (kind === 'extern' ? 'extern|' : '') + name.toLowerCase();
  const live = new Map(db.prepare('SELECT * FROM members WHERE deleted = 0').all().map(m => [schl(m.name, m.kind), m]));
  const str = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
  for (const k of c.konten) {
    const name = str(k.name, 80);
    if (!name || !KONTO_ARTEN.includes(k.kind)) continue;
    const h = her.get(c.quelle, k.id);
    const found = (h && byId.get(h.neu_id)) || live.get(schl(name, k.kind));
    const v = { first_name: str(k.first_name, 80), last_name: str(k.last_name, 80), active: k.active ? 1 : 0 };
    const pin = typeof k.pin_hash === 'string' && k.pin_hash.length < 400 ? k.pin_hash : null;
    let id;
    if (found) {
      id = found.id;
      const neuPin = !found.pin_hash && pin;
      if (found.first_name === v.first_name && found.last_name === v.last_name && found.active === v.active && !neuPin) z('Konten', 'unverändert');
      else {
        db.prepare('UPDATE members SET first_name = ?, last_name = ?, active = ? WHERE id = ?').run(v.first_name, v.last_name, v.active, id);
        if (neuPin) db.prepare("UPDATE members SET pin_hash = ?, pin_changed_at = ?, pin_changed_by = 'Übernahme aus Sicherung' WHERE id = ?").run(pin, k.pin_changed_at || null, id);
        z('Konten', 'aktualisiert');
      }
    } else if (k.kind === 'mitglied' && mvAktiv) { ohne++; continue; }
    else {
      id = Number(db.prepare('INSERT INTO members(name, kind, first_name, last_name, active, pin_hash, pin_changed_at, pin_changed_by) VALUES (?,?,?,?,?,?,?,?)')
        .run(name, k.kind, v.first_name, v.last_name, v.active, pin, pin ? k.pin_changed_at || null : null, pin ? 'Übernahme aus Sicherung' : null).lastInsertRowid);
      live.set(schl(name, k.kind), { id, name, kind: k.kind, ...v, pin_hash: pin });
      z('Konten', 'neu');
    }
    merk.run(c.quelle, k.id, id);
  }
  return z.text() + (ohne ? ` – ${ohne} Mitglieder ohne Konto hier nicht angelegt (Mitglieder entstehen in der Mitgliederverwaltung)` : '');
}
function vereinUebernehmen(c, { getSetting, setSetting }) {
  const v = c.verein, z = zaehler3();
  const ok = (k, x) => (/^club_color2?$/.test(k) ? /^#[0-9a-f]{6}$/i.test(x) : k === 'club_logo_type' ? LOGO_ARTEN.includes(x) : k === 'club_logo' ? x.length <= 4 * 1024 * 1024 : x.length <= 300);
  const logo = v.club_logo && v.club_logo_type && ok('club_logo', v.club_logo) && ok('club_logo_type', v.club_logo_type);
  for (const k of VEREIN_KEYS) {
    if (typeof v[k] !== 'string' || !ok(k, v[k]) || ((k === 'club_logo' || k === 'club_logo_type') && !logo)) continue;
    const label = k === 'club_logo' ? 'Logo' : k === 'club_logo_type' ? null : /color/.test(k) ? 'Farbe' : 'Vereinsdaten';
    if (getSetting(k, '') === v[k]) { if (label) z(label, 'unverändert'); continue; }
    setSetting(k, v[k]); if (label) z(label, 'aktualisiert');
  }
  if (logo) setSetting('club_logo_ver', String(Date.now()));   // Symbole und Startbildschirm-Icons neu erzeugen
  return z.text();
}

/** Ausgewählte Teile übernehmen. dry: alles in einem Sicherungspunkt, der danach verworfen wird. → [{ name, text }] */
async function anwenden(c, ids, { db, plugins, user, dry, getSetting, setSetting }) {
  const zeilen = [];
  const module = c.module.filter(m => [...ids].some(i => i.startsWith(m.id + ':') && i !== 'getraenke:_konten'));
  module.sort((a, b) => (a.id === 'getraenke') - (b.id === 'getraenke'));   // Verkauf zuletzt: schreibt Bilddateien
  db.exec('SAVEPOINT cw_teil');
  let ok = false;
  try {
    if (ids.has('kern:verein')) zeilen.push({ name: 'Verein', text: vereinUebernehmen(c, { getSetting, setSetting }) });
    if (ids.has('getraenke:_konten')) zeilen.push({ name: 'Konten am Tablet', text: kontenUebernehmen(db, c, { mvAktiv: plugins.isActive('mitglieder') }) });
    for (const m of module) {
      let data = m.data;
      if (TEILE[m.id]) { data = {}; for (const t of TEILE[m.id]) if (ids.has(`${m.id}:${t.key}`) && m.data[t.key] !== undefined) data[t.key] = m.data[t.key]; }
      const p = plugins.get(m.id);
      let text;
      try { text = await p.hooks.importConfig(data, { user, dry }); } catch (e) { throw new Error(`${p.meta.name}: ${e.message}`); }
      zeilen.push({ name: p.meta.name, text: String(text || 'übernommen') });
    }
    ok = true;
  } finally {
    if (dry || !ok) db.exec('ROLLBACK TO cw_teil');
    db.exec('RELEASE cw_teil');
  }
  return zeilen;
}

/* ======================= Schnittstelle der Verwaltung ======================= */
function routes(admin, d) {
  if (process.env.CW_LESEKOPIE === '1') return;   // die Lesekopie bietet nichts an
  const { db, plugins, need, owner, bad, asyncRoute, rateLimit, ownerConfirm, audit, quelle, fullbackup, backup, bkKey, appVersion, getSetting, setSetting } = d;
  db.exec(`CREATE TABLE IF NOT EXISTS teil_herkunft (
    quelle  TEXT NOT NULL,      -- Kennung der Installation, aus der die Sicherung stammt
    tabelle TEXT NOT NULL,
    alt_id  INTEGER NOT NULL,
    neu_id  INTEGER NOT NULL,
    at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (quelle, tabelle, alt_id))`);
  if (!getSetting('install_id', '')) setSetting('install_id', crypto.randomBytes(12).toString('hex'));
  cleanup();
  const ansicht = c => ({ id: c.id, created: c.created, app: c.app, club: c.club, tresor: c.tresor, tresorFalsch: Boolean(c.tresorFalsch), gruppen: inhalt(c, plugins) });

  admin.post('/backups/teil/oeffnen', need('einstellungen'), owner, rateLimit('bkteil', 10, 10 * 60000), asyncRoute(async (req, res) => {
    const b = req.body || {};
    let q;
    try { q = await quelle(b); } catch (e) { return bad(res, e.message); }
    if (!q) return bad(res, 'Sicherung nicht gefunden.', 404);
    let behalten = false;
    try {
      const k = bkKey();
      const c = await oeffnen({ src: q.src, upload: b.source === 'upload' ? q.src : null, password: String(b.password || '').slice(0, 300), key: k ? k.key : null,
        tresor: String(b.tresor || ''), user: req.user, appVersion, fullbackup, backup });
      behalten = b.source === 'upload';
      res.json({ ok: true, ...ansicht(c) });
    } catch (e) {
      if (e.needPassword) { behalten = b.source === 'upload'; return res.status(400).json({ error: e.message, needPassword: true }); }
      bad(res, e.message);
    } finally { if (q.temp && !behalten) { try { fs.unlinkSync(q.src); } catch (e) { /* egal */ } } }
  }));
  admin.post('/backups/teil/vorschau', need('einstellungen'), owner, asyncRoute(async (req, res) => {
    const b = req.body || {}; const c = offen(req.user.id);
    if (!c || c.id !== b.id) return bad(res, 'Die geöffnete Sicherung ist abgelaufen – bitte noch einmal öffnen.', 410);
    try {
      const a = auswahl(c, plugins, b.auswahl);
      const zeilen = await anwenden(c, a.ids, { db, plugins, user: req.user, dry: true, getSetting, setSetting });
      res.json({ ok: true, zeilen, dazu: a.dazu, auswahl: [...a.ids] });
    } catch (e) { bad(res, e.message); }
  }));
  admin.post('/backups/teil/uebernehmen', need('einstellungen'), rateLimit('bkteilu', 10, 10 * 60000), asyncRoute(async (req, res) => {
    if (!ownerConfirm(req, res)) return;
    const b = req.body || {}; const c = offen(req.user.id);
    if (!c || c.id !== b.id) return bad(res, 'Die geöffnete Sicherung ist abgelaufen – bitte noch einmal öffnen.', 410);
    const vault = require('./vault');
    if (vault.locked()) return bad(res, 'Der Tresor dieser Installation ist gesperrt – bitte einmal ab- und wieder anmelden.', 423);
    let a; try { a = auswahl(c, plugins, b.auswahl); } catch (e) { return bad(res, e.message); }
    if ([...a.ids].some(i => i.startsWith('beregnung:')) && db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'irr_steps'").get()
      && db.prepare("SELECT 1 FROM irr_steps WHERE state IN ('wait','run') LIMIT 1").get()) return bad(res, 'Gerade läuft eine Beregnung – bitte warten, bis sie fertig ist.', 409);
    const snap = await backup.snapshot(db, 'vor-wiederherstellung');
    try {
      const zeilen = await anwenden(c, a.ids, { db, plugins, user: req.user, dry: false, getSetting, setSetting });
      audit(req.user, 'Aus Sicherung übernommen', `Stand ${String(c.created).slice(0, 16).replace('T', ' ')}: ${zeilen.map(z => `${z.name} – ${z.text}`).join(' | ')} (vorher gesichert: ${snap})`);
      schliessen();
      res.json({ ok: true, zeilen, snapshot: snap });
    } catch (e) { bad(res, e.message); }
  }));
  admin.post('/backups/teil/schliessen', need('einstellungen'), (req, res) => { if (offen(req.user.id)) schliessen(); res.json({ ok: true }); });
}

module.exports = { lesekopie, routes, cleanup, inhalt, auswahl, TEILE, PREFIX, aktiv: () => Boolean(cur) };
