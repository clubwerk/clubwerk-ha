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
  C = ctx;
  const db = ctx.db;
  tables(db);
  const { need, bad, int, rateLimit } = ctx;
  const S = (k, d = '') => ctx.getSetting('ext_buchung_' + k, d);
  const SET = (k, v) => ctx.setSetting('ext_buchung_' + k, String(v));
  const ALL = ['buchung', 'buchung_buchen', 'buchung_stornieren', 'buchung_serien', 'buchung_einstellungen'];
  const P = need(...ALL);                                   // Belegung ansehen (jedes Recht des Moduls)
  const PB = need('buchung_buchen'), PS = need('buchung_serien'), PX = need('buchung_stornieren'), PE = need('buchung_einstellungen');
  const may = (req, p) => req.user.perms.includes(p);
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
    if (!lc.includes('free_rules')) db.exec('ALTER TABLE bk_label ADD COLUMN free_rules INTEGER NOT NULL DEFAULT 0'); }   // Vereinstermin: ohne Höchstdauer, Kontingent, Vorlauf, Gebühren
  const admin = ctx.admin, T = ctx.tablet, M = ctx.member;
  const uname = req => req.user.name || req.user.username;
  const ar = fn => ctx.asyncRoute(fn);
  const mv = () => ctx.isModuleActive('mitglieder');
  const hook = async (name, ...a) => { const r = await ctx.callHooks(name, ...a); const x = r.find(y => y.id === 'mitglieder'); return x ? x.result : null; };

  const DEF = { advance_days: '7', max_open_platz: '2', max_open_artikel: '2', count_partners: '1', max_partners: '3', max_guests: '3', guest_fee_cents: '500',
    cancel_before_min: '0', show_names: '1', rules: '', tablet_booking: '1', notify_partners: '1', waitlist: '1', max_waits: '3',
    allowed_status: 'aktiv,ehren', blocked_fees: '' };
  const cfg = () => {
    const n = k => { const v = parseInt(S(k, DEF[k]), 10); return Number.isFinite(v) ? v : parseInt(DEF[k], 10); };
    return { advance_days: n('advance_days'), max_open_platz: n('max_open_platz'), max_open_artikel: n('max_open_artikel'), count_partners: S('count_partners', '1') === '1',
      max_partners: n('max_partners'), max_guests: n('max_guests'), guest_fee_cents: n('guest_fee_cents'), cancel_before_min: n('cancel_before_min'),
      show_names: S('show_names', '1') === '1', rules: S('rules', ''), tablet_booking: S('tablet_booking', '1') === '1', notify_partners: S('notify_partners', '1') === '1',
      waitlist: S('waitlist', '1') === '1', max_waits: n('max_waits'),
      allowed_status: S('allowed_status', DEF.allowed_status).split(',').filter(Boolean), blocked_fees: S('blocked_fees', '').split(',').map(Number).filter(Boolean) };
  };
  // Labels (Kennzeichnung von Vereinsbuchungen, z. B. Training, Medenspiel) – Vorlagen beim ersten Start
  if (S('labels_seeded') !== '1') {
    if (!db.prepare('SELECT 1 FROM bk_label').get()) { const ins = db.prepare('INSERT INTO bk_label(name, color, sort) VALUES (?,?,?)');
      [['Training', '#2f6fd6'], ['Medenspiel', '#e07b16'], ['Turnier', '#8a4fd6'], ['Kurs', '#1f9a6b'], ['Platzpflege', '#7a7f87']].forEach(([n, c], i) => ins.run(n, c, (i + 1) * 10)); }
    SET('labels_seeded', '1');
  }
  const labels = (all = false) => db.prepare(`SELECT * FROM bk_label ${all ? '' : 'WHERE active = 1'} ORDER BY sort, name COLLATE NOCASE`).all();
  const labelOf = id => (id ? db.prepare('SELECT id, name, color FROM bk_label WHERE id = ?').get(id) : null);
  const labelRow = id => (id ? db.prepare('SELECT * FROM bk_label WHERE id = ?').get(int(id)) : null);
  /** aktuelle Ämter eines Mitglieds (Mitgliederverwaltung → Ehrungen & Ämter), klein geschrieben */
  const functionsOf = mid => { try { const d = today(); return db.prepare('SELECT name FROM mv_function WHERE member_id = ? AND (from_date IS NULL OR from_date <= ?) AND (to_date IS NULL OR to_date >= ?)').all(mid, d, d).map(x => String(x.name).trim().toLowerCase()); } catch (e) { return []; } };
  const functionNames = () => { try { return [...new Set(db.prepare('SELECT name FROM mv_function').all().map(x => String(x.name).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de')); } catch (e) { return []; } };
  /** Sonderrechte einzelner Mitglieder in der App (Serien anlegen, bestimmte Labels) */
  const rightsOf = mid => { const r = mid ? db.prepare('SELECT * FROM bk_rights WHERE member_id = ?').get(mid) : null; return { series: Boolean(r && r.series), labels: r ? J(r.labels, []).map(Number) : [] }; };
  /** darf dieses Mitglied (App, Tablet) mit dem Label buchen? */
  const labelForMember = (l, mid) => {
    if (!l || !l.active || !mid) return false;
    if (l.use_mode === 'alle' || rightsOf(mid).labels.includes(l.id)) return true;
    if (l.use_mode !== 'auswahl') return false;
    if (J(l.use_members, []).map(Number).includes(mid)) return true;
    const f = J(l.use_functions, []).map(x => String(x).trim().toLowerCase()); if (!f.length) return false;
    return functionsOf(mid).some(x => f.includes(x));
  };
  /** in der Verwaltung: „Plätze, Labels & Einstellungen“ darf alle; sonst wie das verknüpfte Mitglied (bei „nur bestimmte“) */
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
  const lastFirst = n => { const x = ctx.require('./db').splitPersonName(n); return x.first ? `${x.last}, ${x.first}` : x.last; };   // Anzeige „Nachname, Vorname“
  const nameOf = id => (db.prepare('SELECT name FROM members WHERE id = ?').get(id) || {}).name || '?';
  const bview = (b, { me = null, names = true, full = false } = {}) => {
    const partners = J(b.partners, []), guests = normGuests(J(b.guests, []));
    const mine = me != null && (b.member_id === me || partners.includes(me));
    const show = full || mine || (names && b.type === 'buchung');
    const lab = labelOf(b.label_id);
    const out = { id: b.id, resource_id: b.resource_id, date: b.date, start: b.start, end: b.end, type: b.type, label: lab ? { name: lab.name, color: lab.color } : null, title: b.type === 'buchung' && !lab ? null : (b.title || (lab && lab.name) || null), mine, own: me != null && b.member_id === me,
      who: show && b.type === 'buchung' ? [b.member_id ? nameOf(b.member_id) : (b.title || (lab && lab.name) || 'Verein'), ...partners.map(nameOf), ...guests.map(guestLabel)] : null };
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
    return db.prepare(`SELECT b.id, b.member_id, b.partners FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.status = 'aktiv' AND b.type = 'buchung' AND r.kind = ? AND b.id != ?
      AND (b.date > ? OR (b.date = ? AND b.end > ?))`).all(kind, exceptId, d, d, n)
      .filter(b => b.member_id === mid || (cfg().count_partners && J(b.partners, []).includes(mid))).length;
  }
  /** gleiche Person zur gleichen Zeit schon gebucht (gleiche Art)? */
  function personBusy(mid, kind, date, s, e, exceptId = 0) {
    return db.prepare(`SELECT b.member_id, b.partners FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.status = 'aktiv' AND b.type = 'buchung' AND r.kind = ? AND b.date = ? AND b.start < ? AND b.end > ? AND b.id != ?`)
      .all(kind, date, hhmm(e), hhmm(s), exceptId).some(b => b.member_id === mid || J(b.partners, []).includes(mid));
  }
  /** Gäste: [{ name, partner }] – partner = Mitglied eines Partnervereins (keine Gastgebühr); alte Einträge waren nur Namen */
  const normGuests = list => (Array.isArray(list) ? list : []).map(g => (typeof g === 'string' ? { name: txt(g, 60), partner: false } : { name: txt(g && g.name, 60), partner: Boolean(g && g.partner) })).filter(g => g.name);
  /** Kurze, übersichtliche Zusammenfassung einer Buchung für E-Mails */
  const summary = b => {
    const r = resource(b.resource_id) || { name: 'Platz' };
    const players = [b.member_id ? nameOf(b.member_id) : null, ...J(b.partners, []).map(nameOf)].filter(Boolean);
    const guests = normGuests(J(b.guests, []));
    return [`Platz:     ${r.name}`, `Wann:      ${WD[isoDow(b.date)]}, ${deD(b.date)} · ${b.start}–${b.end} Uhr`, `Gebucht von: ${b.member_id ? nameOf(b.member_id) : 'Verein'}`,
      `Spieler:   ${players.join(', ')}${guests.length ? `, ${guests.map(guestLabel).join(', ')}` : ''}`];
  };
  /** Mitspieler (und ggf. Bucher) informieren – Buchung oder Storno */
  function mailPlayers(b, kind, { by = null, reason = '', toBooker = false, old = null } = {}) {
    if (!cfg().notify_partners) return;
    const ids = [...new Set([...(toBooker && b.member_id ? [b.member_id] : []), ...J(b.partners, [])])].filter(id => id !== by);
    if (!ids.length) return;
    const r = resource(b.resource_id) || { name: 'Platz' };
    const when = `${r.name} am ${WD[isoDow(b.date)]} ${deD(b.date)} um ${b.start} Uhr`;
    const head = kind === 'storno' ? `Storniert: ${when}` : kind === 'aenderung' ? `Geändert: ${when}` : when;
    const ro = old ? resource(old.resource_id) || r : null;
    const intro = kind === 'storno' ? `${by ? nameOf(by) : 'Der Verein'} hat diese Buchung storniert${reason ? ` (Grund: ${reason})` : ''}:`
      : kind === 'aenderung' ? `${by ? nameOf(by) : 'Der Verein'} hat die Buchung geändert${old && (old.date !== b.date || old.start !== b.start || old.end !== b.end || old.resource_id !== b.resource_id) ? ` (vorher: ${ro.name}, ${WD[isoDow(old.date)]} ${deD(old.date)} · ${old.start}–${old.end} Uhr)` : ''}. So sieht sie jetzt aus:`
      : `${nameOf(b.member_id)} hat dich als Mitspieler eingetragen:`;
    notify(ids, head, [intro, '', ...summary(b), '', kind === 'storno' ? 'Der Platz ist damit wieder frei.' : 'Viel Spaß beim Spielen! Alle Buchungen siehst du in der Mitglieder-App unter „Buchen“.']).catch(() => {});
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
  const deptName = id => { try { return (db.prepare('SELECT name FROM mv_department WHERE id = ?').get(id) || {}).name || 'Abteilung'; } catch (e) { return 'Abteilung'; } };
  const departments = () => { try { return db.prepare('SELECT id, name FROM mv_department WHERE active = 1 ORDER BY sort, name').all(); } catch (e) { return []; } };
  const feeList = () => { try { return db.prepare("SELECT id, name FROM mv_fee WHERE active = 1 AND kind != 'zusatz' ORDER BY sort, name").all(); } catch (e) { try { return db.prepare('SELECT id, name FROM mv_fee WHERE active = 1 ORDER BY name').all(); } catch (x) { return []; } } };
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
    if (b.label_id && !labelForMember(label, mid)) throw new Error('Dieses Label darfst du nicht verwenden.');
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
    return { r, date, s, e, partners, guests, fee, lines, label, title: label ? txt(b.title, 80) || null : null };
  }

  /**
   * Buchung durch ein Mitglied (App oder Tablet) – alle Regeln.
   * b = { resource_id, date, start, minutes, partners: [ids], guests: [names], accept }
   */
  async function memberBook(mid, b, source) {
    const editId = int(b.id) || 0;
    const old = editId ? db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(editId) : null;
    if (editId) {
      if (!old || old.member_id !== mid || old.type !== 'buchung') throw new Error('Diese Buchung kannst du nicht ändern.');
      if (!canCancelNow(old)) throw new Error('Diese Buchung kann nicht mehr geändert werden.');
    }
    const { r, date, s, e, partners, guests, fee, lines, label, title } = await check(mid, b, { exceptId: editId });
    let id = editId;
    db.transaction(() => {   // Prüfen und Eintragen in einem Schritt: zwei gleichzeitige Buchungen können sich nicht überholen
      if (!free(r, date, s, e, editId)) throw new Error('Gerade eben hat jemand anderes gebucht – bitte eine andere Zeit wählen.');
      if (old) db.prepare('UPDATE bk_booking SET resource_id = ?, date = ?, start = ?, end = ?, partners = ?, guests = ?, fee_cents = ?, label_id = ?, title = ?, charge_id = NULL WHERE id = ?')
        .run(r.id, date, hhmm(s), hhmm(e), JSON.stringify(partners), JSON.stringify(guests), fee, label ? label.id : null, title, id);
      else id = Number(db.prepare('INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, partners, guests, fee_cents, source, created_by, label_id, title) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(r.id, date, hhmm(s), hhmm(e), 'buchung', mid, JSON.stringify(partners), JSON.stringify(guests), fee, source, nameOf(mid), label ? label.id : null, title).lastInsertRowid);
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
      mailChange(old, now, { by: mid });
      if (old.start !== now.start || old.end !== now.end || old.date !== now.date || old.resource_id !== now.resource_id) await wakeWaitlist(old);
    } else if (partners.length) mailPlayers(now, 'buchung');
    return { id, fee_cents: fee, lines };
  }
  /** Änderung: neue Mitspieler bekommen die normale Buchungs-Mail, entfernte eine Storno-Mail, gebliebene (und ggf. der Bucher) eine Änderungs-Mail */
  function mailChange(old, now, { by = null, toBooker = false } = {}) {
    if (!cfg().notify_partners) return;
    const a = J(old.partners, []), b = J(now.partners, []);
    const added = b.filter(x => !a.includes(x)), removed = a.filter(x => !b.includes(x)), kept = b.filter(x => a.includes(x));
    if (added.length) mailPlayers({ ...now, partners: JSON.stringify(added) }, 'buchung');
    if (removed.length) mailPlayers({ ...old, partners: JSON.stringify(removed) }, 'storno', { by });
    const moved = old.date !== now.date || old.start !== now.start || old.end !== now.end || old.resource_id !== now.resource_id;
    if (moved || old.guests !== now.guests || added.length || removed.length) mailPlayers({ ...now, partners: JSON.stringify(kept) }, 'aenderung', { by, toBooker, old });
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
      slot_min: r.slot_min, max_min: r.max_min, quantity: r.quantity, department: r.department_id ? deptName(r.department_id) : null, outsiders: r.outsiders, outsider_fee_cents: r.outsider_fee_cents, open_today: String(r.days).includes(String(isoDow(date))), guest_fee_cents: feeOf(r), active: Boolean(r.active), days: r.days })),
      bookings: dayBookings(date).filter(b => rs.some(r => r.id === b.resource_id)).map(b => bview(b, { me, names: c.show_names, full })),
      waits: me != null ? db.prepare('SELECT id, resource_id, start, end FROM bk_wait WHERE member_id = ? AND date = ?').all(me, date) : [] };
  }
  const myUpcoming = mid => {
    const d = today(), n = hhmm(nowMin());
    return db.prepare(`SELECT b.*, r.name AS rname, r.kind FROM bk_booking b JOIN bk_resource r ON r.id = b.resource_id WHERE b.status = 'aktiv' AND b.type = 'buchung' AND (b.date > ? OR (b.date = ? AND b.end > ?)) ORDER BY b.date, b.start`).all(d, d, n)
      .filter(b => b.member_id === mid || J(b.partners, []).includes(mid)).map(b => ({ ...bview(b, { me: mid, full: false }), resource: b.rname, kind: b.kind, fee_cents: b.member_id === mid ? b.fee_cents : 0,
        canCancel: b.member_id === mid && canCancelNow(b), canEdit: b.member_id === mid && canCancelNow(b), ics: icsUrl(b.id),
        ...(b.member_id === mid ? { edit: { resource_id: b.resource_id, partners: J(b.partners, []), guests: normGuests(J(b.guests, [])), label_id: b.label_id || null, title: b.label_id ? b.title || '' : '' } } : {}) }));
  };
  const canCancelNow = b => { const lim = cfg().cancel_before_min; const st = Date.parse(`${b.date}T${b.start}:00`); return Date.now() <= st - lim * 60000; };

  /* ---------- Kalender (.ics) – Link mit Prüfsumme, damit das Handy ihn ohne Anmeldung öffnen kann ---------- */
  const crypto = require('crypto');
  if (!S('ics_key')) SET('ics_key', crypto.randomBytes(24).toString('hex'));
  const icsToken = id => crypto.createHmac('sha256', S('ics_key')).update('bk' + id).digest('hex').slice(0, 32);
  const icsUrl = id => `api/p/buchung/ics/${id}?k=${icsToken(id)}`;
  const utc = (d, t) => new Date(`${d}T${t === '24:00' ? '23:59' : t}:00`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const icsEsc = v => String(v || '').replace(/\\/g, '\\\\').replace(/[;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
  ctx.public.get('/ics/:id', (req, res) => {
    const id = int(req.params.id), k = String(req.query.k || '');
    const ok = k.length === 32 && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(icsToken(id)));
    const b = ok ? db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(id) : null;
    if (!b) return res.status(404).type('text/plain; charset=utf-8').send('Diese Buchung gibt es nicht (mehr).');
    const r = resource(b.resource_id) || { name: 'Platz' };
    const players = [b.member_id ? nameOf(b.member_id) : null, ...J(b.partners, []).map(nameOf), ...normGuests(J(b.guests, [])).map(g => g.name)].filter(Boolean);
    const club = ctx.getSetting('club_name', 'Verein');
    const addr = [ctx.getSetting('ext_mitglieder_club_street', ''), ctx.getSetting('ext_mitglieder_club_city', '')].filter(Boolean).join(', ');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Clubwerk//Buchung//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:bk-${b.id}@clubwerk`, `DTSTAMP:${utc(today(), hhmm(nowMin()))}`, `DTSTART:${utc(b.date, b.start)}`, `DTEND:${utc(b.date, b.end)}`,
      `SUMMARY:${icsEsc(`${r.name} – ${club}`)}`, `LOCATION:${icsEsc(addr ? `${club}, ${addr}` : club)}`, `DESCRIPTION:${icsEsc(`Spieler: ${players.join(', ')}`)}`,
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(r.name)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
    res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="buchung-${b.date}.ics"`, 'Cache-Control': 'no-store' }).send(ics);
  });

  /* ================================================================= Mitglieder-App (/api/m/buchung/…) */
  M.post('/quote', rateLimit('bkq', 120, 60000), ar(async (req, res) => {   // Preisvorschau vor dem Buchen
    const b = req.body || {}, own = int(b.id) ? db.prepare("SELECT id FROM bk_booking WHERE id = ? AND member_id = ? AND status = 'aktiv'").get(int(b.id), req.member.id) : null;
    try { const q = await check(req.member.id, b, { dry: true, exceptId: own ? own.id : 0 }); res.json({ ok: true, fee_cents: q.fee, lines: q.lines }); } catch (e) { res.json({ ok: false, error: e.message }); }
  }));
  M.get('/me', ar(async (req, res) => {
    const mid = req.member.id, c = cfg();
    const date = isDate(req.query.date) ? req.query.date : today();
    const max = addDays(today(), c.advance_days);
    res.json({ today: today(), now: hhmm(nowMin()), max, settings: { advance_days: c.advance_days, max_partners: c.max_partners, max_guests: c.max_guests, rules: c.rules, waitlist: c.waitlist,
      max_open_platz: c.max_open_platz, max_open_artikel: c.max_open_artikel, cancel_before_min: c.cancel_before_min },
      plan: date >= today() && date <= max ? dayPlan(date, { me: mid }) : { date, resources: [], bookings: [], waits: [] },
      mine: myUpcoming(mid), waits: db.prepare(`SELECT w.id, w.date, w.start, w.end, w.notified_at, r.name AS resource FROM bk_wait w JOIN bk_resource r ON r.id = w.resource_id WHERE w.member_id = ? AND w.date >= ? ORDER BY w.date, w.start`).all(mid, today()),
      people: (await eligiblePeople(mid)).map(p => ({ ...p, ln: lastFirst(p.name) })), blocked: await notAllowed(mid),
      labels: labels().filter(l => labelForMember(l, mid)).map(l => ({ id: l.id, name: l.name, color: l.color, free_rules: Boolean(l.free_rules) })),
      rights: { series: rightsOf(mid).series },
      series: rightsOf(mid).series ? db.prepare("SELECT * FROM bk_series WHERE member_id = ? AND active = 1 AND to_date >= ? AND type = 'serie' ORDER BY from_date").all(mid, today()).map(x => ({ id: x.id, title: x.title, weekdays: x.weekdays, start: x.start, end: x.end, from_date: x.from_date, to_date: x.to_date,
        resources: J(x.resources, []).map(id => (resource(id) || {}).name).filter(Boolean), count: db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE series_id = ? AND status = 'aktiv' AND date >= ?").get(x.id, today()).n })) : [] });
  }));
  M.post('/book', rateLimit('bkapp', 60, 60000), ar(async (req, res) => {
    try { const r = await memberBook(req.member.id, req.body || {}, 'app'); res.json({ ok: true, ...r, ics: icsUrl(r.id) }); } catch (e) { bad(res, e.message); }
  }));
  M.post('/cancel', rateLimit('bkapp', 60, 60000), ar(async (req, res) => {
    const b = db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int((req.body || {}).id));
    if (!b || b.member_id !== req.member.id || b.type !== 'buchung') return bad(res, 'Diese Buchung kannst du nicht stornieren.');
    if (!canCancelNow(b)) return bad(res, cfg().cancel_before_min ? `Stornieren geht nur bis ${cfg().cancel_before_min} Minuten vor Beginn.` : 'Die Buchung hat schon begonnen.');
    await cancel(b, req.member.name);
    mailPlayers(b, 'storno', { by: req.member.id });
    res.json({ ok: true });
  }));
  /* Serien in der App – nur mit Sonderrecht (Verwaltung → Buchungssystem → Einstellungen → Sonderrechte) */
  M.post('/series', rateLimit('bkser', 20, 60000), ar(async (req, res) => {
    const mid = req.member.id, b = req.body || {};
    if (!rightsOf(mid).series) return bad(res, 'Serien anlegen darfst du nicht – bitte bei der Verwaltung melden.', 403);
    const why = await notAllowed(mid); if (why) return bad(res, why);
    const r = resource(b.resource_id); if (!r || !r.active) return bad(res, 'Diesen Platz gibt es nicht (mehr).');
    const label = b.label_id ? labelRow(b.label_id) : null;
    if (b.label_id && !labelForMember(label, mid)) return bad(res, 'Dieses Label darfst du nicht verwenden.');
    const s = tm(b.start), e = s == null ? null : s + int(b.minutes);
    if (!isDate(b.date) || b.date < today()) return bad(res, 'Bitte einen Tag ab heute wählen.');
    const ge = gridError(r, b.date, s, e, { noMax: Boolean(label && label.free_rules) }); if (ge) return bad(res, ge);
    if (!isDate(b.until) || b.until < b.date) return bad(res, 'Bitte angeben, bis wann die Serie läuft.');
    if (addDays(b.date, 366) < b.until) return bad(res, 'Höchstens ein Jahr am Stück.');
    const title = (label && txt(b.title, 80)) || (label ? label.name : `${nameOf(mid)} (Serie)`);
    const sx = { type: 'serie', title, resources: JSON.stringify([r.id]), weekdays: String(isoDow(b.date)), start: hhmm(s), end: hhmm(e), from_date: b.date, to_date: b.until, member_id: mid, note: null, label_id: label ? label.id : null };
    const days = seriesDays(sx);
    const busy = d => db.prepare("SELECT 1 FROM bk_booking WHERE resource_id = ? AND date = ? AND status = 'aktiv' AND start < ? AND end > ?").get(r.id, d, hhmm(e), hhmm(s));
    if (b.preview) return res.json({ days: days.length, busy: days.filter(busy).map(deD) });
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
  M.post('/wait', rateLimit('bkapp', 60, 60000), (req, res) => {
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
    res.json({ today: today(), now: hhmm(nowMin()), booking: c.tablet_booking, rules: c.rules, max_partners: c.max_partners, max_guests: c.max_guests, plan: dayPlan(today(), { me: null }),
      people: c.tablet_booking ? db.prepare("SELECT id, name, pin_hash IS NOT NULL AS pin FROM members WHERE kind = 'mitglied' AND active = 1 AND deleted = 0 AND pending = 0 ORDER BY name_key(name, kind)").all().filter(p => ok.has(p.id)).map(p => ({ ...p, ln: lastFirst(p.name), ph: photos.version(p.id, 'buchung') })) : [] });
  }));
  const tabletMember = (req, res) => {
    const mid = ctx.auth.checkTabletToken((req.body || {}).token);
    if (!mid || typeof mid !== 'number') { bad(res, 'Sitzung abgelaufen – bitte Namen neu wählen.', 401); return null; }
    return mid;
  };
  T.post('/quote', rateLimit('bktab', 120, 60000), ar(async (req, res) => {
    const mid = ctx.auth.checkTabletToken((req.body || {}).token);
    if (!mid || typeof mid !== 'number') return bad(res, 'Sitzung abgelaufen – bitte Namen neu wählen.', 401);
    try { const q = await check(mid, { ...(req.body || {}), date: today() }, { dry: true }); res.json({ ok: true, fee_cents: q.fee, lines: q.lines }); } catch (e) { res.json({ ok: false, error: e.message }); }
  }));
  T.post('/book', rateLimit('bktab', 60, 60000), ar(async (req, res) => {
    if (!cfg().tablet_booking) return bad(res, 'Buchen am Tablet ist ausgeschaltet.');
    const mid = tabletMember(req, res); if (!mid) return;
    const b = req.body || {};
    if (b.date && b.date !== today()) return bad(res, 'Am Tablet wird nur für heute gebucht.');
    try { const r = await memberBook(mid, { ...b, id: 0, date: today() }, 'tablet'); ctx.auth.dropTabletToken(b.token); res.json({ ok: true, ...r }); } catch (e) { bad(res, e.message); }
  }));
  T.post('/cancel', rateLimit('bktab', 60, 60000), ar(async (req, res) => {
    const mid = tabletMember(req, res); if (!mid) return;
    const b = db.prepare("SELECT * FROM bk_booking WHERE id = ? AND status = 'aktiv'").get(int((req.body || {}).id));
    if (!b || b.member_id !== mid || b.type !== 'buchung') return bad(res, 'Diese Buchung kannst du nicht stornieren.');
    if (!canCancelNow(b)) return bad(res, 'Stornieren geht jetzt nicht mehr.');
    await cancel(b, nameOf(mid)); ctx.auth.dropTabletToken(req.body.token);
    mailPlayers(b, 'storno', { by: mid });
    res.json({ ok: true });
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
    if (b.label_id && !label) return bad(res, 'Dieses Label gibt es nicht.');
    if (label && !(old && old.label_id === label.id) && !labelForUser(req, label)) return bad(res, `Das Label „${label.name}“ dürfen nur bestimmte Personen verwenden.`, 403);
    const title = txt(b.title, 80) || (label ? label.name : '');
    if (type === 'sperre' && title.length < 2) return bad(res, 'Bitte einen Grund für die Sperre eintragen (z. B. „Platzpflege“).');
    if (type === 'buchung' && !mid && title.length < 2) return bad(res, 'Bitte ein Mitglied wählen, ein Label wählen oder einen Titel eintragen (z. B. „Training Jugend“).');
    const partners = [...new Set((Array.isArray(b.partners) ? b.partners : []).map(Number))].filter(x => x !== (mid && mid.id) && memberRow(x));
    const guests = normGuests(b.guests).filter(g => g.name.length >= 3).slice(0, 10);
    const conflicts = db.prepare("SELECT * FROM bk_booking WHERE resource_id = ? AND date = ? AND status = 'aktiv' AND start < ? AND end > ? AND id != ?").all(r.id, b.date, hhmm(e), hhmm(s), editId);
    let id = editId;
    try {
      db.transaction(() => {
        if (type === 'buchung' && !free(r, b.date, s, e, editId)) throw new Error('Zu dieser Zeit ist schon gebucht.');
        if (type === 'sperre' && conflicts.length && !b.force) throw Object.assign(new Error(`${conflicts.length} Buchung(en) liegen in dieser Zeit.`), { conflicts });
        if (old) db.prepare('UPDATE bk_booking SET resource_id = ?, date = ?, start = ?, end = ?, member_id = ?, partners = ?, guests = ?, title = ?, note = ?, label_id = ? WHERE id = ?')
          .run(r.id, b.date, hhmm(s), hhmm(e), mid ? mid.id : null, JSON.stringify(partners), JSON.stringify(guests), title || null, txt(b.note, 300) || null, label ? label.id : null, id);
        else id = Number(db.prepare('INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, partners, guests, fee_cents, title, note, source, created_by, label_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(r.id, b.date, hhmm(s), hhmm(e), type, mid ? mid.id : null, JSON.stringify(partners), JSON.stringify(guests), 0, title || null, txt(b.note, 300) || null, 'verwaltung', uname(req), label ? label.id : null).lastInsertRowid);
      })();
    } catch (x) { return res.status(x.conflicts ? 409 : 400).json({ error: x.message, conflicts: (x.conflicts || []).map(c => bview(c, { full: true })) }); }
    if (type === 'sperre' && b.force) for (const c of conflicts.filter(x => x.type !== 'sperre')) {
      await cancel(c, uname(req), `Platz gesperrt: ${title}`);
      if (c.member_id) notify([c.member_id], `Buchung storniert: ${r.name} ${deD(c.date)}`, [`Deine Buchung ${r.name} am ${deD(c.date)} um ${c.start} Uhr musste leider storniert werden.`, `Grund: ${title}`]).catch(() => {});
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
    const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const ST = { storniert: 'storniert', abgeschlossen: 'abgeschlossen', laeuft: 'läuft', anstehend: 'anstehend' };
    const out = ['Datum;Von;Bis;Platz;Art;Label;Titel;Spieler;Gäste;Gebühr;Status;Storniert von;Grund;Eingetragen;Quelle;Von wem'].concat(rows.map(r => [deD(r.date), r.start, r.end, r.resource, TYPE[r.type], r.label ? r.label.name : '', r.title || '', r.people.map(p => p.name).join(' / '), r.guests.join(' / '),
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
    // nach Art: Label, Mitgliederbuchung, Serie ohne Label
    const kinds = new Map();
    c.act.forEach(b => { const l = labelOf(b.label_id); const k = l ? l.name : b.type === 'serie' ? 'Serie ohne Label' : 'Mitgliederbuchung'; const v = kinds.get(k) || { name: k, color: l ? l.color : b.type === 'serie' ? '#7a7f87' : null, minutes: 0, count: 0 }; v.minutes += c.mins(b); v.count++; kinds.set(k, v); });
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
      department_id: int(g('department_id')) || null, outsiders: g('outsiders') === 'gesperrt' ? 'gesperrt' : 'gebuehr', outsider_fee_cents: Math.max(0, Math.min(100000, int(g('outsider_fee_cents')))) };
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
  admin.get('/series', P, (req, res) => res.json(db.prepare('SELECT * FROM bk_series ORDER BY active DESC, to_date DESC, id DESC').all().map(x => ({ ...x, resources: J(x.resources, []), label: labelOf(x.label_id),
    member: x.member_id ? nameOf(x.member_id) : null, count: db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE series_id = ? AND status = 'aktiv' AND date >= ?").get(x.id, today()).n }))));
  function seriesDays(sx) {
    const out = []; const wd = String(sx.weekdays);
    for (let d = sx.from_date, i = 0; d <= sx.to_date && i < 800; d = addDays(d, 1), i++) if (wd.includes(String(isoDow(d)))) out.push(d);
    return out;
  }
  admin.post('/series', PS, ar(async (req, res) => {
    const b = req.body || {};
    const type = b.type === 'sperre' ? 'sperre' : 'serie';
    const label = b.label_id ? labelOf(int(b.label_id)) : null;
    const title = txt(b.title, 80) || (label ? label.name : ''), rs = [...new Set((Array.isArray(b.resources) ? b.resources : []).map(Number))].map(resource).filter(Boolean);
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
    const sx = { type, title, resources: JSON.stringify(rs.map(r => r.id)), weekdays, start: hhmm(s), end: hhmm(e), from_date: b.from_date, to_date: b.to_date, member_id: mid ? mid.id : null, note: txt(b.note, 300) || null, label_id: label ? label.id : null };
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
      if (b0.member_id && b0.type === 'buchung') notify([b0.member_id], `Buchung storniert: ${c.resource} ${deD(b0.date)}`, [`Deine Buchung ${c.resource} am ${deD(b0.date)} um ${b0.start} Uhr musste leider storniert werden.`, `Grund: ${title}`]).catch(() => {});
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

  /* ---------- Labels ---------- */
  const labelInput = b => {
    const arr = v => (Array.isArray(v) ? v : J(v, []));
    const v = { name: txt(b.name, 40), color: /^#[0-9a-f]{6}$/i.test(String(b.color || '')) ? String(b.color).toLowerCase() : '#2f6fd6', sort: int(b.sort) || 100, active: b.active === undefined ? 1 : (b.active ? 1 : 0),
      use_mode: ['alle', 'auswahl'].includes(b.use_mode) ? b.use_mode : 'verwaltung',
      use_functions: JSON.stringify([...new Set(arr(b.use_functions).map(x => txt(x, 60)).filter(Boolean))].slice(0, 30)),
      use_members: JSON.stringify([...new Set(arr(b.use_members).map(Number).filter(x => Number.isInteger(x) && x > 0))].slice(0, 200)),
      free_rules: b.free_rules ? 1 : 0 };
    if (v.name.length < 2) return { error: 'Bitte einen Namen für das Label eintragen (z. B. „Training“).' };
    return { v };
  };
  admin.get('/labels', P, (req, res) => res.json(labels(true).map(l => ({ ...l, use_functions: J(l.use_functions, []), use_members: J(l.use_members, []), free_rules: Boolean(l.free_rules), used: db.prepare("SELECT COUNT(*) n FROM bk_booking WHERE label_id = ? AND status = 'aktiv' AND date >= ?").get(l.id, today()).n }))));
  admin.post('/labels', PE, (req, res) => {
    const r = labelInput(req.body || {}); if (r.error) return bad(res, r.error);
    if (db.prepare('SELECT 1 FROM bk_label WHERE lower(name) = lower(?)').get(r.v.name)) return bad(res, 'Dieses Label gibt es schon.');
    const id = Number(db.prepare('INSERT INTO bk_label(name, color, sort, active, use_mode, use_functions, use_members, free_rules) VALUES (?,?,?,?,?,?,?,?)').run(r.v.name, r.v.color, r.v.sort, r.v.active, r.v.use_mode, r.v.use_functions, r.v.use_members, r.v.free_rules).lastInsertRowid);
    ctx.audit(req.user, 'Buchungssystem: Label angelegt', r.v.name);
    res.json({ id });
  });
  admin.put('/labels/:id', PE, (req, res) => {
    const cur = db.prepare('SELECT * FROM bk_label WHERE id = ?').get(int(req.params.id)); if (!cur) return bad(res, 'Nicht gefunden.', 404);
    const r = labelInput({ ...cur, ...(req.body || {}) }); if (r.error) return bad(res, r.error);
    db.prepare('UPDATE bk_label SET name = ?, color = ?, sort = ?, active = ?, use_mode = ?, use_functions = ?, use_members = ?, free_rules = ? WHERE id = ?').run(r.v.name, r.v.color, r.v.sort, r.v.active, r.v.use_mode, r.v.use_functions, r.v.use_members, r.v.free_rules, cur.id);
    ctx.audit(req.user, 'Buchungssystem: Label geändert', r.v.name);
    res.json({ ok: true });
  });
  admin.delete('/labels/:id', PE, (req, res) => {
    const cur = db.prepare('SELECT * FROM bk_label WHERE id = ?').get(int(req.params.id)); if (!cur) return bad(res, 'Nicht gefunden.', 404);
    if (db.prepare('SELECT 1 FROM bk_booking WHERE label_id = ?').get(cur.id) || db.prepare('SELECT 1 FROM bk_series WHERE label_id = ?').get(cur.id)) return bad(res, 'Das Label wird schon verwendet – stattdessen auf „inaktiv“ setzen.');
    db.prepare('DELETE FROM bk_label WHERE id = ?').run(cur.id); res.json({ ok: true });
  });

  /* ---------- Sonderrechte einzelner Mitglieder (App) ---------- */
  admin.get('/rights', P, (req, res) => res.json(db.prepare('SELECT r.*, m.name FROM bk_rights r JOIN members m ON m.id = r.member_id ORDER BY name_key(m.name, m.kind)').all().map(r => ({ ...r, series: Boolean(r.series), labels: J(r.labels, []) }))));
  admin.put('/rights', PE, (req, res) => {
    const b = req.body || {}; const m = memberRow(b.member_id); if (!m) return bad(res, 'Bitte ein Mitglied wählen.');
    const ls = [...new Set((Array.isArray(b.labels) ? b.labels : []).map(Number))].filter(id => labelRow(id));
    if (!b.series && !ls.length) { db.prepare('DELETE FROM bk_rights WHERE member_id = ?').run(m.id); return res.json({ ok: true, removed: true }); }
    db.prepare('INSERT INTO bk_rights(member_id, series, labels, note, updated_by, updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET series = excluded.series, labels = excluded.labels, note = excluded.note, updated_by = excluded.updated_by, updated_at = excluded.updated_at')
      .run(m.id, b.series ? 1 : 0, JSON.stringify(ls), txt(b.note, 120) || null, uname(req), nowTs());
    ctx.audit(req.user, 'Buchungssystem: Sonderrechte', `${m.name}: ${[b.series ? 'Serien' : '', ...ls.map(id => labelRow(id).name)].filter(Boolean).join(', ')}`);
    res.json({ ok: true });
  });
  admin.delete('/rights/:id', PE, (req, res) => { db.prepare('DELETE FROM bk_rights WHERE member_id = ?').run(int(req.params.id)); res.json({ ok: true }); });

  /* ---------- Einstellungen ---------- */
  admin.get('/settings', P, (req, res) => res.json(cfg()));
  admin.put('/settings', PE, (req, res) => {
    const b = req.body || {};
    const num = (k, min, max) => { if (b[k] !== undefined) SET(k, Math.max(min, Math.min(max, int(b[k])))); };
    num('advance_days', 0, 365); num('max_open_platz', 0, 50); num('max_open_artikel', 0, 50); num('max_partners', 0, 10); num('max_guests', 0, 10);
    num('guest_fee_cents', 0, 100000); num('cancel_before_min', 0, 7 * 24 * 60); num('max_waits', 1, 20);
    for (const k of ['count_partners', 'show_names', 'tablet_booking', 'notify_partners', 'waitlist']) if (b[k] !== undefined) SET(k, b[k] ? '1' : '0');
    if (b.allowed_status !== undefined) SET('allowed_status', (Array.isArray(b.allowed_status) ? b.allowed_status : []).filter(x => ['aktiv', 'passiv', 'ehren', 'ruhend'].includes(x)).join(','));
    if (b.blocked_fees !== undefined) SET('blocked_fees', (Array.isArray(b.blocked_fees) ? b.blocked_fees : []).map(Number).filter(Number.isInteger).slice(0, 50).join(','));
    infoCache.clear();
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
  ctx.hooks.exportConfig = () => ({ labels: db.prepare('SELECT name, color, sort, active, use_mode, use_functions, free_rules FROM bk_label').all().map(l => ({ ...l, use_functions: J(l.use_functions, []) })), settings: Object.fromEntries(Object.keys(DEF).filter(k => k !== 'blocked_fees').map(k => [k, S(k, DEF[k])])),
    resources: db.prepare('SELECT kind, name, area, note, days, open_from, open_to, slot_min, max_min, quantity, guest_fee_cents, outsiders, outsider_fee_cents, active, sort FROM bk_resource WHERE deleted = 0').all() });
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
