'use strict';
/* Zugang am Vereinstablet (optional): Name wählen + App-PIN. Die PIN wird nie gemerkt. */
(() => {
  const API = '../../api/tablet/x/zugang/';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  let doors = [], members = [], pending = null, timer = null;
  function toast(msg, err) { const t = $('toast'); t.textContent = msg; t.className = 'vh-toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3500); }
  async function refresh() {
    clearTimeout(timer);
    try {
      const v = await (await fetch(API + 'status')).json();
      doors = v.doors || [];
      $('dot').className = 'vh-dot ' + (v.online ? 'ok' : 'err');
      $('st').textContent = v.online ? 'Verbunden' : 'Keine Verbindung zu den Schlössern';
      $('doors').innerHTML = window.ZugangDoors.html(doors, esc, false);
      document.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => ask(b.dataset.d, b.dataset.a); });
    } catch (e) { $('dot').className = 'vh-dot err'; $('st').textContent = 'Keine Verbindung zum Server'; }
    timer = setTimeout(refresh, 8000);
  }
  function ask(id, action) {
    const d = doors.find(x => x.id === id);
    pending = { id, action };
    $('title').textContent = `${d.name}: ${window.ZugangDoors.label(d, action)}`;
    $('who').innerHTML = '<option value="">– Name wählen –</option>' + members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
    $('pin').value = ''; $('err').textContent = '';
    $('sheet').classList.add('show');
  }
  $('no').onclick = () => { $('sheet').classList.remove('show'); pending = null; };
  $('pin').addEventListener('keydown', e => { if (e.key === 'Enter') $('ok').click(); });
  $('ok').onclick = async () => {
    if (!$('who').value) { $('err').textContent = 'Bitte deinen Namen wählen'; return; }
    if (!$('pin').value) { $('err').textContent = 'Bitte PIN eingeben'; return; }
    $('err').textContent = 'Prüfe …';
    const r = await fetch(API + 'door', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ door: pending.id, action: pending.action, member: $('who').value, pin: $('pin').value }) });
    const d = await r.json().catch(() => ({}));
    $('pin').value = '';   // PIN am gemeinsamen Tablet nie behalten
    if (r.status === 401) { $('err').textContent = d.error || 'Falsche PIN'; return; }
    $('sheet').classList.remove('show');
    if (!r.ok) toast(d.error || 'Fehler', true); else toast('Wird ausgeführt …');
    setTimeout(refresh, 1200);
  };
  fetch(API + 'members').then(r => r.json()).then(j => { members = j.members || []; }).catch(() => {});
  refresh();
})();
