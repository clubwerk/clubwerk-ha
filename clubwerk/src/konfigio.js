/* Gemeinsame Bausteine für den Funktionsexport/-import der Module (ctx.hooks.exportConfig / importConfig).
   Regel für alle Module: gleicher Name (ohne Groß-/Kleinschreibung) → mit den Werten aus der Datei aktualisieren,
   sonst neu anlegen, nie löschen. */

/** Zeile schreiben: vorhandene (found = { id }) aktualisieren, sonst neu anlegen. v = Spalte → Wert. Gibt 'neu' oder 'aktualisiert' zurück. */
function schreibe(db, table, v, found) {
  const k = Object.keys(v);
  if (found) {
    db.prepare(`UPDATE ${table} SET ${k.map(x => x + ' = ?').join(', ')} WHERE id = ?`).run(...k.map(x => v[x]), found.id);
    return 'aktualisiert';
  }
  db.prepare(`INSERT INTO ${table}(${k.join(', ')}) VALUES (${k.map(() => '?').join(', ')})`).run(...k.map(x => v[x]));
  return 'neu';
}

/** Zähler für die Meldung nach dem Import: z('Artikel', 'neu') … z.text() → „Artikel: 3 neu, 42 aktualisiert · Kategorien: …“ */
function zaehler() {
  const m = new Map(), extra = [];
  const z = (label, art) => { const e = m.get(label) || { neu: 0, aktualisiert: 0 }; e[art]++; m.set(label, e); };
  z.hinweis = t => { if (t) extra.push(t); };
  z.text = (leer = 'Einstellungen übernommen') => {
    const teile = [...m].map(([l, e]) => `${l}: ${[e.neu ? `${e.neu} neu` : '', e.aktualisiert ? `${e.aktualisiert} aktualisiert` : ''].filter(Boolean).join(', ')}`);
    return (teile.length ? teile.join(' · ') : leer) + (extra.length ? ' – ' + extra.join(', ') : '');
  };
  return z;
}

/** Liste aus einer Importdatei: nur Objekte, höchstens max Stück */
const liste = (x, max) => (Array.isArray(x) ? x : []).filter(e => e && typeof e === 'object').slice(0, max);

module.exports = { schreibe, zaehler, liste };
