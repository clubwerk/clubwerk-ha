'use strict';
/* Mängelmelder – Bereich „Mängel“ in der Mitglieder-App und das Meldeformular, das auch das Tablet benutzt (tablet.js lädt diese Datei).
   Ein Formular für beide Oberflächen: Ort, Beschreibung, bis zu 3 Fotos, „dringend“ – vorher der Blick auf offene Meldungen zum selben Ort.
   Fotos werden im Gerät verkleinert (längste Seite 1600 px, JPEG) – dabei fallen Ortsdaten (EXIF/GPS) weg. */
(() => {
  if (!document.getElementById('mgStyle')) {
    const s = document.createElement('style'); s.id = 'mgStyle';
    s.textContent = `
      .mg-ta { min-height: 104px; padding: 12px 14px; line-height: 1.4; resize: vertical; font: inherit; font-size: 16px; display: block; }
      .mg-phs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0 0 10px; }
      .mg-phs:empty { display: none; }
      .mg-ph { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: var(--hover); border: 1px solid var(--line); }
      .mg-ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .mg-ph button { position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; border-radius: 50%; border: 0; background: var(--card); color: var(--ink); font-size: 18px; line-height: 1; box-shadow: var(--shadow); }
      .mg-hit { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 12px; align-items: start; padding: 12px 0; border-top: 1px solid var(--line); }
      .mg-hit:first-of-type { border-top: 0; padding-top: 4px; }
      .mg-hit .mg-th { width: 64px; height: 64px; border-radius: 12px; overflow: hidden; background: var(--hover); display: flex; align-items: center; justify-content: center; color: var(--muted); }
      .mg-hit .mg-th img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .mg-hit strong { display: block; font-size: 15px; line-height: 1.35; color: var(--ink); overflow-wrap: anywhere; }
      .mg-hit small { display: block; font-size: 12.5px; color: var(--muted); margin: 3px 0 8px; line-height: 1.35; }
      .mg-hits { margin: 0 0 12px; }
      .mg-big { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0 0 14px; }
      .mg-big img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; display: block; background: var(--hover); }
      .mg-big img:only-child { grid-column: 1 / -1; aspect-ratio: 4 / 3; }
      .vh-box p.mg-desc { color: var(--ink); font-size: 15px; margin: 0 0 8px; }
      .vh-box p.mg-meta { font-size: 13px; margin: 0 0 12px; }
      .vh-bar.mg-ans { align-items: flex-start; padding: 10px 14px; font-weight: 500; line-height: 1.4; }
      .mg-txt { white-space: pre-line; overflow-wrap: anywhere; }
      .vh-rows .mg-row { cursor: pointer; }`;
    document.head.appendChild(s);
  }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const deD = s => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '');
  const STATUS = { neu: ['', 'neu'], arbeit: ['a', 'in Arbeit'], erledigt: ['g', 'erledigt'], abgelehnt: ['', 'abgelehnt'] };
  const chip = st => { const c = STATUS[st] || ['', st]; return `<span class="vh-chip ${c[0]}">${esc(c[1])}</span>`; };
  const OTHER = '__anders';
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const CAM = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>';

  /** Bild im Gerät verkleinern → data:image/jpeg (Ortsdaten fallen beim Neuzeichnen weg); limit = höchste Länge der data:-Adresse */
  function shrink(file, sizes, limit) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader(), img = new Image();   // als data:-Adresse lesen – blob:-Adressen erlaubt die Sicherheitsregel der App nicht
      fr.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
      fr.onload = () => { img.src = fr.result; };
      img.onerror = () => reject(new Error('Dieses Bildformat geht leider nicht – bitte ein JPEG oder PNG wählen.'));
      img.onload = () => {
        for (const max of sizes) {
          const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          for (let q = 0.82; q > 0.3; q -= 0.1) { const out = c.toDataURL('image/jpeg', q); if (out.length <= limit) return resolve(out); }
        }
        reject(new Error('Das Foto ist zu groß.'));
      };
      fr.readAsDataURL(file);
    });
  }

  /** Meldeformular in einem Blatt (.vh-sheet.vh-form).
   *  io: { places(), similar(body), create(body), photo(id, {data, thumb}), confirm(id), thumbSrc(photoId) → Attribut für <img> }
   *  o: { sheetId, toast(text, err), done(), keepAlive() } */
  function openForm(io, o) {
    let sh = document.getElementById(o.sheetId);
    if (!sh) { sh = document.createElement('div'); sh.id = o.sheetId; sh.className = 'vh-sheet vh-form'; document.body.appendChild(sh); }
    const close = () => sh.classList.remove('show');
    const st = { place: '', other: '', text: '', urgent: false, photos: [] };   // photos: [{ data, thumb }]
    const body = () => ({ place: st.place === OTHER ? st.other : st.place, other: st.place === OTHER, text: st.text, urgent: st.urgent });
    const poke = () => { if (o.keepAlive) o.keepAlive(); };
    sh.oninput = poke; sh.onpointerdown = poke;
    async function form(places) {
      sh.innerHTML = `<div class="vh-box"><h2>Mangel melden</h2><p>Was ist kaputt oder fehlt? Ein Foto hilft, es schnell zu finden.</p>
        <label for="mgPlace">Wo?</label><select class="vh-select" id="mgPlace"><option value="">Bitte wählen …</option>
          ${places.map(p => `<option value="${esc(p)}" translate="no" ${p === st.place ? 'selected' : ''}>${esc(p)}</option>`).join('')}<option value="${OTHER}" ${st.place === OTHER ? 'selected' : ''}>Anderer Ort …</option></select>
        <input class="vh-input" id="mgOther" maxlength="60" placeholder="Wo genau? z. B. Zaun hinter Platz 4" value="${esc(st.other)}" ${st.place === OTHER ? '' : 'hidden'}>
        <label for="mgText">Was ist los?</label><textarea class="vh-input mg-ta" id="mgText" maxlength="500" placeholder="z. B. Netz an Platz 3 ist gerissen">${esc(st.text)}</textarea>
        <label>Fotos (bis zu 3)</label><div class="mg-phs" id="mgPhs">${st.photos.map((p, i) => `<div class="mg-ph"><img src="${p.thumb}" alt=""><button type="button" data-x="${i}" aria-label="Foto entfernen">×</button></div>`).join('')}</div>
        ${st.photos.length < 3 ? `<label class="vh-pick">${st.photos.length ? 'Weiteres Foto aufnehmen oder wählen' : 'Foto aufnehmen oder wählen'}<input type="file" accept="image/*" id="mgFile"></label>` : ''}
        <label class="vh-check"><input type="checkbox" id="mgUrgent" ${st.urgent ? 'checked' : ''}><span><b>Dringend</b> – z. B. Wasserrohrbruch oder Verletzungsgefahr</span></label>
        <div class="vh-err" id="mgErr"></div>
        <div class="vh-row"><button class="no" id="mgNo" type="button">Abbrechen</button><button class="ok" id="mgOk" type="button">Weiter</button></div></div>`;
      const $ = id => sh.querySelector('#' + id), err = t => { $('mgErr').textContent = t || ''; };
      const keep = () => { st.place = $('mgPlace').value; st.other = $('mgOther').value; st.text = $('mgText').value; st.urgent = $('mgUrgent').checked; };
      $('mgPlace').onchange = () => { keep(); $('mgOther').hidden = st.place !== OTHER; if (st.place === OTHER) $('mgOther').focus(); };
      $('mgNo').onclick = close;
      sh.querySelectorAll('[data-x]').forEach(b => { b.onclick = () => { keep(); st.photos.splice(+b.dataset.x, 1); form(places); }; });
      if ($('mgFile')) $('mgFile').onchange = async e => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        keep(); poke(); err('Foto wird vorbereitet …');
        try { const [data, thumb] = await Promise.all([shrink(f, [1600, 1200], 500000), shrink(f, [320], 50000)]); st.photos.push({ data, thumb }); form(places); }
        catch (x) { err(x.message); }
      };
      $('mgOk').onclick = async () => {
        keep();
        if (!st.place) return err('Bitte wählen, wo das ist.');
        if (st.place === OTHER && st.other.trim().length < 2) return err('Bitte kurz eintragen, wo das ist.');
        if (st.text.trim().length < 3) return err('Bitte kurz beschreiben, was kaputt ist.');
        $('mgOk').disabled = true; err('');
        let list = [];
        try { list = (await io.similar(body())).list || []; } catch (x) { if (x.status === 401) { close(); o.toast(x.message, true); return; } }
        if (list.length) hits(list, places); else submit($('mgOk'), err);
      };
    }
    /** „Schon gemeldet?“ – offene Meldungen zum selben Ort, ohne Namen */
    function hits(list, places) {
      const where = st.place === OTHER ? st.other : st.place;
      sh.innerHTML = `<div class="vh-box"><h2>Schon gemeldet?</h2><p>Zu „<span translate="no">${esc(where)}</span>“ gibt es schon offene Meldungen. Ist es eine davon?</p>
        <div class="mg-hits">${list.map(h => `<div class="mg-hit"><span class="mg-th">${h.photo ? `<img ${io.thumbSrc(h.photo)} alt="">` : CAM}</span>
          <div><strong translate="no">${esc(h.text)}</strong><small>gemeldet am ${deD(h.created_at)}${h.also ? ` · noch ${h.also}× gemeldet` : ''} · ${chip(h.status)}</small>
          ${h.mine ? `<span class="vh-chip g">deine Meldung</span>` : h.confirmed ? `<span class="vh-chip g">schon bestätigt</span>` : `<button class="vh-btn sm" type="button" data-yes="${h.id}">Ja, das ist es</button>`}</div></div>`).join('')}</div>
        <div class="vh-err" id="mgErr"></div>
        <div class="vh-row"><button class="no" id="mgBack" type="button">Zurück</button><button class="ok" id="mgFresh" type="button">Nein, neu melden</button></div></div>`;
      const $ = id => sh.querySelector('#' + id), err = t => { $('mgErr').textContent = t || ''; };
      $('mgBack').onclick = () => form(places);
      $('mgFresh').onclick = () => submit($('mgFresh'), err);
      sh.querySelectorAll('[data-yes]').forEach(b => { b.onclick = async () => {
        b.disabled = true;
        try { await io.confirm(+b.dataset.yes); close(); o.toast('Danke! Bei der Meldung ist vermerkt, dass du es auch gesehen hast – du bekommst Bescheid, wenn sich etwas tut.'); o.done(); }
        catch (x) { err(x.message); b.disabled = false; }
      }; });
    }
    async function submit(btn, err) {
      btn.disabled = true;
      let id;
      try { id = (await io.create(body())).id; } catch (x) { err(x.message); btn.disabled = false; return; }
      let lost = 0;
      for (let i = 0; i < st.photos.length; i++) {
        err(`Foto ${i + 1} von ${st.photos.length} wird gesendet …`); poke();
        try { await io.photo(id, st.photos[i]); } catch (x) { lost++; }
      }
      close();
      o.toast(lost ? `Gemeldet – aber ${lost} von ${st.photos.length} Fotos kamen nicht an.` : 'Danke! Deine Meldung ist angekommen.', Boolean(lost));
      o.done();
    }
    sh.innerHTML = `<div class="vh-box"><h2>Mangel melden</h2><p>Lade …</p></div>`;
    sh.classList.add('show');
    io.places().then(r => form(r.places || [])).catch(x => { close(); o.toast(x.message, true); });
    return close;
  }
  window.MaengelForm = { open: openForm, shrink };

  /* ---------- Bereich in der Mitglieder-App ---------- */
  if (!window.VA) return;
  window.VA.registerSection({
    id: 'maengel',
    render(el, ctx) {
      const io = {
        places: () => ctx.api('orte'),
        similar: b => ctx.api('aehnlich', 'POST', b),
        create: b => ctx.api('melden', 'POST', b),
        photo: (id, p) => ctx.api(`meldung/${id}/foto`, 'POST', p),
        confirm: id => ctx.api(`meldung/${id}/auch`, 'POST', {}),
        thumbSrc: pid => `data-auth-src="api/m/maengel/foto/${pid}?t=1"`,
      };
      let closeForm = null;
      const detailSheet = () => { let sh = document.getElementById('mgDetail'); if (!sh) { sh = document.createElement('div'); sh.id = 'mgDetail'; sh.className = 'vh-sheet vh-form'; document.body.appendChild(sh); } return sh; };
      ctx.onLeave(() => { if (closeForm) closeForm(); const d = document.getElementById('mgDetail'); if (d) d.classList.remove('show'); });
      function detail(r) {
        const sh = detailSheet();
        sh.innerHTML = `<div class="vh-box"><h2 translate="no">${esc(r.place)}</h2><p>gemeldet am ${deD(r.created_at)}${r.own ? '' : ' · von dir bestätigt'} · ${chip(r.status)}</p>
          <p class="mg-txt mg-desc" translate="no">${esc(r.text)}</p>
          ${r.urgent || r.also ? `<p class="mg-meta">${[r.urgent ? 'dringend' : '', r.also ? `noch ${r.also}× gemeldet` : ''].filter(Boolean).join(' · ')}</p>` : ''}
          ${r.answer ? `<div class="vh-bar mg-ans"><span><b>Antwort des Vereins:</b> <span class="mg-txt" translate="no">${esc(r.answer)}</span></span></div>` : ''}
          ${r.photos.length ? `<div class="mg-big">${r.photos.map(p => `<img data-auth-src="api/m/maengel/foto/${p}" alt="">`).join('')}</div>` : ''}
          <div class="vh-row"><button class="ok" id="mgDx" type="button">Schließen</button></div></div>`;
        sh.querySelector('#mgDx').onclick = () => sh.classList.remove('show');
        sh.classList.add('show');
      }
      async function load() {
        let d; try { d = await ctx.api('meine'); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        el.innerHTML = `<div class="vh-card"><h3>Etwas kaputt?</h3><p class="vh-lead">Melde Defekte auf der Anlage – der Verein kümmert sich darum und gibt dir Bescheid.</p>
            <button class="vh-btn wide" id="mgNew" type="button">Mangel melden</button></div>
          <div class="vh-card"><h3>Meine Meldungen${d.list.length ? ` <small>${d.list.length}</small>` : ''}</h3>
            ${d.list.length ? `<div class="vh-rows">${d.list.map(r => `<div class="mg-row" data-r="${r.id}" role="button" tabindex="0"><span class="vh-date"><b>${r.created_at.slice(8, 10)}.${r.created_at.slice(5, 7)}.</b><span>${WD[new Date(r.created_at.slice(0, 10) + 'T12:00:00').getDay()]}</span></span>
              <span class="vh-tx"><strong translate="no">${esc(r.place)}</strong><small translate="no">${esc(r.text)}</small>${r.answer ? `<small><b>Antwort:</b> <span translate="no">${esc(r.answer)}</span></small>` : ''}</span>${chip(r.status)}</div>`).join('')}</div>`
              : `<p class="vh-none">Du hast noch nichts gemeldet.</p>`}</div>`;
        el.querySelector('#mgNew').onclick = () => { closeForm = openForm(io, { sheetId: 'mgSheet', toast: ctx.toast, done: load }); };
        el.querySelectorAll('[data-r]').forEach(row => { const open = () => detail(d.list.find(x => x.id === +row.dataset.r)); row.onclick = open; row.onkeydown = e => { if (e.key === 'Enter') open(); }; });
      }
      el.innerHTML = `<div class="vh-empty">Lade …</div>`;
      load();
    },
  });
})();
