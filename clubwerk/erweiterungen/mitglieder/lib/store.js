'use strict';
/**
 * Datenmodell der Mitgliederverwaltung. Die Person selbst bleibt in der Kern-Tabelle „members“ (dieselbe Person bucht Getränke,
 * öffnet Türen, nutzt die Mitglieder-App); hier liegen die Vereinsdaten dazu.
 */
const crypto = require('crypto');
const fees = require('./fees');
const sepa = require('./sepa');

let db, getSetting, setSetting;
const S = (k, d = '') => getSetting('ext_mitglieder_' + k, d);
const SET = (k, v) => setSetting('ext_mitglieder_' + k, v == null ? '' : String(v));
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowTs = () => { const d = new Date(); return `${today()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

function createTables() {
  db.exec(`
CREATE TABLE IF NOT EXISTS mv_person (
  member_id     INTEGER PRIMARY KEY REFERENCES members(id),
  member_no     TEXT UNIQUE,
  salutation    TEXT, title TEXT, first_name TEXT, last_name TEXT,
  birth_date    TEXT, gender TEXT,
  street        TEXT, zip TEXT, city TEXT, country TEXT, address_extra TEXT,
  phone         TEXT, mobile TEXT, email TEXT, letter_salutation TEXT,
  status        TEXT NOT NULL DEFAULT 'aktiv',          -- aktiv | passiv | ehren | ruhend (ausgetreten ergibt sich aus exit_date)
  entry_date    TEXT, exit_date TEXT, exit_reason TEXT, notice_date TEXT,
  payer_id      INTEGER REFERENCES members(id),          -- zahlt für diese Person (Familie / abweichender Zahler); NULL = selbst
  drinks_to_payer INTEGER NOT NULL DEFAULT 1,
  payment       TEXT NOT NULL DEFAULT 'lastschrift',     -- lastschrift | rechnung | bar
  key_no        TEXT, notes TEXT,
  consents      TEXT NOT NULL DEFAULT '{}',              -- {"homepage": "2026-10-17", …} Datum der Einwilligung
  extra         TEXT NOT NULL DEFAULT '{}',
  anonymized_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT
);
CREATE TABLE IF NOT EXISTS mv_bank (
  member_id     INTEGER PRIMARY KEY REFERENCES members(id),
  holder        TEXT, iban TEXT, bic TEXT, bank TEXT,
  mandate_ref   TEXT UNIQUE, mandate_date TEXT, mandate_first_used TEXT, mandate_last_used TEXT, mandate_notified TEXT, mandate_revoked TEXT,
  updated_at    TEXT
);
CREATE TABLE IF NOT EXISTS mv_department (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, federation TEXT, sort INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS mv_member_department (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), department_id INTEGER NOT NULL REFERENCES mv_department(id),
  entry_date TEXT, exit_date TEXT, status TEXT NOT NULL DEFAULT 'aktiv', federation_status TEXT, exit_reason TEXT
);
CREATE INDEX IF NOT EXISTS ix_mvmd_member ON mv_member_department(member_id);
CREATE TABLE IF NOT EXISTS mv_fee (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, department_id INTEGER REFERENCES mv_department(id),
  cents INTEGER NOT NULL DEFAULT 0, interval TEXT NOT NULL DEFAULT 'jahr', prorate TEXT NOT NULL DEFAULT 'anteilig',
  age_min INTEGER, age_max INTEGER, family INTEGER NOT NULL DEFAULT 0,   -- family = gilt für Hauptzahler + Angehörige
  work_minutes INTEGER,                                                  -- Arbeitsstunden-Soll je Jahr (Modul Arbeitseinsatz); NULL = Vorgabe
  on_form INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, note TEXT
);
CREATE TABLE IF NOT EXISTS mv_member_fee (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), fee_id INTEGER NOT NULL REFERENCES mv_fee(id),
  start_date TEXT NOT NULL, end_date TEXT, booked_until TEXT, cents INTEGER, note TEXT
);
CREATE INDEX IF NOT EXISTS ix_mvmf_member ON mv_member_fee(member_id);
CREATE TABLE IF NOT EXISTS mv_run (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'beitrag', until_date TEXT, filters TEXT, count INTEGER, cents INTEGER,
  drinks_batch TEXT, by_user TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), note TEXT
);
CREATE TABLE IF NOT EXISTS mv_collection (
  id INTEGER PRIMARY KEY, collection_date TEXT NOT NULL, msg_id TEXT NOT NULL, count INTEGER, cents INTEGER, xml TEXT,
  status TEXT NOT NULL DEFAULT 'erstellt',                 -- erstellt | gebucht | verworfen
  prenotified_at TEXT, booked_at TEXT, by_user TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), note TEXT
);
CREATE TABLE IF NOT EXISTS mv_charge (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id),       -- Zahler (Schuldner)
  for_member_id INTEGER REFERENCES members(id),            -- für wen (z. B. Kind)
  kind TEXT NOT NULL,                                      -- beitrag | getraenke | arbeitsstunden | aufnahme | ruecklastschrift | mahngebuehr | sonstiges
  text TEXT NOT NULL, period_from TEXT, period_to TEXT, cents INTEGER NOT NULL, due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offen',                    -- offen | eingezogen | bezahlt | storniert
  paid_at TEXT, paid_via TEXT, collection_id INTEGER REFERENCES mv_collection(id), run_id INTEGER REFERENCES mv_run(id),
  member_fee_id INTEGER, ext_key TEXT UNIQUE, invoice_no TEXT, dunning_level INTEGER NOT NULL DEFAULT 0, dunned_at TEXT,
  returns INTEGER NOT NULL DEFAULT 0, note TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_mvc_member ON mv_charge(member_id, status);
CREATE INDEX IF NOT EXISTS ix_mvc_coll ON mv_charge(collection_id);
CREATE TABLE IF NOT EXISTS mv_document (
  id INTEGER PRIMARY KEY, member_id INTEGER REFERENCES members(id), application_id INTEGER, kind TEXT NOT NULL DEFAULT 'sonstiges',
  title TEXT NOT NULL, file TEXT NOT NULL, mime TEXT, size INTEGER, sha256 TEXT, by_user TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS mv_honor (id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), name TEXT NOT NULL, date TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS mv_function (id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), name TEXT NOT NULL, from_date TEXT, to_date TEXT);
CREATE TABLE IF NOT EXISTS mv_history (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now','localtime')), by_user TEXT, field TEXT NOT NULL, old TEXT, new TEXT
);
CREATE INDEX IF NOT EXISTS ix_mvh_member ON mv_history(member_id);
CREATE TABLE IF NOT EXISTS mv_application (
  id INTEGER PRIMARY KEY, source TEXT NOT NULL, status TEXT NOT NULL,   -- unterschrift | eingegangen | angenommen | abgelehnt
  data TEXT NOT NULL, code_hash TEXT, code_expires INTEGER,
  signed_at TEXT, signed_via TEXT, sig_member TEXT, sig_mandate TEXT, sha256 TEXT, document_id INTEGER,
  member_id INTEGER, reviewed_by TEXT, reviewed_at TEXT, reason TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS mv_change (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), kind TEXT NOT NULL,   -- daten | bank | kuendigung
  data TEXT NOT NULL, signature TEXT, status TEXT NOT NULL DEFAULT 'offen', reviewed_by TEXT, reviewed_at TEXT, reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`);
}

/** spätere Spalten (3.1.1): Zusatzbeiträge der Abteilungen */
function migrate() {
  const has = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some(r => r.name === c);
  const add = (t, c, def) => { if (!has(t, c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
  add('mv_fee', 'kind', "TEXT NOT NULL DEFAULT 'grund'");            // grund = Hauptverein | zusatz = Zusatzbeitrag der Abteilung (je Person, nach Alter)
  add('mv_member_department', 'booked_until', 'TEXT');                // Zusatzbeitrag abgerechnet bis
  add('mv_member_department', 'fee_id', 'INTEGER');                   // fest gewählter Zusatzbeitrag (sonst nach Alter)
  add('mv_member_department', 'fee_free', 'INTEGER NOT NULL DEFAULT 0');   // vom Zusatzbeitrag befreit (z. B. Trainer)
  add('mv_charge', 'member_dept_id', 'INTEGER');
  // Verkauf bei Angehörigen: payer = über den Hauptzahler (nicht in der Tablet-Liste) · own_payer = eigener Eintrag, zahlt der Hauptzahler · own = eigener Eintrag, zahlt selbst
  if (!has('mv_person', 'sales_mode')) {
    db.exec("ALTER TABLE mv_person ADD COLUMN sales_mode TEXT NOT NULL DEFAULT 'payer'");
    db.prepare("UPDATE mv_person SET sales_mode = 'own' WHERE drinks_to_payer = 0").run();   // wer bisher selbst zahlte, bleibt dabei
  }
  flattenPayers();
}
/** Zahler-Ketten (Kind → Mutter → Vater) auf den Hauptzahler ziehen – die Familie hat genau einen Hauptzahler */
function flattenPayers() {
  for (const r of db.prepare('SELECT p.member_id FROM mv_person p JOIN mv_person q ON q.member_id = p.payer_id WHERE p.payer_id IS NOT NULL AND q.payer_id IS NOT NULL AND q.payer_id != q.member_id').all()) {
    const head = payerOf(r.member_id);
    db.prepare('UPDATE mv_person SET payer_id = ? WHERE member_id = ?').run(head === r.member_id ? null : head, r.member_id);
  }
}

/** Mitglieder-App „Meine Daten“: was Mitglieder sehen und ändern dürfen (Einstellung der Verwaltung) */
const APP_VIEW = { anschrift: 'Anschrift', kontakt: 'Telefon & E-Mail', geburt: 'Geburtsdatum', abteilungen: 'Abteilungen', beitraege: 'Beiträge', familie: 'Familie', posten: 'Forderungen & Zahlungen', bank: 'Bankverbindung & Mandat' };
const APP_EDIT = { anschrift: 'Anschrift ändern', kontakt: 'Telefon & E-Mail ändern', bank: 'Bankverbindung ändern (neues SEPA-Mandat mit Unterschrift)', kuendigung: 'Kündigen (Austritt beantragen)' };
function appPerms() {
  let cur = {}; try { cur = JSON.parse(S('app_perms', '{}')) || {}; } catch (e) { cur = {}; }
  const pick = (defs, have) => Object.fromEntries(Object.keys(defs).map(k => [k, have && have[k] !== undefined ? Boolean(have[k]) : true]));
  const view = pick(APP_VIEW, cur.view), edit = pick(APP_EDIT, cur.edit);
  if (!view.anschrift) edit.anschrift = false; if (!view.kontakt) edit.kontakt = false; if (!view.bank) edit.bank = false;   // ändern nur, was man sieht
  return { view, edit };
}

/** Beginn des laufenden Zeitraums (Beitragsjahr, Halbjahr …) an einem Tag */
function periodStart(day, interval = 'jahr') {
  const step = fees.MONTHS[interval] || 12;
  return fees.addMonths(fees.nextAnchor(day, S('year_start', '01-01'), step), -step);
}
/**
 * „Abgerechnet bis“ für eine neue Abteilungszugehörigkeit: Zusatzbeiträge beginnen frühestens mit dem laufenden Zeitraum –
 * wer schon länger dabei ist, bekommt keine vergangenen Jahre nachberechnet. → Datum oder null
 */
function zusatzStart(deptId, entry, day = today()) {
  const f = db.prepare("SELECT interval FROM mv_fee WHERE kind = 'zusatz' AND department_id = ? ORDER BY active DESC LIMIT 1").get(deptId);
  const ps = periodStart(day, f ? f.interval : 'jahr');
  return !fees.isDate(entry) || entry < ps ? fees.addDays(ps, -1) : null;
}

/* ---------- Personen ---------- */
const PERSON_FIELDS = ['salutation', 'title', 'first_name', 'last_name', 'birth_date', 'gender', 'street', 'zip', 'city', 'country', 'address_extra', 'phone', 'mobile', 'email',
  'letter_salutation', 'status', 'entry_date', 'exit_date', 'exit_reason', 'notice_date', 'payer_id', 'drinks_to_payer', 'payment', 'key_no', 'notes', 'member_no'];
const STATUS = { aktiv: 'aktiv', passiv: 'passiv', ehren: 'Ehrenmitglied', ruhend: 'ruhend' };
const PAYMENT = { lastschrift: 'Lastschrift', rechnung: 'Rechnung', bar: 'bar' };
const GENDER = { m: 'männlich', w: 'weiblich', d: 'divers' };

function ensurePerson(memberId) {
  if (!db.prepare('SELECT 1 FROM mv_person WHERE member_id = ?').get(memberId)) {
    const m = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    const parts = splitName(m || {});
    db.prepare('INSERT INTO mv_person(member_id, first_name, last_name, entry_date) VALUES (?,?,?,?)').run(memberId, parts.first || null, parts.last || null, m ? (m.created_at || '').slice(0, 10) || null : null);
  }
}
const PARTICLES = new Set(['von', 'van', 'vom', 'zu', 'zum', 'zur', 'de', 'der', 'den', 'la', 'le', 'di', 'da', 'ten', 'op']);
function splitName(m) {
  if (m.first_name || m.last_name) return { first: m.first_name || '', last: m.last_name || '' };
  const n = String(m.name || '').trim();
  if (n.includes(',')) { const [l, ...f] = n.split(','); return { first: f.join(',').trim(), last: l.trim() }; }
  const w = n.split(/\s+/); if (w.length < 2) return { first: '', last: n };
  let i = w.length - 1; while (i > 1 && PARTICLES.has(w[i - 1].toLowerCase())) i--;
  return { first: w.slice(0, i).join(' '), last: w.slice(i).join(' ') };
}
/** Name im Kern nachziehen (Tablet, App, Getränke zeigen ihn) */
function syncCore(memberId) {
  const p = db.prepare('SELECT first_name, last_name FROM mv_person WHERE member_id = ?').get(memberId);
  if (!p) return;
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  if (name.length >= 2) db.prepare('UPDATE members SET name = ?, first_name = ?, last_name = ? WHERE id = ?').run(name, p.first_name || null, p.last_name || null, memberId);
}
function nextMemberNo() {
  const max = db.prepare("SELECT MAX(CAST(member_no AS INTEGER)) n FROM mv_person WHERE member_no GLOB '[0-9]*'").get().n || 0;
  const start = parseInt(S('member_no_start', '1'), 10) || 1;
  return String(Math.max(max + 1, start));
}
function mandateRefFor(memberNo) {
  const pre = S('mandate_prefix', '').replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
  let ref = (pre + memberNo).slice(0, 35), n = 1;
  while (db.prepare('SELECT 1 FROM mv_bank WHERE mandate_ref = ?').get(ref)) ref = `${pre}${memberNo}-${++n}`.slice(0, 35);
  return ref;
}
const hist = (memberId, user, field, oldV, newV) => {
  if (String(oldV ?? '') === String(newV ?? '')) return;
  db.prepare('INSERT INTO mv_history(member_id, by_user, field, old, new) VALUES (?,?,?,?,?)').run(memberId, user || null, field, oldV == null ? null : String(oldV).slice(0, 300), newV == null ? null : String(newV).slice(0, 300));
};

/** Wer zahlt für diese Person? (Kette höchstens 3 Stufen, sonst selbst) */
function payerOf(memberId) {
  let id = memberId;
  for (let i = 0; i < 3; i++) {
    const p = db.prepare('SELECT payer_id FROM mv_person WHERE member_id = ?').get(id);
    if (!p || !p.payer_id || p.payer_id === id) return id;
    id = p.payer_id;
  }
  return id;
}
/** Familie: Hauptzahler + alle, für die er zahlt */
function familyOf(memberId) {
  const head = payerOf(memberId);
  const ids = [head, ...db.prepare('SELECT member_id FROM mv_person WHERE payer_id = ? AND member_id != ?').all(head, head).map(r => r.member_id)];
  return { head, members: ids };
}
const isExited = (p, day = today()) => Boolean(p && p.exit_date && p.exit_date < day);
const fullName = p => [p.first_name, p.last_name].filter(Boolean).join(' ');

/* ---------- Beiträge ---------- */
function feeCents(mf, fee) { return mf.cents != null ? mf.cents : fee.cents; }
function feeLabel(fee) { return `${fee.name} (${(fee.cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} ${fees.INTERVAL_LABEL[fee.interval]})`; }

module.exports = {
  init(o) { ({ db, getSetting, setSetting } = o); createTables(); migrate(); },
  S, SET, today, nowTs, PERSON_FIELDS, STATUS, PAYMENT, GENDER, ensurePerson, splitName, syncCore, nextMemberNo, mandateRefFor, hist,
  payerOf, familyOf, flattenPayers, appPerms, APP_VIEW, APP_EDIT, periodStart, zusatzStart, isExited, fullName, feeCents, feeLabel, sepa, fees,
  sha256: b => crypto.createHash('sha256').update(b).digest('hex'),
};
