'use strict';
/**
 * Geld: Beitragslauf → Forderungen (offene Posten) → SEPA-Einzug (pain.008.001.08) / Rechnung / bar
 *  - Beitragslauf: alle Zeiträume bis zum gewählten Datum, optional mit offenen Getränken und Positionen anderer Module
 *    (z. B. nicht geleistete Arbeitsstunden). Jede Position nur einmal („gebucht bis“, eindeutige Schlüssel).
 *  - Verkaufs-Einzug: jederzeit separat (nur Getränke).
 *  - Einzug: je Zahler eine Lastschrift über alle fälligen offenen Posten; Erst-/Folgelastschrift automatisch.
 *  - Rücklastschrift: Posten wieder offen (+ Gebühr), Einzug verwerfen solange nicht gebucht.
 */
const pdf = require('./pdf');

function register(sh) {
  const { C, store, sepa, fees, personRow, bankRow, mandateState, one, euro, deD, uname, ar } = sh;
  const { S, today, nowTs } = store;
  const { need, bad, int, rateLimit } = C;
  const admin = C.admin, db = C.db;
  const PF = need('mitglieder_finanzen');
  const isDate = fees.isDate;
  const nameKey = (n, k) => C.require('./db').nameKey(n, k);   // Sortierung: Nachname, Vorname
  const lastFirst = (n, k) => C.require('./db').lastFirst(n, k);

  const payerName = id => (db.prepare('SELECT name FROM members WHERE id = ?').get(id) || {}).name || '?';
  const personOf = id => db.prepare('SELECT * FROM mv_person WHERE member_id = ?').get(id) || {};
  const club = () => ({ name: S('creditor_name') || C.getSetting('club_name', 'Verein'), street: S('club_street'), city: S('club_city'), iban: store.account().iban, bic: store.account().bic, bank: store.account().bank,
    ci: S('creditor_id'), invoiceText: S('invoice_text'), logo: null });

  /* ======================================================= Beitragslauf */
  async function preview(o) {
    const until = isDate(o.until) ? o.until : today();
    const yearStart = S('year_start', '01-01');
    const positions = [], warnings = [], info = [], marks = [];   // marks: beitragsfreie Zeiträume (Eintrittsjahr frei) – nur „abgerechnet bis“ vorrücken
    const famWarned = new Set();
    if (!o.onlyDrinks) {
      const rows = db.prepare(`SELECT mf.*, f.name AS fee_name, f.cents AS fee_cents, f.interval, f.prorate, f.department_id, f.age_min, f.age_max, f.family,
          p.exit_date, p.birth_date, p.anonymized_at, m.name AS person_name
        FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id JOIN mv_person p ON p.member_id = mf.member_id JOIN members m ON m.id = mf.member_id
        WHERE m.deleted = 0 AND p.anonymized_at IS NULL AND f.kind != 'zusatz' AND NOT EXISTS (SELECT 1 FROM mv_change x WHERE x.member_id = m.id AND x.kind = 'eintritt' AND x.status = 'offen')`).all();
      for (const r of rows) {
        if (o.dept && r.department_id !== Number(o.dept)) continue;
        if (o.fee && r.fee_id !== Number(o.fee)) continue;
        const payer = store.payerOf(r.member_id);
        const pp = personOf(payer);
        if (o.payment && (pp.payment || 'lastschrift') !== o.payment) continue;
        const per = fees.periods({ start_date: r.start_date, end_date: r.end_date, booked_until: r.booked_until, cents: r.cents != null ? r.cents : r.fee_cents, interval: r.interval, prorate: r.prorate }, until, { limit: r.exit_date, yearStart });
        for (const pr of per) {
          if (pr.free || !pr.cents) { marks.push({ mf: r.id, to: pr.to, name: r.person_name, fee: r.fee_name }); continue; }   // beitragsfrei bzw. 0 € (befreit): kein Posten, nur „abgerechnet bis“ vorrücken
          const age = fees.ageAt(r.birth_date, pr.from);
          if (age != null && ((r.age_max != null && age > r.age_max) || (r.age_min != null && age < r.age_min)) && !(sh.ageNoticeFor && sh.ageNoticeFor(r.id)))
            warnings.push({ member_id: r.member_id, text: `${r.person_name} ist am ${deD(pr.from)} ${age} Jahre – „${r.fee_name}“ gilt für ${r.age_min != null ? r.age_min : 0}–${r.age_max != null ? r.age_max : '…'} Jahre.` });
          if (r.family) {
            // Familienbeitrag deckt das Oberhaupt und die Angehörigen der Familienmitgliedschaft (family_of) ab – nicht die Zahlergruppe.
            // Ein Partner (zweiter Erwachsener) ist ausdrücklich zugeordnet; wer als Kind 19 wird, bleibt ohne Beitrag, bis ihm eine eigene Beitragsart zugewiesen ist (keine stille Umstellung).
            const max = store.childMax();
            const fam = db.prepare('SELECT m.name, p.birth_date FROM mv_person p JOIN members m ON m.id = p.member_id WHERE p.family_of = ? AND p.member_id != ? AND m.deleted = 0 AND (p.exit_date IS NULL OR p.exit_date >= ?) ORDER BY p.birth_date IS NULL, p.birth_date').all(r.member_id, r.member_id, pr.from);
            let adults = 0;
            for (const d of fam) {
              const a = fees.ageAt(d.birth_date, pr.from);
              if (a == null || a > max) adults++;
              if (a === max + 1 && !famWarned.has(`${d.name}|${pr.from}`)) { famWarned.add(`${d.name}|${pr.from}`); warnings.push({ member_id: r.member_id, text: `${d.name} ist am ${deD(pr.from)} ${a} Jahre – nicht mehr im Familientarif von ${r.person_name}, bitte eigene Beitragsart zuweisen.` }); }
              else if (a != null && a > max + 1 && adults > 1) warnings.push({ member_id: r.member_id, text: `${d.name} ist am ${deD(pr.from)} ${a} Jahre – neben ${r.person_name} ist schon ein weiterer Erwachsener in der Familienmitgliedschaft (erlaubt: Oberhaupt und ein Partner). Bitte eigene Beitragsart zuweisen.` });
            }
          }
          positions.push({ key: `f${r.id}-${pr.from}`, kind: r.interval === 'einmalig' ? 'aufnahme' : 'beitrag', member_id: payer, for_member_id: r.member_id, member_fee_id: r.id,
            text: `${r.fee_name} ${fees.periodText(pr.from, pr.to)}${pr.partial && r.prorate !== 'voll' ? ' (anteilig)' : ''}${payer !== r.member_id ? ` – ${r.person_name}` : ''}`,
            period_from: pr.from, period_to: pr.to, cents: pr.cents, due_date: pr.from, payer_name: payerName(payer), for_name: r.person_name, payment: pp.payment || 'lastschrift' });
        }
      }
      // Zusatzbeiträge der Abteilungen: je Person, die der Abteilung angehört, nach Alter (auch in Familien – beim Hauptzahler)
      const zfees = db.prepare("SELECT * FROM mv_fee WHERE kind = 'zusatz' AND active = 1 AND department_id IS NOT NULL ORDER BY department_id, COALESCE(age_min, 0), COALESCE(age_max, 999)").all();
      if (zfees.length) {
        const byDept = new Map();
        for (const f of zfees) { if (!byDept.has(f.department_id)) byDept.set(f.department_id, []); byDept.get(f.department_id).push(f); }
        const allZ = db.prepare("SELECT * FROM mv_fee WHERE kind = 'zusatz'").all();
        const hold = sh.ageHold();   // offene Altersstufen-Hinweise: bisherige Stufe läuft weiter
        const mds = db.prepare(`SELECT md.*, d.name AS dept_name, p.birth_date, p.exit_date AS p_exit, p.entry_date AS p_entry, m.name AS person_name
          FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id JOIN mv_person p ON p.member_id = md.member_id JOIN members m ON m.id = md.member_id
          WHERE m.deleted = 0 AND p.anonymized_at IS NULL AND md.fee_free = 0 AND NOT EXISTS (SELECT 1 FROM mv_change x WHERE x.member_id = m.id AND x.kind = 'eintritt' AND x.status = 'offen')`).all();
        for (const md of mds) {
          const list = byDept.get(md.department_id);
          if (!list && !md.fee_id) continue;
          if (o.dept && md.department_id !== Number(o.dept)) continue;
          const pick = day => {
            if (md.fee_id) return allZ.find(f => f.id === md.fee_id) || null;
            const f = fees.pickByAge(list, md.birth_date, day).fee;
            const h = hold.get(md.id);
            return h && f && f.id === h.to_fee_id ? allZ.find(x => x.id === h.from_fee_id) || f : f;
          };
          if (!md.fee_id && !isDate(md.birth_date) && list && list.some(f => f.age_min != null || f.age_max != null))
            warnings.push({ member_id: md.member_id, text: `${md.person_name}: Geburtsdatum fehlt – für „${md.dept_name}“ wird der Erwachsenen-Zusatzbeitrag berechnet.` });
          const start = [md.entry_date, md.p_entry].filter(isDate).sort().reverse()[0] || store.periodStart(today(), (list && list[0] || {}).interval || 'jahr');
          const base = pick(start) || (list || [])[0];
          if (!base) continue;
          const UNIT = 1200000;
          const per = fees.periods({ start_date: start, end_date: md.exit_date, booked_until: md.booked_until, cents: UNIT, interval: base.interval, prorate: base.prorate }, until, { limit: md.p_exit, yearStart });
          const payer = store.payerOf(md.member_id);
          const pp = personOf(payer);
          if (o.payment && (pp.payment || 'lastschrift') !== o.payment) continue;
          for (const pr of per) {
            const f = pick(pr.from);
            if (!f && md.fee_id) { warnings.push({ member_id: md.member_id, text: `${md.person_name}: den fest gewählten Zusatzbeitrag der Abteilung „${md.dept_name}“ gibt es nicht mehr – bitte im Mitglied neu wählen.` }); break; }
            if (!f && !isDate(md.birth_date)) { warnings.push({ member_id: md.member_id, text: `${md.person_name}: Geburtsdatum fehlt – für „${md.dept_name}“ lässt sich keine Altersstufe bestimmen. Bitte Geburtsdatum eintragen oder im Mitglied einen Beitrag wählen.` }); break; }
            if (!f) {   // keine Altersstufe passt (z. B. nur „ab 19“) → in diesem Zeitraum beitragsfrei, später greift die passende Stufe
              marks.push({ md: md.id, to: pr.to, name: md.person_name, fee: `${md.dept_name} (Alter ${fees.ageAt(md.birth_date, pr.from) ?? '?'})`, age: true }); continue;
            }
            if (o.fee && f.id !== Number(o.fee)) continue;
            if (pr.free) { marks.push({ md: md.id, to: pr.to, name: md.person_name, fee: f.name }); continue; }
            const cents = Math.round(f.cents * pr.cents / UNIT);
            if (!cents) { marks.push({ md: md.id, to: pr.to, name: md.person_name, fee: f.name }); continue; }
            positions.push({ key: `z${md.id}-${pr.from}`, kind: 'beitrag', member_id: payer, for_member_id: md.member_id, member_dept_id: md.id,
              text: `${f.name} ${fees.periodText(pr.from, pr.to)}${pr.partial && f.prorate === 'anteilig' ? ' (anteilig)' : ''}${payer !== md.member_id ? ` – ${md.person_name}` : ''}`,
              period_from: pr.from, period_to: pr.to, cents, due_date: pr.from, payer_name: payerName(payer), for_name: md.person_name, payment: pp.payment || 'lastschrift' });
          }
        }
      }
      const mFree = marks.filter(x => !x.age), mAge = marks.filter(x => x.age);
      const names = a => `${[...new Set(a.map(x => x.name))].slice(0, 6).join(', ')}${a.length > 6 ? ' …' : ''}`;
      if (mFree.length) info.push(`${mFree.length} Zeitraum/Zeiträume im Eintrittsjahr beitragsfrei (${names(mFree)}) – wird als abgerechnet vermerkt.`);
      if (mAge.length) info.push(`${mAge.length} Zeitraum/Zeiträume ohne Zusatzbeitrag, weil keine Altersstufe passt (${names(mAge)}) – wird als abgerechnet vermerkt.`);
      if (sh.ageOpen) { const n = sh.ageScan ? sh.ageScan() : sh.ageOpen(); if (n) info.push(`${n} ${n === 1 ? 'Altersstufen-Hinweis' : 'Altersstufen-Hinweise'} offen – bis zur Entscheidung läuft der bisherige Beitrag weiter (Beiträge → Altersstufen).`); }
      // Familienmitgliedschaft ohne Deckung: das Oberhaupt hat (am Stichtag) keinen Familienbeitrag mehr
      for (const r of db.prepare(`SELECT m.name, p.family_of, h.name AS head_name FROM mv_person p JOIN members m ON m.id = p.member_id JOIN members h ON h.id = p.family_of
          WHERE p.family_of IS NOT NULL AND m.deleted = 0 AND p.anonymized_at IS NULL AND (p.exit_date IS NULL OR p.exit_date >= ?)`).all(until)) {
        if (!store.familyFee(r.family_of)) warnings.push({ member_id: r.family_of, text: `${r.name} gehört zur Familienmitgliedschaft von ${r.head_name} – ${r.head_name} hat aber keinen Familienbeitrag (mehr). Bitte Familienbeitrag zuweisen oder die Zuordnung lösen.` });
      }
      // ohne Beitrag (Hinweis) – wer über eine Familienmitgliedschaft abgedeckt ist, braucht keinen eigenen
      const noFee = db.prepare(`SELECT m.name FROM members m JOIN mv_person p ON p.member_id = m.id WHERE m.kind = 'mitglied' AND m.deleted = 0 AND p.anonymized_at IS NULL
        AND (p.exit_date IS NULL OR p.exit_date >= ?) AND p.payer_id IS NULL AND p.family_of IS NULL AND p.status != 'ehren' AND NOT EXISTS (SELECT 1 FROM mv_member_fee mf WHERE mf.member_id = m.id AND (mf.end_date IS NULL OR mf.end_date >= ?))`).all(until, until);
      if (noFee.length) info.push(`${noFee.length} ${noFee.length === 1 ? 'Mitglied' : 'Mitglieder'} ohne Beitrag: ${noFee.slice(0, 8).map(x => x.name).join(', ')}${noFee.length > 8 ? ' …' : ''}`);
      // Positionen anderer Module (z. B. Arbeitsstunden)
      if (o.extra !== false) {
        for (const h of await C.callHooks('beitragsPositionen', { until })) {
          for (const x of Array.isArray(h.result) ? h.result : []) {
            if (!x || !x.member_id || !Number.isInteger(x.cents) || !x.ext_key) continue;
            if (db.prepare('SELECT 1 FROM mv_charge WHERE ext_key = ?').get(String(x.ext_key))) continue;
            const payer = store.payerOf(x.member_id); const pp = personOf(payer);
            if (o.payment && (pp.payment || 'lastschrift') !== o.payment) continue;
            positions.push({ key: 'x' + x.ext_key, kind: one(x.kind, 20) || 'sonstiges', member_id: payer, for_member_id: x.member_id, ext_key: String(x.ext_key).slice(0, 80), text: one(x.text, 140), period_from: x.period_from || null, period_to: x.period_to || null,
              cents: x.cents, due_date: isDate(x.due_date) ? x.due_date : until, payer_name: payerName(payer), for_name: payerName(x.member_id), payment: pp.payment || 'lastschrift', module: h.name });
          }
        }
      }
    }
    let drinks = null;
    if ((o.drinks || o.onlyDrinks) && C.drinks.active()) {
      const d = C.drinks.open();
      drinks = { asOf: d.asOf, upTo: d.upTo };
      const notMembers = [];
      for (const r of d.rows) {
        if (!r.total_cents) continue;
        const p = r.kind === 'mitglied' ? personOf(r.id) : {};
        // nur echte Mitglieder (mit Mitgliedsdaten) – Mannschaften, „Kein Mitglied“ und Konten ohne Daten zahlen unter Verkauf › Abrechnung
        if (!p.member_id) { notMembers.push({ id: r.id, name: lastFirst(r.name, r.kind), kind: r.kind, cents: r.total_cents }); continue; }
        if (p.anonymized_at) continue;
        const payer = p.drinks_to_payer === 0 ? r.id : store.payerOf(r.id);
        const pp = personOf(payer);
        if (o.payment && (pp.payment || 'lastschrift') !== o.payment) continue;
        positions.push({ key: 'd' + r.id, kind: 'getraenke', member_id: payer, for_member_id: r.id, drinks_member: r.id, text: `Verkauf bis ${deD(d.asOf.slice(0, 10))}${payer !== r.id ? ` – ${r.name}` : ''}`,
          period_from: r.since ? r.since.slice(0, 10) : null, period_to: d.asOf.slice(0, 10), cents: r.total_cents, due_date: isDate(o.due) ? o.due : until, payer_name: payerName(payer), for_name: r.name, payment: pp.payment || 'lastschrift' });
      }
      if (notMembers.length) info.push(`Verkaufskonten ohne Mitgliedsdaten (Mannschaften, „Kein Mitglied“) bleiben offen – bezahlt wird unter Verkauf › Abrechnung: ${notMembers.slice(0, 6).map(x => `${x.name} (${euro(x.cents)})`).join(', ')}${notMembers.length > 6 ? ' …' : ''}`);
      drinks.notMembers = notMembers;
    }
    positions.sort((a, b) => nameKey(a.payer_name, 'mitglied').localeCompare(nameKey(b.payer_name, 'mitglied'), 'de') || a.kind.localeCompare(b.kind) || String(a.period_from).localeCompare(String(b.period_from)));
    const byPayer = new Set(positions.map(p => p.member_id));
    return { until, positions, warnings, info, drinks, marks, totals: { count: positions.length, payers: byPayer.size, cents: positions.reduce((s, p) => s + p.cents, 0),
      byKind: positions.reduce((m, p) => ({ ...m, [p.kind]: (m[p.kind] || 0) + p.cents }), {}) } };
  }

  admin.post('/runs/preview', PF, ar(async (req, res) => res.json(await preview(req.body || {}))));
  /** Lauf aus einer Vorschau anlegen (Posten, „abgerechnet bis“, Verkaufskonten) → { run, count, cents, skipped } – auch innerhalb einer äußeren Transaktion */
  function makeRun(b, pv, pos, user) {
    let runId, drinkBatch = null, created = 0, cents = 0, skippedTotal = 0;
    db.transaction(() => {
      runId = Number(db.prepare('INSERT INTO mv_run(kind, until_date, filters, by_user) VALUES (?,?,?,?)').run(b.onlyDrinks ? 'getraenke' : 'beitrag', pv.until, '{}', user).lastInsertRowid);
      const prev = {}, prevMd = {};
      const ins = db.prepare(`INSERT INTO mv_charge(member_id, for_member_id, kind, text, period_from, period_to, cents, due_date, run_id, member_fee_id, ext_key, created_by, member_dept_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const bumpMf = (id, to) => { const mf = db.prepare('SELECT booked_until FROM mv_member_fee WHERE id = ?').get(id); if (!mf) return; if (!(id in prev)) prev[id] = mf.booked_until; if (!mf.booked_until || to > mf.booked_until) db.prepare('UPDATE mv_member_fee SET booked_until = ? WHERE id = ?').run(to, id); };
      const bumpMd = (id, to) => { const md = db.prepare('SELECT booked_until FROM mv_member_department WHERE id = ?').get(id); if (!md) return; if (!(id in prevMd)) prevMd[id] = md.booked_until; if (!md.booked_until || to > md.booked_until) db.prepare('UPDATE mv_member_department SET booked_until = ? WHERE id = ?').run(to, id); };
      for (const mk of pv.marks || []) { if (mk.mf) bumpMf(mk.mf, mk.to); if (mk.md) bumpMd(mk.md, mk.to); }
      // Getränke zuerst abrechnen (Kern), mit dem Stand der Vorschau – Beträge kommen aus der Abrechnung selbst
      const drinkPos = pos.filter(p => p.kind === 'getraenke');
      let perMember = {};
      if (drinkPos.length && pv.drinks) {
        const r = C.drinks.settle(drinkPos.map(p => p.drinks_member), pv.drinks.asOf, pv.drinks.upTo, user, `Mitgliederverwaltung: Lauf ${runId}`, 'mv-');
        drinkBatch = r.batch; perMember = r.perMember;
      }
      // Dublettenschutz: Die Vorschau entsteht vor der Transaktion (Hooks sind asynchron). Läuft ein zweiter Lauf parallel,
      // kann derselbe Zeitraum schon gebucht sein – deshalb hier, innerhalb der Transaktion, noch einmal frisch prüfen:
      // Zeitraum bereits bis period_from abgerechnet (booked_until) bzw. ext_key schon vorhanden → Position überspringen.
      const mfBooked = db.prepare('SELECT booked_until FROM mv_member_fee WHERE id = ?'), mdBooked = db.prepare('SELECT booked_until FROM mv_member_department WHERE id = ?');
      const extSeen = db.prepare('SELECT 1 FROM mv_charge WHERE ext_key = ?');
      const covered = (row, from) => row && row.booked_until && from && row.booked_until >= from;
      const alreadyBooked = p => (p.member_fee_id && !(p.member_fee_id in prev) && covered(mfBooked.get(p.member_fee_id), p.period_from))
        || (p.member_dept_id && !(p.member_dept_id in prevMd) && covered(mdBooked.get(p.member_dept_id), p.period_from))
        || (p.ext_key && extSeen.get(p.ext_key));
      let skipped = 0;
      for (const p of pos) {
        let c = p.cents;
        if (p.kind === 'getraenke') { c = perMember[p.drinks_member]; if (!c) continue; }
        if (alreadyBooked(p)) { skipped++; continue; }
        ins.run(p.member_id, p.for_member_id, p.kind, p.text, p.period_from, p.period_to, c, p.due_date, runId, p.member_fee_id || null, p.ext_key || null, user, p.member_dept_id || null);
        if (p.member_fee_id) bumpMf(p.member_fee_id, p.period_to);
        if (p.member_dept_id) bumpMd(p.member_dept_id, p.period_to);
        created++; cents += c;
      }
      skippedTotal = skipped;
      db.prepare('UPDATE mv_run SET count = ?, cents = ?, drinks_batch = ?, filters = ? WHERE id = ?').run(created, cents, drinkBatch, JSON.stringify({ prev, prevMd, until: pv.until, drinks: Boolean(b.drinks || b.onlyDrinks), onlyDrinks: Boolean(b.onlyDrinks) }), runId);
    })();
    return { run: runId, count: created, cents, skipped: skippedTotal };
  }
  admin.post('/runs', PF, ar(async (req, res) => {
    const b = req.body || {};
    const pv = await preview(b);
    const skip = new Set(Array.isArray(b.skip) ? b.skip.map(String) : []);
    const pos = pv.positions.filter(p => !skip.has(p.key));
    if (!pos.length && !(pv.marks || []).length) return bad(res, pv.positions.length ? 'Alle Positionen abgewählt – es gibt nichts zu buchen.' : 'Keine Positionen – es ist alles schon abgerechnet.');
    const r = makeRun(b, pv, pos, uname(req));
    C.audit(req.user, b.onlyDrinks ? 'Verkaufs-Einzug vorbereitet' : 'Beitragslauf', `${r.count} Positionen, ${euro(r.cents)} (bis ${deD(pv.until)})${r.skipped ? `, ${r.skipped} schon gebucht übersprungen` : ''}`);
    res.json({ ok: true, ...r });
  }));
  admin.get('/runs', PF, (req, res) => res.json(db.prepare(`SELECT r.*, (SELECT COUNT(*) FROM mv_charge c WHERE c.run_id = r.id AND c.status != 'offen') AS done FROM mv_run r ORDER BY r.id DESC LIMIT 50`).all()
    .map(r => ({ ...r, filters: undefined, undo: r.done === 0 }))));
  const fachlich = msg => Object.assign(new Error(msg), { fachlich: true });
  /** Lauf zurücknehmen: Posten löschen, „abgerechnet bis“ und Verkaufskonten auf den Stand davor – wirft bei fachlichem Hindernis (e.fachlich) */
  function undoRun(r) {
    if (db.prepare("SELECT 1 FROM mv_charge WHERE run_id = ? AND status != 'offen'").get(r.id)) throw fachlich('Aus diesem Lauf wurde schon etwas eingezogen, bezahlt oder storniert – Zurücknehmen geht nicht mehr. Einzelne Posten können storniert werden.');
    const f = JSON.parse(r.filters || '{}');
    // Getränkeabrechnung und Posten in einer Transaktion zurücknehmen – schlägt eines fehl, bleibt alles wie es war
    // (sonst wären die Getränke wieder offen, die Posten aber noch da → beim nächsten Lauf doppelt)
    db.transaction(() => {
      if (r.drinks_batch) { const u = C.drinks.unsettle(r.drinks_batch); if (!u.ok) throw fachlich(u.error); }
      db.prepare('DELETE FROM mv_charge WHERE run_id = ?').run(r.id);
      // Stand vor diesem Lauf – aber nie hinter das zurück, was spätere Läufe schon abgerechnet haben (sonst doppelt)
      const later = (col, id) => (db.prepare(`SELECT MAX(period_to) t FROM mv_charge WHERE ${col} = ? AND status != 'storniert'`).get(id) || {}).t || null;
      const keep = (val, t) => (t && (!val || t > val) ? t : val);
      for (const [mfId, val] of Object.entries(f.prev || {})) db.prepare('UPDATE mv_member_fee SET booked_until = ? WHERE id = ?').run(keep(val, later('member_fee_id', int(mfId))), int(mfId));
      for (const [mdId, val] of Object.entries(f.prevMd || {})) db.prepare('UPDATE mv_member_department SET booked_until = ? WHERE id = ?').run(keep(val, later('member_dept_id', int(mdId))), int(mdId));
      db.prepare('DELETE FROM mv_run WHERE id = ?').run(r.id);
    })();
  }
  admin.delete('/runs/:id', PF, (req, res) => {
    const r = db.prepare('SELECT * FROM mv_run WHERE id = ?').get(int(req.params.id));
    if (!r) return bad(res, 'Nicht gefunden.', 404);
    try { undoRun(r); } catch (e) { if (e.fachlich) return bad(res, e.message); throw e; }
    C.audit(req.user, 'Beitragslauf zurückgenommen', `Lauf ${r.id}: ${r.count} Positionen, ${euro(r.cents)}`);
    res.json({ ok: true });
  });

  /* ======================================================= offene Posten */
  admin.get('/charges', PF, (req, res) => {
    const q = req.query, where = [], args = [];
    if (q.status && q.status !== 'alle') { where.push('c.status = ?'); args.push(q.status); }
    if (q.kind) { where.push('c.kind = ?'); args.push(q.kind); }
    if (q.member) { where.push('(c.member_id = ? OR c.for_member_id = ?)'); args.push(int(q.member), int(q.member)); }
    if (q.collection) { where.push('c.collection_id = ?'); args.push(int(q.collection)); }
    if (q.run) { where.push('c.run_id = ?'); args.push(int(q.run)); }
    if (q.overdue === '1') { where.push("c.status = 'offen' AND c.due_date < ?"); args.push(today()); }
    const rows = db.prepare(`SELECT c.*, m.name AS payer_name, f.name AS for_name, p.payment, p.member_no FROM mv_charge c JOIN members m ON m.id = c.member_id LEFT JOIN members f ON f.id = c.for_member_id
      LEFT JOIN mv_person p ON p.member_id = c.member_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.due_date DESC, name_key(m.name, m.kind), c.id LIMIT 2000`).all(...args);
    res.json({ rows, sum: rows.reduce((s, r) => s + r.cents, 0) });
  });
  admin.post('/charges', PF, (req, res) => {
    const b = req.body || {};
    const p = personRow(int(b.member_id)); if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    const text = one(b.text, 140), cents = Math.round(Number(b.cents));
    if (text.length < 3) return bad(res, 'Bitte einen Buchungstext eintragen.');
    if (!Number.isFinite(cents) || cents === 0 || Math.abs(cents) > 10000000) return bad(res, 'Bitte einen Betrag eintragen (Gutschrift mit Minus).');
    if (!isDate(b.due_date)) return bad(res, 'Bitte das Fälligkeitsdatum angeben.');
    const payer = b.direct ? p.id : store.payerOf(p.id);
    const id = Number(db.prepare('INSERT INTO mv_charge(member_id, for_member_id, kind, text, cents, due_date, created_by) VALUES (?,?,?,?,?,?,?)')
      .run(payer, p.id, ['sonstiges', 'aufnahme', 'getraenke', 'beitrag'].includes(b.kind) ? b.kind : 'sonstiges', text, cents, b.due_date, uname(req)).lastInsertRowid);
    C.audit(req.user, 'Forderung angelegt', `${p.name}: ${text} ${euro(cents)}`);
    res.json({ id });
  });
  const chargeOr404 = (req, res) => { const c = db.prepare('SELECT * FROM mv_charge WHERE id = ?').get(int(req.params.id)); if (!c) bad(res, 'Nicht gefunden.', 404); return c; };
  admin.put('/charges/:id', PF, (req, res) => {
    const c = chargeOr404(req, res); if (!c) return;
    if (c.status !== 'offen') return bad(res, 'Nur offene Posten lassen sich ändern.');
    const b = req.body || {};
    const text = b.text !== undefined ? one(b.text, 140) : c.text, cents = b.cents !== undefined ? Math.round(Number(b.cents)) : c.cents, due = b.due_date !== undefined ? b.due_date : c.due_date;
    if (text.length < 3 || !Number.isFinite(cents) || cents === 0 || !isDate(due)) return bad(res, 'Bitte Text, Betrag und Fälligkeit prüfen.');
    db.prepare('UPDATE mv_charge SET text = ?, cents = ?, due_date = ? WHERE id = ?').run(text, cents, due, c.id);
    C.audit(req.user, 'Forderung geändert', `${payerName(c.member_id)}: ${c.text} ${euro(c.cents)} → ${text} ${euro(cents)}`);
    res.json({ ok: true });
  });
  admin.post('/charges/:id/pay', PF, (req, res) => {
    const c = chargeOr404(req, res); if (!c) return;
    if (c.status !== 'offen') return bad(res, 'Dieser Posten ist nicht offen.');
    const b = req.body || {};
    const via = ['bar', 'ueberweisung', 'lastschrift', 'verrechnet'].includes(b.via) ? b.via : 'ueberweisung';
    const date = isDate(b.date) ? b.date : today();
    const paid = b.cents !== undefined ? Math.round(Number(b.cents)) : c.cents;
    if (!Number.isFinite(paid) || paid <= 0 && c.cents > 0) return bad(res, 'Ungültiger Betrag.');
    if (c.cents > 0 && paid > c.cents) return bad(res, `Der Betrag ist höher als offen (${euro(c.cents)}) – den Mehrbetrag bitte als Gutschrift (Minus-Betrag) erfassen.`);
    db.transaction(() => {
      if (c.cents > 0 && paid < c.cents) {   // Teilzahlung: Rest bleibt als neuer Posten offen
        db.prepare('INSERT INTO mv_charge(member_id, for_member_id, kind, text, period_from, period_to, cents, due_date, run_id, created_by, note, member_fee_id, member_dept_id, invoice_no, dunning_level, dunned_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(c.member_id, c.for_member_id, c.kind, `Rest: ${c.text}`.slice(0, 140), c.period_from, c.period_to, c.cents - paid, c.due_date, c.run_id, uname(req), `Teilzahlung ${euro(paid)} am ${deD(date)}`, c.member_fee_id, c.member_dept_id, c.invoice_no, c.dunning_level, c.dunned_at);
        db.prepare("UPDATE mv_charge SET cents = ?, status = 'bezahlt', paid_at = ?, paid_via = ? WHERE id = ?").run(paid, date, via, c.id);
      } else db.prepare("UPDATE mv_charge SET status = 'bezahlt', paid_at = ?, paid_via = ? WHERE id = ?").run(date, via, c.id);
    })();
    C.audit(req.user, 'Zahlung erfasst', `${payerName(c.member_id)}: ${c.text} ${euro(paid)} (${via})`);
    res.json({ ok: true });
  });
  admin.post('/charges/:id/cancel', PF, (req, res) => {
    const c = chargeOr404(req, res); if (!c) return;
    if (!['offen', 'bezahlt'].includes(c.status)) return bad(res, 'Posten in einem laufenden Einzug zuerst über den Einzug klären (Rücklastschrift oder verwerfen).');
    const reason = one((req.body || {}).reason, 120);
    if (reason.length < 3) return bad(res, 'Bitte kurz begründen.');
    // Verkaufs-Posten aus einem Lauf: die Verkaufsbuchungen wieder öffnen, sonst blieben sie „abgerechnet“, ohne dass etwas eingezogen wird
    let reopened = 0;
    if (c.kind === 'getraenke' && c.run_id && c.status === 'offen' && C.drinks.active()) {
      const run = db.prepare('SELECT drinks_batch FROM mv_run WHERE id = ?').get(c.run_id);
      if (run && run.drinks_batch) { const r = C.drinks.reopen(run.drinks_batch, c.for_member_id || c.member_id); if (!r.ok) return bad(res, r.error); reopened = r.n; }
    }
    db.prepare("UPDATE mv_charge SET status = 'storniert', note = ? WHERE id = ?").run(`storniert von ${uname(req)}: ${reason}${reopened ? ' – Verkaufsbuchungen wieder offen' : ''}`, c.id);
    if (c.member_fee_id && c.period_from) {   // Beitrag storniert → Zeitraum kann neu abgerechnet werden, falls es der letzte war
      const mf = db.prepare('SELECT booked_until FROM mv_member_fee WHERE id = ?').get(c.member_fee_id);
      if (mf && mf.booked_until === c.period_to && (req.body || {}).rebill) db.prepare('UPDATE mv_member_fee SET booked_until = ? WHERE id = ?').run(fees.addDays(c.period_from, -1), c.member_fee_id);
    }
    if (c.member_dept_id && c.period_from && (req.body || {}).rebill) {
      const md = db.prepare('SELECT booked_until FROM mv_member_department WHERE id = ?').get(c.member_dept_id);
      if (md && md.booked_until === c.period_to) db.prepare('UPDATE mv_member_department SET booked_until = ? WHERE id = ?').run(fees.addDays(c.period_from, -1), c.member_dept_id);
    }
    C.audit(req.user, 'Forderung storniert', `${payerName(c.member_id)}: ${c.text} ${euro(c.cents)} – ${reason}`);
    res.json({ ok: true });
  });

  /* ======================================================= SEPA-Einzug */
  /** kind: nur Posten dieser Art (Verkaufs-Einzug: 'getraenke'); extra: noch nicht angelegte Posten (Vorschau aus den Verkaufskonten) */
  function collectionPlan(date, { kind = null, extra = [] } = {}) {
    const day = isDate(date) ? date : today();
    const k = kind ? ' AND c.kind = ?' : '', ka = kind ? [kind] : [];
    const open = [...db.prepare(`SELECT c.* FROM mv_charge c WHERE c.status = 'offen' AND c.collection_id IS NULL AND c.due_date <= ?${k} ORDER BY c.member_id, c.due_date, c.id`).all(day, ...ka), ...extra];
    // offene Posten, die erst nach dem Einzugstag fällig sind, nicht still weglassen, sondern melden
    const later = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(c.cents),0) cents, MIN(c.due_date) first FROM mv_charge c WHERE c.status = 'offen' AND c.collection_id IS NULL AND c.due_date > ?${k}`).get(day, ...ka);
    const groups = new Map();
    for (const c of open) { if (!groups.has(c.member_id)) groups.set(c.member_id, []); groups.get(c.member_id).push(c); }
    const ok = [], problems = [], other = [], zero = [];
    for (const [payer, list] of groups) {
      const p = personOf(payer);
      const sum = list.reduce((s, c) => s + c.cents, 0);
      const name = payerName(payer);
      // Forderung und Gutschrift gleichen sich genau aus (z. B. Verkauf 3 € und Storno −3 €): nichts einzuziehen – wird beim Einzug verrechnet
      if (sum === 0) { zero.push({ member_id: payer, name, count: list.length, charges: list.map(c => c.id) }); continue; }
      if ((p.payment || 'lastschrift') !== 'lastschrift') { other.push({ member_id: payer, name, payment: p.payment, cents: sum, count: list.length }); continue; }
      const b = bankRow(payer); const ms = mandateState(b);
      if (!ms.ok) { problems.push({ member_id: payer, name, reason: ms.reason, cents: sum, count: list.length }); continue; }
      // Sicherheitsnetz für Altdaten: Unterschrift nach dem Fälligkeitstag würde die Bank ablehnen (DtOfSgntr > ReqdColltnDt)
      if (b.mandate_date > day) { problems.push({ member_id: payer, name, reason: `Mandat erst am ${deD(b.mandate_date)} unterschrieben – nach dem Einzugstag`, cents: sum, count: list.length }); continue; }
      if (sum < 0) { problems.push({ member_id: payer, name, reason: `Guthaben ${euro(-sum)} – nichts einzuziehen`, cents: sum, count: list.length }); continue; }
      ok.push({ member_id: payer, name, member_no: p.member_no, cents: sum, count: list.length, charges: list.map(c => c.id), texts: list.map(c => c.text), seq: b.mandate_first_used ? 'RCUR' : 'FRST',
        holder: b.holder || name, iban: b.iban, bic: b.bic, mandate_ref: b.mandate_ref, mandate_date: b.mandate_date, masked: sepa.maskIban(b.iban) });
    }
    const earliest = sepa.earliestCollection(today(), parseInt(S('prenotify_days', '14'), 10) || 14);
    return { date: day, ok, problems, other, zero, later: later.n ? later : null, earliest, tooEarly: day < earliest, bankDay: sepa.isBankDay(day), total: ok.reduce((s, x) => s + x.cents, 0),
      ready: Boolean(S('creditor_id') && store.account().iban), bicMissing: Boolean(store.account().iban && !store.account().bic),
      creditor: { ci: S('creditor_id'), name: S('creditor_name') || C.getSetting('club_name', ''), iban: sepa.maskIban(store.account().iban), account: store.account().name } };
  }
  /** Verwendungszweck: Positionen zusammengefasst, max. 140 Zeichen */
  function remittance(x) {
    const uniq = [...new Set(x.texts)];
    let t = uniq.join(', ');
    if (t.length > 120) t = `${uniq.length} Posten: ` + uniq.map(s => s.split(' ')[0]).filter((v, i, a) => a.indexOf(v) === i).join(', ');
    return `${t}${x.member_no ? ' Mitgl.-Nr. ' + x.member_no : ''}`.slice(0, 140);
  }
  admin.post('/collections/preview', PF, (req, res) => res.json(collectionPlan((req.body || {}).date)));
  /** Einzug prüfen wie beim Erstellen – Text des Hindernisses (mit Status) oder null */
  function collectionBlocked(plan, force) {
    if (!plan.ready) return [400, 'Bitte zuerst Gläubiger-ID und Vereinskonto eintragen (Mitglieder → Einstellungen → SEPA).'];
    if (!plan.bankDay) return [400, `Der ${deD(plan.date)} ist kein Bankarbeitstag – bitte einen anderen Tag wählen.`];
    if (plan.tooEarly && !force) return [409, `Frühester Termin ist der ${deD(plan.earliest)} (Vorabinformation ${S('prenotify_days', '14')} Tage + Vorlauf der Bank).`];
    return null;
  }
  admin.post('/collections', PF, (req, res) => {
    const b = req.body || {};
    const plan = collectionPlan(b.date);
    const blocked = collectionBlocked(plan, b.force);
    if (blocked) return res.status(blocked[0]).json({ error: blocked[1], earliest: plan.earliest });
    const skip = new Set(Array.isArray(b.skip) ? b.skip.map(Number) : []);
    const txs = plan.ok.filter(x => !skip.has(x.member_id));
    if (!txs.length) return bad(res, 'Keine Lastschriften fällig.');
    const id = makeCollection(plan, txs, plan.zero.flatMap(z => z.charges), uname(req));
    C.audit(req.user, 'SEPA-Einzug erstellt', `${txs.length} Lastschriften, ${euro(txs.reduce((s, x) => s + x.cents, 0))} zum ${deD(plan.date)}`);
    res.json({ ok: true, id });
  });
  /** Einzug mit SEPA-Datei anlegen → id (kind 'getraenke' = Verkaufs-Einzug) */
  function makeCollection(plan, txs, zeroCharges, user, kind = null) {
    let id;
    db.transaction(() => {
      id = Number(db.prepare("INSERT INTO mv_collection(collection_date, msg_id, by_user, kind) VALUES (?, '', ?, ?)").run(plan.date, user, kind).lastInsertRowid);
      const stamp = nowTs().replace(/\D/g, '').slice(0, 12);
      const msgId = `CW${stamp}-${id}`;
      const prevMandates = {};
      const batches = ['FRST', 'RCUR'].map(seq => ({ id: `${msgId}-${seq}`, seqTp: seq, date: plan.date, txs: txs.filter(x => x.seq === seq).map(x => ({
        e2e: `CW${id}-${x.member_id}`, cents: x.cents, mandateId: x.mandate_ref, mandateDate: x.mandate_date, name: x.holder, iban: x.iban, bic: x.bic, text: remittance(x) })) }));
      const xmlStr = sepa.buildPain008({ msgId, created: sepa.isoLocal(), initiator: plan.creditor.name, creditor: { name: plan.creditor.name, iban: store.account().iban, bic: store.account().bic, ci: S('creditor_id') }, batches });
      for (const x of txs) {
        const bk = bankRow(x.member_id);
        prevMandates[x.member_id] = { first: bk.mandate_first_used, last: bk.mandate_last_used };
        db.prepare('UPDATE mv_bank SET mandate_first_used = COALESCE(mandate_first_used, ?), mandate_last_used = ? WHERE member_id = ?').run(plan.date, plan.date, x.member_id);
        db.prepare(`UPDATE mv_charge SET status = 'eingezogen', collection_id = ? WHERE id IN (${x.charges.map(() => '?').join(',')})`).run(id, ...x.charges);
      }
      for (const cid of zeroCharges) db.prepare("UPDATE mv_charge SET status = 'bezahlt', paid_at = ?, paid_via = 'verrechnet', collection_id = ?, note = ? WHERE id = ? AND status = 'offen'").run(plan.date, id, `verrechnet (Summe 0 €) mit Einzug ${id}`, cid);   // Verwerfen des Einzugs öffnet sie wieder
      db.prepare('UPDATE mv_collection SET msg_id = ?, count = ?, cents = ?, xml = ?, note = ? WHERE id = ?').run(msgId, txs.length, txs.reduce((s, x) => s + x.cents, 0), xmlStr, JSON.stringify({ prevMandates }), id);
    })();
    return id;
  }

  /* ======================================================= Verkaufs-Einzug in einem Ablauf
     Aus Verkauf › Abrechnung und aus „Beiträge“: offene Verkaufskonten + schon offene Verkaufs-Posten → Lauf → Einzug mit SEPA-Datei.
     Nur Verkauf (getrennt von Beiträgen). Wer nicht per Lastschrift zahlen kann, bleibt auf dem Verkaufskonto offen. */
  async function drinksPlan(date) {
    const day = isDate(date) ? date : sepa.earliestCollection(today(), parseInt(S('prenotify_days', '14'), 10) || 14);   // Vorschlag: frühester Termin
    const pv = await preview({ onlyDrinks: true, due: day });
    const plan = collectionPlan(day, { kind: 'getraenke', extra: pv.positions.map(p => ({ member_id: p.member_id, cents: p.cents, text: p.text, due_date: p.due_date, kind: 'getraenke' })) });
    const old = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(cents),0) cents FROM mv_charge WHERE kind = 'getraenke' AND status = 'offen' AND collection_id IS NULL AND due_date <= ?").get(day);
    return { ...plan, pv, existing: old.n ? old : null, notMembers: (pv.drinks && pv.drinks.notMembers) || [] };
  }
  admin.post('/drinks-collection/preview', PF, ar(async (req, res) => { const { pv, ...plan } = await drinksPlan((req.body || {}).date); res.json(plan); }));
  admin.post('/drinks-collection', PF, ar(async (req, res) => {
    const b = req.body || {};
    const plan = await drinksPlan(b.date);
    const blocked = collectionBlocked(plan, b.force);
    if (blocked) return res.status(blocked[0]).json({ error: blocked[1], earliest: plan.earliest });
    const skip = new Set(Array.isArray(b.skip) ? b.skip.map(Number) : []);
    // abgewählte Zahler und alle, die nicht per Lastschrift gehen, bleiben auf dem Verkaufskonto offen; Summe 0 € wird verrechnet
    const payers = new Set([...plan.ok.map(x => x.member_id).filter(id => !skip.has(id)), ...plan.zero.map(z => z.member_id)]);
    if (!plan.ok.some(x => payers.has(x.member_id))) return bad(res, 'Keine Lastschriften fällig.');
    const user = uname(req);
    let run = null, id, txs;
    try {
      db.transaction(() => {
        const pos = plan.pv.positions.filter(p => payers.has(p.member_id));
        if (pos.length) run = makeRun({ onlyDrinks: true }, plan.pv, pos, user);
        const now = collectionPlan(plan.date, { kind: 'getraenke' });   // mit den eben angelegten Posten
        txs = now.ok.filter(x => payers.has(x.member_id));
        if (!txs.length) throw fachlich('Keine Lastschriften fällig.');
        id = makeCollection(now, txs, now.zero.filter(z => payers.has(z.member_id)).flatMap(z => z.charges), user, 'getraenke');
      })();
    } catch (e) { if (e.fachlich) return bad(res, e.message); throw e; }
    const cents = txs.reduce((s, x) => s + x.cents, 0);
    C.audit(req.user, 'Verkaufs-Einzug erstellt', `${txs.length} Lastschriften, ${euro(cents)} zum ${deD(plan.date)}${run ? ` (Lauf ${run.run}: ${run.count} Posten aus den Verkaufskonten)` : ''}`);
    res.json({ ok: true, id, run: run && run.run, count: txs.length, cents });
  }));
  const collOr404 = (req, res) => { const c = db.prepare('SELECT * FROM mv_collection WHERE id = ?').get(int(req.params.id)); if (!c) bad(res, 'Nicht gefunden.', 404); return c; };
  admin.get('/collections', PF, (req, res) => res.json(db.prepare(`SELECT id, collection_date, msg_id, count, cents, status, prenotified_at, booked_at, by_user, created_at, kind,
    (SELECT COUNT(DISTINCT member_id) FROM mv_charge c WHERE c.collection_id = k.id AND c.returns > 0) AS returned FROM mv_collection k ORDER BY id DESC LIMIT 60`).all()));
  admin.get('/collections/:id', PF, (req, res) => {
    const k = collOr404(req, res); if (!k) return;
    const rows = db.prepare(`SELECT c.member_id, m.name, p.email, p.member_no, SUM(c.cents) cents, COUNT(*) n, group_concat(c.text, ' · ') texts, MIN(c.status) status
      FROM mv_charge c JOIN members m ON m.id = c.member_id LEFT JOIN mv_person p ON p.member_id = c.member_id WHERE c.collection_id = ? GROUP BY c.member_id ORDER BY name_key(m.name, m.kind)`).all(k.id);
    const returned = db.prepare(`SELECT DISTINCT c.member_id FROM mv_charge c WHERE c.note LIKE ? `).all(`%Rücklastschrift Einzug ${k.id}%`).map(r => r.member_id);
    res.json({ ...k, xml: undefined, note: undefined, rows: rows.map(r => ({ ...r, returned: returned.includes(r.member_id) })), returnedOnly: returned.filter(id => !rows.some(r => r.member_id === id)).map(id => ({ member_id: id, name: payerName(id) })),
      runs: k.status === 'erstellt' ? collectionRuns(k.id) : [] });
  });
  admin.get('/collections/:id/xml', PF, (req, res) => {
    const k = collOr404(req, res); if (!k) return;
    if (k.status === 'verworfen' || !k.xml) return bad(res, 'Dieser Einzug wurde verworfen – es gibt keine Datei mehr.', 410);
    C.audit(req.user, 'SEPA-Datei heruntergeladen', `Einzug ${k.id} (${k.count} Lastschriften, ${euro(k.cents)})`);
    res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="SEPA-Lastschrift_${k.collection_date}_${k.id}.xml"`, 'Cache-Control': 'no-store' }).send(k.xml);
  });
  admin.post('/collections/:id/booked', PF, (req, res) => {
    const k = collOr404(req, res); if (!k) return;
    if (k.status !== 'erstellt') return bad(res, 'Dieser Einzug ist schon verbucht oder verworfen.');
    const date = isDate((req.body || {}).date) ? req.body.date : k.collection_date;
    db.transaction(() => {
      db.prepare("UPDATE mv_charge SET status = 'bezahlt', paid_at = ?, paid_via = 'lastschrift' WHERE collection_id = ? AND status = 'eingezogen'").run(date, k.id);
      db.prepare("UPDATE mv_collection SET status = 'gebucht', booked_at = ? WHERE id = ?").run(nowTs(), k.id);
    })();
    C.audit(req.user, 'SEPA-Einzug als bezahlt verbucht', `Einzug ${k.id}: ${euro(k.cents)}`);
    res.json({ ok: true });
  });
  /* Zahlung erfolgt: Posten „im Einzug“ (Lastschrift ohne Rückläufer) gesammelt als bezahlt buchen – vom Kassierer, wenn nichts zurückkam */
  admin.post('/charges/paid', PF, (req, res) => {
    const b = req.body || {};
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Number.isInteger).slice(0, 5000);
    if (!ids.length) return bad(res, 'Bitte Posten auswählen.');
    const date = isDate(b.date) ? b.date : today();
    let n = 0, cents = 0;
    db.transaction(() => {
      for (const c of db.prepare(`SELECT * FROM mv_charge WHERE id IN (${ids.map(() => '?').join(',')}) AND status = 'eingezogen'`).all(...ids)) {
        db.prepare("UPDATE mv_charge SET status = 'bezahlt', paid_at = ?, paid_via = 'lastschrift' WHERE id = ?").run(date, c.id); n++; cents += c.cents;
      }
      // Einzüge, in denen nichts mehr „im Einzug“ steht, gelten als verbucht
      for (const k of db.prepare("SELECT id FROM mv_collection WHERE status = 'erstellt'").all())
        if (!db.prepare("SELECT 1 FROM mv_charge WHERE collection_id = ? AND status = 'eingezogen'").get(k.id) && db.prepare("SELECT 1 FROM mv_charge WHERE collection_id = ? AND status = 'bezahlt'").get(k.id))
          db.prepare("UPDATE mv_collection SET status = 'gebucht', booked_at = ? WHERE id = ?").run(nowTs(), k.id);
    })();
    if (!n) return bad(res, 'Keiner der Posten ist (noch) im Einzug.');
    C.audit(req.user, 'Lastschrift: Zahlung erfolgt', `${n} Posten, ${euro(cents)} (Gutschrift ${deD(date)})`);
    res.json({ ok: true, count: n, cents });
  });
  admin.post('/collections/:id/return', PF, (req, res) => {
    const k = collOr404(req, res); if (!k) return;
    const b = req.body || {}; const payer = int(b.member_id);
    const list = db.prepare("SELECT * FROM mv_charge WHERE collection_id = ? AND member_id = ? AND status IN ('eingezogen','bezahlt')").all(k.id, payer);
    if (!list.length) return bad(res, 'Für dieses Mitglied gibt es in diesem Einzug nichts zurückzubuchen.');
    const fee = b.fee_cents !== undefined ? Math.max(0, int(b.fee_cents)) : parseInt(S('return_fee_cents', '0'), 10) || 0;
    const reason = one(b.reason, 80) || 'Rücklastschrift';
    db.transaction(() => {
      for (const c of list) db.prepare("UPDATE mv_charge SET status = 'offen', collection_id = NULL, paid_at = NULL, paid_via = NULL, returns = returns + 1, note = ? WHERE id = ?").run(`Rücklastschrift Einzug ${k.id}: ${reason}`, c.id);
      if (fee) db.prepare("INSERT INTO mv_charge(member_id, kind, text, cents, due_date, created_by, note) VALUES (?, 'ruecklastschrift', ?, ?, ?, ?, ?)").run(payer, `Gebühr Rücklastschrift vom ${deD(k.collection_date)}`, fee, today(), uname(req), `Rücklastschrift Einzug ${k.id}: ${reason}`);
      if (b.revokeMandate) db.prepare('UPDATE mv_bank SET mandate_revoked = ? WHERE member_id = ?').run(today(), payer);
      const left = db.prepare('SELECT COUNT(*) n, COALESCE(SUM(cents),0) c FROM mv_charge WHERE collection_id = ?').get(k.id);
      db.prepare('UPDATE mv_collection SET count = (SELECT COUNT(DISTINCT member_id) FROM mv_charge WHERE collection_id = ?), cents = ? WHERE id = ?').run(k.id, left.c, k.id);
    })();
    store.hist(payer, uname(req), 'Rücklastschrift', null, `${euro(list.reduce((s, c) => s + c.cents, 0))} (${reason})${b.revokeMandate ? ', Mandat gesperrt' : ''}`);
    C.audit(req.user, 'Rücklastschrift erfasst', `${payerName(payer)}: ${euro(list.reduce((s, c) => s + c.cents, 0))} – ${reason}${fee ? ', Gebühr ' + euro(fee) : ''}`);
    res.json({ ok: true });
  });
  /** Läufe, aus denen die Posten eines Einzugs stammen – undo: nach dem Verwerfen wäre der ganze Lauf wieder offen und zurücknehmbar */
  const collectionRuns = id => db.prepare('SELECT id, kind, created_at, count, cents FROM mv_run WHERE id IN (SELECT run_id FROM mv_charge WHERE collection_id = ?) ORDER BY id').all(id)
    .map(r => ({ ...r, undo: !db.prepare("SELECT 1 FROM mv_charge WHERE run_id = ? AND status != 'offen' AND COALESCE(collection_id, 0) != ?").get(r.id, id) }));
  admin.delete('/collections/:id', PF, (req, res) => {
    const k = collOr404(req, res); if (!k) return;
    if (k.status !== 'erstellt') return bad(res, 'Ein verbuchter Einzug kann nicht verworfen werden – einzelne Lastschriften über „Rücklastschrift“ zurückbuchen.');
    const note = JSON.parse(k.note || '{}');
    // ?runs=1: auch die Läufe zurücknehmen (Verkaufskonten wieder offen) – alles oder nichts
    const runs = req.query.runs === '1' ? collectionRuns(k.id).filter(r => r.undo) : [];
    try {
      db.transaction(() => {
        db.prepare("UPDATE mv_charge SET status = 'offen', collection_id = NULL WHERE collection_id = ?").run(k.id);
        for (const [mid, v] of Object.entries(note.prevMandates || {})) db.prepare('UPDATE mv_bank SET mandate_first_used = ?, mandate_last_used = ? WHERE member_id = ?').run(v.first, v.last, int(mid));
        db.prepare("UPDATE mv_collection SET status = 'verworfen', xml = NULL WHERE id = ?").run(k.id);
        for (const r of runs) {
          try { undoRun(db.prepare('SELECT * FROM mv_run WHERE id = ?').get(r.id)); } catch (e) { if (e.fachlich) e.message = `Lauf vom ${deD(r.created_at.slice(0, 10))} lässt sich nicht zurücknehmen: ${e.message} Der Einzug wurde nicht verworfen.`; throw e; }
        }
      })();
    } catch (e) { if (e.fachlich) return bad(res, e.message); throw e; }
    C.audit(req.user, 'SEPA-Einzug verworfen', `Einzug ${k.id} (${k.count} Lastschriften, ${euro(k.cents)})${runs.length ? `, ${runs.length === 1 ? 'Lauf' : runs.length + ' Läufe'} zurückgenommen` : ''}`);
    res.json({ ok: true, runs: runs.length });
  });

  /* Vorabinformation (Pre-Notification) */
  function prenoteText(k, r, bk) {
    const cl = club();
    return [`Guten Tag ${r.name},`, '', `wir buchen am ${deD(k.collection_date)} den Betrag von ${euro(r.cents)} per SEPA-Lastschrift von Ihrem Konto ab:`, '',
      ...r.texts.split(' · ').map(t => `- ${t}`), '', `Konto: ${sepa.maskIban(bk.iban)}`, `Mandatsreferenz: ${bk.mandate_ref}`, `Gläubiger-Identifikationsnummer: ${cl.ci}`, '',
      'Bitte sorgen Sie für ausreichende Deckung. Eine Rücklastschrift verursacht Gebühren.', '', 'Viele Grüße', cl.name].join('\n');
  }
  admin.post('/collections/:id/prenotify', PF, rateLimit('mvpre', 6, 10 * 60000), ar(async (req, res) => {
    const k = collOr404(req, res); if (!k) return;
    const rows = db.prepare(`SELECT c.member_id, m.name, p.email, SUM(c.cents) cents, group_concat(c.text, ' · ') texts FROM mv_charge c JOIN members m ON m.id = c.member_id LEFT JOIN mv_person p ON p.member_id = c.member_id
      WHERE c.collection_id = ? GROUP BY c.member_id`).all(k.id);
    if (!C.mail.ready()) return bad(res, 'Kein Postfach eingerichtet (Einstellungen → Postfach).');
    let sent = 0; const missing = [], failed = [];
    for (const r of rows) {
      if (!r.email) { missing.push(r.name); continue; }
      try { await C.mail.send({ to: r.email, subject: `Ankündigung SEPA-Lastschrift zum ${deD(k.collection_date)} – ${club().name}`, text: prenoteText(k, r, bankRow(r.member_id)) }); sent++; }
      catch (e) { failed.push(`${r.name}: ${e.message}`); }
      await new Promise(ok => setTimeout(ok, 150));
    }
    db.prepare('UPDATE mv_collection SET prenotified_at = ? WHERE id = ?').run(nowTs(), k.id);
    C.audit(req.user, 'Vorabinformation versendet', `Einzug ${k.id}: ${sent} E-Mails${missing.length ? `, ${missing.length} ohne E-Mail` : ''}`);
    res.json({ ok: true, sent, missing, failed });
  }));
  admin.get('/collections/:id/letters.pdf', PF, ar(async (req, res) => {
    const k = collOr404(req, res); if (!k) return;
    const rows = db.prepare(`SELECT c.member_id, m.name, p.email, SUM(c.cents) cents, group_concat(c.text, ' · ') texts FROM mv_charge c JOIN members m ON m.id = c.member_id LEFT JOIN mv_person p ON p.member_id = c.member_id
      WHERE c.collection_id = ? GROUP BY c.member_id ORDER BY name_key(m.name, m.kind)`).all(k.id).filter(r => req.query.all || !r.email);
    const buf = await pdf.letters(club(), rows.map(r => ({ person: personOf(r.member_id), name: r.name, title: 'Ankündigung SEPA-Lastschrift', body: prenoteText(k, r, bankRow(r.member_id)).split('\n').slice(2).join('\n') })));
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Vorabinformation_${k.collection_date}.pdf"` }).send(buf);
  }));

  /* ======================================================= Rechnungen & Mahnungen */
  function nextInvoiceNo() {
    const y = today().slice(0, 4);
    const last = db.prepare("SELECT invoice_no FROM mv_charge WHERE invoice_no LIKE ? ORDER BY invoice_no DESC LIMIT 1").get(`RE-${y}-%`);
    const n = last ? parseInt(last.invoice_no.split('-')[2], 10) + 1 : 1;
    return `RE-${y}-${String(n).padStart(4, '0')}`;
  }
  async function invoiceFor(payer, { dunning = 0, user } = {}) {
    const list = db.prepare("SELECT * FROM mv_charge WHERE member_id = ? AND status = 'offen' ORDER BY due_date, id").all(payer);
    if (!list.length) return null;
    let no = list.find(c => c.invoice_no) ? list.find(c => c.invoice_no).invoice_no : null;
    if (!no) { no = nextInvoiceNo(); db.prepare(`UPDATE mv_charge SET invoice_no = ? WHERE id IN (${list.map(() => '?').join(',')})`).run(no, ...list.map(c => c.id)); }
    const buf = await pdf.invoice(club(), { person: personOf(payer), name: payerName(payer), no, date: today(), charges: list, dunning, payment: personOf(payer).payment, mandate: bankRow(payer) });
    return { buf, no, list, total: list.reduce((s, c) => s + c.cents, 0) };
  }
  admin.get('/invoice.pdf', PF, ar(async (req, res) => {
    const r = await invoiceFor(int(req.query.member), { dunning: int(req.query.dunning) });
    if (!r) return bad(res, 'Keine offenen Posten.', 404);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${r.no}.pdf"` }).send(r.buf);
  }));
  admin.get('/dunning', PF, (req, res) => {
    const days = Math.max(0, int(req.query.days, 14));
    const rows = db.prepare(`SELECT c.member_id, m.name, p.email, p.payment, SUM(c.cents) cents, COUNT(*) n, MIN(c.due_date) oldest, MAX(c.dunning_level) level, MAX(c.dunned_at) dunned_at
      FROM mv_charge c JOIN members m ON m.id = c.member_id LEFT JOIN mv_person p ON p.member_id = c.member_id WHERE c.status = 'offen' AND c.due_date < ?
      GROUP BY c.member_id HAVING SUM(c.cents) > 0 ORDER BY oldest`).all(fees.addDays(today(), -days));
    res.json(rows);
  });
  admin.post('/invoices/send', PF, rateLimit('mvinv', 10, 10 * 60000), ar(async (req, res) => {
    const b = req.body || {};
    if (!C.mail.ready()) return bad(res, 'Kein Postfach eingerichtet (Einstellungen → Postfach).');
    const ids = Array.isArray(b.member_ids) ? b.member_ids.map(Number).filter(Boolean).slice(0, 500) : [];
    const dunning = b.dunning ? 1 : 0;
    let sent = 0; const missing = [], failed = [];
    for (const id of ids) {
      const p = personOf(id);
      if (!p.email) { missing.push(payerName(id)); continue; }
      if (dunning) {
        const lvl = (db.prepare("SELECT MAX(dunning_level) l FROM mv_charge WHERE member_id = ? AND status = 'offen'").get(id).l || 0) + 1;
        const fee = parseInt(S('dunning_fee_cents', '0'), 10) || 0;
        if (fee && lvl >= 2) db.prepare("INSERT INTO mv_charge(member_id, kind, text, cents, due_date, created_by) VALUES (?, 'mahngebuehr', ?, ?, ?, ?)").run(id, `Mahngebühr (${lvl}. Mahnung)`, fee, today(), uname(req));
        db.prepare("UPDATE mv_charge SET dunning_level = ?, dunned_at = ? WHERE member_id = ? AND status = 'offen' AND due_date < ?").run(lvl, today(), id, today());
      }
      const inv = await invoiceFor(id, { dunning: dunning ? db.prepare("SELECT MAX(dunning_level) l FROM mv_charge WHERE member_id = ? AND status = 'offen'").get(id).l : 0 });
      if (!inv) continue;
      const word = dunning ? (inv.list[0].dunning_level >= 2 ? `${inv.list[0].dunning_level}. Mahnung` : 'Zahlungserinnerung') : 'Rechnung';
      try {
        await C.mail.send({ to: p.email, subject: `${word} ${inv.no} – ${club().name}`, text: [`Guten Tag ${payerName(id)},`, '', dunning ? `wir haben bis heute keinen Zahlungseingang über ${euro(inv.total)} feststellen können. Bitte überweisen Sie den Betrag in den nächsten 14 Tagen.` : `anbei die Rechnung ${inv.no} über ${euro(inv.total)}.`, '', 'Die Einzelheiten stehen im angehängten PDF.', '', 'Viele Grüße', club().name].join('\n'),
          attachments: [{ filename: `${inv.no}.pdf`, content: inv.buf }] });
        sent++;
      } catch (e) { failed.push(`${payerName(id)}: ${e.message}`); }
      await new Promise(ok => setTimeout(ok, 150));
    }
    C.audit(req.user, dunning ? 'Mahnungen versendet' : 'Rechnungen versendet', `${sent} E-Mails${missing.length ? `, ${missing.length} ohne E-Mail` : ''}`);
    res.json({ ok: true, sent, missing, failed });
  }));
  /* Übersicht Finanzen */
  admin.get('/finance', PF, (req, res) => {
    const y = String(req.query.year || today().slice(0, 4)).slice(0, 4);
    const sum = (where, ...a) => db.prepare(`SELECT COALESCE(SUM(cents),0) c, COUNT(*) n FROM mv_charge WHERE ${where}`).get(...a);
    res.json({ year: y, open: sum("status = 'offen'"), overdue: sum("status = 'offen' AND due_date < ?", today()), inCollection: sum("status = 'eingezogen'"),
      paidYear: sum("status = 'bezahlt' AND substr(paid_at,1,4) = ?", y), billedYear: sum("status != 'storniert' AND substr(due_date,1,4) = ?", y),
      byKind: db.prepare("SELECT kind, COALESCE(SUM(cents),0) c FROM mv_charge WHERE status != 'storniert' AND substr(due_date,1,4) = ? GROUP BY kind").all(y),
      ready: { creditor: Boolean(S('creditor_id')), iban: Boolean(store.account().iban), mail: C.mail.ready() }, earliest: sepa.earliestCollection(today(), parseInt(S('prenotify_days', '14'), 10) || 14),
      drinksDue: S('drinks_due', ''), drinksOpen: C.drinks.active() ? C.drinks.open().rows.filter(r => r.kind === 'mitglied').reduce((s, r) => s + r.total_cents, 0) : null });
  });

  /* ======================================================= für den Verkauf (Kern) */
  /** Verkauf › Abrechnung: offene Verkaufs-Posten, damit nichts übersehen wird */
  C.hooks.drinksOpenCharges = () => db.prepare(`SELECT c.id, c.text, c.cents, c.due_date, m.name AS payer, m.kind AS payer_kind FROM mv_charge c JOIN members m ON m.id = c.member_id
    WHERE c.kind = 'getraenke' AND c.status = 'offen' ORDER BY name_key(m.name, m.kind), c.due_date, c.id`).all();
  /** Storno einer abgerechneten Buchung: Wo ist sie abgerechnet? → { text, billed, undo: { run, count, cents } | null } oder null (nicht aus einem Lauf) */
  C.hooks.drinksSettlementInfo = ({ batch, memberId }) => {
    const run = db.prepare('SELECT * FROM mv_run WHERE drinks_batch = ?').get(String(batch || ''));
    if (!run) return null;
    const c = db.prepare("SELECT * FROM mv_charge WHERE run_id = ? AND kind = 'getraenke' AND COALESCE(for_member_id, member_id) = ? ORDER BY id DESC LIMIT 1").get(run.id, int(memberId));
    const coll = c && c.collection_id ? db.prepare('SELECT collection_date FROM mv_collection WHERE id = ?').get(c.collection_id) : null;
    const state = !c ? '' : c.status === 'offen' ? 'Posten noch offen, nichts eingezogen' : c.status === 'eingezogen' ? `in der Lastschrift zum ${deD(coll.collection_date)}` : c.status === 'bezahlt' ? `bezahlt am ${deD(c.paid_at)}` : 'Posten storniert';
    const free = !db.prepare("SELECT 1 FROM mv_charge WHERE run_id = ? AND status != 'offen'").get(run.id);
    return { text: `${run.kind === 'getraenke' ? 'Verkaufs-Einzug' : 'Beitragslauf'} der Mitglieder vom ${deD(run.created_at.slice(0, 10))}${state ? ' – ' + state : ''}`, billed: !c || c.status !== 'storniert',
      undo: free && run.kind === 'getraenke' ? { run: run.id, count: run.count, cents: run.cents } : null };
  };
  /** Verkaufs-Lauf zurücknehmen (aus dem Storno-Dialog im Verkauf) – nur solange daraus nichts eingezogen ist */
  C.hooks.drinksSettlementUndo = ({ batch, user }) => {
    const run = db.prepare("SELECT * FROM mv_run WHERE drinks_batch = ? AND kind = 'getraenke'").get(String(batch || ''));
    if (!run) throw new Error('Dieser Verkaufs-Einzug ist nicht mehr da.');
    undoRun(run);
    C.audit(user, 'Beitragslauf zurückgenommen', `Lauf ${run.id} (Verkauf): ${run.count} Positionen, ${euro(run.cents)} – aus dem Storno im Verkauf`);
    return true;
  };
}

module.exports = { register };
