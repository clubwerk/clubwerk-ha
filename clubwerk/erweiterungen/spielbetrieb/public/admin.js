'use strict';
/* Verwaltung „Spielbetrieb“: Spieltage (Ampel, Aufstellung) · Mannschaften (Mannschaftsführer, Meldeliste) · Einstellungen */
(() => {
  const GK = window.GK;
  const { $, esc, toast, fail, dialog, closeDialog, ask, deDate } = GK;
  const api = (url, method, body) => GK.api('x/spielbetrieb/' + url, method, body);
  const st = { meta: null, team: 0, past: false, cal: false, year: 0 };
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
      .sp-bar { height: 40px; margin-bottom: 8px; display: flex; align-items: center; }   /* Suchfeld links, Hinweis rechts – beide Listen beginnen auf gleicher Höhe */
      label.f.sp-bar > input { height: 40px; }
      .sp-tasks > div { display: grid; grid-template-columns: minmax(0, 1fr) 240px auto; gap: 10px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line-soft); }
      .sp-tasks > div:first-child { border-top: 0; }
      .sp-g.rt h4 { color: var(--muted); } .sp-g.rt .sp-d { background: var(--hover); color: var(--ink); }
      .sp-rt td { vertical-align: middle; } .sp-rt select { min-height: 36px; height: 36px; min-width: 150px; }
      .sp-dl { display: flex; flex-wrap: wrap; gap: 4px; } .sp-dl span { background: var(--hover); border-radius: 6px; padding: 2px 6px; font-size: 12.5px; white-space: nowrap; } .sp-dl span.z { background: transparent; border: 1px dashed var(--line); color: var(--muted); }
      .sp-calw { overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; background: var(--card); }
      .sp-cal { display: grid; grid-template-rows: auto repeat(31, minmax(26px, auto)); grid-auto-flow: column; grid-auto-columns: minmax(170px, 1fr); }
      .sp-cal > div { border-left: 1px solid var(--line); border-top: 1px solid var(--line-soft); }
      .sp-cal > .c1 { border-left: 0; }
      .sp-cal .ch { border-top: 0; padding: 8px 6px; text-align: center; font-weight: 700; font-size: 13.5px; background: var(--hover); }
      .sp-cal .cd { display: grid; grid-template-columns: 20px 20px minmax(0, 1fr); gap: 4px; align-items: center; padding: 2px 6px; font-size: 12px; }
      .sp-cal .cd.we { background: var(--hover); }
      .sp-cal .cd.td { box-shadow: inset 0 0 0 2px var(--brand); }
      .sp-cal .cd.nx { background: repeating-linear-gradient(135deg, transparent 0 6px, var(--line-soft) 6px 7px); }
      .sp-cal .cn { font-weight: 700; color: var(--ink); } .sp-cal .cw { color: var(--muted); }
      .sp-cal .cg { display: flex; flex-wrap: wrap; gap: 3px; min-width: 0; }
      .sp-cal .cc { font: 600 11px/16px inherit; font-family: inherit; padding: 0 6px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--ink); cursor: pointer; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
      .sp-cal .cc.g { background: var(--brand-soft); border-color: var(--brand); color: var(--brand); }
      .sp-cal .cc.r { background: var(--red-soft, #fbe9e7); border-color: var(--red); color: var(--red); }
      .sp-cal .cc.p { border-style: dashed; color: var(--muted); }
      .sp-cal .cc.x { color: var(--muted); } .sp-cal .cc.s { text-decoration: line-through; }
      .sp-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; margin-top: 10px; font-size: 12.5px; color: var(--muted); }
      .sp-legend .sp-cal { display: contents; } .sp-legend .li { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
      @media print { .sp-calw { border: 0; overflow: visible; } .sp-cal { grid-auto-columns: minmax(0, 1fr); grid-template-rows: auto repeat(31, minmax(0, auto)); } .sp-cal .cd { font-size: 8.5px; padding: 0 3px; grid-template-columns: 13px 14px minmax(0, 1fr); gap: 2px; }
        .sp-cal .cc { font-size: 7.5px; line-height: 11px; padding: 0 3px; } .sp-cal * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      @media (max-width: 760px) { .sp-g { grid-template-columns: 6px 64px minmax(0, 1fr); } .sp-g .sp-nums { grid-column: 3; justify-content: flex-start; } .sp-d { width: 64px; } .sp-tasks > div { grid-template-columns: 1fr; } .sp-acts { display: grid; grid-template-columns: 1fr; width: 100%; } .sp-acts .btn { width: 100%; } }
      /* Sportwart-Übersicht */
      .sp-kbar { height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; margin-top: 6px; } .sp-kbar i { display: block; height: 100%; background: var(--brand); border-radius: 3px; }
      .sp-al { display: grid; gap: 0; }
      .sp-ksub { min-height: 18px; display: flex; align-items: center; font-size: 12.5px; color: var(--muted); }
      .sp-al > div { display: grid; grid-template-columns: 10px 84px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 9px 0; border-top: 1px solid var(--line-soft, var(--line)); }
      .sp-al > div:first-child { border-top: 0; padding-top: 2px; }
      .sp-al .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--amber); } .sp-al .dot.r { background: var(--red); }
      .sp-al .dd { white-space: nowrap; font-weight: 800; font-variant-numeric: tabular-nums; font-size: 13.5px; }
      .sp-dt { display: grid; gap: 16px; }
      .sp-th { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 4px; }
      .sp-th h3 { margin: 0; } .sp-th .muted { font-size: 13px; margin-top: 3px; }
      .sp-rate { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } .sp-rate b { font-size: 22px; font-variant-numeric: tabular-nums; white-space: nowrap; } .sp-rate .btn { white-space: nowrap; } .sp-rate .sp-kbar { width: 120px; margin: 0; }
      .sp-mx { overflow-x: auto; margin-top: 12px; border: 1px solid var(--line); border-radius: 12px; }
      .sp-mx table { border-collapse: separate; border-spacing: 0; min-width: 100%; font-size: 13px; }
      .sp-mx th, .sp-mx td { padding: 6px; text-align: center; border-bottom: 1px solid var(--line-soft, var(--line)); white-space: nowrap; }
      .sp-mx tr:last-child td { border-bottom: 0; }
      .sp-mx th:first-child, .sp-mx td:first-child { position: sticky; left: 0; z-index: 1; background: var(--card); text-align: left; padding-left: 12px; min-width: 170px; border-right: 1px solid var(--line); }
      .sp-mx thead th { background: var(--hover); font-weight: 700; color: var(--muted); font-size: 12px; } .sp-mx thead th:first-child { background: var(--hover); }
      .sp-mx thead button { all: unset; cursor: pointer; display: grid; justify-items: center; gap: 1px; min-width: 52px; } .sp-mx thead button b { color: var(--ink); font-size: 12.5px; }
      .sp-mx thead button:hover b { color: var(--brand-ink); text-decoration: underline; }
      .sp-mx .lt { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: var(--line); } .sp-mx .lt.g { background: var(--brand); } .sp-mx .lt.r { background: var(--red); }
      .sp-c { display: inline-grid; place-items: center; width: 28px; height: 26px; border-radius: 7px; font-weight: 800; font-size: 13px; background: var(--hover); color: var(--faint, var(--muted)); }
      .sp-c.y { background: var(--brand-soft); color: var(--brand-ink); } .sp-c.n { background: var(--red-soft); color: var(--red); }
      .sp-c.p { box-shadow: inset 0 0 0 2px var(--brand); } .sp-c.e { box-shadow: inset 0 0 0 2px var(--amber); } .sp-c.w { box-shadow: inset 0 0 0 2px var(--red); }
      .sp-mx td.op { color: var(--amber); font-weight: 800; } .sp-mx tfoot td { font-weight: 800; background: var(--hover); }
      .sp-mx tfoot td.ok { color: var(--brand-ink); } .sp-mx tfoot td.no { color: var(--red); }
      .sp-leg { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 10px; font-size: 12.5px; color: var(--muted); align-items: center; } .sp-leg span { display: inline-flex; align-items: center; gap: 6px; } .sp-leg .sp-c { width: 22px; height: 20px; font-size: 11px; }`;
    document.head.appendChild(s);
  }

  const PAGE = {
    'sp-uebersicht': ['Übersicht', 'Rückmeldungen aller Mannschaften auf einen Blick – wo zu wenige können, wer noch nicht geantwortet hat und was als Nächstes ansteht.'],
    'sp-spieltage': ['Spieltage', 'Alle Spieltage der Mannschaften – grün: genug Spieler haben zugesagt, rot: zu wenige. Antippen öffnet Verfügbarkeit und Aufstellung.'],
    'sp-mannschaften': ['Mannschaften', 'Mannschaften mit Mannschaftsführer, Stellvertretung und Spieler/innen in der Reihenfolge der Meldeliste. Eine Person kann in mehreren Mannschaften spielen.'],
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
  const rtTitle = g => (g.za ? 'Zusatz-/Ausweichtermin' : 'Rahmentermin');
  const nums = (g, past) => {
    const s = g.stats;
    if (g.status === 'abgesagt') return '<span class="pill">abgesagt</span>';
    if (g.kind === 'rahmen' && !g.released) return '<span class="pill">noch nicht abgefragt</span>';
    return `<span class="pill ${past ? '' : light(s)}">${s.yes} von ${s.min} können</span>${s.open && !past ? `<span class="pill">${s.open} offen</span>` : ''}${s.playing ? `<span class="pill ${s.lineupOk ? 'g' : 'a'}">${s.playing} aufgestellt</span>` : ''}${s.withdraws ? `<span class="pill a">${s.withdraws} Absage-Anfrage</span>` : ''}${g.result ? `<span class="pill">${esc(g.result)}</span>` : ''}`;
  };

  /* ---------------- Spieltage ---------------- */
  /** Kalender wie im Rahmenterminplan: je Monat eine Spalte, je Tag eine Zeile (gleiche Zeilenhöhe über alle Monate) */
  const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const WDS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const p2 = n => String(n).padStart(2, '0');
  function calChip(g) {
    const tag = g.kind === 'rahmen' ? (g.za ? 'Z/A' : 'RT') : g.home ? 'H' : 'A';
    const cls = g.status === 'abgesagt' ? 'x s' : g.kind === 'rahmen' && !g.released ? 'p' : g.past ? 'x' : g.ok ? 'g' : 'r';
    const tip = `${g.team} · ${g.kind === 'rahmen' ? (g.za ? 'Zusatz-/Ausweichtermin' : 'Rahmentermin') + ' (vorläufig)' : `${g.home ? 'Heim gegen' : 'Auswärts bei'} ${g.opponent}${g.start ? ' · ' + g.start + ' Uhr' : ''}`}${g.status === 'abgesagt' ? ' · abgesagt' : ` · ${g.yes} von ${g.min} können`}`;
    return `<button type="button" class="cc ${cls}${g.za ? ' p' : ''}" data-g="${g.id}" title="${esc(tip)}"><span translate="no">${esc(g.team)}</span> ${tag}</button>`;
  }
  function calView(c, print = false) {
    const by = {}; c.games.forEach(g => { (by[g.date] = by[g.date] || []).push(g); });
    const mo = c.games.map(g => +g.date.slice(5, 7));
    const a = mo.length ? Math.min(...mo) : 4, b = mo.length ? Math.max(...mo) : 9;
    const months = []; for (let i = Math.min(a, 9); i <= Math.max(b, Math.min(a, 9) + 3); i++) months.push(i);   // mindestens 4 Monate (wie im Rahmenterminplan Mai–September)
    const cells = months.map((mm, ci) => [`<div class="ch${ci ? '' : ' c1'}">${MON[mm - 1]} ${c.year}</div>`, ...Array.from({ length: 31 }, (x, i) => {
      const iso = `${c.year}-${p2(mm)}-${p2(i + 1)}`, dt = new Date(iso + 'T12:00:00Z');
      if (dt.getUTCMonth() + 1 !== mm) return `<div class="cd nx${ci ? '' : ' c1'}"></div>`;
      const w = dt.getUTCDay();
      return `<div class="cd${w === 0 || w === 6 ? ' we' : ''}${iso === c.today && !print ? ' td' : ''}${ci ? '' : ' c1'}"><span class="cn">${p2(i + 1)}</span><span class="cw">${WDS[w]}</span><span class="cg">${(by[iso] || []).map(calChip).join('')}</span></div>`;
    })].join('')).join('');
    return `<div class="sp-calw"><div class="sp-cal">${cells}</div></div>
      <div class="sp-legend">${[['g', 'H', 'Heimspiel, genug Zusagen'], ['r', 'A', 'Auswärtsspiel, zu wenige Zusagen'], ['p', 'RT', 'vorläufig (Rahmentermin; Z/A = Zusatz-/Ausweichtag)'], ['x s', 'H', 'abgesagt']].map(([c, t, l]) => `<span class="li"><span class="sp-cal"><span class="cc ${c}">${t}</span></span>${l}</span>`).join('')}${print ? '' : '<span class="li">Antippen öffnet den Spieltag</span>'}</div>`;
  }
  async function showGames(el) {
    const m = st.meta;
    const cal = st.cal ? await api(`calendar?${st.year ? `year=${st.year}&` : ''}${st.team ? `team=${st.team}` : ''}`) : null;
    const games = cal ? [] : await api(`games?past=${st.past ? 1 : 0}${st.team ? `&team=${st.team}` : ''}`);
    el.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-end;gap:10px;margin-bottom:14px">
        <div class="row" style="gap:10px;align-items:flex-end"><label class="f" style="min-width:220px">Mannschaft<select id="spT">${opt(0, 'Alle Mannschaften', st.team)}${m.teams.filter(t => t.active).map(t => opt(t.id, t.name, st.team)).join('')}</select></label>
          ${cal ? `<label class="f" style="min-width:110px">Jahr<select id="spY">${cal.years.map(y => opt(y, String(y), cal.year)).join('')}</select></label>` : ''}
          <div class="seg"><button type="button" data-past="0" class="${!st.cal && !st.past ? 'on' : ''}">Kommende</button><button type="button" data-past="1" class="${!st.cal && st.past ? 'on' : ''}">Vergangene</button><button type="button" data-cal="1" class="${st.cal ? 'on' : ''}">Kalender</button></div></div>
        <div class="row sp-acts" style="gap:8px">${cal ? '<button class="btn" id="spPrint" type="button">Drucken</button>' : ''}<button class="btn" id="spRtp" type="button" ${m.teams.length ? '' : 'disabled'}>Rahmenterminplan …</button><button class="btn" id="spImp" type="button">Spielplan importieren …</button><button class="btn primary" id="spNew" type="button" ${m.teams.length ? '' : 'disabled'}>+ Spieltag</button></div></div>
      ${!m.teams.length ? '<div class="banner a"><span>Noch keine Mannschaften – zuerst unter „Mannschaften“ anlegen oder einfach den Spielplan importieren (Mannschaften entstehen dabei automatisch).</span></div>' : ''}
      ${m.rahmenPending ? `<div class="banner a" style="margin-bottom:14px"><span>${m.rahmenPending} vorläufige Termine aus dem Rahmenterminplan sind angelegt, aber noch nicht abgefragt – die Spieler sehen sie erst nach „Abfrage starten“.</span><button class="btn primary small" id="spRel" type="button">Abfrage starten</button></div>` : ''}
      ${cal ? calView(cal) : ''}
      <div class="sp-games${cal ? ' hidden' : ''}">${cal ? '' : games.length ? games.map(g => g.kind === 'rahmen' ? `<div class="sp-g rt" data-g="${g.id}"><span class="lt ${!g.released || st.past ? 'x' : light(g.stats)}"></span>
          <div class="sp-d"><b>${esc(g.date.slice(8, 10))}.${esc(g.date.slice(5, 7))}.</b><span>${esc(wd(g.date))}</span></div>
          <div style="min-width:0"><h4><span translate="no">${esc(g.team)}</span> · ${esc(rtTitle(g))}</h4>
            <div class="muted">vorläufig – Gegner und Heim/Auswärts kommen mit dem Spielplan${g.captain ? ' · MF ' + esc(g.captain) : ''}</div></div>
          <div class="sp-nums">${nums(g, st.past)}</div></div>` : `<div class="sp-g" data-g="${g.id}"><span class="lt ${g.status === 'abgesagt' || st.past ? 'x' : light(g.stats)}"></span>
          <div class="sp-d"><b>${esc(g.date.slice(8, 10))}.${esc(g.date.slice(5, 7))}.</b><span>${esc(wd(g.date))}${g.start ? ' ' + esc(g.start) : ''}</span></div>
          <div style="min-width:0"><h4><span translate="no">${esc(g.team)}</span> ${g.home ? 'gegen' : 'bei'} <span translate="no">${esc(g.opponent)}</span></h4>
            <div class="muted">${g.home ? 'Heimspiel' : 'Auswärtsspiel'}${g.league ? ' · ' + esc(g.league) : ''}${g.captain ? ' · MF ' + esc(g.captain) : ''}${g.sent ? ' · Aufstellung verschickt' : ''}</div></div>
          <div class="sp-nums">${nums(g, st.past)}</div></div>`).join('') : `<p class="muted">${st.past ? 'Keine vergangenen Spieltage.' : 'Keine kommenden Spieltage.'}</p>`}</div>`;
    $('spT').onchange = () => { st.team = +$('spT').value; showGames(el).catch(fail); };
    el.querySelectorAll('[data-past]').forEach(b => { b.onclick = () => { st.past = b.dataset.past === '1'; st.cal = false; showGames(el).catch(fail); }; });
    el.querySelectorAll('[data-cal]').forEach(b => { b.onclick = () => { st.cal = true; showGames(el).catch(fail); }; });
    if ($('spY')) $('spY').onchange = () => { st.year = +$('spY').value; showGames(el).catch(fail); };
    if ($('spPrint')) $('spPrint').onclick = () => {
      const tn = st.team ? (m.teams.find(t => t.id === st.team) || {}).name : 'Alle Mannschaften';
      $('printArea').innerHTML = `<style>@page { size: A4 landscape; margin: 8mm; }</style><div class="pr"><h2 style="margin:0 0 4mm;font-size:13pt">Spieltage ${cal.year} – ${esc(tn)}</h2>${calView(cal, true)}</div>`;
      document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing');
    };
    el.querySelectorAll('[data-g]').forEach(c => { c.onclick = () => gameDialog(+c.dataset.g, () => showGames(el).catch(fail)); });
    $('spNew').onclick = () => editGame(null, () => showGames(el).catch(fail));
    $('spImp').onclick = () => importDialog(() => pageRender('sp-spieltage', showGames)().catch(fail));
    $('spRtp').onclick = () => rahmenDialog(() => pageRender('sp-spieltage', showGames)().catch(fail));
    if ($('spRel')) $('spRel').onclick = () => GK.busy($('spRel'), async () => {
      if (!await ask(`${m.rahmenPending} vorläufige Termine in der App zeigen und die Spieler per Push bitten, „kann“ oder „kann nicht“ zu melden?`, { ok: 'Abfrage starten' })) return;
      try { const r = await api('rahmen/release', 'POST', {}); toast(`Abfrage gestartet: ${r.games} Termine, ${r.players} Spieler benachrichtigt.`); pageRender('sp-spieltage', showGames)().catch(fail); } catch (e) { fail(e); }
    });
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
    if (v.kind === 'rahmen') return rahmenGame(v, after);
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

  /** Vorläufiger Termin: nur Verfügbarkeit (Aufstellung erst mit dem Spielplan) */
  function rahmenGame(v, after) {
    const id = v.id;
    const draw = () => {
      const s = v.stats;
      const row = p => `<tr><td class="r muted">${esc(p.rank ?? '')}</td><td><b translate="no">${esc(p.ln)}</b>${p.note ? `<div class="muted s">${esc(p.note)}</div>` : ''}</td>
        <td><select data-av="${p.id}" aria-label="Verfügbarkeit">${opt('', 'offen', p.state || '')}${opt('ja', 'kann', p.state)}${opt('nein', 'kann nicht', p.state)}</select>${p.state === 'ja' && (p.from || p.until) ? `<div class="muted" style="font-size:12px;margin-top:3px">${p.from ? 'ab ' + esc(p.from) : ''}${p.from && p.until ? ' ' : ''}${p.until ? 'bis ' + esc(p.until) : ''}</div>` : ''}</td></tr>`;
      dialog(`<h3><span translate="no">${esc(v.team)}</span> · ${esc(rtTitle(v))}</h3>
        <p class="muted" style="margin:-4px 0 12px">${esc(wd(v.date))} ${esc(deDate(v.date))} · vorläufig aus dem Rahmenterminplan – Gegner, Uhrzeit und Heim/Auswärts kommen mit dem Spielplan-Import, die Rückmeldungen bleiben dabei erhalten.${v.released ? '' : ' <b>Noch nicht abgefragt.</b>'}</p>
        <div class="row" style="gap:8px;margin-bottom:10px"><span class="pill ${s.ok ? 'g' : 'r'}">${s.yes} von mindestens ${s.min} können</span><span class="pill">${s.no} ${s.no === 1 ? 'kann' : 'können'} nicht</span><span class="pill">${s.open} offen</span></div>
        <div class="scroll" style="max-height:50vh"><table class="tbl sp-ros"><tr><th class="r" style="width:36px">Nr.</th><th>Spieler</th><th>Verfügbarkeit</th></tr>${v.people.filter(p => p.inRoster).map(row).join('') || '<tr><td colspan="3" class="muted">Noch keine Spieler in dieser Mannschaft.</td></tr>'}</table></div>
        <div class="btns"><button class="btn danger" id="rgDel" type="button" style="margin-right:auto">Termin löschen</button><button class="btn" id="rgRem" type="button" ${s.open && v.released ? '' : 'disabled'}>Offene erinnern</button><button class="btn ghost" id="rgC" type="button">Schließen</button></div>`, true);
      $('dialog').querySelectorAll('[data-av]').forEach(x => { x.onchange = async () => { try { v = await api(`games/${id}/avail`, 'POST', { member_id: +x.dataset.av, state: x.value }); } catch (e) { fail(e); } draw(); }; });
      $('rgRem').onclick = () => GK.busy($('rgRem'), async () => { try { const r = await api(`games/${id}/remind`, 'POST', {}); toast(`${r.n} Spieler erinnert.`); } catch (e) { fail(e); } });
      $('rgDel').onclick = async () => { if (!await ask('Vorläufigen Termin löschen? Die Rückmeldungen dazu gehen verloren.', { ok: 'Löschen', danger: true })) return; try { await api('games/' + id, 'DELETE'); closeDialog(); toast('Gelöscht.'); after(); } catch (e) { fail(e); } };
      $('rgC').onclick = () => { closeDialog(); after(); };
    };
    draw();
  }

  /* ---------------- Rahmenterminplan (vorläufige Termine je Altersklasse) ---------------- */
  function rahmenDialog(after) {
    dialog(`<h3>Rahmenterminplan importieren</h3>
      <p class="muted" style="margin:0 0 12px">Der Verband veröffentlicht lange vor dem Spielplan den Rahmenterminplan mit den Spieltagen je Altersklasse. Daraus entstehen vorläufige Termine, für die sich die Spieler schon melden können. Kommt später der Spielplan, wird aus jedem vorläufigen Termin der echte Spieltag – die Rückmeldungen bleiben erhalten; Termine ohne Spiel entfallen.</p>
      <div class="row" style="gap:10px;align-items:center"><label class="btn" style="cursor:pointer">PDF wählen …<input id="rtF" type="file" accept=".pdf,application/pdf" style="display:none"></label><span class="muted s" id="rtFn">Rahmenterminplan als PDF (z. B. von der Verbandsseite)</span></div>
      <div class="btns"><button class="btn ghost" id="rtC" type="button">Abbrechen</button><button class="btn primary" id="rtGo" type="button" disabled>Weiter</button></div>`);
    let file = null;
    $('rtC').onclick = closeDialog;
    $('rtF').onchange = () => { const f = $('rtF').files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { file = String(r.result).split(',')[1]; $('rtFn').textContent = f.name; $('rtGo').disabled = false; }; r.readAsDataURL(f); };
    $('rtGo').onclick = () => GK.busy($('rtGo'), async () => { try { rahmenReview(await api('rahmen/parse', 'POST', { file }), after); } catch (e) { fail(e); } });
  }
  function rahmenReview(r, after) {
    const cls = Object.keys(r.classes);
    const sel = {}; r.teams.forEach(t => { sel[t.id] = t.games ? '' : t.age_class || ''; });
    let za = r.za;
    const dm = d => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
    const draw = () => {
      const row = t => {
        if (t.games) return `<tr><td><b translate="no">${esc(t.name)}</b>${t.league ? `<div class="muted s">${esc(t.league)}</div>` : ''}</td><td>${esc(t.age_class || t.guess || '–')}</td><td class="muted">Spielplan schon importiert (${t.games} Spieltage) – keine vorläufigen Termine nötig.</td></tr>`;
        const c = r.classes[sel[t.id]];
        const ds = c ? [...c.dates.map(d => ({ d, z: 0 })), ...(za ? c.za.map(d => ({ d, z: 1 })) : [])].filter(x => x.d >= r.today).sort((a, b) => (a.d < b.d ? -1 : 1)) : [];
        return `<tr><td><b translate="no">${esc(t.name)}</b>${t.league ? `<div class="muted s">${esc(t.league)}</div>` : ''}</td>
          <td><select data-cl="${t.id}" aria-label="Altersklasse">${opt('', '– nicht übernehmen –', sel[t.id])}${cls.map(k => opt(k, k, sel[t.id])).join('')}</select>${!t.age_class && t.guess ? `<div class="muted s">„${esc(t.guess)}“ steht nicht im Plan</div>` : ''}</td>
          <td>${ds.length ? `<div class="sp-dl">${ds.map(x => `<span class="${x.z ? 'z' : ''}" title="${esc(wd(x.d))}${x.z ? ' · Zusatz-/Ausweichtag' : ''}">${esc(wd(x.d))} ${esc(dm(x.d))}</span>`).join('')}</div>` : '<span class="muted">–</span>'}
</td></tr>`;
      };
      const n = r.teams.filter(t => sel[t.id]).length;
      dialog(`<h3>Rahmenterminplan ${esc(r.year)} prüfen</h3>
        <p class="muted" style="margin:0 0 10px">Je Mannschaft die Altersklasse aus dem Plan wählen (vorgeschlagen aus Name und Liga). Angezeigt sind die erkannten Termine ab heute – bitte einmal mit der PDF vergleichen.</p>
        <div class="scroll" style="max-height:52vh"><table class="tbl sp-rt"><tr><th>Mannschaft</th><th>Altersklasse</th><th>Termine</th></tr>${r.teams.map(row).join('') || '<tr><td colspan="3" class="muted">Noch keine aktiven Mannschaften.</td></tr>'}</table></div>
        <label class="chk" style="margin-top:10px"><input type="checkbox" id="rtZa" ${za ? 'checked' : ''}> Zusatz- und Ausweichtage (Z/A) auch abfragen <span class="muted s">– gestrichelt; werden nur bei Bedarf genutzt</span></label>
        <div class="btns"><button class="btn ghost" id="rtC" type="button">Abbrechen</button><button class="btn primary" id="rtOk" type="button" ${n ? '' : 'disabled'}>Für ${n} Mannschaft(en) übernehmen</button></div>`, true);
      $('rtC').onclick = closeDialog;
      $('rtZa').onchange = () => { za = $('rtZa').checked; draw(); };
      $('dialog').querySelectorAll('[data-cl]').forEach(x => { x.onchange = () => { sel[+x.dataset.cl] = x.value; draw(); }; });
      $('rtOk').onclick = () => GK.busy($('rtOk'), async () => {
        try {
          const used = Object.fromEntries(Object.values(sel).filter(Boolean).map(k => [k, r.classes[k]]));
          const x = await api('rahmen/apply', 'POST', { classes: used, assign: sel, za });
          closeDialog();
          toast(`${x.made} vorläufige Termine angelegt${x.removed ? `, ${x.removed} entfernt` : ''}. Die Spieler sehen sie nach „Abfrage starten“.`);
          after();
        } catch (e) { fail(e); }
      });
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
        <div class="sp-grid" style="--c:3">${r.teams.map(t => `<label class="f">${esc(t.team === '–' ? 'ohne Angabe' : t.team)} (${t.count} Spiele)<select data-tm="${esc(t.team)}">${opt(0, `neu anlegen${t.size ? ` (${t.size}er)` : ''}`, teamSel[t.team])}${m.teams.map(x => opt(x.id, x.name, teamSel[t.team])).join('')}</select>${t.rahmenKeep || t.rahmenDrop ? `<span class="muted s" style="font-weight:500">Vorläufige Termine: ${t.rahmenKeep} ${t.rahmenKeep === 1 ? 'wird' : 'werden'} zum Spieltag${t.rahmenDrop ? `, ${t.rahmenDrop} entfallen (spielfrei)` : ''}</span>` : ''}</label>`).join('')}</div>
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
          toast(`${x.made} Spieltage neu${x.converted ? ` (davon ${x.converted} aus vorläufigen Terminen)` : ''}${x.free ? `, ${x.free} vorläufige Termine entfallen` : ''}${x.moved ? `, ${x.moved} verlegt` : ''}${x.teamsMade ? `, Mannschaften angelegt: ${x.teams.join(', ')}` : ''}.${bk}`); after();
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
          <div class="muted s">${[t.age_class ? `Altersklasse ${t.age_class}` : '', t.league, t.season, `mindestens ${t.min_players} Spieler/innen`, t.captain ? `Mannschaftsführer: ${t.captain}` : 'noch kein Mannschaftsführer', t.vice ? `Stellvertreter: ${t.vice}` : ''].filter(Boolean).map(esc).join(' · ')}</div>
          <div class="sp-pl" translate="no">${t.players.length ? t.players.map(p => `<span><b>${esc(p.rank)}</b>${esc(p.ln)}</span>`).join('') : '<span class="muted">noch keine Spieler/innen</span>'}</div></div>
        <div class="row" style="gap:8px;justify-content:flex-end"><button class="btn small" data-pl="${t.id}" type="button">Spieler/innen …</button><button class="btn small" data-ed="${t.id}" type="button">Bearbeiten</button></div></div>`).join('')
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
        <label class="f wall">Name<input id="etN" value="${esc(t.name)}" placeholder="z. B. Herren 40 I"></label>
        <label class="f">Liga<input id="etL" value="${esc(t.league || '')}" placeholder="z. B. H40 (4er) Bezirksliga"></label>
        <label class="f">Saison<input id="etS" value="${esc(t.season || '')}" placeholder="z. B. Sommer 2027"></label>
        <label class="f">Altersklasse (Rahmenterminplan)<input id="etK" value="${esc(t.age_class || '')}" placeholder="z. B. H40, D, HL H30"></label>
        <label class="f">Mindestens Spieler pro Spieltag<input id="etM" type="number" min="1" max="20" value="${esc(t.min_players)}"></label>
        <label class="f">Mannschaftsführer${pick('etC', t.captain_id)}</label>
        <label class="f">Stellvertreter${pick('etV', t.vice_id)}</label>
        <label class="chk wall"><input type="checkbox" id="etA" ${t.active ? 'checked' : ''}> aktiv (nicht aktive Mannschaften verschwinden aus der App)</label>
      </div>
      <p class="muted s">Mannschaftsführer und Stellvertreter stellen in der Mitglieder-App unter „Spieltage“ auf – dafür brauchen sie kein Konto in der Verwaltung.</p>
      <div class="btns">${t.id ? '<button class="btn danger" id="etDel" type="button" style="margin-right:auto">Löschen</button>' : ''}<button class="btn ghost" id="etX" type="button">Abbrechen</button><button class="btn primary" id="etOk" type="button">Speichern</button></div>`);
    $('etX').onclick = closeDialog;
    $('etOk').onclick = () => GK.busy($('etOk'), async () => {
      const body = { name: val('etN'), age_class: val('etK'), league: val('etL'), season: val('etS'), min_players: +val('etM'), captain_id: +val('etC') || null, vice_id: +val('etV') || null, active: $('etA').checked };
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
      dialog(`<h3>Spieler/innen · <span translate="no">${esc(t.name)}</span></h3>
        <p class="muted" style="margin:0 0 10px">Links Mitglieder suchen und mit + in die Mannschaft holen. Rechts steht die Mannschaft in der Reihenfolge der Meldeliste (Nr. 1 oben), mit ▲ ▼ verschieben. Eine Person kann in mehreren Mannschaften stehen.</p>
        <div class="sp-grid" style="--c:2"><div><h4 style="margin:0 0 6px">Mitglieder</h4><label class="f sp-bar"><input id="plQ" placeholder="Name suchen" value="${esc(q)}" aria-label="Name suchen"></label><div class="sp-sel" translate="no">${hits.map(x => `<div><span></span><span>${esc(x.ln)}</span><button class="btn small" data-ad="${x.id}" type="button" aria-label="in die Mannschaft">+</button></div>`).join('') || '<div><span></span><span class="muted">keine Treffer</span><span></span></div>'}</div></div>
          <div><h4 style="margin:0 0 6px">In der Mannschaft (${list.length})</h4><div class="sp-bar muted s">Meldeliste – Nr. 1 oben</div><div class="sp-sel" translate="no">${list.map((p, i) => `<div><span class="rk">${i + 1}</span><span>${esc(p.ln)}</span><span class="nw"><button class="btn small ghost" data-up="${i}" type="button" ${i ? '' : 'disabled'} aria-label="nach oben">▲</button><button class="btn small ghost" data-dn="${i}" type="button" ${i < list.length - 1 ? '' : 'disabled'} aria-label="nach unten">▼</button><button class="btn small ghost" data-rm="${i}" type="button" aria-label="entfernen">✕</button></span></div>`).join('') || '<div><span></span><span class="muted">noch niemand – links mit + hinzufügen</span><span></span></div>'}</div></div></div>
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
  /* ---------- Sportwart-Übersicht ---------- */
  async function showDash(el) {
    const d = await api('dashboard'), k = d.kpi;
    const dd = x => `${wd(x)} ${x.slice(8, 10)}.${x.slice(5, 7)}.`;
    const addD = (x, n) => { const z = new Date(x + 'T12:00:00'); z.setDate(z.getDate() + n); return z.toISOString().slice(0, 10); };
    const kpi = (l, v, sub, warn) => `<div class="kpi${warn ? ' warn' : ''}"><span class="l">${esc(l)}</span><span class="v">${v}</span><div class="sp-ksub">${sub || ''}</div></div>`;
    const rateBar = r => `<div class="sp-kbar"><i style="width:${r || 0}%"></i></div>`;
    const full = d.teams.filter(t => t.matrix.length && t.games.length), empty = d.teams.filter(t => !(t.matrix.length && t.games.length));
    el.innerHTML = `<div class="kpis">
        ${kpi('Rückmeldequote', k.rate == null ? '–' : k.rate + ' %', `<div class="sp-kbar" style="flex:1;margin:0"><i style="width:${k.rate || 0}%"></i></div>`)}
        ${kpi('Spieltage in den nächsten 14 Tagen', k.next14, `bis ${dd(addD(d.today, 14))}`)}
        ${kpi('Zu wenige Zusagen', k.crit, k.crit ? 'in den nächsten 14 Tagen' : 'alles im grünen Bereich', k.crit > 0)}
        ${kpi('Offene Absage-Anfragen', k.withdraws, k.withdraws ? 'Mannschaftsführer entscheidet' : 'keine', k.withdraws > 0)}</div>
      <div class="card"><h3>Braucht Aufmerksamkeit</h3>${d.alerts.length ? `<div class="sp-al">${d.alerts.map(a => `<div><span class="dot ${a.level}"></span><span class="dd">${dd(a.date)}</span><span><b translate="no">${esc(a.team)}</b> · ${esc(a.text)}</span><button class="btn small" data-og="${a.game_id}">Öffnen</button></div>`).join('')}</div>` : '<p class="muted" style="margin:0">Alles im grünen Bereich – für die nächsten 14 Tage können überall genug Spieler/innen.</p>'}</div>
      <div class="sp-dt">${full.length ? full.map(t => `<div class="card"><div class="sp-th"><div><h3 translate="no">${esc(t.name)}</h3><div class="muted">${[t.league, t.captain ? `MF ${t.captain}` : 'kein Mannschaftsführer', t.vice ? `Stv. ${t.vice}` : '', `${t.roster} Spieler/innen`, `mind. ${t.min}`].filter(Boolean).map(esc).join(' · ')}${t.pending ? ` · <span class="pill a">${t.pending} vorläufige Termine nicht abgefragt</span>` : ''}</div></div>
          <div class="sp-rate">${t.rate == null ? '<span class="muted">keine Termine</span>' : `<b>${t.rate} %</b><div>${rateBar(t.rate)}<span class="muted s">beantwortet</span></div>`}${t.matrix.some(m => m.open) ? `<button class="btn small" data-rm="${t.id}">Offene erinnern</button>` : ''}</div></div>
        ${t.games.length && t.matrix.length ? `<div class="sp-mx"><table><thead><tr><th>Spieler/in</th>${t.games.map(g => `<th><button data-og="${g.id}" title="${esc(g.kind === 'rahmen' ? (g.za ? 'Zusatz-/Ausweichtermin' : 'Rahmentermin') : `${g.home ? 'gegen' : 'bei'} ${g.opponent}`)}"><b><span class="lt ${g.ok ? 'g' : g.near ? 'r' : ''}"></span> ${dd(g.date)}</b><span>${g.kind === 'rahmen' ? (g.za ? 'Z/A' : 'vorl.') : g.home ? 'Heim' : 'ausw.'}</span></button></th>`).join('')}<th>offen</th></tr></thead>
          <tbody>${t.matrix.map(m => `<tr><td><span class="muted" style="display:inline-block;width:22px">${m.rank < 99 ? m.rank : ''}</span><span translate="no">${esc(m.ln)}</span></td>${m.cells.map(c => `<td><span class="sp-c ${c.s === 'ja' ? 'y' : c.s === 'nein' ? 'n' : ''} ${c.w ? 'w' : c.r === 'spielt' ? 'p' : c.r === 'ersatz' ? 'e' : ''}">${c.s === 'ja' ? '✓' : c.s === 'nein' ? '✕' : '·'}</span></td>`).join('')}<td class="${m.open ? 'op' : 'muted'}">${m.open || '–'}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Zusagen / benötigt</td>${t.games.map(g => `<td class="${g.ok ? 'ok' : 'no'}">${g.yes}/${g.min}</td>`).join('')}<td></td></tr></tfoot></table></div>` : `<p class="muted" style="margin:10px 0 0">${t.matrix.length ? 'Keine anstehenden Spieltage.' : 'Noch keine Spieler/innen in der Mannschaft.'}</p>`}</div>`).join('') : ''}${empty.length ? `<div class="card"><h3>Ohne Spieler/innen oder anstehende Termine</h3><div class="sp-pl" style="margin:0">${empty.map(t => `<span translate="no"><b>${t.roster}</b>${esc(t.name)}</span>`).join('')}</div><p class="muted s" style="margin:8px 0 0">Spieler/innen trägst du unter „Mannschaften“ ein, Termine kommen über den Spielplan- oder Rahmenterminplan-Import.</p></div>` : ''}${!d.teams.length ? '<div class="card"><p class="muted" style="margin:0">Noch keine aktiven Mannschaften.</p></div>' : ''}</div>
      ${d.teams.some(t => t.games.length) ? `<div class="sp-leg"><span><i class="sp-c y">✓</i> kann</span><span><i class="sp-c n">✕</i> kann nicht</span><span><i class="sp-c">·</i> offen</span><span><i class="sp-c y p">✓</i> aufgestellt</span><span><i class="sp-c y e">✓</i> Ersatz</span><span><i class="sp-c w">✓</i> Absage-Anfrage</span><span><span class="lt g" style="width:8px;height:8px;border-radius:50%;background:var(--brand)"></span> genug Zusagen</span></div>` : ''}`;
    el.querySelectorAll('[data-og]').forEach(b => { b.onclick = () => gameDialog(+b.dataset.og, () => showDash(el).catch(fail)); });
    el.querySelectorAll('[data-rm]').forEach(b => { b.onclick = () => GK.busy(b, async () => { try { const r = await api(`teams/${b.dataset.rm}/remind`, 'POST', {}); toast(r.n ? `${r.n} Spieler/innen erinnert.` : 'Niemand mit offenen Terminen.'); } catch (e) { fail(e); } }); });
  }

  async function showSettings(el) {
    const s = st.meta.settings;
    const chk = (k, l, on, hint) => `<label class="chk" style="align-items:flex-start;margin:8px 0"><input type="checkbox" id="ss_${k}" ${on ? 'checked' : ''} style="margin-top:3px"> <span><b>${esc(l)}</b>${hint ? `<br><span class="muted s">${esc(hint)}</span>` : ''}</span></label>`;
    el.innerHTML = `<div class="card"><h3>Was Spieler in der App sehen</h3>
        ${chk('see_avail', 'Wer sonst kann', s.seeAvail, 'Spieler sehen die Namen der anderen, die für einen Spieltag „kann“ gemeldet haben.')}
        ${chk('see_lineup', 'Aufstellung', s.seeLineup, 'Spieler sehen, wer aufgestellt ist. Der Mannschaftsführer sieht immer alles.')}
        ${chk('cap_info', 'Mannschaftsführer mit Handynummer', s.capInfo, 'Oben in „Spieltage“ stehen Mannschaftsführer (sonst Stellvertretung) und Handynummer aus der Mitgliederverwaltung – für Rückfragen, mit „Anrufen“.')}
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
      for (const k of ['see_avail', 'see_lineup', 'cap_info', 'times', 'tasks', 'remind', 'mail']) b[k] = $('ss_' + k).checked;
      try { const r = await api('settings', 'PUT', b); st.meta.settings = r.settings; toast('Gespeichert.'); } catch (e) { fail(e); }
    });
  }

  const G = { key: 'spielbetrieb', label: 'Spielbetrieb', icon: 'pokal', order: 2.5 };   // Menü: nach dem Buchungssystem
  GK.registerPage({ key: 'sp-uebersicht', title: 'Übersicht', perm: 'spielbetrieb', render: pageRender('sp-uebersicht', showDash), group: G });
  GK.registerPage({ key: 'sp-spieltage', title: 'Spieltage', perm: 'spielbetrieb', render: pageRender('sp-spieltage', showGames), group: G });
  GK.registerPage({ key: 'sp-mannschaften', title: 'Mannschaften', perm: 'spielbetrieb', render: pageRender('sp-mannschaften', showTeams), group: G });
  GK.registerPage({ key: 'sp-einstellungen', title: 'Einstellungen', perm: 'spielbetrieb', render: pageRender('sp-einstellungen', showSettings), group: G });
})();
