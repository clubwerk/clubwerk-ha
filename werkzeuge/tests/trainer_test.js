// Trainer („Kein Mitglied“): Mitglieder-App nur mit Buchen, Türen, Beregnung (eigene Freischaltung), Plätze ohne Gebühren und Kontingent,
// Abteilungsplätze nur mit eingetragener Abteilung, Gebühr von Hand (Vorstand) aufs Verkaufskonto bzw. als Forderung.  node trainer_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_trainer'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3305/', M = 'http://127.0.0.1:5312/'; let fails = 0;
const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ck = '';
async function A(url, method = 'GET', body, { base = B, dev, raw, headers = {} } = {}) {
  const h = { 'X-Clubwerk': '1', Cookie: base === B ? ck : '', ...headers }; if (dev) h['X-Geraet'] = dev;
  if (body !== undefined) h['Content-Type'] = raw ? 'application/octet-stream' : 'application/json';
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) });
  const sc = r.headers.get('set-cookie'); if (base === B && sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  let j = {}; try { j = await r.json(); } catch (e) { /* */ } return [r.status, j];
}
const X = p => 'api/admin/x/mitglieder/' + p, K = p => 'api/admin/x/buchung/' + p, AP = p => 'api/m/buchung/' + p;
const pad = v => String(v).padStart(2, '0');
const day = k => { const d = new Date(); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
let fee = null;
async function newMember(b) {
  const doc = (await A(X('member/new-document'), 'POST', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)), { raw: true, headers: { 'X-Filename': 'antrag.pdf' } }))[1];
  return A(X('member'), 'POST', { doc_id: doc.doc_id, birth_date: '1980-01-01', street: 'Weg 1', zip: '12345', city: 'Ort', mobile: '0170 1234567', fee_id: fee,
    email: `${b.first_name.toLowerCase()}${Math.random().toString(36).slice(2, 6)}@test.de`, payment: 'rechnung', ...b });
}
let srv;
(async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3305', BEREGNUNG_PORT: '5308', MEMBER_PORT: '5312', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/trainer_srv.log', 'w'), fs.openSync(S + '/trainer_srv.log', 'a')] });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Grün-Weiß Musterstadt', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true, buchung: true, zugang: true, beregnung: true, arbeitseinsatz: true, spielbetrieb: true } });
  ok('Setup', s === 200, JSON.stringify(j));
  [s, j] = await A(X('fees'), 'POST', { name: 'Erwachsene', cents: 12000, interval: 'jahr', kind: 'grund' }); fee = j.id;
  [s, j] = await A(X('departments'), 'POST', { name: 'Padel' }); const padel = j.id; ok('Abteilung Padel', s === 200 && padel, JSON.stringify(j));
  [s, j] = await newMember({ first_name: 'Max', last_name: 'Muster' }); const max = j.id; ok('Mitglied Max', s === 200 && max, JSON.stringify(j));
  [s, j] = await A('api/admin/members', 'POST', { name: 'Tom Trainer', kind: 'nichtmitglied' }); const tom = j.id; ok('Trainer Tom („Kein Mitglied“)', s === 200 && tom, JSON.stringify(j));
  [s, j] = await A(K('meta')); const p1 = j.resources[0].id, p2 = j.resources[1].id;
  [s, j] = await A(K('resources/' + p2), 'PUT', { department_id: padel, outsiders: 'gebuehr', outsider_fee_cents: 800 }); ok('Platz 2 gehört Padel (Platzgebühr für andere)', s === 200, JSON.stringify(j));
  await A(K('settings'), 'PUT', { max_open_platz: 1, guest_fee_cents: 500 });
  /* ---------- Mitglieder-App: nur Buchen, Türen, Beregnung – und nur mit Freischaltung ---------- */
  const pair = async (id, pin) => { const t = (await A(`api/admin/app/member/${id}/invite`, 'POST', {}))[1].token; return (await A('api/pair', 'POST', { t, pin }, { base: M }))[1].device; };
  const dTom = await pair(tom, '4826'), dMax = await pair(max, '2468'); ok('Handys gekoppelt (Trainer und Mitglied)', dTom && dMax, JSON.stringify([dTom, dMax]));
  [s, j] = await A('api/me', 'GET', undefined, { base: M, dev: dTom }); ok('ohne Freischaltung: Trainer sieht keinen Bereich', s === 200 && (j.sections || []).length === 0, JSON.stringify(j.sections));
  [s, j] = await A('api/me', 'GET', undefined, { base: M, dev: dMax }); ok('Mitglied sieht „für alle“-Bereiche (Buchen, Meine Daten …)', (j.sections || []).some(x => x.id === 'buchung') && (j.sections || []).some(x => x.id === 'mitglieder'), JSON.stringify((j.sections || []).map(x => x.id)));
  for (const mod of ['buchung', 'zugang', 'beregnung']) { [s, j] = await A(`api/admin/app/member/${tom}/access`, 'PUT', { module: mod, grant: true }); ok(`Trainer: ${mod} freigeschaltet`, s === 200, JSON.stringify(j)); }
  for (const mod of ['mitglieder', 'arbeitseinsatz', 'spielbetrieb']) { [s, j] = await A(`api/admin/app/member/${tom}/access`, 'PUT', { module: mod, grant: true }); ok(`Trainer: ${mod} nicht freischaltbar`, s === 400 && /nur für Mitglieder/.test(j.error), JSON.stringify(j)); }
  [s, j] = await A('api/me', 'GET', undefined, { base: M, dev: dTom });
  ok('Trainer sieht genau Buchen, Türen, Beregnung', JSON.stringify((j.sections || []).map(x => x.id).sort()) === JSON.stringify(['beregnung', 'buchung', 'zugang']), JSON.stringify(j.sections));
  [s, j] = await A('api/m/mitglieder/me', 'GET', undefined, { base: M, dev: dTom }); ok('„Meine Daten“ für Trainer gesperrt', s === 403, s + ' ' + JSON.stringify(j));
  [s, j] = await A('api/m/zugang/status', 'GET', undefined, { base: M, dev: dTom }); ok('Türen: Status für den Trainer', s === 200, s + ' ' + JSON.stringify(j).slice(0, 150));
  [s, j] = await A('api/m/beregnung/status', 'GET', undefined, { base: M, dev: dTom }); ok('Beregnung: Status für den Trainer', s === 200, s + ' ' + JSON.stringify(j).slice(0, 150));
  [s, j] = await A('api/admin/app'); { const r = (j.rows || []).find(x => x.member_id === tom);
    ok('Verwaltung: Trainer in der Liste, angehakt nur Buchen/Türen/Beregnung', r && r.kind === 'nichtmitglied' && r.granted.buchung && r.granted.zugang && r.granted.beregnung && !r.granted.mitglieder && !r.granted.arbeitseinsatz, JSON.stringify(r && r.granted)); }
  /* ---------- Plätze: ohne Gebühren, ohne Kontingent ---------- */
  const book = (dev, b) => A(AP('book'), 'POST', { accept: true, resource_id: p1, minutes: 60, ...b }, { base: M, dev });
  [s, j] = await A(AP('quote'), 'POST', { resource_id: p1, date: day(1), start: '10:00', minutes: 60, guests: [{ name: 'Gerd Gast' }] }, { base: M, dev: dTom });
  ok('Preis: Trainer mit Gast – ohne Gebühr', s === 200 && j.fee_cents === 0 && (j.lines || []).some(l => /Trainer/.test(l.text)), JSON.stringify(j));
  [s, j] = await book(dTom, { date: day(1), start: '10:00', guests: [{ name: 'Gerd Gast' }] }); ok('Trainer bucht mit Gast', s === 200 && j.id, JSON.stringify(j));
  [s, j] = await book(dTom, { date: day(1), start: '12:00' }); ok('… und gleich noch eine (kein Kontingent)', s === 200 && j.id, JSON.stringify(j));
  [s, j] = await book(dTom, { date: day(2), start: '12:00' }); ok('… und eine dritte', s === 200 && j.id, JSON.stringify(j));
  [s, j] = await book(dMax, { date: day(3), start: '10:00', partners: [tom] }); ok('Mitglied bucht mit Trainer als Mitspieler', s === 200 && j.id, JSON.stringify(j));
  [s, j] = await book(dMax, { date: day(3), start: '14:00' }); ok('Mitglied hat weiter ein Kontingent', s === 400 && /offener Buchungen/.test(j.error), JSON.stringify(j));
  [s, j] = await A(K('fees')); ok('keine Gebühr für Trainer-Buchungen', !(j.rows || []).some(r => r.member_id === tom), JSON.stringify(j.rows));
  /* ---------- Abteilungsplatz (Padel) ---------- */
  [s, j] = await book(dTom, { resource_id: p2, date: day(1), start: '16:00' }); ok('Padel ohne Abteilung: Trainer abgelehnt', s === 400 && /Abteilung/.test(j.error) && /Sonderrechten/.test(j.error), JSON.stringify(j));
  [s, j] = await A(K('rights'), 'PUT', { member_id: tom, depts: [padel] }); ok('Sonderrecht: Trainer für Padel', s === 200, JSON.stringify(j));
  [s, j] = await A(K('rights')); ok('… in der Liste mit Abteilung', (j.find(r => r.member_id === tom) || {}).depts.includes(padel), JSON.stringify(j));
  [s, j] = await book(dTom, { resource_id: p2, date: day(1), start: '16:00' }); ok('Padel mit Abteilung: Trainer bucht, ohne Platzgebühr', s === 200 && !j.fee_cents, JSON.stringify(j));
  [s, j] = await A(K('rights'), 'PUT', { member_id: max, depts: [padel] }); [s, j] = await A(K('rights')); ok('Abteilungen nur für Trainer (bei Mitgliedern ignoriert)', !(j.find(r => r.member_id === max) || { depts: [] }).depts.length, JSON.stringify(j));
  /* ---------- Gebühr von Hand (Vorstand) ---------- */
  [s, j] = await A(K('fees/manual'), 'POST', { member_id: tom, cents: 1000, text: 'Platzgebühr Training' }); const fTom = j.id; ok('Gebühr von Hand auf den Trainer → Verkaufskonto', s === 200 && j.to === 'verkauf', JSON.stringify(j));
  [s, j] = await A('api/admin/abtippliste'); ok('… steht im Verkauf offen', ((j.rows || []).find(r => r.id === tom) || {}).cents === 1000, JSON.stringify((j.rows || []).find(r => r.id === tom)));
  [s, j] = await A(K('fees/manual'), 'POST', { member_id: max, cents: 800, text: 'Platzgebühr' }); ok('Gebühr von Hand auf ein Mitglied → Forderung', s === 200 && j.to === 'forderung', JSON.stringify(j));
  [s, j] = await A(X('member/' + max)); ok('… Forderung in der Mitgliederverwaltung', (j.charges || []).some(c => c.cents === 800 && c.status === 'offen'), JSON.stringify(j.charges));
  [s, j] = await A(K('fees')); const man = (j.rows || []).filter(r => r.manual); ok('Gebührenliste zeigt beide (von Hand, offen)', man.length === 2 && man.every(r => r.status === 'offen'), JSON.stringify(man));
  [s, j] = await A(K('fees/manual'), 'POST', { member_id: tom, cents: 5 }); ok('ungültiger Betrag abgelehnt', s === 400, JSON.stringify(j));
  [s, j] = await A(K(`fees/manual/${fTom}/cancel`), 'POST', {}); ok('Gebühr des Trainers storniert', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/abtippliste'); ok('… nicht mehr offen im Verkauf', !(j.rows || []).some(r => r.id === tom && r.cents > 0), JSON.stringify((j.rows || []).find(r => r.id === tom)));
  /* ---------- Löschen: offene Gebühr sperrt ---------- */
  [s, j] = await A(K('fees/manual'), 'POST', { member_id: tom, cents: 300 });
  [s, j] = await A('api/admin/members/' + tom, 'DELETE'); ok('Trainer mit offener Gebühr / kommenden Buchungen nicht löschbar', s === 409, JSON.stringify(j).slice(0, 200));
})().catch(e => { console.log('ABBRUCH ' + (e && e.stack || e)); fails++; }).finally(() => { if (srv) srv.kill(); console.log(fails ? `${fails} Fehler` : 'alles ok'); process.exit(fails ? 1 : 0); });
