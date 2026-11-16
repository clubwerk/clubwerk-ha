'use strict';
/* Home Assistant ansprechen (Beregnung, Zugang, Flutlicht): Zugriff über den Supervisor mit dem Token des Add-ons,
   für Tests über HA_URL/HA_TOKEN. Fehlermeldungen in Alltagssprache. */
const BASE = () => (process.env.HA_URL || 'http://supervisor/core/api').replace(/\/$/, '');
const TOKEN = () => process.env.SUPERVISOR_TOKEN || process.env.HA_TOKEN || '';
const available = () => demo() || Boolean(TOKEN());   // Demo: Geräte erscheinen bedienbar (Schalten wird nur simuliert)

/* Demo (erfundene Daten): nie echte Geräte schalten – Dienste tun nichts, Zustände sind leer */
const demo = () => { try { return require('./db').getSetting('demo_mode', '') === '1'; } catch (e) { return false; } };
async function call(method, p, body) {
  if (demo()) { console.log(`Demo: Home Assistant nicht angesprochen (${method} ${p})`); return []; }
  if (!TOKEN()) throw new Error('Clubwerk hat keinen Zugangsschlüssel für Home Assistant bekommen. Bitte das Add-on einmal neu starten; hilft das nicht, im Protokoll des Add-ons die Zeile „Verbindung zu Home Assistant“ prüfen.');
  if (method === 'POST' && p.startsWith('/services/')) { gen++; cache.at = 0; }   // Schaltbefehl: danach den Zustand frisch lesen
  const r = await fetch(BASE() + p, {
    method, headers: { Authorization: 'Bearer ' + TOKEN(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000),
  });
  if (r.status === 401 || r.status === 403) throw new Error(`Home Assistant verweigert den Zugriff (${r.status}). Bitte das Add-on einmal neu starten.`);
  if (!r.ok) throw new Error(`Home Assistant antwortet mit ${r.status}`);
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return t; }
}

/* Zustände aller Geräte – gemeinsam für Beregnung, Zugang und Flutlicht: eine Abfrage reicht für alle Module und alle offenen
   Seiten (gleichzeitige Aufrufe warten auf dieselbe Antwort), ein Fehler gilt ebenso kurz weiter, damit ein ausgefallenes
   Home Assistant nicht von jedem Modul einzeln bestürmt wird. Rückgabe: Map entity_id → Zustand. */
let cache = { at: 0, states: null, err: null }, reading = null, gen = 0;
async function states(maxAge = 3000) {
  if (Date.now() - cache.at < maxAge) { if (cache.err) throw cache.err; return cache.states; }
  // eine laufende Abfrage nur mitbenutzen, wenn seitdem nichts geschaltet wurde
  if (reading && reading.gen === gen) return reading.p;
  const r = { gen, p: null };
  r.p = call('GET', '/states').then(s => { const m = new Map((Array.isArray(s) ? s : []).map(x => [x.entity_id, x])); if (r.gen === gen) cache = { at: Date.now(), states: m, err: null }; return m; },
    e => { if (r.gen === gen) cache = { at: Date.now(), states: null, err: e }; throw e; }).finally(() => { if (reading === r) reading = null; });
  reading = r;
  return r.p;
}

/** Geräte einer Integration (z. B. 'nuki') – integration ist immer ein fester Name aus der Geräteliste des Moduls */
const integrationEntities = integration => call('POST', '/template', { template: `{{ integration_entities('${integration}') | tojson }}` });

/** Benachrichtigung über einen notify-Dienst von Home Assistant; Fehler landen nur im Protokoll des Add-ons */
async function notify(service, title, message) {
  const svc = String(service || '').replace(/^notify\./, '');
  if (!svc || !TOKEN() || !/^[a-z0-9_]+$/.test(svc)) return;
  try { await call('POST', '/services/notify/' + svc, { title, message }); } catch (e) { console.error(`${title}: Benachrichtigung fehlgeschlagen:`, e.message); }
}

module.exports = { available, call, states, integrationEntities, notify };
