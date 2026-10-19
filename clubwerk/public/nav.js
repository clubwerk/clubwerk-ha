'use strict';
/* Kopfzeile: Getränke · [Erweiterungen] · [eigene Links] · Verwaltung – gleich auf allen Tablet-Seiten.
   <script src="…/nav.js" data-base="../../" data-active="zeiterfassung"> */
(() => {
  const me = document.currentScript;
  const base = (me && me.dataset.base) || '';
  const active = (me && me.dataset.active) || 'getraenke';
  const activeLabel = (me && me.dataset.label) || document.title;   // Beschriftung, falls die aktuelle Seite nicht in der Leiste steht
  let homeId = 'getraenke';   // erste Seite in der Kopfzeile = Startseite (dorthin geht es nach 30 s zurück)
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  /* Kopfzeile aufbauen: Logo · Vereinsname | Getränke · [Erweiterungen] · [Links] · Verwaltung · Uhr – überall identisch */
  const hdr = document.getElementById('gkHeader');
  if (hdr && !hdr.dataset.built) {
    hdr.dataset.built = '1';
    hdr.classList.add('top');
    hdr.innerHTML = `<div class="brand"><span class="logo-badge" id="logoBox"><img id="logo" alt="Vereinslogo"></span><span class="mark" id="clubMark"></span>
        <div class="bt"><h1 id="club">&nbsp;</h1><span id="club2"></span></div></div>
      <nav class="topnav" id="topnav" aria-label="Bereiche"></nav>
      <div class="hright"><span class="clock" id="clock"></span><a class="admin" id="adminLink" href="${base}verwaltung.html">Verwaltung</a></div>`;
    const tick = () => { const c = document.getElementById('clock'); if (c) c.textContent = new Date().toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' }); };
    tick(); setInterval(tick, 2000);
    const logo = document.getElementById('logo'), box = document.getElementById('logoBox');
    box.classList.add('hidden');
    const brand = () => fetch(base + 'api/branding').then(r => r.json()).then(b => {
      if (b.clubName) {
        // „TC Grün-Weiß Frickhofen“ → zwei Zeilen: „TC Grün-Weiß“ / „Frickhofen“
        const w = b.clubName.trim().split(/\s+/);
        document.getElementById('club').textContent = w.length > 2 ? w.slice(0, -1).join(' ') : b.clubName;
        document.getElementById('club2').textContent = w.length > 2 ? w[w.length - 1] : '';
        const ini = w.filter(x => /^[A-Za-zÄÖÜäöü]/.test(x)).map(x => x[0]).join('').slice(0, 2).toUpperCase();
        document.getElementById('clubMark').textContent = ini || 'V';
      }
      if (b.color) { const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', b.color); }
      if (b.logo) {
        const src = base + b.logo;
        if (logo.getAttribute('src') !== src) { logo.onerror = () => { box.classList.add('hidden'); hdr.classList.remove('haslogo'); }; logo.onload = () => { box.classList.remove('hidden'); hdr.classList.add('haslogo'); }; logo.src = src; }
      } else { box.classList.add('hidden'); hdr.classList.remove('haslogo'); }
    }).catch(() => {});
    brand();
    setInterval(brand, 5 * 60 * 1000);
  }
  function render(items, start) {
    const nav = document.getElementById('topnav');
    if (!nav) return;
    const links = [];
    // Reihenfolge vom Server: eingebaute Module (Getränke), Erweiterungen, eigene Links; die erste ist die Startseite
    items.forEach(i => links.push(i.external ? i : { ...i, href: base + i.href || './' }));
    // Seite, die nicht in der Leiste steht (Einstellungen → Leiste am Tablet): eigenen Reiter als aktiv anhängen, damit man sieht, wo man ist
    if (items.length && active !== 'verwaltung' && active !== 'start' && !links.some(l => l.id === active)) links.push({ id: active, label: activeLabel, href: '' });
    homeId = start || (items.length ? items[0].id : null);   // Start-Reiter (Einstellungen → Leiste am Tablet)
    const ICO = { buchung: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h3v3h-3z"/>', getraenke: '<path d="M5 8h14l-1.2 11.2A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
      beregnung: '<path d="M12 2.5S5.5 9.6 5.5 14a6.5 6.5 0 0 0 13 0C18.5 9.6 12 2.5 12 2.5z"/>', zugang: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M15 8l2 2"/>',
      zeiterfassung: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', mitglieder: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 16.5a3.5 3.5 0 0 1 7 0M15 10h4M15 14h3"/>', arbeitseinsatz: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 1.3-1.3a4 4 0 0 0-5-5L5 13 3 11l8-8 2 2z"/><path d="m9 15-4 4"/>' };
    const ico = id => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[id] || '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'}</svg>`;
    // Schmale Fenster (≤ 640 px): lange Beschriftungen brechen an sinnvollen Stellen (weiche Trennstriche), nicht mitten im Wort
    const SHY = { Helferdienste: 'Helfer\u00ADdienste', Zeiterfassung: 'Zeit\u00ADerfassung', Beregnung: 'Bereg\u00ADnung', Buchungssystem: 'Buchungs\u00ADsystem', Mitgliederverwaltung: 'Mitglieder\u00ADverwaltung', Arbeitseinsatz: 'Arbeits\u00ADeinsatz' };
    const shy = t => String(t).split(' ').map(w => SHY[w] || w).join(' ');
    nav.innerHTML = links.map(l => `<a href="${esc(l.href)}"${l.id === active ? ' class="on" aria-current="page"' : ''}${l.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${ico(l.id)}<span>${shy(esc(l.label))}</span>${l.external ? '<span class="ext" aria-hidden="true">↗</span>' : ''}</a>`).join('');
    nav.classList.toggle('hidden', links.length < 2);   // nur ein Bereich: keine Reiter nötig
    nav.classList.toggle('many', links.length >= 5);     // fünf und mehr Reiter: ohne Symbole, damit die Beschriftungen bei 1280 px nicht abgeschnitten werden
    const adm = document.getElementById('adminLink'); if (adm) adm.classList.toggle('on', active === 'verwaltung');
  }
  function load() {
    fetch(base + 'api/tablet/nav').then(r => (r.ok ? r.json() : { items: [] })).then(d => render(d.items || [], d.start)).catch(() => render([]));
  }
  render([]);
  load();
  setInterval(load, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  window.GKNav = { reload: load };

  /* Nach 30 Sekunden ohne Eingabe zurück zum Start-Reiter – auf allen Tablet-Seiten außer dem Start-Reiter selbst
     (die Verwaltung bindet diese Datei nicht ein und bleibt deshalb offen). */
  const IDLE_MS = 30 * 1000;
  if (active !== 'verwaltung' && active !== 'start') {
    let last = Date.now();
    const poke = () => { last = Date.now(); };
    ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll', 'input'].forEach(ev => window.addEventListener(ev, poke, { capture: true, passive: true }));
    // Tippen in eine eingebettete Seite (Link unter der Kopfzeile) ist nur am Fokuswechsel erkennbar
    window.addEventListener('blur', poke);
    setInterval(() => { if (active !== homeId && Date.now() - last >= IDLE_MS) location.href = base || './'; }, 1000);
  }
})();
