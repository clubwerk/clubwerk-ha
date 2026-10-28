'use strict';
/* ---------- Demo-Modus ----------
   Erster Start → „Demo ausprobieren“: Der Server legt die Markierung .demo-start an (mit den Hashes der neuen, zufälligen Passwörter)
   und startet neu. Beim Start – VOR dem Öffnen der Datenbank – ersetzt applyPending() die leere Datenbank durch die Demo aus
   den Beispieldaten aller Module (erfundene Daten, Datumswerte auf heute verschoben).
   „Demo beenden und einrichten“ → Markierung .demo-ende, Neustart; applyPending() löscht dann alles im Datenordner außer KEEP
   (Datenbank, Belege, Bilder, Fotos, Dokumente, Mail-Anhänge, Sicherungen, Erweiterungen …) – Clubwerk ist danach wie neu installiert.
   Beides nur, wenn die Datenbank wirklich passt: Start nur auf einer frischen (kein Adminkonto, keine Buchungen), Ende nur in der Demo. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'demo');
const EXT = path.join(__dirname, '..', 'erweiterungen');
const KEEP = new Set(['options.json', 'update-reserve', '.update', '.setup-ticket']);   // Home-Assistant-Optionen und Programm-Reserve bleiben
const START = d => path.join(d, '.demo-start'), ENDE = d => path.join(d, '.demo-ende'), TICKET = d => path.join(d, '.setup-ticket');
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const p2 = x => String(x).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/* Beispieldaten je Modul: Kern in demo/kern.sql (mit dem Stichtag, an dem sie aufgenommen wurden), Verkauf in demo/getraenke.sql,
   jedes Modul in erweiterungen/<id>/demo/demo.sql. Bearbeitet werden sie mit werkzeuge/demo/aufteilen.js. */
const sqlFile = id => (id === 'getraenke' ? path.join(DIR, 'getraenke.sql') : path.join(EXT, id, 'demo', 'demo.sql'));
const moduleIds = () => ['getraenke', ...fs.readdirSync(EXT).filter(id => fs.existsSync(path.join(EXT, id, 'erweiterung.json')))];
/** Module mit Beispieldaten (für den „Demo“-Knopf) */
const withData = () => moduleIds().filter(id => fs.existsSync(sqlFile(id)));
const stichtag = () => /^-- Stichtag: (\d{4})-(\d{2})-(\d{2})$/m.exec(fs.readFileSync(path.join(DIR, 'kern.sql'), 'utf8')).slice(1).join('-');

/** Datumswerte um off Tage und den heutigen Turniertag um dm Minuten verschieben (rückwärts mit -off/-dm: werkzeuge/demo/aufteilen.js) */
function shift(db, off, dm, heute) {
  const tabs = new Set(db.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%'").all().map(r => r.name));
  const dates = () => {
    if (!off) return;
    const sh = v => v.replace(/^(\d{4})-(\d{2})-(\d{2})/, (m, y, mo, da) => new Date(Date.UTC(+y, +mo - 1, +da) + off * 864e5).toISOString().slice(0, 10));
    for (const t of tabs) for (const c of db.prepare(`pragma table_info("${t}")`).all()) {
      const rows = db.prepare(`select rowid r, "${c.name}" v from "${t}" where typeof("${c.name}")='text' and "${c.name}" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'`).all();
      for (const r of rows) db.prepare(`update "${t}" set "${c.name}"=? where rowid=?`).run(sh(r.v), r.r);
    }
  };
  // Turniertag (LK-Turniere) und das heutige Turnier im Turnierplaner zeigen den Stand „11:00 Uhr“ – laufende Spiele, Verzug
  const times = () => {
    if (!dm) return;
    const mv = v => { if (!v) return v; const d = new Date(v.slice(0, 16).replace(' ', 'T')); d.setMinutes(d.getMinutes() + dm); return `${ymd(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}${v.length > 16 ? v.slice(16) : ''}`; };
    const upd = (t, cols, where = '', ...a) => { for (const r of db.prepare(`select rowid r, ${cols.join(', ')} from ${t} ${where}`).all(...a)) db.prepare(`update ${t} set ${cols.map(c => `${c} = ?`).join(', ')} where rowid = ?`).run(...cols.map(c => mv(r[c])), r.r); };
    const ftc = ['plan_time', 'time', 'started_at', 'ended_at', 'entered_at'];
    if (tabs.has('tu_lkmatch')) { upd('tu_lkmatch', ftc); upd('tu_person', ['checked_in_at', 'paid_at']); }
    for (const f of tabs.has('tu_ft') ? db.prepare('select id, date, start from tu_ft where date = ?').all(heute) : []) {
      db.prepare('update tu_ft set start = ? where id = ?').run(mv(`${f.date} ${f.start}`).slice(11, 16), f.id);
      upd('tu_ftmatch', ftc, 'WHERE ft_id = ?', f.id);
    }
  };
  if (off >= 0) { dates(); times(); } else { times(); dates(); }   // rückwärts in umgekehrter Reihenfolge
}

/** Demo-Datenbank in file erzeugen (vorhandene Datei wird ersetzt). modules: Liste der Modul-IDs (Standard: alle mit Beispieldaten) */
function build(file, { modules } = {}) {
  const D = require('better-sqlite3');
  for (const ext of ['', '-wal', '-shm']) fs.rmSync(file + ext, { force: true });
  const db = new D(file);
  const want = modules || withData();
  db.exec('PRAGMA foreign_keys=OFF;');
  db.exec(fs.readFileSync(path.join(DIR, 'kern.sql'), 'utf8'));
  for (const id of want) if (fs.existsSync(sqlFile(id))) db.exec(fs.readFileSync(sqlFile(id), 'utf8'));
  const set = db.prepare('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)');
  for (const id of moduleIds()) set.run(`ext_${id}_active`, want.includes(id) ? '1' : '0');
  const [y, m, d] = stichtag().split('-').map(Number), n = new Date();
  const off = Math.round((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - Date.UTC(y, m - 1, d)) / 864e5);
  const dm = Math.round((n - new Date(n.getFullYear(), n.getMonth(), n.getDate(), 11, 0)) / 60000), heute = ymd(n);
  db.transaction(() => {
    shift(db, off, dm, heute);
    // „angelegt am“ (Vorgabe datetime('now')) nie in der Zukunft – die Demo wurde am Stichtag zu einer Uhrzeit aufgenommen, die heute noch kommt
    for (const { name } of db.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%'").all())
      for (const c of db.prepare(`pragma table_info("${name}")`).all().filter(x => /datetime\('now'/.test(x.dflt_value || '')))
        db.prepare(`update "${name}" set "${c.name}" = datetime('now','localtime') where "${c.name}" > datetime('now','localtime')`).run();
  })();
  set.run('demo_build', JSON.stringify({ stichtag: stichtag(), off, dm, heute }));
  return { db, off };
}
/** Verschiebung von build() zurücknehmen (werkzeuge/demo/aufteilen.js) */
function unshift(db, b) { db.transaction(() => { shift(db, -b.off, -b.dm, b.heute); db.prepare("DELETE FROM settings WHERE key = 'demo_build'").run(); })(); }

/** Darf hier eine Demo starten? Nur eine frische Installation: kein Adminkonto, keine Buchungen */
function freshDb(db) {
  try { return !db.prepare('SELECT 1 FROM admin_users LIMIT 1').get() && !db.prepare('SELECT 1 FROM bookings LIMIT 1').get(); } catch (e) { return true; }   // Tabellen fehlen = ganz neu
}
/** Läuft gerade die Demo? (Datei direkt lesen – vor dem Öffnen der eigentlichen Datenbank) */
function isDemoFile(file) {
  if (!fs.existsSync(file)) return false;
  const D = require('better-sqlite3'); let d;
  try { d = new D(file, { readonly: true, fileMustExist: true }); const r = d.prepare("SELECT value FROM settings WHERE key = 'demo_mode'").get(); return Boolean(r && r.value === '1'); }
  catch (e) { return false; } finally { if (d) d.close(); }
}

/** Beim Start VOR dem Öffnen der Datenbank: angefangene Demo einrichten bzw. beendete Demo restlos löschen. Ergebnis: Text fürs Protokoll oder null */
function applyPending(dataDir, dbFile) {
  if (fs.existsSync(ENDE(dataDir))) {
    let m = {}; try { m = JSON.parse(fs.readFileSync(ENDE(dataDir), 'utf8')); } catch (e) { m = {}; }
    fs.rmSync(ENDE(dataDir), { force: true });
    if (!isDemoFile(dbFile)) return 'Demo beenden abgelehnt: Die Datenbank ist keine Demo – nichts gelöscht.';
    for (const n of fs.readdirSync(dataDir)) if (!KEEP.has(n)) fs.rmSync(path.join(dataDir, n), { recursive: true, force: true });
    fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });   // legt backup.js nur beim Laden an
    // Wer die Demo beendet hat, richtet ohne Einrichtungscode ein (Ticket im Browser, eine Stunde gültig)
    if (/^[0-9a-f]{64}$/.test(m.ticket || '')) fs.writeFileSync(TICKET(dataDir), JSON.stringify({ hash: m.ticket, until: Date.now() + 3600000 }), { mode: 0o600 });
    return 'Demo beendet – alle Beispieldaten wurden gelöscht. Clubwerk startet wie neu installiert.';
  }
  if (!fs.existsSync(START(dataDir))) return null;
  let m = {}; try { m = JSON.parse(fs.readFileSync(START(dataDir), 'utf8')); } catch (e) { m = {}; }
  fs.rmSync(START(dataDir), { force: true });
  if (fs.existsSync(dbFile)) {
    const D = require('better-sqlite3'); const d = new D(dbFile, { readonly: true }); const ok = freshDb(d); d.close();
    if (!ok) return 'Demo abgelehnt: Clubwerk ist schon eingerichtet – nichts verändert.';
  }
  if (!m.admin || !m.tablet) return 'Demo abgelehnt: Markierung unvollständig.';
  const tmp = dbFile + '.demo';
  const { db } = build(tmp);
  seal(db, m);
  db.pragma('journal_mode = DELETE'); db.close();
  for (const ext of ['', '-wal', '-shm']) fs.rmSync(dbFile + ext, { force: true });
  fs.renameSync(tmp, dbFile);
  return 'Demo eingerichtet (erfundene Beispieldaten).';
}

/** Demo-Datenbank abschließen: zufällige Passwörter (m aus markStart), keine festen Schlüssel aus der Vorlage, Kennzeichnung als Demo */
function seal(db, m) {
  const set = db.prepare('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)');
  db.transaction(() => {
    db.prepare('UPDATE admin_users SET pw_hash = ? WHERE builtin = 1').run(m.admin.hash);
    set.run('tablet_pw_hash', m.tablet.hash); set.run('tablet_pw_ver', crypto.randomBytes(6).toString('hex'));
    set.run('tablet_gate_secret', crypto.randomBytes(32).toString('hex'));
    for (const k of ['app_url', 'update_running_version', 'ext_buchung_ics_key', 'ext_spielbetrieb_ics_key', 'demo_build']) db.prepare('DELETE FROM settings WHERE key = ?').run(k);
    db.prepare('DELETE FROM member_devices').run();   // gekoppelte Handys der Vorlage gibt es nicht
    set.run('demo_mode', '1'); set.run('demo_info', JSON.stringify({ admin: m.admin.user, password: m.admin.pw, tablet: m.tablet.pw }));
  })();
}
/** Zufällige Zugangsdaten der Demo (Hashes mit der Passwortfunktion des Kerns) */
function secrets(hash) {
  const pw = () => crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 10) + '-' + crypto.randomInt(10, 99);
  const a = pw(), t = pw();
  return { admin: { user: 'admin', pw: a, hash: hash(a) }, tablet: { pw: t, hash: hash(t) } };
}
/** Markierung für den Demo-Start (Passwörter zufällig; Hashes mit der Passwortfunktion des Kerns) */
function markStart(dataDir, hash) {
  const m = secrets(hash);
  fs.writeFileSync(START(dataDir), JSON.stringify(m), { mode: 0o600 });
  return { username: 'admin', password: m.admin.pw, tablet: m.tablet.pw };
}
/** Markierung für das Demo-Ende; liefert das Ticket für die Einrichtung ohne Code */
function markEnd(dataDir) {
  const ticket = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(ENDE(dataDir), JSON.stringify({ ticket: sha(ticket) }), { mode: 0o600 });
  return ticket;
}
/** Ticket aus dem Browser gültig? (nach dem Demo-Ende, eine Stunde) */
function ticketOk(dataDir, ticket) {
  if (!ticket) return false;
  try { const t = JSON.parse(fs.readFileSync(TICKET(dataDir), 'utf8')); return t.until > Date.now() && crypto.timingSafeEqual(Buffer.from(t.hash), Buffer.from(sha(ticket))); } catch (e) { return false; }
}
const dropTicket = dataDir => fs.rmSync(TICKET(dataDir), { force: true });

module.exports = { build, unshift, withData, seal, secrets, applyPending, markStart, markEnd, ticketOk, dropTicket, freshDb };
