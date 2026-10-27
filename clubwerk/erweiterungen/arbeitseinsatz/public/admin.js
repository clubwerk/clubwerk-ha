'use strict';
/* Verwaltung „Helferdienste“: Übersicht · Dienstpläne (Detailansicht) · Einsätze · Stunden · Einstellungen */
(() => {
  const GK = window.GK;
  const { $, esc, euro, toast, fail, dialog, closeDialog, ask, deDate, deTime, toCents, centsToInput } = GK;
  const api = (url, method, body) => GK.api('x/arbeitseinsatz/' + url, method, body);
  const BASE = 'api/admin/x/arbeitseinsatz/';
  const KIND = { arbeit: 'Arbeitseinsatz', theke: 'Thekendienst', dienst: 'Dienst', sonstiges: 'Sonstiges' };
  const EST = { laeuft: ['b', 'läuft'], offen: ['a', 'zu bestätigen'], bestaetigt: ['g', 'bestätigt'], abgelehnt: ['', 'abgelehnt'] };
  const SRC = { verwaltung: 'Verwaltung', app: 'App', tablet: 'Tablet' };
  const st = { meta: null, year: null, past: false, ppast: false, es: 'offen' };
  const HF = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });   // einmal anlegen statt je Zeile
  const h = m => `${HF.format((m || 0) / 60)} h`;
  const toMin = v => Math.round(Number(String(v || '').replace(',', '.')) * 60);
  const pill = ([c, t]) => `<span class="pill ${c}">${esc(t)}</span>`;
  const opt = (v, l, s) => `<option value="${esc(v)}" ${String(v) === String(s ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
  const val = id => ($(id) ? $(id).value.trim() : '');
  const bar = (done, target) => { const p = target ? Math.min(100, Math.round(done / target * 100)) : 100; return `<span class="aw-bar"><i style="width:${p}%;background:var(--brand)"></i></span>`; };

  if (!document.getElementById('awStyle')) {
    const s = document.createElement('style'); s.id = 'awStyle';
    s.textContent = `
      .aw-bar { display: inline-block; width: 120px; height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; vertical-align: middle; }
      .aw-bar i { display: block; height: 100%; border-radius: 4px; }
      .aw-grid { display: grid; grid-template-columns: repeat(var(--c, 3), minmax(0, 1fr)); gap: 14px 16px; }
      .aw-grid .w2 { grid-column: span 2; } .aw-grid .wall { grid-column: 1 / -1; }
      @media (max-width: 760px) { .aw-grid { grid-template-columns: 1fr; } .aw-grid .w2 { grid-column: auto; } }
      .aw-sub td { background: var(--hover); } .aw-sub td:first-child { padding-left: 28px !important; }
      .aw-ev { display: grid; grid-template-columns: 76px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 14px 0; border-top: 1px solid var(--line-soft); }
      .aw-ev:first-of-type { border-top: 0; }
      .aw-ev .aw-tog { min-width: 112px; justify-content: center; }
      .aw-date.perm b { font-size: 26px; line-height: 1; } .aw-date.perm span { font-size: 10.5px; letter-spacing: .02em; }
      .aw-ev.off .aw-date, .aw-ev.off h4 > span[translate], .aw-ev.off .muted { opacity: .55; }
      .aw-date { width: 76px; height: 64px; border-radius: 14px; background: var(--brand-soft); color: var(--brand-ink); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; line-height: 1.1; }
      .aw-date b { font-family: var(--num); font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; } .aw-date span { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .aw-ev h4 { margin: 0 0 4px; font-size: 15.5px; } .aw-ev .muted { font-size: 13px; }
      .aw-ev .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .aw-people { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
      .aw-pl .aw-prog { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
      .aw-note { display: flex; flex-direction: column; gap: 4px; white-space: pre-wrap; }
      .aw-dh { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px; } .aw-dh h3 { margin: 0; }
      .aw-sh { display: grid; grid-template-columns: 120px minmax(0, 1fr) auto; gap: 16px; align-items: start; padding: 14px 0; border-top: 1px solid var(--line-soft); }
      .aw-dh + .aw-sh { border-top: 0; } .aw-sh.off { opacity: .5; }
      .aw-when b { font-family: var(--num); font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 24px; }
      .aw-what { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 24px; } .aw-what b { font-size: 15px; }
      .aw-sh .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .pill.aw-free { background: transparent; border: 1px dashed var(--line); color: var(--faint); }
      .aw-xadd { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: end; margin-top: 8px; } .aw-xadd .btn { height: 40px; min-height: 40px; }
      .pill.aw-ph { padding-left: 2px; display: inline-flex; align-items: center; gap: 6px; } .pill.aw-ph img { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
      .aw-lbl { font-size: 13px; font-weight: 600; color: var(--muted); }
      @media (max-width: 760px) { .aw-sh { grid-template-columns: 1fr; gap: 6px; } .aw-sh .acts { justify-content: flex-start; }
        .aw-ev { grid-template-columns: 64px minmax(0, 1fr); } .aw-ev .acts { grid-column: 1 / -1; justify-content: flex-start; } }   /* Knöpfe unter den Text, sonst wird er zur Wortsäule */
      .aw-cols { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px 16px; max-height: 46vh; overflow: auto; padding: 4px 0; }`;
    document.head.appendChild(s);
  }

  /** Rückfrage im selben Fenster (statt eines zweiten): Überschrift, Text, Knopf mit dem Ergebnis; „Abbrechen“ führt zurück */
  function confirmIn(title, text, okLabel, onOk, back) {
    $('dialog').innerHTML = `<h2>${esc(title)}</h2><p class="muted" style="white-space:pre-line">${esc(text)}</p>
      <div class="btns"><button class="btn ghost" id="cfX">Abbrechen</button><button class="btn danger" id="cfOk">${esc(okLabel)}</button></div>`;
    $('cfX').onclick = back;
    $('cfOk').onclick = () => GK.busy($('cfOk'), onOk);
  }
  /** Überschrift und Einleitung einer Seite; die Einleitung ist höchstens ein Satz */
  const head = (title, lead) => { $('main').innerHTML = `<h2 class="page">${esc(title)}</h2>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}`; };
  /** Filterchips (Baustein `.chips`): [[schlüssel, Beschriftung, Zahl?]] */
  const chips = (id, list, cur, own) => `<div class="chips"${own ? ' style="margin:4px 0 12px"' : ''} id="${id}" role="group" aria-label="Filter">${list.map(([k, l, n]) => `<button type="button" data-f="${k}" class="${cur === k ? 'on' : ''}" aria-pressed="${cur === k}">${esc(l)}<span class="cnt">${n != null ? n : ''}</span></button>`).join('')}</div>`;
  const onChips = (id, fn) => { $(id).onclick = e => { const b = e.target.closest('[data-f]'); if (b) fn(b.dataset.f); }; };
  /** Zahl „zu bestätigen“ am Reiter „Stunden“ und im Menü nach jeder Änderung neu holen */
  function refreshPending() { if (GK.refreshBadges) GK.refreshBadges(); }
  const metaNow = async () => { st.meta = await api('meta'); st.year = st.year || st.meta.year; return st.meta; };

  /* ---------------------------------------------------------------- Übersicht */
  async function renderUebersicht() {
    await metaNow();
    const o = await api('overview?year=' + st.year);
    const open = new Set();
    head('Übersicht', 'Soll und geleistete Stunden je Mitglied. Wer sein Soll nicht schafft, zahlt den Stundensatz im Beitragslauf.');
    const rowOf = id => o.rows.find(r => r.id === id) || {};
    const exOf = x => x.members.every(id => rowOf(id).exempt);
    const PASS = { fehlt: x => x.missing > 0, fertig: x => x.missing === 0 && !exOf(x), befreit: x => x.members.some(id => rowOf(id).exempt), alle: () => true };
    const CNT = Object.fromEntries(Object.entries(PASS).map(([k, f]) => [k, o.families.filter(f).length]));
    if (!st.of || !PASS[st.of]) st.of = 'fehlt';
    $('main').insertAdjacentHTML('beforeend', `${!st.meta.mv ? '<div class="banner a"><span>Ohne das Modul „Mitglieder“ gilt die Vorgabe für alle gleich; Familien, Alter, Beitragsarten und die Abrechnung brauchen es.</span></div>' : ''}
      ${st.meta.pending ? `<div class="banner a"><span>${st.meta.pending} ${st.meta.pending === 1 ? 'Stundenmeldung wartet' : 'Stundenmeldungen warten'} auf deine Bestätigung.</span><a href="#aw-stunden" data-go="aw-stunden">Zu den Stunden →</a></div>` : ''}
      <div class="filterbar"><label class="f" style="flex-direction:row;align-items:center;gap:8px">Jahr<select id="awYear" data-nodirty>${st.meta.years.map(y => opt(y.y, y.label, st.year)).join('')}</select></label>
        <span class="muted s">${deDate(o.from)} – ${deDate(o.to)}${o.closed ? ' · abgeschlossen' : ''}</span></div>
      <div class="kpis"><div class="kpi"><div class="l">Soll gesamt</div><div class="v">${h(o.totals.target)}</div></div><div class="kpi"><div class="l">geleistet</div><div class="v">${h(o.totals.done)}</div></div>
        <div class="kpi ${o.totals.missing ? 'warn' : ''}"><div class="l">fehlen noch</div><div class="v">${h(o.totals.missing)}</div></div><div class="kpi"><div class="l">entspricht (${euro(o.rate_cents)}/h)</div><div class="v">${euro(o.totals.cents)}</div></div></div>
      <div class="filterbar"><label class="search"><span aria-hidden="true">${GK.icon('suche', 16)}</span><input id="awQ" placeholder="Name suchen"></label>
        ${chips('awSeg', [['fehlt', 'Fehlen noch', CNT.fehlt], ['fertig', 'Erledigt', CNT.fertig], ['befreit', 'Befreit', CNT.befreit], ['alle', 'Alle', CNT.alle]], st.of)}</div>
      <div class="card" style="padding:0 20px"><table class="tbl kompakt" id="awTbl"></table><p class="empty" id="awEmpty" hidden></p></div>
      <p class="muted s">${o.pool ? 'Familien werden gemeinsam gezählt: das Soll aller Angehörigen zusammen, geleistet ist, was irgendwer aus der Familie gemacht hat.' : ''} ${o.closed ? 'Die fehlenden Stunden kommen beim nächsten Beitragslauf als Posten „Arbeitsstunden“ dazu.' : `Abgerechnet wird nach Ablauf (${deDate(o.to)}) im Beitragslauf.`}</p>`);
    GK.tabTools(`<a class="btn" href="${BASE}overview.xlsx?year=${o.year}">Excel</a>`, $('awTbl'));
    const goLink = $('main').querySelector('[data-go]'); if (goLink) goLink.onclick = e => { e.preventDefault(); GK.go(goLink.dataset.go); };
    $('awYear').onchange = () => { st.year = +val('awYear'); renderUebersicht().catch(fail); };
    const draw = () => {
      const q = val('awQ').toLowerCase(), f = st.of;
      const fams = o.families.filter(x => PASS[f](x) && (!q || x.members.some(id => (rowOf(id).name || '').toLowerCase().includes(q))));
      $('awTbl').innerHTML = `<tr><th>${o.pool ? 'Familie / Mitglied' : 'Mitglied'}</th><th class="r">Soll</th><th class="r">geleistet</th><th class="k-weg">Fortschritt</th><th class="r hide-md k-weg">gemeldet</th><th class="r">fehlt</th><th class="r">Betrag</th><th></th></tr>`
        + (fams.length ? fams.map(x => {
          const many = x.members.length > 1;
          const head = `<tr><td class="k-1z">${many ? `<button class="btn small ghost" data-tg="${x.head}" style="min-width:32px;padding:0 8px" aria-label="Familie ${open.has(x.head) ? 'zuklappen' : 'aufklappen'}">${open.has(x.head) ? '−' : '+'}</button> ` : ''}<b>${esc(GK.lastFirst(x.name))}</b>${many ? ` <span class="pill">Familie · ${x.members.length}</span>` : `${rowOf(x.head).exempt ? ' <span class="pill g">befreit</span>' : ''}<div class="muted s">${esc(rowOf(x.head).why)}</div>`}</td>
            <td class="r">${h(x.target)}</td><td class="r">${h(x.done)}</td><td class="k-weg">${bar(x.done, x.target)}</td><td class="r hide-md k-weg">${x.open ? h(x.open) : '<span class="muted s">–</span>'}</td>
            <td class="r ${x.missing ? 'neg' : ''}">${x.missing ? h(x.missing) : '✓'}</td><td class="r">${x.cents ? euro(x.cents) : '<span class="muted s">–</span>'}</td>
            <td class="r">${many ? '' : `<button class="btn small" data-tgt="${x.head}">Pflichtstunden …</button>`}</td></tr>`;
          const subs = many && open.has(x.head) ? x.members.map(id => { const r = rowOf(id); return `<tr class="aw-sub"><td class="k-1z">${esc(GK.lastFirst(r.name))}${r.exempt ? ' <span class="pill g">befreit</span>' : ''}<div class="muted s">${esc(r.why)}</div></td><td class="r">${h(r.target)}${r.override ? ' <span class="pill b">eigen</span>' : ''}</td><td class="r">${h(r.done)}</td><td class="k-weg"></td><td class="r hide-md k-weg">${r.open ? h(r.open) : ''}</td><td></td><td></td><td class="r"><button class="btn small" data-tgt="${id}">Pflichtstunden …</button></td></tr>`; }).join('') : '';
          return head + subs;
        }).join('') : '');
      $('awTbl').hidden = !fams.length; $('awEmpty').hidden = !!fams.length;
      $('awEmpty').textContent = o.families.length ? 'Keine Treffer.' : 'Noch niemand mit Soll – die Vorgabe steht unter Einstellungen › Soll.';
      $('awTbl').querySelectorAll('[data-tg]').forEach(b => { b.onclick = () => { const k = +b.dataset.tg; if (open.has(k)) open.delete(k); else open.add(k); draw(); }; });
      $('awTbl').querySelectorAll('[data-tgt]').forEach(b => { b.onclick = () => targetDialog(rowOf(+b.dataset.tgt), o, () => renderUebersicht().catch(fail)); });
    };
    draw();
    $('awQ').oninput = draw;
    onChips('awSeg', f => { st.of = f; $('awSeg').querySelectorAll('[data-f]').forEach(x => { x.classList.toggle('on', x.dataset.f === f); x.setAttribute('aria-pressed', x.dataset.f === f); }); draw(); });
  }
  function targetDialog(r, o, after) {
    let mode = r.exempt ? 'befreit' : r.override ? 'eigen' : 'auto';
    dialog(`<h2>Pflichtstunden · ${esc(GK.lastFirst(r.name))}</h2><p class="muted" style="margin-top:0">${esc(o.label)} · derzeit <b>${h(r.target)}</b> (${esc(r.why)})</p>
      <div class="seg" id="tgS" style="width:fit-content;margin:0 0 16px">${[['auto', 'Automatisch'], ['eigen', 'Eigenes Soll'], ['befreit', 'Befreit']].map(([k, l]) => `<button type="button" data-m="${k}">${l}</button>`).join('')}</div>
      <p class="muted s" id="tgH" style="margin:0 0 14px"></p>
      <div class="aw-grid" style="--c:2">
        <label class="f tg-e">Soll in Stunden (nur ${esc(o.label)})<input id="tgM" inputmode="decimal" value="${r.override ? String(r.target / 60).replace('.', ',') : ''}"></label>
        <label class="f tg-b">Befreit bis (leer = dauerhaft)<input id="tgU" type="date" value="${esc(r.exempt_until || '')}"></label>
        <label class="f tg-g">Grund<input id="tgN" maxlength="120" value="${esc(r.exempt ? r.exempt_note || '' : '')}" placeholder="z. B. Vorstandsamt, Trainer"></label></div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="tgOk">Speichern</button></div>`);
    const HINT = { auto: 'Soll nach den Regeln unter Einstellungen (Vorgabe, Beitragsart, Alter, Status).', eigen: 'Abweichendes Soll nur für diesen Zeitraum.',
      befreit: 'Keine Pflichtstunden – auch als aktives Mitglied. Geleistete Stunden werden weiter erfasst, fehlende werden nicht berechnet.' };
    const paint = () => {
      $('tgS').querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
      $('tgH').textContent = HINT[mode];
      $('dialog').querySelector('.tg-e').style.display = mode === 'eigen' ? '' : 'none';
      $('dialog').querySelector('.tg-b').style.display = mode === 'befreit' ? '' : 'none';
      $('dialog').querySelector('.tg-g').style.display = mode === 'auto' ? 'none' : '';
    };
    $('tgS').onclick = e => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; paint(); } };
    paint();
    $('c').onclick = closeDialog;
    $('tgOk').onclick = () => GK.busy($('tgOk'), async () => {
      try {
        if (mode === 'befreit') {
          if (r.override) await api('target', 'PUT', { member_id: r.id, year: o.year, minutes: null, note: '' });
          await api('exempt', 'PUT', { member_id: r.id, note: val('tgN'), until: val('tgU') });
        } else {
          if (r.exempt) await api('exempt/' + r.id, 'DELETE');
          await api('target', 'PUT', { member_id: r.id, year: o.year, minutes: mode === 'eigen' && val('tgM') !== '' ? toMin(val('tgM')) : null, note: mode === 'eigen' ? val('tgN') : '' });
        }
        closeDialog(); toast('Gespeichert.'); after();
      } catch (e) { fail(e); }
    });
  }
  async function addEntries(after, preset = {}) {
    const ev = await api('events?past=1&perm=1');
    const people = st.meta.members;
    dialog(`<h2>Stunden nachtragen</h2>
      <div class="aw-grid" style="--c:3"><label class="f">Datum<input id="aeD" type="date" value="${preset.date || st.meta.today}" max="${st.meta.today}"></label><label class="f">Dauer in Stunden<input id="aeM" inputmode="decimal" placeholder="z. B. 2,5"></label>
        <label class="f">Einsatz (optional)<select id="aeE"><option value="">–</option>${ev.map(e => opt(e.id, e.permanent ? `${e.title} (dauerhaft)` : `${deDate(e.date)} ${e.title}`, preset.event)).join('')}</select></label>
        <label class="f wall">Was wurde gemacht?<input id="aeT" placeholder="z. B. Plätze abziehen, Hecke schneiden"></label></div>
      <label class="f" style="margin-top:14px">Mitglieder (mehrere möglich)<input id="aeQ" placeholder="filtern …" data-nodirty></label>
      <div class="aw-cols" id="aeL">${people.map(p => `<label class="chk" data-n="${esc(p.name.toLowerCase())}"><input type="checkbox" value="${p.id}" ${(preset.members || []).includes(p.id) ? 'checked' : ''}> ${esc(GK.lastFirst(p.name))}</label>`).join('')}</div>
      <p class="muted s">Nachgetragene Stunden gelten sofort als bestätigt.</p>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="aeOk">Eintragen</button></div>`);
    $('c').onclick = closeDialog;
    $('aeQ').oninput = () => { const q = val('aeQ').toLowerCase(); $('aeL').querySelectorAll('[data-n]').forEach(l => { l.style.display = !q || l.dataset.n.includes(q) ? '' : 'none'; }); };
    $('aeOk').onclick = () => GK.busy($('aeOk'), async () => {
      const ids = [...$('aeL').querySelectorAll('input:checked')].map(i => +i.value);
      try { await api('entries', 'POST', { member_ids: ids, date: val('aeD'), minutes: toMin(val('aeM')), event_id: val('aeE') || null, text: val('aeT') }); closeDialog(); toast(`${ids.length} × eingetragen.`); after(); } catch (e) { fail(e); }
    });
  }

  /* ---------------------------------------------------------------- Einsätze */
  async function renderEinsaetze() {
    await metaNow();
    const [coming, gone] = await Promise.all([api('events'), api('events?past=1')]);
    const list = st.past ? gone : coming;
    const wd = d => new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' });
    const perm = list.filter(e => e.permanent), dated = list.filter(e => !e.permanent);
    const row = e => `<div class="aw-ev${e.cancelled ? ' off' : ''}">
        ${e.permanent ? '<div class="aw-date perm"><b>∞</b><span>ganzjährig</span></div>' : `<div class="aw-date"><b>${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.</b><span>${wd(e.date)}</span></div>`}
        <div style="min-width:0"><h4><span translate="no">${esc(e.title)}</span> ${pill(e.kind === 'theke' ? ['b', KIND[e.kind]] : ['', KIND[e.kind]])}${e.cancelled ? ' ' + pill(['a', 'deaktiviert']) : ''}</h4>
          <div class="muted">${(e.permanent ? [e.cancelled ? 'am Tablet nicht wählbar' : 'am Tablet jederzeit wählbar', e.place, e.hours.n ? `${h(e.hours.min)} erfasst` : '']
            : [e.start ? `${e.start}${e.end ? '–' + e.end : ''} Uhr` : '', e.place, e.slots ? `${e.signups.length} von ${e.slots} Plätzen` : `${e.signups.length} eingetragen`, e.hours.n ? `${h(e.hours.min)} erfasst` : '']).filter(Boolean).map(esc).join(' · ')}</div>
          ${!e.permanent && e.signups.length ? `<div class="aw-people">${e.signups.map(s => `<span class="pill g">${esc(GK.lastFirst(s.name))}</span>`).join('')}</div>` : ''}</div>
        <div class="acts">${!e.permanent && e.date <= st.meta.today ? `<button class="btn small" data-evc="${e.id}">Stunden gutschreiben</button>` : ''}${e.permanent ? '' : `<button class="btn small" data-evp="${e.id}">Helfer</button>`}<button class="btn small aw-tog" data-eva="${e.id}" data-on="${e.cancelled ? 1 : 0}">${e.cancelled ? 'Aktivieren' : 'Deaktivieren'}</button><button class="btn small" data-eve="${e.id}">Bearbeiten</button></div></div>`;
    head('Einsätze', 'Arbeitseinsätze und Thekendienste mit festem Termin oder ganzjährig. Mitglieder tragen sich in der App unter „Dienste“ ein.');
    $('main').insertAdjacentHTML('beforeend', `<div class="toolbar"><button class="btn primary" id="evNew">+ Neuer Einsatz</button></div>
      ${chips('evSeg', [['kommend', 'Kommende', coming.filter(e => !e.permanent).length], ['vergangen', 'Vergangene', gone.length]], st.past ? 'vergangen' : 'kommend', true)}
      ${st.past ? '' : `<div class="card"><h3>Dauerhaft (ganzjährig)</h3><p class="muted s" style="margin-top:0">Ohne festen Termin, z. B. Thekendienst. Solange aktiv, wählt man ihn am Tablet beim Einstempeln.</p>${perm.length ? perm.map(row).join('') : '<p class="empty">Keiner – beim Anlegen „Dauerhaft“ ankreuzen.</p>'}</div>`}
      <div class="card"><h3>${st.past ? 'Vergangene Einsätze' : 'Kommende Einsätze'}</h3>${dated.length ? dated.map(row).join('')
        : `<p class="empty">${st.past ? 'Keine vergangenen Einsätze.' : 'Nichts geplant – oben „+ Neuer Einsatz“ anlegen.'}</p>`}</div>`);
    const again = () => renderEinsaetze().catch(fail);
    onChips('evSeg', f => { st.past = f === 'vergangen'; again(); });
    $('evNew').onclick = () => eventDialog(null, again);
    const el = $('main');
    el.querySelectorAll('[data-eve]').forEach(b => { b.onclick = () => eventDialog(list.find(e => e.id === +b.dataset.eve), again); });
    el.querySelectorAll('[data-evp]').forEach(b => { b.onclick = () => helpers(list.find(e => e.id === +b.dataset.evp), again); });
    el.querySelectorAll('[data-eva]').forEach(b => { b.onclick = async () => {
      const on = b.dataset.on === '1', e = list.find(x => x.id === +b.dataset.eva);
      try { await api(`events/${e.id}/active`, 'POST', { active: on }); toast(on ? `„${e.title}“ ist aktiv – steht am Tablet und in der Mitglieder-App.` : `„${e.title}“ ist deaktiviert – nicht am Tablet, nicht in der Mitglieder-App.`); again(); } catch (x) { fail(x); }
    }; });
    el.querySelectorAll('[data-evc]').forEach(b => { b.onclick = () => closeEvent(list.find(e => e.id === +b.dataset.evc), again); });
  }
  function eventDialog(e, after) {
    const dur = e && e.start && e.end ? '' : '';
    dialog(`<h2>${e ? 'Einsatz bearbeiten' : 'Neuer Einsatz'}</h2><div class="aw-grid" style="--c:3">
      <label class="f">Art<select id="evK">${Object.entries(KIND).map(([k, l]) => opt(k, l, e ? e.kind : 'arbeit')).join('')}</select></label><label class="f w2">Titel<input id="evT" value="${esc(e ? e.title : '')}" placeholder="z. B. Frühjahrsputz Plätze"></label>
      <label class="chk wall" style="min-height:32px"><input type="checkbox" id="evPm" ${e && e.permanent ? 'checked' : ''}> Dauerhaft – ganzjährig ohne festen Termin (z. B. Thekendienst), am Tablet jederzeit wählbar</label>
      <label class="f aw-dated">Datum<input id="evD" type="date" value="${esc(e ? e.date : st.meta.today)}"></label><label class="f aw-dated">Von<input id="evS" type="time" value="${esc(e ? e.start || '' : '')}"></label><label class="f aw-dated">Bis<input id="evE" type="time" value="${esc(e ? e.end || '' : '')}"></label>
      <label class="f w2" id="evPL">Ort / Treffpunkt<input id="evP" value="${esc(e ? e.place || '' : '')}"></label><label class="f aw-dated">Helfer gesucht (leer = beliebig)<input id="evN" inputmode="numeric" value="${e && e.slots ? e.slots : ''}"></label>
      <label class="f wall">Hinweis für die Helfer<input id="evX" value="${esc(e ? e.note || '' : '')}" placeholder="z. B. Arbeitshandschuhe mitbringen"></label>
      ${e ? '' : '<label class="f aw-dated">Wöchentlich wiederholen (Wochen)<input id="evR" inputmode="numeric" placeholder="0"></label>'}
      <label class="chk ${e ? 'wall' : 'w2'}" id="evAL" style="min-height:40px;align-self:end"><input type="checkbox" id="evA" ${!e || !e.cancelled ? 'checked' : ''}> Aktiv – steht am Tablet und in der Mitglieder-App</label></div>
      ${e ? '<div class="row" style="margin-top:18px"><button class="btn danger" id="evDel">Einsatz löschen …</button></div>' : ''}
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="evOk">Speichern</button></div>`);
    void dur;
    const pmPaint = () => { const pm = $('evPm').checked; $('dialog').querySelectorAll('.aw-dated').forEach(x => { x.style.display = pm ? 'none' : ''; }); $('evPL').classList.toggle('wall', pm); $('evPL').classList.toggle('w2', !pm); if (!e) { $('evAL').classList.toggle('wall', pm); $('evAL').classList.toggle('w2', !pm); } };
    $('evPm').onchange = () => { if ($('evPm').checked && val('evK') === 'arbeit' && !val('evT')) { $('evK').value = 'theke'; $('evT').value = 'Thekendienst'; } pmPaint(); };
    pmPaint();
    $('c').onclick = closeDialog;
    $('evOk').onclick = () => GK.busy($('evOk'), async () => {
      const body = { permanent: $('evPm').checked, kind: val('evK'), title: val('evT'), date: val('evD') || st.meta.today, start: val('evS'), end: val('evE'), place: val('evP'), slots: val('evN') || null, note: val('evX') };
      try { if (e) await api('events/' + e.id, 'PUT', { ...body, active: $('evA').checked }); else await api('events', 'POST', { ...body, active: $('evA').checked, repeat_weeks: val('evR') || 0 }); closeDialog(); toast('Gespeichert.'); after(); } catch (x) { fail(x); }
    });
    if ($('evDel')) $('evDel').onclick = () => confirmIn(`Einsatz „${e.title}“ löschen?`, e.signups && e.signups.length ? `${e.signups.length} eingetragene Helfer werden mit entfernt.` : 'Der Einsatz verschwindet aus Tablet und Mitglieder-App.', 'Einsatz löschen', async () => {
      try { await api('events/' + e.id, 'DELETE'); closeDialog(); toast('Einsatz gelöscht.'); after(); } catch (x) { fail(x); }
    }, () => eventDialog(e, after));
  }
  function helpers(e, after) {
    const people = st.meta.members;
    dialog(`<h2>Helfer: ${esc(e.title)}</h2><p class="muted" style="margin-top:0">${deDate(e.date)} · Mitglieder tragen sich normalerweise selbst in der App ein; hier kannst du ergänzen oder austragen.</p>
      <label class="f">Filtern<input id="hpQ" data-nodirty></label><div class="aw-cols" id="hpL">${people.map(p => `<label class="chk" data-n="${esc(p.name.toLowerCase())}"><input type="checkbox" value="${p.id}" ${e.signups.some(s => s.member_id === p.id) ? 'checked' : ''}> ${esc(GK.lastFirst(p.name))}</label>`).join('')}</div>
      <div class="btns"><button class="btn primary" id="c">Fertig</button></div>`);
    $('hpQ').oninput = () => { const q = val('hpQ').toLowerCase(); $('hpL').querySelectorAll('[data-n]').forEach(l => { l.style.display = !q || l.dataset.n.includes(q) ? '' : 'none'; }); };
    $('hpL').querySelectorAll('input').forEach(i => { i.onchange = () => api(`events/${e.id}/signup`, 'POST', { member_id: +i.value, remove: !i.checked }).catch(fail); });
    $('c').onclick = () => { closeDialog(); after(); };
  }
  function closeEvent(e, after) {
    const def = e.start && e.end ? (((+e.end.slice(0, 2) * 60 + +e.end.slice(3)) - (+e.start.slice(0, 2) * 60 + +e.start.slice(3))) + 1440) % 1440 || '' : '';
    dialog(`<h2>Stunden gutschreiben: ${esc(e.title)}</h2><p class="muted" style="margin-top:0">Alle angekreuzten Helfer bekommen die Stunden bestätigt. Wer schon Stunden zu diesem Einsatz hat, wird übersprungen.</p>
      <label class="f" style="max-width:240px">Dauer in Stunden<input id="ceM" inputmode="decimal" value="${def ? String(def / 60).replace('.', ',') : ''}"></label>
      <div class="aw-cols" style="margin-top:12px" id="ceL">${(e.signups.length ? e.signups : []).map(s => `<label class="chk"><input type="checkbox" value="${s.member_id}" checked> ${esc(GK.lastFirst(s.name))}</label>`).join('') || '<p class="empty">Niemand eingetragen – über „Helfer“ ergänzen oder „Stunden nachtragen“ nutzen.</p>'}</div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ceOk" ${e.signups.length ? '' : 'disabled'}>Gutschreiben</button></div>`);
    $('c').onclick = closeDialog;
    $('ceOk').onclick = () => GK.busy($('ceOk'), async () => { try { const r = await api(`events/${e.id}/close`, 'POST', { minutes: toMin(val('ceM')), members: [...$('ceL').querySelectorAll('input:checked')].map(i => +i.value) }); closeDialog(); toast(`${r.count} Helfer gutgeschrieben.`); after(); } catch (x) { fail(x); } });
  }

  /* ---------------------------------------------------------------- Dienstpläne (Veranstaltungen mit Schichten) */
  const WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const dayLong = d => `${WDL[new Date(d + 'T12:00:00').getDay()]}, ${deDate(d)}`;
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const when = e => (e.start ? (e.end ? `${e.start}–${e.end}` : `ab ${e.start} Uhr`) : 'ganztags');
  const fill = e => (e.slots ? (e.taken >= e.slots ? ['g', '✓ voll'] : ['a', `${e.slots - e.taken} fehlen`]) : ['b', `${e.taken} dabei`]);
  const rangeTxt = p => (p.from_date === p.to_date ? dayLong(p.from_date) : `${deDate(p.from_date)} – ${deDate(p.to_date)}`);
  async function renderPlaene() {
    await metaNow();
    const [coming, gone] = await Promise.all([api('plans'), api('plans?past=1')]);
    const list = st.ppast ? gone : coming;
    const card = p => `<div class="aw-ev aw-pl" data-pl="${p.id}">
        <div class="aw-date"><span>${new Date(p.from_date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' })}</span><b>${p.from_date.slice(8, 10)}.${p.from_date.slice(5, 7)}.</b></div>
        <div style="min-width:0"><h4><span translate="no">${esc(p.title)}</span>${p.published ? '' : ' ' + pill(['a', 'Entwurf'])}${p.counts ? '' : ' ' + pill(['', 'zählt nicht als Arbeitsstunden'])}${p.sales ? ' ' + pill(['b', 'im Verkauf']) : ''}</h4>
          <div class="muted">${[rangeTxt(p), p.place, `${p.shifts} ${p.shifts === 1 ? 'Schicht' : 'Schichten'}`, p.need ? `${p.filled} von ${p.need} Helfern` : `${p.helpers} Helfer`].filter(Boolean).map(esc).join(' · ')}</div>
          ${p.need ? `<div class="aw-prog"><span class="aw-bar"><i style="width:${Math.round(p.filled / p.need * 100)}%;background:var(--brand)"></i></span><span class="muted s">${p.open ? `${p.open} ${p.open === 1 ? 'Schicht' : 'Schichten'} noch nicht voll` : 'alle Schichten voll'}</span></div>` : ''}</div>
        <div class="acts"><button class="btn small" data-po="${p.id}">Öffnen</button></div></div>`;
    head('Dienstpläne', 'Veranstaltungen mit Tagen und Schichten, z. B. Kirmes oder Turnier. Mitglieder tragen sich in der App ein.');
    $('main').insertAdjacentHTML('beforeend', `<div class="toolbar"><button class="btn primary" id="plNew">+ Neuer Dienstplan</button></div>
      ${chips('plSeg', [['kommend', 'Kommende', coming.length], ['vergangen', 'Vergangene', gone.length]], st.ppast ? 'vergangen' : 'kommend', true)}
      <div class="card"><h3>${st.ppast ? 'Vergangene Dienstpläne' : 'Dienstpläne'}</h3>${list.length ? list.map(card).join('')
        : `<p class="empty">${st.ppast ? 'Keine vergangenen Dienstpläne.' : 'Noch kein Dienstplan – oben „+ Neuer Dienstplan“, z. B. „Kirmes 2026“ mit Tagen und Schichten.'}</p>`}</div>`);
    onChips('plSeg', f => { st.ppast = f === 'vergangen'; renderPlaene().catch(fail); });
    $('plNew').onclick = () => planDialog(null, id => GK.openDetail('dienstplan', id));
    $('main').querySelectorAll('[data-po]').forEach(b => { b.onclick = () => GK.openDetail('dienstplan', +b.dataset.po); });
  }
  function planDialog(p, after) {
    dialog(`<h2>${p ? 'Dienstplan bearbeiten' : 'Neuer Dienstplan'}</h2><div class="aw-grid" style="--c:4">
      <label class="f w2">Veranstaltung<input id="pT" value="${esc(p ? p.title : '')}" placeholder="z. B. Kirmes 2026"></label><label class="f">Erster Tag<input id="pF" type="date" value="${esc(p ? p.from_date : st.meta.today)}"></label><label class="f">Letzter Tag<input id="pU" type="date" value="${esc(p ? p.to_date : st.meta.today)}"></label>
      <label class="f wall">Ort<input id="pP" value="${esc(p ? p.place || '' : '')}" placeholder="z. B. Festzelt am Vereinsheim"></label>
      <label class="f wall">Infos für alle Helfer<textarea id="pN" rows="3" placeholder="z. B. Bitte ein paar Minuten vor Schichtbeginn da sein. Nach Ende wird gemeinsam aufgeräumt.">${esc(p ? p.note || '' : '')}</textarea></label>
      <label class="chk w2"><input type="checkbox" id="pC" ${!p || p.counts ? 'checked' : ''}> Zählt zu den Arbeitsstunden</label>
      <label class="chk w2"><input type="checkbox" id="pV" ${!p || p.published ? 'checked' : ''}> Veröffentlicht – in der Mitglieder-App sichtbar</label></div>
      ${p ? '<div class="row" style="margin-top:18px"><button class="btn danger" id="pDel">Dienstplan löschen …</button></div>' : ''}
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="pOk">Speichern</button></div>`, true);
    $('pF').onchange = () => { if (val('pU') < val('pF')) $('pU').value = val('pF'); };
    $('c').onclick = closeDialog;
    $('pOk').onclick = () => GK.busy($('pOk'), async () => {
      const body = { title: val('pT'), from_date: val('pF'), to_date: val('pU'), place: val('pP'), note: val('pN'), counts: $('pC').checked, published: $('pV').checked };
      try { const r = p ? await api('plans/' + p.id, 'PUT', body) : await api('plans', 'POST', body); closeDialog(); toast('Gespeichert.'); after(p ? p.id : r.id); } catch (x) { fail(x); }
    });
    if ($('pDel')) $('pDel').onclick = () => confirmIn(`Dienstplan „${p.title}“ löschen?`, `Alle ${p.shifts} ${p.shifts === 1 ? 'Schicht' : 'Schichten'} und ${p.helpers} Eintragungen werden mit gelöscht.`, 'Dienstplan löschen', async () => {
      try { await api('plans/' + p.id, 'DELETE'); closeDialog(); toast('Dienstplan gelöscht.'); after(null); } catch (x) { fail(x); }
    }, () => planDialog(p, after));
  }

  /** Detailansicht „Dienstplan“: Überschrift = Veranstaltung, eine Reiterzeile mit „← Alle Dienstpläne“ und den Aktionen rechts */
  GK.registerDetail({
    key: 'dienstplan', page: 'aw-plaene', back: 'Alle Dienstpläne', perm: 'arbeitseinsatz',
    load: async id => {
      await metaNow();
      const d = await api('plans/' + id).catch(() => null); if (!d) return null;
      const p = d.plan;
      return { title: p.title, lead: [rangeTxt(p), p.place, p.need ? `${p.filled} von ${p.need} Helfern` : `${p.helpers} Helfer`].filter(Boolean).join(' · '), tabs: [['schichten', 'Schichten'], ['weitergeben', 'Weitergeben']], d };
    },
    render: async (reiter, body, rec, id) => (reiter === 'weitergeben' ? showWeitergeben(body, rec.d, id) : showPlan(body, rec.d, id)),
  });
  async function showPlan(el, d, id) {
    const p = d.plan, days = []; for (let x = p.from_date; x <= p.to_date; x = addDays(x, 1)) days.push(x);
    const row = e => `<div class="aw-sh${e.cancelled ? ' off' : ''}">
        <div class="aw-when"><b>${esc(when(e))}</b></div>
        <div style="min-width:0"><div class="aw-what"><b translate="no">${esc(e.title)}</b>${pill(fill(e))}${e.counts ? '' : ' ' + pill(['', 'zählt nicht'])}${e.hours.n ? ' ' + pill(['g', `${h(e.hours.min)} gutgeschrieben`]) : ''}</div>
          ${e.note ? `<div class="muted s">${esc(e.note)}</div>` : ''}
          <div class="aw-people">${e.helpers.length ? e.helpers.map(x => `<span class="pill ${x.extern ? '' : 'g'}${x.ph ? ' aw-ph' : ''}" translate="no">${x.ph ? `<img src="api/admin/photo/${x.member_id}?v=${esc(x.ph)}" alt="" loading="lazy">` : ''}${esc(x.ln)}${x.extern ? ' · Gast' : ''}</span>`).join('') : '<span class="muted s">noch niemand</span>'}${e.slots && e.taken < e.slots ? Array.from({ length: Math.min(8, e.slots - e.taken) }, () => '<span class="pill aw-free">frei</span>').join('') : ''}</div></div>
        <div class="acts">${e.date <= st.meta.today && e.counts && e.helpers.some(x => !x.extern) ? `<button class="btn small" data-sc="${e.id}">Stunden gutschreiben</button>` : ''}<button class="btn small" data-sh="${e.id}">Helfer</button><button class="btn small" data-se="${e.id}">Bearbeiten</button></div></div>`;
    el.innerHTML = `${p.note ? `<div class="card aw-note"><b>Infos für alle Helfer</b><div>${esc(p.note)}</div></div>` : ''}
      <div class="aw-people" style="margin-bottom:12px">${p.published ? pill(['g', 'veröffentlicht']) : pill(['a', 'Entwurf – in der App noch nicht sichtbar'])}${p.counts ? pill(['b', 'zählt zu den Arbeitsstunden']) : pill(['', 'zählt nicht als Arbeitsstunden'])}${p.sales ? pill(['b', `im Verkauf: ${p.sales.name}`]) : ''}</div>
      ${days.map(day => { const sh = d.shifts.filter(e => e.date === day);
        return `<div class="card"><div class="aw-dh"><h3>${esc(dayLong(day))}</h3><button class="btn small" data-add="${day}">+ Schicht</button></div>${sh.length ? sh.map(row).join('') : '<p class="empty">Keine Schichten an diesem Tag.</p>'}</div>`; }).join('')}`;
    GK.tabTools(`<button class="btn" id="plEd">Bearbeiten</button><button class="btn" id="plPrint">Drucken</button><a class="btn" href="${BASE}plans/${p.id}/xlsx">Excel</a>${p.published ? '' : '<button class="btn primary" id="plPub">Veröffentlichen</button>'}`, el);
    const again = () => GK.openDetail('dienstplan', id);
    $('plEd').onclick = () => planDialog(p, x => { if (!x) GK.closeDetail(); else again(); });
    $('plPrint').onclick = () => printPlan(p, d.shifts, days);
    if ($('plPub')) $('plPub').onclick = async () => { try { await api('plans/' + p.id, 'PUT', { published: true }); toast('Veröffentlicht – Mitglieder sehen den Plan jetzt in der App.'); again(); } catch (x) { fail(x); } };
    el.querySelectorAll('[data-add]').forEach(b => { b.onclick = () => shiftDialog(p, days, null, b.dataset.add, again); });
    el.querySelectorAll('[data-se]').forEach(b => { b.onclick = () => shiftDialog(p, days, d.shifts.find(e => e.id === +b.dataset.se), null, again); });
    el.querySelectorAll('[data-sh]').forEach(b => { b.onclick = () => shiftHelpers(d.shifts.find(e => e.id === +b.dataset.sh), again); });
    el.querySelectorAll('[data-sc]').forEach(b => { b.onclick = () => { const e = d.shifts.find(x => x.id === +b.dataset.sc); closeEvent({ ...e, signups: e.helpers.filter(x => !x.extern) }, again); }; });
  }
  /** Reiter „Weitergeben“: den Plan als Vorlage kopieren oder in den Verkauf übernehmen */
  function showWeitergeben(el, d, id) {
    const p = d.plan;
    el.innerHTML = `<div class="card"><h3>Als Vorlage kopieren</h3><p class="muted s" style="margin-top:0">Gleiche Schichten an neuen Tagen, z. B. für nächstes Jahr. Helfer werden nicht übernommen.</p><div class="row"><button class="btn" id="plCopy">Als Vorlage kopieren …</button></div></div>
      ${d.drinks && !p.sales ? '<div class="card"><h3>In den Verkauf übernehmen</h3><p class="muted s" style="margin-top:0">Legt den Dienstplan als Veranstaltung im Verkauf an, alle Artikel zum Normalpreis.</p><div class="row"><button class="btn" id="plSale">In den Verkauf übernehmen …</button></div></div>' : ''}`;
    if ($('plSale')) $('plSale').onclick = async () => { if (!await ask(`„${p.title}“ als Veranstaltung im Verkauf anlegen (am ${deDate(p.from_date)}, alle Artikel zum Normalpreis)?`, { ok: 'Übernehmen' })) return; try { await api(`plans/${p.id}/sales`, 'POST', {}); toast('Im Verkauf unter „Veranstaltungen“ angelegt.'); GK.openDetail('dienstplan', id); } catch (x) { fail(x); } };
    $('plCopy').onclick = async () => {
      dialog(`<h2>Als Vorlage kopieren</h2><p class="muted" style="margin-top:0">Gleiche Schichten an neuen Tagen – z. B. für die Kirmes im nächsten Jahr. Helfer werden nicht übernommen, der neue Plan ist zunächst ein Entwurf.</p>
        <div class="aw-grid" style="--c:2"><label class="f">Name<input id="cpT" value="${esc(p.title.replace(/\d{4}/, y => +y + 1))}"></label><label class="f">Erster Tag<input id="cpF" type="date" value="${addDays(p.from_date, 364)}"></label></div>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="cpOk">Kopieren</button></div>`);
      $('c').onclick = closeDialog;
      $('cpOk').onclick = () => GK.busy($('cpOk'), async () => { try { const r = await api(`plans/${p.id}/copy`, 'POST', { title: val('cpT'), from_date: val('cpF') }); closeDialog(); toast('Kopiert.'); GK.openDetail('dienstplan', r.id); } catch (x) { fail(x); } });
    };
  }
  function shiftDialog(p, days, e, day, after) {
    dialog(`<h2>${e ? 'Schicht bearbeiten' : 'Neue Schicht'}</h2><div class="aw-grid" style="--c:4">
      <label class="f w2">Tag<select id="shD">${days.map(x => opt(x, dayLong(x), e ? e.date : day)).join('')}</select></label><label class="f">Von<input id="shS" type="time" value="${esc(e ? e.start || '' : '')}"></label><label class="f">Bis (optional)<input id="shE" type="time" value="${esc(e ? e.end || '' : '')}"></label>
      <label class="f w2">Was<input id="shT" value="${esc(e ? e.title : '')}" placeholder="z. B. Theke, Sektbar, Kasse, Zeltaufbau" list="shTL"><datalist id="shTL">${['Theke', 'Sektbar', 'Kasse', 'Grill', 'Kuchentheke', 'Aufbau', 'Abbau', 'Zeltaufbau', 'Aufräumen', 'Einlass'].map(x => `<option value="${x}">`).join('')}</datalist></label>
      <label class="f w2">Helfer gesucht (leer = beliebig viele)<input id="shN" inputmode="numeric" value="${e && e.slots ? e.slots : ''}" placeholder="z. B. 8"></label>
      <label class="f wall">Infos zur Schicht<input id="shX" value="${esc(e ? e.note || '' : '')}" placeholder="z. B. Bitte ein paar Minuten vorher einfinden"></label>
      <label class="chk w2"><input type="checkbox" id="shC" ${(e ? e.counts : p.counts) ? 'checked' : ''}> Zählt zu den Arbeitsstunden</label>
      ${e ? `<label class="chk w2"><input type="checkbox" id="shA" ${e.cancelled ? '' : 'checked'}> Aktiv (sonst ausgeblendet)</label>` : ''}</div>
      <p class="muted s" style="margin:10px 0 0">Ohne Ende erscheint „ab 16 Uhr“. Ein Ende vor dem Beginn gilt als nach Mitternacht (z. B. 23:30–02:00).</p>
      ${e ? '<div class="row" style="margin-top:18px"><button class="btn danger" id="shDel">Schicht löschen …</button></div>' : ''}
      <div class="btns">${e ? '' : '<label class="chk" style="margin-right:auto"><input type="checkbox" id="shMore"> Danach weitere Schicht anlegen</label>'}<button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="shOk">Speichern</button></div>`, true);
    $('c').onclick = closeDialog;
    $('shOk').onclick = () => GK.busy($('shOk'), async () => {
      const body = { plan_id: p.id, kind: 'dienst', date: val('shD'), start: val('shS'), end: val('shE'), title: val('shT'), slots: val('shN') || null, note: val('shX'), counts: $('shC').checked };
      try {
        if (e) await api('events/' + e.id, 'PUT', { ...body, active: $('shA').checked }); else await api('events', 'POST', { ...body, active: true });
        const more = $('shMore') && $('shMore').checked; closeDialog(); toast('Gespeichert.'); after();
        if (more) setTimeout(() => shiftDialog(p, days, null, body.date, after), 150);
      } catch (x) { fail(x); }
    });
    if ($('shDel')) $('shDel').onclick = () => confirmIn(`Schicht „${e.title}“ (${when(e)}) löschen?`, e.taken ? `${e.taken} eingetragene Helfer werden mit entfernt.` : 'Die Schicht verschwindet aus dem Dienstplan.', 'Schicht löschen', async () => {
      try { await api('events/' + e.id, 'DELETE'); closeDialog(); toast('Schicht gelöscht.'); after(); } catch (x) { fail(x); }
    }, () => shiftDialog(p, days, e, day, after));
  }
  function shiftHelpers(e, after) {
    const people = st.meta.members;
    const draw = () => {
      $('shxL').innerHTML = e.helpers.filter(x => x.extern).map(x => `<span class="pill">${esc(x.name)} <button type="button" class="btn small ghost" data-rx="${x.extern_id}" style="height:22px;padding:0 6px" aria-label="entfernen">×</button></span>`).join('') || '<span class="muted s">keine</span>';
      $('shxL').querySelectorAll('[data-rx]').forEach(b => { b.onclick = async () => { try { await api('extern/' + b.dataset.rx, 'DELETE'); e.helpers = e.helpers.filter(x => x.extern_id !== +b.dataset.rx); draw(); } catch (x) { fail(x); } }; });
    };
    dialog(`<h2>Helfer: ${esc(e.title)} · ${esc(when(e))}</h2><p class="muted" style="margin-top:0">${esc(dayLong(e.date))}${e.slots ? ` · ${e.slots} gesucht` : ''} · Mitglieder tragen sich in der App ein; hier ergänzen oder austragen – auch nach Ablauf der 24-Stunden-Frist.</p>
      <label class="f">Mitglieder filtern<input id="hpQ" data-nodirty placeholder="Name"></label><div class="aw-cols" id="hpL">${people.map(m => `<label class="chk" data-n="${esc(m.name.toLowerCase())}"><input type="checkbox" value="${m.id}" ${e.helpers.some(s => s.member_id === m.id) ? 'checked' : ''}> ${esc(GK.lastFirst(m.name))}</label>`).join('')}</div>
      <div class="f" style="margin-top:14px"><span class="aw-lbl">Helfer ohne Mitgliedschaft (z. B. vom Nachbarverein)</span><div class="aw-people" id="shxL"></div>
        <div class="aw-xadd"><label class="f"><input id="shxN" placeholder="Vor- und Nachname" maxlength="60" aria-label="Vor- und Nachname"></label><button class="btn" id="shxA">Hinzufügen</button></div></div>
      <div class="btns"><button class="btn primary" id="c">Fertig</button></div>`, true);
    draw();
    $('hpQ').oninput = () => { const q = val('hpQ').toLowerCase(); $('hpL').querySelectorAll('[data-n]').forEach(l => { l.style.display = !q || l.dataset.n.includes(q) ? '' : 'none'; }); };
    $('hpL').querySelectorAll('input').forEach(i => { i.onchange = () => api(`events/${e.id}/signup`, 'POST', { member_id: +i.value, remove: !i.checked }).catch(fail); });
    $('shxA').onclick = async () => { const n = val('shxN'); if (n.length < 2) return; try { await api(`events/${e.id}/extern`, 'POST', { name: n }); const d = await api('plans/' + e.plan_id); e.helpers = d.shifts.find(x => x.id === e.id).helpers; $('shxN').value = ''; draw(); } catch (x) { fail(x); } };
    $('c').onclick = () => { closeDialog(); after(); };
  }
  /** Aushang wie die bisherige Tabelle: je Tag Wann · Was · Helfer · Status · Infos */
  function printPlan(p, shifts, days) {
    const w = window.open('', '_blank'); if (!w) return toast('Bitte Pop-ups für die Verwaltung erlauben.', true);
    const club = (st.meta.club || document.title || '').replace(/\s*–.*$/, '');
    w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Dienstplan ${esc(p.title)}</title><style>
      body { font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #1b1f1c; margin: 24px; } h1 { font-size: 22px; margin: 0 0 4px; } .sub { color: #555; margin: 0 0 18px; }
      h2 { font-size: 15px; margin: 22px 0 6px; } table { width: 100%; border-collapse: collapse; table-layout: fixed; } th, td { border: 1px solid #c9cfcb; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #eef2ef; font-size: 12px; } td.st { text-align: center; font-weight: 700; } .ok { color: #1f7a35; } .miss { color: #b26a00; } .free { color: #9aa29d; } .note { color: #444; }
      @page { size: A4; margin: 14mm; } tr { break-inside: avoid; }</style></head><body>
      <h1>${esc(club ? club + ' – ' : '')}Dienstplan ${esc(p.title)}</h1><p class="sub">${esc([rangeTxt(p), p.place].filter(Boolean).join(' · '))}${p.note ? `<br>${esc(p.note)}` : ''}</p>
      ${days.map(day => { const sh = shifts.filter(e => e.date === day && !e.cancelled); if (!sh.length) return '';
        return `<h2>${esc(dayLong(day))}</h2><table><colgroup><col style="width:16%"><col style="width:20%"><col style="width:30%"><col style="width:10%"><col style="width:24%"></colgroup><tr><th>Wann</th><th>Was</th><th>Helfer</th><th>Status</th><th>Infos</th></tr>
          ${sh.map(e => `<tr><td>${esc(when(e))}</td><td><b>${esc(e.title)}</b>${e.slots ? `<br><span class="note">${e.slots} Personen</span>` : ''}</td><td>${e.helpers.map(x => esc(x.ln)).join('<br>')}${e.slots && e.taken < e.slots ? `${e.taken ? '<br>' : ''}<span class="free">${Array.from({ length: e.slots - e.taken }, () => '________').join('<br>')}</span>` : ''}</td>
            <td class="st ${e.slots && e.taken < e.slots ? 'miss' : 'ok'}">${e.slots ? (e.taken >= e.slots ? '✓' : `${e.slots - e.taken} fehlen`) : e.taken}</td><td class="note">${esc(e.note || '')}</td></tr>`).join('')}</table>`; }).join('')}
      <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script></body></html>`);
    w.document.close();
  }

  /* ---------------------------------------------------------------- Stunden */
  async function renderStunden() {
    await metaNow();
    const [rows, open, run] = await Promise.all([api(`entries?status=${st.es}${st.es === 'alle' ? '&year=' + st.year : ''}`), st.es === 'offen' ? null : api('entries?status=offen'), st.es === 'laeuft' ? null : api('entries?status=laeuft')]);
    const nOpen = (open || rows).length, nRun = (run || rows).length;
    head('Stunden', 'Gemeldete und gestempelte Stunden bestätigen oder ablehnen.');
    $('main').insertAdjacentHTML('beforeend', `<div class="toolbar">${st.es === 'offen' && rows.length ? '<button class="btn" id="esNo">Ausgewählte ablehnen</button>' : ''}<button class="btn ${st.es === 'offen' && rows.length ? '' : 'primary'}" id="esAdd">Stunden nachtragen …</button>${st.es === 'offen' && rows.length ? '<button class="btn primary" id="esOk">Ausgewählte bestätigen</button>' : ''}</div>
      ${chips('esSeg', [['offen', 'Zu bestätigen', nOpen], ['laeuft', 'Eingestempelt', nRun], ['alle', 'Alle']], st.es, true)}
      <div class="card">${rows.length ? `<table class="tbl kompakt"><tr><th>${st.es === 'offen' ? '<label class="chk"><input type="checkbox" id="esAll" checked aria-label="alle"> Mitglied</label>' : 'Mitglied'}</th><th>Datum</th><th>Tätigkeit</th><th class="k-weg">Quelle</th><th>Status</th><th class="r">Dauer</th><th></th></tr>
        ${rows.map(r => `<tr class="${r.status === 'abgelehnt' ? 'off' : ''}">
          <td class="k-1z">${st.es === 'offen' ? `<label class="chk"><input type="checkbox" data-id="${r.id}" checked> <b>${esc(GK.lastFirst(r.name))}</b></label>` : `<b>${esc(GK.lastFirst(r.name))}</b>`}</td><td class="nw">${deDate(r.date)}${r.in_at ? `<span class="muted s"> ${r.in_at.slice(11, 16)}${r.out_at ? '–' + r.out_at.slice(11, 16) : ''}</span>` : ''}</td>
          <td class="k-1z" title="${esc(r.reason || '')}"><span translate="no">${esc(r.event_title || r.text || '')}</span>${r.reason ? ` <span class="muted s">${esc(r.reason)}</span>` : ''}</td><td class="k-weg">${esc(SRC[r.source] || r.source)}</td><td>${pill(EST[r.status] || ['', r.status])}</td>
          <td class="r">${r.minutes ? h(r.minutes) : ''}</td><td class="r nw">${r.status === 'laeuft' ? `<button class="btn small" data-stop="${r.id}">Ausstempeln</button>` : `<button class="btn small" data-ed="${r.id}">Ändern</button>`}</td></tr>`).join('')}</table>`
        : `<p class="empty">${st.es === 'offen' ? 'Nichts zu bestätigen.' : st.es === 'laeuft' ? 'Niemand eingestempelt.' : 'Keine Einträge.'}</p>`}</div>`);
    const el = $('main');
    const again = () => { refreshPending(); renderStunden().catch(fail); };
    onChips('esSeg', f => { st.es = f; again(); });
    $('esAdd').onclick = () => addEntries(again);
    const sel = () => [...el.querySelectorAll('[data-id]')].filter(c => c.checked).map(c => +c.dataset.id);
    if ($('esAll')) $('esAll').onchange = () => el.querySelectorAll('[data-id]').forEach(c => { c.checked = $('esAll').checked; });
    if ($('esOk')) $('esOk').onclick = () => GK.busy($('esOk'), async () => { try { const r = await api('entries/review', 'POST', { ids: sel(), approve: true }); toast(`${r.count} bestätigt.`); again(); } catch (e) { fail(e); } });
    if ($('esNo')) $('esNo').onclick = async () => { const reason = await GK.askText('Ablehnen\nGrund (sieht das Mitglied in der App):', ''); if (reason == null) return; try { await api('entries/review', 'POST', { ids: sel(), approve: false, reason }); again(); } catch (e) { fail(e); } };
    el.querySelectorAll('[data-stop]').forEach(b => { b.onclick = async () => { try { await api(`entries/${b.dataset.stop}/stop`, 'POST', {}); toast('Ausgestempelt – bitte bestätigen.'); again(); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-ed]').forEach(b => { b.onclick = () => entryDialog(rows.find(x => x.id === +b.dataset.ed), again); });
  }
  function entryDialog(r, again) {
    dialog(`<h2>Eintrag ändern</h2><p class="muted" style="margin-top:0">${esc(GK.lastFirst(r.name))}</p><div class="aw-grid" style="--c:2"><label class="f">Datum<input id="edD" type="date" value="${r.date}"></label><label class="f">Dauer in Stunden<input id="edM" inputmode="decimal" value="${String((r.minutes || 0) / 60).replace('.', ',')}"></label>
      <label class="f wall">Tätigkeit<input id="edT" value="${esc(r.text || '')}"></label></div>
      <div class="row" style="margin-top:18px"><button class="btn danger" id="edDel">Eintrag löschen …</button></div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="edOk">Speichern</button></div>`);
    $('c').onclick = closeDialog;
    $('edOk').onclick = () => GK.busy($('edOk'), async () => { try { await api('entries/' + r.id, 'PUT', { date: val('edD'), minutes: toMin(val('edM')), text: val('edT') }); closeDialog(); again(); } catch (e) { fail(e); } });
    $('edDel').onclick = () => confirmIn(`Eintrag von ${GK.lastFirst(r.name)} löschen?`, `${deDate(r.date)}, ${r.minutes ? h(r.minutes) : 'ohne Dauer'}${r.text ? ' · ' + r.text : ''}. Die Stunden zählen dann nicht mehr zum Soll.`, 'Eintrag löschen', async () => {
      try { await api('entries/' + r.id, 'DELETE'); closeDialog(); toast('Eintrag gelöscht.'); again(); } catch (e) { fail(e); }
    }, () => entryDialog(r, again));
  }

  /* ---------------------------------------------------------------- Einstellungen */
  /** Karten untereinander (Reihenfolge nach planung/menues.md 3.1), je Karte ein Thema und ein „Speichern“, das nur die eigenen Felder schreibt */
  async function renderEinstellungen() {
    const c = (await metaNow()).cfg;
    const dateTxt = c.remind_date ? c.remind_date.split('-').reverse().join('.') : '';
    const foot = id => `<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" id="${id}">Speichern</button></div>`;
    head('Einstellungen', 'Soll, Abrechnung, Tablet und Erinnerungen der Helferdienste.');
    $('main').insertAdjacentHTML('beforeend', `<div class="card" data-set="soll"><h3>Soll</h3><div class="aw-grid" style="--c:3">
        <label class="f">Stunden je Mitglied und Jahr<input id="sDef" inputmode="decimal" value="${String(c.default_minutes / 60).replace('.', ',')}"></label>
        <label class="f">Ab Alter (0 = alle)<input id="sMin" inputmode="numeric" value="${c.min_age}"></label><label class="f">Bis Alter (0 = ohne Grenze)<input id="sMax" inputmode="numeric" value="${c.max_age}"></label></div>
        <div class="aw-grid" style="--c:2;margin-top:14px">
          <label class="chk"><input type="checkbox" id="sPool" ${c.pool_family ? 'checked' : ''}> Familien gemeinsam zählen (Abrechnung beim Hauptzahler)</label>
          <label class="chk"><input type="checkbox" id="sPass" ${c.exempt_passive ? 'checked' : ''}> Passive und Ehrenmitglieder sind befreit</label>
          <label class="chk"><input type="checkbox" id="sPro" ${c.prorate ? 'checked' : ''}> Bei Ein- oder Austritt im Jahr anteilig</label></div>
        <p class="muted s">Ein eigenes Soll je Beitragsart legst du unter Mitglieder › Beiträge fest, Ausnahmen einzelner Mitglieder in der Übersicht über „Pflichtstunden …“.</p>${foot('sSaveSoll')}</div>
      <div class="card" data-set="abrechnung"><h3>Abrechnung</h3><div class="aw-grid" style="--c:3">
        <label class="f">Stundensatz für fehlende Stunden<input id="sRate" inputmode="decimal" value="${centsToInput(c.rate_cents)}"></label>
        <label class="f">Abrechnungsjahr<select id="sYear">${opt('kalender', 'Kalenderjahr (01.01.–31.12.)', c.year_mode)}${opt('beitrag', 'wie das Beitragsjahr der Mitglieder', c.year_mode)}</select></label>
        <label class="f">Abrechnen ab Jahr<input id="sStart" inputmode="numeric" value="${c.start_year}"></label></div>
        <p class="muted s">Fehlende Stunden kommen im Beitragslauf als Posten „Arbeitsstunden“ dazu.</p>${foot('sSaveAbr')}</div>
      <div class="card" data-set="tablet"><h3>Tablet & App</h3><div class="aw-grid" style="--c:1">
        <label class="f" style="max-width:320px">Am Tablet runden auf (Minuten)<input id="sRound" inputmode="numeric" value="${c.round}"></label>
        <label class="chk"><input type="checkbox" id="sTab" ${c.tablet_auto ? 'checked' : ''}> Am Tablet gestempelte Stunden (mit PIN) gelten sofort als bestätigt</label>
        <label class="chk"><input type="checkbox" id="sApp" ${c.app_report ? 'checked' : ''}> Mitglieder dürfen Stunden in der App melden (Vorstand bestätigt)</label></div>${foot('sSaveTab')}</div>
      <div class="card" data-set="befreit" data-nodirty><h3>Befreite Mitglieder</h3><p class="muted s" style="margin-top:0">Befreite leisten Stunden wie alle (sie werden erfasst), haben aber kein Soll. Änderungen gelten sofort.</p>
        <div class="aw-grid" style="--c:4"><label class="f">Mitglied<select id="exM"><option value="">– Mitglied wählen –</option>${(st.meta.members || []).map(m => opt(m.id, GK.lastFirst(m.name))).join('')}</select></label>
          <label class="f">Grund<input id="exN" placeholder="z. B. Vorstand, Krankheit"></label><label class="f">Befreit bis (leer = dauerhaft)<input id="exU" type="date"></label>
          <label class="f"><span>&nbsp;</span><button class="btn" id="exAdd">Befreien</button></label></div>
        <div id="exList" style="margin-top:12px"></div></div>
      <div class="card" data-set="benachrichtigung"><h3>Benachrichtigungen & Kontakt</h3><div class="aw-grid" style="--c:2">
        <label class="f">Erinnerung an fehlende Stunden per E-Mail am (TT.MM., leer = aus)<input id="sRem" value="${esc(dateTxt)}" placeholder="z. B. 01.09."></label>
        <label class="chk" style="align-self:end;min-height:40px"><input type="checkbox" id="sEvR" ${c.remind_events ? 'checked' : ''}> Helfer am Vortag per E-Mail erinnern</label>
        <label class="f">Absagen per E-Mail an (mehrere mit Komma)<input id="sNot" value="${esc(c.notify || '')}" placeholder="z. B. vorstand@verein.de"></label>
        <label class="f">Kontakt für kurzfristige Absagen<input id="sCon" value="${esc(c.contact || '')}" placeholder="z. B. Max, 0170 1234567"></label>
        <label class="f wall">Hinweis für Mitglieder (App und Tablet)<input id="sText" value="${esc(c.text)}" placeholder="z. B. Jedes Mitglied ab 12 Jahren leistet 4 Stunden im Jahr."></label></div>
        <p class="muted s">Mitglieder können sich in der App bis 24 Stunden vor Beginn austragen, die Verwaltung bekommt dann eine E-Mail. Danach gilt der Kontakt.</p>${foot('sSaveBen')}</div>
      <div id="sFunc"></div>`);
    GK.watch($('main'));
    // jede Karte schreibt nur ihre eigenen Felder; danach neu zeichnen
    const save = (btn, body) => { $(btn).onclick = () => GK.busy($(btn), async () => {
      try { await api('settings', 'PUT', body()); GK.clean(); toast('Gespeichert.'); renderEinstellungen().catch(fail); } catch (e) { fail(e); }
    }); };
    save('sSaveSoll', () => ({ default_minutes: toMin(val('sDef')), min_age: +val('sMin') || 0, max_age: +val('sMax') || 0, pool_family: $('sPool').checked, exempt_passive: $('sPass').checked, prorate: $('sPro').checked }));
    save('sSaveAbr', () => ({ rate_cents: toCents(val('sRate') || '0'), year_mode: val('sYear'), start_year: +val('sStart') || undefined }));
    save('sSaveTab', () => ({ round: +val('sRound') || 1, tablet_auto: $('sTab').checked, app_report: $('sApp').checked }));
    save('sSaveBen', () => { const rm = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(val('sRem')); return { remind_date: rm ? `${rm[2].padStart(2, '0')}-${rm[1].padStart(2, '0')}` : '', remind_events: $('sEvR').checked, notify: val('sNot'), contact: val('sCon'), text: val('sText') }; });
    const exLoad = async () => {
      const l = await api('exempt');
      $('exList').innerHTML = l.length ? `<table class="tbl kompakt">${l.map(x => `<tr><td class="k-1z"><b>${esc(GK.lastFirst(x.name))}</b></td><td>${esc(x.note || '')}</td><td class="nw">${x.until_date ? 'bis ' + deDate(x.until_date) : 'dauerhaft'}</td><td class="r"><button class="btn small" data-exd="${x.member_id}">Aufheben</button></td></tr>`).join('')}</table>` : '<p class="empty">Niemand befreit – oben ein Mitglied wählen und „Befreien“.</p>';
      $('exList').querySelectorAll('[data-exd]').forEach(b => { b.onclick = async () => { try { await api('exempt/' + b.dataset.exd, 'DELETE'); toast('Befreiung aufgehoben.'); exLoad(); } catch (e) { fail(e); } }; });
    };
    $('exAdd').onclick = async () => { try { await api('exempt', 'PUT', { member_id: +val('exM'), note: val('exN'), until: val('exU') }); $('exM').value = ''; $('exN').value = ''; $('exU').value = ''; toast('Befreit.'); exLoad(); } catch (e) { fail(e); } };
    exLoad().catch(fail);
    if (GK.funcBox) GK.funcBox($('sFunc'), 'arbeitseinsatz', 'Helferdienste', () => renderEinstellungen().catch(fail));
  }

  void deTime;
  /* Reiter: Übersicht · Dienstpläne · Einsätze · Stunden · Einstellungen (Abzeichen am Reiter „Stunden“) */
  const G = { key: 'arbeitseinsatz', label: 'Helferdienste', icon: 'arbeit', order: 3 };
  GK.registerPage({ key: 'arbeitseinsatz', title: 'Übersicht', perm: 'arbeitseinsatz', render: renderUebersicht, group: G });
  GK.registerPage({ key: 'aw-plaene', title: 'Dienstpläne', perm: 'arbeitseinsatz', render: renderPlaene, group: G });
  GK.registerPage({ key: 'aw-einsaetze', title: 'Einsätze', perm: 'arbeitseinsatz', render: renderEinsaetze, group: G });
  GK.registerPage({ key: 'aw-stunden', title: 'Stunden', perm: 'arbeitseinsatz', render: renderStunden, group: G });
  GK.registerPage({ key: 'aw-einstellungen', title: 'Einstellungen', perm: 'arbeitseinsatz', render: renderEinstellungen, group: G });
  // Suche (Strg/⌘ K): Reiter findet sie von selbst, hier Aktionen und Einstellungskarten der Helferdienste
  if (GK.registerSearch) GK.registerSearch([
    { label: 'Dienstplan anlegen', page: 'aw-plaene', btn: '+ Neuer Dienstplan', kind: 'aktion', words: 'Veranstaltung Schichten Kirmes Turnier' },
    { label: 'Einsatz oder Thekendienst anlegen', page: 'aw-einsaetze', btn: '+ Neuer Einsatz', kind: 'aktion', words: 'Arbeitseinsatz Thekendienst Einzeltermin Termin' },
    { label: 'Stunden bestätigen', page: 'aw-stunden', kind: 'aktion', words: 'Arbeitsstunden bestätigen ablehnen freigeben gemeldet' },
    { label: 'Stunden nachtragen', page: 'aw-stunden', btn: 'Stunden nachtragen', kind: 'aktion', words: 'Arbeitsstunden nachtragen eintragen' },
    { label: 'Dienstplan als Vorlage kopieren', page: 'aw-plaene', kind: 'aktion', words: 'Vorlage kopieren nächstes Jahr Kirmes' },
    { label: 'Dienstplan in den Verkauf übernehmen', page: 'aw-plaene', kind: 'aktion', words: 'Veranstaltung Verkauf Getränke' },
    { label: 'Pflichtstunden einzelner Mitglieder', page: 'arbeitseinsatz', btn: 'Pflichtstunden', kind: 'aktion', words: 'Soll befreien Ausnahme Arbeitsstunden' },
    { label: 'Arbeitsstunden als Excel', page: 'arbeitseinsatz', btn: 'Excel', kind: 'aktion', words: 'Export Liste' },
    { label: 'Soll der Arbeitsstunden', page: 'aw-einstellungen', card: 'Soll', words: 'Stunden je Mitglied Alter Familien gemeinsam Passive Ehrenmitglieder anteilig Eintritt Austritt' },
    { label: 'Abrechnung der Arbeitsstunden', page: 'aw-einstellungen', card: 'Abrechnung', words: 'Stundensatz fehlende Stunden Abrechnungsjahr Beitragsjahr Beitragslauf' },
    { label: 'Stunden am Tablet und in der App', page: 'aw-einstellungen', card: 'Tablet & App', words: 'runden Minuten sofort bestätigt melden Stempeln' },
    { label: 'Befreite Mitglieder (Helferdienste)', page: 'aw-einstellungen', card: 'Befreite Mitglieder', words: 'befreien Ausnahme Vorstand' },
    { label: 'Erinnerungen und Absagen der Helferdienste', page: 'aw-einstellungen', card: 'Benachrichtigungen & Kontakt', words: 'Erinnerung E-Mail Vortag Absagen Kontakt Hinweis fehlende Stunden' },
    { label: 'Einstellungen der Helferdienste übertragen', page: 'aw-einstellungen', card: 'Einstellungen übertragen', kind: 'aktion', words: 'Export Import Datei' },
  ]);
  // Zähler: gemeldete Stunden, die noch zu bestätigen sind (am Reiter „Stunden“, im Menü die Summe)
  if (GK.badges) GK.badges(async () => { if (!GK.can('arbeitseinsatz')) return {}; const m = await api('meta'); return { 'aw-stunden': m.pending || 0 }; });
})();
