'use strict';
/* Bereich „Spieltage“ in der Mitglieder-App (Modul Spielbetrieb):
   Spieler melden „kann“ / „kann nicht“ (optional ab/bis Uhrzeit), sehen ihre Aufstellung, fragen Absagen an, übernehmen Aufgaben.
   Mannschaftsführer sehen die Ampel und stellen in einem eigenen Fenster auf (nie ein neues Browserfenster). */
(() => {
  if (!document.getElementById('sbStyle')) {
    const s = document.createElement('style'); s.id = 'sbStyle';
    s.textContent = `
      .sb-line { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; font-size: 13.5px; color: var(--muted); }
      .sb-line button, .sb-link { font: inherit; font-size: 13.5px; font-weight: 700; color: var(--brand-ink); background: none; border: 0; padding: 6px 0; }
      .sb-play { margin-top: 12px; padding: 12px; border-radius: var(--r-tile); background: var(--brand-soft); }
      .sb-play.wd { background: var(--amber-soft); }
      .sb-play b { display: block; font-size: 15px; color: var(--ink); } .sb-play p { margin: 4px 0 8px; font-size: 13px; color: var(--muted); }
      .sb-play button { min-height: 40px; border-radius: var(--r-ctl); font: inherit; font-size: 14px; font-weight: 700; border: 1px solid var(--line); background: var(--card); color: var(--ink); padding: 0 14px; }
      .sb-who { margin-top: 10px; font-size: 13px; color: var(--muted); line-height: 1.5; } .sb-who b { color: var(--ink); font-weight: 700; }
      .sb-tasks { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 8px; }
      .sb-tasks > div { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 5px 0; font-size: 14px; }
      .sb-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .sb-p { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 9px 0; border-top: 1px solid var(--line); }
      .sb-p:first-of-type { border-top: 0; }
      .sb-p .rk { font-family: var(--num); font-size: 15px; font-weight: 600; color: var(--muted); text-align: right; }
      .sb-p strong { display: block; font-size: 14.5px; } .sb-p small { display: block; font-size: 12px; color: var(--muted); margin-top: 1px; }
      .sb-seg { display: flex; gap: 3px; padding: 3px; border-radius: 999px; background: var(--hover); }
      .sb-seg button { min-height: 34px; min-width: 38px; border-radius: 999px; border: 0; background: transparent; font: inherit; font-size: 12.5px; font-weight: 800; color: var(--muted); padding: 0 8px; }
      .sb-seg button.on { background: var(--brand); color: var(--on-brand); } .sb-seg button.on.e { background: var(--amber); }
      .sb-p.wd { background: var(--amber-soft); margin: 0 -16px; padding: 9px 16px; }
      .sb-wd { grid-column: 2 / -1; display: flex; gap: 8px; margin-top: 6px; }
      .sb-wd .vh-btn { flex: 1; min-width: 0; }   /* Knöpfe aus dem Kit (.vh-btn.sm / .sec) */
      .sb-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; border-top: 1px solid var(--line); }
      .sb-row:first-child { border-top: 0; } .sb-row.x { opacity: .6; } .sb-row.open { background: color-mix(in srgb, var(--hover) 45%, var(--card)); }
      .sb-rh { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 10px; align-items: center; padding: 9px 4px 9px 14px; background: none; border: 0; font: inherit; color: inherit; text-align: left; min-width: 0; }
      .sb-tt { min-width: 0; } .sb-tt strong { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font-size: 14.5px; line-height: 1.25; overflow: hidden; overflow-wrap: anywhere; }   /* Titel bis zwei Zeilen statt abgeschnitten */
      .sb-rr .vh-yn button, .sb-gx .vh-yn button { border-radius: 999px; }   /* Zusagen-Marken als Pillen */
      .sb-tt .num { font-size: 1.15em; }
      .sb-tt small { display: block; font-size: 12.5px; line-height: 1.3; color: var(--muted); margin-top: 2px; } .sb-tt em { font-style: normal; color: var(--amber); font-weight: 700; }
      .sb-rr { display: flex; align-items: center; gap: 6px; padding-right: 10px; }
      .sb-det { grid-column: 1 / -1; padding: 0 14px 12px 72px; }
      .sb-det .sb-play { margin-top: 4px; } .sb-det .sb-line:first-child, .sb-det .sb-who:first-child { margin-top: 2px; }
      @media (max-width: 360px) { .sb-det { padding-left: 14px; } }
      /* Tag mit mehreren Mannschaften: aufgeklappt die einzelnen Mannschaften eingerückt, ohne zweiten Datumsblock */
      .sb-sub { grid-column: 1 / -1; border-top: 1px solid var(--line); background: color-mix(in srgb, var(--hover) 55%, var(--card)); }
      .sb-sub .sb-row:first-child { border-top: 0; } .sb-sub .sb-row.open { background: transparent; }
      .sb-sub .sb-rh { grid-template-columns: minmax(0, 1fr); padding-left: 72px; } .sb-sub .vh-date { display: none; }
      .sb-gx { align-items: center; flex-wrap: wrap; } .sb-gx > span:first-child { flex: 1 0 100%; font-size: 12.5px; color: var(--muted); font-weight: 600; }
      .sb-gx .sb-link { margin-left: auto; }`;
    document.head.appendChild(s);
  }
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const wd = (d, long) => (long ? WDL : WD)[new Date(d + 'T12:00:00').getDay()];
  const deD = d => (d ? d.split('-').reverse().join('.') : '');
  const title = g => (g.kind === 'rahmen' ? `${g.team} · ${g.za ? 'Zusatz-/Ausweichtermin' : 'Rahmentermin'}` : `${g.team} ${g.home ? 'gegen' : 'bei'} ${g.opponent}`);

  window.VA.registerSection({
    id: 'spielbetrieb',
    render(el, ctx) {
      const { esc } = ctx;
      const nums = t => esc(t).replace(/\d{1,2}:\d{2}|\d+\/\d+/g, '<span class="num">$&</span>');   // Uhrzeiten und Zähler in Anzeigetafel-Ziffern
      let d = null, tab = 'alle';
      const openRows = new Set();   // aufgeklappte Spieltage (bleiben nach dem Neuladen offen)
      const sheet = () => { let sh = document.getElementById('sbSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'sbSheet'; sh.className = 'vh-sheet vh-form'; document.body.appendChild(sh); } return sh; };
      const close = () => { const s = document.getElementById('sbSheet'); if (s) s.classList.remove('show'); };
      ctx.onLeave(close);

      let focus = ctx.focus || '';   // aus „Für mich“: diesen Spieltag aufklappen und hinscrollen (nur beim ersten Laden)
      async function load() {
        try { d = await ctx.api('me'); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        const fg = focus && d.games.find(g => String(g.id) === focus);
        if (fg) { openRows.add(fg.id); openRows.add('d' + fg.date); }
        draw();
        if (fg) { const r = el.querySelector(`[data-x="${fg.id}"]`) || el.querySelector(`[data-x="d${fg.date}"]`); if (r) r.scrollIntoView({ block: 'center' }); }
        focus = '';
      }
      function draw() {
        const teams = d.teams;
        if (!teams.some(t => String(t.id) === tab)) tab = 'alle';
        const games = d.games.filter(g => tab === 'alle' || String(g.team_id) === tab).filter(g => !g.past || g.date === d.today);
        // Saisonstart: noch offene Spieltage je Mannschaft mit einem Tipp beantworten
        const openBy = {}; d.games.filter(g => g.mine && !g.past && g.status === 'geplant' && !(g.me && g.me.state)).forEach(g => { openBy[g.team_id] = (openBy[g.team_id] || 0) + 1; });
        // Sammelleiste: ab 3 offenen Terminen; in „Alle“ zählen alle Mannschaften zusammen (eine Leiste)
        const bulk0 = teams.filter(t => t.player && openBy[t.id] && (tab === 'alle' || String(t.id) === tab));
        const bulk = bulk0.reduce((n, t) => n + openBy[t.id], 0) >= 3 ? bulk0 : [];
        const bulkIds = bulk.map(t => t.id).join(',');
        // Kopf: was zu tun ist und wen man bei Fragen anruft (Mannschaftsführer mit Handynummer – abschaltbar in den Einstellungen)
        const shown = teams.filter(t => tab === 'alle' || String(t.id) === tab);
        const openN = d.games.filter(g => g.mine && !g.past && g.status === 'geplant' && !(g.me && g.me.state) && shown.some(t => t.id === g.team_id)).length;
        const hasRt = games.some(g => g.kind === 'rahmen');
        const telOf = p => String(p || '').replace(/[^\d+]/g, '').replace(/^00/, '+').replace(/^0/, '+49');
        // Ansprechpartner: dieselbe Person für mehrere Mannschaften nur einmal (mit allen Mannschaften dahinter)
        const cts = []; for (const t of shown.filter(x => x.contact && !x.contact.self)) { const c0 = cts.find(c => c.contact.name === t.contact.name && c.contact.phone === t.contact.phone); if (c0) c0.names.push(t.name); else cts.push({ contact: t.contact, names: [t.name] }); }
        const head = `<div class="vh-card"><h3>${shown.length === 1 ? `<span translate="no">${esc(shown[0].name)}</span>` : 'Deine Mannschaften'}${shown.length === 1 && shown[0].league ? `<small translate="no">${esc(shown[0].league)}</small>` : ''}</h3>
          <p class="vh-lead">${openN ? `Bitte bei jedem Termin melden: <span class="nw"><b>✓</b>&nbsp;ich&nbsp;kann</span> · <span class="nw"><b>✕</b>&nbsp;ich&nbsp;kann&nbsp;nicht</span>. Danach stellt der Mannschaftsführer auf.${hasRt ? ' „Vorläufig“ heißt: Termin aus dem Rahmenterminplan, der Gegner kommt mit dem Spielplan.' : ''}` : 'Danke – alles beantwortet. Ändern geht jederzeit mit ✓ oder ✕.'}</p>
          ${cts.length ? `<div class="vh-rows">${cts.map(t => `<div><span class="vh-tx"><strong translate="no">${esc(t.contact.name)}</strong><small>${esc(t.contact.role)}${shown.length > 1 ? ` · <span translate="no">${esc(t.names.join(', '))}</span>` : ''}${t.contact.phone ? ` · ${esc(t.contact.phone)}` : ''}</small></span>${t.contact.phone ? `<a class="vh-btn sm sec" href="tel:${esc(telOf(t.contact.phone))}">Anrufen</a>` : ''}</div>`).join('')}</div>` : ''}</div>`;
        el.innerHTML = `${head}${teams.length > 1 ? `<div class="vh-seg">${[['alle', 'Alle'], ...teams.map(t => [String(t.id), t.name])].map(([k, l]) => `<button data-tab="${esc(k)}" class="${k === tab ? 'on' : ''}" translate="no">${esc(l)}</button>`).join('')}</div>` : ''}
          ${bulk.length > 1 ? `<div class="vh-bar a"><span><b>${bulk.reduce((n, t) => n + openBy[t.id], 0)} offen</b> in ${bulk.length} Mannschaften</span><button data-bulk="${bulkIds}" data-st="ja" aria-label="Bei allen: kann">Alle ✓</button><button data-bulk="${bulkIds}" data-st="nein" aria-label="Bei allen: kann nicht">Alle ✕</button></div>`
            : bulk.map(t => `<div class="vh-bar a"><span><b translate="no">${esc(t.name)}</b>: ${openBy[t.id]} offen</span><button data-bulk="${t.id}" data-st="ja" aria-label="Bei allen: kann">Alle ✓</button><button data-bulk="${t.id}" data-st="nein" aria-label="Bei allen: kann nicht">Alle ✕</button></div>`).join('')}
          ${games.length ? `<div class="vh-card flush">${(tab === 'alle' && teams.length > 1 ? byDay(games).map(([day, gs]) => (gs.length > 1 ? dayRow(day, gs) : row(gs[0]))) : games.map(row)).join('')}</div>` : `<div class="vh-empty">Keine anstehenden Spieltage${tab === 'alle' ? '' : ' für diese Mannschaft'}.</div>`}
          ${d.played ? `<p class="vh-lead" style="text-align:center;margin:4px 0 0">In dieser Saison hast du ${d.played}-mal gespielt.</p>` : ''}`;
        el.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { tab = b.dataset.tab; draw(); }; });
        el.querySelectorAll('[data-x]').forEach(b => { b.onclick = () => { const id = /^d/.test(b.dataset.x) ? b.dataset.x : +b.dataset.x; if (openRows.has(id)) openRows.delete(id); else openRows.add(id); draw(); }; });
        el.querySelectorAll('[data-ans]').forEach(b => { b.onclick = () => answer(+b.dataset.g, b.dataset.ans); });
        el.querySelectorAll('[data-time]').forEach(b => { b.onclick = () => timeSheet(d.games.find(g => g.id === +b.dataset.time)); });
        el.querySelectorAll('[data-wd]').forEach(b => { b.onclick = () => withdrawSheet(d.games.find(g => g.id === +b.dataset.wd)); });
        el.querySelectorAll('[data-wdc]').forEach(b => { b.onclick = () => run(() => ctx.api('withdraw', 'POST', { game_id: +b.dataset.wdc, cancel: true }), 'Absage zurückgenommen – du bleibst aufgestellt.'); });
        el.querySelectorAll('[data-tk]').forEach(b => { b.onclick = () => run(() => ctx.api('task', 'POST', { task_id: +b.dataset.tk, take: b.dataset.take === '1' }), b.dataset.take === '1' ? 'Übernommen – danke!' : 'Abgegeben.'); });
        el.querySelectorAll('[data-lead]').forEach(b => { b.onclick = () => leadSheet(+b.dataset.lead); });
        el.querySelectorAll('[data-bulk]').forEach(b => { b.onclick = () => run(() => ctx.api('avail/all', 'POST', { team_ids: b.dataset.bulk.split(',').map(Number), state: b.dataset.st }), 'Gemeldet – danke!'); });
        el.querySelectorAll('[data-gans]').forEach(b => { b.onclick = () => answerDay(b.dataset.gans, b.dataset.ans); });
      }
      /* Mehrere Mannschaften: Termine am selben Tag zu einer Zeile zusammenfassen – ein ✓/✕ gilt für alle Mannschaften an dem Tag,
         aufgeklappt lässt sich je Mannschaft einzeln antworten */
      const answerable = g => g.mine && g.status !== 'abgesagt' && !g.past && (g.me || {}).role !== 'spielt' && !g.elsewhere;
      function byDay(gs) { const m = new Map(); for (const g of gs) { if (!m.has(g.date)) m.set(g.date, []); m.get(g.date).push(g); } return [...m.entries()]; }
      function dayRow(day, gs) {
        const key = 'd' + day, open = openRows.has(key);
        const ans = gs.filter(answerable), sts = ans.map(g => (g.me && g.me.state) || null);
        const all = sts.length && sts.every(s => s === sts[0]) ? sts[0] : sts.some(Boolean) ? 'teils' : null;
        const rt = gs.every(g => g.kind === 'rahmen');
        const title = gs.map(g => g.team).join(' + ');
        const lead = gs.some(g => g.lead), lt = lead ? (gs.every(g => g.status === 'abgesagt' || g.stats.ok) ? 'g' : 'r') : '';
        const playsIn = gs.filter(g => (g.me || {}).role === 'spielt').map(g => g.team);
        const sub = playsIn.length ? `Du spielst in ${playsIn.join(', ')}` : all === 'teils' ? ans.map(g => `${g.team} ${g.me && g.me.state === 'ja' ? '✓' : g.me && g.me.state === 'nein' ? '✕' : 'offen'}`).join(' · ')
          : rt ? 'vorläufig' : gs.map(g => `${g.team}${g.start ? ' ' + g.start : ''} ${g.home ? 'Heim' : 'ausw.'}`).join(' · ');
        const roles = gs.filter(g => (g.me || {}).role === 'spielt').map(g => g.team);
        const right = ans.length ? `<span class="vh-yn"><button class="y ${all === 'ja' ? 'on' : ''}" data-gans="${day}" data-ans="ja" aria-label="Kann (alle Mannschaften)">✓</button><button class="n ${all === 'nein' ? 'on' : ''}" data-gans="${day}" data-ans="nein" aria-label="Kann nicht (alle Mannschaften)">✕</button></span>`
          : roles.length ? '<span class="vh-chip g">spielt</span>' : '';
        return `<div class="sb-row sb-day${open ? ' open' : ''}">
          <button class="sb-rh" data-x="${key}" aria-expanded="${open}"><span class="vh-date">${lead ? `<i class="${lt}"></i>` : ''}<b>${esc(day.slice(8, 10))}.${esc(day.slice(5, 7))}.</b><span>${esc(wd(day))}</span></span>
            <span class="sb-tt"><strong translate="no">${esc(title)}${rt ? ` · ${gs.some(g => g.za) ? 'Zusatz-/Ausweichtermin' : 'Rahmentermin'}` : ''}</strong><small>${nums(sub)}${all === null && ans.length ? ' · <em>offen</em>' : ''}</small></span></button>
          <span class="sb-rr">${right}</span>
          ${open ? `<div class="sb-sub">${gs.map(row).join('')}</div>` : ''}</div>`;
      }
      async function answerDay(day, state) {
        const gs = d.games.filter(g => g.date === day && answerable(g) && (tab === 'alle' || String(g.team_id) === tab));
        const same = gs.every(g => g.me && g.me.state === state);   // nochmal tippen = für alle zurücknehmen
        await run(() => ctx.api('avail/day', 'POST', { date: day, state: same ? null : state }));   // eine Anfrage für alle Mannschaften
      }
      /** eine Zeile je Spieltag: Datum · Titel · ✓/✕ (oder „spielt“/„Ersatz“) – Antippen klappt die Details auf */
      function row(g) {
        const me = g.me || {}, s = g.stats, cancelled = g.status === 'abgesagt', open = openRows.has(g.id);
        const lt = cancelled ? '' : s.ok ? 'g' : 'r';
        const answerable = g.mine && !cancelled && !g.past && me.role !== 'spielt' && !g.elsewhere;
        const sub = g.kind === 'rahmen' ? `vorläufig${me.state === 'ja' && (me.from || me.until) ? ' · ' + [me.from ? `ab ${me.from}` : '', me.until ? `bis ${me.until}` : ''].filter(Boolean).join(' ') : ''}`
          : [g.start ? `${g.start} Uhr` : '', g.home ? 'Heim' : 'auswärts', g.lead ? `${s.yes}/${s.min} können` : ''].filter(Boolean).join(' · ');
        const tag = cancelled ? '<span class="vh-chip">abgesagt</span>' : g.elsewhere && me.role !== 'spielt' ? `<span class="vh-chip" translate="no">spielt in ${esc(g.elsewhere)}</span>` : me.role === 'spielt' ? `<span class="vh-chip ${me.withdraw ? 'a' : 'g'}">${me.withdraw ? 'Absage offen' : 'spielt'}</span>` : '';
        const right = answerable ? `<span class="vh-yn"><button class="y ${me.state === 'ja' ? 'on' : ''}" data-ans="ja" data-g="${g.id}" aria-label="Kann">✓</button><button class="n ${me.state === 'nein' ? 'on' : ''}" data-ans="nein" data-g="${g.id}" aria-label="Kann nicht">✕</button></span>${me.role === 'ersatz' ? '<span class="vh-chip a">Ersatz</span>' : ''}` : tag;
        return `<div class="sb-row${cancelled ? ' x' : ''}${open ? ' open' : ''}">
          <button class="sb-rh" data-x="${g.id}" aria-expanded="${open}"><span class="vh-date">${g.lead ? `<i class="${lt}"></i>` : ''}<b>${esc(g.date.slice(8, 10))}.${esc(g.date.slice(5, 7))}.</b><span>${esc(wd(g.date))}</span></span>
            <span class="sb-tt"><strong translate="no">${esc(title(g))}</strong><small>${nums(sub)}${!me.state && answerable ? ' · <em>offen</em>' : ''}</small></span></button>
          <span class="sb-rr">${right}</span>
          ${open ? `<div class="sb-det">${detail(g)}</div>` : ''}</div>`;
      }
      function detail(g) {        const me = g.me || {}, s = g.stats, cancelled = g.status === 'abgesagt';
        const meet = [g.meet_time ? `Treffpunkt ${g.meet_time} Uhr` : '', g.meet_place || ''].filter(Boolean).join(' · ');
        const yes = (g.people || []).filter(p => p.state === 'ja'), play = (g.people || []).filter(p => p.role === 'spielt'), res = (g.people || []).filter(p => p.role === 'ersatz');
        const names = l => l.map(p => esc(p.short || p.ln)).join(', ');
        let mine = '';
        if (cancelled) mine = '<div class="sb-play wd"><b>Abgesagt</b><p>Dieser Spieltag findet nicht statt.</p></div>';
        else if (me.role === 'spielt' && me.withdraw) mine = `<div class="sb-play wd"><b>Du spielst – Absage angefragt</b><p>Der Mannschaftsführer muss die Absage bestätigen und Ersatz einplanen. Bis dahin bist du aufgestellt.</p><button data-wdc="${g.id}">Absage zurücknehmen</button></div>`;
        else if (me.role === 'spielt') mine = `<div class="sb-play"><b>Du spielst</b><p>${esc(meet || 'Der Mannschaftsführer schickt Treffpunkt und Aufstellung.')}</p><button data-wd="${g.id}">Kann doch nicht – Absage anfragen</button></div>`;
        else if (me.role === 'ersatz') mine = `<div class="sb-play"><b>Du bist Ersatz</b><p>${esc(meet || 'Halte dich bitte bereit.')}</p><button data-wd="${g.id}">Kann doch nicht</button></div>`;
        const answerable = g.mine && !cancelled && !g.past && me.role !== 'spielt' && !g.elsewhere;
        const tasks = d.settings.tasks && g.tasks && g.tasks.length && g.mine && !cancelled ? `<div class="sb-tasks">${g.tasks.map(x => `<div><span>${esc(x.label)}${x.who ? ` · <b translate="no">${esc(x.who)}</b>` : ''}</span>${x.member_id === null && !(g.me && g.me.state === 'nein') ? `<button class="vh-btn sm" data-tk="${x.id}" data-take="1">Übernehme ich</button>` : x.mine ? `<button class="vh-btn sm sec" data-tk="${x.id}" data-take="0">Abgeben</button>` : ''}</div>`).join('')}</div>` : '';
        return `          ${mine}
          ${!g.home && g.venue && g.kind !== 'rahmen' ? `<div class="sb-line"><span translate="no">${esc(g.venue)}</span></div>` : ''}${g.kind === 'rahmen' ? '<div class="sb-line"><span>Gegner und Heim/Auswärts kommen mit dem Spielplan.</span></div>' : ''}
          ${answerable ? `${me.state === 'ja' && d.settings.times ? `<div class="sb-line"><span>${me.from || me.until ? esc([me.from ? `ab ${me.from}` : '', me.until ? `bis ${me.until}` : ''].filter(Boolean).join(' ') + ' Uhr') : 'den ganzen Spieltag'}</span><button data-time="${g.id}">Uhrzeit angeben</button></div>` : ''}
            ${!me.state ? '<div class="sb-line"><span>Bitte oben mit ✓ oder ✕ melden.</span></div>' : ''}` : ''}
          ${!cancelled && (d.settings.seeAvail || d.settings.seeLineup || g.lead) ? `<div class="sb-who">${play.length && (d.settings.seeLineup || g.lead) ? `<div>Aufgestellt: <b translate="no">${names(play)}</b>${res.length ? ` · Ersatz: <span translate="no">${names(res)}</span>` : ''}</div>` : ''}${d.settings.seeAvail || g.lead ? `<div>${yes.length ? `Können (${yes.length}): <span translate="no">${names(yes)}</span>` : 'Noch keine Zusagen.'}</div>` : ''}</div>` : ''}
          ${tasks}
          ${g.lead && !cancelled && g.kind === 'rahmen' ? `<div class="sb-line"><span>${s.yes} von ${s.min} können${s.open ? ` · ${s.open} offen` : ''} – aufstellen geht, sobald der Spielplan da ist.</span></div>` : ''}
          ${g.lead && !cancelled && g.kind === 'rahmen' ? `<button class="vh-btn sec wide" style="margin-top:12px" data-lead="${g.id}">Rückmeldungen · Gäste eintragen</button>` : ''}
          ${g.lead && !cancelled && g.kind !== 'rahmen' ? `<button class="vh-btn sec wide" style="margin-top:12px" data-lead="${g.id}">Aufstellung${s.withdraws ? ` · ${s.withdraws} Absage-Anfrage` : ''}</button>` : ''}`;
      }
      async function run(fn, msg) { try { await fn(); if (msg) ctx.toast(msg); close(); await load(); } catch (e) { ctx.toast(e.message, true); } }
      function answer(id, state) {
        const g = d.games.find(x => x.id === id);
        if (g.me && g.me.state === state) return run(() => ctx.api('avail', 'POST', { game_id: id, state: null }));   // nochmal tippen = zurücknehmen
        run(() => ctx.api('avail', 'POST', { game_id: id, state }));
      }
      function timeSheet(g) {
        const sh = sheet(), me = g.me || {};
        sh.innerHTML = `<div class="vh-box"><h2>Wann kannst du?</h2><p>${esc(title(g))} · ${esc(wd(g.date, true))}, ${esc(deD(g.date))}${g.start ? `, ${esc(g.start)} Uhr` : ''}. Beides ist freiwillig – leer heißt: den ganzen Spieltag.</p>
          <div class="sb-two"><div><label>ab</label><input class="vh-input" type="time" id="sbF" value="${esc(me.from || '')}"></div><div><label>bis</label><input class="vh-input" type="time" id="sbU" value="${esc(me.until || '')}"></div></div>
          <label>Hinweis (optional)</label><input class="vh-input" id="sbN" maxlength="140" value="${esc(me.note || '')}" placeholder="z. B. komme direkt von der Arbeit">
          <div class="vh-err" id="sbE"></div><div class="vh-row"><button class="no" id="sbX">Abbrechen</button><button class="ok" id="sbOk">Speichern</button></div></div>`;
        sh.classList.add('show');
        sh.querySelector('#sbX').onclick = close;
        sh.querySelector('#sbOk').onclick = async () => { try { await ctx.api('avail', 'POST', { game_id: g.id, state: 'ja', from: sh.querySelector('#sbF').value, until: sh.querySelector('#sbU').value, note: sh.querySelector('#sbN').value }); close(); ctx.toast('Gespeichert.'); load(); } catch (e) { sh.querySelector('#sbE').textContent = e.message; } };
      }
      function withdrawSheet(g) {
        const sh = sheet(), ersatz = g.me && g.me.role === 'ersatz';
        sh.innerHTML = `<div class="vh-box"><h2>${ersatz ? 'Als Ersatz absagen?' : 'Absage anfragen'}</h2><p>${ersatz ? 'Der Mannschaftsführer bekommt eine kurze Nachricht.' : 'Du bist aufgestellt. Der Mannschaftsführer bekommt eine Nachricht und muss die Absage bestätigen, weil er Ersatz einplanen muss. Bis dahin bleibst du aufgestellt.'}</p>
          <label>Grund (optional, sieht nur der Mannschaftsführer)</label><input class="vh-input" id="sbN" maxlength="200" placeholder="z. B. krank">
          <div class="vh-err" id="sbE"></div><div class="vh-row"><button class="no" id="sbX">Doch dabei</button><button class="ok" id="sbOk" style="background:var(--red);border-color:var(--red)">${ersatz ? 'Absagen' : 'Anfrage senden'}</button></div></div>`;
        sh.classList.add('show');
        sh.querySelector('#sbX').onclick = close;
        sh.querySelector('#sbOk').onclick = async () => { try { const r = await ctx.api('withdraw', 'POST', { game_id: g.id, note: sh.querySelector('#sbN').value }); close(); ctx.toast(r.direct ? 'Abgesagt.' : 'Anfrage gesendet – der Mannschaftsführer meldet sich.'); load(); } catch (e) { sh.querySelector('#sbE').textContent = e.message; } };
      }

      /* ---------- Mannschaftsführer: Aufstellung ---------- */
      /** persönlichen Link eines Gasts teilen: Teilen-Menü des Handys (WhatsApp, Nachrichten …), sonst kopieren */
      async function shareLink(mid) {
        let r; try { r = await ctx.api('lead/extlink', 'POST', { member_id: mid }); } catch (e) { ctx.toast(e.message, true); return; }
        if (!r.link) { ctx.toast('Für den Link braucht die Mitglieder-App eine Adresse von unterwegs – bitte beim Vorstand melden.', true); return; }
        const text = `Hallo ${r.name.split(' ')[0]}, hier kannst du für unsere Spieltage zu- oder absagen: ${r.link}`;
        try { if (navigator.share) { await navigator.share({ title: 'Spieltage', text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
        try { await navigator.clipboard.writeText(text); ctx.toast('Link kopiert – jetzt z. B. in WhatsApp einfügen.'); } catch (e) { ctx.toast(r.link); }
      }
      async function leadSheet(id) {
        let addOpen = false;
        const sh = sheet();
        let v; try { v = await ctx.api('lead/' + id); } catch (e) { ctx.toast(e.message, true); return; }
        const act = async (path, body, msg) => { try { v = await ctx.api('lead/' + path, 'POST', { game_id: id, ...body }); if (msg) ctx.toast(msg); paint(); } catch (e) { ctx.toast(e.message, true); paint(); } };
        const paint = () => {
          const s = v.stats;
          const av = p => (p.elsewhere && !p.role ? `<span class="vh-chip r">spielt in <span translate="no">${esc(p.elsewhere)}</span></span>` : p.state === 'ja' ? `<span class="vh-chip g">kann${p.from ? ' ab ' + esc(p.from) : ''}${p.until ? ' bis ' + esc(p.until) : ''}</span>` : p.state === 'nein' ? '<span class="vh-chip r">kann nicht</span>' : '<span class="vh-chip">offen</span>');
          const seg = p => `<div class="sb-seg">${[['spielt', 'spielt', ''], ['ersatz', 'Ersatz', 'e'], ['', '–', '']].map(([r, l, c]) => `<button data-role="${r}" data-p="${p.id}" class="${(p.role || '') === r ? 'on ' + c : ''}" ${(p.state === 'nein' || (p.elsewhere && !p.role)) && r ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
          const rt = v.kind === 'rahmen';
          const gx = p => (p.ext ? `<div class="sb-wd sb-gx"><span>Gast – für ihn/sie eintragen:</span><span class="vh-yn"><button class="y ${p.state === 'ja' ? 'on' : ''}" data-xa="${p.id}" data-st="ja" aria-label="Kann">✓</button><button class="n ${p.state === 'nein' ? 'on' : ''}" data-xa="${p.id}" data-st="nein" aria-label="Kann nicht">✕</button></span><button class="sb-link" data-xl="${p.id}">Link teilen</button></div>` : '');
          const row = p => `<div class="sb-p ${p.withdraw ? 'wd' : ''}"><span class="rk">${p.inRoster ? esc(p.rank ?? '') : '+'}</span><div style="min-width:0"><strong translate="no">${esc(p.ln)}${p.ext ? ' <span class="vh-chip a">Gast</span>' : ''}</strong><small>${av(p)}${p.note ? ' ' + esc(p.note) : ''}${p.inRoster ? '' : ' · Aushilfe'}</small></div>${rt ? '<span></span>' : seg(p)}${gx(p)}
            ${p.withdraw ? `<div class="sb-wd"><span style="flex:2;font-size:13px;color:var(--amber);font-weight:700;align-self:center">möchte absagen${p.withdraw_note ? ': ' + esc(p.withdraw_note) : ''}</span><button class="vh-btn sm" data-acc="${p.id}">Bestätigen</button><button class="vh-btn sm sec" data-dec="${p.id}">Ablehnen</button></div>` : ''}</div>`;
          const order = [...v.people].sort((a, b) => (a.state === 'ja' ? 0 : a.state ? 2 : 1) - (b.state === 'ja' ? 0 : b.state ? 2 : 1) || (a.rank || 99) - (b.rank || 99));
          sh.innerHTML = `<div class="vh-box"><h2 translate="no">${esc(title(v))}</h2><p>${esc(wd(v.date, true))}, ${esc(deD(v.date))}${v.start ? `, ${esc(v.start)} Uhr` : ''} · ${v.home ? 'Heimspiel' : 'Auswärtsspiel'}</p>
            <div class="sb-line" style="margin:0 0 6px;flex-wrap:wrap;justify-content:flex-start;gap:6px"><span class="vh-chip ${s.ok ? 'g' : 'r'}">${s.yes} von mindestens ${s.min} können</span><span class="vh-chip ${s.lineupOk ? 'g' : 'a'}">${s.playing} spielen · ${s.reserve} Ersatz</span></div>
            ${order.map(row).join('') || '<p>Noch keine Spieler in der Mannschaft.</p>'}
            ${v.helpers.length ? `<div class="vh-cap">Aushilfe aus anderer Mannschaft</div><div class="sb-two" style="grid-template-columns:1fr auto;align-items:start"><select class="vh-select" id="sbH" style="min-height:46px;font-size:15px">${['<option value="">– wählen –</option>', ...v.helpers.map(h => `<option value="${h.id}">${esc(h.ln)} (${esc(h.team)})</option>`)].join('')}</select><button class="sb-link" id="sbHa" style="min-height:46px">als Ersatz</button></div>` : ''}
            <div class="vh-cap">Gastspieler/in</div>
            ${addOpen ? `<div class="sb-two"><div><label>Vorname</label><input class="vh-input" id="gxF" autocomplete="off"></div><div><label>Nachname</label><input class="vh-input" id="gxL" autocomplete="off"></div></div>
              <div class="sb-two"><div><label>Verein (optional)</label><input class="vh-input" id="gxC"></div><div><label>Handy (optional)</label><input class="vh-input" id="gxP" inputmode="tel"></div></div>
              <div class="vh-row" style="margin-bottom:6px"><button class="no" id="gxX">Abbrechen</button><button class="ok" id="gxOk">Anlegen</button></div>`
              : '<button class="vh-btn sec wide" id="gxNew">+ Gastspieler/in anlegen</button><p class="vh-lead" style="margin:6px 0 0">Kein Vereinsmitglied (z. B. Spielgemeinschaft). Gäste antworten über ihren persönlichen Link – oder du trägst oben für sie ein.</p>'}
            ${rt ? '' : `<div class="vh-cap">Treffpunkt & Hinweis</div>
            <div class="sb-two"><div><label>Uhrzeit</label><input class="vh-input" type="time" id="sbMt" value="${esc(v.meet_time || '')}"></div><div><label>Ergebnis</label><input class="vh-input" id="sbR" value="${esc(v.result || '')}" placeholder="z. B. 5:4"></div></div>
            <label>Ort</label><input class="vh-input" id="sbMp" value="${esc(v.meet_place || '')}" placeholder="z. B. Parkplatz Vereinsheim">
            <label>Hinweis an die Mannschaft</label><input class="vh-input" id="sbNo" value="${esc(v.note || '')}" placeholder="optional">
            ${v.tasks ? `<div class="vh-cap">Aufgaben</div>${v.tasks.map(x => `<div class="sb-two" style="grid-template-columns:1fr 1.3fr;align-items:center;margin-bottom:6px"><span style="font-size:14px">${esc(x.label)}</span><select class="vh-select" data-tk="${x.id}" style="min-height:42px;font-size:14.5px;margin:0"><option value="">– offen –</option>${v.people.filter(p => p.state !== 'nein').map(p => `<option value="${p.id}" ${x.member_id === p.id ? 'selected' : ''}>${esc(p.ln)}</option>`).join('')}</select></div>`).join('')}
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 6px">${v.taskKinds.map(k => `<button class="sb-link" data-tka="${esc(k.k)}">+ ${esc(k.l)}</button>`).join('')}</div>` : ''}
            <div class="vh-row" style="margin-top:12px"><button class="no" id="sbSave">Speichern</button><button class="no" id="sbRem" ${s.open ? '' : 'disabled'}>Offene erinnern</button></div>`}
            <div class="vh-row" style="margin-top:8px"><button class="no" id="sbX">Schließen</button>${rt ? '' : `<button class="ok" id="sbSend" ${s.playing ? '' : 'disabled'}>Aufstellung verschicken</button>`}</div></div>`;
          sh.classList.add('show');
          sh.querySelectorAll('[data-role]').forEach(b => { b.onclick = () => act('lineup', { member_id: +b.dataset.p, role: b.dataset.role || null }); });
          sh.querySelectorAll('[data-acc]').forEach(b => { b.onclick = () => act('withdraw', { member_id: +b.dataset.acc, accept: true }, 'Absage bestätigt – bitte Ersatz aufstellen.'); });
          sh.querySelectorAll('[data-dec]').forEach(b => { b.onclick = () => act('withdraw', { member_id: +b.dataset.dec, accept: false }, 'Abgelehnt – der Spieler bleibt aufgestellt.'); });
          sh.querySelectorAll('[data-tk]').forEach(x => { x.onchange = () => act('task', { task_id: +x.dataset.tk, member_id: +x.value || null }); });
          sh.querySelectorAll('[data-tka]').forEach(x => { x.onclick = () => act('task', { kind: x.dataset.tka }); });
          if (sh.querySelector('#sbHa')) sh.querySelector('#sbHa').onclick = () => { const h = +sh.querySelector('#sbH').value; if (h) act('lineup', { member_id: h, role: 'ersatz' }); };
          // Gäste: Verfügbarkeit eintragen, Link teilen (Teilen-Menü des Handys – kein neues Fenster), neu anlegen
          sh.querySelectorAll('[data-xa]').forEach(b => { b.onclick = () => { const p = v.people.find(x => x.id === +b.dataset.xa); act('avail', { member_id: p.id, state: p.state === b.dataset.st ? null : b.dataset.st }); }; });
          sh.querySelectorAll('[data-xl]').forEach(b => { b.onclick = () => shareLink(+b.dataset.xl); });
          if (sh.querySelector('#gxNew')) sh.querySelector('#gxNew').onclick = () => { addOpen = true; paint(); sh.querySelector('#gxF').focus(); };
          if (sh.querySelector('#gxX')) sh.querySelector('#gxX').onclick = () => { addOpen = false; paint(); };
          if (sh.querySelector('#gxOk')) sh.querySelector('#gxOk').onclick = async () => {
            const q = s0 => sh.querySelector(s0).value;
            try { const r = await ctx.api('lead/extern', 'POST', { game_id: id, first_name: q('#gxF'), last_name: q('#gxL'), club: q('#gxC'), phone: q('#gxP') }); v = r; addOpen = false; paint(); ctx.toast('Angelegt – jetzt den Link teilen.'); shareLink(r.ext_id); }
            catch (e) { ctx.toast(e.message, true); }
          };
          if (!sh.querySelector('#sbSave')) { sh.querySelector('#sbX').onclick = () => { close(); load(); }; return; }
          sh.querySelector('#sbSave').onclick = () => act('info', { meet_time: sh.querySelector('#sbMt').value, meet_place: sh.querySelector('#sbMp').value, note: sh.querySelector('#sbNo').value, result: sh.querySelector('#sbR').value }, 'Gespeichert.');
          sh.querySelector('#sbRem').onclick = async () => { try { const r = await ctx.api('lead/remind', 'POST', { game_id: id }); ctx.toast(`${r.n} Spieler erinnert.`); } catch (e) { ctx.toast(e.message, true); } };
          sh.querySelector('#sbSend').onclick = () => act('send', {}, 'Aufstellung verschickt.');
          sh.querySelector('#sbX').onclick = () => { close(); load(); };
        };
        paint();
      }
      el.innerHTML = '<div class="vh-empty">Lade …</div>';
      load();
    },
  });
})();
