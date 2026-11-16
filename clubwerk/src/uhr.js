'use strict';
/**
 * Uhr-Plausibilität. Ein Raspberry Pi hat keine Batterie-Uhr; ohne Internet (reiner Lokalbetrieb) startet er mit einer alten Zeit.
 * Dann stimmen Türzeiten, Flutlicht-Automatik und Geldläufe nicht (Beitragslauf, Einzug, Abrechnung mit falschem Datum, doppelt
 * berechnete Zeiträume). Beim Start wird die Uhr mit dem neuesten Zeitstempel in der Datenbank verglichen; liegt sie mehr als
 * 2 Stunden davor (eine Stunde Zeitumstellung ist kein Fehler), gilt sie als falsch:
 *  – Sicherheitswarnung (auch in der Übersicht), Geräte-Automatik und Geldläufe gesperrt (ok() → false),
 *  – frei, sobald die Uhr den Zeitstempel erreicht hat (Zeit wurde gestellt) oder ein Admin die Warnung als erledigt markiert
 *    (Einstellungen › Sicherheit: „Die Uhrzeit stimmt“).
 * Mit der Test-Uhr (src/testuhr.js) ist die Prüfung aus – deren Zeit weicht absichtlich von SQLites datetime('now') ab –, außer
 * CW_TEST_UHR_PRUEFEN=1 (Testreihe strom).
 */
const { db } = require('./db');

const TOLERANZ = 2 * 3600000;
const MSG = 'Die Uhrzeit von Clubwerk stimmt gerade nicht – Geldläufe und zeitgesteuerte Geräte sind gesperrt, bis sie stimmt. Bitte die Uhrzeit von Home Assistant prüfen.';
let ref = 0, refTxt = '', gesperrt = false, alertId = null;
const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):?(\d{2})?/.exec(String(s || '')); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).getTime() : 0; };

/** neuester Zeitstempel, den Clubwerk selbst geschrieben hat (Protokoll, Verkauf) */
function neuester() {
  let best = 0, txt = '';
  for (const sql of ['SELECT at t FROM audit_log ORDER BY id DESC LIMIT 1', 'SELECT created_at t FROM bookings ORDER BY id DESC LIMIT 1']) {
    try { const r = db.prepare(sql).get(); const t = r ? parse(r.t) : 0; if (t > best) { best = t; txt = r.t; } } catch (e) { /* Tabelle fehlt */ }
  }
  return { t: best, txt };
}

/** beim Start: Uhr gegen die Datenbank prüfen. securityAlert aus src/security.js */
function pruefen(securityAlert) {
  if (require('./testuhr').aktiv && process.env.CW_TEST_UHR_PRUEFEN !== '1') return false;
  const n = neuester();
  if (!n.t || Date.now() >= n.t - TOLERANZ) return false;
  ref = n.t; refTxt = n.txt; gesperrt = true;
  const jetzt = new Date().toLocaleString('de-DE');
  console.error(`UHRZEIT FALSCH: Die Uhr zeigt ${jetzt}, der neueste Eintrag in der Datenbank ist von ${refTxt}. Geldläufe und zeitgesteuerte Geräte bleiben gesperrt, bis die Uhr stimmt.`);
  alertId = securityAlert('uhr', `Die Uhr von Clubwerk zeigt ${jetzt}, der neueste Eintrag in der Datenbank ist aber von ${new Date(ref).toLocaleString('de-DE')}. Wahrscheinlich hat das Gerät nach einem Neustart keine Uhrzeit aus dem Internet bekommen. Geldläufe (Beitragslauf, Einzug, Abrechnung) und zeitgesteuerte Geräte (Türzeiten, Flutlicht-Automatik) sind gesperrt, bis die Uhr stimmt. Stimmt die Uhrzeit doch, die Warnung als erledigt markieren.`);
  return true;
}

/** Uhr in Ordnung? (für Geldläufe und Geräte-Automatik) */
function ok() {
  if (!gesperrt) return true;
  if (Date.now() >= ref) { gesperrt = false; console.log('Uhrzeit: stimmt wieder – Geldläufe und Geräte-Automatik sind frei.'); return true; }
  if (alertId) {
    try { const r = db.prepare('SELECT done_at FROM sec_alerts WHERE id = ?').get(alertId); if (!r || r.done_at) { gesperrt = false; console.log('Uhrzeit: von einem Admin bestätigt – Geldläufe und Geräte-Automatik sind frei.'); return true; } }
    catch (e) { /* weiter gesperrt */ }
  }
  return false;
}

/** für die Übersicht: null oder { jetzt, neuester } */
const de = t => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const status = () => (ok() ? null : { jetzt: de(Date.now()), neuester: de(ref) });

module.exports = { pruefen, ok, status, MSG };
