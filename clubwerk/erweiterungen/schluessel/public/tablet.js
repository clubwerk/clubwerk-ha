'use strict';
/* Tablet: Schlüsselübergabe mit Code – Code eingeben, prüfen, Bedingungen bestätigen, beide Seiten unterschreiben */
(() => {
  const $ = id => document.getElementById(id);
  const app = $('app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const BASE = '../../api/tablet/x/schluessel/';
  let idle = null, showing = 'start';
  async function call(p, body) {
    const r = await fetch(BASE + p, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && d.gate) { showGate(); throw Object.assign(new Error(d.error || 'Gesperrt'), { gate: true }); }
    if (!r.ok) throw Object.assign(new Error(d.error || 'Das hat nicht geklappt.'), { status: r.status });
    return d;
  }
  /* Während etwas ausgefüllt wird, nicht nach 30 Sekunden zum Start-Reiter springen – höchstens 4 Minuten nach der letzten Eingabe */
  function armIdle(ms = 240000) { clearTimeout(idle); idle = setTimeout(start, ms); }
  ['pointerdown', 'keydown', 'input'].forEach(ev => document.addEventListener(ev, () => { if (idle) armIdle(); }, { passive: true }));

  async function start() {
    clearTimeout(idle); idle = null; showing = 'start';
    let cfg; try { cfg = await call('config'); } catch (e) { if (!e.gate) app.innerHTML = '<p class="tk-empty">Keine Verbindung zum Server.</p>'; return; }
    app.innerHTML = `<div class="tab-head"><div><h1 class="tab-title">Schlüsselübergabe</h1><p class="tab-sub">Den 6-stelligen Code eingeben, den du von der ausgebenden Person bekommen hast – dann prüfen und unterschreiben.</p></div></div>
      <div class="sl-code"><h2>Code eingeben</h2><p>Den Code hat dir der Vorstand oder der Platzwart gegeben.</p>
      <input id="slIn" inputmode="numeric" maxlength="7" autocomplete="off" placeholder="000000"><div class="err" id="slErr"></div>
      <div class="row2"><button id="slBack">Zurück</button><button class="ok" id="slGo">Öffnen</button></div></div>`;
    setTimeout(() => $('slIn').focus(), 50);
    $('slBack').onclick = () => { location.href = '../../'; };
    const go = async () => {
      const code = $('slIn').value.replace(/\D/g, '');
      if (code.length !== 6) { $('slErr').textContent = 'Der Code hat 6 Ziffern.'; return; }
      try { const r = await call('open', { code }); review(r, code); }
      catch (e) { if (!e.gate) $('slErr').textContent = e.message; }
    };
    $('slGo').onclick = go;
    $('slIn').onkeydown = e => { if (e.key === 'Enter') go(); };
    armIdle(120000);
  }
  const eur = c => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const de = d => d.split('-').reverse().join('.');
  function review(r, code) {
    armIdle(); showing = 'review';
    const specs = [['slS1', `Empfänger/in – ${r.person}`], ['slS2', `Ausgegeben von – ${r.issued_by}`], ...(r.guardian_required ? [['slS3', `Erziehungsberechtigte/r – ${r.guardian_name}`]] : [])];
    app.innerHTML = `<div class="tab-head"><div><h1 class="tab-title">Schlüsselübergabe</h1><p class="tab-sub">Bitte prüfen, die Bedingungen lesen und unterschreiben – das Protokoll kommt als PDF per E-Mail, wenn eine Adresse bekannt ist.</p></div></div>
      <div class="sl-grid"><div class="sl-card"><h2>Übergabe</h2><dl class="sl-sum"><dt>Empfänger/in</dt><dd translate="no">${esc(r.person)}</dd>
        <dt>Schlüssel</dt><dd translate="no">${r.pieces.map(p => `Nr. ${esc(p.ident)} ${esc(p.name)}`).join('<br>')}</dd>
        ${r.pieces.some(p => p.opens) ? `<dt>Schließt</dt><dd translate="no">${esc([...new Set(r.pieces.map(p => p.opens).filter(Boolean))].join('; '))}</dd>` : ''}
        <dt>Rückgabe</dt><dd>${r.due ? de(r.due) : 'unbefristet, spätestens beim Austritt'}</dd><dt>Pfand</dt><dd>${r.deposit_cents ? eur(r.deposit_cents) + ' bar erhalten' : 'kein Pfand'}</dd><dt>Ausgegeben von</dt><dd translate="no">${esc(r.issued_by)}</dd></dl></div>
        <div class="sl-card"><h2>Bedingungen</h2><p class="sl-terms" translate="no">${esc(r.terms)}</p><label class="sl-agree"><input type="checkbox" id="slAg"> Gelesen und einverstanden</label></div></div>
      <div class="sl-sigs">${specs.map(([id, l]) => window.CWSign.field({ id, label: l })).join('')}</div><div class="sl-err" id="slErr"></div>
      <div class="sl-nav"><button id="slBk">Abbrechen</button><button class="ok" id="slSg">Verbindlich abschließen</button></div>`;
    const ps = specs.map(([id]) => window.CWSign.mount($(id)));
    $('slBk').onclick = start;
    $('slSg').onclick = async () => {
      if (!$('slAg').checked) { $('slErr').textContent = 'Bitte „Gelesen und einverstanden“ ankreuzen.'; return; }
      if (ps.some(p => !p.ok())) { $('slErr').textContent = 'Bitte in allen Feldern unterschreiben.'; return; }
      $('slSg').disabled = true; $('slSg').textContent = 'Wird gesendet …';
      try { await call('sign', { code, agreed: true, sig_receiver: ps[0].png(), sig_giver: ps[1].png(), ...(ps[2] ? { sig_guardian: ps[2].png() } : {}) }); done(r); }
      catch (e) { $('slSg').disabled = false; $('slSg').textContent = 'Verbindlich abschließen'; if (!e.gate) $('slErr').textContent = e.message; }
    };
  }
  function done(r) {
    armIdle(25000); showing = 'done';
    app.innerHTML = `<div class="sl-card sl-done"><h2>Vielen Dank!</h2><p class="tab-sub" style="margin:8px 0 18px">Die Übergabe an <b translate="no">${esc(r.person)}</b> ist gespeichert. Das Protokoll kommt per E-Mail, wenn eine Adresse bekannt ist.</p>
      <button class="tk-big" id="slFin">Fertig</button></div>`;
    $('slFin').onclick = start;
  }

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
