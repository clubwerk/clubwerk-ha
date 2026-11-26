'use strict';
/**
 * „Eintrittsjahr frei“ zu weit vermerkt – Korrektur früherer Läufe.
 * Bis zur Korrektur in fees.periods rechnete „frei“ vom Beginn der Beitragszuordnung statt vom Vereinseintritt: Wer seinen
 * Beitrag erst später bekam (später zugeordnet, neue Altersstufe, später in die Abteilung eingetragen), bekam ein weiteres
 * Beitragsjahr frei vermerkt („abgerechnet bis“ ohne Posten). Diese Liste findet solche Zuordnungen, ändert aber nichts von selbst:
 * Erst der Knopf setzt „abgerechnet bis“ auf das Ende des richtigen Eintrittsjahres zurück – der nächste Beitragslauf berechnet den Rest.
 * Gefunden wird nur, was ein Beitragslauf von Clubwerk vermerkt hat, wofür es keinen Posten gibt und was niemand danach gesammelt gesetzt hat.
 */
const crypto = require('crypto');

function register(sh) {
  const { C, store, fees, deD, uname, zusatzFor } = sh;
  const { S, today } = store;
  const { need, bad } = C;
  const db = C.db, admin = C.admin;
  const PF = need('mitglieder_finanzen');
  const { lastFirst, nameKey } = C.require('./db');
  const isDate = fees.isDate;
  const TABLE = { mf: 'mv_member_fee', md: 'mv_member_department' };
  const charged = { mf: db.prepare("SELECT MAX(period_to) t FROM mv_charge WHERE member_fee_id = ? AND status != 'storniert'"),
    md: db.prepare("SELECT MAX(period_to) t FROM mv_charge WHERE member_dept_id = ? AND status != 'storniert'") };

  function plan() {
    const ys = S('year_start', '01-01');
    const touched = { mf: new Set(), md: new Set() };   // von einem Beitragslauf vorgerückt
    for (const r of db.prepare("SELECT filters FROM mv_run WHERE kind = 'beitrag'").all()) {
      let f = {}; try { f = JSON.parse(r.filters || '{}') || {}; } catch (e) { f = {}; }   /* alter Lauf ohne lesbare Angaben */
      for (const id of Object.keys(f.prev || {})) touched.mf.add(Number(id));
      for (const id of Object.keys(f.prevMd || {})) touched.md.add(Number(id));
    }
    const setBy = new Set(db.prepare('SELECT x.kind, x.row_id FROM mv_booked_row x JOIN mv_booked_set s ON s.id = x.set_id WHERE s.undone_at IS NULL').all().map(r => r.kind + r.row_id));
    const rows = [];
    const check = (kind, id, member_id, name, fee, ref, start, booked) => {
      if (!isDate(ref) || !isDate(start) || !isDate(booked) || !touched[kind].has(id) || setBy.has(kind + id)) return;
      const right = fees.freeEnd(ref, ys), wrong = fees.freeEnd(start, ys);
      if (!(booked > right && booked <= wrong)) return;
      const t = charged[kind].get(id).t;
      if (t && t > right) return;   // dahinter schon Posten berechnet: kein freier Vermerk
      const nu = start > right ? (t || null) : right;
      rows.push({ kind, id, member_id, name: lastFirst(name, 'mitglied'), fee, entry: ref, old_until: booked, new_until: nu, from: nu ? fees.addDays(nu, 1) : start,
        text: `${kind === 'md' ? 'Zusatzbeitrag ' : ''}${fee}: Eintritt ${deD(ref)}, frei vermerkt bis ${deD(booked)} – Eintrittsjahr endete am ${deD(right)}` });
    };
    for (const r of db.prepare(`SELECT mf.id, mf.member_id, mf.start_date, mf.booked_until, f.name AS fee, p.entry_date, m.name
        FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id JOIN mv_person p ON p.member_id = mf.member_id JOIN members m ON m.id = mf.member_id
        WHERE COALESCE(p.first_year, f.prorate) = 'frei' AND f.interval != 'einmalig' AND mf.booked_until IS NOT NULL AND m.deleted = 0 AND p.anonymized_at IS NULL`).all())
      check('mf', r.id, r.member_id, r.name, r.fee, r.entry_date, r.start_date, r.booked_until);
    const memo = new Map();
    for (const md of db.prepare(`SELECT md.*, d.name AS dept, p.entry_date AS p_entry, p.first_year, p.birth_date, m.name
        FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id JOIN mv_person p ON p.member_id = md.member_id JOIN members m ON m.id = md.member_id
        WHERE md.booked_until IS NOT NULL AND md.fee_free = 0 AND m.deleted = 0 AND p.anonymized_at IS NULL`).all()) {
      const start = [md.entry_date, md.p_entry].filter(isDate).sort().reverse()[0];
      const z = zusatzFor(md, md.birth_date, start || today(), memo);
      if (z.fee && (md.first_year || z.fee.prorate) === 'frei') check('md', md.id, md.member_id, md.name, z.fee.name, md.p_entry || md.entry_date, start, md.booked_until);
    }
    rows.sort((a, b) => nameKey(a.name, 'mitglied').localeCompare(nameKey(b.name, 'mitglied'), 'de') || a.fee.localeCompare(b.fee, 'de'));
    const token = crypto.createHash('sha256').update(JSON.stringify(rows.map(r => [r.kind, r.id, r.old_until, r.new_until]))).digest('hex').slice(0, 32);
    return { rows, token };
  }

  /* ---------- Erstes Jahr je Mitglied (Anfänger frei, Vereinswechsler anteilig oder voll) ----------
   * mv_person.first_year: NULL = wie Beitragsart · frei · anteilig · voll – gilt für Grund- und Zusatzbeiträge im Beitragsjahr des Eintritts. */
  const FY = { standard: 'wie Beitragsart (Vorgabe)', frei: 'frei (Anfänger)', anteilig: 'anteilig berechnen', voll: 'voll berechnen' };
  const FY_ASK = 'Bitte beim ersten Jahr wählen: Anfänger (erstes Jahr frei) oder Vereinswechsler (anteilig) – die Beitragsart sieht „Eintrittsjahr frei“ vor.';
  /** Eingabe → { ok, value (NULL = wie Beitragsart) } oder { ok: false } */
  const fyValue = v => (v === 'standard' || v === null ? { ok: true, value: null } : ['frei', 'anteilig', 'voll'].includes(v) ? { ok: true, value: v } : { ok: false });
  /** Muss beim Anlegen/Annehmen gefragt werden? Beitragsart oder Zusatzbeitrag einer gewählten Abteilung steht auf „Eintrittsjahr frei“ */
  function fyNeeded(feeIds, deptIds) {
    const f = feeIds.filter(Boolean), d = deptIds.filter(Boolean);
    return Boolean((f.length && db.prepare(`SELECT 1 FROM mv_fee WHERE prorate = 'frei' AND interval != 'einmalig' AND id IN (${f.map(() => '?').join(',')})`).get(...f))
      || (d.length && db.prepare(`SELECT 1 FROM mv_fee WHERE kind = 'zusatz' AND active = 1 AND prorate = 'frei' AND department_id IN (${d.map(() => '?').join(',')})`).get(...d)));
  }
  /** Eingabe beim Anlegen/Annehmen prüfen → Fehlertext oder null; v.value ins Mitglied schreiben mit fySet */
  function fyInput(raw, feeIds, deptIds) {
    if (raw === undefined || raw === '') return fyNeeded(feeIds, deptIds) ? { error: FY_ASK } : { value: null };
    const v = fyValue(raw); return v.ok ? { value: v.value } : { error: 'Unbekannte Wahl für das erste Jahr.' };
  }
  const fySet = (id, value, user) => { if (!value) return; db.prepare('UPDATE mv_person SET first_year = ? WHERE member_id = ?').run(value, id); store.hist(id, user, 'Erstes Jahr', null, FY[value]); };
  /** Stand des ersten Jahres eines Mitglieds: Zeitraum, schon abgerechnet?, als frei vermerkte Zuordnungen */
  function fyState(id, choice) {   // choice: mit einer anderen Wahl rechnen (ohne zu speichern)
    const p = db.prepare('SELECT entry_date, first_year FROM mv_person WHERE member_id = ?').get(id);
    if (!p || !isDate(p.entry_date)) return null;
    if (choice !== undefined) p.first_year = choice;
    const ys = S('year_start', '01-01'), to = fees.freeEnd(p.entry_date, ys), from = fees.addMonths(fees.addDays(to, 1), -12);
    const billed = db.prepare(`SELECT c.text, c.period_from FROM mv_charge c WHERE c.status != 'storniert' AND c.period_from IS NOT NULL AND c.period_from <= ?
      AND (c.member_fee_id IN (SELECT id FROM mv_member_fee WHERE member_id = ?) OR c.member_dept_id IN (SELECT id FROM mv_member_department WHERE member_id = ?)) ORDER BY c.period_from LIMIT 3`).all(to, id, id)
      .filter(c => c.period_from >= from);
    const marked = [];   // „abgerechnet bis“ im ersten Jahr ohne Posten vorgerückt (frei vermerkt)
    const mark = (kind, rid, fee, prorate, start, booked) => {
      if (prorate !== 'frei' || !isDate(booked) || booked < from || booked > to || !isDate(start) || start > to) return;
      const t = charged[kind].get(rid).t;
      if (t && t >= booked) return;
      marked.push({ kind, id: rid, fee, old_until: booked, new_until: t || (start >= from ? null : fees.addDays(from, -1)) });
    };
    for (const r of db.prepare("SELECT mf.id, mf.start_date, mf.booked_until, f.name, f.prorate FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id = ? AND f.interval != 'einmalig'").all(id))
      mark('mf', r.id, r.name, p.first_year || r.prorate, r.start_date, r.booked_until);
    const birth = (db.prepare('SELECT birth_date FROM mv_person WHERE member_id = ?').get(id) || {}).birth_date;
    for (const md of db.prepare('SELECT md.*, d.name AS dept FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id WHERE md.member_id = ? AND md.fee_free = 0').all(id)) {
      const start = [md.entry_date, p.entry_date].filter(isDate).sort().reverse()[0], z = zusatzFor(md, birth, start || today());
      if (z.fee) mark('md', md.id, z.fee.name, p.first_year || z.fee.prorate, start, md.booked_until);
    }
    return { value: p.first_year || 'standard', from, to, billed, marked };
  }
  sh.firstYear = { FY, fyInput, fySet, fyState };

  /** Erstes Jahr ändern: nur solange es nicht abgerechnet ist; frei vermerkte Zeiträume nimmt nur reset: true zurück (nach Rückfrage) */
  admin.put('/member/:id/first-year', PF, (req, res) => {
    const id = Number(req.params.id), b = req.body || {};
    const m = db.prepare('SELECT name FROM members WHERE id = ? AND deleted = 0').get(id);
    const v = fyValue(b.first_year);
    if (!m) return bad(res, 'Mitglied nicht gefunden.', 404);
    if (!v.ok) return bad(res, 'Unbekannte Wahl für das erste Jahr.');
    const s0 = fyState(id);
    if (!s0) return bad(res, 'Ohne Eintrittsdatum gibt es kein erstes Jahr – bitte erst den Eintritt eintragen.');
    const old = s0.value === 'standard' ? null : s0.value;
    if ((old || null) === v.value) return res.json({ ok: true, unchanged: true });
    if (s0.billed.length) return bad(res, `Das erste Jahr (${deD(s0.from)}–${deD(s0.to)}) ist schon abgerechnet (${s0.billed.map(c => c.text).join('; ')}). Erst diese Posten stornieren, dann ändern.`);
    // was bisher frei vermerkt ist und nach der Änderung nicht mehr frei wäre
    const after = fyState(id, v.value), back = s0.marked.filter(x => !after.marked.some(y => y.kind === x.kind && y.id === x.id));
    if (back.length && b.reset !== true) return res.status(409).json({ needReset: true, error: 'Ein Teil des ersten Jahres ist schon als beitragsfrei vermerkt.', rows: back.map(x => ({ fee: x.fee, until: x.old_until })) });
    const user = uname(req);
    db.transaction(() => {
      db.prepare('UPDATE mv_person SET first_year = ? WHERE member_id = ?').run(v.value, id);
      store.hist(id, user, 'Erstes Jahr', FY[old || 'standard'], FY[v.value || 'standard']);
      for (const x of back) {
        db.prepare(`UPDATE ${TABLE[x.kind]} SET booked_until = ? WHERE id = ? AND booked_until = ?`).run(x.new_until, x.id, x.old_until);
        store.hist(id, user, `${x.kind === 'md' ? 'Zusatzbeitrag' : 'Beitrag'} ${x.fee}: abgerechnet bis (erstes Jahr geändert)`, deD(x.old_until), x.new_until ? deD(x.new_until) : 'noch nichts');
      }
    })();
    C.audit(req.user, 'Mitglied: erstes Jahr geändert', `${lastFirst(m.name, 'mitglied')}: ${C.auditDiff({ fy: 'Erstes Jahr' }, { fy: FY[old || 'standard'] }, { fy: FY[v.value || 'standard'] })}${back.length ? ` · frei vermerkter Zeitraum zurückgenommen (${back.map(x => x.fee).join(', ')})` : ''}`);
    res.json({ ok: true, reset: back.length });
  });
  admin.get('/freijahr', PF, (req, res) => res.json(plan()));
  /** Korrigieren: nur mit dem Prüfwert der angezeigten Liste; Posten entstehen erst im nächsten Beitragslauf (mit Vorschau) */
  admin.post('/freijahr', PF, (req, res) => {
    const p = plan();
    if (!p.rows.length) return bad(res, 'Es gibt nichts zu korrigieren.');
    if ((req.body || {}).token !== p.token) return res.status(409).json({ error: 'Seit dem Laden der Liste hat sich etwas geändert. Bitte die Seite neu laden und noch einmal prüfen.', stale: true });
    const user = uname(req);
    db.transaction(() => {
      for (const r of p.rows) {
        db.prepare(`UPDATE ${TABLE[r.kind]} SET booked_until = ? WHERE id = ? AND booked_until = ?`).run(r.new_until, r.id, r.old_until);
        store.hist(r.member_id, user, `${r.kind === 'md' ? 'Zusatzbeitrag' : 'Beitrag'} ${r.fee}: abgerechnet bis (Eintrittsjahr frei korrigiert)`, deD(r.old_until), r.new_until ? deD(r.new_until) : 'noch nichts');
      }
    })();
    const names = [...new Set(p.rows.map(r => r.name))];
    C.audit(req.user, 'Eintrittsjahr frei korrigiert', `${p.rows.length} ${p.rows.length === 1 ? 'Zuordnung' : 'Zuordnungen'} bei ${names.length} ${names.length === 1 ? 'Mitglied' : 'Mitgliedern'}: „abgerechnet bis“ auf das Ende des Eintrittsjahres zurückgesetzt (${names.slice(0, 8).join('; ')}${names.length > 8 ? ' …' : ''})`);
    res.json({ ok: true, count: p.rows.length, members: names.length });
  });
}

module.exports = { register };
