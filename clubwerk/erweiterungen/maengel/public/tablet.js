'use strict';
/* Tablet: Mangel melden – Namen wählen, Mitglieder-PIN (wie beim Verkauf), dann das Meldeformular aus member.js */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const BASE = '../../api/tablet/';
  let state = { people: [] };
  function toast(msg, error = false) { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (error ? ' error' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 5000); }
  async function call(p, body) {
    const r = await fetch(BASE + p, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && d.gate) { showGate(); throw Object.assign(new Error(d.error || 'Gesperrt'), { gate: true }); }
    if (!r.ok) throw Object.assign(new Error(d.error || 'Das hat nicht geklappt.'), { status: r.status });
    return d;
  }
  async function load() { try { state = await call('x/maengel/state'); } catch (e) { if (!e.gate) toast('Keine Verbindung zum Server.', true); } }

  const dlg = html => { $('dialog').innerHTML = html; $('overlay').classList.remove('hidden'); };
  const closeDlg = () => { $('overlay').classList.add('hidden'); $('dialog').innerHTML = ''; };
  $('overlay').addEventListener('mousedown', e => { if (e.target === $('overlay')) closeDlg(); });

  function pickName() {
    dlg(`<h2>Wer bist du?</h2><div class="sub">Mangel melden</div><input class="q" id="q" placeholder="Namen eingeben" autocomplete="off"><div class="vh-names" id="nm"></div><div class="dlg-btns"><button id="x">Abbrechen</button></div>`);
    const draw = () => {   // im Vereinsheim keine Namen vorschlagen – erst nach Eingabe (mind. 2 Buchstaben)
      const q = $('q').value.trim().toLowerCase();
      const hits = q.length < 2 ? [] : state.people.filter(p => p.name.toLowerCase().includes(q) || (p.ln || '').toLowerCase().includes(q)).slice(0, 30);
      $('nm').innerHTML = q.length < 2 ? '<div class="vh-names-hint">Bitte die ersten Buchstaben des Vor- oder Nachnamens eingeben.</div>' : hits.length ? hits.map(p => `<button data-p="${p.id}" translate="no"><span>${esc(p.ln || p.name)}</span></button>`).join('') : '<div class="vh-names-hint">Niemand gefunden – melden geht am Tablet nur mit PIN.</div>';
      $('nm').querySelectorAll('[data-p]').forEach(b => { b.onclick = () => unlock(state.people.find(p => p.id === +b.dataset.p)); });
    };
    draw(); $('q').oninput = draw; $('x').onclick = closeDlg; setTimeout(() => $('q').focus(), 50);
  }
  /** PIN wie beim Verkauf – ohne PIN geht Melden am Tablet nicht (die Liste enthält nur Konten mit PIN) */
  function unlock(p) {
    let pinVal = '';
    const go = async pin => {
      try { const r = await call('unlock', { memberId: p.id, pin }); closeDlg(); report(r.token); }
      catch (e) { if (e.gate) return closeDlg(); $('perr').textContent = e.message; pinVal = ''; dots(); }
    };
    dlg(GKPin.pad(esc(p.ln || p.name), 'Bitte deine PIN eingeben – Mangel melden'));
    function dots() { $('dots').innerHTML = GKPin.dots(pinVal.length); }
    dots();
    $('dialog').querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { const k = b.dataset.k; if (k === 'x') return closeDlg(); if (k === 'ok') return go(pinVal); if (pinVal.length < 6) { pinVal += k; dots(); } if (pinVal.length === 6) go(pinVal); }; });
  }
  /* Während das Formular offen ist, nicht nach 30 Sekunden zum Start-Reiter springen (Kamera, Tippen der Beschreibung) –
     höchstens 3 Minuten nach der letzten Eingabe, dann schließt es sich und das Tablet kehrt wie gewohnt zurück */
  let alive = null;
  function report(token) {
    const io = {
      places: () => Promise.resolve({ places: state.places || [] }),
      similar: b => call('x/maengel/aehnlich', { token, ...b }),
      create: b => call('x/maengel/melden', { token, ...b }),
      photo: (id, ph) => call('x/maengel/foto', { token, report_id: id, ...ph }),
      confirm: id => call('x/maengel/auch', { token, report_id: id }),
      thumbSrc: pid => `src="../../api/tablet/x/maengel/foto/${pid}"`,
    };
    let last = Date.now();
    clearInterval(alive);
    const close = window.MaengelForm.open(io, { sheetId: 'mgSheet', toast, keepAlive: () => { last = Date.now(); }, done: () => clearInterval(alive) });
    alive = setInterval(() => {
      const open = $('mgSheet') && $('mgSheet').classList.contains('show');
      if (!open) return clearInterval(alive);
      if (Date.now() - last > 3 * 60000) { clearInterval(alive); close(); return; }
      window.dispatchEvent(new Event('scroll'));   // gilt für nav.js als Eingabe
    }, 5000);
  }
  $('startBtn').onclick = pickName;

  let gateShown = false;
  function showGate() { if (gateShown) return; gateShown = true; closeDlg(); $('gate').classList.remove('hidden'); $('gatePw').value = ''; $('gateErr').textContent = ''; setTimeout(() => $('gatePw').focus(), 50); }
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
  document.addEventListener('visibilitychange', () => { if (!document.hidden && $('overlay').classList.contains('hidden')) load(); });
  load();
})();
