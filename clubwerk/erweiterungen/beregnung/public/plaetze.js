'use strict';
/* Platzkacheln der Beregnung – gemeinsam für eigene Webapp, Tablet und Mitglieder-App */
window.BeregnungTiles = (() => {
  const fmt = sec => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  /** Eine Darstellung für alle Wege (eigene Webapp, Tablet, Mitglieder-App): laufende/wartende Plätze mit eigenem „Stoppen“-Knopf */
  function html(plaetze, esc) {
    if (!plaetze.length) return '<div class="vh-empty">Noch keine Plätze eingerichtet.</div>';
    return plaetze.map(p => {
      let act;
      if (p.blockedUntil) act = `<span class="vh-pill ghost">ab ${esc(p.blockedUntil)} Uhr</span>`;
      else act = '<span class="vh-pill ghost">▶ Starten</span>';
      const cls = p.state === 'run' || p.state === 'auto' ? ' run' : p.state === 'wait' ? ' wait' : p.blockedUntil ? ' off' : '';
      if (p.state === 'run' || p.state === 'auto' || p.state === 'wait') {
        const phase = p.state === 'wait' ? 'wartet' : p.state === 'auto' ? 'Automatik läuft' : (p.phase ? `${p.phase} läuft` : 'läuft');
        const time = p.state === 'wait' ? `Start in ${fmt(p._startsIn || 0)}` : (p._remain != null ? fmt(p._remain) : 'läuft');
        return `<div class="vh-tile${cls}"><span class="vh-tx"><span class="vh-name">${esc(p.name)}</span><span class="vh-sub">${esc(p.sub)} · ${esc(phase)}</span></span><span class="vh-acts"><span class="vh-pill"><span class="vh-rd"></span>${esc(time)}</span><button type="button" class="vh-stop1" data-stop="${p.id}">■ Stoppen</button></span></div>`;
      }
      return `<button class="vh-tile${cls}" data-p="${p.id}"><span class="vh-tx"><span class="vh-name">${esc(p.name)}</span><span class="vh-sub">${esc(p.sub)}</span></span><span class="vh-acts">${act}</span></button>`;
    }).join('');
  }
  /** Countdown lokal weiterzählen (jede Sekunde), bis der nächste Status kommt */
  function prime(plaetze) { for (const p of plaetze) { p._remain = p.remain; p._startsIn = p.startsIn || 0; } }
  function tick(plaetze) { let ch = false; for (const p of plaetze) { if (p._remain != null && p._remain > 0) { p._remain--; ch = true; } if (p._startsIn > 0) { p._startsIn--; ch = true; } } return ch; }
  return { html, prime, tick, fmt };
})();
