'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });   // einmal anlegen statt je Betrag
  const euro = c => EUR.format(c / 100);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const IDLE_MS = 60 * 1000;      // nach 60 s ohne Eingabe zurück zum Start
  const DONE_MS = 20 * 1000;      // Bestätigung 20 s sichtbar (Rückgängig möglich)

  let state = { members: [], articles: [], event: null };
  let letter = null;
  let session = null;   // { token, member?, event?, mode }
  let cart = new Map(); // articleId -> qty
  let customs = [];     // frei eingegebene Beträge: { cents, note }
  // Schlüssel je Warenkorb-Absenden: Wiederholt das Tablet dieselbe Anfrage (Doppeltipp, WLAN-Aussetzer), bucht der
  // Server nicht noch einmal, sondern antwortet mit dem ersten Ergebnis. Neue Auswahl → neuer Schlüssel.
  let bookReqId = null;
  const newReqId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
  let evFilter = '';
  let idleTimer = null;

  async function api(url, body) {
    const opts = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && data.gate) { showGate(data.unset); throw Object.assign(new Error(data.error), { status: 401, gate: true }); }
    if (!r.ok) throw Object.assign(new Error(data.error || 'Fehler'), { status: r.status });
    return data;
  }

  /* ---------- Optionaler Passwortschutz der Buchungsseite ---------- */
  let gateShown = false;
  function showGate(unset) {
    $('gate').classList.toggle('unset', Boolean(unset));
    if (unset) {   // noch kein Passwort vergeben: Hinweis statt Eingabefeld, alle 30 s neu prüfen
      $('gateTitle').textContent = 'Tablet noch nicht eingerichtet';
      $('gateText').textContent = 'Zum Schutz der Mitgliederdaten braucht das Tablet ein Passwort. Bitte in der Verwaltung unter Einstellungen → Tablet & Kopfzeile → „Passwort für das Tablet“ eins festlegen – danach hier eingeben.';
      clearTimeout(showGate.t); showGate.t = setTimeout(() => { gateShown = false; load(); }, 30000);
    } else {
      $('gateTitle').textContent = 'Buchungsseite gesperrt';
      $('gateText').innerHTML = 'Bitte das Passwort des Vereins eingeben. <br>Dieses Gerät bleibt danach freigeschaltet.';
    }
    if (gateShown) return;
    gateShown = true;
    session = null;
    $('overlay').classList.add('hidden');
    $('gate').classList.remove('hidden');
    fetch('api/branding').then(r => r.json()).then(b => {
      $('gateClub').textContent = b.clubName || '';
      if (b.logo) { $('gateLogo').onerror = () => $('gateLogoBox').classList.add('hidden'); $('gateLogo').src = b.logo; $('gateLogoBox').classList.remove('hidden'); }
    }).catch(() => {});
    $('gatePw').value = ''; $('gateErr').textContent = '';
    setTimeout(() => $('gatePw').focus(), 50);
  }
  async function gateLogin() {
    $('gateErr').textContent = '';
    try {
      const r = await fetch('api/gate/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('gatePw').value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { $('gateErr').textContent = d.error || 'Das hat nicht geklappt.'; $('gatePw').select(); return; }
      gateShown = false;
      $('gate').classList.add('hidden');
      load();
    } catch (e) { $('gateErr').textContent = 'Keine Verbindung zum Server.'; }
  }
  $('gateGo').onclick = gateLogin;
  $('gatePw').addEventListener('keydown', e => { if (e.key === 'Enter') gateLogin(); });

  function toast(msg, error = false) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (error ? ' error' : '');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.add('hidden'), 3500);
  }

  /* ---------- Bildschirm wach halten (die Uhr stellt nav.js) ---------- */
  async function keepAwake() {
    try { if ('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch (e) { /* egal */ }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { keepAwake(); load(); } });

  /* ---------- Sortierung nach Nachname ---------- */
  // wie in der Verwaltung und auf dem Server (names.js): „von/van/de …“ gehören zum Nachnamen, sortiert wird nach dem Kern (von der Heide → H)
  const { splitName, coreLast, lastFirst, nameKey } = window.CWNames;
  const byName = (a, b) => { const x = nameKey(a.name, a.kind), y = nameKey(b.name, b.kind); return x < y ? -1 : x > y ? 1 : 0; };
  const initial = m => coreLast(m.name).charAt(0).toLocaleUpperCase('de').replace(/[ÄÖÜ]/, c => ({ Ä: 'A', Ö: 'O', Ü: 'U' }[c]));

  /* ---------- Startseite ---------- */
  async function load() {
    try {
      state = await api('api/tablet/state');
    } catch (e) {
      if (!e.gate) toast('Keine Verbindung zum Server.', true);
      return;
    }
    // Vereinsname, Logo und Farbe setzt die gemeinsame Kopfzeile (nav.js)
    renderStart();
  }

  const initials = n => { const w = String(n || '').replace(/[()„“"]/g, '').trim().split(/\s+/).filter(Boolean); return esc(((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : (w[0] || '').slice(1, 2))).toLocaleUpperCase('de')); };
  // ruhige Pastellfarben für Initialen – je Name immer dieselbe
  const AVC = [['#F0ECFA', '#4B3A86'], ['#FCE7E4', '#9B2C1F'], ['#FFF1D6', '#8A4B08'], ['var(--brand-soft)', 'var(--brand-ink)'], ['#E3F0FB', '#1C5D99'], ['#FCEDE3', '#9A4A14']];
  const avStyle = n => { let h = 0; for (const ch of String(n || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const [b, f] = AVC[h % AVC.length]; return `--ab:${b};--af:${f}`; };
  /* „Bier alkoholfrei 0,33“ → Name „Bier alkoholfrei“ + Größe „0,33 l“ (für die zweite Zeile der Kachel) */
  const splitSize = n => { const m = String(n).match(/^(.+?)\s+(\d+[,.]\d+)\s*(l|ml|cl)?$/i); return m ? { name: m[1], size: m[2].replace('.', ',') + ' ' + (m[3] || 'l') } : { name: String(n), size: '' }; };
  const card = m => {
    const { first: fn, last: ln } = splitName(m.name);
    return `<button data-id="${m.id}" class="${m.pending ? 'pending' : ''}"><i class="av" style="${avStyle(m.name)}">${m.ph ? `<img src="api/tablet/photo/${m.id}?u=verkauf&v=${esc(m.ph)}" alt="" loading="lazy">` : initials(m.name)}</i><span class="nm"><b>${esc(ln)}${m.pending ? '<span class="tag">neu</span>' : ''}</b><span>${esc(fn) || '&nbsp;'}</span></span></button>`;
  };

  const guestCard = g => {
    const tag = g.paid ? '<span class="tag ok">bezahlt</span>' : '';
    return `<button data-g="${g.id}" class="${g.paid ? 'paid' : ''} ${g.memberId ? '' : 'manual'}"><i class="av" style="${avStyle(g.name)}">${initials(g.name)}</i>
      <span class="nm"><b>${esc(g.memberId ? lastFirst(g.name, g.kind) : g.name)}${tag}</b><span>${g.memberId ? 'Mitglied' : 'Gast'}${g.open_cents ? ` · <span class="amt">${euro(g.open_cents)} offen</span>` : ''}</span></span></button>`;
  };
  /* Artikel: eigenes Bild, Symbol oder Kürzel */
  const tileStyle = a => (!a.image && a.icon && window.ArtIcons && ArtIcons.has(a.icon) ? ArtIcons.style(a.icon) : '');
  // Artikelbilder sofort laden (nicht „lazy“): wird die Kachelseite neu aufgebaut, erscheinen sie aus dem Zwischenspeicher, ohne kurz leer zu blinken
  const artInner = (a, sz) => a.image ? `<img src="api/tablet/artikelbild/${encodeURIComponent(a.image)}" alt="">`
    : a.icon && window.ArtIcons && ArtIcons.has(a.icon) ? ArtIcons.svg(a.icon, sz) : initials(a.name);

  function renderEventList() {
    const ev = state.event;
    const all = (ev.guests || []);
    const q = evFilter.trim().toLocaleLowerCase('de');
    const list = q ? all.filter(g => g.name.toLocaleLowerCase('de').includes(q)) : all;
    $('evHead').innerHTML = `Liste „${esc(ev.name)}“ <small>${all.length} ${all.length === 1 ? 'Name' : 'Namen'} · A–Z</small>`;
    $('evSearch').classList.toggle('hidden', all.length < 16);
    $('evNames').innerHTML = list.map(guestCard).join('') ||
      `<div class="tk-empty" style="grid-column:1/-1">${all.length ? 'Kein Name passt zur Suche.' : 'Noch niemand auf der Liste – mit „+ Namen hinzufügen“ den eigenen Namen eintragen.'}</div>`;
  }

  function renderStart() {
    const ev = state.event;
    $('eventBanner').classList.toggle('hidden', !ev);
    $('evBox').classList.toggle('hidden', !ev);
    $('normalBox').classList.toggle('hidden', Boolean(ev));
    $('special').classList.toggle('hidden', Boolean(ev));   // während der Veranstaltung nur deren Liste
    if (ev) { $('eventName').textContent = ev.name; renderEventList(); }

    const people = state.members.filter(m => m.kind === 'mitglied' && !m.hidden).sort(byName);
    const topIds = new Set(state.top || []);
    const top = people.filter(m => topIds.has(m.id));   // nur zusätzliche Schnellauswahl – alle stehen weiterhin unten in der Gesamtliste

    // Gäste-Deckel: offene Deckel oben, damit Gäste ihren schnell wiederfinden
    const tabs = ev ? [] : (state.tabs || []);
    $('tabsBox').classList.toggle('hidden', !tabs.length || Boolean(letter));
    $('tabs').innerHTML = tabs.map(t => `<button class="tabt" data-tab="${t.id}"><i class="av">${initials(t.name)}</i><span class="nm"><b>${esc(t.name)}</b><span>${euro(t.open_cents)} offen</span></span></button>`).join('') +
      '<button class="addtab" data-tabnew="1"><i class="av">+</i><span class="nm"><b>Neuer Deckel</b><span>für Gäste und Gegner</span></span></button>';

    const q = ($('nameSearch').value || '').trim().toLocaleLowerCase('de');
    $('nameClear').classList.toggle('hidden', !q);
    // Gerade oft hier: nur ohne Buchstabenfilter und ohne Suche, alphabetisch
    const showTop = !letter && !q && top.length > 0;
    $('topBox').classList.toggle('hidden', !showTop);
    $('top').innerHTML = showTop ? top.map(card).join('') : '';
    $('topNote').textContent = `in den letzten ${state.topDays || 30} Tagen · A–Z`;
    $('allHead').textContent = q ? `Treffer für „${$('nameSearch').value.trim()}“` : letter ? `Mitglieder mit „${letter}“` : 'Alle Mitglieder (A–Z)';
    if (q) $('tabsBox').classList.add('hidden');

    // nur vorhandene Anfangsbuchstaben, gleichmäßig über die Breite verteilt
    const have = [...new Set(people.map(initial))].filter(l => /^[A-Z]$/.test(l)).sort();
    $('letters').classList.toggle('hidden', Boolean(q));
    $('letters').classList.toggle('few', have.length < 12);
    $('letters').innerHTML = `<button class="all ${letter ? '' : 'on'}" data-l="">Alle</button>` +
      have.map(l => `<button data-l="${l}" class="${letter === l ? 'on' : ''}">${l}</button>`).join('');
    // Gesamtliste immer vollständig (die häufigen stehen oben zusätzlich)
    const match = m => m.name.toLocaleLowerCase('de').includes(q) || lastFirst(m.name).toLocaleLowerCase('de').includes(q);
    const list = q ? people.filter(match) : letter ? people.filter(m => initial(m) === letter) : people;
    $('names').innerHTML = list.map(card).join('') || `<div class="tk-empty" style="grid-column:1/-1">Kein Name passt – oder „Ich bin neu“ antippen.</div>`;

    // ganz unten: Mannschaften/Gruppen, Verein (kostenfrei), Gast
    const teams = state.members.filter(m => m.kind === 'mannschaft' && (!q || m.name.toLocaleLowerCase('de').includes(q)));
    $('teams').innerHTML = teams.map(m => `<button data-id="${m.id}"><i class="av" style="${avStyle(m.name)}">${initials(m.name)}</i><span class="nm"><b>${esc(m.name)}</b><span>Mannschaft</span></span></button>`).join('');
    $('teamBox').classList.toggle('hidden', !teams.length);
    const special = state.members.filter(m => m.kind === 'verein' || m.kind === 'gast');
    const nTabs = (state.tabs || []).length;
    $('special').innerHTML = special.map(m => `<button class="${m.kind}" data-id="${m.id}">${m.kind === 'verein' ? 'Verein · kostenfrei' : 'Gast · bar zahlen'}</button>`).join('') +
      (ev ? '' : `<button class="deckel" data-tabnew="1">Gäste-Deckel${nTabs ? `<span class="cnt">${nTabs}</span>` : ''}</button>`);
  }

  $('nameSearch').addEventListener('input', () => { letter = null; renderStart(); });
  $('nameClear').addEventListener('click', () => { $('nameSearch').value = ''; renderStart(); $('nameSearch').focus(); });
  $('letters').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    letter = b.dataset.l || null;
    renderStart();
  });
  ['special', 'teams', 'names', 'top'].forEach(id => $(id).addEventListener('click', e => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    const m = state.members.find(x => x.id === Number(b.dataset.id));
    if (m) chooseMember(m);
  }));
  /* ---------- Gäste-Deckel ---------- */
  ['tabs', 'special'].forEach(id => $(id).addEventListener('click', e => {
    if (e.target.closest('[data-tabnew]')) { newTabDialog(); return; }
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    openTab(Number(b.dataset.tab));
  }));
  const tabSession = r => openBooking({ token: r.token, tab: r.tab, open: r.open_cents, mode: 'tab' });
  async function openTab(id) {
    try { tabSession(await api('api/tablet/unlock', { tabId: id })); } catch (e) { toast(e.message, true); load(); }
  }
  function newTabDialog() {
    const open = state.tabs || [];
    openDialog(`<h2>Neuer Gäste-Deckel</h2>
      <div class="muted">Für Gäste und die gegnerische Mannschaft: den Tag über anschreiben, vor der Heimfahrt bar oder mit Karte bezahlen.</div>
      <input class="big" id="tName" placeholder="z. B. Gastmannschaft SV Musterdorf oder Jan Müller" autocomplete="off" autocapitalize="words" maxlength="60">
      <div class="sugg" id="tSugg"></div>
      <div class="err" id="tErr"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px"><button class="btn" id="tCancel">Abbrechen</button><button class="btn primary" id="tOk">Deckel öffnen</button></div>`);
    const draw = () => {
      const q = $('tName').value.trim().toLocaleLowerCase('de');
      const hits = q.length < 2 ? [] : open.filter(t => t.name.toLocaleLowerCase('de').includes(q)).slice(0, 5);
      $('tSugg').innerHTML = hits.map(t => `<button data-tab="${t.id}">${esc(t.name)}<small>schon offen · ${euro(t.open_cents)}</small></button>`).join('');
    };
    $('tName').oninput = () => { draw(); bumpIdle(); };
    setTimeout(() => $('tName').focus(), 50);
    $('tCancel').onclick = closeDialog;
    $('tSugg').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { closeDialog(); openTab(Number(b.dataset.tab)); } };
    const go = async () => {
      try { const r = await api('api/tablet/tab', { name: $('tName').value }); closeDialog(); tabSession(r); }
      catch (e) { $('tErr').textContent = e.message; }
    };
    $('tOk').onclick = go;
    $('tName').onkeydown = e => { if (e.key === 'Enter') go(); };
  }
  $('payBtn').addEventListener('click', () => {
    if (!session || session.mode !== 'tab') return;
    if (cart.size || customs.length) { toast('Erst die Auswahl anschreiben oder entfernen, dann bezahlen.', true); return; }
    const cents = session.open || 0;
    openDialog(`<h2>Deckel „${esc(session.tab.name)}“ bezahlen</h2>
      <div class="muted">${cents ? 'Erst kassieren, dann hier antippen, wie bezahlt wurde.' : 'Auf dem Deckel steht nichts – er wird einfach geschlossen.'}</div>
      <div class="total" style="font-size:44px;font-weight:800;text-align:center;margin:18px 0">${euro(cents)}</div>
      <div class="paybtns">
        ${cents ? `<button class="btn primary" data-pay="bar">Bar bezahlt</button><button class="btn" data-pay="karte">Mit Karte bezahlt</button>`
          : '<button class="btn primary" data-pay="bar">Deckel schließen</button>'}
      </div>
      <div style="display:flex;justify-content:center;margin-top:12px"><button class="btn ghost" id="pCancel">Abbrechen</button></div>`);
    $('pCancel').onclick = closeDialog;
    $('dialog').onclick = async e => {
      const b = e.target.closest('[data-pay]'); if (!b) return;
      b.disabled = true;
      try {
        const r = await api('api/tablet/tab/pay', { token: session.token, method: b.dataset.pay });
        $('dialog').onclick = null;
        $('dialog').innerHTML = `<div class="done"><div class="big">✓</div><h2>${r.cents ? 'Bezahlt – danke!' : 'Deckel geschlossen'}</h2>
          <div class="total">${euro(r.cents)}</div>
          ${r.cents ? `<div class="${r.method === 'bar' ? 'cashhint' : 'freehint'}">${r.method === 'bar' ? `Bitte ${euro(r.cents)} bar in die Kasse` : 'Mit Karte bezahlt'}</div>` : ''}
          <div class="muted" style="margin-top:6px">Deckel „${esc(r.name)}“ ist geschlossen.</div>
          <div class="row"><button class="btn primary" id="okBtn">Fertig</button></div></div>`;
        session = null;
        const fin = () => { clearTimeout(fin.t); closeDialog(); backToStart(); };
        fin.t = setTimeout(fin, 15000);
        $('okBtn').onclick = fin;
      } catch (err) { b.disabled = false; toast(err.message, true); }
    };
  });

  $('evSearch').addEventListener('input', () => { evFilter = $('evSearch').value; renderEventList(); });
  $('evNames').addEventListener('click', e => {
    const b = e.target.closest('button[data-g]'); if (!b) return;
    const g = (state.event.guests || []).find(x => x.id === Number(b.dataset.g));
    if (g) chooseGuest(g);
  });
  async function chooseGuest(g) {
    const open = r => openBooking({ token: r.token, guest: r.guest, event: r.event, open: r.open_cents, private: r.private, mode: 'guest' });
    if (!g.hasPin) {
      try { open(await api('api/tablet/unlock', { guestId: g.id })); } catch (e) { toast(e.message, true); load(); }
      return;
    }
    const check = async pin => {
      try { const r = await api('api/tablet/unlock', { guestId: g.id, pin }); closeDialog(); open(r); return true; }
      catch (e) { check.lastError = e.message; return false; }
    };
    pinDialog(g.name, 'Bitte deine PIN eingeben', check, { max: 8 });
  }

  /* Namen auf die Veranstaltungsliste setzen: Mitglied suchen oder frei eintragen */
  $('evAdd').addEventListener('click', () => {
    const people = state.members.filter(m => m.kind === 'mitglied' || m.kind === 'mannschaft');
    const onList = new Set((state.event.guests || []).filter(g => g.memberId).map(g => g.memberId));
    openDialog(`<h2>Namen hinzufügen</h2>
      <div class="muted">Namen tippen und aus der Mitgliederliste wählen – oder als Gast frei eintragen.</div>
      <input class="big" id="gName" placeholder="z. B. Müller oder Opa Heinz" autocomplete="off" autocapitalize="words" maxlength="60">
      <div class="sugg" id="gSugg"></div>
      <div class="err" id="gErr"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="btn" id="gCancel">Abbrechen</button></div>`);
    const draw = () => {
      const t = $('gName').value.trim(), q = t.toLocaleLowerCase('de');
      const hits = q.length < 2 ? [] : people.filter(m => m.name.toLocaleLowerCase('de').includes(q))
        .sort(byName).slice(0, 7);
      const exact = hits.some(m => m.name.toLocaleLowerCase('de') === q);
      $('gSugg').innerHTML = hits.map(m => `<button data-m="${m.id}">${esc(lastFirst(m.name, m.kind))}<small>${onList.has(m.id) ? 'steht schon auf der Liste' : (m.kind === 'mannschaft' ? 'Mannschaft' : 'Mitglied')}</small></button>`).join('') +
        (t.length >= 2 && !exact ? `<button class="free" data-free="1">„${esc(t)}“ als Gast eintragen<small>ohne Mitgliedskonto</small></button>` : '');
    };
    $('gName').oninput = () => { draw(); bumpIdle(); };
    setTimeout(() => $('gName').focus(), 50);
    $('gCancel').onclick = closeDialog;
    $('gSugg').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      const body = b.dataset.m ? { memberId: Number(b.dataset.m) } : { name: $('gName').value };
      try {
        const r = await api('api/tablet/event/guest', body);
        closeDialog();
        await load();
        if (r.needPin) { chooseGuest({ id: r.guest.id, name: r.guest.name, hasPin: true }); return; }
        openBooking({ token: r.token, guest: r.guest, event: r.event, open: r.open_cents, private: r.private, mode: 'guest' });
      } catch (err) { $('gErr').textContent = err.message; }
    };
  });

  $('eventBtn').addEventListener('click', async () => {
    try {
      const r = await api('api/tablet/unlock', { eventId: state.event.id });
      openBooking({ token: r.token, event: r.event, mode: 'event' });
    } catch (e) { toast(e.message, true); load(); }
  });

  /* ---------- Neu im Verein ---------- */
  $('newBtn').addEventListener('click', () => {
    openDialog(`<h2>Neu im Verein?</h2>
      <div class="muted">Trag dich mit Vor- und Nachnamen ein. Du kannst sofort buchen – der Vorstand bestätigt deinen Eintrag später.</div>
      <input class="big" id="nmName" placeholder="Vorname Nachname" autocomplete="off" autocapitalize="words" maxlength="60">
      <div class="err" id="nmErr"></div>
      <div class="row" style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
        <button class="btn" id="nmCancel">Abbrechen</button><button class="btn primary" id="nmOk">Eintragen & buchen</button></div>`);
    setTimeout(() => $('nmName').focus(), 50);
    $('nmCancel').onclick = closeDialog;
    const go = async () => {
      try {
        const r = await api('api/tablet/member', { name: $('nmName').value });
        closeDialog();
        openBooking({ token: r.token, member: r.member, balance: r.balance, eventOpen: r.eventOpen_cents, private: r.private, mode: r.member.kind });
        toast('Willkommen! Du stehst jetzt in der Liste.');
      } catch (e) { $('nmErr').textContent = e.message; }
    };
    $('nmOk').onclick = go;
    $('nmName').onkeydown = e => { if (e.key === 'Enter') go(); };
  });

  /* ---------- PIN ---------- */
  function pinDialog(title, sub, onDone, { allowEmpty = false, max = 6 } = {}) {   // max 8 beim Entsperren: aus der Mitglieder-App übernommene PINs können länger sein
    let pin = '';
    const draw = (err = '') => {
      $('dialog').innerHTML = GKPin.pad(esc(title), esc(sub), pin.length)
        + (allowEmpty ? '<div style="text-align:center;margin-top:12px"><button class="btn small ghost" data-k="none">PIN entfernen</button></div>' : '');
      $('perr').textContent = err;
    };
    draw();
    $('overlay').classList.remove('hidden');
    $('dialog').onclick = async e => {
      const k = e.target.closest('[data-k]'); if (!k) return;
      const key = k.dataset.k;
      bumpIdle();
      if (key === 'x') { closeDialog(); return; }
      if (key === 'none') { const r = await onDone(''); if (r !== false) closeDialog(); return; }
      if (key === 'ok') {
        if (pin.length < 4) { draw('Mindestens 4 Ziffern.'); return; }
        const r = await onDone(pin);
        if (r === false) { pin = ''; draw(onDone.lastError || 'PIN falsch.'); } else closeDialog();
        return;
      }
      if (pin.length < max) pin += key;
      draw();
    };
  }
  /** Fenster öffnen – setzt immer auch einen Klick-Handler des vorigen Fensters zurück */
  function openDialog(html) { $('dialog').onclick = null; $('dialog').innerHTML = html; $('overlay').classList.remove('hidden'); }
  function closeDialog() { $('overlay').classList.add('hidden'); $('dialog').onclick = null; $('dialog').innerHTML = ''; }

  async function chooseMember(m) {
    if (!m.hasPin) {
      try {
        const r = await api('api/tablet/unlock', { memberId: m.id });
        openBooking({ token: r.token, member: r.member, balance: r.balance, eventOpen: r.eventOpen_cents, private: r.private, mode: r.member.kind });
        if (r.member.kind === 'mitglied') askFirstPin();   // PIN ist eine Zentralfunktion – beim ersten Mal festlegen lassen
      } catch (e) { toast(e.message, true); }
      return;
    }
    const check = async pin => {
      try {
        const r = await api('api/tablet/unlock', { memberId: m.id, pin });
        closeDialog();
        openBooking({ token: r.token, member: r.member, balance: r.balance, eventOpen: r.eventOpen_cents, private: r.private, mode: r.member.kind });
        return true;
      } catch (e) { check.lastError = e.message; return false; }
    };
    pinDialog(m.name, 'Bitte deine PIN eingeben', check, { max: 8 });
  }

  /* ---------- Buchen ---------- */
  function openBooking(s) {
    session = s;
    cart = new Map(); customs = [];
    $('start').classList.add('hidden');
    $('booking').classList.remove('hidden');
    document.body.classList.add('bookmode');
    const isEvent = s.mode === 'event', isGuest = s.mode === 'guest', isTab = s.mode === 'tab';
    $('whoName').textContent = isTab ? 'Deckel: ' + s.tab.name : isEvent ? 'Barverkauf · ' + s.event.name
      : isGuest ? (s.guest.memberId ? lastFirst(s.guest.name) : s.guest.name)
      : s.member.kind === 'mitglied' ? lastFirst(s.member.name) : s.member.name;
    $('cancelBtn').textContent = isTab || isEvent ? 'Zurück' : 'Anderes Mitglied';
    const whoN = isEvent ? s.event.name : isTab ? s.tab.name : isGuest ? s.guest.name : s.member.name;
    $('whoAv').innerHTML = isEvent ? '€' : initials(whoN);
    $('whoAv').setAttribute('style', avStyle(whoN));
    const note = $('whoNote');
    note.className = 'note';
    if (isTab) { note.textContent = 'Wird auf den Deckel angeschrieben' + (s.open ? ` · bisher offen: ${euro(s.open)}` : '') + ' · bezahlt wird vor der Heimfahrt'; note.classList.add('cash'); }
    else if (isEvent) { note.textContent = 'Barverkauf ohne Namen – bitte direkt bar bezahlen.'; note.classList.add('cash'); }
    else if (isGuest) { note.textContent = `Wird auf der Liste „${s.event.name}“ angeschrieben` + (s.private && s.open ? ` · bisher offen: ${euro(s.open)}` : '') + ' · bezahlt wird am Ende'; note.classList.add('cash'); }
    else if (s.mode === 'verein') { note.textContent = 'Kostenfrei – wird gezählt, aber niemandem berechnet.'; note.classList.add('free'); }
    else if (s.mode === 'gast') { note.textContent = 'Gast – bitte direkt bar bezahlen.'; note.classList.add('cash'); }
    else note.textContent = (s.private ? `offen ${euro(s.balance.cents)} · ` : '') + 'antippen = 1 Stück'
      + (s.member.pending ? ' · neu – wird vom Vorstand bestätigt' : '') + (!s.private && s.mode === 'mitglied' ? ' · mit eigener PIN siehst du hier deinen offenen Betrag' : '');
    // Datenschutz: Konto/Liste nur, wenn das Konto mit PIN geschützt ist
    const own = Boolean(s.private) && (s.mode === 'mitglied' || s.mode === 'mannschaft' || isGuest);
    $('accBtn').classList.toggle('hidden', !own);
    $('accBtn').textContent = 'Mein Konto';
    if (isGuest) $('accBtn').classList.add('hidden');      // Liste steht direkt rechts
    $('tabBox').classList.toggle('hidden', !isGuest && !isTab);
    $('tabHead').textContent = isTab ? 'Bisher auf dem Deckel' : 'Bisher auf der Liste';
    $('payBtn').classList.toggle('hidden', !isTab);
    if (isGuest || isTab) loadTab();
    $('pinBtn').classList.toggle('hidden', s.mode !== 'mitglied');
    $('pinBtn').textContent = s.member && s.member.hasPin ? 'PIN ändern' : 'PIN festlegen';
    renderArticles();
    renderCart();
    window.scrollTo(0, 0);
    bumpIdle();
  }

  const articles = () => (state.event ? state.event.articles : state.articles);

  /* Veranstaltung: was steht bisher auf der Liste dieses Namens (für das Thekenpersonal) */
  async function loadTab() {
    try {
      const r = await api('api/tablet/account?token=' + encodeURIComponent(session.token));
      const st = x => x.transferred_at ? 'übernommen' : x.payment_id ? (x.method === 'karte' ? 'Karte' : 'bar') : '';
      $('tabList').innerHTML = r.rows.map(x => `<li class="${x.payment_id || x.transferred_at ? 'paid' : ''}"><span class="q">${x.qty}×</span><span>${esc(x.name)}${st(x) ? ` <small>(${st(x)})</small>` : ''}</span><span class="t">${euro(x.total_cents)}</span></li>`).join('')
        || '<li class="empty" style="display:block">Noch nichts angeschrieben.</li>';
      $('tabSum').textContent = euro(r.open_cents);
      if (session && session.mode === 'tab') { session.open = r.open_cents; $('payBtn').textContent = r.open_cents ? `Bezahlen: ${euro(r.open_cents)}` : 'Deckel schließen'; }
    } catch (e) { $('tabBox').classList.add('hidden'); }
  }

  function renderArticles() {
    const cats = [];
    for (const a of articles()) {
      let c = cats.find(x => x.name === a.category);
      if (!c) { c = { name: a.category, items: [] }; cats.push(c); }
      c.items.push(a);
    }
    const free = session && session.mode !== 'verein';
    // kleine Kategorien (Snacks, Bälle, Kaffee …) nebeneinander, damit alles auf einen Blick passt
    $('cats').innerHTML = '<div class="cats-flow">' + cats.map(c => `
      <div class="cat" data-n="${c.items.length}"><h3>${esc(c.name)}</h3><div class="arts">
        ${c.items.map(a => {
          const q = cart.get(a.id) || 0;
          const nm = splitSize(a.name);
          return `<button data-a="${a.id}" class="${q ? 'sel' : ''} ${a.soldOut ? 'out' : ''}" aria-label="${esc(a.name)}, ${euro(a.price_cents)}${q ? ', ausgewählt: ' + q : ''}">
            <span class="ti ${a.image ? 'img' : ''}" style="${tileStyle(a)}">${artInner(a, 28)}${q ? `<span class="badge">${q}</span>` : ''}</span>
            <span class="tx"><b>${esc(nm.name)}</b><span class="sub">${nm.size ? esc(nm.size) + ' · ' : ''}${euro(a.price_cents)}</span></span></button>`;
        }).join('')}
      </div></div>`).join('') +
      (free ? `<div class="cat" data-n="1"><h3>Sonstiges</h3><div class="arts">
        <button data-custom="1" class="custom ${customs.length ? 'sel' : ''}"><span class="ti" style="--ib:transparent;--if:var(--muted)">${window.ArtIcons ? ArtIcons.svg('muenze', 28) : '€'}${customs.length ? `<span class="badge">${customs.length}</span>` : ''}</span>
        <span class="tx"><b>Freier Betrag</b><span class="sub">Essen, Startgeld …</span></span></button></div></div>` : '') + '</div>';
    layoutCats();
  }

  /** Spaltenzahl und Kachelbreite aus der verfügbaren Breite berechnen – alle Kacheln exakt gleich breit.
   *  Ziel: jeder Name vollständig lesbar (bis 3 Zeilen) UND kein Scrollen. Probiert Kachelhöhe (normal → flacher)
   *  und Mindestbreite (mehr Spalten → breitere Kacheln) durch und nimmt die erste Kombination, die beides schafft –
   *  sonst die mit den wenigsten gekürzten Namen ohne Scrollen. */
  function layoutCats() {
    const flow = $('cats').querySelector('.cats-flow'); if (!flow) return;
    const W = flow.clientWidth; if (!W) return;
    const gap = parseFloat(getComputedStyle(flow).getPropertyValue('--gap')) || 8;
    const box = $('bkMain');
    const names = [...flow.querySelectorAll('.arts .tx b')];
    const cats = [...flow.querySelectorAll('.cat')];
    /* Packen wie Tetris auf einem festen Raster: Spalten = Kachelbreite, Zeilen = „Band“ (Überschrift + eine Kachelreihe).
       Große Kategorien werden ausgeglichen verteilt (7 Artikel bei 6 Spalten → 4 + 3 statt 6 + 1), kleine rücken in Lücken
       neben andere. Jede Kategorie landet am höchsten freien Platz, bei Gleichstand möglichst links – so bleibt die
       Reihenfolge weitgehend erhalten und alle Überschriften und Kacheln fluchten waagerecht und senkrecht. */
    const apply = (tmin, dens, packed = true, extra = 0) => {
      flow.style.removeProperty('--th');
      const cols = Math.max(1, Math.floor((W + gap) / (tmin + gap)));
      const tw = Math.floor(((W - (cols - 1) * gap) / cols) * 100) / 100 - 0.01;
      flow.classList.remove('xxl', 'xl', 'd1', 'd2', 'd3', 'd4', 'd5', 'packed'); if (dens) flow.classList.add(dens);
      flow.style.setProperty('--tw', tw + 'px');
      if (!packed) {   // klassisch: jede Kategorie in Lesereihenfolge, so breit wie möglich
        flow.style.height = '';
        cats.forEach(c => { c.style.left = c.style.top = ''; c.style.setProperty('--span', Math.min(cols, Number(c.dataset.n) || 1)); });
        return;
      }
      flow.classList.add('packed');
      const cs = getComputedStyle(flow);
      const th = (parseFloat(cs.getPropertyValue('--th')) || 60) + extra, rg = parseFloat(cs.rowGap) || 12;
      if (extra) flow.style.setProperty('--th', th + 'px');
      const head = 22;                       // Überschrift (16 px) + Abstand (6 px)
      const band = head + th + rg;           // Höhe einer Rasterzeile
      flow.style.setProperty('--brg', (band - th) + 'px');
      // mehrere Anordnungen durchspielen (eingestellte Reihenfolge / große Kategorien zuerst, große Kategorien
      // ausgeglichen oder volle Breite) und die mit den wenigsten Zeilen nehmen – bei Gleichstand die gewohnte Reihenfolge
      const place = (order, balanced) => {
        const grid = [], pos = new Map();
        const free = (x, y, w, r) => { for (let yy = y; yy < y + r; yy++) for (let xx = x; xx < x + w; xx++) if (grid[yy] && grid[yy][xx]) return false; return true; };
        let rows = 0;
        for (const c of order) {
          const n = Number(c.dataset.n) || 1;
          const r = Math.ceil(n / cols), w = balanced ? Math.min(cols, Math.ceil(n / r)) : Math.min(cols, n);
          const rr = Math.ceil(n / w);
          let px = 0, py = 0;
          search: for (let y = 0; ; y++) for (let x = 0; x + w <= cols; x++) if (free(x, y, w, rr)) { px = x; py = y; break search; }
          for (let yy = py; yy < py + rr; yy++) { grid[yy] = grid[yy] || []; for (let xx = px; xx < px + w; xx++) grid[yy][xx] = 1; }
          rows = Math.max(rows, py + rr);
          pos.set(c, { x: px, y: py, w });
        }
        return { rows, pos };
      };
      const bySize = [...cats].sort((a, b) => (Number(b.dataset.n) || 1) - (Number(a.dataset.n) || 1));
      let plan = null;
      for (const [order, balanced] of [[cats, true], [cats, false], [bySize, true], [bySize, false]]) {
        const p = place(order, balanced);
        if (!plan || p.rows < plan.rows) plan = p;
      }
      for (const c of cats) {
        const p = plan.pos.get(c);
        c.style.setProperty('--span', p.w);
        c.style.left = (p.x * (tw + gap)) + 'px';
        c.style.top = (p.y * band) + 'px';
      }
      const rows = plan.rows;
      flow.dataset.rows = rows;
      flow.style.height = (rows * band - rg) + 'px';
    };
    // gekürzt = mehr Zeilen als erlaubt ODER ein Wort passt nicht in eine Zeile (sonst bricht der Browser mitten im Wort um)
    const ctx2d = (layoutCats.cv = layoutCats.cv || document.createElement('canvas')).getContext('2d');
    const wordTooLong = b => { const cs = getComputedStyle(b); ctx2d.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      return b.textContent.split(/\s+/).some(w => ctx2d.measureText(w).width > b.clientWidth + 0.5); };
    const measure = () => ({
      scroll: box ? Math.max(0, box.scrollHeight - box.clientHeight - 1) : 0,
      cut: names.filter(b => b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1 || wordTooLong(b)).length,
    });
    let best = null;
    const DENS = ['xxl', 'xl', '', 'd1', 'd2', 'd3', 'd4', 'd5'], TMIN = [150, 170, 190, 215, 240];
    outer: for (let d = 0; d < DENS.length; d++) {
      for (const tmin of TMIN) {
        for (const packed of [true, false]) {
          apply(tmin, DENS[d], packed);
          const m = measure();
          const score = (m.scroll ? 1e6 + m.scroll * 1000 : 0) + m.cut * 100 + d * 10 + TMIN.indexOf(tmin) + (packed ? 0 : 0.5);
          if (!best || score < best.score) best = { score, tmin, dens: DENS[d], packed };
          if (!m.scroll && !m.cut) break outer;
        }
      }
    }
    apply(best.tmin, best.dens, best.packed);
    // übrigen Platz nach unten auf die Kachelhöhe verteilen (größere, leichter zu treffende Kacheln), höchstens +16 px
    if (best.packed && box) {
      const spare = box.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(box).paddingBottom) || 0) - flow.getBoundingClientRect().bottom - 2;
      const rows = Number(flow.dataset.rows) || 1;
      const add = Math.min(16, Math.floor(spare / rows));
      if (add > 2) { apply(best.tmin, best.dens, true, add); if (measure().scroll) apply(best.tmin, best.dens, true); }
    }
  }
  window.addEventListener('resize', () => { if (session) layoutCats(); });

  /* Freier Betrag: Ziffernblock wie an der Kasse (3-5-0 → 3,50 €) */
  function amountDialog() {
    let digits = '', note = '';
    const chips = ['Essen', 'Kuchen', 'Startgeld', 'Spende', 'Sonstiges'];
    const draw = (err = '') => {
      const cents = Number(digits || '0');
      $('dialog').innerHTML = `<h2>Betrag eingeben</h2><div class="muted">Für alles, was nicht auf der Liste steht.</div>
        <div class="amount">${euro(cents)}</div>
        <div class="chips">${chips.map(c => `<button data-c="${c}" class="${note === c ? 'on' : ''}">${c}</button>`).join('')}</div>
        <div class="pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
          <button class="fn" data-k="del">⌫</button><button data-k="0">0</button><button class="fn" data-k="00">00</button>
        </div>
        <div class="err">${esc(err)}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn" data-k="x">Abbrechen</button><button class="btn primary" data-k="ok">Hinzufügen</button></div>`;
    };
    draw();
    $('overlay').classList.remove('hidden');
    $('dialog').onclick = e => {
      bumpIdle();
      const c = e.target.closest('[data-c]');
      if (c) { note = note === c.dataset.c ? '' : c.dataset.c; draw(); return; }
      const k = e.target.closest('[data-k]'); if (!k) return;
      const key = k.dataset.k;
      if (key === 'x') { closeDialog(); return; }
      if (key === 'del') digits = digits.slice(0, -1);
      else if (key === 'ok') {
        const cents = Number(digits || '0');
        if (cents < 10) { draw('Bitte einen Betrag eingeben.'); return; }
        if (cents > 50000) { draw('Höchstens 500 €.'); return; }
        customs.push({ cents, note });
        closeDialog(); updateCustomTile(); renderCart(); return;
      } else if (digits.length < 5) digits = (digits + key).replace(/^0+/, '').slice(0, 5);
      draw();
    };
  }

  /* Nach einer Mengenänderung nur die betroffene Kachel anpassen (Haken, Zahl, Vorlesetext) – kein Neuaufbau der Seite
     und keine neue Anordnung der Kacheln. So bleibt schnelles Tippen flüssig, auch auf älteren Tablets. */
  function setBadge(ti, n) {
    let bd = ti.querySelector('.badge');
    if (n && !bd) { bd = document.createElement('span'); bd.className = 'badge'; ti.appendChild(bd); }
    if (n) bd.textContent = n; else if (bd) bd.remove();
  }
  function updateTile(id) {
    const b = $('cats').querySelector(`button[data-a="${id}"]`), a = articles().find(x => x.id === id);
    if (!b || !a) { renderArticles(); return; }
    const q = cart.get(id) || 0;
    b.classList.toggle('sel', q > 0);
    b.setAttribute('aria-label', `${a.name}, ${euro(a.price_cents)}${q ? ', ausgewählt: ' + q : ''}`);
    setBadge(b.querySelector('.ti'), q);
  }
  function updateCustomTile() {
    const b = $('cats').querySelector('button[data-custom]'); if (!b) return;
    b.classList.toggle('sel', customs.length > 0);
    setBadge(b.querySelector('.ti'), customs.length);
  }

  function renderCart() {
    bookReqId = null;                                   // Warenkorb hat sich geändert → nächstes Absenden ist eine neue Anfrage
    const items = [...cart.entries()].map(([id, q]) => ({ a: articles().find(x => x.id === id), q })).filter(x => x.a);
    $('cartList').innerHTML = (items.length || customs.length)
      ? items.map(({ a, q }) => { const nm = splitSize(a.name); return `<li><b class="nm">${esc(nm.name)}</b><span class="sb" title="${q} × ${euro(a.price_cents)}">${nm.size ? esc(nm.size) : euro(a.price_cents)}</span>
          <span class="st"><button data-m="${a.id}" aria-label="${esc(a.name)} weniger">−</button><b>${q}</b><button data-p="${a.id}" aria-label="${esc(a.name)} mehr">+</button></span>
          <b class="ls">${euro(a.price_cents * q)}</b></li>`; }).join('') +
        customs.map((c, i) => `<li><b class="nm">Freier Betrag</b><span class="sb">${c.note ? esc(c.note) : 'ohne Angabe'}</span>
          <span class="st"><span></span><b>1</b><button data-cx="${i}" aria-label="entfernen">✕</button></span><b class="ls">${euro(c.cents)}</b></li>`).join('')
      : '<li class="empty">Artikel antippen,<br>um sie hinzuzufügen.</li>';
    const sum = items.reduce((s, { a, q }) => s + a.price_cents * q, 0) + customs.reduce((s, c) => s + c.cents, 0);
    $('cartSum').textContent = session && session.mode === 'verein' ? '0,00 €' : euro(sum);
    const n = items.reduce((s, x) => s + x.q, 0) + customs.length;
    $('cartCount').textContent = n ? (n === 1 ? '1 Artikel' : `${n} Artikel`) : '';
    $('bookBtn').disabled = !n;
    $('clearBtn').disabled = !n;
    const md = session && session.mode;
    $('bookBtn').textContent = md === 'guest' || md === 'tab' ? 'Anschreiben' : md === 'verein' ? 'Kostenfrei buchen' : md === 'gast' ? 'Bar bezahlt – buchen'
      : md === 'event' ? 'Bar kassiert – buchen' : md === 'mannschaft' ? 'Auf das Mannschaftskonto' : 'Auf mein Konto buchen';
  }
  $('clearBtn').addEventListener('click', () => { cart = new Map(); customs = []; renderArticles(); renderCart(); bumpIdle(); });

  $('cats').addEventListener('click', e => {
    if (e.target.closest('button[data-custom]')) { amountDialog(); return; }
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const id = Number(b.dataset.a);
    cart.set(id, Math.min(99, (cart.get(id) || 0) + 1));
    updateTile(id); renderCart(); bumpIdle();
  });
  $('cartList').addEventListener('click', e => {
    const cx = e.target.closest('[data-cx]');
    if (cx) { customs.splice(Number(cx.dataset.cx), 1); updateCustomTile(); renderCart(); bumpIdle(); return; }
    const p = e.target.closest('[data-p]'), m = e.target.closest('[data-m]');
    if (!p && !m) return;
    const id = Number((p || m).dataset[p ? 'p' : 'm']);
    if (p) cart.set(id, Math.min(99, cart.get(id) + 1));
    else { const q = cart.get(id) - 1; if (q > 0) cart.set(id, q); else cart.delete(id); }
    updateTile(id); renderCart(); bumpIdle();
  });

  $('cancelBtn').addEventListener('click', () => backToStart());

  async function doBook() {
    const items = [...cart.entries()].map(([articleId, qty]) => ({ articleId, qty }))
      .concat(customs.map(c => ({ custom: true, cents: c.cents, note: c.note })));
    if (!items.length) return;
    const btns = [$('bookBtn')];
    btns.forEach(b => { b.disabled = true; });
    if (!bookReqId) bookReqId = newReqId();           // bleibt bei einem erneuten Versuch desselben Warenkorbs gleich
    try {
      const r = await api('api/tablet/book', { token: session.token, items, requestId: bookReqId });
      bookReqId = null;
      showDone(r);
    } catch (e) {
      toast(e.message, true);
      if (e.status && e.status !== 401 && e.status < 500) bookReqId = null;   // fachlich abgelehnt → nächster Versuch ist eine neue Anfrage
      if (e.status === 401) backToStart(); else btns.forEach(b => { b.disabled = false; });
    }
  }
  $('bookBtn').addEventListener('click', () => doBook());

  function showDone(r) {
    const ids = r.bookings.map(b => b.id);
    const listTotal = r.bookings.reduce((s, b) => s + b.list_cents, 0);
    let hint = '';
    if (r.tab) hint = `<div class="freehint" style="background:var(--amber-soft);color:var(--amber)">Auf den Deckel „${esc(r.tab.name)}“ angeschrieben – jetzt offen: ${euro(r.open_cents || 0)}<br><span style="font-weight:400">Bezahlt wird vor der Heimfahrt – dann den Deckel antippen und „Bezahlen“.</span></div>`;
    else if (r.kind === 'event' && r.paid_cash === 0) hint = `<div class="freehint" style="background:var(--amber-soft);color:var(--amber)">Angeschrieben auf der Liste „${esc(r.event || '')}“${r.private ? ` – jetzt offen: ${euro(r.open_cents || 0)}` : ''}<br><span style="font-weight:400">Bezahlt wird am Ende bar oder mit Karte.</span></div>`;
    else if (r.kind === 'gast' || r.kind === 'event') hint = `<div class="cashhint">Bitte ${euro(r.total_cents)} bar in die Kasse</div>`;
    else if (r.kind === 'verein') hint = `<div class="freehint">Kostenfrei gebucht (Wert ${euro(listTotal)})</div>`;
    else hint = r.private ? `<div class="muted">Neuer offener Betrag: <b>${euro(r.balance.cents)}</b></div>` : '<div class="muted">Auf dein Konto gebucht.</div>';
    openDialog(`<div class="done">
      <div class="big">✓</div><h2>Gebucht!</h2>
      <ul>${r.bookings.map(b => `<li>${b.qty > 1 || !/^Betrag/.test(b.name) ? b.qty + ' × ' : ''}${esc(b.name)}</li>`).join('')}</ul>
      <div class="total">${r.kind === 'verein' ? '0,00 €' : euro(r.total_cents)}</div>
      ${hint}
      <div class="row">
        ${r.kind === 'event' ? '' : '<button class="btn danger" id="undoBtn">Rückgängig</button>'}
        <button class="btn primary" id="okBtn">Fertig</button>
      </div>
      <div class="muted" id="countdown" style="margin-top:10px"></div></div>`);
    let left = DONE_MS / 1000;
    const cd = () => { $('countdown') && ($('countdown').textContent = `Schließt automatisch in ${left} s`); };
    cd();
    clearInterval(showDone.iv);
    showDone.iv = setInterval(() => { left--; cd(); if (left <= 0) finish(); }, 1000);
    const finish = () => { clearInterval(showDone.iv); closeDialog(); backToStart(); };
    $('okBtn').onclick = finish;
    if ($('undoBtn')) $('undoBtn').onclick = async () => {
      try {
        await api('api/tablet/undo', { token: session.token, bookingIds: ids });
        clearInterval(showDone.iv);
        closeDialog();
        toast('Buchung zurückgenommen – Auswahl jetzt korrigieren oder „Abbrechen“.');
        if (session.mode === 'guest') load();
        if (session.mode === 'guest' || session.mode === 'tab') loadTab();
        renderArticles(); renderCart(); bumpIdle();
      } catch (e) { toast(e.message, true); }
    };
    clearTimeout(idleTimer);
  }

  /* ---------- Mein Konto / PIN ---------- */
  $('accBtn').addEventListener('click', async () => {
    try {
      const r = await api('api/tablet/account?token=' + encodeURIComponent(session.token));
      const when = x => new Date(x.created_at.replace(' ', 'T')).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      if (session.mode === 'guest') {
        const st = x => x.transferred_at ? 'auf Konto übernommen' : x.payment_id ? (x.method === 'karte' ? 'mit Karte bezahlt' : 'bar bezahlt') : 'offen';
        openDialog(`<h2>Meine Liste</h2><div class="muted">${esc(r.guest.name)} · ${esc(r.event)}</div>
          <div style="font-size:26px;font-weight:700;margin:10px 0">${euro(r.open_cents)} offen</div>
          <table class="acc">${r.rows.map(x => `<tr><td>${when(x)}</td><td>${x.qty} × ${esc(x.name)}<br><span class="muted" style="font-size:13px">${st(x)}</span></td><td class="r">${euro(x.total_cents)}</td></tr>`).join('') || '<tr><td>Noch nichts angeschrieben.</td></tr>'}</table>
          <div style="margin-top:16px;text-align:right"><button class="btn primary" id="closeAcc">Schließen</button></div>`);
        $('closeAcc').onclick = closeDialog;
        bumpIdle();
        return;
      }
      openDialog(`<h2>Mein Konto</h2>
        <div class="muted">${r.lastSettled ? 'zuletzt abgerechnet am ' + new Date(r.lastSettled.replace(' ', 'T')).toLocaleDateString('de-DE') : 'noch nicht abgerechnet'}</div>
        <div style="font-size:26px;font-weight:700;margin:10px 0">${euro(r.balance.cents)} offen</div>
        ${r.eventOpen_cents ? `<div class="muted" style="margin:-4px 0 10px">+ ${euro(r.eventOpen_cents)} auf einer Veranstaltungsliste noch offen</div>` : ''}
        <table class="acc">${r.rows.map(x => `<tr><td>${new Date(x.created_at.replace(' ', 'T')).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
          <td>${x.qty} × ${esc(x.name)}${x.event ? `<br><span class="muted" style="font-size:13px">${esc(x.event)}${x.kind === 'event' ? ' · Veranstaltungsliste' : (x.transferred_at ? ' · übernommen' : '')}</span>` : ''}</td><td class="r">${euro(x.total_cents)}</td></tr>`).join('') || '<tr><td>Noch keine Buchungen.</td></tr>'}</table>
        <div style="margin-top:16px;text-align:right"><button class="btn primary" id="closeAcc">Schließen</button></div>`);
      $('closeAcc').onclick = closeDialog;
      bumpIdle();
    } catch (e) { toast(e.message, true); if (e.status === 401) backToStart(); }
  });

  /* ---------- PIN (zentral: Verkauf, Platzbuchung, Helferdienste) ---------- */
  function afterPin() {
    session.member.hasPin = true; session.private = true;
    $('accBtn').classList.toggle('hidden', false);
    $('pinBtn').textContent = 'PIN ändern';
    load();
  }
  /** neue PIN zweimal eingeben und speichern (cur = bisherige PIN, leer beim ersten Mal) */
  function setNewPin(cur, sub) {
    pinDialog('Neue PIN', sub || '4 bis 6 Ziffern – gilt für Verkauf, Platzbuchung, Helferdienste und die Mitglieder-App', async pin1 => {
      closeDialog();
      setTimeout(() => pinDialog('PIN wiederholen', 'Zur Sicherheit noch einmal eingeben', async pin2 => {
        if (pin2 !== pin1) { closeDialog(); setTimeout(() => { toast('Die beiden PINs stimmen nicht überein – bitte noch einmal.', true); setNewPin(cur, sub); }, 0); return true; }
        try {
          await api('api/tablet/pin', { token: session.token, currentPin: cur, newPin: pin1 });
          afterPin();
          toast('PIN gespeichert – sie gilt ab jetzt im ganzen Vereinsheim. „Mein Konto“ ist jetzt sichtbar.');
          return true;
        } catch (e) { toast(e.message, true); return true; }
      }), 0);
      return true;
    });
  }
  /** erstes Mal ohne PIN: gleich zum Festlegen auffordern */
  function askFirstPin() {
    openDialog(`<h2>Kein PIN vergeben</h2><div class="muted" style="margin:6px 0 4px;line-height:1.5">Lege jetzt deine PIN fest. Sie schützt dein Konto und gilt für alles im Vereinsheim – Verkauf, Platzbuchung (Buchen und Stornieren nur mit PIN), Helferdienste und die Mitglieder-App.</div>
      <div class="pinchoice"><button class="btn" data-c="later">Später</button><button class="btn primary" data-c="set">PIN festlegen</button></div>`);
    $('dialog').onclick = e => {
      const c = e.target.closest('[data-c]'); if (!c) return;
      bumpIdle(); closeDialog();
      if (c.dataset.c === 'set') setTimeout(() => setNewPin(''), 0);
    };
  }
  $('pinBtn').addEventListener('click', () => {
    if (!session.member.hasPin) { setNewPin(''); return; }
    pinDialog('Aktuelle PIN', 'Zur Sicherheit erst die bisherige PIN eingeben', async cur => { closeDialog(); setTimeout(() => setNewPin(cur), 0); return true; }, { max: 8 });
  });

  /* ---------- Zurück zum Start ---------- */
  function bumpIdle() {
    clearTimeout(idleTimer);
    if (session) idleTimer = setTimeout(() => { toast('Zeit abgelaufen – nichts gebucht.'); closeDialog(); backToStart(); }, IDLE_MS);
  }
  function backToStart() {
    if (session) api('api/tablet/logout', { token: session.token }).catch(() => {});
    session = null; cart = new Map(); customs = []; bookReqId = null; letter = null; evFilter = ''; $('evSearch').value = '';
    clearTimeout(idleTimer);
    $('booking').classList.add('hidden');
    $('start').classList.remove('hidden');
    document.body.classList.remove('bookmode');
    if ($('nameSearch')) $('nameSearch').value = '';
    window.scrollTo(0, 0);
    load();
  }
  document.addEventListener('pointerdown', () => { if (session) bumpIdle(); keepAwake(); }, { passive: true });

  setInterval(() => { if (!session) load(); }, 60 * 1000);
  /* Der Browser stellt beim Zurückkehren (Reiter „Verkauf“, Zurück-Taste, Neuladen) alte Eingaben wieder her oder füllt sie vor –
     dann stünde ein alter Suchbegriff oben, ohne dass gefiltert wird. Deshalb bei jedem Anzeigen leeren. */
  const clearSearch = () => { let ch = false; for (const id of ['nameSearch', 'evSearch']) { const el = $(id); if (el && el.value) { el.value = ''; ch = true; } } if (ch && !session) { letter = null; evFilter = ''; if (state.members.length) renderStart(); } };
  clearSearch();
  window.addEventListener('pageshow', clearSearch);
  load();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
