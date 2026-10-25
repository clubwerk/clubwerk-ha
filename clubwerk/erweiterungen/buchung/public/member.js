'use strict';
/* Bereich „Buchen“ in der Mitglieder-App: Plätze und Geräte buchen, eigene Buchungen, Warteliste */
(() => {
  if (!document.getElementById('bkmStyle')) {
    const s = document.createElement('style'); s.id = 'bkmStyle';
    s.textContent = `
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
      .bkm-blk { position: absolute; left: 3px; right: 3px; border-radius: 9px; padding: 4px 5px; box-sizing: border-box; overflow: hidden; border: 1px solid transparent; text-align: left; font: inherit; display: flex; flex-direction: column; z-index: 3;   /* über der Jetzt-Linie – Namen bleiben lesbar */
        background: var(--hover); color: var(--ink); border-color: var(--line); }
      .bkm-blk > b, .bkm-blk > span { display: block; flex: none; height: 15px; line-height: 15px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .bkm-blk > b:first-child { height: auto; max-height: 30px; white-space: normal; overflow-wrap: anywhere; hyphens: auto; -webkit-hyphens: auto; }   /* Buchungsart darf umbrechen statt „Meden…“ */
      .bkm-blk > b { font-weight: 800; } .bkm-blk > .tm { font-size: 11px; opacity: .85; font-variant-numeric: tabular-nums; }
      .bkm-blk.mine { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
      .bkm-blk.mine.lab { box-shadow: inset 0 0 0 2px var(--brand), inset 0 0 0 3px var(--card); }   /* Rahmen innen – ragt nicht in die Nachbarspalte */
      .bkm-nowbar { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 0 16px; border: 0; background: none; font: inherit; color: var(--ink); text-align: left; cursor: pointer; }
      .bkm-nowbar b { font-size: 14.5px; font-weight: 800; white-space: nowrap; } .bkm-nowbar span { flex: 1; min-width: 0; font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; }
      .bkm-nowbar i { width: 8px; height: 8px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(45deg); margin: -4px 2px 0 0; flex: none; transition: transform .15s; }
      .bkm-now.show .bkm-nowbar i { transform: rotate(-135deg); margin-top: 4px; }
      .bkm-nowbody { padding: 6px 16px 12px; border-top: 1px solid var(--line); }
      .bkm-nowbody h3 { margin: 10px 0 2px; font-size: 13px; font-weight: 800; color: var(--muted); }
      .bkm-nowbody > div:first-child, .bkm-now h3 + div { border-top: 0; }
      .bkm-nowbody > div { display: grid; grid-template-columns: 72px minmax(0, 1fr) auto; gap: 8px; align-items: baseline; padding: 4px 0; border-top: 1px solid var(--line-soft, var(--line)); font-size: 14px; }
      .bkm-nowbody > div[data-nl] { cursor: pointer; -webkit-tap-highlight-color: transparent; }
      .bkm-nowbody > div.open span { white-space: normal; overflow: visible; }
      .bkm-now span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .bkm-now small { color: var(--muted); font-size: 12.5px; font-variant-numeric: tabular-nums; }
      .bkm-now p { margin: 0; color: var(--muted); font-size: 14px; }
      .bkm-blk.sperre { background: repeating-linear-gradient(135deg, var(--red-soft) 0 8px, color-mix(in srgb, var(--red-soft) 50%, var(--card)) 8px 16px); color: var(--red); border-color: color-mix(in srgb, var(--red) 30%, transparent); }
      .bkm-hint { font-size: 12.5px; color: var(--muted); margin: -4px 2px 0; }
      .bkm-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; margin-top: 10px; }
      .bkm-slot { min-height: 56px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); font: inherit; color: var(--ink); padding: 6px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 0; }
      .bkm-slot b { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; } .bkm-slot span { font-size: 11px; font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 2px; }
      .bkm-slot.free { border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); } .bkm-slot.free span { color: var(--brand-ink); }
      .bkm-slot.busy { background: var(--hover); color: var(--muted); } .bkm-slot.busy b { color: var(--muted); }
      .bkm-slot.mine { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
      .bkm-scope { display: grid; gap: 8px; margin: 6px 0 4px; } .bkm-scope button { min-height: 48px; border-radius: 14px; border: 1px solid var(--line); background: var(--card, #fff); color: var(--ink); font-size: 16px; font-weight: 700; text-align: left; padding: 0 16px; font-family: inherit; } .bkm-slot.mine span { color: rgba(255,255,255,.9); }
      .bkm-slot.lock { background: repeating-linear-gradient(135deg, var(--red-soft) 0 6px, transparent 6px 12px); color: var(--red); border-color: var(--red-line, var(--line)); }
      .bkm-slot.past, .bkm-slot.closed { opacity: .38; }
      .bkm-slot.wait { box-shadow: inset 0 0 0 2px var(--amber); }
      .bkm-sheet .vh-box { max-width: 460px; text-align: left; max-height: 88vh; overflow: auto; }
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
      .vh-row a.ok.bkm-cal { display: flex; align-items: center; justify-content: center; min-height: 50px; border-radius: 14px; font-size: 16px; font-weight: 700; text-decoration: none; color: #fff; flex: 1.4; }
      /* heute: vergangene volle Stunden als schmale Leiste zusammengeklappt */
      .bkm-past { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 34px; border: 0; border-bottom: 1px solid var(--line); background: var(--hover); color: var(--muted); font: inherit; font-size: 12.5px; font-weight: 700; }
      .bkm-plan > .bkm-past { grid-column: 1 / -1; } .bkm-plan.wide > .bkm-past { justify-content: flex-start; padding-left: 12px; } .bkm-past b { font-variant-numeric: tabular-nums; font-weight: 800; } .bkm-past span { font-weight: 600; }
      .bkm-hidden { display: block; width: 100%; min-height: 36px; margin-top: 10px; border: 1px dashed var(--line); border-radius: 12px; background: transparent; color: var(--muted); font: inherit; font-size: 12.5px; font-weight: 700; }
      /* „Mit wem spielst du?“ – wählbare Chips (Gerät als Mitspieler, allein) */
      .bkm-pick { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; }
      .bkm-pick button { display: inline-flex; align-items: center; min-height: 34px; padding: 0 12px; border-radius: 17px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; font-size: 14px; font-weight: 700; }
      .bkm-pick button.on { background: var(--brand-soft); border-color: var(--brand); color: var(--brand-ink); }
      .bkm-sheet h3.l { margin: 10px 0 4px; font-size: 14.5px; font-weight: 800; }
      .bkm-req { font-size: 13px; color: var(--amber-ink, var(--muted)); background: var(--field); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; margin: 0 0 10px; }
      /* Buchungsfenster: alle Felder 48 px, gleiche Beschriftungen, Seltenes eingeklappt (.bkm-fold) */
      .bkm-form .vh-input, .bkm-form .vh-select { height: 48px; min-height: 48px; font-size: 16px; border-radius: 12px; padding: 0 14px; margin: 0 0 12px; }
      .bkm-form label.l { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--muted); margin: 0 0 6px; }
      .bkm-form label.l span { font-weight: 500; } .bkm-form label.l .vh-chip { font-weight: 800; }
      .bkm-two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 10px; } .bkm-two.one { grid-template-columns: 1fr; } .bkm-two .span2 { grid-column: 1 / -1; } .bkm-two > div { min-width: 0; }
      @media (max-width: 520px) { .bkm-two { grid-template-columns: 1fr; } }   /* Handy: Dauer und Art untereinander – sonst abgeschnitten */
      .bkm-lh { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: 2px 0 6px; } .bkm-lh label.l { margin: 0; }
      .bkm-links { display: flex; gap: 16px; flex: none; }
      .bkm-fold { padding: 12px 12px 0; margin: 0 0 12px; border-radius: 12px; background: var(--hover); }
      .bkm-fold .vh-check { margin-bottom: 12px; }
      .bkm-row2 { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; } .bkm-row2 .vh-btn { height: 48px; min-height: 48px; padding: 0 14px; font-size: 15px; border-radius: 12px; }
      .bkm-form p.bkm-req { text-wrap: wrap; margin: -4px 0 12px; padding: 0; border: 0; background: none; font-size: 13px; color: var(--muted); font-weight: 500; }
      .bkm-form p.bkm-for { margin: 0 0 12px; font-size: 14.5px; color: var(--ink); }
      .bkm-rl { margin: 2px 0 10px; } .bkm-rl .vh-check { margin: 0; flex: 1; }
      .bkm-form .bkm-rules { margin: 0 0 12px; }
      .bkm-form .vh-seg { margin-bottom: 12px; }
      .bkm-form .bkm-chips:empty { display: none; }
      .bkm-form .bkm-sum { margin: 4px 0 6px; }
      .bkm-form .vh-link { color: var(--brand-ink); }
      /* Ansicht „Ausführlich“: breite Platzspalten (wischen), Uhrzeiten und Platznamen bleiben stehen, ganze Namen in den Blöcken */
      .bkm-scroll.on { overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; }
      .bkm-plan.wide { grid-template-columns: 52px repeat(var(--n), minmax(150px, 1fr)); min-width: 100%; width: max-content; }
      .bkm-plan.wide .cl { scroll-snap-align: start; scroll-margin-left: 52px; }
      .bkm-plan.wide .tc, .bkm-plan.wide > .hd:first-child { position: sticky; left: 0; z-index: 5; background: var(--card); }
      .bkm-plan.wide .bkm-blk { padding: 5px 8px; }
      .bkm-plan.wide .bkm-blk > b, .bkm-plan.wide .bkm-blk > span { font-size: 12.5px; height: 16px; line-height: 16px; }`;
    document.head.appendChild(s);
  }
  const deD = d => (d ? d.split('-').reverse().join('.') : '');
  const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });   // einmal anlegen statt je Betrag
  const euro = c => EUR.format((c || 0) / 100);
  const tm = s => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  /** alle offenen Plätze mit gleicher Öffnungszeit? Dann steht sie nicht unter jedem Spaltenkopf (die Zeitachse zeigt sie) */
  const sameHours = rs => { const o = rs.filter(r => r.open_today); return o.length > 1 && o.every(r => r.open_from === o[0].open_from && r.open_to === o[0].open_to); };
  const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const wd = (s, o = { weekday: 'short' }) => new Date(s + 'T12:00:00').toLocaleDateString('de-DE', o);
  const dur = m => (m % 60 ? (m > 60 ? `${Math.floor(m / 60)} Std. ${m % 60} Min.` : `${m} Min.`) : `${m / 60} Std.`);
  const first = n => String(n || '').split(/[ ,]+/)[0];
  /** „Max Mustermann“ → „Max M.“ – passt auch in schmale Platz-Spalten */
  const shortName = n => { const t = String(n || '').trim(); if (t.includes(',')) { const [l, f] = t.split(',').map(x => x.trim()); return f ? `${f.split(/\s+/)[0]} ${l[0]}.` : l; } const w = t.split(/\s+/); return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : t; };

  const PH = 56;   // Pixel je Stunde in der Übersicht (kompakt)
  const PHW = 80;  // ausführlich: höher, damit die ganzen Namen in die Blöcke passen
  const ink = hex => { if (!/^#[0-9a-f]{6}$/i.test(String(hex))) return '#ffffff'; const n = parseInt(String(hex).slice(1), 16); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const L = 0.2126 * f(n >> 16 & 255) + 0.7152 * f(n >> 8 & 255) + 0.0722 * f(n & 255); return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0631 ? '#ffffff' : '#1b1f1c'; };   // Schriftfarbe mit dem besseren Kontrast (WCAG) zur Buchungsart-Farbe
  let view = 'plan'; try { view = localStorage.getItem('bkm_view') || 'plan'; } catch (e) { /* */ }
  /** Spieler samt Gerät als Mitspieler („+ Ballmaschine“) bzw. Allein-Training („· Ballwand“) */
  const whoTxt = (b, f = x => x) => `${b.who ? b.who.map(f).join(', ') : ''}${b.partner_device_name ? ` + ${b.partner_device_name}` : ''}${b.solo_label ? ` · ${b.solo_label}` : ''}`;
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
      else if (ov.length >= Math.max(1, r.quantity)) { state = 'busy'; booking = ov[0]; label = ov[0].label ? ov[0].label.name : ov[0].type === 'serie' ? (ov[0].title || 'Training') : ov[0].who ? whoTxt(ov[0], first) : 'belegt'; }
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
      let pastOpen = false;   // heute: vergangene Stunden aufgeklappt?
      let nowShown = false;   // „Jetzt auf der Anlage“ aufgeklappt?
      const nowOpen = new Set();   // „Jetzt auf der Anlage“: aufgeklappte Zeilen (alle Namen statt einer Zeile)
      const sheet = () => { let sh = document.getElementById('bkmSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'bkmSheet'; sh.className = 'vh-sheet bkm-sheet'; document.body.appendChild(sh); } return sh; };
      const close = () => { const s = document.getElementById('bkmSheet'); if (s) s.classList.remove('show'); };
      ctx.onLeave(() => { close(); clearInterval(timer); });

      async function load() {
        try { data = await ctx.api('me' + (day ? `?date=${day}` : '')); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        if (day && day !== data.plan.date) pastOpen = false;
        day = data.plan.date;
        draw();
      }
      function draw() {
        const d = data, p = d.plan, nowM = tm(d.now);
        const days = []; for (let x = d.today; x <= d.max; x = addDays(x, 1)) days.push(x);
        const areas = [...new Set(p.resources.map(r => r.area))];
        if (!areas.includes(area)) area = areas[0] || null;
        const rs = p.resources.filter(r => r.area === area);
        el.innerHTML = `${d.blocked ? `<div class="vh-bar a"><span><b>${esc(d.blocked)}</b><br>Bei Fragen bitte an den Vorstand wenden.</span></div>` : ''}<div class="vh-days">${days.map(x => `<button data-d="${x}" class="${x === day ? 'on' : ''}"><span>${x === d.today ? 'heute' : esc(wd(x))}</span><b>${+x.slice(8, 10)}.</b></button>`).join('')}</div>
          ${areas.length > 1 ? `<div class="vh-seg bkm-areas">${areas.map(a => `<button data-a="${esc(a)}" class="${a === area ? 'on' : ''}">${esc(a)}</button>`).join('')}</div>` : ''}
          <div class="vh-seg bkm-view">${[['plan', 'Kompakt'], ['wide', 'Ausführlich'], ['zeiten', 'Freie Zeiten']].map(([k, t]) => `<button data-v="${k}" class="${view === k ? 'on' : ''}">${t}</button>`).join('')}</div>
          ${rs.length && (view === 'plan' || view === 'wide') ? planHtml(rs, p, nowM) : rs.length ? rs.map(r => `<div class="vh-card"><h3>${esc(r.name)}<small>${r.open_today ? `${r.open_from}–${r.open_to} Uhr` : 'heute nicht buchbar'}</small></h3>${r.department || r.note ? `<p class="vh-lead">${r.department ? `Abteilung ${esc(r.department)}${r.outsiders === 'gesperrt' ? ' – nur für Abteilungsmitglieder' : r.outsider_fee_cents ? ` – andere Mitglieder ${euro(r.outsider_fee_cents)} Platzgebühr` : ''}` : ''}${r.department && r.note ? ' · ' : ''}${r.note ? esc(r.note) : ''}</p>` : ''}
            ${(() => { const all = slots(r, p, day, nowM, d.today); const gone = day === d.today && !pastOpen ? all.filter(x => x.e <= nowM && !/^mine/.test(x.state)).length : 0; const shown = gone ? all.filter(x => !(x.e <= nowM && !/^mine/.test(x.state))) : all;
              return `<div class="bkm-slots">${shown.map(x => `<button class="bkm-slot ${x.state}" data-r="${r.id}" data-s="${x.s}" ${x.booking && x.booking.label && !x.booking.mine ? `style="box-shadow:inset 0 -4px 0 ${x.booking.label.color}"` : ''} ${/past|closed/.test(x.state) ? 'disabled' : ''}><b>${hhmm(x.s)}</b><span>${esc(x.label)}</span></button>`).join('')}</div>
              ${gone ? `<button class="bkm-hidden" data-past="1">${gone} vergangene ${gone === 1 ? 'Zeit' : 'Zeiten'} ausgeblendet</button>` : ''}`; })()}</div>`).join('')
            : '<div class="vh-card"><p class="vh-none">Hier ist noch nichts buchbar.</p></div>'}
          <div class="vh-card"><h3>Meine Buchungen</h3><div class="vh-rows">${d.mine.length ? d.mine.map(b => `<div><span><strong>${esc(b.resource)} · ${b.start}–${b.end}</strong><small>${esc(wd(b.date, { weekday: 'long' }))}, ${deD(b.date)}${b.who && b.who.length > 1 ? ' · mit ' + esc(b.who.filter(w => w !== ctx.member).map(first).join(', ')) : ''}${b.partner_device_name ? ` + ${esc(b.partner_device_name)}` : ''}${b.solo_label ? ` · ${esc(b.solo_label)}` : ''}${b.fee_cents ? ` · Gebühr ${euro(b.fee_cents)}` : ''}${b.for_name ? ` · für ${esc(b.for_name)}` : b.own ? (b.booked_by ? ` · gebucht von ${esc(b.booked_by)}` : '') : ' · eingetragen als Mitspieler'}</small></span>
              <span class="bkm-acts"><a class="bkm-ical" href="${esc(b.ics)}" aria-label="In den Kalender" title="In den Kalender"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 13v5M9.5 15.5h5"/></svg></a>${b.canEdit ? `<button class="bkm-ical" data-e="${b.id}" aria-label="Ändern" title="Ändern"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/></svg></button>` : ''}${b.canCancel ? `<button class="vh-btn sm sec" data-c="${b.id}">Stornieren</button>` : ''}</span></div>`).join('') : '<p class="vh-none">Keine offenen Buchungen.</p>'}</div>
            ${d.series && d.series.length ? `<h3 style="margin-top:14px">Meine Serien</h3><div class="vh-rows">${d.series.map(x => `<div><span><strong>${esc(x.title)}</strong><small>${esc(x.resources.join(', '))} · ${esc(x.rule_text || x.weekdays.split('').map(n => ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][+n]).join(', '))} ${x.start}–${x.end} · bis ${deD(x.to_date)} · ${x.count} Termine</small></span><button class="vh-btn sm sec" data-se="${x.id}">Beenden</button></div>`).join('')}</div>` : ''}
            ${d.waits.length ? `<h3 style="margin-top:14px">Warteliste</h3><div class="vh-rows">${d.waits.map(w => `<div><span><strong>${esc(w.resource)} · ${w.start} Uhr</strong><small>${deD(w.date)}${w.notified_at ? ' · frei geworden – schnell buchen!' : ''}</small></span><button class="vh-btn sm sec" data-w="${w.id}">Entfernen</button></div>`).join('')}</div>` : ''}</div>`;
        el.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { day = b.dataset.d; load(); }; });
        el.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { area = b.dataset.a; draw(); }; });
        el.querySelectorAll('.bkm-view [data-v]').forEach(b => { b.onclick = () => { view = b.dataset.v; try { localStorage.setItem('bkm_view', view); } catch (e) { /* */ } draw(); }; });
        el.querySelectorAll('[data-past]').forEach(b => { b.onclick = () => { pastOpen = !pastOpen; draw(); }; });
        el.querySelectorAll('[data-nowt]').forEach(b => { b.onclick = () => { nowShown = !nowShown; draw(); }; });
        el.querySelectorAll('[data-nl]').forEach(b => { b.onclick = () => { const id = +b.dataset.nl; if (nowOpen.has(id)) nowOpen.delete(id); else nowOpen.add(id); b.classList.toggle('open'); b.setAttribute('aria-expanded', String(nowOpen.has(id))); }; });
        el.querySelectorAll('.bkm-plan .cl[data-r]').forEach(c => { c.onclick = e => {
          const r = p.resources.find(x => x.id === +c.dataset.r); if (!r || !r.open_today) return;
          const bk = e.target.closest('.bkm-blk');
          if (bk) { const s0 = +bk.dataset.s; return slotTap(r, s0); }
          const from = +c.dataset.from, m = from + (e.clientY - c.getBoundingClientRect().top - 6) / (view === 'wide' ? PHW : PH) * 60;
          const o = tm(r.open_from); const s0 = o + Math.floor((m - o) / r.slot_min) * r.slot_min;
          if (s0 < o || s0 + r.slot_min > tm(r.open_to)) return;
          slotTap(r, s0);
        }; });
        el.querySelectorAll('.bkm-slot[data-r]').forEach(b => { b.onclick = () => slotTap(p.resources.find(r => r.id === +b.dataset.r), +b.dataset.s); });
        el.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => cancelSheet(d.mine.find(x => x.id === +b.dataset.c)); });
        el.querySelectorAll('[data-se]').forEach(b => { b.onclick = async () => { const x = d.series.find(y => y.id === +b.dataset.se); if (!confirm(`Serie „${x.title}“ beenden? Die ${x.count} kommenden Termine werden freigegeben.`)) return; try { const r0 = await ctx.api(`series/${x.id}/end`, 'POST', {}); ctx.toast(`Beendet – ${r0.removed} Termine freigegeben.`); load(); } catch (e) { ctx.toast(e.message, true); } }; });
        el.querySelectorAll('[data-e]').forEach(b => { b.onclick = () => editBooking(d.mine.find(x => x.id === +b.dataset.e)); });
        el.querySelectorAll('[data-w]').forEach(b => { b.onclick = async () => { try { await ctx.api('wait', 'POST', { remove: true, id: +b.dataset.w }); ctx.toast('Von der Warteliste entfernt.'); load(); } catch (e) { ctx.toast(e.message, true); } }; });
        const on = el.querySelector('.vh-days .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
      }
      /** Übersicht: alle Plätze nebeneinander, Buchungen als Blöcke (wie im Vereinsheim-Plan) */
      function planHtml(rs, p, nowM) {
        const lo = Math.min(...rs.map(r => tm(r.open_from))), hi = Math.max(...rs.map(r => tm(r.open_to)));
        const from0 = Math.floor(lo / 60) * 60, to = Math.ceil(hi / 60) * 60, T = 12;   // T: Rand oben/unten, damit die erste und letzte Uhrzeit nicht angeschnitten wird
        const isToday = day === data.today;
        // heute: vergangene volle Stunden zusammenklappen – die Ansicht beginnt bei der aktuellen Stunde (Tipp auf die Leiste klappt auf)
        const cut = isToday ? Math.min(to - 60, Math.floor(nowM / 60) * 60) : from0;
        const folded = isToday && !pastOpen && cut > from0;
        const wide = view === 'wide', ph = wide ? PHW : PH;   // ausführlich: breite Spalten zum Wischen, ganze Namen
        const from = folded ? cut : from0, H = (to - from) / 60 * ph + T * 2;
        const y = m => T + (Math.max(m, from) - from) / 60 * ph;
        const blk = (r, b) => {
          const s0 = tm(b.start), e0 = tm(b.end), h = Math.max(20, y(e0) - y(s0) - 2), n = Math.max(1, Math.floor((h - (wide ? 10 : 8)) / (wide ? 16 : 15)));
          // Spieler je eine Zeile („Max M.“) – auf einen Blick, wer gerade spielt; die Uhrzeit nur, wenn noch Platz ist
          const names = b.type === 'buchung' && b.who ? [...b.who.map(wide ? (x => x) : shortName), ...(b.partner_device_name ? [b.partner_device_name] : []), ...(b.solo_label ? [b.solo_label] : [])] : [];
          const head = b.type === 'sperre' ? (b.title || 'gesperrt') : b.label ? b.label.name : b.type === 'serie' ? (b.title || 'Training') : '';
          const hm = t => (wide || t.slice(3) !== '00' ? t : String(+t.slice(0, 2)));   // schmal: volle Stunden kurz („20–22“), damit die Zeit nicht abgeschnitten wird
          const time = `${hm(b.start)}–${hm(b.end)}`;
          let ln = head ? [[head, 'b'], ...names.map(x => [x, '']), ...(!names.length && b.title && b.title !== head ? [[b.title, '']] : [])] : names.length ? names.map(x => [x, 'b']) : [[b.mine ? 'Meine Buchung' : 'belegt', 'b']];
          if (ln.length < n) ln.push([time, 'tm']);
          else if (ln.length > n) { const rest = ln.length - n + 1; ln = n === 1 ? [[ln.map(x => x[0]).join(', '), 'b']] : [...ln.slice(0, n - 1), [`+${rest} weitere`, 'tm']]; }
          // Buchungsart (z. B. Medenspiel) behält immer ihre Farbe – auch bei eigenen Buchungen; „meine“ zeigt dann ein Rahmen in Vereinsfarbe
          const st = b.label ? `background:${b.label.color};color:${ink(b.label.color)};border-color:transparent;` : '';
          return `<button class="bkm-blk ${b.mine ? 'mine' : ''} ${b.label ? 'lab' : ''} ${b.type === 'sperre' ? 'sperre' : ''}" data-s="${s0}" style="top:${y(s0) + 1}px;height:${h}px;${st}">${ln.map(([x, c]) => (c === 'b' ? `<b>${esc(x)}</b>` : `<span class="${c}">${esc(x)}</span>`)).join('')}</button>`;
        };
        // heute: wer gerade spielt und wer gleich kommt – kompakt über dem Raster
        let now = '';
        if (isToday && data.settings.show_now !== false) {
          const play = rs.map(r => ({ r, b: p.bookings.find(b => b.resource_id === r.id && tm(b.start) <= nowM && tm(b.end) > nowM) })).filter(x => x.b);
          const soon = p.bookings.filter(b => tm(b.start) > nowM && tm(b.start) <= nowM + 60).sort((a, c) => tm(a.start) - tm(c.start));
          const line = (b, pre) => { const r = rs.find(x => x.id === b.resource_id); const nm = b.type === 'buchung' && b.who ? b.who.map(shortName).join(', ') : b.label ? b.label.name : b.title || (b.type === 'sperre' ? 'gesperrt' : 'belegt');
            return `<div class="${nowOpen.has(b.id) ? 'open' : ''}" data-nl="${b.id}" role="button" tabindex="0" aria-expanded="${nowOpen.has(b.id)}"><b>${esc(r ? r.name : '')}</b><span>${esc(nm)}</span><small>${pre}</small></div>`; };
          // eingeklappt: eine Zeile mit Zusammenfassung – der Kalender zum Buchen bleibt im Mittelpunkt; antippen zeigt Plätze und Namen
          const sumTxt = [play.length ? `${play.length} belegt` : 'alles frei', soon.length ? `${soon.length} ${soon.length === 1 ? 'kommt' : 'kommen'}` : ''].filter(Boolean).join(' · ');
          if (play.length || soon.length) now = `<div class="vh-card flush bkm-now${nowShown ? ' show' : ''}"><button class="bkm-nowbar" data-nowt aria-expanded="${nowShown}"><b>Jetzt auf der Anlage</b><span>${esc(sumTxt)}</span><i aria-hidden="true"></i></button>
            ${nowShown ? `<div class="bkm-nowbody">${play.length ? play.map(x => line(x.b, `bis ${x.b.end}`)).join('') : '<p>Gerade spielt niemand.</p>'}
            ${soon.length ? `<h3>In der nächsten Stunde</h3>${soon.map(b => line(b, `ab ${b.start}`)).join('')}` : ''}</div>` : ''}</div>`;
        }
        return `${now}<div class="vh-card flush bkm-planwrap"><div class="bkm-scroll${wide ? ' on' : ''}"><div class="bkm-plan${wide ? ' wide' : ''}" style="--n:${rs.length};--ph:${ph}px">
          <div class="hd" style="border-right:1px solid var(--line)"></div>${rs.map(r => `<div class="hd"><b>${esc(r.name)}</b>${!r.open_today ? '<small>heute zu</small>' : sameHours(rs) ? '' : `<small>${r.open_from}–${r.open_to}</small>`}</div>`).join('')}${isToday && cut > from0 ? `<button class="bkm-past" data-past="1" aria-expanded="${pastOpen ? 'true' : 'false'}">${folded ? `<b>${hhmm(from0)}–${hhmm(cut)}</b><span>vorbei · antippen zum Aufklappen</span>` : '<span>vergangene Stunden wieder einklappen</span>'}</button>` : ''}
          <div class="tc" style="height:${H}px">${Array.from({ length: (to - from) / 60 + 1 }, (_, i) => `<span style="top:${T + i * ph}px">${hhmm(from + i * 60)}</span>`).join('')}</div>
          ${rs.map(r => { const o = tm(r.open_from), c = tm(r.open_to);
            const bs = p.bookings.filter(b => b.resource_id === r.id && tm(b.end) > from);
            return `<div class="cl" data-r="${r.id}" data-from="${from}" style="height:${H}px;background-position:0 ${T}px">
              ${r.open_today ? `${o > from ? `<div class="zu" style="top:0;height:${y(o)}px"></div>` : ''}<div class="zu" style="top:${y(c)}px;bottom:0"></div>` : '<div class="zu" style="top:0;bottom:0"></div>'}
              ${isToday && nowM > from ? `<div class="past" style="height:${Math.min(H, y(nowM))}px"></div>` : ''}${isToday && nowM > from && nowM < to ? `<div class="nowl" style="top:${y(nowM)}px"></div>` : ''}
              ${bs.map(b => blk(r, b)).join('')}</div>`; }).join('')}
        </div></div></div><p class="bkm-hint">${wide && rs.length > 2 ? 'Seitlich wischen für weitere Plätze · ' : ''}Freie Stelle antippen zum Buchen · eigene Buchung antippen zum Ändern oder Stornieren.</p>`;
      }
      function slotTap(r, s) {
        const sl0 = slots(r, data.plan, day, tm(data.now), data.today); const x = sl0.find(y => y.s === s) || sl0.find(y => y.s <= s && y.e > s); if (!x) return;
        const st = x.state.split(' ')[0];
        if (st === 'free') { if (data.blocked) { ctx.toast(data.blocked, true); return; } return bookSheet(r, s); }
        if (st === 'mine') {
          if (x.booking && x.booking.series && x.booking.own && x.booking.type === 'serie') return seriesSheet(r, x.booking);
          const m = data.mine.find(b => b.id === x.booking.id); if (m) (m.canEdit ? manageSheet(m) : cancelSheet(m)); return;
        }
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
      /** eigener Serientermin: erst was (ändern/absagen), dann für wen (nur diesen · diesen und folgende · gesamte Serie) */
      function seriesSheet(r, b) {
        const sh = sheet();
        const head = `<h2>${esc(b.title || r.name)}</h2><p>${esc(r.name)} · ${esc(wd(b.date, { weekday: 'long' }))}, ${deD(b.date)} · ${b.start}–${b.end} Uhr<br><small>Termin einer Serie</small></p>`;
        const step1 = () => {
          sh.innerHTML = `<div class="vh-box">${head}<div class="vh-row"><button class="no" id="bkmX" style="color:var(--red)">Absagen</button><button class="ok" id="bkmEd">Ändern</button></div>
            <div class="vh-row" style="margin-top:8px"><button class="no" id="bkmNo">Schließen</button></div></div>`;
          sh.classList.add('show');
          sh.querySelector('#bkmNo').onclick = close;
          sh.querySelector('#bkmX').onclick = () => scopeStep('cancel');
          sh.querySelector('#bkmEd').onclick = () => scopeStep('edit');
        };
        const scopeStep = action => {
          sh.innerHTML = `<div class="vh-box">${head}<p><b>${action === 'cancel' ? 'Was möchtest du absagen?' : 'Was möchtest du ändern?'}</b></p>
            <div class="bkm-scope"><button data-sc="one">Nur diesen Termin</button><button data-sc="following">Diesen und alle folgenden</button><button data-sc="all">Gesamte Serie</button></div>
            <div class="vh-err" id="bkmE"></div><div class="vh-row" style="margin-top:8px"><button class="no" id="bkmB">Zurück</button></div></div>`;
          sh.querySelector('#bkmB').onclick = step1;
          sh.querySelectorAll('[data-sc]').forEach(x => { x.onclick = () => (action === 'cancel' ? doCancel(x.dataset.sc, x.textContent) : editStep(x.dataset.sc, x.textContent)); });
        };
        const doCancel = async (scope, label) => {
          try { const r0 = await ctx.api(`series-booking/${b.id}`, 'POST', { scope, action: 'cancel' }); close(); ctx.toast(`Abgesagt (${label.toLowerCase()}): ${r0.cancelled} ${r0.cancelled === 1 ? 'Termin' : 'Termine'}.`); load(); }
          catch (e) { sh.querySelector('#bkmE').textContent = e.message; }
        };
        const editStep = (scope, label) => {
          const len = tm(b.end) - tm(b.start), step = r.slot_min || 30;
          const starts = []; for (let t = tm(r.open_from); t + step <= tm(r.open_to); t += step) starts.push(t);
          const lens = []; for (let m = step; m <= Math.max(len, (r.max_min || 120)); m += step) lens.push(m);
          sh.innerHTML = `<div class="vh-box">${head}<p><b>${esc(label)}</b> ändern</p>
            <label class="l">Beginn</label><select class="vh-input" id="bkmS">${starts.map(t => `<option value="${hhmm(t)}" ${hhmm(t) === b.start ? 'selected' : ''}>${hhmm(t)} Uhr</option>`).join('')}</select>
            <label class="l">Dauer</label><select class="vh-input" id="bkmM">${lens.map(m => `<option value="${m}" ${m === len ? 'selected' : ''}>${m % 60 ? m + ' Min.' : m / 60 + ' Std.'}</option>`).join('')}</select>
            <div class="vh-err" id="bkmE"></div>
            <div class="vh-row"><button class="no" id="bkmB">Zurück</button><button class="ok" id="bkmOk">Speichern</button></div></div>`;
          sh.querySelector('#bkmB').onclick = () => scopeStep('edit');
          const send = async force => {
            const fields = { start: sh.querySelector('#bkmS').value, minutes: +sh.querySelector('#bkmM').value };
            try {
              const r0 = await ctx.api(`series-booking/${b.id}`, 'POST', { scope, action: 'edit', fields, force });
              close(); ctx.toast(`Geändert: ${r0.changed} ${r0.changed === 1 ? 'Termin' : 'Termine'}${r0.skipped.length ? ` – ${r0.skipped.length} belegt und unverändert gelassen` : ''}.`); load();
            } catch (e) {
              if (e.status === 409 && !force) {
                sh.querySelector('#bkmE').innerHTML = `${esc(e.message)} Diese Tage bleiben, wie sie sind.`;
                const ok = sh.querySelector('#bkmOk'); ok.textContent = 'Trotzdem ändern'; ok.onclick = () => send(true); return;
              }
              sh.querySelector('#bkmE').textContent = e.message;
            }
          };
          sh.querySelector('#bkmOk').onclick = () => send(false);
        };
        step1();
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
        // „Mit wem spielst du?“: Gerät als Mitspieler (Ballmaschine) oder allein (Ballwand) – nur auf Plätzen
        const devices = r.kind === 'platz' ? (p.devices || []) : [];
        let device = ed && ed.edit.partner_device && devices.some(x => x.id === ed.edit.partner_device) ? ed.edit.partner_device : null, solo = Boolean(ed && ed.edit.solo && r.solo_label);
        const withWho = r.kind === 'platz' && (set.max_partners || set.max_guests || devices.length || r.solo_label);
        // Sonderrecht „für andere buchen“: für ein Mitglied ohne Handy buchen (Kontingent, Regeln und Gebühren gelten für dieses Mitglied)
        const mayFor = Boolean(data.rights && data.rights.forOthers);
        let forMember = ed ? ed.edit.for_member || null : null;
        const personName = id => ((data.people || []).find(x => x.id === id) || {}).ln || ((data.people || []).find(x => x.id === id) || {}).name || (ed && ed.for_name) || '';
        const sh = sheet();
        /* Aufbau (Styleguide): Kopf · Für wen · Dauer/Art · Mitspieler (Gast, Gerät eingeklappt) · Wiederholen (eingeklappt) · Platzordnung · Preis · Knöpfe.
           Alle Felder 48 px hoch, Beschriftungen gleich; Seltenes erst auf Antippen. */
        sh.innerHTML = `<div class="vh-box bkm-form"><h2>${ed ? 'Buchung ändern' : esc(r.name)}</h2><p>${ed ? `${esc(r.name)} · ` : ''}${esc(wd(day, { weekday: 'long' }))}, ${deD(day)}${ed ? '' : ` · ab ${hhmm(s)} Uhr`}</p>
          ${ed && forMember ? `<p class="bkm-for">Gebucht für <b>${esc(ed.for_name || personName(forMember))}</b></p>` : !ed && mayFor ? `<div class="vh-seg" id="bkmFw"><button type="button" data-fw="me" class="on">Für mich</button><button type="button" data-fw="other">Für ein anderes Mitglied</button></div>
            <div id="bkmFo" hidden><div class="bkm-chips" id="bkmFc"></div><input class="vh-input" id="bkmFq" placeholder="Für wen? Name suchen" autocomplete="off"><div class="bkm-hits" id="bkmFh" hidden></div></div>` : ''}
          <div class="bkm-two${labels.length || ed ? '' : ' one'}">
            ${ed ? `<div><label class="l">Beginn</label><select class="vh-select" id="bkmS">${starts.map(x => `<option value="${x}" ${x === s ? 'selected' : ''}>${hhmm(x)} Uhr</option>`).join('')}</select></div>` : ''}
            <div><label class="l">Dauer</label><select class="vh-select" id="bkmD"></select></div>
            ${labels.length ? `<div${ed ? ' class="span2"' : ''}><label class="l">Art</label><select class="vh-select" id="bkmL"><option value="">Normale Buchung</option>${labels.map(l => `<option value="${l.id}" ${lab && lab.id === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>` : ''}</div>
          ${labels.length ? `<div id="bkmTw"><label class="l">Titel <span>(optional)</span></label><input class="vh-input" id="bkmT" maxlength="80" placeholder="z. B. Herren 40 gegen TC Musterstadt" value="${esc(ed ? ed.edit.title || '' : '')}"></div>` : ''}
          ${withWho ? `<div class="bkm-lh"><label class="l">Mitspieler <span id="bkmPm"></span></label>
              <span class="bkm-links">${set.max_guests ? '<button type="button" class="vh-link" id="bkmGt">+ Gast</button>' : ''}${devices.length || r.solo_label ? `<button type="button" class="vh-link" id="bkmDt">${esc(devices.length ? devices[0].name : r.solo_label)}${devices.length + (r.solo_label ? 1 : 0) > 1 ? ' …' : ''}</button>` : ''}</span></div>
            <div class="bkm-chips" id="bkmPc"></div><div class="bkm-chips" id="bkmGc"></div>
            ${set.max_partners ? '<input class="vh-input" id="bkmPq" placeholder="Name suchen" autocomplete="off"><div class="bkm-hits" id="bkmPh" hidden></div>' : ''}
            ${set.max_guests ? `<div class="bkm-fold" id="bkmGw" hidden><label class="l">Gast hinzufügen <span id="bkmGm"></span></label><div class="bkm-row2"><input class="vh-input" id="bkmGq" placeholder="Name" autocomplete="off" maxlength="60"><button type="button" class="vh-btn sec" id="bkmGa">Hinzufügen</button></div>
              <label class="vh-check"><input type="checkbox" id="bkmGp"> Mitglied in einem Partnerverein (keine Gastgebühr)</label></div>` : ''}
            ${devices.length || r.solo_label ? `<div class="bkm-fold" id="bkmDw" hidden><label class="l">Ohne Mitspieler <span>(ohne Gebühr)</span></label><div class="bkm-pick" id="bkmPk">${devices.map(x => `<button type="button" data-dev="${x.id}">${esc(x.name)}</button>`).join('')}${r.solo_label ? `<button type="button" data-solo="1">${esc(r.solo_label)} (allein)</button>` : ''}</div></div>` : ''}
            <p class="bkm-req" id="bkmReq" hidden></p>` : ''}
          ${!ed && data.rights && data.rights.series ? `<div><div class="bkm-two one" id="bkmRg"><div><label class="l">Wiederholen</label><select class="vh-select" id="bkmRf"><option value="">nicht wiederholen</option><option value="daily:1">täglich</option><option value="weekly:1">jede Woche</option><option value="weekly:2">alle 2 Wochen</option><option value="weekly:3">alle 3 Wochen</option><option value="weekly:4">alle 4 Wochen</option><option value="monthly-day:1">jeden Monat am gleichen Tag</option><option value="monthly-nth:1">jeden Monat am gleichen Wochentag</option></select></div>
              <div id="bkmUW" hidden><label class="l">bis</label><input class="vh-input" type="date" id="bkmU" min="${addDays(day, 1)}" max="${addDays(day, 366)}"></div></div></div>` : ''}
          ${set.rules ? `<div class="bkm-lh bkm-rl"><label class="vh-check"><input type="checkbox" id="bkmR" ${ed ? 'checked' : ''}> Ich halte mich an die Platzordnung.</label><button type="button" class="vh-link" id="bkmRr">lesen</button></div>
            <div class="bkm-rules" id="bkmRules" hidden>${esc(set.rules)}</div>` : ''}
          <div class="bkm-sum" id="bkmSum"></div>
          <div class="vh-err" id="bkmE"></div><div class="vh-row"><button class="no" id="bkmNo">Abbrechen</button><button class="ok" id="bkmOk">${ed ? 'Speichern' : 'Buchen'}</button></div></div>`;
        sh.classList.add('show');
        const $q = id => sh.querySelector('#' + id);
        const fold = (btn, box, focus) => { if ($q(btn)) $q(btn).onclick = () => { const o = $q(box).hidden; $q(box).hidden = !o; $q(btn).classList.toggle('on', o); if (o && focus && $q(focus)) $q(focus).focus(); }; };
        fold('bkmGt', 'bkmGw', 'bkmGq'); fold('bkmDt', 'bkmDw'); fold('bkmRr', 'bkmRules');
        if (guests.length && $q('bkmGw')) $q('bkmGw').hidden = false;
        if ((device || solo) && $q('bkmDw')) $q('bkmDw').hidden = false;
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
          if ($q('bkmPm')) $q('bkmPm').textContent = `${r.partner_required ? 'Pflicht · ' : ''}max. ${maxP()}`;
          if ($q('bkmGm')) $q('bkmGm').textContent = lab && lab.free_rules ? 'ohne Gebühr' : r.guest_fee_cents ? `${euro(r.guest_fee_cents)} je Gast` : '';
        };
        let qn = 0;
        const body = () => ({ id: ed ? ed.id : undefined, resource_id: r.id, date: day, start: hhmm(start()), minutes: +$q('bkmD').value, partners, guests, label_id: lab ? lab.id : null, title: lab && $q('bkmT') ? $q('bkmT').value.trim() : '', partner_device: device, solo, for_member: forMember || undefined });
        /** Mitspieler-Pflicht: „Buchen“ erst aktiv, wenn Mitglied, Gast, Gerät oder „allein“ gewählt ist */
        const chosen = () => partners.length || guests.length || device || solo || (lab && lab.free_rules);
        const paintPick = () => {
          sh.querySelectorAll('[data-dev]').forEach(b => b.classList.toggle('on', +b.dataset.dev === device));
          const sb = sh.querySelector('[data-solo]'); if (sb) sb.classList.toggle('on', solo);
          const need = Boolean(r.partner_required && !chosen());
          if ($q('bkmReq')) { $q('bkmReq').hidden = !need; $q('bkmReq').textContent = `Zum Buchen ${['ein Mitglied', 'einen Gast', ...devices.map(x => x.name), ...(r.solo_label ? [r.solo_label] : [])].join(', ').replace(/, ([^,]*)$/, ' oder $1')} dazunehmen.`; }
          $q('bkmOk').disabled = need;
        };
        sh.querySelectorAll('[data-dev]').forEach(b => { b.onclick = () => { device = device === +b.dataset.dev ? null : +b.dataset.dev; paintPick(); sum(); }; });
        const sbtn = sh.querySelector('[data-solo]'); if (sbtn) sbtn.onclick = () => { solo = !solo; paintPick(); sum(); };
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
            // Mitspieler-Pflicht steht schon als Hinweis über der Auswahl – nicht doppelt zeigen
            if (e.status === 400) { $q('bkmSum').textContent = ''; $q('bkmE').textContent = r.partner_required && !chosen() && /Pflicht/.test(e.message) ? '' : e.message; }
          }
        };
        const chips = () => {
          if ($q('bkmPc')) $q('bkmPc').innerHTML = partners.map(id => `<span>${esc((data.people.find(x => x.id === id) || {}).name || '')}<button data-rp="${id}" aria-label="entfernen">×</button></span>`).join('');
          if ($q('bkmGc')) $q('bkmGc').innerHTML = guests.map((g, i) => `<span>${esc(g.name)} (${g.partner ? 'Partnerverein' : 'Gast'})<button data-rg="${i}" aria-label="entfernen">×</button></span>`).join('');
          sh.querySelectorAll('[data-rp]').forEach(b => { b.onclick = () => { partners.splice(partners.indexOf(+b.dataset.rp), 1); chips(); }; });
          sh.querySelectorAll('[data-rg]').forEach(b => { b.onclick = () => { guests.splice(+b.dataset.rg, 1); chips(); }; });
          paintPick(); sum();
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
        if ($q('bkmL')) $q('bkmL').onchange = () => { lab = labels.find(l => l.id === +$q('bkmL').value) || null; paintLab(); fillDur(); paintPick(); sum(); };
        if ($q('bkmS')) $q('bkmS').onchange = () => { fillDur(); sum(); };
        if ($q('bkmT')) $q('bkmT').onchange = sum;
        fillDur(); paintLab(); chips();
        $q('bkmD').onchange = sum;
        $q('bkmNo').onclick = close;
        const repeat = () => { const v = $q('bkmRf') ? $q('bkmRf').value : ''; if (!v) return null; const [k, n] = v.split(':'); return k === 'monthly-day' ? { freq: 'monthly', monthly: 'day', interval: +n } : k === 'monthly-nth' ? { freq: 'monthly', monthly: 'nth', interval: +n } : { freq: k, interval: +n }; };
        if ($q('bkmRf')) $q('bkmRf').onchange = () => { const on = Boolean($q('bkmRf').value); $q('bkmUW').hidden = !on; $q('bkmRg').classList.toggle('one', !on); if (on && !$q('bkmU').value) $q('bkmU').value = addDays(day, 56); $q('bkmOk').textContent = on ? 'Serie anlegen' : 'Buchen'; };
        if ($q('bkmFw')) {
          const paintFor = () => {
            $q('bkmFc').innerHTML = forMember ? `<span>${esc(personName(forMember))}<button data-rf="1" aria-label="entfernen">×</button></span>` : '';
            $q('bkmFq').hidden = Boolean(forMember);
            const x = $q('bkmFc').querySelector('[data-rf]'); if (x) x.onclick = () => { forMember = null; paintFor(); sum(); };
            if ($q('bkmRf')) { $q('bkmRf').disabled = Boolean(forMember) || $q('bkmFo').hidden === false; }
          };
          $q('bkmFw').querySelectorAll('[data-fw]').forEach(b => { b.onclick = () => {
            $q('bkmFw').querySelectorAll('[data-fw]').forEach(x => x.classList.toggle('on', x === b));
            const other = b.dataset.fw === 'other'; $q('bkmFo').hidden = !other; if (!other) forMember = null;
            paintFor(); if (other && !forMember) $q('bkmFq').focus(); sum();
          }; });
          $q('bkmFq').oninput = () => {
            const q = $q('bkmFq').value.trim().toLowerCase(), h = $q('bkmFh');
            const hits = q.length < 2 ? [] : (data.people || []).filter(x => x.name.toLowerCase().includes(q) || (x.ln || '').toLowerCase().includes(q)).slice(0, 6);
            h.hidden = !hits.length; h.innerHTML = hits.map(x => `<button type="button" data-fp="${x.id}">${esc(x.ln || x.name)}</button>`).join('');
            h.querySelectorAll('[data-fp]').forEach(b => { b.onclick = () => { forMember = +b.dataset.fp; $q('bkmFq').value = ''; h.hidden = true; paintFor(); sum(); }; });
          };
          paintFor();
        }
        $q('bkmOk').onclick = async () => {
          if ($q('bkmFo') && !$q('bkmFo').hidden && !forMember) { $q('bkmE').textContent = 'Bitte das Mitglied wählen, für das du buchst.'; return; }
          $q('bkmOk').disabled = true;
          if (repeat()) {   // Serie (Sonderrecht): Wiederholung ab diesem Tag bis zum gewählten Datum
            if (!$q('bkmU').value) { $q('bkmE').textContent = 'Bitte angeben, bis wann die Serie läuft.'; $q('bkmOk').disabled = false; return; }
            try {
              const bd = body(); const r0 = await ctx.api('series', 'POST', { resource_id: r.id, date: day, start: bd.start, minutes: bd.minutes, label_id: bd.label_id, title: bd.title, until: $q('bkmU').value, ...repeat() });
              sh.innerHTML = `<div class="vh-box" style="text-align:center"><h2>Serie angelegt ✓</h2><p>${esc(r.name)} · ${esc(r0.rule || '')} · ${bd.start}–${hhmm(tm(bd.start) + bd.minutes)} Uhr<br>${r0.made} Termine bis ${deD($q('bkmU').value)}${r0.skipped.length ? `<br>Schon belegt und ausgelassen: ${esc(r0.skipped.join(', '))}` : ''}</p><div class="vh-row"><button class="ok" id="bkmDone" style="flex:1">Fertig</button></div></div>`;
              sh.querySelector('#bkmDone').onclick = close; load();
            } catch (e) { $q('bkmE').textContent = e.message; $q('bkmOk').disabled = false; }
            return;
          }
          try {
            const bd = body(); const res = await ctx.api('book', 'POST', { ...bd, accept: $q('bkmR') ? $q('bkmR').checked : true });
            const s0 = start(), m = bd.minutes;
            sh.innerHTML = `<div class="vh-box" style="text-align:center"><h2>${ed ? 'Gespeichert ✓' : 'Gebucht ✓'}</h2><p>${res.for_name ? `für <b>${esc(res.for_name)}</b><br>` : ''}${esc(r.name)} · ${esc(wd(day, { weekday: 'long' }))}, ${deD(day)}<br><b>${hhmm(s0)}–${hhmm(s0 + m)} Uhr</b>${lab ? `<br>${esc(lab.name)}` : ''}${device ? `<br>+ ${esc((devices.find(x => x.id === device) || {}).name || 'Gerät')}` : ''}${solo ? `<br>${esc(r.solo_label)} (allein)` : ''}${partners.length ? `<br>${ed ? 'Deine Mitspieler werden informiert.' : 'Deine Mitspieler bekommen eine E-Mail.'}` : ''}${res.fee_cents ? `<br>Gebühr ${euro(res.fee_cents)}` : ''}</p>
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
