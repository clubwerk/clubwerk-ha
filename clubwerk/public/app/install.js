'use strict';
/* Texte und Knöpfe der Karten „App installieren“ (Android, Rechner, eingebettete Android-Browser). Die Entscheidung, welche Karte kommt, steht in app.js (installPlan);
   diese Datei lädt app.js erst, wenn tatsächlich eine Karte kommt – nie in der installierten App. Hält die Startdatei klein (Testreihe apptempo). */
(function () {
  const ico = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ADDHOME = ico('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>'), OPEN = ico('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'),
    SHARE = ico('<path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M5 11H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>'),
    COPY = ico('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'),
    DESK = ico('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 7v5M9.5 10l2.5 2.5 2.5-2.5M8 20h8M12 16v4"/>'),
    DOTS = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
    MENU3 = ico('<path d="M4 7h16M4 12h16M4 17h16"/>').replace('stroke-width="2"', 'stroke-width="2.2"');
  const KINDS = ['install', 'android-have', 'desktop-have', 'android-howto', 'desktop-howto', 'desktop-safari', 'android-embedded'];
  let ctx;
  const laterSet = () => ctx.ls('cw-install-spaeter', String(Date.now() + 14 * 864e5));
  const rowC = (i, t, sub) => `<details class="vh-fm vh-fm-step"><summary><span class="vh-fm-ico">${i}</span><span class="vh-tx"><strong>${t}</strong></span><span class="vh-fm-wie">Wie?</span></summary><p>${sub}</p></details>`;   // weitere Schritte: eine Zeile, die Erklärung klappt im selben Blatt auf (Punkt 10)
  const row = (i, t, sub) => `<div class="vh-fm"><span class="vh-fm-ico">${i}</span><span class="vh-tx"><strong>${t}</strong>${sub ? `<small>${sub}</small>` : ''}</span></div>`;
  function html(kind, e) {
    const lt = '<button type="button" class="vh-btn sec" data-pushlater data-installlater>Später</button>', done = '<button type="button" class="vh-btn sec" data-installdone>Habe ich schon installiert</button>';
    const card = (h, rows, b) => `<div class="vh-card vh-fm-news" data-pushcard="${kind}"><h3>${h}</h3><div class="vh-rows">${rows}</div><div class="vh-pushact">${b.join('')}</div></div>`;
    const R3 = (a, b, c) => row(...a) + rowC(ADDHOME, ...b) + rowC(OPEN, ...c);
    if (kind === 'install') return card('App installieren', e.android ? row(ADDHOME, 'Die App aufs Handy legen', 'Ein Antippen genügt – danach startest du sie direkt vom Startbildschirm, ohne dich neu freizuschalten.')
      : row(ADDHOME, 'Die App auf diesem Rechner installieren', 'Ein Klick genügt – danach öffnet sie sich in einem eigenen Fenster, ohne dich neu freizuschalten.'), [lt, '<button type="button" class="vh-btn" data-installgo>App installieren</button>']);
    if (kind === 'android-have') return card('App schon installiert', row(OPEN, 'Du hast die App schon', 'Öffne sie vom Startbildschirm – dort bleibt deine Freischaltung.'), [lt]);
    if (kind === 'desktop-have') return card('App schon installiert', row(OPEN, 'Du hast die App schon', 'Öffne sie aus deinen Programmen – dort bleibt deine Freischaltung.'), [lt]);
    if (kind === 'android-embedded') return card('Im Browser öffnen', row(OPEN, 'Diese Seite läuft in einer anderen App', 'Tippe auf „⋮“ oder „…“ und dann auf „Im Browser öffnen“ (Chrome).') + row(COPY, 'Geht das nicht?', 'Kopiere die Adresse und öffne sie im Browser.'), [lt, '<button type="button" class="vh-btn" data-pushcopy>Adresse kopieren</button>']);
    if (kind === 'android-howto') {
      const how = {
        samsung: [MENU3, '1. Menü öffnen', 'Das Symbol mit den drei Strichen ≡ im Browser.', '2. Seite hinzufügen zu › Startbildschirm', 'Dann „Hinzufügen“ antippen.'],
        firefox: [DOTS, '1. Menü öffnen', 'Das Symbol mit den drei Punkten ⋮ im Browser.', '2. „Installieren“', 'Dann „Hinzufügen“ antippen.'],
        edge: [DOTS, '1. Menü öffnen', 'Das Symbol mit den Punkten im Browser.', '2. „Zum Telefon hinzufügen“ oder „App installieren“', 'Dann „Hinzufügen“ bzw. „Installieren“ antippen.'],
        chrome: [DOTS, '1. Menü öffnen', 'Das Symbol mit den drei Punkten ⋮ im Browser.', '2. „App installieren“ oder „Zum Startbildschirm hinzufügen“', 'Dann „Installieren“ bzw. „Hinzufügen“ antippen.'],
      }[e.browser] || [MENU3, '1. Menü öffnen', 'Das Menü deines Browsers – meist ⋮ oder ≡.', '2. „Zum Startbildschirm hinzufügen“ oder „Installieren“', 'Dann „Hinzufügen“ bzw. „Installieren“ antippen.'];   // Opera, Xiaomi, Huawei … : allgemein statt falsch spezial
      return card('Zuerst auf den Startbildschirm', R3([how[0], how[1], how[2]], [how[3], how[4]], ['3. Vom Startbildschirm öffnen', 'Deine Freischaltung bleibt erhalten.']), [lt, done]);
    }
    if (kind === 'desktop-howto') return card('App auf diesem Rechner installieren', R3([DESK, '1. Installieren-Symbol anklicken', 'Ein Bildschirm mit Pfeil am Rand der Adressleiste. Fehlt es: Menü › „Speichern und teilen“ › „Seite als App installieren“ (Chrome) bzw. Menü › „Apps“ › „Diese Website als App installieren“ (Edge).'],
      ['2. „Installieren“ bestätigen', 'Die App bekommt ein eigenes Fenster.'], ['3. Als App öffnen', 'Deine Freischaltung bleibt erhalten.']), [lt, done]);
    return card('App im Dock installieren', R3([SHARE, '1. Teilen-Symbol oder Menü „Ablage“', 'Das Teilen-Symbol in der Symbolleiste von Safari oder oben in der Menüleiste „Ablage“.'], ['2. „Zum Dock hinzufügen“', 'Dann „Hinzufügen“ klicken.'], ['3. Vom Dock öffnen', 'Gib dort einmal deine PIN ein.']), [lt, done]);
  }
  window.cwInstallUi = {
    html,
    owns: k => KINDS.includes(k),
    init(c) {
      ctx = c;
    },
    wire(el) {
      const go = el.querySelector('[data-installgo]'), dn = el.querySelector('[data-installdone]'), lt = el.querySelector('[data-installlater]'), cp = el.querySelector('[data-pushcopy]');
      if (cp) cp.onclick = ctx.copyAddress;
      if (dn) dn.onclick = () => { ctx.flag('cw-install-erledigt', true); el.remove(); ctx.reload(); };
      if (lt) lt.onclick = () => { laterSet(); el.remove(); ctx.reload(); };
      if (go) go.onclick = async () => {
        go.disabled = true; const ev = ctx.takeEv();   // der Dialog lässt sich nur einmal öffnen
        try { await ev.prompt(); const r = await ev.userChoice; if (r && r.outcome === 'accepted') { ctx.setDone(); ctx.toast('App installiert – du findest sie auf dem Startbildschirm.'); } else laterSet(); } catch (e) { laterSet(); }
        ctx.reload();
      };
    },
  };
})();
