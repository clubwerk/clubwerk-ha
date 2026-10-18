'use strict';
/* Bereich „Dienste“ in der Mitglieder-App (Modul Helferdienste): Dienstpläne mit Schichten, Termine, eigene Arbeitsstunden, Stunden melden */
(() => {
  if (!document.getElementById('dsStyle')) {
    const s = document.createElement('style'); s.id = 'dsStyle';
    s.textContent = `
      .ds-card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 16px 18px; box-shadow: var(--shadow); }
      .ds-card h3 { margin: 0 0 10px; font-size: 15px; font-weight: 800; display: flex; justify-content: space-between; align-items: center; }
      .ds-card h3 button { font: inherit; font-size: 13.5px; font-weight: 700; color: var(--brand-ink); background: none; border: 0; padding: 4px 0; }
      .ds-big { display: flex; align-items: baseline; gap: 8px; } .ds-big b { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; } .ds-big span { color: var(--muted); font-size: 15px; }
      .ds-bar { height: 10px; border-radius: 5px; background: var(--line); overflow: hidden; margin: 10px 0 8px; } .ds-bar i { display: block; height: 100%; background: var(--brand); border-radius: 5px; }
      .ds-sub { color: var(--muted); font-size: 13.5px; line-height: 1.45; margin: 0; }
      .ds-met { margin-top: 8px; }
      .ds-ev { display: grid; grid-template-columns: 62px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid var(--line); }
      .ds-ev:first-of-type { border-top: 0; padding-top: 2px; }
      .ds-d { width: 62px; height: 56px; border-radius: 14px; background: var(--brand-soft); color: var(--brand-ink); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; line-height: 1.05; }
      .ds-d b { font-size: 16px; letter-spacing: -.02em; } .ds-d span { font-size: 11px; text-transform: uppercase; }
      .ds-ev strong { display: block; font-size: 15px; } .ds-ev small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px; }
      .ds-ev button { min-height: 40px; min-width: 104px; border-radius: 12px; font: inherit; font-size: 14px; font-weight: 700; border: 1px solid var(--brand); background: var(--brand); color: #fff; padding: 0 12px; }
      .ds-ev button.sec { background: transparent; color: var(--ink); border-color: var(--line); } .ds-ev button:disabled { background: var(--hover); border-color: var(--line); color: var(--muted); }
      .ds-list > div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); font-size: 14.5px; }
      .ds-list > div:first-child { border-top: 0; padding-top: 2px; } .ds-list small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px; } .ds-list b { white-space: nowrap; }
      .ds-tag { display: inline-block; font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 9px; background: var(--hover); color: var(--muted); margin-left: 6px; }
      .ds-tag.a { background: var(--amber-soft); color: var(--amber); } .ds-tag.g { background: var(--brand-soft); color: var(--brand-ink); }
      .ds-card + .ds-card { margin-top: 12px; }
      .ds-ph { margin: 0 0 4px; font-size: 17px; font-weight: 800; } .ds-pm { color: var(--muted); font-size: 13px; margin: 0 0 10px; }
      .ds-days { display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: var(--hover); margin: 4px 0 6px; overflow-x: auto; scrollbar-width: none; }
      .ds-days button { flex: 1 0 auto; min-height: 40px; border-radius: 11px; border: 0; background: transparent; font: inherit; font-size: 13.5px; font-weight: 700; color: var(--muted); padding: 0 12px; white-space: nowrap; }
      .ds-days button.on { background: var(--card); color: var(--ink); box-shadow: var(--shadow); }
      .ds-sh { display: grid; grid-template-columns: 86px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid var(--line); }
      .ds-sh:first-of-type { border-top: 0; } .ds-sh.me { box-shadow: inset 3px 0 0 var(--brand); padding-left: 10px; margin-left: -10px; }
      .ds-t { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.25; } .ds-t small { display: block; font-weight: 600; color: var(--muted); font-size: 11.5px; white-space: nowrap; }
      .ds-sh strong { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 15px; } .ds-sh .ds-tag { margin-left: 0; }
      .ds-sh small.n { display: block; color: var(--muted); font-size: 12.5px; margin-top: 3px; line-height: 1.35; }
      .ds-sh button { min-height: 40px; min-width: 104px; border-radius: 12px; font: inherit; font-size: 14px; font-weight: 700; border: 1px solid var(--brand); background: var(--brand); color: #fff; padding: 0 12px; }
      .ds-sh button.sec { background: transparent; color: var(--ink); border-color: var(--line); } .ds-sh button:disabled { background: var(--hover); border-color: var(--line); color: var(--muted); }
      .ds-mine > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 14.5px; } .ds-mine > div:first-child { border-top: 0; padding-top: 2px; }
      .ds-mine small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px; } .ds-mine b { white-space: nowrap; font-variant-numeric: tabular-nums; }
      .ds-faces { display: flex; margin: 5px 0 0 2px; } .ds-faces img { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 2px solid var(--card); margin-left: -4px; }
      .ds-sheet .vh-box { max-width: 420px; text-align: left; } .ds-sheet label { display: block; font-size: 13px; font-weight: 700; color: var(--muted); margin: 0 0 4px; } .ds-sheet .vh-input { font-size: 16px; min-height: 48px; }`;
    document.head.appendChild(s);
  }
  const hh = m => `${((m || 0) / 60).toLocaleString('de-DE', { maximumFractionDigits: 2 })} h`;
  const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
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
      const sel = {};   // gewählter Tag je Dienstplan
      const sheet = () => { let sh = document.getElementById('dsSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'dsSheet'; sh.className = 'vh-sheet ds-sheet'; document.body.appendChild(sh); } return sh; };
      async function load() {
        let d; try { d = await ctx.api('me'); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        window.__dsToday = d.today;
        const pct = d.target ? Math.min(100, Math.round(d.done / d.target * 100)) : 100;
        const miss = Math.max(0, d.target - d.done);
        // Solange Stunden fehlen, steht das Offene im Vordergrund; danach kein Zielstrich („Geschafft“), nur Dank – die Dienste rücken nach oben
        const met = Boolean(d.target) && !miss;
        const hours = `<div class="ds-card"><h3>Arbeitsstunden ${esc(d.year)}${d.family ? '<span class="ds-tag">Familie</span>' : ''}</h3>
            ${!d.target ? `<p class="ds-sub">Für dich ist kein Soll hinterlegt${d.mine && d.mine.why ? ` (${esc(d.mine.why)})` : ''}. Mithelfen ist trotzdem willkommen!</p>`
              : miss ? `<div class="ds-big"><b>${hh(miss)}</b><span>noch offen</span></div><div class="ds-bar"><i style="width:${pct}%"></i></div>
              <p class="ds-sub">${hh(d.done)} von ${hh(d.target)} geleistet – bitte bis ${deD(d.to)}${d.rate_cents ? `, danach ${euro(d.rate_cents)} je fehlender Stunde` : ''}.${d.open ? ` ${hh(d.open)} werden noch geprüft.` : ''}</p>`
              : `<div class="ds-big"><b>${hh(d.done)}</b><span>geleistet – danke!</span></div>
              ${d.open ? `<p class="ds-sub ds-met">${hh(d.open)} werden noch geprüft.</p>` : ''}`}
            ${d.text ? `<p class="ds-sub" style="margin-top:8px">${esc(d.text)}</p>` : ''}</div>`;
        const duties = `${mineHtml(d)}${d.plans.map(planHtml).join('')}
          ${d.events.length || !d.plans.length ? `<div class="ds-card"><h3>${d.plans.length ? 'Weitere Termine' : 'Termine'}</h3>${d.events.length ? d.events.map(e => shiftHtml(e, true)).join('') : '<p class="ds-sub">Gerade keine Termine geplant.</p>'}</div>` : ''}`;
        el.innerHTML = `${met ? duties + hours : hours + duties}
          <div class="ds-card"><h3>Meine Stunden${d.report ? '<button id="dsRep">Stunden melden</button>' : ''}</h3><div class="ds-list">${d.entries.length ? d.entries.map(x => `<div><span><span translate="no">${esc(x.text || '')}</span><small>${deD(x.date)}${d.family ? ' · ' + esc(x.name) : ''}<span class="ds-tag ${(ST[x.status] || [''])[0]}">${esc((ST[x.status] || ['', x.status])[1])}</span>${x.reason ? ' ' + esc(x.reason) : ''}</small></span><b>${x.minutes ? hh(x.minutes) : '–'}</b></div>`).join('') : '<div><span class="ds-sub">Noch keine Stunden in diesem Jahr.</span></div>'}</div></div>`;
        const all = [...d.events, ...d.plans.flatMap(p => p.shifts)];
        el.querySelectorAll('[data-ev]').forEach(b => { b.onclick = async () => {
          const e = all.find(x => x.id === +b.dataset.ev);
          if (b.dataset.on === '1') return leave(e, d);
          try { await ctx.api('signup', 'POST', { event_id: e.id }); ctx.toast('Eingetragen – danke! Du bekommst am Vortag eine Erinnerung.'); load(); } catch (x) { ctx.toast(x.message, true); }
        }; });
        el.querySelectorAll('[data-pd]').forEach(b => { b.onclick = () => { sel[b.dataset.pl] = b.dataset.pd; load(); }; });
        const rep = document.getElementById('dsRep'); if (rep) rep.onclick = () => report(d);
      }
      function shiftHtml(e, withDate) {
        const over = e.open === false, full = e.slots && e.taken >= e.slots && !e.mine;
        const st = e.slots ? (e.taken >= e.slots ? ['g', 'voll'] : ['a', `${e.slots - e.taken} frei`]) : ['', `${e.taken} dabei`];
        return `<div class="ds-sh${e.mine ? ' me' : ''}"><div class="ds-t">${withDate ? `${wd(e.date)} ${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.<small>${esc(when(e))}</small>` : esc(when(e))}</div>
          <div style="min-width:0"><strong><span translate="no">${esc(e.title)}</span><span class="ds-tag ${st[0]}">${esc(st[1])}</span>${e.mine ? '<span class="ds-tag g">du bist dabei</span>' : ''}</strong>
            ${e.faces && e.faces.length ? `<span class="ds-faces">${e.faces.slice(0, 8).map(f => `<img data-auth-src="api/photo/of/${f.id}?u=helfer&v=${esc(f.v)}" alt="">`).join('')}</span>` : ''}${e.helpers.length ? `<small class="n" translate="no">${esc(e.helpers.map(short).join(', '))}</small>` : ''}${e.note ? `<small class="n">${esc(e.note)}</small>` : ''}${withDate && e.place ? `<small class="n">${esc(e.place)}</small>` : ''}</div>
          ${over ? '<button class="sec" disabled>vorbei</button>' : `<button data-ev="${e.id}" data-on="${e.mine ? 1 : 0}" class="${e.mine ? 'sec' : ''}" ${full ? 'disabled' : ''}>${e.mine ? 'Austragen' : full ? 'voll' : 'Ich helfe'}</button>`}</div>`;
      }
      function planHtml(p) {
        const days = [...new Set(p.shifts.map(e => e.date))];
        if (!sel[p.id] || !days.includes(sel[p.id])) sel[p.id] = days.find(x => x >= (window.__dsToday || '')) || days[0];
        const sh = p.shifts.filter(e => e.date === sel[p.id]);
        return `<div class="ds-card"><h3 class="ds-ph" translate="no">${esc(p.title)}</h3><p class="ds-pm">${esc([p.from_date === p.to_date ? `${wd(p.from_date, true)}, ${deD(p.from_date)}` : `${deD(p.from_date)} – ${deD(p.to_date)}`, p.place].filter(Boolean).join(' · '))}</p>
          ${p.note ? `<p class="ds-sub" style="margin:0 0 8px">${esc(p.note)}</p>` : ''}
          ${days.length > 1 ? `<div class="ds-days">${days.map(x => `<button data-pl="${p.id}" data-pd="${x}" class="${x === sel[p.id] ? 'on' : ''}">${wd(x)} ${+x.slice(8, 10)}.${+x.slice(5, 7)}.</button>`).join('')}</div>` : ''}
          ${sh.length ? sh.map(e => shiftHtml(e, false)).join('') : '<p class="ds-sub">Noch keine Schichten.</p>'}</div>`;
      }
      function mineHtml(d) {
        const list = [...d.events.map(e => ({ ...e, plan: null })), ...d.plans.flatMap(p => p.shifts.map(e => ({ ...e, plan: p.title })))].filter(e => e.mine && e.open !== false).sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
        if (!list.length) return '';
        return `<div class="ds-card"><h3>Meine Dienste</h3><div class="ds-mine">${list.map(e => `<div><span><span translate="no">${esc(e.title)}</span><small>${esc([e.plan, `${wd(e.date, true)}, ${deD(e.date)}`].filter(Boolean).join(' · '))}</small></span><b>${esc(when(e))}</b></div>`).join('')}</div></div>`;
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
