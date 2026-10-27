'use strict';
/* Fernseher im Clubhaus (Browser im Vereins-WLAN, Tablet-Passwort): je Platz das laufende Match mit Spielzeit und das nächste mit
   voraussichtlicher Uhrzeit und Verzug, dazu Warteschlange und letzte Ergebnisse. Aktualisiert sich alle 15 Sekunden selbst. */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const T = (t, v) => (window.T ? window.T(t, v) : String(t).replace(/\{(\d+)\}/g, (m, i) => (v && v[i] != null ? v[i] : m)));
  const pad = n => String(n).padStart(2, '0');
  const clock = () => { const d = new Date(); $('tvClock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  /** Ergebnis wie auf der Anzeigetafel: je Seite die Sätze, Sieger kräftig */
  const sets = (m, side) => (m.result === 'wo' ? (m.winner === side ? `<span class="w">${esc(T('w. o.'))}</span>` : '') : (m.sets || []).map(s => { const [x, y] = side === 'a' ? s : [s[1], s[0]]; return `<span class="${x > y ? 'w' : ''}">${x}</span>`; }).join('') + (m.result === 'aufgabe' && m.retired === side ? `<span>${esc(T('Aufg.'))}</span>` : ''));
  const pair = (m, score) => `<div class="tv-row"><b class="${m.winner === 'a' ? 'w' : ''}" translate="no">${esc(m.a || T('offen'))}</b><span class="s">${score ? sets(m, 'a') : ''}</span>
    <b class="${m.winner === 'b' ? 'w' : ''}" translate="no">${esc(m.b || T('offen'))}</b><span class="s">${score ? sets(m, 'b') : ''}</span></div>`;
  const late = m => (m.delay >= 5 ? ` <span class="${m.delay >= 15 ? 'tv-late' : ''}">${esc(T('+{0} min', [m.delay]))}</span>` : '');
  async function load() {
    let d;
    try {
      const r = await fetch('../../api/tablet/x/turniere/lk/tv', { cache: 'no-store' });
      d = await r.json().catch(() => ({}));
      if (r.status === 401 && d.gate) return showGate();
      if (!r.ok) throw new Error(d.error || T('Keine Verbindung zum Server.'));
    } catch (e) { $('tv').innerHTML = `<div class="tv-empty">${esc(e.message)}</div>`; return; }
    $('tvName').textContent = d.day ? d.day.name : d.club || T('Turnier');
    $('tvSub').textContent = d.day ? d.club : T('Heute läuft kein Turnier.');
    if (!d.day) { $('tv').innerHTML = `<div class="tv-empty">${esc(T('Heute läuft kein Turnier – die Anzeige erscheint am Turniertag von selbst.'))}</div>`; return; }
    const court = c => `<section class="tv-court"><h2>${esc(c.name)}${c.running ? `<span>${esc(T('seit {0} min', [c.running.minutes]))}</span>` : ''}</h2>
      ${c.running ? pair(c.running, false) + `<small class="tv-next" style="border:0;padding:0">${esc(c.running.event)} · ${esc(c.running.roundLabel)}</small>` : `<div class="tv-free">${esc(T('Platz frei'))}</div>`}
      ${c.next ? `<div class="tv-next">${esc(T('danach'))} <span class="num">${esc(c.next.est || '')}</span>${late(c.next)} · <span translate="no">${esc(`${c.next.a || T('offen')} – ${c.next.b || T('offen')}`)}</span></div>` : ''}</section>`;
    $('tv').innerHTML = `<div class="tv-courts">${d.courts.map(court).join('')}</div>
      <div class="tv-cols">
        <section class="tv-box"><h2>${esc(T('Letzte Ergebnisse'))}</h2>${d.results.length ? d.results.map(m => pair(m, true).replace('</div>', `<small>${esc(m.event)} · ${esc(m.roundLabel)}</small></div>`)).join('') : `<div class="tv-free">${esc(T('Noch keine Ergebnisse.'))}</div>`}</section>
        ${d.queue.length ? `<section class="tv-box"><h2>${esc(T('Warteschlange'))}</h2>${d.queue.map(m => pair(m, false).replace('</div>', `<small>${esc(m.event)} · ${esc(m.wait || T('wartet auf einen freien Platz'))}</small></div>`)).join('')}</section>` : ''}
      </div>`;
  }
  let gateShown = false;
  function showGate() { if (gateShown) return; gateShown = true; $('gate').classList.remove('hidden'); $('gatePw').value = ''; $('gateErr').textContent = ''; setTimeout(() => $('gatePw').focus(), 50); }
  async function gateLogin() {
    try {
      const r = await fetch('../../api/gate/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('gatePw').value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { $('gateErr').textContent = d.error || T('Das hat nicht geklappt.'); return; }
      gateShown = false; $('gate').classList.add('hidden'); load();
    } catch (e) { $('gateErr').textContent = T('Keine Verbindung zum Server.'); }
  }
  $('gateGo').onclick = gateLogin;
  $('gatePw').addEventListener('keydown', e => { if (e.key === 'Enter') gateLogin(); });
  clock(); setInterval(clock, 10000);
  load(); setInterval(() => { if (!gateShown) load(); }, 15000);
})();
