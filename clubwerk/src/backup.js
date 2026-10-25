'use strict';
/**
 * Datensicherung
 *  - Schnappschüsse der Datenbank in /data/backups (SQLite-Online-Backup, auch im laufenden Betrieb konsistent)
 *  - nachts automatisch, vor jeder Wiederherstellung und auf Knopfdruck
 *  - Home-Assistant-Backup: backup_pre erzeugt ha-snapshot.db + Markierung, backup_post entfernt die Markierung.
 *    Wird ein HA-Backup zurückgespielt, ist die Markierung dabei → beim Start wird der Schnappschuss übernommen.
 */
const fs = require('fs');
const path = require('path');

// Im Add-on liegt alles in /data – auch wenn backup_pre ohne unsere Umgebungsvariablen aufgerufen wird
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data/options.json') ? '/data' : path.join(__dirname, '..', 'data'));
const DB_FILE = require('./dbfile')(DATA_DIR);
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const HA_SNAPSHOT = path.join(BACKUP_DIR, 'ha-snapshot.db');
const HA_MARKER = path.join(DATA_DIR, '.restore-ha-snapshot');
const RESTORE_MARKER = path.join(DATA_DIR, '.restore-pending');   // enthält den Dateinamen der gewünschten Sicherung
const RESTORE_DIRS = path.join(DATA_DIR, '.restore-dirs');       // Ordner (Belege, Bilder, Erweiterungen) aus einer Komplettsicherung
const KEEP_AUTO = 14;
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0');

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = () => require('./util').fileStamp();
const safeName = f => typeof f === 'string' && /^[\w.-]+\.db$/.test(f) && !f.includes('..');

function isSqlite(file) {
  try {
    const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(16);
    fs.readSync(fd, b, 0, 16, 0); fs.closeSync(fd);
    return b.equals(SQLITE_MAGIC);
  } catch (e) { return false; }
}

/** Prüft, ob eine Datei eine brauchbare Clubwerk-Datenbank ist. */
function validate(file) {
  if (!isSqlite(file)) return 'Das ist keine SQLite-Datenbank.';
  const Database = require('better-sqlite3');
  let d;
  try {
    d = new Database(file, { readonly: true, fileMustExist: true });
    const ok = d.prepare('PRAGMA integrity_check').get();
    if (!ok || Object.values(ok)[0] !== 'ok') return 'Die Datenbank ist beschädigt.';
    const tables = new Set(d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
    for (const t of ['members', 'articles', 'bookings', 'deliveries']) if (!tables.has(t)) return `Tabelle „${t}“ fehlt – das ist keine Sicherung von Clubwerk.`;
    return null;
  } catch (e) { return 'Datei lässt sich nicht öffnen: ' + e.message; }
  finally {
    if (d) d.close();
    for (const ext of ['-wal', '-shm']) { try { if (file !== DB_FILE) fs.unlinkSync(file + ext); } catch (e) { /* nicht vorhanden */ } }
  }
}

/** Schnappschuss der laufenden Datenbank. */
async function snapshot(db, reason = 'manuell') {
  const name = `getraenke_${stamp()}_${reason.replace(/[^\w-]/g, '')}.db`;
  await db.backup(path.join(BACKUP_DIR, name));
  standalone(path.join(BACKUP_DIR, name));
  if (reason === 'auto') rotate();
  return name;
}

/** Sicherungsdatei auf klassisches Journal umstellen, damit sie ohne -wal/-shm-Dateien vollständig ist. */
function standalone(file) {
  try {
    const Database = require('better-sqlite3');
    const d = new Database(file); d.pragma('journal_mode = DELETE'); d.close();
  } catch (e) { console.error('Sicherung umstellen:', e.message); }
}

function rotate() {
  const autos = fs.readdirSync(BACKUP_DIR).filter(f => /_auto\.db$/.test(f)).sort();
  autos.slice(0, Math.max(0, autos.length - KEEP_AUTO)).forEach(f => { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (e) { /* egal */ } });
}

function list() {
  return fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db')).map(f => {
    const st = fs.statSync(path.join(BACKUP_DIR, f));
    return { file: f, size: st.size, mtime: st.mtime.toISOString() };
  }).sort((a, b) => b.mtime.localeCompare(a.mtime));
}

function markRestore(file) {
  if (!safeName(file) || !fs.existsSync(path.join(BACKUP_DIR, file))) throw new Error('Sicherung nicht gefunden.');
  const err = validate(path.join(BACKUP_DIR, file));
  if (err) throw new Error(err);
  fs.writeFileSync(RESTORE_MARKER, file);
}
function pendingRestore() {
  try { return fs.readFileSync(RESTORE_MARKER, 'utf8').trim() || null; } catch (e) { return null; }
}
function cancelRestore() { try { fs.unlinkSync(RESTORE_MARKER); } catch (e) { /* egal */ } fs.rmSync(RESTORE_DIRS, { recursive: true, force: true }); }
/** Ordner aus einer Komplettsicherung für den nächsten Start bereitlegen (gehört zu genau dieser Datenbank-Sicherung) */
function stageDirs(fromDir, dbFile, names) {
  fs.rmSync(RESTORE_DIRS, { recursive: true, force: true });
  fs.mkdirSync(RESTORE_DIRS, { recursive: true, mode: 0o700 });
  for (const n of names) { const src = path.join(fromDir, n); if (fs.existsSync(src)) fs.renameSync(src, path.join(RESTORE_DIRS, n)); }
  fs.writeFileSync(path.join(RESTORE_DIRS, '.fuer'), dbFile);
}
function applyDirs(forFile) {
  let fuer = ''; try { fuer = fs.readFileSync(path.join(RESTORE_DIRS, '.fuer'), 'utf8').trim(); } catch (e) { return; }
  if (fuer !== forFile) { fs.rmSync(RESTORE_DIRS, { recursive: true, force: true }); return; }
  const aside = path.join(DATA_DIR, `vor-wiederherstellung_${stamp()}`);
  for (const n of fs.readdirSync(RESTORE_DIRS)) {
    if (n.startsWith('.') || !/^[\w-]+$/.test(n)) continue;
    const cur = path.join(DATA_DIR, n);
    if (fs.existsSync(cur)) { fs.mkdirSync(aside, { recursive: true }); fs.renameSync(cur, path.join(aside, n)); }
    fs.renameSync(path.join(RESTORE_DIRS, n), cur);
  }
  fs.rmSync(RESTORE_DIRS, { recursive: true, force: true });
}

/** Beim Start VOR dem Öffnen der Datenbank aufrufen. Gibt eine Meldung zurück, falls etwas wiederhergestellt wurde. */
function applyPendingRestore() {
  let src = null, why = null;
  if (fs.existsSync(HA_MARKER) && fs.existsSync(HA_SNAPSHOT)) { src = HA_SNAPSHOT; why = 'Home-Assistant-Backup'; }
  const wanted = pendingRestore();
  if (wanted && safeName(wanted) && fs.existsSync(path.join(BACKUP_DIR, wanted))) { src = path.join(BACKUP_DIR, wanted); why = `Sicherung ${wanted}`; }
  if (!src) { try { fs.unlinkSync(HA_MARKER); } catch (e) { /* egal */ } cancelRestore(); return null; }
  const err = validate(src);
  if (err) { console.error(`Wiederherstellung abgebrochen (${why}): ${err}`); cancelRestore(); try { fs.unlinkSync(HA_MARKER); } catch (e) { /* egal */ } return null; }
  // aktuellen Stand zur Sicherheit aufheben
  if (fs.existsSync(DB_FILE)) {
    const keep = path.join(BACKUP_DIR, `getraenke_${stamp()}_vor-wiederherstellung.db`);
    try {
      const Database = require('better-sqlite3');
      const d = new Database(DB_FILE); d.pragma('wal_checkpoint(TRUNCATE)'); d.close();
    } catch (e) { /* Datei evtl. beschädigt – trotzdem kopieren */ }
    fs.copyFileSync(DB_FILE, keep);
  }
  for (const ext of ['', '-wal', '-shm']) { try { fs.unlinkSync(DB_FILE + ext); } catch (e) { /* egal */ } }
  fs.copyFileSync(src, DB_FILE);
  try { fs.unlinkSync(HA_MARKER); } catch (e) { /* egal */ }
  if (wanted) { try { applyDirs(wanted); } catch (e) { console.error('Ordner aus der Komplettsicherung:', e.message); } }
  cancelRestore();
  return `Datenbank wiederhergestellt aus ${why}.`;
}

/** Für Home Assistant: vor dem Backup (backup_pre) bzw. danach (backup_post). */
async function haPre() {
  const Database = require('better-sqlite3');
  const d = new Database(DB_FILE, { fileMustExist: true });
  d.pragma('busy_timeout = 10000');
  await d.backup(HA_SNAPSHOT + '.tmp');
  d.close();
  standalone(HA_SNAPSHOT + '.tmp');
  fs.renameSync(HA_SNAPSHOT + '.tmp', HA_SNAPSHOT);
  fs.writeFileSync(HA_MARKER, new Date().toISOString());
}
function haPost() { try { fs.unlinkSync(HA_MARKER); } catch (e) { /* egal */ } }

module.exports = { BACKUP_DIR, DB_FILE, DATA_DIR, snapshot, list, validate, markRestore, pendingRestore, cancelRestore,
  applyPendingRestore, haPre, haPost, safeName, stamp, stageDirs, standalone };

// Aufruf von der Kommandozeile: node backup.js pre|post
if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    if (cmd === 'pre') { await haPre(); console.log('Clubwerk: Schnappschuss für das Home-Assistant-Backup erstellt.'); }
    else if (cmd === 'post') { haPost(); console.log('Clubwerk: Backup abgeschlossen.'); }
    else { console.log('Aufruf: node backup.js pre|post'); process.exitCode = 2; }
  })().catch(e => { console.error('Clubwerk-Backup fehlgeschlagen:', e.message); process.exitCode = 1; });
}
