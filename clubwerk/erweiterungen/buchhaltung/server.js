'use strict';
/* =====================================================================================================
   Modul „Buchhaltung“ (erste Ausbaustufe)
   1. Rechnungen an Firmen/Sponsoren (z. B. Bandenwerbung) und an Mitglieder – Umsatzsteuer je Position, fortlaufende Nummer,
      offen/bezahlt, Zahlungserinnerung per E-Mail. Firmen werden einmal angelegt, mit ihren jährlichen Positionen →
      „Jahresrechnungen erstellen“ für alle Sponsoren auf einmal. Rechnungen an Mitglieder landen (mit aktiver Mitgliederverwaltung)
      zusätzlich als offener Posten beim Mitglied und können so per Lastschrift eingezogen werden.
   2. Spendenquittungen (Zuwendungsbestätigungen nach amtlichem Muster): Geldspende, Sachspende, Verzicht auf Aufwandserstattung –
      für Mitglieder, Firmen oder einmalige Spender.
   ===================================================================================================== */
const pdf = require('./lib/pdf');

let C, db;
const VATS = [0, 7, 19];
const { pad, today, isDate, addDays, deD, euro } = require('../../src/util');   // gemeinsame Helfer des Kerns (auch als ctx.util)
const txt = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
const one = (v, max) => txt(v, max).replace(/[\r\n]+/g, ' ');
const mailOk = v => !v || /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i.test(String(v));
const J = (v, d) => { try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };

function createTables() {
  db.exec(`
CREATE TABLE IF NOT EXISTS bh_partner (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, contact TEXT, street TEXT, zip TEXT, city TEXT, country TEXT, email TEXT, phone TEXT, vat_id TEXT, customer_no TEXT,
  items TEXT NOT NULL DEFAULT '[]',          -- jährliche Rechnungspositionen [{ text, qty, unit_cents, vat }]
  note TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS bh_invoice (
  id INTEGER PRIMARY KEY, no TEXT NOT NULL UNIQUE, year INTEGER NOT NULL, kind TEXT NOT NULL,      -- partner | member
  partner_id INTEGER, member_id INTEGER, recipient TEXT NOT NULL, date TEXT NOT NULL, due_date TEXT, period TEXT, intro TEXT, note TEXT,
  items TEXT NOT NULL, net INTEGER NOT NULL, vat INTEGER NOT NULL, gross INTEGER NOT NULL, small_business INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'offen',                                                            -- offen | bezahlt | storniert
  paid_at TEXT, paid_via TEXT, sent_at TEXT, reminders INTEGER NOT NULL DEFAULT 0, reminded_at TEXT, charge_id INTEGER, yearly INTEGER,
  cancel_reason TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_bh_inv ON bh_invoice(status, due_date);
CREATE TABLE IF NOT EXISTS bh_donation (
  id INTEGER PRIMARY KEY, no TEXT NOT NULL UNIQUE, year INTEGER NOT NULL, donor_type TEXT NOT NULL,  -- member | partner | einmalig
  member_id INTEGER, partner_id INTEGER, donor TEXT NOT NULL, kind TEXT NOT NULL,                     -- geld | sach | verzicht
  date TEXT NOT NULL, cents INTEGER NOT NULL, item TEXT, sach_origin TEXT, sach_docs INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aktiv', sent_at TEXT, cancel_reason TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);`);
  const cols = t => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
  if (!cols('bh_partner').includes('department_id')) db.exec('ALTER TABLE bh_partner ADD COLUMN department_id INTEGER');
  const ic = cols('bh_invoice');
  if (!ic.includes('department_id')) db.exec('ALTER TABLE bh_invoice ADD COLUMN department_id INTEGER');
  if (!ic.includes('account_id')) db.exec('ALTER TABLE bh_invoice ADD COLUMN account_id INTEGER');
  if (!ic.includes('bank')) db.exec('ALTER TABLE bh_invoice ADD COLUMN bank TEXT');   // Bankverbindung zum Zeitpunkt der Rechnung (bleibt so, auch wenn das Konto später geändert wird)
}

/* ---------------------------------------------------------------- Einstellungen */
const DEF = { street: '', city: '', tax_no: '', vat_id: '', phone: '', email: '', vat_default: '19', small_business: '0', inv_prefix: 'R-', due_days: '14',
  footer: '', intro: '', don_prefix: 'SQ-', finanzamt: '', fa_tax_no: '', bescheid_type: 'freistellung', bescheid_date: '', veranlagungszeitraum: '',
  zwecke: 'des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)', signer: '', signer_role: 'Vorsitzende/r', place: '' };
const S = k => C.setting(k, DEF[k] != null ? DEF[k] : '');
const mvSync = (name, ...a) => { const x = C.callHooksSync(name, ...a).find(y => y.id === 'mitglieder'); return x ? x.result : null; };   // null ohne Mitgliederverwaltung
function settings() {
  const o = Object.fromEntries(Object.keys(DEF).map(k => [k, S(k)]));
  o.small_business = o.small_business === '1'; o.vat_default = Number(o.vat_default) || 0; o.due_days = Number(o.due_days) || 14;
  const ci = mvSync('clubInfo') || {};
  o.fallback = { street: ci.street || '', city: ci.city || '' };   // Vorgabe aus der Mitgliederverwaltung
  return o;
}
/** Bankverbindung als Momentaufnahme für eine Rechnung */
const snap = a => (a ? { id: a.id, name: a.name, holder: a.holder || '', iban: a.iban, bic: a.bic || '', bank: a.bank || '' } : null);
function club(acc) {
  const s = settings(), f = s.fallback;
  const a = acc || snap(C.bank.def()) || {};
  return { name: C.getSetting('club_name', 'Verein'), street: s.street || f.street, city: s.city || f.city, iban: a.iban || '', bic: a.bic || '', bank: a.bank || '', holder: a.holder || '',
    tax_no: s.tax_no, vat_id: s.vat_id, phone: s.phone, email: s.email, footer: s.footer,
    finanzamt: s.finanzamt, fa_tax_no: s.fa_tax_no, bescheid_type: s.bescheid_type, bescheid_date: s.bescheid_date, veranlagungszeitraum: s.veranlagungszeitraum, zwecke: s.zwecke,
    signer: s.signer, signer_role: s.signer_role, place: s.place || String(s.city || f.city || '').replace(/^\d{4,5}\s*/, '') };
}

/* ---------------------------------------------------------------- Helfer */
function cleanItems(raw) {
  const out = [];
  for (const it of (Array.isArray(raw) ? raw : []).slice(0, 40)) {
    const text = txt(it && it.text, 300); if (!text) continue;
    const qty = Math.round(Number(String(it.qty == null ? 1 : it.qty).replace(',', '.')) * 100) / 100;
    const unit = Math.round(Number(it.unit_cents));
    const vat = VATS.includes(Number(it.vat)) ? Number(it.vat) : 0;
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) throw new Error(`„${text}“: Menge prüfen.`);
    if (!Number.isFinite(unit) || Math.abs(unit) > 100000000) throw new Error(`„${text}“: Betrag prüfen.`);
    out.push({ text, qty, unit_cents: unit, vat });
  }
  return out;
}
/** Summen: Positionen sind Netto-Beträge; USt je Satz auf die Summe des Satzes gerundet */
function totals(items, smallBusiness) {
  const by = {};
  let net = 0;
  for (const it of items) { const line = Math.round(it.qty * it.unit_cents); net += line; const v = smallBusiness ? 0 : it.vat; by[v] = (by[v] || 0) + line; }
  const vat = smallBusiness ? 0 : Object.entries(by).reduce((s, [r, n]) => s + Math.round(n * Number(r) / 100), 0);
  return { net, vat, gross: net + vat };
}
function nextNo(table, prefix, year) {
  const pre = `${prefix}${year}-`;
  const last = db.prepare(`SELECT no FROM ${table} WHERE no LIKE ? ORDER BY length(no) DESC, no DESC LIMIT 1`).get(pre.replace(/[%_]/g, '\\$&') + '%');
  const n = last ? (parseInt(last.no.slice(pre.length), 10) || 0) + 1 : 1;
  return pre + pad(n, 4);
}
const departments = () => (mvSync('departments') || []).filter(d => d.active).map(d => ({ id: d.id, name: d.name }));
const partnerRow = id => db.prepare('SELECT * FROM bh_partner WHERE id = ?').get(id);
async function memberAddr(id) {
  const r = (await C.callHooks('memberAddress', id)).find(x => x.result);
  if (r) return r.result;
  const m = db.prepare("SELECT id, name FROM members WHERE id = ? AND kind = 'mitglied'").get(id);
  return m ? { id: m.id, name: m.name } : null;
}
const addrOfPartner = p => ({ name: p.name, contact: p.contact || '', street: p.street || '', zip: p.zip || '', city: p.city || '', country: p.country || '', email: p.email || '' });
const addrOfMember = m => ({ name: m.name, street: m.street || '', zip: m.zip || '', city: m.city || '', country: m.country && m.country !== 'Deutschland' ? m.country : '', email: m.email || '', member_no: m.member_no || '' });

function invView(r) {
  const today0 = today();
  return { ...r, recipient: J(r.recipient, {}), items: J(r.items, []), bank: J(r.bank, null), small_business: Boolean(r.small_business), overdue: r.status === 'offen' && r.due_date && r.due_date < today0 };
}
/** Rechnungen an Mitglieder: Status aus der Mitgliederverwaltung übernehmen (dort wird per Lastschrift/Zahlung gebucht) */
async function syncMemberInvoices() {
  const rows = db.prepare("SELECT id, charge_id FROM bh_invoice WHERE kind = 'member' AND charge_id IS NOT NULL AND status = 'offen'").all();
  if (!rows.length) return;
  const r = (await C.callHooks('chargeStatus', rows.map(x => x.charge_id))).find(x => x.id === 'mitglieder');
  if (!r || !r.result) return;
  for (const x of rows) {
    const st = r.result[x.charge_id];
    if (st && st.status === 'bezahlt') db.prepare("UPDATE bh_invoice SET status = 'bezahlt', paid_at = ?, paid_via = 'Mitgliederverwaltung' WHERE id = ?").run(st.paid_at || today(), x.id);
    else if (st && st.status === 'storniert') db.prepare("UPDATE bh_invoice SET status = 'storniert', cancel_reason = 'in der Mitgliederverwaltung storniert' WHERE id = ?").run(x.id);
  }
}
function pdfInvoice(inv, { title } = {}) {
  const v = invView(inv);
  const reminder = Boolean(title);
  const note = [v.status === 'storniert' ? `Diese Rechnung wurde storniert${v.cancel_reason ? ` (${v.cancel_reason})` : ''} und ist nicht zu bezahlen.` : '', reminder ? '' : v.note].filter(Boolean).join('\n\n');
  return pdf.invoice(club(v.bank), { no: v.no, date: v.date, due_date: v.due_date, period: v.period, title: title || 'Rechnung', recipient: v.recipient,
    customer_no: v.recipient.member_no || (v.partner_id ? (partnerRow(v.partner_id) || {}).customer_no : '') || '', items: v.items, small_business: v.small_business,
    intro: reminder ? '' : v.intro, note, direct_debit: Boolean(v.kind === 'member' && v.charge_id && v.recipient.payment === 'lastschrift') });
}
function pdfDonation(d) {
  return pdf.donation(club(), { no: d.no, kind: d.kind, donor: J(d.donor, {}), cents: d.cents, date: d.date, item: d.item, sach_origin: d.sach_origin, sach_docs: Boolean(d.sach_docs) });
}
const fileName = (pre, no) => `${pre}_${String(no).replace(/[^\w-]+/g, '_')}.pdf`;

/* ---------------------------------------------------------------- Aktivierung */
function activate(ctx) {
  C = ctx; db = ctx.db;
  createTables();
  const { need, bad, int } = ctx;
  const P = need('buchhaltung');
  const admin = ctx.admin;
  const ar = fn => ctx.asyncRoute(fn);
  const uname = req => req.user.name || req.user.username;

  /* ---------- Übersicht ---------- */
  admin.get('/meta', P, ar(async (req, res) => {
    await syncMemberInvoices();
    const y = Number(today().slice(0, 4));
    const sum = (where, ...a) => db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(gross),0) c FROM bh_invoice WHERE ${where}`).get(...a);
    const members = db.prepare("SELECT m.id, m.name, m.active FROM members m WHERE m.kind = 'mitglied' ORDER BY m.active DESC, name_key(m.name, m.kind)").all();
    const nos = mvSync('memberNumbers') || {};
    res.json({ today: today(), year: y, settings: settings(), mv: ctx.isModuleActive('mitglieder'), mail: ctx.mail.ready(),
      kpis: { open: sum("status = 'offen'"), overdue: sum("status = 'offen' AND due_date < ?", today()), paidYear: sum("status = 'bezahlt' AND year = ?", y),
        donations: db.prepare("SELECT COUNT(*) n, COALESCE(SUM(cents),0) c FROM bh_donation WHERE status = 'aktiv' AND year = ?").get(y) },
      partners: db.prepare('SELECT id, name, active, department_id FROM bh_partner ORDER BY active DESC, name COLLATE NOCASE').all(),
      accounts: C.bank.list().map(a => ({ id: a.id, name: a.name, iban: a.iban, is_default: a.is_default, departments: a.departments })), departments: departments(),
      members: members.map(m => ({ id: m.id, name: m.name, active: m.active, member_no: nos[m.id] || null })),
      donationReady: Boolean(S('finanzamt') && S('fa_tax_no') && S('bescheid_date') && S('zwecke')) });
  }));

  /* ---------- Einstellungen ---------- */
  admin.get('/settings', P, (req, res) => res.json(settings()));
  admin.put('/settings', P, (req, res) => {
    const b = req.body || {}; const err = [];
    const before = settings();
    for (const k of ['street', 'city', 'tax_no', 'vat_id', 'phone', 'finanzamt', 'fa_tax_no', 'veranlagungszeitraum', 'signer', 'signer_role', 'place']) if (b[k] !== undefined) C.setSetting2(k, one(b[k], 120));
    for (const k of ['footer', 'intro', 'zwecke']) if (b[k] !== undefined) C.setSetting2(k, txt(b[k], 600));
    if (b.email !== undefined) { if (!mailOk(one(b.email, 120))) err.push('Die E-Mail-Adresse ist ungültig.'); else C.setSetting2('email', one(b.email, 120)); }
    if (b.vat_default !== undefined) C.setSetting2('vat_default', String(VATS.includes(Number(b.vat_default)) ? Number(b.vat_default) : 19));
    if (b.small_business !== undefined) C.setSetting2('small_business', b.small_business ? '1' : '0');
    if (b.due_days !== undefined) C.setSetting2('due_days', String(Math.max(0, Math.min(120, int(b.due_days)))));
    for (const k of ['inv_prefix', 'don_prefix']) if (b[k] !== undefined) C.setSetting2(k, String(b[k]).replace(/[^A-Za-z0-9-]/g, '').slice(0, 8));
    if (b.bescheid_type !== undefined) C.setSetting2('bescheid_type', b.bescheid_type === 'feststellung' ? 'feststellung' : 'freistellung');
    if (b.bescheid_date !== undefined) { if (b.bescheid_date && !isDate(b.bescheid_date)) err.push('Das Datum des Bescheids ist ungültig.'); else C.setSetting2('bescheid_date', b.bescheid_date || ''); }
    { const L = { street: 'Straße', city: 'PLZ und Ort', tax_no: 'Steuernummer', vat_id: 'USt-IdNr.', phone: 'Telefon', email: 'E-Mail', finanzamt: 'Finanzamt', fa_tax_no: 'Steuernummer (Finanzamt)', veranlagungszeitraum: 'Veranlagungszeitraum',
        signer: 'Unterschrift', signer_role: 'Funktion', place: 'Ort', footer: ['Fußzeile', 'text'], intro: ['Einleitung', 'text'], zwecke: ['Satzungszwecke', 'text'], vat_default: 'Umsatzsteuer (Standard, %)', small_business: ['Kleinunternehmer', 'bool'],
        due_days: 'Zahlungsziel (Tage)', inv_prefix: 'Rechnungsnummer-Vorsilbe', don_prefix: 'Quittungsnummer-Vorsilbe', bescheid_type: 'Art des Bescheids', bescheid_date: 'Datum des Bescheids' };
      const diff = ctx.auditDiff(L, before, settings()); if (diff) ctx.audit(req.user, 'Buchhaltung: Einstellungen geändert', diff); }
    if (err.length) return bad(res, err.join(' '));
    res.json({ ok: true, settings: settings() });
  });

  /* ---------- Firmen & Sponsoren ---------- */
  const partnerInput = (b, cur = {}) => {
    const v = k => (b[k] !== undefined ? b[k] : cur[k]);
    const out = { name: one(v('name'), 100), contact: one(v('contact'), 80) || null, street: one(v('street'), 100) || null, zip: one(v('zip'), 10) || null, city: one(v('city'), 60) || null,
      country: one(v('country'), 40) || null, email: one(v('email'), 120).toLowerCase() || null, phone: one(v('phone'), 40) || null, vat_id: one(v('vat_id'), 20) || null,
      customer_no: one(v('customer_no'), 20) || null, note: txt(v('note'), 400) || null, department_id: Number(v('department_id')) || null, active: v('active') === undefined ? 1 : (v('active') ? 1 : 0) };
    if (out.name.length < 2) return { error: 'Bitte den Namen der Firma eintragen.' };
    if (!mailOk(out.email)) return { error: 'Die E-Mail-Adresse ist ungültig.' };
    try { out.items = JSON.stringify(b.items !== undefined ? cleanItems(b.items) : J(cur.items, [])); } catch (e) { return { error: e.message }; }
    return { v: out };
  };
  const partnerView = p => ({ ...p, items: J(p.items, []), invoices: db.prepare("SELECT COUNT(*) n FROM bh_invoice WHERE partner_id = ?").get(p.id).n,
    open: db.prepare("SELECT COALESCE(SUM(gross),0) c FROM bh_invoice WHERE partner_id = ? AND status = 'offen'").get(p.id).c,
    lastYearly: (db.prepare('SELECT MAX(yearly) y FROM bh_invoice WHERE partner_id = ? AND status != \'storniert\'').get(p.id) || {}).y || null });
  admin.get('/partners', P, (req, res) => res.json(db.prepare('SELECT * FROM bh_partner ORDER BY active DESC, name COLLATE NOCASE').all().map(partnerView)));
  admin.post('/partners', P, (req, res) => {
    const r = partnerInput(req.body || {}); if (r.error) return bad(res, r.error);
    const k = Object.keys(r.v);
    const id = Number(db.prepare(`INSERT INTO bh_partner(${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map(x => r.v[x])).lastInsertRowid);
    ctx.audit(req.user, 'Buchhaltung: Firma angelegt', r.v.name);
    res.json({ id });
  });
  admin.put('/partners/:id', P, (req, res) => {
    const cur = partnerRow(int(req.params.id)); if (!cur) return bad(res, 'Nicht gefunden.', 404);
    const r = partnerInput(req.body || {}, cur); if (r.error) return bad(res, r.error);
    const k = Object.keys(r.v);
    db.prepare(`UPDATE bh_partner SET ${k.map(x => `${x} = ?`).join(', ')} WHERE id = ?`).run(...k.map(x => r.v[x]), cur.id);
    res.json({ ok: true });
  });
  admin.delete('/partners/:id', P, (req, res) => {
    const cur = partnerRow(int(req.params.id)); if (!cur) return bad(res, 'Nicht gefunden.', 404);
    if (db.prepare('SELECT 1 FROM bh_invoice WHERE partner_id = ?').get(cur.id) || db.prepare('SELECT 1 FROM bh_donation WHERE partner_id = ?').get(cur.id))
      return bad(res, 'Für diese Firma gibt es schon Rechnungen oder Spendenquittungen – stattdessen auf „inaktiv“ setzen.');
    db.prepare('DELETE FROM bh_partner WHERE id = ?').run(cur.id);
    ctx.audit(req.user, 'Buchhaltung: Firma gelöscht', cur.name);
    res.json({ ok: true });
  });

  /* ---------- Rechnungen ---------- */
  async function createInvoice(b, by, { yearly = null } = {}) {
    const kind = b.kind === 'member' ? 'member' : 'partner';
    let recipient, partner = null, memberId = null;
    if (kind === 'partner') { partner = partnerRow(int(b.partner_id)); if (!partner) throw new Error('Bitte eine Firma wählen.'); recipient = addrOfPartner(partner); }
    else { const m = await memberAddr(int(b.member_id)); if (!m) throw new Error('Bitte ein Mitglied wählen.'); memberId = m.id; recipient = addrOfMember(m); recipient.payment = m.payment || null; }
    const items = cleanItems(b.items);
    if (!items.length) throw new Error('Bitte mindestens eine Position eintragen.');
    const s = settings();
    const date = isDate(b.date) ? b.date : today();
    const due = isDate(b.due_date) ? b.due_date : addDays(date, s.due_days);
    if (due < date) throw new Error('Das Zahlungsziel liegt vor dem Rechnungsdatum.');
    const t = totals(items, s.small_business);
    if (t.gross <= 0) throw new Error('Der Rechnungsbetrag muss größer als 0 sein.');
    const year = Number(date.slice(0, 4));
    const dept = Number(b.department_id) || (partner && partner.department_id) || null;
    const acc = snap(C.bank.pick({ id: Number(b.account_id) || null, department: dept }));
    let id, no;
    db.transaction(() => {
      no = nextNo('bh_invoice', s.inv_prefix, year);
      id = Number(db.prepare(`INSERT INTO bh_invoice(no, year, kind, partner_id, member_id, recipient, date, due_date, period, intro, note, items, net, vat, gross, small_business, yearly, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(no, year, kind, partner ? partner.id : null, memberId, JSON.stringify(recipient), date, due, one(b.period, 80) || null,
        txt(b.intro !== undefined ? b.intro : s.intro, 600) || null, txt(b.note, 600) || null, JSON.stringify(items), t.net, t.vat, t.gross, s.small_business ? 1 : 0, yearly, by || null).lastInsertRowid);
      db.prepare('UPDATE bh_invoice SET department_id = ?, account_id = ?, bank = ? WHERE id = ?').run(dept, acc ? acc.id : null, acc ? JSON.stringify(acc) : null, id);
    })();
    // an Mitglieder: zusätzlich offener Posten in der Mitgliederverwaltung (Lastschrift/Überweisung wird dort gebucht)
    if (kind === 'member' && C.isModuleActive('mitglieder') && b.as_charge !== false) {
      const r = (await C.callHooks('createCharge', { member_id: memberId, text: `Rechnung ${no}: ${items[0].text}${items.length > 1 ? ' u. a.' : ''}`, cents: t.gross, due_date: due, kind: 'sonstiges', ext_key: `bh-inv-${id}`, by })).find(x => x.id === 'mitglieder');
      if (r && r.result) db.prepare('UPDATE bh_invoice SET charge_id = ? WHERE id = ?').run(r.result, id);
    }
    return { id, no };
  }
  admin.get('/invoices', P, ar(async (req, res) => {
    await syncMemberInvoices();
    const q = req.query, w = [], a = [];
    if (q.status && q.status !== 'alle') { if (q.status === 'ueber') { w.push("status = 'offen' AND due_date < ?"); a.push(today()); } else { w.push('status = ?'); a.push(q.status); } }
    if (q.year) { w.push('year = ?'); a.push(int(q.year)); }
    if (q.partner) { w.push('partner_id = ?'); a.push(int(q.partner)); }
    res.json(db.prepare(`SELECT * FROM bh_invoice ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY date DESC, id DESC LIMIT 1000`).all(...a).map(invView));
  }));
  admin.post('/invoices', P, ar(async (req, res) => {
    try {
      const r = await createInvoice(req.body || {}, uname(req));
      ctx.audit(req.user, 'Rechnung erstellt', r.no);
      if ((req.body || {}).send) { const s = await sendInvoice(r.id, req); return res.json({ ...r, ...s }); }
      res.json(r);
    } catch (e) { bad(res, e.message); }
  }));
  const invOr404 = (req, res) => { const r = db.prepare('SELECT * FROM bh_invoice WHERE id = ?').get(int(req.params.id)); if (!r) bad(res, 'Nicht gefunden.', 404); return r; };
  admin.get('/invoices/:id', P, (req, res) => { const r = invOr404(req, res); if (r) res.json(invView(r)); });
  admin.get('/invoices/:id/pdf', P, ar(async (req, res) => {
    const r = invOr404(req, res); if (!r) return;
    const buf = await pdfInvoice(r, { title: req.query.reminder ? `${Number(req.query.reminder) > 1 ? req.query.reminder + '. ' : ''}Zahlungserinnerung` : undefined });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${fileName('Rechnung', r.no)}"` }).send(buf);
  }));
  async function sendInvoice(id, req, { reminder = false } = {}) {
    const r = db.prepare('SELECT * FROM bh_invoice WHERE id = ?').get(id);
    const v = invView(r);
    if (!ctx.mail.ready()) throw new Error('Für den Versand ist noch kein Postfach eingerichtet (Einstellungen → Postfach).');
    if (!v.recipient.email) throw new Error(`Für ${v.recipient.name} ist keine E-Mail-Adresse hinterlegt – bitte das PDF ausdrucken oder die Adresse ergänzen.`);
    const n = reminder ? r.reminders + 1 : 0;
    const title = reminder ? `${n > 1 ? n + '. ' : ''}Zahlungserinnerung` : 'Rechnung';
    const buf = await pdfInvoice(r, { title });
    const cl = club(v.bank);
    const greet = v.recipient.contact ? `Guten Tag ${v.recipient.contact},` : 'Guten Tag,';
    const lines = reminder
      ? [greet, '', `unsere Rechnung ${r.no} vom ${deD(r.date)} über ${euro(r.gross)} war am ${deD(r.due_date)} fällig. Vielleicht ist sie im Alltag untergegangen – wir bitten freundlich um Überweisung.`, 'Sollten Sie inzwischen gezahlt haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.']
      : v.kind === 'member' && r.charge_id && v.recipient.payment === 'lastschrift' ? [greet, '', `anbei erhalten Sie unsere Rechnung ${r.no} über ${euro(r.gross)}.`, 'Der Betrag wird wie gewohnt per SEPA-Lastschrift von Ihrem Konto eingezogen.']
      : [greet, '', `anbei erhalten Sie unsere Rechnung ${r.no} über ${euro(r.gross)}.`, `Bitte überweisen Sie den Betrag bis zum ${deD(r.due_date)}${cl.iban ? ` auf das Konto ${cl.iban.replace(/(.{4})/g, '$1 ').trim()}` : ''} unter Angabe der Rechnungsnummer.`];
    await ctx.mail.send({ to: v.recipient.email, subject: `${title} ${r.no} – ${cl.name}`, text: [...lines, '', 'Vielen Dank!', '', 'Mit freundlichen Grüßen', cl.name].join('\n'),
      attachments: [{ filename: fileName(reminder ? 'Zahlungserinnerung' : 'Rechnung', r.no), content: buf }] });
    if (reminder) db.prepare('UPDATE bh_invoice SET reminders = ?, reminded_at = ? WHERE id = ?').run(n, ctx.nowTs(), r.id);
    else db.prepare('UPDATE bh_invoice SET sent_at = ? WHERE id = ?').run(ctx.nowTs(), r.id);
    ctx.audit(req.user, reminder ? 'Zahlungserinnerung verschickt' : 'Rechnung verschickt', `${r.no} an ${v.recipient.email}`);
    return { sent: true, to: v.recipient.email };
  }
  admin.post('/invoices/:id/send', P, ar(async (req, res) => {
    const r = invOr404(req, res); if (!r) return;
    if (r.status === 'storniert') return bad(res, 'Die Rechnung ist storniert.');
    try { res.json(await sendInvoice(r.id, req)); } catch (e) { bad(res, e.message); }
  }));
  admin.post('/invoices/:id/remind', P, ar(async (req, res) => {
    const r = invOr404(req, res); if (!r) return;
    if (r.status !== 'offen') return bad(res, 'Nur offene Rechnungen lassen sich anmahnen.');
    try { res.json(await sendInvoice(r.id, req, { reminder: true })); } catch (e) { bad(res, e.message); }
  }));
  admin.post('/invoices/:id/paid', P, ar(async (req, res) => {
    const r = invOr404(req, res); if (!r) return;
    if (r.status !== 'offen') return bad(res, 'Diese Rechnung ist nicht offen.');
    const b = req.body || {};
    const date = isDate(b.date) ? b.date : today(), via = ['ueberweisung', 'bar', 'lastschrift', 'verrechnet'].includes(b.via) ? b.via : 'ueberweisung';
    db.prepare("UPDATE bh_invoice SET status = 'bezahlt', paid_at = ?, paid_via = ? WHERE id = ?").run(date, via, r.id);
    if (r.charge_id) await ctx.callHooks('chargePaid', r.charge_id, date, via);
    ctx.audit(req.user, 'Rechnung bezahlt', `${r.no} ${euro(r.gross)} (${via})`);
    res.json({ ok: true });
  }));
  admin.post('/invoices/:id/unpaid', P, (req, res) => {
    const r = invOr404(req, res); if (!r) return;
    if (r.status !== 'bezahlt' || r.kind === 'member') return bad(res, r.kind === 'member' ? 'Zahlungen von Mitgliedern werden in der Mitgliederverwaltung gebucht.' : 'Die Rechnung ist nicht als bezahlt markiert.');
    db.prepare("UPDATE bh_invoice SET status = 'offen', paid_at = NULL, paid_via = NULL WHERE id = ?").run(r.id);
    ctx.audit(req.user, 'Rechnung wieder offen', r.no);
    res.json({ ok: true });
  });
  admin.post('/invoices/:id/cancel', P, ar(async (req, res) => {
    const r = invOr404(req, res); if (!r) return;
    if (r.status === 'storniert') return bad(res, 'Schon storniert.');
    const reason = one((req.body || {}).reason, 200);
    if (reason.length < 3) return bad(res, 'Bitte kurz begründen.');
    if (r.charge_id) {
      const out = (await ctx.callHooks('cancelCharge', r.charge_id, reason, uname(req))).find(x => x.id === 'mitglieder');
      if (ctx.isModuleActive('mitglieder') && !out) return bad(res, 'Der zugehörige Posten in der Mitgliederverwaltung steckt in einer laufenden Lastschrift – bitte dort erst klären.');
    }
    db.prepare("UPDATE bh_invoice SET status = 'storniert', cancel_reason = ? WHERE id = ?").run(reason, r.id);
    ctx.audit(req.user, 'Rechnung storniert', `${r.no}: ${reason}`);
    res.json({ ok: true });
  }));
  /* Jahresrechnungen: alle aktiven Firmen mit hinterlegten Positionen, je Jahr nur einmal */
  admin.get('/yearly', P, (req, res) => {
    const year = int(req.query.year) || Number(today().slice(0, 4));
    const s = settings();
    res.json({ year, rows: db.prepare("SELECT * FROM bh_partner WHERE active = 1 ORDER BY name COLLATE NOCASE").all().map(p => {
      const items = J(p.items, []); const t = totals(items, s.small_business);
      const done = db.prepare("SELECT no FROM bh_invoice WHERE partner_id = ? AND yearly = ? AND status != 'storniert'").get(p.id, year);
      return { id: p.id, name: p.name, email: p.email, items, gross: t.gross, done: done ? done.no : null };
    }).filter(r => r.items.length) });
  });
  admin.post('/yearly', P, ar(async (req, res) => {
    const b = req.body || {};
    const year = int(b.year) || Number(today().slice(0, 4));
    const ids = new Set((Array.isArray(b.partner_ids) ? b.partner_ids : []).map(Number));
    const out = [], skipped = [];
    for (const p of db.prepare('SELECT * FROM bh_partner WHERE active = 1 ORDER BY name COLLATE NOCASE').all()) {
      if (ids.size && !ids.has(p.id)) continue;
      const items = J(p.items, []); if (!items.length) continue;
      if (db.prepare("SELECT 1 FROM bh_invoice WHERE partner_id = ? AND yearly = ? AND status != 'storniert'").get(p.id, year)) { skipped.push(p.name); continue; }
      try {
        const r = await createInvoice({ kind: 'partner', partner_id: p.id, items, date: b.date, due_date: b.due_date, period: one(b.period, 80) || `${year}` }, uname(req), { yearly: year });
        let sent = false; if (b.send && p.email && ctx.mail.ready()) { try { await sendInvoice(r.id, req); sent = true; } catch (e) { /* bleibt unversendet */ } }
        out.push({ ...r, name: p.name, sent });
      } catch (e) { skipped.push(`${p.name} (${e.message})`); }
    }
    ctx.audit(req.user, 'Jahresrechnungen erstellt', `${year}: ${out.length} ${out.length === 1 ? 'Rechnung' : 'Rechnungen'}`);
    res.json({ created: out, skipped });
  }));

  /* ---------- Spendenquittungen ---------- */
  const donView = d => ({ ...d, donor: J(d.donor, {}), sach_docs: Boolean(d.sach_docs) });
  admin.get('/donations', P, (req, res) => {
    const q = req.query, w = [], a = [];
    if (q.year) { w.push('year = ?'); a.push(int(q.year)); }
    if (q.status && q.status !== 'alle') { w.push('status = ?'); a.push(q.status); }
    res.json(db.prepare(`SELECT * FROM bh_donation ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY date DESC, id DESC LIMIT 1000`).all(...a).map(donView));
  });
  admin.post('/donations', P, ar(async (req, res) => {
    const b = req.body || {};
    if (!(S('finanzamt') && S('fa_tax_no') && S('bescheid_date') && S('zwecke'))) return bad(res, 'Bitte zuerst unter Buchhaltung → Einstellungen die Angaben zum Freistellungsbescheid eintragen (Finanzamt, Steuernummer, Datum, Zwecke).');
    const type = ['member', 'partner', 'einmalig'].includes(b.donor_type) ? b.donor_type : 'einmalig';
    let donor, memberId = null, partnerId = null;
    if (type === 'member') { const m = await memberAddr(int(b.member_id)); if (!m) return bad(res, 'Bitte ein Mitglied wählen.'); memberId = m.id; donor = { name: m.name, street: m.street || '', zip: m.zip || '', city: m.city || '', email: m.email || '' }; }
    else if (type === 'partner') { const p = partnerRow(int(b.partner_id)); if (!p) return bad(res, 'Bitte eine Firma wählen.'); partnerId = p.id; donor = { name: p.name, street: p.street || '', zip: p.zip || '', city: p.city || '', email: p.email || '' }; }
    else { const d = b.donor || {}; donor = { name: one(d.name, 100), street: one(d.street, 100), zip: one(d.zip, 10), city: one(d.city, 60), email: one(d.email, 120).toLowerCase() }; if (donor.name.length < 3) return bad(res, 'Bitte Namen des Spenders eintragen.'); if (!mailOk(donor.email)) return bad(res, 'Die E-Mail-Adresse ist ungültig.'); }
    if (!donor.street || !donor.city) return bad(res, `Für die Spendenquittung braucht es die vollständige Anschrift von ${donor.name}.`);
    const kind = ['geld', 'sach', 'verzicht'].includes(b.kind) ? b.kind : 'geld';
    const cents = Math.round(Number(b.cents));
    if (!Number.isFinite(cents) || cents <= 0 || cents > 100000000) return bad(res, 'Bitte den Betrag bzw. Wert eintragen.');
    if (!isDate(b.date) || b.date > today()) return bad(res, 'Bitte den Tag der Zuwendung angeben (nicht in der Zukunft).');
    const item = txt(b.item, 600);
    if (kind === 'sach' && item.length < 5) return bad(res, 'Bei einer Sachspende bitte genau beschreiben, was gespendet wurde (Bezeichnung, Alter, Zustand, Kaufpreis).');
    if (kind === 'verzicht' && item.length < 5) return bad(res, 'Bitte angeben, auf welche Aufwendungen verzichtet wurde (z. B. Fahrtkosten Turnier am …).');
    const year = Number(b.date.slice(0, 4));
    let id, no;
    db.transaction(() => {
      no = nextNo('bh_donation', S('don_prefix'), year);
      id = Number(db.prepare('INSERT INTO bh_donation(no, year, donor_type, member_id, partner_id, donor, kind, date, cents, item, sach_origin, sach_docs, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(no, year, type, memberId, partnerId, JSON.stringify(donor), kind, b.date, cents, item || null, kind === 'sach' ? (['betrieb', 'privat'].includes(b.sach_origin) ? b.sach_origin : 'unbekannt') : null, b.sach_docs ? 1 : 0, uname(req)).lastInsertRowid);
    })();
    ctx.audit(req.user, 'Spendenquittung erstellt', `${no}: ${donor.name} ${euro(cents)}`);
    res.json({ id, no });
  }));
  const donOr404 = (req, res) => { const r = db.prepare('SELECT * FROM bh_donation WHERE id = ?').get(int(req.params.id)); if (!r) bad(res, 'Nicht gefunden.', 404); return r; };
  admin.get('/donations/:id/pdf', P, ar(async (req, res) => {
    const d = donOr404(req, res); if (!d) return;
    const buf = await pdfDonation(d);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${fileName('Zuwendungsbestaetigung', d.no)}"` }).send(buf);
  }));
  admin.post('/donations/:id/send', P, ar(async (req, res) => {
    const d = donOr404(req, res); if (!d) return;
    if (d.status !== 'aktiv') return bad(res, 'Diese Spendenquittung ist storniert.');
    const v = donView(d);
    if (!ctx.mail.ready()) return bad(res, 'Für den Versand ist noch kein Postfach eingerichtet (Einstellungen → Postfach).');
    if (!v.donor.email) return bad(res, `Für ${v.donor.name} ist keine E-Mail-Adresse hinterlegt – bitte das PDF ausdrucken.`);
    const cl = club();
    await ctx.mail.send({ to: v.donor.email, subject: `Ihre Zuwendungsbestätigung ${d.no} – ${cl.name}`,
      text: ['Guten Tag,', '', `herzlichen Dank für Ihre ${d.kind === 'sach' ? 'Sachspende' : 'Spende'} vom ${deD(d.date)} über ${euro(d.cents)}!`, 'Die Zuwendungsbestätigung für das Finanzamt finden Sie im Anhang.', '', 'Mit freundlichen Grüßen', cl.name].join('\n'),
      attachments: [{ filename: fileName('Zuwendungsbestaetigung', d.no), content: await pdfDonation(d) }] });
    db.prepare('UPDATE bh_donation SET sent_at = ? WHERE id = ?').run(ctx.nowTs(), d.id);
    ctx.audit(req.user, 'Spendenquittung verschickt', `${d.no} an ${v.donor.email}`);
    res.json({ sent: true, to: v.donor.email });
  }));
  admin.post('/donations/:id/cancel', P, (req, res) => {
    const d = donOr404(req, res); if (!d) return;
    if (d.status !== 'aktiv') return bad(res, 'Schon storniert.');
    const reason = one((req.body || {}).reason, 200); if (reason.length < 3) return bad(res, 'Bitte kurz begründen.');
    db.prepare("UPDATE bh_donation SET status = 'storniert', cancel_reason = ? WHERE id = ?").run(reason, d.id);
    ctx.audit(req.user, 'Spendenquittung storniert', `${d.no}: ${reason}`);
    res.json({ ok: true });
  });

  /* ---------- Übersicht, Erinnerungen, Funktionsdatei ---------- */
  /* für den Kern: Konto zusammengeführt (intoId) oder gelöscht (null) – Rechnungen und Spendenbescheinigungen behalten den Empfängertext,
     der Verweis aufs Mitglied wandert bzw. entfällt (keine Fremdschlüssel, daher hier) */
  /* Mitglied löschen: offene Rechnungen sperren (bezahlte, stornierte und Spendenquittungen bleiben mit Namen erhalten) */
  ctx.hooks.memberLinks = id => {
    const n = db.prepare("SELECT COUNT(*) n FROM bh_invoice WHERE member_id = ? AND status = 'offen'").get(id).n;
    return n ? [`${n} offene ${n === 1 ? 'Rechnung' : 'Rechnungen'}`] : [];
  };
  ctx.hooks.memberRemoved = (fromId, intoId) => {
    for (const t of ['bh_invoice', 'bh_donation']) db.prepare(`UPDATE ${t} SET member_id = ? WHERE member_id = ?`).run(intoId, fromId);
  };
  ctx.hooks.overview = async () => {
    await syncMemberInvoices();
    const open = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(gross),0) c FROM bh_invoice WHERE status = 'offen'").get();
    const over = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(gross),0) c FROM bh_invoice WHERE status = 'offen' AND due_date < ?").get(today());
    const alerts = over.n ? [{ level: 'a', text: `${over.n} ${over.n === 1 ? 'Rechnung' : 'Rechnungen'} überfällig (${euro(over.c)}) – Zahlungserinnerung schicken?`, go: 'bh-rechnungen', link: 'Ansehen' }] : [];
    const y = Number(today().slice(0, 4));
    const pend = db.prepare("SELECT COUNT(*) n FROM bh_partner p WHERE p.active = 1 AND p.items != '[]' AND NOT EXISTS (SELECT 1 FROM bh_invoice i WHERE i.partner_id = p.id AND i.yearly = ? AND i.status != 'storniert')").get(y).n;
    return { kpis: [{ l: 'Offene Rechnungen', v: `${open.n} · ${euro(open.c)}` }, { l: `Jahresrechnungen ${y} offen`, v: pend }], alerts };
  };
  ctx.hooks.exportConfig = () => ({ settings: Object.fromEntries(Object.keys(DEF).map(k => [k, S(k)])),
    partners: db.prepare('SELECT name, contact, street, zip, city, country, email, phone, vat_id, customer_no, items, note, active FROM bh_partner').all() });
  ctx.hooks.importConfig = data => {
    if (!data || typeof data !== 'object') throw new Error('Leere Funktionsdatei.');
    let n = 0;
    if (data.settings && typeof data.settings === 'object') for (const [k, v] of Object.entries(data.settings)) if (k in DEF && typeof v === 'string') C.setSetting2(k, v.slice(0, 600));
    for (const p of Array.isArray(data.partners) ? data.partners.slice(0, 500) : []) {
      if (!p || !p.name || db.prepare('SELECT 1 FROM bh_partner WHERE lower(name) = lower(?)').get(String(p.name))) continue;
      const r = partnerInput({ ...p, items: J(p.items, []) }); if (r.error) continue;
      const k = Object.keys(r.v); db.prepare(`INSERT INTO bh_partner(${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map(x => r.v[x])); n++;
    }
    return `Einstellungen und ${n} Firma/Firmen übernommen – Bankkonten stehen unter Einstellungen → Bankkonten`;
  };
}

module.exports = { activate, totals, cleanItems };
