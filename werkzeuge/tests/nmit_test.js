// Kontoart „Kein Mitglied“ (z. B. Trainer) und „Mitglied nur über die Mitgliederverwaltung“, Lastschrift-Pflicht, beitragsfrei (0 €).
// Startet den Server selbst.  node nmit_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_nmit'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3300/'; let fails = 0;
const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ck = '';
async function A(url, method = 'GET', body, { raw, headers = {} } = {}) {
  const h = { 'X-Clubwerk': '1', Cookie: ck, ...headers };
  if (body !== undefined) h['Content-Type'] = raw ? 'application/octet-stream' : 'application/json';
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  let j = {}; try { j = await r.json(); } catch (e) { /* */ } return [r.status, j];
}
const T = (url, body) => A(url, 'POST', body);
const X = p => 'api/admin/x/mitglieder/' + p;
let fee = null;
async function newMember(b) {
  const doc = (await A(X('member/new-document'), 'POST', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)), { raw: true, headers: { 'X-Filename': 'antrag.pdf' } }))[1];
  return A(X('member'), 'POST', { doc_id: doc.doc_id, birth_date: '1980-01-01', street: 'Weg 1', zip: '12345', city: 'Ort', mobile: '0170 1234567', fee_id: fee,
    email: `${b.first_name.toLowerCase()}${Math.random().toString(36).slice(2, 6)}@test.de`, payment: 'rechnung', ...b });
}
const book = async (id, qty) => { const u = (await T('api/tablet/unlock', { memberId: id }))[1]; return T('api/tablet/book', { token: u.token, items: [{ articleId: art, qty }] }); };
const kindOf = async id => ((await A('api/admin/members'))[1].rows.find(r => r.id === id) || {}).kind;
let srv, art;
(async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3300', BEREGNUNG_PORT: '5309', MEMBER_PORT: '5311', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/nmit_srv.log', 'w'), fs.openSync(S + '/nmit_srv.log', 'a')] });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  /* ---------- 1. ohne Mitgliederverwaltung: alles wie bisher, dazu „Kein Mitglied“ ---------- */
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Grün-Weiß Musterstadt', password: 'Test-Kennwort-42', modules: { getraenke: true } }); ok('Setup nur Verkauf', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/articles', 'POST', { name: 'Apfelschorle', category: 'Alkoholfrei', price_cents: 150 }); art = j.id;
  [s, j] = await A('api/admin/members', 'POST', { name: 'Ina Alt', kind: 'mitglied' }); const ina = j.id; ok('ohne Mitgliederverwaltung: Mitglied im Verkauf anlegen geht', s === 200 && ina, JSON.stringify(j));
  [s, j] = await A('api/admin/members', 'POST', { name: 'Tom Trainer', kind: 'nichtmitglied' }); const tom = j.id; ok('Konto „Kein Mitglied“ anlegen', s === 200 && tom, JSON.stringify(j));
  /* ---------- 2. Mitgliederverwaltung einschalten ---------- */
  [s, j] = await A('api/admin/extensions/mitglieder', 'PUT', { active: true }); ok('Mitgliederverwaltung eingeschaltet', s === 200, JSON.stringify(j));
  [s, j] = await A(X('fees'), 'POST', { name: 'Erwachsene', cents: 12000, interval: 'jahr', kind: 'grund' }); fee = j.id;
  [s, j] = await A('api/admin/members', 'POST', { name: 'Max Muster', kind: 'mitglied' }); ok('jetzt: Mitglied im Verkauf anlegen abgelehnt', s === 400 && /Mitgliederverwaltung/.test(j.error), JSON.stringify(j));
  [s, j] = await A('api/admin/members', 'POST', { name: 'Uwe Übungsleiter', kind: 'nichtmitglied' }); const uwe = j.id; ok('… „Kein Mitglied“ weiter möglich', s === 200 && uwe, JSON.stringify(j));
  [s, j] = await A('api/admin/members/import', 'POST', { text: 'Hans Hinz\nKarl Kunz', kind: 'mitglied' }); ok('Liste einfügen als Mitglied abgelehnt', s === 400, JSON.stringify(j));
  [s, j] = await A('api/admin/members/import', 'POST', { text: 'Hans Hinz', kind: 'nichtmitglied' }); ok('Liste einfügen als „Kein Mitglied“', s === 200 && j.added === 1, JSON.stringify(j));
  [s, j] = await A(`api/admin/members/${tom}`, 'PUT', { kind: 'mitglied' }); ok('„Kein Mitglied“ → Mitglied im Verkauf abgelehnt', s === 400 && /Zusammenführen/.test(j.error), JSON.stringify(j));
  // Tablet: Trainer bucht wie ein Mitglied (erst PIN festlegen, dann auf sein Konto)
  { const u = (await T('api/tablet/unlock', { memberId: tom }))[1]; ok('Tablet: Trainer entsperrt (Personenkonto)', u.token && u.member && u.member.kind === 'nichtmitglied', JSON.stringify(u).slice(0, 200));
    [s, j] = await T('api/tablet/pin', { token: u.token, newPin: '4826' }); ok('… legt seine PIN fest', s === 200, JSON.stringify(j)); }
  { const u = (await T('api/tablet/unlock', { memberId: tom, pin: '4826' }))[1]; [s, j] = await T('api/tablet/book', { token: u.token, items: [{ articleId: art, qty: 2 }] });
    ok('… bucht auf sein Konto', s === 200 && j.total_cents === 300, JSON.stringify(j)); }
  [s, j] = await book(ina, 1); ok('Konto ohne Mitgliedsdaten bucht weiter', s === 200, JSON.stringify(j));
  // Verkauf › Abrechnung: Trainer erscheint mit Vorname/Nachname
  [s, j] = await A('api/admin/abtippliste');
  { const r = (j.rows || []).find(x => x.id === tom); ok('Abtippliste: Trainer als Person (Trainer, Tom)', r && r.first === 'Tom' && r.last === 'Trainer' && r.cents === 300, JSON.stringify(r || j).slice(0, 200)); }
  /* ---------- 3. Mitgliederverwaltung: Liste, Pflichtangaben, Umwandeln ---------- */
  [s, j] = await A(X('list'));
  const rows = j.rows || j;
  ok('Mitgliederliste: Trainer und „Kein Mitglied“ fehlen', Array.isArray(rows) && !rows.some(r => [tom, uwe].includes(r.id)), JSON.stringify(rows).slice(0, 200));
  { const r = rows.find(x => x.id === ina); ok('Konto ohne Daten erscheint mit Hinweis „ohne Mitgliedsdaten“', r && r.issues.includes('ohne Mitgliedsdaten'), JSON.stringify(r)); }
  [s, j] = await A(X('member/' + ina)); ok('Mitglied ohne Daten: Pflichtangaben fehlen (deutliche Meldung)', s === 200 && (j.missing || []).some(x => /Mitgliedsdaten/.test(x)) && j.missing.includes('Beitrag'), JSON.stringify(j.missing));
  // Beitragslauf mit Getränken: nur echte Mitglieder, die anderen bleiben offen (Hinweis)
  [s, j] = await newMember({ first_name: 'Eva', last_name: 'Echt' }); const eva = j.id; ok('echtes Mitglied angelegt', s === 200 && eva, JSON.stringify(j));
  await book(eva, 4);
  [s, j] = await A(X('runs/preview'), 'POST', { until: new Date().toISOString().slice(0, 10), drinks: true });
  const dr = (j.positions || []).filter(p => p.kind === 'getraenke');
  ok('Beitragslauf: Getränke nur für echte Mitglieder', dr.length === 1 && dr[0].for_member_id === eva, JSON.stringify(dr));
  ok('… Trainer und Konto ohne Daten als Hinweis „bleiben offen“', (j.info || []).some(t => /bleiben offen/.test(t) && /Trainer, Tom/.test(t) && /Alt, Ina/.test(t)), JSON.stringify(j.info));
  // Umwandeln: ohne Daten geht, mit Mitgliedsdaten nicht
  [s, j] = await A(`api/admin/members/${eva}`, 'PUT', { kind: 'nichtmitglied' }); ok('echtes Mitglied lässt sich nicht in „Kein Mitglied“ umwandeln', s === 400 && /Beitrag|Mitgliedsdaten/.test(j.error), JSON.stringify(j));
  [s, j] = await A(`api/admin/members/${ina}`, 'PUT', { kind: 'nichtmitglied' }); ok('Konto ohne Daten → „Kein Mitglied“', s === 200 && (await kindOf(ina)) === 'nichtmitglied', JSON.stringify(j));
  [s, j] = await A(X('list')); ok('… danach nicht mehr in der Mitgliederliste', !(j.rows || j).some(r => r.id === ina));
  /* ---------- 4. am Tablet neu eingetragen ---------- */
  [s, j] = await T('api/tablet/member', { name: 'Nina Neu' }); const nina = j.member && j.member.id; ok('am Tablet neu eingetragen', s === 200 && nina, JSON.stringify(j));
  [s, j] = await A(`api/admin/members/${nina}/confirm`, 'POST', {}); ok('Bestätigen als Mitglied abgelehnt (gehört in die Mitgliederverwaltung)', s === 400, JSON.stringify(j));
  [s, j] = await A(`api/admin/members/${nina}/confirm`, 'POST', { kind: 'nichtmitglied' }); ok('Als „Kein Mitglied“ bestätigt', s === 200 && (await kindOf(nina)) === 'nichtmitglied', JSON.stringify(j));
  /* ---------- 5. Lastschrift Pflicht ---------- */
  [s, j] = await A(X('settings'), 'PUT', { sepa_required: true }); ok('Einstellung „Lastschrift ist Pflicht“', s === 200 && j.settings.sepa_required === true, JSON.stringify(j).slice(0, 200));
  [s, j] = await newMember({ first_name: 'Rita', last_name: 'Rechnung' }); ok('neues Mitglied mit Rechnung abgelehnt', s === 400 && /Lastschrift/.test(j.error), JSON.stringify(j));
  [s, j] = await newMember({ first_name: 'Lars', last_name: 'Lastschrift', payment: 'lastschrift', iban: 'DE89 3704 0044 0532 0130 00', holder: 'Lars Lastschrift', mandate_date: '2025-01-10' }); const lars = j.id;
  ok('neues Mitglied mit Lastschrift', s === 200 && lars, JSON.stringify(j));
  [s, j] = await A(X('list')); { const r = (j.rows || j).find(x => x.id === eva); ok('bestehendes Mitglied mit Rechnung: Hinweis „Zahlart nicht Lastschrift“', r && r.issues.includes('Zahlart nicht Lastschrift'), JSON.stringify(r && r.issues)); }
  [s, j] = await A(X('member/' + eva)); ok('… und Meldung beim Mitglied', (j.missing || []).some(x => /Lastschrift/.test(x)), JSON.stringify(j.missing));
  [s, j] = await A(X('member/' + eva), 'PUT', { payment: 'bar' }); ok('Umstellen auf „bar“ abgelehnt', s === 400 && /Pflicht/.test(j.error), JSON.stringify(j));
  [s, j] = await A(X('member/' + eva), 'PUT', { first_name: 'Eva', last_name: 'Echt', city: 'Neustadt' }); ok('andere Änderungen bei Rechnungszahlern bleiben möglich', s === 200, JSON.stringify(j));
  [s, j] = await A(X('member/' + lars)); ok('Lastschrift mit Mandat: keine fehlenden Pflichtangaben', s === 200 && !(j.missing || []).length, JSON.stringify(j.missing));
  /* ---------- 6. beitragsfrei (0 €) ---------- */
  [s, j] = await A(X('settings'), 'PUT', { sepa_required: false });
  [s, j] = await A(X('fees'), 'POST', { name: 'Beitragsfrei', cents: 0, interval: 'jahr', kind: 'grund' }); const free = j.id; ok('Beitragsart „Beitragsfrei“ mit 0 €', s === 200 && free, JSON.stringify(j));
  [s, j] = await newMember({ first_name: 'Fritz', last_name: 'Frei', fee_id: free }); const fritz = j.id; ok('Mitglied mit Beitragsfrei angelegt', s === 200 && fritz, JSON.stringify(j));
  [s, j] = await A(X('member/' + fritz)); ok('… hat einen Beitrag (keine Meldung „Beitrag“)', !(j.missing || []).includes('Beitrag'), JSON.stringify(j.missing));
  [s, j] = await A(X('runs/preview'), 'POST', { until: new Date().toISOString().slice(0, 10) });
  ok('… Beitragslauf ohne Betrag für Fritz', !(j.positions || []).some(p => p.member_id === fritz && p.cents > 0), JSON.stringify((j.positions || []).filter(p => p.member_id === fritz)));
  // Namen: „Kein Mitglied“ sortiert und zeigt wie Mitglieder („Nachname, Vorname“)
  [s, j] = await A('api/admin/event-members'); ok('Veranstaltungsliste: „Kein Mitglied“ wählbar', s === 200 && j.some(m => m.id === tom), JSON.stringify(j).slice(0, 200));
})().catch(e => { console.log('ABBRUCH ' + (e && e.stack || e)); fails++; }).finally(() => { if (srv) srv.kill(); console.log(fails ? `${fails} Fehler` : 'alles ok'); process.exit(fails ? 1 : 0); });
