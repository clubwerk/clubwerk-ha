'use strict';
/* Tablet: Platzbelegung für heute, buchen und stornieren mit Name + PIN (wie bei den Getränken) */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const BASE = '../../api/tablet/';
  const tm = s => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const dur = m => (m % 60 ? (m > 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} Std.` : `${m} Min.`) : `${m / 60} Std.`);
  const first = n => String(n || '').split(/[ ,]+/)[0];
  const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  let state = null, area = null;
  function toast(msg, error = false) { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (error ? ' error' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 4000); }
  async function call(p, body) {
    const r = await fetch(BASE + p, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && d.gate) { showGate(); throw Object.assign(new Error(d.error || 'Gesperrt'), { gate: true }); }
    if (!r.ok) throw Object.assign(new Error(d.error || 'Das hat nicht geklappt.'), { status: r.status });
    return d;
  }
  const dlg = html => { $('dialog').innerHTML = html; $('overlay').classList.remove('hidden'); };
  const closeDlg = () => { $('overlay').classList.add('hidden'); $('dialog').innerHTML = ''; };
  $('overlay').addEventListener('mousedown', e => { if (e.target === $('overlay')) closeDlg(); });

  function slots(r) {
    const p = state.plan, nowM = tm(state.now), out = [];
    const o = tm(r.open_from), c = tm(r.open_to);
    for (let s = o; s + r.slot_min <= c; s += r.slot_min) {
      const e = s + r.slot_min;
      const ov = p.bookings.filter(b => b.resource_id === r.id && tm(b.start) < e && tm(b.end) > s);
      const lock = ov.find(b => b.type === 'sperre');
      let cls = 'free', label = r.quantity > 1 ? `frei (${r.quantity - ov.length})` : 'frei', b = null;
      if (lock) { cls = 'lock'; label = lock.title || 'gesperrt'; b = lock; }
      else if (ov.length >= Math.max(1, r.quantity)) { b = ov[0]; cls = b.type === 'serie' ? 'busy serie' : 'busy'; label = b.label ? `${b.label.name}${b.type === 'buchung' && b.who ? ' · ' + b.who.map(first).join(', ') : ''}` : b.type === 'serie' ? (b.title || 'Training') : (b.who || []).map(first).join(', ') || 'belegt'; }
      if (e <= nowM) cls += ' past'; else if (s <= nowM) cls += ' now';
      out.push({ s, e, cls, label, b });
    }
    return out;
  }
  async function load() {
    try { state = await call('x/buchung/state'); } catch (e) { if (!e.gate) toast('Keine Verbindung zum Server.', true); return; }
    draw();
  }
  function draw() {
    const p = state.plan;
    const rs = p.resources.filter(r => r.open_today);
    const areas = [...new Set(rs.map(r => r.area))];
    if (!areas.includes(area)) area = areas[0] || null;
    const list = rs.filter(r => r.area === area);
    $('dayTitle').textContent = `Heute, ${new Date(state.today + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}`;
    $('daySub').textContent = state.booking ? 'Freie Zeit antippen zum Buchen – belegte antippen zum Stornieren.' : 'Gebucht wird in der Mitglieder-App.';
    $('areas').innerHTML = areas.length > 1 ? areas.map(a => `<button data-a="${esc(a)}" class="${a === area ? 'on' : ''}">${esc(a)}</button>`).join('') : '';
    $('areas').style.display = areas.length > 1 ? '' : 'none';
    $('areas').querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { area = b.dataset.a; draw(); }; });
    $('board').style.setProperty('--n', Math.min(Math.max(list.length, 1), 6));
    $('board').innerHTML = list.length ? list.map(r => `<div class="bk-col"><h3>${esc(r.name)}<small>${r.open_from}–${r.open_to} Uhr</small></h3><div class="bk-slots">
        ${slots(r).map(x => `<button class="bk-slot ${x.cls}" data-r="${r.id}" data-s="${x.s}" ${x.b && x.b.label ? `style="box-shadow:inset 5px 0 0 ${x.b.label.color}"` : ''} ${/past/.test(x.cls) ? 'disabled' : ''}><b>${hhmm(x.s)}</b><span translate="no">${esc(x.label)}</span></button>`).join('')}</div></div>`).join('')
      : '<div class="bk-empty" style="grid-column:1/-1">Heute ist nichts buchbar.</div>';
    $('board').querySelectorAll('.bk-slot').forEach(b => { b.onclick = () => tap(list.find(r => r.id === +b.dataset.r), +b.dataset.s); });
  }
  function tap(r, s) {
    const x = slots(r).find(y => y.s === s); if (!x) return;
    if (/free/.test(x.cls)) { if (!state.booking) return toast('Gebucht wird in der Mitglieder-App.'); return pickName(`${r.name} ab ${hhmm(s)} Uhr buchen`, tok => bookDlg(r, s, tok)); }
    const b = x.b || {};
    const canCancel = state.booking && b.type === 'buchung';
    dlg(`<h2>${esc(r.name)} · ${b.start}–${b.end}</h2><div class="sub">${b.type === 'buchung' ? esc((b.who || []).join(', ')) : esc(b.title || '')}</div>
      <div class="dlg-btns">${canCancel ? '<button id="x">Schließen</button><button class="ok" id="cx" style="background:var(--red);border-color:var(--red)">Stornieren …</button>' : '<button class="ok" id="x" style="grid-column:1/-1">Schließen</button>'}</div>`);
    $('x').onclick = closeDlg;
    if (canCancel) $('cx').onclick = () => pickName('Wer hat gebucht?', async tok => {
      try { await call('x/buchung/cancel', { token: tok, id: b.id }); closeDlg(); toast('Storniert.'); load(); } catch (e) { closeDlg(); toast(e.message, true); }
    });
  }
  function pickName(title, next) {
    dlg(`<h2>Wer bist du?</h2><div class="sub">${esc(title)}</div><input class="q" id="q" placeholder="Name suchen" autocomplete="off"><div class="names" id="nm"></div><div class="dlg-btns" style="grid-template-columns:1fr"><button id="x">Abbrechen</button></div>`);
    const draw = () => { const q = $('q').value.trim().toLowerCase(); $('nm').innerHTML = state.people.filter(p => !q || p.name.toLowerCase().includes(q)).slice(0, 60).map(p => `<button data-p="${p.id}" translate="no">${esc(p.name)}</button>`).join(''); $('nm').querySelectorAll('[data-p]').forEach(b => { b.onclick = () => unlock(state.people.find(p => p.id === +b.dataset.p), title, next); }); };
    draw(); $('q').oninput = draw; $('x').onclick = closeDlg;
  }
  function unlock(p, title, next) {
    const go = async pin => {
      try { const r = await call('unlock', { memberId: p.id, pin }); next(r.token, p); }
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
  function bookDlg(r, s, token) {
    const nowM = tm(state.now);
    let maxEnd = s;
    for (const x of slots(r)) { if (x.s < s) continue; if (x.s !== maxEnd || !/free/.test(x.cls) || x.e - s > r.max_min) break; maxEnd = x.e; }
    const durs = []; for (let m = r.slot_min; s + m <= maxEnd; m += r.slot_min) durs.push(m);
    let sel = durs[Math.min(durs.length - 1, Math.max(0, (60 / r.slot_min | 0) - 1))];
    const partners = [];
    void nowM;
    dlg(`<h2>${esc(r.name)} ab ${hhmm(s)} Uhr</h2><div class="sub">Wie lange?</div>
      <div class="durs">${durs.map(m => `<button data-m="${m}">${dur(m)}</button>`).join('')}</div>
      ${state.max_partners ? `<div class="lbl">Mitspieler (optional)</div><div class="chips" id="pc"></div><input class="q" id="pq" placeholder="Name suchen" autocomplete="off" style="margin-top:6px"><div class="names" id="ph" style="grid-template-columns:1fr 1fr;max-height:22vh"></div>` : ''}
      ${state.rules ? `<div class="rules">${esc(state.rules)}</div><label class="chk"><input type="checkbox" id="acc"> Ich halte mich an die Platzordnung.</label>` : ''}
      <div class="sub" id="fee" style="margin:10px 0 0;font-size:15px"></div><div class="perr" id="perr"></div><div class="dlg-btns"><button id="x">Abbrechen</button><button class="ok" id="ok">Buchen</button></div>`);
    let qn = 0;
    const quote = async () => {
      const n = ++qn;
      try { const q = await call('x/buchung/quote', { token, resource_id: r.id, start: hhmm(s), minutes: sel, partners, guests: [] }); if (n !== qn) return;
        $('perr').textContent = q.ok ? '' : q.error; $('fee').innerHTML = q.ok && q.fee_cents ? `${q.lines.map(l => esc(l.text)).join('<br>')}<br><b>${euro(q.fee_cents)}</b> – mit dem nächsten Einzug` : ''; } catch (e) { /* nur Vorschau */ }
    };
    const paint = () => { $('dialog').querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', +b.dataset.m === sel)); $('ok').textContent = `Buchen bis ${hhmm(s + sel)} Uhr`; };
    $('dialog').querySelectorAll('[data-m]').forEach(b => { b.onclick = () => { sel = +b.dataset.m; paint(); quote(); }; });
    const chips = () => { $('pc').innerHTML = partners.map(id => `<span translate="no">${esc((state.people.find(p => p.id === id) || {}).name)}<button data-rp="${id}">×</button></span>`).join(''); $('pc').querySelectorAll('[data-rp]').forEach(b => { b.onclick = () => { partners.splice(partners.indexOf(+b.dataset.rp), 1); chips(); quote(); }; }); };
    if ($('pq')) $('pq').oninput = () => {
      const q = $('pq').value.trim().toLowerCase();
      $('ph').innerHTML = q.length < 2 ? '' : state.people.filter(p => !partners.includes(p.id) && p.name.toLowerCase().includes(q)).slice(0, 8).map(p => `<button data-p="${p.id}" translate="no">${esc(p.name)}</button>`).join('');
      $('ph').querySelectorAll('[data-p]').forEach(b => { b.onclick = () => { if (partners.length >= state.max_partners) return; partners.push(+b.dataset.p); $('pq').value = ''; $('ph').innerHTML = ''; chips(); quote(); }; });
    };
    paint(); quote();
    $('x').onclick = closeDlg;
    $('ok').onclick = async () => {
      try {
        const res = await call('x/buchung/book', { token, resource_id: r.id, start: hhmm(s), minutes: sel, partners, guests: [], accept: $('acc') ? $('acc').checked : true });
        closeDlg(); toast(`Gebucht: ${r.name} ${hhmm(s)}–${hhmm(s + sel)} Uhr${res.fee_cents ? ` · ${euro(res.fee_cents)}` : ''}`); load();
      } catch (e) { $('perr').textContent = e.message; if (e.status === 401) setTimeout(closeDlg, 1500); }
    };
  }

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
