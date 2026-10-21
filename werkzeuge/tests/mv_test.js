// Mitgliederverwaltung: API-Ende-zu-Ende. Startet den Server selbst.  node mv_test.js <S>
const { spawn, execFileSync } = require('child_process'); const fs = require('fs'); const zlib = require('zlib');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_mv'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3262/', M = 'http://127.0.0.1:5263/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
let ck = '';
// Neue Mitglieder brauchen seit 3.9 vollständige Daten – Testwerte ergänzen und danach wieder auf den Stand der Testdaten zurücksetzen
let __fee = null;
async function fillMember(b, opts) {
  if (!__fee) { const [, m] = await A('api/admin/x/mitglieder/meta', 'GET', undefined, opts); const f = ((m && m.fees) || []).find(x => x.active && x.kind !== 'zusatz' && x.age_min == null && x.age_max == null);
    __fee = f ? f.id : (await A('api/admin/x/mitglieder/fees', 'POST', { name: 'Testbeitrag', cents: 1000, interval: 'jahr', kind: 'grund' }, opts))[1].id; }
  // seit 3.10: unterschriebene Beitrittserklärung gehört dazu
  const __doc = await fetch(B + 'api/admin/x/mitglieder/member/new-document', { method: 'POST', headers: { 'X-Clubwerk': '1', Cookie: (opts && opts.cookie) || ck, 'Content-Type': 'application/octet-stream', 'X-Filename': 'antrag.pdf' }, body: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)) }).then(r => r.json()).catch(() => ({}));
  const full = { doc_id: __doc.doc_id, ...(b.iban ? { holder: `${b.first_name || 'Test'} ${b.last_name || 'Test'}` } : {}), last_name: 'Test', birth_date: '1980-01-01', street: 'Weg 1', zip: '12345', city: 'Ort', email: `${String(b.first_name || 'x').toLowerCase().replace(/[^a-z]/g, '') || 'x'}${Math.random().toString(36).slice(2, 6)}@test.de`, mobile: '0170 1234567', fee_id: __fee, payment: b.iban ? 'lastschrift' : 'rechnung', ...b, __filled: true };
  const r = await A('api/admin/x/mitglieder/member', 'POST', full, opts);
  if (r[0] === 200 && r[1].id && !r[1].pending) {
    const id = r[1].id, back = {};
    if (b.payment === undefined && !b.iban) back.payment = 'lastschrift';
    if (b.birth_date === undefined) back.birth_date = null;
    for (const k of ['street', 'zip', 'city', 'mobile']) if (b[k] === undefined) back[k] = null;
    if (Object.keys(back).length) await A(`api/admin/x/mitglieder/member/${id}`, 'PUT', back, opts);
    if (b.fee_id === undefined) { const [, d] = await A(`api/admin/x/mitglieder/member/${id}`, 'GET', undefined, opts); for (const f of (d && d.fees) || []) if (f.fee_id === __fee) await A(`api/admin/x/mitglieder/mf/${f.id}`, 'DELETE', undefined, opts); }
  }
  return r;
}
async function A(url, method = 'GET', body, { raw, cookie, base = B, dev, ctype, headers: xh = {} } = {}) {
  if (method === 'POST' && /x\/mitglieder\/member$/.test(url) && body && typeof body === 'object' && !body.__filled) return fillMember(body, arguments[3]);
  if (body && body.__filled) { body = { ...body }; delete body.__filled; }
  const h = { 'X-Clubwerk': '1', Cookie: base === B ? (cookie || ck) : '', ...xh }; if (dev) h['X-Geraet'] = dev;
  if (body !== undefined) h['Content-Type'] = ctype || (raw ? 'application/octet-stream' : 'application/json');
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body), redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); if (base === B && !cookie && sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  const buf = Buffer.from(await r.arrayBuffer()); let j = {}; try { j = JSON.parse(buf.toString()); } catch (e) { /* */ } return [r.status, j, r, buf];
}
const X = p => 'api/admin/x/mitglieder/' + p;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mails = () => fs.readdirSync(MAILDIR).filter(f => /^mail\d+\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(MAILDIR + '/' + f)));
// echte kleine PNG-Unterschrift
function png(w = 240, h = 70) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h, 255);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const yy = Math.round(h / 2 + Math.sin(x / 9) * 18 + (Math.random() * 3)); if (Math.abs(yy - y) < 2) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = raw[o + 1] = raw[o + 2] = 20; } } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 0 })), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
const SIG = png();
const XSD = S + '/sepa/sepaxml/schemas/pain.008.001.08.xsd';
const xsdOk = xml => { fs.writeFileSync(S + '/mv_coll.xml', xml); try { execFileSync('xmllint', ['--noout', '--schema', XSD, S + '/mv_coll.xml'], { stdio: 'pipe' }); return true; } catch (e) { console.log(String(e.stderr)); return false; } };
let srv;
async function start() {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3262', BEREGNUNG_PORT: '5262', MEMBER_PORT: '5263', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/mv_srv.log', 'w'), fs.openSync(S + '/mv_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
const iso = d => d.toISOString().slice(0, 10);
(async () => {
  let s, j, r, buf;
  await start();
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true } });
  ok('Setup', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/extensions'); ok('Modul aktiv', j.modules.includes('mitglieder'), JSON.stringify(j.modules));
  await A('api/admin/mail', 'PUT', { host: '127.0.0.1', port: 2525, user: '', from: 'verein@test.de' });
  // ---- Einstellungen
  [s, j] = await A(X('settings'), 'PUT', { creditor_id: 'DE46ZZZ00000387335', club_iban: 'DE02120300000000202051', club_bic: 'BYLADEM1001', mandate_prefix: 'TCF', year_start: '05-01', club_street: 'Am Sportplatz 1', club_city: '65599 Musterstadt', notify_to: 'vorstand@test.de', member_no_start: '2000', app_online: true });
  ok('Einstellungen', s === 200, j.error);
  [s, j] = await A(X('settings'), 'PUT', { creditor_id: 'DE00ZZZ00000000000' }); ok('Falsche Gläubiger-ID abgelehnt', s === 400, j.error);
  [s, j] = await A(X('settings'), 'PUT', { year_start: '05-15' }); ok('Beitragsjahr nur am Ersten', s === 400);
  // ---- Katalog
  [s, j] = await A(X('departments'), 'POST', { name: 'Tennis' }); const tennis = j.id; ok('Abteilung', s === 200);
  const fee = async (b) => (await A(X('fees'), 'POST', b))[1].id;
  const fErw = await fee({ name: 'Erwachsene ab 19 Jahre', cents: 10800, interval: 'jahr', age_min: 19, department_id: tennis });
  const fJug = await fee({ name: 'Jugendliche 12–18 Jahre', cents: 4200, interval: 'jahr', age_min: 12, age_max: 18 });
  const fKid = await fee({ name: 'Kinder bis 11 Jahre', cents: 2600, interval: 'jahr', age_max: 11, work_minutes: 0 });
  const fFam = await fee({ name: 'Familie mit Kindern bis 18 Jahre', cents: 18500, interval: 'jahr', family: 1 });
  const fAuf = await fee({ name: 'Aufnahmegebühr', cents: 2500, interval: 'einmalig', on_form: 0 });
  [s, j] = await A(X('fees'), 'POST', { name: 'x', cents: 5 }); ok('Beitragsart ohne Namen abgelehnt', s === 400);
  [s, j] = await A(X('meta')); ok('Meta', j.fees.length === 5 && j.depts.length === 1 && j.perms.bank && j.nextNo === '2000', JSON.stringify(j).slice(0, 300));
  // ---- Mitglieder
  [s, j] = await A(X('member'), 'POST', { first_name: 'Max', last_name: 'Muster', birth_date: '1980-03-04', email: 'max@test.de', street: 'Hauptstr. 1', zip: '65599', city: 'Dornburg', entry_date: '2025-08-15' });
  const max = j.id; ok('Mitglied angelegt', s === 200 && max, JSON.stringify(j));
  [s, j] = await A(X('member'), 'POST', { first_name: 'Eva', last_name: 'Muster', birth_date: '1982-06-01' }); const eva = j.id;
  [s, j] = await A(X('member'), 'POST', { first_name: 'Paul', last_name: 'Muster', birth_date: '2012-01-10' }); const paul = j.id;
  [s, j] = await A(X('member'), 'POST', { first_name: 'Lena', last_name: 'Single', birth_date: '1999-11-11', email: 'lena@test.de' }); const lena = j.id;
  [s, j] = await A(X('member'), 'POST', { first_name: 'X', last_name: 'Y', email: 'kaputt' }); ok('Ungültige E-Mail abgelehnt', s === 400);
  [s, j] = await A(X('member/' + max)); ok('Detail', j.person.member_no === '2000' && j.person.first_name === 'Max' && j.person.age >= 45, JSON.stringify(j.person).slice(0, 200));
  [s, j] = await A('api/admin/members'); ok('Name im Kern', (j.rows || j).some(m => m.name === 'Max Muster'), JSON.stringify(j).slice(0, 200));
  await A(X('member/' + max), 'PUT', { mobile: '0170 1234567', first_name: 'Maximilian' });
  [s, j] = await A(X('member/' + max)); ok('Änderung + Verlauf', j.person.first_name === 'Maximilian' && j.history.some(h => h.field === 'Vorname' && h.old === 'Max'));
  // Familie
  [s, j] = await A(X(`member/${eva}/payer`), 'PUT', { payer_id: max }); ok('Eva → Zahler Max', s === 200, j.error);
  await A(X(`member/${paul}/payer`), 'PUT', { payer_id: max });
  [s, j] = await A(X(`member/${max}/payer`), 'PUT', { payer_id: eva }); ok('Kreis verhindert', s === 400, j.error);
  [s, j] = await A(X(`member/${max}/payer`), 'PUT', { payer_id: max }); ok('Selbst als Zahler verhindert', s === 400);
  [s, j] = await A(X('member/' + paul)); ok('Familie sichtbar', j.payerGroup.length === 3 && j.payerGroup.find(f => f.head).id === max && j.family.length === 0);
  // Beiträge
  [s, j] = await A(X(`member/${max}/fees`), 'POST', { fee_id: fFam, start_date: '2025-08-15' }); ok('Familienbeitrag', s === 200, j.error);
  [s, j] = await A(X(`member/${lena}/fees`), 'POST', { fee_id: fErw, start_date: '2024-05-01', booked_until: '2025-04-30' });
  await A(X(`member/${lena}/fees`), 'POST', { fee_id: fAuf, start_date: '2025-05-01' });
  [s, j] = await A(X(`member/${lena}/departments`), 'POST', { department_id: tennis, entry_date: '2024-05-01' }); ok('Abteilung zugeordnet', s === 200);
  [s, j] = await A(X(`member/${lena}/departments`), 'POST', { department_id: tennis }); ok('Doppelte Abteilung verhindert', s === 400);
  // Bank
  [s, j] = await A(X(`member/${max}/bank`), 'PUT', { holder: 'Maximilian Muster', iban: 'DE89 3704 0044 0532 0130 00', newMandate: true, mandate_date: '2025-08-10' });
  ok('Bank + Mandat', s === 200 && j.mandate_ref === 'TCF2000', JSON.stringify(j));
  [s, j] = await A(X(`member/${lena}/bank`), 'PUT', { holder: 'Lena Single', iban: 'DE89370400440532013001' }); ok('Falsche IBAN abgelehnt', s === 400, j.error);
  [s, j] = await A(X(`member/${lena}/bank`), 'PUT', { holder: 'Lena Single', iban: 'AT611904300234573201', bic: 'BKAUATWW', mandate_ref: 'ALT-77', mandate_date: '2020-01-01' }); ok('Altes Mandat', s === 200, j.error);
  [s, j] = await A(X('list?status=aktuell')); const lrow = j.find(x => x.id === lena);
  ok('Liste: Mandat verfallen erkannt', lrow.issues.some(i => /verfallen/.test(i)), JSON.stringify(lrow.issues));
  await A(X(`member/${lena}/bank`), 'PUT', { mandate_ref: 'ALT-77', mandate_date: '2024-05-01', mandate_used: '2025-05-02' });
  await A(X('member/' + lena), 'PUT', { entry_date: '2024-05-01' });
  [s, j] = await A(X('list?q=muster')); ok('Suche', j.length === 3, j.length);
  // ---- Getränke buchen (für Option „mit abbuchen“)
  [s, j] = await A('api/tablet/state'); const art = (j.articles || [])[0];
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: eva }); const tok = j.token;
  [s, j] = await A('api/tablet/book', 'POST', { token: tok, items: [{ articleId: art.id || art.articleId, qty: 3 }] }); ok('Getränke gebucht', s === 200, JSON.stringify(j).slice(0, 200));
  // ---- Beitragslauf
  const until = iso(new Date());
  [s, j] = await A(X('runs/preview'), 'POST', { until, drinks: true });
  ok('Vorschau', s === 200 && j.positions.length >= 4, JSON.stringify(j.totals) + ' ' + j.positions.map(p => p.text + ' ' + p.cents).join(' | '));
  const famPos = j.positions.find(p => p.member_fee_id && p.for_member_id === max);
  ok('Familie anteilig ab Aug (Beitragsjahr 05-01)', famPos && famPos.period_from === '2025-08-15' && famPos.period_to === '2026-04-30' && famPos.cents === Math.round(18500 * 9 / 12), famPos && famPos.text + ' ' + famPos.cents);
  const drinkPos = j.positions.find(p => p.kind === 'getraenke');
  ok('Getränke von Eva beim Zahler Max', drinkPos && drinkPos.member_id === max && drinkPos.for_member_id === eva, JSON.stringify(drinkPos));
  ok('Lena ab gebucht bis', j.positions.some(p => p.for_member_id === lena && p.period_from === '2025-05-01'));
  const total = j.totals.cents;
  [s, j] = await A(X('runs'), 'POST', { until, drinks: true }); const run1 = j.run; ok('Lauf ausgeführt', s === 200 && j.cents === total, JSON.stringify(j));
  [s, j] = await A(X('runs/preview'), 'POST', { until, drinks: true }); ok('Nichts doppelt', j.positions.length === 0, j.positions.map(p => p.text).join(' | '));
  [s, j] = await A(X('runs/' + run1), 'DELETE'); ok('Lauf zurückgenommen', s === 200, j.error);
  [s, j] = await A(X('runs/preview'), 'POST', { until, drinks: true }); ok('Nach Rücknahme wieder da (inkl. Getränke)', j.totals.cents === total, j.totals.cents + ' vs ' + total);
  [s, j] = await A(X('runs'), 'POST', { until, drinks: true }); ok('Lauf erneut', s === 200);
  [s, j] = await A(X('charges?status=offen')); ok('Offene Posten', j.rows.length >= 4 && j.sum === total, j.sum);
  // ---- Einzug
  [s, j] = await A(X('collections/preview'), 'POST', { date: until });
  ok('Einzug-Plan', j.ok.length === 2 && j.ok.find(x => x.member_id === max).seq === 'FRST' && j.ok.find(x => x.member_id === lena).seq === 'RCUR' && j.tooEarly, JSON.stringify({ ok: j.ok.map(x => [x.name, x.seq, x.cents]), pr: j.problems, e: j.earliest }));
  const earliest = j.earliest;
  [s, j] = await A(X('collections'), 'POST', { date: until }); ok('Zu früh → 409', s === 409 || s === 400, j.error);
  [s, j] = await A(X('collections'), 'POST', { date: earliest }); const coll = j.id; ok('Einzug erstellt', s === 200, j.error);
  [s, , r, buf] = await A(X(`collections/${coll}/xml`)); ok('XML laden', s === 200 && /pain\.008\.001\.08/.test(buf.toString()));
  ok('XML gültig nach XSD', xsdOk(buf.toString()));
  ok('FRST + RCUR getrennt', /<SeqTp>FRST<\/SeqTp>/.test(buf) && /<SeqTp>RCUR<\/SeqTp>/.test(buf) && /TCF2000/.test(buf) && /ALT-77/.test(buf));
  [s, j] = await A(X(`collections/${coll}/prenotify`), 'POST', {}); await sleep(800);
  ok('Vorabinformation', s === 200 && j.sent === 2, JSON.stringify(j));
  ok('Vorab-Mail mit Mandat', mails().some(m => m.to === 'max@test.de' && /TCF2000/.test(m.text) && /DE46ZZZ00000387335/.test(m.text)));
  [s, , r, buf] = await A(X(`collections/${coll}/letters.pdf?all=1`)); ok('Briefe-PDF', s === 200 && buf.slice(0, 4).toString() === '%PDF');
  [s, j] = await A(X(`collections/${coll}/return`), 'POST', { member_id: lena, fee_cents: 350, reason: 'Konto erloschen' }); ok('Rücklastschrift', s === 200, j.error);
  [s, j] = await A(X(`charges?member=${lena}&status=offen`)); ok('Posten wieder offen + Gebühr', j.rows.some(c => c.kind === 'ruecklastschrift' && c.cents === 350) && j.rows.length >= 3, j.rows.map(c => c.text).join('|'));
  [s, j] = await A(X('charges?status=eingezogen')); const inColl = j.rows.map(c => c.id); ok('Posten im Einzug', inColl.length > 0 && j.rows.every(c => c.member_id !== lena));
  [s, j] = await A(X('charges/paid'), 'POST', { ids: inColl, date: earliest }); ok('Zahlung erfolgt (gesammelt)', s === 200 && j.count === inColl.length, JSON.stringify(j));
  [s, j] = await A(X('collections')); ok('Einzug danach verbucht', j.find(k => k.id === coll).status === 'gebucht');
  [s, j] = await A(X('charges/paid'), 'POST', { ids: inColl }); ok('Doppelt buchen abgelehnt', s === 400);
  [s, j] = await A(X('member/' + max)); ok('Mandat jetzt benutzt', j.bank.mandate_first_used === earliest);
  // Zahlung / Teilzahlung / Mahnung
  [s, j] = await A(X(`charges?member=${lena}&status=offen`)); const c1 = j.rows[0];
  [s, j] = await A(X(`charges/${c1.id}/pay`), 'POST', { cents: 100, via: 'bar' }); ok('Teilzahlung', s === 200);
  [s, j] = await A(X(`charges?member=${lena}&status=offen`)); ok('Rest offen', j.rows.some(c => /^Rest:/.test(c.text)));
  [s, , r, buf] = await A(X(`invoice.pdf?member=${lena}`)); ok('Rechnung PDF', s === 200 && buf.slice(0, 4).toString() === '%PDF');
  [s, j] = await A(X('invoices/send'), 'POST', { member_ids: [lena], dunning: true }); await sleep(500); ok('Mahnung', s === 200 && j.sent === 1, JSON.stringify(j));
  [s, j] = await A(X('finance')); ok('Finanzübersicht', s === 200 && j.open.c > 0 && j.paidYear.c > 0, JSON.stringify(j).slice(0, 200));
  // ---- Getränke separat einziehen
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: lena });
  await A('api/tablet/book', 'POST', { token: j.token, items: [{ articleId: art.id || art.articleId, qty: 2 }] });
  [s, j] = await A(X('runs/preview'), 'POST', { onlyDrinks: true }); ok('Nur Getränke', j.positions.length === 1 && j.positions[0].kind === 'getraenke' && j.positions[0].member_id === lena, JSON.stringify(j.positions));
  [s, j] = await A(X('runs'), 'POST', { onlyDrinks: true }); ok('Getränke-Lauf', s === 200 && j.count === 1);
  // ---- Antrag: Verwaltung → Tablet-Unterschrift
  const appData = { persons: [{ first_name: 'Nina', last_name: 'Neu', birth_date: '1990-02-02' }, { first_name: 'Tom', last_name: 'Neu', birth_date: '2016-05-05', role: 'kind' }],
    street: 'Neue Str. 5', zip: '65599', city: 'Dornburg', email: 'nina@test.de', fee_id: fFam, holder: 'Nina Neu', iban: 'DE89370400440532013000', consents: { daten: true } };
  [s, j] = await A(X('applications'), 'POST', { data: appData }); const code = j.code, appId = j.id; ok('Antrag mit Code', s === 200 && /^\d{6}$/.test(code), JSON.stringify(j));
  [s, j] = await A('api/tablet/x/mitglieder/antrag/open', 'POST', { code: '000000' }); ok('Falscher Code', s === 404);
  [s, j] = await A('api/tablet/x/mitglieder/antrag/open', 'POST', { code }); ok('Antrag am Tablet geöffnet', s === 200 && j.data.persons.length === 2);
  [s, j] = await A('api/tablet/x/mitglieder/antrag/sign', 'POST', { code, sig_member: SIG, sig_mandate: SIG, consents: {} }); ok('Pflicht-Einwilligung nötig', s === 400, j.error);
  [s, j] = await A('api/tablet/x/mitglieder/antrag/sign', 'POST', { code, sig_member: SIG, sig_mandate: SIG, consents: { daten: true, homepage: true } }); ok('Unterschrieben + automatisch angenommen', s === 200 && j.auto, JSON.stringify(j));
  await sleep(600);
  [s, j] = await A(X('applications?status=alle')); const ap = j.find(a => a.id === appId); ok('Antrag angenommen', ap && ap.status === 'angenommen' && ap.member_id, JSON.stringify(ap).slice(0, 200));
  [s, j] = await A(X('member/' + ap.member_id)); ok('Nina angelegt mit Familie + Mandat + Dokument', j.family.length === 2 && j.bank.mandate_ref && j.documents.length === 1 && j.person.consents.homepage, JSON.stringify({ f: j.family, b: j.bank && j.bank.mandate_ref, d: j.documents }));
  [s, , r, buf] = await A(X('documents/' + j.documents[0].id)); ok('Antrags-PDF', s === 200 && buf.slice(0, 4).toString() === '%PDF' && buf.length > 3000);
  ok('Willkommens-Mail', mails().some(m => m.to === 'nina@test.de' && /Mandatsreferenz/.test(m.text)));
  // Online-Antrag
  [s, j] = await A('api/p/mitglieder/antrag/config', 'GET', undefined, { base: M }); ok('Online-Formular', s === 200 && j.fees.length === 4, j.error);
  const onl = { data: { persons: [{ first_name: 'Olaf', last_name: 'Online', birth_date: '1975-07-07' }], street: 'Weg 2', zip: '65599', city: 'Dornburg', email: 'olaf@test.de', fee_id: fErw, holder: 'Olaf Online', iban: 'DE89370400440532013000', consents: { daten: true } }, sig_member: SIG, sig_mandate: SIG };
  const tk = j.t;
  [s, j] = await A('api/p/mitglieder/antrag', 'POST', { ...onl, t: tk }, { base: M }); ok('Zu schnell abgelehnt', s === 400 && /in Ruhe/.test(j.error), j.error);
  [s, j] = await A('api/p/mitglieder/antrag', 'POST', { ...onl, t: Date.now() - 60000 }, { base: M }); ok('Selbst gesetzter alter Zeitstempel abgelehnt', s === 400 && /veraltet/.test(j.error), j.error);
  { const [ts, n] = tk.split('.'); [s, j] = await A('api/p/mitglieder/antrag', 'POST', { ...onl, t: `${Number(ts) - 60000}.${n}.${'0'.repeat(32)}` }, { base: M }); ok('Gefälschtes Ticket abgelehnt', s === 400 && /veraltet/.test(j.error), j.error); }
  await sleep(15300);
  [s, j] = await A('api/p/mitglieder/antrag', 'POST', { ...onl, t: tk }, { base: M }); ok('Online-Antrag', s === 200, j.error);
  [s, j] = await A('api/p/mitglieder/antrag', 'POST', { ...onl, t: tk }, { base: M }); ok('Ticket nur einmal einlösbar', s === 400 && /schon abgeschickt/.test(j.error), j.error);
  await sleep(400);
  [s, j] = await A(X('applications')); const oa = j.find(a => a.source === 'online'); ok('Online-Antrag wartet', oa && oa.status === 'eingegangen');
  [s, j] = await A(X('applications/' + oa.id)); ok('Vorschlag Beitrag', j.suggest[0] === fErw, JSON.stringify(j.suggest));
  [s, j] = await A(X(`applications/${oa.id}/accept`), 'POST', {}); ok('Online-Antrag angenommen', s === 200 && j.member_id, j.error);
  ok('Vorstand benachrichtigt', mails().some(m => m.to === 'vorstand@test.de' && /Olaf/.test(m.subject)));
  // ---- Mitglieder-App „Meine Daten“
  [s, j] = await A(`api/admin/app/member/${max}/invite`, 'POST', {}); const t = j.token;
  [s, j] = await A('api/pair', 'POST', { t, pin: '2468' }, { base: M }); const dev = j.device; ok('Handy gekoppelt', s === 200 && dev, JSON.stringify(j));
  [s, j] = await A('api/me', 'GET', undefined, { base: M, dev }); ok('Meine Daten in der App', (j.sections || []).some(x => x.id === 'mitglieder'), JSON.stringify(j.sections));
  [s, j] = await A('api/m/mitglieder/me', 'GET', undefined, { base: M, dev }); ok('Meine Daten', s === 200 && j.isHead && j.family.length === 3 && j.fees.length === 1 && j.bank.mandate_ref === 'TCF2000' && !/3704 0044 0532 0130 00/.test(JSON.stringify(j)), JSON.stringify(j).slice(0, 300));
  // seit 3.13.3: neue E-Mail-Adresse und Einwilligungen nur mit PIN (Anschrift allein weiterhin ohne)
  [s, j] = await A('api/m/mitglieder/change', 'POST', { street: 'Neue Gasse 9', email: 'max.neu@test.de', consents: { daten: true, homepage: true } }, { base: M, dev }); ok('E-Mail/Einwilligungen ohne PIN abgelehnt', s === 401 && j.pin === true, s + ' ' + JSON.stringify(j));
  [s, j] = await A('api/m/mitglieder/change', 'POST', { street: 'Neue Gasse 9', email: 'max.neu@test.de', consents: { daten: true, homepage: true }, pin: '2468' }, { base: M, dev }); ok('Änderung gemeldet (mit PIN)', s === 200 && j.pending, s + ' ' + JSON.stringify(j));
  [s, j] = await A('api/m/mitglieder/change', 'POST', { consents: { daten: false }, pin: '2468' }, { base: M, dev }); ok('Pflicht-Einwilligung nicht widerrufbar', s === 400, j.error);
  // Einwilligungen in der App ausblenden (Sehen/Ändern)
  const apOld = (await A(X('meta')))[1].settings.app_perms;
  [s, j] = await A(X('settings'), 'PUT', { app_perms: { view: { ...apOld.view, einwilligungen: false }, edit: { ...apOld.edit, einwilligungen: true } } }); ok('Einwilligungen ausgeblendet', s === 200, j.error);
  [s, j] = await A('api/m/mitglieder/me', 'GET', undefined, { base: M, dev }); ok('App zeigt keine Einwilligungen', s === 200 && Array.isArray(j.consents) && j.consents.length === 0 && j.perms.edit.einwilligungen === false, JSON.stringify(j.consents));
  [s, j] = await A('api/m/mitglieder/change', 'POST', { consents: { daten: true, homepage: false }, pin: '2468' }, { base: M, dev }); ok('Ohne Freigabe keine Änderung der Einwilligungen', s === 400, s + ' ' + j.error);
  [s, j] = await A(X('settings'), 'PUT', { app_perms: apOld });
  [s, j] = await A('api/m/mitglieder/me', 'GET', undefined, { base: M, dev }); ok('Wieder sichtbar', j.consents.length > 0 && j.perms.edit.einwilligungen === true);
  [s, j] = await A('api/m/mitglieder/bank', 'POST', { holder: 'Maximilian Muster', iban: 'DE02120300000000202051', agree: true, signature: SIG, pin: '0000' }, { base: M, dev }); ok('Bank: falsche PIN', s === 401);
  [s, j] = await A('api/m/mitglieder/bank', 'POST', { holder: 'Maximilian Muster', iban: 'DE02120300000000202051', agree: true, signature: SIG, pin: '2468' }, { base: M, dev }); ok('Bank eingereicht', s === 200, j.error);
  [s, j] = await A(X('changes')); ok('Änderungen in der Verwaltung', j.length === 2, JSON.stringify(j).slice(0, 300));
  const chD = j.find(c => c.kind === 'daten'), chB = j.find(c => c.kind === 'bank');
  [s, j] = await A(X(`changes/${chD.id}/accept`), 'POST', {}); ok('Daten übernommen', s === 200);
  [s, j] = await A(X(`changes/${chB.id}/accept`), 'POST', {}); ok('Bank übernommen', s === 200, j.error);
  [s, j] = await A(X('member/' + max)); ok('Neues Mandat + Adresse', j.person.street === 'Neue Gasse 9' && j.bank.iban === 'DE02120300000000202051' && j.bank.mandate_ref === 'TCF2000-2' && !j.bank.mandate_first_used && j.documents.some(d => d.kind === 'mandat'), JSON.stringify(j.bank));
  await sleep(500);
  ok('Mandat per Mail', mails().some(m => m.to === 'max.neu@test.de' && /TCF2000-2/.test(m.text)));
  [s, j] = await A('api/m/mitglieder/kuendigung', 'POST', { confirm: true, members: [paul], pin: '2468' }, { base: M, dev }); ok('Kündigung (Kind)', s === 200 && j.exit_date === `${new Date().getFullYear() + (new Date().getMonth() >= 1 ? 1 : 0)}-04-30`, JSON.stringify(j));
  [s, j] = await A(X('changes')); const chK = j.find(c => c.kind === 'kuendigung');
  [s, j] = await A(X(`changes/${chK.id}/accept`), 'POST', {}); ok('Kündigung bestätigt', s === 200);
  [s, j] = await A(X('member/' + paul)); ok('Austritt eingetragen', j.person.exit_date && j.fees.every(f => true));
  // ---- Auswertungen
  [s, j] = await A(X('stats')); ok('Statistik', s === 200, JSON.stringify(j).slice(0, 200));
  [s, , r, buf] = await A(X('stats/lsb.xlsx')); ok('LSB-Excel', s === 200 && buf.slice(0, 2).toString() === 'PK');
  [s, , r, buf] = await A(X('export.xlsx')); ok('Export', s === 200 && buf.slice(0, 2).toString() === 'PK');
  [s, j] = await A('api/admin/mail/options'); ok('Rundmail jetzt unter Verein → E-Mail (Gruppen aus der Mitgliederverwaltung)', s === 200 && j.mv && j.groups.some(g => g.t === 'status' && g.v === 'aktuell' && g.n > 0), JSON.stringify(j).slice(0, 300));
  // ---- Import verein.cloud (künstliche Daten, Kopfzeile wie das Original)
  const head = fs.readFileSync(S + '/vc_head.csv', 'utf8').replace(/^﻿/, '').split(/\r?\n/)[0];
  const cols = head.split(';').map(h => h.replace(/"/g, ''));
  const row = o => cols.map(c => (o[c] != null ? `"${o[c]}"` : '')).join(';');
  const csv = '﻿' + head + '\r\n' + [
    row({ 'Mitglieds-Nr': '2140', Nachname: 'Import', Vorname: 'Ida', Abteilung_1: 'Hauptverein', Abteilungseintritt_1: '01.01.2019', Abteilungsstatus_1: 'Aktiv', Beitragsbezeichnung_1_1: 'Erwachsene ab 19 Jahre ohne Arbeitseinsatz', Beitragsstart_1_1: '01.01.2019', 'Gebucht bis_1_1': '30.04.2027', Betrag_1_1: '108', Intervall_1_1: 'Jahr', Geschlecht: 'weiblich', Geburtsdatum: '03.03.1970', Eintrittsdatum: '01.01.2019', IBAN: 'DE89370400440532013000', Kontoinhaber: 'Ida Import', Mandatsreferenz: 'TCF2140', Unterschriftsdatum: '01.01.2019', Gültigkeitsdatum: '05.10.2029', Status: 'Aktiv', Zahlungsart: 'Lastschrift', 'E-Mail': 'ida@test.de', 'Straße': 'Importweg 1', PLZ: '65599', Ort: 'Dornburg' }),
    row({ 'Mitglieds-Nr': '2141', Nachname: 'Import', Vorname: 'Ben', Abteilung_1: 'Hauptverein', Abteilungseintritt_1: '01.01.2020', Abteilungsstatus_1: 'Aktiv', Geschlecht: 'männlich', Geburtsdatum: '04.04.2010', Eintrittsdatum: '01.01.2020', Status: 'Aktiv', 'Abweichender Zahler Mitglied': '2140' }),
    row({ Nachname: 'Single', Vorname: 'Lena', Geschlecht: 'weiblich', Status: 'Aktiv' }),
  ].join('\r\n') + '\r\n';
  [s, j] = await A(X('import/verein-cloud'), 'POST', Buffer.from(csv), { raw: true, ctype: 'text/csv' });
  ok('Import-Vorschau', s === 200 && j.count === 3 && j.new === 2 && j.update === 1 && j.yearHint === null, JSON.stringify(j).slice(0, 500));
  [s, j] = await A(X('import/verein-cloud?commit=1'), 'POST', Buffer.from(csv), { raw: true, ctype: 'text/csv' }); ok('Import übernommen', s === 200 && j.created === 2 && j.updated === 1 && j.payers === 1 && j.depts === 1, JSON.stringify(j));
  [s, j] = await A(X('list?q=import')); const ida = j.find(x => x.first_name === 'Ida'), ben = j.find(x => x.first_name === 'Ben');
  ok('Ida mit Nr., Ben zahlt über Ida', ida && ida.member_no === '2140' && ben.payer_id === ida.id, JSON.stringify(j).slice(0, 300));
  [s, j] = await A(X('member/' + ida.id)); ok('Mandat aus Import = Folgelastschrift, gebucht bis', j.bank.mandate_ref === 'TCF2140' && j.bank.mandate_first_used && j.fees[0].booked_until === '2027-04-30', JSON.stringify({ b: j.bank, f: j.fees }));
  [s, j] = await A(X('meta')); const impFee = j.fees.find(f => /ohne Arbeitseinsatz/.test(f.name)); ok('Beitragsart ohne Arbeitseinsatz erkannt', impFee && impFee.work_minutes === 0 && impFee.age_min === 19, JSON.stringify(impFee));
  // ---- Rechte
  await A('api/admin/users', 'POST', { username: 'trainer', name: 'Trainer', password: 'trainer1234', role: 'admin', perms: ['mitglieder'] });
  const r2 = await fetch(B + 'api/admin/login', { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'trainer', password: 'trainer1234' }) });
  const ck2 = (r2.headers.get('set-cookie') || '').split(';')[0];
  [s, j] = await A(X('member/' + max), 'GET', undefined, { cookie: ck2 }); ok('Ohne Bankrecht: IBAN maskiert', s === 200 && j.bank.hidden && !j.bank.iban && j.charges === null && j.documents === null, JSON.stringify(j.bank));
  [s] = await A(X('runs/preview'), 'POST', {}, { cookie: ck2 }); ok('Ohne Finanzrecht kein Lauf', s === 403);
  [s] = await A(X(`member/${max}/bank`), 'PUT', { holder: 'X' }, { cookie: ck2 }); ok('Ohne Bankrecht keine Bankänderung', s === 403);
  [s] = await A(X('import/verein-cloud?commit=1'), 'POST', Buffer.from(csv), { raw: true, ctype: 'text/csv', cookie: ck2 }); ok('Import mit IBAN ohne Bankrecht verweigert', s === 403);
  // Datenauskunft mit den echten Rechten: nur „Mitglieder“ → keine IBAN, keine Forderungen; mit „Bankdaten“ → IBAN enthalten
  [s, , r, buf] = await A(X(`member/${max}/auskunft`), 'GET', undefined, { cookie: ck2 });
  { const a = s === 200 ? JSON.parse(buf) : {}; ok('Datenauskunft ohne Bankrecht: IBAN maskiert, keine Forderungen, keine Dokumente', s === 200 && a.bankverbindung && a.bankverbindung.hidden && !a.bankverbindung.iban && a.forderungen === null && Array.isArray(a.dokumente) && !a.dokumente.length, JSON.stringify(a.bankverbindung)); }
  await A('api/admin/users', 'POST', { username: 'kassier2', name: 'Kassier', password: 'kassier1234', role: 'admin', perms: ['mitglieder', 'mitglieder_bank'] });
  { const r3 = await fetch(B + 'api/admin/login', { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'kassier2', password: 'kassier1234' }) });
    const ck3 = (r3.headers.get('set-cookie') || '').split(';')[0];
    [s, , r, buf] = await A(X(`member/${max}/auskunft`), 'GET', undefined, { cookie: ck3 });
    const a = s === 200 ? JSON.parse(buf) : {}; ok('Datenauskunft mit Bankrecht: IBAN enthalten', s === 200 && a.bankverbindung && /^DE/.test(String(a.bankverbindung.iban || '')), JSON.stringify(a.bankverbindung)); }
  // ---- Ähnliche Namen beim Import (Spitznamen, Schreibvarianten)
  { const [, b1] = await A(X('member'), 'POST', { first_name: 'Benni', last_name: 'Fuchs', birth_date: '1985-03-12', email: 'benni@test.de' });
    const [, s1] = await A(X('member'), 'POST', { first_name: 'Susi', last_name: 'Kranz', email: 'susi@test.de' });
    const csv2 = '\ufeff' + head + '\r\n' + [
      row({ 'Mitglieds-Nr': '2201', Nachname: 'Fuchs', Vorname: 'Benedikt', Geburtsdatum: '12.03.1985', Status: 'Aktiv', Eintrittsdatum: '01.01.2015' }),
      row({ 'Mitglieds-Nr': '2202', Nachname: 'Kranz', Vorname: 'Susanne', Status: 'Aktiv', Eintrittsdatum: '01.01.2016' }),
      row({ 'Mitglieds-Nr': '2203', Nachname: 'Fuchs', Vorname: 'Benjamin', Geburtsdatum: '01.01.2010', Status: 'Aktiv', Eintrittsdatum: '01.01.2018' }),
    ].join('\r\n') + '\r\n';
    [s, j] = await A(X('import/verein-cloud'), 'POST', Buffer.from(csv2), { raw: true, ctype: 'text/csv' });
    const rB = j.rows.find(r => r.name === 'Benedikt Fuchs'), rS = j.rows.find(r => r.name === 'Susanne Kranz'), rJ = j.rows.find(r => r.name === 'Benjamin Fuchs');
    ok('Ähnlich: Benni ↔ Benedikt (gleiches Geburtsdatum)', rB && rB.suggest.length === 1 && rB.suggest[0].id === b1.id && rB.suggest[0].sameBirth && /Spitzname/.test(rB.suggest[0].why), JSON.stringify(rB && rB.suggest));
    ok('Ähnlich: Susi ↔ Susanne', rS && rS.suggest.some(c => c.id === s1.id), JSON.stringify(rS && rS.suggest));
    ok('Anderes Geburtsdatum = kein Vorschlag (Benjamin)', rJ && !rJ.suggest.some(c => c.id === b1.id), JSON.stringify(rJ && rJ.suggest));
    ok('Vorschau zählt ähnliche', j.similar === 2, j.similar);
    const decide = d => ({ raw: true, ctype: 'text/csv', headers: { 'X-Decisions': encodeURIComponent(JSON.stringify(d)) } });
    [s, j] = await A(X('import/verein-cloud?commit=1'), 'POST', Buffer.from(csv2), decide({ [rB.line]: b1.id, [rS.line]: b1.id })); ok('Falsche Zuordnung abgelehnt', s === 400, j.error);
    [s, j] = await A(X('import/verein-cloud?commit=1'), 'POST', Buffer.from(csv2), decide({ [rB.line]: b1.id, [rS.line]: 'neu' })); ok('Import mit Entscheidungen', s === 200 && j.updated === 1 && j.created === 2, JSON.stringify(j));
    [s, j] = await A(X('member/' + b1.id)); ok('Benni zusammengeführt (Daten aus der Datei)', j.person.first_name === 'Benedikt' && j.person.member_no === '2201' && j.person.email === 'benni@test.de', JSON.stringify({ f: j.person.first_name, n: j.person.member_no, e: j.person.email }));
    [s, j] = await A(X('list?q=kranz')); ok('Susanne neu angelegt, Susi bleibt', j.length === 2, JSON.stringify(j.map(x => x.name))); }
  // ---- Datenschutz
  [s, , r, buf] = await A(X(`member/${max}/auskunft`)); ok('Datenauskunft', s === 200 && JSON.parse(buf).vereinsdaten.first_name === 'Maximilian');
  [s, j] = await A(X(`member/${lena}/exit`), 'POST', { exit_date: '2025-12-31', reason: 'Umzug' }); ok('Austritt Lena', s === 200, j.error);
  [s, j] = await A(X(`member/${lena}/anonymize`), 'POST', { confirm: 'ANONYMISIEREN' }); ok('Anonymisieren mit offenen Posten verweigert', s === 400, j.error);
  [s, j] = await A(X(`charges?member=${lena}&status=offen`)); for (const c of j.rows) await A(X(`charges/${c.id}/cancel`), 'POST', { reason: 'Test erledigt' });
  [s, j] = await A(X(`member/${lena}/anonymize`), 'POST', { confirm: 'falsch' }); ok('Bestätigung nötig', s === 400);
  [s, j] = await A(X(`member/${lena}/anonymize`), 'POST', { confirm: 'ANONYMISIEREN' }); ok('Anonymisiert', s === 200, j.error);
  [s, j] = await A(X('member/' + lena)); ok('Keine Personendaten mehr', !j.person.first_name && !j.person.email && !j.bank && /^Anonym/.test(j.person.last_name), JSON.stringify(j.person).slice(0, 200));
  // ---- Funktionsexport ohne Personen
  [s, j] = await A('api/admin/extensions/mitglieder/export'); const ex = JSON.stringify(j);
  ok('Funktionsexport ohne Personen/IBAN', s === 200 && !/Maximilian|DE89|DE02120300000000202051|geheim/.test(ex) && /Familie mit Kindern/.test(ex), ex.slice(0, 200));
  // Fehler im Log?
  const log = fs.readFileSync(S + '/mv_srv.log', 'utf8'); ok('Keine Fehler im Log', !/TypeError|ReferenceError|SqliteError|is not a function/.test(log), log.split('\n').filter(l => /Error/.test(l)).slice(0, 5).join(' / '));
  // ---- Neue Mitglieder nur vollständig (3.9)
  { const base = { __filled: true, first_name: 'Neu', last_name: 'Komplett', birth_date: '1990-05-05', street: 'Weg 2', zip: '65599', city: 'Dornburg', email: 'neu@test.de', mobile: '0170 7654321', entry_date: '2026-01-01' };
    const [, mm] = await A(X('meta')); const adult = mm.fees.find(f => f.active && f.kind !== 'zusatz' && (f.age_max == null || f.age_max >= 36) && (f.age_min == null || f.age_min <= 36)); const kidFee = mm.fees.find(f => f.active && f.kind !== 'zusatz' && f.age_max != null && f.age_max < 30);
    const up = async (buf, name = 'antrag.pdf', cookie = ck) => { const r = await fetch(B + X('member/new-document'), { method: 'POST', headers: { 'X-Clubwerk': '1', Cookie: cookie, 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(name) }, body: buf }); return [r.status, await r.json().catch(() => ({}))]; };
    const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4));
    [s, j] = await A(X('member'), 'POST', { ...base, fee_id: adult.id, payment: 'rechnung' }); ok('Neu ohne Beitrittserklärung abgelehnt', s === 400 && /Beitrittserklärung/.test(j.error), j.error);
    [s, j] = await up(Buffer.from('MZ kein dokument')); ok('Upload: nur PDF oder Foto', s === 400, JSON.stringify(j));
    [s, j] = await up(PDF, 'Antrag Neu.pdf'); const dk = j.doc_id; ok('Beitrittserklärung hochgeladen', s === 200 && dk > 0, JSON.stringify(j));
    base.doc_id = dk;
    [s, j] = await A(X('member'), 'POST', { ...base, mobile: '' }); ok('Neu ohne Handy abgelehnt', s === 400 && /Handynummer/.test(j.error), j.error);
    [s, j] = await A(X('member'), 'POST', { ...base, street: '', city: '' }); ok('Neu ohne Adresse abgelehnt', s === 400 && /Straße/.test(j.error) && /Ort/.test(j.error), j.error);
    [s, j] = await A(X('member'), 'POST', { ...base }); ok('Neu ohne Beitrag abgelehnt', s === 400 && /Beitrag/.test(j.error), j.error);
    if (kidFee) { [s, j] = await A(X('member'), 'POST', { ...base, fee_id: kidFee.id, payment: 'rechnung' }); ok('Neu: Beitrag passt nicht zum Alter', s === 400 && /gilt nur/.test(j.error), j.error); }
    [s, j] = await A(X('member'), 'POST', { ...base, fee_id: adult.id, payment: 'lastschrift' }); ok('Lastschrift ohne IBAN abgelehnt', s === 400 && /IBAN/.test(j.error), j.error);
    [s, j] = await A(X('member'), 'POST', { ...base, fee_id: adult.id, payment: 'lastschrift', iban: 'DE89370400440532013000', mandate_date: '2026-01-01' }); ok('Lastschrift ohne Kontoinhaber abgelehnt', s === 400 && /Kontoinhaber/.test(j.error), j.error);
    [s, j] = await A(X('member'), 'POST', { ...base, fee_id: adult.id, payment: 'lastschrift', iban: 'DE89370400440532013000', holder: 'Neu Komplett', mandate_date: '2026-01-01' }); const nk = j.id; ok('Vollständig angelegt', s === 200 && nk, j.error);
    [s, j] = await A(X('member/' + nk)); ok('… mit Beitrag, Mandat und Kontakt', j.fees.length === 1 && j.bank && j.bank.mandate_ref && j.bank.holder === 'Neu Komplett' && j.person.mobile === '0170 7654321' && j.person.street === 'Weg 2', JSON.stringify({ f: j.fees.length, b: j.bank, m: j.person.mobile }));
    ok('… und Beitrittserklärung bei den Dokumenten', (j.documents || []).some(d => d.id === dk && d.kind === 'antrag'), JSON.stringify(j.documents));
    [s, j] = await A(X('member'), 'POST', { ...base, first_name: 'Zweit', email: 'zweit@test.de', fee_id: adult.id, payment: 'rechnung' }); ok('Beitrittserklärung nur einmal verwendbar', s === 400 && /Beitrittserklärung/.test(j.error), j.error); }
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK');
  if (process.env.KEEP) { console.log('Server läuft weiter (KEEP)'); return; }
  srv.kill();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv && srv.kill(); process.exit(1); });
