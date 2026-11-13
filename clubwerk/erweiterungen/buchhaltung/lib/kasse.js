'use strict';
/* =====================================================================================================
   Buchhaltung › Ausgaben, Kassenbuch und Auswertung (planung/ausgaben.md, Stufen A, B und D)
   A  Ausgaben mit Beleg: brutto (Vorsteuer nur mit Einstellung), Beleg (Foto/PDF) Pflicht oder Eigenbeleg mit Begründung.
      Der Beleg liegt im Tresor (belege/buchhaltung/ausgaben), wird beim Speichern mit SHA-256 eingefroren und nie ersetzt.
      Storno statt Löschen; Lieferungen aus dem Verkauf und Abbuchungen aus dem Kontoauszug werden zu Vorschlägen.
   B  Kassenbuch: Kassen mit Anfangsbestand, Bareinnahmen aller Module aus den GoBD-Buchungen (Zahlweg „bar“), Barausgaben,
      Geldtransit Kasse ↔ Bank, Umbuchung zwischen Kassen, Kassensturz mit Differenzbuchung, Festschreibung je Monat.
   D  Einnahmen-Überschuss-Rechnung je Sphäre aus den GoBD-Buchungen (Einnahmen der Module − Ausgaben); der DATEV-Stapel
      bekommt Ausgaben und Kassenbewegungen über die Regeln paid() unten (src/gobd.js).
   Rechte: „ausgaben“ erfasst, „kassenpruefung“ liest nur (Kassenprüfer).
   ===================================================================================================== */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { today, isDate, addDays, deD, euro, nowTs } = require('../../../src/util');

const BELEG_MAX = 15 * 1024 * 1024;
const VATS = [0, 7, 19];
const SPH = ['ideell', 'verm', 'zweck', 'wgb'];
const DEFAULT_TYPES = [['Wareneinkauf Getränke', 'wgb'], ['Platzpflege und Anlage', 'ideell'], ['Strom, Wasser, Heizung', 'ideell'], ['Verbandsbeiträge', 'ideell'],
  ['Trainer und Übungsleiter', 'zweck'], ['Versicherungen', 'ideell'], ['Veranstaltungen', 'wgb'], ['Büro, Porto und Bank', 'ideell'], ['Sonstiges', 'ideell']];
const MOVE = { transit: 'Geldtransit', umbuchung: 'Umbuchung', differenz: 'Kassendifferenz' };
const COINS = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
const LIMITS = { zweck: 4500000, wgb: 5000000 };   // Freigrenzen in Cent (wie in Einstellungen › Buchführung)
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const monthEnd = m => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);   // letzter Tag des Monats JJJJ-MM
const nextMonth = m => addDays(monthEnd(m), 1).slice(0, 7);
const isMonth = m => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
const sum = l => l.reduce((s, e) => s + e.cents, 0);

/** Dateityp nur aus den ersten Bytes (nie aus Endung oder Kopfzeile): JPEG, PNG, PDF, HEIC – alles andere (SVG, HTML, …) nicht */
function belegType(buf) {
  if (!buf || buf.length < 16) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' };
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp' && /^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(buf.subarray(8, 12).toString('latin1'))) return { ext: 'heic', mime: 'image/heic' };
  return null;
}
const MIME = { jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf', heic: 'image/heic' };

module.exports = function kasse(C, h) {
  const db = C.db, { need, bad, int, admin } = C;
  const { txt, one, nextNo, S, pdf, club } = h;
  const PA = need('ausgaben'), PR = need('ausgaben', 'kassenpruefung');
  const ar = fn => C.asyncRoute(fn);
  const uname = req => req.user.name || req.user.username;
  const gobd = () => C.require('./gobd');
  const vault = () => C.require('./vault');
  const fachlich = msg => Object.assign(new Error(msg), { fachlich: true });

  /* ---------------------------------------------------------------- Tabellen */
  db.exec(`
CREATE TABLE IF NOT EXISTS bh_expense_type (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, sphere TEXT NOT NULL DEFAULT 'ideell', active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bh_cash (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, start_cents INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS bh_expense (
  id INTEGER PRIMARY KEY, no TEXT NOT NULL UNIQUE, year INTEGER NOT NULL, date TEXT NOT NULL,
  gross INTEGER NOT NULL, vat_rate INTEGER NOT NULL DEFAULT 0, vat INTEGER NOT NULL DEFAULT 0, bu TEXT,   -- brutto; Vorsteuer nur mit Einstellung
  payee TEXT NOT NULL, partner_id INTEGER, type_id INTEGER NOT NULL, purpose TEXT NOT NULL,
  paid_from TEXT NOT NULL, account_id INTEGER, cash_id INTEGER,                                          -- bank | kasse
  beleg_file TEXT, beleg_sha TEXT, beleg_mime TEXT, beleg_size INTEGER, eigenbeleg TEXT,                 -- Beleg im Tresor (eingefroren) oder Eigenbeleg mit Begründung
  delivery_id INTEGER, bank_entry_id INTEGER,
  status TEXT NOT NULL DEFAULT 'aktiv', cancel_reason TEXT, cancelled_at TEXT, cancelled_by TEXT,         -- aktiv | storniert
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_bh_exp_date ON bh_expense(date);
CREATE INDEX IF NOT EXISTS ix_bh_exp_cash ON bh_expense(cash_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS ux_bh_exp_deliv ON bh_expense(delivery_id) WHERE delivery_id IS NOT NULL AND status = 'aktiv';
CREATE TABLE IF NOT EXISTS bh_cash_move (
  id INTEGER PRIMARY KEY, cash_id INTEGER NOT NULL, date TEXT NOT NULL, kind TEXT NOT NULL,              -- transit | umbuchung | differenz
  cents INTEGER NOT NULL,                                                                                -- + in die Kasse, − aus der Kasse
  other_cash_id INTEGER, account_id INTEGER, text TEXT, count_id INTEGER,
  status TEXT NOT NULL DEFAULT 'aktiv', cancel_reason TEXT, cancelled_at TEXT, cancelled_by TEXT,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_bh_cmove ON bh_cash_move(cash_id, date);
CREATE INDEX IF NOT EXISTS ix_bh_cmove_o ON bh_cash_move(other_cash_id, date);
CREATE TABLE IF NOT EXISTS bh_cash_count (
  id INTEGER PRIMARY KEY, cash_id INTEGER NOT NULL, date TEXT NOT NULL, counted_cents INTEGER NOT NULL, soll_cents INTEGER NOT NULL, diff_cents INTEGER NOT NULL,
  coins TEXT, reason TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_bh_ccount ON bh_cash_count(cash_id, date);
CREATE TABLE IF NOT EXISTS bh_cash_close (
  id INTEGER PRIMARY KEY, cash_id INTEGER NOT NULL, month TEXT NOT NULL, opening_cents INTEGER NOT NULL, soll_cents INTEGER NOT NULL, rows TEXT NOT NULL,
  closed_by TEXT, closed_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), UNIQUE(cash_id, month)
);`);
  if (!db.prepare('SELECT 1 FROM bh_expense_type').get()) { const ins = db.prepare('INSERT INTO bh_expense_type(name, sphere, sort) VALUES (?,?,?)'); DEFAULT_TYPES.forEach(([n, s], i) => ins.run(n, s, i)); }
  if (!db.prepare('SELECT 1 FROM bh_cash').get()) db.prepare("INSERT INTO bh_cash(name, start_date, start_cents, is_default) VALUES ('Kasse', ?, 0, 1)").run(today());

  /* ---------------------------------------------------------------- Helfer */
  const types = () => db.prepare('SELECT * FROM bh_expense_type ORDER BY active DESC, sort, name COLLATE NOCASE').all();
  const cashes = () => db.prepare('SELECT * FROM bh_cash ORDER BY active DESC, is_default DESC, name COLLATE NOCASE').all();
  const cashRow = id => db.prepare('SELECT * FROM bh_cash WHERE id = ?').get(id);
  const defCash = () => db.prepare('SELECT * FROM bh_cash WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1').get();
  const cashMap = () => { try { const m = JSON.parse(S('cash_map') || '{}'); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; } };
  const vorsteuer = () => S('vorsteuer') === '1';
  const accounts = () => C.bank.list().map(a => ({ id: a.id, name: a.name, iban: C.bank.maskIban ? C.bank.maskIban(a.iban) : a.iban, is_default: a.is_default }));
  const accName = id => (C.bank.get(id) || {}).name || '';
  const closedUntil = cashId => { const r = db.prepare('SELECT MAX(month) m FROM bh_cash_close WHERE cash_id = ?').get(cashId); return r && r.m ? monthEnd(r.m) : ''; };
  const typeName = id => (db.prepare('SELECT name FROM bh_expense_type WHERE id = ?').get(id) || {}).name || '';
  const DIR = () => path.join(C.require('./db').DATA_DIR, 'belege', 'buchhaltung', 'ausgaben');

  /* ---------- Bareinnahmen der Module (GoBD-Buchungen mit Zahlweg „bar“, ohne die eigenen Tabellen) je Tag und Art ---------- */
  let memo = null;   // je Anfrage: dieselben Buchungen nicht mehrfach aus dem Journal rechnen
  function barIncome(from, to) {
    const k = `${from}|${to}`;
    if (memo && memo.k === k && Date.now() - memo.at < 2000) return memo.v;
    const ks = new Map(gobd().keys().map(x => [x.key, x])), agg = new Map();
    for (const p of gobd().postings(from, to)) {
      if (p.via !== 'bar' || /^bh_(expense|cash_move):/.test(p.ref || '')) continue;
      const g = `${p.date}|${p.key}`, e = agg.get(g) || { date: p.date, key: p.key, label: (ks.get(p.key) || { label: p.key }).label, cents: 0, n: 0 };
      e.cents += p.cents; e.n++; agg.set(g, e);
    }
    const v = [...agg.values()].filter(e => e.cents);
    memo = { k, at: Date.now(), v };
    return v;
  }
  /** Alle Kassenbewegungen einer Kasse vom Anfangsbestand bis to: [{ date, cents, text, sub, doc, src, id }] */
  function entries(c, to) {
    if (!c || to < c.start_date) return [];
    const out = [], map = cashMap(), def = defCash();
    for (const e of barIncome(c.start_date, to)) {
      const target = Number(map[e.key]) && cashRow(Number(map[e.key])) && cashRow(Number(map[e.key])).active ? Number(map[e.key]) : def && def.id;
      if (target === c.id) out.push({ date: e.date, cents: e.cents, text: `Bareinnahmen – ${e.label.replace(/^Verkauf bar\/Karte: /, 'Verkauf: ')}`, sub: e.n === 1 ? '1 Buchung' : `${e.n} Buchungen`, doc: '', src: 'ein', key: e.key });
    }
    for (const x of db.prepare("SELECT * FROM bh_expense WHERE paid_from = 'kasse' AND cash_id = ? AND date <= ?").all(c.id, to)) {
      if (x.date >= c.start_date) out.push({ date: x.date, cents: -x.gross, text: `${x.payee}: ${x.purpose}`, sub: typeName(x.type_id), doc: x.no, src: 'aus', id: x.id });
      const cd = String(x.cancelled_at || '').slice(0, 10);
      if (x.status === 'storniert' && cd && cd <= to && x.date >= c.start_date) out.push({ date: cd, cents: x.gross, text: `Storno: ${x.payee}: ${x.purpose}`, sub: x.cancel_reason || '', doc: x.no, src: 'storno', id: x.id });
    }
    const mv = (m, sign, other) => {
      const label = m.kind === 'transit' ? (m.cents * sign > 0 ? `Geldtransit von der Bank${m.account_id ? ` (${accName(m.account_id)})` : ''}` : `Geldtransit zur Bank${m.account_id ? ` (${accName(m.account_id)})` : ''}`)
        : m.kind === 'umbuchung' ? (m.cents * sign > 0 ? `Umbuchung von ${other}` : `Umbuchung an ${other}`) : 'Kassendifferenz laut Kassensturz';
      out.push({ date: m.date, cents: m.cents * sign, text: label, sub: m.text || '', doc: `K-${m.id}`, src: 'move', id: m.id, kind: m.kind });
      const cd = String(m.cancelled_at || '').slice(0, 10);
      if (m.status === 'storniert' && cd && cd <= to) out.push({ date: cd, cents: -m.cents * sign, text: `Storno: ${label}`, sub: m.cancel_reason || '', doc: `K-${m.id}`, src: 'storno', id: m.id });
    };
    for (const m of db.prepare('SELECT * FROM bh_cash_move WHERE cash_id = ? AND date <= ? AND date >= ?').all(c.id, to, c.start_date)) mv(m, 1, (cashRow(m.other_cash_id) || {}).name || '');
    for (const m of db.prepare('SELECT * FROM bh_cash_move WHERE other_cash_id = ? AND date <= ? AND date >= ?').all(c.id, to, c.start_date)) mv(m, -1, (cashRow(m.cash_id) || {}).name || '');
    const ord = { ein: 0, move: 1, aus: 2, storno: 3 };
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (ord[a.src] - ord[b.src]) || ((a.id || 0) - (b.id || 0))));
  }
  /** Kassenbuch eines Monats: festgeschrieben = gespeicherter Stand; sonst gerechnet ab dem letzten festgeschriebenen Monat.
   *  Kam nach der Festschreibung etwas mit Datum in einem festgeschriebenen Monat dazu, erscheint es als „Nachtrag“ im ersten offenen Monat. */
  function book(c, month) {
    const closes = db.prepare('SELECT * FROM bh_cash_close WHERE cash_id = ? ORDER BY month').all(c.id);
    const cl = closes.find(x => x.month === month);
    if (cl) { const rows = JSON.parse(cl.rows || '[]'); return { month, opening: cl.opening_cents, closing: cl.soll_cents, rows, closed: { at: cl.closed_at, by: cl.closed_by } }; }
    const mStart = `${month}-01`, mEnd = monthEnd(month);
    if (mEnd < c.start_date) return { month, opening: 0, closing: 0, rows: [], before: true };
    const last = closes.filter(x => x.month < month).pop();
    const all = entries(c, mEnd);
    let opening, list;
    if (last) {
      const lastEnd = monthEnd(last.month);
      const diff = c.start_cents + sum(all.filter(e => e.date <= lastEnd)) - last.soll_cents;
      const after = [...(diff ? [{ date: `${nextMonth(last.month)}-01`, cents: diff, text: 'Nachtrag zu festgeschriebenen Monaten', sub: 'Buchungen mit Datum in einem schon festgeschriebenen Monat', doc: '', src: 'nachtrag' }] : []), ...all.filter(e => e.date > lastEnd)];
      opening = last.soll_cents + sum(after.filter(e => e.date < mStart));
      list = after.filter(e => e.date >= mStart);
    } else {
      opening = c.start_cents + sum(all.filter(e => e.date < mStart));
      list = all.filter(e => e.date >= mStart);
    }
    let bal = opening;
    const rows = list.map(e => ({ ...e, balance: (bal += e.cents) }));
    return { month, opening, closing: bal, rows, start: c.start_date >= mStart ? { date: c.start_date, cents: c.start_cents } : null };
  }
  /** Soll-Bestand am Ende eines Tages (wie das Kassenbuch) */
  function balanceAt(c, date) {
    const b = book(c, date.slice(0, 7));
    if (b.before) return 0;
    return b.rows.filter(r => r.date <= date).reduce((s, r) => s + r.cents, b.opening);
  }
  /** Niedrigster Bestand ab date bis heute, wenn zusätzlich delta am Tag date gebucht würde (Kasse darf nie ins Minus) */
  function minAfter(c, date, delta) {
    let bal = c.start_cents, low = null;
    for (const e of entries(c, today() > date ? today() : date)) {
      if (e.date > date && low === null) low = bal + delta;   // Stand am Ende des Tages date
      bal += e.cents;
      if (e.date > date) low = Math.min(low, bal + delta);
    }
    return low === null ? bal + delta : low;
  }
  const notClosed = (c, date) => { const u = closedUntil(c.id); if (u && date <= u) throw fachlich(`Der Monat ${deD(date).slice(3)} der ${c.name} ist festgeschrieben – bitte mit Datum in einem offenen Monat buchen.`); };
  const cashOk = (id, date) => {
    const c = cashRow(Number(id));
    if (!c || !c.active) throw fachlich('Bitte eine Kasse wählen.');
    if (date < c.start_date) throw fachlich(`Die ${c.name} beginnt am ${deD(c.start_date)} – davor lässt sich nichts buchen.`);
    notClosed(c, date);
    return c;
  };
  const noMinus = (c, date, delta) => { if (delta < 0 && minAfter(c, date, delta) < 0) throw fachlich(`Dafür reicht der Bestand der ${c.name} nicht – eine Kasse kann nicht ins Minus gehen. Erst Bareinnahmen oder Geldtransit buchen.`); };

  /* ---------------------------------------------------------------- Belege */
  function cleanupTmp() {
    try { for (const f of fs.readdirSync(DIR())) if (/^tmp_/.test(f) && Date.now() - fs.statSync(path.join(DIR(), f)).mtimeMs > 86400000) fs.rmSync(path.join(DIR(), f), { force: true }); } catch (e) { /* Ordner fehlt noch */ }
  }
  const tmpFile = token => { if (!/^[0-9a-f]{32}$/.test(String(token || ''))) return null; const f = ['jpg', 'png', 'pdf', 'heic'].map(x => `tmp_${token}.${x}`).find(x => fs.existsSync(path.join(DIR(), x))); return f || null; };
  /** Beleg lesen und gegen die eingefrorene Prüfsumme prüfen */
  function readBeleg(x) {
    if (!x.beleg_file) throw fachlich('Zu dieser Ausgabe gibt es keine Belegdatei (Eigenbeleg).');
    const f = path.join(DIR(), path.basename(x.beleg_file));
    if (!fs.existsSync(f)) throw fachlich(`Die Belegdatei zu ${x.no} fehlt – bitte aus einer Sicherung zurückholen.`);
    let buf = null;
    try { buf = vault().readFile(f); } catch (e) { if (vault().locked && vault().locked()) throw Object.assign(e, { vaultLocked: true }); }   // nicht zu entschlüsseln = verändert
    if (!buf || sha256(buf) !== x.beleg_sha) throw fachlich(`Die Belegdatei zu ${x.no} wurde verändert (Prüfsumme stimmt nicht). Bitte den Steuerberater informieren und die Datei aus einer Sicherung holen.`);
    return buf;
  }

  /* ---------------------------------------------------------------- Ansicht */
  const expView = x => ({ id: x.id, no: x.no, date: x.date, gross: x.gross, vat_rate: x.vat_rate, vat: x.vat, payee: x.payee, purpose: x.purpose, type_id: x.type_id, type: typeName(x.type_id),
    paid_from: x.paid_from, account: x.account_id ? accName(x.account_id) : '', cash: x.cash_id ? (cashRow(x.cash_id) || {}).name || '' : '', cash_id: x.cash_id,
    beleg: Boolean(x.beleg_file), beleg_mime: x.beleg_mime || '', eigenbeleg: x.eigenbeleg || '', delivery_id: x.delivery_id, bank: Boolean(x.bank_entry_id),
    status: x.status, cancel_reason: x.cancel_reason, cancelled_at: x.cancelled_at, created_by: x.created_by, created_at: x.created_at });
  const can = (req, p) => req.user.perms.includes(p);

  admin.get('/aus/meta', PR, (req, res) => {
    const G = C.geschaeftsjahr, gy = G.yearOf(today());
    res.json({ today: today(), canEdit: can(req, 'ausgaben'), vorsteuer: vorsteuer(), prefix: S('aus_prefix'),
      gj: { year: gy, fiscal: G.month(), years: Array.from({ length: 6 }, (_, i) => ({ y: gy - i, label: G.label(gy - i) })) },
      types: types(), cashes: cashes().map(c => ({ id: c.id, name: c.name, active: c.active, is_default: c.is_default, start_date: c.start_date, closed_until: closedUntil(c.id) })),
      accounts: accounts(), partners: db.prepare('SELECT id, name FROM bh_partner WHERE active = 1 ORDER BY name COLLATE NOCASE').all(),
      deliveries: C.isModuleActive('getraenke'), kontoauszug: can(req, 'kontoauszug') });
  });

  /* ---------- Ausgaben ---------- */
  admin.get('/expenses', PR, (req, res) => {
    const q = req.query, w = [], a = [];
    if (q.year) { const r = C.geschaeftsjahr.range(int(q.year)); w.push('date BETWEEN ? AND ?'); a.push(r.from, r.to); }
    if (q.status && q.status !== 'alle') { w.push('status = ?'); a.push(q.status === 'storniert' ? 'storniert' : 'aktiv'); }
    if (int(q.type)) { w.push('type_id = ?'); a.push(int(q.type)); }
    if (q.from === 'bank' || q.from === 'kasse') { w.push('paid_from = ?'); a.push(q.from); }
    res.json(db.prepare(`SELECT * FROM bh_expense ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY date DESC, id DESC LIMIT 1000`).all(...a).map(expView));
  });
  admin.get('/expenses/:id', PR, (req, res) => { const x = db.prepare('SELECT * FROM bh_expense WHERE id = ?').get(int(req.params.id)); if (!x) return bad(res, 'Nicht gefunden.', 404); res.json(expView(x)); });
  admin.get('/expenses/:id/beleg', PR, (req, res) => {
    const x = db.prepare('SELECT * FROM bh_expense WHERE id = ?').get(int(req.params.id));
    if (!x) return bad(res, 'Nicht gefunden.', 404);
    let buf; try { buf = readBeleg(x); } catch (e) { if (e.vaultLocked) return bad(res, e.message, 423); if (e.fachlich) return bad(res, e.message, 409); throw e; }
    const ext = path.extname(x.beleg_file).slice(1);
    res.set({ 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Disposition': `${req.query.dl ? 'attachment' : 'inline'}; filename="Beleg_${x.no.replace(/[^\w-]+/g, '_')}.${ext}"`,
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'self'; sandbox", 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
  /* Beleg vorab hochladen (Foto oder PDF) → Merker für „Ausgabe speichern“. Typ nur aus den Bytes, Name nie aus der Eingabe. */
  admin.post('/expenses/beleg', PA, C.rateLimit('bhbeleg', 60, 10 * 60000), C.require('express').raw({ type: () => true, limit: BELEG_MAX + 1024 }), (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return bad(res, 'Keine Datei empfangen.');
    if (buf.length > BELEG_MAX) return bad(res, 'Die Datei ist zu groß (höchstens 15 MB).');
    const t = belegType(buf);
    if (!t) return bad(res, 'Bitte ein Foto (JPG, PNG, HEIC) oder eine PDF-Datei hochladen.');
    cleanupTmp();
    fs.mkdirSync(DIR(), { recursive: true, mode: 0o700 });
    const token = crypto.randomBytes(16).toString('hex');
    vault().writeFile(path.join(DIR(), `tmp_${token}.${t.ext}`), buf);
    res.json({ token, mime: t.mime, size: buf.length });
  });

  /** Ausgabe speichern (Verwaltung und Vorschläge gleich) */
  function createExpense(b, req) {
    const date = String(b.date || '');
    if (!isDate(date) || date > today()) throw fachlich('Bitte das Datum der Zahlung angeben (nicht in der Zukunft).');
    const gross = Math.round(Number(b.gross));
    if (!Number.isFinite(gross) || gross <= 0 || gross > 100000000) throw fachlich('Bitte den Betrag eintragen.');
    const payee = one(b.payee, 100), purpose = one(b.purpose, 200);
    if (payee.length < 2) throw fachlich('Bitte den Empfänger eintragen (an wen ging das Geld?).');
    if (purpose.length < 3) throw fachlich('Bitte kurz eintragen, wofür das Geld ausgegeben wurde.');
    const type = db.prepare('SELECT * FROM bh_expense_type WHERE id = ? AND active = 1').get(int(b.type_id));
    if (!type) throw fachlich('Bitte die Ausgabeart wählen.');
    const rate = VATS.includes(Number(b.vat_rate)) ? Number(b.vat_rate) : 0;
    const vst = vorsteuer();
    const vat = vst && rate ? Math.round(gross * rate / (100 + rate)) : 0;
    const from = b.paid_from === 'kasse' ? 'kasse' : 'bank';
    let cash = null, acc = null, entry = null;
    if (from === 'kasse') { cash = cashOk(b.cash_id, date); noMinus(cash, date, -gross); }
    else { acc = C.bank.get(int(b.account_id)); if (!acc) throw fachlich('Bitte das Bankkonto wählen, von dem bezahlt wurde.'); }
    if (b.bank_entry_id) {
      if (!can(req, 'kontoauszug')) throw fachlich('Für Abbuchungen aus dem Kontoauszug fehlt dir die Berechtigung „Kontoauszug“.');
      entry = db.prepare("SELECT * FROM bank_entry WHERE id = ? AND kind = 'abbuchung'").get(int(b.bank_entry_id));
      if (!entry || entry.status !== 'offen') throw fachlich('Diese Abbuchung ist nicht mehr offen.');
      if (from !== 'bank' || -entry.cents !== gross) throw fachlich(`Der Betrag passt nicht zur Abbuchung (${euro(-entry.cents)}).`);
      acc = C.bank.get(entry.account_id) || acc;
    }
    let deliv = null;
    if (b.delivery_id) {
      if (!C.isModuleActive('getraenke')) throw fachlich('Lieferungen gibt es nur mit dem Verkauf.');
      deliv = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(int(b.delivery_id));
      if (!deliv || deliv.doc_kind === 'gutschrift') throw fachlich('Diese Lieferung gibt es nicht (mehr).');
      if (db.prepare("SELECT 1 FROM bh_expense WHERE delivery_id = ? AND status = 'aktiv'").get(deliv.id)) throw fachlich('Diese Lieferung ist schon als Ausgabe erfasst.');
    }
    // Beleg: hochgeladene Datei, Beleg der Lieferung oder Eigenbeleg mit Begründung
    let src = null, buf = null, t = null;
    const eigen = one(b.eigenbeleg, 300);
    if (b.beleg) {
      src = tmpFile(b.beleg); if (!src) throw fachlich('Der hochgeladene Beleg wurde nicht gefunden – bitte noch einmal hochladen.');
      buf = vault().readFile(path.join(DIR(), src)); t = belegType(buf);
    } else if (deliv && deliv.file && /^[\w-]+\.(pdf|jpg|png|heic)$/.test(deliv.file) && fs.existsSync(path.join(C.require('./db').DATA_DIR, 'belege', deliv.file))) {
      buf = vault().readFile(path.join(C.require('./db').DATA_DIR, 'belege', deliv.file)); t = belegType(buf);
    }
    if (!t && eigen.length < 10) throw fachlich('Bitte den Beleg (Foto oder PDF) hinzufügen – oder als Eigenbeleg begründen, warum es keinen gibt (mindestens 10 Zeichen).');
    const year = Number(date.slice(0, 4));
    let id, no, file = null;
    fs.mkdirSync(DIR(), { recursive: true, mode: 0o700 });
    db.transaction(() => {
      no = nextNo('bh_expense', S('aus_prefix') || 'A-', year);
      if (t) {
        file = `${no.replace(/[^\w-]+/g, '_')}_${crypto.randomBytes(4).toString('hex')}.${t.ext}`;
        if (src) fs.renameSync(path.join(DIR(), src), path.join(DIR(), file)); else vault().writeFile(path.join(DIR(), file), buf);
      }
      id = Number(db.prepare(`INSERT INTO bh_expense(no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(no, year, date, gross, rate, vat, vst ? ({ 19: '9', 7: '8' }[rate] || null) : null, payee, int(b.partner_id) || null, type.id, purpose, from,
        acc ? acc.id : null, cash ? cash.id : null, file, t ? sha256(buf) : null, t ? t.mime : null, t ? buf.length : null, t ? null : eigen, deliv ? deliv.id : null, uname(req)).lastInsertRowid);
      if (entry) {
        db.prepare('UPDATE bh_expense SET bank_entry_id = ? WHERE id = ?').run(entry.id, id);
        C.require('./kontoauszug').link(req.user, entry.id, { module: 'buchhaltung', key: `a:${id}`, label: `Ausgabe ${no} – ${payee}`, cents: entry.cents, ref: { id, entry: entry.id } });
      }
    })();
    C.audit(req.user, 'Ausgabe erfasst', `${no}: ${payee} ${euro(gross)} (${from === 'kasse' ? cash.name : acc.name}${t ? '' : ', Eigenbeleg'})`);
    return { id, no };
  }
  admin.post('/expenses', PA, (req, res) => { try { res.json(createExpense(req.body || {}, req)); } catch (e) { if (e.fachlich) return bad(res, e.message); throw e; } });
  admin.post('/expenses/:id/cancel', PA, (req, res) => {
    const x = db.prepare('SELECT * FROM bh_expense WHERE id = ?').get(int(req.params.id));
    if (!x) return bad(res, 'Nicht gefunden.', 404);
    if (x.status !== 'aktiv') return bad(res, 'Schon storniert.');
    if (x.bank_entry_id) return bad(res, 'Diese Ausgabe ist mit einer Abbuchung im Kontoauszug verknüpft – bitte dort zuerst die Zuordnung aufheben.');
    const reason = one((req.body || {}).reason, 200);
    if (reason.length < 3) return bad(res, 'Bitte kurz begründen.');
    try { if (x.cash_id) { const c = cashRow(x.cash_id); notClosed(c, today()); } } catch (e) { return bad(res, e.message); }
    db.prepare("UPDATE bh_expense SET status = 'storniert', cancel_reason = ?, cancelled_at = ?, cancelled_by = ? WHERE id = ?").run(reason, nowTs(), uname(req), x.id);
    C.audit(req.user, 'Ausgabe storniert', `${x.no}: ${reason}`);
    res.json({ ok: true });
  });
  /* Vorschläge: Lieferungen aus dem Verkauf ohne Ausgabe, offene Abbuchungen aus dem Kontoauszug */
  admin.get('/expenses-suggest', PA, (req, res) => {
    const deliveries = C.isModuleActive('getraenke') ? db.prepare(`SELECT d.id, d.date, d.supplier, d.doc_no, d.doc_kind, d.total_cents, d.file FROM deliveries d
      WHERE d.doc_kind != 'gutschrift' AND d.total_cents > 0 AND d.date >= ? AND NOT EXISTS (SELECT 1 FROM bh_expense x WHERE x.delivery_id = d.id AND x.status = 'aktiv') ORDER BY d.date DESC LIMIT 50`).all(addDays(today(), -400))
      .map(d => ({ id: d.id, date: d.date, supplier: d.supplier, doc_no: d.doc_no, kind: d.doc_kind, cents: d.total_cents, beleg: Boolean(d.file) })) : [];
    const debits = can(req, 'kontoauszug') ? C.require('./kontoauszug').openDebits().slice(0, 50).map(e => ({ id: e.id, date: e.date, cents: e.cents, name: e.name, purpose: e.purpose, account_id: e.account_id, account: e.account })) : [];
    res.json({ deliveries, debits });
  });

  /* ---------- Ausgabearten ---------- */
  admin.post('/types', PA, (req, res) => {
    const name = one((req.body || {}).name, 60); if (name.length < 2) return bad(res, 'Bitte einen Namen eintragen.');
    if (db.prepare('SELECT 1 FROM bh_expense_type WHERE name = ? COLLATE NOCASE').get(name)) return bad(res, 'Diese Ausgabeart gibt es schon.');
    const sphere = SPH.includes((req.body || {}).sphere) ? req.body.sphere : 'ideell';
    const id = Number(db.prepare('INSERT INTO bh_expense_type(name, sphere, sort) VALUES (?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM bh_expense_type))').run(name, sphere).lastInsertRowid);
    C.audit(req.user, 'Buchhaltung: Ausgabeart angelegt', name);
    res.json({ id });
  });
  admin.put('/types/:id', PA, (req, res) => {
    const t = db.prepare('SELECT * FROM bh_expense_type WHERE id = ?').get(int(req.params.id)); if (!t) return bad(res, 'Nicht gefunden.', 404);
    const b = req.body || {}, name = b.name !== undefined ? one(b.name, 60) : t.name;
    if (name.length < 2) return bad(res, 'Bitte einen Namen eintragen.');
    if (db.prepare('SELECT 1 FROM bh_expense_type WHERE name = ? COLLATE NOCASE AND id != ?').get(name, t.id)) return bad(res, 'Diese Ausgabeart gibt es schon.');
    const active = b.active === undefined ? t.active : b.active ? 1 : 0;
    db.prepare('UPDATE bh_expense_type SET name = ?, active = ? WHERE id = ?').run(name, active, t.id);
    const diff = C.auditDiff({ name: 'Name', active: ['Aktiv', 'bool'] }, { name: t.name, active: Boolean(t.active) }, { name, active: Boolean(active) });
    if (diff) C.audit(req.user, 'Buchhaltung: Ausgabeart geändert', `${t.name}: ${diff}`);
    res.json({ ok: true });
  });

  /* ---------- Kassen ---------- */
  admin.get('/cash', PR, (req, res) => {
    const d = today();
    res.json(cashes().map(c => ({ ...c, balance: c.start_date <= d ? balanceAt(c, d) : c.start_cents, closed_until: closedUntil(c.id),
      last_count: db.prepare('SELECT date, counted_cents, diff_cents FROM bh_cash_count WHERE cash_id = ? ORDER BY date DESC, id DESC LIMIT 1').get(c.id) || null })));
  });
  admin.post('/cash', PA, (req, res) => {
    const b = req.body || {}, name = one(b.name, 40);
    if (name.length < 2) return bad(res, 'Bitte einen Namen für die Kasse eintragen.');
    if (db.prepare('SELECT 1 FROM bh_cash WHERE name = ? COLLATE NOCASE').get(name)) return bad(res, 'Eine Kasse mit diesem Namen gibt es schon.');
    const date = isDate(b.start_date) ? b.start_date : today(), cents = Math.round(Number(b.start_cents) || 0);
    if (cents < 0 || cents > 10000000) return bad(res, 'Bitte den Anfangsbestand prüfen.');
    const id = Number(db.prepare('INSERT INTO bh_cash(name, start_date, start_cents, is_default) VALUES (?,?,?,0)').run(name, date, cents).lastInsertRowid);
    C.audit(req.user, 'Kasse angelegt', `${name}: Anfangsbestand ${euro(cents)} am ${deD(date)}`);
    res.json({ id });
  });
  admin.put('/cash/:id', PA, (req, res) => {
    const c = cashRow(int(req.params.id)); if (!c) return bad(res, 'Nicht gefunden.', 404);
    const b = req.body || {}, name = b.name !== undefined ? one(b.name, 40) : c.name;
    if (name.length < 2) return bad(res, 'Bitte einen Namen für die Kasse eintragen.');
    if (db.prepare('SELECT 1 FROM bh_cash WHERE name = ? COLLATE NOCASE AND id != ?').get(name, c.id)) return bad(res, 'Eine Kasse mit diesem Namen gibt es schon.');
    let active = b.active === undefined ? c.active : b.active ? 1 : 0;
    if (!active && (c.is_default || b.is_default)) return bad(res, 'Die Hauptkasse lässt sich nicht stilllegen – erst eine andere Kasse zur Hauptkasse machen.');
    if (!active && balanceAt(c, today()) !== 0) return bad(res, 'Stilllegen geht erst, wenn die Kasse leer ist – den Bestand vorher zur Bank oder in eine andere Kasse buchen.');
    // Anfangsbestand: änderbar, solange in der Kasse noch nichts gebucht und nichts festgeschrieben ist
    let start = c.start_cents, sd = c.start_date;
    if (b.start_cents !== undefined || b.start_date !== undefined) {
      const used = db.prepare("SELECT 1 FROM bh_expense WHERE cash_id = ? UNION SELECT 1 FROM bh_cash_move WHERE cash_id = ? OR other_cash_id = ? UNION SELECT 1 FROM bh_cash_count WHERE cash_id = ? UNION SELECT 1 FROM bh_cash_close WHERE cash_id = ?").get(c.id, c.id, c.id, c.id, c.id);
      const nc = b.start_cents !== undefined ? Math.round(Number(b.start_cents) || 0) : start, nd = isDate(b.start_date) ? b.start_date : sd;
      if ((nc !== start || nd !== sd) && used) return bad(res, 'Der Anfangsbestand lässt sich nur ändern, solange in der Kasse noch nichts gebucht ist.');
      if (nc < 0 || nc > 10000000) return bad(res, 'Bitte den Anfangsbestand prüfen.');
      start = nc; sd = nd;
    }
    db.transaction(() => {
      if (b.is_default && active) db.prepare('UPDATE bh_cash SET is_default = (id = ?)').run(c.id);
      db.prepare('UPDATE bh_cash SET name = ?, active = ?, start_cents = ?, start_date = ? WHERE id = ?').run(name, active, start, sd, c.id);
    })();
    const diff = C.auditDiff({ name: 'Name', active: ['Aktiv', 'bool'], start: ['Anfangsbestand', 'euro'], sd: 'Beginnt am', def: ['Hauptkasse', 'bool'] },
      { name: c.name, active: Boolean(c.active), start: c.start_cents, sd: deD(c.start_date), def: Boolean(c.is_default) }, { name, active: Boolean(active), start, sd: deD(sd), def: Boolean(cashRow(c.id).is_default) });
    if (diff) C.audit(req.user, 'Kasse geändert', `${c.name}: ${diff}`);
    res.json({ ok: true });
  });
  /* Bareinnahmen der Module einer Kasse zuordnen (ohne Zuordnung: Hauptkasse) */
  admin.get('/cash-map', PR, (req, res) => {
    const m = cashMap();
    res.json(gobd().keys().filter(k => k.art === 'einnahme').map(k => ({ key: k.key, label: k.label, module: k.module, cash_id: Number(m[k.key]) || null })));
  });
  admin.put('/cash-map', PA, (req, res) => {
    const b = (req.body || {}).map || {}, valid = new Set(gobd().keys().map(k => k.key)), out = {};
    for (const [k, v] of Object.entries(b)) if (valid.has(k) && Number(v) && cashRow(Number(v)) && cashRow(Number(v)).active) out[k] = Number(v);
    C.setSetting2('cash_map', JSON.stringify(out));
    C.audit(req.user, 'Kassen: Bareinnahmen zugeordnet', Object.keys(out).length ? Object.entries(out).map(([k, v]) => `${(gobd().keys().find(x => x.key === k) || { label: k }).label} → ${cashRow(v).name}`).join('; ') : 'alles in die Hauptkasse');
    res.json({ ok: true });
  });
  const cashOr404 = (req, res) => { const c = cashRow(int(req.params.id)); if (!c) bad(res, 'Nicht gefunden.', 404); return c; };
  const monthOf = q => (isMonth(q) ? q : today().slice(0, 7));
  admin.get('/cash/:id/book', PR, (req, res) => {
    const c = cashOr404(req, res); if (!c) return;
    const m = monthOf(req.query.month);
    const counts = db.prepare('SELECT * FROM bh_cash_count WHERE cash_id = ? AND date BETWEEN ? AND ? ORDER BY date, id').all(c.id, `${m}-01`, monthEnd(m))
      .map(x => ({ ...x, coins: JSON.parse(x.coins || 'null') }));
    const closes = db.prepare('SELECT month FROM bh_cash_close WHERE cash_id = ? ORDER BY month').all(c.id).map(x => x.month);
    res.json({ cash: { id: c.id, name: c.name, start_date: c.start_date, start_cents: c.start_cents, active: c.active }, ...book(c, m), counts, closes, closed_until: closedUntil(c.id),
      canClose: m < today().slice(0, 7) && !closes.includes(m) && monthEnd(m) >= c.start_date && (closes.length ? nextMonth(closes[closes.length - 1]) === m : m === c.start_date.slice(0, 7)) });
  });
  /* Soll-Bestand an einem Tag (für den Kassensturz) */
  admin.get('/cash/:id/soll', PR, (req, res) => {
    const c = cashOr404(req, res); if (!c) return;
    const d = isDate(req.query.date) ? req.query.date : today();
    res.json({ date: d, soll: d < c.start_date ? null : balanceAt(c, d), closed: Boolean(closedUntil(c.id) && d <= closedUntil(c.id)) });
  });
  /* Geldtransit (Kasse ↔ Bank) und Umbuchung (Kasse → andere Kasse) */
  admin.post('/cash/:id/move', PA, (req, res) => {
    const c = cashOr404(req, res); if (!c) return;
    const b = req.body || {}, date = String(b.date || '');
    try {
      if (!isDate(date) || date > today()) throw fachlich('Bitte das Datum angeben (nicht in der Zukunft).');
      cashOk(c.id, date);
      const amount = Math.round(Number(b.cents));
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) throw fachlich('Bitte den Betrag eintragen.');
      const text = one(b.text, 120) || null;
      let row;
      if (b.kind === 'umbuchung') {
        const o = cashOk(b.other_cash_id, date);
        if (o.id === c.id) throw fachlich('Bitte eine andere Kasse wählen.');
        noMinus(c, date, -amount);
        row = { kind: 'umbuchung', cents: -amount, other: o.id, acc: null, label: `${euro(amount)} von ${c.name} an ${o.name}` };
      } else {
        const acc = C.bank.get(int(b.account_id)); if (!acc) throw fachlich('Bitte das Bankkonto wählen.');
        const into = b.direction === 'in';   // in = von der Bank in die Kasse, sonst Einzahlung zur Bank
        if (!into) noMinus(c, date, -amount);
        row = { kind: 'transit', cents: into ? amount : -amount, other: null, acc: acc.id, label: into ? `${euro(amount)} von ${acc.name} in die ${c.name}` : `${euro(amount)} aus der ${c.name} auf ${acc.name}` };
      }
      const id = Number(db.prepare('INSERT INTO bh_cash_move(cash_id, date, kind, cents, other_cash_id, account_id, text, created_by) VALUES (?,?,?,?,?,?,?,?)').run(c.id, date, row.kind, row.cents, row.other, row.acc, text, uname(req)).lastInsertRowid);
      C.audit(req.user, row.kind === 'transit' ? 'Kasse: Geldtransit gebucht' : 'Kasse: Umbuchung gebucht', `${row.label} am ${deD(date)}`);
      res.json({ id });
    } catch (e) { if (e.fachlich) return bad(res, e.message); throw e; }
  });
  admin.post('/cash/moves/:id/cancel', PA, (req, res) => {
    const m = db.prepare('SELECT * FROM bh_cash_move WHERE id = ?').get(int(req.params.id));
    if (!m) return bad(res, 'Nicht gefunden.', 404);
    if (m.status !== 'aktiv') return bad(res, 'Schon storniert.');
    if (m.kind === 'differenz') return bad(res, 'Eine Kassendifferenz gehört zum Kassensturz und bleibt stehen – ein neuer Kassensturz gleicht sie aus.');
    const reason = one((req.body || {}).reason, 200); if (reason.length < 3) return bad(res, 'Bitte kurz begründen.');
    try {
      for (const id of [m.cash_id, m.other_cash_id].filter(Boolean)) notClosed(cashRow(id), today());
      if (m.cents > 0) noMinus(cashRow(m.cash_id), today(), -m.cents);   // Storno nimmt Geld aus der Kasse
      if (m.kind === 'umbuchung') noMinus(cashRow(m.other_cash_id), today(), m.cents);
    } catch (e) { if (e.fachlich) return bad(res, e.message); throw e; }
    db.prepare("UPDATE bh_cash_move SET status = 'storniert', cancel_reason = ?, cancelled_at = ?, cancelled_by = ? WHERE id = ?").run(reason, nowTs(), uname(req), m.id);
    C.audit(req.user, 'Kasse: Buchung storniert', `K-${m.id} ${MOVE[m.kind]} ${euro(Math.abs(m.cents))}: ${reason}`);
    res.json({ ok: true });
  });
  /* Kassensturz: gezählter Bestand gegen Soll, Differenz als eigene Buchung mit Begründung */
  admin.post('/cash/:id/count', PA, (req, res) => {
    const c = cashOr404(req, res); if (!c) return;
    const b = req.body || {}, date = String(b.date || '');
    try {
      if (!isDate(date) || date > today()) throw fachlich('Bitte den Tag des Kassensturzes angeben (nicht in der Zukunft).');
      cashOk(c.id, date);
      let coins = null, counted;
      if (b.coins && typeof b.coins === 'object') {
        coins = {}; counted = 0;
        for (const v of COINS) { const n = Math.max(0, Math.min(100000, int(b.coins[v]))); if (n) { coins[v] = n; counted += n * v; } }
      } else counted = Math.round(Number(b.counted_cents));
      if (!Number.isFinite(counted) || counted < 0 || counted > 100000000) throw fachlich('Bitte den gezählten Bestand eintragen.');
      const soll = balanceAt(c, date), diff = counted - soll, reason = one(b.reason, 200);
      if (diff && reason.length < 3) throw fachlich(`Gezählt ${euro(counted)}, laut Kassenbuch ${euro(soll)} – bitte die Differenz von ${euro(diff)} kurz begründen.`);
      if (diff < 0) noMinus(c, date, diff);
      let id;
      db.transaction(() => {
        id = Number(db.prepare('INSERT INTO bh_cash_count(cash_id, date, counted_cents, soll_cents, diff_cents, coins, reason, created_by) VALUES (?,?,?,?,?,?,?,?)').run(c.id, date, counted, soll, diff, coins ? JSON.stringify(coins) : null, reason || null, uname(req)).lastInsertRowid);
        if (diff) db.prepare("INSERT INTO bh_cash_move(cash_id, date, kind, cents, text, count_id, created_by) VALUES (?,?,'differenz',?,?,?,?)").run(c.id, date, diff, reason, id, uname(req));
      })();
      C.audit(req.user, 'Kassensturz', `${c.name} am ${deD(date)}: gezählt ${euro(counted)}, Soll ${euro(soll)}${diff ? `, Differenz ${euro(diff)} (${reason})` : ', stimmt'}`);
      res.json({ id, soll, counted, diff });
    } catch (e) { if (e.fachlich) return bad(res, e.message); throw e; }
  });
  /* Monat festschreiben: der Stand wird gespeichert; danach nur noch Buchungen in offenen Monaten (Storno, Korrektur) */
  admin.post('/cash/:id/close', PA, (req, res) => {
    const c = cashOr404(req, res); if (!c) return;
    const m = String((req.body || {}).month || '');
    if (!isMonth(m) || m >= today().slice(0, 7)) return bad(res, 'Festschreiben geht nur für abgelaufene Monate.');
    if (monthEnd(m) < c.start_date) return bad(res, 'In diesem Monat gab es die Kasse noch nicht.');
    const closes = db.prepare('SELECT month FROM bh_cash_close WHERE cash_id = ? ORDER BY month').all(c.id).map(x => x.month);
    if (closes.includes(m)) return bad(res, 'Dieser Monat ist schon festgeschrieben.');
    const want = closes.length ? nextMonth(closes[closes.length - 1]) : c.start_date.slice(0, 7);
    if (m !== want) return bad(res, `Bitte zuerst ${deD(`${want}-01`).slice(3)} festschreiben – die Monate werden der Reihe nach abgeschlossen.`);
    const b = book(c, m);
    db.prepare('INSERT INTO bh_cash_close(cash_id, month, opening_cents, soll_cents, rows, closed_by) VALUES (?,?,?,?,?,?)').run(c.id, m, b.opening, b.closing, JSON.stringify(b.rows), uname(req));
    C.audit(req.user, 'Kassenbuch festgeschrieben', `${c.name} ${deD(`${m}-01`).slice(3)}: Bestand ${euro(b.closing)}`);
    res.json({ ok: true, closing: b.closing });
  });
  /* Kassenbuch als PDF und Excel je Monat */
  const bookFile = (c, m) => `Kassenbuch_${c.name.replace(/[^\wäöüÄÖÜß-]+/g, '_')}_${m}`;
  admin.get('/cash/:id/book.pdf', PR, ar(async (req, res) => {
    const c = cashOr404(req, res); if (!c) return;
    const m = monthOf(req.query.month), b = book(c, m);
    const buf = await pdf.cashBook(club(), { cash: c.name, month: m, ...b });
    C.audit(req.user, 'Kassenbuch exportiert', `Kassenbuch ${c.name}, Monat ${deD(`${m}-01`).slice(3)}, als PDF`);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${encodeURIComponent(bookFile(c, m))}.pdf"` }).send(buf);
  }));
  admin.get('/cash/:id/book.xlsx', PR, ar(async (req, res) => {
    const c = cashOr404(req, res); if (!c) return;
    const m = monthOf(req.query.month), b = book(c, m);
    const Excel = C.require('exceljs'), wb = new Excel.Workbook(), ws = wb.addWorksheet('Kassenbuch');
    ws.columns = [{ header: 'Datum', key: 'd', width: 12 }, { header: 'Beleg', key: 'b', width: 14 }, { header: 'Text', key: 't', width: 50 }, { header: 'Einnahme', key: 'i', width: 13 }, { header: 'Ausgabe', key: 'o', width: 13 }, { header: 'Bestand', key: 's', width: 13 }];
    ws.addRow({ d: deD(`${m}-01`), t: b.closed ? 'Anfangsbestand (festgeschrieben)' : 'Anfangsbestand', s: b.opening / 100 });
    for (const r of b.rows) ws.addRow({ d: deD(r.date), b: r.doc, t: [r.text, r.sub].filter(Boolean).join(' – '), i: r.cents > 0 ? r.cents / 100 : null, o: r.cents < 0 ? -r.cents / 100 : null, s: r.balance / 100 });
    ws.addRow({ d: deD(monthEnd(m)), t: 'Endbestand', s: b.closing / 100 });
    for (const k of ['i', 'o', 's']) ws.getColumn(k).numFmt = '#,##0.00 "€"';
    ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    C.audit(req.user, 'Kassenbuch exportiert', `Kassenbuch ${c.name}, Monat ${deD(`${m}-01`).slice(3)}, als Excel`);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${encodeURIComponent(bookFile(c, m))}.xlsx"` }).send(Buffer.from(buf));
  }));

  /* ---------- Einnahmen-Überschuss-Rechnung je Sphäre (Geschäftsjahr) ---------- */
  function euer(year) {
    const r = C.geschaeftsjahr.range(year), list = gobd().postings(r.from, r.to), s = gobd().summary(list);
    const sp = Object.fromEntries([...SPH, ''].map(k => [k, { ein: [], aus: [], einSum: 0, ausSum: 0 }]));
    for (const k of s.keys) {
      if (k.art === 'neutral' || !k.cents) continue;
      const x = sp[k.sphere || ''];
      if (k.art === 'ausgabe') { x.aus.push({ label: k.label, cents: -k.cents, count: k.count }); x.ausSum -= k.cents; } else { x.ein.push({ label: k.label, cents: k.cents, count: k.count }); x.einSum += k.cents; }
    }
    for (const x of Object.values(sp)) { x.saldo = x.einSum - x.ausSum; x.ein.sort((a, b) => b.cents - a.cents); x.aus.sort((a, b) => b.cents - a.cents); }
    const vst = vorsteuer() ? db.prepare("SELECT COALESCE(SUM(vat),0) c FROM bh_expense WHERE status = 'aktiv' AND date BETWEEN ? AND ?").get(r.from, r.to).c : null;
    const warn = Object.entries(LIMITS).filter(([k, v]) => sp[k].einSum > v).map(([k, v]) => ({ sphere: k, limit: v }));
    return { year, label: C.geschaeftsjahr.label(year), from: r.from, to: r.to, spheres: sp, total: { ein: Object.values(sp).reduce((t, x) => t + x.einSum, 0), aus: Object.values(sp).reduce((t, x) => t + x.ausSum, 0) }, vorsteuer: vst, warn };
  }
  const yearOf = q => (int(q) >= 2000 && int(q) <= 2100 ? int(q) : C.geschaeftsjahr.yearOf(today()));
  admin.get('/euer', PR, (req, res) => res.json({ ...euer(yearOf(req.query.year)), names: gobd().SPHERES }));
  admin.get('/euer.xlsx', PR, ar(async (req, res) => {
    const e = euer(yearOf(req.query.year)), names = gobd().SPHERES;
    const Excel = C.require('exceljs'), wb = new Excel.Workbook(), ws = wb.addWorksheet('EÜR');
    ws.columns = [{ header: 'Bereich', key: 'a', width: 34 }, { header: 'Position', key: 'b', width: 52 }, { header: 'Betrag', key: 'c', width: 15 }];
    for (const k of [...SPH, '']) {
      const x = e.spheres[k]; if (!x.ein.length && !x.aus.length) continue;
      const n = names[k] || 'Ohne Sphäre';
      for (const i of x.ein) ws.addRow({ a: n, b: `Einnahme: ${i.label}`, c: i.cents / 100 });
      for (const i of x.aus) ws.addRow({ a: n, b: `Ausgabe: ${i.label}`, c: -i.cents / 100 });
      ws.addRow({ a: n, b: 'Überschuss', c: x.saldo / 100 }).font = { bold: true };
    }
    ws.addRow({ a: 'Gesamt', b: 'Überschuss', c: (e.total.ein - e.total.aus) / 100 }).font = { bold: true };
    if (e.vorsteuer != null) ws.addRow({ a: 'Hinweis', b: 'davon gezahlte Vorsteuer', c: e.vorsteuer / 100 });
    ws.getColumn('c').numFmt = '#,##0.00 "€"'; ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    C.audit(req.user, 'EÜR exportiert', e.label);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="EUER_${e.label.replace('/', '-')}.xlsx"` }).send(Buffer.from(buf));
  }));

  /* ---------------------------------------------------------------- Beispieldaten: Belegdateien (die Datenbank hat nur die Zeilen) */
  function png(w, hgt, draw) {   // kleines PNG ohne Bibliothek: Graustufen, Zeilenfilter 0
    const raw = Buffer.alloc((w + 1) * hgt);
    for (let y = 0; y < hgt; y++) { raw[y * (w + 1)] = 0; for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = draw(x, y); }
    const crc = b => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (~c) >>> 0; };
    const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cc]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(hgt, 4); ih[8] = 8; ih[9] = 0;
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  }
  async function demoBelege() {
    if (!C.getSetting('demo_build', '') || vault().locked()) return;
    const rows = db.prepare("SELECT * FROM bh_expense WHERE beleg_file LIKE 'demo!_%' ESCAPE '!'").all();
    for (const x of rows) {
      const f = path.join(DIR(), path.basename(x.beleg_file));
      if (fs.existsSync(f)) continue;
      let buf;
      if (/\.png$/.test(x.beleg_file)) {   // „Foto“ eines Kassenbons: helles Papier, Textzeilen als Balken
        const W = 360, H = 520, lines = 6 + (x.id % 7);
        buf = png(W, H, (px, py) => {
          if (px < 40 || px > W - 40 || py < 20 || py > H - 20) return 70 + ((px * 7 + py * 3) % 9);   // Tisch
          const ln = Math.floor((py - 50) / 26), inL = (py - 50) % 26 < 9;
          if (ln >= 0 && ln < lines + 3 && inL) { const len = ln === lines + 1 ? 120 : 90 + ((ln * 37 + x.id * 11) % 160); if (px > 60 && px < 60 + len) return 60; if (px > W - 110 && px < W - 60 && ln < lines) return 70; }
          return 238 - ((px + py) % 5);
        });
      } else {
        const PDF = C.require('pdfkit'), doc = new PDF({ size: 'A5', margin: 40, info: { Title: `Beleg ${x.no}` } }), parts = [];
        doc.on('data', p => parts.push(p)); const done = new Promise(r => doc.on('end', r));
        doc.fontSize(15).text(x.payee).moveDown(0.5).fontSize(10).text(`Rechnung zu ${x.purpose}`).text(`Datum: ${deD(x.date)}`).moveDown()
          .fontSize(12).text(`Betrag: ${euro(x.gross)}`).moveDown().fontSize(9).fillColor('#666').text('Beispielbeleg der Demo – erfundene Daten.');
        doc.end(); await done; buf = Buffer.concat(parts);
      }
      fs.mkdirSync(DIR(), { recursive: true, mode: 0o700 });
      vault().writeFile(f, buf);
      db.prepare('UPDATE bh_expense SET beleg_sha = ?, beleg_size = ?, beleg_mime = ? WHERE id = ?').run(sha256(buf), buf.length, /\.png$/.test(x.beleg_file) ? 'image/png' : 'application/pdf', x.id);
    }
    // Beispieldaten: der Vormonat der Hauptkasse ist festgeschrieben (Datumswerte werden beim Laden auf heute verschoben)
    const c = defCash(), m = addDays(`${today().slice(0, 7)}-01`, -1).slice(0, 7);
    if (c && c.start_date.slice(0, 7) <= m && !db.prepare('SELECT 1 FROM bh_cash_close WHERE cash_id = ?').get(c.id)) {
      for (let k = c.start_date.slice(0, 7); k <= m; k = nextMonth(k)) { const b = book(c, k); db.prepare('INSERT INTO bh_cash_close(cash_id, month, opening_cents, soll_cents, rows, closed_by) VALUES (?,?,?,?,?,?)').run(c.id, k, b.opening, b.closing, JSON.stringify(b.rows), 'Kassenwart'); }
    }
  }
  setImmediate(() => demoBelege().catch(e => console.error('Buchhaltung – Demo-Belege:', e.message)));

  /* ---------------------------------------------------------------- Hooks (server.js führt sie mit denen der Rechnungen zusammen) */
  const VIA = x => (x.paid_from === 'kasse' ? 'bar' : 'ueberweisung');
  const hooks = {
    gobdTables: () => [
      { table: 'bh_expense', date: 'date', paid: x => (x.status === 'aktiv' ? [{ cents: -x.gross, via: VIA(x), key: `aus.${x.type_id}`, date: x.date, text: x.purpose, doc: x.no, name: x.payee, bu: x.bu || '' }] : []) },
      { table: 'bh_cash_move', date: 'date', paid: m => (m.status !== 'aktiv' ? [] : m.kind === 'transit' ? [{ cents: m.cents, via: 'bar', key: 'kasse.transit', date: m.date, text: 'Geldtransit Kasse und Bank', doc: `K-${m.id}` }, { cents: -m.cents, via: 'ueberweisung', key: 'kasse.transit', date: m.date, text: 'Geldtransit Kasse und Bank', doc: `K-${m.id}` }]
        : m.kind === 'differenz' ? [{ cents: m.cents, via: 'bar', key: 'kasse.differenz', date: m.date, text: 'Kassendifferenz laut Kassensturz', doc: `K-${m.id}` }] : []) },
      { table: 'bh_cash_count', date: 'date' },
      { table: 'bh_cash_close', date: null, cols: ['id', 'cash_id', 'month', 'opening_cents', 'soll_cents', 'closed_by', 'closed_at'] },
      { table: 'bh_cash', date: null },
      { table: 'bh_expense_type', date: null },
    ],
    gobdKeys: () => [
      ...types().map(t => ({ key: `aus.${t.id}`, label: `Ausgabe: ${t.name}`, sphere: t.sphere, art: 'ausgabe' })),
      { key: 'kasse.differenz', label: 'Kassendifferenz (Kassensturz)', sphere: 'wgb', art: 'ausgabe' },
      { key: 'kasse.transit', label: 'Geldtransit Kasse und Bank', sphere: '', art: 'neutral' },
    ],
    paymentDebits: () => true,
    /* Kontoauszug: Abbuchung passt zu einer Ausgabe vom Bankkonto mit gleichem Betrag (±14 Tage) */
    paymentCandidates: entries => {
      const out = [];
      for (const e of entries) {
        if (e.kind !== 'abbuchung') continue;
        const list = db.prepare("SELECT * FROM bh_expense WHERE status = 'aktiv' AND paid_from = 'bank' AND bank_entry_id IS NULL AND gross = ? AND date BETWEEN ? AND ?").all(-e.cents, addDays(e.booking_date, -14), addDays(e.booking_date, 14));
        const word = String(e.name || '').toLowerCase().split(/[^a-zäöüß0-9]+/).find(w => w.length >= 4);
        for (const x of list) out.push({ entry: e.id, key: `a:${x.id}`, label: `Ausgabe ${x.no} – ${x.payee}`, cents: e.cents, debit: true,
          level: list.length === 1 && word && x.payee.toLowerCase().includes(word) ? 'sicher' : 'wahrscheinlich', note: `vom ${deD(x.date)}: ${x.purpose}` });
      }
      return out;
    },
    paymentTargets: () => db.prepare("SELECT * FROM bh_expense WHERE status = 'aktiv' AND paid_from = 'bank' AND bank_entry_id IS NULL ORDER BY date DESC LIMIT 200").all()
      .map(x => ({ key: `a:${x.id}`, label: x.payee, sub: `${x.no} vom ${deD(x.date)}`, cents: -x.gross, kind: 'ausgabe' })),
    applyPayment: (key, { entry: e }) => {
      const x = /^a:\d+$/.test(key) && db.prepare('SELECT * FROM bh_expense WHERE id = ?').get(Number(key.slice(2)));
      if (!x || x.status !== 'aktiv' || x.paid_from !== 'bank') throw fachlich('Diese Ausgabe gibt es nicht (mehr).');
      if (x.bank_entry_id) throw fachlich(`Ausgabe ${x.no} ist schon mit einer Abbuchung verknüpft.`);
      if (e.kind !== 'abbuchung' || -e.cents !== x.gross) throw fachlich(`Der Betrag passt nicht zu Ausgabe ${x.no} (${euro(x.gross)}).`);
      db.prepare('UPDATE bh_expense SET bank_entry_id = ?, account_id = ? WHERE id = ?').run(e.id, e.account_id, x.id);
      return { cents: e.cents, label: `Ausgabe ${x.no} – ${x.payee}`, ref: { id: x.id, entry: e.id } };
    },
    undoPayment: (key, ref) => {
      const x = ref && db.prepare('SELECT * FROM bh_expense WHERE id = ?').get(ref.id);
      if (!x || x.bank_entry_id !== ref.entry) throw fachlich(`Ausgabe ${x ? x.no : ''} wurde inzwischen geändert.`);
      db.prepare('UPDATE bh_expense SET bank_entry_id = NULL WHERE id = ?').run(x.id);
      return true;
    },
    probeCounts: () => [{ label: 'Ausgaben', n: db.prepare('SELECT COUNT(*) n FROM bh_expense').get().n }, { label: 'Kassenbewegungen', n: db.prepare('SELECT COUNT(*) n FROM bh_cash_move').get().n }],
    exportConfig: () => ({ expenseTypes: db.prepare('SELECT name, sphere, active, sort FROM bh_expense_type ORDER BY sort').all(), cashes: db.prepare('SELECT name, active FROM bh_cash ORDER BY id').all() }),
    importConfig: (data, z, konfigio) => {
      const T = new Map(db.prepare('SELECT * FROM bh_expense_type').all().map(t => [t.name.toLowerCase(), t])); let bad2 = 0;
      for (const t of konfigio.liste(data.expenseTypes, 200)) {
        const name = one(t && t.name, 60); if (name.length < 2) { bad2++; continue; }
        z('Ausgabearten', konfigio.schreibe(db, 'bh_expense_type', { name, sphere: SPH.includes(t.sphere) ? t.sphere : 'ideell', active: t.active === 0 ? 0 : 1, sort: int(t.sort) }, T.get(name.toLowerCase())));
      }
      const K = new Map(db.prepare('SELECT * FROM bh_cash').all().map(c => [c.name.toLowerCase(), c]));
      for (const c of konfigio.liste(data.cashes, 50)) {
        const name = one(c && c.name, 40); if (name.length < 2) { bad2++; continue; }
        const found = K.get(name.toLowerCase());
        if (found) { if (!found.is_default) db.prepare('UPDATE bh_cash SET active = ? WHERE id = ?').run(c.active === 0 && !balanceAt(found, today()) ? 0 : 1, found.id); z('Kassen', 'aktualisiert'); }
        else { db.prepare('INSERT INTO bh_cash(name, start_date, start_cents, active) VALUES (?,?,0,?)').run(name, today(), c.active === 0 ? 0 : 1); z('Kassen', 'neu'); }   // neue Kasse: Anfangsbestand 0 ab heute
      }
      return bad2;
    },
    privacyRecord: () => [{ title: 'Ausgaben und Kassenbuch', purpose: 'Ausgaben mit Beleg, Kassenbuch, Einnahmen-Überschuss-Rechnung', data: 'Empfänger, Betrag, Zweck, Belegfoto oder -PDF', persons: 'Lieferanten, Dienstleister, Übungsleiter', frist: 'Belege 8 Jahre, Bücher 10 Jahre (gesetzlich), nicht automatisch gelöscht' }],
    overview: () => {
      const m = addDays(`${today().slice(0, 7)}-01`, -1).slice(0, 7), out = [];
      for (const c of cashes().filter(x => x.active && x.start_date.slice(0, 7) <= m)) if (!db.prepare('SELECT 1 FROM bh_cash_close WHERE cash_id = ? AND month = ?').get(c.id, m))
        out.push({ level: 'a', text: `${c.name}: ${deD(`${m}-01`).slice(3)} ist noch nicht festgeschrieben.`, go: 'bh-kasse', link: 'Kassenbuch' });
      return out;
    },
  };
  return { hooks, euer, book, balanceAt, belegType };
};
module.exports.belegType = belegType;
module.exports.COINS = COINS;
