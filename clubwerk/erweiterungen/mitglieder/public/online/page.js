'use strict';
/* Online-Beitrittserklärung (Port der Mitglieder-App, ohne Anmeldung) */
(() => {
  const app = document.getElementById('app');
  const post = async (p, body) => {
    const r = await fetch('../../api/p/mitglieder/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Das hat nicht geklappt – bitte später noch einmal versuchen.');
    return d;
  };
  const logo = document.getElementById('logo');
  logo.onload = () => document.getElementById('logoBox').classList.remove('hidden');
  logo.src = '../../logo';
  fetch('../../api/p/mitglieder/antrag/config').then(r => r.json().then(d => ({ ok: r.ok, d }))).then(({ ok, d }) => {
    if (!ok) { app.innerHTML = `<p class="vh-empty">${d.error || 'Der Online-Antrag ist nicht verfügbar.'}</p>`; return; }
    document.getElementById('club').textContent = d.club.name;
    document.title = `Mitglied werden – ${d.club.name}`;
    if (!d.fees.length) { app.innerHTML = '<p class="vh-empty">Der Antrag ist noch nicht eingerichtet.</p>'; return; }
    window.Antrag.mount(app, { cfg: d, mode: 'online', post, onCancel: () => history.length > 1 ? history.back() : location.reload() });
  }).catch(() => { app.innerHTML = '<p class="vh-empty">Keine Verbindung – bitte später noch einmal versuchen.</p>'; });
})();
