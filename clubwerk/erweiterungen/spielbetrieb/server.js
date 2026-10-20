'use strict';
/* =====================================================================================================
   Modul „Spielbetrieb“
   Mannschaften (Mannschaftsführer, Stellvertreter, Spieler in Meldelisten-Reihenfolge), Spieltage (Heim und Auswärts, aus dem
   Spielplan des Verbands oder von Hand), Verfügbarkeit der Spieler („kann“ / „kann nicht“, optional „ab“/„bis“ Uhrzeit),
   Aufstellung durch den Mannschaftsführer in der Mitglieder-App, Absage-Anfragen, Ampel (genug Spieler?), optional Aufgaben
   (Fahrer, Bewirtung …) und Erinnerungen. Läuft ohne Mitgliederverwaltung (dann ohne E-Mail, nur Push).
   ===================================================================================================== */
const crypto = require('crypto');
const { today, nowTs, isDate, addDays, deD } = require('../../src/util');

const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const txt = (v, max = 120) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const J = (v, d) => { try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const wd = d => WD[new Date(d + 'T12:00:00Z').getUTCDay()];
const DEFAULT_TASKS = [
  { k: 'fahrer', l: 'Fahrer', when: 'auswaerts' },
  { k: 'bewirtung', l: 'Bewirtung', when: 'heim' },
  { k: 'baelle', l: 'Bälle mitbringen', when: 'immer' },
  { k: 'bericht', l: 'Spielbericht eintragen', when: 'immer' },
];

function tables(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS sp_team (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, league TEXT, season TEXT, min_players INTEGER NOT NULL DEFAULT 4,
  captain_id INTEGER REFERENCES members(id), vice_id INTEGER REFERENCES members(id), import_key TEXT,
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS sp_player (
  team_id INTEGER NOT NULL REFERENCES sp_team(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id),
  rank INTEGER NOT NULL DEFAULT 99, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY (team_id, member_id)
);
CREATE TABLE IF NOT EXISTS sp_game (
  id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER NOT NULL REFERENCES sp_team(id) ON DELETE CASCADE,
  date TEXT NOT NULL, start TEXT, home INTEGER NOT NULL DEFAULT 1, opponent TEXT NOT NULL, venue TEXT, league TEXT,
  ext_key TEXT, status TEXT NOT NULL DEFAULT 'geplant',        -- geplant | abgesagt
  meet_time TEXT, meet_place TEXT, note TEXT, result TEXT,
  rem_players INTEGER NOT NULL DEFAULT 0, rem_captain INTEGER NOT NULL DEFAULT 0, lineup_sent_at TEXT,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_sp_game_team ON sp_game(team_id, date);
CREATE INDEX IF NOT EXISTS ix_sp_game_key ON sp_game(ext_key);
CREATE TABLE IF NOT EXISTS sp_avail (
  game_id INTEGER NOT NULL REFERENCES sp_game(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id),
  state TEXT NOT NULL,                                          -- ja | nein
  from_t TEXT, until_t TEXT, note TEXT, at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY (game_id, member_id)
);
CREATE TABLE IF NOT EXISTS sp_lineup (
  game_id INTEGER NOT NULL REFERENCES sp_game(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id),
  role TEXT NOT NULL DEFAULT 'spielt',                          -- spielt | ersatz
  pos INTEGER, withdraw INTEGER NOT NULL DEFAULT 0, withdraw_note TEXT, withdraw_at TEXT,
  by_user TEXT, at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY (game_id, member_id)
);
CREATE TABLE IF NOT EXISTS sp_task (
  id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER NOT NULL REFERENCES sp_game(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, label TEXT NOT NULL, member_id INTEGER REFERENCES members(id), note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_sp_task_game ON sp_task(game_id);
`);
  // 3.23: Altersklasse (Rahmenterminplan) und vorläufige Spieltage
  const has = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c);
  if (!has('sp_team', 'age_class')) db.exec('ALTER TABLE sp_team ADD COLUMN age_class TEXT');
  if (!has('sp_game', 'kind')) db.exec("ALTER TABLE sp_game ADD COLUMN kind TEXT NOT NULL DEFAULT 'spiel'");   // spiel | rahmen (vorläufig)
  if (!has('sp_game', 'za')) db.exec('ALTER TABLE sp_game ADD COLUMN za INTEGER NOT NULL DEFAULT 0');           // Zusatz-/Ausweichtermin
  if (!has('sp_game', 'released')) db.exec('ALTER TABLE sp_game ADD COLUMN released INTEGER NOT NULL DEFAULT 1'); // in der App sichtbar
}

function activate(ctx) {
  const db = ctx.db;
  tables(db);
  const { need, bad, int, rateLimit } = ctx;
  const S = (k, d = '') => ctx.getSetting('ext_spielbetrieb_' + k, d);
  const SET = (k, v) => ctx.setSetting('ext_spielbetrieb_' + k, String(v));
  const P = need('spielbetrieb');
  const admin = ctx.admin, M = ctx.member;
  const ar = fn => ctx.asyncRoute(fn);
  const IMP = ctx.require('./spielplan');
  const RTP = require('./rahmen');
  /* ----- Keine doppelten Mannschaften: gleiche Altersklasse + gleiche Nummer = dieselbe Mannschaft
     („Herren 30“ = „Herren 30 I“ = „H30“); die zweite heißt „Herren 30 II“ ----- */
  const ROM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  const classOf = t => t.age_class || RTP.guessClass(t.name, t.league);
  const sameTeam = (a, b) => { const ca = classOf(a), cb = classOf(b); return ca && cb ? ca === cb && IMP.teamNo(a.name) === IMP.teamNo(b.name) : IMP.norm(a.name) === IMP.norm(b.name); };
  /** Vorschlag für die nächste freie Nummer: „Herren 30“ → „Herren 30 II“ */
  function nextName(v) {
    const ca = classOf(v), used = new Set(db.prepare('SELECT name, league, age_class FROM sp_team').all().filter(t => (ca ? classOf(t) === ca : IMP.norm(t.name).startsWith(IMP.norm(v.name)))).map(t => IMP.teamNo(t.name)));
    let n = 2; while (used.has(n) && n < 9) n++;
    return `${String(v.name).replace(/\s+(I|1)\.?$/i, '').trim()} ${ROM[n]}`;
  }
  const dupOf = (v, exceptId = 0) => db.prepare('SELECT * FROM sp_team WHERE id != ?').all(exceptId).find(t => sameTeam(t, v));
  // vorhandene Doppelte (vor 3.24 möglich) einmalig durchnummerieren
  db.transaction(() => {
    const all = db.prepare('SELECT * FROM sp_team ORDER BY id').all(), seen = [];
    for (const t of all) {
      if (seen.some(x => sameTeam(x, t))) { const nn = nextName(t); db.prepare('UPDATE sp_team SET name = ?, import_key = ? WHERE id = ?').run(nn, IMP.norm(nn), t.id); t.name = nn; ctx.audit(null, 'Spielbetrieb: doppelte Mannschaft umbenannt', nn); }
      seen.push(t);
    }
  })();
  const { splitPersonName } = ctx.require('./db');
  const lf = n => { const x = splitPersonName(n); return x.first ? `${x.last}, ${x.first}` : x.last; };
  const short = n => { const x = splitPersonName(n); return x.first ? `${x.first} ${String(x.last || '')[0] || ''}.` : x.last; };
  const uname = req => (req.user ? req.user.name || req.user.username : req.member ? req.member.name : 'App');

  /* ---------- Einstellungen ---------- */
  const cfg = () => ({
    seeAvail: S('see_avail', '1') === '1',        // Spieler sehen, wer sonst kann
    seeLineup: S('see_lineup', '1') === '1',      // Spieler sehen die Aufstellung
    capInfo: S('cap_info', '1') === '1',          // Mannschaftsführer mit Handynummer oben in der App (für Rückfragen)
    times: S('times', '1') === '1',               // „kann ab / bis … Uhr“ anbieten
    tasks: S('tasks', '0') === '1',               // Aufgaben je Spieltag
    taskKinds: J(S('task_kinds', ''), null) || DEFAULT_TASKS,
    remind: S('remind', '0') === '1',             // automatische Erinnerungen
    remindDays: Math.max(1, Math.min(30, int(S('remind_days', '7')) || 7)),
    captainDays: Math.max(1, Math.min(30, int(S('captain_days', '5')) || 5)),
    mail: S('mail', '1') === '1',
    za: S('za', '0') === '1',                     // Zusatz-/Ausweichtage des Rahmenterminplans abfragen
    club: S('import_club', ''),
  });

  /* ---------- Bausteine ---------- */
  const team = id => db.prepare('SELECT * FROM sp_team WHERE id = ?').get(int(id));
  const game = id => db.prepare('SELECT * FROM sp_game WHERE id = ?').get(int(id));
  const memberName = id => { const r = id ? db.prepare('SELECT name FROM members WHERE id = ?').get(id) : null; return r ? r.name : ''; };
  const isMember = id => Boolean(id && db.prepare("SELECT 1 FROM members WHERE id = ? AND deleted = 0").get(id));
  const roster = teamId => db.prepare(`SELECT p.member_id, p.rank, m.name FROM sp_player p JOIN members m ON m.id = p.member_id
    WHERE p.team_id = ? AND m.deleted = 0 AND m.active = 1 ORDER BY p.rank, name_key(m.name, m.kind)`).all(teamId);
  const captainOf = memberId => db.prepare('SELECT id FROM sp_team WHERE active = 1 AND (captain_id = ? OR vice_id = ?)').all(memberId, memberId).map(r => r.id);
  const myTeams = memberId => db.prepare(`SELECT DISTINCT t.* FROM sp_team t LEFT JOIN sp_player p ON p.team_id = t.id AND p.member_id = ?
    WHERE t.active = 1 AND (p.member_id IS NOT NULL OR t.captain_id = ? OR t.vice_id = ?) ORDER BY t.sort, t.name`).all(memberId, memberId, memberId);
  const isCaptain = (memberId, teamId) => captainOf(memberId).includes(Number(teamId));
  const leaders = t => [t.captain_id, t.vice_id].filter(Boolean);
  const gameTitle = (g, t) => (g.kind === 'rahmen' ? `${t ? t.name : 'Spiel'} · ${g.za ? 'Zusatz-/Ausweichtermin' : 'Rahmentermin'}` : `${t ? t.name : 'Spiel'} ${g.home ? 'gegen' : 'bei'} ${g.opponent}`);
  const gameWhen = g => `${wd(g.date)} ${deD(g.date)}${g.start ? ` · ${g.start} Uhr` : ''}`;

  /** Wer spielt am selben Tag schon in einer anderen Mannschaft? → Map member_id → Mannschaftsname (eine Person spielt je Tag nur einmal) */
  const playingElsewhere = g => new Map(db.prepare(`SELECT l.member_id, t.name FROM sp_lineup l JOIN sp_game g2 ON g2.id = l.game_id JOIN sp_team t ON t.id = g2.team_id
    WHERE g2.date = ? AND g2.id != ? AND g2.status = 'geplant' AND l.role = 'spielt'`).all(g.date, g.id).map(r => [r.member_id, r.name]));
  /** Zahlen und Ampel für einen Spieltag */
  function stats(g, t, ros) {
    ros = ros || roster(g.team_id);
    const ids = new Set(ros.map(r => r.member_id)), busy = playingElsewhere(g);
    const av = db.prepare('SELECT member_id, state FROM sp_avail WHERE game_id = ?').all(g.id).filter(a => ids.has(a.member_id));
    // wer am selben Tag schon in einer anderen Mannschaft spielt, zählt hier nicht als Zusage
    const yes = av.filter(a => a.state === 'ja' && !busy.has(a.member_id)).length, no = av.filter(a => a.state === 'nein').length;
    const lu = db.prepare('SELECT role, withdraw FROM sp_lineup WHERE game_id = ?').all(g.id);
    const playing = lu.filter(x => x.role === 'spielt').length, reserve = lu.filter(x => x.role === 'ersatz').length, withdraws = lu.filter(x => x.withdraw).length;
    const min = (t || team(g.team_id) || {}).min_players || 4;
    const elsewhere = av.filter(a => a.state === 'ja' && busy.has(a.member_id)).length;
    return { roster: ros.length, yes, no, open: ros.length - yes - no - elsewhere, elsewhere, playing, reserve, withdraws, min, ok: yes >= min, lineupOk: playing >= min };
  }

  /* ---------- Nachrichten: Push immer, E-Mail zusätzlich (wenn Mitgliederverwaltung + Postfach + Einstellung) ---------- */
  const mvHook = async (name, ...a) => { const r = await ctx.callHooks(name, ...a); const x = r.find(y => y.id === 'mitglieder'); return x ? x.result : null; };
  async function tell(ids, ev, { title, body, mail = null }) {
    ids = [...new Set((ids || []).filter(Boolean).map(Number))];
    if (!ids.length) return;
    if (ctx.push) ctx.push.send(ids, ev, { title, body, url: './#spielbetrieb', tag: `sp-${ev}` }).catch(() => {});
    if (!mail || !cfg().mail || !ctx.mail.ready() || !ctx.isModuleActive('mitglieder')) return;
    const club = ctx.getSetting('club_name', 'Verein');
    for (const id of ids) {
      const a = await mvHook('memberAddress', id).catch(() => null);
      if (!a || !a.email) continue;
      const hi = `Hallo ${String(a.name || '').split(' ')[0]},`;
      try {
        await ctx.mail.send({ to: a.email, subject: `${title} – ${club}`, text: [hi, '', ...mail.lines, '', 'Viele Grüße', club].join('\n'),
          card: { heading: mail.heading || title, before: [hi, '', mail.intro || ''].join('\n'), title: mail.cardTitle, rows: mail.rows, after: [mail.outro || '', ...(mail.attachments ? ['', 'Der Termin hängt als Kalendereintrag an – antippen und „Hinzufügen“.'] : []), '', 'Viele Grüße', club].join('\n'), calendar: mail.calendar || null },
          attachments: mail.attachments });
      } catch (e) { /* nächste Person */ }
    }
  }

  /* ---------- Kalenderdatei je Spieltag (Link mit Prüfsumme) ---------- */
  if (!S('ics_key')) SET('ics_key', crypto.randomBytes(24).toString('hex'));
  const icsToken = id => crypto.createHmac('sha256', S('ics_key')).update('sp' + id).digest('hex').slice(0, 32);
  const icsEsc = v => String(v || '').replace(/\\/g, '\\\\').replace(/[;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
  const utc = (d, t) => new Date(`${d}T${t || '10:00'}:00`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function icsText(g) {
    const t = team(g.team_id) || { name: 'Mannschaft' };
    const club = ctx.getSetting('club_name', 'Verein');
    const end = g.start ? (() => { const [h, m] = g.start.split(':').map(Number); const x = Math.min(23 * 60 + 59, h * 60 + m + 5 * 60); return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; })() : '18:00';
    const meet = [g.meet_time ? `Treffpunkt ${g.meet_time} Uhr` : '', g.meet_place || ''].filter(Boolean).join(', ');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Clubwerk//Spielbetrieb//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:sp-${g.id}@clubwerk`, `DTSTAMP:${utc(today(), '12:00')}`, `DTSTART:${utc(g.date, g.start || '10:00')}`, `DTEND:${utc(g.date, end)}`,
      `SUMMARY:${icsEsc(`${gameTitle(g, t)}`)}`, `LOCATION:${icsEsc(g.home ? club : (g.venue || g.opponent))}`, `DESCRIPTION:${icsEsc([g.league, meet, g.note].filter(Boolean).join(' · '))}`,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }
  ctx.public.get('/ics/:id', (req, res) => {
    const id = int(req.params.id), k = String(req.query.k || '');
    const ok = k.length === 32 && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(icsToken(id)));
    const g = ok ? game(id) : null;
    if (!g || g.status !== 'geplant') return res.status(404).type('text/plain; charset=utf-8').send('Diesen Spieltag gibt es nicht (mehr).');
    res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="spieltag-${g.date}.ics"`, 'Cache-Control': 'no-store' }).send(icsText(g));
  });
  function calendarFor(g) {
    const pub = ctx.getSetting('ext_tunnel', '0') === '1' ? String(ctx.getSetting('ext_tunnel_url', '') || '').replace(/\/+$/, '') : '';
    void pub;   // immer als Anhang: iOS Mail & Co. öffnen dann direkt „Zum Kalender hinzufügen“ (ein Link öffnete Safari)
    return { attachments: [{ filename: `spieltag-${g.date}.ics`, content: icsText(g), contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }] };
  }
  const gameRows = (g, t) => [['Mannschaft', t.name], ['Gegner', `${g.opponent} (${g.home ? 'Heimspiel' : 'Auswärtsspiel'})`], ['Wann', gameWhen(g)],
    ...(g.meet_time || g.meet_place ? [['Treffpunkt', [g.meet_time ? `${g.meet_time} Uhr` : '', g.meet_place || ''].filter(Boolean).join(', ')]] : []),
    ...(!g.home && g.venue ? [['Spielort', g.venue]] : [])];

  /* ---------- Push-Anlässe ---------- */
  ctx.hooks.pushEvents = () => [
    { id: 'aufgestellt', label: 'Spielbetrieb: Du bist aufgestellt', desc: 'Der Mannschaftsführer hat dich für einen Spieltag eingeplant (oder wieder herausgenommen).', default: true },
    { id: 'aufstellung', label: 'Spielbetrieb: Aufstellung verschickt', desc: 'Die fertige Aufstellung mit Treffpunkt kommt an alle Aufgestellten.', default: true },
    { id: 'absage', label: 'Spielbetrieb: Absage-Anfrage', desc: 'An den Mannschaftsführer: Ein aufgestellter Spieler möchte absagen.', default: true },
    { id: 'antwort', label: 'Spielbetrieb: Antwort auf Absage', desc: 'Der Mannschaftsführer hat deine Absage bestätigt oder abgelehnt.', default: true },
    { id: 'verlegt', label: 'Spielbetrieb: Spieltag verlegt/abgesagt', desc: 'Ein Spieltag deiner Mannschaft wurde verlegt oder abgesagt.', default: true },
    { id: 'erinnerung', label: 'Spielbetrieb: Bitte Verfügbarkeit melden', desc: 'Erinnerung vor dem Spieltag, wenn du noch nicht geantwortet hast (nur wenn Erinnerungen eingeschaltet sind).', default: true },
    { id: 'knapp', label: 'Spielbetrieb: Zu wenige Spieler', desc: 'An den Mannschaftsführer, wenn für einen nahen Spieltag zu wenige können.', default: true },
    { id: 'rahmen', label: 'Spielbetrieb: Vorläufige Termine', desc: 'Der Sportwart fragt die Termine aus dem Rahmenterminplan ab – oder deine Mannschaft hat an einem davon spielfrei.', default: true },
    { id: 'aufgabe', label: 'Spielbetrieb: Aufgabe übernommen/zugeteilt', desc: 'Eine Aufgabe für einen Spieltag (z. B. Fahrer) wurde dir zugeteilt.', default: true },
  ];
  /** Mitglieder-App: nur für Spieler und Mannschaftsführer */
  ctx.hooks.appVisible = memberId => Boolean(db.prepare(`SELECT 1 FROM sp_team t LEFT JOIN sp_player p ON p.team_id = t.id AND p.member_id = ?
    WHERE t.active = 1 AND (p.member_id IS NOT NULL OR t.captain_id = ? OR t.vice_id = ?) LIMIT 1`).get(memberId, memberId, memberId));

  /* ---------- Ansicht eines Spieltags (für Mannschaftsführer, Verwaltung und – je nach Einstellung – Spieler) ---------- */
  function gameView(g, { viewer = null, full = false } = {}) {
    const t = team(g.team_id); const ros = roster(g.team_id); const c = cfg();
    const av = new Map(db.prepare('SELECT * FROM sp_avail WHERE game_id = ?').all(g.id).map(a => [a.member_id, a]));
    const lu = new Map(db.prepare('SELECT * FROM sp_lineup WHERE game_id = ?').all(g.id).map(x => [x.member_id, x]));
    const st = stats(g, t, ros);
    const out = { id: g.id, team_id: g.team_id, team: t ? t.name : '', league: g.league, date: g.date, start: g.start, home: Boolean(g.home), opponent: g.opponent, venue: g.venue,
      status: g.status, kind: g.kind, za: Boolean(g.za), released: Boolean(g.released), meet_time: g.meet_time, meet_place: g.meet_place, note: g.note, result: g.result, past: g.date < today(), stats: st, sent: g.lineup_sent_at };
    const busy = playingElsewhere(g);
    const person = (id, name, inRoster) => {
      const a = av.get(id), l = lu.get(id);
      return { id, name, ln: lf(name), short: short(name), inRoster, state: a ? a.state : null, from: a ? a.from_t : null, until: a ? a.until_t : null, note: a ? a.note : null,
        role: l ? l.role : null, elsewhere: busy.get(id) || null, withdraw: l ? Boolean(l.withdraw) : false, withdraw_note: l ? l.withdraw_note : null, rank: (ros.find(r => r.member_id === id) || {}).rank };
    };
    const people = ros.map(r => person(r.member_id, r.name, true));
    // Aushilfen aus anderen Mannschaften, die aufgestellt sind
    for (const [id] of lu) if (!people.some(p => p.id === id)) people.push(person(id, memberName(id), false));
    const showAll = full || (viewer && t && leaders(t).includes(viewer));
    if (showAll) out.people = people;
    else {
      out.people = people.filter(p => (c.seeAvail && p.state === 'ja') || (c.seeLineup && p.role)).map(p => ({ id: p.id, short: p.short, ln: p.ln, state: c.seeAvail ? p.state : null, role: c.seeLineup ? p.role : null }));
      if (!c.seeAvail && !c.seeLineup) out.people = [];
    }
    if (viewer) {
      const me = people.find(p => p.id === viewer);
      out.me = me ? { state: me.state, from: me.from, until: me.until, note: me.note, role: me.role, withdraw: me.withdraw } : null;
    }
    if (c.tasks) out.tasks = db.prepare('SELECT * FROM sp_task WHERE game_id = ? ORDER BY id').all(g.id).map(x => ({ id: x.id, kind: x.kind, label: x.label, member_id: x.member_id, who: x.member_id ? short(memberName(x.member_id)) : null, note: x.note, mine: Boolean(viewer && x.member_id === viewer) }));
    out.captain = t && t.captain_id ? short(memberName(t.captain_id)) : null;
    return out;
  }

  /* ---------- Spieltage aus dem Spielplan übernehmen (eigener Import und Hook für das Buchungssystem) ---------- */
  const impKey = g => `imp:${IMP.norm(g.teamBase || g.team)}:${IMP.norm(g.home)}:${IMP.norm(g.guest)}`;
  /** bestehende Mannschaft zu einer Spielplan-Bezeichnung: Import-Schlüssel, Name, sonst eindeutige Altersklasse („H40“ ↔ „Herren 40“) */
  function findTeam(label, league) {
    const key = IMP.norm(label || '') || '_';
    let t = db.prepare('SELECT * FROM sp_team WHERE import_key = ?').get(key) || db.prepare('SELECT * FROM sp_team WHERE lower(name) = lower(?)').get(label || '');
    if (!t) {
      const ac = RTP.guessClass(label, league), no = IMP.teamNo(label);   // „H30 2“ → Herren 30 2 (Altersklasse + Mannschaftsnummer)
      const l = ac ? db.prepare('SELECT * FROM sp_team WHERE active = 1 AND age_class = ?').all(ac).filter(x => IMP.teamNo(x.name) === no) : [];
      if (l.length === 1 && (!l[0].import_key || l[0].import_key === IMP.norm(l[0].name))) t = l[0];   // noch an keine andere Spielplan-Bezeichnung gebunden
    }
    return t;
  }
  function teamFor(label, size, league, create, made) {
    const key = IMP.norm(label || '') || '_';
    let t = findTeam(label, league);
    if (!t) t = dupOf({ name: label || '', league });   // gleiche Altersklasse + Nummer schon vorhanden → keine zweite anlegen
    if (!t && create) {
      const id = Number(db.prepare('INSERT INTO sp_team(name, league, min_players, import_key, age_class) VALUES (?,?,?,?,?)').run(txt(label || 'Mannschaft', 60), txt(league, 80) || null, size || 4, key, RTP.guessClass(label, league)).lastInsertRowid);
      t = team(id); made.push(t.name);
    } else if (t && !t.import_key) db.prepare('UPDATE sp_team SET import_key = ? WHERE id = ?').run(key, t.id);
    return t;
  }
  /** games: [{ date, start, team, size, league, home, guest, venue }] – Heim/Gast entscheidet der Vereinsname */
  function upsertGames(games, club, by, { teamMap = {}, create = true } = {}) {
    const d0 = today(); const made = [], teamsMade = [], moved = [], same = [], skipped = [];
    const touched = new Set(), seen = {}; let converted = 0; const free = [];
    IMP.numberTeams(games, club);
    db.transaction(() => {
      for (const g0 of games) {
        const g = { date: String(g0.date || ''), start: isTime(g0.start) ? g0.start : null, team: txt(g0.team, 40), teamBase: g0.teamBase ? txt(g0.teamBase, 40) : null, size: int(g0.size) || null, league: txt(g0.league, 80), home: txt(g0.home, 80), guest: txt(g0.guest, 80), venue: txt(g0.venue, 160) };
        if (!isDate(g.date) || g.date < d0 || !g.home || !g.guest) { skipped.push(g); continue; }
        const isHome = IMP.isHomeGame({ home: g.home, guest: g.guest, venue: g.venue }, club);
        const isAway = club && IMP.norm(g.guest).includes(IMP.norm(IMP.clubName(club)));
        if (!isHome && !isAway && club) { skipped.push(g); continue; }   // Spiel ohne eigenen Verein (andere Begegnungen der Liga)
        const t = teamMap[g.team || '–'] ? team(teamMap[g.team || '–']) : teamFor(g.team, g.size, g.league, create, teamsMade);
        if (!t) { skipped.push(g); continue; }
        // Gegner = die Seite, die nicht unser Verein ist (auch wenn das Heimrecht getauscht wurde und bei uns gespielt wird)
        const ck = IMP.norm(IMP.clubName(club || ''));
        const opp = ck && IMP.norm(g.home).includes(ck) ? g.guest : ck && IMP.norm(g.guest).includes(ck) ? g.home : (isHome ? g.guest : g.home);
        const key = impKey(g);
        touched.add(t.id); (seen[t.id] = seen[t.id] || new Set()).add(g.date);
        const ex = db.prepare('SELECT * FROM sp_game WHERE ext_key = ? AND team_id = ?').get(key, t.id);
        const rt = !ex && db.prepare("SELECT * FROM sp_game WHERE team_id = ? AND date = ? AND kind = 'rahmen' ORDER BY za, id LIMIT 1").get(t.id, g.date);
        if (rt) {   // vorläufiger Termin wird zum echten Spieltag – Rückmeldungen bleiben
          db.prepare("UPDATE sp_game SET kind = 'spiel', za = 0, released = 1, start = ?, home = ?, opponent = ?, venue = ?, league = ?, ext_key = ?, status = 'geplant' WHERE id = ?")
            .run(g.start, isHome ? 1 : 0, opp, isHome ? null : (g.venue || null), g.league || null, key, rt.id);
          made.push(g); converted++;
        } else if (!ex) {
          db.prepare('INSERT INTO sp_game(team_id, date, start, home, opponent, venue, league, ext_key, created_by) VALUES (?,?,?,?,?,?,?,?,?)')
            .run(t.id, g.date, g.start, isHome ? 1 : 0, opp, isHome ? null : (g.venue || null), g.league || null, key, by);
          made.push(g);
        } else if (ex.date !== g.date || (g.start && ex.start !== g.start)) {
          db.prepare("UPDATE sp_game SET date = ?, start = ?, status = 'geplant', rem_players = 0, rem_captain = 0 WHERE id = ?").run(g.date, g.start || ex.start, ex.id);
          moved.push({ id: ex.id, was: `${deD(ex.date)}${ex.start ? ' ' + ex.start : ''}` });
        } else same.push(g);
      }
      // übrige vorläufige Termine der Mannschaften im Spielplan: spielfrei → entfernen
      for (const tid of touched) {
        for (const r of db.prepare("SELECT * FROM sp_game WHERE team_id = ? AND kind = 'rahmen' AND date >= ?").all(tid, d0)) {
          if (seen[tid].has(r.date)) continue;
          const yes = db.prepare("SELECT member_id FROM sp_avail WHERE game_id = ? AND state = 'ja'").all(r.id).map(x => x.member_id);
          free.push({ team_id: tid, date: r.date, released: r.released, yes });
          for (const x of ['sp_avail', 'sp_lineup', 'sp_task']) db.prepare(`DELETE FROM ${x} WHERE game_id = ?`).run(r.id);
          db.prepare('DELETE FROM sp_game WHERE id = ?').run(r.id);
        }
      }
    })();
    // spielfrei: eine Sammelnachricht je Spieler (nur an die, die „kann“ gemeldet hatten)
    const per = {};
    for (const f of free.filter(x => x.released)) for (const id of f.yes) (per[id] = per[id] || []).push(f);
    for (const [id, list] of Object.entries(per)) {
      const byTeam = {}; list.forEach(f => (byTeam[f.team_id] = byTeam[f.team_id] || []).push(f.date));
      const body = Object.entries(byTeam).map(([tid, ds]) => `${(team(tid) || {}).name}: ${ds.sort().map(d => `${wd(d)} ${deD(d).slice(0, 6)}`).join(', ')}`).join(' · ');
      tell([Number(id)], 'rahmen', { title: 'Spielplan da – an diesen Tagen spielfrei', body });
    }
    // verlegte Spieltage: Mannschaft informieren
    for (const m of moved) {
      const g = game(m.id), t = team(g.team_id);
      tell([...roster(t.id).map(r => r.member_id), ...leaders(t)], 'verlegt', { title: `Verlegt: ${gameTitle(g, t)}`, body: `Neu: ${gameWhen(g)} (vorher ${m.was})` });
    }
    if (club) SET('import_club', club);
    return { made: made.length, moved: moved.length, same: same.length, skipped: skipped.length, teamsMade: teamsMade.length, teams: teamsMade, converted, free: free.length };
  }
  ctx.hooks.spielplanGames = ({ games, club, user }) => {
    const r = upsertGames(Array.isArray(games) ? games : [], txt(club, 80) || cfg().club || ctx.getSetting('club_name', ''), user ? (user.name || user.username) : 'Import');
    ctx.audit(user || null, 'Spielbetrieb: Spielplan übernommen', `${r.made} neu, ${r.moved} verlegt, ${r.same} unverändert`);
    return r;
  };

  /* ---------- Aufstellung, Absagen (gemeinsam für App und Verwaltung) ---------- */
  function setLineup(g, memberId, role, by) {
    const t = team(g.team_id);
    const cur = db.prepare('SELECT * FROM sp_lineup WHERE game_id = ? AND member_id = ?').get(g.id, memberId);
    if (!role) {
      if (!cur) return;
      db.prepare('DELETE FROM sp_lineup WHERE game_id = ? AND member_id = ?').run(g.id, memberId);
      if (cur.role === 'spielt' && g.date >= today()) tell([memberId], 'aufgestellt', { title: `Nicht mehr aufgestellt: ${t.name}`, body: `${gameTitle(g, t)}, ${gameWhen(g)}` });
      return;
    }
    if (!['spielt', 'ersatz'].includes(role)) throw new Error('Unbekannte Rolle.');
    if (g.kind === 'rahmen') throw new Error('Vorläufiger Termin – aufstellen geht erst, wenn der Spielplan da ist.');
    if (!isMember(memberId)) throw new Error('Mitglied nicht gefunden.');
    const a = db.prepare('SELECT state FROM sp_avail WHERE game_id = ? AND member_id = ?').get(g.id, memberId);
    if (a && a.state === 'nein') throw new Error(`${short(memberName(memberId))} hat für diesen Spieltag abgesagt.`);
    const other = playingElsewhere(g).get(memberId);
    if (other) throw new Error(`${short(memberName(memberId))} spielt an diesem Tag schon in ${other} – je Tag geht nur ein Einsatz.`);
    // aufgestellt: eine Ersatz-Einplanung in einer anderen Mannschaft am selben Tag entfällt
    if (role === 'spielt') db.prepare(`DELETE FROM sp_lineup WHERE member_id = ? AND role = 'ersatz' AND game_id IN (SELECT id FROM sp_game WHERE date = ? AND id != ?)`).run(memberId, g.date, g.id);
    db.prepare(`INSERT INTO sp_lineup(game_id, member_id, role, by_user) VALUES (?,?,?,?)
      ON CONFLICT(game_id, member_id) DO UPDATE SET role = excluded.role, by_user = excluded.by_user, at = datetime('now','localtime')`).run(g.id, memberId, role, by);
    if (role === 'spielt' && (!cur || cur.role !== 'spielt') && g.date >= today()) tell([memberId], 'aufgestellt', { title: `Du spielst: ${t.name}`, body: `${gameTitle(g, t)}, ${gameWhen(g)}` });
  }
  function decideWithdraw(g, memberId, accept, by) {
    const t = team(g.team_id);
    const l = db.prepare('SELECT * FROM sp_lineup WHERE game_id = ? AND member_id = ? AND withdraw = 1').get(g.id, memberId);
    if (!l) throw new Error('Keine offene Absage-Anfrage.');
    if (accept) {
      db.transaction(() => {
        db.prepare('DELETE FROM sp_lineup WHERE game_id = ? AND member_id = ?').run(g.id, memberId);
        db.prepare(`INSERT INTO sp_avail(game_id, member_id, state, note) VALUES (?,?, 'nein', ?) ON CONFLICT(game_id, member_id) DO UPDATE SET state = 'nein', from_t = NULL, until_t = NULL, note = excluded.note, at = datetime('now','localtime')`).run(g.id, memberId, l.withdraw_note || null);
      })();
      tell([memberId], 'antwort', { title: `Absage bestätigt: ${t.name}`, body: `Du bist für ${gameWhen(g)} nicht mehr aufgestellt.` });
    } else {
      db.prepare('UPDATE sp_lineup SET withdraw = 0, withdraw_note = NULL, withdraw_at = NULL WHERE game_id = ? AND member_id = ?').run(g.id, memberId);
      tell([memberId], 'antwort', { title: `Absage nicht bestätigt: ${t.name}`, body: `Bitte melde dich beim Mannschaftsführer – du bist für ${gameWhen(g)} weiter aufgestellt.` });
    }
    ctx.audit(by, accept ? 'Spielbetrieb: Absage bestätigt' : 'Spielbetrieb: Absage abgelehnt', `${memberName(memberId)} · ${gameTitle(g, t)} ${deD(g.date)}`);
  }
  async function sendLineup(g, by) {
    const t = team(g.team_id); const lu = db.prepare(`SELECT l.*, m.name FROM sp_lineup l JOIN members m ON m.id = l.member_id WHERE l.game_id = ? ORDER BY l.role DESC, COALESCE(l.pos, 99), name_key(m.name, m.kind)`).all(g.id);
    if (g.kind === 'rahmen') throw new Error('Vorläufiger Termin – aufstellen geht erst, wenn der Spielplan da ist.');
    if (!lu.length) throw new Error('Noch niemand aufgestellt.');
    const spielt = lu.filter(x => x.role === 'spielt').map(x => short(x.name)), ersatz = lu.filter(x => x.role === 'ersatz').map(x => short(x.name));
    const rows = [...gameRows(g, t), ['Es spielen', spielt.join(', ') || '–'], ...(ersatz.length ? [['Ersatz', ersatz.join(', ')]] : [])];
    await tell(lu.map(x => x.member_id), 'aufstellung', { title: `Aufstellung: ${gameTitle(g, t)}`, body: `${gameWhen(g)} · ${spielt.join(', ')}`,
      mail: { heading: 'Die Aufstellung steht', intro: `Hier die Aufstellung für ${gameTitle(g, t)}:`, cardTitle: `${gameTitle(g, t)} · ${gameWhen(g)}`, rows, outro: g.note || 'Falls du doch nicht kannst: bitte in der Mitglieder-App unter „Spieltage“ absagen.', lines: rows.map(([k, v]) => `${k}: ${v}`), ...calendarFor(g) } });
    db.prepare("UPDATE sp_game SET lineup_sent_at = datetime('now','localtime') WHERE id = ?").run(g.id);
    ctx.audit(by, 'Spielbetrieb: Aufstellung verschickt', `${gameTitle(g, t)} ${deD(g.date)}`);
  }

  /* ================================================================= Mitglieder-App (/api/m/spielbetrieb/…) */
  const futureGames = teamIds => (teamIds.length ? db.prepare(`SELECT * FROM sp_game WHERE team_id IN (${teamIds.map(() => '?').join(',')}) AND date >= ? AND released = 1 ORDER BY date, start`).all(...teamIds, addDays(today(), -1)) : []);
  /** Ansprechpartner einer Mannschaft für die App: Mannschaftsführer (sonst Stellvertretung) mit Handynummer aus der Mitgliederverwaltung */
  async function contactOf(t, viewer) {
    const id = t.captain_id || t.vice_id; if (!id) return null;
    const a = await mvHook('memberAddress', id).catch(() => null);
    return { name: memberName(id), role: t.captain_id ? 'Mannschaftsführer' : 'Stellvertretung', phone: (a && (a.mobile || a.phone)) || null, self: id === viewer };
  }
  M.get('/me', ar(async (req, res) => {
    const me = req.member.id, c = cfg();
    const teams = myTeams(me);
    const cap = captainOf(me);
    const playIn = new Set(db.prepare('SELECT team_id FROM sp_player WHERE member_id = ?').all(me).map(r => r.team_id));
    // eigene Einsätze je Tag: an einem Tag, an dem ich schon in einer Mannschaft spiele, steht bei den anderen „spielt in …“
    const plays = db.prepare(`SELECT g.id, g.date, t.name FROM sp_lineup l JOIN sp_game g ON g.id = l.game_id JOIN sp_team t ON t.id = g.team_id WHERE l.member_id = ? AND l.role = 'spielt' AND g.date >= ? AND g.status = 'geplant'`).all(me, addDays(today(), -1));
    const games = futureGames(teams.map(t => t.id)).map(g => gameView(g, { viewer: me })).map(v => { const o = plays.find(x => x.date === v.date && x.id !== v.id);
      return { ...v, mine: playIn.has(v.team_id), lead: cap.includes(v.team_id), elsewhere: o ? o.name : null }; });
    const past = db.prepare(`SELECT g.*, l.role FROM sp_lineup l JOIN sp_game g ON g.id = l.game_id WHERE l.member_id = ? AND l.role = 'spielt' AND g.date < ? AND g.date >= ? ORDER BY g.date DESC`).all(me, today(), `${today().slice(0, 4)}-01-01`);
    const contacts = c.capInfo ? await Promise.all(teams.map(t => contactOf(t, me))) : teams.map(() => null);
    res.json({ today: today(), teams: teams.map((t, i) => ({ id: t.id, name: t.name, league: t.league, min: t.min_players, lead: cap.includes(t.id), player: playIn.has(t.id), captain: t.captain_id ? short(memberName(t.captain_id)) : null, contact: contacts[i] })),
      games, played: past.length, settings: { times: c.times, tasks: c.tasks, seeAvail: c.seeAvail, seeLineup: c.seeLineup } });
  }));
  const myGame = (req, res) => {
    const g = game((req.body || {}).game_id || req.params.id);
    if (!g || !g.released) { bad(res, 'Spieltag nicht gefunden.', 404); return null; }
    const me = req.member.id;
    const ok = isCaptain(me, g.team_id) || db.prepare('SELECT 1 FROM sp_player WHERE team_id = ? AND member_id = ?').get(g.team_id, me) || db.prepare('SELECT 1 FROM sp_lineup WHERE game_id = ? AND member_id = ?').get(g.id, me);
    if (!ok) { bad(res, 'Dieser Spieltag gehört nicht zu deinen Mannschaften.', 403); return null; }
    return g;
  };
  const leadGame = (req, res) => {
    const g = game((req.body || {}).game_id || req.params.id);
    if (!g || !g.released) { bad(res, 'Spieltag nicht gefunden.', 404); return null; }
    if (!isCaptain(req.member.id, g.team_id)) { bad(res, 'Das darf nur der Mannschaftsführer.', 403); return null; }
    return g;
  };
  /** Verfügbarkeit melden: state ja | nein | null (zurücknehmen), optional ab/bis Uhrzeit und Notiz */
  M.post('/avail', rateLimit('spav', 120, 60000), (req, res) => {
    const g = myGame(req, res); if (!g) return;
    const b = req.body || {}, me = req.member.id;
    if (g.date < today()) return bad(res, 'Dieser Spieltag ist vorbei.');
    if (g.status !== 'geplant') return bad(res, 'Dieser Spieltag ist abgesagt.');
    const l = db.prepare('SELECT * FROM sp_lineup WHERE game_id = ? AND member_id = ?').get(g.id, me);
    if (l && l.role === 'spielt' && b.state !== 'ja') return bad(res, 'Du bist schon aufgestellt – bitte „Absage anfragen“, damit der Mannschaftsführer Ersatz einplanen kann.', 409);
    if (b.state == null || b.state === '') {
      db.prepare('DELETE FROM sp_avail WHERE game_id = ? AND member_id = ?').run(g.id, me);
      if (l && l.role === 'ersatz') db.prepare('DELETE FROM sp_lineup WHERE game_id = ? AND member_id = ?').run(g.id, me);
      return res.json({ ok: true });
    }
    if (!['ja', 'nein'].includes(b.state)) return bad(res, 'Bitte „kann“ oder „kann nicht“ wählen.');
    const c = cfg();
    const from = c.times && b.state === 'ja' && isTime(b.from) ? b.from : null, until = c.times && b.state === 'ja' && isTime(b.until) ? b.until : null;
    if (from && until && from >= until) return bad(res, '„ab“ muss vor „bis“ liegen.');
    db.prepare(`INSERT INTO sp_avail(game_id, member_id, state, from_t, until_t, note) VALUES (?,?,?,?,?,?)
      ON CONFLICT(game_id, member_id) DO UPDATE SET state = excluded.state, from_t = excluded.from_t, until_t = excluded.until_t, note = excluded.note, at = datetime('now','localtime')`)
      .run(g.id, me, b.state, from, until, txt(b.note, 140) || null);
    // Ersatzspieler sagt ab: aus der Aufstellung nehmen, Mannschaftsführer kurz informieren
    if (b.state === 'nein' && l && l.role === 'ersatz') {
      const t = team(g.team_id);
      db.prepare('DELETE FROM sp_lineup WHERE game_id = ? AND member_id = ?').run(g.id, me);
      tell(leaders(t), 'absage', { title: `Ersatz sagt ab: ${short(req.member.name)}`, body: `${gameTitle(g, t)}, ${gameWhen(g)}` });
    }
    res.json({ ok: true });
  });
  /** Saisonstart: alle offenen Spieltage einer Mannschaft auf einmal beantworten */
  M.post('/avail/all', rateLimit('spav', 120, 60000), (req, res) => {
    const b = req.body || {}, me = req.member.id;
    if (!['ja', 'nein'].includes(b.state)) return bad(res, 'Bitte „kann“ oder „kann nicht“ wählen.');
    const tid = int(b.team_id);
    if (!db.prepare('SELECT 1 FROM sp_player WHERE team_id = ? AND member_id = ?').get(tid, me)) return bad(res, 'Du spielst nicht in dieser Mannschaft.', 403);
    const open = db.prepare(`SELECT g.id FROM sp_game g WHERE g.team_id = ? AND g.date >= ? AND g.status = 'geplant' AND g.released = 1 AND NOT EXISTS (SELECT 1 FROM sp_avail a WHERE a.game_id = g.id AND a.member_id = ?)`).all(tid, today(), me);
    const ins = db.prepare('INSERT INTO sp_avail(game_id, member_id, state) VALUES (?,?,?)');
    db.transaction(() => open.forEach(g => ins.run(g.id, me, b.state)))();
    res.json({ ok: true, n: open.length });
  });
  /** Aufgestellt und doch nicht können: Anfrage an den Mannschaftsführer */
  M.post('/withdraw', rateLimit('spwd', 20, 3600000), ar(async (req, res) => {
    const g = myGame(req, res); if (!g) return;
    const me = req.member.id, b = req.body || {};
    const l = db.prepare('SELECT * FROM sp_lineup WHERE game_id = ? AND member_id = ?').get(g.id, me);
    if (!l) return bad(res, 'Du bist für diesen Spieltag nicht aufgestellt.');
    const t = team(g.team_id);
    if (b.cancel) { db.prepare('UPDATE sp_lineup SET withdraw = 0, withdraw_note = NULL, withdraw_at = NULL WHERE game_id = ? AND member_id = ?').run(g.id, me); return res.json({ ok: true }); }
    if (l.role === 'ersatz') {   // Ersatz: ohne Bestätigung
      db.prepare('DELETE FROM sp_lineup WHERE game_id = ? AND member_id = ?').run(g.id, me);
      db.prepare(`INSERT INTO sp_avail(game_id, member_id, state, note) VALUES (?,?, 'nein', ?) ON CONFLICT(game_id, member_id) DO UPDATE SET state = 'nein', note = excluded.note, at = datetime('now','localtime')`).run(g.id, me, txt(b.note, 140) || null);
      tell(leaders(t), 'absage', { title: `Ersatz sagt ab: ${short(req.member.name)}`, body: `${gameTitle(g, t)}, ${gameWhen(g)}` });
      return res.json({ ok: true, direct: true });
    }
    db.prepare("UPDATE sp_lineup SET withdraw = 1, withdraw_note = ?, withdraw_at = datetime('now','localtime') WHERE game_id = ? AND member_id = ?").run(txt(b.note, 200) || null, g.id, me);
    const st = stats(g, t);
    await tell(leaders(t), 'absage', { title: `Absage-Anfrage: ${short(req.member.name)}`, body: `${gameTitle(g, t)}, ${gameWhen(g)} – bitte bestätigen und Ersatz einplanen.`,
      mail: { heading: 'Ein Spieler möchte absagen', intro: `${req.member.name} ist aufgestellt und möchte absagen:`, cardTitle: `${gameTitle(g, t)} · ${gameWhen(g)}`,
        rows: [['Spieler', req.member.name], ['Grund', txt(b.note, 200) || '–'], ['Noch verfügbar', `${Math.max(0, st.yes - st.playing)} weitere Spieler`]], outro: 'Bitte in der Mitglieder-App unter „Spieltage“ bestätigen und Ersatz einplanen. Bis dahin bleibt der Spieler aufgestellt.',
        lines: [`${req.member.name} möchte für ${gameTitle(g, t)} am ${gameWhen(g)} absagen.`, `Grund: ${txt(b.note, 200) || '–'}`, '', 'Bitte in der Mitglieder-App unter „Spieltage“ bestätigen und Ersatz einplanen.'] } });
    res.json({ ok: true });
  }));
  /* Aufgaben: selbst übernehmen / abgeben */
  M.post('/task', (req, res) => {
    if (!cfg().tasks) return bad(res, 'Aufgaben sind ausgeschaltet.');
    const b = req.body || {}, me = req.member.id;
    const x = db.prepare('SELECT * FROM sp_task WHERE id = ?').get(int(b.task_id)); if (!x) return bad(res, 'Aufgabe nicht gefunden.', 404);
    req.body.game_id = x.game_id; const g = myGame(req, res); if (!g) return;
    if (b.take) { if (x.member_id && x.member_id !== me) return bad(res, 'Diese Aufgabe hat schon jemand übernommen.'); db.prepare('UPDATE sp_task SET member_id = ? WHERE id = ?').run(me, x.id); }
    else { if (x.member_id !== me) return bad(res, 'Das ist nicht deine Aufgabe.'); db.prepare('UPDATE sp_task SET member_id = NULL WHERE id = ?').run(x.id); }
    res.json({ ok: true });
  });

  /* ----- Mannschaftsführer ----- */
  M.get('/lead/:id', (req, res) => { const g = leadGame(req, res); if (!g) return; res.json(leadView(g)); });
  function leadView(g) {
    const v = gameView(g, { full: true });
    const t = team(g.team_id);
    // Aushilfen: Spieler anderer Mannschaften (für Ersatz aus unteren Mannschaften)
    const inRoster = new Set(v.people.map(p => p.id));
    v.helpers = db.prepare(`SELECT DISTINCT m.id, m.name, t.name AS team FROM sp_player p JOIN members m ON m.id = p.member_id JOIN sp_team t ON t.id = p.team_id
      WHERE t.active = 1 AND p.team_id != ? AND m.deleted = 0 AND m.active = 1 ORDER BY name_key(m.name, m.kind)`).all(g.team_id).filter(m => !inRoster.has(m.id)).map(m => ({ id: m.id, ln: lf(m.name), team: m.team }));
    v.taskKinds = cfg().taskKinds.filter(k => k.when === 'immer' || (k.when === 'heim') === Boolean(g.home));
    v.min = t.min_players;
    return v;
  }
  M.post('/lead/lineup', (req, res) => {
    const g = leadGame(req, res); if (!g) return;
    const b = req.body || {};
    try { setLineup(g, int(b.member_id), b.role || null, req.member.name); } catch (e) { return bad(res, e.message); }
    res.json(leadView(game(g.id)));
  });
  M.post('/lead/withdraw', (req, res) => {
    const g = leadGame(req, res); if (!g) return;
    try { decideWithdraw(g, int((req.body || {}).member_id), Boolean((req.body || {}).accept), req.member.name); } catch (e) { return bad(res, e.message); }
    res.json(leadView(game(g.id)));
  });
  M.post('/lead/send', ar(async (req, res) => {
    const g = leadGame(req, res); if (!g) return;
    try { await sendLineup(g, req.member.name); } catch (e) { return bad(res, e.message); }
    res.json(leadView(game(g.id)));
  }));
  M.post('/lead/remind', rateLimit('sprem', 10, 3600000), (req, res) => {
    const g = leadGame(req, res); if (!g) return;
    const n = remindOpen(g); res.json({ ok: true, n });
  });
  M.post('/lead/info', (req, res) => {
    const g = leadGame(req, res); if (!g) return;
    const b = req.body || {};
    db.prepare('UPDATE sp_game SET meet_time = ?, meet_place = ?, note = ?, result = ? WHERE id = ?').run(isTime(b.meet_time) ? b.meet_time : null, txt(b.meet_place, 120) || null, txt(b.note, 300) || null, txt(b.result, 20) || g.result || null, g.id);
    res.json(leadView(game(g.id)));
  });
  M.post('/lead/task', (req, res) => {
    const g = leadGame(req, res); if (!g) return;
    if (!cfg().tasks) return bad(res, 'Aufgaben sind ausgeschaltet.');
    const b = req.body || {};
    try { taskEdit(g, b, req.member.name); } catch (e) { return bad(res, e.message); }
    res.json(leadView(game(g.id)));
  });
  function taskEdit(g, b, by) {
    const t = team(g.team_id);
    if (b.remove) { db.prepare('DELETE FROM sp_task WHERE id = ? AND game_id = ?').run(int(b.task_id), g.id); return; }
    if (b.task_id) {
      const x = db.prepare('SELECT * FROM sp_task WHERE id = ? AND game_id = ?').get(int(b.task_id), g.id); if (!x) throw new Error('Aufgabe nicht gefunden.');
      const mid = b.member_id ? int(b.member_id) : null; if (mid && !isMember(mid)) throw new Error('Mitglied nicht gefunden.');
      db.prepare('UPDATE sp_task SET member_id = ? WHERE id = ?').run(mid, x.id);
      if (mid && mid !== x.member_id) tell([mid], 'aufgabe', { title: `Aufgabe: ${x.label}`, body: `${gameTitle(g, t)}, ${gameWhen(g)}` });
      return;
    }
    if (g.kind === 'rahmen') throw new Error('Vorläufiger Termin – Aufgaben gibt es erst mit dem Spielplan.');
    const kinds = cfg().taskKinds; const k = kinds.find(x => x.k === b.kind);
    const label = txt(b.label, 60) || (k ? k.l : ''); if (!label) throw new Error('Bitte die Aufgabe benennen.');
    db.prepare('INSERT INTO sp_task(game_id, kind, label, member_id) VALUES (?,?,?,?)').run(g.id, k ? k.k : 'eigene', label, b.member_id ? int(b.member_id) : null);
    void by;
  }
  function remindOpen(g) {
    const t = team(g.team_id);
    const ids = roster(t.id).map(r => r.member_id).filter(id => !db.prepare('SELECT 1 FROM sp_avail WHERE game_id = ? AND member_id = ?').get(g.id, id));
    tell(ids, 'erinnerung', { title: `Kannst du am ${wd(g.date)} ${deD(g.date)}?`, body: `${gameTitle(g, t)} – bitte in der App „kann“ oder „kann nicht“ melden.` });
    return ids.length;
  }

  /* ================================================================= Verwaltung (/api/admin/x/spielbetrieb/…) */
  const membersList = () => db.prepare("SELECT id, name FROM members WHERE kind = 'mitglied' AND deleted = 0 AND active = 1 AND pending = 0 ORDER BY name_key(name, kind)").all().map(m => ({ id: m.id, ln: lf(m.name) }));
  const teamRow = t => ({ ...t, captain: t.captain_id ? lf(memberName(t.captain_id)) : null, vice: t.vice_id ? lf(memberName(t.vice_id)) : null,
    players: roster(t.id).map(r => ({ id: r.member_id, ln: lf(r.name), rank: r.rank })) });
  /* ---------- Sportwart-Übersicht: Rückmeldungen aller Mannschaften auf einen Blick ---------- */
  admin.get('/dashboard', P, (req, res) => {
    const d0 = today(), soon = addDays(d0, 14), c = cfg();
    const alerts = []; let ans = 0, tot = 0, crit = 0, next14 = 0, wds = 0;
    const teams = db.prepare('SELECT * FROM sp_team WHERE active = 1 ORDER BY sort, name').all().map(t => {
      const ros = roster(t.id);
      const gs = db.prepare("SELECT * FROM sp_game WHERE team_id = ? AND date >= ? AND released = 1 AND status = 'geplant' ORDER BY date, start LIMIT 10").all(t.id, d0);
      const ids = gs.map(g => g.id), qs = ids.map(() => '?').join(',');
      const av = ids.length ? db.prepare(`SELECT game_id, member_id, state FROM sp_avail WHERE game_id IN (${qs})`).all(...ids) : [];
      const lu = ids.length ? db.prepare(`SELECT game_id, member_id, role, withdraw FROM sp_lineup WHERE game_id IN (${qs})`).all(...ids) : [];
      const key = (g, m) => g + ':' + m, A = new Map(av.map(a => [key(a.game_id, a.member_id), a.state])), L = new Map(lu.map(l => [key(l.game_id, l.member_id), l]));
      const games = gs.map(g => {
        const s = stats(g, t, ros), near = g.date <= soon, due = g.kind !== 'rahmen' && g.date <= addDays(d0, c.captainDays) && !g.lineup_sent_at;
        if (near) next14++;
        if (near && !s.ok) { crit++; alerts.push({ level: 'r', team: t.name, team_id: t.id, game_id: g.id, date: g.date, text: `erst ${s.yes} von ${s.min} können${s.open ? ` · ${s.open} offen` : ''}` }); }
        if (due && s.ok) alerts.push({ level: 'a', team: t.name, team_id: t.id, game_id: g.id, date: g.date, text: 'Aufstellung noch nicht verschickt' });
        if (s.withdraws) { wds += s.withdraws; alerts.push({ level: 'a', team: t.name, team_id: t.id, game_id: g.id, date: g.date, text: `${s.withdraws} Absage-Anfrage${s.withdraws > 1 ? 'n' : ''} offen` }); }
        return { id: g.id, date: g.date, start: g.start, kind: g.kind, za: Boolean(g.za), home: Boolean(g.home), opponent: g.opponent, sent: Boolean(g.lineup_sent_at), near, ...s };
      });
      let tA = 0;
      const matrix = ros.map(r => { const cells = gs.map(g => { const st0 = A.get(key(g.id, r.member_id)) || null, l = L.get(key(g.id, r.member_id)); if (st0) tA++; return { s: st0, r: l ? l.role : null, w: Boolean(l && l.withdraw) }; });
        return { id: r.member_id, ln: lf(r.name), rank: r.rank, cells, open: cells.filter(x => !x.s).length }; });
      ans += tA; tot += ros.length * gs.length;
      return { id: t.id, name: t.name, league: t.league, min: t.min_players, captain: t.captain_id ? lf(memberName(t.captain_id)) : null, vice: t.vice_id ? lf(memberName(t.vice_id)) : null,
        roster: ros.length, games, matrix, rate: ros.length * gs.length ? Math.round(tA / (ros.length * gs.length) * 100) : null,
        pending: db.prepare("SELECT COUNT(*) n FROM sp_game WHERE team_id = ? AND kind = 'rahmen' AND released = 0 AND date >= ?").get(t.id, d0).n };
    });
    alerts.sort((a, b) => a.date.localeCompare(b.date) || (a.level === 'r' ? -1 : 1));
    res.json({ today: d0, kpi: { rate: tot ? Math.round(ans / tot * 100) : null, next14, crit, withdraws: wds, teams: teams.length }, alerts: alerts.slice(0, 30), teams });
  });
  /** alle Spieler einer Mannschaft mit offenen Rückmeldungen erinnern (eine Nachricht je Person) */
  admin.post('/teams/:id/remind', P, (req, res) => {
    const t = team(req.params.id); if (!t) return bad(res, 'Mannschaft nicht gefunden.', 404);
    const gs = db.prepare("SELECT id FROM sp_game WHERE team_id = ? AND date >= ? AND released = 1 AND status = 'geplant'").all(t.id, today()).map(g => g.id);
    const ids = [];
    for (const r of roster(t.id)) {
      const n = gs.filter(g => !db.prepare('SELECT 1 FROM sp_avail WHERE game_id = ? AND member_id = ?').get(g, r.member_id)).length;
      if (!n) continue; ids.push(r.member_id);
      tell([r.member_id], 'erinnerung', { title: `${t.name}: bitte Spieltage beantworten`, body: `${n} ${n === 1 ? 'Termin ist' : 'Termine sind'} noch offen – bitte in der App „kann“ oder „kann nicht“ melden.` });
    }
    ctx.audit(req.user, 'Spielbetrieb: Mannschaft erinnert', `${t.name}: ${ids.length} Spieler/innen`);
    res.json({ ok: true, n: ids.length });
  });
  admin.get('/meta', P, (req, res) => {
    const c = cfg();
    res.json({ today: today(), teams: db.prepare('SELECT * FROM sp_team ORDER BY active DESC, sort, name').all().map(teamRow), members: membersList(), settings: c,
      buchung: ctx.isModuleActive('buchung'), mitglieder: ctx.isModuleActive('mitglieder'), club: c.club || ctx.getSetting('club_name', ''),
      rahmenPending: db.prepare("SELECT COUNT(*) n FROM sp_game WHERE kind = 'rahmen' AND released = 0 AND date >= ?").get(today()).n });
  });
  const teamInput = (b, cur = {}) => {
    const name = txt(b.name !== undefined ? b.name : cur.name, 60); if (name.length < 2) throw new Error('Bitte die Mannschaft benennen (z. B. „Herren 40 I“).');
    const min = int(b.min_players !== undefined ? b.min_players : cur.min_players); if (!(min >= 1 && min <= 20)) throw new Error('Mindestanzahl Spieler: 1 bis 20.');
    const cap = b.captain_id !== undefined ? (int(b.captain_id) || null) : cur.captain_id, vice = b.vice_id !== undefined ? (int(b.vice_id) || null) : cur.vice_id;
    if (cap && !isMember(cap)) throw new Error('Mannschaftsführer nicht gefunden.'); if (vice && !isMember(vice)) throw new Error('Stellvertreter nicht gefunden.');
    if (cap && vice && cap === vice) throw new Error('Mannschaftsführer und Stellvertreter sind dieselbe Person.');
    const ac = txt(b.age_class !== undefined ? b.age_class : cur.age_class, 30) || null;
    return { age_class: ac, name, league: txt(b.league !== undefined ? b.league : cur.league, 80) || null, season: txt(b.season !== undefined ? b.season : cur.season, 30) || null, min_players: min, captain_id: cap || null, vice_id: vice || null,
      active: b.active !== undefined ? (b.active ? 1 : 0) : (cur.active ?? 1), note: txt(b.note !== undefined ? b.note : cur.note, 300) || null };
  };
  admin.post('/teams', P, (req, res) => {
    let v; try { v = teamInput(req.body || {}); } catch (e) { return bad(res, e.message); }
    { const d = dupOf(v); if (d) return bad(res, `Die Mannschaft „${d.name}“ gibt es schon${classOf(d) ? ` (Altersklasse ${classOf(d)})` : ''}. Für die zweite Mannschaft bitte „${nextName(v)}“ eintragen.`, 409); }
    const id = Number(db.prepare('INSERT INTO sp_team(name, league, season, min_players, captain_id, vice_id, active, note, import_key, age_class) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(v.name, v.league, v.season, v.min_players, v.captain_id, v.vice_id, v.active, v.note, IMP.norm(v.name), v.age_class || RTP.guessClass(v.name, v.league)).lastInsertRowid);
    ctx.audit(req.user, 'Spielbetrieb: Mannschaft angelegt', v.name);
    res.json({ id });
  });
  admin.put('/teams/:id', P, (req, res) => {
    const t = team(req.params.id); if (!t) return bad(res, 'Mannschaft nicht gefunden.', 404);
    let v; try { v = teamInput(req.body || {}, t); } catch (e) { return bad(res, e.message); }
    { const d = dupOf(v, t.id); if (d) return bad(res, `Die Mannschaft „${d.name}“ gibt es schon${classOf(d) ? ` (Altersklasse ${classOf(d)})` : ''}. Bitte eine andere Nummer wählen, z. B. „${nextName(v)}“.`, 409); }
    db.prepare('UPDATE sp_team SET name = ?, league = ?, season = ?, min_players = ?, captain_id = ?, vice_id = ?, active = ?, note = ?, age_class = ? WHERE id = ?').run(v.name, v.league, v.season, v.min_players, v.captain_id, v.vice_id, v.active, v.note, v.age_class, t.id);
    ctx.audit(req.user, 'Spielbetrieb: Mannschaft geändert', v.name);
    res.json({ ok: true });
  });
  admin.delete('/teams/:id', P, (req, res) => {
    const t = team(req.params.id); if (!t) return bad(res, 'Mannschaft nicht gefunden.', 404);
    const n = db.prepare('SELECT COUNT(*) n FROM sp_game WHERE team_id = ?').get(t.id).n;
    if (n && !(req.body || {}).force && req.query.force !== '1') return bad(res, `Die Mannschaft hat ${n} Spieltage – zum Löschen bitte bestätigen (oder auf „nicht aktiv“ stellen).`, 409);
    db.transaction(() => {
      for (const g of db.prepare('SELECT id FROM sp_game WHERE team_id = ?').all(t.id)) for (const x of ['sp_avail', 'sp_lineup', 'sp_task']) db.prepare(`DELETE FROM ${x} WHERE game_id = ?`).run(g.id);
      db.prepare('DELETE FROM sp_game WHERE team_id = ?').run(t.id); db.prepare('DELETE FROM sp_player WHERE team_id = ?').run(t.id); db.prepare('DELETE FROM sp_team WHERE id = ?').run(t.id);
    })();
    ctx.audit(req.user, 'Spielbetrieb: Mannschaft gelöscht', t.name);
    res.json({ ok: true });
  });
  /** Spielerliste (Meldeliste) einer Mannschaft: [{ id, rank }] – Reihenfolge = Meldeliste */
  admin.put('/teams/:id/players', P, (req, res) => {
    const t = team(req.params.id); if (!t) return bad(res, 'Mannschaft nicht gefunden.', 404);
    const list = (Array.isArray((req.body || {}).players) ? req.body.players : []).slice(0, 60).map((p, i) => ({ id: int(p.id || p), rank: int(p.rank) || i + 1 })).filter(p => isMember(p.id));
    db.transaction(() => {
      const keep = new Set(list.map(p => p.id));
      for (const r of db.prepare('SELECT member_id FROM sp_player WHERE team_id = ?').all(t.id)) if (!keep.has(r.member_id)) db.prepare('DELETE FROM sp_player WHERE team_id = ? AND member_id = ?').run(t.id, r.member_id);
      const up = db.prepare('INSERT INTO sp_player(team_id, member_id, rank) VALUES (?,?,?) ON CONFLICT(team_id, member_id) DO UPDATE SET rank = excluded.rank');
      list.forEach(p => up.run(t.id, p.id, p.rank));
    })();
    ctx.audit(req.user, 'Spielbetrieb: Spieler zugeordnet', `${t.name}: ${list.length} Spieler`);
    res.json({ ok: true, players: teamRow(team(t.id)).players });
  });
  /** Spieltage (Übersicht mit Ampel) */
  admin.get('/games', P, (req, res) => {
    const past = req.query.past === '1', tid = int(req.query.team);
    const rows = db.prepare(`SELECT * FROM sp_game WHERE ${past ? 'date < ?' : 'date >= ?'} ${tid ? 'AND team_id = ?' : ''} ORDER BY date ${past ? 'DESC' : 'ASC'}, start LIMIT 400`).all(...(tid ? [today(), tid] : [today()]));
    res.json(rows.map(g => { const v = gameView(g, { full: true }); delete v.people; return v; }));
  });
  /** Kalender (wie der Rahmenterminplan): alle Spieltage eines Jahres, kompakt */
  admin.get('/calendar', P, (req, res) => {
    const years = db.prepare("SELECT DISTINCT substr(date, 1, 4) y FROM sp_game ORDER BY y").all().map(r => +r.y).filter(Boolean);
    const cur = +today().slice(0, 4), next = db.prepare('SELECT date FROM sp_game WHERE date >= ? ORDER BY date LIMIT 1').get(today());
    const year = int(req.query.year) || (next ? +next.date.slice(0, 4) : years.includes(cur) ? cur : years[years.length - 1] || cur);
    const tid = int(req.query.team);
    const rows = db.prepare(`SELECT * FROM sp_game WHERE date >= ? AND date <= ? ${tid ? 'AND team_id = ?' : ''} ORDER BY date, start`).all(`${year}-01-01`, `${year}-12-31`, ...(tid ? [tid] : []));
    const d0 = today();
    res.json({ year, years: [...new Set([...years, year])].sort(), today: d0, games: rows.map(g => { const t = team(g.team_id) || {}; const x = stats(g);
      return { id: g.id, date: g.date, start: g.start, team: t.name || '', home: Boolean(g.home), opponent: g.opponent, kind: g.kind, za: Boolean(g.za), released: Boolean(g.released), status: g.status, past: g.date < d0, ok: x.ok, yes: x.yes, min: x.min }; }) });
  });
  admin.get('/games/:id', P, (req, res) => { const g = game(req.params.id); if (!g) return bad(res, 'Spieltag nicht gefunden.', 404); res.json(leadView(g)); });
  const gameInput = (b, cur = {}) => {
    const tid = int(b.team_id !== undefined ? b.team_id : cur.team_id); if (!team(tid)) throw new Error('Bitte eine Mannschaft wählen.');
    const date = b.date !== undefined ? String(b.date) : cur.date; if (!isDate(date)) throw new Error('Bitte das Datum prüfen.');
    const start = b.start !== undefined ? (isTime(b.start) ? b.start : null) : cur.start;
    const opponent = txt(b.opponent !== undefined ? b.opponent : cur.opponent, 80); if (opponent.length < 2 && cur.kind !== 'rahmen') throw new Error('Bitte den Gegner eintragen.');
    return { team_id: tid, date, start, home: (b.home !== undefined ? b.home : cur.home ?? 1) ? 1 : 0, opponent, venue: txt(b.venue !== undefined ? b.venue : cur.venue, 160) || null,
      status: ['geplant', 'abgesagt'].includes(b.status) ? b.status : (cur.status || 'geplant'), meet_time: isTime(b.meet_time) ? b.meet_time : (b.meet_time === '' ? null : cur.meet_time || null),
      meet_place: b.meet_place !== undefined ? (txt(b.meet_place, 120) || null) : cur.meet_place || null, note: b.note !== undefined ? (txt(b.note, 300) || null) : cur.note || null, result: b.result !== undefined ? (txt(b.result, 20) || null) : cur.result || null };
  };
  admin.post('/games', P, (req, res) => {
    let v; try { v = gameInput(req.body || {}); } catch (e) { return bad(res, e.message); }
    const rt = db.prepare("SELECT id FROM sp_game WHERE team_id = ? AND date = ? AND kind = 'rahmen' ORDER BY za, id LIMIT 1").get(v.team_id, v.date);
    if (rt) {   // von Hand eingetragener Spieltag ersetzt den vorläufigen Termin – Rückmeldungen bleiben
      db.prepare("UPDATE sp_game SET kind = 'spiel', za = 0, released = 1, start = ?, home = ?, opponent = ?, venue = ?, status = ?, meet_time = ?, meet_place = ?, note = ?, result = ? WHERE id = ?")
        .run(v.start, v.home, v.opponent, v.venue, v.status, v.meet_time, v.meet_place, v.note, v.result, rt.id);
      ctx.audit(req.user, 'Spielbetrieb: Spieltag angelegt', `${team(v.team_id).name} ${deD(v.date)} ${v.opponent}`);
      return res.json({ id: rt.id, converted: true });
    }
    const id = Number(db.prepare('INSERT INTO sp_game(team_id, date, start, home, opponent, venue, status, meet_time, meet_place, note, result, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(v.team_id, v.date, v.start, v.home, v.opponent, v.venue, v.status, v.meet_time, v.meet_place, v.note, v.result, uname(req)).lastInsertRowid);
    ctx.audit(req.user, 'Spielbetrieb: Spieltag angelegt', `${team(v.team_id).name} ${deD(v.date)} ${v.opponent}`);
    res.json({ id });
  });
  admin.put('/games/:id', P, (req, res) => {
    const g = game(req.params.id); if (!g) return bad(res, 'Spieltag nicht gefunden.', 404);
    let v; try { v = gameInput(req.body || {}, g); } catch (e) { return bad(res, e.message); }
    db.prepare('UPDATE sp_game SET team_id = ?, date = ?, start = ?, home = ?, opponent = ?, venue = ?, status = ?, meet_time = ?, meet_place = ?, note = ?, result = ? WHERE id = ?')
      .run(v.team_id, v.date, v.start, v.home, v.opponent, v.venue, v.status, v.meet_time, v.meet_place, v.note, v.result, g.id);
    const t = team(v.team_id), ng = game(g.id);
    if (v.status === 'abgesagt' && g.status !== 'abgesagt') tell([...roster(t.id).map(r => r.member_id), ...leaders(t)], 'verlegt', { title: `Abgesagt: ${gameTitle(ng, t)}`, body: gameWhen(g) });
    else if (v.date !== g.date || v.start !== g.start) {
      db.prepare('UPDATE sp_game SET rem_players = 0, rem_captain = 0 WHERE id = ?').run(g.id);
      tell([...roster(t.id).map(r => r.member_id), ...leaders(t)], 'verlegt', { title: `Verlegt: ${gameTitle(ng, t)}`, body: `Neu: ${gameWhen(ng)} (vorher ${deD(g.date)}${g.start ? ' ' + g.start : ''})` });
    }
    ctx.audit(req.user, 'Spielbetrieb: Spieltag geändert', `${t.name} ${deD(v.date)} ${v.opponent}`);
    res.json({ ok: true });
  });
  admin.delete('/games/:id', P, (req, res) => {
    const g = game(req.params.id); if (!g) return bad(res, 'Spieltag nicht gefunden.', 404);
    db.transaction(() => { for (const x of ['sp_avail', 'sp_lineup', 'sp_task']) db.prepare(`DELETE FROM ${x} WHERE game_id = ?`).run(g.id); db.prepare('DELETE FROM sp_game WHERE id = ?').run(g.id); })();
    ctx.audit(req.user, 'Spielbetrieb: Spieltag gelöscht', `${deD(g.date)} ${g.opponent}`);
    res.json({ ok: true });
  });
  /* Aufstellung & Co. auch aus der Verwaltung (Sportwart springt ein) */
  admin.post('/games/:id/lineup', P, (req, res) => { const g = game(req.params.id); if (!g) return bad(res, 'Spieltag nicht gefunden.', 404); try { setLineup(g, int((req.body || {}).member_id), (req.body || {}).role || null, uname(req)); } catch (e) { return bad(res, e.message); } res.json(leadView(game(g.id))); });
  admin.post('/games/:id/withdraw', P, (req, res) => { const g = game(req.params.id); if (!g) return bad(res, 'Spieltag nicht gefunden.', 404); try { decideWithdraw(g, int((req.body || {}).member_id), Boolean((req.body || {}).accept), req.user); } catch (e) { return bad(res, e.message); } res.json(leadView(game(g.id))); });
  admin.post('/games/:id/send', P, ar(async (req, res) => { const g = game(req.params.id); if (!g) return bad(res, 'Spieltag nicht gefunden.', 404); try { await sendLineup(g, req.user); } catch (e) { return bad(res, e.message); } res.json(leadView(game(g.id))); }));
  admin.post('/games/:id/remind', P, (req, res) => { const g = game(req.params.id); if (!g) return bad(res, 'Spieltag nicht gefunden.', 404); res.json({ ok: true, n: remindOpen(g) }); });
  admin.post('/games/:id/task', P, (req, res) => { const g = game(req.params.id); if (!g) return bad(res, 'Spieltag nicht gefunden.', 404); try { taskEdit(g, req.body || {}, uname(req)); } catch (e) { return bad(res, e.message); } res.json(leadView(game(g.id))); });
  /** Verfügbarkeit für einen Spieler eintragen (z. B. telefonisch gemeldet) */
  admin.post('/games/:id/avail', P, (req, res) => {
    const g = game(req.params.id); if (!g) return bad(res, 'Spieltag nicht gefunden.', 404);
    const b = req.body || {}, mid = int(b.member_id); if (!isMember(mid)) return bad(res, 'Mitglied nicht gefunden.');
    if (!b.state) db.prepare('DELETE FROM sp_avail WHERE game_id = ? AND member_id = ?').run(g.id, mid);
    else if (['ja', 'nein'].includes(b.state)) db.prepare(`INSERT INTO sp_avail(game_id, member_id, state) VALUES (?,?,?) ON CONFLICT(game_id, member_id) DO UPDATE SET state = excluded.state, at = datetime('now','localtime')`).run(g.id, mid, b.state);
    else return bad(res, 'Unbekannter Wert.');
    res.json(leadView(game(g.id)));
  });

  /* ----- Spielplan-Import ----- */
  admin.post('/import/parse', P, ar(async (req, res) => {
    const b = req.body || {};
    let parsed;
    try {
      if (b.file) {
        const buf = Buffer.from(String(b.file), 'base64'); if (buf.length > 3 * 1024 * 1024) return bad(res, 'Die Datei ist zu groß (höchstens 3 MB).');
        if (/\.xlsx$/i.test(String(b.name || ''))) parsed = IMP.fromRows(await IMP.xlsxRows(buf, ctx.require('exceljs')));
        else { const t = buf.toString('utf8'); parsed = /BEGIN:VCALENDAR/i.test(t) ? IMP.fromIcs(t) : IMP.fromRows(IMP.splitRows(t)); }
      } else { const t = String(b.text || '').slice(0, 500000); parsed = /BEGIN:VCALENDAR/i.test(t) ? IMP.fromIcs(t) : IMP.fromRows(IMP.splitRows(t)); }
    } catch (e) { return bad(res, 'Die Daten konnten nicht gelesen werden: ' + e.message); }
    if (!parsed.games.length) return bad(res, 'Keine Spiele erkannt. Bitte die ganze Tabelle mit Datum, Heim- und Gastmannschaft einfügen (oder eine CSV-, Excel- oder Kalenderdatei wählen).');
    const club = txt(b.club, 80) || cfg().club || IMP.guessClub(parsed.games) || ctx.getSetting('club_name', '');
    IMP.numberTeams(parsed.games, club);   // „H30“ + „TC Frickhofen II“ → „H30 2“
    const d0 = today(), teams = {};
    const games = parsed.games.map(g => {
      const home = IMP.isHomeGame(g, club), away = !home && IMP.norm(g.guest).includes(IMP.norm(IMP.clubName(club)));
      const key = impKey(g); const t = g.team || '–';
      const known = findTeam(g.team || '', g.league);
      if (!teams[t]) teams[t] = { team: t, size: g.size, league: g.league, count: 0, team_id: known ? known.id : null, known: known ? known.name : null };
      if (home || away) teams[t].count++;
      const ex = db.prepare('SELECT * FROM sp_game WHERE ext_key = ?').get(key);
      return { ...g, key, isHome: home, own: home || away, past: g.date < d0, status: !ex ? 'neu' : ex.date === g.date && (!g.start || ex.start === g.start) ? 'vorhanden' : 'verlegt' };
    });
    for (const t of Object.values(teams)) {
      if (!t.team_id) continue;
      const own = new Set(games.filter(g => (g.team || '–') === t.team && g.own && !g.past).map(g => g.date));
      const rt = db.prepare("SELECT date FROM sp_game WHERE team_id = ? AND kind = 'rahmen' AND date >= ?").all(t.team_id, d0).map(r => r.date);
      t.rahmenKeep = rt.filter(d => own.has(d)).length; t.rahmenDrop = rt.filter(d => !own.has(d)).length;
    }
    res.json({ club, games, teams: Object.values(teams).filter(t => t.count), skipped: parsed.skipped.slice(0, 30), buchung: ctx.isModuleActive('buchung') });
  }));
  admin.post('/import/apply', P, ar(async (req, res) => {
    const b = req.body || {};
    const games = (Array.isArray(b.games) ? b.games : []).slice(0, 1000);
    const teamMap = {}; for (const [k, v] of Object.entries(b.teams && typeof b.teams === 'object' ? b.teams : {})) if (int(v) && team(v)) teamMap[k] = int(v);
    const r = upsertGames(games, txt(b.club, 80) || cfg().club || ctx.getSetting('club_name', ''), uname(req), { teamMap });
    ctx.audit(req.user, 'Spielbetrieb: Spielplan importiert', `${r.made} neu, ${r.moved} verlegt, ${r.same} unverändert${r.teamsMade ? `, Mannschaften: ${r.teams.join(', ')}` : ''}`);
    // auf Wunsch die Heimspiele auch im Buchungssystem belegen (Plätze wie beim letzten Import je Mannschaft)
    if (b.book && ctx.isModuleActive('buchung')) {
      const hg = games.filter(g => g.isHome && !g.past && g.start);
      const x = (await ctx.callHooks('bookImportedGames', { games: hg, club: txt(b.club, 80), user: req.user, force: Boolean(b.force) })).find(y => y.id === 'buchung');
      r.booking = x ? x.result : { problems: ['Buchungssystem nicht erreichbar.'] };
    }
    res.json({ ok: true, ...r });
  }));

  /* ----- Rahmenterminplan (vorläufige Spieltage, bevor der Spielplan feststeht) ----- */
  const imported = tid => db.prepare("SELECT COUNT(*) n FROM sp_game WHERE team_id = ? AND kind = 'spiel' AND ext_key IS NOT NULL AND date >= ?").get(tid, today()).n;
  admin.post('/rahmen/parse', P, ar(async (req, res) => {
    const b = req.body || {};
    const buf = Buffer.from(String(b.file || ''), 'base64');
    if (!buf.length) return bad(res, 'Bitte die PDF des Rahmenterminplans wählen.');
    if (buf.length > 8 * 1024 * 1024) return bad(res, 'Die Datei ist zu groß (höchstens 8 MB).');
    if (buf.slice(0, 5).toString() !== '%PDF-') return bad(res, 'Das ist keine PDF-Datei.');
    let r; try { r = await RTP.parsePdf(buf); } catch (e) { return bad(res, e.message); }
    if (!Object.keys(r.classes).length) return bad(res, 'Keine Altersklassen erkannt.');
    const teams = db.prepare('SELECT * FROM sp_team WHERE active = 1 ORDER BY sort, name').all().map(t => {
      let g = t.age_class || RTP.guessClass(t.name, t.league);
      if (g && !r.classes[g] && g.startsWith('HL ') && r.classes[g.slice(3)]) g = g.slice(3);   // Hessenliga ohne eigene Termine (z. B. D40) spielt an den Tagen ihrer Altersklasse
      return { id: t.id, name: t.name, league: t.league, age_class: r.classes[g] ? g : null, guess: g,
        rahmen: db.prepare("SELECT COUNT(*) n FROM sp_game WHERE team_id = ? AND kind = 'rahmen' AND date >= ?").get(t.id, today()).n,
        games: imported(t.id) };
    });
    res.json({ year: r.year, classes: r.classes, notes: r.notes, teams, today: today(), za: cfg().za });
  }));
  admin.post('/rahmen/apply', P, (req, res) => {
    const b = req.body || {};
    const classes = b.classes && typeof b.classes === 'object' ? b.classes : {};
    const assign = b.assign && typeof b.assign === 'object' ? b.assign : {};
    const za = Boolean(b.za); SET('za', za ? '1' : '0');
    const d0 = today(); let made = 0, removed = 0, kept = 0, teamsN = 0; const skippedT = [];
    const dates = l => (Array.isArray(l) ? l : []).slice(0, 60).map(String).filter(isDate);
    db.transaction(() => {
      for (const [tid0, cls0] of Object.entries(assign).slice(0, 60)) {
        const t = team(tid0); if (!t) continue;
        const cls = txt(cls0, 30) || null;
        db.prepare('UPDATE sp_team SET age_class = ? WHERE id = ?').run(cls, t.id);
        const c = cls && classes[cls]; if (!c) continue;
        if (imported(t.id)) { skippedT.push(t.name); continue; }   // Spielplan schon da – keine Platzhalter mehr
        teamsN++;
        const want = new Map(); dates(c.dates).forEach(d => want.set(d, 0)); if (za) dates(c.za).forEach(d => { if (!want.has(d)) want.set(d, 1); });
        for (const [d, z] of want) {
          if (d < d0) continue;
          if (db.prepare('SELECT 1 FROM sp_game WHERE team_id = ? AND date = ?').get(t.id, d)) { kept++; continue; }   // schon ein (echter oder vorläufiger) Spieltag
          db.prepare("INSERT INTO sp_game(team_id, date, home, opponent, kind, za, released, created_by) VALUES (?,?,1,'','rahmen',?,0,?)").run(t.id, d, z, uname(req)); made++;
        }
        // vorläufige Termine, die im Plan nicht (mehr) stehen
        for (const r of db.prepare("SELECT id, date FROM sp_game WHERE team_id = ? AND kind = 'rahmen' AND date >= ?").all(t.id, d0)) {
          if (want.has(r.date)) continue;
          for (const x of ['sp_avail', 'sp_lineup', 'sp_task']) db.prepare(`DELETE FROM ${x} WHERE game_id = ?`).run(r.id);
          db.prepare('DELETE FROM sp_game WHERE id = ?').run(r.id); removed++;
        }
      }
    })();
    ctx.audit(req.user, 'Spielbetrieb: Rahmenterminplan übernommen', `${teamsN} Mannschaften, ${made} Termine neu, ${removed} entfernt`);
    res.json({ ok: true, teams: teamsN, made, removed, kept, skipped: skippedT, pending: db.prepare("SELECT COUNT(*) n FROM sp_game WHERE kind = 'rahmen' AND released = 0 AND date >= ?").get(d0).n });
  });
  /** Abfrage starten: vorläufige Termine in der App zeigen und die Spieler benachrichtigen */
  admin.post('/rahmen/release', P, (req, res) => {
    const tid = int((req.body || {}).team_id);
    const rows = db.prepare(`SELECT * FROM sp_game WHERE kind = 'rahmen' AND released = 0 AND date >= ? ${tid ? 'AND team_id = ?' : ''}`).all(...(tid ? [today(), tid] : [today()]));
    if (!rows.length) return bad(res, 'Keine neuen vorläufigen Termine.');
    db.transaction(() => rows.forEach(g => db.prepare('UPDATE sp_game SET released = 1 WHERE id = ?').run(g.id)))();
    const per = {};
    for (const g of rows) { const t = team(g.team_id); for (const id of [...roster(t.id).map(r => r.member_id)]) { (per[id] = per[id] || { n: 0, teams: new Set() }); per[id].n++; per[id].teams.add(t.name); } }
    for (const [id, x] of Object.entries(per)) tell([Number(id)], 'rahmen', { title: 'Saisonplanung: Wann kannst du?', body: `${x.n} vorläufige Termine (${[...x.teams].join(', ')}) – bitte in der App „kann“ oder „kann nicht“ melden.` });
    ctx.audit(req.user, 'Spielbetrieb: Abfrage gestartet', `${rows.length} vorläufige Termine, ${Object.keys(per).length} Spieler`);
    res.json({ ok: true, games: rows.length, players: Object.keys(per).length });
  });

  /* ----- Einstellungen ----- */
  admin.put('/settings', P, (req, res) => {
    const b = req.body || {};
    for (const k of ['see_avail', 'see_lineup', 'cap_info', 'times', 'tasks', 'remind', 'mail', 'za']) if (b[k] !== undefined) SET(k, b[k] ? '1' : '0');
    if (b.remind_days !== undefined) SET('remind_days', Math.max(1, Math.min(30, int(b.remind_days) || 7)));
    if (b.captain_days !== undefined) SET('captain_days', Math.max(1, Math.min(30, int(b.captain_days) || 5)));
    if (Array.isArray(b.task_kinds)) {
      const kinds = b.task_kinds.slice(0, 12).map((k, i) => ({ k: (txt(k.k, 20).toLowerCase().replace(/[^a-z0-9]/g, '') || `a${i}`), l: txt(k.l, 40), when: ['heim', 'auswaerts', 'immer'].includes(k.when) ? k.when : 'immer' })).filter(k => k.l);
      SET('task_kinds', JSON.stringify(kinds));
    }
    ctx.audit(req.user, 'Spielbetrieb: Einstellungen geändert', '');
    res.json({ ok: true, settings: cfg() });
  });

  /* ----- Übersicht der Verwaltung ----- */
  ctx.hooks.overview = async () => {
    const soon = db.prepare("SELECT * FROM sp_game WHERE date >= ? AND date <= ? AND status = 'geplant' AND released = 1 ORDER BY date").all(today(), addDays(today(), 14));
    const red = soon.filter(g => !stats(g).ok);
    const wd2 = db.prepare("SELECT COUNT(*) n FROM sp_lineup l JOIN sp_game g ON g.id = l.game_id WHERE l.withdraw = 1 AND g.date >= ?").get(today()).n;
    return { kpis: [{ l: 'Spieltage in 14 Tagen', v: String(soon.length) }, { l: 'Mannschaften', v: String(db.prepare('SELECT COUNT(*) n FROM sp_team WHERE active = 1').get().n) }],
      alerts: [...(red.length ? [{ level: 'a', text: `${red.length} Spieltag(e) in den nächsten 14 Tagen mit zu wenigen Zusagen.` }] : []), ...(wd2 ? [{ level: 'a', text: `${wd2} offene Absage-Anfrage(n).` }] : [])] };
  };

  /* ----- Erinnerungen (optional) ----- */
  function tick() {
    if (!ctx.isActive()) return;
    const c = cfg(); if (!c.remind) return;
    try {
      const d0 = today();
      for (const g of db.prepare("SELECT * FROM sp_game WHERE status = 'geplant' AND released = 1 AND rem_players = 0 AND date >= ? AND date <= ?").all(d0, addDays(d0, c.remindDays))) {
        remindOpen(g); db.prepare('UPDATE sp_game SET rem_players = 1 WHERE id = ?').run(g.id);
      }
      for (const g of db.prepare("SELECT * FROM sp_game WHERE status = 'geplant' AND released = 1 AND rem_captain = 0 AND date >= ? AND date <= ?").all(d0, addDays(d0, c.captainDays))) {
        const t = team(g.team_id), st = stats(g, t);
        if (!st.ok) tell(leaders(t), 'knapp', { title: `Zu wenige Spieler: ${t.name}`, body: `${gameTitle(g, t)}, ${gameWhen(g)} – ${st.yes} von ${st.min} können, ${st.open} offen.` });
        db.prepare('UPDATE sp_game SET rem_captain = 1 WHERE id = ?').run(g.id);
      }
    } catch (e) { console.error('Spielbetrieb (Erinnerungen):', e.message); }
  }
  setTimeout(tick, 20000).unref();
  setInterval(tick, process.env.CW_TEST_FAST ? 1500 : 30 * 60000).unref();

  /* ----- Mitglied zusammengeführt/gelöscht: Mannschaftsführer-Verweise ----- */
  ctx.hooks.memberRemoved = (fromId, intoId) => {
    db.prepare('UPDATE sp_team SET captain_id = ? WHERE captain_id = ?').run(intoId, fromId);
    db.prepare('UPDATE sp_team SET vice_id = ? WHERE vice_id = ?').run(intoId, fromId);
    db.prepare('UPDATE sp_team SET vice_id = NULL WHERE vice_id = captain_id').run();
    db.prepare('UPDATE sp_task SET member_id = ? WHERE member_id = ?').run(intoId, fromId);   // gelöscht: Aufgabe wird wieder offen statt zu verschwinden
  };

  /* ----- Funktionsexport: Mannschaften und Einstellungen ----- */
  ctx.hooks.exportConfig = () => ({ teams: db.prepare('SELECT name, league, season, min_players, active, note, age_class FROM sp_team').all(), settings: Object.fromEntries(['see_avail', 'see_lineup', 'cap_info', 'times', 'tasks', 'remind', 'remind_days', 'captain_days', 'mail', 'task_kinds', 'za'].map(k => [k, S(k)])) });
  ctx.hooks.importConfig = data => {
    if (!data || typeof data !== 'object') throw new Error('Leere Funktionsdatei.');
    let n = 0;
    for (const t of Array.isArray(data.teams) ? data.teams.slice(0, 60) : []) { const name = txt(t.name, 60); if (name.length < 2 || dupOf({ name, league: t.league, age_class: t.age_class })) continue; db.prepare('INSERT INTO sp_team(name, league, season, min_players, active, note, import_key, age_class) VALUES (?,?,?,?,?,?,?,?)').run(name, txt(t.league, 80) || null, txt(t.season, 30) || null, Math.max(1, Math.min(20, int(t.min_players) || 4)), t.active === 0 ? 0 : 1, txt(t.note, 300) || null, IMP.norm(name), txt(t.age_class, 30) || null); n++; }
    for (const [k, v] of Object.entries(data.settings || {})) if (typeof v === 'string' && ['see_avail', 'see_lineup', 'cap_info', 'times', 'tasks', 'remind', 'remind_days', 'captain_days', 'mail', 'task_kinds', 'za'].includes(k)) SET(k, v.slice(0, 2000));
    return `${n} Mannschaft(en) und die Einstellungen übernommen – Spieler und Spieltage bitte neu zuordnen bzw. importieren`;
  };
}

module.exports = { activate };
