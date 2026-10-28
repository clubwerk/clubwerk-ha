'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] !== undefined ? v[k] : m)));   // Übersetzen (i18n.js); ohne Sprachdatei bleibt Deutsch
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  // Formatierer einmal anlegen – toLocaleString baut sie sonst bei jedem Betrag/Datum neu (bei langen Listen spürbar langsam)
  const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }), NUM = new Intl.NumberFormat('de-DE');
  const DT = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const euro = c => EUR.format((c || 0) / 100);
  const num = n => NUM.format(Number(n || 0));
  const deDate = d => (d ? d.slice(0, 10).split('-').reverse().join('.') : '');
  const deTime = t => (t ? DT.format(new Date(t.replace(' ', 'T'))) : '');
  const pinInfo = m => m.pin_changed_at ? `<div class="muted s">${m.hasPin ? 'geändert' : (m.pin_changed_by && m.pin_changed_by !== 'Mitglied' ? 'zurückgesetzt' : 'entfernt')} ${deTime(m.pin_changed_at)}${m.pin_changed_by && m.pin_changed_by !== 'Mitglied' ? ' · ' + esc(m.pin_changed_by) : ''}</div>` : '';
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const toCents = v => Math.round(Number(String(v).replace(/\./g, '').replace(',', '.')) * 100);
  const centsToInput = c => ((c || 0) / 100).toFixed(2).replace('.', ',');
  const KIND = { mitglied: 'Mitglied', nichtmitglied: 'Kein Mitglied', mannschaft: 'Mannschaft', verein: 'Verein (kostenfrei)', gast: 'Gast (bar)' };
  const isPerson = k => k === 'mitglied' || k === 'nichtmitglied';   // Personenkonten (Vorname, PIN, Tablet)
  const BKIND = { konto: ['Konto', 'g'], verein: ['Verein frei', 'b'], gast: ['Gast bar', 'a'], event: ['Veranstaltung', 'a'] };
  const DOCKIND = { rechnung: 'Rechnung', gutschrift: 'Gutschrift', lieferung: 'Lieferschein', kassenbon: 'Kassenbon' };

  async function api(url, method = 'GET', body) {
    const opts = { method, headers: { 'X-Clubwerk': '1' } };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch('api/admin/' + url, opts);
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.startsWith('login') && !url.startsWith('setup')) { showLogin(); throw new Error(data.error || 'Bitte anmelden.'); }
    if (r.status === 423 && data.vaultLocked) throw Object.assign(new Error(data.error), { status: 423, vaultLocked: true });
    if (!r.ok) throw Object.assign(new Error(data.error || 'Fehler'), { status: r.status, odd: data.odd, links: data.links });
    return data;
  }

  function toast(msg, error = false) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (error ? ' error' : '');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.add('hidden'), error ? 6000 : 3000);
  }
  const fail = e => toast(e.message, true);
  /** Fehler beim Aufbau einer Seite: Tresor verschlossen → Hinweis mit „Öffnen“ statt nur einer Meldung */
  const pageFail = e => (e && e.vaultLocked ? vaultLockedPage() : fail(e));
  /** Doppelklick-Schutz: Knopf sperren, solange fn() läuft (Beschriftung bleibt), danach wieder freigeben – auch bei Fehlern.
   *  Verwendung: $('xOk').onclick = () => busy($('xOk'), async () => { … }); */
  async function busy(btn, fn) {
    if (btn && btn.disabled) return undefined;
    if (btn) btn.disabled = true;
    try { return await fn(); }
    finally { if (btn && btn.isConnected) btn.disabled = false; }
  }

  /** Mitglied löschen – derselbe Weg in „Mitglieder & Konten“ und in der Mitgliederverwaltung. Hängt es noch irgendwo
   *  (Beitrag, Zahler, Mannschaft, kommende Buchung …), löscht der Server nicht und nennt, was erst zu lösen ist. */
  async function deleteMember(m, done) {
    const nm = lastFirst(m.name, m.kind);
    if (!await ask(`„${nm}“ löschen?\n\nDas Konto verschwindet aus allen Listen und vom Tablet. Frühere Buchungen und Abrechnungen bleiben mit dem Namen erhalten.`)) return;
    try { await api('members/' + m.id, 'DELETE'); closeDialog(); toast(`„${nm}“ gelöscht.`); done(); }
    catch (e) {
      if (!e.links) { fail(e); return; }
      dialog(`<h2>„${esc(nm)}“ kann noch nicht gelöscht werden</h2><p class="muted">Bitte zuerst lösen:</p>
        <ul style="margin:8px 0 0;padding-left:20px;line-height:1.6">${e.links.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
        <div class="btns"><button class="btn primary" id="dlOk" type="button">OK</button></div>`);
      $('dlOk').onclick = closeDialog;
    }
  }
  function dialog(html, wide = false) {
    $('dialog').className = 'dialog' + (wide ? ' wide' : '');
    $('dialog').onchange = null;   // Ereignis-Handler eines früheren Dialogs (z. B. Serien-Dialog) gelten nicht weiter
    $('dialog').innerHTML = html;
    $('overlay').classList.remove('hidden');
    $('overlay').scrollTop = 0;
  }
  function closeDialog() { $('overlay').classList.add('hidden'); $('dialog').innerHTML = ''; }

  /* ---------- Rückfragen im eigenen Fenster (statt Browser-Dialog) ---------- */
  const nl2br = t => esc(t).replace(/\n/g, '<br>');
  /* Personen wie sortiert anzeigen: „Nachname, Vorname“ („von der Heide, Anna“) – gemeinsame Zerlegung aus names.js */
  const { lastFirst } = window.CWNames;
  const pName = m => esc(lastFirst(m.name, m.kind));
  /** Rückfrage-Fenster (#askBox) öffnen: bind(done) setzt die Knöpfe, Escape bricht überall gleich ab (→ cancel) */
  function askBoxOpen(html, cancel, bind) {
    return new Promise(resolve => {
      $('askBox').innerHTML = html;
      $('askOverlay').classList.remove('hidden');
      const key = e => { if (e.key === 'Escape') done(cancel); };
      const done = v => { $('askOverlay').classList.add('hidden'); document.removeEventListener('keydown', key); resolve(v); };
      document.addEventListener('keydown', key);
      bind(done);
    });
  }
  /** ask(text, {title, ok, danger}) → Promise<boolean>. Erste Zeile wird zur Überschrift, wenn kein Titel angegeben ist. */
  function ask(text, o = {}) {
    const parts = String(text).split('\n\n');
    const title = o.title || parts.shift();
    const body = o.title ? String(text) : parts.join('\n\n');
    const danger = o.danger ?? /löschen|entziehen|sperren|zurücknehmen|zurücksetzen|wiederherstellen|trennen|ausschalten|abmelden|neu starten|stornieren/i.test(title + body);
    const okLabel = o.ok || (/löschen/i.test(title) ? 'Löschen' : /stornieren/i.test(title) ? 'Stornieren' : danger ? 'Ja, ausführen' : 'OK');
    return askBoxOpen(`<h2>${nl2br(title)}</h2>${body ? `<p>${nl2br(body)}</p>` : ''}
      <div class="btns">${o.okOnly ? '' : '<button class="btn ghost" id="askNo">Abbrechen</button>'}<button class="btn ${danger ? 'danger' : 'primary'}" id="askOk">${esc(okLabel)}</button></div>`, false, done => {
      if ($('askNo')) $('askNo').onclick = () => done(false);
      $('askOk').onclick = () => done(true);
      $('askOk').focus();
    });
  }
  /** askText(text, value, {ok}) → Promise<string|null> */
  function askText(text, value = '', o = {}) {
    const parts = String(text).split('\n'); const title = parts.shift();
    return askBoxOpen(`<h2>${esc(title)}</h2>${parts.length ? `<p>${nl2br(parts.join('\n'))}</p>` : ''}
        <label class="f"><input id="askIn" value="${esc(value)}" autocomplete="off" type="${o.password ? 'password' : 'text'}"></label>
        <div class="btns">${o.okOnly ? '' : '<button class="btn ghost" id="askNo">Abbrechen</button>'}<button class="btn primary" id="askOk">${esc(o.ok || 'OK')}</button></div>`, null, done => {
      if ($('askNo')) $('askNo').onclick = () => done(null);
      $('askOk').onclick = () => done($('askIn').value);
      $('askIn').onkeydown = e => { if (e.key === 'Enter') done($('askIn').value); };
      $('askIn').focus(); $('askIn').select();
    });
  }

  /* ---------- Ungespeicherte Änderungen ---------- */
  let dirty = false;
  let closeMenusBound = false;   // Seite „Module“: Klick-außerhalb-Listener nur einmal registrieren
  /** Formularbereich beobachten: jede Eingabe markiert „ungespeichert“ */
  function watch(el) { if (!el) return; const mark = e => { if (e.target.matches('input, select, textarea') && !e.target.closest('[data-nodirty]')) dirty = true; }; el.addEventListener('input', mark); el.addEventListener('change', mark); }
  const clean = () => { dirty = false; };
  async function leaveOk() {
    if (!dirty) return true;
    const ok = await ask('Änderungen verwerfen?\n\nDu hast hier etwas geändert, aber noch nicht gespeichert.', { ok: 'Verwerfen', danger: true });
    if (ok) dirty = false;
    return ok;
  }
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /** Reiter innerhalb einer Seite. tabs: [[key, label]], merkt sich den Reiter je Seite. */
  function tabs(el, key, list, onShow) {
    const store = `tab_${key}`;
    let cur = sessionStorage.getItem(store);
    if (!list.some(t => t[0] === cur)) cur = list[0][0];
    el.innerHTML = `<div class="tabs">${list.map(([k, l]) => `<button data-tab="${k}">${esc(l)}</button>`).join('')}</div><div class="tabbody"></div>`;
    const body = el.querySelector('.tabbody');
    const show = async k => {
      if (k !== cur && !(await leaveOk())) return;
      cur = k; sessionStorage.setItem(store, k);
      el.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('on', b.dataset.tab === k); if (b.dataset.tab === k) revealTab(b); });
      body.innerHTML = '<p class="muted">Lade …</p>';
      try { await onShow(k, body); } catch (e) { fail(e); }
    };
    el.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => show(b.dataset.tab); });
    cur = cur || list[0][0];
    const first = cur; cur = null; show(first);
    return { reload: () => { const k = cur; cur = null; show(k); } };
  }
  /** Reiterleiste bei Platzmangel: aktiven Reiter mittig hineinscrollen und die Kanten weich auslaufen lassen (Hinweis auf weitere Reiter) */
  function tabFade(bar) {
    const more = bar.scrollWidth > bar.clientWidth + 1;
    bar.classList.toggle('more-l', more && bar.scrollLeft > 1);
    bar.classList.toggle('more-r', more && bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 1);
    if (!bar.dataset.fade) { bar.dataset.fade = '1'; bar.addEventListener('scroll', () => tabFade(bar), { passive: true }); }
  }
  /** Knöpfe der Reiterzeile neben die Reiter setzen, wenn beide Platz haben; sonst darunter (Klasse .beside, siehe admin.html) */
  function fitTools() {
    requestAnimationFrame(() => document.querySelectorAll('#main .tabrow:not(.detailrow)').forEach(row => {
      const t = [...row.children].find(c => c.classList.contains('tabs')), box = [...row.children].find(c => c.classList.contains('tabtools')); if (!t) return;
      row.classList.remove('beside'); if (t.scrollWidth > t.clientWidth + 1) { tabFade(t); return; }   // Reiter allein zu breit: wischbar wie am Handy
      if (box && box.childElementCount) { row.classList.add('beside'); if (t.scrollWidth > t.clientWidth + 1 || row.scrollWidth > row.clientWidth + 1 || box.offsetTop > t.offsetTop + 8) row.classList.remove('beside'); }
      tabFade(t);
    }));
  }
  function revealTab(b) {
    const bar = b.parentNode; if (!bar) return;
    if (bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2);
    tabFade(bar);
  }
  window.addEventListener('resize', () => { document.querySelectorAll('#main .tabs').forEach(tabFade); fitTools(); });
  $('overlay').addEventListener('mousedown', e => { if (e.target === $('overlay') && !$('dialog').dataset.sticky) closeDialog(); });

  /* Lange Tabellen: erst 150 Zeilen, der Rest auf Knopfdruck – sonst baut der Browser tausende Zeilen auf einmal auf.
     rows: fertige <tr>-Zeilen, cols: Spaltenzahl. Knöpfe in den Zeilen über einen Klick auf die Tabelle anbinden, dann wirken sie auch in nachgeladenen Zeilen. */
  const MORE_STEP = 150, moreRest = new Map(); let moreSeq = 0;
  const moreRow = (id, left, cols) => `<tr class="more"><td colspan="${cols}" style="text-align:center"><button class="btn small" type="button" data-more="${id}">Weitere ${Math.min(MORE_STEP, left)} anzeigen</button> <span class="muted s">noch ${left}</span></td></tr>`;
  function moreRows(rows, cols) {
    if (rows.length <= MORE_STEP) return rows.join('');
    const id = String(++moreSeq); moreRest.set(id, { rows: rows.slice(MORE_STEP), cols });
    if (moreRest.size > 20) moreRest.delete(moreRest.keys().next().value);   // Listen früherer Ansichten vergessen
    return rows.slice(0, MORE_STEP).join('') + moreRow(id, rows.length - MORE_STEP, cols);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-more]'), m = b && moreRest.get(b.dataset.more); if (!m) return;
    const tr = b.closest('tr'), table = tr.closest('table'), next = m.rows.splice(0, MORE_STEP);
    tr.insertAdjacentHTML('beforebegin', next.join('') + (m.rows.length ? moreRow(b.dataset.more, m.rows.length, m.cols) : ''));
    tr.remove(); if (!m.rows.length) moreRest.delete(b.dataset.more);
    labelTables(table.parentNode);
  });

  /* Handy: Spaltennamen an jede Tabellenzelle hängen (für die Kartenansicht) */
  function labelTables(root) {
    root.querySelectorAll('table.tbl').forEach(t => {
      const head = t.querySelector('tr'); if (!head || !head.querySelector('th')) return;
      const names = [...head.children].map(th => th.textContent.trim());
      t.querySelectorAll('tr').forEach(tr => { if (tr === head) return; let i = 0; [...tr.children].forEach(td => {
        if (!td.hasAttribute('data-label')) td.setAttribute('data-label', td.colSpan > 1 ? '' : names[i] || '');
        if (t.classList.contains('kompakt') && td.tagName === 'TD') td.classList.toggle('k-lang', td.textContent.trim().length > 40);   // Handy-Liste: nur lange Werte teilen sich den Rest der Zeile (dürfen mit … enden), kurze stehen ganz da
        // Wert + Zusatzzeile (z. B. „jährlich“ / „anteilig“) zusammenhalten, damit die Kartenansicht sie rechtsbündig untereinander zeigt
        if (td.tagName === 'TD' && !td.classList.contains('r') && !td.querySelector(':scope > .tcell, input, select, textarea, button')
          && [...td.childNodes].filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim())).length > 1) {
          const w = document.createElement('div'); w.className = 'tcell'; while (td.firstChild) w.appendChild(td.firstChild); td.appendChild(w);
        }
        i += td.colSpan || 1; }); });
    });
  }
  new MutationObserver(() => { labelTables(document); }).observe(document.getElementById('app'), { childList: true, subtree: true });
  new MutationObserver(() => { labelTables($('dialog')); }).observe($('dialog'), { childList: true, subtree: true });

  /* ---------- Anmeldung ---------- */
  let me = null, permLabels = {};
  const can = p => Boolean(me && me.perms.includes(p));

  let SCHEME = 'http';   // Schema der direkten Adressen (Tablet, Mitglieder-App, Beregnung)
  const AFTER_SHELL = [];   // nach dem Aufbau der Verwaltung (GK.afterShell), z. B. der Einrichtungs-Assistent beim ersten Start
  let tabletPwMissing = false, clubNetsMissing = false, tabletOnUI = true;   // tabletOnUI: Tablet im Vereinsheim eingeschaltet (Einstellungen › Tablet)
  async function start() {
    const [s] = await Promise.all([fetch('api/admin/status').then(r => r.json()), loadBrand()]);
    permLabels = s.permLabels || {};
    SCHEME = s.https ? 'https' : 'http'; tabletOnUI = s.tablet !== false;
    if (!s.configured) return showSetup(s.modules || [], s);
    if (!s.loggedIn) return showLogin();
    me = s.user; tabletPwMissing = Boolean(s.tabletPwMissing); clubNetsMissing = Boolean(s.clubNetsMissing);
    await loadExtensions().catch(() => {});
    showShell();
    AFTER_SHELL.forEach(fn => Promise.resolve().then(fn).catch(e => console.warn(e)));
    if (brand.iconNeeded) makeAppIcon().catch(e => console.warn('App-Symbol:', e));
  }

  /* ---------- Erweiterungen: Verwaltungsseiten der aktiven Erweiterungen nachladen ---------- */
  let extLoaded = new Set();
  let loadingExt = null;   // Modul, dessen admin.js gerade lädt – registerPage merkt sich so, welche Seite zu welchem Modul gehört
  async function loadExtensions() {
    const r = await api('extensions');
    cache.extLinks = r.links || [];
    cache.modules = r.modules || [];
    cache.appModules = r.appModules || [];
    for (const x of r.ui) {
      if (extLoaded.has(x.id)) continue;
      extLoaded.add(x.id);
      loadingExt = x.id;
      // erst die gemeinsamen Skripte des Moduls (z. B. Kacheln, die auch Tablet und App nutzen), dann admin.js – alle mit Modulversion
      for (const f of [...(x.scripts || []), 'admin.js']) await new Promise(res => {
        const sc = document.createElement('script');
        sc.src = `x/${x.id}/${f}?v=${encodeURIComponent(x.version)}`;
        sc.onload = res; sc.onerror = () => { console.error('Erweiterung', x.id, f, 'konnte nicht geladen werden'); res(); };
        document.head.appendChild(sc);
      });
      loadingExt = null;
    }
  }

  let brand = { logo: null };
  /** Aus dem Vereinslogo ein quadratisches PNG fürs Handy (Home-Bildschirm) zeichnen und hochladen:
   *  Hintergrund in Vereinsfarbe, Logo groß (leere Ränder abgeschnitten) mit schmalem weißem Rahmen –
   *  rundes Logo im weißen Ring, eckiges im weißen Rahmen mit runden Ecken. Neu bei Logo- oder Farbwechsel. */
  async function makeAppIcon() {
    if (!brand.logo) return;
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = brand.logo; });
    const w0 = img.naturalWidth || img.width || 512, h0 = img.naturalHeight || img.height || 512;
    // leere (durchsichtige oder weiße) Ränder des Logos finden
    const t = document.createElement('canvas'); t.width = w0; t.height = h0; const tg = t.getContext('2d', { willReadFrequently: true });
    tg.drawImage(img, 0, 0, w0, h0);
    let x0 = 0, y0 = 0, x1 = w0, y1 = h0;
    try {
      const d = tg.getImageData(0, 0, w0, h0).data, ink = (x, y) => { const i = (y * w0 + x) * 4; return d[i + 3] > 24 && (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235); };
      let a = w0, b = h0, c2 = -1, e = -1;
      for (let y = 0; y < h0; y += 1) for (let x = 0; x < w0; x += 1) if (ink(x, y)) { if (x < a) a = x; if (x > c2) c2 = x; if (y < b) b = y; if (y > e) e = y; }
      if (c2 > a && e > b) { x0 = a; y0 = b; x1 = c2 + 1; y1 = e + 1; }
    } catch (err) { /* Bild nicht lesbar – ganzes Logo nehmen */ }
    if (!(x1 - x0 < w0 || y1 - y0 < h0) && !(() => { try { const d = tg.getImageData(0, 0, w0, h0).data; for (let i = 3; i < d.length; i += 16) if (d[i] > 24) return true; return false; } catch (err) { return true; } })())
      throw new Error('Logo ließ sich nicht zeichnen (leer)');   // sonst landet ein unsichtbares Bild in E-Mails und PDFs
    const w = x1 - x0, h = y1 - y0, round = Math.abs(w / h - 1) < 0.12;
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = /^#[0-9a-f]{6}$/i.test(brand.color || '') ? brand.color : '#1f6b3a'; g.fillRect(0, 0, S, S);
    const F = 14, box = S * 0.80;                       // Rahmen 14 px, Logo samt Rahmen 80 % der Fläche
    const k = Math.min((box - 2 * F) / w, (box - 2 * F) / h), dw = w * k, dh = h * k, dx = (S - dw) / 2, dy = (S - dh) / 2;
    g.fillStyle = '#ffffff';
    if (round) { g.beginPath(); g.arc(S / 2, S / 2, dw / 2 + F, 0, Math.PI * 2); g.fill(); g.save(); g.beginPath(); g.arc(S / 2, S / 2, dw / 2, 0, Math.PI * 2); g.clip(); }
    else { const r = 40; g.beginPath(); g.roundRect ? g.roundRect(dx - F, dy - F, dw + 2 * F, dh + 2 * F, r) : g.rect(dx - F, dy - F, dw + 2 * F, dh + 2 * F); g.fill(); g.save(); }
    g.drawImage(img, x0, y0, w, h, dx, dy, dw, dh);
    g.restore();
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    await fetch('api/admin/logo-icon', { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'image/png' }, body: blob });
    // dazu das Logo selbst als PNG (leere Ränder abgeschnitten, durchsichtig) – für PDFs (Beitrittserklärung, Rechnungen) und E-Mails,
    // die kein SVG darstellen können
    const L = 800, kk = Math.min(1, L / Math.max(w, h)) * (Math.max(w, h) < 400 ? 400 / Math.max(w, h) : 1), pc = document.createElement('canvas');
    pc.width = Math.round(w * kk); pc.height = Math.round(h * kk);
    pc.getContext('2d').drawImage(img, x0, y0, w, h, 0, 0, pc.width, pc.height);
    const pblob = await new Promise(r => pc.toBlob(r, 'image/png'));
    await fetch('api/admin/logo-png', { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'image/png' }, body: pblob });
    brand.iconNeeded = false;
  }
  /** nach Farb- oder Logowechsel: Symbol neu zeichnen, wenn nötig */
  const refreshIcon = () => loadBrand().then(() => { if (brand.iconNeeded && can('einstellungen')) return makeAppIcon(); }).catch(e => console.warn('App-Symbol:', e));
  const loadBrand = () => fetch('api/branding').then(r => r.json()).then(b => { brand = b; }).catch(() => {});
  const logoImg = cls => (brand.logo ? `<div class="${cls}"><img src="${esc(brand.logo)}" alt="Vereinslogo" data-logo></div>` : '');
  const wireLogos = () => document.querySelectorAll('img[data-logo]').forEach(i => { i.onerror = () => i.parentNode.remove(); });

  /* Erster Start (noch kein Adminkonto): Willkommen, Sprache, Admin-Konto – danach führt der Einrichtungs-Assistent weiter (einrichtung.js) */
  function showSetup(mods = [], st = {}) {
    window.GK.firstStart(st, logoImg('loginlogo'));
    wireLogos();
  }

  /* Verwaltung am Tablet (eingebettet unter der Tablet-Kopfzeile, verwaltung.html): nach 60 s ohne Eingabe abmelden – das Tablet
     steht für alle zugänglich. Direkt aufgerufen (admin.html, Seitenleiste von Home Assistant) bleibt man angemeldet. */
  const onTablet = (() => { try { return window.parent !== window && /\/verwaltung\.html$/.test(window.parent.location.pathname); } catch (e) { return false; } })();
  if (onTablet) {
    let last = Date.now();
    ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, () => { last = Date.now(); }, { capture: true, passive: true }));
    setInterval(async () => {
      if (!me || Date.now() - last < 60000) return;
      await api('logout', 'POST', {}).catch(() => {});
      closeDialog(); showLogin(); toast('Nach einer Minute ohne Eingabe abgemeldet.');
    }, 5000);
  }

  function showLogin() {
    me = null;
    $('app').innerHTML = `<div class="login card">${logoImg('loginlogo')}<h2 class="page">Verwaltung</h2>
      <p class="lead">Clubwerk – bitte anmelden.</p>
      <form id="lf" class="loginform"><label class="f">Benutzername<input id="un" autocomplete="username" autocapitalize="none" autofocus></label>
      <label class="f">Passwort<input type="password" id="pw" autocomplete="current-password"></label>
      <button class="btn primary">Anmelden</button><span class="err" id="err"></span></form>
      ${window.top === window && tabletOnUI ? '<p class="muted s" style="margin-top:18px"><a href="./">Zurück zur Buchungsseite</a></p>' : ''}</div>`;
    wireLogos();
    $('lf').onsubmit = async e => {
      e.preventDefault();
      try { await api('login', 'POST', { username: $('un').value, password: $('pw').value }); start(); } catch (err) { $('err').textContent = err.message; }
    };
  }

  /* ---------- Rahmen ---------- */
  // [Seite, Titel, nötiges Recht (null = alle Admins)]
  let tabToolsOwner = null;   // Inhalt, zu dem die Knöpfe in der Reiterzeile gehören
  /* Reiterzeile pflegen: Knöpfe entfernen, wenn ihr Inhalt verschwindet; eine Knopfleiste (.toolbar mit nur Knöpfen) ganz oben im
     Seiteninhalt wandert automatisch rechts in die Reiterzeile – so stehen „+ Neu …“ und Co. auf allen Seiten an derselben Stelle */
  new MutationObserver(() => {
    if (tabToolsOwner && !document.body.contains(tabToolsOwner)) { tabToolsOwner = null; const b = $('tabTools'); if (b) b.innerHTML = ''; }
    const box = $('tabTools'), row = box && box.parentElement; if (!row || row.parentElement !== $('main')) return;
    const next = row.nextElementSibling; if (!next) return;
    const tb = next.matches('.toolbar') ? next : next.firstElementChild && next.firstElementChild.matches('.toolbar') ? next.firstElementChild : null;
    if (!tb || tb.querySelector('input, select, textarea') || !tb.querySelector('.btn, button')) return;
    const owner = tb.nextElementSibling || tb.parentElement;
    box.replaceChildren(...tb.childNodes); tb.remove(); tabToolsOwner = owner;
    fitTools();
  }).observe(document.documentElement, { childList: true, subtree: true });
  const APP_EXTRA = [];   // Reiter der Seite „Mitglieder-App“, die Module beisteuern
  const PAGES = [
    ['uebersicht', 'Übersicht', null, 'start'],
    ['buchungen', 'Buchungen', 'buchungen', 'getraenke'], ['abrechnung', 'Abrechnung & Export', ['abrechnung', 'export'], 'getraenke'],
    ['veranstaltungen', 'Veranstaltungen & Deckel', ['veranstaltungen', 'uebernahme', 'abrechnung', 'export'], 'getraenke'],
    ['auswertung', 'Auswertung', ['abrechnung', 'export'], 'getraenke'],
    ['vkeinst', 'Einstellungen', ['einstellungen', 'lieferungen', 'artikel'], 'getraenke'],
    // „Lager“ ist ein eigener Menüpunkt des Moduls Verkauf (kein eigenes Modul)
    ['bestellung', 'Bestellung', 'bestellung', 'lager'], ['lieferungen', 'Lieferungen & Belege', 'lieferungen', 'lager'],
    ['bestand', 'Bestand & Inventur', 'bestand', 'lager'], ['artikel', 'Artikel', 'artikel', 'lager'],
    ['konten', 'Mitglieder & Konten', 'konten', 'verein'], ['app', 'Mitglieder-App', ['konten', 'app'], 'verein'], ['benutzer', 'Benutzer & Rechte', 'benutzer', 'verein'],
    ['sicherung', 'Datensicherung', 'einstellungen', 'verein'], ['protokoll', 'Protokoll', 'einstellungen', 'verein'], ['einstellungen', 'Einstellungen', null, 'verein'],
    ['konto', 'Mein Konto', null, 'konto'],   // erreichbar über den Benutzerchip, nicht im Menü
  ];
  /* Module mit mehreren Seiten: ein Menüeintrag, die Seiten als Reiter unter der Überschrift (wie bei „Verkauf“) */
  /* Feste Reihenfolge der Module im Menü (order): Verkauf 1 · Lager 1.5 · Plätze 2 · Spielbetrieb 2.5 · Helferdienste 3 · Zeiterfassung 4 · Beregnung 5 · Zugang 6 · Mängel 6.5 · Mitglieder 7 · Beiträge & Zahlungen 7.5 · Buchhaltung 8 (wie MODULE_ORDER in src/plugins.js);
     Einzelseiten geben ihre Position über registerPage({ order }) an, sonst 50 (Reihenfolge der Registrierung) */
  const MODG = { getraenke: { label: 'Verkauf', icon: 'verkauf', order: 1 }, lager: { label: 'Lager', icon: 'lager', order: 1.5 } };
  const PAGE_ORDER = {};
  const PAGE_MOD = {};   // Seite → Modul (Erweiterungs-id), siehe GK.pageModule
  /** Recht ohne Abteilungs-Einschränkung („!recht“ in registerPage) */
  const canFull = p => can(p) && !((me && me.deptOnly) || []).includes(p);
  const can1 = p => (String(p).startsWith('!') ? canFull(String(p).slice(1)) : can(p));
  const canAny = r => !r || (Array.isArray(r) ? r.some(can1) : can1(r));
  const allowed = p => { const x = PAGES.find(y => y[0] === p); return x && canAny(x[2]); };
  let page = location.hash.slice(1) || 'uebersicht';
  let cache = { articles: [], members: [], settings: {} };

  /* Symbole fürs Menü (Strichzeichnungen, 18 px) */
  const ICO = {
    pokal: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    turnier: '<path d="M3 5h6v5h5M3 19h6v-5h5"/><path d="M14 10v4"/><circle cx="18" cy="12" r="3"/>',
    kalender: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h3v3h-3z"/>',
    buchhaltung: '<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
    uebersicht: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
    getraenke: '<path d="M8 2h8M9 2v4.5a4 4 0 0 1-1 2.6L6.8 10.5A4 4 0 0 0 6 13v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7a4 4 0 0 0-.8-2.5L16 9.1a4 4 0 0 1-1-2.6V2"/>',
    verkauf: '<path d="M5 8h14l-1.2 11.2A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    beregnung: '<path d="M12 2.5S5.5 9.6 5.5 14a6.5 6.5 0 0 0 13 0C18.5 9.6 12 2.5 12 2.5z"/>',
    zugang: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M15 8l2 2"/>',
    zeit: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    konten: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    app: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    benutzer: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/>',
    sicherung: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    protokoll: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    einstellungen: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    modul: '<path d="M10 3H5a2 2 0 0 0-2 2v5h3a2 2 0 1 1 0 4H3v5a2 2 0 0 0 2 2h5v-3a2 2 0 1 1 4 0v3h5a2 2 0 0 0 2-2v-5h-3a2 2 0 1 1 0-4h3V5a2 2 0 0 0-2-2h-5v3a2 2 0 1 1-4 0z"/>',
    suche: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    lager: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    maengel: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    arbeit: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 1.3-1.3a4 4 0 0 0-5-5L5 13 3 11l8-8 2 2z"/><path d="m9 15-4 4"/>',
    zahlung: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
    ausweis: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 16.5a3.5 3.5 0 0 1 7 0M15 10h4M15 14h3"/>',
    sprache: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    tablet: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/>',
    einrichtung: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
    haken: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    ausblenden: '<path d="m3 3 18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 4.5 10 6-.4.7-1.4 2-2.8 3.3M6.6 6.6C4.4 8 2.8 10.1 2 12c1 1.5 5 6 10 6 1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    abmelden: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    menue: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    punkte: '<circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none"/>',
    glocke: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  };
  const icon = (k, sz = 18) => `<svg aria-hidden="true" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[k] || ICO.modul}</svg>`;
  const PAGE_ICON = { uebersicht: 'uebersicht', beregnung: 'beregnung', zugang: 'zugang', zeit: 'zeit', konten: 'konten', app: 'app', benutzer: 'benutzer', sicherung: 'sicherung', protokoll: 'protokoll', einstellungen: 'einstellungen' };
  const TAB_LABEL = { lieferungen: 'Lieferungen', bestand: 'Bestand', abrechnung: 'Abrechnung', veranstaltungen: 'Veranstaltungen & Deckel', konten: 'Mitglieder' };
  /* alte Adressen (Lesezeichen, Suche, Hinweise) führen an den neuen Ort */
  const OLD_PAGE = { deckel: 'veranstaltungen', abgleich: 'bestand' };
  const GPAGES = g => PAGES.filter(x => x[3] === g && canAny(x[2]));
  const DRINKS = () => [...GPAGES('getraenke'), ...GPAGES('lager')];   // alle Seiten des Moduls Verkauf (auch „Lager“)
  const groupOf = p => { const x = PAGES.find(y => y[0] === p); return x && MODG[x[3]] ? x[3] : null; };
  const GROUP_LABEL = new Proxy({ module: 'Module', verein: 'Verein & System', konto: 'Mein Konto' }, { get: (o, k) => (MODG[k] ? MODG[k].label : o[k]) });
  const initials = n => String(n || '?').split(/[\s,]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const sget = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const sset = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* egal */ } };
  const theme = () => (window.CWTheme ? CWTheme.choice() : 'auto');   // 'auto' | 'light' | 'dark' | 'hc' (theme-init.js)
  let badges = {};

  function showShell() {
    const navBtn = (k, label, ic, badge) => `<button class="nav" data-p="${k}">${icon(ic)}<span>${esc(label)}</span>${badge ? `<span class="badge hidden" data-badge="${badge}"></span>` : ''}</button>`;
    // Modul-Gruppen (mehrere Reiter) und Einzelseiten in einer Liste, nach fester Reihenfolge (order)
    const groups = Object.entries(MODG).filter(([g]) => GPAGES(g).length).map(([g, m]) => ({ order: m.order || 50, html: navBtn('__' + g, m.label, m.icon || 'modul', g) }));
    const mods = PAGES.filter(x => x[3] === 'module' && canAny(x[2])).map(([k, l]) => ({ order: PAGE_ORDER[k] || 50, html: navBtn(k, l, PAGE_ICON[k] || 'modul', k) }));
    const modNav = [...groups, ...mods].sort((a, b) => a.order - b.order).map(x => x.html).join('');
    const verein = PAGES.filter(x => x[3] === 'verein' && canAny(x[2]) && (x[0] !== 'app' || (cache.appModules || []).length));
    $('app').innerHTML = `<div class="shell">
      <nav class="side glass" id="side">
        <div class="brandbox"><div class="mark">${brand.logo ? `<img src="${esc(brand.logo)}" alt="" data-logo>` : '<span id="clubIni"></span>'}</div>
          <div><b id="clubName" translate="no">Verein</b><small>Verwaltung</small></div>
          <button class="menutoggle" id="menuT" aria-label="Menü">${icon('menue', 16)}<span id="menuCur">Menü</span></button></div>
        <div class="navbody">
          <label class="search">${icon('suche')}<input id="navSearch" placeholder="Suchen" aria-label="Seite suchen" autocomplete="off"><kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Strg K'}</kbd><div class="results hidden" id="navRes"></div></label>
          ${navBtn('uebersicht', 'Übersicht', 'uebersicht')}
          ${modNav ? '<div class="grp">Module</div>' : ''}
          ${modNav}
          ${verein.length ? '<div class="grp">Verein</div>' : ''}
          ${verein.map(([k, l]) => navBtn(k, TAB_LABEL[k] && k === 'konten' ? TAB_LABEL.konten : l, PAGE_ICON[k] || 'modul', k === 'konten' || k === 'sicherung' ? k : '')).join('')}
        </div>
        <div class="userchip"><a class="who" href="#konto" id="myAcc" title="Mein Konto" aria-label="Mein Konto"><div class="av">${esc(initials(me.name || me.username))}</div>
          <div class="nm"><b>${esc(me.name || me.username)}</b><span>${me.role === 'oberadmin' ? 'Alle Rechte' : 'Admin'} · Mein Konto</span></div></a><div class="ucbtns">
          ${window.top === window && tabletOnUI ? `<a class="iconbtn" href="./" target="_blank" title="Tablet-Seite öffnen" aria-label="Tablet-Seite öffnen">${icon('tablet', 16)}</a>` : ''}
          <button class="iconbtn" id="logout" title="Abmelden" aria-label="Abmelden">${icon('abmelden', 16)}</button></div></div>
      </nav>
      <div class="content"><div class="pagebar" id="pagebar"></div><main id="main"></main></div></div>`;
    wireLogos();
    $('side').addEventListener('click', e => {
      const b = e.target.closest('button.nav[data-p]'); if (!b) return;
      if (b.dataset.p.startsWith('__')) { const g = b.dataset.p.slice(2); const last = sget('cw_grp_' + g); go(last && GPAGES(g).some(x => x[0] === last) ? last : GPAGES(g)[0][0]); }
      else go(b.dataset.p);
    });
    $('menuT').onclick = () => $('side').classList.toggle('open');
    $('logout').onclick = async e => { e.preventDefault(); await api('logout', 'POST', {}).catch(() => {}); showLogin(); };
    bindSearch();
    api('settings').then(s => { cache.settings = s; $('clubName').textContent = s.clubName; document.title = `${s.clubName} – ${T('Verwaltung')}`; if ($('clubIni')) $('clubIni').textContent = initials(s.clubName); }).catch(() => {});
    refreshBadges();
    go(page);
  }

  /* ---------- Suche (Strg/⌘ K) ----------
     Findet Seiten und Reiter (automatisch aus PAGES), dazu Einstellungen, Felder und Aktionen, die Kern und Module mit GK.registerSearch anmelden.
     Ein Eintrag: { label, page, tab: [tabsKey, reiter] (GK.tabs), sec: [speicher, bereich] (Kern-Einstellungen), seg: 'Unterseite', card: 'Kartenüberschrift',
     field: 'id', btn: 'Knopftext', words: 'Synonyme …', perm, kind: 'einstellung' | 'aktion' | 'reiter', in: 'Reitername für den Pfad', boost: Vorrang (z. B. 1),
     detail: [art, id] (Datensatz in der Detailansicht öffnen, Reiter mit tab: ['detail_<art>', reiter]) } */
  const SEARCH = [];
  /** Gleichbedeutende Wörter: wer das eine sucht, findet auch das andere (normalisiert, siehe snorm) */
  // als ein Text ohne Leerzeichen geschrieben, damit die Übersetzung ihn nicht für Oberflächentext hält (Wort=Synonym,Synonym;…)
  const SYN = ('lastschrift=sepa,einzug,mandat;sepa=lastschrift,einzug;einzug=lastschrift,sepa;passwort=kennwort,pin;kennwort=passwort;pin=passwort,kennwort;'
    + 'push=benachrichtigung;benachrichtigung=push,nachricht;import=importieren,uebernehmen,einlesen;importieren=import;export=exportieren,excel,herunterladen;'
    + 'gebuehr=gebuehren,preis,kosten;preis=preise,gebuehr;mitglied=mitglieder,person;person=mitglied;logo=wappen,bild;platz=plaetze;konto=konten,iban,bankkonto;'
    + 'bankkonto=iban,konto,bank;iban=bankkonto,konto;mail=email,postfach;email=mail,postfach;sperre=sperren,gesperrt;spielplan=nuliga;nuliga=spielplan;'
    + 'sicherung=backup,datensicherung;backup=sicherung,datensicherung;getraenke=verkauf,artikel;tuer=tueren,zugang,schloss;schloss=zugang,tuer')
    .split(';').reduce((o, x) => { const [k, v] = x.split('='); o[k] = v.split(','); return o; }, {});
  const snorm = v => String(v || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
  const lev1 = (a, b) => { if (Math.abs(a.length - b.length) > 1) return false; let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i); };
  /** Alle Einträge, die dieser Benutzer gerade sehen darf (Seite erlaubt, Recht vorhanden, Modul aktiv) */
  function searchIndex() {
    const pathOf = (k, extra) => { const pg = PAGES.find(x => x[0] === k); if (!pg) return []; const g = groupOf(k);
      return [g ? MODG[g].label : pg[3] === 'module' ? pg[1] : GROUP_LABEL[pg[3]] || '', g ? TAB_LABEL[k] || pg[1] : pg[3] === 'module' ? '' : pg[1], extra || ''].filter(Boolean); };
    const pages = PAGES.filter(x => canAny(x[2]) && RENDER[x[0]] && (x[0] !== 'app' || (cache.appModules || []).length))
      .map(([k, l, , g]) => ({ label: groupOf(k) ? TAB_LABEL[k] || l : l, page: k, kind: groupOf(k) ? 'reiter' : 'seite', words: groupOf(k) ? `${l} ${MODG[g].label}` : '', path: pathOf(k).slice(0, -1) }));
    const reg = SEARCH.filter(e => allowed(e.page) && canAny(e.perm)).map(e => ({ ...e, path: pathOf(e.page, e.in) }));
    return [...pages, ...reg].map(e => {
      const lab = snorm(e.label + ' ' + T(e.label)), words = snorm([e.words, e.words ? T(e.words) : ''].join(' ')), path = snorm(e.path.map(x => x + ' ' + T(x)).join(' '));
      return { ...e, _l: lab, _lw: lab.split(' '), _lc: lab.replace(/ /g, ''), _w: words, _p: path };
    });
  }
  /** Wie gut passt ein Eintrag zur Eingabe? 0 = gar nicht. Jedes Wort der Eingabe muss irgendwo passen (auch über Synonyme oder mit einem Tippfehler). */
  function searchScore(e, toks) {
    let sum = 0;
    for (const t of toks) {
      const alts = [t, ...(SYN[t] || [])]; let best = 0;
      alts.forEach((a, i) => { const f = i ? 0.45 : 1;   // Synonym zählt weniger als das gesuchte Wort selbst
        if (e._lw.some(w => w.startsWith(a))) best = Math.max(best, 3 * f);
        else if (e._lc.includes(a)) best = Math.max(best, 2 * f);
        else if (e._w.includes(a)) best = Math.max(best, 1.5 * f);
        else if (e._p.includes(a)) best = Math.max(best, 0.5 * f);
        else if (a.length >= 5 && e._lw.some(w => lev1(a, w.slice(0, a.length)) || lev1(a, w))) best = Math.max(best, 1 * f); });
      if (!best) return 0;
      sum += best;
    }
    return sum + (e._l.startsWith(toks.join(' ')) ? 2 : 0) + (e.kind === 'seite' ? 0.3 : 0) + (e.boost || 0);   // boost: Hauptort einer Aufgabe vor ähnlichen Einträgen
  }
  /** Zum Treffer springen: Seite öffnen, Reiter/Bereich vorwählen, dann Karte bzw. Feld hineinscrollen und kurz hervorheben. Ergebnis: Ziel gefunden? */
  async function searchJump(e) {
    if (e.rec) return recordJump(e.rec);
    if (e.tab) sset('tab_' + e.tab[0], e.tab[1]);
    if (e.sec) sset(e.sec[0], e.sec[1]);
    await go(e.detail ? `${e.page}/${e.detail[0]}/${encodeURIComponent(e.detail[1])}` : e.page);
    if (!e.seg && !e.card && !e.field && !e.btn) return true;
    const orig = t => (window.CWI18N ? CWI18N.orig(t) : t).replace(/\s+/g, ' ').trim();
    const find = () => {
      const m = $('main'); if (!m) return null;
      if (e.field) return $(e.field);
      if (e.btn) return [...m.querySelectorAll('.btn, button'), ...document.querySelectorAll('#tabTools button, #tabTools a, #tabTools label')].find(b => b.offsetParent && orig(b.textContent).startsWith(e.btn));
      if (e.card) { const h = [...m.querySelectorAll('.card h3, .card h2')].find(x => x.offsetParent && orig(x.textContent).startsWith(e.card)); return h && h.closest('.card'); }
      return null;
    };
    const t0 = Date.now(); let segDone = !e.seg, el = null;
    while (Date.now() - t0 < 5000) {
      await new Promise(r => setTimeout(r, 120));
      if (!segDone) { const b = [...document.querySelectorAll('#main .seg > button, #main .chips > button')].find(x => orig(x.textContent).startsWith(e.seg)); if (b) { if (!b.classList.contains('on')) b.click(); segDone = true; } continue; }
      if (!e.card && !e.field && !e.btn) return true;
      el = find(); if (el) break;
    }
    if (!el) return false;
    markHit(e.field ? el.closest('.f, label') || el : el);
    if (e.field || e.btn) el.focus({ preventScroll: true });
    return true;
  }
  /** Ziel hineinscrollen und kurz hervorheben */
  function markHit(box) {
    const tall = box.getBoundingClientRect().height > innerHeight * 0.55;   // hohe Karten ab ihrem Anfang zeigen (unter der Kopfleiste), kleine mittig
    box.style.scrollMarginTop = '96px';
    box.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'smooth' });
    box.classList.remove('cw-hit'); void box.offsetWidth; box.classList.add('cw-hit'); setTimeout(() => box.classList.remove('cw-hit'), 2400);
  }
  /* Datensätze (ab 3.61): Der Server sucht (POST suche, src/suche.js), höchstens 5 Treffer je Art. Ein Treffer öffnet die Detailansicht
     (GK.registerDetail) oder die passende Liste und hebt den Eintrag hervor – wie, meldet das Modul mit GK.registerHit(art, { tab, before, find }). */
  const HIT = {};
  async function recordJump(r) {
    const h = HIT[r.art] || {};
    if (r.detail && DETAIL[r.art]) await go(`${r.page}/${r.art}/${encodeURIComponent(r.id)}`);
    else { if (h.tab) sset('tab_' + h.tab[0], h.tab[1]); if (h.before) h.before(r.id, r.ref); await go(r.page); }
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
      await new Promise(res => setTimeout(res, 120));
      if (go.fin !== go.gen) continue;   // Seite zeichnet noch
      if (r.detail && DETAIL[r.art]) return Boolean(detailCur);
      if (!h.find) return true;
      const el = h.find(r.id, r.ref);
      if (el && el.offsetParent) { markHit(el); return true; }
    }
    return false;
  }
  function bindSearch() {
    const inp = $('navSearch'), box = $('navRes');
    let hits = [], sel = 0, idx = null;
    // Datensätze vom Server: erst ab 2 Zeichen und 250 ms nach dem letzten Tastendruck, Antworten je Eingabe gemerkt (bis zum nächsten Öffnen der Suche)
    const recs = new Map(); let recTimer = 0;
    const KIND = [['seite', 'Seiten & Reiter'], ['reiter', 'Seiten & Reiter'], ['einstellung', 'Einstellungen'], ['aktion', 'Aktionen']];
    const draw = keep => {
      const q = inp.value.replace(/\s+/g, ' ').trim(), toks = snorm(q).split(' ').filter(Boolean);
      if (!toks.length) { box.classList.add('hidden'); return; }
      idx = idx || searchIndex();
      const grp = k => (k === 'einstellung' ? 1 : k === 'aktion' ? 2 : 0);   // Gruppen: Seiten & Reiter · Einstellungen · Aktionen
      const top = idx.map(e => ({ e, s: searchScore(e, toks) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 12);
      const gmax = g => Math.max(...top.filter(x => grp(x.e.kind) === g).map(x => x.s));   // Gruppe mit dem besten Treffer zuerst
      const local = top.sort((a, b) => gmax(grp(b.e.kind)) - gmax(grp(a.e.kind)) || grp(a.e.kind) - grp(b.e.kind) || b.s - a.s).map(x => ({ ...x.e, head: KIND.find(k => k[0] === x.e.kind)[1] }));
      const rd = q.length >= 2 ? recs.get(q) : null;
      const found = rd ? rd.groups.flatMap(g => g.hits.map(h => ({ rec: { art: g.art, page: g.page, detail: g.detail, id: h.id, ref: h.ref }, label: h.label, sub: h.sub, head: g.group }))) : [];
      // Datensätze stehen oben (wer einen Namen tippt, sucht meist eine Person), außer eine Seite oder Einstellung beginnt selbst mit der Eingabe;
      // dann folgen höchstens 6 Seiten und Einstellungen, damit die Liste kurz bleibt
      const lead = top.some(x => x.e._l.startsWith(toks.join(' ')));
      hits = !found.length ? local : lead ? [...local.slice(0, 6), ...found] : [...found, ...local.slice(0, 6)];
      sel = keep ? Math.min(sel, Math.max(0, hits.length - 1)) : 0; let last = '';
      const waiting = q.length >= 2 && !rd;
      box.innerHTML = (hits.length ? hits.map((x, i) => { const head = x.head !== last ? `<div class="sh"${x.rec ? ' translate="no"' : ''}>${esc(x.rec ? x.head : T(x.head))}</div>` : ''; last = x.head;
        return x.rec ? `${head}<button type="button" data-i="${i}" class="${i === sel ? 'sel' : ''}" translate="no"><b>${esc(x.label)}</b>${x.sub ? `<span>${esc(x.sub)}</span>` : ''}</button>`
          : `${head}<button type="button" data-i="${i}" class="${i === sel ? 'sel' : ''}"><b>${esc(T(x.label))}</b>${x.path.length ? `<span>${esc(x.path.map(p => T(p)).join(' › '))}</span>` : ''}</button>`; }).join('')
        : `<span class="muted s" style="padding:8px 10px">${esc(T(waiting ? 'Suche …' : 'Nichts gefunden'))}</span>`)
        + (rd && rd.locked ? `<span class="muted s" style="padding:8px 10px">${esc(T('Personen findet die Suche erst, wenn die persönlichen Daten entsperrt sind (als Admin anmelden).'))}</span>` : '');
      box.classList.remove('hidden');
    };
    const ask = () => {
      clearTimeout(recTimer);
      const q = inp.value.replace(/\s+/g, ' ').trim();
      if (q.length < 2 || recs.has(q)) return;
      recTimer = setTimeout(() => api('suche', 'POST', { q }).then(d => { recs.set(q, d); if (inp.value.replace(/\s+/g, ' ').trim() === q) draw(true); })
        .catch(() => { recs.set(q, { groups: [], locked: false }); if (inp.value.replace(/\s+/g, ' ').trim() === q) draw(true); }), 250);
    };
    const pick = i => { const x = hits[i]; if (!x) return; inp.value = ''; box.classList.add('hidden'); inp.blur(); searchJump(x).catch(() => {}); };
    inp.addEventListener('focus', () => { idx = null; recs.clear(); });   // Rechte, Module und Daten können sich geändert haben
    inp.addEventListener('input', () => { draw(); ask(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(hits.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); box.querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', i === sel)); }
      if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      if (e.key === 'Escape') { inp.value = ''; box.classList.add('hidden'); inp.blur(); }
    });
    box.addEventListener('mousedown', e => { const b = e.target.closest('button[data-i]'); if (b) { e.preventDefault(); pick(+b.dataset.i); } });
    inp.addEventListener('blur', () => setTimeout(() => box.classList.add('hidden'), 120));
    if (!window.__vhKey) {
      window.__vhKey = true;
      document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && $('navSearch')) { e.preventDefault(); $('side').classList.add('open'); $('navSearch').focus(); } });
    }
  }

  /* Menü markieren, Kopf über der Seite (Bereich + Reiter von Getränke) */
  function setChrome(p) {
    const g = groupOf(p);
    if (g) sset('cw_grp_' + g, p);
    document.querySelectorAll('#side button.nav').forEach(b => b.classList.toggle('on', g ? b.dataset.p === '__' + g : b.dataset.p === p));
    const pg = PAGES.find(x => x[0] === p);
    if ($('menuCur')) $('menuCur').textContent = pg ? (g ? MODG[g].label : p === 'konten' ? 'Mitglieder' : pg[1]) : 'Menü';
    const bar = $('pagebar'); if (!bar) return;
    if (!pg || p === 'uebersicht') { bar.innerHTML = ''; return; }
    bar.innerHTML = `<div class="crumb">${g ? 'Module · ' + esc(MODG[g].label) : pg[3] === 'module' ? 'Module · ' + esc(pg[1]) : esc(GROUP_LABEL[pg[3]] || '')}</div>`;
    const old = $('main') && $('main').querySelector('.tabrow:has(> .drinktabs)');
    const keep = old ? [...old.querySelectorAll('#tabTools > *')] : [];   // Knöpfe der Seite überstehen das Auffrischen der Zähler (refreshBadges)
    if (old) old.remove();
    placeDrinkTabs();
    if (keep.length && $('tabTools')) $('tabTools').append(...keep);
  }
  /* Getränke-Unterseiten als Reiter unter Überschrift und Einleitung – an derselben Stelle wie die Reiter der anderen Module */
  function placeDrinkTabs() {
    const g = groupOf(page);
    const m = $('main'); if (!m || !g || detailCur || m.querySelector('.tabrow:has(> .drinktabs)')) return;
    const h = m.querySelector(':scope > h2.page'); if (!h) return;
    h.textContent = T(MODG[g].label);   // überall gleich: Überschrift = Seite im Menü, der Reiter zeigt den Bereich
    const after = fixLead(h);
    const t = document.createElement('div'); t.className = 'tabs drinktabs'; t.setAttribute('role', 'tablist');
    t.innerHTML = GPAGES(g).map(([k, l]) => `<button role="tab" data-tab="${k}" class="${k === page ? 'on' : ''}">${esc(TAB_LABEL[k] || l)}${badges[k] ? `<span class="badge">${badges[k]}</span>` : ''}</button>`).join('');
    t.querySelectorAll('[data-tab]').forEach(b => { b.onclick = e => { e.stopPropagation(); go(b.dataset.tab); }; });
    // Reiterzeile: links die Reiter, rechts die Knöpfe der Seite („+ Neu …“, Export) – siehe GK.tabTools
    const row = document.createElement('div'); row.className = 'tabrow';
    row.append(t); row.insertAdjacentHTML('beforeend', '<div class="tabtools" id="tabTools"></div>');
    after.after(row);
    const on = t.querySelector('.on'); if (on) revealTab(on); else tabFade(t);
  }

  /* Einleitung über Reitern immer gleich hoch (2 Zeilen), damit die Reiter beim Wechsel nicht springen – längere Texte per „mehr“ aufklappen */
  function fixLead(h) {
    if (h.nextElementSibling && h.nextElementSibling.matches('.leadbox')) return h.nextElementSibling;   // schon eingerichtet (Reiter neu gesetzt)
    const box = document.createElement('div'); box.className = 'leadbox';
    while (h.nextElementSibling && h.nextElementSibling.matches('p.lead')) box.appendChild(h.nextElementSibling);
    h.after(box);
    requestAnimationFrame(() => {
      const ps = [...box.children]; if (!ps.length) return;
      if (!ps.some(x => x.scrollHeight > x.clientHeight + 1) && ps.length < 2) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'leadmore'; b.textContent = 'mehr';
      b.onclick = e => { e.stopPropagation(); const o = box.classList.toggle('open'); b.textContent = o ? 'weniger' : 'mehr'; };
      box.appendChild(b);
    });
    return box;
  }

  async function go(p) {
    if (!(await leaveOk())) { setChrome(page); return; }
    { const t = $('toast'); if (t) { clearTimeout(toast.t); t.classList.add('hidden'); } }   // Meldungen der vorigen Seite verschwinden beim Wechsel
    // Detailansicht: Adresse #seite/art/id (Neuladen und Suche führen wieder hin)
    const [pk, dk, ...rest] = String(p).split('/'), did = decodeURIComponent(rest.join('/'));
    const dd = dk && DETAIL[dk];
    let det = dd && dd.page === pk && did && canAny(dd.perm) ? { key: dk, id: did } : null;
    p = pk;
    p = OLD_PAGE[p] || p;
    if (!RENDER[p] || !allowed(p)) { p = 'uebersicht'; det = null; }
    page = p; detailCur = det;
    history.replaceState(null, '', '#' + hashOf());
    // Reiter der Module: neu einsetzen, sobald eine Seite ihren Inhalt schreibt. Nach erneuter Anmeldung (z. B. nach einem Update des Add-ons)
    // baut die Verwaltung ihr Grundgerüst neu – dann muss auch der Beobachter an das neue <main>, sonst fehlen die Reiter bis zum Neuladen.
    if ($('main') && go.obsEl !== $('main')) { if (go.obs) go.obs.disconnect(); go.obsEl = $('main'); go.obs = new MutationObserver(() => placeDrinkTabs()); go.obs.observe(go.obsEl, { childList: true }); }
    setChrome(p);
    $('side').classList.remove('open');
    $('main').onclick = null; $('main').oninput = null;
    $('main').innerHTML = '<p class="muted">Lade …</p>';
    // Seitenwechsel während eine langsame Seite noch lädt: endet die alte Seite nach der neuen, hätte sie den Inhalt überschrieben → neue Seite neu zeichnen
    const gen = go.gen = (go.gen || 0) + 1;
    const redraw = () => { const g2 = go.gen; go.fin = 0; go.stale = 0; renderCur().catch(pageFail).finally(() => { if (g2 === go.gen) { go.fin = g2; placeDrinkTabs(); } }); };
    const settle = () => {
      if (gen === go.gen) { if (go.stale === gen) redraw(); else { go.fin = gen; placeDrinkTabs(); } return; }
      // alte Seite fertig: aktuelle schon fertig → neu zeichnen, sonst merken (die aktuelle zeichnet sich am Ende neu)
      if (go.fin === go.gen) redraw(); else go.stale = go.gen;
    };
    renderCur().catch(pageFail).finally(settle);
    window.scrollTo(0, 0);
  }
  const hashOf = () => page + (detailCur ? `/${detailCur.key}/${encodeURIComponent(detailCur.id)}` : '');
  const renderCur = () => (detailCur ? renderDetail(detailCur) : RENDER[page]());

  window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (me && p && p !== hashOf()) go(p); });

  /* ---------- Detailansicht eines Datensatzes (Regel 9) ----------
     Ersetzt die Seite: Überschrift = Name des Datensatzes, darunter genau eine Reiterzeile mit „← Zurück“ und den Reitern des Datensatzes –
     die Modulreiter verschwinden so lange. Adresse #seite/art/id, der Reiter wird je Art gemerkt (wie GK.tabs). */
  const DETAIL = {};
  let detailCur = null;   // { key, id } der offenen Detailansicht
  async function renderDetail(det) {
    const d = DETAIL[det.key];
    const rec = await d.load(det.id);
    if (!rec) { toast('Nicht mehr vorhanden.'); detailCur = null; history.replaceState(null, '', '#' + page); return RENDER[page](); }
    const list = rec.tabs && rec.tabs.length ? rec.tabs : [['', '']];
    const store = 'tab_detail_' + det.key;
    let cur = sget(store); if (!list.some(t => t[0] === cur)) cur = list[0][0];
    $('main').innerHTML = `<h2 class="page" translate="no">${esc(rec.title)}</h2>${rec.lead ? `<p class="lead">${esc(rec.lead)}</p>` : ''}
      <div class="tabrow detailrow"><button type="button" class="btn ghost detback" id="detBack">← ${esc(d.back)}</button>
        ${list[0][1] ? `<div class="tabs" role="tablist">${list.map(([k, l]) => `<button role="tab" data-tab="${esc(k)}">${esc(l)}</button>`).join('')}</div>` : ''}<div class="tabtools" id="tabTools"></div></div>
      <div class="tabbody detbody"></div>`;
    const body = $('main').querySelector('.detbody'), bar = $('main').querySelector('.detailrow .tabs');
    $('detBack').onclick = () => go(page);
    const show = async k => {
      if (k !== cur && !(await leaveOk())) return;
      cur = k; sset(store, k);
      if (bar) bar.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('on', b.dataset.tab === k); if (b.dataset.tab === k) revealTab(b); });
      const tt = $('tabTools'); if (tt) tt.innerHTML = '';
      body.innerHTML = '<p class="muted">Lade …</p>';
      try { await d.render(k, body, rec, det.id); } catch (e) { fail(e); }
    };
    if (bar) bar.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => show(b.dataset.tab); });
    const first = cur; cur = null; await show(first);
  }

  async function refreshBadges() {
    const setB = (k, n, cls) => { const b = document.querySelector(`[data-badge="${k}"]`); if (b) { b.textContent = n; b.classList.toggle('hidden', !n); if (cls) b.classList.add(cls); } };
    if (canAny(['veranstaltungen', 'uebernahme', 'abrechnung', 'export']) && (cache.modules || []).includes('getraenke')) {
      const t = await api('tabs?days=1').catch(() => ({ open: [] }));
      badges.veranstaltungen = t.open.length;
    }
    if (can('konten')) badges.konten = (await api('members').catch(() => ({ rows: [] }))).rows.filter(m => m.pending).length;
    // Datensicherung: rot, wenn kein Sicherungspasswort gesetzt ist oder die letzte erfolgreiche Sicherung älter als 7 Tage ist (Status ist eine billige Abfrage)
    if (can('einstellungen')) {
      const b = await api('backups/status').catch(() => null);
      badges.sicherung = b && (!b.hasKey || !b.last_ok || Date.now() - Date.parse(b.last_ok) > 7 * 24 * 3600000) ? '!' : 0;
    }
    for (const fn of BADGE_HOOKS) { try { Object.assign(badges, await fn()); } catch (e) { /* egal */ } }
    // Menüeinträge: Seite selbst oder Summe der Seiten eines Moduls
    for (const g of Object.keys(MODG)) setB(g, GPAGES(g).reduce((a, x) => a + (badges[x[0]] || 0), 0), 'a');
    PAGES.filter(x => x[3] === 'module').forEach(([k]) => setB(k, badges[k] || 0, 'a'));
    setB('konten', groupOf('konten') ? 0 : badges.konten || 0);
    setB('sicherung', badges.sicherung || 0, 'r');
    if (groupOf(page)) setChrome(page);
  }
  const BADGE_HOOKS = [];

  async function loadArticles() { cache.articles = await api('articles'); return cache.articles; }
  async function loadMembers() { const r = await api('members'); cache.members = r.rows; cache.seasonStart = r.seasonStart; return cache.members; }
  const articleOptions = (sel, { ignore = false, create = false, empty = '— Artikel wählen —' } = {}) =>
    `<option value="">${empty}</option>${ignore ? `<option value="ignore" ${sel === 'ignore' ? 'selected' : ''}>— ignorieren (kein Getränk) —</option>` : ''}
     ${cache.articles.filter(a => a.active || a.id === sel).map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
     ${create && can('artikel') ? '<option value="new">+ neuen Artikel anlegen …</option>' : ''}`;

  function rangeBar(from, to, id = 'rng') {
    return `<div class="row" id="${id}" style="margin-bottom:14px">
      <label class="f">Von<input type="date" name="from" value="${from}"></label>
      <label class="f">Bis<input type="date" name="to" value="${to}"></label>
      <button class="btn" data-r="apply">Anzeigen</button>
      <button class="btn ghost" data-r="season">Ganze Saison</button></div>`;
  }
  function bindRange(id, cb) {
    const box = $(id);
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      if (b.dataset.r === 'season') { box.querySelector('[name=from]').value = new Date().getFullYear() + '-01-01'; box.querySelector('[name=to]').value = today(); }
      cb(box.querySelector('[name=from]').value, box.querySelector('[name=to]').value);
    });
  }

  const RENDER = {};

  /* Funktionsimport: Einstellungen eines Moduls aus einer Exportdatei übernehmen */
  function funcImport(id, name, after) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      let body;
      try { body = JSON.parse(await f.text()); } catch (e) { return fail(new Error('Die Datei ist keine gültige Exportdatei.')); }
      if (!body || !['clubwerk-funktion', 'vereinsheim-funktion'].includes(body.format)) return fail(new Error('Die Datei ist keine Funktions-Exportdatei von Clubwerk.'));
      if (body.module !== id) return fail(new Error(`Die Datei gehört zum Modul „${body.name || body.module}“, nicht zu „${name}“.`));
      if (!await ask(`Einstellungen für „${name}“ importieren?\n\nQuelle: ${body.club || 'unbekannt'}${body.exported ? ', ' + body.exported : ''}\n\nDie bisherigen Einstellungen dieses Moduls werden ersetzt. Buchungen, Protokolle und Freischaltungen bleiben erhalten.`)) return;
      try {
        const r = await api('extensions/' + id + '/import', 'POST', body);
        await ask(`Import abgeschlossen.\n\n${r.summary || ''}`, { okOnly: true, danger: false }).catch(() => {});
        if (after) after(); else location.reload();
      } catch (e) { fail(e); }
    };
    inp.click();
  }
  /** Karte „Funktion exportieren / importieren“ für die Seite eines Moduls */
  function funcBox(el, id, name, after) {
    if (!el) return;
    el.innerHTML = `<div class="card"><h3>Einstellungen übertragen</h3>
      <p class="muted s" style="margin-top:0">Alle Einstellungen von „${esc(name)}“ als Datei sichern oder aus einer Datei übernehmen – z. B. für einen zweiten Verein oder nach einer Neuinstallation. PINs, Passwörter und Schlüssel sind nicht enthalten.</p>
      <div class="row"><a class="btn" href="api/admin/extensions/${esc(id)}/export" download>Einstellungen exportieren</a><button class="btn" data-fbimp="1">Einstellungen importieren …</button></div></div>`;
    el.querySelector('[data-fbimp]').onclick = () => funcImport(id, name, after);
  }

  /* Schnittstelle für Erweiterungen (deren admin.js meldet sich hier an) */
  window.GK = {
    $, esc, euro, num, deDate, deTime, today, toCents, centsToInput, api, toast, fail, dialog, closeDialog, can, canFull, RENDER, icon, T, printHtml: (...a) => printHtml(...a), copyText: t => copyText(t),
    scheme: () => SCHEME, ask, askText, deleteMember, watch, clean, tabs, funcBox, funcImport, lastFirst, busy, invite: (...a) => appInvite(...a), go: p => go(p),
    me: () => me,
    /** ungespeicherte Änderungen? Rückfrage „Verwerfen?“ → true = weiter */
    leaveOk: () => leaveOk(),
    /** Verwaltung neu aufbauen (nach der Ersteinrichtung) */
    restart: () => start(),
    /** fn nach dem Aufbau der Verwaltung ausführen (nach jeder Anmeldung) */
    afterShell: fn => { if (typeof fn === 'function') AFTER_SHELL.push(fn); },
    /** Tablet im Vereinsheim eingeschaltet? (Einstellungen › Tablet) */
    tabletOn: () => tabletOnUI,
    /** Einstellungen öffnen, gleich im richtigen Bereich (z. B. 'bank') */
    openSettings: sec => { sset('cw_setsec', sec); if (page === 'einstellungen') RENDER.einstellungen(); else go('einstellungen'); },
    modules: () => cache.modules || [],
    /** Modul der offenen Seite ('getraenke' für Verkauf und Lager, Erweiterungs-id, sonst 'kern') – für den Design-Prüfstand */
    pageModule: () => { const pg = PAGES.find(x => x[0] === page); return !pg ? 'kern' : ['getraenke', 'lager'].includes(pg[3]) ? 'getraenke' : PAGE_MOD[page] || 'kern'; },
    /** Knöpfe einer Seite rechts in die Reiterzeile setzen (statt in eine eigene Zeile darüber): GK.tabTools(html, owner).
     *  owner = Element des Seiteninhalts; verschwindet es (andere Ansicht), werden die Knöpfe entfernt. Rückgabe: Container oder null (Seite ohne Reiter) */
    tabTools(html, owner) {
      placeDrinkTabs();
      const box = $('tabTools'); if (!box) return null;
      box.innerHTML = html || ''; tabToolsOwner = owner || null;
      fitTools();
      return box;
    },
    /** Eigener Reiter auf der Seite „Mitglieder-App“ (Verein): registerAppSection({ key, label, perm, render(el) }) –
     *  el ist eine leere Karte, render füllt sie (Überschrift, Felder, Speichern) */
    registerAppSection({ key, label, perm, render }) { if (/^[a-z0-9-]+$/.test(key) && !APP_EXTRA.some(x => x.key === key)) APP_EXTRA.push({ key, label, perm, render }); },
    /** registerPage({ key, title, perm, render, group, before, icon, tab, order })
     *  group: 'module' (eigener Menüeintrag, Standard) · 'verein' · { key, label, icon, order } = Modul mit mehreren Seiten als Reiter (wie „Verkauf“)
     *  order: Position im Menü unter „Module“ (Verkauf 1 … Buchhaltung 8; ohne Angabe 50 = hinten, in Registrierungsreihenfolge) */
    registerPage({ key, title, perm, render, group, before, icon, tab, order }) {
      if (!/^[a-z0-9-]+$/.test(key) || PAGES.some(p => p[0] === key)) return;
      RENDER[key] = render;
      if (icon && ICO[icon]) PAGE_ICON[key] = icon;
      if (order) PAGE_ORDER[key] = order;
      if (loadingExt) PAGE_MOD[key] = loadingExt;
      let gk = group === 'verein' ? 'verein' : 'module';
      if (group && typeof group === 'object' && /^[a-z0-9-]+$/.test(group.key || '')) { gk = 'g-' + group.key; if (!MODG[gk]) MODG[gk] = { label: group.label || title, icon: ICO[group.icon] ? group.icon : 'modul', order: group.order || 50 }; }
      if (tab) TAB_LABEL[key] = tab;
      const entry = [key, title, perm || null, gk];
      const at = before ? PAGES.findIndex(p => p[0] === before) : -1;
      if (at >= 0) PAGES.splice(at, 0, entry); else PAGES.push(entry);
    },
    /** Menüeintrag umbenennen (z. B. „Mitglieder & Konten“ → „Getränkekonten & PINs“, wenn die Mitgliederverwaltung aktiv ist) */
    relabel(key, title) { const p = PAGES.find(x => x[0] === key); if (p) { p[1] = title; if (TAB_LABEL[key]) TAB_LABEL[key] = title; } },
    /** Seite in einen anderen Bereich verschieben, z. B. „Konten & PINs“ zu „Verkauf“ (group: 'getraenke' | 'verein' | Modulschlüssel), optional vor eine Seite */
    regroup(key, group, { title, before, tab } = {}) {
      const i = PAGES.findIndex(x => x[0] === key); if (i < 0) return;
      const [p] = PAGES.splice(i, 1); p[3] = MODG[group] ? group : MODG['g-' + group] ? 'g-' + group : group;
      if (title) { p[1] = title; TAB_LABEL[key] = tab || title; }
      const to = before || (p[3] === 'getraenke' ? 'auswertung' : null);   // Verkauf: Konten steht vor Auswertung und Einstellungen
      const at = to ? PAGES.findIndex(x => x[0] === to) : -1;
      if (at >= 0) PAGES.splice(at, 0, p); else { const last = PAGES.map(x => x[3]).lastIndexOf(p[3]); PAGES.splice(last >= 0 ? last + 1 : PAGES.length, 0, p); }
    },
    /** Einträge für die Suche (Strg/⌘ K): registerSearch([{ label, page, tab, sec, seg, card, field, btn, words, perm, kind, in }]) – siehe Kommentar an SEARCH */
    registerSearch(list) { for (const e of list || []) if (e && e.label && e.page) SEARCH.push({ kind: 'einstellung', words: '', ...e }); },
    /** Für den Design-Prüfstand: alle sichtbaren Sucheinträge und der Sprung dorthin (true = Ziel gefunden) */
    searchIndex: () => searchIndex(), searchJump: e => searchJump(e),
    /** Sprung zu einem Datensatz-Treffer der Suche (Server-Hook „search“) ohne Detailansicht: registerHit(art, { tab: [tabsKey, reiter], before(id, ref), find(id, ref) → Element })
     *  before setzt Filter der Liste (z. B. „Alle“), find liefert die Zeile, die hervorgehoben wird. Mit Detailansicht (registerDetail, gleiche Art) ist nichts anzumelden. */
    registerHit(art, h) { if (/^[a-z0-9-]+$/.test(art) && h) HIT[art] = h; },
    /** Zahlen für Reiter-Abzeichen: fn() → { seitenschlüssel: Anzahl } */
    badges(fn) { BADGE_HOOKS.push(fn); },
    refreshBadges: () => refreshBadges(),
    /** Einstellungskarten eines Moduls nach Bereichen ordnen (untereinander, mit Abschnittsüberschriften): sectionize({ root, secs: [[key, label]], keyOf }) */
    sectionize: o => sectionize(o),
    /** Detailansicht anmelden: registerDetail({ key, page, back, perm, load, render })
     *  key: Art ('mitglied'), page: Seite, zu der sie gehört, back: Text des Zurück-Knopfs (Standard „Zurück“), perm wie bei registerPage,
     *  load: async id → { title, lead, tabs: [[key, label]] } oder null (gibt es nicht mehr), render: async (reiter, body, datensatz, id) */
    registerDetail({ key, page: pg, back, perm, load, render }) { if (/^[a-z0-9-]+$/.test(key) && pg && load && render) DETAIL[key] = { page: pg, back: back || 'Zurück', perm, load, render }; },
    /** Datensatz öffnen (Adresse #seite/art/id), optional gleich in einem Reiter */
    openDetail(key, id, tab) { const d = DETAIL[key]; if (!d) return Promise.resolve(); if (tab) sset('tab_detail_' + key, tab); return go(`${d.page}/${key}/${encodeURIComponent(id)}`); },
    /** Detailansicht schließen, zurück zur Seite */
    closeDetail: () => go(page),
  };
  // Kernseiten aus eigenen Dateien (z. B. mail.js), die vor admin.js geladen wurden
  (window.CW_PAGES || []).forEach(fn => { try { fn(window.GK); } catch (e) { console.error('Seite', e); } });
  window.CW_PAGES = { push: fn => { try { fn(window.GK); } catch (e) { console.error('Seite', e); } } };

  /* Suche: Datensätze des Kerns – Konto (Zeile auswählen, Detailkarte zeigt Konto und PIN) und Artikel (Zeile hervorheben) */
  window.GK.registerHit('konto', { before: (id, ref) => { cache.mSel = Number(id); cache.mFilter = ref === 'aus' ? 'aus' : 'alle'; },
    find: id => $('main').querySelector(`#mTbl tr[data-sel="${Number(id)}"]`) || $('main').querySelector(`[data-pn="${Number(id)}"]`)?.closest('tr') });
  window.GK.registerHit('artikel', { find: id => $('main').querySelector(`[data-e="${Number(id)}"]`)?.closest('tr') });
  /* Suche: Einstellungen und Aktionen des Kerns (Seiten und Reiter findet sie von selbst) */
  const SET = sec => ['cw_setsec', sec], APS = sec => ['cw_appsec', sec], E = 'einstellungen';
  window.GK.registerSearch([
    { label: 'Vereinsname und Vereinsfarbe', page: E, sec: SET('verein'), card: 'Verein', field: 'club', words: 'Name Farbe Verein', perm: E, in: 'Verein' },
    { label: 'Zweitfarbe des Vereins', page: E, sec: SET('verein'), card: 'Verein', field: 'clubColor2', words: 'Farbe Zweitfarbe Akzent Logo', perm: E, in: 'Verein' },
    { label: 'Anschrift des Vereins', page: E, sec: SET('verein'), card: 'Verein', field: 'clubStreet', words: 'Adresse Straße PLZ Ort Anschrift Sitz Rechnung', perm: E, in: 'Verein' },
    { label: 'E-Mail und Telefon des Vereins', page: E, sec: SET('verein'), card: 'Verein', field: 'clubEmail', words: 'Kontakt Telefon Mail Rufnummer', perm: E, in: 'Verein' },
    { label: 'Vereinslogo', page: E, sec: SET('verein'), card: 'Vereinslogo', words: 'Logo Wappen Bild hochladen', perm: E, in: 'Verein' },
    { label: 'Vereinssprache', page: E, sec: SET('verein'), card: 'Vereinssprache', field: 'lgClub', words: 'Sprache Englisch', perm: E, in: 'Verein' },
    { label: 'Bankkonten des Vereins', page: E, sec: SET('bank'), card: 'Bankkonten', words: 'IBAN BIC Konto Bank Vereinskonto', in: 'Bankkonten' },
    { label: 'Postfach (Versand von E-Mails)', page: E, sec: SET('mail'), card: 'Postfach', words: 'SMTP Mailserver Absender E-Mail', perm: E, in: 'Postfach' },
    { label: 'Testmail senden', page: E, sec: SET('mail'), btn: 'Testmail senden', words: 'E-Mail Postfach', perm: E, kind: 'aktion', in: 'Postfach' },
    { label: 'Vereinsnetz', page: E, sec: SET('erreichbar'), card: 'Vereinsnetz', field: 'apNets', words: 'Netz WLAN Netzwerk Gast VPN Erreichbarkeit', perm: E, in: 'Erreichbarkeit' },
    { label: 'Weitere Adressen der Verwaltung', page: E, sec: SET('erreichbar'), card: 'Weitere Adressen', words: 'Adresse Hostname Domain Rechnername DuckDNS', perm: E, in: 'Erreichbarkeit' },
    { label: 'HTTPS und Zugang von außen', page: E, sec: SET('erreichbar'), card: 'Verschlüsselung und Zugang', words: 'HTTPS Zertifikat Tunnel Cloudflare Internet', perm: E, in: 'Erreichbarkeit' },
    { label: 'Tablet-Passwort', page: E, sec: SET('tablet'), card: 'Passwort für das Tablet', words: 'Passwort Kennwort Sperre Tablet sperren', perm: E, in: 'Tablet' },
    { label: 'Alle Tablets abmelden', page: E, sec: SET('tablet'), btn: 'Alle Geräte abmelden', words: 'Geräte abmelden Tablet', perm: E, kind: 'aktion', in: 'Tablet' },
    { label: 'Leiste am Tablet (Reihenfolge, Start-Reiter)', page: E, sec: SET('tablet'), card: 'Leiste am Tablet', words: 'Reihenfolge Reiter Kopfzeile Start', perm: E, in: 'Tablet' },
    { label: 'Modul am Tablet zeigen oder ausblenden', page: E, sec: SET('tablet'), card: 'Leiste am Tablet', words: 'Beregnung Zugang Türen Tablet zeigen ausblenden Schalter Kopfzeile', perm: E, in: 'Tablet' },
    { label: 'Links in der Kopfzeile', page: E, sec: SET('tablet'), card: 'Links in der Kopfzeile', words: 'Link Kopfzeile Tablet', perm: E, in: 'Tablet' },
    { label: 'Darstellung am Tablet (hell, dunkel, Hoher Kontrast)', page: E, sec: SET('tablet'), card: 'Darstellung am Tablet', field: 'tkTheme', words: 'Hoher Kontrast Sonne Theke dunkel hell Design Darstellung', perm: E, in: 'Tablet' },
        { label: 'Tablet & Home Assistant', page: E, sec: SET('tablet'), card: 'Tablet & Home Assistant', words: 'Home Assistant Tablet', perm: E, in: 'Tablet' },
    { label: 'Module ein- und ausschalten', page: E, sec: SET('module'), card: 'Module & Erweiterungen', words: 'Modul Erweiterung einschalten ausschalten deinstallieren', perm: E, in: 'Module' },
    { label: 'Einstellungen eines Moduls exportieren oder importieren', page: E, sec: SET('module'), btn: 'Einstellungen exportieren', words: 'Export Import Einstellungen übertragen Modul', perm: E, kind: 'aktion', in: 'Module' },
    { label: 'Erweiterung einspielen (ZIP)', page: E, sec: SET('module'), btn: 'Erweiterung einspielen', words: 'Modul Erweiterung', perm: E, kind: 'aktion', in: 'Module' },
    { label: 'Übersetzung verbessern oder Sprache hinzufügen', page: E, sec: SET('sprache'), card: 'Sprachen', words: 'Übersetzung Sprache', perm: E, kind: 'aktion', in: 'Sprachen' },
        { label: 'Löschfristen (Protokoll, Türen, E-Mails …)', page: E, sec: SET('datenschutz'), card: 'Löschfristen', words: 'DSGVO Datenschutz Aufbewahrung löschen Frist Protokoll', perm: E, in: 'Datenschutz', boost: 1 },
        { label: 'Datenschutzhinweis in der Mitglieder-App', page: E, sec: SET('datenschutz'), card: 'Datenschutzhinweis', field: 'dsText', words: 'DSGVO Datenschutzerklärung App Hinweis', perm: E, in: 'Datenschutz' },
        { label: 'Verzeichnis von Verarbeitungstätigkeiten', page: E, sec: SET('datenschutz'), card: 'Verzeichnis', words: 'DSGVO Verarbeitungsverzeichnis Art. 30 drucken', perm: E, in: 'Datenschutz' },
        { label: 'Update von Clubwerk', page: E, sec: SET('update'), card: 'Update von Clubwerk', words: 'Update Version aktualisieren ZIP', perm: E, in: 'Update' },
    { label: 'Mein Passwort ändern', page: 'konto', card: 'Mein Passwort', field: 'pwCur', words: 'Passwort Kennwort Konto', in: 'Mein Konto' },
    { label: 'Meine Sprache in diesem Browser', page: 'konto', card: 'Anzeige in diesem Browser', field: 'lgMine', words: 'Sprache Englisch', in: 'Mein Konto' },
    { label: 'Hell, dunkel oder Hoher Kontrast (Darstellung)', page: 'konto', card: 'Anzeige in diesem Browser', field: 'themeSel', words: 'Dunkel Hell Design Modus Darstellung Nachtmodus Kontrast', in: 'Mein Konto' },
    { label: 'Mein E-Mail-Absender', page: 'konto', card: 'Mein E-Mail-Absender', words: 'Absender Antworten Signatur Unterschrift Mail', perm: 'email', in: 'Mein Konto' },
    { label: 'Verschlüsselung der persönlichen Daten', page: 'sicherung', card: 'Verschlüsselung der persönlichen Daten', words: 'Tresor Verschlüsselung Datenschutz' },
    { label: 'Jetzt sichern', page: 'sicherung', btn: 'Jetzt sichern', words: 'Sicherung Backup', kind: 'aktion' },
    { label: 'Sicherungspasswort', page: 'sicherung', card: 'Sicherungspasswort', words: 'Passwort Sicherung Backup' },
    { label: 'Zeitplan und Aufbewahrung der Sicherungen', page: 'sicherung', card: 'Zeitplan & Aufbewahrung', words: 'Sicherung Uhrzeit aufbewahren' },
    { label: 'Sicherungsziele (Dropbox, NAS, Cloud)', page: 'sicherung', card: 'Sicherungsziele', words: 'Dropbox NAS Cloud FRITZ!Box Ziel Sicherung' },
    { label: 'Wiederherstellen', page: 'sicherung', card: 'Wiederherstellen', words: 'Sicherung einspielen Backup', kind: 'aktion' },
    { label: 'Datenbank-Schnappschüsse', page: 'sicherung', card: 'Datenbank-Schnappschüsse', words: 'Schnappschuss Datenbank Sicherung' },
    { label: 'Mitglied für die App freischalten', page: 'app', perm: 'konten', sec: APS('mitglieder'), card: 'Mitglied freischalten', words: 'App Einladung QR-Code Handy koppeln', kind: 'aktion', in: 'Mitglieder' },
    { label: 'Wer sieht welchen Bereich der App?', page: 'app', perm: ['app', 'einstellungen'], sec: APS('bereiche'), card: 'Bereiche der App', words: 'App Bereiche Rechte für wen vorwählen', in: 'Bereiche' },
    { label: 'Von unterwegs nutzbare Bereiche', page: 'app', perm: 'einstellungen', sec: APS('bereiche'), card: 'Bereiche der App', words: 'App unterwegs Internet', in: 'Bereiche' },
    { label: 'Reihenfolge und Start der App-Bereiche', page: 'app', perm: ['app', 'einstellungen'], sec: APS('bereiche'), card: 'Bereiche der App', words: 'App Reihenfolge Leiste Start Reiter', in: 'Bereiche' },
    { label: 'Thekenkonto in „Für mich“ zeigen', page: 'app', perm: ['app', 'einstellungen'], sec: APS('bereiche'), card: 'Bereiche der App', field: 'bgKonto', words: 'App Für mich Startseite Thekenkonto Verkaufskonto Kontostand offen', in: 'Bereiche' },
    { label: 'Push-Benachrichtigungen freigeben', page: 'app', perm: ['app', 'einstellungen'], sec: APS('push'), card: 'Benachrichtigungen', words: 'Push Benachrichtigung Nachricht', in: 'Benachrichtigungen' },
    { label: 'Adresse und Name der Mitglieder-App', page: 'app', perm: ['app', 'einstellungen'], sec: APS('einstellungen'), card: 'Adresse & Aussehen', field: 'apUrl', words: 'Adresse WLAN Homescreen Name Aussehen', in: 'Einstellungen' },
    { label: 'Von unterwegs erreichbar (öffentliche Adresse)', page: 'app', perm: 'einstellungen', sec: APS('einstellungen'), card: 'Adresse & Aussehen', field: 'apExtUrl', words: 'Tunnel Cloudflare Internet unterwegs öffentlich', in: 'Einstellungen' },
    { label: 'Sicherheit der App (QR-Code, Warnungen)', page: 'app', perm: 'einstellungen', sec: APS('einstellungen'), card: 'Sicherheit', words: 'QR-Code Sicherheit gesperrt', in: 'Einstellungen' },
    { label: 'Bestätigung per SMS', page: 'app', perm: 'einstellungen', sec: APS('einstellungen'), card: 'Bestätigung per SMS', words: 'SMS Stick Handy', in: 'Einstellungen' },
    { label: 'Neue E-Mail schreiben', page: 'email', tab: ['email', 'neu'], words: 'Rundmail Mail schreiben', kind: 'aktion', in: 'Neue E-Mail' },
    { label: 'Verteiler', page: 'email', tab: ['email', 'verteiler'], words: 'Verteiler Gruppe Mail', kind: 'reiter', in: 'Verteiler' },
    { label: 'E-Mail-Vorlagen', page: 'email', tab: ['email', 'vorlagen'], words: 'Vorlage Mail', kind: 'reiter', in: 'Vorlagen' },
    { label: 'Benutzer anlegen', page: 'benutzer', tab: ['benutzer', 'benutzer'], btn: '+ Neuer Benutzer', words: 'Benutzer Zugang Konto', kind: 'aktion' },
    { label: 'Rollen und Rechte', page: 'benutzer', tab: ['benutzer', 'rollen'], words: 'Rolle Rechte Berechtigung', kind: 'reiter', in: 'Rollen' },
    { label: 'Änderungsprotokoll', page: 'protokoll', words: 'Protokoll Verlauf geändert wer', kind: 'reiter' },
    { label: 'Artikel anlegen', page: 'artikel', btn: '+ Neuer Artikel', words: 'Getränk Artikel Preis', kind: 'aktion' },
    { label: 'Artikel aus Excel importieren', page: 'artikel', btn: 'Import', words: 'Import Artikel Preise Excel', kind: 'aktion' },
    { label: 'Artikel als Excel herunterladen', page: 'artikel', btn: 'Excel', words: 'Export Artikel Preise', kind: 'aktion' },
    { label: 'Reihenfolge der Kategorien', page: 'vkeinst', card: 'Reihenfolge der Kategorien', words: 'Kategorie Sortierung Artikel Tablet', perm: 'artikel', in: 'Grundregeln' },
    { label: 'Gemerkte Zuordnungen von Lieferanten-Artikeln', page: 'vkeinst', card: 'Gemerkte Zuordnungen', words: 'Lieferant Artikel Lieferung Beleg vergessen', perm: 'lieferungen', in: 'Grundregeln' },
    { label: 'Startseite am Tablet („Gerade oft hier“)', page: 'vkeinst', card: 'Gerade oft hier', field: 'topN', words: 'Verkauf Startseite Namen Tablet häufig', perm: 'einstellungen', in: 'Tablet' },
    { label: 'Einstellungen des Verkaufs exportieren oder importieren', page: 'vkeinst', card: 'Einstellungen übertragen', words: 'Export Import Einstellungen übertragen Verkauf', perm: 'einstellungen', kind: 'aktion', in: 'Einstellungen übertragen' },
    { label: 'Abgleich Lieferungen und Buchungen', page: 'bestand', card: 'Abgleich', words: 'Schwund geliefert gebucht offen Inventur Differenz', in: 'Lager' },
    { label: 'Gäste-Deckel bezahlen, übernehmen oder abschreiben', page: 'veranstaltungen', card: 'Offen', words: 'Deckel Gast bezahlen übernehmen abschreiben bar Karte', kind: 'aktion' },
    { label: 'Inventur', page: 'bestand', card: 'Aktueller Bestand', words: 'Inventur Zählung Bestand', kind: 'aktion' },
    { label: 'Bruch oder Korrektur buchen', page: 'bestand', card: 'Bruch oder Korrektur', words: 'Bruch Schwund Korrektur Bestand', kind: 'aktion' },
    { label: 'Lieferung erfassen (Beleg hochladen)', page: 'lieferungen', btn: 'Dateien wählen', words: 'Lieferung Rechnung Lieferschein Beleg', kind: 'aktion' },
    { label: 'Bestellung senden', page: 'bestellung', btn: 'Bestellung jetzt senden', words: 'Bestellung Lieferant bestellen', kind: 'aktion' },
    { label: 'Buchung nachtragen', page: 'buchungen', card: 'Nachtragen', words: 'Nachtragen Strich vergessen Buchung', kind: 'aktion' },
    { label: 'Verkauf per Lastschrift einziehen', page: 'abrechnung', btn: 'Per Lastschrift einziehen', words: 'Lastschrift SEPA Einzug Verkauf', kind: 'aktion' },
    { label: 'Betrag auf Konto buchen', page: 'abrechnung', btn: '+ Betrag auf Konto', words: 'Betrag Konto Essen buchen', kind: 'aktion' },
    { label: 'Abrechnung als Excel', page: 'abrechnung', btn: 'Excel', words: 'Export Excel Abrechnung Kassenprüfer', kind: 'aktion' },
    { label: 'Konto anlegen (Verkauf)', page: 'konten', btn: '+ Neues Konto', words: 'Konto PIN Mitglied anlegen', kind: 'aktion' },
    { label: 'Konten aus Excel importieren', page: 'konten', btn: 'Import', words: 'Import Konten Liste', kind: 'aktion' },
    { label: 'Veranstaltung anlegen', page: 'veranstaltungen', card: 'Neue Veranstaltung', words: 'Veranstaltung Fest Feier Deckel', kind: 'aktion' },
  ]);

  /* =================== Übersicht =================== */
  /** Modul-Daten (Warnungen + Kennzahlen) aller aktiven Erweiterungen */
  async function moduleOverview() {
    const list = await api('overview/modules').catch(() => []);
    const pageOf = m => (PAGES.some(p => p[0] === m.page) ? m.page : PAGES.some(p => p[0] === m.id) ? m.id : null);
    return list.map(m => ({ ...m, pageKey: pageOf(m) }));
  }
  const greeting = () => { const h = new Date().getHours(); return h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend'; };
  /* Hauptkarte „Zu erledigen“: Hinweise als ruhige Liste mit farbigem Strich, rote zuerst, höchstens 6 sichtbar, der Rest hinter „Alle zeigen“.
     Je Hinweis ein kurzer Satz; Einzelheiten (detail) stehen im Tooltip und auf der Seite, zu der der Link führt */
  const TODO_N = 6;
  const hintHtml = (a, i) => `<div class="hint ${a.level === 'r' ? 'r' : 'a'}${i >= TODO_N ? ' extra' : ''}"><i class="bar" aria-hidden="true"></i><div class="ht">${a.who ? `<b>${esc(a.who)}</b>` : ''}<span title="${esc(a.detail ? `${T(a.text)} ${T(a.detail)}` : T(a.text))}">${esc(a.text)}</span></div>${a.go ? `<a href="#${a.go}" data-go="${a.go}"${a.sec ? ` data-secstore="${a.sec[0]}" data-sec="${a.sec[1]}"` : ''}>${esc(a.link || 'Ansehen')}</a>` : ''}</div>`;
  const todoHtml = alerts => {
    const list = alerts.slice().sort((a, b) => (a.level === 'r' ? 0 : 1) - (b.level === 'r' ? 0 : 1)), n = list.length;
    return `<section class="todo hero"><div class="th">${icon('glocke')}<h3>Zu erledigen</h3>${n > TODO_N ? `<span class="lab num">${T('{0} von {1}', [TODO_N, n])}</span>` : ''}</div>
      ${n ? list.map(hintHtml).join('') : '<p class="none">Gerade ist nichts zu tun.</p>'}
      ${n > TODO_N ? `<button type="button" class="hint more" data-showall><i class="bar" aria-hidden="true"></i><span class="ht">${T('{0} weitere Hinweise', [n - TODO_N])}</span><b>Alle zeigen</b></button>` : ''}</section>`;
  };
  /** Ein Modul im Raster der Übersicht – Symbol, Name, Zustand, die wichtigste Zahl */
  const STATE = { r: 'Störung', a: 'Hinweis', g: 'Läuft' };
  /** „Wort: Zahl“ bricht nie so um, dass die Zahl allein steht: Zahlen hängen immer am Wort davor */
  const kpiNote = k => `${k.l}:\u00a0${String(k.v).replace(/ (?=\d)/g, '\u00a0')}`;
  function modCell({ ic, name, state, note, val, go: g }) {
    const inner = `<span class="mi">${icon(ic)}</span><span class="mt"><b title="${esc(name)}">${esc(name)}</b><small><i class="stdot ${state}" aria-hidden="true"></i>${esc(note || STATE[state])}</small></span><span class="v num">${esc(val == null ? '' : val)}</span>`;
    return g ? `<a class="mo" href="#${g}" data-go="${g}">${inner}</a>` : `<div class="mo">${inner}</div>`;
  }
  RENDER.uebersicht = async () => {
    const drinksOn = (cache.modules || []).includes('getraenke') && DRINKS().length;
    const [stock, bal, ev, del, mem, mods] = await Promise.all([
      drinksOn ? api('stock') : null, drinksOn && (can('abrechnung') || can('export')) ? api('balances') : null, drinksOn && can('veranstaltungen') ? api('events') : null,
      drinksOn && can('lieferungen') ? api('deliveries') : null, can('konten') ? api('members') : null, moduleOverview()]);
    const [bkSt, setupCard] = can('einstellungen') ? await Promise.all([api('backups/status').catch(() => null), window.GK.setupCard().catch(() => '')]) : [null, ''];
    if (page !== 'uebersicht') return;   // inzwischen woandershin gewechselt – nichts überschreiben
    const alerts = [];
    const vs = can('einstellungen') || can('mitglieder') ? await api('vault').catch(() => null) : null;
    if (page !== 'uebersicht') return;
    if (vs && vs.on && vs.locked) alerts.push({ level: 'r', who: 'Persönliche Daten', text: `Seit dem Neustart verschlossen – dein Konto hat noch keinen Schlüssel. Mit dem Wiederherstellungscode öffnen.${vs.waitingMails ? ` ${vs.waitingMails} ${vs.waitingMails === 1 ? 'E-Mail' : 'E-Mails'} warten.` : ''}`, go: 'sicherung', link: 'Öffnen' });
    else if (vs && !vs.on && vs.may && (cache.modules || []).some(m => m === 'mitglieder' || m === 'buchhaltung')) alerts.push({ level: 'a', who: 'Datenschutz', text: 'Mitgliederdaten liegen unverschlüsselt.', detail: 'Die persönlichen Daten der Mitglieder liegen unverschlüsselt auf dem Home Assistant. Empfohlen: Verschlüsselung einschalten.', go: 'sicherung', link: 'Einschalten' });
    if (bkSt && bkSt.warn) alerts.push({ level: bkSt.hasKey ? 'r' : 'a', who: 'Datensicherung', text: bkSt.warn, go: 'sicherung', link: 'Öffnen' });
    let drinksCard = '';
    if (drinksOn) {
      const low = stock.filter(x => x.active && x.track_stock && x.min_stock > 0 && x.stock <= x.min_stock);
      const neg = stock.filter(x => x.track_stock && x.stock < 0);
      const active = ev && ev.find(e => e.active);
      if (low.length) alerts.push({ level: 'a', who: 'Lager', text: `${low.length} Artikel fast leer: ${low.slice(0, 3).map(l => l.name).join(', ')}${low.length > 3 ? ' …' : ''}`, go: can('bestellung') ? 'bestellung' : null, link: 'Bestellen' });
      if (neg.length && can('lieferungen')) alerts.push({ level: 'r', who: 'Lager', text: `${neg.length} Artikel unter null – fehlt eine Lieferung?`, detail: neg.map(n => n.name).join(', '), go: 'lieferungen', link: 'Beleg hochladen' });
      if (active) alerts.push({ level: 'a', who: 'Veranstaltung läuft', text: `${active.name} – bar ${euro(active.expected_cents)}, angeschrieben ${euro(active.open_cents)}`, go: 'veranstaltungen', link: 'Verwalten' });
      (ev || []).filter(e => e.open_member_cents > 0 && !e.active).forEach(e => alerts.push({ level: 'a', who: e.name, text: `${euro(e.open_member_cents)} angeschrieben, noch nicht auf die Getränkeliste übertragen.`, go: 'veranstaltungen', link: 'Übertragen' }));
      const first = DRINKS()[0][0];
      drinksCard = modCell({ ic: 'verkauf', name: 'Verkauf', state: neg.length ? 'r' : low.length ? 'a' : 'g', note: neg.length ? `${neg.length} negativ` : low.length ? `${low.length} knapp` : 'Alles gut',   // nie „Alles gut“ neben der Warnung „negativer Bestand“
        val: bal ? euro(bal.total_cents) : String(stock.filter(x => x.active && x.track_stock).length), go: low.length && can('bestellung') ? 'bestellung' : first });
    }
    if (clubNetsMissing) alerts.push({ level: 'a', who: 'Sicherheit', text: 'Kein Vereinsnetz eingetragen.', detail: 'Jedes private Netz (auch Gast-WLAN oder VPN) kommt an Verwaltung und Tablet. Empfohlen: unter Mitglieder-App → Verbindung → „Vereinsnetz“ euer Netz eintragen.', go: 'app', sec: ['cw_appsec', 'verbindung'], link: 'Eintragen' });
    if (tabletPwMissing && can('einstellungen')) sset('cw_setsec', 'tablet');   // „Festlegen“ öffnet gleich den richtigen Bereich
    if (tabletPwMissing) alerts.push({ level: 'r', who: 'Sicherheit', text: can('einstellungen') ? 'Für das Tablet ist noch kein Passwort vergeben – das Tablet bleibt gesperrt, bis eins festgelegt ist.' : 'Für das Tablet ist noch kein Passwort vergeben – bitte einen Admin mit Recht „Einstellungen“ bitten, eins festzulegen.', ...(can('einstellungen') ? { go: 'einstellungen', link: 'Festlegen' } : {}) });
    const pending = mem ? mem.rows.filter(m => m.pending) : [];
    if (pending.length) alerts.push({ level: 'a', who: 'Mitglieder', text: `${pending.length} neue Einträge vom Tablet zu bestätigen.`, go: 'konten', link: 'Prüfen' });
    // Ohne HTTPS gehen PIN und Geräteschlüssel der Mitglieder-App unverschlüsselt durchs WLAN – bei Türen ein echtes Risiko
    if (SCHEME !== 'https' && (cache.modules || []).some(m => m === 'zugang' || m === 'beregnung') && can('einstellungen'))
      alerts.push({ level: 'r', who: 'Sicherheit', text: 'HTTPS ist aus – App, Türen und Beregnung laufen im WLAN unverschlüsselt.', detail: 'Bitte HTTPS einschalten (Add-on-Option „HTTPS für alle Geräte“, Anleitung in der Installationsanleitung, Abschnitt 9c).' });
    mods.forEach(m => m.alerts.forEach(a => alerts.push({ level: a.level, who: m.name, text: a.text, detail: a.detail, go: m.pageKey, link: a.link, sec: Array.isArray(a.sec) && a.sec.length === 2 ? a.sec.map(String) : undefined })));   // sec: Unterbereich, in dem der Hinweis erledigt wird
    const modCards = mods.map(m => {
      const bad = m.alerts.some(a => a.level === 'r'), warn = m.alerts.length;
      const gk = (PAGES.find(x => x[0] === m.pageKey) || [])[3];
      return modCell({ ic: PAGE_ICON[m.pageKey] || (MODG[gk] && MODG[gk].icon !== 'modul' ? MODG[gk].icon : null) || PAGE_ICON[m.id] || 'modul', name: m.name, state: bad ? 'r' : warn ? 'a' : 'g',
        note: bad || warn || !m.kpis[1] ? null : kpiNote(m.kpis[1]), val: m.kpis[0] ? m.kpis[0].v : '', go: m.pageKey });   // Zustand in Worten, wenn etwas ist – sonst die zweite Zahl
    });
    const memberCard = mem && !mods.some(m => m.id === 'mitglieder') ? modCell({ ic: 'konten', name: 'Mitglieder', state: pending.length ? 'a' : 'g', note: pending.length ? `${pending.length} neu` : 'Aktive Mitglieder',
      val: String(mem.rows.filter(m => m.kind === 'mitglied' && m.active).length), go: 'konten' }) : '';
    const low = drinksOn ? stock.filter(x => x.active && x.track_stock && x.min_stock > 0 && x.stock <= x.min_stock) : [];
    const cells = [drinksCard, ...modCards, memberCard].filter(Boolean);
    const bot = [];
    if (low.length) bot.push(`<div class="card"><h3>Bestand knapp</h3><table class="tbl"><tr><th>Artikel</th><th class="r">Bestand</th><th class="r">Mindest</th></tr>
          ${low.map(l => `<tr><td>${esc(l.name)}</td><td class="r">${num(l.stock)}</td><td class="r">${num(l.min_stock)}</td></tr>`).join('')}</table></div>`);
    if (del && del.length) bot.push(`<div class="card"><h3>Letzte Lieferungen</h3><table class="tbl"><tr><th>Datum</th><th>Lieferant</th><th class="r">Einzelartikel</th></tr>
          ${del.slice(0, 6).map(x => `<tr><td>${deDate(x.date)}</td><td>${esc(x.supplier)}</td><td class="r">${num(x.total)}</td></tr>`).join('')}</table></div>`);
    if (cells.length % 2) cells.push('<div class="mo fill" aria-hidden="true"></div>');   // gleich großes Raster ohne Loch
    const d = new Date();
    $('main').innerHTML = `<div class="greet"><div><div class="date">${d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h2 class="page"><span>${greeting()}</span>, <span>${esc((me.name || me.username).split(" ")[0])}</span></h2></div>
        <div class="row">${window.top === window && tabletOnUI ? `<a class="btn" href="./" target="_blank">${icon('tablet', 16)}Tablet-Seite</a>` : ''}</div></div>
      <div class="court greetline"></div>
      ${setupCard}
      <div class="ovtwo">${todoHtml(alerts)}${cells.length ? `<div class="mods2">${cells.join('')}</div>` : ''}</div>
      ${bot.length ? `<div class="${bot.length === 2 ? 'two ' : ''}ovbot">${bot.join('')}</div>` : ''}`;   // „Bestand knapp“ und „Letzte Lieferungen“ nur, wenn es etwas zu zeigen gibt
    $('main').querySelectorAll('[data-go]').forEach(a => { a.onclick = e => { e.preventDefault(); if (a.dataset.secstore) sset(a.dataset.secstore, a.dataset.sec); go(a.dataset.go); }; });   // Hinweis führt direkt in den passenden Unterbereich
    const sa = $('main').querySelector('[data-showall]'); if (sa) sa.onclick = () => { sa.closest('.todo').classList.add('all'); sa.remove(); };
    if (setupCard) window.GK.bindSetupCard($('main'));
  };

  /* =================== Lieferungen =================== */
  RENDER.lieferungen = async () => {
    await loadArticles();
    const list = await api('deliveries');
    cache.suppliers = [...new Set(list.map(d => d.supplier).filter(Boolean)), 'Lidl'].slice(0, 20);   // Vorschläge aus bisherigen Lieferungen
    $('main').innerHTML = `<h2 class="page">Lieferungen & Belege</h2>
      <p class="lead">Rechnung als PDF hierher ziehen oder fotografieren – Positionen werden automatisch erkannt und dem Bestand gutgeschrieben.</p>
      <div class="drop card" id="drop">
        <div class="big">Rechnungen hier ablegen</div>
        <div class="muted">PDF vom Lieferanten, Lidl-Kassenbon (Screenshot aus Lidl Plus oder Foto) oder sonstiger Beleg · mehrere Dateien auf einmal möglich</div>
        <div class="row">
          <label class="btn primary">Dateien wählen<input type="file" id="fileIn" accept="application/pdf,image/*" multiple hidden></label>
          <label class="btn">Foto aufnehmen<input type="file" id="camIn" accept="image/*" capture="environment" hidden></label>
          <button class="btn ghost" id="manual">Ohne Beleg erfassen</button>
        </div>
      </div>
      <div class="card"><h3>Erfasste Lieferungen</h3>
        ${list.length ? `<table class="tbl"><tr><th>Lieferdatum</th><th>Lieferant</th><th>Beleg</th><th class="r">Betrag</th><th class="r">Einzelartikel</th><th></th></tr>
        ${list.map(d => `<tr><td>${deDate(d.date)}</td><td>${esc(d.supplier)}</td>
          <td>${esc(DOCKIND[d.doc_kind] || '')} ${esc(d.doc_no || '')} ${d.file ? `<a href="api/admin/beleg/${encodeURIComponent(d.file)}" target="_blank">ansehen</a>` : ''}</td>
          <td class="r">${d.total_cents == null ? '' : euro(d.total_cents)}</td><td class="r">${num(d.total)}</td>
          <td class="r"><button class="btn small" data-show="${d.id}">Positionen</button> <button class="btn small danger" data-del="${d.id}">Löschen</button></td></tr>`).join('')}</table>`
          : '<p class="empty">Noch keine Lieferungen.</p>'}</div>`;

    const drop = $('drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => handleFiles([...e.dataTransfer.files]));
    $('fileIn').onchange = e => handleFiles([...e.target.files]);
    $('camIn').onchange = e => handleFiles([...e.target.files]);
    $('manual').onclick = () => reviewDelivery({ fileId: null, supplier: '', lines: [], docKind: 'lieferung' }, []);

    $('main').querySelectorAll('[data-show]').forEach(b => b.onclick = () => {
      const d = list.find(x => x.id === Number(b.dataset.show));
      dialog(`<h2>${esc(d.supplier)} · ${deDate(d.date)}</h2>
        <table class="tbl"><tr><th>Artikel</th><th>Lieferanten-Text</th><th class="r">Gebinde</th><th class="r">Einzelartikel lose</th><th class="r">Einzelartikel gesamt</th></tr>
        ${d.items.map(i => `<tr><td>${esc(i.name)}</td><td class="muted">${esc(i.supplier_text || '')}</td><td class="r">${num(i.crates)}</td><td class="r">${num(i.bottles)}</td><td class="r">${num(i.total)}</td></tr>`).join('')}
        <tr class="sum"><td colspan="4">Summe</td><td class="r">${num(d.total)}</td></tr></table>
        <div class="btns"><button class="btn primary" id="x">Schließen</button></div>`);
      $('x').onclick = closeDialog;
    });
    $('main').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!await ask('Diese Lieferung samt Beleg löschen? Der Bestand wird entsprechend reduziert.')) return;
      await api('deliveries/' + b.dataset.del, 'DELETE').catch(fail);
      toast('Lieferung gelöscht.'); RENDER.lieferungen();
    });
  };

  async function handleFiles(files) {
    const queue = files.filter(Boolean);
    for (let i = 0; i < queue.length; i++) {
      const f = queue[i];
      toast(`Lese ${f.name} …`);
      let parsed;
      try {
        const r = await fetch('api/admin/upload', {
          method: 'POST', body: f,
          headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(f.name), 'X-Clubwerk': '1' },
        });
        parsed = await r.json();
        if (r.status === 401) { showLogin(); return; }
        if (!r.ok) throw new Error(parsed.error || 'Upload fehlgeschlagen');
      } catch (e) { fail(e); continue; }
      const done = await reviewDelivery(parsed, queue.slice(i + 1).map(x => x.name));
      if (done === 'abort') break;
    }
    RENDER.lieferungen();
  }

  /** Prüfdialog für einen hochgeladenen Beleg (oder leere Erfassung). Gibt 'saved' | 'skip' | 'abort' zurück. */
  function reviewDelivery(p, rest) {
    return new Promise(resolve => {
      const lines = p.lines.map(l => ({ ...l, choice: l.ignore ? 'ignore' : (l.articleId || '') }));
      if (!lines.length) lines.push({ manual: true, choice: '', crates: '', bottles: '' });
      const isPdf = p.fileId && /\.pdf$/i.test(p.fileId);
      const src = p.fileId ? 'api/admin/beleg/' + encodeURIComponent(p.fileId) : '';
      const date = p.deliveryDate || p.date || today();
      const auto = p.lines.length > 0;
      const chk = p.check ? (p.check.ok
        ? ` Summe ${euro(p.check.sum_cents)} stimmt mit dem Bon überein ✓`
        : p.allChecked
          ? `</div><div class="banner a">Alle Getränke-Positionen sind nachgerechnet ✓. Die Summe weicht um ${euro(Math.abs(p.total_cents - p.check.sum_cents))} vom Beleg ab – das liegt an unlesbaren Pfand-/Leergut-Zeilen und ist für den Bestand egal.`
          : `</div><div class="banner a">Summe der Positionen (${euro(p.check.sum_cents)}) weicht vom Beleg (${euro(p.total_cents)}) ab – bitte die markierten Mengen mit dem Bild vergleichen.`) : '';
      const info = !p.fileId ? '' : auto
        ? `<div class="banner g">${p.lines.filter(l => !l.deposit).length} Positionen ${p.ocr ? 'per Bilderkennung ' : ''}erkannt${p.lines.some(l => l.deposit) ? ` (dazu ${p.lines.filter(l => l.deposit).length} Pfand-/Leergut-Zeilen, automatisch ignoriert)` : ''}.${chk} Bitte kurz prüfen – Zuordnungen werden für das nächste Mal gemerkt.</div>`
        : `<div class="banner a">Auf diesem Beleg ist kein lesbarer Text (Foto/Scan). Bitte die Gebinde unten von Hand eintragen – der Beleg wird mitgespeichert.</div>`;
      const dup = p.duplicateOf ? `<div class="banner r">Achtung: Beleg ${esc(p.docNo)} ist bereits gespeichert (Lieferung vom ${deDate(p.duplicateOf.date)}). Bitte nicht doppelt erfassen.</div>` : '';

      dialog(`<h2>${p.fileId ? 'Beleg prüfen' : 'Lieferung erfassen'}${p.originalName ? ' · ' + esc(p.originalName) : ''}</h2>
        ${dup}${info}
        <div class="${p.fileId ? 'split' : ''}">
          ${p.fileId ? `<div class="preview">${isPdf ? `<iframe src="${src}#view=FitH"></iframe>` : `<img src="${src}" alt="Beleg">`}</div>` : ''}
          <div>
            <div class="row" style="margin-bottom:12px">
              <label class="f" style="flex:2;min-width:180px">Lieferant<input id="dSup" list="supList" value="${esc(p.supplier || '')}" placeholder="z. B. Getränkehandel Muster"></label>
              <label class="f">Lieferdatum<input type="date" id="dDate" value="${date}"></label>
            </div>
            <div class="row" style="margin-bottom:12px">
              <label class="f">Belegart<select id="dKind">${Object.entries(DOCKIND).map(([k, l]) => `<option value="${k}" ${k === (p.docKind || 'lieferung') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              <label class="f">Beleg-Nr.<input id="dNo" value="${esc(p.docNo || '')}" style="width:140px"></label>
              <label class="f">Betrag €<input id="dSum" value="${p.total_cents == null ? '' : centsToInput(p.total_cents)}" style="width:110px"></label>
            </div>
            <datalist id="supList">${(cache.suppliers || []).map(x => `<option>${esc(x)}</option>`).join('')}</datalist>
            <div class="scroll" style="max-height:52vh"><table class="tbl" id="lines"></table></div>
            <div class="row" style="margin-top:10px;justify-content:space-between">
              <button class="btn small" id="addLine">+ Zeile</button>
              <div class="muted" id="sumInfo"></div>
            </div>
          </div>
        </div>
        <div class="btns">
          ${rest.length ? `<span class="muted" style="margin-right:auto;align-self:center">Danach noch ${rest.length} ${rest.length === 1 ? 'Datei' : 'Dateien'}</span>` : ''}
          <button class="btn ghost" id="cancel">${p.fileId ? 'Verwerfen' : 'Abbrechen'}</button>
          ${rest.length ? '<button class="btn" id="abort">Alle abbrechen</button>' : ''}
          <button class="btn primary" id="save">Lieferung speichern</button>
        </div>`, true);
      $('dialog').dataset.sticky = '1';

      const art = id => cache.articles.find(a => a.id === Number(id));
      function bottlesOf(l) {
        if (l.manual) { const a = art(l.choice); return (Number(l.crates) || 0) * (a ? a.crate_size : 0) + (Number(l.bottles) || 0); }
        return l.single ? Number(l.qty) || 0 : (Number(l.qty) || 0) * (Number(l.packSize) || 1);
      }
      function draw() {
        $('lines').innerHTML = `<tr><th>Auf dem Beleg</th><th class="r">Menge</th><th>Artikel in der App</th><th class="r">je Gebinde</th><th class="r">Einzelartikel</th><th></th></tr>` +
          lines.map((l, i) => l.manual
            ? `<tr><td class="muted">von Hand</td>
                <td class="r"><input class="n" data-i="${i}" data-k="crates" value="${esc(l.crates)}" placeholder="Gebinde" inputmode="numeric"><br>
                  <input class="n" data-i="${i}" data-k="bottles" value="${esc(l.bottles)}" placeholder="+ einzeln" inputmode="numeric" style="margin-top:4px"></td>
                <td><select data-i="${i}" data-k="choice">${articleOptions(Number(l.choice) || l.choice, { create: true })}</select></td>
                <td class="r muted">${art(l.choice) ? art(l.choice).crate_size + 'er' : ''}</td>
                <td class="r">${num(bottlesOf(l))}</td>
                <td><button class="btn small ghost" data-rm="${i}" aria-label="Zeile entfernen">✕</button></td></tr>`
            : `<tr class="${l.choice === 'ignore' ? 'off' : ''}"><td>${esc(l.text)}<div class="muted s">${l.noArtNo ? `${num(l.qty)} × ${euro(l.unit_cents)}` : 'Art.-Nr. ' + esc(l.artNo)}${l.checked === false ? ' · <span class="pill a">bitte Menge prüfen</span>' : (l.note ? ' · ' + esc(l.note) : '')}${l.source === 'gemerkt' ? ' · <span class="pill g">gemerkt</span>' : l.source === 'offen' ? ' · <span class="pill r">bitte zuordnen</span>' : ''}</div></td>
                <td class="r">${l.deposit ? '' : l.checked === false ? `<input class="n" style="width:56px" data-i="${i}" data-k="qty" value="${esc(l.qty)}" inputmode="numeric">` : num(l.qty)} ${l.deposit ? '' : l.single ? 'einzeln' : (l.unitLabel || 'Ki.')}</td>
                <td><select data-i="${i}" data-k="choice">${articleOptions(l.choice === 'ignore' ? 'ignore' : Number(l.choice), { ignore: true, create: true })}</select></td>
                <td class="r">${l.single || l.choice === 'ignore' ? '' : `<input class="n" style="width:56px" data-i="${i}" data-k="packSize" value="${esc(l.packSize)}" inputmode="numeric">`}</td>
                <td class="r">${l.choice === 'ignore' ? '–' : num(bottlesOf(l))}</td><td></td></tr>`).join('');
        const total = lines.filter(l => l.choice && l.choice !== 'ignore').reduce((s, l) => s + bottlesOf(l), 0);
        const open = lines.filter(l => !l.choice && (l.manual ? (l.crates || l.bottles) : true)).length;
        $('sumInfo').innerHTML = `${num(total)} Einzelartikel ins Lager` + (open ? ` · <span class="neg">${open} ${open === 1 ? 'Position' : 'Positionen'} ohne Zuordnung</span>` : '');
      }
      draw();

      $('lines').addEventListener('change', async e => {
        const el = e.target.closest('[data-i]'); if (!el) return;
        const l = lines[Number(el.dataset.i)], k = el.dataset.k;
        if (k === 'choice' && el.value === 'new') {
          const created = await articleDialog(null, { name: l.text ? prettify(l.text) : '', crate_size: l.packSize || 1 }, true);
          $('dialog').dataset.sticky = '1';
          l.choice = created ? created : '';
          draw(); return;
        }
        l[k] = k === 'choice' ? (el.value === 'ignore' ? 'ignore' : (Number(el.value) || '')) : el.value;
        draw();
      });
      $('lines').addEventListener('input', e => {
        const el = e.target.closest('input[data-i]'); if (!el) return;
        lines[Number(el.dataset.i)][el.dataset.k] = el.value;
        clearTimeout(draw.t); draw.t = setTimeout(() => { const f = document.activeElement; const sel = f && f.dataset ? [f.dataset.i, f.dataset.k] : null; draw(); if (sel) { const n = $('lines').querySelector(`[data-i="${sel[0]}"][data-k="${sel[1]}"]`); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } } }, 400);
      });
      $('lines').addEventListener('click', e => {
        const b = e.target.closest('[data-rm]'); if (!b) return;
        lines.splice(Number(b.dataset.rm), 1); if (!lines.length) lines.push({ manual: true, choice: '', crates: '', bottles: '' }); draw();
      });
      $('addLine').onclick = () => { lines.push({ manual: true, choice: '', crates: '', bottles: '' }); draw(); };

      const finish = async how => {
        if (how !== 'saved' && p.fileId) await api('upload/' + encodeURIComponent(p.fileId), 'DELETE').catch(() => {});
        delete $('dialog').dataset.sticky;
        closeDialog(); resolve(how);
      };
      $('cancel').onclick = () => finish('skip');
      if ($('abort')) $('abort').onclick = () => finish('abort');
      $('save').onclick = async () => {
        const items = [];
        for (const l of lines) {
          if (l.manual) {
            if (!l.choice && !l.crates && !l.bottles) continue;
            items.push({ articleId: l.choice, crates: Number(l.crates) || 0, bottles: Number(l.bottles) || 0 });
            continue;
          }
          if (l.choice === 'ignore') { items.push({ ignore: true, artNo: l.artNo, text: l.text, single: l.single }); continue; }
          const a = art(l.choice);
          const pack = Number(l.packSize) || 1;
          let crates = 0, bottles = 0;
          const q = Number(l.qty) || 0;
          if (l.single) bottles = q;
          else if (a && pack === a.crate_size) crates = q;
          else bottles = q * pack;
          items.push({ articleId: l.choice || 0, crates, bottles, artNo: l.artNo, text: l.text, packSize: pack, single: l.single, cost_cents: l.line_cents });
        }
        const sum = $('dSum').value.trim();
        try {
          await api('deliveries', 'POST', {
            date: $('dDate').value, supplier: $('dSup').value, docNo: $('dNo').value || null, docKind: $('dKind').value,
            total_cents: sum ? toCents(sum) : null, fileId: p.fileId, items,
          });
          toast('Lieferung gespeichert – Bestand aktualisiert.');
          finish('saved');
        } catch (e) { fail(e); }
      };
    });
  }
  const prettify = t => t.replace(/\b(\d{1,2})\s*\/\s*(0?,\d+)/, '$2').replace(/-€/g, '').replace(/\s+/g, ' ').trim();

  /* =================== Bestellung =================== */
  RENDER.bestellung = async () => {
    const o = await api('order');
    const st = o.settings;
    const rows = o.rows;
    $('main').innerHTML = `<h2 class="page">Bestellung</h2>
      <p class="lead">Vorschlag aus Bestand, Mindestbestand und „bestellen bis“. Gebinde anpassen und die Bestellung direkt an den Lieferanten senden – oder den Text kopieren.</p>
      <div class="card"><h3>Bestelldaten</h3><div class="frm">
        <label class="f w3">Lieferant<input id="oSup" value="${esc(st.order_supplier)}"></label>
        <label class="f w1">Kunden-Nr.<input id="oCust" value="${esc(st.customer_no)}"></label>
        <label class="f">Lieferadresse<input id="oAddr" value="${esc(st.delivery_address)}"></label>
        <label class="f w1">Absender (Name)<input id="oSender" value="${esc(st.order_sender || me.name || '')}"></label>
        <label class="f w1">Telefon für Rückfragen<input id="oPhone" value="${esc(st.order_phone)}"></label></div>
        <div class="btns"><button class="btn" id="oSave">Merken</button></div></div>
      <div class="card"><h3>Was bestellen?</h3>
        <div class="scroll"><table class="tbl kompakt"><tr><th>Artikel</th><th>Art.-Nr.</th><th class="r">Bestand</th><th class="r">Mindest</th><th class="r">bestellen bis</th><th class="r">Gebinde</th></tr>
        ${rows.map(r => `<tr class="${r.low ? '' : 'off'}"><td>${esc(r.name)} ${r.low ? '<span class="pill a">knapp</span>' : ''}<div class="muted s">${esc(r.supplier_text || '')}</div></td>
          <td>${esc(r.art_no)}</td><td class="r k-lbl ${r.stock < 0 ? 'neg' : ''}">${num(r.stock)}</td><td class="r k-weg">${num(r.min_stock)}</td><td class="r k-weg">${num(r.target_stock)}</td>
          <td class="r"><input class="n" data-o="${r.id}" value="${r.suggest || ''}" inputmode="numeric" placeholder="0"></td></tr>`).join('')}</table></div>
        <p class="muted s">Mindestbestand und „bestellen bis“ stellt man unter „Artikel“ ein. Die Artikelnummern kommen automatisch aus den hochgeladenen Rechnungen.</p></div>
      <div class="card"><h3>E-Mail</h3>
        ${o.mailReady ? '' : `<div class="banner a" style="margin:0 0 12px"><span>Zum direkten Senden fehlt noch das Vereinspostfach (${o.mayMailSetup ? '<a href="#einstellungen" data-gomail style="margin:0">Einstellungen → Postfach</a>' : 'ein Admin mit Recht „Einstellungen“ richtet es unter Einstellungen → Postfach ein'}). Bis dahin: Text kopieren oder im E-Mail-Programm öffnen.</span></div>`}
        <div class="row"><label class="f" style="flex:1;min-width:240px">An (Lieferant)<input id="oMail" type="email" value="${esc(st.order_email)}" placeholder="bestellung@lieferant.de" autocomplete="off"></label>
          <label class="f" style="flex:1;min-width:240px">Kopie an (optional, z. B. Vorstand)<input id="oCc" type="email" value="${esc(st.order_cc)}" placeholder="vorstand@verein.de" autocomplete="off"></label></div>
        <label class="f" style="margin-top:8px">Betreff<input id="oSubj"></label>
        <label class="f" style="margin-top:8px">Text<textarea id="oText" rows="16" style="font-family:inherit"></textarea></label>
        <div class="row" style="margin-top:10px;align-items:center"><button class="btn primary" id="oSend" ${o.mailReady ? '' : 'disabled'}>Bestellung jetzt senden</button><button class="btn" id="oCopy">Text kopieren</button><a class="btn" id="oMailBtn" href="#">In E-Mail-Programm öffnen</a>
          <span class="muted s" id="oInfo"></span></div>
        ${o.lastSent ? `<p class="muted s" style="margin:8px 0 0">Zuletzt gesendet: ${esc(deTime(o.lastSent.split(' · ')[0]))} Uhr an ${esc(o.lastSent.split(' · ')[1] || '')}</p>` : ''}</div>`;

    const build = () => {
      const lines = rows.map(r => ({ r, n: Number(($('main').querySelector(`[data-o="${r.id}"]`) || {}).value) || 0 })).filter(x => x.n > 0);
      const date = new Date().toLocaleDateString('de-DE');
      $('oSubj').value = `Bestellung ${o.clubName}${$('oCust').value ? ' (Kd.-Nr. ' + $('oCust').value + ')' : ''} vom ${date}`;
      $('oText').value = `Guten Tag,\n\nhiermit bestellen wir für den ${o.clubName}${$('oCust').value ? ' (Kunden-Nr. ' + $('oCust').value + ')' : ''}:\n\n` +
        (lines.length ? lines.map(({ r, n }) => `- ${n} Gebinde ${r.supplier_text || r.name}${r.art_no ? ' (Art.-Nr. ' + r.art_no + ')' : ''}`).join('\n') : '- (bitte Mengen eintragen)') +
        `\n\nLieferadresse: ${$('oAddr').value}\nLeergut geben wir bei der Lieferung mit.\n` +
        `${$('oPhone').value ? 'Rückfragen gern unter ' + $('oPhone').value + '.\n' : ''}\nVielen Dank und viele Grüße\n${$('oSender').value}\n${o.clubName}`;
      $('oMailBtn').href = `mailto:${encodeURIComponent($('oMail').value)}?${$('oCc').value ? 'cc=' + encodeURIComponent($('oCc').value) + '&' : ''}subject=${encodeURIComponent($('oSubj').value)}&body=${encodeURIComponent($('oText').value)}`;
      $('oInfo').textContent = `${lines.length} Positionen, ${lines.reduce((s, x) => s + x.n, 0)} Gebinde`;
    };
    build();
    $('main').oninput = e => { if (e.target.closest('[data-o], #oCust, #oAddr, #oSender, #oPhone, #oMail, #oCc')) build(); };
    $('oSave').onclick = async () => {
      try {
        await api('settings/order', 'PUT', { order_supplier: $('oSup').value, order_email: $('oMail').value, order_cc: $('oCc').value, customer_no: $('oCust').value,
          delivery_address: $('oAddr').value, order_sender: $('oSender').value, order_phone: $('oPhone').value });
        toast('Bestelldaten gemerkt.');
      } catch (e) { fail(e); }
    };
    const gm = $('main').querySelector('[data-gomail]'); if (gm) gm.onclick = e => { e.preventDefault(); go('einstellungen'); };
    $('oSend').onclick = async () => {
      const to = $('oMail').value.trim(), cc = $('oCc').value.trim();
      const lines = rows.filter(r => (Number(($('main').querySelector(`[data-o="${r.id}"]`) || {}).value) || 0) > 0);
      if (!to) return fail(new Error('Bitte bei „An“ die E-Mail-Adresse des Lieferanten eintragen.'));
      if (!lines.length && !await ask('Keine Mengen eingetragen\n\nTrotzdem senden?', { danger: false, ok: 'Trotzdem senden' })) return;
      if (!await ask(`Bestellung jetzt senden?\n\nAn: ${to}${cc ? '\nKopie an: ' + cc : ''}\nBetreff: ${$('oSubj').value}\n${$('oInfo').textContent}\n\nDie E-Mail geht sofort raus und kann nicht zurückgeholt werden.`, { danger: false, ok: 'Jetzt senden' })) return;
      $('oSend').disabled = true; $('oSend').textContent = 'Wird gesendet …';
      try {
        await api('order/send', 'POST', { to, cc, subject: $('oSubj').value, text: $('oText').value });
        await ask(`Bestellung gesendet\n\nDie Bestellung ist an ${to}${cc ? ' (Kopie an ' + cc + ')' : ''} raus. Im Protokoll vermerkt.`, { okOnly: true, danger: false });
        RENDER.bestellung();
      } catch (e) { fail(e); $('oSend').disabled = false; $('oSend').textContent = 'Bestellung jetzt senden'; }
    };
    $('oCopy').onclick = () => copyText(`Betreff: ${$('oSubj').value}\n\n${$('oText').value}`, 'Bestelltext kopiert – jetzt in die E-Mail einfügen.');
  };

  /* =================== Bestand =================== */
  RENDER.bestand = async () => {
    const [stock, moves] = await Promise.all([loadArticles(), api('stock/moves')]);
    const tracked = stock.filter(s => s.track_stock && s.active);
    $('main').innerHTML = `<h2 class="page">Bestand & Inventur</h2>
      <p class="lead">Soll-Bestand = Lieferungen − Buchungen ± Bruch/Korrekturen. Bei der Inventur einfach zählen und eintragen – die Differenz wird als Schwund erfasst.</p>
      <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Aktueller Bestand</h3>
        <div class="row"><label class="f">Inventur-Datum<input type="date" id="invDate" value="${today()}"></label><button class="btn primary" id="saveInv">Inventur speichern</button></div></div>
        <div class="scroll"><table class="tbl kompakt"><tr><th>Artikel</th><th class="hide-md">Kategorie</th><th class="r">Soll (Stück)</th><th class="r hide-md">Soll in Gebinden</th><th class="r hide-md">Mindestbestand</th><th class="r">Gezählt: Gebinde</th><th class="r">Gezählt: Stück</th></tr>
        ${tracked.map(s => `<tr><td>${esc(s.name)} ${s.stock <= s.min_stock && s.delivered > 0 ? '<span class="pill a">nachbestellen</span>' : ''}</td><td class="muted hide-md">${esc(s.category)}</td>
          <td class="r ${s.stock < 0 ? 'neg' : ''}">${num(s.stock)}</td>
          <td class="r muted hide-md">${s.crate_size > 1 ? `${Math.floor(Math.max(0, s.stock) / s.crate_size)} + ${Math.max(0, s.stock) % s.crate_size}` : '–'}</td>
          <td class="r hide-md">${num(s.min_stock)}</td>
          <td class="r">${s.crate_size > 1 ? `<input class="n" data-c="${s.id}" inputmode="numeric">` : '<span class="muted">–</span>'}</td>
          <td class="r"><input class="n" data-b="${s.id}" inputmode="numeric"></td></tr>`).join('')}</table></div>
        <p class="muted s">Nur ausgefüllte Zeilen werden übernommen. Leere Zeilen bleiben unverändert.</p></div>
      <div class="card"><h3>Bruch oder Korrektur buchen</h3>
        <div class="frm"><label class="f">Artikel<select id="mvArt">${articleOptions(null)}</select></label>
          <label class="f w1">Grund<select id="mvReason"><option value="bruch">Bruch / verdorben</option><option value="korrektur">Korrektur (+/−)</option></select></label>
          <label class="f w1">Einzelartikel<input id="mvQty" class="n" inputmode="numeric"></label>
          <label class="f">Datum<input type="date" id="mvDate" value="${today()}"></label>
          <label class="f">Notiz<input id="mvNote"></label></div>
          <div class="btns"><button class="btn" id="mvSave">Buchen</button></div></div>
      <div class="card"><h3>Letzte Bestandsänderungen</h3>${moves.length ? `<table class="tbl"><tr><th>Datum</th><th>Artikel</th><th>Grund</th><th class="r">Einzelartikel</th><th>Notiz</th></tr>
        ${moves.map(m => `<tr><td>${deDate(m.date)}</td><td>${esc(m.name)}</td><td>${esc(m.reason)}</td><td class="r ${m.qty < 0 ? 'neg' : ''}">${num(m.qty)}</td><td class="muted">${esc(m.note || '')}</td></tr>`).join('')}</table>` : '<p class="empty">Noch keine Bestandsänderungen.</p>'}</div>
      <div class="card" id="abglCard"></div>`;
    abgleichCard($('abglCard')).catch(e => { if ($('abglCard')) $('abglCard').innerHTML = `<div class="banner r">${esc(e.message)}</div>`; });

    $('saveInv').onclick = async () => {
      const counts = [];
      for (const s of tracked) {
        const c = $('main').querySelector(`[data-c="${s.id}"]`), b = $('main').querySelector(`[data-b="${s.id}"]`);
        const cv = c ? c.value.trim() : '', bv = b.value.trim();
        if (cv === '' && bv === '') continue;
        counts.push({ articleId: s.id, counted: (Number(cv) || 0) * s.crate_size + (Number(bv) || 0) });
      }
      if (!counts.length) { toast('Bitte mindestens eine gezählte Menge eintragen.', true); return; }
      try {
        let r;
        try { r = await api('stock/inventory', 'POST', { date: $('invDate').value, counts }); }
        catch (e) {
          if (e.status !== 409 || !e.odd) throw e;
          if (!await ask('Ungewöhnlich große Abweichung – bitte prüfen:\n\n' + e.odd.join('\n') + '\n\nTrotzdem so speichern?')) return;
          r = await api('stock/inventory', 'POST', { date: $('invDate').value, counts, force: true });
        }
        toast(r.changes.length ? `Inventur gespeichert – ${r.changes.length} ${r.changes.length === 1 ? 'Abweichung' : 'Abweichungen'} erfasst.` : 'Inventur gespeichert – alles stimmt.');
        RENDER.bestand();
      } catch (e) { fail(e); }
    };
    $('mvSave').onclick = async () => {
      try {
        await api('stock/move', 'POST', { articleId: $('mvArt').value, reason: $('mvReason').value, qty: $('mvQty').value, date: $('mvDate').value, note: $('mvNote').value });
        toast('Gebucht.'); RENDER.bestand();
      } catch (e) { fail(e); }
    };
  };

  /* =================== Abgleich (Karte unter „Bestand“) =================== */
  async function abgleichCard(el, from, to) {
    const r = await api(`shrinkage?from=${from || new Date().getFullYear() + '-01-01'}&to=${to || today()}`);
    const sum = k => r.rows.reduce((s, x) => s + (x[k] || 0), 0);
    el.innerHTML = `<h3>Abgleich Lieferungen ↔ Buchungen</h3>
      <p class="muted s" style="margin-top:0">Was ist geliefert, was gebucht worden? „Offen“ ist noch im Lager oder wurde nicht gebucht – Klarheit bringt die Inventur.</p>
      ${rangeBar(r.from, r.to)}
      ${r.rows.length ? `<div class="scroll"><table class="tbl kompakt"><tr><th>Artikel</th><th class="hide-md">Kategorie</th><th class="r">Geliefert</th><th class="r">Konten</th><th class="r">Verein frei</th><th class="r">Gast bar</th><th class="r">Veranstaltung</th><th class="r">Bruch/Korr.</th><th class="r">Offen</th><th class="r">Inventur-Diff.</th><th class="r">Schwund €</th></tr>
      ${r.rows.map(x => `<tr><td>${esc(x.name)}</td><td class="muted hide-md">${esc(x.category)}</td><td class="r k-lbl">${num(x.delivered)}</td><td class="r k-weg">${num(x.konto)}</td><td class="r k-weg">${num(x.verein)}</td><td class="r k-weg">${num(x.gast)}</td><td class="r k-weg">${num(x.event)}</td><td class="r k-weg">${num(x.bruch + x.korrektur)}</td><td class="r k-lbl">${num(x.open)}</td><td class="r k-weg ${x.inventur < 0 ? 'neg' : ''}">${num(x.inventur)}</td><td class="r k-lbl ${x.shrink_cents ? 'neg' : ''}">${x.shrink_cents ? euro(x.shrink_cents) : ''}</td></tr>`).join('')}
      <tr class="sum"><td colspan="2">Summe</td><td class="r">${num(sum('delivered'))}</td><td class="r">${num(sum('konto'))}</td><td class="r">${num(sum('verein'))}</td><td class="r">${num(sum('gast'))}</td><td class="r">${num(sum('event'))}</td><td class="r">${num(sum('bruch') + sum('korrektur'))}</td><td class="r">${num(sum('open'))}</td><td class="r">${num(sum('inventur'))}</td><td class="r">${euro(sum('shrink_cents'))}</td></tr></table></div>`
        : '<p class="empty">Noch keine Lieferungen oder Buchungen im Zeitraum.</p>'}`;
    bindRange('rng', (f, t) => abgleichCard(el, f, t).catch(fail));
  }

  /* =================== Buchungen =================== */
  function openLog(memberId) {
    page = 'buchungen';
    history.replaceState(null, '', '#buchungen');
    setChrome('buchungen');
    $('main').onclick = null; $('main').oninput = null;
    RENDER.buchungen('2000-01-01', null, memberId).catch(fail);
  }
  RENDER.buchungen = async (from, to, memberId) => {
    await Promise.all([loadArticles(), loadMembers()]);
    const q = new URLSearchParams();
    if (from) q.set('from', from); if (to) q.set('to', to); if (memberId) q.set('memberId', memberId);
    const r = await api('bookings?' + q);
    $('main').innerHTML = `<h2 class="page">Buchungen</h2><p class="lead">Alle Buchungen im Zeitraum. Falschbuchungen hier stornieren oder vergessene Buchungen nachtragen.</p>
      ${rangeBar(r.from, r.to)}
      <div class="row" style="margin-bottom:14px"><label class="f">Nur Konto<select id="bMem"><option value="">alle</option>${cache.members.map(m => `<option value="${m.id}" ${Number(memberId) === m.id ? 'selected' : ''}>${pName(m)}</option>`).join('')}</select></label>
        ${memberId ? (() => { const act = r.rows.filter(b => !b.cancelled_at); const konto = act.filter(b => b.kind === 'konto');
          return `<div class="kpi" style="padding:8px 14px"><div class="l">${esc((m => m ? lastFirst(m.name, m.kind) : '')(cache.members.find(m => m.id === Number(memberId))))} im Zeitraum</div>
            <div style="font-weight:700">${act.reduce((x, b) => x + b.qty, 0)} Stück · ${euro(konto.reduce((x, b) => x + b.total_cents, 0))} aufs Konto${act.length !== konto.length ? ' · dazu bar/frei/angeschrieben' : ''}</div></div>`; })() : ''}</div>
      <div class="card"><h3>Nachtragen</h3><div class="row" style="flex-wrap:nowrap">
        <label class="f" style="flex:1;min-width:0">Konto<select id="nbMem">${cache.members.filter(m => m.active).map(m => `<option value="${m.id}">${pName(m)}</option>`).join('')}</select></label>
        <label class="f" style="flex:1;min-width:0">Artikel<select id="nbArt">${articleOptions(null)}<option value="__betrag">— freier Betrag … —</option></select></label>
        <label class="f" id="nbQtyL">Menge<input id="nbQty" class="n" value="1" inputmode="numeric" style="width:80px"></label>
        <label class="f hidden" id="nbAmtL">Betrag €<input id="nbAmt" class="n" placeholder="0,00" inputmode="decimal" style="width:90px"></label>
        <label class="f hidden" id="nbNoteL">Wofür?<input id="nbNote" placeholder="z. B. Startgeld" maxlength="60"></label>
        <label class="f">Datum<input type="date" id="nbDate" value="${today()}"></label>
        <button class="btn" id="nbSave">Nachtragen</button></div></div>
      <div class="scroll"><table class="tbl kompakt" id="buTbl"><tr><th>Zeit</th><th>Konto</th><th>Art</th><th>Artikel</th><th class="r">Menge</th><th class="r">Betrag</th><th></th></tr>
      ${moreRows(r.rows.map(b => `<tr class="${b.cancelled_at ? 'off' : ''}"><td>${deTime(b.created_at)}</td><td>${esc(b.member_kind ? lastFirst(b.member, b.member_kind) : b.member || (b.event ? 'Barverkauf ohne Namen' : ''))}${b.event ? `<div class="muted s">${esc(b.event)}</div>` : ''}</td>
        <td><span class="pill ${BKIND[b.kind][1]}">${b.tab_id && b.kind === 'gast' ? (b.tab_status === 'bezahlt' ? 'Deckel · ' + (b.tab_method === 'karte' ? 'Karte' : 'bar') : 'Deckel · offen')
          : b.tab_id && b.kind === 'verein' ? 'Deckel · abgeschrieben'
          : b.kind === 'event' ? (b.event_guest_id ? (b.pay_method === 'bar' ? 'Liste · bar bezahlt' : b.pay_method === 'karte' ? 'Liste · Karte' : 'Liste · offen') : 'bar') : BKIND[b.kind][0]}</span>${b.transferred_at ? ` <span class="pill b">von ${b.tab_id ? 'Gäste-Deckel' : 'Veranstaltung'} übernommen</span>` : ''}${b.settled_id && !b.cancelled_at ? ' <span class="pill">abgerechnet</span>' : ''}</td><td>${esc(b.article)}</td><td class="r k-lbl">${b.qty}</td><td class="r">${euro(b.total_cents)}</td>
        <td class="r">${b.cancelled_at ? `storniert (${esc(b.cancelled_by)})` : `<button class="btn small danger" data-cx="${b.id}">Storno</button>`}</td></tr>`), 7) }</table></div>${r.rows.length ? '' : '<p class="empty">Keine Buchungen im Zeitraum.</p>'}`;
    bindRange('rng', (f, t) => RENDER.buchungen(f, t, $('bMem').value).catch(fail));
    $('bMem').onchange = () => RENDER.buchungen(r.from, r.to, $('bMem').value).catch(fail);
    $('nbArt').onchange = () => { const amt = $('nbArt').value === '__betrag'; $('nbQtyL').classList.toggle('hidden', amt); $('nbAmtL').classList.toggle('hidden', !amt); $('nbNoteL').classList.toggle('hidden', !amt); };
    $('nbSave').onclick = async () => {
      const amt = $('nbArt').value === '__betrag';
      const body = amt ? { memberId: $('nbMem').value, amount_cents: toCents($('nbAmt').value || '0'), note: $('nbNote').value, date: $('nbDate').value }
        : { memberId: $('nbMem').value, articleId: $('nbArt').value, qty: $('nbQty').value, date: $('nbDate').value };
      try { await api('bookings', 'POST', body); toast('Nachgetragen.'); RENDER.buchungen(r.from, r.to, memberId); } catch (e) { fail(e); }
    };
    const again = () => RENDER.buchungen(r.from, r.to, memberId);
    const cancel = async id => {
      try { const x = await api(`bookings/${id}/cancel`, 'POST', {}); toast(x && x.message ? x.message : 'Storniert.'); } catch (e) { fail(e); }
      again();
    };
    $('buTbl').onclick = async e => {
      const b = e.target.closest('[data-cx]'); if (!b) return;
      const row = r.rows.find(x => x.id === Number(b.dataset.cx));
      if (!row || !row.settled_id) { if (await ask('Diese Buchung stornieren?')) cancel(b.dataset.cx); return; }
      // schon abgerechnet: sagen, wo – solange aus einem Verkaufs-Einzug nichts eingezogen ist, lieber den Lauf zurücknehmen
      let st; try { st = await api(`bookings/${row.id}/settlement`); } catch (e2) { fail(e2); return; }
      dialog(`<h2>Buchung ist schon abgerechnet</h2>
        <p style="margin-top:0">Abgerechnet über: <b>${esc(st.where)}</b>.</p>
        ${st.credit ? `<p class="muted">Stornieren bucht deshalb eine <b>Gutschrift</b> über ${euro(row.total_cents)}, die bei der nächsten Abrechnung abgezogen wird.</p>` : '<p class="muted">Der Posten dazu ist storniert – die Buchung wird normal storniert.</p>'}
        ${st.undo ? `<p class="muted">Aus diesem Verkaufs-Einzug wurde noch nichts eingezogen. Besser: <b>Lauf zurücknehmen</b> – die Buchung wird normal storniert, alle übrigen Verkaufskonten des Laufs (${st.undo.count} Posten, ${euro(st.undo.cents)}) sind wieder offen.</p>` : ''}
        <div class="btns"><button class="btn ghost" id="sxX">Abbrechen</button><button class="btn ${st.undo ? '' : 'danger'}" id="sxOk">${st.credit ? 'Gutschrift buchen' : 'Stornieren'}</button>${st.undo ? '<button class="btn primary" id="sxRun">Lauf zurücknehmen und stornieren</button>' : ''}</div>`);
      $('sxX').onclick = closeDialog;
      $('sxOk').onclick = () => { closeDialog(); cancel(row.id); };
      if ($('sxRun')) $('sxRun').onclick = () => busy($('sxRun'), async () => {
        try { await api(`bookings/${row.id}/undo-run`, 'POST', {}); await api(`bookings/${row.id}/cancel`, 'POST', {}); closeDialog(); toast('Lauf zurückgenommen und Buchung storniert – die übrigen Verkaufskonten sind wieder offen.'); } catch (e2) { fail(e2); }
        again();
      });
    };
  };

  /* ---------- Abtippliste: Beträge von Hand in die Vereinsverwaltung übertragen ---------- */
  function copyText(t, msg) {
    const done = () => toast(msg || `„${t.length > 40 ? t.slice(0, 40) + '…' : t}“ kopiert.`);
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).then(done, () => copyFallback(t, done));
    copyFallback(t, done);
  }
  function copyFallback(t, done) {        // im Vereins-WLAN läuft die Seite meist über http – dort gibt es keine Clipboard-API
    const ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* egal */ }
    ta.remove();
    ok ? done() : toast('Kopieren nicht möglich – bitte markieren und von Hand kopieren.', true);
  }
  function printHtml(html) {
    let p = $('printArea');
    if (!p) { p = document.createElement('div'); p.id = 'printArea'; document.body.appendChild(p); }
    p.innerHTML = html;
    document.body.classList.add('printing');
    const off = () => { document.body.classList.remove('printing'); p.innerHTML = ''; window.removeEventListener('afterprint', off); };
    window.addEventListener('afterprint', off);
    setTimeout(() => window.print(), 50);
  }
  const TICK_KEY = 'abtipp-erledigt';
  const ticksGet = () => { try { return JSON.parse(localStorage.getItem(TICK_KEY) || '{}'); } catch (e) { return {}; } };
  const ticksSet = t => { try { localStorage.setItem(TICK_KEY, JSON.stringify(t)); } catch (e) { /* egal */ } };
  const plain = c => ((c || 0) / 100).toFixed(2).replace('.', ',');

  async function abtippDialog(asOf, upTo) {
    const q = `asOf=${encodeURIComponent(asOf)}&upTo=${upTo}`;
    let d = await api('abtippliste?' + q);
    const mayEdit = can('abrechnung');
    const ticks = ticksGet();
    const isDone = x => ticks[x.id] === x.cents;          // Haken gilt nur, solange der Betrag gleich bleibt
    const stand = deTime(d.asOf);
    dialog(`<h2>Abtippliste für die Vereinsverwaltung</h2>
      <p class="muted" style="margin-top:0">Stand ${stand} Uhr – genau die Beträge aus Liste und Excel. Nach Nachnamen sortiert, Mannschaften am Ende.
        Haken setzen, sobald ein Betrag eingetragen ist; die Haken bleiben auf diesem Gerät erhalten.</p>
      <div class="row" style="flex-wrap:nowrap;margin-bottom:6px">
        <label class="f" style="flex:1;min-width:0">Buchungstext${mayEdit ? ' – Vorlage, Platzhalter {von} {bis} {jahr} {verein}' : ''}
          <input id="btTpl" value="${esc(d.template)}" maxlength="140" ${mayEdit ? '' : 'disabled'}></label>
      </div>
      <div class="row" style="flex-wrap:nowrap;margin-bottom:14px">
        <label class="f" style="flex:1;min-width:0">So wird er eingetragen<input id="btOut" value="${esc(d.text)}" readonly></label>
        <button class="btn" id="btCopy">Buchungstext kopieren</button>
      </div>
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px">
        <b id="abProg"></b><span class="muted s">Zum Kopieren auf den Betrag tippen</span>
      </div>
      <div class="scroll" style="max-height:52vh"><table class="tbl" id="abTbl">
        <tr><th style="width:44px"></th><th style="width:44px" class="r">Nr.</th><th>Nachname</th><th>Vorname</th><th class="r">Betrag</th></tr>
        ${d.rows.map((x, i) => `<tr data-row="${x.id}" class="${isDone(x) ? 'off' : ''}">
          <td><input type="checkbox" data-tick="${x.id}" ${isDone(x) ? 'checked' : ''} style="width:22px;height:22px;margin:0"></td>
          <td class="r">${i + 1}</td><td><b>${esc(x.last)}</b></td>
          <td>${isPerson(x.kind) ? esc(x.first) : '<span class="pill">Mannschaft</span>'}</td>
          <td class="r"><button class="btn small" data-copy="${plain(x.cents)}" style="min-width:96px;justify-content:flex-end">${euro(x.cents)}</button></td></tr>`).join('')}
        <tr class="sum"><td></td><td></td><td>Summe</td><td>${d.rows.length} Konten</td><td class="r">${euro(d.total_cents)}</td></tr>
      </table></div>
      <div class="btns"><button class="btn ghost" id="abReset">Haken zurücksetzen</button><button class="btn" id="abPrint">Drucken / als PDF speichern</button><button class="btn primary" id="abClose">Schließen</button></div>`, false);
    const prog = () => { const n = d.rows.filter(isDone).length; $('abProg').textContent = `${n} von ${d.rows.length} eingetragen`; };
    prog();
    $('abClose').onclick = closeDialog;
    $('btCopy').onclick = () => copyText($('btOut').value);
    $('abTbl').querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copyText(b.dataset.copy));
    $('abTbl').querySelectorAll('[data-tick]').forEach(c => c.onchange = () => {
      const x = d.rows.find(y => y.id === Number(c.dataset.tick));
      if (c.checked) ticks[x.id] = x.cents; else delete ticks[x.id];
      ticksSet(ticks);
      c.closest('tr').classList.toggle('off', c.checked);
      prog();
    });
    $('abReset').onclick = () => {
      d.rows.forEach(x => delete ticks[x.id]); ticksSet(ticks);
      $('abTbl').querySelectorAll('[data-tick]').forEach(c => { c.checked = false; c.closest('tr').classList.remove('off'); });
      prog();
    };
    if (mayEdit) $('btTpl').onchange = async () => {
      try {
        await api('abtippliste/text', 'PUT', { template: $('btTpl').value });
        d = { ...d, ...(await api('abtippliste?' + q)), rows: d.rows };
        $('btTpl').value = d.template; $('btOut').value = d.text;
        toast('Buchungstext gespeichert.');
      } catch (e) { fail(e); }
    };
    $('abPrint').onclick = () => printHtml(abtippPrint(d, stand));
  }

  function abtippPrint(d, stand) {
    const rows = d.rows.map((x, i) => `<tr><td class="c"><span class="box"></span></td><td class="c">${i + 1}</td><td><b>${esc(x.last)}</b></td>
      <td>${isPerson(x.kind) ? esc(x.first) : 'Mannschaft'}</td><td class="r">${euro(x.cents)}</td></tr>`).join('');
    return `<div class="pr">
      <div class="prhead"><div><div class="prclub">${esc(d.clubName)}</div><h1>Abrechnung – Abtippliste</h1></div>
        <div class="prmeta">Stand ${esc(stand)} Uhr · ${d.rows.length} Konten · ${euro(d.total_cents)}<br>gedruckt ${esc(deTime(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19)))}${me ? ' von ' + esc(me.name) : ''}</div></div>
      <div class="prtext"><span>Buchungstext</span><b>${esc(d.text)}</b></div>
      <table><thead><tr><th class="c">✓</th><th class="c">Nr.</th><th>Nachname</th><th>Vorname</th><th class="r">Betrag</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td></td><td></td><td>Summe</td><td>${d.rows.length} Konten</td><td class="r">${euro(d.total_cents)}</td></tr></tfoot></table>
    </div>`;
  }

  /* =================== Abrechnung =================== */
  /* ---------------------------------------------------------------- Verkauf: Auswertung (Dashboard) */
  const DS = (() => {
    const HEAT = ['#c5e384', '#7cc86f', '#24a03f', '#e9c46a', '#b22a2a'];
    const PAL = ['#1f6f3f', '#2f6fd6', '#e07b16', '#8a4fd6', '#1f9a6b', '#c2185b', '#00838f', '#f2b705', '#6d4c41', '#7a7f87', '#5e35b1', '#b22a2a'];
    const heat = (v, max) => (v <= 0 || !max ? null : HEAT[Math.min(4, Math.floor(v / max * 4.999))]);
    const num = v => Number(v || 0).toLocaleString('de-DE');
    function delta(cur, prev, { invert = false } = {}) {
      if (!prev && !cur) return '<span class="ds-d z">±0</span>';
      if (!prev) return '<span class="ds-d u">neu</span>';
      const d = Math.round((cur - prev) / prev * 100);
      return `<span class="ds-d ${d === 0 ? 'z' : (d > 0) !== invert ? 'u' : 'w'}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} %</span>`;
    }
    function spark(cur, prev, color) {
      const W = 260, H = 56, max = Math.max(1, ...cur, ...prev), x = i => 4 + i * (W - 8) / 11, y = v => H - 4 - v / max * (H - 10);
      const path = a => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      return `<svg class="ds-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${path(cur)} L${x(11)},${H} L${x(0)},${H} Z" fill="${color}" opacity=".14"/>
        <path d="${path(prev)}" fill="none" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/><path d="${path(cur)}" fill="none" stroke="${color}" stroke-width="2.2" vector-effect="non-scaling-stroke"/></svg>`;
    }
    function donut(items, center, unit) {
      const tot = items.reduce((x, i) => x + i.v, 0) || 1, R = 70, C = 2 * Math.PI * R;
      const list = items.length > 10 ? [...items.slice(0, 9), { name: `Weitere (${items.length - 9})`, v: items.slice(9).reduce((x, i) => x + i.v, 0), color: 'var(--line)' }] : items;
      let off = 0;
      const segs = list.map(i => { const len = i.v / tot * C; const g = list.length > 1 ? Math.min(2, len / 3) : 0; const s0 = `<circle r="${R}" cx="90" cy="90" fill="none" stroke="${i.color}" stroke-width="26" stroke-dasharray="${Math.max(0, len - g).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>${esc(i.name)}: ${Math.round(i.v / tot * 100)} %</title></circle>`; off += len; return s0; }).join('');
      return `<div class="ds-donut"><div class="ds-dring"><svg viewBox="0 0 180 180" width="180" height="180"><g transform="rotate(-90 90 90)"><circle r="${R}" cx="90" cy="90" fill="none" stroke="var(--hover)" stroke-width="26"/>${segs}</g></svg><div class="ds-dc"><b>${center}</b><span>${unit}</span></div></div>
        <ul class="ds-dleg">${list.map(i => `<li><i style="background:${i.color}"></i><b>${esc(i.name)}</b><span class="r">${(i.v / tot * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %</span></li>`).join('')}</ul></div>`;
    }
    const legend = () => `<span class="ds-leg">weniger${HEAT.map(c0 => `<i style="background:${c0}"></i>`).join('')}mehr</span>`;
    const ICO = { e: '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10h9M4 14h9"/>', u: '<path d="M7 3h10l-1 18H8L7 3z"/><path d="M7.5 9h9"/>', b: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>', x: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>' };
    const kpi = (k, label, val, dl, body, tone = '') => `<div class="card ds-kpi ${tone}"><div class="ds-kh"><span class="ds-ki"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg></span><span>${label}</span></div><div class="ds-kv"><b>${val}</b>${dl}</div>${body}</div>`;
    const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
    const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], WDL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const addD = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const dowI = s => (new Date(s + 'T12:00:00Z').getUTCDay() + 6) % 7;
    /** Kalender-Heatmap eines Jahres: days = { 'YYYY-MM-DD': Wert } */
    function calendar(year, days, fmt) {
      const max = Math.max(0, ...Object.values(days));
      const jan1 = `${year}-01-01`, start = addD(jan1, -dowI(jan1)), weeks = [];
      for (let w = 0; w < 54; w++) { const wd = addD(start, w * 7); if (wd > `${year}-12-31`) break; weeks.push(wd); }
      // Monatszeile: je Monat eine Zelle über alle seine Wochen (Woche zählt zum Monat, in dem die meisten ihrer Tage liegen – ihr Donnerstag) – nichts läuft über
      const months = []; weeks.forEach(w => { const d = addD(w, 3), key = d.slice(0, 4) === String(year) ? d.slice(5, 7) : ''; const last = months[months.length - 1]; if (last && last.key === key) last.n++; else months.push({ key, n: 1 }); });
      return `<div class="ds-scroll"><div class="ds-heat" style="--w:${weeks.length}"><span></span>${months.map(m => `<span class="mo" style="grid-column:span ${m.n}">${m.key ? MON[+m.key - 1] : ''}</span>`).join('')}
        ${WD.map((n, r) => `<span class="dl">${n}</span>${weeks.map(w => { const day = addD(w, r), v = days[day] || 0, inY = day.slice(0, 4) === String(year);
          return `<i class="${inY ? '' : 'out'}" ${inY ? `title="${deDate(day)}: ${fmt(v)}"` : ''} style="${inY && v ? `background:${heat(v, max)}` : ''}"></i>`; }).join('')}`).join('')}</div></div>`;
    }
    /** Wochentag × Uhrzeit als Punkte */
    function bubbles(grid, [h0, h1], fmt) {
      const hours = Array.from({ length: Math.max(0, h1 - h0) }, (_, i) => h0 + i), max = Math.max(0, ...grid.flat());
      return `<div class="ds-scroll"><div class="ds-bub" style="--h:${hours.length}"><span></span>${hours.map(h => `<span class="hh">${String(h).padStart(2, '0')}:00</span>`).join('')}
        ${WD.map((n, r) => `<span class="dl">${n}</span>${hours.map(h => { const v = grid[r][h] || 0; const sz = v ? Math.max(8, Math.round(Math.sqrt(v / max) * 40)) : 0;
          return `<span class="bc" title="${n} ${String(h).padStart(2, '0')}:00: ${fmt(v)}">${sz ? `<i style="width:${sz}px;height:${sz}px;background:${heat(v, max)}"></i>` : ''}</span>`; }).join('')}`).join('')}</div></div>`;
    }
    function monthBars(cur, prev, year, fmt) {
      const max = Math.max(1, ...cur, ...prev);
      return `<div class="ds-bars">${MON.map((m, i) => `<div class="ds-bar1" title="${m} ${year}: ${fmt(cur[i])} · ${year - 1}: ${fmt(prev[i])}"><div class="ds-bpair"><i class="p" style="height:${prev[i] / max * 100}%"></i><i style="height:${cur[i] / max * 100}%"></i></div><span>${m.slice(0, 3)}</span></div>`).join('')}</div>`;
    }
    return { PAL, delta, spark, donut, legend, kpi, calendar, bubbles, monthBars, num, WDL, heat };
  })();

  const svState = { year: new Date().getFullYear(), cat: '' };
  RENDER.auswertung = async () => {
    const g = svState;
    $('main').innerHTML = `<h2 class="page">Auswertung</h2><p class="lead">Umsatz, verkaufte Artikel und beliebte Zeiten – was am meisten verkauft wird, im Vergleich zum Vorjahr.</p><div id="svBody"><p class="muted">Lade …</p></div>`;
    const d = await api(`sales-stats?year=${g.year}&cat=${encodeURIComponent(g.cat)}`);
    if (page !== 'auswertung') return;
    const c = d.cur, p = d.prev, num = DS.num;
    const tot = d.top.reduce((x, a) => x + a.units, 0) || 1, allUnits = c.units || 1;
    let best = [0, 0, 0]; d.grid.forEach((row, r) => row.forEach((v, h) => { if (v > best[0]) best = [v, r, h]; }));
    const byDow = d.grid.map(row => row.reduce((x, v) => x + v, 0)), bd = byDow.indexOf(Math.max(...byDow));
    const bestDay = Object.entries(d.days).sort((a, b) => b[1] - a[1])[0];
    const hl = (t, v, sub) => `<div class="ds-hlt"><span>${t}</span><b>${v}</b><small>${sub}</small></div>`;
    void tot;
    $('svBody').innerHTML = `<div class="filterbar"><select id="svY" class="ds-sel" data-nodirty>${d.years.map(y => `<option value="${y}" ${y === d.year ? 'selected' : ''}>Jahr ${y}</option>`).join('')}</select>
        <select id="svC" class="ds-sel" data-nodirty><option value="">Alle Kategorien</option>${d.categories.map(k => `<option value="${esc(k)}" ${k === d.cat ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
        <span style="flex:1"></span><span class="muted s">${d.year === new Date().getFullYear() ? `bis heute (${deDate(d.until)}) · ` : ''}Vergleich mit ${d.year - 1}</span></div>
      <div class="ds-kpis">
        ${DS.kpi('e', 'Umsatz', euro(c.revenue), DS.delta(c.revenue, p.revenue), DS.spark(c.month, p.month, 'var(--brand)'))}
        ${DS.kpi('u', 'Verkaufte Artikel', num(c.units), DS.delta(c.units, p.units), DS.spark(c.monthUnits, p.monthUnits, '#e07b16'), 'o')}
        ${DS.kpi('b', 'Buchungen', num(c.count), DS.delta(c.count, p.count), DS.spark(c.monthCount, p.monthCount, '#2f6fd6'), 'b')}
        ${DS.kpi('x', 'Storniert', num(c.cancelled), DS.delta(c.cancelled, p.cancelled, { invert: true }), DS.spark(c.monthCan, p.monthCan, 'var(--red)'), 'r')}
      </div>
      <div class="card ds-hl">${hl('Bestseller', d.top[0] ? esc(d.top[0].name) : '–', d.top[0] ? `${num(d.top[0].units)} × · ${Math.round(d.top[0].units / allUnits * 100)} % aller Artikel` : '&nbsp;')}
        ${hl('Stärkster Tag', byDow[bd] ? DS.WDL[bd] : '–', bestDay ? `Rekord: ${deDate(bestDay[0])} · ${num(bestDay[1])} Artikel` : '&nbsp;')}
        ${hl('Stoßzeit', best[0] ? `${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][best[1]]} ${best[2]}–${best[2] + 1} Uhr` : '–', best[0] ? `${num(best[0])} Artikel im Jahr` : '&nbsp;')}
        ${hl('Ø je Buchung', c.count ? euro(c.revenue / c.count) : '–', c.count ? `${(c.units / c.count).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Artikel je Buchung` : '&nbsp;')}</div>
      <div class="ds-two">
        <div class="card"><h3>Die meistverkauften Artikel</h3>${d.top.length ? `<ol class="ds-top">${d.top.map((a, i) => `<li><span class="n">${i + 1}</span><b>${esc(a.name)}</b><div class="ds-meter"><i style="width:${a.units / d.top[0].units * 100}%"></i></div><span class="r">${num(a.units)} ×</span><span class="r muted">${Math.round(a.units / allUnits * 100)} %</span>${DS.delta(a.units, a.prev)}</li>`).join('')}</ol>` : '<p class="empty">Noch keine Verkäufe in diesem Jahr.</p>'}</div>
        <div class="card"><h3>Umsatz nach Kategorie</h3>${d.cats.length ? DS.donut(d.cats.map((k, i) => ({ name: k.name, v: k.cents || k.units, color: DS.PAL[i % DS.PAL.length] })), euro(c.revenue).replace(/,\d\d\s/, ' '), 'Umsatz') : '<p class="empty">Noch keine Verkäufe.</p>'}
          ${d.kinds.length ? `<div class="ds-mini" style="grid-template-columns:repeat(${Math.min(4, d.kinds.length)}, minmax(0, 1fr))">${d.kinds.slice(0, 4).map(k => `<div><span>${esc(k.name)}</span><b>${num(k.units)}</b><small>${euro(k.cents)}</small></div>`).join('')}</div>` : ''}</div>
      </div>
      <div class="card"><div class="ds-ch"><h3>Jahr ${d.year} · ${num(c.units)} verkaufte Artikel</h3>${DS.legend()}</div>${DS.calendar(d.year, d.days, v => `${num(v)} Artikel`)}</div>
      <div class="ds-two">
        <div class="card"><div class="ds-ch"><h3>Umsatz je Monat</h3><span class="ds-leg"><i style="background:var(--brand)"></i>${d.year}<i style="background:var(--line);margin-left:10px"></i>${d.year - 1}</span></div>${DS.monthBars(c.month, p.month, d.year, euro)}</div>
        <div class="card"><div class="ds-ch"><h3>Wann wird gekauft?</h3>${DS.legend()}</div>${DS.bubbles(d.grid, d.hours, v => `${num(v)} Artikel`)}</div>
      </div>`;
    $('svY').onchange = () => { g.year = +$('svY').value; RENDER.auswertung().catch(fail); };
    $('svC').onchange = () => { g.cat = $('svC').value; RENDER.auswertung().catch(fail); };
  };

  /** „+ Betrag auf Konto“: freier Betrag mit Text aufs Verkaufskonto – wird abgerechnet wie jede Tablet-Buchung */
  async function amountDialog(done) {
    await loadMembers();
    dialog(`<h2>Betrag auf ein Konto buchen</h2>
      <p class="muted" style="margin-top:0">Zum Beispiel Essen, Startgeld oder eine Kiste fürs Fest. Der Betrag steht danach auf dem Verkaufskonto und wird mit der nächsten Abrechnung bezahlt.</p>
      <label class="f">Konto<select id="amMem">${cache.members.filter(m => m.active).map(m => `<option value="${m.id}">${pName(m)}</option>`).join('')}</select></label>
      <div class="row"><label class="f" style="flex:1 1 140px">Betrag €<input id="amC" class="n" inputmode="decimal" placeholder="0,00"></label>
        <label class="f" style="flex:1 1 140px">Datum<input type="date" id="amD" value="${today()}"></label></div>
      <label class="f">Wofür?<input id="amT" maxlength="60" placeholder="z. B. Essen Sommerfest"></label>
      <div class="btns"><button class="btn ghost" id="amX">Abbrechen</button><button class="btn primary" id="amOk">Buchen</button></div>`);
    $('amX').onclick = closeDialog;
    $('amOk').onclick = () => busy($('amOk'), async () => {
      if ($('amT').value.trim().length < 3) { toast('Bitte kurz eintragen, wofür der Betrag ist.', true); return; }
      try { await api('bookings', 'POST', { memberId: $('amMem').value, amount_cents: toCents($('amC').value || '0'), note: $('amT').value, date: $('amD').value }); closeDialog(); toast('Gebucht.'); done(); } catch (e) { fail(e); }
    });
  }

  RENDER.abrechnung = async (from, to) => {
    const q = new URLSearchParams(); if (from) q.set('from', from); if (to) q.set('to', to);
    const mayClose = can('abrechnung');
    const [r, hist] = await Promise.all([api('balances?' + q), mayClose ? api('settle-history') : []]);
    const used = new Set(r.rows.flatMap(x => Object.keys(x.byCategory)));
    const cats = [...(r.categories || []).filter(c => used.has(c)), ...[...used].filter(c => !(r.categories || []).includes(c))];   // Reihenfolge wie im Excel
    const s = Object.fromEntries(r.sums.map(x => [x.kind, x]));
    const xls = `api/admin/export.xlsx?from=${r.from}&to=${r.to}&asOf=${encodeURIComponent(r.asOf)}&upTo=${r.upTo}`;
    const stand = deTime(r.asOf);
    // Einzug per Lastschrift gibt es nur mit der Mitgliederverwaltung (deren Verwaltungsseite stellt GK.drinksCollect bereit)
    const sepa = GK.drinksCollect && (cache.modules || []).includes('mitglieder') && can('mitglieder_finanzen');
    $('main').innerHTML = `<h2 class="page">Abrechnung & Export</h2>
      <p class="lead">Liste holen, in der Vereinsverwaltung abbuchen, hier als abgerechnet markieren.</p>
      <div class="toolbar">
        <button class="btn ghost" id="reload">Liste aktualisieren</button>
        ${can('buchungen') ? '<button class="btn" id="addAmt">+ Betrag auf Konto</button>' : ''}
        ${r.rows.length ? '<button class="btn" id="abtipp">Abtippliste</button>' : ''}
        ${mayClose ? (r.rows.length ? '<button class="btn" id="settleAll">Alle als abgerechnet markieren</button>' : '')
          : '<span class="muted s" style="align-self:center">Als abgerechnet markieren darf nur, wer das Recht „Abrechnung“ hat.</span>'}
        <a class="btn ${sepa ? '' : 'primary'}" href="${xls}">Excel</a>
      </div>
      <details class="howto" style="margin-bottom:14px"><summary>So geht's</summary><p class="muted s" style="margin:8px 0 0"><b>1.</b> Excel herunterladen oder die <b>Abtippliste</b> öffnen (nach Nachnamen sortiert, mit fertigem Buchungstext, zum Abhaken oder Ausdrucken) · <b>2.</b> in der Vereinsverwaltung bei den Mitgliedern abbuchen ·
        <b>3.</b> hier einzelne oder alle Konten als <b>abgerechnet</b> markieren – ihr offener Betrag steht danach auf 0. Erfasst wird genau der Stand der Liste (${stand} Uhr); was danach am Tablet gebucht wird, bleibt für die nächste Abrechnung offen.</p></details>
      ${r.eventOpen.length ? `<div class="banner r" style="margin-bottom:14px">Auf ${r.eventOpen.length === 1 ? 'der Liste' : 'den Listen'} ${r.eventOpen.map(e => `„${esc(e.name)}“ (${euro(e.c)})`).join(', ')} haben Mitglieder noch offene Beträge.
        Diese erscheinen hier erst, wenn der Kassierer sie unter „Veranstaltungen“ auf die Konten übernimmt – am besten vor dem Export.</div>` : ''}
      <div class="kpis">
        <div class="kpi"><div class="l">Offen gesamt</div><div class="v">${euro(r.total_cents)}</div></div>
        <div class="kpi"><div class="l">Konten mit offenem Betrag</div><div class="v">${r.rows.length}</div></div>
        <div class="kpi"><div class="l">Stand der Liste</div><div class="v">${stand.slice(-5)}</div></div>
        <div class="kpi"><div class="l">Zuletzt abgerechnet</div><div class="v">${hist.length ? deDate(hist[0].created_at.slice(0, 10)) : '–'}</div></div>
      </div>
      ${sepa ? `<div class="card" style="margin-bottom:16px"><div class="row" style="justify-content:space-between;align-items:center">
        <div style="flex:1 1 260px;min-width:0"><h3 style="margin:0 0 4px">Per Lastschrift einziehen</h3><p class="muted s" style="margin:0">Alle Mitglieder mit Mandat in einem Schritt bis zur SEPA-Datei, getrennt von den Beiträgen. Die Konten werden dabei als abgerechnet markiert; Mannschaften und Konten ohne Mandat bleiben offen.</p></div>
        <button class="btn primary" id="sepaGo">Per Lastschrift einziehen …</button></div></div>` : ''}
      <div class="scroll"><table class="tbl kompakt" id="abTbl"><tr><th>Konto</th><th>offen seit</th>${cats.map(c => `<th class="r">${esc(c)}</th>`).join('')}<th class="r">Betrag</th>${mayClose ? '<th></th>' : ''}</tr>
        ${moreRows(r.rows.map(x => `<tr><td>${pName(x)} ${x.kind === 'mannschaft' ? '<span class="pill">Mannschaft</span>' : ''}${x.eventOpen_cents ? ` <span class="pill r" title="Noch auf einer Veranstaltungsliste offen – erst nach Übernahme auf der Getränkeliste">+ ${euro(x.eventOpen_cents)} Veranstaltung</span>` : ''}</td>
          <td>${deDate(x.since.slice(0, 10))}</td>${cats.map(c => `<td class="r k-lbl">${x.byCategory[c] || ''}</td>`).join('')}<td class="r">${euro(x.total_cents)}</td>
          ${mayClose ? `<td class="r"><button class="btn small" data-settle="${x.id}">abgerechnet</button></td>` : ''}</tr>`), cats.length + 3 + (mayClose ? 1 : 0))
          || ''}
        ${r.rows.length ? `<tr class="sum"><td>Summe</td><td></td>${cats.map(c => `<td class="r k-weg">${r.rows.reduce((a, x) => a + (x.byCategory[c] || 0), 0)}</td>`).join('')}<td class="r">${euro(r.total_cents)}</td>${mayClose ? '<td></td>' : ''}</tr>` : ''}</table></div>${r.rows.length ? '' : '<p class="empty">Keine offenen Beträge – alles abgerechnet.</p>'}
      ${(r.mvOpen || []).length ? `<div class="card" style="margin-top:16px"><h3>Offene Verkaufs-Posten in der Mitgliederverwaltung <span class="muted s">${r.mvOpen.length} · ${euro(r.mvOpen.reduce((a, c) => a + c.cents, 0))}</span></h3>
        <p class="muted s" style="margin-top:0">Schon abgerechnet oder von Hand angelegt, aber noch nicht bezahlt – sie kommen mit dem nächsten Einzug per Lastschrift mit.</p>
        <div class="scroll"><table class="tbl"><tr><th>Zahler</th><th>Posten</th><th>fällig</th><th class="r">Betrag</th></tr>
          ${r.mvOpen.map(c => `<tr><td>${esc(lastFirst(c.payer, c.payer_kind))}</td><td translate="no">${esc(c.text)}</td><td class="nw">${deDate(c.due_date)}</td><td class="r">${euro(c.cents)}</td></tr>`).join('')}</table></div></div>` : ''}
      ${mayClose ? `<div class="card" style="margin-top:16px"><h3>Bisherige Abrechnungen</h3>
        ${hist.length ? `<table class="tbl"><tr><th>markiert am</th><th>Konten</th><th class="r">Betrag</th><th>von</th><th></th></tr>
          ${hist.map(h => `<tr><td>${deTime(h.created_at)}</td><td>${h.names ? esc(h.names) : (h.batch.startsWith('alle-') ? 'alle' : '') + ' ' + h.members + ' Konten'}</td>
            <td class="r">${euro(h.cents)}</td><td>${esc(h.by_user || '')}</td>
            <td class="r">${h.undo ? `<button class="btn small" data-undo="${esc(h.batch)}">Rückgängig</button>` : ''}</td></tr>`).join('')}</table>`
          : '<p class="empty">Noch keine Abrechnungen.</p>'}</div>` : ''}
      <div class="card" style="margin-top:16px"><h3>Auswertung für einen Zeitraum</h3>
        <p class="muted">Gilt für die Kennzahlen hier und die Blätter „Buchungen“, „Abgleich“ und „Veranstaltungen“ in der Excel-Datei.</p>
        ${rangeBar(r.from, r.to)}
        <div class="kpis">
          <div class="kpi"><div class="l">Auf Konten gebucht</div><div class="v">${euro(s.konto?.cents)}</div></div>
          <div class="kpi"><div class="l">Gäste bar & Deckel</div><div class="v">${euro(s.gast?.cents)}</div></div>
          <div class="kpi"><div class="l">Veranstaltungen (Soll)</div><div class="v">${euro(s.event?.cents)}</div></div>
          <div class="kpi"><div class="l">Kostenfrei (Wert)</div><div class="v">${euro(s.verein?.list_cents)}</div></div>
        </div></div>`;
    bindRange('rng', (f, t) => RENDER.abrechnung(f, t).catch(fail));
    $('reload').onclick = () => RENDER.abrechnung(from, to).catch(fail);
    if ($('abtipp')) $('abtipp').onclick = () => abtippDialog(r.asOf, r.upTo).catch(fail);
    if ($('sepaGo')) $('sepaGo').onclick = () => GK.drinksCollect(() => RENDER.abrechnung(from, to).catch(fail)).catch(fail);
    if ($('addAmt')) $('addAmt').onclick = () => amountDialog(() => RENDER.abrechnung(from, to).catch(fail)).catch(fail);
    const settle = async (ids, text) => {
      if (!await ask(text)) return;
      try {
        const x = await api('settle', 'POST', ids ? { asOf: r.asOf, upTo: r.upTo, memberIds: ids } : { asOf: r.asOf, upTo: r.upTo });
        toast(`${x.members === 1 ? '1 Konto' : x.members + ' Konten'} abgerechnet (${euro(x.cents)}).`);
        RENDER.abrechnung(from, to);
      } catch (e) { fail(e); }
    };
    if ($('settleAll')) $('settleAll').onclick = () => settle(null,
      `Alle ${r.rows.length} Konten über zusammen ${euro(r.total_cents)} als abgerechnet markieren?\n\nNur tun, wenn die Beträge in der Vereinsverwaltung abgebucht sind. Erfasst wird der Stand ${stand} Uhr.`);
    $('abTbl').onclick = e => {
      const btn = e.target.closest('[data-settle]'); if (!btn) return;
      const x = r.rows.find(y => y.id === Number(btn.dataset.settle));
      settle([x.id], `${x.name}: ${euro(x.total_cents)} als abgerechnet markieren?`);
    };
    $('main').querySelectorAll('[data-undo]').forEach(btn => btn.onclick = async () => {
      if (!await ask('Diese Abrechnung zurücknehmen? Die Beträge sind danach wieder offen.')) return;
      try { await api('settle/' + encodeURIComponent(btn.dataset.undo), 'DELETE'); toast('Zurückgenommen.'); RENDER.abrechnung(from, to); } catch (e) { fail(e); }
    });
  };

  /* =================== Gäste-Deckel (Abschnitt unter „Veranstaltungen & Deckel“) =================== */
  async function deckelSection(box) {
    const [r] = await Promise.all([api('tabs?days=30'), cache.members ? null : loadMembers()]);
    const mayPay = can('veranstaltungen') || can('uebernahme'), mayClose = can('uebernahme');
    const day = 86400000, now = Date.now();
    const age = t => Math.floor((now - new Date(t.created_at.replace(' ', 'T')).getTime()) / day);
    const items = t => t.items.map(i => `${i.qty}× ${esc(i.article)}`).join(', ');
    const openSum = r.open.reduce((a, t) => a + t.open_cents, 0);
    const old = r.open.filter(t => age(t) >= 1).length;
    const ST = { bezahlt: t => `<span class="pill g">${t.method === 'karte' ? 'Karte' : 'bar'} bezahlt</span>`, uebernommen: t => `<span class="pill b">übernommen${t.member ? ': ' + esc(lastFirst(t.member, t.member_kind)) : ''}</span>`,
      abgeschrieben: t => `<span class="pill r">abgeschrieben</span>${t.note ? `<div class="muted s">${esc(t.note)}</div>` : ''}` };
    box.innerHTML = `<h2 class="sec">Gäste-Deckel</h2>
      <p class="lead">Gäste schreiben am Tablet an und zahlen vor der Heimfahrt. Hier siehst du, was offen ist${mayClose ? ' und was nachträglich abgehakt, übernommen oder abgeschrieben werden kann' : ''}.</p>
      <div class="kpis">
        <div class="kpi"><div class="l">Offene Deckel</div><div class="v">${r.open.length}</div></div>
        <div class="kpi"><div class="l">Noch offen</div><div class="v">${euro(openSum)}</div></div>
        <div class="kpi"><div class="l">Heute bar bezahlt</div><div class="v">${euro(r.today.bar ? r.today.bar.c : 0)}</div></div>
        <div class="kpi"><div class="l">Heute mit Karte</div><div class="v">${euro(r.today.karte ? r.today.karte.c : 0)}</div></div>
      </div>
      ${old ? `<div class="banner r" style="margin-bottom:14px">${old === 1 ? 'Ein Deckel ist' : old + ' Deckel sind'} seit mehr als einem Tag offen – vermutlich vergessen zu bezahlen.</div>` : ''}
      <div class="card"><h3>Offen</h3>
        ${r.open.length ? `<table class="tbl"><tr><th>Deckel</th><th>geöffnet</th><th class="r">offen</th><th></th></tr>
        ${r.open.map(t => `<tr><td><b>${esc(t.name)}</b>${age(t) >= 1 ? ` <span class="pill r">seit ${age(t)} ${age(t) === 1 ? 'Tag' : 'Tagen'}</span>` : ''}<div class="muted s">${items(t) || 'noch nichts angeschrieben'}</div></td>
          <td>${deTime(t.created_at)}</td><td class="r"><b>${euro(t.open_cents)}</b></td>
          <td class="r" style="white-space:nowrap">${mayPay ? `<button class="btn small" data-tp="${t.id}" data-m="bar">Bar bezahlt</button> <button class="btn small" data-tp="${t.id}" data-m="karte">Karte bezahlt</button>` : ''}
            ${mayClose ? ` <button class="btn small" data-tt="${t.id}">Auf Konto …</button> <button class="btn small danger" data-tw="${t.id}">Abschreiben …</button>` : ''}</td></tr>`).join('')}</table>`
          : '<p class="empty">Keine offenen Deckel.</p>'}</div>
      <div class="card" style="margin-top:16px"><h3>Geschlossen (letzte ${r.days} Tage)</h3>
        ${r.closed.length ? `<table class="tbl"><tr><th>Deckel</th><th>geschlossen</th><th>Status</th><th class="r">Betrag</th><th>von</th><th></th></tr>
        ${r.closed.map(t => `<tr><td><b>${esc(t.name)}</b><div class="muted s">${items(t)}</div></td><td>${deTime(t.closed_at)}</td><td>${ST[t.status](t)}</td>
          <td class="r">${euro(t.status === 'abgeschrieben' ? t.sum_cents : t.cents)}</td><td>${esc(t.closed_by || '')}</td>
          <td class="r">${t.status === 'bezahlt' && mayPay ? `<button class="btn small" data-tr="${t.id}">Wieder öffnen</button>` : ''}</td></tr>`).join('')}</table>`
          : '<p class="muted">In diesem Zeitraum nichts geschlossen.</p>'}</div>`;
    const find = id => r.open.find(t => t.id === Number(id)) || r.closed.find(t => t.id === Number(id));
    const done = msg => { toast(msg); refreshBadges(); deckelSection(box); };
    box.querySelectorAll('[data-tp]').forEach(b => b.onclick = async () => {
      const t = find(b.dataset.tp);
      if (!await ask(`„${t.name}“: ${euro(t.open_cents)} ${b.dataset.m === 'karte' ? 'mit Karte' : 'bar'} bezahlt?`)) return;
      try { await api(`tabs/${t.id}/pay`, 'POST', { method: b.dataset.m }); done('Als bezahlt abgehakt.'); } catch (e) { fail(e); }
    });
    box.querySelectorAll('[data-tr]').forEach(b => b.onclick = async () => {
      const t = find(b.dataset.tr);
      if (!await ask(`Zahlung von „${t.name}“ (${euro(t.cents)}) zurücknehmen? Der Deckel ist danach wieder offen.`)) return;
      try { await api(`tabs/${t.id}/reopen`, 'POST', {}); done('Deckel wieder geöffnet.'); } catch (e) { fail(e); }
    });
    box.querySelectorAll('[data-tt]').forEach(b => b.onclick = () => {
      const t = find(b.dataset.tt);
      const people = cache.members.filter(m => m.active && !m.pending && (isPerson(m.kind) || m.kind === 'mannschaft'))
        .sort((a, c) => (a.kind === c.kind ? 0 : a.kind === 'mannschaft' ? -1 : 1));   // innerhalb: Reihenfolge vom Server (nach Nachname)
      dialog(`<h2>Deckel auf ein Konto übernehmen</h2>
        <p class="muted">„${esc(t.name)}“ über ${euro(t.open_cents)} wird auf das gewählte Konto gebucht und mit der nächsten Abrechnung berechnet – z. B. auf die eigene Mannschaft, die den Gegner eingeladen hat.</p>
        <label class="f">Konto<select id="ttM">${people.map(m => `<option value="${m.id}">${pName(m)}${m.kind === 'mannschaft' ? ' (Mannschaft)' : ''}</option>`).join('')}</select></label>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok">Übernehmen</button></div>`);
      $('c').onclick = closeDialog;
      $('ok').onclick = () => busy($('ok'), async () => {
        try { await api(`tabs/${t.id}/transfer`, 'POST', { memberId: Number($('ttM').value) }); closeDialog(); done('Auf das Konto übernommen.'); } catch (e) { fail(e); }
      });
    });
    box.querySelectorAll('[data-tw]').forEach(b => b.onclick = () => {
      const t = find(b.dataset.tw);
      dialog(`<h2>Deckel abschreiben</h2>
        <p class="muted">„${esc(t.name)}“ über ${euro(t.open_cents)} wird nicht mehr kassiert. Die Artikel zählen als kostenfrei (Bestand stimmt weiter), die Begründung steht im Protokoll.</p>
        <label class="f">Begründung<input id="twN" placeholder="z. B. Gegner abgereist, nicht erreichbar"></label>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn danger" id="ok">Abschreiben</button></div>`);
      $('c').onclick = closeDialog;
      $('ok').onclick = () => busy($('ok'), async () => {
        try { await api(`tabs/${t.id}/writeoff`, 'POST', { note: $('twN').value }); closeDialog(); done('Abgeschrieben.'); } catch (e) { fail(e); }
      });
    });
  }

  RENDER.veranstaltungen = async (keep = {}) => {
    const showEv = canAny(['veranstaltungen', 'uebernahme']);   // wer nur abrechnen darf, sieht hier nur die Deckel
    const [list, people] = showEv ? await Promise.all([api('events'), api('event-members'), loadArticles()]) : [[], []];
    const canEv = can('veranstaltungen'), canTr = can('uebernahme');
    const filt = keep.filter || {};
    const STATUS = g => {
      const p = [];
      if (g.open_cents) p.push(`<span class="pill a">offen ${euro(g.open_cents)}</span>`);
      if (g.bar_cents) p.push(`<span class="pill g">bar bezahlt ${euro(g.bar_cents)}</span>`);
      if (g.karte_cents) p.push(`<span class="pill g">Karte ${euro(g.karte_cents)}</span>`);
      if (g.transferred_cents) p.push(`<span class="pill b">auf Konten ${euro(g.transferred_cents)}</span>`);
      return p.join(' ') || '<span class="muted s">noch nichts</span>';
    };
    const guestRow = (e, g) => {
      const done = !g.open_cents && g.total_cents > 0;
      const btns = [];
      if (g.open_cents && canEv) btns.push(`<button class="btn small primary" data-pay="bar" data-ev="${e.id}" data-g="${g.id}">Bar bezahlt</button>`,
        `<button class="btn small" data-pay="karte" data-ev="${e.id}" data-g="${g.id}">Karte bezahlt</button>`);
      if (!g.member_id && g.open_cents && (canEv || canTr)) btns.push(`<button class="btn small ghost" data-link="${g.id}" data-ev="${e.id}">Mitglied zuordnen</button>`);
      if (!g.n && canEv && !e.closed_at) btns.push(`<button class="btn small ghost" data-rmg="${g.id}" data-ev="${e.id}" aria-label="Namen entfernen">✕</button>`);
      return `<tr class="${done ? 'paidrow' : ''}" data-status="${g.open_cents ? 'offen' : (g.total_cents ? 'bezahlt' : 'leer')}">
        <td><span class="gname">${esc(g.member_kind ? lastFirst(g.name, g.member_kind) : g.name)}</span> ${g.member_id ? '<span class="pill">Mitglied</span>' : '<span class="pill a">Gast – kein Konto</span>'}
          ${g.member_id && g.member_name && g.member_name !== g.name ? `<div class="muted s">→ ${esc(lastFirst(g.member_name, g.member_kind))}</div>` : ''}</td>
        <td class="r">${g.qty}</td><td class="r">${euro(g.total_cents)}</td><td>${STATUS(g)}</td>
        <td class="r" style="white-space:nowrap">${btns.join(' ')}</td></tr>`;
    };
    $('main').innerHTML = `<h2 class="page">Veranstaltungen</h2>
      <p class="lead">Jede Veranstaltung hat eigene Preise und eine Abrechnungsliste: Am Tablet tragen sich die Leute ein, bezahlt wird hier abgehakt.</p>
      ${showEv ? `${canEv ? `<div class="card"><h3>Neue Veranstaltung</h3><div class="row">
        <label class="f" style="flex:1;min-width:220px">Name<input id="evName" placeholder="z. B. Löffelcup 2027"></label>
        <label class="f">Datum<input type="date" id="evDate" value="${today()}"></label>
        <label class="f">Artikel & Preise übernehmen von<select id="evCopy"><option value="">alle Artikel zum Normalpreis</option>${list.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label>
        <button class="btn primary" id="evAdd">Anlegen</button></div></div>` : ''}
      <datalist id="peopleList">${people.map(m => `<option value="${esc(m.name)}">`).join('')}</datalist>
      ${list.length ? '' : '<p class="empty">Noch keine Veranstaltung – oben Namen und Datum eintragen und „Anlegen“ tippen.</p>'}
      ${list.map(e => {
        const st = e.closed_at ? '<span class="pill">Kasse abgeschlossen</span>' : e.active ? '<span class="pill a">aktiv – Tablet bucht auf diese Liste</span>' : '<span class="pill b">nicht aktiv</span>';
        const f = filt[e.id] || 'alle';
        const open = e.guests.filter(g => g.open_cents);
        const memberOpen = open.filter(g => g.member_id);
        return `<div class="card" data-evcard="${e.id}"><div class="row" style="justify-content:space-between">
          <h3 style="margin:0">${esc(e.name)} · ${deDate(e.date)} ${st}</h3>
          ${canEv ? `<div class="row">${e.closed_at ? '' : `<button class="btn small" data-drinks="${e.id}">Artikel & Preise (${e.articles.length})</button>
            ${e.active ? `<button class="btn small" data-off="${e.id}">Deaktivieren</button>` : `<button class="btn small primary" data-on="${e.id}">Aktivieren</button>`}`}
            <button class="btn small" data-close="${e.id}">${e.closed_at ? 'Kasse neu zählen' : 'Kasse zählen & abschließen'}</button>
            ${e.active ? '' : `<button class="btn small danger" data-evdel="${e.id}">Löschen</button>`}</div>` : ''}</div>
        <div class="kpis" style="margin-top:12px">
          <div class="kpi"><div class="l">Umsatz</div><div class="v">${euro(e.total_cents)}</div></div>
          <div class="kpi"><div class="l">Bar (gehört in die Kasse)</div><div class="v">${euro(e.bar_cents)}</div>${e.sale_cents ? `<div class="muted s">davon ${euro(e.sale_cents)} ohne Namen</div>` : ''}
            ${e.cash_cents != null ? `<div class="s ${e.cash_cents - e.bar_cents < 0 ? 'neg' : 'muted'}">gezählt ${euro(e.cash_cents)} · Differenz ${euro(e.cash_cents - e.bar_cents)}</div>` : ''}</div>
          <div class="kpi"><div class="l">Mit Karte bezahlt</div><div class="v">${euro(e.karte_cents)}</div></div>
          <div class="kpi"><div class="l">Auf Konten übernommen</div><div class="v">${euro(e.transferred_cents)}</div></div>
          <div class="kpi ${e.open_cents ? 'warn' : ''}"><div class="l">Noch offen</div><div class="v">${euro(e.open_cents)}</div><div class="muted s">${open.length} ${open.length === 1 ? 'Name' : 'Namen'}</div></div>
        </div>
        ${canTr && e.open_cents ? `<div class="banner a" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
          <span>${memberOpen.length ? `Kassierer: ${memberOpen.length} ${memberOpen.length === 1 ? 'Mitglied hat' : 'Mitglieder haben'} ${euro(e.open_member_cents)} nicht direkt bezahlt.` : 'Kassierer: Alle Mitglieder sind erledigt.'}${e.open_manual.length ? ` <br><span style="font-weight:400">Nicht übernehmbar (Gast ohne Konto – erst „Mitglied zuordnen“ oder bar kassieren): ${e.open_manual.map(x => esc(x.name) + ' ' + euro(x.open_cents)).join(', ')}</span>` : ''}</span>
          ${memberOpen.length ? `<button class="btn primary" data-transfer="${e.id}">Übernehmen auf Konten (${euro(e.open_member_cents)})</button>` : ''}</div>` : ''}
        <div class="row" style="justify-content:space-between;margin:14px 0 8px">
          <h3 style="margin:0">Abrechnungsliste <span class="muted s">${e.guests.length} Namen</span></h3>
          <div class="row">
            <div class="seg">${['alle', 'offen', 'bezahlt'].map(k => `<button class="btn small ${f === k ? 'primary' : ''}" data-filt="${k}" data-ev="${e.id}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
            ${canEv && !e.closed_at ? `<input id="gAdd${e.id}" list="peopleList" placeholder="Name oder Mitglied …" style="min-height:36px;padding:4px 10px;border:1px solid var(--line);border-radius:10px;min-width:220px">
              <button class="btn small" data-addg="${e.id}">+ Hinzufügen</button>` : ''}
          </div></div>
        <div class="scroll" style="max-height:60vh"><table class="tbl evlist" data-f="${f}"><tr><th>Name</th><th class="r">Stück</th><th class="r">Betrag</th><th>Status</th><th></th></tr>
          ${e.guests.map(g => guestRow(e, g)).join('') || '<tr><td colspan="5" class="muted">Noch niemand auf der Liste – Namen hier hinzufügen oder am Tablet eintragen lassen.</td></tr>'}</table></div>
        ${e.payments.length ? `<details style="margin-top:10px"><summary>Zahlungen (${e.payments.length})</summary>
          <table class="tbl" style="margin-top:6px"><tr><th>Zeit</th><th>Name</th><th>Art</th><th class="r">Betrag</th><th>abgehakt von</th><th></th></tr>
          ${e.payments.map(p => `<tr><td>${deTime(p.at)}</td><td>${esc(p.member_kind ? lastFirst(p.name, p.member_kind) : p.name)}</td><td>${p.method === 'bar' ? 'bar' : 'Karte'}</td><td class="r">${euro(p.cents)}</td><td>${esc(p.by_user || '')}</td>
            <td class="r">${canEv ? `<button class="btn small ghost" data-unpay="${p.id}" data-ev="${e.id}">Rückgängig</button>` : ''}</td></tr>`).join('')}</table></details>` : ''}
        <details style="margin-top:10px"><summary>Verkaufte Artikel (${e.items.reduce((t, i) => t + i.qty, 0)} Stück)</summary>
          <table class="tbl" style="margin-top:6px"><tr><th>Artikel</th><th class="r">Menge</th><th class="r">Umsatz</th><th class="r">Verein frei</th></tr>
          ${e.items.map(i => `<tr><td>${esc(i.name)}</td><td class="r">${i.qty}</td><td class="r">${euro(i.total_cents)}</td><td class="r">${i.free_qty || ''}</td></tr>`).join('') || '<tr><td class="muted" colspan="4">Noch nichts gebucht.</td></tr>'}</table></details>
        </div>`;
      }).join('')}` : ''}
      <div id="deckelBox"></div>`;
    if (canAny(['veranstaltungen', 'uebernahme', 'abrechnung', 'export'])) deckelSection($('deckelBox')).catch(e => { if ($('deckelBox')) $('deckelBox').innerHTML = `<div class="banner r">${esc(e.message)}</div>`; });
    const again = () => RENDER.veranstaltungen({ filter: filt });
    if ($('evAdd')) $('evAdd').onclick = () => busy($('evAdd'), async () => { try { await api('events', 'POST', { name: $('evName').value, date: $('evDate').value, copyFrom: $('evCopy').value || null }); toast('Angelegt – jetzt Getränke & Preise prüfen und aktivieren.'); again(); } catch (e) { fail(e); } });
    const act = (sel, fn) => $('main').querySelectorAll(sel).forEach(b => b.onclick = () => Promise.resolve(fn(b)).then(r => { if (r !== false) again(); }).catch(fail));
    act('[data-on]', b => api(`events/${b.dataset.on}/activate`, 'POST', {}));
    act('[data-off]', b => api(`events/${b.dataset.off}/deactivate`, 'POST', {}));
    act('[data-filt]', b => { filt[b.dataset.ev] = b.dataset.filt; });
    act('[data-pay]', async b => {
      const ev = list.find(x => x.id === Number(b.dataset.ev)); const g = ev.guests.find(x => x.id === Number(b.dataset.g));
      const r = await api(`events/${ev.id}/guests/${g.id}/pay`, 'POST', { method: b.dataset.pay });
      toast(`${g.name}: ${euro(r.cents)} ${b.dataset.pay === 'bar' ? 'bar' : 'mit Karte'} bezahlt ✓`);
    });
    act('[data-unpay]', async b => {
      if (!await ask('Diese Zahlung zurücknehmen? Der Betrag ist dann wieder offen.')) return false;
      await api(`events/${b.dataset.ev}/payments/${b.dataset.unpay}`, 'DELETE');
    });
    act('[data-rmg]', b => api(`events/${b.dataset.ev}/guests/${b.dataset.rmg}`, 'DELETE'));
    const addGuest = async evId => {
      const v = $('gAdd' + evId).value.trim(); if (!v) return false;
      const m = people.find(x => x.name.toLocaleLowerCase('de') === v.toLocaleLowerCase('de'));
      await api(`events/${evId}/guests`, 'POST', m ? { memberId: m.id } : { name: v });
      toast(m ? `${m.name} (Mitglied) hinzugefügt.` : `„${v}“ als Gast hinzugefügt.`);
    };
    act('[data-addg]', b => addGuest(b.dataset.addg));
    $('main').querySelectorAll('input[id^="gAdd"]').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') addGuest(i.id.slice(4)).then(r => { if (r !== false) again(); }).catch(fail); });
    act('[data-link]', async b => {
      const ev = list.find(x => x.id === Number(b.dataset.ev)); const g = ev.guests.find(x => x.id === Number(b.dataset.link));
      const v = await new Promise(res => {
        dialog(`<h2>„${esc(g.name)}“ einem Mitglied zuordnen</h2>
          <p class="muted">Danach kann der offene Betrag auf dessen Konto übernommen werden.</p>
          <label class="f">Mitglied<input id="lnk" list="peopleList" placeholder="Name eingeben …" autocomplete="off"></label>
          <div class="err" id="lnkErr" style="text-align:left"></div>
          <div class="btns"><button class="btn ghost" id="lc">Abbrechen</button><button class="btn primary" id="lo">Zuordnen</button></div>`);
        setTimeout(() => $('lnk').focus(), 30);
        $('lc').onclick = () => { closeDialog(); res(null); };
        $('lo').onclick = () => {
          const m = people.find(x => x.name.toLocaleLowerCase('de') === $('lnk').value.trim().toLocaleLowerCase('de'));
          if (!m) { $('lnkErr').textContent = 'Bitte ein Mitglied aus der Liste wählen.'; return; }
          closeDialog(); res(m);
        };
      });
      if (!v) return false;
      const r = await api(`events/${ev.id}/guests/${g.id}`, 'PUT', { memberId: v.id, name: g.name });
      toast(r.merged ? `„${g.name}“ mit ${r.merged} zusammengeführt.` : `„${g.name}“ → ${v.name} zugeordnet.`);
    });
    act('[data-transfer]', async b => {
      const ev = list.find(x => x.id === Number(b.dataset.transfer));
      const names = ev.guests.filter(g => g.open_cents && g.member_id);
      if (!await ask(`${euro(ev.open_member_cents)} von ${names.length} ${names.length === 1 ? 'Mitglied' : 'Mitgliedern'} auf die Konten übernehmen?\n\n${names.map(g => '• ' + g.name + ' ' + euro(g.open_cents)).join('\n')}`)) return false;
      const r = await api(`events/${ev.id}/transfer`, 'POST', {});
      toast(`${r.people} ${r.people === 1 ? 'Person' : 'Personen'} mit ${euro(r.cents)} auf die Konten übernommen.`);
    });
    act('[data-close]', async b => {
      const ev = list.find(x => x.id === Number(b.dataset.close));
      const v = await askText(`Bargeld aus „${ev.name}“ zählen und in Euro eintragen.\nSoll in der Kasse: ${euro(ev.bar_cents)} (Kartenzahlungen ${euro(ev.karte_cents)} sind nicht in der Kasse).\nLeer lassen, wenn nicht getrennt gezählt:`, ev.cash_cents == null ? '' : centsToInput(ev.cash_cents));
      if (v === null) return false;
      await api(`events/${ev.id}/close`, 'POST', { cash_cents: v.trim() ? toCents(v) : null });
      if (ev.open_cents) toast('Abgeschlossen. Offene Beträge können weiter abgehakt bzw. vom Kassierer übernommen werden.');
    });
    act('[data-evdel]', async b => {
      const ev = list.find(x => x.id === Number(b.dataset.evdel));
      if (!await ask(`Veranstaltung „${ev.name}“ (${deDate(ev.date)}) löschen?\n\n${ev.total_cents ? 'Sie verschwindet aus der Liste. Umsatz und Bestand bleiben in den Auswertungen erhalten.' : 'Es wurde noch nichts gebucht – sie wird vollständig gelöscht.'}`)) return false;
      await api(`events/${ev.id}`, 'DELETE');
      toast('Veranstaltung gelöscht.');
    });
    $('main').querySelectorAll('[data-drinks]').forEach(b => b.onclick = () => eventDrinks(list.find(x => x.id === Number(b.dataset.drinks))));
  };

  function eventDrinks(ev) {
    const chosen = new Map(ev.articles.map(a => [a.id, a.price_cents]));
    const arts = cache.articles.slice();
    dialog(`<h2>Artikel bei „${esc(ev.name)}“</h2>
      <p class="muted">Nur angehakte Artikel erscheinen während der Veranstaltung auf dem Tablet – mit dem Preis aus der rechten Spalte.</p>
      <div class="row" style="margin-bottom:8px"><button class="btn small" id="dAll">alle Artikel</button><button class="btn small" id="dNone">keine</button></div>
      <div class="scroll" style="max-height:55vh"><table class="tbl"><tr><th></th><th>Artikel</th><th class="r">Normalpreis</th><th class="r">Preis bei der Veranstaltung</th></tr>
      ${arts.map(a => `<tr class="${a.active ? '' : 'off'}"><td><input type="checkbox" data-d="${a.id}" ${chosen.has(a.id) ? 'checked' : ''}></td><td>${esc(a.name)}${a.active ? '' : ' <span class="muted s">(sonst ausgeblendet)</span>'}</td>
        <td class="r">${euro(a.price_cents)}</td><td class="r"><input class="n" data-p="${a.id}" value="${centsToInput(chosen.has(a.id) ? chosen.get(a.id) : a.price_cents)}" style="width:90px"> €</td></tr>`).join('')}</table></div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok">Speichern</button></div>`, true);
    $('c').onclick = closeDialog;
    $('dAll').onclick = () => $('dialog').querySelectorAll('[data-d]').forEach(x => { x.checked = true; });
    $('dNone').onclick = () => $('dialog').querySelectorAll('[data-d]').forEach(x => { x.checked = false; });
    $('ok').onclick = () => busy($('ok'), async () => {
      const articles = [...$('dialog').querySelectorAll('[data-d]:checked')].map(x => ({
        articleId: Number(x.dataset.d), price_cents: toCents($('dialog').querySelector(`[data-p="${x.dataset.d}"]`).value || '0') }));
      try { await api(`events/${ev.id}/articles`, 'PUT', { articles }); closeDialog(); toast(`${articles.length} Artikel gespeichert.`); RENDER.veranstaltungen(); } catch (e) { fail(e); }
    });
  }

  /* =================== Artikel =================== */
  /* ---------- Artikeldarstellung: eigenes Bild, Symbol oder Kürzel ---------- */
  const artAbbr = n => { const w = String(n || '').replace(/[0-9,.()]+/g, ' ').trim().split(/\s+/).filter(Boolean); return esc(((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '').slice(1, 2))).toUpperCase()); };
  const artImgUrl = f => 'api/tablet/artikelbild/' + encodeURIComponent(f);
  function artTile(a, cls = '') {
    const inner = a.image ? `<img src="${artImgUrl(a.image)}" alt="">` : a.icon && window.ArtIcons && ArtIcons.has(a.icon) ? ArtIcons.svg(a.icon, cls.includes('lg') ? 40 : 20) : artAbbr(a.name);
    const st = !a.image && a.icon && window.ArtIcons && ArtIcons.has(a.icon) ? ` style="${ArtIcons.style(a.icon)}"` : '';
    return `<span class="atile ${cls}${a.image ? ' img' : ''}"${st}>${inner}</span>`;
  }
  /** Bild im Browser quadratisch verkleinern (384 px, eingepasst, transparenter Rand) → WebP oder PNG */
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type) && !/\.(png|jpe?g|webp|svg)$/i.test(file.name)) return reject(new Error('Bitte ein Bild als PNG, JPG, WebP oder SVG wählen.'));
      if (file.size > 2 * 1024 * 1024) return reject(new Error('Das Bild ist größer als 2 MB.'));
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        const S = 384, c = document.createElement('canvas'); c.width = S; c.height = S;
        const w = img.naturalWidth || S, h = img.naturalHeight || S, k = Math.min(S / w, S / h);
        const dw = Math.round(w * k), dh = Math.round(h * k);
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
        URL.revokeObjectURL(url);
        c.toBlob(b => { if (b && b.type === 'image/webp') resolve(b); else c.toBlob(p => p ? resolve(p) : reject(new Error('Bild konnte nicht verarbeitet werden.')), 'image/png'); }, 'image/webp', 0.9);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Die Datei lässt sich nicht als Bild öffnen.')); };
      img.src = url;
    });
  }

  function articleDialog(a, preset = {}, nested = false) {
    return new Promise(resolve => {
      const x = a || { name: '', category: '', price_cents: 150, crate_size: 20, min_stock: 0, target_stock: 0, track_stock: 1, active: 1, sort: 100, ...preset };
      const cats = [...new Set(cache.articles.map(y => y.category))];
      // Aus dem Beleg-Dialog heraus: eigenes Fenster darüber, damit der Beleg-Dialog erhalten bleibt
      const holder = nested ? document.createElement('div') : null;
      if (nested) { holder.className = 'overlay'; holder.style.zIndex = 30; holder.innerHTML = '<div class="dialog" id="artDlg"></div>'; document.body.appendChild(holder); }
      const box = nested ? holder.querySelector('#artDlg') : $('dialog');
      const html = `<h2>${a ? 'Artikel bearbeiten' : 'Neuer Artikel'}</h2>
        <datalist id="catList">${cats.map(c => `<option>${esc(c)}</option>`).join('')}</datalist>
        <div class="frm"><label class="f w3">Name (so steht er auf dem Tablet)<input name="name" value="${esc(x.name)}"></label>
          <label class="f w1">Kategorie<input name="category" list="catList" value="${esc(x.category)}" placeholder="z. B. Bier"></label>
          <label class="f w1">Preis €<input name="price" value="${centsToInput(x.price_cents)}" inputmode="decimal"></label>
          <label class="f w1">Einzelartikel je Gebinde<input name="crate_size" value="${x.crate_size}" inputmode="numeric"></label>
          <label class="f w1">Mindestbestand<input name="min_stock" value="${x.min_stock}" inputmode="numeric"></label>
          <label class="f w1">Bestellen bis<input name="target_stock" value="${x.target_stock || ''}" placeholder="2× Mindest" inputmode="numeric"></label></div>
        <p class="muted s" style="margin:6px 0 0">Mindestbestand und „Bestellen bis“ in Einzelartikeln (Flaschen, Tüten, Dosen …).</p>
        <div class="row" style="margin-top:12px"><label class="chk"><input type="checkbox" name="track_stock" ${x.track_stock ? 'checked' : ''}> Bestand führen</label>
          <label class="chk"><input type="checkbox" name="active" ${x.active ? 'checked' : ''}> Auf dem Tablet anzeigen</label></div>
        <div class="artlook"><div id="aPrevT"></div><div style="min-width:0">
          <div class="seg" id="aMode">${[['icon', 'Symbol'], ['image', 'Eigenes Bild'], ['none', 'Ohne']].map(([k, l]) => `<button type="button" data-m="${k}">${l}</button>`).join('')}</div>
          <div id="aModeIcon"><div class="icgrid">${(window.ArtIcons ? ArtIcons.groups : []).map(([g, gl]) => `<div class="gl">${esc(gl)}</div>${ArtIcons.list.filter(i => i.group === g).map(i => `<button type="button" data-ic="${i.key}" title="${esc(i.label)}" aria-label="${esc(i.label)}" style="${ArtIcons.style(i.key)}">${ArtIcons.svg(i.key, 22)}</button>`).join('')}`).join('')}</div></div>
          <div id="aModeImage"><div class="imgpick"><label class="btn"><input type="file" id="aImg" accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg" hidden>Bild wählen …</label><span class="muted s" id="aImgName"></span></div>
            <p class="muted s" style="margin:8px 0 0">PNG, JPG, WebP oder SVG, höchstens 2 MB. Wird automatisch quadratisch auf 384 × 384 Pixel verkleinert. Am besten ein Logo oder Foto auf hellem oder transparentem Hintergrund.</p></div>
          <div id="aModeNone"><p class="muted s" style="margin:0">Am Tablet steht dann ein Kürzel aus dem Namen in der Kachel.</p></div>
        </div></div>
        <div class="err" id="aErr" style="text-align:left"></div>
        <div class="btns">${a && !nested ? '<button class="btn danger" data-a="delete" style="margin-right:auto">Löschen</button>' : ''}<button class="btn ghost" data-a="cancel">Abbrechen</button><button class="btn primary" data-a="save">Speichern</button></div>`;
      if (nested) box.innerHTML = html; else dialog(html);
      const done = v => { if (nested) holder.remove(); else closeDialog(); resolve(v); };
      // Darstellung am Tablet: Symbol / eigenes Bild / ohne
      const look = { mode: x.image ? 'image' : x.icon ? 'icon' : (a ? 'none' : 'icon'), icon: x.icon || null, blob: null, previewUrl: null };
      const q = sel => box.querySelector(sel);
      const drawLook = () => {
        q('#aMode').querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === look.mode));
        ['Icon', 'Image', 'None'].forEach(k => q('#aMode' + k).classList.toggle('hidden', look.mode !== k.toLowerCase()));
        q('.icgrid').querySelectorAll('[data-ic]').forEach(b => b.classList.toggle('on', b.dataset.ic === look.icon));
        const nm = q('[name=name]').value;
        const t = look.mode === 'image' ? (look.previewUrl ? `<span class="atile lg"><img src="${look.previewUrl}" alt=""></span>` : x.image ? artTile({ image: x.image }, 'lg') : `<span class="atile lg">${artAbbr(nm)}</span>`)
          : look.mode === 'icon' && look.icon ? artTile({ icon: look.icon }, 'lg') : `<span class="atile lg">${artAbbr(nm)}</span>`;
        q('#aPrevT').innerHTML = t;
      };
      drawLook();
      q('[name=name]').addEventListener('input', drawLook);
      q('#aMode').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; look.mode = b.dataset.m; drawLook(); });
      q('.icgrid').addEventListener('click', e => { const b = e.target.closest('[data-ic]'); if (!b) return; look.icon = b.dataset.ic; drawLook(); });
      q('#aImg').addEventListener('change', async () => {
        const f = q('#aImg').files[0]; if (!f) return;
        q('#aErr').textContent = '';
        try { look.blob = await shrinkImage(f); if (look.previewUrl) URL.revokeObjectURL(look.previewUrl); look.previewUrl = URL.createObjectURL(look.blob); q('#aImgName').textContent = f.name; drawLook(); }
        catch (err) { look.blob = null; q('#aErr').textContent = err.message; q('#aImg').value = ''; }
      });
      box.onclick = async e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        if (b.dataset.a === 'cancel') return done(null);
        if (b.dataset.a === 'delete') {
          if (!await ask(`„${a.name}“ löschen?\n\nDer Artikel verschwindet aus allen Listen und vom Tablet. Wurde er schon verkauft oder geliefert, bleiben diese alten Buchungen für Bestand und Abrechnung erhalten.`)) return;
          try { await api('articles/' + a.id, 'DELETE'); await loadArticles(); toast('Artikel gelöscht.'); done(a.id); } catch (err) { box.querySelector('#aErr').textContent = err.message; }
          return;
        }
        const f = n => box.querySelector(`[name=${n}]`);
        const body = { name: f('name').value, category: f('category').value, price_cents: toCents(f('price').value || '0'), crate_size: Number(f('crate_size').value),
          min_stock: Number(f('min_stock').value) || 0, target_stock: Number(f('target_stock').value) || 0, track_stock: f('track_stock').checked, active: f('active').checked,
          icon: look.mode === 'icon' ? look.icon : look.mode === 'none' ? null : (look.icon || null) };
        if (look.mode === 'image' && !look.blob && !x.image) { box.querySelector('#aErr').textContent = 'Bitte ein Bild wählen – oder „Symbol“ bzw. „Ohne“.'; return; }
        try {
          const r = a ? await api('articles/' + a.id, 'PUT', body) : await api('articles', 'POST', body);
          const id = a ? a.id : r.id;
          if (look.mode === 'image' && look.blob) {
            const up = await fetch(`api/admin/articles/${id}/image`, { method: 'PUT', body: look.blob, headers: { 'Content-Type': look.blob.type || 'application/octet-stream', 'X-Clubwerk': '1' } });
            const d = await up.json().catch(() => ({}));
            if (!up.ok) throw new Error(d.error || 'Bild konnte nicht gespeichert werden.');
          } else if (look.mode !== 'image' && x.image) await api(`articles/${id}/image`, 'DELETE');
          await loadArticles();
          toast('Artikel gespeichert.');
          done(a ? a.id : r.id);
        } catch (err) { box.querySelector('#aErr').textContent = err.message; }
      };
    });
  }

  RENDER.artikel = async () => {
    await loadArticles();
    $('main').innerHTML = `<h2 class="page">Artikel</h2>
      <p class="lead">Die <b>Kategorie</b> fasst Artikel in der Abrechnung zusammen. Ihre Reihenfolge stellst du unter Verkauf › Einstellungen ein.</p>
      <div class="toolbar"><button class="btn primary" id="new">+ Neuer Artikel</button>
        <button class="btn ghost" id="aImp">Import …</button><a class="btn ghost" href="api/admin/articles/export.xlsx">Excel</a></div>
      <div class="scroll"><table class="tbl kompakt"><tr><th>Artikel</th><th>Kategorie</th><th class="r">Preis</th><th class="r hide-md">Gebinde</th><th class="r">Bestand</th><th class="r hide-md">Mindest</th><th class="r hide-md">bestellen bis</th><th>Status</th><th></th></tr>
      ${cache.articles.map(a => `<tr class="${a.active ? '' : 'off'}"><td><span class="art">${artTile(a)}<span>${esc(a.name)}</span></span></td><td>${esc(a.category)}</td><td class="r">${euro(a.price_cents)}</td><td class="r hide-md">${a.crate_size}</td>
        <td class="r k-lbl">${a.track_stock ? num(a.stock) : ''}</td><td class="r hide-md">${a.track_stock ? num(a.min_stock) : ''}</td><td class="r hide-md">${a.track_stock && a.target_stock ? num(a.target_stock) : ''}</td><td>${a.active ? '<span class="pill g">aktiv</span>' : '<span class="pill">ausgeblendet</span>'}</td>
        <td class="r"><button class="btn small" data-e="${a.id}">Bearbeiten</button></td></tr>`).join('')}</table></div>${cache.articles.length ? '' : '<p class="empty">Noch keine Artikel – oben „+ Neuer Artikel“ anlegen oder mit „Import …“ aus Excel einlesen.</p>'}`;
    $('new').onclick = async () => { if (await articleDialog(null)) RENDER.artikel(); };
    $('aImp').onclick = () => {
      dialog(`<h2>Artikel aus Excel importieren</h2>
        <p class="muted">Spalten <b>Artikel</b>, <b>Kategorie</b>, <b>Preis</b>, optional <b>ID</b>, <b>Gebinde</b>, <b>Bestand führen</b>, <b>Mindestbestand</b>, <b>Bestellen bis</b>, <b>Aktiv</b>.
          Erkannt wird ein vorhandener Artikel an seiner <b>ID</b> (Spalte aus „Als Excel herunterladen“), sonst am Namen. Neue Artikel bekommen immer eine neue ID – IDs werden nie doppelt vergeben.
          Weicht ein vorhandener Artikel ab, entscheidest du je Artikel, welche Fassung gilt.</p>
        <label class="f">Datei<input type="file" id="aFile" accept=".xlsx"></label>
        <div id="aPrev"></div>
        <label class="chk hidden" id="aHideL" style="margin-top:10px"><input type="checkbox" id="aHide"> <span id="aHideT"></span></label>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok" disabled>Übernehmen</button></div>`, true);
      $('c').onclick = closeDialog;
      let last = null; const choice = new Map();   // Artikel-ID → 'datei' | 'bestand'
      const send = async commit => {
        const take = [...choice].filter(([, v]) => v === 'datei').map(([k]) => k).join(',');
        const r = await fetch('api/admin/articles/import-excel' + (commit ? '?commit=1&take=' + take + ($('aHide').checked ? '&hideOthers=1' : '') : ''), { method: 'POST', body: $('aFile').files[0],
          headers: { 'Content-Type': 'application/octet-stream', 'X-Clubwerk': '1' } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Import fehlgeschlagen');
        return d;
      };
      const F = { name: 'Name', category: 'Kategorie', price_cents: 'Preis', crate_size: 'Gebinde', track_stock: 'Bestand führen', min_stock: 'Mindest', target_stock: 'Bestellen bis', active: 'Aktiv' };
      const fmt = (k, v) => k === 'price_cents' ? euro(v) : (k === 'track_stock' || k === 'active') ? (v ? 'ja' : 'nein') : esc(String(v));
      const open = () => last.rows.filter(r => r.status === 'ändern' && !choice.has(r.id)).length;
      const draw = () => {
        const d = last;
        const ch = d.rows.filter(r => r.status === 'ändern');
        $('aPrev').innerHTML = `<p><b>${d.newCount}</b> neu · <b>${ch.length}</b> vorhanden mit Abweichungen · ${d.rows.filter(r => r.status === 'unverändert').length} unverändert · ${d.rows.filter(r => !['neu', 'ändern', 'unverändert'].includes(r.status)).length} übersprungen</p>
          ${ch.length ? `<div class="impdecide"><div class="row" style="align-items:center;justify-content:space-between;margin:0 0 8px"><b>Vorhandene Artikel – welche Fassung soll gelten?</b>
            <span class="row" style="gap:8px"><button class="btn small" data-all="bestand">Überall Bestand behalten</button><button class="btn small" data-all="datei">Überall Datei übernehmen</button></span></div>
            ${ch.map(r => `<div class="impcard ${choice.has(r.id) ? 'done' : ''}"><div class="impname"><b>${esc(r.current.name)}</b> <span class="muted s">ID ${r.id} · erkannt an ${r.match === 'id' ? 'der ID' : 'dem Namen'}</span></div>
              <table class="tbl"><tr><th></th>${r.diff.map(k => `<th>${F[k]}</th>`).join('')}</tr>
                <tr><td class="muted">Bestand</td>${r.diff.map(k => `<td>${fmt(k, r.current[k])}</td>`).join('')}</tr>
                <tr><td class="muted">Datei</td>${r.diff.map(k => `<td><b>${fmt(k, r[k])}</b></td>`).join('')}</tr></table>
              <div class="seg" role="radiogroup" aria-label="Fassung für ${esc(r.current.name)}"><button type="button" data-pick="${r.id}" data-v="bestand" class="${choice.get(r.id) === 'bestand' ? 'on' : ''}">Bestand behalten</button><button type="button" data-pick="${r.id}" data-v="datei" class="${choice.get(r.id) === 'datei' ? 'on' : ''}">Aus Datei übernehmen</button></div></div>`).join('')}</div>` : ''}
          <details style="margin-top:10px"><summary class="muted">Alle Zeilen der Datei anzeigen</summary>
          <div class="scroll" style="max-height:240px"><table class="tbl"><tr><th class="r">Zeile</th><th>Artikel</th><th>Kategorie</th><th class="r">Preis</th><th>Status</th></tr>
            ${d.rows.map(r => `<tr class="${r.status === 'neu' || r.status === 'ändern' ? '' : 'off'}"><td class="r">${r.line}</td><td>${esc(r.name)}${r.id ? ` <span class="muted s">ID ${r.id}</span>` : ''}</td><td>${esc(r.category)}</td><td class="r">${Number.isFinite(r.price_cents) ? euro(r.price_cents) : '–'}</td>
              <td>${r.status === 'neu' ? '<span class="pill g">neu</span>' : r.status === 'ändern' ? '<span class="pill b">abweichend</span>' : esc(r.status)}</td></tr>`).join('')}</table></div></details>`;
        $('aHideL').classList.toggle('hidden', !d.others.length);
        $('aHideT').textContent = `Artikel, die nicht in der Datei stehen, ausblenden (${d.others.length}: ${d.others.slice(0, 6).join(', ')}${d.others.length > 6 ? ' …' : ''})`;
        const n = open();
        $('ok').disabled = n > 0 || !(d.newCount + ch.length + d.others.length);
        $('ok').textContent = n ? `Noch ${n} Artikel entscheiden` : 'Übernehmen';
      };
      $('aPrev').onclick = e => {
        const p = e.target.closest('[data-pick]'), all = e.target.closest('[data-all]');
        if (p) choice.set(Number(p.dataset.pick), p.dataset.v);
        if (all) last.rows.filter(r => r.status === 'ändern').forEach(r => choice.set(r.id, all.dataset.all));
        if (p || all) draw();
      };
      $('aFile').onchange = async () => {
        $('ok').disabled = true; choice.clear();
        try { last = await send(false); draw(); } catch (e) { $('aPrev').innerHTML = `<div class="banner r">${esc(e.message)}</div>`; }
      };
      $('ok').onclick = () => busy($('ok'), async () => {
        if (open()) return;
        try { const d = await send(true); closeDialog(); toast(`${d.newCount} neu, ${d.takenCount || 0} aus der Datei übernommen, ${d.changeCount - (d.takenCount || 0)} unverändert gelassen.`); RENDER.artikel(); } catch (e) { fail(e); }
      });
    };
    $('main').querySelectorAll('[data-e]').forEach(b => b.onclick = async () => {
      if (await articleDialog(cache.articles.find(a => a.id === Number(b.dataset.e)))) RENDER.artikel();
    });
  };

  /* =================== Verkauf › Einstellungen =================== */
  /* Karten nach 3.1: Grundregeln (Kategorien, Zuordnungen) · Tablet („Gerade oft hier“) · Einstellungen übertragen – jede Karte nur mit dem Recht, das der Server dafür verlangt */
  RENDER.vkeinst = async () => {
    const mayTop = can('einstellungen'), mayMap = can('lieferungen'), mayCat = can('artikel');
    const [st, map, cats] = await Promise.all([api('settings'), mayMap ? api('supplier-map') : null, mayCat ? api('categories') : null]);
    $('main').innerHTML = `<h2 class="page">Einstellungen</h2><p class="lead">Regeln für Artikel, Lieferungen und die Startseite am Tablet.</p>
      ${mayCat ? '<div class="card" id="vkCat"></div>' : ''}
      ${mayMap ? '<div class="card" id="vkMap"></div>' : ''}
      ${mayTop ? `<div class="card" id="vkTop"><h3>Gerade oft hier am Tablet</h3>
        <div class="row"><label class="f" style="flex:1;min-width:200px">Wie viele Namen (0 = ausblenden)<input id="topN" class="n" value="${st.topN}" inputmode="numeric"></label>
          <label class="f" style="flex:1;min-width:200px">Zeitraum (Tage)<input id="topDays" class="n" value="${st.topDays}" inputmode="numeric"></label></div>
        <p class="muted s">Oben auf der Startseite stehen die Mitglieder mit den meisten Buchungen im Zeitraum – alphabetisch, damit niemand eine Rangliste sieht. Tablets übernehmen die Änderung innerhalb einer Minute.</p>
        <div class="btns"><button class="btn primary" id="saveTop">Speichern</button></div></div>` : ''}
      ${mayTop ? '<div id="vkFunc"></div>' : ''}`;
    if (mayCat) {
      const el = $('vkCat'); let list = cats.map(c => ({ name: c.category, n: c.n, act: c.act }));
      const draw = () => {
        el.innerHTML = `<h3>Reihenfolge der Kategorien</h3>
          <p class="muted s" style="margin-top:0">So erscheinen die Kategorien am Tablet (von oben links nach unten rechts) und in Bestand, Abrechnung und Exporten. Die Artikel innerhalb einer Kategorie stehen alphabetisch.</p>
          ${list.length ? `<table class="tbl kompakt" id="coTbl">${list.map((c, i) => `<tr><td>${i + 1}. <b>${esc(c.name)}</b> <span class="muted s">${c.n} Artikel${c.act < c.n ? `, ${c.n - c.act} ausgeblendet` : ''}</span></td>
            <td class="r" style="white-space:nowrap"><button class="btn small" data-up="${i}" ${i ? '' : 'disabled'} aria-label="nach oben" style="width:46px;justify-content:center">▲</button>
              <button class="btn small" data-dn="${i}" ${i < list.length - 1 ? '' : 'disabled'} aria-label="nach unten" style="width:46px;justify-content:center">▼</button></td></tr>`).join('')}</table>`
            : '<p class="empty">Noch keine Artikel – die Kategorien entstehen mit dem ersten Artikel.</p>'}
          <div class="btns"><button class="btn ghost" id="coAlpha" style="margin-right:auto">Alphabetisch</button><button class="btn primary" id="coSave" ${list.length ? '' : 'disabled'}>Speichern</button></div>`;
        el.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); });
        el.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { const i = +b.dataset.dn; [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(); });
        $('coAlpha').onclick = () => { list.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })); draw(); };
        $('coSave').onclick = () => busy($('coSave'), async () => {
          try { await api('categories/order', 'PUT', { order: list.map(c => c.name) }); toast('Reihenfolge gespeichert – Tablets übernehmen sie beim nächsten Laden.'); } catch (e) { fail(e); }
        });
      };
      draw();
    }
    if (mayMap) {
      $('vkMap').innerHTML = `<h3>Gemerkte Zuordnungen von Lieferanten-Artikeln</h3>
        <p class="muted s" style="margin-top:0">Clubwerk merkt sich, welcher Artikel auf dem Beleg zu welchem Artikel in der App gehört. „Vergessen“ löscht nur die Zuordnung.</p>
        ${map.length ? `<div class="scroll" style="max-height:40vh"><table class="tbl kompakt"><tr><th>Lieferant</th><th>Art.-Nr.</th><th>Text auf dem Beleg</th><th>Artikel in der App</th><th class="r">Gebinde</th><th></th></tr>
          ${map.map(m => `<tr><td>${esc(m.supplier)}</td><td>${/^lidl:/.test(m.art_no) ? '' : esc(m.art_no)}</td><td class="k-weg">${esc(m.text || '')}</td><td>${m.article_id ? esc(m.article) : '<span class="muted">ignoriert</span>'}</td><td class="r k-lbl">${m.pack_size}</td>
            <td class="r"><button class="btn small ghost" data-sup="${esc(m.supplier)}" data-no="${esc(m.art_no)}">Vergessen</button></td></tr>`).join('')}</table></div>` : '<p class="empty">Noch keine – entsteht automatisch beim ersten Rechnungs-Upload unter Lager › Lieferungen.</p>'}`;
      $('vkMap').querySelectorAll('[data-sup]').forEach(b => b.onclick = async () => {
        await api('supplier-map', 'DELETE', { supplier: b.dataset.sup, artNo: b.dataset.no }).catch(fail); RENDER.vkeinst();
      });
    }
    if (mayTop) {
      $('saveTop').onclick = async () => {
        try { await api('settings', 'PUT', { topN: $('topN').value, topDays: $('topDays').value }); toast('Gespeichert.'); } catch (e) { fail(e); }
      };
      funcBox($('vkFunc'), 'getraenke', 'Verkauf', () => RENDER.vkeinst().catch(fail));
    }
  };

  /* =================== Konten =================== */
  RENDER.konten = async () => {
    await loadMembers();
    const pending = cache.members.filter(m => m.pending);
    const others = cache.members.filter(m => !m.pending && isPerson(m.kind));
    const mvOn = (cache.modules || []).includes('mitglieder');   // dann entstehen Mitglieder nur in der Mitgliederverwaltung
    // Diese Saison nicht da: kein Buchen, kein Eintrag auf einer Veranstaltungsliste seit Saisonbeginn
    // (nur Mitglieder, die schon länger als 60 Tage angelegt sind – sonst stünde nach einem Import jeder hier)
    const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const absent = others.filter(m => m.active && (!m.last_seen || m.last_seen.slice(0, 10) < cache.seasonStart) && m.created_at.slice(0, 10) < cutoff);
    const absentOpen = m => m.balance_cents || m.eventOpen_cents;
    const asKonten = Boolean(groupOf('konten'));
    $('main').innerHTML = `<h2 class="page">${asKonten ? 'Konten & PINs' : 'Mitglieder & Konten'}</h2>
      <p class="lead">${asKonten ? 'Konten für den Verkauf am Tablet: offene Beträge, PINs, Mannschaften, Sonderkonten. Neue Einträge vom Tablet bestätigst du hier.' : 'Neue Mitglieder tragen sich am Tablet selbst ein. Hier bestätigst du den Eintrag oder führst ihn mit einem vorhandenen Konto zusammen.'}</p>
      ${pending.length ? `<div class="card warnbox"><h3>Neu am Tablet eingetragen – bitte prüfen (${pending.length})</h3>
        <table class="tbl"><tr><th>Name (anpassbar)</th><th>eingetragen</th><th class="r">Buchungen</th><th></th></tr>
        ${pending.map(m => `<tr><td><input data-pn="${m.id}" value="${esc(m.name)}" style="min-width:220px"></td><td>${deTime(m.created_at)}</td><td class="r">${m.bookings}</td>
          <td class="r"><button class="btn small primary" data-ok="${m.id}">${mvOn ? 'Als „Kein Mitglied“ bestätigen' : 'Bestätigen'}</button>
            <button class="btn small" data-merge="${m.id}">Ist schon Mitglied …</button>
            ${m.bookings ? '' : `<button class="btn small danger" data-rm="${m.id}">Löschen</button>`}</td></tr>`).join('')}</table></div>` : ''}
      ${absent.length ? `<div class="card warnbox">
        <div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">Diese Saison nicht da (${absent.length})</h3>
          <div class="row"><button class="btn" id="abShow">${cache.showAbsent ? 'Liste zuklappen' : 'Liste anzeigen'}</button>
          ${cache.showAbsent && absent.some(m => !absentOpen(m)) ? `<button class="btn danger" id="abAll">Alle ${absent.filter(m => !absentOpen(m)).length} entfernen</button>` : ''}</div></div>
        ${cache.showAbsent ? `<p class="muted" style="margin:10px 0">Seit Saisonbeginn (${deDate(cache.seasonStart)}) nichts gebucht und auf keiner Veranstaltungsliste. „Entfernen“ löscht Mitglieder ohne jede Buchung; wer früher schon gebucht hat, wird nur ausgeblendet (die alten Abrechnungen bleiben erhalten, „Bearbeiten“ holt ihn zurück).</p>
          <table class="tbl"><tr><th>Name</th><th>zuletzt da</th><th>angelegt</th><th class="r">offen</th><th></th></tr>
          ${absent.map(m => `<tr><td>${pName(m)}</td><td>${m.last_seen ? deDate(m.last_seen.slice(0, 10)) : '<span class="muted">nie</span>'}</td><td>${deDate(m.created_at.slice(0, 10))}</td>
            <td class="r">${absentOpen(m) ? euro((m.balance_cents || 0) + (m.eventOpen_cents || 0)) : ''}</td>
            <td class="r">${absentOpen(m) ? '<span class="muted s">erst abrechnen</span>' : `<button class="btn small danger" data-abrm="${m.id}">${m.bookings ? 'Ausblenden' : 'Entfernen'}</button>`}</td></tr>`).join('')}</table>` : ''}</div>` : ''}
      <div class="toolbar"><button class="btn primary" id="mNew">${asKonten ? '+ Neues Konto' : '+ Neues Mitglied'}</button><button class="btn ghost" id="mXls">Import …</button><button class="btn ghost" id="mImp">Liste einfügen …</button></div>
      <div class="kpis">${(() => { const vis = cache.members.filter(m => !m.pending && m.active);
        const open = vis.reduce((a, m) => a + (m.balance_cents || 0), 0);
        return [['Aktive Mitglieder', vis.filter(m => m.kind === 'mitglied').length], ['Mannschaften & Gruppen', vis.filter(m => m.kind === 'mannschaft').length],
          ['Mit PIN geschützt', vis.filter(m => m.hasPin).length], ['Offen auf Konten', euro(open)]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join(''); })()}</div>
      <div class="filterbar"><label class="search"><span aria-hidden="true">${icon('suche', 16)}</span><input id="mSearch" placeholder="Name suchen" aria-label="Name suchen"></label>
        <div class="chips" id="mFilter" role="group" aria-label="Filter">${[['alle', 'Alle'], ['mitglied', 'Mitglieder'], ['nichtmitglied', 'Kein Mitglied'], ['mannschaft', 'Mannschaften'], ['sonder', 'Sonderkonten'], ['offen', 'Mit offenem Betrag'], ['aus', 'Ausgeblendet']]
          .filter(([k]) => (k !== 'sonder' || (cache.modules || []).includes('getraenke')) && (k !== 'nichtmitglied' || cache.members.some(m => m.kind === 'nichtmitglied' && !m.pending))).map(([k, l]) => `<button type="button" data-f="${k}" class="${(cache.mFilter || 'alle') === k ? 'on' : ''}" aria-pressed="${(cache.mFilter || 'alle') === k}">${l}<span class="cnt" data-cnt="${k}"></span></button>`).join('')}</div></div>
      <div class="mlayout"><div class="mlist"><div class="scroll"><table class="tbl sel kompakt" id="mTbl"></table></div><p class="empty hidden" id="mEmpty"></p></div><aside class="mdetail card" id="mDetail"></aside></div>`;
    const showAll = (cache.modules || []).includes('getraenke');
    const base = cache.members.filter(m => !m.pending && (showAll || (m.kind !== 'verein' && m.kind !== 'gast')));
    const FILTER = {
      alle: m => m.active, mitglied: m => m.active && m.kind === 'mitglied', nichtmitglied: m => m.active && m.kind === 'nichtmitglied', mannschaft: m => m.active && m.kind === 'mannschaft',
      sonder: m => m.active && (m.kind === 'verein' || m.kind === 'gast'), offen: m => (m.balance_cents || 0) > 0, aus: m => !m.active,
    };
    const ini = m => esc(initials(isPerson(m.kind) ? m.name : m.name.replace(/[()]/g, '')));
    const pinPill = m => m.hasPin ? `<span class="pill g">${m.kind === 'mannschaft' ? 'vom Vorstand' : 'gesetzt'}</span>${m.pinLocked ? ' <span class="pill r">gesperrt</span>' : ''}` : m.kind === 'mannschaft' ? '<span class="pill r">fehlt</span>' : '<span class="muted s">ohne</span>';
    // Detailkarte rechts neben der Liste; bei schmalen Fenstern (≤ 1100 px) als Dialog, damit die Liste nicht springt
    const narrow = () => window.matchMedia('(max-width: 1100px)').matches;
    const detail = asDialog => {
      const m = cache.members.find(x => x.id === cache.mSel);
      const el = $('mDetail');
      el.classList.toggle('empty', !m);
      if (!m) { el.innerHTML = `<div class="mempty"><span class="mi">${icon('konten', 22)}</span><b>Mitglied auswählen</b><span class="muted s">Klick auf einen Namen zeigt hier Konto, PIN und Aktionen.</span></div>`; return; }
      const html = `<div class="mhead"><span class="av lg">${ini(m)}</span><div style="min-width:0"><h3>${pName(m)}</h3><div class="row" style="gap:6px"><span class="pill">${KIND[m.kind]}</span>${m.active ? '<span class="pill g">aktiv</span>' : '<span class="pill">ausgeblendet</span>'}</div></div></div>
        <dl class="facts">
          <div><dt>Offen</dt><dd class="${m.balance_cents > 0 ? 'neg' : ''}">${euro(m.balance_cents || 0)}</dd></div>
          ${m.eventOpen_cents ? `<div><dt>Veranstaltungen offen</dt><dd>${euro(m.eventOpen_cents)}</dd></div>` : ''}
          <div><dt>PIN</dt><dd>${pinPill(m)}${pinInfo(m)}</dd></div>
          <div><dt>Zuletzt da</dt><dd>${m.last_seen ? deDate(m.last_seen.slice(0, 10)) : '<span class="muted">noch nie</span>'}</dd></div>
          <div><dt>Buchungen gesamt</dt><dd>${m.bookings || 0}</dd></div>
          <div><dt>Angelegt</dt><dd>${m.created_at ? deDate(m.created_at.slice(0, 10)) : ''}</dd></div>
        </dl>
        <div class="mact">${can('buchungen') ? `<button class="btn" data-log="${m.id}">Buchungen</button>` : ''}<button class="btn primary" data-ed="${m.id}">Bearbeiten</button>
          ${m.hasPin && m.kind !== 'mannschaft' ? `<button class="btn ghost" data-pin="${m.id}">PIN zurücksetzen</button>` : ''}</div>`;
      if (asDialog) {
        dialog(`<div class="mdetail" style="position:static;padding:0">${html}</div><div class="btns"><button class="btn ghost" id="mdClose">Schließen</button></div>`);
        $('mdClose').onclick = closeDialog;
        $('dialog').onclick = e => { if (e.target.closest('[data-ed],[data-pin],[data-log]')) { closeDialog(); $('main').onclick(e); } };   // Aktionen laufen über die Seite
      } else el.innerHTML = html;
    };
    const draw = () => {
      const q = $('mSearch').value.trim().toLowerCase();
      const f = FILTER[cache.mFilter || 'alle'] || FILTER.alle;
      const match = m => !q || m.name.toLowerCase().includes(q) || lastFirst(m.name, m.kind).toLowerCase().includes(q);
      Object.keys(FILTER).forEach(k => { const c = $('main').querySelector(`[data-cnt="${k}"]`); if (c) c.textContent = base.filter(m => FILTER[k](m) && match(m)).length; });
      const rows = base.filter(m => f(m) && match(m));
      $('mTbl').innerHTML = `<tr><th>Name</th><th>Typ</th><th>PIN</th><th>Zuletzt da</th><th class="r">Offen</th></tr>` +
        (rows.length ? rows.map(m => `<tr data-sel="${m.id}" class="${m.active ? '' : 'off'} ${cache.mSel === m.id ? 'on' : ''}" tabindex="0"><td><span class="who"><span class="av">${ini(m)}</span><b>${pName(m)}</b></span></td><td>${KIND[m.kind]}</td>
          <td>${pinPill(m)}</td><td class="k-weg">${m.last_seen ? deDate(m.last_seen.slice(0, 10)) : ''}</td><td class="r k-lbl">${m.balance_cents ? euro(m.balance_cents) : ''}</td></tr>`).join('') : '');
      $('mTbl').classList.toggle('hidden', !rows.length);
      $('mEmpty').classList.toggle('hidden', !!rows.length);
      $('mEmpty').textContent = base.length ? 'Keine Treffer – Suche oder Filter ändern.' : (asKonten ? 'Noch keine Konten – oben „+ Neues Konto“ anlegen.' : 'Noch keine Mitglieder – oben „+ Neues Mitglied“ anlegen.');
      detail();
    };
    draw();
    $('mSearch').oninput = draw;
    $('mFilter').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; cache.mFilter = b.dataset.f; $('mFilter').querySelectorAll('[data-f]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); draw(); };
    const pick = tr => { cache.mSel = Number(tr.dataset.sel); $('mTbl').querySelectorAll('tr[data-sel]').forEach(x => x.classList.toggle('on', x === tr)); detail(narrow()); };
    $('mTbl').onclick = e => { const tr = e.target.closest('tr[data-sel]'); if (tr) pick(tr); };
    $('mTbl').onkeydown = e => { const tr = e.target.closest('tr[data-sel]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(tr); } };
    if ($('abShow')) $('abShow').onclick = () => { cache.showAbsent = !cache.showAbsent; RENDER.konten(); };
    const removeAbsent = async (ids, text) => {
      if (!await ask(text)) return;
      try {
        const r = await api('members/remove-inactive', 'POST', { ids });
        toast([r.deleted && `${r.deleted} gelöscht`, r.hidden && `${r.hidden} ausgeblendet`, r.skipped.length && `${r.skipped.length} übersprungen`].filter(Boolean).join(', ') || 'Nichts geändert.');
        refreshBadges(); RENDER.konten();
      } catch (e) { fail(e); }
    };
    if ($('abAll')) $('abAll').onclick = () => { const ids = absent.filter(m => !absentOpen(m)).map(m => m.id);
      removeAbsent(ids, `${ids.length} Mitglieder entfernen, die diese Saison nicht da waren?\n\nOhne Buchungen → gelöscht, sonst ausgeblendet.`); };
    $('main').querySelectorAll('[data-abrm]').forEach(b => b.onclick = () => { const m = absent.find(x => x.id === Number(b.dataset.abrm));
      removeAbsent([m.id], m.bookings ? `${m.name} ausblenden? Die bisherigen Buchungen bleiben erhalten.` : `${m.name} löschen?`); });
    $('mNew').onclick = () => {
      dialog(`<h2>${mvOn ? 'Neues Konto' : 'Neues Mitglied oder Konto'}</h2>
        ${mvOn ? '<p class="muted" style="margin-top:0">Mitglieder legst du in der Mitgliederverwaltung an (mit Beitrag und Zahlungsdaten). Hier entstehen Konten für den Verkauf, zum Beispiel „Kein Mitglied“ für Trainer: Sie buchen am Tablet mit PIN und zahlen unter Abrechnung bar oder mit Karte.</p>' : ''}
        <div class="row"><label class="f" style="flex:1;min-width:220px">Name<input id="mName" placeholder="Vorname Nachname" autocomplete="off"></label>
        <label class="f">Typ<select id="mKind">${Object.entries(KIND).filter(([k]) => !(mvOn && k === 'mitglied')).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label></div>
        <label class="f hidden" id="mPinL" style="margin-top:12px">PIN der Mannschaft (Pflicht)<input id="mPin" inputmode="numeric" maxlength="6" placeholder="4–6 Ziffern" style="width:170px" autocomplete="off"></label>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="mAdd">Anlegen</button></div>`);
      $('c').onclick = closeDialog; setTimeout(() => $('mName').focus(), 50);
      $('mKind').onchange = () => $('mPinL').classList.toggle('hidden', $('mKind').value !== 'mannschaft');
      $('mName').onkeydown = e => { if (e.key === 'Enter') $('mAdd').click(); };
      $('mAdd').onclick = () => busy($('mAdd'), async () => { try { const r = await api('members', 'POST', { name: $('mName').value, kind: $('mKind').value, pin: $('mPin').value }); closeDialog(); toast('Angelegt.'); cache.mSel = r.id; RENDER.konten(); } catch (e) { fail(e); } });
    };
    $('mXls').onclick = () => {
      dialog(`<h2>Mitglieder aus Excel importieren</h2>
        <p class="muted">Excel-Datei (.xlsx) mit den Spalten <b>Vorname</b> und <b>Nachname</b> (Überschrift in der ersten Zeile). Optional Spalte <b>Typ</b> = „Mannschaft“ für Mannschaften/Gruppen (Name dann in „Nachname“) und Spalte <b>PIN</b> mit der Mannschafts-PIN (4–6 Ziffern; fehlt sie, bitte danach unter „Bearbeiten“ vergeben). Weitere Spalten werden ignoriert, vorhandene Namen übersprungen.
          <a href="api/admin/members/import-vorlage.xlsx" style="color:var(--green);font-weight:600">Vorlage herunterladen</a></p>
        <label class="f">Datei<input type="file" id="xlsFile" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
        <div id="xlsPrev"></div>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok" disabled>Anlegen</button></div>`);
      $('c').onclick = closeDialog;
      const send = async commit => {
        const f = $('xlsFile').files[0];
        const r = await fetch('api/admin/members/import-excel' + (commit ? '?commit=1' : ''), { method: 'POST', body: f,
          headers: { 'Content-Type': 'application/octet-stream', 'X-Clubwerk': '1' } });
        const d = await r.json().catch(() => ({}));
        if (r.status === 401) { showLogin(); throw new Error('Bitte anmelden.'); }
        if (!r.ok) throw new Error(d.error || 'Import fehlgeschlagen');
        return d;
      };
      $('xlsFile').onchange = async () => {
        $('ok').disabled = true; $('xlsPrev').innerHTML = '<p class="muted">Wird gelesen …</p>';
        try {
          const d = await send(false);
          const cnt = st => d.rows.filter(r => r.status === st).length;
          const skip = d.rows.filter(r => r.status !== 'neu');
          $('xlsPrev').innerHTML = `<p><b>${d.newCount}</b> neue Mitglieder · ${cnt('vorhanden')} schon vorhanden${cnt('ausgeblendet') ? ` · ${cnt('ausgeblendet')} ausgeblendet` : ''}${cnt('doppelt') ? ` · ${cnt('doppelt')} doppelt in der Datei` : ''}${cnt('unvollständig') + cnt('ungültig') ? ` · ${cnt('unvollständig') + cnt('ungültig')} unvollständig/ungültig` : ''}</p>
            <div class="scroll" style="max-height:280px"><table class="tbl"><tr><th class="r">Zeile</th><th>Name</th><th>Status</th></tr>
            ${[...d.rows.filter(r => r.status === 'neu'), ...skip].map(r => `<tr${r.status === 'neu' ? '' : ' class="off"'}><td class="r">${r.line}</td><td>${esc(lastFirst(r.name, r.kind))}${r.kind === 'mannschaft' ? ` <span class="pill">Mannschaft</span>${r.pinMissing ? ' <span class="pill r">PIN fehlt</span>' : ''}` : ''}</td><td>${r.status === 'neu' ? '<span class="pill g">neu</span>' : esc(r.status)}</td></tr>`).join('')}</table></div>`;
          $('ok').textContent = d.newCount ? `${d.newCount} Mitglieder anlegen` : 'Nichts Neues';
          $('ok').disabled = !d.newCount;
        } catch (e) { $('xlsPrev').innerHTML = `<div class="banner r">${esc(e.message)}</div>`; }
      };
      $('ok').onclick = () => busy($('ok'), async () => {
        try { const d = await send(true); closeDialog(); toast(`${d.added} Mitglieder angelegt.`); RENDER.konten(); } catch (e) { fail(e); }
      });
    };
    $('mImp').onclick = () => {
      const mv = (cache.modules || []).includes('mitglieder');   // mit Mitgliederverwaltung entstehen Mitglieder nur dort
      dialog(`<h2>${mv ? 'Liste „Kein Mitglied“ einfügen' : 'Mitgliederliste einfügen'}</h2><p class="muted">Ein Name pro Zeile, z. B. aus Excel kopiert („Vorname Nachname“). Vorhandene Namen werden übersprungen.${mv ? ' Die Namen werden als „Kein Mitglied“ angelegt (z. B. Trainer). Mitglieder legst du in der Mitgliederverwaltung an.' : ''}</p>
        <label class="f"><textarea id="impText" rows="12"></textarea></label>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok">Übernehmen</button></div>`);
      $('c').onclick = closeDialog;
      $('ok').onclick = () => busy($('ok'), async () => {
        try { const r = await api('members/import', 'POST', { text: $('impText').value, kind: mv ? 'nichtmitglied' : 'mitglied' }); closeDialog(); toast(`${r.added} angelegt, ${r.skipped} schon vorhanden.`); RENDER.konten(); } catch (e) { fail(e); }
      });
    };
    $('main').onclick = async e => {
      const ok = e.target.closest('[data-ok]'), mg = e.target.closest('[data-merge]'), rm = e.target.closest('[data-rm]');
      const pin = e.target.closest('[data-pin]'), ed = e.target.closest('[data-ed]'), log = e.target.closest('[data-log]');
      if (log) { openLog(Number(log.dataset.log)); return; }
      try {
        if (ok) {
          await api(`members/${ok.dataset.ok}/confirm`, 'POST', { name: $('main').querySelector(`[data-pn="${ok.dataset.ok}"]`).value, kind: mvOn ? 'nichtmitglied' : 'mitglied' });
          toast('Bestätigt.'); refreshBadges(); RENDER.konten();
        }
        if (rm) {
          if (!await ask('Diesen Eintrag löschen?')) return;
          await api('members/' + rm.dataset.rm, 'DELETE'); refreshBadges(); RENDER.konten();
        }
        if (mg) {
          const m = pending.find(x => x.id === Number(mg.dataset.merge));
          dialog(`<h2>„${esc(lastFirst(m.name, m.kind))}“ zusammenführen</h2>
            <p class="muted">Die ${m.bookings} ${m.bookings === 1 ? 'Buchung' : 'Buchungen'} werden auf das gewählte Konto verschoben, der doppelte Eintrag wird gelöscht.</p>
            <label class="f">Richtiges Konto<input id="mgSearch" placeholder="Name suchen"></label>
            <label class="f" style="margin-top:8px"><select id="mgInto" size="8" style="min-height:200px"></select></label>
            <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok2">Zusammenführen</button></div>`);
          const fill = () => {
            const q = $('mgSearch').value.trim().toLowerCase();
            $('mgInto').innerHTML = others.filter(o => !q || o.name.toLowerCase().includes(q) || lastFirst(o.name, o.kind).toLowerCase().includes(q)).map(o => `<option value="${o.id}">${pName(o)}</option>`).join('');
          };
          const ln = m.name.split(' ').pop(); $('mgSearch').value = ln; fill();
          $('mgSearch').oninput = fill;
          $('c').onclick = closeDialog;
          $('ok2').onclick = () => busy($('ok2'), async () => {
            if (!$('mgInto').value) { toast('Bitte ein Konto wählen.', true); return; }
            try { const r = await api(`members/${m.id}/merge`, 'POST', { intoId: Number($('mgInto').value) }); closeDialog(); toast(`${r.moved} ${r.moved === 1 ? 'Buchung' : 'Buchungen'} verschoben.`); refreshBadges(); RENDER.konten(); } catch (err) { fail(err); }
          });
        }
        if (pin) {
          if (!await ask('PIN zurücksetzen?\n\nDas Mitglied legt beim nächsten Mal am Tablet eine neue PIN fest. Bis dahin sind Buchen und Stornieren von Plätzen am Tablet gesperrt.')) return;
          await api(`members/${pin.dataset.pin}/reset-pin`, 'POST', {}); toast('PIN zurückgesetzt.'); RENDER.konten();
        }
        if (ed) {
          const m = cache.members.find(x => x.id === Number(ed.dataset.ed));
          const special = m.kind === 'verein' || m.kind === 'gast';
          dialog(`<h2>Konto bearbeiten</h2><div class="row"><label class="f" style="flex:1">Name<input id="eName" value="${esc(m.name)}"></label>
            <label class="f">Typ<select id="eKind">${Object.entries(KIND).filter(([k]) => !(mvOn && k === 'mitglied' && m.kind !== 'mitglied')).map(([k, l]) => `<option value="${k}" ${k === m.kind ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
            <div class="${m.kind === 'mannschaft' ? '' : 'hidden'}" id="ePinRow" style="margin-top:12px"><label class="f">PIN der Mannschaft ${m.hasPin ? '(leer = unverändert)' : '(Pflicht)'}<input id="ePin" inputmode="numeric" maxlength="6" placeholder="4–6 Ziffern" style="width:170px" autocomplete="off"></label>
              <p class="muted s" style="margin:6px 0 0">Mannschaftskonten buchen nur mit dieser PIN. Sie wird hier vom Vorstand vergeben und kann am Tablet nicht geändert werden.</p></div>
            <label class="chk" style="margin-top:12px"><input type="checkbox" id="eAct" ${m.active ? 'checked' : ''}> Auf dem Tablet anzeigen</label>
            ${isPerson(m.kind) && !m.pending && (cache.appModules || []).length ? '<div class="card soft" id="eApp" style="margin:14px 0 0"><p class="muted">Lade …</p></div>' : ''}
            <div class="btns">${special ? '' : '<button class="btn danger" id="eDel" style="margin-right:auto">Löschen</button>'}<button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok3">Speichern</button></div>`);
          $('c').onclick = closeDialog;
          $('eKind').onchange = () => $('ePinRow').classList.toggle('hidden', $('eKind').value !== 'mannschaft');
          if ($('eApp')) appBox($('eApp'), m.id).catch(fail);
          $('ok3').onclick = () => busy($('ok3'), async () => {
            try { await api('members/' + m.id, 'PUT', { name: $('eName').value, kind: $('eKind').value, active: $('eAct').checked, pin: $('ePin').value }); closeDialog(); RENDER.konten(); } catch (err) { fail(err); }
          });
          if ($('eDel')) $('eDel').onclick = () => deleteMember(m, () => RENDER.konten());
        }
      } catch (err) { fail(err); }
    };
  };

  /* =================== Mitglieder-App (ein QR-Code, eine PIN) =================== */
  const DEVSTAT = { gekoppelt: ['g', 'Handy freigeschaltet'], eingeladen: ['a', 'QR-Code offen'], abgelaufen: ['r', 'Einladung abgelaufen'], gesperrt: ['r', 'gesperrt (falsche PINs)'] };
  const INVKIND = { qr: 'QR-Code offen', mail: 'E-Mail-Einladung offen', brief: 'Einladungsbrief offen' };
  const hoursTxt = h => (h >= 48 ? `${h / 24} Tage` : h === 1 ? '1 Stunde' : `${h} Stunden`);
  const devPill = d => (d ? `<span class="pill ${DEVSTAT[d.status][0]}">${d.status === 'eingeladen' ? INVKIND[d.kind] || DEVSTAT.eingeladen[1] : DEVSTAT[d.status][1]}</span>${d.remote ? ' <span class="pill a" title="Von unterwegs ohne SMS-Code gekoppelt – Türen und Beregnung schalten sich beim ersten Öffnen im Vereins-WLAN frei">Türen/Beregnung erst im WLAN</span>' : ''}${d.verified === 'sms' ? ' <span class="pill" title="Beim Freischalten mit dem Code per SMS bestätigt">per SMS bestätigt</span>' : ''}${d.oldAddress ? ' <span class="pill a" title="Gekoppelt, bevor die öffentliche Adresse eingetragen war – funktioniert nur im Vereins-WLAN">alte Adresse – neuer QR-Code nötig</span>' : ''}` : '<span class="pill">ohne Handy</span>');
  /** Entfernen: nur das Handy oder ganz aus der App? → 'device' | 'all' | null */
  function askRemove(name, hasDevice) {
    return askBoxOpen(`<h2>${esc(name)} entfernen</h2><p>Was soll passieren?</p>
        <div class="rmopts">${hasDevice ? `<button class="rmopt" id="rmDev"><b>Nur Handy entfernen</b><span>Die App funktioniert auf dem Handy sofort nicht mehr. Die Freischaltungen bleiben – mit einem neuen QR-Code ist das Mitglied wieder dabei.</span></button>` : ''}
          <button class="rmopt danger" id="rmAll"><b>Ganz aus der App entfernen</b><span>${hasDevice ? 'Handy und alle Freischaltungen' : 'Alle Freischaltungen'} werden gelöscht. Das Mitglied verschwindet aus der Liste und kann später wieder freigeschaltet werden.</span></button></div>
        <div class="btns"><button class="btn ghost" id="askNo">Abbrechen</button></div>`, null, done => {
      $('askNo').onclick = () => done(null);
      if ($('rmDev')) $('rmDev').onclick = () => done('device');
      $('rmAll').onclick = () => done('all');
    });
  }
  /** Entfernen ausführen – true, wenn etwas entfernt wurde */
  async function appRemove(memberId, name, hasDevice) {
    const v = await askRemove(name, hasDevice);
    if (!v) return false;
    try {
      if (v === 'device') { await api(`app/member/${memberId}/device`, 'DELETE'); toast('Handy entfernt.'); }
      else { await api(`app/member/${memberId}`, 'DELETE'); toast(`${name} ist nicht mehr in der App.`); }
      return true;
    } catch (e) { fail(e); return false; }
  }
  const appUrl = info => (info.url || `${info.https ? 'https' : 'http'}://${location.hostname}:${info.port || 5001}`).replace(/\/+$/, '');

  /** QR-Code für ein Mitglied erzeugen und anzeigen. after() wird nach „Fertig“ aufgerufen. */
  async function appInvite(memberId, after) {
    try {
      const info = await api('app/member/' + memberId);
      if (info.device && info.device.status === 'gekoppelt' && !await ask(`Neuer QR-Code für ${info.name}?\n\nDas bisher freigeschaltete Handy (${info.device.label || 'Gerät'}) verliert sofort den Zugang.`, { ok: 'Neuen QR-Code erzeugen', danger: true })) return;
      const r = await api(`app/member/${memberId}/invite`, 'POST', {});
      const url = `${appUrl(info)}/#i=${r.token}`;
      const q = await api('qr', 'POST', { url });
      const mods = info.modules.filter(m => (info.granted || {})[m.id]).map(m => m.label || m.name);
      dialog(`<h2>QR-Code für ${esc(lastFirst(r.member))}</h2>
        <p class="muted">Mit dem Handy von ${esc(r.member)} <b>direkt hier am Bildschirm</b> scannen (Kamera-App). Gilt <b>einmal</b> und ${hoursTxt(r.expiresHours)}. Dabei legt das Mitglied seine persönliche App-PIN fest. Den Code nicht abfotografieren oder weiterschicken – wer ihn zuerst scannt, bekommt den Zugang.
        ${mods.length ? `Freigeschaltet: <b>${mods.map(esc).join(', ')}</b>.` : '<b>Noch kein Bereich freigeschaltet</b> – bitte danach unter „Mitglieder-App“ ankreuzen.'}</p>
        ${!info.url ? `<div class="banner a" style="font-weight:400">Die Adresse wurde automatisch ermittelt: <b>${esc(appUrl(info))}</b>.${/\.local$/i.test(location.hostname) ? ' Adressen mit „.local“ öffnen manche Handys nicht.' : ''} Bitte einmal unter <b>Mitglieder-App → Adresse der App</b> die Adresse eintragen, unter der Handys im Vereins-WLAN Home Assistant erreichen (z. B. ohne „.local“ oder mit IP-Adresse), dann einen neuen QR-Code erzeugen.</div>` : ''}
        <div class="qrbox">${q.svg}</div>
        ${r.allowLink ? `<label class="f">Oder diesen Link schicken (nur an das Mitglied selbst)<input id="qrUrl" readonly value="${esc(url)}"></label>` : ''}
        <div class="btns">${r.allowLink ? '<button class="btn" id="qrCopy">Link kopieren</button>' : ''}<button class="btn" id="qrPrint">Drucken</button><button class="btn primary" id="qrX">Fertig</button></div>`);
      if ($('qrCopy')) $('qrCopy').onclick = () => copyText(url, 'Link kopiert.');
      $('qrPrint').onclick = () => {
        printHtml(`<div class="pr" style="text-align:center;padding-top:20mm"><h1>${esc(cache.settings.clubName || '')}</h1><p style="font-size:14pt">Mitglieder-App für <b>${esc(r.member)}</b></p>
          <div style="width:80mm;height:80mm;margin:10mm auto">${q.svg}</div><p>Mit der Handy-Kamera scannen, PIN festlegen, fertig.<br>Gilt einmal und bis ${new Date(r.expiresAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} Uhr. Bitte persönlich übergeben.</p></div>`);
      };
      $('qrX').onclick = () => { closeDialog(); if (after) after(); };
    } catch (e) { fail(e); }
  }

  /** Briefe mit QR-Code drucken (eine Seite je Mitglied) */
  function printLetters(letters) {
    const club = cache.settings.clubName || '';
    printHtml(letters.map(l => `<div class="pr letter"><h1>${esc(club)}</h1><p style="font-size:14pt">Mitglieder-App für <b>${esc(l.name)}</b></p>
      <div style="width:70mm;height:70mm;margin:8mm auto">${l.svg}</div>
      <ol><li>Den QR-Code mit der Handy-Kamera scannen.</li><li>Falls gefragt: den Code aus der SMS eingeben.</li><li>Eine eigene PIN für die App festlegen (4 bis 6 Ziffern).</li><li>Die Seite auf den Home-Bildschirm legen – fertig.</li></ol>
      <p style="margin-top:8mm">Gilt einmal und bis ${new Date(l.expiresAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} Uhr. Persönlich – bitte nicht weitergeben.</p></div>`).join(''));
  }
  /** Einladung per E-Mail an ein Mitglied */
  async function inviteByMail(memberId, info) {
    if (info.device && info.device.status === 'gekoppelt' && !await ask(`Einladung per E-Mail an ${info.name}?\n\nDas bisher freigeschaltete Handy (${info.device.label || 'Gerät'}) verliert sofort den Zugang.`, { ok: 'Einladung schicken', danger: true })) return false;
    const r = await api(`app/member/${memberId}/invite-mail`, 'POST', {});
    toast(`Einladung an ${r.to} geschickt – gilt ${r.days} Tage.${r.localOnly ? ' Hinweis: Ohne „Von unterwegs erreichbar“ funktioniert der Link nur im Vereins-WLAN.' : ''}`, false, 6000);
    return true;
  }
  /** „Einladen …“: QR-Code am Bildschirm, per E-Mail, als Brief – und Freigabe eines von unterwegs gekoppelten Handys */
  async function inviteMenu(memberId, after) {
    try {
      const info = await api('app/member/' + memberId), iv = info.invite || {};
      const pick = await askBoxOpen(`<h2>${esc(lastFirst(info.name))} einladen</h2><p>Wie soll die Einladung zum Mitglied kommen?</p>
          <div class="rmopts"><button class="rmopt" data-v="qr"><b>QR-Code hier am Bildschirm</b><span>Das Mitglied scannt ihn mit dem Handy – am sichersten, weil es dabei vor Ort ist.</span></button>
            <button class="rmopt" data-v="mail" ${iv.mail ? '' : 'disabled'}><b>Per E-Mail schicken</b><span>${iv.mail ? `An ${esc(iv.email)}, gilt ${iv.days} Tage.${iv.sms ? ' Von unterwegs mit Code per SMS.' : ' Türen und Beregnung erst nach dem ersten Öffnen im Vereins-WLAN.'}` : !iv.email ? 'Keine E-Mail-Adresse in der Mitgliederverwaltung hinterlegt.' : 'Erst ein Postfach einrichten (Einstellungen → Postfach).'}</span></button>
            <button class="rmopt" data-v="brief"><b>Einladungsbrief drucken</b><span>QR-Code mit Anleitung auf Papier – zum Mitgeben oder per Post. Gilt ${iv.days || 7} Tage.</span></button>
            ${info.device && info.device.remote ? '<button class="rmopt" data-v="trust"><b>Türen und Beregnung jetzt freigeben</b><span>Das Handy wurde von unterwegs ohne SMS-Code gekoppelt. Nur freigeben, wenn sicher ist, dass es dem Mitglied gehört.</span></button>' : ''}</div>
          <div class="btns"><button class="btn" data-v="">Abbrechen</button></div>`, '', done => {
        $('askBox').querySelectorAll('[data-v]').forEach(b => { b.onclick = () => done(b.dataset.v); });
      });
      if (!pick) return;
      if (pick === 'qr') return appInvite(memberId, after);
      if (pick === 'mail') { if (await inviteByMail(memberId, info) && after) after(); return; }
      if (pick === 'trust') { await api(`app/member/${memberId}/trust`, 'POST', {}); toast('Freigegeben – Türen und Beregnung funktionieren jetzt auch auf diesem Handy.'); if (after) after(); return; }
      if (pick === 'brief') {
        if (info.device && info.device.status === 'gekoppelt' && !await ask(`Einladungsbrief für ${info.name}?\n\nDas bisher freigeschaltete Handy (${info.device.label || 'Gerät'}) verliert sofort den Zugang.`, { ok: 'Brief erzeugen', danger: true })) return;
        const r = await api('app/invites', 'POST', { kind: 'brief', ids: [memberId], force: true });
        if (!r.letters.length) return toast(r.skipped.length ? r.skipped[0].reason : 'Kein Brief erzeugt.', true);
        printLetters(r.letters); if (after) after();
      }
    } catch (e) { fail(e); }
  }
  /** Sammelversand: Einladungen per E-Mail oder als Briefe für viele Mitglieder */
  function bulkInvites(r) {
    const mail = new Set(r.mailIds || []);
    const all = [...r.rows.map(x => ({ id: x.member_id, name: x.name, kind: x.kind, dev: x.device, inApp: true })), ...r.members.map(m => ({ id: m.id, name: m.name, kind: m.kind || 'mitglied', dev: null, inApp: false }))];
    let showNew = false, sel = new Set(all.filter(x => x.inApp && !(x.dev && x.dev.status === 'gekoppelt')).map(x => x.id));
    const list = () => all.filter(x => x.inApp || showNew);
    const draw = () => {
      const L = list(), n = L.filter(x => sel.has(x.id)).length, nm = L.filter(x => sel.has(x.id) && mail.has(x.id)).length;
      dialog(`<h2>Einladungen verschicken</h2>
        <p class="muted" style="margin-top:0">Jedes ausgewählte Mitglied bekommt einen persönlichen Link (gilt ${r.security.inviteMailDays} Tage, einmal). Mitglieder mit bereits freigeschaltetem Handy werden übersprungen.${r.security.sms && r.security.sms.ready ? ' Von unterwegs wird mit einem Code per SMS bestätigt.' : ' Türen und Beregnung schalten sich bei Kopplung von unterwegs erst im Vereins-WLAN frei.'}</p>
        <div class="row" style="align-items:center;gap:8px 18px;margin-bottom:8px"><label class="chk"><input type="checkbox" id="ivAll" ${n && n === L.filter(x => !(x.dev && x.dev.status === 'gekoppelt')).length ? 'checked' : ''}> alle ohne Handy</label>
          ${r.members.length ? `<label class="chk"><input type="checkbox" id="ivNew" ${showNew ? 'checked' : ''}> Auch Mitglieder, die noch nicht in der App sind (${r.members.length})</label>` : ''}</div>
        <div class="invlist">${L.map(x => { const paired = x.dev && x.dev.status === 'gekoppelt'; return `<label><input type="checkbox" data-iv="${x.id}" ${sel.has(x.id) ? 'checked' : ''} ${paired ? 'disabled' : ''}><b>${pName(x)}</b>
          <span>${paired ? '<span class="pill g">Handy freigeschaltet</span>' : x.inApp ? devPill(x.dev) : '<span class="pill">neu in der App</span>'}</span><span class="muted s">${mail.has(x.id) ? 'E-Mail ✓' : 'keine E-Mail'}</span></label>`; }).join('') || '<p class="empty">Niemand.</p>'}</div>
        ${!r.security.mailReady ? '<p class="muted s" style="margin:10px 0 0">Für E-Mails erst ein Postfach einrichten (Einstellungen → Postfach).</p>' : n > nm ? `<p class="muted s" style="margin:10px 0 0">${n - nm} ohne E-Mail-Adresse – für sie Briefe drucken.</p>` : ''}
        <div class="btns"><button class="btn" id="ivX">Abbrechen</button><button class="btn" id="ivBrief" ${n ? '' : 'disabled'}>${n} ${n === 1 ? 'Brief' : 'Briefe'} drucken</button><button class="btn primary" id="ivMail" ${nm && r.security.mailReady ? '' : 'disabled'}>${nm} ${nm === 1 ? 'E-Mail' : 'E-Mails'} schicken</button></div>`, true);
      $('ivX').onclick = closeDialog;
      $('ivAll').onchange = () => { list().forEach(x => { if (!(x.dev && x.dev.status === 'gekoppelt')) { if ($('ivAll').checked) sel.add(x.id); else sel.delete(x.id); } }); draw(); };
      if ($('ivNew')) $('ivNew').onchange = () => { showNew = $('ivNew').checked; if (!showNew) r.members.forEach(m => sel.delete(m.id)); draw(); };
      $('dialog').querySelectorAll('[data-iv]').forEach(c => { c.onchange = () => { if (c.checked) sel.add(+c.dataset.iv); else sel.delete(+c.dataset.iv); draw(); }; });
      const run = kind => busy($(kind === 'mail' ? 'ivMail' : 'ivBrief'), async () => {
        const ids = list().filter(x => sel.has(x.id) && (kind === 'brief' || mail.has(x.id))).map(x => x.id);
        if (!await ask(kind === 'mail' ? `${ids.length} ${ids.length === 1 ? 'Einladung' : 'Einladungen'} per E-Mail verschicken?` : `${ids.length} ${ids.length === 1 ? 'Einladungsbrief' : 'Einladungsbriefe'} erzeugen und drucken?`, { ok: kind === 'mail' ? 'Verschicken' : 'Drucken' })) return;
        try {
          const x = await api('app/invites', 'POST', { kind, ids });
          closeDialog();
          if (kind === 'brief' && x.letters.length) printLetters(x.letters);
          toast(`${x.done.length} ${kind === 'mail' ? (x.done.length === 1 ? 'E-Mail verschickt' : 'E-Mails verschickt') : (x.done.length === 1 ? 'Brief erzeugt' : 'Briefe erzeugt')}${x.skipped.length ? ` · ${x.skipped.length} übersprungen (${x.skipped.slice(0, 3).map(y => `${y.name}: ${y.reason}`).join('; ')}${x.skipped.length > 3 ? ' …' : ''})` : ''}.${x.localOnly && kind === 'mail' ? ' Ohne „Von unterwegs erreichbar“ funktionieren die Links nur im Vereins-WLAN.' : ''}`, Boolean(x.skipped.length && !x.done.length), 8000);
          RENDER.app().catch(fail);
        } catch (e) { fail(e); }
      });
      $('ivMail').onclick = () => run('mail'); $('ivBrief').onclick = () => run('brief');
    };
    draw();
  }

  /** Freischaltungen eines Mitglieds (für den Bearbeiten-Dialog) – speichert sofort */
  async function appBox(el, memberId) {
    const info = await api('app/member/' + memberId);
    if (info.kind === 'nichtmitglied') info.modules = info.modules.filter(m => m.nonMembers);   // Kein Mitglied (z. B. Trainer): nur Buchen, Türen, Beregnung
    if (!info.modules.length) { el.remove(); return; }
    el.innerHTML = `<h3>Mitglieder-App</h3><p class="muted s" style="margin:0 0 8px">Ein QR-Code, eine PIN – das Mitglied sieht in der App nur die angehakten Bereiche. Änderungen hier gelten sofort.</p>
      <div class="row" style="align-items:center;margin-bottom:8px">${devPill(info.device)}${info.device && info.device.label ? `<span class="muted s">${esc(info.device.label)}${info.device.last_used ? ' · zuletzt ' + deTime(info.device.last_used) : ''}</span>` : ''}</div>
      ${info.modules.map(m => { const a = info.access[m.id], g = (info.granted || {})[m.id]; return `<div class="row" style="align-items:center;min-height:42px"><label class="chk" style="min-width:150px"><input type="checkbox" data-am="${m.id}" ${g ? 'checked' : ''}> ${esc(m.label || m.name)}</label>
        ${m.options && m.options.profiles && g ? (() => { const pf = m.options.profiles.find(p => p.id === (a ? a.profile : m.options.defaultProfile)); return `<span class="pill" title="${esc(pf && pf.text || '')}">${esc(pf ? pf.name : '')}</span>${m.options.profilesPage && can(m.options.profilesPerm || m.perm) ? ` <a href="#" class="s" data-aplink="${esc(m.options.profilesPage)}">ändern unter ${esc(m.options.profilesLabel || m.label || m.name)}</a>` : ''}`; })() : ''}
        ${a && a.blocked && (!m.open || info.kind === 'nichtmitglied') ? '<span class="pill r">gesperrt</span>' : ''}${g ? flagChks(m, a, `${memberId}:${m.id}`) : ''}</div>`; }).join('')}
      <div class="row" style="margin-top:8px"><button class="btn small primary" id="apQr">Einladen …</button>${info.device || Object.keys(info.access || {}).length ? '<button class="btn small" id="apRm">Entfernen …</button>' : ''}</div>`;
    el.dataset.nodirty = '1';
    const reload = () => appBox(el, memberId).catch(fail);
    el.querySelectorAll('[data-am]').forEach(c => { c.onchange = async () => { try { const rr = await api(`app/member/${memberId}/access`, 'PUT', { module: c.dataset.am, grant: c.checked }); toast(rr.reinvite ? 'Freigeschaltet. Das Handy wurde aus Sicherheitsgründen entkoppelt – bitte einen neuen QR-Code erzeugen.' : c.checked ? 'Freigeschaltet.' : 'Freischaltung entzogen.'); reload(); } catch (e) { fail(e); c.checked = !c.checked; } }; });
    el.querySelectorAll('[data-aplink]').forEach(l => { l.onclick = e => { e.preventDefault(); closeDialog(); go(l.dataset.aplink); }; });
    bindFlags(el);
    $('apQr').onclick = () => inviteMenu(memberId, reload);
    if ($('apRm')) $('apRm').onclick = async () => { if (await appRemove(memberId, info.name, Boolean(info.device))) reload(); };
  }

  /** zusätzliche Haken eines Bereichs je Mitglied (Hook accessOptions().flags, z. B. Buchen → „Gebühren zeigen“) – gleiche Zeile wie „auch unterwegs“ */
  /* Zusatzschalter je Bereich als dezente Schaltflächen-Pills neben dem Haken (grün = an) */
  const flagChks = (m, a, key) => ((m.options && m.options.flags) || []).map(f => { const on = Boolean(a && a.flags && a.flags[f.id]); return `<button type="button" class="pill tg${on ? ' on' : ''}" data-af="${key}:${esc(f.id)}" aria-pressed="${on}" title="${esc(f.title || '')}">${esc(f.label)}</button>`; }).join('');
  const togglePill = async (b, save) => { const on = !b.classList.contains('on'); b.disabled = true; try { await save(on); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } catch (e) { fail(e); } finally { b.disabled = false; } };
  const bindFlags = (root, after) => root.querySelectorAll('[data-af]').forEach(b => { b.onclick = () => togglePill(b, async on => {
    const [id, mod, flag] = b.dataset.af.split(':');
    await api(`app/member/${id}/access`, 'PUT', { module: mod, flags: { [flag]: on } }); toast(on ? 'Eingeschaltet.' : 'Ausgeschaltet.'); if (after) after();
  }); });

  /** Push-Benachrichtigungen: Anlässe freigeben (Recht „Einstellungen“), Stand, Testnachricht */
  async function pushCard(el) {
    const r = await api('push');
    const mayEdit = can('einstellungen');
    const byMod = [];
    for (const e of r.events) { let g = byMod.find(x => x.m === e.moduleName); if (!g) { g = { m: e.moduleName, ev: [] }; byMod.push(g); } g.ev.push(e); }
    el.innerHTML = `<h3>Benachrichtigungen</h3>
      <p class="muted s" style="margin-top:0">Kurze Hinweise aufs Handy (Push) aus der Mitglieder-App – auf dem iPhone in der Home-Bildschirm-App ab iOS 16.4, auf Android im Browser. Hier legst du fest, welche Anlässe es im Verein gibt; jedes Mitglied schaltet Push je Handy nur ein oder aus – welche Hinweise kommen, entscheidest du hier zentral. Es werden nur Titel und ein Satz gesendet, nichts PIN-Pflichtiges.</p>
      <div class="row" style="gap:6px 22px;margin-bottom:6px"><span class="pill${r.subs ? ' g' : ''}">${r.subs} ${r.subs === 1 ? 'Handy' : 'Handys'} angemeldet · ${r.members} ${r.members === 1 ? 'Mitglied' : 'Mitglieder'}</span></div>
      ${byMod.map(g => `<p class="muted s" style="margin:10px 0 4px"><b>${esc(g.m)}</b></p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px 24px;align-items:start">${g.ev.map(e => `<label class="chk" style="align-items:flex-start;margin:0"><input type="checkbox" data-pe="${esc(e.key)}" ${e.on ? 'checked' : ''} ${mayEdit ? '' : 'disabled'}><span>${esc(e.label)}${e.desc ? `<br><span class="muted s">${esc(e.desc)}</span>` : ''}${e.lead ? `<br><span class="muted s">${esc(e.lead.label || 'Vorlauf')}: <input type="number" min="5" max="10080" step="5" data-pl="${esc(e.key)}" value="${e.lead}" ${mayEdit ? '' : 'disabled'} style="width:90px;height:36px;margin-top:6px"> Minuten</span>` : ''}</span></label>`).join('')}</div>`).join('')}
      ${mayEdit ? `<div class="row" style="justify-content:space-between;align-items:flex-end;margin-top:14px">
        <div class="row" style="align-items:flex-end"><label class="f" style="width:260px">Testnachricht an<select id="pshWho"><option value="">– Mitglied wählen –</option>${r.subscribed.map(m => `<option value="${m.id}">${pName(m)}</option>`).join('')}</select></label><button class="btn" id="pshTest" ${r.subscribed.length ? '' : 'disabled'} title="${r.subscribed.length ? '' : 'Noch kein Handy für Push angemeldet'}">Senden</button></div>
        <button class="btn primary" id="pshSave">Speichern</button></div>` : ''}
      ${r.recent.length ? `<details style="margin-top:10px"><summary class="muted s">Zuletzt gesendet (${r.recent.length})</summary><table class="tbl s"><tr><th>Zeit</th><th>Mitglied</th><th>Anlass</th><th>Titel</th><th>Ergebnis</th></tr>${r.recent.map(x => `<tr><td class="nw">${deTime(x.ts)}</td><td>${esc(x.member ? lastFirst(x.member, x.kind) : '–')}</td><td>${esc(x.event)}</td><td>${esc(x.title || '')}</td><td>${x.ok ? '<span class="pill g">gesendet</span>' : `<span class="pill r">${esc(x.info || 'Fehler')}</span>`}</td></tr>`).join('')}</table></details>` : ''}`;
    if (!mayEdit) return;
    $('pshSave').onclick = () => busy($('pshSave'), async () => {
      const events = {};
      el.querySelectorAll('[data-pe]').forEach(c => { events[c.dataset.pe] = { on: c.checked }; });
      el.querySelectorAll('[data-pl]').forEach(i => { events[i.dataset.pl] = { ...(events[i.dataset.pl] || {}), lead: +i.value }; });
      try { await api('push', 'PUT', { events }); toast('Gespeichert.'); pushCard(el).catch(fail); } catch (e) { fail(e); }
    });
    $('pshTest').onclick = () => busy($('pshTest'), async () => {
      const id = +$('pshWho').value; if (!id) { toast('Bitte ein Mitglied wählen.', true); return; }
      try { const x = await api('push/test', 'POST', { memberId: id }); toast(x.ok ? `Testnachricht gesendet (${x.sent}).` : 'Nicht gesendet' + (x.skipped ? ': ' + x.skipped : ' – kein Handy mit Abo.'), !x.ok); pushCard(el).catch(fail); } catch (e) { fail(e); }
    });
  }
  /** SMS-Stick für den zweiten Faktor: Anschluss wählen, prüfen, einschalten, Test-SMS */
  async function smsCard(el) {
    const x = await api('app/sms');
    const st = x.status;
    const opts = [...new Set([x.device, ...x.candidates].filter(Boolean))];
    el.innerHTML = `<h3>Bestätigung per SMS <span class="pill ${x.ready ? 'g' : ''}" style="margin-left:6px">${x.ready ? 'an' : 'aus'}</span></h3>
      <p class="muted s" style="margin-top:0">Zweiter Faktor für Einladungen per E-Mail oder Brief: Wer die App <b>von unterwegs</b> freischaltet, bekommt einen Code per SMS an die Handynummer aus der Mitgliederverwaltung. Dafür steckt ein LTE-USB-Stick mit SIM-Karte (ohne SIM-PIN) am Home-Assistant-Rechner – ohne Internet, ohne fremden Dienst. Ohne SMS (oder ohne Handynummer) schalten sich Türen und Beregnung erst beim ersten Öffnen im Vereins-WLAN frei.</p>
      <div class="row" style="align-items:flex-end;gap:10px"><label class="f" style="flex:1;min-width:240px">Anschluss des Sticks<select id="smsDev"><option value="">– wählen –</option>${opts.map(d => `<option value="${esc(d)}" ${d === x.device ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
        <button class="btn" id="smsFind" type="button">Anschlüsse suchen</button><button class="btn primary" id="smsSave" type="button">Speichern</button></div>
      ${st ? `<div class="row" style="margin-top:10px;gap:6px;align-items:center">${st.ok ? '<span class="pill g">bereit</span>' : `<span class="pill r">${esc(st.error || 'nicht bereit')}</span>`}${st.model ? `<span class="pill">${esc(st.model)}</span>` : ''}${st.operator ? `<span class="pill">${esc(st.operator)}</span>` : ''}${st.signal != null ? `<span class="pill">Empfang ${st.signal} %</span>` : ''}</div>` : ''}
      <div class="row" style="align-items:center;gap:10px;margin-top:12px"><label class="chk"><input type="checkbox" id="smsOn" ${x.on ? 'checked' : ''} ${x.device ? '' : 'disabled'}> SMS-Bestätigung einschalten</label></div>
      <div class="row" style="align-items:flex-end;gap:10px;margin-top:12px"><label class="f" style="width:240px">Test an Handynummer<input id="smsNo" inputmode="tel" placeholder="0170 1234567"></label><button class="btn" id="smsTest" type="button" ${x.device ? '' : 'disabled'}>Test-SMS senden</button></div>
      <p class="muted s" style="margin:10px 0 0">Geeignet sind LTE-Sticks mit seriellem Anschluss (AT-Befehle), nicht solche im „HiLink“-/Router-Modus. Nach dem Einstecken das Add-on einmal neu starten, dann „Anschlüsse suchen“. Je Mitglied höchstens 3 SMS am Tag.</p>`;
    $('smsFind').onclick = () => busy($('smsFind'), async () => {
      try { const d = await api('app/sms/detect', 'POST', {}); const ok = d.ports.filter(p => p.answers);
        if (!d.ports.length) return toast('Kein serieller Anschluss gefunden – ist der Stick eingesteckt und das Add-on danach neu gestartet?', true);
        $('smsDev').innerHTML = '<option value="">– wählen –</option>' + d.ports.map(p => `<option value="${esc(p.device)}">${esc(p.device)}${p.answers ? ' – antwortet' : ''}</option>`).join('');
        if (ok.length) $('smsDev').value = ok[0].device;
        toast(ok.length ? `${ok.length} Anschluss/Anschlüsse antworten – der erste ist ausgewählt.` : 'Anschlüsse gefunden, aber keiner antwortet auf AT-Befehle.', !ok.length);
      } catch (e) { fail(e); } });
    $('smsSave').onclick = () => busy($('smsSave'), async () => { try { await api('app/sms', 'PUT', { device: $('smsDev').value }); toast('Gespeichert.'); smsCard(el).catch(fail); } catch (e) { fail(e); } });
    $('smsOn').onchange = async () => { try { await api('app/sms', 'PUT', { on: $('smsOn').checked }); toast($('smsOn').checked ? 'SMS-Bestätigung eingeschaltet.' : 'SMS-Bestätigung ausgeschaltet.'); smsCard(el).catch(fail); } catch (e) { fail(e); $('smsOn').checked = !$('smsOn').checked; } };
    $('smsTest').onclick = () => busy($('smsTest'), async () => { try { const t = await api('app/sms/test', 'POST', { number: $('smsNo').value }); toast(`Test-SMS an ${t.to} verschickt.`); } catch (e) { fail(e); } });
  }
  RENDER.app = async () => {
    const r = await api('app');
    // Reiter nach Recht: Mitglieder freischalten (Mitglieder anlegen oder Recht eines Bereichs) · Bereiche, Benachrichtigungen, Name (Mitglieder-App einrichten) · Verbindung, Sicherheit (Einstellungen)
    const mayMem = r.mayMembers !== false, mayCfg = can('app') || can('einstellungen'), mayNet = can('einstellungen');
    const mods = r.modules;
    const oldN = r.rows.filter(x => x.device && x.device.oldAddress).length;
    const FIL = { alle: () => true, mit: x => x.device && x.device.status === 'gekoppelt', ohne: x => !x.device || x.device.status !== 'gekoppelt', eing: x => x.device && x.device.status === 'eingeladen', wlan: x => x.device && x.device.remote, alt: x => x.device && x.device.oldAddress };
    let filt = FIL[cache.apFilter] ? cache.apFilter : 'alle';
    // abgelehnte Tunnel-Anfrage der letzten 24 Stunden: Hinweis, damit der Vorstand ein falsch erkanntes Cloudflared-Add-on bemerkt
    const rj = r.tunnel.lastReject && Date.now() - Date.parse(r.tunnel.lastReject.at) < 24 * 3600000 ? r.tunnel.lastReject : null;
    $('main').innerHTML = `<h2 class="page">Mitglieder-App</h2>
      <p class="lead">Mitglieder bekommen <b>eine Einladung</b> (QR-Code, E-Mail oder Brief), nutzen <b>eine PIN</b> und sehen in der App, was für sie freigeschaltet ist.</p>
      ${mayCfg ? `<div class="card" id="apSet" data-set="einstellungen"><h3>Adresse & Aussehen</h3>
        <div class="frm"><label class="f w3">Adresse im Vereins-WLAN<input id="apUrl" ${can('einstellungen') ? '' : 'disabled title="Nur mit dem Recht „Einstellungen“"'} value="${esc(r.lanUrl || '')}" placeholder="${r.https ? 'https' : 'http'}://${esc(location.hostname)}:${r.port || 5001}"></label>
          <label class="f w1">Name auf dem Homescreen<input id="apName" maxlength="20" value="${esc(r.name)}"></label>
        ${mayNet ? `<label class="f w3">Öffentliche Adresse der App<input id="apExtUrl" ${can('einstellungen') ? '' : 'disabled'} value="${esc(r.tunnel.url)}" placeholder="https://app.meinverein.de"></label>
          <label class="chk w1" style="height:40px"><input type="checkbox" id="apExtOn" ${can('einstellungen') ? '' : 'disabled'} ${r.tunnel.on ? 'checked' : ''}> Von unterwegs erreichbar</label>` : ''}
        </div>
        <div class="btns"><a class="btn" id="apTest" target="_blank" rel="noopener">Testen ↗</a>${mayNet ? `<button class="btn" id="apExtTest" ${can('einstellungen') && r.tunnel.url ? '' : 'disabled'}>Verbindung prüfen</button>` : ''}<button class="btn primary" id="apSave">Speichern</button></div>
        ${!r.lanUrl && !(r.tunnel && r.tunnel.on) ? `<div class="banner a" style="margin:10px 0 0;font-weight:400">Noch keine Adresse eingetragen – im QR-Code landet <b>${r.https ? 'https' : 'http'}://${esc(location.hostname)}:${r.port || 5001}</b>. ${/\.local$/i.test(location.hostname) ? 'Adressen mit „.local“ öffnen manche Handys nicht – besser ohne „.local“ (z. B. <b>' + (r.https ? 'https' : 'http') + '://' + esc(location.hostname.replace(/\.local$/i, '')) + ':' + (r.port || 5001) + '</b>) oder mit der IP-Adresse von Home Assistant.' : ''}</div>` : ''}
        <p class="muted s" style="margin:8px 0 0">${r.tunnel && r.tunnel.on ? `<span>Im QR-Code landet die öffentliche Adresse ${esc(r.url)} – die Adresse hier nutzt die App im Vereinsheim als lokale Route (nur mit https).</span>` : '<span>Diese Adresse landet im QR-Code.</span>'} Leer lassen = Adresse, unter der die Verwaltung gerade geöffnet ist, mit Port ${r.port || 5001}. ${r.https ? 'Mit HTTPS hier den Namen eintragen, für den das Zertifikat gilt (z. B. <code>https://dein-verein.duckdns.org:' + (r.port || 5001) + '</code>) – mit einer IP-Adresse meldet das Handy einen Zertifikatsfehler.' : `Bei Fernzugriff (z. B. Nabu Casa) oder wenn Handys „.local“-Adressen nicht öffnen, hier die Adresse im Vereins-WLAN eintragen – den Gerätenamen ohne „.local“ (z. B. <code>http://homeassistant:${r.port || 5001}</code>) oder die IP-Adresse (z. B. <code>http://192.168.178.20:${r.port || 5001}</code>).`} Mit „Testen“ prüfen.</p>
        ${mayNet ? `<p class="muted s" style="margin:12px 0 0"><span class="pill ${r.tunnel.on ? 'g' : ''}">Von unterwegs ${r.tunnel.on ? 'an' : 'aus'}</span></p>
        <p class="muted s" style="margin-top:0">Über einen <b>Cloudflare Tunnel</b> wird nur die Mitglieder-App aus dem Internet erreichbar – ohne offenen Port am Router. Verwaltung, Tablet und Beregnung bleiben im Vereins-WLAN, auch wenn der Tunnel falsch eingestellt ist.</p>
        ${rj ? `<div class="banner a" style="margin:10px 0 0;font-weight:400">${rj.why === 'aus' ? `Zuletzt wurde eine Tunnel-Anfrage von ${esc(rj.ip)} abgelehnt (${esc(deTime(rj.at))}), weil der externe Zugang ausgeschaltet war.`
          : rj.why === 'direkt' ? `Zuletzt wurde eine direkte Anfrage aus dem Internet von ${esc(rj.ip)} abgewiesen (${esc(deTime(rj.at))}). Das deutet auf eine Portfreigabe am Router hin – bitte dort entfernen. Von unterwegs ist nur der Cloudflare Tunnel vorgesehen.`
          : `Zuletzt wurde eine Tunnel-Anfrage von ${esc(rj.ip)} abgelehnt (${esc(deTime(rj.at))}). Kommt sie vom Cloudflared-Add-on, unten unter „Tunnel-Quelle“ diese Adresse übernehmen.`}</div>` : ''}
        <details style="margin-top:10px"><summary>So richtest du den Zugang von unterwegs ein</summary>
        <ol class="muted s" style="margin:12px 0 0;padding-left:18px;line-height:1.6">
          <li>Kostenloses Konto bei Cloudflare, eure Domain dort verwalten lassen (z. B. <code>meinverein.de</code>).</li>
          <li>Cloudflare → Zero Trust → Networking → Tunnels → „Tunnel erstellen“ (Cloudflared, Docker) → Token kopieren.</li>
          <li>In Home Assistant das Add-on <b>Cloudflared</b> installieren, den Token unter „Tunnel token“ eintragen, starten.</li>
          <li>Im Tunnel unter „Routes“ → „Add route“ → „Published application“ anlegen: <code>app.meinverein.de</code> → Dienst-URL <code>${r.https ? 'https' : 'http'}://${/^\d+\.\d+\.\d+\.\d+$/.test(location.hostname) ? esc(location.hostname) : 'IP-Adresse-von-Home-Assistant'}:${r.port || 5001}</code>${r.https ? ', unter „TLS“ den Ursprungs-Servernamen (Name eures Zertifikats) eintragen' : ''}. <b>Nur diesen Port</b> freigeben.</li>
          <li>Hier die Adresse eintragen, einschalten, „Verbindung prüfen“ – neue QR-Codes enthalten dann die öffentliche Adresse und funktionieren im WLAN und unterwegs.</li></ol>
        </details>
        <p class="muted s" style="margin:8px 0 0">Bereits gekoppelte Handys behalten die alte Adresse – für unterwegs bitte einen neuen QR-Code erzeugen.${oldN ? ` <b>${oldN === 1 ? '1 Handy mit alter Adresse' : `${oldN} Handys mit alter Adresse`}</b> – Filter „alte Adresse“ unten.` : ''}</p>
        ` : ''}</div>` : ''}
      ${r.tunnel.on && r.mayExt ? `<div class="card" id="apSrc" data-set="einstellungen"><h3>Tunnel-Quelle</h3>
        <p class="muted s" style="margin:0 0 8px">Von welcher Adresse im Home-Assistant-Netz der Cloudflare Tunnel ankommt. Festgelegt glaubt die App die Absenderangabe des Tunnels nur noch dieser einen Adresse – auch nicht mehr dem Proxy-Add-on aus der Add-on-Konfiguration; kein anderes Add-on kann sich dann als Tunnel ausgeben. Empfohlen, sobald der Tunnel läuft. Startet das Cloudflared-Add-on später unter einer anderen Adresse, steht oben „abgelehnt“ mit der neuen Adresse – dann hier neu festlegen.</p>
        <div class="row" style="align-items:center;gap:10px">${r.tunnel.src ? `<span class="pill g">Festgelegt: ${esc(r.tunnel.src)}</span><button class="btn" id="apSrcOff" type="button">Wieder jede Adresse im Add-on-Netz zulassen</button>`
          : r.tunnel.lastOk ? `<span class="pill">Zuletzt gesehen: ${esc(r.tunnel.lastOk.ip)}</span><button class="btn primary" id="apSrcSet" type="button" data-ip="${esc(r.tunnel.lastOk.ip)}">Nur diese Quelle zulassen</button>`
          : '<span class="muted s">Noch keine Anfrage über den Tunnel seit dem letzten Neustart – einmal die öffentliche Adresse aufrufen, dann diese Seite neu laden.</span>'}
          ${r.tunnel.lastReject && r.tunnel.lastReject.why === 'quelle' && r.tunnel.src ? `<button class="btn" id="apSrcNew" type="button" data-ip="${esc(r.tunnel.lastReject.ip)}">Neue Quelle ${esc(r.tunnel.lastReject.ip)} übernehmen</button>` : ''}</div></div>` : ''}
      ${mayNet ? `<div class="card" id="apSec" data-set="einstellungen"><h3>Sicherheit</h3>
        <div class="row" style="align-items:flex-end">
          <label class="f" style="width:200px">QR-Code gültig<select id="apHours" ${can('einstellungen') ? '' : 'disabled'}>${[1, 24, 168].map(h => `<option value="${h}" ${r.security.inviteHours === h ? 'selected' : ''}>${hoursTxt(h)}</option>`).join('')}</select></label>
          <label class="f" style="width:200px">E-Mail/Brief gültig<select id="apDays" ${can('einstellungen') ? '' : 'disabled'}>${[2, 7, 14].map(d => `<option value="${d}" ${r.security.inviteMailDays === d ? 'selected' : ''}>${d} Tage</option>`).join('')}</select></label>
          <label class="f" style="flex:1;min-width:240px">Warnung bei gesperrtem Handy an${r.security.mailReady ? '' : ' (erst Postfach einrichten)'}<input id="apMail" ${can('einstellungen') ? '' : 'disabled'} type="email" value="${esc(r.security.mailTo)}" placeholder="vorstand@verein.de"></label>
          <button class="btn primary" id="apSecSave" ${can('einstellungen') ? '' : 'disabled'}>Speichern</button></div>
        <label class="chk" style="margin-top:12px"><input type="checkbox" id="apLink" data-nodirty ${can('einstellungen') ? '' : 'disabled'} ${r.security.allowLink ? 'checked' : ''}> QR-Code auch als Link zum Weiterschicken anbieten (weniger sicher)</label>
        <div class="row" style="margin-top:12px;gap:8px">
          <span class="pill ${r.https ? 'g' : 'a'}">${r.https ? 'HTTPS an' : 'ohne HTTPS'}</span>
          <span class="muted s">${r.https ? 'Die App ist verschlüsselt.' : 'Im WLAN unverschlüsselt – HTTPS in Home Assistant unter Add-on → Konfiguration → „HTTPS für alle Geräte“ einschalten (Anleitung).'} Nach 5 falschen PINs ist das Handy 5 Minuten gesperrt, ab dem 10. Fehlversuch 30 Minuten, nach ${r.security.blockAfter} ganz – dann hilft nur ein neuer QR-Code.</span></div></div>` : ''}
      ${can('einstellungen') ? '<div class="card" id="smsCard" data-nodirty data-set="einstellungen"><h3>Bestätigung per SMS</h3><p class="muted s" style="margin-top:0">Lade …</p></div>' : ''}
      ${mayCfg && mods.length ? `<div class="card" id="apAreas" data-nodirty data-set="bereiche"><h3>Bereiche der App</h3>
        <p class="muted s" style="margin-top:0">Welche Bereiche die App zeigt, wer sie sieht, womit sie startet und in welcher Reihenfolge sie stehen.</p>
        <table class="tbl kompakt" id="apAreaTbl"><tr><th>Bereich</th><th>Für wen</th>${mayNet ? '<th>Von unterwegs</th>' : ''}<th>Beim Freischalten</th><th>Start</th><th>Reihenfolge</th></tr><tbody id="bgRows"></tbody></table>
        <p class="muted s" style="margin:10px 0 0">Aus = der Bereich ist für alle weg, Freischaltungen bleiben erhalten. „Von unterwegs“: ohne Haken nur im Vereins-WLAN.${mayNet ? ` ${!r.tunnel.on ? '<span class="pill">Tunnel aus</span> Alle Bereiche gelten als im Vereinsheim genutzt.' : r.tunnel.lanHttps ? '<span class="pill g">Lokale Route eingerichtet</span>' : '<span class="pill a">Lokale Route fehlt</span> Über die öffentliche Adresse gelten diese Bereiche im Vereinsheim als „unterwegs“.'}` : ''}</p>
        ${r.kontoOn ? `<label class="chk" style="margin-top:12px"><input type="checkbox" id="bgKonto" ${r.formeKonto ? 'checked' : ''}> „Für mich“ zeigt auch das offene Thekenkonto (noch nicht abgerechnete Buchungen)</label>` : ''}
        <div class="btns"><button class="btn primary" id="bgSave">Speichern</button></div></div>` : ''}
      ${mayCfg ? `<div class="card" id="pushCard" data-nodirty data-set="push"><h3>Benachrichtigungen</h3><p class="muted s" style="margin-top:0">Lade …</p></div>` : ''}
      ${mayMem ? `<div class="card" data-set="mitglieder"><h3>Mitglied freischalten</h3>
        <div class="row"><label class="f" style="flex:1;min-width:220px">Mitglied<select id="apNew"><option value="">– Mitglied wählen –</option>${r.members.map(m => `<option value="${m.id}">${pName(m)}${m.kind === 'nichtmitglied' ? ' (Kein Mitglied)' : ''}</option>`).join('')}</select></label>
          <button class="btn primary" id="apGo" style="align-self:flex-end">Freischalten & einladen …</button></div>
        <div class="row" style="margin-top:10px;gap:6px 22px;align-items:center"><span class="muted s">In der App:</span>${mods.map(m => `<label class="chk"><input type="checkbox" data-nm="${m.id}" ${m.preselect ? 'checked' : ''}> ${esc(m.label || m.name)}</label>`).join('')}</div>
        <p class="muted s" style="margin:10px 0 0">Nur das freigeschaltete Handy funktioniert. Es ist dieselbe PIN wie im Verkauf am Tablet: Wer dort schon eine hat, gibt sie beim Freischalten ein; wer noch keine hat, legt sie in der App fest und sie gilt dann auch am Tablet.</p></div>
      <div class="card" data-set="mitglieder"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="margin:0">Freigeschaltete Mitglieder <span class="muted s">(${r.rows.length})</span></h3><button class="btn" id="apBulk" type="button">Einladungen verschicken …</button></div>
        ${r.rows.length ? `<div class="chips" id="apFil" role="group" aria-label="Filter" style="margin-bottom:10px">${[['alle', 'Alle'], ['mit', 'mit Handy'], ['ohne', 'ohne Handy'], ['eing', 'eingeladen'], ['wlan', 'warten auf WLAN'], ['alt', 'alte Adresse']].filter(([k]) => !['alt', 'eing', 'wlan'].includes(k) || r.rows.some(FIL[k]))
          .map(([k, l]) => `<button type="button" data-f="${k}" class="${filt === k ? 'on' : ''}">${l} <span class="cnt">${r.rows.filter(FIL[k]).length}</span></button>`).join('')}</div>
          <table class="tbl kompakt" id="apTbl"><tr><th>Mitglied</th><th>Handy</th><th class="k-sum">Bereiche</th>${mods.map(m => `<th>${esc(m.label || m.name)}</th>`).join('')}<th class="hide-md">zuletzt benutzt</th><th></th></tr>
          ${r.rows.map(x => `<tr data-row="${x.member_id}"><td class="nw"><b>${pName(x)}</b>${x.kind === 'nichtmitglied' ? ' <span class="pill">Kein Mitglied</span>' : ''}</td><td>${devPill(x.device)}</td><td class="k-sum">${esc(mods.filter(m => (x.granted || {})[m.id] && !(x.kind === 'nichtmitglied' && !m.nonMembers)).map(m => m.label || m.name).join(', '))}</td>
            ${mods.map(m => { const a = x.access[m.id], g = (x.granted || {})[m.id]; if (x.kind === 'nichtmitglied' && !m.nonMembers) return '<td class="muted k-weg" title="nur für Mitglieder">–</td>';
              if (m.id === 'zugang') return `<td class="k-weg" style="white-space:nowrap">${g ? `<span class="pill g">freigeschaltet</span>${a && a.blocked ? ' <span class="pill r">gesperrt</span>' : ''}${can('zugang') ? ` <a href="#zugang-freischaltungen" data-zgo="zugang-freischaltungen">ändern</a>` : ''}` : '<span class="muted">–</span>'}</td>`;   // Zeitprofil, gültig bis, Sperre: Zugang › Freischaltungen
              return `<td class="k-weg" style="white-space:nowrap"><span class="ap-cell"><label class="chk" style="display:inline-flex;vertical-align:middle"><input type="checkbox" data-am="${x.member_id}:${m.id}" ${g ? 'checked' : ''}>${a && g && m.options && m.options.profiles ? ` <span class="muted s">${esc((m.options.profiles.find(p => p.id === a.profile) || {}).name || '')}</span>` : ''}${a && a.blocked && !m.open ? ' <span class="pill r">gesperrt</span>' : ''}</label>${g && !m.away ? `<button type="button" class="pill tg${a && a.away ? ' on' : ''}" data-aw="${x.member_id}:${m.id}" aria-pressed="${a && a.away ? 'true' : 'false'}" title="Ausnahme: diesen Bereich auch von unterwegs nutzen (z. B. Platzwart oder Handys mit iCloud Privat-Relay)">unterwegs</button>` : ''}${g ? flagChks(m, a, `${x.member_id}:${m.id}`) : ''}</span></td>`; }).join('')}
            <td class="muted s hide-md k-weg">${x.device && x.device.last_used ? deTime(x.device.last_used) : '–'}</td>
            <td class="r"><span class="acts"><button class="btn ico" data-aq="${x.member_id}" title="Einladen (QR-Code, E-Mail, Brief) …" aria-label="Einladen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg></button><button class="btn ico danger-h" data-ad="${x.member_id}" title="Aus der App entfernen …" aria-label="Entfernen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></span></td></tr>`).join('')}</table>
          <p class="empty" id="apNone" style="display:none">Niemand in dieser Auswahl.</p>`
          : '<p class="empty">Noch niemand freigeschaltet.</p>'}</div>` : ''}`;
    // Unterbereiche wie in den Einstellungen; Punkt am Reiter, wenn dort etwas zu tun ist
    const APP_SECS = [['mitglieder', 'Mitglieder'], ['bereiche', 'Bereiche'], ['push', 'Benachrichtigungen'], ['einstellungen', 'Einstellungen']];
    // Bereiche, die Module beisteuern (z. B. „Meine Daten“ der Mitgliederverwaltung) – stehen hinter „Bereiche“
    const extras = APP_EXTRA.filter(x => !x.perm || canAny(x.perm));
    extras.forEach((x, i) => { APP_SECS.splice(2 + i, 0, [x.key, x.label]); $('main').insertAdjacentHTML('beforeend', `<div class="card" data-set="${x.key}" id="apx-${x.key}"><p class="muted" style="margin:0">Lade …</p></div>`); });
    sectionize({ secs: APP_SECS, keyOf: () => 'mitglieder', store: 'cw_appsec', label: 'Bereiche der Mitglieder-App',
      badges: { einstellungen: !mayNet ? false : rj ? (rj.why === 'direkt' ? 'Anfrage aus dem Internet abgewiesen' : 'Tunnel-Anfrage abgelehnt') : oldN ? 'Handys mit alter Adresse' : r.security.sms && r.security.sms.on && !r.security.sms.ready ? 'SMS-Stick nicht bereit' : false,
        mitglieder: r.rows.some(FIL.wlan) ? 'Handys warten auf die WLAN-Freigabe' : false } });
    watch($('apSet')); watch($('apSec'));
    extras.forEach(x => { const box = $('apx-' + x.key); Promise.resolve().then(() => x.render(box)).then(() => watch(box)).catch(e => { box.innerHTML = `<p class="muted" style="margin:0">${esc(e.message)}</p>`; }); });
    const setTest = () => { $('apTest').href = ($('apUrl').value.trim() || `${r.https ? 'https' : 'http'}://${location.hostname}:${r.port || 5001}`).replace(/\/+$/, '') + '/'; };
    if ($('apSet')) { $('apUrl').addEventListener('input', setTest); setTest(); }
    if ($('apSave')) $('apSave').onclick = () => busy($('apSave'), async () => { try {
      await api('settings/app', 'PUT', can('einstellungen') ? { url: $('apUrl').value, name: $('apName').value } : { name: $('apName').value });
      if ($('apExtUrl')) { await api('settings/app', 'PUT', { tunnelUrl: $('apExtUrl').value }); await api('settings/app', 'PUT', { tunnel: $('apExtOn').checked }); }
      clean(); toast($('apExtOn') && $('apExtOn').checked ? 'Gespeichert – von unterwegs erreichbar.' : 'Gespeichert.'); RENDER.app().catch(fail);
    } catch (e) { fail(e); } });
    if ($('apExtTest')) $('apExtTest').onclick = async () => {
      $('apExtTest').disabled = true;
      try { const t = await api('app/tunnel-check', 'POST', {}); if (t.ok) toast(t.on ? 'Die Mitglieder-App ist von außen erreichbar.' : 'Erreichbar – jetzt noch „eingeschaltet“ setzen und speichern.'); else toast(t.error, true); }
      catch (e) { fail(e); } finally { $('apExtTest').disabled = false; }
    };
    if ($('apSec')) $('apSecSave').onclick = async () => { try { await api('settings/app', 'PUT', { inviteHours: Number($('apHours').value), inviteMailDays: Number($('apDays').value), allowLink: $('apLink').checked, mailTo: $('apMail').value }); clean(); toast('Gespeichert.'); } catch (e) { fail(e); } };
    if ($('apSec')) $('apLink').onchange = async () => { try { await api('settings/app', 'PUT', { allowLink: $('apLink').checked }); toast($('apLink').checked ? 'Link-Weitergabe erlaubt.' : 'Nur noch QR-Code am Bildschirm.'); } catch (e) { fail(e); } };
    if ($('apGo')) $('apGo').onclick = async () => {
      const id = Number($('apNew').value);
      if (!id) return toast('Bitte zuerst ein Mitglied wählen.', true);
      try {
        // angehakte Bereiche freischalten; „für alle“-Bereiche ohne Haken für dieses Mitglied abschalten
        const nonMember = (r.members.find(x => x.id === id) || {}).kind === 'nichtmitglied';   // Kein Mitglied: nur Buchen, Türen, Beregnung – und nur angehakte
        for (const c of document.querySelectorAll('[data-nm]')) { const m = mods.find(x => x.id === c.dataset.nm); if (nonMember ? c.checked && m && m.nonMembers : c.checked || (m && m.open)) await api(`app/member/${id}/access`, 'PUT', { module: c.dataset.nm, grant: c.checked }); }
        inviteMenu(id, () => RENDER.app().catch(fail));
      } catch (e) { fail(e); }
    };
    $('main').querySelectorAll('[data-am]').forEach(c => { c.onchange = async () => {
      const [id, mod] = c.dataset.am.split(':');
      try { const rr = await api(`app/member/${id}/access`, 'PUT', { module: mod, grant: c.checked }); toast(rr.reinvite ? 'Freigeschaltet. Das Handy wurde aus Sicherheitsgründen entkoppelt – bitte einen neuen QR-Code erzeugen.' : c.checked ? 'Freigeschaltet.' : 'Freischaltung entzogen.'); RENDER.app().catch(fail); } catch (e) { fail(e); c.checked = !c.checked; }
    }; });
    $('main').querySelectorAll('[data-zgo]').forEach(a => { a.onclick = e => { e.preventDefault(); go(a.dataset.zgo); }; });
    $('main').querySelectorAll('[data-aw]').forEach(b => { b.onclick = () => togglePill(b, async on => {
      const [id, mod] = b.dataset.aw.split(':');
      await api(`app/member/${id}/access`, 'PUT', { module: mod, away: on }); toast(on ? 'Auch von unterwegs nutzbar.' : 'Nur noch im Vereins-WLAN.');
    }); });
    bindFlags($('main'));
    if ($('bgRows')) {   // eine Tabelle: Bereich · für wen · von unterwegs · beim Freischalten · Start · Reihenfolge – ein „Speichern“
      const AR = mods.map(m => ({ id: m.id, label: m.label || m.name, on: m.on !== false, open: Boolean(m.open), count: m.count, pre: Boolean(m.preselect), away: Boolean(m.away) }));
      let startId = r.startSection || '';
      const draw = () => {
        // „Für mich“ steht in der App immer vorn und ist ohne festen Start die Startseite
        $('bgRows').innerHTML = `<tr><td><b>Für mich</b> <span class="muted s">eigene Termine und Offenes</span></td><td class="k-weg"><span class="pill g">alle Mitglieder</span></td>${mayNet ? '<td></td>' : ''}<td></td><td><label class="chk"><input type="radio" name="bgStart" data-bgst="" ${startId ? '' : 'checked'}> Start</label></td><td></td></tr>`
          + AR.map((m, i) => `<tr class="${m.on ? '' : 'off'}"><td><span class="swname"><button type="button" class="switch ${m.on ? 'on' : ''}" role="switch" aria-checked="${m.on}" aria-label="${esc(m.label)} in der App zeigen" data-bgon="${i}"></button><b translate="no">${esc(m.label)}</b>${m.on ? '' : '<span class="pill">aus</span>'}</span></td>
          <td class="k-weg">${m.open ? '<span class="pill g">alle Mitglieder</span>' : `<span class="pill">nur ausgewählte</span> <span class="muted s" style="white-space:nowrap">${m.count === 1 ? '1 Mitglied' : `${m.count} Mitglieder`}</span>`}</td>
          ${mayNet ? `<td><label class="chk"><input type="checkbox" data-bgaway="${i}" ${m.away ? 'checked' : ''}> unterwegs</label></td>` : ''}
          <td><label class="chk"><input type="checkbox" data-bgpre="${i}" ${m.pre ? 'checked' : ''}> vorwählen</label></td>
          <td><label class="chk"><input type="radio" name="bgStart" data-bgst="${esc(m.id)}" ${startId === m.id ? 'checked' : ''}> Start</label></td>
          <td class="r"><span class="toact"><button class="btn small" data-bgup="${i}" ${i ? '' : 'disabled'} aria-label="nach vorn">↑</button><button class="btn small" data-bgdn="${i}" ${i < AR.length - 1 ? '' : 'disabled'} aria-label="nach hinten">↓</button></span></td></tr>`).join('');
        const tb = $('bgRows');
        tb.querySelectorAll('[data-bgon]').forEach(b => { b.onclick = () => { AR[+b.dataset.bgon].on = !AR[+b.dataset.bgon].on; draw(); }; });
        tb.querySelectorAll('[data-bgaway]').forEach(c => { c.onchange = () => { AR[+c.dataset.bgaway].away = c.checked; }; });
        tb.querySelectorAll('[data-bgpre]').forEach(c => { c.onchange = () => { AR[+c.dataset.bgpre].pre = c.checked; }; });
        tb.querySelectorAll('[data-bgst]').forEach(c => { c.onchange = () => { startId = c.dataset.bgst; }; });
        tb.querySelectorAll('[data-bgup]').forEach(b => { b.onclick = () => { const i = +b.dataset.bgup; [AR[i - 1], AR[i]] = [AR[i], AR[i - 1]]; draw(); }; });
        tb.querySelectorAll('[data-bgdn]').forEach(b => { b.onclick = () => { const i = +b.dataset.bgdn; [AR[i + 1], AR[i]] = [AR[i], AR[i + 1]]; draw(); }; });
        labelTables($('apAreas'));
      };
      draw();
      $('bgSave').onclick = () => busy($('bgSave'), async () => {
        const body = { sectionsOn: Object.fromEntries(AR.map(m => [m.id, m.on])), preselect: Object.fromEntries(AR.map(m => [m.id, m.pre])), moduleOrder: AR.map(m => m.id), startSection: startId, ...($('bgKonto') ? { formeKonto: $('bgKonto').checked } : {}) };
        if (mayNet) body.extModules = Object.fromEntries(AR.map(m => [m.id, m.away]));
        try { await api('settings/app', 'PUT', body); toast('Gespeichert – die App übernimmt es beim nächsten Öffnen.'); RENDER.app().catch(fail); } catch (e) { fail(e); }
      });
    }
    if ($('smsCard')) smsCard($('smsCard')).catch(e => { if ($('smsCard')) $('smsCard').innerHTML = `<h3>Bestätigung per SMS</h3><p class="muted s">${esc(e.message)}</p>`; });
    const setSrc = ip => async () => { try { await api('settings/app', 'PUT', { tunnelSrc: ip }); toast(ip ? `Nur noch ${ip} gilt als Tunnel.` : 'Jede Adresse im Add-on-Netz gilt wieder als Tunnel.'); RENDER[page](); } catch (e) { fail(e); } };
    if ($('apSrcSet')) $('apSrcSet').onclick = setSrc($('apSrcSet').dataset.ip);
    if ($('apSrcNew')) $('apSrcNew').onclick = setSrc($('apSrcNew').dataset.ip);
    if ($('apSrcOff')) $('apSrcOff').onclick = setSrc('');
    if ($('pushCard')) pushCard($('pushCard')).catch(e => { if ($('pushCard')) $('pushCard').innerHTML = `<h3>Benachrichtigungen</h3><p class="muted s">${esc(e.message)}</p>`; });
    $('main').querySelectorAll('[data-aq]').forEach(b => { b.onclick = () => inviteMenu(Number(b.dataset.aq), () => RENDER.app().catch(fail)); });
    if ($('apBulk')) $('apBulk').onclick = () => bulkInvites(r);
    $('main').querySelectorAll('[data-ad]').forEach(b => { b.onclick = async () => {
      const x = r.rows.find(y => y.member_id === Number(b.dataset.ad));
      if (await appRemove(x.member_id, x.name, Boolean(x.device))) RENDER.app().catch(fail);
    }; });
    const applyFil = () => {
      let n = 0;
      r.rows.forEach(x => { const tr = $('main').querySelector(`[data-row="${x.member_id}"]`); const on = FIL[filt](x); if (tr) tr.style.display = on ? '' : 'none'; if (on) n++; });
      if ($('apNone')) $('apNone').style.display = n ? 'none' : '';
      if ($('apTbl')) $('apTbl').style.display = n ? '' : 'none';
      $('main').querySelectorAll('#apFil [data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === filt));
    };
    $('main').querySelectorAll('#apFil [data-f]').forEach(b => { b.onclick = () => { filt = cache.apFilter = b.dataset.f; applyFil(); }; });
    applyFil();
    // Am Handy zeigt die Zeile nur eine Zusammenfassung – Antippen öffnet die Bereiche dieses Mitglieds in einem Fenster
    $('main').querySelectorAll('#apTbl tr[data-row]').forEach(tr => { tr.onclick = e => {
      if (!matchMedia('(max-width: 700px)').matches || e.target.closest('button, a, input, label, select')) return;
      const x = r.rows.find(y => y.member_id === Number(tr.dataset.row)); if (!x) return;
      dialog(`<h2>${pName(x)}</h2><div class="card" id="apDlg" style="box-shadow:none;padding:0"></div><div class="btns"><button class="btn" id="apDlgX">Schließen</button></div>`);
      appBox($('apDlg'), x.member_id).catch(fail);
      $('apDlgX').onclick = () => { closeDialog(); RENDER.app().catch(fail); };
    }; });
  };

  /* =================== Benutzer & Rechte =================== */
  let userTab = (() => { try { return sessionStorage.getItem('tab_benutzer') === 'rollen' ? 'rollen' : 'benutzer'; } catch (e) { return 'benutzer'; } })();   // Reiter wird gemerkt wie bei tabs()
  const permList = (sel, attr) => `<div class="permgrid">${Object.entries(permLabels).map(([k, l]) => `<label class="chk"><input type="checkbox" ${attr}="${k}" ${sel.includes(k) ? 'checked' : ''}> <span>${esc(l)}</span></label>`).join('')}</div>`;
  async function userDialog(u, opt) {
    const fixed = Boolean(u && u.builtin);
    const roles = opt.roles, depts = opt.departments;
    const myRoles = u ? u.roles : [], myDepts = u ? u.departments : [], extra = u ? u.extra : [];
    const free = opt.members.filter(m => !m.linked || (u && u.member_id === m.id));
    dialog(`<h2>${fixed ? 'Adminkonto' : u ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</h2>
      ${fixed ? '<div class="banner g" style="margin-bottom:10px">Das Adminkonto hat immer alle Rechte. Name und Benutzername sind fest, es kann nicht gesperrt oder gelöscht werden – nur das Passwort lässt sich ändern.</div>' : ''}
      ${u ? `<div class="ugrid"><label class="f">Benutzername<input value="${esc(u.username)}" disabled></label><label class="f">Anzeigename<input id="uNm" value="${esc(u.name || '')}" ${fixed ? 'disabled' : ''}></label>
          ${fixed ? '' : `<label class="f wall">Verknüpftes Mitglied (optional)<select id="uMem" translate="no"><option value="">${esc(T('– keines –'))}</option>${free.map(m => `<option value="${m.id}" ${u.member_id === m.id ? 'selected' : ''}>${esc(lastFirst(m.name))}</option>`).join('')}</select></label>`}</div>`
        : `<div class="seg" id="uSrc" style="margin-bottom:12px">${free.length ? '<button type="button" data-src="mem" class="on">Mitglied auswählen</button>' : ''}<button type="button" data-src="man" class="${free.length ? '' : 'on'}">Manuell anlegen</button></div>
        <div class="ugrid">
          <label class="f wall" id="uMemL">Mitglied<select id="uMem" translate="no"><option value="">${esc(T('– Mitglied wählen –'))}</option>${free.map(m => `<option value="${m.id}" data-un="${esc(m.username)}" data-nm="${esc(m.name)}">${esc(lastFirst(m.name))}</option>`).join('')}</select></label>
          <label class="f" id="uFirstL">Vorname<input id="uFirst" autocomplete="off"></label><label class="f" id="uLastL">Nachname<input id="uLast" autocomplete="off"></label>
          <label class="f">Benutzername (automatisch)<input id="uUn" disabled placeholder="Vorname-Initial + Nachname"></label><label class="f">Start-Passwort (mind. 8 Zeichen)<input id="uPw" type="text" autocomplete="off"></label>
        </div>`}
      ${fixed ? '' : `<h3 class="usec">Zugang</h3>
      <div class="ugrid"><label class="chk ucard"><input type="radio" name="uRole" value="admin" ${!u || u.role === 'admin' ? 'checked' : ''}> <span><b>Nach Rollen</b><br><span class="muted s">Rollen unten ankreuzen (und ggf. einzelne Rechte)</span></span></label>
        <label class="chk ucard"><input type="radio" name="uRole" value="oberadmin" ${u && u.role === 'oberadmin' ? 'checked' : ''}> <span><b>Alle Rechte</b><br><span class="muted s">wie das Adminkonto – inkl. Benutzer, Einstellungen, Datensicherung</span></span></label></div>
      <div id="uRoleBox">
        <div class="rolegrid">${roles.map(r => `<label class="chk ucard"><input type="checkbox" data-role="${r.id}" ${myRoles.includes(r.id) ? 'checked' : ''}> <span><b>${esc(r.name)}</b>${r.dept_scope ? ' <span class="pill b">eigene Abteilung</span>' : ''}<br><span class="muted s">${esc(r.description || '')}</span></span></label>`).join('') || '<p class="empty">Noch keine Rollen – unter „Rollen“ anlegen.</p>'}</div>
        <div id="uDeptBox" class="card soft" style="margin-top:12px"><h3 style="margin:0 0 8px">Abteilungen für „eigene Abteilung“</h3>
          ${depts.length ? `<div class="permgrid">${depts.map(d => `<label class="chk"><input type="checkbox" data-dep="${d.id}" ${myDepts.includes(d.id) ? 'checked' : ''}> <span translate="no">${esc(d.name)}</span></label>`).join('')}</div>` : '<p class="muted" style="margin:0">Abteilungen gibt es in der Mitgliederverwaltung.</p>'}</div>
        <details class="udet"${extra.length ? ' open' : ''}><summary>Zusätzliche Einzelrechte${extra.length ? ` (${extra.length})` : ''}</summary>${permList(extra, 'data-perm')}</details>
      </div>`}
      ${u ? `<div class="row" style="align-items:center;margin-top:14px">${fixed ? '' : `<label class="chk"><input type="checkbox" id="uAct" ${u.active ? 'checked' : ''}> Zugang aktiv</label>`}
        <button class="btn small" id="uReset">Neues Passwort vergeben</button>
        ${fixed || u.id === me.id ? '' : '<button class="btn small danger" id="uDel">Benutzer löschen</button>'}</div>` : ''}
      <div class="err" id="uErr" style="text-align:left"></div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok">Speichern</button></div>`);
    const sync = () => {
      if (fixed) return;
      const all = document.querySelector('[name=uRole]:checked').value === 'oberadmin';
      $('uRoleBox').classList.toggle('hidden', all);
      const scoped = [...document.querySelectorAll('[data-role]:checked')].some(c => (roles.find(r => r.id === +c.dataset.role) || {}).dept_scope);
      $('uDeptBox').classList.toggle('hidden', !scoped);
    };
    if (!fixed) { document.querySelectorAll('[name=uRole], [data-role]').forEach(r => { r.onchange = sync; }); sync(); }
    let src = free.length ? 'mem' : 'man';
    let sugT = 0;
    const suggest = () => {
      if (u) return;
      if (src === 'mem') { const o = $('uMem').selectedOptions[0]; $('uUn').value = o && o.dataset.un ? o.dataset.un : ''; return; }
      clearTimeout(sugT); sugT = setTimeout(async () => { const f = $('uFirst').value.trim(), l = $('uLast').value.trim(); if (!l) { $('uUn').value = ''; return; } try { $('uUn').value = (await api(`users/suggest?first=${encodeURIComponent(f)}&last=${encodeURIComponent(l)}`)).username; } catch (e) { /* */ } }, 250);
    };
    const syncSrc = () => { if (u) return; $('uMemL').classList.toggle('hidden', src !== 'mem'); $('uFirstL').classList.toggle('hidden', src === 'mem'); $('uLastL').classList.toggle('hidden', src === 'mem'); suggest(); };
    if (!u) {
      if ($('uSrc')) $('uSrc').onclick = e => { const b = e.target.closest('[data-src]'); if (!b) return; src = b.dataset.src; $('uSrc').querySelectorAll('[data-src]').forEach(x => x.classList.toggle('on', x === b)); syncSrc(); };
      $('uMem').onchange = suggest; $('uFirst').oninput = suggest; $('uLast').oninput = suggest; syncSrc();
    }
    $('c').onclick = closeDialog;
    if (u) $('uReset').onclick = async () => {
      const pw = await askText(`Neues Passwort für ${u.username} (mind. 8 Zeichen):`, '', { ok: 'Passwort setzen' });
      if (!pw) return;
      const mine = await askText('Zur Bestätigung: dein eigenes Passwort', '', { ok: 'Bestätigen', password: true });
      if (!mine) return;
      try { await api(`users/${u.id}/password`, 'POST', { password: pw, myPassword: mine }); toast('Passwort gesetzt – bitte persönlich weitergeben.'); } catch (e) { fail(e); }
    };
    if ($('uDel')) $('uDel').onclick = async () => {
      if (!await ask(`Benutzer „${u.name || u.username}“ löschen? Die Einträge im Protokoll bleiben erhalten.`)) return;
      try { await api('users/' + u.id, 'DELETE'); closeDialog(); toast('Gelöscht.'); RENDER.benutzer(); } catch (e) { fail(e); }
    };
    $('ok').onclick = () => busy($('ok'), async () => {
      const body = fixed ? {} : { role: document.querySelector('[name=uRole]:checked').value, roles: [...document.querySelectorAll('[data-role]:checked')].map(x => +x.dataset.role),
        departments: [...document.querySelectorAll('[data-dep]:checked')].map(x => +x.dataset.dep), perms: [...document.querySelectorAll('[data-perm]:checked')].map(x => x.dataset.perm) };
      if (body.role === 'oberadmin' && !(u && u.role === 'oberadmin')) {   // „alle Rechte“ vergeben: mit dem eigenen Passwort bestätigen
        const mine = await askText('Zur Bestätigung: dein eigenes Passwort', '', { ok: 'Bestätigen', password: true });
        if (!mine) return;
        body.myPassword = mine;
      }
      try {
        if (u) await api('users/' + u.id, 'PUT', fixed ? {} : { ...body, name: $('uNm').value, member_id: $('uMem').value ? +$('uMem').value : null, active: $('uAct').checked });
        else {
          const nm = src === 'mem' ? (($('uMem').selectedOptions[0] || {}).dataset || {}).nm : `${$('uFirst').value.trim()} ${$('uLast').value.trim()}`.trim();
          if (src === 'mem' && !$('uMem').value) throw new Error('Bitte ein Mitglied wählen.');
          if (src === 'man' && !$('uLast').value.trim()) throw new Error('Bitte Vor- und Nachname eintragen.');
          const r = await api('users', 'POST', { ...body, name: nm, username: $('uUn').value, member_id: src === 'mem' ? +$('uMem').value : null, password: $('uPw').value });
          toast(`Angelegt – Benutzername „${r.username}“.`);
        }
        closeDialog(); if (u) toast('Gespeichert.'); RENDER.benutzer();
      } catch (e) { $('uErr').textContent = e.message; }
    });
  }

  function roleDialog(r, opt) {
    dialog(`<h2>${r ? 'Rolle bearbeiten' : 'Neue Rolle'}</h2>
      <div class="ugrid"><label class="f">Name<input id="rNm" value="${esc(r ? r.name : '')}" maxlength="40" placeholder="z. B. Jugendwart"></label>
        <label class="f">Beschreibung<input id="rDs" value="${esc(r ? r.description || '' : '')}" maxlength="300"></label></div>
      <label class="chk ucard" style="margin-top:12px"><input type="checkbox" id="rSc" ${r && r.dept_scope ? 'checked' : ''}> <span><b>Nur Mitglieder der eigenen Abteilungen</b><br><span class="muted s">Für Abteilungsleitungen: Mitglieder ihrer Abteilung sehen, Stammdaten ändern, Austritte eintragen, neue Mitglieder anlegen und Anträge mit dieser Abteilung annehmen. Welche Abteilung, steht beim Benutzer. Gilt nur für die Rechte „Mitglieder“ und „E-Mail an Mitglieder“ – andere Rechte bitte in einer eigenen Rolle vergeben.</span></span></label>
      <h3 class="usec">Rechte</h3>${permList(r ? r.perms : [], 'data-rp')}
      <div class="err" id="rErr" style="text-align:left"></div>
      <div class="btns">${r && !r.users ? '<button class="btn danger" id="rDel" style="margin-right:auto">Löschen</button>' : ''}<button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="rOk">Speichern</button></div>`);
    $('c').onclick = closeDialog;
    if ($('rDel')) $('rDel').onclick = async () => { if (!await ask(`Rolle „${r.name}“ löschen?`)) return; try { await api('roles/' + r.id, 'DELETE'); closeDialog(); RENDER.benutzer(); } catch (e) { fail(e); } };
    $('rOk').onclick = () => busy($('rOk'), async () => {
      const body = { name: $('rNm').value, description: $('rDs').value, dept_scope: $('rSc').checked, perms: [...document.querySelectorAll('[data-rp]:checked')].map(x => x.dataset.rp) };
      try { if (r) await api('roles/' + r.id, 'PUT', body); else await api('roles', 'POST', body); closeDialog(); toast('Gespeichert.'); RENDER.benutzer(); } catch (e) { $('rErr').textContent = e.message; }
    });
    void opt;
  }

  const PERM_SHORT = { lieferungen: 'Lieferungen', bestand: 'Bestand', bestellung: 'Bestellung', buchungen: 'Buchungen', export: 'Export',
    abrechnung: 'Abrechnung', veranstaltungen: 'Veranstaltungen', uebernahme: 'Übernahme', artikel: 'Artikel', konten: 'Konten', deinstallieren: 'Module',
    mitglieder: 'Mitglieder', mitglieder_bank: 'Bankdaten', mitglieder_finanzen: 'Einzug', mitglieder_dokumente: 'Dokumente', gratulationen: 'Gratulationen', arbeitseinsatz: 'Helferdienste',
    zeiterfassung: 'Zeiterfassung', zugang: 'Zugang', zugang_bedienen: 'Zugang bedienen', beregnung: 'Beregnung', beregnung_bedienen: 'Beregnung bedienen', app: 'App einrichten', maengel: 'Mängel', turniere: 'Turniere',
    email: 'E-Mail', buchhaltung: 'Buchhaltung', spielbetrieb: 'Spielbetrieb', benutzer: 'Benutzer', einstellungen: 'Einstellungen',
    buchung: 'Belegung ansehen', buchung_buchen: 'Für andere buchen', buchung_stornieren: 'Buchungen stornieren', buchung_serien: 'Serien & Sperren', buchung_einstellungen: 'Buchung einrichten' };
  // Rechte von Erweiterungen ohne Kurzname: ihr Name aus erweiterung.json, nie der interne Schlüssel
  const permPills = (list, labels = {}) => list.map(p => `<span class="pill b" style="margin:1px">${esc(PERM_SHORT[p] || labels[p] || p)}</span>`).join(' ');
  RENDER.benutzer = async () => {
    try { userTab = sessionStorage.getItem('tab_benutzer') === 'rollen' ? 'rollen' : 'benutzer'; } catch (e) { /* egal */ }   // auch die Suche wählt den Reiter vor
    const [users, opt] = await Promise.all([api('users'), api('users/options')]);
    const roleName = id => (opt.roles.find(r => r.id === id) || {}).name;
    const deptName = id => (opt.departments.find(d => d.id === id) || {}).name;
    $('main').innerHTML = `<h2 class="page">Benutzer & Rechte</h2>
      <p class="lead">Jeder meldet sich mit eigenem Benutzernamen an, so ist nachvollziehbar, wer was geändert hat. <b>Rollen</b> bündeln Rechte, z. B. für den Kassenwart.</p>
      <div class="tabrow"><div class="tabs" id="uTab" role="tablist"><button type="button" data-t="benutzer" class="${userTab === 'benutzer' ? 'on' : ''}">Benutzer <span class="badge">${users.length}</span></button><button type="button" data-t="rollen" class="${userTab === 'rollen' ? 'on' : ''}">Rollen <span class="badge">${opt.roles.length}</span></button></div>
      <div class="tabtools"><button class="btn primary" id="uNew">${userTab === 'rollen' ? '+ Neue Rolle' : '+ Neuer Benutzer'}</button></div></div>
      <div class="scroll" id="uBody"></div>`;
    if (userTab === 'rollen') {
      $('uBody').innerHTML = `<table class="tbl kompakt"><tr><th>Rolle</th><th>Rechte</th><th class="r">Benutzer</th><th></th></tr>
        ${opt.roles.map(r => `<tr><td><b>${esc(r.name)}</b><div class="muted s">${r.dept_scope ? '<span class="pill b">eigene Abteilung</span> ' : ''}${esc(r.description || '')}</div></td>
          <td class="k-weg">${permPills(r.perms, opt.permLabels) || '<span class="muted s">keine</span>'}</td><td class="r k-lbl">${r.users}</td><td class="r"><button class="btn small" data-r="${r.id}">Bearbeiten</button></td></tr>`).join('')}</table>`;
      $('uBody').querySelectorAll('[data-r]').forEach(b => { b.onclick = () => roleDialog(opt.roles.find(x => x.id === +b.dataset.r), opt); });
    } else {
      $('uBody').innerHTML = `<table class="tbl kompakt"><tr><th>Benutzer</th><th>Zugang</th><th>Letzte Anmeldung</th><th></th></tr>
        ${users.map(u => `<tr class="${u.active ? '' : 'off'}"><td><b>${esc(u.member_id && u.name ? lastFirst(u.name) : u.name || u.username)}</b><div class="muted s">${esc(u.username)}${u.member_id ? ' · Mitglied' : ''}</div></td>
          <td>${u.builtin ? '<span class="pill g">Adminkonto</span>' : u.role === 'oberadmin' ? '<span class="pill g">alle Rechte</span>'
            : [u.roles.map(id => `<span class="pill b" style="margin:1px">${esc(roleName(id) || '?')}</span>`).join(' '), u.extra.length ? permPills(u.extra, opt.permLabels) : ''].filter(Boolean).join(' ') || '<span class="muted s">keine Rechte</span>'}
            ${u.departments.length && u.deptOnly.length ? `<div class="muted s" translate="no">${esc(u.departments.map(deptName).filter(Boolean).join(', '))}</div>` : ''}${u.active ? '' : ' <span class="pill">gesperrt</span>'}</td>
          <td>${u.last_login ? deTime(u.last_login) : '<span class="muted s">noch nie</span>'}</td>
          <td class="r"><button class="btn small" data-u="${u.id}">Bearbeiten</button></td></tr>`).join('')}</table>`;
      $('uBody').querySelectorAll('[data-u]').forEach(b => { b.onclick = () => userDialog(users.find(x => x.id === Number(b.dataset.u)), opt).catch(fail); });
    }
    { const on = $('uTab').querySelector('.on'); if (on) revealTab(on); }
    $('uTab').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; userTab = b.dataset.t; try { sessionStorage.setItem('tab_benutzer', userTab); } catch (x) { /* ohne Speicher */ } RENDER.benutzer().catch(fail); };
    $('uNew').onclick = () => (userTab === 'rollen' ? roleDialog(null, opt) : userDialog(null, opt).catch(fail));
  };

  /* =================== Datensicherung =================== */
  const size = b => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const KIND_B = { auto: 'nächtlich', manuell: 'von Hand', 'vor-wiederherstellung': 'vor Wiederherstellung', hochgeladen: 'hochgeladen', komplett: 'aus Komplettsicherung' };
  /* ---------- Tresor: Verschlüsselung der persönlichen Daten ---------- */
  const VAULT_WHAT = 'Adressen, Telefon, E-Mail, Geburtsdaten, Bankdaten, Unterschriften, Beitrittserklärungen, Dokumente, Profilfotos, Notizen, Änderungsverlauf und die Kontaktdaten in der Buchhaltung';
  /* ehrlich: was der Tresor schützt – und was bewusst lesbar bleibt (muss zu SPEC/FILE_DIRS in src/vault.js passen) */
  const VAULT_SCOPE = `<details style="margin-top:10px"><summary>Was genau verschlüsselt wird – und was nicht</summary>
    <div class="row" style="align-items:flex-start;gap:20px;margin-top:8px">
      <div style="flex:1;min-width:240px"><b>Verschlüsselt</b><ul class="s" style="margin:6px 0 0;padding-left:18px">
        <li>Mitglieder: Geburtsdatum, Anschrift, Telefon, Handy, E-Mail, Schlüsselnummer, Notizen, Zusatzfelder</li>
        <li>Bankdaten (Kontoinhaber, IBAN, BIC), Lastschrift-Dateien</li>
        <li>Online-Anträge, Änderungsanträge, Unterschriften, Änderungsverlauf</li>
        <li>Buchhaltung: Kontaktdaten der Partner, Rechnungsempfänger, Spender</li>
        <li>Gastspieler/innen: Handynummer · externe Helfer: Notiz</li>
        <li>E-Mail-Adressen der Empfänger von Rundmails</li>
        <li>Dateien: Mitglieder-Dokumente, Profilfotos, Mail-Anhänge</li></ul></div>
      <div style="flex:1;min-width:240px"><b>Bleibt lesbar</b> (wird für den Betrieb gebraucht)<ul class="s" style="margin:6px 0 0;padding-left:18px">
        <li>Namen – für Tablet, Buchungen, Suche und Sortierung</li>
        <li>Mitgliedsnummer, Status, Ein-/Austritt, Abteilungen, Beiträge, Einwilligungen</li>
        <li>Getränkekonten, Platzbuchungen, Arbeitsstunden, Spielbetrieb, Protokolle</li>
        <li>Belege der Buchhaltung, Artikelbilder, Erweiterungen</li></ul></div></div>
    <p class="muted s" style="margin:8px 0 0">Der Tresor schützt vor dem Auslesen der Festplatte bzw. einer Sicherungskopie der Datenbank. Gegen jemanden, der in der laufenden Verwaltung angemeldet ist, schützen die Rechte der Admins.</p></details>`;
  function vaultSheets(code) {
    const club = esc((brand && brand.clubName) || '');
    const d = new Date().toLocaleDateString('de-DE');
    const sheet = who => `<div style="page-break-after:always;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;padding:28px 34px;max-width:720px">
      <div style="font-size:15px;color:#555">${club}</div>
      <h1 style="font-size:24px;margin:6px 0 4px">Wiederherstellungscode</h1>
      <div style="font-size:15px;margin-bottom:22px">für die verschlüsselten persönlichen Daten in Clubwerk · erstellt am ${d}</div>
      <div style="font:700 30px/1.3 ui-monospace,Menlo,Consolas,monospace;letter-spacing:2px;border:2px solid #111;border-radius:12px;padding:18px 16px;text-align:center">${esc(code)}</div>
      <h2 style="font-size:17px;margin:26px 0 8px">Wofür?</h2>
      <p style="font-size:14px;line-height:1.5;margin:0">Normalerweise öffnet die Anmeldung eines Admins die persönlichen Daten. Mit diesem Code öffnet man sie, wenn das nicht mehr geht – z. B. wenn niemand mehr ein Admin-Passwort kennt oder eine Sicherung auf einem neuen Gerät eingespielt wird. <b>Ohne Code und ohne Admin-Passwort sind die Daten für immer verloren.</b></p>
      <h2 style="font-size:17px;margin:20px 0 8px">So aufbewahren</h2>
      <ul style="font-size:14px;line-height:1.6;margin:0;padding-left:20px"><li>In einem verschlossenen Umschlag – <b>nicht im Vereinsheim</b>.</li><li>Nicht fotografieren, nicht in eine Cloud oder Mail.</li><li>Es gibt zwei gleiche Blätter: eins beim Vorsitz, eins beim Kassenwart.</li><li>Bei einem Vorstandswechsel in Clubwerk einen neuen Code erzeugen – der alte gilt dann nicht mehr.</li></ul>
      <h2 style="font-size:17px;margin:20px 0 8px">So benutzen</h2>
      <p style="font-size:14px;line-height:1.5;margin:0">In der Verwaltung anmelden → Datensicherung → „Verschlüsselung der persönlichen Daten“ → Code und das eigene Passwort eingeben.</p>
      <table style="width:100%;margin-top:34px;font-size:14px;border-collapse:collapse"><tr>
        <td style="width:50%;padding-right:20px"><div style="border-bottom:1px solid #111;height:30px"></div>Ausfertigung für (${who})</td>
        <td style="width:50%;padding-left:20px"><div style="border-bottom:1px solid #111;height:30px"></div>Datum, Unterschrift</td></tr></table></div>`;
    return sheet('Vorsitz') + sheet('Kassenwart');
  }
  function vaultUnlockHtml(prefix) {
    return `<div class="row" style="align-items:flex-end;gap:10px;margin-top:10px">
      <label class="f" style="flex:1;min-width:240px">Wiederherstellungscode<input id="${prefix}Code" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" style="font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:1px"></label>
      <label class="f" style="flex:1;min-width:200px">Dein Passwort<input id="${prefix}Pw" type="password" autocomplete="current-password"></label>
      <button class="btn primary" id="${prefix}Go" type="button">Öffnen</button></div>`;
  }
  function wireUnlock(prefix, done) {
    if (!$(prefix + 'Go')) return;
    $(prefix + 'Go').onclick = () => busy($(prefix + 'Go'), async () => {
      try { await api('vault/unlock', 'POST', { code: $(prefix + 'Code').value, password: $(prefix + 'Pw').value }); toast('Geöffnet – die persönlichen Daten sind wieder lesbar.'); done(); } catch (e) { fail(e); }
    });
  }
  /** Bereich mit persönlichen Daten aufgerufen, Tresor verschlossen: Hinweis + Öffnen mit Code */
  function vaultLockedPage() {
    if ($('vaultLock')) return;
    $('main').innerHTML = `<div class="card" id="vaultLock" style="max-width:760px"><h3>Persönliche Daten verschlossen</h3>
      <p class="muted" style="margin:0 0 6px">Nach einem Neustart sind Adressen, Bankdaten und Dokumente verschlüsselt, bis sich ein Admin mit Schlüssel anmeldet. Dein Konto hat noch keinen – das passiert automatisch bei der ersten Anmeldung, während die Daten offen sind. Bis dahin hier mit dem <b>Wiederherstellungscode</b> öffnen (das Blatt beim Vorsitz bzw. Kassenwart).</p>
      <p class="muted s" style="margin:0">Tablet, Buchungen, Türen und Beregnung laufen weiter; E-Mails an Mitglieder warten und gehen nach dem Öffnen raus.</p>
      ${vaultUnlockHtml('vl')}</div>`;
    wireUnlock('vl', () => RENDER[page]().catch(pageFail));
  }
  async function renderVaultCard() {
    const box = $('vaultCard'); if (!box) return;
    const v = await api('vault');
    const when = iso => (iso ? new Date(iso).toLocaleDateString('de-DE') : '–');
    let body;
    if (!v.on) body = `<div class="banner a">Ausgeschaltet – die persönlichen Daten liegen unverschlüsselt auf dem Home Assistant. Wer den Rechner mitnimmt, kann sie lesen.</div>
      <p class="muted s" style="margin:8px 0">Eingeschaltet werden ${VAULT_WHAT} verschlüsselt gespeichert. Namen, Getränkekonten, Buchungen, Türen und Beregnung bleiben lesbar – der Vereinsbetrieb läuft nach einem Neustart sofort weiter. Die Daten öffnen sich automatisch, sobald sich ein Admin anmeldet.</p>
      ${v.may ? '<div class="row"><button class="btn" id="vaOn" type="button">Verschlüsselung einschalten</button></div>' : '<p class="muted s">Einschalten kann, wer das Recht „Einstellungen“ hat.</p>'}${VAULT_SCOPE}`;
    else if (v.locked) body = `<div class="banner r">Verschlossen – seit dem letzten Neustart hat sich noch kein Admin mit Schlüssel angemeldet.${v.waitingMails ? ` ${v.waitingMails} ${v.waitingMails === 1 ? 'E-Mail' : 'E-Mails'} warten.` : ''}</div>
      <p class="muted s" style="margin:8px 0 0">Dein Konto hat ${v.mine ? 'einen Schlüssel – bitte einmal ab- und wieder anmelden.' : 'noch keinen Schlüssel. Mit dem Wiederherstellungscode öffnen; danach öffnet auch deine Anmeldung die Daten.'}</p>
      ${v.mine ? '' : vaultUnlockHtml('va')}`;
    else body = `<div class="banner g">Eingeschaltet seit ${when(v.since)} – ${VAULT_WHAT} liegen verschlüsselt auf der Platte und sind nur im Arbeitsspeicher entschlüsselt.</div>
      <p class="muted s" style="margin:8px 0">Wiederherstellungscode vom ${when(v.codeAt)}. Nach einem Neustart öffnet die erste Anmeldung eines Admins die Daten${v.mine ? ' – dein Konto hat einen Schlüssel' : ''}.</p>
      ${v.may ? '<div class="row"><button class="btn" id="vaCode" type="button">Neuen Wiederherstellungscode erzeugen</button><button class="btn danger" id="vaOff" type="button">Verschlüsselung ausschalten</button></div>' : ''}${VAULT_SCOPE}`;
    box.innerHTML = `<div class="card"><h3>Verschlüsselung der persönlichen Daten</h3>${body}</div>`;
    wireUnlock('va', () => RENDER.sicherung().catch(fail));
    if ($('vaOn')) $('vaOn').onclick = () => vaultEnable(v);
    if ($('vaCode')) $('vaCode').onclick = async () => {
      const pw = await askText('Neuer Wiederherstellungscode\nDer bisherige Code gilt danach nicht mehr. Bitte dein Passwort eingeben.', '', { password: true, ok: 'Erzeugen' }); if (!pw) return;
      try { const r = await api('vault/new-code', 'POST', { password: pw }); vaultShowCode(r.code, () => { closeDialog(); renderVaultCard().catch(fail); }, 'Fertig'); } catch (e) { fail(e); }
    };
    if ($('vaOff')) $('vaOff').onclick = async () => {
      const pw = await askText('Verschlüsselung ausschalten?\nDie persönlichen Daten liegen danach wieder unverschlüsselt auf dem Home Assistant. Bitte dein Passwort eingeben.', '', { password: true, ok: 'Ausschalten' }); if (!pw) return;
      try { await api('vault/disable', 'POST', { password: pw }); toast('Verschlüsselung ausgeschaltet.'); renderVaultCard().catch(fail); } catch (e) { fail(e); }
    };
  }
  function vaultShowCode(code, next, nextLabel = 'Weiter') {
    dialog(`<h3>Wiederherstellungscode</h3>
      <p class="muted" style="margin:0 0 10px">Bitte jetzt <b>zwei Blätter drucken</b> – eins für den Vorsitz, eins für den Kassenwart – und verschlossen aufbewahren, nicht im Vereinsheim. Der Code wird nur dieses eine Mal angezeigt.</p>
      <div style="font:700 24px/1.3 ui-monospace,Menlo,Consolas,monospace;letter-spacing:2px;text-align:center;border:2px solid var(--line);border-radius:12px;padding:14px 10px;margin:4px 0 14px;word-break:break-all">${esc(code)}</div>
      <div class="btns"><button class="btn" id="vcPrint" type="button">Zwei Blätter drucken</button><button class="btn primary" id="vcNext" type="button">${esc(nextLabel)}</button></div>`);
    let printed = false;
    $('vcPrint').onclick = () => { printed = true; printHtml(vaultSheets(code)); };
    $('vcNext').onclick = async () => { if (!printed && !await ask('Die Blätter wurden noch nicht gedruckt. Trotzdem weiter? Ohne Code können die Daten verloren gehen, wenn niemand mehr ein Admin-Passwort kennt.', { ok: 'Trotzdem weiter' })) return; next(); };
  }
  async function vaultEnable(v) {
    const pw = await askText('Verschlüsselung einschalten\nBitte dein Passwort eingeben. Danach zeigt Clubwerk einmalig den Wiederherstellungscode zum Ausdrucken.', '', { password: true, ok: 'Weiter' }); if (!pw) return;
    let prep; try { prep = await api('vault/prepare', 'POST', { password: pw }); } catch (e) { return fail(e); }
    vaultShowCode(prep.code, () => {
      dialog(`<h3>Probe</h3>
        <p class="muted" style="margin:0 0 10px">Damit niemand mit einem falsch abgeschriebenen Code dasteht: Bitte vom gedruckten Blatt die Zeichen an <b>Stelle ${prep.positions.join(', ')}</b> eintippen (ohne Bindestriche gezählt).</p>
        <label class="f">Zeichen ${prep.positions.join(' · ')}<input id="vpT" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" style="font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:4px;text-align:center;font-size:20px"></label>
        ${v.oldPlain ? `<label class="chk" style="margin-top:12px"><input type="checkbox" id="vpDel" checked> Die ${v.oldPlain} älteren, unverschlüsselten Schnappschüsse der Datenbank auf diesem Gerät löschen (empfohlen – sie enthalten die Daten im Klartext). Die verschlüsselten Komplettsicherungen bleiben.</label>` : ''}
        <p class="muted s" style="margin:10px 0 0">Das Verschlüsseln dauert wenige Sekunden. Vorher legt Clubwerk eine Sicherung an.</p>
        <div class="btns"><button class="btn ghost" id="vpC" type="button">Abbrechen</button><button class="btn primary" id="vpGo" type="button">Verschlüsseln</button></div>`);
      $('vpC').onclick = closeDialog;
      $('vpGo').onclick = () => busy($('vpGo'), async () => {
        try {
          const r = await api('vault/enable', 'POST', { password: pw, typed: $('vpT').value, deleteOld: $('vpDel') ? $('vpDel').checked : false });
          closeDialog(); toast(`Verschlüsselt${r.files ? ` – auch ${r.files} ${r.files === 1 ? 'Datei' : 'Dateien'}` : ''}${r.removed ? `, ${r.removed} alte Schnappschüsse gelöscht` : ''}.`);
          RENDER.sicherung().catch(fail);
        } catch (e) { fail(e); }
      });
      setTimeout(() => $('vpT') && $('vpT').focus(), 50);
    });
  }

  RENDER.sicherung = async () => {
    const [b, dx, st] = await Promise.all([api('backups'), api('dropbox'), api('backups/status')]);
    setTimeout(() => renderVaultCard().catch(fail), 0);
    const owner = me.role === 'oberadmin';
    const when = iso => (iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');
    const fileDate = f => { const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})(?:_(\d{2})(\d{2}))?/); return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}${m[4] ? `, ${m[4]}:${m[5]}` : ''}` : f; };
    // beide Listen (hier / Dropbox) gleich aufgebaut: Stand | Größe | Aktionen – gleiche Spaltenbreiten, gleicher Rahmen
    const kTable = (title, rows) => `<div class="scroll" style="max-height:40vh"><table class="tbl kompakt" style="table-layout:fixed"><tr><th>${title}</th><th class="r" style="width:110px">Größe</th><th class="r" style="width:320px"></th></tr>${rows}</table></div>`;
    const okPill = (ok, t) => `<span class="pill ${ok ? 'g' : 'a'}">${t}</span>`;
    $('main').innerHTML = `<h2 class="page">Datensicherung</h2>
      <p class="lead">Jede Nacht entsteht eine <b>verschlüsselte Komplettsicherung</b> mit allem, was Clubwerk enthält, und geht an die Sicherungsziele. Öffnen lässt sie sich nur mit dem Sicherungspasswort.</p>
      ${b.restored ? `<div class="banner g">${esc(b.restored)}</div>` : ''}
      ${b.pending ? `<div class="banner a" style="display:block">Beim nächsten Neustart wird <b>${esc(b.pending)}</b> wiederhergestellt${/_komplett\.db$/.test(b.pending) ? ' (mit Belegen, Bildern und Erweiterungen)' : ''}. Der aktuelle Stand wird vorher automatisch beiseitegelegt.
        <div class="row" style="margin-top:8px"><button class="btn small primary" id="bRestart">Jetzt neu starten</button><button class="btn small" id="bCancel">Abbrechen</button></div></div>` : ''}
      ${st.warn ? `<div class="banner ${st.warnLevel || 'a'}">${esc(st.warn)}</div>` : ''}
      <div class="kpis">
        <div class="kpi ${st.last_error && !st.last_ok ? 'warn' : ''}"><div class="l">Letzte Sicherung</div><div class="v">${st.last_ok ? when(st.last_ok) : 'noch keine'}</div><div class="muted s">${esc(st.last_msg ? st.last_msg.replace(/^\d{4}-\d{2}-\d{2}: /, '') : (st.hasKey ? 'täglich ab ' + st.hour + ' Uhr' : 'Sicherungspasswort fehlt'))}</div></div>
        <div class="kpi ${st.probe_at && !st.probe_ok ? 'warn' : ''}"><div class="l">Probe-Wiederherstellung</div><div class="v">${st.probe_at ? (st.probe_ok ? 'in Ordnung' : 'Fehler') : 'noch keine'}</div><div class="muted s">${st.probe_at ? 'am ' + when(st.probe_at) : 'einmal im Monat automatisch'}</div></div>
        <div class="kpi ${st.targetsOn && st.targetsOk < st.targetsOn ? 'warn' : ''}"><div class="l">Sicherungsziele</div><div class="v">${st.targetsOn ? `${st.targetsOk} von ${st.targetsOn} in Ordnung` : 'keins'}</div><div class="muted s">${st.targetsOn ? esc(st.targets.filter(t => t.enabled).map(t => t.name).join(' · ')) : 'Sicherung bleibt nur hier auf dem Gerät'}</div></div>
      </div>
      ${st.last_error && !st.targets.some(t => t.last_error && st.last_error.includes(t.name + ':')) ? `<div class="banner r">Letzter Fehler: ${esc(st.last_error.slice(25))}</div>` : ''}
 <div id="vaultCard"></div>
      <div class="card"><h3>Jetzt</h3><div class="row">
        <button class="btn ${st.hasKey ? 'primary' : ''}" id="bkRun" ${st.hasKey ? '' : 'disabled'}>Jetzt sichern</button>
        <button class="btn" id="bkProbe" ${st.local.length ? '' : 'disabled'}>Letzte Sicherung prüfen</button>
        ${st.local[0] ? `<a class="btn" href="api/admin/backups/komplett/file/${encodeURIComponent(st.local[0].file)}">Letzte Komplettsicherung herunterladen (${size(st.local[0].size)})</a>` : ''}</div>
        <p class="muted s">Die heruntergeladene Datei (<code>.cwbackup</code>) eignet sich als zweites Exemplar außer Haus, z. B. auf einem USB-Stick. Sie ist verschlüsselt.</p>
        ${st.probe_msg ? `<p class="muted s">Letzte Prüfung: ${esc(st.probe_msg)}</p>` : ''}</div>

      <div class="card"><h3>Sicherungspasswort ${okPill(st.hasKey, st.hasKey ? 'festgelegt' : 'fehlt')}</h3>
        ${st.hasKey ? `<p class="muted s" style="margin-top:0">Festgelegt am ${esc(deTime(st.pwAt))} Uhr. Wird es geändert, lassen sich ältere Sicherungen weiter mit dem damaligen Passwort öffnen.</p>`
          : '<p class="muted s" style="margin-top:0">Mit diesem Passwort werden alle Sicherungen verschlüsselt. <b>Ohne das Passwort ist eine Sicherung wertlos</b> – deshalb danach unbedingt das Notfallblatt ausdrucken und sicher verwahren (z. B. beim Kassenwart oder im Tresor).</p>'}
        ${owner ? (st.hasKey ? '<div class="row"><button class="btn" id="bkPwChange">Passwort ändern …</button><button class="btn" id="bkSheet">Notfallblatt drucken …</button></div>' : `<div class="row">
          <label class="f" style="flex:1;min-width:180px">Sicherungspasswort (mind. 10 Zeichen)<input type="password" id="bkPw1" autocomplete="new-password"></label>
          <label class="f" style="flex:1;min-width:180px">Wiederholen<input type="password" id="bkPw2" autocomplete="new-password"></label>
          <label class="f" style="flex:1;min-width:180px">Dein Passwort zur Bestätigung<input type="password" id="bkMy" autocomplete="current-password"></label>
          <button class="btn primary" id="bkPwSet" style="align-self:flex-end">Festlegen</button></div>`) : '<p class="muted s">Festlegen und ändern darf nur ein Benutzer mit allen Rechten.</p>'}</div>

      <div class="card"><h3>Zeitplan &amp; Aufbewahrung</h3><div class="row">
        <label class="f" style="flex:1;min-width:140px">Uhrzeit<select id="bkHour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === st.hour ? 'selected' : ''}>${String(h).padStart(2, '0')}:00 Uhr</option>`).join('')}</select></label>
        <label class="f" style="flex:1;min-width:140px">Tägliche behalten<input id="bkDaily" class="n" value="${st.daily}" inputmode="numeric"></label>
        <label class="f" style="flex:1;min-width:140px">Wöchentliche<input id="bkWeekly" class="n" value="${st.weekly}" inputmode="numeric"></label>
        <label class="f" style="flex:1;min-width:140px">Monatliche<input id="bkMonthly" class="n" value="${st.monthly}" inputmode="numeric"></label>
        <button class="btn primary" id="bkSave">Speichern</button></div>
        <label class="chk" style="margin-top:12px"><input type="checkbox" id="bkReadable" data-nodirty ${st.readable ? 'checked' : ''}> Zusätzlich lesbare Auszüge der aktiven Module hochladen (Excel, unverschlüsselt – z. B. Getränke-Stand, Arbeitszeiten, Tür- und Beregnungsprotokoll)</label>
        <p class="muted s">Auf den Sicherungszielen bleiben die neuesten ${st.daily} Tage, dazu je Woche (${st.weekly}) und je Monat (${st.monthly}) die jüngste Sicherung – so reicht der Verlauf weit zurück, ohne dass der Speicher voll läuft. Für einzelne Ziele lässt sich das abweichend einstellen. Hier in der App bleiben die letzten 3.</p></div>

      <div class="card"><h3>Sicherungsziele ${st.targetsOn ? okPill(st.targetsOk === st.targetsOn, `${st.targetsOk} von ${st.targetsOn} in Ordnung`) : '<span class="pill a">keins eingerichtet</span>'}</h3>
        <p class="muted s" style="margin-top:0">Wohin die verschlüsselte Komplettsicherung jede Nacht zusätzlich geht. Am sichersten sind zwei Ziele an verschiedenen Orten – z. B. Dropbox außer Haus und das NAS oder die FRITZ!Box im Vereinsheim.</p>
        ${st.targets.length ? `<div class="scroll"><table class="tbl kompakt"><tr><th>Ziel</th><th>Art</th><th>Ort</th><th style="width:150px">Zuletzt erfolgreich</th><th style="width:130px">Status</th><th class="r" style="width:300px"></th></tr>
          ${st.targets.map(t => { const bad = t.enabled && t.last_error && (!t.last_ok || t.last_error.slice(0, 24) > t.last_ok); return `<tr class="${t.enabled ? '' : 'off'}"><td><b>${esc(t.name)}</b>${t.insecure ? ' <span class="pill a">unverschlüsselt</span>' : ''}</td><td>${esc(t.typeLabel)}</td>
            <td class="muted s" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.where)}">${esc(t.where)}</td>
            <td>${t.last_ok ? when(t.last_ok) : '–'}</td>
            <td>${!t.enabled ? '<span class="pill">aus</span>' : bad ? `<span class="pill r" title="${esc(t.last_error.slice(25))}">Fehler</span>` : t.last_ok ? '<span class="pill g">in Ordnung</span>' : '<span class="pill">noch nicht</span>'}</td>
            <td class="r"><button class="btn small" data-tgtest="${esc(t.id)}">Testen</button>${owner ? ` <button class="btn small" data-tgedit="${esc(t.id)}">Bearbeiten</button>` : ''}${owner && t.id !== 'dropbox' ? ` <button class="btn small danger-h" data-tgdel="${esc(t.id)}">Entfernen</button>` : ''}</td></tr>
            ${bad ? `<tr><td colspan="6"><div class="banner r" style="margin:0">${esc(t.name)}: ${esc(t.last_error.slice(25))}</div></td></tr>` : ''}`; }).join('')}</table></div>` : ''}
        <div class="row" style="margin-top:12px">
          ${owner ? '<button class="btn" id="tgAdd">Ziel hinzufügen …</button>' : ''}
          ${owner || !dx.connected ? `<button class="btn" id="dxSetup">${dx.connected ? 'Dropbox neu verbinden …' : 'Dropbox verbinden …'}</button>` : ''}
        </div>
        ${owner ? '' : '<p class="muted s">Ziele anlegen, ändern und entfernen darf nur ein Benutzer mit allen Rechten.</p>'}
        <div id="dxLegacy"></div>
      </div>

      <div class="card"><h3>Wiederherstellen</h3>
        <p class="muted s" style="margin-top:0">Eine Komplettsicherung ersetzt beim nächsten Neustart <b>alles</b>: Datenbank, Belege, Bilder und Erweiterungen. Der aktuelle Stand wird vorher beiseitegelegt. ${owner ? '' : 'Wiederherstellen darf nur ein Benutzer mit allen Rechten.'}</p>
        ${st.local.length ? kTable('Hier in der App', st.local.map(x => `<tr><td>${esc(fileDate(x.file))}</td><td class="r">${size(x.size)}</td>
            <td class="r"><a class="btn small" href="api/admin/backups/komplett/file/${encodeURIComponent(x.file)}">Herunterladen</a>${owner ? ` <button class="btn small danger-h" data-krestore="local" data-file="${esc(x.file)}">Wiederherstellen …</button>` : ''}</td></tr>`).join('')) : '<p class="empty">Noch keine Komplettsicherung hier in der App.</p>'}
        ${st.targets.map(t => `<div id="tgf_${esc(t.id)}" style="margin-top:12px"></div>`).join('')}
        ${owner ? `<div class="row" style="margin-top:12px"><label class="btn">Komplettsicherung hochladen …<input type="file" id="bkUp" accept=".cwbackup,.vhsicherung,application/octet-stream" hidden></label>
          <span class="muted s" style="align-self:center">z. B. nach einer Neuinstallation: zuerst einrichten, dann hier die Datei vom USB-Stick wählen.</span></div>` : ''}
      </div>

      <div class="card"><h3>Datenbank-Schnappschüsse</h3>
        <p class="muted s" style="margin-top:0">Zusätzlich sichert die App jede Nacht nur die Datenbank (die letzten 14 Nächte) – praktisch, um schnell einen Fehler der letzten Tage rückgängig zu machen.</p>
        <div class="row" style="margin-bottom:12px"><button class="btn" id="bNow">Schnappschuss jetzt</button><label class="btn">.db-Datei einspielen …<input type="file" id="bUp" accept=".db,application/octet-stream" hidden></label></div>
        ${b.list.length ? `<div class="scroll" style="max-height:40vh"><table class="tbl kompakt"><tr><th>Art</th><th>Stand</th><th class="r">Größe</th><th></th></tr>
        ${b.list.map(x => { const k = (x.file.match(/_(auto|manuell|vor-wiederherstellung|hochgeladen|komplett)\.db$/) || [])[1]; return `<tr title="${esc(x.file)}">
          <td>${x.file === 'ha-snapshot.db' ? 'vor letztem HA-Backup' : esc(KIND_B[k] || 'Schnappschuss')}</td><td>${deTime(x.mtime.replace('T', ' ').slice(0, 19))}</td><td class="r">${size(x.size)}</td>
          <td class="r"><a class="btn small" href="api/admin/backups/file/${encodeURIComponent(x.file)}">Herunterladen</a> <button class="btn small danger-h" data-restore="${esc(x.file)}">Wiederherstellen …</button></td></tr>`; }).join('')}</table></div>` : '<p class="empty">Noch kein Schnappschuss vorhanden.</p>'}</div>`;

    // Sicherungen auf den Zielen nachladen (braucht etwas länger) – je Ziel eine Tabelle im gleichen Aufbau
    for (const t of st.targets) api(`backups/targets/${encodeURIComponent(t.id)}/files`).then(r => {
      const el = $('tgf_' + t.id); if (!el || !r.files.length) return;
      el.innerHTML = kTable('In ' + esc(t.name), r.files.map(x => `<tr><td>${esc(fileDate(x.file))}</td><td class="r">${size(x.size)}</td><td class="r">${owner ? `<button class="btn small danger-h" data-krestore="target" data-target="${esc(t.id)}" data-file="${esc(x.file)}">Wiederherstellen …</button>` : ''}</td></tr>`).join(''));
      bindRestore();
    }).catch(() => { const el = $('tgf_' + t.id); if (el) el.innerHTML = `<p class="muted s" style="margin:0">${esc(t.name)}: gerade nicht erreichbar – Sicherungen dort lassen sich im Moment nicht auflisten.</p>`; });
    // alte, unverschlüsselte Dateien früherer Versionen in Dropbox
    if (dx.connected) api('backups/remote').then(r => {
      if ($('dxLegacy') && r.legacy) $('dxLegacy').innerHTML = `<div class="banner a" style="margin-top:12px;display:block">In Dropbox liegen noch ${r.legacy} Dateien aus früheren Versionen in <code>Datenbank</code> und <code>Excel</code> – <b>unverschlüsselt</b>.
        ${owner ? '<div class="row" style="margin-top:8px"><button class="btn small" id="dxLegacyDel">Alte Dateien löschen …</button></div>' : ''}</div>`;
      if ($('dxLegacyDel')) $('dxLegacyDel').onclick = async () => {
        const pw = await askText(`Die ${r.legacy} alten, unverschlüsselten Dateien in Dropbox löschen?\n\nDie neuen, verschlüsselten Sicherungen bleiben erhalten. Bitte mit deinem Passwort bestätigen.`, '', { password: true, ok: 'Löschen' });
        if (pw === null) return;
        try { const x = await api('backups/remote/cleanup-legacy', 'POST', { myPassword: pw }); toast(`${x.removed} Dateien gelöscht.`); RENDER.sicherung(); } catch (e) { fail(e); }
      };
    }).catch(() => { /* Dropbox gerade nicht erreichbar – steht in der Zieltabelle */ });

    const notfallblatt = pw => printHtml(`<div class="pr nf">
      <div class="prhead"><div><div class="prclub">${esc(cache.settings.clubName || '')}</div><h1>Notfallblatt Datensicherung</h1></div><div class="prmeta">Clubwerk<br>erstellt am ${new Date().toLocaleDateString('de-DE')}</div></div>
      <p><b>Sicher verwahren!</b> Wer dieses Blatt hat, kann die Sicherungen des Vereins lesen. Ohne dieses Passwort lässt sich keine Sicherung wiederherstellen.</p>
      <div class="nflabel">Sicherungspasswort</div><div class="nfpw">${esc(pw)}</div>
      <h2>Wo liegen die Sicherungen?</h2>
      <ul>${st.targets.map(t => `<li>${esc(t.name)} (${esc(t.typeLabel)}): <b>${esc(t.where)}/Komplett</b></li>`).join('')}
        <li>Je Tag eine Datei, z. B. <i>2026-10-17_Clubwerk.cwbackup</i></li>
        <li>In jedem Home-Assistant-Backup (Einstellungen → System → Backups)</li></ul>
      <h2>Wiederherstellen nach einem Totalausfall</h2>
      <ol><li>Home Assistant einrichten und das Add-on „Clubwerk“ installieren und starten.</li>
        <li>In der Seitenleiste „Clubwerk“ öffnen und mit einem beliebigen Passwort einrichten.</li>
        <li>Datensicherung → Wiederherstellen → „Komplettsicherung hochladen …“ (oder erst das Sicherungsziel wieder einrichten und dort die Sicherung wählen).</li>
        <li>Das Sicherungspasswort von diesem Blatt eingeben und das Add-on neu starten. Danach gelten wieder die alten Benutzer und Passwörter.</li></ol>
      <div class="prfoot"><span>Aufbewahrt bei: ______________________________</span><span>Datum: ____________</span></div></div>`);
    const sheetAsk = () => dialog(`<h2>Notfallblatt drucken</h2><p class="muted">Zum Drucken bitte das Sicherungspasswort eingeben – es wird nirgends gespeichert.</p>
      <label class="f">Sicherungspasswort<input type="password" id="nfPw" autocomplete="off"></label>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok">Drucken</button></div>`);
    if ($('bkSheet')) $('bkSheet').onclick = () => {
      sheetAsk(); $('c').onclick = closeDialog;
      $('ok').onclick = () => busy($('ok'), async () => { try { await api('backups/password/check', 'POST', { password: $('nfPw').value }); const pw = $('nfPw').value; closeDialog(); notfallblatt(pw); } catch (e) { fail(e); } });
    };
    const afterSet = pw => {
      dialog(`<h2>Sicherungspasswort festgelegt</h2><div class="banner a" style="display:block">Jetzt bitte das Notfallblatt ausdrucken und sicher verwahren. Ohne das Passwort lässt sich keine Sicherung wiederherstellen.</div>
        <div class="btns"><button class="btn ghost" id="c">Später</button><button class="btn primary" id="ok">Notfallblatt drucken</button></div>`);
      $('c').onclick = () => { closeDialog(); RENDER.sicherung(); };
      $('ok').onclick = () => { closeDialog(); notfallblatt(pw); RENDER.sicherung(); };
    };
    if ($('bkPwSet')) $('bkPwSet').onclick = async () => {
      if ($('bkPw1').value !== $('bkPw2').value) return fail(new Error('Die beiden Passwörter stimmen nicht überein.'));
      const pw = $('bkPw1').value;
      try { await api('backups/password', 'POST', { password: pw, myPassword: $('bkMy').value }); afterSet(pw); } catch (e) { fail(e); }
    };
    if ($('bkPwChange')) $('bkPwChange').onclick = () => {
      dialog(`<h2>Sicherungspasswort ändern</h2><p class="muted">Neue Sicherungen werden mit dem neuen Passwort verschlüsselt. Ältere Sicherungen lassen sich weiter mit dem bisherigen Passwort öffnen – das alte Notfallblatt also aufheben.</p>
        <label class="f">Neues Sicherungspasswort (mind. 10 Zeichen)<input type="password" id="cp1" autocomplete="new-password"></label>
        <label class="f">Wiederholen<input type="password" id="cp2" autocomplete="new-password"></label>
        <label class="f">Dein Passwort zur Bestätigung<input type="password" id="cpMy" autocomplete="current-password"></label>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok">Ändern</button></div>`);
      $('c').onclick = closeDialog;
      $('ok').onclick = () => busy($('ok'), async () => {
        if ($('cp1').value !== $('cp2').value) return fail(new Error('Die beiden Passwörter stimmen nicht überein.'));
        const pw = $('cp1').value;
        try { await api('backups/password', 'POST', { password: pw, myPassword: $('cpMy').value }); closeDialog(); afterSet(pw); } catch (e) { fail(e); }
      });
    };
    $('bkRun').onclick = async () => {
      $('bkRun').disabled = true; $('bkRun').textContent = 'Sichert …';
      try { const r = await api('backups/run', 'POST', {}); toast('Gesichert: ' + r.msg.replace(/^\d{4}-\d{2}-\d{2}: /, '')); } catch (e) { fail(e); }
      RENDER.sicherung();
    };
    $('bkProbe').onclick = async () => {
      $('bkProbe').disabled = true; $('bkProbe').textContent = 'Prüft …';
      try { const r = await api('backups/probe', 'POST', {}); toast('In Ordnung: ' + r.msg); } catch (e) { fail(e); }
      RENDER.sicherung();
    };
    $('bkSave').onclick = async () => {
      try { await api('backups/settings', 'PUT', { hour: $('bkHour').value, daily: $('bkDaily').value, weekly: $('bkWeekly').value, monthly: $('bkMonthly').value }); toast('Gespeichert.'); RENDER.sicherung(); } catch (e) { fail(e); }
    };
    $('bkReadable').onchange = async () => { try { await api('backups/settings', 'PUT', { readable: $('bkReadable').checked }); toast($('bkReadable').checked ? 'Lesbare Auszüge werden mit hochgeladen.' : 'Nur noch die verschlüsselte Komplettsicherung.'); } catch (e) { fail(e); } };

    // Wiederherstellen aus einer Komplettsicherung
    const restoreDialog = (source, file, label, sameKey = true, target = '') => {
      dialog(`<h2>Komplettsicherung wiederherstellen?</h2>
        <div class="banner r" style="display:block">Stand vom <b>${esc(label)}</b>. Beim nächsten Neustart werden Datenbank, Belege, Bilder und Erweiterungen ersetzt – alles seitdem Gebuchte und Eingetragene geht verloren. Der aktuelle Stand wird vorher beiseitegelegt.</div>
        <label class="f">Sicherungspasswort ${sameKey ? '<span class="muted s">(nur nötig, wenn die Sicherung mit einem anderen Passwort erstellt wurde)</span>' : ''}<input type="password" id="rsPw" autocomplete="off"></label>
        <label class="f">Dein Passwort zur Bestätigung<input type="password" id="rsMy" autocomplete="current-password"></label>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn danger" id="ok">Wiederherstellen</button></div>`);
      $('c').onclick = closeDialog;
      $('ok').onclick = () => busy($('ok'), async () => {
        $('ok').disabled = true; $('ok').textContent = 'Entschlüsselt …';
        try {
          const r = await api('backups/komplett/restore', 'POST', { source, target, file, password: $('rsPw').value, myPassword: $('rsMy').value });
          closeDialog(); toast(`Geprüft (Stand ${new Date(r.created).toLocaleString('de-DE')}) – wird beim Neustart übernommen.`); RENDER.sicherung();
        } catch (e) { $('ok').disabled = false; $('ok').textContent = 'Wiederherstellen'; fail(e); if (e.message && /Sicherungspasswort/.test(e.message)) $('rsPw').focus(); }
      });
    };
    function bindRestore() {
      $('main').querySelectorAll('[data-krestore]').forEach(btn => btn.onclick = () => restoreDialog(btn.dataset.krestore, btn.dataset.file, fileDate(btn.dataset.file), true, btn.dataset.target || ''));
    }
    bindRestore();
    if ($('bkUp')) $('bkUp').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      toast('Wird hochgeladen …');
      try {
        const r = await fetch('api/admin/backups/komplett/upload', { method: 'POST', body: f, headers: { 'Content-Type': 'application/octet-stream', 'X-Clubwerk': '1' } });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Fehler');
        restoreDialog('upload', j.id, new Date(j.created).toLocaleString('de-DE'), j.sameKey);
      } catch (err) { fail(err); }
      e.target.value = '';
    };

    /* ---------- Sicherungsziele ---------- */
    const tgById = id => st.targets.find(t => t.id === id);
    $('main').querySelectorAll('[data-tgtest]').forEach(btn => btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'Prüft …';
      try { await api(`backups/targets/${encodeURIComponent(btn.dataset.tgtest)}/test`, 'POST', {}); toast(`„${tgById(btn.dataset.tgtest).name}“: Verbindung in Ordnung.`); } catch (e) { fail(e); }
      btn.disabled = false; btn.textContent = 'Testen';
    });
    $('main').querySelectorAll('[data-tgdel]').forEach(btn => btn.onclick = async () => {
      const t = tgById(btn.dataset.tgdel);
      const pw = await askText(`Sicherungsziel „${t.name}“ entfernen?\n\nDie Dateien dort bleiben erhalten, es wird nur nicht mehr dorthin gesichert. Bitte mit deinem Passwort bestätigen.`, '', { password: true, ok: 'Entfernen' });
      if (pw === null) return;
      try { await api(`backups/targets/${encodeURIComponent(t.id)}`, 'DELETE', { myPassword: pw }); toast('Entfernt.'); RENDER.sicherung(); } catch (e) { fail(e); }
    });
    $('main').querySelectorAll('[data-tgedit]').forEach(btn => btn.onclick = () => (btn.dataset.tgedit === 'dropbox' ? dropboxDialog() : targetDialog(tgById(btn.dataset.tgedit))));
    if ($('tgAdd')) $('tgAdd').onclick = () => targetDialog(null);
    if ($('dxSetup')) $('dxSetup').onclick = () => dropboxSetup();

    const HINTS = {
      webdav: 'Nextcloud/ownCloud: <code>https://cloud.example.de/remote.php/dav/files/BENUTZER</code> · Hetzner Storage Box: <code>https://uXXXXX.your-storagebox.de</code> · Synology/QNAP: WebDAV im NAS einschalten, dann <code>https://nas.local:5006</code>.',
      sftp: 'Synology: Systemsteuerung → Dateidienste → FTP → „SFTP-Dienst aktivieren“. Am besten einen eigenen Benutzer anlegen, der nur den Sicherungsordner sieht.',
      ftp: 'FRITZ!Box mit USB-Speicher: Heimnetz → USB/Speicher → „Zugriff über FTP aktiv“ und unter System → FRITZ!Box-Benutzer einen Benutzer mit NAS-Recht anlegen; Server <code>fritz.box</code>, Verbindung „FTPS (explizit)“, Port 21.',
    };
    const targetDialog = t => {
      const isNew = !t;
      let typ = t ? t.type : 'webdav';
      let fp = t ? (t.hostKey || t.certFp || '') : '';
      const v = (k, d = '') => (t && t[k] !== undefined && t[k] !== null ? t[k] : d);
      const pwPh = t && t.hasSecret ? 'placeholder="•••••• (gespeichert – leer lassen = unverändert)"' : '';
      const fieldsHtml = () => typ === 'webdav' ? `
          <div class="row"><label class="f" style="flex:1">WebDAV-Adresse<input id="tgUrl" value="${esc(v('url'))}" placeholder="https://cloud.example.de/remote.php/dav/files/verein"></label></div>
          <div class="row"><label class="f" style="flex:1">Benutzer<input id="tgUser" value="${esc(v('user'))}" autocomplete="off"></label><label class="f" style="flex:1">Passwort / App-Passwort<input id="tgPw" type="password" ${pwPh} autocomplete="new-password"></label></div>`
        : typ === 'sftp' ? `
          <div class="row"><label class="f" style="flex:1">Server<input id="tgHost" value="${esc(v('host'))}" placeholder="nas.local oder 192.168.178.20"></label><label class="f" style="flex:1">Port<input id="tgPort" class="n" value="${esc(v('port', 22))}" inputmode="numeric"></label></div>
          <div class="row"><label class="f" style="flex:1">Benutzer<input id="tgUser" value="${esc(v('user'))}" autocomplete="off"></label><label class="f" style="flex:1">Anmeldung<select id="tgAuth"><option value="password" ${v('auth') !== 'key' ? 'selected' : ''}>Passwort</option><option value="key" ${v('auth') === 'key' ? 'selected' : ''}>Privater Schlüssel</option></select></label></div>
          <div id="tgSecretBox"></div>`
        : `
          <div class="row"><label class="f" style="flex:1">Verbindung<select id="tgMode"><option value="ftps" ${v('mode', 'ftps') === 'ftps' ? 'selected' : ''}>FTPS (explizit, empfohlen)</option><option value="ftps-implicit" ${v('mode') === 'ftps-implicit' ? 'selected' : ''}>FTPS (implizit, Port 990)</option><option value="ftp" ${v('mode') === 'ftp' ? 'selected' : ''}>FTP – unverschlüsselt</option></select></label></div>
          <div class="row"><label class="f" style="flex:1">Server<input id="tgHost" value="${esc(v('host'))}" placeholder="fritz.box"></label><label class="f" style="flex:1">Port<input id="tgPort" class="n" value="${esc(v('port', 21))}" inputmode="numeric"></label></div>
          <div class="row"><label class="f" style="flex:1">Benutzer<input id="tgUser" value="${esc(v('user'))}" autocomplete="off"></label><label class="f" style="flex:1">Passwort<input id="tgPw" type="password" ${pwPh} autocomplete="new-password"></label></div>`;
      const secretBox = () => { if (!$('tgSecretBox')) return; $('tgSecretBox').innerHTML = $('tgAuth').value === 'key'
        ? `<label class="f">Privater Schlüssel (OpenSSH, beginnt mit -----BEGIN …)<textarea id="tgKey" rows="5" style="font-family:ui-monospace,monospace;font-size:12px" ${t && t.hasSecret ? 'placeholder="(gespeichert – leer lassen = unverändert)"' : ''}></textarea></label>`
        : `<div class="row"><label class="f" style="flex:1">Passwort<input id="tgPw" type="password" ${pwPh} autocomplete="new-password"></label></div>`; };
      const fpBox = (f, changed) => {
        if (!f) { $('tgFp').innerHTML = ''; return; }
        $('tgFp').innerHTML = `<div class="banner ${changed ? 'r' : 'a'}" style="margin-top:8px;display:block">${changed ? '<b>Achtung: Der Server meldet sich anders als bisher.</b> Nur bestätigen, wenn er bewusst neu eingerichtet oder das Zertifikat erneuert wurde.<br>' : ''}
          ${typ === 'sftp' ? 'Fingerabdruck des Servers' : 'Fingerabdruck des Zertifikats'}:<div style="font-family:ui-monospace,monospace;font-size:12.5px;word-break:break-all;margin:6px 0">${esc(f)}</div>
          <label class="chk"><input type="checkbox" id="tgFpOk" ${fp === f ? 'checked' : ''}> Stimmt mit der Anzeige im Gerät überein – diesem Server vertrauen</label></div>`;
        $('tgFpOk').onchange = () => { fp = $('tgFpOk').checked ? f : ''; };
      };
      dialog(`<h2>${isNew ? 'Sicherungsziel hinzufügen' : 'Sicherungsziel bearbeiten'}</h2>
        <div class="row"><label class="f" style="flex:1">Art<select id="tgType" ${isNew ? '' : 'disabled'}><option value="dropbox">Dropbox (App key + App secret)</option><option value="webdav">WebDAV (Nextcloud, NAS, Storage Box …)</option><option value="sftp">SFTP (SSH)</option><option value="ftp">FTPS / FTP (z. B. FRITZ!Box)</option></select></label>
          <label class="f" style="flex:1">Name<input id="tgName" value="${esc(v('name'))}" placeholder="z. B. NAS Vereinsheim"></label></div>
        <p class="muted s" id="tgHint" style="margin:0 0 8px"></p>
        <div id="tgFields"></div>
        <div class="row"><label class="f" style="flex:1">Ordner auf dem Ziel<input id="tgFolder" value="${esc(v('folder', '/Clubwerk'))}"></label></div>
        <label class="chk" style="margin-top:8px"><input type="checkbox" id="tgOwnRet" ${t && t.retention ? 'checked' : ''}> Eigene Aufbewahrung für dieses Ziel (sonst wie oben eingestellt)</label>
        <div class="row ${t && t.retention ? '' : 'hidden'}" id="tgRet" style="margin-top:8px">
          <label class="f" style="flex:1">Tägliche<input id="tgD" class="n" value="${esc(t && t.retention ? t.retention.daily : st.daily)}" inputmode="numeric"></label>
          <label class="f" style="flex:1">Wöchentliche<input id="tgW" class="n" value="${esc(t && t.retention ? t.retention.weekly : st.weekly)}" inputmode="numeric"></label>
          <label class="f" style="flex:1">Monatliche<input id="tgM" class="n" value="${esc(t && t.retention ? t.retention.monthly : st.monthly)}" inputmode="numeric"></label></div>
        <div id="tgFp"></div><div id="tgIns"></div>
        <label class="chk" style="margin-top:8px"><input type="checkbox" id="tgOn" ${!t || t.enabled ? 'checked' : ''}> Aktiv – jede Nacht hierhin sichern</label>
        <label class="f" style="margin-top:8px">Dein Passwort zur Bestätigung<input type="password" id="tgMy" autocomplete="current-password"></label>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn" id="tgTest">Verbindung testen</button><button class="btn primary" id="ok">Speichern</button></div>`, true);
      const draw = () => { $('tgType').value = typ; $('tgHint').innerHTML = HINTS[typ]; $('tgFields').innerHTML = fieldsHtml();
        if ($('tgAuth')) { secretBox(); $('tgAuth').onchange = secretBox; }
        if ($('tgMode')) $('tgMode').onchange = () => { fp = ''; fpBox(''); $('tgPort').value = $('tgMode').value === 'ftps-implicit' ? 990 : 21; insBox(); };
        fpBox(fp); insBox(); };
      const insBox = () => { const ins = (typ === 'ftp' && $('tgMode') && $('tgMode').value === 'ftp') || (typ === 'webdav' && /^http:/i.test(($('tgUrl') || {}).value || ''));
        $('tgIns').innerHTML = ins ? '<div class="banner r" style="margin-top:8px;display:block">Unverschlüsselt: Das Passwort geht im Klartext durchs Netz. Die Sicherung selbst bleibt verschlüsselt. Nur im eigenen Netz verwenden.<label class="chk" style="margin-top:6px"><input type="checkbox" id="tgInsOk"> Verstanden, trotzdem verwenden</label></div>' : ''; };
      $('tgType').onchange = () => { if ($('tgType').value === 'dropbox') { closeDialog(); dropboxSetup(); return; } typ = $('tgType').value; fp = ''; draw(); };
      $('tgFields').addEventListener('input', e => { if (e.target.id === 'tgUrl') insBox(); if (e.target.id === 'tgHost' || e.target.id === 'tgPort') { fp = ''; fpBox(''); } });
      $('tgOwnRet').onchange = () => $('tgRet').classList.toggle('hidden', !$('tgOwnRet').checked);
      draw();
      const collect = () => {
        const o = { type: typ, name: $('tgName').value, folder: $('tgFolder').value, enabled: $('tgOn').checked, allowInsecure: Boolean($('tgInsOk') && $('tgInsOk').checked) };
        if ($('tgUrl')) o.url = $('tgUrl').value;
        if ($('tgHost')) { o.host = $('tgHost').value; o.port = $('tgPort').value; }
        o.user = $('tgUser').value;
        if ($('tgAuth')) o.auth = $('tgAuth').value;
        if ($('tgMode')) o.mode = $('tgMode').value;
        if (typ === 'sftp') o.hostKey = fp; if (typ === 'ftp') o.certFp = fp;
        o.retention = $('tgOwnRet').checked ? { daily: $('tgD').value, weekly: $('tgW').value, monthly: $('tgM').value } : null;
        return o;
      };
      const secret = () => ($('tgKey') ? $('tgKey').value : $('tgPw') ? $('tgPw').value : '');
      $('c').onclick = closeDialog;
      $('tgTest').onclick = async () => {
        $('tgTest').disabled = true; $('tgTest').textContent = 'Prüft …';
        try {
          const r = await api('backups/targets/test', 'POST', { id: t ? t.id : undefined, target: collect(), secret: secret() || undefined });
          if (r.needConfirm) { fpBox(r.fingerprint, r.changed); toast('Bitte den Fingerabdruck prüfen und bestätigen, dann erneut testen.', true); }
          else { if (r.fingerprint && !fp) { fp = r.fingerprint; } toast('Verbindung in Ordnung – Testdatei geschrieben und gelöscht.'); }
        } catch (e) { fail(e); }
        $('tgTest').disabled = false; $('tgTest').textContent = 'Verbindung testen';
      };
      $('ok').onclick = () => busy($('ok'), async () => {
        $('ok').disabled = true;
        try {
          const body = { target: collect(), secret: secret() || undefined, myPassword: $('tgMy').value };
          await api(isNew ? 'backups/targets' : `backups/targets/${encodeURIComponent(t.id)}`, isNew ? 'POST' : 'PUT', body);
          closeDialog(); toast('Gespeichert – ab heute Nacht wird auch hierhin gesichert.'); RENDER.sicherung();
        } catch (e) { $('ok').disabled = false; fail(e); }
      });
    };
    const dropboxDialog = () => {
      dialog(`<h2>Dropbox</h2><p class="muted">Verbunden mit <b>${esc(dx.account || 'Dropbox-App')}</b>. Alles liegt unter <code>Dropbox/Apps/&lt;App-Name&gt;/…</code>.</p>
        <div class="row"><label class="f" style="flex:1">Ordner in Dropbox<input id="dxFolder" value="${esc(dx.folder)}"></label></div>
        <label class="chk" style="margin-top:8px"><input type="checkbox" id="dxOn" ${dx.enabled ? 'checked' : ''}> Aktiv – jede Nacht hierhin sichern</label>
        <div class="row" style="margin-top:12px"><button class="btn" id="dxRekey">App key / Secret ändern, neu verbinden …</button></div>
        <div class="btns"><button class="btn danger" id="dxOff">Verbindung trennen</button><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok">Speichern</button></div>`);
      $('c').onclick = closeDialog;
      $('dxRekey').onclick = () => { closeDialog(); dropboxSetup(); };
      $('ok').onclick = () => busy($('ok'), async () => { try { await api('dropbox', 'PUT', { folder: $('dxFolder').value, enabled: $('dxOn').checked }); closeDialog(); toast('Gespeichert.'); RENDER.sicherung(); } catch (e) { fail(e); } });
      $('dxOff').onclick = async () => { closeDialog(); if (!await ask('Dropbox-Verbindung trennen? Bereits hochgeladene Dateien bleiben in Dropbox.')) return; await api('dropbox/disconnect', 'POST', {}).catch(fail); RENDER.sicherung(); };
    };
    const dropboxSetup = async () => {
      const d = await api('dropbox');
      dialog(`<h2>Dropbox verbinden</h2>
        ${d.connected ? `<div class="banner a"><span>Zurzeit verbunden mit <b>${esc(d.account || 'Dropbox-App')}</b>. Mit neuen Schlüsseln oder einem neuen Code wird die Verbindung ersetzt – bereits hochgeladene Dateien bleiben in Dropbox.</span></div>` : ''}
        <ol class="steps">
          <li>Auf <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener">dropbox.com/developers/apps</a> mit dem Vereins-Dropbox-Konto anmelden → <b>Create app</b> → <b>Scoped access</b> → <b>App folder</b> → Name z. B. „Vereinsname-Vereinsheim“.</li>
          <li>Reiter <b>Permissions</b>: <code>files.metadata.read</code>, <code>files.content.write</code>, <code>files.content.read</code> und <code>account_info.read</code> anhaken → <b>Submit</b>.</li>
          <li>Reiter <b>Settings</b>: <b>App key</b> und <b>App secret</b> hier eintragen und speichern.</li>
        </ol>
        <div class="row"><label class="f" style="flex:1">App key<input id="dxKey" value="${esc(d.appKey)}" autocomplete="off"></label>
          <label class="f" style="flex:1">App secret<input id="dxSecret" type="password" placeholder="${d.hasSecret ? '•••••• (gespeichert)' : ''}" autocomplete="new-password"></label></div>
        <div class="btns" style="justify-content:flex-start;margin-top:0"><button class="btn primary" id="dxSaveKeys">Speichern</button></div>
        ${d.authUrl && d.hasSecret ? `<ol class="steps" start="4" style="margin-top:14px">
          <li><a class="btn small primary" href="${esc(d.authUrl)}" target="_blank" rel="noopener">Bei Dropbox freigeben ↗</a> – im neuen Fenster <b>Zulassen</b> klicken.</li>
          <li>Den angezeigten Code kopieren und hier einfügen:</li></ol>
          <div class="row"><label class="f" style="flex:1">Code von Dropbox<input id="dxCode" autocomplete="off"></label></div>` : ''}
        <div class="btns"><button class="btn ghost" id="c">Schließen</button>${d.authUrl && d.hasSecret ? '<button class="btn primary" id="dxConnect">Verbinden</button>' : ''}</div>`, true);
      $('c').onclick = closeDialog;
      $('dxSaveKeys').onclick = async () => { try { await api('dropbox', 'PUT', { appKey: $('dxKey').value, appSecret: $('dxSecret').value || undefined }); toast('Gespeichert – jetzt bei Dropbox freigeben.'); dropboxSetup(); } catch (e) { fail(e); } };
      if ($('dxConnect')) $('dxConnect').onclick = async () => { try { const r = await api('dropbox/connect', 'POST', { code: $('dxCode').value }); closeDialog(); toast('Dropbox verbunden' + (r.account ? ': ' + r.account : '') + '.'); RENDER.sicherung(); } catch (e) { fail(e); } };
    };
    $('bNow').onclick = async () => { try { const r = await api('backups', 'POST', {}); toast('Gesichert: ' + r.file); RENDER.sicherung(); } catch (e) { fail(e); } };
    if ($('bCancel')) $('bCancel').onclick = async () => { await api('backups/restore', 'DELETE').catch(fail); RENDER.sicherung(); };
    if ($('bRestart')) $('bRestart').onclick = restartApp;
    $('bUp').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const r = await fetch('api/admin/backups/upload', { method: 'POST', body: f, headers: { 'Content-Type': 'application/octet-stream', 'X-Clubwerk': '1' } });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Fehler');
        toast('Sicherung geprüft und abgelegt.'); RENDER.sicherung();
      } catch (err) { fail(err); }
    };
    $('main').querySelectorAll('[data-restore]').forEach(btn => btn.onclick = async () => {
      const pw = await askText(`„${btn.dataset.restore}“ wiederherstellen?\n\nNur die Datenbank wird ersetzt (Belege und Bilder bleiben). Alle Buchungen seit dieser Sicherung gehen dabei verloren. Der aktuelle Stand wird vorher automatisch gesichert. Die Wiederherstellung passiert beim Neustart.\n\nBitte mit deinem Passwort bestätigen.`, '', { password: true, ok: 'Wiederherstellen' });
      if (pw === null || pw === '') return;
      try { await api('backups/restore', 'POST', { file: btn.dataset.restore, myPassword: pw }); RENDER.sicherung(); } catch (e) { fail(e); }
    });
  };
  async function restartApp() {
    if (!await ask('Clubwerk jetzt neu starten? Das Tablet ist dafür etwa eine Minute nicht erreichbar.')) return;
    await api('restart', 'POST', {}).catch(() => {});
    $('main').innerHTML = '<h2 class="page">Neustart …</h2><p class="lead">Die Seite lädt automatisch neu, sobald die Verwaltung wieder da ist. Klappt das nicht, das Add-on in Home Assistant unter Einstellungen → Add-ons → Clubwerk neu starten (dort sollte „Watchdog“ eingeschaltet sein).</p>';
    const t0 = Date.now();
    const poll = async () => {
      try { const r = await fetch('api/admin/status'); if (r.ok && Date.now() - t0 > 3000) { location.reload(); return; } } catch (e) { /* noch nicht da */ }
      if (Date.now() - t0 < 180000) setTimeout(poll, 2000);
    };
    setTimeout(poll, 3000);
  }

  /* =================== Protokoll =================== */
  /** Browserkennung im Protokoll lesbar: „Mozilla/5.0 (Windows NT 10.0; …) Chrome/141…“ → „Chrome · Windows“ (ganzer Text im Tooltip) */
  const shortUA = t => t.replace(/Mozilla\/5\.0[^]*$/, ua => {
    const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const o = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    return o ? `${b} · ${o}` : b;
  });
  RENDER.protokoll = async () => {
    const rows = await api('audit');
    $('main').innerHTML = `<h2 class="page">Protokoll</h2>
      <p class="lead">Wer hat wann was geändert? Die letzten 500 Einträge – Anmeldungen, Stornos, Übertragungen, Abschlüsse, Preisänderungen, Lieferungen, Sicherungen.</p>
      <div class="row" style="margin-bottom:12px"><label class="f" style="min-width:260px">Filtern<input id="aq" placeholder="Name oder Aktion"></label></div>
      <div class="scroll"><table class="tbl kompakt" id="at"></table></div>`;
    const draw = () => {
      const q = $('aq').value.trim().toLowerCase();
      $('at').innerHTML = '<tr><th>Zeit</th><th>Wer</th><th>Aktion</th><th>Details</th></tr>' + rows
        .filter(r => !q || `${r.username} ${r.action} ${r.detail}`.toLowerCase().includes(q))
        .map(r => `<tr class="${/fehlgeschlagen/.test(r.action) ? 'off' : ''}"><td class="nw">${deTime(r.at)}</td><td>${esc(r.username || '–')}</td><td>${esc(r.action)}</td><td class="muted"${r.detail ? ` title="${esc(r.detail)}"` : ''}>${esc(shortUA(r.detail || ''))}</td></tr>`).join('')
        || '<tr><td colspan="4"><p class="empty">Kein Eintrag passt zum Filter.</p></td></tr>';
    };
    draw(); $('aq').oninput = draw;
  };

  /** Liest die prägenden Farben aus dem Logo (Bild auf Canvas zeichnen, Pixel zählen; bei SVG exakte Hex-Werte bevorzugen). */
  async function logoColors(url) {
    const blob = await fetch(url, { cache: 'reload' }).then(r => { if (!r.ok) throw new Error(); return r.blob(); });
    const svgHex = blob.type.includes('svg') ? [...new Set(((await blob.text()).match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || [])
      .map(h => (h.length === 4 ? '#' + [...h.slice(1)].map(x => x + x).join('') : h).toLowerCase()))] : [];
    const img = new Image();
    const src = URL.createObjectURL(blob);
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
    const W = 160, H = Math.max(1, Math.round(W * (img.naturalHeight || 1) / (img.naturalWidth || 1))) || W;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Math.min(H, 400);
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(src);
    const px = cx.getImageData(0, 0, cv.width, cv.height).data;
    const buckets = new Map();
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 200) continue;
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn < 40 || mx < 40 || mn > 225) continue;          // Weiß, Schwarz, Grau überspringen
      const k = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
      const e = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += r; e.g += g; e.b += b; buckets.set(k, e);
    }
    const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const dist = (a, b) => a.reduce((t, v, i) => t + (v - b[i]) ** 2, 0);
    let list = [...buckets.values()].sort((a, b) => b.n - a.n).map(e => ({ n: e.n, c: [e.r / e.n, e.g / e.n, e.b / e.n] }));
    const merged = [];                                              // ähnliche Töne zusammenfassen
    for (const e of list) { const m = merged.find(x => dist(x.c, e.c) < 900); if (m) m.n += e.n; else merged.push(e); }
    const top = merged.length ? merged[0].n : 0;
    const colors = merged.filter(e => e.n >= top * 0.08).slice(0, 6).map(e => {
      const exact = svgHex.map(h => [h, dist(rgb(h), e.c)]).sort((a, b) => a[1] - b[1])[0];
      return { n: e.n, hex: exact && exact[1] < 2500 ? exact[0] : hex(...e.c) };
    });
    const isGreen = h => { const [r, g, b] = rgb(h); return g > r + 15 && g >= b; };
    const uniq = [...new Set(colors.map(c => c.hex))];
    return { colors: uniq, green: (colors.find(c => isGreen(c.hex)) || colors[0] || {}).hex || null };
  }

  /* =================== Einstellungen =================== */
  /* ---------- Modul deinstallieren: Pflicht-Sicherung + doppelte Bestätigung ---------- */
  async function uninstallModule(id, name) {
    let u;
    try { u = await api(`extensions/${id}/usage`); } catch (e) { return fail(e); }
    const amount = [u.total ? `${u.total.toLocaleString('de-DE')} Datensätze` : '', u.files ? `${u.files} Dateien (Belege)` : '', u.access ? `${u.access} Freischaltungen` : '', u.settings ? `${u.settings} Einstellungen` : ''].filter(Boolean).join(', ') || 'keine Daten';
    if (!await ask(`Modul „${name}“ deinstallieren?\n\nGelöscht werden ${u.what}\nBetroffen: ${amount}.\n\nZuerst wird eine Sicherung erstellt, die du herunterladen musst. Mit ihr lässt sich beim erneuten Installieren alles wiederherstellen.`, { ok: 'Weiter: Sicherung erstellen', danger: true })) return;
    let bk;
    try { bk = await api(`extensions/${id}/backup`, 'POST', {}); } catch (e) { return fail(e); }
    dialog(`<h2>„${esc(name)}“ deinstallieren</h2>
      <p><b>Schritt 1:</b> Sicherung herunterladen und gut aufbewahren (enthält alle Daten des Moduls, auch PINs und Schlüssel).</p>
      <p><a class="btn primary" id="unDl" href="api/admin/extensions/backups/${encodeURIComponent(bk.file)}" download>Sicherung herunterladen</a> <span class="muted s">${esc(bk.file)}</span></p>
      <p><b>Schritt 2:</b> Zum Bestätigen den Modulnamen <b>${esc(name)}</b> eintippen.</p>
      <label class="f"><input id="unName" autocomplete="off" placeholder="${esc(name)}" disabled></label>
      <p class="muted s">Die Sicherung bleibt zusätzlich in der Verwaltung gespeichert und wird beim Installieren angeboten.</p>
      <div class="btns"><button class="btn" id="unNo">Abbrechen</button><button class="btn danger" id="unOk" disabled>Endgültig deinstallieren</button></div>`);
    let downloaded = false;
    const check = () => { $('unOk').disabled = !(downloaded && $('unName').value.trim().toLocaleLowerCase('de') === name.toLocaleLowerCase('de')); };
    $('unDl').addEventListener('click', () => { downloaded = true; $('unName').disabled = false; setTimeout(() => $('unName').focus(), 50); check(); });
    $('unName').oninput = check;
    $('unNo').onclick = closeDialog;
    $('unOk').onclick = () => busy($('unOk'), async () => {
      if (!await ask(`Wirklich „${name}“ deinstallieren?\n\nAlle Daten des Moduls werden jetzt gelöscht. Rückgängig nur über die heruntergeladene Sicherung.`, { ok: 'Ja, deinstallieren', danger: true })) return;
      try {
        await api(`extensions/${id}/uninstall`, 'POST', { file: bk.file, confirm: $('unName').value });
        closeDialog(); toast(`„${name}“ deinstalliert.`); location.hash = '#einstellungen'; location.reload();
      } catch (e) { fail(e); }
    });
  }
  async function installModule(id, name) {
    let u;
    try { u = await api(`extensions/${id}/usage`); } catch (e) { return fail(e); }
    const fmt = b => `${new Date(b.at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} · ${b.size < 1048576 ? Math.max(1, Math.round(b.size / 1024)) + ' KB' : (b.size / 1048576).toFixed(1).replace('.', ',') + ' MB'}`;
    dialog(`<h2>„${esc(name)}“ installieren</h2>
      <p class="muted" style="margin-top:0">Mit welchen Daten?</p>
      <div class="instopts">
        ${u.backups.map((b, i) => `<label class="chk"><input type="radio" name="instSrc" value="${esc(b.file)}" ${i ? '' : 'checked'}> Sicherung vom ${esc(fmt(b))}</label>`).join('')}
        <label class="chk"><input type="radio" name="instSrc" value="upload" ${u.backups.length ? '' : 'checked'}> Sicherung aus Datei …</label>
        <input type="file" id="instFile" accept=".zip,application/zip" style="margin:0 0 0 28px">
        <label class="chk"><input type="radio" name="instSrc" value=""> Ohne Daten – neu beginnen</label>
      </div>
      <div class="btns"><button class="btn" id="inNo">Abbrechen</button><button class="btn primary" id="inOk">Installieren</button></div>`);
    $('instFile').onchange = () => { const r = document.querySelector('[name=instSrc][value=upload]'); if (r) r.checked = true; };
    $('inNo').onclick = closeDialog;
    $('inOk').onclick = () => busy($('inOk'), async () => {
      const v = document.querySelector('[name=instSrc]:checked').value;
      $('inOk').disabled = true;
      try {
        let d;
        if (v === 'upload') {
          const f = $('instFile').files[0];
          if (!f) { $('inOk').disabled = false; return fail(new Error('Bitte die Sicherungsdatei auswählen.')); }
          const r = await fetch(`api/admin/extensions/${id}/install`, { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'application/zip' }, body: f });
          d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Installieren fehlgeschlagen.');
        } else d = await api(`extensions/${id}/install`, 'POST', v ? { file: v } : {});
        closeDialog();
        await ask(`„${name}“ installiert\n\n${d.summary}. Das Modul ist aktiv.`, { okOnly: true, danger: false });
        location.hash = '#einstellungen'; location.reload();
      } catch (e) { $('inOk').disabled = false; fail(e); }
    });
  }


  /* ---------- Sprachen ---------- */
  const LANG_PROMPT = 'Übersetze die angehängte Clubwerk-Sprachdatei vollständig in [ZIELSPRACHE]. Der Schlüssel links ist der deutsche Originaltext und bleibt unverändert, übersetzt wird nur der Wert rechts. Platzhalter wie {0} oder {name} unverändert übernehmen. Kurze Oberflächentexte kurz halten. Im Abschnitt „_meta“ Sprachcode, Namen der Sprache (in der Sprache selbst), Gebietsschema und Schreibrichtung eintragen. Gib die vollständige Datei als JSON zurück.';
  async function renderLanguages() {
    const box = $('langBody'); if (!box) return;
    const d = await api('sprachen');
    const L = window.CWI18N;
    const src = l => l.code === 'de' ? (l.custom ? `Ausgangssprache, ${l.customCount} Begriffe angepasst` : 'Ausgangssprache')
      : l.builtin ? (l.custom ? `Mitgeliefert, ${l.customCount} Texte angepasst` : 'Mitgeliefert') : l.plugin ? (l.custom ? 'Aus Erweiterung, angepasst' : 'Aus Erweiterung') : 'Importiert';
    const bar = p => `<div class="lbar" title="${p} %"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div><span class="lpct">${String(p).replace('.', ',')} %</span>`;
    const opt = (sel, first) => (first ? `<option value="">${esc(first)}</option>` : '') + d.languages.map(l => `<option value="${esc(l.code)}" ${l.code === sel ? 'selected' : ''} translate="no">${esc(l.name)}</option>`).join('');
    box.innerHTML = `
      <table class="tbl ltbl kompakt" style="margin-top:16px"><tr><th>Sprache</th><th>Code</th><th class="hide-md">Herkunft</th><th>Vollständig</th>${d.canEdit ? '<th class="r"></th>' : ''}</tr>
        ${d.languages.map(l => `<tr><td class="lname"><b translate="no">${esc(l.name)}</b>${l.code === d.club ? ' <span class="pill g">Verein</span>' : ''}</td><td translate="no" class="lcode"><code>${esc(l.code)}</code></td><td class="hide-md">${esc(src(l))}</td><td class="lcov">${bar(l.coverage)}</td>
          ${d.canEdit ? `<td class="r"><div class="lact"><a class="btn small" href="api/admin/sprachen/${encodeURIComponent(l.code)}/download">JSON</a><a class="btn small" href="api/admin/sprachen/${encodeURIComponent(l.code)}/download?format=xlsx">Excel</a>${l.custom ? `<button class="btn small danger" data-lrm="${esc(l.code)}" data-lb="${l.builtin || l.plugin ? 1 : 0}">${l.builtin || l.plugin ? 'Zurücksetzen' : 'Löschen'}</button>` : '<span></span>'}</div></td>` : ''}</tr>`).join('')}
      </table>
      ${d.canEdit ? `<h4 class="lh">Sprache hinzufügen oder Übersetzung verbessern</h4>
      <ol class="lsteps">
        <li><b>Herunterladen:</b> eine leere Vorlage für eine neue Sprache – oder oben eine vorhandene Sprache, um sie zu verbessern bzw. Begriffe anzupassen (z. B. „Spieler“ statt „Mitglieder“ im Deutschen).
          <div class="row" style="margin-top:8px"><a class="btn small" href="api/admin/sprachen/vorlage/download">Vorlage als JSON (für KI)</a><a class="btn small" href="api/admin/sprachen/vorlage/download?format=xlsx">Vorlage als Excel (für Übersetzer)</a></div></li>
        <li><b>Übersetzen:</b> die JSON-Datei einer KI (z. B. Claude oder ChatGPT) geben – mit diesem Auftrag:
          <div class="lprompt"><span id="lgPrompt">${esc(LANG_PROMPT)}</span><button class="btn small" id="lgCopy">Kopieren</button></div>
          Die Excel-Datei füllt man in Spalte D aus. Große Dateien dürfen in Teilen übersetzt und nacheinander importiert werden – jeder Import ergänzt die Sprache.</li>
        <li><b>Importieren:</b> die übersetzte Datei (.json oder .xlsx) hier einspielen. Fehlt in der Datei der Sprachcode oder Name, diese Felder ausfüllen.
          <div class="lgimp"><label class="f">Sprachcode<input id="lgCode" placeholder="z. B. fr" maxlength="12"></label><label class="f">Name der Sprache<input id="lgName" placeholder="z. B. Français" maxlength="40"></label>
            <label class="btn primary">Datei importieren …<input type="file" id="lgFile" accept=".json,.xlsx,application/json" hidden></label></div>
          <div id="lgRep"></div></li>
      </ol>` : ''}`;
    if ($('clubLangBody')) $('clubLangBody').innerHTML = `<label class="f" style="max-width:360px">Sprache<select id="lgClub" ${d.canEdit ? '' : 'disabled'}>${opt(d.club)}</select></label>
      <p class="muted s" style="margin:8px 0 0">Für Tablet, Mitglieder-App, E-Mails, Excel- und PDF-Dateien – und als Vorgabe für alle. Wirkt sofort; Tablets übernehmen sie beim nächsten Neuladen.</p>`;
    if (d.canEdit) {
      if ($('lgClub')) $('lgClub').onchange = async e => {
        try { await api('sprachen/verein', 'PUT', { code: e.target.value }); toast('Vereinssprache geändert. Tablets übernehmen sie beim nächsten Neuladen.'); if (L && !L.chosen()) setTimeout(() => location.reload(), 900); else renderLanguages(); }
        catch (err) { toast(err.message, true); renderLanguages(); }
      };
      $('lgCopy').onclick = () => copyText(T(LANG_PROMPT));
      box.querySelectorAll('[data-lrm]').forEach(b => { b.onclick = async () => {
        const c = b.dataset.lrm, keep = b.dataset.lb === '1';
        if (!await ask(keep ? `Eigene Anpassungen für „${c}“ entfernen? Die mitgelieferte Übersetzung bleibt.` : `Sprache „${c}“ löschen?`, { danger: true, ok: keep ? 'Entfernen' : 'Löschen' })) return;
        try { await api('sprachen/' + encodeURIComponent(c), 'DELETE'); toast(keep ? 'Anpassungen entfernt.' : 'Sprache gelöscht.'); renderLanguages(); } catch (err) { toast(err.message, true); }
      }; });
      $('lgFile').onchange = async e => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        const q = new URLSearchParams(); if ($('lgCode').value.trim()) q.set('code', $('lgCode').value.trim()); if ($('lgName').value.trim()) q.set('name', $('lgName').value.trim());
        $('lgRep').innerHTML = '<p class="muted">Wird geprüft …</p>';
        try {
          const r = await fetch('api/admin/sprachen/import?' + q, { method: 'POST', body: f, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(f.name), 'X-Clubwerk': '1' } });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || 'Import fehlgeschlagen.');
          const p = j.report;
          await renderLanguages();
          $('lgRep').innerHTML = `<div class="banner g" style="display:block"><b translate="no">${esc(p.name)} (${esc(p.code)})</b>: ${p.taken} Texte übernommen${p.empty ? `, ${p.empty} noch leer` : ''}${p.unknown ? `, ${p.unknown} gehören nicht zu dieser Version` : ''}${p.same ? `, ${p.same} unverändert deutsch` : ''}.
            ${p.rejected.length ? `<br>Nicht übernommen (Platzhalter verändert): <ul class="lrej">${p.rejected.slice(0, 10).map(x => `<li translate="no">${esc(x.text)}</li>`).join('')}</ul>` : ''}</div>`;
        } catch (err) { $('lgRep').innerHTML = `<div class="banner r">${esc(err.message)}</div>`; }
      };
    }
  }
  RENDER.einstellungen = async () => { await renderSettings(); sectionize(); if ($('bankBody')) renderBank().catch(e => { if ($('bankBody')) $('bankBody').innerHTML = `<div class="banner r">${esc(e.message)}</div>`; }); if ($('dsBody')) renderPrivacy().catch(e => { if ($('dsBody')) $('dsBody').innerHTML = `<div class="banner r">${esc(e.message)}</div>`; }); renderUpdate().catch(() => {}); renderLanguages().catch(e => { if ($('langBody')) $('langBody').innerHTML = `<div class="banner r">${esc(e.message)}</div>`; }); };

  /* =================== Mein Konto (Benutzerchip): Passwort, Sprache und Aussehen in diesem Browser, E-Mail-Absender =================== */
  RENDER.konto = async () => {
    const L = window.CWI18N, cur = L ? L.chosen() : '';
    const club = L ? (L.langs.find(x => x.code === L.club) || { name: L.club }).name : '';
    $('main').innerHTML = `<h2 class="page">Mein Konto</h2><p class="lead">Passwort, Sprache und Aussehen – das gilt nur für dich.</p>
      <div class="card"><h3>Mein Passwort</h3><div class="row">
        <label class="f">Aktuelles Passwort<input type="password" id="pwCur" autocomplete="current-password"></label>
        <label class="f">Neues Passwort<input type="password" id="pwNew" autocomplete="new-password"></label></div>
        <div class="btns"><button class="btn primary" id="savePw">Passwort ändern</button></div></div>
      <div class="card"><h3>Anzeige in diesem Browser</h3><div class="row">
        ${L ? `<label class="f" style="min-width:240px">Meine Sprache<select id="lgMine">${[['', T('Wie der Verein ({0})', [club])], ...L.langs.map(x => [x.code, x.name])].map(([c, n]) => `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}${c ? ' translate="no"' : ''}>${esc(n)}</option>`).join('')}</select></label>` : ''}
        <label class="f" style="min-width:200px">Darstellung<select id="themeSel">${[['auto', 'Wie das Gerät'], ['light', 'Hell'], ['dark', 'Dunkel'], ['hc', 'Hoher Kontrast']].map(([k, l]) => `<option value="${k}" ${theme() === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <p class="muted s" style="margin:8px 0 0">Wirkt sofort und nur in diesem Browser. Tablet, E-Mails und die Vorgabe für alle legt die Vereinssprache fest (Einstellungen › Verein).</p></div>
      ${can('email') ? '<div id="mailMeBox"></div>' : ''}`;
    $('savePw').onclick = async () => { try { await api('password', 'POST', { current: $('pwCur').value, next: $('pwNew').value }); toast('Passwort geändert.'); $('pwCur').value = $('pwNew').value = ''; } catch (e) { fail(e); } };
    if ($('lgMine')) $('lgMine').onchange = e => L.setLang(e.target.value);
    $('themeSel').onchange = e => { if (window.CWTheme) CWTheme.set(e.target.value); };
    if ($('mailMeBox') && window.GK.mailMe) await window.GK.mailMe($('mailMeBox')).catch(e => { $('mailMeBox').innerHTML = `<div class="banner r">${esc(e.message)}</div>`; });
  };

  /* ---------- Update per ZIP-Upload ---------- */
  async function renderUpdate() {
    const el = $('updBody'); if (!el) return;
    const u = await api('update/status');
    const nodeOld = u.nodeOld ? '<div class="banner a" style="display:block">Die Node.js-Version enthält noch nicht die Sicherheitskorrekturen vom Oktober 2026. Clubwerk lehnt komprimierte Anfragen deshalb ab. In Home Assistant beim Add-on Clubwerk „Neu bauen“ klicken, das holt die neueste Node.js-Version.</div>' : '';
    if (!u.addonDir) {
      el.innerHTML = `<p>Installiert: <b>${esc(u.current)}</b> · Node.js <b translate="no">${esc(u.node || '–')}</b></p>${nodeOld}` + (u.origin === 'repository'
        ? '<p class="muted s">Diese Installation kommt aus einem Add-on-Repository (z. B. GitHub). Neue Versionen zeigt Home Assistant unter <b>Einstellungen → Add-ons</b> mit „Aktualisieren“ an.</p>'
        : `<div class="banner a" style="display:block"><b>Das Hochladen ist noch nicht freigeschaltet.</b> Home Assistant hat die neuen Rechte des Add-ons (Zugriff auf den Ordner „addons“) noch nicht übernommen – „Neu bauen“ reicht dafür nicht. So geht es einmalig:
          <ol style="margin:8px 0 0 18px;padding:0;font-weight:500"><li>Einstellungen → Add-ons → <b>Add-on-Store</b> → oben rechts <b>⋮ → Nach Updates suchen</b>.</li>
          <li>Zurück zum Add-on „Clubwerk“ → <b>Aktualisieren</b> klicken (nicht „Neu bauen“). Erscheint kein „Aktualisieren“, liegt im Ordner „addons“ noch die gleiche Version wie installiert – dann zuerst das neue Paket per Samba hineinkopieren.</li>
          <li>Danach diese Seite neu laden.</li></ol></div>${u.supervisorError ? `<p class="muted s">Hinweis von Home Assistant: ${esc(u.supervisorError)}</p>` : ''}`);
      return;
    }
    const res = u.reserves.length ? `<div class="scroll" style="margin-top:14px"><table class="tbl" style="table-layout:fixed"><tr><th>Frühere Version (Reserve)</th><th style="width:170px">gesichert am</th><th class="r" style="width:220px"></th></tr>
      ${u.reserves.map(r => `<tr><td><b>${esc(r.version)}</b></td><td>${esc(new Date(r.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td>
        <td class="r">${u.viaIngress ? `<button class="btn small" data-rb="${esc(r.name)}" data-rv="${esc(r.version)}">Zurück auf ${esc(r.version)} …</button>` : ''}</td></tr>`).join('')}</table></div>` : '';
    el.innerHTML = `<div class="kpis" style="margin-bottom:12px"><div class="kpi"><div class="l">Installiert</div><div class="v">${esc(u.current)}</div></div>
        <div class="kpi"><div class="l">Neues Paket</div><div class="v">${u.staged ? esc(u.staged.version) : '–'}</div></div>
        <div class="kpi"><div class="l">Letztes Update</div><div class="v">${u.lastOk ? esc(new Date(u.lastOk).toLocaleDateString('de-DE')) : '–'}</div></div>
        <div class="kpi"><div class="l">Node.js</div><div class="v" translate="no">${esc(u.node || '–')}</div></div></div>
      ${nodeOld}
      ${u.lastError ? `<div class="banner r" style="display:block">Home Assistant hat das Update nicht automatisch gestartet (${esc(u.lastError)}). Die neuen Dateien liegen schon bereit: <b>Einstellungen → Add-ons → Clubwerk → Aktualisieren</b> (oder „Neu bauen“).</div>` : ''}
      ${!u.viaIngress ? '<div class="banner a" style="display:block">Updates gehen aus Sicherheitsgründen nur, wenn die Verwaltung über die <b>Home-Assistant-Seitenleiste</b> geöffnet ist.</div>' : `
      <p class="muted s" style="margin-top:0">Das Gesamtpaket (ZIP) hier hochladen – genau die Datei, die sonst per Samba kopiert wird. Clubwerk prüft das Paket, legt vorher automatisch eine Sicherung an, ersetzt den Ordner und lässt Home Assistant die neue Version bauen. Der bisherige Stand bleibt als Reserve erhalten.</p>
      <div class="row"><label class="btn primary">ZIP-Paket hochladen …<input type="file" id="updFile" accept=".zip,application/zip" hidden></label></div>
      <div id="updStage"></div>`}
      ${res}`;
    if ($('updFile')) $('updFile').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      $('updStage').innerHTML = '<p class="muted" style="margin-top:12px">Wird hochgeladen und geprüft …</p>';
      try {
        const r = await fetch('api/admin/update/upload', { method: 'POST', body: f, headers: { 'Content-Type': 'application/zip', 'X-Clubwerk': '1' } });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Fehler');
        await renderUpdate();   // Kennzahlen + geprüftes Paket anzeigen
      } catch (err) { $('updStage').innerHTML = ''; fail(err); }
      e.target.value = '';
    };
    if (u.staged && $('updStage')) stageView({ current: u.current, ...u.staged });
    el.querySelectorAll('[data-rb]').forEach(b => b.onclick = async () => {
      const pw = await askText(`Zurück auf Version ${b.dataset.rv}?\n\nVorher wird automatisch gesichert. Die Daten (Mitglieder, Buchungen …) bleiben, nur das Programm wird ersetzt. Bitte mit deinem Passwort bestätigen.`, '', { password: true, ok: 'Zurück' });
      if (pw === null) return;
      try { await api('update/rollback', 'POST', { name: b.dataset.rb, myPassword: pw }); waitForRestart(); } catch (e) { fail(e); }
    });
  }
  /** Änderungsliste (einfaches Markdown: ## Version, - Punkt, **fett**) sicher darstellen */
  const mdLite = t => esc(t).split('\n').map(l => l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')).map(l => (/^## /.test(l) ? `<div style="font-weight:700;margin:8px 0 2px">Version ${l.slice(3)}</div>` : /^- /.test(l) ? `<div style="padding-left:14px;text-indent:-10px">• ${l.slice(2)}</div>` : l ? `<div>${l}</div>` : '')).join('');
  function stageView(j) {
    $('updStage').innerHTML = `<div class="banner g" style="margin-top:12px;display:block"><b>Paket geprüft:</b> Version ${esc(j.current)} → <b>${esc(j.version)}</b> · ${j.files} Dateien · ${(j.size / 1048576).toFixed(1).replace('.', ',')} MB
        ${j.depsChanged ? '<br>Diese Version bringt neue Bibliotheken mit – das Neubauen dauert etwas länger und braucht Internet.' : ''}
        ${j.shaShort ? `<br>Prüfsumme <code translate="no" style="user-select:all">${esc(j.shaShort)}</code> – zum Gegenprüfen steht dieselbe Zahl im GitHub-Repository in „PRUEFSUMMEN.md“ bei Version ${esc(j.version)}. Weicht sie ab, das Paket nicht übernehmen.` : ''}</div>
      ${j.changelog ? `<details style="margin-top:8px"><summary>Was ist neu?</summary><div class="muted s" style="margin-top:6px;line-height:1.5">${mdLite(j.changelog)}</div></details>` : ''}
      <div class="row" style="margin-top:12px"><label class="f" style="flex:1;max-width:340px">Dein Passwort zur Bestätigung<input type="password" id="updPw" autocomplete="current-password"></label>
        <button class="btn primary" id="updGo">Update auf ${esc(j.version)} einspielen</button></div>`;
    $('updGo').onclick = async () => {
      $('updGo').disabled = true; $('updGo').textContent = 'Sichert und ersetzt …';
      try { await api('update/apply', 'POST', { myPassword: $('updPw').value }); waitForRestart(); }
      catch (e) { $('updGo').disabled = false; $('updGo').textContent = `Update auf ${j.version} einspielen`; fail(e); }
    };
  }
  /** Nach dem Auslösen: warten, bis die alte Version weg und die neue da ist, dann neu laden */
  function waitForRestart() {
    dialog(`<h2>Update läuft</h2><p>Home Assistant baut jetzt die neue Version. Das dauert meist 2 bis 10 Minuten. Diese Seite lädt sich danach von selbst neu – bitte offen lassen.</p><div class="vh-dots" id="updWait">Warte auf Home Assistant …</div>`);
    let wentDown = false; const t0 = Date.now();
    const tick = async () => {
      let up = false, st = null;
      try { const r = await fetch('api/admin/update/status', { headers: { 'X-Clubwerk': '1' }, cache: 'no-store' }); up = true; if (r.ok) st = await r.json(); } catch (e) { up = false; }
      if (!up) { wentDown = true; if ($('updWait')) $('updWait').textContent = 'Neue Version wird gebaut und gestartet …'; }
      if (up && wentDown) { location.reload(); return; }
      if (up && st && st.lastError) { closeDialog(); renderUpdate(); return; }
      if (Date.now() - t0 > 20 * 60000) { if ($('updWait')) $('updWait').textContent = 'Das dauert ungewöhnlich lange – bitte unter Einstellungen → Add-ons → Clubwerk nachsehen.'; return; }
      setTimeout(tick, 4000);
    };
    setTimeout(tick, 3000);
  }
  /* Einstellungen in Unterbereiche aufteilen (Karten werden nach ihrer Überschrift zugeordnet) */
  const SETTING_SECS = [['verein', 'Verein'], ['bank', 'Bankkonten'], ['mail', 'Postfach'], ['erreichbar', 'Erreichbarkeit'], ['datenschutz', 'Datenschutz'], ['tablet', 'Tablet'], ['module', 'Module'], ['sprache', 'Sprachen'], ['update', 'Update']];
  const SETTING_OF = h => (/^Sprachen/.test(h) ? 'sprache' : /^Update/.test(h) ? 'update' : /^(Verein$|Vereinslogo|Vereinssprache)/.test(h) ? 'verein' : /^(E-Mail|Postfach)/.test(h) ? 'mail' : /^Module/.test(h) ? 'module'
    : /^(Vereinsnetz|Weitere Adressen|Verschlüsselung)/.test(h) ? 'erreichbar' : 'tablet');
  /** Karten eines Bereichs nach Bereichen ordnen – Kern-Einstellungen: als Reiter oben; Einstellungsseiten der Module (GK.sectionize, root im Reiter):
   *  alle Karten untereinander mit Abschnittsüberschriften, keine zweite Ebene. o.root: Element mit den Karten (Standard #main) · o.secs: [[key, label]] ·
   *  o.keyOf(überschrift) → key (Karten mit data-set="key" werden direkt zugeordnet) · o.store: Schlüssel für den gemerkten Bereich */
  function sectionize(o = {}) {
    const root = o.root || $('main'), SECS = o.secs || SETTING_SECS, keyOf = o.keyOf || SETTING_OF, store = o.store || 'cw_setsec';
    const cards = [...root.children].filter(el => el.classList.contains('card') || el.dataset.set);
    if (!cards.length) return;
    const by = {};
    cards.forEach(c => { const h = (c.querySelector('h3') || {}).textContent || ''; const k = c.dataset.set || keyOf(window.CWI18N ? CWI18N.orig(h) : h.trim()); (by[k] = by[k] || []).push(c); });
    const secs = SECS.filter(([k]) => by[k]);
    if (!secs.length) return;
    let cur = sget(store); if (!secs.some(([k]) => k === cur)) cur = secs[0][0];
    const wrap = document.createElement('div'); wrap.className = 'settings';
    const badge = o.badges || {};
    const dot = k => (badge[k] ? `<span class="sdot" title="${esc(badge[k] === true ? 'Hier ist etwas zu tun' : badge[k])}"></span>` : '');
    // Innerhalb eines Reiters keine zweite Ebene: alle Karten untereinander; eine Abschnittsüberschrift nur, wo ein Bereich mehrere Karten bündelt (die Suche springt direkt zur Karte)
    if (root !== $('main')) {
      secs.forEach(([k, l]) => { if (secs.length > 1 && (by[k].length > 1 || badge[k])) wrap.insertAdjacentHTML('beforeend', `<h2 class="sec">${esc(l)}${dot(k)}</h2>`); by[k].forEach(c => wrap.appendChild(c)); });
      root.prepend(wrap);
      return;
    }
    // gleiche Reiter wie in den Arbeitsbereichen (Verkauf, Beregnung …) – ein Navigationsmuster für die ganze Verwaltung
    wrap.innerHTML = `<div class="tabs" role="tablist" aria-label="${esc(o.label || 'Bereiche der Einstellungen')}">${secs.map(([k, l]) => `<button type="button" data-sec="${k}">${esc(l)}${dot(k)}</button>`).join('')}</div><div class="secbody"></div>`;
    const body = wrap.querySelector('.secbody');
    secs.forEach(([k]) => by[k].forEach(c => { c.dataset.secof = k; body.appendChild(c); }));
    const head = root.querySelector(':scope > h2.page');
    if (head) fixLead(head).after(wrap); else root.prepend(wrap);
    const show = k => { cur = k; sset(store, k); wrap.querySelectorAll('[data-sec]').forEach(b => { b.classList.toggle('on', b.dataset.sec === k); if (b.dataset.sec === k) revealTab(b); }); body.querySelectorAll('[data-secof]').forEach(c => c.classList.toggle('hidden', c.dataset.secof !== k)); };
    wrap.querySelectorAll('[data-sec]').forEach(b => { b.onclick = () => show(b.dataset.sec); });
    show(cur);
  }

  /* ---------- Datenschutz: Löschfristen aller Module, Hinweis der Mitglieder-App, Verzeichnis (src/datenschutz.js) ---------- */
  async function renderPrivacy() {
    const r = await api('datenschutz');
    const box = $('dsBody'); if (!box) return;
    const unit = (x, n) => (x.unit === 'monate' ? (n === 1 ? 'Monat' : 'Monate') : (n === 1 ? 'Tag' : 'Tage'));
    const field = x => `<span style="display:inline-flex;gap:8px;align-items:center"><label class="f" style="width:96px;flex:none">${x.choices ? `<select data-ds="${esc(x.key)}" aria-label="${esc(x.label)}">${x.choices.map(n => `<option value="${n}" ${n === x.value ? 'selected' : ''}>${n}</option>`).join('')}</select>`
      : `<input data-ds="${esc(x.key)}" value="${x.value}" inputmode="numeric" aria-label="${esc(x.label)}">`}</label><span class="muted" style="min-width:58px">${unit(x, 2)}</span></span>`;
    const b = r.backups, keepM = Math.max(b.monthly, Math.ceil(b.weekly / 4), 1);
    box.innerHTML = `<p class="muted s" style="margin-top:0">Was älter ist, löscht Clubwerk einmal am Tag von selbst. Ins Protokoll kommt nur, wie viel gelöscht wurde – nie, was. Die Fristen sind Vorschläge; im Zweifel stimmt der Verein sie mit seinem Datenschutzbeauftragten oder dem Landesverband ab. Geld (Verkauf, Beiträge, Buchhaltung) und Arbeitszeiten löscht Clubwerk nie von selbst – dafür gelten gesetzliche Aufbewahrungsfristen.</p>
      <div>${r.rows.map(x => `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 0;border-top:1px solid var(--line-soft)">
          <div style="flex:1 1 240px;min-width:0"><b>${esc(x.label)}</b><div class="muted s">${esc(x.text)}</div></div>
          ${field(x)}<span class="muted s" style="min-width:76px;text-align:right">Fällig: <b>${x.due == null ? '–' : x.due}</b></span></div>`).join('')}</div>
      <p class="muted s">„Fällig“: so viele Einträge fallen beim nächsten Lauf weg${r.rows.some(x => x.self) ? '; Mängel und Turniere löschen stündlich selbst' : ''}. ${r.lastRun ? `Letzter Lauf: ${esc(deTime(r.lastRun))}${r.lastResult ? ` – ${esc(r.lastResult)}` : ' – nichts zu löschen'}.` : ''}</p>
      <p class="muted s">Sicherungen: Gelöschtes verschwindet dort, sobald die älteren Sicherungen wegfallen – bei euren Einstellungen nach spätestens ${keepM} ${keepM === 1 ? 'Monat' : 'Monaten'}. Wird eine Sicherung zurückgespielt, löscht Clubwerk Abgelaufenes sofort wieder und anonymisiert bereits anonymisierte Mitglieder erneut.</p>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="dsRun">Jetzt löschen</button><button class="btn primary" id="dsSave">Speichern</button></div>`;
    $('dsSave').onclick = () => busy($('dsSave'), async () => {
      const keep = {}; box.querySelectorAll('[data-ds]').forEach(i => { keep[i.dataset.ds] = i.value; });
      try { await api('datenschutz', 'PUT', { keep }); toast('Gespeichert.'); GK.clean && GK.clean(); renderPrivacy().catch(fail); } catch (e) { fail(e); }
    });
    $('dsRun').onclick = async () => {
      if (!await ask('Jetzt alles löschen, was älter als die Fristen ist?\n\nDas geschieht sonst beim nächsten täglichen Lauf von selbst. Gelöschtes lässt sich nicht wiederherstellen.', { ok: 'Jetzt löschen', danger: true })) return;
      try { const x = await api('datenschutz/run', 'POST', {}); toast(x.parts.length ? 'Gelöscht: ' + x.parts.join(' · ') : 'Nichts zu löschen.'); renderPrivacy().catch(fail); } catch (e) { fail(e); }
    };
    // Datenschutzhinweis der Mitglieder-App
    const nb = $('dsNotice');
    if (nb) {
      nb.innerHTML = `<p class="muted s" style="margin-top:0">Mitglieder sehen den Text einmal beim nächsten Öffnen der App (und nach jeder Änderung) und jederzeit unter „Mein Konto › Datenschutz“. Leer = kein Hinweis.</p>
        <label class="f">Text<textarea id="dsText" rows="12" maxlength="8000" placeholder="Wer ist verantwortlich, welche Daten, wofür, wie lange, welche Rechte …">${esc(r.notice.text)}</textarea></label>
        <div class="row" style="justify-content:space-between;align-items:center;margin-top:12px"><span class="muted s">${r.notice.at ? `Zuletzt geändert: ${esc(deTime(r.notice.at))}` : 'Noch kein Hinweis.'}</span>
          <span class="row" style="gap:8px"><button class="btn" id="dsTpl">Vorlage einsetzen</button><button class="btn primary" id="dsNSave">Speichern</button></span></div>`;
      $('dsTpl').onclick = async () => {
        if ($('dsText').value.trim() && !await ask('Den bisherigen Text durch die Vorlage ersetzen? Gespeichert wird erst mit „Speichern“.', { ok: 'Ersetzen' })) return;
        $('dsText').value = r.template; $('dsText').focus();
      };
      $('dsNSave').onclick = () => busy($('dsNSave'), async () => {
        try { await api('datenschutz/hinweis', 'PUT', { text: $('dsText').value }); toast('Gespeichert.'); GK.clean && GK.clean(); renderPrivacy().catch(fail); } catch (e) { fail(e); }
      });
    }
    if ($('dsReg')) $('dsReg').onclick = async () => { try { printHtml(registryPrint(await api('datenschutz/verzeichnis'))); } catch (e) { fail(e); } };
  }
  /** Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) als Druckvorlage */
  function registryPrint(v) {
    const cell = 'border:1px solid #999;padding:6px 8px;vertical-align:top;text-align:left';
    const blank = '<span style="display:inline-block;min-width:260px;border-bottom:1px solid #111">&nbsp;</span>';
    return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;padding:20px 28px;font-size:12px">
      <h1 style="font-size:20px;margin:0 0 4px">Verzeichnis von Verarbeitungstätigkeiten</h1>
      <div style="color:#444;margin-bottom:14px">nach Art. 30 DSGVO · Vorlage aus Clubwerk vom ${esc(deDate(v.created))} – bitte prüfen und ergänzen</div>
      <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
        <tr><th style="${cell};width:30%">Verantwortlich</th><td style="${cell}">${esc([v.club, v.street, v.city].filter(Boolean).join(', ')) || blank}${v.email ? `<br>${esc(v.email)}` : ''}</td></tr>
        <tr><th style="${cell}">Vertreten durch (Vorstand)</th><td style="${cell}">${blank}</td></tr>
        <tr><th style="${cell}">Datenschutzbeauftragte/r (falls benannt)</th><td style="${cell}">${blank}</td></tr>
        <tr><th style="${cell}">Genutzte Dienste (z. B. Mail-Anbieter, Tunnel)</th><td style="${cell}">${blank}</td></tr>
        <tr><th style="${cell}">Technische und organisatorische Maßnahmen</th><td style="${cell}">Daten liegen auf dem Vereinsserver (kein Cloud-Dienst). Persönliche Daten, Fotos und Dokumente verschlüsselt; Sicherungen nur verschlüsselt. Zugriff nur mit persönlichem Benutzerkonto und Rechten je Aufgabe; Passwörter und PINs nur als Hash; Änderungen werden protokolliert. Feste Löschfristen.</td></tr>
      </table>
      <table style="border-collapse:collapse;width:100%">
        <tr><th style="${cell}">Verarbeitung</th><th style="${cell}">Zweck</th><th style="${cell}">Daten</th><th style="${cell}">Betroffene</th><th style="${cell}">Zugriff</th><th style="${cell}">Löschfrist</th></tr>
        ${v.rows.map(x => `<tr style="page-break-inside:avoid"><td style="${cell}"><b>${esc(x.title)}</b></td><td style="${cell}">${esc(x.purpose)}</td><td style="${cell}">${esc(x.data)}</td><td style="${cell}">${esc(x.persons)}</td><td style="${cell}">${esc(x.access)}</td><td style="${cell}">${esc(x.frist)}</td></tr>`).join('')}
      </table></div>`;
  }

  /* ---------- Bankkonten (zentral für Buchhaltung, Mitgliederverwaltung …) ---------- */
  const fmtIbanC = v => String(v || '').replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
  async function renderBank() {
    const r = await api('bank-accounts');
    const box = $('bankBody'); if (!box) return;
    const dn = id => (r.departments.find(d => d.id === id) || {}).name || '?';
    box.innerHTML = `<p class="muted s" style="margin-top:0">Gilt für alle Module: Rechnungen der Buchhaltung, Lastschriften der Mitgliederverwaltung. Ein Konto ist das Standardkonto; Konten mit Abteilung werden für deren Rechnungen verwendet.</p>
      ${r.rows.length ? `<table class="tbl"><tr><th>Bezeichnung</th><th>IBAN</th><th>Abteilungen</th><th></th></tr>
        ${r.rows.map(a => `<tr class="${a.active ? '' : 'off'}"><td><b>${esc(a.name)}</b>${a.is_default ? ' <span class="pill g">Standard</span>' : ''}${a.active ? '' : ' <span class="pill">inaktiv</span>'}${a.bank ? `<br><span class="muted s">${esc(a.bank)}</span>` : ''}</td>
          <td class="nw">${esc(fmtIbanC(a.iban))}</td><td>${a.departments.length ? esc(a.departments.map(dn).join(', ')) : '<span class="muted s">alle</span>'}</td>
          <td class="r">${r.manage ? `<button class="btn small" data-bk="${a.id}">Bearbeiten</button>` : ''}</td></tr>`).join('')}</table>`
        : '<p class="empty">Noch kein Bankkonto angelegt.</p>'}
      ${r.manage ? '<div class="btns"><button class="btn primary" id="bkNew">+ Bankkonto</button></div>' : ''}`;
    if ($('bkNew')) $('bkNew').onclick = () => bankDialog(null, r);
    box.querySelectorAll('[data-bk]').forEach(b => { b.onclick = () => bankDialog(r.rows.find(a => a.id === +b.dataset.bk), r); });
  }
  function bankDialog(a, r) {
    const v = k => esc((a && a[k]) || '');
    dialog(`<h2>${a ? esc(a.name) : 'Bankkonto anlegen'}</h2>
      <div class="ugrid"><label class="f">Bezeichnung<input id="bkN" value="${v('name')}" placeholder="z. B. Vereinskonto, Padel"></label><label class="f">Kontoinhaber<input id="bkH" value="${v('holder')}" placeholder="${esc(cache.settings.clubName || '')}"></label>
        <label class="f">IBAN<input id="bkI" value="${esc(fmtIbanC(a && a.iban))}" spellcheck="false" autocomplete="off"></label><label class="f">BIC<input id="bkB" value="${v('bic')}" spellcheck="false"></label>
        <label class="f">Kreditinstitut<input id="bkK" value="${v('bank')}"></label><label class="f"><span>&nbsp;</span><label class="chk" style="min-height:40px"><input type="checkbox" id="bkD" ${!a || a.is_default ? 'checked' : ''}> Standardkonto</label></label></div>
      ${r.departments.length ? `<h3 style="margin:16px 0 4px">Abteilungen (optional)</h3><p class="muted s" style="margin:0 0 8px">Rechnungen dieser Abteilungen nennen dieses Konto. Ohne Auswahl gilt das Konto für den ganzen Verein.</p>
        <div class="permgrid">${r.departments.filter(d => d.active !== 0).map(d => `<label class="chk"><input type="checkbox" data-bkd="${d.id}" ${a && a.departments.includes(d.id) ? 'checked' : ''}> ${esc(d.name)}</label>`).join('')}</div>` : ''}
      ${a ? `<label class="chk" style="margin-top:12px"><input type="checkbox" id="bkA" ${a.active ? 'checked' : ''}> Aktiv</label>` : ''}
      <div class="btns">${a ? '<button class="btn ghost danger" id="bkDel">Löschen</button><span style="flex:1"></span>' : ''}<button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="bkOk">Speichern</button></div>`);
    $('c').onclick = closeDialog;
    $('bkOk').onclick = () => busy($('bkOk'), async () => {
      const body = { name: $('bkN').value, holder: $('bkH').value, iban: $('bkI').value, bic: $('bkB').value, bank: $('bkK').value, is_default: $('bkD').checked,
        departments: [...document.querySelectorAll('[data-bkd]:checked')].map(x => +x.dataset.bkd), ...(a ? { active: $('bkA').checked } : {}) };
      try { if (a) await api('bank-accounts/' + a.id, 'PUT', body); else await api('bank-accounts', 'POST', body); closeDialog(); toast('Gespeichert.'); renderBank().catch(fail); } catch (e) { fail(e); }
    });
    if ($('bkDel')) $('bkDel').onclick = async () => {
      if (!await ask(`Bankkonto „${a.name}“ löschen?\n\nRechnungen, die es schon nennen, bleiben unverändert.`)) return;
      try { await api('bank-accounts/' + a.id, 'DELETE'); closeDialog(); toast('Gelöscht.'); renderBank().catch(fail); } catch (e) { fail(e); }
    };
  }
  async function renderSettings() {
    const mayCfg = can('einstellungen'), mayUn = can('deinstallieren');
    const [s, ext, ml, net] = await Promise.all([api('settings'), mayCfg || mayUn ? api('extensions') : null, mayCfg ? api('mail') : null, mayCfg ? api('app/network') : null]);
    let links = ext ? ext.links.slice() : [];
    const SRC = { eingebaut: 'im Paket', mitgeliefert: 'im Paket', hochgeladen: 'hochgeladen', nachinstalliert: 'per Samba' };
    const base = location.origin + location.pathname.replace(/admin(\.html)?$/, '');
    const mayBank = ['einstellungen', 'buchhaltung', 'mitglieder_finanzen'].some(canFull) || (me && me.role === 'oberadmin');
    $('main').innerHTML = `<h2 class="page">Einstellungen</h2><p class="lead">Alles, was für den ganzen Verein gilt: Verein, Bankkonten, Postfach, Erreichbarkeit, Datenschutz, Tablet und Module.</p>
      ${mayBank ? '<div class="card" data-set="bank"><h3>Bankkonten</h3><div id="bankBody"><p class="muted">Wird geladen …</p></div></div>' : ''}
      <div class="card" data-set="sprache"><h3>Sprachen</h3><div id="langBody"><p class="muted">Wird geladen …</p></div></div>
      ${can('einstellungen') ? `<div class="card"><h3>Verein</h3>
        <div class="frm"><label class="f">Vereinsname<input id="club" value="${esc(s.clubName)}"></label>
        <label class="f w1">Vereinsfarbe<span class="row" style="gap:6px;flex-wrap:nowrap;min-width:0"><input type="color" id="clubColorPick" value="${esc(s.clubColor)}" style="width:52px;flex:none;padding:2px">
          <input id="clubColor" value="${esc(s.clubColor)}" style="flex:1;min-width:0" maxlength="7"></span></label>
        <label class="f w1">Zweitfarbe (freiwillig)<span class="row" style="gap:6px;flex-wrap:nowrap;min-width:0"><input type="color" id="clubColor2Pick" value="${esc(s.clubColor2 || '#c0262d')}" style="width:52px;flex:none;padding:2px">
          <input id="clubColor2" value="${esc(s.clubColor2 || '')}" style="flex:1;min-width:0" maxlength="7" placeholder="keine"></span></label>
        <div class="clubprev wall" id="clubPrev"></div>
        <label class="f">Straße und Hausnummer<input id="clubStreet" maxlength="80" value="${esc(s.clubStreet)}" placeholder="z. B. Vereinsweg 1" autocomplete="off"></label>
        <label class="f">PLZ und Ort<input id="clubCity" maxlength="80" value="${esc(s.clubCity)}" placeholder="z. B. 12345 Musterstadt" autocomplete="off"></label>
        <label class="f">E-Mail des Vereins<input id="clubEmail" type="email" maxlength="120" value="${esc(s.clubEmail)}" placeholder="verein@beispiel.de" autocomplete="off"></label>
        <label class="f">Telefon<input id="clubPhone" type="tel" maxlength="40" value="${esc(s.clubPhone)}" autocomplete="off"></label></div>
        <p class="muted s">Anschrift und Kontakt stehen auf Rechnungen, Mitgliedsunterlagen und Bescheinigungen – alle Module lesen sie von hier. Die Vereinsfarbe gilt für Tablet, Verwaltung, Mitglieder-App, Beregnung und Excel-Export; ist sie für Schrift zu hell, dunkelt Clubwerk sie dort automatisch ab (im dunklen Modus hellt es sie auf). Die Zweitfarbe (z. B. aus dem Logo) gibt dem Hintergrund einen zweiten, leichten Schimmer – leer lassen für keine.</p>
        <div class="btns"><button class="btn primary" id="saveClub">Speichern</button></div></div>
      <div class="card" id="tmCard"><h3>Tablet im Vereinsheim</h3>
        <div class="ugrid"><label class="chk ucard"><input type="radio" name="tmOn" value="1" ${s.tablet ? 'checked' : ''}> <span><b>Mit Tablet im Vereinsheim</b><br><span class="muted s">Verkauf, Plätze, Dienste und mehr am Tablet – geschützt mit dem Passwort für das Tablet</span></span></label>
          <label class="chk ucard"><input type="radio" name="tmOn" value="0" ${s.tablet ? '' : 'checked'}> <span><b>Ohne Tablet</b><br><span class="muted s">Nur Verwaltung und Mitglieder-App – keine Tablet-Seiten, kein Tablet-Passwort</span></span></label></div>
        <div class="row ${!s.tablet || s.tabletPw.on ? 'hidden' : ''}" id="tmPwRow" style="margin-top:12px">
          <label class="f" style="flex:1;min-width:200px">Passwort für das Tablet (mind. 8 Zeichen)<input type="password" id="tmPw1" autocomplete="new-password"></label>
          <label class="f" style="flex:1;min-width:200px">Passwort wiederholen<input type="password" id="tmPw2" autocomplete="new-password"></label></div>
        <p class="muted s">Ohne Tablet führt die Tablet-Adresse direkt zur Anmeldung der Verwaltung. Später einschalten geht jederzeit – dann wird zuerst das Passwort für das Tablet festgelegt, bevor eine Tablet-Seite erreichbar ist. Ausschalten meldet alle Tablets ab.</p>
        <div class="btns"><button class="btn primary" id="tmSave">Speichern</button></div></div>
      ${s.tablet && s.tabletPw.on ? `<div class="card" id="tpCard"><h3>Passwort für das Tablet</h3>
        ${s.tabletPw.on ? `<div class="banner g">Vergeben${s.tabletPw.since ? ' seit ' + deTime(s.tabletPw.since) + ' Uhr' : ''} – jedes Gerät braucht einmal das Passwort und bleibt dann freigeschaltet.</div>`
          : '<div class="banner r">Noch kein Passwort vergeben – das Tablet ist gesperrt, bis hier eins festgelegt ist.</div>'}
        <div class="row">
          <label class="f" style="flex:1;min-width:200px">${s.tabletPw.on ? 'Neues Passwort' : 'Passwort'} (mind. 8 Zeichen)<input type="password" id="tpPw1" autocomplete="new-password"></label>
          <label class="f" style="flex:1;min-width:200px">Passwort wiederholen<input type="password" id="tpPw2" autocomplete="new-password"></label>
        </div>
        <p class="muted s">Pflicht zum Schutz der Mitgliederdaten: Ohne Passwort könnte jedes Gerät im WLAN die Namen und Konten am Tablet sehen. Das Tablet im Vereinsheim wird einmal mit dem Passwort freigeschaltet (bis zu 400 Tage, danach einmal neu eingeben). Ein neues Passwort oder „Alle Geräte abmelden“ sperrt alle bisher freigeschalteten Geräte – praktisch, wenn das Passwort die Runde gemacht hat. Angemeldete Admins und die Home-Assistant-Seitenleiste kommen immer auf die Buchungsseite. Die PINs der Mitglieder gelten unabhängig davon.</p>
        <div class="btns"><button class="btn primary" id="tpSave">${s.tabletPw.on ? 'Passwort ändern' : 'Passwort festlegen'}</button></div>
        ${s.tabletPw.on ? '<div class="btns" style="margin-top:6px"><button class="btn danger" id="tpOut">Alle Geräte abmelden …</button></div>' : ''}</div>` : ''}
      ${net ? `<div class="card" id="apNet"><h3>Vereinsnetz</h3>
        <p class="muted s" style="margin:0 0 8px">Welche Adressen als Vereinsnetz gelten – für Mitglieder-App (Beregnung, Türen), Verwaltung, Tablet und Beregnungs-Webapp. Leer = jede private Adresse (192.168.…, 10.…). Empfohlen: euer Netz eintragen, dann kommen Gast-WLAN oder VPN nicht mehr an Verwaltung und Tablet. Die Home-Assistant-Seitenleiste funktioniert immer.</p>
        ${net.wlanNets ? '' : '<div class="banner a" style="margin:0 0 8px;font-weight:400">Noch kein Vereinsnetz eingetragen – jedes private Netz gilt als Vereinsheim.</div>'}
        <div class="row" style="align-items:flex-end;gap:10px"><label class="f" style="flex:1;min-width:220px">Netze (mit Komma)<input id="apNets" value="${esc(net.wlanNets || '')}" placeholder="z. B. 192.168.10.0/24"></label>
          ${/^\d+\.\d+\.\d+\.\d+$/.test(net.myIp || '') && !/^(127\.|172\.30\.3[23]\.)/.test(net.myIp) ? `<button class="btn" id="apNetMine" type="button">Mein Netz übernehmen (${esc(net.myIp.replace(/\.\d+$/, '.0'))}/24)</button>` : ''}
          ${(net.hostNets || []).filter(n => n !== (/^\d+\.\d+\.\d+\.\d+$/.test(net.myIp || '') ? net.myIp.replace(/\.\d+$/, '.0') + '/24' : '')).map(n => `<button class="btn" type="button" data-hnet="${esc(n)}">Netz von Home Assistant übernehmen (${esc(n)})</button>`).join('')}</div>
        <label class="chk" style="margin-top:12px"><input type="checkbox" id="apDirect" ${net.directPublic ? 'checked' : ''}> Direkte Verbindungen aus dem Internet zur Mitglieder-App erlauben (ohne Tunnel – nicht empfohlen; wirkt sofort)</label>
        <div class="btns"><button class="btn primary" id="apNetSave" type="button">Speichern</button></div></div>` : ''}
      ${s.allowedHosts !== undefined ? `<div class="card"><h3>Weitere Adressen</h3><div class="row">
        <label class="f" style="flex:1;min-width:260px">Namen, unter denen die Verwaltung erreichbar ist (mit Komma getrennt)<input id="hostList" value="${esc(s.allowedHosts)}" placeholder="verein.duckdns.org"></label>
</div>
        <p class="muted s">Schutz gegen Angriffe über fremde Webseiten: Clubwerk antwortet nur unter IP-Adressen, Namen wie <b>homeassistant.local</b>, den Namen aus dem HTTPS-Zertifikat und den Adressen der Apps. Wer einen anderen Namen benutzt (z. B. eine eigene DuckDNS-Adresse ohne Zertifikat), trägt ihn hier ein.</p>
        <div class="btns"><button class="btn primary" id="hostSave">Speichern</button></div></div>` : ''}
      ${mayCfg ? `<div class="card"><h3>Verschlüsselung und Zugang von außen</h3>
        <div class="row" style="align-items:center;gap:8px"><span class="pill ${SCHEME === 'https' ? 'g' : 'a'}">${SCHEME === 'https' ? 'HTTPS an' : 'ohne HTTPS'}</span>
          <span class="muted s">${SCHEME === 'https' ? 'Verwaltung, Tablet und Mitglieder-App sind verschlüsselt.' : 'Im WLAN unverschlüsselt – HTTPS in Home Assistant unter Add-on → Konfiguration → „HTTPS für alle Geräte“ einschalten.'}</span></div>
        <p class="muted s" style="margin:10px 0 0">Die öffentliche Adresse der Mitglieder-App (Cloudflare Tunnel) richtest du bei <a href="#app" id="goApSet">Mitglieder-App › Einstellungen</a> ein.</p></div>` : ''}
      <div class="card"><h3>Vereinslogo</h3><div class="row" style="align-items:center">
        <div class="logoprev" id="logoPrev">${s.logo ? `<img src="${esc(s.logo)}" alt="Vereinslogo">` : '<span class="muted s">kein Logo</span>'}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <label class="btn" style="cursor:pointer">Logo hochladen …<input type="file" id="logoFile" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" class="hidden"></label>
          ${s.logoCustom ? '<button class="btn ghost" id="logoDel">Logo entfernen</button>' : ''}
        </div></div>
        <div id="logoColors" class="hidden" style="margin-top:12px"><div class="muted s" style="margin-bottom:6px">Farben im Logo – antippen, um sie als Vereinsfarbe zu übernehmen:</div><div class="row" id="swatches" style="gap:8px"></div></div>
        <p class="muted s">SVG, PNG, JPG oder WebP, max. 2 MB. Das Logo erscheint auf dem Tablet, in der Verwaltung und auf der Anmeldeseite und ist in jeder Datensicherung enthalten. Beim Hochladen wird das Grün aus dem Logo automatisch als Vereinsfarbe übernommen.</p></div>` : ''}
      ${can('einstellungen') ? '<div class="card" data-set="verein"><h3>Vereinssprache</h3><div id="clubLangBody"><p class="muted">Wird geladen …</p></div></div>' : ''}
      ${ml ? `<div class="card" id="mailCard"><h3>Postfach</h3>
        <p class="muted s" style="margin-top:0">Ein Postfach für alle Module: Bestellungen an den Lieferanten, Monatsnachweis der Zeiterfassung und Erweiterungen. Wohin die Mails gehen, legt jedes Modul selbst fest.</p>
        ${ml.ready ? `<div class="banner g" style="margin:0 0 12px">Eingerichtet – Absender ${esc(ml.from)}</div>` : '<div class="banner a" style="margin:0 0 12px">Noch nicht eingerichtet – ohne Postfach können Bestellung und Monatsnachweis nicht verschickt werden.</div>'}
        <div class="mailgrid">
          <label class="f">Server (SMTP)<input id="mlH" value="${esc(ml.host)}" placeholder="z. B. mail.gmx.net" autocomplete="off"></label>
          <label class="f">Port<input id="mlP" value="${esc(ml.port)}" inputmode="numeric"></label>
          <label class="f">Absender-Adresse<input id="mlF" value="${esc(ml.from)}" placeholder="verein@beispiel.de" autocomplete="off"></label>
          <label class="f">Benutzer<input id="mlU" value="${esc(ml.user)}" autocomplete="off"></label>
          <label class="f">Passwort${ml.hasPass ? ' (gespeichert – leer = unverändert)' : ''}<input id="mlW" type="password" autocomplete="new-password"></label>
        </div>
        <div class="row" style="justify-content:space-between;align-items:flex-end;margin-top:12px">
          <div class="row" style="align-items:flex-end"><label class="f" style="width:260px">Testmail an<input id="mlT" type="email" placeholder="deine@adresse.de" autocomplete="email"></label>
            <button class="btn" id="mlTest" ${ml.ready ? '' : 'disabled'} title="${ml.ready ? '' : 'Erst das Postfach speichern'}">Testmail senden</button></div>
          <button class="btn primary" id="mlSave">Postfach speichern</button></div>
        <p class="muted s">Am besten ein eigenes Vereinspostfach. Die Daten stehen beim Anbieter unter „SMTP“ bzw. „Postausgangsserver“, Port meist 587 (manchmal 465). Beispiele: GMX mail.gmx.net, WEB.DE smtp.web.de, IONOS smtp.ionos.de, Strato smtp.strato.de; bei Gmail ein App-Passwort verwenden. Das Passwort wird nie wieder angezeigt und ist in keinem Export enthalten.</p></div>` : ''}
      ${can('einstellungen') ? `<div class="card" data-set="datenschutz"><h3>Löschfristen</h3><div id="dsBody"><p class="muted">Wird geladen …</p></div></div>
        <div class="card" data-set="datenschutz"><h3>Datenschutzhinweis in der Mitglieder-App</h3><div id="dsNotice"></div></div>
        <div class="card" data-set="datenschutz"><h3>Verzeichnis von Verarbeitungstätigkeiten</h3><p class="muted s" style="margin-top:0">Eine Vorlage aus allen eingeschalteten Modulen: Zweck, Daten, betroffene Personen, wer Zugriff hat und die Löschfristen. Der Verein ergänzt Verantwortliche, Datenschutzbeauftragte und genutzte Dienste (z. B. Mail-Anbieter) und bewahrt das Verzeichnis auf.</p>
          <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="dsReg">Verzeichnis drucken</button></div></div>` : ''}
      ${me.role === 'oberadmin' ? '<div class="card" id="updCard"><h3>Update von Clubwerk</h3><div id="updBody"><p class="muted">Wird geladen …</p></div></div>' : ''}
      ${ext ? `<div class="card"><h3>Module & Erweiterungen</h3>
        ${ext.all.length ? `<div class="mods" id="modList">
          <div class="mrow head"><span></span><span>Modul</span><span class="ver">Version</span><span class="st">Status</span><span>Aktiv</span></div>
          ${ext.all.map(x => {
            const off = x.installed === false;
            const items = [
              !off && mayUn ? `<button type="button" class="danger" data-unin="${esc(x.id)}" data-fname="${esc(x.name)}">Deinstallieren …</button>` : '',
              off && x.source === 'hochgeladen' && me.role === 'oberadmin' ? `<button type="button" class="danger" data-extdel="${esc(x.id)}" data-fname="${esc(x.name)}">Dateien entfernen</button>` : '',
            ].join('');
            const vis = [
              !off && x.active && x.configIO ? `<a class="btn small" href="api/admin/extensions/${esc(x.id)}/export" download>Einstellungen exportieren</a><button type="button" class="btn small" data-fimp="${esc(x.id)}" data-fname="${esc(x.name)}">Einstellungen importieren …</button>` : '',
              (x.unapproved || x.pending) && me.role === 'oberadmin' && x.hash ? `<button type="button" class="btn small" data-approve="${esc(x.id)}" data-fname="${esc(x.name)}" data-hash="${esc(x.hash)}">${x.pending ? 'Neue Version prüfen & freigeben …' : 'Prüfen & freigeben …'}</button>` : '',
            ].join('');
            return `<div class="mrow ${off ? 'off' : ''}"><span class="ic">${icon(({ getraenke: 'getraenke', beregnung: 'beregnung', zugang: 'zugang', zeiterfassung: 'zeit' })[x.id] || (MODG['g-' + x.id] && MODG['g-' + x.id].icon) || PAGE_ICON[x.id] || 'modul', 20)}</span>
              <div style="min-width:0"><span class="nm"><b>${esc(x.name)}</b> <span class="pill srcb">${esc(SRC[x.source] || x.source)}</span></span><div class="d">${esc(x.description)}</div>${x.error ? `<div class="s" style="color:var(--red);font-weight:700">${esc(x.error)}</div>` : ''}${x.pending ? '<div class="s" style="color:var(--amber);font-weight:700">Im Netzwerkordner liegt eine geänderte Version. Es läuft weiter die freigegebene – die neue erst nach Prüfen & Freigeben.</div>' : ''}${vis ? `<div class="mact">${vis}</div>` : ''}</div>
              <span class="ver">${esc(x.version)}<span class="pill srca">${esc(SRC[x.source] || x.source)}</span></span>
              <span class="st">${off ? '<span class="pill">Nicht installiert</span>' : x.error ? '<span class="pill r">Fehler</span>' : x.active ? '<span class="pill g">Aktiv</span>' : '<span class="pill">Aus</span>'}</span>
              <span class="act">${off ? (mayUn && !x.error ? `<button class="btn small primary" data-inst="${esc(x.id)}" data-fname="${esc(x.name)}" style="width:84px;padding:0">Installieren</button>` : '<span></span>')
                : `<button class="switch ${x.active ? 'on' : ''}" role="switch" aria-checked="${x.active}" aria-label="${esc(x.name)} aktiv" data-ext="${esc(x.id)}" data-on="${x.active ? 0 : 1}" ${x.error || !mayCfg ? 'disabled' : ''}></button>`}
                <button type="button" class="dots" data-menu="${esc(x.id)}" aria-label="Weitere Aktionen für ${esc(x.name)}" style="${items ? '' : 'visibility:hidden'}">${icon('punkte', 18)}</button></span>
              ${items ? `<div class="menu hidden" data-menufor="${esc(x.id)}">${items}</div>` : ''}</div>`;
          }).join('')}</div>` : '<p class="empty">Keine Module vorhanden.</p>'}
        <p class="muted s" style="margin:12px 0 0">Schalter aus = ausgeblendet, Daten bleiben. Einstellungen exportieren und importieren geht ohne PINs und Schlüssel; über <b>⋯</b> lässt sich ein Modul deinstallieren (mit Pflicht-Sicherung). Mitglieder und Konten bleiben immer erhalten.</p>
        ${me.role === 'oberadmin' ? `<div class="row" style="margin-top:10px;align-items:center"><label class="btn primary" style="cursor:pointer">Erweiterung einspielen (ZIP) …<input type="file" id="extZip" accept=".zip,application/zip" class="hidden"></label>
          <button class="btn hidden" id="extRestart">Jetzt neu starten</button></div>
        <p class="muted s">Eine Erweiterung ist eine ZIP-Datei mit <code>erweiterung.json</code>. Eine neuere Version einer hochgeladenen Erweiterung ersetzt die alte. Wirksam nach einem Neustart. Alternativ per Samba in <code>share/clubwerk/erweiterungen</code> kopieren.</p>` : ''}</div>` : ''}
      ${mayCfg && s.tablet ? `<div class="card"><h3>Leiste am Tablet</h3>
        <p class="muted s" style="margin-top:0">So stehen die Module und Links in der Leiste oben am Tablet – von links nach rechts. Der Schalter „am Tablet zeigen“ wirkt sofort, Reihenfolge und <b>Start-Reiter</b> (erscheint beim Aufruf der Adresse, z. B. <code>…:3100</code>, und nach 30 Sekunden ohne Eingabe) gelten nach „Speichern“.</p>
        <div id="toRows" class="torows"><p class="muted">Lade …</p></div>
        <div class="btns"><button class="btn primary" id="toSave">Speichern</button></div></div>` : ''}
      ${mayCfg && s.tablet ? `<div class="card"><h3>Darstellung am Tablet</h3><div class="row">
        <label class="f" style="min-width:240px">Darstellung<select id="tkTheme">${[['auto', 'Wie das Gerät'], ['light', 'Hell'], ['dark', 'Dunkel'], ['hc', 'Hoher Kontrast']].map(([k, l]) => `<option value="${k}" ${s.tabletTheme === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <p class="muted s">Gilt für alle Tablets des Vereins. „Hoher Kontrast“ hilft an der Theke bei Sonnenlicht: kräftige Ränder, keine Schatten, stärkere Schrift. „Wie das Gerät“ folgt der Einstellung des Tablets (hell, dunkel, mehr Kontrast).</p></div>` : ''}
      ${ext && mayCfg && s.tablet ? `      <div class="card"><h3>Links in der Kopfzeile</h3>
        <p class="muted s" style="margin-top:0">Erscheinen am Tablet oben neben „Verwaltung“ – z. B. Platzbuchung, Vereinsverwaltung, Beregnung. Die Seite läuft eingebettet unter der Kopfzeile, die Kopfzeile bleibt sichtbar. Manche Seiten verbieten das Einbetten – dann bleibt der Bereich leer. Höchstens 8.</p>
        <div id="lnRows"></div>
        <div class="btns"><button class="btn ghost" id="lnAdd">+ Link hinzufügen</button><button class="btn primary" id="lnSave">Links speichern</button></div></div>` : ''}
      ${s.tablet ? `<div class="card"><h3>Tablet & Home Assistant</h3>
        <p>Tablet im Vereins-WLAN: Browser öffnen, <code>${SCHEME}://&lt;${SCHEME === 'https' ? 'Name aus dem Zertifikat' : 'IP-von-Home-Assistant'}&gt;:3100</code> aufrufen und „Zum Startbildschirm hinzufügen“. Beim ersten Aufruf das Passwort für das Tablet eingeben.</p>
        <p>Kennzahlen für Home Assistant (z. B. Bestand knapp) liefert <code>${esc(base)}api/ha/summary</code> – Beispiel für einen REST-Sensor steht in der Anleitung.</p></div>` : ''}`;
    if ($('clubColorPick')) {
      // Vorschau: die berechneten Farben (hell und dunkel) kommen aus theme.css?vorschau=…, ohne zu speichern
      let prevT = 0;
      const prevDraw = () => {
        clearTimeout(prevT);
        prevT = setTimeout(async () => {
          if (!$('clubPrev') || !$('clubColor')) return;   // Seite wurde inzwischen gewechselt
          const c1 = $('clubColor').value, c2 = $('clubColor2').value.trim();
          if (!/^#[0-9a-f]{6}$/i.test(c1)) return;
          try {
            const css = await (await fetch('theme.css?vorschau=' + c1.slice(1) + (/^#[0-9a-f]{6}$/i.test(c2) ? '&vorschau2=' + c2.slice(1) : ''))).text();
            const blk = k => Object.fromEntries([...(css.split(k)[1] || '').split('}')[0].matchAll(/--([\w-]+):([^;}]+)/g)].map(m => [m[1], m[2]]));
            const sample = (lbl, v) => `<div class="cp" style="background:${v['brand-soft']};color:${v['brand-ink']}"><b>${esc(lbl)}</b><span class="cpb" style="background:${v.brand};color:${v['on-brand']}">${esc(T('Speichern'))}</span><span class="cph num" style="background:linear-gradient(135deg,${v['hero-a']},${v['hero-c']});color:${v['on-hero']}">70,00 €</span></div>`;
            $('clubPrev').innerHTML = sample(T('Hell'), blk(':root{')) + sample(T('Dunkel'), blk(':root[data-theme="dark"]{'));
          } catch { /* Vorschau ist nur Beiwerk */ }
        }, 250);
      };
      $('clubColorPick').oninput = () => { $('clubColor').value = $('clubColorPick').value; prevDraw(); };
      $('clubColor').oninput = () => { if (/^#[0-9a-f]{6}$/i.test($('clubColor').value)) $('clubColorPick').value = $('clubColor').value; prevDraw(); };
      const c2look = () => { $('clubColor2Pick').style.opacity = $('clubColor2').value.trim() ? '' : '.35'; };   // ohne Zweitfarbe: Farbfeld blass
      $('clubColor2Pick').oninput = () => { $('clubColor2').value = $('clubColor2Pick').value; c2look(); prevDraw(); };
      $('clubColor2').oninput = () => { if (/^#[0-9a-f]{6}$/i.test($('clubColor2').value)) $('clubColor2Pick').value = $('clubColor2').value; c2look(); prevDraw(); };
      prevDraw();
      c2look();
    }
    if ($('tkTheme')) $('tkTheme').onchange = async () => { try { await api('settings', 'PUT', { tabletTheme: $('tkTheme').value }); toast('Gespeichert – die Tablets übernehmen es beim nächsten Laden.'); } catch (e) { fail(e); } };
    if ($('mlSave')) {
      $('mlSave').onclick = async () => {
        try { await api('mail', 'PUT', { host: $('mlH').value, port: $('mlP').value, user: $('mlU').value, pass: $('mlW').value, from: $('mlF').value }); toast('Postfach gespeichert – jetzt eine Testmail senden.'); location.hash = '#einstellungen'; RENDER.einstellungen().then(() => $('mailCard') && $('mailCard').scrollIntoView()); } catch (e) { fail(e); }
      };
      $('mlTest').onclick = async () => {
        if (!$('mlT').value.trim()) return fail(new Error('Bitte bei „Testmail an“ eine Adresse eintragen.'));
        $('mlTest').disabled = true;
        try { await api('mail/test', 'POST', { to: $('mlT').value }); toast('Testmail verschickt – bitte im Postfach nachsehen.'); } catch (e) { fail(e); }
        $('mlTest').disabled = false;
      };
    }
    if (ext) {
      $('main').querySelectorAll('[data-ext]').forEach(b => b.onclick = async () => {
        try { await api('extensions/' + b.dataset.ext, 'PUT', { active: b.dataset.on === '1' }); location.hash = '#einstellungen'; location.reload(); } catch (e) { fail(e); }
      });
      $('main').querySelectorAll('[data-fimp]').forEach(b => b.onclick = () => funcImport(b.dataset.fimp, b.dataset.fname));
      $('main').querySelectorAll('[data-approve]').forEach(b => b.onclick = () => {
        dialog(`<h2>Erweiterung „${esc(b.dataset.fname)}“ freigeben?</h2>
          <div class="banner a">Eine Erweiterung ist Programmcode, der mit allen Rechten in Clubwerk läuft – sie kann z. B. Türen und Ventile über Home Assistant schalten. Gib sie nur frei, wenn du weißt, woher sie stammt und wer sie in den Ordner gelegt hat.</div>
          <p class="muted">Freigegeben wird genau dieser Stand (Prüfsumme <code>${esc(b.dataset.hash.slice(0, 16))}</code>). Er wird in einen geschützten Bereich kopiert und läuft von dort – spätere Änderungen im Netzwerkordner erscheinen hier als neue Version zum Prüfen. Wirksam nach einem Neustart.</p>
          <label class="f">Dein Passwort zur Bestätigung<input type="password" id="apPw" autocomplete="current-password"></label>
          <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ok">Freigeben</button></div>`);
        $('c').onclick = closeDialog;
        $('ok').onclick = () => busy($('ok'), async () => {
          try { await api(`extensions/${b.dataset.approve}/approve`, 'POST', { password: $('apPw').value, hash: b.dataset.hash }); closeDialog(); toast('Freigegeben – bitte neu starten.'); if ($('extRestart')) $('extRestart').classList.remove('hidden'); }
          catch (e) { fail(e); }
        });
      });
      $('main').querySelectorAll('[data-extdel]').forEach(b => b.onclick = async () => {
        if (!await ask(`Dateien von „${b.dataset.fname}“ entfernen?\n\nDie Erweiterung verschwindet nach einem Neustart ganz aus der Liste. Zum erneuten Installieren muss die ZIP-Datei wieder eingespielt werden. Die Modul-Sicherungen bleiben erhalten.`)) return;
        try { await api('extensions/' + b.dataset.extdel, 'DELETE'); toast('Entfernt – bitte neu starten.'); $('extRestart').classList.remove('hidden'); b.closest('tr').style.opacity = .4; b.disabled = true; } catch (e) { fail(e); }
      });
      if ($('extRestart')) $('extRestart').onclick = restartApp;
      if ($('extZip')) $('extZip').onchange = async () => {
        const f = $('extZip').files[0]; $('extZip').value = ''; if (!f) return;
        if (f.size > 25 * 1024 * 1024) return fail(new Error('Die Datei ist zu groß (max. 25 MB).'));
        const pw = await askText(`„${f.name}“ einspielen?\n\nErweiterungen laufen als Programm in Clubwerk. Bitte nur Dateien aus sicherer Quelle einspielen und mit deinem Passwort bestätigen.`, '', { password: true, ok: 'Einspielen' });
        if (pw === null || pw === '') return;
        try {
          const r = await fetch('api/admin/extensions/upload', { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'application/zip', 'X-Mein-Passwort': encodeURIComponent(pw) }, body: f });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'Hochladen fehlgeschlagen.');
          toast(`${d.name} ${d.version} ${d.update ? 'aktualisiert' : 'eingespielt'} – wirksam nach dem Neustart.`);
          $('extRestart').classList.remove('hidden'); $('extRestart').classList.add('primary');
        } catch (e) { fail(e); }
      };
      const closeMenus = () => $('main').querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
      $('main').querySelectorAll('[data-menu]').forEach(b => b.onclick = e => {
        e.stopPropagation();
        const m = $('main').querySelector(`[data-menufor="${b.dataset.menu}"]`); const was = m && !m.classList.contains('hidden');
        closeMenus(); $('main').querySelectorAll('.dots').forEach(d => d.classList.remove('on'));
        if (m && !was) { m.classList.remove('hidden'); b.classList.add('on'); }
      });
      $('main').querySelectorAll('.menu').forEach(m => m.addEventListener('click', () => setTimeout(closeMenus, 0)));
      // Klick außerhalb schließt die Menüs – ein einziger Listener für die ganze Sitzung (die Seite wird oft neu aufgebaut)
      if (!closeMenusBound) { closeMenusBound = true; document.addEventListener('click', e => { if (!e.target.closest('.menu,[data-menu]')) { $('main').querySelectorAll('.menu').forEach(m => m.classList.add('hidden')); document.querySelectorAll('.dots.on').forEach(d => d.classList.remove('on')); } }); }
      $('main').querySelectorAll('[data-unin]').forEach(b => b.onclick = () => uninstallModule(b.dataset.unin, b.dataset.fname));
      $('main').querySelectorAll('[data-inst]').forEach(b => b.onclick = () => installModule(b.dataset.inst, b.dataset.fname));
    }
    if (ext && $('lnRows')) {
      const rowsHtml = () => {
        $('lnRows').innerHTML = links.map((l, i) => `<div class="row" style="flex-wrap:nowrap;margin-top:${i ? 10 : 0}px">
          <label class="f" style="width:220px">Beschriftung<input data-ll="${i}" value="${esc(l.label)}" maxlength="30" placeholder="z. B. Platzbuchung"></label>
          <label class="f" style="flex:1;min-width:0">Adresse<input data-lu="${i}" value="${esc(l.url)}" placeholder="https://…"></label>
          <button class="btn ghost" data-lx="${i}">Entfernen</button></div>`).join('') || '<p class="empty">Noch keine Links.</p>';
        $('lnRows').querySelectorAll('[data-ll]').forEach(x => x.oninput = () => { links[+x.dataset.ll].label = x.value; });
        $('lnRows').querySelectorAll('[data-lu]').forEach(x => x.oninput = () => { links[+x.dataset.lu].url = x.value; });
        $('lnRows').querySelectorAll('[data-lx]').forEach(x => x.onclick = () => { links.splice(+x.dataset.lx, 1); rowsHtml(); });
        $('lnAdd').disabled = links.length >= 8;
      };
      rowsHtml();
      $('lnAdd').onclick = () => { if (links.length < 8) { links.push({ label: '', url: '' }); rowsHtml(); } };
      $('lnSave').onclick = async () => {
        try { const r = await api('settings/links', 'PUT', { links }); links = r.links; rowsHtml(); toast('Links gespeichert – Tablets übernehmen sie beim nächsten Laden.'); } catch (e) { fail(e); }
      };
    }
    if ($('toRows')) {
      let items = [], start = null, sws = [];
      const swBtn = (x, on) => `<button type="button" class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(x.label)} am Tablet zeigen" data-tsw="${esc(x.id)}" data-on="${on ? 0 : 1}"></button>`;
      const draw = () => {
        const swOf = id => sws.find(y => y.id === id);
        const off = sws.filter(x => !x.on && !items.some(i => i.id === x.id));
        $('toRows').innerHTML = items.length || off.length ? items.map((x, i) => `<div class="torow"><span class="ton">${i + 1}</span><span class="tnm"><b translate="no">${esc(x.label)}</b>${swOf(x.id) ? swBtn(x, true) : ''}</span><span class="muted s">${swOf(x.id) ? '' : x.url ? 'Link' : 'Modul'}</span>
          <label class="chk tostart"><input type="radio" name="toStart" data-st="${esc(x.key)}" ${x.key === start ? 'checked' : ''}> Start</label>
          <span class="toact"><button class="btn small" data-up="${i}" ${i ? '' : 'disabled'} aria-label="nach links">↑</button><button class="btn small" data-dn="${i}" ${i < items.length - 1 ? '' : 'disabled'} aria-label="nach rechts">↓</button></span></div>`).join('')
          + off.map(x => `<div class="torow off"><span class="ton"></span><span class="tnm"><b translate="no">${esc(x.label)}</b>${swBtn(x, false)}</span><span class="muted s"></span><span class="toact"></span></div>`).join('')
          : '<p class="empty">Kein Modul mit Tablet-Seite aktiv.</p>';
        $('toRows').querySelectorAll('[data-up]').forEach(b => { b.onclick = () => { const i = +b.dataset.up; [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); }; });
        $('toRows').querySelectorAll('[data-dn]').forEach(b => { b.onclick = () => { const i = +b.dataset.dn; [items[i + 1], items[i]] = [items[i], items[i + 1]]; draw(); }; });
        $('toRows').querySelectorAll('[data-st]').forEach(r => { r.onchange = () => { start = r.dataset.st; }; });
        $('toRows').querySelectorAll('[data-tsw]').forEach(b => { b.onclick = () => busy(b, async () => {
          try { const r = await api('settings/tablet-show', 'PUT', { id: b.dataset.tsw, on: b.dataset.on === '1' }); items = r.items; start = r.start; sws = r.switches || []; draw(); toast(b.dataset.on === '1' ? 'Wird am Tablet gezeigt – die Tablets übernehmen es beim nächsten Laden.' : 'Am Tablet ausgeblendet.'); } catch (e) { fail(e); } }); });
      };
      api('settings/tablet-order').then(d => { if (!$('toRows')) return; items = d.items || []; start = d.start; sws = d.switches || []; draw(); }).catch(() => { if ($('toRows')) $('toRows').innerHTML = '<p class="muted">Nicht abrufbar.</p>'; });   // Seite inzwischen verlassen → nichts mehr schreiben
      $('toSave').onclick = async () => { try { const r = await api('settings/tablet-order', 'PUT', { order: items.map(x => x.key), start }); items = r.items; start = r.start; sws = r.switches || []; draw(); toast('Gespeichert – die Tablets übernehmen es beim nächsten Laden.'); } catch (e) { fail(e); } };
    }
    if ($('apNet')) {
      if ($('apNetMine')) $('apNetMine').onclick = () => { $('apNets').value = net.myIp.replace(/\.\d+$/, '.0') + '/24'; };
      $('main').querySelectorAll('[data-hnet]').forEach(b => { b.onclick = () => { const v = $('apNets').value.trim(); if (!v.split(/[\s,;]+/).includes(b.dataset.hnet)) $('apNets').value = v ? v + ', ' + b.dataset.hnet : b.dataset.hnet; }; });
      $('apNetSave').onclick = () => busy($('apNetSave'), async () => { try { await api('settings/app', 'PUT', { wlanNets: $('apNets').value }); clubNetsMissing = !$('apNets').value.trim(); toast($('apNets').value.trim() ? 'Gespeichert – nur diese Netze gelten als Vereinsnetz.' : 'Gespeichert – jede private Adresse gilt als Vereinsnetz.'); } catch (e) { fail(e); } });
      $('apDirect').onchange = async () => { const on = $('apDirect').checked;
        if (on && !await ask('Direkte Verbindungen aus dem Internet erlauben?\n\nDann kommt die Mitglieder-App auch über eine Portfreigabe am Router an – ohne den Schutz des Cloudflare Tunnels und meist ohne HTTPS. Nur einschalten, wenn ihr einen eigenen Reverse Proxy mit HTTPS davor betreibt.', { danger: true, ok: 'Erlauben' })) { $('apDirect').checked = false; return; }
        try { await api('settings/app', 'PUT', { directPublic: on }); toast(on ? 'Direkte Verbindungen erlaubt.' : 'Direkte Verbindungen aus dem Internet werden abgewiesen.'); } catch (e) { $('apDirect').checked = !on; fail(e); } };
    }
    if ($('goApSet')) $('goApSet').onclick = e => { e.preventDefault(); sset('cw_appsec', 'einstellungen'); go('app'); };
    if ($('hostSave')) $('hostSave').onclick = async () => { try { const r = await api('settings/hosts', 'PUT', { hosts: $('hostList').value }); $('hostList').value = r.hosts; toast('Gespeichert.'); } catch (e) { fail(e); } };
    if ($('tmSave')) {
      const tmPick = () => (document.querySelector('[name="tmOn"]:checked') || {}).value === '1';
      // Passwortfelder, solange für das Tablet noch keins vergeben ist und „Mit Tablet“ gewählt ist
      document.querySelectorAll('[name="tmOn"]').forEach(r => { r.onchange = () => $('tmPwRow').classList.toggle('hidden', !tmPick() || s.tabletPw.on); });
      $('tmSave').onclick = () => busy($('tmSave'), async () => {
        const on = tmPick();
        if (on === s.tablet && (!on || s.tabletPw.on) && s.tabletChosen) { toast('Gespeichert.'); return; }
        if (!on && !await ask('Tablet ausschalten?\n\nAlle Tablet-Seiten verschwinden, die Tablet-Adresse führt zur Anmeldung der Verwaltung, und alle freigeschalteten Tablets werden abgemeldet. Daten bleiben erhalten.', { ok: 'Ausschalten', danger: true })) return;
        if (on && !s.tabletPw.on && $('tmPw1').value !== $('tmPw2').value) return fail(new Error('Die beiden Passwörter stimmen nicht überein.'));
        try {
          await api('settings/tablet', 'PUT', { on, password: on && !s.tabletPw.on ? $('tmPw1').value : undefined });
          tabletOnUI = on; tabletPwMissing = false; clean();
          toast(on ? 'Tablet eingeschaltet – am Tablet einmal das Passwort eingeben.' : 'Tablet ausgeschaltet.');
          RENDER.einstellungen();
        } catch (e) { fail(e); }
      });
    }
    if ($('tpSave')) $('tpSave').onclick = async () => {
      if ($('tpPw1').value !== $('tpPw2').value) return fail(new Error('Die beiden Passwörter stimmen nicht überein.'));
      try {
        await api('settings/tablet-password', 'PUT', { password: $('tpPw1').value });
        toast(s.tabletPw.on ? 'Passwort geändert – alle anderen Geräte müssen es neu eingeben.' : 'Passwort festgelegt. Am Tablet einmal eingeben – dieses Gerät ist schon freigeschaltet.'); tabletPwMissing = false;
        RENDER.einstellungen();
      } catch (e) { fail(e); }
    };
    if ($('tpOut')) $('tpOut').onclick = async () => {
      if (!await ask('Alle freigeschalteten Geräte abmelden? Danach muss auch das Tablet im Vereinsheim das Passwort neu eingeben.')) return;
      try { await api('settings/tablet-password/logout-all', 'POST', {}); toast('Alle Geräte abgemeldet.'); } catch (e) { fail(e); }
    };
    if ($('saveClub')) $('saveClub').onclick = async () => {
      try {
        await api('settings', 'PUT', { clubName: $('club').value, clubColor: $('clubColor').value, clubColor2: $('clubColor2').value.trim(), clubStreet: $('clubStreet').value, clubCity: $('clubCity').value, clubEmail: $('clubEmail').value, clubPhone: $('clubPhone').value });
        toast('Gespeichert.'); refreshIcon();
        document.querySelector('link[href^="theme.css"]').href = 'theme.css?' + Date.now();
      } catch (e) { fail(e); }
    };
    const applyColor = async (hex, quiet) => {
      try {
        await api('settings', 'PUT', { clubColor: hex });
        refreshIcon();
        $('clubColor').value = $('clubColorPick').value = hex;
        document.querySelector('link[href^="theme.css"]').href = 'theme.css?' + Date.now();
        document.querySelectorAll('#swatches .swatch').forEach(b => b.classList.toggle('on', b.dataset.c === hex));
        if (!quiet) toast('Vereinsfarbe ' + hex + ' übernommen.');
      } catch (e) { fail(e); }
    };
    const showSwatches = (colors, chosen) => {
      if (!colors.length) return;
      $('swatches').innerHTML = colors.map(c => `<button class="swatch${c === chosen ? ' on' : ''}" data-c="${c}" title="${c}" style="background:${c}"></button>`).join('');
      $('swatches').querySelectorAll('.swatch').forEach(b => b.onclick = () => applyColor(b.dataset.c));
      $('logoColors').classList.remove('hidden');
    };
    if ($('logoFile')) {
      if (s.logo) logoColors(s.logo).then(c => showSwatches(c.colors, s.clubColor)).catch(() => {});
      $('logoFile').onchange = async () => {
        const f = $('logoFile').files[0]; if (!f) return;
        if (f.size > 2 * 1024 * 1024) return fail(new Error('Das Logo ist zu groß (max. 2 MB).'));
        try {
          const r = await fetch('api/admin/logo', { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'application/octet-stream' }, body: f });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'Hochladen fehlgeschlagen.');
          brand.logo = d.logo;
          const c = await logoColors(d.logo).catch(() => ({ colors: [], green: null }));
          if (c.green) await applyColor(c.green, true);
          await makeAppIcon().catch(() => {});
          toast(c.green ? `Logo gespeichert – Vereinsfarbe ${c.green} aus dem Logo übernommen.` : 'Logo gespeichert.');
          showShell();   // Navigation mit neuem Logo
        } catch (e) { fail(e); }
      };
    }
    if ($('logoDel')) $('logoDel').onclick = async () => {
      try { const d = await api('logo', 'DELETE'); brand.logo = d.logo; toast('Logo entfernt.'); showShell(); } catch (e) { fail(e); }
    };
  };

  start().catch(fail);
})();
