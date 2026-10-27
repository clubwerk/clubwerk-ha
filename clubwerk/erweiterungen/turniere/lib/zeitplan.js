'use strict';
/* =====================================================================================================
   Turniere – Zeitplan des Turniertags (ohne Datenbank)
   Je Platz laufen die Matches in der geplanten Reihenfolge. Ein Match beginnt frühestens
   - zur geplanten Zeit,
   - wenn der Platz frei ist (Vorgänger beendet bzw. voraussichtlich beendet),
   - wenn alle seine Spieler ihr vorheriges Match beendet und die Pause gehabt haben,
   - und nicht in der Vergangenheit (noch nicht gestartet → frühestens jetzt).
   Läuft ein Match länger als geplant, rutschen die Folgespiele so automatisch nach hinten; der Verzug wird ausgewiesen.
   Zeiten: 'JJJJ-MM-TT HH:MM' (lokale Zeit), intern Minuten seit 1970.
   ===================================================================================================== */

const toMin = s => { if (!s) return null; const t = Date.parse(String(s).replace(' ', 'T').slice(0, 16)); return Number.isFinite(t) ? Math.round(t / 60000) : null; };
const pad = n => String(n).padStart(2, '0');
const fromMin = m => { const d = new Date(m * 60000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/**
 * matches: [{ id, court, time ('JJJJ-MM-TT HH:MM' geplant, aktuell), started_at, ended_at, players: [personId] }]
 * → Map(id → { start, end ('JJJJ-MM-TT HH:MM' voraussichtlich), delay (Minuten gegenüber time), running, done })
 * Matches ohne Platz bekommen keine Zeit (Warteschlange).
 */
function schedule(matches, { now = new Date(), minutes = 90, pause = 30 } = {}) {
  const nowM = Math.floor((now instanceof Date ? now.getTime() : now) / 60000);
  const courtFree = new Map(), playerFree = new Map(), out = new Map();
  const order = matches.filter(m => m.court).map(m => ({ m, at: toMin(m.started_at) ?? toMin(m.time) ?? Infinity }))
    .sort((x, y) => x.at - y.at || (x.m.sort || 0) - (y.m.sort || 0) || x.m.id - y.m.id);
  // erst gespielte und laufende Matches (sie stehen fest), dann die übrigen in geplanter Reihenfolge
  const fixed = order.filter(x => x.m.started_at || x.m.ended_at), rest = order.filter(x => !x.m.started_at && !x.m.ended_at);
  const busy = (m, end) => { courtFree.set(m.court, Math.max(courtFree.get(m.court) ?? -Infinity, end)); for (const p of m.players || []) playerFree.set(p, Math.max(playerFree.get(p) ?? -Infinity, end + pause)); };
  for (const { m } of fixed) {
    const start = toMin(m.started_at) ?? toMin(m.time) ?? nowM;
    const end = m.ended_at ? toMin(m.ended_at) : Math.max(start + minutes, nowM);   // überzieht es, endet es frühestens jetzt
    busy(m, end);
    out.set(m.id, { start: fromMin(start), end: fromMin(end), delay: m.time ? Math.max(0, start - toMin(m.time)) : 0, running: !m.ended_at, done: Boolean(m.ended_at) });
  }
  for (const { m, at } of rest) {
    const plan = Number.isFinite(at) ? at : nowM;
    const start = Math.max(plan, nowM, courtFree.get(m.court) ?? -Infinity, ...(m.players || []).map(p => playerFree.get(p) ?? -Infinity));
    busy(m, start + minutes);
    out.set(m.id, { start: fromMin(start), end: fromMin(start + minutes), delay: Number.isFinite(at) ? Math.max(0, start - at) : 0, running: false, done: false });
  }
  return out;
}

module.exports = { schedule, toMin, fromMin };
