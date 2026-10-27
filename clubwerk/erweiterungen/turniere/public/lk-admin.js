'use strict';
/* Verwaltungsseite „Turniertag“ (LK-Turniere mit nuLiga-Import): Reiter Zentrale · Zeitplan · Check-in · Ergebnisse · Plätze · Einstellungen.
   Wird von admin.js beim ersten Öffnen nachgeladen. Ergebnis-Anzeige aus ansicht.js – wie Clubmeisterschaft, Tablet und Spielerseite. */
(() => {
  if (window.TurnierLK) return;
  const GK = window.GK;
  const { $, esc, toast, fail } = GK;
  const api = (url, method, body) => GK.api('x/turniere/lk/' + url, method, body);
  const V = () => window.TurnierAnsicht;
  const st = { did: +sessionStorage.getItem('tl_did') || null, days: [], d: null, tabs: null, cf: sessionStorage.getItem('tl_cf') || 'alle', sort: sessionStorage.getItem('tl_sort') || 'name', q: '', zday: null, zcourt: null };
  const euro = c => GK.euro(c || 0);
  const dm = s => (s ? GK.deDate(s) : '–');
  const EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
  if (!document.getElementById('tlStyle')) {
    const s = document.createElement('style'); s.id = 'tlStyle';
    s.textContent = `
      .tl-courts { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; align-items: stretch; margin-bottom: 16px; }
      .tl-courts > .card { margin: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
      .tl-courts h3 { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 0; }
      .tl-slot { border-top: 1px solid var(--line); padding-top: 10px; min-width: 0; }
      .tl-slot:first-of-type { border-top: 0; padding-top: 0; }
      .tl-slot > small { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
      .tl-slot > small span { text-transform: none; letter-spacing: 0; white-space: nowrap; }
      .tl-names { display: grid; gap: 2px; min-width: 0; cursor: pointer; }
      .tl-names b { display: block; font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink); }
      .tl-meta { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tl-slot .btns { margin-top: 8px; justify-content: flex-start; }
      .tl-num { font-family: var(--num); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 16px; white-space: nowrap; }
      .tl-late { color: var(--red); font-weight: 700; } .tl-bit { color: var(--amber); font-weight: 700; }
      .tl-plan { position: relative; display: grid; gap: 8px; grid-template-columns: 46px repeat(var(--n), minmax(0, 1fr)); }
      .tl-plan .ax, .tl-plan .col { position: relative; height: var(--h); }
      .tl-plan .ax span { position: absolute; right: 6px; transform: translateY(-50%); font-family: var(--num); font-weight: 600; font-size: 14px; color: var(--muted); }
      .tl-plan .col { border-left: 1px solid var(--line); background: repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px var(--hr)); }
      .tl-plan .head { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tl-plan .blk { position: absolute; left: 4px; right: 4px; border-radius: 10px; padding: 4px 8px; background: var(--card); border: 1px solid var(--edge); box-shadow: var(--shadow); overflow: hidden; cursor: pointer; font-size: 12.5px; line-height: 1.3; color: var(--ink); }
      .tl-plan .blk .tl-meta { display: block; }
      .tl-plan .blk b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
      .tl-plan .blk .t { font-family: var(--num); font-weight: 600; font-size: 14px; color: var(--muted); }
      .tl-plan .blk.run { border-left: 4px solid var(--brand); background: var(--brand-soft); }
      .tl-plan .blk.done { opacity: .72; }
      .tl-plan .blk.late { border-left: 4px solid var(--red); }
      .tl-plan .blk.bit { border-left: 4px solid var(--amber); }
      .tl-plan .now { position: absolute; left: 0; right: 0; border-top: 2px solid var(--red); z-index: 2; pointer-events: none; }
      .tl-plan .ax .now span { position: absolute; right: 2px; top: -11px; background: var(--red); color: var(--on-red); font-family: var(--num); font-weight: 600; font-size: 13px; padding: 1px 6px; border-radius: 999px; }
      .tl-qr { display: grid; place-items: center; gap: 8px; }
      .tl-qr svg { width: min(260px, 70vw); height: auto; background: #fff; padding: 8px; border-radius: 12px; }
      .tl-sets { display: grid; grid-template-columns: minmax(0, 1fr) 72px 12px 72px; gap: 8px; align-items: center; margin: 12px 0 0; }
      .tl-sets .h { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tl-sets .c { text-align: center; color: var(--muted); font-weight: 700; }
      .tl-sets input { width: 100%; box-sizing: border-box; height: 46px; border: 1px solid var(--line); border-radius: 12px; background: var(--field); color: var(--ink); text-align: center; font-family: var(--num); font-size: 18px; font-weight: 600; }
      .tl-files { margin: 12px 0 0; display: grid; gap: 6px; }
      .tl-diff ul { margin: 4px 0 10px; padding-left: 20px; line-height: 1.5; }
      @media print { .tl-plan .blk { box-shadow: none; } }`;
    document.head.appendChild(s);
  }
  /** Knöpfe rechts in die Reiterzeile (wie auf der Seite Clubmeisterschaft) */
  const tools = (el, html) => { if (html && !GK.tabTools(html, el.firstElementChild)) el.insertAdjacentHTML('afterbegin', `<div class="toolbar">${html}</div>`); };
  async function days() { st.days = await api('tage'); if (!st.days.some(x => x.id === st.did)) { const t = new Date().toISOString().slice(0, 10); st.did = (st.days.find(x => !x.finished_at && x.date_from <= t && x.date_to >= t) || st.days.find(x => !x.finished_at) || st.days[0] || {}).id || null; } }
  async function load() { st.d = st.did ? await api('tag/' + st.did) : null; return st.d; }
  const reload = async () => { await load(); lead(); if (st.tabs) st.tabs.reload(); };
  function lead() {
    const p = $('tlLead'); if (!p) return;
    const d = st.d && st.d.day;
    p.textContent = d ? `${d.name}: ${d.date_from === d.date_to ? dm(d.date_from) : `${dm(d.date_from)} bis ${dm(d.date_to)}`}${d.finished_at ? ' – beendet' : ''}.` : 'LK-Turniere aus nuLiga: Check-in, Plätze, Zeitplan und Ergebnisse am Turniertag.';
  }
  const daySelect = () => (st.days.length > 1 ? `<label class="f" style="flex:0 1 260px">Turniertag<select id="tlDid">${st.days.map(x => `<option value="${x.id}" ${x.id === st.did ? 'selected' : ''}>${esc(x.name)} (${dm(x.date_from)})</option>`).join('')}</select></label>` : '');
  const bindDay = () => { if ($('tlDid')) $('tlDid').onchange = () => { st.did = +$('tlDid').value; sessionStorage.setItem('tl_did', st.did); reload().catch(fail); }; };
  const findM = id => st.d.matches.find(m => m.id === +id);
  const delay = m => (m.delay >= 15 ? `<span class="tl-late">+${m.delay} min</span>` : m.delay >= 5 ? `<span class="tl-bit">+${m.delay} min</span>` : '');

  /* ---------- Import (neu oder erneut) ---------- */
  function importDialog(again) {
    GK.dialog(`<h2>${again ? 'Erneut aus nuLiga importieren' : 'Turniertag aus nuLiga importieren'}</h2>
      <p class="muted">${again ? 'Neue Dateien desselben Turniers (z. B. nach einer Nachmeldung). Check-in, Zahlungen, Ergebnisse und deine Umplanungen bleiben – Clubwerk zeigt vorher, was sich ändert.' : 'Die XML-Datei je Turnier aus nuLiga (Turnier-Export). Mehrere Turniere am selben Wochenende werden ein Turniertag. Dazu optional die Meldeliste als CSV – sie bringt die genaue LK und „bar“ als Zahlungsart.'}</p>
      <label class="f">Dateien<input type="file" id="tlF" accept=".xml,.csv,.txt" multiple></label>
      <p class="muted s" style="margin:6px 0 0">Übernommen werden nur Name, Verein, LK, Geschlecht, Geburtsjahr und die nuLiga-Nummern – keine Anschriften, E-Mails oder Telefonnummern.</p>
      <div id="tlR"></div>
      <div class="btns"><button class="btn ghost" id="tlX">Abbrechen</button><button class="btn primary" id="tlOk" disabled>Übernehmen</button></div>`, true);
    $('tlX').onclick = GK.closeDialog;
    let files = [];
    $('tlF').onchange = async () => {
      const list = [...$('tlF').files]; if (!list.length) return;
      files = await Promise.all(list.map(f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok({ name: f.name, data: String(r.result).split(',')[1] || '' }); r.onerror = no; r.readAsDataURL(f); })));
      let p; try { p = await api('import', 'POST', { files, preview: true, ...(again ? { day_id: st.did } : {}) }); } catch (e) { $('tlR').innerHTML = ''; $('tlOk').disabled = true; return fail(e); }
      const li = (t, xs) => (xs.length ? `<p class="muted s" style="margin:0"><b>${esc(t)}</b></p><ul>${xs.slice(0, 30).map(x => `<li translate="no">${esc(x)}</li>`).join('')}${xs.length > 30 ? `<li>… und ${xs.length - 30} weitere</li>` : ''}</ul>` : '');
      const df = p.diff;
      $('tlR').innerHTML = `<div class="tl-files">
          ${p.warnings.map(w => `<div class="banner a">${esc(w)}</div>`).join('')}
          ${p.unknown.length ? `<div class="banner">In der Datei stehen Angaben, die Clubwerk nicht kennt (${esc(p.unknown.join(', '))}). Bitte die Vorschau prüfen.</div>` : ''}
          <dl class="vh-kv"><dt>Turnier${p.tournaments.length > 1 ? 'e' : ''}</dt><dd translate="no">${esc(p.tournaments.join(' / '))}</dd><dt>Tag${p.from === p.to ? '' : 'e'}</dt><dd>${p.from === p.to ? dm(p.from) : `${dm(p.from)} bis ${dm(p.to)}`}</dd>
            <dt>Spieler</dt><dd>${p.counts.persons}</dd><dt>Konkurrenzen</dt><dd>${p.counts.events}</dd><dt>Matches</dt><dd>${p.counts.matches}</dd><dt>Plätze</dt><dd>${p.counts.courts}</dd>${p.csv ? `<dt>Meldeliste (CSV)</dt><dd>${p.csv} Zeilen</dd>` : ''}</dl>
          ${p.skipped.length ? `<p class="muted s" style="margin:0">Übersprungen: ${esc(p.skipped.join(', '))}</p>` : ''}
          ${again ? `<div class="tl-diff">${li('Neue Spieler', df.persons.neu)}${li('Geänderte Spieler', df.persons.geaendert)}${li('Nicht mehr gemeldet', df.persons.weg)}${li('Neue Konkurrenzen', df.events.neu)}${li('Geänderte Planung', df.matches.geaendert)}${li('Entfallene Matches', df.matches.weg)}
            ${!df.persons.neu.length && !df.persons.geaendert.length && !df.persons.weg.length && !df.matches.geaendert.length && !df.matches.weg.length && !df.events.neu.length && !df.matches.neu ? '<p class="muted">Keine Änderungen gegenüber dem bisherigen Stand.</p>' : df.matches.neu ? `<p class="muted s">${df.matches.neu} neue Matches.</p>` : ''}</div>` : ''}
        </div>`;
      $('tlOk').disabled = false;
    };
    $('tlOk').onclick = () => GK.busy($('tlOk'), async () => {
      try { const r = await api('import', 'POST', { files, ...(again ? { day_id: st.did } : {}) }); st.did = r.id; sessionStorage.setItem('tl_did', r.id); GK.closeDialog(); toast(again ? 'Abgeglichen.' : 'Turniertag angelegt.'); await days(); render(); }
      catch (e) { fail(e); }
    });
  }

  /* ---------- Match-Fenster: verlegen, starten, Ergebnis, Paarung ---------- */
  function matchDialog(m) {
    const d = st.d, closed = Boolean(d.day.finished_at), fixed = m.done || m.running || closed;
    const courts = d.courts.map(c => `<option value="${c.id}" ${c.id === m.court_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    const plan = m.plan_court || m.plan_time ? `nuLiga: ${esc(m.plan_court || '–')}${m.plan_time ? ` · ${m.plan_time} Uhr` : ''}` : 'ohne Planung aus nuLiga';
    GK.dialog(`<h2 translate="no">${esc(m.a || 'offen')} – ${esc(m.b || 'offen')}</h2><p class="muted" style="margin-top:-4px">${esc(m.event)} · ${esc(m.roundLabel)} · Nr. ${m.no} · ${plan}</p>
      ${m.notes.length ? `<div class="banner a">${m.notes.map(n => `<span translate="no">${esc(n)}</span>`).join('<br>')}</div>` : ''}
      ${m.done ? `<div class="card" style="margin:0 0 12px">${V().score(m)}</div>` : m.running ? `<p>Läuft seit <span class="tl-num">${m.minutes}</span> Minuten auf ${esc(m.court)}.</p>` : `<p>${m.est ? `Voraussichtlich <span class="tl-num">${esc(m.est)}</span> Uhr ${delay(m)}` : 'Wartet auf einen Platz.'}${m.wait ? ` · <span class="muted">${esc(m.wait)}</span>` : ' · bereit'}</p>`}
      ${fixed ? '' : `<div class="row"><label class="f" style="flex:1 1 200px">Platz<select id="tmC"><option value="">Warteschlange (ohne Platz)</option>${courts}</select></label>
        <label class="f" style="flex:0 1 140px">Uhrzeit<input id="tmT" type="time" value="${esc(m.time || '')}"></label></div>`}
      <div class="btns">
        ${!fixed && (!m.a || !m.b) ? '<button class="btn" id="tmP">Paarung festlegen …</button>' : ''}
        ${!closed && m.running ? '<button class="btn" id="tmStop">Start zurücknehmen</button>' : ''}
        ${!closed && !m.done && !m.running && m.a && m.b && m.court_id ? '<button class="btn" id="tmGo">Match starten</button>' : ''}
        ${!closed && m.a && m.b ? `<button class="btn" id="tmR">${m.done ? 'Ergebnis ändern …' : 'Ergebnis …'}</button>` : ''}
        <button class="btn ghost" id="tmX">Schließen</button>${fixed ? '' : '<button class="btn primary" id="tmOk">Speichern</button>'}</div>`, true);
    $('tmX').onclick = GK.closeDialog;
    const after = async msg => { GK.closeDialog(); toast(msg); await reload(); };
    if ($('tmOk')) $('tmOk').onclick = () => GK.busy($('tmOk'), async () => { try { await api('match/' + m.id, 'PUT', { court_id: $('tmC').value ? +$('tmC').value : null, time: $('tmT').value || null }); await after('Verlegt.'); } catch (e) { fail(e); } });
    if ($('tmGo')) $('tmGo').onclick = () => GK.busy($('tmGo'), async () => { try { await api(`match/${m.id}/start`, 'POST', {}); await after('Match gestartet.'); } catch (e) { fail(e); } });
    if ($('tmStop')) $('tmStop').onclick = async () => { if (!await GK.ask('Start zurücknehmen?\n\nDas Match gilt dann wieder als nicht begonnen.', { ok: 'Zurücknehmen' })) return; try { await api(`match/${m.id}/stopp`, 'POST', {}); await after('Zurückgenommen.'); } catch (e) { fail(e); } };
    if ($('tmR')) $('tmR').onclick = () => resultDialog(m);
    if ($('tmP')) $('tmP').onclick = () => pairDialog(m);
  }
  function pairDialog(m) {
    const es = st.d.entries.filter(e => e.event_id === m.event_id).sort((x, y) => x.name.localeCompare(y.name, 'de'));
    const opts = id => `<option value="">– offen –</option>${es.map(e => `<option value="${e.id}" translate="no" ${e.id === id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}`;
    GK.dialog(`<h2>Paarung festlegen</h2><p class="muted">${esc(m.event)} · ${esc(m.roundLabel)} · Nr. ${m.no}. Am besten nach der Auslosung in nuLiga – ein erneuter Import überschreibt die Paarung, solange das Match nicht gespielt ist.</p>
      <div class="row"><label class="f" style="flex:1 1 200px">Spieler A<select id="tpA">${opts(m.a_id)}</select></label><label class="f" style="flex:1 1 200px">Spieler B<select id="tpB">${opts(m.b_id)}</select></label></div>
      <div class="btns"><button class="btn ghost" id="tpX">Abbrechen</button><button class="btn primary" id="tpOk">Speichern</button></div>`);
    $('tpX').onclick = GK.closeDialog;
    $('tpOk').onclick = () => GK.busy($('tpOk'), async () => { try { await api(`match/${m.id}/paarung`, 'PUT', { a: +$('tpA').value || null, b: +$('tpB').value || null }); GK.closeDialog(); toast('Gespeichert.'); reload(); } catch (e) { fail(e); } });
  }
  function resultDialog(m) {
    const k0 = m.result || 'normal', third = m.full ? 'Satz 3' : 'Match-Tiebreak';
    GK.dialog(`<h2 translate="no">${esc(m.a)} – ${esc(m.b)}</h2><p class="muted" style="margin-top:-4px">${esc(m.event)} · ${esc(m.roundLabel)} · Nr. ${m.no}${m.entered_by ? ` · eingetragen von <span translate="no">${esc(m.entered_by)}</span>` : ''}</p>
      <div class="row"><label class="f" style="flex:1 1 200px">Wertung<select id="trK">${[['normal', 'Gespielt'], ['wo', 'Kampflos (w. o.)'], ['aufgabe', 'Aufgabe']].map(([k, l]) => `<option value="${k}" ${k === k0 ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f" style="flex:1 1 200px" id="trWL">Gewinnt kampflos<select id="trW"><option value="a" translate="no">${esc(m.a)}</option><option value="b" translate="no" ${m.winner === 'b' ? 'selected' : ''}>${esc(m.b)}</option></select></label>
        <label class="f" style="flex:1 1 200px" id="trRL">Hat aufgegeben<select id="trR"><option value="a" translate="no">${esc(m.a)}</option><option value="b" translate="no" ${m.retired !== 'a' ? 'selected' : ''}>${esc(m.b)}</option></select></label></div>
      <div class="tl-sets" id="trS"><span></span><span class="h" translate="no">${esc(String(m.a).split(/[,/]/)[0])}</span><span></span><span class="h" translate="no">${esc(String(m.b).split(/[,/]/)[0])}</span>
        ${['Satz 1', 'Satz 2', third].map((l, i) => `<b>${esc(l)}</b><input inputmode="numeric" id="trA${i}" value="${m.sets[i] ? m.sets[i][0] : ''}" aria-label="${esc(l)}: ${esc(m.a)}"><span class="c">:</span><input inputmode="numeric" id="trB${i}" value="${m.sets[i] ? m.sets[i][1] : ''}" aria-label="${esc(l)}: ${esc(m.b)}">`).join('')}</div>
      <div class="btns"><button class="btn ghost" id="trX">Abbrechen</button><button class="btn primary" id="trOk">Speichern</button></div>
      ${m.done ? '<div class="btns" style="margin-top:8px;border-top:1px solid var(--line);padding-top:12px"><button class="btn danger" id="trDel">Ergebnis löschen</button></div>' : ''}`, true);
    const show = (id, on) => { $(id).style.display = on ? '' : 'none'; };
    const sync = () => { const k = $('trK').value; show('trWL', k === 'wo'); show('trRL', k === 'aufgabe'); show('trS', k !== 'wo'); };
    sync(); $('trK').onchange = sync;
    $('trX').onclick = GK.closeDialog;
    const save = body => GK.busy($('trOk'), async () => { try { await api(`match/${m.id}/ergebnis`, 'POST', body); GK.closeDialog(); toast('Gespeichert.'); reload(); } catch (e) { fail(e); } });
    $('trOk').onclick = () => {
      const k = $('trK').value, body = { result: k };
      if (k === 'wo') body.winner = $('trW').value;
      else body.sets = [0, 1, 2].map(i => [$('trA' + i).value.trim(), $('trB' + i).value.trim()]).filter(x => x[0] !== '' || x[1] !== '');
      if (k === 'aufgabe') body.retired = $('trR').value;
      save(body);
    };
    if ($('trDel')) $('trDel').onclick = async () => { if (await GK.ask('Ergebnis löschen?\n\nDas Match ist danach wieder offen.')) save({ clear: true }); };
  }

  /* ---------- Zentrale ---------- */
  const slot = (title, m, extra = '') => `<div class="tl-slot"><small>${esc(title)}${extra ? `<span>${extra}</span>` : ''}</small>
    <div class="tl-names" data-m="${m.id}"><b translate="no">${esc(m.a || 'offen')}</b><b translate="no">${esc(m.b || 'offen')}</b><span class="tl-meta">${esc(m.event)} · ${esc(m.roundLabel)}${m.notes.length ? ' · Zeitwunsch' : ''}</span></div>`;
  function showCentral(el) {
    const d = st.d, C = d.central, closed = Boolean(d.day.finished_at);
    const all = d.matches, done = all.filter(m => m.done).length, run = all.filter(m => m.running).length, late = Math.max(0, ...all.filter(m => !m.done).map(m => m.delay));
    el.innerHTML = `${closed ? '<div class="banner">Das Turnier ist beendet – Spieler-Links gelten nicht mehr, die Plätze sind wieder frei. Wieder öffnen unter „Einstellungen“.</div>' : ''}
      <div class="kpis"><div class="kpi"><div class="l">Laufend</div><div class="v">${run}</div></div><div class="kpi"><div class="l">Warteschlange</div><div class="v">${C.queue.length}</div></div>
        <div class="kpi"><div class="l">Gespielt</div><div class="v">${done}<small style="font-size:.5em;color:var(--muted)"> / ${all.length}</small></div></div><div class="kpi"><div class="l">Größter Verzug</div><div class="v">${late} min</div></div></div>
      <div class="tl-courts">${C.courts.map(c => `<div class="card"><h3><span>${esc(c.name)}</span>${c.later ? `<span class="pill">+${c.later} danach</span>` : ''}</h3>
        ${c.running ? slot('Läuft', c.running, `seit <span class="tl-num">${c.running.minutes}</span> min`) + (closed ? '' : `<div class="btns"><button class="btn small primary" data-res="${c.running.id}">Ergebnis</button></div>`) + '</div>' : '<div class="tl-slot"><small>Läuft</small><span class="tl-meta">Platz frei</span></div>'}
        ${c.next ? slot('Als Nächstes', c.next, `<span class="tl-num">${esc(c.next.est || '–')}</span> ${delay(c.next)}`) + `<span class="tl-meta">${c.next.wait ? esc(c.next.wait) : 'bereit'}</span>${!closed && !c.running && !c.next.wait ? `<div class="btns"><button class="btn small" data-go="${c.next.id}">Match starten</button></div>` : ''}</div>` : '<div class="tl-slot"><small>Als Nächstes</small><span class="tl-meta">nichts geplant</span></div>'}
      </div>`).join('')}</div>
      <h2 class="sec">Warteschlange</h2>
      <div class="card">${C.queue.length ? `<table class="tbl sel kompakt"><tr><th>Match</th><th>Konkurrenz</th><th>Status</th><th></th></tr>${C.queue.map(m => `<tr data-sel="${m.id}"><td class="k-1z" translate="no"><b>${esc(m.a || 'offen')} – ${esc(m.b || 'offen')}</b></td><td>${esc(m.event)} · ${esc(m.roundLabel)}</td>
          <td>${m.wait ? `<span class="pill a" title="${esc(m.wait)}">${esc(m.wait.split(':')[0])}</span>` : '<span class="pill g">bereit</span>'}</td><td class="r"><span class="acts"><button class="btn ico" data-sel2="${m.id}" title="Platz zuweisen" aria-label="Platz zuweisen">${EDIT}</button></span></td></tr>`).join('')}</table>`
        : '<p class="empty">Kein Match wartet ohne Platz.</p>'}</div>`;
    // reine Knopfleiste ordnet die Kern-Gestaltung rückwärts (erster Knopf ganz rechts) – mit Auswahlfeld bleibt die Reihenfolge
    const btns = closed ? [] : ['<button class="btn" id="tlOrig">Ursprüngliche Planung …</button>', '<button class="btn" id="tlAgain">Neu einlesen …</button>', '<button class="btn" id="tlNewDay">+ Turniertag …</button>', '<button class="btn primary" id="tlAuto">Freie Plätze belegen</button>'];
    tools(el, daySelect() ? daySelect() + btns.join('') : btns.reverse().join(''));
    bindDay();
    el.querySelectorAll('[data-m],[data-sel],[data-sel2]').forEach(x => { x.onclick = e => { e.stopPropagation(); matchDialog(findM(x.dataset.m || x.dataset.sel || x.dataset.sel2)); }; });
    el.querySelectorAll('[data-res]').forEach(b => { b.onclick = () => resultDialog(findM(b.dataset.res)); });
    el.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => GK.busy(b, async () => { try { await api(`match/${b.dataset.go}/start`, 'POST', {}); toast('Match gestartet.'); reload(); } catch (e) { fail(e); } }); });
    if ($('tlAgain')) $('tlAgain').onclick = () => importDialog(true);
    if ($('tlNewDay')) $('tlNewDay').onclick = () => importDialog(false);
    if ($('tlAuto')) $('tlAuto').onclick = () => GK.busy($('tlAuto'), async () => { try { const r = await api(`tag/${st.did}/verteilen`, 'POST', {}); toast(r.moved.length ? `Verteilt: ${r.moved.join('; ')}` : 'Kein bereites Match für einen freien Platz.', !r.moved.length); reload(); } catch (e) { fail(e); } });
    if ($('tlOrig')) $('tlOrig').onclick = async () => {
      if (!await GK.ask('Ursprüngliche Planung wiederherstellen?\n\nAlle Matches, die noch nicht begonnen haben, kommen zurück auf Platz und Uhrzeit aus nuLiga. Gespielte und laufende Matches bleiben.', { ok: 'Wiederherstellen' })) return;
      try { const r = await api(`tag/${st.did}/ursprung`, 'POST', {}); toast(`${r.n} ${r.n === 1 ? 'Match' : 'Matches'} zurückgesetzt.`); reload(); } catch (e) { fail(e); }
    };
  }

  /* ---------- Zeitplan: je Platz eine Spalte, rote Linie für jetzt; am Handy Platz für Platz ---------- */
  function showPlan(el) {
    const d = st.d, ms = d.matches.filter(m => m.court_id && (m.est || m.time));
    const dates = [...new Set(ms.map(m => m.date))].sort();
    const t0 = new Date(d.now.replace(' ', 'T')), today = `${t0.getFullYear()}-${String(t0.getMonth() + 1).padStart(2, '0')}-${String(t0.getDate()).padStart(2, '0')}`;
    if (!dates.includes(st.zday)) st.zday = dates.includes(today) ? today : dates[0] || null;
    const narrow = window.matchMedia('(max-width: 700px)').matches;
    const cs = d.courts.filter(c => ms.some(m => m.court_id === c.id && m.date === st.zday));
    if (!cs.some(c => c.id === st.zcourt)) st.zcourt = cs[0] ? cs[0].id : null;
    const show = narrow ? cs.filter(c => c.id === st.zcourt) : cs;
    const dayM = ms.filter(m => m.date === st.zday);
    const mins = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
    const start = m => mins(m.done || m.running ? m.est || m.time : m.est || m.time);
    const len = m => Math.max(30, (m.est_end ? mins(m.est_end) : start(m) + d.cfg.minutes) - start(m));
    const from = dayM.length ? Math.floor(Math.min(...dayM.map(start)) / 60) * 60 : 8 * 60, to = dayM.length ? Math.ceil(Math.max(...dayM.map(m => start(m) + len(m))) / 60) * 60 : 18 * 60;
    const PX = 1.1, H = Math.max(1, to - from) * PX;
    const nowM = t0.getHours() * 60 + t0.getMinutes();
    const isNow = st.zday === today && nowM >= from && nowM <= to;
    const nowLine = label => (isNow ? `<div class="now" style="top:${(nowM - from) * PX}px">${label ? `<span>${String(t0.getHours()).padStart(2, '0')}:${String(t0.getMinutes()).padStart(2, '0')}</span>` : ''}</div>` : '');
    const chips = (list, cur, key) => `<div class="chips" role="group" aria-label="${key === 'zd' ? 'Tag' : 'Platz'}">${list.map(([k, l]) => `<button type="button" data-${key}="${esc(k)}" class="${String(k) === String(cur) ? 'on' : ''}" aria-pressed="${String(k) === String(cur)}">${esc(l)}</button>`).join('')}</div>`;
    const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    el.innerHTML = `${dates.length > 1 ? chips(dates.map(x => [x, `${WD[new Date(x + 'T12:00').getDay()]}, ${x.slice(8, 10)}.${x.slice(5, 7)}.`]), st.zday, 'zd') : ''}
      ${narrow && cs.length > 1 ? chips(cs.map(c => [c.id, c.name]), st.zcourt, 'zc') : ''}
      <div class="card">${show.length ? `<div class="tl-plan" style="--n:${show.length};--h:${H}px;--hr:${60 * PX}px"><span></span>${show.map(c => `<div class="head">${esc(c.name)}</div>`).join('')}
        <div class="ax">${Array.from({ length: (to - from) / 60 + 1 }, (_, i) => (isNow && Math.abs(from + i * 60 - nowM) < 28 ? '' : `<span style="top:${i * 60 * PX}px">${String((from / 60 + i) % 24).padStart(2, '0')}:00</span>`)).join('')}${nowLine(true)}</div>
        ${show.map(c => `<div class="col">${nowLine(false)}${dayM.filter(m => m.court_id === c.id).map(m => `<div class="blk${m.running ? ' run' : ''}${m.done ? ' done' : ''}${!m.done && m.delay >= 15 ? ' late' : !m.done && m.delay >= 5 ? ' bit' : ''}" data-m="${m.id}" style="top:${(start(m) - from) * PX}px;height:${len(m) * PX - 3}px" title="${esc(`${m.a || 'offen'} – ${m.b || 'offen'}`)}">
          <span class="t">${esc(m.est || m.time)}</span> ${m.done ? `<span class="tl-num">${esc(m.score)}</span>` : delay(m)}<b translate="no">${esc(m.a || 'offen')}</b><b translate="no">${esc(m.b || 'offen')}</b><span class="tl-meta">${esc(m.event)} · ${esc(m.roundLabel)}</span></div>`).join('')}</div>`).join('')}
      </div>` : '<p class="empty">Noch kein Match mit Platz und Uhrzeit – Plätze verteilt die Zentrale.</p>'}</div>
      <p class="muted s">Läuft ein Match länger, rutschen die folgenden Matches desselben Platzes und derselben Spieler nach hinten (rot: mehr als 15 Minuten über Plan). Dauer je Match ${d.cfg.minutes} Minuten, Pause ${d.cfg.pause} Minuten – unter „Einstellungen“.</p>`;
    el.querySelectorAll('[data-zd]').forEach(b => { b.onclick = () => { st.zday = b.dataset.zd; showPlan(el); }; });
    el.querySelectorAll('[data-zc]').forEach(b => { b.onclick = () => { st.zcourt = +b.dataset.zc; showPlan(el); }; });
    el.querySelectorAll('[data-m]').forEach(x => { x.onclick = () => matchDialog(findM(x.dataset.m)); });
  }

  /* ---------- Check-in mit Kassenbericht ---------- */
  const F = { alle: () => true, offen: p => !p.checked_in, da: p => p.checked_in && !p.absent, abwesend: p => p.absent, unbezahlt: p => p.fee && !p.paid };
  function showCheckin(el) {
    const d = st.d, k = d.kasse, closed = Boolean(d.day.finished_at);
    if (!F[st.cf]) st.cf = 'alle';
    const q = st.q.trim().toLowerCase();
    const sorter = { name: (x, y) => x.name.localeCompare(y.name, 'de'), zeit: (x, y) => String(x.first_match || '9').localeCompare(String(y.first_match || '9')) || x.name.localeCompare(y.name, 'de'), lk: (x, y) => (parseFloat(String(x.lk).replace(',', '.')) || 99) - (parseFloat(String(y.lk).replace(',', '.')) || 99) }[st.sort] || ((x, y) => 0);
    const list = d.people.filter(F[st.cf]).filter(p => !q || `${p.name} ${p.club}`.toLowerCase().includes(q)).sort(sorter);
    el.innerHTML = `<div class="kpis"><div class="kpi"><div class="l">Nenngeld gesamt</div><div class="v">${euro(k.total)}</div></div><div class="kpi"><div class="l">Bar</div><div class="v">${euro(k.bar)}</div></div>
        <div class="kpi"><div class="l">Digital</div><div class="v">${euro(k.digital)}</div></div><div class="kpi"><div class="l">Offen</div><div class="v">${euro(k.open)}</div></div></div>
      <div class="filterbar"><label class="f" style="flex:1 1 220px">Suche<input id="tlQ" type="search" placeholder="Name oder Verein" value="${esc(st.q)}" autocomplete="off"></label>
        <label class="f" style="flex:0 1 200px">Sortierung<select id="tlSort">${[['name', 'Nachname'], ['zeit', 'Startzeit'], ['lk', 'LK']].map(([v, l]) => `<option value="${v}" ${st.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="chips" id="tlCf" role="group" aria-label="Filter">${[['alle', 'Alle'], ['offen', 'Nicht eingecheckt'], ['da', 'Eingecheckt'], ['abwesend', 'Abwesend'], ['unbezahlt', 'Nicht bezahlt']].map(([x, l]) => `<button type="button" data-f="${x}" class="${st.cf === x ? 'on' : ''}" aria-pressed="${st.cf === x}">${l}<span class="cnt">${d.people.filter(F[x]).length}</span></button>`).join('')}</div>
      <div class="card">${list.length ? `<table class="tbl sel kompakt"><tr><th>Name</th><th>Verein</th><th>LK</th><th>Erstes Match</th><th>Status</th><th></th></tr>
        ${list.map(p => `<tr data-p="${p.id}"><td class="k-1z" translate="no"><b>${esc(p.name)}</b>${p.notes.length ? ' <span class="pill a" title="' + esc(p.notes.join(' · ')) + '">Zeitwunsch</span>' : ''}</td><td translate="no">${esc(p.club)}</td><td class="k-lbl" data-label="LK"><span class="tl-num">${esc(p.lk || '–')}</span></td>
          <td class="k-lbl" data-label="Erstes Match"><span class="tl-num">${p.first_match ? esc(p.first_match.slice(11, 16)) : '–'}</span></td>
          <td>${p.absent ? '<span class="pill r">abwesend</span>' : p.checked_in ? '<span class="pill g">da</span>' : '<span class="pill">offen</span>'} ${p.fee ? (p.paid ? `<span class="pill g">${esc(p.paid)}</span>` : `<span class="pill a">${euro(p.fee)} offen</span>`) : ''}</td>
          <td class="r"><span class="acts">${closed || p.checked_in ? '' : `<button class="btn ico" data-ci="${p.id}" title="Einchecken" aria-label="Einchecken">${CHECK}</button>`}</span></td></tr>`).join('')}</table>`
        : `<p class="empty">${d.people.length ? 'In dieser Auswahl ist niemand.' : 'Noch keine Spieler – erst aus nuLiga importieren.'}</p>`}</div>`;
    tools(el, '<button class="btn" id="tlQrAll">QR-Codes drucken</button>');
    $('tlQ').oninput = () => { st.q = $('tlQ').value; const pos = $('tlQ').selectionStart; showCheckin(el); $('tlQ').focus(); try { $('tlQ').setSelectionRange(pos, pos); } catch (e) { /* */ } };
    $('tlSort').onchange = () => { st.sort = $('tlSort').value; sessionStorage.setItem('tl_sort', st.sort); showCheckin(el); };
    el.querySelectorAll('#tlCf [data-f]').forEach(b => { b.onclick = () => { st.cf = b.dataset.f; sessionStorage.setItem('tl_cf', st.cf); showCheckin(el); }; });
    el.querySelectorAll('[data-ci]').forEach(b => { b.onclick = e => { e.stopPropagation(); GK.busy(b, async () => { try { await api('person/' + b.dataset.ci, 'POST', { checkin: true }); await load(); showCheckin(el); } catch (x) { fail(x); } }); }; });
    el.querySelectorAll('[data-p]').forEach(tr => { tr.onclick = () => personDialog(d.people.find(p => p.id === +tr.dataset.p), () => showCheckin(el)); });
    $('tlQrAll').onclick = () => GK.busy($('tlQrAll'), async () => {
      let r; try { r = await api(`tag/${st.did}/qr`); } catch (e) { return fail(e); }
      if (!r.url) return toast('Für die Spieler-Links fehlt die Adresse der Mitglieder-App (Einstellungen › Mitglieder-App).', true);
      GK.printHtml(`<div class="pr"><h2 style="margin:0 0 4mm;font-size:14pt">${esc(d.day.name)} – deine Spielerseite</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6mm">${r.list.map(x => `<div style="break-inside:avoid;text-align:center;border:1px solid #999;border-radius:3mm;padding:3mm"><div style="width:40mm;margin:0 auto">${x.svg}</div><b>${esc(x.name)}</b><br><small>${esc(x.club)}</small></div>`).join('')}</div></div>`);
    });
  }
  function personDialog(p, done) {
    const closed = Boolean(st.d.day.finished_at);
    GK.dialog(`<h2 translate="no">${esc(p.name)}</h2><p class="muted" style="margin-top:-4px" translate="no">${esc(p.club || 'ohne Verein')}${p.lk ? ` · LK ${esc(p.lk)}` : ''}</p>
      ${p.notes.length ? `<div class="banner a">${p.notes.map(n => esc(n)).join('<br>')}</div>` : ''}
      <dl class="vh-kv"><dt>Konkurrenzen</dt><dd>${esc(p.events.join(', ') || '–')}</dd><dt>Erstes Match</dt><dd>${p.first_match ? `${dm(p.first_match.slice(0, 10))}, ${esc(p.first_match.slice(11, 16))} Uhr` : '–'}</dd>
        <dt>Check-in</dt><dd>${p.checked_in ? `da seit ${esc(p.checked_at.slice(11, 16))} Uhr` : 'noch nicht'}${p.absent ? ' · abwesend' : ''}</dd><dt>Nenngeld</dt><dd>${p.fee ? `${euro(p.fee)} ${p.paid ? `· bezahlt (${esc(p.paid)})` : `· offen${p.pay_hint ? ` (nuLiga: ${esc(p.pay_hint)})` : ''}`}` : 'keins'}</dd></dl>
      ${closed ? '' : `<div class="btns">${p.checked_in ? `<button class="btn" id="tdAbs">${p.absent ? 'Wieder da' : 'Abwesend'}</button><button class="btn" id="tdOut">Check-in zurücknehmen</button>` : ''}
        ${p.fee ? (p.paid ? '<button class="btn" id="tdUnpay">Zahlung zurücknehmen</button>' : '<button class="btn" id="tdDig">Digital bezahlt</button><button class="btn" id="tdBar">Bar bezahlt</button>') : ''}
        ${p.checked_in ? '' : '<button class="btn primary" id="tdIn">Einchecken</button>'}</div>`}
      <div id="tdQr" class="tl-qr" style="margin-top:12px"></div>
      <div class="btns"><button class="btn" id="tdQrB">QR-Code der Spielerseite</button><button class="btn ghost" id="tdX">Schließen</button></div>`);
    const act = (id, body, msg) => { if ($(id)) $(id).onclick = () => GK.busy($(id), async () => { try { await api('person/' + p.id, 'POST', body); GK.closeDialog(); toast(msg); await load(); done(); } catch (e) { fail(e); } }); };
    act('tdIn', { checkin: true }, 'Eingecheckt.'); act('tdOut', { checkin: false }, 'Check-in zurückgenommen.');
    act('tdAbs', { absent: !p.absent }, p.absent ? 'Wieder da.' : 'Als abwesend markiert – seine Matches warten.');
    act('tdBar', { paid: 'bar' }, 'Bar bezahlt.'); act('tdDig', { paid: 'digital' }, 'Digital bezahlt.'); act('tdUnpay', { paid: null }, 'Zahlung zurückgenommen.');
    $('tdX').onclick = GK.closeDialog;
    $('tdQrB').onclick = () => GK.busy($('tdQrB'), async () => {
      let r; try { r = await api(`person/${p.id}/qr`); } catch (e) { return fail(e); }
      $('tdQr').innerHTML = r.url ? `${r.svg}<span class="muted s" style="overflow-wrap:anywhere;text-align:center">Nur ansehen, gilt nur für dieses Turnier und bis zu seinem Ende.</span>` : '<p class="muted">Für die Spieler-Links fehlt die Adresse der Mitglieder-App (Einstellungen › Mitglieder-App).</p>';
    });
  }

  /* ---------- Ergebnisse (auch zum Abtippen in nuLiga) ---------- */
  async function showResults(el) {
    let r; try { r = await api(`tag/${st.did}/ergebnisliste`); } catch (e) { return fail(e); }
    const html = print => r.events.map(e => `<h2 class="sec">${esc(e.name)}${r.day.sources && r.day.sources.length > 1 ? ` <small>${esc(e.tournament || '')}</small>` : ''}</h2>${e.rounds.map(rd => `<div class="card"><h3>${esc(rd.label)}</h3>
      <table class="tbl${print ? '' : ' sel'} kompakt"><tr><th>Nr.</th><th>Match</th><th>Ergebnis</th></tr>${rd.matches.map(m => `<tr ${print ? '' : `data-no="${esc(e.name)}|${esc(rd.label)}|${m.no}"`}><td class="tl-num">${m.no}</td><td translate="no"><b>${esc(m.a || 'offen')} – ${esc(m.b || 'offen')}</b></td><td>${m.done ? `<span class="tl-num">${esc(m.score)}</span>${m.winner ? ` <span class="muted s">(Sieg ${esc(m.winner === 'a' ? m.a : m.b)})</span>` : ''}` : '<span class="pill">offen</span>'}</td></tr>`).join('')}</table></div>`).join('')}`).join('');
    el.innerHTML = r.events.length ? `<p class="muted s">Je Konkurrenz und Runde in der Reihenfolge von nuLiga – so lassen sich die Ergebnisse nach dem Turnier in nuLiga abtippen.</p>${html(false)}` : '<div class="card"><p class="empty">Noch keine Matches.</p></div>';
    tools(el, r.events.length ? '<button class="btn" id="tlPrint">Drucken</button>' : '');
    if ($('tlPrint')) $('tlPrint').onclick = () => GK.printHtml(`<div class="pr"><h2 style="margin:0 0 4mm;font-size:14pt">${esc(r.day.name)} – Ergebnisse</h2>${html(true)}</div>`);
    el.querySelectorAll('[data-no]').forEach(tr => { tr.onclick = () => { const [ev, rl, no] = tr.dataset.no.split('|'); const m = st.d.matches.find(x => x.event === ev && x.roundLabel === rl && x.no === +no); if (m) matchDialog(m); }; });
  }

  /* ---------- Plätze und Sperre im Buchungssystem ---------- */
  async function showCourts(el) {
    const d = st.d, res = d.booking ? await api('buchungsplaetze').catch(() => []) : [];
    const day = d.day, closed = Boolean(day.finished_at);
    el.innerHTML = `<div class="card"><table class="tbl kompakt"><tr><th>Platz</th>${d.booking ? '<th>Platz im Buchungssystem</th>' : ''}<th>Automatisch verteilen</th><th></th></tr>
        ${d.courts.map(c => `<tr><td><b>${esc(c.name)}</b>${c.manual ? ' <span class="pill">von Hand</span>' : ''}</td>
          ${d.booking ? `<td><select data-res="${c.id}" aria-label="Platz im Buchungssystem: ${esc(c.name)}" ${closed ? 'disabled' : ''}><option value="">– frei, sperrt nichts –</option>${res.map(r => `<option value="${r.id}" ${r.id === c.resource_id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></td>` : ''}
          <td><label class="chk" style="margin:0"><input type="checkbox" data-auto="${c.id}" ${c.auto ? 'checked' : ''} ${closed ? 'disabled' : ''}> ja</label></td>
          <td class="r"><span class="acts">${c.manual && !c.used && !closed ? `<button class="btn ico" data-del="${c.id}" title="Platz entfernen" aria-label="Platz entfernen">${DEL}</button>` : ''}</span></td></tr>`).join('')}</table>
        <p class="muted s" style="margin:10px 0 0">Die Plätze kommen aus den Platznamen in nuLiga. Plätze außerhalb der eigenen Anlage (z. B. eine Halle) mit „+ Platz“ anlegen – sie sperren nichts. „Freie Plätze belegen“ in der Zentrale nutzt nur Plätze mit „automatisch verteilen“.</p></div>
      <div class="card" data-card="sperre"><h3>Sperre im Buchungssystem</h3>
        ${!d.booking ? '<p class="muted">Ohne das Modul „Plätze“ läuft der Turniertag ohne Sperren.</p>'
          : `<p>${day.locked ? `Die zugeordneten Plätze sind an den Turniertagen von <span class="tl-num">${esc(day.lock_from)}</span> bis <span class="tl-num">${esc(day.lock_to)}</span> Uhr gesperrt.` : 'Noch nicht gesperrt. Gesperrt werden nur Plätze mit Zuordnung – Buchungen in dieser Zeit werden storniert, die Mitglieder bekommen Bescheid.'}</p>
          ${closed ? '' : `<div class="row"><label class="f" style="flex:0 1 160px">Von<input type="time" id="tlLf" value="${esc(day.lock_from || d.lockSuggest.from)}"></label><label class="f" style="flex:0 1 160px">Bis<input type="time" id="tlLt" value="${esc(day.lock_to && day.lock_to !== '24:00' ? day.lock_to : d.lockSuggest.to === '24:00' ? '23:59' : d.lockSuggest.to)}"></label></div>
          <div class="btns">${day.locked ? '<button class="btn" id="tlUnlock">Sperre aufheben</button>' : ''}<button class="btn primary" id="tlLock">${day.locked ? 'Sperre ändern …' : 'Plätze sperren …'}</button></div>`}`}</div>`;
    tools(el, closed ? '' : '<button class="btn primary" id="tlAddC">+ Platz</button>');
    el.querySelectorAll('[data-res]').forEach(x => { x.onchange = async () => { try { await api('platz/' + x.dataset.res, 'PUT', { resource_id: x.value ? +x.value : null }); toast('Gespeichert.'); await load(); } catch (e) { fail(e); await load(); showCourts(el); } }; });
    el.querySelectorAll('[data-auto]').forEach(x => { x.onchange = async () => { try { await api('platz/' + x.dataset.auto, 'PUT', { auto: x.checked }); toast('Gespeichert.'); await load(); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-del]').forEach(b => { b.onclick = async () => { if (!await GK.ask('Platz entfernen?', { ok: 'Entfernen', danger: true })) return; try { await api('platz/' + b.dataset.del, 'DELETE'); await load(); showCourts(el); } catch (e) { fail(e); } }; });
    if ($('tlAddC')) $('tlAddC').onclick = () => {
      GK.dialog(`<h2>Platz anlegen</h2><p class="muted">z. B. „Halle Platz A“ für ein Turnier in einer fremden Halle. Solche Plätze sperren nichts im Buchungssystem.</p>
        <label class="f">Name<input id="tcN" maxlength="40" autocomplete="off"></label>
        <div class="btns"><button class="btn ghost" id="tcX">Abbrechen</button><button class="btn primary" id="tcOk">Anlegen</button></div>`);
      $('tcX').onclick = GK.closeDialog; $('tcN').focus();
      $('tcOk').onclick = () => GK.busy($('tcOk'), async () => { try { await api(`tag/${st.did}/platz`, 'POST', { name: $('tcN').value }); GK.closeDialog(); await load(); showCourts(el); } catch (e) { fail(e); } });
    };
    if ($('tlUnlock')) $('tlUnlock').onclick = async () => { if (!await GK.ask('Sperre aufheben?\n\nDie Plätze sind im Buchungssystem dann wieder frei buchbar.', { ok: 'Aufheben' })) return; try { await api(`tag/${st.did}/sperre`, 'POST', { off: true }); toast('Sperre aufgehoben.'); await load(); showCourts(el); } catch (e) { fail(e); } };
    if ($('tlLock')) $('tlLock').onclick = () => GK.busy($('tlLock'), async () => {
      const body = { from: $('tlLf').value, to: $('tlLt').value === '23:59' ? '24:00' : $('tlLt').value };
      let p; try { p = await api(`tag/${st.did}/sperre`, 'POST', { ...body, preview: true }); } catch (e) { return fail(e); }
      const msg = `Plätze sperren?\n\n${p.made} ${p.made === 1 ? 'Sperre' : 'Sperren'} neu${p.removed ? `, ${p.removed} entfallen` : ''}.${p.conflicts.length ? `\n\nDiese Buchungen werden storniert:\n${p.conflicts.map(c => `${c.resource} ${GK.deDate(c.date)} ${c.start}–${c.end} ${c.title}`).join('\n')}` : ''}`;
      if (!await GK.ask(msg, { ok: 'Sperren', danger: p.conflicts.length > 0 })) return;
      try { await api(`tag/${st.did}/sperre`, 'POST', body); toast('Gesperrt.'); await load(); showCourts(el); } catch (e) { fail(e); }
    });
  }

  /* ---------- Einstellungen ---------- */
  function showSettings(el) {
    const d = st.d, c = d.cfg, day = d.day;
    el.innerHTML = `<div class="card" data-card="zeitplan"><h3>Zeitplan</h3>
        <div class="row"><label class="f" style="flex:1 1 200px">Dauer je Match<select id="tlMin">${[45, 60, 75, 90, 105, 120].map(n => `<option value="${n}" ${n === c.minutes ? 'selected' : ''}>${n} Minuten</option>`).join('')}</select></label>
          <label class="f" style="flex:1 1 200px">Pause zwischen zwei Matches<select id="tlPau">${[0, 15, 30, 45, 60].map(n => `<option value="${n}" ${n === c.pause ? 'selected' : ''}>${n ? `${n} Minuten` : 'keine'}</option>`).join('')}</select></label></div>
        <div class="btns"><button class="btn primary" id="tlSave1">Speichern</button></div></div>
      <div class="card" data-card="datenschutz"><h3>Datenschutz</h3>
        <p class="muted s" style="margin-top:0">Namen, Vereine und LK von Spielern fremder Vereine werden nach dieser Frist nach dem letzten Turniertag gelöscht. Eigene Mitglieder (Vereinsnummer des Veranstalters) bleiben.</p>
        <label class="f" style="max-width:260px">Löschfrist<select id="tlKeep">${[7, 14, 30, 90, 365].map(n => `<option value="${n}" ${n === c.keep_days ? 'selected' : ''}>${n} Tage</option>`).join('')}</select></label>
        <div class="btns"><button class="btn primary" id="tlSave2">Speichern</button></div></div>
      <div class="card" data-card="fernseher"><h3>Fernseher im Clubhaus</h3>
        <p class="muted s" style="margin-top:0">Im Browser des Fernsehers diese Adresse öffnen (im Vereins-WLAN, einmal mit dem Tablet-Passwort freischalten). Die Anzeige zeigt am Turniertag Plätze, Verzug und Ergebnisse und aktualisiert sich selbst.</p>
        <div class="row" style="align-items:center"><code id="tlTv" style="overflow-wrap:anywhere;flex:1 1 240px">${esc(new URL('x/turniere/tv.html', location.href).href)}</code><button class="btn" id="tlTvCopy">Adresse kopieren</button></div></div>
      <div class="card" data-card="turniertag"><h3>Turniertag</h3>
        <label class="f">Name<input id="tlName" maxlength="120" value="${esc(day.name)}"></label>
        <p class="muted s">Importiert aus: ${esc(day.sources.map(s => s.file || s.name).join(', ') || '–')}</p>
        <div class="btns"><button class="btn" id="tlFin">${day.finished_at ? 'Turnier wieder öffnen' : 'Turnier beenden …'}</button><button class="btn primary" id="tlSave3">Speichern</button></div>
        <div class="btns" style="margin-top:8px;border-top:1px solid var(--line);padding-top:12px"><button class="btn danger" id="tlDel">Turniertag löschen</button></div></div>`;
    const put = (btn, body) => GK.busy($(btn), async () => { try { await api('einstellungen', 'PUT', body); toast('Gespeichert.'); await load(); } catch (e) { fail(e); } });
    $('tlTvCopy').onclick = () => { GK.copyText($('tlTv').textContent); toast('Adresse kopiert.'); };
    $('tlSave1').onclick = () => put('tlSave1', { minutes: +$('tlMin').value, pause: +$('tlPau').value });
    $('tlSave2').onclick = () => put('tlSave2', { keep_days: +$('tlKeep').value });
    $('tlSave3').onclick = () => GK.busy($('tlSave3'), async () => { try { await api('tag/' + st.did, 'PUT', { name: $('tlName').value }); toast('Gespeichert.'); await days(); await load(); lead(); } catch (e) { fail(e); } });
    $('tlFin').onclick = async () => {
      if (!day.finished_at && !await GK.ask('Turnier beenden?\n\nDie Spieler-Links gelten danach nicht mehr, und die Sperren im Buchungssystem fallen weg. Ergebnisse bleiben für die Ergebnisliste.', { ok: 'Beenden', danger: false })) return;
      try { await api(`tag/${st.did}/beenden`, 'POST', { undo: Boolean(day.finished_at) }); toast(day.finished_at ? 'Wieder geöffnet.' : 'Turnier beendet.'); await days(); reload(); } catch (e) { fail(e); }
    };
    $('tlDel').onclick = async () => {
      if (!await GK.ask(`Turniertag „${day.name}“ löschen?\n\nSpieler, Check-in, Nenngeld und Ergebnisse dieses Turniertags sind danach weg; Sperren im Buchungssystem werden aufgehoben.`)) return;
      try { await api('tag/' + st.did, 'DELETE'); sessionStorage.removeItem('tl_did'); st.did = null; toast('Gelöscht.'); await days(); render(); } catch (e) { fail(e); }
    };
  }

  async function render() {
    await days(); await load();
    $('main').innerHTML = '<h2 class="page">Turniertag</h2><p class="lead" id="tlLead"></p><div id="tlTabs"></div>';
    lead();
    if (!st.d) {
      $('tlTabs').innerHTML = `<div class="card"><p class="empty">Noch kein Turniertag. Die XML-Datei des Turniers aus nuLiga importieren – mit Spielern, Konkurrenzen und Spielplan. Danach Check-in, Plätze und Ergebnisse hier.</p>
        <div class="btns"><button class="btn primary" id="tlImp0">nuLiga-Dateien importieren …</button></div></div>`;
      $('tlImp0').onclick = () => importDialog(false);
      return;
    }
    st.tabs = GK.tabs($('tlTabs'), 'turniertag', [['zentrale', 'Zentrale'], ['zeitplan', 'Zeitplan'], ['checkin', 'Check-in'], ['ergebnisse', 'Ergebnisse'], ['plaetze', 'Plätze'], ['einstellungen', 'Einstellungen']], async (k, el) => {
      if (!st.d) await load();
      if (k === 'zentrale') return showCentral(el);
      if (k === 'zeitplan') return showPlan(el);
      if (k === 'checkin') return showCheckin(el);
      if (k === 'ergebnisse') return showResults(el);
      if (k === 'plaetze') return showCourts(el);
      return showSettings(el);
    });
  }
  window.TurnierLK = { render, importNew: () => importDialog(false) };
})();
