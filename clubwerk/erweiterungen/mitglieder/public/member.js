'use strict';
/* Bereich „Meine Daten“ in der Mitglieder-App: Mitgliedschaft, Beiträge, Zahlungen, Kontaktdaten, Bankverbindung, Kündigung */
(() => {
  if (!document.getElementById('mdStyle')) {
    const s = document.createElement('style'); s.id = 'mdStyle';
    s.textContent = `
      .md-card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 16px 18px; box-shadow: var(--shadow); }
      .md-card h3 { margin: 0 0 10px; font-size: 15px; font-weight: 800; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
      .md-card h3 button { font: inherit; font-size: 13.5px; font-weight: 700; color: var(--brand-ink); background: none; border: 0; padding: 4px 0; }
      .md-head { display: flex; align-items: center; gap: 14px; }
      .md-av { width: 52px; height: 52px; border-radius: 16px; background: var(--brand-soft); color: var(--brand-ink); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; flex: none; }
      .md-head b { display: block; font-size: 18px; } .md-head span { color: var(--muted); font-size: 13.5px; }
      .md-kv { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; font-size: 14.5px; margin: 0; }
      .md-kv dt { color: var(--muted); } .md-kv dd { margin: 0; text-align: right; font-weight: 600; overflow-wrap: anywhere; }
      .md-list { display: flex; flex-direction: column; }
      .md-list > div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); font-size: 14.5px; }
      .md-list > div:first-child { border-top: 0; padding-top: 2px; }
      .md-list small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px; }
      .md-list b { white-space: nowrap; font-variant-numeric: tabular-nums; }
      .md-tag { display: inline-block; font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 9px; background: var(--hover); color: var(--muted); margin-left: 6px; }
      .md-tag.a { background: var(--amber-soft); color: var(--amber); } .md-tag.g { background: var(--brand-soft); color: var(--brand-ink); }
      .md-banner { background: var(--amber-soft); color: var(--amber); border-radius: 14px; padding: 12px 14px; font-size: 14px; font-weight: 600; }
      .md-sheet .vh-box { max-width: 460px; text-align: left; max-height: 88vh; overflow: auto; }
      .md-sheet label { display: block; font-size: 13px; font-weight: 700; color: var(--muted); margin: 0 0 4px; }
      .md-sheet .vh-input { font-size: 16px; min-height: 48px; }
      .md-cons label { display: flex; gap: 12px; align-items: flex-start; font-size: 14px; color: var(--ink); font-weight: 500; line-height: 1.4; margin: 0 0 10px; }
      .md-cons input { width: 22px; height: 22px; flex: none; accent-color: var(--brand); }
      .md-danger { width: 100%; min-height: 48px; border-radius: 14px; background: transparent; color: var(--red); border: 1px solid var(--red-line, var(--line)); font: inherit; font-weight: 700; font-size: 15px; }`;
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
        if (!sh) { sh = document.createElement('div'); sh.id = 'mdSheet'; sh.className = 'vh-sheet md-sheet'; document.body.appendChild(sh); }
        sh.innerHTML = `<div class="vh-box">${html}</div>`; sh.classList.add('show');
        return sh;
      };
      const closeSheet = () => { const sh = document.getElementById('mdSheet'); if (sh) sh.classList.remove('show'); };
      ctx.onLeave(closeSheet);

      async function load() {
        try { d = await ctx.api('me'); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        if (d.none) { el.innerHTML = '<div class="vh-empty">Für dich sind noch keine Mitgliedsdaten hinterlegt.</div>'; return; }
        const p = d.person;
        const ini = `${(p.first_name || ' ')[0]}${(p.last_name || ' ')[0]}`.toUpperCase();
        const open = d.charges.filter(c => c.status === 'offen' || c.status === 'eingezogen');
        const V = (d.perms && d.perms.view) || {}, E = (d.perms && d.perms.edit) || {};
        const showFees = V.beitraege !== false || d.departments.length || d.family.length > 1;
        el.innerHTML = `
          ${d.pending.length ? `<div class="md-banner">Beim Vorstand in Bearbeitung: ${d.pending.map(x => esc(x.label)).join(', ')}</div>` : ''}
          ${p.exit_date ? `<div class="md-banner">Deine Mitgliedschaft endet zum ${deD(p.exit_date)}.</div>` : ''}
          <div class="md-card"><div class="md-head"><span class="md-av">${esc(ini)}</span><div><b>${esc(p.first_name)} ${esc(p.last_name)}</b><span>${p.member_no ? `Mitgliedsnummer ${esc(p.member_no)} · ` : ''}${esc(p.status)}${p.entry_date ? ` seit ${deD(p.entry_date)}` : ''}</span></div></div></div>
          ${showFees ? `<div class="md-card"><h3>Mitgliedschaft</h3><div class="md-list">
            ${V.beitraege === false ? '' : d.fees.map(f => `<div><span><span translate="no">${esc(f.name)}</span>${f.dept ? `<small>Zusatzbeitrag Abteilung <span translate="no">${esc(f.dept)}</span></small>` : ''}${f.who ? `<small>für ${esc(f.who)}</small>` : ''}${f.booked_until ? `<small>abgerechnet bis ${deD(f.booked_until)}</small>` : ''}</span><b>${euro(f.cents)} <small style="display:inline">${esc(f.interval)}</small></b></div>`).join('')
              || `<div><span>${d.payerName ? `Dein Beitrag läuft über ${esc(d.payerName)}.` : 'Kein Beitrag hinterlegt.'}</span></div>`}
            ${d.departments.length ? `<div><span>Abteilungen</span><b translate="no" style="white-space:normal;text-align:right">${d.departments.map(x => esc(x.name)).join(', ')}</b></div>` : ''}
            ${d.family.length > 1 ? `<div><span>Familie</span><b style="white-space:normal;text-align:right">${d.family.map(f => esc(f.name) + (f.head ? ' (zahlt)' : '')).join(', ')}</b></div>` : ''}
          </div></div>` : ''}
          ${d.isHead && V.posten !== false ? `<div class="md-card"><h3>Zahlungen${d.open_cents ? `<span class="md-tag a">offen ${euro(d.open_cents)}</span>` : ''}</h3><div class="md-list">
            ${d.charges.slice(0, 12).map(c => `<div><span><span translate="no">${esc(c.text)}</span><small>${c.status === 'eingezogen' && c.collection_date ? `Lastschrift am ${deD(c.collection_date)}` : c.status === 'bezahlt' ? `bezahlt ${deD(c.paid_at)}` : `fällig ${deD(c.due_date)}`}<span class="md-tag ${(ST[c.status] || [''])[0]}">${esc((ST[c.status] || ['', c.status])[1])}</span></small></span><b>${euro(c.cents)}</b></div>`).join('') || '<div><span class="muted">Noch keine Zahlungen.</span></div>'}
          </div></div>` : ''}
          ${V.anschrift !== false || V.kontakt !== false || V.geburt !== false ? `<div class="md-card"><h3>Kontakt ${E.anschrift || E.kontakt ? '<button id="mdEdit">Ändern</button>' : ''}</h3><dl class="md-kv">
            ${V.anschrift !== false ? `<dt>Anschrift</dt><dd>${esc(p.street || '–')}<br>${esc([p.zip, p.city].filter(Boolean).join(' '))}</dd>` : ''}
            ${V.kontakt !== false ? `<dt>E-Mail</dt><dd>${esc(p.email || '–')}</dd><dt>Mobil</dt><dd>${esc(p.mobile || p.phone || '–')}</dd>` : ''}
            ${V.geburt !== false && p.birth_date ? `<dt>Geburtsdatum</dt><dd>${deD(p.birth_date)}</dd>` : ''}</dl></div>` : ''}
          ${d.isHead && V.bank !== false ? `<div class="md-card"><h3>Bankverbindung ${E.bank ? '<button id="mdBank">Neue Bankverbindung</button>' : ''}</h3>${d.bank ? `<dl class="md-kv"><dt>Konto</dt><dd>${esc(d.bank.iban)}</dd><dt>Inhaber/in</dt><dd>${esc(d.bank.holder || '–')}</dd>
            <dt>Mandatsreferenz</dt><dd>${esc(d.bank.mandate_ref || '–')}</dd>${d.creditor.ci ? `<dt>Gläubiger-ID</dt><dd>${esc(d.creditor.ci)}</dd>` : ''}</dl>` : `<p class="vh-note" style="text-align:left">Zahlungsart: ${esc(p.payment)}</p>`}</div>` : ''}
          <div class="md-card"><h3>Einwilligungen <button id="mdCons">Ändern</button></h3><div class="md-list">${d.consents.map(c => `<div><span>${esc(c.short)}</span><b>${c.given ? 'ja' : 'nein'}</b></div>`).join('')}</div></div>
          ${p.exit_date || !E.kuendigung ? '' : '<button class="md-danger" id="mdQuit">Mitgliedschaft kündigen …</button>'}`;
        const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
        on('mdEdit', editContact); on('mdBank', editBank); on('mdCons', editConsents); on('mdQuit', quit);
        void open;
      }

      function editContact() {
        const p = d.person;
        const f = (k, l, t = 'text') => `<label>${l}</label><input class="vh-input" data-k="${k}" type="${t}" value="${esc(p[k] || '')}">`;
        const E = (d.perms && d.perms.edit) || {};
        const sh = sheet(`<h2>Kontaktdaten ändern</h2><p>Der Vorstand bestätigt die Änderung.</p>${E.anschrift ? `${f('street', 'Straße und Hausnummer')}<div class="vh-row" style="gap:10px"><div style="flex:1">${f('zip', 'PLZ')}</div><div style="flex:2">${f('city', 'Ort')}</div></div>` : ''}
          ${E.kontakt ? `${f('email', 'E-Mail', 'email')}${f('mobile', 'Mobil', 'tel')}` : ''}<div class="vh-err" id="mdErr"></div><div class="vh-row"><button class="no" id="mdNo">Abbrechen</button><button class="ok" id="mdOk">Senden</button></div>`);
        sh.querySelector('#mdNo').onclick = closeSheet;
        sh.querySelector('#mdOk').onclick = async () => {
          const body = {}; sh.querySelectorAll('[data-k]').forEach(i => { body[i.dataset.k] = i.value.trim(); });
          try { await ctx.api('change', 'POST', body); closeSheet(); ctx.toast('Gesendet – der Vorstand bestätigt die Änderung.'); load(); } catch (e) { sh.querySelector('#mdErr').textContent = e.message; }
        };
      }
      function editConsents() {
        const sh = sheet(`<h2>Einwilligungen</h2><p>Freiwillige Einwilligungen kannst du jederzeit widerrufen – das gilt sofort.</p><div class="md-cons">${d.consents.map(c => `<label><input type="checkbox" data-c="${esc(c.key)}" ${c.given ? 'checked' : ''} ${c.required ? 'disabled' : ''}><span><b>${esc(c.short)}</b>${c.required ? ' (für die Mitgliedschaft nötig)' : ''}<br>${esc(c.text)}</span></label>`).join('')}</div>
          <div class="vh-err" id="mdErr"></div><div class="vh-row"><button class="no" id="mdNo">Abbrechen</button><button class="ok" id="mdOk">Speichern</button></div>`);
        sh.querySelector('#mdNo').onclick = closeSheet;
        sh.querySelector('#mdOk').onclick = async () => {
          const consents = {}; sh.querySelectorAll('[data-c]').forEach(c => { consents[c.dataset.c] = c.checked; });
          try { await ctx.api('change', 'POST', { consents }); closeSheet(); ctx.toast('Gespeichert.'); load(); } catch (e) { sh.querySelector('#mdErr').textContent = e.message === 'Du hast nichts geändert.' ? '' : e.message; if (e.message === 'Du hast nichts geändert.') closeSheet(); }
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
          <div class="md-cons" style="margin-top:12px"><label><input type="checkbox" id="mbA"><span>Ich ermächtige den ${esc(d.creditor.name)}${d.creditor.ci ? ` (Gläubiger-ID ${esc(d.creditor.ci)})` : ''}, Zahlungen von meinem Konto per Lastschrift einzuziehen, und weise mein Kreditinstitut an, diese einzulösen. Ich kann innerhalb von acht Wochen ab Belastung die Erstattung verlangen.</span></label></div>
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
          ${fam ? `<div class="md-cons">${d.family.map(f => `<label><input type="checkbox" data-m="${f.id}" ${f.me ? 'checked' : ''}><span>${esc(f.name)}${f.head ? ' (zahlt)' : ''}</span></label>`).join('')}</div>` : ''}
          <label>Grund (freiwillig)</label><input class="vh-input" id="mqR" maxlength="300">
          <div class="md-cons" style="margin-top:10px"><label><input type="checkbox" id="mqC"><span>Ich möchte die Mitgliedschaft kündigen.</span></label></div>
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
