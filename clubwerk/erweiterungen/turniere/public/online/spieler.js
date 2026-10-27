'use strict';
/* Spielerseite eines Turniers ohne Konto und ohne App: Link /p/turniere/#t=<Zufallsschlüssel> (QR-Code beim Check-in).
   Nur ansehen: nächstes Match (wann, wo, gegen wen), Ablauf des eigenen Platzes, eigene Ergebnisse. Der Link gilt nur für
   dieses Turnier und bis zu seinem Ende. Der Schlüssel steht hinter „#“ und geht so nie in Protokolle oder Verweise. */
(() => {
  const el = document.getElementById('sec');
  const tok = (location.hash.match(/[#&]t=([A-Za-z0-9_-]{32})/) || [])[1] || '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (t, v) => (window.T ? window.T(t, v) : String(t).replace(/\{(\d+)\}/g, (m, i) => (v && v[i] != null ? v[i] : m)));
  const logo = document.getElementById('logo');
  logo.onload = () => document.getElementById('logoBox').classList.remove('hidden');
  logo.src = '../../logo';
  const st = document.createElement('style');
  st.textContent = '.vh-tx .num { font-size: 1.15em; } .sp-score { font-family: var(--num); font-weight: 600; font-size: 18px; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--ink); }';
  document.head.appendChild(st);
  const opp = m => (m.side === 'a' ? m.b : m.a) || T('steht noch nicht fest');
  /** Ergebnis aus eigener Sicht: „6:4 3:6 10:7“, gewonnen/verloren */
  const mine = m => (m.result === 'wo' ? T('w. o.') : (m.sets || []).map(s => (m.side === 'a' ? s : [s[1], s[0]]).join(':')).join(' ') + (m.result === 'aufgabe' ? ` ${T('Aufg.')}` : ''));
  const won = m => m.winner && m.winner === m.side;
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  let today = '';
  const dayTxt = m => (m.date && m.date !== today ? `${T(WD[new Date(m.date + 'T12:00').getDay()])}, ${m.date.slice(8, 10)}.${m.date.slice(5, 7)}. · ` : '');
  const when = m => (m.running ? T('läuft gerade') : m.est ? dayTxt(m) + T('etwa {0} Uhr', [m.est]) : T('Zeit folgt'));
  let timer = null;
  async function load() {
    let d;
    try {
      const r = await fetch('../../api/p/turniere/s/' + tok, { cache: 'no-store' });
      d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || T('Das hat nicht geklappt.'));
    } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; clearInterval(timer); return; }
    today = d.today;
    document.getElementById('club').textContent = d.club;
    document.getElementById('who').textContent = T('Deine Spielerseite');
    document.title = `${d.day.name} – ${d.club}`;
    const n = d.next;
    const hero = n ? `<div class="vh-next hero"><div class="t"><b class="num">${esc(n.running ? T('jetzt') : n.est || '–')}</b><small>${esc(dayTxt(n) + (n.court || T('Platz folgt')))}</small></div>
        <div class="i"><b translate="no">${esc(T('gegen {0}', [opp(n)]))}</b><span>${esc(n.event)} · ${esc(n.roundLabel)} · ${esc(when(n))}${n.delay >= 5 ? ` · ${esc(T('+{0} min über Plan', [n.delay]))}` : ''}</span></div></div>`
      : `<div class="vh-card"><p class="vh-lead">${esc(T('Gerade steht kein weiteres Match für dich an.'))}</p></div>`;
    const court = d.court.length > 1 ? `<div class="vh-card flush"><h3>${esc(T('Ablauf auf {0}', [n.court]))}</h3><div class="vh-rows">${d.court.map(x => `<div><span class="vh-tx"><strong translate="no">${esc(`${x.a || T('offen')} – ${x.b || T('offen')}`)}</strong><small>${x.running ? esc(T('läuft gerade')) : `<span class="num">${esc(x.est || '–')}</span> ${esc(T('Uhr'))}`}</small></span>${x.mine ? `<span class="vh-chip g">${esc(T('du'))}</span>` : ''}</div>`).join('')}</div></div>` : '';
    const list = d.matches.length ? `<div class="vh-card flush"><h3>${esc(T('Deine Matches'))}</h3><div class="vh-rows">${d.matches.map(m => `<div><span class="vh-tx"><strong translate="no">${esc(T('gegen {0}', [opp(m)]))}</strong><small>${esc(m.event)} · ${esc(m.roundLabel)}${m.done ? '' : ` · ${m.court ? esc(m.court) + ' · ' : ''}${esc(when(m))}`}</small></span>
        ${m.done ? `<span class="sp-score">${esc(mine(m))}</span><span class="vh-chip ${won(m) ? 'g' : ''}">${esc(won(m) ? T('gewonnen') : T('verloren'))}</span>` : m.running ? `<span class="vh-chip g">${esc(T('läuft'))}</span>` : ''}</div>`).join('')}</div></div>` : '';
    el.innerHTML = `<div class="vh-card"><h3 translate="no">${esc(T('Hallo {0}!', [d.name.split(' ')[0]]))}</h3><p class="vh-lead"><b translate="no">${esc(d.day.name)}</b><br>${esc(d.checked_in ? T('Du bist eingecheckt. Hier siehst du, wann und wo du spielst – die Seite aktualisiert sich von selbst.') : T('Bitte zuerst bei der Turnierleitung einchecken. Hier siehst du, wann und wo du spielst.'))} ${esc(T('Diese Seite ist nur für dich und gilt bis zum Turnierende.'))}</p></div>
      ${hero}${court}${list}`;
  }
  if (!tok) { el.innerHTML = `<div class="vh-empty">${esc(T('Dieser Link ist unvollständig. Bitte bei der Turnierleitung einen neuen QR-Code holen.'))}</div>`; return; }
  load(); timer = setInterval(() => { if (!document.hidden) load(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();
