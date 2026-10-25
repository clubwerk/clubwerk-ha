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
const { today, nowTs } = require('../../../src/util');
const { splitPersonName } = require('../../../src/db');   // Namenszerlegung: eine Quelle für Sortierung, Kern und Module

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
  add('mv_change', 'created_by', 'TEXT');               // Meldungen von Abteilungsleitungen (Eintritt, Austritt, Rückkehr)
  add('mv_application', 'pre_by', 'TEXT'); add('mv_application', 'pre_at', 'TEXT');   // von der Abteilungsleitung befürwortet
  // Verkauf bei Angehörigen: payer = über den Hauptzahler (nicht in der Tablet-Liste) · own_payer = eigener Eintrag, zahlt der Hauptzahler · own = eigener Eintrag, zahlt selbst
  if (!has('mv_person', 'sales_mode')) {
    db.exec("ALTER TABLE mv_person ADD COLUMN sales_mode TEXT NOT NULL DEFAULT 'payer'");
    db.prepare("UPDATE mv_person SET sales_mode = 'own' WHERE drinks_to_payer = 0").run();   // wer bisher selbst zahlte, bleibt dabei
  }
  flattenPayers();
  // Familienmitgliedschaft (3.16): eigene Zuordnung neben dem Zahler – zeigt auf das Familienoberhaupt (dessen Familienbeitrag deckt die Person ab)
  add('mv_person', 'family_of', 'INTEGER');   // → members(id), Oberhaupt
  if (S('family_of_migrated') !== '1') {   // Bestand: wer bisher über einen Zahler mit Familienbeitrag lief, gehört zu dessen Familie – heutiges Verhalten bleibt
    familyFromPayers();
    SET('family_of_migrated', '1');
  }
}
/** Zahler-Ketten (Kind → Mutter → Vater) auf den Hauptzahler ziehen – die Familie hat genau einen Hauptzahler */
function flattenPayers() {
  for (const r of db.prepare('SELECT p.member_id FROM mv_person p JOIN mv_person q ON q.member_id = p.payer_id WHERE p.payer_id IS NOT NULL AND q.payer_id IS NOT NULL AND q.payer_id != q.member_id').all()) {
    const head = payerOf(r.member_id);
    db.prepare('UPDATE mv_person SET payer_id = ? WHERE member_id = ?').run(head === r.member_id ? null : head, r.member_id);
  }
}
/**
 * Angehörige ohne Familienzuordnung, deren Zahler einen aktiven Familienbeitrag hat, bekommen family_of = Zahler
 * (Migration des Bestands und nach Import/Antrag). Nur Personen ohne eigenen aktiven Grundbeitrag; optional auf eine Liste begrenzt. → Anzahl
 */
function familyFromPayers(memberIds = null, day = today()) {
  const rows = db.prepare(`SELECT p.member_id, p.payer_id FROM mv_person p WHERE p.payer_id IS NOT NULL AND p.payer_id != p.member_id AND p.family_of IS NULL
      AND NOT EXISTS (SELECT 1 FROM mv_person h WHERE h.member_id = p.payer_id AND h.family_of IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM mv_member_fee x JOIN mv_fee g ON g.id = x.fee_id WHERE x.member_id = p.member_id AND g.kind != 'zusatz' AND g.interval != 'einmalig' AND (x.end_date IS NULL OR x.end_date >= ?))`).all(day);
  let n = 0;
  for (const r of rows) if ((!memberIds || memberIds.includes(r.member_id)) && familyFee(r.payer_id)) { db.prepare('UPDATE mv_person SET family_of = ? WHERE member_id = ?').run(r.payer_id, r.member_id); n++; }
  return n;
}
/** Mitglieder-App „Meine Daten“: was Mitglieder sehen und ändern dürfen (Einstellung der Verwaltung) */
const APP_VIEW = { anschrift: 'Anschrift', kontakt: 'Telefon & E-Mail', geburt: 'Geburtsdatum', abteilungen: 'Abteilungen', beitraege: 'Beiträge', familie: 'Familie', posten: 'Forderungen & Zahlungen', bank: 'Bankverbindung & Mandat', einwilligungen: 'Einwilligungen' };
const APP_EDIT = { anschrift: 'Anschrift ändern', kontakt: 'Telefon & E-Mail ändern', bank: 'Bankverbindung ändern (neues SEPA-Mandat mit Unterschrift)', kuendigung: 'Kündigen (Austritt beantragen)', einwilligungen: 'Einwilligungen ändern (erteilen und widerrufen)' };
function appPerms() {
  let cur = {}; try { cur = JSON.parse(S('app_perms', '{}')) || {}; } catch (e) { cur = {}; }
  const pick = (defs, have) => Object.fromEntries(Object.keys(defs).map(k => [k, have && have[k] !== undefined ? Boolean(have[k]) : true]));
  const view = pick(APP_VIEW, cur.view), edit = pick(APP_EDIT, cur.edit);
  if (!view.anschrift) edit.anschrift = false; if (!view.kontakt) edit.kontakt = false; if (!view.bank) edit.bank = false; if (!view.einwilligungen) edit.einwilligungen = false;   // ändern nur, was man sieht
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
  'letter_salutation', 'status', 'entry_date', 'exit_date', 'exit_reason', 'notice_date', 'payer_id', 'family_of', 'drinks_to_payer', 'payment', 'key_no', 'notes', 'member_no'];
const STATUS = { aktiv: 'aktiv', passiv: 'passiv', ehren: 'Ehrenmitglied', ruhend: 'ruhend' };
const PAYMENT = { lastschrift: 'Lastschrift', rechnung: 'Rechnung', bar: 'bar' };
const GENDER = { m: 'männlich', w: 'weiblich', d: 'divers' };

/** Vor-/Nachname fehlen (z. B. Person stammt aus Verkaufskonto oder Import): aus dem bekannten Namen übernehmen */
function fillNames(memberId = null) {
  const rows = db.prepare(`SELECT p.member_id, m.name, m.first_name AS mf, m.last_name AS ml FROM mv_person p JOIN members m ON m.id = p.member_id
    WHERE COALESCE(p.first_name, '') = '' AND COALESCE(p.last_name, '') = '' AND m.kind = 'mitglied' AND m.deleted = 0 ${memberId ? 'AND p.member_id = ?' : ''}`).all(...(memberId ? [memberId] : []));
  const up = db.prepare('UPDATE mv_person SET first_name = ?, last_name = ? WHERE member_id = ?');
  for (const r of rows) { const x = splitName({ name: r.name, first_name: r.mf, last_name: r.ml }); if (x.first || x.last) up.run(x.first || null, x.last || null, r.member_id); }
  return rows.length;
}
function ensurePerson(memberId) {
  if (db.prepare('SELECT 1 FROM mv_person WHERE member_id = ?').get(memberId)) fillNames(memberId);
  else {
    const m = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    const parts = splitName(m || {});
    db.prepare('INSERT INTO mv_person(member_id, first_name, last_name, entry_date) VALUES (?,?,?,?)').run(memberId, parts.first || null, parts.last || null, m ? (m.created_at || '').slice(0, 10) || null : null);
  }
}
/** Vor-/Nachname: eingetragene Felder, sonst Zerlegung des Anzeigenamens wie überall (db.splitPersonName) */
function splitName(m) {
  if (m.first_name || m.last_name) return { first: m.first_name || '', last: m.last_name || '' };
  return splitPersonName(m.name);
}
/** Name im Kern nachziehen (Tablet, App, Getränke zeigen ihn) */
function syncCore(memberId) {
  const p = db.prepare('SELECT first_name, last_name FROM mv_person WHERE member_id = ?').get(memberId);
  if (!p) return;
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  if (name.length >= 2) db.prepare('UPDATE members SET name = ?, first_name = ?, last_name = ? WHERE id = ?').run(name, p.first_name || null, p.last_name || null, memberId);
}
/** Nächste Mitgliedsnummer (nur Vorschlag, reserviert nichts). Einmal vergebene Nummern kommen nie wieder – auch nicht nach Löschen,
 *  Anonymisieren oder Wiedereintritt: die höchste je gespeicherte Nummer merkt sich member_no_max (s. noteMemberNo). */
function nextMemberNo() {
  const max = db.prepare("SELECT MAX(CAST(member_no AS INTEGER)) n FROM mv_person WHERE member_no GLOB '[0-9]*'").get().n || 0;
  const start = parseInt(S('member_no_start', '1'), 10) || 1;
  return String(Math.max(max + 1, (parseInt(S('member_no_max', '0'), 10) || 0) + 1, start));
}
/** gespeicherte Mitgliedsnummer merken (höchste je vergebene) – nach jedem Schreiben einer Nummer aufrufen */
function noteMemberNo(no) {
  if (!/^\d{1,12}$/.test(String(no || ''))) return;
  if (Number(no) > (parseInt(S('member_no_max', '0'), 10) || 0)) SET('member_no_max', String(Number(no)));
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
/*
 * Zwei getrennte Beziehungen:
 *  - Zahler (payer_id): reine Geldbeziehung. Beiträge, Zusatzbeiträge, Verkauf und Lastschrift laufen beim Zahler zusammen –
 *    ein Vater kann so auch für zwei erwachsene Kinder mit je eigenem Beitrag zahlen. → payerOf, payerGroup
 *  - Familienmitgliedschaft (family_of): zeigt auf das Oberhaupt, dessen Familienbeitrag (mv_fee.family) die Person abdeckt.
 *    Eine Ebene; Oberhaupt + höchstens ein weiterer Erwachsener (Partner) + Kinder bis family_child_max. → familyHead, familyMembers
 */
/** Zahlergruppe: Hauptzahler + alle, für die er zahlt */
function payerGroup(memberId) {
  const head = payerOf(memberId);
  const ids = [head, ...db.prepare('SELECT member_id FROM mv_person WHERE payer_id = ? AND member_id != ?').all(head, head).map(r => r.member_id)];
  return { head, members: ids, kind: 'zahler' };
}
/** Oberhaupt der Familienmitgliedschaft dieser Person (sie selbst, wenn andere ihr zugeordnet sind), sonst null */
function familyHead(memberId) {
  const p = db.prepare('SELECT family_of FROM mv_person WHERE member_id = ?').get(memberId);
  if (p && p.family_of && p.family_of !== memberId) return p.family_of;
  return db.prepare('SELECT 1 FROM mv_person WHERE family_of = ? AND member_id != ?').get(memberId, memberId) ? memberId : null;
}
/** Familien-Beitragsart des Oberhaupts (Zeile aus mv_member_fee ⨝ mv_fee) oder null – an einem Tag, oder ohne Tag: jede noch nicht beendete (auch künftig beginnende) */
function familyFee(headId, day = null) {
  const d = day || today();
  return db.prepare(`SELECT mf.*, f.name AS fee_name FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id = ? AND f.family = 1 AND f.kind != 'zusatz' AND f.active = 1
    AND (? IS NULL OR mf.start_date <= ?) AND (mf.end_date IS NULL OR mf.end_date >= ?) ORDER BY mf.start_date DESC LIMIT 1`).get(headId, day, d, d) || null;
}
const childMax = () => parseInt(S('family_child_max', '18'), 10) || 18;
/** Erwachsen im Sinn des Familientarifs: älter als family_child_max – ohne Geburtsdatum gilt die Person als erwachsen */
function isAdult(birth, day = today()) { const a = fees.ageAt(birth, day); return a == null || a > childMax(); }
/** Familienmitgliedschaft: Oberhaupt, Partner, Kinder (mit Alter und Rolle) – [] ohne Familie */
function familyMembers(headId, day = today()) {
  if (!headId) return [];
  const rows = db.prepare(`SELECT m.id, m.name, p.birth_date, p.exit_date FROM mv_person p JOIN members m ON m.id = p.member_id
    WHERE (p.member_id = ? OR p.family_of = ?) AND m.deleted = 0 ORDER BY p.member_id = ? DESC, p.birth_date IS NULL, p.birth_date`).all(headId, headId, headId);
  return rows.map(r => ({ id: r.id, name: r.name, age: fees.ageAt(r.birth_date, day), exit_date: r.exit_date, role: r.id === headId ? 'oberhaupt' : isAdult(r.birth_date, day) ? 'partner' : 'kind' }));
}
/**
 * Gruppe für andere Module (Hook familyOf – Helferdienste „Familienpool“): die Familienmitgliedschaft (Oberhaupt + Angehörige über family_of);
 * besteht keine, die Zahlergruppe (so bleibt eine Familie, die nur über den Zahler verknüpft ist, ein gemeinsamer Pool) – aber nur, wenn
 * niemand in dieser Zahlergruppe einer Familienmitgliedschaft angehört; sonst bildet die Person einen eigenen Pool
 * (z. B. das erwachsene Kind mit eigenem Beitrag, für das der Vater zahlt, während Vater, Mutter und Geschwister die Familie sind).
 * Der Verkauf („beim Zahler“) nutzt bewusst NICHT diese Funktion, sondern payerOf.
 */
function familyOf(memberId) {
  const head = familyHead(memberId);
  if (head) return { head, members: familyMembers(head).map(r => r.id), kind: 'familie' };
  const pg = payerGroup(memberId);
  if (pg.members.some(m => familyHead(m))) return { head: memberId, members: [memberId], kind: 'einzeln' };
  return pg;
}
const isExited = (p, day = today()) => Boolean(p && p.exit_date && p.exit_date < day);
const fullName = p => [p.first_name, p.last_name].filter(Boolean).join(' ');
/** Konto für Lastschriften: aus den zentralen Bankkonten (Einstellungen → Bankkonten), sonst die früher hier eingetragenen Werte */
let bank = null;
function account() {
  if (bank === null) { try { bank = require('../../../src/bank'); } catch (e) { bank = false; } }
  const a = bank ? bank.pick({ id: Number(S('sepa_account')) || null }) : null;
  return a ? { id: a.id, name: a.name, iban: a.iban, bic: a.bic || '', bank: a.bank || '', central: true } : { id: null, name: '', iban: S('club_iban'), bic: S('club_bic'), bank: S('club_bank'), central: false };
}

/* ---------- Beiträge ---------- */

module.exports = {
  init(o) {
    ({ db, getSetting, setSetting } = o); createTables(); migrate();
    noteMemberNo(db.prepare("SELECT MAX(CAST(member_no AS INTEGER)) n FROM mv_person WHERE member_no GLOB '[0-9]*'").get().n);   // Bestand: höchste Nummer gilt als vergeben
  },
  S, SET, account, today, nowTs, PERSON_FIELDS, STATUS, PAYMENT, GENDER, ensurePerson, fillNames, splitName, syncCore, nextMemberNo, noteMemberNo, mandateRefFor, hist,
  payerOf, payerGroup, familyOf, familyHead, familyFee, familyMembers, familyFromPayers, isAdult, childMax, flattenPayers, appPerms, APP_VIEW, APP_EDIT, periodStart, zusatzStart, isExited, fullName, sepa, fees,
  sha256: b => crypto.createHash('sha256').update(b).digest('hex'),
};
