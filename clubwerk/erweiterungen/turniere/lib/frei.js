'use strict';
/* =====================================================================================================
   Turniere – freie Turniere (ohne Datenbank): Gruppen + Endrunde, Jeder gegen jeden, K.-o. mit Setzliste, Schleifchen.
   Sportart-Vorlagen (Tennis, Fußball), Einteilung in Gruppen, Tabelle mit einstellbarer Reihenfolge bei Gleichstand,
   beste Dritte, K.-o.-Baum mit Freilosen, Spielplan mit Uhrzeit und Platz, Schleifchen-Auslosung, Ergebnis-Prüfung.
   Ergebnis „auf Zeit“: { a, b } (Spiele bzw. Tore), im K.-o. bei Gleichstand eine Entscheidung { kind: 'tb'|'nm', a, b }.
   Ergebnis „auf Sätze“: wie die Clubmeisterschaft (lib/wertung.js).
   ===================================================================================================== */
const W = require('./wertung');

const fail = msg => { throw Object.assign(new Error(msg), { status: 400 }); };

/** Sportart-Vorlagen – alles einzeln änderbar */
const SPORTS = {
  tennis: { label: 'Tennis', win: 2, draw: 1, loss: 0, scoring: 'zeit', minutes: 20, pause: 5, decider: 'tb', court: 'Platz', unit: 'spiele' },
  fussball: { label: 'Fußball', win: 3, draw: 1, loss: 0, scoring: 'zeit', minutes: 12, pause: 3, decider: 'nm', court: 'Spielfeld', unit: 'tore' },
};
const FORMATS = { gruppen: 'Gruppen + Endrunde', liga: 'Jeder gegen jeden', ko: 'K.-o. mit Setzliste', schleifchen: 'Schleifchenturnier' };
const CRITERIA = ['punkte', 'diff', 'mehr', 'direkt', 'los'];
const ORDER = ['punkte', 'diff', 'mehr', 'direkt', 'los'];

/** Einstellungen eines Turniers aus der Vorlage und den Änderungen → geprüft */
function config(sport, input = {}) {
  const t = SPORTS[sport] || SPORTS.tennis, i = input || {};
  const num = (v, d, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };
  const order = Array.isArray(i.order) && i.order.length === CRITERIA.length && CRITERIA.every(c => i.order.includes(c)) ? i.order.filter(c => c !== 'los').concat('los') : ORDER;
  return {
    win: num(i.win, t.win, 0, 9), draw: num(i.draw, t.draw, 0, 9), loss: num(i.loss, t.loss, 0, 9),
    scoring: ['zeit', 'saetze'].includes(i.scoring) ? i.scoring : t.scoring,
    minutes: num(i.minutes, t.minutes, 5, 180), pause: num(i.pause, t.pause, 0, 60),
    decider: ['tb', 'nm', 'none'].includes(i.decider) ? i.decider : t.decider,
    court: ['Platz', 'Spielfeld', 'Feld'].includes(i.court) ? i.court : t.court, unit: t.unit,
    group_size: num(i.group_size, 4, 3, 8), qualify: num(i.qualify, 2, 1, 2), third: i.third === undefined ? true : Boolean(i.third),
    break_groups: num(i.break_groups, 15, 0, 120), break_ko: num(i.break_ko, 5, 0, 60), rounds: num(i.rounds, 4, 1, 12),
    order, end_warn: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(i.end_warn || '')) ? i.end_warn : '', fee: num(i.fee, 0, 0, 100000),
  };
}

/* ---------- Gruppen ---------- */
const pow2 = n => n >= 1 && (n & (n - 1)) === 0;
const nextPow2 = n => { let p = 1; while (p < n) p *= 2; return p; };
/**
 * Gruppenzahl aus Teilnehmern und gewünschter Größe: Gruppen mit size oder size − 1 Mannschaften, nie leer oder mit „Platz frei“.
 * Bevorzugt eine Zahl, bei der die Endrunde ohne Auffüllen aufgeht (28 Mannschaften, Vierergruppen → 8 Gruppen: 4 × 4 und 4 × 3).
 */
function groupCount(n, size, qualify = 2) {
  if (n < 6) return 1;
  const lo = Math.ceil(n / size), hi = Math.max(lo, Math.floor(n / Math.max(3, size - 1)));
  let best = lo;
  for (let g = lo; g <= hi; g++) if (pow2(g * qualify) && !pow2(best * qualify)) best = g;
  return best;
}
/** Größen der Gruppen (größere zuerst): 28 / 8 → [4,4,4,4,3,3,3,3] */
const groupSizes = (n, g) => Array.from({ length: g }, (_, i) => Math.floor(n / g) + (i < n % g ? 1 : 0));
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const groupLabel = i => LETTERS[i] || String(i + 1);
/**
 * Mannschaften auf Gruppen verteilen: Gesetzte (seed) je eine pro Gruppe in Reihenfolge der Setzliste, die übrigen zufällig.
 * teams: [{ id, seed }] → [[id, …], …]
 */
function drawGroups(teams, size, qualify = 2, { seeded = false, shuffle = W.shuffle } = {}) {
  const g = groupCount(teams.length, size, qualify), sizes = groupSizes(teams.length, g);
  const out = sizes.map(() => []);
  const seeds = seeded ? teams.filter(t => t.seed).sort((x, y) => x.seed - y.seed).slice(0, g) : [];
  seeds.forEach((t, i) => out[i].push(t.id));
  const rest = shuffle(teams.filter(t => !seeds.includes(t)).map(t => t.id));
  for (const id of rest) { const i = out.findIndex((x, k) => x.length < sizes[k]); out[i].push(id); }
  return out;
}

/** Jeder gegen jeden in Runden (Kreisverfahren): [[ [a, b], … ], …] – jede Mannschaft höchstens einmal je Runde */
function rounds(ids) {
  const list = [...ids]; if (list.length % 2) list.push(null);
  const n = list.length, out = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) { const a = list[i], b = list[n - 1 - i]; if (a != null && b != null) round.push(r % 2 && i === 0 ? [b, a] : [a, b]); }
    out.push(round);
    list.splice(1, 0, list.pop());
  }
  return out;
}

/* ---------- Ergebnis ---------- */
const isInt = (v, max = 99) => Number.isInteger(v) && v >= 0 && v <= max;
const toInt = v => (v === '' || v == null ? NaN : Number(v));
const tbOk = (x, y) => { const hi = Math.max(x, y), lo = Math.min(x, y); return hi >= 7 && hi - lo >= 2 && (hi === 7 || hi - lo === 2); };
/**
 * Ergebnis prüfen → { result, a, b, sets, decider, winner ('a'|'b'|'x') }
 * ko: K.-o.-Spiel (kein Unentschieden; bei Gleichstand nach Zeit Tiebreak bzw. Neunmeter). input: { a, b, decider: { a, b } } bzw. { result, sets, winner, retired } (Sätze)
 */
function checkScore(input, cfg, { ko = false } = {}) {
  const i = input || {};
  if (cfg.scoring === 'saetze') {
    const r = W.checkResult(i);
    if (r.result === 'ausgefallen') fail('Bitte „gespielt“, „kampflos“ oder „Aufgabe“ wählen.');
    const t = W.tally(r);
    return { result: r.result, a: t.a.sets, b: t.b.sets, sets: r.sets, retired: r.retired || null, decider: null, winner: r.winner };
  }
  const a = toInt(i.a), b = toInt(i.b);
  if (!isInt(a) || !isInt(b)) fail(cfg.unit === 'tore' ? 'Bitte die Tore beider Mannschaften eintragen.' : 'Bitte die Spiele beider Seiten eintragen.');
  const d = i.decider && (i.decider.a !== '' && i.decider.a != null || i.decider.b !== '' && i.decider.b != null) ? i.decider : null;
  if (a !== b) {
    if (d) fail(cfg.decider === 'nm' ? 'Neunmeterschießen nur bei Gleichstand.' : 'Tiebreak nur bei Gleichstand.');
    return { result: 'normal', a, b, sets: [], retired: null, decider: null, winner: a > b ? 'a' : 'b' };
  }
  if (!ko) {
    if (d) fail(cfg.decider === 'nm' ? 'Neunmeterschießen gibt es nur im K.-o.' : 'Den Tiebreak gibt es nur im K.-o.');
    return { result: 'normal', a, b, sets: [], retired: null, decider: null, winner: 'x' };
  }
  if (cfg.decider === 'none') fail('Im K.-o. braucht es einen Sieger – Unentschieden geht nicht.');
  if (!d) fail(cfg.decider === 'nm' ? 'Unentschieden – bitte das Neunmeterschießen eintragen.' : 'Unentschieden – bitte den Tiebreak eintragen.');
  const x = toInt(d.a), y = toInt(d.b);
  if (!isInt(x, 40) || !isInt(y, 40) || x === y) fail(cfg.decider === 'nm' ? 'Neunmeterschießen: bitte zwei verschiedene Zahlen (z. B. 4:3).' : 'Tiebreak: bitte zwei verschiedene Zahlen (z. B. 7:5).');
  if (cfg.decider === 'tb' && !tbOk(x, y)) fail(`Tiebreak: ${x}:${y} ist kein gültiges Ergebnis (bis 7, mit 2 Punkten Abstand, z. B. 7:5 oder 9:7).`);
  return { result: 'normal', a, b, sets: [], retired: null, decider: { kind: cfg.decider, a: x, b: y }, winner: x > y ? 'a' : 'b' };
}
/** Ergebnis als Text aus Sicht von a: „3:1“, „2:2, n. N. 4:3“, „3:3, TB 7:5“, „6:4 3:6 10:7“, „w. o.“, „Freilos“ */
function scoreText(m) {
  if (!m || !m.winner) return '';
  if (m.result === 'freilos') return 'Freilos';
  if (m.result === 'wo' || m.result === 'aufgabe' || (m.sets && m.sets.length)) return W.scoreText(m);
  const d = m.decider;
  return `${m.score_a}:${m.score_b}${d ? `, ${d.kind === 'nm' ? 'n. N.' : 'TB'} ${d.a}:${d.b}` : ''}`;
}

/* ---------- Tabelle ---------- */
/**
 * Tabelle einer Gruppe. teams: [{ id, name, lot }], matches: [{ a, b, winner, score_a, score_b, sets, result }] (nur gewertete zählen)
 * Reihenfolge bei Gleichstand nach cfg.order: punkte → diff → mehr → direkt → los (Los nur, wenn gezogen; sonst tie: true).
 * Auf Sätze: diff = Satzdifferenz (dann Spieldifferenz), mehr = gewonnene Spiele.
 * → [{ id, name, rank, played, won, drawn, lost, for, against, diff, pts, sets, tie }]
 */
function table(teams, matches, cfg) {
  const sets = cfg.scoring === 'saetze';
  const blank = t => ({ id: t.id, name: t.name, lot: t.lot == null ? null : t.lot, played: 0, won: 0, drawn: 0, lost: 0, for: 0, against: 0, setsW: 0, setsL: 0, pts: 0 });
  const ids = new Set(teams.map(t => t.id));
  const done = matches.filter(m => m.winner && m.result !== 'freilos' && ids.has(m.a) && ids.has(m.b));
  const sum = (list, only) => {
    const rows = new Map(list.map(t => [t.id, blank(t)]));
    for (const m of done) {
      if (only && !(only.has(m.a) && only.has(m.b))) continue;
      const A = rows.get(m.a), B = rows.get(m.b); if (!A || !B) continue;
      let fa = m.score_a, fb = m.score_b;
      if (sets) { const t = W.tally({ result: m.result, sets: m.sets, winner: m.winner }); fa = t.a.games; fb = t.b.games; A.setsW += t.a.sets; A.setsL += t.b.sets; B.setsW += t.b.sets; B.setsL += t.a.sets; }
      A.played++; B.played++; A.for += fa || 0; A.against += fb || 0; B.for += fb || 0; B.against += fa || 0;
      if (m.winner === 'x') { A.drawn++; B.drawn++; A.pts += cfg.draw; B.pts += cfg.draw; }
      else { const [w, l] = m.winner === 'a' ? [A, B] : [B, A]; w.won++; l.lost++; w.pts += cfg.win; l.pts += cfg.loss; }
    }
    for (const r of rows.values()) { r.diff = sets ? r.setsW - r.setsL : r.for - r.against; r.diff2 = sets ? r.for - r.against : 0; }
    return rows;
  };
  const all = sum(teams);
  const key = { punkte: r => [r.pts], diff: r => [r.diff, r.diff2], mehr: r => [r.for] };
  const cmpBy = (k, rows) => (p, q) => { const a = key[k](rows.get(p.id)), b = key[k](rows.get(q.id)); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i]; return 0; };
  const byName = (p, q) => String(p.name).localeCompare(String(q.name), 'de');
  const split = (list, cmp) => { const s = [...list].sort((p, q) => cmp(p, q) || byName(p, q)), out = []; let i = 0; while (i < s.length) { let j = i + 1; while (j < s.length && cmp(s[i], s[j]) === 0) j++; out.push(s.slice(i, j)); i = j; } return out; };
  /** Gleichstand auflösen ab Kriterium k */
  function resolve(list, k) {
    if (list.length < 2 || k >= cfg.order.length) return list.map(r => ({ ...r, tie: list.length > 1 }));
    const c = cfg.order[k];
    if (c === 'los') {
      if (list.every(r => r.lot != null) && new Set(list.map(r => r.lot)).size === list.length) return [...list].sort((p, q) => p.lot - q.lot).map(r => ({ ...r, tie: false }));
      return [...list].sort(byName).map(r => ({ ...r, tie: true }));
    }
    if (c === 'direkt') {
      const mini = sum(list, new Set(list.map(r => r.id)));
      const cmp = (p, q) => cmpBy('punkte', mini)(p, q) || cmpBy('diff', mini)(p, q) || cmpBy('mehr', mini)(p, q);
      const parts = split(list, cmp);
      if (parts.length === 1) return resolve(list, k + 1);
      return parts.flatMap(p => (p.length === list.length ? resolve(p, k + 1) : p.length > 1 ? resolve(p, k) : resolve(p, k + 1)));
    }
    return split(list, cmpBy(c, all)).flatMap(p => resolve(p, k + 1));
  }
  const out = resolve([...all.values()], 0);
  return out.map((r, i) => ({ id: r.id, name: r.name, rank: i + 1, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost, for: r.for, against: r.against,
    diff: r.diff, pts: r.pts, sets: sets ? `${r.setsW}:${r.setsL}` : null, games: `${r.for}:${r.against}`, tie: Boolean(r.tie && r.played) }));
}
/**
 * Beste einer Platzierung über alle Gruppen (z. B. beste Dritte): Vergleich je Spiel, da Gruppen ungleich groß sein können –
 * Punkte je Spiel, Differenz je Spiel, mehr Spiele/Tore je Spiel, dann Los. rows: Tabellenzeilen mit lot → sortiert, mit tie
 */
function bestOf(rows) {
  const per = (r, v) => (r.played ? v / r.played : 0);
  const k = r => [per(r, r.pts), per(r, r.diff), per(r, r.for)];
  const cmp = (p, q) => { const a = k(p), b = k(q); for (let i = 0; i < 3; i++) if (Math.abs(a[i] - b[i]) > 1e-9) return b[i] - a[i]; return 0; };
  const lot = (p, q) => (p.lot != null && q.lot != null ? p.lot - q.lot : 0);
  const s = [...rows].sort((p, q) => cmp(p, q) || lot(p, q) || String(p.name).localeCompare(String(q.name), 'de'));
  return s.map((r, i) => ({ ...r, tie: s.some((x, j) => j !== i && cmp(r, x) === 0 && !lot(r, x)) }));
}

/* ---------- K.-o. ---------- */
/** Plätze der Setzliste im Baum: 8 → [1,8,4,5,2,7,3,6] (Gesetzte treffen spät aufeinander) */
function bracketOrder(n) {
  let o = [1, 2];
  while (o.length < n) { const m = o.length * 2 + 1; o = o.flatMap(x => [x, m - x]); }
  return o;
}
const KO_NAMES = { 2: 'Finale', 4: 'Halbfinale', 8: 'Viertelfinale', 16: 'Achtelfinale', 32: 'Sechzehntelfinale' };
/** Bezeichnung einer K.-o.-Runde: r = 1 … R (Feldgröße size = 2^R) */
const koLabel = (r, R) => KO_NAMES[2 ** (R - r + 1)] || `Runde ${r}`;
/**
 * Erste K.-o.-Runde aus einer Setzliste: seeds = [Mannschaft oder Quelle …] (Index 0 = Nummer 1). Freilose für die Besten, wenn die Zahl nicht aufgeht.
 * → { size, R, first: [[x, y], …] } mit null = Freilos
 */
function seedBracket(seeds) {
  const size = Math.max(2, nextPow2(seeds.length)), R = Math.log2(size);
  const o = bracketOrder(size), first = [];
  for (let i = 0; i < size; i += 2) first.push([seeds[o[i] - 1] ?? null, seeds[o[i + 1] - 1] ?? null]);
  return { size, R, first };
}
/**
 * Endrunde aus Gruppen: Wer kommt weiter, wer spielt gegen wen?
 * G Gruppen (Größen sizes), q je Gruppe → Feld: nächste Zweierpotenz, aufgefüllt mit den Besten der nächsten Platzierung (beste Dritte);
 * reichen die nicht, wird das Feld kleiner (die Besten der Zweiten füllen auf). → { size, fill, take, cross }
 *  - cross: geht ohne Auffüllen auf → über Kreuz (1. A – 2. B, 1. B – 2. A …)
 */
function koPlan(sizes, q) {
  const G = sizes.length, Q = G * q;
  if (G === 1) return { size: q >= 2 && sizes[0] >= 2 ? 2 : 1, take: q, fill: 0, cross: false };   // eine Gruppe: Finale Erster gegen Zweiter (oder gar keine Endrunde)
  if (pow2(Q)) return { size: Q, take: q, fill: 0, cross: q === 2 };
  const up = nextPow2(Q), more = sizes.filter(s => s > q).length;
  if (up - Q <= more) return { size: up, take: q, fill: up - Q, cross: false };
  const down = up / 2;   // zu wenige Dritte: kleineres Feld, aufgefüllt mit den besten der letzten Platzierung, die noch ganz passt
  const t = Math.floor(down / G);
  return { size: down, take: t, fill: down - G * t, cross: false };
}
/**
 * Quellen der ersten K.-o.-Runde einer Gruppenphase: [[quelle, quelle], …], quelle = { g, r } (Platz r der Gruppe g) | { best: r, n } (n-te Beste der Platzierung r) | null (Freilos)
 * Über Kreuz: (A,B),(C,D) … → obere Hälfte 1A–2B, 1C–2D …, untere Hälfte 1B–2A, 1D–2C … – Mannschaften derselben Gruppe treffen erst im Finale bzw. spät aufeinander.
 * Sonst Setzliste: Sieger (besser je Spiel zuerst), Zweite …, Auffüller; Mannschaften derselben Gruppe möglichst nicht in der ersten Runde.
 */
function koSources(sizes, q) {
  const p = koPlan(sizes, q), G = sizes.length;
  if (G === 1) return { ...p, first: p.size === 2 ? [[{ g: 0, r: 1 }, { g: 0, r: 2 }]] : [] };
  if (p.cross) {
    const top = [], bottom = [];
    for (let g = 0; g < G; g += 2) { top.push([{ g, r: 1 }, { g: g + 1, r: 2 }]); bottom.push([{ g: g + 1, r: 1 }, { g, r: 2 }]); }
    return { ...p, first: [...top, ...bottom] };   // 1. A oben, 2. A unten: Mannschaften einer Gruppe treffen frühestens im Finale
  }
  const seeds = [];
  for (let r = 1; r <= p.take; r++) for (let n = 1; n <= G; n++) seeds.push({ best: r, n });
  for (let n = 1; n <= p.fill; n++) seeds.push({ best: p.take + 1, n });
  return { ...p, first: seedBracket(seeds).first };
}

/* ---------- Schleifchen ---------- */
/**
 * Schleifchen-Runden: je Runde neue Doppelpartner, gewonnene Spiele zählen je Person. Wer bei einer Zahl, die nicht durch 4 geht,
 * aussetzt, wechselt (am wenigsten ausgesetzt zuerst). Partner wiederholen sich nicht, solange es geht; Gegner möglichst auch nicht.
 * ids: Personen → [[ [a1, a2, b1, b2], … ], …] und je Runde die Aussetzer
 */
function schleifchen(ids, count, { shuffle = W.shuffle, tries = 300 } = {}) {
  const partner = new Map(), against = new Map(), sat = new Map(ids.map(i => [i, 0]));
  const k = (x, y) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const out = [];
  for (let r = 0; r < count; r++) {
    const play = Math.floor(ids.length / 4) * 4;
    const order = shuffle(ids).sort((x, y) => sat.get(y) - sat.get(x));   // wer schon öfter ausgesetzt hat, spielt zuerst; aussetzen müssen die übrigen (Zufall bei Gleichstand)
    const playing = order.slice(0, play), out_ = order.slice(play);
    let best = null, bestCost = Infinity;
    for (let t = 0; t < tries && bestCost > 0; t++) {
      const p = shuffle(playing), pairs = [];
      let cost = 0;
      // Partner: gierig, wer noch keinen hatte zuerst
      const rest = [...p];
      while (rest.length) {
        const a = rest.shift();
        let j = rest.findIndex(b => !partner.get(k(a, b)));
        if (j < 0) { j = 0; cost += 100; }
        pairs.push([a, rest.splice(j, 1)[0]]);
      }
      const ps = shuffle(pairs), games = [];
      while (ps.length) {
        const A = ps.shift();
        let j = ps.findIndex(B => A.every(x => B.every(y => !against.get(k(x, y)))));
        if (j < 0) { j = 0; cost += 1; }
        const B = ps.splice(j, 1)[0];
        games.push([A[0], A[1], B[0], B[1]]);
      }
      if (cost < bestCost) { bestCost = cost; best = games; }
    }
    for (const [a1, a2, b1, b2] of best) {
      partner.set(k(a1, a2), 1); partner.set(k(b1, b2), 1);
      for (const x of [a1, a2]) for (const y of [b1, b2]) against.set(k(x, y), 1);
    }
    for (const x of out_) sat.set(x, sat.get(x) + 1);
    out.push({ games: best || [], out: out_ });
  }
  return out;
}
/** Rangliste im Schleifchen: gewonnene Spiele je Person, dann Siege, dann Los. persons: [{ id, name, lot }], matches: [{ a, a2, b, b2, score_a, score_b, winner }] */
function schleifchenTable(persons, matches) {
  const rows = new Map(persons.map(p => [p.id, { id: p.id, name: p.name, lot: p.lot == null ? null : p.lot, played: 0, won: 0, for: 0, against: 0 }]));
  for (const m of matches.filter(x => x.winner)) {
    for (const [side, ids] of [['a', [m.a, m.a2]], ['b', [m.b, m.b2]]]) for (const id of ids) {
      const r = rows.get(id); if (!r) continue;
      r.played++; r.for += side === 'a' ? m.score_a : m.score_b; r.against += side === 'a' ? m.score_b : m.score_a;
      if (m.winner === side) r.won++;
    }
  }
  const cmp = (p, q) => q.for - p.for || q.won - p.won;
  const lot = (p, q) => (p.lot != null && q.lot != null ? p.lot - q.lot : 0);
  const s = [...rows.values()].sort((p, q) => cmp(p, q) || lot(p, q) || String(p.name).localeCompare(String(q.name), 'de'));
  return s.map((r, i) => ({ ...r, rank: i + 1, diff: r.for - r.against, tie: Boolean(r.played) && s.some((x, j) => j !== i && cmp(r, x) === 0 && !lot(r, x)) }));
}

/* ---------- Spielplan ---------- */
/**
 * Spielplan mit Uhrzeit und Platz in Zeitfenstern (Spielzeit + Pause). Niemand spielt zweimal hintereinander (ein Fenster Pause) – passt
 * in einem Fenster gar nichts, bleibt es frei. Gruppen verteilt über die Plätze (jede Gruppe möglichst auf „ihrem“ Platz),
 * Pause nach der Vorrunde und zwischen den K.-o.-Runden.
 * Abschnitte: [{ matches: [{ key, teams: [ids], home, order }], gap (Minuten davor), rest (true = Ruhe-Regel) }], courts: Anzahl
 * → { slots: Map(key → { court (0 …), at (Minuten ab Beginn) }), end (Minuten) }
 */
function plan(sections, courts, { minutes, pause }) {
  const L = minutes + pause, slots = new Map();
  let t = 0, end = null;
  for (const sec of sections) {
    if (!sec.matches.length) continue;
    if (end != null) t = end + Math.max(sec.gap || 0, pause);
    let left = [...sec.matches].sort((x, y) => (x.order || 0) - (y.order || 0));
    let prev = new Set();
    while (left.length) {
      const busy = new Set(), placed = [];
      for (let c = 0; c < courts && left.length; c++) {
        const ok = m => m.teams.every(x => !busy.has(x)) && (!sec.rest || !prev.size || m.teams.every(x => !prev.has(x)));
        const pick = left.find(m => ok(m) && m.home != null && m.home % courts === c) || left.find(ok);
        if (!pick) continue;
        placed.push([pick, c]); pick.teams.forEach(x => busy.add(x)); left = left.filter(m => m !== pick);
      }
      for (const [m, c] of placed) slots.set(m.key, { court: c, at: t });
      if (placed.length) end = t + minutes;
      prev = busy; t += L;   // nichts passte: dieses Fenster bleibt frei, im nächsten hatten alle Pause
    }
  }
  return { slots, end: end || 0 };
}

module.exports = { SPORTS, FORMATS, CRITERIA, ORDER, config, groupCount, groupSizes, groupLabel, drawGroups, rounds, checkScore, scoreText, table, bestOf,
  bracketOrder, koLabel, seedBracket, koPlan, koSources, schleifchen, schleifchenTable, plan, pow2, nextPow2 };
