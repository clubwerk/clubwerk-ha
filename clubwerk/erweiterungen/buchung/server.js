'use strict';
/* =====================================================================================================
   Modul „Buchungssystem“
   Plätze (Tennis, Padel …) und Geräte (Ballmaschine, Leihschläger …) buchen – in der Mitglieder-App (auch von unterwegs,
   siehe Anleitung „Externer Zugang“) und am Tablet im Vereinsheim.
   Regeln: Öffnungszeiten und Zeitraster je Platz, Höchstdauer, Vorlauf in Tagen, Kontingent offener Buchungen je Mitglied
   (Mitspieler zählen mit), Gäste mit Gastgebühr (offener Posten in der Mitgliederverwaltung), Warteliste.
   Verwaltung: Belegungsplan, Buchen für Mitglieder, Serienbuchungen (Training, Mannschaften) und Sperren (Wartung, Turnier).
   ===================================================================================================== */
const { pad, today, nowTs, isDate, addDays, deD, euro } = require('../../src/util');   // gemeinsame Helfer des Kerns (auch als ctx.util)
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '')) || s === '24:00';
const tm = s => (isTime(s) ? +s.slice(0, 2) * 60 + +s.slice(3, 5) : null);
const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const isoDow = s => { const d = new Date(s + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; };   // 1 = Montag … 7 = Sonntag
const WD = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const txt = (v, max = 120) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const J = (v, d) => { try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };
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
CREATE TABLE IF NOT EXISTS bk_label (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#2f6fd6', sort INTEGER NOT NULL DEFAULT 100, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS bk_rights (
  member_id INTEGER NOT NULL PRIMARY KEY REFERENCES members(id), series INTEGER NOT NULL DEFAULT 0, labels TEXT NOT NULL DEFAULT '[]', note TEXT, updated_by TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS bk_wait (
  id INTEGER PRIMARY KEY, resource_id INTEGER NOT NULL, date TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, member_id INTEGER NOT NULL,
  notified_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), UNIQUE(resource_id, date, start, member_id)
);`);
}

function activate(ctx) {
  const db = ctx.db;
  tables(db);
  const { need, bad, int, rateLimit, rateLimitKey } = ctx;
  const S = (k, d = '') => ctx.getSetting('ext_buchung_' + k, d);
  const SET = (k, v) => ctx.setSetting('ext_buchung_' + k, String(v));
  const ALL = ['buchung', 'buchung_buchen', 'buchung_stornieren', 'buchung_serien', 'buchung_einstellungen'];
  const P = need(...ALL);                                   // Belegung ansehen (jedes Recht des Moduls)
  const PS = need('buchung_serien'), PE = need('buchung_einstellungen');
  const may = (req, p) => req.user.perms.includes(p);
  { const rc = db.prepare('PRAGMA table_info(bk_rights)').all().map(c => c.name);
    if (!rc.includes('for_others')) db.exec('ALTER TABLE bk_rights ADD COLUMN for_others INTEGER NOT NULL DEFAULT 0');   // darf in der App für andere Mitglieder buchen
    if (!rc.includes('all_labels')) db.exec('ALTER TABLE bk_rights ADD COLUMN all_labels INTEGER NOT NULL DEFAULT 0');   // darf mit allen aktiven Buchungsarten buchen
    const bc = db.prepare('PRAGMA table_info(bk_booking)').all().map(c => c.name);
    if (!bc.includes('booked_by_id')) db.exec('ALTER TABLE bk_booking ADD COLUMN booked_by_id INTEGER');   // gebucht von (Mitglied, das für ein anderes gebucht hat)
  }
  { const cols = db.prepare('PRAGMA table_info(bk_resource)').all().map(c => c.name);
    if (!cols.includes('department_id')) db.exec('ALTER TABLE bk_resource ADD COLUMN department_id INTEGER');
    if (!cols.includes('outsiders')) db.exec("ALTER TABLE bk_resource ADD COLUMN outsiders TEXT NOT NULL DEFAULT 'gebuehr'");   // gebuehr | gesperrt
    for (const t of ['bk_booking', 'bk_series']) if (!db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === 'label_id')) db.exec(`ALTER TABLE ${t} ADD COLUMN label_id INTEGER`);
    if (!cols.includes('outsider_fee_cents')) db.exec('ALTER TABLE bk_resource ADD COLUMN outsider_fee_cents INTEGER NOT NULL DEFAULT 500');
    if (!cols.includes('deleted')) db.exec('ALTER TABLE bk_resource ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0');   // gelöscht, aber vergangene Buchungen bleiben im Protokoll
    const lc = db.prepare('PRAGMA table_info(bk_label)').all().map(c => c.name);
    if (!lc.includes('use_mode')) db.exec("ALTER TABLE bk_label ADD COLUMN use_mode TEXT NOT NULL DEFAULT 'verwaltung'");   // verwaltung | alle | auswahl
    if (!lc.includes('use_functions')) db.exec("ALTER TABLE bk_label ADD COLUMN use_functions TEXT NOT NULL DEFAULT '[]'");   // Ämter aus der Mitgliederverwaltung
    if (!lc.includes('use_members')) db.exec("ALTER TABLE bk_label ADD COLUMN use_members TEXT NOT NULL DEFAULT '[]'");
    if (!lc.includes('free_rules')) db.exec('ALTER TABLE bk_label ADD COLUMN free_rules INTEGER NOT NULL DEFAULT 0');   // Vereinstermin: ohne Höchstdauer, Kontingent, Vorlauf, Gebühren
    // 3.17: Mitspieler-Pflicht je Platz, Allein-Training (z. B. „Ballwand“), Geräte als Mitspieler (z. B. Ballmaschine)
    if (!cols.includes('partner_required')) db.exec('ALTER TABLE bk_resource ADD COLUMN partner_required INTEGER NOT NULL DEFAULT 0');
    if (!cols.includes('solo_label')) db.exec('ALTER TABLE bk_resource ADD COLUMN solo_label TEXT');            // NULL = kein Allein-Training
    if (!cols.includes('as_partner')) db.exec('ALTER TABLE bk_resource ADD COLUMN as_partner INTEGER NOT NULL DEFAULT 0');   // Gerät: „als Mitspieler buchbar“ (auf allen Plätzen)
    const bc = db.prepare('PRAGMA table_info(bk_booking)').all().map(c => c.name);
    if (!bc.includes('partner_device_id')) db.exec('ALTER TABLE bk_booking ADD COLUMN partner_device_id INTEGER');   // verknüpfte Gerätebuchung (id in bk_booking)
    if (!bc.includes('solo')) db.exec('ALTER TABLE bk_booking ADD COLUMN solo INTEGER NOT NULL DEFAULT 0');
    // 3.20: Wiederholungsregel je Serie (täglich, wöchentlich, alle n Wochen, monatlich) und Spielplan-Import (Schlüssel je Spiel)
    if (!bc.includes('ext_key')) db.exec('ALTER TABLE bk_booking ADD COLUMN ext_key TEXT');
    const sc = db.prepare('PRAGMA table_info(bk_series)').all().map(c => c.name);
    if (!sc.includes('rule')) db.exec('ALTER TABLE bk_series ADD COLUMN rule TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS ix_bk_booking_ext ON bk_booking(ext_key)'); }
  const admin = ctx.admin, T = ctx.tablet, M = ctx.member;
  const uname = req => req.user.name || req.user.username;
  const ar = fn => ctx.asyncRoute(fn);
  const mv = () => ctx.isModuleActive('mitglieder');
  const hook = async (name, ...a) => { const r = await ctx.callHooks(name, ...a); const x = r.find(y => y.id === 'mitglieder'); return x ? x.result : null; };
  const mvSync = (name, ...a) => { const x = ctx.callHooksSync(name, ...a).find(y => y.id === 'mitglieder'); return x ? x.result : null; };   // null ohne Mitgliederverwaltung

  const DEF = { advance_days: '7', max_open_platz: '2', max_open_artikel: '2', count_partners: '1', max_partners: '3', max_guests: '3', guest_fee_cents: '500',
    cancel_before_min: '0', show_names: '1', show_now: '1', rules: '', tablet_booking: '1', notify_partners: '1', waitlist: '1', max_waits: '3',
    allowed_status: 'aktiv,ehren', blocked_fees: '' };
  const cfg = () => {
    const n = k => { const v = parseInt(S(k, DEF[k]), 10); return Number.isFinite(v) ? v : parseInt(DEF[k], 10); };
    return { advance_days: n('advance_days'), max_open_platz: n('max_open_platz'), max_open_artikel: n('max_open_artikel'), count_partners: S('count_partners', '1') === '1',
      max_partners: n('max_partners'), max_guests: n('max_guests'), guest_fee_cents: n('guest_fee_cents'), cancel_before_min: n('cancel_before_min'),
      show_names: S('show_names', '1') === '1', show_now: S('show_now', '1') === '1', rules: S('rules', ''), tablet_booking: S('tablet_booking', '1') === '1', notify_partners: S('notify_partners', '1') === '1',
      waitlist: S('waitlist', '1') === '1', max_waits: n('max_waits'),
      allowed_status: S('allowed_status', DEF.allowed_status).split(',').filter(Boolean), blocked_fees: S('blocked_fees', '').split(',').map(Number).filter(Boolean) };
  };
  // Buchungsarten (Kennzeichnung von Vereinsbuchungen, z. B. Training, Medenspiel) – Vorlagen beim ersten Start
  if (S('labels_seeded') !== '1') {
    if (!db.prepare('SELECT 1 FROM bk_label').get()) { const ins = db.prepare('INSERT INTO bk_label(name, color, sort) VALUES (?,?,?)');
      [['Training', '#2f6fd6'], ['Medenspiel', '#e07b16'], ['Turnier', '#8a4fd6'], ['Kurs', '#1f9a6b'], ['Platzpflege', '#7a7f87']].forEach(([n, c], i) => ins.run(n, c, (i + 1) * 10)); }
    SET('labels_seeded', '1');
  }
  const labels = (all = false) => db.prepare(`SELECT * FROM bk_label ${all ? '' : 'WHERE active = 1'} ORDER BY sort, name COLLATE NOCASE`).all();
  const labelOf = id => (id ? db.prepare('SELECT id, name, color FROM bk_label WHERE id = ?').get(id) : null);
  const labelRow = id => (id ? db.prepare('SELECT * FROM bk_label WHERE id = ?').get(int(id)) : null);
  /** aktuelle Ämter eines Mitglieds (Mitgliederverwaltung → Ehrungen & Ämter), klein geschrieben */
  const functionsOf = mid => (mvSync('functionsOf', mid) || []).map(x => x.toLowerCase());
  const functionNames = () => mvSync('functionNames') || [];
  /** Sonderrechte einzelner Mitglieder in der App (Serien anlegen, bestimmte Buchungsarten) */
  const rightsOf = mid => { const r = mid ? db.prepare('SELECT * FROM bk_rights WHERE member_id = ?').get(mid) : null; return { series: Boolean(r && r.series), forOthers: Boolean(r && r.for_others), allLabels: Boolean(r && r.all_labels), labels: r ? J(r.labels, []).map(Number) : [] }; };
  /** darf dieses Mitglied (App, Tablet) mit der Buchungsart buchen? */
  const labelForMember = (l, mid) => {
    if (!l || !l.active || !mid) return false;
    const rt = rightsOf(mid);
    if (l.use_mode === 'alle' || rt.allLabels || rt.labels.includes(l.id)) return true;
    if (l.use_mode !== 'auswahl') return false;
    if (J(l.use_members, []).map(Number).includes(mid)) return true;
    const f = J(l.use_functions, []).map(x => String(x).trim().toLowerCase()); if (!f.length) return false;
    return functionsOf(mid).some(x => f.includes(x));
  };
  /** in der Verwaltung: „Plätze, Buchungsarten & Einstellungen“ darf alle; sonst wie das verknüpfte Mitglied (bei „nur bestimmte“) */
  const labelForUser = (req, l) => {
    if (!l || !l.active) return false;
    if (req.user.perms.includes('buchung_einstellungen') || l.use_mode !== 'auswahl') return true;
    return Boolean(req.user.member_id) && labelForMember(l, req.user.member_id);
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
  const resources = (all = false) => db.prepare(`SELECT * FROM bk_resource WHERE deleted = 0 ${all ? '' : 'AND active = 1'} ORDER BY sort, kind DESC, name COLLATE NOCASE`).all();
  const resource = id => db.prepare('SELECT * FROM bk_resource WHERE id = ?').get(int(id));
  const memberRow = id => db.prepare("SELECT id, name FROM members WHERE id = ? AND kind = 'mitglied' AND active = 1 AND deleted = 0 AND pending = 0").get(int(id));
  const people = () => db.prepare("SELECT id, name FROM members WHERE kind = 'mitglied' AND active = 1 AND deleted = 0 AND pending = 0 ORDER BY name_key(name, kind)").all();
  const photos = ctx.require('./photos');   // Profilbilder (nur wenn das Mitglied sie für die Platzbuchung freigegeben hat)
  const { lastFirst } = ctx.require('./db');   // Anzeige „Nachname, Vorname“
  const nameOf = id => (db.prepare('SELECT name FROM members WHERE id = ?').get(id) || {}).name || '?';
  /** Geräte, die als Mitspieler gebucht werden können (Ballmaschine …) */
  const partnerDevices = () => db.prepare("SELECT id, name FROM bk_resource WHERE deleted = 0 AND active = 1 AND kind = 'artikel' AND as_partner = 1 ORDER BY sort, name COLLATE NOCASE").all();
  /** verknüpfte Gerätebuchung einer Platzbuchung (aktiv) → { booking, name } oder null */
  const deviceOf = b => { if (!b.partner_device_id) return null; const d = db.prepare("SELECT b.*, r.name AS rname FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.id = ? AND b.status = 'aktiv'").get(b.partner_device_id); return d ? { booking: d, name: d.rname } : null; };
  const soloLabelOf = b => (b.solo ? (resource(b.resource_id) || {}).solo_label || 'allein' : null);
  const bview = (b, { me = null, names = true, full = false } = {}) => {
    const partners = J(b.partners, []), guests = normGuests(J(b.guests, []));
    const mine = me != null && (b.member_id === me || partners.includes(me));
    const show = full || mine || (names && b.type === 'buchung');
    const lab = labelOf(b.label_id);
    const dev = b.type === 'buchung' ? deviceOf(b) : null;
    const out = { id: b.id, resource_id: b.resource_id, date: b.date, start: b.start, end: b.end, type: b.type, series: b.series_id ? true : undefined, label: lab ? { name: lab.name, color: lab.color } : null, title: b.type === 'buchung' && !lab ? null : (b.title || (lab && lab.name) || null), mine, own: me != null && b.member_id === me,
      who: show && b.type === 'buchung' ? [b.member_id ? nameOf(b.member_id) : (b.title || (lab && lab.name) || 'Verein'), ...partners.map(nameOf), ...guests.map(guestLabel)] : null,
      partner_device_name: dev ? dev.name : null, solo_label: b.type === 'buchung' ? soloLabelOf(b) : null };   // Anzeige „Muster, Max + Ballmaschine“ bzw. „… · Ballwand“
    if (full) Object.assign(out, { booked_by: b.booked_by_id ? nameOf(b.booked_by_id) : null, member_id: b.member_id, partners, guests, fee_cents: b.fee_cents, charge_id: b.charge_id, series_id: b.series_id, note: b.note, source: b.source, status: b.status, created_by: b.created_by, created_at: b.created_at, title: b.title, partner_device_id: b.partner_device_id || null, solo: Boolean(b.solo) });
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
  function gridError(r, date, s, e, { admin: isAdmin = false, noMax = false } = {}) {
    if (!isDate(date)) return 'Bitte ein gültiges Datum wählen.';
    if (s == null || e == null || e <= s) return 'Bitte Beginn und Dauer wählen.';
    if (isAdmin) return null;   // die Verwaltung darf auch außerhalb des Rasters (z. B. Sperre ganztags)
    if (!String(r.days || '').includes(String(isoDow(date)))) return `${r.name} ist ${WD[isoDow(date)]} nicht buchbar.`;
    const o = tm(r.open_from), c = tm(r.open_to);
    if (s < o || e > c) return `${r.name} ist von ${r.open_from} bis ${r.open_to} Uhr buchbar.`;
    if ((s - o) % r.slot_min || (e - s) % r.slot_min) return `Bitte im ${r.slot_min}-Minuten-Raster buchen.`;
    if (!noMax && e - s > r.max_min) return `Höchstens ${r.max_min >= 60 && r.max_min % 60 === 0 ? `${r.max_min / 60} Std.` : `${r.max_min} Min.`} am Stück.`;
    return null;
  }
  /** offene (noch nicht vorbei) Buchungen eines Mitglieds je Art */
  function openCount(mid, kind, exceptId = 0) {
    const d = today(), n = hhmm(nowMin());
    // Gerätebuchungen, die als Mitspieler an einer Platzbuchung hängen (Ballmaschine), zählen nicht fürs Kontingent
    return db.prepare(`SELECT b.id, b.member_id, b.partners FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.status = 'aktiv' AND b.type = 'buchung' AND r.kind = ? AND b.id != ?
      AND (b.date > ? OR (b.date = ? AND b.end > ?)) AND b.id NOT IN (SELECT partner_device_id FROM bk_booking WHERE partner_device_id IS NOT NULL AND status = 'aktiv')`).all(kind, exceptId, d, d, n)
      .filter(b => b.member_id === mid || (cfg().count_partners && J(b.partners, []).includes(mid))).length;
  }
  /** gleiche Person zur gleichen Zeit schon gebucht (gleiche Art)? */
  function personBusy(mid, kind, date, s, e, exceptId = 0) {
    return db.prepare(`SELECT b.member_id, b.partners FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.status = 'aktiv' AND b.type = 'buchung' AND r.kind = ? AND b.date = ? AND b.start < ? AND b.end > ? AND b.id != ?
      AND b.id NOT IN (SELECT partner_device_id FROM bk_booking WHERE partner_device_id IS NOT NULL AND status = 'aktiv')`)
      .all(kind, date, hhmm(e), hhmm(s), exceptId).some(b => b.member_id === mid || J(b.partners, []).includes(mid));
  }
  /** Gäste: [{ name, partner }] – partner = Mitglied eines Partnervereins (keine Gastgebühr); alte Einträge waren nur Namen */
  const normGuests = list => (Array.isArray(list) ? list : []).map(g => (typeof g === 'string' ? { name: txt(g, 60), partner: false } : { name: txt(g && g.name, 60), partner: Boolean(g && g.partner) })).filter(g => g.name);
  /** Eckdaten einer Buchung als Zeilen [Bezeichnung, Wert] – für die Infokarte der E-Mail und die Textfassung */
  const summaryRows = b => {
    const r = resource(b.resource_id) || { name: 'Platz' };
    const players = [b.member_id ? nameOf(b.member_id) : null, ...J(b.partners, []).map(nameOf)].filter(Boolean);
    const guests = normGuests(J(b.guests, []));
    return [['Platz', r.name], ['Wann', `${WD[isoDow(b.date)]}, ${deD(b.date)} · ${b.start}–${b.end} Uhr`], ['Gebucht von', b.member_id ? nameOf(b.member_id) : 'Verein'],
      ['Spieler', `${players.join(', ')}${guests.length ? `, ${guests.map(guestLabel).join(', ')}` : ''}${deviceOf(b) ? ` + ${deviceOf(b).name}` : ''}${b.solo ? ` · ${soloLabelOf(b)}` : ''}`]].filter(([, v]) => v);
  };
  const summary = b => summaryRows(b).map(([k, v]) => `${k}: ${v}`);
  /* Mail-Kontingent je buchendem Mitglied: höchstens 20 Mitspieler-Mails je Stunde. Buchen → Stornieren → Buchen ließe sich sonst
     beliebig wiederholen und würde das Vereinspostfach zum Spam-Versender an ausgesuchte Mitglieder machen. Darüber hinaus
     geht die Aktion normal weiter, nur ohne Mail. Aktionen der Verwaltung (budget = null) zählen nicht. */
  const mailBudget = ctx.require('./security').budget({ max: 20, windowMs: 3600000 });
  /** Mitspieler (und ggf. Bucher) informieren – Buchung, Änderung oder Storno. budget: Mitglieds-ID, auf deren Kontingent die Mails gehen */
  function mailPlayers(b, kind, { by = null, reason = '', toBooker = false, old = null, budget = null } = {}) {
    const ids = [...new Set([...(toBooker && b.member_id ? [b.member_id] : []), ...J(b.partners, [])])].filter(id => id !== by);
    if (!ids.length) return;
    const pushEv = kind === 'storno' ? 'storno' : kind === 'aenderung' ? 'aenderung' : 'einladung';
    { // Push (kurz, unabhängig von der E-Mail-Einstellung „Mitspieler informieren“)
      const r0 = resource(b.resource_id) || { name: 'Platz' };
      ctx.push.send(ids, pushEv, { title: kind === 'storno' ? `Storniert: ${r0.name} ${deD(b.date)}` : kind === 'aenderung' ? `Geändert: ${r0.name} ${deD(b.date)}` : `${nameOf(b.member_id)} hat dich eingetragen`, body: `${r0.name} am ${WD[isoDow(b.date)]} ${deD(b.date)} um ${b.start} Uhr${kind === 'storno' && reason ? ' – ' + reason : ''}`, url: './#buchung', tag: `buchung-${pushEv}-${b.id}` }).catch(() => {});
    }
    if (!cfg().notify_partners || (budget != null && !mailBudget.take('m' + budget, ids.length))) return;   // keine Mail (abgeschaltet oder Tageslimit)
    const r = resource(b.resource_id) || { name: 'Platz' };
    const when = `${r.name} am ${WD[isoDow(b.date)]} ${deD(b.date)} um ${b.start} Uhr`;
    const head = kind === 'storno' ? `Storniert: ${when}` : kind === 'aenderung' ? `Geändert: ${when}` : when;
    const ro = old ? resource(old.resource_id) || r : null;
    const intro = kind === 'storno' ? `${by ? nameOf(by) : 'Der Verein'} hat diese Buchung storniert${reason ? ` (Grund: ${reason})` : ''}:`
      : kind === 'aenderung' ? `${by ? nameOf(by) : 'Der Verein'} hat die Buchung geändert${old && (old.date !== b.date || old.start !== b.start || old.end !== b.end || old.resource_id !== b.resource_id) ? ` (vorher: ${ro.name}, ${WD[isoDow(old.date)]} ${deD(old.date)} · ${old.start}–${old.end} Uhr)` : ''}. So sieht sie jetzt aus:`
      : `${nameOf(b.member_id)} hat dich als Mitspieler eingetragen:`;
    const outro = kind === 'storno' ? 'Der Platz ist damit wieder frei.' : 'Viel Spaß beim Spielen! Alle Buchungen siehst du in der Mitglieder-App unter „Buchen“.';
    notify(ids, head, [intro, '', ...summary(b), '', outro], null, { heading: kind === 'storno' ? 'Buchung storniert' : kind === 'aenderung' ? 'Buchung geändert' : 'Du bist als Mitspieler eingetragen', intro, title: when, rows: summaryRows(b), outro,
      calendar: kind === 'storno' ? null : calendarFor(b) }).catch(() => {});
  }
  /** „Deine Buchung musste leider storniert werden“ (Platzsperre, Mannschaftsspiel …) an die Buchende/den Buchenden */
  function notifyLockCancel(b, grund) {
    const rn = (resource(b.resource_id) || { name: 'Platz' }).name, wd = WD[isoDow(b.date)];
    notify([b.member_id], `Buchung storniert: ${rn} ${deD(b.date)}`, [`Deine Buchung ${rn} am ${deD(b.date)} um ${b.start} Uhr musste leider storniert werden.`, `Grund: ${grund}`], 'storno',
      { intro: 'Deine Buchung musste leider storniert werden:', title: `${rn} · ${wd} ${deD(b.date)}`, rows: [['Platz', rn], ['Wann', `${wd}, ${deD(b.date)} · ${b.start}–${b.end} Uhr`], ['Grund', grund]], outro: '' }).catch(() => {});
  }
  /** „Thorsten hat für dich gebucht“ – an das Mitglied, für das gebucht wurde (Push und E-Mail, auch ohne Handy) */
  function mailBookedFor(b, by) {
    const r = resource(b.resource_id) || { name: 'Platz' };
    const when = `${r.name} am ${WD[isoDow(b.date)]} ${deD(b.date)} um ${b.start} Uhr`;
    const intro = `${nameOf(by)} hat für dich gebucht:`;
    notify([b.member_id], `Für dich gebucht: ${when}`, [intro, '', ...summary(b), '', `Ändern oder stornieren kann die Buchung auch ${nameOf(by).split(' ')[0]}.`], 'einladung',
      { heading: 'Für dich gebucht', intro, title: when, rows: summaryRows(b), outro: 'Viel Spaß beim Spielen!', calendar: calendarFor(b) }).catch(() => {});
  }
  const guestLabel = g => `${g.name} (${g.partner ? 'Gast, Partnerverein' : 'Gast'})`;
  const feeOf = r => (r.guest_fee_cents != null ? r.guest_fee_cents : cfg().guest_fee_cents);

  /* ---------- Wer darf buchen? (Mitgliedsstatus, Beitragsart, Abteilung – aus der Mitgliederverwaltung) ---------- */
  const STATUS = { aktiv: 'aktiv', passiv: 'passiv', ehren: 'Ehrenmitglied', ruhend: 'ruhend', ausgetreten: 'ausgetreten' };
  const infoCache = new Map();
  async function info(id) {
    const c = infoCache.get(id); if (c && c.at > Date.now() - 30000) return c.v;
    const v = mv() ? await hook('memberInfo', id).catch(() => null) : null;
    infoCache.set(id, { at: Date.now(), v }); return v;
  }
  /** → null (darf) oder Grund */
  async function notAllowed(id) {
    if (!mv()) return null;
    const i = await info(id); if (!i) return null;
    const c = cfg();
    const st = i.status || 'aktiv';   // ohne erfasste Mitgliedsdaten gilt „aktiv“
    if (!c.allowed_status.includes(st)) return `Mit der Mitgliedschaft „${STATUS[st] || st}“ kann nicht gebucht werden.`;
    if (i.fee && c.blocked_fees.includes(i.fee.id)) return `Mit der Beitragsart „${i.fee.name}“ kann nicht gebucht werden.`;
    return null;
  }
  const deptName = id => ((mvSync('departments') || []).find(d => d.id === id) || {}).name || 'Abteilung';
  const departments = () => (mvSync('departments') || []).filter(d => d.active).map(d => ({ id: d.id, name: d.name }));
  const feeList = () => mvSync('fees') || [];
  async function eligiblePeople(exceptId) {
    const out = [];
    for (const p of people()) if (p.id !== exceptId && !(await notAllowed(p.id))) out.push(p);
    return out;
  }

  /**
   * Prüft eine Buchung (alle Regeln) und berechnet die Gebühren → { r, date, s, e, partners, guests, fee, lines }
   * dry: für die Preisvorschau (ohne Platzordnung)
   */
  async function check(mid, b, { dry = false, exceptId = 0 } = {}) {
    const c = cfg();
    const r = resource(b.resource_id);
    if (!r || !r.active) throw new Error('Diesen Platz gibt es nicht (mehr).');
    const why = await notAllowed(mid); if (why) throw new Error(why);
    const label = b.label_id ? labelRow(b.label_id) : null;
    if (b.label_id && !labelForMember(label, mid)) throw new Error('Diese Buchungsart darfst du nicht verwenden.');
    const club = Boolean(label && label.free_rules);   // Vereinstermin (z. B. Medenspiel): ohne Höchstdauer, Kontingent, Vorlauf und Gebühren
    const date = String(b.date || ''), s = tm(b.start), e = s == null ? null : s + int(b.minutes);
    const ge = gridError(r, date, s, e, { noMax: club }); if (ge) throw new Error(ge);
    const d0 = today();
    if (date < d0 || (date === d0 && e <= nowMin() + 5)) throw new Error('Diese Zeit ist schon vorbei.');
    if (date > addDays(d0, club ? 365 : c.advance_days)) throw new Error(`Gebucht werden kann höchstens ${c.advance_days} Tage im Voraus.`);
    if (!dry && c.rules && !b.accept) throw new Error('Bitte die Platzordnung bestätigen.');
    const partners = [...new Set((Array.isArray(b.partners) ? b.partners : []).map(Number).filter(x => Number.isInteger(x) && x !== mid))].slice(0, 10);
    if (partners.length > (club ? 10 : c.max_partners)) throw new Error(`Höchstens ${club ? 10 : c.max_partners} Mitspieler.`);
    const guests = normGuests(b.guests);
    if (guests.length > (club ? 10 : c.max_guests)) throw new Error(`Höchstens ${club ? 10 : c.max_guests} Gäste.`);
    if (!dry && guests.some(g => g.name.length < 3)) throw new Error('Bitte für jeden Gast den Namen eintragen.');
    for (const p of partners) {
      if (!memberRow(p)) throw new Error('Ein Mitspieler wurde nicht gefunden.');
      const w = await notAllowed(p); if (w) throw new Error(`${nameOf(p)}: ${w}`);
    }
    // Mitspieler-Pflicht, Gerät als Mitspieler (Ballmaschine), Allein-Training (Ballwand) – nur auf Plätzen; Vereinstermine sind ausgenommen
    let device = null, solo = false;
    if (r.kind === 'platz') {
      if (b.partner_device) {
        device = resource(b.partner_device);
        if (!device || device.deleted || !device.active || device.kind !== 'artikel' || !device.as_partner) throw new Error('Dieses Gerät kann nicht als Mitspieler gebucht werden.');
        if (!String(device.days || '').includes(String(isoDow(date))) || s < tm(device.open_from) || e > tm(device.open_to)) throw new Error(`${device.name} ist zu dieser Zeit nicht buchbar (${WD[isoDow(date)]} ${device.open_from}–${device.open_to} Uhr).`);
        const devOld = exceptId ? (db.prepare('SELECT partner_device_id FROM bk_booking WHERE id = ?').get(exceptId) || {}).partner_device_id : null;
        if (!free(device, date, s, e, devOld || 0)) throw new Error(`${device.name} ist um ${hhmm(s)} belegt.`);
      }
      if (b.solo) { if (!r.solo_label) throw new Error(`Auf ${r.name} ist Allein-Training nicht vorgesehen.`); solo = true; }
      if (r.partner_required && !club && !partners.length && !guests.length && !device && !solo) {
        const opts = ['Mitglied', 'Gast', ...partnerDevices().map(x => x.name), ...(r.solo_label ? [r.solo_label] : [])];
        throw new Error(`Auf diesem Platz ist ein Mitspieler Pflicht – ${opts.slice(0, -1).join(', ')} oder ${opts[opts.length - 1]}.`);
      }
    }
    // Platz einer Abteilung: Abteilungsmitglieder frei, andere zahlen Platzgebühr (oder dürfen gar nicht)
    let outsiders = [];
    if (r.department_id && mv()) {
      for (const p of [mid, ...partners]) { const i = await info(p); if (!i || !(i.departments || []).includes(r.department_id)) outsiders.push(p); }
      if (club) outsiders = [];
      if (outsiders.length && r.outsiders === 'gesperrt') throw new Error(`${r.name} ist der Abteilung ${deptName(r.department_id)} vorbehalten${outsiders.includes(mid) ? '' : ` – ${outsiders.map(nameOf).join(', ')} ${outsiders.length > 1 ? 'sind' : 'ist'} nicht dabei`}.`);
    }
    const lines = [];
    const paying = club ? 0 : guests.filter(g => !g.partner).length;
    if (club) lines.push({ text: `${label.name} – Vereinstermin ohne Gebühr`, cents: 0 });
    else if (paying && feeOf(r)) lines.push({ text: `Gastgebühr ${paying} × ${euro(feeOf(r))}`, cents: paying * feeOf(r) });
    if (!club && guests.length > paying) lines.push({ text: guests.length - paying === 1 ? 'Gast aus Partnerverein – ohne Gebühr' : `Gäste aus Partnerverein (${guests.length - paying}) – ohne Gebühr`, cents: 0 });
    if (outsiders.length && r.outsider_fee_cents) lines.push({ text: `Platzgebühr ${outsiders.length} × ${euro(r.outsider_fee_cents)} (nicht in der Abteilung ${deptName(r.department_id)}: ${outsiders.map(p => nameOf(p).split(' ')[0]).join(', ')})`, cents: outsiders.length * r.outsider_fee_cents });
    const fee = lines.reduce((x, l) => x + l.cents, 0);
    const max = r.kind === 'artikel' ? c.max_open_artikel : c.max_open_platz;
    for (const p of club ? [] : [mid, ...(c.count_partners ? partners : [])]) {
      if (max && openCount(p, r.kind, exceptId) >= max) throw new Error(p === mid ? `Du hast schon die höchste Zahl offener Buchungen (${max}) – erst wenn eine vorbei ist, geht die nächste.` : `${nameOf(p)} hat schon die höchste Zahl offener Buchungen (${max}).`);
    }
    for (const p of [mid, ...partners]) if (personBusy(p, r.kind, date, s, e, exceptId)) throw new Error(p === mid ? 'Du hast zu dieser Zeit schon gebucht.' : `${nameOf(p)} hat zu dieser Zeit schon gebucht.`);
    return { r, date, s, e, partners, guests, fee, lines, label, club, title: label ? txt(b.title, 80) || null : null, device, solo };
  }

  /**
   * Buchung durch ein Mitglied (App oder Tablet) – alle Regeln.
   * b = { resource_id, date, start, minutes, partners: [ids], guests: [names], accept }
   */
  async function memberBook(mid, b, source, { by = null } = {}) {   // by = Mitglied, das für mid bucht (Sonderrecht „für andere buchen“)
    const editId = int(b.id) || 0;
    const old = editId ? db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(editId) : null;
    if (editId) {
      if (!old || old.member_id !== mid || old.type !== 'buchung' || (by && old.booked_by_id !== by)) throw new Error('Diese Buchung kannst du nicht ändern.');
      if (!canCancelNow(old)) throw new Error('Diese Buchung kann nicht mehr geändert werden.');
    }
    const { r, date, s, e, partners, guests, fee, lines, label, title, club, device, solo } = await check(mid, b, { exceptId: editId });
    let id = editId;
    db.transaction(() => {   // Prüfen und Eintragen in einem Schritt: zwei gleichzeitige Buchungen können sich nicht überholen
      if (!free(r, date, s, e, editId)) throw new Error('Gerade eben hat jemand anderes gebucht – bitte eine andere Zeit wählen.');
      // Kontingent und Doppelbelegung der Personen noch einmal hier (check() lief vor dem await, inzwischen kann eine zweite
      // Anfrage desselben Mitglieds – Doppeltipp in der App – auf einem anderen Platz eingetragen worden sein)
      const c = cfg(), max = r.kind === 'artikel' ? c.max_open_artikel : c.max_open_platz;
      for (const p of club ? [] : [mid, ...(c.count_partners ? partners : [])]) if (max && openCount(p, r.kind, editId) >= max) throw new Error(p === mid ? `Du hast schon die höchste Zahl offener Buchungen (${max}) – erst wenn eine vorbei ist, geht die nächste.` : `${nameOf(p)} hat schon die höchste Zahl offener Buchungen (${max}).`);
      for (const p of [mid, ...partners]) if (personBusy(p, r.kind, date, s, e, editId)) throw new Error(p === mid ? 'Du hast zu dieser Zeit schon gebucht.' : `${nameOf(p)} hat zu dieser Zeit schon gebucht.`);
      // Gerät als Mitspieler: eigene Buchung auf dem Gerät im selben Zeitfenster, verknüpft über partner_device_id
      const devOld = old ? deviceOf(old) : null;
      let devId = null;
      if (device) {
        if (!free(device, date, s, e, devOld ? devOld.booking.id : 0)) throw new Error(`${device.name} ist um ${hhmm(s)} belegt.`);
        if (devOld && devOld.booking.resource_id === device.id) { db.prepare('UPDATE bk_booking SET date = ?, start = ?, end = ? WHERE id = ?').run(date, hhmm(s), hhmm(e), devOld.booking.id); devId = devOld.booking.id; }
        else devId = Number(db.prepare("INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, fee_cents, source, created_by) VALUES (?,?,?,?,'buchung',?,0,?,?)").run(device.id, date, hhmm(s), hhmm(e), mid, source, nameOf(mid)).lastInsertRowid);
      }
      if (devOld && devOld.booking.id !== devId) db.prepare("UPDATE bk_booking SET status = 'storniert', cancelled_at = ?, cancelled_by = ?, cancel_reason = 'Buchung geändert' WHERE id = ?").run(nowTs(), nameOf(mid), devOld.booking.id);
      if (old) db.prepare('UPDATE bk_booking SET resource_id = ?, date = ?, start = ?, end = ?, partners = ?, guests = ?, fee_cents = ?, label_id = ?, title = ?, charge_id = NULL, partner_device_id = ?, solo = ? WHERE id = ?')
        .run(r.id, date, hhmm(s), hhmm(e), JSON.stringify(partners), JSON.stringify(guests), fee, label ? label.id : null, title, devId, solo ? 1 : 0, id);
      else id = Number(db.prepare('INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, partners, guests, fee_cents, source, created_by, label_id, title, partner_device_id, solo, booked_by_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(r.id, date, hhmm(s), hhmm(e), 'buchung', mid, JSON.stringify(partners), JSON.stringify(guests), fee, source, nameOf(by || mid), label ? label.id : null, title, devId, solo ? 1 : 0, by || null).lastInsertRowid);
    })();
    // alte Gebühr zurücknehmen, neue anlegen (Gast- und Platzgebühr: offener Posten beim buchenden Mitglied)
    if (old && old.charge_id) await ctx.callHooks('cancelCharge', old.charge_id, 'Buchung geändert', nameOf(mid));
    if (fee && mv()) {
      const cid = await hook('createCharge', { member_id: mid, text: `${r.name} ${deD(date)} ${hhmm(s)}: ${lines.filter(l => l.cents).map(l => l.text.replace(/ \(.*\)$/, '')).join(', ')}`, cents: fee, due_date: date, kind: 'sonstiges', ext_key: `bk-${id}${old ? '-' + Date.now() : ''}`, by: nameOf(mid) });
      if (cid) db.prepare('UPDATE bk_booking SET charge_id = ? WHERE id = ?').run(cid, id);
    }
    db.prepare('DELETE FROM bk_wait WHERE member_id = ? AND resource_id = ? AND date = ? AND start = ?').run(mid, r.id, date, hhmm(s));
    const now = db.prepare('SELECT * FROM bk_booking WHERE id = ?').get(id);
    if (old) {
      mailChange(old, now, { by: by || mid, toBooker: Boolean(by), budget: by || mid });
      if (old.start !== now.start || old.end !== now.end || old.date !== now.date || old.resource_id !== now.resource_id) await wakeWaitlist(old);
    } else {
      if (partners.length) mailPlayers(now, 'buchung', { budget: by || mid, by });
      if (by) mailBookedFor(now, by);
    }
    return { id, fee_cents: fee, lines };
  }
  /** Änderung: neue Mitspieler bekommen die normale Buchungs-Mail, entfernte eine Storno-Mail, gebliebene (und ggf. der Bucher) eine Änderungs-Mail */
  function mailChange(old, now, { by = null, toBooker = false, budget = null } = {}) {   // Mail-Einstellung prüft mailPlayers (Push kommt immer)
    const a = J(old.partners, []), b = J(now.partners, []);
    const added = b.filter(x => !a.includes(x)), removed = a.filter(x => !b.includes(x)), kept = b.filter(x => a.includes(x));
    if (added.length) mailPlayers({ ...now, partners: JSON.stringify(added) }, 'buchung', { budget });
    if (removed.length) mailPlayers({ ...old, partners: JSON.stringify(removed) }, 'storno', { by, budget });
    const moved = old.date !== now.date || old.start !== now.start || old.end !== now.end || old.resource_id !== now.resource_id;
    if (moved || old.guests !== now.guests || added.length || removed.length) mailPlayers({ ...now, partners: JSON.stringify(kept) }, 'aenderung', { by, toBooker, old, budget });
  }

  /** E-Mail an Mitglieder (Adresse aus der Mitgliederverwaltung) */
  async function notify(ids, subject, lines, pushEvent = null, card = null) {
    if (pushEvent && ctx.push) ctx.push.send(ids, pushEvent, { title: subject, body: String((lines || []).find(l => l && !/^Hallo/.test(l)) || ''), url: './#buchung', tag: `buchung-${pushEvent}` }).catch(() => {});
    if (!ctx.mail.ready() || !mv()) return 0;
    let n = 0;
    for (const id of ids) {
      const a = await hook('memberAddress', id).catch(() => null);
      if (!a || !a.email) continue;
      const hi = `Hallo ${String(a.name || '').split(' ')[0]},`, club = ctx.getSetting('club_name', 'Verein');
      // card = { title, rows, intro, outro }: gestaltete Infokarte in der HTML-Mail (Textfassung bleibt wie bisher)
      // Kalender: „Zum Kalender hinzufügen“ in der Infokarte (Link auf die .ics-Datei, von unterwegs erreichbar) – ohne öffentliche Adresse als Anhang
      const cal = card && card.calendar;
      const calHint = cal ? 'Der Termin hängt als Kalendereintrag an – antippen und „Hinzufügen“.' : '';
      const mc = card ? { heading: card.heading, before: [hi, '', card.intro || ''].join('\n'), title: card.title, rows: card.rows, after: [card.outro || '', ...(calHint ? ['', calHint] : []), '', 'Viele Grüße', club].join('\n'),
        calendar: cal && cal.url ? { url: cal.url } : null } : null;
      const calLine = calHint ? ['', calHint] : [];
      const attachments = cal && !cal.url ? [{ filename: `termin-${cal.date}.ics`, content: cal.ics, contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }] : undefined;
      try { await ctx.mail.send({ to: a.email, subject: `${subject} – ${club}`, text: [hi, '', ...lines, ...calLine, '', 'Viele Grüße', club].join('\n'), card: mc, attachments }); n++; } catch (e) { /* weiter */ }
    }
    return n;
  }

  /* ---------- Termine einer Serie: nur diesen · diesen und folgende · gesamte Serie ----------
     scope 'one' | 'following' | 'all' (all = alle kommenden, Vergangenes bleibt als Verlauf stehen) */
  const SCOPES = ['one', 'following', 'all'];
  function seriesTargets(b, scope) {
    if (!b.series_id || scope === 'one') return [b];
    return db.prepare("SELECT * FROM bk_booking WHERE series_id = ? AND status = 'aktiv' AND date >= ? ORDER BY date, start, id").all(b.series_id, scope === 'following' ? b.date : today());
  }
  async function scopeCancel(b, scope, by, reason = '') {
    const list = seriesTargets(b, scope);
    for (const x of list) await cancel(x, by, reason || (scope === 'one' ? 'Einzeltermin abgesagt' : 'Serie beendet'));
    const sx = b.series_id ? db.prepare('SELECT * FROM bk_series WHERE id = ?').get(b.series_id) : null;
    if (sx && scope !== 'one') {
      if (scope === 'all' || b.date <= sx.from_date) db.prepare('UPDATE bk_series SET active = 0, to_date = MAX(from_date, ?) WHERE id = ?').run(addDays(today(), -1), sx.id);
      else db.prepare('UPDATE bk_series SET to_date = ? WHERE id = ?').run(addDays(b.date, -1), sx.id);
    }
    return list.length;
  }
  /** Ändern im gewählten Umfang. f = { resource_id, start, end, title, note, label_id, member_id } (fehlende Felder bleiben).
      Belegte Tage: Serien lassen sie aus, Sperren stornieren die Buchungen dort (nur mit force). preview → nur zählen. */
  async function scopeEdit(b, scope, f, { by, force = false, preview = false, admin = false, noMax = false } = {}) {
    const list = seriesTargets(b, scope);
    const sx = b.series_id ? db.prepare('SELECT * FROM bk_series WHERE id = ?').get(b.series_id) : null;
    const multi = sx && J(sx.resources, []).length > 1;
    const changeRes = f.resource_id != null && int(f.resource_id) !== b.resource_id && !(multi && scope !== 'one');
    const nr = changeRes ? resource(f.resource_id) : null;
    if (changeRes && (!nr || nr.deleted)) throw new Error('Bitte einen Platz wählen.');
    const s = tm(f.start != null ? f.start : b.start), e = tm(f.end != null ? f.end : b.end);
    if (s == null || e == null || e <= s) throw new Error('Bitte die Uhrzeit prüfen.');
    const ids = new Set(list.map(x => x.id));
    const plan = [];
    for (const t of list) {
      const r = nr || resource(t.resource_id);
      const ge = gridError(r, t.date, s, e, { admin, noMax });
      if (ge) { if (scope === 'one') throw new Error(ge); plan.push({ t, r, skip: ge }); continue; }
      const clash = db.prepare("SELECT * FROM bk_booking WHERE resource_id = ? AND date = ? AND status = 'aktiv' AND start < ? AND end > ? AND id != ?").all(r.id, t.date, hhmm(e), hhmm(s), t.id).filter(c => !ids.has(c.id));
      plan.push({ t, r, clash });
    }
    const clashes = plan.filter(p => p.clash && p.clash.length);
    const out = { count: plan.filter(p => !p.skip).length, skipped: plan.filter(p => p.skip).map(p => ({ date: p.t.date, why: p.skip })), clash: clashes.map(p => ({ date: p.t.date, items: p.clash.map(c => bview(c, { full: true })) })) };
    if (preview) return out;
    if (clashes.length && !force) throw Object.assign(new Error(`${clashes.length} ${clashes.length === 1 ? 'Termin überschneidet' : 'Termine überschneiden'} sich mit anderen Buchungen.`), { status: 409, data: out });
    const title = f.title !== undefined ? (txt(f.title, 80) || null) : undefined;
    const label = f.label_id !== undefined ? (f.label_id ? labelRow(f.label_id) : null) : undefined;
    const mid = f.member_id !== undefined ? (f.member_id ? memberRow(f.member_id) : null) : undefined;
    let changed = 0; const skipped = out.skipped.map(x => x.date), cancelled = [];
    for (const p of plan) {
      if (p.skip) continue;
      if (p.clash.length) {
        if (p.t.type === 'sperre') { for (const c of p.clash.filter(c => c.type !== 'sperre')) { await cancel(c, by, `Platz gesperrt: ${p.t.title || ''}`); cancelled.push(c); } }
        else { skipped.push(p.t.date); continue; }
      }
      db.prepare(`UPDATE bk_booking SET resource_id = ?, start = ?, end = ?${title !== undefined ? ', title = @t' : ''}${f.note !== undefined ? ', note = @n' : ''}${label !== undefined ? ', label_id = @l' : ''}${mid !== undefined ? ', member_id = @m' : ''} WHERE id = @id`.replace('resource_id = ?, start = ?, end = ?', 'resource_id = @r, start = @s, end = @e'))
        .run({ r: p.r.id, s: hhmm(s), e: hhmm(e), t: title === undefined ? null : title, n: txt(f.note, 300) || null, l: label ? label.id : null, m: mid ? mid.id : null, id: p.t.id });
      changed++;
    }
    // Serie fortschreiben: „alle“ ändert die Serie selbst, „folgende“ teilt sie (bis gestern alt, ab diesem Termin neu)
    if (sx && scope !== 'one' && changed) {
      const upd = { start: hhmm(s), end: hhmm(e) };
      if (changeRes) upd.resources = JSON.stringify([nr.id]);
      if (title !== undefined && title) upd.title = title;
      if (f.note !== undefined) upd.note = txt(f.note, 300) || null;
      if (label !== undefined) upd.label_id = label ? label.id : null;
      if (mid !== undefined) upd.member_id = mid ? mid.id : null;
      if (scope === 'all' || b.date <= sx.from_date) {
        const k = Object.keys(upd); db.prepare(`UPDATE bk_series SET ${k.map(x => `${x} = ?`).join(', ')} WHERE id = ?`).run(...k.map(x => upd[x]), sx.id);
      } else {
        const nx = { ...sx, ...upd, from_date: b.date }; delete nx.id; delete nx.created_at;
        const k = Object.keys(nx);
        const nid = Number(db.prepare(`INSERT INTO bk_series(${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map(x => nx[x])).lastInsertRowid);
        db.prepare('UPDATE bk_series SET to_date = ? WHERE id = ?').run(addDays(b.date, -1), sx.id);
        db.prepare(`UPDATE bk_booking SET series_id = ? WHERE series_id = ? AND date >= ?`).run(nid, sx.id, b.date);
      }
    }
    for (const c of cancelled) if (c.member_id && c.type === 'buchung') notifyLockCancel(c, b.title || 'Platzsperre');
    return { changed, skipped: [...new Set(skipped)], cancelled: cancelled.length };
  }

  /** Stornieren (Mitglied, Tablet oder Verwaltung) + Gastgebühr zurücknehmen + Warteliste benachrichtigen */
  async function cancel(b, by, reason = '') {
    db.prepare("UPDATE bk_booking SET status = 'storniert', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ? AND status = 'aktiv'").run(nowTs(), by, txt(reason, 160) || null, b.id);
    if (b.charge_id) await ctx.callHooks('cancelCharge', b.charge_id, `Buchung storniert${reason ? ': ' + txt(reason, 80) : ''}`, by);
    // Gerät als Mitspieler (Ballmaschine) hängt an der Platzbuchung: mit stornieren; wird die Gerätebuchung selbst storniert, Verknüpfung lösen
    const dev = deviceOf(b);
    if (dev) { db.prepare("UPDATE bk_booking SET status = 'storniert', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ? AND status = 'aktiv'").run(nowTs(), by, txt(reason, 160) || 'Platzbuchung storniert', dev.booking.id); await wakeWaitlist(dev.booking); }
    db.prepare('UPDATE bk_booking SET partner_device_id = NULL WHERE partner_device_id = ?').run(b.id);
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
      notify([w.member_id], `Frei geworden: ${r.name} ${deD(w.date)}`, [`Du stehst auf der Warteliste – ${r.name} am ${WD[isoDow(w.date)]} ${deD(w.date)} um ${w.start} Uhr ist jetzt frei.`, '', 'Schnell sein lohnt sich: Gebucht ist erst, wenn du in der Mitglieder-App unter „Buchen“ zugreifst.'], 'warteliste', { intro: 'Du stehst auf der Warteliste – dieser Termin ist jetzt frei:', title: `${r.name} · ${WD[isoDow(w.date)]} ${deD(w.date)}`, rows: [['Platz', r.name], ['Wann', `${WD[isoDow(w.date)]}, ${deD(w.date)} · ${w.start}–${w.end} Uhr`]], outro: 'Schnell sein lohnt sich: Gebucht ist erst, wenn du in der Mitglieder-App buchst.' }).catch(() => {});
    }
  }

  /** Tagesplan für Anzeige (App, Tablet, Verwaltung) */
  function dayPlan(date, { me = null, full = false, kind = null } = {}) {
    const c = cfg();
    const rs = resources(full).filter(r => !kind || r.kind === kind);
    return { date, dow: isoDow(date), resources: rs.map(r => ({ id: r.id, kind: r.kind, name: r.name, area: r.area || (r.kind === 'artikel' ? 'Geräte' : 'Plätze'), note: r.note, open_from: r.open_from, open_to: r.open_to,
      slot_min: r.slot_min, max_min: r.max_min, quantity: r.quantity, department: r.department_id ? deptName(r.department_id) : null, outsiders: r.outsiders, outsider_fee_cents: r.outsider_fee_cents, open_today: String(r.days).includes(String(isoDow(date))), guest_fee_cents: feeOf(r), active: Boolean(r.active), days: r.days,
      partner_required: Boolean(r.partner_required), solo_label: r.solo_label || null, as_partner: Boolean(r.as_partner) })),
      devices: partnerDevices(),   // Geräte, die als Mitspieler wählbar sind (Ballmaschine …)
      bookings: dayBookings(date).filter(b => rs.some(r => r.id === b.resource_id)).map(b => bview(b, { me, names: c.show_names, full })),
      waits: me != null ? db.prepare('SELECT id, resource_id, start, end FROM bk_wait WHERE member_id = ? AND date = ?').all(me, date) : [] };
  }
  const myUpcoming = mid => {
    const d = today(), n = hhmm(nowMin());
    // verknüpfte Gerätebuchungen (Ballmaschine zur Platzbuchung) erscheinen nicht einzeln – die Platzbuchung zeigt „+ Ballmaschine“
    return db.prepare(`SELECT b.*, r.name AS rname, r.kind FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.status = 'aktiv' AND b.type = 'buchung' AND (b.date > ? OR (b.date = ? AND b.end > ?))
      AND b.id NOT IN (SELECT partner_device_id FROM bk_booking WHERE partner_device_id IS NOT NULL AND status = 'aktiv') ORDER BY b.date, b.start`).all(d, d, n)
      .filter(b => b.member_id === mid || J(b.partners, []).includes(mid) || (b.booked_by_id === mid && rightsOf(mid).forOthers)).map(b => { const dev = deviceOf(b), own = b.member_id === mid, forOther = !own && b.booked_by_id === mid && rightsOf(mid).forOthers;
        return { ...bview(b, { me: mid, full: false }), who: bview(b, { me: b.member_id, full: false }).who, resource: b.rname, kind: b.kind, fee_cents: own ? b.fee_cents : 0, own, for_name: forOther ? nameOf(b.member_id) : null, booked_by: own && b.booked_by_id ? nameOf(b.booked_by_id) : null,
        canCancel: (own || forOther) && canCancelNow(b), canEdit: (own || forOther) && canCancelNow(b), ics: icsUrl(b.id),
        ...(own || forOther ? { edit: { for_member: forOther ? b.member_id : null, resource_id: b.resource_id, partners: J(b.partners, []), guests: normGuests(J(b.guests, [])), label_id: b.label_id || null, title: b.label_id ? b.title || '' : '', partner_device: dev ? dev.booking.resource_id : null, solo: Boolean(b.solo) } } : {}) }; });
  };
  const canCancelNow = b => { const lim = cfg().cancel_before_min; const st = Date.parse(`${b.date}T${b.start}:00`); return Date.now() <= st - lim * 60000; };

  /* ---------- Platzgebühren (Gast- und Platzgebühr): offen, bezahlt, storniert ----------
     Mit Mitgliederverwaltung hängt an der Buchung eine Forderung (charge_id), deren Status einmal gesammelt abgefragt wird (Hook chargeStatus).
     Ohne Mitgliederverwaltung gibt es keine Zahlungsverfolgung – alle Gebühren gelten als „offen“ mit entsprechendem Hinweis. */
  const feeText = (b, r) => {
    const paying = normGuests(J(b.guests, [])).filter(g => !g.partner).length, parts = [];
    if (paying) parts.push(`Gastgebühr (${paying} ${paying === 1 ? 'Gast' : 'Gäste'})`);
    if (b.fee_cents - paying * feeOf(r) > 0) parts.push('Platzgebühr');
    return parts.join(', ') || 'Gebühr';
  };
  /** Gebührenposten eines Zeitraums → { rows, tracked } · rows: { id, member_id, member, date, start, end, resource, text, fee_cents, status, paid_at, charge_id } */
  async function feeRows({ from, to, memberId = null } = {}) {
    const w = ["b.status = 'aktiv'", "b.type = 'buchung'", 'b.fee_cents > 0'], a = [];
    if (from) { w.push('b.date >= ?'); a.push(from); }
    if (to) { w.push('b.date <= ?'); a.push(to); }
    if (memberId) { w.push('b.member_id = ?'); a.push(memberId); }
    const rows = db.prepare(`SELECT b.*, r.name AS rname FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE ${w.join(' AND ')} ORDER BY b.date DESC, b.start DESC LIMIT 5000`).all(...a);
    const tracked = mv();
    const st = tracked ? (await hook('chargeStatus', rows.map(b => b.charge_id).filter(Boolean)).catch(() => null)) || {} : {};
    return { tracked, rows: rows.map(b => {
      const c = b.charge_id ? st[b.charge_id] : null;
      // offen = Forderung weder bezahlt noch storniert (keine Forderung angelegt → ebenfalls offen); ohne Mitgliederverwaltung: unbekannt (zählt als offen)
      const status = !tracked ? 'unbekannt' : c && c.status === 'bezahlt' ? 'bezahlt' : c && c.status === 'storniert' ? 'storniert' : 'offen';
      return { id: b.id, member_id: b.member_id, member: b.member_id ? lastFirst(nameOf(b.member_id)) : 'Verein', date: b.date, start: b.start, end: b.end, resource: b.rname, text: feeText(b, resource(b.resource_id) || {}), fee_cents: b.fee_cents, status, paid_at: c ? c.paid_at || null : null, charge_id: b.charge_id || null };
    }) };
  }
  const isOpenFee = x => x.status === 'offen' || x.status === 'unbekannt';
  const sumOf = rows => rows.reduce((x, r) => x + r.fee_cents, 0);
  const NO_TRACK = 'Ohne Mitgliederverwaltung keine Zahlungsverfolgung – die Gebühren werden nur aufgelistet.';

  /* ---------- Kalender (.ics) – Link mit Prüfsumme, damit das Handy ihn ohne Anmeldung öffnen kann ---------- */
  const crypto = require('crypto');
  if (!S('ics_key')) SET('ics_key', crypto.randomBytes(24).toString('hex'));
  const icsToken = id => crypto.createHmac('sha256', S('ics_key')).update('bk' + id).digest('hex').slice(0, 32);
  const icsUrl = id => `api/p/buchung/ics/${id}?k=${icsToken(id)}`;
  const utc = (d, t) => new Date(`${d}T${t === '24:00' ? '23:59' : t}:00`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const icsEsc = v => String(v || '').replace(/\\/g, '\\\\').replace(/[;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
  /** Kalender für eine Buchung in Mails: die .ics-Datei als Anhang */
  function calendarFor(b) {
    if (!b || !b.id) return null;
    // immer als Anhang: iOS Mail & Co. öffnen dann direkt „Zum Kalender hinzufügen“ – ein Link öffnete Safari
    return { url: null, ics: icsText(b), date: b.date };
  }
  function icsText(b) {
    const r = resource(b.resource_id) || { name: 'Platz' };
    const players = [b.member_id ? nameOf(b.member_id) : null, ...J(b.partners, []).map(nameOf), ...normGuests(J(b.guests, [])).map(g => g.name)].filter(Boolean);
    const club = ctx.getSetting('club_name', 'Verein');
    const ci = mvSync('clubInfo') || {}, addr = [ci.street, ci.city].filter(Boolean).join(', ');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Clubwerk//Buchung//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:bk-${b.id}@clubwerk`, `DTSTAMP:${utc(today(), hhmm(nowMin()))}`, `DTSTART:${utc(b.date, b.start)}`, `DTEND:${utc(b.date, b.end)}`,
      `SUMMARY:${icsEsc(`${r.name} – ${club}`)}`, `LOCATION:${icsEsc(addr ? `${club}, ${addr}` : club)}`, `DESCRIPTION:${icsEsc(`Spieler: ${players.join(', ')}`)}`,
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(r.name)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
    return ics;
  }
  ctx.public.get('/ics/:id', (req, res) => {
    const id = int(req.params.id), k = String(req.query.k || '');
    const ok = k.length === 32 && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(icsToken(id)));
    const b = ok ? db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(id) : null;
    if (!b) return res.status(404).type('text/plain; charset=utf-8').send('Diese Buchung gibt es nicht (mehr).');
    const ics = icsText(b);
    res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="buchung-${b.date}.ics"`, 'Cache-Control': 'no-store' }).send(ics);
  });

  /* ================================================================= Mitglieder-App (/api/m/buchung/…) */
  /** Für wen wird gebucht? Ohne Angabe für sich selbst; sonst nur mit Sonderrecht „für andere buchen“ (und beim Ändern nur eigene Fremdbuchungen) */
  function actingFor(me, b) {
    const old = int(b.id) ? db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int(b.id)) : null;
    let target = me;
    if (old && old.member_id !== me && old.booked_by_id === me) target = old.member_id;
    else if (!old && int(b.for_member) && int(b.for_member) !== me) target = int(b.for_member);
    if (target === me) return { target, by: null };
    if (!rightsOf(me).forOthers) return { error: 'Für andere buchen darfst du nicht – bitte bei der Verwaltung melden.' };
    const m = memberRow(target); if (!m) return { error: 'Dieses Mitglied gibt es nicht.' };
    return { target, by: me };
  }
  M.post('/quote', rateLimit('bkq', 120, 60000), ar(async (req, res) => {   // Preisvorschau vor dem Buchen
    const b = req.body || {}, a = actingFor(req.member.id, b); if (a.error) return bad(res, a.error, 403);
    const own = int(b.id) ? db.prepare("SELECT id FROM bk_booking WHERE id = ? AND member_id = ? AND status = 'aktiv'").get(int(b.id), a.target) : null;
    try { const q = await check(a.target, b, { dry: true, exceptId: own ? own.id : 0 }); res.json({ ok: true, fee_cents: q.fee, lines: q.lines }); } catch (e) { bad(res, e.message); }
  }));
  M.get('/me', ar(async (req, res) => {
    const mid = req.member.id, c = cfg();
    const date = isDate(req.query.date) ? req.query.date : today();
    const max = addDays(today(), c.advance_days);
    res.json({ today: today(), now: hhmm(nowMin()), max, settings: { show_now: c.show_now, advance_days: c.advance_days, max_partners: c.max_partners, max_guests: c.max_guests, rules: c.rules, waitlist: c.waitlist,
      max_open_platz: c.max_open_platz, max_open_artikel: c.max_open_artikel, cancel_before_min: c.cancel_before_min },
      plan: date >= today() && date <= max ? dayPlan(date, { me: mid }) : { date, resources: [], bookings: [], waits: [] },
      mine: myUpcoming(mid), waits: db.prepare(`SELECT w.id, w.date, w.start, w.end, w.notified_at, r.name AS resource FROM bk_wait w JOIN bk_resource r ON r.id = w.resource_id WHERE w.member_id = ? AND w.date >= ? ORDER BY w.date, w.start`).all(mid, today()),
      people: (await eligiblePeople(mid)).map(p => ({ ...p, ln: lastFirst(p.name) })), blocked: await notAllowed(mid),
      labels: labels().filter(l => labelForMember(l, mid)).map(l => ({ id: l.id, name: l.name, color: l.color, free_rules: Boolean(l.free_rules) })),
      rights: { series: rightsOf(mid).series, forOthers: rightsOf(mid).forOthers },
      series: rightsOf(mid).series ? db.prepare("SELECT * FROM bk_series WHERE member_id = ? AND active = 1 AND to_date >= ? AND type = 'serie' ORDER BY from_date").all(mid, today()).map(x => ({ id: x.id, title: x.title, weekdays: x.weekdays, start: x.start, end: x.end, from_date: x.from_date, to_date: x.to_date, rule_text: ruleText(x),
        resources: J(x.resources, []).map(id => (resource(id) || {}).name).filter(Boolean), count: db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE series_id = ? AND status = 'aktiv' AND date >= ?").get(x.id, today()).n })) : [] });
  }));
  // je Mitglied (nicht nur je Adresse – draußen teilen sich viele Handys eine Adresse, drinnen könnte eine wechseln): 10 Aktionen je Minute
  const perMember = rateLimitKey('bkmem', 10, 60000, req => 'm' + req.member.id);
  M.post('/book', rateLimit('bkapp', 60, 60000), perMember, ar(async (req, res) => {
    const a = actingFor(req.member.id, req.body || {}); if (a.error) return bad(res, a.error, 403);
    try { const r = await memberBook(a.target, req.body || {}, 'app', { by: a.by }); res.json({ ok: true, ...r, ics: icsUrl(r.id), for_name: a.by ? nameOf(a.target) : null }); } catch (e) { bad(res, e.message); }
  }));
  M.post('/cancel', rateLimit('bkapp', 60, 60000), perMember, ar(async (req, res) => {
    const b = db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int((req.body || {}).id));
    const me = req.member.id, forOther = b && b.member_id !== me && b.booked_by_id === me && rightsOf(me).forOthers;
    if (!b || (b.member_id !== me && !forOther) || b.type !== 'buchung') return bad(res, 'Diese Buchung kannst du nicht stornieren.');
    if (!canCancelNow(b)) return bad(res, cfg().cancel_before_min ? `Stornieren geht nur bis ${cfg().cancel_before_min} Minuten vor Beginn.` : 'Die Buchung hat schon begonnen.');
    await cancel(b, req.member.name);
    mailPlayers(b, 'storno', { by: me, budget: me, toBooker: forOther });
    res.json({ ok: true });
  }));
  /* Serien in der App – nur mit Sonderrecht (Verwaltung → Buchungssystem → Einstellungen → Sonderrechte) */
  M.post('/series', rateLimit('bkser', 20, 60000), ar(async (req, res) => {
    const mid = req.member.id, b = req.body || {};
    if (!rightsOf(mid).series) return bad(res, 'Serien anlegen darfst du nicht – bitte bei der Verwaltung melden.', 403);
    const why = await notAllowed(mid); if (why) return bad(res, why);
    const r = resource(b.resource_id); if (!r || !r.active) return bad(res, 'Diesen Platz gibt es nicht (mehr).');
    const label = b.label_id ? labelRow(b.label_id) : null;
    if (b.label_id && !labelForMember(label, mid)) return bad(res, 'Diese Buchungsart darfst du nicht verwenden.');
    const s = tm(b.start), e = s == null ? null : s + int(b.minutes);
    if (!isDate(b.date) || b.date < today()) return bad(res, 'Bitte einen Tag ab heute wählen.');
    const ge = gridError(r, b.date, s, e, { noMax: Boolean(label && label.free_rules) }); if (ge) return bad(res, ge);
    if (!isDate(b.until) || b.until < b.date) return bad(res, 'Bitte angeben, bis wann die Serie läuft.');
    if (addDays(b.date, 366) < b.until) return bad(res, 'Höchstens ein Jahr am Stück.');
    const title = (label && txt(b.title, 80)) || (label ? label.name : `${nameOf(mid)} (Serie)`);
    const ri = ruleInput({ ...b, weekdays: b.freq === 'weekly' || !b.freq ? (b.weekdays || String(isoDow(b.date))) : '' }, b.date);
    const sx = { type: 'serie', title, resources: JSON.stringify([r.id]), weekdays: ri.weekdays, start: hhmm(s), end: hhmm(e), from_date: b.date, to_date: b.until, member_id: mid, note: null, label_id: label ? label.id : null, rule: JSON.stringify(ri.rule) };
    const days = seriesDays(sx);
    if (!days.length) return bad(res, 'In diesem Zeitraum liegt kein Termin – bitte Zeitraum oder Wiederholung prüfen.');
    const busy = d => db.prepare("SELECT 1 FROM bk_booking WHERE resource_id = ? AND date = ? AND status = 'aktiv' AND start < ? AND end > ?").get(r.id, d, hhmm(e), hhmm(s));
    if (b.preview) return res.json({ days: days.length, rule: ruleText(sx), busy: days.filter(busy).map(deD) });
    let id, made = 0; const skipped = [];
    db.transaction(() => {
      const k = Object.keys(sx);
      id = Number(db.prepare(`INSERT INTO bk_series(${k.join(',')}, created_by) VALUES (${k.map(() => '?').join(',')}, ?)`).run(...k.map(x => sx[x]), nameOf(mid)).lastInsertRowid);
      const ins = db.prepare("INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, title, series_id, source, created_by, label_id) VALUES (?,?,?,?,'serie',?,?,?,'app',?,?)");
      for (const d of days) { if (busy(d)) { skipped.push(deD(d)); continue; } ins.run(r.id, d, hhmm(s), hhmm(e), mid, title, id, nameOf(mid), sx.label_id); made++; }
    })();
    ctx.audit({ username: 'app', name: nameOf(mid) }, 'Serie angelegt (App)', `${nameOf(mid)}: ${title}, ${r.name} ${WD[isoDow(b.date)]} ${hhmm(s)}–${hhmm(e)}, ${made} Termine${skipped.length ? `, ${skipped.length} belegt ausgelassen` : ''}`);
    res.json({ ok: true, id, made, skipped });
  }));
  M.post('/series/:id/end', ar(async (req, res) => {
    const sx = db.prepare("SELECT * FROM bk_series WHERE id = ? AND member_id = ? AND active = 1").get(int(req.params.id), req.member.id);
    if (!sx) return bad(res, 'Diese Serie kannst du nicht beenden.');
    const fut = db.prepare("SELECT * FROM bk_booking WHERE series_id = ? AND status = 'aktiv' AND date >= ?").all(sx.id, today());
    for (const b0 of fut) await cancel(b0, nameOf(req.member.id), 'Serie beendet');
    db.prepare('UPDATE bk_series SET active = 0, to_date = MAX(from_date, ?) WHERE id = ?').run(addDays(today(), -1), sx.id);
    ctx.audit({ username: 'app', name: nameOf(req.member.id) }, 'Serie beendet (App)', `${sx.title}: ${fut.length} Termine entfernt`);
    res.json({ ok: true, removed: fut.length });
  }));
  /** eigene Serie in der App: nur diesen · diesen und folgende · gesamte Serie – absagen oder Uhrzeit/Platz ändern */
  M.post('/series-booking/:id', rateLimit('bkapp', 60, 60000), perMember, ar(async (req, res) => {
    const mid = req.member.id, x = req.body || {}, scope = SCOPES.includes(x.scope) ? x.scope : 'one';
    const b0 = db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int(req.params.id));
    if (!b0 || b0.member_id !== mid || !b0.series_id || b0.type !== 'serie') return bad(res, 'Diesen Serientermin kannst du nicht ändern.');
    if (!canCancelNow(b0)) return bad(res, cfg().cancel_before_min ? `Ändern geht nur bis ${cfg().cancel_before_min} Minuten vor Beginn.` : 'Der Termin hat schon begonnen.');
    try {
      if (x.action === 'cancel') {
        const n = await scopeCancel(b0, scope, nameOf(mid));
        ctx.audit({ username: 'app', name: nameOf(mid) }, 'Serie: Termine abgesagt (App)', `${b0.title} · ${({ one: 'nur dieser', following: 'dieser und folgende', all: 'alle kommenden' })[scope]} · ${n} ${n === 1 ? 'Termin' : 'Termine'}`);
        return res.json({ ok: true, cancelled: n });
      }
      const f = x.fields || {}, lab = b0.label_id ? labelRow(b0.label_id) : null;
      const start = f.start, end = f.start && f.minutes ? hhmm(tm(f.start) + int(f.minutes)) : f.end;
      const r = await scopeEdit(b0, scope, { start, end, resource_id: f.resource_id }, { by: nameOf(mid), preview: Boolean(x.preview), force: Boolean(x.force), noMax: Boolean(lab && lab.free_rules) });
      if (!x.preview) ctx.audit({ username: 'app', name: nameOf(mid) }, 'Serie: Termine geändert (App)', `${b0.title} · ${({ one: 'nur dieser', following: 'dieser und folgende', all: 'alle kommenden' })[scope]} · ${r.changed} geändert${r.skipped.length ? `, ${r.skipped.length} ausgelassen` : ''}`);
      res.json({ ok: true, ...r });
    } catch (e) { res.status(e.status || 400).json({ error: e.message, ...(e.data || {}) }); }
  }));
  M.post('/wait', rateLimit('bkapp', 60, 60000), perMember, (req, res) => {
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
  T.get('/state', ar(async (req, res) => {
    const c = cfg();
    const ok = new Set((await eligiblePeople(0)).map(p => p.id));
    // Tag wählbar wie in der Mitglieder-App: heute bis Vorlauf (advance_days)
    const max = addDays(today(), c.advance_days), q = String(req.query.date || '');
    const date = isDate(q) && q >= today() && q <= max ? q : today();
    res.json({ today: today(), date, max, now: hhmm(nowMin()), booking: c.tablet_booking, rules: c.rules, max_partners: c.max_partners, max_guests: c.max_guests, plan: dayPlan(date, { me: null }),
      people: c.tablet_booking ? db.prepare("SELECT id, name, pin_hash IS NOT NULL AS pin FROM members WHERE kind = 'mitglied' AND active = 1 AND deleted = 0 AND pending = 0 ORDER BY name_key(name, kind)").all().filter(p => ok.has(p.id)).map(p => ({ ...p, ln: lastFirst(p.name), ph: photos.version(p.id, 'buchung') })) : [] });
  }));
  // Buchen und Stornieren am Tablet nur mit PIN (zentrale PIN des Mitglieds, wie im Verkauf)
  const tabletMember = (req, res) => {
    const mid = ctx.auth.checkTabletToken((req.body || {}).token);
    if (!mid || typeof mid !== 'number') { bad(res, 'Sitzung abgelaufen – bitte Namen neu wählen.', 401); return null; }
    const m = db.prepare('SELECT pin_hash FROM members WHERE id = ?').get(mid);
    if (!m || !m.pin_hash) { res.status(403).json({ error: 'Kein PIN vergeben – zum Buchen und Stornieren am Tablet bitte zuerst eine PIN festlegen.', needPin: true }); return null; }
    return mid;
  };
  T.post('/quote', rateLimit('bktab', 120, 60000), ar(async (req, res) => {
    const mid = ctx.auth.checkTabletToken((req.body || {}).token);
    if (!mid || typeof mid !== 'number') return bad(res, 'Sitzung abgelaufen – bitte Namen neu wählen.', 401);
    const d = isDate(String((req.body || {}).date || '')) ? req.body.date : today();
    try { const q = await check(mid, { ...(req.body || {}), date: d }, { dry: true }); res.json({ ok: true, fee_cents: q.fee, lines: q.lines }); } catch (e) { bad(res, e.message); }
  }));
  T.post('/book', rateLimit('bktab', 60, 60000), ar(async (req, res) => {
    if (!cfg().tablet_booking) return bad(res, 'Buchen am Tablet ist ausgeschaltet.');
    const mid = tabletMember(req, res); if (!mid) return;
    const b = req.body || {};
    const d = isDate(String(b.date || '')) ? b.date : today();   // Vorlauf und Regeln prüft memberBook wie in der App
    try { const r = await memberBook(mid, { ...b, id: 0, date: d }, 'tablet'); ctx.auth.dropTabletToken(b.token); res.json({ ok: true, ...r }); } catch (e) { bad(res, e.message); }
  }));
  T.post('/cancel', rateLimit('bktab', 60, 60000), ar(async (req, res) => {
    const mid = tabletMember(req, res); if (!mid) return;
    const b = db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int((req.body || {}).id));
    if (!b || b.member_id !== mid || b.type !== 'buchung') return bad(res, 'Diese Buchung kannst du nicht stornieren.');
    if (!canCancelNow(b)) return bad(res, 'Stornieren geht jetzt nicht mehr.');
    await cancel(b, nameOf(mid)); ctx.auth.dropTabletToken(req.body.token);
    mailPlayers(b, 'storno', { by: mid, budget: mid });
    res.json({ ok: true });
  }));

  T.post('/series-cancel', rateLimit('bktab', 60, 60000), ar(async (req, res) => {   // eigener Serientermin am Tablet: nur heute / ab heute / ganze Serie
    const mid = tabletMember(req, res); if (!mid) return;
    const x = req.body || {}, scope = SCOPES.includes(x.scope) ? x.scope : 'one';
    const b0 = db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int(x.id));
    if (!b0 || b0.member_id !== mid || !b0.series_id || b0.type !== 'serie') return bad(res, 'Diesen Serientermin kannst du nicht absagen.');
    if (!canCancelNow(b0)) return bad(res, 'Absagen geht jetzt nicht mehr.');
    const n = await scopeCancel(b0, scope, nameOf(mid)); ctx.auth.dropTabletToken(x.token);
    ctx.audit({ username: 'tablet', name: nameOf(mid) }, 'Serie: Termine abgesagt (Tablet)', `${b0.title} · ${({ one: 'nur dieser', following: 'dieser und folgende', all: 'alle kommenden' })[scope]} · ${n} ${n === 1 ? 'Termin' : 'Termine'}`);
    res.json({ ok: true, cancelled: n });
  }));

  /* ================================================================= Verwaltung */
  admin.get('/meta', P, (req, res) => res.json({ today: today(), settings: cfg(), labels: labels(true).map(l => ({ ...l, use_functions: J(l.use_functions, []), use_members: J(l.use_members, []), free_rules: Boolean(l.free_rules), usable: labelForUser(req, l) })), functions: functionNames(), can: Object.fromEntries(ALL.map(p => [p, may(req, p)])), resources: resources(true), people: people(), departments: departments(), fees: feeList(), mv: mv(),
    counts: { today: db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE date = ? AND status = 'aktiv' AND type = 'buchung'").get(today()).n } }));
  admin.get('/day', P, (req, res) => res.json(dayPlan(isDate(req.query.date) ? req.query.date : today(), { full: true })));
  admin.get('/week', P, (req, res) => {   // Wochenansicht eines Platzes (7 Tage nebeneinander)
    const from = isDate(req.query.from) ? req.query.from : today();
    const r = resource(req.query.resource) || resources()[0];
    if (!r) return res.json({ days: [], bookings: [], resource: null });
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    res.json({ resource: { ...r, guest_fee_cents: feeOf(r) }, days: days.map(d => ({ date: d, open: String(r.days).includes(String(isoDow(d))) })),
      bookings: db.prepare("SELECT * FROM bk_booking WHERE resource_id = ? AND date BETWEEN ? AND ? AND status = 'aktiv' ORDER BY date, start").all(r.id, days[0], days[6]).map(b => bview(b, { full: true })) });
  });
  admin.get('/bookings', P, (req, res) => {   // Liste (Suche, Auswertung)
    const from = isDate(req.query.from) ? req.query.from : today(), to = isDate(req.query.to) ? req.query.to : addDays(from, 30);
    res.json(db.prepare(`SELECT b.*, r.name AS resource FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.date BETWEEN ? AND ? ${req.query.all ? '' : "AND b.status = 'aktiv'"} ORDER BY b.date, b.start LIMIT 2000`).all(from, to)
      .map(b => ({ ...bview(b, { full: true }), resource: b.resource })));
  });
  /* Gebühren (Reiter „Gebühren“): ?from&to&status=alle|offen|bezahlt */
  admin.get('/fees', P, ar(async (req, res) => {
    const y = today().slice(0, 4);
    const from = isDate(req.query.from) ? req.query.from : `${y}-01-01`, to = isDate(req.query.to) ? req.query.to : `${y}-12-31`;
    const { rows, tracked } = await feeRows({ from, to });
    const f = String(req.query.status || 'alle');
    const open = rows.filter(isOpenFee), paid = rows.filter(x => x.status === 'bezahlt');
    res.json({ from, to, tracked, note: tracked ? null : NO_TRACK, rows: f === 'offen' ? open : f === 'bezahlt' ? paid : rows,
      totals: { all: { count: rows.length, cents: sumOf(rows) }, open: { count: open.length, cents: sumOf(open) }, paid: { count: paid.length, cents: sumOf(paid) } },
      years: [...new Set([Number(y), ...db.prepare('SELECT DISTINCT substr(date,1,4) y FROM bk_booking WHERE fee_cents > 0').all().map(r => +r.y)])].sort((a, b) => b - a) });
  }));
  /* Buchen in der Verwaltung: für ein Mitglied (ohne Kontingent/Vorlauf) oder als Sperre / Vereinsbuchung */
  async function adminSave(req, res, editId = 0) {
    const b = req.body || {};
    const old = editId ? db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(editId) : null;
    if (editId && !old) return bad(res, 'Diese Buchung gibt es nicht (mehr).', 404);
    const type = old ? old.type : (b.type === 'sperre' ? 'sperre' : 'buchung');
    if (type === 'serie') return bad(res, 'Termine einer Serie werden über „Serien & Sperren“ geändert.');
    if (type === 'sperre' ? !may(req, 'buchung_serien') : !may(req, 'buchung_buchen')) return bad(res, type === 'sperre' ? 'Sperren anlegen und ändern darf nur, wer das Recht „Serien & Sperren“ hat.' : 'Für andere buchen und Buchungen ändern darf nur, wer das Recht „für Mitglieder buchen“ hat.', 403);
    const r = resource(b.resource_id); if (!r) return bad(res, 'Bitte einen Platz wählen.');
    const s = tm(b.start), e = tm(b.end);
    const ge = gridError(r, String(b.date || ''), s, e, { admin: true }); if (ge) return bad(res, ge);
    const mid = b.member_id ? memberRow(b.member_id) : null;
    if (b.member_id && !mid) return bad(res, 'Mitglied nicht gefunden.');
    const label = b.label_id ? labelRow(b.label_id) : null;
    if (b.label_id && !label) return bad(res, 'Diese Buchungsart gibt es nicht.');
    if (label && !(old && old.label_id === label.id) && !labelForUser(req, label)) return bad(res, `Die Buchungsart „${label.name}“ dürfen nur bestimmte Personen verwenden.`, 403);
    const title = txt(b.title, 80) || (label ? label.name : '');
    if (type === 'sperre' && title.length < 2) return bad(res, 'Bitte einen Grund für die Sperre eintragen (z. B. „Platzpflege“).');
    if (type === 'buchung' && !mid && title.length < 2) return bad(res, 'Bitte ein Mitglied wählen, eine Buchungsart wählen oder einen Titel eintragen (z. B. „Training Jugend“).');
    const partners = [...new Set((Array.isArray(b.partners) ? b.partners : []).map(Number))].filter(x => x !== (mid && mid.id) && memberRow(x));
    const guests = normGuests(b.guests).filter(g => g.name.length >= 3).slice(0, 10);
    const conflicts = db.prepare("SELECT * FROM bk_booking WHERE resource_id = ? AND date = ? AND status = 'aktiv' AND start < ? AND end > ? AND id != ?").all(r.id, b.date, hhmm(e), hhmm(s), editId);
    let id = editId;
    try {
      db.transaction(() => {
        if (type === 'buchung' && !free(r, b.date, s, e, editId)) throw new Error('Zu dieser Zeit ist schon gebucht.');
        if (type === 'sperre' && conflicts.length && !b.force) throw Object.assign(new Error(`${conflicts.length} ${conflicts.length === 1 ? 'Buchung' : 'Buchungen'} liegen in dieser Zeit.`), { conflicts });
        // hängt ein Gerät als Mitspieler an der Buchung (Ballmaschine), wandert es mit – wenn es zur neuen Zeit frei ist
        const dev = old ? deviceOf(old) : null;
        if (dev) { const dr = resource(dev.booking.resource_id); if (dr && !free(dr, b.date, s, e, dev.booking.id)) throw new Error(`${dr.name} ist um ${hhmm(s)} belegt.`); db.prepare('UPDATE bk_booking SET date = ?, start = ?, end = ? WHERE id = ?').run(b.date, hhmm(s), hhmm(e), dev.booking.id); }
        if (old) db.prepare('UPDATE bk_booking SET resource_id = ?, date = ?, start = ?, end = ?, member_id = ?, partners = ?, guests = ?, title = ?, note = ?, label_id = ? WHERE id = ?')
          .run(r.id, b.date, hhmm(s), hhmm(e), mid ? mid.id : null, JSON.stringify(partners), JSON.stringify(guests), title || null, txt(b.note, 300) || null, label ? label.id : null, id);
        else id = Number(db.prepare('INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, partners, guests, fee_cents, title, note, source, created_by, label_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(r.id, b.date, hhmm(s), hhmm(e), type, mid ? mid.id : null, JSON.stringify(partners), JSON.stringify(guests), 0, title || null, txt(b.note, 300) || null, 'verwaltung', uname(req), label ? label.id : null).lastInsertRowid);
      })();
    } catch (x) { return res.status(x.conflicts ? 409 : 400).json({ error: x.message, conflicts: (x.conflicts || []).map(c => bview(c, { full: true })) }); }
    if (type === 'sperre' && b.force) for (const c of conflicts.filter(x => x.type !== 'sperre')) {
      await cancel(c, uname(req), `Platz gesperrt: ${title}`);
      if (c.member_id) notifyLockCancel(c, title);
    }
    // Gastgebühr: bei Änderung neu berechnen (alte zurücknehmen, neue anlegen)
    const paying = label && label.free_rules ? 0 : guests.filter(g => !g.partner).length;
    const fee = paying && mid && b.fee !== false && mv() ? paying * feeOf(r) : 0;
    if (old && (old.charge_id || old.fee_cents) && (fee !== old.fee_cents || !mid || old.member_id !== mid.id)) {
      if (old.charge_id) await ctx.callHooks('cancelCharge', old.charge_id, 'Buchung geändert', uname(req));
      db.prepare('UPDATE bk_booking SET fee_cents = 0, charge_id = NULL WHERE id = ?').run(id);
    }
    const cur = db.prepare('SELECT fee_cents FROM bk_booking WHERE id = ?').get(id);
    if (fee && !cur.fee_cents) {
      const cid = await hook('createCharge', { member_id: mid.id, text: `Gastgebühr ${r.name} ${deD(b.date)} ${hhmm(s)} (Gäste: ${paying})`, cents: fee, due_date: b.date, kind: 'sonstiges', ext_key: `bk-${id}${old ? '-' + Date.now() : ''}`, by: uname(req) });
      db.prepare('UPDATE bk_booking SET fee_cents = ?, charge_id = ? WHERE id = ?').run(fee, cid || null, id);
    }
    if (old) {
      const now = db.prepare('SELECT * FROM bk_booking WHERE id = ?').get(id);
      if (type === 'buchung' && b.notify !== false) mailChange(old, now, { toBooker: Boolean(now.member_id) });
      if (old.start !== now.start || old.end !== now.end || old.date !== now.date || old.resource_id !== now.resource_id) await wakeWaitlist(old);
    }
    ctx.audit(req.user, old ? (type === 'sperre' ? 'Sperre geändert' : 'Buchung geändert (Verwaltung)') : (type === 'sperre' ? 'Platz gesperrt' : 'Platz gebucht (Verwaltung)'), `${r.name} ${deD(b.date)} ${hhmm(s)}–${hhmm(e)} ${title || (mid ? mid.name : '')}`);
    res.json({ id });
  }
  /* Buchen in der Verwaltung: für ein Mitglied (ohne Kontingent/Vorlauf) oder als Sperre / Vereinsbuchung */
  admin.post('/bookings', P, ar(async (req, res) => adminSave(req, res)));
  admin.put('/bookings/:id', P, ar(async (req, res) => adminSave(req, res, int(req.params.id))));
  /** Termin einer Serie/Sperre: nur diesen · diesen und folgende · gesamte Serie – stornieren oder ändern */
  admin.post('/bookings/:id/scope', P, ar(async (req, res) => {
    const b0 = db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int(req.params.id));
    if (!b0) return bad(res, 'Diese Buchung gibt es nicht (mehr).', 404);
    const x = req.body || {}, scope = SCOPES.includes(x.scope) ? x.scope : 'one';
    if ((b0.series_id || b0.type !== 'buchung') && !may(req, 'buchung_serien')) return bad(res, 'Serien und Sperren ändern darf nur, wer das Recht „Serien & Sperren“ hat.', 403);
    if (b0.type === 'buchung' && !b0.series_id && !may(req, 'buchung_stornieren') && x.action === 'cancel') return bad(res, 'Dafür fehlt das Recht „Buchungen stornieren“.', 403);
    // Ändern einer Einzelbuchung braucht dasselbe Recht wie PUT /bookings/:id (sonst reicht „Belegung ansehen“ zum Verlegen)
    if (x.action !== 'cancel' && b0.type === 'buchung' && !b0.series_id && !may(req, 'buchung_buchen')) return bad(res, 'Für andere buchen und Buchungen ändern darf nur, wer das Recht „für Mitglieder buchen“ hat.', 403);
    if (x.action !== 'cancel' && x.fields && x.fields.label_id != null && int(x.fields.label_id) !== b0.label_id) {
      const label = labelRow(int(x.fields.label_id));
      if (label && !labelForUser(req, label)) return bad(res, `Die Buchungsart „${label.name}“ dürfen nur bestimmte Personen verwenden.`, 403);
    }
    try {
      if (x.action === 'cancel') {
        const n = await scopeCancel(b0, scope, uname(req), txt(x.reason, 160));
        ctx.audit(req.user, 'Serie: Termine storniert (Verwaltung)', `${b0.title || '#' + b0.id} · ${({ one: 'nur dieser', following: 'dieser und folgende', all: 'alle kommenden' })[scope]} · ${n} ${n === 1 ? 'Termin' : 'Termine'}`);
        return res.json({ ok: true, cancelled: n });
      }
      const f = x.fields || {};
      const r = await scopeEdit(b0, scope, f, { by: uname(req), force: Boolean(x.force), preview: Boolean(x.preview), admin: true });
      if (!x.preview) ctx.audit(req.user, 'Serie: Termine geändert (Verwaltung)', `${b0.title || '#' + b0.id} · ${({ one: 'nur dieser', following: 'dieser und folgende', all: 'alle kommenden' })[scope]} · ${r.changed} geändert${r.skipped.length ? `, ${r.skipped.length} ausgelassen` : ''}${r.cancelled ? `, ${r.cancelled} storniert` : ''}`);
      res.json({ ok: true, ...r });
    } catch (e) { res.status(e.status || 400).json({ error: e.message, ...(e.data || {}) }); }
  }));
  admin.post('/bookings/:id/cancel', P, ar(async (req, res) => {
    const b = db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int(req.params.id));
    if (!b) return bad(res, 'Nicht gefunden.', 404);
    if (b.type === 'sperre' ? !(may(req, 'buchung_serien') || may(req, 'buchung_stornieren')) : !may(req, 'buchung_stornieren')) return bad(res, 'Buchungen stornieren darf nur, wer das Recht „Buchungen anderer stornieren“ hat.', 403);
    const reason = txt((req.body || {}).reason, 160);
    await cancel(b, uname(req), reason);
    if (b.type === 'buchung' && (req.body || {}).notify !== false) mailPlayers(b, 'storno', { reason, toBooker: true });
    ctx.audit(req.user, 'Buchung storniert (Verwaltung)', `#${b.id} ${b.date} ${b.start}${reason ? ' – ' + reason : ''}`);
    res.json({ ok: true });
  }));

  /* ---------- Buchungsprotokoll: alle Buchungen eines Jahres (auch stornierte), filterbar, als CSV ---------- */
  const logRows = q => {
    const y = Math.max(2000, Math.min(2100, int(q.year) || Number(today().slice(0, 4))));
    const w = ['b.date BETWEEN ? AND ?'], a = [`${y}-01-01`, `${y}-12-31`];
    if (int(q.resource)) { w.push('b.resource_id = ?'); a.push(int(q.resource)); }
    const f = String(q.f || 'alle');
    if (f === 'storniert') w.push("b.status = 'storniert'"); else if (q.cancelled !== '1' && f !== 'alle') w.push("b.status = 'aktiv'");
    if (f === 'mitglieder') w.push("b.type = 'buchung' AND b.member_id IS NOT NULL AND b.label_id IS NULL");
    if (f === 'gast') w.push("b.guests NOT IN ('[]', '')");
    if (f === 'label') w.push('b.label_id IS NOT NULL');
    if (f === 'sperre') w.push("b.type = 'sperre'");
    const order = q.sort === 'eingetragen' ? 'b.created_at DESC, b.id DESC' : 'b.date DESC, b.start DESC, b.id DESC';
    const now = `${today()} ${hhmm(nowMin())}`;
    let rows = db.prepare(`SELECT b.*, r.name AS rname FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE ${w.join(' AND ')} ORDER BY ${order} LIMIT 5000`).all(...a).map(b => {
      const lab = labelOf(b.label_id), partners = J(b.partners, []), guests = normGuests(J(b.guests, []));
      const people = [b.member_id, ...partners].filter(Boolean).map(id => ({ id, name: lastFirst(nameOf(id)), ph: photos.version(id, 'buchung') }));
      return { id: b.id, date: b.date, start: b.start, end: b.end, type: b.type, resource: b.rname, resource_id: b.resource_id, label: lab ? { name: lab.name, color: lab.color } : null, title: b.title,
        people, guests: guests.map(g => g.name + (g.partner ? ' (Partnerverein)' : '')), fee_cents: b.fee_cents, source: b.source, created_by: b.created_by, created_at: b.created_at,
        status: b.status === 'storniert' ? 'storniert' : `${b.date} ${b.end}` <= now ? 'abgeschlossen' : `${b.date} ${b.start}` <= now ? 'laeuft' : 'anstehend',
        cancelled_at: b.cancelled_at, cancelled_by: b.cancelled_by, cancel_reason: b.cancel_reason, series_id: b.series_id };
    });
    const t = String(q.q || '').trim().toLowerCase();
    if (t) rows = rows.filter(r => [r.resource, r.title, r.label && r.label.name, r.created_by, ...r.people.map(p => p.name), ...r.guests].filter(Boolean).join(' ').toLowerCase().includes(t));
    return { year: y, rows };
  };
  admin.get('/log', P, (req, res) => {
    const { year, rows } = logRows(req.query);
    res.json({ year, total: rows.length, rows: rows.slice(0, 1500), years: [...new Set([Number(today().slice(0, 4)), ...db.prepare('SELECT DISTINCT substr(date,1,4) y FROM bk_booking').all().map(r => +r.y)])].sort((a, b) => b - a) });
  });
  admin.get('/log.csv', P, (req, res) => {
    const { year, rows } = logRows(req.query);
    // Zellen, die Excel als Formel auswerten würde (=, +, -, @, Tab, CR am Anfang – z. B. aus Gastnamen), mit ' entschärfen
    const q = v => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    const ST = { storniert: 'storniert', abgeschlossen: 'abgeschlossen', laeuft: 'läuft', anstehend: 'anstehend' };
    const out = ['Datum;Von;Bis;Platz;Art;Buchungsart;Titel;Spieler;Gäste;Gebühr;Status;Storniert von;Grund;Eingetragen;Quelle;Von wem'].concat(rows.map(r => [deD(r.date), r.start, r.end, r.resource, TYPE[r.type], r.label ? r.label.name : '', r.title || '', r.people.map(p => p.name).join(' / '), r.guests.join(' / '),
      r.fee_cents ? (r.fee_cents / 100).toFixed(2).replace('.', ',') : '', ST[r.status], r.cancelled_by || '', r.cancel_reason || '', r.created_at, r.source, r.created_by || ''].map(q).join(';')));
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="buchungsprotokoll-${year}.csv"` }).send('\ufeff' + out.join('\r\n'));
  });

  /* ---------- Auswertung (Dashboard): Auslastung je Platz und gesamt ---------- */
  admin.get('/stats', P, (req, res) => {
    const y = Math.max(2000, Math.min(2100, int(req.query.year) || Number(today().slice(0, 4))));
    const all = resources(true).filter(r => r.kind === 'platz');
    const sel = req.query.resource ? all.filter(r => r.id === int(req.query.resource)) : all;
    const ids = sel.map(r => r.id);
    const t0 = today();
    const calc = yy => {
      const from = `${yy}-01-01`, to = `${yy}-12-31`;
      const rows = ids.length ? db.prepare(`SELECT * FROM bk_booking WHERE date BETWEEN ? AND ? AND type != 'sperre' AND resource_id IN (${ids.map(() => '?').join(',')})`).all(from, to, ...ids) : [];
      const act = rows.filter(b => b.status === 'aktiv'), can = rows.filter(b => b.status === 'storniert' && b.type === 'buchung');
      const mins = b => Math.max(0, tm(b.end) - tm(b.start));
      // verfügbare Zeit: Öffnungszeiten an buchbaren Tagen, im laufenden Jahr bis heute; Sperren abziehen
      const until = yy === Number(t0.slice(0, 4)) ? t0 : to;
      let avail = 0;
      const perRes = sel.map(r => {
        let a = 0;
        if (from <= until) for (let d = from; d <= until; d = addDays(d, 1)) if (String(r.days).includes(String(isoDow(d)))) a += tm(r.open_to) - tm(r.open_from);
        const locks = db.prepare("SELECT start, end FROM bk_booking WHERE resource_id = ? AND type = 'sperre' AND status = 'aktiv' AND date BETWEEN ? AND ?").all(r.id, from, until).reduce((x, b) => x + Math.max(0, tm(b.end) - tm(b.start)), 0);
        a = Math.max(0, a - locks); avail += a;
        const used = act.filter(b => b.resource_id === r.id && b.date <= until).reduce((x, b) => x + mins(b), 0);
        const all2 = act.filter(b => b.resource_id === r.id).reduce((x, b) => x + mins(b), 0);
        return { id: r.id, name: r.name, area: r.area, minutes: all2, used, avail: a, rate: a ? used / a : 0, count: act.filter(b => b.resource_id === r.id).length };
      });
      const usedAll = perRes.reduce((x, r) => x + r.used, 0);
      const month = Array.from({ length: 12 }, (_, i) => act.filter(b => +b.date.slice(5, 7) === i + 1).reduce((x, b) => x + mins(b), 0));
      const monthCount = Array.from({ length: 12 }, (_, i) => act.filter(b => +b.date.slice(5, 7) === i + 1).length);
      const monthCan = Array.from({ length: 12 }, (_, i) => can.filter(b => +b.date.slice(5, 7) === i + 1).length);
      const players = new Set(); act.forEach(b => { if (b.member_id) players.add(b.member_id); J(b.partners, []).forEach(x => players.add(x)); });
      return { from, to, until, act, can, mins, perRes, avail, usedAll, month, monthCount, monthCan, players: players.size,
        guests: act.filter(b => normGuests(J(b.guests, [])).length).length, labeled: act.filter(b => b.label_id).length, minutes: act.reduce((x, b) => x + mins(b), 0) };
    };
    const c = calc(y), p = calc(y - 1);
    // Kalender: Minuten je Tag
    const days = {}; c.act.forEach(b => { days[b.date] = (days[b.date] || 0) + c.mins(b); });
    // Wochentag × Stunde: belegte Stunden (anteilig)
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    c.act.forEach(b => { const d = isoDow(b.date) - 1, s0 = tm(b.start), e0 = tm(b.end); for (let h = Math.floor(s0 / 60); h * 60 < e0; h++) { const ov = Math.min(e0, (h + 1) * 60) - Math.max(s0, h * 60); if (ov > 0 && h < 24) grid[d][h] += ov / 60; } });
    const lo = sel.length ? Math.min(...sel.map(r => tm(r.open_from))) : 8 * 60, hi = sel.length ? Math.max(...sel.map(r => tm(r.open_to))) : 22 * 60;
    // nach Art: Buchungsart, Mitgliederbuchung, Serie ohne Buchungsart
    const kinds = new Map();
    c.act.forEach(b => { const l = labelOf(b.label_id); const k = l ? l.name : b.type === 'serie' ? 'Serie ohne Buchungsart' : 'Mitgliederbuchung'; const v = kinds.get(k) || { name: k, color: l ? l.color : b.type === 'serie' ? '#7a7f87' : null, minutes: 0, count: 0 }; v.minutes += c.mins(b); v.count++; kinds.set(k, v); });
    // Sperren als eigene Art (Platzpflege, Turniere …)
    if (ids.length) { const lk = db.prepare(`SELECT * FROM bk_booking WHERE date BETWEEN ? AND ? AND type = 'sperre' AND status = 'aktiv' AND resource_id IN (${ids.map(() => '?').join(',')})`).all(c.from, c.to, ...ids);
      for (const b of lk) { const l = labelOf(b.label_id); const k = l ? l.name : 'Gesperrt'; const v = kinds.get(k) || { name: k, color: l ? l.color : '#b0b4ba', minutes: 0, count: 0, lock: !l }; v.minutes += c.mins(b); v.count++; kinds.set(k, v); } }
    // Wer spielt am meisten? (Bucher und Mitspieler, Stunden)
    const pm = new Map(); c.act.filter(b => b.type === 'buchung').forEach(b => { for (const id of [b.member_id, ...J(b.partners, [])].filter(Boolean)) pm.set(id, (pm.get(id) || 0) + c.mins(b)); });
    const top = [...pm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, m]) => ({ name: lastFirst(nameOf(id)), minutes: m }));
    const app = c.act.filter(b => b.type === 'buchung' && b.source !== 'verwaltung' && b.created_at);
    const lead = app.length ? app.reduce((x, b) => x + Math.max(0, (Date.parse(b.date + 'T' + b.start) - Date.parse(String(b.created_at).replace(' ', 'T'))) / 86400000), 0) / app.length : null;
    const pick = x => ({ minutes: x.minutes, count: x.act.length, cancelled: x.can.length, rate: x.avail ? x.usedAll / x.avail : 0, players: x.players, guests: x.guests, labeled: x.labeled, month: x.month, monthCount: x.monthCount, monthCan: x.monthCan });
    res.json({ year: y, years: [...new Set([Number(t0.slice(0, 4)), ...db.prepare("SELECT DISTINCT substr(date,1,4) y FROM bk_booking").all().map(r => +r.y)])].sort((a, b) => b - a),
      resources: all.map(r => ({ id: r.id, name: r.name })), resource: req.query.resource ? int(req.query.resource) : null, until: c.until,
      cur: pick(c), prev: pick(p), perRes: c.perRes.map(r => ({ ...r, prevRate: (p.perRes.find(x => x.id === r.id) || {}).rate || 0 })), days, grid, hours: [Math.floor(lo / 60), Math.ceil(hi / 60)],
      kinds: [...kinds.values()].sort((a, b) => b.minutes - a.minutes), top, lead });
  });

  /* ---------- Plätze & Geräte ---------- */
  const resInput = (b, cur = {}) => {
    const g = k => (b[k] !== undefined ? b[k] : cur[k]);
    const v = { kind: g('kind') === 'artikel' ? 'artikel' : 'platz', name: txt(g('name'), 60), area: txt(g('area'), 40) || null, note: txt(g('note'), 200) || null,
      days: [...new Set(String(g('days') || '').replace(/[^1-7]/g, '').split(''))].sort().join(''), open_from: String(g('open_from') || ''), open_to: String(g('open_to') || ''),
      slot_min: int(g('slot_min')), max_min: int(g('max_min')), quantity: Math.max(1, Math.min(99, int(g('quantity')) || 1)),
      guest_fee_cents: g('guest_fee_cents') === null || g('guest_fee_cents') === '' || g('guest_fee_cents') === undefined ? null : Math.max(0, Math.min(100000, int(g('guest_fee_cents')))),
      active: g('active') === undefined ? 1 : (g('active') ? 1 : 0), sort: int(g('sort')) || 100,
      department_id: int(g('department_id')) || null, outsiders: g('outsiders') === 'gesperrt' ? 'gesperrt' : 'gebuehr', outsider_fee_cents: Math.max(0, Math.min(100000, int(g('outsider_fee_cents')))),
      // Mitspieler-Pflicht und Allein-Training nur bei Plätzen, „als Mitspieler buchbar“ nur bei Geräten
      partner_required: g('kind') === 'artikel' ? 0 : (g('partner_required') ? 1 : 0), solo_label: g('kind') === 'artikel' ? null : (txt(g('solo_label'), 30) || null), as_partner: g('kind') === 'artikel' && g('as_partner') ? 1 : 0 };
    if (v.department_id && !departments().some(d => d.id === v.department_id)) return { error: 'Diese Abteilung gibt es nicht.' };
    if (v.name.length < 2) return { error: 'Bitte einen Namen eintragen (z. B. „Platz 1“).' };
    if (!v.days) return { error: 'Bitte mindestens einen Wochentag wählen.' };
    if (!isTime(v.open_from) || !isTime(v.open_to) || tm(v.open_to) <= tm(v.open_from)) return { error: 'Bitte die Buchungszeiten prüfen (von … bis …).' };
    if (![15, 30, 45, 60, 90, 120].includes(v.slot_min)) return { error: 'Das Zeitraster ist 15, 30, 45, 60, 90 oder 120 Minuten.' };
    if (v.max_min < v.slot_min || v.max_min % v.slot_min || v.max_min > 24 * 60) return { error: 'Die Höchstdauer muss ein Vielfaches des Rasters sein.' };
    if ((tm(v.open_to) - tm(v.open_from)) % v.slot_min) return { error: 'Die Buchungszeit muss ins Raster passen (z. B. 08:00–22:00 bei 60 Minuten).' };
    return { v };
  };
  admin.get('/resources', P, (req, res) => res.json(resources(true).map(r => ({ ...r, future: db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE resource_id = ? AND status = 'aktiv' AND date >= ?").get(r.id, today()).n }))));
  /** Reihenfolge (Belegungsplan, App, Tablet): ids in der gewünschten Reihenfolge */
  admin.put('/resources/order', PE, (req, res) => {
    const ids = (Array.isArray((req.body || {}).ids) ? req.body.ids : []).map(Number).filter(Number.isInteger);
    const all = resources(true).map(r => r.id);
    if (!ids.length || ids.some(id => !all.includes(id))) return bad(res, 'Unbekannter Platz oder unbekanntes Gerät.');
    const order = [...new Set(ids), ...all.filter(id => !ids.includes(id))];
    const up = db.prepare('UPDATE bk_resource SET sort = ? WHERE id = ?');
    db.transaction(() => order.forEach((id, i) => up.run((i + 1) * 10, id)))();
    ctx.audit(req.user, 'Buchungssystem: Reihenfolge der Plätze geändert', order.map(id => (resource(id) || {}).name).join(', '));
    res.json({ ok: true });
  });
  admin.post('/resources', PE, (req, res) => {
    const r = resInput(req.body || {}); if (r.error) return bad(res, r.error);
    if ((req.body || {}).sort === undefined) r.v.sort = (db.prepare('SELECT MAX(sort) AS m FROM bk_resource WHERE deleted = 0').get().m || 0) + 10;   // neue ans Ende
    const k = Object.keys(r.v);
    const id = Number(db.prepare(`INSERT INTO bk_resource(${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map(x => r.v[x])).lastInsertRowid);
    ctx.audit(req.user, 'Buchungssystem: angelegt', r.v.name); res.json({ id });
  });
  admin.put('/resources/:id', PE, (req, res) => {
    const cur = resource(req.params.id); if (!cur || cur.deleted) return bad(res, 'Nicht gefunden.', 404);
    const r = resInput(req.body || {}, cur); if (r.error) return bad(res, r.error);
    const k = Object.keys(r.v);
    db.prepare(`UPDATE bk_resource SET ${k.map(x => `${x} = ?`).join(', ')} WHERE id = ?`).run(...k.map(x => r.v[x]), cur.id);
    res.json({ ok: true });
  });
  admin.delete('/resources/:id', PE, (req, res) => {
    const cur = resource(req.params.id); if (!cur || cur.deleted) return bad(res, 'Nicht gefunden.', 404);
    // Nur kommende Buchungen (auch Serien und Sperren) verhindern das Löschen
    const d = today(), t = hhmm(nowMin());
    const fut = db.prepare("SELECT COUNT(*) AS n, MIN(date || ' ' || start) AS first FROM bk_booking WHERE resource_id = ? AND status = 'aktiv' AND (date > ? OR (date = ? AND end > ?))").get(cur.id, d, d, t);
    if (fut.n) return bad(res, `„${cur.name}“ hat noch ${fut.n} kommende ${fut.n === 1 ? 'Buchung' : 'Buchungen'} (nächste am ${deD(fut.first.slice(0, 10))} um ${fut.first.slice(11)} Uhr) – erst stornieren oder verlegen, oder auf „inaktiv“ setzen.`, 409);
    db.prepare('DELETE FROM bk_wait WHERE resource_id = ?').run(cur.id);
    if (db.prepare('SELECT 1 FROM bk_booking WHERE resource_id = ?').get(cur.id)) {
      db.prepare('UPDATE bk_resource SET deleted = 1, active = 0 WHERE id = ?').run(cur.id);   // vergangene Buchungen bleiben in Protokoll und Auswertung
    } else db.prepare('DELETE FROM bk_resource WHERE id = ?').run(cur.id);
    ctx.audit(req.user, 'Buchungssystem: Platz/Gerät gelöscht', cur.name);
    res.json({ ok: true });
  });

  /* ---------- Serien & Sperren (wöchentlich, Zeitraum) ---------- */
  admin.get('/series', P, (req, res) => res.json(db.prepare('SELECT * FROM bk_series ORDER BY active DESC, to_date DESC, id DESC').all().map(x => ({ ...x, resources: J(x.resources, []), label: labelOf(x.label_id), rule: ruleOf(x), rule_text: ruleText(x),
    games: ruleOf(x).freq === 'import' ? db.prepare("SELECT COUNT(DISTINCT ext_key) n FROM bk_booking WHERE series_id = ? AND status = 'aktiv' AND date >= ?").get(x.id, today()).n : null,
    member: x.member_id ? nameOf(x.member_id) : null, count: db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE series_id = ? AND status = 'aktiv' AND date >= ?").get(x.id, today()).n }))));
  /* ---------- Wiederholungsregel einer Serie ----------
     { freq: 'daily'|'weekly'|'monthly'|'import', interval: 1…12, monthly: 'day'|'nth' } – Wochentage stehen weiter in sx.weekdays.
     Ohne Regel (Serien bis 3.19): wöchentlich an den Wochentagen. */
  const ruleOf = sx => { const r = J(sx.rule, null) || {}; return { freq: ['daily', 'weekly', 'monthly', 'import'].includes(r.freq) ? r.freq : 'weekly', interval: Math.max(1, Math.min(12, int(r.interval) || 1)), monthly: r.monthly === 'nth' ? 'nth' : 'day' }; };
  function ruleInput(b, fromDate) {
    const freq = ['daily', 'weekly', 'monthly'].includes(b.freq) ? b.freq : 'weekly';
    const interval = Math.max(1, Math.min(12, int(b.interval) || 1));
    const rule = { freq, interval, monthly: b.monthly === 'nth' ? 'nth' : 'day' };
    let weekdays = [...new Set(String(b.weekdays || '').replace(/[^1-7]/g, '').split(''))].sort().join('');
    if (freq !== 'weekly' || !weekdays) weekdays = freq === 'weekly' && !weekdays ? '' : String(isoDow(fromDate));
    return { rule, weekdays };
  }
  const WDLONG = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const nthOf = d => { const day = +d.slice(8, 10); const n = Math.ceil(day / 7); const last = +addDays(d, 7).slice(5, 7) !== +d.slice(5, 7); return { n, last }; };
  /** Text wie „jeden Di, Do“, „alle 2 Wochen Di“, „täglich“, „monatlich am 15.“, „monatlich am 2. Dienstag“ */
  function ruleText(sx) {
    const r = ruleOf(sx), wd = String(sx.weekdays || '').split('').filter(Boolean).map(d => WD[+d]).join(', ');
    if (r.freq === 'import') return 'Spielplan';
    if (r.freq === 'daily') return r.interval === 1 ? 'täglich' : `alle ${r.interval} Tage`;
    if (r.freq === 'monthly') {
      const k = r.interval === 1 ? 'monatlich' : `alle ${r.interval} Monate`;
      if (r.monthly === 'nth') { const { n } = nthOf(sx.from_date); return `${k} am ${n >= 5 ? 'letzten' : n + '.'} ${WDLONG[isoDow(sx.from_date)]}`; }
      return `${k} am ${+sx.from_date.slice(8, 10)}.`;
    }
    return r.interval === 1 ? `jeden ${wd}` : `alle ${r.interval} Wochen ${wd}`;
  }
  function seriesDays(sx) {
    const out = [], r = ruleOf(sx), wd = String(sx.weekdays || ''), f = sx.from_date;
    if (r.freq === 'import') return out;
    const monday = d => addDays(d, 1 - isoDow(d));
    const dayNo = d => Math.round(Date.parse(d + 'T12:00:00Z') / 86400000);
    const w0 = dayNo(monday(f)), d0 = dayNo(f);
    const { n: nth } = nthOf(f), dow0 = isoDow(f), dom0 = +f.slice(8, 10), m0 = +f.slice(0, 4) * 12 + +f.slice(5, 7) - 1;
    for (let d = f, i = 0; d <= sx.to_date && i < 800; d = addDays(d, 1), i++) {
      if (r.freq === 'daily') { if ((dayNo(d) - d0) % r.interval === 0) out.push(d); continue; }
      if (r.freq === 'weekly') { if (wd.includes(String(isoDow(d))) && Math.round((dayNo(monday(d)) - w0) / 7) % r.interval === 0) out.push(d); continue; }
      const m = +d.slice(0, 4) * 12 + +d.slice(5, 7) - 1;
      if ((m - m0) % r.interval !== 0) continue;
      if (r.monthly === 'day') { if (+d.slice(8, 10) === dom0) out.push(d); continue; }
      if (isoDow(d) !== dow0) continue;
      const x = nthOf(d);
      if (nth >= 5 ? x.last : x.n === nth) out.push(d);
    }
    return out;
  }
  /* ---------- Spielplan-Import (Verband): einfügen, CSV/Excel oder .ics → Vereinstermine (Sperren) je Mannschaft ----------
     Wiederholter Import erkennt Spiele am Schlüssel (Mannschaft + Heim + Gast) und verschiebt sie bei Verlegung, statt doppelt zu buchen. */
  const IMP = ctx.require('./spielplan');   // Spielplan-Leser (Kern)
  const impKey = g => `imp:${IMP.norm(g.teamBase || g.team)}:${IMP.norm(g.home)}:${IMP.norm(g.guest)}`;
  const impTeams = () => { try { return JSON.parse(S('import_teams', '{}')) || {}; } catch (e) { return {}; } };
  /** Vorschlag je Mannschaft: 2er → 1 Platz 3 Std., 4er → 2 Plätze 4 Std., 6er → 3 Plätze 5 Std. (sonst 2 Plätze, 3 Std.) */
  function teamDefault(team, size) {
    const saved = impTeams()[IMP.norm(team) || '_'];
    const courts = resources().filter(r => r.kind === 'platz');
    if (saved) return { resources: saved.resources.filter(id => courts.some(r => r.id === id)), hours: saved.hours };
    const n = size ? Math.max(1, Math.min(courts.length, Math.ceil(size / 2))) : Math.min(2, courts.length);
    return { resources: courts.slice(0, n).map(r => r.id), hours: size === 2 ? 3 : size === 6 ? 5 : size === 4 ? 4 : 3 };
  }
  const futureByKey = key => db.prepare("SELECT * FROM bk_booking WHERE ext_key = ? AND status = 'aktiv' AND date >= ? ORDER BY date, resource_id").all(key, today());
  admin.post('/import/parse', PS, ar(async (req, res) => {
    const b = req.body || {};
    let parsed;
    try {
      const name = String(b.name || '').toLowerCase();
      if (b.file) {
        const buf = Buffer.from(String(b.file), 'base64');
        if (buf.length > 3 * 1024 * 1024) return bad(res, 'Die Datei ist zu groß (höchstens 3 MB).');
        if (/\.xlsx$/.test(name)) parsed = IMP.fromRows(await IMP.xlsxRows(buf, ctx.require('exceljs')));
        else { const t = buf.toString('utf8'); parsed = /BEGIN:VCALENDAR/i.test(t) ? IMP.fromIcs(t) : IMP.fromRows(IMP.splitRows(t)); }
      } else {
        const t = String(b.text || '').slice(0, 500000);
        parsed = /BEGIN:VCALENDAR/i.test(t) ? IMP.fromIcs(t) : IMP.fromRows(IMP.splitRows(t));
      }
    } catch (e) { return bad(res, 'Die Daten konnten nicht gelesen werden: ' + e.message); }
    if (!parsed.games.length) return bad(res, 'Keine Spiele erkannt. Bitte die ganze Tabelle mit Datum, Heim- und Gastmannschaft einfügen (oder eine CSV-, Excel- oder Kalenderdatei wählen).');
    const club = txt(b.club, 80) || S('import_club', '') || IMP.guessClub(parsed.games) || ctx.getSetting('club_name', '');
    IMP.numberTeams(parsed.games, club);   // „Herren 30 2“: zweite Mannschaft getrennt
    const d0 = today(), teams = {};
    const games = parsed.games.map(g => {
      const key = impKey(g), home = IMP.isHomeGame(g, club), ex = futureByKey(key);
      const t = g.team || '–';
      if (!teams[t]) teams[t] = { team: t, size: g.size, count: 0, ...teamDefault(g.team, g.size) };
      teams[t].count++;
      const same = ex.length && ex[0].date === g.date && ex[0].start === g.start;
      return { ...g, key, isHome: home, past: g.date < d0, noTime: !g.start, status: !ex.length ? 'neu' : same ? 'vorhanden' : 'verlegt', was: ex.length && !same ? { date: ex[0].date, start: ex[0].start } : null };
    });
    res.json({ club, games, skipped: parsed.skipped.slice(0, 30), teams: Object.values(teams), courts: resources().filter(r => r.kind === 'platz').map(r => ({ id: r.id, name: r.name })) });
  }));
  /** Spielplan übernehmen (Heimspiele als Platzbelegung) – von der Verwaltung und vom Spielbetrieb (Hook) genutzt → { status, body } */
  async function applyImport(b, user) {
    const d0 = today();
    const label = b.label_id ? labelOf(int(b.label_id)) : null;
    const teamCfg = b.teams && typeof b.teams === 'object' ? b.teams : {};
    const plan = [], problems = [], moved2 = [];
    if (Array.isArray(b.games)) IMP.numberTeams(b.games, b.club || S('import_club', '') || ctx.getSetting('club_name', ''));
    // Spiele zur gleichen Zeit (z. B. Damen und Herren am Sonntag um 9): Plätze nicht doppelt vergeben – die spätere Mannschaft bekommt freie andere Plätze
    const taken = [];   // { id, date, s, e }
    const courtsAll = resources().filter(r => r.kind === 'platz');
    const overlapsTaken = (rid, date, s, e) => taken.some(t => t.id === rid && t.date === date && t.s < e && t.e > s);
    const gamesIn = (Array.isArray(b.games) ? b.games : []).slice(0, 500).slice().sort((a, c) => String(a.date).localeCompare(String(c.date)) || String(a.start).localeCompare(String(c.start)));
    for (const g0 of gamesIn) {
      const g = { date: String(g0.date || ''), start: String(g0.start || ''), team: txt(g0.team, 40), teamBase: g0.teamBase ? txt(g0.teamBase, 40) : null, home: txt(g0.home, 80), guest: txt(g0.guest, 80), league: txt(g0.league, 80), minutes: int(g0.minutes) || 0 };
      if (!isDate(g.date) || g.date < d0) { problems.push(`${g.home} – ${g.guest}: liegt in der Vergangenheit`); continue; }
      if (tm(g.start) == null) { problems.push(`${deD(g.date)} ${g.home} – ${g.guest}: keine Uhrzeit`); continue; }
      const tc = teamCfg[g.team || '–'] || {};
      let rs = [...new Set((Array.isArray(tc.resources) ? tc.resources : []).map(Number))].map(resource).filter(r => r && !r.deleted && r.kind === 'platz');
      if (!rs.length) { problems.push(`${g.team || 'Mannschaft'}: keine Plätze gewählt`); continue; }
      const hours = Math.max(1, Math.min(12, Number(tc.hours) || 4));
      const s = tm(g.start), e = Math.min(24 * 60, s + (g.minutes || hours * 60));
      if (rs.some(r => overlapsTaken(r.id, g.date, s, e))) {
        const alt = courtsAll.filter(r => !overlapsTaken(r.id, g.date, s, e)).sort((a, c) => (rs.some(x => x.id === a.id) ? -1 : 0) - (rs.some(x => x.id === c.id) ? -1 : 0)).slice(0, rs.length);
        if (alt.length < rs.length) { problems.push(`${deD(g.date)} ${g.start} ${g.team || ''}: nicht genug freie Plätze (gleichzeitig mit einem anderen Spiel)`); continue; }
        moved2.push(`${deD(g.date)} ${g.start} ${g.team || 'Spiel'} → ${alt.map(r => r.name).join(', ')}`);
        rs = alt;
      }
      for (const r of rs) taken.push({ id: r.id, date: g.date, s, e });
      const key = impKey(g), ex = futureByKey(key);
      const club = txt(b.club, 80) || '';
      const opp = club && IMP.norm(g.home).includes(IMP.norm(club)) ? g.guest : club && IMP.norm(g.guest).includes(IMP.norm(club)) ? g.home : `${g.home} – ${g.guest}`;
      const title = txt(`${g.team ? g.team + ' gegen ' : 'Spiel gegen '}${opp}`, 80);
      const sameSlot = ex.length && ex.every(x => x.date === g.date && x.start === hhmm(s) && x.end === hhmm(e)) && ex.length === rs.length && rs.every(r => ex.some(x => x.resource_id === r.id));
      const exIds = new Set(ex.map(x => x.id));
      const clash = sameSlot ? [] : rs.flatMap(r => db.prepare("SELECT * FROM bk_booking WHERE resource_id = ? AND date = ? AND status = 'aktiv' AND start < ? AND end > ?").all(r.id, g.date, hhmm(e), hhmm(s)).filter(c => !exIds.has(c.id) && c.ext_key !== key));
      plan.push({ g, rs, s, e, key, ex, title, status: !ex.length ? 'neu' : sameSlot ? 'vorhanden' : 'verlegt', clash });
    }
    const clashes = plan.filter(p => p.clash.length).map(p => ({ date: p.g.date, start: p.g.start, title: p.title, items: p.clash.map(c => bview(c, { full: true })) }));
    const sum = { neu: plan.filter(p => p.status === 'neu').length, verlegt: plan.filter(p => p.status === 'verlegt').length, vorhanden: plan.filter(p => p.status === 'vorhanden').length, problems, reassigned: moved2, clash: clashes };
    if (b.preview) return { status: 200, body: sum };
    const memberClash = clashes.reduce((n, c) => n + c.items.filter(x => x.type !== 'sperre').length, 0);
    if (memberClash && !b.force) return { status: 409, body: { error: `${memberClash} bestehende Buchung(en) liegen zu Spielzeiten und würden storniert.`, ...sum } };
    const by = user.name || user.username || String(user), toCancel = [];
    // je Mannschaft eine Serie „Spielplan <Mannschaft>“ (Typ Sperre) – damit lassen sich alle Spiele einer Mannschaft gemeinsam ändern oder entfernen
    const seriesFor = (team, rs, dates) => {
      const title = `Spielplan ${team || 'Verein'}`;
      let sx = db.prepare("SELECT * FROM bk_series WHERE type = 'sperre' AND active = 1 AND title = ? AND rule LIKE '%\"import\"%'").get(title);
      const from = dates.reduce((a, c) => (c < a ? c : a)), to = dates.reduce((a, c) => (c > a ? c : a));
      if (!sx) {
        const id = Number(db.prepare("INSERT INTO bk_series(type, title, resources, weekdays, start, end, from_date, to_date, note, label_id, rule, created_by) VALUES ('sperre', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(title, JSON.stringify(rs.map(r => r.id)), String(isoDow(from)), '00:00', '24:00', from, to, 'aus dem Spielplan-Import', label ? label.id : null, JSON.stringify({ freq: 'import', interval: 1 }), by).lastInsertRowid);
        return id;
      }
      db.prepare('UPDATE bk_series SET from_date = MIN(from_date, ?), to_date = MAX(to_date, ?), resources = ? WHERE id = ?').run(from, to, JSON.stringify([...new Set([...J(sx.resources, []), ...rs.map(r => r.id)])]), sx.id);
      return sx.id;
    };
    const byTeam = {};
    for (const p of plan) (byTeam[p.g.team || '–'] = byTeam[p.g.team || '–'] || []).push(p);
    let made = 0, moved = 0;
    db.transaction(() => {
      for (const [team, ps] of Object.entries(byTeam)) {
        const sid = seriesFor(team === '–' ? '' : team, [...new Map(ps.flatMap(p => p.rs).map(r => [r.id, r])).values()], ps.map(p => p.g.date));
        const ins = db.prepare("INSERT INTO bk_booking(resource_id, date, start, end, type, title, note, series_id, source, created_by, label_id, ext_key) VALUES (?,?,?,?,'sperre',?,?,?,'import',?,?,?)");
        for (const p of ps) {
          if (p.status === 'vorhanden') continue;
          toCancel.push(...p.clash.filter(c => c.type !== 'sperre'));
          if (p.status === 'verlegt') { for (const x of p.ex) db.prepare("UPDATE bk_booking SET status = 'storniert', cancelled_at = ?, cancelled_by = ?, cancel_reason = 'Spiel verlegt (Spielplan-Import)' WHERE id = ?").run(nowTs(), by, x.id); moved++; }
          else made++;
          const note = [p.g.league, `${p.g.home} – ${p.g.guest}`].filter(Boolean).join(' · ').slice(0, 300);
          for (const r of p.rs) ins.run(r.id, p.g.date, hhmm(p.s), hhmm(p.e), p.title, note, sid, by, label ? label.id : null, p.key);
        }
      }
    })();
    for (const c of toCancel) {
      const b0 = db.prepare('SELECT * FROM bk_booking WHERE id = ?').get(c.id); if (!b0 || b0.status !== 'aktiv') continue;
      await cancel(b0, by, 'Platz belegt: Mannschaftsspiel');
      if (b0.member_id && b0.type === 'buchung') notifyLockCancel(b0, 'Mannschaftsspiel');
    }
    // Vorgaben je Mannschaft und Vereinsname fürs nächste Mal merken
    const saved = impTeams();
    for (const [team, tc] of Object.entries(teamCfg)) if (tc && Array.isArray(tc.resources)) saved[IMP.norm(team === '–' ? '' : team) || '_'] = { resources: tc.resources.map(Number).filter(Boolean), hours: Math.max(1, Math.min(12, Number(tc.hours) || 4)) };
    SET('import_teams', JSON.stringify(saved));
    if (txt(b.club, 80)) SET('import_club', txt(b.club, 80));
    ctx.audit(user, 'Spielplan importiert', `${made} neu, ${moved} verlegt, ${sum.vorhanden} unverändert${toCancel.length ? `, ${toCancel.length} Buchungen storniert` : ''}`);
    return { status: 200, body: { ok: true, made, moved, same: sum.vorhanden, cancelled: toCancel.length, problems } };
  }
  admin.post('/import/apply', PS, ar(async (req, res) => {
    const b = req.body || {};
    const r = await applyImport(b, req.user);
    // Spielbetrieb aktiv: alle erkannten Spiele (auch Auswärtsspiele) dort als Spieltage übernehmen
    if (r.status === 200 && !b.preview && Array.isArray(b.all) && b.all.length) {
      const sp = (await ctx.callHooks('spielplanGames', { games: b.all.slice(0, 1000), club: txt(b.club, 80), user: req.user })).find(x => x.id === 'spielbetrieb');
      if (sp && sp.result) r.body.spielbetrieb = sp.result;
    }
    res.status(r.status).json(r.body);
  }));
  /* Spielbetrieb: Heimspiele mit den gemerkten Plätzen je Mannschaft belegen */
  ctx.hooks.bookImportedGames = async ({ games, club, user, preview = false, force = false }) => {
    const saved = impTeams(), teams = {};
    for (const g of games || []) { const k = g.team || '–'; const t = saved[IMP.norm(g.team || '') || '_']; if (t) teams[k] = t; }
    const r = await applyImport({ games: (games || []).filter(g => teams[g.team || '–']), club, teams, preview, force }, user || 'Spielbetrieb');   // nur Mannschaften mit gemerkten Plätzen
    return { status: r.status, ...r.body, noCourts: [...new Set((games || []).map(g => g.team || '–').filter(k => !teams[k]))] };
  };

  admin.post('/series', PS, ar(async (req, res) => {
    const b = req.body || {};
    const type = b.type === 'sperre' ? 'sperre' : 'serie';
    const label = b.label_id ? labelOf(int(b.label_id)) : null;
    let title = txt(b.title, 80) || (label ? label.name : ''); const rs = [...new Set((Array.isArray(b.resources) ? b.resources : []).map(Number))].map(resource).filter(Boolean);
    const { rule, weekdays } = ruleInput(b, isDate(b.from_date) ? b.from_date : today());
    const s = tm(b.start), e = tm(b.end);
    if (!rs.length) return bad(res, 'Bitte mindestens einen Platz wählen.');
    if (!weekdays) return bad(res, 'Bitte mindestens einen Wochentag wählen.');
    if (s == null || e == null || e <= s) return bad(res, 'Bitte die Uhrzeit prüfen.');
    if (!isDate(b.from_date) || !isDate(b.to_date) || b.to_date < b.from_date) return bad(res, 'Bitte den Zeitraum prüfen.');
    if (b.from_date < today()) return bad(res, 'Der Zeitraum beginnt in der Vergangenheit.');
    if (addDays(b.from_date, 400) < b.to_date) return bad(res, 'Höchstens ein gutes Jahr am Stück.');
    const mid = b.member_id ? memberRow(b.member_id) : null;
    // Titel ist freiwillig: sonst Buchungsart, gebuchtes Mitglied oder einfach „Serie“/„Sperre“
    if (title.length < 2 && type === 'serie' && !mid) return bad(res, 'Bitte ein Mitglied wählen, eine Buchungsart wählen oder einen Titel eintragen (z. B. „Training Jugend“).');
    if (title.length < 2) title = (mid && mid.name) || 'Sperre';
    const sx = { type, title, resources: JSON.stringify(rs.map(r => r.id)), weekdays, start: hhmm(s), end: hhmm(e), from_date: b.from_date, to_date: b.to_date, member_id: mid ? mid.id : null, note: txt(b.note, 300) || null, label_id: label ? label.id : null, rule: JSON.stringify(rule) };
    const days = seriesDays(sx);
    if (!days.length) return bad(res, 'In diesem Zeitraum liegt kein Termin – bitte Zeitraum oder Wiederholung prüfen.');
    // Überschneidungen vorab zeigen; Sperren stornieren auf Wunsch die betroffenen Buchungen, Serien lassen belegte Tage aus
    const clash = [];
    for (const r of rs) for (const d of days) for (const c of db.prepare("SELECT * FROM bk_booking WHERE resource_id = ? AND date = ? AND status = 'aktiv' AND start < ? AND end > ?").all(r.id, d, hhmm(e), hhmm(s))) clash.push({ ...bview(c, { full: true }), resource: r.name });
    if (b.preview) return res.json({ days: days.length * rs.length, dates: days.slice(0, 400), rule: ruleText(sx), clash });
    let id, made = 0, skipped = 0;
    const toCancel = [];
    db.transaction(() => {
      const k = Object.keys(sx);
      id = Number(db.prepare(`INSERT INTO bk_series(${k.join(',')}, created_by) VALUES (${k.map(() => '?').join(',')}, ?)`).run(...k.map(x => sx[x]), uname(req)).lastInsertRowid);
      const ins = db.prepare('INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, title, note, series_id, source, created_by, label_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
      for (const r of rs) for (const d of days) {
        const cl = clash.filter(c => c.resource_id === r.id && c.date === d);
        if (type === 'serie' && cl.length) { skipped++; continue; }
        if (type === 'sperre') toCancel.push(...cl.filter(c => c.type !== 'sperre'));
        ins.run(r.id, d, hhmm(s), hhmm(e), type === 'sperre' ? 'sperre' : 'serie', sx.member_id, title, sx.note, id, 'verwaltung', uname(req), sx.label_id); made++;
      }
    })();
    for (const c of toCancel) {
      const b0 = db.prepare('SELECT * FROM bk_booking WHERE id = ?').get(c.id);
      await cancel(b0, uname(req), `Platz gesperrt: ${title}`);
      if (b0.member_id && b0.type === 'buchung') notifyLockCancel(b0, title);
    }
    ctx.audit(req.user, type === 'sperre' ? 'Sperre angelegt' : 'Serienbuchung angelegt', `${title}: ${made} Termine${skipped ? `, ${skipped} belegt ausgelassen` : ''}${toCancel.length ? `, ${toCancel.length} storniert` : ''}`);
    res.json({ id, made, skipped, cancelled: toCancel.length });
  }));
  admin.post('/series/:id/end', PS, ar(async (req, res) => {   // beenden: künftige Termine entfernen (Vergangenes bleibt)
    const sx = db.prepare('SELECT * FROM bk_series WHERE id = ?').get(int(req.params.id)); if (!sx) return bad(res, 'Nicht gefunden.', 404);
    const fut = db.prepare("SELECT * FROM bk_booking WHERE series_id = ? AND status = 'aktiv' AND date >= ?").all(sx.id, today());
    for (const b of fut) await cancel(b, uname(req), 'Serie beendet');
    db.prepare('UPDATE bk_series SET active = 0, to_date = MIN(to_date, ?) WHERE id = ?').run(addDays(today(), -1) < sx.from_date ? sx.from_date : addDays(today(), -1), sx.id);
    ctx.audit(req.user, sx.type === 'sperre' ? 'Sperre aufgehoben' : 'Serie beendet', `${sx.title}: ${fut.length} Termine entfernt`);
    res.json({ ok: true, removed: fut.length });
  }));

  /* ---------- Buchungsarten ---------- */
  const labelInput = b => {
    const arr = v => (Array.isArray(v) ? v : J(v, []));
    const v = { name: txt(b.name, 40), color: /^#[0-9a-f]{6}$/i.test(String(b.color || '')) ? String(b.color).toLowerCase() : '#2f6fd6', sort: int(b.sort) || 100, active: b.active === undefined ? 1 : (b.active ? 1 : 0),
      use_mode: ['alle', 'auswahl'].includes(b.use_mode) ? b.use_mode : 'verwaltung',
      use_functions: JSON.stringify([...new Set(arr(b.use_functions).map(x => txt(x, 60)).filter(Boolean))].slice(0, 30)),
      use_members: JSON.stringify([...new Set(arr(b.use_members).map(Number).filter(x => Number.isInteger(x) && x > 0))].slice(0, 200)),
      free_rules: b.free_rules ? 1 : 0 };
    if (v.name.length < 2) return { error: 'Bitte einen Namen für die Buchungsart eintragen (z. B. „Training“).' };
    return { v };
  };
  admin.get('/labels', P, (req, res) => res.json(labels(true).map(l => ({ ...l, use_functions: J(l.use_functions, []), use_members: J(l.use_members, []), free_rules: Boolean(l.free_rules), used: db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE label_id = ? AND status = 'aktiv' AND date >= ?").get(l.id, today()).n }))));
  admin.post('/labels', PE, (req, res) => {
    const r = labelInput(req.body || {}); if (r.error) return bad(res, r.error);
    if (db.prepare('SELECT 1 FROM bk_label WHERE lower(name) = lower(?)').get(r.v.name)) return bad(res, 'Diese Buchungsart gibt es schon.');
    const id = Number(db.prepare('INSERT INTO bk_label(name, color, sort, active, use_mode, use_functions, use_members, free_rules) VALUES (?,?,?,?,?,?,?,?)').run(r.v.name, r.v.color, r.v.sort, r.v.active, r.v.use_mode, r.v.use_functions, r.v.use_members, r.v.free_rules).lastInsertRowid);
    ctx.audit(req.user, 'Buchungssystem: Buchungsart angelegt', r.v.name);
    res.json({ id });
  });
  admin.put('/labels/:id', PE, (req, res) => {
    const cur = db.prepare('SELECT * FROM bk_label WHERE id = ?').get(int(req.params.id)); if (!cur) return bad(res, 'Nicht gefunden.', 404);
    const r = labelInput({ ...cur, ...(req.body || {}) }); if (r.error) return bad(res, r.error);
    db.prepare('UPDATE bk_label SET name = ?, color = ?, sort = ?, active = ?, use_mode = ?, use_functions = ?, use_members = ?, free_rules = ? WHERE id = ?').run(r.v.name, r.v.color, r.v.sort, r.v.active, r.v.use_mode, r.v.use_functions, r.v.use_members, r.v.free_rules, cur.id);
    ctx.audit(req.user, 'Buchungssystem: Buchungsart geändert', r.v.name);
    res.json({ ok: true });
  });
  admin.delete('/labels/:id', PE, (req, res) => {
    const cur = db.prepare('SELECT * FROM bk_label WHERE id = ?').get(int(req.params.id)); if (!cur) return bad(res, 'Nicht gefunden.', 404);
    if (db.prepare('SELECT 1 FROM bk_booking WHERE label_id = ?').get(cur.id) || db.prepare('SELECT 1 FROM bk_series WHERE label_id = ?').get(cur.id)) return bad(res, 'Die Buchungsart wird schon verwendet – stattdessen auf „inaktiv“ setzen.');
    db.prepare('DELETE FROM bk_label WHERE id = ?').run(cur.id); res.json({ ok: true });
  });

  /* ---------- Sonderrechte einzelner Mitglieder (App) ---------- */
  admin.get('/rights', P, (req, res) => res.json(db.prepare('SELECT r.*, m.name FROM bk_rights r JOIN members m ON m.id = r.member_id ORDER BY name_key(m.name, m.kind)').all().map(r => ({ ...r, series: Boolean(r.series), for_others: Boolean(r.for_others), all_labels: Boolean(r.all_labels), labels: J(r.labels, []) }))));
  admin.put('/rights', PE, (req, res) => {
    const b = req.body || {}; const m = memberRow(b.member_id); if (!m) return bad(res, 'Bitte ein Mitglied wählen.');
    const ls = [...new Set((Array.isArray(b.labels) ? b.labels : []).map(Number))].filter(id => labelRow(id));
    if (!b.series && !b.for_others && !b.all_labels && !ls.length) { db.prepare('DELETE FROM bk_rights WHERE member_id = ?').run(m.id); return res.json({ ok: true, removed: true }); }
    db.prepare('INSERT INTO bk_rights(member_id, series, for_others, all_labels, labels, note, updated_by, updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET series = excluded.series, for_others = excluded.for_others, all_labels = excluded.all_labels, labels = excluded.labels, note = excluded.note, updated_by = excluded.updated_by, updated_at = excluded.updated_at')
      .run(m.id, b.series ? 1 : 0, b.for_others ? 1 : 0, b.all_labels ? 1 : 0, JSON.stringify(b.all_labels ? [] : ls), txt(b.note, 120) || null, uname(req), nowTs());
    ctx.audit(req.user, 'Buchungssystem: Sonderrechte', `${m.name}: ${[b.series ? 'Serien' : '', b.for_others ? 'für andere buchen' : '', b.all_labels ? 'alle Buchungsarten' : '', ...(b.all_labels ? [] : ls).map(id => labelRow(id).name)].filter(Boolean).join(', ')}`);
    res.json({ ok: true });
  });
  admin.delete('/rights/:id', PE, (req, res) => { db.prepare('DELETE FROM bk_rights WHERE member_id = ?').run(int(req.params.id)); res.json({ ok: true }); });

  /* ---------- Einstellungen ---------- */
  admin.get('/settings', P, (req, res) => res.json(cfg()));
  // Bezeichnungen fürs Protokoll (wie in den Einstellungen)
  const SET_LABELS = { advance_days: 'Vorlauf (Tage im Voraus)', max_open_platz: 'Offene Platzbuchungen je Mitglied', max_open_artikel: 'Offene Gerätebuchungen je Mitglied',
    cancel_before_min: ['Stornieren bis … vor Beginn (Min.)'], max_partners: 'Mitspieler höchstens', max_guests: 'Gäste höchstens', guest_fee_cents: ['Gastgebühr je Gast', 'euro'], max_waits: 'Warteliste: Einträge je Mitglied',
    count_partners: ['Mitspieler zählen beim Kontingent', 'bool'], notify_partners: ['Mitspieler bekommen eine E-Mail', 'bool'], show_names: ['Namen in der Belegung sichtbar', 'bool'],
    show_now: ['„Jetzt auf der Anlage“ in der App', 'bool'], waitlist: ['Warteliste', 'bool'], tablet_booking: ['Am Tablet buchen', 'bool'], allowed_status: ['Wer darf buchen', 'list'], blocked_fees: ['Gesperrte Beitragsarten', 'text'], rules: ['Platzordnung', 'text'] };
  admin.put('/settings', PE, (req, res) => {
    const b = req.body || {};
    const before = cfg();
    const num = (k, min, max) => { if (b[k] !== undefined) SET(k, Math.max(min, Math.min(max, int(b[k])))); };
    num('advance_days', 0, 365); num('max_open_platz', 0, 50); num('max_open_artikel', 0, 50); num('max_partners', 0, 10); num('max_guests', 0, 10);
    num('guest_fee_cents', 0, 100000); num('cancel_before_min', 0, 7 * 24 * 60); num('max_waits', 1, 20);
    for (const k of ['count_partners', 'show_names', 'show_now', 'tablet_booking', 'notify_partners', 'waitlist']) if (b[k] !== undefined) SET(k, b[k] ? '1' : '0');
    if (b.allowed_status !== undefined) SET('allowed_status', (Array.isArray(b.allowed_status) ? b.allowed_status : []).filter(x => ['aktiv', 'passiv', 'ehren', 'ruhend'].includes(x)).join(','));
    if (b.blocked_fees !== undefined) SET('blocked_fees', (Array.isArray(b.blocked_fees) ? b.blocked_fees : []).map(Number).filter(Number.isInteger).slice(0, 50).join(','));
    infoCache.clear();
    if (b.rules !== undefined) SET('rules', String(b.rules).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '').slice(0, 2000));
    const diff = ctx.auditDiff(SET_LABELS, before, cfg());
    if (diff) ctx.audit(req.user, 'Buchungssystem: Einstellungen geändert', diff);
    res.json({ ok: true, settings: cfg() });
  });

  /* für den Kern: Konto zusammengeführt (intoId) oder gelöscht (null) – synchron in der Transaktion des Kerns, vor dem generischen
     Umhängen der Spalten mit Fremdschlüssel (bk_booking.member_id, bk_rights). Hier: Warteliste, Serien und Mitspieler-Listen (JSON). */
  /* Mitglied löschen: kommende Buchungen (auch als Mitspieler), laufende Serien, Warteliste – Vergangenes bleibt als Verlauf */
  ctx.hooks.memberLinks = id => {
    const d0 = today(), out = [];
    const n = db.prepare(`SELECT COUNT(*) n FROM bk_booking b WHERE b.status = 'aktiv' AND b.date >= ? AND (b.member_id = ? OR EXISTS (SELECT 1 FROM json_each(b.partners) j WHERE j.value = ?))`).get(d0, id, id).n;
    if (n) out.push(`${n} ${n === 1 ? 'kommende Buchung' : 'kommende Buchungen'}`);
    const s = db.prepare('SELECT COUNT(*) n FROM bk_series WHERE member_id = ? AND active = 1 AND to_date >= ?').get(id, d0).n;
    if (s) out.push(`${s} ${s === 1 ? 'laufende Serie' : 'laufende Serien'}`);
    if (db.prepare('SELECT 1 FROM bk_wait WHERE member_id = ? AND date >= ?').get(id, d0)) out.push('Auf der Warteliste');
    return out;
  };
  ctx.hooks.memberRemoved = (fromId, intoId) => {
    if (intoId) {
      for (const w of db.prepare('SELECT id FROM bk_wait WHERE member_id = ?').all(fromId)) {
        try { db.prepare('UPDATE bk_wait SET member_id = ? WHERE id = ?').run(intoId, w.id); } catch (e) { db.prepare('DELETE FROM bk_wait WHERE id = ?').run(w.id); }   // steht dort schon
      }
      db.prepare('UPDATE bk_series SET member_id = ? WHERE member_id = ?').run(intoId, fromId);
    } else {
      db.prepare('DELETE FROM bk_wait WHERE member_id = ?').run(fromId);
      db.prepare('UPDATE bk_series SET member_id = NULL WHERE member_id = ?').run(fromId);   // Serie läuft als Vereinstermin weiter
    }
    // Mitspieler: ID ersetzen bzw. entfernen; wird jemand dadurch sein eigener Mitspieler, fällt der Eintrag weg
    const upd = db.prepare('UPDATE bk_booking SET partners = ? WHERE id = ?');
    for (const b of db.prepare(`SELECT id, member_id, partners FROM bk_booking WHERE partners LIKE '%' || ? || '%'`).all(String(fromId))) {
      const list = J(b.partners, []);
      if (!list.includes(fromId)) continue;
      const next = [...new Set(list.map(x => (x === fromId ? intoId : x)))].filter(x => x != null && x !== (intoId && b.member_id === fromId ? intoId : b.member_id));
      upd.run(JSON.stringify(next), b.id);
    }
  };

  /* ---------- Übersicht, Funktionsdatei ---------- */
  ctx.hooks.overview = async () => {
    const d = today(), n = hhmm(nowMin());
    const t = db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE date = ? AND status = 'aktiv' AND type = 'buchung'").get(d).n;
    const nowB = db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE date = ? AND status = 'aktiv' AND start <= ? AND end > ?").get(d, n, n).n;
    // offene Platzgebühren: mit Mitgliederverwaltung alle unbezahlten (eine Abfrage, chargeStatus einmal), ohne: alle Gebühren des laufenden Jahres
    const { rows, tracked } = await feeRows(mv() ? {} : { from: `${d.slice(0, 4)}-01-01` });
    const open = rows.filter(isOpenFee), sum = sumOf(open);
    // Kachel wie beim Verkauf: groß die offenen Gebühren, darunter die Belegung – kein Hinweis-Banner
    return { kpis: [{ l: tracked ? 'Offene Gebühren' : 'Gebühren dieses Jahr', v: euro(sum) }, { l: 'Buchungen heute', v: `${t} · belegt ${nowB} von ${resources().filter(r => r.kind === 'platz').length}` }, { l: 'offene Posten', v: open.length }], alerts: [] };
  };
  /* Push-Anlässe (der Vorstand gibt frei, das Mitglied wählt je Handy) */
  ctx.hooks.pushEvents = () => [
    { id: 'einladung', label: 'Als Mitspieler eingetragen', desc: 'Jemand hat dich bei einer Buchung als Mitspieler eingetragen.', default: true },
    { id: 'aenderung', label: 'Buchung geändert', desc: 'Eine Buchung, bei der du dabei bist, wurde verschoben oder geändert.', default: true },
    { id: 'storno', label: 'Buchung storniert', desc: 'Eine Buchung, bei der du dabei bist, wurde storniert – auch durch den Verein (Platzsperre).', default: true },
    { id: 'warteliste', label: 'Platz frei geworden', desc: 'Ein Termin von deiner Warteliste ist frei geworden.', default: true },
    { id: 'erinnerung', label: 'Erinnerung vor dem Spiel', desc: 'Kurz vor deiner Buchung – an Buchende und Mitspieler.', default: true, lead: { default: 120, label: 'Vorlauf' } },
  ];
  try { db.exec('ALTER TABLE bk_booking ADD COLUMN reminded INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* gibt es schon */ }
  async function remind() {
    if (!ctx.isActive() || !ctx.push || !ctx.push.enabled('erinnerung')) return;
    const lead = ctx.push.lead('erinnerung') || 120;
    const d = today(), nowM = nowMin(), from = nowM, to = nowM + lead;
    const rows = db.prepare("SELECT * FROM bk_booking WHERE status = 'aktiv' AND type = 'buchung' AND date = ? AND reminded = 0 AND member_id IS NOT NULL").all(d)
      .filter(b => { const st = tm(b.start); return st >= from && st <= to; });
    for (const b of rows) {
      db.prepare('UPDATE bk_booking SET reminded = 1 WHERE id = ?').run(b.id);
      const r = resource(b.resource_id) || { name: 'Platz' };
      const ids = [b.member_id, ...J(b.partners, [])];
      await ctx.push.send(ids, 'erinnerung', { title: `Gleich: ${r.name} um ${b.start} Uhr`, body: `Deine Buchung ${r.name} ${deD(b.date)} ${b.start}–${b.end} Uhr${J(b.partners, []).length ? ' – mit ' + J(b.partners, []).map(nameOf).join(', ') : ''}`, url: './#buchung', tag: `buchung-erinnerung-${b.id}` }).catch(() => {});
    }
  }
  setInterval(() => remind().catch(() => {}), process.env.CW_TEST_FAST ? 1500 : 60000).unref();
  setTimeout(() => remind().catch(() => {}), 5000).unref();
  ctx.hooks.exportConfig = () => ({ labels: db.prepare('SELECT name, color, sort, active, use_mode, use_functions, free_rules FROM bk_label').all().map(l => ({ ...l, use_functions: J(l.use_functions, []) })), settings: Object.fromEntries(Object.keys(DEF).filter(k => k !== 'blocked_fees').map(k => [k, S(k, DEF[k])])),
    resources: db.prepare('SELECT kind, name, area, note, days, open_from, open_to, slot_min, max_min, quantity, guest_fee_cents, outsiders, outsider_fee_cents, active, sort, partner_required, solo_label, as_partner FROM bk_resource WHERE deleted = 0').all() });
  ctx.hooks.importConfig = d => {
    if (!d || typeof d !== 'object') throw new Error('Leere Funktionsdatei.');
    for (const [k, v] of Object.entries(d.settings || {})) if (k in DEF && k !== 'blocked_fees' && typeof v === 'string') SET(k, v.slice(0, 2000));
    let n = 0;
    for (const r of Array.isArray(d.resources) ? d.resources.slice(0, 100) : []) {
      if (!r || db.prepare('SELECT 1 FROM bk_resource WHERE deleted = 0 AND lower(name) = lower(?)').get(String(r.name || ''))) continue;
      const x = resInput(r); if (x.error) continue;
      const k = Object.keys(x.v); db.prepare(`INSERT INTO bk_resource(${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map(y => x.v[y])); n++;
    }
    for (const l of Array.isArray(d.labels) ? d.labels.slice(0, 50) : []) { const x = labelInput(l || {}); if (!x.error && !db.prepare('SELECT 1 FROM bk_label WHERE lower(name) = lower(?)').get(x.v.name)) db.prepare('INSERT INTO bk_label(name, color, sort, active, use_mode, use_functions, use_members, free_rules) VALUES (?,?,?,?,?,?,?,?)').run(x.v.name, x.v.color, x.v.sort, x.v.active, x.v.use_mode, x.v.use_functions, '[]', x.v.free_rules); }
    return `Einstellungen und ${n} Plätze/Geräte übernommen`;
  };
  // Warteliste aufräumen (vergangene Tage)
  setInterval(() => { try { db.prepare('DELETE FROM bk_wait WHERE date < ?').run(today()); } catch (e) { /* */ } }, 6 * 3600 * 1000).unref();
}

module.exports = { activate };
