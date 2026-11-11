'use strict';
/* ---------- GoBD: Änderungsjournal, Buchungen für den Steuerberater, DATEV- und Prüfer-Export (planung/gobd.md) ----------
   1. Änderungsjournal: Jede neue, geänderte oder gelöschte Zeile der Geld- und Belegtabellen landet mit Zeit, Benutzer,
      Vorher/Nachher (JSON) in gobd_journal. Das erledigen TEMP-Trigger dieser Verbindung – kein Code-Pfad kann es vergessen.
      Jede Zeile trägt den Hash ihrer Vorgängerin (Prüfkette); der Kopf der Kette wird täglich außerhalb der Datenbank
      festgehalten (gobd-anker.json), damit sich auch ein komplett neu berechnetes Journal verrät.
      Beim ersten Start (und für jede neu hinzukommende Tabelle) hält ein Startbestand (op 'S') alle vorhandenen Zeilen fest.
   2. Buchungen: Aus dem Journal entstehen Zahlungseingänge (Zufluss) je Erlösart. Jede Tabelle mit Geld hat eine Regel
      paid(row) → [{ cents, via, key, text, doc, date }]. Ändert sich das Ergebnis, wird das Alte gegengebucht und das Neue gebucht –
      so erscheinen Rücklastschriften, Stornos und „wieder offen“ als eigene Buchung, ohne dass ein Modul daran denken muss.
   Module melden ihre Tabellen über den Hook gobdTables = () => [{ table, cols?, date?, paid?, onlyIf? }] und ihre Erlösarten über
   (onlyIf: Spalte – nur Zeilen, in denen sie nicht 0/leer ist, kommen ins Journal; z. B. Flutlicht nur mit Lichtgeld, Datenschutz)
   gobdKeys = () => [{ key, label, sphere, prefix? }] (prefix: ext_key von Forderungen, die das Modul in der Mitgliederverwaltung anlegt). */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const { db, DATA_DIR, getSetting, setSetting, audit, auditDiff } = require('./db');
const plugins = require('./plugins');
const gj = require('./geschaeftsjahr');
const { today, addDays } = require('./util');

const als = new AsyncLocalStorage();
const ANCHOR_FILE = path.join(DATA_DIR, 'gobd-anker.json');
const SEP = '\x1f';
const sha = (...a) => crypto.createHash('sha256').update(a.map(x => (x == null ? '' : String(x))).join(SEP)).digest('hex');
const SPHERES = { ideell: 'Ideeller Bereich', verm: 'Vermögensverwaltung', zweck: 'Zweckbetrieb', wgb: 'Wirtschaftlicher Geschäftsbetrieb' };
const VIAS = { bar: 'Bar (Kasse)', karte: 'Karte', lastschrift: 'Lastschrift', ueberweisung: 'Überweisung', verrechnung: 'Verrechnung' };
const viaOf = v => { const s = String(v || '').toLowerCase(); return s === 'bar' ? 'bar' : s === 'karte' ? 'karte' : s === 'lastschrift' ? 'lastschrift' : s === 'verrechnet' ? 'verrechnung' : 'ueberweisung'; };
const day = ts => String(ts || '').slice(0, 10);

db.exec(`
CREATE TABLE IF NOT EXISTS gobd_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, who TEXT, tbl TEXT NOT NULL, op TEXT NOT NULL,   -- op: S Startbestand | I neu | U geändert | D gelöscht
  row_id INTEGER, old TEXT, new TEXT, prev TEXT, hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_gobd_row ON gobd_journal(tbl, row_id);
CREATE INDEX IF NOT EXISTS ix_gobd_at ON gobd_journal(at);
CREATE TABLE IF NOT EXISTS gobd_export (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, from_date TEXT, to_date TEXT, count INTEGER, cents INTEGER, sha256 TEXT,
  head_id INTEGER, head_hash TEXT, by_user TEXT, at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);`);

/* Wer hat geändert? Die Anfrage merkt sich das in als (Middleware in server.js/memberapp.js); ohne Anfrage war es Clubwerk selbst. */
function who() {
  const s = als.getStore(), req = s && s.req;
  if (!req) return 'Clubwerk';
  if (req.user && req.user.username) return String(req.user.username).slice(0, 60);
  if (s.app) return req.member && req.member.id ? `App (Konto ${req.member.id})` : 'App';
  return /^\/api\/tablet/.test(req.originalUrl || req.url || '') ? 'Tablet' : 'Clubwerk';
}
db.function('cw_gobd_who', { deterministic: false }, who);
db.function('cw_gobd_hash', { deterministic: true, varargs: true }, (...a) => sha(...a));
const middleware = (req, res, next) => als.run({ req }, () => next());
const appMiddleware = (req, res, next) => als.run({ req, app: true }, () => next());

/* ---------- Tabellen ---------- */
/* Verkauf: bar oder mit Karte bezahlt ist, was die Abrechnung der Veranstaltung bzw. des Deckels als Kasse zählt (server.js) */
function verkaufPaid(r) {
  if (r.cancelled_at || !r.total_cents) return null;
  if (r.tab_id) { const t = r.paid_cash ? db.prepare('SELECT method, closed_at FROM guest_tabs WHERE id = ?').get(r.tab_id) : null; return t ? { via: viaOf(t.method), date: t.closed_at } : null; }
  if (r.event_guest_id) { const p = r.payment_id ? db.prepare('SELECT method, at FROM event_payments WHERE id = ?').get(r.payment_id) : null; return p ? { via: viaOf(p.method), date: p.at } : null; }
  return r.kind === 'gast' || (r.kind === 'event' && r.paid_cash) ? { via: 'bar', date: r.created_at } : null;
}
const catOf = r => { if (r.article_category) return r.article_category; const a = db.prepare('SELECT category FROM articles WHERE id = ?').get(r.article_id); return (a && a.category) || 'Sonstiges'; };
const CORE_TABLES = [
  { table: 'articles', date: null },
  { table: 'bookings', date: 'created_at', paid: r => { const p = verkaufPaid(r); return p ? [{ ...p, cents: r.total_cents, key: `verkauf.${catOf(r)}`, text: `${r.qty} × ${r.article_name || (db.prepare('SELECT name FROM articles WHERE id = ?').get(r.article_id) || {}).name || 'Artikel'}`, doc: `V-${r.id}` }] : []; } },
  { table: 'guest_tabs', date: 'created_at' },
  { table: 'events', date: 'date' },
  { table: 'event_guests', date: null },
  { table: 'event_payments', date: null },
  { table: 'deliveries', date: 'date' },
  { table: 'delivery_items', date: null },
  { table: 'stock_moves', date: 'date' },
  { table: 'settlements', date: 'until_date' },
  { table: 'member_settlements', date: 'created_at' },
  { table: 'members', cols: ['id', 'name', 'first_name', 'last_name', 'kind', 'active', 'deleted'], date: null },
];
const exists = t => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));
const colsOf = t => db.prepare(`PRAGMA table_info("${t.replace(/"/g, '""')}")`).all().map(c => c.name);
/** Alle Tabellen mit Geld oder Belegen: Kern + aktive Module */
function tables() {
  const out = [...CORE_TABLES];
  for (const p of plugins.withHook('gobdTables')) {
    try { for (const t of p.hooks.gobdTables() || []) if (t && /^[a-z_][a-z0-9_]*$/.test(t.table)) out.push({ ...t, module: p.meta.id }); }
    catch (e) { console.error(`Hook gobdTables (${p.meta.id}):`, e.message); }
  }
  // Spalten, die der Tresor verschlüsselt (Anschriften, Empfänger, Spender …), kommen nie ins Journal – sonst stünde dort Klartext
  const vault = require('./vault').SPEC;
  return out.filter(t => exists(t.table)).map(t => {
    const all = colsOf(t.table), enc = new Set((vault.find(v => v.t === t.table) || { c: [] }).c);
    return { ...t, cols: (t.cols || all).filter(c => all.includes(c) && !enc.has(c) && /^[a-z_][a-z0-9_]*$/.test(c)), pk: all.includes('id') ? 'id' : 'rowid',
      onlyIf: t.onlyIf && all.includes(t.onlyIf) && /^[a-z_][a-z0-9_]*$/.test(t.onlyIf) ? t.onlyIf : null };
  });
}
const tableByName = () => new Map(tables().map(t => [t.table, t]));

/* ---------- Trigger (je Start neu, als TEMP – sie gehören nur zu dieser Verbindung) ---------- */
const HEAD = '(SELECT hash FROM main.gobd_journal ORDER BY id DESC LIMIT 1)';
function triggerSql(t) {
  const q = c => `"${c}"`, obj = R => `json_object(${t.cols.map(c => `'${c}', ${R}.${q(c)}`).join(', ')})`;
  const ins = (op, rowId, oldJ, newJ) => `INSERT INTO main.gobd_journal(at, who, tbl, op, row_id, old, new, prev, hash) VALUES (datetime('now','localtime'), cw_gobd_who(), '${t.table}', '${op}', ${rowId}, ${oldJ}, ${newJ}, ${HEAD},
    cw_gobd_hash(${HEAD}, datetime('now','localtime'), cw_gobd_who(), '${t.table}', '${op}', ${rowId}, ${oldJ}, ${newJ}));`;
  const changed = t.cols.map(c => `OLD.${q(c)} IS NOT NEW.${q(c)}`).join(' OR ');
  const has = (...R) => `(${R.map(r => `COALESCE(${r}.${q(t.onlyIf)}, 0) != 0`).join(' OR ')})`;   // nur mit onlyIf
  const n = `gobd_${t.table}`;
  return [
    `DROP TRIGGER IF EXISTS temp.${n}_i`, `DROP TRIGGER IF EXISTS temp.${n}_u`, `DROP TRIGGER IF EXISTS temp.${n}_d`,
    `CREATE TEMP TRIGGER ${n}_i AFTER INSERT ON main."${t.table}"${t.onlyIf ? ` WHEN ${has('NEW')}` : ''} BEGIN ${ins('I', `NEW.${t.pk}`, 'NULL', obj('NEW'))} END`,
    `CREATE TEMP TRIGGER ${n}_u AFTER UPDATE ON main."${t.table}" WHEN (${changed})${t.onlyIf ? ` AND ${has('OLD', 'NEW')}` : ''} BEGIN ${ins('U', `NEW.${t.pk}`, obj('OLD'), obj('NEW'))} END`,
    `CREATE TEMP TRIGGER ${n}_d AFTER DELETE ON main."${t.table}"${t.onlyIf ? ` WHEN ${has('OLD')}` : ''} BEGIN ${ins('D', `OLD.${t.pk}`, obj('OLD'), 'NULL')} END`,
  ];
}
const lastRow = () => db.prepare('SELECT id, hash FROM gobd_journal ORDER BY id DESC LIMIT 1').get() || null;
/** Startbestand einer Tabelle: alle vorhandenen Zeilen einmal festhalten (ohne Trigger, Kette in JS) */
function seed(t) {
  const sel = db.prepare(`SELECT ${t.pk} AS _rid, json_object(${t.cols.map(c => `'${c}', "${c}"`).join(', ')}) AS j FROM "${t.table}" WHERE ${t.pk} > ?${t.onlyIf ? ` AND COALESCE("${t.onlyIf}", 0) != 0` : ''} ORDER BY ${t.pk} LIMIT 2000`);
  const ins = db.prepare('INSERT INTO gobd_journal(at, who, tbl, op, row_id, old, new, prev, hash) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)');
  const at = db.prepare("SELECT datetime('now','localtime') t").get().t;
  let prev = (lastRow() || {}).hash || null, from = -Infinity, n = 0;
  for (;;) {
    const rows = sel.all(from === -Infinity ? -9e15 : from);
    if (!rows.length) break;
    for (const r of rows) { const h = sha(prev, at, 'Clubwerk', t.table, 'S', r._rid, null, r.j); ins.run(at, 'Clubwerk', t.table, 'S', r._rid, r.j, prev, h); prev = h; n++; }
    from = rows[rows.length - 1]._rid;
  }
  return n;
}
let installed = [];
/** Nach dem Laden der Module: Startbestand für neue Tabellen, Trigger für alle */
function install() {
  if (process.env.CW_DEMO_KOPIE === '1') return installed;   // Demo-Kopie (src/demokopie.js): Wegwerf-Sandkasten, wird restlos gelöscht – kein Journal, spart Speicher
  const list = tables();
  let known = [];
  try { known = JSON.parse(getSetting('gobd_tables', '[]')); } catch (e) { known = []; }
  db.transaction(() => {
    for (const t of list) if (!known.includes(t.table)) { seed(t); known.push(t.table); }
    setSetting('gobd_tables', JSON.stringify(known));
  })();
  for (const t of list) for (const s of triggerSql(t)) db.exec(s);
  installed = list.map(t => t.table);
  return installed;
}
/** Nach dem Ein- oder Ausschalten eines Moduls: Tabellen neu einsammeln (Startbestand für neue, Trigger für alle). Läuft zur Sicherheit auch jede Minute. */
function ensure() {
  if (process.env.CW_DEMO_KOPIE === '1') return;
  try { const now = tables().map(t => t.table); if (now.length !== installed.length || now.some(t => !installed.includes(t))) install(); }
  catch (e) { console.error('GoBD: Änderungsjournal –', e.message); }
}
setInterval(ensure, 60000).unref();

/* ---------- Prüfkette ---------- */
function anchors() { try { const a = JSON.parse(fs.readFileSync(ANCHOR_FILE, 'utf8')); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
/** Kopf der Kette außerhalb der Datenbank festhalten (täglich und bei jedem Export) */
function anchor() {
  const h = lastRow(); if (!h) return null;
  const list = anchors();
  if (list.length && list[list.length - 1].id === h.id) return h;
  list.push({ id: h.id, hash: h.hash, at: new Date().toISOString() });
  try { fs.writeFileSync(ANCHOR_FILE + '.neu', JSON.stringify(list.slice(-4000))); fs.renameSync(ANCHOR_FILE + '.neu', ANCHOR_FILE); } catch (e) { console.error('GoBD-Anker:', e.message); }
  return h;
}
/*
 * Geprüfter Stand (Entscheidung 10.11.2026, planung/n-plus-1.md): Die Prüfung rechnet nur ab dem zuletzt geprüften Eintrag nach –
 * die volle Kette wuchs mit jedem Jahr. Der Stand (ID + Hash) liegt AUSSERHALB der Datenbank (gobd-geprueft.json neben den Ankern):
 * eine zurückgespielte oder untergeschobene Datenbank bringt ihn nicht mit. Ganz nachgerechnet wird
 *   – einmal pro Woche (die nächste Prüfung nach 7 Tagen ist automatisch voll; die Datenqualität läuft täglich),
 *   – nach jeder Wiederherstellung und Übernahme aus einer Sicherung (Stand gelöscht: src/backup.js, src/teilsicherung.js),
 *   – solange ein Bruch besteht (Stand gelöscht),
 *   – mit „Ganze Prüfkette prüfen“ (Einstellungen › Buchführung),
 *   – sofort, wenn der gespeicherte Eintrag nicht mehr stimmt: Dann ist das Ergebnis rot (der Eintrag wird als Anker festgehalten,
 *     die volle Prüfung meldet ihn dauerhaft) und es gibt eine Sicherheitswarnung.
 */
const CHECKED_FILE = path.join(DATA_DIR, 'gobd-geprueft.json');
const FULL_DAYS = 7;
function checkedState() {
  try { const c = JSON.parse(fs.readFileSync(CHECKED_FILE, 'utf8')); return c && Number.isInteger(c.id) && typeof c.hash === 'string' ? c : null; } catch (e) { return null; }
}
function saveChecked(c) {
  try {
    if (!c) { fs.rmSync(CHECKED_FILE, { force: true }); return; }
    fs.writeFileSync(CHECKED_FILE + '.neu', JSON.stringify(c)); fs.renameSync(CHECKED_FILE + '.neu', CHECKED_FILE);
  } catch (e) { console.error('GoBD-Prüfstand:', e.message); }
}
/** nach einer Wiederherstellung oder Übernahme: nächste Prüfung ganz */
const resetChecked = () => saveChecked(null);
/** einen Eintrag dauerhaft als Anker festhalten (z. B. den geprüften Stand, der nicht mehr stimmt) */
function keepAnchor(a) {
  const list = anchors(); if (list.some(x => x.id === a.id && x.hash === a.hash)) return;
  list.push({ id: a.id, hash: a.hash, at: new Date().toISOString() }); list.sort((x, y) => x.id - y.id);
  try { fs.writeFileSync(ANCHOR_FILE + '.neu', JSON.stringify(list.slice(-4000))); fs.renameSync(ANCHOR_FILE + '.neu', ANCHOR_FILE); } catch (e) { console.error('GoBD-Anker:', e.message); }
}
/**
 * Kette nachrechnen: jede Zeile muss den Hash ihrer Vorgängerin tragen und ihr eigener Hash muss stimmen.
 * full: ganze Kette; sonst ab dem geprüften Stand (siehe oben), wenn es einen gibt und die letzte volle Prüfung keine Woche her ist.
 * → { ok, count (nachgerechnete Einträge), first, head, bad, anchors, beyond, full, fullAt }
 */
function verify({ full = false } = {}) {
  const sel = db.prepare('SELECT * FROM gobd_journal WHERE id > ? ORDER BY id LIMIT 5000');
  let start = null;
  try { start = JSON.parse(getSetting('gobd_start', 'null')); } catch (e) { start = null; }
  const first = db.prepare('SELECT id, prev, at FROM gobd_journal ORDER BY id LIMIT 1').get() || null;
  let st = checkedState(), from = null, moved = null;
  if (st && first && st.id < first.id) st = null;   // vom Löschlauf nach Ablauf der Frist entfernt: einfach ganz prüfen
  if (st) {
    const r = db.prepare('SELECT hash FROM gobd_journal WHERE id = ?').get(st.id);
    if (!r || r.hash !== st.hash) moved = st;   // geprüfter Eintrag verändert oder verschwunden
    else if (!full && st.full_at && Date.parse(st.full_at) <= Date.now() && Date.now() - Date.parse(st.full_at) < FULL_DAYS * 86400000) from = st;   // Zeit in der Zukunft (gefälschte Datei) zählt nicht: ganz prüfen
  }
  if (moved) keepAnchor(moved);   // ab jetzt meldet ihn auch jede volle Prüfung
  let last = from ? from.id : -1, prevHash = from ? from.hash : first && first.prev, count = 0, bad = null;
  if (first && start && start.id === first.id && start.prev !== first.prev) bad = { id: first.id, why: 'Der Anfang des Journals passt nicht zum letzten Löschlauf.' };
  if (moved && !bad) bad = { id: moved.id, why: 'Ein schon geprüfter Eintrag hat sich verändert – das Journal wurde neu geschrieben.' };
  for (;;) {
    const rows = sel.all(last);
    if (!rows.length) break;
    for (const r of rows) {
      if (r.prev !== prevHash && !bad) bad = { id: r.id, why: 'Die Verkettung ist unterbrochen – hier fehlt ein Eintrag oder wurde eingefügt.' };
      if (sha(r.prev, r.at, r.who, r.tbl, r.op, r.row_id, r.old, r.new) !== r.hash && !bad) bad = { id: r.id, why: 'Der Eintrag wurde nachträglich verändert.' };
      prevHash = r.hash; last = r.id; count++;
    }
  }
  if (start && first && start.id < first.id && !bad) bad = { id: first.id, why: 'Am Anfang des Journals fehlen Einträge.' };
  // Anker: Hashes, die wir früher notiert haben, müssen noch stimmen. Liegt ein Anker hinter dem Ende, wurde eine ältere Sicherung zurückgespielt.
  const an = anchors(); let matched = 0, beyond = 0;
  const get = db.prepare('SELECT hash FROM gobd_journal WHERE id = ?');
  for (const a of an) {
    if (a.id > last) { beyond++; continue; }
    if (first && a.id < first.id) continue;   // vom Löschlauf nach Ablauf der Frist entfernt
    const r = get.get(a.id);
    if (!r || r.hash !== a.hash) { if (!bad) bad = { id: a.id, why: 'Ein früher notierter Prüfwert stimmt nicht mehr – das Journal wurde neu geschrieben.' }; } else matched++;
  }
  const now = new Date().toISOString(), isFull = !from;
  if (bad) {
    saveChecked(null);   // bis zur Klärung jedes Mal ganz prüfen – der Bruch bleibt sichtbar
    try { require('./security').securityAlert('gobd', `Das Änderungsjournal (GoBD) ist unterbrochen – Eintrag ${bad.id}: ${bad.why} Bitte unter Einstellungen › Buchführung ansehen und keine Sicherung überschreiben.`, { key: bad.id }); }
    catch (e) { console.error('GoBD-Warnung:', e.message); }
  } else if (last > 0) saveChecked({ id: last, hash: prevHash, at: now, full_at: isFull ? now : from.full_at });
  return { ok: !bad, count, first: first ? first.at : null, head: last > 0 ? { id: last, hash: prevHash } : null, bad, anchors: matched, beyond, full: isFull,
    fullAt: bad ? null : isFull ? now : from.full_at };
}

/* ---------- Erlösarten, Konten, Sphären ---------- */
const CFG_DEF = { berater: '', mandant: '', wj_month: 1, length: 4, skr: '', gegen: {}, konten: {} };
function cfg() {
  let c = {}; try { c = JSON.parse(getSetting('gobd_cfg', '{}')) || {}; } catch (e) { c = {}; }
  return { ...CFG_DEF, ...c, wj_month: gj.month(), gegen: { ...(c.gegen || {}) }, konten: { ...(c.konten || {}) } };   // Wirtschaftsjahr = Geschäftsjahr des Kerns
}
/** Alle Erlösarten: Verkauf je Artikelkategorie + Module */
function keys() {
  const out = [];
  const cats = db.prepare("SELECT DISTINCT category c FROM articles WHERE category IS NOT NULL AND category != '' ORDER BY category").all().map(r => r.c);
  if (plugins.isActive('getraenke')) for (const c of cats.length ? cats : ['Sonstiges']) out.push({ key: `verkauf.${c}`, label: `Verkauf bar/Karte: ${c}`, sphere: 'wgb', module: 'Verkauf' });
  for (const p of plugins.withHook('gobdKeys')) {
    try { for (const k of p.hooks.gobdKeys() || []) if (k && k.key) out.push({ key: String(k.key).slice(0, 80), label: String(k.label || k.key).slice(0, 120), sphere: SPHERES[k.sphere] ? k.sphere : '', prefix: k.prefix || null, module: p.meta.name }); }
    catch (e) { console.error(`Hook gobdKeys (${p.meta.id}):`, e.message); }
  }
  const c = cfg();
  return out.map(k => ({ ...k, konto: (c.konten[k.key] || {}).konto || '', sphere: (c.konten[k.key] || {}).sphere || k.sphere }));
}
/** Erlösart für eine Forderung eines anderen Moduls (ext_key-Präfix), für die Mitgliederverwaltung */
function keyForExt(ext) {
  if (!ext) return null;
  const k = keys().filter(x => x.prefix && String(ext).startsWith(x.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return k ? k.key : null;
}

/* ---------- Buchungen aus dem Journal ---------- */
const J = s => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const norm = (list, at) => (Array.isArray(list) ? list : []).filter(p => p && Number.isFinite(p.cents) && p.cents).map(p => ({
  cents: Math.round(p.cents), via: VIAS[p.via] ? p.via : 'ueberweisung', key: String(p.key || 'ohne'), text: String(p.text || '').slice(0, 120), doc: String(p.doc || '').slice(0, 36), date: day(p.date) || day(at), name: p.name ? String(p.name).slice(0, 80) : '' }));
const money = l => JSON.stringify(l.map(p => [p.cents, p.via, p.key, p.date]));
const same = (a, b) => money(a) === money(b);   // nur Betrag, Zahlweg, Erlösart und Datum zählen – ein geänderter Text bucht nichts um
/** Zahlungseingänge im Zeitraum [from, to] (JJJJ-MM-TT), Stornos und Rücknahmen als Gegenbuchung */
function postings(from, to) {
  const rules = tables().filter(t => typeof t.paid === 'function');
  if (!rules.length) return [];
  const byT = new Map(rules.map(t => [t.table, t]));
  const lower = addDays(from, -400);
  const sel = db.prepare(`SELECT id, at, tbl, op, row_id, old, new FROM gobd_journal WHERE tbl IN (${rules.map(() => '?').join(',')}) AND (op = 'S' OR at >= ?) AND id > ? ORDER BY id LIMIT 5000`);
  const out = []; let last = -1;
  const run = (t, row, at) => { try { return norm(row ? t.paid(row) : [], at); } catch (e) { return []; } };
  for (;;) {
    const rows = sel.all(...rules.map(t => t.table), lower, last);
    if (!rows.length) break;
    for (const j of rows) {
      last = j.id;
      const t = byT.get(j.tbl), a = run(t, J(j.old), j.at), b = run(t, J(j.new), j.at);
      if (same(a, b)) continue;
      for (const p of a) out.push({ ...p, cents: -p.cents, date: day(j.at), text: `Rücknahme: ${p.text}`.slice(0, 120), ref: `${j.tbl}:${j.row_id}`, jid: j.id });
      for (const p of b) out.push({ ...p, ref: `${j.tbl}:${j.row_id}`, jid: j.id });
    }
  }
  return out.filter(p => p.date >= from && p.date <= to).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.jid - y.jid));
}
/** Summen je Erlösart und je Sphäre */
function summary(list) {
  const ks = new Map(keys().map(k => [k.key, k]));
  const byKey = new Map(), bySphere = Object.fromEntries([...Object.keys(SPHERES), ''].map(s => [s, 0]));
  for (const p of list) {
    const k = ks.get(p.key) || { key: p.key, label: p.key, sphere: '' };
    const e = byKey.get(p.key) || { key: p.key, label: k.label, sphere: k.sphere, konto: k.konto || '', count: 0, cents: 0 };
    e.count++; e.cents += p.cents; byKey.set(p.key, e); bySphere[k.sphere || ''] += p.cents;
  }
  return { keys: [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'de')), spheres: bySphere, total: list.reduce((s, p) => s + p.cents, 0), count: list.length };
}

/* ---------- DATEV-Buchungsstapel (EXTF 700, Kategorie 21) ---------- */
const q = s => `"${String(s == null ? '' : s).replace(/"/g, '""').replace(/[\r\n;]+/g, ' ')}"`;
const eur = c => (Math.abs(c) / 100).toFixed(2).replace('.', ',');
const ymd = d => d.replace(/-/g, '');
/** Fehlende Angaben für einen Export (leer = alles da) */
function missing(list) {
  const c = cfg(), ks = new Map(keys().map(k => [k.key, k])), out = [];
  const ok = n => new RegExp(`^\\d{${c.length}}$`).test(String(n || ''));
  if (!/^\d{4,7}$/.test(c.berater)) out.push('Beraternummer (4 bis 7 Ziffern)');
  if (!/^\d{1,5}$/.test(c.mandant)) out.push('Mandantennummer (1 bis 5 Ziffern)');
  for (const v of new Set(list.map(p => p.via))) if (!ok(c.gegen[v])) out.push(`Geldkonto für „${VIAS[v]}“`);
  for (const k of new Set(list.map(p => p.key))) if (!ok((ks.get(k) || {}).konto)) out.push(`Konto für „${(ks.get(k) || { label: k }).label}“`);
  return out;
}
const wjStart = from => gj.startOf(from);
function datev(from, to, user) {
  const c = cfg(), list = postings(from, to), ks = new Map(keys().map(k => [k.key, k]));
  const now = new Date(), stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
  const head = ['"EXTF"', 700, 21, '"Buchungsstapel"', 13, stamp, '', '"CW"', q(String(user || '').slice(0, 25)), '""', c.berater, c.mandant, ymd(wjStart(from)), c.length, ymd(from), ymd(to),
    q(`Clubwerk ${from.slice(0, 7)}`), '""', 1, 0, 0, '"EUR"', '', '""', '', '', q(String(c.skr || '').replace(/\D/g, '').slice(0, 2)), '', '', '""', '""'].join(';');
  const cols = ['Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz', 'Kurs', 'Basis-Umsatz', 'WKZ Basis-Umsatz', 'Konto', 'Gegenkonto (ohne BU-Schlüssel)', 'BU-Schlüssel', 'Belegdatum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto', 'Buchungstext'].join(';');
  const lines = list.map(p => [eur(p.cents), p.cents >= 0 ? '"S"' : '"H"', '"EUR"', '', '', '', c.gegen[p.via], (ks.get(p.key) || {}).konto, '""',
    p.date.slice(8, 10) + p.date.slice(5, 7), q(p.doc.replace(/[^A-Za-z0-9$&%*+\-/]/g, '').slice(0, 36)), '""', '', q([p.text, p.name].filter(Boolean).join(' – ').slice(0, 60))].join(';'));
  const text = [head, cols, ...lines].join('\r\n') + '\r\n';
  const buf = require('iconv-lite').encode(text, 'win1252');   // erst hier laden – spart beim Start Speicher
  record('datev', from, to, list, buf, user);
  return { buf, count: list.length };
}
function record(kind, from, to, list, buf, user) {
  const h = anchor() || {};
  db.prepare('INSERT INTO gobd_export(kind, from_date, to_date, count, cents, sha256, head_id, head_hash, by_user) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(kind, from, to, list.length, list.reduce((s, p) => s + p.cents, 0), crypto.createHash('sha256').update(buf).digest('hex'), h.id || null, h.hash || null, user || null);
}
/** Frühere Exporte; geändert = derselbe Zeitraum ergibt heute eine andere Summe (nachträglich erfasst oder storniert) */
function exportsList() {
  return db.prepare('SELECT * FROM gobd_export ORDER BY id DESC LIMIT 30').all().map(e => {
    let changed = false;
    if (e.kind === 'datev') { const l = postings(e.from_date, e.to_date); changed = l.length !== e.count || l.reduce((s, p) => s + p.cents, 0) !== e.cents; }
    return { id: e.id, kind: e.kind, from: e.from_date, to: e.to_date, count: e.count, cents: e.cents, at: e.at, by: e.by_user, changed };
  });
}

/* ---------- Prüfer-Export im Beschreibungsstandard (index.xml + CSV, Datenträgerüberlassung Z3) ---------- */
const xml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const csvCell = v => (v == null ? '' : typeof v === 'number' ? String(v) : `"${String(v).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`);
const deDate = d => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
async function pruefer(year, user, club) {
  const { from, to } = gj.range(year), upto = `${to} 23:59:59`, yl = gj.label(year);   // Geschäftsjahr (bei Beginn Januar = Kalenderjahr)
  const JSZip = require('jszip'), zip = new JSZip(), tabs = [];
  const add = (file, name, desc, colsDef, rows) => {
    zip.file(file, '﻿' + [colsDef.map(c => c.name).join(';'), ...rows.map(r => colsDef.map(c => csvCell(r[c.name])).join(';'))].join('\r\n') + '\r\n');
    tabs.push({ file, name, desc, cols: colsDef, count: rows.length });
  };
  // Je Tabelle: Zeilen mit Datum im Jahr oder mit Änderungen im Jahr, Stammdaten ganz (Stand heute, nur die Spalten des Journals)
  for (const t of tables()) {
    const ids = new Set(db.prepare("SELECT DISTINCT row_id r FROM gobd_journal WHERE tbl = ? AND op != 'S' AND at BETWEEN ? AND ?").all(t.table, from, upto).map(r => r.r));
    const types = new Map(db.prepare(`PRAGMA table_info("${t.table}")`).all().map(c => [c.name, String(c.type).toUpperCase()]));
    const cond = t.date ? `substr("${t.date}", 1, 10) BETWEEN ? AND ?` : '1';   // Stammdaten (Artikel, Konten, Beitragsarten …) ganz
    const rows = db.prepare(`SELECT ${t.pk} AS _rid, ${t.cols.map(c => `"${c}"`).join(', ')} FROM "${t.table}" WHERE ${cond} ORDER BY ${t.pk}`).all(...(t.date ? [from, to] : []));
    const have = new Set(rows.map(r => r._rid));
    const extra = [...ids].filter(id => !have.has(id));
    for (let i = 0; i < extra.length; i += 500) {
      const part = extra.slice(i, i + 500);
      rows.push(...db.prepare(`SELECT ${t.pk} AS _rid, ${t.cols.map(c => `"${c}"`).join(', ')} FROM "${t.table}" WHERE ${t.pk} IN (${part.map(() => '?').join(',')})`).all(...part));
    }
    if (!rows.length) continue;
    add(`${t.table}.csv`, t.table, `Tabelle ${t.table} (Stand ${deDate(today())})`, t.cols.map(c => ({ name: c, num: /INT|REAL|NUM/.test(types.get(c) || '') })), rows);
  }
  const jr = db.prepare('SELECT id, at, who, tbl, op, row_id, old, new, prev, hash FROM gobd_journal WHERE at BETWEEN ? AND ? ORDER BY id').all(from, upto);
  add('aenderungsjournal.csv', 'aenderungsjournal', 'Änderungsjournal: jede neue, geänderte oder gelöschte Zeile mit Vorher/Nachher (JSON) und Prüfkette (SHA-256)',
    ['id', 'at', 'who', 'tbl', 'op', 'row_id', 'old', 'new', 'prev', 'hash'].map(n => ({ name: n, num: n === 'id' || n === 'row_id' })), jr);
  const list = postings(from, to), ks = new Map(keys().map(k => [k.key, k]));
  add('zahlungseingaenge.csv', 'zahlungseingaenge', 'Zahlungseingänge je Erlösart und Sphäre (Grundlage des DATEV-Buchungsstapels)',
    [{ name: 'datum' }, { name: 'betrag', dec: true }, { name: 'zahlweg' }, { name: 'erloesart' }, { name: 'sphaere' }, { name: 'beleg' }, { name: 'text' }, { name: 'name' }, { name: 'herkunft' }],
    list.map(p => ({ datum: deDate(p.date), betrag: (p.cents / 100).toFixed(2).replace('.', ','), zahlweg: VIAS[p.via], erloesart: (ks.get(p.key) || { label: p.key }).label, sphaere: SPHERES[(ks.get(p.key) || {}).sphere] || '', beleg: p.doc, text: p.text, name: p.name, herkunft: p.ref })));
  const ixml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE DataSet SYSTEM "gdpdu-01-09-2004.dtd">\n<DataSet>\n  <Version>1.0</Version>\n  <DataSupplier>\n    <Name>${xml(club || 'Verein')}</Name>\n    <Location></Location>\n    <Comment>Clubwerk – Datenüberlassung ${yl}</Comment>\n  </DataSupplier>\n  <Media>\n    <Name>Clubwerk ${year}</Name>\n` +
    tabs.map(t => `    <Table>\n      <URL>${xml(t.file)}</URL>\n      <Name>${xml(t.name)}</Name>\n      <Description>${xml(t.desc)}</Description>\n      <Validity>\n        <Range>\n          <From>${deDate(from)}</From>\n          <To>${deDate(to)}</To>\n        </Range>\n        <Format>DD.MM.YYYY</Format>\n      </Validity>\n      <UTF8/>\n      <DecimalSymbol>,</DecimalSymbol>\n      <DigitGroupingSymbol>.</DigitGroupingSymbol>\n      <SkipNumBytes>3</SkipNumBytes>\n      <VariableLength>\n        <ColumnDelimiter>;</ColumnDelimiter>\n        <RecordDelimiter>&#13;&#10;</RecordDelimiter>\n        <TextEncapsulator>"</TextEncapsulator>\n` +
      t.cols.map(c => `        <VariableColumn>\n          <Name>${xml(c.name)}</Name>\n          ${c.dec ? '<Numeric>\n            <Accuracy>2</Accuracy>\n          </Numeric>' : c.num ? '<Numeric/>' : '<AlphaNumeric/>'}\n        </VariableColumn>\n`).join('') +
      '      </VariableLength>\n    </Table>\n').join('') + '  </Media>\n</DataSet>\n';
  zip.file('index.xml', ixml);
  const v = verify();
  zip.file('LIESMICH.txt', [`Clubwerk – Datenüberlassung für das Geschäftsjahr ${yl} (${deDate(from)} bis ${deDate(to)})`, `Erstellt: ${new Date().toISOString()} von ${user || ''}`, '',
    'index.xml beschreibt alle Dateien im Beschreibungsstandard für die Datenüberlassung (Z3). Die Dateien sind UTF-8 mit BOM (SkipNumBytes 3).',
    'Beträge in Spalten mit „cents“ sind Cent-Beträge, in zahlungseingaenge.csv Euro mit Komma.',
    'aenderungsjournal.csv enthält jede Änderung mit Vorher/Nachher; jede Zeile trägt den SHA-256 ihrer Vorgängerin (Prüfkette).',
    `Prüfkette beim Export: ${v.ok ? 'intakt' : 'UNTERBROCHEN (' + v.bad.why + ')'} · ${v.count} Einträge · Kopf ${v.head ? v.head.id + ' / ' + v.head.hash : '–'}`].join('\r\n') + '\r\n');
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  record('pruefer', from, to, list, buf, user);
  return buf;
}

/* ---------- Löschfrist: erst nach Ablauf der Aufbewahrung (Hook retention des Kerns, datenschutz.js) ---------- */
function purge(cut) {
  const n = db.prepare('SELECT COUNT(*) n FROM gobd_journal WHERE at < ?').get(cut).n;
  if (!n) return 0;
  db.transaction(() => {
    db.prepare('DELETE FROM gobd_journal WHERE at < ?').run(cut);
    const f = db.prepare('SELECT id, prev FROM gobd_journal ORDER BY id LIMIT 1').get();
    setSetting('gobd_start', JSON.stringify(f ? { id: f.id, prev: f.prev } : null));
  })();
  return n;
}
const retention = () => ({ id: 'gobd', label: 'Änderungsjournal (GoBD)', text: 'Jede Änderung an Geld und Belegen, auch nach dem Anonymisieren. Gesetzliche Aufbewahrung: mindestens 10 Jahre.', unit: 'monate', def: 132, min: 120, max: 240,
  due: cut => db.prepare('SELECT COUNT(*) n FROM gobd_journal WHERE at < ?').get(cut).n, purge });

/* ---------- Verwaltung: Einstellungen › Buchführung ---------- */
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
function routes(admin, { need, bad, asyncRoute }) {
  const P = need('einstellungen'), PX = need('einstellungen', 'export');
  const info = () => { const r = db.prepare('SELECT COUNT(*) n, MIN(at) first FROM gobd_journal').get(); return { count: r.n, first: r.first, tables: installed.length }; };
  admin.get('/gobd', P, (req, res) => res.json({ cfg: cfg(), keys: keys(), vias: VIAS, spheres: SPHERES, journal: info(), exports: exportsList() }));
  admin.put('/gobd', P, (req, res) => {
    const b = req.body || {}, before = cfg(), c = cfg();
    const digits = (v, n) => String(v == null ? '' : v).replace(/\D/g, '').slice(0, n);
    if (b.berater !== undefined) c.berater = digits(b.berater, 7);
    if (b.mandant !== undefined) c.mandant = digits(b.mandant, 5);
    if (b.wj_month !== undefined) c.wj_month = Math.min(12, Math.max(1, parseInt(b.wj_month, 10) || 1));   // gespeichert als Geschäftsjahr (unten)
    if (b.length !== undefined) c.length = Math.min(8, Math.max(4, parseInt(b.length, 10) || 4));
    if (b.skr !== undefined) c.skr = String(b.skr || '').slice(0, 20);
    if (b.gegen && typeof b.gegen === 'object') for (const v of Object.keys(VIAS)) if (b.gegen[v] !== undefined) c.gegen[v] = digits(b.gegen[v], 8);
    if (b.konten && typeof b.konten === 'object') {
      const valid = new Set(keys().map(k => k.key));
      for (const [k, v] of Object.entries(b.konten)) if (valid.has(k) && v && typeof v === 'object') c.konten[k] = { konto: digits(v.konto, 8), sphere: SPHERES[v.sphere] ? v.sphere : '' };
    }
    const bad8 = [...Object.values(c.gegen), ...Object.values(c.konten).map(x => x.konto)].filter(x => x && x.length !== c.length);
    if (bad8.length) return bad(res, `Kontonummern müssen ${c.length} Ziffern haben (Sachkontenlänge): ${[...new Set(bad8)].slice(0, 5).join(', ')}.`);
    const { wj_month: wm, ...store } = c;
    setSetting('gobd_cfg', JSON.stringify(store));
    gj.set(wm);
    const L = { berater: 'Beraternummer', mandant: 'Mandantennummer', wj_month: 'Geschäftsjahr beginnt im Monat', length: 'Sachkontenlänge', skr: 'Kontenrahmen' };
    const flat = x => ({ ...Object.fromEntries(Object.keys(L).map(k => [k, x[k]])), ...Object.fromEntries(Object.keys(VIAS).map(v => [`g_${v}`, x.gegen[v] || ''])), ...Object.fromEntries(keys().map(k => [`k_${k.key}`, x.konten[k.key] ? `${x.konten[k.key].konto || '–'} · ${SPHERES[x.konten[k.key].sphere] || 'ohne Sphäre'}` : ''])) });
    const labels = { ...L, ...Object.fromEntries(Object.entries(VIAS).map(([v, l]) => [`g_${v}`, `Geldkonto ${l}`])), ...Object.fromEntries(keys().map(k => [`k_${k.key}`, k.label])) };
    const diff = auditDiff(labels, flat(before), flat(c));
    if (diff) audit(req.user, 'Buchführung: Konten geändert', diff);
    res.json({ ok: true, cfg: c, keys: keys() });
  });
  // ohne voll: ab dem geprüften Stand (beim Öffnen der Seite) · voll: ganze Kette („Ganze Prüfkette prüfen“)
  admin.post('/gobd/pruefen', P, (req, res) => { const full = (req.body || {}).voll === true; const v = verify({ full }); if (v.ok) anchor(); if (full) audit(req.user, 'Buchführung: ganze Prüfkette geprüft', v.ok ? `${v.count} Einträge, intakt` : `unterbrochen bei Eintrag ${v.bad.id}`); res.json(v); });
  const range = (req, res) => {
    const from = String(req.query.from || ''), to = String(req.query.to || '');
    if (!isDate(from) || !isDate(to) || from > to) { bad(res, 'Bitte einen gültigen Zeitraum wählen.'); return null; }
    if (wjStart(from) !== wjStart(to)) { bad(res, 'Der Zeitraum muss in einem Wirtschaftsjahr liegen.'); return null; }
    return { from, to };
  };
  admin.get('/gobd/buchungen', PX, (req, res) => {
    const r = range(req, res); if (!r) return;
    const list = postings(r.from, r.to);
    res.json({ ...summary(list), missing: missing(list), list: list.slice(0, 500) });
  });
  admin.get('/gobd/datev.csv', PX, (req, res) => {
    const r = range(req, res); if (!r) return;
    const m = missing(postings(r.from, r.to));
    if (m.length) return bad(res, `Für den DATEV-Export fehlt noch: ${m.slice(0, 6).join(', ')}${m.length > 6 ? ' …' : ''}.`);
    const { buf, count } = datev(r.from, r.to, req.user && req.user.username);
    audit(req.user, 'DATEV-Export erstellt', `${r.from} bis ${r.to}: ${count} Buchungen`);
    res.set({ 'Content-Type': 'text/csv; charset=windows-1252', 'Content-Disposition': `attachment; filename="EXTF_Buchungsstapel_${ymd(r.from)}_${ymd(r.to)}.csv"` }).send(buf);
  });
  admin.get('/gobd/pruefer.zip', P, asyncRoute(async (req, res) => {   // enthält Namen und Anschriften aller Zahler: nur mit Recht „Einstellungen“
    const y = parseInt(req.query.year, 10);
    if (!(y >= 2000 && y <= 2100)) return bad(res, 'Bitte ein gültiges Jahr wählen.');
    const buf = await pruefer(y, req.user && req.user.username, getSetting('club_name', ''));
    audit(req.user, 'Prüfer-Export erstellt', gj.label(y));
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="Datenueberlassung_${gj.label(y).replace('/', '-')}.zip"` }).send(buf);
  }));
}

/** Für die Datenqualität: Prüfkette */
function healthCheck() {
  const v = verify();
  return { id: 'gobd', title: 'Änderungsjournal (GoBD) unterbrochen', level: 'r', count: v.ok ? 0 : 1, detail: v.ok ? '' : `Eintrag ${v.bad.id}`,
    why: v.ok ? 'Jede Änderung an Geld und Belegen ist lückenlos festgehalten.' : `${v.bad.why} Bitte sofort den Verantwortlichen und den Steuerberater informieren und keine Sicherung überschreiben.`,
    fix: { label: 'Buchführung öffnen', page: 'einstellungen', sec: ['cw_setsec', 'buchfuehrung'] } };
}

module.exports = { install, ensure, middleware, appMiddleware, verify, resetChecked, anchor, postings, summary, keys, keyForExt, cfg, datev, pruefer, retention, routes, healthCheck, viaOf, SPHERES, VIAS, tables };
