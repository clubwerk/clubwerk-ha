'use strict';
/* Monitor des Turnierplaners ohne Anmeldung: /p/turniere/monitor.html#k=<Zufallsschlüssel> (über den Server der Mitglieder-App), nur lesend.
   Am Fernseher wechselt die Anzeige alle 12 Sekunden zwischen „Jetzt“ (laufende Spiele mit Restzeit), „Als Nächstes“, Tabellen,
   Turnierbaum und Ergebnissen; sie lädt alle 15 Sekunden neu. Am Handy steht alles untereinander; mit „&t=<Mannschaft>“ (QR-Code
   der Mannschaft) zuerst das eigene nächste Spiel, die eigenen Spiele und die eigene Gruppe. Der Schlüssel steht hinter „#“
   und geht so nie in Protokolle oder Verweise. */
(() => {
  const $ = id => document.getElementById(id);
  const hash = location.hash;
  const key = (hash.match(/[#&]k=([A-Za-z0-9_-]{32})/) || [])[1] || '';
  const me = +((hash.match(/[#&]t=(\d+)/) || [])[1] || 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (t, v) => (window.T ? window.T(t, v) : String(t).replace(/\{(\d+)\}/g, (m, i) => (v && v[i] != null ? v[i] : m)));
  const pad = n => String(n).padStart(2, '0');
  const phone = () => window.matchMedia('(max-width: 760px)').matches;
  let d = null, at = 0, idx = 0, cur = '', timer = null, failCount = 0;
  const clock = () => { const n = new Date(); $('mClock').textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}`; };
  const side = (m, s) => m[s] || m[s + '_ph'] || T('offen');
  const mine = m => me && [...(m.a_ids || []), ...(m.b_ids || [])].includes(me);
  const courtWord = () => T(d.cfg.court === 'Spielfeld' ? 'Spielfeld' : d.cfg.court === 'Feld' ? 'Feld' : 'Platz');
  /** Ergebnis aus Sicht von a: „2:1“, „1:1, n. N. 4:3“, „6:4 3:6 10:7“ */
  const score = m => (m.sets && m.sets.length ? m.sets.map(x => x.join(':')).join(' ') : `${m.score_a}:${m.score_b}`);
  const dec = m => (m.decider ? `${m.decider.kind === 'nm' ? T('n. N.') : T('Tiebreak')} ${m.decider.a}:${m.decider.b}` : m.result === 'wo' ? T('w. o.') : m.result === 'aufgabe' ? T('Aufgabe') : '');
  const leftTxt = l => (l > 0 ? `${Math.floor(l / 60)}:${pad(l % 60)}` : `+${Math.floor(-l / 60)}:${pad(-l % 60)}`);

  /* ---------- Bausteine ---------- */
  /** Spalten für die Plätze: bis 4 in einer Reihe, sonst Reihen möglichst gleich voll (6 → 3 + 3, 8 → 4 + 4) */
  const cols = n => (n <= 4 ? Math.max(1, n) : n % 4 === 0 ? 4 : n % 3 === 0 ? 3 : 4);
  function courtsHtml() {
    return `<div class="mon-courts" style="--n:${cols(d.courts.length)}">${d.courts.map(c => `<div class="mon-card mon-court${c.running && mine(c.running) ? ' me' : ''}"><h3>${esc(c.name)}${c.running ? `<small>${esc(c.running.label)}</small>` : ''}</h3>
      ${c.running ? `<div class="mon-vs"><b translate="no">${esc(side(c.running, 'a'))}</b><span>${esc(T('gegen'))}</span><b translate="no">${esc(side(c.running, 'b'))}</b></div>
        <div class="mon-left" data-left="${c.running.left == null ? '' : c.running.left}"></div>` : `<div class="mon-free">${esc(T('frei'))}</div>`}
      ${c.next ? `<div class="mon-next">${esc(T('danach'))} <span class="n">${esc(c.next.est || '')}</span> · <span translate="no">${esc(`${side(c.next, 'a')} – ${side(c.next, 'b')}`)}</span></div>` : ''}</div>`).join('')}</div>`;
  }
  const row = m => `<div class="mon-row"><span class="tm">${esc(m.est || m.time || '–')}</span><span class="ct">${esc(m.court || T('Warteschlange'))}</span>
    <span class="vs" translate="no">${esc(`${side(m, 'a')} – ${side(m, 'b')}`)}<small translate="yes">${esc(m.label)}${m.delay >= 5 ? ` · +${m.delay} min` : ''}</small></span><span></span></div>`;
  const resRow = m => `<div class="mon-row res"><span class="vs" translate="no">${esc(`${side(m, 'a')} – ${side(m, 'b')}`)}<small translate="yes">${esc(m.label)}</small></span><span class="sc">${esc(score(m))}${dec(m) ? `<small>${esc(dec(m))}</small>` : ''}</span></div>`;
  function table(g) {
    const sets = g.table.some(r => r.sets);
    return `<table class="mon-tab"><colgroup><col class="r"><col><col class="z"><col class="w"><col class="z"><col class="p"></colgroup>
      <thead><tr><th class="r">#</th><th class="n">${esc(T('Name'))}</th><th>${esc(T('Sp.'))}</th><th>${esc(T(sets ? 'Sätze' : d.unit))}</th><th>${esc(T(sets ? 'S' : 'Diff.'))}</th><th>${esc(T('Pkt.'))}</th></tr></thead>
      <tbody>${g.table.map(r => `<tr class="${r.rank <= g.up && g.done ? 'up' : ''}${r.id === me ? ' me' : ''}"><td class="r">${r.rank}</td><td class="n" translate="no">${esc(r.name)}</td><td>${r.played}</td><td>${esc(sets ? r.sets : r.games)}</td><td>${sets ? r.won : (r.diff > 0 ? '+' : '') + r.diff}</td><td class="p">${r.pts}</td></tr>`).join('')}</tbody></table>`;
  }
  const groupCard = g => `<div class="mon-card"><h3>${esc(d.groups.length > 1 ? T(g.label) : T('Tabelle'))}</h3>${table(g)}</div>`;
  function rankingHtml() {
    return `<div class="mon-card"><table class="mon-tab"><colgroup><col class="r"><col><col class="z"><col class="z"><col class="w"></colgroup>
      <thead><tr><th class="r">#</th><th class="n">${esc(T('Name'))}</th><th>${esc(T('Sp.'))}</th><th>${esc(T('S'))}</th><th>${esc(T(d.unit))}</th></tr></thead>
      <tbody>${d.ranking.map(r => `<tr class="${r.id === me ? 'me' : ''}"><td class="r">${r.rank}</td><td class="n" translate="no">${esc(r.name)}</td><td>${r.played}</td><td>${r.won}</td><td class="p">${r.for}:${r.against}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function box(m) {
    const n = (s, w) => (m[s] ? `<b class="${m.winner === w ? 'w' : ''}" translate="no">${esc(m[s])}</b>` : `<b class="ph">${esc(side(m, s))}</b>`);
    const v = s => (m.done && !m.bye ? (m.sets && m.sets.length ? m.sets.map(x => x[s === 'a' ? 0 : 1]).join(' ') : s === 'a' ? m.score_a : m.score_b) : '');
    const sub = m.bye ? T('Freilos') : m.done ? dec(m) : m.running ? T('läuft') : m.est ? T('{0} Uhr', [m.est]) : '';
    return `<div class="mon-m${mine(m) ? ' me' : ''}">${n('a', 'a')}<span>${esc(v('a'))}</span>${n('b', 'b')}<span>${esc(v('b'))}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  }
  function treeHtml() {
    return `<div class="mon-tree" style="--r:${d.ko.length}">${d.ko.map(r => `<div><h4>${esc(T(r.label))}</h4><div class="ms">${r.matches.map(box).join('')}</div></div>`).join('')}</div>
      ${d.third ? `<div class="mon-tree" style="--r:${d.ko.length};margin-top:calc(var(--s) * 12px)"><div><h4>${esc(T('Spiel um Platz 3'))}</h4>${box(d.third)}</div></div>` : ''}`;
  }
  const podium = () => `<div class="mon-card"><div class="mon-pod">${d.ft.podium.map(p => `<div><b>${p.place}.</b><span translate="no">${esc(p.name)}</span></div>`).join('')}</div></div>`;

  /* ---------- Seiten am Fernseher ---------- */
  function screens() {
    const out = [];
    if (!d.drawn) return [{ key: 'leer', title: '', html: `<div class="mon-empty">${esc(T('Noch nicht ausgelost – der Spielplan erscheint hier von selbst.'))}</div>` }];
    if (d.ft.finished && d.ft.podium.length) out.push({ key: 'sieger', title: T('Sieger'), html: podium() });
    if (d.courts.some(c => c.running || c.next)) out.push({ key: 'jetzt', title: T('Jetzt'), html: courtsHtml() });
    const up = d.upcoming.filter(m => !m.running).slice(0, 9);
    if (up.length) out.push({ key: 'naechste', title: T('Als Nächstes'), html: `<div class="mon-card"><div class="mon-rows">${up.map(row).join('')}</div></div>` });
    if (d.ranking) out.push({ key: 'rang', title: T('Rangliste'), html: rankingHtml() });
    const per = d.groups.length > 4 ? 4 : d.groups.length;
    for (let i = 0; i < d.groups.length; i += per || 1) {
      const gs = d.groups.slice(i, i + per);
      out.push({ key: `gr${i}`, title: d.groups.length > 1 ? (gs.length > 1 ? `${T(gs[0].label)} – ${T(gs[gs.length - 1].label)}` : T(gs[0].label)) : T('Tabelle'), html: `<div class="mon-groups" style="--c:${Math.min(2, gs.length)}">${gs.map(groupCard).join('')}</div>` });
    }
    if (d.ko.length) out.push({ key: 'baum', title: T(d.ft.format === 'ko' ? 'Turnierbaum' : 'Endrunde'), html: treeHtml() });
    const res = d.results.slice(0, 8);
    if (res.length) out.push({ key: 'erg', title: T('Letzte Ergebnisse'), html: `<div class="mon-card"><div class="mon-rows">${res.map(resRow).join('')}</div></div>` });
    return out.length ? out : [{ key: 'leer', title: '', html: `<div class="mon-empty">${esc(T('Gerade steht nichts an.'))}</div>` }];
  }
  /** Schrift so groß wie möglich: von groß nach klein, bis die Seite ohne Scrollen auf den Bildschirm passt (und Breite nicht überläuft) */
  function fit() {
    const box_ = $('mon'), over = () => box_.scrollHeight > box_.clientHeight + 2 || box_.scrollWidth > box_.clientWidth + 2;
    let s = 1.4;
    document.body.style.setProperty('--s', s);
    while (s > 0.5 && over()) { s -= 0.05; document.body.style.setProperty('--s', s.toFixed(2)); }
  }
  function showTv() {
    const list = screens();
    let i = list.findIndex(x => x.key === cur); if (i < 0) i = idx % list.length;
    const sc = list[i]; cur = sc.key; idx = i;
    $('mon').innerHTML = `<section class="mon-sec">${sc.title ? `<h2>${esc(sc.title)}</h2>` : ''}${sc.html}</section>`;
    $('mPage').innerHTML = list.length > 1 ? list.map((x, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('') : '';
    countdown(); fit();
  }
  function next() { const list = d ? screens() : []; if (list.length < 2) return; idx = (idx + 1) % list.length; cur = list[idx].key; showTv(); }
  /* ---------- Handy: alles untereinander, die eigene Mannschaft zuerst ---------- */
  function showPhone() {
    if (!d.drawn) { $('mon').innerHTML = `<div class="mon-empty">${esc(T('Noch nicht ausgelost – der Spielplan erscheint hier von selbst.'))}</div>`; return; }
    const team = me && d.teams.find(t => t.id === me);
    const all = [...d.courts.map(c => c.running).filter(Boolean), ...d.upcoming, ...d.results];
    const my = team ? all.filter(mine).filter((m, i, a) => a.findIndex(x => x.id === m.id) === i) : [];
    const myNext = my.find(m => !m.done);
    const myGroup = team && d.groups.find(g => g.table.some(r => r.id === me));
    const parts = [];
    if (team) {
      parts.push(`<section class="mon-sec"><h2 translate="no">${esc(team.name)}</h2>${myNext ? `<div class="mon-card"><h3>${esc(myNext.running ? T('Läuft gerade') : T('Euer nächstes Spiel'))}<small>${esc(myNext.label)}</small></h3>
        <div class="mon-vs"><b translate="no">${esc(side(myNext, 'a'))}</b><span>${esc(T('gegen'))}</span><b translate="no">${esc(side(myNext, 'b'))}</b></div>
        ${myNext.running ? `<div class="mon-left" data-left="${myNext.left == null ? '' : myNext.left}"></div>` : `<div class="mon-next"><span class="n">${esc(myNext.est || '–')}</span> ${esc(T('Uhr'))} · ${esc(myNext.court || T('Platz folgt'))}</div>`}</div>`
        : `<div class="mon-card"><p class="mon-free" style="margin:0">${esc(T('Gerade steht kein Spiel für euch an.'))}</p></div>`}
        ${my.length ? `<div class="mon-card"><h3>${esc(T('Eure Spiele'))}</h3><div class="mon-rows">${my.map(m => (m.done ? resRow(m) : row(m))).join('')}</div></div>` : ''}${myGroup ? groupCard(myGroup) : ''}</section>`);
    }
    if (d.ft.finished && d.ft.podium.length) parts.push(`<section class="mon-sec"><h2>${esc(T('Sieger'))}</h2>${podium()}</section>`);
    if (d.courts.some(c => c.running || c.next)) parts.push(`<section class="mon-sec"><h2>${esc(T('Jetzt'))}</h2>${courtsHtml()}</section>`);
    const up = d.upcoming.filter(m => !m.running).slice(0, 12);
    if (up.length) parts.push(`<section class="mon-sec"><h2>${esc(T('Als Nächstes'))}</h2><div class="mon-card"><div class="mon-rows">${up.map(row).join('')}</div></div></section>`);
    if (d.ranking) parts.push(`<section class="mon-sec"><h2>${esc(T('Rangliste'))}</h2>${rankingHtml()}</section>`);
    if (d.groups.length) parts.push(`<section class="mon-sec"><h2>${esc(T(d.groups.length > 1 ? 'Tabellen' : 'Tabelle'))}</h2><div class="mon-groups">${d.groups.filter(g => g !== myGroup).map(groupCard).join('')}</div></section>`);
    if (d.ko.length) parts.push(`<section class="mon-sec"><h2>${esc(T(d.ft.format === 'ko' ? 'Turnierbaum' : 'Endrunde'))}</h2>${treeHtml()}</section>`);
    if (d.results.length) parts.push(`<section class="mon-sec"><h2>${esc(T('Letzte Ergebnisse'))}</h2><div class="mon-card"><div class="mon-rows">${d.results.slice(0, 10).map(resRow).join('')}</div></div></section>`);
    $('mon').innerHTML = parts.join('');
    document.body.style.setProperty('--s', 1);
    countdown();
  }
  /** Restzeit laufender Spiele: tickt jede Sekunde, ohne neu zu laden */
  function countdown() {
    document.querySelectorAll('[data-left]').forEach(x => {
      if (x.dataset.left === '') { x.textContent = ''; return; }
      const l = +x.dataset.left - Math.round((Date.now() - at) / 1000);
      x.textContent = leftTxt(l); x.classList.toggle('late', l < 0);
    });
  }
  const show = () => (phone() ? showPhone() : showTv());

  async function load() {
    try {
      const r = await fetch('../../api/p/turniere/ft/' + key, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { if (r.status === 404) { d = null; clearInterval(timer); $('mon').innerHTML = `<div class="mon-empty">${esc(j.error || T('Dieser Link gilt nicht (mehr).'))}</div>`; return; } throw new Error(j.error || T('Keine Verbindung zum Server.')); }
      d = j; at = Date.now(); failCount = 0;
    } catch (e) { if (++failCount > 2 || !d) $('mon').innerHTML = `<div class="mon-empty">${esc(e.message)}</div>`; return; }
    $('mClub').textContent = d.club || ' ';
    $('mName').textContent = d.ft.name;
    document.title = `${d.ft.name} – ${d.club || T('Turnier')}`;
    show();
  }
  if (!key) { $('mon').innerHTML = `<div class="mon-empty">${esc(T('Dieser Link ist unvollständig. Bitte bei der Turnierleitung einen neuen holen.'))}</div>`; return; }
  clock(); setInterval(clock, 5000);
  setInterval(countdown, 1000);
  load(); timer = setInterval(() => { if (!document.hidden) load(); }, 15000);
  setInterval(() => { if (d && !phone()) next(); }, 12000);
  window.addEventListener('resize', () => { if (d) show(); });
  document.addEventListener('keydown', e => { if (e.key === 'ArrowRight' && d && !phone()) next(); });   // weiterblättern von Hand (Tastatur am Fernseher)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();
