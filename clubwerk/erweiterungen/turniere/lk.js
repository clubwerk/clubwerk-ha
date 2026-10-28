'use strict';
/* =====================================================================================================
   Modul „Turniere“ – zweiter Teil: LK-Turniertag mit nuLiga-Import (Stufe 1 aus planung/turniere.md)
   Angelegt, zugelassen, ausgelost und terminiert wird in nuLiga. Clubwerk liest die XML-Dateien (mehrere Turniere → ein
   Turniertag), optional die Meldeliste als CSV (genaue LK, „bar“), und übernimmt den Ablauf vor Ort:
   Check-in mit Nenngeld (eigener Kassenbericht, nicht die Verkaufskasse), Plätze (aus den nuLiga-Platznamen, je Platz
   optional ein Platz des Buchungssystems, der am Turniertag gesperrt wird), Turnierzentrale mit Warteschlange und
   Platzverteilung, Zeitplan mit nachrutschenden Folgespielen, Ergebnisse (Tablet oder Turnierleitung), Fernseher-Ansicht,
   Spielerseite per Zufallslink/QR (nur ansehen, über den Server der Mitglieder-App) und Ergebnisliste zum Abtippen in nuLiga.
   Erneuter Import gleicht über die nuLiga-IDs ab, ohne Check-in, Zahlungen und Ergebnisse zu verlieren.
   Datensparsam: nur Name, Verein, LK, Geschlecht, Geburtsjahr, IDs; fremde Spieler werden nach der Löschfrist anonymisiert.
   ===================================================================================================== */
const crypto = require('crypto');
const { today, addDays, deD, nowTs } = require('../../src/util');
const W = require('./lib/wertung');
const N = require('./lib/nuliga');
const Z = require('./lib/zeitplan');

const J = (v, d) => { try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };
const txt = (v, max = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const euro = c => `${(c / 100).toFixed(2).replace('.', ',')} €`;
const newToken = () => crypto.randomBytes(24).toString('base64url');   // 32 Zeichen, 192 Bit
const MINUTES = [45, 60, 75, 90, 105, 120];
const PAUSES = [0, 15, 30, 45, 60];
const KEEP = [7, 14, 30, 90, 365];

function activate(ctx, { P, ar, hook, bookingOn }) {
  const { db, bad, int, audit } = ctx;
  db.exec(`
CREATE TABLE IF NOT EXISTS tu_day (                                 -- Turniertag (ein oder mehrere nuLiga-Turniere)
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, date_from TEXT NOT NULL, date_to TEXT NOT NULL,
  club_no TEXT, sources TEXT NOT NULL DEFAULT '[]',                 -- [{ ext, name, file, at }]
  lock_from TEXT, lock_to TEXT, locked INTEGER NOT NULL DEFAULT 0,  -- Sperre im Buchungssystem
  finished_at TEXT, purged_at TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS tu_event (                               -- Konkurrenz
  id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER NOT NULL, ext TEXT NOT NULL, tournament TEXT, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'einzel',
  gender TEXT, age TEXT, fee_cents INTEGER NOT NULL DEFAULT 0, scoring TEXT, consolation TEXT, mode TEXT, sort INTEGER NOT NULL DEFAULT 0, gone INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tu_person (                              -- Spieler eines Turniertags (auch fremde Vereine) – keine Kontaktdaten
  id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER NOT NULL, ext TEXT, first TEXT, last TEXT NOT NULL, club TEXT, club_no TEXT, lk TEXT,
  gender TEXT, birth_year TEXT, dtb TEXT, own INTEGER NOT NULL DEFAULT 0, token TEXT,
  checked_in_at TEXT, absent INTEGER NOT NULL DEFAULT 0, pay_hint TEXT, paid TEXT, paid_cents INTEGER, paid_at TEXT, paid_by TEXT, gone INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tu_person_token ON tu_person(token);
CREATE INDEX IF NOT EXISTS ix_tu_person ON tu_person(day_id, ext);
CREATE TABLE IF NOT EXISTS tu_entry (                               -- Meldung (Einzel: p1, Doppel: p1 + p2)
  id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER NOT NULL, event_id INTEGER NOT NULL, ext TEXT NOT NULL, p1 INTEGER, p2 INTEGER,
  note TEXT, status TEXT, seed INTEGER, gone INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tu_court (
  id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER NOT NULL, name TEXT NOT NULL, resource_id INTEGER, auto INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0, manual INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tu_lkmatch (
  id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER NOT NULL, event_id INTEGER NOT NULL, ext TEXT NOT NULL, round TEXT, no INTEGER NOT NULL DEFAULT 0, grp INTEGER NOT NULL DEFAULT 0,
  a INTEGER, b INTEGER,                                             -- tu_entry.id (leer = steht noch nicht fest)
  plan_court TEXT, plan_time TEXT,                                  -- Planung aus nuLiga (Platzname, 'JJJJ-MM-TT HH:MM')
  court_id INTEGER, time TEXT,                                      -- aktuelle Planung am Turniertag
  started_at TEXT, ended_at TEXT, result TEXT, sets TEXT NOT NULL DEFAULT '[]', winner TEXT, retired TEXT, entered_by TEXT, entered_at TEXT,
  scoring TEXT, gone INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_tu_lkmatch ON tu_lkmatch(day_id, event_id);
`);
  const S = (k, d) => ctx.getSetting('ext_turniere_lk_' + k, d);
  const SET = (k, v) => ctx.setSetting('ext_turniere_lk_' + k, String(v));
  const pick = (list, v, d) => (list.includes(int(v)) ? int(v) : d);
  const cfg = () => ({ minutes: pick(MINUTES, S('minutes', '90'), 90), pause: pick(PAUSES, S('pause', '30'), 30), keep_days: pick(KEEP, S('keep_days', '30'), 30) });
  const uname = u => (typeof u === 'string' ? u : u ? u.name || u.username : '');
  const err = (msg, code = 400) => Object.assign(new Error(msg), { code });
  const send = fn => ar(async (req, res) => { try { res.json(await fn(req)); } catch (e) { bad(res, e.message, e.code || 400); } });

  /* ---------- Lesen ---------- */
  const dayRow = id => db.prepare('SELECT * FROM tu_day WHERE id = ?').get(int(id));
  const persons = did => db.prepare('SELECT * FROM tu_person WHERE day_id = ?').all(did);
  const events = did => db.prepare('SELECT * FROM tu_event WHERE day_id = ? ORDER BY sort, id').all(did);
  const entries = did => db.prepare('SELECT * FROM tu_entry WHERE day_id = ?').all(did);
  const courts = did => db.prepare('SELECT * FROM tu_court WHERE day_id = ? ORDER BY sort, id').all(did);
  const mrow = m => (m ? { ...m, sets: J(m.sets, []) } : m);
  const matches = did => db.prepare('SELECT * FROM tu_lkmatch WHERE day_id = ? ORDER BY id').all(did).map(mrow);
  const matchRow = id => mrow(db.prepare('SELECT * FROM tu_lkmatch WHERE id = ?').get(int(id)));
  /** laufender Turniertag: heute zwischen Beginn und Ende, nicht beendet */
  const todayDay = () => db.prepare('SELECT * FROM tu_day WHERE finished_at IS NULL AND date_from <= ? AND date_to >= ? ORDER BY date_from, id LIMIT 1').get(today(), today());
  const pname = p => (!p ? '?' : p.first ? `${p.last}, ${p.first}` : p.last);
  const pfull = p => (!p ? '?' : p.first ? `${p.first} ${p.last}` : p.last);
  const hm = s => (s ? String(s).slice(11, 16) : null);
  const roundLabel = m => `${m.grp ? 'Nebenrunde, ' : ''}Runde ${m.round || '?'}`;
  /** Zeitpunkt aus Tag + „HH:MM“ */
  const at = (date, time) => (date && isTime(time) ? `${date} ${time}` : null);

  /** alles, was die Ansichten brauchen → Hilfsobjekt mit Namen, Bereitschaft und Zeitplan */
  function load(day, { now = new Date() } = {}) {
    const ps = persons(day.id), pById = new Map(ps.map(p => [p.id, p]));
    const ev = events(day.id), eById = new Map(ev.map(e => [e.id, e]));
    const en = entries(day.id), enById = new Map(en.map(e => [e.id, e]));
    const cs = courts(day.id), cById = new Map(cs.map(c => [c.id, c]));
    const ms = matches(day.id).filter(m => !m.gone || m.result);
    const members = e => (e ? [e.p1, e.p2].filter(Boolean) : []);
    const ename = e => { if (!e) return null; const xs = members(e).map(id => pById.get(id)); return xs.length > 1 ? xs.map(p => (p ? p.last : '?')).join(' / ') : pname(xs[0]); };
    const eclub = e => { if (!e) return ''; return [...new Set(members(e).map(id => (pById.get(id) || {}).club).filter(Boolean))].join(' / '); };
    const playersOf = m => [...members(enById.get(m.a)), ...members(enById.get(m.b))];
    const sched = Z.schedule(ms.filter(m => !m.result || m.ended_at).map(m => ({ id: m.id, court: m.court_id, time: m.time, started_at: m.started_at, ended_at: m.ended_at, players: playersOf(m), sort: m.no })), { now, ...cfg() });
    const running = new Set(ms.filter(m => m.started_at && !m.ended_at && !m.result).flatMap(playersOf));
    const done = m => Boolean(m.result);
    /** warum ein Match (noch) nicht starten kann – leer = bereit */
    const waitReason = m => {
      if (!m.a || !m.b) return 'Paarung steht noch nicht fest';
      const xs = playersOf(m).map(id => pById.get(id));
      if (xs.some(p => p && p.absent)) return `abwesend: ${xs.filter(p => p && p.absent).map(pname).join('; ')}`;
      if (xs.some(p => p && running.has(p.id))) return `spielt noch: ${xs.filter(p => p && running.has(p.id)).map(pname).join('; ')}`;
      if (xs.some(p => p && !p.checked_in_at)) return `nicht eingecheckt: ${xs.filter(p => p && !p.checked_in_at).map(pname).join('; ')}`;
      return '';
    };
    const planCourt = name => cs.find(c => c.name === name) || null;
    const mv = m => {
      const e = eById.get(m.event_id), s = sched.get(m.id), c = cById.get(m.court_id), ea = enById.get(m.a), eb = enById.get(m.b);
      const pc = planCourt(m.plan_court);
      const moved = !done(m) && !m.started_at && ((pc ? pc.id : null) !== (m.court_id || null) || (m.plan_time || null) !== (m.time || null));
      return { id: m.id, event_id: m.event_id, event: e ? e.name : '?', kind: e ? e.kind : 'einzel', round: m.round, no: m.no, grp: m.grp, roundLabel: roundLabel(m),
        a: ename(ea), b: ename(eb), a_id: m.a, b_id: m.b, a_club: eclub(ea), b_club: eclub(eb), notes: [ea, eb].filter(x => x && x.note).map(x => `${ename(x)}: ${x.note}`),
        court_id: m.court_id || null, court: c ? c.name : null, date: m.time ? m.time.slice(0, 10) : (m.plan_time || '').slice(0, 10) || day.date_from, time: hm(m.time),
        plan_court: m.plan_court || null, plan_time: hm(m.plan_time), moved, est: s ? hm(s.start) : null, est_at: s ? s.start : m.time || m.plan_time || null, est_end: s ? hm(s.end) : null, delay: s && !done(m) ? s.delay : 0,
        started_at: m.started_at, ended_at: m.ended_at, minutes: m.started_at && !m.ended_at ? Math.max(0, Math.round((now.getTime() - Date.parse(m.started_at.replace(' ', 'T'))) / 60000)) : null,
        running: Boolean(m.started_at && !m.ended_at && !done(m)), done: done(m), result: m.result, sets: m.sets, winner: m.winner, retired: m.retired, score: W.scoreText(m),
        entered_by: m.entered_by, full: N.fullThird(m.scoring || (e && e.scoring)), wait: done(m) ? '' : waitReason(m), players: playersOf(m), gone: Boolean(m.gone) };
    };
    const mvs = ms.map(mv);
    const byEst = (x, y) => String(x.est_at || '9999').localeCompare(String(y.est_at || '9999')) || x.no - y.no || x.id - y.id;
    return { day, ps, pById, ev, eById, en, enById, cs, cById, ms, mvs, members, ename, byEst, playersOf };
  }

  /* ---------- Turnierzentrale: je Platz laufendes und nächstes Match, Warteschlange ---------- */
  function central(L) {
    const open = L.mvs.filter(m => !m.done);
    const courtsV = L.cs.map(c => {
      const mine = open.filter(m => m.court_id === c.id);
      const run = mine.find(m => m.running) || null;
      const next = mine.filter(m => !m.running).sort(L.byEst)[0] || null;
      return { id: c.id, name: c.name, auto: Boolean(c.auto), resource_id: c.resource_id || null, running: run, next, later: mine.filter(m => !m.running && m !== next).length };
    });
    const queue = open.filter(m => !m.court_id).sort(L.byEst);
    return { courts: courtsV, queue };
  }
  /** Kassenbericht: Nenngeld je Person (Summe der Konkurrenzen), bar/digital/offen */
  function money(L) {
    const fee = new Map();
    for (const e of L.en.filter(x => !x.gone)) { const ev = L.eById.get(e.event_id); for (const p of L.members(e)) fee.set(p, (fee.get(p) || 0) + (ev ? ev.fee_cents : 0)); }
    const rows = L.ps.filter(p => !p.gone || p.paid).map(p => ({ id: p.id, fee: p.paid ? p.paid_cents || 0 : fee.get(p.id) || 0, paid: p.paid }));
    const sum = f => rows.filter(f).reduce((a, r) => a + r.fee, 0);
    return { fee, report: { total: sum(() => true), bar: sum(r => r.paid === 'bar'), digital: sum(r => r.paid === 'digital'), open: sum(r => !r.paid), paidCount: rows.filter(r => r.paid && r.fee).length, openCount: rows.filter(r => !r.paid && r.fee).length } };
  }
  /** Personenliste für Check-in (Verwaltung und Tablet) */
  function people(L, fee) {
    const firstMatch = new Map();
    for (const m of L.mvs.filter(x => !x.done)) for (const p of m.players) { const t = m.est_at; if (t && (!firstMatch.has(p) || t < firstMatch.get(p))) firstMatch.set(p, t); }
    const evOf = new Map();
    for (const e of L.en.filter(x => !x.gone)) for (const p of L.members(e)) { const ev = L.eById.get(e.event_id); evOf.set(p, [...(evOf.get(p) || []), ev ? ev.name : '?']); }
    const notes = new Map();
    for (const e of L.en.filter(x => !x.gone && x.note)) for (const p of L.members(e)) notes.set(p, [...(notes.get(p) || []), e.note]);
    return L.ps.filter(p => !p.gone || p.paid || p.checked_in_at).map(p => ({ id: p.id, name: pname(p), first: p.first, last: p.last, club: p.club || '', lk: p.lk || '', own: Boolean(p.own), events: evOf.get(p.id) || [], notes: notes.get(p.id) || [],
      checked_in: Boolean(p.checked_in_at), checked_at: p.checked_in_at, absent: Boolean(p.absent), fee: p.paid ? p.paid_cents || 0 : fee.get(p.id) || 0, paid: p.paid || null, pay_hint: p.pay_hint || null, first_match: firstMatch.get(p.id) || null, gone: Boolean(p.gone) }))
      .sort((x, y) => x.name.localeCompare(y.name, 'de'));
  }
  const dayView = d => ({ id: d.id, name: d.name, date_from: d.date_from, date_to: d.date_to, finished_at: d.finished_at, purged_at: d.purged_at, locked: Boolean(d.locked), lock_from: d.lock_from, lock_to: d.lock_to, sources: J(d.sources, []), today: d.date_from <= today() && d.date_to >= today() });

  /* ---------- Import ---------- */
  /** Dateien lesen: XML (je Turnier) und CSV (Meldeliste) → { tours: [readTournament], csv: [rows], files: [name] } */
  function readFiles(files) {
    if (!Array.isArray(files) || !files.length) throw err('Bitte mindestens eine Datei aus nuLiga wählen.');
    if (files.length > 8) throw err('Höchstens 8 Dateien auf einmal.');
    const tours = [], csv = [], names = [];
    for (const f of files) {
      const name = txt(f && f.name, 120), buf = Buffer.from(String((f && f.data) || ''), 'base64');
      const head = buf.slice(0, 400).toString('latin1').trimStart();
      try {
        if (/\.xml$/i.test(name) || head.startsWith('<')) tours.push({ ...N.readTournament(buf), file: name });
        else if (/\.(csv|txt)$/i.test(name) || /;/.test(head)) csv.push(...N.readCsv(buf));
        else throw new Error('Unbekanntes Format – bitte die XML-Datei (Turnier-Export) oder die CSV-Meldeliste aus nuLiga nehmen.');
      } catch (e) { throw err(`${name || 'Datei'}: ${e.message}`); }
      names.push(name);
    }
    if (!tours.length) throw err('Bitte die XML-Datei des Turniers mitnehmen – die CSV ergänzt nur LK und Zahlungsart.');
    const ids = tours.map(t => t.tournament.ext || t.tournament.name);
    if (new Set(ids).size !== ids.length) throw err('Dasselbe Turnier ist doppelt dabei.');
    return { tours, csv, files: names };
  }
  const key = (t, x) => `${t.tournament.ext || t.tournament.name}:${x}`;
  /** Ziel-Stand aus den Dateien (über alle Turniere) */
  function target(tours, csv) {
    const P = new Map(), E = [], EN = [], M = [], warn = [];
    const clubNo = tours.map(t => t.clubNo).find(Boolean) || '';
    for (const t of tours) for (const p of t.persons) if (!P.has(p.ext)) P.set(p.ext, { ...p, pay_hint: null });
    // CSV: genaue LK und „bar“ – Zuordnung über den Namen (die CSV hat keine nuLiga-ID)
    const nk = (f, l) => `${String(f || '').toLowerCase().trim()}|${String(l || '').toLowerCase().trim()}`;
    const byName = new Map([...P.values()].map(p => [nk(p.first, p.last), p]));
    let csvHit = 0;
    for (const r of csv) for (const x of [r, r.partner].filter(Boolean)) {
      const p = byName.get(nk(x.first, x.last)); if (!p) continue;
      csvHit++;
      if (x.lk && (!p.lk || x.lk.split(',')[0] === p.lk.split(',')[0])) p.lk = x.lk;
      if (x === r && r.pay === 'bar') p.pay_hint = 'bar';
    }
    if (csv.length && !csvHit) warn.push('Die CSV passt zu keinem Spieler der XML-Dateien – LK und Zahlungsart daraus wurden nicht übernommen.');
    tours.forEach((t, ti) => t.events.forEach((ev, ei) => {
      const ek = key(t, ev.ext);
      E.push({ ext: ek, tournament: t.tournament.name, name: ev.name, kind: ev.kind, gender: ev.gender, age: ev.age, fee_cents: ev.fee, scoring: ev.scoring, consolation: ev.consolation, mode: ev.mode, sort: ti * 100 + ei });
      for (const e of ev.entries) EN.push({ ext: key(t, e.ext), event: ek, persons: e.persons, note: e.note, status: e.status, seed: e.seed });
      for (const m of ev.matches) M.push({ ext: key(t, m.ext), event: ek, round: m.round, no: m.no, grp: m.group, a: m.a ? key(t, m.a) : null, b: m.b ? key(t, m.b) : null,
        plan_court: m.court || null, plan_time: at(m.date, m.time), scoring: m.scoring, result: m.result, sets: m.sets, winner: m.winner, retired: m.retired });
    }));
    const dates = tours.flatMap(t => [t.tournament.from, t.tournament.to]).filter(Boolean).sort();
    return { P, E, EN, M, clubNo, warn, from: dates[0] || today(), to: dates[dates.length - 1] || today(), name: tours.map(t => t.tournament.name).join(' / ').slice(0, 120),
      skipped: tours.flatMap(t => t.skipped), unknown: [...new Set(tours.flatMap(t => t.unknown))], sources: tours.map(t => ({ ext: t.tournament.ext, name: t.tournament.name, file: t.file, at: nowTs() })) };
  }
  /** Unterschiede zum gespeicherten Stand (für die Vorschau beim erneuten Import) */
  function diff(day, T) {
    const out = { persons: { neu: [], geaendert: [], weg: [] }, events: { neu: [], weg: [] }, entries: { neu: 0, weg: 0 }, matches: { neu: 0, geaendert: [], weg: [] } };
    if (!day) { out.persons.neu = [...T.P.values()].map(p => `${p.last}, ${p.first}`); out.events.neu = T.E.map(e => e.name); out.entries.neu = T.EN.length; out.matches.neu = T.M.length; return out; }
    const pre = new Set(T.sources.map(s => `${s.ext || s.name}:`)), mine = x => [...pre].some(p => String(x.ext || '').startsWith(p));   // nur die neu eingelesenen Turniere vergleichen
    const elsewhere = new Set(entries(day.id).filter(e => !mine(e) && !e.gone).flatMap(e => [e.p1, e.p2]).filter(Boolean));
    const ps = persons(day.id).filter(p => p.ext), pByExt = new Map(ps.map(p => [p.ext, p]));
    for (const p of T.P.values()) {
      const o = pByExt.get(p.ext);
      if (!o) { out.persons.neu.push(`${p.last}, ${p.first}`); continue; }
      const ch = [];
      if (o.first !== p.first || o.last !== p.last) ch.push(`Name: ${pname(o)} → ${p.last}, ${p.first}`);
      if ((o.club || '') !== (p.club || '')) ch.push(`Verein: ${o.club || '–'} → ${p.club || '–'}`);
      if ((o.lk || '') !== (p.lk || '') && !(p.lk && o.lk && o.lk.startsWith(p.lk + ','))) ch.push(`LK ${o.lk || '–'} → ${p.lk || '–'}`);
      if (ch.length) out.persons.geaendert.push(`${pname(o)}: ${ch.join(', ')}`);
    }
    for (const o of ps) if (!o.gone && !T.P.has(o.ext) && !elsewhere.has(o.id)) out.persons.weg.push(`${pname(o)}${o.checked_in_at || o.paid ? ' (eingecheckt/bezahlt – bleibt in der Liste)' : ''}`);
    const evs = events(day.id), evExt = new Set(evs.map(e => e.ext));
    out.events.neu = T.E.filter(e => !evExt.has(e.ext)).map(e => e.name);
    out.events.weg = evs.filter(e => mine(e) && !e.gone && !T.E.some(x => x.ext === e.ext)).map(e => e.name);
    const ens = entries(day.id), enExt = new Set(ens.map(e => e.ext));
    out.entries.neu = T.EN.filter(e => !enExt.has(e.ext)).length;
    out.entries.weg = ens.filter(e => mine(e) && !e.gone && !T.EN.some(x => x.ext === e.ext)).length;
    const L = load(day), mByExt = new Map(matches(day.id).map(m => [m.ext, m]));
    const enKey = new Map(ens.map(e => [e.id, e.ext]));
    const label = (m, e) => `${(L.eById.get(m.event_id) || {}).name || e || ''}, ${roundLabel(m)} Nr. ${m.no}`;
    for (const m of T.M) {
      const o = mByExt.get(m.ext);
      if (!o) { out.matches.neu++; continue; }
      const ch = [];
      if ((o.plan_court || null) !== (m.plan_court || null) || (o.plan_time || null) !== (m.plan_time || null)) ch.push(`Planung ${o.plan_court || '–'} ${hm(o.plan_time) || ''} → ${m.plan_court || '–'} ${hm(m.plan_time) || ''}`.replace(/\s+/g, ' '));
      if (!o.result && ((m.a && enKey.get(o.a) !== m.a) || (m.b && enKey.get(o.b) !== m.b))) ch.push('neue Paarung');
      if (ch.length) out.matches.geaendert.push(`${label(o)}: ${ch.join(', ')}`);
    }
    for (const o of matches(day.id)) if (mine(o) && !o.gone && !T.M.some(x => x.ext === o.ext)) out.matches.weg.push(`${label(o)}${o.result || o.started_at ? ' (schon gespielt – bleibt stehen)' : ''}`);
    return out;
  }
  /** übernehmen: neu anlegen oder abgleichen – Check-in, Zahlungen, Ergebnisse und Umplanungen bleiben */
  function apply(day, T, user) {
    let id = day ? day.id : null;
    db.transaction(() => {
      if (!day) {
        id = Number(db.prepare('INSERT INTO tu_day(name, date_from, date_to, club_no, sources, created_by) VALUES (?,?,?,?,?,?)').run(T.name || 'Turniertag', T.from, T.to, T.clubNo || null, JSON.stringify(T.sources), uname(user)).lastInsertRowid);
      } else {
        const src = J(day.sources, []).filter(s => !T.sources.some(x => x.ext === s.ext)).concat(T.sources);
        db.prepare('UPDATE tu_day SET date_from = MIN(date_from, ?), date_to = MAX(date_to, ?), club_no = COALESCE(club_no, ?), sources = ? WHERE id = ?').run(T.from, T.to, T.clubNo || null, JSON.stringify(src), id);
      }
      const clubNo = (dayRow(id).club_no || '').trim();
      /* Personen */
      const pByExt = new Map(persons(id).filter(p => p.ext).map(p => [p.ext, p]));
      for (const p of T.P.values()) {
        const o = pByExt.get(p.ext), own = clubNo && p.clubNo === clubNo ? 1 : 0;
        if (o && o.lk && p.lk && !p.lk.includes(',') && o.lk.split(',')[0] === p.lk) p.lk = o.lk;   // genaue LK aus einer früheren CSV bleibt, solange nuLiga dieselbe ganze Zahl meldet
        if (o) db.prepare('UPDATE tu_person SET first = ?, last = ?, club = ?, club_no = ?, lk = ?, gender = ?, birth_year = ?, dtb = ?, own = ?, pay_hint = COALESCE(?, pay_hint), gone = 0 WHERE id = ?')
          .run(p.first, p.last, p.club || null, p.clubNo || null, p.lk || null, p.gender || null, p.birthYear || null, p.dtb || null, own, p.pay_hint, o.id);
        else db.prepare('INSERT INTO tu_person(day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, pay_hint) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(id, p.ext, p.first, p.last, p.club || null, p.clubNo || null, p.lk || null, p.gender || null, p.birthYear || null, p.dtb || null, own, newToken(), p.pay_hint);
      }
      const pid = new Map(persons(id).filter(p => p.ext).map(p => [p.ext, p.id]));
      /* Konkurrenzen */
      const evByExt = new Map(events(id).map(e => [e.ext, e]));
      for (const e of T.E) {
        const o = evByExt.get(e.ext);
        if (o) db.prepare('UPDATE tu_event SET tournament = ?, name = ?, kind = ?, gender = ?, age = ?, fee_cents = ?, scoring = ?, consolation = ?, mode = ?, sort = ?, gone = 0 WHERE id = ?').run(e.tournament, e.name, e.kind, e.gender || null, e.age || null, e.fee_cents, e.scoring || null, e.consolation || null, e.mode || null, e.sort, o.id);
        else db.prepare('INSERT INTO tu_event(day_id, ext, tournament, name, kind, gender, age, fee_cents, scoring, consolation, mode, sort) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id, e.ext, e.tournament, e.name, e.kind, e.gender || null, e.age || null, e.fee_cents, e.scoring || null, e.consolation || null, e.mode || null, e.sort);
      }
      const eid = new Map(events(id).map(e => [e.ext, e.id]));
      /* Meldungen */
      const enByExt = new Map(entries(id).map(e => [e.ext, e]));
      for (const e of T.EN) {
        const [p1, p2] = e.persons.map(x => pid.get(x) || null);
        const o = enByExt.get(e.ext);
        if (o) db.prepare('UPDATE tu_entry SET event_id = ?, p1 = ?, p2 = ?, note = ?, status = ?, seed = ?, gone = 0 WHERE id = ?').run(eid.get(e.event), p1, p2 || null, e.note || null, e.status || null, e.seed, o.id);
        else db.prepare('INSERT INTO tu_entry(day_id, event_id, ext, p1, p2, note, status, seed) VALUES (?,?,?,?,?,?,?,?)').run(id, eid.get(e.event), e.ext, p1, p2 || null, e.note || null, e.status || null, e.seed);
      }
      const enid = new Map(entries(id).map(e => [e.ext, e.id]));
      /* Plätze aus den Platznamen */
      const cs = courts(id);
      const names = [...new Set(T.M.map(m => m.plan_court).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'de', { numeric: true }));
      let sort = cs.reduce((a, c) => Math.max(a, c.sort), 0);
      for (const n of names) if (!cs.some(c => c.name === n)) db.prepare('INSERT INTO tu_court(day_id, name, sort) VALUES (?,?,?)').run(id, n, ++sort);
      const cByName = new Map(courts(id).map(c => [c.name, c.id]));
      /* Matches: Planung aus nuLiga übernehmen; was am Turniertag umgeplant, gestartet oder gewertet ist, bleibt */
      const mByExt = new Map(matches(id).map(m => [m.ext, m]));
      for (const m of T.M) {
        const o = mByExt.get(m.ext), a = m.a ? enid.get(m.a) || null : null, b = m.b ? enid.get(m.b) || null : null;
        const r = m.result ? { result: m.result, sets: JSON.stringify(m.sets || []), winner: m.winner, retired: m.retired || null } : null;
        if (!o) {
          db.prepare('INSERT INTO tu_lkmatch(day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, scoring, result, sets, winner, retired, entered_by, entered_at, ended_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .run(id, eid.get(m.event), m.ext, m.round || null, m.no, m.grp, a, b, m.plan_court, m.plan_time, cByName.get(m.plan_court) || null, m.plan_time, m.scoring || null,
              r ? r.result : null, r ? r.sets : '[]', r ? r.winner : null, r ? r.retired : null, r ? 'nuLiga' : null, r ? nowTs() : null, r ? nowTs() : null);
          continue;
        }
        const untouched = !o.started_at && !o.result && (o.court_id || null) === (cByName.get(o.plan_court) || null) && (o.time || null) === (o.plan_time || null);
        db.prepare('UPDATE tu_lkmatch SET event_id = ?, round = ?, no = ?, grp = ?, plan_court = ?, plan_time = ?, scoring = ?, gone = 0 WHERE id = ?').run(eid.get(m.event), m.round || null, m.no, m.grp, m.plan_court, m.plan_time, m.scoring || null, o.id);
        if (untouched) db.prepare('UPDATE tu_lkmatch SET court_id = ?, time = ? WHERE id = ?').run(cByName.get(m.plan_court) || null, m.plan_time, o.id);
        if (!o.result && (a || b)) db.prepare('UPDATE tu_lkmatch SET a = COALESCE(?, a), b = COALESCE(?, b) WHERE id = ?').run(a, b, o.id);
        if (!o.result && r) db.prepare("UPDATE tu_lkmatch SET result = ?, sets = ?, winner = ?, retired = ?, entered_by = 'nuLiga', entered_at = ?, ended_at = COALESCE(ended_at, ?) WHERE id = ?").run(r.result, r.sets, r.winner, r.retired, nowTs(), nowTs(), o.id);
      }
      /* Weggefallenes: löschen, wenn nichts daran hängt – sonst als „nicht mehr in nuLiga“ markieren */
      if (day) {
        const sources = new Set(T.sources.map(s => `${s.ext || s.name}:`));
        const mine = x => [...sources].some(p => String(x.ext || '').startsWith(p));   // nur Daten der neu eingelesenen Turniere abgleichen
        for (const o of matches(id).filter(x => mine(x) && !T.M.some(m => m.ext === x.ext))) {
          if (o.result || o.started_at) db.prepare('UPDATE tu_lkmatch SET gone = 1 WHERE id = ?').run(o.id); else db.prepare('DELETE FROM tu_lkmatch WHERE id = ?').run(o.id);
        }
        const usedE = new Set(matches(id).flatMap(m => [m.a, m.b]).filter(Boolean));
        for (const o of entries(id).filter(x => mine(x) && !T.EN.some(e => e.ext === x.ext))) {
          if (usedE.has(o.id)) db.prepare('UPDATE tu_entry SET gone = 1 WHERE id = ?').run(o.id); else db.prepare('DELETE FROM tu_entry WHERE id = ?').run(o.id);
        }
        for (const o of events(id).filter(x => mine(x) && !T.E.some(e => e.ext === x.ext))) {
          if (matches(id).some(m => m.event_id === o.id) || entries(id).some(e => e.event_id === o.id)) db.prepare('UPDATE tu_event SET gone = 1 WHERE id = ?').run(o.id); else db.prepare('DELETE FROM tu_event WHERE id = ?').run(o.id);
        }
        const inEntry = new Set(entries(id).flatMap(e => [e.p1, e.p2]).filter(Boolean)), allExt = new Set(T.P.keys());
        for (const o of persons(id).filter(p => p.ext && !allExt.has(p.ext) && !inEntry.has(p.id))) {
          if (o.checked_in_at || o.paid) db.prepare('UPDATE tu_person SET gone = 1 WHERE id = ?').run(o.id); else db.prepare('DELETE FROM tu_person WHERE id = ?').run(o.id);
        }
      }
    })();
    return id;
  }

  /* ---------- Sperre im Buchungssystem ---------- */
  /** gewünschte Sperren: jeder zugeordnete Platz an jedem Turniertag von lock_from bis lock_to */
  function wantedLocks(day) {
    if (!day.locked || day.finished_at) return [];
    const out = [], cs = courts(day.id).filter(c => c.resource_id);
    for (let d = day.date_from; d <= day.date_to; d = addDays(d, 1)) for (const c of cs) out.push({ resource_id: c.resource_id, date: d, start: day.lock_from || '08:00', end: day.lock_to || '22:00' });
    return out;
  }
  async function syncLocks(day, by, preview = false) {
    if (!bookingOn()) return { made: 0, removed: 0, conflicts: [] };
    const r = await hook('courtLock', { key: `tu:lk:${day.id}`, locks: wantedLocks(day), title: `Turnier: ${day.name}`.slice(0, 160), by, preview });
    if (r && r.error) throw err(r.error);
    return r || { made: 0, removed: 0, conflicts: [] };
  }
  /** Vorschlag für die Sperrzeit: volle Stunde vor dem ersten Match bis eine Stunde nach dem voraussichtlichen Ende des letzten */
  function lockSuggest(day) {
    const ts = matches(day.id).map(m => m.time || m.plan_time).filter(Boolean).map(t => t.slice(11, 16)).sort();
    if (!ts.length) return { from: '08:00', to: '20:00' };
    const h = t => +t.slice(0, 2), m = cfg().minutes;
    const end = Math.min(24, h(ts[ts.length - 1]) + Math.ceil((+ts[ts.length - 1].slice(3, 5) + m) / 60) + 1);
    return { from: `${String(Math.max(0, h(ts[0]) - 1)).padStart(2, '0')}:00`, to: end >= 24 ? '24:00' : `${String(end).padStart(2, '0')}:00` };
  }

  /* ---------- Matches ---------- */
  const mLabel = (L, m) => `${(L.eById.get(m.event_id) || {}).name || ''}, ${roundLabel(m)} Nr. ${m.no}: ${L.ename(L.enById.get(m.a)) || '?'} – ${L.ename(L.enById.get(m.b)) || '?'}`;
  /** Ergebnis speichern (Tablet: nur ohne Ergebnis; Turnierleitung: auch korrigieren oder löschen) */
  function saveResult(m, input, { by, admin }) {
    const day = dayRow(m.day_id);
    if (day.finished_at) throw err('Das Turnier ist beendet.');
    if (!m.a || !m.b) throw err('Die Paarung steht noch nicht fest.');
    const L = load(day), was = m.result ? W.scoreText(m) : '–';
    if (!admin && m.result) throw err('Für dieses Match steht schon ein Ergebnis – Korrekturen macht die Turnierleitung.');
    let r;
    if (admin && input && input.clear) r = { result: null, sets: [], winner: null, retired: null };
    else { r = W.checkResult(input || {}, { full: N.fullThird(m.scoring || (L.eById.get(m.event_id) || {}).scoring) }); if (r.result === 'ausgefallen') throw err('Bitte „gespielt“, „kampflos“ oder „Aufgabe“ wählen.'); }
    db.prepare('UPDATE tu_lkmatch SET result = ?, sets = ?, winner = ?, retired = ?, entered_by = ?, entered_at = ?, ended_at = ? WHERE id = ?')
      .run(r.result, JSON.stringify(r.sets), r.winner, r.retired || null, r.result ? uname(by) : null, r.result ? nowTs() : null, r.result ? m.ended_at || nowTs() : null, m.id);
    const now = matchRow(m.id);
    audit(admin ? by : { username: 'tablet', name: 'Tablet' }, m.result ? 'Turniere: Ergebnis korrigiert' : 'Turniere: Ergebnis eingetragen', `${day.name} – ${mLabel(L, m)}: ${m.result ? `${was} → ` : ''}${now.result ? W.scoreText(now) : '–'}`);
    return { ok: true };
  }
  function startMatch(m, by, admin) {
    const day = dayRow(m.day_id);
    if (day.finished_at) throw err('Das Turnier ist beendet.');
    if (m.result) throw err('Dieses Match ist schon gewertet.');
    if (m.started_at) throw err('Dieses Match läuft schon.');
    if (!m.a || !m.b) throw err('Die Paarung steht noch nicht fest.');
    if (!m.court_id) throw err('Bitte erst einen Platz zuweisen.');
    const L = load(day), v = L.mvs.find(x => x.id === m.id);
    if (L.mvs.some(x => x.running && x.court_id === m.court_id)) throw err(`Auf ${L.cById.get(m.court_id).name} läuft noch ein Match – erst dessen Ergebnis eintragen.`);
    if (v.wait && /^spielt noch/.test(v.wait)) throw err(`Geht noch nicht – ${v.wait}.`);
    if (!admin && v.wait) throw err(`Geht noch nicht – ${v.wait}. Bitte bei der Turnierleitung melden.`);
    db.prepare('UPDATE tu_lkmatch SET started_at = ? WHERE id = ?').run(nowTs(), m.id);
    audit(admin ? by : { username: 'tablet', name: 'Tablet' }, 'Turniere: Match gestartet', `${day.name} – ${mLabel(L, m)} auf ${L.cById.get(m.court_id).name}`);
    return { ok: true };
  }
  /** Platz und Uhrzeit von Hand (court_id null = Warteschlange) */
  function assign(m, b, by) {
    const day = dayRow(m.day_id);
    if (m.result || m.started_at) throw err('Gestartete oder gewertete Matches lassen sich nicht mehr verlegen.');
    const cid = b.court_id === null || b.court_id === '' || b.court_id === undefined ? null : int(b.court_id);
    if (cid && !courts(day.id).some(c => c.id === cid)) throw err('Diesen Platz gibt es nicht.');
    if (b.time && !isTime(b.time)) throw err('Bitte die Uhrzeit prüfen (z. B. 14:30).');
    const date = (m.time || m.plan_time || day.date_from).slice(0, 10);
    const L = load(day);
    db.prepare('UPDATE tu_lkmatch SET court_id = ?, time = ? WHERE id = ?').run(cid, b.time ? at(date, b.time) : cid ? m.time : null, m.id);
    audit(by, 'Turniere: Match verlegt', `${day.name} – ${mLabel(L, m)}: ${cid ? L.cById.get(cid).name : 'Warteschlange'}${b.time ? ` ${b.time} Uhr` : ''}`);
  }
  /** freie Plätze automatisch belegen: bereite Matches aus der Warteschlange oder von belegten Plätzen */
  function autoDistribute(day, by) {
    const moved = [];
    for (let k = 0; k < 60; k++) {
      const L = load(day), C = central(L);
      const free = C.courts.filter(c => c.auto && !c.running && !(c.next && !c.next.wait));
      if (!free.length) break;
      const nextIds = new Set(C.courts.filter(c => c.next && !c.next.wait && !c.running).map(c => c.next.id));
      const cand = L.mvs.filter(m => !m.done && !m.running && !m.wait && m.date === today() && !nextIds.has(m.id) && !(m.court_id && free.some(c => c.id === m.court_id))).sort(L.byEst)[0];
      if (!cand) break;
      const c = free[0], now = new Date();
      db.prepare('UPDATE tu_lkmatch SET court_id = ?, time = ? WHERE id = ?').run(c.id, at(today(), `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`), cand.id);
      moved.push(`${cand.event} Nr. ${cand.no} → ${c.name}`);
    }
    if (moved.length) audit(by, 'Turniere: Plätze automatisch verteilt', `${day.name}: ${moved.join('; ')}`.slice(0, 500));
    return moved;
  }

  /* ---------- Löschfrist für fremde Spieler ---------- */
  function purge() {
    if (!ctx.isActive()) return;
    const limit = addDays(today(), -cfg().keep_days);
    for (const d of db.prepare('SELECT * FROM tu_day WHERE purged_at IS NULL AND date_to < ?').all(limit)) {
      db.transaction(() => {
        const n = db.prepare("UPDATE tu_person SET first = NULL, last = 'gelöscht', club = NULL, club_no = NULL, lk = NULL, gender = NULL, birth_year = NULL, dtb = NULL, ext = NULL, token = NULL WHERE day_id = ? AND own = 0").run(d.id).changes;
        db.prepare('UPDATE tu_person SET token = NULL WHERE day_id = ?').run(d.id);
        db.prepare('UPDATE tu_entry SET note = NULL WHERE day_id = ?').run(d.id);
        db.prepare('UPDATE tu_day SET purged_at = ? WHERE id = ?').run(nowTs(), d.id);
        audit(null, 'Turniere: Spielerdaten gelöscht', `${d.name}: ${n} Spieler fremder Vereine (Löschfrist ${cfg().keep_days} Tage)`);
      })();
    }
  }
  setInterval(() => { try { purge(); } catch (e) { console.error('Turniere – Löschfrist:', e.message); } }, process.env.CW_TEST_FAST ? 2000 : 3600000).unref();
  setTimeout(() => { try { purge(); } catch (e) { console.error('Turniere – Löschfrist:', e.message); } }, 10000).unref();

  /* ================================================================= Verwaltung (/api/admin/x/turniere/lk/…) */
  const A = ctx.admin;
  const dayOr404 = id => { const d = dayRow(id); if (!d) throw err('Turniertag nicht gefunden.', 404); return d; };
  const matchOr404 = id => { const m = matchRow(id); if (!m) throw err('Match nicht gefunden.', 404); return m; };
  const personOr404 = id => { const p = db.prepare('SELECT * FROM tu_person WHERE id = ?').get(int(id)); if (!p) throw err('Spieler nicht gefunden.', 404); return p; };
  /** volle Ansicht eines Turniertags für die Verwaltung */
  function adminView(day) {
    const L = load(day), { fee, report } = money(L);
    return { day: dayView(day), now: nowTs(), cfg: cfg(), booking: bookingOn(), events: L.ev.filter(e => !e.gone || L.mvs.some(m => m.event_id === e.id)).map(e => ({ id: e.id, name: e.name, tournament: e.tournament, kind: e.kind, fee: e.fee_cents, entries: L.en.filter(x => x.event_id === e.id && !x.gone).length })),
      courts: L.cs.map(c => ({ id: c.id, name: c.name, resource_id: c.resource_id || null, auto: Boolean(c.auto), manual: Boolean(c.manual), used: L.mvs.some(m => m.court_id === c.id) })),
      matches: L.mvs.sort(L.byEst), central: central(L), people: people(L, fee), kasse: report, lockSuggest: lockSuggest(day),
      entries: L.en.filter(e => !e.gone).map(e => ({ id: e.id, event_id: e.event_id, name: L.ename(e) })) };
  }
  A.get('/lk/tage', P, (req, res) => res.json(db.prepare('SELECT id, name, date_from, date_to, finished_at FROM tu_day ORDER BY date_from DESC, id DESC').all()));
  A.get('/lk/tag/:id', P, send(async req => adminView(dayOr404(req.params.id))));
  A.post('/lk/import', P, send(async req => {
    const b = req.body || {}, day = b.day_id ? dayOr404(b.day_id) : null;
    if (day && day.finished_at) throw err('Der Turniertag ist beendet.');
    const F = readFiles(b.files), T = target(F.tours, F.csv);
    if (!T.P.size) throw err('In den Dateien stehen keine Meldungen.');
    if (b.preview) return { new: !day, name: T.name, from: T.from, to: T.to, files: F.files, tournaments: T.sources.map(s => s.name), counts: { persons: T.P.size, events: T.E.length, entries: T.EN.length, matches: T.M.length, courts: new Set(T.M.map(m => m.plan_court).filter(Boolean)).size },
      skipped: T.skipped, unknown: T.unknown, warnings: T.warn, csv: F.csv.length, diff: diff(day, T) };
    const id = apply(day, T, req.user);
    const d = dayRow(id);
    audit(req.user, day ? 'Turniere: nuLiga erneut importiert' : 'Turniere: Turniertag importiert', `${d.name}: ${T.P.size} Spieler, ${T.E.length} Konkurrenzen, ${T.M.length} Matches (${F.files.join(', ')})${T.skipped.length ? ` · übersprungen: ${T.skipped.join(', ')}` : ''}`.slice(0, 500));
    if (d.locked) await syncLocks(d, req.user).catch(() => {});
    return { ok: true, id };
  }));
  A.put('/lk/tag/:id', P, send(async req => {
    const d = dayOr404(req.params.id), name = txt((req.body || {}).name, 120);
    if (name.length < 3) throw err('Bitte einen Namen eintragen.');
    db.prepare('UPDATE tu_day SET name = ? WHERE id = ?').run(name, d.id);
    const diffT = ctx.auditDiff({ name: 'Name' }, { name: d.name }, { name });
    if (diffT) audit(req.user, 'Turniere: Turniertag geändert', diffT);
    return { ok: true };
  }));
  A.delete('/lk/tag/:id', P, send(async req => {
    const d = dayOr404(req.params.id);
    if (d.locked) await syncLocks({ ...d, locked: 0 }, req.user).catch(() => {});
    db.transaction(() => { for (const t of ['tu_lkmatch', 'tu_court', 'tu_entry', 'tu_person', 'tu_event']) db.prepare(`DELETE FROM ${t} WHERE day_id = ?`).run(d.id); db.prepare('DELETE FROM tu_day WHERE id = ?').run(d.id); })();
    audit(req.user, 'Turniere: Turniertag gelöscht', d.name);
    return { ok: true };
  }));
  /** Turnier beenden (Spieler-Links laufen ab, Sperren fallen weg) bzw. wieder öffnen */
  A.post('/lk/tag/:id/beenden', P, send(async req => {
    const d = dayOr404(req.params.id), undo = Boolean((req.body || {}).undo);
    db.prepare('UPDATE tu_day SET finished_at = ? WHERE id = ?').run(undo ? null : nowTs(), d.id);
    await syncLocks(dayRow(d.id), req.user).catch(() => {});
    audit(req.user, undo ? 'Turniere: Turnier wieder geöffnet' : 'Turniere: Turnier beendet', d.name);
    return { ok: true };
  }));
  /* Check-in, Nenngeld, abwesend */
  A.post('/lk/person/:id', P, send(async req => checkin(personOr404(req.params.id), req.body || {}, req.user)));
  function checkin(p, b, by) {
    const d = dayRow(p.day_id);
    if (d.finished_at) throw err('Das Turnier ist beendet.');
    const L = load(d), { fee } = money(L), name = pname(p), log = [];
    if (b.checkin !== undefined && Boolean(b.checkin) !== Boolean(p.checked_in_at)) { db.prepare('UPDATE tu_person SET checked_in_at = ? WHERE id = ?').run(b.checkin ? nowTs() : null, p.id); log.push(b.checkin ? 'eingecheckt' : 'Check-in zurückgenommen'); }
    if (b.absent !== undefined && Boolean(b.absent) !== Boolean(p.absent)) { db.prepare('UPDATE tu_person SET absent = ? WHERE id = ?').run(b.absent ? 1 : 0, p.id); log.push(b.absent ? 'abwesend' : 'zurück'); }
    if (b.paid !== undefined && (b.paid || null) !== (p.paid || null)) {
      if (b.paid && !['bar', 'digital'].includes(b.paid)) throw err('Bitte „bar“ oder „digital“ wählen.');
      const c = b.paid ? fee.get(p.id) || 0 : null;
      db.prepare('UPDATE tu_person SET paid = ?, paid_cents = ?, paid_at = ?, paid_by = ? WHERE id = ?').run(b.paid || null, c, b.paid ? nowTs() : null, b.paid ? uname(by) : null, p.id);
      log.push(b.paid ? `Nenngeld ${euro(c)} ${b.paid}` : 'Zahlung zurückgenommen');
    }
    if (log.length) audit(by, 'Turniere: Check-in', `${d.name} – ${name}: ${log.join(', ')}`);
    return { ok: true };
  }
  /** QR-Code der Spielerseite (über die Adresse der Mitglieder-App) */
  A.get('/lk/person/:id/qr', P, send(async req => {
    const p = personOr404(req.params.id), base = ctx.appUrl();
    if (!p.token) throw err('Für diesen Spieler gibt es keinen Link mehr (Turnier vorbei).');
    if (!base) return { url: null, svg: null };
    const url = `${base}/p/turniere/#t=${p.token}`;
    return { url, svg: await ctx.require('qrcode').toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }), name: pfull(p) };
  }));
  /** alle QR-Codes zum Ausdrucken */
  A.get('/lk/tag/:id/qr', P, send(async req => {
    const d = dayOr404(req.params.id), base = ctx.appUrl();
    if (!base) return { url: null, list: [] };
    const QR = ctx.require('qrcode'), list = [];
    for (const p of persons(d.id).filter(x => x.token && !x.gone).sort((x, y) => pname(x).localeCompare(pname(y), 'de'))) list.push({ name: pname(p), club: p.club || '', svg: await QR.toString(`${base}/p/turniere/#t=${p.token}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) });
    return { url: base, list };
  }));
  /* Plätze */
  A.get('/lk/buchungsplaetze', P, send(async () => (bookingOn() ? (await hook('courtList')) || [] : [])));
  A.post('/lk/tag/:id/platz', P, send(async req => {
    const d = dayOr404(req.params.id), name = txt((req.body || {}).name, 40);
    if (name.length < 2) throw err('Bitte einen Namen eintragen (z. B. „Halle Platz A“).');
    if (courts(d.id).some(c => c.name.toLowerCase() === name.toLowerCase())) throw err('Diesen Platz gibt es schon.');
    db.prepare('INSERT INTO tu_court(day_id, name, sort, manual) VALUES (?,?,?,1)').run(d.id, name, courts(d.id).reduce((a, c) => Math.max(a, c.sort), 0) + 1);
    audit(req.user, 'Turniere: Platz angelegt', `${d.name}: ${name}`);
    return { ok: true };
  }));
  A.put('/lk/platz/:id', P, send(async req => {
    const c = db.prepare('SELECT * FROM tu_court WHERE id = ?').get(int(req.params.id)); if (!c) throw err('Platz nicht gefunden.', 404);
    const b = req.body || {}, d = dayRow(c.day_id);
    let rid = c.resource_id;
    if (b.resource_id !== undefined) {
      rid = b.resource_id ? int(b.resource_id) : null;
      if (rid) {
        const list = bookingOn() ? (await hook('courtList')) || [] : [];
        if (!list.some(x => x.id === rid)) throw err('Diesen Platz gibt es im Buchungssystem nicht.');
        if (courts(d.id).some(x => x.id !== c.id && x.resource_id === rid)) throw err('Dieser Platz des Buchungssystems ist schon einem anderen Turnierplatz zugeordnet.');
      }
    }
    const name = b.name !== undefined ? txt(b.name, 40) : c.name;
    if (name.length < 2) throw err('Bitte einen Namen eintragen.');
    const auto = b.auto !== undefined ? (b.auto ? 1 : 0) : c.auto;
    db.prepare('UPDATE tu_court SET name = ?, resource_id = ?, auto = ? WHERE id = ?').run(name, rid, auto, c.id);
    const res = new Map(((bookingOn() ? await hook('courtList') : null) || []).map(x => [x.id, x.name]));
    const df = ctx.auditDiff({ name: 'Name', resource: 'Platz im Buchungssystem', auto: ['automatisch verteilen', 'bool'] }, { name: c.name, resource: res.get(c.resource_id) || '–', auto: Boolean(c.auto) }, { name, resource: res.get(rid) || '–', auto: Boolean(auto) });
    if (df) audit(req.user, 'Turniere: Platz geändert', `${d.name}, ${c.name}: ${df}`);
    if (d.locked && rid !== c.resource_id) await syncLocks(dayRow(d.id), req.user);
    return { ok: true };
  }));
  A.delete('/lk/platz/:id', P, send(async req => {
    const c = db.prepare('SELECT * FROM tu_court WHERE id = ?').get(int(req.params.id)); if (!c) throw err('Platz nicht gefunden.', 404);
    if (db.prepare('SELECT 1 FROM tu_lkmatch WHERE court_id = ?').get(c.id)) throw err('Auf diesem Platz sind noch Matches eingeplant – erst verlegen.');
    db.prepare('DELETE FROM tu_court WHERE id = ?').run(c.id);
    const d = dayRow(c.day_id);
    audit(req.user, 'Turniere: Platz entfernt', `${d.name}: ${c.name}`);
    if (d.locked && c.resource_id) await syncLocks(d, req.user);
    return { ok: true };
  }));
  /** Plätze im Buchungssystem sperren: Vorschau (Buchungen, die storniert würden) bzw. sperren; off = Sperre aufheben */
  A.post('/lk/tag/:id/sperre', P, send(async req => {
    const d = dayOr404(req.params.id), b = req.body || {};
    if (!bookingOn()) throw err('Das Modul „Plätze“ ist nicht aktiv – es gibt nichts zu sperren.');
    if (b.off) { db.prepare('UPDATE tu_day SET locked = 0 WHERE id = ?').run(d.id); const r = await syncLocks(dayRow(d.id), req.user); return { ok: true, ...r }; }
    const from = b.from || d.lock_from || lockSuggest(d).from, to = b.to || d.lock_to || lockSuggest(d).to;
    if (!isTime(from) || !(isTime(to) || to === '24:00') || to <= from) throw err('Bitte die Zeiten prüfen (z. B. 08:00 bis 20:00).');
    if (!courts(d.id).some(c => c.resource_id)) throw err('Erst die Turnierplätze den Plätzen des Buchungssystems zuordnen.');
    if (d.finished_at) throw err('Das Turnier ist beendet.');
    const next = { ...d, locked: 1, lock_from: from, lock_to: to };
    if (b.preview) return await syncLocks(next, req.user, true);
    db.prepare('UPDATE tu_day SET locked = 1, lock_from = ?, lock_to = ? WHERE id = ?').run(from, to, d.id);
    return { ok: true, ...(await syncLocks(dayRow(d.id), req.user)) };
  }));
  /* Matches */
  A.put('/lk/match/:id', P, send(async req => { assign(matchOr404(req.params.id), req.body || {}, req.user); return { ok: true }; }));
  A.post('/lk/match/:id/start', P, send(async req => startMatch(matchOr404(req.params.id), req.user, true)));
  A.post('/lk/match/:id/stopp', P, send(async req => {   // Start zurücknehmen (versehentlich gestartet)
    const m = matchOr404(req.params.id);
    if (!m.started_at || m.result) throw err('Dieses Match läuft nicht.');
    db.prepare('UPDATE tu_lkmatch SET started_at = NULL WHERE id = ?').run(m.id);
    audit(req.user, 'Turniere: Start zurückgenommen', `${dayRow(m.day_id).name} – ${mLabel(load(dayRow(m.day_id)), m)}`);
    return { ok: true };
  }));
  A.post('/lk/match/:id/ergebnis', P, send(async req => saveResult(matchOr404(req.params.id), req.body || {}, { by: req.user, admin: true })));
  /** Paarung von Hand (z. B. Folgerunde, bevor nuLiga neu exportiert ist) */
  A.put('/lk/match/:id/paarung', P, send(async req => {
    const m = matchOr404(req.params.id), b = req.body || {};
    if (m.result || m.started_at) throw err('Gestartete oder gewertete Matches lassen sich nicht ändern.');
    const ok = id => !id || db.prepare('SELECT 1 FROM tu_entry WHERE id = ? AND event_id = ? AND gone = 0').get(int(id), m.event_id);
    if (!ok(b.a) || !ok(b.b) || (b.a && int(b.a) === int(b.b))) throw err('Bitte zwei verschiedene Meldungen dieser Konkurrenz wählen.');
    db.prepare('UPDATE tu_lkmatch SET a = ?, b = ? WHERE id = ?').run(int(b.a) || null, int(b.b) || null, m.id);
    const L = load(dayRow(m.day_id));
    audit(req.user, 'Turniere: Paarung festgelegt', `${L.day.name} – ${mLabel(L, matchRow(m.id))}`);
    return { ok: true };
  }));
  A.post('/lk/tag/:id/verteilen', P, send(async req => ({ ok: true, moved: autoDistribute(dayOr404(req.params.id), req.user) })));
  /** ursprüngliche Planung aus nuLiga wiederherstellen (nur Matches, die noch nicht gestartet sind) */
  A.post('/lk/tag/:id/ursprung', P, send(async req => {
    const d = dayOr404(req.params.id), cByName = new Map(courts(d.id).map(c => [c.name, c.id]));
    let n = 0;
    for (const m of matches(d.id).filter(x => !x.started_at && !x.result)) {
      const c = cByName.get(m.plan_court) || null;
      if ((m.court_id || null) === c && (m.time || null) === (m.plan_time || null)) continue;
      db.prepare('UPDATE tu_lkmatch SET court_id = ?, time = ? WHERE id = ?').run(c, m.plan_time, m.id); n++;
    }
    if (n) audit(req.user, 'Turniere: ursprüngliche Planung', `${d.name}: ${n} Matches zurück auf die Planung aus nuLiga`);
    return { ok: true, n };
  }));
  /** Ergebnisliste zum Abtippen in nuLiga: je Konkurrenz und Runde, in der Reihenfolge von nuLiga */
  A.get('/lk/tag/:id/ergebnisliste', P, send(async req => {
    const d = dayOr404(req.params.id), L = load(d);
    return { day: dayView(d), events: L.ev.map(e => ({ name: e.name, tournament: e.tournament, rounds: [...new Set(L.mvs.filter(m => m.event_id === e.id).map(m => `${m.grp}|${m.round}`))]
      .sort((x, y) => x.localeCompare(y, 'de', { numeric: true }))
      .map(k => ({ label: roundLabel({ grp: +k.split('|')[0], round: k.split('|')[1] }), matches: L.mvs.filter(m => m.event_id === e.id && `${m.grp}|${m.round}` === k).sort((x, y) => x.no - y.no)
        .map(m => ({ no: m.no, a: m.a, b: m.b, score: m.score, winner: m.winner, result: m.result, done: m.done })) })) })).filter(e => e.rounds.length) };
  }));
  A.put('/lk/einstellungen', P, (req, res) => {
    const b = req.body || {}, before = cfg();
    if (b.minutes !== undefined) { if (!MINUTES.includes(int(b.minutes))) return bad(res, 'Bitte eine Matchdauer wählen.'); SET('minutes', int(b.minutes)); }
    if (b.pause !== undefined) { if (!PAUSES.includes(int(b.pause))) return bad(res, 'Bitte eine Pause wählen.'); SET('pause', int(b.pause)); }
    if (b.keep_days !== undefined) { if (!KEEP.includes(int(b.keep_days))) return bad(res, 'Bitte eine Löschfrist wählen.'); SET('keep_days', int(b.keep_days)); }
    const df = ctx.auditDiff({ minutes: 'Dauer je Match (Minuten)', pause: 'Pause zwischen zwei Matches (Minuten)', keep_days: 'Löschfrist fremder Spieler (Tage)' }, before, cfg());
    if (df) audit(req.user, 'Turniere: Einstellungen geändert', df);
    res.json({ ok: true, cfg: cfg() });
  });

  /* ================================================================= Tablet und Fernseher (/api/tablet/x/turniere/lk/…) – im Vereins-WLAN, Tablet-Passwort */
  const TB = ctx.tablet;
  const tabletDay = () => { const d = todayDay(); if (!d) throw err('Heute läuft kein Turnier.', 404); return d; };
  /** Tablet: Check-in (Name, Verein, LK, Nenngeld), Plätze und Matches ohne Ergebnis */
  TB.get('/lk/heute', send(async () => {
    const d = todayDay(); if (!d) return { day: null };
    const L = load(d), { fee } = money(L), C = central(L);
    const strip = m => m && { id: m.id, event: m.event, roundLabel: m.roundLabel, no: m.no, a: m.a, b: m.b, court_id: m.court_id, court: m.court, time: m.time, est: m.est, delay: m.delay, minutes: m.minutes, running: m.running, done: m.done, result: m.result, sets: m.sets, winner: m.winner, retired: m.retired, score: m.score, full: m.full, wait: m.wait };
    return { day: dayView(d), courts: C.courts.map(c => ({ id: c.id, name: c.name, running: strip(c.running), next: strip(c.next) })), queue: C.queue.map(strip),
      open: L.mvs.filter(m => !m.done && m.a && m.b && (m.running || m.started_at)).map(strip), upcoming: L.mvs.filter(m => !m.done && m.a && m.b && !m.running).sort(L.byEst).slice(0, 40).map(strip),
      results: L.mvs.filter(m => m.done).sort((x, y) => String(y.ended_at || '').localeCompare(String(x.ended_at || ''))).slice(0, 12).map(strip),
      people: people(L, fee).map(p => ({ id: p.id, name: p.name, club: p.club, lk: p.lk, events: p.events, checked_in: p.checked_in, absent: p.absent, fee: p.fee, paid: p.paid, pay_hint: p.pay_hint, first_match: p.first_match, notes: p.notes })) };
  }));
  TB.post('/lk/person/:id', ctx.rateLimit('tulk', 120, 60000), send(async req => {
    const p = personOr404(req.params.id), d = tabletDay();
    if (p.day_id !== d.id) throw err('Spieler nicht gefunden.', 404);
    const b = req.body || {};
    return checkin(p, { checkin: b.checkin, paid: b.paid, absent: b.absent }, { username: 'tablet', name: 'Tablet' });
  }));
  const tabletMatch = id => { const m = matchOr404(id), d = tabletDay(); if (m.day_id !== d.id) throw err('Match nicht gefunden.', 404); return m; };
  TB.post('/lk/match/:id/start', ctx.rateLimit('tulk', 120, 60000), send(async req => startMatch(tabletMatch(req.params.id), 'Tablet', false)));
  TB.post('/lk/match/:id/ergebnis', ctx.rateLimit('tulk', 120, 60000), send(async req => saveResult(tabletMatch(req.params.id), req.body || {}, { by: 'Tablet', admin: false })));
  /** Fernseher im Clubhaus: Plätze mit laufendem und nächstem Match, Verzug, letzte Ergebnisse */
  TB.get('/lk/tv', send(async () => {
    const d = todayDay(); if (!d) return { day: null, club: ctx.getSetting('club_name', '') };
    const L = load(d), C = central(L);
    const v = m => m && { event: m.event, roundLabel: m.roundLabel, a: m.a, b: m.b, a_club: m.a_club, b_club: m.b_club, est: m.est, time: m.time, delay: m.delay, minutes: m.minutes, score: m.score, sets: m.sets, winner: m.winner, result: m.result, retired: m.retired, wait: m.wait };
    return { day: dayView(d), club: ctx.getSetting('club_name', ''), now: nowTs().slice(11, 16), courts: C.courts.map(c => ({ name: c.name, running: v(c.running), next: v(c.next) })),
      queue: C.queue.slice(0, 8).map(v), results: L.mvs.filter(m => m.done).sort((x, y) => String(y.ended_at || '').localeCompare(String(x.ended_at || ''))).slice(0, 8).map(v) };
  }));

  /* ================================================================= Spielerseite ohne Anmeldung (/api/p/turniere/s/<token>) */
  /** Link gilt nur für diesen Turniertag und nur bis zum Turnierende (beendet oder letzter Turniertag vorbei) */
  const byToken = tok => {
    if (typeof tok !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(tok)) return null;
    const p = db.prepare('SELECT * FROM tu_person WHERE token = ? AND gone = 0').get(tok);
    if (!p) return null;
    const d = dayRow(p.day_id);
    return d && !d.finished_at && !d.purged_at && d.date_to >= today() ? { p, d } : null;
  };
  ctx.public.get('/s/:token', ctx.rateLimit('tulkp', 60, 60000), (req, res) => {
    const x = byToken(req.params.token);
    res.set('Cache-Control', 'no-store');
    if (!x) return res.status(404).json({ error: 'Dieser Link gilt nicht (mehr) – er ist nur für ein Turnier und bis zu dessen Ende gültig.' });
    const L = load(x.d), mine = L.mvs.filter(m => m.players.includes(x.p.id)).sort(L.byEst);
    const v = m => ({ event: m.event, roundLabel: m.roundLabel, a: m.a, b: m.b, a_club: m.a_club, b_club: m.b_club, court: m.court, time: m.time, est: m.est, delay: m.delay, running: m.running, done: m.done, score: m.score, sets: m.sets, winner: m.winner, result: m.result, retired: m.retired,
      date: String(m.est_at || '').slice(0, 10) || m.date, side: L.members(L.enById.get(m.a_id)).includes(x.p.id) ? 'a' : 'b', wait: m.wait && /^Paarung/.test(m.wait) ? m.wait : '' });
    const next = mine.find(m => !m.done) || null;
    const dayOf = m => String(m.est_at || '').slice(0, 10) || m.date;
    const court = next && next.court_id ? L.mvs.filter(m => m.court_id === next.court_id && !m.done && dayOf(m) === dayOf(next)).sort(L.byEst).map(m => ({ a: m.a, b: m.b, est: m.est, running: m.running, mine: m.id === next.id })) : [];
    res.json({ club: ctx.getSetting('club_name', ''), today: today(), day: { name: x.d.name, date_from: x.d.date_from, date_to: x.d.date_to }, name: pfull(x.p), checked_in: Boolean(x.p.checked_in_at), next: next ? v(next) : null, court, matches: mine.map(v) });
  });

  /* ---------- für den Kern ---------- */
  return {
    tabletVisible: () => Boolean(todayDay()),
    overview: () => {
      const d = todayDay(); if (!d) return { kpis: [], alerts: [] };
      const L = load(d), late = L.mvs.filter(m => !m.done && m.delay >= 15).length, { report } = money(L);
      const alerts = [];
      if (late) alerts.push({ level: 'a', text: `${d.name}: ${late} ${late === 1 ? 'Match liegt' : 'Matches liegen'} mehr als 15 Minuten hinter dem Plan.`, sec: ['tab_turniertag', 'zentrale'] });
      return { kpis: [{ l: 'Nenngeld offen', v: euro(report.open) }], alerts };
    },
    // Datenschutz: Löschfrist fremder Spieler auch unter Einstellungen › Datenschutz (gelöscht wird hier, stündlich)
    retention: () => ({ id: 'fremde', label: 'Turniertag: Spieler fremder Vereine', text: 'Nach dem Turnier; eigene Mitglieder bleiben.', unit: 'tage', value: cfg().keep_days, def: 30, min: KEEP[0], max: KEEP[KEEP.length - 1], choices: KEEP,
      due: cut => db.prepare('SELECT COUNT(*) n FROM tu_person p JOIN tu_day d ON d.id = p.day_id WHERE d.purged_at IS NULL AND d.date_to < ? AND p.own = 0').get(cut).n,
      set: v => { if (!KEEP.includes(v)) throw new Error('Bitte eine der angebotenen Löschfristen wählen.'); SET('keep_days', v); } }),
    exportCfg: () => cfg(),
    importCfg: s => { for (const [k, list] of [['minutes', MINUTES], ['pause', PAUSES], ['keep_days', KEEP]]) if (list.includes(int((s || {})[k]))) SET(k, int(s[k])); },
  };
}

module.exports = { activate };
