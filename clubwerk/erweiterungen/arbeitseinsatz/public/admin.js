'use strict';
/* Verwaltung „Arbeitseinsatz & Thekendienst“: Übersicht · Einsätze · Stunden · Einstellungen */
(() => {
  const GK = window.GK;
  const { $, esc, euro, toast, fail, dialog, closeDialog, ask, deDate, deTime, toCents, centsToInput } = GK;
  const api = (url, method, body) => GK.api('x/arbeitseinsatz/' + url, method, body);
  const BASE = 'api/admin/x/arbeitseinsatz/';
  const KIND = { arbeit: 'Arbeitseinsatz', theke: 'Thekendienst', sonstiges: 'Sonstiges' };
  const EST = { laeuft: ['b', 'läuft'], offen: ['a', 'zu bestätigen'], bestaetigt: ['g', 'bestätigt'], abgelehnt: ['', 'abgelehnt'] };
  const SRC = { verwaltung: 'Verwaltung', app: 'App', tablet: 'Tablet' };
  const st = { meta: null, year: null, past: false, es: 'offen' };
  const h = m => { const v = (m || 0) / 60; return `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })} h`; };
  const toMin = v => Math.round(Number(String(v || '').replace(',', '.')) * 60);
  const pill = ([c, t]) => `<span class="pill ${c}">${esc(t)}</span>`;
  const opt = (v, l, s) => `<option value="${esc(v)}" ${String(v) === String(s ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
  const val = id => ($(id) ? $(id).value.trim() : '');
  const bar = (done, target) => { const p = target ? Math.min(100, Math.round(done / target * 100)) : 100; return `<span class="aw-bar"><i style="width:${p}%;background:${p >= 100 ? 'var(--brand)' : p >= 50 ? 'var(--amber)' : 'var(--red)'}"></i></span>`; };

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
      .aw-date { width: 76px; height: 64px; border-radius: 14px; background: var(--brand-soft); color: var(--brand-ink); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; line-height: 1.1; }
      .aw-date b { font-size: 22px; } .aw-date span { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .aw-ev h4 { margin: 0 0 4px; font-size: 15.5px; } .aw-ev .muted { font-size: 13px; }
      .aw-ev .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .aw-people { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
      .aw-cols { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px 16px; max-height: 46vh; overflow: auto; padding: 4px 0; }`;
    document.head.appendChild(s);
  }

  async function render() {
    st.meta = await api('meta');
    st.year = st.year || st.meta.year;
    $('main').innerHTML = `<h2 class="page">Arbeitseinsatz & Thekendienst</h2>
      <p class="lead">Einsätze planen, Stunden sammeln und bestätigen. Wer sein Soll nicht schafft, bezahlt den Stundensatz – automatisch im Beitragslauf der Mitgliederverwaltung.</p>
      ${!st.meta.mv ? '<div class="banner a"><span>Ohne die Mitgliederverwaltung gilt die Vorgabe für alle Mitglieder gleich; Familien, Alter, Beitragsarten und die Abrechnung brauchen das Modul „Mitgliederverwaltung“.</span></div>' : ''}
      <div id="awTabs"></div>`;
    st.tabs = GK.tabs($('awTabs'), 'arbeitseinsatz', [['uebersicht', 'Übersicht'], ['einsaetze', 'Einsätze'], ['stunden', `Stunden${st.meta.pending ? ` (${st.meta.pending})` : ''}`], ['einstellungen', 'Einstellungen']], async (k, el) => {
      if (k === 'uebersicht') return showOverview(el);
      if (k === 'einsaetze') return showEvents(el);
      if (k === 'stunden') return showEntries(el);
      if (k === 'einstellungen') return showSettings(el);
    });
  }

  /* ---------------------------------------------------------------- Übersicht */
  async function showOverview(el) {
    const o = await api('overview?year=' + st.year);
    const open = new Set();
    el.innerHTML = `<div class="filterbar"><label class="f" style="flex-direction:row;align-items:center;gap:8px">Jahr<select id="awYear" data-nodirty>${st.meta.years.map(y => opt(y.y, y.label, st.year)).join('')}</select></label>
        <span class="muted s">${deDate(o.from)} – ${deDate(o.to)}${o.closed ? ' · abgeschlossen' : ''}</span><span style="margin-left:auto"></span>
        <button class="btn ghost" id="awAdd">Stunden nachtragen …</button><a class="btn ghost" href="${BASE}overview.xlsx?year=${o.year}">Excel</a></div>
      <div class="kpis"><div class="kpi"><div class="l">Soll gesamt</div><div class="v">${h(o.totals.target)}</div></div><div class="kpi"><div class="l">geleistet</div><div class="v">${h(o.totals.done)}</div></div>
        <div class="kpi ${o.totals.missing ? 'warn' : ''}"><div class="l">fehlen noch</div><div class="v">${h(o.totals.missing)}</div></div><div class="kpi"><div class="l">entspricht (${euro(o.rate_cents)}/h)</div><div class="v">${euro(o.totals.cents)}</div></div></div>
      <div class="filterbar"><label class="search"><span aria-hidden="true">${GK.icon('suche', 16)}</span><input id="awQ" placeholder="Name suchen"></label>
        <div class="seg" id="awSeg">${[['fehlt', 'Fehlen noch'], ['fertig', 'Erledigt'], ['befreit', 'Befreit'], ['alle', 'Alle']].map(([k, l]) => `<button type="button" data-f="${k}" class="${(st.of || 'fehlt') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="card" style="padding:0 20px"><table class="tbl" id="awTbl"></table></div>
      <p class="muted s">${o.pool ? 'Familien werden gemeinsam gezählt: das Soll aller Angehörigen zusammen, geleistet ist, was irgendwer aus der Familie gemacht hat.' : ''} ${o.closed ? 'Die fehlenden Stunden kommen beim nächsten Beitragslauf als Posten „Arbeitsstunden“ dazu.' : `Abgerechnet wird nach Ablauf (${deDate(o.to)}) im Beitragslauf.`}</p>`;
    $('awYear').onchange = () => { st.year = +val('awYear'); showOverview(el).catch(fail); };
    $('awAdd').onclick = () => addEntries(() => showOverview(el));
    const draw = () => {
      const q = val('awQ').toLowerCase(), f = st.of || 'fehlt';
      const exOf = x => x.members.every(id => (o.rows.find(r => r.id === id) || {}).exempt);
      const fams = o.families.filter(x => (f === 'alle' || (f === 'fehlt' ? x.missing > 0 : f === 'befreit' ? x.members.some(id => (o.rows.find(r => r.id === id) || {}).exempt) : x.missing === 0 && !exOf(x))) && (!q || x.members.some(id => (o.rows.find(r => r.id === id) || {}).name.toLowerCase().includes(q))));
      const rowOf = id => o.rows.find(r => r.id === id);
      $('awTbl').innerHTML = `<tr><th>${o.pool ? 'Familie / Mitglied' : 'Mitglied'}</th><th class="r">Soll</th><th class="r">geleistet</th><th>Fortschritt</th><th class="r">gemeldet</th><th class="r">fehlt</th><th class="r">Betrag</th><th></th></tr>`
        + (fams.length ? fams.map(x => {
          const many = x.members.length > 1;
          const head = `<tr><td>${many ? `<button class="btn small ghost" data-tg="${x.head}" style="min-width:32px;padding:0 8px">${open.has(x.head) ? '−' : '+'}</button> ` : ''}<b>${esc(GK.lastFirst(x.name))}</b>${many ? ` <span class="pill">Familie · ${x.members.length}</span>` : `${rowOf(x.head).exempt ? ' <span class="pill g">befreit</span>' : ''}<div class="muted s">${esc(rowOf(x.head).why)}</div>`}</td>
            <td class="r">${h(x.target)}</td><td class="r">${h(x.done)}</td><td>${bar(x.done, x.target)}</td><td class="r">${x.open ? h(x.open) : '<span class="muted s">–</span>'}</td>
            <td class="r ${x.missing ? 'neg' : ''}">${x.missing ? h(x.missing) : '✓'}</td><td class="r">${x.cents ? euro(x.cents) : '<span class="muted s">–</span>'}</td>
            <td class="r">${many ? '' : `<button class="btn small" data-tgt="${x.head}">Pflichtstunden …</button>`}</td></tr>`;
          const subs = many && open.has(x.head) ? x.members.map(id => { const r = rowOf(id); return `<tr class="aw-sub"><td>${esc(GK.lastFirst(r.name))}${r.exempt ? ' <span class="pill g">befreit</span>' : ''}<div class="muted s">${esc(r.why)}</div></td><td class="r">${h(r.target)}${r.override ? ' <span class="pill b">eigen</span>' : ''}</td><td class="r">${h(r.done)}</td><td></td><td class="r">${r.open ? h(r.open) : ''}</td><td></td><td></td><td class="r"><button class="btn small" data-tgt="${id}">Pflichtstunden …</button></td></tr>`; }).join('') : '';
          return head + subs;
        }).join('') : `<tr><td colspan="8" class="muted" style="text-align:center;height:72px">${o.families.length ? 'Keine Treffer.' : 'Noch niemand mit Soll – unter Einstellungen die Vorgabe prüfen.'}</td></tr>`);
      $('awTbl').querySelectorAll('[data-tg]').forEach(b => { b.onclick = () => { const k = +b.dataset.tg; if (open.has(k)) open.delete(k); else open.add(k); draw(); }; });
      $('awTbl').querySelectorAll('[data-tgt]').forEach(b => { b.onclick = () => targetDialog(rowOf(+b.dataset.tgt), o, () => showOverview(el)); });
    };
    draw();
    $('awQ').oninput = draw;
    $('awSeg').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; st.of = b.dataset.f; $('awSeg').querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); draw(); };
  }
  function targetDialog(r, o, after) {
    let mode = r.exempt ? 'befreit' : r.override ? 'eigen' : 'auto';
    dialog(`<h2>Pflichtstunden · ${esc(GK.lastFirst(r.name))}</h2><p class="muted" style="margin-top:0">${esc(o.label)} · derzeit <b>${h(r.target)}</b> (${esc(r.why)})</p>
      <div class="seg" id="tgS" style="width:fit-content;margin:0 0 16px">${[['auto', 'Automatisch'], ['eigen', 'Eigenes Soll'], ['befreit', 'Befreit']].map(([k, l]) => `<button type="button" data-m="${k}">${l}</button>`).join('')}</div>
      <p class="muted s" id="tgH" style="margin:0 0 14px"></p>
      <div class="aw-grid" style="--c:2">
        <label class="f tg-e">Soll in Stunden (nur ${esc(o.label)})<input id="tgM" inputmode="decimal" value="${r.override ? String(r.target / 60).replace('.', ',') : ''}"></label>
        <label class="f tg-b">befreit bis (leer = dauerhaft)<input id="tgU" type="date" value="${esc(r.exempt_until || '')}"></label>
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
    $('tgOk').onclick = async () => {
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
    };
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
    $('aeOk').onclick = async () => {
      const ids = [...$('aeL').querySelectorAll('input:checked')].map(i => +i.value);
      try { await api('entries', 'POST', { member_ids: ids, date: val('aeD'), minutes: toMin(val('aeM')), event_id: val('aeE') || null, text: val('aeT') }); closeDialog(); toast(`${ids.length} × eingetragen.`); after(); } catch (e) { fail(e); }
    };
  }

  /* ---------------------------------------------------------------- Einsätze */
  async function showEvents(el) {
    const list = await api('events' + (st.past ? '?past=1' : ''));
    const wd = d => new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' });
    const perm = list.filter(e => e.permanent), dated = list.filter(e => !e.permanent);
    const row = e => `<div class="aw-ev${e.cancelled ? ' off' : ''}">
        ${e.permanent ? '<div class="aw-date perm"><b>∞</b><span>ganzjährig</span></div>' : `<div class="aw-date"><span>${wd(e.date)}</span><b>${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.</b></div>`}
        <div style="min-width:0"><h4><span translate="no">${esc(e.title)}</span> ${pill(e.kind === 'theke' ? ['b', KIND[e.kind]] : ['', KIND[e.kind]])}${e.cancelled ? ' ' + pill(['a', 'deaktiviert']) : ''}</h4>
          <div class="muted">${(e.permanent ? [e.cancelled ? 'am Tablet nicht wählbar' : 'am Tablet jederzeit wählbar', e.place, e.hours.n ? `${h(e.hours.min)} erfasst` : '']
            : [e.start ? `${e.start}${e.end ? '–' + e.end : ''} Uhr` : '', e.place, e.slots ? `${e.signups.length} von ${e.slots} Plätzen` : `${e.signups.length} eingetragen`, e.hours.n ? `${h(e.hours.min)} erfasst` : '']).filter(Boolean).map(esc).join(' · ')}</div>
          ${!e.permanent && e.signups.length ? `<div class="aw-people">${e.signups.map(s => `<span class="pill g">${esc(s.name)}</span>`).join('')}</div>` : ''}</div>
        <div class="acts">${!e.permanent && e.date <= st.meta.today ? `<button class="btn small primary" data-evc="${e.id}">Stunden gutschreiben</button>` : ''}${e.permanent ? '' : `<button class="btn small" data-evp="${e.id}">Helfer</button>`}<button class="btn small aw-tog" data-eva="${e.id}" data-on="${e.cancelled ? 1 : 0}">${e.cancelled ? 'Aktivieren' : 'Deaktivieren'}</button><button class="btn small" data-eve="${e.id}">Bearbeiten</button></div></div>`;
    el.innerHTML = `<div class="toolbar"><button class="btn primary" id="evNew">+ Einsatz / Thekendienst</button><button class="btn ghost" id="evPast">${st.past ? 'Kommende anzeigen' : 'Vergangene anzeigen'}</button></div>
      ${st.past ? '' : `<div class="card"><h3>Dauerhaft (ganzjährig)</h3><p class="muted s" style="margin-top:0">Ohne festen Termin – z. B. Thekendienst. Solange aktiv, kann man ihn am Tablet beim Einstempeln wählen.</p>${perm.length ? perm.map(row).join('') : '<p class="muted">Keine. Beim Anlegen „dauerhaft“ wählen.</p>'}</div>`}
      <div class="card"><h3>${st.past ? 'Vergangene Einsätze' : 'Kommende Einsätze'}</h3>${dated.length ? dated.map(row).join('')
        : `<p class="muted">${st.past ? 'Keine vergangenen Einsätze.' : 'Nichts geplant – mit „+ Einsatz / Thekendienst“ anlegen. Mitglieder tragen sich dann in der Mitglieder-App unter „Dienste“ ein.'}</p>`}</div>`;
    const again = () => showEvents(el).catch(fail);
    $('evPast').onclick = () => { st.past = !st.past; again(); };
    $('evNew').onclick = () => eventDialog(null, again);
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
      <label class="chk wall" style="min-height:32px"><input type="checkbox" id="evPm" ${e && e.permanent ? 'checked' : ''}> dauerhaft – ganzjährig ohne festen Termin (z. B. Thekendienst), am Tablet jederzeit wählbar</label>
      <label class="f aw-dated">Datum<input id="evD" type="date" value="${esc(e ? e.date : st.meta.today)}"></label><label class="f aw-dated">von<input id="evS" type="time" value="${esc(e ? e.start || '' : '')}"></label><label class="f aw-dated">bis<input id="evE" type="time" value="${esc(e ? e.end || '' : '')}"></label>
      <label class="f w2" id="evPL">Ort / Treffpunkt<input id="evP" value="${esc(e ? e.place || '' : '')}"></label><label class="f aw-dated">Helfer gesucht (leer = beliebig)<input id="evN" inputmode="numeric" value="${e && e.slots ? e.slots : ''}"></label>
      <label class="f wall">Hinweis für die Helfer<input id="evX" value="${esc(e ? e.note || '' : '')}" placeholder="z. B. Arbeitshandschuhe mitbringen"></label>
      ${e ? '' : '<label class="f aw-dated">wöchentlich wiederholen (Wochen)<input id="evR" inputmode="numeric" placeholder="0"></label>'}
      <label class="chk ${e ? 'wall' : 'w2'}" id="evAL" style="min-height:40px;align-self:end"><input type="checkbox" id="evA" ${!e || !e.cancelled ? 'checked' : ''}> aktiv – steht am Tablet und in der Mitglieder-App</label></div>
      <div class="btns">${e ? '<button class="btn danger" id="evDel" style="margin-right:auto">Löschen</button>' : ''}<button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="evOk">Speichern</button></div>`);
    void dur;
    const pmPaint = () => { const pm = $('evPm').checked; $('dialog').querySelectorAll('.aw-dated').forEach(x => { x.style.display = pm ? 'none' : ''; }); $('evPL').classList.toggle('wall', pm); $('evPL').classList.toggle('w2', !pm); if (!e) { $('evAL').classList.toggle('wall', pm); $('evAL').classList.toggle('w2', !pm); } };
    $('evPm').onchange = () => { if ($('evPm').checked && val('evK') === 'arbeit' && !val('evT')) { $('evK').value = 'theke'; $('evT').value = 'Thekendienst'; } pmPaint(); };
    pmPaint();
    $('c').onclick = closeDialog;
    $('evOk').onclick = async () => {
      const body = { permanent: $('evPm').checked, kind: val('evK'), title: val('evT'), date: val('evD') || st.meta.today, start: val('evS'), end: val('evE'), place: val('evP'), slots: val('evN') || null, note: val('evX') };
      try { if (e) await api('events/' + e.id, 'PUT', { ...body, active: $('evA').checked }); else await api('events', 'POST', { ...body, active: $('evA').checked, repeat_weeks: val('evR') || 0 }); closeDialog(); toast('Gespeichert.'); after(); } catch (x) { fail(x); }
    };
    if ($('evDel')) $('evDel').onclick = async () => { if (!await ask('Einsatz löschen?')) return; try { await api('events/' + e.id, 'DELETE'); closeDialog(); after(); } catch (x) { fail(x); } };
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
    const def = e.start && e.end ? ((+e.end.slice(0, 2) * 60 + +e.end.slice(3)) - (+e.start.slice(0, 2) * 60 + +e.start.slice(3))) : '';
    dialog(`<h2>Stunden gutschreiben: ${esc(e.title)}</h2><p class="muted" style="margin-top:0">Alle angekreuzten Helfer bekommen die Stunden bestätigt. Wer schon Stunden zu diesem Einsatz hat, wird übersprungen.</p>
      <label class="f" style="max-width:240px">Dauer in Stunden<input id="ceM" inputmode="decimal" value="${def ? String(def / 60).replace('.', ',') : ''}"></label>
      <div class="aw-cols" style="margin-top:12px" id="ceL">${(e.signups.length ? e.signups : []).map(s => `<label class="chk"><input type="checkbox" value="${s.member_id}" checked> ${esc(GK.lastFirst(s.name))}</label>`).join('') || '<p class="muted">Niemand eingetragen – über „Helfer“ ergänzen oder „Stunden nachtragen“ nutzen.</p>'}</div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ceOk" ${e.signups.length ? '' : 'disabled'}>Gutschreiben</button></div>`);
    $('c').onclick = closeDialog;
    $('ceOk').onclick = async () => { try { const r = await api(`events/${e.id}/close`, 'POST', { minutes: toMin(val('ceM')), members: [...$('ceL').querySelectorAll('input:checked')].map(i => +i.value) }); closeDialog(); toast(`${r.count} Helfer gutgeschrieben.`); after(); } catch (x) { fail(x); } };
  }

  /* ---------------------------------------------------------------- Stunden */
  async function showEntries(el) {
    const rows = await api(`entries?status=${st.es}${st.es === 'alle' ? '&year=' + st.year : ''}`);
    el.innerHTML = `<div class="filterbar"><div class="seg" id="esSeg">${[['offen', 'Zu bestätigen'], ['laeuft', 'Eingestempelt'], ['alle', 'Alle']].map(([k, l]) => `<button type="button" data-f="${k}" class="${st.es === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <span style="margin-left:auto"></span>${st.es === 'offen' && rows.length ? '<button class="btn ghost" id="esNo">Ausgewählte ablehnen</button><button class="btn primary" id="esOk">Ausgewählte bestätigen</button>' : ''}<button class="btn ghost" id="esAdd">Stunden nachtragen …</button></div>
      <div class="card">${rows.length ? `<table class="tbl"><tr>${st.es === 'offen' ? '<th style="width:36px"><input type="checkbox" id="esAll" checked aria-label="alle"></th>' : ''}<th>Datum</th><th>Mitglied</th><th>Tätigkeit</th><th>Quelle</th><th>Status</th><th class="r">Dauer</th><th></th></tr>
        ${rows.map(r => `<tr class="${r.status === 'abgelehnt' ? 'off' : ''}">${st.es === 'offen' ? `<td><input type="checkbox" data-id="${r.id}" checked></td>` : ''}<td class="nw">${deDate(r.date)}${r.in_at ? `<div class="muted s">${r.in_at.slice(11, 16)}${r.out_at ? '–' + r.out_at.slice(11, 16) : ''}</div>` : ''}</td>
          <td><b>${esc(GK.lastFirst(r.name))}</b></td><td><span translate="no">${esc(r.event_title || r.text || '')}</span>${r.reason ? `<div class="muted s">${esc(r.reason)}</div>` : ''}</td><td>${esc(SRC[r.source] || r.source)}</td><td>${pill(EST[r.status] || ['', r.status])}</td>
          <td class="r">${r.minutes ? h(r.minutes) : '–'}</td><td class="r nw">${r.status === 'laeuft' ? `<button class="btn small" data-stop="${r.id}">Ausstempeln</button>` : `<button class="btn small" data-ed="${r.id}">Ändern</button>`} <button class="btn small danger" data-del="${r.id}">Löschen</button></td></tr>`).join('')}</table>`
        : `<p class="muted">${st.es === 'offen' ? 'Nichts zu bestätigen.' : st.es === 'laeuft' ? 'Niemand eingestempelt.' : 'Keine Einträge.'}</p>`}</div>`;
    const again = () => { api('meta').then(m => { st.meta = m; }).catch(() => {}); showEntries(el).catch(fail); };
    $('esSeg').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; st.es = b.dataset.f; again(); };
    $('esAdd').onclick = () => addEntries(again);
    const sel = () => [...el.querySelectorAll('[data-id]')].filter(c => c.checked).map(c => +c.dataset.id);
    if ($('esAll')) $('esAll').onchange = () => el.querySelectorAll('[data-id]').forEach(c => { c.checked = $('esAll').checked; });
    if ($('esOk')) $('esOk').onclick = async () => { try { const r = await api('entries/review', 'POST', { ids: sel(), approve: true }); toast(`${r.count} bestätigt.`); again(); } catch (e) { fail(e); } };
    if ($('esNo')) $('esNo').onclick = async () => { const reason = await GK.askText('Ablehnen\nGrund (sieht das Mitglied in der App):', ''); if (reason == null) return; try { await api('entries/review', 'POST', { ids: sel(), approve: false, reason }); again(); } catch (e) { fail(e); } };
    el.querySelectorAll('[data-stop]').forEach(b => { b.onclick = async () => { try { await api(`entries/${b.dataset.stop}/stop`, 'POST', {}); toast('Ausgestempelt – bitte bestätigen.'); again(); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-del]').forEach(b => { b.onclick = async () => { if (!await ask('Eintrag löschen?')) return; try { await api('entries/' + b.dataset.del, 'DELETE'); again(); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-ed]').forEach(b => { b.onclick = () => {
      const r = rows.find(x => x.id === +b.dataset.ed);
      dialog(`<h2>Eintrag ändern</h2><div class="aw-grid" style="--c:2"><label class="f">Datum<input id="edD" type="date" value="${r.date}"></label><label class="f">Dauer in Stunden<input id="edM" inputmode="decimal" value="${String((r.minutes || 0) / 60).replace('.', ',')}"></label>
        <label class="f wall">Tätigkeit<input id="edT" value="${esc(r.text || '')}"></label></div><div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="edOk">Speichern</button></div>`);
      $('c').onclick = closeDialog;
      $('edOk').onclick = async () => { try { await api('entries/' + r.id, 'PUT', { date: val('edD'), minutes: toMin(val('edM')), text: val('edT') }); closeDialog(); again(); } catch (e) { fail(e); } };
    }; });
  }

  /* ---------------------------------------------------------------- Einstellungen */
  async function showSettings(el) {
    const c = (await api('meta')).cfg;
    el.innerHTML = `<div class="card"><h3>Soll & Abrechnung</h3><div class="aw-grid" style="--c:4">
        <label class="f">Stunden je Mitglied und Jahr<input id="sDef" inputmode="decimal" value="${String(c.default_minutes / 60).replace('.', ',')}"></label>
        <label class="f">Stundensatz für fehlende Stunden<input id="sRate" inputmode="decimal" value="${centsToInput(c.rate_cents)}"></label>
        <label class="f">Ab Alter (0 = alle)<input id="sMin" inputmode="numeric" value="${c.min_age}"></label><label class="f">Bis Alter (0 = ohne Grenze)<input id="sMax" inputmode="numeric" value="${c.max_age}"></label>
        <label class="f w2">Abrechnungsjahr<select id="sYear">${opt('kalender', 'Kalenderjahr (01.01.–31.12.)', c.year_mode)}${opt('beitrag', 'wie das Beitragsjahr der Mitgliederverwaltung', c.year_mode)}</select></label>
        <label class="f">Abrechnen ab Jahr<input id="sStart" inputmode="numeric" value="${c.start_year}"></label>
        <label class="f">Am Tablet runden auf (Minuten)<input id="sRound" inputmode="numeric" value="${c.round}"></label>
        <label class="f w2">Erinnerung an fehlende Stunden per E-Mail am (TT.MM., leer = aus)<input id="sRem" value="${esc(c.remind_date ? c.remind_date.split('-').reverse().join('.') : '')}" placeholder="z. B. 01.09."></label>
        <label class="f w2">Hinweis für Mitglieder (App und Tablet)<input id="sText" value="${esc(c.text)}" placeholder="z. B. Jedes Mitglied ab 12 Jahren leistet 4 Stunden im Jahr."></label></div>
      <div class="aw-grid" style="--c:2;margin-top:14px">
        <label class="chk"><input type="checkbox" id="sPool" ${c.pool_family ? 'checked' : ''}> Familien gemeinsam zählen (Abrechnung beim Hauptzahler)</label>
        <label class="chk"><input type="checkbox" id="sPass" ${c.exempt_passive ? 'checked' : ''}> Passive und Ehrenmitglieder sind befreit</label>
        <label class="chk"><input type="checkbox" id="sPro" ${c.prorate ? 'checked' : ''}> Bei Ein- oder Austritt im Jahr anteilig</label>
        <label class="chk"><input type="checkbox" id="sTab" ${c.tablet_auto ? 'checked' : ''}> Am Tablet gestempelte Stunden (mit PIN) gelten sofort als bestätigt</label>
        <label class="chk"><input type="checkbox" id="sApp" ${c.app_report ? 'checked' : ''}> Mitglieder dürfen Stunden in der App melden (Vorstand bestätigt)</label>
        <label class="chk"><input type="checkbox" id="sEvR" ${c.remind_events ? 'checked' : ''}> Helfer am Vortag per E-Mail erinnern</label></div>
      <p class="muted s">Je Beitragsart lässt sich in der Mitgliederverwaltung ein eigenes Soll festlegen (z. B. „Kinder: keine“, „Familie: je Person“). Einzelne Ausnahmen in der Übersicht über „Soll …“.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" id="sSave">Speichern</button></div></div>
      <div class="card" data-nodirty><h3>Befreite Mitglieder</h3><p class="muted s" style="margin-top:0">Befreite Mitglieder können wie alle Stunden leisten (sie werden erfasst), haben aber kein Soll – es wird nichts eingezogen. Optional befristet.</p>
        <div class="aw-grid" style="--c:4"><label class="f">Mitglied<select id="exM"><option value="">– Mitglied wählen –</option>${(st.meta.members || []).map(m => opt(m.id, GK.lastFirst(m.name))).join('')}</select></label>
          <label class="f">Grund<input id="exN" placeholder="z. B. Vorstand, Krankheit"></label><label class="f">befreit bis (leer = dauerhaft)<input id="exU" type="date"></label>
          <label class="f"><span>&nbsp;</span><button class="btn primary" id="exAdd">Befreien</button></label></div>
        <div id="exList" style="margin-top:12px"></div></div>
      <div id="sFunc"></div>`;
    GK.watch(el.querySelector('.card'));
    const exLoad = async () => {
      const l = await api('exempt');
      $('exList').innerHTML = l.length ? `<table class="tbl">${l.map(x => `<tr><td><b>${esc(GK.lastFirst(x.name))}</b></td><td>${esc(x.note || '')}</td><td class="nw">${x.until_date ? 'bis ' + deDate(x.until_date) : 'dauerhaft'}</td><td class="r"><button class="btn small" data-exd="${x.member_id}">Aufheben</button></td></tr>`).join('')}</table>` : '<p class="muted" style="margin:0">Niemand befreit.</p>';
      $('exList').querySelectorAll('[data-exd]').forEach(b => { b.onclick = async () => { try { await api('exempt/' + b.dataset.exd, 'DELETE'); toast('Befreiung aufgehoben.'); exLoad(); } catch (e) { fail(e); } }; });
    };
    $('exAdd').onclick = async () => { try { await api('exempt', 'PUT', { member_id: +val('exM'), note: val('exN'), until: val('exU') }); $('exM').value = ''; $('exN').value = ''; $('exU').value = ''; toast('Befreit.'); exLoad(); } catch (e) { fail(e); } };
    exLoad().catch(fail);
    if (GK.funcBox) GK.funcBox($('sFunc'), 'arbeitseinsatz', 'Arbeitseinsatz & Thekendienst', () => showSettings(el));
    $('sSave').onclick = async () => {
      const rm = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(val('sRem'));
      try {
        await api('settings', 'PUT', { default_minutes: toMin(val('sDef')), rate_cents: toCents(val('sRate') || '0'), min_age: +val('sMin') || 0, max_age: +val('sMax') || 0, year_mode: val('sYear'), round: +val('sRound') || 1, start_year: +val('sStart') || undefined,
          remind_date: rm ? `${rm[2].padStart(2, '0')}-${rm[1].padStart(2, '0')}` : '', pool_family: $('sPool').checked, exempt_passive: $('sPass').checked, prorate: $('sPro').checked, tablet_auto: $('sTab').checked, app_report: $('sApp').checked, remind_events: $('sEvR').checked, text: val('sText') });
        GK.clean(); toast('Gespeichert.'); st.meta = await api('meta');
      } catch (e) { fail(e); }
    };
  }

  void deTime;
  GK.registerPage({ key: 'arbeitseinsatz', title: 'Arbeitseinsatz', perm: 'arbeitseinsatz', render, icon: 'arbeit' });
})();
