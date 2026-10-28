'use strict';
/* =====================================================================================================
   Modul „Turniere“ – dritter Teil: freie Turniere ohne nuLiga (planung/freie-turniere.md)
   Dorfturniere im Tennis und Fußball: Gruppen + Endrunde, Jeder gegen jeden, K.-o. mit Setzliste und Schleifchenturnier.
   Sportart-Vorlagen (Punkte, Spielzeit, Pause, Entscheidung im K.-o.), Mannschaften mit freien Namen (Spieler optional, auch Gäste),
   Auslosung (Gruppen automatisch, auch bei ungleichen Zahlen), Spielplan mit Uhrzeit und Platz, Turnierzentrale mit Nachrücken,
   Ergebnisse nur durch die Turnierleitung (Verwaltung oder Tablet mit dem Code der Turnierleitung), Endrunde füllt sich selbst,
   Monitor zum Aufhängen (Link mit Zufallsschlüssel über den Server der Mitglieder-App, nur lesend), Ehrentafel je Turnier und Jahr.
   Optional: Startgeld je Mannschaft, Sperre der Plätze im Buchungssystem (nur mit dem Modul „Plätze“).
   Logik ohne Datenbank: lib/frei.js · Ergebnisse auf Sätze: lib/wertung.js · voraussichtliche Zeiten am Turniertag: lib/zeitplan.js
   ===================================================================================================== */
const crypto = require('crypto');
const { today, addDays, deD, nowTs, isDate } = require('../../src/util');
const W = require('./lib/wertung');
const F = require('./lib/frei');
const Z = require('./lib/zeitplan');

const J = (v, d) => { try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };
const txt = (v, max = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const euro = c => `${(c / 100).toFixed(2).replace('.', ',')} €`;
const newKey = () => crypto.randomBytes(24).toString('base64url');   // 32 Zeichen, 192 Bit
const pad = n => String(n).padStart(2, '0');
const RANK = { 1: 'Gruppensieger', 2: 'Gruppenzweiter', 3: 'Gruppendritter', 4: 'Gruppenvierter' };
const KEEP = [30, 90, 365, 730];
const MAX_TEAMS = 128;

function activate(ctx, { P, ar, hook, bookingOn }) {
  const { db, bad, int, audit } = ctx;
  db.exec(`
CREATE TABLE IF NOT EXISTS tu_ft (                                  -- freies Turnier (Dorfturnier)
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sport TEXT NOT NULL DEFAULT 'tennis', format TEXT NOT NULL DEFAULT 'gruppen',
  date TEXT NOT NULL, start TEXT NOT NULL DEFAULT '10:00', cfg TEXT NOT NULL DEFAULT '{}',
  drawn_at TEXT, finished_at TEXT, podium TEXT,                    -- podium: Ehrentafel [{ place, name }]
  monitor_key TEXT, code_hash TEXT,                                -- Monitor-Link (Zufallsschlüssel), Code der Turnierleitung (scrypt)
  locked INTEGER NOT NULL DEFAULT 0, lock_from TEXT, lock_to TEXT, purged_at TEXT,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tu_ft_key ON tu_ft(monitor_key);
CREATE TABLE IF NOT EXISTS tu_ftteam (                              -- Mannschaft (Schleifchen: eine Person)
  id INTEGER PRIMARY KEY AUTOINCREMENT, ft_id INTEGER NOT NULL, name TEXT NOT NULL, players TEXT NOT NULL DEFAULT '[]',
  seed INTEGER, grp INTEGER, lot INTEGER,                           -- grp: Gruppe (0 = A …), lot: gezogenes Los bei Gleichstand
  checked_in_at TEXT, paid TEXT, paid_cents INTEGER, paid_at TEXT, paid_by TEXT
);
CREATE INDEX IF NOT EXISTS ix_tu_ftteam ON tu_ftteam(ft_id);
CREATE TABLE IF NOT EXISTS tu_ftcourt (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ft_id INTEGER NOT NULL, name TEXT NOT NULL, resource_id INTEGER, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tu_ftmatch (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ft_id INTEGER NOT NULL,
  phase TEXT NOT NULL,                                              -- gruppe | ko | platz3 | runde (Schleifchen)
  grp INTEGER, round INTEGER NOT NULL DEFAULT 1, slot INTEGER NOT NULL DEFAULT 1,
  a INTEGER, b INTEGER, a2 INTEGER, b2 INTEGER,                     -- tu_ftteam.id (Schleifchen: zwei Personen je Seite); leer = steht noch nicht fest
  src_a TEXT, src_b TEXT,                                           -- erste K.-o.-Runde: Herkunft (JSON { g, r } | { best, n } | { team }), 'null' = Freilos
  court_id INTEGER, time TEXT, plan_court INTEGER, plan_time TEXT,  -- aktuell und ursprünglich geplant ('JJJJ-MM-TT HH:MM')
  started_at TEXT, ended_at TEXT, result TEXT, score_a INTEGER, score_b INTEGER, sets TEXT NOT NULL DEFAULT '[]', retired TEXT,
  decider TEXT, winner TEXT, entered_by TEXT, entered_at TEXT      -- result: normal | wo | aufgabe | freilos; winner: a | b | x (unentschieden)
);
CREATE INDEX IF NOT EXISTS ix_tu_ftmatch ON tu_ftmatch(ft_id);
`);
  const S = (k, d) => ctx.getSetting('ext_turniere_ft_' + k, d);
  const SET = (k, v) => ctx.setSetting('ext_turniere_ft_' + k, String(v));
  const keepDays = () => (KEEP.includes(int(S('keep_days', '365'))) ? int(S('keep_days', '365')) : 365);
  const uname = u => (typeof u === 'string' ? u : u ? u.name || u.username : '');
  const err = (msg, code = 400) => Object.assign(new Error(msg), { code });
  const send = fn => ar(async (req, res) => { try { res.json(await fn(req)); } catch (e) { bad(res, e.message, e.code || e.status || 400); } });

  /* ---------- Lesen ---------- */
  const ftRow = id => db.prepare('SELECT * FROM tu_ft WHERE id = ?').get(int(id));
  const cfgOf = ft => ({ ...F.config(ft.sport, J(ft.cfg, {})), sport: ft.sport, format: ft.format });
  const teamsOf = fid => db.prepare('SELECT * FROM tu_ftteam WHERE ft_id = ? ORDER BY id').all(fid).map(t => ({ ...t, players: J(t.players, []) }));
  const courtsOf = fid => db.prepare('SELECT * FROM tu_ftcourt WHERE ft_id = ? ORDER BY sort, id').all(fid);
  const mrow = m => (m ? { ...m, sets: J(m.sets, []), decider: J(m.decider, null) } : m);
  const matchesOf = fid => db.prepare('SELECT * FROM tu_ftmatch WHERE ft_id = ? ORDER BY id').all(fid).map(mrow);
  const matchRow = id => mrow(db.prepare('SELECT * FROM tu_ftmatch WHERE id = ?').get(int(id)));
  const todays = () => db.prepare('SELECT * FROM tu_ft WHERE date = ? AND finished_at IS NULL AND drawn_at IS NOT NULL ORDER BY start, id').all(today());
  const hm = s => (s ? String(s).slice(11, 16) : null);
  const at = (date, mins) => { const d = new Date(`${date}T00:00:00`); d.setMinutes(mins); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const minsOf = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  const isKo = m => m.phase === 'ko' || m.phase === 'platz3';
  const decided = m => Boolean(m.winner);
  const sideIds = (m, s) => (s === 'a' ? [m.a, m.a2] : [m.b, m.b2]).filter(Boolean);
  const unitWord = c => (c.scoring === 'saetze' ? 'Sätze' : c.unit === 'tore' ? 'Tore' : 'Spiele');

  /** Bezeichnungen: Gruppe, K.-o.-Runde, Herkunft eines Platzes im Baum */
  const groupName = g => `Gruppe ${F.groupLabel(g)}`;
  function koRounds(ms) { return Math.max(0, ...ms.filter(m => m.phase === 'ko').map(m => m.round)); }
  function phaseLabel(m, R) {
    if (m.phase === 'gruppe') return R === -1 ? `Runde ${m.round}` : `${groupName(m.grp)} · Runde ${m.round}`;
    if (m.phase === 'runde') return `Runde ${m.round}`;
    if (m.phase === 'platz3') return 'Spiel um Platz 3';
    const n = 2 ** (R - m.round);
    return n > 1 ? `${F.koLabel(m.round, R)} ${m.slot}` : F.koLabel(m.round, R);
  }
  function srcLabel(src, R) {
    if (src == null) return 'Freilos';
    if (src.g != null) return `${src.r}. ${groupName(src.g)}`;
    if (src.best != null) return src.n > 1 ? `${src.n}.-bester ${RANK[src.best] || `${src.best}.`}` : `Bester ${RANK[src.best] || `${src.best}.`}`;
    if (src.w) return `Sieger ${phaseLabel({ phase: 'ko', round: src.w[0], slot: src.w[1] }, R)}`;
    if (src.l) return `Verlierer ${phaseLabel({ phase: 'ko', round: src.l[0], slot: src.l[1] }, R)}`;
    return 'offen';
  }

  /* ---------- Stand: Tabellen, Endrunde, Rangliste ---------- */
  /** Gruppen mit Tabelle → [{ g, label, teams, matches, table, done, needLot: [ids] }] */
  function groupsOf(c, teams, ms) {
    const nos = [...new Set(teams.filter(t => t.grp != null).map(t => t.grp))].sort((x, y) => x - y);
    return nos.map(g => {
      const gt = teams.filter(t => t.grp === g), gm = ms.filter(m => m.phase === 'gruppe' && m.grp === g);
      const table = F.table(gt.map(t => ({ id: t.id, name: t.name, lot: t.lot })), gm, c);
      const done = gm.length > 0 && gm.every(decided);
      return { g, label: groupName(g), teams: gt, matches: gm, table, done, needLot: done ? table.filter(r => r.tie).map(r => r.id) : [] };
    });
  }
  /** Wer steht fest? Herkunft der ersten K.-o.-Runde → Mannschaft (oder null, solange offen) und Hinweise (Los nötig) */
  function resolver(c, groups) {
    const sizes = groups.map(g => g.teams.length), p = F.koPlan(sizes, c.qualify);
    const allDone = groups.length > 0 && groups.every(g => g.done);
    const relevant = g => g.table.filter(r => r.tie && r.rank <= p.take + (p.fill ? 1 : 0));
    const best = {};
    const bestRows = r => {
      if (!best[r]) best[r] = F.bestOf(groups.map(g => g.table.find(x => x.rank === r)).filter(Boolean).map(x => ({ ...x, lot: (groups.flatMap(g => g.teams).find(t => t.id === x.id) || {}).lot })));
      return best[r];
    };
    const notes = [];
    for (const g of groups) if (g.done && relevant(g).length) notes.push({ kind: 'los', label: `${g.label}: Gleichstand – bitte das Los ziehen.`, teams: g.table.filter(r => r.tie).map(r => r.id) });
    if (p.fill && allDone) {
      const rows = bestRows(p.take + 1), cut = rows.slice(0, p.fill + 1).filter(r => r.tie);
      if (cut.length) notes.push({ kind: 'los', label: `Gleichstand im Vergleich der ${RANK[p.take + 1] || 'Gruppenplatzierten'} – bitte das Los ziehen.`, teams: rows.filter(r => r.tie).map(r => r.id) });
    }
    const of = src => {
      if (!src) return null;
      if (src.team) return src.team;
      if (src.g != null) { const g = groups.find(x => x.g === src.g); if (!g || !g.done || relevant(g).length) return null; const r = g.table.find(x => x.rank === src.r); return r ? r.id : null; }
      if (src.best != null) {
        if (!allDone || groups.some(g => relevant(g).length)) return null;
        const rows = bestRows(src.best);
        if (rows.slice(0, (src.best > p.take ? p.fill : groups.length) + 1).some(r => r.tie)) return null;
        return rows[src.n - 1] ? rows[src.n - 1].id : null;
      }
      return null;
    };
    return { of, notes, plan: p };
  }
  /**
   * Endrunde an den Stand anpassen: Mannschaften einsetzen, Freilose werten, Sieger rücken vor, Spiel um Platz 3.
   * Gespielte Spiele bleiben stehen – ändert sich danach etwas davor, kommt ein Hinweis. → { warnings, notes }
   */
  function reconcile(ft) {
    const c = cfgOf(ft), warnings = [];
    let notes = [];
    for (let pass = 0; pass < 12; pass++) {
      const teams = teamsOf(ft.id), ms = matchesOf(ft.id), ko = ms.filter(m => m.phase === 'ko'), R = koRounds(ms);
      const groups = ft.format === 'gruppen' || ft.format === 'liga' ? groupsOf(c, teams, ms) : [];
      const res = groups.length ? resolver(c, groups) : { of: src => (src && src.team) || null, notes: [] };
      notes = res.notes;
      if (!ko.length) break;
      const at = (r, s) => ko.find(m => m.round === r && m.slot === s);
      const win = m => (m && m.winner && m.winner !== 'x' ? (m.winner === 'a' ? m.a : m.b) : null);
      const lose = m => (m && m.winner && m.winner !== 'x' && m.result !== 'freilos' ? (m.winner === 'a' ? m.b : m.a) : null);
      let changed = false;
      const set = (m, a, b, extra = '') => {
        if (decided(m) && m.result !== 'freilos') {
          if ((a != null && m.a !== a) || (b != null && m.b !== b)) { const w = `${phaseLabel(m, R)} ist schon gespielt – davor hat sich ein Ergebnis geändert. Bitte prüfen.`; if (!warnings.includes(w)) warnings.push(w); }
          return;
        }
        if (m.started_at && !extra) return;
        if ((m.a || null) === (a || null) && (m.b || null) === (b || null) && !extra) return;
        db.prepare('UPDATE tu_ftmatch SET a = ?, b = ? WHERE id = ?').run(a || null, b || null, m.id); changed = true;
      };
      for (const m of [...ko].sort((x, y) => x.round - y.round || x.slot - y.slot)) {
        if (m.round === 1) {
          const byeA = m.src_a === 'null', byeB = m.src_b === 'null';
          const a = byeA ? null : res.of(J(m.src_a, null)), b = byeB ? null : res.of(J(m.src_b, null));
          if (byeA || byeB) {   // Freilos: der Gegner kommt ohne Spiel weiter
            const w = byeA ? b : a, want = w ? (byeA ? 'b' : 'a') : null;
            if ((m.a || null) !== (a || null) || (m.b || null) !== (b || null) || (m.winner || null) !== want) {
              db.prepare('UPDATE tu_ftmatch SET a = ?, b = ?, result = ?, winner = ?, court_id = NULL, time = NULL, plan_court = NULL, plan_time = NULL WHERE id = ?').run(a, b, want ? 'freilos' : null, want, m.id); changed = true;
            }
            continue;
          }
          set(m, a, b);
        } else set(m, win(at(m.round - 1, 2 * m.slot - 1)), win(at(m.round - 1, 2 * m.slot)));
      }
      const third = ms.find(m => m.phase === 'platz3');
      if (third && R >= 2) set(third, lose(at(R - 1, 1)), lose(at(R - 1, 2)));
      if (!changed) break;
    }
    return { warnings, notes };
  }
  /** Platzierungen am Ende: 1., 2., 3. (ohne Spiel um Platz 3 beide Verlierer der Halbfinals) */
  function podium(ft) {
    const c = cfgOf(ft), teams = teamsOf(ft.id), ms = matchesOf(ft.id), name = id => (teams.find(t => t.id === id) || {}).name || '?';
    if (ft.format === 'schleifchen') return F.schleifchenTable(teams.map(t => ({ id: t.id, name: t.name, lot: t.lot })), ms.filter(m => m.phase === 'runde')).slice(0, 3).map(r => ({ place: r.rank, name: r.name }));
    const R = koRounds(ms), fin = ms.find(m => m.phase === 'ko' && m.round === R);
    if (!fin) { const g = groupsOf(c, teams, ms)[0]; return g ? g.table.slice(0, 3).map(r => ({ place: r.rank, name: r.name })) : []; }
    if (!fin.winner) return [];
    const out = [{ place: 1, name: name(fin.winner === 'a' ? fin.a : fin.b) }, { place: 2, name: name(fin.winner === 'a' ? fin.b : fin.a) }];
    const p3 = ms.find(m => m.phase === 'platz3');
    if (p3 && p3.winner) out.push({ place: 3, name: name(p3.winner === 'a' ? p3.a : p3.b) });
    else if (!p3) for (const s of ms.filter(m => m.phase === 'ko' && m.round === R - 1 && m.winner && m.result !== 'freilos')) out.push({ place: 3, name: name(s.winner === 'a' ? s.b : s.a) });
    return out;
  }

  /* ---------- Spielplan ---------- */
  /** Abschnitte für lib/frei.plan aus den Spielen: Gruppen bzw. Runden, dann die K.-o.-Runden mit Pausen */
  function sections(ft, ms) {
    const c = cfgOf(ft), R = koRounds(ms), out = [];
    const team = m => [m.a, m.b, m.a2, m.b2].filter(Boolean);
    const open = ms.filter(m => m.result !== 'freilos');
    if (ft.format === 'schleifchen') {
      for (const r of [...new Set(open.map(m => m.round))].sort((x, y) => x - y)) out.push({ gap: 0, rest: false, matches: open.filter(m => m.round === r).map(m => ({ key: m.id, teams: team(m), order: m.slot })) });
      return out;
    }
    const gm = open.filter(m => m.phase === 'gruppe');
    if (gm.length) out.push({ gap: 0, rest: true, matches: gm.map(m => ({ key: m.id, teams: team(m), home: m.grp, order: m.round * 1000 + m.grp * 50 + m.slot })) });
    for (let r = 1; r <= R; r++) {
      const list = open.filter(m => (m.phase === 'ko' && m.round === r) || (m.phase === 'platz3' && r === R));
      // Spiel um Platz 3 vor dem Finale, wenn es nur einen Platz gibt
      out.push({ gap: r === 1 ? c.break_groups : c.break_ko, rest: false, matches: list.map(m => ({ key: m.id, teams: team(m), order: m.phase === 'platz3' ? 0 : m.slot })) });
    }
    return out;
  }
  /** Zeiten und Plätze für alle noch nicht begonnenen Spiele neu setzen (bei der Auslosung, oder „Zeitplan neu berechnen“) → { end, clash } */
  function writePlan(ft) {
    const cs = courtsOf(ft.id); if (!cs.length) throw err('Bitte zuerst Plätze anlegen.');
    const c = cfgOf(ft), ms = matchesOf(ft.id);
    const p = F.plan(sections(ft, ms), cs.length, c);
    const upd = db.prepare('UPDATE tu_ftmatch SET court_id = ?, time = ?, plan_court = ?, plan_time = ? WHERE id = ?');
    db.transaction(() => {
      for (const m of ms) {
        const s = p.slots.get(m.id);
        if (!s) continue;
        const t = at(ft.date, minsOf(ft.start) + s.at), cid = cs[s.court].id;
        upd.run(cid, t, cid, t, m.id);
      }
    })();
    return { end: at(ft.date, minsOf(ft.start) + p.end) };
  }
  /** Vorschau ohne Speichern: Gruppen, Spiele, Endrunde und voraussichtliches Ende für n Mannschaften */
  function simulate(format, c, n, courts, date, start) {
    if (n < 2 || courts < 1) return null;
    const ids = Array.from({ length: n }, (_, i) => i + 1), secs = [];
    const out = { teams: n, groups: [], matches: 0, ko: null };
    if (format === 'schleifchen') {
      if (n < 4) return { ...out, end: null };
      const rs = F.schleifchen(ids, c.rounds, { tries: 20 });
      rs.forEach(r => secs.push({ gap: 0, rest: false, matches: r.games.map((g, k) => ({ key: `r${r}${k}${Math.random()}`, teams: g, order: k })) }));
      out.matches = rs.reduce((a, r) => a + r.games.length, 0); out.out = rs[0].out.length;
    } else if (format === 'ko') {
      const b = F.seedBracket(ids), R = b.R;
      out.ko = { size: b.size, byes: b.size - n };
      for (let r = 1; r <= R; r++) {
        const cnt = r === 1 ? b.first.filter(x => x[0] && x[1]).length : b.size / 2 ** r;
        secs.push({ gap: c.break_ko, rest: false, matches: Array.from({ length: cnt + (r === R && c.third && b.size >= 4 ? 1 : 0) }, (_, k) => ({ key: `${r}-${k}`, teams: [], order: k })) });
        out.matches += cnt + (r === R && c.third && b.size >= 4 ? 1 : 0);
      }
    } else {
      const g = format === 'liga' ? 1 : F.groupCount(n, c.group_size, c.qualify), sizes = F.groupSizes(n, g);
      out.groups = sizes;
      let k = 0;
      const gm = [];
      sizes.forEach((s, gi) => { const tid = ids.slice(k, k + s); k += s; F.rounds(tid).forEach((rd, ri) => rd.forEach((p, pi) => gm.push({ key: `g${gi}-${ri}-${pi}`, teams: p, home: gi, order: (ri + 1) * 1000 + gi * 50 + pi }))); });
      secs.push({ gap: 0, rest: true, matches: gm });
      out.matches = gm.length;
      if (format === 'gruppen') {
        const p = F.koPlan(sizes, c.qualify);
        out.ko = { size: p.size, fill: p.fill, take: p.take, cross: p.cross };
        const R = p.size >= 2 ? Math.log2(p.size) : 0;
        for (let r = 1; r <= R; r++) {
          const cnt = p.size / 2 ** r + (r === R && c.third && p.size >= 4 ? 1 : 0);
          secs.push({ gap: r === 1 ? c.break_groups : c.break_ko, rest: false, matches: Array.from({ length: cnt }, (_, x) => ({ key: `k${r}-${x}`, teams: [], order: x })) });
          out.matches += cnt;
        }
      }
    }
    const p = F.plan(secs, courts, c);
    return { ...out, end: date && isTime(start) ? at(date, minsOf(start) + p.end).slice(11, 16) : null, minutes: p.end };
  }

  /* ---------- Auslosung ---------- */
  const anyResult = fid => Boolean(db.prepare("SELECT 1 FROM tu_ftmatch WHERE ft_id = ? AND (result IS NOT NULL AND result != 'freilos' OR started_at IS NOT NULL) LIMIT 1").get(fid));
  function draw(ft, { seeded = false } = {}, user) {
    if (ft.finished_at) throw err('Das Turnier ist beendet.');
    if (anyResult(ft.id)) throw err('Es gibt schon Ergebnisse – neu auslosen geht nicht mehr.');
    const c = cfgOf(ft), teams = teamsOf(ft.id), cs = courtsOf(ft.id);
    const min = { gruppen: 3, liga: 3, ko: 2, schleifchen: 4 }[ft.format];
    if (teams.length < min) throw err(ft.format === 'schleifchen' ? `Für ein Schleifchenturnier braucht es mindestens ${min} Teilnehmer.` : `Bitte mindestens ${min} Mannschaften eintragen.`);
    if (!cs.length) throw err('Bitte zuerst Plätze anlegen.');
    const ins = db.prepare('INSERT INTO tu_ftmatch(ft_id, phase, grp, round, slot, a, b, a2, b2, src_a, src_b) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    const S_ = v => (v === undefined ? undefined : JSON.stringify(v));
    let summary = '';
    db.transaction(() => {
      db.prepare('DELETE FROM tu_ftmatch WHERE ft_id = ?').run(ft.id);
      db.prepare('UPDATE tu_ftteam SET grp = NULL, lot = NULL WHERE ft_id = ?').run(ft.id);
      const byId = new Map(teams.map(t => [t.id, t]));
      const koTree = (first, size) => {
        const R = Math.log2(size);
        first.forEach(([x, y], i) => ins.run(ft.id, 'ko', null, 1, i + 1, null, null, null, null, S_(x), S_(y)));
        for (let r = 2; r <= R; r++) for (let s = 1; s <= size / 2 ** r; s++) ins.run(ft.id, 'ko', null, r, s, null, null, null, null, null, null);
        if (c.third && size >= 4) ins.run(ft.id, 'platz3', null, R, 1, null, null, null, null, null, null);
      };
      if (ft.format === 'gruppen' || ft.format === 'liga') {
        const groups = ft.format === 'liga' ? [F.drawGroups(teams, teams.length, 1, { seeded: false }).flat()] : F.drawGroups(teams, c.group_size, c.qualify, { seeded });
        groups.forEach((ids, g) => {
          for (const id of ids) db.prepare('UPDATE tu_ftteam SET grp = ? WHERE id = ?').run(g, id);
          F.rounds(ids).forEach((rd, ri) => rd.forEach(([a, b], k) => ins.run(ft.id, 'gruppe', g, ri + 1, k + 1, a, b, null, null, null, null)));
        });
        if (ft.format === 'gruppen') {
          const k = F.koSources(groups.map(x => x.length), c.qualify);
          if (k.size >= 2) koTree(k.first, k.size);
        }
        summary = ft.format === 'liga' ? `${teams.length} Mannschaften, jeder gegen jeden`
          : groups.map((ids, g) => `${groupName(g)}: ${ids.map(id => byId.get(id).name).join(', ')}`).join(' · ');
      } else if (ft.format === 'ko') {
        const seeds = seeded ? teams.filter(t => t.seed).sort((x, y) => x.seed - y.seed) : [];
        const order = [...seeds, ...W.shuffle(teams.filter(t => !seeds.includes(t)))].map(t => ({ team: t.id }));
        const b = F.seedBracket(order);
        koTree(b.first, b.size);
        summary = `${teams.length} Mannschaften, Feld ${b.size}${b.size > teams.length ? `, ${b.size - teams.length} Freilos${b.size - teams.length === 1 ? '' : 'e'}` : ''}${seeds.length ? `, gesetzt: ${seeds.map(t => `${t.seed}. ${t.name}`).join(', ')}` : ''}`;
      } else {
        const rs = F.schleifchen(teams.map(t => t.id), c.rounds);
        rs.forEach((r, ri) => r.games.forEach(([a1, a2, b1, b2], k) => ins.run(ft.id, 'runde', null, ri + 1, k + 1, a1, b1, a2, b2, null, null)));
        summary = `${teams.length} Teilnehmer, ${c.rounds} Runden`;
      }
      db.prepare('UPDATE tu_ft SET drawn_at = ? WHERE id = ?').run(nowTs(), ft.id);
    })();
    reconcile(ftRow(ft.id));   // Freilose werten, Sieger rücken vor
    const p = writePlan(ftRow(ft.id));
    audit(user, 'Turniere: Turnier ausgelost', `${ft.name}: ${summary}`.slice(0, 900));
    return { ok: true, end: p.end };
  }

  /* ---------- Ansicht (Verwaltung, Tablet, Monitor) ---------- */
  function load(ft, { now = new Date() } = {}) {
    const c = cfgOf(ft), teams = teamsOf(ft.id), tById = new Map(teams.map(t => [t.id, t]));
    const cs = courtsOf(ft.id), cById = new Map(cs.map(x => [x.id, x]));
    const ms = matchesOf(ft.id), R = koRounds(ms);
    const players = m => [m.a, m.b, m.a2, m.b2].filter(Boolean);
    const sched = Z.schedule(ms.filter(m => m.result !== 'freilos' && (!m.result || m.ended_at)).map(m => ({ id: m.id, court: m.court_id, time: m.time, started_at: m.started_at, ended_at: m.ended_at, players: players(m), sort: m.round * 100 + m.slot })), { now, minutes: c.minutes, pause: c.pause });
    const running = new Set(ms.filter(m => m.started_at && !decided(m)).flatMap(players));
    const groups = ft.format === 'gruppen' || ft.format === 'liga' ? groupsOf(c, teams, ms) : [];
    const res = groups.length ? resolver(c, groups) : null;
    const name = id => (tById.get(id) || {}).name || null;
    const side = (m, s) => { const ids = sideIds(m, s); return ids.length ? ids.map(name).join(' / ') : null; };
    const placeholder = (m, s) => {
      if (m.phase === 'ko' && m.round === 1) return srcLabel(J(s === 'a' ? m.src_a : m.src_b, null), R);
      if (m.phase === 'ko') return `Sieger ${phaseLabel({ phase: 'ko', round: m.round - 1, slot: 2 * m.slot - (s === 'a' ? 1 : 0) }, R)}`;
      if (m.phase === 'platz3') return `Verlierer ${phaseLabel({ phase: 'ko', round: R - 1, slot: s === 'a' ? 1 : 2 }, R)}`;
      return 'offen';
    };
    const nowMs = now.getTime();
    const mv = m => {
      const s = sched.get(m.id), court = cById.get(m.court_id), ready = Boolean(m.a && m.b);
      const busy = players(m).filter(id => running.has(id) && !(m.started_at && !decided(m)));
      const startMs = m.started_at ? Date.parse(m.started_at.replace(' ', 'T')) : null;
      return { id: m.id, phase: m.phase, grp: m.grp, group: m.grp != null ? F.groupLabel(m.grp) : null, round: m.round, slot: m.slot, label: phaseLabel(m, ft.format === 'liga' ? -1 : R), ko: isKo(m),
        a: side(m, 'a'), b: side(m, 'b'), a_ph: side(m, 'a') ? null : placeholder(m, 'a'), b_ph: side(m, 'b') ? null : placeholder(m, 'b'), a_ids: sideIds(m, 'a'), b_ids: sideIds(m, 'b'),
        court_id: m.court_id || null, court: court ? court.name : null, time: hm(m.time), plan_time: hm(m.plan_time), est: s ? hm(s.start) : null, est_at: s ? s.start : m.time, est_end: s ? hm(s.end) : null,
        delay: s && !decided(m) ? s.delay : 0, started_at: m.started_at, running: Boolean(m.started_at && !decided(m)), done: decided(m), bye: m.result === 'freilos',
        left: startMs && !decided(m) ? Math.round((startMs + c.minutes * 60000 - nowMs) / 1000) : null, minutes: startMs && !decided(m) ? Math.max(0, Math.round((nowMs - startMs) / 60000)) : null,
        result: m.result, score_a: m.score_a, score_b: m.score_b, sets: m.sets, decider: m.decider, winner: m.winner, retired: m.retired, score: F.scoreText(m), entered_by: m.entered_by,
        wait: decided(m) ? '' : !ready ? 'Paarung steht noch nicht fest' : busy.length ? `spielt noch: ${busy.map(name).join(', ')}` : '' };
    };
    const mvs = ms.map(mv);
    const byEst = (x, y) => String(x.est_at || '9999').localeCompare(String(y.est_at || '9999')) || x.round - y.round || x.slot - y.slot || x.id - y.id;
    const open = mvs.filter(m => !m.done && !m.bye);
    const central = { courts: cs.map(x => {
      const mine = open.filter(m => m.court_id === x.id), run = mine.find(m => m.running) || null, next = mine.filter(m => !m.running).sort(byEst)[0] || null;
      return { id: x.id, name: x.name, resource_id: x.resource_id || null, running: run, next, later: mine.filter(m => !m.running && m !== next).length };
    }), queue: open.filter(m => !m.court_id).sort(byEst) };
    const gv = groups.map(g => ({ g: g.g, label: g.label, done: g.done, table: g.table.map(r => ({ ...r, lot: undefined })), up: ft.format === 'gruppen' ? (res ? res.plan.take : c.qualify) : 0 }));
    const ko = R ? Array.from({ length: R }, (_, i) => ({ round: i + 1, label: F.koLabel(i + 1, R), matches: mvs.filter(m => m.phase === 'ko' && m.round === i + 1).sort((x, y) => x.slot - y.slot) })) : [];
    const third = mvs.find(m => m.phase === 'platz3') || null;
    const ranking = ft.format === 'schleifchen' ? F.schleifchenTable(teams.map(t => ({ id: t.id, name: t.name, lot: t.lot })), ms.filter(m => m.phase === 'runde')).map(r => ({ ...r, lot: undefined })) : null;
    const notes = res ? [...res.notes] : [];
    if (ranking && open.length === 0 && mvs.length) { const tie = ranking.filter(r => r.tie && r.rank <= 3); if (tie.length) notes.push({ kind: 'los', label: 'Gleichstand in der Rangliste – bitte das Los ziehen.', teams: tie.map(r => r.id) }); }
    const ends = mvs.filter(m => !m.bye).map(m => (m.done ? null : m.est_at)).filter(Boolean).sort();
    const lastEnd = ends.length ? hm(Z.fromMin(Z.toMin(ends[ends.length - 1]) + c.minutes)) : null;
    return { ft, c, teams, cs, ms, mvs, groups: gv, ko, third, ranking, central, notes, byEst, end: lastEnd, R };
  }
  const ftView = ft => ({ id: ft.id, name: ft.name, sport: ft.sport, format: ft.format, format_label: F.FORMATS[ft.format], date: ft.date, start: ft.start, drawn: Boolean(ft.drawn_at), drawn_at: ft.drawn_at,
    finished_at: ft.finished_at, podium: J(ft.podium, []), locked: Boolean(ft.locked), lock_from: ft.lock_from, lock_to: ft.lock_to, code: Boolean(ft.code_hash), today: ft.date === today(), purged: Boolean(ft.purged_at) });
  /** Kassenbericht Startgeld (nur mit Startgeld) */
  function money(L) {
    const fee = L.c.fee || 0, rows = L.teams.map(t => ({ fee: t.paid ? t.paid_cents || 0 : fee, paid: t.paid }));
    const sum = f => rows.filter(f).reduce((a, r) => a + r.fee, 0);
    return { fee, total: sum(() => true), bar: sum(r => r.paid === 'bar'), digital: sum(r => r.paid === 'digital'), open: sum(r => !r.paid), openCount: rows.filter(r => !r.paid && r.fee).length };
  }

  /* ---------- Spiele: Ergebnis, Start, Verlegen, Nachrücken ---------- */
  const mLabel = (L, m) => { const v = L.mvs.find(x => x.id === m.id); return `${v.label}: ${v.a || v.a_ph || '?'} – ${v.b || v.b_ph || '?'}`; };
  function saveResult(m, input, { by, admin }) {
    const ft = ftRow(m.ft_id);
    if (ft.finished_at) throw err('Das Turnier ist beendet.');
    if (m.result === 'freilos') throw err('Freilos – hier gibt es nichts einzutragen.');
    if (!m.a || !m.b) throw err('Die Paarung steht noch nicht fest.');
    const L = load(ft), c = L.c, was = decided(m) ? F.scoreText(m) : '–';
    let r;
    if (input && input.clear) {
      if (!admin) throw err('Löschen kann nur die Turnierleitung in der Verwaltung.');
      if (isKo(m) && L.ms.some(x => isKo(x) && x.round > m.round && decided(x) && x.result !== 'freilos' && [x.a, x.b].some(id => [m.a, m.b].includes(id)))) throw err('Das nächste Spiel ist schon gespielt – erst dessen Ergebnis löschen.');
      r = { result: null, a: null, b: null, sets: [], retired: null, decider: null, winner: null };
    } else r = F.checkScore(input, c, { ko: isKo(m) });
    db.prepare('UPDATE tu_ftmatch SET result = ?, score_a = ?, score_b = ?, sets = ?, retired = ?, decider = ?, winner = ?, entered_by = ?, entered_at = ?, ended_at = ? WHERE id = ?')
      .run(r.result, r.a, r.b, JSON.stringify(r.sets || []), r.retired || null, r.decider ? JSON.stringify(r.decider) : null, r.winner, r.winner ? uname(by) : null, r.winner ? nowTs() : null, r.winner ? m.ended_at || nowTs() : null, m.id);
    const now = matchRow(m.id);
    audit(by, decided(m) ? 'Turniere: Ergebnis korrigiert' : 'Turniere: Ergebnis eingetragen', `${ft.name} – ${mLabel(L, m)}: ${decided(m) ? `${was} → ` : ''}${now.winner ? F.scoreText(now) : '–'}`);
    const k = reconcile(ft);
    return { ok: true, warnings: k.warnings };
  }
  function startMatch(m, by) {
    const ft = ftRow(m.ft_id);
    if (ft.finished_at) throw err('Das Turnier ist beendet.');
    if (decided(m)) throw err('Dieses Spiel ist schon gewertet.');
    if (m.started_at) throw err('Dieses Spiel läuft schon.');
    if (!m.a || !m.b) throw err('Die Paarung steht noch nicht fest.');
    if (!m.court_id) throw err('Bitte erst einen Platz zuweisen.');
    const L = load(ft), v = L.mvs.find(x => x.id === m.id), court = L.cs.find(x => x.id === m.court_id);
    if (L.mvs.some(x => x.running && x.court_id === m.court_id)) throw err(`Auf ${court.name} läuft noch ein Spiel – erst dessen Ergebnis eintragen.`);
    if (v.wait) throw err(`Geht noch nicht – ${v.wait}.`);
    db.prepare('UPDATE tu_ftmatch SET started_at = ? WHERE id = ?').run(nowTs(), m.id);
    audit(by, 'Turniere: Spiel gestartet', `${ft.name} – ${mLabel(L, m)} (${court.name})`);
    return { ok: true };
  }
  /** Nächste Spiele starten: auf jedem freien Platz das nächste bereite Spiel (Anpfiff für alle zugleich) */
  function startNext(ft, by) {
    const L = load(ft), started = [];
    for (const x of L.central.courts) if (!x.running && x.next && !x.next.wait) { db.prepare('UPDATE tu_ftmatch SET started_at = ? WHERE id = ?').run(nowTs(), x.next.id); started.push(`${x.name}: ${x.next.a} – ${x.next.b}`); }
    if (started.length) audit(by, 'Turniere: Spiele gestartet', `${ft.name}: ${started.join('; ')}`.slice(0, 900));
    return started;
  }
  function assign(m, b, by) {
    const ft = ftRow(m.ft_id);
    if (decided(m) || m.started_at) throw err('Gestartete oder gewertete Spiele lassen sich nicht mehr verlegen.');
    const cid = b.court_id === null || b.court_id === '' || b.court_id === undefined ? null : int(b.court_id);
    if (cid && !courtsOf(ft.id).some(x => x.id === cid)) throw err('Diesen Platz gibt es nicht.');
    if (b.time && !isTime(b.time)) throw err('Bitte die Uhrzeit prüfen (z. B. 14:30).');
    const L = load(ft);
    db.prepare('UPDATE tu_ftmatch SET court_id = ?, time = ? WHERE id = ?').run(cid, b.time ? `${ft.date} ${b.time}` : cid ? m.time : null, m.id);
    audit(by, 'Turniere: Spiel verlegt', `${ft.name} – ${mLabel(L, m)}: ${cid ? L.cs.find(x => x.id === cid).name : 'Warteschlange'}${b.time ? ` ${b.time} Uhr` : ''}`);
  }
  /** Nachrücken: Ist ein Platz frei, kommt das nächste bereite Spiel (von einem anderen Platz oder aus der Warteschlange) nach vorne */
  function moveUp(ft, by) {
    const moved = [];
    for (let k = 0; k < 40; k++) {
      const L = load(ft), C = L.central;
      const free = C.courts.filter(x => !x.running && !(x.next && !x.next.wait));
      if (!free.length) break;
      const nextIds = new Set(C.courts.filter(x => x.next && !x.next.wait && !x.running).map(x => x.next.id));
      const cand = L.mvs.filter(m => !m.done && !m.bye && !m.running && !m.wait && !nextIds.has(m.id) && !(m.court_id && free.some(x => x.id === m.court_id))).sort(L.byEst)[0];
      if (!cand) break;
      const x = free[0], now = new Date();
      db.prepare('UPDATE tu_ftmatch SET court_id = ?, time = ? WHERE id = ?').run(x.id, `${ft.date} ${pad(now.getHours())}:${pad(now.getMinutes())}`, cand.id);
      moved.push(`${cand.a} – ${cand.b} → ${x.name}`);
    }
    if (moved.length) audit(by, 'Turniere: Spiele nachgerückt', `${ft.name}: ${moved.join('; ')}`.slice(0, 900));
    return moved;
  }

  /* ---------- Sperre im Buchungssystem ---------- */
  function wantedLocks(ft) {
    if (!ft.locked || ft.finished_at) return [];
    return courtsOf(ft.id).filter(x => x.resource_id).map(x => ({ resource_id: x.resource_id, date: ft.date, start: ft.lock_from || '08:00', end: ft.lock_to || '22:00' }));
  }
  async function syncLocks(ft, by, preview = false) {
    if (!bookingOn()) return { made: 0, removed: 0, conflicts: [] };
    const r = await hook('courtLock', { key: `tu:ft:${ft.id}`, locks: wantedLocks(ft), title: `Turnier: ${ft.name}`.slice(0, 160), by, preview });
    if (r && r.error) throw err(r.error);
    return r || { made: 0, removed: 0, conflicts: [] };
  }
  function lockSuggest(ft) {
    const L = ft.drawn_at ? load(ft) : null;
    const h = Math.max(0, Math.floor(minsOf(ft.start) / 60) - 1), endM = L && L.end ? minsOf(L.end) : minsOf(ft.start) + 6 * 60;
    const to = Math.min(24, Math.ceil(endM / 60) + 1);
    return { from: `${pad(h)}:00`, to: to >= 24 ? '24:00' : `${pad(to)}:00` };
  }

  /* ---------- Code der Turnierleitung (Tablet) ---------- */
  const hashCode = (code, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.scryptSync(String(code), salt, 32).toString('hex')}`;
  const codeOk = (ft, code) => {
    if (!ft.code_hash || !/^\d{4,6}$/.test(String(code || ''))) return false;
    const [salt, h] = ft.code_hash.split(':');
    const x = Buffer.from(hashCode(code, salt).split(':')[1], 'hex'), y = Buffer.from(h, 'hex');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };

  /* ---------- Spielerdaten nach der Frist löschen (Mannschaftsnamen und Ergebnisse bleiben) ---------- */
  function purge() {
    if (!ctx.isActive()) return;
    const cut = addDays(today(), -keepDays());
    for (const ft of db.prepare('SELECT * FROM tu_ft WHERE purged_at IS NULL AND date < ?').all(cut)) {
      const n = db.prepare("UPDATE tu_ftteam SET players = '[]' WHERE ft_id = ? AND players != '[]'").run(ft.id).changes;
      db.prepare('UPDATE tu_ft SET purged_at = ? WHERE id = ?').run(nowTs(), ft.id);
      if (n) audit(null, 'Turniere: Spielernamen gelöscht', `${ft.name}: ${n} Mannschaften (Löschfrist ${keepDays()} Tage)`);
    }
  }
  setInterval(() => { try { purge(); } catch (e) { console.error('Turniere – Löschfrist:', e.message); } }, process.env.CW_TEST_FAST ? 2000 : 3600000).unref();
  setTimeout(() => { try { purge(); } catch (e) { console.error('Turniere – Löschfrist:', e.message); } }, 11000).unref();

  /* ================================================================= Verwaltung (/api/admin/x/turniere/ft/…) */
  const A = ctx.admin;
  const ftOr404 = id => { const f = ftRow(id); if (!f) throw err('Turnier nicht gefunden.', 404); return f; };
  const matchOr404 = id => { const m = matchRow(id); if (!m) throw err('Spiel nicht gefunden.', 404); return m; };
  const teamOr404 = id => { const t = db.prepare('SELECT * FROM tu_ftteam WHERE id = ?').get(int(id)); if (!t) throw err('Mannschaft nicht gefunden.', 404); return t; };
  const notFinished = ft => { if (ft.finished_at) throw err('Das Turnier ist beendet – erst wieder öffnen.'); return ft; };
  const CFG_LABELS = { win: 'Punkte für einen Sieg', draw: 'Punkte für ein Unentschieden', loss: 'Punkte für eine Niederlage', scoring: 'Wertung', minutes: 'Spielzeit (Minuten)', pause: 'Pause (Minuten)',
    decider: 'Gleichstand im K.-o.', court: 'Bezeichnung', group_size: 'Gruppengröße', qualify: 'Weiter je Gruppe', third: ['Spiel um Platz 3', 'bool'], break_groups: 'Pause nach der Vorrunde (Minuten)',
    break_ko: 'Pause zwischen den K.-o.-Runden (Minuten)', rounds: 'Runden', order: 'Reihenfolge bei Gleichstand', end_warn: 'Spätestes Ende', fee: ['Startgeld', 'euro'], name: 'Name', date: 'Tag', start: 'Beginn' };
  const ORDER_WORDS = { punkte: 'Punkte', diff: 'Differenz', mehr: 'mehr Spiele/Tore', direkt: 'direkter Vergleich', los: 'Los' };
  const DECIDER_WORDS = { tb: 'Tiebreak bis 7', nm: 'Neunmeterschießen', none: 'keine (Unentschieden verboten)' };
  const showCfg = (ft, c) => ({ name: ft.name, date: deD(ft.date), start: ft.start, win: c.win, draw: c.draw, loss: c.loss, scoring: c.scoring === 'saetze' ? 'auf Sätze' : 'auf Zeit', minutes: c.minutes, pause: c.pause,
    decider: DECIDER_WORDS[c.decider], court: c.court, group_size: c.group_size, qualify: c.qualify, third: c.third, break_groups: c.break_groups, break_ko: c.break_ko, rounds: c.rounds,
    order: c.order.map(k => ORDER_WORDS[k]).join(' → '), end_warn: c.end_warn || '–', fee: c.fee });
  /** Eingaben eines Turniers prüfen → { name, sport, format, date, start, cfg } */
  function input(b, cur = null) {
    const name = txt(b.name, 80);
    if (name.length < 3) throw err('Bitte einen Namen eintragen (z. B. „Dorfturnier 2027“).');
    const sport = cur ? cur.sport : b.sport in F.SPORTS ? b.sport : null;
    if (!sport) throw err('Bitte Tennis oder Fußball wählen.');
    const format = cur && cur.drawn_at ? cur.format : b.format in F.FORMATS ? b.format : null;
    if (!format) throw err('Bitte eine Spielform wählen.');
    if (!isDate(b.date)) throw err('Bitte den Tag des Turniers eintragen.');
    if (!isTime(b.start)) throw err('Bitte die Uhrzeit des Beginns eintragen (z. B. 10:00).');
    const raw = { ...(cur ? J(cur.cfg, {}) : {}), ...(b.cfg || {}) };
    if (raw.fee !== undefined && typeof raw.fee === 'string') raw.fee = Math.round(parseFloat(raw.fee.replace(',', '.')) * 100) || 0;
    const c = F.config(sport, raw);
    if (cur && cur.drawn_at) for (const k of ['group_size', 'qualify', 'third', 'rounds']) if (JSON.stringify(c[k]) !== JSON.stringify(F.config(sport, J(cur.cfg, {}))[k])) throw err('Gruppengröße, Weiterkommen, Spiel um Platz 3 und Runden lassen sich nach der Auslosung nicht mehr ändern – erst neu auslosen.');
    if (cur && cur.drawn_at && anyResult(cur.id) && c.scoring !== F.config(sport, J(cur.cfg, {})).scoring) throw err('Die Wertung lässt sich nach den ersten Ergebnissen nicht mehr ändern.');
    const keep = Object.fromEntries(Object.keys(c).filter(k => k !== 'unit').map(k => [k, c[k]]));
    return { name, sport, format, date: b.date, start: b.start, cfg: keep };
  }
  A.get('/ft/liste', P, (req, res) => res.json({
    list: db.prepare('SELECT id, name, sport, format, date, start, drawn_at, finished_at FROM tu_ft ORDER BY date DESC, id DESC').all(),
    sports: Object.fromEntries(Object.entries(F.SPORTS).map(([k, v]) => [k, { ...v, ...F.config(k, {}) }])), formats: F.FORMATS, booking: bookingOn(), keep_days: keepDays(), keep: KEEP }));
  A.post('/ft/vorschau', P, send(async req => {
    const b = req.body || {}, sport = b.sport in F.SPORTS ? b.sport : 'tennis';
    return simulate(b.format in F.FORMATS ? b.format : 'gruppen', F.config(sport, b.cfg || {}), Math.min(MAX_TEAMS, int(b.n)), Math.min(30, int(b.courts)), b.date, b.start) || {};
  }));
  A.post('/ft', P, send(async req => {
    const b = req.body || {}, v = input(b);
    const n = Math.min(30, Math.max(1, int(b.courts) || 4)), c = F.config(v.sport, v.cfg);
    let id;
    db.transaction(() => {
      id = Number(db.prepare('INSERT INTO tu_ft(name, sport, format, date, start, cfg, monitor_key, created_by) VALUES (?,?,?,?,?,?,?,?)').run(v.name, v.sport, v.format, v.date, v.start, JSON.stringify(v.cfg), newKey(), uname(req.user)).lastInsertRowid);
      for (let i = 1; i <= n; i++) db.prepare('INSERT INTO tu_ftcourt(ft_id, name, sort) VALUES (?,?,?)').run(id, `${c.court} ${i}`, i);
    })();
    audit(req.user, 'Turniere: Turnier angelegt', `${v.name}: ${F.SPORTS[v.sport].label}, ${F.FORMATS[v.format]}, ${deD(v.date)} ${v.start} Uhr, ${n} ${n === 1 ? c.court : c.court === 'Spielfeld' ? 'Spielfelder' : c.court === 'Feld' ? 'Felder' : 'Plätze'}`);
    return { ok: true, id };
  }));
  /** volle Ansicht für die Verwaltung */
  A.get('/ft/:id', P, send(async req => {
    const ft = ftOr404(req.params.id), L = load(ft), c = L.c, base = ctx.getSetting('app_url', '') || ctx.appUrl();
    return { ft: ftView(ft), cfg: c, now: nowTs(), booking: bookingOn(), unit: unitWord(c),
      teams: L.teams.map(t => ({ id: t.id, name: t.name, players: t.players, seed: t.seed, grp: t.grp, group: t.grp != null ? F.groupLabel(t.grp) : null, checked_in: Boolean(t.checked_in_at), paid: t.paid, fee: t.paid ? t.paid_cents || 0 : c.fee,
        matches: L.ms.filter(m => [m.a, m.b, m.a2, m.b2].includes(t.id)).length })),
      courts: L.cs.map(x => ({ id: x.id, name: x.name, resource_id: x.resource_id || null, used: L.ms.some(m => m.court_id === x.id || m.plan_court === x.id) })),
      matches: L.mvs.filter(m => !m.bye).sort(L.byEst), all: L.mvs, groups: L.groups, ko: L.ko, third: L.third, ranking: L.ranking, central: L.central, notes: L.notes, end: L.end,
      preview: ft.drawn_at ? null : simulate(ft.format, c, L.teams.length, L.cs.length, ft.date, ft.start), kasse: money(L), lockSuggest: lockSuggest(ft),
      monitor_path: `p/turniere/monitor.html#k=${ft.monitor_key}`, monitor: base ? `${base.replace(/\/+$/, '')}/p/turniere/monitor.html#k=${ft.monitor_key}` : null };
  }));
  A.put('/ft/:id', P, send(async req => {
    const ft = notFinished(ftOr404(req.params.id)), v = input(req.body || {}, ft);
    const before = showCfg(ft, cfgOf(ft));
    db.prepare('UPDATE tu_ft SET name = ?, format = ?, date = ?, start = ?, cfg = ? WHERE id = ?').run(v.name, v.format, v.date, v.start, JSON.stringify(v.cfg), ft.id);
    const now = ftRow(ft.id), df = ctx.auditDiff(CFG_LABELS, before, showCfg(now, cfgOf(now)));
    if (df) audit(req.user, 'Turniere: Turnier geändert', `${now.name}: ${df}`);
    if (ft.drawn_at && !anyResult(ft.id) && (ft.date !== v.date || ft.start !== v.start || JSON.stringify(J(ft.cfg, {})) !== JSON.stringify(v.cfg))) writePlan(now);   // noch nichts gespielt: Zeitplan folgt
    else if (ft.drawn_at) reconcile(now);
    if (now.locked && ft.date !== v.date) await syncLocks(now, req.user).catch(() => {});
    return { ok: true };
  }));
  A.delete('/ft/:id', P, send(async req => {
    const ft = ftOr404(req.params.id);
    if (ft.locked) await syncLocks({ ...ft, locked: 0 }, req.user).catch(() => {});
    db.transaction(() => { for (const t of ['tu_ftmatch', 'tu_ftcourt', 'tu_ftteam']) db.prepare(`DELETE FROM ${t} WHERE ft_id = ?`).run(ft.id); db.prepare('DELETE FROM tu_ft WHERE id = ?').run(ft.id); })();
    audit(req.user, 'Turniere: Turnier gelöscht', ft.name);
    return { ok: true };
  }));
  /* Mannschaften */
  const teamInput = (b, ft, self = null) => {
    const name = txt(b.name, 60);
    if (name.length < 2) throw err('Bitte einen Namen eintragen.');
    if (db.prepare('SELECT 1 FROM tu_ftteam WHERE ft_id = ? AND lower(name) = lower(?) AND id != ?').get(ft.id, name, self || 0)) throw err(`„${name}“ gibt es schon.`);
    const players = (Array.isArray(b.players) ? b.players : String(b.players || '').split(/[,;\n]/)).map(x => txt(x, 60)).filter(x => x.length >= 2).slice(0, 20);
    const seed = b.seed === '' || b.seed == null ? null : int(b.seed);
    if (seed != null && !(seed >= 1 && seed <= 64)) throw err('Setzliste: bitte eine Zahl von 1 bis 64.');
    if (seed != null && db.prepare('SELECT 1 FROM tu_ftteam WHERE ft_id = ? AND seed = ? AND id != ?').get(ft.id, seed, self || 0)) throw err(`Platz ${seed} der Setzliste ist schon vergeben.`);
    return { name, players, seed };
  };
  A.post('/ft/:id/team', P, send(async req => {
    const ft = notFinished(ftOr404(req.params.id));
    if (ft.drawn_at) throw err('Schon ausgelost – neue Mannschaften erst nach „Neu auslosen“.');
    if (db.prepare('SELECT COUNT(*) n FROM tu_ftteam WHERE ft_id = ?').get(ft.id).n >= MAX_TEAMS) throw err(`Höchstens ${MAX_TEAMS} Mannschaften.`);
    const v = teamInput(req.body || {}, ft);
    db.prepare('INSERT INTO tu_ftteam(ft_id, name, players, seed) VALUES (?,?,?,?)').run(ft.id, v.name, JSON.stringify(v.players), v.seed);
    audit(req.user, 'Turniere: Mannschaft angelegt', `${ft.name}: ${v.name}${v.players.length ? ` (${v.players.length} Spieler)` : ''}${v.seed ? `, gesetzt ${v.seed}` : ''}`);
    return { ok: true };
  }));
  A.put('/ft/team/:tid', P, send(async req => {
    const t = teamOr404(req.params.tid), ft = notFinished(ftRow(t.ft_id)), v = teamInput(req.body || {}, ft, t.id);
    if (ft.drawn_at && (v.seed || null) !== (t.seed || null)) throw err('Die Setzliste wirkt nur bei der Auslosung – erst neu auslosen.');
    db.prepare('UPDATE tu_ftteam SET name = ?, players = ?, seed = ? WHERE id = ?').run(v.name, JSON.stringify(v.players), v.seed, t.id);
    const df = ctx.auditDiff({ name: 'Name', players: ['Spieler', 'list'], seed: 'Setzliste' }, { name: t.name, players: J(t.players, []), seed: t.seed || '–' }, { name: v.name, players: v.players, seed: v.seed || '–' });
    if (df) audit(req.user, 'Turniere: Mannschaft geändert', `${ft.name}, ${t.name}: ${df}`);
    return { ok: true };
  }));
  A.delete('/ft/team/:tid', P, send(async req => {
    const t = teamOr404(req.params.tid), ft = notFinished(ftRow(t.ft_id));
    if (ft.drawn_at) throw err('Schon ausgelost – erst „Neu auslosen“ (geht, solange noch kein Ergebnis steht).');
    db.prepare('DELETE FROM tu_ftteam WHERE id = ?').run(t.id);
    audit(req.user, 'Turniere: Mannschaft entfernt', `${ft.name}: ${t.name}`);
    return { ok: true };
  }));
  /** Startgeld und „da“ */
  A.post('/ft/team/:tid/checkin', P, send(async req => {
    const t = teamOr404(req.params.tid), ft = notFinished(ftRow(t.ft_id)), b = req.body || {}, log = [];
    if (b.checkin !== undefined && Boolean(b.checkin) !== Boolean(t.checked_in_at)) { db.prepare('UPDATE tu_ftteam SET checked_in_at = ? WHERE id = ?').run(b.checkin ? nowTs() : null, t.id); log.push(b.checkin ? 'da' : 'nicht mehr da'); }
    if (b.paid !== undefined && (b.paid || null) !== (t.paid || null)) {
      if (b.paid && !['bar', 'digital'].includes(b.paid)) throw err('Bitte „bar“ oder „digital“ wählen.');
      const cents = b.paid ? cfgOf(ft).fee : null;
      db.prepare('UPDATE tu_ftteam SET paid = ?, paid_cents = ?, paid_at = ?, paid_by = ? WHERE id = ?').run(b.paid || null, cents, b.paid ? nowTs() : null, b.paid ? uname(req.user) : null, t.id);
      log.push(b.paid ? `Startgeld ${euro(cents)} ${b.paid}` : 'Zahlung zurückgenommen');
    }
    if (log.length) audit(req.user, 'Turniere: Startgeld', `${ft.name} – ${t.name}: ${log.join(', ')}`);
    return { ok: true };
  }));
  /** Mannschaften aus Excel oder CSV: eine Spalte mit Namen genügt (Kopfzeile „Name“/„Mannschaft“ oder die erste Spalte); weitere Spalten = Spieler */
  A.post('/ft/:id/import', P, send(async req => {
    const ft = notFinished(ftOr404(req.params.id)), b = req.body || {};
    if (ft.drawn_at) throw err('Schon ausgelost – importieren geht nur vorher.');
    if (Array.isArray(b.rows)) {
      const have = new Set(teamsOf(ft.id).map(t => t.name.toLowerCase()));
      let n = 0;
      db.transaction(() => {
        for (const r of b.rows.slice(0, MAX_TEAMS)) {
          const name = txt(r && r.name, 60); if (name.length < 2 || have.has(name.toLowerCase())) continue;
          if (have.size >= MAX_TEAMS) break;
          const players = (Array.isArray(r.players) ? r.players : []).map(x => txt(x, 60)).filter(x => x.length >= 2).slice(0, 20);
          db.prepare('INSERT INTO tu_ftteam(ft_id, name, players) VALUES (?,?,?)').run(ft.id, name, JSON.stringify(players)); have.add(name.toLowerCase()); n++;
        }
      })();
      audit(req.user, 'Turniere: Mannschaften importiert', `${ft.name}: ${n} Mannschaften`);
      return { ok: true, n };
    }
    const buf = Buffer.from(String(b.file || ''), 'base64');
    if (!buf.length) throw err('Bitte eine Datei wählen.');
    if (buf.length > 2 * 1024 * 1024) throw err('Die Datei ist zu groß (höchstens 2 MB).');
    let rows;
    if (/\.xlsx$/i.test(String(b.name || ''))) {
      const wb = new (ctx.require('exceljs').Workbook)();
      try { await wb.xlsx.load(buf); } catch (e) { throw err('Die Excel-Datei ist nicht lesbar.'); }
      const ws = wb.worksheets[0]; rows = [];
      if (ws) ws.eachRow({ includeEmpty: false }, r => { rows.push(r.values.slice(1).map(v => (v && typeof v === 'object' ? (v.text || v.result || (v.richText ? v.richText.map(x => x.text).join('') : '')) : v))); });
    } else {
      let t = buf.toString('utf8');
      if (t.includes('�')) t = buf.toString('latin1');
      t = t.replace(/^﻿/, '');
      const first = t.split('\n')[0], sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : (first.match(/,/g) || []).length ? ',' : '\t';
      rows = t.split(/\r?\n/).filter(x => x.trim()).map(l => l.split(sep).map(x => x.replace(/^"|"$/g, '').trim()));
    }
    const head = (rows[0] || []).map(x => String(x || '').trim().toLowerCase());
    let ci = head.findIndex(h => /^(name|mannschaft|team|teilnehmer|spieler)$/.test(h)), start = 1;
    if (ci < 0) { ci = 0; start = /^(name|mannschaft|team)/.test(head[0] || '') ? 1 : 0; }
    const out = rows.slice(start).map(r => ({ name: txt(r[ci], 60), players: r.filter((x, i) => i !== ci).map(x => txt(x, 60)).filter(x => x.length >= 2) })).filter(r => r.name.length >= 2).slice(0, MAX_TEAMS);
    if (!out.length) throw err('In der Datei stehen keine Namen – gebraucht wird eine Spalte mit den Mannschaften (Kopfzeile „Name“ oder „Mannschaft“).');
    const have = new Set(teamsOf(ft.id).map(t => t.name.toLowerCase()));
    return { rows: out.map(r => ({ ...r, dup: have.has(r.name.toLowerCase()) })) };
  }));
  /* Auslosung, Tausch, Zeitplan */
  A.post('/ft/:id/auslosen', P, send(async req => draw(notFinished(ftOr404(req.params.id)), { seeded: Boolean((req.body || {}).seeded) }, req.user)));
  A.post('/ft/:id/zuruecksetzen', P, send(async req => {   // Auslosung aufheben (z. B. um Mannschaften nachzutragen)
    const ft = notFinished(ftOr404(req.params.id));
    if (anyResult(ft.id)) throw err('Es gibt schon Ergebnisse – die Auslosung bleibt.');
    db.transaction(() => { db.prepare('DELETE FROM tu_ftmatch WHERE ft_id = ?').run(ft.id); db.prepare('UPDATE tu_ftteam SET grp = NULL, lot = NULL WHERE ft_id = ?').run(ft.id); db.prepare('UPDATE tu_ft SET drawn_at = NULL WHERE id = ?').run(ft.id); })();
    audit(req.user, 'Turniere: Auslosung aufgehoben', ft.name);
    return { ok: true };
  }));
  /** zwei Mannschaften zwischen Gruppen tauschen (solange in beiden Gruppen nichts gespielt ist) */
  A.post('/ft/:id/tausch', P, send(async req => {
    const ft = notFinished(ftOr404(req.params.id)), b = req.body || {};
    const x = db.prepare('SELECT * FROM tu_ftteam WHERE id = ? AND ft_id = ?').get(int(b.a), ft.id), y = db.prepare('SELECT * FROM tu_ftteam WHERE id = ? AND ft_id = ?').get(int(b.b), ft.id);
    if (ft.format !== 'gruppen' || !x || !y || x.grp == null || y.grp == null || x.grp === y.grp) throw err('Bitte zwei Mannschaften aus verschiedenen Gruppen wählen.');
    const played = g => db.prepare("SELECT 1 FROM tu_ftmatch WHERE ft_id = ? AND phase = 'gruppe' AND grp = ? AND (winner IS NOT NULL OR started_at IS NOT NULL)").get(ft.id, g);
    if (played(x.grp) || played(y.grp)) throw err('In einer der Gruppen läuft oder steht schon ein Spiel – tauschen geht nicht mehr.');
    db.transaction(() => {
      db.prepare('UPDATE tu_ftteam SET grp = ? WHERE id = ?').run(y.grp, x.id); db.prepare('UPDATE tu_ftteam SET grp = ? WHERE id = ?').run(x.grp, y.id);
      // die Spiele behalten Platz und Uhrzeit – nur die Mannschaften wechseln die Seiten
      for (const [from, to] of [[x.id, -1], [y.id, x.id], [-1, y.id]]) { db.prepare("UPDATE tu_ftmatch SET a = ? WHERE ft_id = ? AND phase = 'gruppe' AND a = ?").run(to, ft.id, from); db.prepare("UPDATE tu_ftmatch SET b = ? WHERE ft_id = ? AND phase = 'gruppe' AND b = ?").run(to, ft.id, from); }
    })();
    audit(req.user, 'Turniere: Mannschaften getauscht', `${ft.name}: ${x.name} (${groupName(x.grp)}) ↔ ${y.name} (${groupName(y.grp)})`);
    return { ok: true };
  }));
  A.post('/ft/:id/zeitplan', P, send(async req => {
    const ft = notFinished(ftOr404(req.params.id));
    if (!ft.drawn_at) throw err('Erst auslosen.');
    if (anyResult(ft.id)) throw err('Es läuft schon – einzelne Spiele verlegst du in der Zentrale („Nachrücken“ oder Spiel antippen).');
    const p = writePlan(ft);
    audit(req.user, 'Turniere: Zeitplan neu berechnet', `${ft.name}: Ende etwa ${p.end.slice(11, 16)} Uhr`);
    return { ok: true, ...p };
  }));
  A.post('/ft/:id/ursprung', P, send(async req => {
    const ft = notFinished(ftOr404(req.params.id));
    let n = 0;
    for (const m of matchesOf(ft.id).filter(x => !x.started_at && !decided(x) && x.plan_time)) {
      if ((m.court_id || null) === (m.plan_court || null) && m.time === m.plan_time) continue;
      db.prepare('UPDATE tu_ftmatch SET court_id = ?, time = ? WHERE id = ?').run(m.plan_court, m.plan_time, m.id); n++;
    }
    if (n) audit(req.user, 'Turniere: ursprüngliche Planung', `${ft.name}: ${n} Spiele zurück auf den Spielplan`);
    return { ok: true, n };
  }));
  A.post('/ft/:id/nachruecken', P, send(async req => ({ ok: true, moved: moveUp(notFinished(ftOr404(req.params.id)), req.user) })));
  A.post('/ft/:id/starten', P, send(async req => ({ ok: true, started: startNext(notFinished(ftOr404(req.params.id)), req.user) })));
  /** Los ziehen bei Gleichstand (die Turnierleitung drückt den Knopf; protokolliert) */
  A.post('/ft/:id/los', P, send(async req => {
    const ft = notFinished(ftOr404(req.params.id)), ids = [...new Set((Array.isArray((req.body || {}).teams) ? req.body.teams : []).map(int))];
    const ts = ids.map(id => db.prepare('SELECT * FROM tu_ftteam WHERE id = ? AND ft_id = ?').get(id, ft.id)).filter(Boolean);
    if (ts.length < 2) throw err('Bitte die Mannschaften mit Gleichstand wählen.');
    const order = W.shuffle(ts);
    db.transaction(() => order.forEach((t, i) => db.prepare('UPDATE tu_ftteam SET lot = ? WHERE id = ?').run(i + 1, t.id)))();
    audit(req.user, 'Turniere: Los gezogen', `${ft.name}: ${order.map((t, i) => `${i + 1}. ${t.name}`).join(', ')}`);
    reconcile(ftRow(ft.id));
    return { ok: true, order: order.map(t => t.name) };
  }));
  /* Spiele */
  A.put('/ft/spiel/:mid', P, send(async req => { const m = matchOr404(req.params.mid); notFinished(ftRow(m.ft_id)); assign(m, req.body || {}, req.user); return { ok: true }; }));
  A.post('/ft/spiel/:mid/start', P, send(async req => startMatch(matchOr404(req.params.mid), req.user)));
  A.post('/ft/spiel/:mid/stopp', P, send(async req => {
    const m = matchOr404(req.params.mid);
    if (!m.started_at || decided(m)) throw err('Dieses Spiel läuft nicht.');
    db.prepare('UPDATE tu_ftmatch SET started_at = NULL WHERE id = ?').run(m.id);
    const ft = ftRow(m.ft_id);
    audit(req.user, 'Turniere: Start zurückgenommen', `${ft.name} – ${mLabel(load(ft), m)}`);
    return { ok: true };
  }));
  A.post('/ft/spiel/:mid/ergebnis', P, send(async req => saveResult(matchOr404(req.params.mid), req.body || {}, { by: req.user, admin: true })));
  /* Plätze, Sperre */
  A.get('/ft-buchungsplaetze', P, send(async () => (bookingOn() ? (await hook('courtList')) || [] : [])));
  A.post('/ft/:id/platz', P, send(async req => {
    const ft = notFinished(ftOr404(req.params.id)), name = txt((req.body || {}).name, 40);
    if (name.length < 2) throw err('Bitte einen Namen eintragen.');
    if (courtsOf(ft.id).some(x => x.name.toLowerCase() === name.toLowerCase())) throw err('Diesen Platz gibt es schon.');
    db.prepare('INSERT INTO tu_ftcourt(ft_id, name, sort) VALUES (?,?,?)').run(ft.id, name, courtsOf(ft.id).reduce((a, x) => Math.max(a, x.sort), 0) + 1);
    audit(req.user, 'Turniere: Platz angelegt', `${ft.name}: ${name}`);
    return { ok: true };
  }));
  A.put('/ft/platz/:cid', P, send(async req => {
    const x = db.prepare('SELECT * FROM tu_ftcourt WHERE id = ?').get(int(req.params.cid)); if (!x) throw err('Platz nicht gefunden.', 404);
    const ft = notFinished(ftRow(x.ft_id)), b = req.body || {};
    let rid = x.resource_id;
    if (b.resource_id !== undefined) {
      rid = b.resource_id ? int(b.resource_id) : null;
      if (rid) {
        const list = bookingOn() ? (await hook('courtList')) || [] : [];
        if (!list.some(r => r.id === rid)) throw err('Diesen Platz gibt es im Buchungssystem nicht.');
        if (courtsOf(ft.id).some(y => y.id !== x.id && y.resource_id === rid)) throw err('Dieser Platz des Buchungssystems ist schon einem anderen Turnierplatz zugeordnet.');
      }
    }
    const name = b.name !== undefined ? txt(b.name, 40) : x.name;
    if (name.length < 2) throw err('Bitte einen Namen eintragen.');
    db.prepare('UPDATE tu_ftcourt SET name = ?, resource_id = ? WHERE id = ?').run(name, rid, x.id);
    const rn = new Map(((bookingOn() ? await hook('courtList') : null) || []).map(r => [r.id, r.name]));
    const df = ctx.auditDiff({ name: 'Name', resource: 'Platz im Buchungssystem' }, { name: x.name, resource: rn.get(x.resource_id) || '–' }, { name, resource: rn.get(rid) || '–' });
    if (df) audit(req.user, 'Turniere: Platz geändert', `${ft.name}, ${x.name}: ${df}`);
    if (ft.locked && rid !== x.resource_id) await syncLocks(ftRow(ft.id), req.user);
    return { ok: true };
  }));
  A.delete('/ft/platz/:cid', P, send(async req => {
    const x = db.prepare('SELECT * FROM tu_ftcourt WHERE id = ?').get(int(req.params.cid)); if (!x) throw err('Platz nicht gefunden.', 404);
    const ft = notFinished(ftRow(x.ft_id));
    if (db.prepare('SELECT 1 FROM tu_ftmatch WHERE court_id = ? OR plan_court = ?').get(x.id, x.id)) throw err('Auf diesem Platz sind Spiele eingeplant – erst neu auslosen oder verlegen.');
    if (courtsOf(ft.id).length <= 1) throw err('Ein Platz muss bleiben.');
    db.prepare('DELETE FROM tu_ftcourt WHERE id = ?').run(x.id);
    audit(req.user, 'Turniere: Platz entfernt', `${ft.name}: ${x.name}`);
    if (ft.locked && x.resource_id) await syncLocks(ft, req.user);
    return { ok: true };
  }));
  A.post('/ft/:id/sperre', P, send(async req => {
    const ft = ftOr404(req.params.id), b = req.body || {};
    if (!bookingOn()) throw err('Das Modul „Plätze“ ist nicht aktiv – es gibt nichts zu sperren.');
    if (b.off) { db.prepare('UPDATE tu_ft SET locked = 0 WHERE id = ?').run(ft.id); const r = await syncLocks(ftRow(ft.id), req.user); return { ok: true, ...r }; }
    notFinished(ft);
    const from = b.from || ft.lock_from || lockSuggest(ft).from, to = b.to || ft.lock_to || lockSuggest(ft).to;
    if (!isTime(from) || !(isTime(to) || to === '24:00') || to <= from) throw err('Bitte die Zeiten prüfen (z. B. 08:00 bis 20:00).');
    if (!courtsOf(ft.id).some(x => x.resource_id)) throw err('Erst die Turnierplätze den Plätzen des Buchungssystems zuordnen.');
    const next = { ...ft, locked: 1, lock_from: from, lock_to: to };
    if (b.preview) return await syncLocks(next, req.user, true);
    db.prepare('UPDATE tu_ft SET locked = 1, lock_from = ?, lock_to = ? WHERE id = ?').run(from, to, ft.id);
    return { ok: true, ...(await syncLocks(ftRow(ft.id), req.user)) };
  }));
  /* Monitor-Link, QR-Codes, Code der Turnierleitung */
  A.post('/ft/:id/monitor', P, send(async req => {
    const ft = ftOr404(req.params.id);
    db.prepare('UPDATE tu_ft SET monitor_key = ? WHERE id = ?').run(newKey(), ft.id);
    audit(req.user, 'Turniere: Monitor-Link erneuert', `${ft.name} – der alte Link gilt nicht mehr`);
    return { ok: true };
  }));
  A.get('/ft/:id/qr', P, send(async req => {
    const ft = ftOr404(req.params.id), base = (ctx.getSetting('app_url', '') || ctx.appUrl()).replace(/\/+$/, '');
    if (!base) return { url: null, list: [] };
    const QR = ctx.require('qrcode'), url = t => `${base}/p/turniere/monitor.html#k=${ft.monitor_key}${t ? `&t=${t}` : ''}`;
    const svg = u => QR.toString(u, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    if (req.query.alle) { const list = []; for (const t of teamsOf(ft.id).sort((x, y) => x.name.localeCompare(y.name, 'de'))) list.push({ name: t.name, svg: await svg(url(t.id)) }); return { url: base, list }; }
    const t = req.query.team ? teamsOf(ft.id).find(x => x.id === int(req.query.team)) : null;
    return { url: url(t ? t.id : null), svg: await svg(url(t ? t.id : null)), name: t ? t.name : ft.name };
  }));
  A.post('/ft/:id/code', P, send(async req => {
    const ft = ftOr404(req.params.id), code = String((req.body || {}).code || '').trim();
    if (code === '') { db.prepare('UPDATE tu_ft SET code_hash = NULL WHERE id = ?').run(ft.id); audit(req.user, 'Turniere: Code der Turnierleitung entfernt', ft.name); return { ok: true }; }
    if (!/^\d{4,6}$/.test(code)) throw err('Bitte 4 bis 6 Ziffern.');
    if (/^(\d)\1+$/.test(code) || '01234567890'.includes(code) || '98765432109'.includes(code)) throw err('Bitte keine einfache Folge wie 1234 oder 1111.');
    db.prepare('UPDATE tu_ft SET code_hash = ? WHERE id = ?').run(hashCode(code), ft.id);
    audit(req.user, 'Turniere: Code der Turnierleitung festgelegt', ft.name);
    return { ok: true };
  }));
  /** Turnier beenden → Ehrentafel; undo = wieder öffnen */
  A.post('/ft/:id/abschluss', P, send(async req => {
    const ft = ftOr404(req.params.id), b = req.body || {};
    if (b.undo) {
      db.prepare('UPDATE tu_ft SET finished_at = NULL WHERE id = ?').run(ft.id);
      audit(req.user, 'Turniere: Turnier wieder geöffnet', ft.name);
      if (ft.locked) await syncLocks(ftRow(ft.id), req.user).catch(() => {});
      return { ok: true };
    }
    if (!ft.drawn_at) throw err('Das Turnier ist noch nicht ausgelost.');
    const pod = podium(ft), open = matchesOf(ft.id).filter(m => !decided(m)).length;
    if (b.preview) return { podium: pod, open };
    db.prepare('UPDATE tu_ft SET finished_at = ?, podium = ? WHERE id = ?').run(nowTs(), JSON.stringify(pod), ft.id);
    audit(req.user, 'Turniere: Turnier beendet', `${ft.name}${pod.length ? ': ' + pod.map(p => `${p.place}. ${p.name}`).join(', ') : ''}${open ? ` · ${open} Spiele offen geblieben` : ''}`);
    if (ft.locked) await syncLocks(ftRow(ft.id), req.user).catch(() => {});
    return { ok: true, podium: pod };
  }));
  A.get('/ft-ehrentafel', P, (req, res) => res.json(db.prepare('SELECT id, name, sport, format, date, podium FROM tu_ft WHERE finished_at IS NOT NULL ORDER BY date DESC, id DESC').all().map(r => ({ ...r, year: r.date.slice(0, 4), podium: J(r.podium, []) }))));
  A.put('/ft-einstellungen', P, (req, res) => {
    const b = req.body || {}, before = keepDays();
    if (!KEEP.includes(int(b.keep_days))) return bad(res, 'Bitte eine Löschfrist wählen.');
    SET('keep_days', int(b.keep_days));
    if (before !== keepDays()) audit(req.user, 'Turniere: Einstellungen geändert', ctx.auditDiff({ keep: 'Löschfrist Spielernamen (Tage)' }, { keep: before }, { keep: keepDays() }));
    res.json({ ok: true });
  });

  /* ================================================================= Tablet (/api/tablet/x/turniere/ft/…) – im Vereins-WLAN, Tablet-Passwort; schreiben nur mit dem Code der Turnierleitung */
  const TB = ctx.tablet;
  const tabletFt = id => { const ft = ftRow(id); if (!ft || ft.date !== today() || ft.finished_at || !ft.drawn_at) throw err('Turnier nicht gefunden.', 404); return ft; };
  const leitung = (ft, b) => { if (!ft.code_hash) throw err('Für dieses Turnier ist kein Code der Turnierleitung festgelegt (Verwaltung › Turnierplaner › Einstellungen).', 403); if (!codeOk(ft, (b || {}).code)) throw err('Der Code stimmt nicht.', 403); return { username: 'Turnierleitung (Tablet)', name: 'Turnierleitung (Tablet)' }; };
  const codeLimit = ctx.rateLimit('tuftcode', 20, 10 * 60000);
  /** Ansicht für Tablet und Monitor (nur Namen und Ergebnisse) */
  const strip = m => m && { id: m.id, phase: m.phase, label: m.label, ko: m.ko, a: m.a, b: m.b, a_ph: m.a_ph, b_ph: m.b_ph, court_id: m.court_id, court: m.court, time: m.time, est: m.est, delay: m.delay, running: m.running, done: m.done, left: m.left, minutes: m.minutes,
    result: m.result, score_a: m.score_a, score_b: m.score_b, sets: m.sets, decider: m.decider, winner: m.winner, retired: m.retired, score: m.score, wait: m.wait, a_ids: m.a_ids, b_ids: m.b_ids, group: m.group };
  function publicView(ft) {
    const L = load(ft), c = L.c;
    return { ft: { id: ft.id, name: ft.name, sport: ft.sport, format: ft.format, format_label: F.FORMATS[ft.format], date: ft.date, start: ft.start, finished: Boolean(ft.finished_at), podium: J(ft.podium, []) },
      cfg: { court: c.court, unit: c.unit, scoring: c.scoring, minutes: c.minutes, decider: c.decider, win: c.win, draw: c.draw, loss: c.loss }, unit: unitWord(c), now: nowTs(), end: L.end,
      courts: L.central.courts.map(x => ({ id: x.id, name: x.name, running: strip(x.running), next: strip(x.next) })), queue: L.central.queue.slice(0, 12).map(strip),
      upcoming: L.mvs.filter(m => !m.done && !m.bye && !m.running).sort(L.byEst).slice(0, 40).map(strip),
      results: L.mvs.filter(m => m.done && !m.bye).sort((x, y) => String(y.est_at || '').localeCompare(String(x.est_at || '')) || y.id - x.id).slice(0, 16).map(strip),
      groups: L.groups.map(g => ({ ...g, table: g.table.map(r => ({ rank: r.rank, id: r.id, name: r.name, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost, games: r.games, diff: r.diff, pts: r.pts, sets: r.sets, tie: r.tie })) })),
      ko: L.ko.map(r => ({ ...r, matches: r.matches.map(strip) })), third: strip(L.third), ranking: L.ranking,
      teams: L.teams.map(t => ({ id: t.id, name: t.name, group: t.grp != null ? F.groupLabel(t.grp) : null })) };
  }
  TB.get('/ft/heute', send(async () => ({ list: todays().map(ft => ({ ...publicView(ft), code: Boolean(ft.code_hash) })) })));
  TB.post('/ft/:id/pruefen', codeLimit, send(async req => { leitung(tabletFt(req.params.id), req.body); return { ok: true }; }));
  const tabletMatch = id => { const m = matchOr404(id); tabletFt(m.ft_id); return m; };
  TB.post('/ft/spiel/:mid/ergebnis', codeLimit, send(async req => { const m = tabletMatch(req.params.mid); const by = leitung(ftRow(m.ft_id), req.body); return saveResult(m, req.body || {}, { by, admin: false }); }));
  TB.post('/ft/spiel/:mid/start', codeLimit, send(async req => { const m = tabletMatch(req.params.mid); const by = leitung(ftRow(m.ft_id), req.body); return startMatch(m, by); }));
  TB.post('/ft/:id/starten', codeLimit, send(async req => { const ft = tabletFt(req.params.id); const by = leitung(ft, req.body); return { ok: true, started: startNext(ft, by) }; }));
  TB.post('/ft/:id/nachruecken', codeLimit, send(async req => { const ft = tabletFt(req.params.id); const by = leitung(ft, req.body); return { ok: true, moved: moveUp(ft, by) }; }));

  /* ================================================================= Monitor ohne Anmeldung (/api/p/turniere/ft/<schlüssel>) – nur lesend */
  /** Der Link gilt bis eine Woche nach dem Turniertag; „Monitor-Link erneuern“ macht ihn sofort ungültig */
  ctx.public.get('/ft/:key', ctx.rateLimit('tuftmon', 120, 60000), (req, res) => {
    res.set('Cache-Control', 'no-store');
    const k = String(req.params.key || '');
    const ft = /^[A-Za-z0-9_-]{32}$/.test(k) ? db.prepare('SELECT * FROM tu_ft WHERE monitor_key = ?').get(k) : null;
    if (!ft || ft.date < addDays(today(), -7)) return res.status(404).json({ error: 'Dieser Link gilt nicht (mehr) – bitte bei der Turnierleitung einen neuen holen.' });
    res.json({ club: ctx.getSetting('club_name', ''), drawn: Boolean(ft.drawn_at), ...publicView(ft) });
  });

  /* ---------- für den Kern ---------- */
  return {
    tabletVisible: () => todays().length > 0,
    overview: () => {
      const alerts = [];
      for (const ft of todays()) {
        const L = load(ft), late = L.mvs.filter(m => !m.done && !m.bye && m.delay >= 15).length;
        if (late) alerts.push({ level: 'a', text: `${ft.name}: ${late} ${late === 1 ? 'Spiel liegt' : 'Spiele liegen'} mehr als 15 Minuten hinter dem Plan.` });
      }
      return { kpis: [], alerts };
    },
    retention: () => ({ id: 'frei', label: 'Turnierplaner: Spielernamen der Mannschaften', text: 'Nach dem Turnier; Mannschaftsnamen, Ergebnisse und Ehrentafel bleiben.', unit: 'tage', value: keepDays(), def: 365, min: KEEP[0], max: KEEP[KEEP.length - 1], choices: KEEP,
      due: cut => db.prepare("SELECT COUNT(*) n FROM tu_ftteam t JOIN tu_ft f ON f.id = t.ft_id WHERE f.purged_at IS NULL AND f.date < ? AND t.players != '[]'").get(cut).n,
      set: v => { if (!KEEP.includes(v)) throw new Error('Bitte eine der angebotenen Löschfristen wählen.'); SET('keep_days', v); } }),
    privacy: { title: 'Turniere: Turnierplaner', purpose: 'Durchführung eigener Turniere (z. B. Dorfturnier): Mannschaften, Spielplan, Ergebnisse, Ehrentafel', data: 'Mannschaftsname, optional Namen der Spieler (auch Gäste), Startgeld', persons: 'Teilnehmende, auch Gäste' },
    exportCfg: () => ({ keep_days: keepDays() }),
    importCfg: s => { if (KEEP.includes(int((s || {}).keep_days))) SET('keep_days', int(s.keep_days)); },
  };
}

module.exports = { activate };
