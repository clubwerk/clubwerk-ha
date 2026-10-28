'use strict';
/* Verwaltungsseite „Turnierplaner“ (freie Turniere, z. B. Dorfturnier): Liste der Turniere und Ehrentafel; je Turnier eine Detailansicht
   mit den Reitern Zentrale · Spielplan · Tabellen · Mannschaften · Einstellungen. Wird von admin.js beim ersten Öffnen nachgeladen.
   Tabelle, Ergebnis und Turnierbaum aus ansicht.js – dieselben Bausteine wie am Tablet. */
(() => {
  if (window.TurnierFT) return;
  const GK = window.GK;
  const { $, esc, toast, fail } = GK;
  const api = (url, method, body) => GK.api('x/turniere/ft' + url, method, body);
  const V = () => window.TurnierAnsicht;
  const st = { meta: null, mf: sessionStorage.getItem('ft_mf') || 'alle' };
  const dm = s => (s ? GK.deDate(s) : '–');
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const dayTxt = d => `${WD[new Date(d + 'T12:00').getDay()]}, ${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  const EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const QR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M21 14v7h-7"/></svg>';
  if (!document.getElementById('ftStyle')) {
    const s = document.createElement('style'); s.id = 'ftStyle';
    s.textContent = `
      .ft-courts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 12px; align-items: stretch; margin-bottom: 16px; }
      .ft-courts > .card { margin: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
      .ft-courts h3 { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 0; }
      .ft-slot { border-top: 1px solid var(--line); padding-top: 10px; min-width: 0; }
      .ft-slot:first-of-type { border-top: 0; padding-top: 0; }
      .ft-slot > small { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
      .ft-slot > small span { text-transform: none; letter-spacing: 0; white-space: nowrap; }
      .ft-names { display: grid; gap: 2px; min-width: 0; cursor: pointer; }
      .ft-names b { display: block; font-size: 14.5px; overflow-wrap: anywhere; color: var(--ink); }
      .ft-meta { font-size: 12.5px; color: var(--muted); overflow-wrap: anywhere; }
      .ft-slot .btns { margin-top: 8px; justify-content: flex-start; }
      .ft-num { font-family: var(--num); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 16px; white-space: nowrap; }
      .ft-late { color: var(--red); font-weight: 700; } .ft-bit { color: var(--amber); font-weight: 700; }
      .ft-ph { color: var(--muted); font-style: italic; }
      .ft-score { display: grid; grid-template-columns: minmax(0, 1fr) 76px 12px 76px; gap: 8px; align-items: center; margin: 12px 0 0; }
      .ft-score .h { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; overflow-wrap: anywhere; }
      .ft-score .c { text-align: center; color: var(--muted); font-weight: 700; }
      .ft-score input { width: 100%; box-sizing: border-box; height: 46px; border: 1px solid var(--line); border-radius: 12px; background: var(--field); color: var(--ink); text-align: center; font-family: var(--num); font-size: 18px; font-weight: 600; }
      .ft-qr { display: grid; place-items: center; gap: 8px; }
      .ft-qr svg { width: min(240px, 70vw); height: auto; background: #fff; padding: 8px; border-radius: 12px; }
      .ft-hon > div { padding: 10px 0; border-top: 1px solid var(--line); }
      .ft-hon h3.y { margin: 14px 0 2px; font-family: var(--num); font-weight: 600; font-size: 22px; color: var(--brand-ink); }
      .ft-hon h3.y:first-child { margin-top: 0; }
      .ft-hon h3.y + div { border-top: 0; }
      .ft-hon .t { font-weight: 700; overflow-wrap: anywhere; }
      .ft-hon .ft-pod { margin: 4px 0 0; }
      @media print { .ft-courts .card { box-shadow: none; } }`;
    document.head.appendChild(s);
  }
  /** Knöpfe rechts in die Reiterzeile, sonst als Knopfleiste oben im Inhalt (wie Turniertag und Clubmeisterschaft) */
  const tools = (el, html) => { if (html && !GK.tabTools(html, el.firstElementChild || el)) el.insertAdjacentHTML('afterbegin', `<div class="toolbar">${html}</div>`); };
  const delay = m => (m.delay >= 10 ? `<span class="ft-late">+${m.delay} min</span>` : m.delay >= 5 ? `<span class="ft-bit">+${m.delay} min</span>` : '');
  const nm = (m, s) => (m[s] ? `<span translate="no">${esc(m[s])}</span>` : `<span class="ft-ph">${esc(m[s + '_ph'] || 'offen')}</span>`);
  const pair = m => `${nm(m, 'a')} – ${nm(m, 'b')}`;
  const courtWord = (c, n) => (c.court === 'Spielfeld' ? (n === 1 ? 'Spielfeld' : 'Spielfelder') : c.court === 'Feld' ? (n === 1 ? 'Feld' : 'Felder') : (n === 1 ? 'Platz' : 'Plätze'));
  const teamWord = (d, n) => (d.ft.format === 'schleifchen' ? (n === 1 ? 'Teilnehmer' : 'Teilnehmer') : (n === 1 ? 'Mannschaft' : 'Mannschaften'));
  /** Restzeit laufender Spiele: tickt jede Sekunde mit, ohne die Seite neu zu laden */
  let tick = null;
  function ticker(el) {
    clearInterval(tick);
    const t0 = Date.now();
    const draw = () => { if (!el.isConnected) return clearInterval(tick); el.querySelectorAll('[data-left]').forEach(x => { const l = +x.dataset.left - Math.round((Date.now() - t0) / 1000); x.textContent = l > 0 ? `${Math.floor(l / 60)}:${String(l % 60).padStart(2, '0')}` : `+${Math.floor(-l / 60)}:${String(-l % 60).padStart(2, '0')}`; x.classList.toggle('ft-late', l < 0); }); };
    draw(); tick = setInterval(draw, 1000);
  }

  /* ================================================================= Liste und Ehrentafel */
  async function meta() { st.meta = await api('/liste'); return st.meta; }
  function stateOf(t) {
    const today = GK.today();
    if (t.finished_at) return ['', 'beendet'];
    if (t.date === today && t.drawn_at) return ['g', 'heute'];
    if (!t.drawn_at) return ['a', 'noch nicht ausgelost'];
    return t.date < today ? ['a', 'nicht beendet'] : ['b', 'ausgelost'];
  }
  async function render() {
    await meta();
    $('main').innerHTML = '<h2 class="page">Turnierplaner</h2><p class="lead">Eigene Turniere wie das Dorfturnier – Tennis oder Fußball, mit Gruppen, Endrunde, Spielplan und Monitor.</p><div id="ftTabs"></div>';
    GK.tabs($('ftTabs'), 'turnierplaner', [['turniere', 'Turniere'], ['ehrentafel', 'Ehrentafel']], async (k, el) => (k === 'ehrentafel' ? showHonors(el) : showList(el)));
  }
  function showList(el) {
    const list = st.meta.list;
    el.innerHTML = `<div class="card">${list.length ? `<table class="tbl sel kompakt"><tr><th>Turnier</th><th>Tag</th><th>Art</th><th>Stand</th><th></th></tr>
      ${list.map(t => { const [c, l] = stateOf(t); return `<tr data-ft="${t.id}"><td class="k-1z"><b translate="no">${esc(t.name)}</b></td><td><span class="ft-num">${dm(t.date)}</span> · ${esc(t.start)} Uhr</td>
        <td class="k-weg">${esc(st.meta.sports[t.sport] ? st.meta.sports[t.sport].label : t.sport)} · ${esc(st.meta.formats[t.format] || '')}</td><td><span class="pill ${c}">${esc(l)}</span></td>
        <td class="r"><span class="acts"><button class="btn ico" data-ft2="${t.id}" title="Öffnen" aria-label="Öffnen">${EDIT}</button></span></td></tr>`; }).join('')}</table>`
      : '<p class="empty">Noch kein Turnier. Mit „+ Neues Turnier“ ein Dorfturnier anlegen – danach Mannschaften eintragen und auslosen.</p>'}</div>`;
    tools(el, '<button class="btn primary" id="ftNew">+ Neues Turnier</button>');
    $('ftNew').onclick = () => newDialog();
    el.querySelectorAll('[data-ft],[data-ft2]').forEach(x => { x.onclick = e => { e.stopPropagation(); GK.openDetail('turnier', +(x.dataset.ft || x.dataset.ft2)); }; });
  }
  async function showHonors(el) {
    const list = await api('-ehrentafel');
    const years = [...new Set(list.map(x => x.year))];
    el.innerHTML = `<div class="card">${list.length ? `<div class="ft-hon">${years.map(y => `<h3 class="y">${esc(y)}</h3>${list.filter(x => x.year === y).map(x => `<div><span class="t" translate="no">${esc(x.name)}</span>
        ${x.podium.length ? V().ftPodium(x.podium) : '<span class="muted s">ohne Platzierung</span>'}</div>`).join('')}`).join('')}</div>`
      : '<p class="empty">Noch kein Turnier beendet. Beim Beenden kommen Sieger, Zweiter und Dritter hierher – je Turnier und Jahr.</p>'}</div>`;
    tools(el, list.length ? '<button class="btn" id="ftHonPrint">Drucken</button>' : '');
    if ($('ftHonPrint')) $('ftHonPrint').onclick = () => GK.printHtml(`<div class="pr"><h2 style="margin:0 0 4mm;font-size:14pt">Ehrentafel</h2>${el.querySelector('.ft-hon').outerHTML}</div>`);
  }

  /* ================================================================= Neues Turnier (mit Vorschau: Gruppen, Spiele, voraussichtliches Ende) */
  function newDialog() {
    const sp = st.meta.sports, today = GK.today();
    GK.dialog(`<h2>Neues Turnier</h2>
      <div class="frm"><label class="f wall">Name<input id="nfN" maxlength="80" placeholder="z. B. Dorfturnier ${new Date().getFullYear()}"></label>
        <label class="f">Sportart<select id="nfS">${Object.entries(sp).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></label>
        <label class="f">Spielform<select id="nfF">${Object.entries(st.meta.formats).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
        <label class="f w1">Tag<input id="nfD" type="date" value="${today}"></label><label class="f w1">Beginn<input id="nfT" type="time" value="10:00"></label>
        <label class="f w1" id="nfCL">Plätze<input id="nfC" type="number" inputmode="numeric" min="1" max="30" value="4"></label><label class="f w1">Mannschaften (etwa)<input id="nfX" type="number" inputmode="numeric" min="2" max="128" value="16"></label>
        <label class="f w1">Spielzeit (Minuten)<input id="nfM" type="number" inputmode="numeric" min="5" max="180"></label><label class="f w1">Pause (Minuten)<input id="nfP" type="number" inputmode="numeric" min="0" max="60"></label>
        <label class="f w1" id="nfGL">Gruppengröße<select id="nfG">${[3, 4, 5, 6].map(n => `<option value="${n}" ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="f w1" id="nfRL">Runden<select id="nfR">${[2, 3, 4, 5, 6, 8].map(n => `<option value="${n}" ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <p class="muted s" style="margin:10px 0 0">Die Sportart setzt Punkte, Spielzeit, Pause und die Entscheidung im K.-o. (Tennis: Tiebreak bis 7, Fußball: Neunmeterschießen). Alles lässt sich später unter „Einstellungen“ ändern.</p>
      <div class="banner" id="nfPrev" style="margin-top:12px">&nbsp;</div>
      <div class="btns"><button class="btn ghost" id="nfX0">Abbrechen</button><button class="btn primary" id="nfOk">Anlegen</button></div>`, true);
    const v = id => $(id).value;
    const sport = () => sp[v('nfS')];
    const tmpl = () => { $('nfM').value = sport().minutes; $('nfP').value = sport().pause; $('nfCL').firstChild.textContent = sport().court === 'Spielfeld' ? 'Spielfelder' : 'Plätze'; };
    const shape = () => { $('nfGL').style.display = v('nfF') === 'gruppen' ? '' : 'none'; $('nfRL').style.display = v('nfF') === 'schleifchen' ? '' : 'none'; };
    let t = 0;
    const prev = () => { clearTimeout(t); t = setTimeout(async () => {
      if (!$('nfPrev')) return;
      let p; try { p = await api('/vorschau', 'POST', { sport: v('nfS'), format: v('nfF'), n: +v('nfX'), courts: +v('nfC'), date: v('nfD'), start: v('nfT'), cfg: cfgNew() }); } catch (e) { return; }
      if (!$('nfPrev')) return;
      $('nfPrev').innerHTML = previewText(p, v('nfF'), sport());
    }, 250); };
    const cfgNew = () => ({ minutes: +v('nfM'), pause: +v('nfP'), group_size: +v('nfG'), rounds: +v('nfR') });
    tmpl(); shape(); prev();
    $('nfS').onchange = () => { tmpl(); prev(); };
    $('nfF').onchange = () => { shape(); prev(); };
    ['nfD', 'nfT', 'nfC', 'nfX', 'nfM', 'nfP', 'nfG', 'nfR'].forEach(id => { $(id).oninput = prev; $(id).onchange = prev; });
    $('nfX0').onclick = GK.closeDialog;
    $('nfOk').onclick = () => GK.busy($('nfOk'), async () => {
      try {
        const r = await api('', 'POST', { name: v('nfN'), sport: v('nfS'), format: v('nfF'), date: v('nfD'), start: v('nfT'), courts: +v('nfC'), cfg: cfgNew() });
        GK.closeDialog(); toast('Turnier angelegt – jetzt die Mannschaften eintragen.'); GK.openDetail('turnier', r.id, 'mannschaften');
      } catch (e) { fail(e); }
    });
  }
  /** „8 Gruppen (4 × 4, 4 × 3) · 52 Spiele · Endrunde 16 über Kreuz · Ende etwa 15:40 Uhr“ */
  function previewText(p, format, c) {
    if (!p || !p.teams) return 'Für eine Vorschau bitte Mannschaften und Plätze eintragen.';
    const by = {}; (p.groups || []).forEach(n => { by[n] = (by[n] || 0) + 1; });
    const gtxt = p.groups && p.groups.length > 1 ? `${p.groups.length} Gruppen (${Object.keys(by).sort((a, b) => b - a).map(n => `${by[n]} × ${n}`).join(', ')})` : '';
    const ko = p.ko ? (format === 'ko' ? `Feld ${p.ko.size}${p.ko.byes ? `, ${p.ko.byes} Freilos${p.ko.byes === 1 ? '' : 'e'}` : ''}`
      : p.ko.size >= 2 ? `Endrunde ${p.ko.size}${p.ko.cross ? ' über Kreuz' : p.ko.fill ? ` mit den ${p.ko.fill} besten ${p.ko.take === 2 ? 'Dritten' : 'Zweiten'}` : ''}` : '') : '';
    const out = format === 'schleifchen' && p.out ? `je Runde ${p.out} ${p.out === 1 ? 'Aussetzer' : 'Aussetzer'}` : '';
    const end = p.end ? `Ende etwa <b class="ft-num">${esc(p.end)}</b> Uhr` : '';
    return [gtxt, `${p.matches} Spiele`, ko, out, end].filter(Boolean).join(' · ') + (format === 'schleifchen' && p.teams < 4 ? ' · mindestens 4 Teilnehmer' : '') + `<span class="muted s"> (${esc(c.label)}: ${p.minutes ? Math.floor(p.minutes / 60) + ' h ' + (p.minutes % 60) + ' min' : '–'})</span>`;
  }

  /* ================================================================= Detailansicht eines Turniers */
  async function loadDetail(id) {
    if (!st.meta) await meta();
    const d = await api('/' + id).catch(() => null); if (!d) return null;
    const ft = d.ft, c = d.cfg;
    const lead = [`${st.meta.sports[ft.sport].label} · ${ft.format_label}`, `${dayTxt(ft.date)} ab ${ft.start} Uhr`, d.end && ft.drawn && !ft.finished_at ? `Ende etwa ${d.end} Uhr` : '', ft.finished_at ? 'beendet' : ''].filter(Boolean).join(' · ');
    return { title: ft.name, lead, tabs: [['zentrale', 'Zentrale'], ['spielplan', 'Spielplan'], ['tabellen', ft.format === 'schleifchen' ? 'Rangliste' : 'Tabellen'], ['mannschaften', ft.format === 'schleifchen' ? 'Teilnehmer' : 'Mannschaften'], ['einstellungen', 'Einstellungen']], d, c };
  }
  async function detail(tab, el, rec, id) {
    const d = rec.d;
    const again = () => GK.openDetail('turnier', id);
    if (tab === 'zentrale') return showCentral(el, d, again);
    if (tab === 'spielplan') return showPlan(el, d, again);
    if (tab === 'tabellen') return showTables(el, d, again);
    if (tab === 'mannschaften') return showTeams(el, d, again);
    return showSettings(el, d, again);
  }
  const findM = (d, id) => d.all.find(m => m.id === +id);
  const closed = d => Boolean(d.ft.finished_at);

  /* ---------- Hinweise: Los ziehen bei Gleichstand ---------- */
  function notesHtml(d) {
    return d.notes.map((n, i) => `<div class="banner a">${esc(n.label)}${closed(d) ? '' : ` <button class="btn small" data-los="${i}">Los ziehen</button>`}</div>`).join('');
  }
  function bindNotes(el, d, again) {
    el.querySelectorAll('[data-los]').forEach(b => { b.onclick = async () => {
      const n = d.notes[+b.dataset.los], names = n.teams.map(id => (d.teams.find(t => t.id === id) || {}).name).join(', ');
      if (!await GK.ask(`Los ziehen?\n\nGleichstand bei ${names}. Clubwerk lost die Reihenfolge aus; das steht im Protokoll.`, { ok: 'Los ziehen', danger: false })) return;
      try { const r = await api(`/${d.ft.id}/los`, 'POST', { teams: n.teams }); toast(`Gelost: ${r.order.map((x, k) => `${k + 1}. ${x}`).join(', ')}`); again(); } catch (e) { fail(e); }
    }; });
  }

  /* ---------- Zentrale: je Platz laufendes und nächstes Spiel, Warteschlange ---------- */
  const slot = (title, m, extra = '') => `<div class="ft-slot"><small>${esc(title)}${extra ? `<span>${extra}</span>` : ''}</small>
    <div class="ft-names" data-m="${m.id}"><b>${nm(m, 'a')}</b><b>${nm(m, 'b')}</b><span class="ft-meta">${esc(m.label)}</span></div>`;
  function showCentral(el, d, again) {
    const ft = d.ft, c = d.cfg;
    if (!ft.drawn) {
      el.innerHTML = `<div class="card"><p class="empty">Noch nicht ausgelost. Erst unter „${esc(teamWord(d, 2))}“ alle eintragen, dann unter „Spielplan“ auslosen – danach stehen hier die ${esc(courtWord(c, 2))} mit den laufenden und nächsten Spielen.</p></div>`;
      return;
    }
    const C = d.central, all = d.matches, done = all.filter(m => m.done).length, run = all.filter(m => m.running).length;
    const late = Math.max(0, ...all.filter(m => !m.done).map(m => m.delay));
    el.innerHTML = `${closed(d) ? '<div class="banner">Das Turnier ist beendet. Wieder öffnen unter „Einstellungen“.</div>' : ''}${notesHtml(d)}
      <div class="kpis"><div class="kpi"><div class="l">Laufend</div><div class="v">${run}</div></div><div class="kpi"><div class="l">Gespielt</div><div class="v">${done}<small style="font-size:.5em;color:var(--muted)"> / ${all.length}</small></div></div>
        <div class="kpi"><div class="l">Größter Verzug</div><div class="v">${late} min</div></div><div class="kpi"><div class="l">Ende etwa</div><div class="v">${esc(d.end || '–')}</div></div></div>
      <div class="ft-courts" id="ftCentral">${C.courts.map(x => `<div class="card"><h3><span>${esc(x.name)}</span>${x.later ? `<span class="pill">+${x.later} danach</span>` : ''}</h3>
        ${x.running ? slot('Läuft', x.running, `noch <span class="ft-num" data-left="${x.running.left}"></span>`) + (closed(d) ? '' : `<div class="btns"><button class="btn small primary" data-res="${x.running.id}">Ergebnis</button></div>`) + '</div>' : `<div class="ft-slot"><small>Läuft</small><span class="ft-meta">frei</span></div>`}
        ${x.next ? slot('Als Nächstes', x.next, `<span class="ft-num">${esc(x.next.est || '–')}</span> ${delay(x.next)}`) + `<span class="ft-meta">${x.next.wait ? esc(x.next.wait) : 'bereit'}</span>${!closed(d) && !x.running && !x.next.wait ? `<div class="btns"><button class="btn small" data-go="${x.next.id}">Starten</button></div>` : ''}</div>` : '<div class="ft-slot"><small>Als Nächstes</small><span class="ft-meta">nichts mehr geplant</span></div>'}
      </div>`).join('')}</div>
      ${C.queue.length ? `<h2 class="sec">Warteschlange</h2><div class="card"><table class="tbl sel kompakt"><tr><th>Spiel</th><th>Runde</th><th>Status</th><th></th></tr>${C.queue.map(m => `<tr data-m="${m.id}"><td class="k-1z"><b>${pair(m)}</b></td><td>${esc(m.label)}</td>
        <td>${m.wait ? `<span class="pill a">${esc(m.wait)}</span>` : '<span class="pill g">bereit</span>'}</td><td class="r"><span class="acts"><button class="btn ico" data-m2="${m.id}" title="Platz zuweisen" aria-label="Platz zuweisen">${EDIT}</button></span></td></tr>`).join('')}</table></div>` : ''}`;
    GK.tabTools(closed(d) ? '' : '<button class="btn" id="ftUp">Nachrücken</button><button class="btn primary" id="ftGo">Nächste Spiele starten</button>', el);
    ticker(el);
    bindNotes(el, d, again);
    el.querySelectorAll('[data-m],[data-m2]').forEach(x => { x.onclick = e => { e.stopPropagation(); matchDialog(d, findM(d, x.dataset.m || x.dataset.m2), again); }; });
    el.querySelectorAll('[data-res]').forEach(b => { b.onclick = () => resultDialog(d, findM(d, b.dataset.res), again); });
    el.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => GK.busy(b, async () => { try { await api(`/spiel/${b.dataset.go}/start`, 'POST', {}); toast('Gestartet.'); again(); } catch (e) { fail(e); } }); });
    if ($('ftGo')) $('ftGo').onclick = () => GK.busy($('ftGo'), async () => { try { const r = await api(`/${ft.id}/starten`, 'POST', {}); toast(r.started.length ? `Gestartet: ${r.started.length} ${r.started.length === 1 ? 'Spiel' : 'Spiele'}.` : 'Kein bereites Spiel auf einem freien Platz.', !r.started.length); again(); } catch (e) { fail(e); } });
    if ($('ftUp')) $('ftUp').onclick = () => GK.busy($('ftUp'), async () => { try { const r = await api(`/${ft.id}/nachruecken`, 'POST', {}); toast(r.moved.length ? `Nachgerückt: ${r.moved.join('; ')}` : 'Kein Platz frei oder kein Spiel bereit.', !r.moved.length); again(); } catch (e) { fail(e); } });
  }

  /* ---------- Spiel: verlegen, starten, Ergebnis ---------- */
  function matchDialog(d, m, again) {
    const fixed = m.done || m.running || closed(d);
    const courts = d.courts.map(x => `<option value="${x.id}" ${x.id === m.court_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    GK.dialog(`<h2>${pair(m)}</h2><p class="muted" style="margin-top:-4px">${esc(m.label)}${m.plan_time ? ` · Spielplan ${esc(m.plan_time)} Uhr` : ''}</p>
      ${m.done ? `<div class="card" style="margin:0 0 12px">${V().ftScore(m)}</div>` : m.running ? `<p>Läuft seit <span class="ft-num">${m.minutes}</span> Minuten auf ${esc(m.court)}.</p>` : `<p>${m.est ? `Voraussichtlich <span class="ft-num">${esc(m.est)}</span> Uhr ${delay(m)}` : 'Wartet auf einen Platz.'}${m.wait ? ` · <span class="muted">${esc(m.wait)}</span>` : ' · bereit'}</p>`}
      ${fixed ? '' : `<div class="frm"><label class="f">Platz<select id="fmC"><option value="">Warteschlange (ohne Platz)</option>${courts}</select></label><label class="f">Uhrzeit<input id="fmT" type="time" value="${esc(m.time || '')}"></label></div>`}
      <div class="btns">
        ${!closed(d) && m.running ? '<button class="btn" id="fmStop">Start zurücknehmen</button>' : ''}
        ${!closed(d) && !m.done && !m.running && m.a && m.b && m.court_id ? '<button class="btn" id="fmGo">Starten</button>' : ''}
        ${!closed(d) && m.a && m.b && !m.bye ? `<button class="btn" id="fmR">${m.done ? 'Ergebnis ändern …' : 'Ergebnis …'}</button>` : ''}
        <button class="btn ghost" id="fmX">Schließen</button>${fixed ? '' : '<button class="btn primary" id="fmOk">Speichern</button>'}</div>`, true);
    $('fmX').onclick = GK.closeDialog;
    const after = msg => { GK.closeDialog(); toast(msg); again(); };
    if ($('fmOk')) $('fmOk').onclick = () => GK.busy($('fmOk'), async () => { try { await api('/spiel/' + m.id, 'PUT', { court_id: $('fmC').value ? +$('fmC').value : null, time: $('fmT').value || null }); after('Verlegt.'); } catch (e) { fail(e); } });
    if ($('fmGo')) $('fmGo').onclick = () => GK.busy($('fmGo'), async () => { try { await api(`/spiel/${m.id}/start`, 'POST', {}); after('Gestartet.'); } catch (e) { fail(e); } });
    if ($('fmStop')) $('fmStop').onclick = async () => { if (!await GK.ask('Start zurücknehmen?\n\nDas Spiel gilt dann wieder als nicht begonnen.', { ok: 'Zurücknehmen' })) return; try { await api(`/spiel/${m.id}/stopp`, 'POST', {}); after('Zurückgenommen.'); } catch (e) { fail(e); } };
    if ($('fmR')) $('fmR').onclick = () => resultDialog(d, m, again);
  }
  function resultDialog(d, m, again) {
    const c = d.cfg, sets = c.scoring === 'saetze', dec = m.ko && !sets && c.decider !== 'none';
    const short = s => String(m[s] || '').split(' / ')[0];
    const val = (x, k) => (x == null ? '' : x[k] ?? '');
    const body = sets ? `<div class="frm"><label class="f">Wertung<select id="frK">${[['normal', 'Gespielt'], ['wo', 'Kampflos (w. o.)'], ['aufgabe', 'Aufgabe']].map(([k, l]) => `<option value="${k}" ${k === (m.result || 'normal') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f" id="frWL">Gewinnt kampflos<select id="frW"><option value="a" translate="no">${esc(m.a)}</option><option value="b" translate="no" ${m.winner === 'b' ? 'selected' : ''}>${esc(m.b)}</option></select></label>
        <label class="f" id="frRL">Hat aufgegeben<select id="frRt"><option value="a" translate="no">${esc(m.a)}</option><option value="b" translate="no" ${m.retired !== 'a' ? 'selected' : ''}>${esc(m.b)}</option></select></label></div>
      <div class="ft-score" id="frS"><span></span><span class="h" translate="no">${esc(short('a'))}</span><span></span><span class="h" translate="no">${esc(short('b'))}</span>
        ${['Satz 1', 'Satz 2', 'Match-Tiebreak'].map((l, i) => `<b>${esc(l)}</b><input inputmode="numeric" id="frA${i}" value="${m.sets[i] ? m.sets[i][0] : ''}" aria-label="${esc(l)}: ${esc(m.a)}"><span class="c">:</span><input inputmode="numeric" id="frB${i}" value="${m.sets[i] ? m.sets[i][1] : ''}" aria-label="${esc(l)}: ${esc(m.b)}">`).join('')}</div>`
      : `<div class="ft-score"><span></span><span class="h" translate="no">${esc(short('a'))}</span><span></span><span class="h" translate="no">${esc(short('b'))}</span>
        <b>${esc(d.unit)}</b><input inputmode="numeric" id="frA" value="${esc(val(m, 'score_a'))}" aria-label="${esc(d.unit)}: ${esc(m.a)}"><span class="c">:</span><input inputmode="numeric" id="frB" value="${esc(val(m, 'score_b'))}" aria-label="${esc(d.unit)}: ${esc(m.b)}">
        ${dec ? `<b>${c.decider === 'nm' ? 'Neunmeter' : 'Tiebreak'}</b><input inputmode="numeric" id="frDA" value="${esc(val(m.decider, 'a'))}" aria-label="${c.decider === 'nm' ? 'Neunmeter' : 'Tiebreak'}: ${esc(m.a)}"><span class="c">:</span><input inputmode="numeric" id="frDB" value="${esc(val(m.decider, 'b'))}" aria-label="${c.decider === 'nm' ? 'Neunmeter' : 'Tiebreak'}: ${esc(m.b)}">` : ''}</div>
        ${dec ? `<p class="muted s" style="margin:8px 0 0">${c.decider === 'nm' ? 'Neunmeterschießen nur bei Gleichstand – ohne Verlängerung. Zählt nicht für Tabellen.' : 'Tiebreak bis 7 (2 Punkte Abstand) nur bei Gleichstand.'}</p>` : m.ko ? '' : '<p class="muted s" style="margin:8px 0 0">Unentschieden ist möglich.</p>'}`;
    GK.dialog(`<h2>${pair(m)}</h2><p class="muted" style="margin-top:-4px">${esc(m.label)}${m.court ? ` · ${esc(m.court)}` : ''}${m.entered_by ? ` · eingetragen von <span translate="no">${esc(m.entered_by)}</span>` : ''}</p>${body}
      <div class="btns"><button class="btn ghost" id="frX">Abbrechen</button><button class="btn primary" id="frOk">Speichern</button></div>
      ${m.done ? '<div class="btns" style="margin-top:8px;border-top:1px solid var(--line);padding-top:12px"><button class="btn danger" id="frDel">Ergebnis löschen</button></div>' : ''}`, true);
    if (sets) { const show = (id, on) => { $(id).style.display = on ? '' : 'none'; }; const sync = () => { const k = $('frK').value; show('frWL', k === 'wo'); show('frRL', k === 'aufgabe'); show('frS', k !== 'wo'); }; sync(); $('frK').onchange = sync; }
    setTimeout(() => { const f = $(sets ? 'frA0' : 'frA'); if (f) f.focus(); }, 50);
    $('frX').onclick = GK.closeDialog;
    const save = b => GK.busy($('frOk'), async () => {
      try { const r = await api(`/spiel/${m.id}/ergebnis`, 'POST', b); GK.closeDialog(); toast((r.warnings || []).length ? r.warnings.join(' ') : 'Gespeichert.', Boolean((r.warnings || []).length)); again(); } catch (e) { fail(e); }
    });
    $('frOk').onclick = () => {
      if (sets) {
        const k = $('frK').value, b = { result: k };
        if (k === 'wo') b.winner = $('frW').value; else b.sets = [0, 1, 2].map(i => [$('frA' + i).value.trim(), $('frB' + i).value.trim()]).filter(x => x[0] !== '' || x[1] !== '');
        if (k === 'aufgabe') b.retired = $('frRt').value;
        return save(b);
      }
      save({ a: $('frA').value.trim(), b: $('frB').value.trim(), ...(dec ? { decider: { a: $('frDA').value.trim(), b: $('frDB').value.trim() } } : {}) });
    };
    if ($('frDel')) $('frDel').onclick = async () => { if (await GK.ask('Ergebnis löschen?\n\nDas Spiel ist danach wieder offen.')) save({ clear: true }); };
  }

  /* ---------- Spielplan: Auslosung bzw. alle Spiele nach Uhrzeit ---------- */
  function showPlan(el, d, again) {
    const ft = d.ft, c = d.cfg;
    if (!ft.drawn) {
      const seeds = d.teams.filter(t => t.seed).length, p = d.preview;
      el.innerHTML = `<div class="card"><h3>Auslosung</h3>
        <p class="muted s" style="margin-top:0">${ft.format === 'gruppen' ? 'Die Gruppen entstehen aus der Zahl der Mannschaften und der Gruppengröße – bei ungleichen Zahlen gemischt (z. B. Vierer- und Dreiergruppen), nie mit „Platz frei“. Danach lassen sich zwei Mannschaften von Hand tauschen.'
          : ft.format === 'ko' ? 'Gesetzte treffen spät aufeinander; fehlen Gegner, bekommen die Besten ein Freilos.' : ft.format === 'schleifchen' ? 'Je Runde neue Doppelpartner, so dass sich Partner nicht wiederholen, solange es geht. Gezählt werden die gewonnenen Spiele je Person.' : 'Jede Mannschaft spielt einmal gegen jede.'}</p>
        <p>${d.teams.length ? previewText(p, ft.format, st.meta.sports[ft.sport]) : `Noch keine ${esc(teamWord(d, 2))} – erst unter „${esc(teamWord(d, 2))}“ eintragen.`}</p>
        ${ft.format === 'gruppen' || ft.format === 'ko' ? `<label class="chk"><input type="checkbox" id="fpSeed" ${seeds ? 'checked' : 'disabled'}> Mit Setzliste (${seeds ? `${seeds} gesetzt` : 'niemand gesetzt'})${ft.format === 'gruppen' ? ' – je Gruppe ein Gesetzter' : ''}</label>` : ''}
        <div class="btns"><button class="btn primary" id="fpDraw" ${d.teams.length ? '' : 'disabled'}>Auslosen</button></div></div>`;
      $('fpDraw').onclick = () => GK.busy($('fpDraw'), async () => {
        try { const r = await api(`/${ft.id}/auslosen`, 'POST', { seeded: Boolean($('fpSeed') && $('fpSeed').checked) }); toast(`Ausgelost – Ende etwa ${r.end.slice(11, 16)} Uhr.`); again(); } catch (e) { fail(e); }
      });
      return;
    }
    const F = { alle: () => true, offen: m => !m.done, gespielt: m => m.done };
    if (!F[st.mf]) st.mf = 'alle';
    const list = d.matches.filter(F[st.mf]);
    const any = d.matches.some(m => m.done || m.running);
    el.innerHTML = `<div class="chips" role="group" aria-label="Filter">${[['alle', 'Alle'], ['offen', 'Offen'], ['gespielt', 'Gespielt']].map(([k, l]) => `<button type="button" data-f="${k}" class="${st.mf === k ? 'on' : ''}" aria-pressed="${st.mf === k}">${l}<span class="cnt">${d.matches.filter(F[k]).length}</span></button>`).join('')}</div>
      <div class="card">${list.length ? `<table class="tbl sel kompakt" id="fpTbl"><tr><th>Zeit</th><th>${esc(c.court)}</th><th>Runde</th><th>Spiel</th><th>Ergebnis</th></tr>${list.map(m => `<tr data-m="${m.id}"><td><span class="ft-num">${esc(m.done ? m.time || '–' : m.est || m.time || '–')}</span>${m.done ? '' : ' ' + delay(m)}</td>
        <td class="k-weg">${esc(m.court || 'Warteschlange')}</td><td class="k-weg">${esc(m.label)}</td><td class="k-1z"><b>${pair(m)}</b></td><td>${m.done ? `<span class="ft-num">${esc(m.score)}</span>` : m.running ? '<span class="pill g">läuft</span>' : '<span class="pill">offen</span>'}</td></tr>`).join('')}</table>`
        : '<p class="empty">In dieser Auswahl ist kein Spiel.</p>'}</div>
      <p class="muted s">${esc(c.minutes)} Minuten Spielzeit, ${esc(c.pause)} Minuten Pause${ft.format === 'gruppen' ? `, ${esc(c.break_groups)} Minuten nach der Vorrunde, ${esc(c.break_ko)} Minuten zwischen den K.-o.-Runden` : ''}. Niemand spielt zweimal hintereinander. Läuft ein Spiel länger, rutschen die folgenden nach hinten.</p>`;
    const btns = [];
    if (!closed(d)) {
      if (ft.format === 'gruppen' && !any) btns.push('<button class="btn" id="fpSwap">Tauschen …</button>');
      if (!any) btns.push('<button class="btn" id="fpRe">Neu auslosen …</button>', '<button class="btn" id="fpNew">Zeitplan neu berechnen</button>');
      else btns.push('<button class="btn" id="fpOrig">Ursprünglicher Spielplan …</button>');
    }
    btns.push('<button class="btn" id="fpPrint">Drucken</button>');
    GK.tabTools(btns.join(''), el);
    el.querySelectorAll('[data-f]').forEach(b => { b.onclick = () => { st.mf = b.dataset.f; sessionStorage.setItem('ft_mf', st.mf); showPlan(el, d, again); }; });
    el.querySelectorAll('[data-m]').forEach(x => { x.onclick = () => matchDialog(d, findM(d, x.dataset.m), again); });
    $('fpPrint').onclick = () => GK.printHtml(`<div class="pr"><h2 style="margin:0 0 4mm;font-size:14pt" translate="no">${esc(ft.name)} – Spielplan</h2><p>${esc(dayTxt(ft.date))}</p><table class="tbl"><tr><th>Zeit</th><th>${esc(c.court)}</th><th>Runde</th><th>Spiel</th><th>Ergebnis</th></tr>${d.matches.map(m => `<tr><td>${esc(m.plan_time || m.time || '')}</td><td>${esc(m.court || '')}</td><td>${esc(m.label)}</td><td translate="no">${esc(m.a || m.a_ph || '')} – ${esc(m.b || m.b_ph || '')}</td><td>${esc(m.score || '')}</td></tr>`).join('')}</table></div>`);
    if ($('fpNew')) $('fpNew').onclick = () => GK.busy($('fpNew'), async () => { try { const r = await api(`/${ft.id}/zeitplan`, 'POST', {}); toast(`Neu berechnet – Ende etwa ${r.end.slice(11, 16)} Uhr.`); again(); } catch (e) { fail(e); } });
    if ($('fpRe')) $('fpRe').onclick = async () => {
      if (!await GK.ask('Neu auslosen?\n\nGruppen, Paarungen und Zeitplan entstehen neu. Danach lassen sich auch Mannschaften nachtragen: „Auslosung aufheben“.', { ok: 'Neu auslosen', danger: false, title: 'Neu auslosen?' })) return;
      try { await api(`/${ft.id}/auslosen`, 'POST', { seeded: d.teams.some(t => t.seed) }); toast('Neu ausgelost.'); again(); } catch (e) { fail(e); }
    };
    if ($('fpOrig')) $('fpOrig').onclick = async () => {
      if (!await GK.ask('Ursprünglichen Spielplan wiederherstellen?\n\nAlle Spiele, die noch nicht begonnen haben, kommen zurück auf Platz und Uhrzeit aus der Auslosung.', { ok: 'Wiederherstellen' })) return;
      try { const r = await api(`/${ft.id}/ursprung`, 'POST', {}); toast(`${r.n} ${r.n === 1 ? 'Spiel' : 'Spiele'} zurückgesetzt.`); again(); } catch (e) { fail(e); }
    };
    if ($('fpSwap')) $('fpSwap').onclick = () => swapDialog(d, again);
  }
  function swapDialog(d, again) {
    const opts = d.teams.filter(t => t.group).sort((x, y) => x.group.localeCompare(y.group) || x.name.localeCompare(y.name, 'de')).map(t => `<option value="${t.id}" translate="no">${esc(t.group)}: ${esc(t.name)}</option>`).join('');
    GK.dialog(`<h2>Mannschaften tauschen</h2><p class="muted">Zwei Mannschaften aus verschiedenen Gruppen wechseln die Gruppe – Spielfelder und Uhrzeiten bleiben. Geht, solange in beiden Gruppen noch nichts gespielt ist.</p>
      <div class="frm"><label class="f">Mannschaft<select id="fsA">${opts}</select></label><label class="f">tauscht mit<select id="fsB">${opts}</select></label></div>
      <div class="btns"><button class="btn ghost" id="fsX">Abbrechen</button><button class="btn primary" id="fsOk">Tauschen</button></div>`);
    $('fsX').onclick = GK.closeDialog;
    $('fsOk').onclick = () => GK.busy($('fsOk'), async () => { try { await api(`/${d.ft.id}/tausch`, 'POST', { a: +$('fsA').value, b: +$('fsB').value }); GK.closeDialog(); toast('Getauscht.'); again(); } catch (e) { fail(e); } });
  }

  /* ---------- Tabellen und Turnierbaum ---------- */
  function showTables(el, d, again) {
    const ft = d.ft;
    if (!ft.drawn) { el.innerHTML = '<div class="card"><p class="empty">Noch nicht ausgelost – die Tabellen erscheinen nach der Auslosung unter „Spielplan“.</p></div>'; return; }
    const pod = ft.finished_at && ft.podium.length ? `<div class="card"><h3>Sieger</h3>${V().ftPodium(ft.podium)}</div>` : '';
    const groups = d.groups.length ? `${d.groups.length > 1 ? '<h2 class="sec">Gruppen</h2>' : ''}<div class="ft-groups">${d.groups.map(g => `<div class="card"><h3>${esc(d.groups.length > 1 ? g.label : 'Tabelle')}</h3>${V().ftTable(g, { unit: d.unit, up: g.up })}</div>`).join('')}</div>` : '';
    const ko = d.ko.length ? `<h2 class="sec">${ft.format === 'ko' ? 'Turnierbaum' : 'Endrunde'}</h2><div class="card">${V().ftTree(d.ko, d.third, { attr: m => (m.bye ? '' : `data-m="${m.id}" style="cursor:pointer"`) })}</div>` : '';
    const rank = d.ranking ? `<div class="card"><h3>Rangliste</h3>${V().ftRanking(d.ranking, d.unit)}<p class="muted s" style="margin:10px 0 0">Gezählt werden die gewonnenen Spiele je Person, bei Gleichstand die Siege, dann das Los.</p></div>` : '';
    el.innerHTML = notesHtml(d) + pod + rank + groups + ko;
    GK.tabTools('<button class="btn" id="ftPrint">Drucken</button>', el);
    bindNotes(el, d, again);
    el.querySelectorAll('[data-m]').forEach(x => { x.onclick = () => matchDialog(d, findM(d, x.dataset.m), again); });
    $('ftPrint').onclick = () => GK.printHtml(`<div class="pr"><h2 style="margin:0 0 4mm;font-size:14pt" translate="no">${esc(ft.name)}</h2>${pod + rank + groups + ko}</div>`);
  }

  /* ---------- Mannschaften: anlegen, importieren, Setzliste, Startgeld ---------- */
  function showTeams(el, d, again) {
    const ft = d.ft, c = d.cfg, k = d.kasse, solo = ft.format === 'schleifchen';
    const list = [...d.teams].sort((x, y) => (x.group || '').localeCompare(y.group || '') || x.name.localeCompare(y.name, 'de'));
    el.innerHTML = `${c.fee ? `<div class="kpis"><div class="kpi"><div class="l">Startgeld gesamt</div><div class="v">${GK.euro(k.total)}</div></div><div class="kpi"><div class="l">Bar</div><div class="v">${GK.euro(k.bar)}</div></div>
        <div class="kpi"><div class="l">Digital</div><div class="v">${GK.euro(k.digital)}</div></div><div class="kpi"><div class="l">Offen</div><div class="v">${GK.euro(k.open)}</div></div></div>` : ''}
      <div class="card">${list.length ? `<table class="tbl sel kompakt"><tr><th>${solo ? 'Name' : 'Mannschaft'}</th>${solo ? '' : '<th>Spieler</th>'}<th>${ft.drawn && ft.format === 'gruppen' ? 'Gruppe' : 'Setzliste'}</th><th>Status</th><th></th></tr>
        ${list.map(t => `<tr data-t="${t.id}"><td class="k-1z"><b translate="no">${esc(t.name)}</b></td>${solo ? '' : `<td class="k-weg" translate="no">${esc(t.players.join(', ') || '–')}</td>`}
          <td class="k-lbl" data-label="${ft.drawn && ft.format === 'gruppen' ? 'Gruppe' : 'Setzliste'}">${ft.drawn && ft.format === 'gruppen' ? esc(t.group || '–') : t.seed ? `<span class="ft-num">${t.seed}</span>` : '–'}</td>
          <td>${t.checked_in ? '<span class="pill g">da</span>' : '<span class="pill">offen</span>'} ${c.fee ? (t.paid ? `<span class="pill g">${esc(t.paid)}</span>` : `<span class="pill a">${GK.euro(t.fee)} offen</span>`) : ''}</td>
          <td class="r"><span class="acts"><button class="btn ico" data-t2="${t.id}" title="Bearbeiten" aria-label="Bearbeiten">${EDIT}</button></span></td></tr>`).join('')}</table>`
        : `<p class="empty">Noch ${solo ? 'niemand eingetragen' : 'keine Mannschaft'}. Mit „+ ${solo ? 'Teilnehmer' : 'Mannschaft'}“ einzeln eintragen oder eine Excel- oder CSV-Datei importieren – eine Spalte mit Namen genügt.</p>`}</div>
      ${ft.drawn && !closed(d) ? `<p class="muted s">Ausgelost – ${solo ? 'Teilnehmer' : 'Mannschaften'} lassen sich nur noch umbenennen. Nachtragen geht nach „Auslosung aufheben“ (Einstellungen), solange noch kein Ergebnis steht.</p>` : ''}`;
    const tools = [];
    if (!ft.drawn && !closed(d)) tools.push('<button class="btn" id="ftImp">Import …</button>');
    if (d.teams.length) tools.push('<button class="btn" id="ftQrAll">QR-Codes drucken</button>');
    if (!ft.drawn && !closed(d)) tools.push(`<button class="btn primary" id="ftAdd">+ ${solo ? 'Teilnehmer' : 'Mannschaft'}</button>`);
    GK.tabTools(tools.join(''), el);
    el.querySelectorAll('[data-t],[data-t2]').forEach(x => { x.onclick = e => { e.stopPropagation(); teamDialog(d, d.teams.find(t => t.id === +(x.dataset.t || x.dataset.t2)), again); }; });
    if ($('ftAdd')) $('ftAdd').onclick = () => teamDialog(d, null, again);
    if ($('ftImp')) $('ftImp').onclick = () => importDialog(d, again);
    if ($('ftQrAll')) $('ftQrAll').onclick = () => GK.busy($('ftQrAll'), async () => {
      let r; try { r = await api(`/${ft.id}/qr?alle=1`); } catch (e) { return fail(e); }
      if (!r.url) return toast('Für die Links fehlt die Adresse der Mitglieder-App (Mitglieder-App › Verbindung).', true);
      GK.printHtml(`<div class="pr"><h2 style="margin:0 0 4mm;font-size:14pt" translate="no">${esc(ft.name)} – eure Spiele aufs Handy</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6mm">${r.list.map(x => `<div style="break-inside:avoid;text-align:center;border:1px solid #999;border-radius:3mm;padding:3mm"><div style="width:40mm;margin:0 auto">${x.svg}</div><b translate="no">${esc(x.name)}</b></div>`).join('')}</div></div>`);
    });
  }
  function teamDialog(d, t, again) {
    const ft = d.ft, c = d.cfg, solo = ft.format === 'schleifchen', lock = ft.drawn || closed(d);
    GK.dialog(`<h2>${t ? `<span translate="no">${esc(t.name)}</span>` : solo ? 'Teilnehmer eintragen' : 'Mannschaft eintragen'}</h2>
      <div class="frm"><label class="f ${solo || ft.format === 'liga' ? 'wall' : 'w3'}">Name<input id="ftN" maxlength="60" value="${esc(t ? t.name : '')}" placeholder="${solo ? 'z. B. Anna Beispiel' : 'z. B. Die Ballkünstler'}" ${closed(d) ? 'disabled' : ''}></label>
        ${solo || ft.format === 'liga' ? '' : `<label class="f w1">Setzliste<input id="ftSd" type="number" inputmode="numeric" min="1" max="64" value="${t && t.seed ? t.seed : ''}" placeholder="–" ${lock ? 'disabled' : ''}></label>`}
        ${solo ? '' : `<label class="f wall">Spieler (freiwillig, je Zeile einer – auch Gäste)<textarea id="ftP" rows="4" ${closed(d) ? 'disabled' : ''}>${esc(t ? t.players.join('\n') : '')}</textarea></label>`}</div>
      ${t && !closed(d) ? `<div class="btns" style="justify-content:flex-start">${t.checked_in ? '<button class="btn" id="ftOut">Nicht mehr da</button>' : '<button class="btn" id="ftIn">Ist da</button>'}
        ${c.fee ? (t.paid ? '<button class="btn" id="ftUnpay">Zahlung zurücknehmen</button>' : `<button class="btn" id="ftBar">${GK.euro(c.fee)} bar</button><button class="btn" id="ftDig">${GK.euro(c.fee)} digital</button>`) : ''}
        <button class="btn" id="ftQr">QR-Code</button></div><div id="ftQrBox" class="ft-qr"></div>` : ''}
      <div class="btns"><button class="btn ghost" id="ftX">${closed(d) ? 'Schließen' : 'Abbrechen'}</button>${closed(d) ? '' : '<button class="btn primary" id="ftOk">Speichern</button>'}</div>
      ${t && !lock ? '<div class="btns" style="margin-top:8px;border-top:1px solid var(--line);padding-top:12px"><button class="btn danger" id="ftDel">Entfernen</button></div>' : ''}`, true);
    $('ftX').onclick = GK.closeDialog;
    setTimeout(() => { if (!t && $('ftN')) $('ftN').focus(); }, 50);
    const body = () => ({ name: $('ftN').value, players: $('ftP') ? $('ftP').value.split('\n') : [], seed: $('ftSd') ? $('ftSd').value : '' });
    if ($('ftOk')) $('ftOk').onclick = () => GK.busy($('ftOk'), async () => {
      try {
        if (t) await api('/team/' + t.id, 'PUT', body()); else await api(`/${ft.id}/team`, 'POST', body());
        GK.closeDialog(); toast('Gespeichert.'); again();
        if (!t) setTimeout(() => teamDialog(d, null, again), 350);   // gleich die nächste eintragen
      } catch (e) { fail(e); }
    });
    if ($('ftDel')) $('ftDel').onclick = async () => { if (!await GK.ask(`„${t.name}“ entfernen?`, { ok: 'Entfernen', danger: true })) return; try { await api('/team/' + t.id, 'DELETE'); GK.closeDialog(); toast('Entfernt.'); again(); } catch (e) { fail(e); } };
    const act = (id, b, msg) => { if ($(id)) $(id).onclick = () => GK.busy($(id), async () => { try { await api(`/team/${t.id}/checkin`, 'POST', b); GK.closeDialog(); toast(msg); again(); } catch (e) { fail(e); } }); };
    act('ftIn', { checkin: true }, 'Ist da.'); act('ftOut', { checkin: false }, 'Zurückgenommen.');
    act('ftBar', { paid: 'bar', checkin: true }, 'Bar bezahlt.'); act('ftDig', { paid: 'digital', checkin: true }, 'Digital bezahlt.'); act('ftUnpay', { paid: null }, 'Zahlung zurückgenommen.');
    if ($('ftQr')) $('ftQr').onclick = () => GK.busy($('ftQr'), async () => {
      let r; try { r = await api(`/${ft.id}/qr?team=${t.id}`); } catch (e) { return fail(e); }
      $('ftQrBox').innerHTML = r.url ? `${r.svg}<span class="muted s" style="text-align:center">Mit dem Handy scannen: die eigenen Spiele, Tabelle und Endrunde – nur ansehen.</span>` : '<p class="muted">Für den Link fehlt die Adresse der Mitglieder-App (Mitglieder-App › Verbindung).</p>';
    });
  }
  function importDialog(d, again) {
    GK.dialog(`<h2>Mannschaften importieren</h2><p class="muted">Excel (.xlsx) oder CSV. Eine Spalte mit den Namen genügt (Kopfzeile „Name“ oder „Mannschaft“, sonst die erste Spalte); weitere Spalten werden als Spieler übernommen.</p>
      <label class="f">Datei<input type="file" id="fiF" accept=".xlsx,.csv,.txt"></label><div id="fiR"></div>
      <div class="btns"><button class="btn ghost" id="fiX">Abbrechen</button><button class="btn primary" id="fiOk" disabled>Übernehmen</button></div>`, true);
    $('fiX').onclick = GK.closeDialog;
    let rows = [];
    $('fiF').onchange = async () => {
      const f = $('fiF').files[0]; if (!f) return;
      const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = no; r.readAsDataURL(f); });
      let p; try { p = await api(`/${d.ft.id}/import`, 'POST', { name: f.name, file: data }); } catch (e) { $('fiR').innerHTML = ''; $('fiOk').disabled = true; return fail(e); }
      rows = p.rows.filter(r => !r.dup);
      $('fiR').innerHTML = `<p style="margin:12px 0 6px">${rows.length} neue ${rows.length === 1 ? 'Mannschaft' : 'Mannschaften'}${p.rows.length > rows.length ? ` · ${p.rows.length - rows.length} schon vorhanden` : ''}:</p>
        <ul style="margin:0;padding-left:20px;line-height:1.5;max-height:240px;overflow:auto">${p.rows.map(r => `<li translate="no">${esc(r.name)}${r.players.length ? ` <span class="muted s">(${esc(r.players.join(', '))})</span>` : ''}${r.dup ? ' <span class="pill">schon da</span>' : ''}</li>`).join('')}</ul>`;
      $('fiOk').disabled = !rows.length;
    };
    $('fiOk').onclick = () => GK.busy($('fiOk'), async () => { try { const r = await api(`/${d.ft.id}/import`, 'POST', { rows }); GK.closeDialog(); toast(`${r.n} übernommen.`); again(); } catch (e) { fail(e); } });
  }

  /* ---------- Einstellungen ---------- */
  const ORDER_WORDS = { punkte: 'Punkte', diff: 'Differenz (Tore bzw. Spiele)', mehr: 'Mehr Tore bzw. Spiele', direkt: 'Direkter Vergleich', los: 'Los' };
  async function showSettings(el, d, again) {
    const ft = d.ft, c = d.cfg, off = closed(d), drawn = ft.drawn, sp = st.meta.sports[ft.sport];
    const res = d.booking ? await api('-buchungsplaetze').catch(() => []) : [];
    let order = [...c.order];
    const n = (id, v, min, max, lab, cls = 'w1', dis = false) => `<label class="f ${cls}">${lab}<input id="${id}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${esc(v)}" ${off || dis ? 'disabled' : ''}></label>`;
    const sel = (id, v, opts, lab, cls = 'w1', dis = false) => `<label class="f ${cls}">${lab}<select id="${id}" ${off || dis ? 'disabled' : ''}>${opts.map(([k, l]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
    el.innerHTML = `${off ? '<div class="banner">Das Turnier ist beendet – Änderungen erst nach „Wieder öffnen“ (unten).</div>' : ''}
      <div class="card" data-card="turnier"><h3>Turnier</h3><div class="frm">
        <label class="f wall">Name<input id="fsN" maxlength="80" value="${esc(ft.name)}" ${off ? 'disabled' : ''}></label>
        <label class="f w1">Tag<input id="fsD" type="date" value="${esc(ft.date)}" ${off ? 'disabled' : ''}></label><label class="f w1">Beginn<input id="fsT" type="time" value="${esc(ft.start)}" ${off ? 'disabled' : ''}></label>
        <label class="f w1">Spätestes Ende<input id="fsE" type="time" value="${esc(c.end_warn)}" ${off ? 'disabled' : ''}></label><label class="f w1">Startgeld je ${ft.format === 'schleifchen' ? 'Person' : 'Mannschaft'}<input id="fsFee" inputmode="decimal" value="${c.fee ? (c.fee / 100).toFixed(2).replace('.', ',') : ''}" placeholder="kein" ${off ? 'disabled' : ''}></label>
        ${sel('fsF', ft.format, Object.entries(st.meta.formats), 'Spielform', '', drawn)}<label class="f">Sportart<input value="${esc(sp.label)}" disabled></label></div>
        ${d.end && c.end_warn && d.end > c.end_warn ? `<div class="banner a" style="margin-top:12px">Voraussichtliches Ende ${esc(d.end)} Uhr liegt nach ${esc(c.end_warn)} Uhr.</div>` : ''}
        ${off ? '' : '<div class="btns"><button class="btn primary" data-save="1">Speichern</button></div>'}</div>
      <div class="card" data-card="spielzeit"><h3>Spielzeit und Wertung</h3><div class="frm">
        ${n('fsM', c.minutes, 5, 180, 'Spielzeit (Minuten)')}${n('fsP', c.pause, 0, 60, 'Pause (Minuten)')}
        ${ft.format === 'gruppen' || ft.format === 'ko' ? n('fsBG', ft.format === 'gruppen' ? c.break_groups : c.break_ko, 0, 120, ft.format === 'gruppen' ? 'Pause nach der Vorrunde' : 'Pause zwischen den Runden') : ''}${ft.format === 'gruppen' ? n('fsBK', c.break_ko, 0, 60, 'Pause zwischen den K.-o.-Runden') : ''}
        ${n('fsW', c.win, 0, 9, 'Punkte Sieg')}${n('fsDr', c.draw, 0, 9, 'Punkte Unentschieden')}${n('fsL', c.loss, 0, 9, 'Punkte Niederlage')}${sel('fsC', c.court, [['Platz', 'Platz'], ['Spielfeld', 'Spielfeld'], ['Feld', 'Feld']], 'Bezeichnung')}
        ${sel('fsS', c.scoring, [['zeit', 'Auf Zeit (Unentschieden möglich)'], ['saetze', 'Auf Sätze (2 Gewinnsätze, Match-Tiebreak)']], 'Wertung')}
        ${sel('fsK', c.decider, [['tb', 'Tiebreak bis 7'], ['nm', 'Neunmeterschießen'], ['none', 'Keine (kein Unentschieden)']], 'Gleichstand im K.-o.', '', c.scoring === 'saetze')}
        ${ft.format === 'gruppen' ? sel('fsG', c.group_size, [3, 4, 5, 6, 7, 8].map(x => [x, `${x} je Gruppe`]), 'Gruppengröße', 'w1', drawn) + sel('fsQ', c.qualify, [[2, 'Erster und Zweiter'], [1, 'Nur der Erste']], 'Weiter je Gruppe', 'w1', drawn) : ''}
        ${ft.format === 'schleifchen' ? sel('fsR', c.rounds, [2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(x => [x, `${x} Runden`]), 'Runden', 'w1', drawn) : ''}
        ${ft.format === 'gruppen' || ft.format === 'ko' ? `<label class="chk w2" style="align-self:center"><input type="checkbox" id="fs3" ${c.third ? 'checked' : ''} ${off || drawn ? 'disabled' : ''}> Spiel um Platz 3</label>` : ''}</div>
        ${ft.format === 'gruppen' || ft.format === 'liga' ? `<h4 style="margin:16px 0 6px">Reihenfolge bei Gleichstand</h4><div class="torows" id="fsO"></div>` : ''}
        <p class="muted s" style="margin:10px 0 0">Vorlage ${esc(sp.label)}: ${sp.win}-${sp.draw}-${sp.loss} Punkte, ${sp.minutes} Minuten Spielzeit, ${sp.pause} Minuten Pause, ${sp.decider === 'nm' ? 'Neunmeterschießen' : 'Tiebreak bis 7'} im K.-o.${drawn ? ' Ändert sich die Zeit, bevor gespielt wird, rechnet Clubwerk den Zeitplan neu.' : ''}</p>
        ${off ? '' : '<div class="btns"><button class="btn primary" data-save="2">Speichern</button></div>'}</div>
      <div class="card" data-card="plaetze"><h3>${esc(courtWord(c, 2))}</h3>
        ${d.courts.map(x => `<div class="frm"><label class="f ${d.booking ? '' : 'w3'}">Name<input data-cn="${x.id}" value="${esc(x.name)}" maxlength="40" ${off ? 'disabled' : ''}></label>
          ${d.booking ? `<label class="f w1">Platz im Buchungssystem<select data-res="${x.id}" ${off ? 'disabled' : ''}><option value="">– frei –</option>${res.map(r => `<option value="${r.id}" ${r.id === x.resource_id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>` : ''}
          <span class="w1 frm-acts">${!x.used && !off && d.courts.length > 1 ? `<button class="btn" data-cdel="${x.id}">Entfernen</button>` : ''}</span></div>`).join('')}
        <p class="muted s" style="margin:10px 0 0">${d.booking ? 'Mit Zuordnung lässt sich der Platz unten im Buchungssystem sperren; „frei“ sperrt nichts (z. B. eine Halle).' : 'Namen ändern sich sofort, auch im Spielplan und auf dem Monitor.'}</p>
        ${off ? '' : `<div class="btns"><button class="btn" id="fsCAdd">+ ${esc(c.court)}</button></div>`}</div>
      ${d.booking ? `<div class="card" data-card="sperre"><h3>Sperre im Buchungssystem</h3>
        <p>${ft.locked ? `Die zugeordneten Plätze sind am Turniertag von <span class="ft-num">${esc(ft.lock_from)}</span> bis <span class="ft-num">${esc(ft.lock_to)}</span> Uhr gesperrt.` : 'Noch nicht gesperrt. Gesperrt werden nur Plätze mit Zuordnung – Buchungen in der Zeit werden storniert, die Mitglieder bekommen Bescheid.'}</p>
        ${off ? '' : `<div class="frm"><label class="f w1">Von<input type="time" id="fsLf" value="${esc(ft.lock_from || d.lockSuggest.from)}"></label><label class="f w1">Bis<input type="time" id="fsLt" value="${esc(ft.lock_to && ft.lock_to !== '24:00' ? ft.lock_to : d.lockSuggest.to === '24:00' ? '23:59' : d.lockSuggest.to)}"></label></div>
        <div class="btns">${ft.locked ? '<button class="btn" id="fsUnlock">Sperre aufheben</button>' : ''}<button class="btn primary" id="fsLock">${ft.locked ? 'Sperre ändern …' : 'Plätze sperren …'}</button></div>`}</div>` : ''}
      <div class="card" data-card="monitor"><h3>Monitor zum Aufhängen</h3>
        <p class="muted s" style="margin-top:0">Im Browser des Fernsehers diese Adresse öffnen – ohne Anmeldung, nur lesend. Die Anzeige wechselt selbst zwischen laufenden Spielen, nächsten Spielen, Tabellen und Turnierbaum. Am Handy zeigt dieselbe Adresse alles untereinander.</p>
        ${d.monitor ? `<div class="row" style="align-items:center"><code id="fsMon" style="overflow-wrap:anywhere;flex:1 1 240px">${esc(d.monitor)}</code></div><div id="fsMonQr" class="ft-qr"></div>
          <div class="btns"><button class="btn" id="fsMonNew">Link erneuern …</button><button class="btn" id="fsMonQrB">QR-Code</button><button class="btn" id="fsMonCopy">Adresse kopieren</button></div>`
          : '<p class="muted">Für den Link fehlt die Adresse der Mitglieder-App (Mitglieder-App › Verbindung).</p>'}</div>
      <div class="card" data-card="code"><h3>Code der Turnierleitung</h3>
        <p class="muted s" style="margin-top:0">Ergebnisse trägt nur die Turnierleitung ein – hier in der Verwaltung oder am Tablet. Am Tablet fragt Clubwerk dafür diesen Code ab (4 bis 6 Ziffern). ${ft.code ? 'Ein Code ist festgelegt.' : 'Noch kein Code festgelegt – am Tablet geht dann nur Ansehen.'}</p>
        ${off ? '' : `<div class="frm"><label class="f w1">Neuer Code<input id="fsCode" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6"></label></div>
        <div class="btns">${ft.code ? '<button class="btn" id="fsCodeOff">Code entfernen</button>' : ''}<button class="btn primary" id="fsCodeOk">Code festlegen</button></div>`}</div>
      <div class="card" data-card="abschluss"><h3>Abschluss</h3>
        <p class="muted s" style="margin-top:0">${off ? 'Beendet – Sieger, Zweiter und Dritter stehen in der Ehrentafel.' : 'Beim Beenden kommen Sieger, Zweiter und Dritter in die Ehrentafel, die Sperre im Buchungssystem fällt weg und Ergebnisse lassen sich nicht mehr ändern.'}</p>
        <div class="btns">${!off && drawn && !d.matches.some(m => m.done || m.running) ? '<button class="btn" id="fsUndraw">Auslosung aufheben …</button>' : ''}${drawn ? `<button class="btn" id="fsFin">${off ? 'Wieder öffnen' : 'Turnier beenden …'}</button>` : ''}</div>
        <div class="btns" style="margin-top:8px;border-top:1px solid var(--line);padding-top:12px"><button class="btn danger" id="fsDel">Turnier löschen</button></div></div>`;
    const drawOrder = () => {
      if (!$('fsO')) return;
      $('fsO').innerHTML = order.map((k, i) => `<div class="torow"><span class="ton">${i + 1}</span><span class="tnm"><b>${esc(ORDER_WORDS[k])}</b></span><span class="muted s"></span><span></span>
        <span class="toact">${k === 'los' ? '' : `<button class="btn small" data-oup="${i}" ${i && !off ? '' : 'disabled'} aria-label="nach oben">↑</button><button class="btn small" data-odn="${i}" ${i < order.length - 2 && !off ? '' : 'disabled'} aria-label="nach unten">↓</button>`}</span></div>`).join('');
      $('fsO').querySelectorAll('[data-oup]').forEach(b => { b.onclick = () => { const i = +b.dataset.oup; [order[i - 1], order[i]] = [order[i], order[i - 1]]; drawOrder(); }; });
      $('fsO').querySelectorAll('[data-odn]').forEach(b => { b.onclick = () => { const i = +b.dataset.odn; [order[i + 1], order[i]] = [order[i], order[i + 1]]; drawOrder(); }; });
    };
    drawOrder();
    const v = id => ($(id) ? $(id).value : undefined);
    const num = (id, cur) => ($(id) ? +$(id).value : cur);
    el.querySelectorAll('[data-save]').forEach(b => { b.onclick = () => GK.busy(b, async () => {
      const cfg = { win: num('fsW', c.win), draw: num('fsDr', c.draw), loss: num('fsL', c.loss), scoring: v('fsS') || c.scoring, minutes: num('fsM', c.minutes), pause: num('fsP', c.pause), decider: v('fsK') || c.decider, court: v('fsC') || c.court,
        group_size: num('fsG', c.group_size), qualify: num('fsQ', c.qualify), third: $('fs3') ? $('fs3').checked : c.third, rounds: num('fsR', c.rounds), order,
        break_groups: ft.format === 'gruppen' ? num('fsBG', c.break_groups) : c.break_groups, break_ko: ft.format === 'gruppen' ? num('fsBK', c.break_ko) : ft.format === 'ko' ? num('fsBG', c.break_ko) : c.break_ko,
        end_warn: v('fsE') || '', fee: v('fsFee') || '0' };
      try { await api('/' + ft.id, 'PUT', { name: v('fsN'), format: v('fsF'), date: v('fsD'), start: v('fsT'), cfg }); toast('Gespeichert.'); again(); } catch (e) { fail(e); }
    }); });
    el.querySelectorAll('[data-cn]').forEach(x => { x.onchange = async () => { try { await api('/platz/' + x.dataset.cn, 'PUT', { name: x.value }); toast('Gespeichert.'); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-res]').forEach(x => { x.onchange = async () => { try { await api('/platz/' + x.dataset.res, 'PUT', { resource_id: x.value ? +x.value : null }); toast('Gespeichert.'); } catch (e) { fail(e); again(); } }; });
    el.querySelectorAll('[data-cdel]').forEach(b => { b.onclick = async () => { if (!await GK.ask('Entfernen?', { ok: 'Entfernen', danger: true })) return; try { await api('/platz/' + b.dataset.cdel, 'DELETE'); again(); } catch (e) { fail(e); } }; });
    if ($('fsCAdd')) $('fsCAdd').onclick = async () => {
      const name = await GK.askText(`${c.court} anlegen\n\nz. B. „${c.court} ${d.courts.length + 1}“ oder „Halle“.`, `${c.court} ${d.courts.length + 1}`, { ok: 'Anlegen' }); if (!name) return;
      try { await api(`/${ft.id}/platz`, 'POST', { name }); again(); } catch (e) { fail(e); }
    };
    if ($('fsUnlock')) $('fsUnlock').onclick = async () => { if (!await GK.ask('Sperre aufheben?\n\nDie Plätze sind im Buchungssystem dann wieder frei buchbar.', { ok: 'Aufheben' })) return; try { await api(`/${ft.id}/sperre`, 'POST', { off: true }); toast('Sperre aufgehoben.'); again(); } catch (e) { fail(e); } };
    if ($('fsLock')) $('fsLock').onclick = () => GK.busy($('fsLock'), async () => {
      const b = { from: $('fsLf').value, to: $('fsLt').value === '23:59' ? '24:00' : $('fsLt').value };
      let p; try { p = await api(`/${ft.id}/sperre`, 'POST', { ...b, preview: true }); } catch (e) { return fail(e); }
      const msg = `Plätze sperren?\n\n${p.made} ${p.made === 1 ? 'Sperre' : 'Sperren'} neu${p.removed ? `, ${p.removed} entfallen` : ''}.${p.conflicts.length ? `\n\nDiese Buchungen werden storniert:\n${p.conflicts.map(x => `${x.resource} ${GK.deDate(x.date)} ${x.start}–${x.end} ${x.title}`).join('\n')}` : ''}`;
      if (!await GK.ask(msg, { ok: 'Sperren', danger: p.conflicts.length > 0 })) return;
      try { await api(`/${ft.id}/sperre`, 'POST', b); toast('Gesperrt.'); again(); } catch (e) { fail(e); }
    });
    if ($('fsMonCopy')) $('fsMonCopy').onclick = () => GK.copyText($('fsMon').textContent, 'Adresse kopiert.');
    if ($('fsMonQrB')) $('fsMonQrB').onclick = () => GK.busy($('fsMonQrB'), async () => { try { const r = await api(`/${ft.id}/qr`); $('fsMonQr').innerHTML = r.svg || ''; } catch (e) { fail(e); } });
    if ($('fsMonNew')) $('fsMonNew').onclick = async () => { if (!await GK.ask('Monitor-Link erneuern?\n\nDer bisherige Link (und alle ausgedruckten QR-Codes) gilt danach nicht mehr.', { ok: 'Erneuern', danger: false })) return; try { await api(`/${ft.id}/monitor`, 'POST', {}); toast('Neuer Link.'); again(); } catch (e) { fail(e); } };
    if ($('fsCodeOk')) $('fsCodeOk').onclick = () => GK.busy($('fsCodeOk'), async () => { try { await api(`/${ft.id}/code`, 'POST', { code: $('fsCode').value }); toast('Code festgelegt – bitte merken, er wird nicht wieder angezeigt.'); again(); } catch (e) { fail(e); } });
    if ($('fsCodeOff')) $('fsCodeOff').onclick = async () => { if (!await GK.ask('Code entfernen?\n\nAm Tablet lassen sich dann keine Ergebnisse mehr eintragen.', { ok: 'Entfernen' })) return; try { await api(`/${ft.id}/code`, 'POST', { code: '' }); toast('Code entfernt.'); again(); } catch (e) { fail(e); } };
    if ($('fsUndraw')) $('fsUndraw').onclick = async () => { if (!await GK.ask('Auslosung aufheben?\n\nGruppen, Spiele und Zeitplan werden gelöscht. Danach lassen sich Mannschaften nachtragen und neu auslosen.', { ok: 'Aufheben' })) return; try { await api(`/${ft.id}/zuruecksetzen`, 'POST', {}); toast('Auslosung aufgehoben.'); again(); } catch (e) { fail(e); } };
    if ($('fsFin')) $('fsFin').onclick = async () => {
      if (off) { try { await api(`/${ft.id}/abschluss`, 'POST', { undo: true }); toast('Wieder geöffnet.'); again(); } catch (e) { fail(e); } return; }
      let p; try { p = await api(`/${ft.id}/abschluss`, 'POST', { preview: true }); } catch (e) { return fail(e); }
      if (!await GK.ask(`Turnier beenden?\n\n${p.podium.length ? p.podium.map(x => `${x.place}. ${x.name}`).join('\n') : 'Noch keine Platzierung.'}${p.open ? `\n\n${p.open} ${p.open === 1 ? 'Spiel ist' : 'Spiele sind'} noch offen.` : ''}`, { ok: 'Beenden', danger: false })) return;
      try { await api(`/${ft.id}/abschluss`, 'POST', {}); toast('Beendet – die Sieger stehen in der Ehrentafel.'); again(); } catch (e) { fail(e); }
    };
    $('fsDel').onclick = async () => {
      if (!await GK.ask(`Turnier „${ft.name}“ löschen?\n\nMannschaften, Spielplan und Ergebnisse sind danach weg; eine Sperre im Buchungssystem wird aufgehoben.`)) return;
      try { await api('/' + ft.id, 'DELETE'); toast('Gelöscht.'); GK.closeDetail(); } catch (e) { fail(e); }
    };
  }
  window.TurnierFT = { render, load: loadDetail, detail };
})();
