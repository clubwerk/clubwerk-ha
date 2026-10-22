'use strict';
/* Push-Benachrichtigungen der Mitglieder-App (Web Push, auch iPhone ab iOS 16.4 als Home-Bildschirm-App).
   - Module melden ihre Anlässe an: hooks.pushEvents = () => [{ id, label, desc, default, lead: { default, label } }]
     (Anlass-Kennung im System: "<modul>.<id>", der Kern selbst: "app.test")
   - Der Vorstand legt fest, welche Anlässe es im Verein gibt (Einstellung push_events: { "<modul>.<id>": { on, lead } });
     nicht freigegebene Anlässe sieht kein Mitglied, und es wird dafür nichts gesendet.
   - Das Mitglied schaltet Push je Handy ein (Browser-Abo) und je Anlass an/aus (Vorgabe: an).
   - Versand: Module rufen ctx.push.send(memberIds, "<modul>.<id>", { title, body, url, tag }) – der Kern prüft Freigabe und Abos,
     verschickt verschlüsselt an den Push-Dienst des Handys (Apple/Google/Mozilla) und räumt erloschene Abos weg.
   - Es werden nur kurze Hinweise gesendet (Titel + ein Satz) – nichts, was in der App PIN-pflichtig ist. */
const http = require('http');
const https = require('https');
const webpush = require('web-push');
const { db, getSetting, setSetting, audit } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS push_subs (
  id         INTEGER PRIMARY KEY,
  member_id  INTEGER NOT NULL,
  device_id  INTEGER,                              -- member_devices.id (Handy), für Aufräumen bei Entkopplung
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  events     TEXT,                                 -- JSON { "<modul>.<id>": false } – nur Abweichungen von „an“
  label      TEXT,                                 -- Gerätebeschreibung
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  last_ok    TEXT,
  fails      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_push_member ON push_subs(member_id);
CREATE TABLE IF NOT EXISTS push_log (
  id        INTEGER PRIMARY KEY,
  ts        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  member_id INTEGER,
  event     TEXT NOT NULL,
  title     TEXT,
  ok        INTEGER NOT NULL,
  info      TEXT
);
`);

/* ---------- Schlüssel (VAPID): einmal erzeugen, dauerhaft behalten – sonst verlieren alle Handys ihr Abo ---------- */
function keys() {
  let pub = getSetting('push_vapid_pub', ''), priv = getSetting('push_vapid_priv', '');
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    pub = k.publicKey; priv = k.privateKey;
    setSetting('push_vapid_pub', pub); setSetting('push_vapid_priv', priv);
  }
  return { pub, priv };
}
/** Absender für den Push-Dienst (Pflicht): mailto: der Vereinsadresse oder die öffentliche Adresse der App */
function subject() {
  const from = String(getSetting('mail_smtp_from', '') || '').match(/[^\s<>"]+@[^\s<>"]+/);
  if (from) return 'mailto:' + from[0];
  const u = String(getSetting('ext_tunnel_url', '') || getSetting('app_url', '') || '');
  return /^https:\/\//i.test(u) ? u : 'https://github.com/clubwerk/clubwerk-ha';
}

/* ---------- Anlässe ---------- */
let modulesRef = () => [];   // vom Kern gesetzt: () => [[id, { name, label, hooks, isActive }]]
const CORE_EVENTS = [{ id: 'test', label: 'Testnachricht', desc: 'Zum Ausprobieren – vom Mitglied selbst oder vom Vorstand ausgelöst.', default: true }];
function catalog() {
  const out = CORE_EVENTS.map(e => ({ ...e, key: 'app.' + e.id, module: 'app', moduleName: 'Mitglieder-App' }));
  for (const [id, m] of modulesRef()) {
    let ev = []; try { ev = m.hooks && typeof m.hooks.pushEvents === 'function' ? m.hooks.pushEvents() : []; } catch (e) { ev = []; }
    for (const e of ev || []) if (e && /^[a-z0-9_]{1,30}$/.test(String(e.id))) out.push({ ...e, key: `${id}.${e.id}`, module: id, moduleName: m.label || m.name || id });
  }
  return out;
}
const adminCfg = () => { try { const v = JSON.parse(getSetting('push_events', '') || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
/** Anlässe mit Vorstandsentscheidung: on (freigegeben) und lead (Vorlauf in Minuten, falls der Anlass einen hat) */
function events() {
  const c = adminCfg();
  return catalog().map(e => {
    const s = c[e.key] || {};
    const on = s.on !== undefined ? Boolean(s.on) : e.default !== false;
    const lead = e.lead ? Math.max(5, Math.min(7 * 24 * 60, Number(s.lead) || e.lead.default || 120)) : null;
    return { ...e, on, lead };
  });
}
const enabled = key => { const e = events().find(x => x.key === key); return Boolean(e && e.on); };
const lead = key => { const e = events().find(x => x.key === key); return e && e.lead ? e.lead : null; };
function saveAdmin(body, user) {
  const c = adminCfg(), cat = catalog();
  for (const [k, v] of Object.entries(body && typeof body === 'object' ? body : {})) {
    const e = cat.find(x => x.key === k); if (!e || !v || typeof v !== 'object') continue;
    c[k] = { on: v.on !== undefined ? Boolean(v.on) : (c[k] ? c[k].on : e.default !== false) };
    if (e.lead) c[k].lead = Math.max(5, Math.min(7 * 24 * 60, Number(v.lead) || (c[k] && c[k].lead) || e.lead.default || 120));
  }
  setSetting('push_events', JSON.stringify(c));
  audit(user, 'Push-Benachrichtigungen: Anlässe geändert', events().filter(e => e.on).map(e => e.label).join(', ') || 'keine');
}

/* ---------- Abos je Handy ---------- */
const parseEv = s => { try { const v = JSON.parse(s || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
/* Push geht nur an die bekannten Push-Dienste der Browser (Apple, Google/Chrome/Android, Mozilla, Microsoft) –
   so kann ein Handy dem Server kein beliebiges Ziel (z. B. ein internes Gerät) als „Push-Adresse“ unterschieben. */
const PUSH_HOSTS = [/^web\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];
function pushHostOk(endpoint) {
  try { const u = new URL(String(endpoint)); return u.protocol === 'https:' && !u.port && !u.username && !u.password && PUSH_HOSTS.some(r => r.test(u.hostname.toLowerCase())); } catch (e) { return false; }
}
const validSub = s => s && typeof s === 'object' && /^https:\/\/[^\s]{10,1500}$/.test(String(s.endpoint || '')) && pushHostOk(s.endpoint) && s.keys && /^[A-Za-z0-9_\-=]{20,200}$/.test(String(s.keys.p256dh || '')) && /^[A-Za-z0-9_\-=]{10,100}$/.test(String(s.keys.auth || ''));
function subscribe({ memberId, deviceId, label }, sub) {
  if (!validSub(sub)) throw new Error('Das Push-Abo des Browsers ist unvollständig.');
  db.prepare(`INSERT INTO push_subs(member_id, device_id, endpoint, p256dh, auth, label) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET member_id = excluded.member_id, device_id = excluded.device_id, p256dh = excluded.p256dh, auth = excluded.auth, label = excluded.label, fails = 0`)
    .run(memberId, deviceId || null, String(sub.endpoint), String(sub.keys.p256dh), String(sub.keys.auth), String(label || '').slice(0, 80) || null);
  return state(memberId, sub.endpoint);
}
function unsubscribe(memberId, endpoint) {
  return db.prepare('DELETE FROM push_subs WHERE member_id = ? AND endpoint = ?').run(memberId, String(endpoint || '')).changes > 0;
}
function setEvents(memberId, endpoint, ev) {
  const row = db.prepare('SELECT id, events FROM push_subs WHERE member_id = ? AND endpoint = ?').get(memberId, String(endpoint || ''));
  if (!row) throw new Error('Dieses Handy hat kein Push-Abo.');
  const cur = parseEv(row.events), keys = new Set(events().filter(e => e.on).map(e => e.key));
  for (const [k, v] of Object.entries(ev && typeof ev === 'object' ? ev : {})) { if (!keys.has(k)) continue; if (v) delete cur[k]; else cur[k] = false; }
  db.prepare('UPDATE push_subs SET events = ? WHERE id = ?').run(JSON.stringify(cur), row.id);
  return state(memberId, endpoint);
}
/** Stand für die App: Schlüssel, freigegebene Anlässe mit der Wahl dieses Handys, ob dieses Handy ein Abo hat */
function state(memberId, endpoint) {
  const row = endpoint ? db.prepare('SELECT events FROM push_subs WHERE member_id = ? AND endpoint = ?').get(memberId, String(endpoint)) : null;
  const mine = parseEv(row ? row.events : null);
  return { vapid: keys().pub, subscribed: Boolean(row), events: events().filter(e => e.on).map(e => ({ key: e.key, label: e.label, desc: e.desc || '', module: e.moduleName, on: mine[e.key] !== false })) };
}
const removeMember = memberId => db.prepare('DELETE FROM push_subs WHERE member_id = ?').run(memberId).changes;
const removeDevice = deviceId => db.prepare('DELETE FROM push_subs WHERE device_id = ?').run(deviceId).changes;

/* ---------- Versand ---------- */
function log(memberId, event, title, ok, info) {
  db.prepare('INSERT INTO push_log(member_id, event, title, ok, info) VALUES (?, ?, ?, ?, ?)').run(memberId || null, event, String(title || '').slice(0, 120), ok ? 1 : 0, info ? String(info).slice(0, 200) : null);
  if (Math.random() < 0.02) db.prepare('DELETE FROM push_log WHERE id NOT IN (SELECT id FROM push_log ORDER BY id DESC LIMIT 2000)').run();
}
/** Eine Nachricht an ein Abo – über http(s) je nach Endpunkt (Tests nutzen einen lokalen Empfänger) */
function deliver(row, payload) {
  const { pub, priv } = keys();
  const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
  const d = webpush.generateRequestDetails(sub, payload, { TTL: 3600, urgency: 'normal', vapidDetails: { subject: subject(), publicKey: pub, privateKey: priv } });
  const u = new URL(d.endpoint);
  if (!pushHostOk(d.endpoint)) return Promise.resolve({ status: 410, text: 'kein bekannter Push-Dienst' });
  const mod = u.protocol === 'http:' ? http : https;
  return new Promise(resolve => {
    const rq = mod.request({ hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method: d.method, headers: d.headers, timeout: 10000 }, res => {
      let txt = ''; res.on('data', c => { if (txt.length < 500) txt += c; }); res.on('end', () => resolve({ status: res.statusCode, text: txt }));
    });
    rq.on('timeout', () => { rq.destroy(new Error('Zeitüberschreitung')); });
    rq.on('error', e => resolve({ status: 0, text: e.message }));
    if (d.body) rq.write(d.body);
    rq.end();
  });
}
/** Nachricht an Mitglieder – nur für freigegebene Anlässe und nur an Handys, die den Anlass nicht abgewählt haben */
async function send(memberIds, key, { title, body, url, tag } = {}, opts = {}) {
  const ids = [...new Set((Array.isArray(memberIds) ? memberIds : [memberIds]).map(Number).filter(Boolean))];
  if (!ids.length || !title) return { sent: 0, skipped: 'leer' };
  if (!enabled(key)) return { sent: 0, skipped: 'Anlass nicht freigegeben' };
  const payload = JSON.stringify({ title: String(title).slice(0, 80), body: String(body || '').slice(0, 200), url: url ? String(url).slice(0, 200) : '', tag: tag ? String(tag).slice(0, 60) : key });
  let sent = 0;
  for (const mid of ids) {
    const m = db.prepare('SELECT active, deleted FROM members WHERE id = ?').get(mid);
    if (!m || !m.active || m.deleted) { db.prepare('DELETE FROM push_subs WHERE member_id = ?').run(mid); continue; }
    const rows = db.prepare('SELECT * FROM push_subs WHERE member_id = ?' + (opts.endpoint ? ' AND endpoint = ?' : '')).all(...(opts.endpoint ? [mid, opts.endpoint] : [mid]));
    for (const r of rows) {
      // Welche Anlässe kommen, legt der Vorstand zentral fest (push_events) – das Mitglied schaltet je Handy nur an oder aus
      const res = await deliver(r, payload);
      if (res.status >= 200 && res.status < 300) { sent++; db.prepare("UPDATE push_subs SET last_ok = datetime('now','localtime'), fails = 0 WHERE id = ?").run(r.id); log(mid, key, title, true, null); }
      else if (res.status === 404 || res.status === 410) { db.prepare('DELETE FROM push_subs WHERE id = ?').run(r.id); log(mid, key, title, false, `Abo erloschen (${res.status})`); }
      else { db.prepare('UPDATE push_subs SET fails = fails + 1 WHERE id = ?').run(r.id); log(mid, key, title, false, `${res.status || 'Fehler'}: ${String(res.text || '').slice(0, 120)}`); }
    }
  }
  // Abos mit vielen Fehlschlägen in Folge aufgeben (Push-Dienst antwortet dauerhaft nicht)
  db.prepare('DELETE FROM push_subs WHERE fails >= 20').run();
  return { sent };
}

/** Verwaltung: Überblick */
function adminState() {
  const ev = events();
  const subs = db.prepare('SELECT COUNT(*) n, COUNT(DISTINCT member_id) m FROM push_subs').get();
  const members = db.prepare('SELECT DISTINCT s.member_id id, m.name, m.kind FROM push_subs s JOIN members m ON m.id = s.member_id ORDER BY name_key(m.name, m.kind)').all();
  const recent = db.prepare('SELECT l.ts, l.event, l.title, l.ok, l.info, m.name member FROM push_log l LEFT JOIN members m ON m.id = l.member_id ORDER BY l.id DESC LIMIT 40').all();
  return { events: ev, subs: subs.n, members: subs.m, subscribed: members, recent, subject: subject() };
}

module.exports = { pushHostOk, setModules: fn => { modulesRef = fn; }, catalog, events, enabled, lead, saveAdmin, subscribe, unsubscribe, setEvents, state, send, removeMember, removeDevice, adminState, keys };
