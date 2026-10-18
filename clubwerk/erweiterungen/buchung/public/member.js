'use strict';
/* Bereich „Buchen“ in der Mitglieder-App: Plätze und Geräte buchen, eigene Buchungen, Warteliste */
(() => {
  if (!document.getElementById('bkmStyle')) {
    const s = document.createElement('style'); s.id = 'bkmStyle';
    s.textContent = `
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
      .bkm-sum { font-size: 14px; color: var(--muted); margin: 2px 0 10px; }`;
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
      else if (ov.length >= Math.max(1, r.quantity)) { state = 'busy'; booking = ov[0]; label = ov[0].type === 'serie' ? (ov[0].title || 'Training') : ov[0].who ? ov[0].who.map(first).join(', ') : 'belegt'; }
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
        el.innerHTML = `<div class="bkm-days">${days.map(x => `<button data-d="${x}" class="${x === day ? 'on' : ''}"><span>${x === d.today ? 'heute' : esc(wd(x))}</span><b>${+x.slice(8, 10)}.</b></button>`).join('')}</div>
          ${areas.length > 1 ? `<div class="bkm-areas">${areas.map(a => `<button data-a="${esc(a)}" class="${a === area ? 'on' : ''}">${esc(a)}</button>`).join('')}</div>` : ''}
          ${rs.length ? rs.map(r => `<div class="bkm-card"><h3>${esc(r.name)}<small>${r.open_today ? `${r.open_from}–${r.open_to} Uhr` : 'heute nicht buchbar'}</small></h3>${r.note ? `<p class="bkm-note">${esc(r.note)}</p>` : ''}
            <div class="bkm-slots">${slots(r, p, day, nowM, d.today).map(x => `<button class="bkm-slot ${x.state}" data-r="${r.id}" data-s="${x.s}" ${/past|closed/.test(x.state) ? 'disabled' : ''}><b>${hhmm(x.s)}</b><span>${esc(x.label)}</span></button>`).join('')}</div></div>`).join('')
            : '<div class="bkm-card"><p class="bkm-empty">Hier ist noch nichts buchbar.</p></div>'}
          <div class="bkm-card"><h3>Meine Buchungen</h3><div class="bkm-list">${d.mine.length ? d.mine.map(b => `<div><span><strong>${esc(b.resource)} · ${b.start}–${b.end}</strong><small>${esc(wd(b.date, { weekday: 'long' }))}, ${deD(b.date)}${b.who && b.who.length > 1 ? ' · mit ' + esc(b.who.filter(w => w !== ctx.member).map(first).join(', ')) : ''}${b.fee_cents ? ` · Gastgebühr ${euro(b.fee_cents)}` : ''}${b.own ? '' : ' · eingetragen als Mitspieler'}</small></span>
              ${b.canCancel ? `<button data-c="${b.id}">Stornieren</button>` : ''}</div>`).join('') : '<p class="bkm-empty">Keine offenen Buchungen.</p>'}</div>
            ${d.waits.length ? `<h3 style="margin-top:14px">Warteliste</h3><div class="bkm-list">${d.waits.map(w => `<div><span><strong>${esc(w.resource)} · ${w.start} Uhr</strong><small>${deD(w.date)}${w.notified_at ? ' · frei geworden – schnell buchen!' : ''}</small></span><button data-w="${w.id}">Entfernen</button></div>`).join('')}</div>` : ''}</div>`;
        el.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { day = b.dataset.d; load(); }; });
        el.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { area = b.dataset.a; draw(); }; });
        el.querySelectorAll('.bkm-slot[data-r]').forEach(b => { b.onclick = () => slotTap(p.resources.find(r => r.id === +b.dataset.r), +b.dataset.s); });
        el.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => cancelSheet(d.mine.find(x => x.id === +b.dataset.c)); });
        el.querySelectorAll('[data-w]').forEach(b => { b.onclick = async () => { try { await ctx.api('wait', 'POST', { remove: true, id: +b.dataset.w }); ctx.toast('Von der Warteliste entfernt.'); load(); } catch (e) { ctx.toast(e.message, true); } }; });
        const on = el.querySelector('.bkm-days .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
      }
      function slotTap(r, s) {
        const x = slots(r, data.plan, day, tm(data.now), data.today).find(y => y.s === s); if (!x) return;
        const st = x.state.split(' ')[0];
        if (st === 'free') return bookSheet(r, s);
        if (st === 'mine') { const m = data.mine.find(b => b.id === x.booking.id); if (m) cancelSheet(m); return; }
        if (st === 'busy' || st === 'lock') return infoSheet(r, x);
      }
      function infoSheet(r, x) {
        const sh = sheet(); const b = x.booking || {};
        const canWait = data.settings.waitlist && x.state.split(' ')[0] === 'busy' && !x.state.includes('wait');
        sh.innerHTML = `<div class="vh-box"><h2>${esc(r.name)} · ${hhmm(x.s)}</h2><p>${esc(wd(day, { weekday: 'long' }))}, ${deD(day)} · ${b.type === 'sperre' ? 'gesperrt' : 'belegt'} ${b.start ? `${b.start}–${b.end} Uhr` : ''}${b.type === 'buchung' && b.who ? `<br>${esc(b.who.join(', '))}` : b.title ? `<br>${esc(b.title)}` : ''}</p>
          ${canWait ? '<p>Auf die Warteliste? Du bekommst eine E-Mail, sobald die Zeit frei wird.</p>' : x.state.includes('wait') ? '<p>Du stehst schon auf der Warteliste.</p>' : ''}
          <div class="vh-err" id="bkmE"></div><div class="vh-row"><button class="no" id="bkmNo">${canWait ? 'Abbrechen' : 'Schließen'}</button>${canWait ? '<button class="ok" id="bkmOk">Vormerken</button>' : ''}</div></div>`;
        sh.classList.add('show');
        sh.querySelector('#bkmNo').onclick = close;
        if (canWait) sh.querySelector('#bkmOk').onclick = async () => {
          try { await ctx.api('wait', 'POST', { resource_id: r.id, date: day, start: hhmm(x.s), minutes: r.slot_min }); close(); ctx.toast('Vorgemerkt – du bekommst eine E-Mail, wenn frei.'); load(); } catch (e) { sh.querySelector('#bkmE').textContent = e.message; }
        };
      }
      function bookSheet(r, s) {
        const set = data.settings, p = data.plan;
        // längstmögliche Dauer: bis zur nächsten belegten Zeit, Schluss oder Höchstdauer
        let maxEnd = s;
        for (const x of slots(r, p, day, tm(data.now), data.today)) { if (x.s < s) continue; if (x.s !== maxEnd || x.state.split(' ')[0] !== 'free' || x.e - s > r.max_min) break; maxEnd = x.e; }
        const durs = []; for (let m = r.slot_min; s + m <= maxEnd; m += r.slot_min) durs.push(m);
        const partners = [], guests = [];
        const sh = sheet();
        sh.innerHTML = `<div class="vh-box"><h2>${esc(r.name)}</h2><p>${esc(wd(day, { weekday: 'long' }))}, ${deD(day)} · ab ${hhmm(s)} Uhr</p>
          <label class="l">Dauer</label><select class="vh-select" id="bkmD">${durs.map((m, i) => `<option value="${m}" ${i === Math.min(durs.length - 1, (60 / r.slot_min | 0) - 1) ? 'selected' : ''}>${dur(m)} · bis ${hhmm(s + m)} Uhr</option>`).join('')}</select>
          ${set.max_partners ? `<label class="l">Mitspieler <span style="font-weight:500">(optional, max. ${set.max_partners})</span></label><div class="bkm-chips" id="bkmPc"></div>
            <input class="vh-input" id="bkmPq" placeholder="Name suchen" autocomplete="off"><div class="bkm-hits" id="bkmPh" hidden></div>` : ''}
          ${set.max_guests ? `<label class="l">Gäste <span style="font-weight:500">(optional, ${euro(r.guest_fee_cents)} je Gast)</span></label><div class="bkm-chips" id="bkmGc"></div>
            <div class="bkm-row2"><input class="vh-input" id="bkmGq" placeholder="Vor- und Nachname" autocomplete="off" maxlength="60"><button id="bkmGa" style="margin-bottom:10px">+ Gast</button></div>` : ''}
          ${set.rules ? `<div class="bkm-rules">${esc(set.rules)}</div><label class="chk"><input type="checkbox" id="bkmR"> Ich halte mich an die Platzordnung.</label>` : ''}
          <div class="bkm-sum" id="bkmSum"></div>
          <div class="vh-err" id="bkmE"></div><div class="vh-row"><button class="no" id="bkmNo">Abbrechen</button><button class="ok" id="bkmOk">Buchen</button></div></div>`;
        sh.classList.add('show');
        const $q = id => sh.querySelector('#' + id);
        const sum = () => { $q('bkmSum').textContent = guests.length ? `Gastgebühr ${euro(guests.length * r.guest_fee_cents)} – wird mit deinem nächsten Beitragseinzug abgerechnet.` : ''; };
        const chips = () => {
          if ($q('bkmPc')) $q('bkmPc').innerHTML = partners.map(id => `<span>${esc((data.people.find(x => x.id === id) || {}).name || '')}<button data-rp="${id}" aria-label="entfernen">×</button></span>`).join('');
          if ($q('bkmGc')) $q('bkmGc').innerHTML = guests.map((g, i) => `<span>${esc(g)} (Gast)<button data-rg="${i}" aria-label="entfernen">×</button></span>`).join('');
          sh.querySelectorAll('[data-rp]').forEach(b => { b.onclick = () => { partners.splice(partners.indexOf(+b.dataset.rp), 1); chips(); }; });
          sh.querySelectorAll('[data-rg]').forEach(b => { b.onclick = () => { guests.splice(+b.dataset.rg, 1); chips(); }; });
          sum();
        };
        if ($q('bkmPq')) $q('bkmPq').oninput = () => {
          const q = $q('bkmPq').value.trim().toLowerCase(), h = $q('bkmPh');
          const hits = q.length < 2 ? [] : data.people.filter(x => !partners.includes(x.id) && x.name.toLowerCase().includes(q)).slice(0, 6);
          h.hidden = !hits.length;
          h.innerHTML = hits.map(x => `<button data-p="${x.id}">${esc(x.name)}</button>`).join('');
          h.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => { if (partners.length >= set.max_partners) { ctx.toast(`Höchstens ${set.max_partners} Mitspieler.`, true); return; } partners.push(+b.dataset.p); $q('bkmPq').value = ''; h.hidden = true; chips(); }; });
        };
        if ($q('bkmGa')) $q('bkmGa').onclick = () => {
          const g = $q('bkmGq').value.trim();
          if (g.length < 3) { $q('bkmE').textContent = 'Bitte Vor- und Nachname des Gastes eintragen.'; return; }
          if (guests.length >= set.max_guests) { $q('bkmE').textContent = `Höchstens ${set.max_guests} Gäste.`; return; }
          guests.push(g); $q('bkmGq').value = ''; $q('bkmE').textContent = ''; chips();
        };
        $q('bkmNo').onclick = close;
        $q('bkmOk').onclick = async () => {
          $q('bkmOk').disabled = true;
          try {
            const res = await ctx.api('book', 'POST', { resource_id: r.id, date: day, start: hhmm(s), minutes: +$q('bkmD').value, partners, guests, accept: $q('bkmR') ? $q('bkmR').checked : true });
            close(); ctx.toast(`Gebucht: ${r.name} ${hhmm(s)}–${hhmm(s + +$q('bkmD').value)} Uhr${res.fee_cents ? ` · Gastgebühr ${euro(res.fee_cents)}` : ''}`); load();
          } catch (e) { $q('bkmE').textContent = e.message; $q('bkmOk').disabled = false; if (/jemand anderes/.test(e.message)) load(); }
        };
      }
      function cancelSheet(b) {
        const sh = sheet();
        sh.innerHTML = `<div class="vh-box"><h2>Buchung stornieren?</h2><p>${esc(b.resource)} · ${esc(wd(b.date, { weekday: 'long' }))}, ${deD(b.date)} · ${b.start}–${b.end} Uhr${b.fee_cents ? `<br>Die Gastgebühr (${euro(b.fee_cents)}) entfällt.` : ''}</p>
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
