'use strict';
/* Verwaltungsseite der Erweiterung „Zugang“ */
(() => {
  const GK = window.GK;
  const { $, esc, toast, fail, dialog, closeDialog } = GK;
  const api = (url, method, body) => GK.api('x/zugang/' + url, method, body);
  const DAYS = [['1', 'Montag'], ['2', 'Dienstag'], ['3', 'Mittwoch'], ['4', 'Donnerstag'], ['5', 'Freitag'], ['6', 'Samstag'], ['0', 'Sonntag']];
  const TYPE = { lock: 'Schloss', impulse: 'Türöffner (Impuls)', cover: 'Tor / Antrieb' };   // kurz, damit nichts im Auswahlfeld abgeschnitten wird
  const TDOM = { lock: ['lock'], impulse: ['switch', 'button'], cover: ['cover'] };
  const st = { d: null, c: null, month: null, fil: 'alle' };
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

  /* ---------- Konfiguration laden und speichern ---------- */
  async function loadCfg() { const d = await api('config'); st.d = d; st.c = JSON.parse(JSON.stringify(d.cfg)); return d; }
  /** Nur die genannten Teile der Einrichtung speichern (Türen, Zeitprofile, Sperrtage …) */
  async function saveCfg(part, msg = 'Gespeichert.') {
    try { const r = await api('config', 'PUT', Object.fromEntries(part.map(k => [k, st.c[k]]))); st.d.cfg = r.cfg; st.c = JSON.parse(JSON.stringify(r.cfg)); GK.clean(); toast(msg); return true; }
    catch (e) { fail(e); return false; }
  }
  const goCfg = (a, page) => { a.onclick = e => { e.preventDefault(); GK.go(page); }; };
  const haBanner = err => (err ? `<div class="banner r"><span>Keine Verbindung zu Home Assistant: ${esc(err)}</span>${GK.can('zugang') ? '<a href="#zugang-einstellungen" data-zgo="zugang-einstellungen">Einstellungen › Anbindung prüfen →</a>' : ''}</div>` : '');
  const bindGo = root => root.querySelectorAll('[data-zgo]').forEach(a => goCfg(a, a.dataset.zgo));
  /** Rückfrage im selben Fenster: ersetzt den Inhalt des offenen Fensters durch Frage und Knöpfe „Abbrechen | <ok>“ */
  function confirmIn(title, text, okLabel, onOk, back) {
    $('dialog').innerHTML = `<h2>${esc(title)}</h2><p class="muted" style="white-space:pre-line">${esc(text)}</p>
      <div class="btns"><button class="btn" id="zcX">Abbrechen</button><button class="btn danger" id="zcOk">${esc(okLabel)}</button></div>`;
    $('zcX').onclick = back;
    $('zcOk').onclick = () => GK.busy($('zcOk'), onOk);
  }

  /* ---------- Reiter „Bedienen“ ---------- */
  async function renderBedienen() {
    const r = await api('doors'), blockAll = r.blockAll;
    $('main').innerHTML = `<h2 class="page">Bedienen</h2>
      <p class="lead">Türen und Tore aus der Ferne öffnen. Mitglieder öffnen sie in der Mitglieder-App mit ihrer PIN.</p>
      ${r.error ? `<div class="banner r"><span>Keine Verbindung zu Home Assistant: ${esc(r.error)}</span>${GK.can('zugang') ? '<a href="#zugang-einstellungen" data-zgo="zugang-einstellungen">Einstellungen › Anbindung prüfen →</a>' : ''}</div>` : ''}
      ${blockAll ? '<div class="banner r">Zugang ist für alle gesperrt. Niemand kann über die App öffnen – nur die Fernbedienung hier.</div>' : ''}
      <div class="card"><h3>Türen</h3><div id="zRemote"><p class="muted">Lade …</p></div></div>
      <div class="card"><h3>Notfall</h3><div class="row" style="align-items:center"><button class="btn ${blockAll ? 'primary' : 'danger'}" id="zBlockAll">${blockAll ? 'Sperre für alle aufheben' : 'Sofort alle sperren'}</button>
        <span class="muted s" style="flex:1;min-width:220px">Sperrt die App für alle Mitglieder (z. B. bei Verlust oder Missbrauch). Die Fernbedienung oben funktioniert weiter.</span></div></div>`;
    bindGo($('main'));
    $('zBlockAll').onclick = async () => {
      if (!blockAll && !await GK.ask('Zugang für alle sperren?\n\nNiemand kann dann über die App öffnen, bis du die Sperre aufhebst.', { ok: 'Alle sperren', danger: true })) return;
      try { await api('block-all', 'PUT', { on: !blockAll }); toast(blockAll ? 'Sperre aufgehoben.' : 'Zugang für alle gesperrt.'); renderBedienen().catch(fail); } catch (e) { fail(e); }
    };
    return loadRemote(r);
  }

  /* ---------- Reiter „Freischaltungen“ ---------- */
  const STAT = { gekoppelt: ['g', 'Handy freigeschaltet'], eingeladen: ['a', 'QR-Code offen'], abgelaufen: ['r', 'QR-Code abgelaufen'], 'ohne Handy': ['', 'ohne Handy'] };
  const FIL = { alle: () => true, mit: x => x.device === 'gekoppelt', ohne: x => x.device !== 'gekoppelt', gesperrt: x => x.blocked };
  async function renderFreischaltungen() {
    const r = await api('members');
    const rows = r.rows.filter(FIL[st.fil] || FIL.alle);
    const profName = id => (r.profiles.find(p => p.id === id) || {}).name || '';
    const reload = () => renderFreischaltungen().catch(fail);
    $('main').innerHTML = `<h2 class="page">Freischaltungen</h2>
      <p class="lead">Wer Türen in der Mitglieder-App öffnen darf – mit Zeitprofil, Gültigkeit und Sperre. Das ist der einzige Ort dafür.</p>
      <div class="card" id="zMem"><h3>Freigeschaltet <span class="muted s">(${r.rows.length})</span></h3>
      ${r.rows.length ? `<div class="chips" id="zFil" role="group" aria-label="Filter" style="margin-bottom:10px">${[['alle', 'Alle'], ['mit', 'mit Handy'], ['ohne', 'ohne Handy'], ['gesperrt', 'gesperrt']].filter(([k]) => k !== 'gesperrt' || r.rows.some(FIL.gesperrt))
          .map(([k, l]) => `<button type="button" data-f="${k}" class="${st.fil === k ? 'on' : ''}">${l} <span class="cnt">${r.rows.filter(FIL[k]).length}</span></button>`).join('')}</div>
        ${rows.length ? `<table class="tbl kompakt"><tr><th>Mitglied</th><th>Handy</th><th>Zeitprofil</th><th class="hide-md">zuletzt</th><th></th></tr>
        ${rows.map(x => `<tr${x.blocked ? ' class="off"' : ''}><td class="k-1z"><b>${esc(GK.lastFirst(x.name))}</b>${x.blocked ? ' <span class="pill r">gesperrt</span>' : ''}</td><td><span class="pill ${STAT[x.device][0]}">${STAT[x.device][1]}</span></td>
          <td>${esc(profName(x.profile))}${x.valid_until ? ` · bis ${deD(x.valid_until)}` : ''}${x.away ? ' · auch unterwegs' : ''}</td>
          <td class="muted s hide-md num">${x.last_used ? GK.deTime(x.last_used) : ''}</td>
          <td class="r"><span class="acts">${x.device !== 'gekoppelt' ? `<button class="btn small" data-mq="${x.member_id}">QR-Code</button>` : ''}<button class="btn small" data-me="${x.member_id}">Bearbeiten</button></span></td></tr>`).join('')}</table>`
          : '<p class="empty">Niemand in dieser Auswahl.</p>'}`
        : '<p class="empty">Noch niemand freigeschaltet – oben auf „+ Mitglied freischalten“.</p>'}</div>`;
    GK.tabTools('<button class="btn primary" id="zMemNew">+ Mitglied freischalten</button>', $('zMem'));
    $('main').querySelectorAll('#zFil [data-f]').forEach(b => { b.onclick = () => { st.fil = b.dataset.f; reload(); }; });
    $('main').querySelectorAll('[data-mq]').forEach(b => { b.onclick = () => GK.invite(+b.dataset.mq, reload); });
    $('main').querySelectorAll('[data-me]').forEach(b => { b.onclick = () => memberDialog(r, r.rows.find(x => x.member_id === +b.dataset.me), reload); });
    $('zMemNew').onclick = () => {
      const def = r.profiles.find(p => p.isDefault);
      dialog(`<h2>Mitglied freischalten</h2>
        <label class="f">Mitglied (bekommt das Standardprofil „${esc(def ? def.name : '')}“)<select id="zMemSel"><option value="">– Mitglied wählen –</option>
          ${r.members.map(m => `<option value="${m.id}">${esc(GK.lastFirst(m.name))}${m.kind === 'nichtmitglied' ? ' (Trainer)' : ''}</option>`).join('')}</select></label>
        <p class="muted s">Danach erscheint der QR-Code für die Mitglieder-App. Wer schon ein freigeschaltetes Handy hat, braucht keinen neuen.</p>
        <div class="btns"><button class="btn" id="zMemX">Abbrechen</button><button class="btn primary" id="zMemOk">Freischalten</button></div>`);
      $('zMemX').onclick = closeDialog;
      $('zMemOk').onclick = () => GK.busy($('zMemOk'), async () => {
        const id = +$('zMemSel').value; if (!id) return toast('Bitte zuerst ein Mitglied wählen.', true);
        try { await GK.api(`app/member/${id}/access`, 'PUT', { module: 'zugang', grant: true });
          const info = await GK.api('app/member/' + id);
          closeDialog();
          if (info.device && info.device.status === 'gekoppelt') { toast(`${info.name} freigeschaltet – das Handy ist schon gekoppelt.`); reload(); } else GK.invite(id, reload);
        } catch (e) { fail(e); }
      });
    };
  }
  /** Zeitprofil, gültig bis, „unterwegs“, Sperre – und unten abgesetzt: Zugang entziehen */
  function memberDialog(r, x, reload) {
    const put = body => GK.api(`app/member/${x.member_id}/access`, 'PUT', { module: 'zugang', ...body });
    const form = () => {
      dialog(`<h2>${esc(GK.lastFirst(x.name))}</h2>
        <div class="row"><label class="f" style="flex:1;min-width:200px">Zeitprofil<select id="zmP">${r.profiles.map(p => `<option value="${p.id}" ${p.id === x.profile ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
          <label class="f" style="flex:1;min-width:200px">Gültig bis (leer = unbegrenzt)<input type="date" id="zmU" value="${x.valid_until || ''}"></label></div>
        <label class="chk" style="margin-top:12px"><input type="checkbox" id="zmA" ${x.away ? 'checked' : ''}> Auch von unterwegs öffnen (sonst nur im Vereinsnetz)</label>
        <label class="chk" style="margin-top:8px"><input type="checkbox" id="zmB" ${x.blocked ? 'checked' : ''}> Gesperrt (die Freischaltung bleibt, öffnen geht nicht)</label>
        <div class="row" style="margin-top:18px"><button class="btn danger" id="zmDel">Zugang entziehen …</button></div>
        <div class="btns"><button class="btn" id="zmX">Abbrechen</button><button class="btn primary" id="zmOk">Speichern</button></div>`);
      $('zmX').onclick = closeDialog;
      $('zmDel').onclick = () => confirmIn(`${GK.lastFirst(x.name)}: Zugang entziehen?`, 'Die Türen verschwinden sofort aus der App. Andere Bereiche (z. B. Beregnung) bleiben.', 'Zugang entziehen', async () => {
        try { await put({ grant: false }); closeDialog(); toast('Zugang entzogen.'); reload(); } catch (e) { fail(e); }
      }, form);
      $('zmOk').onclick = () => GK.busy($('zmOk'), async () => {
        try {
          if ($('zmP').value !== x.profile) await put({ profile: $('zmP').value });
          if ($('zmU').value !== (x.valid_until || '')) await put({ valid_until: $('zmU').value || null });
          if ($('zmA').checked !== Boolean(x.away)) await put({ away: $('zmA').checked });
          if ($('zmB').checked !== Boolean(x.blocked)) await put({ blocked: $('zmB').checked });
          closeDialog(); toast('Gespeichert.'); reload();
        } catch (e) { fail(e); }
      });
    };
    form();
  }

  /* ---------- Reiter „Türen“ ---------- */
  async function renderTueren() {
    const d = await loadCfg(), c = st.c;
    const devName = (doms, ref) => { if (!ref) return ''; const x = doms.flatMap(m => (d.devices && d.devices[m]) || []).find(y => y.ref === ref); return x ? x.name : `${ref} – fehlt`; };
    $('main').innerHTML = `<h2 class="page">Türen</h2>
      <p class="lead">Die Türen, Tore und Schlösser, die Zugang aus Home Assistant bedient. Die Reihenfolge gilt auch in der App.</p>
      ${haBanner(d.error)}
      <div class="card" id="zDoorsBox"><h3>Türen, Tore &amp; Schlösser</h3>
      ${c.doors.length ? `<table class="tbl kompakt"><tr><th>Name</th><th>Art</th><th>Gerät in Home Assistant</th><th>Türkontakt</th><th></th></tr>
        ${c.doors.map((x, i) => `<tr><td class="k-1z"><b>${esc(x.name)}</b></td><td>${esc(TYPE[x.type] || '')}</td><td>${esc(devName(TDOM[x.type] || [], x.ref))}</td><td>${esc(devName(['binary_sensor'], x.sensor))}</td>
          <td class="r"><span class="acts"><button class="btn small" data-du="${i}" ${i === 0 ? 'disabled' : ''} aria-label="nach oben">↑</button><button class="btn small" data-dd="${i}" ${i === c.doors.length - 1 ? 'disabled' : ''} aria-label="nach unten">↓</button><button class="btn small" data-de="${i}">Bearbeiten</button></span></td></tr>`).join('')}</table>`
        : '<p class="empty">Noch keine Türen – oben auf „+ Tür“.</p>'}</div>`;
    GK.tabTools('<button class="btn primary" id="zDAdd">+ Tür</button>', $('zDoorsBox'));
    const again = () => renderTueren().catch(fail);
    const move = async (i, j) => { [c.doors[i], c.doors[j]] = [c.doors[j], c.doors[i]]; if (await saveCfg(['doors'], 'Reihenfolge gespeichert.')) again(); };
    $('main').querySelectorAll('[data-du]').forEach(b => { b.onclick = () => move(+b.dataset.du, +b.dataset.du - 1); });
    $('main').querySelectorAll('[data-dd]').forEach(b => { b.onclick = () => move(+b.dataset.dd, +b.dataset.dd + 1); });
    $('main').querySelectorAll('[data-de]').forEach(b => { b.onclick = () => doorDialog(+b.dataset.de, again); });
    $('zDAdd').onclick = () => doorDialog(null, again);
  }
  function doorDialog(i, again) {
    const c = st.c, isNew = i === null;
    const cur = isNew ? { id: '', name: `Tür ${c.doors.length + 1}`, type: 'lock', ref: '', sensor: '', pulseSec: 3 } : { ...c.doors[i] };
    const form = () => {
      dialog(`<h2>${isNew ? 'Tür anlegen' : esc(cur.name)}</h2>
        <div class="row"><label class="f" style="flex:1;min-width:200px">Name<input id="zdN" maxlength="30" value="${esc(cur.name)}" placeholder="z. B. Haustür"></label>
          <label class="f" style="flex:1;min-width:200px">Art<select id="zdT">${Object.entries(TYPE).map(([k, v]) => `<option value="${k}" ${cur.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
        <div class="row" style="margin-top:12px"><label class="f" style="flex:1;min-width:200px">Gerät in Home Assistant<select id="zdR">${devOptions(TDOM[cur.type], cur.ref, '– Gerät wählen –')}</select></label>
          <label class="f" style="flex:1;min-width:200px">Türkontakt (optional)<select id="zdS">${devOptions(['binary_sensor'], cur.sensor, '– keiner –')}</select></label></div>
        <div class="row" style="margin-top:12px${cur.type === 'impulse' ? '' : ';display:none'}" id="zdPw"><label class="f" style="width:160px">Impuls (Sekunden)<input id="zdP" inputmode="numeric" value="${cur.pulseSec || 3}"></label></div>
        ${isNew ? '' : '<div class="row" style="margin-top:18px"><button class="btn danger" id="zdDel">Tür entfernen …</button></div>'}
        <div class="btns"><button class="btn" id="zdX">Abbrechen</button><button class="btn primary" id="zdOk">Speichern</button></div>`);
      $('zdX').onclick = closeDialog;
      $('zdT').onchange = () => { cur.name = $('zdN').value; cur.type = $('zdT').value; cur.ref = ''; cur.pulseSec = +$('zdP').value || 3; form(); };
      if (!isNew) $('zdDel').onclick = () => confirmIn(`„${cur.name}“ entfernen?`, 'Die Tür verschwindet aus der App und aus den Zeitprofilen.', 'Tür entfernen', async () => {
        c.doors.splice(i, 1);
        if (await saveCfg(['doors'], 'Tür entfernt.')) { closeDialog(); again(); }
      }, form);
      $('zdOk').onclick = () => GK.busy($('zdOk'), async () => {
        const next = { ...cur, name: $('zdN').value, type: $('zdT').value, ref: $('zdR').value, sensor: $('zdS').value, pulseSec: +$('zdP').value || 3 };
        if (isNew) c.doors.push(next); else c.doors[i] = next;
        if (await saveCfg(['doors'])) { closeDialog(); again(); }
      });
    };
    form();
  }

  /* ---------- Reiter „Zeitprofile“ ---------- */
  function profilesHtml() {
    const c = st.c;
    return c.profiles.map((p, i) => `<div class="card" data-prof="${i}">
      <div class="row" style="align-items:flex-end;flex-wrap:nowrap">
        <label class="f" style="flex:1 1 180px;min-width:180px">Name<input data-pn="${i}" maxlength="30" value="${esc(p.name)}"></label>
        <label class="row" style="align-items:center;gap:8px;flex-wrap:nowrap;min-height:40px;margin:0"><input type="radio" name="zDef" data-pdef="${i}" ${p.isDefault ? 'checked' : ''} style="width:20px;height:20px;flex:none"> <span>Standard bei neuer Freischaltung</span></label>
        <button class="btn small danger" data-px="${i}" ${c.profiles.length < 2 ? 'disabled' : ''}>Profil löschen …</button>
      </div>
      <div class="f" style="margin-top:12px"><span>Türen</span><div class="row" style="align-items:center;gap:8px 18px;flex-wrap:wrap">
        <label class="chk"><input type="checkbox" data-pall="${i}" ${p.doors === 'all' ? 'checked' : ''}> Alle (auch künftige)</label>
        ${c.doors.map(d => `<label class="chk"><input type="checkbox" data-pd="${i}" value="${d.id}" ${p.doors === 'all' || (p.doors || []).includes(d.id) ? 'checked' : ''} ${p.doors === 'all' ? 'disabled' : ''}> ${esc(d.name)}</label>`).join('')}
      </div></div>
      <table class="tbl kompakt" style="margin-top:12px"><tr><th style="width:130px">Tag</th><th>Zeiten</th></tr>
        ${DAYS.map(([k, n]) => `<tr><td>${n}</td><td><input class="num" data-pw="${i}.${k}" value="${esc(winText((p.windows || {})[k]))}" placeholder="geschlossen" style="width:100%"></td></tr>`).join('')}
      </table>
      <p class="muted s" style="margin:8px 0 0">Zeiten wie 07:00–23:00, mehrere mit Komma; leer = geschlossen; „ganztägig“ = rund um die Uhr.</p>
      <div class="row" style="margin-top:8px"><button class="btn small" data-pcopy="${i}">Montag auf alle Tage übertragen</button><button class="btn small" data-pwork="${i}">Montag auf Mo–Fr übertragen</button></div>
      <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" data-psave="${i}">Speichern</button></div>
    </div>`).join('');
  }
  /** Eingaben der Zeitprofile aus dem Formular in st.c übernehmen */
  function readProfiles() {
    const c = st.c;
    const each = (attr, fn) => document.querySelectorAll(`[data-${attr}]`).forEach(e => fn(e, e.dataset[attr]));
    each('pn', (e, i) => { c.profiles[+i].name = e.value; });
    each('pdef', (e, i) => { c.profiles[+i].isDefault = e.checked; });
    c.profiles.forEach((p, i) => {
      const all = document.querySelector(`[data-pall="${i}"]`);
      if (all) p.doors = all.checked ? 'all' : [...document.querySelectorAll(`[data-pd="${i}"]`)].filter(x => x.checked).map(x => x.value);
    });
    const winErr = [];
    each('pw', (e, k) => { const [i, d] = k.split('.'); try { c.profiles[+i].windows = c.profiles[+i].windows || {}; c.profiles[+i].windows[d] = parseWin(e.value, DAYS.find(x => x[0] === d)[1], c.profiles[+i].name); } catch (er) { winErr.push(er.message); } });
    if (winErr.length) throw new Error(winErr[0]);
  }
  async function renderProfile() {
    await loadCfg();
    const c = st.c;
    $('main').innerHTML = `<h2 class="page">Zeitprofile</h2>
      <p class="lead">Wann und welche Türen. Das Standardprofil bekommt jedes neu freigeschaltete Mitglied automatisch.</p>
      <div id="zProfiles"></div>`;
    const draw = () => {
      $('zProfiles').innerHTML = profilesHtml(); GK.watch($('zProfiles'));
      const on = (attr, fn) => $('zProfiles').querySelectorAll(`[data-${attr}]`).forEach(b => { b.onclick = () => { try { readProfiles(); } catch (e) { /* beim Umbauen egal */ } fn(+b.dataset[attr]); }; });
      on('pcopy', i => { const w = c.profiles[i].windows; for (const d of ['0', '2', '3', '4', '5', '6']) w[d] = (w['1'] || []).map(x => [...x]); draw(); });
      on('pwork', i => { const w = c.profiles[i].windows; for (const d of ['2', '3', '4', '5']) w[d] = (w['1'] || []).map(x => [...x]); draw(); });
      on('px', i => {
        const p = c.profiles[i];
        GK.ask(`Zeitprofil „${p.name}“ löschen?\n\nMitglieder mit diesem Profil bekommen das Standardprofil.`, { ok: 'Profil löschen', danger: true }).then(async yes => {
          if (!yes) return;
          c.profiles.splice(i, 1);
          if (!c.profiles.some(x => x.isDefault)) c.profiles[0].isDefault = true;
          if (await saveCfg(['profiles'], 'Zeitprofil gelöscht.')) draw();
        });
      });
      on('psave', async () => { try { readProfiles(); } catch (e) { return fail(e); } if (await saveCfg(['profiles'])) draw(); });
      $('zProfiles').querySelectorAll('[data-pall]').forEach(s => { s.onchange = () => { try { readProfiles(); } catch (e) { /* egal */ } draw(); }; });
    };
    $('zProfiles').innerHTML = '';
    GK.tabTools('<button class="btn primary" id="zPAdd">+ Zeitprofil</button>', $('zProfiles'));
    $('zPAdd').onclick = () => { try { readProfiles(); } catch (e) { /* egal */ } c.profiles.push({ id: '', name: 'Neues Profil', doors: 'all', windows: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(x => [x, [['07:00', '23:00']]])), isDefault: false }); draw(); };
    draw();
  }

  /* ---------- Reiter „Sperrtage“ ---------- */
  async function renderSperrtage() {
    await loadCfg();
    const c = st.c, days = c.blockDays;
    const span = b => (b.to && b.to !== b.from ? `${deD(b.from)} – ${deD(b.to)}` : deD(b.from));
    $('main').innerHTML = `<h2 class="page">Sperrtage</h2>
      <p class="lead">An diesen Tagen öffnet die App für niemanden, z. B. bei Platzsanierung oder Betriebsferien.</p>
      <div class="card" id="zBlockBox"><h3>Sperrzeiträume</h3>
      ${days.length ? `<table class="tbl kompakt"><tr><th>Zeitraum</th><th>Grund</th><th></th></tr>
        ${days.map((b, i) => `<tr><td class="k-1z"><b class="num">${span(b)}</b></td><td>${esc(b.note || '')}</td><td class="r"><button class="btn small" data-be="${i}">Bearbeiten</button></td></tr>`).join('')}</table>`
        : '<p class="empty">Keine Sperrtage – oben auf „+ Sperrzeitraum“.</p>'}</div>`;
    GK.tabTools('<button class="btn primary" id="zBAdd">+ Sperrzeitraum</button>', $('zBlockBox'));
    const again = () => renderSperrtage().catch(fail);
    $('zBAdd').onclick = () => blockDialog(null, again);
    $('main').querySelectorAll('[data-be]').forEach(b => { b.onclick = () => blockDialog(+b.dataset.be, again); });
  }
  function blockDialog(i, again) {
    const c = st.c, isNew = i === null, t = new Date().toISOString().slice(0, 10);
    const cur = isNew ? { from: t, to: t, note: '' } : c.blockDays[i];
    const form = () => {
      dialog(`<h2>${isNew ? 'Sperrzeitraum anlegen' : 'Sperrzeitraum bearbeiten'}</h2>
        <div class="row"><label class="f" style="flex:1;min-width:150px">Von<input type="date" id="zbF" value="${cur.from}"></label><label class="f" style="flex:1;min-width:150px">Bis<input type="date" id="zbT" value="${cur.to || cur.from}"></label></div>
        <label class="f" style="margin-top:12px">Grund (optional)<input id="zbN" maxlength="60" value="${esc(cur.note || '')}" placeholder="z. B. Platzsanierung"></label>
        ${isNew ? '' : '<div class="row" style="margin-top:18px"><button class="btn danger" id="zbDel">Sperrzeitraum aufheben …</button></div>'}
        <div class="btns"><button class="btn" id="zbX">Abbrechen</button><button class="btn primary" id="zbOk">Speichern</button></div>`);
      $('zbX').onclick = closeDialog;
      if (!isNew) $('zbDel').onclick = () => confirmIn('Sperrzeitraum aufheben?', `${deD(cur.from)}${cur.to && cur.to !== cur.from ? ' – ' + deD(cur.to) : ''}: Die App öffnet an diesen Tagen wieder.`, 'Sperrzeitraum aufheben', async () => {
        c.blockDays.splice(i, 1);
        if (await saveCfg(['blockDays'], 'Sperrzeitraum aufgehoben.')) { closeDialog(); again(); }
      }, form);
      $('zbOk').onclick = () => GK.busy($('zbOk'), async () => {
        const next = { from: $('zbF').value, to: $('zbT').value || $('zbF').value, note: $('zbN').value };
        if (isNew) c.blockDays.push(next); else c.blockDays[i] = next;
        if (await saveCfg(['blockDays'])) { closeDialog(); again(); }
      });
    };
    form();
  }

  /* ---------- Reiter „Einstellungen“ ---------- */
  async function renderEinstellungen() {
    const d = await loadCfg(), c = st.c;
    const vend = d.vendors.find(v => v.id === c.vendor) || d.vendors[d.vendors.length - 1];
    const setupText = v => `Einrichtung: in Home Assistant unter Einstellungen → Geräte &amp; Dienste die <b>${esc(v.setup)}</b> hinzufügen. Schlösser erscheinen als <code>lock.*</code>, Relais/Türöffner als <code>switch.*</code> oder <code>button.*</code>, Torantriebe als <code>cover.*</code>.`;
    $('main').innerHTML = `<h2 class="page">Einstellungen</h2>
      <p class="lead">Anbindung an Home Assistant, Schutz vor Zugriffen von außen und Hinweise bei Störungen.</p>
      ${haBanner(d.error)}
      <div class="card"><h3>Anbindung</h3>
        <label class="f" style="max-width:420px">Hersteller (filtert die Geräteliste in „Türen“)<select id="zVendor">${d.vendors.map(v => `<option value="${v.id}" ${v.id === c.vendor ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
        <p class="muted s" id="zVendHint" style="margin:8px 0 0">${setupText(vend)}</p>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="zSaveV">Speichern</button></div></div>
      <div class="card"><h3>Sicherheit</h3>
        <label class="chk"><input type="checkbox" id="zWlan" ${c.wlanOnly ? 'checked' : ''}> Öffnen nur aus dem Vereinsnetz (Anfragen aus dem Internet werden abgelehnt)</label>
        <p class="muted s" style="margin:8px 0 0">Welche Adressen als Vereinsnetz gelten, stellst du zentral ein${GK.can('einstellungen') ? ' unter <a href="#einstellungen" id="zNetLink">Einstellungen › Erreichbarkeit</a>' : ' (Einstellungen › Erreichbarkeit, nur mit Recht „Einstellungen“)'}.</p>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="zSaveS">Speichern</button></div></div>
      <div class="card"><h3>Benachrichtigungen</h3>
        <div class="row"><label class="f" style="flex:1;min-width:240px">Bei Störung oder offener Tür melden an (optional)<input id="zNotify" value="${esc(c.notify || '')}" placeholder="z. B. mobile_app_handy_vorstand"></label>
          <label class="f" style="flex:1;min-width:240px">Tür länger offen als … Minuten melden (0 = aus)<input id="zAlert" inputmode="numeric" value="${c.openAlertMin || 0}"></label></div>
        <p class="muted s" style="margin:8px 0 0">Der Empfänger ist der Name des Handys in Home Assistant (Mitteilungsdienst „notify“).</p>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="zSaveN">Speichern</button></div></div>
      <div id="zFunc"></div>`;
    GK.watch($('main'));
    $('zVendor').onchange = () => { const v = d.vendors.find(x => x.id === $('zVendor').value); if (v) $('zVendHint').innerHTML = setupText(v); };
    if ($('zNetLink')) $('zNetLink').onclick = e => { e.preventDefault(); GK.openSettings('erreichbar'); };
    // jede Karte schreibt nur ihre eigenen Felder
    const only = (id, keys) => { $(id).onclick = async () => { const cc = st.c; cc.vendor = $('zVendor').value; cc.wlanOnly = $('zWlan').checked; cc.notify = $('zNotify').value; cc.openAlertMin = $('zAlert').value; if (await saveCfg(keys)) renderEinstellungen().catch(fail); }; };
    only('zSaveV', ['vendor']); only('zSaveS', ['wlanOnly']); only('zSaveN', ['notify', 'openAlertMin']);
    if (GK.funcBox) GK.funcBox($('zFunc'), 'zugang', 'Zugang', () => renderEinstellungen().catch(fail));
  }

  /* ---------- Fernbedienung ---------- */
  /** Türen aus der Ferne bedienen – dieselben Kacheln wie in der Mitglieder-App und am Tablet (doors.js + kit.css; die Verwaltung lädt doors.js vor admin.js) */
  async function loadRemote(r0) {
    const r = r0 || await api('doors');
    if (!r.doors.length) { $('zRemote').innerHTML = `<p class="empty">Noch keine Türen eingerichtet.${GK.can('zugang') ? ' <a class="btn small" href="#zugang-tueren" data-zgo="zugang-tueren">Türen einrichten</a>' : ''}</p>`; bindGo($('zRemote')); return; }
    $('zRemote').innerHTML = `<div class="vh-tiles doors">${window.ZugangDoors.html(r.doors, esc, false)}</div>`;
    $('zRemote').querySelectorAll('[data-d]').forEach(b => { b.onclick = async () => {
      const d = r.doors.find(x => x.id === b.dataset.d), a = b.dataset.a, lab = window.ZugangDoors.label(d, a);
      if (!await GK.ask(`${d.name}: ${lab}?\n\nWird sofort aus der Ferne ausgeführt und protokolliert.`, { ok: lab, danger: false })) return;
      b.disabled = true;
      try { await api(`doors/${d.id}/${a}`, 'POST', {}); toast('Befehl gesendet.'); setTimeout(() => loadRemote().catch(fail), 1500); } catch (e) { fail(e); b.disabled = false; }
    }; });
  }

  /* ---------- Reiter „Verlauf“ ---------- */
  async function renderVerlauf() {
    $('main').innerHTML = `<h2 class="page">Verlauf</h2>
      <p class="lead">Wer wann welche Tür geöffnet, geschlossen oder gesperrt hat – auch abgelehnte Versuche.</p>
      <div class="card" id="zLog"></div>`;
    return loadLog();
  }
  async function loadLog() {
    const r = await api('log' + (st.month ? '?month=' + st.month : ''));
    st.month = r.month;
    const A = { auf: ['g', 'Aufgeschlossen'], zu: ['', 'Abgeschlossen'], oeffnen: ['g', 'Geöffnet'], abgelehnt: ['a', 'Abgelehnt'], fehler: ['r', 'Fehler'], freischaltung: ['b', 'Freischaltung'], alarm: ['r', 'Alarm'], sperre: ['a', 'Sperre'] };
    const mName = m => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    $('zLog').innerHTML = `<div class="row" style="margin-bottom:10px"><label class="f">Monat<select id="zMonth" data-nodirty>${r.months.map(m => `<option value="${m}" ${m === r.month ? 'selected' : ''}>${mName(m)}</option>`).join('')}</select></label></div>
      ${r.rows.length ? `<table class="tbl kompakt"><tr><th>Zeitpunkt</th><th>Aktion</th><th>Tür</th><th>Wer</th><th>Hinweis</th></tr>
        ${r.rows.map(x => { const a = A[x.action] || ['', x.action]; return `<tr><td class="k-1z num">${dt(x.at)}</td><td><span class="pill ${a[0]}">${a[1]}</span></td><td>${esc(x.door || '')}</td><td>${esc(x.who || '')}</td><td class="muted s" title="${esc(x.detail || '')}">${esc(x.detail || '')}</td></tr>`; }).join('')}</table>`
        : '<p class="empty">Keine Einträge in diesem Monat.</p>'}`;
    GK.tabTools(`<a class="btn" href="api/admin/x/zugang/log.xlsx?month=${r.month}">Excel</a>`, $('zLog'));
    $('zMonth').onchange = () => { st.month = $('zMonth').value; loadLog().catch(fail); };
  }

  /* Reiter: Bedienen · Freischaltungen · Türen · Zeitprofile · Sperrtage · Verlauf · Einstellungen (nur „Bedienen“ mit dem Recht „Zugang bedienen“) */
  const G = { key: 'zugang', label: 'Zugang', icon: 'zugang', order: 6 };
  GK.registerPage({ key: 'zugang', title: 'Bedienen', perm: ['zugang', 'zugang_bedienen'], render: renderBedienen, group: G });
  GK.registerPage({ key: 'zugang-freischaltungen', title: 'Freischaltungen', perm: 'zugang', render: renderFreischaltungen, group: G });
  GK.registerPage({ key: 'zugang-tueren', title: 'Türen', perm: 'zugang', render: renderTueren, group: G });
  GK.registerPage({ key: 'zugang-profile', title: 'Zeitprofile', perm: 'zugang', render: renderProfile, group: G });
  GK.registerPage({ key: 'zugang-sperrtage', title: 'Sperrtage', perm: 'zugang', render: renderSperrtage, group: G });
  GK.registerPage({ key: 'zugang-verlauf', title: 'Verlauf', perm: 'zugang', render: renderVerlauf, group: G });
  GK.registerPage({ key: 'zugang-einstellungen', title: 'Einstellungen', perm: 'zugang', render: renderEinstellungen, group: G });
  // Suche (Strg/⌘ K): Reiter findet sie von selbst, hier Aktionen und Einstellungskarten des Zugangs
  if (GK.registerSearch) GK.registerSearch([
    { label: 'Tür öffnen', page: 'zugang', card: 'Türen', kind: 'aktion', words: 'öffnen Fernöffnung Schloss Fernbedienung' },
    { label: 'Sofort alle Türen sperren', page: 'zugang', btn: 'Sofort alle sperren', kind: 'aktion', words: 'Notfall sperren' },
    { label: 'Mitglied für Türen freischalten', page: 'zugang-freischaltungen', perm: 'zugang', btn: '+ Mitglied freischalten', kind: 'aktion', words: 'Schlüssel QR-Code Freischaltung' },
    { label: 'Zeitprofil, gültig bis, unterwegs oder Sperre eines Mitglieds', page: 'zugang-freischaltungen', perm: 'zugang', kind: 'aktion', words: 'Freischaltung Zeitprofil gültig bis unterwegs sperren entziehen Zugang' },
    { label: 'Tür, Tor oder Schloss anlegen', page: 'zugang-tueren', perm: 'zugang', btn: '+ Tür', kind: 'aktion', words: 'Schloss Tor Hersteller Nuki Türkontakt' },
    { label: 'Zeitprofil anlegen (Öffnungszeiten)', page: 'zugang-profile', perm: 'zugang', btn: '+ Zeitprofil', kind: 'aktion', words: 'Öffnungszeiten Zeiten Profil Standardprofil' },
    { label: 'Sperrzeitraum eintragen (Zugang)', page: 'zugang-sperrtage', perm: 'zugang', btn: '+ Sperrzeitraum', kind: 'aktion', words: 'Sperrtage Ferien geschlossen gesperrt Platzsanierung' },
    { label: 'Zugangsverlauf als Excel', page: 'zugang-verlauf', perm: 'zugang', btn: 'Excel', kind: 'aktion', words: 'Verlauf Protokoll Excel Türprotokoll' },
    { label: 'Hersteller der Türen (Anbindung)', page: 'zugang-einstellungen', perm: 'zugang', card: 'Anbindung', words: 'Hersteller Home Assistant Nuki Matter Yale tedee Shelly' },
    { label: 'Öffnen nur aus dem Vereinsnetz (Zugang)', page: 'zugang-einstellungen', perm: 'zugang', card: 'Sicherheit', words: 'WLAN Vereinsnetz Internet Sicherheit' },
    { label: 'Störung und offene Tür melden', page: 'zugang-einstellungen', perm: 'zugang', card: 'Benachrichtigungen', words: 'Benachrichtigung Störung Tür offen Handy notify' },
    { label: 'Einstellungen des Zugangs übertragen', page: 'zugang-einstellungen', perm: 'zugang', card: 'Einstellungen übertragen', kind: 'aktion', words: 'Export Import Datei' },
  ]);
})();
