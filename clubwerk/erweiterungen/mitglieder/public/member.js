'use strict';
/* Bereich „Meine Daten“ in der Mitglieder-App: Mitgliedschaft, Beiträge, Zahlungen, Kontaktdaten, Namensänderung, Bankverbindung, Kündigung – und der Reiter „Ausweis“ */
(() => {
  const VQ = (document.currentScript && new URL(document.currentScript.src).search) || '';   // ?v=… wie dieses Skript
  /* app/ausweis.js lädt erst hier (nicht beim Start der App); ohne Netz die Fassung ohne ?v= aus dem Speicher des Service Workers (sw.js) */
  const awScript = src => new Promise(res => { const sc = document.createElement('script'); sc.src = src; sc.onload = () => res(true); sc.onerror = () => { sc.remove(); res(false); }; document.body.appendChild(sc); });
  const awReady = async () => window.CWAusweis || ((await awScript('ausweis.js' + VQ)) || (VQ && await awScript('ausweis.js')), window.CWAusweis || null);
  if (!document.getElementById('mdStyle')) {
    const s = document.createElement('style'); s.id = 'mdStyle';
    s.textContent = `
      .md-head { display: flex; align-items: center; gap: 14px; }
      .md-av { width: 52px; height: 52px; border-radius: 16px; background: var(--brand-soft); color: var(--brand-ink); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; flex: none; }
      .md-head b { display: block; font-size: 18px; } .md-head span { color: var(--muted); font-size: 13.5px; }
      .vh-rows .md-r { text-align: right; white-space: normal; }`;
    document.head.appendChild(s);
  }
  const { euro, deD } = VA;
  const ST = { offen: ['a', 'offen'], eingezogen: ['', 'wird abgebucht'], bezahlt: ['g', 'bezahlt'] };

  window.VA.registerSection({
    id: 'mitglieder',
    render(el, ctx) {
      const { esc } = ctx;
      let d = null;
      let focus = ctx.focus || '';   // aus „Für mich“: „kontakt“ bzw. „bank“ öffnet gleich das passende Blatt (nur beim ersten Laden)
      const { open: sheetEl, close: closeSheet } = VA.sheet('mdSheet');
      const sheet = (html) => {
        const sh = sheetEl();
        sh.innerHTML = `<div class="vh-box">${html}</div>`; sh.classList.add('show');
        return sh;
      };
      /* Reiter „Ausweis“ (Mitgliedsausweis, app/ausweis.js): nur, wenn der Verein ihn anbietet – oder wenn ein gespeicherter da ist und der
         Verein gerade nicht antwortet (Tresor nach einem Neustart gesperrt, kein Netz) */
      let tab = focus === 'ausweis' ? 'ausweis' : 'daten', stored = null, stopClock = () => {}, stopCheck = () => {};
      let AW = window.CWAusweis || null;
      ctx.onLeave(() => { closeSheet(); stopClock(); stopCheck(); });
      /* Reiter: Mitgliedschaft · Ausweis · Prüfen (nur mit dem Schalter „Ausweise prüfen“ aus der Verwaltung) */
      const segHtml = check => `<div class="vh-seg" role="tablist">${[['daten', 'Mitgliedschaft'], ['ausweis', 'Ausweis'], ...(check ? [['pruefen', 'Prüfen']] : [])].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>`;
      const wireSeg = () => el.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { if (tab === b.dataset.tab) return; tab = b.dataset.tab; stopClock(); stopCheck(); load(); }; });

      async function load() {
        let err = null;
        try { d = await ctx.api('me'); } catch (e) { d = null; err = e; }
        if (!AW && (!d || d.ausweis)) AW = await awReady();
        if (err && err.device && AW) await AW.clear();   // Handy gesperrt: gespeicherten Ausweis löschen
        stored = AW ? await AW.load() : null;
        const withCard = AW && ((d && d.ausweis) || (!d && stored));
        if (!withCard && stored) AW.clear();   // Verein bietet keinen Ausweis mehr an
        const check = Boolean(d && d.ausweisPruefen);
        if (tab === 'pruefen' && withCard && check) { el.innerHTML = segHtml(check) + '<div id="mdAwp"><div class="vh-empty">Lade …</div></div>'; wireSeg(); checkView(); return; }
        if (tab === 'pruefen') tab = 'ausweis';
        if (withCard && tab === 'ausweis') { el.innerHTML = segHtml(check) + '<div id="mdAw"><div class="vh-empty">Lade …</div></div>'; wireSeg(); showCard(d ? '' : err.status === 423 ? 'Dein Ausweis wird erneuert, sobald sich der Vorstand in der Verwaltung angemeldet hat.' : err.message); return; }
        if (!d) { el.innerHTML = (withCard ? segHtml(false) : '') + `<div class="vh-empty">${esc(err.message)}</div>`; wireSeg(); return; }
        if (d.none) { el.innerHTML = '<div class="vh-empty">Für dich sind noch keine Mitgliedsdaten hinterlegt.</div>'; return; }
        const p = d.person;
        // Name und Initialen: aus Vor-/Nachname, sonst aus dem Kontonamen („Muster, Max“) – nie eine leere Karte
        const full = [p.first_name, p.last_name].filter(Boolean).join(' ') || String(ctx.member || '').split(',').map(x => x.trim()).reverse().join(' ');
        const ini = full.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
        const open = d.charges.filter(c => c.status === 'offen' || c.status === 'eingezogen');
        const V = (d.perms && d.perms.view) || {}, E = (d.perms && d.perms.edit) || {};
        const nameOk = E.name !== false && !d.pending.some(x => x.kind === 'name');   // Namensänderung melden (Hochzeit, Scheidung) – nicht, solange eine offen ist
        const showFees = V.beitraege !== false || d.departments.length || d.family.length > 1 || (d.familyMembership && d.familyMembership.length > 1);
        el.innerHTML = `${withCard ? segHtml(check) : ''}
          ${d.pending.length ? `<div class="vh-bar a">Beim Vorstand in Bearbeitung: ${d.pending.map(x => esc(x.label)).join(', ')}</div>` : ''}
          ${p.exit_date ? `<div class="vh-bar a">Deine Mitgliedschaft endet zum ${deD(p.exit_date)}.</div>` : ''}
          <div class="vh-card"><div class="md-head"><span class="md-av">${esc(ini)}</span><div style="min-width:0"><b>${esc(full)}</b><span>${p.member_no ? `Mitgliedsnummer ${esc(p.member_no)} · ` : ''}${esc(T(p.status || 'Mitglied'))}${p.entry_date ? esc(' ' + T('seit {0}', [deD(p.entry_date)])) : ''}</span></div></div></div>
          ${showFees ? `<div class="vh-card"><h3>Mitgliedschaft</h3><div class="vh-rows">
            ${V.beitraege === false ? '' : d.fees.map(f => `<div><span><span translate="no">${esc(f.name)}</span>${f.dept ? `<small>Zusatzbeitrag Abteilung <span translate="no">${esc(f.dept)}</span></small>` : ''}${f.who ? `<small>für ${esc(f.who)}</small>` : ''}${f.booked_until ? `<small>abgerechnet bis ${deD(f.booked_until)}</small>` : ''}</span><b>${euro(f.cents)} <small style="display:inline">${esc(f.interval)}</small></b></div>`).join('')
              || `<div><span>${d.familyHeadName ? `Dein Beitrag ist im Familienbeitrag von ${esc(d.familyHeadName)} enthalten.` : d.payerName ? `Dein Beitrag läuft über ${esc(d.payerName)}.` : 'Kein Beitrag hinterlegt.'}</span></div>`}
            ${d.departments.length ? `<div><span>Abteilungen</span><b translate="no" class="md-r">${d.departments.map(x => esc(x.name)).join(', ')}</b></div>` : ''}
            ${d.familyMembership && d.familyMembership.length > 1 ? `<div><span>Familienmitgliedschaft</span><b class="md-r">${d.familyMembership.map(f => esc(f.name) + (f.role === 'oberhaupt' ? ' (Oberhaupt)' : '')).join(', ')}</b></div>` : ''}
            ${d.family.length > 1 ? `<div><span>${d.familyMembership && d.familyMembership.length > 1 ? 'Zahler' : 'Familie'}</span><b class="md-r">${d.family.map(f => esc(f.name) + (f.head ? ' (zahlt)' : '')).join(', ')}</b></div>` : ''}
          </div></div>` : ''}
          ${d.isHead && V.posten !== false ? `<div class="vh-card"><h3>Zahlungen${d.open_cents ? `<span class="vh-chip a">offen ${euro(d.open_cents)}</span>` : ''}</h3><div class="vh-rows">
            ${d.charges.slice(0, 12).map(c => `<div><span><span translate="no">${esc(c.text)}</span><small>${c.status === 'eingezogen' && c.collection_date ? `Lastschrift am ${deD(c.collection_date)}` : c.status === 'bezahlt' ? `bezahlt ${deD(c.paid_at)}` : `fällig ${deD(c.due_date)}`}<span class="vh-chip ${(ST[c.status] || [''])[0]}">${esc((ST[c.status] || ['', c.status])[1])}</span></small></span><b>${euro(c.cents)}</b></div>`).join('') || '<p class="vh-none">Noch keine Zahlungen.</p>'}
          </div>${d.transfer ? '<button class="vh-btn sec wide" id="mdPay" style="margin-top:12px">Überweisen</button>' : ''}</div>` : ''}
          ${V.anschrift !== false || V.kontakt !== false || V.geburt !== false || nameOk ? `<div class="vh-card"><h3>Kontakt ${E.anschrift || E.kontakt ? '<button id="mdEdit">Ändern</button>' : ''}</h3><dl class="vh-kv">
            ${V.anschrift !== false ? `<dt>Anschrift</dt><dd>${esc(p.street || '–')}<br>${esc([p.zip, p.city].filter(Boolean).join(' '))}</dd>` : ''}
            ${V.kontakt !== false ? `<dt>E-Mail</dt><dd>${esc(p.email || '–')}</dd><dt>Handy</dt><dd>${esc(p.mobile || p.phone || '–')}</dd>` : ''}
            ${V.geburt !== false && p.birth_date ? `<dt>Geburtsdatum</dt><dd>${deD(p.birth_date)}</dd>` : ''}</dl>${nameOk ? '<button class="vh-btn sec wide" id="mdName" style="margin-top:12px">Mein Name hat sich geändert</button>' : ''}</div>` : ''}
          ${d.isHead && V.bank !== false ? `<div class="vh-card"><h3>Bankverbindung ${E.bank ? '<button id="mdBank">Neue Bankverbindung</button>' : ''}</h3>${d.bank ? `<dl class="vh-kv"><dt>Konto</dt><dd>${esc(d.bank.iban)}</dd><dt>Inhaber/in</dt><dd>${esc(d.bank.holder || '–')}</dd>
            <dt>Mandatsreferenz</dt><dd>${esc(d.bank.mandate_ref || '–')}</dd>${d.creditor.ci ? `<dt>Gläubiger-ID</dt><dd>${esc(d.creditor.ci)}</dd>` : ''}</dl>` : `<dl class="vh-kv"><dt>Zahlungsart</dt><dd>${esc(p.payment || '–')}</dd></dl>`}</div>` : ''}
          ${V.einwilligungen !== false && d.consents.length ? `<div class="vh-card"><h3>Einwilligungen ${E.einwilligungen !== false ? '<button id="mdCons">Ändern</button>' : ''}</h3><div class="vh-rows">${d.consents.map(c => `<div><span>${esc(c.short)}</span><b>${c.given ? 'ja' : 'nein'}</b></div>`).join('')}</div></div>` : ''}
          ${certCard()}
          ${d.auskunft ? `<div class="vh-card"><h3>Datenauskunft <button id="mdAusk">Anfordern</button></h3><div class="vh-rows"><div><span>Alles, was der Verein zu dir gespeichert hat – als PDF per E-Mail<small>${d.auskunft.to ? `an ${esc(d.auskunft.to)}` : 'Dafür braucht der Verein deine E-Mail-Adresse.'}</small></span></div></div></div>` : ''}
          ${p.exit_date || !E.kuendigung ? '' : '<button class="vh-danger" id="mdQuit">Mitgliedschaft kündigen …</button>'}`;
        wireSeg();
        const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
        on('mdEdit', editContact); on('mdName', editName); on('mdBank', editBank); on('mdCons', editConsents); on('mdQuit', quit); on('mdAusk', requestData); on('mdPay', transfer); on('mdCert', requestCert);
        el.querySelectorAll('[data-cert]').forEach(b => { b.onclick = () => showCert(+b.dataset.cert); });
        if (focus === 'kontakt' && document.getElementById('mdEdit')) editContact(); else if (focus === 'bank' && document.getElementById('mdBank')) editBank(); else if (focus === 'ueberweisen' && document.getElementById('mdPay')) transfer();
        focus = '';
        void open;
      }

      /* ---------- Mitgliedsausweis: gespeicherte Karte sofort zeigen, höchstens einmal am Tag still beim Verein erneuern ---------- */
      const box = () => el.querySelector('#mdAw');
      const HINT = '<p class="vh-note" style="text-align:left;margin:0">Zeig den Ausweis im Vereinsheim, beim Turnier oder bei Partnervereinen vor. Er ist auf diesem Handy gespeichert und geht auch ohne Netz. Die laufende Uhr zeigt, dass es kein Bildschirmfoto ist.</p>';
      function paint(c, note) {
        const b = box(); if (!b) return;
        stopClock();
        b.innerHTML = (note ? `<div class="vh-bar a">${esc(note)}</div>` : '') + AW.html(c) + HINT;
        stopClock = AW.clock(b);
      }
      const STATE = { exited: x => `Deine Mitgliedschaft ist am ${deD(x.exit_date)} beendet. Der Mitgliedsausweis gilt nicht mehr.`, pending: () => 'Dein Mitgliedsantrag ist noch in Bearbeitung. Den Ausweis gibt es, sobald der Vorstand ihn angenommen hat.',
        none: () => 'Für dich ist keine Mitgliedschaft eingetragen – darum gibt es keinen Ausweis.', off: () => 'Der Verein bietet keinen Mitgliedsausweis an.' };
      /** Vereinslogo als kleines Bild für die gespeicherte Karte (ohne Netz lädt die Adresse „logo“ nicht) */
      const logoData = () => new Promise(res => {
        const i = new Image();
        i.onload = () => { try { const cv = document.createElement('canvas'), k = Math.min(1, 96 / Math.max(i.naturalWidth || 96, i.naturalHeight || 96)); cv.width = Math.round((i.naturalWidth || 96) * k); cv.height = Math.round((i.naturalHeight || 96) * k); cv.getContext('2d').drawImage(i, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/png')); } catch (e) { res(''); } };
        i.onerror = () => res(''); i.src = 'logo';
      });
      async function showCard(note) {
        if (stored) paint(stored, note);
        if (note || (stored && stored.fetched === AW.today())) return;
        try {
          const r = await ctx.api('ausweis');
          if (r.state !== 'ok') { await AW.clear(); stored = null; const b = box(); if (b) b.innerHTML = `<div class="vh-empty">${esc((STATE[r.state] || STATE.none)(r))}</div>`; return; }
          const card = { ...r.card, logo: (await logoData()) || (stored && stored.logo) || '' };
          await AW.save(card); stored = card; paint(card);
        } catch (e) {
          const msg = e.status === 423 ? 'Dein Ausweis wird erneuert, sobald sich der Vorstand in der Verwaltung angemeldet hat.' : e.message;
          if (stored) paint(stored, msg); else { const b = box(); if (b) b.innerHTML = `<div class="vh-empty">${esc(msg)}</div>`; }
        }
      }

      /* ---------- Ausweise prüfen (Kamera; ausweis-pruefen.js und jsQR laden erst hier) ---------- */
      const loadCheck = () => (window.AusweisPruefen ? Promise.resolve() : new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'm/mitglieder/ausweis-pruefen.js'; sc.onload = res; sc.onerror = () => rej(new Error('Die Prüfung lässt sich gerade nicht laden – bitte gleich noch einmal versuchen.')); document.body.appendChild(sc); }));
      async function checkView() {
        const b = el.querySelector('#mdAwp');
        try { await loadCheck(); } catch (e) { if (b) b.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        if (!b || !b.isConnected) return;
        stopCheck = window.AusweisPruefen.mount(b, { post: body => ctx.api('ausweis/pruefen', 'POST', body), base: 'm/mitglieder/', box: 'vh-card', btn: 'vh-btn wide' });
      }

      /* Überweisen: QR-Code für die Banking-App (am Rechner oder auf einem zweiten Gerät scannen) und alle Angaben zum Kopieren */
      async function transfer() {
        let t;
        try { t = await ctx.api('ueberweisen', 'POST', {}); } catch (e) { return ctx.toast(e.message, true, 6000); }
        const row = (k, label, v) => `<div><span style="min-width:0"><small>${label}</small><strong translate="no" style="overflow-wrap:anywhere">${esc(v)}</strong></span><button type="button" class="vh-link" data-cp="${k}">Kopieren</button></div>`;
        const vals = { n: t.name, i: t.iban.replace(/\s+/g, ''), a: (t.cents / 100).toFixed(2).replace('.', ','), z: t.purpose };
        const sh = sheet(`<h2>Überweisen</h2><p>Mit der Banking-App scannen – zum Beispiel vom Bildschirm eines anderen Geräts – oder die Angaben einzeln kopieren.</p>
          <div style="background:#fff;border-radius:14px;padding:8px;width:220px;max-width:100%;margin:0 auto 12px">${t.svg}</div>
          <div class="vh-rows">${row('n', 'Empfänger', t.name)}${row('i', 'IBAN', t.iban)}${t.bic ? `<div><span><small>BIC</small><strong translate="no">${esc(t.bic)}</strong></span></div>` : ''}${row('a', 'Betrag', euro(t.cents))}${row('z', 'Verwendungszweck', t.purpose)}</div>
          <p class="vh-note" style="text-align:left;margin:10px 0 0">Bitte den Verwendungszweck unverändert übernehmen – dann ordnet der Verein deine Zahlung automatisch zu.</p>
          <div class="vh-row" style="margin-top:12px"><button class="ok" id="mdNo">Fertig</button></div>`);
        const svg = sh.querySelector('svg'); if (svg) { svg.setAttribute('width', '100%'); svg.removeAttribute('height'); svg.style.display = 'block'; svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'QR-Code für die Überweisung'); }
        sh.querySelector('#mdNo').onclick = closeSheet;
        sh.querySelectorAll('[data-cp]').forEach(b => { b.onclick = async () => { try { await navigator.clipboard.writeText(vals[b.dataset.cp]); ctx.toast('Kopiert.'); } catch (e) { ctx.toast('Kopieren geht hier nicht – bitte von Hand übernehmen.', true); } }; });
      }
      /* Mitgliedsbescheinigung (z. B. für die Krankenkasse): anfordern, der Vorstand unterschreibt; fertige Bescheinigungen hier ansehen */
      const CST = { offen: ['a', 'beim Vorstand'], fertig: ['g', 'fertig'], abgelehnt: ['', 'abgelehnt'] };
      function certCard() {
        const c = d.certificates; if (!c || (!c.list.length && !(c.can && c.people.length))) return '';
        const many = c.people.length > 1 || c.list.some(x => !x.me);
        return `<div class="vh-card"><h3>Bescheinigung für die Krankenkasse ${c.can && c.people.length ? '<button id="mdCert">Anfordern</button>' : ''}</h3><div class="vh-rows">
          ${c.list.map(x => `<div><span>Mitgliedsbescheinigung ${esc(x.year)}<small>${x.status === 'fertig' && x.signed_at ? (many ? `für ${esc(x.name)} · unterschrieben am ${deD(x.signed_at.slice(0, 10))}` : `unterschrieben am ${deD(x.signed_at.slice(0, 10))}`) : many ? `für ${esc(x.name)} · angefordert am ${deD(x.created_at.slice(0, 10))}` : `angefordert am ${deD(x.created_at.slice(0, 10))}`}<span class="vh-chip ${(CST[x.status] || [''])[0]}">${esc((CST[x.status] || ['', x.status])[1])}</span></small>${x.reason ? `<small>Grund: <span translate="no">${esc(x.reason)}</span></small>` : ''}</span>${x.pdf ? `<button type="button" class="vh-link" data-cert="${x.id}">Ansehen</button>` : ''}</div>`).join('')
            || '<div><span>Für das Bonusprogramm deiner Krankenkasse: Der Vorstand unterschreibt die Bescheinigung und schickt sie dir.</span></div>'}</div></div>`;
      }
      async function showCert(id) {
        const x = d.certificates.list.find(c => c.id === id);
        try { await ctx.view(await ctx.blob(`bescheinigung/${id}/pdf`), `Mitgliedsbescheinigung ${x ? x.year : ''}`.trim(), 'pdf'); } catch (e) { ctx.toast(e.message, true); }
      }
      function requestCert() {
        const c = d.certificates, people = c.people;
        const sh = sheet(`<h2>Bescheinigung anfordern</h2><p>Der Vorstand bestätigt die Mitgliedschaft mit Unterschrift und Vereinsstempel. Du bekommst sie per E-Mail und findest sie danach hier.</p>
          ${people.length > 1 ? `<label>Für</label><select class="vh-input" id="mcW">${people.map(p => `<option value="${p.id}">${esc(p.name)}${p.me ? ' (ich)' : ''}</option>`).join('')}</select>` : ''}
          <label>Jahr</label><select class="vh-input" id="mcY"></select>
          <label>Hinweis (freiwillig)</label><input class="vh-input" id="mcN" maxlength="120" placeholder="z. B. Name der Krankenkasse">
          <div class="vh-err" id="mdErr"></div><div class="vh-row"><button class="no" id="mdNo">Abbrechen</button><button class="ok" id="mdOk">Anfordern</button></div>`);
        const who = () => people.find(p => p.id === +(sh.querySelector('#mcW') || { value: people[0].id }).value) || people[0];
        const years = () => { sh.querySelector('#mcY').innerHTML = who().years.map(y => `<option value="${y}">${y}</option>`).join(''); };
        years(); if (sh.querySelector('#mcW')) sh.querySelector('#mcW').onchange = years;
        sh.querySelector('#mdNo').onclick = closeSheet;
        sh.querySelector('#mdOk').onclick = async () => {
          try {
            await ctx.api('bescheinigung', 'POST', { member_id: who().id, year: +sh.querySelector('#mcY').value, note: sh.querySelector('#mcN').value.trim() });
            closeSheet(); ctx.toast('Angefordert – der Vorstand schickt dir die Bescheinigung.'); load();
          } catch (e) { sh.querySelector('#mdErr').textContent = e.message; }
        };
      }
      /* Auskunft nach Art. 15 DSGVO: mit PIN anfordern, kommt als PDF (und Datei) an die hinterlegte E-Mail-Adresse */
      async function requestData() {
        if (!d.auskunft.to) return ctx.toast('Beim Verein ist keine E-Mail-Adresse von dir hinterlegt. Bitte trag sie unter „Kontakt“ ein oder frag beim Vorstand nach.', true, 6000);
        if (!d.auskunft.ready) return ctx.toast('Der Verein hat noch kein Postfach eingerichtet. Bitte frag beim Vorstand nach.', true, 6000);
        try {
          const r = await ctx.withPin('Datenauskunft anfordern', pin => ctx.api('auskunft', 'POST', { pin }));
          if (r) ctx.toast(`Ist unterwegs an ${r.to} – schau gleich in dein Postfach.`, false, 6000);
        } catch (e) { ctx.toast(e.message, true, 6000); }
      }
      function editContact() {
        const p = d.person;
        const f = (k, l, t = 'text') => `<label>${l}</label><input class="vh-input" data-k="${k}" type="${t}" value="${esc(p[k] || '')}">`;
        const E = (d.perms && d.perms.edit) || {};
        const sh = sheet(`<h2>Kontaktdaten ändern</h2><p>Der Vorstand bestätigt die Änderung.</p>${E.kontakt ? '<p>Eine neue E-Mail-Adresse bestätigst du mit deiner PIN.</p>' : ''}${E.anschrift ? `${f('street', 'Straße und Hausnummer')}<div class="vh-row" style="gap:10px"><div style="flex:1">${f('zip', 'PLZ')}</div><div style="flex:2">${f('city', 'Ort')}</div></div>` : ''}
          ${E.kontakt ? `${f('email', 'E-Mail', 'email')}${f('mobile', 'Handy', 'tel')}` : ''}${!E.kontakt || !E.anschrift ? `<p class="vh-note" style="text-align:left;margin:10px 0 0">${!E.kontakt ? 'E-Mail und Handynummer' : 'Die Anschrift'} kann nur der Vorstand ändern.</p>` : ''}<div class="vh-err" id="mdErr"></div><div class="vh-row"><button class="no" id="mdNo">Abbrechen</button><button class="ok" id="mdOk">Senden</button></div>`);
        sh.querySelector('#mdNo').onclick = closeSheet;
        sh.querySelector('#mdOk').onclick = async () => {
          const body = {}; sh.querySelectorAll('[data-k]').forEach(i => { body[i.dataset.k] = i.value.trim(); });
          // neue E-Mail-Adresse: mit PIN (der Server verlangt sie) – alles andere ohne, der Vorstand bestätigt ohnehin
          const mailChanged = body.email !== undefined && body.email.toLowerCase() !== String(p.email || '').toLowerCase();
          try {
            const r = mailChanged ? await ctx.withPin('Neue E-Mail-Adresse bestätigen', pin => ctx.api('change', 'POST', { ...body, pin })) : await ctx.api('change', 'POST', body);
            if (r) { closeSheet(); ctx.toast('Gesendet – der Vorstand bestätigt die Änderung.'); load(); }
          } catch (e) { sh.querySelector('#mdErr').textContent = e.message; }
        };
      }
      /* Namensänderung (z. B. nach Hochzeit oder Scheidung): Vor- und Nachname, der Vorstand bestätigt – der bisherige Name bleibt beim Verein als „früherer Name“ */
      function editName() {
        const p = d.person;
        const f = (k, l) => `<label>${l}</label><input class="vh-input" data-k="${k}" autocomplete="${k === 'first_name' ? 'given-name' : 'family-name'}" maxlength="60" value="${esc(p[k] || '')}">`;
        const sh = sheet(`<h2>Mein Name hat sich geändert</h2><p>Zum Beispiel nach einer Hochzeit oder Scheidung. Der Vorstand bestätigt die Änderung.</p>${f('first_name', 'Vorname')}${f('last_name', 'Nachname')}
          <div class="vh-err" id="mdErr"></div><div class="vh-row"><button class="no" id="mdNo">Abbrechen</button><button class="ok" id="mdOk">Senden</button></div>`);
        sh.querySelector('#mdNo').onclick = closeSheet;
        sh.querySelector('#mdOk').onclick = async () => {
          const body = {}; sh.querySelectorAll('[data-k]').forEach(i => { body[i.dataset.k] = i.value.trim(); });
          try { await ctx.api('name', 'POST', body); closeSheet(); ctx.toast('Gesendet – der Vorstand bestätigt die Änderung.'); load(); }
          catch (e) { sh.querySelector('#mdErr').textContent = e.message; }
        };
      }
      function editConsents() {
        const sh = sheet(`<h2>Einwilligungen</h2><p>Freiwillige Einwilligungen kannst du jederzeit widerrufen – das gilt sofort. <span>Änderungen bestätigst du mit deiner PIN.</span></p><div>${d.consents.map(c => `<label class="vh-check"><input type="checkbox" data-c="${esc(c.key)}" ${c.given ? 'checked' : ''} ${c.required ? 'disabled' : ''}><span><b>${esc(c.short)}</b>${c.required ? ' (für die Mitgliedschaft nötig)' : ''}<br>${esc(c.text)}</span></label>`).join('')}</div>
          <div class="vh-err" id="mdErr"></div><div class="vh-row"><button class="no" id="mdNo">Abbrechen</button><button class="ok" id="mdOk">Speichern</button></div>`);
        sh.querySelector('#mdNo').onclick = closeSheet;
        sh.querySelector('#mdOk').onclick = async () => {
          const consents = {}; sh.querySelectorAll('[data-c]').forEach(c => { consents[c.dataset.c] = c.checked; });
          if (!d.consents.some(c => Boolean(consents[c.key]) !== Boolean(c.given))) { closeSheet(); return; }   // nichts geändert – keine PIN-Abfrage nötig
          try {
            const r = await ctx.withPin('Einwilligungen bestätigen', pin => ctx.api('change', 'POST', { consents, pin }));
            if (r) { closeSheet(); ctx.toast('Gespeichert.'); load(); }
          } catch (e) { sh.querySelector('#mdErr').textContent = e.message === 'Du hast nichts geändert.' ? '' : e.message; if (e.message === 'Du hast nichts geändert.') closeSheet(); }
        };
      }
      function loadPad() { return window.Antrag ? Promise.resolve() : new Promise(res => { const s = document.createElement('script'); s.src = 'p/mitglieder/antrag.js'; s.onload = res; s.onerror = res; document.body.appendChild(s); }); }
      async function editBank() {
        await loadPad();
        const sh = sheet(`<h2>Neue Bankverbindung</h2><p>Mit deiner Unterschrift erteilst du ein neues SEPA-Lastschriftmandat. Der Vorstand übernimmt es und schickt dir die neue Mandatsreferenz.</p>
          <label>Kontoinhaber/in</label><input class="vh-input" id="mbH" value="${esc((d.bank && d.bank.holder) || `${d.person.first_name} ${d.person.last_name}`)}">
          <label>IBAN</label><input class="vh-input" id="mbI" autocomplete="off" spellcheck="false" style="text-transform:uppercase">
          <label>BIC (nur bei ausländischen Konten)</label><input class="vh-input" id="mbB" autocomplete="off">
          <label style="margin-top:6px">Unterschrift</label><div class="af-pad" id="mbPad" style="position:relative;height:150px;border:2px dashed var(--line);border-radius:14px;background:#fff;touch-action:none;overflow:hidden"><canvas style="position:absolute;inset:0;width:100%;height:100%"></canvas></div>
          <div style="margin-top:12px"><label class="vh-check"><input type="checkbox" id="mbA"><span>Ich ermächtige den ${esc(d.creditor.name)}${d.creditor.ci ? ` (Gläubiger-ID ${esc(d.creditor.ci)})` : ''}, Zahlungen von meinem Konto per Lastschrift einzuziehen, und weise mein Kreditinstitut an, diese einzulösen. Ich kann innerhalb von acht Wochen ab Belastung die Erstattung verlangen.</span></label></div>
          <div class="vh-err" id="mdErr"></div><div class="vh-row"><button class="no" id="mdNo">Abbrechen</button><button class="ok" id="mdOk">Unterschreiben</button></div>`);
        const pad = window.Antrag && window.Antrag.pad ? window.Antrag.pad(sh.querySelector('#mbPad')) : null;
        sh.querySelector('#mdNo').onclick = closeSheet;
        sh.querySelector('#mdOk').onclick = async () => {
          const err = t => { sh.querySelector('#mdErr').textContent = t; };
          if (!pad || !pad.ok()) return err('Bitte unterschreiben.');
          if (!sh.querySelector('#mbA').checked) return err('Bitte das Mandat bestätigen.');
          const body = { holder: sh.querySelector('#mbH').value.trim(), iban: sh.querySelector('#mbI').value, bic: sh.querySelector('#mbB').value, agree: true, signature: pad.png() };
          try {
            const r = await ctx.withPin('Neue Bankverbindung bestätigen', pin => ctx.api('bank', 'POST', { ...body, pin }));
            if (r) { closeSheet(); ctx.toast('Gesendet – der Vorstand übernimmt die neue Bankverbindung.'); load(); }
          } catch (e) { err(e.message); }
        };
      }
      function quit() {
        const fam = d.isHead && d.family.length > 1;
        const sh = sheet(`<h2>Mitgliedschaft kündigen</h2><p>Nach der Satzung endet die Mitgliedschaft frühestens zum <b>${deD(d.notice.date)}</b>${d.notice.months ? ` (Kündigungsfrist ${d.notice.months} Monate zum Ende des Geschäftsjahres)` : ' (zum Ende des Geschäftsjahres)'}. Der Vorstand bestätigt die Kündigung per E-Mail.</p>
          ${fam ? `<div>${d.family.map(f => `<label class="vh-check"><input type="checkbox" data-m="${f.id}" ${f.me ? 'checked' : ''}><span>${esc(f.name)}${f.head ? ' (zahlt)' : ''}</span></label>`).join('')}</div>` : ''}
          <label>Grund (freiwillig)</label><input class="vh-input" id="mqR" maxlength="300">
          <div style="margin-top:10px"><label class="vh-check"><input type="checkbox" id="mqC"><span>Ich möchte die Mitgliedschaft kündigen.</span></label></div>
          <div class="vh-err" id="mdErr"></div><div class="vh-row"><button class="no" id="mdNo">Abbrechen</button><button class="ok" id="mdOk" style="background:var(--red)">Kündigen</button></div>`);
        sh.querySelector('#mdNo').onclick = closeSheet;
        sh.querySelector('#mdOk').onclick = async () => {
          const err = t => { sh.querySelector('#mdErr').textContent = t; };
          if (!sh.querySelector('#mqC').checked) return err('Bitte bestätigen.');
          const members = fam ? [...sh.querySelectorAll('[data-m]')].filter(c => c.checked).map(c => +c.dataset.m) : undefined;
          if (fam && !members.length) return err('Bitte mindestens eine Person wählen.');
          try {
            const r = await ctx.withPin('Kündigung bestätigen', pin => ctx.api('kuendigung', 'POST', { confirm: true, members, reason: sh.querySelector('#mqR').value, pin }));
            if (r) { closeSheet(); ctx.toast(`Kündigung eingegangen – Austritt voraussichtlich zum ${deD(r.exit_date)}.`, false, 6000); load(); }
          } catch (e) { err(e.message); }
        };
      }
      el.innerHTML = '<div class="vh-empty">Lade …</div>';
      load();
    },
  });
})();
