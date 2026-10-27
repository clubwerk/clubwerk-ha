'use strict';
/* Tablet: Tabellen, Endrunde und Relegation der laufenden Clubmeisterschaft – nur ansehen (Namen und Ergebnisse), ohne PIN */
(() => {
  const $ = id => document.getElementById(id);
  const V = window.TurnierAnsicht, esc = V.esc;
  async function load() {
    let d;
    try {
      const r = await fetch('../../api/tablet/x/turniere/state');
      d = await r.json().catch(() => ({}));
      if (r.status === 401 && d.gate) return showGate();
      if (!r.ok) throw new Error(d.error || 'Keine Verbindung zum Server.');
    } catch (e) { $('view').innerHTML = `<div class="tk-empty">${esc(e.message)}</div>`; return; }
    if (!d.season) { $('view').innerHTML = '<div class="tk-empty">Gerade läuft keine Clubmeisterschaft.</div>'; return; }
    $('sub').textContent = `${d.season.name} – Termine und Ergebnisse trägst du in der Mitglieder-App ein.`;
    const ko = d.finals.length ? `<h2 class="sec">Endrunde Liga ${esc(d.top)}</h2><div class="vh-card">${V.tree(d.finals, d.champion)}</div>` : '';
    const rel = d.relegation.length ? `<h2 class="sec">Relegation</h2><div class="tu-groups">${[...new Set(d.relegation.map(m => m.league))].map(k => `<div class="vh-card">${V.relegation(d.relegation.filter(m => m.league === k))}</div>`).join('')}</div>` : '';
    const leagues = d.leagues.filter(l => l.groups.length).map(l => `<h2 class="sec">${esc(l.label)}</h2><div class="tu-groups">${l.groups.map(g => `<div class="vh-card"><h3><span>Gruppe <span translate="no">${esc(g.label)}</span></span></h3>${V.table(g, { up: l.key === d.top ? 2 : 1 })}</div>`).join('')}</div>`).join('');
    $('view').innerHTML = ko + rel + (leagues || '<div class="tk-empty">Die Gruppen sind noch nicht ausgelost – Anmeldung in der Mitglieder-App unter „Turniere“.</div>');
  }
  let gateShown = false;
  function showGate() { if (gateShown) return; gateShown = true; $('gate').classList.remove('hidden'); $('gatePw').value = ''; $('gateErr').textContent = ''; setTimeout(() => $('gatePw').focus(), 50); }
  async function gateLogin() {
    try {
      const r = await fetch('../../api/gate/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('gatePw').value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { $('gateErr').textContent = d.error || 'Das hat nicht geklappt.'; return; }
      gateShown = false; $('gate').classList.add('hidden'); load();
    } catch (e) { $('gateErr').textContent = 'Keine Verbindung zum Server.'; }
  }
  $('gateGo').onclick = gateLogin;
  $('gatePw').addEventListener('keydown', e => { if (e.key === 'Enter') gateLogin(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  load();
})();
