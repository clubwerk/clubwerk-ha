'use strict';
/**
 * „Meine Daten“ in der Mitglieder-App (für jedes gekoppelte Handy, ohne eigene Freischaltung):
 *  - eigene Stammdaten, Familie, Beiträge, offene Posten und Lastschriften ansehen
 *  - Änderungen melden (Adresse, Telefon, E-Mail, Einwilligungen) → Vorstand bestätigt
 *  - neue Bankverbindung mit Unterschrift auf dem Handy (neues SEPA-Mandat als PDF)
 *  - Kündigung einreichen (mit Termin nach Satzung)
 * In der Verwaltung: Liste der Änderungswünsche, Übernehmen / Ablehnen (das Mitglied bekommt eine E-Mail).
 */
const pdf = require('./pdf');

function register(sh) {
  const { C, store, sepa, fees, one, txt, mailOk, euro, deD, uname, ar, personRow, bankRow, mandateState, savePerson, saveDocument, consentList, exitMember, zusatzFor } = sh;
  const { S, today, nowTs } = store;
  const { need, bad, int } = C;
  const db = C.db, admin = C.admin, M = C.member;
  const P = need('mitglieder');
  const club = () => ({ name: S('creditor_name') || C.getSetting('club_name', 'Verein'), street: S('club_street'), city: S('club_city'), ci: S('creditor_id') });
  const sigOk = s => typeof s === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]{400,}$/.test(s) && s.length < 280000;
  const CHANGE_FIELDS = ['street', 'zip', 'city', 'address_extra', 'phone', 'mobile', 'email'];
  const KIND = { daten: 'Datenänderung', bank: 'Neue Bankverbindung', kuendigung: 'Kündigung', eintritt: 'Eintritt (Abteilung)', austritt: 'Austritt (Abteilung)', rueckkehr: 'Rückkehr (Abteilung)' };
  const SCOPE_KINDS = ['eintritt', 'austritt', 'rueckkehr'];

  /** frühester Austritt: Ende des Beitragsjahres unter Einhaltung der Kündigungsfrist */
  function noticeDate(day = today()) {
    const months = Math.max(0, parseInt(S('notice_months', '3'), 10) || 0);
    const ys = S('year_start', '01-01');
    const earliest = fees.addMonths(day, months);
    for (let y = Number(day.slice(0, 4)); y < Number(day.slice(0, 4)) + 4; y++) {
      const end = fees.addDays(`${y}-${ys}`, -1);
      if (end >= earliest) return end;
    }
    return fees.addDays(`${Number(day.slice(0, 4)) + 2}-${ys}`, -1);
  }

  const notifyBoard = async (subject, lines) => {
    const to = S('notify_to'); if (!to || !C.mail.ready()) return;
    try { await C.mail.send({ to, subject, text: lines.join('\n') }); } catch (e) { console.error('Mitgliederverwaltung: Benachrichtigung', e.message); }
  };
  const mailMember = async (id, subject, lines, attachments) => {
    const p = personRow(id); if (!p || !p.email || !C.mail.ready()) return false;
    try { await C.mail.send({ to: p.email, subject, text: [`Guten Tag ${[p.first_name, p.last_name].filter(Boolean).join(' ') || p.name},`, '', ...lines, '', `Viele Grüße`, club().name].join('\n'), attachments }); return true; } catch (e) { return false; }
  };

  /* ================================================================ Mitglieder-App */
  function me(id) {
    const p = personRow(id);
    if (!p) return null;
    const day = today();
    // Zahlergruppe (wer über wen zahlt – Beiträge, Posten, Kündigung) und Familienmitgliedschaft (Familienbeitrag – nur Namen) getrennt, siehe store.js
    const fam = store.payerGroup(id);
    const family = fam.members.length > 1 ? db.prepare(`SELECT m.id, m.name, p.birth_date FROM members m LEFT JOIN mv_person p ON p.member_id = m.id WHERE m.id IN (${fam.members.map(() => '?').join(',')})`).all(...fam.members)
      .map(r => ({ id: r.id, name: r.name, head: r.id === fam.head, me: r.id === id })) : [];
    const famHead = store.familyHead(id);
    const familyMembership = famHead ? store.familyMembers(famHead).filter(f => !store.isExited(f)).map(f => ({ name: f.name, role: f.role, me: f.id === id })) : [];
    const isHead = fam.head === id;
    const feeRows = db.prepare(`SELECT mf.start_date, mf.end_date, mf.booked_until, COALESCE(mf.cents, f.cents) AS cents, f.name, f.interval, mf.member_id, (SELECT name FROM members WHERE id = mf.member_id) AS who
      FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id IN (${(isHead ? fam.members : [id]).map(() => '?').join(',')}) AND (mf.end_date IS NULL OR mf.end_date >= ?) ORDER BY mf.member_id = ? DESC, f.name`)
      .all(...(isHead ? fam.members : [id]), day, id).map(r => ({ name: r.name, who: r.member_id === id ? null : r.who, cents: r.cents, interval: fees.INTERVAL_LABEL[r.interval] || r.interval, booked_until: r.booked_until, end_date: r.end_date }));
    // Zusatzbeiträge der Abteilungen (je Person nach Alter) – der Hauptzahler sieht sie für die ganze Familie
    for (const md of db.prepare(`SELECT md.*, d.name AS dept, p.birth_date, (SELECT name FROM members WHERE id = md.member_id) AS who FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id
        LEFT JOIN mv_person p ON p.member_id = md.member_id WHERE md.member_id IN (${(isHead ? fam.members : [id]).map(() => '?').join(',')}) AND (md.exit_date IS NULL OR md.exit_date >= ?) ORDER BY md.member_id = ? DESC, d.sort, d.name`)
      .all(...(isHead ? fam.members : [id]), day, id)) {
      const z = zusatzFor(md, md.birth_date);
      if (z.fee) feeRows.push({ name: z.fee.name, who: md.member_id === id ? null : md.who, cents: z.fee.cents, interval: fees.INTERVAL_LABEL[z.fee.interval] || z.fee.interval, booked_until: md.booked_until, end_date: md.exit_date, dept: md.dept });
    }
    const payer = store.payerOf(id);
    const charges = isHead ? db.prepare(`SELECT c.id, c.text, c.cents, c.due_date, c.status, c.paid_at, c.paid_via, (SELECT name FROM members WHERE id = c.for_member_id) AS for_name, k.collection_date
      FROM mv_charge c LEFT JOIN mv_collection k ON k.id = c.collection_id WHERE c.member_id = ? AND c.status != 'storniert' ORDER BY c.due_date DESC, c.id DESC LIMIT 40`).all(id) : [];
    const b = isHead ? bankRow(id) : null;
    const consents = JSON.parse(p.consents || '{}');
    const ap = store.appPerms(), V = ap.view;
    return {
      club: club().name, perms: ap,
      person: { first_name: p.first_name, last_name: p.last_name, member_no: p.member_no, birth_date: V.geburt ? p.birth_date : null,
        ...(V.anschrift ? { street: p.street, zip: p.zip, city: p.city, address_extra: p.address_extra } : {}), ...(V.kontakt ? { phone: p.phone, mobile: p.mobile, email: p.email } : {}), entry_date: p.entry_date, exit_date: p.exit_date, notice_date: p.notice_date, status: store.STATUS[p.status] || p.status, payment: store.PAYMENT[p.payment] || p.payment },
      departments: V.abteilungen ? db.prepare(`SELECT d.name, md.entry_date, md.status FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id WHERE md.member_id = ? AND (md.exit_date IS NULL OR md.exit_date >= ?) ORDER BY d.sort, d.name`).all(id, day) : [],
      fees: V.beitraege ? feeRows : [], family: V.familie ? family : [], familyMembership: V.familie ? familyMembership : [], familyHeadName: famHead && famHead !== id && V.familie ? (personRow(famHead) || {}).name : null, isHead, payerName: payer !== id && V.familie ? (personRow(payer) || {}).name : null,
      open_cents: V.posten ? charges.filter(c => c.status === 'offen').reduce((s, c) => s + c.cents, 0) : 0, charges: V.posten ? charges : [],
      bank: b && V.bank ? { iban: sepa.maskIban(b.iban), holder: b.holder, mandate_ref: b.mandate_ref, mandate_date: b.mandate_date, ok: mandateState(b).ok } : null,
      consents: consentList().map(c => ({ key: c.key, short: c.short, text: c.text, required: Boolean(c.required), given: Boolean(consents[c.key]), date: consents[c.key] || null })),
      pending: db.prepare("SELECT id, kind, created_at FROM mv_change WHERE member_id = ? AND status = 'offen' ORDER BY id").all(id).map(c => ({ ...c, label: KIND[c.kind] })),
      notice: { date: noticeDate(), months: parseInt(S('notice_months', '3'), 10) || 0, satzung: S('satzung_url') || null },
      creditor: { ci: S('creditor_id') || null, name: club().name },
    };
  }
  const openOf = (id, kind) => db.prepare("SELECT id FROM mv_change WHERE member_id = ? AND kind = ? AND status = 'offen'").get(id, kind);

  M.get('/me', (req, res) => {
    const d = me(req.member.id);
    if (!d) return res.json({ none: true, club: club().name });
    res.json(d);
  });
  M.post('/change', C.rateLimit('mvchange', 10, 3600000), ar(async (req, res) => {
    const id = req.member.id; const p = personRow(id); const b = req.body || {};
    if (!p || p.anonymized_at) return bad(res, 'Für dich sind keine Vereinsdaten hinterlegt.');
    const want = {}, ap = store.appPerms().edit;
    for (const k of CHANGE_FIELDS) {
      if (b[k] === undefined) continue;
      if (!(['phone', 'mobile', 'email'].includes(k) ? ap.kontakt : ap.anschrift)) continue;   // nicht freigegeben → ignorieren
      const v = k === 'email' ? one(b[k], 120).toLowerCase() : one(b[k], k === 'zip' ? 10 : 80);
      if (String(v || '') !== String(p[k] || '')) want[k] = v || null;
    }
    if (want.email && !mailOk(want.email)) return bad(res, 'Die E-Mail-Adresse sieht nicht gültig aus.');
    let consents = null;
    if (b.consents && typeof b.consents === 'object') {
      const cur = JSON.parse(p.consents || '{}');
      for (const c of consentList()) {
        const on = Boolean(b.consents[c.key]);
        if (c.required && !on && cur[c.key]) return bad(res, `„${c.short}“ ist für die Mitgliedschaft nötig – ein Widerruf geht nur zusammen mit der Kündigung.`);
        if (on !== Boolean(cur[c.key])) (consents = consents || {})[c.key] = on;
      }
    }
    if (!Object.keys(want).length && !consents) return bad(res, 'Du hast nichts geändert.');
    // Neue E-Mail-Adresse (dorthin gehen künftig Bestätigungen) und Einwilligungen (gelten sofort) nur mit PIN – ein entsperrt
    // herumliegendes Handy reicht dafür nicht. Anschrift und Telefon bestätigt ohnehin der Vorstand.
    if ((want.email !== undefined || consents) && !req.pinOk()) return;
    // Einwilligungen gelten sofort (Widerruf muss ohne Hürde möglich sein) – Datenänderungen bestätigt der Vorstand
    if (consents) {
      const cur = JSON.parse(p.consents || '{}');
      for (const [k, on] of Object.entries(consents)) { if (on) cur[k] = today(); else delete cur[k]; store.hist(id, 'Mitglieder-App', 'Einwilligung ' + (consentList().find(c => c.key === k) || {}).short, on ? 'nein' : 'ja', on ? 'ja' : 'nein'); }
      db.prepare('UPDATE mv_person SET consents = ? WHERE member_id = ?').run(JSON.stringify(cur), id);
    }
    if (Object.keys(want).length) {
      const ex = openOf(id, 'daten');
      if (ex) db.prepare('UPDATE mv_change SET data = ?, created_at = ? WHERE id = ?').run(JSON.stringify(want), nowTs(), ex.id);
      else db.prepare("INSERT INTO mv_change(member_id, kind, data) VALUES (?, 'daten', ?)").run(id, JSON.stringify(want));
      notifyBoard(`Mitglieder-App: Datenänderung von ${p.name}`, [`${p.name} hat in der Mitglieder-App neue Daten gemeldet:`, '', ...Object.entries(want).map(([k, v]) => `${k}: ${p[k] || '–'} → ${v || '–'}`), '', 'Bitte in der Verwaltung unter Mitglieder → Änderungen übernehmen.']);
    }
    C.audit(null, 'Mitglieder-App: Daten geändert', `${p.name}${consents ? ' (Einwilligungen)' : ''}${Object.keys(want).length ? ' – wartet auf Bestätigung' : ''}`);
    res.json({ ok: true, pending: Object.keys(want).length > 0 });
  }));
  M.post('/bank', C.rateLimit('mvbank', 5, 3600000), ar(async (req, res) => {
    if (!store.appPerms().edit.bank) return bad(res, 'Eine neue Bankverbindung bitte direkt beim Verein abgeben – in der App ist das nicht freigeschaltet.', 403);
    if (!req.pinOk()) return;
    const id = req.member.id; const p = personRow(id); const b = req.body || {};
    if (!p || p.anonymized_at) return bad(res, 'Für dich sind keine Vereinsdaten hinterlegt.');
    if (store.payerOf(id) !== id) return bad(res, 'Deine Beiträge zahlt ein anderes Mitglied – die Bankverbindung ändert der Hauptzahler.');
    const ib = sepa.checkIban(b.iban); if (!ib.ok) return bad(res, ib.error);
    const bic = sepa.checkBic(b.bic); if (!bic.ok) return bad(res, 'Der BIC hat 8 oder 11 Zeichen (bei deutschen Konten leer lassen).');
    const holder = one(b.holder, 70); if (holder.length < 3) return bad(res, 'Bitte den Kontoinhaber eintragen.');
    if (!b.agree) return bad(res, 'Bitte das SEPA-Mandat bestätigen.');
    if (!sigOk(b.signature)) return bad(res, 'Bitte unterschreiben.');
    const at = nowTs();
    const data = { holder, iban: ib.iban, bic: bic.bic || null, bank: one(b.bank, 70) || null, signed_at: at };
    const sha = store.sha256(JSON.stringify(data) + b.signature);
    const ex = openOf(id, 'bank');
    if (ex) db.prepare("UPDATE mv_change SET status = 'ersetzt' WHERE id = ?").run(ex.id);
    const cid = Number(db.prepare("INSERT INTO mv_change(member_id, kind, data, signature) VALUES (?, 'bank', ?, ?)").run(id, JSON.stringify({ ...data, sha256: sha }), b.signature).lastInsertRowid);
    notifyBoard(`Mitglieder-App: neue Bankverbindung von ${p.name}`, [`${p.name} hat in der Mitglieder-App eine neue Bankverbindung mit SEPA-Mandat unterschrieben (IBAN ${sepa.maskIban(ib.iban)}).`, '', 'Bitte in der Verwaltung unter Mitglieder → Änderungen übernehmen.']);
    C.audit(null, 'Mitglieder-App: neue Bankverbindung eingereicht', `${p.name} (${sepa.maskIban(ib.iban)})`);
    res.json({ ok: true, id: cid });
  }));
  M.post('/kuendigung', C.rateLimit('mvkuend', 5, 3600000), ar(async (req, res) => {
    if (!store.appPerms().edit.kuendigung) return bad(res, 'Eine Kündigung bitte schriftlich beim Vorstand einreichen – in der App ist das nicht freigeschaltet.', 403);
    if (!req.pinOk()) return;
    const id = req.member.id; const p = personRow(id); const b = req.body || {};
    if (!p || p.anonymized_at) return bad(res, 'Für dich sind keine Vereinsdaten hinterlegt.');
    if (p.exit_date) return bad(res, `Dein Austritt ist schon zum ${deD(p.exit_date)} eingetragen.`);
    if (openOf(id, 'kuendigung')) return bad(res, 'Deine Kündigung liegt dem Vorstand schon vor.');
    if (!b.confirm) return bad(res, 'Bitte bestätige die Kündigung.');
    const fam = store.payerGroup(id);
    const who = Array.isArray(b.members) ? b.members.map(Number).filter(m => fam.head === id ? fam.members.includes(m) : m === id) : [id];
    if (!who.length) who.push(id);
    const date = noticeDate();
    const names = who.map(m => (personRow(m) || {}).name).filter(Boolean);
    db.prepare("INSERT INTO mv_change(member_id, kind, data) VALUES (?, 'kuendigung', ?)").run(id, JSON.stringify({ members: who, names, exit_date: date, reason: txt(b.reason, 300) || null, received: today() }));
    const sent = await mailMember(id, `Eingangsbestätigung Ihrer Kündigung – ${club().name}`, [`Ihre Kündigung für ${names.join(', ')} ist am ${deD(today())} bei uns eingegangen.`, `Nach unserer Satzung endet die Mitgliedschaft voraussichtlich zum ${deD(date)}. Der Vorstand bestätigt den Austritt noch einmal.`]);
    notifyBoard(`Mitglieder-App: Kündigung von ${p.name}`, [`${p.name} hat in der Mitglieder-App gekündigt (${names.join(', ')}).`, `Frühester Austritt nach Satzung: ${deD(date)}.`, b.reason ? `Grund: ${txt(b.reason, 300)}` : '', '', 'Bitte in der Verwaltung unter Mitglieder → Änderungen bestätigen.']);
    C.audit(null, 'Mitglieder-App: Kündigung eingereicht', names.join(', '));
    res.json({ ok: true, exit_date: date, mailed: sent });
  }));
  M.delete('/change/:id', (req, res) => {
    const c = db.prepare("SELECT * FROM mv_change WHERE id = ? AND member_id = ? AND status = 'offen'").get(int(req.params.id), req.member.id);
    if (!c) return bad(res, 'Nicht gefunden.', 404);
    db.prepare("UPDATE mv_change SET status = 'zurückgezogen', reviewed_at = ? WHERE id = ?").run(nowTs(), c.id);
    res.json({ ok: true });
  });

  /* ================================================================ Verwaltung: Änderungswünsche */
  function changeView(c, user) {
    const d = JSON.parse(c.data || '{}');
    const p = personRow(c.member_id) || {};
    const bankPerm = user.perms.includes('mitglieder_bank');
    let rows = [];
    if (c.kind === 'daten') rows = Object.entries(d).map(([k, v]) => ({ field: k, old: p[k] || null, new: v }));
    if (c.kind === 'bank') {
      const b = bankRow(c.member_id) || {};
      rows = [['holder', b.holder, d.holder], ['iban', bankPerm ? sepa.fmtIban(b.iban) : sepa.maskIban(b.iban), bankPerm ? sepa.fmtIban(d.iban) : sepa.maskIban(d.iban)], ['bic', b.bic, d.bic], ['bank', b.bank, d.bank]].map(([field, o, n]) => ({ field, old: o || null, new: n || null }));
    }
    if (c.kind === 'eintritt') rows = [{ field: 'Abteilung', old: null, new: (db.prepare('SELECT name FROM mv_department WHERE id = ?').get(d.department_id) || {}).name || '–' }, { field: 'Eintritt', old: null, new: deD(d.entry_date) }];
    if (c.kind === 'austritt') rows = [{ field: 'Austritt zum', old: null, new: deD(d.exit_date) }, ...(d.reason ? [{ field: 'Grund', old: null, new: d.reason }] : []), ...(d.withDependents ? [{ field: 'Angehörige', old: null, new: 'treten mit aus' }] : [])];
    if (c.kind === 'rueckkehr') rows = [{ field: 'Rückkehr', old: deD(p.exit_date) ? `Austritt ${deD(p.exit_date)}` : null, new: 'Austritt zurücknehmen' }];
    return { id: c.id, kind: c.kind, label: KIND[c.kind], member_id: c.member_id, created_by: c.created_by || null, scope: SCOPE_KINDS.includes(c.kind), exit_date: d.exit_date || null, name: p.name, member_no: p.member_no, created_at: c.created_at, status: c.status, reason: c.reason, reviewed_by: c.reviewed_by, reviewed_at: c.reviewed_at,
      rows, kuendigung: c.kind === 'kuendigung' ? d : null, signed_at: d.signed_at || null, hasSignature: Boolean(c.signature) };
  }
  admin.get('/changes', P, (req, res) => {
    const st = req.query.status === 'alle' ? null : 'offen';
    const rows = db.prepare(`SELECT * FROM mv_change ${st ? "WHERE status = 'offen'" : "WHERE status != 'ersetzt'"} ORDER BY status = 'offen' DESC, id DESC LIMIT 300`).all();
    res.json(rows.map(c => changeView(c, req.user)));
  });
  admin.get('/changes/:id/signature', P, (req, res) => {
    const c = db.prepare('SELECT signature FROM mv_change WHERE id = ?').get(int(req.params.id));
    const m = c && /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(c.signature || '');
    if (!m) return res.status(404).end();
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'" }).send(Buffer.from(m[1], 'base64'));
  });
  admin.post('/changes/:id/accept', P, ar(async (req, res) => {
    const c = db.prepare("SELECT * FROM mv_change WHERE id = ? AND status = 'offen'").get(int(req.params.id));
    if (!c) return bad(res, 'Dieser Änderungswunsch ist schon erledigt.', 404);
    const d = JSON.parse(c.data || '{}'); const b = req.body || {}; const by = uname(req);
    const p = personRow(c.member_id); if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    let mailLines, attachments;
    if (SCOPE_KINDS.includes(c.kind)) {   // Meldung einer Abteilungsleitung bestätigen
      if (c.kind === 'eintritt') { db.prepare('UPDATE members SET active = 1 WHERE id = ?').run(c.member_id); store.hist(c.member_id, by, 'Eintritt bestätigt', null, d.entry_date ? deD(d.entry_date) : null); }
      if (c.kind === 'austritt') {
        const date = fees.isDate(b.exit_date) ? b.exit_date : d.exit_date;
        if (!fees.isDate(date)) return bad(res, 'Bitte das Austrittsdatum angeben.');
        const opt = { exit_date: date, reason: d.reason, notice_date: d.notice_date, endFees: d.endFees !== false, endDepts: d.endDepts !== false };
        exitMember(c.member_id, opt, by);
        if (d.withDependents) for (const x of db.prepare('SELECT member_id FROM mv_person WHERE (payer_id = ? OR family_of = ?) AND member_id != ? AND (exit_date IS NULL OR exit_date > ?)').all(c.member_id, c.member_id, c.member_id, date)) exitMember(x.member_id, { exit_date: date, reason: d.reason }, by);
      }
      if (c.kind === 'rueckkehr') sh.reenterMember(c.member_id, by);
      db.prepare("UPDATE mv_change SET status = 'übernommen', reviewed_by = ?, reviewed_at = ? WHERE id = ?").run(by, nowTs(), c.id);
      C.audit(req.user, `Mitglied: ${KIND[c.kind]} bestätigt`, `${p.name} (gemeldet von ${c.created_by || '–'})`);
      return res.json({ ok: true });
    }
    if (c.kind === 'daten') {
      const fields = {};
      const pick = Array.isArray(b.fields) ? b.fields : Object.keys(d);
      for (const k of Object.keys(d)) if (CHANGE_FIELDS.includes(k) && pick.includes(k)) fields[k] = d[k];
      if (fields.email && !mailOk(fields.email)) return bad(res, 'Die E-Mail-Adresse ist ungültig.');
      savePerson(c.member_id, fields, `${by} (aus der App)`);
      mailLines = ['Ihre neuen Kontaktdaten haben wir übernommen. Danke für die Mitteilung!'];
    } else if (c.kind === 'bank') {
      if (!req.user.perms.includes('mitglieder_bank')) return bad(res, 'Bankverbindungen übernehmen darf nur, wer das Recht „Bankdaten“ hat.', 403);
      const no = p.member_no || String(c.member_id);
      const ref = store.mandateRefFor(no);
      const sigDate = (d.signed_at || nowTs()).slice(0, 10);
      db.prepare(`INSERT INTO mv_bank(member_id, holder, iban, bic, bank, mandate_ref, mandate_date, updated_at) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(member_id) DO UPDATE SET holder = excluded.holder, iban = excluded.iban, bic = excluded.bic, bank = excluded.bank, mandate_ref = excluded.mandate_ref, mandate_date = excluded.mandate_date,
        mandate_first_used = NULL, mandate_last_used = NULL, mandate_notified = NULL, mandate_revoked = NULL, updated_at = excluded.updated_at`).run(c.member_id, d.holder, d.iban, d.bic, d.bank, ref, sigDate, nowTs());
      if (p.payment !== 'lastschrift') savePerson(c.member_id, { payment: 'lastschrift' }, by);
      store.hist(c.member_id, `${by} (aus der App)`, 'Bankverbindung', null, `${sepa.maskIban(d.iban)}, Mandat ${ref}`);
      const buf = await pdf.mandate(club(), { person: p, name: p.name, member_no: p.member_no, holder: d.holder, iban: d.iban, bic: d.bic, bank: d.bank, mandate_ref: ref, signed_at: d.signed_at, signature: c.signature, sha256: d.sha256 });
      try { saveDocument(c.member_id, buf, { kind: 'mandat', title: `SEPA-Mandat ${ref}.pdf`, filename: `SEPA-Mandat ${ref}.pdf`, user: by }); } catch (e) { console.error('Mandat speichern:', e.message); }
      mailLines = [`Ihre neue Bankverbindung (IBAN ${sepa.maskIban(d.iban)}) haben wir übernommen.`, `Mandatsreferenz: ${ref}`, `Gläubiger-ID: ${S('creditor_id') || '–'}`, '', 'Künftige Lastschriften ziehen wir von diesem Konto ein. Das unterschriebene Mandat liegt bei.'];
      attachments = [{ filename: `SEPA-Mandat ${ref}.pdf`, content: buf }];
    } else if (c.kind === 'kuendigung') {
      const date = fees.isDate(b.exit_date) ? b.exit_date : d.exit_date;
      if (!fees.isDate(date)) return bad(res, 'Bitte das Austrittsdatum angeben.');
      for (const m of (d.members || [c.member_id])) if (personRow(m)) exitMember(m, { exit_date: date, reason: one(b.reason, 80) || 'Kündigung', notice_date: d.received || c.created_at.slice(0, 10) }, by);
      mailLines = [`hiermit bestätigen wir Ihre Kündigung (${(d.names || [p.name]).join(', ')}). Die Mitgliedschaft endet zum ${deD(date)}.`, 'Danke für Ihre Zeit bei uns – Sie sind jederzeit wieder herzlich willkommen!'];
    }
    db.prepare("UPDATE mv_change SET status = 'übernommen', reviewed_by = ?, reviewed_at = ?, signature = CASE WHEN kind = 'bank' THEN NULL ELSE signature END WHERE id = ?").run(by, nowTs(), c.id);
    const mailed = await mailMember(c.member_id, `${KIND[c.kind]} bestätigt – ${club().name}`, mailLines, attachments);
    C.audit(req.user, `Mitglied: ${KIND[c.kind]} aus der App übernommen`, p.name);
    res.json({ ok: true, mailed });
  }));
  admin.post('/changes/:id/reject', P, ar(async (req, res) => {
    const c = db.prepare("SELECT * FROM mv_change WHERE id = ? AND status = 'offen'").get(int(req.params.id));
    if (!c) return bad(res, 'Dieser Änderungswunsch ist schon erledigt.', 404);
    if (c.kind === 'bank' && !req.user.perms.includes('mitglieder_bank')) return bad(res, 'Bankverbindungen bearbeiten darf nur, wer das Recht „Bankdaten“ hat.', 403);
    const reason = txt((req.body || {}).reason, 300);
    db.prepare("UPDATE mv_change SET status = 'abgelehnt', reviewed_by = ?, reviewed_at = ?, reason = ?, signature = NULL WHERE id = ?").run(uname(req), nowTs(), reason || null, c.id);
    const p = personRow(c.member_id) || {};
    if (SCOPE_KINDS.includes(c.kind)) {   // Meldung der Abteilungsleitung abgelehnt – keine Mail ans Mitglied
      if (c.kind === 'eintritt') { db.prepare('UPDATE members SET deleted = 1, active = 0 WHERE id = ?').run(c.member_id); }
      store.hist(c.member_id, uname(req), `${KIND[c.kind]} abgelehnt`, null, reason || null);
      C.audit(req.user, `Mitglied: ${KIND[c.kind]} abgelehnt`, `${p.name || ''} (gemeldet von ${c.created_by || '–'})`);
      return res.json({ ok: true });
    }
    const mailed = (req.body || {}).notify === false ? false : await mailMember(c.member_id, `Ihre Mitteilung (${KIND[c.kind]}) – ${club().name}`, [`Ihre Mitteilung „${KIND[c.kind]}“ vom ${deD(c.created_at.slice(0, 10))} konnten wir leider nicht übernehmen.`, reason ? `Grund: ${reason}` : 'Bitte sprechen Sie uns kurz an.']);
    C.audit(req.user, `Mitglied: ${KIND[c.kind]} aus der App abgelehnt`, p.name);
    res.json({ ok: true, mailed });
  }));

  sh.noticeDate = noticeDate;
  sh.notifyBoard = notifyBoard;
  void euro;
}

module.exports = { register };
