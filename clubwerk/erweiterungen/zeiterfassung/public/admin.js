'use strict';
/* Verwaltungsseite der Erweiterung „Zeiterfassung“ – wird von der Verwaltung nachgeladen, sobald die Erweiterung aktiv ist. */
(() => {
  const GK = window.GK;
  const { $, esc, euro, deDate, deTime, centsToInput, toast, fail, dialog, closeDialog } = GK;
  const api = (url, method, body) => GK.api('x/zeiterfassung/' + url, method, body);

  /* =================== Zeiterfassung =================== */
  const zhm = min => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
  const zclock = ts => (ts ? ts.slice(11, 16) : '');
  const ZWD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const zday = ts => { const d = new Date(ts.replace(' ', 'T')); return `${ZWD[d.getDay()]} ${deDate(ts.slice(0, 10)).slice(0, 6)}`; };
  const toLocalInput = ts => (ts ? ts.slice(0, 16).replace(' ', 'T') : '');
  const fromLocalInput = v => (v ? v.replace('T', ' ') : '');
  const zstate = { month: null, staff: 0 };

  const G = { key: 'zeiterfassung', label: 'Zeiterfassung', icon: 'zeit', order: 4 };
  const again = () => renderStunden().catch(fail);

  /* =================== Reiter „Stunden“ =================== */
  async function renderStunden() {
    const r = await api('month' + (zstate.month ? '?month=' + zstate.month : ''));
    zstate.month = r.month;
    const sel = r.staff.find(x => x.id === zstate.staff) || null;
    if (!sel) zstate.staff = 0;
    const tot = { min: r.staff.reduce((a, x) => a + x.minutes, 0), rnd: r.staff.reduce((a, x) => a + x.rounded, 0), cnt: r.staff.reduce((a, x) => a + x.count, 0),
      amt: r.staff.reduce((a, x) => a + (x.amount_cents || 0), 0), anyRate: r.staff.some(x => x.rate_cents != null) };
    const q = `month=${r.month}${sel ? '&staff=' + sel.id : ''}`;
    const m = r.mail;
    const mailLine = m.error ? `<div class="banner r"><span>Letzter Versand des Monatsnachweises fehlgeschlagen: ${esc(m.error)}</span><a href="#zeit-einstellungen">Einstellungen →</a></div>` : '';
    const flagCell = e => [!e.end_at ? (e.forgotten ? '<span class="pill r">nicht ausgestempelt</span>' : '<span class="pill a">noch da</span>') : '',
      e.manual ? '<span class="pill b">nachgetragen</span>' : '', e.edited_at && !e.manual ? `<span class="pill">korrigiert von ${esc(e.edited_by)}${e.orig_start ? ` · vorher ${zclock(e.orig_start)}–${zclock(e.orig_end) || 'offen'}` : ''}</span>` : '',
      e.note ? `<span class="muted s">${esc(e.note)}</span>` : ''].filter(Boolean).join(' ');
    $('main').innerHTML = `<h2 class="page">Stunden</h2>
      <p class="lead">Personal stempelt am Tablet mit eigener PIN. Gespeichert werden die echten Zeiten, gerundet wird nur die <b>Monatssumme</b> je Person auf die Viertelstunde.</p>
      ${mailLine}
      <div class="row" style="margin-bottom:14px">
        <label class="f">Monat<select id="zMonth">${r.months.map(x => `<option value="${x}" ${x === r.month ? 'selected' : ''}>${new Date(+x.slice(0, 4), +x.slice(5, 7) - 1, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></label>
        <label class="f">Person<select id="zStaff"><option value="0">Alle</option>${r.staff.map(x => `<option value="${x.id}" ${sel && sel.id === x.id ? 'selected' : ''}>${esc(GK.lastFirst(x.name))}</option>`).join('')}</select></label>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l">Einsätze</div><div class="v">${sel ? sel.count : tot.cnt}</div></div>
        <div class="kpi"><div class="l">Genau</div><div class="v">${zhm(sel ? sel.minutes : tot.min)} Std.</div></div>
        <div class="kpi"><div class="l">Abgerechnet (gerundet)</div><div class="v">${zhm(sel ? sel.rounded : tot.rnd)} Std.</div></div>
        <div class="kpi"><div class="l">${sel ? (sel.rate_cents != null ? `Betrag (${euro(sel.rate_cents)}/Std.)` : 'Betrag') : 'Betrag'}</div><div class="v">${sel ? (sel.amount_cents != null ? euro(sel.amount_cents) : '–') : (tot.anyRate ? euro(tot.amt) : '–')}</div></div>
      </div>
      ${sel ? `<div class="card"><h3>${esc(GK.lastFirst(sel.name))}${sel.job ? ` <span class="muted s">· ${esc(sel.job)}</span>` : ''}</h3>
        ${sel.entries.length ? `<table class="tbl kompakt"><tr><th>Datum</th><th>Kommen</th><th>Gehen</th><th class="r">Dauer</th><th>Hinweis</th><th></th></tr>
          ${sel.entries.map(e => `<tr><td>${zday(e.start_at)}</td><td>${zclock(e.start_at)}</td><td>${e.end_at ? zclock(e.end_at) + (e.end_at.slice(0, 10) !== e.start_at.slice(0, 10) ? ' <span class="muted s">(+1)</span>' : '') : '–'}</td>
            <td class="r">${e.end_at ? zhm(e.minutes) : '–'}</td><td>${flagCell(e)}</td><td class="r"><button class="btn small" data-ze="${e.id}">Bearbeiten</button></td></tr>`).join('')}
          <tr class="sum"><td>Summe</td><td></td><td></td><td class="r">${zhm(sel.minutes)}</td><td>→ abgerechnet <b>${zhm(sel.rounded)} Std.</b>${sel.open ? ' <span class="muted s">(offene Einsätze nicht enthalten)</span>' : ''}</td><td></td></tr></table>`
          : '<p class="empty">Keine Einsätze in diesem Monat.</p>'}</div>`
        : `<div class="card"><h3>Alle Personen</h3>
        ${r.staff.length ? `<table class="tbl kompakt"><tr><th>Name</th><th>Tätigkeit</th><th class="r">Einsätze</th><th class="r">genau</th><th class="r">abgerechnet</th><th class="r">Satz</th><th class="r">Betrag</th><th></th></tr>
          ${r.staff.map(x => `<tr><td><b>${esc(GK.lastFirst(x.name))}</b>${x.active ? '' : ' <span class="pill">inaktiv</span>'}${x.forgotten ? ' <span class="pill r">nicht ausgestempelt</span>' : x.open ? ' <span class="pill a">gerade da</span>' : ''}</td><td>${esc(x.job || '')}</td>
            <td class="r">${x.count}</td><td class="r">${zhm(x.minutes)}</td><td class="r"><b>${zhm(x.rounded)}</b></td><td class="r">${x.rate_cents != null ? euro(x.rate_cents) : '–'}</td><td class="r">${x.amount_cents != null ? euro(x.amount_cents) : '–'}</td>
            <td class="r"><button class="btn small" data-zs="${x.id}">Einsätze</button></td></tr>`).join('')}
          <tr class="sum"><td>Summe</td><td></td><td class="r">${tot.cnt}</td><td class="r">${zhm(tot.min)}</td><td class="r">${zhm(tot.rnd)}</td><td></td><td class="r">${tot.anyRate ? euro(tot.amt) : '–'}</td><td></td></tr></table>`
          : '<p class="empty">Noch kein Personal angelegt – im Reiter „Personal“ mit „+ Person“ anlegen.</p>'}</div>`}`;
    GK.tabTools(`<button class="btn" id="zAdd">+ Einsatz nachtragen</button><a class="btn primary" href="api/admin/x/zeiterfassung/report.pdf?${q}" target="_blank" rel="noopener">Monatsnachweis (PDF)</a><a class="btn" href="api/admin/x/zeiterfassung/report.xlsx?month=${r.month}">Excel</a>`, $('zMonth'));

    $('zMonth').onchange = () => { zstate.month = $('zMonth').value; again(); };
    $('zStaff').onchange = () => { zstate.staff = Number($('zStaff').value); again(); };
    $('main').querySelectorAll('[data-zs]').forEach(b => b.onclick = () => { zstate.staff = Number(b.dataset.zs); again(); });
    $('main').querySelectorAll('[data-ze]').forEach(b => b.onclick = () => zEntryDialog(sel, sel.entries.find(e => e.id === Number(b.dataset.ze))));
    $('zAdd').onclick = () => zEntryDialog(sel, null, r.staff);
  }

  function zEntryDialog(sel, e, all) {
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    dialog(`<h2>${e ? 'Einsatz bearbeiten' : 'Einsatz nachtragen'}</h2>
      ${e ? `<p class="muted" style="margin-top:0">${esc(sel.name)} · gestempelt ${zday(e.orig_start || e.start_at)} ${zclock(e.orig_start || e.start_at)}–${zclock(e.orig_start ? e.orig_end : e.end_at) || 'offen'}</p>`
        : `<label class="f">Person<select id="zeS">${all.filter(x => x.active).map(x => `<option value="${x.id}" ${sel && sel.id === x.id ? 'selected' : ''}>${esc(GK.lastFirst(x.name))}</option>`).join('')}</select></label><br>`}
      <div class="row" style="flex-wrap:nowrap">
        <label class="f" style="flex:1">Kommen<input type="datetime-local" id="zeA" value="${e ? toLocalInput(e.start_at) : ''}" max="${now}"></label>
        <label class="f" style="flex:1">Gehen<input type="datetime-local" id="zeB" value="${e ? toLocalInput(e.end_at) : ''}" max="${now}"></label>
      </div><br>
      <label class="f">Begründung (steht im Nachweis)<input id="zeN" maxlength="120" value="${e ? esc(e.note || '') : ''}" placeholder="z. B. vergessen auszustempeln"></label>
      <div class="btns">${e ? '<button class="btn danger" id="zeDel" style="margin-right:auto">Löschen</button>' : ''}<button class="btn" id="zeX">Abbrechen</button><button class="btn primary" id="zeOk">Speichern</button></div>`);
    $('zeX').onclick = closeDialog;
    $('zeOk').onclick = () => GK.busy($('zeOk'), async () => {
      const body = { start: fromLocalInput($('zeA').value), end: fromLocalInput($('zeB').value), note: $('zeN').value };
      try {
        if (e) await api('entries/' + e.id, 'PUT', body);
        else { body.staffId = Number($('zeS').value); await api('entries', 'POST', body); zstate.staff = body.staffId; zstate.month = body.start.slice(0, 7); }
        closeDialog(); toast('Gespeichert.'); again();
      } catch (x) { fail(x); }
    });
    if ($('zeDel')) $('zeDel').onclick = async () => {
      if (!await GK.ask('Diesen Einsatz löschen?')) return;
      try { await api('entries/' + e.id, 'DELETE'); closeDialog(); toast('Gelöscht.'); again(); } catch (x) { fail(x); }
    };
  }

  /* =================== Reiter „Personal“ =================== */
  async function renderPersonal() {
    const list = await api('staff');
    const refresh = () => renderPersonal().catch(fail);
    $('main').innerHTML = `<h2 class="page">Personal</h2>
      <p class="lead">Der Stundensatz ist nur hier sichtbar. Eine Änderung gilt ab dem laufenden Monat, abgeschlossene Monate behalten ihren Satz.</p>
      <div id="zpBox">${list.length ? `<table class="tbl kompakt"><tr><th>Name</th><th>Tätigkeit</th><th>PIN</th><th class="r">Stundensatz</th><th>Status</th><th></th></tr>
        ${list.map(x => `<tr class="${x.active ? '' : 'off'}"><td class="k-1z"><b>${esc(GK.lastFirst(x.name))}</b></td><td>${esc(x.job || '')}</td><td>gesetzt</td>
          <td class="r">${x.rate_cents != null ? euro(x.rate_cents) : '–'}</td><td>${x.active ? 'aktiv' : '<span class="pill">inaktiv</span>'}</td><td class="r"><button class="btn small" data-zp="${x.id}">Bearbeiten</button></td></tr>`).join('')}</table>`
        : '<p class="empty">Noch niemand angelegt – oben auf „+ Person“.</p>'}</div>`;
    GK.tabTools('<button class="btn primary" id="zpNew">+ Person</button>', $('zpBox'));
    $('zpNew').onclick = () => zPersonDialog(null, refresh);
    $('main').querySelectorAll('[data-zp]').forEach(b => b.onclick = () => zPersonDialog(list.find(x => x.id === Number(b.dataset.zp)), refresh));
  }

  function zPersonDialog(p, refresh) {
    dialog(`<h2>${p ? esc(GK.lastFirst(p.name)) + ' bearbeiten' : 'Person anlegen'}</h2>
      <div class="row" style="flex-wrap:nowrap"><label class="f" style="flex:1">Name<input id="zpN" maxlength="60" value="${p ? esc(p.name) : ''}" placeholder="Vor- und Nachname"></label>
        <label class="f" style="flex:1">Tätigkeit<input id="zpJ" maxlength="40" value="${p ? esc(p.job || '') : ''}" placeholder="z. B. Reinigung, Hausmeister"></label></div><br>
      <div class="row" style="flex-wrap:nowrap"><label class="f" style="flex:1">${p ? 'Neue PIN (leer = unverändert)' : 'PIN (4–6 Ziffern)'}<input id="zpP" inputmode="numeric" maxlength="6" autocomplete="off"></label>
        <label class="f" style="flex:1">Stundensatz € (optional)<input id="zpR" inputmode="decimal" value="${p && p.rate_cents != null ? centsToInput(p.rate_cents) : ''}" placeholder="z. B. 14,00"></label></div>
      ${p && p.rates.length > 1 ? `<p class="muted s">Bisherige Sätze: ${p.rates.map(r => `ab ${r.from_month.split('-').reverse().join('/')}: ${r.cents != null ? euro(r.cents) : 'keiner'}`).join(' · ')}</p>` : ''}
      ${p ? `<br><label class="row" style="align-items:center;gap:8px"><input type="checkbox" id="zpA" ${p.active ? 'checked' : ''} style="width:20px;height:20px"> aktiv (erscheint am Tablet)</label>` : ''}
      <div class="btns"><button class="btn" id="zpX">Abbrechen</button><button class="btn primary" id="zpOk">Speichern</button></div>`);
    $('zpX').onclick = closeDialog;
    $('zpOk').onclick = () => GK.busy($('zpOk'), async () => {
      const body = { name: $('zpN').value, job: $('zpJ').value, rate: $('zpR').value };
      if ($('zpP').value) body.pin = $('zpP').value;
      try {
        if (p) { body.active = $('zpA').checked; await api('staff/' + p.id, 'PUT', body); }
        else { body.pin = $('zpP').value; await api('staff', 'POST', body); }
        closeDialog(); toast('Gespeichert.'); refresh();
      } catch (e) { fail(e); }
    });
  }

  /* =================== Reiter „Einstellungen“ =================== */
  async function renderEinstellungen() {
    const r = await api('month'), m = r.mail;
    const prevName = (() => { const [y, mo] = m.prev.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' }); })();
    const mailLine = !m.ready ? `<div class="banner a"><span>Noch kein Postfach für den Versand eingerichtet (${GK.can('einstellungen') ? '<a href="#einstellungen" data-gomail style="margin:0">Einstellungen → Postfach</a>' : 'bitte einen Admin mit Recht „Einstellungen“ bitten: Einstellungen → Postfach'}).</span></div>`
      : m.error ? `<div class="banner r">Letzter Versand fehlgeschlagen: ${esc(m.error)}</div>`
        : m.sentMonth ? `<div class="banner g">Monatsnachweis ${esc(m.sentMonth.split('-').reverse().join('/'))} verschickt am ${deTime(m.sentAt)} Uhr an ${esc(m.to)}.</div>` : '';
    $('main').innerHTML = `<h2 class="page">Einstellungen</h2>
      <p class="lead">Am <b>1.&nbsp;jedes Monats</b> geht der Nachweis des Vormonats per E-Mail an die Kassiererin.</p>
      ${mailLine}
      <div class="card" data-set="mail"><h3>Monatsnachweis per E-Mail</h3>
        <div class="row">
          <label class="f" style="flex:1;min-width:260px">Empfänger (Kassiererin; mehrere mit Komma)<input id="zTo" value="${esc(m.to)}" placeholder="kasse@beispiel.de" autocomplete="email"></label>
          <button class="btn primary" id="zToSave">Speichern</button>
          <button class="btn" id="zTest" ${m.ready ? '' : 'disabled'}>Testmail senden</button>
          <button class="btn" id="zSend" ${m.ready ? '' : 'disabled'}>${esc(prevName)} jetzt senden</button>
        </div>
        <p class="muted s" style="margin-bottom:0">Versand automatisch am 1. ab 6 Uhr (war Home Assistant aus, sobald es wieder läuft). Im Anhang: PDF mit Übersicht und je Person einer Seite zum Unterschreiben sowie eine Excel-Datei. Versand über das Vereinspostfach (Einstellungen → Postfach)${m.ready ? ', Absender ' + esc(m.from) : ' – noch nicht eingerichtet'}.</p></div>
      <div id="zFunc" data-set="transfer"></div>`;
    if (GK.funcBox) GK.funcBox($('zFunc'), 'zeiterfassung', 'Zeiterfassung', () => renderEinstellungen().catch(fail));
    const gm = $('main').querySelector('[data-gomail]'); if (gm) gm.onclick = e => { e.preventDefault(); GK.go('einstellungen'); };
    $('zToSave').onclick = async () => { try { await api('mail', 'PUT', { to: $('zTo').value }); toast('Empfänger gespeichert.'); } catch (e) { fail(e); } };
    $('zTest').onclick = async () => { try { await api('mail', 'PUT', { to: $('zTo').value }); await api('mail/test', 'POST', {}); toast('Testmail verschickt.'); } catch (e) { fail(e); } };
    $('zSend').onclick = async () => {
      if (!await GK.ask(`Monatsnachweis ${prevName} jetzt an ${$('zTo').value || '(kein Empfänger)'} senden?`)) return;
      try { await api('mail', 'PUT', { to: $('zTo').value }); await api('mail/send', 'POST', { month: m.prev }); toast('Monatsnachweis verschickt.'); } catch (e) { fail(e); }
      renderEinstellungen().catch(fail);
    };
  }

  GK.registerPage({ key: 'zeit', title: 'Stunden', perm: 'zeiterfassung', render: renderStunden, group: G });
  GK.registerPage({ key: 'zeit-personal', title: 'Personal', perm: 'zeiterfassung', render: renderPersonal, group: G });
  GK.registerPage({ key: 'zeit-einstellungen', title: 'Einstellungen', perm: 'zeiterfassung', render: renderEinstellungen, group: G });
  // Suche (Strg/⌘ K): Reiter, Aktionen und Einstellungen der Zeiterfassung
  if (GK.registerSearch) GK.registerSearch([
    { label: 'Personal verwalten (PIN, Stundensatz)', page: 'zeit-personal', btn: '+ Person', kind: 'aktion', words: 'Mitarbeiter Personal PIN Stundensatz Reinigung Hausmeister Person anlegen' },
    { label: 'Einsatz nachtragen (Zeiterfassung)', page: 'zeit', btn: '+ Einsatz nachtragen', kind: 'aktion', words: 'Stunden nachtragen vergessen' },
    { label: 'Monatsnachweis (PDF)', page: 'zeit', btn: 'Monatsnachweis', kind: 'aktion', words: 'Stunden Nachweis Abrechnung' },
    { label: 'Stunden als Excel', page: 'zeit', btn: 'Excel', kind: 'aktion', words: 'Stunden Export Tabelle' },
    { label: 'Monatsnachweis per E-Mail', page: 'zeit-einstellungen', card: 'Monatsnachweis per E-Mail', words: 'Empfänger Kassierer E-Mail Testmail' },
  ]);
})();
