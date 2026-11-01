'use strict';
/* ---------- Flutlicht: Licht der Plätze über Home Assistant ----------
   Herstellerneutral: jede Lichtanlage ist ein Schalter in Home Assistant (switch.* oder light.*), genau einer je Platz.
   Schaltprinzip: Eine Lichtanlage brennt, solange mindestens eine „Anforderung“ (Tabelle fl_claim) läuft – aus einer Buchung
   (Automatik), aus der Mitglieder-App, vom Tablet, aus der Verwaltung oder „außerhalb von Clubwerk“ eingeschaltet.
   Jede Anforderung hat ein festes Ende in der Datenbank; ein Zeitgeber gleicht alle 20 s ab (auch direkt nach einem Neustart).
   Nachtruhe: alles aus, was nicht aus der Verwaltung kommt (die Verwaltung darf die Nachtruhe umgehen, mit festem Ende).
   Lichtgeld (optional): beim Ende einer Anforderung – je angefangene Viertelstunde ab einer Uhrzeit, bei der Automatik nur die
   gebuchte Zeit. Gebucht wie die Platzgebühr: Forderung in der Mitgliederverwaltung bzw. aufs Verkaufskonto, mit Storno.
   Mitglieder schalten nur im Vereins-WLAN und nur mit Freischaltung; am Tablet immer mit Namen und App-PIN. */
const crypto = require('crypto');
const L = require('./logik');
const ha = require('../../src/ha');   // Home Assistant (gemeinsam mit Beregnung und Zugang)
const { deD, euro } = require('../../src/util');
let db, getSetting, setSetting, audit, H, lastFirst;
const MOD = 'flutlicht';
const APP = 'app';   // Geräte-Kopplung der Mitglieder-App
const TICK_MS = process.env.CW_TEST_FAST ? 2000 : 20000;
const GRACE_MS = process.env.CW_TEST_FAST ? 3000 : 15000;   // so lange nach einem eigenen Befehl darf Home Assistant noch den alten Zustand melden
const DOMAINS = ['switch', 'light'];
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DEF = {
  lights: [], sun: { source: 'calc', lat: null, lon: null, offset: -30 }, quiet: ['22:00', '22:00', '22:00', '22:00', '22:00', '22:00', '22:00'],
  season: null, blockDays: [], who: { auto: true, app: true, tablet: true }, maxMin: 90, extendMin: 30,
  fee: { on: false, cents: 50, from: '18:00' }, notify: '', header: false,
};
const SOURCE = { auto: 'Automatik', app: 'App', tablet: 'Tablet', verwaltung: 'Verwaltung', extern: 'außerhalb von Clubwerk' };
const REASON = { zeit: 'Zeit abgelaufen', hand: 'ausgeschaltet', 'alles-aus': 'Alles aus', nachtruhe: 'Nachtruhe', storno: 'Buchung storniert', extern: 'außerhalb von Clubwerk ausgeschaltet', gesperrt: 'gesperrt', modul: 'Modul ausgeschaltet' };

function cfg() {
  let c = {};
  try { c = JSON.parse(getSetting('ext_flutlicht_cfg', '{}')) || {}; } catch (e) { c = {}; }
  const out = { ...DEF, ...c, sun: { ...DEF.sun, ...(c.sun || {}) }, who: { ...DEF.who, ...(c.who || {}) }, fee: { ...DEF.fee, ...(c.fee || {}) } };
  if (!Array.isArray(out.lights)) out.lights = [];
  if (!Array.isArray(out.blockDays)) out.blockDays = [];
  if (!Array.isArray(out.quiet) || out.quiet.length !== 7) out.quiet = DEF.quiet.slice();
  return out;
}
const save = c => setSetting('ext_flutlicht_cfg', JSON.stringify(c));
/** Beispieldaten: Schalter werden nur nachgebildet (Einstellung kommt nur aus demo/demo.sql, nie aus Export oder Oberfläche) */
const sim = () => getSetting('ext_flutlicht_sim', '') === '1';
const feeTarget = () => (H.isModuleActive('mitglieder') ? 'mitglieder' : H.drinks && H.drinks.active() ? 'verkauf' : null);

function createTables() {
  db.exec(`
CREATE TABLE IF NOT EXISTS fl_claim (
  id INTEGER PRIMARY KEY,
  light TEXT NOT NULL, light_name TEXT NOT NULL,
  source TEXT NOT NULL,                        -- auto | app | tablet | verwaltung | extern
  member_id INTEGER REFERENCES members(id), who TEXT,
  booking_src TEXT, booking_id INTEGER, book_start TEXT, book_end TEXT, booking_gone_at TEXT,
  pays INTEGER NOT NULL DEFAULT 0,
  start TEXT NOT NULL, planned_end TEXT NOT NULL, ended_at TEXT, end_reason TEXT,
  fee_rate INTEGER, fee_from TEXT, fee_cents INTEGER, fee_quarters INTEGER, charge_id INTEGER, sale_id INTEGER, fee_cancelled_at TEXT, fee_cancelled_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_fl_claim_open ON fl_claim(ended_at, light);
CREATE INDEX IF NOT EXISTS ix_fl_claim_start ON fl_claim(start);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fl_claim_booking ON fl_claim(light, booking_src, booking_id) WHERE booking_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS fl_log (
  id INTEGER PRIMARY KEY, at TEXT NOT NULL, light TEXT, action TEXT NOT NULL, who TEXT, detail TEXT   -- fehler | behoben | nachtruhe | alles-aus | abgelehnt
);
CREATE INDEX IF NOT EXISTS ix_fl_log_at ON fl_log(at);
`);
}
/* Testuhr (nur Testreihe fl, nie in einer Installation gesetzt): CW_TEST_UHR = "JJJJ-MM-TT HH:MM|<echte Zeit in ms>" – die Uhr des Moduls läuft ab dort weiter, auch über einen Neustart */
const TEST_UHR = (() => { const m = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\|(\d+)$/.exec(process.env.CW_TEST_UHR || ''); return m ? L.parse(m[1]).getTime() - Number(m[2]) : 0; })();
const nowD = () => new Date(Date.now() + TEST_UHR);
const log = (action, light, who, detail) => db.prepare('INSERT INTO fl_log(at, light, action, who, detail) VALUES (?,?,?,?,?)').run(L.ts(nowD()), light || null, action, who || null, detail || null);
const notify = text => ha.notify(cfg().notify, 'Flutlicht', text);

/* =================== Dunkelheit =================== */
let sunCache = { day: '', set: null, at: 0 };
/** Sonnenuntergang heute: selbst gerechnet oder aus Home Assistant (sun.sun) */
function sunsetToday(c, st) {
  const day = L.dayOf(nowD());
  if (c.sun.source === 'ha') {
    const s = st && st.get('sun.sun');
    const next = s && s.attributes && s.attributes.next_setting ? new Date(s.attributes.next_setting) : null;
    if (next && !isNaN(next)) {
      // next_setting ist heute (noch nicht untergegangen) oder morgen (schon untergegangen → gestern + 24 h ist eine gute Näherung für heute)
      const set = L.dayOf(next) === day ? next : new Date(next.getTime() - 86400000);
      sunCache = { day, set, at: Date.now() }; return set;
    }
    if (sunCache.day === day && sunCache.set) return sunCache.set;
  }
  if (c.sun.lat === null || c.sun.lon === null) return null;
  return L.sunset(day, c.sun.lat, c.sun.lon);
}
function darkFrom(c, st) { const s = sunsetToday(c, st); return s ? L.addMin(s, c.sun.offset || 0) : null; }

/* =================== Home Assistant =================== */
let cache = { at: 0, states: null, err: null };
async function states(force) {
  if (!force && Date.now() - cache.at < 3000) { if (cache.err) throw cache.err; return cache.states; }
  try { const s = await ha.call('GET', '/states'); const m = new Map((Array.isArray(s) ? s : []).map(x => [x.entity_id, x])); cache = { at: Date.now(), states: m, err: null }; return m; }
  catch (e) { cache = { at: Date.now(), states: null, err: e }; throw e; }
}
async function trySt() { if (sim()) return new Map(); try { return await states(); } catch (e) { return null; } }
const cmd = new Map();   // Lichtanlage → { on, at, seenOn } – letzter Befehl von Clubwerk
async function switchHa(light, on) {
  const dom = light.ref.split('.')[0];
  cmd.set(light.id, { on, at: Date.now(), seenOn: false });
  if (sim()) return;
  await ha.call('POST', `/services/${dom}/${on ? 'turn_on' : 'turn_off'}`, { entity_id: light.ref });
  cache.at = 0;
}
/** Zustand laut Home Assistant: true/false, null = nicht erreichbar */
function haOn(light, st) {
  if (sim()) return null;
  const s = st && st.get(light.ref);
  if (!s || ['unavailable', 'unknown'].includes(s.state)) return null;
  return s.state === 'on';
}

/* =================== Anforderungen =================== */
const openClaims = (lightId = null) => db.prepare(`SELECT * FROM fl_claim WHERE ended_at IS NULL${lightId ? ' AND light = ?' : ''} ORDER BY start`).all(...(lightId ? [lightId] : []));
const activeAt = (claims, nowTs) => claims.filter(c => c.start <= nowTs && c.planned_end > nowTs);
/** Ende des Lichts: spätestes Ende der Anforderungen, die lückenlos an die laufende anschließen */
function lightEnd(claims, nowTs) {
  let end = null;
  for (const c of claims.slice().sort((a, b) => a.start.localeCompare(b.start))) {
    if (c.start <= (end || nowTs) && c.planned_end > nowTs) { if (!end || c.planned_end > end) end = c.planned_end; }
  }
  return end;
}

/** Anforderung beenden und Lichtgeld buchen – genau einmal (Wächter ended_at IS NULL, eine Transaktion) */
function closeClaim(id, endedTs, reason) {
  let charged = null;
  db.transaction(() => {
    const c0 = db.prepare('SELECT * FROM fl_claim WHERE id = ?').get(id);
    if (!c0 || c0.ended_at) return;
    const end = endedTs < c0.start ? c0.start : endedTs;
    if (!db.prepare('UPDATE fl_claim SET ended_at = ?, end_reason = ? WHERE id = ? AND ended_at IS NULL').run(end, reason, id).changes) return;
    const c = { ...c0, ended_at: end };
    const f = L.fee(c);
    db.prepare('UPDATE fl_claim SET fee_cents = ?, fee_quarters = ? WHERE id = ?').run(f.cents, f.quarters, id);
    if (!f.cents || !c.member_id) return;
    const text = `Lichtgeld ${c.light_name} ${deD(c.start.slice(0, 10))} ${c.start.slice(11, 16)}–${(c.ended_at < c.planned_end ? c.ended_at : c.planned_end).slice(11, 16)}`;
    const m = db.prepare('SELECT id, name, kind FROM members WHERE id = ?').get(c.member_id);
    try {
      if (m && m.kind === 'mitglied' && H.isModuleActive('mitglieder')) {
        const r = H.callHooksSync('createCharge', { member_id: m.id, text, cents: f.cents, due_date: c.start.slice(0, 10), kind: 'sonstiges', ext_key: `fl-${id}`, by: 'Flutlicht' }).find(x => x.id === 'mitglieder');
        if (!r || !r.result) throw new Error('Forderung nicht angelegt');
        db.prepare('UPDATE fl_claim SET charge_id = ? WHERE id = ?').run(r.result, id); charged = text;
      } else if (m && H.drinks && H.drinks.active()) {
        const sale = H.drinks.charge(m.id, f.cents, text.slice(0, 60), null);
        db.prepare('UPDATE fl_claim SET sale_id = ? WHERE id = ?').run(sale, id); charged = text;
      } else log('fehler', c.light_name, c.who, `Lichtgeld ${euro(f.cents)} nicht gebucht: kein Konto (Mitglieder oder Verkauf) für ${c.who || 'Person'}`);
    } catch (e) { log('fehler', c.light_name, c.who, `Lichtgeld ${euro(f.cents)} nicht gebucht: ${e.message}`); }
  })();
  return charged;
}

/** neue Anforderung; Lichtgeld-Stand von jetzt wird gemerkt (gilt, auch wenn er sich ändert, solange das Licht brennt) */
function addClaim(light, { source, member_id = null, who = null, start, end, pays = false, booking = null }) {
  const c = cfg();
  const fee = c.fee.on && pays && member_id && feeTarget() ? c.fee : null;
  return Number(db.prepare(`INSERT INTO fl_claim(light, light_name, source, member_id, who, booking_src, booking_id, book_start, book_end, pays, start, planned_end, fee_rate, fee_from)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(light.id, light.name, source, member_id, who, booking ? booking.src : null, booking ? booking.id : null,
    booking ? L.ts(booking.bookStart) : null, booking ? L.ts(booking.bookEnd) : null, pays ? 1 : 0, L.ts(start), L.ts(end), fee ? fee.cents : null, fee ? fee.from : null).lastInsertRowid);
}

/* =================== Zeitgeber =================== */
let lastAuto = 0, busy = false;
const failed = new Map();   // Lichtanlage → letzter Fehlertext (nur einmal ins Protokoll)
async function tick() {
  if (busy) return; busy = true;
  try { await tickInner(); } catch (e) { console.error('Flutlicht:', e.message); } finally { busy = false; }
}
async function tickInner() {
  const c = cfg(), now = nowD(), nowTs = L.ts(now);
  // 1. abgelaufene Anforderungen beenden (auch die, deren Ende während eines Neustarts lag: Lichtgeld bis zum geplanten Ende)
  const ended = [];
  for (const x of db.prepare('SELECT id, light, planned_end, booking_gone_at FROM fl_claim WHERE ended_at IS NULL AND planned_end <= ?').all(nowTs)) { closeClaim(x.id, x.planned_end, x.booking_gone_at ? 'storno' : 'zeit'); ended.push(x.light); }
  // 2. Nachtruhe: alles außer der Verwaltung
  if (L.isQuiet(c, now)) for (const x of db.prepare("SELECT id, light FROM fl_claim WHERE ended_at IS NULL AND source <> 'verwaltung'").all()) { closeClaim(x.id, nowTs, 'nachtruhe'); ended.push(x.light); }
  // Licht, das Clubwerk eingeschaltet hatte (auch vor einem Neustart), gilt als „von Clubwerk an“ – es wird ausgeschaltet, nicht als fremd übernommen
  for (const id of ended) if (!cmd.has(id)) cmd.set(id, { on: true, at: 0, seenOn: true });
  const st = await trySt();
  // 3. Automatik aus der Platzbuchung (höchstens einmal je Minute; im Test bei jedem Durchlauf)
  if (Date.now() - lastAuto >= (process.env.CW_TEST_FAST ? 0 : 55000)) { lastAuto = Date.now(); await automatik(c, now, st); }
  // 4. Abgleich mit Home Assistant
  const open = openClaims();
  for (const light of c.lights) {
    const mine = open.filter(x => x.light === light.id), want = activeAt(mine, nowTs).length > 0;
    const isOn = haOn(light, st), k = cmd.get(light.id), recent = k && Date.now() - k.at < GRACE_MS;
    if (isOn === true && k && k.on) k.seenOn = true;
    try {
      if (sim()) { if (!k || k.on !== want) await switchHa(light, want); continue; }
      if (isOn === null) continue;   // nicht erreichbar → Übersicht meldet es
      if (want && !isOn) {
        if (k && k.on && k.seenOn) {   // war an und ist jetzt aus: außerhalb von Clubwerk ausgeschaltet
          for (const x of activeAt(mine, nowTs)) closeClaim(x.id, nowTs, 'extern');
          cmd.set(light.id, { on: false, at: Date.now(), seenOn: false });
          continue;
        }
        if (!recent || !k.on) await switchHa(light, true);
      } else if (!want && isOn) {
        if (recent && !k.on) continue;   // Ausschalten läuft gerade
        if (L.isQuiet(c, now) || (k && k.on)) { await switchHa(light, false); if (L.isQuiet(c, now) && !(k && k.on)) log('nachtruhe', light.name, null, 'zur Nachtruhe ausgeschaltet'); continue; }
        // außerhalb von Clubwerk eingeschaltet → übernehmen, damit es sicher wieder ausgeht
        const end = new Date(Math.min(L.addMin(now, c.maxMin).getTime(), L.quietStart(c, L.dayOf(now)).getTime()));
        addClaim(light, { source: 'extern', start: now, end });
        cmd.set(light.id, { on: true, at: Date.now(), seenOn: true });
      } else if (want && isOn && (!k || !k.on)) cmd.set(light.id, { on: true, at: Date.now(), seenOn: true });
      if (failed.has(light.id) && haOn(light, await trySt()) === want) { failed.delete(light.id); log('behoben', light.name, null, 'wieder erreichbar'); }   // erst, wenn Home Assistant den gewünschten Zustand meldet
    } catch (e) {
      if (failed.get(light.id) !== e.message) { failed.set(light.id, e.message); log('fehler', light.name, null, e.message); notify(`${light.name}: Licht ließ sich nicht schalten (${e.message}).`); }
    }
  }
}

/** Buchungen von heute → Anforderungen anlegen, nachführen oder (Storno, Verlegen) auslaufen lassen */
async function automatik(c, now, st) {
  if (!H.isModuleActive('buchung')) return;
  const nowTs = L.ts(now), day = L.dayOf(now);
  let bookings = [];
  try { const r = (await H.callHooks('courtSchedule', { from: day, to: day })).find(x => x.id === 'buchung'); bookings = (r && r.result) || []; } catch (e) { return; }
  const want = c.who.auto ? L.autoClaims(c, c.lights, bookings, 'buchung', day, darkFrom(c, st)) : [];
  const key = (l, b) => `${l}|${b}`;
  const wanted = new Map(want.map(w => [key(w.light, w.booking), w]));
  const have = db.prepare("SELECT * FROM fl_claim WHERE booking_src = 'buchung' AND start >= ?").all(day + ' 00:00:00');
  const seen = new Set(have.map(h => key(h.light, h.booking_id)));
  // laufende nachführen bzw. auslaufen lassen
  for (const h of have.filter(x => !x.ended_at)) {
    const w = wanted.get(key(h.light, h.booking_id));
    if (w) {
      const end = L.ts(w.end), bs = L.ts(w.bookStart), be = L.ts(w.bookEnd);
      if (h.planned_end !== end || h.book_start !== bs || h.book_end !== be) db.prepare('UPDATE fl_claim SET planned_end = ?, book_start = ?, book_end = ?, booking_gone_at = NULL WHERE id = ?').run(end, bs, be, h.id);
    } else if (!h.booking_gone_at && c.who.auto) {
      const light = c.lights.find(l => l.id === h.light);
      const end = L.ts(L.addMin(now, light ? light.post || 0 : 0));
      db.prepare('UPDATE fl_claim SET booking_gone_at = ?, planned_end = MIN(planned_end, ?) WHERE id = ?').run(nowTs, end, h.id);
    }
  }
  // neue anlegen, sobald ihre Zeit da ist (einmal je Buchung: was ausgeschaltet wurde, kommt nicht zurück)
  for (const w of want) {
    if (seen.has(key(w.light, w.booking)) || w.start > now || w.end <= now) continue;
    const light = c.lights.find(l => l.id === w.light);
    const m = w.member_id ? db.prepare('SELECT name, kind FROM members WHERE id = ?').get(w.member_id) : null;
    try { addClaim(light, { source: 'auto', member_id: w.pays ? w.member_id : null, who: m ? m.name : null, start: now, end: w.end, pays: w.pays, booking: { src: w.src, id: w.booking, bookStart: w.bookStart, bookEnd: w.bookEnd } }); } catch (e) { /* gleichzeitig angelegt – Eindeutigkeit greift */ }
  }
}

/* =================== Schalten (Verwaltung, App, Tablet) =================== */
const lightById = (c, id) => c.lights.find(l => l.id === String(id || ''));
/** wer schaltet: { kind: 'verwaltung'|'app'|'tablet', member_id, name } */
async function doAction(light, action, who, minutes) {
  const c = cfg(), now = nowD(), nowTs = L.ts(now), admin = who.kind === 'verwaltung';
  if (!admin) {
    const st = await trySt(), why = L.memberBlock(c, now, darkFrom(c, st));
    if (why && action !== 'off') { log('abgelehnt', light.name, who.name, why); throw Object.assign(new Error(why), { status: 403 }); }
  }
  const mine = openClaims(light.id), act = activeAt(mine, nowTs), end = lightEnd(mine, nowTs);
  const cap = d => (admin ? d : new Date(Math.min(d.getTime(), L.quietStart(c, L.dayOf(now)).getTime())));
  const pays = !admin;
  if (action === 'on') {
    if (act.length) throw Object.assign(new Error(`${light.name} ist schon an.`), { status: 409 });
    if (!sim() && haOn(light, await trySt()) === null) throw Object.assign(new Error(`${light.name} ist nicht erreichbar – bitte die Anbindung prüfen.`), { status: 409 });
    const max = admin ? 480 : c.maxMin, min = Math.max(15, Math.min(max, parseInt(minutes, 10) || Math.min(60, max)));
    const until = cap(L.addMin(now, min));
    if (until <= now) throw Object.assign(new Error('Nachtruhe – das Licht bleibt bis morgen aus.'), { status: 403 });
    addClaim(light, { source: who.kind, member_id: who.member_id || null, who: who.name, start: now, end: until, pays });
    await kick(light, true);
    return { until: L.ts(until) };
  }
  if (action === 'extend') {
    if (!act.length || !end) throw Object.assign(new Error(`${light.name} ist aus – bitte einschalten.`), { status: 409 });
    const from = L.parse(end);
    let until = cap(L.addMin(from, c.extendMin));
    if (!admin) until = new Date(Math.min(until.getTime(), L.addMin(now, c.maxMin).getTime()));   // höchstens „am Stück“ ab jetzt
    if (until <= from) throw Object.assign(new Error(admin ? 'Länger geht nicht.' : 'Länger geht es heute nicht – die Nachtruhe beginnt.'), { status: 409 });
    // eigene laufende Anforderung (App/Tablet/Verwaltung), die bis zum Ende reicht → verlängern; sonst neue ab dem Ende (jeder zahlt seine eigene Zeit)
    const own = mine.find(x => x.planned_end === end && x.source === who.kind && (admin ? true : x.member_id === who.member_id) && x.source !== 'auto');
    if (own) db.prepare('UPDATE fl_claim SET planned_end = ? WHERE id = ?').run(L.ts(until), own.id);
    else addClaim(light, { source: who.kind, member_id: who.member_id || null, who: who.name, start: from, end: until, pays });
    return { until: L.ts(until) };
  }
  // Ausschalten: Verwaltung alles; ein Mitglied nur seine eigenen Anforderungen
  const ends = admin ? mine : mine.filter(x => x.member_id && x.member_id === who.member_id && x.source !== 'extern');
  if (!ends.length) throw Object.assign(new Error(act.length ? `${light.name} brennt für jemand anderen – nur die Verwaltung kann es ausschalten.` : `${light.name} ist schon aus.`), { status: 409 });
  for (const x of ends) closeClaim(x.id, x.start > nowTs ? x.start : nowTs, 'hand');
  // spätere Anforderungen anderer rücken an: sonst ginge das Licht bis zu ihrem Beginn aus
  const rest = openClaims(light.id);
  // (gleiche Dauer: wer verlängert hat, bekommt seine Minuten ab jetzt)
  if (rest.length && !activeAt(rest, nowTs).length) {
    const nx = rest[0];
    if (nx.start > nowTs && nx.source !== 'auto') db.prepare('UPDATE fl_claim SET start = ?, planned_end = ? WHERE id = ?').run(nowTs, L.ts(new Date(now.getTime() + (L.parse(nx.planned_end) - L.parse(nx.start)))), nx.id);
  }
  const still = activeAt(openClaims(light.id), nowTs);
  if (!still.length) await kick(light, false);
  return { still: still.length ? lightEnd(openClaims(light.id), nowTs) : null };
}
/** sofort schalten (nicht erst beim nächsten Durchlauf); Fehler → 502 */
async function kick(light, on) {
  try { await switchHa(light, on); }
  catch (e) { if (failed.get(light.id) !== e.message) { failed.set(light.id, e.message); log('fehler', light.name, null, e.message); } throw Object.assign(new Error(`${light.name} reagiert nicht – Clubwerk versucht es weiter. (${e.message})`), { status: 502 }); }
}
async function allOff(by) {
  const c = cfg(), nowTs = L.ts(nowD());
  for (const x of openClaims()) closeClaim(x.id, x.start > nowTs ? x.start : nowTs, 'alles-aus');
  const errs = [];
  for (const l of c.lights) { try { await switchHa(l, false); } catch (e) { errs.push(l.name); log('fehler', l.name, by, e.message); } }
  log('alles-aus', null, by, errs.length ? `nicht erreichbar: ${errs.join(', ')}` : '');
  return errs;
}

/* =================== Anzeige =================== */
const hhmm = t => (t ? t.slice(11, 16) : '');
/** Zustand je Lichtanlage; view = 'admin' (Namen) | 'member' (nur eigene) | 'tablet' (keine Namen) */
async function view(viewer, memberId = null) {
  const c = cfg(), now = nowD(), nowTs = L.ts(now);
  const st = await trySt(), dark = darkFrom(c, st);
  const open = openClaims();
  let courts = {};
  if (H.isModuleActive('buchung')) { const r = (await H.callHooks('courtList')).find(x => x.id === 'buchung'); for (const x of (r && r.result) || []) courts[x.id] = x.name; }
  let next = [];
  if (c.who.auto && H.isModuleActive('buchung')) {
    const r = (await H.callHooks('courtSchedule', { from: L.dayOf(now), to: L.dayOf(now) })).find(x => x.id === 'buchung');
    next = L.autoClaims(c, c.lights, (r && r.result) || [], 'buchung', L.dayOf(now), dark).filter(w => w.start > now);
  }
  const block = L.memberBlock(c, now, dark);
  const lights = c.lights.map(l => {
    const mine = open.filter(x => x.light === l.id), act = activeAt(mine, nowTs), end = lightEnd(mine, nowTs);
    const isOn = haOn(l, st), offline = !sim() && isOn === null;
    const on = act.length > 0;
    const top = act.slice().sort((a, b) => b.planned_end.localeCompare(a.planned_end))[0] || null;
    const nx = next.filter(w => w.light === l.id).sort((a, b) => a.start - b.start)[0] || null;
    let cause = '';
    if (top) {
      if (viewer === 'admin') cause = top.source === 'auto' ? (top.who ? `Buchung ${lastFirst(top.who)}` : 'Vereinsbuchung') : top.source === 'extern' ? 'außerhalb von Clubwerk eingeschaltet' : `${SOURCE[top.source]}: ${top.who ? lastFirst(top.who) : ''}`;
      else cause = top.member_id && top.member_id === memberId ? (top.source === 'auto' ? 'für deine Buchung' : 'von dir eingeschaltet') : top.source === 'auto' ? 'für eine Buchung' : '';
    }
    const nextTxt = nx ? (viewer === 'admin' ? `geht um ${L.hm(nx.start)} Uhr an (${nx.member_id ? 'Buchung' : 'Vereinsbuchung'})` : nx.member_id && nx.member_id === memberId ? `geht um ${L.hm(nx.start)} Uhr für deine Buchung an` : `geht um ${L.hm(nx.start)} Uhr für eine Buchung an`) : '';
    const ownOpen = memberId && mine.some(x => x.member_id === memberId && x.source !== 'extern');
    return { id: l.id, name: l.name, court: l.court ? courts[l.court.id] || null : null, on, offline, until: on ? end : null,
      left: on && end ? Math.max(0, Math.ceil((L.parse(end) - now) / 60000)) : null, cause, next: on ? '' : nextTxt,
      can: viewer === 'admin' ? { on: !on, extend: on, off: on || mine.length > 0 } : { on: !on && !block, extend: on && !block, off: Boolean(ownOpen) },
      reason: viewer === 'admin' ? '' : block || '' };
  });
  return { lights, darkFrom: dark ? L.hm(dark) : null, quiet: c.quiet[now.getDay()], quietNow: L.isQuiet(c, now), block, online: sim() || Boolean(st), sim: sim(),
    fee: c.fee.on && feeTarget() ? { cents: c.fee.cents, from: c.fee.from } : null, maxMin: c.maxMin, extendMin: c.extendMin };
}
/** Ein Lichtgeld-Posten für Anzeige und Liste → Status */
function feeStatus(rows) {
  const ch = rows.filter(r => r.charge_id).map(r => r.charge_id), sa = rows.filter(r => r.sale_id).map(r => r.sale_id);
  let cs = {}, ss = {};
  if (ch.length && H.isModuleActive('mitglieder')) { const r = H.callHooksSync('chargeStatus', ch).find(x => x.id === 'mitglieder'); cs = (r && r.result) || {}; }
  if (sa.length && H.drinks) ss = H.drinks.chargeStatus(sa);
  return r => {
    if (!r.fee_cents) return null;
    if (r.fee_cancelled_at) return 'storniert';
    if (r.charge_id) { const x = cs[r.charge_id]; return x ? x.status : 'offen'; }
    if (r.sale_id) { const x = ss[r.sale_id]; return x === 'abgerechnet' ? 'bezahlt' : x || 'offen'; }
    return 'nicht gebucht';
  };
}

/* =================== Mitglieder-App =================== */
let awayReq = () => false, clubNet = null;
const isLocalIp = ip => (clubNet ? clubNet(ip) : /^(::ffff:)?(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(String(ip || '')) || ip === '::1');
function memberRoutes(r, ctx) {
  r.get('/status', async (req, res) => {
    const v = await view('member', req.member.id), c = cfg();
    const wlan = !(req.away || awayReq(req)) && isLocalIp(req.socket.remoteAddress);
    const mine = v.fee ? db.prepare('SELECT * FROM fl_claim WHERE member_id = ? AND fee_cents > 0 ORDER BY start DESC LIMIT 5').all(req.member.id) : [];
    const stat = feeStatus(mine);
    res.json({ ...v, wlan, app: c.who.app, mine: mine.map(x => ({ light: x.light_name, day: x.start.slice(0, 10), from: hhmm(x.start), to: hhmm(x.ended_at < x.planned_end ? x.ended_at : x.planned_end), auto: x.source === 'auto', cents: x.fee_cents, status: stat(x) })) });
  });
  r.post('/act', ctx.rateLimit('flmact', 12, 60000), async (req, res) => {
    const c = cfg(), b = req.body || {};
    if (req.away || awayReq(req) || !isLocalIp(req.socket.remoteAddress)) return res.status(403).json({ error: 'Schalten geht nur im WLAN des Vereinsheims.' });
    if (!c.who.app) return res.status(403).json({ error: 'Schalten in der App ist ausgeschaltet.' });
    const light = lightById(c, b.light); if (!light) return res.status(404).json({ error: 'Unbekannte Lichtanlage.' });
    if (!['on', 'extend', 'off'].includes(b.action)) return res.status(400).json({ error: 'Unbekannte Aktion.' });
    try { res.json({ ok: true, ...(await doAction(light, b.action, { kind: 'app', member_id: req.member.id, name: req.member.name }, b.minutes)) }); }
    catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
}

/* =================== Tablet: Name wählen + App-PIN (wie Zugang) =================== */
const T_FAILS = { ip: new Map(), member: new Map(), all: [] };
const tFail = (map, key, max) => {
  const now = Date.now(); const f = map.get(key) || { times: [], until: 0 };
  f.times = f.times.filter(t => now - t < 15 * 60000); f.times.push(now);
  if (f.times.length >= max) { f.until = now + 30 * 60000; f.times = []; }
  if (map.size > 1000) map.delete(map.keys().next().value);
  map.set(key, f);
};
const tBlocked = (map, key) => { const f = map.get(key); return Boolean(f && f.until > Date.now()); };
function tabletFail(ip, who, memberId) {
  const now = Date.now();
  tFail(T_FAILS.ip, ip, 5); tFail(T_FAILS.member, memberId, 3);
  T_FAILS.all = T_FAILS.all.filter(t => now - t < 24 * 3600000); T_FAILS.all.push(now);
  if (T_FAILS.all.length >= 10) {
    const c = cfg(); c.header = false; save(c); T_FAILS.all = [];
    log('abgelehnt', null, null, 'Licht am Tablet nach 10 falschen PINs abgeschaltet');
    H.require('./security').securityAlert('Am Vereinstablet wurde beim Flutlicht 10-mal eine falsche App-PIN eingegeben (zuletzt für „' + who + '“). Das Schalten am Tablet ist deshalb abgeschaltet. In der Verwaltung unter Einstellungen › Tablet kann es wieder eingeschaltet werden.', 'flutlicht-tablet');
  }
}
function tabletRoutes(r, ctx) {
  r.use((req, res, next) => (cfg().header ? next() : res.status(404).json({ error: 'Flutlicht am Tablet ist nicht eingeschaltet.' })));
  r.get('/members', (req, res) => {
    res.json({ members: db.prepare(`SELECT m.id, m.name, m.kind FROM member_access a JOIN members m ON m.id = a.member_id
      JOIN member_devices d ON d.member_id = m.id AND d.scope = ? AND d.token_hash IS NOT NULL
      WHERE a.module = ? AND a.blocked = 0 AND m.active = 1 AND m.deleted = 0 ORDER BY name_key(m.name, m.kind)`).all(APP, MOD).map(m => ({ id: m.id, name: m.name, ln: lastFirst(m.name, m.kind) })) });
  });
  r.get('/status', async (req, res) => res.json(await view('tablet')));
  r.post('/act', ctx.rateLimit('fltact', 30, 60000), async (req, res) => {
    const c = cfg(), b = req.body || {};
    if (!c.who.tablet) return res.status(403).json({ error: 'Schalten am Tablet ist ausgeschaltet.' });
    const light = lightById(c, b.light); if (!light) return res.status(404).json({ error: 'Unbekannte Lichtanlage.' });
    if (!['on', 'extend', 'off'].includes(b.action)) return res.status(400).json({ error: 'Unbekannte Aktion.' });
    const id = parseInt(b.member, 10);
    if (!id) return res.status(400).json({ error: 'Bitte deinen Namen wählen.' });
    const ip = req.ip || req.socket.remoteAddress || '';
    if (tBlocked(T_FAILS.ip, ip)) return res.status(429).json({ error: 'Zu viele falsche PINs an diesem Gerät – bitte in 30 Minuten erneut versuchen.' });
    if (tBlocked(T_FAILS.member, id)) return res.status(429).json({ error: 'Für diesen Namen wurde zu oft eine falsche PIN eingegeben – bitte in 30 Minuten erneut versuchen.' });
    const chk = H.invites.checkMember(APP, id, b.pin);
    if (!chk.ok) {
      if (chk.pin || chk.status === 401) { const m = db.prepare('SELECT name FROM members WHERE id = ?').get(id); tabletFail(ip, m ? m.name : String(id), id); }
      return res.status(chk.status).json({ error: chk.error, pin: chk.pin });
    }
    const acc = H.access.check(chk.memberId, MOD);
    if (!acc.ok) return res.status(403).json({ error: acc.reason || 'Du bist für das Flutlicht nicht freigeschaltet.' });
    try { res.json({ ok: true, ...(await doAction(light, b.action, { kind: 'tablet', member_id: chk.memberId, name: chk.name }, b.minutes)) }); }
    catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
}

/* =================== Einrichtung =================== */
const ID_RE = /^[a-f0-9]{8}$/;
const timeOk = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const quietOk = s => s === '24:00' || (timeOk(s) && L.toMin(s) >= 17 * 60);
/** Eingaben prüfen und zur fertigen Konfiguration zusammensetzen – ohne zu speichern */
function cleanCfg(b, cleanName) {
  const c = cfg(), out = { ...c };
  if (b.lights !== undefined) {
    if (!Array.isArray(b.lights) || b.lights.length > 40) throw new Error('Höchstens 40 Lichtanlagen.');
    const cur = new Set(c.lights.map(l => l.id)), seen = new Set(), refs = new Set(), courts = new Set();
    out.lights = b.lights.map((l, i) => {
      const name = cleanName(l && l.name, 30);
      if (!name) throw new Error(`Lichtanlage ${i + 1} braucht einen Namen.`);
      const ref = String(l.ref || '').trim();
      if (!/^(switch|light)\.[a-z0-9_]+$/.test(ref)) throw new Error(`${name}: bitte einen Schalter aus Home Assistant wählen (switch.* oder light.*).`);
      if (refs.has(ref)) throw new Error(`${name}: dieser Schalter ist schon einer anderen Lichtanlage zugeordnet.`);
      { const own = H.entityOwner(ref); if (own) throw new Error(`${name}: „${ref}“ gehört schon zum Modul ${own}.`); }
      refs.add(ref);
      let court = null;
      if (l.court && l.court.id !== undefined && l.court.id !== null && l.court.id !== '') {
        const cid = parseInt(l.court.id, 10);
        if (!(cid > 0)) throw new Error(`${name}: ungültiger Platz.`);
        if (courts.has(cid)) throw new Error(`${name}: der Platz hat schon eine Lichtanlage (ein Schalter je Platz).`);
        courts.add(cid); court = { src: 'buchung', id: cid };
      }
      const num = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
      const id = !seen.has(String(l.id)) && (cur.has(String(l.id)) || ID_RE.test(String(l.id || ''))) ? String(l.id) : crypto.randomBytes(4).toString('hex');
      seen.add(id);
      return { id, name, ref, court, pre: num(l.pre, 30), post: num(l.post, 30) };
    });
  }
  if (b.sun !== undefined) {
    const s = b.sun || {};
    const src = s.source === 'ha' ? 'ha' : 'calc';
    const n = v => (v === null || v === '' || v === undefined ? null : Number(String(v).replace(',', '.')));
    const lat = n(s.lat), lon = n(s.lon);
    if (lat !== null && !(lat >= -66 && lat <= 66)) throw new Error('Breitengrad bitte zwischen -66 und 66.');
    if (lon !== null && !(lon >= -180 && lon <= 180)) throw new Error('Längengrad bitte zwischen -180 und 180.');
    if (src === 'calc' && (lat === null || lon === null) && (b.sun.lat !== undefined || b.sun.lon !== undefined) && (lat === null) !== (lon === null)) throw new Error('Bitte Breiten- und Längengrad angeben.');
    const off = parseInt(s.offset, 10);
    if (!(off >= -120 && off <= 120)) throw new Error('Versatz bitte zwischen -120 und 120 Minuten.');
    out.sun = { source: src, lat: lat === null ? null : Math.round(lat * 10000) / 10000, lon: lon === null ? null : Math.round(lon * 10000) / 10000, offset: off };
  }
  if (b.quiet !== undefined) {
    if (!Array.isArray(b.quiet) || b.quiet.length !== 7 || !b.quiet.every(quietOk)) throw new Error('Nachtruhe bitte je Tag zwischen 17:00 und 24:00 Uhr.');
    out.quiet = b.quiet.slice();
  }
  if (b.season !== undefined) {
    if (b.season === null) out.season = null;
    else {
      const md = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
      if (!b.season || !md.test(b.season.from) || !md.test(b.season.to)) throw new Error('Saison bitte als Tag und Monat (von – bis).');
      out.season = { from: b.season.from, to: b.season.to };
    }
  }
  if (b.blockDays !== undefined) {
    if (!Array.isArray(b.blockDays) || b.blockDays.length > 50) throw new Error('Ungültige Sperrzeiträume.');
    out.blockDays = b.blockDays.map(x => {
      const from = String((x && x.from) || ''), to = String((x && (x.to || x.from)) || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) throw new Error('Sperrzeiträume: bitte gültige Daten (von ≤ bis).');
      return { from, to, note: cleanName(x.note, 60) || '' };
    }).sort((x, y) => x.from.localeCompare(y.from));
  }
  if (b.who !== undefined) out.who = { auto: Boolean(b.who && b.who.auto), app: Boolean(b.who && b.who.app), tablet: Boolean(b.who && b.who.tablet) };
  if (b.maxMin !== undefined) { const v = parseInt(b.maxMin, 10); if (!(v >= 15 && v <= 240)) throw new Error('Höchstens am Stück: 15 bis 240 Minuten.'); out.maxMin = v; }
  if (b.extendMin !== undefined) { const v = parseInt(b.extendMin, 10); if (!(v >= 5 && v <= 120)) throw new Error('Verlängern um: 5 bis 120 Minuten.'); out.extendMin = v; }
  if (b.fee !== undefined) {
    const f = b.fee || {}, cents = parseInt(f.cents, 10);
    if (!(cents >= 10 && cents <= 2000)) throw new Error('Lichtgeld bitte zwischen 0,10 € und 20,00 € je Viertelstunde.');
    if (!timeOk(f.from)) throw new Error('„Lichtgeld ab“ bitte als Uhrzeit (z. B. 18:00).');
    if (f.on && !feeTarget()) throw new Error('Lichtgeld braucht das Modul Mitglieder oder den Verkauf (Konto zum Buchen).');
    out.fee = { on: Boolean(f.on), cents, from: f.from };
  }
  if (b.notify !== undefined) { const n = String(b.notify || '').trim().replace(/^notify\./, ''); out.notify = /^[a-z0-9_]{1,80}$/.test(n) ? n : ''; }
  return out;
}
const LABELS = { lights: ['Lichtanlagen', 'list'], sun: ['Dunkelheit', 'text'], quiet: ['Nachtruhe', 'list'], season: ['Saison', 'text'], blockDays: ['Sperrzeiträume', 'list'],
  who: ['Wer darf schalten', 'text'], maxMin: 'Höchstens am Stück (Min.)', extendMin: 'Verlängern um (Min.)', fee: ['Lichtgeld', 'text'], notify: 'Benachrichtigung bei Störung' };
/** Konfiguration lesbar fürs Protokoll (nie interne Schlüssel wie IDs) */
function auditView(c) {
  return {
    lights: c.lights.map(l => `${l.name} (${l.ref}${l.pre || l.post ? `, Vorlauf ${l.pre}, Nachlauf ${l.post} Min.` : ''})`),
    sun: c.sun.source === 'ha' ? `Home Assistant, Versatz ${c.sun.offset} Min.` : `Standort ${c.sun.lat ?? '–'}/${c.sun.lon ?? '–'}, Versatz ${c.sun.offset} Min.`,
    quiet: c.quiet.map((q, i) => `${DAYS[i]} ${q}`), season: c.season ? `${c.season.from.split('-').reverse().join('.')}. – ${c.season.to.split('-').reverse().join('.')}.` : 'ganzjährig',
    blockDays: c.blockDays.map(x => `${deD(x.from)}–${deD(x.to)}${x.note ? ' ' + x.note : ''}`),
    who: [c.who.auto && 'Automatik', c.who.app && 'App', c.who.tablet && 'Tablet'].filter(Boolean).join(', ') || 'nur Verwaltung',
    maxMin: c.maxMin, extendMin: c.extendMin, fee: c.fee.on ? `${euro(c.fee.cents)} je Viertelstunde ab ${c.fee.from} Uhr` : 'aus', notify: c.notify,
  };
}

/* =================== Aktivieren =================== */
function activate(ctx) {
  ({ db, getSetting, setSetting, audit } = ctx); ({ lastFirst } = ctx.require('./db'));
  H = ctx;
  try { const ma = ctx.require('./memberapp'); awayReq = ma.awayReq; clubNet = ma.isClubNet; } catch (e) { /* ohne App */ }
  createTables();
  const { need, bad, cleanName } = ctx;
  const P = need('flutlicht'), PB = need('flutlicht', 'flutlicht_bedienen');
  const uname = req => req.user.name || req.user.username;

  ctx.hooks.tabletVisible = () => { const c = cfg(); return Boolean(c.header && c.lights.length && c.who.tablet); };
  ctx.hooks.tabletSwitch = { get: () => Boolean(cfg().header), set: on => { const c = cfg(); c.header = on; save(c); } };
  ctx.hooks.usedEntities = () => cfg().lights.map(l => l.ref);
  ctx.hooks.historyTables = () => ['fl_claim'];   // Lichtgeld und Betriebsstunden bleiben beim Löschen eines Kontos lesbar
  ctx.hooks.deactivate = () => { allOff('System (Modul ausgeschaltet)').catch(() => {}); };
  /* Datenschutz: der Verlauf zeigt, wer wann Licht hatte – nach der Frist werden Namen entfernt, Dauer bleibt für die Betriebsstunden */
  const keepMonths = () => Math.min(60, Math.max(3, parseInt(ctx.setting('keep_months', '24'), 10) || 24));
  ctx.hooks.retention = () => [{ id: 'verlauf', label: 'Flutlicht-Verlauf', text: 'Wer wann das Licht eingeschaltet hat und welches Lichtgeld daraus entstand.', unit: 'monate', value: keepMonths(), def: 24, min: 3, max: 60,
    due: cut => db.prepare('SELECT COUNT(*) n FROM fl_claim WHERE start < ? AND (who IS NOT NULL OR member_id IS NOT NULL)').get(cut).n + db.prepare('SELECT COUNT(*) n FROM fl_log WHERE at < ? AND who IS NOT NULL').get(cut).n,
    purge: cut => db.prepare("UPDATE fl_claim SET who = NULL, member_id = NULL WHERE start < ? AND ended_at IS NOT NULL AND (who IS NOT NULL OR member_id IS NOT NULL)").run(cut).changes
      + db.prepare('UPDATE fl_log SET who = NULL WHERE at < ? AND who IS NOT NULL').run(cut).changes,
    set: v => ctx.setSetting2('keep_months', String(v)) }];
  ctx.hooks.privacyRecord = () => [{ purpose: 'Schalten des Flutlichts, Nachweis von Lichtgeld und Betriebsstunden', data: 'Name, Lichtanlage, Zeitpunkt und Dauer, Auslöser (Buchung, App, Tablet), Lichtgeld', persons: 'Mitglieder, die das Licht einschalten oder bei Dunkelheit buchen' }];
  ctx.hooks.memberData = id => ({ flutlicht: db.prepare('SELECT light_name AS lichtanlage, start AS von, COALESCE(ended_at, planned_end) AS bis, source AS ausloeser, fee_cents AS lichtgeld_cent FROM fl_claim WHERE member_id = ? ORDER BY start').all(id) });
  ctx.hooks.memberLinks = id => (db.prepare("SELECT 1 FROM fl_claim WHERE member_id = ? AND ended_at IS NULL").get(id) ? ['Licht brennt gerade für dieses Konto'] : []);

  memberRoutes(ctx.member, ctx);
  const tr = ctx.require('express').Router(); tabletRoutes(tr, ctx); ctx.tablet.use(tr);

  /* Funktionsexport/-import: Lichtanlagen (ohne Platzzuordnung – die IDs gelten nur in dieser Installation), Zeiten, Einstellungen */
  ctx.hooks.exportConfig = () => { const c = cfg(); return { ...c, lights: c.lights.map(({ id, court, ...l }) => { void id; void court; return l; }), keepMonths: keepMonths() }; };
  ctx.hooks.importConfig = data => {
    if (!data || typeof data !== 'object') throw new Error('Leere Funktionsdatei.');
    const cur = cfg(), b = {}, n = { neu: 0, upd: 0 };
    for (const k of ['sun', 'quiet', 'season', 'blockDays', 'who', 'maxMin', 'extendMin', 'notify']) if (data[k] !== undefined) b[k] = data[k];
    if (data.fee !== undefined) b.fee = { ...data.fee, on: Boolean(data.fee && data.fee.on && feeTarget()) };
    if (Array.isArray(data.lights)) {   // gleicher Name → aktualisieren, sonst neu; nie löschen
      const lights = cur.lights.map(l => ({ ...l }));
      for (const x of data.lights.slice(0, 40)) {
        if (!x || typeof x !== 'object') continue;
        const i = lights.findIndex(l => l.name.toLowerCase() === String(x.name || '').trim().toLowerCase());
        const v = { name: x.name, ref: x.ref, pre: x.pre, post: x.post };
        if (i >= 0) { lights[i] = { ...lights[i], ...v }; n.upd++; } else { lights.push(v); n.neu++; }
      }
      b.lights = lights;
    }
    const out = cleanCfg(b, ctx.cleanName);
    save(out);
    if (Number.isInteger(data.keepMonths) && data.keepMonths >= 3 && data.keepMonths <= 60) ctx.setSetting2('keep_months', String(data.keepMonths));
    return `Lichtanlagen: ${n.neu} neu, ${n.upd} aktualisiert · Zeiten und Einstellungen übernommen`;
  };
  /* Probe-Wiederherstellung: Zählerstände (nur Anzahlen) */
  ctx.hooks.probeCounts = () => [{ label: 'Flutlicht-Protokoll', n: db.prepare("SELECT COUNT(*) n FROM fl_log").get().n }];
  ctx.hooks.setupSteps = () => [
    { id: 'lichtanlagen', title: 'Lichtanlagen anlegen', text: 'Je Platz der Schalter aus Home Assistant, der das Licht schaltet – danach unter „Bedienen“ einmal testen.', page: 'flutlicht-anlagen', card: [], done: cfg().lights.length > 0 },
    { id: 'zeiten', title: 'Dunkelheit und Nachtruhe', text: 'Standort für den Sonnenuntergang und die Uhrzeit, zu der spätestens alles aus ist.', page: 'flutlicht-zeiten', card: ['Dunkelheit', 'Nachtruhe'], done: cfg().sun.source === 'ha' || cfg().sun.lat !== null },
  ];
  ctx.hooks.overview = async () => {
    const c = cfg(), alerts = [];
    const v = await view('admin');
    if (!v.online && c.lights.length) alerts.push({ level: 'r', text: 'Keine Verbindung zum Flutlicht.', detail: cache.err ? cache.err.message : '' });
    for (const l of v.lights) if (v.online && l.offline) alerts.push({ level: 'r', text: `${l.name}: Schalter nicht erreichbar` });
    for (const [id, msg] of failed) { const l = c.lights.find(x => x.id === id); if (l) alerts.push({ level: 'r', text: `${l.name}: Licht ließ sich nicht schalten`, detail: msg }); }
    if (!v.darkFrom && c.sun.source === 'calc' && c.lights.length) alerts.push({ level: 'a', text: 'Flutlicht: Standort für den Sonnenuntergang fehlt.', sec: ['tab_flutlicht-zeiten', ''] });
    const on = v.lights.filter(l => l.on).length;
    return { kpis: [{ l: 'Lichtanlagen', v: c.lights.length }, { l: 'Licht an', v: on }], alerts };
  };

  const admin = ctx.admin;
  admin.get('/config', P, async (req, res) => {
    const c = cfg();
    let devices = null, error = null;
    if (!sim()) {
      try { const st = await states(true); devices = [...st.values()].filter(s => DOMAINS.includes(s.entity_id.split('.')[0])).map(s => ({ ref: s.entity_id, name: `${(s.attributes && s.attributes.friendly_name) || s.entity_id} (${s.entity_id})` })).sort((a, b) => a.name.localeCompare(b.name, 'de')); }
      catch (e) { error = e.message; }
    } else devices = c.lights.map(l => ({ ref: l.ref, name: `${l.name} (${l.ref})` }));
    let courts = [];
    if (H.isModuleActive('buchung')) { const r = (await H.callHooks('courtList')).find(x => x.id === 'buchung'); courts = (r && r.result) || []; }
    const day = L.dayOf(nowD()), st = await trySt();
    const today = darkFrom(c, st);
    const in4 = c.sun.source === 'calc' && c.sun.lat !== null ? L.sunset(L.dayOf(L.addMin(nowD(), 28 * 1440)), c.sun.lat, c.sun.lon) : null;
    const granted = H.access.list(MOD).filter(r => !r.blocked).length;
    res.json({ cfg: c, devices, error, sim: sim(), haAvailable: ha.available(), courts, buchung: H.isModuleActive('buchung'), feeTarget: feeTarget(), granted,
      sun: { today: today ? L.hm(today) : null, sunset: sunsetToday(c, st) ? L.hm(sunsetToday(c, st)) : null, in4: in4 ? L.hm(L.addMin(in4, c.sun.offset)) : null, day } });
  });
  admin.put('/config', P, (req, res) => {
    let out;
    try { out = cleanCfg(req.body || {}, cleanName); } catch (e) { return bad(res, e.message); }
    const before = cfg();
    save(out);
    const diff = ctx.auditDiff(LABELS, auditView(before), auditView(out));
    if (diff) audit(req.user, 'Flutlicht: Einstellungen geändert', diff);
    // geänderte Schalter dem Vorstand melden (wie bei Türen: wer Schalter umhängt, schaltet fremde Geräte)
    const refs = c2 => c2.lights.map(l => `${l.name}=${l.ref}`).sort().join(', ');
    if (refs(before) !== refs(out) && before.lights.length) H.require('./security').securityAlert(`Im Modul Flutlicht wurden die Schalter geändert (von ${uname(req)}).\n\nVorher: ${refs(before) || '–'}\nJetzt: ${refs(out) || '–'}`, 'flutlicht-schalter-' + Date.now());
    res.json({ ok: true, cfg: out });
  });
  admin.post('/test', P, async (req, res) => {
    if (sim()) return res.json({ ok: true, text: 'Beispieldaten: Die Schalter werden nur nachgebildet, Home Assistant wird nicht angesprochen.' });
    try {
      const st = await states(true), c = cfg();
      const n = [...st.keys()].filter(k => DOMAINS.includes(k.split('.')[0])).length;
      const miss = c.lights.filter(l => !st.get(l.ref) || ['unavailable', 'unknown'].includes(st.get(l.ref).state)).map(l => l.name);
      res.json({ ok: !miss.length, text: `Verbunden · ${n} Schalter in Home Assistant${st.get('sun.sun') ? ' · Sonnenstand vorhanden' : ''}${miss.length ? ` · nicht erreichbar: ${miss.join(', ')}` : ''}` });
    } catch (e) { res.json({ ok: false, text: e.message }); }
  });
  admin.get('/lights', PB, async (req, res) => {
    const v = await view('admin'), c = cfg();
    res.json({ ...v, auto: c.who.auto && H.isModuleActive('buchung'), error: !v.online && cache.err ? cache.err.message : null });
  });
  admin.post('/lights/:id/:action', PB, async (req, res) => {
    const light = lightById(cfg(), req.params.id), action = req.params.action;
    if (!light || !['on', 'extend', 'off'].includes(action)) return bad(res, 'Unbekannte Lichtanlage oder Aktion.', 404);
    try {
      const r = await doAction(light, action, { kind: 'verwaltung', name: uname(req) }, (req.body || {}).minutes);
      audit(req.user, 'Flutlicht: geschaltet', `${light.name}: ${{ on: 'eingeschaltet', extend: 'verlängert', off: 'ausgeschaltet' }[action]}${r.until ? ' bis ' + hhmm(r.until) + ' Uhr' : ''}`);
      res.json({ ok: true, ...r });
    } catch (e) { bad(res, e.message, e.status || 400); }
  });
  admin.post('/all-off', PB, async (req, res) => {
    const errs = await allOff(uname(req));
    audit(req.user, 'Flutlicht: alles aus', errs.length ? `nicht erreichbar: ${errs.join(', ')}` : '');
    if (errs.length) return bad(res, `Nicht erreichbar: ${errs.join(', ')} – Clubwerk versucht es weiter.`, 502);
    res.json({ ok: true });
  });
  /* Verlauf: Anforderungen eines Monats, Ereignisse, Betriebsstunden im Jahr */
  const nextMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };
  const monthRows = m => db.prepare('SELECT * FROM fl_claim WHERE start >= ? AND start < ? ORDER BY start DESC, id DESC').all(m + '-01', nextMonth(m) + '-01');
  const endOf = x => (x.ended_at ? (x.ended_at < x.planned_end ? x.ended_at : x.planned_end) : null);
  const minutes = x => { const e = endOf(x); return e ? Math.max(0, Math.round((L.parse(e) - L.parse(x.start)) / 60000)) : null; };
  function claimRows(rows) {
    const stat = feeStatus(rows);
    return rows.map(x => ({ id: x.id, light: x.light_name, start: x.start, end: endOf(x) || x.planned_end, running: !x.ended_at, minutes: minutes(x), source: SOURCE[x.source] || x.source,
      who: x.who ? lastFirst(x.who) : x.source === 'auto' ? 'Vereinsbuchung' : '', reason: x.end_reason ? REASON[x.end_reason] || x.end_reason : '', fee: x.fee_cents || 0, feeStatus: stat(x), quarters: x.fee_quarters || 0 }));
  }
  admin.get('/log', P, (req, res) => {
    const months = db.prepare('SELECT DISTINCT substr(start,1,7) m FROM fl_claim UNION SELECT DISTINCT substr(at,1,7) FROM fl_log ORDER BY m DESC').all().map(r => r.m);
    const cur = L.ts(nowD()).slice(0, 7);
    if (!months.includes(cur)) months.unshift(cur);
    // ohne Wahl: laufender Monat – ist er (am Monatsanfang) noch leer, der letzte Monat mit Einträgen
    const m = /^\d{4}-\d{2}$/.test(String(req.query.month)) ? String(req.query.month) : monthRows(cur).length ? cur : months.find(x => x < cur) || cur;
    const year = m.slice(0, 4);
    const hours = {};
    for (const x of db.prepare('SELECT * FROM fl_claim WHERE start >= ? AND start < ? AND ended_at IS NOT NULL ORDER BY light, start').all(year + '-01-01', (+year + 1) + '-01-01')) {
      // überlappende Anforderungen derselben Anlage nur einmal zählen (Betriebsstunden = Zeit, in der das Licht wirklich brannte)
      const h = hours[x.light_name] || (hours[x.light_name] = { min: 0, last: '' });
      const s = x.start > h.last ? x.start : h.last, e = endOf(x);
      if (e > s) { h.min += Math.round((L.parse(e) - L.parse(s)) / 60000); h.last = e; }
    }
    res.json({ month: m, months, year, rows: claimRows(monthRows(m)), events: db.prepare('SELECT * FROM fl_log WHERE at >= ? AND at < ? ORDER BY at DESC, id DESC').all(m + '-01', nextMonth(m) + '-01'),
      hours: Object.entries(hours).map(([name, h]) => ({ name, minutes: h.min })).sort((a, b) => a.name.localeCompare(b.name, 'de')) });
  });
  admin.get('/log.xlsx', P, async (req, res) => {
    const m = /^\d{4}-\d{2}$/.test(String(req.query.month)) ? String(req.query.month) : L.ts(nowD()).slice(0, 7);
    const ExcelJS = ctx.require('exceljs');
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Flutlicht ' + m);
    ws.columns = [{ header: 'Lichtanlage', key: 'light', width: 20 }, { header: 'Von', key: 'start', width: 18 }, { header: 'Bis', key: 'end', width: 10 }, { header: 'Minuten', key: 'minutes', width: 10 },
      { header: 'Auslöser', key: 'source', width: 22 }, { header: 'Wer', key: 'who', width: 24 }, { header: 'Ende', key: 'reason', width: 22 }, { header: 'Lichtgeld €', key: 'fee', width: 12 }, { header: 'Status', key: 'feeStatus', width: 14 }];
    ws.getRow(1).font = { bold: true };
    for (const r of claimRows(monthRows(m)).reverse()) ws.addRow({ ...r, start: deD(r.start.slice(0, 10)) + ' ' + hhmm(r.start), end: hhmm(r.end), fee: r.fee ? r.fee / 100 : null, feeStatus: r.feeStatus || '' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="flutlicht-${m}.xlsx"`);
    res.end(Buffer.from(await wb.xlsx.writeBuffer()));
  });
  /* Lichtgeld stornieren (wie eine Platzgebühr) */
  admin.post('/claims/:id/fee-cancel', P, (req, res) => {
    const x = db.prepare('SELECT * FROM fl_claim WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!x || !x.fee_cents || x.fee_cancelled_at) return bad(res, 'Dieses Lichtgeld gibt es nicht (mehr).', 404);
    try {
      if (x.charge_id) {
        if (!H.isModuleActive('mitglieder')) throw new Error('Das Lichtgeld steht als Forderung in der Mitgliederverwaltung – dafür muss das Modul Mitglieder eingeschaltet sein.');
        // die Mitgliederverwaltung lehnt ab, wenn der Posten im Einzug steckt oder laut Kontoauszug bezahlt ist (Fehler kommt hier als fehlende Antwort an)
        if (!H.callHooksSync('cancelCharge', x.charge_id, 'Lichtgeld storniert', uname(req)).length) throw new Error('Das Lichtgeld lässt sich hier nicht stornieren: Der Posten steckt in einem Einzug oder ist laut Kontoauszug bezahlt. Bitte in den Mitgliedern klären.');
      }
      if (x.sale_id) H.drinks.cancelCharge(x.sale_id, uname(req));
    } catch (e) { return bad(res, e.message); }
    db.prepare('UPDATE fl_claim SET fee_cancelled_at = ?, fee_cancelled_by = ? WHERE id = ?').run(L.ts(nowD()), uname(req), x.id);
    audit(req.user, 'Flutlicht: Lichtgeld storniert', `${x.who ? lastFirst(x.who) : ''}: ${x.light_name} ${deD(x.start.slice(0, 10))} ${euro(x.fee_cents)}`);
    res.json({ ok: true });
  });

  setInterval(() => { if (ctx.isActive()) tick(); }, TICK_MS).unref();
  setTimeout(() => { if (ctx.isActive()) tick(); }, process.env.CW_TEST_FAST ? 500 : 3000).unref();   // nach dem Start gleich abgleichen
}

module.exports = { activate };
