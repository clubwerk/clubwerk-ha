'use strict';
/**
 * Gratulationen: Geburtstage, Vereins- und Abteilungsjubiläen nach einfachen Regeln (planung/gratulationen.md)
 *  - Regeln: Anlass (Geburtstag, Verein, Abteilung), Wann (bestimmte Jahre und/oder „ab X jedes Jahr“), Was (freier Text)
 *  - Anstehende Anlässe (heute bis 30 Tage, Offenes der letzten 14 Tage) je Anlass abhaken: wer kümmert sich, erledigt, Notiz,
 *    erledigtes Jubiläum auf Wunsch als Ehrung beim Mitglied
 *  - Ausgetretene nie, „keine Gratulation gewünscht“ je Mitglied, einzelne Anlässe von Hand
 *  - Erinnerung X Tage vorher per E-Mail und/oder Push an alle mit dem Recht „Gratulationen“, je Anlass genau einmal
 *    (vermerkt in mv_congrats.reminded_at, übersteht also Neustarts). Kein Alter und kein Geburtsjahr in Benachrichtigungen.
 */
const KIND = { geburtstag: 'Geburtstag', verein: 'Vereinsjubiläum', abteilung: 'Abteilungsjubiläum' };
const DEFAULT_RULES = [
  { kind: 'geburtstag', dept: 0, years: [70, 75], from: 80, what: 'Blumen' },
  { kind: 'verein', dept: 0, years: [25], from: null, what: 'Ehrennadel' },
  { kind: 'verein', dept: 0, years: [40], from: null, what: 'Urkunde' },
  { kind: 'verein', dept: 0, years: [50], from: null, what: 'Ehrenmitglied vorschlagen' },
];
const AHEAD = 30, BEHIND = 14;   // Anzeige: nächste 30 Tage, Offenes bis 14 Tage zurück
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** Tag des Anlasses im Jahr y – wer am 29.02. Geburtstag (oder Eintritt) hat, feiert in Nicht-Schaltjahren am 28.02. */
const dayIn = (d, y) => (d.slice(5) === '02-29' && !leap(y) ? `${y}-02-28` : `${y}${d.slice(4)}`);
const hits = (r, n) => n > 0 && (r.years.includes(n) || (r.from != null && n >= r.from));
const wdDate = d => `${WD[new Date(d + 'T12:00:00Z').getUTCDay()]}, ${d.slice(8, 10)}.${d.slice(5, 7)}.`;

function register(sh) {
  const { C, store, fees, one, txt, deD, uname } = sh;
  const db = C.db, { S, SET, today, nowTs } = store, { int, bad } = C;
  const PG = C.need('gratulationen');
  const lf = C.require('./db').lastFirst;
  const vault = C.require('./vault');

  db.exec(`CREATE TABLE IF NOT EXISTS mv_congrats (
    id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES members(id),
    kind TEXT NOT NULL,                       -- geburtstag | verein | abteilung | manuell
    dept_id INTEGER NOT NULL DEFAULT 0, date TEXT NOT NULL, n INTEGER,
    title TEXT, plan TEXT,                    -- nur „manuell“: Anlass und geplante Gratulation (sonst aus den Regeln)
    who TEXT, note TEXT, done_at TEXT, done_by TEXT, honor_id INTEGER, reminded_at TEXT,
    created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(member_id, kind, dept_id, date));
  CREATE TABLE IF NOT EXISTS mv_congrats_off (member_id INTEGER NOT NULL REFERENCES members(id), by_user TEXT, at TEXT, PRIMARY KEY(member_id));
  CREATE TABLE IF NOT EXISTS mv_congrats_pref (user_id INTEGER NOT NULL, mail INTEGER NOT NULL DEFAULT 1, push INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(user_id));`);

  /* ---------- Regeln ---------- */
  const cleanRule = r => {
    const kind = KIND[r && r.kind] ? r.kind : null;
    if (!kind) return null;
    const years = [...new Set((Array.isArray(r.years) ? r.years : []).map(Number).filter(n => Number.isInteger(n) && n > 0 && n < 130))].sort((a, b) => a - b).slice(0, 20);
    const from = Number.isInteger(Number(r.from)) && Number(r.from) > 0 && Number(r.from) < 130 ? Number(r.from) : null;
    if (!years.length && from == null) return null;
    return { kind, dept: kind === 'abteilung' ? int(r.dept) || 0 : 0, years, from, what: one(r.what, 60) };
  };
  function rules() {
    const raw = S('congrats_rules', '');
    if (!raw) return DEFAULT_RULES;
    try { const l = JSON.parse(raw); return Array.isArray(l) ? l.map(cleanRule).filter(Boolean) : DEFAULT_RULES; } catch (e) { return DEFAULT_RULES; }
  }
  const lead = () => Math.max(1, Math.min(60, parseInt(S('congrats_days', '7'), 10) || 7));

  /* ---------- Anlässe ---------- */
  const depts = () => Object.fromEntries(db.prepare('SELECT id, name FROM mv_department').all().map(d => [d.id, d.name]));
  /** Anlass in Worten. Für Benachrichtigungen (secret) ohne Alter – daraus ließe sich das Geburtsjahr ablesen. */
  const label = (o, secret) => (o.kind === 'manuell' ? o.title : o.kind === 'geburtstag' ? (secret ? C.T('Geburtstag') : C.T('{0}. Geburtstag', [o.n]))
    : o.kind === 'verein' ? C.T('{0} Jahre im Verein', [o.n]) : C.T('{0} Jahre Abteilung {1}', [o.n, o.dept || '']));
  /** Alle Anlässe zwischen from und to (JJJJ-MM-TT) samt Stand (wer, erledigt, Notiz, erinnert) */
  function occasions(from, to) {
    const rl = rules(), out = [], dn = depts(), y0 = Number(from.slice(0, 4)), y1 = Number(to.slice(0, 4));
    const people = db.prepare(`SELECT m.id, m.name, m.kind, p.birth_date, p.entry_date, p.exit_date FROM members m JOIN mv_person p ON p.member_id = m.id
      WHERE m.kind = 'mitglied' AND m.deleted = 0 AND p.anonymized_at IS NULL AND NOT EXISTS (SELECT 1 FROM mv_congrats_off o WHERE o.member_id = m.id)`).all();
    const mdOf = db.prepare("SELECT department_id, entry_date, exit_date FROM mv_member_department WHERE member_id = ? AND entry_date IS NOT NULL AND status != 'ausgetreten'");
    const withDept = rl.some(r => r.kind === 'abteilung');
    for (const p of people) {
      const check = (kind, base, deptId, exitAt) => {
        if (!fees.isDate(base)) return;
        const list = rl.filter(r => r.kind === kind && (!r.dept || r.dept === deptId));
        for (let y = y0; list.length && y <= y1; y++) {
          const date = dayIn(base, y), n = y - Number(base.slice(0, 4));
          if (date < from || date > to || (exitAt && exitAt < date)) continue;   // Ausgetretene nie
          const match = list.filter(r => hits(r, n));
          if (match.length) out.push({ member_id: p.id, name: p.name, kind, dept_id: deptId, dept: deptId ? dn[deptId] || '' : null, date, n, plan: [...new Set(match.map(r => r.what).filter(Boolean))].join(' · ') });
        }
      };
      check('geburtstag', p.birth_date, 0, p.exit_date);
      check('verein', p.entry_date, 0, p.exit_date);
      if (withDept) for (const md of mdOf.all(p.id)) check('abteilung', md.entry_date, md.department_id, [p.exit_date, md.exit_date].filter(Boolean).sort()[0]);
    }
    for (const r of db.prepare(`SELECT c.*, m.name FROM mv_congrats c JOIN members m ON m.id = c.member_id LEFT JOIN mv_person p ON p.member_id = c.member_id
        WHERE c.kind = 'manuell' AND c.date BETWEEN ? AND ? AND m.deleted = 0 AND p.anonymized_at IS NULL AND (p.exit_date IS NULL OR p.exit_date >= c.date)
          AND NOT EXISTS (SELECT 1 FROM mv_congrats_off o WHERE o.member_id = c.member_id)`).all(from, to))
      out.push({ member_id: r.member_id, name: r.name, kind: 'manuell', dept_id: 0, dept: null, date: r.date, n: null, title: r.title, plan: r.plan || '' });
    const state = db.prepare('SELECT * FROM mv_congrats WHERE member_id = ? AND kind = ? AND dept_id = ? AND date = ?');
    return out.map(o => {
      const s = state.get(o.member_id, o.kind, o.dept_id, o.date) || {};
      return { ...o, key: `${o.member_id}|${o.kind}|${o.dept_id}|${o.date}`, id: s.id || null, who: s.who || '', note: s.note || '', done_at: s.done_at || null, done_by: s.done_by || null, honor_id: s.honor_id || null, reminded_at: s.reminded_at || null, label: label(o) };
    }).sort((a, b) => a.date.localeCompare(b.date) || lf(a.name).localeCompare(lf(b.name), 'de'));
  }
  /** Liste für die Anzeige: Offenes der letzten 14 Tage, dann heute bis in 30 Tagen */
  const upcoming = () => { const d = today(); return occasions(fees.addDays(d, -BEHIND), fees.addDays(d, AHEAD)).filter(o => o.date >= d || !o.done_at); };
  const parseKey = k => { const m = /^(\d+)\|(geburtstag|verein|abteilung|manuell)\|(\d+)\|(\d{4}-\d{2}-\d{2})$/.exec(String(k || '')); return m ? { member_id: Number(m[1]), kind: m[2], dept_id: Number(m[3]), date: m[4] } : null; };
  /** Anlass zu einem Schlüssel – nur, was es nach den Regeln (bzw. von Hand) wirklich gibt */
  const findOcc = k => { const x = parseKey(k); return x ? occasions(fees.addDays(x.date, -1), fees.addDays(x.date, 1)).find(o => o.key === k) || null : null; };
  /** Zeile in mv_congrats anlegen bzw. finden (für Stand und Erinnerung) */
  const ensureRow = o => { db.prepare('INSERT OR IGNORE INTO mv_congrats(member_id, kind, dept_id, date, n) VALUES (?,?,?,?,?)').run(o.member_id, o.kind, o.dept_id, o.date, o.n); return db.prepare('SELECT * FROM mv_congrats WHERE member_id = ? AND kind = ? AND dept_id = ? AND date = ?').get(o.member_id, o.kind, o.dept_id, o.date); };

  /* ---------- Empfänger der Erinnerung ---------- */
  const recipients = () => db.prepare('SELECT * FROM admin_users WHERE active = 1').all().filter(u => C.auth.permInfo(u).perms.includes('gratulationen'));
  const prefOf = uid => { const p = db.prepare('SELECT mail, push FROM mv_congrats_pref WHERE user_id = ?').get(uid); return { mail: p ? Boolean(p.mail) : true, push: p ? Boolean(p.push) : true }; };
  const mailOf = memberId => { const r = memberId ? db.prepare('SELECT email FROM mv_person WHERE member_id = ?').get(memberId) : null; return r && r.email && !/@clubwerk\.invalid$/i.test(r.email) ? r.email : ''; };
  const paired = memberId => { try { const s = C.require('./memberapp').memberState(memberId); return Boolean(s.device && s.device.status === 'gekoppelt'); } catch (e) { return false; } };
  function channels(u) {
    const p = prefOf(u.id);
    return { mail: p.mail, push: p.push, address: mailOf(u.member_id), paired: Boolean(u.member_id) && paired(u.member_id), linked: Boolean(u.member_id) };
  }

  /* ---------- Erinnerung (stündlich und nach dem Entsperren des Tresors) ---------- */
  let running = false;
  async function remind() {
    if (running || !C.isActive() || vault.locked()) return 0;   // gesperrter Tresor: keine Geburtsdaten – nach dem Entsperren nachholen
    running = true;
    try {
      const day = today(), due = occasions(day, fees.addDays(day, lead())).filter(o => !o.done_at && !o.reminded_at);
      if (!due.length) return 0;
      // erst vermerken, dann senden: so geht jede Erinnerung höchstens einmal hinaus – auch wenn Clubwerk mitten im Versand neu startet
      const mark = db.prepare(`INSERT INTO mv_congrats(member_id, kind, dept_id, date, n, reminded_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(member_id, kind, dept_id, date) DO UPDATE SET reminded_at = excluded.reminded_at WHERE mv_congrats.reminded_at IS NULL`);
      const now = nowTs();
      const fresh = db.transaction(() => due.filter(o => mark.run(o.member_id, o.kind, o.dept_id, o.date, o.n, now).changes > 0))();
      if (!fresh.length) return 0;
      const line = o => `${wdDate(o.date)} ${lf(o.name)}: ${label(o, true)}${o.plan ? ' – ' + o.plan : ''}`;
      let mails = 0, pushes = 0;
      for (const u of recipients()) {
        const c = channels(u), list = fresh.filter(o => o.member_id !== u.member_id);   // nie an den eigenen Geburtstag erinnern
        if (!list.length) continue;
        const title = list.length === 1 ? C.T('Gratulation am {0}', [wdDate(list[0].date)]) : C.T('{0} Gratulationen stehen an', [list.length]);
        if (c.push && c.linked) {
          const body = list.length === 1 ? line(list[0]).slice(wdDate(list[0].date).length + 1) : list.slice(0, 3).map(line).join(' · ') + (list.length > 3 ? ' …' : '');
          pushes++;
          await C.push.send([u.member_id], 'gratulation', { title, body, url: './', tag: `gratulation-${day}` }).catch(e => console.error('Gratulationen – Push:', e.message));
        }
        if (c.mail && c.address && C.mail.ready()) {
          await C.mail.send({ to: c.address, subject: title,
            text: [C.T('Diese Gratulationen stehen in den nächsten Tagen an:'), '', ...list.map(line), '', C.T('Wer sich kümmert und was erledigt ist, steht in der Verwaltung unter Mitglieder › Gratulationen.')].join('\n'),
            card: { heading: C.T('Gratulationen'), before: C.T('Diese Gratulationen stehen in den nächsten Tagen an:'), rows: list.map(o => [wdDate(o.date), line(o).slice(wdDate(o.date).length + 1)]),
              after: C.T('Wer sich kümmert und was erledigt ist, steht in der Verwaltung unter Mitglieder › Gratulationen.') } })
            .then(() => { mails++; }).catch(e => console.error('Gratulationen – Mail:', e.message));
        }
      }
      C.audit(null, 'Gratulationen: Erinnerung verschickt', `${fresh.length} ${fresh.length === 1 ? 'Anlass' : 'Anlässe'} · ${mails} E-Mail(s) · Push an ${pushes} Person(en)`);
      return fresh.length;
    } finally { running = false; }
  }
  vault.onUnlock(() => { remind().catch(() => {}); });

  /* ---------- Verwaltung ---------- */
  const admin = C.admin;
  const view = o => ({ key: o.key, member_id: o.member_id, name: o.name, kind: o.kind, dept: o.dept, date: o.date, n: o.n, title: o.title || null, plan: o.plan, who: o.who, note: o.note, done_at: o.done_at, done_by: o.done_by, honor_id: o.honor_id, reminded: Boolean(o.reminded_at) });
  admin.get('/congrats', PG, (req, res) => {
    const u = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.user.id) || {};
    res.json({ rows: upcoming().map(view), days: lead(), today: today(), ahead: AHEAD, me: channels(u), mailReady: C.mail.ready(), pushOn: C.push.enabled('gratulation') });
  });
  /** Mitglieder zur Auswahl (Anlass von Hand) – nur Name, nur aktuelle Mitglieder */
  admin.get('/congrats/members', PG, (req, res) => res.json(db.prepare(`SELECT m.id, m.name FROM members m LEFT JOIN mv_person p ON p.member_id = m.id
    WHERE m.kind = 'mitglied' AND m.deleted = 0 AND p.anonymized_at IS NULL AND (p.exit_date IS NULL OR p.exit_date >= ?)`).all(today()).map(r => ({ id: r.id, name: lf(r.name) })).sort((a, b) => a.name.localeCompare(b.name, 'de'))));
  /** Je Anlass: wer kümmert sich, erledigt, Notiz – erledigtes Jubiläum auf Wunsch als Ehrung */
  admin.put('/congrats', PG, (req, res) => {
    const b = req.body || {}, o = findOcc(b.key);
    if (!o) return bad(res, 'Diesen Anlass gibt es nicht (mehr).', 404);
    const r = ensureRow(o), done = b.done === undefined ? Boolean(r.done_at) : Boolean(b.done);
    const v = { who: b.who !== undefined ? one(b.who, 60) || null : r.who, note: b.note !== undefined ? txt(b.note, 300) || null : r.note };
    let honorId = r.honor_id;
    db.transaction(() => {
      if (done && b.honor && !honorId && (o.kind === 'verein' || o.kind === 'abteilung')) {
        const name = one(b.honor_name, 120) || [o.plan, label(o)].filter(Boolean).join(' – ');
        honorId = Number(db.prepare('INSERT INTO mv_honor(member_id, name, date, note) VALUES (?,?,?,?)').run(o.member_id, name, o.date, null).lastInsertRowid);
        store.hist(o.member_id, uname(req), 'Ehrung', null, name);
      }
      db.prepare('UPDATE mv_congrats SET who = ?, note = ?, done_at = ?, done_by = ?, honor_id = ? WHERE id = ?')
        .run(v.who, v.note, done ? r.done_at || nowTs() : null, done ? r.done_by || uname(req) : null, honorId, r.id);
    })();
    const after = { who: v.who || '', note: v.note || '', done: done ? '1' : '0' }, before = { who: r.who || '', note: r.note || '', done: r.done_at ? '1' : '0' };
    const diff = C.auditDiff({ who: 'Wer kümmert sich?', note: ['Notiz', 'text'], done: ['Erledigt', 'bool'] }, before, after);
    if (diff || honorId !== r.honor_id) C.audit(req.user, 'Gratulation geändert', `${lf(o.name)}, ${label(o, true)} am ${deD(o.date)}${diff ? ': ' + diff : ''}${honorId !== r.honor_id ? ' · als Ehrung eingetragen' : ''}`);
    res.json({ ok: true, honor: honorId !== r.honor_id });
  });
  /** Anlass von Hand ergänzen (z. B. Goldene Hochzeit) */
  admin.post('/congrats', PG, (req, res) => {
    const b = req.body || {}, id = int(b.member_id), title = one(b.title, 60);
    const m = db.prepare(`SELECT m.id, m.name FROM members m LEFT JOIN mv_person p ON p.member_id = m.id WHERE m.id = ? AND m.kind = 'mitglied' AND m.deleted = 0 AND p.anonymized_at IS NULL`).get(id);
    if (!m) return bad(res, 'Bitte ein Mitglied wählen.');
    if (!fees.isDate(b.date)) return bad(res, 'Bitte ein Datum angeben.');
    if (title.length < 2) return bad(res, 'Bitte den Anlass eintragen.');
    if (db.prepare("SELECT 1 FROM mv_congrats WHERE member_id = ? AND kind = 'manuell' AND date = ?").get(id, b.date)) return bad(res, 'Für dieses Mitglied gibt es an diesem Tag schon einen Anlass.');
    store.ensurePerson(id);
    db.prepare("INSERT INTO mv_congrats(member_id, kind, dept_id, date, title, plan, created_by) VALUES (?, 'manuell', 0, ?, ?, ?, ?)").run(id, b.date, title, one(b.plan, 60) || null, uname(req));
    C.audit(req.user, 'Gratulation ergänzt', `${lf(m.name)}: ${title} am ${deD(b.date)}`);
    res.json({ ok: true });
  });
  admin.delete('/congrats', PG, (req, res) => {
    const x = parseKey((req.body || {}).key);
    const r = x && x.kind === 'manuell' ? db.prepare("SELECT c.*, m.name FROM mv_congrats c JOIN members m ON m.id = c.member_id WHERE c.member_id = ? AND c.kind = 'manuell' AND c.date = ?").get(x.member_id, x.date) : null;
    if (!r) return bad(res, 'Nur von Hand ergänzte Anlässe lassen sich löschen.', 404);
    db.prepare('DELETE FROM mv_congrats WHERE id = ?').run(r.id);
    C.audit(req.user, 'Gratulation gelöscht', `${lf(r.name)}: ${r.title} am ${deD(r.date)}`);
    res.json({ ok: true });
  });
  /** „Keine Gratulation gewünscht“ je Mitglied */
  admin.put('/congrats/off/:id', PG, (req, res) => {
    const id = int(req.params.id), on = Boolean((req.body || {}).off);
    const m = db.prepare("SELECT id, name FROM members WHERE id = ? AND kind = 'mitglied' AND deleted = 0").get(id);
    if (!m) return bad(res, 'Mitglied nicht gefunden.', 404);
    const was = Boolean(db.prepare('SELECT 1 FROM mv_congrats_off WHERE member_id = ?').get(id));
    if (on && !was) db.prepare('INSERT INTO mv_congrats_off(member_id, by_user, at) VALUES (?,?,?)').run(id, uname(req), nowTs());
    if (!on && was) db.prepare('DELETE FROM mv_congrats_off WHERE member_id = ?').run(id);
    if (on !== was) { store.hist(id, uname(req), 'Gratulation', on ? 'gewünscht' : 'keine gewünscht', on ? 'keine gewünscht' : 'gewünscht'); C.audit(req.user, 'Gratulation: Wunsch geändert', `${lf(m.name)}: ${on ? 'keine Gratulation gewünscht' : 'Gratulation wieder gewünscht'}`); }
    res.json({ ok: true });
  });
  /** eigene Erinnerung: E-Mail und/oder Push */
  admin.put('/congrats/me', PG, (req, res) => {
    const b = req.body || {}, before = prefOf(req.user.id);
    const after = { mail: b.mail === undefined ? before.mail : Boolean(b.mail), push: b.push === undefined ? before.push : Boolean(b.push) };
    db.prepare('INSERT INTO mv_congrats_pref(user_id, mail, push) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET mail = excluded.mail, push = excluded.push').run(req.user.id, after.mail ? 1 : 0, after.push ? 1 : 0);
    const diff = C.auditDiff({ mail: ['Erinnerung per E-Mail', 'bool'], push: ['Erinnerung per Push', 'bool'] }, { mail: before.mail ? '1' : '0', push: before.push ? '1' : '0' }, { mail: after.mail ? '1' : '0', push: after.push ? '1' : '0' });
    if (diff) C.audit(req.user, 'Gratulationen: eigene Erinnerung geändert', diff);
    res.json({ ok: true });
  });
  /** Einstellungen: Regeln und Vorlauf (Mitglieder › Einstellungen) – wer benachrichtigt wird, steht zur Kontrolle dabei */
  admin.get('/congrats/settings', C.need('mitglieder'), (req, res) => res.json({ rules: rules(), days: lead(), depts: db.prepare('SELECT id, name FROM mv_department WHERE active = 1 ORDER BY sort, name').all(),
    recipients: recipients().map(u => { const c = channels(u); return { name: u.name || u.username, mail: c.mail && Boolean(c.address), push: c.push && c.paired }; }).sort((a, b) => a.name.localeCompare(b.name, 'de')) }));
  const ruleText = r => `${C.T(KIND[r.kind])}${r.kind === 'abteilung' ? ` (${r.dept ? depts()[r.dept] || '?' : C.T('alle')})` : ''}: ${[...r.years, ...(r.from != null ? [C.T('ab {0} jedes Jahr', [r.from])] : [])].join(', ')}${r.what ? ' → ' + r.what : ''}`;
  admin.put('/congrats/settings', C.need('mitglieder'), (req, res) => {
    if ((req.user.deptOnly || []).includes('mitglieder')) return bad(res, 'Das macht die Vereinsverwaltung.', 403);
    const b = req.body || {}, before = { rules: rules().map(ruleText).join('; '), days: String(lead()) };
    if (b.rules !== undefined) {
      if (!Array.isArray(b.rules) || b.rules.length > 30) return bad(res, 'Bitte höchstens 30 Regeln.');
      const list = b.rules.map(cleanRule);
      if (list.some(r => !r)) return bad(res, 'Jede Regel braucht einen Anlass und bei „Wann“ mindestens eine Zahl (z. B. „70, 75, ab 80“).');
      SET('congrats_rules', JSON.stringify(list));
    }
    if (b.days !== undefined) { const n = int(b.days); if (n < 1 || n > 60) return bad(res, 'Die Erinnerung kommt 1 bis 60 Tage vorher.'); SET('congrats_days', n); }
    const after = { rules: rules().map(ruleText).join('; '), days: String(lead()) };
    const diff = [C.auditDiff({ days: 'Erinnerung an Gratulationen (Tage vorher)' }, before, after), after.rules !== before.rules ? `${C.T('Regeln für Gratulationen')}: ${after.rules || '–'}` : ''].filter(Boolean).join(' · ');
    if (diff) C.audit(req.user, 'Mitglieder: Einstellungen geändert', diff);
    remind().catch(() => {});
    res.json({ ok: true });
  });

  /* ---------- für Übersicht und Mitglied ---------- */
  /** Offene Anlässe bis zum Vorlauf → Hinweise auf der Startseite (nur mit Recht „Gratulationen“) */
  sh.congratsAlerts = user => {
    if (user && !(user.perms || []).includes('gratulationen')) return [];
    if (vault.locked()) return [];
    const d = today(), until = fees.addDays(d, lead());
    return upcoming().filter(o => !o.done_at && o.date <= until).map(o => ({ level: 'a', text: `${C.T('Gratulation')} ${o.date < d ? C.T('war am {0}', [wdDate(o.date)]) : o.date === d ? C.T('heute') : wdDate(o.date)}: ${lf(o.name)} – ${o.label}${o.plan ? ' · ' + o.plan : ''}`,
      sec: ['tab_mitglieder', 'gratulationen'], link: 'Ansehen' }));
  };
  sh.congratsOff = id => Boolean(db.prepare('SELECT 1 FROM mv_congrats_off WHERE member_id = ?').get(id));
  sh.congratsOf = id => db.prepare('SELECT kind, date, title, who, note, done_at FROM mv_congrats WHERE member_id = ? ORDER BY date DESC').all(id);
  sh.congratsForget = id => { db.prepare('DELETE FROM mv_congrats WHERE member_id = ?').run(id); db.prepare('DELETE FROM mv_congrats_off WHERE member_id = ?').run(id); };

  C.hooks.pushEvents = () => [{ id: 'gratulation', label: 'Gratulation steht an', desc: 'Nur für Verwaltungsnutzer mit dem Recht „Gratulationen“, deren Konto mit einem Mitglied verknüpft ist – einige Tage vor Geburtstagen und Jubiläen.', default: true }];
  setTimeout(() => remind().catch(() => {}), process.env.CW_TEST_FAST ? 1500 : 20000).unref();
  setInterval(() => remind().catch(() => {}), process.env.CW_TEST_FAST ? 1500 : 60 * 60000).unref();
}

module.exports = { register, DEFAULT_RULES, dayIn, hits };   // dayIn/hits für die Testreihe „grat“
