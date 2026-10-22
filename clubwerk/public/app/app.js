'use strict';
/* Mitglieder-App: ein QR-Code, eine PIN, alle freigeschalteten Bereiche (Zugang, Beregnung …).
   Bereiche melden sich mit VA.registerSection({ id, render(el, ctx) }) aus /m/<id>/member.js an. */
(() => {
  const APP_VER = '3.35.0';   // muss zur Version in config.yaml passen (pack.sh prüft das) – eine veraltete Home-Bildschirm-App lädt sich damit einmal neu
  const $ = id => document.getElementById(id);
  /* Inlay-Modus: die öffentliche App bettet im Vereinsheim die lokale Adresse ein und zeigt dort nur einen Bereich
     (?embed=<bereich>) – ohne Kopf, Reiter und Fußzeile; Größe und Zustand gehen per postMessage an die einbettende Seite */
  const EMBED = (() => { const m = location.search.match(/[?&]embed=([a-z0-9_-]{1,40})/); return m ? m[1] : ''; })();
  const embedPost = (type, extra = {}) => { if (EMBED && window.parent !== window) { try { window.parent.postMessage({ clubwerk: 'embed', type, ...extra }, '*'); } catch (e) { /* egal */ } } };
  if (EMBED) {
    document.documentElement.classList.add('vh-embed');
    let lastH = 0;
    const sendSize = () => {   // Inhalt plus ggf. ein offenes Blatt (PIN, Hinweis) – das liegt fest über der Seite und zählt sonst nicht mit
      const sheet = Math.max(0, ...[...document.querySelectorAll('.vh-sheet.show .vh-box')].map(b => b.offsetHeight + 80));
      const main = document.querySelector('.vh-main');
      const content = main ? main.offsetTop + main.scrollHeight : document.documentElement.scrollHeight;
      const h = Math.ceil(Math.max(content, sheet, 240));
      if (h !== lastH) { lastH = h; embedPost('size', { height: h }); }
    };
    try { new ResizeObserver(sendSize).observe(document.body); } catch (e) { /* unten der Zeitgeber */ }
    setInterval(sendSize, 700);
    window.addEventListener('load', sendSize);
  }
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
    const opts = { method, headers: hdrs(body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined };
    let r;
    try { r = await fetch(api('api/' + url), opts); } catch (e) {
      // Verbindung abgerissen („Load failed“): Abfragen im Vereins-WLAN einmal über die öffentliche Adresse wiederholen;
      // Änderungen (Buchen …) nicht blind wiederholen – das Mitglied sieht nach und tippt ggf. noch einmal
      if (BASE && method === 'GET') { const keep = BASE; BASE = ''; try { r = await fetch(api('api/' + url), opts); } catch (e2) { r = null; } if (!r) BASE = keep; }
      if (!r) throw Object.assign(new Error(method === 'GET' ? 'Keine Verbindung zum Verein – bitte gleich noch einmal versuchen.' : 'Keine Antwort vom Verein – bitte kurz prüfen, ob es angekommen ist, und sonst noch einmal versuchen.'), { network: true });
    }
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
  /* Lokale Adresse als Inlay: ein Rahmen mit nur diesem Bereich (?embed=…), Kopplung per Übergabecode im Fragment.
     Meldet sich der Rahmen nicht binnen 8 s, bleibt der Hinweis stehen und es gibt den Ausweg „in Safari öffnen“. */
  let embedFrame = null, embedOrigin = '', embedWorked = false;   // hat das Inlay einmal geantwortet, öffnet es sich beim nächsten Antippen von selbst
  function embedLocal(el, id, r) {
    const url = r.url + '/?embed=' + encodeURIComponent(id) + '#h=' + r.code;
    embedOrigin = new URL(r.url).origin;
    el.innerHTML = `<div class="vh-embedwrap"><iframe class="vh-embedframe" title="${esc(me.club)}" allow="" referrerpolicy="origin"></iframe>
      <div class="vh-embedwait" id="embWait"><span>Verbinde mit der lokalen Adresse …</span></div></div>`;
    const f = el.querySelector('iframe'); embedFrame = f; f.src = url;
    const wait = $('embWait');
    const timer = setTimeout(() => { if (wait && !wait.classList.contains('ok')) wait.innerHTML = `<span>Die lokale Adresse antwortet nicht – bist du im Vereins-WLAN? Dort kurz warten oder den Bereich noch einmal antippen.</span><button type="button" class="vh-btn sec" id="embBack">Zurück</button>`;
      embedWorked = false; const b = $('embBack'); if (b) b.onclick = () => show(id); }, 8000);
    f.dataset.timer = String(timer);
    cleanup = () => { clearTimeout(timer); embedFrame = null; };
  }
  window.addEventListener('message', ev => {
    if (!embedFrame || ev.origin !== embedOrigin || !ev.data || ev.data.clubwerk !== 'embed') return;
    if (ev.data.type === 'size' && Number(ev.data.height) > 0) { embedWorked = true; embedFrame.style.height = Math.min(4000, Math.max(300, Number(ev.data.height))) + 'px'; const w = $('embWait'); if (w) { w.classList.add('ok'); w.remove(); } clearTimeout(Number(embedFrame.dataset.timer)); }
  });
  function show(id) {
    if (cleanup) { try { cleanup(); } catch (e) { /* egal */ } cleanup = null; }
    current = id; if (!EMBED) store.set('va_tab', id);
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === id));
    const s = me.sections.find(x => x.id === id);
    const el = $('sec');
    if (!s) { el.innerHTML = ''; return; }
    if (!s.ok && s.wlanOnly && embedWorked && me.lanUrl && !me.wlan) { el.innerHTML = ''; call('handover', 'POST', {}).then(r => { if (current === id) embedLocal(el, id, r); }).catch(() => { embedWorked = false; show(id); }); return; }
    if (!s.ok && s.wlanOnly) { el.innerHTML = `<div class="vh-wlan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/></svg><b>${esc(WLAN_T)}</b><span>${esc(s.title)} funktioniert nur, wenn dein Handy im WLAN des Vereinsheims ist. Dort einfach die App öffnen – alles andere geht auch unterwegs.</span>${me.lanUrl && !me.wlan ? `<button class="vh-btn" id="lanGo">Im Vereinsheim lokal öffnen</button><small class="vh-wlan-diag">Bist du gerade im Vereinsheim? Dann öffnet dieser Knopf die App über die lokale Adresse – mit deiner PIN. Lokale Adresse ${esc(me.lanUrl)}: ${lanProbe ? (lanProbe.ok ? 'erreichbar' : esc(lanProbe.why)) : 'wird geprüft …'}</small>` : ''}</div>`;
      wlanRetry(id);
      const g = $('lanGo'); if (g) g.onclick = async () => { g.disabled = true; try { const r = await call('handover', 'POST', {}); embedLocal(el, id, r); } catch (e) { toast(e.message, true); g.disabled = false; } };
      return; }
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

  /* Lokale Route im Hintergrund prüfen – die Inhalte erscheinen sofort über die aktuelle Adresse; klappt die Prüfung,
     wechselt die App auf die lokale Adresse und gibt WLAN-Bereiche frei (draußen läuft die Prüfung einfach ins Leere) */
  let probing = null, lastProbeAt = 0, wlanTries = 0, wlanTimer = null;
  /* WLAN-Bereich offen, lokale Adresse noch nicht erreicht: sofort und dann noch einige Male nachprüfen – das Handy wechselt
     oft erst ein paar Sekunden nach dem Öffnen der App vom Mobilfunk ins Vereins-WLAN (vorher scheitert die Prüfung mit „Load failed“) */
  function wlanRetry(id) {
    clearTimeout(wlanTimer);
    if (!me || me.wlan || !me.lanUrl || BASE || wlanTries >= 5) return;
    const wait = wlanTries === 0 ? 0 : 6000;
    wlanTries++;
    wlanTimer = setTimeout(() => { if (current === id && document.visibilityState === 'visible') probeInBackground(true); }, wait);
  }
  function probeInBackground(force = false) {
    if (probing || !me || me.wlan || !me.lanUrl || BASE) return;
    if (!force && Date.now() - lastProbeAt < 20000) return;
    lastProbeAt = Date.now();
    probing = probeLan(me.lanUrl).then(async ok => {
      if (!ok) { if (current && me.sections.some(x => x.id === current && x.wlanOnly)) show(current); return; }   // Diagnosezeile aktualisieren
      BASE = me.lanUrl + '/';
      try { me = await call('me'); } catch (e) { BASE = ''; return; }
      renderTabs();
      if (current) show(current);
    }).catch(() => {}).finally(() => { probing = null; });
  }
  // Netzwechsel (Mobilfunk → Vereins-WLAN) oder App wieder im Vordergrund: lokale Adresse erneut prüfen, WLAN-Bereiche ggf. freigeben
  /* Vereinsfarbe übernehmen: beim Start (Antwort von /me) und wenn die App wieder in den Vordergrund kommt –
     eine Home-Bildschirm-App „startet“ meist so, ohne neu zu laden. Keine regelmäßige Abfrage. */
  let appCol = ((document.querySelector('meta[name="theme-color"]') || {}).content || '').toLowerCase();
  function applyColor(c) {
    c = String(c || '').toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(c) || c === appCol) return;
    appCol = c;
    const l = document.querySelector('link[rel="stylesheet"][href^="theme.css"]');
    if (l) { const n = l.cloneNode(); n.href = `theme.css?c=${c.slice(1)}`; n.onload = () => l.remove(); l.after(n); }   // neue Farben laden, alte erst danach entfernen – kein Flackern
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = c;
  }
  const colorCheck = () => { if (document.visibilityState === 'visible') call('ping').then(x => applyColor(x.color)).catch(() => {}); };
  const recheck = () => { if (document.visibilityState !== 'visible') return; colorCheck(); lanProbe = null; wlanTries = 0; probeInBackground(true); if (current && !embedFrame && me && me.sections.some(x => x.id === current && x.wlanOnly)) show(current); };
  document.addEventListener('visibilitychange', recheck);
  window.addEventListener('online', recheck);
  window.addEventListener('pageshow', e => { if (e.persisted) recheck(); });
  async function start() {
    me = await call('me');
    applyColor(me.color);
    // Home-Bildschirm-Apps halten alte Skripte manchmal lange fest: stimmt die Version nicht mit dem Server überein, einmal neu laden
    if (me.version && me.version !== APP_VER) { let done = false; try { done = sessionStorage.getItem('va_reloaded') === me.version; sessionStorage.setItem('va_reloaded', me.version); } catch (e) { done = true; } if (!done) { location.reload(); return; } }
    $('club').textContent = me.club;
    document.title = `${me.appName} – ${me.club}`;
    if (!me.member) { lock(); return; }
    $('who').textContent = me.member;
    initPhoto();
    if (!me.sections.length) { $('sec').innerHTML = '<div class="vh-empty">Für dich ist noch nichts freigeschaltet. Bitte beim Vorstand melden.</div>'; return; }
    for (const s of me.sections) if (s.ok) await loadScript(`m/${s.id}/member.js?v=${encodeURIComponent(me.version || APP_VER)}`);
    renderTabs();
    if (EMBED) {   // Inlay: nur der gewünschte Bereich, keine Reiter/Fußzeile; Tab-Wahl nicht merken
      $('tabs').classList.add('hidden');
      const s0 = me.sections.find(s => s.id === EMBED);
      if (!s0) { $('sec').innerHTML = '<div class="vh-empty">Dieser Bereich ist für dich nicht freigeschaltet.</div>'; embedPost('size', { height: 200 }); return; }
      show(EMBED); embedPost('ready');
      return;
    }
    // Startseite: fester Bereich (Verwaltung → Mitglieder-App → Bereiche) oder der zuletzt genutzte; sonst der erste verfügbare
    const last = store.get('va_tab'), okId = id => id && me.sections.some(s => s.id === id && s.ok);
    const first = (me.sections.find(s => s.ok) || me.sections[0]).id;
    show(okId(me.start) ? me.start : okId(last) ? last : first);
    probeInBackground();
  }
  async function renderTabs() {
    for (const s of me.sections) if (s.ok && !SECTIONS[s.id]) { try { await loadScript(`m/${s.id}/member.js?v=${encodeURIComponent(me.version || APP_VER)}`); } catch (e) { /* Bereich bleibt leer */ } }
    const tabs = $('tabs');
    const TI = { buchung: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h3v3h-3z"/>', zugang: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M15 8l2 2"/>',
      beregnung: '<path d="M12 2.5S5.5 9.6 5.5 14a6.5 6.5 0 0 0 13 0C18.5 9.6 12 2.5 12 2.5z"/>', mitglieder: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 16.5a3.5 3.5 0 0 1 7 0M15 10h4M15 14h3"/>', arbeitseinsatz: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 1.3-1.3a4 4 0 0 0-5-5L5 13 3 11l8-8 2 2z"/><path d="m9 15-4 4"/>' };
    const ti = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TI[id] || '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'}</svg>`;
    // viele Bereiche: zweiteilige Namen in der Leiste kurz („Meine Daten“ → „Daten“), damit alle Beschriftungen einzeilig bleiben
    const shortT = t => (me.sections.length >= 6 && t.length > 9 && t.includes(' ') ? t.split(' ').pop() : t);
    tabs.innerHTML = me.sections.map(s => `<button data-t="${s.id}"${s.wlanOnly ? ` class="wlan" title="${esc(WLAN_T)}"` : ` title="${esc(s.title)}"`} aria-label="${esc(s.title)}">${ti(s.id)}<span>${esc(shortT(s.title))}</span></button>`).join('');
    tabs.classList.toggle('hidden', me.sections.length < 2);
    tabs.querySelectorAll('button').forEach(b => b.onclick = () => { wlanTries = 0; show(b.dataset.t); });
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
    b.onclick = () => accountSheet(() => photoSheet(p, x => { p = x; paint(); }));
  }
  /* ---------- Konto-Menü hinter dem Profilbild: Profilbild, Benachrichtigungen ---------- */
  function accountSheet(openPhoto) {
    let sh = $('accSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'accSheet'; sh.className = 'vh-sheet'; document.body.appendChild(sh); }
    sh.innerHTML = `<div class="vh-box"><h2>${esc(me.member)}</h2><div class="vh-menu">
        <button type="button" id="accPhoto">Profilbild</button>
        <button type="button" id="accPush">Benachrichtigungen</button></div>
      <p class="vh-small" style="margin:10px 0 0">Clubwerk ${esc(APP_VER)}${me.version && me.version !== APP_VER ? ' · Server ' + esc(me.version) : ''}</p>
      <div class="vh-row" style="margin-top:10px"><button class="no" id="accNo" style="flex:1">Schließen</button></div></div>`;
    sh.querySelector('#accNo').onclick = () => sh.classList.remove('show');
    sh.querySelector('#accPhoto').onclick = () => { sh.classList.remove('show'); openPhoto(); };
    sh.querySelector('#accPush').onclick = () => { sh.classList.remove('show'); notifSheet().catch(e => toast(e.message, true)); };
    sh.classList.add('show');
  }

  /* ---------- Push-Benachrichtigungen: Abo je Handy, Anlässe je Mitglied (nur die vom Vorstand freigegebenen) ---------- */
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const b64ToBytes = s => { const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  async function swReady() { const reg = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; return reg; }
  async function notifSheet() {
    let sh = $('pushSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'pushSheet'; sh.className = 'vh-sheet'; document.body.appendChild(sh); }
    const sup = pushSupported();
    let reg = null, sub = null;
    if (sup) { try { reg = await swReady(); sub = await reg.pushManager.getSubscription(); } catch (e) { reg = null; } }
    let st = await call('push/state', 'POST', { endpoint: sub ? sub.endpoint : '' });
    const on = () => Boolean(sub && st.subscribed);
    const draw = () => {
      const hint = !sup ? (isIOS ? 'Auf dem iPhone gibt es Benachrichtigungen nur in der Home-Bildschirm-App: unten auf Teilen → „Zum Home-Bildschirm“, dann dort einschalten.' : 'Dieser Browser unterstützt keine Push-Benachrichtigungen.')
        : Notification.permission === 'denied' ? 'Benachrichtigungen sind für diese App im Handy gesperrt – bitte in den Einstellungen des Handys erlauben.' : '';
      sh.innerHTML = `<div class="vh-box"><h2>Benachrichtigungen</h2>
        <p class="vh-small" style="text-align:left">Kurze Hinweise aufs Handy, z. B. wenn dich jemand als Mitspieler einträgt. Gilt nur für dieses Handy.</p>
        ${hint ? `<p class="vh-small" style="text-align:left;color:var(--ink)">${esc(hint)}</p>` : ''}
        ${!st.events.length ? '<p class="vh-small" style="text-align:left">Der Verein hat noch keine Benachrichtigungen freigegeben.</p>' : ''}
        ${sup && !hint && st.events.length ? `<label class="vh-switch"><input type="checkbox" id="pshOn" ${on() ? 'checked' : ''}><span>Benachrichtigungen auf diesem Handy</span></label>` : ''}
        ${sup && !hint && st.events.length ? '<p class="vh-small" style="text-align:left;margin-top:-4px">Welche Hinweise kommen, legt der Verein fest.</p>' : ''}
        ${on() ? `<button type="button" class="vh-btn sec" id="pshTest" style="width:100%">Testnachricht schicken</button>` : ''}
        <div class="vh-err" id="pshE"></div>
        <div class="vh-row" style="margin-top:10px"><button class="no" id="pshNo" style="flex:1">Schließen</button></div></div>`;
      sh.querySelector('#pshNo').onclick = () => sh.classList.remove('show');
      const err = t => { sh.querySelector('#pshE').textContent = t; };
      const sw = sh.querySelector('#pshOn');
      if (sw) sw.onchange = async () => {
        sw.disabled = true;
        try {
          if (sw.checked) {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') { sw.checked = false; err('Ohne Erlaubnis des Handys geht es nicht.'); draw(); return; }
            if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(st.vapid) });
            st = await call('push/subscribe', 'POST', { subscription: sub.toJSON() });
            toast('Benachrichtigungen eingeschaltet.');
          } else {
            const ep = sub ? sub.endpoint : '';
            if (sub) { try { await sub.unsubscribe(); } catch (e) { /* egal */ } sub = null; }
            st = await call('push/unsubscribe', 'POST', { endpoint: ep });
            toast('Benachrichtigungen ausgeschaltet.');
          }
        } catch (e) { err(e.message || 'Das hat nicht geklappt.'); }
        draw();
      };
      const t = sh.querySelector('#pshTest');
      if (t) t.onclick = async () => { t.disabled = true; try { const r = await call('push/test', 'POST', { endpoint: sub.endpoint }); toast(r.ok ? 'Testnachricht gesendet – sie sollte gleich erscheinen.' : 'Nicht gesendet' + (r.skipped ? ': ' + r.skipped : '.'), !r.ok); } catch (e) { err(e.message); } t.disabled = false; };
    };
    draw();
    sh.classList.add('show');
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
  let trMode = 'transfer';   // 'transfer' = Übernahme in die Home-Bildschirm-App, 'handover' = lokale Adresse im Vereinsheim
  function transferFlow(code, mode = 'transfer') {
    trMode = mode;
    $('lockSheet').classList.remove('show');
    $('trCode').value = code ? fmtCode(code) : '';
    $('trCode').classList.toggle('hidden', Boolean(code));
    $('trText').textContent = mode === 'handover' ? 'Du öffnest die App über die lokale Adresse im Vereinsheim. Gib einmal deine PIN ein – danach merkt sich der Browser die Freischaltung auch hier.' : code ? 'Gib deine PIN ein, um die Freischaltung in diese App zu übernehmen.' : 'Den Übernahme-Code findest du auf der Seite in Safari, auf der du freigeschaltet hast. Dazu deine PIN.';
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
      const r = await call(trMode === 'handover' ? 'handover/redeem' : 'transfer/redeem', 'POST', { code, pin });
      store.set('va_geraet', r.device);
      if (dev() !== r.device) { $('trErr').textContent = 'Diese App kann nichts speichern – bitte in den Einstellungen prüfen.'; return; }
      sess.set(pin);
      history.replaceState(null, '', location.pathname + location.search);
      $('trSheet').classList.remove('show');
      toast(trMode === 'handover' ? 'Lokal verbunden – du bist im Vereinsheim.' : 'Freigeschaltet – willkommen!', false, 4000);
      start().catch(e => toast(e.message, true));
    } catch (e) { $('trErr').textContent = e.message; if (e.data && e.data.badCode) { $('trCode').classList.remove('hidden'); } }
  };

  /* ---------- Einladung per QR-Code, Link aus der E-Mail oder Brief ---------- */
  let inviteToken = '', inviteInfo = {}, skipSms = false;
  async function pair(t) {
    inviteToken = t; skipSms = false;
    history.replaceState(null, '', location.pathname + location.search);   // Einladung nicht in Lesezeichen/Verlauf behalten
    try {
      const p = await call('invite?t=' + encodeURIComponent(t));
      inviteInfo = p;
      $('pairTitle').textContent = `Hallo ${p.member}`;
      // von unterwegs mit hinterlegter Handynummer: zweiter Faktor per SMS
      $('pairSms').classList.toggle('hidden', !p.sms);
      $('pairPhone').textContent = p.phone || '';
      $('pairOtp').classList.add('hidden'); $('pairOtp').value = '';
      $('pairSkip').classList.add('hidden');
      $('pairNote').classList.toggle('hidden', !p.staged);
      // eine PIN für alles: wer im Verkauf schon eine hat, gibt sie ein – sonst neue festlegen (gilt dann auch am Tablet)
      $('pairText').textContent = p.hasPin ? `${p.sms ? 'Dann gib' : 'Gib'} deine PIN ein – dieselbe wie im Verkauf am Tablet. Vergessen? Der Vorstand setzt sie zurück.`
        : `${p.sms ? 'Dann legst du' : 'Lege'} deine persönliche PIN fest (4–6 Ziffern). Sie gilt auch im Verkauf am Tablet.`;
      $('pair2').classList.toggle('hidden', Boolean(p.hasPin));
      $('pair1').maxLength = p.hasPin ? 8 : 6; $('pair1').placeholder = p.hasPin ? 'Deine PIN' : 'PIN'; $('pair1').value = ''; $('pair2').value = '';
      $('pairErr').textContent = '';
      $('pairSheet').classList.add('show');
      setTimeout(() => (p.sms ? $('pairSmsGo') : $('pair1')).focus(), 80);
    } catch (e) {
      if (dev()) { toast(e.message, true, 6000); start().catch(err => toast(err.message, true)); } else lock(e.message);
    }
  }
  $('pairSmsGo').onclick = async () => {
    $('pairErr').textContent = 'Sende SMS …'; $('pairSmsGo').disabled = true;
    try {
      const r = await call('invite/sms', 'POST', { t: inviteToken });
      $('pairErr').textContent = '';
      $('pairOtp').classList.remove('hidden'); $('pairOtp').focus();
      $('pairSmsGo').textContent = 'Neuen Code senden';
      toast(`Code an ${r.phone} geschickt – gilt ${r.minutes} Minuten.`, false, 4000);
      setTimeout(() => { $('pairSmsGo').disabled = false; }, 60000);
    } catch (e) {
      $('pairErr').textContent = e.message; $('pairSmsGo').disabled = false;
      if (e.data && e.data.smsFailed) $('pairSkip').classList.remove('hidden');
    }
  };
  $('pairSkip').onclick = () => {
    skipSms = true;
    $('pairSms').classList.add('hidden'); $('pairSkip').classList.add('hidden');
    $('pairNote').classList.remove('hidden'); $('pairErr').textContent = '';
    $('pair1').focus();
  };
  $('pairOk').onclick = async () => {
    const a = $('pair1').value.trim(), b = $('pair2').value.trim(), otp = $('pairOtp').value.trim();
    if (inviteInfo.sms && !skipSms && !/^\d{6}$/.test(otp)) { $('pairErr').textContent = $('pairOtp').classList.contains('hidden') ? 'Bitte zuerst den Code per SMS anfordern' : 'Bitte die 6 Ziffern aus der SMS eingeben'; return; }
    if (inviteInfo.hasPin ? !/^\d{4,8}$/.test(a) : !/^\d{4,6}$/.test(a)) { $('pairErr').textContent = inviteInfo.hasPin ? 'Bitte deine PIN eingeben' : 'Bitte 4 bis 6 Ziffern'; return; }
    if (!inviteInfo.hasPin && a !== b) { $('pairErr').textContent = 'Die beiden Eingaben stimmen nicht überein'; $('pair2').value = ''; return; }
    $('pairErr').textContent = 'Schalte frei …';
    try {
      const r = await call('pair', 'POST', { t: inviteToken, pin: a, ...(inviteInfo.sms && !skipSms ? { otp } : {}), ...(skipSms ? { skipSms: true } : {}) });
      store.set('va_geraet', r.device);
      if (dev() !== r.device) { $('pairErr').textContent = 'Der Browser speichert nichts (privater Modus?) – bitte normal öffnen.'; return; }
      sess.set(a);
      $('pairSheet').classList.remove('show');
      toast(r.staged ? 'Freigeschaltet – Türen und Beregnung folgen beim ersten Besuch im Vereins-WLAN.' : 'Freigeschaltet – lege die Seite jetzt auf den Home-Bildschirm.', false, 6000);
      start().then(prepareTransfer).catch(e => toast(e.message, true));
    } catch (e) {
      $('pairErr').textContent = e.message;
      if (e.data && e.data.pinWrong) { $('pair1').value = ''; $('pair1').focus(); }
      if (e.data && e.data.otp) { $('pairOtp').value = ''; $('pairOtp').classList.remove('hidden'); $('pairOtp').focus(); }
    }
  };
  $('pairOtp').addEventListener('keydown', e => { if (e.key === 'Enter') $('pair1').focus(); });
  $('pair2').addEventListener('keydown', e => { if (e.key === 'Enter') $('pairOk').click(); });
  $('pair1').addEventListener('keydown', e => { if (e.key === 'Enter') { if (inviteInfo.hasPin) $('pairOk').click(); else $('pair2').focus(); } });

  // Logo
  const lg = $('logo'); lg.onload = () => $('logoBox').classList.remove('hidden'); lg.src = 'logo';

  window.addEventListener('load', () => {
    const m = location.hash.match(/[#&]i=([A-Za-z0-9_-]{10,60})/);
    if (m) { call('me').then(x => { $('club').textContent = x.club; }).catch(() => {}); pair(m[1]); return; }
    const k = location.hash.match(/[#&]k=([A-Z2-9]{10})/);
    const h = location.hash.match(/[#&]h=([A-Z2-9]{10})/);
    (async () => {
      // lokale Adresse per Übergabecode (aus der öffentlichen App im Vereinsheim): kennt dieser Speicher das Gerät schon, einfach starten
      if (h) {
        history.replaceState(null, '', location.pathname + location.search);
        let ok = false;
        if (dev()) { try { ok = Boolean((await call('me')).member); } catch (e) { ok = false; } }
        if (!ok) { call('me').then(x => { $('club').textContent = x.club; }).catch(() => {}); transferFlow(h[1], 'handover'); return; }
      }
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
