// @ts-check
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
const DB_FILE = path.join(DATA_DIR, 'clubwerk.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const HA_SNAPSHOT = path.join(BACKUP_DIR, 'ha-snapshot.db');
const HA_MARKER = path.join(DATA_DIR, '.restore-ha-snapshot');
const RESTORE_MARKER = path.join(DATA_DIR, '.restore-pending');   // enthält den Dateinamen der gewünschten Sicherung
const RESTORE_DIRS = path.join(DATA_DIR, '.restore-dirs');       // Ordner (Belege, Bilder, Erweiterungen) aus einer Komplettsicherung
const VERSION_FILE = path.join(DATA_DIR, '.clubwerk-version');   // Version, die zuletzt mit dieser Datenbank lief (Schnappschuss „vor-update“, Rückweg)
/* Aufbewahrung je Anlass: so viele der neuesten Schnappschüsse bleiben (alle anderen Anlässe: SONST) */
const KEEP = { auto: 14, manuell: 10, 'vor-update': 3, 'vor-wiederherstellung': 3, hochgeladen: 3, komplett: 2, 'vor-verschluesselung': 2, verschluesselt: 2 };
const KEEP_SONST = 3, KEEP_KOMPLETT = 3, KEEP_ORDNER = 2;
const RESTE_MS = 3600000;   // halbe Dateien und Arbeitsordner, die so lange liegen, gehören zu einem abgebrochenen Vorgang
const RESERVE_BYTES = 20 * 1024 * 1024;   // Luft, die nach einer Kopie mindestens frei bleiben soll
const HA_STALE_MS = 2 * 3600000;   // so viel jünger darf die Datenbank als der HA-Schnappschuss sein (Schreiben während eines langen Backups)
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0');

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = () => require('./util').fileStamp();
/* Schnappschüsse heißen clubwerk_<Datum>_<Uhrzeit>_<Anlass>.db. Bis 2026.11.1 hießen sie getraenke_… (Altlast der Getränke-App):
   Diese Namen gelten weiter – sie stehen in der Liste, lassen sich wiederherstellen und werden mit aufgeräumt. */
const fileName = reason => `clubwerk_${stamp()}_${String(reason).replace(/[^\w-]/g, '')}.db`;
/** Zeitstempel-Teil („2026-11-01_031500_auto.db“) – zum Sortieren und Vergleichen über alte und neue Namen hinweg */
const stampOf = f => f.replace(/^(clubwerk|getraenke)_/, '');
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
    // Trigger und Views liefen später bei jedem Schreiben mit – Clubwerk legt nur bookings_snapshot an; Namen nur aus einfachen Zeichen
    const foreign = d.prepare("SELECT type, name FROM sqlite_master WHERE (type = 'view' OR (type = 'trigger' AND name != 'bookings_snapshot')) OR name GLOB '*[^A-Za-z0-9_]*'").all()
      .filter(o => !/^sqlite_autoindex_/.test(o.name));
    if (foreign.length) return 'Die Datenbank enthält Bestandteile, die Clubwerk nie anlegt (Trigger, Views oder ungewöhnliche Namen) – aus Sicherheitsgründen wird sie nicht übernommen.';
    return null;
  } catch (e) { return 'Datei lässt sich nicht öffnen: ' + e.message; }
  finally {
    if (d) d.close();
    for (const ext of ['-wal', '-shm']) { try { if (file !== DB_FILE) fs.unlinkSync(file + ext); } catch (e) { /* nicht vorhanden */ } }
  }
}

/** Datei und Ordner auf die Platte zwingen (nach Stromausfall weder halb noch leer) */
function fsyncFile(file) { const fd = fs.openSync(file, 'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function fsyncDir(dir) { try { const fd = fs.openSync(dir, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } } catch (e) { /* nicht überall möglich */ } }
/** Fertige Kopie unter dem Endnamen ablegen: erst auf die Platte, dann umbenennen (atomar) */
function commit(tmp, file) { fsyncFile(tmp); fs.renameSync(tmp, file); fsyncDir(path.dirname(file)); }
/** Freier Platz im Ordner (Bytes); Tests können ihn mit CW_TEST_FREI vorgeben */
function frei(dir) {
  if (process.env.CW_TEST_FREI) return Number(process.env.CW_TEST_FREI);
  try { const st = fs.statfsSync(dir); return st.bavail * st.bsize; } catch (e) { return Infinity; }
}
const groesse = f => { try { return fs.statSync(f).size; } catch (e) { return 0; } };
/** Reicht der Platz für `bytes`? Sonst erst aufräumen und noch einmal messen. */
function platz(dir, bytes) {
  if (frei(dir) >= bytes + RESERVE_BYTES) return true;
  aufraeumen();
  return frei(dir) >= bytes + RESERVE_BYTES;
}

/** Schnappschuss der laufenden Datenbank (erst als .tmp, Endname erst nach Erfolg – eine abgebrochene Kopie gilt nie als Sicherung). */
async function snapshot(db, reason = 'manuell') {
  const name = fileName(reason), file = path.join(BACKUP_DIR, name), tmp = file + '.tmp';
  if (!platz(BACKUP_DIR, groesse(DB_FILE))) throw new Error('Zu wenig freier Speicher für eine Sicherung.');
  try {
    await db.backup(tmp);
    standalone(tmp);
    commit(tmp, file);
  } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
  aufraeumen();
  return name;
}

/** Schnappschuss ohne geöffnete Datenbank (beim Start, vor den Umbauten der neuen Version): VACUUM INTO liest einen konsistenten Stand, auch mit -wal */
function snapshotSync(reason) {
  const name = fileName(reason), file = path.join(BACKUP_DIR, name), tmp = file + '.tmp';
  if (!platz(BACKUP_DIR, groesse(DB_FILE) + groesse(DB_FILE + '-wal'))) throw new Error('Zu wenig freier Speicher für eine Sicherung.');
  const Database = require('better-sqlite3');
  let d;
  try {
    d = new Database(DB_FILE, { fileMustExist: true });
    d.pragma('busy_timeout = 10000');
    d.prepare('VACUUM INTO ?').run(tmp);
    d.close(); d = null;
    standalone(tmp);
    commit(tmp, file);
  } catch (e) { if (d) d.close(); fs.rmSync(tmp, { force: true }); throw e; }
  return name;
}

/**
 * Beim Start VOR dem Öffnen der Datenbank (vor den Umbauten der neuen Version): Hat die Version gewechselt, den bisherigen Stand als
 * Schnappschuss „vor-update“ aufheben – auch beim Update über Home Assistant („Neu bauen“), das selbst keine Sicherung anlegt.
 * Läuft eine ältere Version als zuletzt, steht das in `neuer` (Rückweg: die Datenbank kann Spalten und Regeln enthalten, die diese Version nicht kennt).
 * @returns {null | { von, nach, neuer, datei, fehler }}
 */
function vorUpdate(version) {
  let von = ''; try { von = fs.readFileSync(VERSION_FILE, 'utf8').trim(); } catch (e) { /* erster Start mit dieser Prüfung */ }
  if (von === version) return null;
  const { verNum } = require('./selfupdate');
  /** @type {{ von: string|null, nach: string, neuer: string|null, datei: string|null, fehler: string|null }} */
  const r = { von: von || null, nach: version, neuer: von && verNum(von) > verNum(version) ? von : null, datei: null, fehler: null };
  if (fs.existsSync(DB_FILE)) {
    try { r.datei = snapshotSync('vor-update'); aufraeumen(); }
    catch (e) { r.fehler = e.message; }
  }
  if (!r.fehler) {   // ohne Schnappschuss beim nächsten Start noch einmal versuchen
    const tmp = VERSION_FILE + '.tmp';
    try { fs.writeFileSync(tmp, version); commit(tmp, VERSION_FILE); } catch (e) { console.error('Versionsmerker:', e.message); }
  }
  return r;
}

/** Sicherungsdatei auf klassisches Journal umstellen, damit sie ohne -wal/-shm-Dateien vollständig ist. */
function standalone(file) {
  try {
    const Database = require('better-sqlite3');
    const d = new Database(file); d.pragma('journal_mode = DELETE'); d.close();
  } catch (e) { console.error('Sicherung umstellen:', e.message); }
}

/**
 * Aufräumen nach Aufbewahrung je Art – unabhängig davon, ob gerade eine Sicherung geklappt hat (sonst heilt sich eine volle Platte nie):
 * Schnappschüsse je Anlass, lokale Komplettsicherungen, beiseitegelegte Ordner früherer Wiederherstellungen, Reste abgebrochener Vorgänge.
 * Nie gelöscht: der HA-Schnappschuss, die zur Wiederherstellung vorgemerkte Sicherung und je Anlass die neueste.
 * @returns {{ dateien: number, bytes: number }}
 */
function aufraeumen() {
  const out = { dateien: 0, bytes: 0 }, alt = (f, ms = RESTE_MS) => { try { return Date.now() - fs.statSync(f).mtimeMs > ms; } catch (e) { return false; } };
  const weg = p => { try { const st = fs.statSync(p); const n = st.isDirectory() ? 0 : st.size; fs.rmSync(p, { recursive: true, force: true }); out.dateien++; out.bytes += n; } catch (e) { /* schon gelöscht */ } };
  const ls = d => { try { return fs.readdirSync(d); } catch (e) { return []; } };
  const behalten = pendingRestore();
  // Schnappschüsse: clubwerk_<Datum>_<Uhrzeit>_<Anlass>.db (alte getraenke_… zählen mit, sortiert nach Zeitstempel)
  const nachArt = {};
  for (const f of ls(BACKUP_DIR)) {
    const m = f.match(/^(?:clubwerk|getraenke)_\d{4}-\d\d-\d\d_\d{6}_([\w-]+)\.db$/);
    if (m) (nachArt[m[1]] = nachArt[m[1]] || []).push(f);
    else if (/\.tmp$/.test(f) && alt(path.join(BACKUP_DIR, f))) weg(path.join(BACKUP_DIR, f));   // halbe Kopie eines abgebrochenen Schnappschusses
  }
  for (const [art, files] of Object.entries(nachArt)) {
    files.sort((a, b) => stampOf(a).localeCompare(stampOf(b)));
    const keep = Math.max(1, KEEP[art] || KEEP_SONST);
    for (const f of files.slice(0, Math.max(0, files.length - keep))) if (f !== behalten) weg(path.join(BACKUP_DIR, f));
  }
  // lokale Komplettsicherungen (die neuesten bleiben; die Generationen liegen am Sicherungsziel)
  const KD = path.join(BACKUP_DIR, 'komplett');
  const kompl = ls(KD).filter(f => /\.cwbackup$/.test(f)).sort().reverse();
  for (const f of kompl.slice(KEEP_KOMPLETT)) weg(path.join(KD, f));
  for (const f of ls(KD)) if (!/\.cwbackup$/.test(f) && alt(path.join(KD, f))) weg(path.join(KD, f));
  // beiseitegelegte Ordner früherer Wiederherstellungen (vor-wiederherstellung_<Zeit>) – die neuesten bleiben
  const aside = ls(DATA_DIR).filter(n => /^vor-wiederherstellung_[\d_-]+$/.test(n)).sort().reverse();
  for (const n of aside.slice(KEEP_ORDNER)) weg(path.join(DATA_DIR, n));
  // Reste abgebrochener Vorgänge: Entpack-Ordner einer Wiederherstellung, hochgeladene/geladene Komplettsicherungen
  // und halbe Kopien im Datenordner (Datenbank bei einer abgebrochenen Wiederherstellung, Merker)
  const eigeneTmp = new Set([path.basename(DB_FILE) + '.tmp', path.basename(VERSION_FILE) + '.tmp']);   // nur eigene halbe Kopien, nie Dateien anderer Teile
  for (const n of ls(DATA_DIR)) if ((/^\.wiederherstellung-/.test(n) || eigeneTmp.has(n)) && alt(path.join(DATA_DIR, n))) weg(path.join(DATA_DIR, n));
  const EIN = path.join(DATA_DIR, '.sicherung-eingang');
  for (const f of ls(EIN)) if (alt(path.join(EIN, f), 24 * RESTE_MS)) weg(path.join(EIN, f));
  if (out.dateien) console.log(`Aufgeräumt: ${out.dateien} alte Sicherungen und Reste (${Math.round(out.bytes / 1e6)} MB).`);
  return out;
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
function cancelRestore() { try { fs.unlinkSync(RESTORE_MARKER); } catch (e) { /* Datei gibt es nicht */ } fs.rmSync(RESTORE_DIRS, { recursive: true, force: true }); }
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
  if (fs.existsSync(HA_MARKER) && fs.existsSync(HA_SNAPSHOT)) {
    // Zurückgespieltes HA-Backup: Datenbank und Schnappschuss stammen aus demselben Backup (gleich alt). Ist die Datenbank viel neuer,
    // lief nur backup_post nicht (HA abgestürzt) – dann wäre der Schnappschuss ein stiller Rückschritt: Markierung verwerfen.
    const mt = f => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
    const newer = Math.max(mt(DB_FILE), mt(DB_FILE + '-wal')) - mt(HA_SNAPSHOT);
    if (newer > HA_STALE_MS) { console.error(`Home-Assistant-Markierung verworfen: Die Datenbank ist ${Math.round(newer / 3600000)} h neuer als der Schnappschuss (backup_post lief nicht).`); try { fs.unlinkSync(HA_MARKER); } catch (e) { /* Datei gibt es nicht */ } }
    else { src = HA_SNAPSHOT; why = 'Home-Assistant-Backup'; }
  }
  const wanted = pendingRestore();
  if (wanted && safeName(wanted) && fs.existsSync(path.join(BACKUP_DIR, wanted))) { src = path.join(BACKUP_DIR, wanted); why = `Sicherung ${wanted}`; }
  if (!src) { try { fs.unlinkSync(HA_MARKER); } catch (e) { /* Datei gibt es nicht */ } cancelRestore(); return null; }
  const err = validate(src);
  if (err) { console.error(`Wiederherstellung abgebrochen (${why}): ${err}`); cancelRestore(); try { fs.unlinkSync(HA_MARKER); } catch (e) { /* Datei gibt es nicht */ } return null; }
  // Platz: Kopie des bisherigen Stands + neue Datenbank als .tmp (erst danach wird getauscht – die alte bleibt bis zuletzt unangetastet)
  const need = groesse(src) + (fs.existsSync(DB_FILE) ? groesse(DB_FILE) + groesse(DB_FILE + '-wal') : 0);
  if (!platz(DATA_DIR, need)) {
    const msg = `Wiederherstellung abgebrochen (${why}): Zu wenig freier Speicher – nötig sind rund ${Math.ceil((need + RESERVE_BYTES) / 1e6)} MB. Die bisherige Datenbank ist unverändert.`;
    console.error(msg); cancelRestore(); try { fs.unlinkSync(HA_MARKER); } catch (e) { /* Datei gibt es nicht */ }
    return msg;
  }
  // aktuellen Stand zur Sicherheit aufheben
  if (fs.existsSync(DB_FILE)) {
    const keep = path.join(BACKUP_DIR, fileName('vor-wiederherstellung')), tmp = keep + '.tmp';
    try {
      const Database = require('better-sqlite3');
      const d = new Database(DB_FILE); d.pragma('wal_checkpoint(TRUNCATE)'); d.close();
    } catch (e) { /* Datei evtl. beschädigt – trotzdem kopieren */ }
    fs.copyFileSync(DB_FILE, tmp);
    commit(tmp, keep);
  }
  // neue Datenbank erst vollständig als .tmp auf die Platte, dann umbenennen – ein Abbruch mittendrin lässt die bisherige stehen
  const tmp = DB_FILE + '.tmp';
  try { fs.copyFileSync(src, tmp); fsyncFile(tmp); }
  catch (e) { fs.rmSync(tmp, { force: true }); const msg = `Wiederherstellung abgebrochen (${why}): ${e.message}. Die bisherige Datenbank ist unverändert.`; console.error(msg); cancelRestore(); return msg; }
  // -wal/-shm der bisherigen Datenbank weg (geleert per Checkpoint), sonst spielte SQLite sie in die neue ein
  for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(DB_FILE + ext); } catch (e) { /* Datei gibt es nicht */ } }
  fs.renameSync(tmp, DB_FILE);
  fsyncDir(DATA_DIR);
  fs.rmSync(path.join(DATA_DIR, 'gobd-geprueft.json'), { force: true });   // GoBD: nach dem Zurückspielen die ganze Prüfkette nachrechnen (src/gobd.js, geprüfter Stand)
  try { fs.unlinkSync(HA_MARKER); } catch (e) { /* Datei gibt es nicht */ }
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
function haPost() { try { fs.unlinkSync(HA_MARKER); } catch (e) { /* Datei gibt es nicht */ } }

module.exports = { BACKUP_DIR, DB_FILE, DATA_DIR, snapshot, vorUpdate, aufraeumen, frei, list, validate, markRestore, pendingRestore, cancelRestore, applyPendingRestore, safeName, stamp, fileName, stampOf, stageDirs, standalone };

// Aufruf von der Kommandozeile: node backup.js pre|post
if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    if (cmd === 'pre') { await haPre(); console.log('Clubwerk: Schnappschuss für das Home-Assistant-Backup erstellt.'); }
    else if (cmd === 'post') { haPost(); console.log('Clubwerk: Backup abgeschlossen.'); }
    else { console.log('Aufruf: node backup.js pre|post'); process.exitCode = 2; }
  })().catch(e => { console.error('Clubwerk-Backup fehlgeschlagen:', e.message); process.exitCode = 1; });
}
