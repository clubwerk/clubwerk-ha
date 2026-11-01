'use strict';
/* Lichtkacheln – gemeinsam für Mitglieder-App (member.js), Tablet (tablet.js) und Verwaltung (admin.js) */
window.FlutlichtTiles = (() => {
  const left = m => (m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60} Min.` : `${m} Min.`);
  /** Zeilen unter dem Namen */
  function sub(l, esc) {
    if (l.offline) return 'nicht erreichbar';
    if (l.on) return `An bis ${l.until.slice(11, 16)} Uhr · noch ${left(l.left)}${l.cause ? `<br>${esc(l.cause)}` : ''}`;
    return `Aus${l.next ? ` · ${esc(l.next)}` : ''}`;   // ein Grund für alle (Nachtruhe, noch hell …) steht einmal in der Statuszeile
  }
  /** HTML der Kacheln; ext = Minuten für „Verlängern“ */
  function html(lights, esc, ext) {
    if (!lights.length) return '<div class="vh-empty">Noch keine Lichtanlagen eingerichtet.</div>';
    return lights.map(l => {
      const acts = l.on
        ? `${l.can.extend ? `<button class="vh-btn" data-l="${esc(l.id)}" data-a="extend">+${ext} Min.</button>` : ''}${l.can.off ? `<button class="vh-btn sec" data-l="${esc(l.id)}" data-a="off">Ausschalten</button>` : ''}`
        : `<button class="vh-btn" data-l="${esc(l.id)}" data-a="on" ${l.can.on && !l.offline ? '' : 'disabled'}>Einschalten</button>`;
      return `<div class="vh-tile${l.on ? ' run' : ''}${l.offline ? ' off' : ''}"><div class="vh-tx"><span class="vh-name" translate="no">${esc(l.name)}</span>
        <span class="vh-sub">${sub(l, esc)}</span></div><div class="vh-acts">${acts}</div></div>`;
    }).join('');
  }
  /** Dauer-Auswahl beim Einschalten: 30, 60, 90 … bis zur Höchstdauer */
  const durations = max => { const d = [30, 60, 90, 120, 180, 240].filter(x => x <= max); return d.length ? d : [max]; };
  /** voraussichtliches Lichtgeld: angefangene Viertelstunden ab „Lichtgeld ab“ */
  function estimate(fee, minutes, now = new Date()) {
    if (!fee) return 0;
    const [h, m] = fee.from.split(':').map(Number);
    const from = new Date(now); from.setHours(h, m, 0, 0);
    const end = new Date(now.getTime() + minutes * 60000), start = now > from ? now : from;
    const sec = Math.round((end - start) / 1000);
    return sec > 0 ? Math.ceil(sec / 900) * fee.cents : 0;
  }
  const hhmmIn = min => { const d = new Date(Date.now() + min * 60000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const euro = c => (c / 100).toFixed(2).replace('.', ',') + ' €';
  return { html, durations, estimate, left, hhmmIn, euro };
})();
