'use strict';
/* =====================================================================================================
   Codetastatur am Tor (Teil des Moduls „Zugang“)
   Eine Tür kann eine Codetastatur haben – in Home Assistant ein Gerät, dessen Zustand (oder Merkmal „code“) den zuletzt
   eingetippten Code meldet, z. B. ESPHome mit Wiegand-Tastatur und key_collector (Anleitung). Die Tastatur prüft nichts
   selbst: Clubwerk liest die Eingabe, fragt das Modul „Plätze“ über den Hook courtCode, ob eine Buchung mit diesem Code
   jetzt dieses Tor öffnen darf, und öffnet die Tür wie aus der App. Ohne „Plätze“ öffnet kein Code.
   Schutz gegen Durchprobieren: je Tastatur 5 falsche Codes in 10 Minuten → Pause (5 Min., bei Wiederholung innerhalb von
   24 Stunden doppelt so lang, höchstens 60 Min.) und Sicherheitswarnung. Zusätzlich über alle Tastaturen zusammen: 10 falsche Codes in
   10 Minuten sperren alle Tastaturen (mehrere Tore vervielfachen die Rateversuche nicht). Zähler und Sperren stehen in den
   Einstellungen (ext_zugang_kp_guard) und überstehen einen Neustart. Ins Protokoll kommt nie der Code, nur Buchung und Tor.
   Neue Eingabe = neuer Zeitstempel in Home Assistant (last_reported/last_updated); den Stand beim Start und nach einem Ausfall der
   Tastatur oder von Home Assistant liest Clubwerk nur ein (sonst öffnete der zuletzt eingetippte Code das Tor noch einmal).
   ===================================================================================================== */
const RE_KEYPAD = /^(sensor|event|text|input_text)\.[a-z0-9_]+$/;
const FAILS = 5, FAILS_ALL = 10, WINDOW = 10 * 60000, BASE_LOCK = 5 * 60000, MAX_LOCK = 60 * 60000, DAY = 24 * 3600000;
const ALLE = '*';   // Schlüssel der gemeinsamen Grenze über alle Tastaturen

function activate(ctx, h) {
  const { cfg, act, log, notify, ha } = h;
  const seen = new Map();      // Tür-ID → { stamp, value } der zuletzt gelesenen Eingabe
  // Tür-ID (bzw. ALLE) → { fails: [ms], until: ms, locks: [ms] } – gespeichert, damit ein Neustart die Sperre nicht aufhebt
  const guard = new Map(), KEY = 'kp_guard';
  try { for (const [k, v] of Object.entries(JSON.parse(ctx.setting(KEY, '{}')) || {})) if (v && typeof v === 'object') guard.set(k, { fails: (v.fails || []).map(Number), until: Number(v.until) || 0, locks: (v.locks || []).map(Number) }); } catch (e) { console.error('Codetastatur: Zähler nicht gelesen:', e.message); }
  const speichern = () => { const now = Date.now(), o = {};
    for (const [k, v] of guard) { const x = { fails: v.fails.filter(t => now - t < WINDOW), until: v.until > now ? v.until : 0, locks: v.locks.filter(t => now - t < DAY) }; if (x.fails.length || x.until || x.locks.length) o[k] = x; }
    ctx.setSetting2(KEY, JSON.stringify(o)); };
  const busy = new Set();
  const status = new Map();    // Tür-ID → 'ok' | 'offline'
  const g = id => { if (!guard.has(id)) guard.set(id, { fails: [], until: 0, locks: [] }); return guard.get(id); };
  const until = id => { const x = guard.get(id); return x && x.until > Date.now() ? x.until : 0; };
  const lockedUntil = id => Math.max(until(id), until(ALLE));   // eigene Sperre oder die gemeinsame aller Tastaturen
  const hm = ms => new Date(ms).toTimeString().slice(0, 5);

  /** Sperre setzen (eine Tastatur oder alle) → Dauer in Minuten */
  function sperren(x, now) {
    x.locks = x.locks.filter(t => now - t < DAY); x.locks.push(now);
    const ms = Math.min(MAX_LOCK, BASE_LOCK * 2 ** (x.locks.length - 1));
    x.until = now + ms; x.fails = [];
    return Math.round(ms / 60000);
  }
  /** falscher Code: zählen – ab 5 in 10 Minuten an dieser Tastatur bzw. 10 an allen zusammen sperren und melden */
  function fail(door) {
    const now = Date.now(), all = g(ALLE);
    all.fails = all.fails.filter(t => now - t < WINDOW); all.fails.push(now);
    if (all.fails.length >= FAILS_ALL) {
      const min = sperren(all, now); g(door.id).fails = [];
      log('sperre', null, null, `Alle Codetastaturen nach ${FAILS_ALL} falschen Codes für ${min} Minuten gesperrt (bis ${hm(all.until)} Uhr)`);
      notify(`${FAILS_ALL} falsche Codes an den Tastaturen – alle Tastaturen für ${min} Minuten gesperrt.`);
      ctx.securityAlert('tastatur', `Zugang: An den Codetastaturen wurden zusammen ${FAILS_ALL} falsche Codes in kurzer Zeit eingetippt (zuletzt an ${door.name}). Alle Tastaturen sind bis ${hm(all.until)} Uhr gesperrt${all.locks.length > 1 ? ` (heute schon ${all.locks.length}-mal)` : ''}. Probiert jemand Codes durch? Bitte im Zugangsprotokoll nachsehen.`, { key: ALLE });
      return speichern();
    }
    const x = g(door.id);
    x.fails = x.fails.filter(t => now - t < WINDOW); x.fails.push(now);
    if (x.fails.length < FAILS) return speichern();
    const min = sperren(x, now);
    log('sperre', null, door.name, `Codetastatur nach ${FAILS} falschen Codes für ${min} Minuten gesperrt (bis ${hm(x.until)} Uhr)`);
    notify(`${door.name}: ${FAILS} falsche Codes an der Tastatur – für ${min} Minuten gesperrt.`);
    ctx.securityAlert('tastatur', `Zugang: An der Codetastatur von ${door.name} wurden ${FAILS} falsche Codes in kurzer Zeit eingetippt. Die Tastatur ist bis ${hm(x.until)} Uhr gesperrt${x.locks.length > 1 ? ` (heute schon ${x.locks.length}-mal)` : ''}. Probiert jemand Codes durch? Bitte im Zugangsprotokoll nachsehen.`, { key: door.id });
    speichern();
  }

  /** eine Eingabe prüfen und ggf. öffnen – value: eingetippte Ziffern (kommen nie ins Protokoll) */
  async function eingabe(door, value) {
    const c = cfg();
    if (lockedUntil(door.id)) return log('abgelehnt', null, door.name, `Codetastatur gesperrt bis ${hm(lockedUntil(door.id))} Uhr`);
    if (!/^\d{6}$/.test(value)) { log('abgelehnt', null, door.name, 'Ungültiger Platzcode'); return fail(door); }
    if (c.blockAll) return log('abgelehnt', null, door.name, 'Platzcode: Zugang ist für alle gesperrt');
    if (!ctx.uhrOk()) return log('abgelehnt', null, door.name, 'Platzcode: Die Uhrzeit von Clubwerk stimmt gerade nicht');
    const r = (await ctx.callHooks('courtCode', { door: door.id, code: value })).find(x => x.id === 'buchung');
    const m = r && r.result;
    if (!m) { log('abgelehnt', null, door.name, 'Falscher Platzcode'); return fail(door); }   // ohne Modul „Plätze“ gibt es keine Codes
    if (m.why === 'wartet') return log('fehler', null, door.name, 'Platzcodes warten nach einer Wiederherstellung auf das Entsperren des Tresors');
    if (m.why === 'zeit') return log('abgelehnt', m.who, door.name, `Platzcode ${m.early ? 'noch nicht' : 'nicht mehr'} gültig (Buchung ${m.text})`);
    if (m.why === 'tor') return log('abgelehnt', m.who, door.name, `Platzcode gilt nicht für dieses Tor (Buchung ${m.text})`);
    if (!m.ok) { log('abgelehnt', null, door.name, 'Falscher Platzcode'); return fail(door); }
    if (g(door.id).fails.length) { g(door.id).fails = []; speichern(); }   // die gemeinsame Zählung bleibt (richtige Codes heben sie nicht auf)
    try { await act(door, 'auf'); log(door.type === 'lock' ? 'auf' : 'oeffnen', m.who, door.name, `Platzcode (Buchung ${m.text})`); }
    catch (e) { log('fehler', m.who, door.name, `Platzcode richtig, Tür reagiert nicht (${e.message})`); notify(`${door.name} ließ sich mit dem Platzcode nicht öffnen (${e.message}).`); }
  }

  /** Tastaturen abfragen (nur Türen mit Tastatur, je Gerät eine kurze Abfrage) */
  async function poll() {
    if (!ctx.isActive() || !ha.available()) return;
    for (const door of cfg().doors.filter(d => d.keypad)) {
      if (busy.has(door.id)) continue;
      let s; try { s = await ha.state(door.keypad); } catch (e) { s = null; }
      // Tastatur oder Home Assistant weg: danach meldet HA den zuletzt eingetippten Code mit neuem Zeitstempel (ESPHome verbindet neu,
      // HA stellt Zustände nach dem Neustart wieder her) – das ist keine Eingabe; der erste Stand danach wird nur eingelesen
      if (!s || s.state === 'unavailable') { status.set(door.id, 'offline'); seen.delete(door.id); continue; }
      if (s.state === 'unknown') { status.set(door.id, 'ok'); continue; }
      status.set(door.id, 'ok');
      const a = s.attributes || {}, value = String(a.code != null ? a.code : s.state).replace(/\s/g, '');
      const stamp = `${s.last_reported || s.last_updated || s.last_changed || ''}|${door.keypad}`;
      const before = seen.get(door.id); seen.set(door.id, { stamp, value });
      if (!before || before.stamp === stamp) continue;   // erster Blick nach dem Start oder nichts Neues
      if (!value || (s.entity_id.startsWith('event.') && a.code == null)) continue;   // leer gemeldet (Tastatur setzt nach der Eingabe zurück)
      busy.add(door.id);
      try { await eingabe(door, value); } catch (e) { console.error('Codetastatur:', e.message); } finally { busy.delete(door.id); }
    }
  }
  let running = false;
  setInterval(() => { if (running) return; running = true; poll().catch(() => {}).finally(() => { running = false; }); }, process.env.CW_TEST_FAST ? 300 : 1000).unref();

  /** für die Verwaltung (Übersicht, Türen) */
  const info = door => (door.keypad ? { keypad: true, keypadOffline: status.get(door.id) === 'offline', keypadLockedUntil: lockedUntil(door.id) ? hm(lockedUntil(door.id)) : null } : { keypad: false });
  /** Sperre aufheben (Verwaltung, Recht „Zugang bedienen“) */
  const unlock = id => {   // hebt auch die gemeinsame Sperre aller Tastaturen auf
    let n = false; for (const k of [id, ALLE]) { const x = guard.get(k); if (x && (x.until || x.fails.length)) { n = n || x.until > Date.now(); x.until = 0; x.fails = []; } }
    speichern(); return n;
  };
  return { RE_KEYPAD, info, unlock, eingabe };
}

module.exports = { activate, RE_KEYPAD };
