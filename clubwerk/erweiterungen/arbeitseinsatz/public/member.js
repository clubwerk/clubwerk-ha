'use strict';
/* Bereich „Dienste“ in der Mitglieder-App (Modul Helferdienste): Dienstpläne mit Schichten, Termine, eigene Arbeitsstunden, Stunden melden; Reiter „Termine“ mit Zu- und Absage */
(() => {
  if (!document.getElementById('dsStyle')) {
    const s = document.createElement('style'); s.id = 'dsStyle';
    s.textContent = `
      .ds-sh { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid var(--line); }
      h3 + .ds-sh, .vh-lead + .ds-sh, .vh-seg + .ds-sh { border-top: 0; padding-top: 2px; } .ds-sh:last-child { padding-bottom: 0; } .ds-sh.me { box-shadow: inset 3px 0 0 var(--brand); padding-left: 10px; margin-left: -10px; }
      .ds-t { width: 48px; font-family: var(--num); font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.25; text-align: center; }
      .ds-sh strong { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 15px; line-height: 1.3; }
      .ds-sh small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 3px; line-height: 1.35; }
      .ds-ans { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; } .ds-tm .vh-lead { margin: 8px 0 0; } .ds-tm h3 { align-items: center; }
      .ds-faces { display: flex; margin: 5px 0 0 2px; } .ds-faces img { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 2px solid var(--card); margin-left: -4px; }`;
    document.head.appendChild(s);
  }
  const HF = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }), EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });   // einmal anlegen statt je Zeile
  const hh = m => `${HF.format((m || 0) / 60)} h`;
  const euro = c => EUR.format((c || 0) / 100);
  const deD = d => (d ? d.split('-').reverse().join('.') : '');
  const ST = { offen: ['a', 'wird geprüft'], bestaetigt: ['g', 'bestätigt'], abgelehnt: ['', 'abgelehnt'], laeuft: ['', 'läuft'] };
  const KIND = { arbeit: 'Arbeitseinsatz', theke: 'Thekendienst', dienst: 'Dienst', sonstiges: 'Einsatz' };
  const WDS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const wd = (d, long) => (long ? WDL : WDS)[new Date(d + 'T12:00:00').getDay()];
  const when = e => (e.start ? (e.end ? `${e.start}–${e.end}` : `ab ${e.start}`) : 'ganztags');
  const short = n => { const w = String(n || '').trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : w[0]; };

  window.VA.registerSection({
    id: 'arbeitseinsatz',
    render(el, ctx) {
      const { esc } = ctx;
      const close = () => { const s = document.getElementById('dsSheet'); if (s) s.classList.remove('show'); };
      ctx.onLeave(close);
      let d_contact = '';
      const sel = {};   // gewählter Tag je Dienstplan
      let tab = ctx.focus === 'termin' ? 'termine' : 'dienste';   // Reiter „Dienste“ | „Termine“ (aus „Für mich“: gleich die Termine)
      let focus = ctx.focus || '';   // aus „Für mich“ („frei“): zum ersten freien Dienst scrollen (nur beim ersten Laden)
      const sheet = () => { let sh = document.getElementById('dsSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'dsSheet'; sh.className = 'vh-sheet vh-form'; document.body.appendChild(sh); } return sh; };
      async function load() {
        let d; try { d = await ctx.api('me'); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        window.__dsToday = d.today; d_contact = d.contact;
        if (!d.termine.length) tab = 'dienste';
        const pct = d.target ? Math.min(100, Math.round(d.done / d.target * 100)) : 100;
        const miss = Math.max(0, d.target - d.done);
        // Solange Stunden fehlen, steht das Offene im Vordergrund; danach kein Zielstrich („Geschafft“), nur Dank – die Dienste rücken nach oben
        const met = Boolean(d.target) && !miss;
        const hours = `<div class="vh-card"><h3>Arbeitsstunden ${esc(d.year)}${d.family ? '<span class="vh-chip">Familie</span>' : ''}</h3>
            ${!d.target ? `<p class="vh-lead">Für dich ist kein Soll hinterlegt${d.mine && d.mine.why ? ` (${esc(d.mine.why)})` : ''}. Mithelfen ist trotzdem willkommen!</p>`
              : miss ? `<div class="vh-big"><b>${hh(miss)}</b><span>noch offen</span></div><div class="vh-prog"><i style="width:${pct}%"></i></div>
              <p class="vh-lead">${hh(d.done)} von ${hh(d.target)} geleistet – bitte bis ${deD(d.to)}${d.rate_cents ? `, danach ${euro(d.rate_cents)} je fehlender Stunde` : ''}.${d.open ? ` ${hh(d.open)} werden noch geprüft.` : ''}</p>`
              : `<div class="vh-big"><b>${hh(d.done)}</b><span>geleistet – danke!</span></div>
              ${d.open ? `<p class="vh-lead" style="margin-top:8px">${hh(d.open)} werden noch geprüft.</p>` : ''}`}
            ${d.text ? `<p class="vh-lead" style="margin-top:8px">${esc(d.text)}</p>` : ''}</div>`;
        const duties = `${mineHtml(d)}${d.plans.map(planHtml).join('')}
          ${d.events.length || !d.plans.length ? `<div class="vh-card"><h3>${d.plans.length ? 'Weitere Termine' : 'Termine'}</h3>${d.events.length ? d.events.map(e => shiftHtml(e, true)).join('') : '<p class="vh-none">Gerade keine Termine geplant.</p>'}</div>` : ''}`;
        const openT = d.termine.filter(t => !t.answer && t.can).length;
        const seg = d.termine.length ? `<div class="vh-seg"><button data-tab="dienste" class="${tab === 'dienste' ? 'on' : ''}">Dienste</button><button data-tab="termine" class="${tab === 'termine' ? 'on' : ''}">Termine${openT ? ` (${openT})` : ''}</button></div>` : '';
        el.innerHTML = tab === 'termine' ? seg + d.termine.map(termHtml).join('') : `${seg}${met ? duties + hours : hours + duties}
          <div class="vh-card"><h3>Meine Stunden${d.report ? '<button id="dsRep">Stunden melden</button>' : ''}</h3><div class="vh-rows">${d.entries.length ? d.entries.map(x => `<div><span><span translate="no">${esc(x.text || '')}</span><small>${deD(x.date)}${d.family ? ' · ' + esc(x.name) : ''}<span class="vh-chip ${(ST[x.status] || [''])[0]}">${esc((ST[x.status] || ['', x.status])[1])}</span>${x.reason ? ' ' + esc(x.reason) : ''}</small></span><b class="num">${x.minutes ? hh(x.minutes) : '–'}</b></div>`).join('') : '<p class="vh-none">Noch keine Stunden in diesem Jahr.</p>'}</div></div>`;
        el.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { tab = b.dataset.tab; load(); }; });
        el.querySelectorAll('[data-ans]').forEach(b => { b.onclick = () => answer(d.termine.find(x => x.id === +b.dataset.t), b.dataset.ans); });
        const all = [...d.events, ...d.plans.flatMap(p => p.shifts)];
        el.querySelectorAll('[data-ev]').forEach(b => { b.onclick = async () => {
          const e = all.find(x => x.id === +b.dataset.ev);
          if (b.dataset.on === '1') return leave(e, d);
          try { await ctx.api('signup', 'POST', { event_id: e.id }); ctx.toast('Eingetragen – danke! Du bekommst am Vortag eine Erinnerung.'); load(); } catch (x) { ctx.toast(x.message, true); }
        }; });
        el.querySelectorAll('[data-pd]').forEach(b => { b.onclick = () => { sel[b.dataset.pl] = b.dataset.pd; load(); }; });
        const rep = document.getElementById('dsRep'); if (rep) rep.onclick = () => report(d);
        if (focus === 'frei') { const f = el.querySelector('[data-ev][data-on="0"]:not([disabled])'); if (f) f.closest('.ds-sh').scrollIntoView({ block: 'center' }); }
        focus = '';
      }
      function termHtml(t) {
        const chip = t.answer === 'ja' ? `<span class="vh-chip g">du kommst${t.persons > 1 ? ` (${t.persons} Personen)` : ''}</span>` : t.answer === 'nein' ? '<span class="vh-chip">du kommst nicht</span>' : t.can ? '<span class="vh-chip a">Antwort fehlt</span>' : '';
        const count = t.persons_total ? `bisher ${t.persons_total} ${t.persons_total === 1 ? 'Person' : 'Personen'} zugesagt${t.free != null ? ` · noch ${t.free} ${t.free === 1 ? 'Platz' : 'Plätze'} frei` : ''}` : (t.free != null ? `${t.free} ${t.free === 1 ? 'Platz' : 'Plätze'} frei` : '');
        return `<div class="vh-card ds-tm"><h3><span translate="no">${esc(t.title)}</span>${chip}</h3>
          <div class="ds-sh" style="border-top:0;padding:2px 0 0"><span class="vh-date"><b>${t.date.slice(8, 10)}.${t.date.slice(5, 7)}.</b><span>${wd(t.date)}</span></span>
            <div style="min-width:0"><strong>${esc(`${wd(t.date, true)}, ${deD(t.date)}`)}</strong><small>${esc([when(t), t.place].filter(Boolean).join(' · '))}</small>${t.note ? `<small>${esc(t.note)}</small>` : ''}</div><span></span></div>
          ${count ? `<p class="vh-lead">${esc(count)}</p>` : ''}
          ${t.can ? `${t.deadline ? `<p class="vh-lead">Antwort bis ${deD(t.deadline)}</p>` : ''}<div class="ds-ans"><button class="vh-btn sm${t.answer === 'ja' ? '' : ' sec'}" data-t="${t.id}" data-ans="ja">${t.answer === 'ja' ? 'Ich komme ✓' : 'Ich komme'}</button><button class="vh-btn sm${t.answer === 'nein' ? '' : ' sec'}" data-t="${t.id}" data-ans="nein">${t.answer === 'nein' ? 'Ich komme nicht ✓' : 'Ich komme nicht'}</button></div>`
            : `<p class="vh-lead">Die Antwortfrist ist abgelaufen${t.answer ? '' : ' – du hast nicht geantwortet'}. Änderungen bitte über ${d_contact ? esc(d_contact) : 'den Verein'}.</p>`}</div>`;
      }
      function answer(t, a) {
        if (a === 'nein') return post(t, { event_id: t.id, answer: 'nein', note: t.my_note }, 'Abgesagt – danke für die Antwort.');
        const sh = sheet();
        sh.innerHTML = `<div class="vh-box"><h2>Ich komme</h2><p><span translate="no">${esc(t.title)}</span> · ${wd(t.date, true)}, ${deD(t.date)}</p>
          <label>Wie viele Personen kommen? (mit dir)</label><input class="vh-input" id="dsP" type="number" inputmode="numeric" min="1" max="10" value="${t.persons || 1}">
          <label>Anmerkung (freiwillig)</label><input class="vh-input" id="dsN" maxlength="100" value="${esc(t.my_note)}" placeholder="z. B. Vegetarier dabei"><div class="vh-err" id="dsE"></div>
          <div class="vh-row"><button class="no" id="dsNo">Abbrechen</button><button class="ok" id="dsOk">Zusagen</button></div></div>`;
        sh.classList.add('show');
        sh.querySelector('#dsNo').onclick = close;
        sh.querySelector('#dsOk').onclick = () => post(t, { event_id: t.id, answer: 'ja', persons: sh.querySelector('#dsP').value, note: sh.querySelector('#dsN').value }, 'Zugesagt – danke!', sh.querySelector('#dsE'));
      }
      async function post(t, body, msg, errEl) {
        try { await ctx.api('answer', 'POST', body); close(); ctx.toast(msg); load(); } catch (x) { if (errEl) errEl.textContent = x.message; else ctx.toast(x.message, true); }
      }
      function shiftHtml(e, withDate) {
        const over = e.open === false, full = e.slots && e.taken >= e.slots && !e.mine;
        const st = e.slots ? (e.taken >= e.slots ? ['g', 'voll'] : ['a', `${e.slots - e.taken} frei`]) : ['', `${e.taken} dabei`];
        return `<div class="ds-sh${e.mine ? ' me' : ''}">${withDate ? `<span class="vh-date"><b>${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.</b><span>${wd(e.date)}</span></span>` : `<div class="ds-t">${esc(when(e)).replace('–', '–<br>')}</div>`}
          <div style="min-width:0"><strong><span translate="no">${esc(e.title)}</span><span class="vh-chip ${st[0]}">${esc(st[1])}</span>${e.mine ? '<span class="vh-chip g">du bist dabei</span>' : ''}</strong>${withDate ? `<small>${esc([when(e), e.place].filter(Boolean).join(' · '))}</small>` : ''}
            ${e.faces && e.faces.length ? `<span class="ds-faces">${e.faces.slice(0, 8).map(f => `<img data-auth-src="api/photo/of/${f.id}?u=helfer&v=${esc(f.v)}" alt="">`).join('')}</span>` : ''}${e.helpers.length ? `<small translate="no">${esc(e.helpers.map(short).join(', '))}</small>` : ''}${e.note ? `<small>${esc(e.note)}</small>` : ''}</div>
          ${over ? '<button class="vh-btn sm sec" disabled>vorbei</button>' : `<button data-ev="${e.id}" data-on="${e.mine ? 1 : 0}" class="vh-btn sm${e.mine ? ' sec' : ''}" ${full ? 'disabled' : ''}>${e.mine ? 'Austragen' : full ? 'voll' : 'Ich helfe'}</button>`}</div>`;
      }
      function planHtml(p) {
        const days = [...new Set(p.shifts.map(e => e.date))];
        if (!sel[p.id] || !days.includes(sel[p.id])) sel[p.id] = days.find(x => x >= (window.__dsToday || '')) || days[0];
        const sh = p.shifts.filter(e => e.date === sel[p.id]);
        return `<div class="vh-card"><h3 style="margin-bottom:2px" translate="no">${esc(p.title)}</h3><p class="vh-lead">${esc([p.from_date === p.to_date ? `${wd(p.from_date, true)}, ${deD(p.from_date)}` : `${deD(p.from_date)} – ${deD(p.to_date)}`, p.place].filter(Boolean).join(' · '))}</p>
          ${p.note ? `<p class="vh-lead" style="margin:0 0 8px">${esc(p.note)}</p>` : ''}
          ${days.length > 1 ? `<div class="vh-seg">${days.map(x => `<button data-pl="${p.id}" data-pd="${x}" class="${x === sel[p.id] ? 'on' : ''}">${wd(x)} ${+x.slice(8, 10)}.${+x.slice(5, 7)}.</button>`).join('')}</div>` : ''}
          ${sh.length ? sh.map(e => shiftHtml(e, false)).join('') : '<p class="vh-none">Noch keine Schichten.</p>'}</div>`;
      }
      function mineHtml(d) {
        const list = [...d.events.map(e => ({ ...e, plan: null })), ...d.plans.flatMap(p => p.shifts.map(e => ({ ...e, plan: p.title })))].filter(e => e.mine && e.open !== false).sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
        if (!list.length) return '';
        return `<div class="vh-card"><h3>Meine Dienste</h3><div class="vh-rows">${list.map(e => `<div><span><span translate="no">${esc(e.title)}</span><small>${esc([e.plan, `${wd(e.date, true)}, ${deD(e.date)}`].filter(Boolean).join(' · '))}</small></span><b class="num">${esc(when(e))}</b></div>`).join('')}</div></div>`;
      }
      function leave(e, d) {
        const sh = sheet();
        sh.innerHTML = e.canLeave ? `<div class="vh-box"><h2>Austragen?</h2><p>${esc(e.title)} · ${wd(e.date, true)}, ${deD(e.date)} · ${esc(when(e))}<br>Die Verwaltung bekommt eine kurze Nachricht.</p><div class="vh-err" id="dsE"></div>
            <div class="vh-row"><button class="no" id="dsNo">Doch dabei</button><button class="ok" id="dsOk" style="background:var(--red);border-color:var(--red)">Austragen</button></div></div>`
          : `<div class="vh-box"><h2>Austragen nicht mehr möglich</h2><p>In der App geht das nur bis ${d.cancel_h} Stunden vor Beginn. Bitte melde dich${d.contact ? ` bei <b>${esc(d.contact)}</b>` : ' beim Verein'} – dort wirst du ausgetragen.</p>
            <div class="vh-row"><button class="ok" id="dsNo" style="flex:1">Verstanden</button></div></div>`;
        sh.classList.add('show');
        sh.querySelector('#dsNo').onclick = close;
        if (e.canLeave) sh.querySelector('#dsOk').onclick = async () => { try { await ctx.api('signup', 'POST', { event_id: e.id, remove: true }); close(); ctx.toast('Ausgetragen.'); load(); } catch (x) { sh.querySelector('#dsE').textContent = x.message; } };
      }
      function report(d) {
        const sh = sheet();
        const t = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        sh.innerHTML = `<div class="vh-box"><h2>Stunden melden</h2><p>Der Vorstand bestätigt die Stunden.</p>
          <label>Datum</label><input class="vh-input" type="date" id="dsD" value="${t}" max="${t}"><label>Dauer in Stunden</label><input class="vh-input" id="dsM" inputmode="decimal" placeholder="z. B. 2,5">
          <label>Was hast du gemacht?</label><input class="vh-input" id="dsT" maxlength="140"><div class="vh-err" id="dsE"></div>
          <div class="vh-row"><button class="no" id="dsNo">Abbrechen</button><button class="ok" id="dsOk">Melden</button></div></div>`;
        sh.classList.add('show');
        sh.querySelector('#dsNo').onclick = close;
        sh.querySelector('#dsOk').onclick = async () => {
          try { await ctx.api('report', 'POST', { date: sh.querySelector('#dsD').value, minutes: Math.round(Number(sh.querySelector('#dsM').value.replace(',', '.')) * 60), text: sh.querySelector('#dsT').value }); close(); ctx.toast('Gemeldet – danke!'); load(); }
          catch (e) { sh.querySelector('#dsE').textContent = e.message; }
        };
        void d;
      }
      el.innerHTML = '<div class="vh-empty">Lade …</div>';
      load();
    },
  });
})();
