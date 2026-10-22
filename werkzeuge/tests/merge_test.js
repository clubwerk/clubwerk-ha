// Mitglied zusammenführen / löschen mit Modul-Daten (Mitgliederverwaltung, Buchungssystem, Helferdienste) – keine FK-Fehler,
// keine verwaisten Zeilen; Zielkonto nur echte Konten; „Inaktive entfernen“.  node merge_test.js <S>   (Ports 3340/5340/5341)
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_merge'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3340/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ck = '';
async function A(url, method = 'GET', body, { raw, headers = {} } = {}) {
  const h = { 'X-Clubwerk': '1', Cookie: ck, ...headers }; if (body !== undefined) h['Content-Type'] = raw ? 'application/octet-stream' : 'application/json';
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  let j = {}; try { j = await r.json(); } catch (e) { /* */ } return [r.status, j];
}
const X = p => 'api/admin/x/mitglieder/' + p;
const iso = d => d.toISOString().slice(0, 10);
const addD = (n) => iso(new Date(Date.now() + n * 86400000));
let srv;
/** Mitglied über die Mitgliederverwaltung anlegen – mit Beitrag und Bank (Lastschrift) */
let fee = null;
async function newPerson(first, last, iban) {
  if (!fee) { const [, m] = await A(X('meta')); const f = (m.fees || []).find(x => x.active && x.kind !== 'zusatz' && x.age_min == null && x.age_max == null); fee = f ? f.id : (await A(X('fees'), 'POST', { name: 'Testbeitrag', cents: 1000, interval: 'jahr', kind: 'grund' }))[1].id; }
  const doc = await fetch(B + X('member/new-document'), { method: 'POST', headers: { 'X-Clubwerk': '1', Cookie: ck, 'Content-Type': 'application/octet-stream', 'X-Filename': 'antrag.pdf' }, body: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)) }).then(r => r.json());
  const body = { doc_id: doc.doc_id, first_name: first, last_name: last, birth_date: '1980-01-01', street: 'Weg 1', zip: '12345', city: 'Ort', email: `${first.toLowerCase()}.${last.toLowerCase()}@test.de`, mobile: '0170 1234567', fee_id: fee, payment: iban ? 'lastschrift' : 'rechnung' };
  if (iban) Object.assign(body, { iban, holder: `${first} ${last}`, mandate_date: addD(-10) });
  return A(X('member'), 'POST', body);
}
/** Zeilen je Tabelle für ein Mitglied – direkt in der Datenbank (alle Spalten mit Fremdschlüssel auf members plus die ohne) */
function dbCounts(id) {
  const Database = require(APP + '/node_modules/better-sqlite3');
  const db = new Database(DATA + '/clubwerk.db', { readonly: true });
  const { memberRefs } = { memberRefs: () => { const out = []; for (const t of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'members'").all()) for (const fk of db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all()) if (fk.table === 'members') out.push([t.name, fk.from]); return out; } };
  const extra = [['mv_history', 'member_id'], ['mv_age_notice', 'member_id'], ['bk_wait', 'member_id'], ['bk_series', 'member_id'], ['admin_users', 'member_id'], ['mail_recipient', 'member_id']];
  const out = {};
  for (const [t, c] of [...memberRefs(), ...extra]) { try { const n = db.prepare(`SELECT COUNT(*) n FROM "${t}" WHERE "${c}" = ?`).get(id).n; if (n) out[`${t}.${c}`] = n; } catch (e) { /* Tabelle fehlt */ } }
  const member = db.prepare('SELECT id, name, deleted, active FROM members WHERE id = ?').get(id);
  const fk = db.prepare('PRAGMA foreign_key_check').all();
  db.close();
  return { rows: out, member, fkViolations: fk.length };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Beiträge eines Mitglieds beenden (Ende gestern; Beginn davor, damit das Ende nicht vor dem Beginn liegt) */
async function endFees(id) {
  const [, d] = await A(X('member/' + id)); let n = 0;
  for (const f of (d && d.fees) || []) if (!f.end_date) { const [st] = await A(X('mf/' + f.id), 'PUT', { start_date: addD(-30), end_date: addD(-1) }); if (st === 200) n++; }
  return n;
}
(async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3340', BEREGNUNG_PORT: '5340', MEMBER_PORT: '5341', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/merge_srv.log', 'w'), fs.openSync(S + '/merge_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true, buchung: true, arbeitseinsatz: true, buchhaltung: true } }); ok('Setup', s === 200, JSON.stringify(j));
  // A (Duplikat, am Tablet angelegt) mit Daten in der Mitgliederverwaltung, B = richtiges Konto, C = eigenständig mit Modul-Daten
  [s, j] = await newPerson('Anna', 'Doppelt', 'DE02120300000000202051'); const A_ID = j.id; ok('A angelegt (Mitgliederverwaltung, Beitrag + Bank)', s === 200 && A_ID, JSON.stringify(j));
  [s, j] = await A('api/admin/members', 'POST', { name: 'Anna Richtig', kind: 'mitglied' }); const B_ID = j.id; ok('B angelegt (Konto)', s === 200 && B_ID);
  [s, j] = await newPerson('Carl', 'Allein', 'DE02500105170137075030'); const C_ID = j.id; ok('C angelegt', s === 200 && C_ID);
  [s, j] = await A('api/admin/members', 'POST', { name: 'Dora Kind', kind: 'mitglied' }); const D_ID = j.id;
  // Familie: Dora zahlt über Anna Doppelt (payer_id → A); C zahlt über niemanden; Carl hat Angehörige? Dora zweites Kind zahlt über C
  [s, j] = await A(X(`member/${D_ID}/payer`), 'PUT', { payer_id: A_ID }); ok('Dora zahlt über A', s === 200, JSON.stringify(j));
  // Buchungssystem: Platz buchen für A und C, Sonderrecht für A und B (UNIQUE-Konflikt beim Zusammenführen), Warteliste für A
  [s, j] = await A('api/admin/x/buchung/meta'); const platz = j.resources[0].id;
  // d1 liegt in der Vergangenheit: seit dem sicheren Löschen sperren nur kommende Buchungen – so bleibt C als Mitspieler einer
  // früheren Buchung stehen und der Test prüft weiter, dass das Löschen ihn aus der Mitspieler-Liste entfernt
  const d1 = addD(-2), d2 = addD(3);
  [s, j] = await A('api/admin/x/buchung/bookings', 'POST', { resource_id: platz, date: d1, start: '10:00', end: '11:00', member_id: A_ID, partners: [C_ID] }); ok('Buchung A (+ C als Mitspieler)', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/x/buchung/bookings', 'POST', { resource_id: platz, date: d2, start: '10:00', end: '11:00', member_id: C_ID, partners: [A_ID] }); ok('Buchung C (+ A als Mitspieler)', s === 200, JSON.stringify(j));
  const bkC = j.id;
  [s, j] = await A('api/admin/x/buchung/rights', 'PUT', { member_id: A_ID, series: true }); ok('Sonderrecht A', s === 200);
  [s, j] = await A('api/admin/x/buchung/rights', 'PUT', { member_id: B_ID, series: true }); ok('Sonderrecht B', s === 200);
  // Helferdienste: Stunden für A und C, Befreiung und Pflichtstunden (PRIMARY KEY) für A und B
  [s, j] = await A('api/admin/x/arbeitseinsatz/entries', 'POST', { member_ids: [A_ID, C_ID], date: addD(-1), minutes: 120, text: 'Platzpflege' }); ok('Helferstunden A + C', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/x/arbeitseinsatz/exempt', 'PUT', { member_id: A_ID, note: 'Trainer' }); ok('A befreit', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/x/arbeitseinsatz/exempt', 'PUT', { member_id: B_ID, note: 'Vorstand' }); ok('B befreit', s === 200);
  // Verkauf: Buchungen für A
  [s, j] = await A('api/admin/articles'); const art = j.find(a => a.active).id;
  [s, j] = await A('api/admin/bookings', 'POST', { memberId: A_ID, articleId: art, qty: 2 }); ok('Getränkebuchung A', s === 200, JSON.stringify(j));
  const before = dbCounts(A_ID); ok('A hat Modul-Daten in mehreren Tabellen', Object.keys(before.rows).length >= 8, JSON.stringify(before.rows));

  /* ---- Zusammenführen A → B ---- */
  [s, j] = await A(`api/admin/members/${A_ID}/merge`, 'POST', { intoId: 1 }); ok('Zusammenführen in Sonderkonto „Verein“ abgelehnt (400)', s === 400, s + ' ' + JSON.stringify(j));
  [s, j] = await A(`api/admin/members/${A_ID}/merge`, 'POST', { intoId: A_ID }); ok('Zusammenführen mit sich selbst abgelehnt', s === 400);
  [s, j] = await A(`api/admin/members/${A_ID}/merge`, 'POST', { intoId: B_ID }); ok('Zusammenführen A → B: 200', s === 200 && j.ok && j.moved === 1, s + ' ' + JSON.stringify(j));
  const afterA = dbCounts(A_ID), afterB = dbCounts(B_ID);
  ok('A ist weg (Datensatz gelöscht)', !afterA.member, JSON.stringify(afterA.member));
  ok('Keine Zeile verweist mehr auf A', !Object.keys(afterA.rows).length, JSON.stringify(afterA.rows));
  ok('Keine Fremdschlüssel-Verletzung', afterA.fkViolations === 0, String(afterA.fkViolations));
  ok('B hat jetzt Vereinsdaten, Beitrag, Bank, Buchungen, Helferstunden', ['mv_person.member_id', 'mv_member_fee.member_id', 'mv_bank.member_id', 'bk_booking.member_id', 'aw_entry.member_id', 'bookings.member_id', 'mv_document.member_id'].every(k => afterB.rows[k]), JSON.stringify(afterB.rows));
  ok('UNIQUE-Konflikte (Sonderrecht, Befreiung) aufgelöst: je genau eine Zeile bei B', afterB.rows['bk_rights.member_id'] === 1 && afterB.rows['aw_exempt.member_id'] === 1, JSON.stringify(afterB.rows));
  ok('Dora zahlt jetzt über B', afterB.rows['mv_person.payer_id'] === 1, JSON.stringify(afterB.rows));
  [s, j] = await A(X(`member/${B_ID}`)); ok('Mitgliederverwaltung zeigt B mit Verlauf „Zusammengeführt“', s === 200 && j.history.some(h => h.field === 'Zusammengeführt'), JSON.stringify((j.history || []).map(h => h.field)));
  ok('IBAN bei B', j.bank && j.bank.iban === 'DE02120300000000202051', JSON.stringify(j.bank));
  [s, j] = await A(`api/admin/x/buchung/bookings?from=${d1}&to=${d2}`); const bk = j.find(x => x.id === bkC);
  ok('Mitspieler-Liste: A → B', bk && bk.partners.includes(B_ID) && !bk.partners.includes(A_ID), JSON.stringify(bk && bk.partners));
  [s, j] = await A('api/admin/members'); ok('Mitgliederliste ohne A, mit B (1 Buchung)', !j.rows.some(r => r.id === A_ID) && j.rows.find(r => r.id === B_ID).bookings === 1, JSON.stringify(j.rows.map(r => [r.id, r.name, r.bookings])));

  /* ---- Löschen C (ohne Getränkebuchungen → endgültig) ---- */
  const beforeC = dbCounts(C_ID); ok('C hat Modul-Daten', Object.keys(beforeC.rows).length >= 5, JSON.stringify(beforeC.rows));
  // sicheres Löschen: erst 409 mit den Gründen, nichts verändert; dann Verknüpfungen lösen
  [s, j] = await A(`api/admin/members/${C_ID}`, 'DELETE');
  ok('Löschen C mit Verknüpfungen: 409 (kommende Buchung, Beitrag)', s === 409 && (j.links || []).some(t => /^1 kommende Buchung \(Buchungssystem\)$/.test(t)) && (j.links || []).some(t => /^Beitrag zugeordnet/.test(t)), s + ' ' + JSON.stringify(j));
  ok('… nichts verändert', same(dbCounts(C_ID), beforeC), JSON.stringify(dbCounts(C_ID)));
  [s, j] = await A(`api/admin/x/buchung/bookings/${bkC}/cancel`, 'POST', {}); ok('Kommende Buchung von C storniert', s === 200, JSON.stringify(j));
  ok('Beitrag von C beendet (gestern)', await endFees(C_ID) === 1);
  [s, j] = await A(`api/admin/members/${C_ID}`, 'DELETE'); ok('Löschen C: 200', s === 200 && j.ok && !j.kept, s + ' ' + JSON.stringify(j));
  const afterC = dbCounts(C_ID);
  ok('C ist weg', !afterC.member, JSON.stringify(afterC.member));
  ok('Keine verwaisten Zeilen für C', !Object.keys(afterC.rows).length, JSON.stringify(afterC.rows));
  ok('Keine Fremdschlüssel-Verletzung nach Löschen', afterC.fkViolations === 0);
  const afterB2 = dbCounts(B_ID); ok('B’s eigene Buchung bleibt (die von C ist weg)', afterB2.rows['bk_booking.member_id'] === 1, JSON.stringify(afterB2.rows));
  [s, j] = await A(`api/admin/x/buchung/bookings?from=${d1}&to=${d2}`); ok('Mitspieler C aus der Buchung von B entfernt', j.every(x => !(x.partners || []).includes(C_ID)), JSON.stringify(j.map(x => x.partners)));

  /* ---- Löschen mit Verlauf (B hat Getränkebuchungen → wird nur ausgeblendet, Modul-Daten werden entfernt) ---- */
  const beforeB = dbCounts(B_ID);
  // seit dem sicheren Löschen: 409 mit Gründen statt 400 (offener Betrag ist einer davon)
  [s, j] = await A(`api/admin/members/${B_ID}`, 'DELETE'); ok('B hat offene Beträge → Löschen abgelehnt', s === 409 && (j.links || []).some(t => /^Offener Betrag im Verkauf: /.test(t)), s + ' ' + JSON.stringify(j));
  ok('… weitere Gründe: Beitrag, „Zahlt für“', (j.links || []).some(t => /^Beitrag zugeordnet/.test(t)) && (j.links || []).some(t => /^Zahlt für: Kind, Dora/.test(t)), JSON.stringify(j.links));
  ok('… nichts verändert', same(dbCounts(B_ID), beforeB), JSON.stringify(dbCounts(B_ID)));
  ok('Beitrag von B beendet (gestern)', await endFees(B_ID) === 1);
  [s, j] = await A(X(`member/${D_ID}/payer`), 'PUT', { payer_id: null }); ok('Dora zahlt nicht mehr über B', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/settle', 'POST', { asOf: new Date(Date.now() + 1000).toISOString().slice(0, 19).replace('T', ' '), upTo: 999999 });
  // asOf darf nicht in der Zukunft liegen – Stand aus der Liste nehmen
  [s, j] = await A('api/admin/balances'); [s, j] = await A('api/admin/settle', 'POST', { asOf: j.asOf, upTo: j.upTo }); ok('B abgerechnet', s === 200, JSON.stringify(j));
  [s, j] = await A(`api/admin/members/${B_ID}`, 'DELETE'); ok('Löschen B (mit Buchungen): 200, bleibt ausgeblendet', s === 200 && j.kept, s + ' ' + JSON.stringify(j));
  const afterB3 = dbCounts(B_ID);
  ok('B als gelöscht markiert', afterB3.member && afterB3.member.deleted === 1, JSON.stringify(afterB3.member));
  ok('Verlauf bleibt (Buchungen, Abrechnung), Modul-Daten weg', afterB3.rows['bookings.member_id'] === 1 && afterB3.rows['member_settlements.member_id'] === 1 && !afterB3.rows['mv_person.member_id'] && !afterB3.rows['bk_booking.member_id'] && !afterB3.rows['aw_entry.member_id'], JSON.stringify(afterB3.rows));
  ok('Keine Fremdschlüssel-Verletzung', afterB3.fkViolations === 0);
  [s, j] = await A(`api/admin/members/${B_ID}`, 'PUT', { active: true }); ok('Gelöschtes Konto lässt sich nicht wieder einblenden (404)', s === 404, s);
  [s, j] = await A('api/admin/bookings', 'POST', { memberId: B_ID, articleId: art, qty: 1 }); ok('Keine Nachbuchung auf gelöschtes Konto', s === 400, s + ' ' + JSON.stringify(j));

  /* ---- „Inaktive entfernen“ mit Modul-Daten ---- */
  [s, j] = await newPerson('Emil', 'Inaktiv'); const E_ID = j.id;
  [s, j] = await A('api/admin/x/arbeitseinsatz/entries', 'POST', { member_ids: [E_ID], date: addD(-1), minutes: 60, text: 'Zaun' });
  const beforeE = dbCounts(E_ID);
  [s, j] = await A(`api/admin/members/remove-inactive`, 'POST', { ids: [E_ID] });
  ok('Inaktive entfernen: E mit Beitrag übersprungen („noch verknüpft“)', s === 200 && j.deleted === 0 && (j.skipped || []).some(t => /Emil Inaktiv \(noch verknüpft\)/.test(t)), s + ' ' + JSON.stringify(j));
  ok('… nichts verändert', same(dbCounts(E_ID), beforeE), JSON.stringify(dbCounts(E_ID)));
  ok('Beitrag von E beendet (gestern)', await endFees(E_ID) === 1);
  [s, j] = await A(`api/admin/members/remove-inactive`, 'POST', { ids: [E_ID, D_ID] }); ok('Inaktive entfernen: 200', s === 200 && j.deleted === 2, s + ' ' + JSON.stringify(j));
  const afterE = dbCounts(E_ID);
  ok('E endgültig weg, keine verwaisten Zeilen', !afterE.member && !Object.keys(afterE.rows).length && afterE.fkViolations === 0, JSON.stringify(afterE));
  // Protokoll
  [s, j] = await A('api/admin/audit'); ok('Protokoll: zusammengeführt, gelöscht', j.some(a => a.action === 'Konten zusammengeführt') && j.filter(a => a.action === 'Konto gelöscht').length === 2, '');
  const log = fs.readFileSync(S + '/merge_srv.log', 'utf8'); ok('Keine Fehler im Serverprotokoll', !/FOREIGN KEY|SQLITE_CONSTRAINT|TypeError/.test(log), log.split('\n').filter(l => /FOREIGN|SQLITE|Error/.test(l)).slice(0, 3).join(' | '));
  srv.kill(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
