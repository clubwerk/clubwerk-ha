'use strict';
/*
 * Großer Musterverein für die Leistungsmessung – nur erfundene Daten.
 *
 *   node werkzeuge/last/gross.js <DATA_DIR>      erzeugt <DATA_DIR>/clubwerk.db (vorher wird der Ordner geleert)
 *   bash werkzeuge/last/start.sh                 Generator + Server (Ports 3810 / 5810 / 5811), Daten in werkzeuge/last/daten
 *   bash werkzeuge/last/start.sh --behalten      Server mit den Daten vom letzten Lauf
 *   bash werkzeuge/last/stop.sh                  beenden
 *
 * Ablauf: zuerst werkzeuge/demo/laden.js (frische Demo, Anmeldung admin / Test-Kennwort-42, Tablet-Passwort Theke-Abend7,
 * PINs 2468 / 1234 / 5678), dann Massendaten direkt per better-sqlite3 – so, wie der Server sie bei ausgeschaltetem Tresor speichert.
 * Tresor: Die Demo hat ihn aus (keine Einstellung vault_on). Steht vault_on = 1, bricht der Generator ab, statt Klartext neben
 * verschlüsselte Spalten zu schreiben.
 * Zufall mit festem Startwert: Jeder Lauf erzeugt dieselben Daten (bis auf die Verschiebung auf das heutige Datum).
 * Namen, Anschriften, Firmen, IBANs (Bank „Musterbank“, BLZ 12345678) sind erfunden; E-Mails enden auf @example.org.
 */
const path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const D = require(path.join(ROOT, 'clubwerk', 'node_modules', 'better-sqlite3'));
const dir = process.argv[2]; if (!dir) { console.error('Aufruf: node werkzeuge/last/gross.js <DATA_DIR>'); process.exit(1); }
const T0 = Date.now();
execFileSync(process.execPath, [path.join(ROOT, 'werkzeuge', 'demo', 'laden.js'), dir], { stdio: 'inherit' });
const db = new D(path.join(dir, 'clubwerk.db'));
db.pragma('journal_mode = WAL'); db.pragma('synchronous = OFF'); db.pragma('foreign_keys = ON');
if ((db.prepare("SELECT value FROM settings WHERE key = 'vault_on'").get() || {}).value === '1') { console.error('Die Demo-Datenbank hat den Tresor eingeschaltet – Generator bricht ab (Klartext-Spalten wären falsch).'); process.exit(2); }

/* ---------- Zufall (mulberry32, fester Startwert) ---------- */
let seed = 20261022;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
const chance = p => rnd() < p;
const shuffle = a => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const sample = (a, n) => shuffle(a).slice(0, n);
const weighted = list => { const s = list.reduce((t, x) => t + x[1], 0); let r = rnd() * s; for (const x of list) { r -= x[1]; if (r <= 0) return x[0]; } return list[list.length - 1][0]; };
const hex = n => Array.from({ length: n }, () => '0123456789abcdef'[ri(0, 15)]).join('');

/* ---------- Datum (lokal) ---------- */
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NOW = new Date(); const TODAY = fmt(NOW);
const dayAdd = (s, n) => { const [y, m, d] = s.split('-').map(Number); return fmt(new Date(y, m - 1, d + n)); };
const dow = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay() || 7; };   // 1 = Mo … 7 = So
const ts = (day, h, mi = 0, s = 0) => `${day} ${pad(h)}:${pad(mi)}:${pad(s)}`;
const deD = s => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const monthStart = (y, m) => fmt(new Date(y, m, 1)), monthEnd = (y, m) => fmt(new Date(y, m + 1, 0));
const age = (birth, day = TODAY) => { let a = +day.slice(0, 4) - +birth.slice(0, 4); if (day.slice(5) < birth.slice(5)) a--; return a; };
const YEAR = NOW.getFullYear(), YSTART = `${YEAR}-01-01`, YEND = `${YEAR}-12-31`;
const nowTs = ts(TODAY, NOW.getHours(), NOW.getMinutes(), NOW.getSeconds());
const season = day => { const m = +day.slice(5, 7); return [0.35, 0.35, 0.5, 0.8, 1.1, 1.3, 1.4, 1.3, 1.2, 0.9, 0.5, 0.45][m - 1]; };

/* ---------- erfundene Namen ---------- */
const VM = ['Alexander', 'Andreas', 'Ben', 'Bernd', 'Christian', 'Daniel', 'David', 'Dennis', 'Dieter', 'Elias', 'Emil', 'Erik', 'Fabian', 'Felix', 'Finn', 'Florian', 'Frank', 'Georg', 'Gerd', 'Hannes', 'Heiko', 'Henri', 'Holger', 'Jakob', 'Jan', 'Jannik', 'Jens', 'Jonas', 'Jörg', 'Julian', 'Kai', 'Karl', 'Klaus', 'Leon', 'Lukas', 'Lars', 'Linus', 'Malte', 'Marco', 'Mario', 'Martin', 'Matthias', 'Max', 'Michael', 'Moritz', 'Nico', 'Niklas', 'Noah', 'Ole', 'Oliver', 'Oskar', 'Patrick', 'Paul', 'Peter', 'Philipp', 'Rainer', 'Ralf', 'Sebastian', 'Simon', 'Stefan', 'Sven', 'Theo', 'Thomas', 'Tim', 'Tobias', 'Uwe', 'Volker', 'Werner', 'Wolfgang', 'Yannick'];
const VW = ['Alina', 'Andrea', 'Anja', 'Anna', 'Annika', 'Antje', 'Birgit', 'Carla', 'Charlotte', 'Christina', 'Clara', 'Claudia', 'Daniela', 'Doris', 'Elena', 'Elke', 'Ella', 'Emilia', 'Emma', 'Eva', 'Franziska', 'Frieda', 'Gabriele', 'Greta', 'Hanna', 'Heike', 'Helena', 'Ida', 'Ines', 'Isabel', 'Jana', 'Johanna', 'Julia', 'Karin', 'Katharina', 'Kerstin', 'Klara', 'Lara', 'Laura', 'Lea', 'Lena', 'Lina', 'Lisa', 'Luisa', 'Maja', 'Maria', 'Marie', 'Marlene', 'Martina', 'Melanie', 'Mia', 'Mila', 'Monika', 'Nadine', 'Nele', 'Nina', 'Paula', 'Petra', 'Pia', 'Renate', 'Sabine', 'Sandra', 'Sarah', 'Silke', 'Sofia', 'Sonja', 'Stefanie', 'Susanne', 'Tanja', 'Ute'];
const NN = ['Albrecht', 'Arnold', 'Bader', 'Bauer', 'Baumann', 'Beck', 'Berger', 'Bergmann', 'Brandt', 'Braun', 'Busch', 'Dietrich', 'Dorn', 'Ebert', 'Eckert', 'Engel', 'Ernst', 'Falk', 'Fink', 'Fischer', 'Frank', 'Franke', 'Friedrich', 'Fuchs', 'Graf', 'Groß', 'Günther', 'Haas', 'Hahn', 'Hartmann', 'Heinrich', 'Herrmann', 'Hoffmann', 'Hofmann', 'Horn', 'Huber', 'Jäger', 'Jansen', 'Kaiser', 'Keller', 'Kern', 'Klein', 'Koch', 'König', 'Kraft', 'Kramer', 'Kraus', 'Krüger', 'Kühn', 'Lang', 'Lange', 'Lehmann', 'Lindner', 'Lorenz', 'Ludwig', 'Maier', 'Martin', 'Mayer', 'Meier', 'Mertens', 'Meyer', 'Möller', 'Müller', 'Nagel', 'Neumann', 'Noll', 'Otto', 'Peters', 'Pohl', 'Richter', 'Roth', 'Sauer', 'Schäfer', 'Scheffler', 'Schmid', 'Schmidt', 'Schneider', 'Scholz', 'Schröder', 'Schubert', 'Schulte', 'Schulze', 'Schwarz', 'Seidel', 'Simon', 'Sommer', 'Stein', 'Thiel', 'Vogel', 'Vogt', 'Voigt', 'Walter', 'Weber', 'Weiß', 'Werner', 'Winkler', 'Winter', 'Wolf', 'Zeller', 'Ziegler'];
const STR = ['Hauptstraße', 'Lindenweg', 'Am Sportplatz', 'Gartenstraße', 'Bergstraße', 'Schulstraße', 'Kirchgasse', 'Wiesenweg', 'Birkenallee', 'Ahornweg', 'Mühlenweg', 'Bahnhofstraße', 'Am Bach', 'Rosenstraße', 'Talstraße', 'Feldweg', 'Waldstraße', 'Eichenring', 'Sonnenhang', 'Turmstraße'];
const ORT = [['12345', 'Musterstadt', 6], ['12346', 'Beispielhausen', 2], ['12347', 'Musterdorf', 2], ['12348', 'Neuweiler am See', 1]];
const ascii = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-');
const usedNames = new Set(db.prepare('SELECT name FROM members').all().map(r => r.name));
function personName(g, last) {
  for (let i = 0; i < 200; i++) { const f = pick(g === 'm' ? VM : VW), l = last || pick(NN); if (!usedNames.has(`${f} ${l}`)) { usedNames.add(`${f} ${l}`); return [f, l]; } }
  throw new Error('Namen erschöpft');
}
function address() { const o = weighted(ORT.map(x => [x, x[2]])); return { street: `${pick(STR)} ${ri(1, 120)}${chance(0.1) ? pick(['a', 'b']) : ''}`, zip: o[0], city: o[1] }; }
function iban(no) {   // DE + Prüfziffer + BLZ 12345678 + Kontonummer (erfunden, Prüfziffer nach ISO 7064 korrekt)
  const bban = '12345678' + String(no).padStart(10, '0');
  const num = (bban + '1314' + '00').split('').reduce((r, c) => (r * 10 + Number(c)) % 97, 0);
  return `DE${pad(98 - num)}${bban}`;
}
const N = {};   // Zähler für den Bericht
const count = (k, n = 1) => { N[k] = (N[k] || 0) + n; };

/* ======================================================================= Mitglieder */
const run = db.transaction(() => {
  const S = (k, v) => db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
  S('club_name', 'TC Grün-Weiß Musterstadt (großer Musterverein)');

  // Beitragsarten und Abteilungen
  db.prepare("UPDATE mv_fee SET cents = 12000, age_min = 19, age_max = NULL WHERE id = 1").run();
  db.prepare("UPDATE mv_fee SET cents = 4000, age_min = NULL, age_max = 18 WHERE id = 2").run();
  db.prepare("UPDATE mv_fee SET cents = 20000, family = 1 WHERE id = 3").run();
  const insFee = db.prepare("INSERT INTO mv_fee(name, department_id, cents, interval, prorate, age_min, age_max, family, on_form, sort, active, kind) VALUES (?,?,?,?,?,?,?,?,1,?,1,?)");
  const feePassiv = Number(insFee.run('Passiv', null, 3000, 'jahr', 'anteilig', null, null, 0, 40, 'grund').lastInsertRowid);
  const insDept = db.prepare('INSERT INTO mv_department(name, federation, sort, active) VALUES (?,?,?,1)');
  const dTennis = Number(insDept.run('Tennis', 'Tennisverband Musterland', 10).lastInsertRowid);
  const dPadel = Number(insDept.run('Padel', null, 20).lastInsertRowid);
  const dFit = Number(insDept.run('Fitness', null, 30).lastInsertRowid);
  const Z = {
    [dTennis]: [{ id: Number(insFee.run('Tennis Erwachsene', dTennis, 6000, 'jahr', 'anteilig', 19, null, 0, 50, 'zusatz').lastInsertRowid), min: 19, max: 999, cents: 6000, name: 'Tennis Erwachsene' },
      { id: Number(insFee.run('Tennis Jugend', dTennis, 2000, 'jahr', 'anteilig', null, 18, 0, 51, 'zusatz').lastInsertRowid), min: 0, max: 18, cents: 2000, name: 'Tennis Jugend' }],
    [dPadel]: [{ id: Number(insFee.run('Padel', dPadel, 4000, 'jahr', 'anteilig', null, null, 0, 60, 'zusatz').lastInsertRowid), min: 0, max: 999, cents: 4000, name: 'Padel' }],
    [dFit]: [{ id: Number(insFee.run('Fitness', dFit, 3000, 'jahr', 'anteilig', null, null, 0, 70, 'zusatz').lastInsertRowid), min: 0, max: 999, cents: 3000, name: 'Fitness' }],
  };
  const FEE = { 1: ['Erwachsene', 12000], 2: ['Jugend', 4000], 3: ['Familie', 20000], [feePassiv]: ['Passiv', 3000] };

  const insM = db.prepare("INSERT INTO members(name, kind, active, created_at, first_name, last_name) VALUES (?, 'mitglied', ?, ?, ?, ?)");
  const insP = db.prepare(`INSERT INTO mv_person(member_id, member_no, salutation, first_name, last_name, birth_date, gender, street, zip, city, country, mobile, email, letter_salutation,
    status, entry_date, exit_date, exit_reason, notice_date, payer_id, family_of, payment, consents, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'Deutschland',?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  let memberNo = 1000;
  const P = [];   // alle erzeugten Personen
  const birthFor = (a0, a1) => { const a = ri(a0, a1); return fmt(new Date(YEAR - a, ri(0, 11), ri(1, 28))); };
  function person(o) {
    const g = o.gender || (chance(0.5) ? 'm' : 'w');
    const [first, last] = personName(g, o.last);
    const birth = o.birth || birthFor(o.a0, o.a1);
    const a = age(birth);
    const minEntry = dayAdd(birth, 365 * 5);
    let entry = o.entry || fmt(new Date(ri(1980, YEAR), ri(0, 11), ri(1, 28)));
    if (entry < minEntry) entry = minEntry; if (entry > dayAdd(TODAY, -20)) entry = dayAdd(TODAY, -ri(20, 200));
    const status = o.status || (a >= 25 && chance(0.1) ? 'passiv' : 'aktiv');
    const exit = o.exit || null;
    const adr = o.adr || address();
    const email = a >= 16 || !o.payer ? `${ascii(first)}.${ascii(last)}${chance(0.3) ? ri(1, 99) : ''}@example.org` : null;
    const created = ts(entry < '2020-01-01' ? dayAdd(TODAY, -ri(400, 900)) : entry, ri(8, 20), ri(0, 59));
    const id = Number(insM.run(`${first} ${last}`, exit && exit < TODAY ? 0 : 1, created, first, last).lastInsertRowid);
    const no = String(++memberNo);
    const sal = g === 'm' ? 'Herr' : 'Frau';
    insP.run(id, no, sal, first, last, birth, g, adr.street, adr.zip, adr.city, a >= 14 ? `0170 555${String(ri(0, 9999)).padStart(4, '0')}` : null, email,
      `${g === 'm' ? 'Lieber' : 'Liebe'} ${first}`, status, entry, exit, exit ? pick(['Umzug', 'kein Interesse mehr', 'gesundheitliche Gründe', 'Zeitmangel']) : null,
      exit ? dayAdd(exit, -ri(30, 90)) : null, o.payer || null, o.family || null, o.payment || 'lastschrift',
      JSON.stringify(chance(0.6) ? { homepage: dayAdd(entry, 1), fotos: dayAdd(entry, 1) } : {}), created, created);
    const p = { id, no, first, last, g, birth, age: a, entry, status, exit, payer: o.payer || null, family: o.family || null, payment: o.payment || 'lastschrift', adr, depts: [] };
    P.push(p); count('mitglieder');
    return p;
  }

  // ~60 Familien: Oberhaupt + meist Partner + 1–3 Kinder (bis 18), gemeinsame Anschrift, alle zahlen über das Oberhaupt
  const heads = [];
  for (let f = 0; f < 60; f++) {
    const g = chance(0.6) ? 'm' : 'w';
    const head = person({ gender: g, a0: 32, a1: 56, status: 'aktiv' });
    head.feeId = 3; heads.push(head);
    if (chance(0.85)) person({ gender: g === 'm' ? 'w' : 'm', last: head.last, birth: dayAdd(head.birth, ri(-1500, 1500)), adr: head.adr, payer: head.id, family: head.id, status: 'aktiv', entry: head.entry });
    const kids = ri(1, 3);
    for (let k = 0; k < kids; k++) person({ last: head.last, a0: 4, a1: Math.min(18, head.age - 22), adr: head.adr, payer: head.id, family: head.id, status: 'aktiv' });
  }
  // „zahlt für“ (keine Familie): erwachsene Kinder mit eigenem Beitrag, der Elternteil zahlt
  for (const h of sample(heads, 12)) { const p = person({ last: h.last, a0: 19, a1: 26, adr: h.adr, payer: h.id, status: 'aktiv' }); p.feeId = 1; }
  // Einzelmitglieder
  while (P.length < 490) {   // + 10 Mitglieder der Demo = 500
    const a = weighted([[[6, 17], 18], [[18, 29], 14], [[30, 49], 26], [[50, 69], 28], [[70, 88], 14]]);
    const p = person({ a0: a[0], a1: a[1], payment: chance(0.08) ? 'rechnung' : 'lastschrift' });
    p.feeId = p.status === 'passiv' ? feePassiv : p.age <= 18 ? 2 : 1;
    if (chance(0.015)) { p.status = 'ehren'; p.feeId = null; db.prepare("UPDATE mv_person SET status = 'ehren' WHERE member_id = ?").run(p.id); }
  }
  // Austritte: einige schon ausgetreten (letzte 12 Monate), einige zum Jahresende gekündigt
  const singles = P.filter(p => !p.family && !heads.includes(p) && !p.payer && p.feeId);
  for (const p of sample(singles, 18)) { p.exit = dayAdd(TODAY, -ri(10, 330)); db.prepare("UPDATE mv_person SET exit_date = ?, exit_reason = 'Umzug', notice_date = ? WHERE member_id = ?").run(p.exit, dayAdd(p.exit, -60), p.id); db.prepare('UPDATE members SET active = 0 WHERE id = ?').run(p.id); }
  for (const p of sample(singles.filter(p => !p.exit), 8)) { p.exit = YEND; db.prepare("UPDATE mv_person SET exit_date = ?, exit_reason = 'Zeitmangel', notice_date = ? WHERE member_id = ?").run(p.exit, dayAdd(TODAY, -ri(5, 60)), p.id); }
  const isIn = (p, day = TODAY) => !p.exit || p.exit >= day;
  const byId = new Map(P.map(p => [p.id, p]));
  const payerOf = id => { const p = byId.get(id); return p && p.payer ? p.payer : id; };

  // Bankverbindung + SEPA-Mandat für alle Selbstzahler mit Lastschrift
  const insBank = db.prepare('INSERT INTO mv_bank(member_id, holder, iban, bic, bank, mandate_ref, mandate_date, updated_at) VALUES (?,?,?,?,?,?,?,?)');
  for (const p of P) if (!p.payer && p.payment === 'lastschrift') {
    const holder = p.age < 18 ? `${pick(p.g === 'm' ? VW : VM)} ${p.last}` : `${p.first} ${p.last}`;
    insBank.run(p.id, holder, iban(4000000 + Number(p.no)), 'MUSTDEXXXXX', 'Musterbank', 'MV' + p.no, p.entry < '2015-01-01' ? '2015-01-01' : p.entry, ts(p.entry < '2015-01-01' ? '2015-01-01' : p.entry, 12));
    count('mv_bank');
  }

  // Beiträge (mv_member_fee) – Familienangehörige ohne eigenen Beitrag
  const insMF = db.prepare('INSERT INTO mv_member_fee(member_id, fee_id, start_date, end_date, booked_until, cents) VALUES (?,?,?,?,?,NULL)');
  for (const p of P) if (p.feeId) {
    p.mf = Number(insMF.run(p.id, p.feeId, p.entry, p.exit, p.exit && p.exit < YEND ? p.exit : YEND).lastInsertRowid); count('mv_member_fee');
  }
  // Abteilungen
  const insMD = db.prepare("INSERT INTO mv_member_department(member_id, department_id, entry_date, exit_date, status, booked_until, fee_id, fee_free) VALUES (?,?,?,?,'aktiv',?,NULL,0)");
  for (const p of P) {
    const ds = [];
    if (p.status === 'aktiv' && chance(0.82)) ds.push(dTennis);
    if (p.status === 'aktiv' && p.age >= 14 && chance(0.18)) ds.push(dPadel);
    if (p.age >= 16 && chance(0.14)) ds.push(dFit);
    for (const d of ds) { const md = Number(insMD.run(p.id, d, p.entry, p.exit, p.exit && p.exit < YEND ? p.exit : YEND).lastInsertRowid); p.depts.push({ id: md, dept: d }); count('mv_member_department'); }
  }
  // Funktionen und Ehrungen (ein paar)
  const adults = P.filter(p => p.age >= 25 && isIn(p));
  const insFn = db.prepare('INSERT INTO mv_function(member_id, name, from_date) VALUES (?,?,?)');
  ['Vorsitz', 'Stellv. Vorsitz', 'Kasse', 'Schriftführung', 'Sportwart', 'Jugendwart', 'Platzwart', 'Pressewart', 'Beisitz', 'Beisitz', 'Trainer', 'Trainer', 'Trainer'].forEach(n => { insFn.run(pick(adults).id, n, dayAdd(TODAY, -ri(100, 2000))); count('mv_function'); });
  const insHon = db.prepare('INSERT INTO mv_honor(member_id, name, date) VALUES (?,?,?)');
  for (const p of P.filter(p => p.entry < '2001-01-01').slice(0, 40)) { insHon.run(p.id, p.entry < '1991-01-01' ? '35 Jahre Mitgliedschaft' : '25 Jahre Mitgliedschaft', dayAdd(TODAY, -ri(30, 900))); count('mv_honor'); }

  /* ---------- Forderungen (mv_charge) über 12 Monate ---------- */
  const insRun = db.prepare('INSERT INTO mv_run(kind, until_date, filters, count, cents, drinks_batch, by_user, created_at) VALUES (?,?,?,?,?,?,?,?)');
  const insCol = db.prepare("INSERT INTO mv_collection(collection_date, msg_id, count, cents, xml, status, prenotified_at, booked_at, by_user, created_at) VALUES (?,?,?,?,NULL,'gebucht',?,?,'Adminkonto',?)");
  const insCh = db.prepare(`INSERT INTO mv_charge(member_id, for_member_id, kind, text, period_from, period_to, cents, due_date, status, paid_at, paid_via, collection_id, run_id, member_fee_id,
    ext_key, dunning_level, dunned_at, returns, note, created_by, created_at, member_dept_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Adminkonto',?,?)`);
  const firstUse = new Map(), lastUse = new Map();
  /** Einen Lauf verbuchen: Positionen → Forderungen, Lastschriften als gebuchter Einzug, sonst überwiegend bezahlt */
  function bookRun(kind, runDay, positions, drinksBatch = null) {
    if (!positions.length) return;
    const runId = Number(insRun.run(kind, runDay, '{}', positions.length, positions.reduce((s, x) => s + x.cents, 0), drinksBatch, 'Adminkonto', ts(runDay, 18, 5)).lastInsertRowid);
    const colDay = dayAdd(runDay, 7), done = colDay <= TODAY;
    const ls = positions.filter(x => byId.get(x.member_id).payment === 'lastschrift');
    let colId = null;
    if (done && ls.length) colId = Number(insCol.run(colDay, `CW${colDay.replace(/-/g, '')}0900-${runId}`, ls.length, ls.reduce((s, x) => s + x.cents, 0), ts(dayAdd(runDay, 1), 9), ts(dayAdd(colDay, 2), 10), ts(runDay, 18, 30)).lastInsertRowid);
    for (const x of positions) {
      const lsP = byId.get(x.member_id).payment === 'lastschrift';
      let st = 'offen', paidAt = null, via = null, col = null, ret = 0, note = null, dun = 0, dunAt = null;
      if (done && lsP) {
        if (chance(0.015)) { ret = 1; note = `Rücklastschrift Einzug ${colId}: Konto erloschen`; }
        else { st = 'bezahlt'; paidAt = dayAdd(colDay, 2); via = 'lastschrift'; col = colId; firstUse.has(x.member_id) || firstUse.set(x.member_id, colDay); lastUse.set(x.member_id, colDay); }
      } else if (!lsP && dayAdd(runDay, 14) <= TODAY && chance(0.88)) { st = 'bezahlt'; paidAt = dayAdd(runDay, ri(3, 25)); if (paidAt > TODAY) paidAt = TODAY; via = chance(0.8) ? 'ueberweisung' : 'bar'; }
      if (st === 'offen' && dayAdd(x.due, 30) < TODAY && chance(0.5)) { dun = 1; dunAt = dayAdd(x.due, 30); }
      insCh.run(x.member_id, x.for_member_id, x.kind, x.text, x.from, x.to, x.cents, x.due, st, paidAt, via, col, runId, x.mf || null, null, dun, dunAt, ret, note, ts(runDay, 18, 6), x.md || null);
      count('mv_charge'); if (st !== 'bezahlt') count('mv_charge_offen');
    }
  }
  // Beitragslauf für das laufende Beitragsjahr (Grundbeitrag + Zusatzbeiträge, Eintritt im Jahr anteilig)
  const runDay = dayAdd(YSTART, 1) <= TODAY ? dayAdd(YSTART, 1) : TODAY;
  const pos = [];
  const months = from => 12 - (+from.slice(5, 7)) + 1;
  for (const p of P) {
    const from = p.entry > YSTART ? p.entry : YSTART, to = p.exit && p.exit < YEND ? p.exit : YEND;
    if (to < YSTART) continue;
    const share = c => Math.round(c * months(from) / 12);
    const payer = payerOf(p.id), suffix = payer !== p.id ? ` – ${p.first} ${p.last}` : '';
    const ptext = `${from.slice(5, 7)}/${YEAR}–12/${YEAR}`;
    if (p.mf) { const [n, c] = FEE[p.feeId]; pos.push({ member_id: payer, for_member_id: p.id, kind: 'beitrag', text: `${n} ${ptext}${from > YSTART ? ' (anteilig)' : ''}${suffix}`, from, to: YEND, cents: share(c), due: from, mf: p.mf }); }
    for (const d of p.depts) {
      const f = Z[d.dept].find(z => age(p.birth, from) >= z.min && age(p.birth, from) <= z.max); if (!f) continue;
      pos.push({ member_id: payer, for_member_id: p.id, kind: 'beitrag', text: `${f.name} ${ptext}${from > YSTART ? ' (anteilig)' : ''}${suffix}`, from, to: YEND, cents: share(f.cents), due: from, md: d.id });
    }
  }
  const byRun = new Map(); for (const x of pos) { const d = x.from > YSTART ? dayAdd(x.from, 3) : runDay; byRun.set(d, [...(byRun.get(d) || []), x]); }
  for (const d of [...byRun.keys()].sort()) bookRun('beitrag', d > TODAY ? TODAY : d, byRun.get(d));

  /* ======================================================================= Verkauf */
  const arts = db.prepare('SELECT * FROM articles WHERE custom = 0 AND active = 1').all();
  const artW = arts.map(a => [a, { Bier: 9, Weizen: 4, Softdrinks: 6, Wasser: 5, Kaffee: 3, Snacks: 2 }[a.category] || 1]);
  const drinkers = P.filter(p => p.age >= 12 && chance(p.age >= 18 ? 0.7 : 0.35));
  const dW = drinkers.map(p => [p, 0.3 + rnd() * 2]);
  const insB = db.prepare(`INSERT INTO bookings(member_id, article_id, event_id, kind, qty, unit_cents, total_cents, created_at, cancelled_at, cancelled_by, paid_cash, event_guest_id, payment_id, settled_id, article_name, article_category)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const bookingRows = [];   // für die Abrechnung: [id, member_id, day, total]
  const start = dayAdd(TODAY, -365);
  const stock = new Map();   // article_id → { 'YYYY-MM': qty }
  const addStock = (a, day, q) => { const k = day.slice(0, 7); const m = stock.get(a) || new Map(); m.set(k, (m.get(k) || 0) + q); stock.set(a, m); };
  for (let day = start; day <= TODAY; day = dayAdd(day, 1)) {
    const wk = dow(day) >= 6 ? 1.6 : 1;
    const n = Math.round(66 * season(day) * wk * (0.6 + rnd() * 0.8) / 1.25);
    for (let i = 0; i < n; i++) {
      const a = weighted(artW), qty = weighted([[1, 6], [2, 3], [3, 1]]);
      const h = day === TODAY ? ri(8, Math.max(8, NOW.getHours() - 1)) : weighted([[11, 1], [14, 2], [16, 3], [17, 4], [18, 6], [19, 7], [20, 6], [21, 4], [22, 2]]);
      const at = ts(day, h, ri(0, 59), ri(0, 59));
      if (at > nowTs) continue;
      const k = weighted([['konto', 92], ['verein', 4], ['gast', 4]]);
      const mid = k === 'konto' ? weighted(dW).id : k === 'verein' ? 1 : 2;
      const total = k === 'verein' ? 0 : a.price_cents * qty;
      const canc = chance(0.01);
      const id = Number(insB.run(mid, a.id, null, k, qty, a.price_cents, total, at, canc ? ts(day, Math.min(23, h + 1), ri(0, 59)) : null, canc ? 'Tablet' : null, k === 'gast' ? 1 : null, null, null, null, a.name, a.category).lastInsertRowid);
      if (!canc) addStock(a.id, day, qty);
      if (k === 'konto' && !canc) bookingRows.push([id, mid, day, total]);
      count('bookings');
    }
  }
  // Veranstaltungen mit Gästeliste (vergangen, abgeschlossen) + eine kommende
  const insEv = db.prepare('INSERT INTO events(name, date, active, cash_cents, note, created_at, closed_at) VALUES (?,?,0,?,?,?,?)');
  const insEA = db.prepare('INSERT INTO event_articles(event_id, article_id, price_cents) VALUES (?,?,?)');
  const insEG = db.prepare('INSERT INTO event_guests(event_id, name, member_id, created_at, created_by) VALUES (?,?,?,?,?)');
  const insEP = db.prepare('INSERT INTO event_payments(event_id, guest_id, method, cents, at, by_user) VALUES (?,?,?,?,?,?)');
  const setPay = db.prepare('UPDATE bookings SET payment_id = ? WHERE event_guest_id = ?');
  const EV = [['Saisoneröffnung', -190], ['Clubmeisterschaft Finale', -75], ['Sommerfest', -110], ['Grillabend Jugend', -95], ['Saisonabschluss', -25], ['Weihnachtsfeier', -305], ['Herbstfest', 20]];
  for (const [name, off] of EV) {
    const day = dayAdd(TODAY, off), past = off < 0;
    const evId = Number(insEv.run(name, day, past ? ri(20000, 60000) : null, null, ts(dayAdd(day, -10), 19), past ? ts(dayAdd(day, 1), 1, 15) : null).lastInsertRowid);
    for (const a of arts) insEA.run(evId, a.id, a.price_cents + (a.category === 'Bier' ? 50 : 0));
    count('events');
    if (!past) continue;
    const guests = sample(drinkers, ri(35, 70)).map(p => ({ name: `${p.first} ${p.last}`, mid: p.id }));
    for (let i = 0; i < ri(8, 15); i++) guests.push({ name: `${pick([...VM, ...VW])} ${pick(NN)} (Gast)`, mid: null });
    for (const g of guests) {
      const gid = Number(insEG.run(evId, g.name, g.mid, ts(day, ri(16, 19), ri(0, 59)), 'tablet').lastInsertRowid); count('event_guests');
      let sum = 0;
      for (let i = 0; i < ri(1, 6); i++) {
        const a = weighted(artW), qty = ri(1, 2), unit = a.price_cents + (a.category === 'Bier' ? 50 : 0);
        insB.run(g.mid, a.id, evId, 'event', qty, unit, unit * qty, ts(day, ri(17, 23), ri(0, 59)), null, null, 0, gid, null, null, a.name, a.category); sum += unit * qty; addStock(a.id, day, qty); count('bookings');
      }
      const pid = Number(insEP.run(evId, gid, chance(0.7) ? 'bar' : 'karte', sum, ts(day, 23, ri(0, 59)), 'Adminkonto').lastInsertRowid); setPay.run(pid, gid); count('event_payments');
    }
    for (let i = 0; i < ri(40, 90); i++) { const a = weighted(artW), unit = a.price_cents + (a.category === 'Bier' ? 50 : 0); insB.run(null, a.id, evId, 'event', 1, unit, unit, ts(day, ri(17, 23), ri(0, 59)), null, null, 1, null, null, null, a.name, a.category); addStock(a.id, day, 1); count('bookings'); }
  }
  // Lieferungen: monatlich so viel, dass der Bestand ungefähr aufgeht
  const insDel = db.prepare("INSERT INTO deliveries(date, supplier, note, created_at, doc_no, doc_kind, total_cents) VALUES (?, 'Getränkehandel Muster GmbH', NULL, ?, ?, 'lieferung', ?)");
  const insDI = db.prepare('INSERT INTO delivery_items(delivery_id, article_id, crates, bottles, cost_cents) VALUES (?,?,?,?,?)');
  const monthsList = []; for (let i = 12; i >= 0; i--) { const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1); monthsList.push([d.getFullYear(), d.getMonth()]); }
  for (const [y, m] of monthsList) {
    const key = `${y}-${pad(m + 1)}`, day = monthStart(y, m) > TODAY ? TODAY : monthStart(y, m);
    const items = arts.filter(a => a.track_stock).map(a => [a, Math.ceil(((stock.get(a.id) || new Map()).get(key) || 0) / a.crate_size) + 1]);
    const dl = Number(insDel.run(day, ts(day, 10), `LS-${key.replace('-', '')}-${ri(100, 999)}`, items.reduce((s, [a, c]) => s + c * a.crate_size * Math.round(a.price_cents * 0.45), 0)).lastInsertRowid);
    for (const [a, c] of items) insDI.run(dl, a.id, c, 0, Math.round(a.price_cents * 0.45) * a.crate_size);
    count('deliveries');
  }
  // Monatliche Abrechnung (Verkauf → Mitgliederverwaltung): je Monat ein Lauf, Konten abgerechnet, Forderungen beim Zahler
  const insMS = db.prepare('INSERT INTO member_settlements(member_id, cents, items, until_at, batch, note, by_user, created_at) VALUES (?,?,?,?,?,?,?,?)');
  const setSettled = db.prepare('UPDATE bookings SET settled_id = ? WHERE id = ?');
  for (const [y, m] of monthsList.slice(0, 12)) {
    const until = monthEnd(y, m), rd = dayAdd(until, 3); if (rd > TODAY) continue;
    const rows = bookingRows.filter(r => r[2] <= until && r[2] >= monthStart(y, m));
    const per = new Map(); for (const r of rows) { const x = per.get(r[1]) || { c: 0, n: 0, ids: [], since: r[2] }; x.c += r[3]; x.n++; x.ids.push(r[0]); per.set(r[1], x); }
    const batch = `mv-${(Date.parse(rd) / 1000).toString(36)}${hex(4)}`;
    const ps = [];
    for (const [mid, x] of per) {
      const sid = Number(insMS.run(mid, x.c, x.n, ts(until, 23, 59, 59), batch, 'Mitgliederverwaltung: Monatsabrechnung', 'Adminkonto', ts(rd, 18, 0)).lastInsertRowid);
      for (const id of x.ids) setSettled.run(sid, id);
      count('member_settlements');
      const p = byId.get(mid); if (!p) continue;
      const payer = payerOf(mid);
      if (x.c > 0) ps.push({ member_id: payer, for_member_id: mid, kind: 'getraenke', text: `Verkauf bis ${deD(until)}${payer !== mid ? ` – ${p.first} ${p.last}` : ''}`, from: x.since, to: until, cents: x.c, due: rd });
    }
    bookRun('getraenke', rd, ps, batch);
  }
  for (const [mid, d] of firstUse) db.prepare('UPDATE mv_bank SET mandate_first_used = ?, mandate_last_used = ? WHERE member_id = ?').run(d, lastUse.get(mid), mid);

  /* ======================================================================= Spielbetrieb */
  const active = P.filter(p => isIn(p) && p.status === 'aktiv');
  const T = [];
  const addT = (name, g, a0, a1, ac, league, min) => T.push({ name, g, a0, a1, ac, league, min });
  [['Herren', 18, 45, 'H'], ['Herren 30', 30, 99, 'H30'], ['Herren 40', 40, 99, 'H40'], ['Herren 50', 50, 99, 'H50'], ['Herren 60', 60, 99, 'H60'], ['Damen', 18, 45, 'D'], ['Damen 30', 30, 99, 'D30'], ['Damen 40', 40, 99, 'D40'], ['Damen 50', 50, 99, 'D50']]
    .forEach(([n, a0, a1, ac], i) => { const k = [4, 3, 3, 2, 2, 3, 2, 2, 2][i]; for (let j = 1; j <= k; j++) addT(`${n} ${['I', 'II', 'III', 'IV'][j - 1]}`, ac[0] === 'H' ? 'm' : 'w', a0, a1, ac, pick(['Verbandsliga', 'Bezirksoberliga', 'Bezirksliga', 'Kreisliga', 'Kreisklasse']), n.length > 6 ? 4 : 6); });
  [['Herren 65', 'm', 65, 'H65'], ['Herren 70', 'm', 70, 'H70'], ['Damen 60', 'w', 60, 'D60']].forEach(([n, g, a0, ac]) => addT(n, g, a0, 99, ac, 'Bezirksliga', 4));
  [['Junioren U18 I', 'm', 13, 18, 'U18'], ['Junioren U18 II', 'm', 13, 18, 'U18'], ['Juniorinnen U18', 'w', 13, 18, 'U18'], ['Junioren U15', 'm', 10, 15, 'U15'], ['Juniorinnen U15', 'w', 10, 15, 'U15'], ['Mixed U12 I', null, 8, 12, 'U12'], ['Mixed U12 II', null, 8, 12, 'U12'], ['Mixed U10', null, 6, 10, 'U10']]
    .forEach(([n, g, a0, a1, ac]) => addT(n, g, a0, a1, ac, 'Kreisliga Jugend', 4));
  for (let i = 1; T.length < 39; i++) addT(`Hobbyrunde ${i}`, null, 18, 99, null, 'Freizeitrunde', 4);   // + 1 Mannschaft der Demo = 40
  const insTeam = db.prepare('INSERT INTO sp_team(name, league, season, min_players, captain_id, vice_id, import_key, active, sort, note, created_at, age_class) VALUES (?,?,?,?,?,?,?,1,?,NULL,?,?)');
  const insPl = db.prepare('INSERT OR IGNORE INTO sp_player(team_id, member_id, rank, created_at) VALUES (?,?,?,?)');
  const insGame = db.prepare(`INSERT INTO sp_game(team_id, date, start, home, opponent, venue, league, status, meet_time, meet_place, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Adminkonto',?,'spiel',0,1)`);
  const insAv = db.prepare('INSERT OR IGNORE INTO sp_avail(game_id, member_id, state, note, at) VALUES (?,?,?,?,?)');
  const insLu = db.prepare('INSERT OR IGNORE INTO sp_lineup(game_id, member_id, role, pos, by_user, at) VALUES (?,?,?,?,?,?)');
  const insExtM = db.prepare("INSERT INTO members(name, kind, active, created_at, first_name, last_name) VALUES (?, 'extern', 1, ?, ?, ?)");
  const insExt = db.prepare('INSERT INTO sp_extern(member_id, phone, club, token, created_by, created_at, last_seen, token_at) VALUES (?,?,?,?,?,?,?,?)');
  const OPP = ['TC Nachbarort', 'TV Beispielhausen', 'SV Musterdorf', 'TC Rot-Weiß Neuweiler', 'TSG Talheim', 'TC Blau-Gelb Musterberg', 'SC Am See', 'TC Waldhausen', 'TV Bergdorf', 'TC Grün-Gold Feldheim'];
  const seasonName = +TODAY.slice(5, 7) >= 4 && +TODAY.slice(5, 7) <= 9 ? `Sommer ${YEAR}` : `Winter ${+TODAY.slice(5, 7) >= 10 ? YEAR : YEAR - 1}/${String((+TODAY.slice(5, 7) >= 10 ? YEAR : YEAR - 1) + 1).slice(2)}`;
  const inTeams = new Map();
  let sat = TODAY; while (dow(sat) !== 6) sat = dayAdd(sat, -1);
  T.forEach((t, ti) => {
    let pool = active.filter(p => (!t.g || p.g === t.g) && p.age >= t.a0 && p.age <= t.a1 && (inTeams.get(p.id) || 0) < 2);
    if (pool.length < 6) pool = active.filter(p => (!t.g || p.g === t.g) && (t.a1 <= 18 ? p.age <= 18 : p.age >= 18));
    pool.sort((a, b) => (inTeams.get(a.id) || 0) - (inTeams.get(b.id) || 0) || rnd() - 0.5);
    const players = sample(pool.slice(0, Math.max(14, Math.floor(pool.length / 2))), ri(6, 12));
    players.forEach(p => inTeams.set(p.id, (inTeams.get(p.id) || 0) + 1));
    const ids = players.map(p => p.id);
    if (ti % 3 === 0) {   // Gastspieler/in
      const g = t.g || pick(['m', 'w']); const [f, l] = personName(g);
      const created = ts(dayAdd(TODAY, -ri(30, 200)), 19);
      const eid = Number(insExtM.run(`${f} ${l}`, created, f, l).lastInsertRowid);
      insExt.run(eid, `0170 555${String(ri(0, 9999)).padStart(4, '0')}`, pick(OPP), hex(24), 'Adminkonto', created, chance(0.5) ? ts(dayAdd(TODAY, -ri(1, 20)), 20) : null, created);
      ids.push(eid); count('sp_extern');
    }
    const cap = players[0].id, vice = players[1].id;
    const tid = Number(insTeam.run(t.name, t.league, seasonName, t.min, cap, vice, ascii(t.name).replace(/-/g, ''), (ti + 1) * 10, ts(dayAdd(TODAY, -ri(150, 300)), 18), t.ac).lastInsertRowid);
    count('sp_team');
    ids.forEach((m, i) => { insPl.run(tid, m, i + 1, ts(dayAdd(TODAY, -ri(100, 150)), 18)); count('sp_player'); });
    const first = dayAdd(sat, -7 * ri(4, 6) + (t.ac && t.ac[0] === 'D' ? 1 : 0));
    for (let gi = 0; gi < 10; gi++) {
      const day = dayAdd(first, gi * 7 + (gi > 4 ? 7 : 0)), past = day < TODAY, home = gi % 2 === 0 ? 1 : 0;
      const status = chance(0.04) ? 'abgesagt' : 'geplant';
      const gid = Number(insGame.run(tid, day, t.a1 <= 18 ? '14:00' : pick(['09:00', '10:00', '13:00']), home, `${pick(OPP)} ${pick(['1', '2', '3'])}`, home ? 'Anlage TC Grün-Weiß Musterstadt' : null, t.league, status,
        null, home ? null : 'Parkplatz Clubhaus', past && status === 'geplant' ? `${ri(0, t.min + 3)}:${ri(0, t.min + 3)}` : null, past ? 1 : 0, past ? 1 : 0, past ? ts(dayAdd(day, -3), 19) : null, ts(dayAdd(TODAY, -ri(100, 150)), 18)).lastInsertRowid);
      count('sp_game');
      const near = dayAdd(TODAY, 21) >= day;
      const yes = [];
      for (const m of ids) {
        if (!(past ? chance(0.92) : near ? chance(0.6) : chance(0.25))) continue;
        const st = chance(0.68) ? 'ja' : 'nein'; if (st === 'ja') yes.push(m);
        insAv.run(gid, m, st, st === 'nein' && chance(0.3) ? pick(['Urlaub', 'beruflich verhindert', 'verletzt', 'Familienfeier']) : null, ts(dayAdd(day, -ri(3, 14)), ri(8, 22), ri(0, 59))); count('sp_avail');
      }
      if (past || dayAdd(TODAY, 7) >= day) yes.slice(0, t.min + 1).forEach((m, i) => { insLu.run(gid, m, i < t.min ? 'spielt' : 'ersatz', i < t.min ? i + 1 : null, 'Adminkonto', ts(dayAdd(day, -2), 20)); count('sp_lineup'); });
    }
  });

  /* ======================================================================= Buchungssystem */
  const insRes = db.prepare("INSERT INTO bk_resource(kind, name, area, note, days, open_from, open_to, slot_min, max_min, quantity, active, sort, created_at, outsiders, outsider_fee_cents, deleted, partner_required, as_partner) VALUES ('platz',?,?,NULL,'1234567','08:00','22:00',?,120,1,1,?,?,'gebuehr',500,0,0,0)");
  for (const [n, s] of [['Platz 4', 50], ['Platz 5', 60], ['Platz 6', 70]]) insRes.run(n, 'Plätze', 60, s, ts(dayAdd(TODAY, -400), 10));
  const res = db.prepare('SELECT id, slot_min FROM bk_resource WHERE deleted = 0 AND active = 1 ORDER BY sort').all();
  count('bk_resource', res.length);
  const busy = new Map();   // `${res}|${day}` → Set von Viertelstunden
  const q = t => { const [h, m] = t.split(':').map(Number); return h * 4 + m / 15; };
  const free = (r, day, s, e) => { const b = busy.get(`${r}|${day}`); if (!b) return true; for (let x = q(s); x < q(e); x++) if (b.has(x)) return false; return true; };
  const take = (r, day, s, e) => { const k = `${r}|${day}`; const b = busy.get(k) || new Set(); for (let x = q(s); x < q(e); x++) b.add(x); busy.set(k, b); };
  const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const insBk = db.prepare(`INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, partners, guests, fee_cents, series_id, title, note, status, source, created_by, created_at, cancelled_at, cancelled_by, cancel_reason, booked_by_id, label_id, solo, reminded)
    VALUES (?,?,?,?,?,?,?,'[]',0,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`);
  const insSer = db.prepare("INSERT INTO bk_series(type, title, resources, weekdays, start, end, from_date, to_date, member_id, note, active, created_by, created_at, label_id, rule) VALUES (?,?,?,?,?,?,?,?,?,NULL,1,'Adminkonto',?,?,?)");
  const rule = JSON.stringify({ freq: 'weekly', interval: 1, monthly: 'day' });
  const bkFrom = dayAdd(TODAY, -365), bkTo = dayAdd(TODAY, 30);
  const trainer = adults.slice(0, 6);
  const SER = [['serie', 'Training Herren', [res[0].id], '13', '18:00', '20:00', 1, trainer[0]], ['serie', 'Training Damen', [res[1].id], '24', '18:00', '20:00', 1, trainer[1]],
    ['serie', 'Jugendtraining', [res[2].id, res[3].id], '124', '15:00', '17:00', 1, trainer[2]], ['serie', 'Tenniskurs Anfänger', [res[4].id], '3', '10:00', '11:00', 4, trainer[3]],
    ['serie', 'Mannschaftstraining Damen 40', [res[5].id], '2', '19:00', '21:00', 1, trainer[4]], ['serie', 'Padel-Treff', [res[3].id], '5', '18:00', '19:30', 4, trainer[5]],
    ['sperre', 'Platzpflege', res.map(r => r.id), '1', '08:00', '10:00', 5, null], ['serie', 'Medenspiele Heim', [res[0].id, res[1].id, res[2].id], '6', '09:00', '14:00', 2, null]];
  for (const [type, title, rs, wd, s, e, label, mem] of SER) {
    const from = dayAdd(TODAY, -ri(150, 300)), to = dayAdd(TODAY, ri(30, 90));
    const sid = Number(insSer.run(type, title, JSON.stringify(rs), wd, s, e, from, to, mem ? mem.id : null, ts(from, 9), label, rule).lastInsertRowid); count('bk_series');
    for (let day = from; day <= bkTo && day <= to; day = dayAdd(day, 1)) {
      if (!wd.includes(String(dow(day)))) continue;
      for (const r of rs) {
        if (!free(r, day, s, e)) continue; take(r, day, s, e);
        insBk.run(r, day, s, e, type, mem ? mem.id : null, '[]', sid, title, null, 'aktiv', 'verwaltung', 'Adminkonto', ts(from, 9), null, null, null, null, label, day < TODAY ? 1 : 0); count('bk_booking'); count('bk_booking_' + type);
      }
    }
  }
  // einzelne Sperren (Saisonvorbereitung, Turnier)
  for (const [title, off, days, label] of [['Saisonvorbereitung', -210, 5, 5], ['Clubturnier', -80, 3, 3], ['Sperre wegen Unwetter', -40, 1, 5]]) {
    for (let i = 0; i < days; i++) { const day = dayAdd(TODAY, off + i); for (const r of res) { if (!free(r.id, day, '08:00', '22:00')) continue; take(r.id, day, '08:00', '22:00'); insBk.run(r.id, day, '08:00', '22:00', 'sperre', null, '[]', null, title, null, 'aktiv', 'verwaltung', 'Adminkonto', ts(dayAdd(day, -14), 10), null, null, null, null, label, 1); count('bk_booking'); count('bk_booking_sperre'); } }
  }
  // Platzbuchungen der Mitglieder (Einzel und Doppel)
  const playersBk = P.filter(p => isIn(p) && p.age >= 8 && p.depts.length);
  const bW = playersBk.map(p => [p, 0.2 + rnd() * 2]);
  for (let day = bkFrom; day <= bkTo; day = dayAdd(day, 1)) {
    const fut = day > TODAY ? Math.max(0.05, 1 - (Date.parse(day) - Date.parse(TODAY)) / 864e5 / 8) : 1;
    for (const r of res) {
      for (let h = 8; h < 22; h++) {
        const p = 0.42 * season(day) * (h >= 17 && h <= 20 ? 1.6 : h < 10 ? 0.5 : 0.8) * (dow(day) >= 6 ? 1.3 : 1) * fut;
        if (!chance(p / 2)) continue;
        const len = r.slot_min === 30 ? pick([60, 90]) : pick([60, 60, 120]);
        const s = hm(h * 60 + (r.slot_min === 30 && chance(0.3) ? 30 : 0)), e = hm(Math.min(22 * 60, q(s) * 15 + len));
        if (q(e) <= q(s) || !free(r.id, day, s, e)) continue; take(r.id, day, s, e);
        const who = weighted(bW), dbl = chance(0.3);
        const partners = sample(playersBk.filter(x => x.id !== who.id), dbl ? 3 : 1).map(x => x.id);
        const created = ts(dayAdd(day, -ri(0, 6)) > TODAY ? TODAY : dayAdd(day, -ri(0, 6)), ri(7, 21), ri(0, 59));
        const canc = chance(0.04);
        insBk.run(r.id, day, s, e, 'buchung', who.id, JSON.stringify(partners), null, null, null, 'aktiv', weighted([['app', 7], ['tablet', 2], ['verwaltung', 1]]), `${who.first} ${who.last}`, created > nowTs ? nowTs : created,
          null, null, null, who.id, null, day < TODAY ? 1 : 0);
        if (canc) db.prepare("UPDATE bk_booking SET status = 'storniert', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = last_insert_rowid()").run(created, `${who.first} ${who.last}`, pick(['Regen', 'krank', 'Termin verschoben']));
        count('bk_booking'); count('bk_booking_buchung');
      }
    }
  }
  const insRt = db.prepare("INSERT OR IGNORE INTO bk_rights(member_id, series, labels, note, updated_by, updated_at, for_others, all_labels) VALUES (?,1,'[]','Trainer','Adminkonto',?,1,1)");
  for (const t of trainer) insRt.run(t.id, nowTs);

  /* ======================================================================= Helferdienste */
  const insAE = db.prepare('INSERT INTO aw_event(kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, counts) VALUES (?,?,?,?,?,?,?,NULL,?,?,?,0,1)');
  const insSU = db.prepare('INSERT OR IGNORE INTO aw_signup(event_id, member_id, reminded, created_at) VALUES (?,?,?,?)');
  const insEn = db.prepare('INSERT INTO aw_entry(member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const helpers = P.filter(p => isIn(p) && p.age >= 16 && p.age <= 75);
  const AWT = [['arbeit', 'Plätze herrichten', 'Anlage'], ['arbeit', 'Hecke schneiden', 'Anlage'], ['arbeit', 'Clubhaus putzen', 'Clubhaus'], ['arbeit', 'Laub rechen', 'Anlage'], ['arbeit', 'Plätze winterfest machen', 'Anlage'],
    ['dienst', 'Turnieraufsicht', 'Clubhaus'], ['dienst', 'Kuchenverkauf', 'Terrasse'], ['dienst', 'Grillen beim Sommerfest', 'Terrasse'], ['sonstiges', 'Jugendcamp Betreuung', 'Anlage'], ['arbeit', 'Bewässerung prüfen', 'Anlage']];
  const stat = day => { const d = (Date.parse(TODAY) - Date.parse(day)) / 864e5; return d < 14 ? weighted([['offen', 6], ['bestaetigt', 4]]) : weighted([['bestaetigt', 92], ['abgelehnt', 3], ['offen', 5]]); };
  const entry = (m, ev, day, min, text, src, inAt = null, outAt = null) => {
    const st = stat(day);
    insEn.run(m, ev, day, min, text, inAt, outAt, st, src, src === 'verwaltung' ? 'Adminkonto' : null, st === 'offen' ? null : 'Adminkonto', st === 'offen' ? null : ts(dayAdd(day, ri(1, 10)) > TODAY ? TODAY : dayAdd(day, ri(1, 10)), 20),
      st === 'abgelehnt' ? 'nicht nachvollziehbar' : null, ts(day, 21, ri(0, 59)));
    count('aw_entry');
  };
  for (let i = 0; i < 150; i++) {
    const [kind, title, place] = pick(AWT), day = dayAdd(TODAY, ri(-330, 30)), sh = pick([9, 10, 14, 17]), dur = pick([2, 3, 4]);
    const slots = ri(4, 12), canc = chance(0.03) ? 1 : 0;
    const ev = Number(insAE.run(kind, title, day, `${pad(sh)}:00`, `${pad(sh + dur)}:00`, place, slots, canc, 'Adminkonto', ts(dayAdd(day, -ri(10, 40)) > TODAY ? TODAY : dayAdd(day, -ri(10, 40)), 19)).lastInsertRowid);
    count('aw_event');
    const su = sample(helpers, Math.round(slots * (0.5 + rnd() * 0.6)));
    for (const p of su) { insSU.run(ev, p.id, day < TODAY ? 1 : 0, ts(dayAdd(day, -ri(1, 9)) > TODAY ? TODAY : dayAdd(day, -ri(1, 9)), ri(8, 22), ri(0, 59))); count('aw_signup'); }
    if (day < TODAY && !canc) for (const p of su) if (chance(0.9)) entry(p.id, ev, day, dur * 60 + pick([-30, 0, 0, 0, 30]), null, 'verwaltung');
  }
  const theke = db.prepare("SELECT id FROM aw_event WHERE permanent = 1 AND kind = 'theke'").get().id;
  const thekeH = sample(helpers, 120);
  for (let day = dayAdd(TODAY, -365); day < TODAY; day = dayAdd(day, 1)) {   // Thekendienst über das Tablet (Ein-/Ausstempeln)
    const n = Math.round(4 * season(day) * (dow(day) >= 5 ? 1.5 : 0.7) * rnd());
    for (let i = 0; i < n; i++) { const p = pick(thekeH), h = ri(16, 19), min = ri(90, 240); const inAt = ts(day, h, ri(0, 59)); const out = new Date(Date.parse(inAt.replace(' ', 'T')) + min * 6e4);
      entry(p.id, theke, day, min, null, 'tablet', inAt, `${fmt(out)} ${pad(out.getHours())}:${pad(out.getMinutes())}:00`); }
  }
  const FREE = ['Rasen gemäht', 'Netze geflickt', 'Linien nachgezogen', 'Einkauf für Clubhaus', 'Webseite gepflegt', 'Material sortiert', 'Fahrdienst Jugend'];
  while ((N.aw_entry || 0) < 3000) { const day = dayAdd(TODAY, -ri(1, 365)); entry(pick(helpers).id, null, day, pick([30, 60, 60, 90, 120, 180]), pick(FREE), chance(0.7) ? 'app' : 'verwaltung'); }

  /* ======================================================================= Buchhaltung */
  const FIRMEN = ['Bäckerei Beispiel', 'Autohaus Muster', 'Malerbetrieb Pinsel & Söhne', 'Sanitär Tropf', 'Getränkehandel Muster', 'Steuerbüro Zahl', 'Zahnarztpraxis Lächeln', 'Elektro Funke', 'Gärtnerei Grünzeug',
    'Versicherungsbüro Sicher', 'Fahrschule Spur', 'Pizzeria Beispiel', 'Optik Klarblick', 'Physiotherapie Bewegung', 'Druckerei Papier', 'Metzgerei Muster', 'Blumen Blüte', 'Immobilien Dach', 'Reisebüro Fernweh', 'Holzbau Balken',
    'Apotheke am Markt', 'Buchhandlung Seite', 'Café Bohne', 'Sport Muster', 'Schreinerei Hobel'];
  const insPa = db.prepare("INSERT INTO bh_partner(name, contact, street, zip, city, country, email, phone, customer_no, items, note, active, created_at) VALUES (?,?,?,?,?,'Deutschland',?,?,?,?,NULL,1,?)");
  const partners = FIRMEN.map((n, i) => {
    const adr = address(), [f, l] = personName(chance(0.5) ? 'm' : 'w');
    const items = [{ text: pick(['Bandenwerbung', 'Anzeige Vereinsheft', 'Trikotwerbung', 'Werbetafel Platz ' + ri(1, 6)]), qty: 1, unit_cents: pick([15000, 25000, 40000, 60000]), vat: 19 }];
    const id = Number(insPa.run(`${n} GmbH`, `${f} ${l}`, adr.street, adr.zip, adr.city, `info@${ascii(n)}.example.org`, `0123 ${ri(100000, 999999)}`, `K-${1001 + i}`, JSON.stringify(items), ts(dayAdd(TODAY, -ri(200, 700)), 10)).lastInsertRowid);
    count('bh_partner'); return { id, name: `${n} GmbH`, contact: `${f} ${l}`, ...adr, email: `info@${ascii(n)}.example.org`, items };
  });
  const insInv = db.prepare(`INSERT INTO bh_invoice(no, year, kind, partner_id, member_id, recipient, date, due_date, period, intro, note, items, net, vat, gross, small_business, status, paid_at, paid_via, sent_at, reminders, reminded_at, charge_id, yearly, cancel_reason, created_by, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL,?,?,?,?,0,?,?,?,?,?,?,?,?,?,'Adminkonto',?)`);
  const invNo = new Map(), donNo = new Map();
  const nextNo = (map, pre, y) => { const n = (map.get(y) || 0) + 1; map.set(y, n); return `${pre}${y}-${String(n).padStart(4, '0')}`; };
  const invDays = Array.from({ length: 200 }, () => dayAdd(TODAY, -ri(0, 364))).sort();
  const memberInv = P.filter(p => isIn(p) && !p.payer && p.age >= 18);
  for (const day of invDays) {
    const y = +day.slice(0, 4), toMember = chance(0.35);
    let items, recipient, pid = null, mid = null;
    if (toMember) { const p = pick(memberInv); mid = p.id; recipient = { name: `${p.first} ${p.last}`, street: p.adr.street, zip: p.adr.zip, city: p.adr.city, country: '', email: `${ascii(p.first)}.${ascii(p.last)}@example.org`, member_no: p.no, payment: p.payment };
      items = [{ text: pick(['Trainerstunden', 'Hallenmiete Winter', 'Schlüsselkaution', 'Vereinskleidung', 'Platzmiete Turnier']), qty: ri(1, 10), unit_cents: pick([1500, 2500, 3000, 4500]), vat: 19 }]; }
    else { const pa = pick(partners); pid = pa.id; recipient = { name: pa.name, contact: pa.contact, street: pa.street, zip: pa.zip, city: pa.city, country: '', email: pa.email }; items = pa.items; }
    const net = items.reduce((s, it) => s + it.qty * it.unit_cents, 0), vat = Math.round(net * 0.19);
    const due = dayAdd(day, 14), st = chance(0.04) ? 'storniert' : due < TODAY && chance(0.85) ? 'bezahlt' : 'offen';
    const rem = st === 'offen' && due < TODAY ? ri(0, 2) : 0;
    let chargeId = null;
    const no = nextNo(invNo, 'R-', y);
    const id = Number(insInv.run(no, y, toMember ? 'member' : 'partner', pid, mid, JSON.stringify(recipient), day, due, toMember ? null : String(y), JSON.stringify(items), net, vat, net + vat, st,
      st === 'bezahlt' ? (dayAdd(due, -ri(0, 10)) > TODAY ? TODAY : dayAdd(due, -ri(0, 10))) : null, st === 'bezahlt' ? (toMember ? 'Mitgliederverwaltung' : 'Überweisung') : null, ts(day, 11), rem, rem ? dayAdd(due, 10) : null, null,
      toMember ? null : y, st === 'storniert' ? 'doppelt erstellt' : null, ts(day, 10, ri(0, 59))).lastInsertRowid);
    if (toMember) {
      chargeId = Number(insCh.run(mid, mid, 'sonstiges', `Rechnung ${no}: ${items[0].text}`, null, null, net + vat, due, st === 'storniert' ? 'storniert' : st, st === 'bezahlt' ? due : null, st === 'bezahlt' ? 'ueberweisung' : null, null, null, null,
        `bh-inv-${id}`, 0, null, 0, null, ts(day, 10), null).lastInsertRowid);
      db.prepare('UPDATE bh_invoice SET charge_id = ? WHERE id = ?').run(chargeId, id); count('mv_charge');
    }
    count('bh_invoice');
  }
  const insDon = db.prepare("INSERT INTO bh_donation(no, year, donor_type, member_id, partner_id, donor, kind, date, cents, item, sach_origin, sach_docs, status, sent_at, cancel_reason, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Adminkonto',?)");
  const donDays = Array.from({ length: 100 }, () => dayAdd(TODAY, -ri(1, 364))).sort();
  for (const day of donDays) {
    const y = +day.slice(0, 4), type = weighted([['member', 6], ['partner', 3], ['einmalig', 1]]), kind = weighted([['geld', 8], ['sach', 1], ['verzicht', 1]]);
    let donor, mid = null, pid = null;
    if (type === 'member') { const p = pick(memberInv); mid = p.id; donor = { name: `${p.first} ${p.last}`, street: p.adr.street, zip: p.adr.zip, city: p.adr.city, email: '' }; }
    else if (type === 'partner') { const pa = pick(partners); pid = pa.id; donor = { name: pa.name, street: pa.street, zip: pa.zip, city: pa.city, email: pa.email }; }
    else { const [f, l] = personName(chance(0.5) ? 'm' : 'w'); const adr = address(); donor = { name: `${f} ${l}`, ...adr, email: `${ascii(f)}.${ascii(l)}@example.org` }; }
    const item = kind === 'sach' ? pick(['Ballmaschine, 3 Jahre alt, guter Zustand, Kaufpreis 900 €', 'Sitzbänke (4 Stück), neu', 'Kaffeemaschine für das Clubhaus, neuwertig']) : kind === 'verzicht' ? `Fahrtkosten Mannschaftsfahrt am ${deD(day)}` : null;
    const st = chance(0.03) ? 'storniert' : 'aktiv';
    insDon.run(nextNo(donNo, 'SQ-', y), y, type, mid, pid, JSON.stringify(donor), kind, day, pick([2500, 5000, 10000, 20000, 25000, 50000, 100000]), item, kind === 'sach' ? pick(['betrieb', 'privat']) : null, kind === 'sach' ? 1 : 0, st,
      chance(0.8) ? ts(dayAdd(day, ri(1, 20)) > TODAY ? TODAY : dayAdd(day, ri(1, 20)), 12) : null, st === 'storniert' ? 'falscher Betrag' : null, ts(day, 12, ri(0, 59)));
    count('bh_donation');
  }
});
run();

/* ---------- Prüfung ---------- */
const fk = db.prepare('PRAGMA foreign_key_check').all();
const ic = db.prepare('PRAGMA integrity_check').get();
db.pragma('wal_checkpoint(TRUNCATE)'); db.pragma('journal_mode = DELETE');
const tabs = ['members', 'mv_person', 'mv_bank', 'mv_member_fee', 'mv_member_department', 'mv_charge', 'mv_collection', 'mv_run', 'bookings', 'member_settlements', 'events', 'event_guests', 'deliveries',
  'sp_team', 'sp_player', 'sp_extern', 'sp_game', 'sp_avail', 'sp_lineup', 'bk_resource', 'bk_series', 'bk_booking', 'aw_event', 'aw_signup', 'aw_entry', 'bh_partner', 'bh_invoice', 'bh_donation'];
const rows = Object.fromEntries(tabs.map(t => [t, db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n]));
const extra = {
  'Mitglieder (kind mitglied)': db.prepare("SELECT COUNT(*) n FROM members WHERE kind = 'mitglied' AND deleted = 0").get().n,
  'Familien (Oberhäupter)': db.prepare('SELECT COUNT(DISTINCT family_of) n FROM mv_person WHERE family_of IS NOT NULL').get().n,
  'Forderungen offen': db.prepare("SELECT COUNT(*) n FROM mv_charge WHERE status = 'offen'").get().n,
  'Getränkebuchungen offen (nicht abgerechnet)': db.prepare("SELECT COUNT(*) n FROM bookings WHERE kind = 'konto' AND cancelled_at IS NULL AND settled_id IS NULL").get().n,
  'Platzbuchungen nach Art': db.prepare('SELECT type, COUNT(*) n FROM bk_booking GROUP BY type').all().map(r => `${r.type} ${r.n}`).join(', '),
  'Stundeneinträge nach Status': db.prepare('SELECT status, COUNT(*) n FROM aw_entry GROUP BY status').all().map(r => `${r.status} ${r.n}`).join(', '),
};
db.close();
console.log('Zeilen:', JSON.stringify(rows));
for (const [k, v] of Object.entries(extra)) console.log(`  ${k}: ${v}`);
console.log(`foreign_key_check: ${fk.length ? JSON.stringify(fk.slice(0, 5)) + ` (${fk.length})` : 'leer'} · integrity_check: ${ic.integrity_check}`);
console.log(`Großer Musterverein erzeugt in ${((Date.now() - T0) / 1000).toFixed(1)} s → ${dir}`);
if (fk.length || ic.integrity_check !== 'ok') process.exit(3);
