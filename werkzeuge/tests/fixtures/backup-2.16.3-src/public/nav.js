'use strict';
/* Kopfzeile: Getränke · [Erweiterungen] · [eigene Links] · Verwaltung – gleich auf allen Tablet-Seiten.
   <script src="…/nav.js" data-base="../../" data-active="zeiterfassung"> */
(() => {
  const me = document.currentScript;
  const base = (me && me.dataset.base) || '';
  const active = (me && me.dataset.active) || 'getraenke';
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
        // „TC Grün-Weiß Musterstadt“ → zwei Zeilen: „TC Grün-Weiß“ / „Musterstadt“
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
  function render(items) {
    const nav = document.getElementById('topnav');
    if (!nav) return;
    const links = [];
    // Reihenfolge vom Server: eingebaute Module (Getränke), Erweiterungen, eigene Links; die erste ist die Startseite
    items.forEach(i => links.push(i.external ? i : { ...i, href: base + i.href || './' }));
    homeId = items.length ? items[0].id : null;
    const ICO = { getraenke: '<path d="M8 2h8M9 2v4.5a4 4 0 0 1-1 2.6L6.8 10.5A4 4 0 0 0 6 13v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7a4 4 0 0 0-.8-2.5L16 9.1a4 4 0 0 1-1-2.6V2"/>',
      beregnung: '<path d="M12 2.5S5.5 9.6 5.5 14a6.5 6.5 0 0 0 13 0C18.5 9.6 12 2.5 12 2.5z"/>', zugang: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M15 8l2 2"/>',
      zeiterfassung: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' };
    const ico = id => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[id] || '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'}</svg>`;
    nav.innerHTML = links.map(l => `<a href="${esc(l.href)}"${l.id === active ? ' class="on" aria-current="page"' : ''}${l.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${ico(l.id)}<span>${esc(l.label)}</span>${l.external ? '<span class="ext" aria-hidden="true">↗</span>' : ''}</a>`).join('');
    nav.classList.toggle('hidden', links.length < 2);   // nur ein Bereich: keine Reiter nötig
    const adm = document.getElementById('adminLink'); if (adm) adm.classList.toggle('on', active === 'verwaltung');
  }
  function load() {
    fetch(base + 'api/tablet/nav').then(r => (r.ok ? r.json() : { items: [] })).then(d => render(d.items || [])).catch(() => render([]));
  }
  render([]);
  load();
  setInterval(load, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  window.GKNav = { reload: load };

  /* Nach 30 Sekunden ohne Eingabe zurück zu „Getränke“ – auf allen Tablet-Seiten außer der Getränkeseite selbst
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
