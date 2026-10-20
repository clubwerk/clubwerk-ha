'use strict';
/* Verwaltung „Spielbetrieb“: Spieltage (Ampel, Aufstellung) · Mannschaften (Mannschaftsführer, Meldeliste) · Einstellungen */
(() => {
  const GK = window.GK;
  const { $, esc, toast, fail, dialog, closeDialog, ask, deDate } = GK;
  const api = (url, method, body) => GK.api('x/spielbetrieb/' + url, method, body);
  const st = { meta: null, team: 0, past: false };
  const opt = (v, l, s) => `<option value="${esc(v)}" ${String(v) === String(s ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
  const val = id => ($(id) ? $(id).value.trim() : '');
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const wd = d => WD[new Date(d + 'T12:00:00').getDay()];
  const when = g => `${wd(g.date)} ${deDate(g.date)}${g.start ? ` · ${g.start}` : ''}`;

  if (!document.getElementById('spStyle')) {
    const s = document.createElement('style'); s.id = 'spStyle';
    s.textContent = `
      .sp-grid { display: grid; grid-template-columns: repeat(var(--c, 3), minmax(0, 1fr)); gap: 14px 16px; }
      .sp-grid .wall { grid-column: 1 / -1; }
      @media (max-width: 760px) { .sp-grid { grid-template-columns: 1fr; } }
      .sp-games { display: grid; gap: 10px; }
      .sp-g { display: grid; grid-template-columns: 8px 76px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 12px 14px 12px 0; border: 1px solid var(--line); border-radius: 14px; background: var(--card); cursor: pointer; overflow: hidden; }
      .sp-g:hover { border-color: var(--brand); }
      .sp-g .lt { align-self: stretch; } .sp-g .lt.g { background: var(--brand); } .sp-g .lt.r { background: var(--red); } .sp-g .lt.x { background: var(--line); }
      .sp-d { width: 76px; height: 58px; border-radius: 12px; background: var(--brand-soft); color: var(--brand-ink); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; line-height: 1.1; }
      .sp-d b { font-size: 20px; } .sp-d span { font-size: 11.5px; text-transform: uppercase; letter-spacing: .03em; }
      .sp-g h4 { margin: 0 0 3px; font-size: 15.5px; } .sp-g .muted { font-size: 13px; }
      .sp-nums { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .sp-team { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 16px; align-items: start; }
      .sp-team h4 { margin: 0 0 4px; font-size: 16px; }
      .sp-pl { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .sp-pl span { background: var(--hover); border-radius: 8px; padding: 3px 9px; font-size: 13px; }
      .sp-pl span b { color: var(--muted); font-weight: 700; margin-right: 4px; }
      .sp-ros td { vertical-align: middle; } .sp-ros select { min-height: 34px; height: 34px; }
      .sp-ros tr.wd td { background: var(--amber-soft); }
      .sp-sel { max-height: 300px; overflow: auto; border: 1px solid var(--line); border-radius: 12px; }
      .sp-sel > div { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 6px 10px; border-top: 1px solid var(--line-soft); }
      .sp-sel > div:first-child { border-top: 0; }
      .sp-sel .rk { font-weight: 800; color: var(--muted); text-align: right; }
      .sp-sel button { min-height: 30px; height: 30px; padding: 0 9px; }
      .sp-tasks > div { display: grid; grid-template-columns: minmax(0, 1fr) 240px auto; gap: 10px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line-soft); }
      .sp-tasks > div:first-child { border-top: 0; }
      @media (max-width: 760px) { .sp-g { grid-template-columns: 6px 64px minmax(0, 1fr); } .sp-g .sp-nums { grid-column: 3; justify-content: flex-start; } .sp-d { width: 64px; } .sp-tasks > div { grid-template-columns: 1fr; } }`;
    document.head.appendChild(s);
  }

  const PAGE = {
    'sp-spieltage': ['Spieltage', 'Alle Spieltage der Mannschaften – grün: genug Spieler haben zugesagt, rot: zu wenige. Antippen öffnet Verfügbarkeit und Aufstellung.'],
    'sp-mannschaften': ['Mannschaften', 'Mannschaften mit Mannschaftsführer, Stellvertreter und Spielern in der Reihenfolge der Meldeliste. Eine Person kann in mehreren Mannschaften spielen.'],
    'sp-einstellungen': ['Einstellungen', 'Was Spieler sehen, Uhrzeiten, Aufgaben und Erinnerungen.'],
  };
  async function loadMeta() { st.meta = await api('meta'); return st.meta; }
  function pageRender(key, fn) {
    return async () => {
      await loadMeta();
      const [title, lead] = PAGE[key];
      $('main').innerHTML = `<h2 class="page">${esc(title)}</h2><p class="lead">${esc(lead)}</p><div id="spBody"></div>`;
      await fn($('spBody'));
    };
  }
  const light = s => (s.ok ? 'g' : 'r');
  const nums = (g, past) => {
    const s = g.stats;
    if (g.status === 'abgesagt') return '<span class="pill">abgesagt</span>';
    return `<span class="pill ${past ? '' : light(s)}">${s.yes} von ${s.min} können</span>${s.open && !past ? `<span class="pill">${s.open} offen</span>` : ''}${s.playing ? `<span class="pill ${s.lineupOk ? 'g' : 'a'}">${s.playing} aufgestellt</span>` : ''}${s.withdraws ? `<span class="pill a">${s.withdraws} Absage-Anfrage</span>` : ''}${g.result ? `<span class="pill">${esc(g.result)}</span>` : ''}`;
  };

  /* ---------------- Spieltage ---------------- */
  async function showGames(el) {
    const m = st.meta;
    const games = await api(`games?past=${st.past ? 1 : 0}${st.team ? `&team=${st.team}` : ''}`);
    el.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-end;gap:10px;margin-bottom:14px">
        <div class="row" style="gap:10px;align-items:flex-end"><label class="f" style="min-width:220px">Mannschaft<select id="spT">${opt(0, 'Alle Mannschaften', st.team)}${m.teams.filter(t => t.active).map(t => opt(t.id, t.name, st.team)).join('')}</select></label>
          <div class="seg"><button type="button" data-past="0" class="${st.past ? '' : 'on'}">Kommende</button><button type="button" data-past="1" class="${st.past ? 'on' : ''}">Vergangene</button></div></div>
        <div class="row" style="gap:8px"><button class="btn" id="spImp" type="button">Spielplan importieren …</button><button class="btn primary" id="spNew" type="button" ${m.teams.length ? '' : 'disabled'}>+ Spieltag</button></div></div>
      ${!m.teams.length ? '<div class="banner a"><span>Noch keine Mannschaften – zuerst unter „Mannschaften“ anlegen oder einfach den Spielplan importieren (Mannschaften entstehen dabei automatisch).</span></div>' : ''}
      <div class="sp-games">${games.length ? games.map(g => `<div class="sp-g" data-g="${g.id}"><span class="lt ${g.status === 'abgesagt' || st.past ? 'x' : light(g.stats)}"></span>
          <div class="sp-d"><b>${esc(g.date.slice(8, 10))}.${esc(g.date.slice(5, 7))}.</b><span>${esc(wd(g.date))}${g.start ? ' ' + esc(g.start) : ''}</span></div>
          <div style="min-width:0"><h4><span translate="no">${esc(g.team)}</span> ${g.home ? 'gegen' : 'bei'} <span translate="no">${esc(g.opponent)}</span></h4>
            <div class="muted">${g.home ? 'Heimspiel' : 'Auswärtsspiel'}${g.league ? ' · ' + esc(g.league) : ''}${g.captain ? ' · MF ' + esc(g.captain) : ''}${g.sent ? ' · Aufstellung verschickt' : ''}</div></div>
          <div class="sp-nums">${nums(g, st.past)}</div></div>`).join('') : `<p class="muted">${st.past ? 'Keine vergangenen Spieltage.' : 'Keine kommenden Spieltage.'}</p>`}</div>`;
    $('spT').onchange = () => { st.team = +$('spT').value; showGames(el).catch(fail); };
    el.querySelectorAll('[data-past]').forEach(b => { b.onclick = () => { st.past = b.dataset.past === '1'; showGames(el).catch(fail); }; });
    el.querySelectorAll('[data-g]').forEach(c => { c.onclick = () => gameDialog(+c.dataset.g, () => showGames(el).catch(fail)); });
    $('spNew').onclick = () => editGame(null, () => showGames(el).catch(fail));
    $('spImp').onclick = () => importDialog(() => pageRender('sp-spieltage', showGames)().catch(fail));
  }

  function editGame(g, after) {
    const m = st.meta; g = g || { team_id: st.team || (m.teams.find(t => t.active) || {}).id, date: m.today, start: '10:00', home: true, opponent: '' };
    dialog(`<h3>${g.id ? 'Spieltag ändern' : 'Neuer Spieltag'}</h3>
      <div class="sp-grid" style="--c:2">
        <label class="f">Mannschaft<select id="egT">${m.teams.filter(t => t.active || t.id === g.team_id).map(t => opt(t.id, t.name, g.team_id)).join('')}</select></label>
        <label class="f">Gegner<input id="egO" value="${esc(g.opponent || '')}" placeholder="z. B. TC Hadamar II"></label>
        <label class="f">Datum<input id="egD" type="date" value="${esc(g.date)}"></label>
        <label class="f">Beginn<input id="egS" type="time" value="${esc(g.start || '')}"></label>
        <label class="f">Ort<select id="egH">${opt(1, 'Heimspiel', g.home ? 1 : 0)}${opt(0, 'Auswärtsspiel', g.home ? 1 : 0)}</select></label>
        <label class="f">Spielort (bei Auswärtsspielen)<input id="egV" value="${esc(g.venue || '')}" placeholder="Anlage, Straße, Ort"></label>
        ${g.id ? `<label class="f">Status<select id="egSt">${opt('geplant', 'geplant', g.status)}${opt('abgesagt', 'abgesagt', g.status)}</select></label><label class="f">Ergebnis<input id="egR" value="${esc(g.result || '')}" placeholder="z. B. 5:4"></label>` : ''}
      </div>
      <div class="btns">${g.id ? '<button class="btn danger" id="egDel" type="button" style="margin-right:auto">Löschen</button>' : ''}<button class="btn ghost" id="egC" type="button">Abbrechen</button><button class="btn primary" id="egOk" type="button">Speichern</button></div>`);
    $('egC').onclick = closeDialog;
    $('egOk').onclick = () => GK.busy($('egOk'), async () => {
      const body = { team_id: +val('egT'), opponent: val('egO'), date: val('egD'), start: val('egS'), home: val('egH') === '1', venue: val('egV'), ...(g.id ? { status: val('egSt'), result: val('egR') } : {}) };
      try { if (g.id) await api('games/' + g.id, 'PUT', body); else await api('games', 'POST', body); closeDialog(); toast('Gespeichert.'); after(); } catch (e) { fail(e); }
    });
    if ($('egDel')) $('egDel').onclick = async () => { if (!await ask('Spieltag löschen? Verfügbarkeiten und Aufstellung dazu gehen verloren.', { ok: 'Löschen', danger: true })) return; try { await api('games/' + g.id, 'DELETE'); closeDialog(); toast('Gelöscht.'); after(); } catch (e) { fail(e); } };
  }

  /** Spieltag: Verfügbarkeit aller Spieler, Aufstellung, Absage-Anfragen, Treffpunkt, Aufgaben */
  async function gameDialog(id, after) {
    let v = await api('games/' + id);
    const draw = () => {
      const s = v.stats, cfg = st.meta.settings;
      const AV = p => (p.state === 'ja' ? `<span class="pill g">kann${p.from ? ' ab ' + esc(p.from) : ''}${p.until ? ' bis ' + esc(p.until) : ''}</span>` : p.state === 'nein' ? '<span class="pill r">kann nicht</span>' : '<span class="pill">offen</span>');
      const row = p => `<tr class="${p.withdraw ? 'wd' : ''}"><td class="r muted">${p.inRoster ? esc(p.rank ?? '') : ''}</td>
        <td><b translate="no">${esc(p.ln)}</b>${p.inRoster ? '' : ' <span class="pill">Aushilfe</span>'}${p.note ? `<div class="muted s">${esc(p.note)}</div>` : ''}${p.withdraw ? `<div class="s" style="color:var(--amber);font-weight:700">möchte absagen${p.withdraw_note ? ': ' + esc(p.withdraw_note) : ''}</div>` : ''}</td>
        <td>${p.inRoster ? `<select data-av="${p.id}" aria-label="Verfügbarkeit">${opt('', 'offen', p.state || '')}${opt('ja', 'kann', p.state)}${opt('nein', 'kann nicht', p.state)}</select>${p.state === 'ja' && (p.from || p.until) ? `<div class="muted" style="font-size:12px;margin-top:3px">${p.from ? 'ab ' + esc(p.from) : ''}${p.from && p.until ? ' ' : ''}${p.until ? 'bis ' + esc(p.until) : ''}</div>` : ''}` : AV(p)}</td>
        <td><select data-lu="${p.id}" aria-label="Aufstellung">${opt('', '–', p.role || '')}${opt('spielt', 'spielt', p.role)}${opt('ersatz', 'Ersatz', p.role)}</select></td>
        <td class="r nw">${p.withdraw ? `<button class="btn small" data-wd="${p.id}" data-acc="1" type="button">Absage bestätigen</button> <button class="btn small ghost" data-wd="${p.id}" data-acc="0" type="button">ablehnen</button>` : ''}</td></tr>`;
      dialog(`<h3><span translate="no">${esc(v.team)}</span> ${v.home ? 'gegen' : 'bei'} <span translate="no">${esc(v.opponent)}</span></h3>
        <p class="muted" style="margin:-4px 0 12px">${esc(when(v))} · ${v.home ? 'Heimspiel' : 'Auswärtsspiel'}${v.venue ? ' · ' + esc(v.venue) : ''}${v.status === 'abgesagt' ? ' · <b>abgesagt</b>' : ''}</p>
        <div class="row" style="gap:8px;margin-bottom:10px"><span class="pill ${s.ok ? 'g' : 'r'}">${s.yes} von mindestens ${s.min} können</span><span class="pill">${s.no} ${s.no === 1 ? 'kann' : 'können'} nicht</span><span class="pill">${s.open} offen</span><span class="pill ${s.lineupOk ? 'g' : 'a'}">${s.playing} ${s.playing === 1 ? 'spielt' : 'spielen'} · ${s.reserve} Ersatz</span></div>
        <div class="scroll" style="max-height:44vh"><table class="tbl sp-ros"><tr><th class="r" style="width:36px">Nr.</th><th>Spieler</th><th>Verfügbarkeit</th><th>Aufstellung</th><th></th></tr>${v.people.map(row).join('') || '<tr><td colspan="5" class="muted">Noch keine Spieler in dieser Mannschaft.</td></tr>'}</table></div>
        ${v.helpers.length ? `<div class="row" style="gap:8px;align-items:flex-end;margin-top:10px"><label class="f" style="flex:1;min-width:220px">Aushilfe aus einer anderen Mannschaft<select id="gdH">${opt('', '– wählen –', '')}${v.helpers.map(h => opt(h.id, `${h.ln} (${h.team})`, '')).join('')}</select></label><button class="btn" id="gdHa" type="button">Als Ersatz aufstellen</button></div>` : ''}
        <h4 style="margin:16px 0 6px">Treffpunkt & Hinweise</h4>
        <div class="sp-grid" style="--c:3"><label class="f">Treffpunkt (Uhrzeit)<input id="gdMt" type="time" value="${esc(v.meet_time || '')}"></label><label class="f">Treffpunkt (Ort)<input id="gdMp" value="${esc(v.meet_place || '')}" placeholder="z. B. Parkplatz Vereinsheim"></label><label class="f">Ergebnis<input id="gdR" value="${esc(v.result || '')}" placeholder="z. B. 5:4"></label>
          <label class="f wall">Hinweis an die Mannschaft<input id="gdN" value="${esc(v.note || '')}" placeholder="z. B. bitte weiße Kleidung"></label></div>
        ${cfg.tasks ? `<h4 style="margin:16px 0 6px">Aufgaben</h4><div class="sp-tasks">${(v.tasks || []).map(x => `<div><span>${esc(x.label)}</span><label class="f"><select data-tk="${x.id}" aria-label="${esc(x.label)}">${opt('', '– noch offen –', x.member_id || '')}${v.people.filter(p => p.state !== 'nein').map(p => opt(p.id, p.ln, x.member_id)).join('')}</select></label><button class="btn ghost" data-tkx="${x.id}" type="button">entfernen</button></div>`).join('') || '<p class="muted s">Noch keine Aufgaben.</p>'}</div>
          <div class="row" style="gap:8px;margin-top:8px">${v.taskKinds.map(k => `<button class="btn small" data-tka="${esc(k.k)}" type="button">+ ${esc(k.l)}</button>`).join('')}</div>` : ''}
        <div class="btns"><button class="btn ghost" id="gdEd" type="button" style="margin-right:auto">Spieltag ändern …</button><button class="btn" id="gdRem" type="button" ${s.open ? '' : 'disabled'}>Offene erinnern</button><button class="btn" id="gdSave" type="button">Treffpunkt speichern</button><button class="btn primary" id="gdSend" type="button" ${s.playing ? '' : 'disabled'}>Aufstellung verschicken</button><button class="btn ghost" id="gdC" type="button">Schließen</button></div>`, true);
      const call = async (fn, msg) => { try { v = await fn(); draw(); if (msg) toast(msg); } catch (e) { fail(e); draw(); } };
      $('dialog').querySelectorAll('[data-av]').forEach(x => { x.onchange = () => call(() => api(`games/${id}/avail`, 'POST', { member_id: +x.dataset.av, state: x.value })); });
      $('dialog').querySelectorAll('[data-lu]').forEach(x => { x.onchange = () => call(() => api(`games/${id}/lineup`, 'POST', { member_id: +x.dataset.lu, role: x.value })); });
      $('dialog').querySelectorAll('[data-wd]').forEach(x => { x.onclick = () => call(() => api(`games/${id}/withdraw`, 'POST', { member_id: +x.dataset.wd, accept: x.dataset.acc === '1' }), x.dataset.acc === '1' ? 'Absage bestätigt – bitte Ersatz aufstellen.' : 'Abgelehnt – der Spieler bleibt aufgestellt.'); });
      $('dialog').querySelectorAll('[data-tk]').forEach(x => { x.onchange = () => call(() => api(`games/${id}/task`, 'POST', { task_id: +x.dataset.tk, member_id: +x.value || null })); });
      $('dialog').querySelectorAll('[data-tkx]').forEach(x => { x.onclick = () => call(() => api(`games/${id}/task`, 'POST', { task_id: +x.dataset.tkx, remove: true })); });
      $('dialog').querySelectorAll('[data-tka]').forEach(x => { x.onclick = () => call(() => api(`games/${id}/task`, 'POST', { kind: x.dataset.tka })); });
      if ($('gdHa')) $('gdHa').onclick = () => { if (!val('gdH')) return; call(() => api(`games/${id}/lineup`, 'POST', { member_id: +val('gdH'), role: 'ersatz' })); };
      $('gdSave').onclick = () => GK.busy($('gdSave'), async () => { try { await api('games/' + id, 'PUT', { meet_time: val('gdMt'), meet_place: val('gdMp'), note: val('gdN'), result: val('gdR') }); v = await api('games/' + id); toast('Gespeichert.'); draw(); } catch (e) { fail(e); } });
      $('gdSend').onclick = () => GK.busy($('gdSend'), async () => { if (!await ask(`Aufstellung an ${s.playing + s.reserve} Spieler schicken (Push${st.meta.mitglieder ? ' und E-Mail' : ''})?`, { ok: 'Verschicken' })) return; await call(() => api(`games/${id}/send`, 'POST', {}), 'Aufstellung verschickt.'); });
      $('gdRem').onclick = () => GK.busy($('gdRem'), async () => { try { const r = await api(`games/${id}/remind`, 'POST', {}); toast(`${r.n} Spieler erinnert.`); } catch (e) { fail(e); } });
      $('gdEd').onclick = () => editGame({ ...v, home: v.home }, after);
      $('gdC').onclick = () => { closeDialog(); after(); };
    };
    draw();
  }

  /* ---------------- Spielplan-Import ---------------- */
  function importDialog(after) {
    dialog(`<h3>Spielplan importieren</h3>
      <p class="muted" style="margin:0 0 10px">Die Tabelle „Begegnungen“ von der Verbandsseite (nuLiga) markieren, kopieren und hier einfügen – oder eine CSV-, Excel- oder Kalenderdatei wählen. Übernommen werden <b>alle</b> Spiele des Vereins, auch die Auswärtsspiele. Bei einem erneuten Import werden Verlegungen erkannt und die Mannschaft benachrichtigt.</p>
      <label class="f">Tabelle einfügen<textarea id="imT" rows="8" placeholder="Datum · Uhrzeit · Liga · Heimmannschaft · Gastmannschaft …"></textarea></label>
      <div class="row" style="gap:10px;margin-top:8px;align-items:center"><label class="btn" style="cursor:pointer">Datei wählen …<input id="imF" type="file" accept=".csv,.txt,.xlsx,.ics" style="display:none"></label><span class="muted s" id="imFn"></span></div>
      <div class="btns"><button class="btn ghost" id="imC" type="button">Abbrechen</button><button class="btn primary" id="imGo" type="button">Weiter</button></div>`, true);
    let file = null;
    $('imC').onclick = closeDialog;
    $('imF').onchange = () => { const f = $('imF').files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { file = { name: f.name, file: String(r.result).split(',')[1] }; $('imFn').textContent = f.name; }; r.readAsDataURL(f); };
    $('imGo').onclick = () => GK.busy($('imGo'), async () => {
      try { const src = file || { text: $('imT').value }; const r = await api('import/parse', 'POST', src); r.__src = src; review(r, after); } catch (e) { fail(e); }
    });
  }
  function review(r, after) {
    const m = st.meta;
    const own = r.games.filter(g => g.own && !g.past);
    const pick = new Set(own.filter(g => g.status !== 'vorhanden').map(g => g.key));
    const teamSel = {};
    r.teams.forEach(t => { teamSel[t.team] = t.team_id || 0; });
    const draw = () => {
      dialog(`<h3>Spielplan prüfen</h3>
        <div class="row" style="gap:10px;align-items:flex-end;margin-bottom:10px"><label class="f" style="min-width:260px">Unser Verein heißt in der Tabelle<input id="imCl" value="${esc(r.club)}"></label>
          <div class="muted s" style="padding-bottom:10px">${own.length} kommende Spiele des Vereins · ${own.filter(g => g.isHome).length} Heim, ${own.filter(g => !g.isHome).length} auswärts</div></div>
        <h4 style="margin:6px 0">Mannschaften</h4>
        <div class="sp-grid" style="--c:3">${r.teams.map(t => `<label class="f">${esc(t.team === '–' ? 'ohne Angabe' : t.team)} (${t.count} Spiele)<select data-tm="${esc(t.team)}">${opt(0, `neu anlegen${t.size ? ` (${t.size}er)` : ''}`, teamSel[t.team])}${m.teams.map(x => opt(x.id, x.name, teamSel[t.team])).join('')}</select></label>`).join('')}</div>
        <div class="scroll" style="max-height:36vh;margin-top:12px"><table class="tbl"><tr><th></th><th>Datum</th><th>Mannschaft</th><th>Begegnung</th><th></th></tr>${own.map((g, i) => `<tr><td><input type="checkbox" data-g="${i}" ${pick.has(g.key) ? 'checked' : ''}></td><td class="nw">${esc(when(g))}</td><td>${esc(g.team || '–')}</td>
          <td>${esc(g.home)} – ${esc(g.guest)} <span class="pill ${g.isHome ? 'g' : ''}">${g.isHome ? 'Heim' : 'Auswärts'}</span></td><td>${g.status === 'neu' ? '<span class="pill g">neu</span>' : g.status === 'verlegt' ? '<span class="pill a">verlegt</span>' : '<span class="pill">schon da</span>'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Keine kommenden Spiele des Vereins gefunden – stimmt der Vereinsname oben?</td></tr>'}</table></div>
        ${r.buchung ? '<label class="chk" style="margin-top:10px"><input type="checkbox" id="imB"> Heimspiele auch im Buchungssystem als Platzbelegung eintragen (Plätze wie beim letzten Import je Mannschaft)</label>' : ''}
        <div class="btns"><button class="btn ghost" id="imC" type="button">Abbrechen</button><button class="btn primary" id="imOk" type="button">${pick.size} Spieltage übernehmen</button></div>`, true);
      $('imC').onclick = closeDialog;
      $('dialog').querySelectorAll('[data-g]').forEach(c => { c.onchange = () => { const g = own[+c.dataset.g]; if (c.checked) pick.add(g.key); else pick.delete(g.key); $('imOk').textContent = `${pick.size} Spieltage übernehmen`; }; });
      $('dialog').querySelectorAll('[data-tm]').forEach(c => { c.onchange = () => { teamSel[c.dataset.tm] = +c.value; }; });
      $('imCl').onchange = async () => { try { const r2 = await api('import/parse', 'POST', { ...r.__src, club: $('imCl').value }); r2.__src = r.__src; review(r2, after); } catch (e) { fail(e); } };
      $('imOk').onclick = () => GK.busy($('imOk'), async () => {
        try {
          const teams = Object.fromEntries(Object.entries(teamSel).filter(([, v]) => v));
          const x = await api('import/apply', 'POST', { club: $('imCl').value, teams, games: own.filter(g => pick.has(g.key)), book: $('imB') ? $('imB').checked : false, force: true });
          closeDialog();
          const bk = x.booking ? ` Buchungssystem: ${x.booking.made || 0} Platzbelegungen${x.booking.noCourts && x.booking.noCourts.length ? ` – für ${x.booking.noCourts.join(', ')} sind noch keine Plätze hinterlegt (einmal im Buchungssystem importieren)` : ''}.` : '';
          toast(`${x.made} Spieltage neu${x.moved ? `, ${x.moved} verlegt` : ''}${x.teamsMade ? `, Mannschaften angelegt: ${x.teams.join(', ')}` : ''}.${bk}`); after();
        } catch (e) { fail(e); }
      });
    };
    draw();
  }

  /* ---------------- Mannschaften ---------------- */
  async function showTeams(el) {
    const m = st.meta;
    el.innerHTML = `<div class="row" style="justify-content:flex-end;margin-bottom:14px"><button class="btn primary" id="tmNew" type="button">+ Mannschaft</button></div>
      ${m.teams.length ? m.teams.map(t => `<div class="card sp-team ${t.active ? '' : 'off'}"><div style="min-width:0"><h4 translate="no">${esc(t.name)}${t.active ? '' : ' <span class="pill">nicht aktiv</span>'}</h4>
          <div class="muted s">${[t.league, t.season, `mindestens ${t.min_players} Spieler`, t.captain ? `Mannschaftsführer: ${t.captain}` : 'noch kein Mannschaftsführer', t.vice ? `Stellvertreter: ${t.vice}` : ''].filter(Boolean).map(esc).join(' · ')}</div>
          <div class="sp-pl" translate="no">${t.players.length ? t.players.map(p => `<span><b>${esc(p.rank)}</b>${esc(p.ln)}</span>`).join('') : '<span class="muted">noch keine Spieler</span>'}</div></div>
        <div class="row" style="gap:8px;justify-content:flex-end"><button class="btn small" data-pl="${t.id}" type="button">Spieler …</button><button class="btn small" data-ed="${t.id}" type="button">Bearbeiten</button></div></div>`).join('')
        : '<div class="card"><p class="muted" style="margin:0">Noch keine Mannschaften. Tipp: Beim Spielplan-Import werden die Mannschaften automatisch angelegt.</p></div>'}`;
    const again = () => pageRender('sp-mannschaften', showTeams)().catch(fail);
    $('tmNew').onclick = () => editTeam(null, again);
    el.querySelectorAll('[data-ed]').forEach(b => { b.onclick = () => editTeam(m.teams.find(t => t.id === +b.dataset.ed), again); });
    el.querySelectorAll('[data-pl]').forEach(b => { b.onclick = () => playersDialog(m.teams.find(t => t.id === +b.dataset.pl), again); });
  }
  function editTeam(t, after) {
    const m = st.meta; t = t || { name: '', min_players: 4, active: 1 };
    const pick = (id, sel) => `<select id="${id}">${opt('', '– niemand –', sel || '')}${m.members.map(x => opt(x.id, x.ln, sel)).join('')}</select>`;
    dialog(`<h3>${t.id ? 'Mannschaft bearbeiten' : 'Neue Mannschaft'}</h3>
      <div class="sp-grid" style="--c:2">
        <label class="f">Name<input id="etN" value="${esc(t.name)}" placeholder="z. B. Herren 40 I"></label>
        <label class="f">Liga<input id="etL" value="${esc(t.league || '')}" placeholder="z. B. H40 (4er) Bezirksliga"></label>
        <label class="f">Saison<input id="etS" value="${esc(t.season || '')}" placeholder="z. B. Sommer 2027"></label>
        <label class="f">Mindestens Spieler pro Spieltag<input id="etM" type="number" min="1" max="20" value="${esc(t.min_players)}"></label>
        <label class="f">Mannschaftsführer${pick('etC', t.captain_id)}</label>
        <label class="f">Stellvertreter${pick('etV', t.vice_id)}</label>
        <label class="chk wall"><input type="checkbox" id="etA" ${t.active ? 'checked' : ''}> aktiv (nicht aktive Mannschaften verschwinden aus der App)</label>
      </div>
      <p class="muted s">Mannschaftsführer und Stellvertreter stellen in der Mitglieder-App unter „Spieltage“ auf – dafür brauchen sie kein Konto in der Verwaltung.</p>
      <div class="btns">${t.id ? '<button class="btn danger" id="etDel" type="button" style="margin-right:auto">Löschen</button>' : ''}<button class="btn ghost" id="etX" type="button">Abbrechen</button><button class="btn primary" id="etOk" type="button">Speichern</button></div>`);
    $('etX').onclick = closeDialog;
    $('etOk').onclick = () => GK.busy($('etOk'), async () => {
      const body = { name: val('etN'), league: val('etL'), season: val('etS'), min_players: +val('etM'), captain_id: +val('etC') || null, vice_id: +val('etV') || null, active: $('etA').checked };
      try { if (t.id) await api('teams/' + t.id, 'PUT', body); else await api('teams', 'POST', body); closeDialog(); toast('Gespeichert.'); after(); } catch (e) { fail(e); }
    });
    if ($('etDel')) $('etDel').onclick = async () => {
      if (!await ask(`Mannschaft „${t.name}“ löschen? Ihre Spieltage, Verfügbarkeiten und Aufstellungen gehen verloren. Tipp: „nicht aktiv“ behält alles.`, { ok: 'Löschen', danger: true })) return;
      try { await api(`teams/${t.id}?force=1`, 'DELETE'); closeDialog(); toast('Gelöscht.'); after(); } catch (e) { fail(e); }
    };
  }
  /** Spieler zuordnen – die Reihenfolge ist die Meldeliste */
  function playersDialog(t, after) {
    const m = st.meta; let list = t.players.map(p => ({ id: p.id, ln: p.ln }));
    let q = '';
    const draw = () => {
      const inList = new Set(list.map(p => p.id));
      const hits = m.members.filter(x => !inList.has(x.id) && (!q || x.ln.toLowerCase().includes(q.toLowerCase()))).slice(0, 60);
      dialog(`<h3>Spieler · <span translate="no">${esc(t.name)}</span></h3>
        <p class="muted" style="margin:0 0 10px">Reihenfolge wie in der Meldeliste (Nr. 1 oben). Mit ▲ ▼ verschieben. Eine Person kann in mehreren Mannschaften stehen.</p>
        <div class="sp-grid" style="--c:2"><div><h4 style="margin:0 0 6px">In der Mannschaft (${list.length})</h4><div class="sp-sel" translate="no">${list.map((p, i) => `<div><span class="rk">${i + 1}</span><span>${esc(p.ln)}</span><span class="nw"><button class="btn small ghost" data-up="${i}" type="button" ${i ? '' : 'disabled'} aria-label="nach oben">▲</button><button class="btn small ghost" data-dn="${i}" type="button" ${i < list.length - 1 ? '' : 'disabled'} aria-label="nach unten">▼</button><button class="btn small ghost" data-rm="${i}" type="button" aria-label="entfernen">✕</button></span></div>`).join('') || '<div><span></span><span class="muted">noch niemand</span><span></span></div>'}</div></div>
          <div><h4 style="margin:0 0 6px">Hinzufügen</h4><label class="f" style="margin-bottom:8px"><input id="plQ" placeholder="Name suchen" value="${esc(q)}" aria-label="Name suchen"></label><div class="sp-sel" translate="no">${hits.map(x => `<div><span></span><span>${esc(x.ln)}</span><button class="btn small" data-ad="${x.id}" type="button">+</button></div>`).join('') || '<div><span></span><span class="muted">keine Treffer</span><span></span></div>'}</div></div></div>
        <div class="btns"><button class="btn ghost" id="plX" type="button">Abbrechen</button><button class="btn primary" id="plOk" type="button">Speichern</button></div>`, true);
      $('plX').onclick = closeDialog;
      $('plQ').oninput = () => { q = $('plQ').value; const pos = $('plQ').selectionStart; draw(); $('plQ').focus(); $('plQ').setSelectionRange(pos, pos); };
      $('dialog').querySelectorAll('[data-ad]').forEach(b => { b.onclick = () => { const x = m.members.find(y => y.id === +b.dataset.ad); list.push({ id: x.id, ln: x.ln }); draw(); }; });
      $('dialog').querySelectorAll('[data-rm]').forEach(b => { b.onclick = () => { list.splice(+b.dataset.rm, 1); draw(); }; });
      $('dialog').querySelectorAll('[data-up]').forEach(b => { b.onclick = () => { const i = +b.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); }; });
      $('dialog').querySelectorAll('[data-dn]').forEach(b => { b.onclick = () => { const i = +b.dataset.dn; [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(); }; });
      $('plOk').onclick = () => GK.busy($('plOk'), async () => { try { await api(`teams/${t.id}/players`, 'PUT', { players: list.map((p, i) => ({ id: p.id, rank: i + 1 })) }); closeDialog(); toast('Gespeichert.'); after(); } catch (e) { fail(e); } });
    };
    draw();
  }

  /* ---------------- Einstellungen ---------------- */
  async function showSettings(el) {
    const s = st.meta.settings;
    const chk = (k, l, on, hint) => `<label class="chk" style="align-items:flex-start;margin:8px 0"><input type="checkbox" id="ss_${k}" ${on ? 'checked' : ''} style="margin-top:3px"> <span><b>${esc(l)}</b>${hint ? `<br><span class="muted s">${esc(hint)}</span>` : ''}</span></label>`;
    el.innerHTML = `<div class="card"><h3>Was Spieler in der App sehen</h3>
        ${chk('see_avail', 'Wer sonst kann', s.seeAvail, 'Spieler sehen die Namen der anderen, die für einen Spieltag „kann“ gemeldet haben.')}
        ${chk('see_lineup', 'Aufstellung', s.seeLineup, 'Spieler sehen, wer aufgestellt ist. Der Mannschaftsführer sieht immer alles.')}
        ${chk('times', '„kann ab …“ / „kann bis …“ Uhr anbieten', s.times, 'Optional zur Zusage – z. B. wenn jemand erst später kommt oder früher weg muss.')}</div>
      <div class="card"><h3>Aufgaben</h3>
        ${chk('tasks', 'Aufgaben je Spieltag', s.tasks, 'Der Mannschaftsführer verteilt Aufgaben, Spieler können offene Aufgaben in der App übernehmen.')}
        <div class="sp-tasks" id="tkList">${s.taskKinds.map((k, i) => `<div><label class="f"><input data-tl="${i}" value="${esc(k.l)}" aria-label="Aufgabe" placeholder="Aufgabe"></label><label class="f"><select data-tw="${i}" aria-label="Wann">${opt('immer', 'bei jedem Spiel', k.when)}${opt('heim', 'nur bei Heimspielen', k.when)}${opt('auswaerts', 'nur bei Auswärtsspielen', k.when)}</select></label><button class="btn ghost" data-tr="${i}" type="button">entfernen</button></div>`).join('')}</div>
        <div class="row" style="margin-top:8px"><button class="btn small" id="tkAdd" type="button">+ Aufgabe</button></div></div>
      <div class="card"><h3>Erinnerungen & Nachrichten</h3>
        ${chk('remind', 'Automatische Erinnerungen', s.remind, 'Spieler, die noch nicht geantwortet haben, bekommen vor dem Spieltag eine Push-Nachricht; der Mannschaftsführer eine Warnung, wenn zu wenige können.')}
        <div class="sp-grid" style="--c:3"><label class="f">Spieler erinnern … Tage vorher<input id="ss_remind_days" type="number" min="1" max="30" value="${s.remindDays}"></label><label class="f">Mannschaftsführer warnen … Tage vorher<input id="ss_captain_days" type="number" min="1" max="30" value="${s.captainDays}"></label></div>
        ${chk('mail', 'Wichtige Nachrichten auch per E-Mail', s.mail, st.meta.mitglieder ? 'Aufstellung und Absage-Anfragen zusätzlich per E-Mail (Adresse aus der Mitgliederverwaltung). Push kommt immer.' : 'Braucht die Mitgliederverwaltung (E-Mail-Adressen). Ohne sie gibt es nur Push.')}
        <p class="muted s">Welche Push-Nachrichten es gibt, legt der Vorstand unter Mitglieder-App → Benachrichtigungen fest.</p></div>
      <div class="btns"><button class="btn primary" id="ssOk" type="button">Speichern</button></div>`;
    let kinds = s.taskKinds.map(k => ({ ...k }));
    const read = () => { el.querySelectorAll('[data-tl]').forEach(x => { kinds[+x.dataset.tl].l = x.value; }); el.querySelectorAll('[data-tw]').forEach(x => { kinds[+x.dataset.tw].when = x.value; }); };
    const redrawKinds = () => { st.meta.settings.taskKinds = kinds; showSettings(el).then(() => {}).catch(fail); };
    $('tkAdd').onclick = () => { read(); kinds.push({ k: 'a' + Date.now().toString(36).slice(-4), l: '', when: 'immer' }); redrawKinds(); };
    el.querySelectorAll('[data-tr]').forEach(b => { b.onclick = () => { read(); kinds.splice(+b.dataset.tr, 1); redrawKinds(); }; });
    $('ssOk').onclick = () => GK.busy($('ssOk'), async () => {
      read();
      const b = { task_kinds: kinds.filter(k => k.l.trim()), remind_days: +val('ss_remind_days'), captain_days: +val('ss_captain_days') };
      for (const k of ['see_avail', 'see_lineup', 'times', 'tasks', 'remind', 'mail']) b[k] = $('ss_' + k).checked;
      try { const r = await api('settings', 'PUT', b); st.meta.settings = r.settings; toast('Gespeichert.'); } catch (e) { fail(e); }
    });
  }

  const G = { key: 'spielbetrieb', label: 'Spielbetrieb', icon: 'pokal', order: 2.5 };   // Menü: nach dem Buchungssystem
  GK.registerPage({ key: 'sp-spieltage', title: 'Spieltage', perm: 'spielbetrieb', render: pageRender('sp-spieltage', showGames), group: G });
  GK.registerPage({ key: 'sp-mannschaften', title: 'Mannschaften', perm: 'spielbetrieb', render: pageRender('sp-mannschaften', showTeams), group: G });
  GK.registerPage({ key: 'sp-einstellungen', title: 'Einstellungen', perm: 'spielbetrieb', render: pageRender('sp-einstellungen', showSettings), group: G });
})();
