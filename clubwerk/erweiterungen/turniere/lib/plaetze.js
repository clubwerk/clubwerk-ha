'use strict';
/* Plätze eines Turniers – gemeinsam für LK-Turniertag (lk.js) und freies Turnier (ft.js): Plätze des Buchungssystems
   zuordnen und dort für die Turnierzeit sperren (Hook courtLock des Moduls „Plätze“). */
module.exports = function plaetze({ db, int, hook, bookingOn, err, isTime }) {
  /** Plätze des Buchungssystems (leer ohne das Modul „Plätze“) */
  const liste = async () => (bookingOn() ? (await hook('courtList')) || [] : []);
  /** Platz des Buchungssystems → Name */
  const namen = async () => new Map((await liste()).map(x => [x.id, x.name]));
  /** neuer Turnierplatz: Name darf es noch nicht geben → Sortierung (hinten an) */
  function neu(alle, name) {
    if (alle.some(x => x.name.toLowerCase() === name.toLowerCase())) throw err('Diesen Platz gibt es schon.');
    return alle.reduce((a, x) => Math.max(a, x.sort), 0) + 1;
  }
  /** Zuordnung aus dem Body (resource_id) prüfen → neue Zuordnung; ohne Angabe bleibt die alte */
  async function zuordnung(b, platz, alle) {
    if (b.resource_id === undefined) return platz.resource_id;
    const rid = b.resource_id ? int(b.resource_id) : null;
    if (rid) {
      if (!(await liste()).some(x => x.id === rid)) throw err('Diesen Platz gibt es im Buchungssystem nicht.');
      if (alle().some(y => y.id !== platz.id && y.resource_id === rid)) throw err('Dieser Platz des Buchungssystems ist schon einem anderen Turnierplatz zugeordnet.');
    }
    return rid;
  }
  /** Sperren im Buchungssystem abgleichen: art 'lk'|'ft', wanted(x) → gewünschte Sperren */
  const abgleich = (art, wanted) => async (x, by, preview = false) => {
    if (!bookingOn()) return { made: 0, removed: 0, conflicts: [] };
    const r = await hook('courtLock', { key: `tu:${art}:${x.id}`, locks: wanted(x), title: `Turnier: ${x.name}`.slice(0, 160), by, preview });
    if (r && r.error) throw err(r.error);
    return r || { made: 0, removed: 0, conflicts: [] };
  };
  /** Plätze im Buchungssystem sperren: Vorschau (Buchungen, die storniert würden) bzw. sperren; off = Sperre aufheben.
   *  table: tu_day | tu_ft, row(id) frisch lesen, courts(id), suggest(x) Vorschlag der Zeiten, sync = abgleich(...), offen(x) wirft, wenn beendet */
  const sperre = ({ table, row, courts, suggest, sync, offen }) => async (x, b, by) => {
    if (!bookingOn()) throw err('Das Modul „Plätze“ ist nicht aktiv – es gibt nichts zu sperren.');
    if (b.off) { db.prepare(`UPDATE ${table} SET locked = 0 WHERE id = ?`).run(x.id); const r = await sync(row(x.id), by); return { ok: true, ...r }; }
    offen(x);
    const from = b.from || x.lock_from || suggest(x).from, to = b.to || x.lock_to || suggest(x).to;
    if (!isTime(from) || !(isTime(to) || to === '24:00') || to <= from) throw err('Bitte die Zeiten prüfen (z. B. 08:00 bis 20:00).');
    if (!courts(x.id).some(c => c.resource_id)) throw err('Erst die Turnierplätze den Plätzen des Buchungssystems zuordnen.');
    const next = { ...x, locked: 1, lock_from: from, lock_to: to };
    if (b.preview) return await sync(next, by, true);
    db.prepare(`UPDATE ${table} SET locked = 1, lock_from = ?, lock_to = ? WHERE id = ?`).run(from, to, x.id);
    return { ok: true, ...(await sync(row(x.id), by)) };
  };
  return { liste, namen, neu, zuordnung, abgleich, sperre };
};
