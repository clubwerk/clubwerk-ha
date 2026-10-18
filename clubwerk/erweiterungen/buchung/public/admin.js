'use strict';
/* Verwaltung „Buchungssystem“: Belegung · Serien & Sperren · Plätze & Geräte · Einstellungen */
(() => {
  const GK = window.GK;
  const { $, esc, euro, toast, fail, dialog, closeDialog, ask, askText, deDate, toCents, centsToInput } = GK;
  const api = (url, method, body) => GK.api('x/buchung/' + url, method, body);
  const st = { meta: null, day: null };
  const WD = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const TYPE = { buchung: ['g', 'Buchung'], serie: ['b', 'Serie'], sperre: ['r', 'Sperre'] };
  const opt = (v, l, sel) => `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
  const val = id => ($(id) ? $(id).value.trim() : undefined);
  const pill = ([c, t]) => `<span class="pill ${c}">${esc(t)}</span>`;
  const tm = s => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = s => { const d = new Date(s + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; };
  const dur = m => (m % 60 ? `${m} Min.` : `${m / 60} Std.`);
  const PX = 52;   // Pixel je Stunde im Belegungsplan

  if (!document.getElementById('bkStyle')) {
    const s = document.createElement('style'); s.id = 'bkStyle';
    s.textContent = `
      .bk-grid { display: grid; grid-template-columns: repeat(var(--c, 3), minmax(0, 1fr)); gap: 14px 16px; }
      .bk-grid .w2 { grid-column: span 2; } .bk-grid .wall { grid-column: 1 / -1; }
      @media (max-width: 900px) { .bk-grid { grid-template-columns: 1fr 1fr; } .bk-grid .w2 { grid-column: 1 / -1; } }
      @media (max-width: 560px) { .bk-grid { grid-template-columns: 1fr; } }
      .bk-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 16px; }
      .bk-bar .day { display: inline-flex; align-items: center; gap: 6px; }
      .bk-bar .day input { height: 40px; border: 1px solid var(--line); border-radius: 10px; padding: 0 10px; background: var(--field); color: var(--ink); font: inherit; font-size: 14px; }
      .bk-bar .day b { min-width: 34px; text-align: center; font-size: 14px; }
      .bk-wrap { overflow-x: auto; padding: 0 !important; }
      .bk-plan { display: grid; grid-template-columns: 58px repeat(var(--n), minmax(150px, 1fr)); min-width: calc(58px + var(--n) * 150px); }
      .bk-plan .hd { position: sticky; top: 0; z-index: 2; background: var(--card); border-bottom: 1px solid var(--line); padding: 12px 10px; font-weight: 800; font-size: 14px; text-align: center; min-height: 48px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; }
      .bk-plan .hd small { display: block; font-weight: 600; color: var(--muted); font-size: 11.5px; margin-top: 2px; }
      .bk-plan .times { position: relative; border-right: 1px solid var(--line); }
      .bk-plan .times span { position: absolute; right: 8px; transform: translateY(-50%); font-size: 11.5px; color: var(--faint); font-variant-numeric: tabular-nums; }
      .bk-plan .col { position: relative; border-right: 1px solid var(--line-soft); cursor: copy;
        background-image: linear-gradient(to bottom, var(--line-soft) 1px, transparent 1px); background-size: 100% ${PX}px; }
      .bk-plan .col:last-child { border-right: 0; }
      .bk-plan .closed { position: absolute; left: 0; right: 0; background: repeating-linear-gradient(135deg, var(--hover) 0 6px, transparent 6px 12px); pointer-events: none; }
      .bk-plan .now { position: absolute; left: 0; right: 0; height: 2px; background: var(--red); z-index: 1; pointer-events: none; }
      .bk-blk { position: absolute; border-radius: 9px; padding: 5px 8px; box-sizing: border-box; overflow: hidden; font-size: 12.5px; line-height: 1.3; cursor: pointer; border: 1px solid transparent; text-align: left; font: inherit; }
      .bk-blk b { display: block; font-size: 12px; font-variant-numeric: tabular-nums; } .bk-blk span { display: block; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bk-blk.buchung { background: var(--brand-soft); color: var(--brand-ink); border-color: color-mix(in srgb, var(--brand) 30%, transparent); }
      .bk-blk.serie { background: color-mix(in srgb, var(--blue, #2f6fd6) 14%, var(--card)); color: var(--ink); border-color: color-mix(in srgb, var(--blue, #2f6fd6) 35%, transparent); }
      .bk-blk.sperre { background: repeating-linear-gradient(135deg, var(--red-soft) 0 8px, color-mix(in srgb, var(--red-soft) 50%, var(--card)) 8px 16px); color: var(--red); border-color: color-mix(in srgb, var(--red) 30%, transparent); }
      .bk-legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted); margin: 10px 2px 0; }
      .bk-legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
      .bk-blk { display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; gap: 1px; }
      .bk-blk.lab { box-shadow: 0 1px 2px rgba(0,0,0,.12); } .bk-blk .tm { font-size: 11px; opacity: .8; }
      .bk-plan .hd.today { color: var(--brand-ink); box-shadow: inset 0 -3px 0 var(--brand); }
      .bk-sel { height: 40px; border: 1px solid var(--line); border-radius: 10px; padding: 0 10px; background: var(--field); color: var(--ink); font: inherit; font-size: 14px; }
      .bk-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 10px; vertical-align: -1px; }
      .bk-pal { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .bk-pal button { width: 30px; height: 30px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
      .bk-pal button.on { border-color: var(--ink); box-shadow: 0 0 0 2px var(--card) inset; }
      .bk-pal input[type=color] { width: 40px; height: 32px; border: 1px solid var(--line); border-radius: 8px; padding: 2px; background: var(--card); }
      .bk-prev { display: inline-block; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 13px; }
      .bk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .bk-chips label { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border: 1px solid var(--line); border-radius: 18px; font-size: 13.5px; font-weight: 600; cursor: pointer; background: var(--card); }
      .bk-chips label:has(input:checked) { background: var(--brand-soft); border-color: var(--brand); color: var(--brand-ink); }
      .bk-chips input { display: none; }
      #bdPc { margin-top: 6px; } #bdPc label { cursor: default; padding-right: 4px; } #bdPc:empty { display: none; }
      .bk-ser { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 14px 0; border-top: 1px solid var(--line-soft); }
      .bk-ser:first-of-type { border-top: 0; } .bk-ser h4 { margin: 0 0 4px; font-size: 15px; } .bk-ser .muted { font-size: 13px; }
      .bk-ser.off { opacity: .55; }
      .bk-clash { max-height: 220px; overflow: auto; margin: 8px 0 0; }
      .bk-tbl td { height: 52px; }
      @media (max-width: 760px) { .bk-tbl .hm { display: none; } }`;
    document.head.appendChild(s);
  }

  const PAGE = {
    'bk-belegung': ['Belegung', 'Wer spielt wann auf welchem Platz – in eine freie Stelle klicken, um für ein Mitglied zu buchen oder einen Platz zu sperren.'],
    'bk-serien': ['Serien & Sperren', 'Feste wöchentliche Termine für Training und Mannschaften – und Sperren für Platzpflege, Turniere oder den Winter.'],
    'bk-labels': ['Labels', 'Kennzeichnung von Vereinsbuchungen und Serien mit Name und Farbe – z. B. Training, Medenspiel, Clubmeisterschaft.'],
    'bk-plaetze': ['Plätze & Geräte', 'Was gebucht werden kann, mit Buchungszeiten, Zeitraster, Höchstdauer und Gastgebühr.'],
    'bk-einstellungen': ['Einstellungen', 'Regeln für Mitglieder: Vorlauf, Kontingent, Mitspieler, Gäste, Stornieren, Warteliste und Platzordnung.'],
  };
  const loadMeta = async () => { st.meta = await api('meta'); st.day = st.day || st.meta.today; return st.meta; };
  function pageRender(key, fn) {
    return async () => {
      await loadMeta();
      const [title, lead] = PAGE[key];
      $('main').innerHTML = `<h2 class="page">${esc(title)}</h2><p class="lead">${esc(lead)}</p><div id="bkBody"></div>`;
      await fn($('bkBody'));
    };
  }
  const resName = id => (st.meta.resources.find(r => r.id === id) || {}).name || '?';
  const personOpts = (sel, none = '– kein Mitglied –') => `<option value="">${esc(none)}</option>${st.meta.people.map(p => opt(p.id, GK.lastFirst(p.name, 'mitglied'), sel)).join('')}`;

  /* ---------------------------------------------------------------- Belegung (Tag: alle Plätze · Woche: ein Platz, 7 Tage) */
  const can = p => Boolean(st.meta && st.meta.can && st.meta.can[p]);
  /** gut lesbare Schrift auf der Labelfarbe */
  const ink = hex => { const n = parseInt(String(hex).slice(1), 16); const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#1b1f1c' : '#ffffff'; };
  const blkStyle = b => (b.label ? `background:${b.label.color};color:${ink(b.label.color)};border-color:transparent` : '');
  const blkText = b => (b.type === 'buchung'
    ? [b.label ? b.label.name : null, (b.who || []).filter(w => !b.label || w !== b.label.name).join(', ') || (b.title && (!b.label || b.title !== b.label.name) ? b.title : '')].filter(Boolean)
    : [b.title || (b.label && b.label.name) || '', b.label && b.title && b.title !== b.label.name ? b.label.name : null].filter(Boolean));
  const monday = d => addDays(d, 1 - dow(d));
  async function showPlan(el) {
    st.view = st.view || 'tag';
    const week = st.view === 'woche';
    const td = st.meta.today;
    let cols, bookingsOf, p, wk;
    if (week) {
      st.res = st.res || (st.meta.resources.find(r => r.active) || {}).id;
      wk = await api(`week?from=${monday(st.day)}&resource=${st.res || ''}`);
      if (!wk.resource) { el.innerHTML = '<div class="card"><p class="muted" style="margin:0">Noch keine Plätze angelegt – unter „Plätze &amp; Geräte“ anlegen.</p></div>'; return; }
      const r = wk.resource;
      cols = wk.days.map(d => ({ key: d.date, date: d.date, r, open: d.open, head: new Date(d.date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }), sub: d.date === td ? 'heute' : '' }));
      bookingsOf = c => wk.bookings.filter(b => b.date === c.date);
    } else {
      p = await api('day?date=' + st.day);
      cols = p.resources.filter(r => r.active).map(r => ({ key: r.id, date: st.day, r, open: r.open_today, head: r.name, sub: r.kind === 'artikel' ? `Gerät${r.quantity > 1 ? ` · ${r.quantity}×` : ''}` : (r.area || 'Platz') }));
      bookingsOf = c => p.bookings.filter(b => b.resource_id === c.r.id);
    }
    const lo = Math.min(...cols.map(c => tm(c.r.open_from)), 8 * 60), hi = Math.max(...cols.map(c => tm(c.r.open_to)), 20 * 60);
    const TOP = 12;   // Luft oben, damit die erste Uhrzeit nicht abgeschnitten wird
    const from = Math.floor(lo / 60) * 60, to = Math.ceil(hi / 60) * 60, H = (to - from) / 60 * PX + TOP * 2;
    const y = m => TOP + (m - from) / 60 * PX;
    const title = week ? `${new Date(cols[0].date + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${new Date(cols[6].date + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : new Date(st.day + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const lanes = bs => {   // überlappende Buchungen (Geräte mit Menge > 1) nebeneinander
      const out = []; const ends = [];
      bs.slice().sort((a, b) => a.start.localeCompare(b.start)).forEach(b => { let l = ends.findIndex(e => e <= b.start); if (l < 0) { l = ends.length; ends.push(b.end); } else ends[l] = b.end; out.push({ b, l }); });
      return { list: out, n: Math.max(1, ends.length) };
    };
    const nowM = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
    const all = week ? wk.bookings : p.bookings;
    const used = new Map(); all.forEach(b => { if (b.label) used.set(b.label.name, b.label.color); });
    el.innerHTML = `<div class="bk-bar"><div class="seg" id="bkV" style="width:fit-content"><button type="button" data-v="tag" class="${week ? '' : 'on'}">Tag</button><button type="button" data-v="woche" class="${week ? 'on' : ''}">Woche</button></div>
        ${week ? `<select id="bkRes" class="bk-sel" data-nodirty>${st.meta.resources.filter(r => r.active).map(r => opt(r.id, r.name, st.res)).join('')}</select>` : ''}
        <span class="day"><button class="btn small" id="bkPrev" aria-label="zurück">‹</button><input type="date" id="bkDay" value="${st.day}" data-nodirty><button class="btn small" id="bkNext" aria-label="vor">›</button></span>
        ${(week ? !cols.some(c => c.date === td) : st.day !== td) ? '<button class="btn small ghost" id="bkToday">Heute</button>' : ''}<b style="font-size:15px">${esc(title)}</b><span style="flex:1"></span>
        ${can('buchung_serien') ? '<button class="btn" id="bkLock">+ Sperre</button>' : ''}${can('buchung_buchen') ? '<button class="btn primary" id="bkNew">+ Buchung</button>' : ''}</div>
      ${cols.length ? `<div class="card bk-wrap"><div class="bk-plan" style="--n:${cols.length}">
        <div class="hd" style="border-right:1px solid var(--line)"></div>${cols.map(c => `<div class="hd${c.sub === 'heute' ? ' today' : ''}">${esc(c.head)}<small>${esc(c.sub || '')}</small></div>`).join('')}
        <div class="times" style="height:${H}px">${Array.from({ length: (to - from) / 60 + 1 }, (_, i) => `<span style="top:${TOP + i * PX}px">${hhmm(from + i * 60)}</span>`).join('')}</div>
        ${cols.map(c => { const r = c.r; const L = lanes(bookingsOf(c)); const o = tm(r.open_from), cl = tm(r.open_to);
          return `<div class="col" data-c="${esc(c.key)}" style="height:${H}px;background-position:0 ${TOP}px">
            ${c.open ? `${o > from ? `<div class="closed" style="top:0;height:${y(o)}px"></div>` : `<div class="closed" style="top:0;height:${TOP}px"></div>`}${cl < to ? `<div class="closed" style="top:${y(cl)}px;bottom:0"></div>` : ''}` : '<div class="closed" style="top:0;bottom:0"></div>'}
            ${c.date === td && nowM > from && nowM < to ? `<div class="now" style="top:${y(nowM)}px"></div>` : ''}
            ${L.list.map(({ b, l }) => { const w = 100 / L.n; const h = Math.max(22, y(tm(b.end)) - y(tm(b.start)) - 2); const t = blkText(b);
              return `<button class="bk-blk ${b.type}${b.label ? ' lab' : ''}" data-b="${b.id}" style="top:${y(tm(b.start)) + 1}px;height:${h}px;left:calc(${l * w}% + 3px);width:calc(${w}% - 6px);${blkStyle(b)}"><b>${t[0] ? esc(t[0]) : `${b.start}–${b.end}`}</b>${t[1] ? `<span>${esc(t[1])}</span>` : ''}${t[0] ? `<span class="tm">${b.start}–${b.end}</span>` : ''}</button>`; }).join('')}
          </div>`; }).join('')}
      </div></div>
      <div class="bk-legend">${[...used].map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('')}<span><i style="background:var(--brand-soft);border:1px solid var(--brand)"></i>Buchung</span><span><i style="background:var(--red-soft);border:1px solid var(--red)"></i>Sperre</span><span><i style="background:repeating-linear-gradient(135deg, var(--hover) 0 3px, transparent 3px 6px);border:1px solid var(--line)"></i>nicht buchbar</span></div>`
        : '<div class="card"><p class="muted" style="margin:0">Noch keine Plätze angelegt – unter „Plätze &amp; Geräte“ anlegen.</p></div>'}`;
    const again = () => showPlan(el).catch(fail);
    const go = d => { st.day = d; again(); };
    el.querySelectorAll('#bkV [data-v]').forEach(b => { b.onclick = () => { st.view = b.dataset.v; again(); }; });
    if ($('bkRes')) $('bkRes').onchange = () => { st.res = +val('bkRes'); again(); };
    $('bkPrev').onclick = () => go(addDays(st.day, week ? -7 : -1)); $('bkNext').onclick = () => go(addDays(st.day, week ? 7 : 1));
    $('bkDay').onchange = () => { if (val('bkDay')) go(val('bkDay')); };
    if ($('bkToday')) $('bkToday').onclick = () => go(td);
    if ($('bkNew')) $('bkNew').onclick = () => bookDialog({ date: st.day, resource_id: week ? st.res : undefined }, again);
    if ($('bkLock')) $('bkLock').onclick = () => bookDialog({ date: st.day, type: 'sperre', resource_id: week ? st.res : undefined }, again);
    if (can('buchung_buchen') || can('buchung_serien')) el.querySelectorAll('.col[data-c]').forEach(c => { c.onclick = e => {
      if (e.target.closest('.bk-blk')) return;
      const col = cols.find(x => String(x.key) === c.dataset.c), r = col.r;
      const m = from + (e.clientY - c.getBoundingClientRect().top - TOP) / PX * 60;
      const o = tm(r.open_from); let s = o + Math.floor((m - o) / r.slot_min) * r.slot_min; s = Math.max(o, Math.min(s, tm(r.open_to) - r.slot_min));
      bookDialog({ date: col.date, resource_id: r.id, start: hhmm(s), end: hhmm(s + r.slot_min) }, again);
    }; });
    el.querySelectorAll('[data-b]').forEach(b => { b.onclick = () => detail(all.find(x => x.id === +b.dataset.b), again); });
  }

  function bookDialog(pre, after) {
    const m = st.meta;
    let type = pre.type || (can('buchung_buchen') ? 'buchung' : 'sperre');
    const rs = m.resources.filter(r => r.active);
    const r0 = rs.find(r => r.id === pre.resource_id) || rs[0];
    if (!r0) return toast('Bitte zuerst einen Platz anlegen.', true);
    dialog(`<h2>${type === 'sperre' ? 'Platz sperren' : 'Buchung eintragen'}</h2>
      <div class="seg" id="bdT" style="width:fit-content;margin:0 0 14px">${can('buchung_buchen') ? '<button type="button" data-t="buchung">Buchung</button>' : ''}${can('buchung_serien') ? '<button type="button" data-t="sperre">Sperre</button>' : ''}</div>
      <div class="bk-grid" style="--c:4">
        <label class="f w2">Platz / Gerät<select id="bdR">${rs.map(r => opt(r.id, r.name, r0.id)).join('')}</select></label>
        <label class="f">Datum<input id="bdD" type="date" value="${pre.date || m.today}"></label>
        <label class="f">von<input id="bdS" type="time" value="${pre.start || r0.open_from}" step="900"></label>
        <label class="f">bis<input id="bdE" type="time" value="${pre.end || hhmm(tm(r0.open_from) + r0.slot_min)}" step="900"></label>
        <label class="f">Label<select id="bdL">${opt('', '– ohne –')}${m.labels.filter(l => l.active).map(l => opt(l.id, l.name)).join('')}</select></label>
        <label class="f bd-t w2">Titel / Grund<input id="bdTi" placeholder="z. B. Training Jugend"></label>
        <label class="f bd-b w2">Mitglied (bucht)<select id="bdM">${personOpts('', '– Verein (Label oder Titel) –')}</select></label>
        <label class="f bd-b w2">Mitspieler<select id="bdP"><option value="">+ Mitspieler hinzufügen …</option>${m.people.map(p => opt(p.id, GK.lastFirst(p.name, 'mitglied'))).join('')}</select><span class="bk-chips" id="bdPc"></span></label>
        <label class="f bd-b w2">Gäste (Namen, mit Komma getrennt)<input id="bdG" placeholder="z. B. Max Gast, Erika Besuch"><span class="muted s" style="font-weight:500">Gastgebühr ${euro(r0.guest_fee_cents != null ? r0.guest_fee_cents : m.settings.guest_fee_cents)} je Gast – als offener Posten beim Mitglied.</span><label class="chk" style="font-weight:500"><input type="checkbox" id="bdGp"> Gäste aus Partnerverein (keine Gebühr)</label></label>
        <label class="f w2" id="bdNL">Notiz (intern)<input id="bdN"></label>
      </div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="bdOk">Speichern</button></div>`, true);
    const paint = () => {
      $('dialog').querySelectorAll('#bdT [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === type));
      $('dialog').querySelector('h2').textContent = type === 'sperre' ? 'Platz sperren' : 'Buchung eintragen';
      $('dialog').querySelectorAll('.bd-b').forEach(x => { x.style.display = type === 'sperre' ? 'none' : ''; });
      $('bdNL').classList.toggle('wall', type === 'sperre'); $('bdNL').classList.toggle('w2', type !== 'sperre');
      $('bdTi').placeholder = type === 'sperre' ? 'z. B. Platzpflege' : 'optional, z. B. Lukas vs. Wendelin';

    };
    $('dialog').querySelectorAll('#bdT [data-t]').forEach(b => { b.onclick = () => { type = b.dataset.t; paint(); }; });
    const partners = [];
    const chips = () => { $('bdPc').innerHTML = partners.map(id => `<label>${esc((m.people.find(p => p.id === id) || {}).name || '')} <button type="button" class="btn small ghost" data-rp="${id}" style="height:24px;padding:0 6px" aria-label="entfernen">×</button></label>`).join('');
      $('bdPc').querySelectorAll('[data-rp]').forEach(b => { b.onclick = e => { e.preventDefault(); partners.splice(partners.indexOf(+b.dataset.rp), 1); chips(); }; }); };
    $('bdP').onchange = () => { const v = +val('bdP'); if (v && !partners.includes(v)) partners.push(v); $('bdP').value = ''; chips(); };
    paint();
    $('c').onclick = closeDialog;
    const send = async force => {
      const body = { type, resource_id: +val('bdR'), date: val('bdD'), start: val('bdS'), end: val('bdE'), title: val('bdTi'), note: val('bdN'), force, label_id: +val('bdL') || null,
        member_id: type === 'buchung' ? +val('bdM') || null : null, partners: type === 'buchung' ? partners.slice() : [],
        guests: type === 'buchung' ? val('bdG').split(',').map(x => x.trim()).filter(Boolean).map(name => ({ name, partner: $('bdGp').checked })) : [] };
      try { await api('bookings', 'POST', body); closeDialog(); toast(type === 'sperre' ? 'Gesperrt.' : 'Gebucht.'); after(); }
      catch (e) {
        if (e.status === 409 || /liegen in dieser Zeit/.test(e.message)) {
          if (await ask(`${e.message}\n\nTrotzdem sperren? Die Buchungen werden storniert und die Mitglieder per E-Mail informiert.`, { ok: 'Sperren und stornieren', danger: true })) send(true);
        } else fail(e);
      }
    };
    $('bdOk').onclick = () => send(false);
  }

  function detail(b, after) {
    const r = st.meta.resources.find(x => x.id === b.resource_id) || {};
    dialog(`<h2>${esc(r.name || '')} · ${b.start}–${b.end}</h2>
      <p class="muted" style="margin-top:0">${deDate(b.date)} · ${pill(TYPE[b.type])}${b.label ? ` <span class="pill" style="background:${b.label.color};color:${ink(b.label.color)}">${esc(b.label.name)}</span>` : ''}${b.series_id ? ' · aus einer Serie' : ''}</p>
      <table class="tbl" style="margin-bottom:10px">
        ${b.type === 'buchung' ? `<tr><td class="muted">Spieler</td><td><b>${esc((b.who || []).join(', ') || '–')}</b></td></tr>${b.title && b.member_id ? `<tr><td class="muted">Titel</td><td>${esc(b.title)}</td></tr>` : ''}` : `<tr><td class="muted">${b.type === 'sperre' ? 'Grund' : 'Titel'}</td><td><b>${esc(b.title || '')}</b></td></tr>`}
        ${b.fee_cents ? `<tr><td class="muted">Gebühr</td><td>${euro(b.fee_cents)}${b.charge_id ? ' · offener Posten in der Mitgliederverwaltung' : ''}</td></tr>` : ''}
        ${b.note ? `<tr><td class="muted">Notiz</td><td>${esc(b.note)}</td></tr>` : ''}
        <tr><td class="muted">Eingetragen</td><td>${esc(b.created_by || '')} · ${{ app: 'Mitglieder-App', tablet: 'Tablet', verwaltung: 'Verwaltung' }[b.source] || ''} · ${deDate(String(b.created_at).slice(0, 10))} ${String(b.created_at).slice(11, 16)}</td></tr>
      </table>
      <div class="btns">${(b.type === 'sperre' ? can('buchung_serien') || can('buchung_stornieren') : can('buchung_stornieren')) ? `<button class="btn ghost danger" id="bxC">${b.type === 'sperre' ? 'Sperre aufheben' : 'Stornieren'}</button>` : ''}<span style="flex:1"></span><button class="btn primary" id="c">Schließen</button></div>`);
    $('c').onclick = closeDialog;
    if ($('bxC')) $('bxC').onclick = async () => {
      const why = await askText(b.type === 'sperre' ? 'Sperre aufheben?\nOptional ein Hinweis fürs Protokoll:' : `Buchung stornieren?\n${b.member_id ? 'Das Mitglied bekommt eine E-Mail. ' : ''}Grund (optional):`, '', { ok: b.type === 'sperre' ? 'Aufheben' : 'Stornieren' });
      if (why == null) return;
      try { await api(`bookings/${b.id}/cancel`, 'POST', { reason: why }); closeDialog(); toast('Erledigt.'); after(); } catch (e) { fail(e); }
    };
  }

  /* ---------------------------------------------------------------- Serien & Sperren */
  async function showSeries(el) {
    const list = await api('series');
    const row = x => `<div class="bk-ser${x.active ? '' : ' off'}"><div style="min-width:0"><h4>${x.label ? `<i class="bk-dot" style="background:${x.label.color}"></i>` : ''}${esc(x.title)} ${pill(x.type === 'sperre' ? ['r', 'Sperre'] : ['b', 'Serie'])}${x.active ? '' : ' ' + pill(['', 'beendet'])}</h4>
        <div class="muted">${[x.weekdays.split('').map(d => WD[+d]).join(', '), `${x.start}–${x.end} Uhr`, `${deDate(x.from_date)} – ${deDate(x.to_date)}`, x.resources.map(resName).join(', '), x.member ? `für ${x.member}` : '', x.active ? `${x.count} kommende Termine` : ''].filter(Boolean).map(esc).join(' · ')}</div></div>
        <div>${x.active && can('buchung_serien') ? `<button class="btn small" data-end="${x.id}">${x.type === 'sperre' ? 'Aufheben' : 'Beenden'}</button>` : ''}</div></div>`;
    const act = list.filter(x => x.active), old = list.filter(x => !x.active);
    el.innerHTML = `${can('buchung_serien') ? '<div class="toolbar"><button class="btn primary" id="srNew">+ Serie</button><button class="btn" id="srLock">+ Sperre über Zeitraum</button></div>' : ''}
      <div class="card"><h3>Aktiv</h3>${act.length ? act.map(row).join('') : '<p class="muted">Keine. Zum Beispiel „Training Herren 40“ jeden Dienstag 18–20 Uhr auf Platz 1 und 2.</p>'}</div>
      ${old.length ? `<div class="card"><h3>Beendet</h3>${old.slice(0, 30).map(row).join('')}</div>` : ''}`;
    const again = () => showSeries(el).catch(fail);
    if ($('srNew')) $('srNew').onclick = () => seriesDialog('serie', again);
    if ($('srLock')) $('srLock').onclick = () => seriesDialog('sperre', again);
    el.querySelectorAll('[data-end]').forEach(b => { b.onclick = async () => {
      const x = list.find(y => y.id === +b.dataset.end);
      if (!await ask(`${x.type === 'sperre' ? 'Sperre' : 'Serie'} „${x.title}“ ${x.type === 'sperre' ? 'aufheben' : 'beenden'}?\n\nDie ${x.count} kommenden Termine werden entfernt, vergangene bleiben stehen.`, { ok: x.type === 'sperre' ? 'Aufheben' : 'Beenden', danger: true })) return;
      try { const r = await api(`series/${x.id}/end`, 'POST'); toast(`${r.removed} Termine entfernt.`); again(); } catch (e) { fail(e); }
    }; });
  }
  function seriesDialog(type, after) {
    const m = st.meta, rs = m.resources.filter(r => r.active);
    const y = +m.today.slice(0, 4);
    dialog(`<h2>${type === 'sperre' ? 'Sperre über einen Zeitraum' : 'Neue Serie'}</h2>
      <div class="bk-grid" style="--c:4">
        <label class="f">Label<select id="sxL">${opt('', '– ohne –')}${m.labels.filter(l => l.active).map(l => opt(l.id, l.name)).join('')}</select></label>
        <label class="f">${type === 'sperre' ? 'Grund' : 'Titel'}<input id="sxT" placeholder="${type === 'sperre' ? 'z. B. Winterpause' : 'leer = Name des Labels'}"></label>
        <label class="f">vom<input id="sxF" type="date" value="${m.today}"></label><label class="f">bis<input id="sxU" type="date" value="${type === 'sperre' ? m.today : `${y}-09-30`}"></label>
        <div class="f wall"><span>Plätze</span><div class="bk-chips">${rs.map(r => `<label><input type="checkbox" data-r="${r.id}"> ${esc(r.name)}</label>`).join('')}</div></div>
        <div class="f w2"><span>Wochentage</span><div class="bk-chips">${[1, 2, 3, 4, 5, 6, 7].map(d => `<label><input type="checkbox" data-d="${d}" ${type === 'sperre' ? 'checked' : ''}> ${WD[d]}</label>`).join('')}</div></div>
        <label class="f">von<input id="sxS" type="time" value="${type === 'sperre' ? '00:00' : '18:00'}" step="900"></label><label class="f">bis<input id="sxE" type="time" value="${type === 'sperre' ? '23:59' : '20:00'}" step="900"></label>
        ${type === 'serie' ? `<label class="f w2">Mitglied / Trainer (optional)<select id="sxM">${personOpts('')}</select></label>` : ''}
        <label class="f ${type === 'serie' ? 'w2' : 'wall'}">Notiz (intern)<input id="sxN"></label>
      </div>
      <p class="muted s">${type === 'sperre' ? 'Buchungen von Mitgliedern im gesperrten Zeitraum werden storniert, die Mitglieder bekommen eine E-Mail.' : 'Tage, an denen der Platz schon belegt ist, werden ausgelassen.'}</p>
      <div id="sxClash"></div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="sxOk">Prüfen</button></div>`, true);
    $('c').onclick = closeDialog;
    let checked = false;
    const body = () => ({ type, title: val('sxT'), from_date: val('sxF'), to_date: val('sxU'), start: val('sxS') === '23:59' ? '24:00' : val('sxS'), end: val('sxE') === '23:59' ? '24:00' : val('sxE'),
      resources: [...$('dialog').querySelectorAll('[data-r]:checked')].map(x => +x.dataset.r), weekdays: [...$('dialog').querySelectorAll('[data-d]:checked')].map(x => x.dataset.d).join(''),
      member_id: $('sxM') ? +val('sxM') || null : null, note: val('sxN'), label_id: +val('sxL') || null });
    $('dialog').addEventListener('change', () => { checked = false; $('sxOk').textContent = 'Prüfen'; });
    $('sxOk').onclick = async () => {
      try {
        if (!checked) {
          const p = await api('series', 'POST', { ...body(), preview: true });
          $('sxClash').innerHTML = `<div class="banner ${p.clash.length ? 'a' : ''}" style="display:block"><b>${p.days} Termine</b>${p.clash.length ? ` – ${p.clash.length} überschneiden sich mit bestehenden Buchungen${type === 'sperre' ? ' (werden storniert)' : ' (werden ausgelassen)'}:` : ' – keine Überschneidungen.'}
            ${p.clash.length ? `<div class="bk-clash"><table class="tbl">${p.clash.slice(0, 60).map(c => `<tr><td class="nw">${deDate(c.date)}</td><td class="nw">${c.start}–${c.end}</td><td>${esc(c.resource)}</td><td>${esc(c.type === 'buchung' ? (c.who || []).join(', ') : c.title || '')}</td></tr>`).join('')}</table></div>` : ''}</div>`;
          checked = true; $('sxOk').textContent = type === 'sperre' ? 'Sperren' : 'Serie anlegen'; return;
        }
        const r = await api('series', 'POST', body());
        closeDialog(); toast(`${r.made} Termine eingetragen${r.skipped ? `, ${r.skipped} ausgelassen` : ''}${r.cancelled ? `, ${r.cancelled} Buchungen storniert` : ''}.`); after();
      } catch (e) { fail(e); }
    };
  }

  /* ---------------------------------------------------------------- Labels */
  async function showLabels(el) {
    const list = await api('labels');
    const draw = () => {
      const q = (st.lq || '').toLowerCase();
      const rows = list.filter(l => !q || l.name.toLowerCase().includes(q));
      $('lbList').innerHTML = rows.length ? `<table class="tbl bk-tbl"><tr><th>Label</th><th class="r">kommende Termine</th><th></th></tr>
        ${rows.map(l => `<tr class="${l.active ? '' : 'off'}"><td><i class="bk-dot" style="background:${l.color}"></i><b>${esc(l.name)}</b>${l.active ? '' : ' <span class="muted s">· inaktiv</span>'}</td>
          <td class="r"><span class="pill g">${l.used}</span></td><td class="r">${can('buchung_einstellungen') ? `<button class="btn small" data-le="${l.id}">Bearbeiten</button>` : ''}</td></tr>`).join('')}</table>`
        : '<p class="muted" style="padding:24px;margin:0">Keine Labels gefunden.</p>';
      $('lbList').querySelectorAll('[data-le]').forEach(b => { b.onclick = () => labelDialog(list.find(l => l.id === +b.dataset.le), again); });
    };
    el.innerHTML = `<div class="filterbar"><label class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="lbQ" placeholder="Label suchen" value="${esc(st.lq || '')}" data-nodirty></label>
        <span style="flex:1"></span>${can('buchung_einstellungen') ? '<button class="btn primary" id="lbNew">+ Neues Label</button>' : ''}</div>
      <div class="card" style="padding:0;overflow:auto" id="lbList"></div>
      <p class="muted s">Labels kennzeichnen Vereinsbuchungen und Serien – z. B. Training, Medenspiel, Clubmeisterschaft, Schulsport. Sie erscheinen farbig im Belegungsplan, in der Mitglieder-App und am Tablet.</p>`;
    const again = async () => { await loadMeta(); showLabels(el).catch(fail); };
    $('lbQ').oninput = () => { st.lq = val('lbQ'); draw(); };
    if ($('lbNew')) $('lbNew').onclick = () => labelDialog(null, again);
    draw();
  }
  const PALETTE = ['#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', '#1e88e5', '#039be5', '#00897b', '#43a047', '#7cb342', '#c0ca33', '#fdd835', '#ffb300', '#fb8c00', '#f4511e', '#6d4c41', '#757575', '#546e7a', '#1b5e20', '#0d1b4f'];
  function labelDialog(l, after) {
    let color = l ? l.color : PALETTE[5];
    dialog(`<h2>${l ? esc(l.name) : 'Neues Label'}</h2>
      <div class="bk-grid" style="--c:2"><label class="f">Name<input id="lbN" value="${esc(l ? l.name : '')}" placeholder="z. B. Medenspiel Herren 40" maxlength="40"></label>
        <label class="f">Reihenfolge<input id="lbS" inputmode="numeric" value="${l ? l.sort : 100}"></label>
        <div class="f wall"><span>Farbe</span><div class="bk-pal">${PALETTE.map(c => `<button type="button" data-col="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}<input type="color" id="lbC" value="${color}" aria-label="eigene Farbe"></div></div>
        <div class="f wall"><span>Vorschau</span><div><span class="bk-prev" id="lbP"></span></div></div>
        ${l ? `<label class="chk wall"><input type="checkbox" id="lbA" ${l.active ? 'checked' : ''}> aktiv (inaktive Labels sind nicht mehr wählbar, bestehende Termine behalten sie)</label>` : ''}</div>
      <div class="btns">${l ? '<button class="btn ghost danger" id="lbDel">Löschen</button><span style="flex:1"></span>' : ''}<button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="lbOk">Speichern</button></div>`);
    const paint = () => { $('lbP').textContent = val('lbN') || 'Label'; $('lbP').style.background = color; $('lbP').style.color = ink(color); $('lbC').value = color;
      $('dialog').querySelectorAll('[data-col]').forEach(b => b.classList.toggle('on', b.dataset.col === color)); };
    $('dialog').querySelectorAll('[data-col]').forEach(b => { b.onclick = () => { color = b.dataset.col; paint(); }; });
    $('lbC').oninput = () => { color = $('lbC').value; paint(); }; $('lbN').oninput = paint; paint();
    $('c').onclick = closeDialog;
    $('lbOk').onclick = async () => {
      const body = { name: val('lbN'), color, sort: +val('lbS') || 100, ...(l ? { active: $('lbA').checked } : {}) };
      try { if (l) await api('labels/' + l.id, 'PUT', body); else await api('labels', 'POST', body); closeDialog(); toast('Gespeichert.'); after(); } catch (e) { fail(e); }
    };
    if ($('lbDel')) $('lbDel').onclick = async () => { if (!await ask(`Label „${l.name}“ löschen?\n\nGeht nur, solange es nicht verwendet wird – sonst auf „inaktiv“ setzen.`)) return; try { await api('labels/' + l.id, 'DELETE'); closeDialog(); toast('Gelöscht.'); after(); } catch (e) { fail(e); } };
  }

  /* ---------------------------------------------------------------- Plätze & Geräte */
  async function showResources(el) {
    const list = await api('resources');
    el.innerHTML = `${can('buchung_einstellungen') ? '<div class="toolbar"><button class="btn primary" id="rsNew">+ Platz</button><button class="btn" id="rsNewA">+ Gerät</button></div>' : ''}
      <div class="card" style="padding:0;overflow:auto">${list.length ? `<table class="tbl bk-tbl"><tr><th>Name</th><th class="hm">Buchbar</th><th class="hm">Raster</th><th class="hm">Gastgebühr</th><th class="r hm">kommende</th><th></th></tr>
        ${list.map(r => `<tr class="${r.active ? '' : 'off'}"><td><b>${esc(r.name)}</b><span class="muted s" style="display:block">${r.kind === 'artikel' ? `Gerät${r.quantity > 1 ? ` · ${r.quantity} Stück` : ''}` : esc(r.area || 'Platz')}${r.department_id ? ` · Abteilung ${esc((st.meta.departments.find(x => x.id === r.department_id) || {}).name || '')}${r.outsiders === 'gesperrt' ? ' (nur Abteilung)' : ` (andere ${euro(r.outsider_fee_cents)})`}` : ''}${r.active ? '' : ' · inaktiv'}</span></td>
          <td class="hm">${esc(r.days === '1234567' ? 'täglich' : r.days.split('').map(d => WD[+d]).join(', '))} · ${r.open_from}–${r.open_to}</td><td class="hm">${dur(r.slot_min)} · max. ${dur(r.max_min)}</td>
          <td class="hm">${r.guest_fee_cents == null ? `<span class="muted s">Standard (${euro(st.meta.settings.guest_fee_cents)})</span>` : euro(r.guest_fee_cents)}</td><td class="r hm">${r.future || '–'}</td>
          <td class="r">${can('buchung_einstellungen') ? `<button class="btn small" data-ed="${r.id}">Bearbeiten</button>` : ''}</td></tr>`).join('')}</table>` : '<p class="muted" style="padding:24px;margin:0">Noch nichts angelegt.</p>'}</div>`;
    const again = async () => { await loadMeta(); showResources(el).catch(fail); };
    if ($('rsNew')) $('rsNew').onclick = () => resDialog({ kind: 'platz' }, again);
    if ($('rsNewA')) $('rsNewA').onclick = () => resDialog({ kind: 'artikel' }, again);
    el.querySelectorAll('[data-ed]').forEach(b => { b.onclick = () => resDialog(list.find(r => r.id === +b.dataset.ed), again); });
  }
  function resDialog(r, after) {
    const isNew = !r.id, art = r.kind === 'artikel';
    const d = { days: '1234567', open_from: art ? '09:00' : '08:00', open_to: '22:00', slot_min: 60, max_min: art ? 120 : 120, quantity: 1, active: 1, ...r };
    dialog(`<h2>${isNew ? (art ? 'Gerät anlegen' : 'Platz anlegen') : esc(r.name)}</h2>
      <div class="bk-grid" style="--c:4">
        <label class="f w2">Name<input id="rsN" value="${esc(d.name || '')}" placeholder="${art ? 'z. B. Ballmaschine' : 'z. B. Platz 1'}"></label>
        <label class="f">Art<select id="rsK">${opt('platz', 'Platz', d.kind)}${opt('artikel', 'Gerät / Artikel', d.kind)}</select></label>
        <label class="f">Bereich (Reiter)<input id="rsA" value="${esc(d.area || '')}" placeholder="${art ? 'Geräte' : 'z. B. Tennis, Padel'}"></label>
        <div class="f wall"><span>buchbar an</span><div class="bk-chips">${[1, 2, 3, 4, 5, 6, 7].map(x => `<label><input type="checkbox" data-d="${x}" ${String(d.days).includes(String(x)) ? 'checked' : ''}> ${WD[x]}</label>`).join('')}</div></div>
        <label class="f">von<input id="rsF" type="time" value="${d.open_from}" step="900"></label><label class="f">bis<input id="rsT" type="time" value="${d.open_to === '24:00' ? '23:59' : d.open_to}" step="900"></label>
        <label class="f">Zeitraster<select id="rsS">${[15, 30, 45, 60, 90, 120].map(x => opt(x, dur(x), d.slot_min)).join('')}</select></label>
        <label class="f">Höchstdauer am Stück<select id="rsM">${[15, 30, 45, 60, 90, 120, 180, 240, 360, 480].map(x => opt(x, dur(x), d.max_min)).join('')}</select></label>
        <label class="f">Anzahl (gleichzeitig buchbar)<input id="rsQ" inputmode="numeric" value="${d.quantity}"></label>
        <label class="f">Gastgebühr je Gast<input id="rsG" inputmode="decimal" value="${d.guest_fee_cents == null ? '' : centsToInput(d.guest_fee_cents)}" placeholder="Standard ${centsToInput(st.meta.settings.guest_fee_cents)}"></label>
        <label class="f w2">Hinweis für Mitglieder<input id="rsH" value="${esc(d.note || '')}" placeholder="z. B. Sand – nach dem Spiel abziehen"></label>
        ${st.meta.departments.length ? `<label class="f w2">Gehört der Abteilung<select id="rsD">${opt('', '– ganzer Verein –', d.department_id)}${st.meta.departments.map(x => opt(x.id, x.name, d.department_id)).join('')}</select></label>
        <label class="f rs-dep">Andere Mitglieder<select id="rsO">${opt('gebuehr', 'buchen mit Platzgebühr', d.outsiders)}${opt('gesperrt', 'dürfen nicht buchen', d.outsiders)}</select></label>
        <label class="f rs-dep">Platzgebühr je Person<input id="rsOF" inputmode="decimal" value="${centsToInput(d.outsider_fee_cents != null ? d.outsider_fee_cents : 500)}"></label>` : ''}
        ${isNew ? '' : `<label class="chk wall"><input type="checkbox" id="rsAc" ${d.active ? 'checked' : ''}> aktiv (inaktive Plätze sind nicht buchbar und nicht im Plan)</label>`}
      </div>
      <div class="btns">${isNew ? '' : '<button class="btn ghost danger" id="rsDel">Löschen</button><span style="flex:1"></span>'}<button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="rsOk">Speichern</button></div>`, true);
    const depPaint = () => { if (!$('rsD')) return; const on = Boolean(val('rsD')); $('dialog').querySelectorAll('.rs-dep').forEach(x => { x.style.visibility = on ? '' : 'hidden'; }); if ($('rsOF')) $('rsOF').disabled = val('rsO') === 'gesperrt'; };
    if ($('rsD')) { $('rsD').onchange = depPaint; $('rsO').onchange = depPaint; } depPaint();
    $('c').onclick = closeDialog;
    $('rsOk').onclick = async () => {
      const body = { name: val('rsN'), kind: val('rsK'), area: val('rsA'), days: [...$('dialog').querySelectorAll('[data-d]:checked')].map(x => x.dataset.d).join(''),
        open_from: val('rsF'), open_to: val('rsT') === '23:59' ? '24:00' : val('rsT'), slot_min: +val('rsS'), max_min: +val('rsM'), quantity: +val('rsQ') || 1,
        guest_fee_cents: val('rsG') === '' ? null : toCents(val('rsG')), note: val('rsH'),
        ...($('rsD') ? { department_id: +val('rsD') || null, outsiders: val('rsO'), outsider_fee_cents: toCents(val('rsOF') || '0') } : {}), ...(isNew ? {} : { active: $('rsAc').checked }) };
      try { if (isNew) await api('resources', 'POST', body); else await api('resources/' + r.id, 'PUT', body); closeDialog(); toast('Gespeichert.'); after(); } catch (e) { fail(e); }
    };
    if ($('rsDel')) $('rsDel').onclick = async () => {
      if (!await ask(`„${r.name}“ löschen?\n\nGeht nur, solange es keine Buchungen dafür gibt – sonst auf „inaktiv“ setzen.`)) return;
      try { await api('resources/' + r.id, 'DELETE'); closeDialog(); toast('Gelöscht.'); after(); } catch (e) { fail(e); }
    };
  }

  /* ---------------------------------------------------------------- Einstellungen */
  async function showSettings(el) {
    const s = await api('settings');
    const num = (k, l, o = {}) => `<label class="f ${o.cls || ''}">${esc(l)}<input id="bs_${k}" inputmode="numeric" value="${s[k]}"></label>`;
    const chk = (k, l) => `<label class="chk"><input type="checkbox" id="bs_${k}" ${s[k] ? 'checked' : ''}> ${esc(l)}</label>`;
    el.innerHTML = `
      <div class="card"><h3>Buchungsregeln</h3>
        <div class="bk-grid" style="--c:4">${num('advance_days', 'Vorlauf (Tage im Voraus)')}${num('max_open_platz', 'offene Platzbuchungen je Mitglied')}${num('max_open_artikel', 'offene Gerätebuchungen je Mitglied')}
          <label class="f">Stornieren bis … vor Beginn<select id="bs_cancel_before_min">${[[0, 'bis zum Beginn'], [60, '1 Stunde'], [120, '2 Stunden'], [360, '6 Stunden'], [1440, '1 Tag']].map(([v, l]) => opt(v, l, s.cancel_before_min)).join('')}</select></label>
          ${num('max_partners', 'Mitspieler höchstens')}${num('max_guests', 'Gäste höchstens')}
          <label class="f">Gastgebühr je Gast (Standard)<input id="bs_guest_fee" inputmode="decimal" value="${centsToInput(s.guest_fee_cents)}"></label>${num('max_waits', 'Warteliste: Einträge je Mitglied')}</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
          ${chk('count_partners', 'Mitspieler zählen beim Kontingent mit (wer mitspielt, kann nicht gleichzeitig selbst buchen)')}
          ${chk('notify_partners', 'Mitspieler bekommen eine E-Mail, wenn sie eingetragen werden')}
          ${chk('show_names', 'Namen in der Belegung für alle Mitglieder sichtbar (sonst nur „belegt“)')}
          ${chk('waitlist', 'Warteliste: bei belegter Zeit vormerken, E-Mail sobald frei')}
          ${chk('tablet_booking', 'Am Tablet im Vereinsheim buchen (für heute, mit Name und PIN)')}</div>
        <p class="muted s">Gastgebühren werden als offener Posten beim buchenden Mitglied angelegt (Mitgliederverwaltung) und mit dem nächsten Einzug abgerechnet. Wird die Buchung storniert, entfällt der Posten.</p></div>
      ${st.meta.mv ? `<div class="card"><h3>Wer darf buchen?</h3><p class="muted s" style="margin-top:0">Gilt für die buchende Person und alle Mitspieler (aus der Mitgliederverwaltung). Die Verwaltung kann immer für jeden buchen.</p>
        <div class="f"><span>Mitgliedschaft</span><div class="bk-chips">${[['aktiv', 'aktiv'], ['ehren', 'Ehrenmitglied'], ['passiv', 'passiv / unterstützend'], ['ruhend', 'ruhend']].map(([k, l]) => `<label><input type="checkbox" data-st="${k}" ${s.allowed_status.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
        ${st.meta.fees.length ? `<div class="f" style="margin-top:12px"><span>Diese Beitragsarten dürfen <b>nicht</b> buchen (z. B. „Fördermitglied“)</span><div class="bk-chips">${st.meta.fees.map(f => `<label><input type="checkbox" data-bf="${f.id}" ${s.blocked_fees.includes(f.id) ? 'checked' : ''}> ${esc(f.name)}</label>`).join('')}</div></div>` : ''}</div>` : ''}
      <div class="card"><h3>Platzordnung</h3><p class="muted s" style="margin-top:0">Wird vor jeder Buchung angezeigt und muss bestätigt werden. Leer lassen, wenn nicht nötig.</p>
        <label class="f"><textarea id="bs_rules" rows="5" placeholder="z. B. Bitte nur mit Tennisschuhen spielen. Plätze nach dem Spiel abziehen und Linien kehren.">${esc(s.rules)}</textarea></label></div>
      <div class="card"><h3>Von unterwegs buchen</h3>
        <p class="muted s" style="margin-top:0">Damit Mitglieder auch außerhalb des Vereins-WLANs buchen können, wird nur die Mitglieder-App über einen <b>Cloudflare Tunnel</b> erreichbar gemacht – ohne offenen Port am Router; Verwaltung und Tablet bleiben intern. Einrichtung: Einstellungen → Sicherheit → „Externer Zugang“ und die Anleitung in der Dokumentation.</p></div>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" id="bsOk">Speichern</button></div>
      <div id="bkFunc"></div>`;
    GK.watch(el);
    $('bsOk').onclick = async () => {
      const b = { guest_fee_cents: toCents(val('bs_guest_fee') || '0'), rules: $('bs_rules').value, cancel_before_min: +val('bs_cancel_before_min') };
      for (const k of ['advance_days', 'max_open_platz', 'max_open_artikel', 'max_partners', 'max_guests', 'max_waits']) b[k] = +val('bs_' + k);
      for (const k of ['count_partners', 'notify_partners', 'show_names', 'waitlist', 'tablet_booking']) b[k] = $('bs_' + k).checked;
      if (el.querySelector('[data-st]')) { b.allowed_status = [...el.querySelectorAll('[data-st]:checked')].map(x => x.dataset.st); b.blocked_fees = [...el.querySelectorAll('[data-bf]:checked')].map(x => +x.dataset.bf); }
      try { await api('settings', 'PUT', b); GK.clean(); toast('Gespeichert.'); await loadMeta(); } catch (e) { fail(e); }
    };
    if (GK.funcBox) GK.funcBox($('bkFunc'), 'buchung', 'Buchungssystem', () => showSettings(el).catch(fail));
  }

  const G = { key: 'buchung', label: 'Buchungssystem', icon: 'kalender', order: 6 };
  const ANY = ['buchung', 'buchung_buchen', 'buchung_stornieren', 'buchung_serien', 'buchung_einstellungen'];
  GK.registerPage({ key: 'bk-belegung', title: 'Belegung', perm: ANY, render: pageRender('bk-belegung', showPlan), group: G });
  GK.registerPage({ key: 'bk-serien', title: 'Serien & Sperren', perm: ANY, render: pageRender('bk-serien', showSeries), group: G });
  GK.registerPage({ key: 'bk-labels', title: 'Labels', perm: ANY, render: pageRender('bk-labels', showLabels), group: G });
  GK.registerPage({ key: 'bk-plaetze', title: 'Plätze & Geräte', perm: ANY, render: pageRender('bk-plaetze', showResources), group: G });
  GK.registerPage({ key: 'bk-einstellungen', title: 'Einstellungen', perm: 'buchung_einstellungen', render: pageRender('bk-einstellungen', showSettings), group: G });
})();
