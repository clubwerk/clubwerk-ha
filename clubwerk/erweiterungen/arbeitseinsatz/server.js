'use strict';
/* =====================================================================================================
   Modul „Arbeitseinsatz & Thekendienst“
   Einsätze und Thekendienste planen, Mitglieder tragen sich in der App ein, stempeln am Tablet oder melden ihre Stunden.
   Soll je Mitglied (Vorgabe, Beitragsart, Alter, eigene Ausnahme), Ist aus bestätigten Stunden, Familien gemeinsam.
   Nicht geleistete Stunden landen im Beitragslauf der Mitgliederverwaltung (Stundensatz).
   ===================================================================================================== */
let C;
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowTs = () => { const d = new Date(); return `${today()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const deD = s => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '');
const hm = m => `${Math.floor(Math.abs(m) / 60)}:${pad(Math.abs(m) % 60)} h`;
const txt = (v, max = 120) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const ageAt = (b, day) => { if (!isDate(b)) return null; let a = +day.slice(0, 4) - +b.slice(0, 4); if (day.slice(5) < b.slice(5)) a--; return a; };
const MIN_COUNT = 5;   // Einsätze unter 5 Minuten werden nicht gewertet
const KIND = { arbeit: 'Arbeitseinsatz', theke: 'Thekendienst', sonstiges: 'Sonstiges' };

function tables(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS aw_event (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'arbeit', title TEXT NOT NULL, date TEXT NOT NULL, start TEXT, end TEXT, place TEXT,
  slots INTEGER, note TEXT, cancelled INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS aw_signup (
  id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES aw_event(id), member_id INTEGER NOT NULL REFERENCES members(id), reminded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), UNIQUE(event_id, member_id)
);
CREATE TABLE IF NOT EXISTS aw_entry (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), event_id INTEGER REFERENCES aw_event(id),
  date TEXT NOT NULL, minutes INTEGER, text TEXT, in_at TEXT, out_at TEXT,
  status TEXT NOT NULL DEFAULT 'offen',              -- laeuft | offen | bestaetigt | abgelehnt
  source TEXT NOT NULL DEFAULT 'verwaltung',         -- verwaltung | app | tablet
  by_user TEXT, reviewed_by TEXT, reviewed_at TEXT, reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_awe_member ON aw_entry(member_id, date);
CREATE TABLE IF NOT EXISTS aw_exempt (member_id INTEGER NOT NULL PRIMARY KEY REFERENCES members(id), note TEXT, until_date TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS aw_target (member_id INTEGER NOT NULL REFERENCES members(id), year INTEGER NOT NULL, minutes INTEGER, note TEXT, PRIMARY KEY(member_id, year));
`);
}

function activate(ctx) {
  const NK = n => ctx.require('./db').nameKey(n, 'mitglied');   // Sortierung: Nachname, Vorname
  C = ctx;
  const db = ctx.db;
  tables(db);
  const { need, bad, int, rateLimit } = ctx;
  const S = (k, d = '') => ctx.getSetting('ext_arbeitseinsatz_' + k, d);
  const SET = (k, v) => ctx.setSetting('ext_arbeitseinsatz_' + k, String(v));
  const P = need('arbeitseinsatz');
  const admin = ctx.admin, T = ctx.tablet, M = ctx.member;
  // Dauerhafte Einsätze (z. B. Thekendienst): ganzjährig ohne festen Termin, am Tablet wählbar solange aktiv
  if (!db.prepare('PRAGMA table_info(aw_event)').all().some(c => c.name === 'permanent')) db.exec('ALTER TABLE aw_event ADD COLUMN permanent INTEGER NOT NULL DEFAULT 0');
  if (S('seed_theke') !== '1') {
    if (!db.prepare("SELECT 1 FROM aw_event WHERE permanent = 1 AND kind = 'theke'").get()) db.prepare("INSERT INTO aw_event(kind, title, date, permanent, created_by) VALUES ('theke', 'Thekendienst', date('now','localtime'), 1, 'Clubwerk')").run();
    SET('seed_theke', '1');
  }
  const uname = req => req.user.name || req.user.username;
  const ar = fn => ctx.asyncRoute(fn);
  const cfg = () => ({
    default_minutes: parseInt(S('default_minutes', '240'), 10) || 0, min_age: parseInt(S('min_age', '12'), 10) || 0, max_age: parseInt(S('max_age', '0'), 10) || 0,
    rate_cents: parseInt(S('rate_cents', '1500'), 10) || 0, pool_family: S('pool_family', '1') === '1', exempt_passive: S('exempt_passive', '1') === '1',
    year_mode: S('year_mode', 'kalender') === 'beitrag' ? 'beitrag' : 'kalender', prorate: S('prorate', '1') === '1', tablet_auto: S('tablet_auto', '1') === '1',
    app_report: S('app_report', '1') === '1', start_year: parseInt(S('start_year', '0'), 10) || 0, remind_date: S('remind_date', ''), remind_events: S('remind_events', '1') === '1', round: parseInt(S('round', '15'), 10) || 1, text: S('text', ''),
  });
  const mv = () => ctx.isModuleActive('mitglieder');
  const hook = async (name, ...a) => { const r = await ctx.callHooks(name, ...a); const x = r.find(y => y.id === 'mitglieder'); return x ? x.result : null; };
  const yearStart = () => (cfg().year_mode === 'beitrag' ? ctx.getSetting('ext_mitglieder_year_start', '01-01') : '01-01');
  /** Jahr Y → Zeitraum [from, to] */
  const period = y => { const ys = yearStart(); return { from: `${y}-${ys}`, to: addDays(`${y + 1}-${ys}`, -1) }; };
  const yearOf = day => { const ys = yearStart(); return day.slice(5) >= ys ? +day.slice(0, 4) : +day.slice(0, 4) - 1; };
  const yearLabel = y => (yearStart() === '01-01' ? String(y) : `${y}/${String(y + 1).slice(2)}`);
  // abgerechnet wird erst ab dem Jahr, in dem das Modul eingeführt wurde (frühere Jahre hat niemand erfasst)
  if (!S('start_year')) SET('start_year', yearOf(today()));

  /* ---------------------------------------------------------------- Soll / Ist */
  function people() {
    return db.prepare(`SELECT m.id, m.name, m.active FROM members m WHERE m.kind = 'mitglied' AND m.deleted = 0 AND m.pending = 0 ORDER BY name_key(m.name, m.kind)`).all();
  }
  /** Soll in Minuten für ein Mitglied im Jahr y → { minutes, why } */
  async function target(id, y, info) {
    const c = cfg(); const per = period(y);
    const ov = db.prepare('SELECT * FROM aw_target WHERE member_id = ? AND year = ?').get(id, y);
    if (ov && ov.minutes != null) return { minutes: ov.minutes, why: ov.note ? `Ausnahme: ${ov.note}` : 'eigene Vorgabe' };
    // dauerhaft befreit: Stunden zählen weiter, aber kein Soll und nichts wird eingezogen
    const ex = db.prepare('SELECT * FROM aw_exempt WHERE member_id = ?').get(id);
    if (ex && (!ex.until_date || ex.until_date >= per.from)) return { minutes: 0, why: `befreit${ex.until_date ? ' bis ' + ex.until_date.split('-').reverse().join('.') : ''}${ex.note ? ': ' + ex.note : ''}`, exempt: true, until: ex.until_date, note: ex.note };
    const i = info !== undefined ? info : (mv() ? await hook('memberInfo', id) : null);
    let base = c.default_minutes, why = 'Vorgabe';
    if (i) {
      if (i.entry_date && i.entry_date > per.to) return { minutes: 0, why: 'noch nicht Mitglied' };
      if (i.exit_date && i.exit_date < per.from) return { minutes: 0, why: 'ausgetreten' };
      if (c.exempt_passive && ['passiv', 'ehren', 'ruhend'].includes(i.status)) return { minutes: 0, why: i.status === 'ehren' ? 'Ehrenmitglied' : 'passiv' };
      const a = ageAt(i.birth_date, per.from);
      if (a != null && c.min_age && a < c.min_age) return { minutes: 0, why: `unter ${c.min_age} Jahre` };
      if (a != null && c.max_age && a > c.max_age) return { minutes: 0, why: `über ${c.max_age} Jahre` };
      if (i.fee && i.fee.work_minutes != null) { base = i.fee.work_minutes; why = base ? `laut Beitrag „${i.fee.name}“` : `befreit („${i.fee.name}“)`; }
      if (base && c.prorate) {   // Ein-/Austritt im Jahr: anteilig nach vollen Monaten
        const from = i.entry_date && i.entry_date > per.from ? i.entry_date : per.from, to = i.exit_date && i.exit_date < per.to ? i.exit_date : per.to;
        const months = (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + (+to.slice(5, 7) - +from.slice(5, 7)) + 1;
        if (months < 12) { base = Math.round(base * Math.max(0, months) / 12 / c.round) * c.round; why += ` · anteilig ${months} Monate`; }
      }
    } else {
      const m = db.prepare('SELECT active FROM members WHERE id = ?').get(id);
      if (!m || !m.active) return { minutes: 0, why: 'ausgeblendet' };
    }
    return { minutes: base, why };
  }
  const doneMinutes = (ids, y) => { if (!ids.length) return 0; const p = period(y); return db.prepare(`SELECT COALESCE(SUM(minutes),0) n FROM aw_entry WHERE status = 'bestaetigt' AND date BETWEEN ? AND ? AND member_id IN (${ids.map(() => '?').join(',')})`).get(p.from, p.to, ...ids).n; };
  const openMinutes = (ids, y) => { if (!ids.length) return 0; const p = period(y); return db.prepare(`SELECT COALESCE(SUM(minutes),0) n FROM aw_entry WHERE status = 'offen' AND date BETWEEN ? AND ? AND member_id IN (${ids.map(() => '?').join(',')})`).get(p.from, p.to, ...ids).n; };

  /** Übersicht für ein Jahr: je Person und je Familie (Zahler) */
  async function overview(y) {
    const c = cfg();
    const rows = [];
    for (const p of people()) {
      const info = mv() ? await hook('memberInfo', p.id) : null;
      if (info && info.status === 'ausgetreten' && info.exit_date && info.exit_date < period(y).from) continue;
      const t = await target(p.id, y, info);
      const done = doneMinutes([p.id], y), open = openMinutes([p.id], y);
      const fam = mv() ? await hook('familyOf', p.id) : null;
      rows.push({ id: p.id, name: p.name, target: t.minutes, why: t.why, done, open, head: fam ? fam.head : p.id, exempt: Boolean(t.exempt), exempt_until: t.exempt ? t.until || null : null, exempt_note: t.exempt ? t.note || '' : '', override: Boolean(db.prepare('SELECT 1 FROM aw_target WHERE member_id = ? AND year = ? AND minutes IS NOT NULL').get(p.id, y)) });
    }
    const groups = new Map();
    for (const r of rows) { const k = c.pool_family ? r.head : r.id; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    const fams = [...groups.entries()].map(([head, list]) => {
      const tg = list.reduce((s, r) => s + r.target, 0), dn = list.reduce((s, r) => s + r.done, 0);
      const miss = Math.max(0, tg - dn);
      const hn = (rows.find(r => r.id === head) || list[0]).name;
      return { head, name: hn, members: list.map(r => r.id), target: tg, done: dn, open: list.reduce((s, r) => s + r.open, 0), missing: miss, cents: Math.round(miss / 60 * c.rate_cents) };
    }).filter(f => f.target > 0 || f.done > 0);
    for (const r of rows) { const f = fams.find(x => x.members.includes(r.id)); r.family = f && f.members.length > 1 ? f.head : null; }
    const p = period(y);
    return { year: y, label: yearLabel(y), from: p.from, to: p.to, closed: p.to < today(), rate_cents: c.rate_cents, pool: c.pool_family, rows, families: fams.sort((a, b) => b.missing - a.missing || NK(a.name).localeCompare(NK(b.name), 'de')),
      totals: { target: fams.reduce((s, f) => s + f.target, 0), done: fams.reduce((s, f) => s + f.done, 0), missing: fams.reduce((s, f) => s + f.missing, 0), cents: fams.reduce((s, f) => s + f.cents, 0), people: rows.filter(r => r.target > 0).length } };
  }

  /* ---------------------------------------------------------------- Verwaltung */
  admin.get('/meta', P, (req, res) => {
    const y = yearOf(today());
    res.json({ cfg: cfg(), year: y, years: [y + 1, y, y - 1, y - 2].map(v => ({ y: v, label: yearLabel(v) })), mv: mv(), today: today(), pending: db.prepare("SELECT COUNT(*) n FROM aw_entry WHERE status = 'offen'").get().n,
      running: db.prepare("SELECT COUNT(*) n FROM aw_entry WHERE status = 'laeuft'").get().n, members: people().filter(p => p.active).map(p => ({ id: p.id, name: p.name })) });
  });
  admin.get('/overview', P, ar(async (req, res) => res.json(await overview(int(req.query.year) || yearOf(today())))));
  admin.get('/overview.xlsx', P, ar(async (req, res) => {
    const o = await overview(int(req.query.year) || yearOf(today()));
    const ExcelJS = ctx.require('exceljs'); const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Arbeitsstunden ' + o.label);
    ws.columns = [{ header: 'Mitglied', width: 28 }, { header: 'Soll (h)', width: 10 }, { header: 'Geleistet (h)', width: 13 }, { header: 'Offen gemeldet (h)', width: 17 }, { header: 'Begründung Soll', width: 34 }];
    for (const r of o.rows) ws.addRow([r.name, r.target / 60, r.done / 60, r.open / 60, r.why]);
    ws.getRow(1).font = { bold: true };
    const ws2 = wb.addWorksheet(o.pool ? 'Familien' : 'Abrechnung');
    ws2.columns = [{ header: o.pool ? 'Zahler / Familie' : 'Mitglied', width: 28 }, { header: 'Soll (h)', width: 10 }, { header: 'Geleistet (h)', width: 13 }, { header: 'Fehlend (h)', width: 12 }, { header: 'Betrag (€)', width: 12 }];
    for (const f of o.families) ws2.addRow([f.name, f.target / 60, f.done / 60, f.missing / 60, f.cents / 100]);
    ws2.getRow(1).font = { bold: true };
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="Arbeitsstunden_${o.label.replace('/', '-')}.xlsx"` }).send(Buffer.from(await wb.xlsx.writeBuffer()));
  }));
  /* Dauerhafte Befreiung vom Arbeitseinsatz (Mitglied kann Stunden leisten, es wird aber nichts abgerechnet) */
  admin.get('/exempt', P, (req, res) => res.json(db.prepare('SELECT e.*, m.name FROM aw_exempt e JOIN members m ON m.id = e.member_id ORDER BY name_key(m.name, m.kind)').all()));
  admin.put('/exempt', P, (req, res) => {
    const b = req.body || {}; const id = int(b.member_id);
    const m = db.prepare("SELECT id, name FROM members WHERE id = ? AND kind = 'mitglied'").get(id); if (!m) return bad(res, 'Bitte ein Mitglied wählen.');
    if (b.until && !isDate(b.until)) return bad(res, 'Ungültiges Datum.');
    db.prepare('INSERT INTO aw_exempt(member_id, note, until_date, created_by) VALUES (?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET note = excluded.note, until_date = excluded.until_date').run(id, txt(b.note, 120) || null, b.until || null, uname(req));
    ctx.audit(req.user, 'Arbeitseinsatz: Mitglied befreit', `${m.name}${b.until ? ' bis ' + deD(b.until) : ''}${b.note ? ' – ' + txt(b.note, 120) : ''}`);
    res.json({ ok: true });
  });
  admin.delete('/exempt/:id', P, (req, res) => {
    const m = db.prepare('SELECT name FROM members WHERE id = ?').get(int(req.params.id));
    db.prepare('DELETE FROM aw_exempt WHERE member_id = ?').run(int(req.params.id));
    ctx.audit(req.user, 'Arbeitseinsatz: Befreiung aufgehoben', m ? m.name : '');
    res.json({ ok: true });
  });
  admin.put('/target', P, (req, res) => {
    const b = req.body || {}; const id = int(b.member_id), y = int(b.year);
    if (!db.prepare("SELECT 1 FROM members WHERE id = ? AND kind = 'mitglied'").get(id) || y < 2000) return bad(res, 'Nicht gefunden.', 404);
    if (b.minutes === null || b.minutes === '') db.prepare('DELETE FROM aw_target WHERE member_id = ? AND year = ?').run(id, y);
    else { const m = Math.round(Number(b.minutes)); if (!Number.isFinite(m) || m < 0 || m > 20000) return bad(res, 'Ungültige Stundenzahl.'); db.prepare('INSERT INTO aw_target(member_id, year, minutes, note) VALUES (?,?,?,?) ON CONFLICT(member_id, year) DO UPDATE SET minutes = excluded.minutes, note = excluded.note').run(id, y, m, txt(b.note, 80) || null); }
    ctx.audit(req.user, 'Arbeitsstunden: Soll geändert', `${db.prepare('SELECT name FROM members WHERE id = ?').get(id).name} ${y}: ${b.minutes == null || b.minutes === '' ? 'Standard' : hm(+b.minutes)}`);
    res.json({ ok: true });
  });

  /* Einsätze */
  const evInput = b => {
    const o = { kind: KIND[b.kind] ? b.kind : 'arbeit', title: txt(b.title, 80), date: b.date, start: isTime(b.start) ? b.start : null, end: isTime(b.end) ? b.end : null, place: txt(b.place, 80) || null, slots: b.slots ? Math.max(1, Math.min(500, int(b.slots))) : null, note: txt(b.note, 500) || null };
    if (o.title.length < 2) return { error: 'Bitte einen Titel eintragen.' };
    if (!isDate(o.date)) return { error: 'Bitte ein Datum angeben.' };
    if (o.start && o.end && o.end <= o.start) return { error: 'Das Ende liegt vor dem Beginn.' };
    return { v: o };
  };
  const eventRow = e => ({ ...e, signups: db.prepare('SELECT s.member_id, m.name FROM aw_signup s JOIN members m ON m.id = s.member_id WHERE s.event_id = ? ORDER BY name_key(m.name, m.kind)').all(e.id),
    hours: db.prepare("SELECT COUNT(*) n, COALESCE(SUM(minutes),0) min FROM aw_entry WHERE event_id = ? AND status IN ('offen','bestaetigt')").get(e.id) });
  admin.get('/events', P, (req, res) => {
    const past = req.query.past === '1';
    const perm = past && req.query.perm !== '1' ? [] : db.prepare('SELECT * FROM aw_event WHERE permanent = 1 ORDER BY cancelled, title COLLATE NOCASE').all();
    res.json([...perm, ...db.prepare(`SELECT * FROM aw_event WHERE permanent = 0 AND ${past ? 'date < ?' : 'date >= ?'} ORDER BY date ${past ? 'DESC' : 'ASC'}, start LIMIT 200`).all(today())].map(eventRow));
  });
  admin.post('/events', P, (req, res) => {
    const r = evInput({ ...(req.body || {}), ...((req.body || {}).permanent && !isDate((req.body || {}).date) ? { date: today() } : {}) }); if (r.error) return bad(res, r.error);
    const repeat = Math.max(0, Math.min(52, int((req.body || {}).repeat_weeks)));
    const ids = [];
    const perm = (req.body || {}).permanent ? 1 : 0;
    for (let i = 0; i <= (perm ? 0 : repeat); i++) { const v = { ...r.v, date: addDays(r.v.date, 7 * i), cancelled: (req.body || {}).active === false ? 1 : 0, permanent: perm }; const k = Object.keys(v); ids.push(Number(db.prepare(`INSERT INTO aw_event(${k.join(',')}, created_by) VALUES (${k.map(() => '?').join(',')}, ?)`).run(...k.map(x => v[x]), uname(req)).lastInsertRowid)); }
    ctx.audit(req.user, `${KIND[r.v.kind]} angelegt`, `${r.v.title} ${deD(r.v.date)}${repeat ? ` (+${repeat} Wochen)` : ''}`);
    res.json({ ids });
  });
  admin.put('/events/:id', P, (req, res) => {
    const e = db.prepare('SELECT * FROM aw_event WHERE id = ?').get(int(req.params.id)); if (!e) return bad(res, 'Nicht gefunden.', 404);
    const r = evInput({ ...e, ...(req.body || {}) }); if (r.error) return bad(res, r.error);
    const k = Object.keys(r.v);
    const b = req.body || {};
    const off = b.active !== undefined ? !b.active : b.cancelled !== undefined ? Boolean(b.cancelled) : Boolean(e.cancelled);
    const perm = b.permanent !== undefined ? (b.permanent ? 1 : 0) : e.permanent;
    db.prepare(`UPDATE aw_event SET ${k.map(x => `${x} = ?`).join(', ')}, cancelled = ?, permanent = ? WHERE id = ?`).run(...k.map(x => r.v[x]), off ? 1 : 0, perm, e.id);
    res.json({ ok: true });
  });
  /* aktivieren / deaktivieren: deaktivierte Einsätze stehen nicht am Tablet und nicht in der Mitglieder-App, es gibt keine Erinnerungen */
  admin.post('/events/:id/active', P, (req, res) => {
    const e = db.prepare('SELECT * FROM aw_event WHERE id = ?').get(int(req.params.id)); if (!e) return bad(res, 'Nicht gefunden.', 404);
    const on = Boolean((req.body || {}).active);
    db.prepare('UPDATE aw_event SET cancelled = ? WHERE id = ?').run(on ? 0 : 1, e.id);
    ctx.audit(req.user, on ? 'Einsatz aktiviert' : 'Einsatz deaktiviert', `${e.title} ${deD(e.date)}`);
    res.json({ ok: true, active: on });
  });
  admin.delete('/events/:id', P, (req, res) => {
    const e = db.prepare('SELECT * FROM aw_event WHERE id = ?').get(int(req.params.id)); if (!e) return bad(res, 'Nicht gefunden.', 404);
    if (db.prepare('SELECT 1 FROM aw_entry WHERE event_id = ?').get(e.id)) return bad(res, 'Zu diesem Einsatz gibt es schon Stunden – stattdessen deaktivieren.');
    db.prepare('DELETE FROM aw_signup WHERE event_id = ?').run(e.id); db.prepare('DELETE FROM aw_event WHERE id = ?').run(e.id);
    res.json({ ok: true });
  });
  admin.post('/events/:id/signup', P, (req, res) => {
    const e = db.prepare('SELECT * FROM aw_event WHERE id = ?').get(int(req.params.id)); const mid = int((req.body || {}).member_id);
    if (!e || !db.prepare('SELECT 1 FROM members WHERE id = ?').get(mid)) return bad(res, 'Nicht gefunden.', 404);
    if ((req.body || {}).remove) db.prepare('DELETE FROM aw_signup WHERE event_id = ? AND member_id = ?').run(e.id, mid);
    else db.prepare('INSERT OR IGNORE INTO aw_signup(event_id, member_id) VALUES (?,?)').run(e.id, mid);
    res.json({ ok: true });
  });
  /** Einsatz abschließen: allen Eingetragenen die Stunden gutschreiben */
  admin.post('/events/:id/close', P, (req, res) => {
    const e = db.prepare('SELECT * FROM aw_event WHERE id = ?').get(int(req.params.id)); if (!e) return bad(res, 'Nicht gefunden.', 404);
    const b = req.body || {}; const list = Array.isArray(b.members) ? b.members.map(Number) : [];
    const min = Math.round(Number(b.minutes)); if (!Number.isFinite(min) || min <= 0 || min > 1440) return bad(res, 'Bitte die Dauer angeben.');
    if (min < MIN_COUNT) return bad(res, 'Einsätze unter 5 Minuten werden nicht gewertet.');
    let n = 0;
    for (const mid of list) {
      if (!db.prepare('SELECT 1 FROM members WHERE id = ?').get(mid) || db.prepare("SELECT 1 FROM aw_entry WHERE event_id = ? AND member_id = ? AND status != 'abgelehnt'").get(e.id, mid)) continue;
      db.prepare("INSERT INTO aw_entry(member_id, event_id, date, minutes, text, status, source, by_user, reviewed_by, reviewed_at) VALUES (?,?,?,?,?, 'bestaetigt', 'verwaltung', ?, ?, ?)").run(mid, e.id, e.date, min, e.title, uname(req), uname(req), nowTs());
      n++;
    }
    ctx.audit(req.user, 'Arbeitsstunden gutgeschrieben', `${e.title} ${deD(e.date)}: ${n} × ${hm(min)}`);
    res.json({ ok: true, count: n });
  });

  /* Stunden */
  admin.get('/entries', P, (req, res) => {
    const q = req.query, w = [], a = [];
    if (q.status && q.status !== 'alle') { w.push('e.status = ?'); a.push(q.status); }
    if (q.member) { w.push('e.member_id = ?'); a.push(int(q.member)); }
    if (q.year) { const p = period(int(q.year)); w.push('e.date BETWEEN ? AND ?'); a.push(p.from, p.to); }
    res.json(db.prepare(`SELECT e.*, m.name, v.title AS event_title FROM aw_entry e JOIN members m ON m.id = e.member_id LEFT JOIN aw_event v ON v.id = e.event_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY e.status = 'offen' DESC, e.date DESC, e.id DESC LIMIT 1000`).all(...a));
  });
  const entryInput = (b, cur = {}) => {
    const o = { date: b.date !== undefined ? b.date : cur.date, minutes: b.minutes !== undefined ? Math.round(Number(b.minutes)) : cur.minutes, text: b.text !== undefined ? txt(b.text, 140) || null : cur.text || null, event_id: b.event_id !== undefined ? (b.event_id ? int(b.event_id) : null) : cur.event_id || null };
    if (!isDate(o.date) || o.date > today()) return { error: 'Bitte ein Datum (nicht in der Zukunft) angeben.' };
    if (!Number.isFinite(o.minutes) || o.minutes <= 0 || o.minutes > 1440) return { error: 'Bitte die Dauer angeben (höchstens 24 Stunden).' };
    if (o.minutes < MIN_COUNT) return { error: 'Einsätze unter 5 Minuten werden nicht gewertet.' };
    if (o.event_id && !db.prepare('SELECT 1 FROM aw_event WHERE id = ?').get(o.event_id)) return { error: 'Einsatz nicht gefunden.' };
    return { v: o };
  };
  admin.post('/entries', P, (req, res) => {
    const b = req.body || {}; const ids = (Array.isArray(b.member_ids) ? b.member_ids : [b.member_id]).map(Number).filter(Boolean);
    if (!ids.length) return bad(res, 'Bitte ein Mitglied wählen.');
    const r = entryInput(b); if (r.error) return bad(res, r.error);
    for (const mid of ids) db.prepare("INSERT INTO aw_entry(member_id, event_id, date, minutes, text, status, source, by_user, reviewed_by, reviewed_at) VALUES (?,?,?,?,?, 'bestaetigt', 'verwaltung', ?, ?, ?)").run(mid, r.v.event_id, r.v.date, r.v.minutes, r.v.text, uname(req), uname(req), nowTs());
    ctx.audit(req.user, 'Arbeitsstunden nachgetragen', `${ids.length} Mitglied(er), ${hm(r.v.minutes)} am ${deD(r.v.date)}`);
    res.json({ ok: true });
  });
  admin.put('/entries/:id', P, (req, res) => {
    const e = db.prepare('SELECT * FROM aw_entry WHERE id = ?').get(int(req.params.id)); if (!e) return bad(res, 'Nicht gefunden.', 404);
    if (e.status === 'laeuft') return bad(res, 'Dieser Einsatz läuft noch – erst ausstempeln.');
    const r = entryInput(req.body || {}, e); if (r.error) return bad(res, r.error);
    db.prepare('UPDATE aw_entry SET date = ?, minutes = ?, text = ?, event_id = ? WHERE id = ?').run(r.v.date, r.v.minutes, r.v.text, r.v.event_id, e.id);
    res.json({ ok: true });
  });
  admin.post('/entries/review', P, (req, res) => {
    const b = req.body || {}; const ids = Array.isArray(b.ids) ? b.ids.map(Number) : [];
    const st = b.approve ? 'bestaetigt' : 'abgelehnt';
    let n = 0;
    for (const id of ids) n += db.prepare("UPDATE aw_entry SET status = ?, reviewed_by = ?, reviewed_at = ?, reason = ? WHERE id = ? AND status IN ('offen','bestaetigt','abgelehnt')").run(st, uname(req), nowTs(), b.approve ? null : txt(b.reason, 140) || null, id).changes;
    ctx.audit(req.user, b.approve ? 'Arbeitsstunden bestätigt' : 'Arbeitsstunden abgelehnt', `${n} Einträge`);
    res.json({ ok: true, count: n });
  });
  admin.delete('/entries/:id', P, (req, res) => { db.prepare('DELETE FROM aw_entry WHERE id = ?').run(int(req.params.id)); res.json({ ok: true }); });
  admin.post('/entries/:id/stop', P, (req, res) => {
    const e = db.prepare("SELECT * FROM aw_entry WHERE id = ? AND status = 'laeuft'").get(int(req.params.id)); if (!e) return bad(res, 'Läuft nicht.', 404);
    stop(e, 'offen'); res.json({ ok: true });
  });

  admin.put('/settings', P, (req, res) => {
    const b = req.body || {};
    const num = (k, lo, hi) => { if (b[k] !== undefined) SET(k, Math.max(lo, Math.min(hi, int(b[k])))); };
    num('default_minutes', 0, 20000); num('start_year', 2000, 2100); num('min_age', 0, 99); num('max_age', 0, 120); num('rate_cents', 0, 100000); num('round', 1, 60);
    for (const k of ['pool_family', 'exempt_passive', 'prorate', 'tablet_auto', 'app_report', 'remind_events']) if (b[k] !== undefined) SET(k, b[k] ? '1' : '0');
    if (b.year_mode !== undefined) SET('year_mode', b.year_mode === 'beitrag' ? 'beitrag' : 'kalender');
    if (b.remind_date !== undefined) { if (b.remind_date && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(b.remind_date)) return bad(res, 'Ungültiges Datum für die Erinnerung (TT.MM.).'); SET('remind_date', b.remind_date || ''); }
    if (b.text !== undefined) SET('text', txt(b.text, 600));
    ctx.audit(req.user, 'Arbeitseinsatz: Einstellungen geändert', Object.keys(b).join(', '));
    res.json({ ok: true, cfg: cfg() });
  });

  /* ---------------------------------------------------------------- Tablet: ein- und ausstempeln */
  function stop(e, status) {
    const out = nowTs();
    let min = Math.round((Date.parse(out.replace(' ', 'T')) - Date.parse(e.in_at.replace(' ', 'T'))) / 60000);
    const r = cfg().round; min = Math.max(r, Math.round(min / r) * r);
    db.prepare('UPDATE aw_entry SET out_at = ?, minutes = ?, status = ? WHERE id = ?').run(out, Math.min(min, 1440), status, e.id);
    return Math.min(min, 1440);
  }
  T.get('/state', (req, res) => {
    const day = today();
    res.json({ text: cfg().text, events: db.prepare('SELECT id, kind, title, start, end, place, permanent FROM aw_event WHERE (date = ? OR permanent = 1) AND cancelled = 0 ORDER BY permanent, start, title').all(day),
      running: db.prepare("SELECT e.id, e.member_id, m.name, e.in_at, v.title FROM aw_entry e JOIN members m ON m.id = e.member_id LEFT JOIN aw_event v ON v.id = e.event_id WHERE e.status = 'laeuft' ORDER BY e.in_at").all(),
      people: db.prepare("SELECT id, name, pin_hash IS NOT NULL AS pin FROM members WHERE kind = 'mitglied' AND active = 1 AND deleted = 0 AND pending = 0 ORDER BY name_key(name, kind)").all().map(p => ({ ...p, ln: (x => (x.first ? `${x.last}, ${x.first}` : x.last))(ctx.require('./db').splitPersonName(p.name)) })) });
  });
  T.post('/start', rateLimit('awtab', 60, 60000), (req, res) => {
    const b = req.body || {}; const mid = ctx.auth.checkTabletToken(b.token);
    if (!mid || typeof mid !== 'number') return bad(res, 'Sitzung abgelaufen – bitte Namen neu wählen.', 401);
    if (db.prepare("SELECT 1 FROM aw_entry WHERE member_id = ? AND status = 'laeuft'").get(mid)) return bad(res, 'Du bist schon eingestempelt.');
    const ev = b.event_id ? db.prepare('SELECT * FROM aw_event WHERE id = ? AND (date = ? OR permanent = 1) AND cancelled = 0').get(int(b.event_id), today()) : null;
    const own = txt(b.text, 140);
    const text = ev ? (own ? `${ev.title}: ${own}`.slice(0, 160) : ev.title) : own;   // beim Einsatz ist die Beschreibung freiwillig
    if (!ev && text.length < 3) return bad(res, db.prepare('SELECT 1 FROM aw_event WHERE (date = ? OR permanent = 1) AND cancelled = 0').get(today()) ? 'Bitte einen Einsatz wählen oder kurz eintragen, was du machst.' : 'Bitte kurz eintragen, was du machst.');
    db.prepare("INSERT INTO aw_entry(member_id, event_id, date, text, in_at, status, source) VALUES (?,?,?,?,?, 'laeuft', 'tablet')").run(mid, ev ? ev.id : null, today(), text, nowTs());
    ctx.auth.dropTabletToken(b.token);
    res.json({ ok: true });
  });
  T.post('/stop', rateLimit('awtab', 60, 60000), (req, res) => {
    const b = req.body || {}; const mid = ctx.auth.checkTabletToken(b.token);
    if (!mid || typeof mid !== 'number') return bad(res, 'Sitzung abgelaufen – bitte Namen neu wählen.', 401);
    const e = db.prepare("SELECT * FROM aw_entry WHERE member_id = ? AND status = 'laeuft'").get(mid);
    if (!e) return bad(res, 'Du bist nicht eingestempelt.');
    ctx.auth.dropTabletToken(b.token);
    // unter 5 Minuten (z. B. versehentlich eingestempelt): wird nicht gewertet und verworfen
    const raw = Math.round((Date.parse(nowTs().replace(' ', 'T')) - Date.parse(e.in_at.replace(' ', 'T'))) / 60000);
    if (raw < MIN_COUNT) { db.prepare('DELETE FROM aw_entry WHERE id = ?').run(e.id); return res.json({ ok: true, minutes: Math.max(0, raw), discarded: true }); }
    const hasPin = Boolean(db.prepare('SELECT pin_hash FROM members WHERE id = ?').get(mid).pin_hash);
    const min = stop(e, cfg().tablet_auto && hasPin ? 'bestaetigt' : 'offen');
    res.json({ ok: true, minutes: min, confirmed: cfg().tablet_auto && hasPin });
  });

  /* ---------------------------------------------------------------- Mitglieder-App „Dienste“ */
  M.get('/me', ar(async (req, res) => {
    const id = req.member.id, y = yearOf(today());
    const fam = mv() && cfg().pool_family ? await hook('familyOf', id) : null;
    const ids = fam ? fam.members : [id];
    let tg = 0; for (const x of ids) tg += (await target(x, y)).minutes;
    const done = doneMinutes(ids, y), open = openMinutes(ids, y);
    const mine = await target(id, y);
    res.json({ year: yearLabel(y), to: period(y).to, family: ids.length > 1, target: tg, done, open, mine, rate_cents: cfg().rate_cents, text: cfg().text, report: cfg().app_report,
      events: db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM aw_signup s WHERE s.event_id = e.id) AS taken, EXISTS(SELECT 1 FROM aw_signup s WHERE s.event_id = e.id AND s.member_id = ?) AS mine
        FROM aw_event e WHERE e.date >= ? AND e.cancelled = 0 AND e.permanent = 0 ORDER BY e.date, e.start LIMIT 40`).all(id, today()),
      entries: db.prepare(`SELECT e.id, e.date, e.minutes, e.text, e.status, e.reason, m.name FROM aw_entry e JOIN members m ON m.id = e.member_id WHERE e.member_id IN (${ids.map(() => '?').join(',')}) AND e.date >= ? ORDER BY e.date DESC LIMIT 40`).all(...ids, period(y).from) });
  }));
  M.post('/signup', (req, res) => {
    const b = req.body || {}; const e = db.prepare('SELECT * FROM aw_event WHERE id = ? AND cancelled = 0 AND permanent = 0').get(int(b.event_id));
    if (!e || e.date < today()) return bad(res, 'Dieser Termin ist nicht mehr offen.');
    if (b.remove) { db.prepare('DELETE FROM aw_signup WHERE event_id = ? AND member_id = ?').run(e.id, req.member.id); return res.json({ ok: true }); }
    if (e.slots && db.prepare('SELECT COUNT(*) n FROM aw_signup WHERE event_id = ?').get(e.id).n >= e.slots) return bad(res, 'Leider schon voll.');
    db.prepare('INSERT OR IGNORE INTO aw_signup(event_id, member_id) VALUES (?,?)').run(e.id, req.member.id);
    res.json({ ok: true });
  });
  M.post('/report', rateLimit('awrep', 20, 3600000), (req, res) => {
    if (!cfg().app_report) return bad(res, 'Stunden meldet bei uns der Vorstand.', 403);
    const b = req.body || {}; const r = entryInput(b); if (r.error) return bad(res, r.error);
    if ((r.v.text || '').length < 3) return bad(res, 'Bitte kurz beschreiben, was du gemacht hast.');
    db.prepare("INSERT INTO aw_entry(member_id, event_id, date, minutes, text, status, source) VALUES (?,?,?,?,?, 'offen', 'app')").run(req.member.id, r.v.event_id, r.v.date, r.v.minutes, r.v.text);
    res.json({ ok: true });
  });

  /* ---------------------------------------------------------------- Beitragslauf (Mitgliederverwaltung) */
  ctx.hooks.beitragsPositionen = async ({ until }) => {
    const out = []; const c = cfg();
    if (!c.rate_cents) return out;
    for (let y = yearOf(until) - 1; y >= yearOf(until) - 3; y--) {
      const p = period(y); if (p.to >= until || y < c.start_year) continue;
      const o = await overview(y);
      for (const f of o.families) if (f.cents > 0) out.push({ member_id: f.head, ext_key: `aw-${y}-${f.head}`, kind: 'arbeitsstunden', cents: f.cents, due_date: addDays(p.to, 1), period_from: p.from, period_to: p.to,
        text: `Arbeitsstunden ${yearLabel(y)}: ${hm(f.missing).replace(' h', '')} h nicht geleistet × ${euro(c.rate_cents)}` });
    }
    return out;
  };
  ctx.hooks.overview = async () => {
    const pend = db.prepare("SELECT COUNT(*) n FROM aw_entry WHERE status = 'offen'").get().n;
    const y = yearOf(today()); const o = await overview(y);
    return { kpis: [{ l: `Stunden geleistet ${o.label}`, v: `${Math.round(o.totals.done / 60)} von ${Math.round(o.totals.target / 60)} h` }, { l: 'zu bestätigen', v: pend }],
      alerts: pend ? [{ level: 'a', text: `${pend} gemeldete Arbeitsstunden warten auf Bestätigung.` }] : [] };
  };
  ctx.hooks.exportConfig = () => ({ settings: Object.fromEntries(['default_minutes', 'min_age', 'max_age', 'rate_cents', 'pool_family', 'exempt_passive', 'year_mode', 'prorate', 'tablet_auto', 'app_report', 'remind_date', 'remind_events', 'round', 'text', 'start_year'].map(k => [k, S(k)])) });
  ctx.hooks.importConfig = d => { for (const [k, v] of Object.entries((d && d.settings) || {})) if (typeof v === 'string' && /^[a-z_]{3,20}$/.test(k)) SET(k, v.slice(0, 600)); return 'Einstellungen übernommen'; };

  /* ---------------------------------------------------------------- Erinnerungen */
  async function daily() {
    try {
      if (!ctx.isActive() || !ctx.mail.ready()) return;
      const c = cfg(), club = ctx.getSetting('club_name', '');
      const mailOf = id => db.prepare('SELECT email FROM mv_person WHERE member_id = ?').get(id);
      const hasMv = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'mv_person'").get());
      if (!hasMv) return;
      if (c.remind_events) {
        const tm = addDays(today(), 1);
        for (const s of db.prepare('SELECT s.id, s.member_id, e.* FROM aw_signup s JOIN aw_event e ON e.id = s.event_id WHERE e.date = ? AND e.cancelled = 0 AND e.permanent = 0 AND s.reminded = 0').all(tm)) {
          const m = mailOf(s.member_id); db.prepare('UPDATE aw_signup SET reminded = 1 WHERE id = ?').run(s.id);
          if (!m || !m.email) continue;
          await ctx.mail.send({ to: m.email, subject: `Erinnerung: ${s.title} morgen`, text: [`Hallo,`, '', `du hast dich für morgen eingetragen: ${KIND[s.kind]} „${s.title}“ am ${deD(s.date)}${s.start ? ` um ${s.start} Uhr` : ''}${s.place ? `, ${s.place}` : ''}.`, '', 'Danke für deine Hilfe!', club].join('\n') }).catch(() => {});
        }
      }
      if (c.remind_date && today().slice(5) === c.remind_date && S('reminded_year') !== today().slice(0, 4)) {
        SET('reminded_year', today().slice(0, 4));
        const o = await overview(yearOf(today()));
        for (const f of o.families.filter(x => x.target > x.done)) {
          const m = mailOf(f.head); if (!m || !m.email) continue;
          await ctx.mail.send({ to: m.email, subject: `Arbeitsstunden ${o.label} – ${club}`, text: [`Hallo ${f.name},`, '', `${f.members.length > 1 ? 'eure Familie hat' : 'du hast'} in ${o.label} bisher ${hm(f.done)} von ${hm(f.target)} Arbeitsstunden geleistet.`,
            `Bis ${deD(o.to)} ist noch Zeit – offene Einsätze und Thekendienste findest du in der Mitglieder-App unter „Dienste“.`, c.rate_cents ? `Nicht geleistete Stunden berechnen wir mit ${euro(c.rate_cents)} je Stunde.` : '', '', 'Viele Grüße', club].filter((x, i, a) => x || a[i - 1]).join('\n') }).catch(() => {});
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch (e) { console.error('Arbeitseinsatz (täglich):', e.message); }
  }
  setTimeout(daily, 20000).unref();
  setInterval(daily, 60 * 60000).unref();
}

module.exports = { activate };
