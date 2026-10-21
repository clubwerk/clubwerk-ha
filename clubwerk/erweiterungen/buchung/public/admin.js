'use strict';
/* Verwaltung „Buchungssystem“: Belegung · Serien & Sperren · Plätze & Geräte · Einstellungen */
(() => {
  const GK = window.GK;
  const { $, esc, euro, toast, fail, dialog, closeDialog, ask, askText, deDate, toCents, centsToInput } = GK;
  const api = (url, method, body) => GK.api('x/buchung/' + url, method, body);
  const BASE = 'api/admin/x/buchung/';
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
  const PX = 60;   // Pixel je Stunde im Belegungsplan
  /* Wiederholung: Auswahl → { freq, interval, monthly } (gleich in Serie, Sperre und „wiederholen“ im Buchungsdialog) */
  const REPEATS = [['daily:1', 'täglich'], ['weekly:1', 'wöchentlich'], ['weekly:2', 'alle 2 Wochen'], ['weekly:3', 'alle 3 Wochen'], ['weekly:4', 'alle 4 Wochen'], ['monthly-day:1', 'monatlich – gleicher Tag (z. B. jeden 15.)'], ['monthly-nth:1', 'monatlich – gleicher Wochentag (z. B. 2. Dienstag)']];
  const repeatOpts = sel => REPEATS.map(([v, l]) => opt(v, l, sel)).join('');
  const parseRepeat = v => { const [k, n] = String(v || 'weekly:1').split(':'); return k === 'monthly-day' ? { freq: 'monthly', monthly: 'day', interval: +n || 1 } : k === 'monthly-nth' ? { freq: 'monthly', monthly: 'nth', interval: +n || 1 } : { freq: k, interval: +n || 1 }; };
  /** Umfang bei Serienterminen: 'one' | 'following' | 'all' | null (abgebrochen) */
  function askScope(title, what) {
    return new Promise(resolve => {
      $('askBox').innerHTML = `<h2>${esc(title)}</h2><p>${esc(what)}</p>
        <div class="bk-scope"><button class="btn" data-sc="one">Nur diesen Termin</button><button class="btn" data-sc="following">Diesen und alle folgenden</button><button class="btn" data-sc="all">Gesamte Serie</button></div>
        <div class="btns"><button class="btn ghost" id="askNo">Abbrechen</button></div>`;
      $('askOverlay').classList.remove('hidden');
      const done = v => { $('askOverlay').classList.add('hidden'); document.removeEventListener('keydown', key); resolve(v); };
      const key = e => { if (e.key === 'Escape') done(null); };
      document.addEventListener('keydown', key);
      $('askNo').onclick = () => done(null);
      $('askBox').querySelectorAll('[data-sc]').forEach(b => { b.onclick = () => done(b.dataset.sc); });
    });
  }
  const SCOPE_TXT = { one: 'nur dieser Termin', following: 'dieser und alle folgenden', all: 'alle kommenden Termine der Serie' };

  if (!document.getElementById('bkStyle')) {
    const s = document.createElement('style'); s.id = 'bkStyle';
    s.textContent = `
      .bk-grid { display: grid; grid-template-columns: repeat(var(--c, 3), minmax(0, 1fr)); gap: 14px 16px; }
      .bk-grid .w2 { grid-column: span 2; } .bk-grid .wall { grid-column: 1 / -1; } .bk-grid .dim { opacity: .45; }
      /* Buchungsfenster der Verwaltung */
      .bd-form .bd-w3 { grid-column: span 3; }
      .bd-time { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 6px; align-items: center; } .bd-time > span { color: var(--muted); }
      .bd-sec { margin: 6px 0 -6px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
      .bd-links { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: -6px; } .bd-links .bk-chips:empty { display: none; } .bd-btns { display: flex; gap: 8px; margin-left: auto; }
      .bd-links .btn.on { background: var(--hover); }
      .bd-fold { padding: 12px 14px; border-radius: 12px; background: var(--hover); margin-top: -6px; }
      .bd-gn { display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; padding-bottom: 4px; }
      @media (max-width: 900px) { .bd-form .bd-w3 { grid-column: 1 / -1; } }
      .bk-scope { display: grid; gap: 8px; margin: 4px 0 14px; } .bk-scope .btn { justify-content: flex-start; height: 46px; font-size: 15px; }
      @media (max-width: 900px) { .bk-grid { grid-template-columns: 1fr 1fr; } .bk-grid .w2 { grid-column: 1 / -1; } }
      @media (max-width: 560px) { .bk-grid { grid-template-columns: 1fr; } }
      .bk-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 16px; }
      .bk-bar .day { display: inline-flex; align-items: center; gap: 6px; }
      .bk-bar .day input { height: 40px; border: 1px solid var(--line); border-radius: 10px; padding: 0 10px; background: var(--field); color: var(--ink); font: inherit; font-size: 14px; }
      .bk-bar .day b { min-width: 34px; text-align: center; font-size: 14px; }
      .bk-bar .bk-days { margin: 0; padding: 0; overflow: visible; }
      .bk-bar .bk-pick { height: 62px; border: 1px solid var(--line); border-radius: 14px; padding: 0 12px; background: var(--card); color: var(--ink); font: inherit; font-size: 14px; }
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
      .bk-pastbar { display: flex; justify-content: center; align-items: center; gap: 8px; width: 100%; min-height: 40px; border: 0; border-bottom: 1px solid var(--line); background: var(--card); color: var(--muted); font: inherit; font-size: 13.5px; cursor: pointer; }
      .bk-pastbar b { color: var(--ink); font-variant-numeric: tabular-nums; }
      .bk-plan .pastsh { position: absolute; left: 0; right: 0; top: 0; background: color-mix(in srgb, var(--hover) 70%, transparent); pointer-events: none; }
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
      .bk-pal { display: grid; grid-template-columns: repeat(7, 30px); gap: 10px; align-items: center; width: fit-content; }
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
      .bk-ord { display: inline-flex; gap: 4px; margin-right: 8px; vertical-align: middle; } .bk-ord .btn { width: 34px; min-width: 34px; padding: 0; justify-content: center; font-size: 15px; } .bk-ord .btn:disabled { opacity: .35; }
      .bk-hl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; padding: 0 !important; margin-bottom: 16px; }
      .bk-hlt { display: flex; flex-direction: column; gap: 2px; padding: 16px 20px; border-left: 1px solid var(--line-soft); min-width: 0; } .bk-hlt:first-child { border-left: 0; }
      .bk-hlt span { font-size: 12.5px; font-weight: 600; color: var(--muted); } .bk-hlt b { font-size: 18px; line-height: 26px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .bk-hlt small { font-size: 12.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bk-donut { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 24px; align-items: center; }
      .bk-dring { position: relative; width: 180px; height: 180px; } .bk-dc { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .bk-dc b { font-size: 24px; line-height: 30px; font-weight: 800; font-variant-numeric: tabular-nums; } .bk-dc span { font-size: 12px; color: var(--muted); }
      .bk-dleg { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
      .bk-dleg li { display: grid; grid-template-columns: 12px minmax(0, 1fr) 64px; gap: 10px; align-items: center; height: 26px; font-size: 13.5px; }
      .bk-dleg i { width: 12px; height: 12px; border-radius: 3px; } .bk-dleg b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .bk-dleg .r { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); }
      .bk-bars { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 6px; height: 200px; align-items: stretch; }
      .bk-bar1 { display: flex; flex-direction: column; gap: 6px; min-width: 0; } .bk-bar1 span { font-size: 11.5px; color: var(--muted); text-align: center; height: 16px; }
      .bk-bpair { flex: 1; display: flex; align-items: flex-end; justify-content: center; gap: 2px; border-bottom: 1px solid var(--line); }
      .bk-bpair i { width: 40%; max-width: 14px; border-radius: 4px 4px 0 0; background: var(--brand); min-height: 0; } .bk-bpair i.p { background: var(--line); }
      .bk-top { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
      .bk-top li { display: grid; grid-template-columns: 24px minmax(0, 160px) minmax(0, 1fr) 72px; gap: 12px; align-items: center; height: 30px; font-size: 13.5px; }
      .bk-top .n { width: 24px; height: 24px; border-radius: 12px; background: var(--hover); font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
      .bk-top li:nth-child(-n+3) .n { background: var(--brand); color: #fff; } .bk-top b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .bk-top .r { text-align: right; font-variant-numeric: tabular-nums; }
      @media (max-width: 900px) { .bk-hl { grid-template-columns: repeat(2, minmax(0, 1fr)); } .bk-hlt:nth-child(3) { border-left: 0; } .bk-hlt:nth-child(n+3) { border-top: 1px solid var(--line-soft); } }
      @media (max-width: 560px) { .bk-donut { grid-template-columns: 1fr; justify-items: center; } .bk-dleg { width: 100%; } .bk-top li { grid-template-columns: 24px minmax(0, 1fr) 0 64px; } .bk-top .bk-meter { display: none; } }
      .bk-lg td { vertical-align: middle; padding-top: 10px !important; padding-bottom: 10px !important; } .bk-lg td.nw { white-space: nowrap; }
      .bk-lg tr.bk-lgr { cursor: pointer; } .bk-lg tr.bk-lgr:hover td { background: var(--hover); } .bk-lg tr.off td { opacity: .6; }
      .bk-lg tr.bk-lgd td { height: auto; padding: 18px 0 8px !important; font-size: 15px; font-weight: 700; color: var(--ink); background: none !important; border-bottom: 1px solid var(--line); box-shadow: none !important; }
      .bk-lg tr.bk-lgr td:first-child { padding-left: 14px !important; }
      .bk-lgp { display: flex; flex-direction: column; gap: 6px; } .bk-lgp > div { display: flex; align-items: center; gap: 10px; min-height: 32px; } .bk-lgp span:not(.bk-av) { font-weight: 600; }
      .bk-av { width: 32px; height: 32px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 12.5px; font-weight: 800; letter-spacing: .02em; background-size: cover; background-position: center; }
      .bk-lgt { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
      @media (max-width: 700px) { .bk-lg tr.bk-lgd { display: block !important; border: 0 !important; background: none !important; padding: 0 !important; } .bk-lg tr.bk-lgd td { display: block !important; } }
      .bk-av { overflow: hidden; } .bk-av img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .bk-fl { flex-direction: row !important; align-items: center; gap: 8px !important; }
      .bk-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
      .bk-kpi { margin: 0 !important; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
      .bk-kh { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700; height: 36px; }
      .bk-ki { width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--brand-soft); color: var(--brand); }
      .bk-kpi.b .bk-ki { background: color-mix(in srgb, #2f6fd6 14%, var(--card)); color: #2f6fd6; } .bk-kpi.r .bk-ki { background: var(--red-soft); color: var(--red); }
      .bk-kv { display: flex; align-items: baseline; gap: 10px; height: 40px; } .bk-kv b { font-size: 30px; line-height: 40px; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
      .bk-d { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 11px; font-size: 12px; font-weight: 800; white-space: nowrap; }
      .bk-d.u { background: color-mix(in srgb, #24a03f 16%, var(--card)); color: #1c7f33; } .bk-d.w { background: var(--red-soft); color: var(--red); } .bk-d.n { background: var(--hover); color: var(--muted); }
      .bk-spark { display: block; width: 100%; height: 56px; }
      .bk-kpi .bk-meter { margin-top: 14px; } .bk-mlab { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--muted); height: 16px; margin-top: 6px; }
      .bk-meter { position: relative; height: 12px; border-radius: 6px; background: var(--hover); } .bk-meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 6px; background: var(--brand); }
      .bk-meter em { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: var(--ink); opacity: .55; border-radius: 1px; }
      .bk-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; } .bk-two > .card { margin: 0; display: flex; flex-direction: column; }
      .bk-res { display: flex; flex-direction: column; gap: 4px; }
      .bk-rr { display: grid; grid-template-columns: minmax(0, 150px) minmax(0, 1fr) 56px 76px; gap: 12px; align-items: center; height: 36px; font-size: 14px; }
      .bk-rr b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; } .bk-rr .r { text-align: right; font-variant-numeric: tabular-nums; } .bk-rr .bk-dot { margin-right: 8px; }
      .bk-mini { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: auto; padding-top: 16px; border-top: 1px solid var(--line-soft); }
      .bk-mini > div { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; } .bk-mini span { font-size: 12.5px; color: var(--muted); font-weight: 600; } .bk-mini b { font-size: 20px; line-height: 28px; }
      .bk-two .bk-res + .bk-mini, .bk-two p + .bk-mini { margin-top: auto; }
      .bk-ch { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; } .bk-ch h3 { margin: 0; }
      .bk-leg { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--muted); } .bk-leg i { width: 22px; height: 14px; border-radius: 3px; display: inline-block; } .bk-leg i:first-of-type { margin-left: 6px; } .bk-leg i:last-of-type { margin-right: 6px; }
      .bk-heatwrap { overflow-x: auto; padding-bottom: 4px; }
      .bk-heat { display: grid; grid-template-columns: 32px repeat(var(--w), minmax(14px, 1fr)); gap: 3px; min-width: calc(32px + var(--w) * 17px); align-items: center; }
      .bk-heat .mo { font-size: 11.5px; color: var(--muted); white-space: nowrap; min-width: 0; overflow: hidden; text-overflow: ellipsis; height: 16px; line-height: 16px; }
      .bk-heat .dl, .bk-bub .dl { font-size: 11.5px; color: var(--muted); }
      .bk-heat i { display: block; aspect-ratio: 1; border-radius: 3px; background: var(--hover); } .bk-heat i.out { background: transparent; }
      .bk-bub { display: grid; grid-template-columns: 32px repeat(var(--h), minmax(44px, 1fr)); min-width: calc(32px + var(--h) * 44px); align-items: center; }
      .bk-bub .hh { font-size: 11.5px; color: var(--muted); text-align: center; height: 24px; line-height: 24px; font-variant-numeric: tabular-nums; }
      .bk-bub .bc { height: 48px; display: flex; align-items: center; justify-content: center; border-top: 1px solid var(--line-soft); } .bk-bub .dl { height: 48px; line-height: 48px; border-top: 1px solid var(--line-soft); }
      .bk-bub .bc i { display: block; border-radius: 50%; }
      @media (max-width: 1100px) { .bk-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .bk-two { grid-template-columns: 1fr; } }
      @media (max-width: 560px) { .bk-kpis { grid-template-columns: 1fr; } .bk-rr { grid-template-columns: minmax(0, 1fr) 70px 56px 64px; } }
      .bk-blk { padding: 4px 8px; gap: 0; } .bk-blk > b, .bk-blk > span { display: block; flex: none; height: 15px; line-height: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
      .bk-blk > b { font-weight: 800; } .bk-blk > .tm { font-size: 11px; opacity: .85; font-variant-numeric: tabular-nums; }
      .bk-use { display: flex; flex-direction: column; gap: 12px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--field); }
      .bk-use .muted.s { margin: 0; }
      .bkf { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .bkf > span:first-child { font-size: 13px; line-height: 16px; font-weight: 600; color: var(--muted); }
      .bk-chips label { height: 40px; padding: 0 14px; border-radius: 20px; box-sizing: border-box; }
      .bk-pal input[type=color] { width: 30px; height: 30px; border-radius: 50%; padding: 0; border: 1px dashed var(--faint); background: var(--card); cursor: pointer; overflow: hidden; }
      .bk-pal input[type=color]::-webkit-color-swatch-wrapper { padding: 3px; } .bk-pal input[type=color]::-webkit-color-swatch { border: 0; border-radius: 50%; }
      #bkBody .toolbar .btn, #bkBody .filterbar .btn, .bk-bar .btn { min-height: 40px; height: 40px; box-sizing: border-box; }
      .bk-bar .day .btn { width: 40px; padding: 0; font-size: 18px; }
      .bk-bar .day input { width: 150px; box-sizing: border-box; }
      .bk-bar .seg { height: 40px; box-sizing: border-box; align-items: stretch; } .bk-bar .seg button { min-height: 0; }
      .bk-bar .bk-sel { width: 170px; }
      .bk-bar .ttl { font-size: 15px; white-space: nowrap; }
      .bk-act { display: flex; gap: 8px; margin-left: auto; }
      @media (max-width: 760px) {
        .bk-bar .ttl { order: -1; flex-basis: 100%; }
        .bk-act { flex-basis: 100%; margin-left: 0; } .bk-act .btn { flex: 1 1 0; }
        .bk-bar .bk-sel { flex: 1 1 0; width: auto; min-width: 0; } .bk-bar .day { flex: 1 1 auto; } .bk-bar .day input { flex: 1; width: auto; min-width: 0; }
      }
      @media (max-width: 700px) {
        #bkBody .filterbar .btn { flex: 1 1 100%; }
        #bkBody .card:has(> .bk-tbl) { padding: 0 !important; border: 0; background: none; box-shadow: none; }
        .bk-tbl tr:not(:first-child) { display: grid !important; grid-template-columns: minmax(0, 1fr) auto; column-gap: 12px; align-items: center; }
        .bk-tbl td { grid-column: 1 / -1; }
        .bk-tbl td:first-child { grid-column: 1; grid-row: 1; display: block !important; height: auto !important; min-height: 40px; text-align: left !important; } .bk-tbl td:first-child::before { content: none; }
        .bk-tbl td:first-child > .tcell { text-align: left; }
        .bk-tbl td:last-child { grid-column: 2; grid-row: 1; }
        .bk-chips { gap: 6px; } .bk-chips label { padding: 0 10px; min-width: 40px; justify-content: center; }
        .bk-tbl td:last-child::before { content: none; } .bk-tbl td:last-child:empty { display: none; }
      }
      @media (max-width: 760px) { .bk-tbl .hm { display: none; } }
      .bk-fees .mo { display: none; } @media (max-width: 760px) { .bk-fees .mo { display: block; } }
      .bk-fees td.nw { white-space: nowrap; }`;
    document.head.appendChild(s);
  }

  const PAGE = {
    'bk-belegung': ['Belegung', 'Wer spielt wann auf welchem Platz – in eine freie Stelle klicken, um für ein Mitglied zu buchen oder einen Platz zu sperren.'],
    'bk-serien': ['Serien & Sperren', 'Wiederkehrende Termine für Training und Mannschaften (täglich, wöchentlich, alle n Wochen, monatlich), Spielpläne vom Verband – und Sperren für Platzpflege, Turniere oder den Winter.'],
    'bk-labels': ['Buchungsarten', 'Kennzeichnung von Vereinsbuchungen und Serien mit Name und Farbe – z. B. Training, Medenspiel, Clubmeisterschaft.'],
    'bk-protokoll': ['Buchungsprotokoll', 'Alle Buchungen des Jahres – auch stornierte und Sperren –, filterbar nach Art, Platz und Namen, als CSV.'],
    'bk-auswertung': ['Auswertung', 'Auslastung je Platz und gesamt – gebuchte Stunden, Buchungen, Stornos, beliebte Zeiten, im Vergleich zum Vorjahr.'],
    'bk-gebuehren': ['Gebühren', 'Gast- und Platzgebühren aus Buchungen – offen, bezahlt oder storniert (Zahlungsstand aus der Mitgliederverwaltung).'],
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
  /** gut lesbare Schrift auf der Farbe der Buchungsart */
  const ink = hex => { const n = parseInt(String(hex).slice(1), 16); const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#1b1f1c' : '#ffffff'; };
  const blkStyle = b => (b.label ? `background:${b.label.color};color:${ink(b.label.color)};border-color:transparent` : '');
  /** Spieler einer Buchung samt Gerät als Mitspieler („+ Ballmaschine“) bzw. Allein-Training („· Ballwand“) */
  const whoTxt = b => `${(b.who || []).filter(w => !b.label || w !== b.label.name).join(', ')}${b.partner_device_name ? ` + ${b.partner_device_name}` : ''}${b.solo_label ? ` · ${b.solo_label}` : ''}`;
  const blkText = b => (b.type === 'buchung'
    ? [b.label ? b.label.name : null, whoTxt(b) || (b.title && (!b.label || b.title !== b.label.name) ? b.title : '')].filter(Boolean)
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
      cols = p.resources.filter(r => r.active).map(r => ({ key: r.id, date: st.day, r, open: r.open_today, head: r.name, sub: r.kind === 'artikel' ? `Gerät${r.quantity > 1 ? ` · ${r.quantity}×` : ''}` : (r.open_today ? `${r.open_from}–${r.open_to}` : 'heute zu') }));   // wie am Tablet und in der App: Öffnungszeit unter dem Namen
      bookingsOf = c => p.bookings.filter(b => b.resource_id === c.r.id);
    }
    const lo = Math.min(...cols.map(c => tm(c.r.open_from)), 8 * 60), hi = Math.max(...cols.map(c => tm(c.r.open_to)), 20 * 60);
    const TOP = 12;   // Luft oben, damit die erste Uhrzeit nicht abgeschnitten wird
    const nowM0 = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
    // heute (Tagesansicht): vergangene Stunden eingeklappt – wie am Tablet und in der Mitglieder-App; die Leiste klappt sie auf
    const from0 = Math.floor(lo / 60) * 60, to = Math.ceil(hi / 60) * 60;
    const isToday = !week && st.day === td, cut = isToday ? Math.min(to - 60, Math.floor(nowM0 / 60) * 60) : from0;
    const folded = isToday && !st.pastOpen && cut > from0;
    const from = folded ? cut : from0, H = (to - from) / 60 * PX + TOP * 2;
    const y = m => TOP + (Math.max(m, from) - from) / 60 * PX;
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
        ${week ? `<span class="day"><button class="btn" id="bkPrev" aria-label="zurück">‹</button><input type="date" id="bkDay" value="${st.day}" data-nodirty><button class="btn" id="bkNext" aria-label="vor">›</button></span>`
          : `<div class="vh-days bk-days" id="bkDays"><button class="nav" id="bkPrev" aria-label="Woche zurück">‹</button>${Array.from({ length: 7 }, (_, i) => addDays(monday(st.day), i)).map(d => `<button data-d="${d}" class="${d === st.day ? 'on' : ''}"><span>${d === td ? 'heute' : new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}</span><b>${+d.slice(8, 10)}.</b></button>`).join('')}<button class="nav" id="bkNext" aria-label="Woche vor">›</button></div>
             <input type="date" id="bkDay" class="bk-pick" value="${st.day}" data-nodirty title="Datum wählen" aria-label="Datum wählen">`}
        <button class="btn ghost bk-today" id="bkToday" style="${(week ? !cols.some(c => c.date === td) : monday(st.day) !== monday(td)) ? '' : 'display:none'}">Heute</button><b class="ttl">${esc(title)}</b>
        <span class="bk-act">${can('buchung_serien') ? '<button class="btn" id="bkLock">+ Sperre</button>' : ''}${can('buchung_buchen') ? '<button class="btn primary" id="bkNew">+ Buchung</button>' : ''}</span></div>
      ${cols.length ? `<div class="card bk-wrap">${isToday && cut > from0 ? `<button type="button" class="bk-pastbar" id="bkPast">${folded ? `<b>${hhmm(from0)}–${hhmm(cut)}</b> vorbei · klicken zum Aufklappen` : 'vergangene Stunden wieder einklappen'}</button>` : ''}<div class="bk-plan" style="--n:${cols.length}">
        <div class="hd" style="border-right:1px solid var(--line)"></div>${cols.map(c => `<div class="hd${c.sub === 'heute' ? ' today' : ''}">${esc(c.head)}<small>${esc(c.sub || '')}</small></div>`).join('')}
        <div class="times" style="height:${H}px">${Array.from({ length: (to - from) / 60 + 1 }, (_, i) => `<span style="top:${TOP + i * PX}px">${hhmm(from + i * 60)}</span>`).join('')}</div>
        ${cols.map(c => { const r = c.r; const L = lanes(bookingsOf(c).filter(b => tm(b.end) > from)); const o = tm(r.open_from), cl = tm(r.open_to);
          return `<div class="col" data-c="${esc(c.key)}" style="height:${H}px;background-position:0 ${TOP}px">
            ${c.open ? `${o > from ? `<div class="closed" style="top:0;height:${y(o)}px"></div>` : `<div class="closed" style="top:0;height:${TOP}px"></div>`}${cl < to ? `<div class="closed" style="top:${y(cl)}px;bottom:0"></div>` : ''}` : '<div class="closed" style="top:0;bottom:0"></div>'}
            ${c.date === td && nowM > from ? `<div class="pastsh" style="height:${Math.min(H, y(nowM))}px"></div>` : ''}${c.date === td && nowM > from && nowM < to ? `<div class="now" style="top:${y(nowM)}px"></div>` : ''}
            ${L.list.map(({ b, l }) => { const w = 100 / L.n; const h = Math.max(22, y(tm(b.end)) - y(tm(b.start)) - 2); const t = blkText(b);
              const time = `${b.start}–${b.end}`, n = Math.max(1, Math.floor((h - 8) / 15));
              let ln = t[0] ? [[t[0], 'b'], ...(t[1] ? [[t[1], '']] : []), [time, 'tm']] : [[time, 'b']];
              if (ln.length > n) ln = n === 1 ? [[t[0] ? `${t[0]} · ${time}` : time, 'b']] : ln.slice(0, n);
              return `<button class="bk-blk ${b.type}${b.label ? ' lab' : ''}" data-b="${b.id}" title="${esc([...t, time].join(' · '))}" style="top:${y(tm(b.start)) + 1}px;height:${h}px;left:calc(${l * w}% + 3px);width:calc(${w}% - 6px);${blkStyle(b)}">${ln.map(([x, c]) => (c === 'b' ? `<b>${esc(x)}</b>` : `<span class="${c}">${esc(x)}</span>`)).join('')}</button>`; }).join('')}
          </div>`; }).join('')}
      </div></div>
      <div class="bk-legend">${[...used].map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('')}<span><i style="background:var(--brand-soft);border:1px solid var(--brand)"></i>Buchung</span><span><i style="background:var(--red-soft);border:1px solid var(--red)"></i>Sperre</span><span><i style="background:repeating-linear-gradient(135deg, var(--hover) 0 3px, transparent 3px 6px);border:1px solid var(--line)"></i>nicht buchbar</span></div>`
        : '<div class="card"><p class="muted" style="margin:0">Noch keine Plätze angelegt – unter „Plätze &amp; Geräte“ anlegen.</p></div>'}`;
    const again = () => showPlan(el).catch(fail);
    const go = d => { st.day = d; again(); };
    el.querySelectorAll('#bkV [data-v]').forEach(b => { b.onclick = () => { st.view = b.dataset.v; again(); }; });
    if ($('bkRes')) $('bkRes').onchange = () => { st.res = +val('bkRes'); again(); };
    $('bkPrev').onclick = () => go(addDays(st.day, -7)); $('bkNext').onclick = () => go(addDays(st.day, 7));   // Tagesansicht: Pfeile blättern wochenweise, die Tage wählt man direkt (wie in App und Tablet)
    el.querySelectorAll('#bkDays [data-d]').forEach(b => { b.onclick = () => go(b.dataset.d); });
    $('bkDay').onchange = () => { if (val('bkDay')) go(val('bkDay')); };
    if ($('bkToday')) $('bkToday').onclick = () => go(td);
    if ($('bkPast')) $('bkPast').onclick = () => { st.pastOpen = !st.pastOpen; again(); };
    if ($('bkNew')) $('bkNew').onclick = () => bookDialog({ date: st.day, resource_id: week ? st.res : undefined }, again);
    if ($('bkLock')) $('bkLock').onclick = () => bookDialog({ date: st.day, type: 'sperre', resource_id: week ? st.res : undefined }, again);
    if (can('buchung_buchen') || can('buchung_serien')) el.querySelectorAll('.col[data-c]').forEach(c => { c.onclick = e => {
      if (e.target.closest('.bk-blk')) return;
      const col = cols.find(x => String(x.key) === c.dataset.c), r = col.r;
      const m = from + (e.clientY - c.getBoundingClientRect().top - TOP) / PX * 60;
      const o = tm(r.open_from); let s = o + Math.floor((m - o) / r.slot_min) * r.slot_min; s = Math.max(o, Math.min(s, tm(r.open_to) - r.slot_min));
      bookDialog({ date: col.date, resource_id: r.id, start: hhmm(s), end: hhmm(Math.min(tm(r.open_to), s + Math.max(60, r.slot_min))) }, again);   // Standard: 1 Stunde
    }; });
    el.querySelectorAll('[data-b]').forEach(b => { b.onclick = () => detail(all.find(x => x.id === +b.dataset.b), again); });
  }

  function bookDialog(pre, after) {
    const m = st.meta, ed = pre.edit || null;   // ed: bestehende Buchung bearbeiten
    let type = ed ? ed.type : pre.type || (can('buchung_buchen') ? 'buchung' : 'sperre');
    const rs = m.resources.filter(r => r.active || (ed && r.id === ed.resource_id));
    const r0 = rs.find(r => r.id === (ed ? ed.resource_id : pre.resource_id)) || rs[0];
    if (!r0) return toast('Bitte zuerst einen Platz anlegen.', true);
    const curL = ed && ed.label ? (m.labels.find(l => l.name === ed.label.name) || {}).id : null;
    const head = () => (ed ? (type === 'sperre' ? 'Sperre bearbeiten' : 'Buchung bearbeiten') : type === 'sperre' ? 'Platz sperren' : 'Buchung eintragen');
    dialog(`<h2>${head()}</h2>
      ${ed ? '' : `<div class="seg" id="bdT" style="width:fit-content;margin:0 0 14px">${can('buchung_buchen') ? '<button type="button" data-t="buchung">Buchung</button>' : ''}${can('buchung_serien') ? '<button type="button" data-t="sperre">Sperre</button>' : ''}</div>`}
      <!-- Aufbau: Wo & wann · Art · Wer spielt (Gäste eingeklappt) · Wiederholen (eingeklappt) · Notiz -->
      <div class="bk-grid bd-form" style="--c:4">
        <label class="f w2">Platz / Gerät<select id="bdR">${rs.map(r => opt(r.id, r.name, r0.id)).join('')}</select></label>
        <label class="f">Datum<input id="bdD" type="date" value="${ed ? ed.date : pre.date || m.today}"></label>
        <label class="f">Zeit<span class="bd-time"><input id="bdS" type="time" value="${ed ? ed.start : pre.start || r0.open_from}" step="900" aria-label="von"><span>–</span><input id="bdE" type="time" value="${ed ? ed.end : pre.end || hhmm(Math.min(tm(r0.open_to), tm(r0.open_from) + 60))}" step="900" aria-label="bis"></span></label>
        <label class="f">Buchungsart<select id="bdL">${opt('', '– ohne –')}${m.labels.filter(l => l.active && (l.usable || l.id === curL)).map(l => opt(l.id, l.name, curL)).join('')}</select></label>
        <label class="f bd-t bd-w3">Titel / Grund<input id="bdTi" placeholder="optional, z. B. Training Jugend" value="${esc(ed && ed.title && (!ed.label || ed.title !== ed.label.name) ? ed.title : '')}"></label>
        <div class="bd-sec wall bd-b">Wer spielt</div>
        <label class="f bd-b w2">Mitglied (bucht)<select id="bdM">${personOpts(ed ? ed.member_id : '', '– Verein (Buchungsart oder Titel) –')}</select></label>
        <label class="f bd-b w2">Mitspieler<select id="bdP"><option value="">+ Mitspieler hinzufügen …</option>${m.people.map(p => opt(p.id, GK.lastFirst(p.name, 'mitglied'))).join('')}</select></label>
        <div class="wall bd-links"><span class="bk-chips bd-b" id="bdPc"></span><span class="bd-btns"><button type="button" class="btn small ghost bd-b" id="bdGt">+ Gäste</button>${!ed && can('buchung_serien') ? '<button type="button" class="btn small ghost" id="bdRt">Wiederholen …</button>' : ''}</span></div>
        <div class="bd-b wall bd-fold" id="bdGw" hidden><div class="bk-grid" style="--c:4">
          <label class="f w2">Gäste (Namen, mit Komma getrennt)<input id="bdG" placeholder="z. B. Max Gast, Erika Besuch" value="${esc(ed ? (ed.guests || []).map(g => g.name).join(', ') : '')}"></label>
          <div class="f w2 bd-gn"><label class="chk" style="font-weight:500"><input type="checkbox" id="bdGp" ${ed && (ed.guests || []).length && ed.guests.every(g => g.partner) ? 'checked' : ''}> Gäste aus Partnerverein (keine Gebühr)</label><span class="muted s">Gastgebühr ${euro(r0.guest_fee_cents != null ? r0.guest_fee_cents : m.settings.guest_fee_cents)} je Gast – als offener Posten beim Mitglied.</span></div></div></div>
        ${!ed && can('buchung_serien') ? `<div class="wall bd-fold" id="bdRw" hidden><div class="bk-grid" style="--c:4"><label class="f" id="bdRL">wiederholen<select id="bdRf">${opt('', 'nicht wiederholen')}${repeatOpts('')}</select></label><label class="f" id="bdRU">bis<input id="bdRep" type="date" disabled></label><div class="f muted s w2" style="align-self:end;padding-bottom:11px" id="bdRH">Belegte Tage werden ausgelassen.</div></div></div>` : ''}
        <label class="f wall" id="bdNL">Notiz (intern)<input id="bdN" value="${esc(ed ? ed.note || '' : '')}" placeholder="nur für die Verwaltung sichtbar"></label>
      </div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="bdOk">Speichern</button></div>`, true);
    const paint = () => {
      $('dialog').querySelectorAll('#bdT [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === type));
      $('dialog').querySelector('h2').textContent = head();
      $('dialog').querySelectorAll('.bd-b').forEach(x => { x.style.display = type === 'sperre' ? 'none' : ''; });
      $('bdTi').placeholder = type === 'sperre' ? 'z. B. Platzpflege' : 'optional, z. B. Lukas vs. Wendelin';

    };
    $('dialog').querySelectorAll('#bdT [data-t]').forEach(b => { b.onclick = () => { type = b.dataset.t; paint(); }; });
    const fold = (btn, box) => { if ($(btn)) $(btn).onclick = () => { $(box).hidden = !$(box).hidden; $(btn).classList.toggle('on', !$(box).hidden); }; };
    fold('bdGt', 'bdGw'); fold('bdRt', 'bdRw');
    // Start verschoben: Ende rückt mit, die Dauer bleibt (Standard 1 Stunde)
    let dur = Math.max(15, tm(val('bdE')) - tm(val('bdS'))) || 60;
    $('bdS').onchange = () => { const s = tm(val('bdS')); if (s == null || isNaN(s)) return; $('bdE').value = hhmm(Math.min(24 * 60 - 15, s + dur)); };
    $('bdE').onchange = () => { const d0 = tm(val('bdE')) - tm(val('bdS')); if (d0 > 0) dur = d0; };
    if (ed && (ed.guests || []).length) { $('bdGw').hidden = false; $('bdGt').classList.add('on'); }
        if ($('bdRf')) $('bdRf').onchange = () => { $('bdRep').disabled = !val('bdRf'); if (val('bdRf') && !val('bdRep')) $('bdRep').value = addDays(val('bdD') || st.meta.today, 56); };
    const partners = ed ? (ed.partners || []).slice() : [];
    const chips = () => { $('bdPc').innerHTML = partners.map(id => `<label>${esc((m.people.find(p => p.id === id) || {}).name || '')} <button type="button" class="btn small ghost" data-rp="${id}" style="height:24px;padding:0 6px" aria-label="entfernen">×</button></label>`).join('');
      $('bdPc').querySelectorAll('[data-rp]').forEach(b => { b.onclick = e => { e.preventDefault(); partners.splice(partners.indexOf(+b.dataset.rp), 1); chips(); }; }); };
    $('bdP').onchange = () => { const v = +val('bdP'); if (v && !partners.includes(v)) partners.push(v); $('bdP').value = ''; chips(); };
    paint(); chips();
    $('c').onclick = closeDialog;
    const send = async force => {
      const body = { type, resource_id: +val('bdR'), date: val('bdD'), start: val('bdS'), end: val('bdE'), title: val('bdTi'), note: val('bdN'), force, label_id: +val('bdL') || null,
        member_id: type === 'buchung' ? +val('bdM') || null : null, partners: type === 'buchung' ? partners.slice() : [],
        guests: type === 'buchung' ? val('bdG').split(',').map(x => x.trim()).filter(Boolean).map(name => ({ name, partner: $('bdGp').checked })) : [] };
      if (!ed && $('bdRf') && val('bdRf')) {   // Serie aus dem Kalender: Wiederholung ab diesem Tag bis zum gewählten Datum, belegte Tage werden ausgelassen
        if (!val('bdRep')) { fail(new Error('Bitte angeben, bis wann wiederholt wird.')); return; }
        const sb = { type: type === 'sperre' ? 'sperre' : 'serie', resources: [body.resource_id], weekdays: String(dow(body.date)), ...parseRepeat(val('bdRf')), start: body.start, end: body.end, from_date: body.date, to_date: val('bdRep'), title: body.title, label_id: body.label_id, member_id: body.member_id, note: body.note };
        try { const r = await api('series', 'POST', sb); closeDialog(); toast(`${r.made} Termine angelegt${r.skipped ? `, ${r.skipped} belegte ausgelassen` : ''}${r.cancelled ? `, ${r.cancelled} Buchungen storniert` : ''}.`); after(); } catch (e) { fail(e); }
        return;
      }
      try { if (ed) await api('bookings/' + ed.id, 'PUT', body); else await api('bookings', 'POST', body); closeDialog(); toast(ed ? 'Gespeichert.' : type === 'sperre' ? 'Gesperrt.' : 'Gebucht.'); after(); }
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
        ${b.type === 'buchung' ? `<tr><td class="muted">Spieler</td><td><b>${esc(whoTxt(b) || '–')}</b></td></tr>${b.title && b.member_id ? `<tr><td class="muted">Titel</td><td>${esc(b.title)}</td></tr>` : ''}` : `<tr><td class="muted">${b.type === 'sperre' ? 'Grund' : 'Titel'}</td><td><b>${esc(b.title || '')}</b></td></tr>`}
        ${b.fee_cents ? `<tr><td class="muted">Gebühr</td><td>${euro(b.fee_cents)}${b.charge_id ? ' · offener Posten in der Mitgliederverwaltung' : ''}</td></tr>` : ''}
        ${b.note ? `<tr><td class="muted">Notiz</td><td>${esc(b.note)}</td></tr>` : ''}
        <tr><td class="muted">Eingetragen</td><td>${esc(b.created_by || '')}${b.booked_by ? ' (für ein anderes Mitglied gebucht)' : ''} · ${{ app: 'Mitglieder-App', tablet: 'Tablet', verwaltung: 'Verwaltung', import: 'Spielplan-Import' }[b.source] || ''} · ${deDate(String(b.created_at).slice(0, 10))} ${String(b.created_at).slice(11, 16)}</td></tr>
      </table>

      <div class="btns">${b.series_id ? (can('buchung_serien') ? `<button class="btn ghost danger" id="bxC">${b.type === 'sperre' ? 'Aufheben …' : 'Stornieren …'}</button>` : '') : (b.type === 'sperre' ? can('buchung_serien') || can('buchung_stornieren') : can('buchung_stornieren')) ? `<button class="btn ghost danger" id="bxC">${b.type === 'sperre' ? 'Sperre aufheben' : 'Stornieren'}</button>` : ''}<span style="flex:1"></span>${b.series_id ? (can('buchung_serien') ? '<button class="btn" id="bxE">Bearbeiten …</button>' : '') : (b.type === 'sperre' ? can('buchung_serien') : can('buchung_buchen')) ? '<button class="btn" id="bxE">Bearbeiten</button>' : ''}<button class="btn primary" id="c">Schließen</button></div>`);
    $('c').onclick = closeDialog;
    if (b.series_id) {   // Termin einer Serie oder Sperre: erst den Umfang wählen
      if ($('bxE')) $('bxE').onclick = async () => { const sc = await askScope('Serientermin bearbeiten', `${b.title || ''} · ${deDate(b.date)} ${b.start}–${b.end}`); if (sc) { closeDialog(); seriesEdit(b, sc, after); } };
      if ($('bxC')) $('bxC').onclick = async () => {
        const sc = await askScope(b.type === 'sperre' ? 'Sperre aufheben' : 'Serientermin stornieren', `${b.title || ''} · ${deDate(b.date)} ${b.start}–${b.end}`); if (!sc) return;
        if (!await ask(`${b.type === 'sperre' ? 'Aufheben' : 'Stornieren'}: ${SCOPE_TXT[sc]}?`, { ok: b.type === 'sperre' ? 'Aufheben' : 'Stornieren', danger: true })) return;
        try { const r0 = await api(`bookings/${b.id}/scope`, 'POST', { scope: sc, action: 'cancel' }); closeDialog(); toast(`${r0.cancelled} ${r0.cancelled === 1 ? 'Termin' : 'Termine'} entfernt.`); after(); } catch (e) { fail(e); }
      };
      return;
    }
    if ($('bxE')) $('bxE').onclick = () => { closeDialog(); bookDialog({ edit: b }, after); };
    if ($('bxC')) $('bxC').onclick = async () => {
      const why = await askText(b.type === 'sperre' ? 'Sperre aufheben?\nOptional ein Hinweis fürs Protokoll:' : `Buchung stornieren?\n${b.member_id ? 'Das Mitglied bekommt eine E-Mail. ' : ''}Grund (optional):`, '', { ok: b.type === 'sperre' ? 'Aufheben' : 'Stornieren' });
      if (why == null) return;
      try { await api(`bookings/${b.id}/cancel`, 'POST', { reason: why }); closeDialog(); toast('Erledigt.'); after(); } catch (e) { fail(e); }
    };
  }

  /** Serientermin(e) ändern: Platz, Uhrzeit, Titel, Buchungsart, Notiz – im gewählten Umfang, Überschneidungen werden vorher gezeigt */
  function seriesEdit(b, scope, after) {
    const m = st.meta, rs = m.resources.filter(r => r.active || r.id === b.resource_id);
    dialog(`<h2>${b.type === 'sperre' ? 'Sperre' : 'Serie'} bearbeiten</h2>
      <p class="muted" style="margin-top:0">${esc(b.title || '')} · ab ${deDate(b.date)} · <b>${esc(SCOPE_TXT[scope])}</b></p>
      <div class="bk-grid" style="--c:4">
        <label class="f w2">Platz / Gerät<select id="seR">${rs.map(r => opt(r.id, r.name, b.resource_id)).join('')}</select></label>
        <label class="f">von<input id="seS" type="time" step="900" value="${b.start}"></label><label class="f">bis<input id="seE" type="time" step="900" value="${b.end}"></label>
        <label class="f w2">${b.type === 'sperre' ? 'Grund' : 'Titel'}<input id="seT" value="${esc(b.title || '')}"></label>
        <label class="f">Buchungsart<select id="seL">${opt('', '– ohne –')}${m.labels.filter(l => l.active).map(l => opt(l.id, l.name, b.label_id || (b.label && (m.labels.find(x => x.name === b.label.name) || {}).id))).join('')}</select></label>
        <label class="f">Notiz (intern)<input id="seN" value="${esc(b.note || '')}"></label>
      </div>
      <div id="seInfo"></div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="seOk">Prüfen</button></div>`, true);
    $('c').onclick = closeDialog;
    let checked = false;
    const fields = () => ({ resource_id: +val('seR'), start: val('seS'), end: val('seE'), title: val('seT'), label_id: +val('seL') || null, note: val('seN') });
    $('dialog').onchange = () => { checked = false; $('seOk').textContent = 'Prüfen'; };
    $('seOk').onclick = () => GK.busy($('seOk'), async () => {
      try {
        if (!checked) {
          const p = await api(`bookings/${b.id}/scope`, 'POST', { scope, action: 'edit', fields: fields(), preview: true });
          const cl = p.clash || [];
          $('seInfo').innerHTML = `<div class="banner ${cl.length || p.skipped.length ? 'a' : ''}" style="display:block"><b>${p.count} ${p.count === 1 ? 'Termin' : 'Termine'}</b>${cl.length ? ` – an ${cl.length} ${cl.length === 1 ? 'Tag' : 'Tagen'} ist der Platz belegt${b.type === 'sperre' ? ' (die Buchungen dort werden storniert, die Mitglieder informiert)' : ' (diese Tage werden ausgelassen)'}: ${cl.slice(0, 12).map(c => deDate(c.date)).join(', ')}` : ' – keine Überschneidungen.'}${p.skipped.length ? `<br>Nicht möglich: ${p.skipped.slice(0, 8).map(x => `${deDate(x.date)} (${esc(x.why)})`).join(', ')}` : ''}</div>`;
          checked = true; $('seOk').textContent = 'Speichern'; return;
        }
        const r0 = await api(`bookings/${b.id}/scope`, 'POST', { scope, action: 'edit', fields: fields(), force: true });
        closeDialog(); toast(`${r0.changed} ${r0.changed === 1 ? 'Termin' : 'Termine'} geändert${r0.skipped.length ? `, ${r0.skipped.length} ausgelassen` : ''}${r0.cancelled ? `, ${r0.cancelled} Buchungen storniert` : ''}.`); after();
      } catch (e) { fail(e); }
    });
  }

  /* ---------------------------------------------------------------- Serien & Sperren */
  async function showSeries(el) {
    const list = await api('series');
    const row = x => `<div class="bk-ser${x.active ? '' : ' off'}"><div style="min-width:0"><h4>${x.label ? `<i class="bk-dot" style="background:${x.label.color}"></i>` : ''}${esc(x.title)} ${pill(x.type === 'sperre' ? ['r', 'Sperre'] : ['b', 'Serie'])}${x.active ? '' : ' ' + pill(['', 'beendet'])}</h4>
        <div class="muted">${(x.rule && x.rule.freq === 'import' ? ['Spielplan vom Verband', `${deDate(x.from_date)} – ${deDate(x.to_date)}`, x.resources.map(resName).join(', '), x.active ? `${x.games} kommende ${x.games === 1 ? 'Spiel' : 'Spiele'}` : '']
          : [x.rule_text || x.weekdays.split('').map(d => WD[+d]).join(', '), `${x.start}–${x.end} Uhr`, `${deDate(x.from_date)} – ${deDate(x.to_date)}`, x.resources.map(resName).join(', '), x.member ? `für ${x.member}` : '', x.active ? `${x.count} kommende Termine` : '']).filter(Boolean).map(esc).join(' · ')}</div></div>
        <div>${x.active && can('buchung_serien') ? `<button class="btn small" data-end="${x.id}">${x.type === 'sperre' ? 'Aufheben' : 'Beenden'}</button>` : ''}</div></div>`;
    const act = list.filter(x => x.active), old = list.filter(x => !x.active);
    el.innerHTML = `${can('buchung_serien') ? '<div class="toolbar"><button class="btn primary" id="srNew">+ Serie</button><button class="btn" id="srLock">+ Sperre über Zeitraum</button><button class="btn" id="srImp">Spielplan importieren</button></div>' : ''}
      <div class="card"><h3>Aktiv</h3>${act.length ? act.map(row).join('') : '<p class="muted">Keine. Zum Beispiel „Training Herren 40“ jeden Dienstag 18–20 Uhr auf Platz 1 und 2.</p>'}</div>
      ${old.length ? `<div class="card"><h3>Beendet</h3>${old.slice(0, 30).map(row).join('')}</div>` : ''}`;
    const again = () => showSeries(el).catch(fail);
    if ($('srNew')) $('srNew').onclick = () => seriesDialog('serie', again);
    if ($('srLock')) $('srLock').onclick = () => seriesDialog('sperre', again);
    if ($('srImp')) $('srImp').onclick = () => importDialog(again);
    el.querySelectorAll('[data-end]').forEach(b => { b.onclick = async () => {
      const x = list.find(y => y.id === +b.dataset.end);
      if (!await ask(`${x.type === 'sperre' ? 'Sperre' : 'Serie'} „${x.title}“ ${x.type === 'sperre' ? 'aufheben' : 'beenden'}?\n\nDie ${x.count} kommenden Termine werden entfernt, vergangene bleiben stehen.`, { ok: x.type === 'sperre' ? 'Aufheben' : 'Beenden', danger: true })) return;
      try { const r = await api(`series/${x.id}/end`, 'POST'); toast(`${r.removed} Termine entfernt.`); again(); } catch (e) { fail(e); }
    }; });
  }
  /* ---------------------------------------------------------------- Spielplan-Import (Verband) */
  function importDialog(after) {
    dialog(`<h2>Spielplan importieren</h2>
      <p class="muted" style="margin-top:0">Auf der Seite des Verbands die Tabelle mit den Begegnungen markieren (von „Datum“ bis zum letzten Spiel), kopieren und hier einfügen – z. B. nuLiga „Begegnungen“ mit „nur Heimspiele“. Oder eine Datei wählen: CSV, Excel oder Kalender (.ics, z. B. fussball.de „Spielplan exportieren“).</p>
      <label class="f">Tabelle einfügen<textarea id="imT" rows="9" placeholder="Datum · Spielort · Liga · Heimmannschaft · Gastmannschaft …" style="font-family:ui-monospace,Menlo,monospace;font-size:12.5px;white-space:pre"></textarea></label>
      <div class="row" style="margin-top:10px;align-items:center;gap:10px"><label class="btn" style="cursor:pointer">Datei wählen …<input type="file" id="imF" accept=".csv,.txt,.xlsx,.ics,text/calendar" hidden></label><span class="muted s" id="imFn">keine Datei</span></div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="imGo">Einlesen</button></div>`, true);
    $('c').onclick = closeDialog;
    let file = null;
    $('imF').onchange = () => { const f = $('imF').files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { file = { name: f.name, file: String(fr.result).split(',')[1] }; $('imFn').textContent = f.name; }; fr.readAsDataURL(f); };
    $('imGo').onclick = () => GK.busy($('imGo'), async () => {
      try { const src = file || { text: $('imT').value }; const r = await api('import/parse', 'POST', src); r.__src = src; importReview(r, after); } catch (e) { fail(e); }
    });
  }
  function importReview(r, after) {
    const m = st.meta;
    const teams = Object.fromEntries(r.teams.map(t => [t.team, { resources: t.resources.slice(), hours: t.hours }]));
    const pick = new Set(r.games.filter(g => g.isHome && !g.past && !g.noTime && g.status !== 'vorhanden').map(g => g.key));
    const ST = { neu: ['g', 'neu'], verlegt: ['a', 'verlegt'], vorhanden: ['', 'schon eingetragen'] };
    const draw = () => {
      const home = r.games.filter(g => g.isHome).length;
      dialog(`<h2>Spielplan prüfen</h2>
        <div class="bk-grid" style="--c:3"><label class="f">Euer Verein (für „Heimspiel“)<input id="imC" value="${esc(r.club)}"></label>
          <label class="f">Buchungsart<select id="imL">${opt('', '– ohne –')}${m.labels.filter(l => l.active).map(l => opt(l.id, l.name)).join('')}</select></label>
          <div class="f muted s" style="align-self:end;padding-bottom:11px">${r.games.length} Spiele erkannt · ${home} Heimspiele${r.skipped.length ? ` · ${r.skipped.length} Zeilen nicht erkannt` : ''}</div></div>
        <h3 style="margin:16px 0 6px">Plätze und Dauer je Mannschaft</h3>
        <table class="tbl"><tr><th>Mannschaft</th><th>Spiele</th><th>Plätze</th><th>Dauer</th></tr>${r.teams.map(t => `<tr><td><b>${esc(t.team)}</b>${t.size ? ` <span class="muted s">${t.size}er</span>` : ''}</td><td>${t.count}</td>
          <td><span class="bk-chips">${r.courts.map(c => `<label><input type="checkbox" data-tc="${esc(t.team)}" data-c="${c.id}" ${teams[t.team].resources.includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</span></td>
          <td class="nw"><input type="number" min="1" max="12" step="0.5" data-th="${esc(t.team)}" value="${teams[t.team].hours}" style="width:64px;height:34px;border:1px solid var(--line);border-radius:8px;padding:0 6px"> Std.</td></tr>`).join('')}</table>
        <h3 style="margin:16px 0 6px">Spiele</h3>
        <div class="bk-clash" style="max-height:340px"><table class="tbl"><tr><th></th><th>Datum</th><th>Zeit</th><th>Mannschaft</th><th>Begegnung</th><th></th></tr>${r.games.map((g, i) => {
          const off = g.past || g.noTime || g.status === 'vorhanden';
          return `<tr style="${off ? 'opacity:.55' : ''}"><td><input type="checkbox" data-g="${i}" ${pick.has(g.key) ? 'checked' : ''} ${off ? 'disabled' : ''}></td><td class="nw">${GK.deDate(g.date)}</td><td class="nw">${esc(g.start || '–')}</td><td>${esc(g.team || '–')}</td>
            <td>${esc(g.home)} – ${esc(g.guest)}${g.venue ? ` <span class="muted s">· ${esc(g.venue)}</span>` : ''}</td>
            <td class="nw">${g.past ? pill(['', 'vorbei']) : g.noTime ? pill(['a', 'ohne Uhrzeit']) : !g.isHome ? pill(['', 'auswärts']) : pill(ST[g.status])}${g.was ? ` <span class="muted s">vorher ${GK.deDate(g.was.date)} ${esc(g.was.start)}</span>` : ''}</td></tr>`; }).join('')}</table></div>
        <div id="imInfo"></div>
        <div class="btns"><button class="btn ghost" id="imBack">Zurück</button><button class="btn primary" id="imOk">Prüfen</button></div>`, true);
      $('imBack').onclick = () => importDialog(after);
      $('dialog').querySelectorAll('[data-g]').forEach(c => { c.onchange = () => { const g = r.games[+c.dataset.g]; if (c.checked) pick.add(g.key); else pick.delete(g.key); reset(); }; });
      $('dialog').querySelectorAll('[data-tc]').forEach(c => { c.onchange = () => { const t = teams[c.dataset.tc]; const id = +c.dataset.c; t.resources = c.checked ? [...new Set([...t.resources, id])] : t.resources.filter(x => x !== id); reset(); }; });
      $('dialog').querySelectorAll('[data-th]').forEach(i => { i.onchange = () => { teams[i.dataset.th].hours = +i.value || 4; reset(); }; });
      $('imC').onchange = async () => { try { const r2 = await api('import/parse', 'POST', { ...r.__src, club: $('imC').value }); { const src = r.__src; Object.assign(r, r2); r.__src = src; pick.clear(); r.games.filter(g => g.isHome && !g.past && !g.noTime && g.status !== 'vorhanden').forEach(g => pick.add(g.key)); draw(); } } catch (e) { fail(e); } };
      let checked = false;
      const reset = () => { checked = false; $('imOk').textContent = 'Prüfen'; $('imInfo').innerHTML = ''; };
      const body = extra => ({ club: $('imC').value, label_id: +val('imL') || null, teams, games: r.games.filter(g => pick.has(g.key)), ...extra });
      $('imOk').onclick = () => GK.busy($('imOk'), async () => {
        try {
          if (!pick.size) { toast('Bitte mindestens ein Spiel anhaken.', true); return; }
          if (!checked) {
            const p = await api('import/apply', 'POST', body({ preview: true }));
            const mc = p.clash.reduce((n, c) => n + c.items.filter(x => x.type !== 'sperre').length, 0);
            $('imInfo').innerHTML = `<div class="banner ${mc || p.problems.length ? 'a' : ''}" style="display:block"><b>${p.neu} neu</b>${p.verlegt ? ` · <b>${p.verlegt} verlegt</b>` : ''}${p.vorhanden ? ` · ${p.vorhanden} schon eingetragen` : ''}${mc ? `<br>${mc} Buchung(en) von Mitgliedern liegen zu Spielzeiten und werden storniert (mit E-Mail): ${p.clash.slice(0, 8).map(c => `${GK.deDate(c.date)} ${esc(c.start)}`).join(', ')}` : ''}${p.reassigned && p.reassigned.length ? `<br>Gleichzeitige Spiele – auf andere Plätze verteilt: ${p.reassigned.slice(0, 8).map(esc).join(' · ')}` : ''}${p.problems.length ? `<br>Nicht übernommen: ${p.problems.slice(0, 6).map(esc).join(' · ')}` : ''}</div>`;
            checked = true; $('imOk').textContent = 'Übernehmen'; return;
          }
          // alle erkannten Spiele mitschicken: Ist der Spielbetrieb aktiv, übernimmt er auch die Auswärtsspiele als Spieltage
          const x = await api('import/apply', 'POST', body({ force: true, all: GK.modules().includes('spielbetrieb') ? r.games.filter(g => !g.past) : undefined }));
          const sp = x.spielbetrieb;
          closeDialog(); toast(`Spielplan übernommen: ${x.made} neu${x.moved ? `, ${x.moved} verlegt` : ''}${x.cancelled ? `, ${x.cancelled} Buchungen storniert` : ''}.${sp ? ` Spielbetrieb: ${sp.made} Spieltage neu${sp.moved ? `, ${sp.moved} verlegt` : ''}${sp.teamsMade ? `, ${sp.teamsMade} Mannschaft(en) angelegt` : ''}.` : ''}`); after();
        } catch (e) { fail(e); }
      });
    };
    draw();
  }
  function seriesDialog(type, after) {
    const m = st.meta, rs = m.resources.filter(r => r.active);
    const y = +m.today.slice(0, 4);
    dialog(`<h2>${type === 'sperre' ? 'Sperre über einen Zeitraum' : 'Neue Serie'}</h2>
      <div class="bk-grid" style="--c:4">
        <label class="f">Buchungsart<select id="sxL">${opt('', '– ohne –')}${m.labels.filter(l => l.active).map(l => opt(l.id, l.name)).join('')}</select></label>
        <label class="f">${type === 'sperre' ? 'Grund' : 'Titel'}<input id="sxT" placeholder="${type === 'sperre' ? 'optional, z. B. Winterpause' : 'optional – leer = Buchungsart oder Mitglied'}"></label>
        <label class="f">vom<input id="sxF" type="date" value="${m.today}"></label><label class="f">bis<input id="sxU" type="date" value="${type === 'sperre' ? m.today : (`${y}-09-30` > addDays(m.today, 28) ? `${y}-09-30` : addDays(m.today, 91))}"></label>
        <div class="f bkf wall"><span>Plätze</span><div class="bk-chips">${rs.map(r => `<label><input type="checkbox" data-r="${r.id}"> ${esc(r.name)}</label>`).join('')}</div></div>
        <label class="f w2">Wiederholung<select id="sxRf">${repeatOpts(type === 'sperre' ? 'daily:1' : 'weekly:1')}</select></label>
        <div class="f bkf w2" id="sxWD"><span>Wochentage</span><div class="bk-chips">${[1, 2, 3, 4, 5, 6, 7].map(d => `<label><input type="checkbox" data-d="${d}"> ${WD[d]}</label>`).join('')}</div></div>
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
      resources: [...$('dialog').querySelectorAll('[data-r]:checked')].map(x => +x.dataset.r), weekdays: [...$('dialog').querySelectorAll('[data-d]:checked')].map(x => x.dataset.d).join(''), ...parseRepeat(val('sxRf')),
      member_id: $('sxM') ? +val('sxM') || null : null, note: val('sxN'), label_id: +val('sxL') || null });
    const wdVis = () => { $('sxWD').style.visibility = parseRepeat(val('sxRf')).freq === 'weekly' ? '' : 'hidden'; };
    const wdDefault = () => { const d = dow(val('sxF') || m.today); if (![...$('dialog').querySelectorAll('[data-d]:checked')].length) { const c = $('dialog').querySelector(`[data-d="${d}"]`); if (c) c.checked = true; } };
    wdDefault(); wdVis();
    $('sxRf').addEventListener('change', () => { wdVis(); wdDefault(); });
    $('dialog').onchange = () => { checked = false; if ($('sxOk')) $('sxOk').textContent = 'Prüfen'; };   // onchange statt addEventListener: das Dialog-Element bleibt bestehen, der Listener gilt nur für diesen Dialog
    $('sxOk').onclick = () => GK.busy($('sxOk'), async () => {
      try {
        if (!checked) {
          const p = await api('series', 'POST', { ...body(), preview: true });
          $('sxClash').innerHTML = `<div class="banner ${p.clash.length ? 'a' : ''}" style="display:block"><b>${p.days} Termine</b> · ${esc(p.rule || '')}${p.dates && p.dates.length ? ` · ${p.dates.slice(0, 6).map(deDate).join(', ')}${p.dates.length > 6 ? ' …' : ''}` : ''}<br>${p.clash.length ? `${p.clash.length} überschneiden sich mit bestehenden Buchungen${type === 'sperre' ? ' (werden storniert)' : ' (werden ausgelassen)'}:` : 'Keine Überschneidungen.'}
            ${p.clash.length ? `<div class="bk-clash"><table class="tbl">${p.clash.slice(0, 60).map(c => `<tr><td class="nw">${deDate(c.date)}</td><td class="nw">${c.start}–${c.end}</td><td>${esc(c.resource)}</td><td>${esc(c.type === 'buchung' ? (c.who || []).join(', ') : c.title || '')}</td></tr>`).join('')}</table></div>` : ''}</div>`;
          checked = true; $('sxOk').textContent = type === 'sperre' ? 'Sperren' : 'Serie anlegen'; return;
        }
        const r = await api('series', 'POST', body());
        closeDialog(); toast(`${r.made} Termine eingetragen${r.skipped ? `, ${r.skipped} ausgelassen` : ''}${r.cancelled ? `, ${r.cancelled} Buchungen storniert` : ''}.`); after();
      } catch (e) { fail(e); }
    });
  }

  /* ---------------------------------------------------------------- Buchungsarten */
  async function showLabels(el) {
    const list = await api('labels');
    const draw = () => {
      const q = (st.lq || '').toLowerCase();
      const rows = list.filter(l => !q || l.name.toLowerCase().includes(q));
      $('lbList').innerHTML = rows.length ? `<table class="tbl bk-tbl"><tr><th>Buchungsart</th><th class="hm">Wer darf buchen?</th><th class="r hm">kommende Termine</th><th></th></tr>
        ${rows.map(l => `<tr class="${l.active ? '' : 'off'}"><td><i class="bk-dot" style="background:${l.color}"></i><b>${esc(l.name)}</b>${l.active ? '' : ' <span class="muted s">· inaktiv</span>'}</td>
          <td class="hm">${esc(useText(l))}${l.free_rules ? ' ' + pill(['b', 'Vereinstermin']) : ''}</td>
          <td class="r hm"><span class="pill g">${l.used}</span></td><td class="r">${can('buchung_einstellungen') ? `<button class="btn small" data-le="${l.id}">Bearbeiten</button>` : ''}</td></tr>`).join('')}</table>`
        : '<p class="muted" style="padding:24px;margin:0">Keine Buchungsarten gefunden.</p>';
      $('lbList').querySelectorAll('[data-le]').forEach(b => { b.onclick = () => labelDialog(list.find(l => l.id === +b.dataset.le), again); });
    };
    el.innerHTML = `<div class="filterbar"><label class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="lbQ" placeholder="Buchungsart suchen" value="${esc(st.lq || '')}" data-nodirty></label>
        <span style="flex:1"></span>${can('buchung_einstellungen') ? '<button class="btn primary" id="lbNew">+ Neue Buchungsart</button>' : ''}</div>
      <div class="card" style="padding:0 20px;overflow:auto" id="lbList"></div>
      <p class="muted s">Buchungsarten kennzeichnen Vereinsbuchungen und Serien – z. B. Training, Medenspiel, Clubmeisterschaft, Schulsport. Sie erscheinen farbig im Belegungsplan, in der Mitglieder-App und am Tablet.</p>`;
    const again = async () => { await loadMeta(); showLabels(el).catch(fail); };
    $('lbQ').oninput = () => { st.lq = val('lbQ'); draw(); };
    if ($('lbNew')) $('lbNew').onclick = () => labelDialog(null, again);
    draw();
  }
  const PALETTE = ['#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', '#1e88e5', '#039be5', '#00897b', '#43a047', '#7cb342', '#c0ca33', '#fdd835', '#ffb300', '#fb8c00', '#f4511e', '#6d4c41', '#757575', '#546e7a', '#1b5e20', '#0d1b4f'];
  /** Kurzbeschreibung „Wer darf buchen?“ */
  const useText = l => (l.use_mode === 'alle' ? 'alle Mitglieder (auch in der App)' : l.use_mode === 'auswahl'
    ? [...(l.use_functions || []), (l.use_members || []).length ? `${l.use_members.length} ${l.use_members.length === 1 ? 'Person' : 'Personen'}` : ''].filter(Boolean).join(', ') || 'niemand ausgewählt'
    : 'nur Verwaltung');
  function labelDialog(l, after) {
    const m = st.meta;
    let color = l ? l.color : PALETTE[5], mode = l ? l.use_mode : 'verwaltung';
    const fns = new Set(l ? l.use_functions : []), mem = l ? l.use_members.slice() : [];
    const allFns = [...new Set([...(m.functions || []), ...fns])];
    dialog(`<h2>${l ? esc(l.name) : 'Neue Buchungsart'}</h2>
      <div class="bk-grid" style="--c:2"><label class="f">Name<input id="lbN" value="${esc(l ? l.name : '')}" placeholder="z. B. Medenspiel Herren 40" maxlength="40"></label>
        <label class="f">Reihenfolge<input id="lbS" inputmode="numeric" value="${l ? l.sort : 100}"></label>
        <div class="f bkf wall"><span>Farbe</span><div class="bk-pal">${PALETTE.map(c => `<button type="button" data-col="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}<input type="color" id="lbC" value="${color}" aria-label="eigene Farbe"></div></div>
        <div class="f bkf wall"><span>Vorschau</span><div><span class="bk-prev" id="lbP"></span></div></div>
        <div class="f bkf wall"><span>Wer darf mit dieser Buchungsart buchen?</span><div class="bk-use">
          <div class="seg" id="lbU" style="width:fit-content">${[['verwaltung', 'Nur Verwaltung'], ['alle', 'Alle Mitglieder'], ['auswahl', 'Bestimmte Ämter & Personen']].map(([k, t]) => `<button type="button" data-u="${k}">${t}</button>`).join('')}</div>
          <p class="muted s" id="lbUh"></p>
          <div id="lbUa" class="bk-grid" style="--c:2">
            <div class="f bkf"><span>Ämter (aus der Mitgliederverwaltung)</span>${allFns.length ? `<div class="bk-chips">${allFns.map(f => `<label><input type="checkbox" data-fn="${esc(f)}" ${fns.has(f) ? 'checked' : ''}>${esc(f)}</label>`).join('')}</div>` : '<p class="muted s">Noch keine Ämter – beim Mitglied unter „Ehrungen &amp; Ämter“ eintragen, z. B. „Trainer“ oder „Mannschaftsführer Herren 40“.</p>'}</div>
            <label class="f">Einzelne Mitglieder<select id="lbM"><option value="">+ Mitglied hinzufügen …</option>${m.people.map(p => opt(p.id, GK.lastFirst(p.name, 'mitglied'))).join('')}</select><span class="bk-chips" id="lbMc"></span></label>
          </div></div></div>
        <label class="chk wall"><input type="checkbox" id="lbF" ${l && l.free_rules ? 'checked' : ''}> Vereinstermin: ohne Höchstdauer, Kontingent, Vorlauf und Gebühren (z. B. Training, Medenspiel)</label>
        ${l ? `<label class="chk wall"><input type="checkbox" id="lbA" ${l.active ? 'checked' : ''}> aktiv (inaktive Buchungsarten sind nicht mehr wählbar, bestehende Termine behalten sie)</label>` : ''}</div>
      <div class="btns">${l ? '<button class="btn ghost danger" id="lbDel">Löschen</button><span style="flex:1"></span>' : ''}<button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="lbOk">Speichern</button></div>`, true);
    const HINT = { verwaltung: 'Nur in der Verwaltung wählbar (Recht „für Mitglieder buchen“) – Mitglieder sehen es in der App nicht.',
      alle: 'Jedes Mitglied, das buchen darf, kann die Buchungsart in der App wählen (z. B. „Clubmeisterschaft“).',
      auswahl: 'Nur Mitglieder mit einem der Ämter oder einzeln ausgewählte – in der App und in der Verwaltung (mit verknüpftem Mitglied). Wer „Plätze, Buchungsarten & Einstellungen“ darf, kann es immer.' };
    const paint = () => { $('lbP').textContent = val('lbN') || 'Buchungsart'; $('lbP').style.background = color; $('lbP').style.color = ink(color); $('lbC').value = color;
      $('dialog').querySelectorAll('[data-col]').forEach(b => b.classList.toggle('on', b.dataset.col === color));
      $('dialog').querySelectorAll('#lbU [data-u]').forEach(b => b.classList.toggle('on', b.dataset.u === mode));
      $('lbUh').textContent = HINT[mode]; $('lbUa').style.display = mode === 'auswahl' ? '' : 'none'; };
    const chips = () => { $('lbMc').innerHTML = mem.map(id => `<label>${esc((m.people.find(p => p.id === id) || {}).name || '?')} <button type="button" class="btn small ghost" data-rm="${id}" style="height:24px;padding:0 6px" aria-label="entfernen">×</button></label>`).join('');
      $('lbMc').querySelectorAll('[data-rm]').forEach(b => { b.onclick = e => { e.preventDefault(); mem.splice(mem.indexOf(+b.dataset.rm), 1); chips(); }; }); };
    $('lbM').onchange = () => { const v = +val('lbM'); if (v && !mem.includes(v)) mem.push(v); $('lbM').value = ''; chips(); };
    $('dialog').querySelectorAll('#lbU [data-u]').forEach(b => { b.onclick = () => { mode = b.dataset.u; paint(); }; });
    $('dialog').querySelectorAll('[data-col]').forEach(b => { b.onclick = () => { color = b.dataset.col; paint(); }; });
    $('lbC').oninput = () => { color = $('lbC').value; paint(); }; $('lbN').oninput = paint; paint(); chips();
    $('c').onclick = closeDialog;
    $('lbOk').onclick = () => GK.busy($('lbOk'), async () => {
      const body = { name: val('lbN'), color, sort: +val('lbS') || 100, use_mode: mode, free_rules: $('lbF').checked,
        use_functions: [...$('dialog').querySelectorAll('[data-fn]:checked')].map(x => x.dataset.fn), use_members: mem.slice(), ...(l ? { active: $('lbA').checked } : {}) };
      try { if (l) await api('labels/' + l.id, 'PUT', body); else await api('labels', 'POST', body); closeDialog(); toast('Gespeichert.'); after(); } catch (e) { fail(e); }
    });
    if ($('lbDel')) $('lbDel').onclick = async () => { if (!await ask(`Buchungsart „${l.name}“ löschen?\n\nGeht nur, solange es nicht verwendet wird – sonst auf „inaktiv“ setzen.`)) return; try { await api('labels/' + l.id, 'DELETE'); closeDialog(); toast('Gelöscht.'); after(); } catch (e) { fail(e); } };
  }

  /* ---------------------------------------------------------------- Buchungsprotokoll */
  const AVC = ['#2f6fd6', '#8a4fd6', '#1f9a6b', '#e07b16', '#c2185b', '#00838f', '#6d4c41', '#5e35b1', '#b22a2a', '#2e7d32'];
  const avatar = p => { const parts = String(p.name).split(',').map(x => x.trim()); const ini = ((parts[1] || '')[0] || '') + ((parts[0] || '')[0] || '');
    return p.ph ? `<span class="bk-av"><img src="api/admin/photo/${p.id}?v=${esc(p.ph)}" alt="" loading="lazy"></span>` : `<span class="bk-av" style="background:${AVC[p.id % AVC.length]}">${esc(ini.toUpperCase() || '?')}</span>`; };
  const ago = ts => { const d = (Date.now() - Date.parse(String(ts).replace(' ', 'T'))) / 1000; if (d < 3600) return `vor ${Math.max(1, Math.round(d / 60))} Min.`; if (d < 86400) return `vor ${Math.round(d / 3600)} Std.`; if (d < 86400 * 45) return `vor ${Math.round(d / 86400)} Tagen`; if (d < 86400 * 365) return `vor ${Math.round(d / 86400 / 30)} Monaten`; return `vor ${(d / 86400 / 365).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Jahren`; };
  async function showLog(el) {
    st.lg = st.lg || { f: 'alle', year: new Date().getFullYear(), resource: '', sort: 'termin', q: '' };
    const g = st.lg;
    const qs = `year=${g.year}&resource=${g.resource}&f=${g.f}&sort=${g.sort}&q=${encodeURIComponent(g.q)}`;
    const d = await api('log?' + qs);
    const STS = { storniert: ['r', 'Storniert'], abgeschlossen: ['', 'Abgeschlossen'], laeuft: ['g', 'Läuft gerade'], anstehend: ['b', 'Anstehend'] };
    const SRC = { app: 'Mitglieder-App', tablet: 'Tablet', verwaltung: 'Verwaltung' };
    const WDL = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    let last = '';
    const shown = d.rows.slice(0, g.n || 200);
    const rows = shown.map(r => {
      const key = g.sort === 'eingetragen' ? String(r.created_at).slice(0, 10) : r.date;
      const head = key !== last ? `<tr class="bk-lgd"><td colspan="5">${esc(new Date(key + 'T12:00:00').toLocaleDateString('de-DE', WDL))}</td></tr>` : ''; last = key;
      const col = r.label ? r.label.color : r.type === 'sperre' ? 'var(--red)' : 'var(--brand)';
      const who = r.people.length ? `<div class="bk-lgp">${r.people.slice(0, 4).map(p => `<div>${avatar(p)}<span>${esc(p.name)}</span></div>`).join('')}${r.people.length > 4 ? `<div class="muted s">+ ${r.people.length - 4} weitere</div>` : ''}</div>`
        : `<div class="bk-lgp"><div><span class="bk-av" style="background:${col}">${r.type === 'sperre' ? '×' : '★'}</span><span>${esc(r.title || (r.label && r.label.name) || 'Verein')}</span></div></div>`;
      const tags = [r.label ? `<span class="pill" style="background:${r.label.color};color:${ink(r.label.color)}">${esc(r.label.name)}</span>` : '', r.type === 'sperre' ? pill(['r', 'Sperre']) : r.type === 'serie' ? pill(['b', 'Serie']) : '',
        r.guests.length ? `<span class="pill a" title="${esc(r.guests.join(', '))}">${r.guests.length} ${r.guests.length === 1 ? 'Gast' : 'Gäste'}</span>` : '', r.fee_cents ? `<span class="pill">${euro(r.fee_cents)}</span>` : ''].filter(Boolean).join('');
      const s0 = STS[r.status];
      return `${head}<tr class="bk-lgr${r.status === 'storniert' ? ' off' : ''}" data-b="${r.id}"><td style="box-shadow:inset 4px 0 0 ${col}">${who}</td>
        <td><b>${esc(r.resource)}</b>${tags ? `<div class="bk-lgt">${tags}</div>` : ''}${r.title && r.people.length && (!r.label || r.title !== r.label.name) ? `<div class="muted s">${esc(r.title)}</div>` : ''}</td>
        <td class="nw"><b>${r.start}–${r.end}</b><div class="muted s">${esc(new Date(r.date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }))}</div></td>
        <td>${pill(s0)}${r.status === 'storniert' ? `<div class="muted s">${esc(r.cancelled_by || '')}${r.cancelled_at ? ` · ${ago(r.cancelled_at)}` : ''}${r.cancel_reason ? `<br>${esc(r.cancel_reason)}` : ''}</div>` : ''}</td>
        <td class="r"><span title="${esc(deDate(String(r.created_at).slice(0, 10)) + ' ' + String(r.created_at).slice(11, 16))}">${ago(r.created_at)}</span><div class="muted s">${esc(SRC[r.source] || '')}${r.created_by ? ` · ${esc(r.created_by)}` : ''}</div></td></tr>`;
    }).join('');
    el.innerHTML = `<div class="filterbar"><div class="seg" id="lgF">${[['alle', 'Alle'], ['mitglieder', 'Mitglieder'], ['gast', 'Mit Gast'], ['label', 'Buchungsarten'], ['sperre', 'Sperren'], ['storniert', 'Storniert']].map(([k, t]) => `<button type="button" data-f="${k}" class="${g.f === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <span style="flex:1"></span>
        <label class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="lgQ" placeholder="Name, Platz, Buchungsart" value="${esc(g.q)}" data-nodirty></label></div>
      <div class="filterbar"><select id="lgY" class="bk-sel" data-nodirty>${d.years.map(y => opt(y, `Jahr ${y}`, g.year)).join('')}</select>
        <select id="lgR" class="bk-sel" data-nodirty>${opt('', 'Alle Plätze', g.resource)}${st.meta.resources.map(r => opt(r.id, r.name, g.resource)).join('')}</select>
        <select id="lgS" class="bk-sel" data-nodirty>${opt('termin', 'nach Termin', g.sort)}${opt('eingetragen', 'nach Eintragung', g.sort)}</select>
        <span style="flex:1"></span><span class="muted s">${d.total.toLocaleString('de-DE')} ${d.total === 1 ? 'Eintrag' : 'Einträge'}${d.total > shown.length ? ` · ${shown.length} angezeigt` : ''}</span>
        <a class="btn" href="${BASE}log.csv?${qs}" download><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>CSV</a></div>
      <div class="card" style="padding:0 20px;overflow:auto">${d.rows.length ? `<table class="tbl bk-lg"><tr><th>Spieler / Buchungsart</th><th>Platz</th><th>Termin</th><th>Status</th><th class="r">Eingetragen</th></tr>${rows}</table>${d.rows.length > shown.length ? '<div style="display:flex;justify-content:center;padding:16px 0"><button class="btn" id="lgMore">Weitere anzeigen</button></div>' : ''}` : '<p class="muted" style="padding:24px 0;margin:0">Keine Einträge für diese Auswahl.</p>'}</div>`;
    if ($('lgMore')) $('lgMore').onclick = () => { g.n = (g.n || 200) + 300; const y0 = window.scrollY; showLog(el).then(() => window.scrollTo(0, y0)).catch(fail); };
    const again = () => showLog(el).catch(fail);
    el.querySelectorAll('#lgF [data-f]').forEach(b => { b.onclick = () => { g.f = b.dataset.f; g.n = 200; again(); }; });
    $('lgY').onchange = () => { g.year = +val('lgY'); again(); }; $('lgR').onchange = () => { g.resource = val('lgR'); again(); }; $('lgS').onchange = () => { g.sort = val('lgS'); again(); };
    let tq; $('lgQ').oninput = () => { clearTimeout(tq); tq = setTimeout(() => { g.q = val('lgQ'); again().then?.(() => { const i = $('lgQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 350); };
    el.querySelectorAll('tr[data-b]').forEach(tr => { tr.onclick = async () => { const r = d.rows.find(x => x.id === +tr.dataset.b); if (!r || r.status === 'storniert') return; const day = await api('day?date=' + r.date); const b = day.bookings.find(x => x.id === r.id); if (b) detail(b, again); }; });
  }

  /* ---------------------------------------------------------------- Auswertung (Dashboard) */
  const HEAT = ['#c5e384', '#7cc86f', '#24a03f', '#e9c46a', '#b22a2a'];
  const heat = (v, max) => (v <= 0 || !max ? null : HEAT[Math.min(4, Math.floor(v / max * 4.999))]);
  const hrs = m => { const h = m / 60; return h >= 100 ? Math.round(h).toLocaleString('de-DE') : h.toLocaleString('de-DE', { maximumFractionDigits: 1 }); };
  const pct = v => `${Math.round(v * 100)} %`;
  function delta(cur, prev, { invert = false, points = false } = {}) {
    if (!prev && !cur) return '<span class="bk-d n">±0</span>';
    if (points) { const d = Math.round((cur - prev) * 100); return `<span class="bk-d ${d === 0 ? 'n' : (d > 0) !== invert ? 'u' : 'w'}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} Pkt.</span>`; }
    if (!prev) return '<span class="bk-d u">neu</span>';
    const d = Math.round((cur - prev) / prev * 100);
    return `<span class="bk-d ${d === 0 ? 'n' : (d > 0) !== invert ? 'u' : 'w'}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} %</span>`;
  }
  /** kleine Linie: dieses Jahr (Fläche) und Vorjahr (gestrichelt), 12 Monate */
  function spark(cur, prev, color) {
    const W = 260, H = 56, max = Math.max(1, ...cur, ...prev), x = i => 4 + i * (W - 8) / 11, y = v => H - 4 - v / max * (H - 10);
    const path = a => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<svg class="bk-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${path(cur)} L${x(11)},${H} L${x(0)},${H} Z" fill="${color}" opacity=".14"/>
      <path d="${path(prev)}" fill="none" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/><path d="${path(cur)}" fill="none" stroke="${color}" stroke-width="2.2" vector-effect="non-scaling-stroke"/></svg>`;
  }
  /** Ring mit Legende (statt Beschriftungen am Ring – nichts überlappt) */
  function donut(items, center, unit) {
    const tot = items.reduce((x, i) => x + i.v, 0) || 1, R = 70, C = 2 * Math.PI * R;
    const list = items.length > 12 ? [...items.slice(0, 11), { name: `Weitere (${items.length - 11})`, v: items.slice(11).reduce((x, i) => x + i.v, 0), color: 'var(--line)', sub: '' }] : items;
    let off = 0;
    const segs = list.map(i => { const len = i.v / tot * C; const g = list.length > 1 ? Math.min(2, len / 3) : 0; const el0 = `<circle r="${R}" cx="90" cy="90" fill="none" stroke="${i.color}" stroke-width="26" stroke-dasharray="${Math.max(0, len - g).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>${esc(i.name)}: ${Math.round(i.v / tot * 100)} %</title></circle>`; off += len; return el0; }).join('');
    return `<div class="bk-donut"><div class="bk-dring"><svg viewBox="0 0 180 180" width="180" height="180"><g transform="rotate(-90 90 90)"><circle r="${R}" cx="90" cy="90" fill="none" stroke="var(--hover)" stroke-width="26"/>${segs}</g></svg><div class="bk-dc"><b>${center}</b><span>${unit}</span></div></div>
      <ul class="bk-dleg">${list.map(i => `<li><i style="background:${i.color}"></i><b>${esc(i.name)}</b><span class="r">${(i.v / tot * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %</span></li>`).join('')}</ul></div>`;
  }
  async function showStats(el) {
    st.sy = st.sy || new Date().getFullYear();
    const d = await api(`stats?year=${st.sy}&resource=${st.sr || ''}`);
    const c = d.cur, p = d.prev, ICO = { h: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>', r: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>', b: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>', x: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>' };
    const ic = k => `<span class="bk-ki"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg></span>`;
    const kpi = (k, label, val, dl, body, tone = '') => `<div class="card bk-kpi ${tone}"><div class="bk-kh">${ic(k)}<span>${label}</span></div><div class="bk-kv"><b>${val}</b>${dl}</div>${body}</div>`;
    const maxDay = Math.max(0, ...Object.values(d.days));
    // Kalender: Wochen (Mo–So) von der ersten Woche des Jahres
    const jan1 = `${d.year}-01-01`, start = addDays(jan1, 1 - dow(jan1)), weeks = [];
    for (let w = 0; w < 54; w++) { const wd = addDays(start, w * 7); if (wd > `${d.year}-12-31`) break; weeks.push(wd); }
    const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
    const [h0, h1] = d.hours, hours = Array.from({ length: Math.max(0, h1 - h0) }, (_, i) => h0 + i);
    // Monatszeile der Heatmap: je Monat eine Zelle über alle seine Wochen (Woche zählt zum Monat ihres Sonntags) – nichts läuft über
    const months = []; weeks.forEach(w => { const dd = addDays(w, 6), key = dd.slice(0, 4) === String(d.year) ? dd.slice(5, 7) : ''; const last = months[months.length - 1]; if (last && last.key === key) last.n++; else months.push({ key, n: 1 }); });
    const gmax = Math.max(0, ...d.grid.flat());
    // Höhepunkte
    let best = [0, 0, 0]; d.grid.forEach((row, r) => row.forEach((v, h) => { if (v > best[0]) best = [v, r, h]; }));
    const byDow = d.grid.map(row => row.reduce((x, v) => x + v, 0)), bd = byDow.indexOf(Math.max(...byDow));
    const favRes = d.perRes.slice().sort((a, b) => b.minutes - a.minutes)[0];
    const WDL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const hl = (t, v, sub) => `<div class="bk-hlt"><span>${t}</span><b>${v}</b><small>${sub}</small></div>`;
    const mmax = Math.max(1, ...c.month, ...p.month);
    el.innerHTML = `<div class="filterbar"><label class="f bk-fl">Jahr<select id="syY" class="bk-sel" data-nodirty>${d.years.map(y => opt(y, y, d.year)).join('')}</select></label>
        <label class="f bk-fl">Platz<select id="syR" class="bk-sel" data-nodirty>${opt('', 'Alle Plätze', d.resource || '')}${d.resources.map(r => opt(r.id, r.name, d.resource || '')).join('')}</select></label>
        <span style="flex:1"></span><span class="muted s">${d.year === new Date().getFullYear() ? `Auslastung bis heute (${deDate(d.until)}) · ` : ''}Vergleich mit ${d.year - 1}</span></div>
      <div class="bk-kpis">
        ${kpi('h', 'Gebuchte Stunden', hrs(c.minutes), delta(c.minutes, p.minutes), spark(c.month, p.month, 'var(--brand)'))}
        ${kpi('r', 'Auslastung', pct(c.rate), delta(c.rate, p.rate, { points: true }), `<div class="bk-meter"><i style="width:${Math.min(100, c.rate * 100)}%"></i><em style="left:${Math.min(100, p.rate * 100)}%" title="${d.year - 1}: ${pct(p.rate)}"></em></div><div class="bk-mlab"><span>0 %</span><span>${d.year - 1}: ${pct(p.rate)}</span><span>100 %</span></div>`)}
        ${kpi('b', 'Buchungen', c.count.toLocaleString('de-DE'), delta(c.count, p.count), spark(c.monthCount, p.monthCount, '#2f6fd6'), 'b')}
        ${kpi('x', 'Storniert', c.cancelled.toLocaleString('de-DE'), delta(c.cancelled, p.cancelled, { invert: true }), spark(c.monthCan, p.monthCan, 'var(--red)'), 'r')}
      </div>
      <div class="card bk-hl">${hl('Stoßzeit', best[0] ? `${WD[best[1] + 1]} ${best[2]}–${best[2] + 1} Uhr` : '–', best[0] ? `${hrs(best[0] * 60)} Std. im Jahr` : 'noch keine Daten')}
        ${hl('Beliebtester Tag', byDow[bd] ? WDL[bd] : '–', byDow[bd] ? `${hrs(byDow[bd] * 60)} Std. gebucht` : '&nbsp;')}
        ${hl('Beliebtester Platz', favRes && favRes.minutes ? esc(favRes.name) : '–', favRes && favRes.minutes ? `${pct(favRes.rate)} ausgelastet` : '&nbsp;')}
        ${hl('Ø Dauer · Ø Vorlauf', c.count ? `${Math.round(c.minutes / c.count)} Min.` : '–', d.lead != null ? `gebucht ${d.lead < 1 ? `${Math.round(d.lead * 24)} Std.` : `${d.lead.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Tage`} vorher` : '&nbsp;')}</div>
      <div class="bk-two">
        <div class="card"><h3>Auslastung je Platz</h3>${d.perRes.length ? `<div class="bk-res">${d.perRes.map(r => `<div class="bk-rr"><b>${esc(r.name)}</b><div class="bk-meter"><i style="width:${Math.min(100, r.rate * 100)}%"></i><em style="left:${Math.min(100, r.prevRate * 100)}%" title="${d.year - 1}: ${pct(r.prevRate)}"></em></div><span class="r">${pct(r.rate)}</span><span class="r muted">${hrs(r.minutes)} Std.</span></div>`).join('')}</div>
          <p class="muted s" style="margin:12px 0 0">Gebuchte Zeit im Verhältnis zur buchbaren Zeit (Öffnungszeiten ohne Sperren). Strich = ${d.year - 1}.</p>` : '<p class="muted">Keine Plätze.</p>'}
          <div class="bk-mini"><div><span>Spieler</span><b>${c.players}</b>${delta(c.players, p.players)}</div><div><span>mit Gästen</span><b>${c.guests}</b>${delta(c.guests, p.guests)}</div><div><span>mit Buchungsart</span><b>${c.labeled}</b>${delta(c.labeled, p.labeled)}</div></div></div>
        <div class="card"><h3>Verwendung nach Art &amp; Buchungsart</h3>${d.kinds.length ? donut(d.kinds.map(k => ({ name: k.name, v: k.minutes, color: k.color || 'var(--brand)', sub: `${hrs(k.minutes)} Std. · ${k.count}×` })), `${hrs(d.kinds.reduce((x, k) => x + k.minutes, 0))}`, 'Stunden') : '<p class="muted">Noch keine Buchungen in diesem Jahr.</p>'}</div>
      </div>
      <div class="card"><div class="bk-ch"><h3>Jahr ${d.year} · ${hrs(c.minutes)} gebuchte Stunden</h3>${legend()}</div>
        <div class="bk-heatwrap"><div class="bk-heat" style="--w:${weeks.length}">
          <span></span>${months.map(m => `<span class="mo" style="grid-column:span ${m.n}">${m.key ? MON[+m.key - 1] : ''}</span>`).join('')}
          ${WD.slice(1).map((n, r) => `<span class="dl">${n}</span>${weeks.map(w => { const day = addDays(w, r), v = d.days[day] || 0, inY = day.slice(0, 4) === String(d.year);
            return `<i class="${inY ? '' : 'out'}" ${inY ? `title="${deDate(day)}: ${hrs(v)} Std."` : ''} style="${inY && v ? `background:${heat(v, maxDay)}` : ''}"></i>`; }).join('')}`).join('')}
        </div></div></div>
      <div class="bk-two">
        <div class="card"><div class="bk-ch"><h3>Gebuchte Stunden je Monat</h3><span class="bk-leg"><i style="background:var(--brand)"></i>${d.year}<i style="background:var(--line);margin-left:10px"></i>${d.year - 1}</span></div>
          <div class="bk-bars">${MON.map((m, i) => `<div class="bk-bar1" title="${m} ${d.year}: ${hrs(c.month[i])} Std. · ${d.year - 1}: ${hrs(p.month[i])} Std."><div class="bk-bpair"><i class="p" style="height:${p.month[i] / mmax * 100}%"></i><i style="height:${c.month[i] / mmax * 100}%"></i></div><span>${m.slice(0, 3)}</span></div>`).join('')}</div></div>
        <div class="card"><h3>Wer spielt am meisten?</h3>${d.top.length ? `<ol class="bk-top">${d.top.map((t, i) => `<li><span class="n">${i + 1}</span><b>${esc(t.name)}</b><div class="bk-meter"><i style="width:${t.minutes / d.top[0].minutes * 100}%"></i></div><span class="r">${hrs(t.minutes)} Std.</span></li>`).join('')}</ol>` : '<p class="muted">Noch keine Buchungen in diesem Jahr.</p>'}</div>
      </div>
      <div class="card"><div class="bk-ch"><h3>Wann wird gespielt?</h3>${legend()}</div>
        ${hours.length ? `<div class="bk-heatwrap"><div class="bk-bub" style="--h:${hours.length}"><span></span>${hours.map(h => `<span class="hh">${hhmm(h * 60)}</span>`).join('')}
          ${WD.slice(1).map((n, r) => `<span class="dl">${n}</span>${hours.map(h => { const v = d.grid[r][h] || 0; const sz = v ? Math.max(8, Math.round(Math.sqrt(v / gmax) * 40)) : 0;
            return `<span class="bc" title="${n} ${hhmm(h * 60)}: ${hrs(v * 60)} Std.">${sz ? `<i style="width:${sz}px;height:${sz}px;background:${heat(v, gmax)}"></i>` : ''}</span>`; }).join('')}`).join('')}
        </div></div>` : ''}<p class="muted s" style="margin:10px 0 0">Größe und Farbe: gebuchte Stunden im Jahr je Wochentag und Uhrzeit.</p></div>`;
    function legend() { return `<span class="bk-leg">weniger${HEAT.map(c0 => `<i style="background:${c0}"></i>`).join('')}mehr</span>`; }
    $('syY').onchange = () => { st.sy = +val('syY'); showStats(el).catch(fail); };
    $('syR').onchange = () => { st.sr = val('syR'); showStats(el).catch(fail); };
  }

  /* ---------------------------------------------------------------- Gebühren (Gast- und Platzgebühren, Zahlungsstand aus der Mitgliederverwaltung) */
  async function showFees(el) {
    st.fe = st.fe || { year: new Date().getFullYear(), status: 'offen' };
    const g = st.fe;
    const d = await api(`fees?from=${g.year}-01-01&to=${g.year}-12-31&status=${g.status}`);
    const STS = { offen: ['a', 'offen'], bezahlt: ['g', 'bezahlt'], storniert: ['', 'storniert'], unbekannt: ['', 'ohne Zahlungsverfolgung'] };
    const ICO = { o: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', p: '<path d="M4 12.5l5 5L20 6.5"/>', a: '<path d="M4 7h16v12H4zM4 11h16M8 15h3"/>' };
    const ic = k => `<span class="bk-ki"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg></span>`;
    const kpi = (k, label, t, tone = '') => `<div class="card bk-kpi ${tone}"><div class="bk-kh">${ic(k)}<span>${label}</span></div><div class="bk-kv"><b>${euro(t.cents)}</b><span class="bk-d n">${t.count} Posten</span></div></div>`;
    el.innerHTML = `<div class="filterbar"><div class="seg" id="feF">${[['alle', 'Alle'], ['offen', 'Offen'], ['bezahlt', 'Bezahlt']].map(([k, t]) => `<button type="button" data-f="${k}" class="${g.status === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <select id="feY" class="bk-sel" data-nodirty>${d.years.map(y => opt(y, `Jahr ${y}`, g.year)).join('')}</select>
        <span style="flex:1"></span><span class="muted s">${d.rows.length.toLocaleString('de-DE')} ${d.rows.length === 1 ? 'Posten' : 'Posten'}</span></div>
      ${d.note ? `<div class="banner a" style="margin:0 0 16px;font-weight:400">${esc(d.note)}</div>` : ''}
      <div class="bk-kpis" style="grid-template-columns:repeat(3, minmax(0, 1fr))">${kpi('o', d.tracked ? 'Offen' : 'Gebühren (offen)', d.totals.open, 'r')}${kpi('p', 'Bezahlt', d.totals.paid)}${kpi('a', `Gesamt ${g.year}`, d.totals.all, 'b')}</div>
      <div class="card" style="padding:0 20px;overflow:auto">${d.rows.length ? `<table class="tbl bk-tbl bk-fees"><tr><th>Mitglied</th><th class="hm">Datum</th><th class="hm">Platz</th><th class="hm">Text</th><th class="r">Betrag</th><th>Status</th></tr>
        ${d.rows.map(x => `<tr data-b="${x.id}" data-d="${x.date}"><td><b>${esc(x.member)}</b><span class="muted s mo">${deDate(x.date)} · ${x.start}–${x.end}</span></td><td class="hm nw">${deDate(x.date)}<span class="muted s" style="display:block">${x.start}–${x.end}</span></td>
          <td class="hm">${esc(x.resource)}</td><td class="hm">${esc(x.text)}</td><td class="r nw"><b>${euro(x.fee_cents)}</b></td><td>${pill(STS[x.status] || ['', x.status])}${x.paid_at ? `<span class="muted s" style="display:block">${deDate(x.paid_at)}</span>` : ''}</td></tr>`).join('')}</table>` : '<p class="muted" style="padding:24px 0;margin:0">Keine Gebühren in dieser Auswahl.</p>'}</div>
      <p class="muted s">Gast- und Platzgebühren entstehen beim Buchen und werden als offener Posten beim buchenden Mitglied angelegt (Mitgliederverwaltung → Finanzen). Dort werden sie als bezahlt gebucht oder mit dem Einzug abgerechnet. Mitglieder sehen ihre offenen Gebühren in der App, wenn unter „Mitglieder-App“ der Haken „Gebühren zeigen“ gesetzt ist.</p>`;
    const again = () => showFees(el).catch(fail);
    el.querySelectorAll('#feF [data-f]').forEach(b => { b.onclick = () => { g.status = b.dataset.f; again(); }; });
    $('feY').onchange = () => { g.year = +val('feY'); again(); };
    el.querySelectorAll('tr[data-b]').forEach(tr => { tr.style.cursor = 'pointer'; tr.onclick = async () => { const day = await api('day?date=' + tr.dataset.d); const b = day.bookings.find(x => x.id === +tr.dataset.b); if (b) detail(b, again); }; });
  }

  /* ---------------------------------------------------------------- Plätze & Geräte */
  async function showResources(el) {
    const list = await api('resources');
    el.innerHTML = `${can('buchung_einstellungen') ? '<div class="toolbar"><button class="btn primary" id="rsNew">+ Platz</button><button class="btn" id="rsNewA">+ Gerät</button></div>' : ''}
      <div class="card" style="padding:0 20px;overflow:auto">${list.length ? `<table class="tbl bk-tbl"><tr><th>Name</th><th class="hm">Buchbar</th><th class="hm">Raster</th><th class="hm">Gastgebühr</th><th class="r hm">kommende</th><th></th></tr>
        ${list.map((r, i) => `<tr class="${r.active ? '' : 'off'}"><td><b>${esc(r.name)}</b><span class="muted s" style="display:block">${r.kind === 'artikel' ? `Gerät${r.quantity > 1 ? ` · ${r.quantity} Stück` : ''}` : esc(r.area || 'Platz')}${r.department_id ? ` · Abteilung ${esc((st.meta.departments.find(x => x.id === r.department_id) || {}).name || '')}${r.outsiders === 'gesperrt' ? ' (nur Abteilung)' : ` (andere ${euro(r.outsider_fee_cents)})`}` : ''}${r.kind === 'platz' && r.partner_required ? ' · Mitspieler Pflicht' : ''}${r.kind === 'platz' && r.solo_label ? ` · allein: ${esc(r.solo_label)}` : ''}${r.kind === 'artikel' && r.as_partner ? ' · als Mitspieler buchbar' : ''}${r.active ? '' : ' · inaktiv'}</span></td>
          <td class="hm">${esc(r.days === '1234567' ? 'täglich' : r.days.split('').map(d => WD[+d]).join(', '))} · ${r.open_from}–${r.open_to}</td><td class="hm">${dur(r.slot_min)} · max. ${dur(r.max_min)}</td>
          <td class="hm">${r.guest_fee_cents == null ? `<span class="muted s">Standard (${euro(st.meta.settings.guest_fee_cents)})</span>` : euro(r.guest_fee_cents)}</td><td class="r hm">${r.future || '–'}</td>
          <td class="r" style="white-space:nowrap">${can('buchung_einstellungen') ? `<span class="bk-ord"><button class="btn small" data-mv="${i}:-1" ${i === 0 ? 'disabled' : ''} title="nach oben" aria-label="nach oben">↑</button><button class="btn small" data-mv="${i}:1" ${i === list.length - 1 ? 'disabled' : ''} title="nach unten" aria-label="nach unten">↓</button></span><button class="btn small" data-ed="${r.id}">Bearbeiten</button>` : ''}</td></tr>`).join('')}</table>` : '<p class="muted" style="padding:24px;margin:0">Noch nichts angelegt.</p>'}</div>
      ${list.length > 1 && can('buchung_einstellungen') ? '<p class="muted s" style="margin:10px 2px 0">Mit ↑ ↓ legst du die Reihenfolge fest – so stehen Plätze und Geräte im Belegungsplan, in der Mitglieder-App und am Tablet.</p>' : ''}`;
    const again = async () => { await loadMeta(); showResources(el).catch(fail); };
    if ($('rsNew')) $('rsNew').onclick = () => resDialog({ kind: 'platz' }, again);
    if ($('rsNewA')) $('rsNewA').onclick = () => resDialog({ kind: 'artikel' }, again);
    el.querySelectorAll('[data-ed]').forEach(b => { b.onclick = () => resDialog(list.find(r => r.id === +b.dataset.ed), again); });
    el.querySelectorAll('[data-mv]').forEach(b => { b.onclick = async () => {
      const [i, d] = b.dataset.mv.split(':').map(Number), ids = list.map(r => r.id);
      [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
      try { await api('resources/order', 'PUT', { ids }); await again(); const nb = el.querySelector(`[data-mv="${i + d}:${d}"]`) || el.querySelector(`[data-mv="${i + d}:${-d}"]`); if (nb) nb.focus(); } catch (e) { fail(e); }
    }; });
  }
  function resDialog(r, after) {
    const isNew = !r.id, art = r.kind === 'artikel';
    const d = { days: '1234567', open_from: art ? '09:00' : '08:00', open_to: '22:00', slot_min: 60, max_min: art ? 120 : 120, quantity: 1, active: 1, ...r };
    dialog(`<h2>${isNew ? (art ? 'Gerät anlegen' : 'Platz anlegen') : esc(r.name)}</h2>
      <div class="bk-grid" style="--c:4">
        <label class="f w2">Name<input id="rsN" value="${esc(d.name || '')}" placeholder="${art ? 'z. B. Ballmaschine' : 'z. B. Platz 1'}"></label>
        <label class="f">Art<select id="rsK">${opt('platz', 'Platz', d.kind)}${opt('artikel', 'Gerät / Artikel', d.kind)}</select></label>
        <label class="f">Bereich (Reiter)<input id="rsA" value="${esc(d.area || '')}" placeholder="${art ? 'Geräte' : 'z. B. Tennis, Padel'}"></label>
        <div class="f bkf wall"><span>buchbar an</span><div class="bk-chips">${[1, 2, 3, 4, 5, 6, 7].map(x => `<label><input type="checkbox" data-d="${x}" ${String(d.days).includes(String(x)) ? 'checked' : ''}> ${WD[x]}</label>`).join('')}</div></div>
        <label class="f">von<input id="rsF" type="time" value="${d.open_from}" step="900"></label><label class="f">bis<input id="rsT" type="time" value="${d.open_to === '24:00' ? '23:59' : d.open_to}" step="900"></label>
        <label class="f">Zeitraster<select id="rsS">${[15, 30, 45, 60, 90, 120].map(x => opt(x, dur(x), d.slot_min)).join('')}</select></label>
        <label class="f">Höchstdauer am Stück<select id="rsM">${[15, 30, 45, 60, 90, 120, 180, 240, 360, 480].map(x => opt(x, dur(x), d.max_min)).join('')}</select></label>
        <label class="f">Anzahl (gleichzeitig buchbar)<input id="rsQ" inputmode="numeric" value="${d.quantity}"></label>
        <label class="f">Gastgebühr je Gast<input id="rsG" inputmode="decimal" value="${d.guest_fee_cents == null ? '' : centsToInput(d.guest_fee_cents)}" placeholder="Standard ${centsToInput(st.meta.settings.guest_fee_cents)}"></label>
        <label class="f rs-pl">Mitspieler<select id="rsPR">${opt(0, 'optional', d.partner_required ? 1 : 0)}${opt(1, 'Pflicht', d.partner_required ? 1 : 0)}</select></label>
        <label class="f rs-pl">Allein trainieren erlaubt, Bezeichnung<input id="rsSL" maxlength="30" value="${esc(d.solo_label || '')}" placeholder="z. B. Ballwand – leer = nein"></label>
        <label class="chk rs-ar w2" style="align-self:end;min-height:40px"><input type="checkbox" id="rsAP" ${d.as_partner ? 'checked' : ''}> als Mitspieler buchbar (z. B. Ballmaschine – auf allen Plätzen)</label>
        <label class="f ${st.meta.departments.length ? 'w2' : 'wall'}">Hinweis für Mitglieder<input id="rsH" value="${esc(d.note || '')}" placeholder="z. B. Sand – nach dem Spiel abziehen"></label>
        ${st.meta.departments.length ? `<label class="f w2">Gehört der Abteilung<select id="rsD">${opt('', '– ganzer Verein –', d.department_id)}${st.meta.departments.map(x => opt(x.id, x.name, d.department_id)).join('')}</select></label>
        <label class="f rs-dep">Andere Mitglieder<select id="rsO">${opt('gebuehr', 'buchen mit Platzgebühr', d.outsiders)}${opt('gesperrt', 'dürfen nicht buchen', d.outsiders)}</select></label>
        <label class="f rs-dep">Platzgebühr je Person<input id="rsOF" inputmode="decimal" value="${centsToInput(d.outsider_fee_cents != null ? d.outsider_fee_cents : 500)}"></label>` : ''}
        ${isNew ? '' : `<label class="chk wall"><input type="checkbox" id="rsAc" ${d.active ? 'checked' : ''}> aktiv (inaktive Plätze sind nicht buchbar und nicht im Plan)</label>`}
      </div>
      <div class="btns">${isNew ? '' : '<button class="btn ghost danger" id="rsDel">Löschen</button><span style="flex:1"></span>'}<button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="rsOk">Speichern</button></div>`, true);
    const depPaint = () => { if (!$('rsD')) return; const on = Boolean(val('rsD')); $('dialog').querySelectorAll('.rs-dep').forEach(x => { x.style.visibility = on ? '' : 'hidden'; }); if ($('rsOF')) $('rsOF').disabled = val('rsO') === 'gesperrt'; };
    if ($('rsD')) { $('rsD').onchange = depPaint; $('rsO').onchange = depPaint; } depPaint();
    // Platz: Mitspieler-Pflicht und Allein-Training · Gerät: „als Mitspieler buchbar“ – je nach Art nur die passenden Felder
    const kindPaint = () => { const ar = val('rsK') === 'artikel'; $('dialog').querySelectorAll('.rs-pl').forEach(x => { x.style.display = ar ? 'none' : ''; }); $('dialog').querySelectorAll('.rs-ar').forEach(x => { x.style.display = ar ? '' : 'none'; }); };
    $('rsK').onchange = kindPaint; kindPaint();
    $('c').onclick = closeDialog;
    $('rsOk').onclick = () => GK.busy($('rsOk'), async () => {
      const body = { name: val('rsN'), kind: val('rsK'), area: val('rsA'), days: [...$('dialog').querySelectorAll('[data-d]:checked')].map(x => x.dataset.d).join(''),
        open_from: val('rsF'), open_to: val('rsT') === '23:59' ? '24:00' : val('rsT'), slot_min: +val('rsS'), max_min: +val('rsM'), quantity: +val('rsQ') || 1,
        guest_fee_cents: val('rsG') === '' ? null : toCents(val('rsG')), note: val('rsH'),
        partner_required: +val('rsPR') === 1, solo_label: val('rsSL'), as_partner: $('rsAP').checked,
        ...($('rsD') ? { department_id: +val('rsD') || null, outsiders: val('rsO'), outsider_fee_cents: toCents(val('rsOF') || '0') } : {}), ...(isNew ? {} : { active: $('rsAc').checked }) };
      try { if (isNew) await api('resources', 'POST', body); else await api('resources/' + r.id, 'PUT', body); closeDialog(); toast('Gespeichert.'); after(); } catch (e) { fail(e); }
    });
    if ($('rsDel')) $('rsDel').onclick = async () => {
      if (!await ask(`„${r.name}“ wirklich löschen?\n\nVergangene Buchungen bleiben im Protokoll und in der Auswertung erhalten. Gibt es noch kommende Buchungen, Serien oder Sperren, geht es nicht – dann erst stornieren oder auf „inaktiv“ setzen.`, { ok: 'Löschen', danger: true })) return;
      try { await api('resources/' + r.id, 'DELETE'); closeDialog(); toast('Gelöscht.'); after(); } catch (e) { fail(e); }
    };
  }

  /* ---------------------------------------------------------------- Einstellungen (Unterbereiche, Speichern je Karte) */
  const SET_SECS = [['regeln', 'Buchungsregeln'], ['wer', 'Wer darf buchen?'], ['ordnung', 'Platzordnung'], ['app', 'Mitglieder-App'], ['transfer', 'Übertragen']];
  async function showSettings(el) {
    const s = await api('settings');
    const num = (k, l, o = {}) => `<label class="f ${o.cls || ''}">${esc(l)}<input id="bs_${k}" inputmode="numeric" value="${s[k]}"></label>`;
    const chk = (k, l) => `<label class="chk"><input type="checkbox" id="bs_${k}" ${s[k] ? 'checked' : ''}> ${esc(l)}</label>`;
    const save = id => `<div class="btns"><button class="btn primary" id="${id}">Speichern</button></div>`;
    el.innerHTML = `
      <div class="card" data-set="regeln"><h3>Buchungsregeln</h3>
        <div class="bk-grid" style="--c:4">${num('advance_days', 'Vorlauf (Tage im Voraus)')}${num('max_open_platz', 'offene Platzbuchungen je Mitglied')}${num('max_open_artikel', 'offene Gerätebuchungen je Mitglied')}
          <label class="f">Stornieren bis … vor Beginn<select id="bs_cancel_before_min">${[[0, 'bis zum Beginn'], [60, '1 Stunde'], [120, '2 Stunden'], [360, '6 Stunden'], [1440, '1 Tag']].map(([v, l]) => opt(v, l, s.cancel_before_min)).join('')}</select></label>
          ${num('max_partners', 'Mitspieler höchstens')}${num('max_guests', 'Gäste höchstens')}
          <label class="f">Gastgebühr je Gast (Standard)<input id="bs_guest_fee" inputmode="decimal" value="${centsToInput(s.guest_fee_cents)}"></label>${num('max_waits', 'Warteliste: Einträge je Mitglied')}</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
          ${chk('count_partners', 'Mitspieler zählen beim Kontingent mit (wer mitspielt, kann nicht gleichzeitig selbst buchen)')}
          ${chk('notify_partners', 'Mitspieler bekommen eine E-Mail, wenn sie eingetragen werden')}
          ${chk('show_names', 'Namen in der Belegung für alle Mitglieder sichtbar (sonst nur „belegt“)')}
          ${chk('show_now', 'Mitglieder-App: „Jetzt auf der Anlage“ über der Belegung zeigen (wer gerade spielt und wer in der nächsten Stunde kommt)')}
          ${chk('waitlist', 'Warteliste: bei belegter Zeit vormerken, E-Mail sobald frei')}
          ${chk('tablet_booking', 'Am Tablet im Vereinsheim buchen (mit Name und PIN – wie in der App bis zum Vorlauf)')}</div>
        <p class="muted s">Gastgebühren werden als offener Posten beim buchenden Mitglied angelegt (Mitgliederverwaltung) und mit dem nächsten Einzug abgerechnet. Wird die Buchung storniert, entfällt der Posten.</p>
        ${save('bsOk')}</div>
      ${st.meta.mv ? `<div class="card" data-set="wer"><h3>Wer darf buchen?</h3><p class="muted s" style="margin-top:0">Gilt für die buchende Person und alle Mitspieler (aus der Mitgliederverwaltung). Die Verwaltung kann immer für jeden buchen.</p>
        <div class="f bkf"><span>Mitgliedschaft</span><div class="bk-chips">${[['aktiv', 'aktiv'], ['ehren', 'Ehrenmitglied'], ['passiv', 'passiv / unterstützend'], ['ruhend', 'ruhend']].map(([k, l]) => `<label><input type="checkbox" data-st="${k}" ${s.allowed_status.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
        ${st.meta.fees.length ? `<div class="f bkf" style="margin-top:12px"><span>Diese Beitragsarten dürfen <b>nicht</b> buchen (z. B. „Fördermitglied“)</span><div class="bk-chips">${st.meta.fees.map(f => `<label><input type="checkbox" data-bf="${f.id}" ${s.blocked_fees.includes(f.id) ? 'checked' : ''}> ${esc(f.name)}</label>`).join('')}</div></div>` : ''}
        ${save('bsOkWer')}</div>` : ''}
      <div class="card" data-set="ordnung"><h3>Platzordnung</h3><p class="muted s" style="margin-top:0">Wird vor jeder Buchung angezeigt und muss bestätigt werden. Leer lassen, wenn nicht nötig.</p>
        <label class="f"><textarea id="bs_rules" rows="5" placeholder="z. B. Bitte nur mit Tennisschuhen spielen. Plätze nach dem Spiel abziehen und Linien kehren.">${esc(s.rules)}</textarea></label>
        ${save('bsOkOrd')}</div>
      <div class="card" id="bkRights" data-set="app" data-nodirty><h3>Sonderrechte in der Mitglieder-App</h3><p class="muted s" style="margin-top:0">Einzelne Mitglieder dürfen in der App Serien anlegen (z. B. Trainer: jeden Dienstag 18–20 Uhr), für andere Mitglieder buchen (z. B. für ein älteres Mitglied ohne Handy – Kontingent, Regeln und Gebühren gelten dann für dieses Mitglied) oder mit bestimmten bzw. allen Buchungsarten buchen – zusätzlich zu den Rechten an der Buchungsart selbst.</p>
        <div class="bk-grid" style="--c:4"><label class="f w2">Mitglied<select id="rtM"><option value="">– Mitglied wählen –</option>${st.meta.people.map(p => opt(p.id, GK.lastFirst(p.name, 'mitglied'))).join('')}</select></label>
          <label class="chk" style="align-self:end;min-height:40px"><input type="checkbox" id="rtS"> darf Serien anlegen</label>
          <label class="chk" style="align-self:end;min-height:40px"><input type="checkbox" id="rtF"> darf für andere buchen</label>
          <label class="chk wall"><input type="checkbox" id="rtA"> darf mit allen Buchungsarten buchen <span class="muted s">(auch mit künftig angelegten)</span></label>
          <div class="f bkf wall" id="rtLabs"><span>darf mit diesen Buchungsarten buchen</span><div class="bk-chips">${st.meta.labels.filter(l => l.active).map(l => `<label><input type="checkbox" data-rl="${l.id}"><i class="bk-dot" style="background:${l.color};margin-right:0"></i>${esc(l.name)}</label>`).join('')}</div></div></div>
        <div class="btns"><button class="btn primary" id="rtOk">Sonderrechte speichern</button></div>
        <div id="rtList" style="margin-top:8px"></div></div>
      <div class="card" data-set="app"><h3>Von unterwegs buchen</h3>
        <p class="muted s" style="margin:0">Damit Mitglieder auch außerhalb des Vereins-WLANs buchen können, wird nur die Mitglieder-App über einen <b>Cloudflare Tunnel</b> erreichbar gemacht – ohne offenen Port am Router; Verwaltung und Tablet bleiben intern. Einrichtung: <a href="#app" data-goapp>Verein → Mitglieder-App → „Von unterwegs erreichbar“</a> und die Anleitung in der Dokumentation.</p></div>
      <div id="bkFunc" data-set="transfer"></div>`;
    if (GK.funcBox) GK.funcBox($('bkFunc'), 'buchung', 'Buchungssystem', () => showSettings(el).catch(fail));
    if (GK.sectionize) GK.sectionize({ root: el, secs: SET_SECS, store: 'cw_setsec_bk' });
    GK.watch(el);
    const goApp = el.querySelector('[data-goapp]'); if (goApp) goApp.onclick = e => { e.preventDefault(); GK.go('app'); };
    /* „alle Buchungsarten“ schließt die Einzelauswahl ein – die Chips werden dann gesperrt */
    const rtAll = () => { const on = $('rtA').checked; $('rtLabs').classList.toggle('dim', on); el.querySelectorAll('[data-rl]').forEach(c => { c.disabled = on; }); };
    $('rtA').onchange = rtAll;
    const rtLoad = async () => {
      const l = await api('rights');
      const lab = id => st.meta.labels.find(x => x.id === id);
      $('rtList').innerHTML = l.length ? `<table class="tbl bk-tbl"><tr><th>Mitglied</th><th>Sonderrechte</th><th></th></tr>${l.map(r => `<tr><td><b>${esc(GK.lastFirst(r.name, 'mitglied'))}</b></td>
        <td><div class="bk-chips" style="gap:6px">${r.series ? pill(['b', 'Serien']) : ''}${r.for_others ? pill(['b', 'für andere buchen']) : ''}${r.all_labels ? pill(['b', 'alle Buchungsarten']) : ''}${(r.all_labels ? [] : r.labels).map(id => lab(id)).filter(Boolean).map(x => `<span class="pill" style="background:${x.color};color:${ink(x.color)}">${esc(x.name)}</span>`).join('')}</div></td>
        <td class="r"><span class="acts"><button class="btn ico" data-rte="${r.member_id}" title="Bearbeiten" aria-label="Bearbeiten"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/></svg></button><button class="btn ico danger-h" data-rtd="${r.member_id}" title="Sonderrechte entfernen" aria-label="Entfernen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></span></td></tr>`).join('')}</table>` : '<p class="muted" style="margin:0">Noch niemand mit Sonderrechten.</p>';
      $('rtList').querySelectorAll('[data-rte]').forEach(b => { b.onclick = () => { const r = l.find(x => x.member_id === +b.dataset.rte); $('rtM').value = r.member_id; $('rtS').checked = r.series; $('rtF').checked = r.for_others; $('rtA').checked = r.all_labels; el.querySelectorAll('[data-rl]').forEach(c => { c.checked = r.labels.includes(+c.dataset.rl); }); rtAll(); $('bkRights').scrollIntoView({ block: 'start', behavior: 'smooth' }); }; });
      $('rtList').querySelectorAll('[data-rtd]').forEach(b => { b.onclick = async () => { try { await api('rights/' + b.dataset.rtd, 'DELETE'); toast('Sonderrechte entfernt.'); rtLoad(); } catch (e) { fail(e); } }; });
    };
    $('rtOk').onclick = () => GK.busy($('rtOk'), async () => {
      try { const r = await api('rights', 'PUT', { member_id: +val('rtM'), series: $('rtS').checked, for_others: $('rtF').checked, all_labels: $('rtA').checked, labels: [...el.querySelectorAll('[data-rl]:checked')].map(c => +c.dataset.rl) });
        toast(r.removed ? 'Keine Sonderrechte mehr.' : 'Gespeichert.'); $('rtM').value = ''; $('rtS').checked = false; $('rtF').checked = false; $('rtA').checked = false; el.querySelectorAll('[data-rl]').forEach(c => { c.checked = false; }); rtAll(); rtLoad(); } catch (e) { fail(e); }
    });
    rtLoad().catch(fail);
    // Speichern je Karte: nur die Felder der jeweiligen Karte werden gesendet (der Server übernimmt nur, was dabei ist)
    const saveCard = (btn, body) => GK.busy(btn, async () => { try { await api('settings', 'PUT', body()); GK.clean(); toast('Gespeichert.'); await loadMeta(); } catch (e) { fail(e); } });
    $('bsOk').onclick = () => saveCard($('bsOk'), () => {
      const b = { guest_fee_cents: toCents(val('bs_guest_fee') || '0'), cancel_before_min: +val('bs_cancel_before_min') };
      for (const k of ['advance_days', 'max_open_platz', 'max_open_artikel', 'max_partners', 'max_guests', 'max_waits']) b[k] = +val('bs_' + k);
      for (const k of ['count_partners', 'notify_partners', 'show_names', 'show_now', 'waitlist', 'tablet_booking']) b[k] = $('bs_' + k).checked;
      return b;
    });
    if ($('bsOkWer')) $('bsOkWer').onclick = () => saveCard($('bsOkWer'), () => ({ allowed_status: [...el.querySelectorAll('[data-st]:checked')].map(x => x.dataset.st), blocked_fees: [...el.querySelectorAll('[data-bf]:checked')].map(x => +x.dataset.bf) }));
    $('bsOkOrd').onclick = () => saveCard($('bsOkOrd'), () => ({ rules: $('bs_rules').value }));
  }

  const G = { key: 'buchung', label: 'Buchungssystem', icon: 'kalender', order: 2 };   // Menü: Verkauf 1 · Buchungssystem 2 · Helferdienste 3 · Zeiterfassung 4 · Beregnung 5 · Zugang 6 · Mitgliederverwaltung 7 · Buchhaltung 8
  const ANY = ['buchung', 'buchung_buchen', 'buchung_stornieren', 'buchung_serien', 'buchung_einstellungen'];
  GK.registerPage({ key: 'bk-belegung', title: 'Belegung', perm: ANY, render: pageRender('bk-belegung', showPlan), group: G });
  GK.registerPage({ key: 'bk-serien', title: 'Serien & Sperren', perm: ANY, render: pageRender('bk-serien', showSeries), group: G });
  GK.registerPage({ key: 'bk-protokoll', title: 'Buchungsprotokoll', perm: ANY, render: pageRender('bk-protokoll', showLog), group: G, tab: 'Protokoll' });
  GK.registerPage({ key: 'bk-auswertung', title: 'Auswertung', perm: ANY, render: pageRender('bk-auswertung', showStats), group: G });
  GK.registerPage({ key: 'bk-gebuehren', title: 'Gebühren', perm: ANY, render: pageRender('bk-gebuehren', showFees), group: G });
  GK.registerPage({ key: 'bk-labels', title: 'Buchungsarten', perm: ANY, render: pageRender('bk-labels', showLabels), group: G });
  GK.registerPage({ key: 'bk-plaetze', title: 'Plätze & Geräte', perm: ANY, render: pageRender('bk-plaetze', showResources), group: G });
  GK.registerPage({ key: 'bk-einstellungen', title: 'Einstellungen', perm: 'buchung_einstellungen', render: pageRender('bk-einstellungen', showSettings), group: G });
})();
