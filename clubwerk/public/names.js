'use strict';
/* Namenszerlegung im Browser – eine Kopie für Verwaltung (admin.js) und Tablet (tablet.js), gleiches Verhalten wie
   db.splitPersonName/nameKey auf dem Server: „von/van/de …“ gehören zum Nachnamen, sortiert wird nach dem Kern
   (von der Heide → H); „Müller, Karl“ wird erkannt; Mannschaften & Sonderkonten bleiben unverändert.
   Verfügbar als window.CWNames = { NAME_PART, splitName, coreLast, lastFirst, nameKey }. */
(() => {
  const NAME_PART = new Set(['von', 'van', 'vom', 'zu', 'zum', 'zur', 'de', 'der', 'den', 'la', 'le', 'di', 'da', 'ten', 'op', 'del', 'dos']);
  /** „Anna von der Heide“ → { first: 'Anna', last: 'von der Heide' }; „Müller, Karl“ → { first: 'Karl', last: 'Müller' } */
  function splitName(name) {
    const n = String(name || '').trim().replace(/\s+/g, ' ');
    if (n.includes(',')) { const [l, ...f] = n.split(','); return { first: f.join(',').trim(), last: l.trim() }; }
    const w = n.split(' ');
    if (w.length < 2) return { first: '', last: n };
    let i = w.length - 1;
    while (i > 1 && NAME_PART.has(w[i - 1].toLowerCase())) i--;
    return { first: w.slice(0, i).join(' '), last: w.slice(i).join(' ') };
  }
  /** Nachname ohne Partikel (für Sortierung und Anfangsbuchstaben): „von der Heide“ → „Heide“ */
  const coreLast = name => { const l = splitName(name).last; return l.split(' ').filter(x => !NAME_PART.has(x.toLowerCase())).join(' ') || l; };
  /** Anzeige „Nachname, Vorname“ („von der Heide, Anna“); Mannschaften & Sonderkonten (kind ≠ mitglied) unverändert */
  function lastFirst(name, kind) {
    const n = String(name || '').trim().replace(/\s+/g, ' ');
    if ((kind && kind !== 'mitglied') || n.includes(',')) return n;
    const { first, last } = splitName(n);
    return first ? `${last}, ${first}` : last;
  }
  /** Sortierschlüssel wie db.nameKey auf dem Server (Umlaute, Akzente, Kern des Nachnamens, dann Vorname) */
  const deKey = v => String(v == null ? '' : v).toLocaleLowerCase('de').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const nameKey = (name, kind) => ((kind && kind !== 'mitglied') ? deKey(name) : deKey(coreLast(name)) + '\u0001' + deKey(splitName(name).first));
  window.CWNames = { NAME_PART, splitName, coreLast, lastFirst, nameKey };
})();
