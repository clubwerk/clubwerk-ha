'use strict';
/* =====================================================================================================
   Modul „Mitgliederverwaltung“
   Stammdaten, Abteilungen, Beiträge, Familien/Zahler, Ein- und Austritt, Dokumente, Beitragslauf mit SEPA-Lastschrift,
   offene Posten, Rechnungen/Mahnungen, digitale Beitrittserklärung mit Unterschrift, Auswertungen, Datenschutz.
   Die Person selbst bleibt im Kern („members“) – Getränke, Zugang, Zeiterfassung und App greifen auf dieselbe Person zu.
   ===================================================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./lib/store');
const { sepa, fees } = store;
const { S, SET, today, nowTs } = store;

let ageScanFn = null, ageForFn = null, shared = null;   // Altersstufen prüfen (lib/agecheck.js)
let C;   // Kontext (ctx der Erweiterung + Helfer)
const DOC_MAX = 15 * 1024 * 1024;
const DOC_TYPES = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic', txt: 'text/plain', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const DOC_KIND = { antrag: 'Beitrittserklärung', mandat: 'SEPA-Mandat', kuendigung: 'Kündigung', nachweis: 'Nachweis', schriftverkehr: 'Schriftverkehr', sonstiges: 'Sonstiges' };
const isDate = fees.isDate;
const txt = (v, max = 120) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
const one = (v, max) => txt(v, max).replace(/[\r\n]+/g, ' ');
const mailOk = v => !v || /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i.test(String(v));
const { euro, deD } = require('../../src/util');
const SALES = { payer: 'über den Hauptzahler', own_payer: 'eigener Eintrag, zahlt der Hauptzahler', own: 'eigener Eintrag, zahlt selbst' };

/* ---------------------------------------------------------------- Lesen */
function personRow(id) {
  return C.db.prepare(`SELECT m.id, m.name, m.kind, m.active, m.pending, m.pin_hash IS NOT NULL AS has_pin, p.*
    FROM members m LEFT JOIN mv_person p ON p.member_id = m.id WHERE m.id = ? AND m.deleted = 0`).get(id);
}
/** Zusatzbeitrag einer Abteilungszugehörigkeit (fest gewählt oder nach Alter) → { fee, auto, free } */
function zusatzFor(md, birth, day = today()) {
  if (md.fee_free) return { fee: null, free: true };
  if (md.fee_id) return { fee: C.db.prepare('SELECT * FROM mv_fee WHERE id = ?').get(md.fee_id) || null, auto: false };
  const list = C.db.prepare("SELECT * FROM mv_fee WHERE kind = 'zusatz' AND active = 1 AND department_id = ? ORDER BY COALESCE(age_min, 0), COALESCE(age_max, 999)").all(md.department_id);
  if (!list.length) return { fee: null, none: true };
  const p = fees.pickByAge(list, birth, day);
  const ages = list.some(f => f.age_min != null || f.age_max != null);
  return { fee: p.fee, auto: true, nomatch: !p.fee, age: p.age, assumed: p.assumed && ages };
}
const deptRows = id => {
  const birth = (C.db.prepare('SELECT birth_date FROM mv_person WHERE member_id = ?').get(id) || {}).birth_date;
  return C.db.prepare(`SELECT md.*, d.name FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id WHERE md.member_id = ? ORDER BY md.exit_date IS NOT NULL, d.sort, d.name`).all(id)
    .map(md => { const z = zusatzFor(md, birth); return { ...md, zusatz: z.fee ? { id: z.fee.id, name: z.fee.name, cents: z.fee.cents, interval: z.fee.interval, auto: z.auto, assumed: Boolean(z.assumed) } : null, zusatz_free: Boolean(z.free), zusatz_none: Boolean(z.none), zusatz_nomatch: Boolean(!z.fee && z.nomatch), zusatz_age: z.age ?? null }; });
};
const feeRows = id => C.db.prepare(`SELECT mf.*, f.name, f.cents AS fee_cents, f.interval, f.family, f.department_id, f.age_min, f.age_max FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id
  WHERE mf.member_id = ? ORDER BY mf.end_date IS NOT NULL, mf.start_date DESC`).all(id).map(r => ({ ...r, eff_cents: r.cents != null ? r.cents : r.fee_cents }));
const bankRow = id => C.db.prepare('SELECT * FROM mv_bank WHERE member_id = ?').get(id) || null;

/** Mandat einsatzbereit? → { ok, reason } */
function mandateState(b) {
  if (!b || !b.iban) return { ok: false, reason: 'keine Bankverbindung' };
  if (!sepa.checkIban(b.iban).ok) return { ok: false, reason: 'IBAN ungültig' };
  if (!b.mandate_ref || !b.mandate_date) return { ok: false, reason: 'kein SEPA-Mandat' };
  if (b.mandate_revoked) return { ok: false, reason: 'Mandat widerrufen' };
  const last = b.mandate_last_used || b.mandate_date;
  if (last && fees.addMonths(last, 36) < today()) return { ok: false, reason: 'Mandat verfallen (36 Monate ungenutzt)' };
  return { ok: true };
}

/** Lastschrift Pflicht (Einstellung)? Familienmitglieder und wer über einen Zahler zahlt, sind ausgenommen */
const sepaRequired = () => S('sepa_required', '0') === '1';
const payNeedsSepa = p => !p.payer_id && !p.family_of;
/** Was einem (nicht ausgetretenen) Mitglied an Pflichtangaben fehlt – für die deutliche Meldung beim Mitglied */
function missingOf(p, bank, hasFee) {
  if (p.anonymized_at || (p.exit_date && p.exit_date < today())) return [];
  if (!p.member_id) return ['Mitgliedsdaten (Adresse, Geburtsdatum, Kontakt)', 'Beitrag', 'Zahlungsdaten'];
  const out = [];
  if (!hasFee && !p.family_of && p.status !== 'ehren') out.push('Beitrag');
  if (payNeedsSepa(p)) {
    if ((p.payment || 'lastschrift') === 'lastschrift') { const ms = mandateState(bank); if (!ms.ok) out.push(`Konto & Mandat: ${ms.reason}`); }
    else if (sepaRequired()) out.push('Zahlart Lastschrift (laut Einstellungen Pflicht)');
  }
  return out;
}

function listRows(q = {}) {
  const day = today();
  const rows = C.db.prepare(`SELECT m.id, m.name, m.active, m.pending, p.member_no, p.first_name, p.last_name, p.birth_date, p.gender, p.status, p.entry_date, p.exit_date,
      p.payer_id, p.family_of, p.payment, p.email, p.mobile, p.phone, p.city, p.zip, p.street, p.anonymized_at, p.member_id IS NOT NULL AS complete,
      (SELECT group_concat(d.name, ', ') FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id WHERE md.member_id = m.id AND (md.exit_date IS NULL OR md.exit_date >= ?)) AS depts,
      (SELECT group_concat(md.department_id) FROM mv_member_department md WHERE md.member_id = m.id AND (md.exit_date IS NULL OR md.exit_date >= ?)) AS dept_ids,
      (SELECT group_concat(f.name, ', ') FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id = m.id AND (mf.end_date IS NULL OR mf.end_date >= ?)) AS fees,
      (SELECT group_concat(mf.fee_id) FROM mv_member_fee mf WHERE mf.member_id = m.id AND (mf.end_date IS NULL OR mf.end_date >= ?)) AS fee_ids,
      b.iban AS iban_raw, b.mandate_ref, b.mandate_date, b.mandate_last_used, b.mandate_revoked,
      (SELECT name FROM members WHERE id = p.payer_id) AS payer_name,
      (SELECT COUNT(*) FROM mv_person c WHERE c.payer_id = m.id AND c.member_id != m.id) AS dependents,
      (SELECT name FROM members WHERE id = p.family_of) AS family_head_name,
      (SELECT COUNT(*) FROM mv_person c WHERE c.family_of = m.id AND c.member_id != m.id) AS family_count,
      (SELECT COALESCE(SUM(cents),0) FROM mv_charge c WHERE c.member_id = m.id AND c.status = 'offen') AS open_cents,
      (SELECT COUNT(*) FROM mv_age_notice a WHERE a.member_id = m.id AND a.status = 'offen') AS age_open,
      (SELECT group_concat(kind) FROM mv_change x WHERE x.member_id = m.id AND x.status = 'offen' AND x.kind IN ('eintritt','austritt','rueckkehr')) AS pend
    FROM members m LEFT JOIN mv_person p ON p.member_id = m.id LEFT JOIN mv_bank b ON b.member_id = m.id
    WHERE m.kind = 'mitglied' AND m.deleted = 0 ORDER BY name_key(m.name, m.kind)`).all(day, day, day, day);
  return rows.map(r => {
    const exited = Boolean(r.exit_date && r.exit_date < day);
    const ms = r.payment === 'lastschrift' && !r.payer_id ? mandateState({ iban: r.iban_raw, mandate_ref: r.mandate_ref, mandate_date: r.mandate_date, mandate_last_used: r.mandate_last_used, mandate_revoked: r.mandate_revoked }) : null;
    return { id: r.id, name: r.name, member_no: r.member_no, first_name: r.first_name, last_name: r.last_name, birth_date: r.birth_date, gender: r.gender, age: fees.ageAt(r.birth_date, day),
      status: r.anonymized_at ? 'anonym' : exited ? 'ausgetreten' : r.status || 'aktiv', entry_date: r.entry_date, exit_date: r.exit_date, leaving: Boolean(r.exit_date && !exited),
      depts: r.depts || '', dept_ids: r.dept_ids ? r.dept_ids.split(',').map(Number) : [], fees: r.fees || '', fee_ids: r.fee_ids ? r.fee_ids.split(',').map(Number) : [],
      payer_id: r.payer_id, payer_name: r.payer_name, dependents: r.dependents, family_of: r.family_of, family_head_name: r.family_head_name, family_count: r.family_count, payment: r.payment || 'lastschrift', email: r.email, mobile: r.mobile || r.phone, city: r.city,
      complete: Boolean(r.complete), pending: Boolean(r.pending), open_cents: r.open_cents,
      issues: [r.family_of && r.fee_ids && 'eigener Beitrag trotz Familienmitgliedschaft', !r.complete && 'ohne Mitgliedsdaten', r.complete && !exited && !r.anonymized_at && sepaRequired() && payNeedsSepa(r) && r.payment !== 'lastschrift' && 'Zahlart nicht Lastschrift', r.complete && !r.family_of && !r.fee_ids && !exited && r.status !== 'ehren' && 'kein Beitrag', ms && !ms.ok && ms.reason, r.complete && !r.email && !r.payer_id && !exited && 'keine E-Mail', r.age_open && !exited && 'Altersstufe prüfen', ...(r.pend ? r.pend.split(',').map(k => ({ eintritt: 'Eintritt wartet auf Bestätigung', austritt: 'Austritt wartet auf Bestätigung', rueckkehr: 'Rückkehr wartet auf Bestätigung' })[k]) : [])].filter(Boolean) };
  }).filter(r => {
    if (q.status === 'aktuell' && (r.status === 'ausgetreten' || r.status === 'anonym')) return false;
    if (q.status && !['aktuell', 'alle'].includes(q.status) && r.status !== q.status) return false;
    if (q.dept && !r.dept_ids.includes(Number(q.dept))) return false;
    if (q.fee && !r.fee_ids.includes(Number(q.fee))) return false;
    if (q.issue === '1' && !r.issues.length) return false;
    if (q.q) {
      const s = String(q.q).toLowerCase();
      if (![r.name, r.member_no, r.email, r.city].some(v => v && String(v).toLowerCase().includes(s))) return false;
    }
    return true;
  });
}

function detail(id, user) {
  const p = personRow(id);
  if (!p) return null;
  const perms = user.perms;
  const bank = bankRow(id);
  // Zahlergruppe (Geld) und Familienmitgliedschaft (Familienbeitrag) getrennt – siehe store.js
  const pg = store.payerGroup(id);
  const payerRows = pg.members.length > 1 ? C.db.prepare(`SELECT m.id, m.name, p.birth_date, p.sales_mode FROM members m LEFT JOIN mv_person p ON p.member_id = m.id WHERE m.id IN (${pg.members.map(() => '?').join(',')})`).all(...pg.members)
    .map(r => ({ id: r.id, name: r.name, age: fees.ageAt(r.birth_date, today()), head: r.id === pg.head, sales_mode: r.sales_mode || 'payer' })) : [];
  const famHead = store.familyHead(id);
  const famRows = famHead ? store.familyMembers(famHead).map(r => ({ id: r.id, name: r.name, age: r.age, role: r.role, head: r.role === 'oberhaupt' })) : [];
  const appState = C.require('./memberapp').memberState(id);
  let drinksOpen = null;
  try { if (C.drinks.active()) { const o = C.drinks.open().rows.find(r => r.id === id); drinksOpen = o ? o.total_cents : 0; } } catch (e) { drinksOpen = null; }
  return {
    person: { ...p, ...(!p.first_name && !p.last_name ? (x => ({ first_name: x.first || null, last_name: x.last || null }))(store.splitName({ name: p.name })) : {}), consents: JSON.parse(p.consents || '{}'), extra: JSON.parse(p.extra || '{}'), age: fees.ageAt(p.birth_date, today()), exited: store.isExited(p), complete: Boolean(p.member_id), photo: C.require('./photos').version(id) },
    bank: bank ? (perms.includes('mitglieder_bank') ? { ...bank, state: mandateState(bank) } : { masked: sepa.maskIban(bank.iban), mandate_ref: bank.mandate_ref, mandate_date: bank.mandate_date, state: mandateState(bank), hidden: true }) : null,
    missing: missingOf(p, bank, feeRows(id).some(f => !f.end_date || f.end_date >= today())),
    departments: deptRows(id), fees: feeRows(id), payerGroup: payerRows, payer: p.payer_id ? personRow(store.payerOf(id)) : null,
    family: famRows, familyHead: famHead && famHead !== id ? (x => x ? { id: x.id, name: x.name } : null)(personRow(famHead)) : null, familyFee: Boolean(store.familyFee(id)),
    honors: C.db.prepare('SELECT * FROM mv_honor WHERE member_id = ? ORDER BY date DESC').all(id), no_congrats: shared.congratsOff(id),
    functions: C.db.prepare('SELECT * FROM mv_function WHERE member_id = ? ORDER BY to_date IS NOT NULL, from_date DESC').all(id),
    documents: perms.includes('mitglieder_dokumente') ? C.db.prepare('SELECT id, kind, title, mime, size, created_at, by_user FROM mv_document WHERE member_id = ? ORDER BY created_at DESC').all(id) : null,
    charges: perms.includes('mitglieder_finanzen') ? C.db.prepare(`SELECT c.*, (SELECT name FROM members WHERE id = c.for_member_id) AS for_name FROM mv_charge c WHERE c.member_id = ? OR c.for_member_id = ? ORDER BY c.due_date DESC, c.id DESC LIMIT 200`).all(id, id) : null,
    history: C.db.prepare('SELECT * FROM mv_history WHERE member_id = ? ORDER BY id DESC LIMIT 150').all(id),
    app: { device: appState.device, access: appState.access }, drinksOpen,
    changes: C.db.prepare("SELECT id, kind, created_at FROM mv_change WHERE member_id = ? AND status = 'offen'").all(id),
    ageNotices: ageForFn ? ageForFn(id) : [],
  };
}

/* ---------------------------------------------------------------- Schreiben */
function personInput(b, cur = {}) {
  const out = {};
  const set = (k, v) => { if (b[k] !== undefined) out[k] = v; };
  set('salutation', one(b.salutation, 20) || null);
  set('title', one(b.title, 30) || null);
  set('first_name', one(b.first_name, 60) || null);
  set('last_name', one(b.last_name, 60) || null);
  set('birth_date', isDate(b.birth_date) ? b.birth_date : null);
  set('gender', ['m', 'w'].includes(b.gender) ? b.gender : null);
  set('street', one(b.street, 80) || null); set('zip', one(b.zip, 10) || null); set('city', one(b.city, 60) || null);
  set('country', one(b.country, 40) || null); set('address_extra', one(b.address_extra, 80) || null);
  set('phone', one(b.phone, 40) || null); set('mobile', one(b.mobile, 40) || null);
  set('email', one(b.email, 120).toLowerCase() || null);
  set('letter_salutation', one(b.letter_salutation, 80) || null);
  set('status', store.STATUS[b.status] ? b.status : 'aktiv');
  set('entry_date', isDate(b.entry_date) ? b.entry_date : null);
  set('key_no', one(b.key_no, 30) || null);
  set('notes', txt(b.notes, 2000) || null);
  set('payment', store.PAYMENT[b.payment] ? b.payment : 'lastschrift');
  set('member_no', one(b.member_no, 20) || null);
  if (out.email && !mailOk(out.email)) return { error: 'Die E-Mail-Adresse sieht nicht gültig aus.' };
  const first = out.first_name !== undefined ? out.first_name : cur.first_name, last = out.last_name !== undefined ? out.last_name : cur.last_name;
  if (!last || String(last).length < 2) return { error: 'Bitte den Nachnamen eintragen.' };
  if (!first && !cur.member_id && b.first_name === undefined) return { error: 'Bitte den Vornamen eintragen.' };
  if (out.birth_date && out.birth_date > today()) return { error: 'Das Geburtsdatum liegt in der Zukunft.' };
  if (out.member_no) {
    const dup = C.db.prepare('SELECT member_id FROM mv_person WHERE member_no = ? AND member_id != ?').get(out.member_no, cur.member_id || 0);
    if (dup) return { error: `Die Mitgliedsnummer ${out.member_no} ist schon vergeben.` };
  }
  return { fields: out };
}
const LABEL = { salutation: 'Anrede', title: 'Titel', first_name: 'Vorname', last_name: 'Nachname', birth_date: 'Geburtsdatum', gender: 'Geschlecht', street: 'Straße', zip: 'PLZ', city: 'Ort', country: 'Land',
  address_extra: 'Adresszusatz', phone: 'Telefon', mobile: 'Mobil', email: 'E-Mail', letter_salutation: 'Briefanrede', status: 'Status', entry_date: 'Eintritt', exit_date: 'Austritt', exit_reason: 'Austrittsgrund',
  notice_date: 'Kündigung eingegangen', payer_id: 'Zahler', family_of: 'Familienmitgliedschaft bei', drinks_to_payer: 'Verkauf beim Zahler', payment: 'Zahlungsart', key_no: 'Schlüsselnummer', notes: 'Notizen', member_no: 'Mitgliedsnummer',
  iban: 'IBAN', holder: 'Kontoinhaber', bic: 'BIC', bank: 'Kreditinstitut', mandate_ref: 'Mandatsreferenz', mandate_date: 'Mandat unterschrieben', mandate_revoked: 'Mandat widerrufen' };

/** Felder, die ein Abteilungsadmin nicht ändern darf (Vereinsverwaltung) */
const SCOPE_LOCKED = ['member_no', 'status', 'entry_date', 'key_no', 'payment', 'notes'];

function savePerson(id, fields, user) {
  store.ensurePerson(id);
  const cur = C.db.prepare('SELECT * FROM mv_person WHERE member_id = ?').get(id);
  const keys = Object.keys(fields).filter(k => store.PERSON_FIELDS.includes(k));
  if (!keys.length) return;
  const shown = (k, v) => k === 'notes' ? (v ? '…' : '') : (k === 'payer_id' || k === 'family_of') && v ? (C.db.prepare('SELECT name FROM members WHERE id = ?').get(v) || {}).name || v : v;   // Verlauf: Namen statt Nummern
  for (const k of keys) store.hist(id, user, LABEL[k] || k, shown(k, cur[k]), shown(k, fields[k]));
  C.db.prepare(`UPDATE mv_person SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE member_id = ?`).run(...keys.map(k => fields[k]), nowTs(), id);
  if (keys.includes('member_no')) store.noteMemberNo(fields.member_no);
  if (keys.includes('first_name') || keys.includes('last_name')) store.syncCore(id);
}

/** neue Person (Kern + Vereinsdaten) → id */
function createPerson(fields, user, { memberNo } = {}) {
  const name = [fields.first_name, fields.last_name].filter(Boolean).join(' ');
  const id = Number(C.db.prepare("INSERT INTO members(name, kind, first_name, last_name) VALUES (?, 'mitglied', ?, ?)").run(name, fields.first_name || null, fields.last_name || null).lastInsertRowid);
  const no = memberNo || fields.member_no || store.nextMemberNo();
  C.db.prepare('INSERT INTO mv_person(member_id, member_no, entry_date) VALUES (?,?,?)').run(id, no, fields.entry_date || today());
  store.noteMemberNo(no);
  const f = { ...fields }; delete f.member_no;
  savePerson(id, f, user);
  C.db.prepare('DELETE FROM mv_history WHERE member_id = ?').run(id);   // beim Anlegen kein Änderungsverlauf
  store.hist(id, user, 'angelegt', null, name);
  return id;
}

/* ---------------------------------------------------------------- Dokumente */
let DOC_DIR;
function docType(buf, name) {
  const ext = String(name || '').toLowerCase().split('.').pop();
  if (buf.slice(0, 5).toString() === '%PDF-') return { ext: 'pdf', mime: DOC_TYPES.pdf };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: DOC_TYPES.png };
  if (buf[0] === 0xff && buf[1] === 0xd8) return { ext: 'jpg', mime: DOC_TYPES.jpg };
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { ext: 'webp', mime: DOC_TYPES.webp };
  if (buf.slice(4, 12).toString() === 'ftypheic' || buf.slice(4, 12).toString() === 'ftypmif1') return { ext: 'heic', mime: DOC_TYPES.heic };
  if (ext === 'docx' && buf[0] === 0x50 && buf[1] === 0x4b) return { ext: 'docx', mime: DOC_TYPES.docx };
  if (ext === 'txt' && !buf.includes(0)) return { ext: 'txt', mime: DOC_TYPES.txt };
  return null;
}
function saveDocument(memberId, buf, { kind = 'sonstiges', title, filename, user, applicationId = null } = {}) {
  if (!buf || !buf.length) throw new Error('Keine Datei empfangen.');
  if (buf.length > DOC_MAX) throw new Error('Die Datei ist zu groß (max. 15 MB).');
  const t = docType(buf, filename);
  if (!t) throw new Error('Bitte PDF, Foto (JPG, PNG, WebP, HEIC), Word- oder Textdatei hochladen.');
  fs.mkdirSync(DOC_DIR, { recursive: true, mode: 0o700 });
  const file = `${memberId || 'antrag'}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}.${t.ext}`;
  C.require('./vault').writeFile(path.join(DOC_DIR, file), buf);   // verschlüsselt, wenn der Tresor eingeschaltet ist
  const id = Number(C.db.prepare('INSERT INTO mv_document(member_id, application_id, kind, title, file, mime, size, sha256, by_user) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(memberId || null, applicationId, DOC_KIND[kind] ? kind : 'sonstiges', one(title || filename || DOC_KIND[kind] || 'Dokument', 120), file, t.mime, buf.length, store.sha256(buf), user || null).lastInsertRowid);
  return id;
}
function deleteDocumentFile(doc) { try { fs.unlinkSync(path.join(DOC_DIR, path.basename(doc.file))); } catch (e) { /* schon weg */ } }

/* ---------------------------------------------------------------- Austritt / Anonymisieren */
function exitMember(id, { exit_date, reason, notice_date, endFees = true, endDepts = true }, user) {
  const p = C.db.prepare('SELECT * FROM mv_person WHERE member_id = ?').get(id);
  savePerson(id, { exit_date, exit_reason: reason || null, notice_date: notice_date || p.notice_date || null }, user);
  if (endFees) C.db.prepare('UPDATE mv_member_fee SET end_date = ? WHERE member_id = ? AND (end_date IS NULL OR end_date > ?)').run(exit_date, id, exit_date);
  if (endDepts) C.db.prepare('UPDATE mv_member_department SET exit_date = ? WHERE member_id = ? AND (exit_date IS NULL OR exit_date > ?)').run(exit_date, id, exit_date);
}
/** Nach Austritt: personenbezogene Daten unwiderruflich entfernen; Statistikdaten (Geburtsjahr, Geschlecht, Ein-/Austritt, Abteilungen) und Buchungen bleiben */
function anonymize(id, user) {
  const p = C.db.prepare('SELECT * FROM mv_person WHERE member_id = ?').get(id);
  if (!p) throw new Error('Nicht gefunden.');
  const label = `Anonym ${p.member_no || id}`;
  C.db.transaction(() => {
    C.db.prepare(`UPDATE mv_person SET salutation = NULL, title = NULL, first_name = NULL, last_name = ?, birth_date = CASE WHEN birth_date IS NULL THEN NULL ELSE substr(birth_date,1,4) || '-07-01' END,
      street = NULL, zip = NULL, city = NULL, address_extra = NULL, phone = NULL, mobile = NULL, email = NULL, letter_salutation = NULL, key_no = NULL, notes = NULL,
      consents = '{}', extra = '{}', anonymized_at = ? WHERE member_id = ?`).run(label, nowTs(), id);
    C.db.prepare('DELETE FROM mv_bank WHERE member_id = ?').run(id);
    for (const d of C.db.prepare('SELECT * FROM mv_document WHERE member_id = ?').all(id)) deleteDocumentFile(d);
    C.db.prepare('DELETE FROM mv_document WHERE member_id = ?').run(id);
    C.db.prepare('DELETE FROM mv_history WHERE member_id = ?').run(id);
    C.db.prepare('DELETE FROM mv_change WHERE member_id = ?').run(id);
    shared.congratsForget(id);   // Gratulationen samt Notizen
    C.db.prepare("UPDATE members SET name = ?, first_name = NULL, last_name = ?, pin_hash = NULL, active = 0 WHERE id = ?").run(label, label, id);
    C.db.prepare('DELETE FROM member_devices WHERE member_id = ?').run(id);
    C.db.prepare('DELETE FROM member_access WHERE member_id = ?').run(id);
  })();
  store.hist(id, user, 'anonymisiert', null, label);
  anonRemember(id, p);
}
/* Anonymisierungen überleben das Zurückspielen einer Sicherung: Clubwerk merkt sich außerhalb der Datenbank nur Konto, Mitgliedsnummer und
   Eintritt (keine Namen) und anonymisiert diese Mitglieder nach dem Start erneut. Fehlt das Konto oder passt es nicht mehr, fällt der Eintrag
   sofort weg – so trifft es nie ein später neu angelegtes Mitglied mit derselben Nummer. */
const anonFile = () => require('path').join(C.require('./db').DATA_DIR, 'anonymisiert.json');
function anonList() { try { const a = JSON.parse(require('fs').readFileSync(anonFile(), 'utf8')); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function anonSave(list) { try { const f = anonFile(); require('fs').writeFileSync(f + '.neu', JSON.stringify(list)); require('fs').renameSync(f + '.neu', f); } catch (e) { console.error('Mitgliederverwaltung – Anonymisierungen merken:', e.message); } }
function anonRemember(id, p) { anonSave([...anonList().filter(e => e.id !== id), { id, no: p.member_no || null, entry: p.entry_date || null }]); }
function anonReapply() {
  const list = anonList(); if (!list.length) return;
  const keep = []; let n = 0;
  for (const e of list) {
    const p = C.db.prepare('SELECT member_no, entry_date, anonymized_at FROM mv_person WHERE member_id = ?').get(e.id);
    if (!p || (p.member_no || null) !== e.no || (p.entry_date || null) !== e.entry) continue;
    keep.push(e);
    if (!p.anonymized_at) { try { anonymize(e.id, 'Clubwerk'); n++; } catch (err) { console.error('Mitgliederverwaltung – erneut anonymisieren:', err.message); } }
  }
  anonSave(keep);
  if (n) C.audit(null, 'Mitglieder erneut anonymisiert', `${n} ${n === 1 ? 'Mitglied war' : 'Mitglieder waren'} schon anonymisiert (Sicherung zurückgespielt)`);
}

/* ---------------------------------------------------------------- tägliche Aufgaben */
function daily() {
  try {
    if (!C.isActive()) return;
    const day = today();
    // Ausgetretene: am Tablet/in der App nicht mehr sichtbar, App-Zugang endet
    const gone = C.db.prepare(`SELECT p.member_id FROM mv_person p JOIN members m ON m.id = p.member_id WHERE p.exit_date IS NOT NULL AND p.exit_date < ? AND m.active = 1`).all(day);
    for (const g of gone) {
      C.db.prepare('UPDATE members SET active = 0 WHERE id = ?').run(g.member_id);
      C.db.prepare("UPDATE member_access SET blocked = 1 WHERE member_id = ?").run(g.member_id);
      C.audit(null, 'Mitglied ausgetreten (automatisch ausgeblendet)', C.db.prepare('SELECT name FROM members WHERE id = ?').get(g.member_id).name);
    }
    if (ageScanFn && !C.require('./vault').locked()) ageScanFn();   // Geburtsdaten sind im gesperrten Tresor nicht lesbar
  } catch (e) { console.error('Mitgliederverwaltung (täglich):', e.message); }
}

/* ---------------------------------------------------------------- Aktivierung */
function activate(ctx) {
  C = ctx;
  store.init({ db: ctx.db, getSetting: ctx.getSetting, setSetting: ctx.setSetting });
  DOC_DIR = path.join(ctx.require('./db').DATA_DIR, 'mitglieder-dokumente');
  ctx.require('./vault').onUnlock(() => { if (ageScanFn && ctx.isActive()) ageScanFn(); });   // nach dem Entsperren nachholen
  try { store.fillNames(); } catch (e) { /* Tabellen entstehen beim ersten Start */ }
  const { need, bad, int } = ctx;
  const admin = ctx.admin;
  const P = need('mitglieder'), PB = need('mitglieder_bank'), PD = need('mitglieder_dokumente');
  const uname = req => req.user.name || req.user.username;
  const ar = fn => ctx.asyncRoute(fn);
  const express = ctx.require('express');

  /* ---------- Abteilungsadmins ----------
     Wer „Mitglieder“ nur über eine Rolle „nur eigene Abteilung(en)“ hat, sieht und bearbeitet nur Mitglieder dieser Abteilungen:
     Stammdaten, Abteilungszugehörigkeit (eigene Abteilungen), Ehrungen/Ämter, Austritt & Rückkehr, neue Mitglieder (werden der Abteilung
     zugeordnet) und Anträge, in denen jemand für diese Abteilung angekreuzt ist. Alles andere (Beiträge, Einzug, Katalog, Einstellungen,
     Import, Auswertungen, Datenauskunft, Anonymisieren) bleibt der Vereinsverwaltung vorbehalten. */
  const scopeOf = req => ((req.user.deptOnly || []).includes('mitglieder') ? (req.user.depts || []) : null);
  const inScope = (memberId, depts) => Boolean(ctx.db.prepare(`SELECT 1 FROM mv_member_department WHERE member_id = ? AND department_id IN (${depts.map(() => '?').join(',') || 'NULL'}) AND (exit_date IS NULL OR exit_date >= ?)`).get(memberId, ...depts, today()));
  const appInScope = (a, depts) => { try { return JSON.parse(a.data).persons.some(p => (p.departments || []).some(d => depts.includes(Number(d)))); } catch (e) { return false; } };
  /** Ein- und Austritte von Abteilungsleitungen bestätigt die Vereinsverwaltung (Einstellung, Standard an) */
  const needConfirm = req => Boolean(req.mvScope) && S('scope_confirm', '1') === '1';
  function scopeChange(req, memberId, kind, data, text) {
    ctx.db.prepare('INSERT INTO mv_change(member_id, kind, data, created_by) VALUES (?,?,?,?)').run(memberId, kind, JSON.stringify(data), uname(req));
    store.hist(memberId, uname(req), 'Zur Bestätigung', null, text);
    ctx.audit(req.user, 'Abteilung: zur Bestätigung gemeldet', text);
    if (shared && shared.notifyBoard) shared.notifyBoard(`Zur Bestätigung: ${text}`, [`${req.user.name || req.user.username} (Abteilungsleitung) hat gemeldet: ${text}.`, '', 'Bitte in der Verwaltung unter Mitgliederverwaltung → Anträge bestätigen oder ablehnen.']).catch(() => {});
  }
  /** Hinweise, die ein Abteilungsadmin selbst erledigen kann (Beiträge, Bank und Mandat macht die Vereinsverwaltung) */
  const scopedIssues = list => (list || []).filter(i => !/Mandat|Bankverbindung|IBAN|Beitrag|Altersstufe/.test(i));
  const SCOPED = [   // [Methode, Pfad, Prüfung]  Prüfung: m = Mitglied :id, md = Abteilungszugehörigkeit, h/f = Ehrung/Amt, a = Antrag, ch = Änderungswunsch, - = keine
    ['GET', /^\/meta$/, '-'], ['GET', /^\/list$/, '-'], ['GET', /^\/iban-check$/, '-'], ['GET', /^\/applications$/, '-'], ['GET', /^\/applications\/config$/, '-'], ['GET', /^\/changes$/, '-'],
    ['POST', /^\/member$/, 'new'], ['POST', /^\/member\/new-document$/, '-'], ['GET', /^\/member\/(\d+)$/, 'm'], ['PUT', /^\/member\/(\d+)$/, 'm'],
    ['POST', /^\/member\/(\d+)\/(departments|honors|functions|exit|reenter|exit-document)$/, 'm'],
    ['PUT', /^\/md\/(\d+)$/, 'md'], ['DELETE', /^\/md\/(\d+)$/, 'md'], ['DELETE', /^\/honors\/(\d+)$/, 'h'], ['DELETE', /^\/functions\/(\d+)$/, 'f'],
    ['GET', /^\/applications\/(\d+)$/, 'a'], ['POST', /^\/applications\/(\d+)\/(accept|reject|code)$/, 'a'], ['PUT', /^\/applications\/(\d+)$/, 'a'], ['GET', /^\/applications\/(\d+)\/pdf$/, 'a'], ['POST', /^\/applications$/, 'newapp'],
    ['GET', /^\/changes\/(\d+)\/signature$/, 'ch'], ['POST', /^\/changes\/(\d+)\/(accept|reject)$/, 'ch'],
  ];
  admin.use((req, res, next) => {
    const depts = req.user ? scopeOf(req) : null;
    if (!depts || /^\/congrats(\/(members|me|off\/\d+))?\/?$/.test(req.path)) return next();   // Gratulationen hängen am eigenen Recht, nicht an der Abteilung
    req.mvScope = depts;
    const no = msg => res.status(403).json({ error: msg || 'Als Abteilungsadmin kannst du nur Mitglieder deiner Abteilung(en) bearbeiten – das hier macht die Vereinsverwaltung.' });
    if (!depts.length) return no('Dir ist noch keine Abteilung zugeordnet – bitte an einen Admin wenden.');
    const path = req.path.replace(/\/+$/, '') || '/';
    const hit = SCOPED.find(([m, re]) => m === req.method && re.test(path));
    if (!hit) return no();
    const id = Number((path.match(hit[1]) || [])[1]);
    const b = req.body || {};
    const row = (sql, x) => ctx.db.prepare(sql).get(x);
    let ok = true;
    if (hit[2] === 'm') ok = inScope(id, depts) && (!/departments$/.test(path) || depts.includes(Number(b.department_id)));
    else if (hit[2] === 'md') { const r = row('SELECT * FROM mv_member_department WHERE id = ?', id); ok = Boolean(r && depts.includes(r.department_id)) && (req.method !== 'PUT' || (b.fee_id === undefined && b.fee_free === undefined && b.booked_until === undefined)); }
    else if (hit[2] === 'h' || hit[2] === 'f') { const r = row(`SELECT member_id FROM ${hit[2] === 'h' ? 'mv_honor' : 'mv_function'} WHERE id = ?`, id); ok = Boolean(r && inScope(r.member_id, depts)); }
    else if (hit[2] === 'a') { const a = row('SELECT * FROM mv_application WHERE id = ?', id); ok = Boolean(a && appInScope(a, depts)); }
    else if (hit[2] === 'ch') {
      const c = row('SELECT member_id, kind FROM mv_change WHERE id = ?', id);
      const confirmKinds = ['eintritt', 'austritt', 'rueckkehr', ...(S('scope_confirm', '1') === '1' ? ['kuendigung'] : [])];
      ok = Boolean(c && inScope(c.member_id, depts) && c.kind !== 'bank' && !(/accept$/.test(path) && confirmKinds.includes(c.kind)));
    }
    else if (hit[2] === 'new') ok = depts.includes(Number(b.department_id)) || (depts.length === 1 && !b.department_id);
    else if (hit[2] === 'newapp') ok = appInScope({ data: JSON.stringify((b.data) || {}) }, depts);
    if (!ok) return no();
    // Antwort-Filter für Listen
    if (req.method === 'GET' && /^\/(list|applications|changes)$/.test(path)) {
      const json = res.json.bind(res);
      res.json = data => json(!Array.isArray(data) ? data : data.filter(x => path === '/list' ? (x.dept_ids || []).some(d => depts.includes(d)) && Object.assign(x, { issues: scopedIssues(x.issues) })
        : path === '/applications' ? appInScope({ data: JSON.stringify(x.data || {}) }, depts) : inScope(x.member_id, depts)));
    }
    next();
  });

  /* ---------- Übersicht & Stammdaten ---------- */
  admin.get('/meta', P, (req, res) => {
    const depts = ctx.db.prepare('SELECT d.*, (SELECT COUNT(*) FROM mv_member_department md WHERE md.department_id = d.id AND (md.exit_date IS NULL OR md.exit_date >= ?)) AS members FROM mv_department d ORDER BY d.sort, d.name').all(today());
    const feeList = ctx.db.prepare(`SELECT f.*, CASE WHEN f.kind = 'zusatz' THEN (SELECT COUNT(*) FROM mv_member_department md WHERE md.department_id = f.department_id AND (md.exit_date IS NULL OR md.exit_date >= ?))
      ELSE (SELECT COUNT(*) FROM mv_member_fee mf WHERE mf.fee_id = f.id AND (mf.end_date IS NULL OR mf.end_date >= ?)) END AS members FROM mv_fee f ORDER BY f.kind = 'zusatz', CASE WHEN f.kind = 'zusatz' THEN f.department_id END, CASE WHEN f.kind = 'zusatz' THEN COALESCE(f.age_min, 0) END, f.sort, f.name`).all(today(), today());   // Hauptverein: Reihenfolge wie festgelegt (↑ ↓)
    // Zusatzbeiträge: zählen, wer heute tatsächlich diese Altersstufe zahlt (ohne Befreite)
    if (feeList.some(f => f.kind === 'zusatz')) {
      const per = {};
      for (const md of ctx.db.prepare('SELECT md.*, p.birth_date FROM mv_member_department md LEFT JOIN mv_person p ON p.member_id = md.member_id JOIN members m ON m.id = md.member_id WHERE m.deleted = 0 AND (md.exit_date IS NULL OR md.exit_date >= ?)').all(today())) {
        const z = zusatzFor(md, md.birth_date); if (z.fee) per[z.fee.id] = (per[z.fee.id] || 0) + 1;
      }
      for (const f of feeList) if (f.kind === 'zusatz') f.members = per[f.id] || 0;
    }
    if (req.mvScope) {   // Abteilungsadmin: Zahlen nur für die eigene(n) Abteilung(en)
      for (const d of depts) if (!req.mvScope.includes(d.id)) d.members = null;
      for (const f of feeList) if (!(f.kind === 'zusatz' && req.mvScope.includes(f.department_id))) f.members = null;
    }
    res.json({ depts, fees: feeList, settings: settingsView(req.user), perms: { bank: req.user.perms.includes('mitglieder_bank'), finance: req.user.perms.includes('mitglieder_finanzen'), docs: req.user.perms.includes('mitglieder_dokumente'), settings: req.user.perms.includes('einstellungen') },
      counts: req.mvScope ? { applications: ctx.db.prepare("SELECT * FROM mv_application WHERE status IN ('eingegangen','unterschrift')").all().filter(a => appInScope(a, req.mvScope)).length,
        changes: ctx.db.prepare("SELECT member_id FROM mv_change WHERE status = 'offen'").all().filter(c => inScope(c.member_id, req.mvScope)).length }
        : { applications: ctx.db.prepare("SELECT COUNT(*) n FROM mv_application WHERE status IN ('eingegangen','unterschrift')").get().n, changes: ctx.db.prepare("SELECT COUNT(*) n FROM mv_change WHERE status = 'offen'").get().n },
      ages: ctx.db.prepare("SELECT COUNT(*) n FROM mv_age_notice WHERE status = 'offen'").get().n,
      scope: req.mvScope ? ctx.db.prepare(`SELECT id, name FROM mv_department WHERE id IN (${req.mvScope.map(() => '?').join(',')})`).all(...req.mvScope) : null,
      drinks: ctx.drinks.active(), arbeit: ctx.isModuleActive('arbeitseinsatz'), today: today(), nextNo: store.nextMemberNo(), club: ctx.clubAddress() });
  });
  admin.get('/list', P, (req, res) => res.json(listRows(req.query)));
  admin.get('/member/:id', P, (req, res) => {
    try { store.fillNames(int(req.params.id)); } catch (e) { /* */ }
    const d = detail(int(req.params.id), req.user);
    if (!d) return bad(res, 'Mitglied nicht gefunden.', 404);
    res.json(d);
  });
  /* Unterschriebene Beitrittserklärung (Papier) vorab hochladen – wird beim Anlegen dem neuen Mitglied zugeordnet.
     Nicht zugeordnete Uploads werden nach einem Tag gelöscht. */
  admin.post('/member/new-document', P, express.raw({ type: () => true, limit: DOC_MAX + 1024 }), (req, res) => {
    let name = ''; try { name = decodeURIComponent(String(req.get('X-Filename') || '')); } catch (e) { name = ''; }
    try {
      const docId = saveDocument(null, req.body, { kind: 'antrag', title: 'Beitrittserklärung' + (name ? ` (${one(name, 80)})` : ''), filename: name, user: uname(req) });
      const d = ctx.db.prepare('SELECT id, title, size, mime FROM mv_document WHERE id = ?').get(docId);
      res.json({ doc_id: d.id, title: d.title, size: d.size, mime: d.mime });
    } catch (e) { bad(res, e.message); }
  });
  const dropOrphans = () => {
    try {
      for (const d of ctx.db.prepare("SELECT * FROM mv_document WHERE member_id IS NULL AND application_id IS NULL AND created_at < datetime('now','localtime','-1 day')").all()) { deleteDocumentFile(d); ctx.db.prepare('DELETE FROM mv_document WHERE id = ?').run(d.id); }
    } catch (e) { /* beim nächsten Mal */ }
  };
  setTimeout(dropOrphans, 30000).unref(); setInterval(dropOrphans, 6 * 3600000).unref();

  admin.post('/member', P, (req, res) => {
    const pi = personInput(req.body || {}); if (pi.error) return bad(res, pi.error);
    if (!pi.fields.first_name) return bad(res, 'Bitte den Vornamen eintragen.');
    // Neue Mitglieder nur vollständig: erreichbar (Adresse, E-Mail, Handy), Beitrag zugeordnet, Zahlung möglich (Lastschrift mit Mandat oder Rechnung/bar)
    const b = req.body || {}, f0 = pi.fields, full = !req.mvScope;
    const miss = [['last_name', 'Nachname'], ['birth_date', 'Geburtsdatum'], ['street', 'Straße'], ['zip', 'PLZ'], ['city', 'Ort'], ['email', 'E-Mail'], ['mobile', 'Handynummer']].filter(([k]) => !f0[k]).map(([, l]) => l);
    if (miss.length) return bad(res, `Für ein neues Mitglied fehlen noch: ${miss.join(', ')}.`);
    if (String(f0.mobile).replace(/\D/g, '').length < 7) return bad(res, 'Bitte eine gültige Handynummer eintragen.');
    // von Hand ausgefüllte Beitrittserklärung gehört dazu (mit Unterschrift auf dem Tablet geht es über „Beitrittserklärung am Tablet“)
    const doc = ctx.db.prepare('SELECT * FROM mv_document WHERE id = ? AND member_id IS NULL AND application_id IS NULL AND by_user = ?').get(int(b.doc_id), uname(req));
    if (!doc) return bad(res, 'Bitte die unterschriebene Beitrittserklärung hochladen (PDF oder Foto).');
    let fee = null, bank = null;
    const entry = f0.entry_date || today();
    if (full) {
      fee = ctx.db.prepare("SELECT * FROM mv_fee WHERE id = ? AND active = 1 AND kind != 'zusatz'").get(int(b.fee_id));
      if (!fee) return bad(res, 'Bitte einen Beitrag zuordnen.');
      const ae = feeAgeError(fee, { name: `${f0.first_name} ${f0.last_name}`, birth_date: f0.birth_date }, entry); if (ae) return bad(res, ae);
      const pay = store.PAYMENT[f0.payment] ? f0.payment : 'lastschrift';
      if (pay !== 'lastschrift' && sepaRequired()) return bad(res, 'Lastschrift ist laut Einstellungen Pflicht – bitte Bankverbindung und SEPA-Mandat eintragen.');
      if (pay === 'lastschrift') {
        if (!req.user.perms.includes('mitglieder_bank')) return bad(res, 'Bankdaten darf nur eintragen, wer das Recht „Bankdaten“ hat – sonst Zahlart „Rechnung“ wählen.', 403);
        const ib = sepa.checkIban(b.iban); if (!ib.ok) return bad(res, ib.error || 'Bitte eine gültige IBAN eintragen.');
        const holder = one(b.holder, 70);
        if (holder.length < 3) return bad(res, 'Bitte den Kontoinhaber eintragen (wie auf dem SEPA-Mandat).');
        if (!isDate(b.mandate_date) || b.mandate_date > today()) return bad(res, 'Bitte das Datum der Unterschrift unter dem SEPA-Mandat angeben.');
        bank = { iban: ib.iban, holder, mandate_date: b.mandate_date, bic: (sepa.checkBic(b.bic || '').bic) || null };
      }
    }
    // Alles in einer Transaktion: Kern-Konto, Vereinsdaten, Dokument, Beitrag, Bank, Abteilung – entweder ganz oder gar nicht
    // (z. B. doppelte Mandatsreferenz darf kein halbes Mitglied ohne Beitrag und Bank hinterlassen)
    let id, pending = false;
    try {
      ctx.db.transaction(() => {
        id = createPerson(pi.fields, uname(req));
        ctx.db.prepare('UPDATE mv_document SET member_id = ? WHERE id = ?').run(id, doc.id);
        store.hist(id, uname(req), 'Dokument', null, doc.title);
        if (fee) {
          ctx.db.prepare('INSERT INTO mv_member_fee(member_id, fee_id, start_date, end_date, booked_until, cents, note) VALUES (?,?,?,?,?,?,?)').run(id, fee.id, entry, null, null, null, null);
          store.hist(id, uname(req), 'Beitrag', null, `${fee.name} ab ${deD(entry)}`);
        }
        if (bank) {
          const no = (ctx.db.prepare('SELECT member_no FROM mv_person WHERE member_id = ?').get(id) || {}).member_no || String(id);
          ctx.db.prepare('INSERT INTO mv_bank(member_id, holder, iban, bic, bank, mandate_ref, mandate_date, mandate_revoked, updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id, bank.holder, bank.iban, bank.bic, null, store.mandateRefFor(no), bank.mandate_date, null, nowTs());
          store.hist(id, uname(req), 'Bankverbindung', null, sepa.maskIban(bank.iban));
        }
        if (full && b.department_id && ctx.db.prepare('SELECT 1 FROM mv_department WHERE id = ? AND active = 1').get(int(b.department_id)))
          ctx.db.prepare('INSERT INTO mv_member_department(member_id, department_id, entry_date, status, booked_until) VALUES (?,?,?,?,?)').run(id, int(b.department_id), entry, 'aktiv', store.zusatzStart(int(b.department_id), entry));
        if (req.mvScope) {   // Abteilungsadmin: neues Mitglied gehört gleich zu seiner Abteilung
          const dep = Number((req.body || {}).department_id) || req.mvScope[0];
          ctx.db.prepare('INSERT INTO mv_member_department(member_id, department_id, entry_date, status, booked_until) VALUES (?,?,?,?,?)').run(id, dep, entry, 'aktiv', store.zusatzStart(dep, entry));
          if (needConfirm(req)) {   // erst nach Bestätigung durch die Vereinsverwaltung aktiv (Tablet, App, Beitragslauf)
            ctx.db.prepare('UPDATE members SET active = 0 WHERE id = ?').run(id);
            scopeChange(req, id, 'eintritt', { department_id: dep, entry_date: entry }, `Eintritt von ${pi.fields.first_name} ${pi.fields.last_name || ''}`.trim());
            pending = true;
          }
        }
      })();
    } catch (e) {
      console.error('Mitglied anlegen:', e.message);
      return bad(res, /UNIQUE.*mandate_ref/.test(e.message) ? 'Diese Mandatsreferenz ist schon vergeben.' : /UNIQUE.*member_no/.test(e.message) ? 'Die Mitgliedsnummer ist schon vergeben.' : 'Das Mitglied konnte nicht angelegt werden: ' + e.message);
    }
    ctx.audit(req.user, pending ? 'Mitglied angelegt (wartet auf Bestätigung)' : 'Mitglied angelegt', `${pi.fields.first_name} ${pi.fields.last_name}`);
    res.json(pending ? { id, pending: true } : { id });
  });
  admin.put('/member/:id', P, (req, res) => {
    const id = int(req.params.id); const p = personRow(id);
    if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    if (p.anonymized_at) return bad(res, 'Dieses Mitglied ist anonymisiert.');
    const pi = personInput(req.body || {}, { ...p, member_id: p.member_id || id }); if (pi.error) return bad(res, pi.error);
    const b = req.body || {};
    if (pi.fields.payment && pi.fields.payment !== 'lastschrift' && pi.fields.payment !== p.payment && sepaRequired() && payNeedsSepa(p))
      return bad(res, 'Lastschrift ist laut Einstellungen Pflicht. Andere Zahlarten nur für Familienmitglieder oder wer über einen Zahler zahlt.');
    if (req.mvScope) {   // Abteilungsadmin: nur Personen- und Kontaktdaten; Vereinsdaten und Einwilligungen pflegt die Vereinsverwaltung
      const norm = (k, v) => k === 'status' ? (v || 'aktiv') : String(v == null ? '' : v);
      const changed = SCOPE_LOCKED.filter(k => pi.fields[k] !== undefined && norm(k, pi.fields[k]) !== norm(k, p[k]));
      const cur = JSON.parse(p.consents || '{}');
      const consChanged = b.consents && typeof b.consents === 'object' && consentList().some(c => Boolean(b.consents[c.key]) !== Boolean(cur[c.key]));
      if (changed.length || consChanged) return bad(res, `${[...changed.map(k => LABEL[k]), ...(consChanged ? ['Einwilligungen'] : [])].join(', ')}: das pflegt die Vereinsverwaltung, nicht die Abteilung.`, 403);
      for (const k of SCOPE_LOCKED) delete pi.fields[k];
      delete b.consents;
    }
    if (b.consents && typeof b.consents === 'object') {
      const cur = JSON.parse(p.consents || '{}'); const next = {};
      for (const c of consentList()) { if (b.consents[c.key]) next[c.key] = cur[c.key] || today(); }
      store.ensurePerson(id);
      ctx.db.prepare('UPDATE mv_person SET consents = ? WHERE member_id = ?').run(JSON.stringify(next), id);
      for (const c of consentList()) store.hist(id, uname(req), 'Einwilligung ' + c.short, cur[c.key] ? 'ja' : 'nein', next[c.key] ? 'ja' : 'nein');
    }
    savePerson(id, pi.fields, uname(req));
    res.json({ ok: true });
  });
  /* Familienmitglieder zahlen über das Oberhaupt (bzw. dessen Zahler) – ältere Datenstände beim Start angleichen */
  try {
    for (const r of ctx.db.prepare('SELECT x.member_id, x.payer_id, x.family_of FROM mv_person x WHERE x.family_of IS NOT NULL AND x.family_of != x.member_id').all()) {
      const want = store.payerOf(r.family_of);
      if (want && want !== r.member_id && r.payer_id !== want && !ctx.db.prepare('SELECT 1 FROM mv_person WHERE payer_id = ? AND member_id != ?').get(r.member_id, r.member_id)) {
        ctx.db.prepare('UPDATE mv_person SET payer_id = ? WHERE member_id = ?').run(want, r.member_id);
        store.hist(r.member_id, 'System', 'Zahler', null, `${(personRow(want) || {}).name || want} (Oberhaupt der Familienmitgliedschaft)`);
      }
    }
  } catch (e) { console.error('[mitglieder] Zahler der Familien angleichen:', e.message); }
  /* Familie / abweichender Zahler */
  admin.put('/member/:id/payer', P, (req, res) => {
    const id = int(req.params.id); const b = req.body || {};
    if (!personRow(id)) return bad(res, 'Mitglied nicht gefunden.', 404);
    let payer = b.payer_id ? int(b.payer_id) : null;
    { const me = personRow(id);
      if (me && me.family_of) {   // Familienmitgliedschaft: Geld läuft immer über das Oberhaupt (bzw. dessen Zahler) – nur der Verkauf ist einstellbar
        const want = store.payerOf(me.family_of);
        if (payer && store.payerOf(payer) !== want) return bad(res, `${me.name} gehört zur Familienmitgliedschaft von ${(personRow(me.family_of) || {}).name || '…'} – gezahlt wird über das Oberhaupt. Erst unter „Familienmitgliedschaft“ lösen.`);
        payer = want;
      } }
    if (payer) {
      if (personRow(payer)) payer = store.payerOf(payer);   // zahlt der Gewählte selbst über jemanden, gilt dessen Hauptzahler
      if (payer === id) return bad(res, 'Ein Mitglied kann nicht für sich selbst als Zahler eingetragen werden.');
      if (!personRow(payer)) return bad(res, 'Zahler nicht gefunden.');
      if (store.payerOf(payer) === id) return bad(res, 'Das ergäbe einen Kreis – der Zahler zahlt schon über dieses Mitglied.');
      if (ctx.db.prepare('SELECT 1 FROM mv_person WHERE payer_id = ? AND member_id != ?').get(id, id)) return bad(res, 'Für dieses Mitglied zahlen schon andere (es ist selbst Hauptzahler) – erst die Angehörigen umhängen.');
      store.ensurePerson(payer);
    }
    const cur = ctx.db.prepare('SELECT sales_mode FROM mv_person WHERE member_id = ?').get(id) || {};
    const mode = ['payer', 'own_payer', 'own'].includes(b.sales_mode) ? b.sales_mode : b.drinks_to_payer === false ? 'own' : (cur.sales_mode || 'payer');
    savePerson(id, { payer_id: payer, drinks_to_payer: mode === 'own' ? 0 : 1 }, uname(req));
    if (mode !== cur.sales_mode) { ctx.db.prepare('UPDATE mv_person SET sales_mode = ? WHERE member_id = ?').run(mode, id); store.hist(id, uname(req), 'Verkauf', SALES[cur.sales_mode] || null, SALES[mode]); }
    res.json({ ok: true });
  });
  /* Familienmitgliedschaft: Zuordnung zum Oberhaupt (dessen Familienbeitrag deckt die Person ab) – getrennt vom Zahler.
     Regeln: eine Ebene, Oberhaupt mit aktivem Familienbeitrag, höchstens zwei Erwachsene (Oberhaupt + Partner), Kinder bis family_child_max. */
  admin.put('/member/:id/family', P, (req, res) => {
    const id = int(req.params.id); const b = req.body || {};
    const p = personRow(id); if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    const head = b.family_of ? int(b.family_of) : null;
    if (head) {
      const h = personRow(head);
      if (!h || !h.member_id) return bad(res, 'Oberhaupt nicht gefunden.');
      if (head === id) return bad(res, 'Ein Mitglied kann nicht seiner eigenen Familienmitgliedschaft zugeordnet werden.');
      if (h.family_of) return bad(res, `${h.name} gehört selbst zur Familienmitgliedschaft von ${(personRow(h.family_of) || {}).name || '…'} – Oberhaupt kann nur sein, wer keiner anderen Familie zugeordnet ist.`);
      if (ctx.db.prepare('SELECT 1 FROM mv_person WHERE family_of = ? AND member_id != ?').get(id, id)) return bad(res, `${p.name} ist selbst Oberhaupt einer Familienmitgliedschaft – erst die Angehörigen lösen.`);
      if (store.isExited(h)) return bad(res, `${h.name} ist ausgetreten.`);
      if (!store.familyFee(head)) return bad(res, `${h.name} hat keinen Familienbeitrag – bitte zuerst unter „Mitgliedschaft“ eine Beitragsart mit Familienbeitrag zuweisen.`);
      if (head !== p.family_of) {
        const own = ctx.db.prepare("SELECT f.name FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id = ? AND f.kind != 'zusatz' AND (mf.end_date IS NULL OR mf.end_date >= ?)").all(id, today());
        const ownN = own.map(x => x.name).join(', ');
        if (own.length) return bad(res, `${p.name} hat noch einen eigenen Beitrag (${ownN}). In der Familienmitgliedschaft ist er im Familienbeitrag enthalten – bitte den eigenen Beitrag unter „Mitgliedschaft“ zuerst beenden oder entfernen.`);
        if (ctx.db.prepare('SELECT 1 FROM mv_person WHERE payer_id = ? AND member_id != ?').get(id, id)) return bad(res, `Über ${p.name} zahlen noch andere Mitglieder – in der Familie zahlt das Oberhaupt. Bitte diese Angehörigen zuerst umhängen.`);
      }
      if (store.isAdult(p.birth_date) && p.family_of !== head) {
        const others = store.familyMembers(head).filter(f => f.role === 'partner' && f.id !== id && !store.isExited(f));
        if (others.length) return bad(res, 'In einer Familienmitgliedschaft dürfen nur zwei Erwachsene sein – das Oberhaupt und ein Partner.');
      }
    }
    savePerson(id, { family_of: head }, uname(req));
    // Zahler folgt der Familie: dabei → Oberhaupt (bzw. dessen Zahler); gelöst → zahlt wieder selbst, wenn bisher das Oberhaupt zahlte
    if (head) { const want = store.payerOf(head); if (p.payer_id !== want) savePerson(id, { payer_id: want === id ? null : want }, uname(req)); }
    else if (p.family_of && p.payer_id && p.payer_id === store.payerOf(p.family_of)) savePerson(id, { payer_id: null }, uname(req));
    res.json({ ok: true, family: store.familyMembers(head || store.familyHead(id)) });
  });
  /* Bankverbindung & Mandat */
  admin.put('/member/:id/bank', PB, (req, res) => {
    const id = int(req.params.id); const b = req.body || {};
    const p = personRow(id); if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    store.ensurePerson(id);
    const cur = bankRow(id) || {};
    const ib = b.iban !== undefined ? sepa.checkIban(b.iban) : { ok: true, iban: cur.iban };
    if (b.iban !== undefined && String(b.iban).trim() && !ib.ok) return bad(res, ib.error);
    const bic = sepa.checkBic(b.bic !== undefined ? b.bic : cur.bic); if (!bic.ok) return bad(res, 'Der BIC hat 8 oder 11 Zeichen (oder leer lassen).');
    let ref = b.mandate_ref !== undefined ? one(b.mandate_ref, 35) : cur.mandate_ref;
    if (ref) { const r = sepa.checkMandateRef(ref); if (!r.ok) return bad(res, 'Die Mandatsreferenz darf bis 35 Zeichen haben: Buchstaben, Ziffern und + ? / - : ( ) . , \' – keine Leerzeichen.'); }
    if (ref && ctx.db.prepare('SELECT 1 FROM mv_bank WHERE mandate_ref = ? AND member_id != ?').get(ref, id)) return bad(res, 'Diese Mandatsreferenz ist schon vergeben.');
    // Gleiche Regel wie bei der Neuanlage: Die Unterschrift kann nicht in der Zukunft liegen (Tippfehler 2062 statt 2026 →
    // Bank lehnt die Lastschrift ab, Mandatsverfall würde falsch berechnet)
    if (b.mandate_date !== undefined && isDate(b.mandate_date) && b.mandate_date > today()) return bad(res, 'Das Datum der Unterschrift darf nicht in der Zukunft liegen.');
    // Schon für Lastschriften genutzt: Die Bank kennt diese Referenz – eine Änderung müsste im nächsten Einzug als Mandatsänderung
    // (AmdmntInd) gemeldet werden, sonst droht die Rücklastschrift. Deshalb gesperrt; eine neue Referenz gibt es nur über „Neues Mandat“.
    if (!b.newMandate && cur.mandate_first_used && cur.mandate_ref && ref !== cur.mandate_ref) return bad(res, 'Dieses Mandat wurde schon für Lastschriften genutzt – die Mandatsreferenz lässt sich nicht mehr ändern. Für eine neue Referenz bitte „Neues Mandat …“ wählen.');
    if (b.newMandate) {   // neues Mandat (z. B. neue Bankverbindung): neue Referenz, Datum der Unterschrift
      if (!isDate(b.mandate_date)) return bad(res, 'Bitte das Datum der Unterschrift angeben.');
      const no = p.member_no || ctx.db.prepare('SELECT member_no FROM mv_person WHERE member_id = ?').get(id).member_no || String(id);
      ref = store.mandateRefFor(no);
    }
    const next = {
      holder: b.holder !== undefined ? one(b.holder, 70) || null : cur.holder || null,
      iban: b.iban !== undefined ? (ib.iban || null) : cur.iban || null,
      bic: bic.bic || null, bank: b.bank !== undefined ? one(b.bank, 70) || null : cur.bank || null,
      mandate_ref: ref || null, mandate_date: b.mandate_date !== undefined ? (isDate(b.mandate_date) ? b.mandate_date : null) : cur.mandate_date || null,
      mandate_revoked: b.mandate_revoked !== undefined ? (b.mandate_revoked ? today() : null) : cur.mandate_revoked || null,
    };
    if (next.mandate_ref && !next.mandate_date) return bad(res, 'Zum Mandat gehört das Datum der Unterschrift.');
    const changedAccount = cur.iban && next.iban && cur.iban !== next.iban;
    const reset = b.newMandate || (cur.mandate_ref && cur.mandate_ref !== next.mandate_ref);
    for (const k of ['holder', 'iban', 'bic', 'bank', 'mandate_ref', 'mandate_date', 'mandate_revoked']) store.hist(id, uname(req), LABEL[k], k === 'iban' ? sepa.maskIban(cur[k]) : cur[k], k === 'iban' ? sepa.maskIban(next[k]) : next[k]);
    ctx.db.prepare(`INSERT INTO mv_bank(member_id, holder, iban, bic, bank, mandate_ref, mandate_date, mandate_revoked, updated_at) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(member_id) DO UPDATE SET holder = excluded.holder, iban = excluded.iban, bic = excluded.bic, bank = excluded.bank, mandate_ref = excluded.mandate_ref,
      mandate_date = excluded.mandate_date, mandate_revoked = excluded.mandate_revoked, updated_at = excluded.updated_at`)
      .run(id, next.holder, next.iban, next.bic, next.bank, next.mandate_ref, next.mandate_date, next.mandate_revoked, nowTs());
    if (reset) ctx.db.prepare('UPDATE mv_bank SET mandate_first_used = NULL, mandate_last_used = NULL, mandate_notified = NULL WHERE member_id = ?').run(id);
    // bestehendes Mandat aus der bisherigen Verwaltung: schon benutzt → nächste Lastschrift ist eine Folgelastschrift
    if (b.mandate_used !== undefined && next.mandate_ref) {
      const used = b.mandate_used ? (isDate(b.mandate_used) ? b.mandate_used : today()) : null;
      if (used && used < next.mandate_date) return bad(res, 'Das Mandat kann nicht vor der Unterschrift benutzt worden sein.');
      ctx.db.prepare('UPDATE mv_bank SET mandate_first_used = ?, mandate_last_used = ? WHERE member_id = ?').run(used, used, id);
    }
    ctx.audit(req.user, 'Mitglied: Bankverbindung geändert', `${p.name}${changedAccount ? ' (neue IBAN)' : ''}${reset ? ', neues Mandat ' + next.mandate_ref : ''}`);
    res.json({ ok: true, mandate_ref: next.mandate_ref, warn: changedAccount && !reset ? 'Neue IBAN, aber altes Mandat: Für eine neue Bankverbindung braucht es eigentlich ein neues, unterschriebenes Mandat.' : null });
  });
  admin.get('/iban-check', P, (req, res) => { const r = sepa.checkIban(req.query.iban); res.json({ ok: r.ok, error: r.error || null, formatted: r.ok ? sepa.fmtIban(r.iban) : null }); });

  /* Abteilungen eines Mitglieds */
  admin.post('/member/:id/departments', P, (req, res) => {
    const id = int(req.params.id); const b = req.body || {};
    const d = ctx.db.prepare('SELECT * FROM mv_department WHERE id = ?').get(int(b.department_id));
    if (!personRow(id) || !d) return bad(res, 'Nicht gefunden.', 404);
    if (ctx.db.prepare('SELECT 1 FROM mv_member_department WHERE member_id = ? AND department_id = ? AND exit_date IS NULL').get(id, d.id)) return bad(res, `Schon in der Abteilung „${d.name}“.`);
    store.ensurePerson(id);
    const entry = isDate(b.entry_date) ? b.entry_date : today();
    ctx.db.prepare('INSERT INTO mv_member_department(member_id, department_id, entry_date, status, federation_status, booked_until) VALUES (?,?,?,?,?,?)').run(id, d.id, entry, b.status === 'passiv' ? 'passiv' : 'aktiv', one(b.federation_status, 40) || null, store.zusatzStart(d.id, entry));
    store.hist(id, uname(req), 'Abteilung', null, d.name);
    res.json({ ok: true });
  });
  admin.put('/md/:id', P, (req, res) => {
    const r = ctx.db.prepare('SELECT md.*, d.name FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id WHERE md.id = ?').get(int(req.params.id));
    if (!r) return bad(res, 'Nicht gefunden.', 404);
    const b = req.body || {};
    const n = { entry_date: b.entry_date !== undefined ? (isDate(b.entry_date) ? b.entry_date : null) : r.entry_date, exit_date: b.exit_date !== undefined ? (isDate(b.exit_date) ? b.exit_date : null) : r.exit_date,
      status: b.status ? (b.status === 'passiv' ? 'passiv' : 'aktiv') : r.status, federation_status: b.federation_status !== undefined ? one(b.federation_status, 40) || null : r.federation_status, exit_reason: b.exit_reason !== undefined ? one(b.exit_reason, 80) || null : r.exit_reason,
      fee_id: b.fee_id !== undefined ? (b.fee_id ? int(b.fee_id) : null) : r.fee_id, fee_free: b.fee_free !== undefined ? (b.fee_free ? 1 : 0) : r.fee_free,
      booked_until: b.booked_until !== undefined ? (isDate(b.booked_until) ? b.booked_until : null) : r.booked_until };
    if (n.exit_date && n.entry_date && n.exit_date < n.entry_date) return bad(res, 'Der Austritt liegt vor dem Eintritt.');
    // Befreiung aufgehoben: ab dem laufenden Zeitraum zahlen – die befreiten Jahre nicht nachberechnen
    if (r.fee_free && !n.fee_free && b.booked_until === undefined) { const z = store.zusatzStart(r.department_id, null); if (z && (!n.booked_until || z > n.booked_until)) n.booked_until = z; }
    if (n.fee_id && !ctx.db.prepare("SELECT 1 FROM mv_fee WHERE id = ? AND kind = 'zusatz' AND department_id = ?").get(n.fee_id, r.department_id)) return bad(res, 'Dieser Zusatzbeitrag gehört nicht zur Abteilung.');
    ctx.db.prepare('UPDATE mv_member_department SET entry_date = ?, exit_date = ?, status = ?, federation_status = ?, exit_reason = ?, fee_id = ?, fee_free = ?, booked_until = ? WHERE id = ?').run(n.entry_date, n.exit_date, n.status, n.federation_status, n.exit_reason, n.fee_id, n.fee_free, n.booked_until, r.id);
    if (n.fee_free !== r.fee_free) store.hist(r.member_id, uname(req), `Zusatzbeitrag ${r.name}`, r.fee_free ? 'befreit' : 'zahlt', n.fee_free ? 'befreit' : 'zahlt');
    store.hist(r.member_id, uname(req), `Abteilung ${r.name}`, [r.entry_date, r.exit_date, r.status].filter(Boolean).join(' · '), [n.entry_date, n.exit_date, n.status].filter(Boolean).join(' · '));
    res.json({ ok: true });
  });
  admin.delete('/md/:id', P, (req, res) => {
    const r = ctx.db.prepare('SELECT md.*, d.name FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id WHERE md.id = ?').get(int(req.params.id));
    if (!r) return bad(res, 'Nicht gefunden.', 404);
    if (ctx.db.prepare("SELECT 1 FROM mv_charge WHERE member_dept_id = ? AND status != 'storniert'").get(r.id)) return bad(res, 'Für diese Abteilung wurden schon Zusatzbeiträge abgerechnet – statt zu entfernen bitte einen Austritt aus der Abteilung eintragen.');
    ctx.db.prepare('DELETE FROM mv_member_department WHERE id = ?').run(r.id);
    store.hist(r.member_id, uname(req), 'Abteilung entfernt', r.name, null);
    res.json({ ok: true });
  });

  /* Beiträge eines Mitglieds */
  const mfInput = (b, cur = {}) => {
    const out = { start_date: b.start_date !== undefined ? b.start_date : cur.start_date, end_date: b.end_date !== undefined ? (b.end_date || null) : cur.end_date || null,
      booked_until: b.booked_until !== undefined ? (b.booked_until || null) : cur.booked_until || null, note: b.note !== undefined ? one(b.note, 120) || null : cur.note || null };
    if (!isDate(out.start_date)) return { error: 'Bitte den Beginn angeben.' };
    if (out.end_date && (!isDate(out.end_date) || out.end_date < out.start_date)) return { error: 'Das Ende liegt vor dem Beginn.' };
    if (out.booked_until && !isDate(out.booked_until)) return { error: '„Gebucht bis“ ist kein gültiges Datum.' };
    if (b.cents !== undefined) {
      if (b.cents === null || b.cents === '') out.cents = null;
      else { const c = Math.round(Number(b.cents)); if (!Number.isFinite(c) || c < 0 || c > 10000000) return { error: 'Ungültiger Betrag.' }; out.cents = c; }
    } else out.cents = cur.cents ?? null;
    return { v: out };
  };
  /** Altersgrenzen eines Beitrags (z. B. „Jugendliche“ bis 18) – geprüft zum Beginn → Fehlertext oder null */
  const feeAgeError = (f, p, start) => {
    if (f.age_min == null && f.age_max == null) return null;
    const lim = f.age_min != null && f.age_max != null ? `von ${f.age_min} bis ${f.age_max} Jahre` : f.age_max != null ? `bis ${f.age_max} Jahre` : `ab ${f.age_min} Jahre`;
    if (!p || !p.birth_date) return `„${f.name}“ gilt nur ${lim} – bitte zuerst das Geburtsdatum eintragen.`;
    const age = fees.ageAt(p.birth_date, start);
    if ((f.age_min != null && age < f.age_min) || (f.age_max != null && age > f.age_max)) return `„${f.name}“ gilt nur ${lim} – ${String(p.name || '').split(' ')[0]} ist am ${deD(start)} ${age} Jahre alt.`;
    return null;
  };
  admin.post('/member/:id/fees', P, (req, res) => {
    const id = int(req.params.id); const b = req.body || {};
    const f = ctx.db.prepare('SELECT * FROM mv_fee WHERE id = ?').get(int(b.fee_id));
    const p = personRow(id);
    if (!p || !f) return bad(res, 'Nicht gefunden.', 404);
    if (f.kind === 'zusatz') return bad(res, `„${f.name}“ ist ein Zusatzbeitrag der Abteilung – er gilt automatisch für alle, die der Abteilung angehören.`);
    if (p.family_of) return bad(res, `${p.name} ist in der Familienmitgliedschaft von ${(personRow(p.family_of) || {}).name || '…'} enthalten – ein eigener Beitrag ist nicht möglich. Erst unter „Zahlung & Familie“ aus der Familie lösen.`);
    const m = mfInput({ start_date: today(), ...b }); if (m.error) return bad(res, m.error);
    const ae = feeAgeError(f, p, m.v.start_date); if (ae) return bad(res, ae);
    store.ensurePerson(id);
    ctx.db.prepare('INSERT INTO mv_member_fee(member_id, fee_id, start_date, end_date, booked_until, cents, note) VALUES (?,?,?,?,?,?,?)').run(id, f.id, m.v.start_date, m.v.end_date, m.v.booked_until, m.v.cents, m.v.note);
    store.hist(id, uname(req), 'Beitrag', null, `${f.name} ab ${deD(m.v.start_date)}`);
    res.json({ ok: true });
  });
  admin.put('/mf/:id', P, (req, res) => {
    const r = ctx.db.prepare('SELECT mf.*, f.name FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.id = ?').get(int(req.params.id));
    if (!r) return bad(res, 'Nicht gefunden.', 404);
    const m = mfInput(req.body || {}, r); if (m.error) return bad(res, m.error);
    { const f = ctx.db.prepare('SELECT * FROM mv_fee WHERE id = ?').get(r.fee_id), ae = f && m.v.start_date !== r.start_date ? feeAgeError(f, personRow(r.member_id), m.v.start_date) : null; if (ae) return bad(res, ae); }
    ctx.db.prepare('UPDATE mv_member_fee SET start_date = ?, end_date = ?, booked_until = ?, cents = ?, note = ? WHERE id = ?').run(m.v.start_date, m.v.end_date, m.v.booked_until, m.v.cents, m.v.note, r.id);
    store.hist(r.member_id, uname(req), `Beitrag ${r.name}`, [deD(r.start_date), r.end_date && 'bis ' + deD(r.end_date), r.booked_until && 'gebucht bis ' + deD(r.booked_until), r.cents != null && euro(r.cents)].filter(Boolean).join(' · '),
      [deD(m.v.start_date), m.v.end_date && 'bis ' + deD(m.v.end_date), m.v.booked_until && 'gebucht bis ' + deD(m.v.booked_until), m.v.cents != null && euro(m.v.cents)].filter(Boolean).join(' · '));
    res.json({ ok: true });
  });
  admin.delete('/mf/:id', P, (req, res) => {
    const r = ctx.db.prepare('SELECT mf.*, f.name FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.id = ?').get(int(req.params.id));
    if (!r) return bad(res, 'Nicht gefunden.', 404);
    if (ctx.db.prepare('SELECT 1 FROM mv_charge WHERE member_fee_id = ? AND status != \'storniert\'').get(r.id)) return bad(res, 'Aus diesem Beitrag wurden schon Forderungen erzeugt – statt zu löschen bitte ein Ende eintragen.');
    ctx.db.prepare('DELETE FROM mv_member_fee WHERE id = ?').run(r.id);
    store.hist(r.member_id, uname(req), 'Beitrag entfernt', r.name, null);
    res.json({ ok: true });
  });

  /* Ehrungen & Ämter */
  for (const [kind, table, fields] of [['honors', 'mv_honor', ['name', 'date', 'note']], ['functions', 'mv_function', ['name', 'from_date', 'to_date']]]) {
    admin.post(`/member/:id/${kind}`, P, (req, res) => {
      const id = int(req.params.id); const b = req.body || {};
      if (!personRow(id)) return bad(res, 'Nicht gefunden.', 404);
      const v = fields.map(f => (f.endsWith('date') ? (isDate(b[f]) ? b[f] : null) : one(b[f], 120) || null));
      if (!v[0]) return bad(res, 'Bitte eine Bezeichnung eintragen.');
      store.ensurePerson(id);
      ctx.db.prepare(`INSERT INTO ${table}(member_id, ${fields.join(', ')}) VALUES (?, ${fields.map(() => '?').join(', ')})`).run(id, ...v);
      store.hist(id, uname(req), kind === 'honors' ? 'Ehrung' : 'Amt', null, v[0]);
      res.json({ ok: true });
    });
    admin.delete(`/${kind}/:id`, P, (req, res) => {
      const r = ctx.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(int(req.params.id));
      if (!r) return bad(res, 'Nicht gefunden.', 404);
      ctx.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(r.id);
      store.hist(r.member_id, uname(req), kind === 'honors' ? 'Ehrung entfernt' : 'Amt entfernt', r.name, null);
      res.json({ ok: true });
    });
  }

  /* Austritt & Rückkehr */
  admin.post('/member/:id/exit', P, (req, res) => {
    const id = int(req.params.id); const b = req.body || {};
    const p = personRow(id); if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    if (!isDate(b.exit_date)) return bad(res, 'Bitte das Austrittsdatum angeben.');
    if (p.entry_date && b.exit_date < p.entry_date) return bad(res, 'Der Austritt liegt vor dem Eintritt.');
    const deps = ctx.db.prepare('SELECT DISTINCT m.name FROM mv_person x JOIN members m ON m.id = x.member_id WHERE (x.payer_id = ? OR x.family_of = ?) AND x.member_id != ? AND (x.exit_date IS NULL OR x.exit_date > ?)').all(id, id, id, b.exit_date);
    if (deps.length && !b.force) return res.status(409).json({ error: `Für ${deps.map(d => d.name).join(', ')} zahlt dieses Mitglied oder es ist deren Familienoberhaupt. Diese Angehörigen bitte vorher umhängen oder mit austreten lassen.`, dependents: deps.map(d => d.name) });
    if (needConfirm(req)) {   // Abteilungsleitung: Austritt geht zur Bestätigung an die Vereinsverwaltung
      if (ctx.db.prepare("SELECT 1 FROM mv_change WHERE member_id = ? AND kind = 'austritt' AND status = 'offen'").get(id)) return bad(res, 'Für dieses Mitglied liegt schon ein Austritt zur Bestätigung vor.');
      scopeChange(req, id, 'austritt', { exit_date: b.exit_date, notice_date: isDate(b.notice_date) ? b.notice_date : null, reason: one(b.reason, 80) || null, endFees: b.endFees !== false, endDepts: b.endDepts !== false, withDependents: Boolean(b.withDependents) }, `Austritt von ${p.name} zum ${deD(b.exit_date)}`);
      return res.json({ ok: true, pending: true });
    }
    exitMember(id, { exit_date: b.exit_date, reason: one(b.reason, 80), notice_date: isDate(b.notice_date) ? b.notice_date : null, endFees: b.endFees !== false, endDepts: b.endDepts !== false }, uname(req));
    if (b.withDependents) for (const d of ctx.db.prepare('SELECT member_id FROM mv_person WHERE (payer_id = ? OR family_of = ?) AND member_id != ? AND (exit_date IS NULL OR exit_date > ?)').all(id, id, id, b.exit_date)) exitMember(d.member_id, { exit_date: b.exit_date, reason: one(b.reason, 80) }, uname(req));
    daily();
    ctx.audit(req.user, 'Mitglied: Austritt eingetragen', `${p.name} zum ${deD(b.exit_date)}`);
    res.json({ ok: true });
  });
  /* Dokument zum Austritt (Kündigungsschreiben o. ä.): PDF oder Foto – auch für Abteilungsadmins, ohne Dokumenten-Recht */
  admin.post('/member/:id/exit-document', P, express.raw({ type: () => true, limit: DOC_MAX + 1024 }), (req, res) => {
    const id = int(req.params.id); const p = personRow(id);
    if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    let name = ''; try { name = decodeURIComponent(String(req.get('X-Filename') || '')); } catch (e) { name = ''; }
    const t = docType(req.body, name);
    if (!t || !['pdf', 'png', 'jpg', 'jpeg', 'webp', 'heic'].includes(t.ext)) return bad(res, 'Bitte ein PDF oder Foto (JPG, PNG, WebP, HEIC) hochladen.');
    try {
      store.ensurePerson(id);
      const docId = saveDocument(id, req.body, { kind: 'kuendigung', title: `Austritt – ${name || 'Dokument'}`.slice(0, 120), filename: name, user: uname(req) });
      store.hist(id, uname(req), 'Dokument zum Austritt', null, name || 'Dokument');
      ctx.audit(req.user, 'Mitglied: Dokument zum Austritt', `${p.name}: ${name}`);
      res.json({ id: docId });
    } catch (e) { bad(res, e.message); }
  });
  admin.post('/member/:id/reenter', P, (req, res) => {
    const id = int(req.params.id); const p = personRow(id);
    if (!p || !p.exit_date) return bad(res, 'Nicht ausgetreten.');
    if (p.anonymized_at) return bad(res, 'Anonymisierte Mitglieder können nicht zurückkehren – bitte neu anlegen.');
    if (needConfirm(req)) {
      if (ctx.db.prepare("SELECT 1 FROM mv_change WHERE member_id = ? AND kind = 'rueckkehr' AND status = 'offen'").get(id)) return bad(res, 'Die Rückkehr liegt schon zur Bestätigung vor.');
      scopeChange(req, id, 'rueckkehr', { date: today() }, `Rückkehr von ${p.name}`);
      return res.json({ ok: true, pending: true });
    }
    const no = reenterMember(id, uname(req));
    ctx.audit(req.user, no ? 'Mitglied: Wiedereintritt' : 'Mitglied: Austritt zurückgenommen', no ? `${p.name} – neue Mitgliedsnummer ${no}` : p.name);
    res.json({ ok: true, member_no: no });
  });
  /** Austritt zurücknehmen: Beiträge und Abteilungen wieder öffnen (auch aus „Meldungen“ der Abteilungsleitung).
   *  War der Austritt schon wirksam, ist es ein Wiedereintritt: neue Mitgliedsnummer (die alte wird nie wieder vergeben), Eintritt heute,
   *  neue Mandatsreferenz – das alte SEPA-Mandat gilt nicht mehr, bis ein neues unterschrieben ist. → neue Nummer oder null */
  function reenterMember(id, by) {
    const p = personRow(id); if (!p || !p.exit_date) return null;
    const uname = () => by;
    const again = p.exit_date < today();
    const no = again ? store.nextMemberNo() : null;
    savePerson(id, { exit_date: null, exit_reason: null, notice_date: null, ...(again ? { member_no: no, entry_date: today() } : {}) }, uname());
    const bank = again && ctx.db.prepare('SELECT mandate_ref, mandate_date FROM mv_bank WHERE member_id = ?').get(id);
    if (bank && (bank.mandate_ref || bank.mandate_date)) {
      ctx.db.prepare('UPDATE mv_bank SET mandate_ref = ?, mandate_date = NULL, mandate_first_used = NULL, mandate_last_used = NULL, mandate_notified = NULL, mandate_revoked = NULL, updated_at = ? WHERE member_id = ?')
        .run(store.mandateRefFor(no), nowTs(), id);
      store.hist(id, uname(), 'SEPA-Mandat', bank.mandate_ref || bank.mandate_date, 'neues Mandat nötig (Wiedereintritt)');
    }
    // Beiträge und Abteilungen, die mit dem Austritt endeten, wieder öffnen – ab dem laufenden Zeitraum, ohne die Pause nachzuberechnen
    const reopened = [];
    for (const mf of ctx.db.prepare('SELECT mf.*, f.interval, f.name FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id = ? AND mf.end_date = ?').all(id, p.exit_date)) {
      if (mf.interval === 'einmalig') continue;
      const z = fees.addDays(again ? today() : store.periodStart(today(), mf.interval), -1);   // Wiedereintritt: ab heute wie ein neues Mitglied (anteilig)
      ctx.db.prepare('UPDATE mv_member_fee SET end_date = NULL, booked_until = ? WHERE id = ?').run(!mf.booked_until || z > mf.booked_until ? z : mf.booked_until, mf.id); reopened.push(mf.name);
    }
    for (const md of ctx.db.prepare('SELECT md.*, d.name FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id WHERE md.member_id = ? AND md.exit_date = ?').all(id, p.exit_date)) {
      const z = store.zusatzStart(md.department_id, null);
      ctx.db.prepare('UPDATE mv_member_department SET exit_date = NULL, exit_reason = NULL, booked_until = ? WHERE id = ?').run(!md.booked_until || (z && z > md.booked_until) ? z : md.booked_until, md.id); reopened.push(md.name);
    }
    if (reopened.length) store.hist(id, uname(), 'Wieder aufgenommen', null, reopened.join(', '));
    ctx.db.prepare('UPDATE members SET active = 1 WHERE id = ?').run(id);
    ctx.db.prepare('UPDATE member_access SET blocked = 0 WHERE member_id = ?').run(id);
    return no;
  }

  /* ---------- Dokumente ---------- */
  admin.post('/member/:id/documents', PD, express.raw({ type: () => true, limit: DOC_MAX + 1024 }), (req, res) => {
    const id = int(req.params.id); const p = personRow(id);
    if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    let name = ''; try { name = decodeURIComponent(String(req.get('X-Filename') || '')); } catch (e) { name = ''; }
    try {
      store.ensurePerson(id);
      const docId = saveDocument(id, req.body, { kind: String(req.query.kind || 'sonstiges'), title: one(req.query.title, 120) || name, filename: name, user: uname(req) });
      store.hist(id, uname(req), 'Dokument', null, one(req.query.title, 120) || name);
      ctx.audit(req.user, 'Mitglied: Dokument hochgeladen', `${p.name}: ${name}`);
      res.json({ id: docId });
    } catch (e) { bad(res, e.message); }
  });
  admin.get('/documents/:id', PD, (req, res) => {
    const d = ctx.db.prepare('SELECT * FROM mv_document WHERE id = ?').get(int(req.params.id));
    if (!d) return bad(res, 'Nicht gefunden.', 404);
    const f = path.join(DOC_DIR, path.basename(d.file));
    if (!fs.existsSync(f)) return bad(res, 'Die Datei fehlt.', 404);
    const ext = d.file.split('.').pop();
    const safe = String(d.title).replace(/[^\wäöüÄÖÜß .-]+/g, '_').slice(0, 80) + (d.title.toLowerCase().endsWith('.' + ext) ? '' : '.' + ext);
    res.set({ 'Content-Type': d.mime || 'application/octet-stream', 'Content-Disposition': `${req.query.dl ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(safe)}`,
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'self'", 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    let buf; try { buf = ctx.require('./vault').readFile(f); } catch (e) { res.removeHeader('Content-Disposition'); res.set('Content-Type', 'application/json'); return bad(res, e.message, e.vaultLocked ? 423 : 500); }
    res.end(buf);
  });
  admin.delete('/documents/:id', PD, (req, res) => {
    const d = ctx.db.prepare('SELECT * FROM mv_document WHERE id = ?').get(int(req.params.id));
    if (!d) return bad(res, 'Nicht gefunden.', 404);
    deleteDocumentFile(d);
    ctx.db.prepare('DELETE FROM mv_document WHERE id = ?').run(d.id);
    if (d.member_id) store.hist(d.member_id, uname(req), 'Dokument gelöscht', d.title, null);
    ctx.audit(req.user, 'Mitglied: Dokument gelöscht', d.title);
    res.json({ ok: true });
  });

  /* ---------- Datenschutz ---------- */
  /* Datenauskunft (Art. 15 DSGVO) – mit den echten Rechten des Benutzers: ohne „Bankdaten“ bleibt die IBAN maskiert, ohne „Finanzen“
     fehlen die Forderungen, ohne „Dokumente“ die Dokumentliste. Die vollständige Auskunft erzeugt ein Admin mit allen Rechten. */
  async function auskunft(id, user) {
    const d = detail(id, user);
    if (!d) return null;
    const core = ctx.db.prepare('SELECT name, kind, active, created_at, pin_hash IS NOT NULL AS hat_pin FROM members WHERE id = ?').get(id);
    const drinks = ctx.drinks.byMonth(id);
    // Daten der übrigen Module (Hook memberData) – jedes Modul liefert nur, was es selbst zur Person speichert
    const module = {};
    for (const r of await ctx.callHooks('memberData', id)) if (r.result && Object.values(r.result).some(v => v && (!Array.isArray(v) || v.length))) module[r.name] = r.result;
    return { erstellt: nowTs(), verein: ctx.getSetting('club_name', ''), hinweis: 'Auskunft nach Art. 15 DSGVO – alle zu dieser Person gespeicherten Daten.',
      konto: core, vereinsdaten: { ...d.person, consents: d.person.consents }, bankverbindung: d.bank, abteilungen: d.departments, beitraege: d.fees, zahlergruppe: d.payerGroup, familienmitgliedschaft: d.family,
      ehrungen: d.honors, aemter: d.functions, gratulationen: { keine_gewuenscht: d.no_congrats, anlaesse: shared.congratsOf(id) }, forderungen: d.charges, dokumente: (d.documents || []).map(x => ({ titel: x.title, art: x.kind, datum: x.created_at })),
      aenderungsverlauf: d.history, mitglieder_app: d.app, getraenke_je_monat: drinks, weitere_bereiche: module };
  }
  admin.get('/member/:id/auskunft', P, ar(async (req, res) => {
    const id = int(req.params.id); const out = await auskunft(id, req.user);
    if (!out) return bad(res, 'Mitglied nicht gefunden.', 404);
    ctx.audit(req.user, 'Mitglied: Datenauskunft erstellt', out.vereinsdaten.name);
    res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="Datenauskunft_${(out.vereinsdaten.member_no || id)}.json"` }).send(JSON.stringify(out, null, 2));
  }));
  /* Austritt vor über X Jahren (Einstellung „Erinnern nach … Jahren“, Standard 2): Liste und Sammel-Anonymisieren; mit offenen Forderungen nicht */
  admin.get('/anonymize-due', P, (req, res) => res.json({ years: retYears(), rows: dueAnon().map(r => ({ id: r.id, name: r.name, member_no: r.member_no, exit_date: r.exit_date, open: r.open })) }));
  admin.post('/anonymize-due', P, (req, res) => {
    if (!['ANONYMISIEREN', 'ANONYMIZE'].includes(String((req.body || {}).confirm || '').trim().toUpperCase())) return bad(res, 'Bitte zur Bestätigung ANONYMISIEREN eingeben.');
    const rows = dueAnon(), go = rows.filter(r => !r.open);
    for (const r of go) anonymize(r.id, uname(req));
    if (go.length) ctx.audit(req.user, 'Mitglieder anonymisiert', `${go.length} ${go.length === 1 ? 'Mitglied' : 'Mitglieder'}, Austritt vor über ${retYears()} Jahren`);
    res.json({ ok: true, n: go.length, skipped: rows.length - go.length });
  });
  admin.post('/member/:id/anonymize', P, (req, res) => {
    const id = int(req.params.id); const p = personRow(id);
    if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    if (!p.exit_date || p.exit_date >= today()) return bad(res, 'Anonymisieren geht erst nach dem Austritt.');
    if (ctx.db.prepare("SELECT 1 FROM mv_charge WHERE member_id = ? AND status IN ('offen','eingezogen')").get(id)) return bad(res, 'Es gibt noch offene Forderungen – erst ausgleichen oder stornieren.');
    if (!['ANONYMISIEREN', 'ANONYMIZE'].includes(String((req.body || {}).confirm || '').trim().toUpperCase())) return bad(res, 'Bitte zur Bestätigung ANONYMISIEREN eingeben.');
    anonymize(id, uname(req));
    ctx.audit(req.user, 'Mitglied anonymisiert', `Nr. ${p.member_no || id}`);
    res.json({ ok: true });
  });

  /* ---------- Katalog: Abteilungen & Beitragsarten ---------- */
  admin.post('/departments', P, (req, res) => {
    const b = req.body || {}; const name = one(b.name, 60);
    if (name.length < 2) return bad(res, 'Bitte einen Namen eintragen.');
    if (ctx.db.prepare('SELECT 1 FROM mv_department WHERE lower(name) = lower(?)').get(name)) return bad(res, 'Diese Abteilung gibt es schon.');
    const id = Number(ctx.db.prepare('INSERT INTO mv_department(name, federation, sort) VALUES (?,?,?)').run(name, one(b.federation, 60) || null, int(b.sort)).lastInsertRowid);
    ctx.audit(req.user, 'Mitglieder: Abteilung angelegt', name);
    res.json({ id });
  });
  admin.put('/departments/:id', P, (req, res) => {
    const d = ctx.db.prepare('SELECT * FROM mv_department WHERE id = ?').get(int(req.params.id));
    if (!d) return bad(res, 'Nicht gefunden.', 404);
    const b = req.body || {}; const name = b.name !== undefined ? one(b.name, 60) : d.name;
    if (name.length < 2) return bad(res, 'Bitte einen Namen eintragen.');
    if (ctx.db.prepare('SELECT 1 FROM mv_department WHERE lower(name) = lower(?) AND id != ?').get(name, d.id)) return bad(res, 'Diese Abteilung gibt es schon.');
    ctx.db.prepare('UPDATE mv_department SET name = ?, federation = ?, sort = ?, active = ? WHERE id = ?').run(name, b.federation !== undefined ? one(b.federation, 60) || null : d.federation, b.sort !== undefined ? int(b.sort) : d.sort, b.active === undefined ? d.active : (b.active ? 1 : 0), d.id);
    res.json({ ok: true });
  });
  admin.delete('/departments/:id', P, (req, res) => {
    const d = ctx.db.prepare('SELECT * FROM mv_department WHERE id = ?').get(int(req.params.id));
    if (!d) return bad(res, 'Nicht gefunden.', 404);
    if (ctx.db.prepare('SELECT 1 FROM mv_member_department WHERE department_id = ?').get(d.id) || ctx.db.prepare('SELECT 1 FROM mv_fee WHERE department_id = ?').get(d.id)) return bad(res, 'Die Abteilung wird noch verwendet – stattdessen ausblenden.');
    ctx.db.prepare('DELETE FROM mv_department WHERE id = ?').run(d.id);
    res.json({ ok: true });
  });
  const feeInput = (b, cur = {}) => {
    const v = (k, d) => (b[k] !== undefined ? b[k] : (cur[k] !== undefined ? cur[k] : d));
    const out = { name: one(v('name', ''), 80), department_id: v('department_id', null) ? int(v('department_id', null)) : null, cents: Math.round(Number(v('cents', 0))), interval: v('interval', 'jahr'),
      prorate: ['voll', 'frei'].includes(v('prorate', 'anteilig')) ? v('prorate', 'anteilig') : 'anteilig', kind: v('kind', 'grund') === 'zusatz' ? 'zusatz' : 'grund', age_min: v('age_min', null) === '' || v('age_min', null) == null ? null : int(v('age_min', null)), age_max: v('age_max', null) === '' || v('age_max', null) == null ? null : int(v('age_max', null)),
      family: v('family', 0) ? 1 : 0, work_minutes: v('work_minutes', null) === '' || v('work_minutes', null) == null ? null : Math.max(0, int(v('work_minutes', null))), on_form: v('on_form', 1) ? 1 : 0, sort: int(v('sort', 0)), active: v('active', 1) ? 1 : 0, note: one(v('note', ''), 200) || null };
    if (out.name.length < 2) return { error: 'Bitte eine Bezeichnung eintragen.' };
    if (out.kind === 'zusatz') {
      if (!out.department_id) return { error: 'Ein Zusatzbeitrag gehört zu einer Abteilung – bitte die Abteilung wählen.' };
      if (out.interval === 'einmalig') return { error: 'Zusatzbeiträge laufen regelmäßig (jährlich, halbjährlich …).' };
      out.family = 0; out.on_form = 0; out.work_minutes = null;
      const other = ctx.db.prepare("SELECT interval FROM mv_fee WHERE kind = 'zusatz' AND department_id = ? AND id != ? AND active = 1 LIMIT 1").get(out.department_id, cur.id || 0);
      if (other && other.interval !== out.interval) return { error: 'Alle Zusatzbeiträge einer Abteilung brauchen denselben Rhythmus.' };
    }
    if (!Number.isFinite(out.cents) || out.cents < 0 || out.cents > 10000000) return { error: 'Ungültiger Betrag.' };
    if (!(out.interval in fees.MONTHS)) return { error: 'Ungültiger Rhythmus.' };
    if (out.department_id && !ctx.db.prepare('SELECT 1 FROM mv_department WHERE id = ?').get(out.department_id)) return { error: 'Abteilung nicht gefunden.' };
    if (out.age_min != null && out.age_max != null && out.age_min > out.age_max) return { error: 'Das Mindestalter ist größer als das Höchstalter.' };
    return { v: out };
  };
  /** Erster aktiver Zusatzbeitrag einer Abteilung: wer schon dabei ist, zahlt ab dem laufenden Zeitraum – keine vergangenen Jahre */
  const zusatzFirst = (v, exceptId = 0) => (v.kind === 'zusatz' && v.active && v.department_id
    && !ctx.db.prepare("SELECT 1 FROM mv_fee WHERE kind = 'zusatz' AND active = 1 AND department_id = ? AND id != ?").get(v.department_id, exceptId));
  const zusatzBegin = deptId => {
    for (const md of ctx.db.prepare('SELECT id, entry_date, booked_until FROM mv_member_department WHERE department_id = ?').all(deptId)) {
      const z = store.zusatzStart(deptId, md.entry_date);
      if (z && (!md.booked_until || z > md.booked_until)) ctx.db.prepare('UPDATE mv_member_department SET booked_until = ? WHERE id = ?').run(z, md.id);
    }
  };
  /* Reihenfolge der Beitragsarten (Liste, Auswahlfelder, Beitrittserklärung) */
  admin.put('/fees/order', P, (req, res) => {
    const ids = (Array.isArray((req.body || {}).ids) ? req.body.ids : []).map(Number).filter(Number.isInteger).slice(0, 200);
    const up = ctx.db.prepare("UPDATE mv_fee SET sort = ? WHERE id = ? AND kind != 'zusatz'");
    ctx.db.transaction(() => ids.forEach((id, i) => up.run((i + 1) * 10, id)))();
    ctx.audit(req.user, 'Mitglieder: Reihenfolge der Beitragsarten', ids.map(id => (ctx.db.prepare('SELECT name FROM mv_fee WHERE id = ?').get(id) || {}).name).filter(Boolean).join(', '));
    res.json({ ok: true });
  });
  admin.post('/fees', P, (req, res) => {
    const f = feeInput(req.body || {}); if (f.error) return bad(res, f.error);
    const k = Object.keys(f.v);
    const first = zusatzFirst(f.v);
    const id = Number(ctx.db.prepare(`INSERT INTO mv_fee(${k.join(', ')}) VALUES (${k.map(() => '?').join(', ')})`).run(...k.map(x => f.v[x])).lastInsertRowid);
    if (first) zusatzBegin(f.v.department_id);
    ctx.audit(req.user, 'Mitglieder: Beitragsart angelegt', `${f.v.name} ${euro(f.v.cents)}`);
    res.json({ id });
  });
  admin.put('/fees/:id', P, (req, res) => {
    const cur = ctx.db.prepare('SELECT * FROM mv_fee WHERE id = ?').get(int(req.params.id));
    if (!cur) return bad(res, 'Nicht gefunden.', 404);
    const f = feeInput(req.body || {}, cur); if (f.error) return bad(res, f.error);
    const used = ctx.db.prepare('SELECT 1 FROM mv_member_fee WHERE fee_id = ?').get(cur.id) || ctx.db.prepare('SELECT 1 FROM mv_member_department WHERE fee_id = ?').get(cur.id)
      || (cur.kind === 'zusatz' && ctx.db.prepare('SELECT 1 FROM mv_charge c JOIN mv_member_department md ON md.id = c.member_dept_id WHERE md.department_id = ?').get(cur.department_id));
    if (used && (f.v.kind !== cur.kind || (cur.kind === 'zusatz' && f.v.department_id !== cur.department_id)))
      return bad(res, `„${cur.name}“ ist schon in Gebrauch – die Art${cur.kind === 'zusatz' ? ' oder Abteilung' : ''} lässt sich nicht mehr ändern. Bitte eine neue Beitragsart anlegen und diese ausblenden.`);
    const first = !(cur.kind === 'zusatz' && cur.active) && zusatzFirst(f.v, cur.id);
    const k = Object.keys(f.v);
    ctx.db.prepare(`UPDATE mv_fee SET ${k.map(x => `${x} = ?`).join(', ')} WHERE id = ?`).run(...k.map(x => f.v[x]), cur.id);
    if (first) zusatzBegin(f.v.department_id);
    if (cur.cents !== f.v.cents) ctx.audit(req.user, 'Mitglieder: Beitrag geändert', `${f.v.name}: ${euro(cur.cents)} → ${euro(f.v.cents)}`);
    res.json({ ok: true });
  });
  admin.delete('/fees/:id', P, (req, res) => {
    const cur = ctx.db.prepare('SELECT * FROM mv_fee WHERE id = ?').get(int(req.params.id));
    if (!cur) return bad(res, 'Nicht gefunden.', 404);
    if (ctx.db.prepare('SELECT 1 FROM mv_member_fee WHERE fee_id = ?').get(cur.id) || ctx.db.prepare('SELECT 1 FROM mv_member_department WHERE fee_id = ?').get(cur.id)) return bad(res, 'Die Beitragsart ist Mitgliedern zugeordnet – stattdessen ausblenden.');
    ctx.db.prepare('DELETE FROM mv_fee WHERE id = ?').run(cur.id);
    res.json({ ok: true });
  });

  /* ---------- Einstellungen ---------- */
  function consentList() {
    let list = [];
    try { list = JSON.parse(S('consents', '')); } catch (e) { list = []; }
    if (!Array.isArray(list) || !list.length) list = DEFAULT_CONSENTS;
    return list.filter(c => c && c.key && c.text).slice(0, 8);
  }
  /** „Erinnern nach … Jahren“ nach dem Austritt (0 = aus, Standard 2) und wer darunter fällt (mit offenen Forderungen: open) */
  const retYears = () => { const n = parseInt(S('retention_years', '2'), 10); return Number.isFinite(n) ? Math.max(0, Math.min(30, n)) : 2; };
  function dueAnon() {
    const y = retYears(); if (!y) return [];
    const { nameKey } = ctx.require('./db');
    return ctx.db.prepare('SELECT p.member_id AS id, m.name, p.member_no, p.exit_date FROM mv_person p JOIN members m ON m.id = p.member_id WHERE p.anonymized_at IS NULL AND p.exit_date IS NOT NULL AND p.exit_date < ?')
      .all(fees.addMonths(today(), -12 * y)).map(r => ({ ...r, open: Boolean(ctx.db.prepare("SELECT 1 FROM mv_charge WHERE member_id = ? AND status IN ('offen','eingezogen')").get(r.id)) }))
      .sort((a, b) => nameKey(a.name, 'mitglied').localeCompare(nameKey(b.name, 'mitglied'), 'de'));
  }
  function settingsView(user) {
    const s = { club_name: ctx.getSetting('club_name', ''), club_street: S('club_street'), club_city: S('club_city'), creditor_id: S('creditor_id'), creditor_name: S('creditor_name') || ctx.getSetting('club_name', ''),
      club_iban: user && user.perms.includes('mitglieder_finanzen') ? store.account().iban : sepa.maskIban(store.account().iban), club_bic: store.account().bic, club_bank: store.account().bank,
      sepa_account: Number(S('sepa_account')) || null, account_name: store.account().name, account_central: store.account().central,
      mandate_prefix: S('mandate_prefix'), member_no_start: S('member_no_start', '1'), year_start: S('year_start', '01-01'), prenotify_days: parseInt(S('prenotify_days', '14'), 10) || 14,
      drinks_due: S('drinks_due', ''), due_text: S('due_text'), notify_to: S('notify_to'), app_tablet: S('app_tablet', '1') === '1', app_online: S('app_online', '0') === '1', app_intro: S('app_intro'),
      work_text: S('work_text'), satzung_url: S('satzung_url'), return_fee_cents: parseInt(S('return_fee_cents', '0'), 10) || 0, dunning_fee_cents: parseInt(S('dunning_fee_cents', '0'), 10) || 0,
      invoice_text: S('invoice_text'), consents: consentList(), retention_years: retYears(),
      notice_months: parseInt(S('notice_months', '3'), 10) || 0, family_child_max: store.childMax(), scope_confirm: S('scope_confirm', '1') === '1', sepa_required: sepaRequired(), app_perms: store.appPerms(), app_labels: { view: store.APP_VIEW, edit: store.APP_EDIT } };
    return s;
  }
  /** Schlüssel der Karten unter Beiträge & Zahlungen › Einstellungen */
  const FIN_KEYS = ['creditor_name', 'creditor_id', 'club_iban', 'club_bic', 'club_bank', 'sepa_account', 'mandate_prefix', 'prenotify_days', 'drinks_due', 'return_fee_cents', 'dunning_fee_cents', 'invoice_text'];
  admin.put('/settings', P, (req, res) => {
    // Erst alles prüfen und in `pending` sammeln, dann in einer Transaktion schreiben – bei einem Fehler bleibt alles unverändert
    const b = req.body || {}; const errors = []; const pending = [];
    if (FIN_KEYS.some(k => b[k] !== undefined) && !req.user.perms.includes('mitglieder_finanzen')) return bad(res, 'Lastschrift, Rechnungen und Mahnungen (Beiträge & Zahlungen › Einstellungen) darf nur ändern, wer das Recht „Einzug“ hat.', 403);
    const put = (k, v) => pending.push([k, v]);
    const str = (k, max) => { if (b[k] !== undefined) put(k, one(b[k], max)); };
    const long = (k, max) => { if (b[k] !== undefined) put(k, txt(b[k], max)); };
    str('club_street', 80); str('club_city', 80); str('creditor_name', 70); str('club_bank', 70); str('notify_to', 300);
    long('due_text', 600); long('app_intro', 1500); long('work_text', 600); long('invoice_text', 800);
    if (b.satzung_url !== undefined) { const u = one(b.satzung_url, 300); if (u && !/^https?:\/\//i.test(u)) errors.push('Die Satzung bitte als Adresse mit https:// angeben.'); else put('satzung_url', u); }
    if (b.creditor_id !== undefined) { const c = sepa.checkCreditorId(b.creditor_id); if (b.creditor_id && !c.ok) errors.push(c.error); else put('creditor_id', c.ci); }
    if (b.club_iban !== undefined && !/•/.test(String(b.club_iban))) { if (!req.user.perms.includes('mitglieder_finanzen')) errors.push('Die Vereins-IBAN darf nur ändern, wer das Recht „Finanzen“ hat.'); else { const i = sepa.checkIban(b.club_iban); if (b.club_iban && !i.ok) errors.push('Vereinskonto: ' + i.error); else put('club_iban', i.iban); } }
    if (b.sepa_account !== undefined) { if (!req.user.perms.includes('mitglieder_finanzen')) errors.push('Das Konto für Lastschriften darf nur ändern, wer das Recht „Finanzen“ hat.'); else if (b.sepa_account && !(ctx.bank.get(b.sepa_account) || {}).active) errors.push('Dieses Bankkonto gibt es nicht (mehr).'); else put('sepa_account', b.sepa_account ? int(b.sepa_account) : ''); }
    if (b.club_bic !== undefined) { const c = sepa.checkBic(b.club_bic); if (!c.ok) errors.push('Der BIC des Vereinskontos hat 8 oder 11 Zeichen.'); else put('club_bic', c.bic); }
    if (b.mandate_prefix !== undefined) put('mandate_prefix', String(b.mandate_prefix).replace(/[^A-Za-z0-9]/g, '').slice(0, 10));
    if (b.member_no_start !== undefined) put('member_no_start', String(Math.max(1, int(b.member_no_start, 1))));
    if (b.year_start !== undefined) { if (!/^(0[1-9]|1[0-2])-01$/.test(b.year_start)) errors.push('Das Beitragsjahr beginnt immer am Ersten eines Monats.'); else put('year_start', b.year_start); }
    if (b.prenotify_days !== undefined) { const n = int(b.prenotify_days); if (n < 1 || n > 30) errors.push('Die Vorabinformation braucht 1 bis 30 Tage (Standard 14; kürzer nur, wenn es so vereinbart ist).'); else put('prenotify_days', n); }
    if (b.drinks_due !== undefined) { if (b.drinks_due && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(b.drinks_due)) errors.push('Ungültiger Termin für den Verkaufs-Einzug.'); else put('drinks_due', b.drinks_due); }
    if (b.app_tablet !== undefined) put('app_tablet', b.app_tablet ? '1' : '0');
    if (b.app_online !== undefined) put('app_online', b.app_online ? '1' : '0');
    for (const k of ['return_fee_cents', 'dunning_fee_cents']) if (b[k] !== undefined) put(k, String(Math.max(0, Math.min(10000, int(b[k])))));
    if (b.notice_months !== undefined) put('notice_months', String(Math.max(0, Math.min(24, int(b.notice_months)))));
    if (b.scope_confirm !== undefined) put('scope_confirm', b.scope_confirm ? '1' : '0');
    if (b.sepa_required !== undefined) put('sepa_required', b.sepa_required ? '1' : '0');
    if (b.app_perms && typeof b.app_perms === 'object') {
      const clean = (defs, v) => Object.fromEntries(Object.keys(defs).map(k => [k, Boolean(v && v[k])]));
      put('app_perms', JSON.stringify({ view: clean(store.APP_VIEW, b.app_perms.view), edit: clean(store.APP_EDIT, b.app_perms.edit) }));
    }
    if (b.retention_years !== undefined) put('retention_years', String(Math.max(0, Math.min(30, int(b.retention_years)))));
    if (b.consents !== undefined && Array.isArray(b.consents)) {
      const list = b.consents.slice(0, 8).map((c, i) => ({ key: /^[a-z0-9_]{2,20}$/.test(c.key) ? c.key : 'e' + (i + 1), short: one(c.short, 40) || 'Einwilligung', text: txt(c.text, 700), required: Boolean(c.required) })).filter(c => c.text.length > 5);
      put('consents', JSON.stringify(list));
    }
    if (b.notify_to && String(b.notify_to).split(',').some(x => x.trim() && !mailOk(x.trim()))) errors.push('Ungültige E-Mail-Adresse bei „Benachrichtigung an“.');
    if (errors.length) return bad(res, errors.join(' '));
    const prevSet = Object.fromEntries(pending.map(([k]) => [k, S(k, '')]));   // alte Werte fürs Protokoll
    ctx.db.transaction(() => { for (const [k, v] of pending) SET(k, v); })();
    { const L = { club_street: 'Straße', club_city: 'PLZ und Ort', creditor_name: 'Zahlungsempfänger', club_bank: 'Kreditinstitut', notify_to: 'Benachrichtigung an', due_text: ['Hinweis zu Beitrag & Fälligkeit', 'text'],
        app_intro: ['Begrüßung im Formular', 'text'], work_text: ['Hinweis Arbeitseinsatz', 'text'], invoice_text: ['Rechnungstext', 'text'], satzung_url: 'Satzung (Link)', creditor_id: 'Gläubiger-ID', club_iban: ['Vereins-IBAN', 'text'],
        sepa_account: ['Konto für Lastschriften', 'text'], club_bic: 'BIC', mandate_prefix: 'Mandatsreferenz-Vorsilbe', member_no_start: 'Mitgliedsnummern ab', year_start: 'Beginn des Beitragsjahres', prenotify_days: 'Vorabinformation (Tage)',
        drinks_due: 'Einzug Verkauf am', app_tablet: ['Beitrittserklärung am Tablet', 'bool'], app_online: ['Online-Beitrittserklärung', 'bool'], return_fee_cents: ['Rücklastschrift-Gebühr', 'euro'], dunning_fee_cents: ['Mahngebühr', 'euro'],
        notice_months: 'Kündigungsfrist (Monate)', scope_confirm: ['Abteilungsmeldungen bestätigen', 'bool'], sepa_required: ['Lastschrift ist Pflicht', 'bool'], app_perms: ['„Meine Daten“ in der App', 'text'], retention_years: 'Datenschutz-Erinnerung nach … Jahren', consents: ['Einwilligungen', 'text'] };
      const after = {}; for (const [k, v] of pending) { after[k] = String(v); }
      const diff = ctx.auditDiff(L, Object.fromEntries(Object.keys(after).map(k => [k, prevSet[k]])), after);
      if (diff) ctx.audit(req.user, 'Mitglieder: Einstellungen geändert', diff); }
    res.json({ ok: true, settings: settingsView(req.user) });
  });

  /* ---------- weitere Teile ---------- */
  shared = { auskunft, C: ctx, store, sepa, fees, personRow, bankRow, mandateState, listRows, createPerson, savePerson, saveDocument, deleteDocumentFile, consentList, settingsView, txt, one, mailOk, euro, deD, uname, ar, exitMember, zusatzFor, inScope, reenterMember };
  require('./lib/money').register(shared);
  require('./lib/kontoauszug').register(shared);
  require('./lib/agecheck').register(shared);
  ageScanFn = shared.ageScan; ageForFn = shared.ageFor;
  require('./lib/applications').register(shared);
  require('./lib/reports').register(shared);
  require('./lib/congrats').register(shared);
  require('./lib/importvc').register(shared);
  require('./lib/memberapp').register(shared);
  try { anonReapply(); } catch (e) { console.error('Mitgliederverwaltung – Anonymisierungen:', e.message); }   // nach dem Zurückspielen einer Sicherung

  /* Kennzahlen & Warnungen für die Übersicht */
  /* Einrichtungs-Assistent (Verein › Einrichtung): eigene Schritte – zeigen auf die vorhandenen Karten, done prüft die eigenen Daten */
  ctx.hooks.setupSteps = () => [
    { id: 'beitraege', title: 'Beiträge und Abteilungen', text: 'Beitragsarten des Hauptvereins und – falls ihr Abteilungen habt – deren Zusatzbeiträge. Vorlagen gibt es bewusst nicht: Jeder Verein rechnet anders.',
      page: 'mv-stamm', card: ['Beiträge Hauptverein', 'Abteilungen', 'Zusatzbeiträge'], done: Boolean(ctx.db.prepare('SELECT 1 FROM mv_fee WHERE active = 1').get()) },
    { id: 'konto', title: 'Vereinskonto', text: 'Auf welches Konto die Beiträge gehen (IBAN, BIC). Es gilt für alle Module – Lastschriften, Rechnungen der Buchhaltung.',
      page: 'einstellungen', sec: ['cw_setsec', 'bank'], card: ['Bankkonten'], done: ctx.bank.list().some(a => a.active) },
    { id: 'lastschrift', title: 'Lastschrift', text: 'Gläubiger-ID und Mandatsreferenz für den Beitragseinzug per SEPA-Lastschrift. Ohne Lastschrift einfach „Später“ und ausblenden.',
      page: 'mv-zeinst', card: ['Lastschrift'], done: Boolean(ctx.setting('creditor_id', '')) },
    { id: 'mitgliedschaft', title: 'Mitgliedschaft', text: 'Mitgliedsnummern, Beitragsjahr und Kündigungsfrist.', page: 'mv-einstellungen', card: ['Mitgliedschaft'] },
    { id: 'import', title: 'Mitglieder übernehmen', text: 'Mitglieder aus einer CSV-Datei (z. B. Export aus verein.cloud) importieren – oder später einzeln von Hand anlegen.',
      page: 'mitglieder', card: [], done: Boolean(ctx.db.prepare("SELECT 1 FROM members WHERE kind = 'mitglied' AND deleted = 0").get()) },
  ];
  ctx.hooks.overview = async user => {
    const scope = user && (user.deptOnly || []).includes('mitglieder') ? (user.depts || []) : null;
    if (scope) {   // Abteilungsadmin: nur die eigenen Mitglieder und nur, was er selbst erledigen kann
      const mine = listRows({ status: 'aktuell' }).filter(r => r.dept_ids.some(d => scope.includes(d)));
      const al = [];
      const apps = ctx.db.prepare("SELECT * FROM mv_application WHERE status = 'eingegangen'").all().filter(a => appInScope(a, scope)).length;
      if (apps) al.push({ level: 'a', text: `${apps} neue Beitrittserklärung(en) für deine Abteilung warten auf Bestätigung.` });
      const ch = ctx.db.prepare("SELECT member_id, kind FROM mv_change WHERE status = 'offen'").all().filter(c => c.kind !== 'bank' && inScope(c.member_id, scope)).length;
      if (ch) al.push({ level: 'a', text: `${ch} Änderungswunsch/-wünsche aus der Mitglieder-App.` });
      const inc = mine.filter(r => scopedIssues(r.issues).length).length;
      if (inc) al.push({ level: 'a', text: `${inc} ${inc === 1 ? 'Mitglied' : 'Mitglieder'} deiner Abteilung mit fehlenden Angaben (z. B. E-Mail).` });
      al.push(...shared.congratsAlerts(user));
      return { kpis: [{ l: 'Mitglieder deiner Abteilung', v: mine.length }, { l: 'Austritte angekündigt', v: mine.filter(r => r.leaving).length }, { l: 'Eintritte ' + today().slice(0, 4), v: mine.filter(r => r.entry_date && r.entry_date.startsWith(today().slice(0, 4))).length }], alerts: al };
    }
    const rows = listRows({ status: 'aktuell' });
    const alerts = [];
    const apps = ctx.db.prepare("SELECT COUNT(*) n FROM mv_application WHERE status = 'eingegangen'").get().n;
    if (apps) alerts.push({ level: 'a', text: `${apps} neue Beitrittserklärung(en) warten auf Bestätigung.` });
    const ch = ctx.db.prepare("SELECT COUNT(*) n FROM mv_change WHERE status = 'offen'").get().n;
    if (ch) alerts.push({ level: 'a', text: `${ch} Änderungswunsch/-wünsche aus der Mitglieder-App.` });
    const noMandate = rows.filter(r => r.issues.some(i => /Mandat|Bankverbindung|IBAN/.test(i))).length;
    if (noMandate) alerts.push({ level: 'a', text: `${noMandate} Lastschriftzahler ohne gültiges SEPA-Mandat.` });
    const fin = !user || (user.perms || []).includes('mitglieder_finanzen');   // Hinweise zu Beiträge & Zahlungen nur für wen, der sie erledigen darf
    if (fin && (!S('creditor_id') || !store.account().iban)) alerts.push({ level: 'a', text: 'Für Lastschriften fehlt noch die Gläubiger-ID oder ein Bankkonto.', detail: 'Gläubiger-ID unter Beiträge & Zahlungen › Einstellungen, Bankkonto unter Verein › Einstellungen › Bankkonten.', go: 'mv-zeinst', link: 'Eintragen' });
    const ret = retYears(), old = dueAnon().length;
    if (old) alerts.push({ level: 'a', text: `${old} ${old === 1 ? 'ausgetretenes Mitglied' : 'ausgetretene Mitglieder'} seit über ${ret} Jahren – bitte prüfen und anonymisieren.`, go: 'mv-einstellungen', link: 'Liste ansehen' });
    // Lastschrift eingereicht, aber noch nicht als bezahlt gebucht → Kassierer erinnern, sobald Rückläufer unwahrscheinlich sind
    const wait = parseInt(S('paid_reminder_days', '10'), 10) || 10;
    if (fin) for (const k of ctx.db.prepare("SELECT id, collection_date FROM mv_collection WHERE status = 'erstellt' AND collection_date <= ?").all(fees.addDays(today(), -wait)))
      alerts.push({ level: 'a', text: `Lastschrift vom ${deD(k.collection_date)} als bezahlt buchen?`, detail: 'Wenn nichts zurückgekommen ist, unter „Beiträge & Zahlungen › Lastschriften“ die Zahlung als erfolgt buchen.', go: 'mv-einzug', link: 'Buchen' });
    const ageN = ageScanFn ? ageScanFn() : 0;
    if (ageN) alerts.push({ level: 'a', text: `${ageN} ${ageN === 1 ? 'Mitglied wechselt' : 'Mitglieder wechseln'} die Altersstufe.`, detail: 'Bitte entscheiden: umstellen oder so belassen.', go: 'mv-stamm', link: 'Entscheiden' });
    alerts.push(...shared.congratsAlerts(user));   // anstehende Gratulationen (nur mit Recht „Gratulationen“)
    const leaving = rows.filter(r => r.leaving).length;
    return { kpis: [{ l: 'Mitglieder', v: rows.length }, { l: 'Austritte angekündigt', v: leaving }, { l: 'Eintritte ' + today().slice(0, 4), v: rows.filter(r => r.entry_date && r.entry_date.startsWith(today().slice(0, 4))).length }], alerts };
  };
  /* für den Kern: Tablet-Liste im Verkauf – Angehörige „über den Hauptzahler“ ausblenden; sichtbar sind sie nur mit „bucht selbst“ */
  ctx.hooks.tabletMembers = () => {
    const rows = ctx.db.prepare(`SELECT p.member_id, p.payer_id FROM mv_person p JOIN members m ON m.id = p.member_id
      WHERE p.payer_id IS NOT NULL AND p.payer_id != p.member_id AND p.sales_mode = 'payer' AND m.deleted = 0 AND m.active = 1 AND p.anonymized_at IS NULL`).all();
    return { hidden: rows.filter(r => store.payerOf(r.member_id) !== r.member_id).map(r => r.member_id) };
  };
  /* für andere Module (Buchhaltung): Anschrift eines Mitglieds, Forderung anlegen/abfragen/stornieren */
  ctx.hooks.memberAddress = id => {
    const p = personRow(id); if (!p) return null;
    return { id, name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name, street: p.street, zip: p.zip, city: p.city, country: p.country, email: p.email, mobile: p.mobile || null, phone: p.phone || null, member_no: p.member_no, payment: p.payment || 'lastschrift' };
  };
  ctx.hooks.createCharge = ({ member_id, text, cents, due_date, kind = 'sonstiges', ext_key, by }) => {
    if (!personRow(member_id)) throw new Error('Mitglied nicht gefunden.');
    store.ensurePerson(member_id);
    return Number(ctx.db.prepare('INSERT INTO mv_charge(member_id, for_member_id, kind, text, cents, due_date, ext_key, created_by) VALUES (?,?,?,?,?,?,?,?)')
      .run(member_id, member_id, kind, one(text, 140), Math.round(cents), isDate(due_date) ? due_date : today(), ext_key ? String(ext_key).slice(0, 80) : null, by || null).lastInsertRowid);
  };
  /** Verkaufs-Abrechnung aus einem Lauf: wird sie hier noch berechnet? false = Posten storniert (nichts berechnet), null = unbekannt */
  ctx.hooks.drinksSettlementBilled = ({ batch, memberId }) => {
    const run = ctx.db.prepare('SELECT id FROM mv_run WHERE drinks_batch = ?').get(String(batch || ''));
    if (!run) return null;
    const c = ctx.db.prepare("SELECT status FROM mv_charge WHERE run_id = ? AND kind = 'getraenke' AND COALESCE(for_member_id, member_id) = ? ORDER BY id DESC LIMIT 1").get(run.id, ctx.int(memberId));
    return c ? c.status !== 'storniert' : null;
  };
  ctx.hooks.chargeStatus = ids => Object.fromEntries((ids || []).length ? ctx.db.prepare(`SELECT id, status, paid_at FROM mv_charge WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids).map(r => [r.id, { status: r.status, paid_at: r.paid_at }]) : []);
  ctx.hooks.cancelCharge = (id, reason, by) => {
    const c = ctx.db.prepare('SELECT * FROM mv_charge WHERE id = ?').get(id);
    if (!c) return false;
    if (c.status === 'eingezogen') throw new Error('Der Posten steckt in einer laufenden Lastschrift – erst im Einzug klären.');
    if (shared.paidByStatement(c)) throw new Error('Der Posten ist laut Kontoauszug bezahlt – bitte in den Mitgliedern stornieren (Guthaben oder zurücküberwiesen).');
    if (c.status === 'offen' || c.status === 'bezahlt') ctx.db.prepare("UPDATE mv_charge SET status = 'storniert', note = ? WHERE id = ?").run(`storniert von ${by || '–'}: ${one(reason, 100)}`, id);
    return true;
  };
  ctx.hooks.chargePaid = (id, date, via) => { ctx.db.prepare("UPDATE mv_charge SET status = 'bezahlt', paid_at = ?, paid_via = ? WHERE id = ? AND status = 'offen'").run(isDate(date) ? date : today(), via || 'ueberweisung', id); };
  /* für den Kern: Konto wird zusammengeführt (intoId) oder gelöscht (intoId = null). Läuft synchron in der Transaktion des Kerns,
     VOR dem generischen Umhängen/Löschen aller Spalten mit Fremdschlüssel auf members(id). Hier nur, was der Kern nicht kennt:
     Verlauf und Altersstufen-Hinweise (ohne Fremdschlüssel), Beitrittserklärungen, Dokument-Dateien, Zahler-Verweise von Angehörigen. */
  /* ----- Mitglied löschen: Was hängt noch daran? (Kern fragt vor dem Löschen; Vergangenes zählt nicht, bezahlte Forderungen auch nicht) ----- */
  /** Beim Löschen eines Mitglieds bleiben Forderungen als Verlauf (offene sperren das Löschen ohnehin, s. memberLinks) */
  ctx.hooks.historyTables = () => ['mv_charge'];
  /** Kontoart wechseln (z. B. zu „Kein Mitglied“) nur ohne Mitgliedsdaten – sonst hingen Adresse, Bank & Co. unsichtbar an einem Nicht-Mitglied */
  ctx.hooks.memberKindLock = id => (ctx.db.prepare('SELECT 1 FROM mv_person WHERE member_id = ? AND anonymized_at IS NULL').get(id) ? ['Mitgliedsdaten vorhanden – erst Austritt eintragen und anonymisieren'] : []);
  ctx.hooks.memberLinks = id => {
    const q = (sql, ...a) => ctx.db.prepare(sql).all(...a), d0 = today(), lf = ctx.require('./db').lastFirst, names = rows => rows.map(r => lf(r.name, r.kind)).join(', ');
    const out = [], p = ctx.db.prepare('SELECT payer_id, family_of FROM mv_person WHERE member_id = ?').get(id) || {};
    const fee = q('SELECT f.name FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id = ? AND (mf.end_date IS NULL OR mf.end_date >= ?)', id, d0);
    if (fee.length) out.push('Beitrag zugeordnet: ' + fee.map(r => r.name).join(', '));
    const dep = q('SELECT d.name FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id WHERE md.member_id = ? AND (md.exit_date IS NULL OR md.exit_date >= ?)', id, d0);
    if (dep.length) out.push('Abteilung: ' + dep.map(r => r.name).join(', '));
    const payFor = q('SELECT m.name, m.kind FROM mv_person p JOIN members m ON m.id = p.member_id WHERE p.payer_id = ? AND p.member_id != ? AND m.deleted = 0', id, id);
    if (payFor.length) out.push('Zahlt für: ' + names(payFor));
    if (p.payer_id && p.payer_id !== id) out.push('Zahlt über: ' + names(q('SELECT name, kind FROM members WHERE id = ?', p.payer_id)));
    const fam = q('SELECT m.name, m.kind FROM mv_person p JOIN members m ON m.id = p.member_id WHERE p.family_of = ? AND p.member_id != ? AND m.deleted = 0', id, id);
    if (fam.length) out.push('Familie: ' + names(fam));
    if (p.family_of && p.family_of !== id) out.push('Gehört zur Familie von: ' + names(q('SELECT name, kind FROM members WHERE id = ?', p.family_of)));
    const open = ctx.db.prepare("SELECT COUNT(*) n FROM mv_charge WHERE (member_id = ? OR for_member_id = ?) AND status IN ('offen', 'eingezogen')").get(id, id).n;
    if (open) out.push(`${open} offene ${open === 1 ? 'Forderung' : 'Forderungen'}`);
    const fn = q('SELECT name FROM mv_function WHERE member_id = ? AND (to_date IS NULL OR to_date >= ?)', id, d0);
    if (fn.length) out.push('Amt: ' + fn.map(r => r.name).join(', '));
    const hon = q('SELECT name FROM mv_honor WHERE member_id = ?', id);
    if (hon.length) out.push('Ehrung: ' + hon.map(r => r.name).join(', '));
    return out;
  };
  ctx.hooks.memberRemoved = (fromId, intoId) => {
    const from = ctx.db.prepare('SELECT name FROM members WHERE id = ?').get(fromId) || { name: String(fromId) };
    if (intoId) {
      // Angehörige, die über das alte Konto zahlten, zahlen jetzt über das Zielkonto; das Zielkonto zahlt nie über sich selbst
      ctx.db.prepare('UPDATE mv_person SET payer_id = NULL WHERE member_id = ? AND payer_id = ?').run(intoId, fromId);
      ctx.db.prepare('UPDATE mv_person SET payer_id = ? WHERE payer_id = ? AND member_id != ?').run(intoId, fromId, intoId);
      ctx.db.prepare('UPDATE mv_person SET family_of = NULL WHERE member_id = ? AND family_of = ?').run(intoId, fromId);
      ctx.db.prepare('UPDATE mv_person SET family_of = ? WHERE family_of = ? AND member_id != ?').run(intoId, fromId, intoId);
      ctx.db.prepare('UPDATE mv_history SET member_id = ? WHERE member_id = ?').run(intoId, fromId);
      ctx.db.prepare('UPDATE mv_application SET member_id = ? WHERE member_id = ?').run(intoId, fromId);
      // Altersstufen-Hinweise: beim Zielkonto schon vorhandene (UNIQUE) fallen weg
      for (const n of ctx.db.prepare('SELECT id FROM mv_age_notice WHERE member_id = ?').all(fromId)) {
        try { ctx.db.prepare('UPDATE mv_age_notice SET member_id = ? WHERE id = ?').run(intoId, n.id); } catch (e) { ctx.db.prepare('DELETE FROM mv_age_notice WHERE id = ?').run(n.id); }
      }
      store.hist(intoId, 'System', 'Zusammengeführt', null, `Konto „${from.name}“ (Nr. ${fromId}) übernommen`);
      return;
    }
    // Löschen: Dateien der Dokumente entfernen (die Zeilen löscht der Kern über den Fremdschlüssel), Verweise ohne Fremdschlüssel lösen
    for (const d of ctx.db.prepare('SELECT * FROM mv_document WHERE member_id = ?').all(fromId)) deleteDocumentFile(d);
    ctx.db.prepare('UPDATE mv_person SET payer_id = NULL WHERE payer_id = ?').run(fromId);              // Angehörige zahlen wieder selbst
    ctx.db.prepare('UPDATE mv_person SET family_of = NULL WHERE family_of = ?').run(fromId);            // … und stehen ohne Familienmitgliedschaft da
    ctx.db.prepare('UPDATE mv_charge SET for_member_id = NULL WHERE for_member_id = ? AND member_id != ?').run(fromId, fromId);   // Forderungen des Zahlers bleiben
    ctx.db.prepare('DELETE FROM mv_history WHERE member_id = ?').run(fromId);
    ctx.db.prepare('DELETE FROM mv_age_notice WHERE member_id = ?').run(fromId);
    ctx.db.prepare('UPDATE mv_application SET member_id = NULL WHERE member_id = ?').run(fromId);
  };
  /* für den Kern: Abteilungen (Benutzer & Rollen) */
  ctx.hooks.bankAccountUsed = id => (Number(S('sepa_account')) === Number(id) ? 'Mitglieder (Lastschriften)' : null);
  ctx.hooks.departments = () => ctx.db.prepare('SELECT id, name, active FROM mv_department ORDER BY sort, name').all();
  /* für andere Module (Buchungssystem, Buchhaltung, Helferdienste) – antworten sofort, also auch über callHooksSync */
  ctx.hooks.functionsOf = id => { const d = today(); return ctx.db.prepare('SELECT name FROM mv_function WHERE member_id = ? AND (from_date IS NULL OR from_date <= ?) AND (to_date IS NULL OR to_date >= ?)').all(id, d, d).map(x => String(x.name).trim()); };
  ctx.hooks.functionNames = () => [...new Set(ctx.db.prepare('SELECT name FROM mv_function').all().map(x => String(x.name).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  ctx.hooks.fees = () => ctx.db.prepare("SELECT id, name FROM mv_fee WHERE active = 1 AND kind != 'zusatz' ORDER BY sort, name").all();
  ctx.hooks.memberNumbers = () => Object.fromEntries(ctx.db.prepare('SELECT member_id, member_no FROM mv_person WHERE member_no IS NOT NULL').all().map(r => [r.member_id, r.member_no]));
  ctx.hooks.clubInfo = () => ({ street: S('club_street', ''), city: S('club_city', ''), yearStart: S('year_start', '01-01') });
  /* für andere Module (Arbeitseinsatz) */
  /* Helferdienste „Familienpool“: Familienmitgliedschaft (family_of), ohne eine solche die Zahlergruppe – siehe store.familyOf */
  ctx.hooks.familyOf = id => store.familyOf(id);
  /** Jahrgang und Geschlecht aller Personen (für Hinweise im Spielbetrieb, z. B. Altersklasse H40) → { id: { y, g } } */
  ctx.hooks.birthGender = () => Object.fromEntries(ctx.db.prepare('SELECT member_id, birth_date, gender FROM mv_person WHERE anonymized_at IS NULL').all()
    .map(r => [r.member_id, { y: /^\d{4}-/.test(r.birth_date || '') ? Number(r.birth_date.slice(0, 4)) : null, g: r.gender || null }]));
  ctx.hooks.memberInScope = (id, depts) => inScope(Number(id), (depts || []).map(Number).filter(Number.isInteger));
  /* Suche (Strg/⌘ K): Mitglieder nach Name oder Mitgliedsnummer, Abteilungsleitung nur die eigenen Abteilungen. Nur Name, Nummer, Abteilungen – keine Bank- oder Kontaktdaten. */
  ctx.hooks.search = s => {
    const scope = (s.user.deptOnly || []).includes('mitglieder') ? (s.user.depts || []) : null;
    if (s.locked || (scope && !scope.length)) return [];
    const w = s.where('m.name', 'p.member_no'), day = today(), lf = ctx.require('./db').lastFirst;
    const rows = ctx.db.prepare(`SELECT m.id, m.name, p.member_no, p.exit_date,
        (SELECT group_concat(d.name, ', ') FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id WHERE md.member_id = m.id AND (md.exit_date IS NULL OR md.exit_date >= ?)) AS depts
      FROM members m LEFT JOIN mv_person p ON p.member_id = m.id WHERE m.kind = 'mitglied' AND m.deleted = 0 AND p.anonymized_at IS NULL AND ${w.sql}`).all(day, ...w.args)
      .filter(r => !scope || inScope(r.id, scope));
    return [{ group: 'Mitglieder', art: 'mitglied', page: 'mitglieder', detail: true, hits: s.pick(rows, r => [lf(r.name), r.member_no]).map(r => ({
      id: r.id, label: lf(r.name), person: true, score: r._score,
      sub: [r.member_no ? `${ctx.T('Nr.')} ${r.member_no}` : '', r.depts, r.exit_date && r.exit_date < day ? 'ausgetreten' : ''] })) }];
  };
  /* Beitrag einer Person = ihr Hauptbeitrag (kein Abteilungs-Zusatzbeitrag, keine einmalige Gebühr); bei gleichem Beginn der zuletzt eingetragene */
  ctx.hooks.memberInfo = id => {
    const p = personRow(id); if (!p) return null;
    const fee = ctx.db.prepare(`SELECT f.* FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id = ? AND f.kind != 'zusatz' AND f.interval != 'einmalig' AND (mf.end_date IS NULL OR mf.end_date >= ?) ORDER BY mf.start_date DESC, mf.id DESC LIMIT 1`).get(id, today());
    // ohne eigenen Beitrag: der Familienbeitrag des Oberhaupts (family_of), sonst – wie früher – der Beitrag des Zahlers
    const famFee = !fee && p.family_of ? ctx.db.prepare(`SELECT f.* FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id = ? AND f.family = 1 AND f.kind != 'zusatz' AND f.interval != 'einmalig' AND (mf.end_date IS NULL OR mf.end_date >= ?) ORDER BY mf.start_date DESC, mf.id DESC LIMIT 1`).get(p.family_of, today()) : null;
    const payerFee = famFee || (!fee && p.payer_id ? ctx.db.prepare(`SELECT f.* FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id = ? AND f.kind != 'zusatz' AND f.interval != 'einmalig' AND (mf.end_date IS NULL OR mf.end_date >= ?) ORDER BY mf.start_date DESC, mf.id DESC LIMIT 1`).get(store.payerOf(id), today()) : null);
    const d0 = today();
    const departments = ctx.db.prepare("SELECT department_id FROM mv_member_department WHERE member_id = ? AND (entry_date IS NULL OR entry_date <= ?) AND (exit_date IS NULL OR exit_date >= ?) AND status != 'ausgetreten'").all(id, d0, d0).map(r => r.department_id);
    return { id, name: p.name, email: p.email, birth_date: p.birth_date, status: store.isExited(p) ? 'ausgetreten' : p.status, entry_date: p.entry_date, exit_date: p.exit_date, payer: store.payerOf(id), family_of: p.family_of || null, departments,
      fee: fee ? { id: fee.id, name: fee.name, work_minutes: fee.work_minutes } : payerFee ? { id: payerFee.id, name: payerFee.name, work_minutes: payerFee.work_minutes, viaPayer: true, viaFamily: Boolean(famFee) } : null };
  };
  /* Funktionsexport: Katalog und Einstellungen (ohne Personen, ohne Bankdaten) */
  const CONFIG_KEYS = ['club_street', 'club_city', 'creditor_name', 'mandate_prefix', 'year_start', 'prenotify_days', 'drinks_due', 'due_text', 'app_intro', 'work_text', 'satzung_url', 'consents', 'invoice_text', 'return_fee_cents', 'dunning_fee_cents', 'notice_months', 'member_no_start', 'app_perms', 'scope_confirm'];
  ctx.hooks.exportConfig = () => ({ depts: ctx.db.prepare('SELECT name, federation, sort, active FROM mv_department').all(),
    fees: ctx.db.prepare('SELECT f.name, f.kind, d.name AS department, f.cents, f.interval, f.prorate, f.age_min, f.age_max, f.family, f.work_minutes, f.on_form, f.sort, f.active, f.note FROM mv_fee f LEFT JOIN mv_department d ON d.id = f.department_id').all(),
    settings: Object.fromEntries(CONFIG_KEYS.map(k => [k, S(k)])) });
  ctx.hooks.importConfig = data => {
    if (!data || typeof data !== 'object') throw new Error('Leere Funktionsdatei.');
    let d = 0, f = 0;
    for (const x of Array.isArray(data.depts) ? data.depts.slice(0, 100) : []) { const n = one(x.name, 60); if (n.length < 2 || ctx.db.prepare('SELECT 1 FROM mv_department WHERE lower(name) = lower(?)').get(n)) continue; ctx.db.prepare('INSERT INTO mv_department(name, federation, sort, active) VALUES (?,?,?,?)').run(n, one(x.federation, 60) || null, int(x.sort), x.active === 0 ? 0 : 1); d++; }
    for (const x of Array.isArray(data.fees) ? data.fees.slice(0, 200) : []) {
      const dep = x.department ? ctx.db.prepare('SELECT id FROM mv_department WHERE lower(name) = lower(?)').get(String(x.department)) : null;
      const fi = feeInput({ ...x, department_id: dep ? dep.id : null }); if (fi.error || ctx.db.prepare('SELECT 1 FROM mv_fee WHERE lower(name) = lower(?) AND kind = ? AND COALESCE(department_id, 0) = ?').get(fi.v.name, fi.v.kind, fi.v.department_id || 0)) continue;
      const first = zusatzFirst(fi.v);
      const k = Object.keys(fi.v); ctx.db.prepare(`INSERT INTO mv_fee(${k.join(', ')}) VALUES (${k.map(() => '?').join(', ')})`).run(...k.map(y => fi.v[y])); f++;
      if (first) zusatzBegin(fi.v.department_id);
    }
    if (data.settings && typeof data.settings === 'object') for (const [k, v] of Object.entries(data.settings)) if (typeof v === 'string' && CONFIG_KEYS.includes(k)) SET(k, v.slice(0, 2000));
    return `${d} ${d === 1 ? 'Abteilung' : 'Abteilungen'}, ${f} ${f === 1 ? 'Beitragsart' : 'Beitragsarten'} und die Einstellungen übernommen – Gläubiger-ID und Vereinskonto bitte selbst eintragen`;
  };

  setTimeout(daily, 15000).unref();
  setInterval(daily, 60 * 60000).unref();
}

const DEFAULT_CONSENTS = [
  { key: 'daten', short: 'Datenschutz & Satzung', required: true, text: 'Mit der Speicherung, Übermittlung und Verarbeitung meiner personenbezogenen Daten für Vereinszwecke gemäß der Satzung und den Datenschutzbestimmungen bin ich einverstanden. Ich kann jederzeit Auskunft über diese Daten verlangen. Mit der Unterschrift erkenne ich die Satzung des Vereins an.' },
  { key: 'homepage', short: 'Homepage', required: false, text: 'Ich bin mit der Veröffentlichung meines Namens und von Fotos (z. B. Mannschaftsfotos, Ergebnisse) auf der Homepage des Vereins einverstanden.' },
  { key: 'verband', short: 'Verband', required: false, text: 'Ich bin mit der Weitergabe meiner Daten an den Fachverband (z. B. für Spielberechtigung und Mannschaftsmeldung) einverstanden.' },
];

module.exports = { activate, DEFAULT_CONSENTS };
