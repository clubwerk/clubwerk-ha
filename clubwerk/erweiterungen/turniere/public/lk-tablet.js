'use strict';
/* Tablet: Turniertag (LK-Turnier) – einchecken mit Nenngeld, Plätze mit laufendem und nächstem Match, „Match starten“ und Ergebnis eintragen.
   Ohne PIN: Spieler fremder Vereine haben kein Konto. Ein Ergebnis lässt sich am Tablet nur einmal eintragen – korrigieren kann die Turnierleitung.
   tablet.js ruft TurnierTag.load() auf und setzt den Inhalt vor die Tabellen der Clubmeisterschaft. */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const euro = c => `${((c || 0) / 100).toFixed(2).replace('.', ',')} €`;
  const COURT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 12h18"/></svg>';
  const IN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/></svg>';
  const RES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/></svg>';
  let d = null, onChange = () => {};
  const toast = (msg, error = false) => { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (error ? ' error' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 5000); };
  const dlg = html => { $('dialog').innerHTML = html; $('overlay').classList.remove('hidden'); };
  const closeDlg = () => { $('overlay').classList.add('hidden'); $('dialog').innerHTML = ''; };
  $('overlay').addEventListener('mousedown', e => { if (e.target === $('overlay')) closeDlg(); });
  async function call(url, body) {
    const r = await fetch('../../api/tablet/x/turniere/lk/' + url, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && j.gate) throw Object.assign(new Error('Seite gesperrt'), { gate: true });
    if (!r.ok) throw new Error(j.error || 'Das hat nicht geklappt.');
    return j;
  }
  const done = async msg => { closeDlg(); toast(msg); await onChange(); };
  const delay = m => (m.delay >= 5 ? ` · +${m.delay} min` : '');

  /* ---------- Einchecken: Namen suchen (ab 2 Buchstaben), dann einchecken und Nenngeld ---------- */
  function pickName() {
    dlg(`<h2>Einchecken</h2><div class="sub">Namen eingeben – dann einchecken und Nenngeld</div><input class="q" id="tq" placeholder="Vor- oder Nachname" autocomplete="off"><div class="vh-names" id="tnm"></div><div class="dlg-btns"><button id="tx">Abbrechen</button></div>`);
    const draw = () => {
      const q = $('tq').value.trim().toLowerCase();
      const hits = q.length < 2 ? [] : d.people.filter(p => p.name.toLowerCase().includes(q)).slice(0, 30);
      $('tnm').innerHTML = q.length < 2 ? '<div class="vh-names-hint">Bitte die ersten Buchstaben des Vor- oder Nachnamens eingeben.</div>'
        : hits.length ? hits.map(p => `<button data-p="${p.id}" translate="no"><span>${esc(p.name)}${p.checked_in ? ' ✓' : ''}</span></button>`).join('') : '<div class="vh-names-hint">Niemand gefunden – bitte bei der Turnierleitung melden.</div>';
      $('tnm').querySelectorAll('[data-p]').forEach(b => { b.onclick = () => person(d.people.find(p => p.id === +b.dataset.p)); });
    };
    draw(); $('tq').oninput = draw; $('tx').onclick = closeDlg; setTimeout(() => $('tq').focus(), 50);
  }
  function person(p) {
    const btns = [];
    if (!p.checked_in) btns.push(['ci', p.fee && !p.paid ? 'Nur einchecken' : 'Einchecken', { checkin: true }]);
    if (p.fee && !p.paid) { btns.push(['bar', `Einchecken · ${euro(p.fee)} bar bezahlt`, { checkin: true, paid: 'bar' }]); btns.push(['dig', `Einchecken · ${euro(p.fee)} digital bezahlt`, { checkin: true, paid: 'digital' }]); }
    if (p.checked_in && p.absent) btns.push(['back', 'Wieder da', { absent: false }]);
    dlg(`<h2 translate="no">${esc(p.name)}</h2><div class="sub" translate="no">${esc(p.club || '')}${p.lk ? ` · LK ${esc(p.lk)}` : ''}</div>
      <p class="tl-p">${esc(p.events.join(', '))}${p.first_match ? ` · erstes Match etwa <span class="num">${esc(p.first_match.slice(11, 16))}</span> Uhr` : ''}</p>
      ${p.checked_in ? `<p class="tl-p"><b>Schon eingecheckt.</b>${p.paid ? ` Nenngeld bezahlt (${esc(p.paid)}).` : p.fee ? ` Nenngeld ${euro(p.fee)} noch offen.` : ''}</p>` : ''}
      <div class="dlg-btns">${btns.map(([k, l], i) => `<button data-a="${k}" class="${i === btns.length - 1 ? 'pri' : ''}">${esc(l)}</button>`).join('')}<button id="tx">${btns.length ? 'Abbrechen' : 'Schließen'}</button></div>`);
    $('tx').onclick = closeDlg;
    $('dialog').querySelectorAll('[data-a]').forEach(b => { b.onclick = async () => {
      const body = btns.find(x => x[0] === b.dataset.a)[2];
      b.disabled = true;
      try { await call('person/' + p.id, body); await done(body.paid ? `Eingecheckt, ${euro(p.fee)} ${body.paid} – danke!` : body.absent === false ? 'Willkommen zurück.' : 'Eingecheckt – viel Erfolg!'); }
      catch (e) { b.disabled = false; toast(e.message, true); }
    }; });
  }

  /* ---------- Ergebnis: Match wählen, Sätze eintragen ---------- */
  const line = m => `${m.a || 'offen'} – ${m.b || 'offen'}`;
  function pickMatch() {
    const list = [...d.open, ...d.upcoming.filter(m => !d.open.some(x => x.id === m.id))].slice(0, 30);
    dlg(`<h2>Ergebnis eintragen</h2><div class="sub">Welches Match habt ihr gespielt?</div>
      <div class="vh-names">${list.length ? list.map(m => `<button data-m="${m.id}" translate="no"><span>${esc(line(m))}</span></button>`).join('') : '<div class="vh-names-hint">Gerade läuft kein Match.</div>'}</div>
      <div class="dlg-btns"><button id="tx">Abbrechen</button></div>`);
    $('tx').onclick = closeDlg;
    $('dialog').querySelectorAll('[data-m]').forEach(b => { b.onclick = () => result(list.find(m => m.id === +b.dataset.m)); });
  }
  function result(m) {
    const third = m.full ? 'Satz 3' : 'Match-Tiebreak';
    dlg(`<h2 translate="no">${esc(line(m))}</h2><div class="sub">${esc(m.event)} · ${esc(m.roundLabel)}${m.court ? ` · ${esc(m.court)}` : ''}</div>
      <div class="tl-sets"><span></span><span class="h" translate="no">${esc(String(m.a).split(/[,/]/)[0])}</span><span></span><span class="h" translate="no">${esc(String(m.b).split(/[,/]/)[0])}</span>
        ${['Satz 1', 'Satz 2', third].map((l, i) => `<b>${esc(l)}</b><input inputmode="numeric" id="ra${i}" aria-label="${esc(l)}: ${esc(m.a)}"><span class="c">:</span><input inputmode="numeric" id="rb${i}" aria-label="${esc(l)}: ${esc(m.b)}">`).join('')}</div>
      <p class="tl-p">Kampflos oder Aufgabe? Bitte bei der Turnierleitung melden.</p>
      <div class="dlg-btns"><button class="pri" id="tok">Ergebnis speichern</button><button id="tx">Abbrechen</button></div>`);
    $('tx').onclick = closeDlg;
    setTimeout(() => $('ra0').focus(), 50);
    $('tok').onclick = async () => {
      const sets = [0, 1, 2].map(i => [$('ra' + i).value.trim(), $('rb' + i).value.trim()]).filter(x => x[0] !== '' || x[1] !== '');
      $('tok').disabled = true;
      try { await call(`match/${m.id}/ergebnis`, { sets }); await done('Ergebnis gespeichert – danke!'); }
      catch (e) { $('tok').disabled = false; toast(e.message, true); }
    };
  }
  /* ---------- Platz antippen: laufendes Match (Ergebnis) oder nächstes (starten) ---------- */
  function court(c) {
    const r = c.running, n = c.next;
    const canStart = !r && n && !n.wait;
    dlg(`<h2>${esc(c.name)}</h2>
      ${r ? `<p class="tl-p"><b translate="no">${esc(line(r))}</b><br>läuft seit <span class="num">${r.minutes}</span> Minuten</p>` : '<p class="tl-p">Der Platz ist frei.</p>'}
      ${n ? `<p class="tl-p">Als Nächstes${n.est ? ` (etwa <span class="num">${esc(n.est)}</span> Uhr${esc(delay(n))})` : ''}:<br><b translate="no">${esc(line(n))}</b>${n.wait ? `<br><span class="muted">${esc(n.wait)}</span>` : ''}</p>` : ''}
      <div class="dlg-btns">${r ? '<button class="pri" id="tres">Ergebnis eintragen</button>' : ''}${canStart ? '<button class="pri" id="tgo">Match starten</button>' : ''}<button id="tx">Schließen</button></div>`);
    $('tx').onclick = closeDlg;
    if ($('tres')) $('tres').onclick = () => result({ ...r, court: c.name });
    if ($('tgo')) $('tgo').onclick = async () => { $('tgo').disabled = true; try { await call(`match/${n.id}/start`, {}); await done('Match gestartet – viel Spaß!'); } catch (e) { $('tgo').disabled = false; toast(e.message, true); } };
  }

  /** Inhalt für tablet.js → { html, bind } oder null, wenn heute kein Turnier läuft */
  async function load(refresh) {
    onChange = refresh || onChange;
    d = await call('heute');
    if (!d.day) return null;
    const tile = c => {   // Platz-Kacheln doppelt breit: Paarung und Uhrzeit stehen ganz da, nie mit „…“
      const r = c.running, n = c.next;
      const txt = r ? `${line(r)} · ${r.minutes} min` : n ? `als Nächstes ${n.est || ''} ${line(n)}` : 'frei';
      const chip = r ? '<span class="tk-chip g">läuft</span>' : n && !n.wait ? '<span class="tk-chip">bereit</span>' : n && n.delay >= 15 ? `<span class="tk-chip r">+${n.delay} min</span>` : '';
      return `<button class="tk-tile span2" data-c="${c.id}"><span class="tk-ico">${COURT}</span><span class="tk-txt"><b>${esc(c.name)}</b><span translate="no">${esc(txt)}</span></span>${chip}</button>`;
    };
    const html = `<h2 class="sec">Was möchtest du tun?</h2><div class="tk-grid">
        <button class="tk-tile big span2" id="tlIn"><span class="tk-ico">${IN}</span><span class="tk-txt"><b>Einchecken</b><span>Namen suchen, einchecken und das Nenngeld bezahlen.</span></span></button>
        <button class="tk-tile big span2" id="tlRes"><span class="tk-ico">${RES}</span><span class="tk-txt"><b>Ergebnis eintragen</b><span>Nach dem Match: Match antippen und die Sätze eingeben.</span></span></button></div>
      <h2 class="sec">Plätze</h2><div class="tk-grid">${d.courts.map(tile).join('')}</div>
      ${d.queue.length ? `<h2 class="sec">Warteschlange</h2><div class="tk-grid">${d.queue.slice(0, 8).map(m => `<div class="tk-tile span2"><span class="tk-txt"><b translate="no">${esc(line(m))}</b><span>${esc(m.event)} · ${esc(m.wait || 'bereit – wartet auf einen Platz')}</span></span></div>`).join('')}</div>` : ''}`;
    const bind = () => {
      $('tlIn').onclick = pickName; $('tlRes').onclick = pickMatch;
      document.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => court(d.courts.find(c => c.id === +b.dataset.c)); });
    };
    return { html, bind, day: d.day };
  }
  window.TurnierTag = { load };
})();
