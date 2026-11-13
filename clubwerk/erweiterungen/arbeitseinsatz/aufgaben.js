'use strict';
/* =====================================================================================================
   Aufgaben mit Verantwortlichem und Frist (Modul „Dienste & Termine“, Reiter „Aufgaben“)
   Der Vorstand teilt eine Aufgabe einer Person zu und setzt eine Frist; die Person hakt sie in der Mitglieder-App ab.
   Keine Stunden, keine Schichten, keine Auswertung je Person. Sichtbar nur für die zugeteilte Person und die Verwaltung.
   ===================================================================================================== */
const { today, isDate, addDays, deD } = require('../../src/util');

const MAX_OPEN = 200;       // höchstens so viele offene Aufgaben je Verein (Missbrauchsschutz)
const DONE_DAYS = 30;       // in der App bleiben erledigte Aufgaben so lange sichtbar
const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f<>]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, max);

function tables(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS aw_task (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, note TEXT, member_id INTEGER REFERENCES members(id), due TEXT NOT NULL, remind_days INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'offen',               -- offen | erledigt (zurückgegeben = offen ohne Person)
  done_at TEXT, done_by TEXT, feedback TEXT, returned_from INTEGER, returned_at TEXT,
  reminded INTEGER NOT NULL DEFAULT 0, overdue_reminded INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_awt_member ON aw_task(member_id, status);
CREATE INDEX IF NOT EXISTS ix_awt_status ON aw_task(status, due);
`);
}

/** Tage von heute bis zur Frist (negativ = überfällig) */
const daysTo = due => Math.round((Date.parse(due + 'T12:00:00Z') - Date.parse(today() + 'T12:00:00Z')) / 86400000);

/** Wortlaut der Frist für Chip und Meldung: „überfällig“, „heute“, „morgen“, „in 6 Tagen“ */
function dueChip(due) {
  const d = daysTo(due);
  return d < 0 ? 'überfällig' : d === 0 ? 'heute fällig' : d === 1 ? 'morgen fällig' : `in ${d} Tagen fällig`;
}

function activate(ctx, h) {
  const db = ctx.db, { bad, int, rateLimit } = ctx, { P, admin, M, uname, tellAdmins, S, SET } = h;
  tables(db);
  const ACTIVE = "m.kind = 'mitglied' AND m.active = 1 AND m.deleted = 0 AND m.pending = 0";
  const fmt = r => ({ id: r.id, title: r.title, note: r.note || '', member_id: r.member_id, name: r.name || null, due: r.due, remind_days: r.remind_days, status: r.status, done_at: r.done_at, done_by: r.done_by,
    feedback: r.feedback || '', returned: Boolean(r.returned_at), returned_name: r.returned_name || null, overdue: r.status === 'offen' && r.due < today(), days: daysTo(r.due) });
  const SEL = 'SELECT t.*, m.name AS name, rm.name AS returned_name FROM aw_task t LEFT JOIN members m ON m.id = t.member_id LEFT JOIN members rm ON rm.id = t.returned_from';
  const openCount = () => db.prepare("SELECT COUNT(*) n FROM aw_task WHERE status = 'offen'").get().n;
  const LABELS = { title: 'Titel', note: ['Notiz', 'text'], member_id: 'Verantwortlich', due: 'Frist', remind_days: 'Erinnerung (Tage vorher)' };
  const memberName = id => (db.prepare('SELECT name FROM members WHERE id = ?').get(id) || {}).name || '';

  const input = (b, old) => {
    const o = { title: txt(b.title, 120), note: txt(b.note, 500) || null, due: b.due, remind_days: b.remind_days === undefined || b.remind_days === '' ? 3 : int(b.remind_days) };
    if (o.title.length < 2) return { error: 'Bitte eintragen, was zu tun ist (z. B. „Pokale bestellen“).' };
    if (!isDate(o.due)) return { error: 'Bitte eine Frist angeben.' };
    if (!(o.remind_days >= 0 && o.remind_days <= 30)) return { error: 'Die Erinnerung geht von 0 bis 30 Tage vor der Frist.' };
    const mid = b.member_id === undefined && old ? old.member_id : b.member_id ? int(b.member_id) : null;
    if (mid && !db.prepare('SELECT 1 FROM members m WHERE m.id = ? AND ' + ACTIVE).get(mid)) return { error: 'Bitte ein Mitglied wählen.' };
    o.member_id = mid || null;
    return { v: o };
  };

  /* ------------------------------------------------------------------ Verwaltung */
  admin.get('/tasks', P, (req, res) => {
    const today_ = today();
    const c = db.prepare("SELECT COALESCE(SUM(status = 'offen'), 0) offen, COALESCE(SUM(status = 'offen' AND due < ?), 0) ueber, COALESCE(SUM(status = 'erledigt'), 0) erledigt, COUNT(*) alle FROM aw_task").get(today_);
    const f = ['offen', 'ueberfaellig', 'erledigt', 'alle'].includes(req.query.f) ? req.query.f : 'offen';
    const where = f === 'offen' ? "t.status = 'offen'" : f === 'ueberfaellig' ? "t.status = 'offen' AND t.due < ?" : f === 'erledigt' ? "t.status = 'erledigt'" : '1 = 1';
    const order = f === 'erledigt' ? 't.done_at DESC, t.id DESC' : "(t.status = 'offen' AND t.due < ?) DESC, t.status, t.due, t.id";
    const args = [...(f === 'ueberfaellig' ? [today_] : []), ...(f === 'erledigt' ? [] : [today_])];
    const sql = `${SEL} WHERE ${where} ORDER BY ${order} LIMIT 500`;
    res.json({ counts: { offen: c.offen, ueberfaellig: c.ueber, erledigt: c.erledigt, alle: c.alle }, items: db.prepare(sql).all(...args).map(fmt) });
  });
  admin.post('/tasks', P, (req, res) => {
    const r = input(req.body || {}); if (r.error) return bad(res, r.error);
    if (openCount() >= MAX_OPEN) return bad(res, `Es sind schon ${MAX_OPEN} Aufgaben offen – bitte zuerst erledigte abhaken oder löschen.`);
    const id = Number(db.prepare('INSERT INTO aw_task(title, note, member_id, due, remind_days, created_by) VALUES (?,?,?,?,?,?)').run(r.v.title, r.v.note, r.v.member_id, r.v.due, r.v.remind_days, uname(req)).lastInsertRowid);
    ctx.audit(req.user, 'Aufgabe angelegt', `${r.v.title} – ${r.v.member_id ? memberName(r.v.member_id) : 'ohne Person'}, Frist ${deD(r.v.due)}`);
    res.json({ id });
  });
  admin.put('/tasks/:id', P, (req, res) => {
    const t = db.prepare('SELECT * FROM aw_task WHERE id = ?').get(int(req.params.id)); if (!t) return bad(res, 'Nicht gefunden.', 404);
    const r = input({ ...t, ...(req.body || {}) }, t); if (r.error) return bad(res, r.error);
    // neue Person oder neue Frist: die Erinnerungen gelten neu
    const again = r.v.member_id !== t.member_id || r.v.due !== t.due || r.v.remind_days !== t.remind_days;
    db.prepare(`UPDATE aw_task SET title = ?, note = ?, member_id = ?, due = ?, remind_days = ?${again ? ', reminded = 0, overdue_reminded = 0' : ''}${r.v.member_id !== t.member_id ? ', returned_from = NULL, returned_at = NULL' : ''} WHERE id = ?`)
      .run(r.v.title, r.v.note, r.v.member_id, r.v.due, r.v.remind_days, t.id);
    const name = id => (id ? memberName(id) : 'ohne Person');
    const d = ctx.auditDiff(LABELS, { ...t, member_id: name(t.member_id) }, { ...r.v, member_id: name(r.v.member_id) });
    if (d) ctx.audit(req.user, 'Aufgabe geändert', `${t.title}: ${d}`);
    res.json({ ok: true });
  });
  /* Erledigt-Haken für jemand anderen (und Wieder öffnen) */
  admin.post('/tasks/:id/done', P, (req, res) => {
    const t = db.prepare('SELECT * FROM aw_task WHERE id = ?').get(int(req.params.id)); if (!t) return bad(res, 'Nicht gefunden.', 404);
    const done = (req.body || {}).done !== false;
    if (done) db.prepare("UPDATE aw_task SET status = 'erledigt', done_at = datetime('now','localtime'), done_by = ?, feedback = COALESCE(?, feedback) WHERE id = ?").run(uname(req), txt((req.body || {}).feedback, 140) || null, t.id);
    else db.prepare("UPDATE aw_task SET status = 'offen', done_at = NULL, done_by = NULL, reminded = 0, overdue_reminded = 0 WHERE id = ?").run(t.id);
    ctx.audit(req.user, done ? 'Aufgabe erledigt' : 'Aufgabe wieder geöffnet', t.title);
    res.json({ ok: true });
  });
  admin.delete('/tasks/:id', P, (req, res) => {
    const t = db.prepare('SELECT * FROM aw_task WHERE id = ?').get(int(req.params.id)); if (!t) return bad(res, 'Nicht gefunden.', 404);
    db.prepare('DELETE FROM aw_task WHERE id = ?').run(t.id);
    ctx.audit(req.user, 'Aufgabe gelöscht', t.title);
    res.json({ ok: true });
  });

  /* ------------------------------------------------------------------ Mitglieder-App: nur die eigenen Aufgaben */
  /** Eigene offene und zuletzt erledigte Aufgaben – wird mit „me“ mitgeliefert (eine Abfrage mit Index) */
  const mine = id => db.prepare(`SELECT * FROM aw_task WHERE member_id = ? AND (status = 'offen' OR (status = 'erledigt' AND done_at >= datetime('now','localtime', ?))) ORDER BY (status = 'offen') DESC, due, id LIMIT 60`)
    .all(id, `-${DONE_DAYS} days`).map(t => ({ id: t.id, title: t.title, note: t.note || '', due: t.due, status: t.status, done_at: t.done_at, feedback: t.feedback || '', overdue: t.status === 'offen' && t.due < today(), days: daysTo(t.due), chip: t.status === 'offen' ? dueChip(t.due) : '' }));
  const own = (id, mid) => db.prepare('SELECT * FROM aw_task WHERE id = ? AND member_id = ?').get(int(id), mid);   // nur die eigene – eine fremde Nummer ist „nicht gefunden“
  M.post('/tasks/done', rateLimit('awtask', 60, 60000), (req, res) => {
    const b = req.body || {}, t = own(b.id, req.member.id); if (!t) return bad(res, 'Diese Aufgabe gibt es nicht (mehr).', 404);
    if (b.undo) {
      if (t.status !== 'erledigt') return res.json({ ok: true });
      db.prepare("UPDATE aw_task SET status = 'offen', done_at = NULL, done_by = NULL, reminded = 0, overdue_reminded = 0 WHERE id = ?").run(t.id);
      ctx.audit({ username: 'app', name: req.member.name }, 'Aufgabe wieder geöffnet', `${t.title} (${req.member.name})`);
      return res.json({ ok: true });
    }
    if (t.status === 'erledigt') return res.json({ ok: true });
    db.prepare("UPDATE aw_task SET status = 'erledigt', done_at = datetime('now','localtime'), done_by = 'mitglied', feedback = ? WHERE id = ?").run(txt(b.feedback, 140) || null, t.id);
    ctx.audit({ username: 'app', name: req.member.name }, 'Aufgabe erledigt', `${t.title} (${req.member.name})`);
    res.json({ ok: true });
  });
  /* „Kann ich nicht“: die Aufgabe bleibt offen, hat aber keine Person mehr; die Verwaltung bekommt Bescheid */
  M.post('/tasks/return', rateLimit('awtask', 60, 60000), (req, res) => {
    const b = req.body || {}, t = own(b.id, req.member.id); if (!t || t.status !== 'offen') return bad(res, 'Diese Aufgabe gibt es nicht (mehr).', 404);
    const why = txt(b.feedback, 140);
    db.prepare("UPDATE aw_task SET member_id = NULL, returned_from = ?, returned_at = datetime('now','localtime'), feedback = ?, reminded = 0, overdue_reminded = 0 WHERE id = ?").run(req.member.id, why || null, t.id);
    ctx.audit({ username: 'app', name: req.member.name }, 'Aufgabe zurückgegeben', `${t.title} (${req.member.name})${why ? ': ' + why : ''}`);
    tellAdmins(`Aufgabe zurückgegeben: ${t.title}`, [`${req.member.name} hat in der Mitglieder-App eine Aufgabe zurückgegeben:`, '', t.title, `Frist: ${deD(t.due)}`, ...(why ? [`Rückmeldung: ${why}`] : []), '',
      'Die Aufgabe ist jetzt ohne Person – bitte neu zuteilen unter „Dienste & Termine › Aufgaben“.']);
    res.json({ ok: true });
  });

  /* ------------------------------------------------------------------ für den Kern */
  /** „Für mich › Zu erledigen“: die eigenen offenen Aufgaben, die fälligsten zuerst (höchstens 5, dazu „+N weitere“) mit Knopf „Erledigt“ */
  const forMe = id => {
    const rows = db.prepare("SELECT * FROM aw_task WHERE member_id = ? AND status = 'offen' ORDER BY due, id LIMIT 6").all(id);
    const total = rows.length > 5 ? db.prepare("SELECT COUNT(*) n FROM aw_task WHERE member_id = ? AND status = 'offen'").get(id).n : rows.length;
    const out = rows.slice(0, 5).map(t => ({ title: t.title, sub: `bis ${deD(t.due).slice(0, 6)}`, chip: dueChip(t.due), focus: 'aufgaben',
      actions: [{ label: '✓', aria: 'Als erledigt markieren', post: 'tasks/done', body: { id: t.id }, kind: 'y' }] }));
    if (total > 5) out.push({ title: `+ ${total - 5} weitere Aufgaben`, sub: '', focus: 'aufgaben', tr: true });
    return out;
  };
  const retention = () => [{ id: 'aufgaben', label: 'Erledigte Aufgaben', text: 'Offene Aufgaben bleiben.', unit: 'monate', value: Math.max(1, Math.min(60, parseInt(S('task_keep_months', '12'), 10) || 12)), def: 12, min: 1, max: 60,
    due: cut => db.prepare("SELECT COUNT(*) n FROM aw_task WHERE status = 'erledigt' AND done_at < ?").get(cut).n,
    purge: cut => db.prepare("DELETE FROM aw_task WHERE status = 'erledigt' AND done_at < ?").run(cut).changes, set: v => SET('task_keep_months', v) }];
  const memberData = id => db.prepare('SELECT title AS aufgabe, note AS notiz, due AS frist, status, done_at AS erledigt, feedback AS rueckmeldung FROM aw_task WHERE member_id = ? ORDER BY due').all(id);
  /* Konto zusammengeführt: Aufgaben wandern mit; Konto gelöscht: Aufgaben bleiben ohne Person (offene werden neu zugeteilt, erledigte laufen nach der Frist aus) */
  const memberRemoved = (fromId, intoId) => {
    db.prepare('UPDATE aw_task SET member_id = ? WHERE member_id = ?').run(intoId || null, fromId);
    db.prepare('UPDATE aw_task SET returned_from = ? WHERE returned_from = ?').run(intoId || null, fromId);
  };
  const overdueAlert = () => { const n = db.prepare("SELECT COUNT(*) n FROM aw_task WHERE status = 'offen' AND due < ?").get(today()).n; return n ? [{ level: 'a', text: n === 1 ? '1 Aufgabe ist überfällig.' : `${n} Aufgaben sind überfällig.` }] : []; };

  /* ------------------------------------------------------------------ Erinnerungen: einmal vor der Frist, einmal danach (stündlich geprüft, je Aufgabe höchstens zwei) */
  async function daily({ mailOk, mailOf, club }) {
    const t0 = today();
    const send = async (t, title, body, mailLine) => {
      ctx.push.send([t.member_id], 'aufgabe', { title, body, url: './#arbeitseinsatz', tag: `aw-task-${t.id}` }).catch(() => {});
      const m = mailOk ? await mailOf(t.member_id) : null;
      if (m && m.email) await ctx.mail.send({ to: m.email, subject: `${title} – ${club || 'Verein'}`, text: ['Hallo,', '', mailLine, '', 'Du findest die Aufgabe in der Mitglieder-App unter „Für mich“ und „Dienste“.', '', club].join('\n') }).catch(() => {});
    };
    for (const t of db.prepare("SELECT * FROM aw_task WHERE status = 'offen' AND member_id IS NOT NULL AND reminded = 0 AND remind_days > 0 AND due >= ?").all(t0)) {
      if (t.due > addDays(t0, t.remind_days)) continue;
      db.prepare('UPDATE aw_task SET reminded = 1 WHERE id = ?').run(t.id);
      await send(t, `Aufgabe: ${t.title}`, `${dueChip(t.due)[0].toUpperCase()}${dueChip(t.due).slice(1)} – bis ${deD(t.due)}`, `eine Aufgabe von dir ist bald fällig: „${t.title}“ bis ${deD(t.due)}.`);
    }
    for (const t of db.prepare("SELECT * FROM aw_task WHERE status = 'offen' AND member_id IS NOT NULL AND overdue_reminded = 0 AND due < ?").all(t0)) {
      db.prepare('UPDATE aw_task SET overdue_reminded = 1, reminded = 1 WHERE id = ?').run(t.id);
      await send(t, `Aufgabe überfällig: ${t.title}`, `Die Frist war am ${deD(t.due)}.`, `die Frist einer Aufgabe von dir ist abgelaufen: „${t.title}“ (bis ${deD(t.due)}). Bitte erledige sie oder gib sie in der App zurück.`);
    }
  }

  return { mine, forMe, retention, memberData, memberRemoved, overdueAlert, daily, DONE_DAYS };
}

module.exports = { activate };
