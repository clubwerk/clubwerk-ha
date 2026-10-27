'use strict';
/* Verwaltungsseite „Turniere“ (Clubmeisterschaft): Reiter Übersicht · Teilnehmer · Spiele · Tabellen · Einstellungen.
   Tabellen und K.-o.-Baum aus ansicht.js – dieselben Bausteine wie in der Mitglieder-App und am Tablet. */
(() => {
  const GK = window.GK;
  const { $, esc, toast, fail } = GK;
  const api = (url, method, body) => GK.api('x/turniere/' + url, method, body);
  const EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  const DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
  const st = { meta: null, sid: null, d: null, tabs: null, mf: sessionStorage.getItem('tu_mf') || 'offen', lf: 'alle' };
  const dm = s => (s ? GK.deDate(s) : '–');
  const loadView = () => new Promise(res => { if (window.TurnierAnsicht) return res(); const sc = document.createElement('script'); sc.src = 'x/turniere/ansicht.js'; sc.onload = res; sc.onerror = res; document.body.appendChild(sc); });
  if (!document.getElementById('tuAdminStyle')) {
    const s = document.createElement('style'); s.id = 'tuAdminStyle';
    s.textContent = `
      .tu-sets { display: grid; grid-template-columns: minmax(0, 1fr) 72px 12px 72px; gap: 8px; align-items: center; margin: 12px 0 0; }
      .tu-sets .h { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tu-sets .c { text-align: center; color: var(--muted); font-weight: 700; }
      .tu-sets input { width: 100%; box-sizing: border-box; height: 46px; border: 1px solid var(--line); border-radius: 12px; background: var(--field); color: var(--ink); text-align: center; font-family: var(--num); font-size: 18px; font-weight: 600; }
      .tu-kv dd { overflow-wrap: break-word; }
      .tu-step p { margin: 0 0 12px; }
      .tu-num { font-family: var(--num); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 16px; white-space: nowrap; }`;
    document.head.appendChild(s);
  }

  /** Knöpfe der Ansicht: rechts in die Reiterzeile, sonst als Knopfleiste oben im Inhalt (wie im Spielbetrieb) */
  const tools = (el, html) => { if (html && !GK.tabTools(html, el.firstElementChild)) el.insertAdjacentHTML('afterbegin', `<div class="toolbar">${html}</div>`); };
  async function meta() { st.meta = await api('meta'); const keep = +sessionStorage.getItem('tu_sid'); st.sid = st.meta.seasons.some(x => x.id === keep) ? keep : st.meta.current; return st.meta; }
  async function season() { st.d = st.sid ? await api('saison/' + st.sid) : null; return st.d; }
  const reloadAll = async () => { await meta(); await season(); if (st.tabs) st.tabs.reload(); lead(); };
  function lead() {
    const p = $('tuLead'); if (!p) return;
    const s = st.d && st.d.season;
    p.textContent = s ? `${s.name}: ${s.closed_at ? 'abgeschlossen' : s.regOpen ? `Anmeldung offen${s.reg_until ? ` bis ${dm(s.reg_until)}` : ''}` : s.drawn_at ? `Gruppenphase${s.due_groups ? ` bis ${dm(s.due_groups)}` : ''}` : 'Anmeldung geschlossen – Gruppen auslosen'}.` : 'Clubmeisterschaft mit Ligen, Gruppen, Endrunde und Relegation.';
  }

  /* ---------- Saison anlegen / bearbeiten ---------- */
  function seasonDialog(s) {
    const n = s ? s.leagues.length : 4, y = new Date().getFullYear();
    GK.dialog(`<h2>${s ? 'Saison bearbeiten' : 'Neue Saison'}</h2>
      <div class="row"><label class="f" style="flex:2 1 240px">Name<input id="tsN" maxlength="60" value="${esc(s ? s.name : `Clubmeisterschaft ${y}`)}" placeholder="z. B. Clubmeisterschaft ${y}"></label>
        <label class="f" style="flex:1 1 140px">Ligen<select id="tsL" ${s && s.drawn_at ? 'disabled' : ''}>${st.meta.letters.map((l, i) => `<option value="${i + 1}" ${i + 1 === n ? 'selected' : ''}>${i + 1} (A${i ? '–' + l : ''})</option>`).join('')}</select></label></div>
      <div class="row" style="margin-top:12px"><label class="f" style="flex:1 1 180px">Anmeldeschluss<input type="date" id="tsR" value="${esc(s ? s.reg_until || '' : '')}"></label>
        <label class="f" style="flex:1 1 180px">Frist Gruppenphase<input type="date" id="tsG" value="${esc(s ? s.due_groups || '' : '')}"></label>
        <label class="f" style="flex:1 1 180px">Frist Endspiele + Relegation<input type="date" id="tsF" value="${esc(s ? s.due_final || '' : '')}"></label></div>
      <p class="muted s" style="margin:10px 0 0">Jede Liga wird in zwei Gruppen gelost (ab 6 Spielern, sonst eine). Die Endrunde spielt nur die oberste Liga; die Relegation entscheidet über Auf- und Abstieg.</p>
      <div class="btns"><button class="btn ghost" id="tsX">Abbrechen</button><button class="btn primary" id="tsOk">${s ? 'Speichern' : 'Anlegen'}</button></div>
      ${s ? '<div class="btns" style="margin-top:8px;border-top:1px solid var(--line);padding-top:12px"><button class="btn danger" id="tsDel">Saison löschen</button></div>' : ''}`, true);
    $('tsX').onclick = GK.closeDialog;
    $('tsOk').onclick = () => GK.busy($('tsOk'), async () => {
      const body = { name: $('tsN').value, leagues: +$('tsL').value, reg_until: $('tsR').value, due_groups: $('tsG').value, due_final: $('tsF').value };
      try {
        if (s) await api('saison/' + s.id, 'PUT', body); else { const r = await api('saison', 'POST', body); sessionStorage.setItem('tu_sid', r.id); }
        GK.closeDialog(); toast(s ? 'Gespeichert.' : 'Saison angelegt – Mitglieder können sich jetzt in der App anmelden.'); render();
      } catch (e) { fail(e); }
    });
    if ($('tsDel')) $('tsDel').onclick = async () => {
      if (!await GK.ask(`Saison „${s.name}“ löschen?\n\nAlle Anmeldungen, Gruppen, Spiele und Ergebnisse dieser Saison sind danach weg; gebuchte Plätze werden storniert.`)) return;
      try { await api('saison/' + s.id, 'DELETE'); sessionStorage.removeItem('tu_sid'); GK.closeDialog(); toast('Gelöscht.'); render(); } catch (e) { fail(e); }
    };
  }

  /* ---------- Übersicht ---------- */
  function showOverview(el) {
    const d = st.d, s = d.season, c = d.counts;
    const seasons = st.meta.seasons;
    const late = d.matches.filter(m => m.overdue);
    const groupOpen = d.matches.filter(m => m.phase === 'gruppe' && !m.done).length, groupAll = d.matches.filter(m => m.phase === 'gruppe').length;
    let step;
    if (s.closed_at) step = `<p>Die Saison ist abgeschlossen.</p>`;
    else if (!s.drawn_at && s.regOpen) step = `<p>Die Anmeldung läuft${s.reg_until ? ` bis ${dm(s.reg_until)}` : ''}: ${d.players.length} ${d.players.length === 1 ? 'Person ist' : 'Personen sind'} eingetragen. Danach die Gruppen auslosen.</p><div class="btns"><button class="btn" id="tuGoP">Teilnehmer ansehen</button></div>`;
    else if (!s.drawn_at) step = `<p>Die Anmeldung ist vorbei – ${d.players.length} Teilnehmer. Jetzt die Gruppen jeder Liga auslosen.</p><div class="btns"><button class="btn primary" id="tuDraw">Gruppen auslosen</button></div>`;
    else if (groupOpen) step = `<p>Gruppenphase: ${groupAll - groupOpen} von ${groupAll} Spielen gewertet${s.due_groups ? `, Frist ${dm(s.due_groups)}` : ''}. Endrunde und Relegation setzt Clubwerk von selbst, sobald eine Liga fertig ist.</p>
      <div class="btns"><button class="btn" id="tuEnd">Gruppenphase beenden …</button></div>`;
    else if (d.champion) step = `<p>Clubmeister: <b translate="no">${esc(d.champion)}</b>.${d.relegation.some(m => !m.winner && m.result !== 'ausgefallen') ? ' Die Relegation läuft noch.' : ''}</p>`;
    else step = `<p>Endrunde und Relegation laufen${s.due_final ? ` bis ${dm(s.due_final)}` : ''}: ${c.open} ${c.open === 1 ? 'Spiel ist' : 'Spiele sind'} offen.</p>`;
    el.innerHTML = `<div class="kpis"><div class="kpi"><div class="l">Teilnehmer</div><div class="v">${d.players.length}</div></div><div class="kpi"><div class="l">Offene Spiele</div><div class="v">${c.open}</div></div>
        <div class="kpi"><div class="l">Überfällig</div><div class="v">${c.overdue}</div></div><div class="kpi"><div class="l">Gewertet</div><div class="v">${c.done}</div></div></div>
      <div class="card tu-step" data-card="naechster"><h3>Nächster Schritt</h3>${step}</div>
      ${late.length ? `<div class="card" data-card="ueberfaellig"><h3>Überfällige Spiele</h3><table class="tbl kompakt"><tr><th>Spiel</th><th>Runde</th><th>Frist</th><th></th></tr>
        ${late.map(m => `<tr><td translate="no"><b>${esc(m.a)} – ${esc(m.b)}</b></td><td>${esc(m.where)}</td><td class="nw">${dm(m.due)}</td><td class="r"><span class="acts"><button class="btn ico" data-rem="${m.id}" title="Erinnerung schicken" aria-label="Erinnerung schicken">${BELL}</button></span></td></tr>`).join('')}</table>
        <div class="btns"><button class="btn" id="tuRemAll">Alle erinnern</button></div></div>` : ''}
      <div class="card" data-card="saison"><h3>Saison</h3>
        <dl class="vh-kv tu-kv"><dt>Name</dt><dd>${esc(s.name)}</dd><dt>Ligen</dt><dd>${esc(s.leagues.join(', '))}</dd><dt>Anmeldeschluss</dt><dd>${dm(s.reg_until)}</dd>
          <dt>Frist Gruppenphase</dt><dd>${dm(s.due_groups)}</dd><dt>Frist Endspiele + Relegation</dt><dd>${dm(s.due_final)}</dd></dl>
        <div class="btns"><button class="btn" id="tuEdit">Saison bearbeiten</button></div></div>`;
    tools(el, `${seasons.length > 1 ? `<label class="f" style="flex:0 1 260px">Saison<select id="tuSid">${seasons.map(x => `<option value="${x.id}" ${x.id === st.sid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}<button class="btn primary" id="tuNew">+ Neue Saison</button>`);
    if ($('tuSid')) $('tuSid').onchange = () => { st.sid = +$('tuSid').value; sessionStorage.setItem('tu_sid', st.sid); reloadAll().catch(fail); };
    $('tuNew').onclick = () => seasonDialog(null);
    $('tuEdit').onclick = () => seasonDialog(s);
    if ($('tuGoP')) $('tuGoP').onclick = () => { const b = document.querySelector('#tuTabs [data-tab="teilnehmer"]'); if (b) b.click(); };
    if ($('tuDraw')) $('tuDraw').onclick = () => draw(null);
    if ($('tuEnd')) $('tuEnd').onclick = endPhase;
    el.querySelectorAll('[data-rem]').forEach(b => { b.onclick = () => GK.busy(b, async () => { try { await api(`spiel/${b.dataset.rem}/erinnern`, 'POST', {}); toast('Erinnerung geschickt.'); } catch (e) { fail(e); } }); });
    if ($('tuRemAll')) $('tuRemAll').onclick = () => GK.busy($('tuRemAll'), async () => { try { const r = await api(`saison/${st.sid}/erinnern`, 'POST', {}); toast(`${r.n} ${r.n === 1 ? 'Erinnerung' : 'Erinnerungen'} geschickt.`); } catch (e) { fail(e); } });
  }
  async function draw(league) {
    const d = st.d;
    if (!await GK.ask(league ? `Liga ${league} neu auslosen?\n\nDie bisherigen Gruppen der Liga ${league} und ihre Spiele (mit gebuchten Plätzen) werden ersetzt.` : `Gruppen auslosen?\n\n${d.players.filter(p => p.singles).length} Spieler werden in ihrer Liga zufällig auf die Gruppen verteilt (gleich groß, ± 1). Alle bekommen eine Nachricht in der App.`, { ok: 'Auslosen', danger: Boolean(league) })) return;
    try {
      const r = await api(`saison/${st.sid}/auslosen`, 'POST', league ? { league } : {});
      toast(r.drawn.length ? `Ausgelost: Liga ${r.drawn.join(', ')}${r.skipped.length ? ` – nicht: ${r.skipped.join('; ')}` : ''}` : `Nichts ausgelost: ${r.skipped.join('; ') || 'keine Anmeldungen'}`, !r.drawn.length);
      reloadAll();
    } catch (e) { fail(e); }
  }
  async function endPhase() {
    let r; try { r = await api(`saison/${st.sid}/endrunde`, 'POST', { preview: true }); } catch (e) { return fail(e); }
    GK.dialog(`<h2>Gruppenphase beenden</h2>
      <p>${r.open.length ? `${r.open.length} ${r.open.length === 1 ? 'Gruppenspiel ist' : 'Gruppenspiele sind'} noch offen. Trage vorher Ergebnisse oder „kampflos“ ein – was offen bleibt, gilt als <b>ausgefallen</b> und zählt in der Tabelle nicht.` : 'Alle Gruppenspiele sind gewertet.'} Danach setzt Clubwerk Endrunde und Relegation.</p>
      ${r.open.length ? `<table class="tbl kompakt"><tr><th>Spiel</th><th>Runde</th></tr>${r.open.slice(0, 40).map(m => `<tr><td translate="no"><b>${esc(m.a)} – ${esc(m.b)}</b></td><td>${esc(m.where)}</td></tr>`).join('')}</table>${r.open.length > 40 ? `<p class="muted s">… und ${r.open.length - 40} weitere</p>` : ''}` : ''}
      <div class="btns"><button class="btn ghost" id="teX">Abbrechen</button><button class="btn ${r.open.length ? 'danger' : 'primary'}" id="teOk">${r.open.length ? 'Offene als ausgefallen werten' : 'Endrunde setzen'}</button></div>`, true);
    $('teX').onclick = GK.closeDialog;
    $('teOk').onclick = () => GK.busy($('teOk'), async () => {
      try { const x = await api(`saison/${st.sid}/endrunde`, 'POST', {}); GK.closeDialog(); toast(x.created ? `${x.created} ${x.created === 1 ? 'Spiel' : 'Spiele'} gesetzt.` : 'Gruppenphase beendet.'); if (x.warnings.length) toast(x.warnings.join(' '), true); reloadAll(); }
      catch (e) { fail(e); }
    });
  }

  /* ---------- Teilnehmer ---------- */
  function showPlayers(el) {
    const d = st.d, s = d.season, L = s.leagues;
    const groupOf = new Map();
    d.leagues.forEach(l => l.groups.forEach(g => g.table.forEach(r => groupOf.set(r.name, g.label))));
    const list = d.players.filter(p => st.lf === 'alle' || p.league === st.lf);
    const drawn = Boolean(s.drawn_at);
    el.innerHTML = `<div class="chips" id="tuLf" role="group" aria-label="Filter">${[['alle', 'Alle', d.players.length], ...L.map(l => [l, `Liga ${l}`, d.players.filter(p => p.league === l).length])].map(([k, l, n]) => `<button type="button" data-f="${k}" class="${st.lf === k ? 'on' : ''}" aria-pressed="${st.lf === k}">${esc(l)}<span class="cnt">${n}</span></button>`).join('')}</div>
      <div class="card">${list.length ? `<table class="tbl kompakt"><tr><th>Name</th><th>Liga</th><th>Gruppe</th><th class="k-weg">Eingetragen</th><th></th></tr>
        ${list.map(p => { const g = groupOf.get(p.name); return `<tr><td translate="no"><b>${esc(p.name)}</b></td>
          <td class="k-lbl" data-label="Liga">${g || s.closed_at ? esc(p.league) : `<select data-lg="${p.member_id}" aria-label="Liga">${L.map(l => `<option ${l === p.league ? 'selected' : ''}>${l}</option>`).join('')}</select>`}</td>
          <td class="k-lbl" data-label="Gruppe">${g ? esc(g) : '–'}</td><td class="k-weg">${p.source === 'app' ? 'in der App' : 'von Hand'}</td>
          <td class="r"><span class="acts">${g || s.closed_at ? '' : `<button class="btn ico" data-rm="${p.member_id}" title="Austragen" aria-label="Austragen">${DEL}</button>`}</span></td></tr>`; }).join('')}</table>`
        : `<p class="empty">${d.players.length ? 'In dieser Liga ist noch niemand.' : 'Noch keine Anmeldungen – Mitglieder melden sich in der App unter „Turniere“ an, oder „+ Spieler eintragen“.'}</p>`}</div>
      ${s.closed_at ? '' : `<div class="card tu-step" data-card="auslosung"><h3>Auslosung</h3>
        <p>${drawn ? `Ausgelost am ${dm(s.drawn_at.slice(0, 10))}. Neu losen oder tauschen geht, solange in der Gruppe noch kein Spiel gewertet ist.` : 'Jede Liga wird zufällig auf ihre Gruppen verteilt – gleich groß (± 1), zwei Gruppen ab 6 Spielern. Neu Angemeldete stehen in der untersten Liga; wer woanders hingehört, vorher umsetzen.'}</p>
        <div class="btns">${drawn ? '<button class="btn" id="tuSwap">Spieler tauschen …</button><button class="btn" id="tuRedraw">Liga neu auslosen …</button>' : '<button class="btn primary" id="tuDraw2">Gruppen auslosen</button>'}</div></div>`}`;
    tools(el, s.closed_at ? '' : '<button class="btn primary" id="tuAdd">+ Spieler eintragen</button>');
    if ($('tuAdd')) $('tuAdd').onclick = addPlayer;
    el.querySelectorAll('#tuLf [data-f]').forEach(b => { b.onclick = () => { st.lf = b.dataset.f; showPlayers(el); }; });
    el.querySelectorAll('[data-lg]').forEach(x => { x.onchange = async () => { try { await api(`saison/${st.sid}/spieler/${x.dataset.lg}`, 'PUT', { league: x.value }); toast('Umgesetzt.'); await season(); showPlayers(el); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-rm]').forEach(b => { b.onclick = async () => { const p = d.players.find(x => x.member_id === +b.dataset.rm); if (!await GK.ask(`${p.name} austragen?`, { ok: 'Austragen', danger: true })) return; try { await api(`saison/${st.sid}/spieler/${p.member_id}`, 'DELETE'); await season(); showPlayers(el); } catch (e) { fail(e); } }; });
    if ($('tuDraw2')) $('tuDraw2').onclick = () => draw(null);
    if ($('tuRedraw')) $('tuRedraw').onclick = redrawDialog;
    if ($('tuSwap')) $('tuSwap').onclick = swapDialog;
  }
  async function addPlayer() {
    let people; try { people = await api('leute'); } catch (e) { return fail(e); }
    const inside = new Set(st.d.players.map(p => p.member_id)), L = st.d.season.leagues;
    GK.dialog(`<h2>Spieler eintragen</h2>
      <label class="f">Name<input id="tpQ" placeholder="Namen eingeben" autocomplete="off"></label>
      <label class="f" style="margin-top:12px">Mitglied<select id="tpM" size="6"></select></label>
      <label class="f" style="margin-top:12px">Liga<select id="tpL">${L.map((l, i) => `<option ${i === L.length - 1 ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="btns"><button class="btn ghost" id="tpX">Abbrechen</button><button class="btn primary" id="tpOk">Eintragen</button></div>`);
    const fill = () => { const q = $('tpQ').value.trim().toLowerCase(); $('tpM').innerHTML = people.filter(p => !inside.has(p.id) && (!q || p.ln.toLowerCase().includes(q))).slice(0, 200).map(p => `<option value="${p.id}" translate="no">${esc(p.ln)}</option>`).join(''); };
    fill(); $('tpQ').oninput = fill; $('tpQ').focus();
    $('tpX').onclick = GK.closeDialog;
    $('tpOk').onclick = () => GK.busy($('tpOk'), async () => {
      if (!$('tpM').value) return toast('Bitte ein Mitglied wählen.', true);
      try { await api(`saison/${st.sid}/spieler`, 'POST', { member_id: +$('tpM').value, league: $('tpL').value }); inside.add(+$('tpM').value); toast('Eingetragen.'); $('tpQ').value = ''; fill(); $('tpQ').focus(); await season(); if (st.tabs) st.tabs.reload(); }
      catch (e) { fail(e); }
    });
  }
  function redrawDialog() {
    GK.dialog(`<h2>Liga neu auslosen</h2><p class="muted">Geht nur, solange in der Liga noch kein Spiel gewertet ist.</p>
      <label class="f">Liga<select id="trL">${st.d.season.leagues.map(l => `<option>${l}</option>`).join('')}</select></label>
      <div class="btns"><button class="btn ghost" id="trX">Abbrechen</button><button class="btn primary" id="trOk">Weiter</button></div>`);
    $('trX').onclick = GK.closeDialog;
    $('trOk').onclick = () => { const l = $('trL').value; GK.closeDialog(); draw(l); };
  }
  async function swapDialog() {
    let teams; try { teams = await api(`saison/${st.sid}/gruppen`); } catch (e) { return fail(e); }
    const leagues = [...new Set(teams.map(t => t.league))].filter(l => new Set(teams.filter(t => t.league === l).map(t => t.group)).size > 1);
    if (!leagues.length) return toast('Keine Liga mit zwei Gruppen.', true);
    const lab = (l, g) => `${l}${g}`;
    GK.dialog(`<h2>Spieler tauschen</h2><p class="muted">Zwei Spieler derselben Liga wechseln die Gruppe. Geht nur, solange in beiden Gruppen noch kein Spiel gewertet ist.</p>
      <label class="f">Liga<select id="twL">${leagues.map(l => `<option>${l}</option>`).join('')}</select></label>
      <div class="row" style="margin-top:12px"><label class="f" style="flex:1 1 200px" id="twAL">Spieler<select id="twA"></select></label><label class="f" style="flex:1 1 200px" id="twBL">tauscht mit<select id="twB"></select></label></div>
      <div class="btns"><button class="btn ghost" id="twX">Abbrechen</button><button class="btn primary" id="twOk">Tauschen</button></div>`);
    const fill = () => { const l = $('twL').value, ts = teams.filter(t => t.league === l);
      $('twA').innerHTML = ts.filter(t => t.group === 1).map(t => `<option value="${t.id}" translate="no">${esc(t.name)} (${lab(l, 1)})</option>`).join('');
      $('twB').innerHTML = ts.filter(t => t.group === 2).map(t => `<option value="${t.id}" translate="no">${esc(t.name)} (${lab(l, 2)})</option>`).join(''); };
    fill(); $('twL').onchange = fill;
    $('twX').onclick = GK.closeDialog;
    $('twOk').onclick = () => GK.busy($('twOk'), async () => { try { await api(`saison/${st.sid}/tausch`, 'POST', { a: +$('twA').value, b: +$('twB').value }); GK.closeDialog(); toast('Getauscht – die Spiele beider Gruppen sind neu angelegt.'); reloadAll(); } catch (e) { fail(e); } });
  }

  /* ---------- Spiele ---------- */
  const FIL = { offen: m => !m.done, ueber: m => m.overdue, gewertet: m => m.done, alle: () => true };
  function showMatches(el) {
    const d = st.d;
    const list = d.matches.filter(FIL[st.mf] || FIL.offen);
    const cnt = k => d.matches.filter(FIL[k]).length;
    el.innerHTML = `<div class="chips" id="tuMf" role="group" aria-label="Filter">${[['offen', 'Offen'], ['ueber', 'Überfällig'], ['gewertet', 'Gewertet'], ['alle', 'Alle']].map(([k, l]) => `<button type="button" data-f="${k}" class="${st.mf === k ? 'on' : ''}" aria-pressed="${st.mf === k}">${l}<span class="cnt">${cnt(k)}</span></button>`).join('')}</div>
      <div class="card">${list.length ? `<table class="tbl sel kompakt"><tr><th>Spiel</th><th>Runde</th><th class="k-weg">Termin</th><th>Ergebnis</th><th></th></tr>
        ${list.map(m => `<tr data-sel="${m.id}"><td translate="no" class="k-1z"><b>${esc(m.a)} – ${esc(m.b)}</b></td><td>${esc(m.where.replace(' – Gruppenphase', ''))}</td>
          <td class="k-weg nw">${m.date ? `${dm(m.date)}${m.time ? ' ' + esc(m.time) : ''}${m.court ? ' · ' + esc(m.court) : ''}` : m.done ? '' : `<span class="muted">Frist ${dm(m.due)}</span>`}</td>
          <td>${m.done ? `<span class="tu-num">${esc(m.score)}</span>` : m.overdue ? '<span class="pill r">überfällig</span>' : '<span class="pill a">offen</span>'}</td>
          <td class="r"><span class="acts"><button class="btn ico" data-ed="${m.id}" title="Ergebnis bearbeiten" aria-label="Ergebnis bearbeiten">${EDIT}</button></span></td></tr>`).join('')}</table>`
        : `<p class="empty">${d.matches.length ? 'Keine Spiele in dieser Auswahl.' : 'Noch keine Spiele – erst die Gruppen auslosen (Reiter „Teilnehmer“).'}</p>`}</div>`;
    el.querySelectorAll('#tuMf [data-f]').forEach(b => { b.onclick = () => { st.mf = b.dataset.f; sessionStorage.setItem('tu_mf', st.mf); showMatches(el); }; });
    el.querySelectorAll('[data-sel]').forEach(tr => { tr.onclick = () => resultDialog(d.matches.find(m => m.id === +tr.dataset.sel)); });
  }
  function resultDialog(m) {
    if (st.d.season.closed_at) return toast('Die Saison ist abgeschlossen.', true);
    const k0 = m.result || 'normal';
    GK.dialog(`<h2 translate="no">${esc(m.a)} – ${esc(m.b)}</h2><p class="muted" style="margin-top:-4px">${esc(m.where)}${m.entered_by ? ` · eingetragen von <span translate="no">${esc(m.entered_by)}</span>` : ''}</p>
      <div class="row"><label class="f" style="flex:1 1 200px">Wertung<select id="trK">${[['normal', 'Gespielt'], ['wo', 'Kampflos (w. o.)'], ['aufgabe', 'Aufgabe'], ['ausgefallen', 'Ausgefallen (zählt nicht)']].map(([k, l]) => `<option value="${k}" ${k === k0 ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f" style="flex:1 1 200px" id="trWL">Gewinnt kampflos<select id="trW"><option value="a" translate="no">${esc(m.a)}</option><option value="b" translate="no" ${m.winner === 'b' ? 'selected' : ''}>${esc(m.b)}</option></select></label>
        <label class="f" style="flex:1 1 200px" id="trRL">Hat aufgegeben<select id="trR"><option value="a" translate="no">${esc(m.a)}</option><option value="b" translate="no" ${m.retired !== 'a' ? 'selected' : ''}>${esc(m.b)}</option></select></label></div>
      <div class="tu-sets" id="trS"><span></span><span class="h" translate="no">${esc(m.a.split(',')[0])}</span><span></span><span class="h" translate="no">${esc(m.b.split(',')[0])}</span>
        ${['Satz 1', 'Satz 2', 'Match-Tiebreak'].map((l, i) => `<b>${l}</b><input inputmode="numeric" id="trA${i}" value="${m.sets[i] ? m.sets[i][0] : ''}" aria-label="${l}: ${esc(m.a)}"><span class="c">:</span><input inputmode="numeric" id="trB${i}" value="${m.sets[i] ? m.sets[i][1] : ''}" aria-label="${l}: ${esc(m.b)}">`).join('')}</div>
      <div class="btns">${m.done ? '' : '<button class="btn" id="trRem">Erinnerung schicken</button>'}<button class="btn ghost" id="trX">Abbrechen</button><button class="btn primary" id="trOk">Speichern</button></div>
      ${m.done ? '<div class="btns" style="margin-top:8px;border-top:1px solid var(--line);padding-top:12px"><button class="btn danger" id="trDel">Ergebnis löschen</button></div>' : ''}`, true);
    const show = (id, on) => { $(id).style.display = on ? '' : 'none'; };
    const sync = () => { const k = $('trK').value; show('trWL', k === 'wo'); show('trRL', k === 'aufgabe'); show('trS', k !== 'wo' && k !== 'ausgefallen'); };
    sync(); $('trK').onchange = sync;
    $('trX').onclick = GK.closeDialog;
    if ($('trRem')) $('trRem').onclick = () => GK.busy($('trRem'), async () => { try { await api(`spiel/${m.id}/erinnern`, 'POST', {}); toast('Erinnerung an beide Spieler geschickt.'); } catch (e) { fail(e); } });
    const save = body => GK.busy($('trOk'), async () => {
      try { const r = await api('spiel/' + m.id, 'PUT', body); GK.closeDialog(); toast('Gespeichert.'); if (r.warnings && r.warnings.length) toast(r.warnings.join(' '), true); reloadAll(); } catch (e) { fail(e); }
    });
    $('trOk').onclick = () => {
      const k = $('trK').value, body = { result: k };
      if (k === 'wo') body.winner = $('trW').value;
      if (k === 'normal' || k === 'aufgabe') body.sets = [0, 1, 2].map(i => [$('trA' + i).value.trim(), $('trB' + i).value.trim()]).filter(x => x[0] !== '' || x[1] !== '');
      if (k === 'aufgabe') body.retired = $('trR').value;
      save(body);
    };
    if ($('trDel')) $('trDel').onclick = async () => { if (await GK.ask('Ergebnis löschen?\n\nDas Spiel ist danach wieder offen.')) save({ clear: true }); };
  }

  /* ---------- Tabellen (auch zum Drucken für den Aushang) ---------- */
  function tablesHtml(print) {
    const d = st.d, V = window.TurnierAnsicht, card = print ? 'card' : 'card';
    const ko = d.finals.length ? `<h2 class="sec">Endrunde Liga ${esc(d.top)}</h2><div class="${card}">${V.tree(d.finals, d.champion)}</div>` : '';
    const rel = d.relegation.length ? `<h2 class="sec">Relegation</h2><div class="tu-groups">${[...new Set(d.relegation.map(m => m.league))].map(k => `<div class="${card}">${V.relegation(d.relegation.filter(m => m.league === k))}</div>`).join('')}</div>` : '';
    const lg = d.leagues.filter(l => l.groups.length).map(l => `<h2 class="sec">${esc(l.label)}</h2><div class="tu-groups">${l.groups.map(g => `<div class="${card}"><h3><span>Gruppe <span translate="no">${esc(g.label)}</span></span></h3>${V.table(g, { up: l.key === d.top ? 2 : 1 })}</div>`).join('')}</div>`).join('');
    return ko + rel + lg;
  }
  async function showTables(el) {
    await loadView();
    const d = st.d;
    el.innerHTML = d.leagues.some(l => l.groups.length) ? tablesHtml(false) : '<div class="card"><p class="empty">Noch keine Gruppen – erst die Gruppen auslosen (Reiter „Teilnehmer“).</p></div>';
    tools(el, d.leagues.some(l => l.groups.length) ? '<button class="btn" id="tuPrint">Drucken</button>' : '');
    if ($('tuPrint')) $('tuPrint').onclick = () => GK.printHtml(`<div class="pr"><h2 style="margin:0 0 4mm;font-size:14pt">${esc(d.season.name)}</h2>${tablesHtml(true)}</div>`);
  }

  /* ---------- Einstellungen ---------- */
  function showSettings(el) {
    const c = st.meta.cfg;
    el.innerHTML = `<div class="card" data-card="platzbuchung"><h3>Platzbuchung</h3>
        <p class="muted s" style="margin-top:0">${st.meta.booking ? 'Spieler buchen den Platz für ihr Spiel in der App. Die Buchung gilt als Vereinstermin: ohne Gebühr, ohne Kontingent und ohne Vorlauf; Öffnungszeiten, Sperren und belegte Plätze gelten.' : 'Ohne das Modul „Plätze“ tragen Spieler nur Tag und Uhrzeit ein.'}</p>
        <label class="f" style="max-width:260px">Platz je Spiel<select id="tuMin">${[60, 90, 120, 150, 180].map(n => `<option value="${n}" ${n === c.minutes ? 'selected' : ''}>${n % 60 ? `${Math.floor(n / 60)},5 Stunden` : `${n / 60} ${n === 60 ? 'Stunde' : 'Stunden'}`}</option>`).join('')}</select></label>
        <div class="btns"><button class="btn primary" id="tuSaveMin">Speichern</button></div></div>
      <div id="tuFunc"></div>`;
    $('tuSaveMin').onclick = () => GK.busy($('tuSaveMin'), async () => { try { const r = await api('einstellungen', 'PUT', { minutes: +$('tuMin').value }); st.meta.cfg = r.cfg; toast('Gespeichert.'); } catch (e) { fail(e); } });
    if (GK.funcBox) GK.funcBox($('tuFunc'), 'turniere', 'Turniere', () => showSettings(el));
  }

  async function render() {
    await meta(); await loadView();
    await season();
    $('main').innerHTML = `<h2 class="page">Turniere</h2><p class="lead" id="tuLead"></p><div id="tuTabs"></div>`;
    lead();
    if (!st.d) {
      $('tuTabs').innerHTML = `<div class="card"><p class="empty">Noch keine Clubmeisterschaft angelegt – mit „+ Neue Saison“ geht es los: Ligen, Anmeldeschluss und Fristen festlegen, dann melden sich die Mitglieder in der App an.</p>
        <div class="btns"><button class="btn primary" id="tuNew0">+ Neue Saison</button></div></div>`;
      $('tuNew0').onclick = () => seasonDialog(null);
      return;
    }
    st.tabs = GK.tabs($('tuTabs'), 'turniere', [['uebersicht', 'Übersicht'], ['teilnehmer', 'Teilnehmer'], ['spiele', 'Spiele'], ['tabellen', 'Tabellen'], ['einstellungen', 'Einstellungen']], async (k, el) => {
      if (!st.d) await season();
      if (k === 'uebersicht') return showOverview(el);
      if (k === 'teilnehmer') return showPlayers(el);
      if (k === 'spiele') return showMatches(el);
      if (k === 'tabellen') return showTables(el);
      return showSettings(el);
    });
  }
  GK.registerPage({ key: 'turniere', title: 'Turniere', perm: 'turniere', render, icon: 'turnier', order: 2.7 });
  if (GK.registerSearch) GK.registerSearch([
    { label: 'Clubmeisterschaft', page: 'turniere', tab: ['turniere', 'uebersicht'], kind: 'reiter', in: 'Übersicht', words: 'Turnier Saison Vereinsmeisterschaft Liga', boost: 1 },
    { label: 'Neue Saison anlegen', page: 'turniere', tab: ['turniere', 'uebersicht'], btn: '+ Neue Saison', kind: 'aktion', in: 'Übersicht', words: 'Clubmeisterschaft Ligen Fristen Anmeldeschluss' },
    { label: 'Teilnehmer der Clubmeisterschaft', page: 'turniere', tab: ['turniere', 'teilnehmer'], kind: 'reiter', in: 'Teilnehmer', words: 'Anmeldung Liga Spieler einteilen' },
    { label: 'Spieler eintragen', page: 'turniere', tab: ['turniere', 'teilnehmer'], btn: '+ Spieler', kind: 'aktion', in: 'Teilnehmer', words: 'Clubmeisterschaft Anmeldung von Hand' },
    { label: 'Gruppen auslosen', page: 'turniere', tab: ['turniere', 'teilnehmer'], card: 'Auslosung', kind: 'aktion', in: 'Teilnehmer', words: 'losen Auslosung Gruppen tauschen' },
    { label: 'Spiele und Ergebnisse', page: 'turniere', tab: ['turniere', 'spiele'], kind: 'reiter', in: 'Spiele', words: 'Ergebnis korrigieren kampflos Aufgabe überfällig Erinnerung' },
    { label: 'Tabellen und Endrunde', page: 'turniere', tab: ['turniere', 'tabellen'], kind: 'reiter', in: 'Tabellen', words: 'Gruppe Halbfinale Finale Relegation Clubmeister Aushang drucken' },
    { label: 'Platzbuchung für Turnierspiele', page: 'turniere', tab: ['turniere', 'einstellungen'], card: 'Platzbuchung', in: 'Einstellungen', words: 'Dauer Spiel Stunden Platz buchen' },
    { label: 'Einstellungen der Turniere übertragen', page: 'turniere', tab: ['turniere', 'einstellungen'], card: 'Einstellungen übertragen', in: 'Einstellungen', words: 'Export Import sichern Datei' },
  ]);
})();
