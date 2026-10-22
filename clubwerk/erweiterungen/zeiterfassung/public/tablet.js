'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const pad = n => String(n).padStart(2, '0');
  const hm = min => `${Math.floor(min / 60)}:${pad(min % 60)}`;
  const clock = ts => ts.slice(11, 16);
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const dayLabel = ts => {
    const d = new Date(ts.replace(' ', 'T')), t = new Date();
    if (d.toDateString() === t.toDateString()) return 'heute';
    const y = new Date(t); y.setDate(t.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'gestern';
    return `${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
  };
  let state = { staff: [] };
  let closeTimer = null;

  function toast(msg, error = false) {
    const t = $('toast'); t.textContent = msg; t.className = 'toast' + (error ? ' error' : '');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 3500);
  }
  async function api(url, body) {
    const opts = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && data.gate) { showGate(); throw Object.assign(new Error(data.error), { gate: true }); }
    if (!r.ok) throw Object.assign(new Error(data.error || 'Fehler'), { status: r.status });
    return data;
  }


  async function load() {
    try { state = await api('../../api/tablet/x/zeiterfassung/state'); } catch (e) { if (!e.gate) toast('Keine Verbindung zum Server.', true); return; }
    // Vereinsname und Logo: gemeinsame Kopfzeile (nav.js)
    render();
  }

  const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  function render() {
    // Kachel wie im Verkauf: Initialen · Name + Tätigkeit/Zeit · Marke rechts (da / nicht da / vergessen)
    $('staff').innerHTML = state.staff.map(s => {
      const line = s.forgotten ? `nicht ausgestempelt seit ${dayLabel(s.in_since)} ${clock(s.in_since)}`
        : s.in_since ? `seit ${dayLabel(s.in_since) === 'heute' ? '' : dayLabel(s.in_since) + ' '}${clock(s.in_since)} Uhr`
          : s.last_out ? `zuletzt ${dayLabel(s.last_out)} ${clock(s.last_out)}` : '';
      const chip = s.forgotten ? '<span class="tk-chip r">vergessen</span>' : s.in_since ? '<span class="tk-chip g">da</span>' : '<span class="tk-chip">nicht da</span>';
      return `<button data-id="${s.id}" class="tk-tile ${s.forgotten ? 'warn' : s.in_since ? 'on' : ''}"><i class="av">${esc(initials(s.name))}</i><span class="tk-txt"><b>${esc(s.name)}</b><span>${esc([s.job, line].filter(Boolean).join(' · '))}</span></span>${chip}</button>`;
    }).join('');
    if (!state.staff.length) $('staff').innerHTML = '<p class="tk-empty" style="grid-column:1/-1;margin:0">Noch kein Personal angelegt – in der Verwaltung unter „Zeiterfassung“.</p>';
    $('staff').querySelectorAll('button[data-id]').forEach(b => b.onclick = () => askPin(state.staff.find(s => s.id === Number(b.dataset.id))));
  }

  function closeDialog() { clearTimeout(closeTimer); $('overlay').classList.add('hidden'); $('dialog').innerHTML = ''; }

  function askPin(s) {
    let pin = '';
    const goingOut = Boolean(s.in_since) && !s.forgotten;
    $('dialog').className = 'dialog';
    $('dialog').innerHTML = GKPin.pad(esc(s.name), `Bitte deine PIN eingeben – ${goingOut ? 'Gehen' : 'Kommen'}`);
    $('overlay').classList.remove('hidden');
    const dots = () => { $('dots').innerHTML = GKPin.dots(pin.length); };
    dots();
    const submit = async () => {
      if (pin.length < 4) { $('perr').textContent = 'Die PIN hat mindestens 4 Ziffern.'; return; }
      try { done(await api('../../api/tablet/x/zeiterfassung/stamp', { staffId: s.id, pin })); }
      catch (e) { if (e.gate) return closeDialog(); pin = ''; dots(); $('perr').textContent = e.message; }
    };
    $('dialog').querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (k === 'x') return closeDialog();
      if (k === 'ok') return submit();
      if (pin.length < 6) { pin += k; dots(); $('perr').textContent = ''; }
    });
    clearTimeout(closeTimer); closeTimer = setTimeout(closeDialog, 60000);
  }

  function done(r) {
    const first = r.name.split(' ')[0];
    const T = {
      in: [`Hallo, ${first}!`, `Kommen ${clock(r.at)} Uhr`, '✓', ''],
      'in-after-forgotten': [`Hallo, ${first}!`, `Kommen ${clock(r.at)} Uhr`, '✓', '<p class="note">Beim letzten Mal wurde nicht ausgestempelt. Bitte dem Vorstand sagen, wann Schluss war.</p>'],
      out: [`Tschüss, ${first}!`, `Gehen ${clock(r.at)} Uhr`, '✓', ''],
      undo: ['Zurückgenommen', 'Einstempeln gelöscht', '↺', '<p class="note">Du warst gerade erst eingestempelt – das wurde als Versehen gelöscht.</p>'],
    }[r.action];
    $('dialog').className = 'dialog done';
    $('dialog').innerHTML = `<div class="big">${T[2]}</div><h2>${esc(T[0])}</h2><div class="when">${T[1]}</div>
      <div class="kv">${r.action === 'out' ? `<span>Heute</span><b>${clock(r.since)} – ${clock(r.at)} · ${hm(r.today_minutes)} Std.</b>` : ''}
        <span>${new Date().toLocaleString('de-DE', { month: 'long' })} bisher</span><b>${hm(r.month_minutes)} Std.</b></div>
      ${T[3]}<button class="btn primary" id="okBtn">OK</button>`;
    $('okBtn').onclick = closeDialog;
    clearTimeout(closeTimer); closeTimer = setTimeout(closeDialog, 12000);
    load();
  }

  /* Passwortschutz (wie Buchungsseite) */
  let gateShown = false;
  function showGate() {
    if (gateShown) return; gateShown = true; closeDialog();
    $('gate').classList.remove('hidden'); $('gatePw').value = ''; $('gateErr').textContent = '';
    setTimeout(() => $('gatePw').focus(), 50);
  }
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
  setInterval(() => { if ($('overlay').classList.contains('hidden')) load(); }, 30000);
  load();
})();
