'use strict';
/* Beitrittserklärung zum Ausfüllen und Unterschreiben – gemeinsam für Tablet („Mitglied werden“) und Online-Antrag.
   window.Antrag.mount(el, { cfg, mode: 'tablet' | 'online', post(path, body) → Promise, prefill, onDone(result), onCancel }) */
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const deD = d => (d ? d.split('-').reverse().join('.') : '');
  const ageAt = (b, day) => { if (!b) return null; let a = +day.slice(0, 4) - +b.slice(0, 4); if (day.slice(5) < b.slice(5)) a--; return a; };
  const deptFee = (dep, birth) => { const a = ageAt(birth, new Date().toISOString().slice(0, 10)); return dep.fees.find(f => a == null || ((f.age_min == null || a >= f.age_min) && (f.age_max == null || a <= f.age_max))) || null; };
  const fmtIban = v => String(v || '').replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();

  if (!document.getElementById('afStyle')) {
    const s = document.createElement('style'); s.id = 'afStyle';
    s.textContent = `
      .af { max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
      .af-steps { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; }
      .af-steps span { height: 6px; border-radius: 3px; background: var(--line); }
      .af-steps span.on { background: var(--brand); }
      .af-card { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 22px; box-shadow: var(--shadow); }
      .af-card h2 { margin: 0 0 4px; font-size: 22px; line-height: 28px; }
      .af-card .af-sub { margin: 0 0 18px; color: var(--muted); font-size: 15px; line-height: 1.45; }
      .af-grid { display: grid; grid-template-columns: repeat(var(--c, 2), minmax(0, 1fr)); gap: 14px 16px; }
      .af-grid .w2 { grid-column: span 2; } .af-grid .wall { grid-column: 1 / -1; }
      .af label.af-f { display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 600; color: var(--muted); }
      .af input:not([type=checkbox]):not([type=radio]), .af select { height: 52px; border: 1px solid var(--line); border-radius: 12px; padding: 0 14px; font-size: 17px; background: var(--field); color: var(--ink); width: 100%; box-sizing: border-box; font-family: inherit; }
      .af input:focus, .af select:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
      .af-person { border: 1px solid var(--line); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .af-person + .af-person { margin-top: 12px; }
      .af-person .af-ph { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-weight: 800; min-height: 40px; }
      .af-btn { height: 52px; padding: 0 22px; border-radius: 14px; font-size: 17px; font-weight: 700; border: 1px solid var(--line); background: var(--card); color: var(--ink); cursor: pointer; font-family: inherit; }
      .af-btn.primary { background: var(--brand); border-color: var(--brand); color: #fff; }
      .af-btn.small { height: 40px; font-size: 15px; padding: 0 14px; border-radius: 10px; }
      .af-btn:disabled { opacity: .45; cursor: default; }
      .af-nav { display: flex; justify-content: space-between; gap: 12px; }
      .af-nav .af-btn { min-width: 160px; }
      .af-fees { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .af-fees label { display: flex; align-items: center; gap: 12px; padding: 0 16px; min-height: 64px; border: 1px solid var(--line); border-radius: 14px; font-size: 16px; cursor: pointer; box-sizing: border-box; }
      .af-fees label:has(input:checked) { border-color: var(--brand); background: var(--brand-soft); box-shadow: inset 0 0 0 1px var(--brand); }
      .af-fees label b { margin-left: auto; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .af-fees label .af-hint { display: block; font-size: 12.5px; color: var(--muted); font-weight: 600; }
      .af input[type=radio], .af input[type=checkbox] { width: 22px; height: 22px; accent-color: var(--brand); flex: none; }
      .af-h3 { margin: 22px 0 4px; font-size: 17px; }
      .af-deps { display: flex; flex-direction: column; gap: 10px; }
      .af-dep { border: 1px solid var(--line); border-radius: 14px; padding: 12px 16px; }
      .af-dh { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; flex-wrap: wrap; margin-bottom: 8px; } .af-dh b { font-size: 16px; } .af-dh span { color: var(--muted); font-size: 13.5px; }
      .af-dp { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
      .af-dp label { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 12px; border: 1px solid var(--line); border-radius: 12px; font-size: 15px; cursor: pointer; box-sizing: border-box; }
      .af-dp label:has(input:checked) { border-color: var(--brand); background: var(--brand-soft); }
      .af-dp label b { margin-left: auto; font-variant-numeric: tabular-nums; } .af-dp label:has(input:disabled) { opacity: .5; }
      .af-cons { display: flex; flex-direction: column; gap: 12px; }
      .af-cons label { display: flex; gap: 14px; align-items: flex-start; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; font-size: 15px; line-height: 1.45; cursor: pointer; }
      .af-cons label:has(input:checked) { border-color: var(--brand); background: var(--brand-soft); }
      .af-cons b { display: block; margin-bottom: 2px; }
      .af-info { font-size: 14px; color: var(--muted); line-height: 1.5; margin: 12px 0 0; }
      .af-err { min-height: 22px; color: var(--red); font-weight: 700; font-size: 15px; }
      .af-sum { display: grid; grid-template-columns: 180px 1fr; gap: 8px 16px; font-size: 15px; }
      .af-sum dt { color: var(--muted); } .af-sum dd { margin: 0; font-weight: 600; }
      .af-sig { display: flex; flex-direction: column; gap: 8px; }
      .af-sig + .af-sig { margin-top: 18px; }
      .af-sig .af-sh { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-weight: 800; }
      .af-pad { position: relative; height: 190px; border: 2px dashed var(--green-line, var(--line)); border-radius: 16px; background: #fff; touch-action: none; overflow: hidden; }
      .af-pad canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
      .af-pad .af-line { position: absolute; left: 24px; right: 24px; bottom: 44px; border-bottom: 1px solid #c9cfc9; pointer-events: none; }
      .af-pad .af-x { position: absolute; left: 24px; bottom: 50px; color: #9aa39b; font-size: 22px; pointer-events: none; }
      .af-pad .af-ph2 { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #9aa39b; font-size: 16px; pointer-events: none; }
      .af-pad.signed .af-ph2 { display: none; }
      .af-mandate { font-size: 13.5px; color: var(--muted); line-height: 1.5; background: var(--hover); border-radius: 12px; padding: 12px 14px; margin-top: 12px; }
      .af-done { text-align: center; padding: 34px 22px; }
      .af-done .af-ok { width: 76px; height: 76px; border-radius: 38px; background: var(--brand-soft); color: var(--brand); display: inline-flex; align-items: center; justify-content: center; font-size: 40px; margin-bottom: 12px; }
      .af-hp { position: absolute; left: -5000px; width: 1px; height: 1px; overflow: hidden; }
      @media (max-width: 640px) { .af-grid, .af-fees { grid-template-columns: 1fr; } .af-grid .w2 { grid-column: auto; } .af-card { padding: 16px; } .af-sum { grid-template-columns: 1fr; gap: 2px; } .af-sum dd { margin-bottom: 8px; } .af-nav .af-btn { min-width: 0; flex: 1; } }`;
    document.head.appendChild(s);
  }

  /** Unterschriftsfeld (Finger, Stift oder Maus) */
  function pad(box) {
    const cv = box.querySelector('canvas');
    const ctx = cv.getContext('2d');
    let drawing = false, strokes = 0, last = null, len = 0;
    const size = () => { const r = box.getBoundingClientRect(); const d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; };
    size();
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); drawing = true; last = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); });
    cv.addEventListener('pointermove', e => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); len += Math.hypot(p.x - last.x, p.y - last.y); last = p; if (len > 40) box.classList.add('signed'); });
    const end = () => { if (drawing) { drawing = false; strokes++; } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('pointerleave', end);
    return {
      clear() { ctx.clearRect(0, 0, cv.width, cv.height); strokes = 0; len = 0; box.classList.remove('signed'); },
      ok: () => strokes > 0 && len > 60,
      /** als PNG (weißer Hintergrund, auf 600 px Breite verkleinert) */
      png() {
        const w = 600, h = Math.round(600 * cv.height / cv.width);
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        const c = o.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(cv, 0, 0, w, h);
        return o.toDataURL('image/png');
      },
    };
  }

  function mount(el, o) {
    const cfg = o.cfg;
    const fixed = Boolean(o.prefill);    // Antrag aus der Verwaltung: nur prüfen, Einwilligungen, unterschreiben
    const d = fixed ? JSON.parse(JSON.stringify(o.prefill)) : { persons: [{ first_name: '', last_name: '', birth_date: '', gender: '' }], street: '', zip: '', city: '', email: '', mobile: '', fee_id: null, holder: '', iban: '', bic: '', bank: '', signer: '', consents: {} };
    d.consents = {};
    const STEPS = fixed ? ['check', 'consent', 'sign'] : ['persons', 'contact', 'fee', 'bank', 'consent', 'sign'];
    let step = 0;
    const started = Date.now();
    const fee = () => cfg.fees.find(f => f.id === +d.fee_id);
    const minor = () => ageAt(d.persons[0].birth_date, cfg.today) < 18;
    /** mehrere Personen → nur Familienbeitrag (falls vorhanden); eine Person → ohne Familienbeitrag */
    const feeOffer = () => { const fam = cfg.fees.filter(f => f.family); return d.persons.length > 1 ? (fam.length ? fam : cfg.fees) : cfg.fees.filter(f => !f.family); };

    const nav = (back, next, nextLabel = 'Weiter') => `<div class="af-err" id="afErr"></div><div class="af-nav"><button class="af-btn" id="afBack">${back}</button><button class="af-btn primary" id="afNext">${nextLabel}</button></div>`;
    const field = (label, k, attrs = '', cls = '') => `<label class="af-f ${cls}">${label}<input data-k="${k}" value="${esc(d[k] || '')}" ${attrs}></label>`;
    const personHtml = (p, i) => `<div class="af-person" data-i="${i}"><div class="af-ph"><span>${i === 0 ? 'Antragsteller/in' : `Weitere Person ${i}`}</span>${i ? `<button class="af-btn small" data-rm="${i}">Entfernen</button>` : ''}</div>
      <div class="af-grid" style="--c:2">
        <label class="af-f">Vorname<input data-p="first_name" value="${esc(p.first_name)}" autocomplete="off"></label><label class="af-f">Nachname<input data-p="last_name" value="${esc(p.last_name)}" autocomplete="off"></label>
        <label class="af-f">Geburtsdatum<input data-p="birth_date" type="date" value="${esc(p.birth_date)}" max="${cfg.today}"></label>
        ${i === 0 ? `<label class="af-f">Geschlecht<select data-p="gender"><option value="">– bitte wählen –</option>${[['w', 'weiblich'], ['m', 'männlich'], ['d', 'divers']].map(([k, l]) => `<option value="${k}" ${p.gender === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`
          : `<label class="af-f">Rolle<select data-p="role"><option value="partner" ${p.role === 'partner' ? 'selected' : ''}>Partner/in</option><option value="kind" ${p.role !== 'partner' ? 'selected' : ''}>Kind</option></select></label>`}
      </div></div>`;
    const readPersons = () => el.querySelectorAll('.af-person').forEach(box => { const p = d.persons[+box.dataset.i]; box.querySelectorAll('[data-p]').forEach(i => { p[i.dataset.p] = i.value.trim(); }); });
    const readFields = () => el.querySelectorAll('[data-k]').forEach(i => { d[i.dataset.k] = i.value.trim(); });
    const err = t => { const e = el.querySelector('#afErr'); if (e) e.textContent = t || ''; return !t; };

    function check() {
      const k = STEPS[step];
      if (k === 'persons') {
        readPersons();
        for (const [i, p] of d.persons.entries()) {
          const who = i ? `Person ${i + 1}` : 'Bitte';
          if (!p.first_name || p.last_name.length < 2) return err(`${who}: Vor- und Nachname eintragen.`);
          if (!p.birth_date) return err(`${who}: Geburtsdatum eintragen.`);
          if (i > 0 && p.role !== 'partner' && ageAt(p.birth_date, cfg.today) > (cfg.child_max || 18)) return err(`${p.first_name}: Kinder lassen sich bis ${cfg.child_max || 18} Jahre mit anmelden – ältere bitte mit einer eigenen Beitrittserklärung.`);
        }
        if (!d.holder) d.holder = `${d.persons[0].first_name} ${d.persons[0].last_name}`;
      }
      if (k === 'contact') { readFields(); if (d.street.length < 3 || d.zip.length < 4 || d.city.length < 2) return err('Bitte die vollständige Anschrift eintragen.'); if (!d.email && !d.mobile) return err('Bitte E-Mail-Adresse oder Mobilnummer angeben.'); if (d.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(d.email)) return err('Die E-Mail-Adresse sieht nicht richtig aus.'); }
      if (k === 'fee') {
        const c = el.querySelector('[name=afFee]:checked'); if (!c) return err('Bitte eine Mitgliedschaft wählen.'); d.fee_id = +c.value;
        d.persons.forEach(p => { p.departments = []; });
        el.querySelectorAll('[data-dep]:checked').forEach(x => d.persons[+x.dataset.pi].departments.push(+x.dataset.dep));
      }
      if (k === 'bank') { readFields(); if (d.holder.length < 3) return err('Bitte den Kontoinhaber eintragen.'); if (d.iban.replace(/\s/g, '').length < 15) return err('Bitte die IBAN eintragen.'); if (minor() && d.signer.length < 3) return err('Bei Minderjährigen unterschreibt ein gesetzlicher Vertreter – bitte den Namen eintragen.'); }
      if (k === 'consent') {
        d.consents = {}; el.querySelectorAll('[data-c]').forEach(c => { if (c.checked) d.consents[c.dataset.c] = true; });
        const miss = cfg.consents.find(c => c.required && !d.consents[c.key]); if (miss) return err(`Bitte „${miss.short}“ bestätigen – ohne geht es nicht.`);
      }
      return err('');
    }

    function render() {
      const k = STEPS[step];
      const bar = `<div class="af-steps" style="--n:${STEPS.length}">${STEPS.map((_, i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('')}</div>`;
      let h = '';
      if (k === 'persons') h = `<h2>Wer möchte Mitglied werden?</h2><p class="af-sub">${esc(cfg.intro || `Schön, dass du zum ${cfg.club.name} kommen möchtest!`)} Für eine Familienmitgliedschaft Partner/in und Kinder (bis ${cfg.child_max || 18} Jahre) dazunehmen – dann zahlt die erste Person für alle.</p>
        <div id="afPersons">${d.persons.map(personHtml).join('')}</div><div style="margin-top:12px"><button class="af-btn small" id="afAdd">+ Person hinzufügen (Familie)</button></div>`;
      if (k === 'contact') h = `<h2>Anschrift & Kontakt</h2><p class="af-sub">Gilt für alle angemeldeten Personen. An die E-Mail-Adresse schicken wir die Bestätigung.</p>
        <div class="af-grid" style="--c:3">${field('Straße und Hausnummer', 'street', 'autocomplete="street-address"', 'wall')}${field('PLZ', 'zip', 'inputmode="numeric" maxlength="10"', '')}${field('Ort', 'city', '', 'w2')}
          ${field('E-Mail', 'email', 'type="email" autocomplete="email"', 'w2')}${field('Mobil', 'mobile', 'type="tel"', '')}</div>`;
      if (k === 'fee') {
        const a = ageAt(d.persons[0].birth_date, cfg.today), fam = d.persons.length > 1;
        const offer = feeOffer();
        if (d.fee_id && !offer.some(f => f.id === +d.fee_id)) d.fee_id = null;
        if (!d.fee_id && offer.length === 1) d.fee_id = offer[0].id;
        h = `<h2>Mitgliedschaft und Jahresbeitrag</h2><p class="af-sub">${fam ? 'Ihr meldet mehrere Personen an – der Familienbeitrag gilt für alle zusammen.' : 'Bitte die passende Mitgliedschaft wählen.'}</p>
          <div class="af-fees">${offer.map(f => { const fits = (f.age_min == null || a >= f.age_min) && (f.age_max == null || a <= f.age_max); return `<label><input type="radio" name="afFee" value="${f.id}" ${+d.fee_id === f.id ? 'checked' : ''}><span><span translate="no">${esc(f.name)}</span>${!fits && !f.family ? '<span class="af-hint">passt nicht zum Alter</span>' : ''}</span><b>${euro(f.cents)}</b></label>`; }).join('')}</div>
          ${(cfg.departments || []).length ? `<h3 class="af-h3">Abteilungen</h3><p class="af-sub" style="margin-bottom:12px">Wer macht zusätzlich in einer Abteilung mit? Der Zusatzbeitrag gilt je Person, zusätzlich zum Beitrag oben.</p>
            <div class="af-deps">${cfg.departments.map(dep => `<div class="af-dep"><div class="af-dh"><b translate="no">${esc(dep.name)}</b><span translate="no">${dep.fees.map(f => `${esc(f.name)} ${euro(f.cents)}`).join(' · ')}</span></div>
              <div class="af-dp">${d.persons.map((p, i) => { const f = deptFee(dep, p.birth_date); return `<label><input type="checkbox" data-dep="${dep.id}" data-pi="${i}" ${(p.departments || []).includes(dep.id) ? 'checked' : ''} ${f ? '' : 'disabled'}><span>${esc(p.first_name)}</span><b translate="no">${f ? euro(f.cents) : '–'}</b></label>`; }).join('')}</div></div>`).join('')}</div>` : ''}
          ${cfg.due_text ? `<p class="af-info">${esc(cfg.due_text)}</p>` : ''}${cfg.work_text ? `<p class="af-info">${esc(cfg.work_text)}</p>` : ''}`;
      }
      if (k === 'bank') h = `<h2>SEPA-Lastschriftmandat</h2><p class="af-sub">Der Beitrag wird bequem per Lastschrift eingezogen.</p>
        <div class="af-grid" style="--c:2">${field('Kontoinhaber/in', 'holder', 'autocomplete="name"', 'wall')}${field('IBAN', 'iban', 'autocomplete="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:.04em"', 'wall')}
          ${field('BIC (bei deutschen Konten nicht nötig)', 'bic', 'autocomplete="off"')}${field('Kreditinstitut (optional)', 'bank')}
          ${minor() ? field('Name des gesetzlichen Vertreters (unterschreibt)', 'signer', '', 'wall') : ''}</div><div class="af-info" id="afIbanInfo"></div>`;
      if (k === 'check') {
        const f = fee();
        h = `<h2>Bitte prüfen</h2><p class="af-sub">Diese Angaben hat der Vorstand für dich vorbereitet. Stimmt etwas nicht, bitte kurz Bescheid geben.</p>
          <dl class="af-sum"><dt>Personen</dt><dd>${d.persons.map(p => `${esc(p.first_name)} ${esc(p.last_name)} (${deD(p.birth_date)})`).join('<br>')}</dd>
            <dt>Anschrift</dt><dd>${esc(d.street)}, ${esc(d.zip)} ${esc(d.city)}</dd><dt>Kontakt</dt><dd>${esc([d.email, d.mobile].filter(Boolean).join(' · '))}</dd>
            <dt>Mitgliedschaft</dt><dd>${f ? `${esc(f.name)} – ${euro(f.cents)}` : '–'}</dd>
            ${d.persons.some(p => (p.departments || []).length) ? `<dt>Abteilungen</dt><dd>${d.persons.filter(p => (p.departments || []).length).map(p => `${esc(p.first_name)}: ${p.departments.map(id => { const dep = (cfg.departments || []).find(x => x.id === id); const df = dep && deptFee(dep, p.birth_date); return dep ? `${esc(dep.name)}${df ? ' ' + euro(df.cents) : ''}` : ''; }).join(', ')}`).join('<br>')}</dd>` : ''}<dt>Konto</dt><dd>${esc(d.holder)} · ${esc(fmtIban(d.iban))}</dd></dl>
          ${cfg.due_text ? `<p class="af-info">${esc(cfg.due_text)}</p>` : ''}`;
      }
      if (k === 'consent') h = `<h2>Einverständnis</h2><p class="af-sub">Bitte lesen und ankreuzen.${cfg.satzung_url ? ` Die <a href="${esc(cfg.satzung_url)}" target="_blank" rel="noopener">Satzung</a> gibt es online.` : ''}</p>
        <div class="af-cons">${cfg.consents.map(c => `<label><input type="checkbox" data-c="${esc(c.key)}" ${d.consents[c.key] ? 'checked' : ''}><span><b>${esc(c.short)}${c.required ? ' (erforderlich)' : ' (freiwillig)'}</b>${esc(c.text)}</span></label>`).join('')}</div>`;
      if (k === 'sign') {
        const who = minor() ? (d.signer || 'gesetzlicher Vertreter') : `${d.persons[0].first_name} ${d.persons[0].last_name}`;
        h = `<h2>Unterschreiben</h2><p class="af-sub">Mit dem Finger oder Stift in die Felder schreiben.</p>
          <div class="af-sig"><div class="af-sh"><span>Beitrittserklärung – ${esc(who)}</span><button class="af-btn small" data-clr="0">Löschen</button></div><div class="af-pad" id="afPad0"><canvas></canvas><span class="af-line"></span><span class="af-x">✕</span><span class="af-ph2">Hier unterschreiben</span></div></div>
          <div class="af-sig"><div class="af-sh"><span>SEPA-Mandat – ${esc(d.holder)}</span><button class="af-btn small" data-clr="1">Löschen</button></div><div class="af-pad" id="afPad1"><canvas></canvas><span class="af-line"></span><span class="af-x">✕</span><span class="af-ph2">Hier unterschreiben (Kontoinhaber/in)</span></div>
            <div class="af-mandate">Ich ermächtige den ${esc(cfg.club.name)}${cfg.club.ci ? ` (Gläubiger-ID ${esc(cfg.club.ci)})` : ''}, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die vom Verein auf mein Konto gezogenen Lastschriften einzulösen. Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Die Mandatsreferenz wird mit der Bestätigung mitgeteilt.</div></div>
          ${o.mode === 'online' ? '<div class="af-hp" aria-hidden="true"><label>Website<input name="website" id="afHp" tabindex="-1" autocomplete="off"></label></div>' : ''}`;
      }
      const last = step === STEPS.length - 1;
      el.innerHTML = `<div class="af">${bar}<div class="af-card">${h}</div>${nav(step === 0 ? 'Abbrechen' : 'Zurück', null, last ? 'Verbindlich absenden' : 'Weiter')}</div>`;
      bind(k);
      const first = el.querySelector('.af-card input:not([type=radio]):not([type=checkbox])'); if (first && o.mode !== 'tablet' && k !== 'sign') first.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    let pads = [];
    function bind(k) {
      el.querySelector('#afBack').onclick = () => { if (step === 0) { if (o.onCancel) o.onCancel(); return; } if (STEPS[step] === 'persons') readPersons(); else if (['contact', 'bank'].includes(STEPS[step])) readFields(); step--; render(); };
      el.querySelector('#afNext').onclick = () => { if (!check()) return; if (step === STEPS.length - 1) return submit(); step++; render(); };
      if (k === 'persons') {
        el.querySelector('#afAdd').onclick = () => { readPersons(); if (d.persons.length >= 8) return; d.persons.push({ first_name: '', last_name: d.persons[0].last_name, birth_date: '', role: d.persons.length === 1 ? 'partner' : 'kind' }); render(); };
        el.querySelectorAll('[data-rm]').forEach(b => { b.onclick = () => { readPersons(); d.persons.splice(+b.dataset.rm, 1); render(); }; });
      }
      if (k === 'bank') {
        const inp = el.querySelector('[data-k=iban]'); let t;
        inp.oninput = () => { clearTimeout(t); t = setTimeout(async () => { const v = inp.value.replace(/\s/g, ''); const info = el.querySelector('#afIbanInfo'); if (v.length < 15) { info.textContent = ''; return; } try { const r = await o.post('iban', { iban: v }); info.textContent = r.ok ? `✓ IBAN gültig: ${r.formatted}` : r.error; info.style.color = r.ok ? 'var(--brand-ink)' : 'var(--red)'; } catch (e) { /* egal */ } }, 400); };
      }
      if (k === 'sign') {
        pads = [pad(el.querySelector('#afPad0')), pad(el.querySelector('#afPad1'))];
        el.querySelectorAll('[data-clr]').forEach(b => { b.onclick = () => pads[+b.dataset.clr].clear(); });
      }
    }

    async function submit() {
      if (!pads[0].ok() || !pads[1].ok()) return err('Bitte beide Felder unterschreiben.');
      const btn = el.querySelector('#afNext'); btn.disabled = true; btn.textContent = 'Wird gesendet …';
      const body = { sig_member: pads[0].png(), sig_mandate: pads[1].png() };
      try {
        let r;
        if (fixed) r = await o.post('antrag/sign', { code: o.code, consents: d.consents, ...body });
        else r = await o.post('antrag', { data: { ...d, iban: d.iban.replace(/\s/g, '') }, ...body, ...(o.mode === 'online' ? { t: cfg.t || started, website: (el.querySelector('#afHp') || {}).value || '' } : {}) });
        done(r);
      } catch (e) { btn.disabled = false; btn.textContent = 'Verbindlich absenden'; err(e.message); }
    }
    function done(r) {
      el.innerHTML = `<div class="af"><div class="af-card af-done"><div class="af-ok">✓</div><h2>Vielen Dank!</h2>
        <p class="af-sub" style="margin:8px auto 0;max-width:520px">${r && r.auto ? 'Willkommen im Verein! Die Mitgliedschaft ist eingetragen.' : 'Deine Beitrittserklärung ist angekommen. Der Vorstand bestätigt sie in den nächsten Tagen.'} ${d.email ? 'Die Bestätigung mit Mitgliedsnummer und Mandatsreferenz kommt per E-Mail.' : ''}</p>${o.mode === 'tablet' ? '<p style="margin:22px 0 0"><button class="af-btn primary" id="afFin">Fertig</button></p>' : ''}</div></div>`;
      const fin = el.querySelector('#afFin'); if (fin && o.onCancel) fin.onclick = o.onCancel;
      if (o.onDone) o.onDone(r);
    }
    render();
    return { reset: () => { step = 0; render(); } };
  }
  window.Antrag = { mount, pad };
})();
