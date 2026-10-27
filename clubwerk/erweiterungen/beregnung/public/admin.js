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
    if (!c.plaetze.length) return '<p class="empty">Noch keine Plätze – oben rechts „+ Platz“ wählen und die Zonen zuordnen.</p>';
    return c.plaetze.map((p, i) => `<div class="card soft" style="margin:0 0 12px">
      <div class="row" style="align-items:flex-end">
        <label class="f" style="flex:1 1 180px">Name<input data-pn="${i}" maxlength="30" value="${esc(p.name)}" placeholder="z. B. Platz 1"></label>
        <label class="f" style="flex:2 1 240px">Untertitel (leer = automatisch)<input data-ps="${i}" maxlength="60" value="${esc(p.sub || '')}" placeholder="z. B. Erst Vorne, dann Hinten · je 2 min"></label>
        <button class="btn small" data-pu="${i}" ${i === 0 ? 'disabled' : ''} title="nach oben" aria-label="nach oben">↑</button>
        <button class="btn small" data-pd="${i}" ${i === c.plaetze.length - 1 ? 'disabled' : ''} title="nach unten" aria-label="nach unten">↓</button>
      </div>
      ${p.zones.map((z, j) => `<div class="row" style="align-items:flex-end;margin-top:10px">
        <label class="f" style="flex:2 1 220px">${j + 1}. Zone (Gerät)${st.cfg.backend === 'hydrawise' && !(st.data.list || []).length
          ? `<input data-zr="${i}.${j}" value="${esc(z.ref)}" inputmode="numeric" placeholder="Zonennummer">`
          : `<select data-zr="${i}.${j}">${zoneOptions(z.ref)}</select>`}</label>
        <label class="f" style="flex:1 1 140px">Bezeichnung<input data-zl="${i}.${j}" maxlength="20" value="${esc(z.label || '')}" placeholder="z. B. Vorne"></label>
        <label class="f" style="flex:0 1 90px">Minuten<input class="num" data-zs="${i}.${j}" inputmode="decimal" value="${minTxt(z.sec)}" style="text-align:right"></label>
        <button class="btn small" data-zx="${i}.${j}">Entfernen</button></div>`).join('')}
      <div class="row" style="margin-top:8px"><button class="btn small" data-za="${i}">+ Zone</button>
        <span class="muted s">Mehrere Zonen laufen nacheinander in dieser Reihenfolge.</span></div>
      <div class="row" style="margin-top:12px;border-top:1px solid var(--line);padding-top:12px"><button class="btn small danger" data-px="${i}">Platz löschen</button></div>
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
  }

  function bindPlaetze() {
    const c = st.cfg;
    const re = () => { $('bPl').innerHTML = plaetzeHtml(); bindPlaetze(); };
    const on = (attr, fn) => document.querySelectorAll(`[data-${attr}]`).forEach(b => b.onclick = async () => { readForm(); await fn(b.dataset[attr]); re(); });
    on('pu', i => { i = +i; [c.plaetze[i - 1], c.plaetze[i]] = [c.plaetze[i], c.plaetze[i - 1]]; });
    on('pd', i => { i = +i; [c.plaetze[i + 1], c.plaetze[i]] = [c.plaetze[i], c.plaetze[i + 1]]; });
    on('px', async i => { const p = c.plaetze[+i]; if (!await GK.ask(`Platz „${p.name || +i + 1}“ löschen?\n\nEnthaltene Zonen: ${p.zones.length}. Der Platz verschwindet erst nach „Speichern“ endgültig.`, { ok: 'Platz löschen', danger: true })) return; c.plaetze.splice(+i, 1); });
    on('za', i => { c.plaetze[+i].zones.push({ ref: '', label: '', sec: 120 }); });
    on('zx', k => { const [i, j] = k.split('.').map(Number); c.plaetze[i].zones.splice(j, 1); });
  }

  async function loadCfg() { const d = await api('config'); st.data = d; st.cfg = JSON.parse(JSON.stringify(d.cfg)); return d; }
  async function save(fields) {
    readForm();
    try { const r = await api('config', 'PUT', Object.fromEntries(fields.map(k => [k, st.cfg[k]]))); st.data.cfg = r.cfg; GK.clean(); toast('Gespeichert.'); return true; } catch (e) { fail(e); return false; }
  }
  /** Speichern einer Einstellungskarte: body() liefert die Felder, danach wird der Reiter neu gezeichnet */
  const cardSave = (btn, body, after) => { btn.onclick = () => GK.busy(btn, async () => {
    try { const r = await api('config', 'PUT', body()); st.data.cfg = r.cfg; GK.clean(); toast('Gespeichert.'); if (after) await after(); } catch (e) { fail(e); }
  }); };
  const MODES = [['pin', 'Offen mit Vereins-PIN (eigene Webapp)'], ['app', 'Nur freigeschaltete Mitglieder (Mitglieder-App)'], ['login', 'Gesperrt – nur Benutzer mit Passwort']];

  GK.RENDER.beregnung = async () => {
    const full = GK.can('beregnung');   // ohne dieses Recht nur „Bedienen“ (Recht „Beregnung bedienen“)
    if (full) await loadCfg();
    $('main').innerHTML = `<h2 class="page">Beregnung</h2>
      <p class="lead">Mitglieder starten hier die manuelle Beregnung eines Platzes; Zeitpläne bleiben beim Hersteller.</p><div id="bTabs"></div>`;
    GK.tabs($('bTabs'), 'beregnung', [['bedienen', 'Bedienen'], ...(full ? [['plaetze', 'Plätze & Zonen'], ['verlauf', 'Verlauf'], ['einstellungen', 'Einstellungen']] : [])], async (k, el) => {
      const d = full ? await loadCfg() : {}; const c = st.cfg || {};
      const ha = c.backend !== 'hydrawise';
      if (k === 'bedienen') {
        // dieselben Kacheln wie in der Mitglieder-App, am Tablet und in der Beregnungs-Webapp (plaetze.js + kit.css);
        // plaetze.js lädt die Verwaltung vor admin.js (erweiterung.json „skripte“) – kein Nachladen mitten in der Ansicht
        const T = window.BeregnungTiles;
        let s = await api('status'), timer = null, tick = null;
        el.innerHTML = `<div id="bOff"></div><div class="card"><h3>Plätze</h3><div class="vh-tiles zones" id="bTiles"></div>
            <p class="muted s" id="bNext" style="margin:12px 0 0"></p>
            <div class="row" style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px"><button class="btn danger" id="bStop">■ Alle Zonen ausschalten</button></div></div>`;
        const alive = () => document.body.contains(el) && $('bTiles');
        const draw = () => {
          if (!alive()) { clearInterval(tick); clearTimeout(timer); return; }   // Seite schon verlassen (Antwort kam nach dem Wechsel) – nichts mehr zeichnen
          $('bOff').innerHTML = s.online ? '' : `<div class="banner r">Keine Verbindung zur Bewässerungsanlage${s.error ? ': ' + esc(s.error) : ''}</div>`;
          $('bTiles').innerHTML = s.plaetze.length ? T.html(s.plaetze, esc) : '<div class="vh-empty">Noch keine Plätze – unter „Plätze &amp; Zonen“ anlegen.</div>';
          $('bNext').textContent = s.next ? `Nächste automatische Beregnung: ${s.next}` : '';
          $('bStop').parentNode.classList.toggle('hidden', !s.plaetze.length);
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
        return;
      }
      if (k === 'plaetze') {
        el.innerHTML = `${d.error ? `<div class="banner r">Keine Verbindung zur Steuerung: ${esc(d.error)}<br>Bitte unter Einstellungen › Anbindung prüfen.</div>` : `<div class="banner g">Verbunden – ${d.list.length} schaltbare Zonen gefunden.</div>`}
          <div class="card" data-card="plaetze"><h3>Plätze &amp; Zonen</h3><div id="bPl">${plaetzeHtml()}</div>
            <div class="btns"><button class="btn primary" id="bSaveP">Speichern</button></div></div>`;
        const tools = '<button class="btn" id="bAddPl">+ Platz</button>';
        if (!GK.tabTools(tools, $('bPl'))) el.insertAdjacentHTML('afterbegin', `<div class="toolbar">${tools}</div>`);
        GK.watch(el); bindPlaetze();
        $('bAddPl').onclick = () => { readForm(); c.plaetze.push({ name: `Platz ${c.plaetze.length + 1}`, sub: '', zones: [{ ref: '', label: '', sec: 120 }] }); $('bPl').innerHTML = plaetzeHtml(); bindPlaetze(); };
        $('bSaveP').onclick = () => GK.busy($('bSaveP'), async () => { if (await save(['plaetze'])) GK.RENDER.beregnung().catch(fail); });
        return;
      }
      if (k === 'einstellungen') {
        const vend = d.vendors.find(v => v.id === c.vendor) || d.vendors[0];
        const addr = `${GK.scheme ? GK.scheme() : 'http'}://&lt;Adresse von Home Assistant&gt;:${d.port || 5000}`;
        el.innerHTML = `<div class="card" data-card="anbindung"><h3>Anbindung</h3>
            ${d.error ? `<div class="banner r">Keine Verbindung zur Steuerung: ${esc(d.error)}</div>` : `<div class="banner g">Verbunden – ${d.list.length} schaltbare Zonen gefunden.</div>`}
            <div class="row"><label class="f" style="flex:1;min-width:260px">Hersteller der Steuerung<select id="bVendor" data-nodirty>${d.vendors.map(v => `<option value="${v.id}" ${v.id === c.vendor ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label></div>
            ${ha ? `<p class="muted s" style="margin:8px 0 0">Einrichtung: in Home Assistant unter Einstellungen → Geräte &amp; Dienste die <b>${esc(vend.setup)}</b> hinzufügen. Jede Zone erscheint dann als Ventil oder Schalter${d.filtered ? ' – angeboten werden nur Geräte dieses Herstellers' : ''}.
              Tipp: Die Standard-Laufzeit der Zone in der Hersteller-App mindestens so lang einstellen wie in „Plätze &amp; Zonen“.</p>${d.haAvailable ? '' : '<div class="banner a" style="margin-top:8px">Das Add-on hat keinen Zugriff auf Home Assistant. Bitte das Add-on neu bauen und starten.</div>'}`
            : `<div class="row" style="margin-top:10px"><label class="f" style="flex:1;min-width:260px">Hydrawise-API-Key<input id="bKey" type="password" data-nodirty autocomplete="off" placeholder="${d.hasKey ? 'gespeichert – zum Ändern neu eintragen' : 'z. B. aus hydrawise.com → Konto → Einstellungen'}"></label></div>
              <p class="muted s" style="margin:8px 0 0">Der Key bleibt auf dem Server und ist im Browser nie sichtbar. Zonennummer = Anschluss am Controller (1, 2, 3 …).</p>`}
            <div class="btns"><button class="btn primary" id="bSaveA">Speichern</button></div>
            ${!ha && d.hasKey ? '<div class="btns" style="border-top:1px solid var(--line);padding-top:12px"><button class="btn danger" id="bKeyDel">Key löschen</button></div>' : ''}</div>
          <div class="card" data-card="bedienen"><h3>Wer darf bedienen?</h3>
            <div class="row"><label class="f" style="flex:1;min-width:280px">Bedienung<select id="bMode">${MODES.map(([m, l]) => `<option value="${m}" ${c.mode === m ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              <label class="f" style="flex:1;min-width:240px">Sperre nach einer Beregnung (Minuten, 0 = aus)<input id="bCool" inputmode="numeric" value="${c.cooldownMin || 0}"></label></div>
            <p class="muted s" id="bHintpin" style="margin:10px 0 0">Jeder im Vereins-WLAN öffnet die Webapp und bedient mit der gemeinsamen Vereins-PIN.</p>
            <p class="muted s" id="bHintapp" style="margin:10px 0 0">Nur Mitglieder, die unter „Mitglieder-App“ für die Beregnung freigeschaltet sind – mit ihrem eigenen Handy und ihrer App-PIN. Im Verlauf steht der Name.</p>
            <p class="muted s" id="bHintlogin" style="margin:10px 0 0">Anmelden können sich Benutzer der Verwaltung mit dem Recht „Beregnung bedienen“ (unter „Benutzer &amp; Rechte“ – auch Konten, die sonst nichts dürfen).</p>
            <p class="muted s" style="margin:6px 0 0">Mitglieder mit Freischaltung in der Mitglieder-App bedienen die Beregnung dort in jedem Modus.</p>
            <label class="chk" style="margin-top:12px"><input type="checkbox" id="bStopFree" ${c.stopFree ? 'checked' : ''}> Roter Stopp-Knopf funktioniert ohne PIN</label>
            <div class="row" style="margin-top:12px"><label class="f" style="flex:1;min-width:240px">Vereins-PIN (4–8 Ziffern) · ${d.hasPin ? 'festgelegt' : '<b style="color:var(--red)">noch nicht festgelegt</b>'}<input id="bPin" data-nodirty inputmode="numeric" maxlength="8" autocomplete="off" placeholder="${d.hasPin ? 'neue PIN eintragen' : 'z. B. 4 bis 8 Ziffern'}"></label></div>
            <p class="muted s" style="margin:6px 0 0">Die Vereins-PIN gilt nur bei der Bedienung „Offen mit Vereins-PIN“.</p>
            <div class="btns"><button class="btn primary" id="bSaveM">Speichern</button></div></div>
          <div class="card" data-card="webapp"><h3>Webapp</h3>
            <p class="muted s" style="margin-top:0">Eigene Seite fürs Handy: <b>${addr}</b> im Browser öffnen und „Zum Home-Bildschirm“ wählen.</p>
            <div class="row"><label class="f" style="flex:1;min-width:200px">Name auf dem Homescreen<input id="bApp" maxlength="20" value="${esc(c.appName)}"></label>
              <label class="f" style="flex:1;min-width:200px">Untertitel<input id="bSub" maxlength="40" value="${esc(c.subtitle)}"></label></div>
            ${ha ? `<div class="row" style="margin-top:12px"><label class="f" style="flex:1;min-width:240px">Anzeige „nächste automatische Beregnung“ (optional)<select id="bNext"><option value="">– keine –</option>${(d.sensors || []).map(x => `<option value="${esc(x.ref)}" ${x.ref === c.nextEntity ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label></div>` : ''}
            <div class="btns"><button class="btn primary" id="bSaveW">Speichern</button></div></div>
          <div class="card" data-card="benachrichtigungen"><h3>Benachrichtigungen</h3>
            ${ha ? `<div class="row"><label class="f" style="flex:1;min-width:240px">Bei Störung benachrichtigen (optional)<input id="bNotify" value="${esc(c.notify || '')}" placeholder="z. B. mobile_app_handy_platzwart"></label></div>
              <p class="muted s" style="margin:8px 0 0">Name des Home-Assistant-Dienstes (notify.…), der die Nachricht ans Handy des Platzwarts schickt, wenn eine Zone nicht startet oder sich nicht ausschalten lässt.</p>
              <div class="btns"><button class="btn primary" id="bSaveN">Speichern</button></div>`
            : '<p class="muted s" style="margin:0">Benachrichtigungen bei Störungen gibt es nur mit Home Assistant als Anbindung.</p>'}</div>
          <div id="bFunc"></div>`;
        GK.watch(el);
        const hints = () => { const m = $('bMode').value; for (const x of ['pin', 'app', 'login']) $('bHint' + x).style.display = m === x ? '' : 'none'; };
        $('bMode').addEventListener('change', hints); hints();
        const again = () => GK.RENDER.beregnung().catch(fail);
        $('bSaveA').onclick = () => GK.busy($('bSaveA'), async () => {
          const nv = d.vendors.find(v => v.id === $('bVendor').value), change = nv.backend !== c.backend;
          try {
            if (nv.id !== c.vendor) {
              if (change && c.plaetze.length && !await GK.ask('Anbindung wechseln?\n\nDie Zonen werden bei dieser Anbindung anders zugeordnet – die Plätze müssen danach neu angelegt werden.', { ok: 'Wechseln', danger: true })) { $('bVendor').value = c.vendor; return; }
              await api('config', 'PUT', change ? { vendor: nv.id, plaetze: [] } : { vendor: nv.id });
              toast(change ? 'Hersteller umgestellt – bitte die Plätze neu anlegen.' : 'Hersteller umgestellt – bitte die Zonen prüfen.');
            }
            const key = !change && $('bKey') ? $('bKey').value.trim() : '';
            if (key) { await api('key', 'PUT', { key }); toast('Key gespeichert.'); } else if (nv.id === c.vendor) toast('Gespeichert.');
            GK.clean(); again();
          } catch (e) { fail(e); }
        });
        if ($('bKeyDel')) $('bKeyDel').onclick = async () => { if (!await GK.ask('Hydrawise-API-Key löschen?\n\nDie Beregnung kann danach nichts mehr schalten, bis ein neuer Key eingetragen ist.', { ok: 'Key löschen', danger: true })) return; try { await api('key', 'PUT', { key: '' }); toast('Key gelöscht.'); again(); } catch (e) { fail(e); } };
        $('bSaveM').onclick = () => GK.busy($('bSaveM'), async () => {
          try {
            const pin = $('bPin').value.trim();
            const r = await api('config', 'PUT', { mode: $('bMode').value, cooldownMin: $('bCool').value, stopFree: $('bStopFree').checked });
            if (pin) await api('pin', 'PUT', { pin });
            st.data.cfg = r.cfg; GK.clean(); toast('Gespeichert.'); again();
          } catch (e) { fail(e); }
        });
        cardSave($('bSaveW'), () => ({ appName: $('bApp').value, subtitle: $('bSub').value, ...($('bNext') ? { nextEntity: $('bNext').value } : {}) }));
        if ($('bSaveN')) cardSave($('bSaveN'), () => ({ notify: $('bNotify').value }));
        if (GK.funcBox) GK.funcBox($('bFunc'), 'beregnung', 'Beregnung', again);
        return;
      }
      if (k === 'verlauf') { el.innerHTML = '<div class="card"><div id="bLog"></div></div>'; return loadLog(el); }
    });
  };

  async function loadLog(el) {
    const r = await api('log' + (st.month ? '?month=' + st.month : ''));
    st.month = r.month;
    const act = { start: '<span class="pill g">Start</span>', stop: '<span class="pill a">Stopp</span>', fehler: '<span class="pill r">Fehler</span>', kopplung: '<span class="pill b">Freischaltung</span>' };
    const mName = m => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    const tools = `<a class="btn" href="api/admin/x/beregnung/log.xlsx?month=${r.month}">Excel</a>`;
    el.querySelector('.toolbar')?.remove();
    if (!GK.tabTools(tools, $('bLog'))) el.insertAdjacentHTML('afterbegin', `<div class="toolbar">${tools}</div>`);
    $('bLog').innerHTML = `<div class="row" style="margin-bottom:10px"><label class="f">Monat<select id="bMonth">${r.months.map(m => `<option value="${m}" ${m === r.month ? 'selected' : ''}>${mName(m)}</option>`).join('')}</select></label></div>
      ${r.rows.length ? `<table class="tbl kompakt"><tr><th>Zeitpunkt</th><th>Aktion</th><th>Platz</th><th class="r">Minuten</th><th>Wer</th><th>Hinweis</th></tr>
        ${r.rows.map(x => `<tr><td class="nw num">${x.at.slice(8, 10)}.${x.at.slice(5, 7)}.${x.at.slice(0, 4)}, ${x.at.slice(11, 16)}</td><td>${act[x.action] || esc(x.action)}</td><td class="nw">${esc(x.platz || '')}</td>
          <td class="r nw num">${x.sec ? minTxt(x.sec) : ''}</td><td>${esc(x.who || '')}</td><td class="muted s" title="${esc(x.detail || '')}">${esc(x.detail || '')}</td></tr>`).join('')}</table>`
        : '<p class="empty">In diesem Monat wurde nichts manuell beregnet.</p>'}`;
    $('bMonth').onchange = () => { st.month = $('bMonth').value; loadLog(el).catch(fail); };
  }

  GK.registerPage({ key: 'beregnung', title: 'Beregnung', perm: ['beregnung', 'beregnung_bedienen'], render: GK.RENDER.beregnung, order: 5 });
  // Suche (Strg/⌘ K): Einstellungen und Aktionen der Beregnung
  if (GK.registerSearch) GK.registerSearch([
    { label: 'Beregnung starten', page: 'beregnung', tab: ['beregnung', 'bedienen'], card: 'Plätze', kind: 'aktion', in: 'Bedienen', words: 'starten Wasser Platz beregnen' },
    { label: 'Alle Zonen ausschalten (Notaus)', page: 'beregnung', tab: ['beregnung', 'bedienen'], btn: '■ Alle Zonen ausschalten', kind: 'aktion', in: 'Bedienen', words: 'Stopp Notaus stoppen Wasser aus' },
    { label: 'Plätze und Zonen der Beregnung', page: 'beregnung', perm: 'beregnung', tab: ['beregnung', 'plaetze'], card: 'Plätze & Zonen', kind: 'reiter', in: 'Plätze & Zonen', words: 'Zone Ventil Platz Laufzeit Minuten' },
    { label: 'Platz hinzufügen', page: 'beregnung', perm: 'beregnung', tab: ['beregnung', 'plaetze'], btn: '+ Platz', kind: 'aktion', in: 'Plätze & Zonen', words: 'Platz neu anlegen Zone' },
    { label: 'Verlauf der Beregnung', page: 'beregnung', perm: 'beregnung', tab: ['beregnung', 'verlauf'], kind: 'reiter', in: 'Verlauf', words: 'Protokoll Log Start Stopp Fehler' },
    { label: 'Verlauf der Beregnung als Excel', page: 'beregnung', perm: 'beregnung', tab: ['beregnung', 'verlauf'], kind: 'aktion', in: 'Verlauf', words: 'Excel Export Protokoll' },
    { label: 'Anbindung der Bewässerung (Hersteller)', page: 'beregnung', perm: 'beregnung', tab: ['beregnung', 'einstellungen'], card: 'Anbindung', in: 'Einstellungen', words: 'Hydrawise Rain Bird Hunter Home Assistant Schlüssel Key Steuerung' },
    { label: 'Wer darf die Beregnung bedienen?', page: 'beregnung', perm: 'beregnung', tab: ['beregnung', 'einstellungen'], card: 'Wer darf bedienen', in: 'Einstellungen', words: 'Bedienung Sperre Stopp ohne PIN' },
    { label: 'Vereins-PIN der Beregnung', page: 'beregnung', perm: 'beregnung', tab: ['beregnung', 'einstellungen'], field: 'bPin', in: 'Einstellungen › Wer darf bedienen?', words: 'PIN Vereins-PIN Kennwort' },
    { label: 'Beregnungs-Webapp (Name, Untertitel)', page: 'beregnung', perm: 'beregnung', tab: ['beregnung', 'einstellungen'], card: 'Webapp', in: 'Einstellungen', words: 'Webapp Homescreen Name Handy Adresse nächste Beregnung' },
    { label: 'Benachrichtigung bei Störung der Beregnung', page: 'beregnung', perm: 'beregnung', tab: ['beregnung', 'einstellungen'], card: 'Benachrichtigungen', in: 'Einstellungen', words: 'Störung Push notify Platzwart Handy' },
    { label: 'Einstellungen der Beregnung übertragen', page: 'beregnung', perm: 'beregnung', tab: ['beregnung', 'einstellungen'], card: 'Einstellungen übertragen', kind: 'aktion', in: 'Einstellungen', words: 'Export Import Datei sichern' },
  ]);
})();
