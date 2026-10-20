'use strict';
/* Bereich „Spieltage“ in der Mitglieder-App (Modul Spielbetrieb):
   Spieler melden „kann“ / „kann nicht“ (optional ab/bis Uhrzeit), sehen ihre Aufstellung, fragen Absagen an, übernehmen Aufgaben.
   Mannschaftsführer sehen die Ampel und stellen in einem eigenen Fenster auf (nie ein neues Browserfenster). */
(() => {
  if (!document.getElementById('sbStyle')) {
    const s = document.createElement('style'); s.id = 'sbStyle';
    s.textContent = `
      .sb-card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 14px 16px; box-shadow: var(--shadow); }
      .sb-card + .sb-card { margin-top: 12px; }
      .sb-tabs { display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: var(--hover); margin: 0 0 12px; overflow-x: auto; scrollbar-width: none; }
      .sb-tabs button { flex: 1 0 auto; min-height: 40px; border-radius: 11px; border: 0; background: transparent; font: inherit; font-size: 14px; font-weight: 700; color: var(--muted); padding: 0 14px; white-space: nowrap; }
      .sb-tabs button.on { background: var(--card); color: var(--ink); box-shadow: var(--shadow); }
      .sb-head { display: grid; grid-template-columns: 58px minmax(0, 1fr) auto; gap: 12px; align-items: center; }
      .sb-d { width: 58px; height: 56px; border-radius: 14px; background: var(--brand-soft); color: var(--brand-ink); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; line-height: 1.05; }
      .sb-d b { font-size: 16px; letter-spacing: -.02em; } .sb-d span { font-size: 11px; text-transform: uppercase; }
      .sb-head strong { display: block; font-size: 15.5px; line-height: 1.3; } .sb-head small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px; }
      .sb-light { width: 14px; height: 14px; border-radius: 50%; background: var(--line); justify-self: end; }
      .sb-light.g { background: var(--brand); } .sb-light.r { background: var(--red); }
      .sb-ans { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
      .sb-ans button { min-height: 46px; border-radius: 13px; font: inherit; font-size: 15px; font-weight: 700; border: 1px solid var(--line); background: var(--card); color: var(--ink); }
      .sb-ans button.yes.on { background: var(--brand); border-color: var(--brand); color: #fff; }
      .sb-ans button.no.on { background: var(--red); border-color: var(--red); color: #fff; }
      .sb-line { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; font-size: 13.5px; color: var(--muted); }
      .sb-line button, .sb-link { font: inherit; font-size: 13.5px; font-weight: 700; color: var(--brand-ink); background: none; border: 0; padding: 6px 0; }
      .sb-tag { display: inline-block; font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 9px; background: var(--hover); color: var(--muted); }
      .sb-tag.g { background: var(--brand-soft); color: var(--brand-ink); } .sb-tag.a { background: var(--amber-soft); color: var(--amber); } .sb-tag.r { background: var(--red-soft); color: var(--red); }
      .sb-play { margin-top: 12px; padding: 12px; border-radius: 14px; background: var(--brand-soft); }
      .sb-play.wd { background: var(--amber-soft); }
      .sb-play b { display: block; font-size: 15px; color: var(--ink); } .sb-play p { margin: 4px 0 8px; font-size: 13px; color: var(--muted); }
      .sb-play button { min-height: 40px; border-radius: 12px; font: inherit; font-size: 14px; font-weight: 700; border: 1px solid var(--line); background: var(--card); color: var(--ink); padding: 0 14px; }
      .sb-who { margin-top: 10px; font-size: 13px; color: var(--muted); line-height: 1.5; } .sb-who b { color: var(--ink); font-weight: 700; }
      .sb-tasks { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 8px; }
      .sb-tasks > div { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 5px 0; font-size: 14px; }
      .sb-tasks button { min-height: 36px; border-radius: 11px; font: inherit; font-size: 13.5px; font-weight: 700; border: 1px solid var(--brand); background: var(--brand); color: #fff; padding: 0 12px; }
      .sb-tasks button.sec { background: transparent; border-color: var(--line); color: var(--ink); }
      .sb-lead { margin-top: 12px; width: 100%; min-height: 46px; border-radius: 13px; font: inherit; font-size: 15px; font-weight: 700; border: 1px solid var(--brand); background: transparent; color: var(--brand-ink); }
      .sb-intro { font-size: 14px; color: var(--muted); line-height: 1.45; margin: 0 0 10px; }
      .sb-bulk { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
      .sb-bulk button { min-height: 42px; border-radius: 12px; font: inherit; font-size: 14px; font-weight: 700; border: 1px solid var(--line); background: var(--card); color: var(--ink); }
      .sb-sheet .vh-box { max-width: 520px; text-align: left; padding: 20px 16px 16px; }
      .sb-sheet label { display: block; font-size: 13px; font-weight: 700; color: var(--muted); margin: 0 0 4px; }
      .sb-sheet .vh-input { font-size: 16px; min-height: 48px; }
      .sb-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .sb-p { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 9px 0; border-top: 1px solid var(--line); }
      .sb-p:first-of-type { border-top: 0; }
      .sb-p .rk { font-size: 12.5px; font-weight: 800; color: var(--muted); text-align: right; }
      .sb-p strong { display: block; font-size: 14.5px; } .sb-p small { display: block; font-size: 12px; color: var(--muted); margin-top: 1px; }
      .sb-seg { display: flex; gap: 3px; padding: 3px; border-radius: 11px; background: var(--hover); }
      .sb-seg button { min-height: 34px; min-width: 44px; border-radius: 9px; border: 0; background: transparent; font: inherit; font-size: 12.5px; font-weight: 800; color: var(--muted); padding: 0 8px; }
      .sb-seg button.on { background: var(--brand); color: #fff; } .sb-seg button.on.e { background: var(--amber); }
      .sb-p.wd { background: var(--amber-soft); margin: 0 -16px; padding: 9px 16px; }
      .sb-wd { grid-column: 2 / -1; display: flex; gap: 8px; margin-top: 6px; }
      .sb-wd button { flex: 1; min-height: 38px; border-radius: 11px; font: inherit; font-size: 13.5px; font-weight: 700; border: 1px solid var(--line); background: var(--card); color: var(--ink); }
      .sb-wd button.ok { background: var(--brand); border-color: var(--brand); color: #fff; }
      .sb-sec { font-size: 13px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin: 16px 0 4px; }`;
    document.head.appendChild(s);
  }
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const wd = (d, long) => (long ? WDL : WD)[new Date(d + 'T12:00:00').getDay()];
  const deD = d => (d ? d.split('-').reverse().join('.') : '');
  const title = g => `${g.team} ${g.home ? 'gegen' : 'bei'} ${g.opponent}`;

  window.VA.registerSection({
    id: 'spielbetrieb',
    render(el, ctx) {
      const { esc } = ctx;
      let d = null, tab = 'alle';
      const sheet = () => { let sh = document.getElementById('sbSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'sbSheet'; sh.className = 'vh-sheet sb-sheet'; document.body.appendChild(sh); } return sh; };
      const close = () => { const s = document.getElementById('sbSheet'); if (s) s.classList.remove('show'); };
      ctx.onLeave(close);

      async function load() {
        try { d = await ctx.api('me'); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        draw();
      }
      function draw() {
        const teams = d.teams;
        if (!teams.some(t => String(t.id) === tab)) tab = 'alle';
        const games = d.games.filter(g => tab === 'alle' || String(g.team_id) === tab).filter(g => !g.past || g.date === d.today);
        // Saisonstart: noch offene Spieltage je Mannschaft mit einem Tipp beantworten
        const openBy = {}; d.games.filter(g => g.mine && !g.past && g.status === 'geplant' && !(g.me && g.me.state)).forEach(g => { openBy[g.team_id] = (openBy[g.team_id] || 0) + 1; });
        const bulk = teams.filter(t => t.player && openBy[t.id] >= 3 && (tab === 'alle' || String(t.id) === tab));
        el.innerHTML = `${teams.length > 1 ? `<div class="sb-tabs">${[['alle', 'Alle'], ...teams.map(t => [String(t.id), t.name])].map(([k, l]) => `<button data-tab="${esc(k)}" class="${k === tab ? 'on' : ''}" translate="no">${esc(l)}</button>`).join('')}</div>` : ''}
          ${bulk.map(t => `<div class="sb-card"><p class="sb-intro"><b translate="no">${esc(t.name)}</b>: Für ${openBy[t.id]} Spieltage hast du noch nichts gemeldet. Einzelne Termine kannst du danach jederzeit ändern.</p>
            <div class="sb-bulk"><button data-bulk="${t.id}" data-st="ja">Bei allen: kann</button><button data-bulk="${t.id}" data-st="nein">Bei allen: kann nicht</button></div></div>`).join('')}
          ${games.length ? games.map(card).join('') : `<div class="vh-empty">Keine anstehenden Spieltage${tab === 'alle' ? '' : ' für diese Mannschaft'}.</div>`}
          ${d.played ? `<p class="vh-empty" style="padding:14px 0 0">In dieser Saison hast du ${d.played}-mal gespielt.</p>` : ''}`;
        el.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { tab = b.dataset.tab; draw(); }; });
        el.querySelectorAll('[data-ans]').forEach(b => { b.onclick = () => answer(+b.dataset.g, b.dataset.ans); });
        el.querySelectorAll('[data-time]').forEach(b => { b.onclick = () => timeSheet(d.games.find(g => g.id === +b.dataset.time)); });
        el.querySelectorAll('[data-wd]').forEach(b => { b.onclick = () => withdrawSheet(d.games.find(g => g.id === +b.dataset.wd)); });
        el.querySelectorAll('[data-wdc]').forEach(b => { b.onclick = () => run(() => ctx.api('withdraw', 'POST', { game_id: +b.dataset.wdc, cancel: true }), 'Absage zurückgenommen – du bleibst aufgestellt.'); });
        el.querySelectorAll('[data-tk]').forEach(b => { b.onclick = () => run(() => ctx.api('task', 'POST', { task_id: +b.dataset.tk, take: b.dataset.take === '1' }), b.dataset.take === '1' ? 'Übernommen – danke!' : 'Abgegeben.'); });
        el.querySelectorAll('[data-lead]').forEach(b => { b.onclick = () => leadSheet(+b.dataset.lead); });
        el.querySelectorAll('[data-bulk]').forEach(b => { b.onclick = () => run(() => ctx.api('avail/all', 'POST', { team_id: +b.dataset.bulk, state: b.dataset.st }), 'Gemeldet – danke!'); });
      }
      function card(g) {
        const me = g.me || {}, s = g.stats, cancelled = g.status === 'abgesagt';
        const lt = cancelled ? '' : s.ok ? 'g' : 'r';
        const meet = [g.meet_time ? `Treffpunkt ${g.meet_time} Uhr` : '', g.meet_place || ''].filter(Boolean).join(' · ');
        const yes = (g.people || []).filter(p => p.state === 'ja'), play = (g.people || []).filter(p => p.role === 'spielt'), res = (g.people || []).filter(p => p.role === 'ersatz');
        const names = l => l.map(p => esc(p.short || p.ln)).join(', ');
        let mine = '';
        if (cancelled) mine = '<div class="sb-play wd"><b>Abgesagt</b><p>Dieser Spieltag findet nicht statt.</p></div>';
        else if (me.role === 'spielt' && me.withdraw) mine = `<div class="sb-play wd"><b>Du spielst – Absage angefragt</b><p>Der Mannschaftsführer muss die Absage bestätigen und Ersatz einplanen. Bis dahin bist du aufgestellt.</p><button data-wdc="${g.id}">Absage zurücknehmen</button></div>`;
        else if (me.role === 'spielt') mine = `<div class="sb-play"><b>Du spielst</b><p>${esc(meet || 'Der Mannschaftsführer schickt Treffpunkt und Aufstellung.')}</p><button data-wd="${g.id}">Kann doch nicht – Absage anfragen</button></div>`;
        else if (me.role === 'ersatz') mine = `<div class="sb-play"><b>Du bist Ersatz</b><p>${esc(meet || 'Halte dich bitte bereit.')}</p><button data-wd="${g.id}">Kann doch nicht</button></div>`;
        const answerable = g.mine && !cancelled && !g.past && me.role !== 'spielt';
        const tasks = d.settings.tasks && g.tasks && g.tasks.length && g.mine && !cancelled ? `<div class="sb-tasks">${g.tasks.map(x => `<div><span>${esc(x.label)}${x.who ? ` · <b translate="no">${esc(x.who)}</b>` : ''}</span>${x.member_id === null && !(g.me && g.me.state === 'nein') ? `<button data-tk="${x.id}" data-take="1">Übernehme ich</button>` : x.mine ? `<button class="sec" data-tk="${x.id}" data-take="0">Abgeben</button>` : ''}</div>`).join('')}</div>` : '';
        return `<div class="sb-card"><div class="sb-head"><div class="sb-d"><b>${esc(g.date.slice(8, 10))}.${esc(g.date.slice(5, 7))}.</b><span>${esc(wd(g.date))}</span></div>
            <div style="min-width:0"><strong translate="no">${esc(title(g))}</strong><small>${esc([g.start ? `${g.start} Uhr` : '', g.home ? 'Heimspiel' : 'Auswärtsspiel', g.league].filter(Boolean).join(' · '))}</small>${!g.home && g.venue ? `<small translate="no">${esc(g.venue)}</small>` : ''}</div>
            ${g.lead ? `<span class="sb-light ${lt}" title="${s.ok ? 'genug Spieler' : 'zu wenige Spieler'}"></span>` : '<span></span>'}</div>
          ${mine}
          ${answerable ? `<div class="sb-ans"><button class="yes ${me.state === 'ja' ? 'on' : ''}" data-ans="ja" data-g="${g.id}">Kann</button><button class="no ${me.state === 'nein' ? 'on' : ''}" data-ans="nein" data-g="${g.id}">Kann nicht</button></div>
            ${me.state === 'ja' && d.settings.times ? `<div class="sb-line"><span>${me.from || me.until ? esc([me.from ? `ab ${me.from}` : '', me.until ? `bis ${me.until}` : ''].filter(Boolean).join(' ') + ' Uhr') : 'den ganzen Spieltag'}</span><button data-time="${g.id}">Uhrzeit angeben</button></div>` : ''}
            ${!me.state ? '<div class="sb-line"><span>Bitte melde dich für diesen Spieltag.</span></div>' : ''}` : ''}
          ${!cancelled && (d.settings.seeAvail || d.settings.seeLineup || g.lead) ? `<div class="sb-who">${play.length && (d.settings.seeLineup || g.lead) ? `<div>Aufgestellt: <b translate="no">${names(play)}</b>${res.length ? ` · Ersatz: <span translate="no">${names(res)}</span>` : ''}</div>` : ''}${d.settings.seeAvail || g.lead ? `<div>${yes.length ? `Können (${yes.length}): <span translate="no">${names(yes)}</span>` : 'Noch keine Zusagen.'}</div>` : ''}</div>` : ''}
          ${tasks}
          ${g.lead && !cancelled ? `<button class="sb-lead" data-lead="${g.id}">Aufstellung · ${s.yes} von ${s.min} können${s.open ? ` · ${s.open} offen` : ''}${s.withdraws ? ` · ${s.withdraws} Absage-Anfrage` : ''}</button>` : ''}</div>`;
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
      async function leadSheet(id) {
        const sh = sheet();
        let v; try { v = await ctx.api('lead/' + id); } catch (e) { ctx.toast(e.message, true); return; }
        const act = async (path, body, msg) => { try { v = await ctx.api('lead/' + path, 'POST', { game_id: id, ...body }); if (msg) ctx.toast(msg); paint(); } catch (e) { ctx.toast(e.message, true); paint(); } };
        const paint = () => {
          const s = v.stats;
          const av = p => (p.state === 'ja' ? `<span class="sb-tag g">kann${p.from ? ' ab ' + esc(p.from) : ''}${p.until ? ' bis ' + esc(p.until) : ''}</span>` : p.state === 'nein' ? '<span class="sb-tag r">kann nicht</span>' : '<span class="sb-tag">offen</span>');
          const seg = p => `<div class="sb-seg">${[['spielt', 'spielt', ''], ['ersatz', 'Ersatz', 'e'], ['', '–', '']].map(([r, l, c]) => `<button data-role="${r}" data-p="${p.id}" class="${(p.role || '') === r ? 'on ' + c : ''}" ${p.state === 'nein' && r ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
          const row = p => `<div class="sb-p ${p.withdraw ? 'wd' : ''}"><span class="rk">${p.inRoster ? esc(p.rank ?? '') : '+'}</span><div style="min-width:0"><strong translate="no">${esc(p.ln)}</strong><small>${av(p)}${p.note ? ' ' + esc(p.note) : ''}${p.inRoster ? '' : ' · Aushilfe'}</small></div>${seg(p)}
            ${p.withdraw ? `<div class="sb-wd"><span style="flex:2;font-size:13px;color:var(--amber);font-weight:700;align-self:center">möchte absagen${p.withdraw_note ? ': ' + esc(p.withdraw_note) : ''}</span><button class="ok" data-acc="${p.id}">Bestätigen</button><button data-dec="${p.id}">Ablehnen</button></div>` : ''}</div>`;
          const order = [...v.people].sort((a, b) => (a.state === 'ja' ? 0 : a.state ? 2 : 1) - (b.state === 'ja' ? 0 : b.state ? 2 : 1) || (a.rank || 99) - (b.rank || 99));
          sh.innerHTML = `<div class="vh-box"><h2 translate="no">${esc(title(v))}</h2><p>${esc(wd(v.date, true))}, ${esc(deD(v.date))}${v.start ? `, ${esc(v.start)} Uhr` : ''} · ${v.home ? 'Heimspiel' : 'Auswärtsspiel'}</p>
            <div class="sb-line" style="margin:0 0 6px"><span class="sb-tag ${s.ok ? 'g' : 'r'}">${s.yes} von mindestens ${s.min} können</span><span class="sb-tag ${s.lineupOk ? 'g' : 'a'}">${s.playing} spielen · ${s.reserve} Ersatz</span></div>
            ${order.map(row).join('') || '<p>Noch keine Spieler in der Mannschaft.</p>'}
            ${v.helpers.length ? `<div class="sb-sec">Aushilfe aus anderer Mannschaft</div><div class="sb-two" style="grid-template-columns:1fr auto;align-items:start"><select class="vh-select" id="sbH" style="min-height:46px;font-size:15px">${['<option value="">– wählen –</option>', ...v.helpers.map(h => `<option value="${h.id}">${esc(h.ln)} (${esc(h.team)})</option>`)].join('')}</select><button class="sb-link" id="sbHa" style="min-height:46px">als Ersatz</button></div>` : ''}
            <div class="sb-sec">Treffpunkt & Hinweis</div>
            <div class="sb-two"><div><label>Uhrzeit</label><input class="vh-input" type="time" id="sbMt" value="${esc(v.meet_time || '')}"></div><div><label>Ergebnis</label><input class="vh-input" id="sbR" value="${esc(v.result || '')}" placeholder="z. B. 5:4"></div></div>
            <label>Ort</label><input class="vh-input" id="sbMp" value="${esc(v.meet_place || '')}" placeholder="z. B. Parkplatz Vereinsheim">
            <label>Hinweis an die Mannschaft</label><input class="vh-input" id="sbNo" value="${esc(v.note || '')}" placeholder="optional">
            ${v.tasks ? `<div class="sb-sec">Aufgaben</div>${v.tasks.map(x => `<div class="sb-two" style="grid-template-columns:1fr 1.3fr;align-items:center;margin-bottom:6px"><span style="font-size:14px">${esc(x.label)}</span><select class="vh-select" data-tk="${x.id}" style="min-height:42px;font-size:14.5px;margin:0"><option value="">– offen –</option>${v.people.filter(p => p.state !== 'nein').map(p => `<option value="${p.id}" ${x.member_id === p.id ? 'selected' : ''}>${esc(p.ln)}</option>`).join('')}</select></div>`).join('')}
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 6px">${v.taskKinds.map(k => `<button class="sb-link" data-tka="${esc(k.k)}">+ ${esc(k.l)}</button>`).join('')}</div>` : ''}
            <div class="vh-row" style="margin-top:12px"><button class="no" id="sbSave">Speichern</button><button class="no" id="sbRem" ${s.open ? '' : 'disabled'}>Offene erinnern</button></div>
            <div class="vh-row" style="margin-top:8px"><button class="no" id="sbX">Schließen</button><button class="ok" id="sbSend" ${s.playing ? '' : 'disabled'}>Aufstellung verschicken</button></div></div>`;
          sh.classList.add('show');
          sh.querySelectorAll('[data-role]').forEach(b => { b.onclick = () => act('lineup', { member_id: +b.dataset.p, role: b.dataset.role || null }); });
          sh.querySelectorAll('[data-acc]').forEach(b => { b.onclick = () => act('withdraw', { member_id: +b.dataset.acc, accept: true }, 'Absage bestätigt – bitte Ersatz aufstellen.'); });
          sh.querySelectorAll('[data-dec]').forEach(b => { b.onclick = () => act('withdraw', { member_id: +b.dataset.dec, accept: false }, 'Abgelehnt – der Spieler bleibt aufgestellt.'); });
          sh.querySelectorAll('[data-tk]').forEach(x => { x.onchange = () => act('task', { task_id: +x.dataset.tk, member_id: +x.value || null }); });
          sh.querySelectorAll('[data-tka]').forEach(x => { x.onclick = () => act('task', { kind: x.dataset.tka }); });
          if (sh.querySelector('#sbHa')) sh.querySelector('#sbHa').onclick = () => { const h = +sh.querySelector('#sbH').value; if (h) act('lineup', { member_id: h, role: 'ersatz' }); };
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
