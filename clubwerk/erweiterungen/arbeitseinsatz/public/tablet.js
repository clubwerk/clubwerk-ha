'use strict';
/* Tablet: Arbeitseinsatz ein- und ausstempeln (Name wählen, PIN wie bei den Getränken) */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const BASE = '../../api/tablet/';
  let state = { running: [], events: [], people: [] };
  function toast(msg, error = false) { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (error ? ' error' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 4000); }
  async function call(p, body) {
    const r = await fetch(BASE + p, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && d.gate) { showGate(); throw Object.assign(new Error(d.error || 'Gesperrt'), { gate: true }); }
    if (!r.ok) throw Object.assign(new Error(d.error || 'Das hat nicht geklappt.'), { status: r.status });
    return d;
  }
  const since = ts => { const m = Math.max(0, Math.round((Date.now() - new Date(ts.replace(' ', 'T')).getTime()) / 60000)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

  async function load() {
    try { state = await call('x/arbeitseinsatz/state'); } catch (e) { if (!e.gate) toast('Keine Verbindung zum Server.', true); return; }
    $('running').innerHTML = state.running.length ? state.running.map(r => `<button class="aw-tile" data-r="${r.member_id}"><div><b>${esc(r.name)}</b><span>${esc(r.title || '')} · seit ${r.in_at.slice(11, 16)} Uhr</span></div><span class="t">${since(r.in_at)}</span></button>`).join('')
      : '<div class="aw-empty">Niemand eingestempelt.</div>';
    $('events').innerHTML = state.events.length ? state.events.map(e => `<div class="aw-tile ev"><div><b translate="no">${esc(e.title)}</b><span>${[e.start ? `${e.start}${e.end ? '–' + e.end : ''} Uhr` : '', e.place].filter(Boolean).map(esc).join(' · ') || (e.kind === 'theke' ? 'Thekendienst' : 'Arbeitseinsatz')}</span></div></div>`).join('')
      : '<div class="aw-empty">Heute ist nichts geplant – du kannst trotzdem einen Einsatz beginnen.</div>';
    $('note').textContent = state.text || '';
    $('running').querySelectorAll('[data-r]').forEach(b => { b.onclick = () => { const p = state.people.find(x => x.id === +b.dataset.r) || { id: +b.dataset.r, name: b.querySelector('b').textContent, pin: true }; unlock(p, 'Einsatz beenden', tok => finish(tok)); }; });
  }

  const dlg = html => { $('dialog').innerHTML = html; $('overlay').classList.remove('hidden'); };
  const closeDlg = () => { $('overlay').classList.add('hidden'); $('dialog').innerHTML = ''; };
  $('overlay').addEventListener('mousedown', e => { if (e.target === $('overlay')) closeDlg(); });

  function pickName() {
    const busy = new Set(state.running.map(r => r.member_id));
    dlg(`<h2>Wer bist du?</h2><input class="q" id="q" placeholder="Name suchen" autocomplete="off"><div class="names" id="nm"></div><div class="dlg-btns" style="grid-template-columns:1fr"><button id="x">Abbrechen</button></div>`);
    const draw = () => { const q = $('q').value.trim().toLowerCase(); $('nm').innerHTML = state.people.filter(p => !busy.has(p.id) && (!q || p.name.toLowerCase().includes(q))).slice(0, 60).map(p => `<button data-p="${p.id}">${esc(p.name)}</button>`).join(''); $('nm').querySelectorAll('[data-p]').forEach(b => { b.onclick = () => unlock(state.people.find(p => p.id === +b.dataset.p), 'Einsatz beginnen', tok => chooseWork(tok)); }); };
    draw(); $('q').oninput = draw; $('x').onclick = closeDlg;
  }
  /** PIN wie bei den Getränken (ohne PIN: direkt) */
  function unlock(p, title, next) {
    const go = async pin => {
      try { const r = await call('unlock', { memberId: p.id, pin }); next(r.token); }
      catch (e) { if (e.gate) return closeDlg(); if ($('perr')) { $('perr').textContent = e.message; pinVal = ''; dots(); } else toast(e.message, true); }
    };
    if (!p.pin) return go('');
    let pinVal = '';
    dlg(`<h2>${esc(p.name)}</h2><div class="sub">PIN eingeben – ${esc(title)}</div><div class="pin-dots" id="dots"></div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button class="fn" data-k="x">Abbrechen</button><button data-k="0">0</button><button class="fn" data-k="ok">OK</button></div><div class="perr" id="perr"></div>`);
    function dots() { $('dots').innerHTML = Array.from({ length: Math.max(4, pinVal.length) }, (_, i) => `<span class="${i < pinVal.length ? 'f' : ''}"></span>`).join(''); }
    dots();
    $('dialog').querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { const k = b.dataset.k; if (k === 'x') return closeDlg(); if (k === 'ok') return go(pinVal); if (pinVal.length < 6) { pinVal += k; dots(); } if (pinVal.length === 6) go(pinVal); }; });
  }
  function chooseWork(token) {
    const evs = state.events;
    let sel = evs.length === 1 ? evs[0].id : null;   // ein Einsatz heute: gleich ausgewählt
    dlg(`<h2>Was machst du?</h2><div class="sub">${evs.length ? 'Einsatz wählen – eine Beschreibung ist dann freiwillig.' : 'Kurz beschreiben, was du machst.'}</div>
      ${evs.length ? `<div class="choice">${evs.map(e => `<button data-e="${e.id}">${esc(e.title)}${e.start ? ` · ${e.start} Uhr` : ''}</button>`).join('')}</div>` : ''}
      <input class="q" id="wt" placeholder="" style="margin-top:10px" autocomplete="off">
      <div class="perr" id="perr"></div><div class="dlg-btns"><button id="x">Abbrechen</button><button class="ok" id="ok">Einstempeln</button></div>`);
    const paint = () => {
      $('dialog').querySelectorAll('[data-e]').forEach(b => b.classList.toggle('on', +b.dataset.e === sel));
      $('wt').placeholder = sel ? 'optional: was genau, z. B. Hecke schneiden' : 'z. B. Hecke schneiden';
      $('perr').textContent = '';
    };
    const start = async body => { try { await call('x/arbeitseinsatz/start', { token, ...body }); closeDlg(); toast('Eingestempelt – danke fürs Mithelfen!'); load(); } catch (e) { $('perr').textContent = e.message; } };
    $('dialog').querySelectorAll('[data-e]').forEach(b => { b.onclick = () => { sel = sel === +b.dataset.e ? null : +b.dataset.e; paint(); }; });
    $('ok').onclick = () => start({ event_id: sel || undefined, text: $('wt').value });
    $('wt').onkeydown = e => { if (e.key === 'Enter') $('ok').click(); };
    $('x').onclick = closeDlg;
    paint();
  }
  async function finish(token) {
    try {
      const r = await call('x/arbeitseinsatz/stop', { token });
      dlg(`<h2>Danke!</h2><div class="sub">${Math.floor(r.minutes / 60)}:${String(r.minutes % 60).padStart(2, '0')} Stunden ${r.confirmed ? 'gutgeschrieben' : 'erfasst – der Vorstand bestätigt sie'}.</div><div class="dlg-btns" style="grid-template-columns:1fr"><button class="ok" id="x">Fertig</button></div>`);
      $('x').onclick = closeDlg; setTimeout(closeDlg, 6000); load();
    } catch (e) { closeDlg(); toast(e.message, true); }
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
  setInterval(() => { if ($('overlay').classList.contains('hidden')) load(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  load();
})();
