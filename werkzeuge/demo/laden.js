// Demo-Datenbank aus demo.sql erzeugen: node werkzeuge/demo/laden.js <DATA_DIR>
// Alle Datumswerte werden so verschoben, dass der Stichtag der Demo (21.10.2026) auf heute fällt – „heute“ zeigt dann immer Buchungen.
const fs = require('fs'), path = require('path');
const D = require(path.join(__dirname, '..', '..', 'clubwerk', 'node_modules', 'better-sqlite3'));
const dir = process.argv[2]; if (!dir) { console.error('Aufruf: node laden.js <DATA_DIR>'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
const db = new D(path.join(dir, 'clubwerk.db'));
db.exec(fs.readFileSync(path.join(__dirname, 'demo.sql'), 'utf8'));
const STICHTAG = Date.UTC(2026, 9, 21), heute = new Date(); const off = Math.round((Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate()) - STICHTAG) / 864e5);
if (off) {
  const shift = v => v.replace(/^(\d{4})-(\d{2})-(\d{2})/, (m, y, mo, da) => new Date(Date.UTC(+y, +mo - 1, +da) + off * 864e5).toISOString().slice(0, 10));
  const tabs = db.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%'").all().map(r => r.name);
  for (const t of tabs) for (const c of db.prepare(`pragma table_info("${t}")`).all()) {
    const rows = db.prepare(`select rowid r, "${c.name}" v from "${t}" where typeof("${c.name}")='text' and "${c.name}" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'`).all();
    for (const r of rows) db.prepare(`update "${t}" set "${c.name}"=? where rowid=?`).run(shift(r.v), r.r);
  }
}
db.close(); console.log(`Demo-Daten geladen (${off >= 0 ? '+' : ''}${off} Tage verschoben) → ${dir}`);
