'use strict';
/* Verwaltungsseite des Moduls „Flutlicht“: Bedienen · Anlagen · Zeiten · Verlauf · Einstellungen */
(() => {
  const GK = window.GK;
  const { $, esc, toast, fail, dialog, closeDialog } = GK;
  const F = window.FlutlichtTiles;   // licht.js lädt die Verwaltung vor admin.js (erweiterung.json „skripte“)
  const api = (url, method, body) => GK.api('x/flutlicht/' + url, method, body);
  const DAYS = [[1, 'Montag'], [2, 'Dienstag'], [3, 'Mittwoch'], [4, 'Donnerstag'], [5, 'Freitag'], [6, 'Samstag'], [0, 'Sonntag']];
  const st = { d: null, c: null, month: null };
  const deD = d => (d ? d.split('-').reverse().join('.') : '');
  const dt = ts => (ts ? `${ts.slice(8, 10)}.${ts.slice(5, 7)}. ${ts.slice(11, 16)}` : '–');
  const euro = c => F.euro(c);
  const hours = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} Std.`;

  async function loadCfg() { const d = await api('config'); st.d = d; st.c = JSON.parse(JSON.stringify(d.cfg)); return d; }
  async function saveCfg(part, msg = 'Gespeichert.') {
    try { const r = await api('config', 'PUT', Object.fromEntries(part.map(k => [k, st.c[k]]))); st.d.cfg = r.cfg; st.c = JSON.parse(JSON.stringify(r.cfg)); GK.clean(); toast(msg); return true; }
    catch (e) { fail(e); return false; }
  }
  const banners = d => `${d.sim ? '<div class="banner">Beispieldaten: Die Schalter werden nur nachgebildet, Home Assistant wird nicht angesprochen.</div>' : ''}
    ${d.error ? `<div class="banner r"><span>Keine Verbindung zu Home Assistant: ${esc(d.error)}</span></div>` : ''}`;
  const bindGo = root => root.querySelectorAll('[data-go]').forEach(a => { a.onclick = e => { e.preventDefault(); GK.go(a.dataset.go); }; });
  function confirmIn(title, text, okLabel, onOk, back) {
    $('dialog').innerHTML = `<h2>${esc(title)}</h2><p class="muted" style="white-space:pre-line">${esc(text)}</p>
      <div class="btns"><button class="btn" id="flcX">Abbrechen</button><button class="btn danger" id="flcOk">${esc(okLabel)}</button></div>`;
    $('flcX').onclick = back;
    $('flcOk').onclick = () => GK.busy($('flcOk'), onOk);
  }

  /* ---------- Reiter „Bedienen“ ---------- */
  async function renderBedienen() {
    const r = await api('lights');
    $('main').innerHTML = `<h2 class="page">Bedienen</h2>
      <p class="lead">Licht der Plätze von Hand schalten. Es geht immer von selbst wieder aus – spätestens zur Nachtruhe.</p>
      ${banners(r)}
      <div class="card"><h3>Heute</h3><dl class="vh-kv">
        <dt>Dunkel ab</dt><dd class="num">${r.darkFrom ? `${esc(r.darkFrom)} Uhr` : '–'}</dd>
        <dt>Nachtruhe ab</dt><dd class="num">${esc(r.quiet)} Uhr</dd>
        <dt>Automatik (Plätze)</dt><dd>${r.auto ? 'an' : 'aus'}</dd>
        <dt>Lichtgeld</dt><dd>${r.fee ? `${euro(r.fee.cents)} je ¼ Std. ab ${esc(r.fee.from)} Uhr` : 'aus'}</dd></dl>
        ${r.block ? `<p class="muted s" style="margin:10px 0 0">Mitglieder, Tablet und Automatik schalten gerade nicht: ${esc(r.block)}</p>` : ''}</div>
      <div class="card" id="flBox"><h3>Lichtanlagen</h3><div id="flTiles" class="vh-tiles lights"></div>
        <div class="row" style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px;align-items:center"><button class="btn danger" id="flAll">Alles aus</button>
        <span class="muted s" style="flex:1;min-width:220px">Schaltet sofort jedes Licht aus. Die Automatik schaltet erst bei der nächsten Buchung wieder ein.</span></div></div>`;
    if (!r.lights.length) $('flTiles').outerHTML = `<p class="empty">Noch keine Lichtanlagen eingerichtet.${GK.can('flutlicht') ? ' <a class="btn small" href="#flutlicht-anlagen" data-go="flutlicht-anlagen">Lichtanlagen einrichten</a>' : ''}</p>`;
    else $('flTiles').innerHTML = F.html(r.lights, esc, r.extendMin);
    bindGo($('main'));
    $('main').querySelectorAll('[data-l]').forEach(b => { b.onclick = () => act(r, r.lights.find(l => l.id === b.dataset.l), b.dataset.a); });
    $('flAll').disabled = !r.lights.length;
    $('flAll').onclick = async () => {
      if (!await GK.ask('Alles aus?\n\nJedes Licht geht sofort aus. Die Automatik schaltet erst bei der nächsten Buchung wieder ein.', { ok: 'Alles aus', danger: true })) return;
      try { await api('all-off', 'POST', {}); toast('Alles aus.'); } catch (e) { fail(e); }
      renderBedienen().catch(fail);
    };
  }
  function act(r, l, a) {
    const run = async (body = {}) => {
      try { const x = await api(`lights/${l.id}/${a}`, 'POST', body); toast(a === 'off' ? `${l.name}: ausgeschaltet` : `${l.name}: an bis ${x.until.slice(11, 16)} Uhr`); }
      catch (e) { fail(e); }
      renderBedienen().catch(fail);
    };
    if (a !== 'on') return run();
    dialog(`<h2><span translate="no">${esc(l.name)}</span> einschalten</h2>
      <div class="frm"><label class="f">Wie lange?<select id="flMin">${[30, 60, 90, 120, 180, 240, 360, 480].map(m => `<option value="${m}" ${m === 60 ? 'selected' : ''}>${m < 60 ? m + ' Minuten' : m === 60 ? '1 Stunde' : (m / 60) + ' Stunden'}</option>`).join('')}</select></label></div>
      <p class="muted s">Geht danach von selbst aus. Aus der Verwaltung geht das auch nach der Nachtruhe und ohne Lichtgeld.</p>
      <div class="btns"><button class="btn" id="flX">Abbrechen</button><button class="btn primary" id="flOk">Einschalten</button></div>`);
    $('flX').onclick = closeDialog;
    $('flOk').onclick = () => GK.busy($('flOk'), async () => { const minutes = +$('flMin').value; closeDialog(); await run({ minutes }); });
  }

  /* ---------- Reiter „Anlagen“ ---------- */
  async function renderAnlagen() {
    const d = await loadCfg(), c = st.c;
    const court = l => (l.court ? (d.courts.find(x => x.id === l.court.id) || {}).name || (d.buchung ? 'Platz fehlt' : 'Platz (Modul Plätze aus)') : '–');
    $('main').innerHTML = `<h2 class="page">Anlagen</h2>
      <p class="lead">Je Platz ein Schalter in Home Assistant. Der Platz verbindet die Lichtanlage mit der Platzbuchung.</p>
      ${banners(d)}
      <div class="card" id="flLBox"><h3>Lichtanlagen</h3>
      ${c.lights.length ? `<table class="tbl kompakt"><tr><th>Name</th><th>Schalter in Home Assistant</th><th>Platz</th><th>Vorlauf</th><th>Nachlauf</th><th></th></tr>
        ${c.lights.map((l, i) => `<tr><td class="k-1z"><b translate="no">${esc(l.name)}</b></td><td>${esc(l.ref)}${d.devices && !d.devices.some(x => x.ref === l.ref) ? ' – fehlt' : ''}</td><td translate="no">${esc(court(l))}</td>
          <td class="num k-lbl" data-label="Vorlauf">${l.pre} Min.</td><td class="num k-lbl" data-label="Nachlauf">${l.post} Min.</td>
          <td class="r"><span class="acts"><button class="btn small" data-up="${i}" ${i ? '' : 'disabled'} aria-label="nach oben">↑</button><button class="btn small" data-dn="${i}" ${i < c.lights.length - 1 ? '' : 'disabled'} aria-label="nach unten">↓</button><button class="btn small" data-ed="${i}">Bearbeiten</button></span></td></tr>`).join('')}</table>`
        : '<p class="empty">Noch keine Lichtanlage – oben auf „+ Lichtanlage“.</p>'}
      <p class="muted s" style="margin:12px 0 0">Vorlauf: so viele Minuten vor einer Buchung geht das Licht an (manche Strahler brauchen Zeit, bis sie hell sind). Nachlauf: so lange bleibt es nach dem Ende an.</p></div>`;
    GK.tabTools('<button class="btn primary" id="flAdd">+ Lichtanlage</button>', $('flLBox'));
    const again = () => renderAnlagen().catch(fail);
    const move = async (i, j) => { const a = c.lights; [a[i], a[j]] = [a[j], a[i]]; if (await saveCfg(['lights'], 'Reihenfolge gespeichert.')) again(); };
    $('main').querySelectorAll('[data-up]').forEach(b => { b.onclick = () => move(+b.dataset.up, +b.dataset.up - 1); });
    $('main').querySelectorAll('[data-dn]').forEach(b => { b.onclick = () => move(+b.dataset.dn, +b.dataset.dn + 1); });
    $('main').querySelectorAll('[data-ed]').forEach(b => { b.onclick = () => lightDialog(d, +b.dataset.ed, again); });
    $('flAdd').onclick = () => lightDialog(d, -1, again);
  }
  function lightDialog(d, i, again) {
    const c = st.c, isNew = i < 0, cur = isNew ? { name: '', ref: '', court: null, pre: 5, post: 10 } : c.lights[i];
    const taken = new Set(c.lights.filter((l, k) => k !== i && l.court).map(l => l.court.id));
    const devs = d.devices || [];
    const form = () => {
      dialog(`<h2>${isNew ? 'Lichtanlage anlegen' : 'Lichtanlage bearbeiten'}</h2><div class="frm">
        <label class="f">Name<input id="flN" maxlength="30" value="${esc(cur.name)}" placeholder="z. B. Platz 1"></label>
        <label class="f">Schalter in Home Assistant<select id="flR"><option value="">– Schalter wählen –</option>${!devs.some(x => x.ref === cur.ref) && cur.ref ? `<option value="${esc(cur.ref)}" selected>${esc(cur.ref)} – fehlt</option>` : ''}
          ${devs.map(x => `<option value="${esc(x.ref)}" ${x.ref === cur.ref ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label class="f">Platz (für die Automatik)<select id="flC" ${d.buchung ? '' : 'disabled'}><option value="">${d.buchung ? '– kein Platz, nur von Hand –' : 'Modul Plätze ist aus'}</option>
          ${d.courts.map(x => `<option value="${x.id}" ${cur.court && cur.court.id === x.id ? 'selected' : ''} ${taken.has(x.id) ? 'disabled' : ''}>${esc(x.name)}${taken.has(x.id) ? ' (hat schon Licht)' : ''}</option>`).join('')}</select></label>
        <label class="f w1">Vorlauf (Min.)<input id="flPre" class="num" inputmode="numeric" value="${cur.pre}"></label>
        <label class="f w1">Nachlauf (Min.)<input id="flPost" class="num" inputmode="numeric" value="${cur.post}"></label></div>
        <p class="muted s">Schalter: ein Schaltaktor in Home Assistant (switch.* oder light.*), der das Schütz der Strahler schaltet.</p>
        ${isNew ? '' : '<div class="dz"><button class="btn ghost danger" id="flDel">Lichtanlage löschen …</button></div>'}
        <div class="btns"><button class="btn" id="flX">Abbrechen</button><button class="btn primary" id="flOk">Speichern</button></div>`);
      $('flX').onclick = closeDialog;
      if (!isNew) $('flDel').onclick = () => confirmIn(`${cur.name} löschen?`, 'Die Lichtanlage verschwindet aus Verwaltung, App und Tablet. Der Verlauf bleibt.', 'Lichtanlage löschen', async () => {
        c.lights.splice(i, 1);
        if (await saveCfg(['lights'], 'Lichtanlage gelöscht.')) { closeDialog(); again(); }
      }, form);
      $('flOk').onclick = () => GK.busy($('flOk'), async () => {
        const next = { ...cur, name: $('flN').value, ref: $('flR').value, court: $('flC').value ? { src: 'buchung', id: +$('flC').value } : null, pre: $('flPre').value, post: $('flPost').value };
        if (isNew) c.lights.push(next); else c.lights[i] = next;
        if (await saveCfg(['lights'])) { closeDialog(); again(); } else if (isNew) c.lights.pop(); else c.lights[i] = cur;
      });
    };
    form();
  }

  /* ---------- Reiter „Zeiten“ ---------- */
  const mdIn = md => (md ? md.split('-').reverse().join('.') + '.' : '');
  const mdOut = s => { const m = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(String(s || '').trim()); return m ? `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : 'x'; };
  async function renderZeiten() {
    const d = await loadCfg(), c = st.c;
    $('main').innerHTML = `<h2 class="page">Zeiten</h2>
      <p class="lead">Wann es dunkel ist, wann spätestens alles ausgeht und an welchen Tagen das Licht aus bleibt.</p>
      <div class="card"><h3>Dunkelheit</h3><div class="frm">
        <label class="f">Sonnenuntergang<select id="flSrc"><option value="calc" ${c.sun.source === 'calc' ? 'selected' : ''}>Selbst berechnen aus dem Standort</option><option value="ha" ${c.sun.source === 'ha' ? 'selected' : ''}>Aus Home Assistant (sun.sun)</option></select></label>
        <label class="f w1">Breitengrad<input id="flLat" class="num" inputmode="decimal" value="${c.sun.lat ?? ''}" placeholder="z. B. 50,43"></label>
        <label class="f w1">Längengrad<input id="flLon" class="num" inputmode="decimal" value="${c.sun.lon ?? ''}" placeholder="z. B. 8,10"></label>
        <label class="f">Licht ab … Minuten nach Sonnenuntergang (negativ = vorher)<input id="flOff" class="num" inputmode="numeric" value="${c.sun.offset}"></label></div>
        <p class="muted s" style="margin:8px 0 0">${d.sun.today ? `Heute: Sonnenuntergang ${esc(d.sun.sunset)} Uhr → Licht ab <b class="num">${esc(d.sun.today)} Uhr</b>.${d.sun.in4 ? ` In vier Wochen ab ${esc(d.sun.in4)} Uhr.` : ''}` : 'Bitte den Standort eintragen (Breiten- und Längengrad, z. B. aus einer Karten-App).'}</p>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="flSaveSun">Speichern</button></div></div>
      <div class="card"><h3>Nachtruhe</h3><p class="muted s" style="margin-top:0">Um diese Uhrzeit geht alles aus, was Mitglieder, Tablet und Automatik eingeschaltet haben. Die Verwaltung darf länger.</p><div class="frm">
        ${DAYS.map(([k, n]) => `<label class="f w1">${n}<input type="time" id="flQ${k}" class="num" value="${esc(c.quiet[k] === '24:00' ? '00:00' : c.quiet[k])}"></label>`).join('')}<span class="w1"></span></div>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="flSaveQ">Speichern</button></div></div>
      <div class="card"><h3>Saison</h3>
        <label class="chk"><input type="checkbox" id="flSeason" ${c.season ? 'checked' : ''}> Licht nur in der Saison (sonst schaltet nur die Verwaltung)</label>
        <div class="frm" style="margin-top:12px"><label class="f w1">Von (Tag.Monat.)<input id="flSF" class="num" value="${mdIn(c.season && c.season.from) || '01.04.'}"></label><label class="f w1">Bis (Tag.Monat.)<input id="flST" class="num" value="${mdIn(c.season && c.season.to) || '31.10.'}"></label><span class="w1"></span><span class="w1"></span></div>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="flSaveS">Speichern</button></div></div>
      <div class="card" id="flBBox"><h3>Sperrzeiträume</h3>
      ${c.blockDays.length ? `<table class="tbl kompakt"><tr><th>Zeitraum</th><th>Grund</th><th></th></tr>${c.blockDays.map((b, i) => `<tr><td class="k-1z"><b class="num">${deD(b.from)}${b.to !== b.from ? ' – ' + deD(b.to) : ''}</b></td><td translate="no">${esc(b.note || '')}</td><td class="r"><button class="btn small" data-be="${i}">Bearbeiten</button></td></tr>`).join('')}</table>`
        : '<p class="empty">Keine Sperrzeiträume – an allen Tagen darf das Licht an.</p>'}</div>`;
    GK.watch($('main'));
    GK.tabTools('<button class="btn primary" id="flBAdd">+ Sperrzeitraum</button>', $('flBBox'));
    const again = () => renderZeiten().catch(fail);
    const num = v => (String(v).trim() === '' ? null : String(v).replace(',', '.'));
    $('flSaveSun').onclick = async () => { c.sun = { source: $('flSrc').value, lat: num($('flLat').value), lon: num($('flLon').value), offset: $('flOff').value }; if (await saveCfg(['sun'])) again(); };
    $('flSaveQ').onclick = async () => { c.quiet = [0, 1, 2, 3, 4, 5, 6].map(k => ($(`flQ${k}`).value === '00:00' ? '24:00' : $(`flQ${k}`).value)); if (await saveCfg(['quiet'])) again(); };
    $('flSaveS').onclick = async () => { c.season = $('flSeason').checked ? { from: mdOut($('flSF').value), to: mdOut($('flST').value) } : null; if (await saveCfg(['season'])) again(); };
    $('main').querySelectorAll('[data-be]').forEach(b => { b.onclick = () => blockDialog(+b.dataset.be, again); });
    $('flBAdd').onclick = () => blockDialog(-1, again);
  }
  function blockDialog(i, again) {
    const c = st.c, isNew = i < 0, t = GK.today(), cur = isNew ? { from: t, to: t, note: '' } : c.blockDays[i];
    const form = () => {
      dialog(`<h2>${isNew ? 'Sperrzeitraum anlegen' : 'Sperrzeitraum bearbeiten'}</h2>
        <div class="frm"><label class="f">Von<input type="date" id="flBF" value="${cur.from}"></label><label class="f">Bis<input type="date" id="flBT" value="${cur.to || cur.from}"></label>
        <label class="f wall">Grund (optional)<input id="flBN" maxlength="60" value="${esc(cur.note || '')}" placeholder="z. B. Wartung der Masten"></label></div>
        ${isNew ? '' : '<div class="dz"><button class="btn ghost danger" id="flBDel">Sperrzeitraum aufheben …</button></div>'}
        <div class="btns"><button class="btn" id="flBX">Abbrechen</button><button class="btn primary" id="flBOk">Speichern</button></div>`);
      $('flBX').onclick = closeDialog;
      if (!isNew) $('flBDel').onclick = () => confirmIn('Sperrzeitraum aufheben?', `${deD(cur.from)}${cur.to && cur.to !== cur.from ? ' – ' + deD(cur.to) : ''}: Das Licht darf an diesen Tagen wieder an.`, 'Sperrzeitraum aufheben', async () => {
        c.blockDays.splice(i, 1);
        if (await saveCfg(['blockDays'], 'Sperrzeitraum aufgehoben.')) { closeDialog(); again(); }
      }, form);
      $('flBOk').onclick = () => GK.busy($('flBOk'), async () => {
        const next = { from: $('flBF').value, to: $('flBT').value || $('flBF').value, note: $('flBN').value };
        const old = c.blockDays.slice();
        if (isNew) c.blockDays.push(next); else c.blockDays[i] = next;
        if (await saveCfg(['blockDays'])) { closeDialog(); again(); } else c.blockDays = old;
      });
    };
    form();
  }

  /* ---------- Reiter „Verlauf“ ---------- */
  const FEE = { offen: ['a', 'offen'], bezahlt: ['g', 'bezahlt'], eingezogen: ['g', 'eingezogen'], storniert: ['', 'storniert'], 'nicht gebucht': ['r', 'nicht gebucht'] };
  async function renderVerlauf() {
    $('main').innerHTML = `<h2 class="page">Verlauf</h2>
      <p class="lead">Wann welches Licht wie lange brannte, wer es ausgelöst hat und welches Lichtgeld daraus entstand.</p>
      <div class="card" id="flLog"></div><div class="card" id="flHours"></div><div id="flEv"></div>`;
    return loadLog();
  }
  async function loadLog() {
    const r = await api('log' + (st.month ? '?month=' + st.month : ''));
    st.month = r.month;
    const mName = m => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    $('flLog').innerHTML = `<h3>Schaltzeiten</h3><div class="frm" style="margin-bottom:10px"><label class="f">Monat<select id="flMonth" data-nodirty>${r.months.map(m => `<option value="${m}" ${m === r.month ? 'selected' : ''}>${mName(m)}</option>`).join('')}</select></label></div>
      ${r.rows.length ? `<table class="tbl kompakt"><tr><th>Lichtanlage</th><th>Zeit</th><th>Dauer</th><th>Auslöser</th><th>Lichtgeld</th><th></th></tr>
        ${r.rows.map(x => { const f = FEE[x.feeStatus]; return `<tr><td class="k-1z"><b translate="no">${esc(x.light)}</b></td><td class="num">${dt(x.start)}–${esc(x.end.slice(11, 16))}${x.running ? ' <span class="pill g">brennt</span>' : ''}</td>
          <td class="num">${x.minutes === null ? '–' : x.minutes + ' Min.'}</td><td>${esc(x.source)}${x.who ? ` · <span translate="no">${esc(x.who)}</span>` : ''}<span class="k-weg">${x.reason ? ` · ${esc(x.reason)}` : ''}</span></td>
          <td class="num">${x.fee ? `${euro(x.fee)} ${f ? `<span class="pill ${f[0]}">${f[1]}</span>` : ''}` : ''}</td>
          <td class="r">${x.fee && ['offen', 'bezahlt', 'nicht gebucht'].includes(x.feeStatus) ? `<button class="btn small" data-fc="${x.id}">Stornieren</button>` : ''}</td></tr>`; }).join('')}</table>`
        : '<p class="empty">In diesem Monat hat kein Licht gebrannt.</p>'}`;
    $('flHours').innerHTML = `<h3>Betriebsstunden ${esc(r.year)}</h3>${r.hours.length ? `<dl class="vh-kv">${r.hours.map(h => `<dt translate="no">${esc(h.name)}</dt><dd class="num">${hours(h.minutes)}</dd>`).join('')}</dl>` : '<p class="empty">In diesem Jahr hat noch kein Licht gebrannt.</p>'}`;
    const A = { fehler: ['r', 'Störung'], behoben: ['g', 'Behoben'], nachtruhe: ['a', 'Nachtruhe'], 'alles-aus': ['a', 'Alles aus'], abgelehnt: ['', 'Abgelehnt'] };
    $('flEv').innerHTML = r.events.length ? `<div class="card"><h3>Ereignisse</h3><table class="tbl kompakt"><tr><th>Zeitpunkt</th><th>Ereignis</th><th>Lichtanlage</th><th>Hinweis</th></tr>
      ${r.events.map(x => { const a = A[x.action] || ['', x.action]; return `<tr><td class="k-1z num">${dt(x.at)}</td><td><span class="pill ${a[0]}">${a[1]}</span></td><td translate="no">${esc(x.light || '')}</td><td class="muted s" title="${esc(x.detail || '')}">${esc([x.who, x.detail].filter(Boolean).join(': '))}</td></tr>`; }).join('')}</table></div>` : '';
    GK.tabTools(`<a class="btn" href="api/admin/x/flutlicht/log.xlsx?month=${r.month}">Excel</a>`, $('flLog'));
    $('flMonth').onchange = () => { st.month = $('flMonth').value; loadLog().catch(fail); };
    $('flLog').querySelectorAll('[data-fc]').forEach(b => { b.onclick = async () => {
      const x = r.rows.find(y => y.id === +b.dataset.fc);
      if (!await GK.ask(`Lichtgeld stornieren?\n\n${x.light}, ${dt(x.start)}: ${euro(x.fee)}${x.who ? ' (' + x.who + ')' : ''}`, { ok: 'Lichtgeld stornieren', danger: true })) return;
      try { await api(`claims/${x.id}/fee-cancel`, 'POST', {}); toast('Lichtgeld storniert.'); } catch (e) { fail(e); }
      loadLog().catch(fail);
    }; });
  }

  /* ---------- Reiter „Einstellungen“ ---------- */
  async function renderEinstellungen() {
    const d = await loadCfg(), c = st.c;
    $('main').innerHTML = `<h2 class="page">Einstellungen</h2>
      <p class="lead">Anbindung an Home Assistant, wer schalten darf, Automatik und Lichtgeld.</p>
      ${banners(d)}
      <div class="card"><h3>Anbindung</h3><p class="muted s" style="margin-top:0">Clubwerk schaltet das Licht über Schalter in Home Assistant (switch.* oder light.*), egal von welchem Hersteller. <span id="flTestOut"></span></p>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn" id="flTest">Verbindung testen</button></div></div>
      <div class="card"><h3>Wer darf schalten?</h3>
        <label class="chk"><input type="checkbox" id="flWA" ${c.who.auto ? 'checked' : ''} ${d.buchung ? '' : 'disabled'}> Automatik: gebuchte Plätze nach Einbruch der Dunkelheit beleuchten${d.buchung ? '' : ' (braucht das Modul Plätze)'}</label>
        <label class="chk"><input type="checkbox" id="flWP" ${c.who.app ? 'checked' : ''}> Mitglieder in der App – nur im Vereins-WLAN, nur freigeschaltete (${d.granted})</label>
        <label class="chk"><input type="checkbox" id="flWT" ${c.who.tablet ? 'checked' : ''}> Am Tablet – mit Namen und App-PIN, nur freigeschaltete</label>
        <div class="frm" style="margin-top:12px"><label class="f w1">Höchstens am Stück (Min.)<input id="flMax" class="num" inputmode="numeric" value="${c.maxMin}"></label><label class="f w1">Verlängern um (Min.)<input id="flExt" class="num" inputmode="numeric" value="${c.extendMin}"></label><span class="w1"></span><span class="w1"></span></div>
        <p class="muted s" style="margin:8px 0 0">Freischalten unter <a href="#app" data-go="app">Mitglieder-App</a>. Am Tablet erscheint die Seite „Licht“, wenn sie unter Einstellungen › Tablet eingeschaltet ist.</p>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="flSaveW">Speichern</button></div></div>
      <div class="card"><h3>Lichtgeld</h3>
        <label class="chk"><input type="checkbox" id="flFee" ${c.fee.on ? 'checked' : ''} ${d.feeTarget ? '' : 'disabled'}> Lichtgeld berechnen${d.feeTarget ? '' : ' (braucht das Modul Mitglieder oder den Verkauf)'}</label>
        <div class="frm" style="margin-top:12px"><label class="f w1">Je angefangene ¼ Stunde<input id="flFeeC" class="num" inputmode="decimal" value="${GK.centsToInput ? GK.centsToInput(c.fee.cents) : (c.fee.cents / 100).toFixed(2).replace('.', ',')}"></label><label class="f w1">Ab Uhrzeit<input type="time" id="flFeeF" class="num" value="${esc(c.fee.from)}"></label><span class="w1"></span><span class="w1"></span></div>
        <p class="muted s" style="margin:8px 0 0">Gebucht wird wie die Platzgebühr: als offener Posten in den Mitgliedern bzw. aufs Verkaufskonto. Bei Buchungen zahlt der Buchende nur die gebuchte Zeit (Vorlauf und Nachlauf frei), sonst wer eingeschaltet hat. Verwaltung, Serien und Vereinsbuchungen sind frei.</p>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="flSaveF">Speichern</button></div></div>
      <div class="card"><h3>Benachrichtigungen</h3><div class="frm"><label class="f">Bei Störung melden an (optional)<input id="flNotify" value="${esc(c.notify || '')}" placeholder="z. B. mobile_app_handy_vorstand"></label></div>
        <p class="muted s" style="margin:8px 0 0">Der Empfänger ist der Name des Handys in Home Assistant (Mitteilungsdienst „notify“).</p>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="flSaveN">Speichern</button></div></div>
      <div id="flFunc"></div>`;
    GK.watch($('main'));
    bindGo($('main'));
    const again = () => renderEinstellungen().catch(fail);
    $('flTest').onclick = () => GK.busy($('flTest'), async () => { try { const r = await api('test', 'POST', {}); $('flTestOut').innerHTML = `<b>${esc(r.text)}</b>`; } catch (e) { fail(e); } });
    $('flSaveW').onclick = async () => { c.who = { auto: $('flWA').checked, app: $('flWP').checked, tablet: $('flWT').checked }; c.maxMin = $('flMax').value; c.extendMin = $('flExt').value; if (await saveCfg(['who', 'maxMin', 'extendMin'])) again(); };
    $('flSaveF').onclick = async () => { c.fee = { on: $('flFee').checked, cents: GK.toCents($('flFeeC').value), from: $('flFeeF').value }; if (await saveCfg(['fee'])) again(); };
    $('flSaveN').onclick = async () => { c.notify = $('flNotify').value; if (await saveCfg(['notify'])) again(); };
    if (GK.funcBox) GK.funcBox($('flFunc'), 'flutlicht', 'Flutlicht', again);
  }

  /* Reiter: nur „Bedienen“ mit dem Recht „Flutlicht bedienen“ */
  const G = { key: 'flutlicht', label: 'Flutlicht', icon: 'flutlicht', order: 5.5 };
  GK.registerPage({ key: 'flutlicht', title: 'Bedienen', perm: ['flutlicht', 'flutlicht_bedienen'], render: renderBedienen, group: G });
  GK.registerPage({ key: 'flutlicht-anlagen', title: 'Anlagen', perm: 'flutlicht', render: renderAnlagen, group: G });
  GK.registerPage({ key: 'flutlicht-zeiten', title: 'Zeiten', perm: 'flutlicht', render: renderZeiten, group: G });
  GK.registerPage({ key: 'flutlicht-verlauf', title: 'Verlauf', perm: 'flutlicht', render: renderVerlauf, group: G });
  GK.registerPage({ key: 'flutlicht-einstellungen', title: 'Einstellungen', perm: 'flutlicht', render: renderEinstellungen, group: G });
  if (GK.registerSearch) GK.registerSearch([
    { label: 'Flutlicht einschalten', page: 'flutlicht', card: 'Lichtanlagen', kind: 'aktion', words: 'Licht Flutlicht einschalten ausschalten Platz' },
    { label: 'Alles Licht aus', page: 'flutlicht', btn: 'Alles aus', kind: 'aktion', words: 'Flutlicht Notfall aus' },
    { label: 'Lichtanlage anlegen', page: 'flutlicht-anlagen', perm: 'flutlicht', btn: '+ Lichtanlage', kind: 'aktion', words: 'Flutlicht Schalter Home Assistant Platz Vorlauf Nachlauf' },
    { label: 'Sonnenuntergang und Standort (Flutlicht)', page: 'flutlicht-zeiten', perm: 'flutlicht', card: 'Dunkelheit', words: 'Dunkelheit Sonnenuntergang Breitengrad Längengrad' },
    { label: 'Nachtruhe des Flutlichts', page: 'flutlicht-zeiten', perm: 'flutlicht', card: 'Nachtruhe', words: 'Nachtruhe Abschaltung spätestens' },
    { label: 'Saison des Flutlichts', page: 'flutlicht-zeiten', perm: 'flutlicht', card: 'Saison', words: 'Saison Sommer Winter' },
    { label: 'Sperrzeitraum eintragen (Flutlicht)', page: 'flutlicht-zeiten', perm: 'flutlicht', btn: '+ Sperrzeitraum', kind: 'aktion', words: 'Sperrtage Wartung gesperrt' },
    { label: 'Flutlicht-Verlauf als Excel', page: 'flutlicht-verlauf', perm: 'flutlicht', btn: 'Excel', kind: 'aktion', words: 'Verlauf Betriebsstunden Excel Lichtgeld' },
    { label: 'Lichtgeld einstellen', page: 'flutlicht-einstellungen', perm: 'flutlicht', card: 'Lichtgeld', words: 'Lichtgeld Gebühr Viertelstunde Preis' },
    { label: 'Wer darf das Flutlicht schalten', page: 'flutlicht-einstellungen', perm: 'flutlicht', card: 'Wer darf schalten', words: 'Automatik App Tablet Höchstdauer verlängern' },
    { label: 'Verbindung des Flutlichts testen', page: 'flutlicht-einstellungen', perm: 'flutlicht', card: 'Anbindung', kind: 'aktion', words: 'Home Assistant Verbindung testen Schalter' },
    { label: 'Einstellungen des Flutlichts übertragen', page: 'flutlicht-einstellungen', perm: 'flutlicht', card: 'Einstellungen übertragen', kind: 'aktion', words: 'Export Import Datei' },
  ]);
})();
