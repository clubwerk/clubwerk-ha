'use strict';
/** Auswertungen, Bestandserhebung (Landessportbund), Excel-Listen, Geburtstage/Jubiläen, Rundmails */
function register(sh) {
  const { C, store, sepa, fees, listRows, one, txt, mailOk, euro, deD, uname, ar } = sh;
  const { S, today } = store;
  const { need, bad, int, rateLimit } = C;
  const admin = C.admin, db = C.db;
  const P = need('mitglieder');
  const isDate = fees.isDate;
  const ExcelJS = C.require('exceljs');
  /* Altersgruppen der Bestandserhebung (LSB Hessen; andere Landessportbünde ähnlich) */
  const LSB_GROUPS = [[0, 6, 'bis 6'], [7, 14, '7–14'], [15, 18, '15–18'], [19, 26, '19–26'], [27, 40, '27–40'], [41, 60, '41–60'], [61, 200, '61 und älter']];

  /** Mitglieder an einem Stichtag (eingetreten, noch nicht ausgetreten) – auch ohne erfasste Mitgliedsdaten, wie in der Liste */
  function membersAt(day) {
    return db.prepare(`SELECT m.id, m.name, p.birth_date, p.gender, p.entry_date, p.exit_date, p.status FROM members m LEFT JOIN mv_person p ON p.member_id = m.id
      WHERE m.kind = 'mitglied' AND m.deleted = 0 AND (p.entry_date IS NULL OR p.entry_date <= ?) AND (p.exit_date IS NULL OR p.exit_date >= ?)`).all(day, day);
  }
  function lsb(day) {
    const people = membersAt(day);
    const depts = db.prepare('SELECT * FROM mv_department ORDER BY sort, name').all();
    const deptOf = db.prepare('SELECT department_id FROM mv_member_department WHERE member_id = ? AND (entry_date IS NULL OR entry_date <= ?) AND (exit_date IS NULL OR exit_date >= ?)');
    const blank = () => LSB_GROUPS.map(() => ({ m: 0, w: 0, d: 0, x: 0 }));
    const total = blank(), per = new Map(depts.map(d => [d.id, blank()]));
    let noBirth = 0;
    for (const p of people) {
      const a = fees.ageAt(p.birth_date, day);
      if (a == null) { noBirth++; continue; }
      const gi = LSB_GROUPS.findIndex(g => a >= g[0] && a <= g[1]);
      const g = p.gender === 'm' || p.gender === 'w' || p.gender === 'd' ? p.gender : 'x';
      total[gi][g]++;
      for (const r of deptOf.all(p.id, day, day)) if (per.has(r.department_id)) per.get(r.department_id)[gi][g]++;
    }
    return { day, groups: LSB_GROUPS.map(g => g[2]), total, depts: depts.map(d => ({ id: d.id, name: d.name, federation: d.federation, rows: per.get(d.id) })), noBirth, count: people.length };
  }
  admin.get('/stats', P, (req, res) => {
    const day = isDate(req.query.day) ? req.query.day : today();
    const people = membersAt(day);
    const y = Number(day.slice(0, 4));
    const years = [];
    for (let k = y - 9; k <= y; k++) years.push({ year: k, in: db.prepare("SELECT COUNT(*) n FROM mv_person WHERE substr(entry_date,1,4) = ?").get(String(k)).n, out: db.prepare("SELECT COUNT(*) n FROM mv_person WHERE substr(exit_date,1,4) = ?").get(String(k)).n });
    const byStatus = {}; for (const p of people) byStatus[p.status || 'aktiv'] = (byStatus[p.status || 'aktiv'] || 0) + 1;
    const ages = people.map(p => fees.ageAt(p.birth_date, day)).filter(a => a != null);
    const depts = db.prepare(`SELECT d.name, COUNT(md.id) n FROM mv_department d LEFT JOIN mv_member_department md ON md.department_id = d.id AND (md.entry_date IS NULL OR md.entry_date <= ?) AND (md.exit_date IS NULL OR md.exit_date >= ?)
      GROUP BY d.id ORDER BY d.sort, d.name`).all(day, day);
    // Geburtstage (runde) und Jubiläen in den nächsten 12 Monaten
    const until = fees.addMonths(today(), 12);
    const events = [];
    for (const p of db.prepare(`SELECT m.id, m.name, p.birth_date, p.entry_date FROM members m JOIN mv_person p ON p.member_id = m.id WHERE m.kind = 'mitglied' AND m.deleted = 0 AND p.anonymized_at IS NULL AND (p.exit_date IS NULL OR p.exit_date >= ?)`).all(today())) {
      for (const [field, kind, round] of [['birth_date', 'Geburtstag', n => n % 10 === 0 || n === 18 || n === 75 || n === 85 || n === 95], ['entry_date', 'Vereinsjubiläum', n => [10, 25, 40, 50, 60, 70].includes(n)]]) {
        const d = p[field]; if (!isDate(d)) continue;
        for (const yy of [Number(today().slice(0, 4)), Number(today().slice(0, 4)) + 1]) {
          const at = `${yy}${d.slice(4)}`; const n = yy - Number(d.slice(0, 4));
          if (at >= today() && at <= until && n > 0 && round(n)) events.push({ id: p.id, name: p.name, kind, n, date: at });
        }
      }
    }
    events.sort((a, b) => a.date.localeCompare(b.date));
    res.json({ day, count: people.length, byStatus, byGender: ['m', 'w', 'd', 'x'].map(g => ({ g, n: people.filter(p => (p.gender || 'x') === g).length })),
      avgAge: ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length * 10) / 10 : null, years, depts, lsb: lsb(day), events: events.slice(0, 60) });
  });

  const style = ws => { ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }]; };
  const safeCell = v => (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v);
  admin.get('/stats/lsb.xlsx', P, ar(async (req, res) => {
    const day = isDate(req.query.day) ? req.query.day : `${today().slice(0, 4)}-01-01`;
    const r = lsb(day);
    const wb = new ExcelJS.Workbook();
    const sheet = (title, rows) => {
      const ws = wb.addWorksheet(title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
      ws.columns = [{ header: 'Altersgruppe', width: 16 }, { header: 'männlich', width: 11 }, { header: 'weiblich', width: 11 }, { header: 'divers', width: 9 }, { header: 'ohne Angabe', width: 13 }, { header: 'gesamt', width: 10 }];
      rows.forEach((x, i) => ws.addRow([r.groups[i], x.m, x.w, x.d, x.x, x.m + x.w + x.d + x.x]));
      const s = k => rows.reduce((a, x) => a + x[k], 0);
      ws.addRow(['Summe', s('m'), s('w'), s('d'), s('x'), s('m') + s('w') + s('d') + s('x')]).font = { bold: true };
      style(ws);
    };
    sheet(`Verein gesamt ${deD(day)}`, r.total);
    for (const d of r.depts) sheet(d.name + (d.federation ? ` (${d.federation})` : ''), d.rows);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="Bestandserhebung_${day}.xlsx"` }).send(Buffer.from(await wb.xlsx.writeBuffer()));
  }));

  /* Einwilligungen: wer heute Mitglied ist und zugestimmt hat (z. B. für den Pressewart) – Zahlen und Liste als Excel */
  const { lastFirst, nameKey } = C.require('./db');
  function consentRows() {
    const day = today();
    return membersAt(day).map(m => { const p = db.prepare('SELECT member_no, consents, anonymized_at FROM mv_person WHERE member_id = ?').get(m.id) || {}; return { ...m, no: p.member_no, c: JSON.parse(p.consents || '{}'), anon: p.anonymized_at }; })
      .filter(m => !m.anon).sort((a, b) => nameKey(a.name, 'mitglied').localeCompare(nameKey(b.name, 'mitglied'), 'de'));
  }
  admin.get('/consents', P, (req, res) => {
    const rows = consentRows();
    res.json({ count: rows.length, list: sh.consentList().map(c => ({ key: c.key, short: c.short, required: Boolean(c.required), yes: rows.filter(r => r.c[c.key]).length })) });
  });
  admin.get('/consents.xlsx', P, ar(async (req, res) => {
    const rows = consentRows(), cons = sh.consentList();
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Einwilligungen');
    ws.columns = [{ header: 'Name', width: 28 }, { header: 'Mitgliedsnummer', width: 16 }, ...cons.map(c => ({ header: c.short, width: Math.max(14, c.short.length + 2) }))];
    for (const r of rows) ws.addRow([safeCell(lastFirst(r.name, 'mitglied')), safeCell(r.no || ''), ...cons.map(c => (!r.c[c.key] ? 'nein' : isDate(String(r.c[c.key]).slice(0, 10)) ? `ja (seit ${deD(String(r.c[c.key]).slice(0, 10))})` : 'ja'))]);
    style(ws);
    C.audit(req.user, 'Mitglieder: Einwilligungen exportiert', `${rows.length} Mitglieder`);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="Einwilligungen_${today()}.xlsx"` }).send(Buffer.from(await wb.xlsx.writeBuffer()));
  }));

  /* Mitgliederliste als Excel (Spalten wählbar; Bankdaten nur mit Recht) */
  const COLS = [['member_no', 'Mitgliedsnummer'], ['last_name', 'Nachname'], ['first_name', 'Vorname'], ['salutation', 'Anrede'], ['title', 'Titel'], ['birth_date', 'Geburtsdatum'], ['age', 'Alter'], ['gender', 'Geschlecht'],
    ['street', 'Straße'], ['zip', 'PLZ'], ['city', 'Ort'], ['email', 'E-Mail'], ['phone', 'Telefon'], ['mobile', 'Mobil'], ['status', 'Status'], ['entry_date', 'Eintritt'], ['exit_date', 'Austritt'],
    ['depts', 'Abteilungen'], ['fees', 'Beiträge'], ['payer', 'Zahler'], ['family', 'Familienmitgliedschaft bei'], ['payment', 'Zahlungsart'], ['key_no', 'Schlüsselnummer'], ['iban', 'IBAN'], ['mandate_ref', 'Mandatsreferenz'], ['mandate_date', 'Mandat vom'], ['consents', 'Einwilligungen']];
  admin.get('/export.xlsx', P, ar(async (req, res) => {
    const want = String(req.query.cols || 'member_no,last_name,first_name,birth_date,street,zip,city,email,mobile,status,entry_date,depts,fees').split(',');
    const canBank = req.user.perms.includes('mitglieder_bank');
    const cols = COLS.filter(([k]) => want.includes(k) && (canBank || !['iban', 'mandate_ref', 'mandate_date'].includes(k)));
    const rows = listRows(req.query);
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Mitglieder');
    ws.columns = cols.map(([, h]) => ({ header: h, width: Math.max(12, h.length + 2) }));
    const cons = sh.consentList();
    for (const r of rows) {
      const p = db.prepare('SELECT * FROM mv_person WHERE member_id = ?').get(r.id) || {};
      const b = canBank ? db.prepare('SELECT * FROM mv_bank WHERE member_id = ?').get(r.id) || {} : {};
      const c = JSON.parse(p.consents || '{}');
      const val = { ...p, ...r, gender: store.GENDER[r.gender] || '', payer: r.payer_name || '', family: r.family_head_name || '', payment: store.PAYMENT[r.payment] || '', iban: b.iban ? sepa.fmtIban(b.iban) : '', mandate_ref: b.mandate_ref || '', mandate_date: b.mandate_date || '',
        consents: cons.filter(x => c[x.key]).map(x => x.short).join(', ') };
      ws.addRow(cols.map(([k]) => { const v = val[k]; return safeCell(/_date$/.test(k) && isDate(v) ? deD(v) : v == null ? '' : v); }));
    }
    style(ws);
    C.audit(req.user, 'Mitgliederliste exportiert', `${rows.length} Mitglieder, Spalten: ${cols.map(c => c[1]).join(', ')}`);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="Mitglieder_${today()}.xlsx"` }).send(Buffer.from(await wb.xlsx.writeBuffer()));
  }));
  admin.get('/export/cols', P, (req, res) => res.json(COLS.filter(([k]) => req.user.perms.includes('mitglieder_bank') || !['iban', 'mandate_ref', 'mandate_date'].includes(k))));

  // Rundmails: seit 3.10 unter Verein → E-Mail (src/mailer.js)
}

module.exports = { register };
