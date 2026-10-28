'use strict';
/* Tablet: Turnierplaner (freie Turniere) am Turniertag – Plätze mit laufendem und nächstem Spiel, Tabellen und Turnierbaum zum Ansehen.
   Ergebnisse eintragen und Spiele starten nur die Turnierleitung: mit dem Code aus der Verwaltung (Ziffernblock GKPin). Der Code gilt auf
   diesem Tablet 15 Minuten nach der letzten Eingabe, dann wird er wieder abgefragt. tablet.js setzt den Inhalt vor die übrigen Turniere. */
(() => {
  const $ = id => document.getElementById(id);
  const V = window.TurnierAnsicht, esc = V.esc;
  const T = (t, v) => (window.T ? window.T(t, v) : String(t).replace(/\{(\d+)\}/g, (m, i) => (v && v[i] != null ? v[i] : m)));
  const COURT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 12h18"/></svg>';
  const RES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/></svg>';
  const GO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>';
  let list = [], onChange = () => {};
  const toast = (msg, error = false) => { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (error ? ' error' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 5000); };
  const dlg = html => { $('dialog').innerHTML = html; $('overlay').classList.remove('hidden'); };
  const closeDlg = () => { $('overlay').classList.add('hidden'); $('dialog').innerHTML = ''; };
  async function call(url, body) {
    const r = await fetch('../../api/tablet/x/turniere/ft' + url, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && j.gate) throw Object.assign(new Error('Seite gesperrt'), { gate: true });
    if (!r.ok) throw Object.assign(new Error(j.error || T('Das hat nicht geklappt.')), { status: r.status });
    return j;
  }
  const done = async msg => { closeDlg(); toast(msg); await onChange(); };
  const side = (m, s) => m[s] || m[s + '_ph'] || T('offen');
  const line = m => `${side(m, 'a')} – ${side(m, 'b')}`;
  const left = m => (m.left > 0 ? T('noch {0} min', [Math.ceil(m.left / 60)]) : T('Zeit um'));

  /* ---------- Code der Turnierleitung ---------- */
  const KEY = id => `cw_ft_code_${id}`;
  const stored = id => { try { const x = JSON.parse(sessionStorage.getItem(KEY(id)) || 'null'); return x && Date.now() - x.at < 15 * 60000 ? x.code : null; } catch (e) { return null; } };
  const keep = (id, code) => { try { sessionStorage.setItem(KEY(id), JSON.stringify({ code, at: Date.now() })); } catch (e) { /* egal */ } };
  const forget = id => { try { sessionStorage.removeItem(KEY(id)); } catch (e) { /* egal */ } };
  /** then(code) mit gültigem Code – sonst erst der Ziffernblock */
  function leitung(d, then) {
    if (!d.code) { dlg(`<h2>${esc(T('Turnierleitung'))}</h2><p class="tl-p">${esc(T('Für dieses Turnier ist kein Code der Turnierleitung festgelegt. Ergebnisse trägt die Turnierleitung dann in der Verwaltung ein (Turnierplaner › Einstellungen › Code der Turnierleitung).'))}</p><div class="dlg-btns"><button id="tx">${esc(T('Schließen'))}</button></div>`); $('tx').onclick = closeDlg; return; }
    const c = stored(d.ft.id);
    if (c) { keep(d.ft.id, c); return then(c); }
    let pin = '';
    dlg(GKPin.pad(esc(T('Turnierleitung')), esc(T('Bitte den Code der Turnierleitung eingeben'))));
    const dots = () => { $('dots').innerHTML = GKPin.dots(pin.length); };
    const go = async () => {
      if (pin.length < 4) { $('perr').textContent = T('Bitte mindestens 4 Ziffern.'); return; }
      try { await call(`/${d.ft.id}/pruefen`, { code: pin }); keep(d.ft.id, pin); then(pin); }
      catch (e) { if (e.gate) return closeDlg(); $('perr').textContent = e.message; pin = ''; dots(); }
    };
    $('dialog').querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { const k = b.dataset.k; if (k === 'x') return closeDlg(); if (k === 'ok') return go(); if (pin.length < 6) { pin += k; dots(); } }; });
  }
  /** Schreiben mit Code; ein abgelehnter Code wird vergessen */
  async function write(d, url, body, code) {
    try { return await call(url, { ...body, code }); }
    catch (e) { if (e.status === 403) forget(d.ft.id); throw e; }
  }

  /* ---------- Ergebnis: Spiel wählen, Tore/Spiele eintragen ---------- */
  function pickMatch(d, code) {
    const ms = [...d.courts.map(c => c.running).filter(Boolean), ...d.upcoming.filter(m => m.a && m.b)].filter((m, i, a) => a.findIndex(x => x.id === m.id) === i).slice(0, 24);
    dlg(`<h2>${esc(T('Ergebnis eintragen'))}</h2><div class="sub">${esc(T('Welches Spiel ist fertig?'))}</div>
      <div class="vh-names">${ms.length ? ms.map(m => `<button data-m="${m.id}"><span translate="no">${esc(line(m))}</span></button>`).join('') : `<div class="vh-names-hint">${esc(T('Gerade läuft kein Spiel.'))}</div>`}</div>
      <div class="dlg-btns"><button id="tx">${esc(T('Abbrechen'))}</button></div>`);
    $('tx').onclick = closeDlg;
    $('dialog').querySelectorAll('[data-m]').forEach(b => { b.onclick = () => result(d, ms.find(m => m.id === +b.dataset.m), code); });
  }
  function result(d, m, code) {
    const c = d.cfg, sets = c.scoring === 'saetze', dec = m.ko && !sets && c.decider !== 'none';
    const short = s => String(side(m, s)).split(' / ')[0];
    const rows = sets ? ['Satz 1', 'Satz 2', 'Match-Tiebreak'].map((l, i) => `<b>${esc(T(l))}</b><input inputmode="numeric" id="ra${i}" aria-label="${esc(T(l))}: ${esc(m.a)}"><span class="c">:</span><input inputmode="numeric" id="rb${i}" aria-label="${esc(T(l))}: ${esc(m.b)}">`).join('')
      : `<b>${esc(T(d.unit))}</b><input inputmode="numeric" id="ra" aria-label="${esc(T(d.unit))}: ${esc(m.a)}"><span class="c">:</span><input inputmode="numeric" id="rb" aria-label="${esc(T(d.unit))}: ${esc(m.b)}">`
        + (dec ? `<b>${esc(T(c.decider === 'nm' ? 'Neunmeter' : 'Tiebreak'))}</b><input inputmode="numeric" id="rda" aria-label="${esc(T(c.decider === 'nm' ? 'Neunmeter' : 'Tiebreak'))}: ${esc(m.a)}"><span class="c">:</span><input inputmode="numeric" id="rdb" aria-label="${esc(T(c.decider === 'nm' ? 'Neunmeter' : 'Tiebreak'))}: ${esc(m.b)}">` : '');
    dlg(`<h2 translate="no">${esc(line(m))}</h2><div class="sub">${esc(m.label)}${m.court ? ` · ${esc(m.court)}` : ''}</div>
      <div class="tl-sets"><span></span><span class="h" translate="no">${esc(short('a'))}</span><span></span><span class="h" translate="no">${esc(short('b'))}</span>${rows}</div>
      ${dec ? `<p class="tl-p muted">${esc(T(c.decider === 'nm' ? 'Neunmeterschießen nur bei Gleichstand.' : 'Tiebreak nur bei Gleichstand.'))}</p>` : sets ? `<p class="tl-p muted">${esc(T('Kampflos oder Aufgabe trägt die Turnierleitung in der Verwaltung ein.'))}</p>` : ''}
      <div class="dlg-btns"><button class="pri" id="tok">${esc(T('Ergebnis speichern'))}</button><button id="tx">${esc(T('Abbrechen'))}</button></div>`);
    $('tx').onclick = closeDlg;
    setTimeout(() => { const f = $(sets ? 'ra0' : 'ra'); if (f) f.focus(); }, 50);
    $('tok').onclick = async () => {
      const body = sets ? { sets: [0, 1, 2].map(i => [$('ra' + i).value.trim(), $('rb' + i).value.trim()]).filter(x => x[0] !== '' || x[1] !== '') }
        : { a: $('ra').value.trim(), b: $('rb').value.trim(), ...(dec ? { decider: { a: $('rda').value.trim(), b: $('rdb').value.trim() } } : {}) };
      $('tok').disabled = true;
      try { const r = await write(d, `/spiel/${m.id}/ergebnis`, body, code); await done((r.warnings || []).length ? r.warnings.join(' ') : T('Ergebnis gespeichert.')); }
      catch (e) { $('tok').disabled = false; toast(e.message, true); }
    };
  }
  /* ---------- Platz antippen: laufendes Spiel (Ergebnis) oder nächstes (starten) ---------- */
  function court(d, c) {
    const r = c.running, n = c.next;
    dlg(`<h2>${esc(c.name)}</h2>
      ${r ? `<p class="tl-p"><b translate="no">${esc(line(r))}</b><br>${esc(r.label)} · ${esc(left(r))}</p>` : `<p class="tl-p">${esc(T('Frei.'))}</p>`}
      ${n ? `<p class="tl-p">${esc(T('Als Nächstes'))}${n.est ? ` (${esc(T('etwa {0} Uhr', [n.est]))})` : ''}:<br><b translate="no">${esc(line(n))}</b>${n.wait ? `<br><span class="muted">${esc(n.wait)}</span>` : ''}</p>` : ''}
      <div class="dlg-btns">${r ? `<button class="pri" id="tres">${esc(T('Ergebnis eintragen'))}</button>` : ''}${!r && n && !n.wait ? `<button class="pri" id="tgo">${esc(T('Spiel starten'))}</button>` : ''}<button id="tx">${esc(T('Schließen'))}</button></div>`);
    $('tx').onclick = closeDlg;
    if ($('tres')) $('tres').onclick = () => leitung(d, code => result(d, r, code));
    if ($('tgo')) $('tgo').onclick = () => leitung(d, async code => { try { await write(d, `/spiel/${n.id}/start`, {}, code); await done(T('Gestartet – viel Spaß!')); } catch (e) { toast(e.message, true); } });
  }
  function startAll(d) {
    leitung(d, async code => {
      try { const r = await write(d, `/${d.ft.id}/starten`, {}, code); await done(r.started.length ? T('Gestartet: {0}', [r.started.length]) : T('Kein bereites Spiel auf einem freien Platz.')); }
      catch (e) { toast(e.message, true); }
    });
  }

  /** Inhalt für tablet.js → { html, bind, list } oder null, wenn heute kein Turnier läuft */
  async function load(refresh) {
    onChange = refresh || onChange;
    list = (await call('/heute')).list || [];
    if (!list.length) return null;
    const one = d => {
      const tile = c => {   // Platz-Kacheln doppelt breit: Paarung und Zeit stehen ganz da
        const r = c.running, n = c.next;
        const txt = r ? `${line(r)} · ${left(r)}` : n ? `${T('als Nächstes')} ${n.est || ''} ${line(n)}` : T('frei');
        const chip = r ? `<span class="tk-chip g">${esc(T('läuft'))}</span>` : n && !n.wait ? `<span class="tk-chip">${esc(T('bereit'))}</span>` : n && n.delay >= 10 ? `<span class="tk-chip r">+${n.delay} min</span>` : '';
        return `<button class="tk-tile span2" data-ftc="${d.ft.id}:${c.id}"><span class="tk-ico">${COURT}</span><span class="tk-txt"><b>${esc(c.name)}</b><span translate="no">${esc(txt)}</span></span>${chip}</button>`;
      };
      const groups = d.groups.length ? `<div class="ft-groups">${d.groups.map(g => `<div class="vh-card"><h3>${esc(d.groups.length > 1 ? T(g.label) : T('Tabelle'))}</h3>${V.ftTable(g, { unit: d.unit, up: g.up })}</div>`).join('')}</div>` : '';
      const ko = d.ko.length ? `<h2 class="sec">${esc(T(d.ft.format === 'ko' ? 'Turnierbaum' : 'Endrunde'))}</h2><div class="vh-card">${V.ftTree(d.ko, d.third)}</div>` : '';
      const rank = d.ranking ? `<div class="vh-card"><h3>${esc(T('Rangliste'))}</h3>${V.ftRanking(d.ranking, d.unit)}</div>` : '';
      return `<h2 class="sec"><span translate="no">${esc(d.ft.name)}</span><small>${esc(T('Turnierleitung'))}</small></h2><div class="tk-grid">
          <button class="tk-tile big span2" data-ftres="${d.ft.id}"><span class="tk-ico">${RES}</span><span class="tk-txt"><b>${esc(T('Ergebnis eintragen'))}</b><span>${esc(T('Spiel antippen und das Ergebnis eingeben – mit dem Code der Turnierleitung.'))}</span></span></button>
          <button class="tk-tile big span2" data-ftgo="${d.ft.id}"><span class="tk-ico">${GO}</span><span class="tk-txt"><b>${esc(T('Nächste Spiele starten'))}</b><span>${esc(T('Auf jedem freien Platz beginnt das nächste Spiel – die Uhr läuft.'))}</span></span></button></div>
        <h2 class="sec">${esc(T(d.cfg.court === 'Spielfeld' ? 'Spielfelder' : d.cfg.court === 'Feld' ? 'Felder' : 'Plätze'))}</h2><div class="tk-grid">${d.courts.map(tile).join('')}</div>
        ${d.groups.length || d.ranking ? `<h2 class="sec">${esc(T(d.ranking ? 'Rangliste' : 'Tabellen'))}</h2>` : ''}${rank}${groups}${ko}`;
    };
    const html = list.map(one).join('');
    const byId = id => list.find(d => d.ft.id === +id);
    const bind = () => {
      document.querySelectorAll('[data-ftres]').forEach(b => { b.onclick = () => { const d = byId(b.dataset.ftres); leitung(d, code => pickMatch(d, code)); }; });
      document.querySelectorAll('[data-ftgo]').forEach(b => { b.onclick = () => startAll(byId(b.dataset.ftgo)); });
      document.querySelectorAll('[data-ftc]').forEach(b => { b.onclick = () => { const [f, c] = b.dataset.ftc.split(':'); const d = byId(f); court(d, d.courts.find(x => x.id === +c)); }; });
    };
    return { html, bind, list };
  }
  window.TurnierFrei = { load };
})();
