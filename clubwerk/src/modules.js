'use strict';
/* Module deinstallieren / wieder installieren.
   Vor dem Deinstallieren entsteht eine Modul-Sicherung (ZIP mit modul.json + ggf. Belegen). Sie liegt im Datenordner
   unter „modul-sicherungen“ und muss heruntergeladen werden. Beim Installieren kann sie wieder eingespielt werden.
   Mitglieder & Konten gehören zum Kern und bleiben immer erhalten. */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { db, DATA_DIR, getSetting, setSetting } = require('./db');

const BACKUP_DIR = path.join(DATA_DIR, 'modul-sicherungen');
const BELEG_DIR = path.join(DATA_DIR, 'belege');
const FILE_RE = /^([a-z0-9-]+)_(\d{8}-\d{6})\.zip$/;
const crypto = require('crypto');
/* Geheimnisse (PIN-Hashes, API-Schlüssel, Passwörter, Tokens) kommen nie in eine Modul-Sicherung –
   nach dem Wiederherstellen werden sie in der Verwaltung neu eingetragen. */
const SECRET_KEY_RE = /(hash|_key|pass|pw|token|secret)/i;
// Spalten mit Geheimnissen (PIN-Hashes, Geräteschlüssel …) kommen nie in eine Modul-Sicherung
const SECRET_COL_RE = /(hash|token|secret|passw|^pin$|_pin$|api_key)/i;
/* Tresor: Sicherungen lesen und schreiben immer die echte Tabelle (main) – mit den verschlüsselten Werten.
   Ohne „main.“ träfe man die entschlüsselte Kopie im Arbeitsspeicher (Klartext in der ZIP-Datei) bzw. im gesperrten Zustand nur Platzhalter. */
const vault = () => require('./vault');
const encCols = t => new Set(((vault().SPEC.find(x => x.t === t) || {}).c) || []);
const stripSecrets = rows => rows.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !SECRET_COL_RE.test(k))));
/* Jede Sicherung wird mit einem Schlüssel unterschrieben, den nur dieses System kennt. Eingespielt werden nur
   unveränderte Sicherungen dieses Systems – eine selbst gebaute oder bearbeitete Datei wird abgelehnt. */
function signKey() {
  let k = getSetting('module_backup_secret', '');
  if (!/^[0-9a-f]{64}$/.test(k)) { k = crypto.randomBytes(32).toString('hex'); setSetting('module_backup_secret', k); }
  return k;
}
const sign = text => crypto.createHmac('sha256', signKey()).update(text).digest('hex');
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const MAX_RESTORE_BYTES = 300 * 1024 * 1024;   // entpackt

/* Was gehört zu welchem Modul? */
const DRINKS = {
  tables: ['bookings', 'delivery_items', 'deliveries', 'stock_moves', 'settlements', 'supplier_map', 'event_articles', 'event_payments', 'event_guests',
    'events', 'guest_tabs', 'member_settlements', 'articles'],
  settings: k => /^order_/.test(k) || ['customer_no', 'delivery_address', 'category_order', 'buchungstext', 'top_n', 'top_days'].includes(k),
  files: BELEG_DIR,
  what: 'Artikel und Preise, alle Buchungen, Lieferungen mit Belegen, Bestand und Inventuren, Veranstaltungen, Gäste-Deckel und Abrechnungen. Mitglieder und Konten bleiben erhalten.',
};
const CORE_TABLES = new Set(['admin_users', 'members', 'member_devices', 'member_access', 'audit_log', 'settings', 'sqlite_sequence']);
const CORE_SETTING_PREFIX = ['tablet_', 'mail_', 'dropbox_', 'club_', 'security_', 'app_', 'module_', 'plugin_', 'ext_', 'order_', 'admin', 'gate'];
const allTables = () => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
function spec(p) {
  const id = p.meta.id;
  if (id === 'getraenke') return DRINKS;
  const have = allTables();
  // Kern-Tabellen und Kern-Einstellungen gehören nie einem Modul – auch nicht, wenn eine Erweiterung sie für sich beansprucht
  const declared = Array.isArray(p.meta.tabellen) ? p.meta.tabellen.filter(t => /^[a-z0-9_]+$/.test(t) && !CORE_TABLES.has(t) && !DRINKS.tables.includes(t)) : null;
  const pref = id.replace(/-/g, '_') + '_';
  const tables = (declared || have.filter(t => t.startsWith(pref) && !CORE_TABLES.has(t) && !DRINKS.tables.includes(t))).filter(t => have.includes(t));
  const extra = (Array.isArray(p.meta.einstellungen) ? p.meta.einstellungen : [])
    .filter(x => /^[a-z0-9]{3,}_[a-z0-9_]*$/.test(x) && !CORE_SETTING_PREFIX.some(c => x.startsWith(c) || c.startsWith(x)));
  return {
    tables,
    settings: k => (k.startsWith(`ext_${id}_`) && k !== `ext_${id}_active` && k !== `ext_${id}_uninstalled`) || extra.some(x => k.startsWith(x)),
    files: null,
    what: 'alle Einstellungen, Protokolle und Freischaltungen in der Mitglieder-App.',
  };
}
const q = t => `"${t.replace(/"/g, '')}"`;
const settingKeysAll = sp => db.prepare('SELECT key FROM settings').all().map(r => r.key).filter(sp.settings);
const settingKeys = sp => settingKeysAll(sp).filter(k => !SECRET_KEY_RE.test(k));   // für Sicherungen: ohne Geheimnisse
const hasAccessTable = () => allTables().includes('member_access');

/** Wie viel wäre betroffen? (für die Sicherheitsabfrage) */
function usage(p) {
  const sp = spec(p);
  const rows = Object.fromEntries(sp.tables.map(t => [t, db.prepare(`SELECT COUNT(*) n FROM ${q(t)}`).get().n]));
  const access = hasAccessTable() ? db.prepare('SELECT COUNT(*) n FROM member_access WHERE module = ?').get(p.meta.id).n : 0;
  let files = 0;
  if (sp.files) try { files = fs.readdirSync(sp.files, { recursive: true, withFileTypes: true }).filter(d => d.isFile()).length; } catch (e) { /* kein Ordner */ }
  return { rows, total: Object.values(rows).reduce((a, n) => a + n, 0), access, files, settings: settingKeys(sp).length, what: sp.what };
}

const stamp = () => require('./util').nowTs().replace(/[-:]/g, '').replace(' ', '-');   // JJJJMMTT-HHMMSS

/** Sicherung erstellen und im Datenordner ablegen → Dateiname */
async function backup(p, user) {
  const sp = spec(p);
  const zip = new JSZip();
  const data = {
    format: 'clubwerk-modul', module: p.meta.id, name: p.meta.name, version: p.meta.version, created: new Date().toISOString(),
    club: getSetting('club_name', ''), by: user ? user.username : '',
    tables: Object.fromEntries(sp.tables.map(t => [t, stripSecrets(db.prepare(`SELECT * FROM main.${q(t)}`).all())])),
    vault: vault().on(),
    settings: Object.fromEntries(settingKeys(sp).map(k => [k, getSetting(k)])),
    memberAccess: hasAccessTable() ? db.prepare('SELECT * FROM member_access WHERE module = ?').all(p.meta.id) : [],
  };
  data.files = {};
  if (sp.files && fs.existsSync(sp.files)) {
    for (const d of fs.readdirSync(sp.files, { recursive: true, withFileTypes: true })) {
      if (!d.isFile()) continue;
      const full = path.join(d.parentPath || d.path, d.name);
      const rel = path.relative(sp.files, full).split(path.sep).join('/');
      const buf = fs.readFileSync(full);
      data.files[rel] = sha256(buf);
      zip.file('dateien/' + rel, buf);
    }
  }
  const json = JSON.stringify(data);
  zip.file('modul.json', json);
  zip.file('signatur.txt', sign(json));
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = `${p.meta.id}_${stamp()}.zip`;
  fs.writeFileSync(path.join(BACKUP_DIR, file), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  return file;
}

function listBackups(id) {
  let names = [];
  try { names = fs.readdirSync(BACKUP_DIR); } catch (e) { return []; }
  return names.map(f => ({ f, m: FILE_RE.exec(f) })).filter(x => x.m && (!id || x.m[1] === id))
    .map(({ f, m }) => { const st = fs.statSync(path.join(BACKUP_DIR, f)); return { file: f, module: m[1], at: st.mtime.toISOString(), size: st.size }; })
    .sort((a, b) => b.at.localeCompare(a.at));
}
function backupPath(file) {
  if (!FILE_RE.test(String(file || ''))) return null;
  const f = path.join(BACKUP_DIR, file);
  return fs.existsSync(f) ? f : null;
}

/** Alle Daten des Moduls löschen (nach erfolgter Sicherung) */
function wipe(p) {
  const sp = spec(p);
  db.pragma('foreign_keys = OFF');
  try {
    vault().suspend(() => db.transaction(() => {
      for (const t of sp.tables) db.prepare(`DELETE FROM main.${q(t)}`).run();
      for (const k of settingKeysAll(sp)) db.prepare('DELETE FROM settings WHERE key = ?').run(k);   // beim Löschen auch PINs/Schlüssel
      if (hasAccessTable()) db.prepare('DELETE FROM member_access WHERE module = ?').run(p.meta.id);
    })());
  } finally { db.pragma('foreign_keys = ON'); }
  if (sp.files && fs.existsSync(sp.files)) {
    for (const d of fs.readdirSync(sp.files, { withFileTypes: true })) fs.rmSync(path.join(sp.files, d.name), { recursive: true, force: true });
  }
}

/** Sicherung einspielen (ersetzt die Daten des Moduls) → Zusammenfassung. src: Pfad der ZIP-Datei oder Buffer */
async function restore(p, src) {
  let zip;
  try { zip = await JSZip.loadAsync(Buffer.isBuffer(src) ? src : fs.readFileSync(src)); } catch (e) { throw new Error('Die Datei ist keine Modul-Sicherung (kein ZIP).'); }
  // gegen „ZIP-Bomben“: angegebene Größen prüfen, bevor etwas entpackt wird
  const entries = Object.values(zip.files);
  if (entries.length > 20000) throw new Error('Die Modul-Sicherung enthält zu viele Dateien.');
  if (require('./util').zipSize(entries) > MAX_RESTORE_BYTES) throw new Error('Die Modul-Sicherung ist zu groß.');
  const mf = zip.file('modul.json'), sf = zip.file('signatur.txt');
  if (!mf) throw new Error('Die Datei ist keine Modul-Sicherung von Clubwerk.');
  const json = await mf.async('string');
  const sig = sf ? String(await sf.async('string')).trim() : '';
  const good = sign(json);
  if (!/^[0-9a-f]{64}$/.test(sig) || !crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(good, 'hex')))
    throw new Error('Diese Sicherung stammt nicht aus dieser Clubwerk-Installation oder wurde verändert – sie wird aus Sicherheitsgründen nicht eingespielt.');
  let data;
  try { data = JSON.parse(json); } catch (e) { throw new Error('Die Modul-Sicherung ist beschädigt.'); }
  if (!['clubwerk-modul', 'vereinsheim-modul'].includes(data.format)) throw new Error('Die Datei ist keine Modul-Sicherung von Clubwerk.');
  if (data.module !== p.meta.id) throw new Error(`Diese Sicherung gehört zum Modul „${data.name || data.module}“, nicht zu „${p.meta.name}“.`);
  const sp = spec(p);
  const have = new Set(allTables());
  const tables = Object.keys(data.tables || {}).filter(t => sp.tables.includes(t) && have.has(t));   // nie fremde Tabellen (z. B. Benutzer) überschreiben
  const V = vault();
  const encIn = tables.some(t => { const ec = encCols(t); return ec.size && (data.tables[t] || []).some(r => [...ec].some(c => V.isEnc(r[c]))); });
  if (encIn && !V.on()) throw new Error('Diese Sicherung wurde bei eingeschaltetem Tresor erstellt und enthält verschlüsselte Daten. Bitte zuerst den Tresor wieder einschalten.');
  let n = 0;
  db.pragma('foreign_keys = OFF');
  try {
    V.suspend(() => db.transaction(() => {
      for (const t of sp.tables) db.prepare(`DELETE FROM main.${q(t)}`).run();
      for (const t of tables) {
        const info = db.prepare(`PRAGMA main.table_info(${q(t)})`).all();
        const ec = V.on() ? encCols(t) : new Set();
        const cols = new Set(info.map(c => c.name));
        // Pflicht-Geheimnisspalten (z. B. PIN) bekommen einen unbrauchbaren Platzhalter → PIN muss neu vergeben werden
        const mustSecret = info.filter(c => SECRET_COL_RE.test(c.name) && c.notnull && c.dflt_value === null).map(c => c.name);
        for (const row0 of data.tables[t]) {
          const row = { ...row0 };
          for (const k of Object.keys(row)) if (SECRET_COL_RE.test(k)) delete row[k];   // nie Geheimnisse aus einer Datei übernehmen
          for (const c of mustSecret) row[c] = 'neu-vergeben';
          for (const c of ec) if (row[c] != null && !V.isEnc(row[c])) row[c] = V.encValue(row[c]);   // ältere Sicherung im Klartext → verschlüsselt ablegen
          const keys = Object.keys(row).filter(k => cols.has(k));
          if (!keys.length) continue;
          db.prepare(`INSERT OR REPLACE INTO main.${q(t)} (${keys.map(q).join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(k => row[k]));
          n++;
        }
      }
      for (const [k, v] of Object.entries(data.settings || {})) if (sp.settings(k) && !SECRET_KEY_RE.test(k) && v !== null && v !== undefined) setSetting(k, String(v));
      if (hasAccessTable() && Array.isArray(data.memberAccess)) {
        const cols = new Set(db.prepare('PRAGMA table_info(member_access)').all().map(c => c.name));
        const exists = db.prepare('SELECT 1 FROM members WHERE id = ?');
        for (const row of data.memberAccess) {
          if (row.module !== p.meta.id || !exists.get(row.member_id)) continue;
          const keys = Object.keys(row).filter(k => cols.has(k));
          db.prepare(`INSERT OR REPLACE INTO member_access (${keys.map(q).join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(k => row[k]));
        }
      }
    })());
  } finally { db.pragma('foreign_keys = ON'); }
  let files = 0;
  if (sp.files) {
    for (const f of Object.values(zip.files)) {
      if (f.dir || !f.name.startsWith('dateien/')) continue;
      const rel = f.name.slice(8);
      if (!rel || rel.includes('..') || rel.startsWith('/') || /[\\:]/.test(rel) || (f.unsafeOriginalName && f.unsafeOriginalName !== f.name)) continue;
      const target = path.join(sp.files, rel);
      if (!target.startsWith(sp.files + path.sep)) continue;
      const content = await f.async('nodebuffer');
      if (!data.files || data.files[rel] !== sha256(content)) continue;   // nur Dateien, die so in der Sicherung standen
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
      files++;
    }
  }
  return `${n} Datensätze${files ? `, ${files} Dateien` : ''} (PINs und Schlüssel bitte neu eintragen) aus der Sicherung vom ${new Date(data.created).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} wiederhergestellt`;
}

const uninstalledKey = id => `ext_${id}_uninstalled`;
const isUninstalled = id => getSetting(uninstalledKey(id), '0') === '1';
const setUninstalled = (id, on) => setSetting(uninstalledKey(id), on ? '1' : '0');

module.exports = { usage, backup, listBackups, backupPath, wipe, restore, isUninstalled, setUninstalled, BACKUP_DIR, DRINKS };
