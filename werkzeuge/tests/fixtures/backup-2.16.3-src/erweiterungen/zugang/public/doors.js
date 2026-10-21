'use strict';
/* Türkacheln – gemeinsam für Mitglieder-App (member.js) und Tablet (app.js) */
window.ZugangDoors = (() => {
  const LABEL = { auf: 'Aufschließen', zu: 'Abschließen', oeffnen: 'Öffnen' };
  const COVER = { auf: 'Öffnen', zu: 'Schließen' };
  const label = (d, a) => (d.type === 'cover' ? COVER : LABEL)[a];
  /** HTML der Kacheln; personal = Gründe (Zeitprofil) anzeigen */
  function html(doors, esc, personal) {
    if (!doors.length) return '<div class="vh-empty">Keine Türen freigegeben.</div>';
    return doors.map(d => {
      const denied = personal && d.allowed === false;
      const acts = [...(d.can || [])].sort((x, y) => (x === 'zu') - (y === 'zu'))
        .map(a => `<button class="vh-btn${a === 'zu' ? ' sec' : ''}" data-d="${esc(d.id)}" data-a="${a}" ${denied || d.offline ? 'disabled' : ''}>${label(d, a)}</button>`).join('');
      return `<div class="vh-tile${denied || d.offline ? ' off' : ''}${d.jammed ? ' warn' : ''}"><div class="vh-tx"><span class="vh-name">${esc(d.name)}</span>
        <span class="vh-sub">${esc(denied ? d.reason : d.offline ? 'nicht erreichbar' : d.state)}</span></div><div class="vh-acts">${acts}</div></div>`;
    }).join('');
  }
  return { html, label };
})();
