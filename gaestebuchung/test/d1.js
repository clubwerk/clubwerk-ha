// Nachbildung der D1-Schnittstelle (prepare/bind/first/all/run/batch) mit node:sqlite – für Tests und lokal.js.
import { DatabaseSync } from 'node:sqlite';

export function d1(datei, schema) {
  const db = new DatabaseSync(datei);
  db.exec('PRAGMA journal_mode = WAL');
  if (schema) db.exec(schema);
  const stmt = (sql, args = []) => ({
    sql, args,
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args), success: true }),
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return {
    prepare: sql => stmt(sql),
    batch: async list => {   // D1: alle Anweisungen eines Stapels in einer Transaktion
      db.exec('BEGIN');
      try { const out = list.map(s => { const r = db.prepare(s.sql).run(...s.args); return { success: true, meta: { changes: Number(r.changes) } }; }); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    exec: async sql => db.exec(sql),
    _db: db,
  };
}
