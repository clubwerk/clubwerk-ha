'use strict';
/**
 * Altersstufen-Hinweise
 *  Wird jemand älter und passt nicht mehr in seinen Beitrag (z. B. Jugend → Erwachsene), fällt ein Kind mit 19 aus dem Familienbeitrag
 *  oder rutscht in eine höhere Stufe des Zusatzbeitrags, entsteht ein Hinweis. Bis zur Entscheidung läuft der bisherige Beitrag weiter.
 *  Die Verwaltung entscheidet: „umstellen“ (ab dem nächsten Zeitraum der neue Beitrag) oder „so belassen“ (wird gemerkt, kein neuer Hinweis).
 *  Hintergrund: Lieber den Jugendbeitrag weiter bekommen, als dass ein passives Mitglied wegen des höheren Beitrags austritt.
 */
const KIND = { fee: 'Beitrag passt nicht mehr zum Alter', family: 'fällt aus dem Familienbeitrag', zusatz: 'höhere Stufe beim Zusatzbeitrag' };

function register(sh) {
  const { C, store, fees, euro, deD, uname } = sh;
  const db = C.db;
  const { S, today, nowTs } = store;
  const { int, bad } = C;
  const P = C.need('mitglieder');

  db.exec(`CREATE TABLE IF NOT EXISTS mv_age_notice (
    id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL, kind TEXT NOT NULL, ref_id INTEGER NOT NULL,
    from_fee_id INTEGER, to_fee_id INTEGER, age INTEGER, due_date TEXT, status TEXT NOT NULL DEFAULT 'offen',
    decided_by TEXT, decided_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(member_id, kind, ref_id, to_fee_id));`);

  const nextStart = interval => fees.addMonths(store.periodStart(today(), interval), fees.MONTHS[interval] || 12);
  const fits = (f, age) => age != null && (f.age_min == null || age >= f.age_min) && (f.age_max == null || age <= f.age_max);
  const grundFees = () => db.prepare("SELECT * FROM mv_fee WHERE kind != 'zusatz' AND active = 1 AND family = 0 AND interval != 'einmalig' AND (age_min IS NOT NULL OR age_max IS NOT NULL) ORDER BY COALESCE(age_min, 0)").all();
  /** passender Beitrag für ein Alter – bevorzugt gleicher Rhythmus und „auf dem Formular“ */
  const target = (age, interval, list) => list.filter(f => fits(f, age)).sort((a, b) => (b.interval === interval) - (a.interval === interval) || b.on_form - a.on_form)[0] || null;

  /** Bestand prüfen → neue Hinweise anlegen, erledigte schließen. Gibt die Zahl offener Hinweise zurück. */
  function scan() {
    const day = today(), found = new Set();
    const ins = db.prepare('INSERT OR IGNORE INTO mv_age_notice(member_id, kind, ref_id, from_fee_id, to_fee_id, age, due_date) VALUES (?,?,?,?,?,?,?)');
    const add = (m, k, ref, from, to, age, due) => { ins.run(m, k, ref, from, to, age, due); found.add(`${m}|${k}|${ref}|${to}`); };
    const alive = `p.anonymized_at IS NULL AND (p.exit_date IS NULL OR p.exit_date >= ?) AND p.birth_date IS NOT NULL`;
    const gf = grundFees();
    // 1) eigener Beitrag mit Altersgrenzen
    for (const r of db.prepare(`SELECT mf.id, mf.member_id, mf.fee_id, mf.start_date, mf.end_date, f.age_min, f.age_max, f.interval, f.family, p.birth_date FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id
        JOIN mv_person p ON p.member_id = mf.member_id JOIN members m ON m.id = mf.member_id
        WHERE m.deleted = 0 AND ${alive} AND f.kind != 'zusatz' AND f.family = 0 AND f.interval != 'einmalig' AND (mf.end_date IS NULL OR mf.end_date >= ?) AND (f.age_min IS NOT NULL OR f.age_max IS NOT NULL)`).all(day, day)) {
      const nx = nextStart(r.interval);
      const checks = [...(r.start_date <= day ? [[day, store.periodStart(day, r.interval)]] : []), ...(!r.end_date || r.end_date >= nx ? [[r.start_date > nx ? r.start_date : nx, r.start_date > nx ? r.start_date : nx]] : [])];
      for (const [d, due] of checks) {
        const age = fees.ageAt(r.birth_date, d);
        if (fits(r, age)) continue;
        const t = target(age, r.interval, gf);
        if (t && t.id !== r.fee_id) add(r.member_id, 'fee', r.id, r.fee_id, t.id, age, due);
        break;
      }
    }
    // 2) Kinder in der Familienmitgliedschaft (family_of), die über die Altersgrenze kommen
    const max = parseInt(S('family_child_max', '18'), 10) || 18;
    for (const r of db.prepare(`SELECT p.member_id, p.family_of, p.birth_date, mf.id AS mf_id, mf.fee_id, f.interval FROM mv_person p JOIN members m ON m.id = p.member_id
        JOIN mv_member_fee mf ON mf.member_id = p.family_of JOIN mv_fee f ON f.id = mf.fee_id
        WHERE m.deleted = 0 AND ${alive} AND p.family_of IS NOT NULL AND p.family_of != p.member_id AND f.family = 1 AND (mf.end_date IS NULL OR mf.end_date >= ?)
          AND NOT EXISTS (SELECT 1 FROM mv_member_fee x WHERE x.member_id = p.member_id AND (x.end_date IS NULL OR x.end_date >= ?))`).all(day, day, day)) {
      const nx = nextStart(r.interval), age = fees.ageAt(r.birth_date, nx);
      if (age == null || age <= max || age > max + 1) continue;   // nur wer gerade herauswächst (Partner sind älter und bleiben unberührt)
      const t = target(age, r.interval, gf);
      add(r.member_id, 'family', r.mf_id, r.fee_id, t ? t.id : null, age, nx);
    }
    // 3) Zusatzbeitrag nach Alter: Stufe heute ≠ Stufe im nächsten Zeitraum
    const tiers = new Map();
    for (const f of db.prepare("SELECT * FROM mv_fee WHERE kind = 'zusatz' AND active = 1").all()) { if (!tiers.has(f.department_id)) tiers.set(f.department_id, []); tiers.get(f.department_id).push(f); }
    if (tiers.size) {
      for (const md of db.prepare(`SELECT md.id, md.member_id, md.department_id, p.birth_date FROM mv_member_department md JOIN mv_person p ON p.member_id = md.member_id JOIN members m ON m.id = md.member_id
          WHERE m.deleted = 0 AND ${alive} AND md.fee_id IS NULL AND md.fee_free = 0 AND (md.exit_date IS NULL OR md.exit_date >= ?)`).all(day, day)) {
        const list = tiers.get(md.department_id); if (!list || list.length < 2) continue;
        const nx = nextStart(list[0].interval);
        const a = fees.pickByAge(list, md.birth_date, day).fee, b = fees.pickByAge(list, md.birth_date, nx).fee;
        if (a && b && a.id !== b.id) add(md.member_id, 'zusatz', md.id, a.id, b.id, fees.ageAt(md.birth_date, nx), nx);
      }
    }
    // offene Hinweise, deren Anlass weg ist (Beitrag geändert, ausgetreten …), schließen
    for (const n of db.prepare("SELECT * FROM mv_age_notice WHERE status = 'offen'").all())
      if (!found.has(`${n.member_id}|${n.kind}|${n.ref_id}|${n.to_fee_id}`)) db.prepare("UPDATE mv_age_notice SET status = 'erledigt', decided_at = ? WHERE id = ?").run(nowTs(), n.id);
    return db.prepare("SELECT COUNT(*) n FROM mv_age_notice WHERE status = 'offen'").get().n;
  }

  const feeName = id => (id ? (db.prepare('SELECT name, cents, interval FROM mv_fee WHERE id = ?').get(id) || null) : null);
  function view(n) {
    const f = feeName(n.from_fee_id), t = feeName(n.to_fee_id);
    const m = db.prepare('SELECT m.name, p.birth_date FROM members m LEFT JOIN mv_person p ON p.member_id = m.id WHERE m.id = ?').get(n.member_id) || {};
    const payer = store.payerOf(n.member_id);
    return { ...n, name: m.name, label: KIND[n.kind], from: f && { name: f.name, cents: f.cents }, to: t && { name: t.name, cents: t.cents },
      payer_name: payer !== n.member_id ? (db.prepare('SELECT name FROM members WHERE id = ?').get(payer) || {}).name : null,
      dept: n.kind === 'zusatz' ? (db.prepare('SELECT d.name FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id WHERE md.id = ?').get(n.ref_id) || {}).name : null };
  }
  const list = (status = 'offen', memberId = null) => db.prepare(`SELECT * FROM mv_age_notice WHERE ${status === 'alle' ? "status != 'erledigt'" : 'status = ?'} ${memberId ? 'AND member_id = ?' : ''} ORDER BY due_date, id`)
    .all(...[status === 'alle' ? null : status, memberId].filter(x => x != null)).map(view);

  /** Entscheidung umsetzen */
  function decide(id, action, by) {
    const n = db.prepare('SELECT * FROM mv_age_notice WHERE id = ?').get(id);
    if (!n || n.status !== 'offen') throw new Error('Dieser Hinweis ist schon entschieden.');
    const due = n.due_date && n.due_date > today() ? n.due_date : store.periodStart(today(), (db.prepare('SELECT interval FROM mv_fee WHERE id = ?').get(n.from_fee_id || n.to_fee_id) || {}).interval || 'jahr');
    db.transaction(() => {
      if (action === 'umstellen') {
        if (n.kind === 'fee') {
          const mf = db.prepare('SELECT * FROM mv_member_fee WHERE id = ?').get(n.ref_id);
          if (!mf || !n.to_fee_id) throw new Error('Der bisherige Beitrag ist nicht mehr vorhanden.');
          db.prepare('UPDATE mv_member_fee SET end_date = ? WHERE id = ?').run(fees.addDays(due, -1), mf.id);
          db.prepare('INSERT INTO mv_member_fee(member_id, fee_id, start_date, booked_until, note) VALUES (?,?,?,?,?)').run(n.member_id, n.to_fee_id, due, null, 'Altersstufe umgestellt');
        } else if (n.kind === 'family') {
          if (!n.to_fee_id) throw new Error('Es gibt keinen passenden Einzelbeitrag für dieses Alter – bitte im Mitglied von Hand zuordnen.');
          db.prepare('INSERT INTO mv_member_fee(member_id, fee_id, start_date, note) VALUES (?,?,?,?)').run(n.member_id, n.to_fee_id, due, 'eigener Beitrag statt Familienbeitrag');
        }   // zusatz: die Stufe nach Alter greift von selbst
      } else if (action === 'belassen') {
        if (n.kind === 'zusatz') db.prepare('UPDATE mv_member_department SET fee_id = ? WHERE id = ?').run(n.from_fee_id, n.ref_id);   // bisherige Stufe fest
      } else throw new Error('Unbekannte Entscheidung.');
      db.prepare('UPDATE mv_age_notice SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?').run(action === 'umstellen' ? 'umgestellt' : 'belassen', by || null, nowTs(), n.id);
      const v = view(n);
      store.hist(n.member_id, by, 'Altersstufe', v.from ? v.from.name : 'Familienbeitrag', action === 'umstellen' ? `${v.to ? v.to.name : '–'} ab ${deD(due)}` : 'so belassen');
    })();
  }

  /** für den Beitragslauf: offene Zusatz-Hinweise → bisherige Stufe weiter berechnen */
  sh.ageHold = () => new Map(db.prepare("SELECT ref_id, from_fee_id, to_fee_id FROM mv_age_notice WHERE kind = 'zusatz' AND status = 'offen'").all().map(r => [r.ref_id, r]));
  sh.ageNoticeFor = mfId => db.prepare("SELECT status FROM mv_age_notice WHERE kind = 'fee' AND ref_id = ? AND status IN ('offen','belassen') LIMIT 1").get(mfId);
  sh.ageScan = scan;
  sh.ageOpen = () => db.prepare("SELECT COUNT(*) n FROM mv_age_notice WHERE status = 'offen'").get().n;
  sh.ageFor = memberId => list('offen', memberId);

  C.admin.get('/age-notices', P, (req, res) => { scan(); const rows = list(req.query.status === 'alle' ? 'alle' : 'offen'); res.json(req.mvScope ? rows.filter(r => sh.inScope && sh.inScope(r.member_id, req.mvScope)) : rows); });
  C.admin.post('/age-notices/:id', P, (req, res) => {
    try { decide(int(req.params.id), String((req.body || {}).action || ''), uname(req)); C.audit(req.user, 'Altersstufe entschieden', `${(req.body || {}).action} (#${req.params.id})`); res.json({ ok: true }); }
    catch (e) { bad(res, e.message); }
  });
  void euro;
}

module.exports = { register, KIND };
