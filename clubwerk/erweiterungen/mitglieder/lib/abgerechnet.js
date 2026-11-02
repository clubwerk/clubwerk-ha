'use strict';
/**
 * „Abgerechnet bis“ für alle setzen (planung/gebucht-bis.md) – wie „gebucht bis Datum XY“ in anderen Programmen.
 * Typischer Fall: Nach Import oder Umstieg sind Beiträge bis zu einem Datum schon im alten Programm abgerechnet; der nächste
 * Beitragslauf darf sie nicht noch einmal berechnen.
 *  - Es ändert sich nur „abgerechnet bis“ der Beitragszuordnungen (mv_member_fee) und der Zusatzbeiträge der Abteilungen
 *    (mv_member_department). Forderungen werden weder erzeugt noch geändert noch gelöscht.
 *  - Nur vorwärts; mit „auch zurücksetzen“ genau auf das Datum, aber nie vor das, was Clubwerk selbst schon als Posten berechnet hat.
 *  - Vorschau → Ausführen nur mit demselben Stand (Prüfwert), dem Wort SETZEN und dem eigenen Passwort.
 *  - Vorherige Werte je Zuordnung bleiben gespeichert: Die letzte Änderung lässt sich zurücknehmen, solange kein Beitragslauf lief.
 */
const crypto = require('crypto');

function register(sh) {
  const { C, store, fees, euro, deD, uname, ar, zusatzFor } = sh;
  const { S, today, nowTs } = store;
  const { need, bad, int } = C;
  const db = C.db, admin = C.admin;
  const PF = need('mitglieder_finanzen');
  const G = C.require('./geraete');   // eigenes Passwort bestätigen, falsche Versuche je Benutzer gebremst
  const { nameKey } = C.require('./db');
  const isDate = fees.isDate;
  const fachlich = msg => Object.assign(new Error(msg), { fachlich: true });
  const minDate = (...a) => a.filter(isDate).sort()[0] || null;
  const ids = v => (Array.isArray(v) ? [...new Set(v.map(Number).filter(n => Number.isInteger(n) && n > 0))] : []);
  const lastRunId = () => db.prepare("SELECT COALESCE(MAX(id), 0) n FROM mv_run WHERE kind = 'beitrag'").get().n;
  const charged = { mf: db.prepare("SELECT MAX(period_to) t FROM mv_charge WHERE member_fee_id = ? AND status != 'storniert'"),
    md: db.prepare("SELECT MAX(period_to) t FROM mv_charge WHERE member_dept_id = ? AND status != 'storniert'") };
  const TABLE = { mf: 'mv_member_fee', md: 'mv_member_department' };

  /** Eingaben prüfen → { date, back, fees, depts, names } */
  function input(b) {
    const date = String(b.date || '');
    if (!isDate(date)) throw fachlich('Bitte ein gültiges Datum wählen.');
    if (date < '1990-01-01' || date > fees.addMonths(today(), 60)) throw fachlich('Das Datum liegt zu weit in der Vergangenheit oder Zukunft.');
    const feeIds = ids(b.fees), deptIds = ids(b.depts);
    const feeRows = feeIds.length ? db.prepare(`SELECT id, name FROM mv_fee WHERE id IN (${feeIds.map(() => '?').join(',')})`).all(...feeIds) : [];
    const deptRows = deptIds.length ? db.prepare(`SELECT id, name FROM mv_department WHERE id IN (${deptIds.map(() => '?').join(',')})`).all(...deptIds) : [];
    if (feeRows.length !== feeIds.length || deptRows.length !== deptIds.length) throw fachlich('Eine gewählte Beitragsart oder Abteilung gibt es nicht mehr – bitte neu wählen.');
    return { date, back: b.back === true || b.back === '1', fees: feeIds.length ? new Set(feeIds) : null, depts: deptIds.length ? new Set(deptIds) : null,
      names: { fees: feeRows.map(f => f.name).sort((a, c) => a.localeCompare(c, 'de')), depts: deptRows.map(d => d.name).sort((a, c) => a.localeCompare(c, 'de')) } };
  }

  /** Was würde sich ändern? → { date, back, changes, skipped, totals, warnings, token } */
  async function plan(b) {
    const o = input(b), { date, back } = o;
    const pending = new Set(db.prepare("SELECT member_id FROM mv_change WHERE kind = 'eintritt' AND status = 'offen'").all().map(r => r.member_id));
    const cand = [];
    const zDepts = new Set(db.prepare("SELECT DISTINCT department_id FROM mv_fee WHERE kind = 'zusatz' AND active = 1 AND department_id IS NOT NULL").all().map(r => r.department_id));
    // Beitragszuordnungen (Grundbeitrag, Familienbeitrag, Aufnahmegebühr …)
    for (const r of db.prepare(`SELECT mf.id, mf.member_id, mf.fee_id, mf.start_date, mf.end_date, mf.booked_until, f.name AS fee, f.interval, f.department_id, d.name AS dept, p.exit_date, m.name
        FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id JOIN mv_person p ON p.member_id = mf.member_id JOIN members m ON m.id = mf.member_id LEFT JOIN mv_department d ON d.id = f.department_id
        WHERE m.deleted = 0 AND p.anonymized_at IS NULL AND f.kind != 'zusatz'`).all()) {
      if (o.fees && !o.fees.has(r.fee_id)) continue;
      if (o.depts && !o.depts.has(r.department_id)) continue;
      cand.push({ kind: 'mf', id: r.id, member_id: r.member_id, name: r.name, fee: r.fee, dept: r.dept || null, old: r.booked_until || null, start: r.start_date, stop: minDate(r.end_date, r.exit_date), exited: isDate(r.exit_date) && r.exit_date === minDate(r.end_date, r.exit_date), interval: r.interval });
    }
    // Zusatzbeiträge der Abteilungen (je Person; Angehörige einer Familie haben eigene Zeilen, gezahlt über das Oberhaupt)
    for (const md of db.prepare(`SELECT md.*, d.name AS dept, p.birth_date, p.exit_date AS p_exit, p.entry_date AS p_entry, m.name
        FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id JOIN mv_person p ON p.member_id = md.member_id JOIN members m ON m.id = md.member_id
        WHERE m.deleted = 0 AND p.anonymized_at IS NULL`).all()) {
      if (o.depts && !o.depts.has(md.department_id)) continue;
      const open = md.booked_until ? fees.addDays(md.booked_until, 1) : (minDate(md.entry_date, md.p_entry) || today());
      if (!md.fee_id && !zDepts.has(md.department_id)) continue;   // Abteilung ohne Zusatzbeitrag: nichts abzurechnen
      const za = zusatzFor(md, md.birth_date, open), zb = zusatzFor(md, md.birth_date, date);
      // Filter Beitragsart: zählt, wenn die Stufe am ersten offenen Tag oder am Datum dazugehört (nach Alter kann sie wechseln)
      if (o.fees && (md.fee_free || !((za.fee && o.fees.has(za.fee.id)) || (zb.fee && o.fees.has(zb.fee.id))))) continue;
      const start = [md.entry_date, md.p_entry].filter(isDate).sort().reverse()[0] || null;
      const f = za.fee || zb.fee;
      cand.push({ kind: 'md', id: md.id, member_id: md.member_id, name: md.name, fee: f ? f.name : `Zusatzbeitrag ${md.dept}`, dept: md.dept, zusatz: true, old: md.booked_until || null, start,
        stop: minDate(md.exit_date, md.p_exit), exited: isDate(md.p_exit) && md.p_exit === minDate(md.exit_date, md.p_exit), free: Boolean(md.fee_free), interval: f ? f.interval : null });
    }

    const changes = [], skipped = [];
    const skip = (c, why, reason) => skipped.push({ kind: c.kind, id: c.id, member_id: c.member_id, name: c.name, fee: c.fee, dept: c.dept, zusatz: Boolean(c.zusatz), old: c.old, why, reason });
    for (const c of cand) {
      if (pending.has(c.member_id)) { skip(c, 'eintritt', 'Eintritt noch nicht bestätigt'); continue; }
      if (c.free) { skip(c, 'befreit', 'vom Zusatzbeitrag befreit'); continue; }
      if (c.start && c.start > date) { skip(c, 'spaeter', `beginnt erst am ${deD(c.start)}`); continue; }
      if (c.stop && c.old && c.stop <= c.old && c.stop <= date) { skip(c, 'aus', `${c.exited ? 'ausgetreten' : 'beendet'} am ${deD(c.stop)}, nichts mehr abzurechnen`); continue; }
      if (c.interval === 'einmalig' && c.old) { skip(c, 'schon', 'einmalig, schon abgerechnet'); continue; }
      let to = date, note = null;
      if (c.old === date) { skip(c, 'schon', `steht schon auf ${deD(date)}`); continue; }
      if (!back && c.old && c.old > date) { skip(c, 'schon', `schon bis ${deD(c.old)} abgerechnet`); continue; }
      if (back && c.old && c.old > date) {   // zurück: nie vor das, was Clubwerk selbst schon als Posten berechnet hat
        const t = charged[c.kind].get(c.id).t;
        if (t && t >= c.old) { skip(c, 'clubwerk', `in Clubwerk schon bis ${deD(t)} als Posten berechnet`); continue; }
        if (t && t > date) { to = t; note = `nur bis ${deD(t)} – so weit hat Clubwerk schon Posten berechnet`; }
      }
      changes.push({ kind: c.kind, id: c.id, member_id: c.member_id, name: c.name, fee: c.fee, dept: c.dept, zusatz: Boolean(c.zusatz), old: c.old, new: to, note, interval: c.interval, stop: c.stop });
    }
    // Zur Information (nur ohne Filter): Mitglieder ohne jede Zuordnung – ohne Beitrag oder über die Familie abgedeckt
    if (!o.fees && !o.depts) {
      const seen = new Set(cand.map(c => c.member_id));
      for (const r of db.prepare(`SELECT m.id, m.name, p.family_of, (SELECT name FROM members WHERE id = p.family_of) AS head FROM members m JOIN mv_person p ON p.member_id = m.id
          WHERE m.kind = 'mitglied' AND m.deleted = 0 AND p.anonymized_at IS NULL AND (p.exit_date IS NULL OR p.exit_date >= ?)`).all(date)) {
        if (seen.has(r.id)) continue;
        skipped.push({ kind: null, id: null, member_id: r.id, name: r.name, fee: null, dept: null, old: null, why: r.family_of ? 'familie' : 'ohne', reason: r.family_of ? `über die Familienmitgliedschaft von ${r.head} abgedeckt` : 'ohne Beitrag' });
      }
    }

    // Auswirkung: mit der Rechnung des Beitragslaufs selbst – einmal mit dem heutigen, einmal mit dem neuen Stand
    const horizon = [date, ...changes.map(c => c.old).filter(Boolean)].sort().pop();
    const over = { mf: {}, md: {} };
    for (const c of changes) over[c.kind][c.id] = c.new;
    const sums = pv => { const m = new Map(); for (const p of pv.positions) { const k = p.member_fee_id ? 'mf' + p.member_fee_id : p.member_dept_id ? 'md' + p.member_dept_id : null; if (k) m.set(k, (m.get(k) || 0) + p.cents); } return m; };
    const now = changes.length ? sums(await sh.runPreview({ until: horizon, extra: false })) : new Map();
    const then = changes.length ? sums(await sh.runPreview({ until: horizon, extra: false, booked: over })) : new Map();
    for (const c of changes) c.effect = (now.get(c.kind + c.id) || 0) - (then.get(c.kind + c.id) || 0);

    const warnings = [];
    if (date > today()) warnings.push(`Das Datum liegt in der Zukunft: Zeiträume bis zum ${deD(date)} berechnet Clubwerk danach nicht mehr – auch die, die noch gar nicht abgerechnet sind.`);
    const ys = S('year_start', '01-01');
    const mid = changes.filter(c => { const step = fees.MONTHS[c.interval]; return step > 0 && (!c.stop || c.stop > date) && fees.nextAnchor(date, ys, step) !== fees.addDays(date, 1); });
    if (mid.length) warnings.push(`Bei ${mid.length} ${mid.length === 1 ? 'Zuordnung' : 'Zuordnungen'} endet der ${deD(date)} mitten in einem Beitragszeitraum (Beitragsjahr ab ${ys.slice(3)}.${ys.slice(0, 2)}.). Der Rest dieses Zeitraums wird beim nächsten Lauf neu berechnet – anteilig, bei Beiträgen mit „voll“ sogar ganz. Meist ist das Ende eines Beitragszeitraums richtig.`);
    if (back && changes.some(c => c.old && c.old > c.new)) warnings.push('Zurücksetzen: Zeiträume nach dem Datum berechnet der nächste Beitragslauf noch einmal. Wurden sie im alten Programm schon eingezogen, zahlen die Mitglieder doppelt.');

    const key = c => nameKey(c.name, 'mitglied');
    const order = (a, c) => key(a).localeCompare(key(c), 'de') || String(a.fee || '').localeCompare(String(c.fee || ''), 'de');
    changes.sort(order); skipped.sort(order);
    const from = new Map(); for (const c of changes) from.set(c.old || '', (from.get(c.old || '') || 0) + 1);
    const token = crypto.createHash('sha256').update(JSON.stringify([date, back, [...(o.fees || [])].sort(), [...(o.depts || [])].sort(), changes.map(c => [c.kind, c.id, c.old, c.new])])).digest('hex').slice(0, 32);
    return { date, back, names: o.names, changes, skipped, warnings, token,
      totals: { rows: changes.length, members: new Set(changes.map(c => c.member_id)).size, effect: changes.reduce((s, c) => s + c.effect, 0),
        later: changes.filter(c => c.old && c.old > c.new).length, from: [...from.entries()].map(([d, n]) => ({ old: d || null, n })).sort((a, c) => String(a.old || '').localeCompare(String(c.old || ''))),
        skipped: skipped.reduce((m, x) => ({ ...m, [x.why]: (m[x.why] || 0) + 1 }), {}) } };
  }
  const answer = (res, e) => { if (e.fachlich) { bad(res, e.message); return true; } return false; };

  admin.post('/booked/preview', PF, ar(async (req, res) => {
    try { res.json(await plan(req.body || {})); } catch (e) { if (!answer(res, e)) throw e; }
  }));
  /* Liste als Excel (gleiche Eingaben wie die Vorschau, als Abfrage) */
  admin.get('/booked/preview.xlsx', PF, ar(async (req, res) => {
    const q = req.query, list = v => String(v || '').split(',').filter(Boolean);
    let p; try { p = await plan({ date: q.date, back: q.back === '1', fees: list(q.fees), depts: list(q.depts) }); } catch (e) { if (answer(res, e)) return; throw e; }
    const ExcelJS = C.require('exceljs');
    const wb = new ExcelJS.Workbook();
    const { lastFirst } = C.require('./db');
    const safe = v => (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v);
    const ws = wb.addWorksheet('Ändert sich');
    ws.columns = [{ header: 'Mitglied', width: 28 }, { header: 'Beitrag', width: 30 }, { header: 'Abteilung', width: 16 }, { header: 'bisher abgerechnet bis', width: 22 }, { header: 'neu', width: 12 }, { header: 'nicht mehr berechnet (€)', width: 24 }, { header: 'Hinweis', width: 40 }];
    for (const c of p.changes) ws.addRow([safe(lastFirst(c.name, 'mitglied')), safe(c.fee), safe(c.dept || ''), c.old ? deD(c.old) : 'noch nichts', deD(c.new), c.effect / 100, safe(c.note || '')]);
    ws.getColumn(6).numFmt = '#,##0.00';
    const ws2 = wb.addWorksheet('Übersprungen');
    ws2.columns = [{ header: 'Mitglied', width: 28 }, { header: 'Beitrag', width: 30 }, { header: 'Abteilung', width: 16 }, { header: 'abgerechnet bis', width: 16 }, { header: 'Grund', width: 50 }];
    for (const x of p.skipped) ws2.addRow([safe(lastFirst(x.name, 'mitglied')), safe(x.fee || ''), safe(x.dept || ''), x.old ? deD(x.old) : '', safe(x.reason)]);
    for (const w of [ws, ws2]) { w.getRow(1).font = { bold: true }; w.views = [{ state: 'frozen', ySplit: 1 }]; }
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="Abgerechnet-bis_${p.date}.xlsx"` }).send(Buffer.from(await wb.xlsx.writeBuffer()));
  }));

  /** Ausführen: Wort SETZEN, eigenes Passwort, Prüfwert der Vorschau */
  admin.post('/booked', PF, ar(async (req, res) => {
    const b = req.body || {};
    if (String(b.confirm || '').trim().toUpperCase() !== 'SETZEN') return bad(res, 'Bitte zur Bestätigung das Wort SETZEN eintippen.');
    const pw = G.bestaetigt(req, res, C.ownPwOk); if (!pw) return;
    if (!pw.confirmed) return res.status(428).json({ error: 'Bitte mit deinem Passwort bestätigen.', needPassword: true });
    let p; try { p = await plan(b); } catch (e) { if (answer(res, e)) return; throw e; }
    if (!p.changes.length) return bad(res, 'Es gibt nichts zu ändern.');
    if (b.token !== p.token) return res.status(409).json({ error: 'Seit der Vorschau hat sich etwas geändert. Bitte die Vorschau neu laden und noch einmal prüfen.', stale: true });
    const user = uname(req);
    let setId;
    try {
      db.transaction(() => {
        setId = Number(db.prepare('INSERT INTO mv_booked_set(date, back, filters, count, members, effect_cents, last_run_id, by_user) VALUES (?,?,?,?,?,?,?,?)')
          .run(p.date, p.back ? 1 : 0, JSON.stringify({ fees: b.fees ? ids(b.fees) : [], depts: b.depts ? ids(b.depts) : [], names: p.names }), p.totals.rows, p.totals.members, p.totals.effect, lastRunId(), user).lastInsertRowid);
        const insRow = db.prepare('INSERT INTO mv_booked_row(set_id, kind, row_id, member_id, old, new) VALUES (?,?,?,?,?,?)');
        for (const c of p.changes) {
          // derselbe Stand wie in der Vorschau? (sonst hat inzwischen jemand anderes geändert)
          const cur = db.prepare(`SELECT booked_until FROM ${TABLE[c.kind]} WHERE id = ?`).get(c.id);
          if (!cur || (cur.booked_until || null) !== c.old) throw Object.assign(fachlich('Seit der Vorschau hat sich etwas geändert. Bitte die Vorschau neu laden und noch einmal prüfen.'), { stale: true });
          db.prepare(`UPDATE ${TABLE[c.kind]} SET booked_until = ? WHERE id = ?`).run(c.new, c.id);
          insRow.run(setId, c.kind, c.id, c.member_id, c.old, c.new);
          store.hist(c.member_id, user, `${c.zusatz ? 'Zusatzbeitrag' : 'Beitrag'} ${c.fee}: abgerechnet bis (gesammelt)`, c.old ? deD(c.old) : 'noch nichts', deD(c.new));
        }
      })();
    } catch (e) { if (e.stale) return res.status(409).json({ error: e.message, stale: true }); throw e; }
    const olds = [...new Set(p.changes.map(c => c.old || ''))];
    const stand = C.auditDiff({ bis: 'Abgerechnet bis' }, { bis: olds.length === 1 ? (olds[0] ? deD(olds[0]) : 'noch nichts') : 'verschieden' }, { bis: deD(p.date) });
    C.audit(req.user, 'Abgerechnet bis gesammelt gesetzt', `${stand}${p.back ? ' (auch zurückgesetzt)' : ' (nur vorwärts)'} · Beitragsarten: ${p.names.fees.join(', ') || 'alle'} · Abteilungen: ${p.names.depts.join(', ') || 'alle'} · ${p.totals.rows} ${p.totals.rows === 1 ? 'Zuordnung' : 'Zuordnungen'} bei ${p.totals.members} ${p.totals.members === 1 ? 'Mitglied' : 'Mitgliedern'} · ${p.totals.effect >= 0 ? 'nicht mehr berechnet' : 'zusätzlich berechnet'}: ${euro(Math.abs(p.totals.effect))}`);
    res.json({ ok: true, id: setId, count: p.totals.rows, members: p.totals.members, effect: p.totals.effect });
  }));

  /** Bisherige Änderungen; undo nur für die letzte, solange danach kein Beitragslauf lief */
  function undoState(s) {
    if (s.undone_at) return { undo: false };
    const last = db.prepare('SELECT id FROM mv_booked_set WHERE undone_at IS NULL ORDER BY id DESC LIMIT 1').get();
    if (!last || last.id !== s.id) return { undo: false, why: 'Nur die letzte Änderung lässt sich zurücknehmen.' };
    // seit der Änderung ein Lauf? (Nummern werden nie doppelt vergeben, src/ids.js)
    const run = db.prepare("SELECT created_at FROM mv_run WHERE kind = 'beitrag' AND id > ? ORDER BY id LIMIT 1").get(s.last_run_id);
    if (run) return { undo: false, why: `Seitdem lief ein Beitragslauf (${deD(run.created_at.slice(0, 10))}) – Zurücknehmen geht nicht mehr.` };
    return { undo: true };
  }
  admin.get('/booked', PF, (req, res) => res.json({
    suggest: fees.addDays(store.periodStart(today(), 'jahr'), -1),   // Vorschlag: Ende des letzten Beitragsjahres
    sets: db.prepare('SELECT * FROM mv_booked_set ORDER BY id DESC LIMIT 20').all().map(s => { const f = JSON.parse(s.filters || '{}');
      return { id: s.id, date: s.date, back: Boolean(s.back), count: s.count, members: s.members, effect: s.effect_cents, by_user: s.by_user, created_at: s.created_at,
        undone_at: s.undone_at, undone_by: s.undone_by, undo_kept: s.undo_kept, fees: (f.names || {}).fees || [], depts: (f.names || {}).depts || [], ...undoState(s) }; }) }));
  admin.post('/booked/:id/undo', PF, (req, res) => {
    const s = db.prepare('SELECT * FROM mv_booked_set WHERE id = ?').get(int(req.params.id));
    if (!s) return bad(res, 'Nicht gefunden.', 404);
    const u = undoState(s);
    if (!u.undo) return bad(res, s.undone_at ? 'Diese Änderung ist schon zurückgenommen.' : u.why);
    const pw = G.bestaetigt(req, res, C.ownPwOk); if (!pw) return;
    if (!pw.confirmed) return res.status(428).json({ error: 'Bitte mit deinem Passwort bestätigen.', needPassword: true });
    const user = uname(req);
    let back = 0, kept = 0;
    db.transaction(() => {
      for (const r of db.prepare('SELECT x.*, COALESCE(f.name, \'\') AS fee FROM mv_booked_row x LEFT JOIN mv_member_fee mf ON x.kind = \'mf\' AND mf.id = x.row_id LEFT JOIN mv_fee f ON f.id = mf.fee_id WHERE x.set_id = ?').all(s.id)) {
        const cur = db.prepare(`SELECT booked_until FROM ${TABLE[r.kind]} WHERE id = ?`).get(r.row_id);
        if (!cur || cur.booked_until !== r.new) { kept++; continue; }   // seitdem anders geändert (von Hand, Storno …): so lassen
        db.prepare(`UPDATE ${TABLE[r.kind]} SET booked_until = ? WHERE id = ?`).run(r.old, r.row_id);
        store.hist(r.member_id, user, `${r.kind === 'md' ? 'Zusatzbeitrag' : 'Beitrag'}${r.fee ? ' ' + r.fee : ''}: abgerechnet bis (zurückgenommen)`, deD(r.new), r.old ? deD(r.old) : 'noch nichts');
        back++;
      }
      db.prepare('UPDATE mv_booked_set SET undone_at = ?, undone_by = ?, undo_kept = ? WHERE id = ?').run(nowTs(), user, kept, s.id);
    })();
    C.audit(req.user, 'Abgerechnet bis zurückgenommen', `Änderung vom ${deD(s.created_at.slice(0, 10))} (auf ${deD(s.date)}): ${back} ${back === 1 ? 'Zuordnung' : 'Zuordnungen'} wieder auf den Stand davor${kept ? `, ${kept} seitdem anders geändert – so gelassen` : ''}`);
    res.json({ ok: true, back, kept });
  });
}

module.exports = { register };
