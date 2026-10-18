'use strict';
/* Bereich „Dienste“ in der Mitglieder-App: eigene Arbeitsstunden, Termine zum Eintragen, Stunden melden */
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
      .ds-sheet .vh-box { max-width: 420px; text-align: left; } .ds-sheet label { display: block; font-size: 13px; font-weight: 700; color: var(--muted); margin: 0 0 4px; } .ds-sheet .vh-input { font-size: 16px; min-height: 48px; }`;
    document.head.appendChild(s);
  }
  const hh = m => `${((m || 0) / 60).toLocaleString('de-DE', { maximumFractionDigits: 2 })} h`;
  const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const deD = d => (d ? d.split('-').reverse().join('.') : '');
  const ST = { offen: ['a', 'wird geprüft'], bestaetigt: ['g', 'bestätigt'], abgelehnt: ['', 'abgelehnt'], laeuft: ['', 'läuft'] };
  const KIND = { arbeit: 'Arbeitseinsatz', theke: 'Thekendienst', sonstiges: 'Einsatz' };

  window.VA.registerSection({
    id: 'arbeitseinsatz',
    render(el, ctx) {
      const { esc } = ctx;
      const close = () => { const s = document.getElementById('dsSheet'); if (s) s.classList.remove('show'); };
      ctx.onLeave(close);
      async function load() {
        let d; try { d = await ctx.api('me'); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        const pct = d.target ? Math.min(100, Math.round(d.done / d.target * 100)) : 100;
        const miss = Math.max(0, d.target - d.done);
        el.innerHTML = `<div class="ds-card"><h3>Arbeitsstunden ${esc(d.year)}${d.family ? '<span class="ds-tag">Familie</span>' : ''}</h3>
            ${d.target ? `<div class="ds-big"><b>${hh(d.done)}</b><span>von ${hh(d.target)}</span></div><div class="ds-bar"><i style="width:${pct}%"></i></div>
              <p class="ds-sub">${miss ? `Noch ${hh(miss)} bis ${deD(d.to)}${d.rate_cents ? ` – danach ${euro(d.rate_cents)} je fehlender Stunde` : ''}.` : 'Geschafft – danke für deinen Einsatz!'}${d.open ? ` ${hh(d.open)} werden noch geprüft.` : ''}</p>`
              : `<p class="ds-sub">Für dich ist kein Soll hinterlegt${d.mine && d.mine.why ? ` (${esc(d.mine.why)})` : ''}. Mithelfen ist trotzdem willkommen!</p>`}
            ${d.text ? `<p class="ds-sub" style="margin-top:8px">${esc(d.text)}</p>` : ''}</div>
          <div class="ds-card"><h3>Termine</h3>${d.events.length ? d.events.map(e => { const full = e.slots && e.taken >= e.slots && !e.mine; const dt = new Date(e.date + 'T12:00:00');
            return `<div class="ds-ev"><span class="ds-d"><span>${dt.toLocaleDateString('de-DE', { weekday: 'short' })}</span><b>${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.</b></span>
              <div style="min-width:0"><strong translate="no">${esc(e.title)}</strong><small>${[KIND[e.kind], e.start ? `${e.start}${e.end ? '–' + e.end : ''} Uhr` : '', e.place, e.slots ? `${e.taken}/${e.slots} Helfer` : (e.taken ? `${e.taken} dabei` : '')].filter(Boolean).map(esc).join(' · ')}</small>${e.note ? `<small>${esc(e.note)}</small>` : ''}</div>
              <button data-ev="${e.id}" data-on="${e.mine ? 1 : 0}" class="${e.mine ? 'sec' : ''}" ${full ? 'disabled' : ''}>${e.mine ? 'Austragen' : full ? 'voll' : 'Ich helfe'}</button></div>`; }).join('') : '<p class="ds-sub">Gerade keine Termine geplant.</p>'}</div>
          <div class="ds-card"><h3>Meine Stunden${d.report ? '<button id="dsRep">Stunden melden</button>' : ''}</h3><div class="ds-list">${d.entries.length ? d.entries.map(x => `<div><span><span translate="no">${esc(x.text || '')}</span><small>${deD(x.date)}${d.family ? ' · ' + esc(x.name) : ''}<span class="ds-tag ${(ST[x.status] || [''])[0]}">${esc((ST[x.status] || ['', x.status])[1])}</span>${x.reason ? ' ' + esc(x.reason) : ''}</small></span><b>${x.minutes ? hh(x.minutes) : '–'}</b></div>`).join('') : '<div><span class="ds-sub">Noch keine Stunden in diesem Jahr.</span></div>'}</div></div>`;
        el.querySelectorAll('[data-ev]').forEach(b => { b.onclick = async () => { try { await ctx.api('signup', 'POST', { event_id: +b.dataset.ev, remove: b.dataset.on === '1' }); ctx.toast(b.dataset.on === '1' ? 'Ausgetragen.' : 'Eingetragen – danke! Du bekommst am Vortag eine Erinnerung.'); load(); } catch (e) { ctx.toast(e.message, true); } }; });
        const rep = document.getElementById('dsRep'); if (rep) rep.onclick = () => report(d);
      }
      function report(d) {
        let sh = document.getElementById('dsSheet');
        if (!sh) { sh = document.createElement('div'); sh.id = 'dsSheet'; sh.className = 'vh-sheet ds-sheet'; document.body.appendChild(sh); }
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
