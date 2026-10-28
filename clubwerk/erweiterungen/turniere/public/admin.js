'use strict';
/* Verwaltungsseiten des Moduls „Turniere“:
   „Clubmeisterschaft“ – Reiter Übersicht · Teilnehmer · Spiele · Tabellen · Ehrentafel · Einstellungen (hier).
   „Turniertag“ – LK-Turniere mit nuLiga-Import (lk-admin.js, wird beim ersten Öffnen nachgeladen).
   „Turnierplaner“ – freie Turniere wie das Dorfturnier (ft-admin.js, wird beim ersten Öffnen nachgeladen; Detailansicht je Turnier).
   Tabellen, K.-o.-Baum und Ergebnis-Anzeige aus ansicht.js – dieselben Bausteine wie in der Mitglieder-App und am Tablet. */
(() => {
  const GK = window.GK;
  const { $, esc, toast, fail } = GK;
  const api = (url, method, body) => GK.api('x/turniere/' + url, method, body);
  const EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  const DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
  const st = { meta: null, sid: null, d: null, tabs: null, mf: sessionStorage.getItem('tu_mf') || 'offen', lf: 'alle' };
  const dm = s => (s ? GK.deDate(s) : '–');
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
    const closed = st.meta.seasons.filter(x => x.closed_at);
    GK.dialog(`<h2>${s ? 'Saison bearbeiten' : 'Neue Saison'}</h2>
      <div class="row"><label class="f" style="flex:2 1 240px">Name<input id="tsN" maxlength="60" value="${esc(s ? s.name : `Clubmeisterschaft ${y}`)}" placeholder="z. B. Clubmeisterschaft ${y}"></label>
        <label class="f" style="flex:1 1 140px">Ligen<select id="tsL" ${s && s.drawn_at ? 'disabled' : ''}>${st.meta.letters.map((l, i) => `<option value="${i + 1}" ${i + 1 === n ? 'selected' : ''}>${i + 1} (A${i ? '–' + l : ''})</option>`).join('')}</select></label></div>
      <label class="f" style="margin-top:12px">Doppel-Ligen<input id="tsD" value="${esc(s ? s.doubles.join(', ') : st.meta.defaults[n])}" placeholder="z. B. A+B, C+D" ${s && s.paired_at ? 'disabled' : ''}></label>
      <p class="muted s" style="margin:4px 0 0">Je zwei benachbarte Einzel-Ligen bilden eine Doppel-Liga; die Partner kommen je aus der oberen und der unteren Liga. Eine Liga allein (z. B. „E“): Partner innerhalb der Liga. Leer = kein Doppel.</p>
      <div class="row" style="margin-top:12px"><label class="f" style="flex:1 1 180px">Anmeldeschluss<input type="date" id="tsR" value="${esc(s ? s.reg_until || '' : '')}"></label>
        <label class="f" style="flex:1 1 180px">Frist Gruppenphase<input type="date" id="tsG" value="${esc(s ? s.due_groups || '' : '')}"></label>
        <label class="f" style="flex:1 1 180px">Frist Endspiele + Relegation<input type="date" id="tsF" value="${esc(s ? s.due_final || '' : '')}"></label></div>
      ${!s && closed.length ? `<label class="f" style="margin-top:12px">Einteilung übernehmen<select id="tsC"><option value="">– nicht übernehmen –</option>${closed.map((x, i) => `<option value="${x.id}" ${i ? '' : 'selected'}>aus „${esc(x.name)}“ (mit Relegation)</option>`).join('')}</select></label>` : ''}
      <p class="muted s" style="margin:10px 0 0">Jede Liga wird in zwei Gruppen gelost (ab 6 Spielern, sonst eine). Die Endrunde spielt im Einzel nur die oberste Liga, im Doppel jede Doppel-Liga; die Relegation entscheidet über Auf- und Abstieg.</p>
      <div class="btns"><button class="btn ghost" id="tsX">Abbrechen</button><button class="btn primary" id="tsOk">${s ? 'Speichern' : 'Anlegen'}</button></div>
      ${s ? '<div class="btns" style="margin-top:8px;border-top:1px solid var(--line);padding-top:12px"><button class="btn danger" id="tsDel">Saison löschen</button></div>' : ''}`, true);
    let auto = !s;
    $('tsL').onchange = () => { if (auto) $('tsD').value = st.meta.defaults[$('tsL').value]; };
    $('tsD').oninput = () => { auto = false; };
    $('tsX').onclick = GK.closeDialog;
    $('tsOk').onclick = () => GK.busy($('tsOk'), async () => {
      const body = { name: $('tsN').value, leagues: +$('tsL').value, doubles: $('tsD').value, reg_until: $('tsR').value, due_groups: $('tsG').value, due_final: $('tsF').value };
      if ($('tsC') && $('tsC').value) body.carry = +$('tsC').value;
      try {
        if (s) await api('saison/' + s.id, 'PUT', body);
        else { const r = await api('saison', 'POST', body); sessionStorage.setItem('tu_sid', r.id); if (r.carried) toast(`Saison angelegt – ${r.carried} Personen aus der Vorsaison eingeteilt. Mitglieder melden sich jetzt in der App an.`); }
        GK.closeDialog(); if (s || !body.carry) toast(s ? 'Gespeichert.' : 'Saison angelegt – Mitglieder können sich jetzt in der App anmelden.'); render();
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
    const reg = d.players.filter(p => p.singles || p.doubles).length, hasD = s.doubles.length > 0;
    const regDone = !s.regOpen;
    const pending = d.matches.some(m => !m.done);
    let step = '';
    const btn = (id, l, prim) => `<button class="btn${prim ? ' primary' : ''}" id="${id}">${l}</button>`;
    if (s.closed_at) step = '<p>Die Saison ist abgeschlossen – die Clubmeister stehen in der Ehrentafel.</p>';
    else if (s.regOpen) step = `<p>Die Anmeldung läuft${s.reg_until ? ` bis ${dm(s.reg_until)}` : ''}: ${reg} ${reg === 1 ? 'Person ist' : 'Personen sind'} angemeldet. Danach die Gruppen${hasD ? ' und die Doppelpartner' : ''} auslosen.</p><div class="btns">${btn('tuGoP', 'Teilnehmer ansehen')}</div>`;
    else {
      const todo = [];
      if (!s.drawn_at) todo.push(['tuDraw', 'Einzel-Gruppen auslosen']);
      if (hasD && !s.paired_at) todo.push(['tuPair', 'Doppelpartner auslosen']);
      if (hasD && s.paired_at && !s.ddrawn_at) todo.push(['tuDGroups', 'Doppel-Gruppen auslosen']);
      if (todo.length) step = `<p>Die Anmeldung ist vorbei – ${reg} Teilnehmer. Als Nächstes: ${todo.map(t => t[1]).join(', ')}.</p><div class="btns">${todo.map((t, k) => btn(t[0], t[1], k === 0)).join('')}</div>`;
      else if (groupOpen) step = `<p>Gruppenphase: ${groupAll - groupOpen} von ${groupAll} Spielen gewertet${s.due_groups ? `, Frist ${dm(s.due_groups)}` : ''}. Endrunde und Relegation setzt Clubwerk von selbst, sobald eine Liga fertig ist.</p><div class="btns">${btn('tuEnd', 'Gruppenphase beenden …')}</div>`;
      else step = `<p>${d.champion ? `Clubmeister: <b translate="no">${esc(d.champion)}</b>. ` : ''}${pending ? `Endrunde und Relegation laufen${s.due_final ? ` bis ${dm(s.due_final)}` : ''}: ${c.open} ${c.open === 1 ? 'Spiel ist' : 'Spiele sind'} offen.` : 'Alle Spiele sind gewertet.'} Zum Schluss die Saison abschließen: Die Clubmeister kommen in die Ehrentafel, die nächste Saison übernimmt die Einteilung.</p>
        <div class="btns">${btn('tuClose', 'Saison abschließen …', !pending)}</div>`;
    }
    el.innerHTML = `<div class="kpis"><div class="kpi"><div class="l">Angemeldet</div><div class="v">${reg}</div></div><div class="kpi"><div class="l">Offene Spiele</div><div class="v">${c.open}</div></div>
        <div class="kpi"><div class="l">Überfällig</div><div class="v">${c.overdue}</div></div><div class="kpi"><div class="l">Gewertet</div><div class="v">${c.done}</div></div></div>
      <div class="card tu-step" data-card="naechster"><h3>Nächster Schritt</h3>${step}</div>
      ${late.length ? `<div class="card" data-card="ueberfaellig"><h3>Überfällige Spiele</h3><table class="tbl kompakt"><tr><th>Spiel</th><th>Runde</th><th>Frist</th><th></th></tr>
        ${late.map(m => `<tr><td translate="no"><b>${esc(m.a)} – ${esc(m.b)}</b></td><td>${esc(m.where)}</td><td class="nw">${dm(m.due)}</td><td class="r"><span class="acts"><button class="btn ico" data-rem="${m.id}" title="Erinnerung schicken" aria-label="Erinnerung schicken">${BELL}</button></span></td></tr>`).join('')}</table>
        <div class="btns"><button class="btn" id="tuRemAll">Alle erinnern</button></div></div>` : ''}
      <div class="card" data-card="saison"><h3>Saison</h3>
        <dl class="vh-kv tu-kv"><dt>Name</dt><dd>${esc(s.name)}</dd><dt>Ligen</dt><dd>${esc(s.leagues.join(', '))}</dd><dt>Doppel-Ligen</dt><dd>${esc(s.doubles.join(', ') || '–')}</dd><dt>Anmeldeschluss</dt><dd>${dm(s.reg_until)}</dd>
          <dt>Frist Gruppenphase</dt><dd>${dm(s.due_groups)}</dd><dt>Frist Endspiele + Relegation</dt><dd>${dm(s.due_final)}</dd></dl>
        <div class="btns"><button class="btn" id="tuEdit">Saison bearbeiten</button></div></div>`;
    tools(el, `${seasons.length > 1 ? `<label class="f" style="flex:0 1 260px">Saison<select id="tuSid">${seasons.map(x => `<option value="${x.id}" ${x.id === st.sid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}<button class="btn primary" id="tuNew">+ Neue Saison</button>`);
    if ($('tuSid')) $('tuSid').onchange = () => { st.sid = +$('tuSid').value; sessionStorage.setItem('tu_sid', st.sid); reloadAll().catch(fail); };
    $('tuNew').onclick = () => seasonDialog(null);
    $('tuEdit').onclick = () => seasonDialog(s);
    if ($('tuGoP')) $('tuGoP').onclick = () => { const b = document.querySelector('#tuTabs [data-tab="teilnehmer"]'); if (b) b.click(); };
    if ($('tuDraw')) $('tuDraw').onclick = () => draw(null);
    if ($('tuEnd')) $('tuEnd').onclick = endPhase;
    if ($('tuPair')) $('tuPair').onclick = () => drawStep('partner');
    if ($('tuDGroups')) $('tuDGroups').onclick = () => drawStep('doppel');
    if ($('tuClose')) $('tuClose').onclick = closeSeason;
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
  /** Doppel: Partner auslosen bzw. Paare in Gruppen losen (alle Doppel-Ligen oder eine) */
  async function drawStep(step, league = null) {
    const what = step === 'partner' ? 'Doppelpartner' : 'Doppel-Gruppen';
    const text = step === 'partner'
      ? `${what} auslosen?\n\nIn jeder Doppel-Liga bekommt jede Person aus der oberen Liga einen Partner aus der unteren (eine Liga allein: Partner innerhalb der Liga). Wer übrig bleibt, steht danach unter „ohne Partner“ – du entscheidest, ob daraus ein Paar wird.`
      : `${what} auslosen?\n\nDie Paare jeder Doppel-Liga werden zufällig auf die Gruppen verteilt (gleich groß, ± 1). Danach lassen sich die Paare nicht mehr ändern.`;
    if (!await GK.ask(league ? `Doppel ${league} neu auslosen?\n\nBisherige ${what} und ihre Spiele werden ersetzt.` : text, { ok: 'Auslosen', danger: Boolean(league) })) return;
    try {
      const r = await api(`saison/${st.sid}/auslosen`, 'POST', { step, ...(league ? { league } : {}) });
      const rest = r.unpaired ? Object.entries(r.unpaired).map(([k, v]) => `Doppel ${k} ohne Partner: ${v.join(', ')}`) : [];
      toast(r.drawn.length ? `Ausgelost: Doppel ${r.drawn.join(', ')}${[...r.skipped, ...rest].length ? ` – ${[...r.skipped, ...rest].join('; ')}` : ''}` : `Nichts ausgelost: ${r.skipped.join('; ') || 'keine Doppel-Anmeldungen'}`, !r.drawn.length);
      reloadAll();
    } catch (e) { fail(e); }
  }
  async function closeSeason() {
    let r; try { r = await api(`saison/${st.sid}/abschluss`, 'POST', { preview: true }); } catch (e) { return fail(e); }
    GK.dialog(`<h2>Saison abschließen</h2>
      ${r.open ? `<div class="banner a" style="margin-bottom:12px">${r.open} ${r.open === 1 ? 'Spiel ist' : 'Spiele sind'} noch offen – danach lassen sich keine Ergebnisse mehr eintragen.</div>` : ''}
      <h3 style="margin:0 0 6px">Ehrentafel</h3>${r.champions.length ? `<dl class="vh-kv tu-kv">${r.champions.map(c => `<dt>${esc(c.title)}</dt><dd translate="no">${esc(c.names)}</dd>`).join('')}</dl>` : '<p class="muted">Noch kein Finale gespielt – die Ehrentafel bleibt für diese Saison leer.</p>'}
      <h3 style="margin:14px 0 6px">Folgesaison</h3>${r.moves.length ? `<p class="muted s" style="margin:0 0 6px">Durch die Relegation wechseln:</p><dl class="vh-kv tu-kv">${r.moves.map(x => `<dt translate="no">${esc(x.name)}</dt><dd>Liga ${esc(x.from)} → ${esc(x.to)}</dd>`).join('')}</dl>` : '<p class="muted">Niemand wechselt die Liga – alle bleiben, wo sie sind.</p>'}
      <p class="muted s" style="margin:10px 0 0">Bei „+ Neue Saison“ lässt sich diese Einteilung übernehmen.</p>
      <div class="btns"><button class="btn ghost" id="tcX">Abbrechen</button><button class="btn primary" id="tcOk">Abschließen</button></div>`, true);
    $('tcX').onclick = GK.closeDialog;
    $('tcOk').onclick = () => GK.busy($('tcOk'), async () => { try { await api(`saison/${st.sid}/abschluss`, 'POST', {}); GK.closeDialog(); toast('Saison abgeschlossen – die Clubmeister stehen in der Ehrentafel.'); reloadAll(); } catch (e) { fail(e); } });
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
    const d = st.d, s = d.season, L = s.leagues, hasD = s.doubles.length > 0;
    const groupOf = new Map();
    d.leagues.forEach(l => l.groups.forEach(g => g.table.forEach(r => groupOf.set(r.name, g.label))));
    const F = { alle: () => true, angemeldet: p => p.singles || p.doubles, ...Object.fromEntries(L.map(l => [l, p => p.league === l])) };
    if (!F[st.lf]) st.lf = 'alle';
    const list = d.players.filter(F[st.lf]);
    const drawn = Boolean(s.drawn_at), open = !s.closed_at;
    /** Spielt: Häkchen zum Ändern, nach der Auslosung als Text */
    const plays = (p, lockS, lockD) => { const ks = [['singles', 'Einzel', lockS], ...(hasD ? [['doubles', 'Doppel', lockD]] : [])];
      return (lockS && (lockD || !hasD)) || !open ? esc(ks.filter(k => p[k[0]]).map(k => k[1]).join(' · ') || '–')
        : ks.map(([k, l, lock]) => `<label class="chk" style="margin:0 12px 0 0;display:inline-flex"><input type="checkbox" data-ck="${k}" data-m="${p.member_id}" ${p[k] ? 'checked' : ''} ${lock ? 'disabled' : ''}> ${l}</label>`).join(''); };
    const pairOf = new Set(d.pairs.flatMap(x => x.teams.flatMap(t => t.members)));
    el.innerHTML = `<div class="chips" id="tuLf" role="group" aria-label="Filter">${[['alle', 'Alle'], ['angemeldet', 'Angemeldet'], ...L.map(l => [l, `Liga ${l}`])].map(([k, l]) => `<button type="button" data-f="${k}" class="${st.lf === k ? 'on' : ''}" aria-pressed="${st.lf === k}">${esc(l)}<span class="cnt">${d.players.filter(F[k]).length}</span></button>`).join('')}</div>
      <div class="card">${list.length ? `<table class="tbl kompakt"><tr><th>Name</th><th>Liga</th><th>Gruppe</th><th>Spielt</th><th class="k-weg">Eingetragen</th><th></th></tr>
        ${list.map(p => { const g = groupOf.get(p.name), locked = g || pairOf.has(p.member_id); return `<tr><td translate="no"><b>${esc(p.name)}</b>${p.singles || p.doubles ? '' : ' <span class="pill">nicht angemeldet</span>'}</td>
          <td class="k-lbl" data-label="Liga">${locked || !open ? esc(p.league) : `<select data-lg="${p.member_id}" aria-label="Liga">${L.map(l => `<option ${l === p.league ? 'selected' : ''}>${l}</option>`).join('')}</select>`}</td>
          <td class="k-lbl" data-label="Gruppe">${g ? esc(g) : '–'}</td><td>${plays(p, Boolean(g), pairOf.has(p.member_id) || Boolean(s.paired_at))}</td>
          <td class="k-weg">${({ app: 'in der App', vorsaison: 'aus der Vorsaison', import: 'importiert' })[p.source] || 'von Hand'}</td>
          <td class="r"><span class="acts">${locked || !open ? '' : `<button class="btn ico" data-rm="${p.member_id}" title="Austragen" aria-label="Austragen">${DEL}</button>`}</span></td></tr>`; }).join('')}</table>`
        : `<p class="empty">${d.players.length ? 'In dieser Auswahl ist niemand.' : 'Noch keine Anmeldungen – Mitglieder melden sich in der App unter „Turniere“ an, oder „+ Spieler eintragen“ bzw. „Import …“.'}</p>`}</div>
      ${!open ? '' : `<div class="card tu-step" data-card="auslosung"><h3>Auslosung Einzel</h3>
        <p>${drawn ? `Ausgelost am ${dm(s.drawn_at.slice(0, 10))}. Neu losen oder tauschen geht, solange in der Gruppe noch kein Spiel gewertet ist.` : 'Jede Liga wird zufällig auf ihre Gruppen verteilt – gleich groß (± 1), zwei Gruppen ab 6 Spielern. Neu Angemeldete stehen in der untersten Liga; wer woanders hingehört, vorher umsetzen.'}</p>
        <div class="btns">${drawn ? '<button class="btn" id="tuSwap">Spieler tauschen …</button><button class="btn" id="tuRedraw">Liga neu auslosen …</button>' : '<button class="btn primary" id="tuDraw2">Einzel-Gruppen auslosen</button>'}</div></div>
      ${hasD ? pairsHtml(d) : ''}`}`;
    tools(el, !open ? '' : `${drawn || s.paired_at ? '' : '<button class="btn" id="tuImp">Import …</button>'}<button class="btn primary" id="tuAdd">+ Spieler eintragen</button>`);
    if ($('tuAdd')) $('tuAdd').onclick = addPlayer;
    if ($('tuImp')) $('tuImp').onclick = importDialog;
    el.querySelectorAll('#tuLf [data-f]').forEach(b => { b.onclick = () => { st.lf = b.dataset.f; showPlayers(el); }; });
    const upd = async (mid, body, msg) => { try { await api(`saison/${st.sid}/spieler/${mid}`, 'PUT', body); toast(msg); await season(); showPlayers(el); } catch (e) { fail(e); await season(); showPlayers(el); } };
    el.querySelectorAll('[data-lg]').forEach(x => { x.onchange = () => upd(x.dataset.lg, { league: x.value }, 'Umgesetzt.'); });
    el.querySelectorAll('[data-ck]').forEach(x => { x.onchange = () => upd(x.dataset.m, { [x.dataset.ck]: x.checked }, 'Gespeichert.'); });
    el.querySelectorAll('[data-rm]').forEach(b => { b.onclick = async () => { const p = d.players.find(x => x.member_id === +b.dataset.rm); if (!await GK.ask(`${p.name} austragen?`, { ok: 'Austragen', danger: true })) return; try { await api(`saison/${st.sid}/spieler/${p.member_id}`, 'DELETE'); await season(); showPlayers(el); } catch (e) { fail(e); } }; });
    if ($('tuDraw2')) $('tuDraw2').onclick = () => draw(null);
    if ($('tuRedraw')) $('tuRedraw').onclick = redrawDialog;
    if ($('tuSwap')) $('tuSwap').onclick = swapDialog;
    if ($('tuPair2')) $('tuPair2').onclick = () => drawStep('partner');
    if ($('tuDG2')) $('tuDG2').onclick = () => drawStep('doppel');
    if ($('tuRePair')) $('tuRePair').onclick = () => pickDoubles(k => drawStep('partner', k));
    if ($('tuReDG')) $('tuReDG').onclick = () => pickDoubles(k => drawStep('doppel', k));
    el.querySelectorAll('[data-mk]').forEach(b => { b.onclick = () => makePair(b.dataset.mk); });
    el.querySelectorAll('[data-dp]').forEach(b => { b.onclick = async () => { if (!await GK.ask('Paar auflösen?\n\nBeide stehen danach wieder ohne Partner da.', { ok: 'Auflösen', danger: true })) return; try { await api(`saison/${st.sid}/paar/${b.dataset.dp}`, 'DELETE'); reloadAll(); } catch (e) { fail(e); } }; });
  }
  /** Karte „Doppel“: Paare je Doppel-Liga, wer ohne Partner ist, Auslosung der Partner und der Gruppen */
  function pairsHtml(d) {
    const s = d.season, grouped = Boolean(s.ddrawn_at);
    return `<div class="card tu-step" data-card="doppel"><h3>Doppel</h3>
      <p>${!s.paired_at ? 'Erst die Partner auslosen: je eine Person aus der oberen und eine aus der unteren Einzel-Liga. Danach die Paare in Gruppen losen.' : grouped ? 'Paare und Gruppen stehen. Neu losen geht, solange in der Doppel-Liga noch kein Spiel gewertet ist.' : 'Die Partner stehen – wer übrig ist, kannst du zu einem Paar zusammenstellen. Dann die Doppel-Gruppen auslosen.'}</p>
      ${d.pairs.map(x => `<h4 style="margin:14px 0 6px">Doppel ${esc(x.key)}</h4>${x.teams.length ? `<table class="tbl kompakt"><tr><th>Paar</th><th>Gruppe</th><th></th></tr>${x.teams.map(t => `<tr><td translate="no"><b>${esc(t.name)}</b></td><td class="k-lbl" data-label="Gruppe">${t.group ? t.group : '–'}</td><td class="r"><span class="acts">${t.group ? '' : `<button class="btn ico" data-dp="${t.id}" title="Paar auflösen" aria-label="Paar auflösen">${DEL}</button>`}</span></td></tr>`).join('')}</table>` : `<p class="empty">${s.paired_at ? 'Keine Paare.' : 'Noch nicht ausgelost.'}</p>`}
        ${x.unpaired.length ? `<p class="muted s" style="margin:8px 0 0">${s.paired_at ? 'Ohne Partner' : 'Angemeldet'}: <span translate="no">${x.unpaired.map(u => esc(u.name)).join('; ')}</span></p>${s.paired_at && x.unpaired.length >= 2 && !x.teams.some(t => t.group) ? `<div class="btns"><button class="btn" data-mk="${esc(x.key)}">Paar bilden …</button></div>` : ''}` : ''}`).join('')}
      <div class="btns">${!s.paired_at ? '<button class="btn primary" id="tuPair2">Doppelpartner auslosen</button>' : grouped ? '<button class="btn" id="tuReDG">Doppel-Gruppen neu losen …</button>' : '<button class="btn" id="tuRePair">Partner neu losen …</button><button class="btn primary" id="tuDG2">Doppel-Gruppen auslosen</button>'}</div></div>`;
  }
  function pickDoubles(then) {
    const ks = st.d.season.doubles;
    GK.dialog(`<h2>Doppel neu auslosen</h2><p class="muted">Geht nur, solange in der Doppel-Liga noch kein Spiel gewertet ist.</p>
      <label class="f">Doppel-Liga<select id="tkL">${ks.map(k => `<option>${esc(k)}</option>`).join('')}</select></label>
      <div class="btns"><button class="btn ghost" id="tkX">Abbrechen</button><button class="btn primary" id="tkOk">Weiter</button></div>`);
    $('tkX').onclick = GK.closeDialog;
    $('tkOk').onclick = () => { const k = $('tkL').value; GK.closeDialog(); then(k); };
  }
  function makePair(key) {
    const x = st.d.pairs.find(y => y.key === key);
    const opts = x.unpaired.map(u => `<option value="${u.member_id}" translate="no">${esc(u.name)}</option>`).join('');
    GK.dialog(`<h2>Paar bilden – Doppel ${esc(key)}</h2><p class="muted">Aus den Übrigen ohne Partner. Ein Dreier-Team gibt es nicht.</p>
      <div class="row"><label class="f" style="flex:1 1 200px">Spieler 1<select id="tmA"><option value="">Bitte wählen …</option>${opts}</select></label><label class="f" style="flex:1 1 200px">Spieler 2<select id="tmB"><option value="">Bitte wählen …</option>${opts}</select></label></div>
      <div class="btns"><button class="btn ghost" id="tmX">Abbrechen</button><button class="btn primary" id="tmOk">Paar bilden</button></div>`);
    $('tmX').onclick = GK.closeDialog;
    $('tmOk').onclick = () => GK.busy($('tmOk'), async () => { try { await api(`saison/${st.sid}/paar`, 'POST', { league: key, p1: +$('tmA').value, p2: +$('tmB').value }); GK.closeDialog(); toast('Paar gebildet.'); reloadAll(); } catch (e) { fail(e); } });
  }
  /** Import einer Einteilung (Excel/CSV): Datei wählen, Namen zuordnen (bei ähnlichen Namen nachfragen), übernehmen */
  function importDialog() {
    GK.dialog(`<h2>Einteilung importieren</h2>
      <p class="muted">Einmalig, damit die Vorsaison nicht neu getippt werden muss: Excel (.xlsx) oder CSV mit den Spalten „Name“ (oder „Vorname“ und „Nachname“) und „Liga“ – oder je Liga ein Blatt namens „A“, „B1“ …</p>
      <label class="f">Datei<input type="file" id="tiF" accept=".xlsx,.csv,.txt"></label>
      <div id="tiR"></div>
      <div class="btns"><button class="btn ghost" id="tiX">Abbrechen</button><button class="btn primary" id="tiOk" disabled>Übernehmen</button></div>`, true);
    $('tiX').onclick = GK.closeDialog;
    let rows = [];
    $('tiF').onchange = async () => {
      const f = $('tiF').files[0]; if (!f) return;
      const b64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = no; r.readAsDataURL(f); });
      try { rows = (await api(`saison/${st.sid}/import`, 'POST', { name: f.name, file: b64 })).rows; } catch (e) { $('tiR').innerHTML = ''; $('tiOk').disabled = true; return fail(e); }
      const sure = rows.filter(r => r.sure).length;
      $('tiR').innerHTML = `<p class="muted s" style="margin:12px 0 6px">${rows.length} Zeilen – ${sure} sicher zugeordnet${rows.length - sure ? `, ${rows.length - sure} bitte prüfen` : ''}.</p>
        <table class="tbl kompakt"><tr><th>In der Datei</th><th>Liga</th><th>Mitglied</th></tr>${rows.map((r, i) => `<tr><td translate="no"><b>${esc(r.name)}</b></td><td class="k-lbl" data-label="Liga">${esc(r.league)}</td>
          <td>${r.sure ? `<span translate="no">${esc(r.name)}</span> <span class="pill g">sicher</span>` : `<select data-ix="${i}" aria-label="Mitglied"><option value="">${r.candidates.length ? 'Bitte wählen …' : 'nicht übernehmen'}</option>${r.candidates.map(c => `<option value="${c.id}" translate="no">${esc(c.ln)}</option>`).join('')}${r.candidates.length ? '<option value="">nicht übernehmen</option>' : ''}</select>`}</td></tr>`).join('')}</table>`;
      $('tiR').querySelectorAll('[data-ix]').forEach(x => { x.onchange = () => { rows[+x.dataset.ix].member_id = x.value ? +x.value : null; }; });
      $('tiOk').disabled = false;
    };
    $('tiOk').onclick = () => GK.busy($('tiOk'), async () => {
      const take = rows.filter(r => r.member_id).map(r => ({ member_id: r.member_id, league: r.league }));
      if (!take.length) return toast('Keine Zeile zugeordnet.', true);
      try { const r = await api(`saison/${st.sid}/import`, 'POST', { rows: take }); GK.closeDialog(); toast(`${r.n} Personen eingeteilt – angemeldet ist damit noch niemand.`); reloadAll(); } catch (e) { fail(e); }
    });
  }
  async function addPlayer() {
    let people; try { people = await api('leute'); } catch (e) { return fail(e); }
    const inside = new Set(st.d.players.map(p => p.member_id)), L = st.d.season.leagues;
    GK.dialog(`<h2>Spieler eintragen</h2>
      <label class="f">Name<input id="tpQ" placeholder="Namen eingeben" autocomplete="off"></label>
      <label class="f" style="margin-top:12px">Mitglied<select id="tpM" size="6"></select></label>
      <label class="f" style="margin-top:12px">Liga<select id="tpL">${L.map((l, i) => `<option ${i === L.length - 1 ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="row" style="margin-top:12px"><label class="chk"><input type="checkbox" id="tpS" checked> Einzel</label>${st.d.season.doubles.length ? '<label class="chk"><input type="checkbox" id="tpD"> Doppel</label>' : ''}</div>
      <div class="btns"><button class="btn ghost" id="tpX">Abbrechen</button><button class="btn primary" id="tpOk">Eintragen</button></div>`);
    const fill = () => { const q = $('tpQ').value.trim().toLowerCase(); $('tpM').innerHTML = people.filter(p => !inside.has(p.id) && (!q || p.ln.toLowerCase().includes(q))).slice(0, 200).map(p => `<option value="${p.id}" translate="no">${esc(p.ln)}</option>`).join(''); };
    fill(); $('tpQ').oninput = fill; $('tpQ').focus();
    $('tpX').onclick = GK.closeDialog;
    $('tpOk').onclick = () => GK.busy($('tpOk'), async () => {
      if (!$('tpM').value) return toast('Bitte ein Mitglied wählen.', true);
      try { await api(`saison/${st.sid}/spieler`, 'POST', { member_id: +$('tpM').value, league: $('tpL').value, singles: $('tpS').checked, doubles: Boolean($('tpD') && $('tpD').checked) }); inside.add(+$('tpM').value); toast('Eingetragen.'); $('tpQ').value = ''; fill(); $('tpQ').focus(); await season(); if (st.tabs) st.tabs.reload(); }
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
    const lab = (l, g) => (l.includes('+') ? `${l} ${g}` : `${l}${g}`);
    GK.dialog(`<h2>Spieler tauschen</h2><p class="muted">Zwei Spieler derselben Liga wechseln die Gruppe. Geht nur, solange in beiden Gruppen noch kein Spiel gewertet ist.</p>
      <label class="f">Liga<select id="twL">${leagues.map(l => `<option value="${esc(l)}">${l.includes('+') ? `Doppel ${esc(l)}` : `Liga ${esc(l)}`}</option>`).join('')}</select></label>
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
    const dbl = (d.doubles || []).filter(x => x.groups.length).map(x => `<h2 class="sec">${esc(x.label)}</h2>${x.finals.length ? `<div class="${card}" style="margin-bottom:12px">${V.tree(x.finals, x.champion, `Clubmeister ${x.label}`)}</div>` : ''}<div class="tu-groups">${x.groups.map(g => `<div class="${card}"><h3><span>Gruppe <span translate="no">${esc(g.label)}</span></span></h3>${V.table(g, { up: 2 })}</div>`).join('')}</div>`).join('');
    return ko + rel + lg + dbl;
  }
  async function showTables(el) {
    const d = st.d;
    el.innerHTML = d.leagues.some(l => l.groups.length) ? tablesHtml(false) : '<div class="card"><p class="empty">Noch keine Gruppen – erst die Gruppen auslosen (Reiter „Teilnehmer“).</p></div>';
    tools(el, d.leagues.some(l => l.groups.length) ? '<button class="btn" id="tuPrint">Drucken</button>' : '');
    if ($('tuPrint')) $('tuPrint').onclick = () => GK.printHtml(`<div class="pr"><h2 style="margin:0 0 4mm;font-size:14pt">${esc(d.season.name)}</h2>${tablesHtml(true)}</div>`);
  }

  /* ---------- Ehrentafel ---------- */
  async function showHonors(el) {
    let list; try { list = await api('ehrentafel'); } catch (e) { return fail(e); }
    el.innerHTML = `<div class="card">${list.length ? `<table class="tbl kompakt"><tr><th>Name</th><th>Jahr</th><th>Titel</th><th></th></tr>${list.map(h => `<tr><td translate="no"><b>${esc(h.names)}</b></td><td class="tu-num">${esc(h.year)}</td><td>${esc(h.title)}</td>
        <td class="r"><span class="acts">${h.season_id ? '' : `<button class="btn ico" data-hd="${h.id}" title="Eintrag löschen" aria-label="Eintrag löschen">${DEL}</button>`}</span></td></tr>`).join('')}</table>`
      : '<p class="empty">Noch keine Clubmeister – sie kommen beim Saisonabschluss von selbst hierher. Frühere Jahre lassen sich mit „+ Eintrag“ ergänzen.</p>'}</div>`;
    tools(el, '<button class="btn primary" id="tuHon">+ Eintrag</button>');
    $('tuHon').onclick = () => {
      GK.dialog(`<h2>Ehrentafel ergänzen</h2><p class="muted">Für Jahre vor Clubwerk – spätere Clubmeister trägt der Saisonabschluss selbst ein.</p>
        <div class="row"><label class="f" style="flex:0 1 120px">Jahr<input id="thY" inputmode="numeric" maxlength="4" placeholder="z. B. 2019"></label><label class="f" style="flex:1 1 220px">Titel<input id="thT" maxlength="60" value="Clubmeister Einzel" list="thTL"><datalist id="thTL"><option>Clubmeister Einzel</option><option>Clubmeister Doppel A+B</option><option>Clubmeister Doppel C+D</option></datalist></label></div>
        <label class="f" style="margin-top:12px">Name(n)<input id="thN" maxlength="120" placeholder="z. B. Max Muster"></label>
        <div class="btns"><button class="btn ghost" id="thX">Abbrechen</button><button class="btn primary" id="thOk">Speichern</button></div>`);
      $('thX').onclick = GK.closeDialog;
      $('thOk').onclick = () => GK.busy($('thOk'), async () => { try { await api('ehrentafel', 'POST', { year: $('thY').value, title: $('thT').value, names: $('thN').value }); GK.closeDialog(); toast('Gespeichert.'); showHonors(el); } catch (e) { fail(e); } });
    };
    el.querySelectorAll('[data-hd]').forEach(b => { b.onclick = async () => { if (!await GK.ask('Eintrag löschen?')) return; try { await api('ehrentafel/' + b.dataset.hd, 'DELETE'); showHonors(el); } catch (e) { fail(e); } }; });
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
    await meta();
    await season();
    $('main').innerHTML = `<h2 class="page">Clubmeisterschaft</h2><p class="lead" id="tuLead"></p><div id="tuTabs"></div>`;
    lead();
    if (!st.d) {
      $('tuTabs').innerHTML = `<div class="card"><p class="empty">Noch keine Clubmeisterschaft angelegt – mit „+ Neue Saison“ geht es los: Ligen, Anmeldeschluss und Fristen festlegen, dann melden sich die Mitglieder in der App an.</p>
        <div class="btns"><button class="btn primary" id="tuNew0">+ Neue Saison</button></div></div>`;
      $('tuNew0').onclick = () => seasonDialog(null);
      return;
    }
    st.tabs = GK.tabs($('tuTabs'), 'turniere', [['uebersicht', 'Übersicht'], ['teilnehmer', 'Teilnehmer'], ['spiele', 'Spiele'], ['tabellen', 'Tabellen'], ['ehrentafel', 'Ehrentafel'], ['einstellungen', 'Einstellungen']], async (k, el) => {
      if (!st.d) await season();
      if (k === 'uebersicht') return showOverview(el);
      if (k === 'teilnehmer') return showPlayers(el);
      if (k === 'spiele') return showMatches(el);
      if (k === 'tabellen') return showTables(el);
      if (k === 'ehrentafel') return showHonors(el);
      return showSettings(el);
    });
  }
  GK.registerPage({ key: 'turniere', title: 'Clubmeisterschaft', perm: 'turniere', render, icon: 'turnier', order: 2.7 });
  const loadLK = () => new Promise(res => { if (window.TurnierLK) return res(); const sc = document.createElement('script'); sc.src = 'x/turniere/lk-admin.js'; sc.onload = res; sc.onerror = res; document.body.appendChild(sc); });
  GK.registerPage({ key: 'turniertag', title: 'Turniertag', perm: 'turniere', icon: 'turnier', order: 2.71, render: async () => { await loadLK(); if (!window.TurnierLK) throw new Error('Die Seite „Turniertag“ konnte nicht geladen werden.'); return window.TurnierLK.render(); } });
  const loadFT = () => new Promise(res => { if (window.TurnierFT) return res(); const sc = document.createElement('script'); sc.src = 'x/turniere/ft-admin.js'; sc.onload = res; sc.onerror = res; document.body.appendChild(sc); });
  const needFT = async () => { await loadFT(); if (!window.TurnierFT) throw new Error('Die Seite „Turnierplaner“ konnte nicht geladen werden.'); return window.TurnierFT; };
  GK.registerPage({ key: 'turnierplaner', title: 'Turnierplaner', perm: 'turniere', icon: 'turnier', order: 2.72, render: async () => (await needFT()).render() });
  GK.registerDetail({ key: 'turnier', page: 'turnierplaner', back: 'Alle Turniere', perm: 'turniere', load: async id => (await needFT()).load(id), render: async (...a) => (await needFT()).detail(...a) });
  if (GK.registerSearch) GK.registerSearch([
    { label: 'Clubmeisterschaft', page: 'turniere', tab: ['turniere', 'uebersicht'], kind: 'reiter', in: 'Übersicht', words: 'Turnier Saison Vereinsmeisterschaft Liga', boost: 1 },
    { label: 'Neue Saison anlegen', page: 'turniere', tab: ['turniere', 'uebersicht'], btn: '+ Neue Saison', kind: 'aktion', in: 'Übersicht', words: 'Clubmeisterschaft Ligen Fristen Anmeldeschluss' },
    { label: 'Teilnehmer der Clubmeisterschaft', page: 'turniere', tab: ['turniere', 'teilnehmer'], kind: 'reiter', in: 'Teilnehmer', words: 'Anmeldung Liga Spieler einteilen' },
    { label: 'Spieler eintragen', page: 'turniere', tab: ['turniere', 'teilnehmer'], btn: '+ Spieler', kind: 'aktion', in: 'Teilnehmer', words: 'Clubmeisterschaft Anmeldung von Hand' },
    { label: 'Gruppen auslosen', page: 'turniere', tab: ['turniere', 'teilnehmer'], card: 'Auslosung', kind: 'aktion', in: 'Teilnehmer', words: 'losen Auslosung Gruppen tauschen' },
    { label: 'Spiele und Ergebnisse', page: 'turniere', tab: ['turniere', 'spiele'], kind: 'reiter', in: 'Spiele', words: 'Ergebnis korrigieren kampflos Aufgabe überfällig Erinnerung' },
    { label: 'Tabellen und Endrunde', page: 'turniere', tab: ['turniere', 'tabellen'], kind: 'reiter', in: 'Tabellen', words: 'Gruppe Halbfinale Finale Relegation Clubmeister Aushang drucken' },
    { label: 'Doppelpartner auslosen', page: 'turniere', tab: ['turniere', 'teilnehmer'], card: 'Doppel', kind: 'aktion', in: 'Teilnehmer', words: 'Doppel Partner Paar Gruppen' },
    { label: 'Einteilung importieren', page: 'turniere', tab: ['turniere', 'teilnehmer'], kind: 'aktion', in: 'Teilnehmer › Import (vor der Auslosung)', words: 'Excel CSV Vorsaison Liste' },
    { label: 'Ehrentafel der Clubmeister', page: 'turniere', tab: ['turniere', 'ehrentafel'], kind: 'reiter', in: 'Ehrentafel', words: 'Clubmeister Sieger Jahre Saisonabschluss' },
    { label: 'Platzbuchung für Turnierspiele', page: 'turniere', tab: ['turniere', 'einstellungen'], card: 'Platzbuchung', in: 'Einstellungen', words: 'Dauer Spiel Stunden Platz buchen' },
    { label: 'Turniertag (LK-Turnier)', page: 'turniertag', tab: ['turniertag', 'zentrale'], kind: 'reiter', in: 'Zentrale', words: 'LK Turnier nuLiga Turnierzentrale Plätze Warteschlange verteilen', boost: 1 },
    { label: 'Turnier aus nuLiga importieren', page: 'turniertag', tab: ['turniertag', 'zentrale'], btn: 'Neu einlesen', kind: 'aktion', in: 'Zentrale', words: 'nuLiga XML CSV Import Meldeliste Nachmeldung' },
    { label: 'Zeitplan des Turniertags', page: 'turniertag', tab: ['turniertag', 'zeitplan'], kind: 'reiter', in: 'Zeitplan', words: 'Verzug Uhrzeit Platz Matches nachrutschen' },
    { label: 'Check-in und Nenngeld', page: 'turniertag', tab: ['turniertag', 'checkin'], kind: 'reiter', in: 'Check-in', words: 'einchecken abwesend bar digital Kassenbericht QR-Code Spielerseite' },
    { label: 'Ergebnisliste für nuLiga', page: 'turniertag', tab: ['turniertag', 'ergebnisse'], kind: 'reiter', in: 'Ergebnisse', words: 'abtippen drucken Runde Konkurrenz' },
    { label: 'Turnierplätze und Sperre im Buchungssystem', page: 'turniertag', tab: ['turniertag', 'plaetze'], card: 'Sperre im Buchungssystem', in: 'Plätze', words: 'sperren Halle Platz zuordnen' },
    { label: 'Löschfrist fremder Spieler', page: 'turniertag', tab: ['turniertag', 'einstellungen'], card: 'Datenschutz', in: 'Einstellungen', words: 'Datenschutz löschen Turnier Spieler' },
    { label: 'Dauer je Match und Pause', page: 'turniertag', tab: ['turniertag', 'einstellungen'], card: 'Zeitplan', in: 'Einstellungen', words: 'Matchdauer Pause Zeitplan' },
    { label: 'Turnierplaner (Dorfturnier)', page: 'turnierplaner', tab: ['turnierplaner', 'turniere'], kind: 'reiter', in: 'Turniere', words: 'Dorfturnier Fußball Tennis Gruppen Endrunde K.-o. Schleifchen jeder gegen jeden Spielplan Monitor', boost: 1 },
    { label: 'Neues Turnier anlegen', page: 'turnierplaner', tab: ['turnierplaner', 'turniere'], btn: '+ Neues Turnier', kind: 'aktion', in: 'Turniere', words: 'Dorfturnier Turnierplaner anlegen' },
    { label: 'Ehrentafel der Turniere', page: 'turnierplaner', tab: ['turnierplaner', 'ehrentafel'], kind: 'reiter', in: 'Ehrentafel', words: 'Sieger Dorfturnier Jahre' },
    { label: 'Einstellungen der Turniere übertragen', page: 'turniere', tab: ['turniere', 'einstellungen'], card: 'Einstellungen übertragen', in: 'Einstellungen', words: 'Export Import sichern Datei' },
  ]);
})();
