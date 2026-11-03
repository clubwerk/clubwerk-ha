'use strict';
/* Startet die beiden ersten Abfragen („me“ und „forme“), noch bevor app.js geladen ist – spart bei langsamem Netz eine Laufzeit.
   Nur für ein schon gekoppeltes Gerät und nur beim normalen Start (nicht beim Koppeln, Übernehmen oder im Inlay). app.js holt sich die Antworten ab. */
(() => {
  try {
    const g = localStorage.getItem('va_geraet');
    if (!g || location.hash.length > 1 || /[?&]embed=/.test(location.search)) return;
    const h = { 'X-Geraet': g };
    window.__vaEarly = { t: Date.now(), me: fetch('api/me', { headers: h }), forme: fetch('api/forme', { headers: h }) };
    window.__vaEarly.me.catch(() => {}); window.__vaEarly.forme.catch(() => {});
  } catch (e) { /* ohne Vorabfrage startet app.js wie gewohnt */ }
})();
/* „App installieren“: Der Browser kann das Angebot (beforeinstallprompt) schon melden, bevor app.js am Seitenende geladen ist – hier auffangen, app.js übernimmt es */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__vaInstallEv = e; });
