'use strict';
/* Mitglieder-App: ein QR-Code, eine PIN, alle freigeschalteten Bereiche (Zugang, Beregnung …).
   Bereiche melden sich mit VA.registerSection({ id, render(el, ctx) }) aus /m/<id>/member.js an. */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const store = { get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* privat */ } } };
  // Die PIN bleibt nur im Speicher dieser Seite (bis sie neu geladen wird) – nicht im sessionStorage, der auf dem Home-Bildschirm
  // faktisch dauerhaft wäre und bei Gerätezugriff auslesbar ist
  let pinMem = '';
  const sess = { get() { return pinMem; }, set(v) { pinMem = String(v || ''); }, del() { pinMem = ''; } };
  const dev = () => store.get('va_geraet');
  const hdrs = (x = {}) => { const h = { ...x }; if (dev()) h['X-Geraet'] = dev(); return h; };

  function toast(msg, err = false, ms = 3500) { const t = $('toast'); t.textContent = msg; t.className = 'vh-toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms); }
  function lock(text) { if (text) $('lockText').textContent = text; $('lockSheet').classList.add('show'); }

  /* Im Vereinsheim direkt über das WLAN (lokale HTTPS-Adresse, Einstellung „Adresse im Vereins-WLAN“) statt über den Tunnel:
     schneller, und Bereiche „nur im Vereins-WLAN“ (Beregnung, Türen) funktionieren – unabhängig von Privat-Relay o. Ä. */
  let BASE = '';
  const api = u => BASE + u;
  let lanProbe = null;   // Ergebnis der Prüfung der lokalen Adresse (für den Hinweis „Nur im Vereins-WLAN“)
  async function probeLan(lanUrl) {
    if (!lanUrl || location.origin === lanUrl) return false;
    // zwei Versuche: der erste HTTPS-Aufbau zu einer neuen Adresse dauert auf manchen Handys länger
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(lanUrl + '/api/ping', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
        const d = await r.json();
        if (d && d.app === 'clubwerk' && d.wlan) { lanProbe = { ok: true }; return true; }
        lanProbe = { ok: false, why: d && d.app === 'clubwerk' ? 'antwortet, gilt dort aber nicht als Vereins-WLAN' : 'antwortet, ist aber kein Clubwerk' };
        return false;
      } catch (e) { lanProbe = { ok: false, why: e && e.name === 'TimeoutError' ? 'keine Antwort (Zeitüberschreitung)' : 'nicht erreichbar' + (e && e.message ? ' (' + e.message + ')' : '') }; }
    }
    return false;
  }
  async function call(url, method = 'GET', body) {
    const r = await fetch(api('api/' + url), { method, headers: hdrs(body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (r.status === 403 && d.device) { lock(d.error); throw Object.assign(new Error(d.error), { device: true }); }
    if (r.status === 429) { sess.del(); throw Object.assign(new Error(d.error || 'Zu viele Versuche – bitte warten.'), { status: 429, data: d }); }
    if (r.status === 401 && d.pin) { sess.del(); throw Object.assign(new Error(d.error || 'Falsche PIN'), { pin: true }); }
    if (!r.ok) throw Object.assign(new Error(d.error || `Fehler ${r.status}`), { status: r.status, data: d });
    return d;
  }

  /* ---------- PIN: einmal je Sitzung, bei Fehler neu ---------- */
  let pinCb = null;
  function askPin(title) {
    return new Promise((resolve, reject) => {
      $('pinTitle').textContent = title || 'PIN eingeben';
      $('pinErr').textContent = ''; $('pinIn').value = '';
      // immer zuoberst: Bereiche hängen eigene Blätter (z. B. „Meine Daten“) später an den Body – gleiche z-Ebene, deshalb ans Ende rücken
      document.body.appendChild($('pinSheet'));
      $('pinSheet').classList.add('show');
      pinCb = { resolve, reject };
      setTimeout(() => $('pinIn').focus(), 80);
    });
  }
  $('pinOk').onclick = () => { const v = $('pinIn').value.trim(); if (!v) { $('pinErr').textContent = 'Bitte PIN eingeben'; return; } $('pinSheet').classList.remove('show'); const c = pinCb; pinCb = null; if (c) c.resolve(v); };
  $('pinNo').onclick = () => { $('pinSheet').classList.remove('show'); const c = pinCb; pinCb = null; if (c) c.reject(Object.assign(new Error('abgebrochen'), { cancel: true })); };
  $('pinIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('pinOk').click(); });
  /** Aktion mit PIN ausführen: fn(pin) → Promise. Fragt die PIN nur, wenn noch keine in dieser Sitzung bestätigt wurde. */
  async function withPin(title, fn) {
    let pin = sess.get();
    for (let i = 0; i < 4; i++) {
      if (!pin) { try { pin = await askPin(title); } catch (e) { return null; } }
      try { const r = await fn(pin); sess.set(pin); return r; }
      catch (e) {
        if (e.pin) { pin = ''; toast(e.message, true); continue; }
        throw e;
      }
    }
    return null;
  }

  /* ---------- Bereiche ---------- */
  const SECTIONS = {};
  window.VA = { registerSection(s) { SECTIONS[s.id] = s; } };
  let me = null, current = null, cleanup = null;
  const loadScript = src => new Promise(res => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = res; document.body.appendChild(s); });

  const WLAN_T = 'Nur im Vereins-WLAN';
  function show(id) {
    if (cleanup) { try { cleanup(); } catch (e) { /* egal */ } cleanup = null; }
    current = id; store.set('va_tab', id);
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === id));
    const s = me.sections.find(x => x.id === id);
    const el = $('sec');
    if (!s) { el.innerHTML = ''; return; }
    if (!s.ok && s.wlanOnly) { el.innerHTML = `<div class="vh-wlan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/></svg><b>${esc(WLAN_T)}</b><span>${esc(s.title)} funktioniert nur, wenn dein Handy im WLAN des Vereinsheims ist. Dort einfach die App öffnen – alles andere geht auch unterwegs.</span>${me.lanUrl ? `<small class="vh-wlan-diag">Lokale Adresse ${esc(me.lanUrl)}: ${lanProbe ? (lanProbe.ok ? 'erreichbar' : esc(lanProbe.why)) : 'nicht geprüft (Handy bereits im WLAN)'}</small>` : ''}</div>`; return; }
    if (!s.ok) { el.innerHTML = `<div class="vh-empty">${esc(s.reason)}</div>`; return; }
    const sec = SECTIONS[id];
    if (!sec) { el.innerHTML = '<div class="vh-empty">Dieser Bereich konnte nicht geladen werden.</div>'; return; }
    el.innerHTML = '';
    const ctx = {
      api: (p, method, body) => call(`m/${id}/${p}`, method, body), withPin, toast, esc, member: me.member,
      onLeave: fn => { cleanup = fn; },
    };
    try { sec.render(el, ctx); } catch (e) { el.innerHTML = `<div class="vh-empty">Fehler: ${esc(e.message)}</div>`; }
  }

  async function start() {
    me = await call('me');
    if (!me.wlan && me.lanUrl && await probeLan(me.lanUrl)) { BASE = me.lanUrl + '/'; me = await call('me'); }   // im Vereinsheim: ab jetzt lokal
    $('club').textContent = me.club;
    document.title = `${me.appName} – ${me.club}`;
    if (!me.member) { lock(); return; }
    $('who').textContent = me.member;
    initPhoto();
    if (!me.sections.length) { $('sec').innerHTML = '<div class="vh-empty">Für dich ist noch nichts freigeschaltet. Bitte beim Vorstand melden.</div>'; return; }
    for (const s of me.sections) if (s.ok) await loadScript(`m/${s.id}/member.js`);
    const tabs = $('tabs');
    const TI = { buchung: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h3v3h-3z"/>', zugang: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M15 8l2 2"/>',
      beregnung: '<path d="M12 2.5S5.5 9.6 5.5 14a6.5 6.5 0 0 0 13 0C18.5 9.6 12 2.5 12 2.5z"/>', mitglieder: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 16.5a3.5 3.5 0 0 1 7 0M15 10h4M15 14h3"/>', arbeitseinsatz: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 1.3-1.3a4 4 0 0 0-5-5L5 13 3 11l8-8 2 2z"/><path d="m9 15-4 4"/>' };
    const ti = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TI[id] || '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'}</svg>`;
    tabs.innerHTML = me.sections.map(s => `<button data-t="${s.id}"${s.wlanOnly ? ` class="wlan" title="${esc(WLAN_T)}"` : ''}>${ti(s.id)}<span>${esc(s.title)}</span></button>`).join('');
    tabs.classList.toggle('hidden', me.sections.length < 2);
    tabs.querySelectorAll('button').forEach(b => b.onclick = () => show(b.dataset.t));
    const last = store.get('va_tab');
    const first = (me.sections.find(s => s.ok) || me.sections[0]).id;
    show(me.sections.some(s => s.id === last && s.ok) ? last : first);
  }

  /* ---------- Bilder mit Anmeldung (Profilbilder): <img data-auth-src="api/…"> – geladen mit dem Geräteschlüssel, angezeigt als data:-Adresse ---------- */
  const imgCache = new Map();
  const loadAuthImg = async img => {
    const u = img.getAttribute('data-auth-src'); if (!u || img.dataset.loaded === u) return; img.dataset.loaded = u;
    try {
      if (!imgCache.has(u)) imgCache.set(u, fetch(api(u), { headers: hdrs() }).then(r => (r.ok ? r.blob() : null)).then(b => (b ? new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b); }) : null)));
      const d = await imgCache.get(u); if (d) img.src = d; else img.style.visibility = 'hidden';
    } catch (e) { /* ohne Bild */ }
  };
  const scanImgs = root => (root.querySelectorAll ? root.querySelectorAll('img[data-auth-src]') : []).forEach(loadAuthImg);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches && n.matches('img[data-auth-src]')) loadAuthImg(n); scanImgs(n); } }))).observe(document.body, { childList: true, subtree: true });

  /* ---------- Profilbild: selbst hochladen, selbst bestimmen, wo es erscheint ---------- */
  const initials = n => String(n || '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  async function initPhoto() {
    const b = $('ava'); if (!b) return;
    let p; try { p = await call('photo'); } catch (e) { return; }
    const paint = () => { b.innerHTML = p.has ? `<img data-auth-src="api/photo/img?v=${esc(p.v || '')}" alt="">` : esc(initials(me.member)); b.classList.remove('hidden'); };
    paint();
    b.onclick = () => photoSheet(p, x => { p = x; paint(); });
  }
  /** Bild im Handy quadratisch auf 400 × 400 verkleinern → data:image/jpeg */
  const shrink = file => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
    fr.onload = () => { const img = new Image(); img.onerror = () => reject(new Error('Dieses Bildformat geht leider nicht – bitte ein JPEG oder PNG wählen.'));
      img.onload = () => { const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas'); c.width = c.height = 400;
        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 400, 400);
        let q = 0.86, out = c.toDataURL('image/jpeg', q); while (out.length > 480000 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); } resolve(out); };
      img.src = fr.result; };
    fr.readAsDataURL(file);
  });
  function photoSheet(p, done) {
    let sh = $('photoSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'photoSheet'; sh.className = 'vh-sheet'; document.body.appendChild(sh); }
    let data = null, use = new Set(p.use);
    const draw = () => {
      sh.innerHTML = `<div class="vh-box"><h2>Profilbild</h2><div class="vh-photo">${data ? `<img src="${data}" alt="">` : p.has ? `<img data-auth-src="api/photo/img?v=${esc(p.v || '')}" alt="">` : esc(initials(me.member))}</div>
        <label class="vh-pick">${p.has || data ? 'Anderes Foto wählen' : 'Foto aufnehmen oder wählen'}<input type="file" accept="image/*" id="phF"></label>
        ${p.uses.length ? `<p class="vh-small" style="margin:0 0 6px;text-align:left">Zeigen bei:</p><div class="vh-uses">${p.uses.map(u => `<label><input type="checkbox" data-u="${u.k}" ${use.has(u.k) ? 'checked' : ''}> ${esc(u.l)}</label>`).join('')}</div>` : ''}
        <p class="vh-small" style="text-align:left">Nur angehakte Bereiche zeigen dein Bild. Die Verwaltung sieht es bei deinen Mitgliedsdaten.</p>
        <div class="vh-err" id="phE"></div>
        <div class="vh-row">${p.has ? '<button class="no" id="phDel">Entfernen</button>' : '<button class="no" id="phNo">Abbrechen</button>'}<button class="ok" id="phOk">Speichern</button></div>
        ${p.has ? '<div class="vh-row" style="margin-top:8px"><button class="no" id="phNo" style="flex:1">Schließen</button></div>' : ''}</div>`;
      sh.querySelector('#phF').onchange = async e => { const f = e.target.files && e.target.files[0]; if (!f) return; try { data = await shrink(f); if (!use.size) p.uses.forEach(u => use.add(u.k)); draw(); } catch (x) { sh.querySelector('#phE').textContent = x.message; } };
      sh.querySelectorAll('[data-u]').forEach(c => { c.onchange = () => { if (c.checked) use.add(c.dataset.u); else use.delete(c.dataset.u); }; });
      sh.querySelector('#phNo').onclick = () => sh.classList.remove('show');
      if (sh.querySelector('#phDel')) sh.querySelector('#phDel').onclick = async () => { try { await call('photo', 'DELETE'); const x = await call('photo'); sh.classList.remove('show'); toast('Profilbild entfernt.'); done(x); } catch (e) { sh.querySelector('#phE').textContent = e.message; } };
      sh.querySelector('#phOk').onclick = async () => {
        if (!data && !p.has) { sh.querySelector('#phE').textContent = 'Bitte zuerst ein Foto wählen.'; return; }
        try { const x = await call('photo', 'PUT', { data: data || undefined, use: [...use] }); sh.classList.remove('show'); toast('Gespeichert.'); done(x); } catch (e) { sh.querySelector('#phE').textContent = e.message; }
      };
    };
    draw(); sh.classList.add('show');
  }

  /* ---------- Übernahme in die Home-Bildschirm-App (iPhone: eigener Speicher je Home-Bildschirm-App) ---------- */
  const standalone = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const fmtCode = c => c.slice(0, 5) + '-' + c.slice(5);
  async function prepareTransfer() {
    if (standalone() || !dev()) return;
    try {
      const r = await call('transfer', 'POST', {});
      // Startadresse der Home-Bildschirm-App mit Code (Manifest und aktuelle Adresse – je nach iOS-Version zählt das eine oder das andere)
      const m = document.querySelector('link[rel="manifest"]'); if (m) m.setAttribute('href', 'manifest.json?k=' + r.code);
      history.replaceState(null, '', location.pathname + location.search + '#k=' + r.code);
      if (isIOS && store.get('va_hint_off') !== '1') { $('installCode').textContent = fmtCode(r.code); $('installHint').classList.remove('hidden'); }
    } catch (e) { /* kein Code – App lässt sich trotzdem per QR neu freischalten */ }
  }
  $('installCopy').onclick = async () => {
    const code = $('installCode').textContent.trim();
    try { await navigator.clipboard.writeText(code); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('installCode')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); try { document.execCommand('copy'); } catch (x) { /* egal */ } }
    toast('Code kopiert.');
  };
  $('installX').onclick = () => { $('installHint').classList.add('hidden'); store.set('va_hint_off', '1'); };
  function transferFlow(code) {
    $('lockSheet').classList.remove('show');
    $('trCode').value = code ? fmtCode(code) : '';
    $('trCode').classList.toggle('hidden', Boolean(code));
    $('trText').textContent = code ? 'Gib deine PIN ein, um die Freischaltung in diese App zu übernehmen.' : 'Den Übernahme-Code findest du auf der Seite in Safari, auf der du freigeschaltet hast. Dazu deine PIN.';
    $('trErr').textContent = ''; $('trPin').value = '';
    $('trSheet').classList.add('show');
    setTimeout(() => (code ? $('trPin') : $('trCode')).focus(), 80);
  }
  /* Sprache: folgt dem Handy (falls vorhanden), sonst dem Verein – hier frei wählbar */
  (function langUi() {
    const L = window.CWI18N; if (!L || !L.langs || L.langs.length < 2) return;
    const cur = L.chosen();
    $('langCur').textContent = (L.langs.find(x => x.code === L.lang) || { name: L.lang }).name;
    $('langFoot').classList.remove('hidden');
    $('langList').innerHTML = [['', L.T('Automatisch')], ...L.langs.map(x => [x.code, x.name])].map(([c, n]) => `<button type="button" class="vh-lang${c === cur ? ' on' : ''}" data-lang="${esc(c)}"${c ? ' translate="no"' : ''}>${esc(n)}</button>`).join('');
    $('langBtn').onclick = () => $('langSheet').classList.add('show');
    $('langNo').onclick = () => $('langSheet').classList.remove('show');
    $('langList').onclick = e => { const b = e.target.closest('[data-lang]'); if (!b) return; if (b.dataset.lang === cur) { $('langSheet').classList.remove('show'); return; } L.setLang(b.dataset.lang); };
  })();
  $('lockCode').onclick = () => transferFlow('');
  $('trNo').onclick = () => { $('trSheet').classList.remove('show'); lock(); };
  $('trPin').addEventListener('keydown', e => { if (e.key === 'Enter') $('trOk').click(); });
  $('trOk').onclick = async () => {
    const code = $('trCode').value.toUpperCase().replace(/[^A-Z0-9]/g, ''), pin = $('trPin').value.trim();
    if (code.length !== 10) { $('trErr').textContent = 'Der Code hat 10 Zeichen.'; return; }
    if (!/^\d{4,8}$/.test(pin)) { $('trErr').textContent = 'Bitte deine PIN eingeben.'; return; }
    $('trErr').textContent = 'Übernehme …';
    try {
      const r = await call('transfer/redeem', 'POST', { code, pin });
      store.set('va_geraet', r.device);
      if (dev() !== r.device) { $('trErr').textContent = 'Diese App kann nichts speichern – bitte in den Einstellungen prüfen.'; return; }
      sess.set(pin);
      history.replaceState(null, '', location.pathname + location.search);
      $('trSheet').classList.remove('show');
      toast('Freigeschaltet – willkommen!', false, 4000);
      start().catch(e => toast(e.message, true));
    } catch (e) { $('trErr').textContent = e.message; if (e.data && e.data.badCode) { $('trCode').classList.remove('hidden'); } }
  };

  /* ---------- Einladung per QR-Code ---------- */
  let inviteToken = '';
  async function pair(t) {
    inviteToken = t;
    history.replaceState(null, '', location.pathname + location.search);   // Einladung nicht in Lesezeichen/Verlauf behalten
    try {
      const p = await call('invite?t=' + encodeURIComponent(t));
      $('pairTitle').textContent = `Hallo ${p.member}`;
      $('pairSheet').classList.add('show');
      setTimeout(() => $('pair1').focus(), 80);
    } catch (e) {
      if (dev()) { toast(e.message, true, 6000); start().catch(err => toast(err.message, true)); } else lock(e.message);
    }
  }
  $('pairOk').onclick = async () => {
    const a = $('pair1').value.trim(), b = $('pair2').value.trim();
    if (!/^\d{4,8}$/.test(a)) { $('pairErr').textContent = 'Bitte 4 bis 8 Ziffern'; return; }
    if (a !== b) { $('pairErr').textContent = 'Die beiden Eingaben stimmen nicht überein'; $('pair2').value = ''; return; }
    $('pairErr').textContent = 'Schalte frei …';
    try {
      const r = await call('pair', 'POST', { t: inviteToken, pin: a });
      store.set('va_geraet', r.device);
      if (dev() !== r.device) { $('pairErr').textContent = 'Der Browser speichert nichts (privater Modus?) – bitte normal öffnen.'; return; }
      sess.set(a);
      $('pairSheet').classList.remove('show');
      toast('Freigeschaltet – lege die Seite jetzt auf den Home-Bildschirm.', false, 6000);
      start().then(prepareTransfer).catch(e => toast(e.message, true));
    } catch (e) { $('pairErr').textContent = e.message; }
  };
  $('pair2').addEventListener('keydown', e => { if (e.key === 'Enter') $('pairOk').click(); });
  $('pair1').addEventListener('keydown', e => { if (e.key === 'Enter') $('pair2').focus(); });

  // Logo
  const lg = $('logo'); lg.onload = () => $('logoBox').classList.remove('hidden'); lg.src = 'logo';

  window.addEventListener('load', () => {
    const m = location.hash.match(/[#&]i=([A-Za-z0-9_-]{10,60})/);
    if (m) { call('me').then(x => { $('club').textContent = x.club; }).catch(() => {}); pair(m[1]); return; }
    const k = location.hash.match(/[#&]k=([A-Z2-9]{10})/);
    (async () => {
      // Startadresse mit Übernahme-Code: ist dieses Gerät schon freigeschaltet, einfach starten – sonst PIN abfragen und übernehmen
      if (k) {
        let ok = false;
        if (dev()) { try { ok = Boolean((await call('me')).member); } catch (e) { ok = false; } }
        if (!ok) { call('me').then(x => { $('club').textContent = x.club; }).catch(() => {}); transferFlow(k[1]); return; }
      }
      await start();
      if (me && me.member) prepareTransfer();
    })().catch(e => { if (!e.device) toast('Keine Verbindung zum Server', true); });
  });
})();
