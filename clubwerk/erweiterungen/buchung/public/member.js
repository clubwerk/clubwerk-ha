'use strict';
/* Bereich „Buchen“ in der Mitglieder-App: Plätze und Geräte buchen, eigene Buchungen, Warteliste */
(() => {
  if (!document.getElementById('bkmStyle')) {
    const s = document.createElement('style'); s.id = 'bkmStyle';
    s.textContent = `
      .bkm-view { display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: var(--hover); margin: 0 0 12px; }
      .bkm-view button { flex: 1; min-height: 36px; border-radius: 11px; border: 0; background: transparent; font: inherit; font-size: 14px; font-weight: 700; color: var(--muted); }
      .bkm-view button.on { background: var(--card); color: var(--ink); box-shadow: var(--shadow); }
      .bkm-planwrap { background: var(--card); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); margin-bottom: 12px; overflow: hidden; }
      .bkm-plan { display: grid; grid-template-columns: 52px repeat(var(--n), minmax(0, 1fr)); }   /* Zeitspalte 52 px: Uhrzeiten liegen ganz in der Karte */   /* ganzer Tag, alle Plätze in der Breite – kein Scrollen im Fenster */
      .bkm-plan .hd { position: relative; z-index: 3; background: var(--card); border-bottom: 1px solid var(--line); min-height: 48px; padding: 6px 4px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .bkm-plan .hd b { font-size: 14px; font-weight: 800; line-height: 18px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .bkm-plan .hd small { font-size: 11px; color: var(--muted); line-height: 14px; }
      .bkm-plan .tc { position: relative; border-right: 1px solid var(--line); }
      .bkm-plan .tc span { position: absolute; right: 8px; transform: translateY(-50%); font-size: 11px; color: var(--faint, var(--muted)); font-variant-numeric: tabular-nums; }
      .bkm-plan .cl { position: relative; border-right: 1px solid var(--line); background-image: linear-gradient(to bottom, var(--line) 1px, transparent 1px); background-size: 100% var(--ph); }
      .bkm-plan .cl:last-child { border-right: 0; }
      .bkm-plan .zu { position: absolute; left: 0; right: 0; background: repeating-linear-gradient(135deg, var(--hover) 0 6px, transparent 6px 12px); pointer-events: none; }
      .bkm-plan .past { position: absolute; left: 0; right: 0; top: 0; background: color-mix(in srgb, var(--hover) 70%, transparent); pointer-events: none; }
      .bkm-plan .nowl { position: absolute; left: 0; right: 0; height: 2px; background: var(--red); z-index: 2; pointer-events: none; }
      .bkm-blk { position: absolute; left: 3px; right: 3px; border-radius: 9px; padding: 4px 6px; box-sizing: border-box; overflow: hidden; border: 1px solid transparent; text-align: left; font: inherit; display: flex; flex-direction: column; z-index: 1;
        background: var(--hover); color: var(--ink); border-color: var(--line); }
      .bkm-blk > b, .bkm-blk > span { display: block; flex: none; height: 15px; line-height: 15px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bkm-blk > b { font-weight: 800; } .bkm-blk > .tm { font-size: 11px; opacity: .85; font-variant-numeric: tabular-nums; }
      .bkm-blk.mine { background: var(--brand); border-color: var(--brand); color: #fff; }
      .bkm-blk.sperre { background: repeating-linear-gradient(135deg, var(--red-soft) 0 8px, color-mix(in srgb, var(--red-soft) 50%, var(--card)) 8px 16px); color: var(--red); border-color: color-mix(in srgb, var(--red) 30%, transparent); }
      .bkm-hint { font-size: 12.5px; color: var(--muted); margin: -4px 2px 12px; }
      .bkm-days { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 8px; margin: 0 -2px 4px; scrollbar-width: none; }
      .bkm-days::-webkit-scrollbar { display: none; }
      .bkm-days button { flex: none; width: 58px; height: 62px; border-radius: 14px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
      .bkm-days button span { font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; } .bkm-days button b { font-size: 18px; font-weight: 800; }
      .bkm-days button.on { background: var(--brand); border-color: var(--brand); color: #fff; } .bkm-days button.on span { color: rgba(255,255,255,.85); }
      .bkm-areas { display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: var(--hover); margin: 0 0 12px; }
      .bkm-areas button { flex: 1; min-height: 40px; border-radius: 11px; border: 0; background: transparent; font: inherit; font-size: 14.5px; font-weight: 700; color: var(--muted); }
      .bkm-areas button.on { background: var(--card); color: var(--ink); box-shadow: var(--shadow); }
      .bkm-card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 14px 14px 16px; box-shadow: var(--shadow); margin-bottom: 12px; }
      .bkm-card h3 { margin: 0 0 2px; font-size: 16px; font-weight: 800; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
      .bkm-card h3 small { font-size: 12.5px; font-weight: 600; color: var(--muted); }
      .bkm-note { font-size: 12.5px; color: var(--muted); margin: 0 0 10px; }
      .bkm-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; margin-top: 10px; }
      .bkm-slot { min-height: 56px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); font: inherit; color: var(--ink); padding: 6px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 0; }
      .bkm-slot b { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; } .bkm-slot span { font-size: 11px; font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 2px; }
      .bkm-slot.free { border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); } .bkm-slot.free span { color: var(--brand-ink); }
      .bkm-slot.busy { background: var(--hover); color: var(--muted); } .bkm-slot.busy b { color: var(--muted); }
      .bkm-slot.mine { background: var(--brand); border-color: var(--brand); color: #fff; } .bkm-slot.mine span { color: rgba(255,255,255,.9); }
      .bkm-slot.lock { background: repeating-linear-gradient(135deg, var(--red-soft) 0 6px, transparent 6px 12px); color: var(--red); border-color: var(--red-line, var(--line)); }
      .bkm-slot.past, .bkm-slot.closed { opacity: .38; }
      .bkm-slot.wait { box-shadow: inset 0 0 0 2px var(--amber); }
      .bkm-list > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); }
      .bkm-list > div:first-child { border-top: 0; padding-top: 4px; }
      .bkm-list strong { display: block; font-size: 15px; } .bkm-list small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px; }
      .bkm-list button { min-height: 40px; min-width: 104px; border-radius: 12px; border: 1px solid var(--line); background: transparent; color: var(--ink); font: inherit; font-size: 14px; font-weight: 700; padding: 0 12px; }
      .bkm-empty { color: var(--muted); font-size: 14px; margin: 4px 0 0; }
      .bkm-sheet .vh-box { max-width: 440px; text-align: left; max-height: 88vh; overflow: auto; }
      .bkm-sheet label.l { display: block; font-size: 13px; font-weight: 700; color: var(--muted); margin: 6px 0 4px; }
      .bkm-sheet .vh-select { font-size: 16px; }
      .bkm-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
      .bkm-chips span { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 6px 0 12px; border-radius: 17px; background: var(--brand-soft); color: var(--brand-ink); font-size: 14px; font-weight: 700; }
      .bkm-chips span button { width: 26px; height: 26px; border-radius: 13px; border: 0; background: rgba(0,0,0,.06); color: inherit; font-size: 15px; line-height: 1; }
      .bkm-hits { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin: -4px 0 10px; }
      .bkm-hits button { display: block; width: 100%; text-align: left; min-height: 44px; padding: 0 14px; border: 0; border-top: 1px solid var(--line); background: var(--card); font: inherit; font-size: 15px; color: var(--ink); }
      .bkm-hits button:first-child { border-top: 0; }
      .bkm-row2 { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; } .bkm-row2 button { min-height: 54px; padding: 0 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--hover); font: inherit; font-weight: 700; color: var(--ink); }
      .bkm-rules { font-size: 13px; color: var(--muted); background: var(--field); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; margin: 6px 0 8px; white-space: pre-wrap; max-height: 140px; overflow: auto; }
      .bkm-sheet .chk { display: flex; gap: 10px; align-items: flex-start; font-size: 14.5px; margin: 4px 0 10px; } .bkm-sheet .chk input { width: 20px; height: 20px; margin-top: 1px; flex: none; }
      .bkm-sum { font-size: 14px; color: var(--muted); margin: 2px 0 10px; }
      .bkm-acts { display: flex; gap: 8px; align-items: center; }
      button.bkm-ical { min-width: 40px !important; padding: 0 !important; background: transparent; }
      .bkm-sheet .vh-input { margin-bottom: 10px; }
      .bkm-ical { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; border: 1px solid var(--line); color: var(--ink); }
      .vh-row a.ok.bkm-cal { display: flex; align-items: center; justify-content: center; min-height: 50px; border-radius: 14px; font-size: 16px; font-weight: 700; text-decoration: none; color: #fff; flex: 1.4; }`;
    document.head.appendChild(s);
  }
  const deD = d => (d ? d.split('-').reverse().join('.') : '');
  const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const tm = s => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const wd = (s, o = { weekday: 'short' }) => new Date(s + 'T12:00:00').toLocaleDateString('de-DE', o);
  const dur = m => (m % 60 ? (m > 60 ? `${Math.floor(m / 60)} Std. ${m % 60} Min.` : `${m} Min.`) : `${m / 60} Std.`);
  const first = n => String(n || '').split(/[ ,]+/)[0];

  const PH = 56;   // Pixel je Stunde in der Übersicht
  const ink = hex => { const n = parseInt(String(hex).slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) > 160 ? '#1b1f1c' : '#ffffff'; };
  let view = 'plan'; try { view = localStorage.getItem('bkm_view') || 'plan'; } catch (e) { /* */ }
  /** Raster eines Platzes am Tag → [{ s, e, state, label, booking }] */
  function slots(r, plan, d, nowM, today) {
    const out = [];
    const o = tm(r.open_from), c = tm(r.open_to);
    for (let s = o; s + r.slot_min <= c; s += r.slot_min) {
      const e = s + r.slot_min;
      const ov = plan.bookings.filter(b => b.resource_id === r.id && tm(b.start) < e && tm(b.end) > s);
      const lock = ov.find(b => b.type === 'sperre'), mine = ov.find(b => b.mine);
      let state = 'free', label = r.quantity > 1 ? `${r.quantity - ov.length} frei` : 'frei', booking = null;
      if (!r.open_today) { state = 'closed'; label = 'zu'; } else if (lock) { state = 'lock'; label = lock.title || 'gesperrt'; booking = lock; } else if (mine) { state = 'mine'; label = 'meins'; booking = mine; }
      else if (ov.length >= Math.max(1, r.quantity)) { state = 'busy'; booking = ov[0]; label = ov[0].label ? ov[0].label.name : ov[0].type === 'serie' ? (ov[0].title || 'Training') : ov[0].who ? ov[0].who.map(first).join(', ') : 'belegt'; }
      if (d === today && e <= nowM && state !== 'mine') state = state === 'free' ? 'past' : state;
      if (state !== 'closed' && plan.waits.some(w => w.resource_id === r.id && w.start === hhmm(s))) state += ' wait';
      out.push({ s, e, state, label, booking });
    }
    return out;
  }

  window.VA.registerSection({
    id: 'buchung',
    render(el, ctx) {
      const { esc } = ctx;
      let day = null, area = null, data = null;
      const sheet = () => { let sh = document.getElementById('bkmSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'bkmSheet'; sh.className = 'vh-sheet bkm-sheet'; document.body.appendChild(sh); } return sh; };
      const close = () => { const s = document.getElementById('bkmSheet'); if (s) s.classList.remove('show'); };
      ctx.onLeave(() => { close(); clearInterval(timer); });

      async function load() {
        try { data = await ctx.api('me' + (day ? `?date=${day}` : '')); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        day = data.plan.date;
        draw();
      }
      function draw() {
        const d = data, p = d.plan, nowM = tm(d.now);
        const days = []; for (let x = d.today; x <= d.max; x = addDays(x, 1)) days.push(x);
        const areas = [...new Set(p.resources.map(r => r.area))];
        if (!areas.includes(area)) area = areas[0] || null;
        const rs = p.resources.filter(r => r.area === area);
        el.innerHTML = `${d.blocked ? `<div class="bkm-card" style="border-color:var(--amber)"><p class="bkm-empty" style="color:var(--ink)"><b>${esc(d.blocked)}</b><br>Bei Fragen bitte an den Vorstand wenden.</p></div>` : ''}<div class="bkm-days">${days.map(x => `<button data-d="${x}" class="${x === day ? 'on' : ''}"><span>${x === d.today ? 'heute' : esc(wd(x))}</span><b>${+x.slice(8, 10)}.</b></button>`).join('')}</div>
          ${areas.length > 1 ? `<div class="bkm-areas">${areas.map(a => `<button data-a="${esc(a)}" class="${a === area ? 'on' : ''}">${esc(a)}</button>`).join('')}</div>` : ''}
          <div class="bkm-view">${[['plan', 'Übersicht'], ['zeiten', 'Freie Zeiten']].map(([k, t]) => `<button data-v="${k}" class="${view === k ? 'on' : ''}">${t}</button>`).join('')}</div>
          ${rs.length && view === 'plan' ? planHtml(rs, p, nowM) : rs.length ? rs.map(r => `<div class="bkm-card"><h3>${esc(r.name)}<small>${r.open_today ? `${r.open_from}–${r.open_to} Uhr` : 'heute nicht buchbar'}</small></h3>${r.department || r.note ? `<p class="bkm-note">${r.department ? `Abteilung ${esc(r.department)}${r.outsiders === 'gesperrt' ? ' – nur für Abteilungsmitglieder' : r.outsider_fee_cents ? ` – andere Mitglieder ${euro(r.outsider_fee_cents)} Platzgebühr` : ''}` : ''}${r.department && r.note ? ' · ' : ''}${r.note ? esc(r.note) : ''}</p>` : ''}
            <div class="bkm-slots">${slots(r, p, day, nowM, d.today).map(x => `<button class="bkm-slot ${x.state}" data-r="${r.id}" data-s="${x.s}" ${x.booking && x.booking.label && !x.booking.mine ? `style="box-shadow:inset 0 -4px 0 ${x.booking.label.color}"` : ''} ${/past|closed/.test(x.state) ? 'disabled' : ''}><b>${hhmm(x.s)}</b><span>${esc(x.label)}</span></button>`).join('')}</div></div>`).join('')
            : '<div class="bkm-card"><p class="bkm-empty">Hier ist noch nichts buchbar.</p></div>'}
          <div class="bkm-card"><h3>Meine Buchungen</h3><div class="bkm-list">${d.mine.length ? d.mine.map(b => `<div><span><strong>${esc(b.resource)} · ${b.start}–${b.end}</strong><small>${esc(wd(b.date, { weekday: 'long' }))}, ${deD(b.date)}${b.who && b.who.length > 1 ? ' · mit ' + esc(b.who.filter(w => w !== ctx.member).map(first).join(', ')) : ''}${b.fee_cents ? ` · Gebühr ${euro(b.fee_cents)}` : ''}${b.own ? '' : ' · eingetragen als Mitspieler'}</small></span>
              <span class="bkm-acts"><a class="bkm-ical" href="${esc(b.ics)}" aria-label="In den Kalender" title="In den Kalender"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 13v5M9.5 15.5h5"/></svg></a>${b.canEdit ? `<button class="bkm-ical" data-e="${b.id}" aria-label="Ändern" title="Ändern"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/></svg></button>` : ''}${b.canCancel ? `<button data-c="${b.id}">Stornieren</button>` : ''}</span></div>`).join('') : '<p class="bkm-empty">Keine offenen Buchungen.</p>'}</div>
            ${d.series && d.series.length ? `<h3 style="margin-top:14px">Meine Serien</h3><div class="bkm-list">${d.series.map(x => `<div><span><strong>${esc(x.title)}</strong><small>${esc(x.resources.join(', '))} · ${esc(x.weekdays.split('').map(n => ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][+n]).join(', '))} ${x.start}–${x.end} · bis ${deD(x.to_date)} · ${x.count} Termine</small></span><button data-se="${x.id}">Beenden</button></div>`).join('')}</div>` : ''}
            ${d.waits.length ? `<h3 style="margin-top:14px">Warteliste</h3><div class="bkm-list">${d.waits.map(w => `<div><span><strong>${esc(w.resource)} · ${w.start} Uhr</strong><small>${deD(w.date)}${w.notified_at ? ' · frei geworden – schnell buchen!' : ''}</small></span><button data-w="${w.id}">Entfernen</button></div>`).join('')}</div>` : ''}</div>`;
        el.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { day = b.dataset.d; load(); }; });
        el.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { area = b.dataset.a; draw(); }; });
        el.querySelectorAll('.bkm-view [data-v]').forEach(b => { b.onclick = () => { view = b.dataset.v; try { localStorage.setItem('bkm_view', view); } catch (e) { /* */ } draw(); }; });
        el.querySelectorAll('.bkm-plan .cl[data-r]').forEach(c => { c.onclick = e => {
          const r = p.resources.find(x => x.id === +c.dataset.r); if (!r || !r.open_today) return;
          const bk = e.target.closest('.bkm-blk');
          if (bk) { const s0 = +bk.dataset.s; return slotTap(r, s0); }
          const from = +c.dataset.from, m = from + (e.clientY - c.getBoundingClientRect().top - 6) / PH * 60;
          const o = tm(r.open_from); const s0 = o + Math.floor((m - o) / r.slot_min) * r.slot_min;
          if (s0 < o || s0 + r.slot_min > tm(r.open_to)) return;
          slotTap(r, s0);
        }; });
        el.querySelectorAll('.bkm-slot[data-r]').forEach(b => { b.onclick = () => slotTap(p.resources.find(r => r.id === +b.dataset.r), +b.dataset.s); });
        el.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => cancelSheet(d.mine.find(x => x.id === +b.dataset.c)); });
        el.querySelectorAll('[data-se]').forEach(b => { b.onclick = async () => { const x = d.series.find(y => y.id === +b.dataset.se); if (!confirm(`Serie „${x.title}“ beenden? Die ${x.count} kommenden Termine werden freigegeben.`)) return; try { const r0 = await ctx.api(`series/${x.id}/end`, 'POST', {}); ctx.toast(`Beendet – ${r0.removed} Termine freigegeben.`); load(); } catch (e) { ctx.toast(e.message, true); } }; });
        el.querySelectorAll('[data-e]').forEach(b => { b.onclick = () => editBooking(d.mine.find(x => x.id === +b.dataset.e)); });
        el.querySelectorAll('[data-w]').forEach(b => { b.onclick = async () => { try { await ctx.api('wait', 'POST', { remove: true, id: +b.dataset.w }); ctx.toast('Von der Warteliste entfernt.'); load(); } catch (e) { ctx.toast(e.message, true); } }; });
        const on = el.querySelector('.bkm-days .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
      }
      /** Übersicht: alle Plätze nebeneinander, Buchungen als Blöcke (wie im Vereinsheim-Plan) */
      function planHtml(rs, p, nowM) {
        const lo = Math.min(...rs.map(r => tm(r.open_from))), hi = Math.max(...rs.map(r => tm(r.open_to)));
        const from = Math.floor(lo / 60) * 60, to = Math.ceil(hi / 60) * 60, T = 12, H = (to - from) / 60 * PH + T * 2;   // T: Rand oben/unten, damit die erste und letzte Uhrzeit nicht angeschnitten wird
        const y = m => T + (m - from) / 60 * PH;
        const isToday = day === data.today;
        const blk = (r, b) => {
          const s0 = tm(b.start), e0 = tm(b.end), h = Math.max(20, y(e0) - y(s0) - 2), n = Math.max(1, Math.floor((h - 8) / 15));
          const who = b.type === 'buchung' && b.who ? b.who.join(', ') : '';
          const main = b.type === 'sperre' ? (b.title || 'gesperrt') : b.label ? b.label.name : b.type === 'serie' ? (b.title || 'Training') : who || (b.mine ? 'Meine Buchung' : 'belegt');
          const sub = b.label || b.type === 'serie' ? (who || (b.title && b.title !== main ? b.title : '')) : '';
          const time = `${b.start}–${b.end}`;
          let ln = [[main, 'b'], ...(sub ? [[sub, '']] : []), [time, 'tm']];
          if (ln.length > n) ln = n === 1 ? [[`${main} · ${time}`, 'b']] : ln.slice(0, n);
          const st = b.mine ? '' : b.label ? `background:${b.label.color};color:${ink(b.label.color)};border-color:transparent;` : '';
          return `<button class="bkm-blk ${b.mine ? 'mine' : ''} ${b.type === 'sperre' ? 'sperre' : ''}" data-s="${s0}" style="top:${y(s0) + 1}px;height:${h}px;${st}">${ln.map(([x, c]) => (c === 'b' ? `<b>${esc(x)}</b>` : `<span class="${c}">${esc(x)}</span>`)).join('')}</button>`;
        };
        return `<div class="bkm-planwrap"><div class="bkm-plan" style="--n:${rs.length};--ph:${PH}px">
          <div class="hd" style="border-right:1px solid var(--line)"></div>${rs.map(r => `<div class="hd"><b>${esc(r.name)}</b><small>${r.open_today ? `${r.open_from}–${r.open_to}` : 'heute zu'}</small></div>`).join('')}
          <div class="tc" style="height:${H}px">${Array.from({ length: (to - from) / 60 + 1 }, (_, i) => `<span style="top:${T + i * PH}px">${hhmm(from + i * 60)}</span>`).join('')}</div>
          ${rs.map(r => { const o = tm(r.open_from), c = tm(r.open_to);
            const bs = p.bookings.filter(b => b.resource_id === r.id);
            return `<div class="cl" data-r="${r.id}" data-from="${from}" style="height:${H}px;background-position:0 ${T}px">
              ${r.open_today ? `<div class="zu" style="top:0;height:${y(o)}px"></div><div class="zu" style="top:${y(c)}px;bottom:0"></div>` : '<div class="zu" style="top:0;bottom:0"></div>'}
              ${isToday && nowM > from ? `<div class="past" style="height:${Math.min(H, y(nowM))}px"></div>` : ''}${isToday && nowM > from && nowM < to ? `<div class="nowl" style="top:${y(nowM)}px"></div>` : ''}
              ${bs.map(b => blk(r, b)).join('')}</div>`; }).join('')}
        </div></div><p class="bkm-hint">Freie Stelle antippen zum Buchen · eigene Buchung antippen zum Ändern oder Stornieren.</p>`;
      }
      function slotTap(r, s) {
        const sl0 = slots(r, data.plan, day, tm(data.now), data.today); const x = sl0.find(y => y.s === s) || sl0.find(y => y.s <= s && y.e > s); if (!x) return;
        const st = x.state.split(' ')[0];
        if (st === 'free') { if (data.blocked) { ctx.toast(data.blocked, true); return; } return bookSheet(r, s); }
        if (st === 'mine') { const m = data.mine.find(b => b.id === x.booking.id); if (m) (m.canEdit ? manageSheet(m) : cancelSheet(m)); return; }
        if (st === 'busy' || st === 'lock') return infoSheet(r, x);
      }
      function infoSheet(r, x) {
        const sh = sheet(); const b = x.booking || {};
        const canWait = data.settings.waitlist && x.state.split(' ')[0] === 'busy' && !x.state.includes('wait');
        sh.innerHTML = `<div class="vh-box"><h2>${esc(r.name)} · ${hhmm(x.s)}</h2><p>${esc(wd(day, { weekday: 'long' }))}, ${deD(day)} · ${b.type === 'sperre' ? 'gesperrt' : 'belegt'} ${b.start ? `${b.start}–${b.end} Uhr` : ''}${b.label ? `<br><b>${esc(b.label.name)}</b>` : ''}${b.type === 'buchung' && b.who ? `<br>${esc(b.who.join(', '))}` : b.title && (!b.label || b.title !== b.label.name) ? `<br>${esc(b.title)}` : ''}</p>
          ${canWait ? '<p>Auf die Warteliste? Du bekommst eine E-Mail, sobald die Zeit frei wird.</p>' : x.state.includes('wait') ? '<p>Du stehst schon auf der Warteliste.</p>' : ''}
          <div class="vh-err" id="bkmE"></div><div class="vh-row"><button class="no" id="bkmNo">${canWait ? 'Abbrechen' : 'Schließen'}</button>${canWait ? '<button class="ok" id="bkmOk">Vormerken</button>' : ''}</div></div>`;
        sh.classList.add('show');
        sh.querySelector('#bkmNo').onclick = close;
        if (canWait) sh.querySelector('#bkmOk').onclick = async () => {
          try { await ctx.api('wait', 'POST', { resource_id: r.id, date: day, start: hhmm(x.s), minutes: r.slot_min }); close(); ctx.toast('Vorgemerkt – du bekommst eine E-Mail, wenn frei.'); load(); } catch (e) { sh.querySelector('#bkmE').textContent = e.message; }
        };
      }
      /** eigene Buchung ändern: Tag laden, dann das Buchungsfenster mit den bisherigen Angaben */
      async function editBooking(b) {
        if (!b || !b.edit) return;
        if (day !== b.date) { day = b.date; await load(); }
        const r = data.plan.resources.find(x => x.id === b.edit.resource_id);
        if (!r) { ctx.toast('Dieser Platz ist gerade nicht buchbar.', true); return; }
        bookSheet(r, tm(b.start), b);
      }
      function manageSheet(b) {
        const sh = sheet();
        sh.innerHTML = `<div class="vh-box"><h2>${esc(b.resource)} · ${b.start}–${b.end}</h2><p>${esc(wd(b.date, { weekday: 'long' }))}, ${deD(b.date)}${b.who && b.who.length > 1 ? `<br>mit ${esc(b.who.filter(w => w !== ctx.member).join(', '))}` : ''}</p>
          <div class="vh-row"><button class="no" id="bkmX" style="color:var(--red)">Stornieren</button><button class="ok" id="bkmEd">Ändern</button></div>
          <div class="vh-row" style="margin-top:8px"><button class="no" id="bkmNo">Schließen</button></div></div>`;
        sh.classList.add('show');
        sh.querySelector('#bkmNo').onclick = close;
        sh.querySelector('#bkmX').onclick = () => cancelSheet(b);
        sh.querySelector('#bkmEd').onclick = () => editBooking(b);
      }
      function bookSheet(r, s, ed = null) {
        const set = data.settings, p = data.plan;
        const labels = data.labels || [];
        let lab = ed && ed.edit.label_id ? labels.find(l => l.id === ed.edit.label_id) || null : null;
        // freie Zeiten dieses Platzes (die eigene Buchung beim Ändern zählt als frei)
        const sl = slots(r, p, day, tm(data.now), data.today).map(x => ({ ...x, st: ed && x.booking && x.booking.id === ed.id ? 'free' : x.state.split(' ')[0] }));
        const starts = ed ? sl.filter(x => x.st === 'free').map(x => x.s) : [s];
        const curDur = ed ? tm(ed.end) - tm(ed.start) : 0;
        const partners = ed ? ed.edit.partners.filter(id => data.people.some(x => x.id === id)) : [], guests = ed ? ed.edit.guests.map(g => ({ ...g })) : [];
        const maxP = () => (lab && lab.free_rules ? 10 : set.max_partners), maxG = () => (lab && lab.free_rules ? 10 : set.max_guests);
        const sh = sheet();
        sh.innerHTML = `<div class="vh-box"><h2>${ed ? 'Buchung ändern' : esc(r.name)}</h2><p>${ed ? `${esc(r.name)} · ` : ''}${esc(wd(day, { weekday: 'long' }))}, ${deD(day)}${ed ? '' : ` · ab ${hhmm(s)} Uhr`}</p>
          ${labels.length ? `<label class="l">Art der Buchung</label><select class="vh-select" id="bkmL"><option value="">Normale Buchung</option>${labels.map(l => `<option value="${l.id}" ${lab && lab.id === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
            <div id="bkmTw"><label class="l">Titel <span style="font-weight:500">(optional)</span></label><input class="vh-input" id="bkmT" maxlength="80" placeholder="z. B. Herren 40 gegen TC Musterstadt" value="${esc(ed ? ed.edit.title || '' : '')}"></div>` : ''}
          ${ed ? `<label class="l">Beginn</label><select class="vh-select" id="bkmS">${starts.map(x => `<option value="${x}" ${x === s ? 'selected' : ''}>${hhmm(x)} Uhr</option>`).join('')}</select>` : ''}
          <label class="l">Dauer</label><select class="vh-select" id="bkmD"></select>
          ${set.max_partners ? `<label class="l">Mitspieler <span style="font-weight:500" id="bkmPm"></span></label><div class="bkm-chips" id="bkmPc"></div>
            <input class="vh-input" id="bkmPq" placeholder="Name suchen" autocomplete="off"><div class="bkm-hits" id="bkmPh" hidden></div>` : ''}
          ${set.max_guests ? `<label class="l">Gäste <span style="font-weight:500" id="bkmGm"></span></label><div class="bkm-chips" id="bkmGc"></div>
            <div class="bkm-row2"><input class="vh-input" id="bkmGq" placeholder="Vor- und Nachname" autocomplete="off" maxlength="60"><button id="bkmGa" style="margin-bottom:10px">+ Gast</button></div>
            <label class="chk" style="margin-top:-2px"><input type="checkbox" id="bkmGp"> Mitglied in einem Partnerverein (keine Gastgebühr)</label>` : ''}
          ${!ed && data.rights && data.rights.series ? `<label class="l">Jede Woche wiederholen bis <span style="font-weight:500">(optional – Serie)</span></label><input class="vh-input" type="date" id="bkmU" min="${addDays(day, 7)}" max="${addDays(day, 366)}">` : ''}
          ${set.rules ? `<div class="bkm-rules">${esc(set.rules)}</div><label class="chk"><input type="checkbox" id="bkmR" ${ed ? 'checked' : ''}> Ich halte mich an die Platzordnung.</label>` : ''}
          <div class="bkm-sum" id="bkmSum"></div>
          <div class="vh-err" id="bkmE"></div><div class="vh-row"><button class="no" id="bkmNo">Abbrechen</button><button class="ok" id="bkmOk">${ed ? 'Speichern' : 'Buchen'}</button></div></div>`;
        sh.classList.add('show');
        const $q = id => sh.querySelector('#' + id);
        const start = () => ($q('bkmS') ? +$q('bkmS').value : s);
        // längstmögliche Dauer: bis zur nächsten belegten Zeit, Schluss oder Höchstdauer (Vereinstermin: ohne Höchstdauer)
        const fillDur = () => {
          const s0 = start(), keep = $q('bkmD').value ? +$q('bkmD').value : curDur, lim = lab && lab.free_rules ? 24 * 60 : r.max_min;
          let maxEnd = s0;
          for (const x of sl) { if (x.s < s0) continue; if (x.s !== maxEnd || x.st !== 'free' || x.e - s0 > lim) break; maxEnd = x.e; }
          const durs = []; for (let m = r.slot_min; s0 + m <= maxEnd; m += r.slot_min) durs.push(m);
          const def = durs.includes(keep) ? keep : durs[Math.min(durs.length - 1, Math.max(0, (60 / r.slot_min | 0) - 1))];
          $q('bkmD').innerHTML = durs.map(m => `<option value="${m}" ${m === def ? 'selected' : ''}>${dur(m)} · bis ${hhmm(s0 + m)} Uhr</option>`).join('');
        };
        const paintLab = () => {
          if ($q('bkmTw')) $q('bkmTw').style.display = lab ? '' : 'none';
          if ($q('bkmPm')) $q('bkmPm').textContent = `(optional, max. ${maxP()})`;
          if ($q('bkmGm')) $q('bkmGm').textContent = lab && lab.free_rules ? '(optional, ohne Gebühr)' : `(optional${r.guest_fee_cents ? `, ${euro(r.guest_fee_cents)} je Gast` : ''})`;
        };
        let qn = 0;
        const body = () => ({ id: ed ? ed.id : undefined, resource_id: r.id, date: day, start: hhmm(start()), minutes: +$q('bkmD').value, partners, guests, label_id: lab ? lab.id : null, title: lab && $q('bkmT') ? $q('bkmT').value.trim() : '' });
        const sum = async () => {   // Preis vom Server (Gäste, Platzgebühr für Nicht-Abteilungsmitglieder)
          const n = ++qn;
          try {
            const q = await ctx.api('quote', 'POST', body());
            if (n !== qn) return;
            $q('bkmE').textContent = '';
            $q('bkmSum').innerHTML = q.fee_cents ? `${q.lines.map(l => esc(l.text)).join('<br>')}<br><b>Zusammen ${euro(q.fee_cents)}</b> – wird mit deinem nächsten Beitragseinzug abgerechnet.` : lab && lab.free_rules ? `${esc(lab.name)} – Vereinstermin, kostenlos.` : 'Kostenlos.';
          } catch (e) {
            if (n !== qn) return;
            // 400 = Regelverstoß (zu lange, Kontingent, Mitspieler belegt …): als Hinweis zeigen; andere Fehler nur Vorschau
            if (e.status === 400) { $q('bkmSum').textContent = ''; $q('bkmE').textContent = e.message; }
          }
        };
        const chips = () => {
          if ($q('bkmPc')) $q('bkmPc').innerHTML = partners.map(id => `<span>${esc((data.people.find(x => x.id === id) || {}).name || '')}<button data-rp="${id}" aria-label="entfernen">×</button></span>`).join('');
          if ($q('bkmGc')) $q('bkmGc').innerHTML = guests.map((g, i) => `<span>${esc(g.name)} (${g.partner ? 'Partnerverein' : 'Gast'})<button data-rg="${i}" aria-label="entfernen">×</button></span>`).join('');
          sh.querySelectorAll('[data-rp]').forEach(b => { b.onclick = () => { partners.splice(partners.indexOf(+b.dataset.rp), 1); chips(); }; });
          sh.querySelectorAll('[data-rg]').forEach(b => { b.onclick = () => { guests.splice(+b.dataset.rg, 1); chips(); }; });
          sum();
        };
        if ($q('bkmPq')) $q('bkmPq').oninput = () => {
          const q = $q('bkmPq').value.trim().toLowerCase(), h = $q('bkmPh');
          const hits = q.length < 2 ? [] : data.people.filter(x => !partners.includes(x.id) && (x.name.toLowerCase().includes(q) || (x.ln || '').toLowerCase().includes(q))).slice(0, 6);
          h.hidden = !hits.length;
          h.innerHTML = hits.map(x => `<button data-p="${x.id}">${esc(x.ln || x.name)}</button>`).join('');
          h.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => { if (partners.length >= maxP()) { ctx.toast(`Höchstens ${maxP()} Mitspieler.`, true); return; } partners.push(+b.dataset.p); $q('bkmPq').value = ''; h.hidden = true; chips(); }; });
        };
        if ($q('bkmGa')) $q('bkmGa').onclick = () => {
          const g = $q('bkmGq').value.trim();
          if (g.length < 3) { $q('bkmE').textContent = 'Bitte Vor- und Nachname des Gastes eintragen.'; return; }
          if (guests.length >= maxG()) { $q('bkmE').textContent = `Höchstens ${maxG()} Gäste.`; return; }
          guests.push({ name: g, partner: $q('bkmGp').checked }); $q('bkmGq').value = ''; $q('bkmGp').checked = false; $q('bkmE').textContent = ''; chips();
        };
        if ($q('bkmL')) $q('bkmL').onchange = () => { lab = labels.find(l => l.id === +$q('bkmL').value) || null; paintLab(); fillDur(); sum(); };
        if ($q('bkmS')) $q('bkmS').onchange = () => { fillDur(); sum(); };
        if ($q('bkmT')) $q('bkmT').onchange = sum;
        fillDur(); paintLab(); chips();
        $q('bkmD').onchange = sum;
        $q('bkmNo').onclick = close;
        if ($q('bkmU')) $q('bkmU').onchange = () => { $q('bkmOk').textContent = $q('bkmU').value ? 'Serie anlegen' : 'Buchen'; };
        $q('bkmOk').onclick = async () => {
          $q('bkmOk').disabled = true;
          if ($q('bkmU') && $q('bkmU').value) {   // Serie (Sonderrecht): jede Woche am selben Wochentag
            try {
              const bd = body(); const r0 = await ctx.api('series', 'POST', { resource_id: r.id, date: day, start: bd.start, minutes: bd.minutes, label_id: bd.label_id, title: bd.title, until: $q('bkmU').value });
              sh.innerHTML = `<div class="vh-box" style="text-align:center"><h2>Serie angelegt ✓</h2><p>${esc(r.name)} · jeden ${esc(wd(day, { weekday: 'long' }))} · ${bd.start}–${hhmm(tm(bd.start) + bd.minutes)} Uhr<br>${r0.made} Termine bis ${deD($q('bkmU').value)}${r0.skipped.length ? `<br>Schon belegt und ausgelassen: ${esc(r0.skipped.join(', '))}` : ''}</p><div class="vh-row"><button class="ok" id="bkmDone" style="flex:1">Fertig</button></div></div>`;
              sh.querySelector('#bkmDone').onclick = close; load();
            } catch (e) { $q('bkmE').textContent = e.message; $q('bkmOk').disabled = false; }
            return;
          }
          try {
            const bd = body(); const res = await ctx.api('book', 'POST', { ...bd, accept: $q('bkmR') ? $q('bkmR').checked : true });
            const s0 = start(), m = bd.minutes;
            sh.innerHTML = `<div class="vh-box" style="text-align:center"><h2>${ed ? 'Gespeichert ✓' : 'Gebucht ✓'}</h2><p>${esc(r.name)} · ${esc(wd(day, { weekday: 'long' }))}, ${deD(day)}<br><b>${hhmm(s0)}–${hhmm(s0 + m)} Uhr</b>${lab ? `<br>${esc(lab.name)}` : ''}${partners.length ? `<br>${ed ? 'Deine Mitspieler werden informiert.' : 'Deine Mitspieler bekommen eine E-Mail.'}` : ''}${res.fee_cents ? `<br>Gebühr ${euro(res.fee_cents)}` : ''}</p>
              <div class="vh-row"><button class="no" id="bkmDone">Fertig</button><a class="ok bkm-cal" href="${esc(res.ics)}" id="bkmCal">In den Kalender</a></div></div>`;
            sh.querySelector('#bkmDone').onclick = close; sh.querySelector('#bkmCal').addEventListener('click', () => setTimeout(close, 400));
            load();
          } catch (e) { $q('bkmE').textContent = e.message; $q('bkmOk').disabled = false; if (/jemand anderes/.test(e.message)) load(); }
        };
      }
      function cancelSheet(b) {
        const sh = sheet();
        sh.innerHTML = `<div class="vh-box"><h2>Buchung stornieren?</h2><p>${esc(b.resource)} · ${esc(wd(b.date, { weekday: 'long' }))}, ${deD(b.date)} · ${b.start}–${b.end} Uhr${b.fee_cents ? `<br>Die Gebühr (${euro(b.fee_cents)}) entfällt.` : ''}</p>
          ${b.canCancel ? '' : '<p>Diese Buchung kannst du nicht mehr stornieren.</p>'}
          <div class="vh-err" id="bkmE"></div><div class="vh-row"><button class="no" id="bkmNo">${b.canCancel ? 'Behalten' : 'Schließen'}</button>${b.canCancel ? '<button class="ok" id="bkmOk" style="background:var(--red)">Stornieren</button>' : ''}</div></div>`;
        sh.classList.add('show');
        sh.querySelector('#bkmNo').onclick = close;
        if (b.canCancel) sh.querySelector('#bkmOk').onclick = async () => { try { await ctx.api('cancel', 'POST', { id: b.id }); close(); ctx.toast('Storniert.'); load(); } catch (e) { sh.querySelector('#bkmE').textContent = e.message; } };
      }
      const timer = setInterval(() => { if (!document.hidden && !(document.getElementById('bkmSheet') || {}).classList?.contains('show')) load(); }, 60000);
      el.innerHTML = '<div class="vh-empty">Lade …</div>';
      load();
    },
  });
})();
