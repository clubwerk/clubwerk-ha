'use strict';
/* ---------- Beregnung: manuelle Platzberegnung für Mitglieder ----------
   Zeitpläne, Wetteranpassung, Pausen usw. bleiben in der Steuerung des Herstellers (Hydrawise, Rain Bird …).
   Dieses Modul kann nur: Platz starten (Zonen strikt nacheinander – es läuft nie mehr als eine Zone gleichzeitig,
   wegen des Wasserdrucks), alles stoppen, Status/Countdown anzeigen, protokollieren.
   Anbindung:
     ha        – über Home Assistant: jede Zone ist ein Ventil (valve.*) oder Schalter (switch.*); herstellerneutral
     hydrawise – direkt über die Hydrawise-Schnittstelle mit API-Key (wie die alte Raspberry-Pi-Lösung)
   Die Abfolge wird in der Datenbank gespeichert und übersteht einen Neustart.
   Die Webapp ist zusätzlich über einen eigenen Port erreichbar (Standard 5000), dort gibt es nur die Beregnung. */
const path = require('path');
let db, getSetting, setSetting, audit, auth, H, express;

/* Hersteller im Auswahlfeld der Verwaltung. backend 'ha' = über Home Assistant (Integration filtert die Geräteliste),
   'hydrawise' = direkt über die Hydrawise-Schnittstelle. Neue Hersteller: einfach hier ergänzen. */
const VENDORS = [
  { id: 'hydrawise', name: 'Hunter Hydrawise (über Home Assistant)', backend: 'ha', integration: 'hydrawise', domains: ['valve'], setup: 'Integration „Hunter Hydrawise“ (je Zone ein Ventil)' },
  { id: 'hydrawise_api', name: 'Hunter Hydrawise (direkt mit API-Key)', backend: 'hydrawise', setup: 'API-Key aus hydrawise.com → Konto → Einstellungen' },
  { id: 'rainbird', name: 'Rain Bird', backend: 'ha', integration: 'rainbird', setup: 'Integration „Rain Bird“' },
  { id: 'rachio', name: 'Rachio', backend: 'ha', integration: 'rachio', setup: 'Integration „Rachio“' },
  { id: 'opensprinkler', name: 'OpenSprinkler', backend: 'ha', integration: 'opensprinkler', setup: 'Integration „OpenSprinkler“ (über HACS)' },
  { id: 'bhyve', name: 'Orbit B-hyve', backend: 'ha', integration: 'bhyve', setup: 'Integration „Orbit B-hyve“ (über HACS)' },
  { id: 'gardena', name: 'Gardena smart system', backend: 'ha', integration: 'gardena_smart_system', setup: 'Integration „Gardena Smart System“ (über HACS)' },
  { id: 'shelly', name: 'Shelly-Relais an Magnetventilen', backend: 'ha', integration: 'shelly', setup: 'Integration „Shelly“' },
  { id: 'esphome', name: 'ESPHome (Eigenbau)', backend: 'ha', integration: 'esphome', setup: 'Integration „ESPHome“' },
  { id: 'other', name: 'Anderer Hersteller (alle Ventile/Schalter aus Home Assistant)', backend: 'ha', integration: null, setup: 'passende Integration in Home Assistant' },
];
const vendorOf = c => VENDORS.find(v => v.id === c.vendor) || VENDORS.find(v => v.id === (c.backend === 'hydrawise' ? 'hydrawise_api' : 'other'));
const DEF = {
  backend: 'ha', vendor: '', mode: 'pin', stopFree: false, cooldownMin: 0, header: false,
  appName: 'Beregnung', webappUrl: '', subtitle: 'Bewässerungssteuerung', nextEntity: '', notify: '', plaetze: [],
};
const ha = require('../../src/ha');   // Home Assistant (gemeinsam mit Beregnung bzw. Zugang)
const G = require('../../src/geraete');   // Geräte neu zuordnen: Rechte und eigenes Passwort
const HW_BASE = () => (process.env.HYDRAWISE_BASE || 'https://api.hydrawise.com/api/v1').replace(/\/$/, '');
const { pad, nowTs: localTs } = require('../../src/util');   // gemeinsame Helfer des Kerns (auch als ctx.util)
const hhmm = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function cfg() {
  let c = {};
  try { c = JSON.parse(getSetting('ext_beregnung_cfg', '{}')) || {}; } catch (e) { c = {}; }
  const out = { ...DEF, ...c, plaetze: Array.isArray(c.plaetze) ? c.plaetze : [] };
  const v = vendorOf(out); out.vendor = v.id; out.backend = v.backend;
  if (out.mode === 'invite') out.mode = 'app';   // 2.1: eigene Einladungen → gemeinsame Mitglieder-App
  return out;
}

function createTables() {
  db.exec(`
CREATE TABLE IF NOT EXISTS irr_steps (
  id       INTEGER PRIMARY KEY,
  run_id   INTEGER NOT NULL,
  platz    INTEGER NOT NULL,          -- Index in der Platzliste
  label    TEXT,
  ref      TEXT NOT NULL,             -- Home-Assistant-Entität bzw. Hydrawise-Zonennummer
  sec      INTEGER NOT NULL,
  start_at INTEGER NOT NULL,          -- ms
  end_at   INTEGER NOT NULL,          -- ms
  state    TEXT NOT NULL DEFAULT 'wait', -- wait | run | done | stopped | fail
  err      TEXT
);
CREATE INDEX IF NOT EXISTS ix_irr_steps_state ON irr_steps(state, start_at);
CREATE TABLE IF NOT EXISTS irr_log (
  id     INTEGER PRIMARY KEY,
  at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  who    TEXT,
  action TEXT NOT NULL,               -- start | stop | fehler
  platz  TEXT,
  sec    INTEGER,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS ix_irr_log_at ON irr_log(at);
`);
}
const log = (action, who, platz, sec, detail) =>
  db.prepare('INSERT INTO irr_log(at, who, action, platz, sec, detail) VALUES (?,?,?,?,?,?)').run(localTs(), who || null, action, platz ?? null, sec ?? null, detail || null);

/* =================== Anbindung =================== */
/* Hydrawise bremst je Konto: höchstens 3 Schaltbefehle in 30 s und 30 Aufrufe in 5 min, sonst Antwort 429. Das Konto teilen sich oft
   weitere Programme (Home-Assistant-Integration, alte Webapp) – darum zählt Clubwerk die eigenen Aufrufe und wartet lieber vorher,
   hält nach einer 429 Abstand, vergisst den letzten Stand der Steuerung nie wegen eines Fehlers und verliert nie einen Stopp
   (er wird gespeichert und nachgeholt, sobald die Steuerung wieder annimmt). */
const HW = { calls: [], ctl: [], until: 0 };
const HW_CTL = 3, HW_CTL_MS = 30000, HW_ALL_MS = 300000, HW_READS = 20, HW_ALL = 28;   // Abfragen nur bis 20 je 5 min – der Rest bleibt für Schaltbefehle
function rateErr(ms) { return Object.assign(new Error('Die Steuerung bremst gerade (zu viele Anfragen).'), { rate: true, wait: Math.max(1000, ms) }); }
/** Wie lange (ms) bis zum nächsten erlaubten Aufruf? kind: 'ctl' (Stopp), 'start' oder 'read' (Abfrage) */
function hwWait(kind) {
  const now = Date.now();
  HW.calls = HW.calls.filter(t => now - t < HW_ALL_MS); HW.ctl = HW.ctl.filter(t => now - t < HW_CTL_MS);
  let w = HW.until - now;
  const max = kind === 'read' ? HW_READS : HW_ALL;
  if (HW.calls.length >= max) w = Math.max(w, HW.calls[HW.calls.length - max] + HW_ALL_MS - now);
  const n = kind === 'start' ? HW_CTL - 1 : HW_CTL;   // ein Start lässt immer einen Schaltbefehl für einen Stopp frei
  if (kind !== 'read' && HW.ctl.length >= n) w = Math.max(w, HW.ctl[HW.ctl.length - n] + HW_CTL_MS - now);
  return Math.max(0, w);
}
const SHARED = n => `Hydrawise hat in den letzten 24 Stunden ${n}-mal gebremst (zu viele Anfragen). Teilt sich das Hydrawise-Konto mit anderen Programmen (z. B. der Hydrawise-Integration in Home Assistant oder einer alten Webapp)? Dann diese seltener abfragen lassen oder abschalten.`;
/** 429 der letzten 24 Std. (für den Hinweis in der Verwaltung) */
const hwHits = () => { let a = []; try { a = JSON.parse(getSetting('ext_beregnung_hw_429', '[]')); } catch (e) { a = []; } return (Array.isArray(a) ? a : []).filter(t => Date.now() - t < 86400000); };
async function hwCall(endpoint, params = {}, kind = 'read') {
  // Schlüssel im Tresor (ctx.geheim): nach einem Neustart verschlossen, bis sich ein Admin anmeldet – Stopps bleiben gespeichert und werden dann nachgeholt
  if (H.geheim.locked('hw_key')) throw new Error('Der Tresor ist seit dem Neustart gesperrt – der Hydrawise-API-Key ist verschlossen, bis sich ein Admin anmeldet.');
  const key = H.geheim.get('hw_key', '');
  if (!key) throw new Error('Kein Hydrawise-API-Key eingetragen.');
  const w = hwWait(kind);
  if (w > 0) throw rateErr(w);
  HW.calls.push(Date.now());
  const qs = new URLSearchParams({ ...params, api_key: key });
  const r = await fetch(`${HW_BASE()}/${endpoint}?${qs}`, { headers: { 'User-Agent': 'Clubwerk-Beregnung/1.0' }, signal: AbortSignal.timeout(15000) });
  if (r.status === 429) {
    const ra = parseInt(r.headers.get('retry-after'), 10);
    const ms = Math.min(300000, ra > 0 ? ra * 1000 : HW_CTL_MS);
    HW.until = Date.now() + ms;
    setSetting('ext_beregnung_hw_429', JSON.stringify([...hwHits(), Date.now()].slice(-200)));
    throw rateErr(ms);
  }
  if (!r.ok) throw new Error(`Hydrawise antwortet mit ${r.status}`);
  if (kind !== 'read') HW.ctl.push(Date.now());   // nur angenommene Schaltbefehle zählen – nach einer 429 hält HW.until Abstand
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return { message: t }; }
}

let cache = { at: 0, data: null, err: null, backend: null, ttl: 4000 };
/** Letzte bekannte Zuordnung Zonennummer → relay_id (übersteht Fehler und Neustarts) */
const relayMap = () => { try { return JSON.parse(getSetting('ext_beregnung_hw_relays', '{}')) || {}; } catch (e) { return {}; } };
/** Zustand der Steuerung: { zones: {ref: {running, remain}}, list: [{ref, name}], next: ms|null } */
async function readController(force) {
  const c = cfg();
  const hw = c.backend === 'hydrawise';
  const fresh = cache.backend === c.backend && Date.now() - cache.at < cache.ttl;
  // Hydrawise: auch „erzwungen“ höchstens alle 10 s – sonst zehrt jede offene Seite am gemeinsamen Kontingent
  if (fresh && (!force || (hw && Date.now() - cache.at < 10000))) { if (cache.err && !(cache.err.rate && cache.data)) throw cache.err; return cache.data; }
  // Stopp vorgemerkt: keine Abfrage, die ihm das Kontingent wegnimmt – der letzte Stand reicht bis dahin
  if (hw && cache.backend === c.backend && cache.data && pendingStop()) return cache.data;
  // viele offene Handys gleichzeitig: nur eine Abfrage, alle warten auf dieselbe Antwort
  if (reading && reading.backend === c.backend) return reading.p;
  const p = readNow(c, hw);
  reading = { backend: c.backend, p };
  try { return await p; } finally { if (reading && reading.p === p) reading = null; }
}
let reading = null;
async function readNow(c, hw) {
  try {
    let data, ttl = 4000;
    if (hw) {
      const s = await hwCall('statusschedule.php');
      const relays = Array.isArray(s.relays) ? s.relays : [];
      const zones = {}; let next = null;
      for (const z of relays) {
        const t = parseInt(z.time, 10);
        zones[String(z.relay)] = { running: t === 1, remain: t === 1 ? parseInt(z.run, 10) || null : null, relay_id: z.relay_id };
        if (t > 1 && (next === null || t * 1000 + Date.now() < next)) next = Date.now() + t * 1000;
      }
      data = { zones, list: relays.map(z => ({ ref: String(z.relay), name: `Zone ${z.relay}${z.name ? ' – ' + z.name : ''}` })), next };
      // so oft abfragen, wie Hydrawise es erlaubt (nextpoll), mindestens 30 s
      ttl = Math.max(30000, Math.min(600000, (parseInt(s.nextpoll, 10) || 0) * 1000));
      const map = Object.fromEntries(relays.filter(z => z.relay_id).map(z => [String(z.relay), z.relay_id]));
      if (Object.keys(map).length && JSON.stringify(map) !== JSON.stringify(relayMap())) setSetting('ext_beregnung_hw_relays', JSON.stringify(map));
    } else {
      const states = await ha.call('GET', '/states');
      const zones = {}, list = [], sensors = [];
      for (const s of Array.isArray(states) ? states : []) {
        const dom = s.entity_id.split('.')[0];
        const name = (s.attributes && s.attributes.friendly_name) || s.entity_id;
        if (dom === 'valve' || dom === 'switch') {
          zones[s.entity_id] = { running: ['on', 'open', 'opening'].includes(s.state), remain: null, unavailable: ['unavailable', 'unknown'].includes(s.state) };
          list.push({ ref: s.entity_id, name: `${name} (${s.entity_id})` });
        } else if (dom === 'sensor' && s.attributes && s.attributes.device_class === 'timestamp') {
          sensors.push({ ref: s.entity_id, name: `${name} (${s.entity_id})`, state: s.state });
        }
      }
      let next = null;
      const ne = c.nextEntity && sensors.find(x => x.ref === c.nextEntity);
      if (ne) { const t = Date.parse(ne.state); if (!Number.isNaN(t) && t > Date.now()) next = t; }
      list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      // nur Geräte des gewählten Herstellers anbieten (falls Home Assistant das verrät)
      let shown = list, filtered = false;
      const v = vendorOf(c);
      if (v.integration) {
        try {
          const ids = await ha.integrationEntities(v.integration);
          const set = new Set(Array.isArray(ids) ? ids : []);
          const f = list.filter(x => set.has(x.ref) && (!v.domains || v.domains.includes(x.ref.split('.')[0])));
          if (f.length) { shown = f; filtered = true; }
        } catch (e) { /* ältere Versionen: alles anbieten */ }
      }
      data = { zones, list: shown, filtered, sensors: sensors.map(({ ref, name }) => ({ ref, name })), next };
    }
    cache = { at: Date.now(), data, err: null, backend: c.backend, ttl };
    return data;
  } catch (e) {
    // Den letzten guten Stand nie wegen eines Fehlers vergessen. Bremst Hydrawise, gilt er weiter (mit Hinweis) – bis die Pause um ist.
    const keep = cache.backend === c.backend ? cache.data : null;
    if (e.rate && keep) { cache = { ...cache, err: e, at: Date.now(), ttl: e.wait }; return keep; }
    cache = { at: Date.now(), data: keep, err: e, backend: c.backend, ttl: e.rate ? e.wait : cache.ttl };
    throw e;
  }
}
/** Bekannten Zustand nach einem Schaltbefehl selbst nachführen – statt die Steuerung sofort neu abzufragen */
function markZone(ref, running, sec) {
  const d = cache.data; if (!d || !d.zones) return;
  if (ref === null) { for (const z of Object.values(d.zones)) { z.running = false; z.remain = null; } return; }
  if (d.zones[ref]) Object.assign(d.zones[ref], { running, remain: running ? sec : null });
}
async function relayId(ref) {
  const z = cache.data && cache.data.zones && cache.data.zones[ref];
  if (z && z.relay_id) return z.relay_id;
  const m = relayMap()[ref];
  if (m) return m;
  const d = await readController(true);
  if (!d.zones[ref]) throw Object.assign(new Error(`Zone ${ref} gibt es in Hydrawise nicht.`), { gone: true });
  return d.zones[ref].relay_id;
}

async function zoneOn(ref, sec) {
  const c = cfg();
  if (c.backend === 'hydrawise') {
    const id = await relayId(ref);
    await hwCall('setzone.php', { action: 'run', period_id: 999, relay_id: id, custom: sec }, 'start');
    markZone(ref, true, sec);
    return;
  }
  const dom = ref.split('.')[0];
  if (dom === 'valve') await ha.call('POST', '/services/valve/open_valve', { entity_id: ref });
  else await ha.call('POST', '/services/switch/turn_on', { entity_id: ref });
  cache.at = 0;   // Home Assistant ist lokal und ohne Kontingent – gleich neu abfragen
}
async function zoneOff(ref) {
  const c = cfg();
  if (c.backend === 'hydrawise') {
    await hwCall('setzone.php', { action: 'stop', relay_id: await relayId(ref) }, 'ctl');
    markZone(ref, false);
    return;
  }
  const dom = ref.split('.')[0];
  if (dom === 'valve') await ha.call('POST', '/services/valve/close_valve', { entity_id: ref });
  else await ha.call('POST', '/services/switch/turn_off', { entity_id: ref });
  cache.at = 0;
}

/* Stopps, die Hydrawise (noch) nicht angenommen hat – gespeichert, damit sie auch einen Neustart überstehen: { all, refs, at, who, platz } */
const pendingStop = () => { try { return JSON.parse(getSetting('ext_beregnung_hw_stop', '')) || null; } catch (e) { return null; } };
const savePending = p => setSetting('ext_beregnung_hw_stop', p && (p.all || p.refs.length) ? JSON.stringify(p) : '');
function addStop(refs, all, who, platz) {
  const p = pendingStop() || { all: false, refs: [], at: Date.now(), who, platz: [] };
  p.all = p.all || all; p.refs = [...new Set([...p.refs, ...refs])]; p.at = Date.now();
  if (platz && !p.platz.includes(platz)) p.platz.push(platz);
  savePending(p);
}
/** Gespeicherte Stopps senden (nie zwei Durchläufe gleichzeitig; liest den Speicher je Befehl neu, damit kein neu vorgemerkter Stopp verloren geht).
    Rückgabe: null = alles gestoppt, sonst ms bis zum nächsten Versuch. Andere Fehler werden geworfen – der Stopp bleibt gespeichert und wird nachgeholt. */
let flushing = null, stopRetryAt = 0;
async function flushStops() {
  let w;
  do { if (!flushing) flushing = sendStops().finally(() => { flushing = null; }); w = await flushing; } while (w === null && pendingStop());
  return w;
}
async function sendStops() {
  for (;;) {
    const p = pendingStop();
    if (!p) return null;
    if (Date.now() - p.at > 3600000) {   // nach einer Stunde sinnlos (jeder Lauf endet nach höchstens 60 min von selbst)
      savePending(null); log('fehler', null, p.platz.join(', ') || null, null, 'Stopp ließ sich eine Stunde lang nicht an Hydrawise senden');
      notify('Achtung: Ein Stopp der Beregnung ließ sich eine Stunde lang nicht an Hydrawise senden.'); H.securityAlert('stopp', 'Beregnung: Ein Stopp ließ sich eine Stunde lang nicht an Hydrawise senden – läuft das Wasser noch? Bitte vor Ort oder in der Hydrawise-App prüfen.'); return null;
    }
    const r = p.all ? null : p.refs[0];
    try {
      if (p.all) { await hwCall('setzone.php', { action: 'stopall' }, 'ctl'); markZone(null); }
      else await zoneOff(r);
    } catch (e) {
      const q = pendingStop();
      if (e.gone && q) { savePending({ ...q, refs: q.refs.filter(x => x !== r) }); continue; }   // Zone gibt es nicht (mehr) – da läuft nichts
      if (q) savePending({ ...q, late: true });
      if (e.rate) return e.wait;
      stopRetryAt = Date.now() + 10000;   // Hydrawise nicht erreichbar: alle 10 s neu versuchen
      throw e;
    }
    const q = pendingStop() || p;
    const rest = p.all ? { ...q, all: false, refs: [] } : { ...q, refs: q.refs.filter(x => x !== r) };
    savePending(rest);
    if (!rest.all && !rest.refs.length && q.late) log('stop', 'System', q.platz.join(', ') || null, null, 'Stopp nachgeholt (Hydrawise hatte gebremst)');
  }
}
const notify = text => ha.notify(cfg().notify, 'Beregnung', text);

/* =================== Ablauf (übersteht Neustarts) =================== */
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const now = Date.now();
    const c = cfg();
    // Stopp hat Vorrang: gespeicherte Stopps zuerst senden – solange einer offen ist, startet nichts Neues
    if (c.backend === 'hydrawise' && pendingStop()) {
      if (now < stopRetryAt) return;
      try { if (await flushStops() !== null) return; }
      catch (e) { console.error('Beregnung: Stopp nicht gesendet:', e.message); return; }
    }
    // abgelaufene Zonen ausschalten (Hydrawise schaltet selbst ab – trotzdem als erledigt markieren)
    for (const s of db.prepare("SELECT * FROM irr_steps WHERE state = 'run' AND end_at <= ?").all(now)) {
      try { if (c.backend !== 'hydrawise') await zoneOff(s.ref); else markZone(s.ref, false); db.prepare("UPDATE irr_steps SET state = 'done' WHERE id = ? AND state = 'run'").run(s.id); }
      catch (e) {
        if (now - s.end_at > 5 * 60000) { db.prepare("UPDATE irr_steps SET state = 'fail', err = ? WHERE id = ?").run('Ausschalten fehlgeschlagen: ' + e.message, s.id); log('fehler', null, platzName(s.platz), null, `${s.label || s.ref} ließ sich nicht ausschalten: ${e.message}`); notify(`Achtung: ${platzName(s.platz)} ${s.label || ''} ließ sich nicht ausschalten (${e.message}).`); H.securityAlert('stopp', `Beregnung: ${platzName(s.platz)} ${s.label || ''} ließ sich nicht ausschalten (${e.message}). Bitte vor Ort prüfen.`, { key: s.ref }); }
      }
    }
    // nächste fällige Zone starten – nie mehr als eine gleichzeitig
    if (db.prepare("SELECT 1 FROM irr_steps WHERE state = 'run' LIMIT 1").get()) return;
    const s = db.prepare("SELECT * FROM irr_steps WHERE state = 'wait' AND start_at <= ? ORDER BY start_at, id LIMIT 1").get(now);
    if (!s) return;
    const rest = Math.round((s.end_at - now) / 1000);
    if (rest < 10) { db.prepare("UPDATE irr_steps SET state = 'done', err = 'verpasst (Neustart)' WHERE id = ?").run(s.id); return; }
    try {
      await zoneOn(s.ref, rest);
      // wurde während des Einschaltens „Alles stoppen“ gedrückt? Dann sofort wieder aus.
      if (!db.prepare("UPDATE irr_steps SET state = 'run' WHERE id = ? AND state = 'wait'").run(s.id).changes) {
        if (c.backend === 'hydrawise') { addStop([s.ref], false, 'System', platzName(s.platz)); await flushStops().catch(() => null); }   // nie verlieren: notfalls nachholen
        else try { await zoneOff(s.ref); } catch (e) { notify(`Achtung: ${s.label || s.ref} ließ sich nach dem Stopp nicht ausschalten (${e.message}).`); H.securityAlert('stopp', `Beregnung: ${s.label || s.ref} ließ sich nach dem Stopp nicht ausschalten (${e.message}). Bitte vor Ort prüfen.`, { key: s.ref }); }
      }
    } catch (e) {
      if (e.rate) return;   // Hydrawise bremst: Zone bleibt wartend und startet, sobald die Steuerung wieder annimmt
      db.prepare("UPDATE irr_steps SET state = 'fail', err = ? WHERE id = ? AND state = 'wait'").run(e.message, s.id);
      log('fehler', null, platzName(s.platz), null, `${s.label || s.ref}: ${e.message}`);
      notify(`${platzName(s.platz)}${s.label ? ' ' + s.label : ''} konnte nicht gestartet werden: ${e.message}`);
    }
  } catch (e) { console.error('Beregnung:', e.message); }
  finally { busy = false; }
}
function platzName(i) { const p = cfg().plaetze[i]; return p ? p.name : `Platz ${i + 1}`; }

function enqueue(platzIdx, who) {
  const c = cfg();
  const p = c.plaetze[platzIdx];
  if (!p || !p.zones || !p.zones.length) throw new Error('Dieser Platz ist nicht eingerichtet.');
  if (db.prepare("SELECT 1 FROM irr_steps WHERE platz = ? AND state IN ('wait','run') LIMIT 1").get(platzIdx)) throw new Error(`${p.name} wird schon beregnet.`);
  if (c.cooldownMin > 0) {
    const last = db.prepare("SELECT MAX(end_at) e FROM irr_steps WHERE platz = ? AND state IN ('done','run')").get(platzIdx).e;
    const until = last ? last + c.cooldownMin * 60000 : 0;
    if (until > Date.now()) throw new Error(`${p.name} wurde gerade erst beregnet – wieder möglich ab ${hhmm(until)} Uhr.`);
  }
  // hinten anstellen: es läuft immer nur eine Zone, weitere Plätze warten
  const tail = db.prepare("SELECT MAX(end_at) e FROM irr_steps WHERE state IN ('wait','run')").get().e;
  let t = Math.max(Date.now(), tail || 0);
  const runId = Date.now();
  const ins = db.prepare('INSERT INTO irr_steps(run_id, platz, label, ref, sec, start_at, end_at) VALUES (?,?,?,?,?,?,?)');
  let total = 0;
  db.transaction(() => {
    for (const z of p.zones) {
      const sec = Math.max(10, Math.min(3600, parseInt(z.sec, 10) || 120));
      ins.run(runId, platzIdx, z.label || null, String(z.ref), sec, t, t + sec * 1000);
      t += sec * 1000; total += sec;
    }
  })();
  log('start', who, p.name, total, p.zones.length > 1 ? `${p.zones.length} Zonen nacheinander` : null);
  setImmediate(tick);
  return { totalSec: total, waitSec: Math.max(0, Math.round(((tail || 0) - Date.now()) / 1000)) };
}

/** Hydrawise über Home Assistant: jeder Schließbefehl geht in die Hydrawise-Cloud und zählt beim Kontingent – nur schließen, was laut
    Home Assistant offen ist (oder von uns gestartet wurde). Ist der Stand unbekannt oder das Ventil nicht erreichbar: vorsichtshalber schließen. */
function haSkip(c, ref, ran) {
  if (c.vendor !== 'hydrawise' || ran.includes(ref)) return false;
  const z = cache.backend === 'ha' && !cache.err && cache.data && Date.now() - cache.at < 60000 && cache.data.zones[ref];
  return Boolean(z && !z.running && !z.unavailable);
}
/** Hydrawise: Stopps vormerken und gleich senden. Rückgabe { errs, pendingSec } – bremst die Steuerung, wird der Stopp nachgeholt. */
async function hwStop(refs, all, who, platz) {
  addStop(refs, all, who, platz);
  try { const w = await flushStops(); return { errs: [], pendingSec: w === null ? 0 : Math.ceil(w / 1000) }; }
  catch (e) { return { errs: [e.message], pendingSec: 0 }; }
}
/** Einen Platz stoppen (auch von der Automatik gestartet); wartende Plätze rücken nach */
async function stopPlatz(platzIdx, who) {
  const c = cfg(), p = c.plaetze[platzIdx];
  if (!p) throw new Error('Diesen Platz gibt es nicht.');
  const ran = db.prepare("SELECT ref FROM irr_steps WHERE platz = ? AND state = 'run'").all(platzIdx).map(r => r.ref);
  db.prepare("UPDATE irr_steps SET state = 'stopped' WHERE platz = ? AND state IN ('wait','run')").run(platzIdx);
  const refs = [...new Set((p.zones || []).map(z => String(z.ref)))];
  let errs = [], pendingSec = 0;
  if (c.backend === 'hydrawise') {
    // Nur stoppen, was läuft (je Befehl zählt das Kontingent). Ist der Stand der Steuerung unbekannt: vorsichtshalber alle Zonen des Platzes.
    const z = cache.data && cache.data.zones;
    const todo = z ? refs.filter(r => ran.includes(r) || (z[r] && z[r].running)) : refs;
    // mehrere Zonen offen und sonst nichts → ein „stopall“ statt vieler Einzelbefehle
    const others = z ? Object.entries(z).some(([r, st]) => st.running && !refs.includes(r)) || db.prepare("SELECT 1 FROM irr_steps WHERE state = 'run' LIMIT 1").get() : true;
    if (todo.length) ({ errs, pendingSec } = await hwStop(todo.length > 1 && !others ? [] : todo, todo.length > 1 && !others, who, p.name));
  } else {
    for (const r of refs) { if (haSkip(c, r, ran)) continue; try { await zoneOff(r); } catch (e) { errs.push(`${r}: ${e.message}`); } }
  }
  // Warteschlange zusammenschieben: was hinter diesem Platz wartete, startet entsprechend früher
  const running = db.prepare("SELECT MAX(end_at) e FROM irr_steps WHERE state = 'run'").get().e;
  let t = Math.max(Date.now(), running || 0);
  const up = db.prepare('UPDATE irr_steps SET start_at = ?, end_at = ? WHERE id = ?');
  db.transaction(() => { for (const w of db.prepare("SELECT * FROM irr_steps WHERE state = 'wait' ORDER BY start_at, id").all()) { up.run(t, t + w.sec * 1000, w.id); t += w.sec * 1000; } })();
  log('stop', who, p.name, null, errs.length ? 'Fehler: ' + errs.join('; ') : pendingSec ? `Hydrawise bremst – Stopp wird in ${pendingSec} s nachgeholt` : null);
  if (errs.length) { notify(`Stopp ${p.name} nicht vollständig: ` + errs.join('; ')); H.securityAlert('stopp', `Beregnung: Stopp ${p.name} nicht vollständig: ${errs.join('; ')}. Bitte vor Ort prüfen.`, { key: p.name }); }
  setImmediate(tick);
  return { errs, pendingSec };
}

async function stopAll(who) {
  const c = cfg();
  const was = db.prepare("SELECT DISTINCT platz FROM irr_steps WHERE state IN ('wait','run')").all().map(r => platzName(r.platz));
  const ran = db.prepare("SELECT ref FROM irr_steps WHERE state = 'run'").all().map(r => r.ref);
  db.prepare("UPDATE irr_steps SET state = 'stopped' WHERE state IN ('wait','run')").run();
  let errs = [], pendingSec = 0;
  if (c.backend === 'hydrawise') {
    ({ errs, pendingSec } = await hwStop([], true, who, was.join(', ')));
  } else {
    // alle eingerichteten Zonen schließen – auch solche, die die Automatik gestartet hat
    const refs = [...new Set(c.plaetze.flatMap(p => (p.zones || []).map(z => String(z.ref))))];
    for (const r of refs) { if (haSkip(c, r, ran)) continue; try { await zoneOff(r); } catch (e) { errs.push(`${r}: ${e.message}`); } }
  }
  log('stop', who, was.join(', ') || null, null, errs.length ? 'Fehler: ' + errs.join('; ') : pendingSec ? `Hydrawise bremst – Stopp wird in ${pendingSec} s nachgeholt` : null);
  if (errs.length) { notify('Stopp nicht vollständig: ' + errs.join('; ')); H.securityAlert('stopp', `Beregnung: Stopp nicht vollständig: ${errs.join('; ')}. Bitte vor Ort prüfen.`, { key: 'alle' }); }
  return { errs, pendingSec };
}

async function status() {
  const c = cfg();
  let ctl = null, error = null;
  try { ctl = await readController(); } catch (e) { error = e.message; }
  const now = Date.now();
  // Hydrawise bremst? Dann gilt der letzte Stand weiter – mit ehrlichem Hinweis statt „Keine Verbindung“
  let throttle = null;
  if (c.backend === 'hydrawise') {
    const ps = pendingStop(), rated = cache.err && cache.err.rate;
    const w = Math.ceil(Math.max(hwWait(ps ? 'ctl' : 'read'), rated ? cache.at + cache.ttl - now : 0) / 1000);
    if (ps || rated || HW.until > now) {
      throttle = { sec: Math.max(1, w), stop: Boolean(ps), stopRefs: ps ? (ps.all ? null : ps.refs) : [] };
      if (!ctl && rated && !cache.data) error = 'Die Steuerung bremst gerade (zu viele Anfragen).';
    }
  }
  const steps = db.prepare("SELECT * FROM irr_steps WHERE state IN ('wait','run') ORDER BY start_at").all();
  const lastEnd = db.prepare("SELECT platz, MAX(end_at) e FROM irr_steps WHERE state IN ('done','run') GROUP BY platz").all();
  const plaetze = c.plaetze.map((p, i) => {
    const mine = steps.filter(s => s.platz === i);
    const zones = (p.zones || []).map(z => ({ label: z.label || '', sec: parseInt(z.sec, 10) || 0 }));
    const base = { id: i, name: p.name, sub: p.sub || autoSub(p), zones };
    if (mine.length) {
      const cur = mine.find(s => s.state === 'run' || (s.start_at <= now && s.end_at > now));
      const first = mine[0];
      return { ...base, state: cur ? 'run' : 'wait', remain: Math.max(0, Math.round((mine[mine.length - 1].end_at - now) / 1000)),
        startsIn: cur ? 0 : Math.max(0, Math.round((first.start_at - now) / 1000)), phase: cur && cur.label ? cur.label : '' };
    }
    // Stopp vorgemerkt, Hydrawise bremst noch: nicht als „Automatik läuft“ zeigen
    if (throttle && throttle.stop && (throttle.stopRefs === null || (p.zones || []).some(z => throttle.stopRefs.includes(String(z.ref))))
      && ctl && (p.zones || []).some(z => ctl.zones[String(z.ref)] && ctl.zones[String(z.ref)].running)) return { ...base, state: 'stopping', stopIn: throttle.sec };
    // von der Automatik/der Hersteller-App gestartet?
    const ext = ctl && (p.zones || []).map(z => ({ z, st: ctl.zones[String(z.ref)] })).find(x => x.st && x.st.running);
    if (ext) return { ...base, state: 'auto', remain: ext.st.remain, phase: ext.z.label || '' };
    let blockedUntil = null;
    const le = lastEnd.find(x => x.platz === i);
    if (c.cooldownMin > 0 && le && le.e + c.cooldownMin * 60000 > now) blockedUntil = hhmm(le.e + c.cooldownMin * 60000);
    return { ...base, state: 'idle', blockedUntil };
  });
  let next = null;
  if (ctl && ctl.next) {
    const d = new Date(ctl.next), today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const day = d.toDateString() === today.toDateString() ? 'heute' : d.toDateString() === tomorrow.toDateString() ? 'morgen'
      : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    next = `${day} ${hhmm(ctl.next)} Uhr`;
  }
  return { online: Boolean(ctl), error, plaetze, next, zonesTotal: c.plaetze.reduce((a, p) => a + (p.zones || []).length, 0),
    throttle: throttle && { sec: throttle.sec, stop: throttle.stop } };
}
function autoSub(p) {
  const z = p.zones || [];
  const m = s => { const v = (parseInt(s, 10) || 0) / 60; return (Number.isInteger(v) ? v : v.toFixed(1).replace('.', ',')) + ' min'; };
  if (!z.length) return 'nicht eingerichtet';
  if (z.length === 1) return `Eine Zone · ${m(z[0].sec)}`;
  const same = z.every(x => x.sec === z[0].sec);
  const names = z.map(x => x.label).filter(Boolean);
  const order = names.length === z.length ? 'Erst ' + names.join(', dann ') : `${z.length} Zonen nacheinander`;
  return `${order} · ${same ? 'je ' + m(z[0].sec) : z.map(x => m(x.sec)).join(' + ')}`;
}

/* =================== Zugriffsschutz der Webapp =================== */
const APP_ONLY = 'Die Beregnung ist nur für freigeschaltete Mitglieder in der Mitglieder-App bedienbar.';
// Fehlversuche je Gerät/Adresse (wachsende Sperre) und insgesamt: Die Vereins-PIN ist für alle gleich – darum zählt
// zusätzlich jeder Fehlversuch von überall. Nach 20 Fehlern in 24 Std. ist die PIN-Eingabe für alle gesperrt (1 Std., dann
// länger) und der Vorstand bekommt eine Warnung. Erraten über viele Geräte hinweg funktioniert so nicht.
let pinFails = null, allFails = null;
const limits = () => { if (!pinFails) { const { limiter } = H.require('./security'); pinFails = limiter(); allFails = limiter({ per: 20, baseMs: 3600000 }); } };
function pinOk(req) {
  const h = getSetting('ext_beregnung_pin_hash', '');
  const pin = String((req.body && req.body.pin) || '');
  return Boolean(h && pin && auth.verifySecret(pin, h));
}
/** wer darf? → { who } oder sendet Fehler */
function guard(req, res, { forStop = false } = {}) {
  const c = cfg();
  if (c.mode === 'login') {
    const u = auth.currentUser(req, 'beregnung') || auth.currentUser(req);
    if (!u) { res.status(401).json({ error: 'Bitte anmelden.', login: true }); return null; }
    if (!u.perms.includes('beregnung_bedienen') && !u.perms.includes('beregnung')) { res.status(403).json({ error: 'Dein Konto darf die Beregnung nicht bedienen.' }); return null; }
    return { who: u.name || u.username };
  }
  if (forStop && c.stopFree) return { who: 'ohne PIN' };
  if (c.mode === 'app') { res.status(403).json({ error: APP_ONLY, app: true }); return null; }
  const ip = req.ip || '?';
  limits();
  const wAll = allFails.blocked('*'), wIp = pinFails.blocked(ip);
  if (wAll || wIp) { res.status(429).json({ error: `Zu viele falsche PINs – bitte ${Math.max(wAll, wIp)} Min. warten.` }); return null; }
  if (!getSetting('ext_beregnung_pin_hash', '')) { res.status(403).json({ error: 'In der Verwaltung ist noch keine PIN für die Beregnung festgelegt.' }); return null; }
  if (!pinOk(req)) {
    const one = pinFails.fail(ip), all = allFails.fail('*');
    if (all.locked) {
      audit(null, 'Beregnung: PIN-Eingabe für alle gesperrt', `20 falsche PINs, zuletzt von ${ip}`);
      H.securityAlert('pin', `Bei der Beregnung wurde 20-mal eine falsche Vereins-PIN eingegeben (zuletzt von ${ip}). Die PIN-Eingabe ist für ${all.minutes} Minuten für alle gesperrt. Falls das kein Versehen war: bitte in der Verwaltung unter Beregnung eine neue PIN festlegen.`);
    }
    res.status(401).json({ error: one.locked ? `PIN mehrfach falsch – ${one.minutes} Minuten gesperrt.` : 'Falsche PIN', pin: true });
    return null;
  }
  pinFails.ok(ip);
  return { who: 'Vereins-PIN' };
}

/** Antwort auf „Stoppen“: Fehler → 502; bremst Hydrawise, ist der Stopp vorgemerkt und wird nachgeholt (kein Fehler, aber ehrlich gesagt) */
function stopAnswer(res, { errs, pendingSec }, msg) {
  if (errs.length) return res.status(502).json({ error: msg });
  res.json({ ok: true, pendingSec, ...(pendingSec ? { msg: `Die Steuerung bremst gerade (zu viele Anfragen) – Stopp folgt in ${pendingSec} s.` } : {}) });
}

/* Webapp-Schnittstelle – hängt am Tablet (/api/tablet/x/beregnung) und am eigenen Port (/api) */
function appRouter(ctx) {
  const r = express.Router();
  const { rateLimit } = ctx;
  r.get('/info', (req, res) => {
    const c = cfg();
    const u = c.mode === 'login' ? (auth.currentUser(req, 'beregnung') || auth.currentUser(req)) : null;
    res.json({ club: getSetting('club_name', 'Unser Verein'), subtitle: c.subtitle, appName: c.appName, mode: c.mode, stopFree: Boolean(c.stopFree),
      user: u && (u.perms.includes('beregnung_bedienen') || u.perms.includes('beregnung')) ? (u.name || u.username) : null, hasPin: Boolean(getSetting('ext_beregnung_pin_hash', '')) });
  });
  r.get('/status', async (req, res) => {
    if (cfg().mode === 'login') {
      const u = (auth.currentUser(req, 'beregnung') || auth.currentUser(req));
      if (!u || !(u.perms.includes('beregnung_bedienen') || u.perms.includes('beregnung'))) return res.status(401).json({ error: 'Bitte anmelden.', login: true });
    }
    if (cfg().mode === 'app') return res.status(403).json({ error: APP_ONLY, app: true });
    res.json(await status());
  });
  r.post('/verify-pin', rateLimit('bpin', 20, 60000), (req, res) => { if (guard(req, res)) res.json({ ok: true }); });
  r.post('/run', rateLimit('brun', 30, 60000), (req, res) => {
    const g = guard(req, res); if (!g) return;
    const i = parseInt((req.body || {}).platz, 10);
    try { res.json({ ok: true, ...enqueue(i, g.who) }); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.post('/stop', rateLimit('bstop', 30, 60000), async (req, res) => {
    const g = guard(req, res, { forStop: true }); if (!g) return;
    const b = req.body || {};
    if (b.platz !== undefined && b.platz !== null && b.platz !== '') {   // einzelnen Platz stoppen (wie in der Mitglieder-App)
      try { return stopAnswer(res, await stopPlatz(parseInt(b.platz, 10), g.who), 'Der Platz ließ sich nicht vollständig stoppen – bitte erneut versuchen!'); }
      catch (e) { return res.status(400).json({ error: e.message }); }
    }
    stopAnswer(res, await stopAll(g.who), 'Nicht alle Zonen ließen sich stoppen – bitte erneut versuchen!');
  });
  r.post('/login', rateLimit('blogin', 10, 60000), (req, res) => {
    const { username, password } = req.body || {};
    if (req.get('X-Clubwerk') !== '1') return res.status(403).json({ error: 'Ungültige Anfrage.' });
    const out = auth.login(username, password, req.ip, 'beregnung', { known: auth.knownDevice(req, username) });
    if (!out.ok) { audit(String(username || '').slice(0, 30), 'Beregnung: Anmeldung fehlgeschlagen', req.ip); return res.status(401).json({ error: out.error }); }
    audit(String(username || '').toLowerCase(), 'Beregnung: Anmeldung', req.ip);
    res.setHeader('Set-Cookie', `gbereg=${out.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${8 * 3600}${req.secure ? '; Secure' : ''}`);
    res.json({ ok: true });
  });
  r.post('/logout', (req, res) => {
    auth.logout(auth.parseCookies(req).gbereg);
    res.setHeader('Set-Cookie', 'gbereg=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    res.json({ ok: true });
  });
  return r;
}

/* Eigener Port: nur die Beregnung, sonst nichts */
function startPortApp(ctx) {
  const INTERNAL = () => ctx.require('./tls').internalBase();
  const port = parseInt(process.env.BEREGNUNG_PORT || '5000', 10);
  if (!port) return;
  const app = express();
  app.disable('x-powered-by');
  app.use(ctx.require('./security').noEncodedBody());   // komprimierte Anfragen nie entpacken
  app.set('trust proxy', false);
  app.use(ctx.require('./security').lanOnly({ label: 'Die Beregnungs-Webapp' }));   // nie aus dem Internet (versehentliche Portfreigabe)
  app.use(ctx.require('./security').noTunnel({ label: 'Die Beregnungs-Webapp' }));   // auch nicht, wenn ein Tunnel versehentlich auf diesen Port zeigt
  app.use(ctx.require('./security').hostGuard());
  app.use(ctx.require('./security').hardenHeaders({ frame: 'DENY' }));
  app.use(ctx.require('./security').compress());
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    if (!ctx.isActive()) return res.status(404).type('text/plain; charset=utf-8').send('Die Beregnung ist in Clubwerk nicht aktiv.');
    next();
  });
  app.use(express.json({ limit: '10kb' }));
  const relay = (p, fallbackType) => async (req, res) => {
    try {
      const r = await fetch(`${INTERNAL()}${p}`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return res.status(404).end();
      const ct = r.headers.get('content-type') || fallbackType;
      if (/^image\//.test(ct)) res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
      res.set({ 'Content-Type': ct, 'Cache-Control': 'no-cache' }).send(Buffer.from(await r.arrayBuffer()));
    } catch (e) { res.status(404).end(); }
  };
  app.get('/logo', relay('/vereinslogo', 'image/png'));
  app.get('/icon.png', relay('/vereinsicon.png', 'image/png'));
  for (const f of ['/style.css', '/kit.css']) app.get(f, relay(f, 'text/css'));
  // Vorschau einer anderen Vereinsfarbe (Design-Prüfstand) weiterreichen – nur Hex-Werte
  app.get('/theme.css', (req, res) => { const q = new URLSearchParams(); for (const k of ['vorschau', 'vorschau2']) if (typeof req.query[k] === 'string' && /^[0-9a-f]{6}$/i.test(req.query[k])) q.set(k, req.query[k]); relay('/theme.css' + (q.toString() ? '?' + q : ''), 'text/css')(req, res); });
  app.get('/icon-192.png', relay('/icon-192.png', 'image/png'));
  app.get('/icon-512.png', relay('/icon-512.png', 'image/png'));
  for (const f of ['/fonts/jakarta-latin.woff2', '/fonts/jakarta-latin-ext.woff2', '/fonts/barlow-condensed-600.woff2']) app.get(f, relay(f, 'font/woff2'));
  app.get('/theme-init.js', relay('/theme-init.js', 'application/javascript'));
  app.get('/i18n.js', (req, res) => relay('/i18n.js?' + new URLSearchParams({ l: String(req.query.l || 'auto').slice(0, 20), b: String(req.query.b || '').slice(0, 200) }), 'application/javascript')(req, res));
  app.get('/manifest.json', (req, res) => res.json(manifest('./')));
  app.use('/api', appRouter(ctx));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Unbekannte Adresse.' }));
  app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html', setHeaders: r => r.setHeader('Cache-Control', 'no-cache') }));
  /* Fehler immer als JSON, ohne interne Details – echte Programmfehler landen im Protokoll statt als „Ungültige Anfrage“ unterzugehen */
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Die Datei ist zu groß.' });
    if (err && (err.type === 'entity.parse.failed' || (err.status >= 400 && err.status < 500))) return res.status(400).json({ error: 'Ungültige Anfrage.' });
    console.error('Beregnung-Webapp:', err);
    res.status(500).json({ error: 'Interner Fehler.' });
  });
  const srv = ctx.require('./tls').listen(app, port, process.env.HOST || '0.0.0.0', 'Beregnung-Webapp');
  srv.on('error', e => console.error(`Beregnung: Port ${port} nicht nutzbar (${e.code || e.message}) – die Webapp ist nur über das Tablet erreichbar.`));
}
function manifest(base) {
  const c = cfg();
  return { name: `${getSetting('club_name', 'Verein')} – ${c.appName || 'Beregnung'}`, short_name: c.appName || 'Beregnung', start_url: base, scope: base,
    display: 'standalone', background_color: '#eceae3', theme_color: '#1a3d2b',
    icons: [{ src: base + 'icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' }] };
}

/* =================== Verwaltung =================== */
function cleanCfg(body, cleanName) {
  const c = cfg();
  const b = body || {};
  const out = { ...c };
  if (b.vendor !== undefined) { const v = VENDORS.find(x => x.id === b.vendor); if (!v) throw new Error('Unbekannter Hersteller.'); out.vendor = v.id; out.backend = v.backend; }
  else if (b.backend !== undefined) { out.backend = b.backend === 'hydrawise' ? 'hydrawise' : 'ha'; out.vendor = out.backend === 'hydrawise' ? 'hydrawise_api' : 'other'; }
  if (b.mode !== undefined) out.mode = ['login', 'app'].includes(b.mode) ? b.mode : 'pin';
  if (b.stopFree !== undefined) out.stopFree = Boolean(b.stopFree);
  if (b.header !== undefined) out.header = Boolean(b.header);
  if (b.cooldownMin !== undefined) out.cooldownMin = Math.max(0, Math.min(720, parseInt(b.cooldownMin, 10) || 0));
  if (b.appName !== undefined) out.appName = cleanName(b.appName, 20) || 'Beregnung';
  if (b.webappUrl !== undefined) { const u = String(b.webappUrl || '').trim().replace(/\/+$/, ''); out.webappUrl = /^https?:\/\/[A-Za-z0-9.\-\[\]:]+$/.test(u) ? u : ''; }
  if (b.subtitle !== undefined) out.subtitle = cleanName(b.subtitle, 40);
  if (b.nextEntity !== undefined) out.nextEntity = /^sensor\.[a-z0-9_]+$/.test(String(b.nextEntity)) ? String(b.nextEntity) : '';
  if (b.notify !== undefined) { const n = String(b.notify || '').trim().replace(/^notify\./, ''); out.notify = /^[a-z0-9_]{1,80}$/.test(n) ? n : ''; }
  if (b.plaetze !== undefined) {
    if (!Array.isArray(b.plaetze) || b.plaetze.length > 20) throw new Error('Ungültige Platzliste (höchstens 20 Plätze).');
    out.plaetze = b.plaetze.map((p, i) => {
      const name = cleanName(p && p.name, 30);
      if (!name) throw new Error(`Platz ${i + 1} braucht einen Namen.`);
      const zones = Array.isArray(p.zones) ? p.zones : [];
      if (!zones.length) throw new Error(`${name}: mindestens eine Zone eintragen.`);
      if (zones.length > 8) throw new Error(`${name}: höchstens 8 Zonen.`);
      return { name, sub: cleanName(p.sub, 60) || '', zones: zones.map(z => {
        const ref = String((z && z.ref) || '').trim();
        if (out.backend === 'hydrawise' ? !/^\d{1,3}$/.test(ref) : !/^(valve|switch)\.[a-z0-9_]+$/.test(ref)) throw new Error(`${name}: bitte für jede Zone ein Gerät auswählen.`);
        if (out.backend !== 'hydrawise') { const own = H.entityOwner(ref); if (own) throw new Error(`${name}: „${ref}“ gehört schon zum Modul ${own} und kann hier nicht verwendet werden.`); }
        const sec = Math.round(Number(z.sec));
        if (!(sec >= 10 && sec <= 3600)) throw new Error(`${name}: Laufzeit zwischen 10 Sekunden und 60 Minuten.`);
        return { ref, label: cleanName(z.label, 20) || '', sec };
      }) };
    });
  }
  return out;
}

/** Geänderte Ventile/Schalter dem Vorstand melden (Einstellungen und Funktionsimport) – auch beim ersten Eintragen */
function zoneAlert(before, out, who) {
  const zrefs = c2 => (c2.backend === 'hydrawise' ? [] : c2.plaetze.flatMap(p => p.zones.map(z => z.ref))).sort().join(', ');
  if (zrefs(before) !== zrefs(out)) H.securityAlert('geraete', `Im Modul Beregnung wurden die geschalteten Geräte geändert (von ${who}). Vorher: ${zrefs(before) || '–'} · Jetzt: ${zrefs(out) || '–'}. War das so geplant? Sonst bitte in der Verwaltung prüfen.`);
}
/** Ventile/Schalter aus Home Assistant, die neu zugeordnet werden (die direkte Hydrawise-Anbindung schaltet nur Zonen der eigenen Steuerung) */
const haRefs = c => (c.backend === 'hydrawise' ? [] : c.plaetze.flatMap(p => p.zones.map(z => z.ref)));
const neueGeraete = (before, out) => { const alt = new Set(haRefs(before)); return [...new Set(haRefs(out).filter(r => !alt.has(r)))]; };
const vendorInfo = c => { const v = vendorOf(c); return { name: v.name, integration: v.integration, domains: v.domains, free: v.backend === 'ha' && !v.integration }; };
/** Geräte-Regeln (src/geraete.js) – gibt die geprüften Geräte zurück */
const geraetePruefen = async (before, out, o) => { const changed = neueGeraete(before, out); await G.pruefen({ changed, vendor: vendorInfo(out), vendorChanged: out.vendor !== before.vendor, ...o, info: o }); return new Set(changed); };
const nachgeprueft = (geprueft, before, out) => { if (neueGeraete(before, out).some(r => !geprueft.has(r))) throw new Error('Die Plätze wurden gerade gleichzeitig geändert – bitte die Seite neu laden und noch einmal speichern.'); };
function activate(ctx) {
  ({ db, getSetting, setSetting, audit, auth } = ctx);
  express = ctx.require('express');
  H = ctx;
  ctx.geheim.melden('hw_key', 'Hydrawise-API-Key');
  require('../../src/vault').onUnlock(() => { if (pendingStop()) flushStops().catch(e => console.error('Beregnung: Stopp nach dem Entsperren:', e.message)); });
  createTables();
  const { need, bad, cleanName } = ctx;
  // Sicherheitswarnungen („Sicherheit & Betrieb“, Einstellungen › Sicherheit)
  ctx.hooks.securityEvents = () => [
    { id: 'pin', label: 'Beregnung: viele falsche PINs', level: 'r', push: 'Beregnung: viele falsche PINs – die PIN-Eingabe ist gesperrt.' },
    { id: 'geraete', label: 'Beregnung: Geräte geändert', level: 'r', push: 'Im Modul Beregnung wurden die geschalteten Geräte geändert.' },
    { id: 'stopp', label: 'Beregnung lässt sich nicht stoppen', level: 'r', push: 'Die Beregnung ließ sich nicht stoppen – bitte prüfen.' },
  ];
  ctx.hooks.usedEntities = () => { const c = cfg(); return c.backend === 'hydrawise' ? [] : c.plaetze.flatMap(p => p.zones.map(z => z.ref)); };
  /* Datenschutz: Protokoll der Beregnung nach der Frist löschen (Einstellungen › Datenschutz, src/datenschutz.js) */
  const keepMonths = () => Math.min(60, Math.max(1, parseInt(ctx.setting('keep_months', '12'), 10) || 12));
  ctx.hooks.retention = () => [{ id: 'protokoll', label: 'Beregnungsprotokoll', text: 'Wer wann welchen Platz beregnet hat.', unit: 'monate', value: keepMonths(), def: 12, min: 1, max: 60,
    due: cut => db.prepare('SELECT COUNT(*) n FROM irr_log WHERE at < ?').get(cut).n,
    purge: cut => db.prepare('DELETE FROM irr_log WHERE at < ?').run(cut).changes, set: v => ctx.setSetting2('keep_months', String(v)) }];
  ctx.hooks.privacyRecord = () => [{ purpose: 'Steuerung der Beregnung, Nachweis der Laufzeiten', data: 'Name, Platz, Zeitpunkt und Dauer', persons: 'Mitglieder, die die Beregnung starten' }];
  ctx.hooks.memberData = id => {
    const m = db.prepare('SELECT name FROM members WHERE id = ?').get(id);
    return m ? { beregnung: db.prepare('SELECT at AS zeit, action AS aktion, platz, sec AS sekunden FROM irr_log WHERE who = ? ORDER BY at').all(m.name) } : null;
  };
  ctx.hooks.tabletVisible = () => { const c = cfg(); return Boolean(c.header && c.plaetze.length && c.mode !== 'app'); };   // „nur Mitglieder-App“ gilt fürs eigene Handy, nicht fürs Vereinstablet
  // Schalter „am Tablet zeigen“ liegt zentral unter Einstellungen › Tablet (Schlüssel header bleibt)
  ctx.hooks.tabletSwitch = { get: () => Boolean(cfg().header), set: on => { let c = {}; try { c = JSON.parse(getSetting('ext_beregnung_cfg', '{}')) || {}; } catch (e) { c = {}; } c.header = on; setSetting('ext_beregnung_cfg', JSON.stringify(c)); } };
  /* Mitglieder-App: /api/m/beregnung/… (Gerät und Freischaltung prüft der Kern) */
  ctx.member.get('/status', async (req, res) => res.json({ ...(await status()), stopFree: Boolean(cfg().stopFree) }));
  // Im Vereins-WLAN ohne extra PIN: das Handy ist gekoppelt und für die Beregnung freigeschaltet – dafür gebremst (10 je Minute),
  // damit niemand im Sekundentakt Ventile schaltet. Unterwegs (Ausnahme „auch unterwegs“) zusätzlich mit PIN: ein gestohlener
  // Geräteschlüssel allein reicht dann nicht, um aus der Ferne zu bewässern. Stoppen geht immer ohne PIN (Sicherheit vor Bequemlichkeit).
  ctx.member.post('/run', ctx.rateLimit('bgmrun', 10, 60000), (req, res) => {
    if (req.away && typeof req.pinOk === 'function') {
      if (!String((req.body || {}).pin || '')) return res.status(428).json({ error: 'Unterwegs bitte mit deiner PIN bestätigen.', needPin: true });   // ohne PIN: nachfragen (428), nicht als Fehlversuch zählen
      if (!req.pinOk()) return;
    }
    try { res.json({ ok: true, ...enqueue(parseInt((req.body || {}).platz, 10), req.member.name) }); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  ctx.member.post('/stop', ctx.rateLimit('bgmstop', 10, 60000), async (req, res) => {
    const b = req.body || {};
    if (b.platz !== undefined && b.platz !== null && b.platz !== '') {
      try { return stopAnswer(res, await stopPlatz(parseInt(b.platz, 10), req.member.name), 'Der Platz ließ sich nicht vollständig stoppen – bitte erneut versuchen!'); }
      catch (e) { return res.status(400).json({ error: e.message }); }
    }
    stopAnswer(res, await stopAll(req.member.name), 'Nicht alle Zonen ließen sich stoppen – bitte erneut versuchen!');
  });
  /* Funktionsexport/-import: Anbindung, Plätze mit Zonen, Schutz-Modus, Webapp – ohne Vereins-PIN und API-Key */
  ctx.hooks.exportConfig = () => { const c = cfg(); const { backend, ...rest } = c; void backend; return { ...rest, keepMonths: keepMonths() }; };
  ctx.hooks.importConfig = async (data, info = {}) => {
    if (!data || typeof data !== 'object') throw new Error('Leere Funktionsdatei.');
    if (db.prepare("SELECT 1 FROM irr_steps WHERE state IN ('wait','run') LIMIT 1").get()) throw new Error('Gerade läuft eine Beregnung – bitte erst stoppen oder abwarten.');
    const keys = ['vendor', 'plaetze', 'mode', 'stopFree', 'cooldownMin', 'header', 'appName', 'subtitle', 'nextEntity', 'notify'];
    const b = Object.fromEntries(keys.filter(k => data[k] !== undefined).map(k => [k, data[k]]));
    const geprueft = await geraetePruefen(cfg(), cleanCfg(b, ctx.cleanName), info);   // Geräte neu zuordnen: Rechte und eigenes Passwort (in der Vorschau nur needPassword)
    const out = cleanCfg(b, ctx.cleanName), before = cfg();
    nachgeprueft(geprueft, before, out);
    setSetting('ext_beregnung_cfg', JSON.stringify(out));
    if (!info.dry) zoneAlert(before, out, info.user ? `${info.user.name || info.user.username} per Funktionsimport` : 'Funktionsimport');   // gleiche Warnung wie in den Einstellungen
    if (Number.isInteger(data.keepMonths) && data.keepMonths >= 1 && data.keepMonths <= 60) ctx.setSetting2('keep_months', String(data.keepMonths));
    cache.at = 0;
    const zones = out.plaetze.reduce((a, p) => a + p.zones.length, 0);
    const hints = [];
    if (out.backend === 'hydrawise' && !H.geheim.has('hw_key')) hints.push('Hydrawise-API-Key noch eintragen');
    if (out.mode === 'pin' && !getSetting('ext_beregnung_pin_hash', '')) hints.push('Vereins-PIN noch festlegen');
    return `${out.plaetze.length} Plätze mit ${zones} Zonen, ${vendorOf(out).name}${hints.length ? ' – ' + hints.join(', ') : ''}`;
  };
  /* Einrichtungs-Assistent (Verein › Einrichtung): eigene Schritte – zeigen auf die vorhandenen Karten, done prüft die eigenen Daten */
  /* Probe-Wiederherstellung: Zählerstände (nur Anzahlen) */
  ctx.hooks.probeCounts = () => [{ label: 'Beregnungsprotokoll', n: db.prepare("SELECT COUNT(*) n FROM irr_log").get().n }];
  ctx.hooks.setupSteps = () => [
    { id: 'anbindung', title: 'Anbindung der Bewässerung', text: 'Über Home Assistant oder direkt beim Hersteller der Steuerung.', page: 'beregnung', tab: ['beregnung', 'einstellungen'], card: ['Anbindung'] },
    { id: 'plaetze', title: 'Plätze und Zonen', text: 'Welche Ventile zu welchem Platz gehören und wie lange sie laufen – danach einen Platz testweise starten.', page: 'beregnung', tab: ['beregnung', 'plaetze'], card: ['Plätze & Zonen'], done: cfg().plaetze.length > 0 },
  ];
  ctx.hooks.overview = async () => {
    const c = cfg();
    if (!c.plaetze.length) return { kpis: [{ l: 'Plätze', v: ctx.T('{0} Plätze', [0]) }, { l: 'Heute manuell gestartet', v: 0 }], alerts: [{ level: 'a', text: 'Noch keine Plätze eingerichtet.' }] };
    const st = await status();
    const alerts = [];
    if (!st.online && !st.throttle) alerts.push({ level: 'r', text: 'Keine Verbindung zur Bewässerungsanlage.', detail: st.error || undefined });   // Übersicht: kurzer Satz, Einzelheiten im Tooltip
    const hits = c.backend === 'hydrawise' ? hwHits().length : 0;
    if (hits >= 3) alerts.push({ level: 'a', text: 'Hydrawise bremst häufig (zu viele Anfragen).', detail: SHARED(hits), sec: ['tab_beregnung', 'bedienen'] });
    if (c.mode === 'pin' && !getSetting('ext_beregnung_pin_hash', '')) alerts.push({ level: 'a', text: 'Noch keine Vereins-PIN festgelegt.' });
    const day = localTs().slice(0, 10);
    // Fehler zählen nur, bis jemand den Verlauf angesehen hat – danach verschwindet der Hinweis (neue Fehler zeigen ihn wieder)
    const seen = getSetting('ext_beregnung_err_seen', ''), since = seen > day ? seen : day;
    const errs = db.prepare("SELECT COUNT(*) n FROM irr_log WHERE at > ? AND action = 'fehler'").get(since === day ? day + ' 00:00:00' : since).n;
    if (errs) alerts.push({ level: 'r', text: `${errs} ${errs === 1 ? 'neuer Fehler' : 'neue Fehler'} heute.`, link: 'Verlauf öffnen', sec: ['tab_beregnung', 'verlauf'] });
    const runs = db.prepare("SELECT COUNT(*) n FROM irr_log WHERE at >= ? AND action = 'start'").get(day).n;
    const running = st.plaetze.filter(p => p.state !== 'idle').map(p => p.name);
    return { kpis: [{ l: 'Plätze', v: (n => n === 1 ? ctx.T('{0} Platz', [n]) : ctx.T('{0} Plätze', [n]))(c.plaetze.length) }, { l: 'Heute manuell gestartet', v: runs }, { l: 'Läuft gerade', v: running.length ? running.join(', ') : '–' }], alerts };
  };

  // Tablet-Weg nur, solange die Beregnung am Tablet gezeigt wird (wie beim Zugang) – sonst bliebe die Schnittstelle offen, obwohl der Vorstand sie ausgeschaltet hat
  ctx.tablet.use((req, res, next) => (cfg().header ? next() : res.status(404).json({ error: 'Die Beregnung ist am Tablet nicht eingeschaltet.' })), appRouter(ctx));
  ctx.tablet.get('/manifest.json', (req, res) => res.json(manifest('./')));

  const admin = ctx.admin;
  admin.get('/config', need('beregnung'), async (req, res) => {
    let list = [], sensors = [], error = null, filtered = false;
    try { const d = await readController(true); list = d.list; sensors = d.sensors || []; filtered = Boolean(d.filtered); } catch (e) { error = e.message; }
    // ohne „alle Rechte“: nur Ventile der Hersteller-Integration – nennt Home Assistant sie nicht (oder „Anderer Hersteller“), keine
    const full = G.full(req.user), restricted = !full && cfg().backend === 'ha' && !filtered && list.length > 0;
    if (restricted) list = [];
    res.json({ cfg: cfg(), vendors: VENDORS.map(({ id, name, backend, setup, integration }) => ({ id, name, backend, setup, free: backend === 'ha' && !integration })), filtered: Boolean(list.length) && filtered, full, restricted, hasKey: H.geheim.has('hw_key'), keyLocked: H.geheim.locked('hw_key'), hasPin: Boolean(getSetting('ext_beregnung_pin_hash', '')),
      haAvailable: ha.available(), port: parseInt(process.env.BEREGNUNG_PORT || '5000', 10) || null, list, sensors, error });
  });
  // Geräte neu zuordnen nur mit eigenem Passwort (src/geraete.js) – falsche Versuche je Benutzer gebremst
  admin.put('/config', need('beregnung'), async (req, res) => {
    const b = req.body || {};
    const pw = G.bestaetigt(req, res, ctx.ownPwOk); if (!pw) return;
    let geprueft;
    try { geprueft = await geraetePruefen(cfg(), cleanCfg(b, cleanName), { user: req.user, confirmed: pw.confirmed }); }
    catch (e) { if (G.antwort(res, e)) return; return bad(res, e.message); }
    let out;
    const before = cfg();
    try { out = cleanCfg(b, cleanName); nachgeprueft(geprueft, before, out); } catch (e) { return bad(res, e.message); }
    if (out.backend !== before.backend && (db.prepare("SELECT 1 FROM irr_steps WHERE state IN ('wait','run') LIMIT 1").get() || pendingStop())) return bad(res, 'Während einer laufenden Beregnung kann die Anbindung nicht gewechselt werden.');
    setSetting('ext_beregnung_cfg', JSON.stringify(out));
    zoneAlert(before, out, req.user.name || req.user.username);
    cache.at = 0;
    audit(req.user, 'Beregnung eingerichtet', `${out.plaetze.length} Plätze, ${vendorOf(out).name}, Schutz: ${{ login: 'Anmeldung', app: 'nur Mitglieder-App' }[out.mode] || 'Vereins-PIN'}`);
    res.json({ ok: true, cfg: out });
  });
  admin.put('/pin', need('beregnung'), (req, res) => {
    const pin = String((req.body || {}).pin || '');
    if (!/^\d{4,8}$/.test(pin)) return bad(res, 'Die PIN muss aus 4 bis 8 Ziffern bestehen.');
    { const steps = new Set([...pin].slice(1).map((c, i) => c - pin[i])); if (steps.size === 1 && [0, 1, -1].includes([...steps][0])) return bad(res, 'Diese PIN ist zu leicht zu erraten (z. B. 1111 oder 1234) – bitte eine andere wählen.'); }
    setSetting('ext_beregnung_pin_hash', auth.hashSecret(pin));
    audit(req.user, 'Beregnung: Vereins-PIN geändert', '');
    res.json({ ok: true });
  });
  admin.put('/key', need('beregnung'), (req, res) => {
    const key = String((req.body || {}).key || '').trim();
    if (key && !/^[A-Za-z0-9-]{8,64}$/.test(key)) return bad(res, 'Das sieht nicht wie ein Hydrawise-API-Key aus.');
    H.geheim.set('hw_key', key);
    cache.at = 0;
    audit(req.user, key ? 'Beregnung: Hydrawise-API-Key gespeichert' : 'Beregnung: Hydrawise-API-Key gelöscht', '');
    res.json({ ok: true });
  });
  /* Bedienen in der Verwaltung – dieselben Kacheln wie in Mitglieder-App und am Tablet: Platz starten, einzeln oder alles stoppen */
  admin.post('/run', need('beregnung', 'beregnung_bedienen'), (req, res) => {
    try { res.json({ ok: true, ...enqueue(parseInt((req.body || {}).platz, 10), req.user.name || req.user.username) }); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  admin.post('/stop', need('beregnung', 'beregnung_bedienen'), async (req, res) => {
    const b = req.body || {}, who = req.user.name || req.user.username;
    if (b.platz !== undefined && b.platz !== null && b.platz !== '') {
      try { const r = await stopPlatz(parseInt(b.platz, 10), who); return res.json({ ok: !r.errs.length, errors: r.errs, pendingSec: r.pendingSec }); } catch (e) { return res.status(400).json({ error: e.message }); }
    }
    const r = await stopAll(who);
    res.json({ ok: !r.errs.length, errors: r.errs, pendingSec: r.pendingSec });
  });
  admin.get('/status', need('beregnung', 'beregnung_bedienen'), async (req, res) => {
    const hits = cfg().backend === 'hydrawise' ? hwHits().length : 0;
    res.json({ ...(await status()), shared: hits >= 3 ? SHARED(hits) : '' });
  });
  const monthRows = m => db.prepare('SELECT * FROM irr_log WHERE at >= ? AND at < ? ORDER BY at DESC').all(m + '-01', nextMonth(m) + '-01');
  admin.get('/log', need('beregnung'), (req, res) => {
    const months = db.prepare("SELECT DISTINCT substr(at,1,7) m FROM irr_log ORDER BY m DESC").all().map(r => r.m);
    const cur = localTs().slice(0, 7);
    if (!months.includes(cur)) months.unshift(cur);
    const m = /^\d{4}-\d{2}$/.test(String(req.query.month)) ? String(req.query.month) : cur;
    setSetting('ext_beregnung_err_seen', localTs());   // Verlauf angesehen: Fehler-Hinweis auf der Übersicht erledigt
    res.json({ month: m, months, rows: monthRows(m) });
  });
  async function logXlsx(m) {
    const ExcelJS = ctx.require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Beregnung ' + m);
    ws.columns = [{ header: 'Zeitpunkt', key: 'at', width: 20 }, { header: 'Aktion', key: 'action', width: 10 }, { header: 'Platz', key: 'platz', width: 22 },
      { header: 'Minuten', key: 'min', width: 10 }, { header: 'Wer', key: 'who', width: 22 }, { header: 'Hinweis', key: 'detail', width: 50 }];
    ws.getRow(1).font = { bold: true };
    for (const r of monthRows(m).reverse()) ws.addRow({ ...r, at: r.at.split(' ')[0].split('-').reverse().join('.') + ' ' + r.at.slice(11, 16), action: { start: 'Start', stop: 'Stopp', fehler: 'Fehler', kopplung: 'Freischaltung' }[r.action] || r.action, min: r.sec ? Math.round(r.sec / 6) / 10 : null });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  // lesbarer Auszug für die nächtliche Datensicherung (Kern): Protokoll des laufenden Monats
  ctx.hooks.backupExports = async () => { const m = localTs().slice(0, 7); return [{ name: `Beregnung-Protokoll_${m}.xlsx`, buffer: await logXlsx(m) }]; };
  admin.get('/log.xlsx', need('beregnung'), async (req, res) => {
    const m = /^\d{4}-\d{2}$/.test(String(req.query.month)) ? String(req.query.month) : localTs().slice(0, 7);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="beregnung-${m}.xlsx"`);
    res.end(await logXlsx(m));
  });


  // Der Ablauf läuft IMMER – auch bei ausgeschaltetem Modul: Zonen, die noch offen sind (state run/wait), müssen zu Ende laufen bzw.
  // abgeschaltet werden. Nur neue Starts hängen am Modul (enqueue wird nur über aktive Routen erreicht).
  setInterval(tick, 1000).unref();
  // Modul wird in der Verwaltung ausgeschaltet oder Clubwerk beendet (Update, Neustart): nichts darf offen bleiben
  ctx.hooks.deactivate = () => stopAll('System (Modul ausgeschaltet)');
  ctx.hooks.shutdown = async () => { if (db.prepare("SELECT 1 FROM irr_steps WHERE state IN ('wait','run') LIMIT 1").get()) await stopAll('System (Beenden)'); };
  startPortApp(ctx);
}
const nextMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`; };

module.exports = { activate, autoSub };
