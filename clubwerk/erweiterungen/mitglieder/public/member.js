'use strict';
/* Bereich „Meine Daten“ in der Mitglieder-App: Mitgliedschaft, Beiträge, Zahlungen, Kontaktdaten, Bankverbindung, Kündigung */
(() => {
  if (!document.getElementById('mdStyle')) {
    const s = document.createElement('style'); s.id = 'mdStyle';
    s.textContent = `
      .md-head { display: flex; align-items: center; gap: 14px; }
      .md-av { width: 52px; height: 52px; border-radius: 16px; background: var(--brand-soft); color: var(--brand-ink); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; flex: none; }
      .md-head b { display: block; font-size: 18px; } .md-head span { color: var(--muted); font-size: 13.5px; }
      .vh-rows .md-r { text-align: right; white-space: normal; }`;
    document.head.appendChild(s);
  }
  const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const deD = d => (d ? d.slice(0, 10).split('-').reverse().join('.') : '');
  const ST = { offen: ['a', 'offen'], eingezogen: ['', 'wird abgebucht'], bezahlt: ['g', 'bezahlt'] };

  window.VA.registerSection({
    id: 'mitglieder',
    render(el, ctx) {
      const { esc } = ctx;
      let d = null;
      const sheet = (html) => {
        let sh = document.getElementById('mdSheet');
        if (!sh) { sh = document.createElement('div'); sh.id = 'mdSheet'; sh.className = 'vh-sheet vh-form'; document.body.appendChild(sh); }
        sh.innerHTML = `<div class="vh-box">${html}</div>`; sh.classList.add('show');
        return sh;
      };
      const closeSheet = () => { const sh = document.getElementById('mdSheet'); if (sh) sh.classList.remove('show'); };
      ctx.onLeave(closeSheet);

      async function load() {
        try { d = await ctx.api('me'); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        if (d.none) { el.innerHTML = '<div class="vh-empty">Für dich sind noch keine Mitgliedsdaten hinterlegt.</div>'; return; }
        const p = d.person;
        // Name und Initialen: aus Vor-/Nachname, sonst aus dem Kontonamen („Muster, Max“) – nie eine leere Karte
        const full = [p.first_name, p.last_name].filter(Boolean).join(' ') || String(ctx.member || '').split(',').map(x => x.trim()).reverse().join(' ');
        const ini = full.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
        const open = d.charges.filter(c => c.status === 'offen' || c.status === 'eingezogen');
        const V = (d.perms && d.perms.view) || {}, E = (d.perms && d.perms.edit) || {};
        const showFees = V.beitraege !== false || d.departments.length || d.family.length > 1 || (d.familyMembership && d.familyMembership.length > 1);
        el.innerHTML = `
          ${d.pending.length ? `<div class="vh-bar a">Beim Vorstand in Bearbeitung: ${d.pending.map(x => esc(x.label)).join(', ')}</div>` : ''}
          ${p.exit_date ? `<div class="vh-bar a">Deine Mitgliedschaft endet zum ${deD(p.exit_date)}.</div>` : ''}
          <div class="vh-card"><div class="md-head"><span class="md-av">${esc(ini)}</span><div style="min-width:0"><b>${esc(full)}</b><span>${p.member_no ? `Mitgliedsnummer ${esc(p.member_no)} · ` : ''}${esc(p.status || 'Mitglied')}${p.entry_date ? ` seit ${deD(p.entry_date)}` : ''}</span></div></div></div>
          ${showFees ? `<div class="vh-card"><h3>Mitgliedschaft</h3><div class="vh-rows">
            ${V.beitraege === false ? '' : d.fees.map(f => `<div><span><span translate="no">${esc(f.name)}</span>${f.dept ? `<small>Zusatzbeitrag Abteilung <span translate="no">${esc(f.dept)}</span></small>` : ''}${f.who ? `<small>für ${esc(f.who)}</small>` : ''}${f.booked_until ? `<small>abgerechnet bis ${deD(f.booked_until)}</small>` : ''}</span><b>${euro(f.cents)} <small style="display:inline">${esc(f.interval)}</small></b></div>`).join('')
              || `<div><span>${d.familyHeadName ? `Dein Beitrag ist im Familienbeitrag von ${esc(d.familyHeadName)} enthalten.` : d.payerName ? `Dein Beitrag läuft über ${esc(d.payerName)}.` : 'Kein Beitrag hinterlegt.'}</span></div>`}
            ${d.departments.length ? `<div><span>Abteilungen</span><b translate="no" class="md-r">${d.departments.map(x => esc(x.name)).join(', ')}</b></div>` : ''}
            ${d.familyMembership && d.familyMembership.length > 1 ? `<div><span>Familienmitgliedschaft</span><b class="md-r">${d.familyMembership.map(f => esc(f.name) + (f.role === 'oberhaupt' ? ' (Oberhaupt)' : '')).join(', ')}</b></div>` : ''}
            ${d.family.length > 1 ? `<div><span>${d.familyMembership && d.familyMembership.length > 1 ? 'Zahler' : 'Familie'}</span><b class="md-r">${d.family.map(f => esc(f.name) + (f.head ? ' (zahlt)' : '')).join(', ')}</b></div>` : ''}
          </div></div>` : ''}
          ${d.isHead && V.posten !== false ? `<div class="vh-card"><h3>Zahlungen${d.open_cents ? `<span class="vh-chip a">offen ${euro(d.open_cents)}</span>` : ''}</h3><div class="vh-rows">
            ${d.charges.slice(0, 12).map(c => `<div><span><span translate="no">${esc(c.text)}</span><small>${c.status === 'eingezogen' && c.collection_date ? `Lastschrift am ${deD(c.collection_date)}` : c.status === 'bezahlt' ? `bezahlt ${deD(c.paid_at)}` : `fällig ${deD(c.due_date)}`}<span class="vh-chip ${(ST[c.status] || [''])[0]}">${esc((ST[c.status] || ['', c.status])[1])}</span></small></span><b>${euro(c.cents)}</b></div>`).join('') || '<p class="vh-none">Noch keine Zahlungen.</p>'}
          </div></div>` : ''}
          ${V.anschrift !== false || V.kontakt !== false || V.geburt !== false ? `<div class="vh-card"><h3>Kontakt ${E.anschrift || E.kontakt ? '<button id="mdEdit">Ändern</button>' : ''}</h3><dl class="vh-kv">
            ${V.anschrift !== false ? `<dt>Anschrift</dt><dd>${esc(p.street || '–')}<br>${esc([p.zip, p.city].filter(Boolean).join(' '))}</dd>` : ''}
            ${V.kontakt !== false ? `<dt>E-Mail</dt><dd>${esc(p.email || '–')}</dd><dt>Mobil</dt><dd>${esc(p.mobile || p.phone || '–')}</dd>` : ''}
            ${V.geburt !== false && p.birth_date ? `<dt>Geburtsdatum</dt><dd>${deD(p.birth_date)}</dd>` : ''}</dl></div>` : ''}
          ${d.isHead && V.bank !== false ? `<div class="vh-card"><h3>Bankverbindung ${E.bank ? '<button id="mdBank">Neue Bankverbindung</button>' : ''}</h3>${d.bank ? `<dl class="vh-kv"><dt>Konto</dt><dd>${esc(d.bank.iban)}</dd><dt>Inhaber/in</dt><dd>${esc(d.bank.holder || '–')}</dd>
            <dt>Mandatsreferenz</dt><dd>${esc(d.bank.mandate_ref || '–')}</dd>${d.creditor.ci ? `<dt>Gläubiger-ID</dt><dd>${esc(d.creditor.ci)}</dd>` : ''}</dl>` : `<dl class="vh-kv"><dt>Zahlungsart</dt><dd>${esc(p.payment || '–')}</dd></dl>`}</div>` : ''}
          ${V.einwilligungen !== false && d.consents.length ? `<div class="vh-card"><h3>Einwilligungen ${E.einwilligungen !== false ? '<button id="mdCons">Ändern</button>' : ''}</h3><div class="vh-rows">${d.consents.map(c => `<div><span>${esc(c.short)}</span><b>${c.given ? 'ja' : 'nein'}</b></div>`).join('')}</div></div>` : ''}
          ${p.exit_date || !E.kuendigung ? '' : '<button class="vh-danger" id="mdQuit">Mitgliedschaft kündigen …</button>'}`;
        const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
        on('mdEdit', editContact); on('mdBank', editBank); on('mdCons', editConsents); on('mdQuit', quit);
        void open;
      }

      function editContact() {
        const p = d.person;
        const f = (k, l, t = 'text') => `<label>${l}</label><input class="vh-input" data-k="${k}" type="${t}" value="${esc(p[k] || '')}">`;
        const E = (d.perms && d.perms.edit) || {};
        const sh = sheet(`<h2>Kontaktdaten ändern</h2><p>Der Vorstand bestätigt die Änderung.</p>${E.kontakt ? '<p>Eine neue E-Mail-Adresse bestätigst du mit deiner PIN.</p>' : ''}${E.anschrift ? `${f('street', 'Straße und Hausnummer')}<div class="vh-row" style="gap:10px"><div style="flex:1">${f('zip', 'PLZ')}</div><div style="flex:2">${f('city', 'Ort')}</div></div>` : ''}
          ${E.kontakt ? `${f('email', 'E-Mail', 'email')}${f('mobile', 'Mobil', 'tel')}` : ''}${!E.kontakt || !E.anschrift ? `<p class="vh-note" style="text-align:left;margin:10px 0 0">${!E.kontakt ? 'E-Mail und Handynummer' : 'Die Anschrift'} kann nur der Vorstand ändern.</p>` : ''}<div class="vh-err" id="mdErr"></div><div class="vh-row"><button class="no" id="mdNo">Abbrechen</button><button class="ok" id="mdOk">Senden</button></div>`);
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
        const sh = sheet(`<h2>Mitgliedschaft kündigen</h2><p>Nach der Satzung endet die Mitgliedschaft frühestens zum <b>${deD(d.notice.date)}</b>${d.notice.months ? ` (Kündigungsfrist ${d.notice.months} Monate zum Ende des Beitragsjahres)` : ''}. Der Vorstand bestätigt die Kündigung per E-Mail.</p>
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
