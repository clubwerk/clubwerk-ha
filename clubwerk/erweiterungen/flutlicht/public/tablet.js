'use strict';
/* Licht am Vereinstablet: Name wählen + App-PIN (nur freigeschaltete Mitglieder). Die PIN wird nie gemerkt. */
(() => {
  const API = '../../api/tablet/x/flutlicht/';
  const F = window.FlutlichtTiles;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  let v = null, members = [], pending = null, timer = null, who = null, min = 60;
  function toast(msg, err) { const t = $('toast'); t.textContent = msg; t.className = 'vh-toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3500); }
  async function refresh() {
    clearTimeout(timer);
    try {
      v = await (await fetch(API + 'status')).json();
      if (v.gate) { GKMerk.leeren(); throw new Error('gesperrt'); }   // Tablet gesperrt: nichts mehr merken
      if (v.lights) GKMerk.merken('flutlicht', v);
      zeige();
    } catch (e) { $('dot').className = 'vh-dot err'; $('st').textContent = 'Keine Verbindung zum Server'; }
    timer = setTimeout(refresh, 10000);
  }
  function zeige() {
      $('dot').className = 'vh-dot ' + (!v.online ? 'err' : v.block ? 'warn' : 'ok');   // Sperre: kein grünes „alles gut“
      $('st').textContent = !v.online ? 'Keine Verbindung zum Flutlicht' : v.block ? v.block : v.darkFrom ? `Licht ab ${v.darkFrom} Uhr · alles aus um ${v.quiet} Uhr` : 'Verbunden';
      // am Tablet darf jeder Freigeschaltete auch ausschalten, was er selbst eingeschaltet hat – wer das ist, klärt erst die PIN
      v.lights.forEach(l => { l.can.off = l.on; });
      $('lights').innerHTML = F.html(v.lights, esc, v.extendMin);
      document.querySelectorAll('[data-l]').forEach(b => { b.onclick = () => ask(b.dataset.l, b.dataset.a); });
  }
  function drawDur() {
    const list = F.durations(v.maxMin);
    if (!list.includes(min)) min = list.includes(60) ? 60 : list[list.length - 1];
    $('dur').innerHTML = list.map(m => `<button type="button" data-m="${m}" class="${m === min ? 'on' : ''}">${m} Min.</button>`).join('');
    $('dur').querySelectorAll('[data-m]').forEach(b => { b.onclick = () => { min = +b.dataset.m; drawDur(); }; });
  }
  function ask(id, action) {
    const l = v.lights.find(x => x.id === id);
    pending = { id, action };
    $('title').innerHTML = `<span translate="no">${esc(l.name)}</span>: ${action === 'on' ? 'einschalten' : action === 'off' ? 'ausschalten' : `+${v.extendMin} Min.`}`;
    $('dur').style.display = action === 'on' ? '' : 'none';
    if (action === 'on') drawDur();
    who = null; $('q').value = ''; drawNames();
    $('pin').value = ''; $('err').textContent = '';
    $('sheet').classList.add('show'); setTimeout(() => $('q').focus(), 50);
  }
  /** im Vereinsheim keine Namen vorschlagen – erst nach Eingabe (mind. 2 Buchstaben), wie überall am Tablet */
  function drawNames() {
    const q = $('q').value.trim().toLowerCase();
    const hits = q.length < 2 ? [] : members.filter(m => m.name.toLowerCase().includes(q) || (m.ln || '').toLowerCase().includes(q)).slice(0, 12);
    $('nm').innerHTML = q.length < 2 ? '<div class="vh-names-hint">Bitte die ersten Buchstaben des Vor- oder Nachnamens eingeben.</div>'
      : hits.length ? hits.map(m => `<button type="button" data-m="${m.id}" class="${who === m.id ? 'on' : ''}" translate="no"><span>${esc(m.ln || m.name)}</span></button>`).join('') : '<div class="vh-names-hint">Kein Treffer.</div>';
    $('nm').querySelectorAll('[data-m]').forEach(b => { b.onclick = () => { who = +b.dataset.m; drawNames(); $('pin').focus(); }; });
  }
  $('q').oninput = () => { who = null; drawNames(); };
  $('no').onclick = () => { $('sheet').classList.remove('show'); pending = null; };
  $('pin').addEventListener('keydown', e => { if (e.key === 'Enter') $('ok').click(); });
  $('ok').onclick = async () => {
    if (!who) { $('err').textContent = 'Bitte deinen Namen wählen'; return; }
    if (!$('pin').value) { $('err').textContent = 'Bitte PIN eingeben'; return; }
    $('err').textContent = 'Prüfe …';
    const r = await fetch(API + 'act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ light: pending.id, action: pending.action, minutes: min, member: who, pin: $('pin').value }) });
    const d = await r.json().catch(() => ({}));
    $('pin').value = '';   // PIN am gemeinsamen Tablet nie behalten
    if (r.status === 401) { $('err').textContent = d.error || 'Falsche PIN'; return; }
    $('sheet').classList.remove('show');
    if (!r.ok) toast(d.error || 'Fehler', true);
    else toast(pending.action === 'off' ? (d.still ? `Bleibt an bis ${d.still.slice(11, 16)} Uhr – noch gebucht.` : 'Ausgeschaltet') : `An bis ${d.until.slice(11, 16)} Uhr`);
    setTimeout(refresh, 800);
  };
  fetch(API + 'members').then(r => r.json()).then(j => { members = j.members || []; }).catch(() => {});
  { const last = GKMerk.holen('flutlicht'); if (last && last.lights) { v = last; zeige(); } }   // letzter Stand sofort, danach frisch (nav.js, GKMerk)
  refresh();
})();
