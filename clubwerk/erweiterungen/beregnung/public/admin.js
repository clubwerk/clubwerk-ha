'use strict';
/* Verwaltungsseite der Erweiterung „Beregnung“ */
(() => {
  const GK = window.GK;
  const { $, esc, toast, fail } = GK;
  const api = (url, method, body) => GK.api('x/beregnung/' + url, method, body);
  const st = { data: null, cfg: null, month: null };
  const minTxt = sec => { const v = sec / 60; return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10).replace('.', ','); };
  const toSec = v => Math.round(parseFloat(String(v).replace(',', '.')) * 60);

  function zoneOptions(sel) {
    const list = st.data.list || [];
    const has = list.some(x => x.ref === sel);
    return `<option value="">– Gerät wählen –</option>${!has && sel ? `<option value="${esc(sel)}" selected>${esc(sel)} (nicht gefunden)</option>` : ''}`
      + list.map(x => `<option value="${esc(x.ref)}" ${x.ref === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  }

  function plaetzeHtml() {
    const c = st.cfg;
    if (!c.plaetze.length) return '<p class="empty">Noch keine Plätze angelegt.</p>';
    return c.plaetze.map((p, i) => `<div class="card soft" style="margin:0 0 12px">
      <div class="row" style="align-items:flex-end">
        <label class="f" style="flex:1 1 180px">Name<input data-pn="${i}" maxlength="30" value="${esc(p.name)}" placeholder="z. B. Platz 1"></label>
        <label class="f" style="flex:2 1 240px">Untertitel (leer = automatisch)<input data-ps="${i}" maxlength="60" value="${esc(p.sub || '')}" placeholder="z. B. Erst Vorne, dann Hinten · je 2 min"></label>
        <button class="btn small" data-pu="${i}" ${i === 0 ? 'disabled' : ''} title="nach oben" aria-label="nach oben">↑</button>
        <button class="btn small" data-pd="${i}" ${i === c.plaetze.length - 1 ? 'disabled' : ''} title="nach unten" aria-label="nach unten">↓</button>
        <button class="btn small danger" data-px="${i}">Platz löschen</button>
      </div>
      <table class="tbl" style="margin-top:10px"><tr><th style="width:52px">Reihe</th><th>Zone (Gerät)</th><th style="width:170px">Bezeichnung</th><th class="r" style="width:120px">Minuten</th><th style="width:110px"></th></tr>
      ${p.zones.map((z, j) => `<tr><td>${j + 1}.</td>
        <td>${st.cfg.backend === 'hydrawise' && !(st.data.list || []).length
          ? `<input data-zr="${i}.${j}" value="${esc(z.ref)}" inputmode="numeric" placeholder="Zonennummer" style="width:100%">`
          : `<select data-zr="${i}.${j}" style="width:100%">${zoneOptions(z.ref)}</select>`}</td>
        <td><input data-zl="${i}.${j}" maxlength="20" value="${esc(z.label || '')}" placeholder="z. B. Vorne" style="width:100%"></td>
        <td class="r"><input data-zs="${i}.${j}" inputmode="decimal" value="${minTxt(z.sec)}" style="width:80px;text-align:right"></td>
        <td class="r"><button class="btn small" data-zx="${i}.${j}">Entfernen</button></td></tr>`).join('')}
      </table>
      <div class="row" style="margin-top:8px"><button class="btn small" data-za="${i}">+ Zone</button>
        <span class="muted s">Mehrere Zonen laufen nacheinander in dieser Reihenfolge.</span></div>
    </div>`).join('');
  }

  function readForm() {
    const c = st.cfg;
    document.querySelectorAll('[data-pn]').forEach(e => { c.plaetze[+e.dataset.pn].name = e.value; });
    document.querySelectorAll('[data-ps]').forEach(e => { c.plaetze[+e.dataset.ps].sub = e.value; });
    const z = (attr, fn) => document.querySelectorAll(`[data-${attr}]`).forEach(e => { const [i, j] = e.dataset[attr].split('.').map(Number); fn(c.plaetze[i].zones[j], e.value); });
    z('zr', (o, v) => { o.ref = v; });
    z('zl', (o, v) => { o.label = v; });
    z('zs', (o, v) => { o.sec = toSec(v); });
    const v = id => $(id) ? $(id).value : undefined;
    if ($('bMode')) { c.mode = v('bMode'); c.cooldownMin = v('bCool'); c.appName = v('bApp'); c.subtitle = v('bSub'); c.stopFree = $('bStopFree').checked; c.header = $('bHeader').checked; }
    if ($('bNext')) c.nextEntity = v('bNext');
    if ($('bNotify')) c.notify = v('bNotify');
  }

  function bindPlaetze() {
    const c = st.cfg;
    const re = () => { $('bPl').innerHTML = plaetzeHtml(); bindPlaetze(); };
    const on = (attr, fn) => document.querySelectorAll(`[data-${attr}]`).forEach(b => b.onclick = () => { readForm(); fn(b.dataset[attr]); re(); });
    on('pu', i => { i = +i; [c.plaetze[i - 1], c.plaetze[i]] = [c.plaetze[i], c.plaetze[i - 1]]; });
    on('pd', i => { i = +i; [c.plaetze[i + 1], c.plaetze[i]] = [c.plaetze[i], c.plaetze[i + 1]]; });
    on('px', i => { c.plaetze.splice(+i, 1); });
    on('za', i => { c.plaetze[+i].zones.push({ ref: '', label: '', sec: 120 }); });
    on('zx', k => { const [i, j] = k.split('.').map(Number); c.plaetze[i].zones.splice(j, 1); });
  }

  async function loadCfg() { const d = await api('config'); st.data = d; st.cfg = JSON.parse(JSON.stringify(d.cfg)); return d; }
  async function save(fields) {
    readForm();
    try { const r = await api('config', 'PUT', Object.fromEntries(fields.map(k => [k, st.cfg[k]]))); st.data.cfg = r.cfg; GK.clean(); toast('Gespeichert.'); return true; } catch (e) { fail(e); return false; }
  }
  const MODES = [['pin', 'Offen mit Vereins-PIN (eigene Webapp)'], ['app', 'Nur freigeschaltete Mitglieder (Mitglieder-App)'], ['login', 'Gesperrt – nur Benutzer mit Passwort']];

  GK.RENDER.beregnung = async () => {
    await loadCfg();
    $('main').innerHTML = `<h2 class="page">Beregnung</h2>
      <p class="lead">Mitglieder starten hier nur die <b>manuelle</b> Beregnung eines Platzes. Zeitpläne, Wetteranpassung und Pausen bleiben in der Steuerung des Herstellers.
        Es läuft nie mehr als eine Zone gleichzeitig (Wasserdruck) – weitere Plätze stellen sich hinten an.</p><div id="bTabs"></div>`;
    GK.tabs($('bTabs'), 'beregnung', [['bedienen', 'Bedienen'], ['plaetze', 'Plätze & Anbindung'], ['webapp', 'Webapp & PIN'], ['protokoll', 'Protokoll']], async (k, el) => {
      const d = await loadCfg(); const c = st.cfg;
      const ha = c.backend !== 'hydrawise';
      if (k === 'bedienen') {
        // dieselben Kacheln wie in der Mitglieder-App, am Tablet und in der Beregnungs-Webapp (plaetze.js + kit.css)
        if (!window.BeregnungTiles) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'x/beregnung/plaetze.js?v=' + encodeURIComponent(GK.version || ''); sc.onload = ok; sc.onerror = () => no(new Error('Kacheln konnten nicht geladen werden.')); document.head.appendChild(sc); });
        const T = window.BeregnungTiles;
        let s = await api('status'), timer = null, tick = null;
        el.innerHTML = `<div id="bOff"></div><div class="card"><h3>Plätze</h3><div class="vh-tiles zones" id="bTiles"></div>
            <p class="muted s" id="bNext" style="margin:12px 0 0"></p>
            <div class="row" style="margin-top:12px"><button class="btn danger" id="bStop">■ Alle Zonen ausschalten</button></div></div>
          <div class="card"><h3>Wer darf bedienen?</h3><p style="margin:0"><span>${esc(MODES.find(m => m[0] === c.mode)[1])}</span>${c.mode === 'pin' ? ` · Webapp: <b>${GK.scheme ? GK.scheme() : 'http'}://&lt;Adresse von Home Assistant&gt;:${d.port || 5000}</b>` : ''}.
            Zusätzlich sehen Mitglieder mit Freischaltung die Beregnung in der <a href="#app" data-goapp>Mitglieder-App</a>.</p></div>`;
        const alive = () => document.body.contains(el) && $('bTiles');
        const draw = () => {
          if (!alive()) { clearInterval(tick); clearTimeout(timer); return; }   // Seite schon verlassen (Antwort kam nach dem Wechsel) – nichts mehr zeichnen
          $('bOff').innerHTML = s.online ? '' : `<div class="banner r">Keine Verbindung zur Bewässerungsanlage${s.error ? ': ' + esc(s.error) : ''}</div>`;
          $('bTiles').innerHTML = s.plaetze.length ? T.html(s.plaetze, esc) : '<div class="vh-empty">Noch keine Plätze – unter „Plätze &amp; Anbindung“ anlegen.</div>';
          $('bNext').textContent = s.next ? `Nächste automatische Beregnung: ${s.next}` : '';
          $('bStop').classList.toggle('hidden', !s.plaetze.length);
          $('bTiles').classList.toggle('offline', !s.online); $('bStop').disabled = !s.online;
          $('bTiles').querySelectorAll('[data-p]').forEach(x => { x.onclick = async () => {
            const p = s.plaetze.find(y => y.id === +x.dataset.p); if (!p || p.state !== 'idle') return;
            try { await api('run', 'POST', { platz: p.id }); toast(`${p.name}: Beregnung gestartet.`); refresh(); } catch (e) { fail(e); } }; });
          $('bTiles').querySelectorAll('[data-stop]').forEach(x => { x.onclick = async e => { e.stopPropagation();
            try { const r = await api('stop', 'POST', { platz: +x.dataset.stop }); toast(r.ok ? 'Gestoppt.' : 'Nicht alles ließ sich stoppen.', !r.ok); refresh(); } catch (e2) { fail(e2); } }; });
        };
        async function refresh() {
          clearTimeout(timer); if (!alive()) return clearInterval(tick);
          try { s = await api('status'); T.prime(s.plaetze); draw(); } catch (e) { /* nächster Versuch */ }
          if (!alive()) return;
          timer = setTimeout(refresh, s.plaetze.some(p => p.state !== 'idle') ? 5000 : 20000);
        }
        T.prime(s.plaetze); draw(); timer = setTimeout(refresh, 5000);
        tick = setInterval(() => { if (!alive()) { clearInterval(tick); clearTimeout(timer); return; } if (T.tick(s.plaetze)) draw(); }, 1000);
        $('bStop').onclick = async () => { if (!await GK.ask('Alle Zonen jetzt ausschalten?\n\nLaufende und geplante Beregnungen werden sofort beendet.', { ok: 'Alles stoppen', danger: true })) return; try { const r = await api('stop', 'POST', {}); toast(r.ok ? 'Alle Zonen gestoppt.' : 'Nicht alles ließ sich stoppen: ' + r.errors.join('; '), !r.ok); refresh(); } catch (e) { fail(e); } };
        el.querySelector('[data-goapp]').onclick = e => { e.preventDefault(); GK.go('app'); };
        return;
      }
      if (k === 'plaetze') {
        const vend = d.vendors.find(v => v.id === c.vendor) || d.vendors[0];
        el.innerHTML = `${d.error ? `<div class="banner r">Keine Verbindung zur Steuerung: ${esc(d.error)}</div>` : `<div class="banner g">Verbunden – ${d.list.length} schaltbare Zonen gefunden.</div>`}
          <div class="card"><h3>Anbindung</h3>
            <div class="row"><label class="f" style="flex:1;min-width:260px">Hersteller der Steuerung<select id="bVendor" data-nodirty>${d.vendors.map(v => `<option value="${v.id}" ${v.id === c.vendor ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label></div>
            ${ha ? `<p class="muted s" style="margin:8px 0 0">Einrichtung: in Home Assistant unter Einstellungen → Geräte &amp; Dienste die <b>${esc(vend.setup)}</b> hinzufügen. Jede Zone erscheint dann als Ventil oder Schalter${d.filtered ? ' – angeboten werden nur Geräte dieses Herstellers' : ''}.
              Tipp: Die Standard-Laufzeit der Zone in der Hersteller-App mindestens so lang einstellen wie hier.</p>${d.haAvailable ? '' : '<div class="banner a" style="margin-top:8px">Das Add-on hat keinen Zugriff auf Home Assistant. Bitte das Add-on neu bauen und starten.</div>'}`
            : `<div class="row" style="margin-top:10px"><label class="f" style="flex:1;min-width:260px">Hydrawise-API-Key<input id="bKey" type="password" data-nodirty autocomplete="off" placeholder="${d.hasKey ? 'gespeichert – zum Ändern neu eintragen' : 'aus hydrawise.com → Konto → Einstellungen'}"></label>
                <button class="btn primary" id="bKeySave">Key speichern</button>${d.hasKey ? '<button class="btn" id="bKeyDel">Key löschen</button>' : ''}</div>
              <p class="muted s" style="margin:8px 0 0">Der Key bleibt auf dem Server und ist im Browser nie sichtbar. Zonennummer = Anschluss am Controller (1, 2, 3 …).</p>`}</div>
          <div class="card"><h3>Plätze &amp; Zonen</h3><div id="bPl">${plaetzeHtml()}</div>
            <div class="row" style="justify-content:space-between"><button class="btn" id="bAddPl">+ Platz</button><button class="btn primary" id="bSaveP">Plätze speichern</button></div></div>
          <div id="bFunc"></div>`;
        GK.watch(el); bindPlaetze();
        if (GK.funcBox) GK.funcBox($('bFunc'), 'beregnung', 'Beregnung');
        $('bVendor').onchange = async () => {
          const nv = d.vendors.find(v => v.id === $('bVendor').value);
          const change = nv.backend !== c.backend;
          if (change && c.plaetze.length && !await GK.ask('Anbindung wechseln?\n\nDie Zonen werden bei dieser Anbindung anders zugeordnet – die Plätze müssen danach neu angelegt werden.', { ok: 'Wechseln', danger: true })) { $('bVendor').value = c.vendor; return; }
          try { await api('config', 'PUT', change ? { vendor: nv.id, plaetze: [] } : { vendor: nv.id }); GK.clean(); toast(change ? 'Hersteller umgestellt – bitte die Plätze neu anlegen.' : 'Hersteller umgestellt – bitte die Zonen prüfen.'); GK.RENDER.beregnung().catch(fail); }
          catch (e) { fail(e); $('bVendor').value = c.vendor; }
        };
        $('bAddPl').onclick = () => { readForm(); c.plaetze.push({ name: `Platz ${c.plaetze.length + 1}`, sub: '', zones: [{ ref: '', label: '', sec: 120 }] }); $('bPl').innerHTML = plaetzeHtml(); bindPlaetze(); };
        $('bSaveP').onclick = async () => { if (await save(['plaetze'])) GK.RENDER.beregnung().catch(fail); };
        if ($('bKeySave')) $('bKeySave').onclick = async () => { try { await api('key', 'PUT', { key: $('bKey').value.trim() }); toast('Key gespeichert.'); GK.RENDER.beregnung().catch(fail); } catch (e) { fail(e); } };
        if ($('bKeyDel')) $('bKeyDel').onclick = async () => { if (!await GK.ask('Hydrawise-API-Key löschen?', { ok: 'Löschen' })) return; try { await api('key', 'PUT', { key: '' }); toast('Key gelöscht.'); GK.RENDER.beregnung().catch(fail); } catch (e) { fail(e); } };
        return;
      }
      if (k === 'webapp') {
        el.innerHTML = `<div class="card"><h3>Wer darf bedienen?</h3>
            <div class="row"><label class="f" style="flex:1;min-width:280px">Bedienung<select id="bMode">${MODES.map(([m, l]) => `<option value="${m}" ${c.mode === m ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              <label class="f" style="flex:1;min-width:240px">Sperre nach einer Beregnung (Minuten, 0 = aus)<input id="bCool" inputmode="numeric" value="${c.cooldownMin || 0}"></label></div>
            <p class="muted s" id="bHintpin" style="margin:10px 0 0">Jeder im Vereins-WLAN öffnet <b>${GK.scheme ? GK.scheme() : 'http'}://&lt;Adresse von Home Assistant&gt;:${d.port || 5000}</b> und bedient mit der gemeinsamen Vereins-PIN.</p>
            <p class="muted s" id="bHintapp" style="margin:10px 0 0">Nur Mitglieder, die unter „Mitglieder-App“ für die Beregnung freigeschaltet sind – mit ihrem eigenen Handy und ihrer App-PIN. Im Protokoll steht der Name.</p>
            <p class="muted s" id="bHintlogin" style="margin:10px 0 0">Anmelden können sich Benutzer der Verwaltung mit dem Recht „Beregnung bedienen“ (unter „Benutzer &amp; Rechte“ – auch Konten, die sonst nichts dürfen).</p>
            <p class="muted s" style="margin:6px 0 0">Mitglieder mit Freischaltung in der Mitglieder-App können die Beregnung in jedem Modus dort bedienen.</p>
            <label class="chk" style="margin-top:12px"><input type="checkbox" id="bStopFree" ${c.stopFree ? 'checked' : ''}> Roter Stopp-Knopf funktioniert ohne PIN</label>
            <label class="chk" style="margin-top:8px"><input type="checkbox" id="bHeader" ${c.header ? 'checked' : ''}> Zusätzlich als „Beregnung“ in der Kopfzeile am Tablet (nicht bei „nur Mitglieder-App“)</label></div>
          <div class="card" id="bPinCard"><h3>Vereins-PIN</h3><div class="row"><label class="f" style="flex:1;min-width:240px">Vereins-PIN (4–8 Ziffern) · ${d.hasPin ? 'festgelegt' : '<b style="color:var(--red)">noch nicht festgelegt</b>'}<input id="bPin" data-nodirty inputmode="numeric" maxlength="8" autocomplete="off" placeholder="${d.hasPin ? 'neue PIN eintragen' : 'PIN festlegen'}"></label>
            <button class="btn primary" id="bPinSave">PIN speichern</button></div></div>
          <div class="card"><h3>Eigene Webapp</h3><div class="row"><label class="f" style="flex:1;min-width:200px">Name auf dem Homescreen<input id="bApp" maxlength="20" value="${esc(c.appName)}"></label>
            <label class="f" style="flex:1;min-width:200px">Untertitel<input id="bSub" maxlength="40" value="${esc(c.subtitle)}"></label></div>
            ${ha ? `<div class="row" style="margin-top:12px"><label class="f" style="flex:1;min-width:240px">Anzeige „nächste automatische Beregnung“ (optional)<select id="bNext"><option value="">– keine –</option>${(d.sensors || []).map(x => `<option value="${esc(x.ref)}" ${x.ref === c.nextEntity ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
              <label class="f" style="flex:1;min-width:240px">Bei Störung benachrichtigen (optional)<input id="bNotify" value="${esc(c.notify || '')}" placeholder="z. B. mobile_app_handy_platzwart"></label></div>` : ''}</div>
          <div class="row" style="justify-content:flex-end"><button class="btn primary" id="bSaveW">Einstellungen speichern</button></div>`;
        GK.watch(el);
        const hints = () => { const m = $('bMode').value; for (const x of ['pin', 'app', 'login']) $('bHint' + x).style.display = m === x ? '' : 'none'; $('bPinCard').style.display = m === 'pin' ? '' : 'none'; };
        $('bMode').addEventListener('change', hints); hints();
        $('bSaveW').onclick = () => save(['mode', 'cooldownMin', 'appName', 'subtitle', 'stopFree', 'header', 'nextEntity', 'notify']);
        $('bPinSave').onclick = async () => { try { await api('pin', 'PUT', { pin: $('bPin').value.trim() }); toast('PIN gespeichert.'); $('bPin').value = ''; } catch (e) { fail(e); } };
        return;
      }
      if (k === 'protokoll') { el.innerHTML = '<div class="card"><div id="bLog"></div></div>'; return loadLog(); }
    });
  };

  async function loadLog() {
    const r = await api('log' + (st.month ? '?month=' + st.month : ''));
    st.month = r.month;
    const act = { start: '<span class="pill g">Start</span>', stop: '<span class="pill a">Stopp</span>', fehler: '<span class="pill r">Fehler</span>', kopplung: '<span class="pill b">Freischaltung</span>' };
    const mName = m => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    $('bLog').innerHTML = `<div class="row" style="margin-bottom:10px"><label class="f">Monat<select id="bMonth">${r.months.map(m => `<option value="${m}" ${m === r.month ? 'selected' : ''}>${mName(m)}</option>`).join('')}</select></label>
      <a class="btn" href="api/admin/x/beregnung/log.xlsx?month=${r.month}">Als Excel exportieren</a></div>
      ${r.rows.length ? `<table class="tbl"><tr><th>Zeitpunkt</th><th>Aktion</th><th>Platz</th><th class="r">Minuten</th><th>Wer</th><th>Hinweis</th></tr>
        ${r.rows.map(x => `<tr><td class="nw">${x.at.slice(8, 10)}.${x.at.slice(5, 7)}.${x.at.slice(0, 4)}, ${x.at.slice(11, 16)}</td><td>${act[x.action] || esc(x.action)}</td><td class="nw">${esc(x.platz || '–')}</td>
          <td class="r nw">${x.sec ? minTxt(x.sec) : '–'}</td><td>${esc(x.who || '–')}</td><td class="muted s">${esc(x.detail || '')}</td></tr>`).join('')}</table>`
        : '<p class="empty">In diesem Monat wurde nichts manuell beregnet.</p>'}`;
    $('bMonth').onchange = () => { st.month = $('bMonth').value; loadLog().catch(fail); };
  }

  GK.registerPage({ key: 'beregnung', title: 'Beregnung', perm: 'beregnung', render: GK.RENDER.beregnung, order: 5 });
  // Suche (Strg/⌘ K): Einstellungen und Aktionen der Beregnung
  if (GK.registerSearch) GK.registerSearch([
    { label: 'Beregnung starten', page: 'beregnung', tab: ['beregnung', 'bedienen'], card: 'Plätze', kind: 'aktion', in: 'Bedienen', words: 'starten Wasser Platz beregnen' },
    { label: 'Anbindung der Bewässerung (Hersteller)', page: 'beregnung', tab: ['beregnung', 'plaetze'], card: 'Anbindung', in: 'Plätze & Anbindung', words: 'Hydrawise Rain Bird Hunter Home Assistant Schlüssel Steuerung' },
    { label: 'Plätze und Zonen der Beregnung', page: 'beregnung', tab: ['beregnung', 'plaetze'], card: 'Plätze & Zonen', in: 'Plätze & Anbindung', words: 'Zone Ventil Platz' },
    { label: 'Wer darf die Beregnung bedienen?', page: 'beregnung', tab: ['beregnung', 'webapp'], card: 'Wer darf bedienen', in: 'Webapp & PIN', words: 'PIN Vereins-PIN Sperre Bedienung' },
    { label: 'Beregnungs-Webapp (Name, Störungsmeldung)', page: 'beregnung', tab: ['beregnung', 'webapp'], card: 'Eigene Webapp', in: 'Webapp & PIN', words: 'Webapp Homescreen Name Störung' },
    { label: 'Beregnungsprotokoll', page: 'beregnung', tab: ['beregnung', 'protokoll'], kind: 'reiter', in: 'Protokoll', words: 'Verlauf Excel Protokoll' },
    { label: 'Einstellungen der Beregnung übertragen', page: 'beregnung', tab: ['beregnung', 'plaetze'], card: 'Einstellungen übertragen', kind: 'aktion', in: 'Plätze & Anbindung', words: 'Export Import Datei' },
  ]);
})();
