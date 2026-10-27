'use strict';
/* Kopfzeile: Getränke · [Erweiterungen] · [eigene Links] · Verwaltung – gleich auf allen Tablet-Seiten.
   <script src="…/nav.js" data-base="../../" data-active="zeiterfassung"> */
(() => {
  const me = document.currentScript;
  const base = (me && me.dataset.base) || '';
  const active = (me && me.dataset.active) || 'getraenke';
  const activeLabel = (me && me.dataset.label) || document.title;   // Beschriftung, falls die aktuelle Seite nicht in der Leiste steht
  let homeId = 'getraenke';   // erste Seite in der Kopfzeile = Startseite (dorthin geht es nach 30 s zurück)
  /* Letzter Stand von Vereinsname, Logo und Reitern: beim Seitenwechsel sofort zeichnen statt leer anfangen (sonst flackert die Kopfzeile) */
  const keep = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  /* Kopfzeile aufbauen: Logo · Vereinsname | Getränke · [Erweiterungen] · [Links] · Verwaltung · Uhr – überall identisch */
  const hdr = document.getElementById('gkHeader');
  if (hdr && !hdr.dataset.built) {
    hdr.dataset.built = '1';
    hdr.classList.add('top', 'glass');
    hdr.innerHTML = `<div class="brand"><span class="logo-badge" id="logoBox"><img id="logo" alt="Vereinslogo"></span><span class="mark" id="clubMark"></span>
        <div class="bt"><h1 id="club">&nbsp;</h1><span id="club2"></span></div></div>
      <nav class="topnav" id="topnav" aria-label="Bereiche"></nav>
      <div class="hright"><span class="clock" id="clock"></span><a class="admin" id="adminLink" href="${base}verwaltung.html">Verwaltung</a></div>`;
    // Uhr wie auf einer Anzeigetafel: Wochentag klein, Uhrzeit in der Zahlen-Schrift
    const tick = () => { const c = document.getElementById('clock'); if (!c) return; const d = new Date(); const t = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      if (c.dataset.t !== t) { c.dataset.t = t; c.innerHTML = `<small>${esc(d.toLocaleDateString('de-DE', { weekday: 'short' }))}</small><b class="num">${esc(t)}</b>`; } };
    tick(); setInterval(tick, 2000);
    const logo = document.getElementById('logo'), box = document.getElementById('logoBox');
    box.classList.add('hidden');
    const apply = (b, fresh) => {
      if (window.CWTheme && b.tabletTheme) window.CWTheme.tablet(b.tabletTheme);   // Darstellung am Tablet, vom Verein festgelegt (Einstellungen › Tablet)
      // Demo (erfundene Daten): deutlich gekennzeichnet, rechts neben der Uhr
      const rt = hdr.querySelector('.hright'), dc = document.getElementById('demoChip');
      if (b.demo && !dc && rt) rt.insertAdjacentHTML('afterbegin', `<span class="tk-chip a" id="demoChip" title="Demo – alle Daten sind erfunden">Demo</span>`);
      if (!b.demo && dc) dc.remove();
      if (b.clubName) {
        // „TC Grün-Weiß Musterstadt“ → zwei Zeilen: „TC Grün-Weiß“ / „Musterstadt“
        const w = b.clubName.trim().split(/\s+/);
        document.getElementById('club').textContent = w.length > 2 ? w.slice(0, -1).join(' ') : b.clubName;
        document.getElementById('club2').textContent = w.length > 2 ? w[w.length - 1] : '';
        const ini = w.filter(x => /^[A-Za-zÄÖÜäöü]/.test(x)).map(x => x[0]).join('').slice(0, 2).toUpperCase();
        document.getElementById('clubMark').textContent = ini || 'V';
      }
      if (b.color) {
        const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', b.color);
        // Vereinsfarbe geändert (Verwaltung → Einstellungen): Farben ohne Neuladen übernehmen
        if (fresh && nav.color && nav.color !== b.color) { const l = document.querySelector('link[rel="stylesheet"][href*="theme.css"]'); if (l) { const n = l.cloneNode(); n.href = l.getAttribute('href').split('?')[0] + '?c=' + b.color.slice(1); n.onload = () => l.remove(); l.after(n); } }
        if (fresh) nav.color = b.color;
      }
      // Sperrbildschirm (Tablet-Passwort): auf allen Tablet-Seiten gleich – Logo und Vereinsname über der Überschrift
      const card = document.querySelector('#gate .gatecard');
      if (card && !card.querySelector('.gateclub')) {
        card.insertAdjacentHTML('afterbegin', '<span class="logo-badge hidden" data-gl><img alt="Vereinslogo"></span><div class="gateclub"></div>');
      }
      if (card && card.querySelector('[data-gl]')) {
        card.querySelector('.gateclub').textContent = (b.clubName || '') + (b.demo ? ' · Demo' : '');
        const gb = card.querySelector('[data-gl]'), gi = gb.querySelector('img');
        if (b.logo) { gi.onload = () => gb.classList.remove('hidden'); gi.onerror = () => gb.classList.add('hidden'); if (gi.getAttribute('src') !== base + b.logo) gi.src = base + b.logo; } else gb.classList.add('hidden');
      }
      if (b.logo) {
        const src = base + b.logo;
        if (!fresh) { box.classList.remove('hidden'); hdr.classList.add('haslogo'); }   // Logo liegt im Browser-Zwischenspeicher – Platz gleich freihalten
        if (logo.getAttribute('src') !== src) { logo.onerror = () => { box.classList.add('hidden'); hdr.classList.remove('haslogo'); }; logo.onload = () => { box.classList.remove('hidden'); hdr.classList.add('haslogo'); }; logo.src = src; }
      } else { box.classList.add('hidden'); hdr.classList.remove('haslogo'); }
    };
    const nav = {};
    const brand = () => fetch(base + 'api/branding').then(r => r.json()).then(b => { keep.set('cw_brand', { clubName: b.clubName, color: b.color, logo: b.logo, tabletTheme: b.tabletTheme, demo: b.demo }); apply(b, true); }).catch(() => {});
    const last = keep.get('cw_brand'); if (last) apply(last, false);
    brand();
    setInterval(brand, 5 * 60 * 1000);
  }
  /* Reiter zeichnen: die ersten n; der Rest steht hinter „Mehr“ (ganz rechts, ein Fenster unter dem Knopf). Der aktive Reiter bleibt immer sichtbar. */
  const cur = {};
  const closeMore = () => { const m = document.getElementById('topMore'); if (m) m.remove(); const b = document.querySelector('#topnav .more'); if (b) b.setAttribute('aria-expanded', 'false'); };
  function draw(n) {
    const nav = document.getElementById('topnav'); if (!nav || !cur.links) return;
    closeMore();
    let vis = cur.links, rest = [];
    if (n < vis.length) {
      vis = cur.links.slice(0, n); rest = cur.links.slice(n);
      const ai = rest.findIndex(l => l.id === active);
      if (ai >= 0 && vis.length) { const out = vis.pop(); vis.push(rest.splice(ai, 1)[0]); rest.unshift(out); }
    }
    nav.innerHTML = vis.map(cur.linkHtml).join('') + (rest.length ? cur.moreHtml : '');
    const more = nav.querySelector('.more');
    if (!more) return;
    more.onclick = e => {
      e.preventDefault();
      if (document.getElementById('topMore')) { closeMore(); return; }
      const pop = document.createElement('div'); pop.id = 'topMore'; pop.className = 'topmore'; pop.setAttribute('role', 'menu');
      pop.innerHTML = rest.map(cur.linkHtml).join('');
      document.body.appendChild(pop);
      const r = more.getBoundingClientRect();
      pop.style.top = Math.round(r.bottom + 6) + 'px'; pop.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
      more.setAttribute('aria-expanded', 'true');
    };
  }
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#topMore, #topnav .more')) closeMore(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMore(); });
  function render(items, start) {
    const nav = document.getElementById('topnav');
    if (!nav) return;
    const links = [];
    // Reihenfolge vom Server: eingebaute Module (Getränke), Erweiterungen, eigene Links; die erste ist die Startseite
    items.forEach(i => links.push(i.external ? i : { ...i, href: base + (i.href || './') }));
    // Seite, die nicht in der Leiste steht (Einstellungen → Leiste am Tablet): eigenen Reiter als aktiv anhängen, damit man sieht, wo man ist
    if (items.length && active !== 'verwaltung' && active !== 'start' && !links.some(l => l.id === active)) links.push({ id: active, label: activeLabel, href: '' });
    homeId = start || (items.length ? items[0].id : null);   // Start-Reiter (Einstellungen → Leiste am Tablet)
    const ICO = { buchung: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h3v3h-3z"/>', getraenke: '<path d="M5 8h14l-1.2 11.2A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
      mehr: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>', beregnung: '<path d="M12 2.5S5.5 9.6 5.5 14a6.5 6.5 0 0 0 13 0C18.5 9.6 12 2.5 12 2.5z"/>', zugang: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M15 8l2 2"/>',
      turniere: '<path d="M3 5h6v5h5M3 19h6v-5h5"/><path d="M14 10v4"/><circle cx="18" cy="12" r="3"/>',
      maengel: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
      zeiterfassung: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', mitglieder: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 16.5a3.5 3.5 0 0 1 7 0M15 10h4M15 14h3"/>', arbeitseinsatz: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 1.3-1.3a4 4 0 0 0-5-5L5 13 3 11l8-8 2 2z"/><path d="m9 15-4 4"/>' };
    const ico = id => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[id] || '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'}</svg>`;
    // Schmale Fenster (≤ 640 px): lange Beschriftungen brechen an sinnvollen Stellen (weiche Trennstriche), nicht mitten im Wort
    const SHY = { Helferdienste: 'Helfer\u00ADdienste', Zeiterfassung: 'Zeit\u00ADerfassung', Beregnung: 'Bereg\u00ADnung', Buchungssystem: 'Buchungs\u00ADsystem', Mitgliederverwaltung: 'Mitglieder\u00ADverwaltung', Arbeitseinsatz: 'Arbeits\u00ADeinsatz' };
    const shy = t => String(t).split(' ').map(w => SHY[w] || w).join(' ');
    cur.links = links;
    cur.linkHtml = l => `<a href="${esc(l.href)}"${l.id === active ? ' class="on" aria-current="page"' : ''}${l.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${ico(l.id)}<span>${shy(esc(l.label))}</span>${l.external ? '<span class="ext" aria-hidden="true">↗</span>' : ''}</a>`;
    cur.moreHtml = `<a href="#" class="more" role="button" aria-haspopup="true" aria-expanded="false">${ico('mehr')}<span>Mehr</span></a>`;
    draw(links.length);
    nav.classList.toggle('hidden', links.length < 2);   // nur ein Bereich: keine Reiter nötig
    nav.classList.toggle('many', links.length >= 5);     // fünf und mehr Reiter: ohne Symbole, damit die Beschriftungen bei 1280 px nicht abgeschnitten werden
    const adm = document.getElementById('adminLink'); if (adm) adm.classList.toggle('on', active === 'verwaltung');
    fit();
    // Wischbare Leiste (Handy, viele Reiter): den aktiven Reiter ganz ins Bild holen, nicht halb am Rand stehen lassen
    const on = nav.querySelector('a.on');
    if (on && nav.scrollWidth > nav.clientWidth + 1) nav.scrollLeft = Math.max(0, on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2);
  }
  /* Passen die Reiter nicht neben Logo und „Verwaltung“ (z. B. Tablet hochkant), wird die Kopfzeile zweizeilig:
     oben Verein, Uhr und Verwaltung, darunter alle Reiter in voller Breite – nie überlappend, nie abgeschnitten. */
  function fit() {
    const head = document.getElementById('gkHeader'), nav = document.getElementById('topnav'); if (!head || !nav) return;
    head.classList.remove('stack');
    if (cur.links) draw(cur.links.length);
    if (nav.classList.contains('hidden') || window.innerWidth <= 640) return;
    const over = () => nav.scrollWidth > nav.clientWidth + 1;
    const n = nav.getBoundingClientRect(), r = head.querySelector('.hright'), b = head.querySelector('.brand');
    const hit = el => { if (!el) return false; const x = el.getBoundingClientRect(); return x.width > 0 && x.left < n.right - 1 && x.right > n.left + 1; };
    if (over() || hit(r) || hit(b)) head.classList.add('stack');
    // auch zweizeilig zu breit: die letzten Reiter wandern hinter „Mehr“
    if (cur.links && head.classList.contains('stack')) for (let k = cur.links.length - 1; k >= 1 && over(); k--) draw(k);
  }
  window.addEventListener('resize', () => { clearTimeout(fit.t); fit.t = setTimeout(fit, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  function load() {
    fetch(base + 'api/tablet/nav').then(r => (r.ok ? r.json() : { items: [] })).then(d => { keep.set('cw_nav', { items: d.items || [], start: d.start }); render(d.items || [], d.start); }).catch(() => {});
  }
  { const last = keep.get('cw_nav'); render((last && last.items) || [], last && last.start); }
  load();
  setInterval(load, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  window.GKNav = { reload: load };
  // Sperrbildschirm weg (Tablet-Passwort eingegeben): die Leiste war vorher nicht abrufbar – jetzt sofort nachladen
  { const g = document.getElementById('gate'); if (g) new MutationObserver(() => { if (g.classList.contains('hidden')) load(); }).observe(g, { attributes: true, attributeFilter: ['class'] }); }
  /* PIN-Eingabe – auf allen Tablet-Seiten derselbe Aufbau: Name, „Bitte deine PIN eingeben – Aktion“, 6 Kreise (Stellen 5 und 6
     freiwillig, daher blass), Ziffernblock, Fehlerzeile (ohne Meldung ohne Platz). title/sub kommen fertig maskiert. */
  const dots = n => Array.from({ length: Math.max(6, n) }, (_, i) => `<span class="${i < n ? 'f' : i >= 4 ? 'opt' : ''}"></span>`).join('');
  window.GKPin = {
    dots,
    pad: (title, sub, n = 0) => `<h2>${title}</h2><div class="sub">${sub}</div><div class="pin-dots" id="dots">${dots(n)}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button class="fn" data-k="x">Abbrechen</button><button data-k="0">0</button><button class="fn" data-k="ok">OK</button></div><div class="err" id="perr"></div>`,
  };

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
