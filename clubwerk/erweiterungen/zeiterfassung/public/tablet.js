'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = CW.esc;
  const pad = n => String(n).padStart(2, '0');
  const hm = min => `${Math.floor(min / 60)}:${pad(min % 60)}`;
  const clock = ts => ts.slice(11, 16);
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const dayLabel = ts => {
    const d = new Date(ts.replace(' ', 'T')), t = new Date();
    if (d.toDateString() === t.toDateString()) return 'heute';
    const y = new Date(t); y.setDate(t.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'gestern';
    return `${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
  };
  let state = { staff: [] };
  let closeTimer = null;

  const toast = GKTab.toast(3500);
  const api = (url, body) => GKTab.api(url, body, 'Fehler');


  async function load() {
    try { state = await api('../../api/tablet/x/zeiterfassung/state'); } catch (e) { if (!e.gate) toast('Keine Verbindung zum Server.', true); return; }
    // Vereinsname und Logo: gemeinsame Kopfzeile (nav.js)
    GKMerk.merken('zeiterfassung', state);
    render();
  }

  const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  function render() {
    // Kachel wie im Verkauf: Initialen · Name + Tätigkeit/Zeit · Marke rechts (da / nicht da / vergessen)
    $('staff').innerHTML = state.staff.map(s => {
      const n = t => `<span class="num">${t}</span>`;
      const line = s.forgotten ? `nicht ausgestempelt seit ${dayLabel(s.in_since)} ${n(clock(s.in_since))}`
        : s.in_since ? `seit ${dayLabel(s.in_since) === 'heute' ? '' : dayLabel(s.in_since) + ' '}${n(clock(s.in_since))} Uhr`
          : s.last_out ? `zuletzt ${dayLabel(s.last_out)} ${n(clock(s.last_out))}` : '';
      const chip = s.forgotten ? '<span class="tk-chip r">vergessen</span>' : s.in_since ? '<span class="tk-chip g">da</span>' : '<span class="tk-chip">nicht da</span>';
      return `<button data-id="${s.id}" class="tk-tile ${s.forgotten ? 'warn' : s.in_since ? 'on' : ''}"><i class="av">${esc(initials(s.name))}</i><span class="tk-txt"><b>${esc(s.ln)}</b><span>${[esc(s.job || ''), line].filter(Boolean).join(' · ')}</span></span>${chip}</button>`;
    }).join('');
    if (!state.staff.length) $('staff').innerHTML = '<p class="tk-empty" style="grid-column:1/-1;margin:0">Noch kein Personal angelegt – in der Verwaltung unter „Zeiterfassung“.</p>';
    $('staff').querySelectorAll('button[data-id]').forEach(b => b.onclick = () => askPin(state.staff.find(s => s.id === Number(b.dataset.id))));
  }

  function closeDialog() { clearTimeout(closeTimer); $('overlay').classList.add('hidden'); $('dialog').innerHTML = ''; }

  function askPin(s) {
    const goingOut = Boolean(s.in_since) && !s.forgotten;
    GKPin.ask({ show: html => { $('dialog').className = 'dialog'; GKTab.dlg(html); }, close: closeDialog, title: esc(s.name), sub: `Bitte deine PIN eingeben – ${goingOut ? 'Gehen' : 'Kommen'}`,
      min: 4, minText: 'Die PIN hat mindestens 4 Ziffern.' }, async pin => {
      try { done(await api('../../api/tablet/x/zeiterfassung/stamp', { staffId: s.id, pin })); }
      catch (e) { if (e.gate) return closeDialog(); return e.message; }
    });
    clearTimeout(closeTimer); closeTimer = setTimeout(closeDialog, 60000);
  }

  function done(r) {
    const first = r.name.split(' ')[0];
    const CHECK = '<svg aria-hidden="true" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:top;margin-top:16px"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>', UNDO = '<svg aria-hidden="true" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:top;margin-top:16px"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
    const T = {
      in: [`Hallo, ${first}!`, `Kommen ${clock(r.at)} Uhr`, CHECK, ''],
      'in-after-forgotten': [`Hallo, ${first}!`, `Kommen ${clock(r.at)} Uhr`, CHECK, '<p class="note">Beim letzten Mal wurde nicht ausgestempelt. Bitte dem Vorstand sagen, wann Schluss war.</p>'],
      out: [`Tschüss, ${first}!`, `Gehen ${clock(r.at)} Uhr`, CHECK, ''],
      undo: ['Zurückgenommen', 'Einstempeln gelöscht', UNDO, '<p class="note">Du warst gerade erst eingestempelt – das wurde als Versehen gelöscht.</p>'],
    }[r.action];
    $('dialog').className = 'dialog done';
    $('dialog').innerHTML = `<div class="big">${T[2]}</div><h2>${esc(T[0])}</h2><div class="when">${T[1]}</div>
      <div class="kv">${r.action === 'out' ? `<span>Heute</span><b class="num">${clock(r.since)} – ${clock(r.at)} · ${hm(r.today_minutes)} Std.</b>` : ''}
        <span>${(r.month ? new Date(+r.month.slice(0, 4), +r.month.slice(5, 7) - 1, 15) : new Date()).toLocaleString('de-DE', { month: 'long' })} bisher</span><b class="num">${hm(r.month_minutes)} Std.</b></div>
      ${T[3]}<button class="btn primary" id="okBtn">OK</button>`;
    $('okBtn').onclick = closeDialog;
    clearTimeout(closeTimer); closeTimer = setTimeout(closeDialog, 12000);
    load();
  }

  /* Passwortschutz (wie Buchungsseite) */
  GKTab.gate(load, closeDialog);

  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  setInterval(() => { if ($('overlay').classList.contains('hidden')) load(); }, 30000);
  { const last = GKMerk.holen('zeiterfassung'); if (last && last.staff) { state = last; render(); } }   // letzter Stand sofort, danach frisch (nav.js, GKMerk)
  load();
})();
