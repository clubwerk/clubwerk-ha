'use strict';
/* Verwaltungsseite der Erweiterung „Zugang“ */
(() => {
  const GK = window.GK;
  const { $, esc, toast, fail } = GK;
  const api = (url, method, body) => GK.api('x/zugang/' + url, method, body);
  const DAYS = [['1', 'Montag'], ['2', 'Dienstag'], ['3', 'Mittwoch'], ['4', 'Donnerstag'], ['5', 'Freitag'], ['6', 'Samstag'], ['0', 'Sonntag']];
  const TYPE = { lock: 'Schloss', impulse: 'Türöffner (Impuls)', cover: 'Tor / Antrieb' };   // kurz, damit nichts im Auswahlfeld abgeschnitten wird
  const TDOM = { lock: ['lock'], impulse: ['switch', 'button'], cover: ['cover'] };
  const st = { d: null, c: null, month: null };
  const dt = ts => (ts ? `${ts.slice(8, 10)}.${ts.slice(5, 7)}.${ts.slice(2, 4)} ${ts.slice(11, 16)}` : '–');
  const deD = d => (d ? d.split('-').reverse().join('.') : '');

  /* ---------- Zeitfenster als Text: „07:00–12:00, 14:00–22:00“ ---------- */
  const winText = list => (list || []).map(([a, b]) => (a === '00:00' && b === '24:00' ? 'ganztägig' : `${a}–${b}`)).join(', ');
  function parseWin(txt, dayName, prof) {
    txt = String(txt || '').trim().toLowerCase();
    if (!txt || txt === 'geschlossen' || txt === '-') return [];
    if (txt === 'ganztägig' || txt === 'ganztags' || txt === '0-24' || txt === 'immer') return [['00:00', '24:00']];
    return txt.split(/[,;]/).map(p => {
      const m = p.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*[-–bis]+\s*(\d{1,2})(?::(\d{2}))?$/);
      if (!m) throw new Error(`${prof}, ${dayName}: „${p.trim()}“ verstehe ich nicht – bitte z. B. 07:00–23:00`);
      const f = (h, mi) => `${String(+h).padStart(2, '0')}:${mi || '00'}`;
      return [f(m[1], m[2]), f(m[3], m[4])];
    });
  }

  function devOptions(doms, sel, emptyLabel) {
    const list = doms.flatMap(d => (st.d.devices && st.d.devices[d]) || []);
    const has = list.some(x => x.ref === sel);
    return `<option value="">${emptyLabel}</option>${!has && sel ? `<option value="${esc(sel)}" selected>${esc(sel)} – fehlt</option>` : ''}`
      + list.map(x => `<option value="${esc(x.ref)}" ${x.ref === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  }

  /* ---------- Türen ---------- */
  function doorsHtml() {
    const c = st.c;
    if (!c.doors.length) return '<p class="empty">Noch keine Türen angelegt.</p>';
    return `<table class="tbl"><tr><th>Name</th><th style="width:170px">Art</th><th>Gerät in Home Assistant</th><th>Türkontakt</th><th class="r" style="width:100px">Impuls (Sek.)</th><th style="width:190px"></th></tr>
      ${c.doors.map((d, i) => `<tr>
        <td><input data-dn="${i}" maxlength="30" value="${esc(d.name)}" placeholder="z. B. Haustür" style="width:100%"></td>
        <td><select data-dt="${i}" style="width:100%">${Object.entries(TYPE).map(([k, v]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
        <td><select data-dr="${i}" style="width:100%">${devOptions(TDOM[d.type], d.ref, '– Gerät wählen –')}</select></td>
        <td><select data-ds="${i}" style="width:100%">${devOptions(['binary_sensor'], d.sensor, '– keiner –')}</select></td>
        <td class="r"><input data-dp="${i}" inputmode="numeric" value="${d.pulseSec || 3}" style="width:60px;text-align:right" ${d.type === 'impulse' ? '' : 'disabled'}></td>
        <td class="r" style="white-space:nowrap"><button class="btn small" data-du="${i}" ${i === 0 ? 'disabled' : ''} aria-label="nach oben">↑</button> <button class="btn small" data-dd="${i}" ${i === c.doors.length - 1 ? 'disabled' : ''} aria-label="nach unten">↓</button> <button class="btn small danger" data-dx="${i}">Entfernen</button></td></tr>`).join('')}</table>`;
  }
  /* ---------- Zeitprofile ---------- */
  function profilesHtml() {
    const c = st.c;
    return c.profiles.map((p, i) => `<div class="card" style="margin:0 0 12px">
      <div class="row" style="align-items:flex-end;flex-wrap:nowrap">
        <label class="f" style="flex:1 1 180px;min-width:180px">Name<input data-pn="${i}" maxlength="30" value="${esc(p.name)}"></label>
        <label class="row" style="align-items:center;gap:8px;flex-wrap:nowrap;min-height:40px;margin:0"><input type="radio" name="zDef" data-pdef="${i}" ${p.isDefault ? 'checked' : ''} style="width:20px;height:20px;flex:none"> <span>Standard bei neuer Freischaltung</span></label>
        <button class="btn small danger" data-px="${i}" ${c.profiles.length < 2 ? 'disabled' : ''}>Profil löschen</button>
      </div>
      <div class="f" style="margin-top:12px"><span>Türen</span><div class="row" style="align-items:center;gap:8px 18px;flex-wrap:wrap">
        <label class="chk"><input type="checkbox" data-pall="${i}" ${p.doors === 'all' ? 'checked' : ''}> Alle (auch künftige)</label>
        ${c.doors.map(d => `<label class="chk"><input type="checkbox" data-pd="${i}" value="${d.id}" ${p.doors === 'all' || (p.doors || []).includes(d.id) ? 'checked' : ''} ${p.doors === 'all' ? 'disabled' : ''}> ${esc(d.name)}</label>`).join('')}
      </div></div>
      <table class="tbl" style="margin-top:12px"><tr><th style="width:130px">Tag</th><th>Zeiten</th></tr>
        ${DAYS.map(([k, n]) => `<tr><td>${n}</td><td><input data-pw="${i}.${k}" value="${esc(winText((p.windows || {})[k]))}" placeholder="geschlossen" style="width:100%"></td></tr>`).join('')}
      </table>
      <p class="muted s" style="margin:8px 0 0">Zeiten wie 07:00–23:00, mehrere mit Komma; leer = geschlossen; „ganztägig“ = rund um die Uhr.</p>
      <div class="row" style="margin-top:8px"><button class="btn small" data-pcopy="${i}">Montag auf alle Tage übertragen</button><button class="btn small" data-pwork="${i}">Montag auf Mo–Fr übertragen</button></div>
    </div>`).join('');
  }
  function blockHtml() {
    const c = st.c;
    return `${c.blockDays.length ? `<table class="tbl"><tr><th style="width:170px">von</th><th style="width:170px">bis</th><th>Grund</th><th style="width:110px"></th></tr>
      ${c.blockDays.map((b, i) => `<tr><td><input type="date" data-bf="${i}" value="${b.from}"></td><td><input type="date" data-bt="${i}" value="${b.to}"></td><td><input data-bn="${i}" maxlength="60" value="${esc(b.note || '')}" placeholder="z. B. Platzsanierung" style="width:100%"></td>
        <td class="r"><button class="btn small" data-bx="${i}">Entfernen</button></td></tr>`).join('')}</table>` : '<p class="empty">Keine Sperrtage.</p>'}
      <div class="row" style="margin-top:8px"><button class="btn small" id="zBAdd">+ Sperrzeitraum</button></div>`;
  }

  function readForm() {
    const c = st.c;
    const each = (attr, fn) => document.querySelectorAll(`[data-${attr}]`).forEach(e => fn(e, e.dataset[attr]));
    each('dn', (e, i) => { c.doors[+i].name = e.value; });
    each('dt', (e, i) => { c.doors[+i].type = e.value; });
    each('dr', (e, i) => { c.doors[+i].ref = e.value; });
    each('ds', (e, i) => { c.doors[+i].sensor = e.value; });
    each('dp', (e, i) => { c.doors[+i].pulseSec = +e.value || 3; });
    each('pn', (e, i) => { c.profiles[+i].name = e.value; });
    each('pdef', (e, i) => { c.profiles[+i].isDefault = e.checked; });
    c.profiles.forEach((p, i) => {
      const all = document.querySelector(`[data-pall="${i}"]`);
      if (all) p.doors = all.checked ? 'all' : [...document.querySelectorAll(`[data-pd="${i}"]`)].filter(x => x.checked).map(x => x.value);
    });
    const winErr = [];
    each('pw', (e, k) => { const [i, d] = k.split('.'); try { c.profiles[+i].windows = c.profiles[+i].windows || {}; c.profiles[+i].windows[d] = parseWin(e.value, DAYS.find(x => x[0] === d)[1], c.profiles[+i].name); } catch (er) { winErr.push(er.message); } });
    each('bf', (e, i) => { c.blockDays[+i].from = e.value; });
    each('bt', (e, i) => { c.blockDays[+i].to = e.value; });
    each('bn', (e, i) => { c.blockDays[+i].note = e.value; });
    const v = id => ($(id) ? $(id).value : undefined);
    if ($('zWlan')) { c.wlanOnly = $('zWlan').checked; c.header = $('zHeader').checked; c.notify = v('zNotify'); c.openAlertMin = v('zAlert'); }
    if (winErr.length) throw new Error(winErr[0]);
  }
  function rerender(part) {
    const map = { doors: ['zDoors', doorsHtml], profiles: ['zProfiles', profilesHtml], block: ['zBlock', blockHtml] };
    for (const k of part) { const [id, fn] = map[k]; if ($(id)) $(id).innerHTML = fn(); }
    bind();
  }
  function bind() {
    const c = st.c;
    const on = (attr, parts, fn) => document.querySelectorAll(`[data-${attr}]`).forEach(b => b.onclick = () => { try { readForm(); } catch (e) { /* beim Umsortieren egal */ } fn(b.dataset[attr]); rerender(parts); });
    on('du', ['doors', 'profiles'], i => { i = +i; [c.doors[i - 1], c.doors[i]] = [c.doors[i], c.doors[i - 1]]; });
    on('dd', ['doors', 'profiles'], i => { i = +i; [c.doors[i + 1], c.doors[i]] = [c.doors[i], c.doors[i + 1]]; });
    on('dx', ['doors', 'profiles'], i => { c.doors.splice(+i, 1); });
    on('px', ['profiles'], i => { c.profiles.splice(+i, 1); });
    on('bx', ['block'], i => { c.blockDays.splice(+i, 1); });
    on('pcopy', ['profiles'], i => { const w = c.profiles[+i].windows; for (const d of ['0', '2', '3', '4', '5', '6']) w[d] = (w['1'] || []).map(x => [...x]); });
    on('pwork', ['profiles'], i => { const w = c.profiles[+i].windows; for (const d of ['2', '3', '4', '5']) w[d] = (w['1'] || []).map(x => [...x]); });
    document.querySelectorAll('[data-dt]').forEach(s => s.onchange = () => { try { readForm(); } catch (e) { /* egal */ } c.doors[+s.dataset.dt].ref = ''; rerender(['doors']); });
    document.querySelectorAll('[data-pall]').forEach(s => s.onchange = () => { try { readForm(); } catch (e) { /* egal */ } rerender(['profiles']); });
    if ($('zBAdd')) $('zBAdd').onclick = () => { try { readForm(); } catch (e) { /* egal */ } const t = new Date().toISOString().slice(0, 10); c.blockDays.push({ from: t, to: t, note: '' }); rerender(['block']); };
  }

  /* Seite mit Reitern: Bedienen · Freischaltungen · Zeitprofile · Türen · Einstellungen · Protokoll */
  async function loadCfg() { const d = await api('config'); st.d = d; st.c = JSON.parse(JSON.stringify(d.cfg)); return d; }
  async function saveCfg(part, msg = 'Gespeichert.') {
    try { readForm(); const r = await api('config', 'PUT', part ? Object.fromEntries(part.map(k => [k, st.c[k]])) : st.c); st.d.cfg = r.cfg; st.c = JSON.parse(JSON.stringify(r.cfg)); GK.clean(); toast(msg); return true; }
    catch (e) { fail(e); return false; }
  }
  GK.RENDER.zugang = async () => {
    await loadCfg();
    $('main').innerHTML = `<h2 class="page">Zugang</h2>
      <p class="lead">Mitglieder öffnen Türen und Tore in der <b>Mitglieder-App</b> mit ihrer PIN – nur innerhalb ihres <b>Zeitprofils</b>. Es wird nie automatisch abgeschlossen.</p>
      <div id="zTabs"></div>`;
    GK.tabs($('zTabs'), 'zugang', [['bedienen', 'Bedienen'], ['mitglieder', 'Freischaltungen'], ['profile', 'Zeitprofile'], ['tueren', 'Türen'], ['einstellungen', 'Einstellungen'], ['protokoll', 'Protokoll']], async (k, el) => {
      await loadCfg();
      const c = st.c, d = st.d;
      if (k === 'bedienen') {
        el.innerHTML = `${d.error ? `<div class="banner r">Keine Verbindung zu Home Assistant: ${esc(d.error)}</div>` : ''}
          ${c.blockAll ? '<div class="banner r">Zugang ist für alle gesperrt. Niemand kann über die App öffnen – nur die Fernbedienung hier.</div>' : ''}
          <div class="card"><h3>Türen</h3><div id="zRemote"><p class="muted">Lade …</p></div></div>
          <div class="card"><h3>Notfall</h3><div class="row" style="align-items:center"><button class="btn ${c.blockAll ? 'primary' : 'danger'}" id="zBlockAll">${c.blockAll ? 'Sperre für alle aufheben' : 'Sofort alle sperren'}</button>
            <span class="muted s" style="flex:1;min-width:220px">Sperrt die App für alle Mitglieder (z. B. bei Verlust oder Missbrauch). Die Fernbedienung oben funktioniert weiter.</span></div></div>`;
        $('zBlockAll').onclick = async () => {
          if (!c.blockAll && !await GK.ask('Zugang für alle sperren?\n\nNiemand kann dann über die App öffnen, bis du die Sperre aufhebst.', { ok: 'Alle sperren', danger: true })) return;
          try { await api('config', 'PUT', { blockAll: !c.blockAll }); toast(c.blockAll ? 'Sperre aufgehoben.' : 'Zugang für alle gesperrt.'); GK.RENDER.zugang().catch(fail); } catch (e) { fail(e); }
        };
        return loadRemote();
      }
      if (k === 'mitglieder') return loadMembers(el);
      if (k === 'profile') {
        el.innerHTML = `<p class="muted s">Wann und welche Türen. Das <b>Standardprofil</b> bekommt jedes neu freigeschaltete Mitglied automatisch; je Mitglied unter „Freischaltungen“ änderbar.</p>
          <div id="zProfiles">${profilesHtml()}</div>
          <div class="row" style="justify-content:space-between"><button class="btn" id="zPAdd">+ Zeitprofil</button><button class="btn primary" id="zSaveP">Zeitprofile speichern</button></div>`;
        GK.watch(el); bind();
        $('zPAdd').onclick = () => { try { readForm(); } catch (e) { /* egal */ } c.profiles.push({ id: '', name: 'Neues Profil', doors: 'all', windows: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(x => [x, [['07:00', '23:00']]])), isDefault: false }); rerender(['profiles']); };
        $('zSaveP').onclick = async () => { if (await saveCfg(['profiles'])) rerender(['profiles']); };
        return;
      }
      if (k === 'tueren') {
        const vend = d.vendors.find(v => v.id === c.vendor) || d.vendors[d.vendors.length - 1];
        el.innerHTML = `${d.error ? `<div class="banner r">Keine Verbindung zu Home Assistant: ${esc(d.error)}</div>` : ''}
          <div class="card"><div class="row"><label class="f" style="flex:1;min-width:260px">Hersteller (filtert die Geräteliste)<select id="zVendor" data-nodirty>${d.vendors.map(v => `<option value="${v.id}" ${v.id === c.vendor ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label></div>
            <p class="muted s" style="margin:8px 0 0">Einrichtung: in Home Assistant unter Einstellungen → Geräte &amp; Dienste die <b>${esc(vend.setup)}</b> hinzufügen. Schlösser erscheinen als <code>lock.*</code>, Relais/Türöffner als <code>switch.*</code> oder <code>button.*</code>, Torantriebe als <code>cover.*</code>${d.filtered ? ' – angeboten werden nur Geräte dieses Herstellers' : ''}.</p></div>
          <div class="card"><h3>Türen, Tore &amp; Schlösser</h3><div id="zDoors">${doorsHtml()}</div>
            <div class="row" style="margin-top:10px;justify-content:space-between"><button class="btn" id="zDAdd">+ Tür</button><button class="btn primary" id="zSaveD">Türen speichern</button></div></div>`;
        GK.watch(el); bind();
        $('zDAdd').onclick = () => { try { readForm(); } catch (e) { /* egal */ } c.doors.push({ id: '', name: `Tür ${c.doors.length + 1}`, type: 'lock', ref: '', sensor: '', pulseSec: 3 }); rerender(['doors']); };
        $('zSaveD').onclick = async () => { if (await saveCfg(['doors'])) rerender(['doors']); };
        $('zVendor').onchange = async () => { try { await api('config', 'PUT', { vendor: $('zVendor').value }); toast('Hersteller geändert.'); GK.RENDER.zugang().catch(fail); } catch (e) { fail(e); } };
        return;
      }
      if (k === 'einstellungen') {
        el.innerHTML = `<div class="card"><h3>Sperrtage</h3><p class="muted s">An diesen Tagen öffnet die App für niemanden (z. B. Platzsanierung, Betriebsferien).</p><div id="zBlock">${blockHtml()}</div></div>
          <div class="card"><h3>Sicherheit &amp; Hinweise</h3>
            <label class="chk"><input type="checkbox" id="zWlan" ${c.wlanOnly ? 'checked' : ''}> Öffnen nur aus dem Vereins-WLAN (Anfragen aus dem Internet werden abgelehnt)</label>
            <label class="chk" style="margin-top:8px"><input type="checkbox" id="zHeader" ${c.header ? 'checked' : ''}> Zusätzlich als „Zugang“ in der Kopfzeile am Tablet (dort: Name wählen + App-PIN)</label>
            <div class="row" style="margin-top:12px"><label class="f" style="flex:1;min-width:240px">Bei Störung / offener Tür benachrichtigen (optional)<input id="zNotify" value="${esc(c.notify || '')}" placeholder="z. B. mobile_app_handy_vorstand"></label>
              <label class="f" style="flex:1;min-width:240px">Melden, wenn eine Tür länger offen steht (Minuten, 0 = aus)<input id="zAlert" inputmode="numeric" value="${c.openAlertMin || 0}"></label></div>
            <input type="hidden" id="zApp" value="${esc(c.appName)}"><input type="hidden" id="zSub" value="${esc(c.subtitle)}"><input type="hidden" id="zUrl" value="">
          </div>
          <div class="row" style="justify-content:flex-end"><button class="btn primary" id="zSaveS">Einstellungen speichern</button></div>
          <div id="zFunc" style="margin-top:14px"></div>`;
        GK.watch(el); bind();
        if (GK.funcBox) GK.funcBox($('zFunc'), 'zugang', 'Zugang');
        $('zSaveS').onclick = async () => { if (await saveCfg(['blockDays', 'wlanOnly', 'header', 'notify', 'openAlertMin'])) rerender(['block']); };
        return;
      }
      if (k === 'protokoll') { el.innerHTML = '<div class="card" id="zLog"></div>'; return loadLog(); }
    });
  };

  /* ---------- Fernbedienung ---------- */
  /** Türen aus der Ferne bedienen – dieselben Kacheln wie in der Mitglieder-App und am Tablet (doors.js + kit.css) */
  async function loadRemote() {
    if (!window.ZugangDoors) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'x/zugang/doors.js'; sc.onload = ok; sc.onerror = () => no(new Error('Kacheln konnten nicht geladen werden.')); document.head.appendChild(sc); });
    const r = await api('doors');
    if (!r.doors.length) { $('zRemote').innerHTML = '<div class="vh-empty">Noch keine Türen eingerichtet – unter „Türen“ anlegen.</div>'; return; }
    $('zRemote').innerHTML = `<div class="vh-tiles doors">${window.ZugangDoors.html(r.doors, esc, false)}</div>`;
    $('zRemote').querySelectorAll('[data-d]').forEach(b => { b.onclick = async () => {
      const d = r.doors.find(x => x.id === b.dataset.d), a = b.dataset.a, lab = window.ZugangDoors.label(d, a);
      if (!await GK.ask(`${d.name}: ${lab}?\n\nWird sofort aus der Ferne ausgeführt und protokolliert.`, { ok: lab, danger: false })) return;
      b.disabled = true;
      try { await api(`doors/${d.id}/${a}`, 'POST', {}); toast('Befehl gesendet.'); setTimeout(() => loadRemote().catch(fail), 1500); } catch (e) { fail(e); b.disabled = false; }
    }; });
  }

  /* ---------- Freischaltungen (zentral in der Mitglieder-App) ---------- */
  async function loadMembers(el) {
    const r = await api('members');
    const STAT = { gekoppelt: ['g', 'Handy freigeschaltet'], eingeladen: ['a', 'QR-Code offen'], abgelaufen: ['r', 'QR-Code abgelaufen'], 'ohne Handy': ['', 'ohne Handy'] };
    const def = r.profiles.find(p => p.isDefault);
    el.innerHTML = `<div class="card"><h3>Mitglied freischalten</h3>
        <div class="row"><label class="f" style="flex:1;min-width:240px">Mitglied (bekommt das Standardprofil „${esc(def ? def.name : '')}“)<select id="zMemNew" data-nodirty><option value="">– Mitglied wählen –</option>
          ${r.members.map(m => `<option value="${m.id}">${esc(GK.lastFirst ? GK.lastFirst(m.name) : m.name)}</option>`).join('')}</select></label><button class="btn primary" id="zMemInv">Freischalten & QR-Code</button></div>
        <p class="muted s" style="margin:8px 0 0">Der QR-Code gilt für die ganze Mitglieder-App. Wer schon ein freigeschaltetes Handy hat, braucht keinen neuen – einfach ankreuzen genügt (siehe „Mitglieder-App“).</p></div>
      <div class="card"><h3>Freigeschaltet <span class="muted s">(${r.rows.length})</span></h3>
      ${r.rows.length ? `<table class="tbl"><tr><th>Mitglied</th><th>Handy</th><th style="width:200px">Zeitprofil</th><th style="width:170px">gültig bis</th><th class="hide-md">zuletzt</th><th></th></tr>
        ${r.rows.map(x => `<tr${x.blocked ? ' class="off"' : ''}><td><b>${esc(GK.lastFirst ? GK.lastFirst(x.name) : x.name)}</b>${x.blocked ? ' <span class="pill r">gesperrt</span>' : ''}</td><td><span class="pill ${STAT[x.device][0]}">${STAT[x.device][1]}</span></td>
          <td><select data-mp="${x.member_id}" data-nodirty style="width:100%">${r.profiles.map(p => `<option value="${p.id}" ${p.id === x.profile ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td>
          <td><input type="date" data-mu="${x.member_id}" data-nodirty value="${x.valid_until || ''}" title="leer = unbegrenzt"></td>
          <td class="muted s hide-md">${x.last_used ? GK.deTime(x.last_used) : '–'}</td>
          <td class="r" style="white-space:nowrap">${x.device !== 'gekoppelt' ? `<button class="btn small" data-mq="${x.member_id}">QR-Code</button> ` : ''}<button class="btn small" data-mb="${x.member_id}">${x.blocked ? 'Entsperren' : 'Sperren'}</button> <button class="btn small danger" data-mx="${x.member_id}">Entziehen</button></td></tr>`).join('')}</table>`
        : '<p class="empty">Noch niemand freigeschaltet.</p>'}</div>`;
    const reload = () => loadMembers(el).catch(fail);
    const put = (id, body) => api(`app/member/${id}/access`, 'PUT', { module: 'zugang', ...body }).then(() => true);
    const core = (url, m, b) => GK.api(url, m, b);
    void core;
    $('zMemInv').onclick = async () => {
      const id = +$('zMemNew').value; if (!id) return toast('Bitte zuerst ein Mitglied wählen.', true);
      try { await GK.api(`app/member/${id}/access`, 'PUT', { module: 'zugang', grant: true });
        const info = await GK.api('app/member/' + id);
        if (info.device && info.device.status === 'gekoppelt') { toast(`${info.name} freigeschaltet – das Handy ist schon gekoppelt.`); reload(); } else GK.invite(id, reload);
      } catch (e) { fail(e); }
    };
    const row = id => r.rows.find(x => x.member_id === +id);
    el.querySelectorAll('[data-mp]').forEach(s2 => { s2.onchange = async () => { try { await GK.api(`app/member/${s2.dataset.mp}/access`, 'PUT', { module: 'zugang', profile: s2.value }); toast('Zeitprofil geändert.'); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-mu]').forEach(s2 => { s2.onchange = async () => { try { await GK.api(`app/member/${s2.dataset.mu}/access`, 'PUT', { module: 'zugang', valid_until: s2.value || null }); toast(s2.value ? `Gültig bis ${deD(s2.value)}.` : 'Unbegrenzt gültig.'); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-mb]').forEach(b => { b.onclick = async () => { const x = row(b.dataset.mb); try { await GK.api(`app/member/${x.member_id}/access`, 'PUT', { module: 'zugang', blocked: !x.blocked }); toast(x.blocked ? 'Entsperrt.' : 'Gesperrt.'); reload(); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-mq]').forEach(b => { b.onclick = () => GK.invite(+b.dataset.mq, reload); });
    el.querySelectorAll('[data-mx]').forEach(b => { b.onclick = async () => { const x = row(b.dataset.mx); if (!await GK.ask(`${x.name} den Zugang entziehen?\n\nDie Türen verschwinden sofort aus der App. Andere Bereiche (z. B. Beregnung) bleiben.`, { ok: 'Entziehen' })) return; try { await GK.api(`app/member/${x.member_id}/access`, 'PUT', { module: 'zugang', grant: false }); toast('Zugang entzogen.'); reload(); } catch (e) { fail(e); } }; });
    void put;
  }

  /* ---------- Protokoll ---------- */
  async function loadLog() {
    const r = await api('log' + (st.month ? '?month=' + st.month : ''));
    st.month = r.month;
    const A = { auf: ['g', 'Aufgeschlossen'], zu: ['', 'Abgeschlossen'], oeffnen: ['g', 'Geöffnet'], abgelehnt: ['a', 'Abgelehnt'], fehler: ['r', 'Fehler'], freischaltung: ['b', 'Freischaltung'], alarm: ['r', 'Alarm'], sperre: ['a', 'Sperre'] };
    const mName = m => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    $('zLog').innerHTML = `<div class="row" style="margin-bottom:10px"><label class="f">Monat<select id="zMonth" data-nodirty>${r.months.map(m => `<option value="${m}" ${m === r.month ? 'selected' : ''}>${mName(m)}</option>`).join('')}</select></label>
      <a class="btn" href="api/admin/x/zugang/log.xlsx?month=${r.month}">Excel</a></div>
      ${r.rows.length ? `<table class="tbl"><tr><th>Zeitpunkt</th><th>Aktion</th><th>Tür</th><th>Wer</th><th>Hinweis</th></tr>
        ${r.rows.map(x => { const a = A[x.action] || ['', x.action]; return `<tr><td>${dt(x.at)}</td><td><span class="pill ${a[0]}">${a[1]}</span></td><td>${esc(x.door || '')}</td><td>${esc(x.who || '')}</td><td class="muted s">${esc(x.detail || '')}</td></tr>`; }).join('')}</table>`
        : '<p class="empty">Keine Einträge in diesem Monat.</p>'}`;
    $('zMonth').onchange = () => { st.month = $('zMonth').value; loadLog().catch(fail); };
  }

  GK.registerPage({ key: 'zugang', title: 'Zugang', perm: 'zugang', render: GK.RENDER.zugang, order: 6 });
})();
