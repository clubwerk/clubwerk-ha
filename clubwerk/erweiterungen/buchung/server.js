'use strict';
/* =====================================================================================================
   Modul „Buchungssystem“
   Plätze (Tennis, Padel …) und Geräte (Ballmaschine, Leihschläger …) buchen – in der Mitglieder-App (auch von unterwegs,
   siehe Anleitung „Externer Zugang“) und am Tablet im Vereinsheim.
   Regeln: Öffnungszeiten und Zeitraster je Platz, Höchstdauer, Vorlauf in Tagen, Kontingent offener Buchungen je Mitglied
   (Mitspieler zählen mit), Gäste mit Gastgebühr (offener Posten in der Mitgliederverwaltung), Warteliste.
   Verwaltung: Belegungsplan, Buchen für Mitglieder, Serienbuchungen (Training, Mannschaften) und Sperren (Wartung, Turnier).
   ===================================================================================================== */
let C;
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const nowTs = () => { const d = new Date(); return `${today()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '')) || s === '24:00';
const tm = s => (isTime(s) ? +s.slice(0, 2) * 60 + +s.slice(3, 5) : null);
const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isoDow = s => { const d = new Date(s + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; };   // 1 = Montag … 7 = Sonntag
const deD = s => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '');
const WD = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const txt = (v, max = 120) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const J = (v, d) => { try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };
const KIND = { platz: 'Platz', artikel: 'Gerät' };
const TYPE = { buchung: 'Buchung', serie: 'Serie', sperre: 'Sperre' };

function tables(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS bk_resource (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'platz', name TEXT NOT NULL, area TEXT, note TEXT,
  days TEXT NOT NULL DEFAULT '1234567', open_from TEXT NOT NULL DEFAULT '08:00', open_to TEXT NOT NULL DEFAULT '22:00',
  slot_min INTEGER NOT NULL DEFAULT 60, max_min INTEGER NOT NULL DEFAULT 120, quantity INTEGER NOT NULL DEFAULT 1, guest_fee_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 100, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS bk_booking (
  id INTEGER PRIMARY KEY, resource_id INTEGER NOT NULL REFERENCES bk_resource(id), date TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'buchung',                 -- buchung | serie | sperre
  member_id INTEGER REFERENCES members(id), partners TEXT NOT NULL DEFAULT '[]', guests TEXT NOT NULL DEFAULT '[]',
  fee_cents INTEGER NOT NULL DEFAULT 0, charge_id INTEGER, series_id INTEGER, title TEXT, note TEXT,
  status TEXT NOT NULL DEFAULT 'aktiv',                 -- aktiv | storniert
  source TEXT NOT NULL DEFAULT 'app',                   -- app | tablet | verwaltung
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), cancelled_at TEXT, cancelled_by TEXT, cancel_reason TEXT
);
CREATE INDEX IF NOT EXISTS ix_bk_day ON bk_booking(date, resource_id, status);
CREATE TABLE IF NOT EXISTS bk_series (
  id INTEGER PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, resources TEXT NOT NULL, weekdays TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
  from_date TEXT NOT NULL, to_date TEXT NOT NULL, member_id INTEGER, note TEXT, active INTEGER NOT NULL DEFAULT 1, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS bk_wait (
  id INTEGER PRIMARY KEY, resource_id INTEGER NOT NULL, date TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, member_id INTEGER NOT NULL,
  notified_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), UNIQUE(resource_id, date, start, member_id)
);`);
}

function activate(ctx) {
  C = ctx;
  const db = ctx.db;
  tables(db);
  const { need, bad, int, rateLimit } = ctx;
  const S = (k, d = '') => ctx.getSetting('ext_buchung_' + k, d);
  const SET = (k, v) => ctx.setSetting('ext_buchung_' + k, String(v));
  const P = need('buchung');
  const admin = ctx.admin, T = ctx.tablet, M = ctx.member;
  const uname = req => req.user.name || req.user.username;
  const ar = fn => ctx.asyncRoute(fn);
  const mv = () => ctx.isModuleActive('mitglieder');
  const hook = async (name, ...a) => { const r = await ctx.callHooks(name, ...a); const x = r.find(y => y.id === 'mitglieder'); return x ? x.result : null; };

  const DEF = { advance_days: '7', max_open_platz: '2', max_open_artikel: '2', count_partners: '1', max_partners: '3', max_guests: '3', guest_fee_cents: '500',
    cancel_before_min: '0', show_names: '1', rules: '', tablet_booking: '1', notify_partners: '1', waitlist: '1', max_waits: '3' };
  const cfg = () => {
    const n = k => { const v = parseInt(S(k, DEF[k]), 10); return Number.isFinite(v) ? v : parseInt(DEF[k], 10); };
    return { advance_days: n('advance_days'), max_open_platz: n('max_open_platz'), max_open_artikel: n('max_open_artikel'), count_partners: S('count_partners', '1') === '1',
      max_partners: n('max_partners'), max_guests: n('max_guests'), guest_fee_cents: n('guest_fee_cents'), cancel_before_min: n('cancel_before_min'),
      show_names: S('show_names', '1') === '1', rules: S('rules', ''), tablet_booking: S('tablet_booking', '1') === '1', notify_partners: S('notify_partners', '1') === '1',
      waitlist: S('waitlist', '1') === '1', max_waits: n('max_waits') };
  };
  // Beim ersten Start zwei Beispielplätze, damit man sieht, wie es aussieht (frei änderbar)
  if (S('seeded') !== '1') {
    if (!db.prepare('SELECT 1 FROM bk_resource').get()) {
      const ins = db.prepare("INSERT INTO bk_resource(kind, name, area, sort) VALUES (?,?,?,?)");
      ins.run('platz', 'Platz 1', 'Plätze', 10); ins.run('platz', 'Platz 2', 'Plätze', 20);
    }
    SET('seeded', '1');
  }

  /* ---------------------------------------------------------------- Helfer */
  const resources = (all = false) => db.prepare(`SELECT * FROM bk_resource ${all ? '' : 'WHERE active = 1'} ORDER BY kind DESC, sort, name COLLATE NOCASE`).all();
  const resource = id => db.prepare('SELECT * FROM bk_resource WHERE id = ?').get(int(id));
  const memberRow = id => db.prepare("SELECT id, name FROM members WHERE id = ? AND kind = 'mitglied' AND active = 1 AND deleted = 0 AND pending = 0").get(int(id));
  const people = () => db.prepare("SELECT id, name FROM members WHERE kind = 'mitglied' AND active = 1 AND deleted = 0 AND pending = 0 ORDER BY name_key(name, kind)").all();
  const nameOf = id => (db.prepare('SELECT name FROM members WHERE id = ?').get(id) || {}).name || '?';
  const bview = (b, { me = null, names = true, full = false } = {}) => {
    const partners = J(b.partners, []), guests = J(b.guests, []);
    const mine = me != null && (b.member_id === me || partners.includes(me));
    const show = full || mine || (names && b.type === 'buchung');
    const out = { id: b.id, resource_id: b.resource_id, date: b.date, start: b.start, end: b.end, type: b.type, title: b.type === 'buchung' ? null : b.title, mine, own: me != null && b.member_id === me,
      who: show && b.type === 'buchung' ? [b.member_id ? nameOf(b.member_id) : (b.title || 'Verein'), ...partners.map(nameOf), ...guests.map(g => `${g} (Gast)`)] : null };
    if (full) Object.assign(out, { member_id: b.member_id, partners, guests, fee_cents: b.fee_cents, charge_id: b.charge_id, series_id: b.series_id, note: b.note, source: b.source, status: b.status, created_by: b.created_by, created_at: b.created_at, title: b.title });
    return out;
  };
  const dayBookings = date => db.prepare("SELECT * FROM bk_booking WHERE date = ? AND status = 'aktiv' ORDER BY start").all(date);
  /** belegt: Sperre blockiert den Platz ganz, sonst zählt die Menge (Geräte, z. B. 4 Leihschläger) */
  function free(r, date, s, e, exceptId = 0) {
    const ov = db.prepare("SELECT type FROM bk_booking WHERE resource_id = ? AND date = ? AND status = 'aktiv' AND start < ? AND end > ? AND id != ?").all(r.id, date, hhmm(e), hhmm(s), exceptId);
    if (ov.some(x => x.type === 'sperre')) return false;
    return ov.length < Math.max(1, r.quantity || 1);
  }
  /** Zeit im Raster und in den Öffnungszeiten? → Fehlertext oder null */
  function gridError(r, date, s, e, { admin: isAdmin = false } = {}) {
    if (!isDate(date)) return 'Bitte ein gültiges Datum wählen.';
    if (s == null || e == null || e <= s) return 'Bitte Beginn und Dauer wählen.';
    if (isAdmin) return null;   // die Verwaltung darf auch außerhalb des Rasters (z. B. Sperre ganztags)
    if (!String(r.days || '').includes(String(isoDow(date)))) return `${r.name} ist ${WD[isoDow(date)]} nicht buchbar.`;
    const o = tm(r.open_from), c = tm(r.open_to);
    if (s < o || e > c) return `${r.name} ist von ${r.open_from} bis ${r.open_to} Uhr buchbar.`;
    if ((s - o) % r.slot_min || (e - s) % r.slot_min) return `Bitte im ${r.slot_min}-Minuten-Raster buchen.`;
    if (e - s > r.max_min) return `Höchstens ${r.max_min >= 60 && r.max_min % 60 === 0 ? `${r.max_min / 60} Std.` : `${r.max_min} Min.`} am Stück.`;
    return null;
  }
  /** offene (noch nicht vorbei) Buchungen eines Mitglieds je Art */
  function openCount(mid, kind, exceptId = 0) {
    const d = today(), n = hhmm(nowMin());
    return db.prepare(`SELECT b.id, b.member_id, b.partners FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.status = 'aktiv' AND b.type = 'buchung' AND r.kind = ? AND b.id != ?
      AND (b.date > ? OR (b.date = ? AND b.end > ?))`).all(kind, exceptId, d, d, n)
      .filter(b => b.member_id === mid || (cfg().count_partners && J(b.partners, []).includes(mid))).length;
  }
  /** gleiche Person zur gleichen Zeit schon gebucht (gleiche Art)? */
  function personBusy(mid, kind, date, s, e, exceptId = 0) {
    return db.prepare(`SELECT b.member_id, b.partners FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.status = 'aktiv' AND b.type = 'buchung' AND r.kind = ? AND b.date = ? AND b.start < ? AND b.end > ? AND b.id != ?`)
      .all(kind, date, hhmm(e), hhmm(s), exceptId).some(b => b.member_id === mid || J(b.partners, []).includes(mid));
  }
  const feeOf = r => (r.guest_fee_cents != null ? r.guest_fee_cents : cfg().guest_fee_cents);

  /**
   * Buchung durch ein Mitglied (App oder Tablet) – alle Regeln.
   * b = { resource_id, date, start, minutes, partners: [ids], guests: [names], accept }
   */
  async function memberBook(mid, b, source) {
    const c = cfg();
    const r = resource(b.resource_id);
    if (!r || !r.active) throw new Error('Diesen Platz gibt es nicht (mehr).');
    const date = String(b.date || ''), s = tm(b.start), e = s == null ? null : s + int(b.minutes);
    const ge = gridError(r, date, s, e); if (ge) throw new Error(ge);
    const d0 = today();
    if (date < d0 || (date === d0 && e <= nowMin() + 5)) throw new Error('Diese Zeit ist schon vorbei.');
    if (date > addDays(d0, c.advance_days)) throw new Error(`Gebucht werden kann höchstens ${c.advance_days} Tage im Voraus.`);
    if (c.rules && !b.accept) throw new Error('Bitte die Platzordnung bestätigen.');
    const partners = [...new Set((Array.isArray(b.partners) ? b.partners : []).map(Number).filter(x => Number.isInteger(x) && x !== mid))].slice(0, 10);
    if (partners.length > c.max_partners) throw new Error(`Höchstens ${c.max_partners} Mitspieler.`);
    const guests = (Array.isArray(b.guests) ? b.guests : []).map(g => txt(g, 60)).filter(Boolean);
    if (guests.length > c.max_guests) throw new Error(`Höchstens ${c.max_guests} Gäste.`);
    if (guests.some(g => g.length < 3)) throw new Error('Bitte für jeden Gast den Namen eintragen.');
    for (const p of partners) if (!memberRow(p)) throw new Error('Ein Mitspieler wurde nicht gefunden.');
    const max = r.kind === 'artikel' ? c.max_open_artikel : c.max_open_platz;
    const who = [mid, ...(c.count_partners ? partners : [])];
    for (const p of who) {
      if (max && openCount(p, r.kind) >= max) throw new Error(p === mid ? `Du hast schon die höchste Zahl offener Buchungen (${max}) – erst wenn eine vorbei ist, geht die nächste.` : `${nameOf(p)} hat schon die höchste Zahl offener Buchungen (${max}).`);
    }
    for (const p of [mid, ...partners]) if (personBusy(p, r.kind, date, s, e)) throw new Error(p === mid ? 'Du hast zu dieser Zeit schon gebucht.' : `${nameOf(p)} hat zu dieser Zeit schon gebucht.`);
    const fee = guests.length ? guests.length * feeOf(r) : 0;
    let id;
    db.transaction(() => {   // Prüfen und Eintragen in einem Schritt: zwei gleichzeitige Buchungen können sich nicht überholen
      if (!free(r, date, s, e)) throw new Error('Gerade eben hat jemand anderes gebucht – bitte eine andere Zeit wählen.');
      id = Number(db.prepare('INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, partners, guests, fee_cents, source, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(r.id, date, hhmm(s), hhmm(e), 'buchung', mid, JSON.stringify(partners), JSON.stringify(guests), fee, source, nameOf(mid)).lastInsertRowid);
    })();
    // Gastgebühr: offener Posten beim Mitglied (Einzug mit dem nächsten Lastschrifteinzug)
    if (fee && mv()) {
      const cid = await hook('createCharge', { member_id: mid, text: `Gastgebühr ${r.name} ${deD(date)} ${hhmm(s)} (Gäste: ${guests.length})`, cents: fee, due_date: date, kind: 'sonstiges', ext_key: `bk-${id}`, by: nameOf(mid) });
      if (cid) db.prepare('UPDATE bk_booking SET charge_id = ? WHERE id = ?').run(cid, id);
    }
    db.prepare('DELETE FROM bk_wait WHERE member_id = ? AND resource_id = ? AND date = ? AND start = ?').run(mid, r.id, date, hhmm(s));
    if (c.notify_partners && partners.length) notify(partners, `Platzbuchung: ${r.name} am ${deD(date)}`, [`${nameOf(mid)} hat dich als Mitspieler eingetragen:`, '', `${r.name} · ${WD[isoDow(date)]} ${deD(date)} · ${hhmm(s)}–${hhmm(e)} Uhr`]).catch(() => {});
    return { id, fee_cents: fee };
  }

  /** E-Mail an Mitglieder (Adresse aus der Mitgliederverwaltung) */
  async function notify(ids, subject, lines) {
    if (!ctx.mail.ready() || !mv()) return 0;
    let n = 0;
    for (const id of ids) {
      const a = await hook('memberAddress', id).catch(() => null);
      if (!a || !a.email) continue;
      try { await ctx.mail.send({ to: a.email, subject: `${subject} – ${ctx.getSetting('club_name', 'Verein')}`, text: [`Hallo ${String(a.name || '').split(' ')[0]},`, '', ...lines, '', 'Viele Grüße', ctx.getSetting('club_name', 'Verein')].join('\n') }); n++; } catch (e) { /* weiter */ }
    }
    return n;
  }

  /** Stornieren (Mitglied, Tablet oder Verwaltung) + Gastgebühr zurücknehmen + Warteliste benachrichtigen */
  async function cancel(b, by, reason = '') {
    db.prepare("UPDATE bk_booking SET status = 'storniert', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ? AND status = 'aktiv'").run(nowTs(), by, txt(reason, 160) || null, b.id);
    if (b.charge_id) await ctx.callHooks('cancelCharge', b.charge_id, `Buchung storniert${reason ? ': ' + txt(reason, 80) : ''}`, by);
    await wakeWaitlist(b);
  }
  async function wakeWaitlist(b) {
    if (!cfg().waitlist || b.date < today()) return;
    const r = resource(b.resource_id); if (!r) return;
    const s = tm(b.start), e = tm(b.end);
    const ws = db.prepare('SELECT * FROM bk_wait WHERE resource_id = ? AND date = ? AND notified_at IS NULL AND start < ? AND end > ?').all(b.resource_id, b.date, hhmm(e), hhmm(s));
    for (const w of ws) {
      if (!free(r, w.date, tm(w.start), tm(w.end))) continue;
      db.prepare('UPDATE bk_wait SET notified_at = ? WHERE id = ?').run(nowTs(), w.id);
      notify([w.member_id], `Frei geworden: ${r.name} ${deD(w.date)}`, [`Du stehst auf der Warteliste – ${r.name} am ${WD[isoDow(w.date)]} ${deD(w.date)} um ${w.start} Uhr ist jetzt frei.`, '', 'Schnell sein lohnt sich: Gebucht ist erst, wenn du in der Mitglieder-App unter „Buchen“ zugreifst.']).catch(() => {});
    }
  }

  /** Tagesplan für Anzeige (App, Tablet, Verwaltung) */
  function dayPlan(date, { me = null, full = false, kind = null } = {}) {
    const c = cfg();
    const rs = resources(full).filter(r => !kind || r.kind === kind);
    return { date, dow: isoDow(date), resources: rs.map(r => ({ id: r.id, kind: r.kind, name: r.name, area: r.area || (r.kind === 'artikel' ? 'Geräte' : 'Plätze'), note: r.note, open_from: r.open_from, open_to: r.open_to,
      slot_min: r.slot_min, max_min: r.max_min, quantity: r.quantity, open_today: String(r.days).includes(String(isoDow(date))), guest_fee_cents: feeOf(r), active: Boolean(r.active), days: r.days })),
      bookings: dayBookings(date).filter(b => rs.some(r => r.id === b.resource_id)).map(b => bview(b, { me, names: c.show_names, full })),
      waits: me != null ? db.prepare('SELECT id, resource_id, start, end FROM bk_wait WHERE member_id = ? AND date = ?').all(me, date) : [] };
  }
  const myUpcoming = mid => {
    const d = today(), n = hhmm(nowMin());
    return db.prepare(`SELECT b.*, r.name AS rname, r.kind FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.status = 'aktiv' AND b.type = 'buchung' AND (b.date > ? OR (b.date = ? AND b.end > ?)) ORDER BY b.date, b.start`).all(d, d, n)
      .filter(b => b.member_id === mid || J(b.partners, []).includes(mid)).map(b => ({ ...bview(b, { me: mid, full: false }), resource: b.rname, kind: b.kind, fee_cents: b.member_id === mid ? b.fee_cents : 0,
        canCancel: b.member_id === mid && canCancelNow(b) }));
  };
  const canCancelNow = b => { const lim = cfg().cancel_before_min; const st = Date.parse(`${b.date}T${b.start}:00`); return Date.now() <= st - lim * 60000; };

  /* ================================================================= Mitglieder-App (/api/m/buchung/…) */
  M.get('/me', (req, res) => {
    const mid = req.member.id, c = cfg();
    const date = isDate(req.query.date) ? req.query.date : today();
    const max = addDays(today(), c.advance_days);
    res.json({ today: today(), now: hhmm(nowMin()), max, settings: { advance_days: c.advance_days, max_partners: c.max_partners, max_guests: c.max_guests, rules: c.rules, waitlist: c.waitlist,
      max_open_platz: c.max_open_platz, max_open_artikel: c.max_open_artikel, cancel_before_min: c.cancel_before_min },
      plan: date >= today() && date <= max ? dayPlan(date, { me: mid }) : { date, resources: [], bookings: [], waits: [] },
      mine: myUpcoming(mid), waits: db.prepare(`SELECT w.id, w.date, w.start, w.end, w.notified_at, r.name AS resource FROM bk_wait w JOIN bk_resource r ON r.id = w.resource_id WHERE w.member_id = ? AND w.date >= ? ORDER BY w.date, w.start`).all(mid, today()),
      people: people().filter(p => p.id !== mid) });
  });
  M.post('/book', rateLimit('bkapp', 30, 60000), ar(async (req, res) => {
    try { const r = await memberBook(req.member.id, req.body || {}, 'app'); res.json({ ok: true, ...r }); } catch (e) { bad(res, e.message); }
  }));
  M.post('/cancel', rateLimit('bkapp', 30, 60000), ar(async (req, res) => {
    const b = db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int((req.body || {}).id));
    if (!b || b.member_id !== req.member.id || b.type !== 'buchung') return bad(res, 'Diese Buchung kannst du nicht stornieren.');
    if (!canCancelNow(b)) return bad(res, cfg().cancel_before_min ? `Stornieren geht nur bis ${cfg().cancel_before_min} Minuten vor Beginn.` : 'Die Buchung hat schon begonnen.');
    await cancel(b, req.member.name);
    res.json({ ok: true });
  }));
  M.post('/wait', rateLimit('bkapp', 30, 60000), (req, res) => {
    const c = cfg(), b = req.body || {}, mid = req.member.id;
    if (!c.waitlist) return bad(res, 'Die Warteliste ist ausgeschaltet.');
    if (b.remove) { db.prepare('DELETE FROM bk_wait WHERE id = ? AND member_id = ?').run(int(b.id), mid); return res.json({ ok: true }); }
    const r = resource(b.resource_id); const s = tm(b.start), e = s == null ? null : s + int(b.minutes || (r && r.slot_min));
    if (!r || !r.active) return bad(res, 'Diesen Platz gibt es nicht.');
    const ge = gridError(r, String(b.date || ''), s, e); if (ge) return bad(res, ge);
    if (b.date < today() || b.date > addDays(today(), c.advance_days)) return bad(res, 'Für diesen Tag geht keine Warteliste.');
    if (free(r, b.date, s, e)) return bad(res, 'Die Zeit ist frei – einfach buchen.');
    if (db.prepare('SELECT COUNT(*) n FROM bk_wait WHERE member_id = ? AND date >= ?').get(mid, today()).n >= c.max_waits) return bad(res, `Höchstens ${c.max_waits} Einträge auf der Warteliste.`);
    try { db.prepare('INSERT INTO bk_wait(resource_id, date, start, end, member_id) VALUES (?,?,?,?,?)').run(r.id, b.date, hhmm(s), hhmm(e), mid); } catch (x) { return bad(res, 'Du stehst schon auf der Warteliste.'); }
    res.json({ ok: true });
  });

  /* ================================================================= Tablet (/api/tablet/x/buchung/…) */
  T.get('/state', (req, res) => {
    const c = cfg();
    res.json({ today: today(), now: hhmm(nowMin()), booking: c.tablet_booking, rules: c.rules, max_partners: c.max_partners, max_guests: c.max_guests, plan: dayPlan(today(), { me: null }),
      people: c.tablet_booking ? db.prepare("SELECT id, name, pin_hash IS NOT NULL AS pin FROM members WHERE kind = 'mitglied' AND active = 1 AND deleted = 0 AND pending = 0 ORDER BY name_key(name, kind)").all() : [] });
  });
  const tabletMember = (req, res) => {
    const mid = ctx.auth.checkTabletToken((req.body || {}).token);
    if (!mid || typeof mid !== 'number') { bad(res, 'Sitzung abgelaufen – bitte Namen neu wählen.', 401); return null; }
    return mid;
  };
  T.post('/book', rateLimit('bktab', 60, 60000), ar(async (req, res) => {
    if (!cfg().tablet_booking) return bad(res, 'Buchen am Tablet ist ausgeschaltet.');
    const mid = tabletMember(req, res); if (!mid) return;
    const b = req.body || {};
    if (b.date && b.date !== today()) return bad(res, 'Am Tablet wird nur für heute gebucht.');
    try { const r = await memberBook(mid, { ...b, date: today() }, 'tablet'); ctx.auth.dropTabletToken(b.token); res.json({ ok: true, ...r }); } catch (e) { bad(res, e.message); }
  }));
  T.post('/cancel', rateLimit('bktab', 60, 60000), ar(async (req, res) => {
    const mid = tabletMember(req, res); if (!mid) return;
    const b = db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int((req.body || {}).id));
    if (!b || b.member_id !== mid || b.type !== 'buchung') return bad(res, 'Diese Buchung kannst du nicht stornieren.');
    if (!canCancelNow(b)) return bad(res, 'Stornieren geht jetzt nicht mehr.');
    await cancel(b, nameOf(mid)); ctx.auth.dropTabletToken(req.body.token);
    res.json({ ok: true });
  }));

  /* ================================================================= Verwaltung */
  admin.get('/meta', P, (req, res) => res.json({ today: today(), settings: cfg(), resources: resources(true), people: people(),
    counts: { today: db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE date = ? AND status = 'aktiv' AND type = 'buchung'").get(today()).n } }));
  admin.get('/day', P, (req, res) => res.json(dayPlan(isDate(req.query.date) ? req.query.date : today(), { full: true })));
  admin.get('/bookings', P, (req, res) => {   // Liste (Suche, Auswertung)
    const from = isDate(req.query.from) ? req.query.from : today(), to = isDate(req.query.to) ? req.query.to : addDays(from, 30);
    res.json(db.prepare(`SELECT b.*, r.name AS resource FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.date BETWEEN ? AND ? ${req.query.all ? '' : "AND b.status = 'aktiv'"} ORDER BY b.date, b.start LIMIT 2000`).all(from, to)
      .map(b => ({ ...bview(b, { full: true }), resource: b.resource })));
  });
  /* Buchen in der Verwaltung: für ein Mitglied (ohne Kontingent/Vorlauf) oder als Sperre / Vereinsbuchung */
  admin.post('/bookings', P, ar(async (req, res) => {
    const b = req.body || {};
    const r = resource(b.resource_id); if (!r) return bad(res, 'Bitte einen Platz wählen.');
    const type = b.type === 'sperre' ? 'sperre' : 'buchung';
    const s = tm(b.start), e = tm(b.end);
    const ge = gridError(r, String(b.date || ''), s, e, { admin: true }); if (ge) return bad(res, ge);
    const mid = b.member_id ? memberRow(b.member_id) : null;
    if (b.member_id && !mid) return bad(res, 'Mitglied nicht gefunden.');
    const title = txt(b.title, 80);
    if (type === 'sperre' && title.length < 2) return bad(res, 'Bitte einen Grund für die Sperre eintragen (z. B. „Platzpflege“).');
    if (type === 'buchung' && !mid && title.length < 2) return bad(res, 'Bitte ein Mitglied wählen oder einen Titel eintragen (z. B. „Training Jugend“).');
    const partners = (Array.isArray(b.partners) ? b.partners : []).map(Number).filter(x => memberRow(x));
    const guests = (Array.isArray(b.guests) ? b.guests : []).map(g => txt(g, 60)).filter(g => g.length >= 3).slice(0, 10);
    const conflicts = db.prepare("SELECT * FROM bk_booking WHERE resource_id = ? AND date = ? AND status = 'aktiv' AND start < ? AND end > ?").all(r.id, b.date, hhmm(e), hhmm(s));
    let id;
    try {
      db.transaction(() => {
        if (type === 'buchung' && !free(r, b.date, s, e)) throw new Error('Zu dieser Zeit ist schon gebucht.');
        if (type === 'sperre' && conflicts.length && !b.force) throw Object.assign(new Error(`${conflicts.length} Buchung(en) liegen in dieser Zeit.`), { conflicts });
        id = Number(db.prepare('INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, partners, guests, fee_cents, title, note, source, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(r.id, b.date, hhmm(s), hhmm(e), type, mid ? mid.id : null, JSON.stringify(partners), JSON.stringify(guests), 0, title || null, txt(b.note, 300) || null, 'verwaltung', uname(req)).lastInsertRowid);
      })();
    } catch (x) { return res.status(x.conflicts ? 409 : 400).json({ error: x.message, conflicts: (x.conflicts || []).map(c => bview(c, { full: true })) }); }
    if (type === 'sperre' && b.force) for (const c of conflicts.filter(x => x.type !== 'sperre')) {
      await cancel(c, uname(req), `Platz gesperrt: ${title}`);
      if (c.member_id) notify([c.member_id], `Buchung storniert: ${r.name} ${deD(c.date)}`, [`Deine Buchung ${r.name} am ${deD(c.date)} um ${c.start} Uhr musste leider storniert werden.`, `Grund: ${title}`]).catch(() => {});
    }
    if (guests.length && mid && b.fee !== false && mv()) {
      const fee = guests.length * feeOf(r);
      if (fee) { const cid = await hook('createCharge', { member_id: mid.id, text: `Gastgebühr ${r.name} ${deD(b.date)} ${hhmm(s)} (Gäste: ${guests.length})`, cents: fee, due_date: b.date, kind: 'sonstiges', ext_key: `bk-${id}`, by: uname(req) });
        db.prepare('UPDATE bk_booking SET fee_cents = ?, charge_id = ? WHERE id = ?').run(fee, cid || null, id); }
    }
    ctx.audit(req.user, type === 'sperre' ? 'Platz gesperrt' : 'Platz gebucht (Verwaltung)', `${r.name} ${deD(b.date)} ${hhmm(s)}–${hhmm(e)} ${title || (mid ? mid.name : '')}`);
    res.json({ id });
  }));
  admin.post('/bookings/:id/cancel', P, ar(async (req, res) => {
    const b = db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int(req.params.id));
    if (!b) return bad(res, 'Nicht gefunden.', 404);
    const reason = txt((req.body || {}).reason, 160);
    await cancel(b, uname(req), reason);
    if (b.member_id && b.type === 'buchung' && (req.body || {}).notify !== false) {
      const r = resource(b.resource_id);
      notify([b.member_id], `Buchung storniert: ${r.name} ${deD(b.date)}`, [`Deine Buchung ${r.name} am ${deD(b.date)} um ${b.start} Uhr wurde vom Verein storniert.`, reason ? `Grund: ${reason}` : '']).catch(() => {});
    }
    ctx.audit(req.user, 'Buchung storniert (Verwaltung)', `#${b.id} ${b.date} ${b.start}${reason ? ' – ' + reason : ''}`);
    res.json({ ok: true });
  }));

  /* ---------- Plätze & Geräte ---------- */
  const resInput = (b, cur = {}) => {
    const g = k => (b[k] !== undefined ? b[k] : cur[k]);
    const v = { kind: g('kind') === 'artikel' ? 'artikel' : 'platz', name: txt(g('name'), 60), area: txt(g('area'), 40) || null, note: txt(g('note'), 200) || null,
      days: [...new Set(String(g('days') || '').replace(/[^1-7]/g, '').split(''))].sort().join(''), open_from: String(g('open_from') || ''), open_to: String(g('open_to') || ''),
      slot_min: int(g('slot_min')), max_min: int(g('max_min')), quantity: Math.max(1, Math.min(99, int(g('quantity')) || 1)),
      guest_fee_cents: g('guest_fee_cents') === null || g('guest_fee_cents') === '' || g('guest_fee_cents') === undefined ? null : Math.max(0, Math.min(100000, int(g('guest_fee_cents')))),
      active: g('active') === undefined ? 1 : (g('active') ? 1 : 0), sort: int(g('sort')) || 100 };
    if (v.name.length < 2) return { error: 'Bitte einen Namen eintragen (z. B. „Platz 1“).' };
    if (!v.days) return { error: 'Bitte mindestens einen Wochentag wählen.' };
    if (!isTime(v.open_from) || !isTime(v.open_to) || tm(v.open_to) <= tm(v.open_from)) return { error: 'Bitte die Buchungszeiten prüfen (von … bis …).' };
    if (![15, 30, 45, 60, 90, 120].includes(v.slot_min)) return { error: 'Das Zeitraster ist 15, 30, 45, 60, 90 oder 120 Minuten.' };
    if (v.max_min < v.slot_min || v.max_min % v.slot_min || v.max_min > 24 * 60) return { error: 'Die Höchstdauer muss ein Vielfaches des Rasters sein.' };
    if ((tm(v.open_to) - tm(v.open_from)) % v.slot_min) return { error: 'Die Buchungszeit muss ins Raster passen (z. B. 08:00–22:00 bei 60 Minuten).' };
    return { v };
  };
  admin.get('/resources', P, (req, res) => res.json(resources(true).map(r => ({ ...r, future: db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE resource_id = ? AND status = 'aktiv' AND date >= ?").get(r.id, today()).n }))));
  admin.post('/resources', P, (req, res) => {
    const r = resInput(req.body || {}); if (r.error) return bad(res, r.error);
    const k = Object.keys(r.v);
    const id = Number(db.prepare(`INSERT INTO bk_resource(${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map(x => r.v[x])).lastInsertRowid);
    ctx.audit(req.user, 'Buchungssystem: angelegt', r.v.name); res.json({ id });
  });
  admin.put('/resources/:id', P, (req, res) => {
    const cur = resource(req.params.id); if (!cur) return bad(res, 'Nicht gefunden.', 404);
    const r = resInput(req.body || {}, cur); if (r.error) return bad(res, r.error);
    const k = Object.keys(r.v);
    db.prepare(`UPDATE bk_resource SET ${k.map(x => `${x} = ?`).join(', ')} WHERE id = ?`).run(...k.map(x => r.v[x]), cur.id);
    res.json({ ok: true });
  });
  admin.delete('/resources/:id', P, (req, res) => {
    const cur = resource(req.params.id); if (!cur) return bad(res, 'Nicht gefunden.', 404);
    if (db.prepare('SELECT 1 FROM bk_booking WHERE resource_id = ?').get(cur.id)) return bad(res, 'Dafür gibt es schon Buchungen – stattdessen auf „inaktiv“ setzen.');
    db.prepare('DELETE FROM bk_resource WHERE id = ?').run(cur.id); db.prepare('DELETE FROM bk_wait WHERE resource_id = ?').run(cur.id);
    res.json({ ok: true });
  });

  /* ---------- Serien & Sperren (wöchentlich, Zeitraum) ---------- */
  admin.get('/series', P, (req, res) => res.json(db.prepare('SELECT * FROM bk_series ORDER BY active DESC, to_date DESC, id DESC').all().map(x => ({ ...x, resources: J(x.resources, []),
    member: x.member_id ? nameOf(x.member_id) : null, count: db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE series_id = ? AND status = 'aktiv' AND date >= ?").get(x.id, today()).n }))));
  function seriesDays(sx) {
    const out = []; const wd = String(sx.weekdays);
    for (let d = sx.from_date, i = 0; d <= sx.to_date && i < 800; d = addDays(d, 1), i++) if (wd.includes(String(isoDow(d)))) out.push(d);
    return out;
  }
  admin.post('/series', P, ar(async (req, res) => {
    const b = req.body || {};
    const type = b.type === 'sperre' ? 'sperre' : 'serie';
    const title = txt(b.title, 80), rs = [...new Set((Array.isArray(b.resources) ? b.resources : []).map(Number))].map(resource).filter(Boolean);
    const weekdays = [...new Set(String(b.weekdays || '').replace(/[^1-7]/g, '').split(''))].sort().join('');
    const s = tm(b.start), e = tm(b.end);
    if (title.length < 2) return bad(res, type === 'sperre' ? 'Bitte einen Grund eintragen (z. B. „Platzpflege“, „Clubmeisterschaft“).' : 'Bitte einen Titel eintragen (z. B. „Training Herren 40“).');
    if (!rs.length) return bad(res, 'Bitte mindestens einen Platz wählen.');
    if (!weekdays) return bad(res, 'Bitte mindestens einen Wochentag wählen.');
    if (s == null || e == null || e <= s) return bad(res, 'Bitte die Uhrzeit prüfen.');
    if (!isDate(b.from_date) || !isDate(b.to_date) || b.to_date < b.from_date) return bad(res, 'Bitte den Zeitraum prüfen.');
    if (b.from_date < today()) return bad(res, 'Der Zeitraum beginnt in der Vergangenheit.');
    if (addDays(b.from_date, 400) < b.to_date) return bad(res, 'Höchstens ein gutes Jahr am Stück.');
    const mid = b.member_id ? memberRow(b.member_id) : null;
    const sx = { type, title, resources: JSON.stringify(rs.map(r => r.id)), weekdays, start: hhmm(s), end: hhmm(e), from_date: b.from_date, to_date: b.to_date, member_id: mid ? mid.id : null, note: txt(b.note, 300) || null };
    const days = seriesDays(sx);
    // Überschneidungen vorab zeigen; Sperren stornieren auf Wunsch die betroffenen Buchungen, Serien lassen belegte Tage aus
    const clash = [];
    for (const r of rs) for (const d of days) for (const c of db.prepare("SELECT * FROM bk_booking WHERE resource_id = ? AND date = ? AND status = 'aktiv' AND start < ? AND end > ?").all(r.id, d, hhmm(e), hhmm(s))) clash.push({ ...bview(c, { full: true }), resource: r.name });
    if (b.preview) return res.json({ days: days.length * rs.length, clash });
    let id, made = 0, skipped = 0;
    const toCancel = [];
    db.transaction(() => {
      const k = Object.keys(sx);
      id = Number(db.prepare(`INSERT INTO bk_series(${k.join(',')}, created_by) VALUES (${k.map(() => '?').join(',')}, ?)`).run(...k.map(x => sx[x]), uname(req)).lastInsertRowid);
      const ins = db.prepare('INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, title, note, series_id, source, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
      for (const r of rs) for (const d of days) {
        const cl = clash.filter(c => c.resource_id === r.id && c.date === d);
        if (type === 'serie' && cl.length) { skipped++; continue; }
        if (type === 'sperre') toCancel.push(...cl.filter(c => c.type !== 'sperre'));
        ins.run(r.id, d, hhmm(s), hhmm(e), type === 'sperre' ? 'sperre' : 'serie', sx.member_id, title, sx.note, id, 'verwaltung', uname(req)); made++;
      }
    })();
    for (const c of toCancel) {
      const b0 = db.prepare('SELECT * FROM bk_booking WHERE id = ?').get(c.id);
      await cancel(b0, uname(req), `Platz gesperrt: ${title}`);
      if (b0.member_id && b0.type === 'buchung') notify([b0.member_id], `Buchung storniert: ${c.resource} ${deD(b0.date)}`, [`Deine Buchung ${c.resource} am ${deD(b0.date)} um ${b0.start} Uhr musste leider storniert werden.`, `Grund: ${title}`]).catch(() => {});
    }
    ctx.audit(req.user, type === 'sperre' ? 'Sperre angelegt' : 'Serienbuchung angelegt', `${title}: ${made} Termine${skipped ? `, ${skipped} belegt ausgelassen` : ''}${toCancel.length ? `, ${toCancel.length} storniert` : ''}`);
    res.json({ id, made, skipped, cancelled: toCancel.length });
  }));
  admin.post('/series/:id/end', P, ar(async (req, res) => {   // beenden: künftige Termine entfernen (Vergangenes bleibt)
    const sx = db.prepare('SELECT * FROM bk_series WHERE id = ?').get(int(req.params.id)); if (!sx) return bad(res, 'Nicht gefunden.', 404);
    const fut = db.prepare("SELECT * FROM bk_booking WHERE series_id = ? AND status = 'aktiv' AND date >= ?").all(sx.id, today());
    for (const b of fut) await cancel(b, uname(req), 'Serie beendet');
    db.prepare('UPDATE bk_series SET active = 0, to_date = MIN(to_date, ?) WHERE id = ?').run(addDays(today(), -1) < sx.from_date ? sx.from_date : addDays(today(), -1), sx.id);
    ctx.audit(req.user, sx.type === 'sperre' ? 'Sperre aufgehoben' : 'Serie beendet', `${sx.title}: ${fut.length} Termine entfernt`);
    res.json({ ok: true, removed: fut.length });
  }));

  /* ---------- Einstellungen ---------- */
  admin.get('/settings', P, (req, res) => res.json(cfg()));
  admin.put('/settings', P, (req, res) => {
    const b = req.body || {};
    const num = (k, min, max) => { if (b[k] !== undefined) SET(k, Math.max(min, Math.min(max, int(b[k])))); };
    num('advance_days', 0, 365); num('max_open_platz', 0, 50); num('max_open_artikel', 0, 50); num('max_partners', 0, 10); num('max_guests', 0, 10);
    num('guest_fee_cents', 0, 100000); num('cancel_before_min', 0, 7 * 24 * 60); num('max_waits', 1, 20);
    for (const k of ['count_partners', 'show_names', 'tablet_booking', 'notify_partners', 'waitlist']) if (b[k] !== undefined) SET(k, b[k] ? '1' : '0');
    if (b.rules !== undefined) SET('rules', String(b.rules).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '').slice(0, 2000));
    ctx.audit(req.user, 'Buchungssystem: Einstellungen geändert', Object.keys(b).join(', '));
    res.json({ ok: true, settings: cfg() });
  });

  /* ---------- Übersicht, Funktionsdatei ---------- */
  ctx.hooks.overview = () => {
    const d = today(), n = hhmm(nowMin());
    const t = db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE date = ? AND status = 'aktiv' AND type = 'buchung'").get(d).n;
    const nowB = db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE date = ? AND status = 'aktiv' AND start <= ? AND end > ?").get(d, n, n).n;
    return { kpis: [{ l: 'Buchungen heute', v: t }, { l: 'gerade belegt', v: `${nowB} von ${resources().filter(r => r.kind === 'platz').length}` }], alerts: [] };
  };
  ctx.hooks.exportConfig = () => ({ settings: Object.fromEntries(Object.keys(DEF).map(k => [k, S(k, DEF[k])])),
    resources: db.prepare('SELECT kind, name, area, note, days, open_from, open_to, slot_min, max_min, quantity, guest_fee_cents, active, sort FROM bk_resource').all() });
  ctx.hooks.importConfig = d => {
    if (!d || typeof d !== 'object') throw new Error('Leere Funktionsdatei.');
    for (const [k, v] of Object.entries(d.settings || {})) if (k in DEF && typeof v === 'string') SET(k, v.slice(0, 2000));
    let n = 0;
    for (const r of Array.isArray(d.resources) ? d.resources.slice(0, 100) : []) {
      if (!r || db.prepare('SELECT 1 FROM bk_resource WHERE lower(name) = lower(?)').get(String(r.name || ''))) continue;
      const x = resInput(r); if (x.error) continue;
      const k = Object.keys(x.v); db.prepare(`INSERT INTO bk_resource(${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map(y => x.v[y])); n++;
    }
    return `Einstellungen und ${n} Plätze/Geräte übernommen`;
  };
  // Warteliste aufräumen (vergangene Tage)
  setInterval(() => { try { db.prepare('DELETE FROM bk_wait WHERE date < ?').run(today()); } catch (e) { /* */ } }, 6 * 3600 * 1000).unref();
}

module.exports = { activate };
