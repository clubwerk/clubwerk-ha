'use strict';
/* Turniere – gemeinsame Bausteine für Verwaltung, Mitglieder-App und Tablet (gleiche Sache = gleiches Aussehen):
   Gruppentabelle, Ergebnis wie auf der Anzeigetafel (Sätze je Spieler), K.-o.-Baum (Halbfinale → Finale) und Relegation.
   Daten kommen aus der Ansicht des Servers (view): Namen, Sätze, Sieger – keine Konten oder Kontaktdaten. */
(() => {
  if (window.TurnierAnsicht) return;
  if (!document.getElementById('tuStyle')) {
    const s = document.createElement('style'); s.id = 'tuStyle';
    s.textContent = `
      .tu-tab { width: 100%; border-collapse: collapse; font-size: 14px; table-layout: fixed; }
      .tu-tab th { font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; text-align: right; padding: 0 4px 6px; white-space: nowrap; }
      .tu-tab th.n, .tu-tab td.n { text-align: left; }
      .tu-tab td { padding: 8px 4px; border-top: 1px solid var(--line); text-align: right; color: var(--ink); }
      .tu-tab td.n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
      .tu-tab td.r, .tu-tab td.z { font-family: var(--num); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 16px; }
      .tu-tab td.r { text-align: center; color: var(--muted); }
      .tu-tab col.r { width: 30px; } .tu-tab col.z { width: 34px; } .tu-tab col.w { width: 52px; }
      .tu-tab tr.me td { background: var(--brand-soft); } .tu-tab tr.me td.n { color: var(--brand-ink); }
      .tu-tab tr.up td.r { color: var(--brand-ink); }
      .tu-score { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; align-items: center; }
      .tu-score .p { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14.5px; color: var(--ink); }
      .tu-score .p.w { font-weight: 800; }
      .tu-score .s { display: flex; gap: 6px; justify-content: flex-end; font-family: var(--num); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 17px; color: var(--muted); }
      .tu-score .s b { min-width: 14px; text-align: center; font-weight: 600; }
      .tu-score .s b.w { color: var(--ink); }
      .tu-score .s i { font-style: normal; font-family: inherit; font-size: 12.5px; color: var(--muted); }
      .tu-tree { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 28px; align-items: center; }
      .tu-tree > .col { display: grid; gap: 12px; }
      .tu-box { background: var(--card); border: 1px solid var(--edge); border-radius: 16px; box-shadow: var(--shadow); padding: 10px 14px; position: relative; min-width: 0; }
      .tu-box h4 { margin: 0 0 6px; font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; display: flex; justify-content: space-between; gap: 8px; }
      .tu-box h4 span { text-transform: none; letter-spacing: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      :is(.card, .vh-card) .tu-box { box-shadow: none; background: transparent; border-color: var(--line); }
      .tu-tree .col:first-child .tu-box::after { content: ''; position: absolute; right: -15px; top: 50%; width: 14px; border-top: 2px solid var(--line2); }
      .tu-champ { display: flex; align-items: center; gap: 10px; font-weight: 800; color: var(--brand-ink); margin: 12px 0 0; font-size: 15px; }
      .tu-champ svg { width: 22px; height: 22px; flex: none; }
      .tu-res { display: grid; gap: 10px; }
      .tu-res .tu-score { padding-top: 10px; border-top: 1px solid var(--line); }
      .tu-res .tu-score:first-child { border-top: 0; padding-top: 0; }
      .tu-score .when { grid-column: 1 / -1; font-size: 12.5px; color: var(--muted); }
      .tu-rel { display: grid; gap: 10px; }
      .tu-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 12px; align-items: start; }
      .tu-groups > .vh-card, .tu-groups > .card { margin: 0; min-width: 0; }
      .tu-rel + .tu-rel { margin-top: 10px; }
      @media (max-width: 560px) { .tu-tree { grid-template-columns: minmax(0, 1fr); } .tu-tree .col:first-child .tu-box::after { content: none; } }
      @media print { .tu-box { box-shadow: none; border: 1px solid #999; break-inside: avoid; } .tu-groups > * { break-inside: avoid; } .tu-tab tr.me td { background: none; } }`;
    document.head.appendChild(s);
  }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const T = (t, v) => (window.T ? window.T(t, v) : String(t).replace(/\{(\d+)\}/g, (m, i) => (v && v[i] != null ? v[i] : m)));
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const dm = d => (d ? `${WD[new Date(d + 'T12:00:00').getDay()]}, ${d.slice(8, 10)}.${d.slice(5, 7)}.` : '');
  const CUP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>';

  /** Gruppentabelle (Platz, Name, Spiele, Siege, Sätze, Spiele) – up: so viele Plätze sind hervorgehoben (Endrunde) */
  function table(g, { up = 0 } = {}) {
    return `<table class="tu-tab"><colgroup><col class="r"><col><col class="z"><col class="z"><col class="w"><col class="w"></colgroup>
      <thead><tr><th class="r" title="${esc(T('Platz'))}">#</th><th class="n">${esc(T('Name'))}</th><th title="${esc(T('Spiele'))}">${esc(T('Sp.'))}</th><th title="${esc(T('Siege'))}">${esc(T('S'))}</th><th>${esc(T('Sätze'))}</th><th>${esc(T('Spiele'))}</th></tr></thead>
      <tbody>${g.table.map(r => `<tr class="${r.mine ? 'me' : ''}${r.rank <= up && g.done ? ' up' : ''}"><td class="r">${r.rank}</td><td class="n" translate="no" title="${esc(r.name)}">${esc(r.name)}</td><td class="z">${r.played}</td><td class="z">${r.won}</td><td class="z">${esc(r.sets)}</td><td class="z">${esc(r.games)}</td></tr>`).join('')}</tbody></table>`;
  }
  /** Ergebnis als Anzeigetafel: zwei Zeilen (Name · Sätze), Sieger fett */
  function score(m) {
    const sa = m.result === 'wo' ? `<i>${m.winner === 'a' ? esc(T('w. o.')) : ''}</i>` : (m.sets || []).map(s => `<b class="${s[0] > s[1] ? 'w' : ''}">${s[0]}</b>`).join('') + (m.result === 'aufgabe' && m.retired === 'a' ? `<i>${esc(T('Aufg.'))}</i>` : '');
    const sb = m.result === 'wo' ? `<i>${m.winner === 'b' ? esc(T('w. o.')) : ''}</i>` : (m.sets || []).map(s => `<b class="${s[1] > s[0] ? 'w' : ''}">${s[1]}</b>`).join('') + (m.result === 'aufgabe' && m.retired === 'b' ? `<i>${esc(T('Aufg.'))}</i>` : '');
    const off = m.result === 'ausgefallen' ? `<i>${esc(T('ausgefallen'))}</i>` : '';
    return `<div class="tu-score"><span class="p${m.winner === 'a' ? ' w' : ''}" translate="no">${esc(m.a)}</span><span class="s">${off || sa}</span>
      <span class="p${m.winner === 'b' ? ' w' : ''}" translate="no">${esc(m.b)}</span><span class="s">${off ? '' : sb}</span>${!m.winner && m.result !== 'ausgefallen' ? `<span class="when">${esc(m.date ? `${dm(m.date)}${m.time ? ' · ' + m.time : ''}${m.court ? ' · ' + m.court : ''}` : m.due ? T('offen · Frist {0}', [dm(m.due)]) : T('offen'))}</span>` : ''}</div>`;
  }
  /** Spiele einer Gruppe: gespielte zuerst nicht nötig – Reihenfolge der Auslosung */
  const results = list => `<div class="tu-res">${list.map(score).join('')}</div>`;
  const box = (title, m, sub = '') => `<div class="tu-box"><h4>${esc(title)}${sub ? `<span>${esc(sub)}</span>` : ''}</h4>${score(m)}</div>`;
  /** K.-o.-Baum der Endrunde: Halbfinale links, Finale rechts (Handy: untereinander) */
  function tree(finals, champion) {
    const hf = finals.filter(m => m.phase === 'halbfinale').sort((a, b) => a.slot - b.slot), fin = finals.find(m => m.phase === 'finale');
    const pending = t => `<div class="tu-box"><h4>${esc(t)}</h4><p style="margin:0;color:var(--muted);font-size:13.5px">${esc(T('steht fest, sobald die Halbfinals gespielt sind'))}</p></div>`;
    const right = fin ? box(T('Finale'), fin) : pending(T('Finale'));
    const body = hf.length ? `<div class="tu-tree"><div class="col">${hf.map((m, i) => box(T('Halbfinale {0}', [i + 1]), m)).join('')}</div><div class="col">${right}</div></div>` : fin ? box(T('Finale'), fin) : '';
    return body + (champion ? `<p class="tu-champ">${CUP}<span>${esc(T('Clubmeister'))}: <span translate="no">${esc(champion)}</span></span></p>` : '');
  }
  /** Relegation: je Ligenpaar die Spiele (oben = Spieler der oberen Liga) */
  function relegation(list) {
    const keys = [...new Set(list.map(m => m.league))];
    return keys.map(k => `<div class="tu-rel">${list.filter(m => m.league === k).sort((a, b) => a.slot - b.slot).map(m => box(T('Relegation {0}', [k]), m)).join('')}</div>`).join('');
  }
  window.TurnierAnsicht = { table, score, results, tree, relegation, dm, esc };
})();
