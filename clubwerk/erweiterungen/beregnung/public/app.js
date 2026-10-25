'use strict';
/* Beregnung: eigene Webapp (Port 5000, Vereins-PIN) und – falls eingeschaltet – am Vereinstablet.
   Am Tablet wird die PIN nie gemerkt: jede Aktion fragt neu. */
(() => {
  const embedded = /\/(x\/)?beregnung\//.test(location.pathname) || Boolean(document.querySelector('base[href*="x/beregnung/"]'));   // am Tablet (/beregnung/, alt: /x/beregnung/, oder als Start-Reiter unter „/“)
  const API = embedded ? '../../api/tablet/x/beregnung/' : 'api/';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const T = window.BeregnungTiles;

  if (embedded) {
    document.body.classList.add('embedded');
    document.querySelectorAll('link[rel=manifest], link[rel=icon], link[rel=apple-touch-icon]').forEach(l => l.remove());
    const h = document.createElement('header'); h.id = 'gkHeader'; document.body.prepend(h);
    const s = document.createElement('script'); s.src = '../../nav.js'; s.dataset.base = '../../'; s.dataset.active = 'beregnung'; document.body.appendChild(s);
  } else { const lg = $('logo'); lg.onload = () => $('logoBox').classList.remove('hidden'); lg.src = 'logo'; }

  // Die Vereins-PIN bleibt nur im Speicher dieser Seite (bis sie neu geladen wird) – nicht im sessionStorage, der bei Gerätezugriff auslesbar wäre;
  // am Tablet (eingebettet) wird sie gar nicht gemerkt
  let pinMem = '';
  const sess = { get() { return embedded ? '' : pinMem; }, set(v) { if (!embedded) pinMem = String(v || ''); }, del() { pinMem = ''; } };
  function toast(msg, err = false, ms = 3500) { const t = $('toast'); t.textContent = msg; t.className = 'vh-toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms); }
  async function post(route, body = {}) {
    const r = await fetch(API + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Clubwerk': '1' }, body: JSON.stringify(body), credentials: 'same-origin' });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && d.pin) { sess.del(); throw Object.assign(new Error(d.error || 'Falsche PIN'), { pin: true }); }
    if (r.status === 401 && d.login) throw Object.assign(new Error(d.error), { login: true });
    if (r.status === 403 && d.app) { lock(d.error); throw Object.assign(new Error(d.error), { app: true }); }
    if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`);
    return d;
  }
  const lock = text => { if (text) $('lockText').textContent = text; $('lockSheet').classList.add('show'); };

  /* ---------- PIN ---------- */
  let pinCb = null;
  function askPin(title, text, gate = false) {
    return new Promise((resolve, reject) => {
      $('pinTitle').textContent = title; $('pinText').textContent = text;
      $('pinErr').textContent = ''; $('pinIn').value = '';
      $('pinNo').classList.toggle('hidden', gate);
      $('pinSheet').classList.add('show'); pinCb = { resolve, reject };
      setTimeout(() => $('pinIn').focus(), 80);
    });
  }
  $('pinOk').onclick = () => { const v = $('pinIn').value.trim(); if (!v) { $('pinErr').textContent = 'Bitte PIN eingeben'; return; } $('pinSheet').classList.remove('show'); const c = pinCb; pinCb = null; c && c.resolve(v); };
  $('pinNo').onclick = () => { $('pinSheet').classList.remove('show'); const c = pinCb; pinCb = null; c && c.reject(Object.assign(new Error(''), { cancel: true })); };
  $('pinIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('pinOk').click(); });
  async function withPin(title, fn) {
    if (info.mode === 'login') return fn('');
    let pin = sess.get();
    for (let i = 0; i < 4; i++) {
      if (!pin) { try { pin = await askPin(title, embedded ? 'Vereins-PIN eingeben' : 'Zur Bedienung der Beregnung.'); } catch (e) { return null; } }
      try { const r = await fn(pin); sess.set(pin); return r; } catch (e) { if (e.pin) { pin = ''; toast(e.message, true); continue; } throw e; }
    }
    return null;
  }

  /* ---------- Anzeige ---------- */
  let info = {}, pl = [], timer = null;
  const draw = () => {
    $('tiles').innerHTML = T.html(pl, esc);
    document.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => run(+b.dataset.p); });
    document.querySelectorAll('[data-stop]').forEach(b => { b.onclick = e => { e.stopPropagation(); stopOne(+b.dataset.stop); }; });
  };
  async function refresh() {
    clearTimeout(timer);
    try {
      const r = await fetch(API + 'status', { credentials: 'same-origin' });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401 && d.login) { $('loginSheet').classList.add('show'); return; }
      if (r.status === 403 && d.app) { lock(d.error); return; }
      if (!r.ok) throw new Error(d.error);
      pl = d.plaetze || []; T.prime(pl); draw(); $('stop').classList.toggle('hidden', !pl.length);
      $('tiles').classList.toggle('offline', !d.online); $('stop').disabled = !d.online;   // ohne Verbindung nichts startbar – wie bei den Türen
      $('dot').className = 'vh-dot ' + (d.online ? 'ok' : 'err');
      $('st').textContent = d.online ? 'Verbunden mit der Bewässerungsanlage' : 'Keine Verbindung zur Bewässerungsanlage';
      timer = setTimeout(refresh, pl.some(p => p.state !== 'idle') ? 5000 : 20000);
    } catch (e) { $('dot').className = 'vh-dot err'; $('st').textContent = 'Keine Verbindung zum Server'; timer = setTimeout(refresh, 15000); }
  }
  setInterval(() => { if (T.tick(pl)) draw(); }, 1000);

  async function run(id) {
    const p = pl.find(x => x.id === id);
    if (p.state !== 'idle') return toast(`${p.name} wird schon beregnet.`);
    if (p.blockedUntil) return toast(`${p.name} wurde gerade beregnet – wieder ab ${p.blockedUntil} Uhr.`);
    try {
      const r = await withPin(`${p.name} beregnen`, pin => post('run', { platz: id, pin }));
      if (r) toast(`${p.name} ${r.waitSec > 0 ? 'eingeplant – startet in ' + T.fmt(r.waitSec) : 'gestartet'} · ${Math.round(r.totalSec / 60)} Min.` + (p.zones.length > 1 ? ' (nacheinander)' : ''));
    } catch (e) { if (e.login) $('loginSheet').classList.add('show'); else if (!e.app) toast(e.message, true, 5000); }
    refresh();
  }
  async function stopOne(id) {
    const p = pl.find(x => x.id === id);
    try {
      const r = info.stopFree ? await post('stop', { platz: id }) : await withPin(`${p ? p.name : 'Platz'} stoppen`, pin => post('stop', { platz: id, pin }));
      if (r) toast(`${p ? p.name : 'Platz'} gestoppt`);
    } catch (e) { if (e.login) $('loginSheet').classList.add('show'); else if (!e.app) toast(e.message || 'Fehler beim Stoppen – bitte erneut versuchen!', true, 5000); }
    refresh();
  }
  $('stop').onclick = async () => {
    try {
      const r = info.stopFree ? await post('stop', {}) : await withPin('Alle Zonen ausschalten', pin => post('stop', { pin }));
      if (r) toast('Alle Zonen ausgeschaltet');
    } catch (e) { if (!e.app) toast(e.message || 'Fehler beim Stoppen – bitte erneut versuchen!', true, 5000); }
    refresh();
  };

  /* ---------- Anmeldung (gesperrter Modus) ---------- */
  async function submitLogin() {
    $('loginErr').textContent = 'Prüfe …';
    try { await post('login', { username: $('loginUser').value.trim(), password: $('loginPw').value }); }
    catch (e) { $('loginErr').textContent = e.message; $('loginPw').value = ''; return; }
    $('loginPw').value = ''; $('loginSheet').classList.remove('show');
    await loadInfo(); refresh();
  }
  $('loginOk').onclick = submitLogin;
  $('loginPw').addEventListener('keydown', e => { if (e.key === 'Enter') submitLogin(); });

  async function loadInfo() {
    info = await (await fetch(API + 'info', { credentials: 'same-origin' })).json();
    if (!embedded) $('club').textContent = info.club || '';   // am Tablet setzt die gemeinsame Kopfzeile den Vereinsnamen (gleiche id)
    $('subtitle').textContent = info.subtitle || '';
    document.title = `${info.appName || 'Beregnung'} – ${info.club || ''}`;
    const w = $('who');
    if (info.mode === 'login' && info.user) {
      w.innerHTML = `Angemeldet als ${esc(info.user)} · <a href="#" id="logout">Abmelden</a>`; w.classList.remove('hidden');
      $('logout').onclick = async e => { e.preventDefault(); await post('logout').catch(() => {}); location.reload(); };
    } else w.classList.add('hidden');
  }

  window.addEventListener('load', async () => {
    try { await loadInfo(); } catch (e) { $('dot').className = 'vh-dot err'; $('st').textContent = 'Keine Verbindung zum Server'; setTimeout(() => location.reload(), 15000); return; }
    if (info.mode === 'app') { lock(); return; }
    if (info.mode === 'login' && !info.user) { $('loginSheet').classList.add('show'); return; }
    // Eigene Webapp mit Vereins-PIN: wie bisher beim Öffnen anmelden. Am Tablet: Plätze sofort sichtbar, PIN erst beim Starten.
    if (info.mode === 'pin' && !embedded) {
      let pin = sess.get();
      while (true) {
        if (!pin) { try { pin = await askPin('PIN eingeben', 'Bitte mit deiner PIN anmelden, um die Beregnung zu bedienen.', true); } catch (e) { return; } }
        try { await post('verify-pin', { pin }); sess.set(pin); break; } catch (e) { pin = ''; toast(e.message, true); if (!e.pin) break; }
      }
    }
    refresh();
  });
})();
