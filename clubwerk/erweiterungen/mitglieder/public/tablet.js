'use strict';
/* Tablet: „Mitglied werden“ – selbst ausfüllen oder mit Code aus der Verwaltung unterschreiben.
   Datenschutz: nach 4 Minuten ohne Eingabe und 25 Sekunden nach dem Absenden wird alles gelöscht. */
(() => {
  const $ = id => document.getElementById(id);
  const app = $('app');
  const BASE = '../../api/tablet/x/mitglieder/';
  let cfg = null, idle = null;
  function toast(msg, error = false) { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (error ? ' error' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 4000); }
  async function call(p, body) {
    const r = await fetch(BASE + p, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && d.gate) { showGate(); throw Object.assign(new Error(d.error || 'Gesperrt'), { gate: true }); }
    if (!r.ok) throw new Error(d.error || 'Das hat nicht geklappt.');
    return d;
  }
  const post = (p, body) => call(p, body);
  const ICON = (p) => `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

  function armIdle(ms = 240000) { clearTimeout(idle); idle = setTimeout(start, ms); }
  ['pointerdown', 'keydown', 'input'].forEach(ev => document.addEventListener(ev, () => { if (idle) armIdle(); }, { passive: true }));

  async function start() {
    clearTimeout(idle); idle = null;
    try { cfg = await call('antrag/config'); } catch (e) { if (!e.gate) app.innerHTML = '<p class="tk-empty">Keine Verbindung zum Server.</p>'; return; }
    if (!cfg.tablet) { app.innerHTML = '<p class="tk-empty">Beitrittserklärungen am Tablet sind ausgeschaltet.</p>'; return; }
    app.innerHTML = `<div class="tab-head"><div><h1 class="tab-title">Mitglied werden</h1>
      <p class="tab-sub">${esc(cfg.intro || `Beitrittserklärung für den ${cfg.club.name} direkt hier ausfüllen und unterschreiben – ganz ohne Papier.`)}</p></div></div>
      <h2 class="sec">Was möchtest du tun?</h2>
      <div class="tk-grid">
        <button class="tk-tile big span2" id="mwSelf"><span class="tk-ico">${ICON('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>')}</span><span class="tk-txt"><b>Ich möchte Mitglied werden</b><span>Formular ausfüllen, Mitgliedschaft wählen und unterschreiben – auch für die ganze Familie.</span></span></button>
        <button class="tk-tile big span2" id="mwCode"><span class="tk-ico">${ICON('<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')}</span><span class="tk-txt"><b>Ich habe einen Code</b><span>Der Vorstand hat deine Daten schon eingetragen? Code eingeben, prüfen und unterschreiben.</span></span></button>
      </div>`;
    $('mwSelf').onclick = () => {
      if (!cfg.fees.length) return toast('Der Antrag ist noch nicht eingerichtet (Beitragsarten fehlen).', true);
      armIdle();
      window.Antrag.mount(app, { cfg, mode: 'tablet', post, onCancel: start, onDone: () => armIdle(25000) });
    };
    $('mwCode').onclick = codeScreen;
  }
  function codeScreen() {
    armIdle();
    app.innerHTML = `<div class="mw-code"><h2>Code eingeben</h2><p>Den 6-stelligen Code hat dir der Vorstand gegeben.</p>
      <input id="mwIn" inputmode="numeric" maxlength="7" autocomplete="off" placeholder="000000"><div class="err" id="mwErr"></div>
      <div class="row2"><button id="mwBack">Zurück</button><button class="ok" id="mwGo">Öffnen</button></div></div>`;
    setTimeout(() => $('mwIn').focus(), 50);
    $('mwBack').onclick = start;
    const go = async () => {
      const code = $('mwIn').value.replace(/\D/g, '');
      if (code.length !== 6) { $('mwErr').textContent = 'Der Code hat 6 Ziffern.'; return; }
      try {
        const r = await call('antrag/open', { code });
        window.Antrag.mount(app, { cfg: r.config, mode: 'tablet', code, prefill: r.data, post, onCancel: start, onDone: () => armIdle(25000) });
      } catch (e) { if (!e.gate) $('mwErr').textContent = e.message; }
    };
    $('mwGo').onclick = go;
    $('mwIn').onkeydown = e => { if (e.key === 'Enter') go(); };
  }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* Passwortschutz der Tablet-Seiten */
  let gateShown = false;
  function showGate() { if (gateShown) return; gateShown = true; $('gate').classList.remove('hidden'); $('gatePw').value = ''; $('gateErr').textContent = ''; setTimeout(() => $('gatePw').focus(), 50); }
  async function gateLogin() {
    try {
      const r = await fetch('../../api/gate/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('gatePw').value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { $('gateErr').textContent = d.error || 'Das hat nicht geklappt.'; return; }
      gateShown = false; $('gate').classList.add('hidden'); start();
    } catch (e) { $('gateErr').textContent = 'Keine Verbindung zum Server.'; }
  }
  $('gateGo').onclick = gateLogin;
  $('gatePw').addEventListener('keydown', e => { if (e.key === 'Enter') gateLogin(); });
  start();
})();
