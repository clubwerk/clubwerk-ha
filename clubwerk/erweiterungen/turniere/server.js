'use strict';
/* =====================================================================================================
   Modul „Turniere“ – erster Teil: Clubmeisterschaft
   Saison mit Ligen (A, B, C …), jede Liga in 1–2 Gruppen „jeder gegen jeden“ (2 Gewinnsätze, Match-Tiebreak).
   Endrunde nur in der obersten Liga (Halbfinale über Kreuz, Finale → Clubmeister), Relegation zwischen benachbarten Ligen
   (Letzter jeder Gruppe gegen die Gruppensieger der Liga darunter) – kein direkter Auf- oder Abstieg.
   Doppel: Doppel-Ligen fassen zwei benachbarte Einzel-Ligen zusammen (A+B …); Partner je eine Person der oberen und der unteren
   Liga werden ausgelost, dann die Paare in Gruppen, danach Endrunde je Doppel-Liga. Saisonabschluss: Ehrentafel und Einteilung der
   Folgesaison aus der Relegation; einmaliger Import einer Einteilung aus Excel/CSV.
   Spieler melden sich in der Mitglieder-App an, vereinbaren Termine selbst (mit Platzbuchung, wenn das Modul „Plätze“ aktiv ist)
   und tragen Ergebnisse ein; der Sportwart (Recht „turniere“) lost aus, korrigiert und setzt Fristen.
   Wertung (Sätze prüfen, Tabelle, direkter Vergleich): lib/wertung.js
   ===================================================================================================== */
const { today, addDays, deD, isDate, nowTs } = require('../../src/util');
const W = require('./lib/wertung');

const J = (v, d) => { try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };
const txt = (v, max = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const LETTERS = 'ABCDEFGH';
const PHASE = { gruppe: 'Gruppenphase', halbfinale: 'Halbfinale', finale: 'Finale', relegation: 'Relegation' };
const KO = ['halbfinale', 'finale', 'relegation'];
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));

function activate(ctx) {
  const { db, need, bad, int, audit } = ctx;
  db.exec(`
CREATE TABLE IF NOT EXISTS tu_season (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  leagues TEXT NOT NULL DEFAULT '["A","B","C","D"]',             -- Einzel-Ligen von oben nach unten
  reg_until TEXT, due_groups TEXT, due_final TEXT,                  -- Anmeldeschluss, Frist Gruppenphase, Frist Endspiele + Relegation
  drawn_at TEXT, closed_at TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS tu_player (                              -- Anmeldung und Liga je Saison
  season_id INTEGER NOT NULL, member_id INTEGER NOT NULL, league TEXT NOT NULL,
  singles INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'app', created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (season_id, member_id)
);
CREATE TABLE IF NOT EXISTS tu_team (                                -- Teilnehmer einer Gruppe (Einzel: eine Person)
  id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER NOT NULL, comp TEXT NOT NULL DEFAULT 'E', league TEXT NOT NULL, group_no INTEGER NOT NULL DEFAULT 1,
  p1 INTEGER, name TEXT NOT NULL                                    -- name: Stand bei der Auslosung (bleibt lesbar, wenn das Konto gelöscht wird)
);
CREATE INDEX IF NOT EXISTS ix_tu_team ON tu_team(season_id, comp, league);
CREATE TABLE IF NOT EXISTS tu_match (
  id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER NOT NULL, comp TEXT NOT NULL DEFAULT 'E',
  league TEXT NOT NULL,                                             -- Liga („A“), bei der Relegation die beiden Ligen („A/B“)
  phase TEXT NOT NULL DEFAULT 'gruppe', group_no INTEGER, slot INTEGER NOT NULL DEFAULT 0,
  a INTEGER NOT NULL, b INTEGER NOT NULL,                           -- tu_team.id; bei der Relegation a = obere Liga
  result TEXT, sets TEXT NOT NULL DEFAULT '[]', winner TEXT, retired TEXT,   -- result: normal | wo | aufgabe | ausgefallen; winner: a | b
  entered_by TEXT, entered_at TEXT,
  plan_date TEXT, plan_time TEXT, plan_end TEXT, court TEXT, booking_id INTEGER,   -- vereinbarter Termin (mit Platzbuchung: booking_id)
  due_sent INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_tu_match ON tu_match(season_id, comp, league, phase);
CREATE TABLE IF NOT EXISTS tu_honor (                               -- Ehrentafel: Clubmeister je Saison (auch von Hand für frühere Jahre)
  id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER, year TEXT NOT NULL, title TEXT NOT NULL, names TEXT NOT NULL,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`);
  // 3.72: Doppel (Doppel-Ligen, Anmeldung, Partner), Saisonabschluss
  { const has = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c);
    if (!has('tu_season', 'doubles')) db.exec("ALTER TABLE tu_season ADD COLUMN doubles TEXT NOT NULL DEFAULT '[]'");   // Doppel-Ligen: ["A+B", "C+D", "E"]
    if (!has('tu_season', 'paired_at')) db.exec('ALTER TABLE tu_season ADD COLUMN paired_at TEXT');                  // Doppelpartner ausgelost
    if (!has('tu_season', 'ddrawn_at')) db.exec('ALTER TABLE tu_season ADD COLUMN ddrawn_at TEXT');                  // Doppel-Gruppen ausgelost
    if (!has('tu_player', 'doubles')) db.exec('ALTER TABLE tu_player ADD COLUMN doubles INTEGER NOT NULL DEFAULT 0');
    if (!has('tu_team', 'p2')) db.exec('ALTER TABLE tu_team ADD COLUMN p2 INTEGER'); }
  const { lastFirst } = ctx.require('./db');
  const P = need('turniere');
  const S = (k, d) => ctx.getSetting('ext_turniere_' + k, d);
  const SET = (k, v) => ctx.setSetting('ext_turniere_' + k, String(v));
  const cfg = () => ({ minutes: [60, 90, 120, 150, 180].includes(int(S('minutes', '120'))) ? int(S('minutes', '120')) : 120 });
  const ar = fn => ctx.asyncRoute(fn);
  const bookingOn = () => ctx.isModuleActive('buchung');
  const hook = async (name, ...a) => { const r = (await ctx.callHooks(name, ...a)).find(x => x.id === 'buchung'); return r ? r.result : null; };

  /* ---------- Lesen ---------- */
  const seasonRow = id => db.prepare('SELECT * FROM tu_season WHERE id = ?').get(int(id));
  const current = () => db.prepare('SELECT * FROM tu_season ORDER BY closed_at IS NOT NULL, id DESC LIMIT 1').get();
  const leaguesOf = s => J(s.leagues, ['A']);
  const regOpen = s => !s.closed_at && !s.drawn_at && !s.paired_at && (!s.reg_until || today() <= s.reg_until);
  const doublesOf = s => J(s.doubles, []);
  /** Standard der Doppel-Ligen: von oben paarweise, eine übrige Liga allein (Partner innerhalb der Liga) */
  const defaultDoubles = L => { const out = []; for (let i = 0; i < L.length; i += 2) out.push(L.slice(i, i + 2).join('+')); return out; };
  const mrow = m => (m ? { ...m, sets: J(m.sets, []) } : m);
  const matchRow = id => mrow(db.prepare('SELECT * FROM tu_match WHERE id = ?').get(int(id)));
  const matchesOf = sid => db.prepare('SELECT * FROM tu_match WHERE season_id = ? ORDER BY comp, league, phase, group_no, slot, id').all(sid).map(mrow);
  const teamsOf = sid => db.prepare('SELECT * FROM tu_team WHERE season_id = ? ORDER BY comp, league, group_no, id').all(sid);
  const decided = m => Boolean(m.winner) || m.result === 'ausgefallen';
  const dueOf = (s, m) => (m.phase === 'gruppe' ? s.due_groups : s.due_final) || null;
  const groupLabel = (league, no, count) => (count > 1 ? (league.includes('+') ? `${league} ${no}` : `${league}${no}`) : league);
  /** Namen der Mitglieder (live, „Nachname, Vorname“ und natürlich); gelöschte Konten → Stand der Auslosung */
  function names() {
    const m = new Map(db.prepare("SELECT id, name, kind, deleted FROM members WHERE kind IN ('mitglied','nichtmitglied')").all().map(r => [r.id, r]));
    const ln = (id, fb = '?') => { const r = m.get(id); return r && !r.deleted ? lastFirst(r.name, r.kind) : fb; };
    const full = (id, fb = '?') => { const r = m.get(id); return r && !r.deleted ? r.name : fb; };
    const last = id => { const x = ln(id, ''); return x ? x.split(', ')[0] : '?'; };   // „Adler“ für Doppelpaare
    return { ln, full, last };
  }
  /** Name eines Teams: Einzel „Nachname, Vorname“, Doppel „Adler / Becker“ (gelöschte Konten: Stand der Auslosung) */
  const teamName = (t, nm) => (!t ? '–' : t.p2 ? (t.p1 || t.p2 ? `${t.p1 ? nm.last(t.p1) : '?'} / ${t.p2 ? nm.last(t.p2) : '?'}` : t.name) : nm.ln(t.p1, t.name));
  /** natürliche Schreibweise für Titel und Nachrichten: „Felix Adler“ bzw. „Felix Adler/Anna Becker“ */
  const teamFull = (t, nm) => (!t ? '–' : t.p2 ? `${nm.full(t.p1, '?')}/${nm.full(t.p2, '?')}` : nm.full(t.p1, t.name));
  const players = t => (t ? [t.p1, t.p2].filter(Boolean) : []);

  /** Gruppen einer Liga mit Tabelle → [{ no, label, teams, matches, table, done }] */
  function groupsOf(teams, matches, comp, league, nm) {
    const ts = teams.filter(t => t.comp === comp && t.league === league && t.group_no > 0);   // Doppel vor der Gruppen-Auslosung: Gruppe 0
    const nos = [...new Set(ts.map(t => t.group_no))].sort();
    return nos.map(no => {
      const gt = ts.filter(t => t.group_no === no), gm = matches.filter(m => m.comp === comp && m.league === league && m.phase === 'gruppe' && m.group_no === no);
      return { no, label: groupLabel(league, no, nos.length), teams: gt, matches: gm, done: gm.length > 0 && gm.every(decided),
        table: W.table(gt.map(t => ({ id: t.id, name: teamName(t, nm) })), gm) };
    });
  }

  /* ---------- Endrunde und Relegation: gewünschte Paarungen aus dem Stand der Gruppen ---------- */
  function desiredKO(s, teams, matches, nm) {
    const out = [], L = leaguesOf(s), G = {};
    for (const l of L) G[l] = groupsOf(teams, matches, 'E', l, nm);
    const done = l => G[l].length > 0 && G[l].every(g => g.done);
    const at = (g, i) => (g && g.table.length > Math.abs(i) ? g.table[i < 0 ? g.table.length + i : i].id : null);
    /** Endrunde einer Liga: Halbfinale über Kreuz (Erster gegen Zweiter der anderen Gruppe), Finale der Sieger; bei einer Gruppe gleich das Finale */
    const endrunde = (comp, league, gs) => {
      const own = [];
      if (gs.length > 0 && gs.every(g => g.done)) {
        if (gs.length === 2 && gs.every(g => g.table.length >= 2)) {
          own.push({ comp, league, phase: 'halbfinale', slot: 1, a: at(gs[0], 0), b: at(gs[1], 1) });
          own.push({ comp, league, phase: 'halbfinale', slot: 2, a: at(gs[1], 0), b: at(gs[0], 1) });
        } else if (gs.length === 1 && gs[0].table.length >= 2) own.push({ comp, league, phase: 'finale', slot: 1, a: at(gs[0], 0), b: at(gs[0], 1) });
      }
      const semis = matches.filter(m => m.comp === comp && m.league === league && m.phase === 'halbfinale');
      const hf = own.filter(w => w.phase === 'halbfinale').map(w => semis.find(m => m.slot === w.slot && m.a === w.a && m.b === w.b));
      if (hf.length === 2 && hf.every(m => m && m.winner)) own.push({ comp, league, phase: 'finale', slot: 1, a: hf[0][hf[0].winner], b: hf[1][hf[1].winner] });
      out.push(...own);
    };
    endrunde('E', L[0], G[L[0]]);                                                           // Einzel: nur die oberste Liga
    for (const k of doublesOf(s)) endrunde('D', k, groupsOf(teams, matches, 'D', k, nm));     // Doppel: jede Doppel-Liga
    // Relegation: Letzter jeder Gruppe der oberen Liga gegen die Gruppensieger der Liga darunter (bei 2 + 2 Gruppen über Kreuz)
    for (let i = 0; i + 1 < L.length; i++) {
      const up = G[L[i]], lo = G[L[i + 1]];
      if (!done(L[i]) || !done(L[i + 1])) continue;
      const lasts = up.filter(g => g.table.length >= 2).map(g => at(g, -1)), firsts = lo.map(g => at(g, 0)).filter(Boolean);
      const pairs = lasts.length === 2 && firsts.length === 2 ? [[lasts[0], firsts[1]], [lasts[1], firsts[0]]] : lasts.slice(0, firsts.length).map((x, k) => [x, firsts[k]]);
      pairs.forEach(([a, b], k) => out.push({ comp: 'E', league: `${L[i]}/${L[i + 1]}`, phase: 'relegation', slot: k + 1, a, b }));
    }
    return out.filter(w => w.a && w.b);
  }
  /**
   * Endrunde und Relegation an den Stand anpassen: fehlende Spiele anlegen, überholte (noch ohne Ergebnis) entfernen.
   * Gespielte K.-o.-Spiele bleiben stehen – dann kommt ein Hinweis. → { created: [match], warnings: [text] }
   */
  async function reconcile(sid) {
    const s = seasonRow(sid); if (!s || s.closed_at) return { created: [], warnings: [] };
    const nm = names(), teams = teamsOf(sid);
    let matches = matchesOf(sid);
    const warnings = [], drop = [];
    const want = desiredKO(s, teams, matches, nm);
    const same = (m, w) => m.comp === w.comp && m.league === w.league && m.phase === w.phase && m.slot === w.slot;
    for (const m of matches.filter(x => KO.includes(x.phase))) {
      const w = want.find(x => same(m, x));
      if (w && w.a === m.a && w.b === m.b) continue;
      if (decided(m)) warnings.push(`${m.comp === 'D' ? `Doppel ${m.league}: ` : ''}${PHASE[m.phase]} ${m.phase === 'relegation' ? m.league + ' ' : ''}ist schon gespielt – die Tabelle hat sich danach geändert. Bitte prüfen.`);
      else drop.push(m);
    }
    for (const m of drop) await dropMatch(m, 'Spiel neu gesetzt');
    matches = matchesOf(sid);
    const created = [];
    for (const w of want) {
      if (matches.some(m => same(m, w))) continue;
      const id = Number(db.prepare('INSERT INTO tu_match(season_id, comp, league, phase, slot, a, b) VALUES (?,?,?,?,?,?,?)').run(sid, w.comp, w.league, w.phase, w.slot, w.a, w.b).lastInsertRowid);
      created.push(matchRow(id));
    }
    if (created.length) {
      audit(null, 'Turniere: Spiele gesetzt', created.map(m => `${m.comp === 'D' ? `Doppel ${m.league} ` : ''}${PHASE[m.phase]}${m.phase === 'relegation' ? ' ' + m.league : ''}: ${teamName(teams.find(t => t.id === m.a), nm)} – ${teamName(teams.find(t => t.id === m.b), nm)}`).join('; '));
      for (const m of created) tellPlayers(m, 'ausgelost', mm => ({ title: `Neues Spiel: ${PHASE[mm.phase]}`, body: `Clubmeisterschaft${mm.comp === 'D' ? ` (Doppel ${mm.league})` : ''} – ihr spielt gegen ${mm.opp}${mm.due ? `, Frist ${deD(mm.due)}` : ''}.` }));
    }
    return { created, warnings };
  }
  /** Spiel entfernen (Auslosung neu, Endrunde neu gesetzt) – eine Platzbuchung wird storniert */
  async function dropMatch(m, reason) {
    if (m.booking_id && bookingOn()) await hook('matchCancel', { id: m.booking_id, by: 'Turniere', reason }).catch(() => {});
    db.prepare('DELETE FROM tu_match WHERE id = ?').run(m.id);
  }

  /* ---------- Benachrichtigungen ---------- */
  ctx.hooks.pushEvents = () => [
    { id: 'ausgelost', label: 'Neues Spiel ausgelost', desc: 'Clubmeisterschaft: Du hast neue Gegner – nach der Auslosung, in der Endrunde und in der Relegation.', default: true },
    { id: 'frist', label: 'Frist in 7 Tagen', desc: 'Clubmeisterschaft: Ein Spiel von dir ist noch offen und die Frist endet in einer Woche.', default: true },
    { id: 'ergebnis', label: 'Ergebnis eingetragen', desc: 'Clubmeisterschaft: Dein Gegner hat das Ergebnis eingetragen (oder der Sportwart hat es korrigiert).', default: true },
    { id: 'termin', label: 'Spieltermin vereinbart', desc: 'Clubmeisterschaft: Dein Gegner hat einen Termin gebucht, verlegt oder abgesagt.', default: true },
    { id: 'erinnerung', label: 'Erinnerung vom Sportwart', desc: 'Clubmeisterschaft: Der Sportwart erinnert an ein offenes Spiel.', default: true },
  ];
  /** Push an die Spieler eines Spiels (ohne „except“) – msg(mm) bekommt { opp (Gegner aus Sicht des Empfängers), due, phase … } */
  function tellPlayers(m, ev, msg, { except = null } = {}) {
    const s = seasonRow(m.season_id), nm = names();
    const ta = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.a), tb = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.b);
    for (const [mine, other] of [[ta, tb], [tb, ta]]) {
      const ids = players(mine).filter(id => id !== except);
      if (!ids.length) continue;
      const x = msg({ ...m, opp: teamFull(other, nm), due: s ? dueOf(s, m) : null });
      ctx.push.send(ids, ev, { title: x.title, body: x.body, url: './#turniere', tag: `turniere-${ev}-${m.id}` }).catch(() => {});
    }
  }
  /** Erinnerung durch den Sportwart: Push und (mit Mitgliederverwaltung) E-Mail an beide Seiten */
  async function remind(m, by) {
    const s = seasonRow(m.season_id), due = dueOf(s, m), nm = names();
    tellPlayers(m, 'erinnerung', mm => ({ title: 'Clubmeisterschaft: Spiel offen', body: `Bitte spielt euer Spiel gegen ${mm.opp}${due ? ` bis ${deD(due)}` : ''} und tragt das Ergebnis ein.` }));
    if (!ctx.mail.ready() || !ctx.isModuleActive('mitglieder')) return;
    const ta = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.a), tb = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.b);
    const club = ctx.getSetting('club_name', 'Verein');
    for (const [mine, other] of [[ta, tb], [tb, ta]]) for (const id of players(mine)) {
      const a = (await ctx.callHooks('memberAddress', id)).map(x => x.result).find(Boolean);
      if (!a || !a.email || /@clubwerk\.invalid$/i.test(a.email)) continue;
      const opp = teamFull(other, nm);
      ctx.mail.send({ to: a.email, subject: `Clubmeisterschaft: Spiel gegen ${opp} – ${club}`,
        text: [`Hallo ${String(a.name || '').split(' ')[0]},`, '', `dein Spiel gegen ${opp} (${where(m, s)}) ist noch offen.${due ? ` Die Frist endet am ${deD(due)}.` : ''}`, 'Termin und Ergebnis trägst du in der Mitglieder-App unter „Turniere“ ein.', '', 'Viele Grüße', by || club].join('\n'),
        card: { heading: 'Spiel noch offen', title: `Gegen ${opp}`, rows: [['Runde', where(m, s)], ...(due ? [['Frist', deD(due)]] : [])], after: 'Termin und Ergebnis trägst du in der Mitglieder-App unter „Turniere“ ein.' } }).catch(() => {});
    }
  }
  /** „Gruppe A1 – Gruppenphase“, „Relegation A/B“, „Halbfinale“; Doppel: „Doppel A+B, Gruppe 1 – Gruppenphase“, „Doppel A+B – Finale“ */
  function where(m, s) {
    if (m.phase === 'gruppe') {
      const n = db.prepare('SELECT COUNT(DISTINCT group_no) n FROM tu_team WHERE season_id = ? AND comp = ? AND league = ? AND group_no > 0').get(m.season_id, m.comp, m.league).n;
      return m.comp === 'D' ? `Doppel ${m.league}${n > 1 ? `, Gruppe ${m.group_no}` : ''} – Gruppenphase` : `Gruppe ${groupLabel(m.league, m.group_no, n)} – Gruppenphase`;
    }
    if (m.comp === 'D') return `Doppel ${m.league} – ${PHASE[m.phase]}`;
    return m.phase === 'relegation' ? `Relegation ${m.league}` : PHASE[m.phase];
  }
  // Frist in 7 Tagen: einmal je Spiel
  function dueReminders() {
    if (!ctx.isActive()) return;
    const day = addDays(today(), 7);
    for (const s of db.prepare('SELECT * FROM tu_season WHERE closed_at IS NULL').all()) {
      for (const m of db.prepare("SELECT * FROM tu_match WHERE season_id = ? AND due_sent = 0 AND winner IS NULL AND (result IS NULL OR result != 'ausgefallen')").all(s.id).map(mrow)) {
        if (dueOf(s, m) !== day) continue;
        db.prepare('UPDATE tu_match SET due_sent = 1 WHERE id = ?').run(m.id);
        tellPlayers(m, 'frist', mm => ({ title: 'Clubmeisterschaft: Frist in 7 Tagen', body: `Dein Spiel gegen ${mm.opp} muss bis ${deD(day)} gespielt sein.` }));
      }
    }
  }
  setInterval(() => { try { dueReminders(); } catch (e) { console.error('Turniere – Fristen:', e.message); } }, process.env.CW_TEST_FAST ? 1500 : 3600000).unref();
  setTimeout(() => { try { dueReminders(); } catch (e) { console.error('Turniere – Fristen:', e.message); } }, 9000).unref();

  /* ---------- Termine: Platzbuchung über das Modul „Plätze“ (Hooks matchSlots/matchBook/matchCancel/matchBookings) ---------- */
  /** Spieltermine an den Stand der Platzbuchung angleichen (in der Verwaltung verlegt oder storniert, z. B. durch eine Platzsperre) */
  async function syncBookings(ms) {
    const ids = ms.filter(m => m.booking_id).map(m => m.booking_id);
    if (!ids.length || !bookingOn()) return ms;
    const st = (await hook('matchBookings', ids)) || {};
    return ms.map(m => {
      const b = m.booking_id ? st[m.booking_id] : null;
      if (!m.booking_id || !b) return m;
      if (b.status !== 'aktiv') { db.prepare('UPDATE tu_match SET plan_date = NULL, plan_time = NULL, plan_end = NULL, court = NULL, booking_id = NULL WHERE id = ?').run(m.id); return { ...m, plan_date: null, plan_time: null, plan_end: null, court: null, booking_id: null, booking_lost: true }; }
      if (b.date !== m.plan_date || b.start !== m.plan_time || b.resource !== m.court || b.end !== m.plan_end) {
        db.prepare('UPDATE tu_match SET plan_date = ?, plan_time = ?, plan_end = ?, court = ? WHERE id = ?').run(b.date, b.start, b.end, b.resource, m.id);
        return { ...m, plan_date: b.date, plan_time: b.start, plan_end: b.end, court: b.resource };
      }
      return m;
    });
  }
  const bookingTitle = (m, s, nm) => {
    const ta = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.a), tb = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.b);
    return `Clubmeisterschaft: ${teamFull(ta, nm)} gegen ${teamFull(tb, nm)} – ${where(m, s)}`;
  };
  /** Termin setzen: mit Platzbuchung (resource_id) oder nur Datum/Uhrzeit */
  async function setDate(m, b, by) {
    const s = seasonRow(m.season_id), nm = names();
    if (!isDate(b.date)) throw new Error('Bitte einen Tag wählen.');
    if (b.date < today()) throw new Error('Dieser Tag ist schon vorbei.');
    const due = dueOf(s, m);
    if (due && b.date > due && !b.admin) throw new Error(`Die Frist für dieses Spiel endet am ${deD(due)} – bitte einen Tag bis dahin wählen.`);
    if (bookingOn() && b.resource_id) {
      const ta = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.a), tb = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.b);
      const r = await hook('matchBook', { key: `tu:${m.id}`, id: m.booking_id || 0, resource_id: int(b.resource_id), date: b.date, start: b.start, minutes: cfg().minutes,
        members: [...players(ta), ...players(tb)], title: bookingTitle(m, s, nm), label: 'Clubmeisterschaft', by });
      if (!r) throw new Error('Die Platzbuchung ist gerade nicht erreichbar.');
      if (r.error) throw new Error(r.error);
      db.prepare('UPDATE tu_match SET plan_date = ?, plan_time = ?, plan_end = ?, court = ?, booking_id = ? WHERE id = ?').run(r.date, r.start, r.end, r.resource, r.id, m.id);
    } else {
      if (b.start && !isTime(b.start)) throw new Error('Bitte die Uhrzeit prüfen (z. B. 18:00).');
      if (m.booking_id && bookingOn()) await hook('matchCancel', { id: m.booking_id, by, reason: 'Termin ohne Platz geändert' }).catch(() => {});
      db.prepare('UPDATE tu_match SET plan_date = ?, plan_time = ?, plan_end = NULL, court = NULL, booking_id = NULL WHERE id = ?').run(b.date, b.start || null, m.id);
    }
    return matchRow(m.id);
  }
  async function clearDate(m, by) {
    if (m.booking_id && bookingOn()) await hook('matchCancel', { id: m.booking_id, by, reason: 'Spieltermin abgesagt' }).catch(() => {});
    db.prepare('UPDATE tu_match SET plan_date = NULL, plan_time = NULL, plan_end = NULL, court = NULL, booking_id = NULL WHERE id = ?').run(m.id);
  }

  /* ---------- Ansicht einer Saison (für Verwaltung, App und Tablet) ---------- */
  /** → { season, leagues: [{ key, label, groups: [{ label, table, matches }] }], finals: [...], relegation: [...] } – nur Namen und Ergebnisse */
  function view(s, ms, { nm = names(), me = null } = {}) {
    const teams = teamsOf(s.id);
    const tById = new Map(teams.map(t => [t.id, t]));
    const mv = m => {
      const ta = tById.get(m.a), tb = tById.get(m.b);
      const mine = me != null && (players(ta).includes(me) || players(tb).includes(me));
      return { id: m.id, phase: m.phase, league: m.league, group: m.group_no, slot: m.slot, a: teamName(ta, nm), b: teamName(tb, nm), winner: m.winner || null, result: m.result || null,
        score: W.scoreText(m), sets: m.sets, retired: m.retired || null, date: m.plan_date || null, time: m.plan_time || null, court: m.court || null, due: dueOf(s, m), mine };
    };
    const L = leaguesOf(s);
    const gv = g => ({ label: g.label, done: g.done,
      table: g.table.map(r => ({ rank: r.rank, name: r.name, played: r.played, won: r.won, lost: r.lost, sets: `${r.setsW}:${r.setsL}`, games: `${r.gamesW}:${r.gamesL}`, mine: me != null && players(tById.get(r.id)).includes(me) })),
      matches: g.matches.map(mv) });
    const leagues = L.map(l => ({ key: l, label: `Liga ${l}`, groups: groupsOf(teams, ms, 'E', l, nm).map(gv) }));
    const champ = (comp, league) => { const f = ms.find(m => m.comp === comp && m.league === league && m.phase === 'finale' && m.winner); return f ? teamName(tById.get(f[f.winner]), nm) : null; };
    const finals = ms.filter(m => m.comp === 'E' && (m.phase === 'halbfinale' || m.phase === 'finale')).map(mv);
    const relegation = ms.filter(m => m.comp === 'E' && m.phase === 'relegation').map(mv);
    const doubles = doublesOf(s).map(k => ({ key: k, label: `Doppel ${k}`, groups: groupsOf(teams, ms, 'D', k, nm).map(gv),
      finals: ms.filter(m => m.comp === 'D' && m.league === k && (m.phase === 'halbfinale' || m.phase === 'finale')).map(mv), champion: champ('D', k) }));
    return { season: { id: s.id, name: s.name, reg_until: s.reg_until, due_groups: s.due_groups, due_final: s.due_final, drawn_at: s.drawn_at, paired_at: s.paired_at, ddrawn_at: s.ddrawn_at, closed_at: s.closed_at, regOpen: regOpen(s), leagues: L, doubles: doublesOf(s) },
      leagues, finals, relegation, champion: champ('E', L[0]), top: L[0], doubles, honors: honors() };
  }

  /* ---------- Auslosung der Einzel-Gruppen ---------- */
  const playedIn = (sid, comp, league) => db.prepare("SELECT COUNT(*) n FROM tu_match WHERE season_id = ? AND comp = ? AND league = ? AND phase = 'gruppe' AND (winner IS NOT NULL OR result = 'ausgefallen')").get(sid, comp, league).n > 0;
  function makeGroupMatches(sid, comp, league, no) {
    const ids = db.prepare('SELECT id FROM tu_team WHERE season_id = ? AND comp = ? AND league = ? AND group_no = ? ORDER BY id').all(sid, comp, league, no).map(r => r.id);
    const ins = db.prepare("INSERT INTO tu_match(season_id, comp, league, phase, group_no, a, b) VALUES (?,?,?,'gruppe',?,?,?)");
    for (const [a, b] of W.roundRobin(ids)) ins.run(sid, comp, league, no, a, b);
  }
  async function dropGroups(sid, comp, league, nos = null) {
    const ms = db.prepare(`SELECT * FROM tu_match WHERE season_id = ? AND comp = ? AND league = ? AND phase = 'gruppe'${nos ? ` AND group_no IN (${nos.map(Number).join(',')})` : ''}`).all(sid, comp, league);
    for (const m of ms) await dropMatch(m, 'Gruppen neu ausgelost');
  }
  /** → { drawn: ['A', …], skipped: ['B: schon gespielt'] } */
  async function drawSingles(s, onlyLeague, user) {
    const nm = names(), drawn = [], skipped = [];
    for (const l of leaguesOf(s).filter(x => !onlyLeague || x === onlyLeague)) {
      if (playedIn(s.id, 'E', l)) { skipped.push(`Liga ${l}: schon Spiele gewertet`); continue; }
      const ps = db.prepare(`SELECT p.member_id FROM tu_player p JOIN members m ON m.id = p.member_id WHERE p.season_id = ? AND p.league = ? AND p.singles = 1 AND m.deleted = 0 AND m.active = 1`).all(s.id, l).map(r => r.member_id);
      await dropGroups(s.id, 'E', l);
      db.prepare("DELETE FROM tu_team WHERE season_id = ? AND comp = 'E' AND league = ?").run(s.id, l);
      if (ps.length < 2) { if (ps.length || onlyLeague) skipped.push(`Liga ${l}: zu wenige Anmeldungen (${ps.length})`); continue; }
      const groups = W.deal(ps, W.groupCount(ps.length));
      const ins = db.prepare("INSERT INTO tu_team(season_id, comp, league, group_no, p1, name) VALUES (?, 'E', ?, ?, ?, ?)");
      db.transaction(() => { groups.forEach((g, i) => { for (const id of g) ins.run(s.id, l, i + 1, id, nm.ln(id)); makeGroupMatches(s.id, 'E', l, i + 1); }); })();
      drawn.push(l);
      audit(user, 'Turniere: Gruppen ausgelost', `${s.name}, Liga ${l}: ${groups.map((g, i) => `Gruppe ${groupLabel(l, i + 1, groups.length)}: ${g.map(id => nm.ln(id)).join(', ')}`).join(' · ')}`);
    }
    if (drawn.length) db.prepare('UPDATE tu_season SET drawn_at = ? WHERE id = ?').run(nowTs(), s.id);
    await reconcile(s.id);
    // „Neues Spiel ausgelost“: eine Nachricht je Spieler
    for (const l of drawn) for (const t of db.prepare("SELECT * FROM tu_team WHERE season_id = ? AND comp = 'E' AND league = ?").all(s.id, l)) {
      const n = db.prepare("SELECT COUNT(*) n FROM tu_match WHERE season_id = ? AND phase = 'gruppe' AND (a = ? OR b = ?)").get(s.id, t.id, t.id).n;
      const cnt = db.prepare("SELECT COUNT(DISTINCT group_no) n FROM tu_team WHERE season_id = ? AND comp = 'E' AND league = ?").get(s.id, l).n;
      if (t.p1) ctx.push.send([t.p1], 'ausgelost', { title: `${s.name}: Gruppen ausgelost`, body: `Du spielst in Gruppe ${groupLabel(l, t.group_no, cnt)} – ${n} ${n === 1 ? 'Spiel' : 'Spiele'}${s.due_groups ? ` bis ${deD(s.due_groups)}` : ''}.`, url: './#turniere', tag: `turniere-los-${s.id}` }).catch(() => {});
    }
    return { drawn, skipped };
  }

  /* ---------- Doppel: Partner auslosen (je eine Person der oberen und der unteren Liga), dann die Paare in Gruppen ---------- */
  const dPlayers = (sid, league) => db.prepare('SELECT p.member_id FROM tu_player p JOIN members m ON m.id = p.member_id WHERE p.season_id = ? AND p.league = ? AND p.doubles = 1 AND m.deleted = 0 AND m.active = 1').all(sid, league).map(r => r.member_id);
  const dTeams = (sid, key) => db.prepare("SELECT * FROM tu_team WHERE season_id = ? AND comp = 'D' AND league = ? ORDER BY id").all(sid, key);
  const pairName = (a, b, nm) => `${nm.last(a)} / ${nm.last(b)}`;
  /** Doppel-Anmeldungen ohne Partner je Doppel-Liga → { 'A+B': [memberId, …] } */
  function unpaired(s) {
    const out = {};
    for (const k of doublesOf(s)) {
      const inTeam = new Set(dTeams(s.id, k).flatMap(players));
      out[k] = k.split('+').flatMap(l => dPlayers(s.id, l)).filter(id => !inTeam.has(id));
    }
    return out;
  }
  async function drawPartners(s, onlyKey, user) {
    const nm = names(), drawn = [], skipped = [];
    for (const k of doublesOf(s).filter(x => !onlyKey || x === onlyKey)) {
      if (playedIn(s.id, 'D', k)) { skipped.push(`Doppel ${k}: schon Spiele gewertet`); continue; }
      await dropGroups(s.id, 'D', k);
      db.prepare("DELETE FROM tu_team WHERE season_id = ? AND comp = 'D' AND league = ?").run(s.id, k);
      const [up, lo] = k.split('+');
      let pairs;
      if (lo) { const a = W.shuffle(dPlayers(s.id, up)), b = W.shuffle(dPlayers(s.id, lo)); pairs = a.slice(0, b.length).map((x, i) => [x, b[i]]); }
      else { const a = W.shuffle(dPlayers(s.id, up)); pairs = []; for (let i = 0; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]); }   // Liga allein: Partner innerhalb der Liga
      const ins = db.prepare("INSERT INTO tu_team(season_id, comp, league, group_no, p1, p2, name) VALUES (?, 'D', ?, 0, ?, ?, ?)");
      db.transaction(() => { for (const [x, y] of pairs) ins.run(s.id, k, x, y, pairName(x, y, nm)); })();
      drawn.push(k);
      const rest = unpaired(s)[k];
      audit(user, 'Turniere: Doppelpartner ausgelost', `${s.name}, Doppel ${k}: ${pairs.map(([x, y]) => `${nm.ln(x)} + ${nm.ln(y)}`).join('; ') || '–'}${rest.length ? ` · ohne Partner: ${rest.map(id => nm.ln(id)).join(', ')}` : ''}`);
    }
    if (drawn.length) db.prepare('UPDATE tu_season SET paired_at = ? WHERE id = ?').run(nowTs(), s.id);
    const u = unpaired(seasonRow(s.id));
    return { drawn, skipped, unpaired: Object.fromEntries(Object.entries(u).filter(([, v]) => v.length).map(([k, v]) => [k, v.map(id => nm.ln(id))])) };
  }
  async function drawDoubles(s, onlyKey, user) {
    const nm = names(), drawn = [], skipped = [];
    for (const k of doublesOf(s).filter(x => !onlyKey || x === onlyKey)) {
      if (playedIn(s.id, 'D', k)) { skipped.push(`Doppel ${k}: schon Spiele gewertet`); continue; }
      const ts = dTeams(s.id, k);
      await dropGroups(s.id, 'D', k);
      if (ts.length < 2) { skipped.push(`Doppel ${k}: zu wenige Paare (${ts.length})`); db.prepare("UPDATE tu_team SET group_no = 0 WHERE season_id = ? AND comp = 'D' AND league = ?").run(s.id, k); continue; }
      const groups = W.deal(ts.map(t => t.id), W.groupCount(ts.length));
      db.transaction(() => { groups.forEach((g, i) => { for (const id of g) db.prepare('UPDATE tu_team SET group_no = ? WHERE id = ?').run(i + 1, id); makeGroupMatches(s.id, 'D', k, i + 1); }); })();
      drawn.push(k);
      const byId = new Map(ts.map(t => [t.id, t]));
      audit(user, 'Turniere: Doppel-Gruppen ausgelost', `${s.name}, Doppel ${k}: ${groups.map((g, i) => `Gruppe ${i + 1}: ${g.map(id => teamName(byId.get(id), nm)).join(', ')}`).join(' · ')}`);
    }
    if (drawn.length) db.prepare('UPDATE tu_season SET ddrawn_at = ? WHERE id = ?').run(nowTs(), s.id);
    await reconcile(s.id);
    for (const k of drawn) for (const t of dTeams(s.id, k)) {
      const n = db.prepare("SELECT COUNT(*) n FROM tu_match WHERE season_id = ? AND phase = 'gruppe' AND (a = ? OR b = ?)").get(s.id, t.id, t.id).n;
      ctx.push.send(players(t), 'ausgelost', { title: `${s.name}: Doppel ausgelost`, body: `Doppel ${k} mit ${teamName(t, nm)} – ${n} ${n === 1 ? 'Spiel' : 'Spiele'}${s.due_groups ? ` bis ${deD(s.due_groups)}` : ''}.`, url: './#turniere', tag: `turniere-dlos-${s.id}` }).catch(() => {});
    }
    return { drawn, skipped };
  }

  /* ---------- Ehrentafel und Saisonübergang ---------- */
  const honors = () => db.prepare('SELECT id, season_id, year, title, names FROM tu_honor ORDER BY year DESC, (season_id IS NULL), id').all();
  /** Clubmeister einer Saison: Einzel (Finale der obersten Liga) und je Doppel-Liga */
  function champions(s) {
    const nm = names(), tById = new Map(teamsOf(s.id).map(t => [t.id, t])), ms = matchesOf(s.id), out = [];
    const fin = (comp, league) => ms.find(m => m.comp === comp && m.league === league && m.phase === 'finale' && m.winner);
    const L = leaguesOf(s), f = fin('E', L[0]);
    if (f) out.push({ title: 'Clubmeister Einzel', names: teamFull(tById.get(f[f.winner]), nm) });
    for (const k of doublesOf(s)) { const d = fin('D', k); if (d) out.push({ title: `Clubmeister Doppel ${k}`, names: teamFull(tById.get(d[d.winner]), nm) }); }
    return out;
  }
  /** Liga je Person für die Folgesaison: wie in dieser Saison, Relegation entscheidet (Sieger der unteren Liga steigt auf, der Verlierer der oberen ab) */
  function nextLeagues(s) {
    const at = new Map(db.prepare('SELECT member_id, league FROM tu_player WHERE season_id = ?').all(s.id).map(r => [r.member_id, r.league]));
    const tById = new Map(teamsOf(s.id).map(t => [t.id, t])), moves = [];
    for (const m of matchesOf(s.id).filter(x => x.comp === 'E' && x.phase === 'relegation' && x.winner === 'b')) {
      const [up, lo] = m.league.split('/'), ta = tById.get(m.a), tb = tById.get(m.b);
      if (ta && ta.p1) { at.set(ta.p1, lo); moves.push({ member_id: ta.p1, from: up, to: lo }); }
      if (tb && tb.p1) { at.set(tb.p1, up); moves.push({ member_id: tb.p1, from: lo, to: up }); }
    }
    return { at, moves };
  }

  /* ---------- Import einer Einteilung (Excel/CSV): Name + Liga, Namen den Mitgliedern zuordnen ---------- */
  const normName = v => String(v || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ,]/g, ' ').replace(/\s+/g, ' ').trim();
  const keyOf = v => { const n = normName(v); if (n.includes(',')) { const [l, f] = n.split(',').map(x => x.trim()); return `${f} ${l}`.trim(); } return n; };   // „Adler, Felix“ = „Felix Adler“
  function lev(a, b) { const d = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return d[b.length]; }
  /** Tabelle aus der Datei → [{ name, league }]: Spalten „Name“ (oder „Vorname“ + „Nachname“) und „Liga“; ohne Liga-Spalte zählt der Blattname (z. B. „A1“ → A) */
  function rowsFrom(sheets, L) {
    const out = [];
    for (const { name: sheet, rows } of sheets) {
      const hi = rows.findIndex(r => r.some(c => /^(name|spieler|vorname|nachname)$/i.test(String(c || '').trim())));
      if (hi < 0) continue;
      const h = rows[hi].map(c => String(c || '').trim().toLowerCase());
      const col = re => h.findIndex(c => re.test(c));
      const cN = col(/^(name|spieler)$/), cV = col(/^vorname$/), cL = col(/^nachname$/), cLi = col(/^liga$/);
      const sheetLeague = (/^([a-h])\d?$/i.exec(String(sheet || '').trim()) || [])[1];
      for (const r of rows.slice(hi + 1)) {
        const name = cN >= 0 ? String(r[cN] || '').trim() : [cV >= 0 ? r[cV] : '', cL >= 0 ? r[cL] : ''].map(x => String(x || '').trim()).filter(Boolean).join(' ');
        const lg = String(cLi >= 0 ? r[cLi] || '' : sheetLeague || '').trim().toUpperCase().slice(0, 1);
        if (name.length >= 3 && L.includes(lg)) out.push({ name: txt(name, 80), league: lg });
      }
    }
    return out;
  }
  async function readSheets(b) {
    const buf = Buffer.from(String(b.file || ''), 'base64');
    if (!buf.length) throw new Error('Bitte eine Datei wählen.');
    if (buf.length > 3 * 1024 * 1024) throw new Error('Die Datei ist zu groß (höchstens 3 MB).');
    if (/\.xlsx$/i.test(String(b.name || ''))) {
      const wb = new (ctx.require('exceljs').Workbook)();
      await wb.xlsx.load(buf);
      return wb.worksheets.map(ws => { const rows = []; ws.eachRow({ includeEmpty: false }, r => { rows.push(r.values.slice(1).map(v => (v && typeof v === 'object' ? (v.text || v.result || (v.richText ? v.richText.map(x => x.text).join('') : '')) : v))); }); return { name: ws.name, rows }; });
    }
    const t = buf.toString('utf8').replace(/^\uFEFF/, '');
    const sep = (t.split('\n')[0].match(/;/g) || []).length >= (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    return [{ name: '', rows: t.split(/\r?\n/).filter(x => x.trim()).map(l => l.split(sep).map(x => x.replace(/^"|"$/g, '').trim())) }];
  }
  /** Zuordnung: genau gleicher Name → sicher; sonst ähnliche Namen (gleicher Nachname oder kleiner Tippfehler) zur Rückfrage */
  function matchNames(rows) {
    const people = db.prepare("SELECT id, name, kind FROM members WHERE kind = 'mitglied' AND active = 1 AND deleted = 0 AND pending = 0").all().map(m => ({ id: m.id, ln: lastFirst(m.name, m.kind), key: keyOf(m.name), last: keyOf(m.name).split(' ').pop() }));
    return rows.map(r => {
      const k = keyOf(r.name), last = k.split(' ').pop();
      const exact = people.filter(p => p.key === k);
      if (exact.length === 1) return { ...r, member_id: exact[0].id, sure: true, candidates: [] };
      const cand = people.map(p => ({ p, d: p.key === k ? 0 : p.last === last ? 1 : lev(p.key, k) <= 2 ? 2 : 9 })).filter(x => x.d < 9).sort((a, b) => a.d - b.d).slice(0, 4).map(x => ({ id: x.p.id, ln: x.p.ln }));
      return { ...r, member_id: null, sure: false, candidates: cand };
    });
  }

  /* ---------- Ergebnis ---------- */
  /** Ergebnis speichern (Spieler oder Sportwart) → { warnings } */
  async function saveResult(m, input, { by, memberId = null, admin = false }) {
    let r;
    if (admin && input && input.clear) r = { result: null, sets: [], winner: null, retired: null };
    else r = W.checkResult(input || {});
    if (!admin && r.result === 'ausgefallen') throw new Error('Das kann nur der Sportwart eintragen.');
    db.prepare('UPDATE tu_match SET result = ?, sets = ?, winner = ?, retired = ?, entered_by = ?, entered_at = ? WHERE id = ?')
      .run(r.result, JSON.stringify(r.sets), r.winner, r.retired || null, r.result ? (typeof by === 'string' ? by : by.name || by.username) : null, r.result ? nowTs() : null, m.id);
    const now = matchRow(m.id), s = seasonRow(m.season_id), nm = names();
    const ta = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.a), tb = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.b);
    const was = decided(m) ? W.scoreText(m) + (m.winner ? ` (Sieg ${teamName(m.winner === 'a' ? ta : tb, nm)})` : '') : '–';
    const is = now.result ? W.scoreText(now) + (now.winner ? ` (Sieg ${teamName(now.winner === 'a' ? ta : tb, nm)})` : '') : '–';
    audit(admin ? by : { username: 'app', name: by }, admin && decided(m) ? 'Turniere: Ergebnis korrigiert' : 'Turniere: Ergebnis eingetragen', `${s.name}, ${where(m, s)}: ${teamName(ta, nm)} – ${teamName(tb, nm)}: ${decided(m) ? `${was} → ` : ''}${is}`);
    if (now.result && now.result !== 'ausgefallen') tellPlayers(now, 'ergebnis', mm => ({ title: `Ergebnis: ${W.scoreText(now)}`, body: `Clubmeisterschaft gegen ${mm.opp} – ${now.winner ? 'eingetragen' : ''}${admin ? ' vom Sportwart' : ''}.`.replace(' – .', '.') }), { except: memberId });
    const k = await reconcile(m.season_id);
    return { warnings: k.warnings };
  }

  /* ================================================================= Mitglieder-App (/api/m/turniere/…) */
  const M = ctx.member;
  const burst = ctx.rateLimitKey('tuapp', 30, 60000, req => 'm' + req.member.id);
  const send = fn => ar(async (req, res) => { try { res.json(await fn(req)); } catch (e) { bad(res, e.message, e.code || 400); } });
  /** eigenes Spiel (mit Gegner) oder Fehler */
  function myMatch(req) {
    const m = matchRow(req.params.id);
    const s = m && seasonRow(m.season_id);
    if (!m || !s || s.closed_at) throw Object.assign(new Error('Spiel nicht gefunden.'), { code: 404 });
    const ta = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.a), tb = db.prepare('SELECT * FROM tu_team WHERE id = ?').get(m.b);
    if (![...players(ta), ...players(tb)].includes(req.member.id)) throw Object.assign(new Error('Das ist nicht dein Spiel.'), { code: 403 });
    return { m, s, ta, tb, side: players(ta).includes(req.member.id) ? 'a' : 'b' };
  }
  M.get('/state', send(async req => {
    const me = req.member.id, s = current();
    if (!s) return { season: null };
    const nm = names();
    const ms = await syncBookings(matchesOf(s.id));
    const v = view(s, ms, { nm, me });
    const reg = db.prepare('SELECT * FROM tu_player WHERE season_id = ? AND member_id = ?').get(s.id, me);
    const teams = teamsOf(s.id), tById = new Map(teams.map(t => [t.id, t]));
    const myTeams = new Set(teams.filter(t => players(t).includes(me)).map(t => t.id));
    const mine = [];
    for (const m of ms.filter(x => myTeams.has(x.a) || myTeams.has(x.b))) {
      const side = myTeams.has(m.a) ? 'a' : 'b', opp = tById.get(side === 'a' ? m.b : m.a);
      let contact = null;
      if (!decided(m) && opp && opp.p1 && ctx.isModuleActive('mitglieder')) { const a = (await ctx.callHooks('memberAddress', opp.p1)).map(x => x.result).find(Boolean); if (a && (a.mobile || a.phone)) contact = a.mobile || a.phone; }
      const own = tById.get(side === 'a' ? m.a : m.b), partner = own && own.p2 ? players(own).filter(x => x !== me).map(x => nm.ln(x))[0] : null;
      mine.push({ id: m.id, side, comp: m.comp, partner, opponent: teamName(opp, nm), where: where(m, s), phase: m.phase, due: dueOf(s, m), done: decided(m), winner: m.winner, result: m.result, score: W.scoreText(m), sets: m.sets,
        retired: m.retired, won: m.winner ? m.winner === side : null, date: m.plan_date, time: m.plan_time, end: m.plan_end, court: m.court, booked: Boolean(m.booking_id), lost: Boolean(m.booking_lost), contact, entered_by: m.entered_by, entered_at: m.entered_at });
    }
    mine.sort((x, y) => Number(x.done) - Number(y.done) || String(x.date || '9999').localeCompare(String(y.date || '9999')) || String(x.due || '').localeCompare(String(y.due || '')));
    return { ...v, me: { registered: Boolean(reg && (reg.singles || reg.doubles)), singles: Boolean(reg && reg.singles), doubles: Boolean(reg && reg.doubles), league: reg ? reg.league : null, member: true }, mine, booking: bookingOn(), minutes: cfg().minutes, today: today() };
  }));
  M.post('/anmeldung', burst, send(async req => {
    const me = req.member.id, s = current(), b = req.body || {};
    if (!s || !regOpen(s)) throw new Error('Die Anmeldung ist geschlossen.');
    const kind = (db.prepare('SELECT kind FROM members WHERE id = ?').get(me) || {}).kind;
    if (kind !== 'mitglied') throw Object.assign(new Error('Mitspielen können nur Mitglieder.'), { code: 403 });
    const cur = db.prepare('SELECT * FROM tu_player WHERE season_id = ? AND member_id = ?').get(s.id, me);
    const sg = b.singles ? 1 : 0, dbl = b.doubles && doublesOf(s).length ? 1 : 0;
    const what = [sg ? 'Einzel' : '', dbl ? 'Doppel' : ''].filter(Boolean).join(' und ');
    if (sg || dbl) {
      const L = leaguesOf(s);
      if (cur) db.prepare('UPDATE tu_player SET singles = ?, doubles = ? WHERE season_id = ? AND member_id = ?').run(sg, dbl, s.id, me);   // Liga aus der Vorsaison bleibt
      else db.prepare("INSERT INTO tu_player(season_id, member_id, league, singles, doubles, source) VALUES (?,?,?,?,?,'app')").run(s.id, me, L[L.length - 1], sg, dbl);   // neu: unterste Liga (Sportwart kann umsetzen)
      audit({ username: 'app', name: req.member.name }, 'Turniere: Anmeldung', `${s.name}: ${names().ln(me)} (${what})`);
    } else if (cur) {
      // abmelden: die Einteilung aus der Vorsaison (bzw. dem Import) bleibt stehen, nur die Anmeldung fällt weg
      if (['vorsaison', 'import'].includes(cur.source)) db.prepare('UPDATE tu_player SET singles = 0, doubles = 0 WHERE season_id = ? AND member_id = ?').run(s.id, me);
      else db.prepare('DELETE FROM tu_player WHERE season_id = ? AND member_id = ?').run(s.id, me);
      audit({ username: 'app', name: req.member.name }, 'Turniere: Abmeldung', `${s.name}: ${names().ln(me)}`);
    }
    return { ok: true };
  }));
  M.post('/spiel/:id/ergebnis', burst, send(async req => {
    const { m } = myMatch(req);
    if (decided(m)) throw new Error('Für dieses Spiel steht schon ein Ergebnis – Korrekturen macht der Sportwart.');
    return { ok: true, ...(await saveResult(m, req.body || {}, { by: req.member.name, memberId: req.member.id })) };
  }));
  M.get('/spiel/:id/zeiten', send(async req => {
    const { m, ta, tb } = myMatch(req);
    if (!bookingOn()) return { courts: [], slots: [] };
    return (await hook('matchSlots', { date: String(req.query.date || ''), minutes: cfg().minutes, members: [...players(ta), ...players(tb)], except: m.booking_id || 0 })) || { courts: [], slots: [] };
  }));
  M.post('/spiel/:id/termin', burst, send(async req => {
    const { m, s } = myMatch(req);
    if (decided(m)) throw new Error('Das Spiel ist schon gespielt.');
    const before = m.plan_date;
    const now = await setDate(m, req.body || {}, req.member.name);
    audit({ username: 'app', name: req.member.name }, before ? 'Turniere: Termin verlegt' : 'Turniere: Termin vereinbart', `${s.name}, ${where(m, s)}: ${deD(now.plan_date)}${now.plan_time ? ' ' + now.plan_time : ''}${now.court ? ', ' + now.court : ''}`);
    tellPlayers(now, 'termin', mm => ({ title: before ? 'Spieltermin verlegt' : 'Spieltermin vereinbart', body: `Clubmeisterschaft gegen ${mm.opp}: ${deD(now.plan_date)}${now.plan_time ? ` um ${now.plan_time} Uhr` : ''}${now.court ? `, ${now.court}` : ''}.` }), { except: req.member.id });
    return { ok: true };
  }));
  M.post('/spiel/:id/absagen', burst, send(async req => {
    const { m, s } = myMatch(req);
    if (!m.plan_date) return { ok: true };
    await clearDate(m, req.member.name);
    audit({ username: 'app', name: req.member.name }, 'Turniere: Termin abgesagt', `${s.name}, ${where(m, s)}: ${deD(m.plan_date)}`);
    tellPlayers(m, 'termin', mm => ({ title: 'Spieltermin abgesagt', body: `Clubmeisterschaft gegen ${mm.opp}: Der Termin am ${deD(m.plan_date)} fällt aus – bitte neu vereinbaren.` }), { except: req.member.id });
    return { ok: true };
  }));

  /* ================================================================= Tablet (/api/tablet/x/turniere/…) – nur Namen und Ergebnisse */
  ctx.tablet.get('/state', ar(async (req, res) => { const s = current(); res.json(s ? view(s, matchesOf(s.id)) : { season: null }); }));

  /* ================================================================= Verwaltung (/api/admin/x/turniere/…) */
  const A = ctx.admin;
  const uname = req => req.user.name || req.user.username;
  const seasonOr404 = (req, res) => { const s = seasonRow(req.params.id); if (!s) { bad(res, 'Saison nicht gefunden.', 404); return null; } return s; };
  const SEASON_LABELS = { name: 'Name', leagues: ['Ligen', 'list'], doubles: ['Doppel-Ligen', 'list'], reg_until: 'Anmeldeschluss', due_groups: 'Frist Gruppenphase', due_final: 'Frist Endspiele + Relegation' };
  const showSeason = s => ({ name: s.name, leagues: leaguesOf(s), doubles: doublesOf(s), reg_until: s.reg_until ? deD(s.reg_until) : '', due_groups: s.due_groups ? deD(s.due_groups) : '', due_final: s.due_final ? deD(s.due_final) : '' });
  /** Doppel-Ligen aus der Eingabe „A+B, C+D, E“ – jede Einzel-Liga höchstens einmal, je Doppel-Liga eine oder zwei benachbarte */
  function doublesInput(v, L) {
    if (v === undefined || v === null) return JSON.stringify(defaultDoubles(L));
    const list = (Array.isArray(v) ? v : String(v).split(/[,;]/)).map(x => String(x).toUpperCase().replace(/\s+/g, '').replace(/[/&]/g, '+')).filter(Boolean);
    const used = new Set();
    for (const k of list) {
      const parts = k.split('+');
      if (parts.length > 2 || parts.some(x => !L.includes(x))) throw new Error(`Doppel-Liga „${k}“: bitte Ligen wie „A+B“ oder „E“ angeben.`);
      if (parts.length === 2 && L.indexOf(parts[1]) !== L.indexOf(parts[0]) + 1) throw new Error(`Doppel-Liga „${k}“: bitte zwei benachbarte Ligen (z. B. „A+B“).`);
      for (const x of parts) { if (used.has(x)) throw new Error(`Liga ${x} steht in zwei Doppel-Ligen.`); used.add(x); }
    }
    return JSON.stringify(list);
  }
  function seasonInput(b, cur = null) {
    const name = txt(b.name, 60);
    if (name.length < 3) throw new Error('Bitte einen Namen eintragen (z. B. „Clubmeisterschaft 2027“).');
    const n = int(b.leagues);
    if (!(n >= 1 && n <= LETTERS.length)) throw new Error(`Bitte 1 bis ${LETTERS.length} Ligen wählen.`);
    const d = k => { const v = String(b[k] || ''); if (v && !isDate(v)) throw new Error('Bitte die Daten prüfen.'); return v || null; };
    const L = LETTERS.slice(0, n).split('');
    const v = { name, leagues: JSON.stringify(L), doubles: doublesInput(b.doubles, L), reg_until: d('reg_until'), due_groups: d('due_groups'), due_final: d('due_final') };
    if (v.due_groups && v.reg_until && v.due_groups < v.reg_until) throw new Error('Die Frist der Gruppenphase liegt vor dem Anmeldeschluss.');
    if (v.due_final && v.due_groups && v.due_final < v.due_groups) throw new Error('Die Frist für Endspiele und Relegation liegt vor der Frist der Gruppenphase.');
    if (cur && cur.drawn_at && v.leagues !== cur.leagues) throw new Error('Die Zahl der Ligen lässt sich nach der Auslosung nicht mehr ändern.');
    if (cur && cur.paired_at && v.doubles !== cur.doubles) throw new Error('Die Doppel-Ligen lassen sich nach der Partner-Auslosung nicht mehr ändern.');
    return v;
  }
  A.get('/meta', P, (req, res) => {
    const seasons = db.prepare('SELECT id, name, closed_at FROM tu_season ORDER BY id DESC').all();
    const c = current();
    res.json({ seasons, current: c ? c.id : null, cfg: cfg(), booking: bookingOn(), letters: LETTERS.split(''), defaults: Object.fromEntries(LETTERS.split('').map((x, i) => [i + 1, defaultDoubles(LETTERS.slice(0, i + 1).split('')).join(', ')])) });
  });
  A.get('/leute', P, (req, res) => res.json(db.prepare("SELECT id, name, kind FROM members WHERE kind = 'mitglied' AND active = 1 AND deleted = 0 AND pending = 0 ORDER BY name_key(name, kind)").all().map(m => ({ id: m.id, ln: lastFirst(m.name, m.kind) }))));
  A.get('/saison/:id', P, ar(async (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    const nm = names(), ms = await syncBookings(matchesOf(s.id)), v = view(s, ms, { nm });
    const teams = teamsOf(s.id), tById = new Map(teams.map(t => [t.id, t]));
    const regs = db.prepare('SELECT p.*, m.name AS mname, m.kind, m.deleted FROM tu_player p LEFT JOIN members m ON m.id = p.member_id WHERE p.season_id = ? ORDER BY name_key(m.name, m.kind)').all(s.id);
    const d0 = today();
    const all = ms.map(m => ({ id: m.id, phase: m.phase, phaseLabel: PHASE[m.phase], where: where(m, s), league: m.league, group: m.group_no, a: teamName(tById.get(m.a), nm), b: teamName(tById.get(m.b), nm),
      result: m.result, winner: m.winner, retired: m.retired, sets: m.sets, score: W.scoreText(m), done: decided(m), due: dueOf(s, m), overdue: !decided(m) && Boolean(dueOf(s, m)) && dueOf(s, m) < d0,
      date: m.plan_date, time: m.plan_time, court: m.court, booked: Boolean(m.booking_id), entered_by: m.entered_by, entered_at: m.entered_at }));
    const nmU = unpaired(s);
    const pairs = doublesOf(s).map(k => ({ key: k, teams: dTeams(s.id, k).map(t => ({ id: t.id, name: teamName(t, nm), group: t.group_no, members: players(t) })), unpaired: nmU[k].map(id => ({ member_id: id, name: nm.ln(id) })) }));
    res.json({ ...v, players: regs.map(p => ({ member_id: p.member_id, name: p.mname && !p.deleted ? lastFirst(p.mname, p.kind) : 'gelöschtes Konto', league: p.league, singles: Boolean(p.singles), doubles: Boolean(p.doubles), source: p.source })), pairs,
      matches: all, counts: { open: all.filter(m => !m.done).length, overdue: all.filter(m => m.overdue).length, done: all.filter(m => m.done).length, all: all.length },
      season: { ...v.season, created_at: s.created_at } });
  }));
  A.post('/saison', P, (req, res) => {
    let v; try { v = seasonInput(req.body || {}); } catch (e) { return bad(res, e.message); }
    const from = int((req.body || {}).carry) ? seasonRow((req.body || {}).carry) : null;
    if ((req.body || {}).carry && (!from || !from.closed_at)) return bad(res, 'Übernehmen geht nur aus einer abgeschlossenen Saison.');
    let id, carried = 0;
    db.transaction(() => {
      id = Number(db.prepare('INSERT INTO tu_season(name, leagues, doubles, reg_until, due_groups, due_final, created_by) VALUES (?,?,?,?,?,?,?)').run(v.name, v.leagues, v.doubles, v.reg_until, v.due_groups, v.due_final, uname(req)).lastInsertRowid);
      if (from) {   // Einteilung der Vorsaison inkl. Relegation – angemeldet ist damit noch niemand
        const L = J(v.leagues, []), { at } = nextLeagues(from);
        const ok = new Set(db.prepare("SELECT id FROM members WHERE kind = 'mitglied' AND active = 1 AND deleted = 0").all().map(r => r.id));
        const ins = db.prepare("INSERT INTO tu_player(season_id, member_id, league, singles, doubles, source) VALUES (?,?,?,0,0,'vorsaison')");
        for (const [mid, lg] of at) if (ok.has(mid)) { ins.run(id, mid, L.includes(lg) ? lg : L[L.length - 1]); carried++; }
      }
    })();
    audit(req.user, 'Turniere: Saison angelegt', `${ctx.auditDiff(SEASON_LABELS, {}, showSeason(seasonRow(id))) || v.name}${from ? ` · Einteilung aus „${from.name}“ übernommen (${carried})` : ''}`);
    res.json({ id, carried });
  });
  A.put('/saison/:id', P, (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    let v; try { v = seasonInput({ leagues: leaguesOf(s).length, ...(req.body || {}) }, s); } catch (e) { return bad(res, e.message); }
    const before = showSeason(s);
    if ((req.body || {}).doubles === undefined) v.doubles = s.doubles;
    db.prepare('UPDATE tu_season SET name = ?, leagues = ?, doubles = ?, reg_until = ?, due_groups = ?, due_final = ? WHERE id = ?').run(v.name, v.leagues, v.doubles, v.reg_until, v.due_groups, v.due_final, s.id);
    // weniger Ligen: Spieler der weggefallenen Ligen kommen in die neue unterste Liga
    const L = J(v.leagues, []);
    db.prepare(`UPDATE tu_player SET league = ? WHERE season_id = ? AND league NOT IN (${L.map(() => '?').join(',')})`).run(L[L.length - 1], s.id, ...L);
    const diff = ctx.auditDiff(SEASON_LABELS, before, showSeason(seasonRow(s.id)));
    if (diff) audit(req.user, 'Turniere: Saison geändert', `${v.name}: ${diff}`);
    res.json({ ok: true });
  });
  A.delete('/saison/:id', P, ar(async (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    for (const m of db.prepare('SELECT * FROM tu_match WHERE season_id = ?').all(s.id)) await dropMatch(m, 'Saison gelöscht');
    db.transaction(() => { for (const t of ['tu_team', 'tu_player', 'tu_honor']) db.prepare(`DELETE FROM ${t} WHERE season_id = ?`).run(s.id); db.prepare('DELETE FROM tu_season WHERE id = ?').run(s.id); })();
    audit(req.user, 'Turniere: Saison gelöscht', s.name);
    res.json({ ok: true });
  }));
  /* Teilnehmer */
  A.post('/saison/:id/spieler', P, (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    const b = req.body || {}, L = leaguesOf(s);
    const m = db.prepare("SELECT id, name, kind FROM members WHERE id = ? AND kind = 'mitglied' AND active = 1 AND deleted = 0").get(int(b.member_id));
    if (!m) return bad(res, 'Bitte ein Mitglied wählen.');
    const league = L.includes(b.league) ? b.league : L[L.length - 1];
    if (db.prepare('SELECT 1 FROM tu_player WHERE season_id = ? AND member_id = ?').get(s.id, m.id)) return bad(res, 'Diese Person ist schon eingetragen.');
    const dbl = b.doubles && doublesOf(s).length ? 1 : 0, sg = b.singles === undefined ? 1 : (b.singles ? 1 : 0);
    db.prepare("INSERT INTO tu_player(season_id, member_id, league, singles, doubles, source) VALUES (?,?,?,?,?,'verwaltung')").run(s.id, m.id, league, sg, dbl);
    audit(req.user, 'Turniere: Spieler eingetragen', `${s.name}: ${lastFirst(m.name, m.kind)}, Liga ${league}`);
    res.json({ ok: true });
  });
  A.put('/saison/:id/spieler/:mid', P, (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    const p = db.prepare('SELECT * FROM tu_player WHERE season_id = ? AND member_id = ?').get(s.id, int(req.params.mid));
    if (!p) return bad(res, 'Nicht gefunden.', 404);
    const b = req.body || {}, L = leaguesOf(s);
    if (b.league !== undefined && !L.includes(b.league)) return bad(res, 'Unbekannte Liga.');
    const next = { league: b.league === undefined ? p.league : b.league, singles: b.singles === undefined ? p.singles : (b.singles ? 1 : 0), doubles: b.doubles === undefined ? p.doubles : (b.doubles && doublesOf(s).length ? 1 : 0) };
    const inDraw = db.prepare("SELECT 1 FROM tu_team WHERE season_id = ? AND comp = 'E' AND p1 = ?").get(s.id, p.member_id);
    if (inDraw && (next.league !== p.league || !next.singles)) return bad(res, 'Diese Person ist schon ausgelost – erst die Liga neu auslosen (Gruppen), dann umsetzen.');
    const inPair = db.prepare("SELECT 1 FROM tu_team WHERE season_id = ? AND comp = 'D' AND (p1 = ? OR p2 = ?)").get(s.id, p.member_id, p.member_id);
    if (inPair && (next.league !== p.league || !next.doubles)) return bad(res, 'Diese Person hat schon einen Doppelpartner – erst das Paar auflösen, dann umsetzen.');
    db.prepare('UPDATE tu_player SET league = ?, singles = ?, doubles = ? WHERE season_id = ? AND member_id = ?').run(next.league, next.singles, next.doubles, s.id, p.member_id);
    const diff = ctx.auditDiff({ league: 'Liga', singles: ['Einzel', 'bool'], doubles: ['Doppel', 'bool'] }, { league: p.league, singles: Boolean(p.singles), doubles: Boolean(p.doubles) }, { league: next.league, singles: Boolean(next.singles), doubles: Boolean(next.doubles) });
    if (diff) audit(req.user, 'Turniere: Spieler umgesetzt', `${s.name}, ${names().ln(p.member_id)}: ${diff}`);
    res.json({ ok: true });
  });
  A.delete('/saison/:id/spieler/:mid', P, (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    const mid = int(req.params.mid);
    if (db.prepare("SELECT 1 FROM tu_team WHERE season_id = ? AND (p1 = ? OR p2 = ?)").get(s.id, mid, mid)) return bad(res, 'Diese Person ist schon ausgelost – erst die Liga neu auslosen (bzw. das Paar auflösen) oder die Spiele als kampflos werten.');
    db.prepare('DELETE FROM tu_player WHERE season_id = ? AND member_id = ?').run(s.id, mid);
    audit(req.user, 'Turniere: Spieler entfernt', `${s.name}: ${names().ln(mid)}`);
    res.json({ ok: true });
  });
  /* Auslosung */
  A.post('/saison/:id/auslosen', P, ar(async (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    if (s.closed_at) return bad(res, 'Die Saison ist abgeschlossen.');
    const b = req.body || {};
    if (b.step === 'partner' || b.step === 'doppel') {
      if (b.league && !doublesOf(s).includes(b.league)) return bad(res, 'Unbekannte Doppel-Liga.');
      return res.json(b.step === 'partner' ? await drawPartners(s, b.league || null, req.user) : await drawDoubles(s, b.league || null, req.user));
    }
    if (b.league && !leaguesOf(s).includes(b.league)) return bad(res, 'Unbekannte Liga.');
    res.json(await drawSingles(s, b.league || null, req.user));
  }));
  /** Paar von Hand bilden (z. B. aus den Übrigen ohne Partner) bzw. auflösen – solange die Doppel-Gruppen der Liga nicht ausgelost sind */
  A.post('/saison/:id/paar', P, (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    const b = req.body || {}, k = String(b.league || '');
    if (!doublesOf(s).includes(k)) return bad(res, 'Unbekannte Doppel-Liga.');
    if (dTeams(s.id, k).some(t => t.group_no > 0)) return bad(res, `Die Gruppen im Doppel ${k} sind schon ausgelost – erst neu auslosen, dann Paare ändern.`);
    const free = unpaired(s)[k], a = int(b.p1), c = int(b.p2);
    if (!a || !c || a === c || !free.includes(a) || !free.includes(c)) return bad(res, 'Bitte zwei Personen ohne Partner aus dieser Doppel-Liga wählen.');
    const nm = names();
    db.prepare("INSERT INTO tu_team(season_id, comp, league, group_no, p1, p2, name) VALUES (?, 'D', ?, 0, ?, ?, ?)").run(s.id, k, a, c, pairName(a, c, nm));
    audit(req.user, 'Turniere: Doppelpaar gebildet', `${s.name}, Doppel ${k}: ${nm.ln(a)} + ${nm.ln(c)}`);
    res.json({ ok: true });
  });
  A.delete('/saison/:id/paar/:tid', P, (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    const t = db.prepare("SELECT * FROM tu_team WHERE id = ? AND season_id = ? AND comp = 'D'").get(int(req.params.tid), s.id);
    if (!t) return bad(res, 'Paar nicht gefunden.', 404);
    if (dTeams(s.id, t.league).some(x => x.group_no > 0)) return bad(res, `Die Gruppen im Doppel ${t.league} sind schon ausgelost – erst neu auslosen, dann Paare ändern.`);
    db.prepare('DELETE FROM tu_team WHERE id = ?').run(t.id);
    audit(req.user, 'Turniere: Doppelpaar aufgelöst', `${s.name}, Doppel ${t.league}: ${teamName(t, names())}`);
    res.json({ ok: true });
  });
  /** zwei Spieler derselben Liga zwischen den Gruppen tauschen (solange in beiden Gruppen nichts gewertet ist) */
  A.post('/saison/:id/tausch', P, ar(async (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    const b = req.body || {};
    const x = db.prepare('SELECT * FROM tu_team WHERE id = ? AND season_id = ?').get(int(b.a), s.id), y = db.prepare('SELECT * FROM tu_team WHERE id = ? AND season_id = ?').get(int(b.b), s.id);
    if (!x || !y || x.comp !== y.comp || x.league !== y.league || x.group_no === y.group_no) return bad(res, 'Bitte zwei Spieler aus verschiedenen Gruppen derselben Liga wählen.');
    const played = no => db.prepare("SELECT 1 FROM tu_match WHERE season_id = ? AND comp = ? AND league = ? AND phase = 'gruppe' AND group_no = ? AND (winner IS NOT NULL OR result = 'ausgefallen')").get(s.id, x.comp, x.league, no);
    if (played(x.group_no) || played(y.group_no)) return bad(res, 'In einer der Gruppen ist schon ein Spiel gewertet – tauschen geht nicht mehr.');
    await dropGroups(s.id, x.comp, x.league, [x.group_no, y.group_no]);
    db.transaction(() => {
      db.prepare('UPDATE tu_team SET group_no = ? WHERE id = ?').run(y.group_no, x.id); db.prepare('UPDATE tu_team SET group_no = ? WHERE id = ?').run(x.group_no, y.id);
      makeGroupMatches(s.id, x.comp, x.league, x.group_no); makeGroupMatches(s.id, x.comp, x.league, y.group_no);
    })();
    const nm = names();
    audit(req.user, 'Turniere: Spieler getauscht', `${s.name}, ${x.comp === 'D' ? 'Doppel' : 'Liga'} ${x.league}: ${teamName(x, nm)} ↔ ${teamName(y, nm)}`);
    await reconcile(s.id);
    res.json({ ok: true });
  }));
  /** Teams einer Liga mit Gruppe (für „Tauschen“) */
  A.get('/saison/:id/gruppen', P, (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    const nm = names();
    res.json(teamsOf(s.id).filter(t => t.group_no > 0).map(t => ({ id: t.id, comp: t.comp, league: t.league, group: t.group_no, name: teamName(t, nm) })));
  });
  /** Endrunde und Relegation nach Fristende: offene Gruppenspiele zeigen (preview) bzw. als ausgefallen werten und setzen */
  A.post('/saison/:id/endrunde', P, ar(async (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    const nm = names(), tById = new Map(teamsOf(s.id).map(t => [t.id, t]));
    const open = matchesOf(s.id).filter(m => m.phase === 'gruppe' && !decided(m));
    if ((req.body || {}).preview) return res.json({ open: open.map(m => ({ id: m.id, where: where(m, s), a: teamName(tById.get(m.a), nm), b: teamName(tById.get(m.b), nm) })) });
    db.prepare("UPDATE tu_match SET result = 'ausgefallen', sets = '[]', winner = NULL, entered_by = ?, entered_at = ? WHERE season_id = ? AND phase = 'gruppe' AND winner IS NULL AND result IS NULL").run(uname(req), nowTs(), s.id);
    if (open.length) audit(req.user, 'Turniere: Gruppenphase beendet', `${s.name}: ${open.length} offene ${open.length === 1 ? 'Spiel' : 'Spiele'} als ausgefallen gewertet`);
    const r = await reconcile(s.id);
    res.json({ ok: true, created: r.created.length, warnings: r.warnings });
  }));
  /** Saisonabschluss: Vorschau (Clubmeister, offene Spiele, Wechsel durch die Relegation) bzw. abschließen und Ehrentafel schreiben */
  A.post('/saison/:id/abschluss', P, (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    if (s.closed_at) return bad(res, 'Die Saison ist schon abgeschlossen.');
    const nm = names(), champs = champions(s), { moves } = nextLeagues(s);
    const open = matchesOf(s.id).filter(m => !decided(m)).length;
    if ((req.body || {}).preview) return res.json({ champions: champs, open, moves: moves.map(x => ({ name: nm.ln(x.member_id), from: x.from, to: x.to })) });
    const year = String((s.due_final || s.due_groups || today()).slice(0, 4));
    db.transaction(() => {
      db.prepare('UPDATE tu_season SET closed_at = ? WHERE id = ?').run(nowTs(), s.id);
      db.prepare('DELETE FROM tu_honor WHERE season_id = ?').run(s.id);
      for (const c of champs) db.prepare('INSERT INTO tu_honor(season_id, year, title, names, created_by) VALUES (?,?,?,?,?)').run(s.id, year, c.title, c.names, uname(req));
    })();
    audit(req.user, 'Turniere: Saison abgeschlossen', `${s.name}${champs.length ? ': ' + champs.map(c => `${c.title}: ${c.names}`).join('; ') : ''}${open ? ` · ${open} Spiele offen geblieben` : ''}`);
    res.json({ ok: true });
  });
  /** Ehrentafel: frühere Jahre von Hand ergänzen bzw. solche Einträge löschen */
  A.post('/ehrentafel', P, (req, res) => {
    const b = req.body || {}, year = String(b.year || '').trim(), title = txt(b.title, 60), who = txt(b.names, 120);
    if (!/^(19|20)\d\d$/.test(year)) return bad(res, 'Bitte ein Jahr eintragen (z. B. 2019).');
    if (title.length < 3 || who.length < 3) return bad(res, 'Bitte Titel und Namen eintragen.');
    db.prepare('INSERT INTO tu_honor(year, title, names, created_by) VALUES (?,?,?,?)').run(year, title, who, uname(req));
    audit(req.user, 'Turniere: Ehrentafel ergänzt', `${year}: ${title} – ${who}`);
    res.json({ ok: true });
  });
  A.delete('/ehrentafel/:id', P, (req, res) => {
    const h = db.prepare('SELECT * FROM tu_honor WHERE id = ? AND season_id IS NULL').get(int(req.params.id));
    if (!h) return bad(res, 'Nur von Hand ergänzte Einträge lassen sich löschen.', 404);
    db.prepare('DELETE FROM tu_honor WHERE id = ?').run(h.id);
    audit(req.user, 'Turniere: Ehrentafel-Eintrag gelöscht', `${h.year}: ${h.title} – ${h.names}`);
    res.json({ ok: true });
  });
  A.get('/ehrentafel', P, (req, res) => res.json(honors()));
  /** Einteilung aus Excel/CSV: lesen und Namen zuordnen (preview), dann übernehmen */
  A.post('/saison/:id/import', P, ar(async (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    if (s.drawn_at || s.paired_at || s.closed_at) return bad(res, 'Importieren geht nur vor der Auslosung.');
    const b = req.body || {}, L = leaguesOf(s);
    if (!Array.isArray(b.rows)) {
      let rows; try { rows = rowsFrom(await readSheets(b), L); } catch (e) { return bad(res, e.message || 'Die Datei konnte nicht gelesen werden.'); }
      if (!rows.length) return bad(res, 'In der Datei steht keine Einteilung – gebraucht werden die Spalten „Name“ (oder „Vorname“ und „Nachname“) und „Liga“ (oder je Liga ein Blatt „A“, „B“ …).');
      return res.json({ rows: matchNames(rows.slice(0, 500)) });
    }
    const ok = new Set(db.prepare("SELECT id FROM members WHERE kind = 'mitglied' AND active = 1 AND deleted = 0").all().map(r => r.id));
    let n = 0, skip = 0;
    db.transaction(() => {
      for (const r of b.rows.slice(0, 500)) {
        const mid = int(r.member_id), lg = String(r.league || '');
        if (!ok.has(mid) || !L.includes(lg)) { skip++; continue; }
        const cur = db.prepare('SELECT * FROM tu_player WHERE season_id = ? AND member_id = ?').get(s.id, mid);
        if (cur) db.prepare('UPDATE tu_player SET league = ? WHERE season_id = ? AND member_id = ?').run(lg, s.id, mid);
        else db.prepare("INSERT INTO tu_player(season_id, member_id, league, singles, doubles, source) VALUES (?,?,?,0,0,'import')").run(s.id, mid, lg);
        n++;
      }
    })();
    audit(req.user, 'Turniere: Einteilung importiert', `${s.name}: ${n} Personen${skip ? `, ${skip} nicht übernommen` : ''}`);
    res.json({ ok: true, n, skip });
  }));
  /* Spiele */
  A.put('/spiel/:id', P, ar(async (req, res) => {
    const m = matchRow(req.params.id); if (!m) return bad(res, 'Spiel nicht gefunden.', 404);
    const s = seasonRow(m.season_id); if (s.closed_at) return bad(res, 'Die Saison ist abgeschlossen.');
    try { res.json({ ok: true, ...(await saveResult(m, req.body || {}, { by: req.user, admin: true })) }); } catch (e) { bad(res, e.message); }
  }));
  A.post('/spiel/:id/erinnern', P, ar(async (req, res) => {
    const m = matchRow(req.params.id); if (!m || decided(m)) return bad(res, 'Dieses Spiel ist nicht mehr offen.');
    await remind(m, uname(req));
    audit(req.user, 'Turniere: Erinnerung geschickt', `${seasonRow(m.season_id).name}, ${where(m, seasonRow(m.season_id))}`);
    res.json({ ok: true });
  }));
  A.post('/saison/:id/erinnern', P, ar(async (req, res) => {
    const s = seasonOr404(req, res); if (!s) return;
    const late = matchesOf(s.id).filter(m => !decided(m) && dueOf(s, m) && dueOf(s, m) < today());
    for (const m of late) await remind(m, uname(req));
    if (late.length) audit(req.user, 'Turniere: Erinnerung geschickt', `${s.name}: ${late.length} überfällige ${late.length === 1 ? 'Spiel' : 'Spiele'}`);
    res.json({ ok: true, n: late.length });
  }));
  A.put('/einstellungen', P, (req, res) => {
    const b = req.body || {}, before = cfg();
    if (b.minutes !== undefined) { if (![60, 90, 120, 150, 180].includes(int(b.minutes))) return bad(res, 'Bitte eine Spieldauer wählen.'); SET('minutes', int(b.minutes)); }
    const diff = ctx.auditDiff({ minutes: 'Platz je Spiel (Minuten)' }, before, cfg());
    if (diff) audit(req.user, 'Turniere: Einstellungen geändert', diff);
    res.json({ ok: true, cfg: cfg() });
  });

  /* ================================================================= für den Kern und andere Module */
  ctx.hooks.appVisible = () => Boolean(db.prepare('SELECT 1 FROM tu_season LIMIT 1').get());
  ctx.hooks.tabletVisible = () => Boolean(db.prepare('SELECT 1 FROM tu_season LIMIT 1').get());
  /* „Für mich“: eigene Spiele mit Termin, sonst eine Zeile mit Offenem (Anmeldung, Spiele ohne Termin) */
  ctx.hooks.forMe = (mid, { until }) => {
    const s = current(); if (!s || s.closed_at) return {};
    const nm = names(), d0 = today();
    const teams = teamsOf(s.id), tById = new Map(teams.map(t => [t.id, t]));
    const mine = new Set(teams.filter(t => players(t).includes(mid)).map(t => t.id));
    const open = matchesOf(s.id).filter(m => (mine.has(m.a) || mine.has(m.b)) && !decided(m));
    const opp = m => teamName(tById.get(mine.has(m.a) ? m.b : m.a), nm);
    const next = open.filter(m => m.plan_date && m.plan_date >= d0 && m.plan_date <= until).map(m => ({ at: m.plan_date, start: m.plan_time || undefined, end: m.plan_end || undefined,
      title: `Clubmeisterschaft gegen ${opp(m)}`, sub: [m.court, PHASE[m.phase]].filter(Boolean).join(' · '), focus: String(m.id) }));
    const free = open.filter(m => !m.plan_date || m.plan_date < d0);
    const reg = db.prepare('SELECT 1 FROM tu_player WHERE season_id = ? AND member_id = ? AND (singles = 1 OR doubles = 1)').get(s.id, mid);
    const out = { next, open: [] };
    if (free.length) {
      const due = free.map(m => dueOf(s, m)).filter(Boolean).sort()[0];
      out.open.push({ title: free.length === 1 ? `Clubmeisterschaft: Spiel gegen ${opp(free[0])}` : `Clubmeisterschaft: ${free.length} Spiele ohne Termin`, sub: due ? `Frist ${deD(due)}` : 'Termin vereinbaren', focus: free.length === 1 ? String(free[0].id) : '' });
    } else if (regOpen(s) && !reg) out.open.push({ title: `${s.name}: Anmeldung offen`, sub: s.reg_until ? `bis ${deD(s.reg_until)}` : 'Ich spiele mit' });
    return out;
  };
  ctx.hooks.overview = () => {
    const s = current(); if (!s || s.closed_at) return { kpis: [], alerts: [] };
    const ms = matchesOf(s.id), d0 = today();
    const late = ms.filter(m => !decided(m) && dueOf(s, m) && dueOf(s, m) < d0).length;
    const alerts = [];
    if (!s.drawn_at && !s.paired_at && s.reg_until && s.reg_until < d0) alerts.push({ level: 'a', text: `${s.name}: Die Anmeldung ist vorbei – jetzt die Gruppen auslosen.`, sec: ['tab_turniere', 'teilnehmer'] });
    if (late) alerts.push({ level: 'a', text: `${s.name}: ${late} ${late === 1 ? 'Spiel ist' : 'Spiele sind'} überfällig.`, sec: ['tab_turniere', 'spiele'] });
    return { kpis: [{ l: 'Offene Turnierspiele', v: ms.filter(m => !decided(m)).length }], alerts };
  };
  ctx.hooks.memberLinks = id => {
    const out = [];
    for (const s of db.prepare('SELECT * FROM tu_season WHERE closed_at IS NULL').all()) {
      const tids = db.prepare('SELECT id FROM tu_team WHERE season_id = ? AND (p1 = ? OR p2 = ?)').all(s.id, id, id).map(r => r.id);
      const n = tids.length ? db.prepare(`SELECT COUNT(*) n FROM tu_match WHERE season_id = ? AND winner IS NULL AND (result IS NULL OR result != 'ausgefallen') AND (a IN (${tids.join(',')}) OR b IN (${tids.join(',')}))`).get(s.id).n : 0;
      if (n) out.push(`${s.name}: ${n} offene ${n === 1 ? 'Spiel' : 'Spiele'}`);
      else if (!tids.length && db.prepare('SELECT 1 FROM tu_player WHERE season_id = ? AND member_id = ? AND (singles = 1 OR doubles = 1)').get(s.id, id)) out.push(`${s.name}: angemeldet`);
    }
    return out;
  };
  // Konto zusammengeführt: Anmeldungen und Spiele wandern mit; gelöscht: Anmeldung weg, Spiele bleiben mit dem Namen der Auslosung
  ctx.hooks.memberRemoved = (fromId, intoId) => {
    if (intoId) { db.prepare('UPDATE OR IGNORE tu_player SET member_id = ? WHERE member_id = ?').run(intoId, fromId); db.prepare('UPDATE tu_team SET p1 = ? WHERE p1 = ?').run(intoId, fromId); db.prepare('UPDATE tu_team SET p2 = ? WHERE p2 = ?').run(intoId, fromId); }
    else { db.prepare('UPDATE tu_team SET p1 = NULL WHERE p1 = ?').run(fromId); db.prepare('UPDATE tu_team SET p2 = NULL WHERE p2 = ?').run(fromId); }
    db.prepare('DELETE FROM tu_player WHERE member_id = ?').run(fromId);
  };
  ctx.hooks.exportConfig = () => ({ settings: cfg() });
  ctx.hooks.importConfig = data => {
    if (!data || typeof data !== 'object') throw new Error('Leere Funktionsdatei.');
    const n = int((data.settings || {}).minutes);
    if ([60, 90, 120, 150, 180].includes(n)) SET('minutes', n);
    return 'Einstellungen übernommen';
  };
}

exports.activate = activate;
