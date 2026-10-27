'use strict';
/* =====================================================================================================
   Turniere – Wertung (ohne Datenbank, auch für spätere Turnierarten nutzbar)
   Tennis: 2 Gewinnsätze, 3. Satz als Match-Tiebreak bis 10 (2 Punkte Abstand).
   Ergebnis eines Spiels: { result: 'normal' | 'wo' | 'aufgabe' | 'ausgefallen', sets: [[a, b], …], winner: 'a' | 'b' | null }
   - wo (kampflos): zählt wie 6:0 6:0 für den Sieger
   - aufgabe: die gespielten Sätze, fehlende Spiele und Sätze bekommt der Sieger (DTB)
   - ausgefallen: nicht gespielt (Sportwart nach Fristende), zählt in der Tabelle nicht
   ===================================================================================================== */
const crypto = require('crypto');

const fail = msg => { throw Object.assign(new Error(msg), { status: 400 }); };
const regular = (x, y) => { const hi = Math.max(x, y), lo = Math.min(x, y); return (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6)); };
const tiebreak = (x, y) => { const hi = Math.max(x, y), lo = Math.min(x, y); return hi >= 10 && hi - lo >= 2 && (hi === 10 || hi - lo === 2); };
const regularOpen = (x, y) => { const hi = Math.max(x, y), lo = Math.min(x, y); return hi <= 6 && !(hi === 6 && lo <= 4); };   // Satz läuft noch (auch 6:6)
const tiebreakOpen = (x, y) => !tiebreak(x, y) && Math.max(x, y) <= 30;
const side = (x, y) => (x > y ? 'a' : 'b');

/** Sätze aus der Eingabe: [[6,4],[3,6],[10,7]] oder ["6:4", …] → Zahlenpaare */
function parseSets(list) {
  if (!Array.isArray(list)) fail('Bitte die Sätze eintragen.');
  const out = list.filter(s => s != null && !(Array.isArray(s) && s.every(v => v === '' || v == null)) && s !== '').map(s => {
    const p = Array.isArray(s) ? s : String(s).split(/[:\-–]/);
    if (p.length !== 2) fail('Bitte jeden Satz als „6:4“ eintragen.');
    const n = p.map(v => (String(v).trim() === '' ? NaN : Number(v)));
    if (!n.every(v => Number.isInteger(v) && v >= 0 && v <= 99)) fail('Bitte nur ganze Zahlen eintragen.');
    return n;
  });
  if (out.length > 3) fail('Höchstens drei Sätze (der dritte als Match-Tiebreak).');
  return out;
}

/**
 * Ergebnis prüfen → { result, sets, winner } (normiert) oder Fehler (status 400) mit verständlichem Text.
 * input: { result, sets, winner (bei wo), retired ('a'|'b' bei Aufgabe) }
 */
function checkResult(input) {
  const result = ['normal', 'wo', 'aufgabe', 'ausgefallen'].includes(input && input.result) ? input.result : 'normal';
  if (result === 'ausgefallen') return { result, sets: [], winner: null };
  if (result === 'wo') {
    if (!['a', 'b'].includes(input.winner)) fail('Bitte wählen, wer kampflos gewinnt.');
    return { result, sets: [], winner: input.winner };
  }
  const sets = parseSets(input.sets);
  const won = { a: 0, b: 0 };
  const label = i => (i === 2 ? 'Match-Tiebreak' : `Satz ${i + 1}`);
  if (result === 'normal') {
    if (sets.length < 2) fail('Bitte mindestens zwei Sätze eintragen.');
    sets.forEach(([x, y], i) => {
      if (won.a === 2 || won.b === 2) fail('Nach zwei gewonnenen Sätzen ist das Spiel entschieden – bitte keinen dritten Satz eintragen.');
      if (i < 2 && !regular(x, y)) fail(`${label(i)}: ${x}:${y} ist kein gültiges Satzergebnis (z. B. 6:4, 7:5 oder 7:6).`);
      if (i === 2 && !tiebreak(x, y)) fail(`Match-Tiebreak: ${x}:${y} ist kein gültiges Ergebnis (bis 10, mit 2 Punkten Abstand, z. B. 10:7 oder 12:10).`);
      won[side(x, y)]++;
    });
    if (won.a < 2 && won.b < 2) fail('Bei 1:1 Sätzen bitte den Match-Tiebreak eintragen.');
    return { result, sets, winner: won.a === 2 ? 'a' : 'b' };
  }
  // Aufgabe: gespielte Sätze, der letzte darf noch laufen
  if (!['a', 'b'].includes(input.retired)) fail('Bitte wählen, wer aufgegeben hat.');
  sets.forEach(([x, y], i) => {
    if (won.a === 2 || won.b === 2) fail('Nach zwei gewonnenen Sätzen ist das Spiel entschieden – bitte keinen weiteren Satz eintragen.');
    const last = i === sets.length - 1, tb = i === 2;
    const done = tb ? tiebreak(x, y) : regular(x, y);
    if (!done && !(last && (tb ? tiebreakOpen(x, y) : regularOpen(x, y)))) fail(`${label(i)}: ${x}:${y} ist kein gültiger Spielstand.`);
    if (done) won[side(x, y)]++;
  });
  if (won.a === 2 || won.b === 2) fail('Das Spiel war schon entschieden – bitte als normales Ergebnis eintragen.');
  return { result, sets, winner: input.retired === 'a' ? 'b' : 'a', retired: input.retired };
}

/** Sätze und Spiele für die Tabelle → { a: { sets, games }, b: { sets, games } } – Match-Tiebreak zählt als ein Spiel (1:0) */
function tally(m) {
  const t = { a: { sets: 0, games: 0 }, b: { sets: 0, games: 0 } };
  if (!m || !m.winner || m.result === 'ausgefallen') return t;
  const w = m.winner, l = w === 'a' ? 'b' : 'a';
  if (m.result === 'wo') { t[w].sets = 2; t[w].games = 12; return t; }
  const sets = (m.sets || []).map(s => [...s]);
  if (m.result === 'aufgabe') {   // fehlende Spiele des laufenden Satzes und fehlende Sätze bekommt der Sieger
    const wi = w === 'a' ? 0 : 1, li = 1 - wi;
    const last = sets[sets.length - 1];
    if (last) {
      const tb = sets.length === 3;
      if (tb ? !tiebreak(last[0], last[1]) : !regular(last[0], last[1])) last[wi] = tb ? Math.max(10, last[li] + 2) : (last[li] <= 4 ? 6 : 7);
    }
    const count = () => sets.filter((s, i) => (i === 2 ? tiebreak(s[0], s[1]) : regular(s[0], s[1])) && side(s[0], s[1]) === w).length;
    while (count() < 2) { const s = [0, 0]; s[wi] = sets.length === 2 ? 10 : 6; sets.push(s); }
  }
  sets.forEach(([x, y], i) => {
    const k = side(x, y);
    t[k].sets++;
    if (i === 2) t[k].games++; else { t.a.games += x; t.b.games += y; }
  });
  return t;
}

/**
 * Tabelle einer Gruppe: Siege, dann Satzdifferenz, dann Spieldifferenz; bei Gleichstand der direkte Vergleich
 * (bei mehr als zwei Gleichen zuerst die Siege untereinander). teams: [{ id, name }], matches: [{ a, b, result, sets, winner }]
 * → [{ id, name, rank, played, won, lost, setsW, setsL, gamesW, gamesL }]
 */
function table(teams, matches) {
  const rows = new Map(teams.map(t => [t.id, { id: t.id, name: t.name, played: 0, won: 0, lost: 0, setsW: 0, setsL: 0, gamesW: 0, gamesL: 0 }]));
  const done = matches.filter(m => m.winner && m.result !== 'ausgefallen' && rows.has(m.a) && rows.has(m.b));
  for (const m of done) {
    const t = tally(m), A = rows.get(m.a), B = rows.get(m.b);
    A.played++; B.played++;
    (m.winner === 'a' ? A : B).won++; (m.winner === 'a' ? B : A).lost++;
    A.setsW += t.a.sets; A.setsL += t.b.sets; B.setsW += t.b.sets; B.setsL += t.a.sets;
    A.gamesW += t.a.games; A.gamesL += t.b.games; B.gamesW += t.b.games; B.gamesL += t.a.games;
  }
  const winnerOf = (x, y) => { const m = done.find(z => (z.a === x && z.b === y) || (z.a === y && z.b === x)); return m ? (m.winner === 'a' ? m.a : m.b) : null; };
  const key = r => [r.won, r.setsW - r.setsL, r.gamesW - r.gamesL];
  const cmp = (p, q) => { const a = key(p), b = key(q); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return b[i] - a[i]; return 0; };
  const byName = (p, q) => String(p.name).localeCompare(String(q.name), 'de');
  /** Gleichstand auflösen: zwei → direkter Vergleich; mehr → Siege untereinander, dann wieder paarweise */
  function resolve(group) {
    if (group.length === 1) return group;
    if (group.length === 2) { const w = winnerOf(group[0].id, group[1].id); return w === group[1].id ? [group[1], group[0]] : w === group[0].id ? group : group.sort(byName); }
    const ids = new Set(group.map(r => r.id));
    const mini = new Map(group.map(r => [r.id, 0]));
    for (const m of done) if (ids.has(m.a) && ids.has(m.b)) { const w = m.winner === 'a' ? m.a : m.b; mini.set(w, mini.get(w) + 1); }
    const sorted = [...group].sort((p, q) => mini.get(q.id) - mini.get(p.id) || byName(p, q));
    if (new Set(sorted.map(r => mini.get(r.id))).size === 1) return sorted;   // alle gleich: bleibt beim Namen
    const out = []; let i = 0;
    while (i < sorted.length) { let j = i; while (j < sorted.length && mini.get(sorted[j].id) === mini.get(sorted[i].id)) j++; out.push(...resolve(sorted.slice(i, j))); i = j; }
    return out;
  }
  const list = [...rows.values()].sort((p, q) => cmp(p, q) || byName(p, q));
  const out = []; let i = 0;
  while (i < list.length) { let j = i; while (j < list.length && cmp(list[i], list[j]) === 0) j++; out.push(...resolve(list.slice(i, j))); i = j; }
  return out.map((r, k) => ({ ...r, rank: k + 1 }));
}

/** Jeder gegen jeden: alle Paarungen [a, b] */
const roundRobin = ids => ids.flatMap((a, i) => ids.slice(i + 1).map(b => [a, b]));
/** zufällig mischen (kryptografischer Zufall – nachvollziehbar fair, nicht vorhersagbar) */
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** in n Gruppen verteilen, gleich groß (± 1) → [[…], […]] */
function deal(list, n) { const g = Array.from({ length: n }, () => []); shuffle(list).forEach((x, i) => g[i % n].push(x)); return g; }
/** Gruppenzahl einer Liga: 2 Gruppen ab 6 Teilnehmern, sonst eine */
const groupCount = n => (n >= 6 ? 2 : 1);
/** Ergebnis als Text: „6:4 3:6 10:7“, „w. o.“, „6:4 2:1 Aufg.“ – aus Sicht von a */
function scoreText(m) {
  if (!m || (!m.winner && m.result !== 'ausgefallen')) return '';
  if (m.result === 'ausgefallen') return 'ausgefallen';
  if (m.result === 'wo') return 'w. o.';
  return (m.sets || []).map(s => s.join(':')).join(' ') + (m.result === 'aufgabe' ? ' Aufg.' : '');
}

module.exports = { checkResult, tally, table, roundRobin, shuffle, deal, groupCount, scoreText };
