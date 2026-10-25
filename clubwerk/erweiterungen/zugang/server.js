'use strict';
/* ---------- Zugang: Türen, Tore und Schlösser über Home Assistant ----------
   Herstellerneutral: jede Tür ist ein Gerät in Home Assistant –
     lock      Schloss (lock.*)                 → aufschließen / abschließen
     impulse   Türöffner/Relais (switch.* oder button.*) → öffnen (Impuls für einige Sekunden)
     cover     Tor/Antrieb (cover.*)            → öffnen / schließen
   optional ein Türkontakt (binary_sensor.*) für „steht offen“.
   Wer darf wann? Freischaltung je Mitglied in der Mitglieder-App (ein QR-Code, eine PIN – src/memberapp.js)
   plus Zeitprofil (Wochentage, Uhrzeiten, Türen). Ein Profil ist Standard und wird bei jeder Freischaltung vergeben.
   Geöffnet wird in der Mitglieder-App (Bereich „Türen“), optional zusätzlich am Tablet (Name wählen + App-PIN).
   Es wird nie automatisch abgeschlossen. */
const crypto = require('crypto');
let db, getSetting, setSetting, audit, H, express, access, lastFirst;
const MOD = 'zugang';
const APP = 'app';   // Geräte-Kopplung der Mitglieder-App

/* Hersteller im Auswahlfeld: filtert die Geräteliste (Integration in HA). Neue einfach ergänzen. */
const VENDORS = [
  { id: 'nuki', name: 'Nuki', integration: 'nuki', setup: 'Integration „Nuki“ (oder Nuki über Matter)' },
  { id: 'matter', name: 'Matter-Schlösser (z. B. Nuki, Aqara, Yale, Eve)', integration: 'matter', setup: 'Integration „Matter“' },
  { id: 'yale', name: 'Yale', integration: 'yale', setup: 'Integration „Yale“' },
  { id: 'tedee', name: 'tedee', integration: 'tedee', setup: 'Integration „tedee“' },
  { id: 'switchbot', name: 'SwitchBot', integration: 'switchbot', setup: 'Integration „SwitchBot“ (Bluetooth)' },
  { id: 'homekit', name: 'HomeKit-Geräte', integration: 'homekit_controller', setup: 'Integration „HomeKit-Gerät“' },
  { id: 'shelly', name: 'Shelly-Relais (Türöffner, Motorschloss, Tor)', integration: 'shelly', setup: 'Integration „Shelly“' },
  { id: 'esphome', name: 'ESPHome (Eigenbau)', integration: 'esphome', setup: 'Integration „ESPHome“' },
  { id: 'other', name: 'Gemischt / anderer Hersteller (alle Geräte aus Home Assistant)', integration: null, setup: 'passende Integration in Home Assistant' },
];
const TYPES = { lock: ['lock'], impulse: ['switch', 'button'], cover: ['cover'] };
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DEF = {
  vendor: 'other', doors: [], profiles: [], wlanOnly: true, header: false, appName: 'Zugang', subtitle: 'Türen öffnen',
  notify: '', openAlertMin: 0, blockAll: false, blockDays: [],
};
const ha = require('../../src/ha');   // Home Assistant (gemeinsam mit Beregnung bzw. Zugang)
const { pad, today, nowTs: localTs } = require('../../src/util');   // gemeinsame Helfer des Kerns (auch als ctx.util)
/* IDs von Türen und Zeitprofilen werden nie doppelt vergeben – auch nicht nach dem Löschen (Protokoll und Freischaltungen verweisen darauf).
   Die Prüfung in cleanCfg() arbeitet auf einer Kopie (`used`) ohne Datenbankzugriff; gespeichert wird erst mit der Konfiguration (saveUsedIds). */
function usedIds() {
  let u; try { u = new Set(JSON.parse(getSetting('ext_zugang_used_ids', '[]'))); } catch (e) { u = new Set(); }
  const c = cfg(); for (const d of c.doors || []) u.add(d.id); for (const p of c.profiles || []) u.add(p.id);   // vorhandene zählen immer als vergeben
  return u;
}
/** Eine mitgeschickte ID annehmen, wenn sie gültig ist und hier noch nie vergeben war (wird in `used` als vergeben gemerkt) */
function freshId(used, id, re) {
  if (!re.test(String(id || ''))) return false;
  if (used.has(String(id))) return false;
  used.add(String(id));
  return true;
}
function newId(used) {
  let id; do { id = crypto.randomBytes(4).toString('hex'); } while (used.has(id));
  used.add(id);
  return id;
}
const saveUsedIds = used => setSetting('ext_zugang_used_ids', JSON.stringify([...used]));

function defaultProfiles() {
  const all = { 0: [['00:00', '24:00']], 1: [['00:00', '24:00']], 2: [['00:00', '24:00']], 3: [['00:00', '24:00']], 4: [['00:00', '24:00']], 5: [['00:00', '24:00']], 6: [['00:00', '24:00']] };
  const day = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, [['07:00', '23:00']]]));
  return [
    { id: 'mitglied', name: 'Mitglied', doors: 'all', windows: day, isDefault: true },
    { id: 'immer', name: 'Rund um die Uhr', doors: 'all', windows: all, isDefault: false },
  ];
}
function cfg() {
  let c = {};
  try { c = JSON.parse(getSetting('ext_zugang_cfg', '{}')) || {}; } catch (e) { c = {}; }
  const out = { ...DEF, ...c };
  for (const k of ['doors', 'profiles', 'blockDays']) if (!Array.isArray(out[k])) out[k] = [];
  if (!out.profiles.length) out.profiles = defaultProfiles();
  if (!out.profiles.some(p => p.isDefault)) out.profiles[0].isDefault = true;
  if (!VENDORS.some(v => v.id === out.vendor)) out.vendor = 'other';
  return out;
}
const save = c => setSetting('ext_zugang_cfg', JSON.stringify(c));

function createTables() {
  db.exec(`
CREATE TABLE IF NOT EXISTS zugang_log (
  id     INTEGER PRIMARY KEY,
  at     TEXT NOT NULL,
  who    TEXT,
  door   TEXT,
  action TEXT NOT NULL,               -- auf | zu | oeffnen | abgelehnt | fehler | freischaltung | alarm | sperre
  detail TEXT
);
CREATE INDEX IF NOT EXISTS ix_zugang_log_at ON zugang_log(at);
`);
  // ältere Fassung (2.2): eigene Tabelle zugang_members → gemeinsame Freischaltungen der Mitglieder-App
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'zugang_members'").get()) {
    db.exec(`INSERT OR IGNORE INTO member_access(member_id, module, profile, valid_until, blocked) SELECT member_id, 'zugang', profile_id, valid_until, blocked FROM zugang_members;
      DROP TABLE zugang_members;`);
  }
}
const log = (action, who, door, detail) => db.prepare('INSERT INTO zugang_log(at, who, door, action, detail) VALUES (?,?,?,?,?)').run(localTs(), who || null, door || null, action, detail || null);

/* =================== Zeitprofile =================== */
const toMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s)); return m ? +m[1] * 60 + +m[2] : null; };
/** erlaubt das Profil diesen Zeitpunkt? (Zeitfenster über Mitternacht werden unterstützt, z. B. 18:00–02:00) */
function profileAllows(p, d = new Date()) {
  const wd = d.getDay(), t = d.getHours() * 60 + d.getMinutes();
  const win = day => ((p.windows || {})[day] || []).map(([a, b]) => [toMin(a), toMin(b)]).filter(([a, b]) => a !== null && b !== null);
  for (const [a, b] of win(wd)) { if (a < b ? (t >= a && t < b) : a > b ? t >= a : false) return true; }
  for (const [a, b] of win((wd + 6) % 7)) { if (a > b && t < b) return true; }   // Fenster von gestern über Mitternacht
  return false;
}
function nextAllowed(p, d = new Date()) {
  const x = new Date(d); x.setSeconds(0, 0);
  for (let i = 0; i < 8 * 24 * 12; i++) {
    x.setMinutes(x.getMinutes() + 5 - (x.getMinutes() % 5));
    if (profileAllows(p, x)) {
      const sameDay = x.toDateString() === d.toDateString();
      const tm = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toDateString() === x.toDateString();
      return `${sameDay ? 'heute' : tm ? 'morgen' : DAYS[x.getDay()]} ${pad(x.getHours())}:${pad(x.getMinutes())} Uhr`;
    }
  }
  return null;
}
function profileText(p) {
  const fmt = day => ((p.windows || {})[day] || []).map(([a, b]) => (a === '00:00' && b === '24:00' ? 'ganztägig' : `${a}–${b}`)).join(', ');
  const groups = [];
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    const f = fmt(d) || 'geschlossen';
    const last = groups[groups.length - 1];
    if (last && last.f === f) last.to = d; else groups.push({ from: d, to: d, f });
  }
  if (groups.length === 1) return groups[0].f === 'ganztägig' ? 'rund um die Uhr' : `täglich ${groups[0].f}`;
  return groups.map(g => `${DAYS[g.from]}${g.to !== g.from ? '–' + DAYS[g.to] : ''} ${g.f}`).join(' · ');
}
function blockedToday(c) {
  const t = today();
  return (c.blockDays || []).find(b => b.from <= t && t <= (b.to || b.from)) || null;
}

/** darf dieses Mitglied diese Tür jetzt? → { ok } | { ok:false, reason } */
function mayOpen(memberId, door, c = cfg()) {
  if (c.blockAll) return { ok: false, reason: 'Der Zugang ist vom Vorstand vorübergehend für alle gesperrt.' };
  const bd = blockedToday(c);
  if (bd) return { ok: false, reason: `Heute gesperrt${bd.note ? ': ' + bd.note : ''}.` };
  const chk = access.check(memberId, MOD);
  if (!chk.ok) return { ok: false, reason: chk.reason };
  const p = c.profiles.find(x => x.id === chk.row.profile) || c.profiles.find(x => x.isDefault);
  if (!p) return { ok: false, reason: 'Kein Zeitprofil zugeordnet.' };
  if (door && p.doors !== 'all' && !(p.doors || []).includes(door.id)) return { ok: false, reason: `${door.name} ist für dich nicht freigegeben.`, hide: true };
  if (!profileAllows(p)) { const n = nextAllowed(p); return { ok: false, reason: n ? `Jetzt nicht – wieder möglich ab ${n}.` : 'Dein Zeitprofil erlaubt derzeit keinen Zugang.', time: true, next: n }; }
  return { ok: true, profile: p };
}

/* =================== Home Assistant =================== */
let cache = { at: 0, states: null, err: null };
async function states(force) {
  if (!force && Date.now() - cache.at < 3000) { if (cache.err) throw cache.err; return cache.states; }
  try { const s = await ha.call('GET', '/states'); const m = new Map((Array.isArray(s) ? s : []).map(x => [x.entity_id, x])); cache = { at: Date.now(), states: m, err: null }; return m; }
  catch (e) { cache = { at: Date.now(), states: null, err: e }; throw e; }
}
async function deviceList(c) {
  const st = await states(true);
  const out = { lock: [], switch: [], button: [], cover: [], binary_sensor: [] };
  let ids = null;
  const v = VENDORS.find(x => x.id === c.vendor);
  if (v && v.integration) {
    try { const r = await ha.integrationEntities(v.integration); if (Array.isArray(r) && r.length) ids = new Set(r); } catch (e) { /* alles anbieten */ }
  }
  for (const s of st.values()) {
    const dom = s.entity_id.split('.')[0];
    if (!out[dom]) continue;
    if (dom === 'binary_sensor' && !['door', 'garage_door', 'opening', 'window', 'lock'].includes(s.attributes && s.attributes.device_class)) continue;
    if (ids && dom !== 'binary_sensor' && !ids.has(s.entity_id)) continue;
    out[dom].push({ ref: s.entity_id, name: `${(s.attributes && s.attributes.friendly_name) || s.entity_id} (${s.entity_id})` });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return { list: out, filtered: Boolean(ids) };
}
/** Zustand einer Tür für die Anzeige */
function doorState(door, st) {
  const s = st && st.get(door.ref);
  const sensor = door.sensor && st && st.get(door.sensor);
  const open = sensor ? sensor.state === 'on' : null;
  let state = 'unbekannt', can = [];
  if (!s || ['unavailable', 'unknown'].includes(s.state)) state = 'nicht erreichbar';
  else if (door.type === 'lock') {
    state = { locked: 'verschlossen', unlocked: 'aufgeschlossen', open: 'offen', opening: 'öffnet …', locking: 'schließt ab …', unlocking: 'schließt auf …', jammed: 'blockiert!' }[s.state] || s.state;
    can = s.state === 'locked' ? ['auf'] : ['auf', 'zu'];
  } else if (door.type === 'cover') {
    state = { open: 'offen', closed: 'geschlossen', opening: 'öffnet …', closing: 'schließt …' }[s.state] || s.state;
    can = ['auf', 'zu'];
  } else { state = open === null ? 'bereit' : ''; can = ['oeffnen']; }
  if (open !== null) state = open ? (state && door.type !== 'impulse' ? `${state} · Tür steht offen` : 'Tür steht offen') : (state && door.type !== 'impulse' ? `${state} · Tür zu` : 'Tür zu');
  return { state, can, jammed: s && s.state === 'jammed', offline: !s || ['unavailable', 'unknown'].includes(s.state), open };
}
const pulseTimers = new Map();
async function act(door, action) {
  const dom = door.ref.split('.')[0];
  if (door.type === 'lock') {
    if (action === 'zu') await ha.call('POST', '/services/lock/lock', { entity_id: door.ref });
    else await ha.call('POST', '/services/lock/unlock', { entity_id: door.ref });
  } else if (door.type === 'cover') {
    await ha.call('POST', `/services/cover/${action === 'zu' ? 'close_cover' : 'open_cover'}`, { entity_id: door.ref });
  } else if (dom === 'button') {
    await ha.call('POST', '/services/button/press', { entity_id: door.ref });
  } else {
    await ha.call('POST', '/services/switch/turn_on', { entity_id: door.ref });
    clearTimeout((pulseTimers.get(door.id) || {}).timer);
    const sec = Math.max(1, Math.min(30, parseInt(door.pulseSec, 10) || 3));
    const off = () => { pulseTimers.delete(door.id); return ha.call('POST', '/services/switch/turn_off', { entity_id: door.ref }).catch(e => notify(`${door.name}: Türöffner ließ sich nicht ausschalten (${e.message}).`)); };
    pulseTimers.set(door.id, { timer: setTimeout(off, sec * 1000), off });
  }
  cache.at = 0;
}
const notify = text => ha.notify(cfg().notify, 'Zugang', text);

/* Tür steht zu lange offen → einmal melden */
const openSince = new Map();
async function watch() {
  const c = cfg();
  if (!c.openAlertMin || !c.doors.some(d => d.sensor)) return;
  let st; try { st = await states(); } catch (e) { return; }
  for (const d of c.doors.filter(x => x.sensor)) {
    const s = st.get(d.sensor);
    if (s && s.state === 'on') {
      const o = openSince.get(d.id) || { since: Date.now(), told: false };
      if (!o.told && Date.now() - o.since > c.openAlertMin * 60000) { o.told = true; log('alarm', null, d.name, `steht seit ${c.openAlertMin} Minuten offen`); notify(`${d.name} steht seit über ${c.openAlertMin} Minuten offen.`); }
      openSince.set(d.id, o);
    } else openSince.delete(d.id);
  }
}

/* =================== Webapp-Schnittstelle =================== */
/* Vereins-WLAN: dieselbe Regel wie der Kern (Mitglieder-App → „Vereinsnetz“; das interne Home-Assistant-Netz zählt nie) */
let clubNet = null;
function isLocalIp(ip) {
  if (clubNet) return clubNet(ip);
  ip = String(ip || '').replace(/^::ffff:/, '');
  if (/^172\.30\.3[23]\./.test(ip)) return false;
  return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(ip) || ip === '::1' || /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip);
}
function viewFor(memberId, c) {
  let st = null, error = null;
  return states().then(s => { st = s; }).catch(e => { error = e.message; }).then(() => {
    const doors = [];
    for (const d of c.doors) {
      const m = mayOpen(memberId, d, c);
      if (m.hide) continue;
      doors.push({ id: d.id, name: d.name, type: d.type, ...doorState(d, st), allowed: m.ok, reason: m.ok ? null : m.reason });
    }
    const zm = access.get(memberId, MOD);
    const p = zm && (c.profiles.find(x => x.id === zm.profile) || c.profiles.find(x => x.isDefault));
    return { online: Boolean(st), error, doors, profile: p ? { name: p.name, text: profileText(p) } : null,
      validUntil: zm && zm.valid_until ? zm.valid_until.split('-').reverse().join('.') : null };
  });
}
/** Tür schalten – gemeinsam für App und Tablet */
async function operate(res, c, member, door, action, where) {
  const m = mayOpen(member.id, door, c);
  if (!m.ok) { log('abgelehnt', member.name, door.name, m.reason); return res.status(403).json({ error: m.reason }); }
  try {
    await act(door, action === 'oeffnen' ? 'auf' : action);
    log(action, member.name, door.name, where || null);
    res.json({ ok: true });
  } catch (e) {
    log('fehler', member.name, door.name, e.message);
    notify(`${door.name} ließ sich nicht ${action === 'zu' ? 'abschließen' : 'öffnen'} (${e.message}).`);
    res.status(502).json({ error: `${door.name} reagiert nicht – bitte erneut versuchen.` });
  }
}
const pickDoor = (c, b, res) => {
  const door = c.doors.find(d => d.id === String(b.door));
  if (!door) { res.status(404).json({ error: 'Unbekannte Tür.' }); return null; }
  if (!['auf', 'zu', 'oeffnen'].includes(b.action)) { res.status(400).json({ error: 'Unbekannte Aktion.' }); return null; }
  return door;
};

/* Mitglieder-App: /api/m/zugang/… (Gerät + Freischaltung prüft der Kern, die PIN req.pinOk()) */
function memberRoutes(r, ctx) {
  r.get('/status', async (req, res) => res.json(await viewFor(req.member.id, cfg())));
  // Bremse je Adresse zusätzlich zum Schreib-Limit je Gerät des Kerns: Türimpulse im Dauerfeuer und PIN-Prüfungen (scrypt) kosten
  r.post('/door', ctx.rateLimit('zmdoor', 12, 60000), async (req, res) => {
    const c = cfg();
    if (c.wlanOnly && (req.away || req.viaTunnel || !isLocalIp(req.socket.remoteAddress))) return res.status(403).json({ error: 'Öffnen geht nur im Vereins-WLAN.' });
    const door = pickDoor(c, req.body || {}, res); if (!door) return;
    if (!req.pinOk()) return;
    await operate(res, c, req.member, door, req.body.action);
  });
}

/* Vereinstablet (optional): Name wählen + App-PIN */
/* Schutz am Tablet: Die Tablet-Seite ist nur erreichbar, wenn sie unter Zugang → Einstellungen eingeschaltet ist.
   Falsche PINs werden je Mitglied (3 in 15 Min.), je Gerät/Adresse (5 in 15 Min. → je 30 Min. Pause) und insgesamt gezählt – nie auf das Handy des Mitglieds. Nach 10 Fehlversuchen
   innerhalb von 24 Stunden – egal bei welchem Mitglied – schaltet sich das Öffnen am Tablet ab (Warnung an den Vorstand),
   bis ein Admin es wieder einschaltet. Erraten über viele Mitglieder hinweg ist so ausgeschlossen. */
const T_FAILS = { ip: new Map(), member: new Map(), all: [] };
const tFail = (map, key, max) => {
  const now = Date.now(); const f = map.get(key) || { times: [], until: 0 };
  f.times = f.times.filter(t => now - t < 15 * 60000); f.times.push(now);
  if (f.times.length >= max) { f.until = now + 30 * 60000; f.times = []; }
  if (map.size > 1000) map.delete(map.keys().next().value);
  map.set(key, f);
};
const tBlocked = (map, key) => { const f = map.get(key); return Boolean(f && f.until > Date.now()); };
function tabletBlocked(ip) { return tBlocked(T_FAILS.ip, ip); }
function tabletFail(ip, who, memberId) {
  const now = Date.now();
  tFail(T_FAILS.ip, ip, 5);              // je Gerät: 5 in 15 Min. → 30 Min. Pause
  tFail(T_FAILS.member, memberId, 3);    // je Mitglied am Tablet: 3 in 15 Min. → 30 Min. Pause (Handy bleibt unberührt)
  T_FAILS.all = T_FAILS.all.filter(t => now - t < 24 * 3600000); T_FAILS.all.push(now);
  if (T_FAILS.all.length >= 10) {
    const c = cfg(); c.header = false; save(c); cache.at = 0; T_FAILS.all = [];
    log('sperre', null, null, 'Öffnen am Tablet nach 10 falschen PINs abgeschaltet');
    H.require('./security').securityAlert('Am Vereinstablet wurde beim Öffnen der Türen 10-mal eine falsche App-PIN eingegeben (zuletzt für „' + who + '“). Das Öffnen am Tablet ist deshalb abgeschaltet. In der Verwaltung unter Zugang → Einstellungen kann es wieder eingeschaltet werden. Die Mitglieder-App funktioniert weiter.', 'zugang-tablet');
  }
}
function tabletRoutes(r, ctx) {
  const { rateLimit } = ctx;
  // nur, wenn „am Tablet anzeigen“ eingeschaltet ist – sonst gibt es diese Seite gar nicht
  r.use((req, res, next) => (cfg().header ? next() : res.status(404).json({ error: 'Zugang am Tablet ist nicht eingeschaltet.' })));
  r.get('/info', (req, res) => { const c = cfg(); res.json({ club: getSetting('club_name', 'Unser Verein'), appName: c.appName, subtitle: c.subtitle }); });
  r.get('/members', (req, res) => {
    res.json({ members: db.prepare(`SELECT m.id, m.name FROM member_access a JOIN members m ON m.id = a.member_id
      JOIN member_devices d ON d.member_id = m.id AND d.scope = ? AND d.token_hash IS NOT NULL
      WHERE a.module = ? AND a.blocked = 0 AND m.active = 1 AND m.deleted = 0 ORDER BY name_key(m.name, m.kind)`).all(APP, MOD).map(m => ({ ...m, ln: lastFirst(m.name) })) });
  });
  r.get('/status', async (req, res) => {
    const c = cfg();
    let st = null; try { st = await states(); } catch (e) { /* offline */ }
    res.json({ online: Boolean(st), doors: c.doors.map(d => ({ id: d.id, name: d.name, type: d.type, ...doorState(d, st) })) });
  });
  r.post('/door', rateLimit('zdoor', 30, 60000), async (req, res) => {
    const c = cfg();
    const b = req.body || {};
    const door = pickDoor(c, b, res); if (!door) return;
    const id = parseInt(b.member, 10);
    if (!id) return res.status(400).json({ error: 'Bitte deinen Namen wählen.' });
    if (c.wlanOnly && !isLocalIp(req.socket.remoteAddress)) return res.status(403).json({ error: 'Öffnen geht nur im Vereins-WLAN.' });
    const ip = req.ip || req.socket.remoteAddress || '';
    if (tabletBlocked(ip)) return res.status(429).json({ error: 'Zu viele falsche PINs an diesem Gerät – bitte in 30 Minuten erneut versuchen oder die Mitglieder-App benutzen.' });
    if (tBlocked(T_FAILS.member, id)) return res.status(429).json({ error: 'Für diesen Namen wurde am Tablet zu oft eine falsche PIN eingegeben – bitte in 30 Minuten erneut versuchen oder die Mitglieder-App benutzen.' });
    const chk = H.invites.checkMember(APP, id, b.pin);
    if (!chk.ok) {
      if (chk.pin || chk.status === 401) { const m = db.prepare('SELECT name FROM members WHERE id = ?').get(id); tabletFail(ip, m ? m.name : String(id), id); }
      return res.status(chk.status).json({ error: chk.error, pin: chk.pin });
    }
    await operate(res, c, { id: chk.memberId, name: chk.name }, door, b.action, 'am Tablet');
  });
}

/* =================== Verwaltung =================== */
/** Eingaben prüfen und zur fertigen Konfiguration zusammensetzen – OHNE etwas zu speichern. → { out, commit }
 *  commit() schreibt nach save(out) die Nebenwirkungen: neu vergebene IDs merken, Mitglieder mit gelöschtem Zeitprofil auf den Standard setzen. */
function cleanCfg(b, cleanName) {
  const c = cfg();
  const doorMap = new Map();   // alte/fremde Tür-ID → vergebene ID (für die Zeitprofile)
  const out = { ...c };
  const used = usedIds();
  let idsChanged = false, profilesChanged = false;
  if (b.vendor !== undefined) { if (!VENDORS.some(v => v.id === b.vendor)) throw new Error('Unbekannter Hersteller.'); out.vendor = b.vendor; }
  for (const k of ['wlanOnly', 'header', 'blockAll']) if (b[k] !== undefined) out[k] = Boolean(b[k]);
  if (b.appName !== undefined) out.appName = cleanName(b.appName, 20) || 'Zugang';
  if (b.subtitle !== undefined) out.subtitle = cleanName(b.subtitle, 40);
  if (b.notify !== undefined) { const n = String(b.notify || '').trim().replace(/^notify\./, ''); out.notify = /^[a-z0-9_]{1,80}$/.test(n) ? n : ''; }
  if (b.openAlertMin !== undefined) out.openAlertMin = Math.max(0, Math.min(1440, parseInt(b.openAlertMin, 10) || 0));
  if (b.doors !== undefined) {
    if (!Array.isArray(b.doors) || b.doors.length > 50) throw new Error('Höchstens 50 Türen.');
    const seen = new Set();
    const curDoors = new Set((c.doors || []).map(x => x.id));
    doorMap.clear();
    out.doors = b.doors.map((d, i) => {
      const name = cleanName(d && d.name, 30);
      if (!name) throw new Error(`Tür ${i + 1} braucht einen Namen.`);
      const type = TYPES[d.type] ? d.type : null;
      if (!type) throw new Error(`${name}: bitte die Art wählen.`);
      const ref = String(d.ref || '').trim();
      if (!new RegExp(`^(${TYPES[type].join('|')})\\.[a-z0-9_]+$`).test(ref)) throw new Error(`${name}: bitte ein passendes Gerät auswählen.`);
      { const own = H.entityOwner(ref); if (own) throw new Error(`${name}: „${ref}“ gehört schon zum Modul ${own} und kann hier nicht verwendet werden.`); }
      const sensor = String(d.sensor || '').trim();
      if (sensor && !/^binary_sensor\.[a-z0-9_]+$/.test(sensor)) throw new Error(`${name}: ungültiger Türkontakt.`);
      // vorhandene Tür behält ihre ID; eine neue ID wird nur angenommen, wenn sie hier noch nie vergeben war – sonst neu
      const keep = !seen.has(d.id) && (curDoors.has(String(d.id)) || freshId(used, d.id, /^[a-f0-9]{8}$/));
      const id = keep ? String(d.id) : newId(used);
      if (!curDoors.has(id)) idsChanged = true;
      if (d.id) doorMap.set(String(d.id), id);
      seen.add(id);
      return { id, name, type, ref, sensor, pulseSec: Math.max(1, Math.min(30, parseInt(d.pulseSec, 10) || 3)) };
    });
    // Türen, die es nicht mehr gibt, aus den Profilen entfernen
    for (const p of out.profiles) if (p.doors !== 'all') p.doors = (p.doors || []).map(id => doorMap.get(id) || id).filter(id => seen.has(id));
  }
  if (b.profiles !== undefined) {
    if (!Array.isArray(b.profiles) || !b.profiles.length || b.profiles.length > 30) throw new Error('Mindestens ein, höchstens 30 Zeitprofile.');
    const doorIds = new Set(out.doors.map(d => d.id));
    const curProfiles = new Set((c.profiles || []).map(x => x.id));
    const seen = new Set();
    out.profiles = b.profiles.map((p, i) => {
      const name = cleanName(p && p.name, 30);
      if (!name) throw new Error(`Zeitprofil ${i + 1} braucht einen Namen.`);
      const windows = {};
      for (let d = 0; d < 7; d++) {
        const list = Array.isArray(p.windows && p.windows[d]) ? p.windows[d] : [];
        windows[d] = list.slice(0, 6).map(([a, z]) => {
          const am = toMin(a), zm = toMin(z);
          if (am === null || zm === null || am > 1440 || zm > 1440 || am === zm || am >= 1440) throw new Error(`${name}: ungültige Uhrzeit am ${DAYS[d]} (Format 07:00–23:00).`);
          return [`${pad(Math.floor(am / 60))}:${pad(am % 60)}`, `${pad(Math.floor(zm / 60))}:${pad(zm % 60)}`];
        });
      }
      const keep = !seen.has(p.id) && (curProfiles.has(String(p.id)) || freshId(used, p.id, /^[a-z0-9]{3,20}$/));
      const id = keep ? String(p.id) : newId(used);
      if (!curProfiles.has(id)) idsChanged = true;
      seen.add(id);
      return { id, name, doors: p.doors === 'all' ? 'all' : (Array.isArray(p.doors) ? p.doors.map(x => doorMap.get(String(x)) || x).filter(x => doorIds.has(x)) : []), windows, isDefault: Boolean(p.isDefault) };
    });
    const defs = out.profiles.filter(p => p.isDefault);
    out.profiles.forEach(p => { p.isDefault = false; });
    (defs[0] || out.profiles[0]).isDefault = true;
    profilesChanged = true;
  }
  if (b.blockDays !== undefined) {
    if (!Array.isArray(b.blockDays) || b.blockDays.length > 50) throw new Error('Ungültige Sperrtage.');
    out.blockDays = b.blockDays.map(x => {
      const from = String(x.from || ''), to = String(x.to || x.from || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) throw new Error('Sperrtage: bitte gültige Daten (von ≤ bis).');
      return { from, to, note: cleanName(x.note, 60) || '' };
    }).sort((a, b2) => a.from.localeCompare(b2.from));
  }
  const commit = () => {
    if (idsChanged) saveUsedIds(used);
    if (profilesChanged) {   // Mitglieder mit gelöschtem Profil → Standard
      const def = out.profiles.find(p => p.isDefault).id;
      const ids = out.profiles.map(p => p.id);
      db.prepare(`UPDATE member_access SET profile = ? WHERE module = 'zugang' AND (profile IS NULL OR profile NOT IN (${ids.map(() => '?').join(',')}))`).run(def, ...ids);
    }
  };
  return { out, commit };
}

function activate(ctx) {
  try { clubNet = ctx.require('./memberapp').isClubNet; } catch (e) { clubNet = null; }
  ({ db, getSetting, setSetting, audit } = ctx); ({ lastFirst } = ctx.require('./db'));
  express = ctx.require('express');
  H = ctx;
  createTables();
  const { need, bad, cleanName } = ctx;
  ctx.hooks.tabletVisible = () => { const c = cfg(); return Boolean(c.header && c.doors.length); };
  ctx.hooks.usedEntities = () => cfg().doors.map(d => d.ref);
  // Beim Beenden (Update, Neustart): laufende Türimpulse sofort abschalten – sonst bliebe ein Türöffner-Relais an
  ctx.hooks.shutdown = async () => { const p = [...pulseTimers.values()]; for (const t of p) clearTimeout(t.timer); await Promise.all(p.map(t => t.off())); };
  access = ctx.access;
  const tr = express.Router(); tabletRoutes(tr, ctx); ctx.tablet.use(tr);
  memberRoutes(ctx.member, ctx);
  ctx.hooks.accessOptions = () => { const c = cfg(); return { profiles: c.profiles.map(p => ({ id: p.id, name: p.name, isDefault: p.isDefault, text: profileText(p) })), defaultProfile: (c.profiles.find(p => p.isDefault) || c.profiles[0]).id }; };
  /* Funktionsexport/-import: Türen, Zeitprofile, Sperrtage, Einstellungen – ohne Freischaltungen und Protokoll */
  ctx.hooks.exportConfig = () => { const c = cfg(); const { blockAll, ...rest } = c; void blockAll; return rest; };
  ctx.hooks.importConfig = data => {
    if (!data || typeof data !== 'object') throw new Error('Leere Funktionsdatei.');
    const keys = ['vendor', 'doors', 'profiles', 'wlanOnly', 'header', 'appName', 'subtitle', 'notify', 'openAlertMin', 'blockDays'];
    const { out, commit } = cleanCfg(Object.fromEntries(keys.filter(k => data[k] !== undefined).map(k => [k, data[k]])), ctx.cleanName);
    db.transaction(() => { save(out); commit(); })(); cache.at = 0;
    return `${out.doors.length} Türen, ${out.profiles.length} Zeitprofile${out.blockDays.length ? `, ${out.blockDays.length} Sperrzeiträume` : ''}`;
  };
  ctx.hooks.overview = async () => {
    const c = cfg();
    const alerts = [];
    if (c.blockAll) alerts.push({ level: 'r', text: 'Zugang ist für alle gesperrt.' });
    let st = null; try { st = await states(); } catch (e) { if (c.doors.length) alerts.push({ level: 'r', text: 'Keine Verbindung zu den Schlössern: ' + e.message }); }
    let open = 0;
    for (const d of c.doors) {
      const x = doorState(d, st);
      if (st && x.offline) alerts.push({ level: 'r', text: `${d.name}: nicht erreichbar` });
      if (x.jammed) alerts.push({ level: 'r', text: `${d.name}: Schloss blockiert` });
      if (x.open) open++;
      if (st && d.type === 'lock' && !x.offline && st.get(d.ref) && st.get(d.ref).state !== 'locked') alerts.push({ level: 'a', text: `${d.name} ist aufgeschlossen` });
    }
    const n = access.list(MOD).length;
    const today0 = localTs().slice(0, 10);
    const opened = db.prepare("SELECT COUNT(*) n FROM zugang_log WHERE at >= ? AND action IN ('auf','oeffnen')").get(today0).n;
    return { kpis: [{ l: 'Türen', v: c.doors.length }, { l: 'Freigeschaltet', v: n }, { l: 'Heute geöffnet', v: opened }, ...(open ? [{ l: 'Türen offen', v: open, warn: true }] : [])], alerts };
  };

  const admin = ctx.admin;
  admin.get('/config', need('zugang'), async (req, res) => {
    const c = cfg();
    let devices = null, filtered = false, error = null;
    try { const d = await deviceList(c); devices = d.list; filtered = d.filtered; } catch (e) { error = e.message; }
    res.json({ cfg: c, vendors: VENDORS.map(({ id, name, setup }) => ({ id, name, setup })), devices, filtered, error, haAvailable: ha.available(),
      profileTexts: Object.fromEntries(c.profiles.map(p => [p.id, profileText(p)])) });
  });
  admin.put('/config', need('zugang'), (req, res) => {
    let out, commit;
    try { ({ out, commit } = cleanCfg(req.body || {}, cleanName)); } catch (e) { return bad(res, e.message); }   // prüft nur, schreibt nichts
    const before = cfg();
    db.transaction(() => { save(out); commit(); })();   // Konfiguration, vergebene IDs und Zeitprofil-Zuordnungen zusammen
    cache.at = 0;
    if (before.blockAll !== out.blockAll) { log('sperre', req.user.name || req.user.username, null, out.blockAll ? 'Zugang für alle gesperrt' : 'Sperre für alle aufgehoben'); audit(req.user, out.blockAll ? 'Zugang: alle gesperrt' : 'Zugang: Sperre aufgehoben', ''); }
    else audit(req.user, 'Zugang eingerichtet', `${out.doors.length} Türen, ${out.profiles.length} Zeitprofile`);
    // Geänderte Türgeräte (oder ein neues „Wer darf immer“-Profil) dem Vorstand melden
    const refs = c2 => (c2.doors || []).map(d => `${d.name}=${d.ref}`).sort().join(', ');
    if (refs(before) !== refs(out)) H.require('./security').securityAlert(`Im Modul Zugang wurden die Türen geändert (von ${req.user.name || req.user.username}).\n\nVorher: ${refs(before) || '–'}\nJetzt: ${refs(out) || '–'}\n\nWar das so geplant? Sonst bitte in der Verwaltung prüfen.`, 'zugang-tueren-' + Date.now());
    res.json({ ok: true, cfg: out, profileTexts: Object.fromEntries(out.profiles.map(p => [p.id, profileText(p)])) });
  });
  admin.get('/doors', need('zugang'), async (req, res) => {
    const c = cfg();
    let st = null, error = null; try { st = await states(true); } catch (e) { error = e.message; }
    res.json({ error, blockAll: c.blockAll, doors: c.doors.map(d => ({ id: d.id, name: d.name, type: d.type, ...doorState(d, st) })) });
  });
  admin.post('/doors/:id/:action', need('zugang'), async (req, res) => {
    const door = cfg().doors.find(d => d.id === req.params.id);
    const action = ['auf', 'zu', 'oeffnen'].includes(req.params.action) ? req.params.action : null;
    if (!door || !action) return bad(res, 'Unbekannte Tür oder Aktion.', 404);
    const who = req.user.name || req.user.username;
    try { await act(door, action === 'oeffnen' ? 'auf' : action); log(action, who, door.name, 'Fernbedienung aus der Verwaltung'); audit(req.user, 'Zugang: Fernbedienung', `${door.name}: ${action}`); res.json({ ok: true }); }
    catch (e) { log('fehler', who, door.name, e.message); bad(res, `${door.name} reagiert nicht: ${e.message}`, 502); }
  });
  /* Freischaltungen: zentral in der Mitglieder-App (src/memberapp.js) – hier nur die Übersicht fürs Modul */
  admin.get('/members', need('zugang'), (req, res) => {
    const c = cfg();
    const rows = access.list(MOD).map(a => {
      const d = db.prepare("SELECT device, last_used, token_hash IS NOT NULL AS paired, invite_expires FROM member_devices WHERE scope = ? AND member_id = ?").get(APP, a.member_id);
      return { member_id: a.member_id, name: a.name, profile: a.profile, valid_until: a.valid_until, blocked: Boolean(a.blocked),
        device: d ? (d.paired ? 'gekoppelt' : d.invite_expires >= Date.now() ? 'eingeladen' : 'abgelaufen') : 'ohne Handy', device_label: d ? d.device : null, last_used: d ? d.last_used : null };
    });
    const have = new Set(rows.map(r => r.member_id));
    const members = db.prepare("SELECT id, name, kind FROM members WHERE kind IN ('mitglied','nichtmitglied') AND active = 1 AND deleted = 0 AND pending = 0 ORDER BY name_key(name, kind)").all().filter(m => !have.has(m.id));
    res.json({ rows, members, profiles: c.profiles.map(p => ({ id: p.id, name: p.name, isDefault: p.isDefault })) });
  });
  /* Protokoll */
  const nextMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`; };
  const monthRows = m => db.prepare('SELECT * FROM zugang_log WHERE at >= ? AND at < ? ORDER BY at DESC, id DESC').all(m + '-01', nextMonth(m) + '-01');
  admin.get('/log', need('zugang'), (req, res) => {
    const months = db.prepare('SELECT DISTINCT substr(at,1,7) m FROM zugang_log ORDER BY m DESC').all().map(r => r.m);
    const cur = localTs().slice(0, 7);
    if (!months.includes(cur)) months.unshift(cur);
    const m = /^\d{4}-\d{2}$/.test(String(req.query.month)) ? String(req.query.month) : cur;
    res.json({ month: m, months, rows: monthRows(m) });
  });
  async function logXlsx(m) {
    const ExcelJS = ctx.require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Zugang ' + m);
    ws.columns = [{ header: 'Zeitpunkt', key: 'at', width: 18 }, { header: 'Aktion', key: 'action', width: 16 }, { header: 'Tür', key: 'door', width: 22 }, { header: 'Wer', key: 'who', width: 24 }, { header: 'Hinweis', key: 'detail', width: 50 }];
    ws.getRow(1).font = { bold: true };
    const A = { auf: 'Aufgeschlossen', zu: 'Abgeschlossen', oeffnen: 'Geöffnet', abgelehnt: 'Abgelehnt', fehler: 'Fehler', freischaltung: 'Freischaltung', alarm: 'Alarm', sperre: 'Sperre' };
    for (const r of monthRows(m).reverse()) ws.addRow({ ...r, at: r.at.slice(0, 10).split('-').reverse().join('.') + ' ' + r.at.slice(11, 16), action: A[r.action] || r.action });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  // lesbarer Auszug für die nächtliche Datensicherung (Kern): Türprotokoll des laufenden Monats
  ctx.hooks.backupExports = async () => { const m = localTs().slice(0, 7); return [{ name: `Zugang-Protokoll_${m}.xlsx`, buffer: await logXlsx(m) }]; };
  admin.get('/log.xlsx', need('zugang'), async (req, res) => {
    const m = /^\d{4}-\d{2}$/.test(String(req.query.month)) ? String(req.query.month) : localTs().slice(0, 7);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="zugang-${m}.xlsx"`);
    res.end(await logXlsx(m));
  });


  setInterval(() => { if (ctx.isActive()) watch(); }, 30000).unref();
}

module.exports = { activate, profileAllows, profileText, nextAllowed };
