'use strict';
/**
 * Beitrittserklärung digital
 *  Wege: (1) Verwaltung legt an → Unterschrift am Tablet (6-stelliger Code), (2) selbst am Tablet, (3) online (Port der Mitglieder-App), (4) Papier → Dokument hochladen.
 *  Bei der Unterschrift entsteht ein PDF wie das Papierformular, mit beiden Unterschriften, Zeitpunkt und Prüfwert (SHA-256).
 *  Annehmen legt die Mitglieder an (Familie: Hauptzahler + Angehörige), ordnet Beitrag und Mandat zu und schickt die Bestätigung mit Mandatsreferenz.
 */
const crypto = require('crypto');
const pdf = require('./pdf');

function register(sh) {
  const { C, store, sepa, fees, personRow, createPerson, savePerson, saveDocument, consentList, one, txt, mailOk, euro, deD, uname, ar } = sh;
  const { S, today, nowTs } = store;
  const { need, bad, int, rateLimit } = C;
  const admin = C.admin, db = C.db;
  const P = need('mitglieder');
  const isDate = fees.isDate;
  const club = () => ({ name: S('creditor_name') || C.getSetting('club_name', 'Verein'), street: S('club_street'), city: S('club_city'), ci: S('creditor_id') });
  const formFees = () => db.prepare('SELECT id, name, cents, interval, family, age_min, age_max, work_minutes FROM mv_fee WHERE active = 1 AND on_form = 1 AND kind != \'zusatz\' ORDER BY sort, name').all();

  /** Abteilungen mit Zusatzbeiträgen (je Person ankreuzbar) */
  function formDepts() {
    const z = db.prepare("SELECT f.id, f.name, f.cents, f.interval, f.age_min, f.age_max, f.department_id FROM mv_fee f JOIN mv_department d ON d.id = f.department_id WHERE f.kind = 'zusatz' AND f.active = 1 AND d.active = 1 ORDER BY d.sort, d.name, COALESCE(f.age_min, 0)").all();
    const out = [];
    for (const f of z) { let d = out.find(x => x.id === f.department_id); if (!d) { d = { id: f.department_id, name: db.prepare('SELECT name FROM mv_department WHERE id = ?').get(f.department_id).name, fees: [] }; out.push(d); } d.fees.push({ name: f.name, cents: f.cents, interval: f.interval, age_min: f.age_min, age_max: f.age_max }); }
    return out;
  }
  const deptFeeFor = (dep, birth) => fees.pickByAge(dep.fees, birth, today()).fee;
  /** Zeilen für das PDF: „Max Muster: Padel – Padel Erwachsene 60,00 €“ */
  function deptLines(data) {
    const deps = formDepts(); const lines = [];
    for (const p of data.persons || []) for (const id of p.departments || []) { const dep = deps.find(x => x.id === id); if (!dep) continue; const f = deptFeeFor(dep, p.birth_date); lines.push(`${p.first_name} ${p.last_name}: ${dep.name}${f ? ` – ${f.name} ${euro(f.cents)}` : ''}`); }
    return lines;
  }
  const pdfSettings = data => ({ due_text: S('due_text'), work_text: S('work_text'), consents: consentList(), dept_lines: data ? deptLines(data) : null, depts: formDepts() });
  function formConfig() {
    return { club: club(), intro: S('app_intro'), due_text: S('due_text'), work_text: S('work_text'), satzung_url: S('satzung_url'), consents: consentList(), fees: formFees(), departments: formDepts(),
      tablet: S('app_tablet', '1') === '1', online: S('app_online', '0') === '1', today: today(), child_max: childMax() };
  }

  const childMax = () => parseInt(S('family_child_max', '18'), 10) || 18;
  /** Antragsdaten prüfen und bereinigen → { v } oder { error } */
  function validate(raw, { needBank = true } = {}) {
    const d = raw && typeof raw === 'object' ? raw : {};
    const validDepts = new Set(formDepts().map(x => x.id));
    const persons = (Array.isArray(d.persons) ? d.persons : []).slice(0, 10).map((p, i) => ({
      first_name: one(p.first_name, 60), last_name: one(p.last_name, 60), birth_date: isDate(p.birth_date) ? p.birth_date : '', gender: ['m', 'w', 'd'].includes(p.gender) ? p.gender : '',
      role: i === 0 ? 'haupt' : (p.role === 'partner' ? 'partner' : 'kind'), mobile: one(p.mobile, 40), email: one(p.email, 120).toLowerCase(), fee_id: p.fee_id ? int(p.fee_id) : null,
      departments: [...new Set((Array.isArray(p.departments) ? p.departments : []).map(Number))].filter(id => validDepts.has(id)).slice(0, 10) }));
    if (!persons.length) return { error: 'Bitte mindestens eine Person eintragen.' };
    for (const [i, p] of persons.entries()) {
      const who = i === 0 ? 'Antragsteller/in' : `Weitere Person ${i}`;
      if (p.first_name.length < 1 || p.last_name.length < 2) return { error: `${who}: bitte Vor- und Nachname eintragen.` };
      if (!p.birth_date) return { error: `${who}: bitte das Geburtsdatum eintragen.` };
      if (p.birth_date > today() || p.birth_date < '1900-01-01') return { error: `${who}: das Geburtsdatum stimmt nicht.` };
      if (p.email && !mailOk(p.email)) return { error: `${who}: die E-Mail-Adresse sieht nicht gültig aus.` };
      if (i > 0 && p.role === 'kind' && fees.ageAt(p.birth_date, today()) > childMax()) return { error: `${p.first_name} ${p.last_name}: Kinder lassen sich bis ${childMax()} Jahre mit anmelden – ältere bitte mit einer eigenen Beitrittserklärung.` };
    }
    const v = { persons, street: one(d.street, 80), zip: one(d.zip, 10), city: one(d.city, 60), mobile: one(d.mobile, 40), email: one(d.email, 120).toLowerCase(),
      fee_id: d.fee_id ? int(d.fee_id) : null, holder: one(d.holder, 70), iban: '', bic: '', bank: one(d.bank, 70), consents: {}, signer: one(d.signer, 70), note: txt(d.note, 500), entry_date: isDate(d.entry_date) ? d.entry_date : '' };
    if (v.street.length < 3 || v.zip.length < 4 || v.city.length < 2) return { error: 'Bitte die vollständige Anschrift eintragen.' };
    if (!v.email && !v.mobile) return { error: 'Bitte eine E-Mail-Adresse oder Mobilnummer angeben.' };
    if (v.email && !mailOk(v.email)) return { error: 'Die E-Mail-Adresse sieht nicht gültig aus.' };
    const fee = v.fee_id ? db.prepare('SELECT * FROM mv_fee WHERE id = ? AND active = 1').get(v.fee_id) : null;
    if (!fee) return { error: 'Bitte die Mitgliedschaft (Beitrag) auswählen.' };
    // mehrere Personen → nur Familienbeitrag (sofern es einen gibt); eine Person → kein Familienbeitrag
    const famFees = formFees().filter(f => f.family);
    if (persons.length > 1 && famFees.length && !fee.family) return { error: 'Bei mehreren Personen bitte die Familienmitgliedschaft wählen.' };
    if (persons.length === 1 && fee.family) return { error: 'Die Familienmitgliedschaft gilt nur zusammen mit weiteren Personen – bitte Partner/in oder Kinder hinzufügen oder eine andere Mitgliedschaft wählen.' };
    if (persons.length > 1 && !fee.family && persons.slice(1).some(p => !p.fee_id)) {
      // ohne Familientarif: jede weitere Person bekommt einen passenden Beitrag (nach Alter) – die Verwaltung kann ihn beim Annehmen ändern
      for (const p of persons.slice(1)) if (!p.fee_id) { const f = suggestFee(p.birth_date); p.fee_id = f ? f.id : null; }
    }
    if (needBank) {
      const ib = sepa.checkIban(d.iban); if (!ib.ok) return { error: 'IBAN: ' + ib.error };
      const bc = sepa.checkBic(d.bic); if (!bc.ok) return { error: 'Der BIC hat 8 oder 11 Zeichen (oder leer lassen).' };
      v.iban = ib.iban; v.bic = bc.bic;
      if (v.holder.length < 3) return { error: 'Bitte den Kontoinhaber eintragen.' };
    } else { const ib = sepa.checkIban(d.iban); if (ib.ok) v.iban = ib.iban; v.bic = sepa.checkBic(d.bic).bic; }
    for (const c of consentList()) {
      const on = Boolean(d.consents && d.consents[c.key]);
      if (c.required && !on) return { error: `Bitte „${c.short}“ bestätigen – ohne geht es nicht.` };
      if (on) v.consents[c.key] = true;
    }
    const minor = fees.ageAt(persons[0].birth_date, today()) < 18;
    if (minor && v.signer.length < 3) return { error: 'Bei Minderjährigen unterschreibt ein gesetzlicher Vertreter – bitte dessen Namen eintragen.' };
    return { v, fee };
  }
  function suggestFee(birth) {
    const a = fees.ageAt(birth, today());
    return formFees().find(f => !f.family && (f.age_min == null || a >= f.age_min) && (f.age_max == null || a <= f.age_max)) || null;
  }
  const sigOk = s => typeof s === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]{400,}$/.test(s) && s.length < 280000;
  const hashOf = (data, a, b, at) => crypto.createHash('sha256').update(JSON.stringify({ data, sig_member: a, sig_mandate: b, signed_at: at })).digest('hex');

  /** Unterschrift abschließen: Prüfwert, PDF, Benachrichtigung */
  async function finalize(id, via, sigA, sigB) {
    const a = db.prepare('SELECT * FROM mv_application WHERE id = ?').get(id);
    const data = JSON.parse(a.data);
    const at = nowTs();
    const sha = hashOf(data, sigA, sigB, at);
    const s = pdfSettings(data);
    const feeList = formFees().length ? formFees() : db.prepare('SELECT id, name, cents FROM mv_fee WHERE id = ?').all(data.fee_id);
    if (!feeList.some(f => f.id === data.fee_id)) feeList.push(db.prepare('SELECT id, name, cents FROM mv_fee WHERE id = ?').get(data.fee_id));
    const buf = await pdf.application(club(), { data, signed_at: at, signed_via: via, sig_member: sigA, sig_mandate: sigB, sha256: sha }, feeList.filter(Boolean), s);
    const p0 = data.persons[0];
    const docId = saveDocument(null, buf, { kind: 'antrag', title: `Beitrittserklärung ${p0.first_name} ${p0.last_name} ${deD(at.slice(0, 10))}.pdf`, filename: 'antrag.pdf', user: via === 'online' ? 'online' : 'Tablet', applicationId: id });
    db.prepare("UPDATE mv_application SET status = 'eingegangen', signed_at = ?, signed_via = ?, sig_member = ?, sig_mandate = ?, sha256 = ?, document_id = ?, code_hash = NULL WHERE id = ?").run(at, via, sigA, sigB, sha, docId, id);
    C.audit(null, 'Beitrittserklärung unterschrieben', `${p0.first_name} ${p0.last_name} (${via === 'online' ? 'online' : 'Tablet'})`);
    const auto = data.auto_accept && a.created_by;
    if (auto) { try { accept(id, { by: a.created_by }); } catch (e) { console.error('Beitrittserklärung annehmen:', e.message); } }
    else notifyBoard(data, via).catch(() => {});
    return { id, auto: Boolean(auto) };
  }
  async function notifyBoard(data, via) {
    const to = S('notify_to'); if (!to || !C.mail.ready()) return;
    const p0 = data.persons[0];
    await C.mail.send({ to, subject: `Neue Beitrittserklärung: ${p0.first_name} ${p0.last_name}`, text: [`Eine neue Beitrittserklärung ist eingegangen (${via === 'online' ? 'online' : 'am Tablet'}):`, '',
      ...data.persons.map(p => `- ${p.first_name} ${p.last_name}, geb. ${deD(p.birth_date)}`), '', 'Bitte in der Verwaltung unter Mitglieder → Anträge prüfen und annehmen.'].join('\n') });
  }

  /** Antrag annehmen → Mitglieder anlegen (oder mit vorhandenen zusammenführen) */
  function accept(id, { by, persons: choice = [], entry_date } = {}) {
    const a = db.prepare('SELECT * FROM mv_application WHERE id = ?').get(id);
    if (!a || a.status !== 'eingegangen') throw new Error('Dieser Antrag kann nicht (mehr) angenommen werden.');
    const d = JSON.parse(a.data);
    const fee = db.prepare('SELECT * FROM mv_fee WHERE id = ?').get(d.fee_id);
    const start = isDate(entry_date) ? entry_date : (d.entry_date || today());
    const ids = [];
    db.transaction(() => {
      d.persons.forEach((p, i) => {
        const ch = choice[i] || {};
        const fields = { first_name: p.first_name, last_name: p.last_name, birth_date: p.birth_date, gender: p.gender || null, street: d.street, zip: d.zip, city: d.city,
          mobile: (i === 0 ? d.mobile : p.mobile) || null, email: (i === 0 ? d.email : p.email) || null, entry_date: start, payment: 'lastschrift', status: 'aktiv' };
        let mid = ch.merge_id ? int(ch.merge_id) : 0;
        if (mid && db.prepare("SELECT 1 FROM members WHERE id = ? AND kind = 'mitglied' AND deleted = 0").get(mid)) {
          store.ensurePerson(mid);
          const cur = db.prepare('SELECT member_no FROM mv_person WHERE member_id = ?').get(mid);
          if (!cur.member_no) db.prepare('UPDATE mv_person SET member_no = ? WHERE member_id = ?').run(store.nextMemberNo(), mid);
          savePerson(mid, fields, by);
          db.prepare('UPDATE members SET pending = 0, active = 1 WHERE id = ?').run(mid);
        } else mid = createPerson(fields, by);
        db.prepare('UPDATE mv_person SET consents = ? WHERE member_id = ?').run(JSON.stringify(Object.fromEntries(Object.keys(d.consents || {}).map(k => [k, (a.signed_at || nowTs()).slice(0, 10)]))), mid);
        ids.push(mid);
      });
      const head = ids[0];
      for (const mid of ids.slice(1)) db.prepare('UPDATE mv_person SET payer_id = ? WHERE member_id = ?').run(head, mid);   // Zahler: der/die Antragsteller/in
      // Beiträge: Hauptzahler bekommt den gewählten; ohne Familientarif jede weitere Person ihren eigenen
      const addFee = (mid, fid) => { if (fid && db.prepare('SELECT 1 FROM mv_fee WHERE id = ?').get(fid)) db.prepare('INSERT INTO mv_member_fee(member_id, fee_id, start_date) VALUES (?,?,?)').run(mid, fid, start); };
      const headFee = db.prepare('SELECT * FROM mv_fee WHERE id = ?').get((choice[0] && choice[0].fee_id) || fee.id) || fee;
      addFee(head, headFee.id);
      if (!headFee.family) d.persons.slice(1).forEach((p, i) => addFee(ids[i + 1], (choice[i + 1] && choice[i + 1].fee_id) || p.fee_id));
      else for (const mid of ids.slice(1)) db.prepare('UPDATE mv_person SET family_of = ? WHERE member_id = ?').run(head, mid);   // Familienmitgliedschaft: Partner/in und Kinder sind über den Familienbeitrag abgedeckt
      // angekreuzte Abteilungen je Person (Zusatzbeiträge laufen dann automatisch nach Alter)
      d.persons.forEach((p, i) => { for (const dep of p.departments || []) if (db.prepare('SELECT 1 FROM mv_department WHERE id = ?').get(dep) && !db.prepare('SELECT 1 FROM mv_member_department WHERE member_id = ? AND department_id = ? AND exit_date IS NULL').get(ids[i], dep)) db.prepare('INSERT INTO mv_member_department(member_id, department_id, entry_date) VALUES (?,?,?)').run(ids[i], dep, start); });
      // Abteilung des Beitrags
      const deps = new Set(db.prepare('SELECT f.department_id FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id IN (' + ids.map(() => '?').join(',') + ') AND f.department_id IS NOT NULL').all(...ids).map(r => r.department_id));
      for (const dep of deps) for (const mid of ids) if (!db.prepare('SELECT 1 FROM mv_member_department WHERE member_id = ? AND department_id = ? AND exit_date IS NULL').get(mid, dep)) db.prepare('INSERT INTO mv_member_department(member_id, department_id, entry_date) VALUES (?,?,?)').run(mid, dep, start);
      // Bankverbindung & Mandat (Datum der Unterschrift)
      if (d.iban) {
        const no = db.prepare('SELECT member_no FROM mv_person WHERE member_id = ?').get(head).member_no;
        const ref = store.mandateRefFor(no);
        db.prepare(`INSERT INTO mv_bank(member_id, holder, iban, bic, bank, mandate_ref, mandate_date, updated_at) VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(member_id) DO UPDATE SET holder = excluded.holder, iban = excluded.iban, bic = excluded.bic, bank = excluded.bank, mandate_ref = excluded.mandate_ref, mandate_date = excluded.mandate_date,
          mandate_first_used = NULL, mandate_last_used = NULL, mandate_revoked = NULL, updated_at = excluded.updated_at`).run(head, d.holder, d.iban, d.bic || null, d.bank || null, ref, (a.signed_at || nowTs()).slice(0, 10), nowTs());
      }
      if (a.document_id) db.prepare('UPDATE mv_document SET member_id = ? WHERE id = ?').run(head, a.document_id);
      db.prepare("UPDATE mv_application SET status = 'angenommen', member_id = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?").run(head, by || null, nowTs(), id);
    })();
    C.audit(by, 'Beitrittserklärung angenommen', d.persons.map(p => `${p.first_name} ${p.last_name}`).join(', '));
    welcome(id).catch(e => console.error('Willkommens-Mail:', e.message));
    return ids;
  }
  async function welcome(id) {
    const a = db.prepare('SELECT * FROM mv_application WHERE id = ?').get(id);
    const d = JSON.parse(a.data);
    if (!d.email || !C.mail.ready()) return;
    const b = db.prepare('SELECT * FROM mv_bank WHERE member_id = ?').get(a.member_id) || {};
    const p = db.prepare('SELECT member_no FROM mv_person WHERE member_id = ?').get(a.member_id) || {};
    const doc = a.document_id ? db.prepare('SELECT * FROM mv_document WHERE id = ?').get(a.document_id) : null;
    const file = doc ? require('path').join(C.require('./db').DATA_DIR, 'mitglieder-dokumente', require('path').basename(doc.file)) : null;
    const cl = club();
    await C.mail.send({ to: d.email, subject: `Willkommen im ${cl.name}`, text: [`Guten Tag ${d.persons[0].first_name} ${d.persons[0].last_name},`, '', `herzlich willkommen im ${cl.name}! Ihre Mitgliedschaft ist bestätigt.`, '',
      `Mitgliedsnummer: ${p.member_no || '–'}`, b.mandate_ref ? `Mandatsreferenz für das SEPA-Lastschriftmandat: ${b.mandate_ref}` : '', b.mandate_ref ? `Gläubiger-Identifikationsnummer: ${cl.ci}` : '', '',
      'Ihre Beitrittserklärung finden Sie als PDF im Anhang.', '', 'Viele Grüße', cl.name].filter((x, i, arr) => x !== '' || arr[i - 1] !== '').join('\n'),
      attachments: file && require('fs').existsSync(file) ? [{ filename: 'Beitrittserklaerung.pdf', path: file }] : undefined });
  }

  /* ---------- Verwaltung ---------- */
  const view = a => {
    const d = JSON.parse(a.data);
    return { id: a.id, source: a.source, status: a.status, created_at: a.created_at, created_by: a.created_by, signed_at: a.signed_at, signed_via: a.signed_via, sha256: a.sha256, document_id: a.document_id,
      member_id: a.member_id, reviewed_by: a.reviewed_by, reviewed_at: a.reviewed_at, reason: a.reason, pre_by: a.pre_by || null, pre_at: a.pre_at || null, waiting: a.status === 'unterschrift' && a.code_expires > Date.now(),
      names: d.persons.map(p => `${p.first_name} ${p.last_name}`).join(', '), data: { ...d, iban_masked: sepa.maskIban(d.iban) } };
  };
  admin.get('/applications', P, (req, res) => {
    const st = req.query.status || 'offen';
    const rows = db.prepare(`SELECT * FROM mv_application ${st === 'offen' ? "WHERE status IN ('unterschrift','eingegangen')" : st === 'alle' ? '' : 'WHERE status = ?'} ORDER BY id DESC LIMIT 200`).all(...(st === 'offen' || st === 'alle' ? [] : [st]));
    res.json(rows.map(r => { const v = view(r); if (!req.user.perms.includes('mitglieder_bank')) v.data.iban = ''; return v; }));
  });
  admin.get('/applications/config', P, (req, res) => res.json(formConfig()));
  admin.get('/applications/:id', P, (req, res) => {
    const a = db.prepare('SELECT * FROM mv_application WHERE id = ?').get(int(req.params.id));
    if (!a) return bad(res, 'Nicht gefunden.', 404);
    const v = view(a); if (!req.user.perms.includes('mitglieder_bank')) v.data.iban = '';
    // mögliche Treffer im Bestand (gleicher Name / Geburtsdatum) – z. B. schon als Getränkekonto angelegt
    v.matches = v.data.persons.map(p => db.prepare(`SELECT m.id, m.name, x.birth_date, x.member_no FROM members m LEFT JOIN mv_person x ON x.member_id = m.id
      WHERE m.kind = 'mitglied' AND m.deleted = 0 AND (lower(m.name) = lower(?) OR lower(m.name) = lower(?) OR (x.birth_date = ? AND lower(COALESCE(x.last_name, m.name)) LIKE lower(?)))`).all(`${p.first_name} ${p.last_name}`, `${p.last_name}, ${p.first_name}`, p.birth_date, `%${p.last_name}%`));
    v.suggest = v.data.persons.map(p => { const f = suggestFee(p.birth_date); return f ? f.id : null; });
    res.json(v);
  });
  const newCode = () => String(crypto.randomInt(100000, 1000000));
  const codeHash = c => crypto.createHash('sha256').update('mvcode:' + c).digest('hex');
  admin.post('/applications', P, (req, res) => {
    const b = req.body || {};
    const r = validate(b.data, { needBank: true }); if (r.error) return bad(res, r.error);
    if (!r.v.consents || !consentList().filter(c => c.required).every(c => r.v.consents[c.key])) { /* Pflicht-Einwilligungen gibt die Person beim Unterschreiben */ }
    const code = newCode();
    const data = { ...r.v, auto_accept: b.auto_accept !== false };
    const id = Number(db.prepare("INSERT INTO mv_application(source, status, data, code_hash, code_expires, created_by) VALUES ('verwaltung', 'unterschrift', ?, ?, ?, ?)")
      .run(JSON.stringify(data), codeHash(code), Date.now() + 3 * 3600000, uname(req)).lastInsertRowid);
    C.audit(req.user, 'Beitrittserklärung zur Unterschrift ans Tablet', r.v.persons.map(p => `${p.first_name} ${p.last_name}`).join(', '));
    res.json({ id, code, expires_in_min: 180 });
  });
  admin.post('/applications/:id/code', P, (req, res) => {
    const a = db.prepare('SELECT * FROM mv_application WHERE id = ?').get(int(req.params.id));
    if (!a || a.status !== 'unterschrift') return bad(res, 'Dieser Antrag wartet nicht auf eine Unterschrift.');
    const code = newCode();
    db.prepare('UPDATE mv_application SET code_hash = ?, code_expires = ? WHERE id = ?').run(codeHash(code), Date.now() + 3 * 3600000, a.id);
    res.json({ code, expires_in_min: 180 });
  });
  admin.put('/applications/:id', P, (req, res) => {
    const a = db.prepare('SELECT * FROM mv_application WHERE id = ?').get(int(req.params.id));
    if (!a || a.status !== 'unterschrift') return bad(res, 'Nur Anträge, die noch nicht unterschrieben sind, lassen sich ändern.');
    const r = validate((req.body || {}).data, { needBank: true }); if (r.error) return bad(res, r.error);
    const old = JSON.parse(a.data);
    db.prepare('UPDATE mv_application SET data = ? WHERE id = ?').run(JSON.stringify({ ...r.v, auto_accept: old.auto_accept }), a.id);
    res.json({ ok: true });
  });
  admin.post('/applications/:id/accept', P, (req, res) => {
    const b = req.body || {};
    if (req.mvScope && S('scope_confirm', '1') === '1') {   // Abteilungsleitung befürwortet – annehmen macht die Vereinsverwaltung
      const a = db.prepare("SELECT * FROM mv_application WHERE id = ? AND status = 'eingegangen'").get(int(req.params.id));
      if (!a) return bad(res, 'Dieser Antrag kann nicht mehr bearbeitet werden.');
      db.prepare('UPDATE mv_application SET pre_by = ?, pre_at = ? WHERE id = ?').run(uname(req), nowTs(), a.id);
      C.audit(req.user, 'Beitrittserklärung befürwortet (Abteilung)', view(a).names);
      if (sh.notifyBoard) sh.notifyBoard(`Zur Bestätigung: Beitrittserklärung ${view(a).names}`, [`${uname(req)} (Abteilungsleitung) befürwortet die Beitrittserklärung von ${view(a).names}.`, '', 'Bitte in der Verwaltung unter Mitgliederverwaltung → Anträge annehmen.']).catch(() => {});
      return res.json({ ok: true, pending: true });
    }
    try { const ids = accept(int(req.params.id), { by: uname(req), persons: Array.isArray(b.persons) ? b.persons : [], entry_date: b.entry_date }); res.json({ ok: true, member_id: ids[0], ids }); }
    catch (e) { bad(res, e.message); }
  });
  admin.post('/applications/:id/reject', P, (req, res) => {
    const a = db.prepare('SELECT * FROM mv_application WHERE id = ?').get(int(req.params.id));
    if (!a || !['eingegangen', 'unterschrift'].includes(a.status)) return bad(res, 'Dieser Antrag kann nicht abgelehnt werden.');
    db.prepare("UPDATE mv_application SET status = 'abgelehnt', reason = ?, reviewed_by = ?, reviewed_at = ?, code_hash = NULL WHERE id = ?").run(one((req.body || {}).reason, 200) || null, uname(req), nowTs(), a.id);
    C.audit(req.user, 'Beitrittserklärung abgelehnt', view(a).names);
    res.json({ ok: true });
  });
  admin.delete('/applications/:id', P, (req, res) => {
    const a = db.prepare('SELECT * FROM mv_application WHERE id = ?').get(int(req.params.id));
    if (!a || !['abgelehnt', 'unterschrift'].includes(a.status)) return bad(res, 'Nur abgelehnte oder noch nicht unterschriebene Anträge können gelöscht werden.');
    if (a.document_id) { const d = db.prepare('SELECT * FROM mv_document WHERE id = ? AND member_id IS NULL').get(a.document_id); if (d) { sh.deleteDocumentFile(d); db.prepare('DELETE FROM mv_document WHERE id = ?').run(d.id); } }
    db.prepare('DELETE FROM mv_application WHERE id = ?').run(a.id);
    C.audit(req.user, 'Beitrittserklärung gelöscht', view(a).names);
    res.json({ ok: true });
  });
  admin.get('/applications/:id/pdf', P, ar(async (req, res) => {
    const a = db.prepare('SELECT * FROM mv_application WHERE id = ?').get(int(req.params.id));
    if (!a) return bad(res, 'Nicht gefunden.', 404);
    if (a.document_id) return res.redirect(303, `../../documents/${a.document_id}`);
    // noch nicht unterschrieben: Vorschau ohne Unterschriften (z. B. zum Ausdrucken für die Unterschrift auf Papier)
    const data = JSON.parse(a.data);
    const buf = await pdf.application(club(), { data }, formFees(), pdfSettings(data));
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="Beitrittserklaerung.pdf"' }).send(buf);
  }));
  admin.get('/applications-blank.pdf', P, ar(async (req, res) => {
    const buf = await pdf.application(club(), { data: { persons: [{}], consents: {} } }, formFees(), pdfSettings(null));
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="Beitrittserklaerung_leer.pdf"' }).send(buf);
  }));

  /* ---------- Tablet ---------- */
  const T = C.tablet;
  const tFails = C.require('./security').limiter({ per: 8, baseMs: 15 * 60000 });
  T.get('/antrag/config', (req, res) => {
    const c = formConfig();
    res.json({ ...c, waiting: db.prepare("SELECT COUNT(*) n FROM mv_application WHERE status = 'unterschrift' AND code_expires > ?").get(Date.now()).n });
  });
  T.post('/antrag', rateLimit('mvtab', 10, 10 * 60000), ar(async (req, res) => {
    if (S('app_tablet', '1') !== '1') return bad(res, 'Beitrittserklärungen am Tablet sind ausgeschaltet.', 403);
    const b = req.body || {};
    const r = validate(b.data); if (r.error) return bad(res, r.error);
    if (!sigOk(b.sig_member) || !sigOk(b.sig_mandate)) return bad(res, 'Bitte beide Unterschriften leisten.');
    const id = Number(db.prepare("INSERT INTO mv_application(source, status, data) VALUES ('tablet', 'neu', ?)").run(JSON.stringify(r.v)).lastInsertRowid);
    res.json(await finalize(id, 'tablet', b.sig_member, b.sig_mandate));
  }));
  /** Antrag aus der Verwaltung mit dem Code öffnen */
  function byCode(req, res) {
    const ip = req.ip || '?';
    const w = tFails.blocked(ip);
    if (w) { bad(res, `Zu viele falsche Codes – bitte ${w} Min. warten.`, 429); return null; }
    const code = String((req.body || {}).code || '').replace(/\D/g, '');
    const a = code.length === 6 ? db.prepare("SELECT * FROM mv_application WHERE status = 'unterschrift' AND code_hash = ? AND code_expires > ?").get(codeHash(code), Date.now()) : null;
    if (!a) { tFails.fail(ip); bad(res, 'Der Code stimmt nicht oder ist abgelaufen.', 404); return null; }
    tFails.ok(ip);
    return a;
  }
  T.post('/antrag/open', rateLimit('mvcode', 20, 10 * 60000), (req, res) => {
    const a = byCode(req, res); if (!a) return;
    const d = JSON.parse(a.data);
    res.json({ id: a.id, data: { ...d, iban: sepa.fmtIban(d.iban) }, config: formConfig() });
  });
  T.post('/antrag/sign', rateLimit('mvcode', 20, 10 * 60000), ar(async (req, res) => {
    const a = byCode(req, res); if (!a) return;
    const b = req.body || {};
    if (!sigOk(b.sig_member) || !sigOk(b.sig_mandate)) return bad(res, 'Bitte beide Unterschriften leisten.');
    // Einwilligungen gibt die Person selbst am Tablet
    const d = JSON.parse(a.data);
    const cons = {};
    for (const c of consentList()) { const on = Boolean(b.consents && b.consents[c.key]); if (c.required && !on) return bad(res, `Bitte „${c.short}“ bestätigen.`); if (on) cons[c.key] = true; }
    db.prepare('UPDATE mv_application SET data = ? WHERE id = ?').run(JSON.stringify({ ...d, consents: cons }), a.id);
    res.json(await finalize(a.id, 'tablet', b.sig_member, b.sig_mandate));
  }));

  /* ---------- online (Port der Mitglieder-App, ohne Anmeldung) ---------- */
  const Pub = C.public;
  /* Formular-Ticket: vom Server ausgestellt und signiert (Zeit + Zufall), frühestens nach 15 s und höchstens 6 Std. einlösbar, nur einmal */
  const formKey = () => { let k = S('form_secret'); if (!/^[0-9a-f]{64}$/.test(k)) { k = crypto.randomBytes(32).toString('hex'); store.SET('form_secret', k); } return k; };
  const formSig = (ts, n) => crypto.createHmac('sha256', formKey()).update(`antrag:${ts}:${n}`).digest('hex').slice(0, 32);
  const formTicket = () => { const ts = Date.now(), n = crypto.randomBytes(9).toString('hex'); return `${ts}.${n}.${formSig(ts, n)}`; };
  const usedTickets = new Map();   // Ticket → Ablauf (nur im Speicher; ältere als 6 Std. gelten ohnehin nicht)
  function ticketCheck(t) {
    const m = /^(\d{13})\.([0-9a-f]{18})\.([0-9a-f]{32})$/.exec(String(t || ''));
    if (!m) return 'Das Formular ist veraltet – bitte die Seite neu laden.';
    const ts = Number(m[1]), age = Date.now() - ts;
    const a = Buffer.from(formSig(ts, m[2])), b = Buffer.from(m[3]);
    if (!crypto.timingSafeEqual(a, b)) return 'Das Formular ist veraltet – bitte die Seite neu laden.';
    if (age < 15000) return 'Bitte das Formular in Ruhe ausfüllen und dann noch einmal absenden.';
    if (age > 6 * 3600000) return 'Das Formular war zu lange offen – bitte die Seite neu laden.';
    if (usedTickets.has(m[0])) return 'Dieser Antrag wurde schon abgeschickt.';
    return null;
  }
  const ticketUse = t => { const now = Date.now(); for (const [k, v] of usedTickets) if (v < now) usedTickets.delete(k); usedTickets.set(String(t), now + 6 * 3600000); };
  Pub.get('/antrag/config', (req, res) => {
    if (S('app_online', '0') !== '1') return res.status(404).json({ error: 'Der Online-Antrag ist ausgeschaltet.' });
    res.json({ ...formConfig(), t: formTicket() });
  });
  Pub.post('/antrag', rateLimit('mvonline', 5, 60 * 60000), ar(async (req, res) => {
    if (S('app_online', '0') !== '1') return bad(res, 'Der Online-Antrag ist ausgeschaltet.', 404);
    const b = req.body || {};
    if (b.website) return res.json({ ok: true });                                  // Falle für Programme, die Formulare automatisch ausfüllen
    const te = ticketCheck(b.t); if (te) return bad(res, te);
    const r = validate(b.data); if (r.error) return bad(res, r.error);
    if (!sigOk(b.sig_member) || !sigOk(b.sig_mandate)) return bad(res, 'Bitte beide Unterschriften leisten.');
    ticketUse(b.t);
    if (db.prepare("SELECT COUNT(*) n FROM mv_application WHERE source = 'online' AND created_at > datetime('now','localtime','-1 day')").get().n > 40) return bad(res, 'Heute sind ungewöhnlich viele Anträge eingegangen – bitte morgen noch einmal versuchen.', 429);
    const id = Number(db.prepare("INSERT INTO mv_application(source, status, data) VALUES ('online', 'neu', ?)").run(JSON.stringify(r.v)).lastInsertRowid);
    await finalize(id, 'online', b.sig_member, b.sig_mandate);
    res.json({ ok: true });
  }));
  Pub.post('/iban', rateLimit('mviban', 60, 60000), (req, res) => { const r = sepa.checkIban((req.body || {}).iban); res.json({ ok: r.ok, error: r.error || null, formatted: r.ok ? sepa.fmtIban(r.iban) : null }); });
  T.post('/iban', rateLimit('mviban', 60, 60000), (req, res) => { const r = sepa.checkIban((req.body || {}).iban); res.json({ ok: r.ok, error: r.error || null, formatted: r.ok ? sepa.fmtIban(r.iban) : null }); });

  sh.accept = accept;
  sh.formConfig = formConfig;
}

module.exports = { register };
