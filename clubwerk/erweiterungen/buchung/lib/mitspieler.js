'use strict';
/* =====================================================================================================
   Mitspielersuche (Teil des Moduls „Plätze“)
   Ein Mitglied stellt in der App ein Gesuch („Doppel, Do 18–20 Uhr, Platz 3 schon gebucht“), andere sagen verbindlich zu –
   wer zuerst kommt, ist dabei. Mit gebuchtem Platz trägt die Zusage direkt als Mitspieler in die Buchung ein (alle
   Buchungsregeln über memberBook), ohne Platz sammelt das Gesuch die Zusagen, bis der Ersteller „Platz buchen“ tippt.
   Kein Chat, keine Telefonnummern: sichtbar sind nur „Nachname, Vorname“, Foto (Freigabe „Platzbuchung“), Spielform,
   Zeit, Spielstärke und Hinweis – und nur für Mitglieder mit dem App-Bereich „Plätze“ (Prüfung im Kern, /api/m/buchung).
   Push nur über die zentral angemeldeten Anlässe „mitspieler_zusage“ und „mitspieler_voll“.
   ===================================================================================================== */
const { today, nowTs, isDate, deD } = require('../../../src/util');

const OPEN = ['offen', 'voll'];   // laufende Gesuche (alle anderen Zustände sind beendet)
const STATUS_TXT = { offen: 'offen', voll: 'voll', erledigt: 'erledigt', zurueckgezogen: 'zurückgezogen', abgelaufen: 'abgelaufen', ausgeblendet: 'ausgeblendet' };
const DEF_KINDS = [{ name: 'Einzel', min: 1, max: 1 }, { name: 'Doppel', min: 3, max: 3 }, { name: 'Training', min: 1, max: 3 }];
const DEF_LEVELS = ['Einsteiger', 'Freizeit', 'Mannschaft', 'Turnier'];
/** Hinweis: Klartext, ohne Links (keine Kontaktwege nach außen), höchstens 140 Zeichen */
const LINK = /(https?:|www\.|\b[a-z0-9-]+\.(de|com|net|org|eu|info|io|me|app|at|ch)\b|@[a-z0-9-]+\.)/i;

function tables(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS bk_ms_request (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), kind TEXT NOT NULL, date TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
  booking_id INTEGER, need INTEGER NOT NULL DEFAULT 1, level TEXT, lk_from REAL, lk_to REAL, note TEXT,
  status TEXT NOT NULL DEFAULT 'offen',              -- offen | voll | erledigt | zurueckgezogen | abgelaufen | ausgeblendet
  reports INTEGER NOT NULL DEFAULT 0, hidden_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_bk_ms_status ON bk_ms_request(status, date);
CREATE INDEX IF NOT EXISTS ix_bk_ms_member ON bk_ms_request(member_id, status);
CREATE INDEX IF NOT EXISTS ix_bk_ms_booking ON bk_ms_request(booking_id) WHERE booking_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS bk_ms_reply (
  request_id INTEGER NOT NULL, member_id INTEGER NOT NULL REFERENCES members(id), status TEXT NOT NULL DEFAULT 'zugesagt',   -- zugesagt | zurueckgezogen | entfernt
  created_at TEXT NOT NULL, PRIMARY KEY (request_id, member_id)
);
CREATE INDEX IF NOT EXISTS ix_bk_ms_reply_member ON bk_ms_reply(member_id, created_at);
CREATE TABLE IF NOT EXISTS bk_ms_profile (
  member_id INTEGER NOT NULL REFERENCES members(id), open INTEGER NOT NULL DEFAULT 0, level TEXT, lk REAL, blocked_at TEXT, blocked_by TEXT, PRIMARY KEY (member_id)
);
CREATE TABLE IF NOT EXISTS bk_ms_report (
  request_id INTEGER NOT NULL, member_id INTEGER NOT NULL REFERENCES members(id), created_at TEXT NOT NULL, PRIMARY KEY (request_id, member_id)
);`);
}

/**
 * x = Bausteine des Moduls Plätze: { M, admin, P, need, S, SET, cfg, memberBook, notAllowed, openCount, personBusy, resource, nameOf, lastFirst,
 *   photos, tm, hhmm, nowMin, isoDow, WD, J, txt, isTu, canCancelNow, rateLimit, rateLimitKey, bad, int, ar }
 */
function activate(ctx, x) {
  const db = ctx.db;
  tables(db);
  const { M, admin, P, S, SET, J, tm, hhmm, nowMin, WD, isoDow, bad, int, ar } = x;
  const PM = x.need('buchung_stornieren');   // ausblenden und sperren (wie „Buchungen anderer stornieren“)
  const PE = x.need('buchung_einstellungen');

  /* ---------- Einstellungen (Plätze › Mitspielersuche) ---------- */
  const kinds = () => { const k = J(S('ms_kinds', ''), null); return Array.isArray(k) && k.length ? k : DEF_KINDS; };
  const levels = () => { const l = String(S('ms_levels', '')).split('\n').map(s => s.trim()).filter(Boolean); return l.length ? l : DEF_LEVELS; };
  const num = (k, d, lo, hi) => { const v = parseInt(S(k, String(d)), 10); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  const msCfg = () => ({ on: S('ms_on', '1') === '1', kinds: kinds(), levels: levels(), max_open: num('ms_max_open', 3, 1, 10), max_day: num('ms_max_day', 10, 1, 50) });

  /* ---------- Helfer ---------- */
  const req1 = id => db.prepare('SELECT * FROM bk_ms_request WHERE id = ?').get(int(id));
  const bookingOf = q => (q && q.booking_id ? db.prepare('SELECT * FROM bk_booking WHERE id = ?').get(q.booking_id) : null);
  const activeBooking = q => { const b = bookingOf(q); return b && b.status === 'aktiv' ? b : null; };
  const replies = id => db.prepare("SELECT * FROM bk_ms_reply WHERE request_id = ? AND status = 'zugesagt' ORDER BY created_at, member_id").all(id);
  /** Zusagen, die zählen: mit Platz nur, wer noch als Mitspieler in der Buchung steht (der Ersteller kann die Buchung auch selbst ändern) */
  const counted = (q, b = activeBooking(q)) => { const rs = replies(q.id); if (!b) return rs; const ps = J(b.partners, []); return rs.filter(r => ps.includes(r.member_id)); };
  const profile = mid => db.prepare('SELECT * FROM bk_ms_profile WHERE member_id = ?').get(mid) || null;
  const blocked = mid => Boolean((profile(mid) || {}).blocked_at);
  const when = q => `${WD[isoDow(q.date)]} ${deD(q.date).slice(0, 6)} · ${q.start}–${q.end} Uhr`;
  const minNow = () => hhmm(nowMin());
  /** Gesuche, deren Startzeit erreicht ist, enden (bei Gesuchen mit Platz zählt die Zeit der Buchung) – vor jeder Liste, eine Abfrage */
  function expire() {
    const d = today(), n = minNow();
    db.prepare(`UPDATE bk_ms_request SET status = 'abgelaufen', updated_at = ? WHERE id IN (SELECT q.id FROM bk_ms_request q LEFT JOIN bk_booking b ON b.id = q.booking_id
      WHERE q.status IN ('offen','voll') AND (COALESCE(b.date, q.date) < ? OR (COALESCE(b.date, q.date) = ? AND COALESCE(b.start, q.start) <= ?)))`).run(nowTs(), d, d, n);
  }
  /** Spielstärke passt: gleiche oder benachbarte Stufe, bzw. eigene LK im LK-Bereich des Gesuchs */
  function fits(q, pr) {
    if (!pr || !pr.open) return false;
    const L = levels(), a = L.indexOf(q.level || ''), b = L.indexOf(pr.level || '');
    if (a >= 0 && b >= 0 && Math.abs(a - b) <= 1) return true;
    return pr.lk != null && (q.lk_from != null || q.lk_to != null) && pr.lk >= (q.lk_from != null ? q.lk_from : 1) && pr.lk <= (q.lk_to != null ? q.lk_to : 25);
  }
  const lkTxt = q => (q.lk_from != null || q.lk_to != null ? `LK ${fmtLk(q.lk_from != null ? q.lk_from : 1)}–${fmtLk(q.lk_to != null ? q.lk_to : 25)}` : '');
  const fmtLk = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const lkVal = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); if (!Number.isFinite(n) || n < 1 || n > 25) throw new Error('Die LK liegt zwischen 1,0 und 25,0.'); return Math.round(n * 10) / 10; };
  const person = (id, lk) => { const m = lk.get(id); return { id, name: m ? x.lastFirst(m.name, m.kind) : '?', ph: m ? x.photos.version(m, 'buchung') : null }; };
  /** Namen und Fotos aller Beteiligten mit einer Abfrage (kein Nachschlagen je Zeile) */
  function people(ids) {
    const u = [...new Set(ids)].filter(Boolean); if (!u.length) return new Map();
    return new Map(db.prepare(`SELECT id, name, kind, photo, photo_use FROM members WHERE id IN (${u.map(() => '?').join(',')})`).all(...u).map(m => [m.id, m]));
  }
  /** Ansicht eines Gesuchs für die App (me = betrachtendes Mitglied) */
  function view(q, me, lk, pr, bmap) {
    const b = bmap ? bmap.get(q.booking_id) || null : activeBooking(q);
    const ps = b ? J(b.partners, []) : null;
    const rs = (lk.rep.get(q.id) || []).filter(r => !ps || ps.includes(r.member_id));
    const own = q.member_id === me, r = b ? x.resource(b.resource_id) : null;
    const d = b ? { date: b.date, start: b.start, end: b.end } : { date: q.date, start: q.start, end: q.end };
    return { id: q.id, own, kind: q.kind, ...d, need: q.need, found: rs.length, status: q.status, level: q.level || null, lk: lkTxt({ lk_from: q.lk_from, lk_to: q.lk_to }) || null,
      lk_from: q.lk_from, lk_to: q.lk_to, note: q.note || '', place: r ? r.name : null, booking_id: b ? b.id : null, minutes: tm(d.end) - tm(d.start),
      by: person(q.member_id, lk.m), fits: !own && fits(q, pr), joined: rs.some(y => y.member_id === me),
      // Zusagenliste: der Ersteller sieht, wer wann zugesagt hat; andere sehen nur die Namen (wer mitspielt, ist ohnehin auf dem Platz sichtbar)
      players: rs.map(y => ({ ...person(y.member_id, lk.m), at: own ? y.created_at : null })) };
  }
  function lookupFor(qs) {
    const ids = qs.map(q => q.id), rep = new Map();
    if (ids.length) for (const r of db.prepare(`SELECT * FROM bk_ms_reply WHERE status = 'zugesagt' AND request_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at, member_id`).all(...ids)) {
      if (!rep.has(r.request_id)) rep.set(r.request_id, []); rep.get(r.request_id).push(r);
    }
    const bids = qs.map(q => q.booking_id).filter(Boolean);
    const bmap = new Map(bids.length ? db.prepare(`SELECT * FROM bk_booking WHERE status = 'aktiv' AND id IN (${bids.map(() => '?').join(',')})`).all(...bids).map(b => [b.id, b]) : []);
    const m = people([...qs.map(q => q.member_id), ...[...rep.values()].flat().map(r => r.member_id)]);
    return { rep, m, bmap };
  }
  const push = (ids, ev, title, body, id) => { if (ctx.push) ctx.push.send(ids, ev, { title, body, url: './#buchung', tag: `buchung-${ev}-${id}` }).catch(() => {}); };
  /** Wer darf in der App mitmachen? → null oder Grund */
  async function mayUse(mid) {
    if (!msCfg().on) return 'Die Mitspielersuche ist ausgeschaltet.';
    if (blocked(mid)) return 'Du bist für die Mitspielersuche gesperrt. Bei Fragen bitte an den Vorstand wenden.';
    return x.notAllowed(mid);
  }
  /** eigene kommende Platzbuchungen, an die ein Gesuch gehängt werden kann (selbst gebucht, ohne laufendes Gesuch) */
  function ownBookings(mid) {
    const d = today(), n = minNow();
    return db.prepare(`SELECT b.*, r.name AS rname FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.status = 'aktiv' AND b.type = 'buchung' AND r.kind = 'platz' AND b.member_id = ?
      AND b.date >= ? AND (b.date > ? OR b.start > ?) AND b.id NOT IN (SELECT booking_id FROM bk_ms_request WHERE booking_id IS NOT NULL AND status IN ('offen','voll')) ORDER BY b.date, b.start LIMIT 20`).all(mid, d, d, n)
      .filter(b => !x.isTu(b)).map(b => ({ id: b.id, date: b.date, start: b.start, end: b.end, place: b.rname, partners: J(b.partners, []).length }));
  }

  /* ---------- Zusage mit Platz: Mitspieler über die normale Buchungsänderung des Erstellers eintragen bzw. austragen ---------- */
  async function setPartners(q, b, list) {
    const dev = b.partner_device_id ? db.prepare('SELECT resource_id FROM bk_booking WHERE id = ? AND status = ?').get(b.partner_device_id, 'aktiv') : null;
    return x.memberBook(q.member_id, { id: b.id, resource_id: b.resource_id, date: b.date, start: b.start, minutes: tm(b.end) - tm(b.start), partners: list, guests: J(b.guests, []),
      label_id: b.label_id || null, title: b.title || '', partner_device: dev ? dev.resource_id : null, solo: Boolean(b.solo), accept: true }, 'app', { onlyPartners: true });
  }
  /** Zusage mit Platz: freundliche Meldungen für die eigene Person, bevor die Buchungsprüfung („… hat schon …“) greift */
  function preCheck(me, b) {
    const r = x.resource(b.resource_id) || { kind: 'platz' }, c = x.cfg();
    if (x.personBusy(me, r.kind, b.date, tm(b.start), tm(b.end), b.id)) return 'Du hast zu dieser Zeit schon gebucht.';
    if (c.count_partners && c.max_open_platz && !x.isTrainer(me) && x.openCount(me, r.kind) >= c.max_open_platz) return `Du hast schon die höchste Zahl offener Buchungen (${c.max_open_platz}) – auch als Mitspieler zählt sie mit.`;
    if (J(b.partners, []).length >= c.max_partners) return `Die Buchung hat schon die höchste Zahl an Mitspielern (${c.max_partners}).`;
    return null;
  }
  /* Zusagen und Austragen nacheinander je Gesuch (zwischen Prüfen und Eintragen liegen await-Schritte): wer zuerst kommt, ist dabei */
  const busy = new Set();
  async function serial(id, fn) {
    if (busy.has(id)) throw new Error('Gerade sagt jemand anderes zu – bitte kurz warten und neu laden.');
    busy.add(id); try { return await fn(); } finally { busy.delete(id); }
  }
  /** nach einer Änderung der Zusagen: Zustand neu setzen (offen ↔ voll, mit Platz voll = erledigt) → neuer Zustand */
  function settle(q) {
    const n = counted(q).length, b = activeBooking(q);
    const st = n >= q.need ? (b ? 'erledigt' : 'voll') : 'offen';
    if (st !== q.status) db.prepare('UPDATE bk_ms_request SET status = ?, updated_at = ? WHERE id = ?').run(st, nowTs(), q.id);
    return st;
  }

  /* ================================================================= Mitglieder-App (/api/m/buchung/ms…) */
  const perMember = x.rateLimitKey('bkms', 20, 60000, rq => 'm' + rq.member.id);
  M.get('/ms', ar(async (req, res) => {
    const me = req.member.id, c = msCfg();
    if (!c.on) return res.json({ on: false });
    expire();
    const pr = profile(me);
    const off = Math.max(0, int(req.query.seite) || 0) * 50;
    // eigene laufende Gesuche, offene der anderen (zuerst die passenden), eigene Zusagen
    const mine = db.prepare(`SELECT * FROM bk_ms_request WHERE member_id = ? AND status IN ('offen','voll') ORDER BY date, start`).all(me);
    const others = db.prepare(`SELECT * FROM bk_ms_request WHERE status = 'offen' AND member_id != ? ORDER BY date, start, id LIMIT 51 OFFSET ?`).all(me, off);
    const joinedIds = db.prepare(`SELECT q.* FROM bk_ms_reply r JOIN bk_ms_request q ON q.id = r.request_id WHERE r.member_id = ? AND r.status = 'zugesagt' AND q.status IN ('offen','voll','erledigt') AND q.date >= ? ORDER BY q.date, q.start LIMIT 20`).all(me, today());
    const all = [...mine, ...others.slice(0, 50), ...joinedIds];
    const lk = lookupFor(all);
    const v = q => view(q, me, { rep: lk.rep, m: lk.m }, pr, q.booking_id ? new Map([[q.booking_id, lk.bmap.get(q.booking_id) || null]]) : new Map());
    const list = others.slice(0, 50).map(v).filter(q => !q.joined);
    list.sort((a, b) => (b.fits - a.fits) || (a.date + a.start).localeCompare(b.date + b.start));
    const why = await mayUse(me);
    res.json({ on: true, blocked: why, kinds: c.kinds, levels: c.levels, max_open: c.max_open, profile: pr ? { open: Boolean(pr.open), level: pr.level, lk: pr.lk } : { open: false, level: null, lk: null },
      mine: mine.map(v), open: list, more: others.length > 50, joined: joinedIds.map(v).filter(q => q.joined && !q.own), bookings: ownBookings(me), today: today(), now: minNow(), max_partners: x.cfg().max_partners });
  }));
  /** Gesuch anlegen oder ändern (eigenes). Mit Zusagen lassen sich nur Spielstärke und Hinweis ändern. */
  M.post('/ms', x.rateLimit('bkmsw', 60, 60000), perMember, ar(async (req, res) => {
    const me = req.member.id, c = msCfg(), body = req.body || {};
    const why = await mayUse(me); if (why) return bad(res, why, 403);
    expire();
    const old = int(body.id) ? req1(body.id) : null;
    if (int(body.id) && (!old || old.member_id !== me || !OPEN.includes(old.status))) return bad(res, 'Dieses Gesuch kannst du nicht ändern.', 403);
    const note = String(body.note == null ? '' : body.note).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (note.length > 140) return bad(res, 'Der Hinweis ist zu lang (höchstens 140 Zeichen).');
    if (LINK.test(note)) return bad(res, 'Bitte keine Links oder Adressen im Hinweis – Absprachen laufen über die Zusage.');
    const level = body.level ? String(body.level) : null;
    if (level && !c.levels.includes(level)) return bad(res, 'Diese Spielstärke gibt es nicht.');
    let lkf, lkt; try { lkf = lkVal(body.lk_from); lkt = lkVal(body.lk_to); } catch (e) { return bad(res, e.message); }
    if (lkf != null && lkt != null && lkf > lkt) [lkf, lkt] = [lkt, lkf];
    if (old && counted(old).length) {   // schon Zusagen: Zeit, Platz und Spielform bleiben, wie zugesagt wurde
      db.prepare('UPDATE bk_ms_request SET level = ?, lk_from = ?, lk_to = ?, note = ?, updated_at = ? WHERE id = ?').run(level, lkf, lkt, note || null, nowTs(), old.id);
      return res.json({ ok: true, id: old.id, kept: true });
    }
    const k = c.kinds.find(y => y.name === body.kind); if (!k) return bad(res, 'Bitte eine Spielform wählen.');
    let need = int(body.need) || k.min; if (need < k.min || need > k.max) need = k.min;
    let date = String(body.date || ''), start = String(body.start || ''), end = String(body.end || ''), bid = null;
    if (int(body.booking_id)) {   // eigene, schon gebuchte Buchung: Zeit kommt von dort
      const b = db.prepare("SELECT b.*, r.kind AS rkind FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.id = ? AND b.status = 'aktiv' AND b.type = 'buchung'").get(int(body.booking_id));
      if (!b || b.member_id !== me || b.rkind !== 'platz' || x.isTu(b)) return bad(res, 'Diese Buchung gehört nicht dir.', 403);
      const other = db.prepare("SELECT id FROM bk_ms_request WHERE booking_id = ? AND status IN ('offen','voll') AND id != ?").get(b.id, old ? old.id : 0);
      if (other) return bad(res, 'Für diese Buchung läuft schon ein Gesuch.');
      const free = x.cfg().max_partners - J(b.partners, []).length;
      if (free < 1) return bad(res, 'Diese Buchung hat schon die höchste Zahl an Mitspielern.');
      const rest = need - J(b.partners, []).length;   // wer schon in der Buchung steht, zählt mit
      if (rest < 1) return bad(res, 'Diese Buchung hat schon genug Mitspieler.');
      need = Math.min(rest, free);
      date = b.date; start = b.start; end = b.end; bid = b.id;
    } else {
      if (!isDate(date) || tm(start) == null || tm(end) == null || tm(end) <= tm(start)) return bad(res, 'Bitte Tag und Uhrzeit prüfen.');
      if (tm(end) - tm(start) > 6 * 60) return bad(res, 'Ein Gesuch dauert höchstens 6 Stunden.');
    }
    const d0 = today();
    if (date < d0 || (date === d0 && tm(start) <= nowMin())) return bad(res, 'Diese Zeit ist schon vorbei.');
    if (date > x.addDays(d0, 60)) return bad(res, 'Gesuche gehen höchstens 60 Tage im Voraus.');
    if (!old && db.prepare("SELECT COUNT(*) n FROM bk_ms_request WHERE member_id = ? AND status IN ('offen','voll')").get(me).n >= c.max_open) return bad(res, `Du hast schon ${c.max_open} offene Gesuche – erst wenn eines erledigt ist, geht das nächste.`);
    const t = nowTs(), v = [me, k.name, date, start, end, bid, need, level, lkf, lkt, note || null];
    let id = old ? old.id : 0;
    if (old) db.prepare('UPDATE bk_ms_request SET member_id = ?, kind = ?, date = ?, start = ?, end = ?, booking_id = ?, need = ?, level = ?, lk_from = ?, lk_to = ?, note = ?, status = ?, updated_at = ? WHERE id = ?').run(...v, 'offen', t, id);
    else id = Number(db.prepare('INSERT INTO bk_ms_request(member_id, kind, date, start, end, booking_id, need, level, lk_from, lk_to, note, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...v, 'offen', t, t).lastInsertRowid);
    res.json({ ok: true, id });
  }));
  /** eigenes Gesuch zurückziehen (eine gebuchte Buchung bleibt, wie sie ist) */
  M.post('/ms/:id/withdraw', perMember, (req, res) => {
    const q = req1(req.params.id);
    if (!q || q.member_id !== req.member.id) return bad(res, 'Dieses Gesuch kannst du nicht zurückziehen.', 403);
    if (!OPEN.includes(q.status)) return bad(res, 'Dieses Gesuch ist schon beendet.');
    db.prepare("UPDATE bk_ms_request SET status = 'zurueckgezogen', updated_at = ? WHERE id = ?").run(nowTs(), q.id);
    res.json({ ok: true });
  });
  /** „Ich spiele mit“ – verbindlich, wer zuerst kommt */
  M.post('/ms/:id/join', x.rateLimit('bkmsw', 60, 60000), perMember, ar(async (req, res) => {
    const me = req.member.id, c = msCfg();
    const why = await mayUse(me); if (why) return bad(res, why, 403);
    expire();
    const q0 = req1(req.params.id);
    if (!q0 || q0.status === 'ausgeblendet') return bad(res, 'Dieses Gesuch gibt es nicht (mehr).', 404);
    if (q0.member_id === me) return bad(res, 'Das ist dein eigenes Gesuch.');
    const day = db.prepare("SELECT COUNT(*) n FROM bk_ms_reply WHERE member_id = ? AND created_at >= ?").get(me, today() + ' 00:00:00').n;
    if (day >= c.max_day) return bad(res, `Du hast heute schon ${c.max_day}-mal zugesagt – morgen geht es weiter.`);
    try {
      const out = await serial(q0.id, async () => {
        const q = req1(q0.id);
        if (q.status !== 'offen') throw new Error(q.status === 'voll' || q.status === 'erledigt' ? 'Schade – das Gesuch ist inzwischen voll.' : 'Dieses Gesuch ist schon beendet.');
        const was = db.prepare('SELECT status FROM bk_ms_reply WHERE request_id = ? AND member_id = ?').get(q.id, me);
        if (was && was.status === 'zugesagt') throw new Error('Du hast schon zugesagt.');
        if (was && was.status === 'entfernt') throw new Error('Der Ersteller hat dich aus diesem Gesuch entfernt.');
        if (counted(q).length >= q.need) throw new Error('Schade – das Gesuch ist inzwischen voll.');
        const b = activeBooking(q);
        if (b) {
          const pc = preCheck(me, b); if (pc) throw new Error(pc);
          await setPartners(q, b, [...new Set([...J(b.partners, []), me])]);   // alle Buchungsregeln (Kontingent, Überschneidung, Höchstzahl), Mail „Als Mitspieler eingetragen“
        }
        db.prepare("INSERT INTO bk_ms_reply(request_id, member_id, status, created_at) VALUES (?,?,'zugesagt',?) ON CONFLICT(request_id, member_id) DO UPDATE SET status = 'zugesagt', created_at = excluded.created_at").run(q.id, me, nowTs());
        return { q, st: settle(q) };
      });
      const { q, st } = out, n = counted(q).length, nm = x.nameOf(me);
      if (st === 'offen') push([q.member_id], 'mitspieler_zusage', `${nm} spielt mit`, `${q.kind} ${when(q)} – noch ${q.need - n} gesucht.`, q.id);
      else push([q.member_id], 'mitspieler_voll', 'Dein Gesuch ist voll', st === 'erledigt' ? `${q.kind} ${when(q)} – alle sind in deiner Buchung eingetragen.` : `${q.kind} ${when(q)} – jetzt einen Platz buchen.`, q.id);
      res.json({ ok: true, status: st, found: n, need: q.need });
    } catch (e) { bad(res, e.message); }
  }));
  /** eigene Zusage zurückziehen (mit Platz: aus der Buchung austragen) */
  M.post('/ms/:id/leave', perMember, ar(async (req, res) => {
    const me = req.member.id, q0 = req1(req.params.id);
    const r = q0 ? db.prepare("SELECT 1 FROM bk_ms_reply WHERE request_id = ? AND member_id = ? AND status = 'zugesagt'").get(q0.id, me) : null;
    if (!r) return bad(res, 'Hier hast du nicht zugesagt.', 403);
    try { await drop(q0, me, 'zurueckgezogen'); res.json({ ok: true }); } catch (e) { bad(res, e.message); }
  }));
  /** Ersteller entfernt eine Zusage */
  M.post('/ms/:id/remove', perMember, ar(async (req, res) => {
    const q0 = req1(req.params.id), who = int((req.body || {}).member_id);
    if (!q0 || q0.member_id !== req.member.id) return bad(res, 'Dieses Gesuch gehört nicht dir.', 403);
    if (!db.prepare("SELECT 1 FROM bk_ms_reply WHERE request_id = ? AND member_id = ? AND status = 'zugesagt'").get(q0.id, who)) return bad(res, 'Diese Zusage gibt es nicht (mehr).');
    try { await drop(q0, who, 'entfernt'); res.json({ ok: true }); } catch (e) { bad(res, e.message); }
  }));
  async function drop(q0, who, st) {
    await serial(q0.id, async () => {
      const q = req1(q0.id), b = activeBooking(q);
      if (b && J(b.partners, []).includes(who)) {
        if (!x.canCancelNow(b)) throw new Error('Die Buchung hat schon begonnen oder lässt sich nicht mehr ändern.');
        await setPartners(q, b, J(b.partners, []).filter(y => y !== who));   // Storno-Hinweis an die ausgetragene Person
      }
      db.prepare('UPDATE bk_ms_reply SET status = ? WHERE request_id = ? AND member_id = ?').run(st, q.id, who);
      if (OPEN.includes(q.status) || q.status === 'erledigt') settle(q);
    });
  }
  /** „Melden“: geht an die Verwaltung (Hinweis in der Übersicht), je Mitglied und Gesuch einmal */
  M.post('/ms/:id/report', perMember, (req, res) => {
    const q = req1(req.params.id), me = req.member.id;
    if (!q || q.member_id === me) return bad(res, 'Dieses Gesuch kannst du nicht melden.');
    const r = db.prepare('INSERT OR IGNORE INTO bk_ms_report(request_id, member_id, created_at) VALUES (?,?,?)').run(q.id, me, nowTs());
    if (r.changes) {
      db.prepare('UPDATE bk_ms_request SET reports = reports + 1 WHERE id = ?').run(q.id);
      ctx.audit({ username: 'app', name: x.nameOf(me) }, 'Plätze: Gesuch gemeldet', `Gesuch von ${x.nameOf(q.member_id)}, ${q.kind} ${deD(q.date)} ${q.start}–${q.end} Uhr`);
    }
    res.json({ ok: true });
  });
  /** Teilnahme an der Börse („Ich suche auch Mitspieler“): freiwillig, beim Ausschalten verschwinden Spielstärke und LK sofort */
  M.post('/ms/profile', perMember, (req, res) => {
    const me = req.member.id, b = req.body || {}, c = msCfg();
    if (!c.on) return bad(res, 'Die Mitspielersuche ist ausgeschaltet.', 403);
    const pr = profile(me);
    if (!b.open) {
      if (pr && pr.blocked_at) db.prepare('UPDATE bk_ms_profile SET open = 0, level = NULL, lk = NULL WHERE member_id = ?').run(me);
      else db.prepare('DELETE FROM bk_ms_profile WHERE member_id = ?').run(me);
      return res.json({ ok: true });
    }
    const level = b.level && c.levels.includes(String(b.level)) ? String(b.level) : null;
    let lk; try { lk = lkVal(b.lk); } catch (e) { return bad(res, e.message); }
    db.prepare('INSERT INTO bk_ms_profile(member_id, open, level, lk) VALUES (?,1,?,?) ON CONFLICT(member_id) DO UPDATE SET open = 1, level = excluded.level, lk = excluded.lk').run(me, level, lk);
    res.json({ ok: true });
  });
  /** „Platz buchen“ aus einem Gesuch: die Buchung lief über /book (alle Regeln) – hier nur verknüpfen */
  function booked(mid, msId, bookingId) {
    const q = req1(msId);
    if (!q || q.member_id !== mid || !OPEN.includes(q.status) || q.booking_id) return;
    db.prepare('UPDATE bk_ms_request SET booking_id = ?, status = ?, updated_at = ? WHERE id = ?').run(bookingId, q.status === 'voll' ? 'erledigt' : 'offen', nowTs(), q.id);
    if (q.status !== 'voll') settle(req1(q.id));
  }
  /** Buchung storniert (App, Tablet, Verwaltung, Platzsperre): laufendes Gesuch dazu endet – die Mitspieler bekommen den Storno-Hinweis der Buchung */
  function bookingCancelled(id) {
    db.prepare("UPDATE bk_ms_request SET status = 'zurueckgezogen', updated_at = ? WHERE booking_id = ? AND status IN ('offen','voll')").run(nowTs(), id);
  }

  /* ================================================================= Verwaltung (Plätze › Mitspielersuche) */
  admin.get('/ms', P, (req, res) => {
    expire();
    const W = { offen: "WHERE q.status IN ('offen','voll')", gemeldet: "WHERE q.reports > 0 AND q.status != 'ausgeblendet'", erledigt: "WHERE q.status = 'erledigt'", beendet: "WHERE q.status IN ('zurueckgezogen','abgelaufen','ausgeblendet')", alle: '' };
    const f = Object.hasOwn(W, String(req.query.f)) ? String(req.query.f) : 'offen', w = W[f];   // nur feste Filter (kein Text aus der Anfrage in der Abfrage)
    const rows = db.prepare(`SELECT q.* FROM bk_ms_request q ${w} ORDER BY q.date DESC, q.start DESC LIMIT 300`).all();
    const lk = lookupFor(rows);
    const cnt = db.prepare(`SELECT SUM(status IN ('offen','voll')) offen, SUM(reports > 0 AND status != 'ausgeblendet') gemeldet, SUM(status = 'erledigt') erledigt, SUM(status IN ('zurueckgezogen','abgelaufen','ausgeblendet')) beendet, COUNT(*) alle FROM bk_ms_request`).get();
    const blockedList = db.prepare('SELECT p.member_id, p.blocked_at, p.blocked_by, m.name, m.kind FROM bk_ms_profile p JOIN members m ON m.id = p.member_id WHERE p.blocked_at IS NOT NULL ORDER BY name_key(m.name, m.kind)').all()
      .map(p => ({ member_id: p.member_id, name: x.lastFirst(p.name, p.kind), at: p.blocked_at, by: p.blocked_by }));
    res.json({ f, counts: cnt, settings: msCfg(), mv: ctx.isModuleActive('mitglieder'), blocked: blockedList,
      rows: rows.map(q => { const v = view(q, 0, { rep: lk.rep, m: lk.m }, null, new Map([[q.booking_id, lk.bmap.get(q.booking_id) || null]]));
        return { ...v, status_txt: STATUS_TXT[q.status] || q.status, reports: q.reports, hidden_by: q.hidden_by, created_at: q.created_at, member_id: q.member_id, players: v.players.map(p => ({ id: p.id, name: p.name })), blocked: blocked(q.member_id) }; }) });
  });
  admin.post('/ms/:id/hide', PM, (req, res) => {
    const q = req1(req.params.id); if (!q) return bad(res, 'Dieses Gesuch gibt es nicht.', 404);
    const on = (req.body || {}).hide !== false;
    db.prepare('UPDATE bk_ms_request SET status = ?, hidden_by = ?, updated_at = ? WHERE id = ?').run(on ? 'ausgeblendet' : (q.date >= today() ? 'offen' : 'abgelaufen'), on ? x.uname(req) : null, nowTs(), q.id);
    if (!on) { const n = req1(q.id); if (n.status === 'offen') settle(n); }
    ctx.audit(req.user, on ? 'Plätze: Gesuch ausgeblendet' : 'Plätze: Gesuch wieder sichtbar', `Gesuch von ${x.nameOf(q.member_id)}, ${q.kind} ${deD(q.date)} ${q.start}–${q.end} Uhr`);
    res.json({ ok: true });
  });
  admin.post('/ms/block', PM, (req, res) => {
    const b = req.body || {}, mid = int(b.member_id), m = db.prepare('SELECT id, name FROM members WHERE id = ?').get(mid);
    if (!m) return bad(res, 'Dieses Mitglied gibt es nicht.', 404);
    const before = { gesperrt: blocked(mid) };
    if (b.block) {
      db.prepare('INSERT INTO bk_ms_profile(member_id, open, blocked_at, blocked_by) VALUES (?,0,?,?) ON CONFLICT(member_id) DO UPDATE SET blocked_at = excluded.blocked_at, blocked_by = excluded.blocked_by').run(mid, nowTs(), x.uname(req));
      db.prepare("UPDATE bk_ms_request SET status = 'ausgeblendet', hidden_by = ?, updated_at = ? WHERE member_id = ? AND status IN ('offen','voll')").run(x.uname(req), nowTs(), mid);
    } else {
      const pr = profile(mid);
      if (pr && pr.open) db.prepare('UPDATE bk_ms_profile SET blocked_at = NULL, blocked_by = NULL WHERE member_id = ?').run(mid);
      else db.prepare('DELETE FROM bk_ms_profile WHERE member_id = ?').run(mid);
    }
    const diff = ctx.auditDiff({ gesperrt: ['Für die Mitspielersuche gesperrt', 'bool'] }, before, { gesperrt: blocked(mid) });
    if (diff) ctx.audit(req.user, 'Plätze: Mitspielersuche', `${m.name}: ${diff}`);
    res.json({ ok: true });
  });
  const SET_LABELS = { on: ['Mitspielersuche in der App', 'bool'], max_open: 'Offene Gesuche je Mitglied', max_day: 'Zusagen je Mitglied und Tag', kinds: ['Spielformen', 'text'], levels: ['Spielstärken', 'text'] };
  const forDiff = c => ({ ...c, kinds: c.kinds.map(k => `${k.name} (${k.min === k.max ? k.min : `${k.min}–${k.max}`})`).join(', '), levels: c.levels.join(', ') });
  admin.put('/ms/settings', PE, (req, res) => {
    const b = req.body || {}, before = forDiff(msCfg());
    if (b.on !== undefined) SET('ms_on', b.on ? '1' : '0');
    if (b.max_open !== undefined) SET('ms_max_open', String(Math.max(1, Math.min(10, int(b.max_open) || 3))));
    if (b.max_day !== undefined) SET('ms_max_day', String(Math.max(1, Math.min(50, int(b.max_day) || 10))));
    if (b.kinds !== undefined) {
      const ks = (Array.isArray(b.kinds) ? b.kinds : []).map(k => ({ name: x.txt(k && k.name, 30), min: Math.max(1, Math.min(10, int(k && k.min) || 1)), max: Math.max(1, Math.min(10, int(k && k.max) || int(k && k.min) || 1)) }))
        .filter(k => k.name).map(k => ({ ...k, max: Math.max(k.min, k.max) })).slice(0, 8);
      if (!ks.length || new Set(ks.map(k => k.name.toLowerCase())).size !== ks.length) return bad(res, 'Bitte mindestens eine Spielform, jede nur einmal.');
      SET('ms_kinds', JSON.stringify(ks));
    }
    if (b.levels !== undefined) {
      const ls = [...new Set((Array.isArray(b.levels) ? b.levels : []).map(l => x.txt(l, 30)).filter(Boolean))].slice(0, 8);
      if (ls.length < 2) return bad(res, 'Bitte mindestens zwei Spielstärken.');
      SET('ms_levels', ls.join('\n'));
    }
    const diff = ctx.auditDiff(SET_LABELS, before, forDiff(msCfg()));
    if (diff) ctx.audit(req.user, 'Plätze: Einstellungen Mitspielersuche geändert', diff);
    res.json({ ok: true, settings: msCfg() });
  });

  /* ---------- Hooks: Übersicht, „Für mich“, Datenschutz ---------- */
  const reportedCount = () => db.prepare("SELECT COUNT(*) n FROM bk_ms_request WHERE reports > 0 AND status IN ('offen','voll')").get().n;
  /** „Für mich“ › Zu erledigen: eigenes volles Gesuch ohne Platz → Platz buchen */
  function todo(mid) {
    if (!msCfg().on) return [];
    expire();
    return db.prepare("SELECT * FROM bk_ms_request WHERE member_id = ? AND status = 'voll' AND booking_id IS NULL ORDER BY date, start LIMIT 2").all(mid)
      .map(q => ({ title: 'Dein Gesuch ist voll – jetzt Platz buchen', sub: `${q.kind} ${when(q)}`, focus: `ms${q.id}` }));
  }
  const RET = () => num('ms_keep_days', 90, 30, 730);
  const retention = () => [{ id: 'mitspieler', label: 'Mitspielersuche', text: 'Gesuche und Zusagen der Mitspielersuche (wer wann mit wem spielen wollte).', unit: 'tage', value: RET(), def: 90, min: 30, max: 730,
    due: cut => db.prepare('SELECT COUNT(*) n FROM bk_ms_request WHERE date < ?').get(cut).n,
    purge: cut => db.transaction(() => {
      const ids = db.prepare('SELECT id FROM bk_ms_request WHERE date < ?').pluck().all(cut);
      for (const id of ids) { db.prepare('DELETE FROM bk_ms_reply WHERE request_id = ?').run(id); db.prepare('DELETE FROM bk_ms_report WHERE request_id = ?').run(id); }
      // Teilnahme an der Börse endet mit der Mitgliedschaft (ausgetreten oder gelöscht)
      db.prepare('DELETE FROM bk_ms_profile WHERE member_id IN (SELECT id FROM members WHERE active = 0 OR deleted = 1)').run();
      return db.prepare('DELETE FROM bk_ms_request WHERE date < ?').run(cut).changes;
    })(),
    set: v => SET('ms_keep_days', String(v)) }];
  const privacy = () => ({ purpose: 'Mitspielersuche: Gesuche und Zusagen unter Mitgliedern', data: 'Name, Foto (nur mit Freigabe „Platzbuchung“), Spielform, Zeit, Spielstärke und LK (freiwillig), Hinweis, Zusagen, Meldungen', persons: 'Mitglieder mit dem App-Bereich „Plätze“', frist: `${RET()} Tage nach dem Termin` });
  const memberData = id => ({
    mitspieler_gesuche: db.prepare('SELECT date AS datum, start AS von, end AS bis, kind AS spielform, level AS spielstaerke, lk_from AS lk_von, lk_to AS lk_bis, note AS hinweis, status FROM bk_ms_request WHERE member_id = ? ORDER BY date').all(id),
    mitspieler_zusagen: db.prepare('SELECT q.date AS datum, q.start AS von, q.kind AS spielform, r.status, r.created_at AS zugesagt_am FROM bk_ms_reply r JOIN bk_ms_request q ON q.id = r.request_id WHERE r.member_id = ? ORDER BY q.date').all(id),
    mitspieler_teilnahme: (p => (p ? { teilnahme: Boolean(p.open), spielstaerke: p.level, lk: p.lk, gesperrt_seit: p.blocked_at } : null))(profile(id)),
  });
  /* Konto zusammengeführt (intoId) oder gelöscht: Spalten mit Fremdschlüssel hängt der Kern um; hier fallen doppelte Zusagen und Zusagen zu Gesuchen des gelöschten Kontos weg */
  function memberRemoved(fromId, intoId) {
    if (intoId) {
      for (const r of db.prepare('SELECT request_id FROM bk_ms_reply WHERE member_id = ?').all(fromId)) {
        const own = db.prepare('SELECT 1 FROM bk_ms_request WHERE id = ? AND member_id = ?').get(r.request_id, intoId);
        if (own || db.prepare('SELECT 1 FROM bk_ms_reply WHERE request_id = ? AND member_id = ?').get(r.request_id, intoId)) db.prepare('DELETE FROM bk_ms_reply WHERE request_id = ? AND member_id = ?').run(r.request_id, fromId);
      }
      for (const r of db.prepare('SELECT request_id FROM bk_ms_report WHERE member_id = ?').all(fromId)) if (db.prepare('SELECT 1 FROM bk_ms_report WHERE request_id = ? AND member_id = ?').get(r.request_id, intoId)) db.prepare('DELETE FROM bk_ms_report WHERE request_id = ? AND member_id = ?').run(r.request_id, fromId);
      if (db.prepare('SELECT 1 FROM bk_ms_profile WHERE member_id = ?').get(intoId)) db.prepare('DELETE FROM bk_ms_profile WHERE member_id = ?').run(fromId);
    } else {
      for (const t of ['bk_ms_reply', 'bk_ms_report']) db.prepare(`DELETE FROM ${t} WHERE request_id IN (SELECT id FROM bk_ms_request WHERE member_id = ?)`).run(fromId);
    }
  }
  const pushEvents = () => [
    { id: 'mitspieler_zusage', label: 'Mitspielersuche: jemand spielt mit', desc: 'Jemand hat bei deinem Gesuch „Ich spiele mit“ getippt.', default: true },
    { id: 'mitspieler_voll', label: 'Mitspielersuche: Gesuch voll', desc: 'Dein Gesuch hat genug Zusagen – ohne Platz: jetzt einen Platz buchen.', default: true },
  ];
  /** Einstellungen für die Funktionsdatei (wirksame Werte, auch ohne gespeicherte Einstellung) */
  const settingsOut = () => { const c = msCfg(); return { ms_on: c.on ? '1' : '0', ms_kinds: JSON.stringify(c.kinds), ms_levels: c.levels.join('\n'), ms_max_open: String(c.max_open), ms_max_day: String(c.max_day), ms_keep_days: String(RET()) }; };
  return { settingsOut, booked, bookingCancelled, reportedCount, todo, retention, privacy, memberData, memberRemoved, pushEvents, on: () => msCfg().on };
}

module.exports = { activate, tables };
