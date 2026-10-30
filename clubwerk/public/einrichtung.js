/* Verein → Einrichtung: der Einrichtungs-Assistent (Plan: planung/einrichtung.md).
   Erster Start (noch kein Adminkonto): Willkommen mit Sprache, dann das Admin-Konto. Danach führt der Assistent Schritt für Schritt
   durch die vorhandenen Einstellungen: Er öffnet die Seite mit der passenden Karte (wie die Suche), blendet alles andere aus und setzt
   oben Fortschritt und Erklärung, unten „Später“ und „Weiter“. Eigene Ansichten nur für „Module wählen“ und „Fertig“.
   Welche Schritte es gibt und ob sie erledigt sind, sagt der Server (src/einrichtung.js, Modul-Hook setupSteps).
   Wird vor admin.js geladen und meldet sich über CW_PAGES an, sobald GK bereitsteht. */
(window.CW_PAGES = window.CW_PAGES || []).push(GK => {
  'use strict';
  const { $, esc, api, toast, fail, ask, icon } = GK;
  const T = (s, v) => (GK.T ? GK.T(s, v) : s);
  const KEY = 'cw_wiz';   // sessionStorage: Schritt, an dem der Assistent gerade steht (leer = Assistent aus)
  const cur = () => { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  const setCur = id => { try { if (id) sessionStorage.setItem(KEY, id); else sessionStorage.removeItem(KEY); } catch (e) { /* privat */ } };
  const sset = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* privat */ } };
  let data = null;          // letzte Antwort von GET einrichtung: { steps, percent, open, used, auto }
  const FERTIG = { id: 'fertig', title: 'Fertig', page: 'einrichtung', card: [] };
  const pageNow = () => (location.hash.slice(1).split('/')[0] || 'uebersicht');
  const visible = () => (data ? data.steps.filter(s => !s.hidden) : []);

  const style = document.createElement('style');
  style.textContent = `
  .wizhead{margin:0 0 4px}
  .wizhead h2.page{margin:0 0 4px}
  .wizhead h2.page::after{content:'';display:block;width:56px;height:6px;margin:6px 0 6px;border-top:2px solid var(--brand);border-bottom:1px solid var(--line2);box-sizing:border-box}
  .wizhead .tabrow{margin:12px 0 18px}
  .wizsteps button .wi{display:inline-flex;width:18px;height:18px;border-radius:9px;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--ink)}   /* Nummer auf dem Kreis auf der Reiterleiste: volle Schriftfarbe, gedämpft reichte der Kontrast nicht */
  .wizsteps button.done .wi{background:var(--brand-soft);color:var(--brand-ink)}
  .wizsteps button.skip .wi{background:var(--amber-soft);color:var(--amber)}
  .wizstep{margin:0 0 16px}
  .wizstep h3{margin:0 0 4px;font-size:20px;line-height:28px;font-weight:800;letter-spacing:-.01em}
  .wizstep p{margin:0;color:var(--muted);font-size:14px;line-height:21px;max-width:720px}
  .wizstep .wmod{display:block;font-size:12px;line-height:16px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--brand-ink);margin:0 0 2px}
  .wizfoot{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:20px 0 0;padding-top:16px;border-top:1px solid var(--line)}
  .wizfoot .sp{flex:1}
  @media (max-width:700px){.wizfoot{display:grid;grid-template-columns:1fr 1fr}.wizfoot .sp{display:none}.wizfoot .btn{width:100%;justify-content:center}
    .wizfoot [data-wz="end"]{order:3;grid-column:1/-1}.wizfoot.solo [data-wz="next"],.wizfoot [data-wz="done"]{grid-column:1/-1}}
  #main.wiz>:not(.wiz-path):not(.wiz-card):not(.wizhead):not(.wizfoot),#main.wiz .wiz-path>:not(.wiz-path):not(.wiz-card){display:none!important}
  #main.wizall>h2.page,#main.wizall>.leadbox,#main.wizall>p.lead,#main.wizall .tabrow>.tabs,#main.wizall .tabs:has(+ .tabbody),#main.wizall .tabs:has(+ .secbody){display:none!important}
  #main.wiz .wiz-card{margin-top:0}
  .wizbar{height:8px;border-radius:999px;background:color-mix(in srgb,var(--ink) 8%,transparent);overflow:hidden}
  .wizbar>i{display:block;height:100%;border-radius:999px;background:var(--brand)}
  .wmods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  @media (max-width:700px){.wmods{grid-template-columns:1fr}}
  .wmods .ucard{display:flex;gap:10px;min-height:76px}
  .wmods .ucard .wn{display:flex;align-items:center;gap:8px;font-weight:700}
  .wmods .ucard .wn svg{color:var(--brand);flex:none}
  .wmods .ucard .wh{display:block;margin-top:4px;font-size:12px;line-height:16px;color:var(--amber)}
  .wqr{display:flex;flex-wrap:wrap;gap:16px;align-items:center}
  .wqr .qr{width:148px;height:148px;flex:none;background:#fff;border-radius:12px;padding:8px;box-sizing:border-box}
  .wqr .qr svg{width:100%;height:100%;display:block}
  .wqr ol{margin:0;padding-left:20px;line-height:1.6;flex:1;min-width:220px}
  .setupcard .row{justify-content:space-between;align-items:center}
  .setupcard .wizbar,.wiz-card>.wizbar{margin:4px 0 12px}
  .setupcard .row{flex-wrap:nowrap;gap:16px}.setupcard h3{margin:0;white-space:nowrap}.setupcard .scbar{flex:1;min-width:0}.setupcard .scbar .wizbar{margin:0}
  @media (max-width:640px){.setupcard .row{flex-wrap:wrap}.setupcard .scbar{order:3;flex-basis:100%}}
  .wlist{display:flex;flex-direction:column}
  .wlist .wr{display:flex;align-items:center;gap:12px;min-height:52px;padding:8px 0;border-top:1px solid var(--line)}
  .wlist .wr:first-child{border-top:0}
  .wlist .wr .wt{flex:1;min-width:0;display:flex;flex-direction:column}
  .wlist .wr .wt b{font-size:14px;line-height:20px}
  .wlist .wr .wt small{font-size:12px;line-height:16px;color:var(--muted)}
  .wlist .wr .acts{display:flex;gap:8px;flex:none}
  @media (max-width:560px){.wlist .wr{flex-wrap:wrap}.wlist .wr .wt{flex:1 1 100%}.wlist .wr .acts{margin-left:auto}}
  .wlist .wr .ok{color:var(--brand);flex:none;display:inline-flex}
  .firststart .wpath{display:grid;gap:10px;margin:18px 0 0}
  .firststart .wpath .btn{width:100%;justify-content:center;height:48px;font-size:15px}
  .firststart .f{text-align:left}
  .firststart .hint{text-align:left;margin:4px 0 16px}
  .demobar{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;margin:20px 36px 0}
  .demobar>span{flex:1;min-width:200px}
  @media (max-width:900px){.demobar{margin:12px 16px 0}}
  `;
  document.head.appendChild(style);

  const bar = p => `<div class="wizbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${esc(T('Einrichtung'))}"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div>`;
  const load = async () => { data = await api('einrichtung'); return data; };

  /* =================== Erster Start (noch kein Adminkonto) =================== */
  GK.firstStart = (st, logo) => {
    const langs = st.languages || [{ code: 'de', name: 'Deutsch' }];
    let mine = null; try { mine = localStorage.getItem('cw_lang'); } catch (e) { mine = null; }
    const lang = langs.some(l => l.code === mine) ? mine : st.language || 'de';
    const welcome = () => {
      $('app').innerHTML = `<div class="login card firststart">${logo}<h2 class="page">Willkommen bei Clubwerk</h2>
        <p class="lead">In etwa 20 Minuten startklar. Jeder Schritt lässt sich überspringen und später nachholen.</p>
        ${langs.length > 1 ? `<label class="f">Sprache<select id="fsLang">${langs.map(l => `<option value="${esc(l.code)}" ${l.code === lang ? 'selected' : ''} translate="no">${esc(l.name)}</option>`).join('')}</select></label>` : ''}
        <div class="wpath"><button class="btn primary" id="fsStart" type="button">Einrichtung starten</button>
          ${st.demo ? '<button class="btn" id="fsDemo" type="button">Demo ausprobieren</button>' : ''}</div>
        ${st.demo ? '<p class="muted s" style="margin:12px 0 0">Die Demo zeigt Clubwerk mit erfundenen Beispieldaten. Danach lässt sie sich mit einem Klick restlos löschen.</p>' : ''}</div>`;
      if ($('fsLang')) $('fsLang').onchange = e => { try { localStorage.setItem('cw_lang', e.target.value); } catch (err) { /* privat */ } location.reload(); };
      $('fsStart').onclick = account;
      if ($('fsDemo')) $('fsDemo').onclick = () => GK.demoStart(st, welcome, logo);
    };
    const account = () => {
      $('app').innerHTML = `<div class="login card firststart">${logo}<h2 class="page">Admin-Konto</h2>
        <p class="lead">Dein Konto mit allen Rechten. Danach geht es in der Verwaltung weiter.</p>
        <form id="fsForm" autocomplete="on">
        <label class="f">Dein Name<input id="fsName" autocomplete="name" placeholder="z. B. Alex Muster" maxlength="60"></label><br>
        <label class="f">Benutzername<input id="fsUser" value="admin" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="30"></label><br>
        <label class="f">Passwort (mind. 8 Zeichen)<input type="password" id="fsPw1" autocomplete="new-password"></label><br>
        <label class="f">Passwort wiederholen<input type="password" id="fsPw2" autocomplete="new-password"></label><br>
        ${st.setupCode ? `<label class="f">Einrichtungscode <span class="muted">(steht in Home Assistant unter Einstellungen → Add-ons → Clubwerk → Protokoll)</span><input id="fsCode" placeholder="XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label><br>` : ''}
        <p class="muted s hint">Passwort vergessen? In Home Assistant unter Add-on › Konfiguration „notfall_passwort“ setzen und neu starten – das setzt das Passwort dieses Kontos zurück.</p>
        <div class="btns"><button class="btn ghost" id="fsBack" type="button">Zurück</button><button class="btn primary" id="fsGo">Konto anlegen</button></div>
        <p class="err" id="fsErr" role="alert"></p></form></div>`;
      $('fsBack').onclick = welcome;
      $('fsName').focus();
      $('fsForm').onsubmit = e => {
        e.preventDefault();
        GK.busy($('fsGo'), async () => {
          if ($('fsPw1').value !== $('fsPw2').value) { $('fsErr').textContent = T('Die Passwörter stimmen nicht überein.'); return; }
          try {
            await api('setup', 'POST', { name: $('fsName').value, username: $('fsUser').value, password: $('fsPw1').value, language: lang, wizard: true, code: $('fsCode') ? $('fsCode').value : undefined });
            GK.restart();
          } catch (err) { $('fsErr').textContent = err.message; }
        });
      };
    };
    welcome();
  };

  /* =================== Demo (erfundene Beispieldaten) =================== */
  /** auf den Neustart warten: ok(status) entscheidet, wann Clubwerk wieder da ist */
  const waitRestart = ok => new Promise(res => {
    const t0 = Date.now();
    const poll = async () => {
      try { const r = await fetch('api/admin/status', { cache: 'no-store' }); if (r.ok) { const st = await r.json(); if (ok(st)) return res(st); } } catch (e) { /* noch nicht da */ }
      if (Date.now() - t0 < 240000) setTimeout(poll, 2000); else res(null);
    };
    setTimeout(poll, 2500);
  });
  const waitCard = (logo, title, text) => `<div class="login card firststart">${logo}<h2 class="page">${esc(T(title))}</h2><p class="lead">${esc(T(text))}</p><div class="wizbar"><i style="width:100%"></i></div></div>`;
  /** „Demo ausprobieren“ auf der Willkommensseite (erster Start) */
  GK.demoStart = (st, back, logo = '') => {
    $('app').innerHTML = `<div class="login card firststart">${logo}<h2 class="page">Demo ausprobieren</h2>
      <p class="lead">Clubwerk mit einem erfundenen Verein: Mitglieder, Buchungen, Plätze, Dienste und mehr. Nichts davon ist echt.</p>
      <p class="muted s hint">Clubwerk startet dafür einmal neu (etwa eine Minute). Geräte über Home Assistant werden in der Demo nie geschaltet. Später löscht „Demo beenden und einrichten“ alle Beispieldaten restlos.</p>
      <form id="dmForm">${st.setupCode ? '<label class="f">Einrichtungscode <span class="muted">(steht in Home Assistant unter Einstellungen → Add-ons → Clubwerk → Protokoll)</span><input id="dmCode" placeholder="XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label><br>' : ''}
      <div class="btns"><button class="btn ghost" id="dmBack" type="button">Zurück</button><button class="btn primary" id="dmGo">Demo starten</button></div>
      <p class="err" id="dmErr" role="alert"></p></form></div>`;
    $('dmBack').onclick = back;
    $('dmForm').onsubmit = e => {
      e.preventDefault();
      GK.busy($('dmGo'), async () => {
        let r; try { r = await api('demo/start', 'POST', { code: $('dmCode') ? $('dmCode').value : undefined }); } catch (err) { $('dmErr').textContent = err.message; return; }
        $('app').innerHTML = `<div class="login card firststart">${logo}<h2 class="page">Demo wird eingerichtet</h2>
          <p class="lead">Clubwerk startet neu – die Seite meldet dich danach selbst an.</p>
          <div class="banner a" style="text-align:left;display:block"><b>Zugang zur Demo</b> (bitte notieren):<br>Benutzer <code translate="no">${esc(r.username)}</code> · Passwort <code translate="no">${esc(r.password)}</code><br>Tablet-Passwort <code translate="no">${esc(r.tablet)}</code></div>
          <div class="wizbar" style="margin-top:16px"><i style="width:100%"></i></div></div>`;
        const ok = await waitRestart(x => x.configured);
        if (!ok) { $('app').insertAdjacentHTML('beforeend', `<p class="err" style="text-align:center">${esc(T('Clubwerk antwortet nicht. Bitte das Add-on in Home Assistant neu starten (dort sollte „Watchdog“ eingeschaltet sein).'))}</p>`); return; }
        await api('login', 'POST', { username: r.username, password: r.password }).catch(() => {});
        GK.restart();
      });
    };
  };
  /* Hinweisleiste in der Demo: Zugangsdaten (nur mit „Einstellungen“) und „Demo beenden und einrichten“ */
  GK.afterShell(async () => {
    const st = await fetch('api/admin/status', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
    if (!st.demoMode || $('demoBar')) return;
    const i = st.demoInfo || {};
    if (st.demoCopy) {   // Demo-Kopie aus Einstellungen › Module (src/demokopie.js): endet beim Schließen des Tabs, ohne Nutzung nach 30 Minuten
      document.querySelector('.content').insertAdjacentHTML('afterbegin', `<div class="banner a demobar" id="demoBar"><span><b>${esc(T('Demo'))}${st.demoCopy.module ? ` · ${esc(T(st.demoCopy.module))}` : ''}</b> – ${esc(T('erfundene Daten, nichts davon wird gespeichert. Die Demo endet beim Schließen dieses Tabs oder nach {0} Minuten ohne Nutzung.', [st.demoCopy.minutes]))}</span>
        <button class="btn small" type="button" id="demoEnd">${esc(T('Demo beenden'))}</button></div>`);
      $('demoEnd').onclick = async () => { await fetch('api/demo-kopie/ende', { method: 'POST', headers: { 'X-Clubwerk': '1' } }).catch(() => {}); window.close(); location.replace('../admin.html'); };
      addEventListener('pagehide', () => navigator.sendBeacon('api/demo-kopie/zu'));
      return;
    }
    document.querySelector('.content').insertAdjacentHTML('afterbegin', `<div class="banner a demobar" id="demoBar"><span><b>Demo</b> – alle Daten sind erfunden.${i.password ? ` <span>Anmeldung <code translate="no">${esc(i.admin || 'admin')}</code> / <code translate="no">${esc(i.password)}</code> · Tablet-Passwort <code translate="no">${esc(i.tablet)}</code></span>` : ''}</span>
      ${GK.can('einstellungen') && GK.me().role === 'oberadmin' ? '<button class="btn small" type="button" id="demoEnd">Demo beenden und einrichten …</button>' : ''}</div>`);
    if ($('demoEnd')) $('demoEnd').onclick = async () => {
      const pw = await GK.askText(T('Demo beenden und einrichten?\nAlle Beispieldaten werden restlos gelöscht – Mitglieder, Buchungen, Bilder, Belege, Sicherungen und die Zugänge der Demo. Danach startet Clubwerk wie neu installiert mit der Einrichtung. Bitte mit deinem Passwort bestätigen.'), '', { password: true, ok: T('Demo löschen') });
      if (!pw) return;
      try { await api('demo/ende', 'POST', { password: pw }); } catch (e) { fail(e); return; }
      $('app').innerHTML = waitCard('', 'Demo wird gelöscht', 'Clubwerk startet neu und begrüßt dich danach wie bei einer neuen Installation.');
      const ok = await waitRestart(x => x.configured === false);
      if (ok) location.replace(location.pathname); else $('app').insertAdjacentHTML('beforeend', `<p class="err" style="text-align:center">${esc(T('Clubwerk antwortet nicht. Bitte das Add-on in Home Assistant neu starten (dort sollte „Watchdog“ eingeschaltet sein).'))}</p>`);
    };
  });

  /* =================== Schritte öffnen =================== */
  /** Schritt anzeigen: Seite öffnen, Reiter bzw. Bereich vorwählen (wie die Suche) – den Rahmen setzt frame() */
  function openStep(id) {
    const s = id === 'fertig' ? FERTIG : visible().find(x => x.id === id) || data.steps.find(x => x.id === id);
    if (!s) return openStep('fertig');
    setCur(s.id); wdirty = false;
    if (s.tab) sset('tab_' + s.tab[0], s.tab[1]);
    if (s.sec) sset(s.sec[0], s.sec[1]);
    opening = true;   // bis die neue Seite steht, beendet frame() den Assistenten nicht (alte Seite ≠ Seite des Schritts)
    return Promise.resolve(GK.go(s.page)).finally(() => { opening = false; frame(); });
  }
  let opening = false;
  /** nächster offener Schritt nach id (Reihenfolge des Servers), sonst „Fertig“ */
  const nextOpen = id => { const v = visible(), i = v.findIndex(x => x.id === id); return (v.slice(i + 1).find(x => !x.done) || FERTIG).id; };
  const firstOpen = () => (visible().find(x => !x.done) || FERTIG).id;
  /** Assistent starten – beim ersten offenen Punkt (oder einem bestimmten) */
  async function begin(id) { await load(); return openStep(id || firstOpen()); }
  /** Assistent verlassen (Stand bleibt gespeichert) */
  function stop() {
    setCur('');
    const m = $('main'); if (m) m.classList.remove('wiz', 'wizall');
    if (data && data.auto) { data.auto = false; api('einrichtung', 'PUT', { auto: false }).catch(() => {}); }   // nach dem ersten Start nicht mehr von selbst öffnen
  }
  async function act(id, action) { const r = await api('einrichtung/' + encodeURIComponent(id), 'PUT', { action }); data = { ...data, ...r }; return r; }

  /* =================== Rahmen um einen Schritt =================== */
  const orig = t => (window.CWI18N ? CWI18N.orig(t) : t).replace(/\s+/g, ' ').trim();
  function head(s) {
    const v = visible(), at = v.findIndex(x => x.id === s.id);
    const chips = [...v, FERTIG].map(x => {
      const cls = x.id === s.id ? 'on' : x.done ? 'done' : x.skipped ? 'skip' : '';
      const mark = x.id === 'fertig' ? icon('haken', 12) : x.done ? icon('haken', 12) : x.skipped ? '!' : String(v.indexOf(x) + 1);
      return `<button type="button" role="tab" data-wstep="${esc(x.id)}" class="${cls}" aria-selected="${x.id === s.id}"><span class="wi" aria-hidden="true">${mark}</span>${esc(x.title)}</button>`;
    }).join('');
    return `<div class="wizhead"><h2 class="page">Einrichtung</h2>
      <p class="lead">${s.id === 'fertig' ? esc(T('Einrichtung zu {0} % fertig', [data.percent])) : esc(T('Schritt {0} von {1} · Einrichtung zu {2} % fertig', [at + 1, v.length, data.percent]))}</p>
      <div class="tabrow"><div class="tabs wizsteps" role="tablist" aria-label="${esc(T('Schritte der Einrichtung'))}">${chips}</div></div>
      ${s.id === 'fertig' ? '' : `<div class="wizstep">${s.moduleName ? `<span class="wmod">${esc(s.moduleName)}</span>` : ''}<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`}</div>`;
  }
  const foot = s => (s.id === 'fertig'
    ? '<div class="wizfoot"><span class="sp"></span><button class="btn primary" type="button" data-wz="done">Zur Übersicht</button></div>'
    : `<div class="wizfoot${s.done ? ' solo' : ''}"><button class="btn ghost" type="button" data-wz="end">Einrichtung beenden</button><span class="sp"></span>
      ${s.done ? '' : '<button class="btn" type="button" data-wz="skip">Später</button>'}<button class="btn primary" type="button" data-wz="next">Weiter</button></div>`);
  let missT = 0;
  /** Rahmen setzen bzw. nach jedem Neuzeichnen der Seite erneuern (MutationObserver) */
  function frame() {
    const id = cur(), m = $('main');
    if (!id || !m || !data || !GK.me()) return;
    const s = id === 'fertig' ? FERTIG : data.steps.find(x => x.id === id);
    if (!s || pageNow() !== s.page) { if (!opening) stop(); return; }   // anderswohin gewechselt (Menü, Suche) → Assistent aus
    document.querySelectorAll('#side button.nav').forEach(b => b.classList.toggle('on', b.dataset.p === 'einrichtung'));   // im Menü steht man in „Einrichtung“
    if ($('menuCur')) $('menuCur').textContent = T('Einrichtung');
    const whole = s.page !== 'einrichtung' && !s.card.length;   // ohne Kartenangabe: ganze Seite (Listen wie „Plätze & Geräte“), nur Kopf und Reiter der Seite verschwinden
    m.classList.toggle('wiz', !whole); m.classList.toggle('wizall', whole);
    const h = m.querySelector(':scope > .wizhead');
    if (!h || h.dataset.step !== s.id || h.dataset.v !== String(data.percent)) {
      if (h) h.remove();
      m.insertAdjacentHTML('afterbegin', head(s)); m.firstElementChild.dataset.step = s.id; m.firstElementChild.dataset.v = String(data.percent);
      const on = m.querySelector('.wizsteps .on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    const f = m.querySelector(':scope > .wizfoot');
    if (!f || f.dataset.step !== s.id || m.lastElementChild !== f) { if (f) f.remove(); m.insertAdjacentHTML('beforeend', foot(s)); m.lastElementChild.dataset.step = s.id; }
    // die Karten des Schritts zeigen, alles andere ausblenden
    let found = s.page === 'einrichtung' ? [...m.querySelectorAll('.wiz-card')] : [];
    if (whole) found = [m];
    else if (s.page !== 'einrichtung') {
      // Überschrift = Kartenname, danach höchstens Zusätze („Sicherungspasswort festgelegt“, „Wer darf buchen?“) – „Verein“ trifft nicht „Vereinsnetz“
      const hit = (t, k) => t.startsWith(k) && !/\p{L}/u.test(t.charAt(k.length));
      found = [...m.querySelectorAll('.card')].filter(c => { const t = c.querySelector(':scope > h3, :scope > h2'); return t && s.card.some(k => hit(orig(t.textContent), k)); });
      m.querySelectorAll('.wiz-card, .wiz-path').forEach(x => { if (!found.includes(x)) x.classList.remove('wiz-card', 'wiz-path'); });
      found.forEach(c => { c.classList.add('wiz-card'); c.classList.remove('hidden'); for (let p = c.parentElement; p && p !== m; p = p.parentElement) { p.classList.add('wiz-path'); p.classList.remove('hidden'); } });
    }
    // „Weiter“ ist nur dann der Hauptknopf, wenn der Schritt selbst keinen hat (sonst ist „Speichern“ in der Karte das Wichtigste)
    const nx = m.querySelector(':scope > .wizfoot [data-wz="next"], :scope > .wizfoot [data-wz="done"]');
    if (nx) nx.classList.toggle('primary', ![...m.querySelectorAll('.btn.primary')].some(x => x !== nx && x.offsetParent && !x.closest('.wizfoot')));
    clearTimeout(missT);
    if (!found.length && s.page !== 'einrichtung') missT = setTimeout(() => {   // Karte nicht da (Modul aus, Recht fehlt) – sagen statt leerer Seite
      if (cur() === s.id && $('main') && !$('main').querySelector('.wiz-card') && !$('main').querySelector('.wizmiss'))
        $('main').querySelector(':scope > .wizhead').insertAdjacentHTML('beforeend', `<p class="empty wizmiss">${esc(T('Dieser Punkt ist hier gerade nicht verfügbar – mit „Später“ oder „Weiter“ geht es zum nächsten.'))}</p>`);
    }, 2500);
  }
  let rafT = 0;
  new MutationObserver(() => { if (!cur()) return; cancelAnimationFrame(rafT); rafT = requestAnimationFrame(frame); }).observe(document.getElementById('app'), { childList: true, subtree: true });
  /* Eingaben in den Karten eines Schritts merken: „Weiter“ ohne „Speichern“ fragt nach (die Kern-Einstellungen beobachtet sonst niemand).
     Ein Knopf in der Karte (Speichern, Festlegen …) gilt als gespeichert. */
  let wdirty = false;
  const inCard = t => cur() && t.closest && t.closest('#main .wiz-card, #main.wizall') && !t.closest('[data-wm]');
  ['input', 'change'].forEach(ev => document.addEventListener(ev, e => { if (inCard(e.target) && e.target.matches('input, select, textarea') && !e.target.matches('[data-wm]')) wdirty = true; }, true));
  document.addEventListener('click', e => { if (inCard(e.target) && e.target.closest('button, .btn') && !e.target.closest('.wizfoot, .wizsteps')) wdirty = false; }, true);
  const leave = async () => {
    if (wdirty && !await ask(T('Änderungen nicht gespeichert\n\nDu hast hier etwas eingetragen, aber noch nicht gespeichert. Erst in der Karte „Speichern“ tippen – oder die Eingaben verwerfen?'), { ok: T('Verwerfen'), danger: true })) return false;
    wdirty = false;
    return GK.leaveOk();
  };
  // Knöpfe im Rahmen (Ereignis am Dokument: der Rahmen wird bei jedem Neuzeichnen neu gesetzt)
  document.addEventListener('click', e => {
    const chip = e.target.closest('#main .wizsteps [data-wstep]');
    if (chip) { e.preventDefault(); if (chip.dataset.wstep !== cur()) leave().then(ok => ok && openStep(chip.dataset.wstep)); return; }
    const b = e.target.closest('#main .wizfoot [data-wz]'); if (!b) return;
    e.preventDefault();
    const id = cur();
    GK.busy(b, async () => {
      if (!(await leave())) return;
      try {
        if (b.dataset.wz === 'end' || b.dataset.wz === 'done') { stop(); return GK.go(b.dataset.wz === 'done' ? 'uebersicht' : 'einrichtung'); }
        if (b.dataset.wz === 'next' && OWN[id] && OWN[id].before) { const goOn = await OWN[id].before(); if (goOn === false) return; }
        await act(id, b.dataset.wz === 'skip' ? 'skip' : 'weiter');
        const s = data.steps.find(x => x.id === id);
        if (b.dataset.wz === 'next' && s && s.check && !s.done) toast(T('„{0}“ ist noch nicht erledigt – der Punkt bleibt in der Checkliste.', [s.title]));
        const nx = nextOpen(id);
        if (OWN[id] && OWN[id].reload) { setCur(nx); location.hash = '#' + (nx === 'fertig' ? 'einrichtung' : (data.steps.find(x => x.id === nx) || {}).page || 'einrichtung'); location.reload(); return; }
        return openStep(nx);
      } catch (err) { fail(err); }
    });
  });

  /* =================== Eigene Ansichten: Module wählen, Fertig =================== */
  const OWN = {};
  let modPick = null;   // gewählte Module (id → an/aus)
  OWN.module = {
    async render(m) {
      const r = await api('extensions');
      const list = (r.all || []).filter(x => !x.error && x.installed !== false);
      const tabletOn = GK.tabletOn();
      modPick = Object.fromEntries(list.map(x => [x.id, x.active])); OWN.module.reload = false;
      m.innerHTML = `<div class="card wiz-card"><h3>Module</h3>
        <div class="wmods">${list.map(x => `<label class="chk ucard"><input type="checkbox" data-wm="${esc(x.id)}" ${x.active ? 'checked' : ''}>
          <span><span class="wn">${esc(x.name)}</span><span class="muted s">${esc(x.short || x.description)}</span>
          ${!tabletOn && x.tablet && !x.app ? `<span class="wh">${esc(T('Wird am Tablet bedient – ohne Tablet nur in der Verwaltung nutzbar.'))}</span>` : ''}</span></label>`).join('')}</div>
        <p class="muted s" style="margin:12px 0 0">Mit „Weiter“ werden die gewählten Module eingeschaltet. Ausgeschaltete Module behalten ihre Daten.</p></div>`;
      m.querySelectorAll('[data-wm]').forEach(c => { c.onchange = () => { modPick[c.dataset.wm] = c.checked; }; });
    },
    /** „Weiter“: geänderte Module schalten – danach lädt die Verwaltung neu (Menü und Seiten der Module) */
    async before() {
      const r = await api('extensions');
      const changed = (r.all || []).filter(x => modPick && x.id in modPick && Boolean(modPick[x.id]) !== Boolean(x.active));
      for (const x of changed) await api('extensions/' + x.id, 'PUT', { active: modPick[x.id] });
      OWN.module.reload = changed.length > 0;
      return true;
    },
  };
  async function tabletQr() {
    if (!GK.tabletOn()) return '';
    const ingress = /\/hassio_ingress\//.test(location.pathname);
    const url = ingress ? '' : location.origin + location.pathname.replace(/(tadmin\/)?admin(\.html)?$/, '');
    const svg = url ? await api('qr', 'POST', { url }).then(r => r.svg).catch(() => '') : '';
    return `<div class="card wiz-card"><h3>Tablet einrichten</h3><div class="wqr">${svg ? `<div class="qr" aria-hidden="true">${svg}</div>` : ''}
      <ol><li>${url ? `${esc(T('Am Tablet diese Adresse öffnen (oder den QR-Code scannen):'))} <code translate="no" style="overflow-wrap:anywhere">${esc(url)}</code>` : esc(T('Am Tablet die Adresse von Home Assistant mit Port 3100 öffnen, z. B. http://homeassistant.local:3100'))}</li>
        <li>${esc(T('Einmal das Passwort für das Tablet eingeben.'))}</li><li>${esc(T('Im Browser „Zum Startbildschirm hinzufügen“ – fertig.'))}</li></ol></div></div>`;
  }
  OWN.fertig = {
    async render(m) {
      const open = visible().filter(x => !x.done);
      m.innerHTML = `<div class="card wiz-card"><h3>${open.length ? 'Fast geschafft' : 'Geschafft'}</h3>${bar(data.percent)}
        <p class="muted" style="margin:0 0 8px">${open.length ? esc(T('Diese Punkte sind noch offen. Sie bleiben auf der Übersicht und unter Verein › Einrichtung, bis sie erledigt oder ausgeblendet sind.')) : esc(T('Alle Punkte sind erledigt. Alles bleibt unter Einstellungen änderbar.'))}</p>
        ${open.length ? `<div class="wlist">${open.map(rowHtml).join('')}</div>` : ''}</div>
        ${await tabletQr()}
        <div class="card wiz-card"><h3>Anleitung</h3><p class="muted" style="margin:0">Die ausführliche Anleitung steht in Home Assistant unter Einstellungen › Add-ons › Clubwerk › Dokumentation. In der Verwaltung findet die Suche (Strg/⌘ K) jede Einstellung.</p></div>`;
      bindRows(m);
    },
  };
  const rowHtml = s => `<div class="wr"><span class="wt"><b>${esc(s.title)}</b><small>${s.moduleName ? esc(s.moduleName) + ' · ' : ''}${esc(T(s.skipped ? 'übersprungen' : 'offen'))}</small></span>
    <span class="acts"><button class="btn small" type="button" data-wgo="${esc(s.id)}">Einrichten</button></span></div>`;
  const bindRows = root => root.querySelectorAll('[data-wgo]').forEach(b => { b.onclick = () => begin(b.dataset.wgo).catch(fail); });

  /* =================== Seite „Einrichtung“ (Verein) =================== */
  async function render() {
    await load();
    const m = $('main'), id = cur();
    if (id && OWN[id]) { m.innerHTML = '<p class="muted">Lade …</p>'; await OWN[id].render(m); frame(); return; }
    if (id) setCur('');
    const v = visible(), open = v.filter(x => !x.done), done = v.filter(x => x.done), hidden = data.steps.filter(x => x.hidden);
    m.innerHTML = `<h2 class="page">Einrichtung</h2><p class="lead">${esc(T('Einrichtung zu {0} % fertig. Jeder Punkt lässt sich einzeln erledigen, später nachholen oder ausblenden.', [data.percent]))}</p>
      <div class="toolbar"><button class="btn primary" type="button" id="wzGo">${open.length ? 'Einrichtung fortsetzen' : 'Assistent noch einmal durchgehen'}</button></div>
      <div class="card"><h3>${esc(T('Offen ({0})', [open.length]))}</h3>${bar(data.percent)}
        ${open.length ? `<div class="wlist">${open.map(s => `<div class="wr"><span class="wt"><b>${esc(s.title)}</b><small>${s.moduleName ? esc(s.moduleName) + ' · ' : ''}${s.skipped ? esc(T('übersprungen')) + ' · ' : ''}${esc(s.text)}</small></span>
          <span class="acts"><button class="btn ico" type="button" data-whide="${esc(s.id)}" title="${esc(T('Ausblenden – der Punkt verschwindet aus der Checkliste'))}" aria-label="${esc(T('Ausblenden'))}">${icon('ausblenden', 17)}</button><button class="btn small" type="button" data-wgo="${esc(s.id)}">Einrichten</button></span></div>`).join('')}</div>`
          : '<p class="empty">Alles erledigt – Clubwerk ist eingerichtet.</p>'}</div>
      <div class="card"><h3>${esc(T('Erledigt ({0})', [done.length]))}</h3>${done.length ? `<div class="wlist">${done.map(s => `<div class="wr"><span class="ok">${icon('haken', 18)}</span><span class="wt"><b>${esc(s.title)}</b><small>${s.moduleName ? esc(s.moduleName) : esc(T('erledigt'))}</small></span>
          <span class="acts"><button class="btn small" type="button" data-wgo="${esc(s.id)}">Ansehen</button></span></div>`).join('')}</div>` : '<p class="empty">Noch nichts erledigt.</p>'}</div>
      ${hidden.length ? `<div class="card"><h3>${esc(T('Ausgeblendet ({0})', [hidden.length]))}</h3><div class="wlist">${hidden.map(s => `<div class="wr"><span class="wt"><b>${esc(s.title)}</b><small>${s.moduleName ? esc(s.moduleName) + ' · ' : ''}${esc(T(s.done ? 'erledigt' : 'offen'))}</small></span>
          <span class="acts"><button class="btn small" type="button" data-wshow="${esc(s.id)}">Wieder zeigen</button></span></div>`).join('')}</div></div>` : ''}`;
    $('wzGo').onclick = () => begin(open.length ? undefined : (visible()[0] || FERTIG).id).catch(fail);
    bindRows(m);
    m.querySelectorAll('[data-whide]').forEach(b => { b.onclick = () => GK.busy(b, async () => { try { await act(b.dataset.whide, 'hide'); toast(T('Ausgeblendet – unten unter „Ausgeblendet“ wieder einblendbar.')); render(); } catch (e) { fail(e); } }); });
    m.querySelectorAll('[data-wshow]').forEach(b => { b.onclick = () => GK.busy(b, async () => { try { await act(b.dataset.wshow, 'show'); render(); } catch (e) { fail(e); } }); });
  }
  GK.registerPage({ key: 'einrichtung', title: 'Einrichtung', perm: 'einstellungen', group: 'verein', icon: 'einrichtung', before: 'einstellungen', render });
  GK.registerSearch([{ label: 'Einrichtung fortsetzen', page: 'einrichtung', words: 'Assistent Einrichtung Checkliste offen Start erste Schritte', perm: 'einstellungen', kind: 'aktion', boost: 1 }]);

  /* =================== Übersicht: Checkliste und Start nach der ersten Anmeldung =================== */
  /** Karte „Einrichtung zu x % fertig“ – nur, wenn der Assistent auf dieser Installation benutzt wurde und noch etwas offen ist */
  GK.setupCard = async () => {
    if (!GK.can('einstellungen')) return '';
    const d = await load().catch(() => null);
    if (!d || !d.used || !d.open) return '';
    return `<div class="card setupcard"><div class="row"><h3>${esc(T('Einrichtung zu {0} % fertig', [d.percent]))}</h3><div class="scbar">${bar(d.percent)}</div><a class="btn small" href="#einrichtung" data-go="einrichtung">Alle Punkte</a></div></div>`;   // eine Zeile – die offenen Punkte stehen auf der Seite „Einrichtung“
  };
  GK.bindSetupCard = root => bindRows(root);
  /** nach der Anmeldung: beim ersten Start gleich in den Assistenten */
  GK.afterShell(async () => {
    if (!GK.can('einstellungen')) return;
    if (cur()) { await load().catch(() => null); frame(); return; }   // Neuladen mitten im Assistenten: weiter am selben Schritt
    const d = await load().catch(() => null);
    if (d && d.auto) openStep(firstOpen());
  });
});
