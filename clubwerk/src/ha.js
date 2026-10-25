'use strict';
/* Home Assistant ansprechen (Beregnung, Zugang): Zugriff über den Supervisor mit dem Token des Add-ons,
   für Tests über HA_URL/HA_TOKEN. Fehlermeldungen in Alltagssprache. */
const BASE = () => (process.env.HA_URL || 'http://supervisor/core/api').replace(/\/$/, '');
const TOKEN = () => process.env.SUPERVISOR_TOKEN || process.env.HA_TOKEN || '';
const available = () => Boolean(TOKEN());

async function call(method, p, body) {
  if (!TOKEN()) throw new Error('Clubwerk hat keinen Zugangsschlüssel für Home Assistant bekommen. Bitte das Add-on einmal neu starten; hilft das nicht, im Protokoll des Add-ons die Zeile „Verbindung zu Home Assistant“ prüfen.');
  const r = await fetch(BASE() + p, {
    method, headers: { Authorization: 'Bearer ' + TOKEN(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000),
  });
  if (r.status === 401 || r.status === 403) throw new Error(`Home Assistant verweigert den Zugriff (${r.status}). Bitte das Add-on einmal neu starten.`);
  if (!r.ok) throw new Error(`Home Assistant antwortet mit ${r.status}`);
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return t; }
}

/** Geräte einer Integration (z. B. 'nuki') – integration ist immer ein fester Name aus der Geräteliste des Moduls */
const integrationEntities = integration => call('POST', '/template', { template: `{{ integration_entities('${integration}') | tojson }}` });

/** Benachrichtigung über einen notify-Dienst von Home Assistant; Fehler landen nur im Protokoll des Add-ons */
async function notify(service, title, message) {
  const svc = String(service || '').replace(/^notify\./, '');
  if (!svc || !TOKEN() || !/^[a-z0-9_]+$/.test(svc)) return;
  try { await call('POST', '/services/notify/' + svc, { title, message }); } catch (e) { console.error(`${title}: Benachrichtigung fehlgeschlagen:`, e.message); }
}

module.exports = { available, call, integrationEntities, notify };
