'use strict';
/* Verwaltungsseite „Mängelmelder“: Reiter Offen · Erledigt · Einstellungen */
(() => {
  const GK = window.GK;
  const { $, esc, toast, fail } = GK;
  const api = (url, method, body) => GK.api('x/maengel/' + url, method, body);
  const PILL = { neu: 'b', arbeit: 'a', erledigt: 'g', abgelehnt: '' };
  const CAM = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  const EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const SORTS = [['neu', 'Neueste zuerst'], ['dringend', 'Dringende zuerst'], ['auch', 'Am häufigsten gemeldet']];
  const st = { meta: null, sort: sessionStorage.getItem('mg_sort') || 'neu', tabs: null };
  const dt = s => (s ? `${GK.deDate(s.slice(0, 10))}, ${s.slice(11, 16)} Uhr` : '');

  if (!document.getElementById('mgAdminStyle')) {
    const s = document.createElement('style'); s.id = 'mgAdminStyle';
    s.textContent = `
      .mg-th { width: 48px; height: 48px; border-radius: 10px; overflow: hidden; background: var(--hover); color: var(--muted); display: inline-flex; align-items: center; justify-content: center; flex: none; vertical-align: middle; }
      .mg-th img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .mg-what { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .mg-what > div { min-width: 0; }
      .mg-what .muted { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
      .mg-photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin: 0 0 16px; }
      .mg-photos a { display: block; border-radius: 12px; overflow: hidden; background: var(--hover); aspect-ratio: 4 / 3; }
      .mg-photos img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .mg-text { white-space: pre-line; overflow-wrap: anywhere; margin: 0 0 16px; }
      .mg-big img { width: 100%; max-height: 70vh; object-fit: contain; border-radius: 12px; display: block; background: var(--hover); }
      .mg-pl { flex-wrap: nowrap; align-items: center; } .mg-pl > label.f { flex: 1 1 auto; } .mg-pl .acts { display: flex; gap: 6px; flex: none; }
      @media (max-width: 640px) { .mg-pl { flex-wrap: wrap; } .mg-pl .acts { margin-left: auto; } .mg-pl + .mg-pl { margin-top: 18px !important; } }
      @media (max-width: 700px) { .tbl td.mg-tdw { display: block; text-align: left; } .tbl td.mg-tdw::before { content: none; } }`;
    document.head.appendChild(s);
  }

  async function meta() { st.meta = await api('meta'); return st.meta; }

  function rowsHtml(list, done) {
    const sorted = [...list];
    if (!done && st.sort === 'dringend') sorted.sort((a, b) => (b.urgent - a.urgent) || b.created_at.localeCompare(a.created_at));
    if (!done && st.sort === 'auch') sorted.sort((a, b) => (b.also - a.also) || b.created_at.localeCompare(a.created_at));
    return `<table class="tbl sel"><tr><th>Meldung</th><th>Gemeldet</th><th class="r">Auch gemeldet</th><th>Status</th><th class="hide-md">Zuständig</th><th></th></tr>
      ${sorted.map(r => `<tr data-sel="${r.id}">
        <td class="mg-tdw"><div class="mg-what"><span class="mg-th">${r.photo ? `<img src="api/admin/x/maengel/foto/${r.photo}?t=1" alt="" loading="lazy">` : CAM}</span>
          <div><b translate="no">${esc(r.place)}</b>${r.urgent ? ' <span class="pill r">dringend</span>' : ''}<div class="muted s" translate="no">${esc(r.text)}</div></div></div></td>
        <td data-label="Gemeldet"><span class="tcell"><span class="nw">${esc(dt(r.created_at))}</span><div class="muted s" translate="no">${esc(r.reporter || 'gelöschtes Konto')}${r.source === 'tablet' ? ' · Tablet' : ''}</div></span></td>
        <td class="r" data-label="Auch gemeldet">${r.also ? `<span class="pill a">+${r.also}</span>` : '–'}</td>
        <td data-label="Status"><span class="pill ${PILL[r.status]}">${esc(st.meta.status[r.status])}</span>${done && r.done_at ? `<div class="muted s">${esc(GK.deDate(r.done_at.slice(0, 10)))}</div>` : ''}</td>
        <td class="hide-md" data-label="Zuständig" translate="no">${esc(r.assignee || '–')}</td>
        <td class="r"><span class="acts"><button class="btn ico" data-ed="${r.id}" title="Bearbeiten" aria-label="Bearbeiten">${EDIT}</button></span></td></tr>`).join('')}</table>`;
  }

  async function showList(el, done) {
    const d = await api('liste?ansicht=' + (done ? 'erledigt' : 'offen'));
    const tools = done ? '' : `<div class="toolbar"><label class="f" style="flex:0 1 260px">Sortieren<select id="mgSort">${SORTS.map(([k, l]) => `<option value="${k}" ${k === st.sort ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>`;
    el.innerHTML = `${tools}${done ? `<p class="muted s" style="margin:0 0 12px">Erledigte und abgelehnte Meldungen werden ${d.keep_months} Monate nach dem Abschluss mit ihren Fotos gelöscht (Einstellungen).</p>` : ''}
      <div class="card">${d.list.length ? rowsHtml(d.list, done) : `<p class="empty">${done ? 'Noch keine erledigten Meldungen.' : 'Keine offenen Meldungen – Mitglieder melden in der Mitglieder-App unter „Mängel“ oder am Tablet.'}</p>`}</div>`;
    if ($('mgSort')) $('mgSort').onchange = () => { st.sort = $('mgSort').value; sessionStorage.setItem('mg_sort', st.sort); showList(el, done); };
    el.querySelectorAll('[data-sel]').forEach(tr => { tr.onclick = () => edit(+tr.dataset.sel); });
  }

  async function edit(id) {
    let r; try { r = await api('meldung/' + id); } catch (e) { return fail(e); }
    const m = st.meta;
    GK.dialog(`<h2 translate="no">${esc(r.place)}${r.urgent ? ' <span class="pill r">dringend</span>' : ''}</h2>
      <p class="muted" style="margin-top:-4px">Gemeldet ${esc(dt(r.created_at))} von <span translate="no">${esc(r.reporter || 'gelöschtem Konto')}</span>${r.source === 'tablet' ? ' am Tablet' : ''}${r.alsoNames.length ? ` · auch gemeldet von <span translate="no">${esc(r.alsoNames.join('; '))}</span>` : ''}</p>
      ${r.photos.length ? `<div class="mg-photos">${r.photos.map(p => `<a href="#" data-big="${p}" aria-label="Foto groß anzeigen"><img src="api/admin/x/maengel/foto/${p}" alt=""></a>`).join('')}</div>` : ''}
      <p class="mg-text" translate="no">${esc(r.text)}</p>
      <div class="row">
        <label class="f" style="flex:1 1 200px">Status<select id="mgSt">${Object.entries(m.status).map(([k, l]) => `<option value="${k}" ${k === r.status ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="f" style="flex:1 1 200px">Zuständig<select id="mgAs"><option value="">– niemand –</option>${m.handlers.map(u => `<option value="${u.id}" ${u.id === r.assignee ? 'selected' : ''} translate="no">${esc(u.name)}</option>`).join('')}</select></label>
      </div>
      <label class="f" style="margin-top:12px">Antwort an den Melder (erscheint in der Mitglieder-App)<textarea id="mgAn" maxlength="500" placeholder="z. B. Danke! Das Netz wird am Samstag getauscht.">${esc(r.answer || '')}</textarea></label>
      <label class="f" style="margin-top:12px">Interne Notiz (sehen nur Benutzer mit diesem Recht)<textarea id="mgNo" maxlength="1000">${esc(r.note || '')}</textarea></label>
      <div class="btns"><button class="btn danger" id="mgDel" style="margin-right:auto">Löschen</button><button class="btn ghost" id="mgX">Abbrechen</button><button class="btn primary" id="mgOk">Speichern</button></div>`, true);
    $('dialog').querySelectorAll('[data-big]').forEach(a => { a.onclick = e => { e.preventDefault(); big(+a.dataset.big, id); }; });
    $('mgX').onclick = GK.closeDialog;
    $('mgDel').onclick = async () => {
      if (!await GK.ask(`Meldung „${r.place}“ löschen?\n\nDie Meldung und ihre Fotos sind danach weg. Für erledigte Meldungen besser den Status setzen – sie werden nach der Frist von selbst gelöscht.`)) return;
      try { await api('meldung/' + id, 'DELETE'); GK.closeDialog(); toast('Gelöscht.'); reload(); } catch (e) { fail(e); }
    };
    $('mgOk').onclick = () => GK.busy($('mgOk'), async () => {
      try { await api('meldung/' + id, 'PUT', { status: $('mgSt').value, assignee: $('mgAs').value ? +$('mgAs').value : null, answer: $('mgAn').value, note: $('mgNo').value }); GK.closeDialog(); toast('Gespeichert.'); reload(); }
      catch (e) { fail(e); }
    });
  }
  /** Foto groß im Fenster, „Zurück“ führt zur Meldung */
  function big(pid, id) {
    GK.dialog(`<h2>Foto</h2><div class="mg-big"><img src="api/admin/x/maengel/foto/${pid}" alt=""></div><div class="btns"><button class="btn primary" id="mgBack">Zurück zur Meldung</button></div>`, true);
    $('mgBack').onclick = () => edit(id);
  }
  function reload() { meta().then(() => { if (st.tabs) st.tabs.reload(); refreshTabLabel(); }).catch(() => {}); }
  function refreshTabLabel() { const b = document.querySelector('#mgTabs [data-tab="offen"]'); if (b && st.meta) b.textContent = `Offen${st.meta.counts.offen ? ` (${st.meta.counts.offen})` : ''}`; }

  function showSettings(el) {
    const c = st.meta.cfg, places = [...st.meta.places];
    el.innerHTML = `<div class="card"><h3>Orte</h3>
        <p class="muted s" style="margin-top:0">Aus dieser Liste wählen Mitglieder beim Melden.${st.meta.bookingPlaces ? ' Die Plätze und Geräte aus dem Buchungssystem stehen automatisch davor.' : ''} „Anderer Ort“ mit eigenem Text ist immer dabei.</p>
        <div id="mgPl"></div>
        <div class="btns"><button class="btn ghost" id="mgPlAdd">+ Ort hinzufügen</button></div></div>
      <div class="card"><h3>Benachrichtigung</h3>
        <p class="muted s" style="margin-top:0">Bei neuen Meldungen bekommen alle Benutzer mit dem Recht „Mängelmelder“ eine Push-Nachricht, wenn ihr Benutzer mit einem Mitglied verknüpft ist (Benutzer &amp; Rechte) und das Mitglied Benachrichtigungen in der App eingeschaltet hat.</p>
        <label class="chk"><input type="checkbox" id="mgMail" ${c.mail_on ? 'checked' : ''}> Zusätzlich per E-Mail (an die Adresse des verknüpften Mitglieds)</label>
        <label class="f" style="margin-top:12px">Weitere E-Mail-Empfänger (mehrere mit Komma)<input id="mgNotify" value="${esc(c.notify)}" placeholder="z. B. platzwart@dein-verein.de"></label></div>
      <div class="card"><h3>Aufbewahrung</h3>
        <div class="row" style="align-items:flex-end"><label class="f" style="flex:0 1 220px">Erledigte Meldungen löschen nach<input id="mgKeep" inputmode="numeric" value="${c.keep_months}"></label><span class="muted s" style="padding-bottom:12px">Monaten – mit allen Fotos. Gilt auch für abgelehnte Meldungen.</span></div></div>
      <div class="btns"><button class="btn primary" id="mgSave">Speichern</button></div>`;
    const drawPlaces = () => {
      $('mgPl').innerHTML = places.length ? places.map((p, i) => `<div class="row mg-pl" style="margin-top:${i ? 10 : 0}px"><label class="f"><input data-pn="${i}" maxlength="60" value="${esc(p)}" placeholder="z. B. Clubhaus Damen-WC" aria-label="Ort"></label>
        <span class="acts"><button class="btn ico" data-pu="${i}" ${i ? '' : 'disabled'} title="nach oben" aria-label="nach oben">↑</button><button class="btn ico" data-pd="${i}" ${i < places.length - 1 ? '' : 'disabled'} title="nach unten" aria-label="nach unten">↓</button><button class="btn ghost" data-px="${i}">Entfernen</button></span></div>`).join('')
        : '<p class="empty">Noch keine eigenen Orte – z. B. „Clubhaus“, „Parkplatz“, „Damen-WC“.</p>';
      $('mgPl').querySelectorAll('[data-pn]').forEach(x => { x.oninput = () => { places[+x.dataset.pn] = x.value; }; });
      const mv = (attr, fn) => $('mgPl').querySelectorAll(`[data-${attr}]`).forEach(b => { b.onclick = () => { fn(+b.dataset[attr]); drawPlaces(); }; });
      mv('pu', i => { [places[i - 1], places[i]] = [places[i], places[i - 1]]; });
      mv('pd', i => { [places[i + 1], places[i]] = [places[i], places[i + 1]]; });
      mv('px', i => { places.splice(i, 1); });
    };
    drawPlaces(); GK.watch(el);
    $('mgPlAdd').onclick = () => { places.push(''); drawPlaces(); const ins = $('mgPl').querySelectorAll('[data-pn]'); ins[ins.length - 1].focus(); };
    $('mgSave').onclick = () => GK.busy($('mgSave'), async () => {
      try { const r = await api('einstellungen', 'PUT', { places: places.filter(p => p.trim()), mail_on: $('mgMail').checked, notify: $('mgNotify').value, keep_months: $('mgKeep').value });
        st.meta.cfg = r.cfg; st.meta.places = r.places; GK.clean(); toast('Gespeichert.'); showSettings(el); }
      catch (e) { fail(e); }
    });
  }

  async function render() {
    await meta();
    $('main').innerHTML = `<h2 class="page">Mängelmelder</h2>
      <p class="lead">Mitglieder melden Defekte in der Mitglieder-App oder am Tablet. Hier Status setzen, dem Melder antworten und Zuständige eintragen – der Melder bekommt dann Bescheid.</p><div id="mgTabs"></div>`;
    st.tabs = GK.tabs($('mgTabs'), 'maengel', [['offen', `Offen${st.meta.counts.offen ? ` (${st.meta.counts.offen})` : ''}`], ['erledigt', 'Erledigt'], ['einstellungen', 'Einstellungen']], async (k, el) => {
      if (k === 'einstellungen') return showSettings(el);
      return showList(el, k === 'erledigt');
    });
  }
  GK.registerPage({ key: 'maengel', title: 'Mängelmelder', perm: 'maengel', render, icon: 'maengel', order: 9 });
})();
