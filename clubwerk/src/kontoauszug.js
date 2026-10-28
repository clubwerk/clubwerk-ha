'use strict';
/* ---------- Kontoauszug einlesen und abgleichen (Plan: planung/kontoauszug.md) ----------
   Der Kern liest die Datei (kontoauszug-lesen.js), speichert jede Bankbuchung genau einmal und fragt die Module, wozu sie passt.
   Die Module buchen selbst – über dieselben Funktionen wie von Hand – und melden das über Hooks (alle synchron, laufen in der
   Transaktion des Kerns):
     paymentPerm()                         → Recht, das zum Zuordnen zusätzlich nötig ist (z. B. 'mitglieder_finanzen')
     paymentCandidates(entries)            → [{ entry, key, label, cents, level: 'sicher'|'wahrscheinlich'|'vielleicht', note, opts }]
     paymentTargets()                      → [{ key, label, sub, cents }] zum Zuordnen von Hand
     applyPayment(key, { entry, opts, user }) → { cents, label, ref } – wirft bei fachlichem Hindernis
     undoPayment(key, ref, { entry, user }) → wirft, wenn inzwischen etwas anderes passiert ist (Text sagt, was zuerst zurückzunehmen ist)
   Gespeichert werden nur Zahlungseingänge und Rücklastschriften (keine anderen Abbuchungen), Name, IBAN und Verwendungszweck
   liegen im Tresor. „Gehört nicht zu Clubwerk“ löscht der Datenschutz-Löschlauf (Vorgabe 90 Tage), die Datei selbst wird nie aufbewahrt. */
const crypto = require('crypto');
const { db, getSetting, setSetting, audit } = require('./db');
const { today, nowTs, addDays, euro, deD } = require('./util');
const lesen = require('./kontoauszug-lesen');
const bank = require('./bank');
const plugins = require('./plugins');

db.exec(`
CREATE TABLE IF NOT EXISTS bank_stmt (
  id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, format TEXT, file TEXT, period_from TEXT, period_to TEXT,
  total INTEGER NOT NULL DEFAULT 0, added INTEGER NOT NULL DEFAULT 0, by_user TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS bank_entry (
  id INTEGER PRIMARY KEY AUTOINCREMENT, stmt_id INTEGER, account_id INTEGER NOT NULL,
  uniq TEXT NOT NULL UNIQUE,                                   -- Bankreferenz (AcctSvcrRef) bzw. Prüfsumme des Inhalts + laufende Nummer
  ckey TEXT, has_ref INTEGER NOT NULL DEFAULT 0,               -- Prüfsumme des Inhalts: dieselbe Buchung aus CAMT-XML und aus einer CSV-Datei
  booking_date TEXT NOT NULL, value_date TEXT, cents INTEGER NOT NULL,
  kind TEXT NOT NULL,                                         -- eingang | ruecklastschrift
  name TEXT, iban TEXT, purpose TEXT,                         -- im Tresor
  e2e TEXT, batch_ref TEXT, mandate_ref TEXT, ret_code TEXT, orig_cents INTEGER, fee_cents INTEGER,
  sure INTEGER NOT NULL DEFAULT 1,                            -- 0 = allgemeines CSV: Rücklastschriften und Sammler nie „sicher“
  status TEXT NOT NULL DEFAULT 'offen',                       -- offen | zugeordnet | fremd
  assigned_cents INTEGER NOT NULL DEFAULT 0, done_by TEXT, done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_bank_entry_st ON bank_entry(status, booking_date);
CREATE INDEX IF NOT EXISTS ix_bank_entry_ck ON bank_entry(ckey);
CREATE TABLE IF NOT EXISTS bank_match (
  id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id INTEGER NOT NULL, module TEXT NOT NULL, key TEXT NOT NULL, label TEXT, cents INTEGER NOT NULL, ref TEXT,
  by_user TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), undone_at TEXT, undone_by TEXT
);
CREATE INDEX IF NOT EXISTS ix_bank_match_e ON bank_match(entry_id);
`);

const fachlich = msg => Object.assign(new Error(msg), { fachlich: true });
const uname = u => (u ? u.name || u.username : null);
const LEVEL = { sicher: 0, wahrscheinlich: 1, vielleicht: 2 };

/* ---------- Module ---------- */
const mods = () => plugins.withHook('paymentCandidates').filter(p => typeof p.hooks.applyPayment === 'function');
const permOf = p => { try { return p.hooks.paymentPerm ? p.hooks.paymentPerm() : null; } catch (e) { return null; } };
const allowed = user => mods().filter(p => { const pm = permOf(p); return !pm || user.perms.includes(pm); });
const modById = (user, id) => allowed(user).find(p => p.meta.id === id);

/** Vorschläge aller erlaubten Module für offene Buchungen → Map(entryId → [Vorschlag]) */
function candidates(user, entries) {
  const out = new Map(entries.map(e => [e.id, []]));
  if (!entries.length) return out;
  for (const p of allowed(user)) {
    let list = [];
    try { list = p.hooks.paymentCandidates(entries) || []; } catch (e) { console.error(`Kontoauszug – Vorschläge (${p.meta.id}):`, e.message); }
    for (const c of list) if (c && out.has(c.entry) && LEVEL[c.level] !== undefined) out.get(c.entry).push({ module: p.meta.id, moduleName: p.meta.name, key: String(c.key), label: String(c.label || ''), cents: Number(c.cents) || 0, level: c.level, note: c.note || '', opts: c.opts || {} });
  }
  for (const l of out.values()) l.sort((a, b) => LEVEL[a.level] - LEVEL[b.level]);
  return out;
}
function targets(user) {
  const out = [];
  for (const p of allowed(user)) {
    if (typeof p.hooks.paymentTargets !== 'function') continue;
    try { for (const t of p.hooks.paymentTargets() || []) out.push({ module: p.meta.id, moduleName: p.meta.name, key: String(t.key), label: String(t.label || ''), sub: t.sub || '', cents: Number(t.cents) || 0, kind: t.kind || '' }); }
    catch (e) { console.error(`Kontoauszug – Ziele (${p.meta.id}):`, e.message); }
  }
  return out;
}

/* ---------- Einlesen ---------- */
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const accountByIban = iban => bank.list().find(a => a.iban === iban) || null;
/** Datei einlesen → Zusammenfassung; derselbe Auszug zweimal ändert nichts */
async function upload(buf, { name, accountId, map, user }) {
  const file = String(name || 'Kontoauszug').replace(/[^\w.\- äöüÄÖÜß()]/g, '_').slice(0, 120);
  let csv = null;
  if (map) {
    const acc = bank.get(accountId);
    if (!acc || !acc.active) throw fachlich('Bitte das Vereinskonto wählen, zu dem die CSV-Datei gehört.');
    csv = { map, iban: acc.iban };
  }
  let r = await lesen.read(buf, { name: file, csv });
  if (r.kind === 'csv' && !r.results) {
    // allgemeines CSV: gemerkte Spaltenzuordnung (je Aufbau der Kopfzeile) verwenden, sonst nachfragen
    const saved = (() => { try { return JSON.parse(getSetting(`ka_csv_${sha(r.layout.sig).slice(0, 16)}`, '') || 'null'); } catch (e) { return null; } })();
    const acc = saved && bank.get(saved.account);
    if (!saved || !acc || !acc.active) return { needMapping: true, layout: r.layout, accounts: bank.list().map(a => ({ id: a.id, name: a.name, iban: bank.maskIban(a.iban) })) };
    r = await lesen.read(buf, { name: file, csv: { map: saved.map, iban: acc.iban } });
    r.usedSaved = true;
  }
  if (r.kind === 'csv' && map) setSetting(`ka_csv_${sha(r.results[0].sig).slice(0, 16)}`, JSON.stringify({ map, account: Number(accountId) }));
  // Konten prüfen: nur Vereinskonten aus Einstellungen › Bankkonten
  const parts = [];
  for (const f of r.results) for (const a of f.accounts) {
    const acc = accountByIban(a.iban);
    if (!acc) throw fachlich(a.iban ? `Das Konto ${bank.maskIban(a.iban)} ist kein Vereinskonto. Bitte zuerst unter Einstellungen › Bankkonten eintragen.` : 'In der Datei steht keine IBAN des Kontos.');
    parts.push({ f, a, acc });
  }
  const sum = { files: r.results.length, format: [...new Set(r.results.map(f => f.format))].join(', '), total: 0, added: 0, dup: 0, pending: 0, debits: 0, returns: 0, accounts: [...new Set(parts.map(p => p.acc.name))], from: '', to: '', savedMap: Boolean(r.usedSaved) };
  db.transaction(() => {
    for (const { f, a, acc } of parts) {
      sum.pending += a.pending; sum.debits += a.debits;
      const stmt = Number(db.prepare('INSERT INTO bank_stmt(account_id, format, file, period_from, period_to, total, by_user) VALUES (?,?,?,?,?,?,?)')
        .run(acc.id, f.format, f.name || file, a.from || null, a.to || null, a.entries.length, uname(user)).lastInsertRowid);
      // Schutz gegen doppeltes Einlesen: mit Bankreferenz (CAMT-XML) über diese, sonst über den Inhalt (Tag, Betrag, Gegen-IBAN,
      // End-to-End-Referenz, Verwendungszweck) mit laufender Nummer je gleichem Inhalt in der Datei. Dieselbe Buchung aus XML und aus
      // einer CSV-Datei erkennt der Inhalt (ckey) – nur zwischen Buchungen mit und ohne Bankreferenz, sonst gilt die eigene Referenz.
      const seenU = new Map(), seenC = new Map();
      const count = (m, k) => { const n = (m.get(k) || 0) + 1; m.set(k, n); return n; };
      let added = 0;
      for (const e of a.entries) {
        const content = sha([acc.iban, e.date, e.cents, e.iban, e.e2e, String(e.purpose || '').toUpperCase().replace(/[^A-Z0-9]/g, '')].join('|')).slice(0, 40);
        const hasRef = Boolean(e.bankRef);
        const ub = hasRef ? sha([acc.iban, e.bankRef, e.txRef || ''].join('|')).slice(0, 40) : content;
        const uniq = `${ub}#${count(seenU, ub)}`, ckey = `${content}#${count(seenC, content)}`;
        sum.total++;
        if (db.prepare('SELECT 1 FROM bank_entry WHERE uniq = ?').get(uniq) || db.prepare('SELECT 1 FROM bank_entry WHERE ckey = ? AND has_ref != ?').get(ckey, hasRef ? 1 : 0)) { sum.dup++; continue; }
        db.prepare(`INSERT INTO bank_entry(stmt_id, account_id, uniq, ckey, has_ref, booking_date, value_date, cents, kind, name, iban, purpose, e2e, batch_ref, mandate_ref, ret_code, orig_cents, fee_cents, sure)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(stmt, acc.id, uniq, ckey, hasRef ? 1 : 0, e.date, e.valDate || null, e.cents, e.ret ? 'ruecklastschrift' : 'eingang',
          String(e.name || '').slice(0, 140) || null, e.iban || null, String(e.purpose || '').slice(0, 500) || null, e.e2e || null, e.batch || null, e.mandate || null,
          e.ret ? e.ret.code || null : null, e.ret ? e.ret.origCents : null, e.ret ? e.ret.feeCents || 0 : null, e.sure ? 1 : 0);
        added++; if (e.ret) sum.returns++;
        const d = e.date;
        if (!sum.from || d < sum.from) sum.from = d;
        if (!sum.to || d > sum.to) sum.to = d;
      }
      db.prepare('UPDATE bank_stmt SET added = ? WHERE id = ?').run(added, stmt);
      sum.added += added;
      if (a.from && (!sum.from || a.from < sum.from)) sum.from = a.from;
      if (a.to && (!sum.to || a.to > sum.to)) sum.to = a.to;
    }
  })();
  audit(user, 'Kontoauszug eingelesen', `${sum.accounts.join(', ')}: ${sum.added} ${sum.added === 1 ? 'Buchung' : 'Buchungen'} neu${sum.dup ? `, ${sum.dup} schon eingelesen` : ''} (${sum.format}${sum.from ? `, ${deD(sum.from)}–${deD(sum.to)}` : ''})`);
  return sum;
}

/* ---------- Anzeigen ---------- */
const entryView = e => ({ id: e.id, account_id: e.account_id, date: e.booking_date, value_date: e.value_date, cents: e.cents, kind: e.kind, name: e.name || '', iban: e.iban ? bank.maskIban(e.iban) : '',
  purpose: e.purpose || '', ret_code: e.ret_code, orig_cents: e.orig_cents, fee_cents: e.fee_cents, sure: Boolean(e.sure), status: e.status, assigned_cents: e.assigned_cents, done_by: e.done_by, done_at: e.done_at });
const openEntries = () => db.prepare("SELECT * FROM bank_entry WHERE status = 'offen' ORDER BY booking_date DESC, id DESC LIMIT 2000").all();
function status() {
  const last = db.prepare('SELECT MAX(COALESCE(period_to, created_at)) t, MAX(created_at) at FROM bank_stmt').get();
  const n = db.prepare("SELECT status, COUNT(*) n FROM bank_entry GROUP BY status").all().reduce((m, r) => ({ ...m, [r.status]: r.n }), {});
  return { last: last && last.at ? { to: String(last.t).slice(0, 10), at: last.at } : null, counts: { offen: n.offen || 0, zugeordnet: n.zugeordnet || 0, fremd: n.fremd || 0 } };
}
function list(user, tab) {
  const accName = id => (bank.get(id) || {}).name || '';
  if (tab === 'zugeordnet') {
    const rows = db.prepare("SELECT * FROM bank_entry WHERE status = 'zugeordnet' ORDER BY done_at DESC, id DESC LIMIT 500").all();
    const m = db.prepare('SELECT * FROM bank_match WHERE entry_id = ? AND undone_at IS NULL ORDER BY id');
    return rows.map(e => ({ ...entryView(e), account: accName(e.account_id), matches: m.all(e.id).map(x => ({ module: x.module, label: x.label, cents: x.cents, by: x.by_user, at: x.created_at })) }));
  }
  if (tab === 'fremd') return db.prepare("SELECT * FROM bank_entry WHERE status = 'fremd' ORDER BY booking_date DESC, id DESC LIMIT 500").all().map(e => ({ ...entryView(e), account: accName(e.account_id) }));
  const open = openEntries();
  const c = candidates(user, open);
  return open.map(e => ({ ...entryView(e), account: accName(e.account_id), cands: c.get(e.id) || [] }));
}

/* ---------- Zuordnen ---------- */
function applyOne(user, entryId, { module, key, opts }, { manual = true } = {}) {
  const e = db.prepare('SELECT * FROM bank_entry WHERE id = ?').get(entryId);
  if (!e) throw fachlich('Diese Buchung gibt es nicht mehr.');
  if (e.status !== 'offen') throw fachlich(e.status === 'zugeordnet' ? 'Diese Buchung ist schon zugeordnet.' : 'Diese Buchung ist als „gehört nicht zu Clubwerk“ markiert.');
  const p = modById(user, String(module || ''));
  if (!p) throw fachlich('Dafür fehlt dir die Berechtigung (oder das Modul ist ausgeschaltet).');
  // Nur echte Vorschläge oder Ziele zum Zuordnen von Hand – nie beliebige Schlüssel
  const cand = (candidates(user, [e]).get(e.id) || []).find(c => c.module === p.meta.id && c.key === String(key));
  const ok = cand || (manual && targets(user).some(t => t.module === p.meta.id && t.key === String(key)));
  if (!ok) throw fachlich('Dieser Vorschlag passt nicht mehr – bitte die Liste neu laden.');
  const o = { ...(cand ? cand.opts : {}), ...(opts && typeof opts === 'object' ? opts : {}) };
  let res;
  db.transaction(() => {
    res = p.hooks.applyPayment(String(key), { entry: e, opts: o, user: uname(user) });
    if (!res || !Number.isInteger(res.cents)) throw fachlich('Zuordnung fehlgeschlagen.');
    if (Math.abs(res.cents) > Math.abs(e.cents)) throw fachlich('Es würde mehr zugeordnet, als die Buchung hergibt.');
    db.prepare('INSERT INTO bank_match(entry_id, module, key, label, cents, ref, by_user) VALUES (?,?,?,?,?,?,?)').run(e.id, p.meta.id, String(key), String(res.label || '').slice(0, 300), res.cents, JSON.stringify(res.ref || null), uname(user));
    db.prepare("UPDATE bank_entry SET status = 'zugeordnet', assigned_cents = ?, done_by = ?, done_at = ? WHERE id = ? AND status = 'offen'").run(res.cents, uname(user), nowTs(), e.id);
  })();
  audit(user, res.ref && res.ref.link ? 'Kontoauszug: verknüpft (schon gebucht)' : e.kind === 'ruecklastschrift' ? 'Kontoauszug: Rücklastschrift gebucht' : 'Kontoauszug: Zahlung zugeordnet', `${deD(e.booking_date)} ${euro(e.cents)} → ${res.label}${res.cents !== Math.abs(e.cents) && e.kind !== 'ruecklastschrift' ? ` (${euro(res.cents)})` : ''}`);
  return { ok: true, label: res.label, cents: res.cents };
}
/** „Alle sicheren übernehmen“: Buchungen mit genau einem sicheren Vorschlag */
function applySafe(user) {
  // der Reihe nach wie auf dem Konto: erst Eingänge (Lastschrift-Gutschrift), dann Rücklastschriften
  const open = openEntries().sort((a, b) => (a.kind === 'ruecklastschrift') - (b.kind === 'ruecklastschrift') || a.booking_date.localeCompare(b.booking_date) || a.id - b.id);
  const c = candidates(user, open);
  let n = 0, cents = 0; const errors = [];
  for (const e of open) {
    const safe = (c.get(e.id) || []).filter(x => x.level === 'sicher');
    if (safe.length !== 1) continue;
    try { const r = applyOne(user, e.id, safe[0], { manual: false }); n++; cents += Math.abs(r.cents); } catch (err) { if (!err.fachlich) throw err; errors.push(`${deD(e.booking_date)} ${euro(e.cents)}: ${err.message}`); }
  }
  return { ok: true, count: n, cents, errors };
}
function undo(user, entryId) {
  const e = db.prepare('SELECT * FROM bank_entry WHERE id = ?').get(entryId);
  if (!e || e.status !== 'zugeordnet') throw fachlich('Diese Buchung ist nicht zugeordnet.');
  const ms = db.prepare('SELECT * FROM bank_match WHERE entry_id = ? AND undone_at IS NULL ORDER BY id DESC').all(e.id);
  for (const m of ms) if (!modById(user, m.module)) throw fachlich('Dafür fehlt dir die Berechtigung (oder das Modul ist ausgeschaltet).');
  db.transaction(() => {
    for (const m of ms) {
      const p = modById(user, m.module);
      if (typeof p.hooks.undoPayment !== 'function') throw fachlich('Diese Zuordnung lässt sich nicht aufheben.');
      p.hooks.undoPayment(m.key, JSON.parse(m.ref || 'null'), { entry: e, user: uname(user) });
      db.prepare('UPDATE bank_match SET undone_at = ?, undone_by = ? WHERE id = ?').run(nowTs(), uname(user), m.id);
    }
    db.prepare("UPDATE bank_entry SET status = 'offen', assigned_cents = 0, done_by = NULL, done_at = NULL WHERE id = ?").run(e.id);
  })();
  audit(user, 'Kontoauszug: Zuordnung aufgehoben', `${deD(e.booking_date)} ${euro(e.cents)}: ${ms.map(m => m.label).join('; ')}`);
  return { ok: true };
}
function setForeign(user, entryId, on) {
  const e = db.prepare('SELECT * FROM bank_entry WHERE id = ?').get(entryId);
  if (!e) throw fachlich('Diese Buchung gibt es nicht mehr.');
  if (on && e.status !== 'offen') throw fachlich('Nur offene Buchungen lassen sich so markieren.');
  if (!on && e.status !== 'fremd') throw fachlich('Diese Buchung ist nicht als „gehört nicht zu Clubwerk“ markiert.');
  db.prepare('UPDATE bank_entry SET status = ?, done_by = ?, done_at = ? WHERE id = ?').run(on ? 'fremd' : 'offen', on ? uname(user) : null, on ? nowTs() : null, e.id);
  audit(user, on ? 'Kontoauszug: gehört nicht zu Clubwerk' : 'Kontoauszug: wieder zu prüfen', `${deD(e.booking_date)} ${euro(e.cents)}`);
  return { ok: true };
}

/* ---------- Löschfrist (Einstellungen › Datenschutz, src/datenschutz.js): „gehört nicht zu Clubwerk“ vor cut löschen ---------- */
const foreignOlder = cut => db.prepare("SELECT COUNT(*) n FROM bank_entry WHERE status = 'fremd' AND done_at < ?").get(cut).n;
const purge = cut => db.prepare("DELETE FROM bank_entry WHERE status = 'fremd' AND done_at < ?").run(cut).changes;

/* ---------- Schnittstelle der Verwaltung ---------- */
function routes(admin, { need, bad, int, asyncRoute, rateLimit, express }) {
  const P = need('kontoauszug');
  const run = fn => (req, res) => { try { res.json(fn(req)); } catch (e) { if (e.fachlich) return bad(res, e.message); throw e; } };
  admin.get('/kontoauszug/status', need('kontoauszug', 'mitglieder_finanzen', 'buchhaltung'), (req, res) => res.json(status()));
  admin.get('/kontoauszug', P, (req, res) => res.json({ ...status(), modules: allowed(req.user).map(p => ({ id: p.meta.id, name: p.meta.name })), accounts: bank.list().map(a => ({ id: a.id, name: a.name, iban: bank.maskIban(a.iban) })) }));
  admin.get('/kontoauszug/entries', P, run(req => list(req.user, String(req.query.tab || 'offen'))));
  admin.get('/kontoauszug/targets', P, run(req => targets(req.user)));
  admin.post('/kontoauszug/upload', P, rateLimit('kaupload', 60, 10 * 60000), express.raw({ type: () => true, limit: '5mb' }), asyncRoute(async (req, res) => {
    if (require('./vault').locked()) return res.status(423).json({ error: 'Die persönlichen Daten sind nach einem Neustart noch verschlossen. Sie öffnen sich, sobald sich ein Admin mit Schlüssel anmeldet.', vaultLocked: true });
    let map = null;
    if (req.query.map) { try { map = JSON.parse(String(req.query.map)); } catch (e) { return bad(res, 'Spaltenzuordnung ungültig.'); } }
    try { res.json(await upload(req.body, { name: req.query.name, accountId: int(req.query.account), map, user: req.user })); }
    catch (e) { if (e.fachlich) return bad(res, e.message); throw e; }
  }));
  admin.post('/kontoauszug/entries/:id/assign', P, run(req => applyOne(req.user, int(req.params.id), req.body || {})));
  admin.post('/kontoauszug/assign-safe', P, run(req => applySafe(req.user)));
  admin.post('/kontoauszug/entries/:id/undo', P, run(req => undo(req.user, int(req.params.id))));
  admin.post('/kontoauszug/entries/:id/ignore', P, run(req => setForeign(req.user, int(req.params.id), true)));
  admin.post('/kontoauszug/entries/:id/reopen', P, run(req => setForeign(req.user, int(req.params.id), false)));
}

module.exports = { routes, status, foreignOlder, purge, upload };
