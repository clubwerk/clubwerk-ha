'use strict';
/* IDs werden nie doppelt vergeben.
   SQLite vergibt bei „id INTEGER PRIMARY KEY“ normalerweise höchste ID + 1 – wird der zuletzt angelegte Eintrag
   gelöscht, bekäme der nächste dieselbe Nummer. Mit AUTOINCREMENT merkt sich SQLite die höchste je vergebene ID
   (Tabelle sqlite_sequence) und vergibt sie nie wieder. Diese Datei stellt alle Tabellen – auch die der Erweiterungen –
   einmalig darauf um. Vorher wird automatisch eine Sicherung angelegt. Bestehende IDs bleiben unverändert. */
const fs = require('fs');
const path = require('path');

const PK_RE = /(\bid\s+INTEGER\s+PRIMARY\s+KEY)(?!\s+AUTOINCREMENT)/i;

function tablesToConvert(db) {
  return db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL").all()
    .filter(t => PK_RE.test(t.sql));
}

/** Alle Tabellen mit „id INTEGER PRIMARY KEY“ auf AUTOINCREMENT umstellen. Gibt die Namen der umgestellten Tabellen zurück. */
function ensureAutoincrement(db, dataDir) {
  const todo = tablesToConvert(db);
  if (!todo.length) return [];
  // Sicherung vor dem Umbau (vollständige Datei, ohne -wal/-shm)
  const dir = path.join(dataDir, 'backups'); fs.mkdirSync(dir, { recursive: true });
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  const file = path.join(dir, `getraenke_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_vor-ID-Umstellung.db`);
  // frische Installation (noch nicht eingerichtet, keine Mitglieder, keine Buchungen): nichts zu sichern
  const has = (sql) => { try { return Boolean(db.prepare(sql).get()); } catch (e) { return false; } };
  const hasData = has("SELECT 1 FROM members WHERE kind IN ('mitglied', 'mannschaft') LIMIT 1") || has('SELECT 1 FROM bookings LIMIT 1') || has('SELECT 1 FROM admin_users LIMIT 1');
  if (hasData && !fs.existsSync(file)) db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);

  const fkBefore = db.pragma('foreign_key_check').length;   // alte Unstimmigkeiten zählen nicht als Fehler der Umstellung
  const fkWas = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      // Trigger vorübergehend entfernen (sie verweisen evtl. auf Tabellen, die gerade umgebaut werden) und am Ende neu anlegen
      const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND sql IS NOT NULL").all();
      for (const tr of triggers) db.exec(`DROP TRIGGER "${tr.name}"`);
      for (const t of todo) {
        const extras = db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name = ? AND type = 'index' AND sql IS NOT NULL").all(t.name).map(r => r.sql);
        const tmp = `${t.name}__neu`;
        // CREATE TABLE "name" (...) → CREATE TABLE "name__neu" (... AUTOINCREMENT ...)
        const createSql = t.sql.replace(PK_RE, '$1 AUTOINCREMENT')
          .replace(/^CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?("?)([\w]+)\2/i, `CREATE TABLE "${tmp}"`);
        const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all().map(c => `"${c.name}"`).join(', ');
        db.exec(createSql);
        db.exec(`INSERT INTO "${tmp}" (${cols}) SELECT ${cols} FROM "${t.name}"`);
        db.exec(`DROP TABLE "${t.name}"`);
        db.exec(`ALTER TABLE "${tmp}" RENAME TO "${t.name}"`);
        for (const sql of extras) db.exec(sql);
        // höchste bisher vorhandene ID als Untergrenze festschreiben
        const max = db.prepare(`SELECT COALESCE(MAX(id), 0) m FROM "${t.name}"`).get().m;
        db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(t.name);
        db.prepare('INSERT INTO sqlite_sequence(name, seq) VALUES (?, ?)').run(t.name, max);
      }
      for (const tr of triggers) db.exec(tr.sql);
      const bad = db.pragma('foreign_key_check');
      if (bad.length > fkBefore) throw new Error(`Fremdschlüssel nach der Umstellung fehlerhaft (${bad.length})`);
    })();
  } finally {
    db.pragma(`foreign_keys = ${fkWas ? 'ON' : 'OFF'}`);
  }
  console.log(`IDs: ${todo.length} ${todo.length === 1 ? 'Tabelle' : 'Tabellen'} auf „nie doppelt vergeben“ umgestellt (${todo.map(t => t.name).join(', ')}).${hasData ? ' Sicherung: ' + path.basename(file) : ''}`);
  return todo.map(t => t.name);
}

module.exports = { ensureAutoincrement, PK_RE };
