'use strict';
/* Spieltage für Gastspieler/innen (kein Vereinsmitglied): persönlicher Link /p/spielbetrieb/#t=<token> – ohne App, ohne PIN.
   Je Tag eine Zeile mit ✓/✕; die Antwort sieht der Mannschaftsführer sofort. Bausteine aus kit.css (Styleguide). */
(() => {
  const el = document.getElementById('sec');
  const tok = (location.hash.match(/[#&]t=([A-Za-z0-9_-]{20,40})/) || [])[1] || '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const wd = d => WD[new Date(d + 'T12:00:00').getDay()];
  const toast = (t, err) => { const x = document.getElementById('toast'); x.textContent = t; x.className = 'vh-toast show' + (err ? ' err' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => { x.className = 'vh-toast'; }, 2600); };
  const logo = document.getElementById('logo');
  logo.onload = () => document.getElementById('logoBox').classList.remove('hidden');
  logo.src = '../../logo';
  const api = async (method, body) => {
    let r; try { r = await fetch('../../api/p/spielbetrieb/g/' + tok, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
    catch (e) { throw new Error('Keine Verbindung – bitte gleich noch einmal versuchen.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Das hat nicht geklappt.');
    return d;
  };
  let d = null;
  const title = g => (g.kind === 'rahmen' ? `${g.team} · ${g.za ? 'Zusatz-/Ausweichtermin' : 'Rahmentermin'}` : `${g.team} ${g.home ? 'gegen' : 'bei'} ${g.opponent}`);
  const answerable = g => g.status === 'geplant' && g.role !== 'spielt' && !g.elsewhere;
  function draw() {
    document.getElementById('club').textContent = d.club;
    document.getElementById('who').textContent = d.name;
    document.title = `Spieltage – ${d.club}`;
    const byDay = new Map(); d.games.forEach(g => { if (!byDay.has(g.date)) byDay.set(g.date, []); byDay.get(g.date).push(g); });
    const open = d.games.filter(g => answerable(g) && !g.state);
    const row = (day, gs) => {
      const ans = gs.filter(answerable), sts = ans.map(g => g.state || null);
      const all = sts.length && sts.every(s => s === sts[0]) ? sts[0] : null;
      const plays = gs.find(g => g.role === 'spielt'), res = gs.find(g => g.role === 'ersatz');
      const sub = plays ? `Du spielst${plays.meet_time ? ` · Treffpunkt ${plays.meet_time} Uhr` : ''}${plays.meet_place ? ` · ${plays.meet_place}` : ''}`
        : gs[0].kind === 'rahmen' ? 'vorläufig' : gs.map(g => `${g.start ? g.start + ' Uhr · ' : ''}${g.home ? 'Heim' : 'auswärts'}${!g.home && g.venue ? ' · ' + g.venue : ''}`).join(' · ');
      const right = gs.some(g => g.status === 'abgesagt') && !ans.length ? '<span class="vh-chip">abgesagt</span>'
        : plays ? '<span class="vh-chip g">spielt</span>' : gs.every(g => g.elsewhere) ? `<span class="vh-chip">spielt in ${esc(gs[0].elsewhere)}</span>`
        : `<span class="vh-yn"><button class="y ${all === 'ja' ? 'on' : ''}" data-day="${day}" data-st="ja" aria-label="Kann">✓</button><button class="n ${all === 'nein' ? 'on' : ''}" data-day="${day}" data-st="nein" aria-label="Kann nicht">✕</button></span>`;
      return `<div><span class="vh-date"><b>${day.slice(8, 10)}.${day.slice(5, 7)}.</b><span>${wd(day)}</span></span>
        <span class="vh-tx"><strong>${esc(gs.map(title).join(' + '))}</strong><small>${esc(sub)}${res && !plays ? ' · als Ersatz eingeplant' : ''}${!all && ans.length ? ' · <b style="color:var(--amber)">offen</b>' : ''}</small></span>${right}</div>`;
    };
    const caps = d.teams.filter(t => t.captain).map(t => `${t.team}: ${t.captain}`).join(' · ');
    el.innerHTML = `<div class="vh-card"><h3>Hallo ${esc(d.name.split(' ')[0])}!</h3>
        <p class="vh-lead">Bitte bei jedem Termin melden: <b>✓</b> ich kann · <b>✕</b> ich kann nicht. Deine Antwort sieht der Mannschaftsführer sofort${caps ? ` (${esc(caps)})` : ''}. Diese Seite ist nur für dich – den Link bitte nicht weitergeben.</p></div>
      ${open.length >= 3 ? `<div class="vh-bar a"><span><b>${open.length} offen</b></span><button data-all="ja">Alle ✓</button><button data-all="nein">Alle ✕</button></div>` : ''}
      ${d.games.length ? `<div class="vh-card flush"><div class="vh-rows">${[...byDay.entries()].map(([day, gs]) => row(day, gs)).join('')}</div></div>` : '<div class="vh-empty">Gerade keine anstehenden Spieltage.</div>'}`;
    el.querySelectorAll('[data-day]').forEach(b => { b.onclick = () => send(d.games.filter(g => g.date === b.dataset.day && answerable(g)), b.dataset.st); });
    el.querySelectorAll('[data-all]').forEach(b => { b.onclick = () => send(open, b.dataset.all, true); });
  }
  async function send(gs, st, bulk) {
    if (!gs.length) return;
    const same = !bulk && gs.every(g => g.state === st);   // nochmal tippen = zurücknehmen
    try { d = await api('POST', { game_ids: gs.map(g => g.id), state: same ? null : st }); draw(); toast(same ? 'Zurückgenommen.' : 'Gemeldet – danke!'); }
    catch (e) { toast(e.message, true); }
  }
  if (!tok) { el.innerHTML = '<div class="vh-empty">Dieser Link ist unvollständig. Bitte beim Mannschaftsführer einen neuen holen.</div>'; return; }
  api('GET').then(x => { d = x; draw(); }).catch(e => { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; });
})();
