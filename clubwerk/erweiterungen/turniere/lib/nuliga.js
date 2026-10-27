'use strict';
/* =====================================================================================================
   Turniere – nuLiga-Dateien lesen (ohne Datenbank)
   XML (DTD dtb-tournament-1.1): eine Datei je Turnier mit Personen, Konkurrenzen, Meldungen und Spielplan.
   CSV (Spieleranmeldungen.csv, Windows-1252, Semikolon): genaue LK mit Komma und Gebührenabrechnung („bar“).
   Datensparsam: übernommen werden nur Name, Verein, LK, Geschlecht, Geburtsjahr und die nuLiga-IDs –
   Anschrift, E-Mail, Telefon und das volle Geburtsdatum werden gar nicht erst ausgelesen.
   Der Leser ist bewusst nachsichtig: Angaben dürfen als Attribut oder als Unterelement stehen, Namen mit Bindestrich,
   Unterstrich oder zusammengeschrieben. Was er nicht kennt, meldet er als Hinweis (unknown), statt still etwas zu raten.
   Kein DTD-Nachladen, keine eigenen Entitäten (Schutz vor XXE und „Billion Laughs“).
   ===================================================================================================== */

const MAX_BYTES = 5 * 1024 * 1024;

/* ---------- kleiner XML-Leser → { name, attrs, children, text } ---------- */
const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const decodeEnt = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : m;
});
function parseXml(src) {
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  let i = 0;
  const n = src.length;
  const fail = msg => { throw new Error(`Die XML-Datei ist nicht lesbar (${msg}).`); };
  while (i < n) {
    const lt = src.indexOf('<', i);
    const top = stack[stack.length - 1];
    if (lt < 0) { top.text += decodeEnt(src.slice(i)); break; }
    if (lt > i) top.text += decodeEnt(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt + 4); if (e < 0) fail('Kommentar'); i = e + 3; continue; }
    if (src.startsWith('<![CDATA[', lt)) { const e = src.indexOf(']]>', lt + 9); if (e < 0) fail('CDATA'); top.text += src.slice(lt + 9, e); i = e + 3; continue; }
    if (src.startsWith('<?', lt)) { const e = src.indexOf('?>', lt + 2); if (e < 0) fail('Kopf'); i = e + 2; continue; }
    if (src.startsWith('<!', lt)) {   // <!DOCTYPE …> mit möglichem internen Teil […] – wird übersprungen, nichts daraus übernommen
      let j = lt + 2, depth = 0;
      for (; j < n; j++) { const c = src[j]; if (c === '[') depth++; else if (c === ']') depth--; else if (c === '>' && depth <= 0) break; }
      i = j + 1; continue;
    }
    if (src[lt + 1] === '/') {
      const e = src.indexOf('>', lt); if (e < 0) fail('Ende');
      const name = src.slice(lt + 2, e).trim();
      if (stack.length < 2 || top.name !== name) fail(`</${name.slice(0, 30)}> passt nicht`);
      stack.pop(); i = e + 1; continue;
    }
    // Start-Tag mit Attributen
    const m = /^<([A-Za-z_][\w.:-]*)/.exec(src.slice(lt, lt + 200));
    if (!m) fail('Zeichen „<“');
    const el = { name: m[1], attrs: {}, children: [], text: '' };
    let j = lt + m[0].length;
    for (;;) {
      while (j < n && /\s/.test(src[j])) j++;
      if (src[j] === '/' && src[j + 1] === '>') { j += 2; top.children.push(el); break; }
      if (src[j] === '>') { j++; top.children.push(el); stack.push(el); if (stack.length > 60) fail('zu tief verschachtelt'); break; }
      const a = /^([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/.exec(src.slice(j, j + 4000));
      if (!a) fail(`Attribut in <${el.name}>`);
      el.attrs[a[1]] = decodeEnt(a[3] !== undefined ? a[3] : a[4]);
      j += a[0].length;
    }
    i = j;
  }
  if (stack.length !== 1) fail(`<${stack[stack.length - 1].name}> nicht geschlossen`);
  return root;
}

/* ---------- Zugriff: Attribut oder Unterelement, Schreibweise egal ---------- */
const norm = s => String(s).toLowerCase().replace(/^.*:/, '').replace(/[-_.\s]/g, '');
const kids = (node, ...names) => { const want = new Set(names.map(norm)); return node.children.filter(c => want.has(norm(c.name))); };
const kid = (node, ...names) => kids(node, ...names)[0] || null;
/** alle Nachfahren mit diesem Namen (ohne in gleichnamige hineinzugehen) */
function all(node, ...names) {
  const want = new Set(names.map(norm)), out = [];
  (function walk(x) { for (const c of x.children) { if (want.has(norm(c.name))) out.push(c); else walk(c); } })(node);
  return out;
}
function get(node, ...names) {
  if (!node) return '';
  const want = names.map(norm);
  for (const w of want) for (const [k, v] of Object.entries(node.attrs)) if (norm(k) === w && String(v).trim() !== '') return String(v).trim();
  for (const w of want) for (const c of node.children) if (norm(c.name) === w && !c.children.length && c.text.trim()) return c.text.trim();
  return '';
}
const clean = (v, max = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/* ---------- Werte ---------- */
/** „2026-11-07“, „07.11.2026“, „2026-11-07T09:00:00“ → { date, time } */
function when(...vals) {
  let date = '', time = '';
  for (const v of vals.map(x => String(x || '').trim()).filter(Boolean)) {
    let m = /(\d{4})-(\d{2})-(\d{2})/.exec(v); if (m && !date) date = `${m[1]}-${m[2]}-${m[3]}`;
    m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(v); if (m && !date) date = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = /(?:^|[T\s])(\d{1,2}):(\d{2})(?::\d{2})?/.exec(v); if (m && !time && +m[1] < 24 && +m[2] < 60) time = `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  return { date, time };
}
/** Nenngeld „25,00“ / „25.00“ / „25 €“ → Cent */
const cents = v => { const t = String(v || '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); const x = parseFloat(t); return Number.isFinite(x) && x >= 0 && x < 10000 ? Math.round(x * 100) : 0; };
/** LK „16“, „16,1“, „LK16,1“ → „16,1“ (Text, wie in nuLiga) */
const lkText = v => { const m = /(\d{1,2})(?:[,.](\d))?/.exec(String(v || '')); return m ? `${+m[1]}${m[2] !== undefined ? ',' + m[2] : ''}` : ''; };
const genderOf = v => { const t = String(v || '').toLowerCase(); return /^(m|male|maennlich|männlich|herren|h)$/.test(t) ? 'm' : /^(f|w|female|weiblich|damen|d)$/.test(t) ? 'w' : /mix/.test(t) ? 'x' : ''; };
const kindOf = (v, name) => { const t = `${v} ${name}`.toLowerCase(); return /doub|doppel|mixed|mixed/.test(t) ? 'doppel' : 'einzel'; };

/* ---------- Turnier aus XML ---------- */
const KNOWN = new Set(['tournament', 'organizer', 'contact', 'person', 'persons', 'club', 'event', 'events', 'registrationlist', 'registration', 'registrationnote', 'note', 'notes', 'participant', 'player', 'team', 'draw', 'match', 'matches', 'set', 'sets', 'seed', 'seeding', 'seedlist', 'teama', 'teamb', 'sidea', 'sideb', 'participanta', 'participantb', 'playera', 'playerb', 'a', 'b',
  'address', 'street', 'zip', 'city', 'country', 'email', 'phone', 'mobile', 'fax', 'birthdate', 'firstname', 'lastname', 'name', 'gender', 'nationality', 'courts', 'court', 'location', 'description', 'remarks', 'ballbrand', 'ball', 'referee', 'entryfee', 'fee', 'agegroup', 'lkrange', 'id']);
/**
 * nuLiga-XML eines Turniers lesen →
 * { tournament: { ext, name, from, to, fee }, clubNo, persons: [{ ext, first, last, club, clubNo, lk, gender, birthYear, dtb }],
 *   events: [{ ext, name, kind, gender, age, fee, scoring, consolation, mode, entries: [{ ext, persons: [ext], note, status }],
 *     matches: [{ ext, round, no, group, court, date, time, scoring, status, a, b (Meldungs-ext), sets, result, winner, retired }] }],
 *   skipped: ['Damen 50 Einzel (keine Meldungen)'], unknown: ['element', …] }
 */
function readTournament(buf) {
  if (!buf || !buf.length) throw new Error('Die Datei ist leer.');
  if (buf.length > MAX_BYTES) throw new Error('Die Datei ist zu groß (höchstens 5 MB).');
  const head = buf.slice(0, 200).toString('latin1');
  const enc = /encoding\s*=\s*["']([^"']+)["']/i.exec(head);
  const src = /^(iso-8859-1|latin-?1|windows-1252|cp1252)$/i.test(enc ? enc[1] : '') ? new TextDecoder('windows-1252').decode(buf) : buf.toString('utf8').replace(/^﻿/, '');
  if (/<!ENTITY/i.test(src)) throw new Error('Die XML-Datei enthält eigene Entitäten – so etwas schreibt nuLiga nicht. Bitte die Originaldatei nehmen.');
  const root = parseXml(src);
  const t = root.children.find(c => norm(c.name) === 'tournament') || all(root, 'tournament')[0];
  if (!t) throw new Error('Das ist keine Turnier-Datei aus nuLiga (kein <tournament> gefunden).');
  const unknown = new Set();
  (function walk(x) { for (const c of x.children) { if (!KNOWN.has(norm(c.name))) unknown.add(c.name); walk(c); } })(t);
  const tid = get(t, 'id', 'tournament-id', 'nuliga-id', 'number', 'nr');
  const d1 = when(get(t, 'start-date', 'startdate', 'date-from', 'from', 'begin', 'start'), get(t, 'date')), d2 = when(get(t, 'end-date', 'enddate', 'date-to', 'to', 'end'));
  const org = kid(t, 'organizer') || all(t, 'organizer')[0];
  const orgClub = org ? (kid(org, 'club') || org) : null;
  const tournament = { ext: clean(tid, 40), name: clean(get(t, 'name', 'title'), 120) || 'Turnier', from: d1.date, to: d2.date || d1.date, fee: cents(get(t, 'entry-fee', 'fee', 'entryfee')) };
  const clubNo = clean(orgClub ? get(orgClub, 'club-nr', 'club-number', 'clubnr', 'club-no', 'number', 'nr', 'id') : '', 20);

  /* Personen: aus <person> mit ID, wo immer sie stehen (Personenliste oder direkt in der Meldung) */
  const persons = new Map();
  const readPerson = p => {
    const ext = clean(get(p, 'id', 'person-id', 'nuliga-id', 'personid'), 40);
    const first = clean(get(p, 'firstname', 'first-name', 'given-name', 'vorname'), 40), last = clean(get(p, 'lastname', 'last-name', 'surname', 'family-name', 'nachname'), 50);
    if (!ext || (!first && !last)) return ext || null;
    const club = kid(p, 'club');
    const by = when(get(p, 'birthdate', 'birth-date', 'date-of-birth', 'birthday', 'geburtsdatum')).date || '';
    const yr = by ? by.slice(0, 4) : (/^(19|20)\d\d$/.test(get(p, 'birth-year', 'birthyear')) ? get(p, 'birth-year', 'birthyear') : '');
    if (!persons.has(ext)) persons.set(ext, { ext, first, last,
      club: clean(club ? get(club, 'name', 'title') || club.text : get(p, 'club', 'club-name', 'clubname', 'verein'), 80),
      clubNo: clean(club ? get(club, 'club-nr', 'club-number', 'clubnr', 'number', 'nr', 'id') : get(p, 'club-nr', 'club-number', 'clubnr', 'club-id'), 20),
      lk: lkText(get(p, 'lk-single', 'lksingle', 'lk', 'lk-einzel')), gender: genderOf(get(p, 'gender', 'sex', 'geschlecht')), birthYear: yr,
      dtb: clean(get(p, 'dtb-id', 'dtbid', 'player-id', 'licence', 'license'), 20) });
    return ext;
  };
  for (const p of all(t, 'person')) readPerson(p);

  const events = [], skipped = [];
  for (const ev of all(t, 'event')) {
    const name = clean(get(ev, 'name', 'title'), 80) || 'Konkurrenz';
    const kind = kindOf(get(ev, 'type', 'kind', 'discipline', 'competition-type'), name);
    const entries = [], byPerson = new Map();
    for (const r of all(ev, 'registration')) {
      const ext = clean(get(r, 'id', 'registration-id', 'nuliga-id'), 40);
      const ps = [];
      for (const c of r.children) {
        const nn = norm(c.name);
        if (!['person', 'participant', 'player', 'team'].includes(nn)) continue;
        if (nn === 'team') { for (const x of c.children) { const id = readPerson(x) || clean(get(x, 'person-id', 'person', 'ref', 'idref', 'id'), 40); if (id) ps.push(id); } continue; }
        const id = (nn === 'person' ? readPerson(c) : null) || clean(get(c, 'person-id', 'person', 'ref', 'idref', 'id'), 40);
        if (id) ps.push(id);
      }
      if (!ps.length) for (const k of ['person-id', 'person', 'player-a', 'player-b', 'person1', 'person2']) { const v = clean(r.attrs[k] || '', 40); if (v) ps.push(v); }
      if (!ps.length) continue;
      const noteEl = kid(r, 'registration-note', 'note', 'remark');
      const note = clean(noteEl ? noteEl.text : get(r, 'registration-note', 'note'), 300);
      const status = clean(get(r, 'status', 'state'), 30).toLowerCase();
      const e = { ext: ext || ps.join('+'), persons: [...new Set(ps)].slice(0, 2), note, status, seed: +get(r, 'seed', 'seeding') || null };
      entries.push(e);
      for (const p of e.persons) byPerson.set(p, e.ext);
    }
    if (!entries.length) { skipped.push(`${name} (keine Meldungen)`); continue; }
    const byExt = new Map(entries.map(e => [e.ext, e]));
    const draw = kid(ev, 'draw') || all(ev, 'draw')[0];
    const scoringEv = get(ev, 'counting', 'scoring', 'count-type', 'counting-type') || (draw ? get(draw, 'counting', 'scoring') : '');
    /** Seite eines Matches: Verweis auf eine Meldung oder Person(en) */
    const sideRef = node => {
      if (!node) return null;
      const refs = [get(node, 'registration-id', 'registration', 'entry-id', 'entry'), get(node, 'person-id', 'person', 'player-id', 'ref', 'idref', 'id')].filter(Boolean);
      for (const x of node.children) { const id = get(x, 'registration-id', 'registration', 'person-id', 'person', 'ref', 'idref', 'id'); if (id) refs.push(id); }
      for (const r of refs) { if (byExt.has(r)) return r; if (byPerson.has(r)) return byPerson.get(r); }
      return null;
    };
    const matches = [];
    for (const m of all(ev, 'match')) {
      let a = sideRef(kid(m, 'team-a', 'side-a', 'participant-a', 'player-a', 'a', 'home')), b = sideRef(kid(m, 'team-b', 'side-b', 'participant-b', 'player-b', 'b', 'guest'));
      if (!a && !b) {   // Seiten ohne eigene Namen: in Reihenfolge
        const sides = m.children.filter(c => ['team', 'participant', 'player', 'side', 'registration', 'person'].includes(norm(c.name))).map(sideRef);
        [a, b] = [sides[0] || null, sides[1] || null];
        if (!a && !b) { a = sideRef({ attrs: { id: get(m, 'registration-a', 'team-a', 'participant-a', 'player-a', 'a') }, children: [] }); b = sideRef({ attrs: { id: get(m, 'registration-b', 'team-b', 'participant-b', 'player-b', 'b') }, children: [] }); }
      }
      const w = when(get(m, 'date', 'scheduled-date', 'day'), get(m, 'time', 'scheduled-time', 'start-time', 'start', 'scheduled', 'datetime', 'planned'));
      const scoring = get(m, 'counting', 'scoring', 'count-type', 'counting-type') || scoringEv || 'CT_2S6G_MTB10';
      // Sätze: <set games-a="6" games-b="4"/> … oder games-a="6 3 10" am Match
      let sets = (kids(m, 'set').length ? kids(m, 'set') : all(m, 'set')).map(s => [parseInt(get(s, 'games-a', 'gamesa', 'a'), 10), parseInt(get(s, 'games-b', 'gamesb', 'b'), 10)]);
      if (!sets.length && get(m, 'games-a')) { const xa = get(m, 'games-a').split(/[\s,;/]+/), xb = get(m, 'games-b').split(/[\s,;/]+/); sets = xa.map((x, k) => [parseInt(x, 10), parseInt(xb[k], 10)]); }
      sets = sets.filter(s => s.every(v => Number.isInteger(v) && v >= 0 && v < 100)).slice(0, 3);
      const status = clean(get(m, 'status', 'state', 'result-type'), 30).toLowerCase();
      let result = null, winner = null, retired = null;
      if (/walk-?over-?a/.test(status)) { result = 'wo'; winner = 'b'; } else if (/walk-?over-?b/.test(status)) { result = 'wo'; winner = 'a'; }
      else if (/retired-?a/.test(status)) { result = 'aufgabe'; retired = 'a'; winner = 'b'; } else if (/retired-?b/.test(status)) { result = 'aufgabe'; retired = 'b'; winner = 'a'; }
      else if (sets.length >= 2) result = 'normal';
      matches.push({ ext: clean(get(m, 'id', 'match-id', 'nuliga-id'), 40) || `${get(m, 'round', 'round-no')}-${get(m, 'number', 'match-nr', 'nr', 'no')}-${get(m, 'group', 'group-no') || 0}`,
        round: clean(get(m, 'round', 'round-no', 'round-number', 'runde'), 20), no: parseInt(get(m, 'number', 'match-nr', 'match-number', 'nr', 'no'), 10) || 0, group: parseInt(get(m, 'group', 'group-no', 'gruppe'), 10) || 0,
        court: clean(get(m, 'court', 'court-name', 'platz', 'location'), 40), date: w.date || tournament.from, time: w.time, scoring: clean(scoring, 30), status, a, b, sets, result, winner, retired });
    }
    events.push({ ext: clean(get(ev, 'id', 'event-id', 'nuliga-id'), 40) || name, name, kind, gender: genderOf(get(ev, 'gender', 'sex')), age: clean(get(ev, 'age', 'age-class', 'age-group'), 20),
      fee: cents(get(ev, 'entry-fee', 'fee', 'entryfee')) || tournament.fee, scoring: clean(scoringEv || (matches[0] && matches[0].scoring) || 'CT_2S6G_MTB10', 30), consolation: clean(get(ev, 'consolation'), 20),
      mode: clean(draw ? get(draw, 'mode', 'type') : '', 40), final: clean(draw ? get(draw, 'final') : '', 30), entries, matches });
  }
  const used = new Set(events.flatMap(e => e.entries.flatMap(x => x.persons)));
  return { tournament, clubNo, persons: [...persons.values()].filter(p => used.has(p.ext)), events, skipped, unknown: [...unknown].slice(0, 20) };
}

/* ---------- Meldeliste aus CSV (Windows-1252, Semikolon) ---------- */
/** → [{ first, last, lk, pay, status, event, partner: { first, last, lk } | null }] */
function readCsv(buf) {
  if (!buf || !buf.length) throw new Error('Die Datei ist leer.');
  if (buf.length > MAX_BYTES) throw new Error('Die Datei ist zu groß (höchstens 5 MB).');
  let t = buf.toString('utf8');
  if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);   // kein gültiges UTF-8 → Windows-1252
  t = t.replace(/^﻿/, '');
  const split = line => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ';') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out.map(x => x.trim()); };
  const lines = t.split(/\r?\n/).filter(x => x.trim());
  const hi = lines.findIndex(l => /vorname/i.test(l) && /;/.test(l));
  if (hi < 0) throw new Error('In der CSV fehlt die Kopfzeile (Spalten „Vorname“, „Nachname“ …).');
  const h = split(lines[hi]).map(x => x.toLowerCase());
  const idx = re => h.reduce((a, c, i) => (re.test(c) ? [...a, i] : a), []);
  const cF = idx(/vorname/), cL = idx(/nachname|^name$/), cLk = idx(/\blk\b|leistungsklasse/), cPay = idx(/geb(ü|ue)hr|zahl/), cSt = idx(/^status|zulassung/), cEv = idx(/konkurrenz|wettbewerb|^disziplin/);
  if (!cF.length || !cL.length) throw new Error('In der CSV fehlen die Spalten „Vorname“ und „Nachname“.');
  return lines.slice(hi + 1).map(split).map(r => {
    const g = (cols, k = 0) => (cols[k] !== undefined ? clean(r[cols[k]], 80) : '');
    const first = g(cF), last = g(cL);
    if (!first && !last) return null;
    const pf = g(cF, 1), pl = g(cL, 1);
    return { first, last, lk: lkText(g(cLk)), pay: /bar/i.test(cPay.map(i => r[i] || '').join(' ')) ? 'bar' : '', status: cSt.map(i => clean(r[i], 40)).filter(Boolean).join(' · ').toLowerCase(),
      event: g(cEv), partner: pf || pl ? { first: pf, last: pl, lk: lkText(g(cLk, 1)) } : null };
  }).filter(Boolean).slice(0, 2000);
}

/** Zählweise: Match-Tiebreak (Standard) oder dritter Satz voll (CT_LEGACY) */
const fullThird = scoring => !/MTB/i.test(String(scoring || 'MTB'));

module.exports = { parseXml, readTournament, readCsv, lkText, fullThird, when };
