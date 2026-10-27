'use strict';
/* Turniere – Bereich in der Mitglieder-App: Anmeldung, „Dein nächstes Spiel“, meine Spiele (Termin buchen, Ergebnis eintragen,
   Gegner anrufen), Tabellen und Endrunde. Tabellen und Bäume kommen aus ansicht.js (gleich wie Tablet und Verwaltung). */
(() => {
  if (!window.VA) return;
  if (!document.getElementById('tuAppStyle')) {
    const s = document.createElement('style'); s.id = 'tuAppStyle';
    s.textContent = `
      .tu-sets { display: grid; grid-template-columns: minmax(0, 1fr) 64px 14px 64px; gap: 8px 6px; align-items: center; margin: 4px 0 10px; }
      .tu-sets .h { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tu-sets .l { font-size: 14px; font-weight: 700; color: var(--ink); }
      .tu-sets .c { text-align: center; color: var(--muted); font-weight: 700; }
      .vh-sheet.vh-form .tu-sets .vh-input { margin: 0; text-align: center; font-family: var(--num); font-size: 20px; font-weight: 600; padding: 0 6px; }
      .tu-slots { display: grid; gap: 12px; margin: 4px 0 10px; }
      .tu-slots h4 { margin: 0 0 6px; font-size: 13px; font-weight: 700; color: var(--muted); }
      .tu-slots .t { display: flex; flex-wrap: wrap; gap: 6px; }
      .tu-slots button { min-width: 72px; min-height: 44px; border-radius: 999px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font-family: var(--num); font-size: 17px; font-weight: 600; }
      .tu-slots button.on { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
      .tu-who { display: grid; gap: 8px; margin: 0 0 10px; }
      .tu-act { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 0 12px; }
      .tu-act .vh-btn { min-width: 0; }
      .tu-row { cursor: pointer; }
      .tu-row .vh-tx strong, .tu-row .vh-tx small { white-space: nowrap; }
      .tu-row .vh-chip.num { font-family: var(--num); font-size: 14px; font-weight: 600; }
      .tu-nodate { width: 48px; height: 46px; flex: none; border-radius: 12px; background: var(--hover); color: var(--muted); display: flex; align-items: center; justify-content: center; }
      .tu-nodate svg { width: 22px; height: 22px; }
      .tu-more { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 4px; }
      .tu-more summary { min-height: 44px; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800; color: var(--ink); cursor: pointer; list-style: none; }
      .tu-more summary::-webkit-details-marker { display: none; }
      .tu-more summary::after { content: ''; margin-left: auto; width: 8px; height: 8px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(45deg); }
      .tu-more[open] summary::after { transform: rotate(-135deg); }
      .tu-more summary small { font-size: 12.5px; font-weight: 600; color: var(--muted); }
      .tu-more .tu-res { padding: 4px 0 2px; }`;
    document.head.appendChild(s);
  }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const dd = d => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
  const dm = d => (d ? `${WD[new Date(d + 'T12:00:00').getDay()]}, ${dd(d)}` : '');
  const telOf = p => String(p || '').replace(/[^\d+]/g, '');
  const CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>';
  const VIEWS = [['spiele', 'Meine Spiele'], ['tabellen', 'Tabellen'], ['endrunde', 'Endrunde']];

  window.VA.registerSection({
    id: 'turniere',
    render(el, ctx) {
      let d = null, view = 'spiele', league = null, comp = 'E', dkey = null;
      const sheet = () => { let sh = document.getElementById('tuSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'tuSheet'; sh.className = 'vh-sheet vh-form'; document.body.appendChild(sh); } return sh; };
      const close = () => { const sh = document.getElementById('tuSheet'); if (sh) sh.classList.remove('show'); };
      ctx.onLeave(close);

      async function load(focus) {
        try { d = await ctx.api('state'); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        if (!d.season) { el.innerHTML = '<div class="vh-empty">Gerade läuft keine Clubmeisterschaft.</div>'; return; }
        if (!league || !d.leagues.some(l => l.key === league)) league = d.me.league || (d.leagues[0] || {}).key;
        if (!dkey || !d.doubles.some(x => x.key === dkey)) dkey = (d.doubles.find(x => x.key.split('+').includes(d.me.league)) || d.doubles[0] || {}).key || null;
        if (!d.doubles.length) comp = 'E';
        paint();
        const m = focus && d.mine.find(x => String(x.id) === String(focus));
        if (m) detail(m);
      }
      /* ---------- Darstellung ---------- */
      function paint() {
        const V = window.TurnierAnsicht, s = d.season;
        const seg = `<div class="vh-seg" role="tablist">${VIEWS.map(([k, l]) => `<button type="button" data-v="${k}" class="${k === view ? 'on' : ''}">${l}</button>`).join('')}</div>`;
        let body = '';
        if (view === 'spiele') body = mineHtml();
        else if (view === 'tabellen') {
          const dbl = comp === 'D', list = dbl ? d.doubles : d.leagues, cur = dbl ? dkey : league;
          const lg = list.find(l => l.key === cur) || list[0];
          body = (d.doubles.length ? `<div class="vh-seg">${[['E', 'Einzel'], ['D', 'Doppel']].map(([k, l]) => `<button type="button" data-c="${k}" class="${k === comp ? 'on' : ''}">${l}</button>`).join('')}</div>` : '')
            + (list.length > 1 ? `<div class="vh-seg">${list.map(l => `<button type="button" data-l="${esc(l.key)}" class="${l.key === lg.key ? 'on' : ''}">${esc(dbl ? l.key : l.label)}</button>`).join('')}</div>` : '')
            + (lg && lg.groups.length ? lg.groups.map(g => `<div class="vh-card"><h3><span>Gruppe <span translate="no">${esc(g.label)}</span></span>${g.done ? ' <small>fertig</small>' : ''}</h3>${V.table(g, { up: dbl ? 2 : lg.key === d.top ? 2 : 1 })}
              <details class="tu-more"><summary>Spiele <small>${g.matches.filter(m => m.winner || m.result === 'ausgefallen').length} von ${g.matches.length} gewertet</small></summary>${V.results(g.matches)}</details></div>`).join('') : `<div class="vh-empty">${dbl ? 'Die Doppel-Gruppen sind noch nicht ausgelost.' : 'Die Gruppen sind noch nicht ausgelost.'}</div>`);
        } else {
          body = (d.finals.length ? `<div class="vh-card"><h3>Endrunde Liga ${esc(d.top)}</h3>${V.tree(d.finals, d.champion)}</div>` : `<div class="vh-card"><h3>Endrunde Liga ${esc(d.top)}</h3><p class="vh-none">Die Endrunde steht fest, sobald die Gruppen der Liga ${esc(d.top)} fertig sind: Erster und Zweiter beider Gruppen spielen über Kreuz das Halbfinale.</p></div>`)
            + d.doubles.filter(x => x.finals.length).map(x => `<div class="vh-card"><h3>Endrunde ${esc(x.label)}</h3>${V.tree(x.finals, x.champion, `Clubmeister ${x.label}`)}</div>`).join('')
            + `<div class="vh-card"><h3>Relegation</h3>${d.relegation.length ? V.relegation(d.relegation) : '<p class="vh-none">Der Letzte jeder Gruppe spielt gegen die Gruppensieger der Liga darunter – sobald beide Ligen fertig sind.</p>'}</div>`
            + (d.honors.length ? `<div class="vh-card"><h3>Ehrentafel</h3>${V.honors(d.honors)}</div>` : '');
        }
        el.innerHTML = `${seg}${body}`;
        el.querySelectorAll('[data-v]').forEach(b => { b.onclick = () => { view = b.dataset.v; paint(); }; });
        el.querySelectorAll('[data-l]').forEach(b => { b.onclick = () => { if (comp === 'D') dkey = b.dataset.l; else league = b.dataset.l; paint(); }; });
        el.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { comp = b.dataset.c; paint(); }; });
        el.querySelectorAll('[data-m]').forEach(r => { const go = () => detail(d.mine.find(x => x.id === +r.dataset.m)); r.onclick = go; r.onkeydown = e => { if (e.key === 'Enter') go(); }; });
        const reg = el.querySelector('#tuReg');
        if (reg) reg.onclick = () => { const sg = el.querySelector('#tuRS'), db = el.querySelector('#tuRD'); register(sg ? sg.checked : !d.me.registered, db ? db.checked : false, reg); };
        const nx = el.querySelector('#tuNext'); if (nx) nx.onclick = () => detail(d.mine.find(x => x.id === +nx.dataset.id));
        void s;
      }
      function mineHtml() {
        const s = d.season, open = d.mine.filter(m => !m.done);
        const next = open.find(m => m.date && m.date >= d.today) || open[0];
        let h = '';
        if (s.regOpen) h += `<div class="vh-card"><h3>${esc(s.name)}</h3><p class="vh-lead">${d.me.registered ? `Du bist angemeldet${d.me.league ? ` (Liga <span translate="no">${esc(d.me.league)}</span>)` : ''}. Die Gruppen${s.doubles.length ? ' und die Doppelpartner' : ''} werden nach dem Anmeldeschluss ausgelost.` : `Spiel mit! Die Liga ergibt sich aus der letzten Saison – neu Angemeldete starten in der untersten Liga.${s.doubles.length ? ' Im Doppel wird dir ein Partner aus der Nachbarliga zugelost.' : ''}`}${s.reg_until ? ` Anmeldeschluss: ${esc(dm(s.reg_until))}.` : ''}</p>
          ${s.doubles.length ? `<label class="vh-check"><input type="checkbox" id="tuRS" ${d.me.singles || !d.me.registered ? 'checked' : ''}><span>Einzel</span></label><label class="vh-check"><input type="checkbox" id="tuRD" ${d.me.doubles ? 'checked' : ''}><span>Doppel</span></label>` : ''}
          <button type="button" class="vh-btn wide${d.me.registered ? ' sec' : ''}" id="tuReg">${d.me.registered ? (s.doubles.length ? 'Anmeldung ändern' : 'Abmelden') : 'Ich spiele mit'}</button></div>`;
        if (next) {
          const t = next.date ? `<div class="t"><b>${esc(next.time || dd(next.date))}</b><small>${esc(next.time ? dm(next.date) : WD[new Date(next.date + 'T12:00:00').getDay()])}</small></div>` : `<div class="t">${CAL.replace('<svg', '<svg width="30" height="30"')}<small>offen</small></div>`;
          h += `<div class="vh-next hero">${t}<div class="i"><b translate="no">${esc(next.opponent)}</b><span>${esc(next.date ? [next.phase === 'gruppe' ? 'Gruppenspiel' : next.where, next.court].filter(Boolean).join(' · ') : `${next.phase === 'gruppe' ? 'Gruppenspiel' : next.where}${next.due ? ` · Frist ${dm(next.due)}` : ''}`)}</span></div>
            <button type="button" class="o" id="tuNext" data-id="${next.id}">${next.date ? 'Öffnen' : 'Termin'}</button></div>`;
        }
        if (d.mine.length) h += `<div class="vh-card"><h3>Meine Spiele <small>${open.length ? `${open.length} offen` : 'alle gespielt'}</small></h3><div class="vh-rows">${d.mine.map(m => {
          const day = m.date || (m.done && m.entered_at ? m.entered_at.slice(0, 10) : '');
          const lead = day ? `<span class="vh-date${day === d.today && !m.done ? ' today' : ''}"><b>${dd(day)}</b><span>${WD[new Date(day + 'T12:00:00').getDay()]}</span></span>` : `<span class="tu-nodate">${CAL}</span>`;
          const right = m.done ? `<span class="vh-chip num ${m.result === 'ausgefallen' ? '' : m.won ? 'g' : 'r'}">${esc(m.result === 'ausgefallen' ? 'ausgefallen' : mineScore(m))}</span>` : m.due && m.due < d.today ? '<span class="vh-chip r">überfällig</span>' : m.date ? '<span class="vh-chip g">Termin</span>' : '<span class="vh-chip a">offen</span>';
          const sub0 = m.done ? m.where : m.date ? [m.time ? `${m.time} Uhr` : '', m.court].filter(Boolean).join(' · ') || m.where : `${m.where}${m.due ? ` · Frist ${dm(m.due)}` : ''}`;
          const sub = m.partner ? `mit ${m.partner.split(', ').reverse().join(' ')} · ${sub0.replace(/, Gruppe \d+ – Gruppenphase| – Gruppenphase/, '')}` : sub0;
          return `<div class="tu-row" data-m="${m.id}" role="button" tabindex="0">${lead}<span class="vh-tx"><strong translate="no">gegen ${esc(m.opponent)}</strong><small>${esc(sub)}</small></span>${right}</div>`;
        }).join('')}</div></div>`;
        else if (!s.regOpen) h += `<div class="vh-card"><h3>${esc(s.name)}</h3><p class="vh-none">${d.me.registered ? 'Die Gruppen sind noch nicht ausgelost.' : 'Du spielst in dieser Saison nicht mit. Tabellen und Endrunde siehst du oben.'}</p></div>`;
        return h;
      }
      /** Ergebnis aus eigener Sicht („6:4 3:6 10:7“ mit meinen Spielen zuerst) */
      const mineScore = m => (m.result === 'wo' ? 'w. o.' : m.sets.map(x => (m.side === 'a' ? x : [x[1], x[0]]).join(':')).join(' ') + (m.result === 'aufgabe' ? ' Aufg.' : ''));

      async function register(singles, doubles, btn) {
        btn.disabled = true;
        try { await ctx.api('anmeldung', 'POST', { singles, doubles }); ctx.toast(singles || doubles ? 'Du bist angemeldet – viel Erfolg!' : 'Abgemeldet.'); load(); }
        catch (e) { ctx.toast(e.message, true); btn.disabled = false; }
      }

      /* ---------- Spiel: Termin, Ergebnis, Kontakt ---------- */
      function detail(m) {
        if (!m) return;
        const sh = sheet();
        const when = m.date ? `${dm(m.date)}${m.time ? ` · ${m.time}${m.end ? `–${m.end}` : ''} Uhr` : ''}` : '';
        sh.innerHTML = `<div class="vh-box"><h2 translate="no">gegen ${esc(m.opponent)}</h2><p>${m.partner ? `mit <span translate="no">${esc(m.partner)}</span> · ` : ''}${esc(m.where)}${m.due && !m.done ? ` · Frist ${esc(dm(m.due))}` : ''}</p>
          ${m.done ? `<dl class="vh-kv" style="margin-bottom:14px"><dt>Ergebnis</dt><dd class="num" style="font-size:18px">${esc(m.result === 'ausgefallen' ? 'ausgefallen' : mineScore(m))}</dd><dt>Eingetragen von</dt><dd translate="no">${esc(m.entered_by || '–')}</dd></dl>
            <p class="vh-small">Stimmt etwas nicht? Der Sportwart kann das Ergebnis korrigieren.</p>`
          : `${m.lost ? '<div class="vh-bar a"><span>Die Platzbuchung wurde storniert – bitte einen neuen Termin wählen.</span></div>' : ''}
            ${m.date ? `<dl class="vh-kv" style="margin-bottom:12px"><dt>Termin</dt><dd>${esc(when)}</dd>${m.court ? `<dt>Platz</dt><dd translate="no">${esc(m.court)}</dd>` : ''}</dl>` : ''}
            <div class="tu-act"><button type="button" class="vh-btn sm sec" id="tuDate">${m.date ? 'Verlegen' : 'Termin wählen'}</button><button type="button" class="vh-btn sm" id="tuRes">Ergebnis eintragen</button></div>
            ${m.contact ? `<div class="tu-act"><a class="vh-btn sm sec" href="tel:${esc(telOf(m.contact))}">Anrufen</a><a class="vh-btn sm sec" href="sms:${esc(telOf(m.contact))}">Nachricht</a></div>` : ''}
            ${m.date ? '<button type="button" class="vh-danger" id="tuCancel">Termin absagen</button>' : ''}`}
          <div class="vh-err" id="tuErr"></div>
          <div class="vh-row"><button type="button" class="no" id="tuX">Schließen</button></div></div>`;
        const $ = id => sh.querySelector('#' + id);
        $('tuX').onclick = close;
        if ($('tuDate')) $('tuDate').onclick = () => dateSheet(m);
        if ($('tuRes')) $('tuRes').onclick = () => resultSheet(m);
        if ($('tuCancel')) $('tuCancel').onclick = async () => {
          if (!confirm(`Termin am ${dm(m.date)} absagen?${m.booked ? ' Die Platzbuchung wird storniert.' : ''}`)) return;
          try { await ctx.api(`spiel/${m.id}/absagen`, 'POST', {}); close(); ctx.toast('Termin abgesagt – dein Gegner bekommt Bescheid.'); load(); } catch (e) { $('tuErr').textContent = e.message; }
        };
        sh.classList.add('show');
      }

      /** Termin wählen: Tag, dann freie Zeiten aus dem Buchungssystem (sonst Uhrzeit von Hand) */
      function dateSheet(m) {
        const sh = sheet(), st = { date: m.date && m.date >= d.today ? m.date : '', pick: null };
        const max = m.due && m.due >= d.today ? m.due : '';
        sh.innerHTML = `<div class="vh-box"><h2>${m.date ? 'Termin verlegen' : 'Termin wählen'}</h2><p translate="no">gegen ${esc(m.opponent)}${max ? ` · Frist ${esc(dm(max))}` : ''}</p>
          <label for="tuDay">Tag</label><input class="vh-input" type="date" id="tuDay" min="${d.today}" ${max ? `max="${max}"` : ''} value="${st.date}">
          ${d.booking ? `<label>Freie Plätze (${d.minutes} Minuten)</label><div class="tu-slots" id="tuSlots"><p class="vh-small" style="margin:0">Bitte zuerst einen Tag wählen.</p></div>`
            : '<label for="tuTime">Uhrzeit</label><input class="vh-input" type="time" id="tuTime" step="900" value="' + esc(m.time || '') + '">'}
          <div class="vh-err" id="tuErr"></div>
          <div class="vh-row"><button type="button" class="no" id="tuNo">Zurück</button><button type="button" class="ok" id="tuOk"${d.booking ? ' disabled' : ''}>${d.booking ? 'Platz buchen' : 'Speichern'}</button></div></div>`;
        const $ = id => sh.querySelector('#' + id), err = t => { $('tuErr').textContent = t || ''; };
        $('tuNo').onclick = () => detail(m);
        async function slots() {
          if (!d.booking || !st.date) return;
          st.pick = null; $('tuOk').disabled = true; $('tuSlots').innerHTML = '<p class="vh-small" style="margin:0">Lade …</p>';
          let r; try { r = await ctx.api(`spiel/${m.id}/zeiten?date=${st.date}`); } catch (e) { err(e.message); return; }
          const by = r.courts.map(c => ({ c, list: r.slots.filter(x => x.resource_id === c.id) })).filter(x => x.list.length);
          $('tuSlots').innerHTML = by.length ? by.map(x => `<div><h4 translate="no">${esc(x.c.name)}</h4><div class="t">${x.list.map(z => `<button type="button" data-r="${x.c.id}" data-s="${z.start}">${z.start}</button>`).join('')}</div></div>`).join('')
            : '<p class="vh-small" style="margin:0">An diesem Tag ist kein Platz für euch beide frei – bitte einen anderen Tag wählen.</p>';
          $('tuSlots').querySelectorAll('[data-s]').forEach(b => { b.onclick = () => { $('tuSlots').querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); st.pick = { resource_id: +b.dataset.r, start: b.dataset.s }; $('tuOk').disabled = false; err(''); }; });
        }
        $('tuDay').onchange = () => { st.date = $('tuDay').value; err(''); slots(); };
        $('tuOk').onclick = async () => {
          if (!st.date) return err('Bitte einen Tag wählen.');
          const body = d.booking ? { date: st.date, ...st.pick } : { date: st.date, start: $('tuTime').value };
          $('tuOk').disabled = true;
          try { await ctx.api(`spiel/${m.id}/termin`, 'POST', body); close(); ctx.toast(d.booking ? 'Platz gebucht – dein Gegner bekommt Bescheid.' : 'Termin gespeichert – dein Gegner bekommt Bescheid.'); load(); }
          catch (e) { err(e.message); $('tuOk').disabled = false; if (d.booking) slots(); }
        };
        sh.classList.add('show');
        if (st.date) slots();
      }

      /** Ergebnis eintragen: Satz für Satz, kampflos oder Aufgabe – meine Spalte zuerst */
      function resultSheet(m) {
        const sh = sheet(), st = { kind: 'normal', who: '' };
        const draw = () => {
          sh.innerHTML = `<div class="vh-box"><h2>Ergebnis eintragen</h2><p translate="no">gegen ${esc(m.opponent)} · ${esc(m.where)}</p>
            <div class="vh-seg">${[['normal', 'Gespielt'], ['wo', 'Kampflos'], ['aufgabe', 'Aufgabe']].map(([k, l]) => `<button type="button" data-k="${k}" class="${k === st.kind ? 'on' : ''}">${l}</button>`).join('')}</div>
            ${st.kind === 'wo' ? `<label>Wer gewinnt kampflos?</label><div class="tu-who">${[['me', m.partner ? 'Wir' : 'Ich'], ['opp', m.opponent]].map(([k, l]) => `<label class="vh-check"><input type="radio" name="tuW" value="${k}" ${st.who === k ? 'checked' : ''}><span translate="no">${esc(l)}</span></label>`).join('')}</div>`
            : `${st.kind === 'aufgabe' ? `<label>Wer hat aufgegeben?</label><div class="tu-who">${[['me', m.partner ? 'Wir' : 'Ich'], ['opp', m.opponent]].map(([k, l]) => `<label class="vh-check"><input type="radio" name="tuW" value="${k}" ${st.who === k ? 'checked' : ''}><span translate="no">${esc(l)}</span></label>`).join('')}</div><label>Stand bei der Aufgabe</label>` : ''}
              <div class="tu-sets"><span></span><span class="h">${m.partner ? 'Wir' : 'Ich'}</span><span></span><span class="h" translate="no">${esc(m.opponent.split(',')[0])}</span>
              ${['Satz 1', 'Satz 2', 'Match-Tiebreak'].map((l, i) => `<span class="l">${l}</span><input class="vh-input" type="number" inputmode="numeric" min="0" max="99" id="tuA${i}" aria-label="${l}: ich"><span class="c">:</span><input class="vh-input" type="number" inputmode="numeric" min="0" max="99" id="tuB${i}" aria-label="${l}: Gegner">`).join('')}</div>
              <p class="vh-small" style="margin:0 0 10px">${st.kind === 'aufgabe' ? 'Gespielte Sätze und den Stand im laufenden Satz – fehlende Spiele bekommt der Sieger.' : 'Match-Tiebreak nur bei 1:1 Sätzen (bis 10, 2 Punkte Abstand).'}</p>`}
            <div class="vh-err" id="tuErr"></div>
            <div class="vh-row"><button type="button" class="no" id="tuNo">Zurück</button><button type="button" class="ok" id="tuOk">Speichern</button></div></div>`;
          const $ = id => sh.querySelector('#' + id);
          sh.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { st.kind = b.dataset.k; st.who = ''; draw(); }; });
          sh.querySelectorAll('[name=tuW]').forEach(r => { r.onchange = () => { st.who = r.value; }; });
          $('tuNo').onclick = () => detail(m);
          $('tuOk').onclick = async () => {
            const me = m.side, opp = me === 'a' ? 'b' : 'a';
            const body = { result: st.kind };
            if (st.kind !== 'normal' && !st.who) { $('tuErr').textContent = st.kind === 'wo' ? 'Bitte wählen, wer kampflos gewinnt.' : 'Bitte wählen, wer aufgegeben hat.'; return; }
            if (st.kind === 'wo') body.winner = st.who === 'me' ? me : opp;
            else {
              body.sets = [0, 1, 2].map(i => [$('tuA' + i).value, $('tuB' + i).value]).filter(x => x[0] !== '' || x[1] !== '').map(([x, y]) => (me === 'a' ? [x, y] : [y, x]));
              if (st.kind === 'aufgabe') body.retired = st.who === 'me' ? me : opp;
            }
            $('tuOk').disabled = true;
            try { await ctx.api(`spiel/${m.id}/ergebnis`, 'POST', body); close(); ctx.toast('Ergebnis gespeichert – danke!'); load(); }
            catch (e) { $('tuErr').textContent = e.message; $('tuOk').disabled = false; }
          };
        };
        draw(); sh.classList.add('show');
      }

      el.innerHTML = '<div class="vh-empty">Lade …</div>';
      load(ctx.focus);
    },
  });
})();
