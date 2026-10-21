// Mitgliederverwaltung: API-Ende-zu-Ende. Startet den Server selbst.  node mv_test.js <S>
const { spawn, execFileSync } = require('child_process'); const fs = require('fs'); const zlib = require('zlib');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_aud'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3282/', M = 'http://127.0.0.1:5283/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
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
async function A(url, method = 'GET', body, { raw, cookie, base = B, dev, ctype } = {}) {
  if (method === 'POST' && /x\/mitglieder\/member$/.test(url) && body && typeof body === 'object' && !body.__filled) return fillMember(body, arguments[3]);
  if (body && body.__filled) { body = { ...body }; delete body.__filled; }
  const h = { 'X-Clubwerk': '1', Cookie: base === B ? (cookie || ck) : '' }; if (dev) h['X-Geraet'] = dev;
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
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3282', BEREGNUNG_PORT: '5282', MEMBER_PORT: '5283', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/aud_srv.log', 'w'), fs.openSync(S + '/aud_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
const TODAY = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
(async () => {
  let s, j;
  await start();
  await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true } });
  await A(X('settings'), 'PUT', { creditor_id: 'DE46ZZZ00000387335', club_iban: 'DE02120300000000202051', mandate_prefix: 'TCF', year_start: '01-01' });
  const y = +TODAY.slice(0, 4);
  const padel = (await A(X('departments'), 'POST', { name: 'Padel' }))[1].id;
  const fee = async b => (await A(X('fees'), 'POST', b))[1].id;
  const mk = async (f, b, extra = {}) => (await A(X('member'), 'POST', { first_name: f, last_name: 'Test', birth_date: b, entry_date: '2020-01-01', ...extra }))[1].id;
  const prev = async (o = {}) => (await A(X('runs/preview'), 'POST', { until: TODAY, ...o }))[1];
  // 1) seit 2021 in der Abteilung, Zusatzbeitrag erst jetzt angelegt → nur laufendes Jahr
  const old = await mk('Alt', '1970-01-01');
  await A(X(`member/${old}/departments`), 'POST', { department_id: padel, entry_date: '2021-03-01' });
  const zE = await fee({ kind: 'zusatz', department_id: padel, name: 'Padel Erwachsene', cents: 6000, age_min: 19 });
  j = await prev(); let zp = j.positions.filter(p => p.for_member_id === old);
  ok('1 Kein Nachberechnen alter Jahre', zp.length === 1 && zp[0].period_from === `${y}-01-01`, JSON.stringify(zp.map(p => p.text)));
  // 1b) neue Abteilungszugehörigkeit mit altem Eintritt
  const old2 = await mk('Alt2', '1971-01-01');
  await A(X(`member/${old2}/departments`), 'POST', { department_id: padel, entry_date: '2019-06-01' });
  j = await prev(); zp = j.positions.filter(p => p.for_member_id === old2); ok('1b Alte Eintritte nur ab laufendem Jahr', zp.length === 1 && zp[0].period_from === `${y}-01-01`, JSON.stringify(zp.map(p => p.text)));
  // 3) 18-Jähriger, nur „ab 19“ → beitragsfrei vermerkt, später zahlt er
  const teen = await mk('Teen', `${y - 18}-12-31`, { entry_date: `${y}-01-01` });
  await A(X(`member/${teen}/departments`), 'POST', { department_id: padel, entry_date: `${y}-01-01` });
  [s, j] = await A(X('member/' + teen)); ok('3 Anzeige beitragsfrei nach Alter', j.departments[0].zusatz_nomatch && j.departments[0].zusatz_age === 17, JSON.stringify(j.departments[0]));
  j = await prev({ until: `${y + 2}-01-01` }); zp = j.positions.filter(p => p.for_member_id === teen);
  ok('3 Später volljährig → Zusatz ab dann', zp.length >= 1 && zp.every(p => p.period_from >= `${y + 1}-01-01`) && j.marks.some(m => m.name.includes('Teen')), JSON.stringify({ p: zp.map(p => p.text), w: j.warnings }));
  // 5) Befreiung an/aus → nur ab laufendem Jahr
  const fc = await mk('Frei', '1980-01-01');
  await A(X(`member/${fc}/departments`), 'POST', { department_id: padel, entry_date: `${y}-01-01` });
  [s, j] = await A(X('member/' + fc)); const mdF = j.departments[0].id;
  await A(X('md/' + mdF), 'PUT', { fee_free: true, booked_until: `${y - 3}-12-31` });
  await A(X('md/' + mdF), 'PUT', { fee_free: false });
  j = await prev(); zp = j.positions.filter(p => p.for_member_id === fc); ok('5 Befreiung aufgehoben → keine Nachzahlung', zp.length === 1 && zp[0].period_from === `${y}-01-01`, JSON.stringify(zp.map(p => p.text)));
  // 6) Art einer benutzten Beitragsart ändern → abgelehnt
  const fG = await fee({ name: 'Erwachsene', cents: 10000 });
  const ob = await mk('Undo', '1975-01-01');
  await A(X(`member/${ob}/fees`), 'POST', { fee_id: fG, start_date: `${y}-01-01` });
  [s, j] = await A(X(`fees/${fG}`), 'PUT', { kind: 'zusatz', department_id: padel }); ok('6 Art nicht änderbar, wenn benutzt', s === 400, j.error);
  // 4) Älteren Lauf zurücknehmen nach neuerem → nichts doppelt
  [s, j] = await A(X('runs'), 'POST', { until: `${y}-12-31`, fee: fG }); const r1 = j.run;
  [s, j] = await A(X('runs'), 'POST', { until: `${y + 1}-12-31`, fee: fG }); const r2 = j.run; ok('4 zwei Läufe', r1 && r2, JSON.stringify(j));
  [s, j] = await A(X(`runs/${r1}`), 'DELETE');
  j = await prev({ until: `${y + 1}-12-31`, fee: fG }); zp = j.positions.filter(p => p.for_member_id === ob);
  ok('4 Rücknahme alter Lauf: kein Doppel', !zp.some(p => p.period_from === `${y + 1}-01-01`), JSON.stringify(zp.map(p => p.text)));
  // 14) Teilzahlung: Rest behält Bezug
  [s, j] = await A(X('charges?member=' + ob)); const ch = j.rows.find(r => r.status === 'offen');
  await A(X(`charges/${ch.id}/pay`), 'POST', { cents: 1000, via: 'bar' });
  [s, j] = await A(X('charges?member=' + ob)); const rest = j.rows.find(r => /^Rest/.test(r.text)); ok('14 Rest mit Beitragsbezug', rest && rest.member_fee_id === ch.member_fee_id, JSON.stringify(rest));
  // 7) Zahler-Kette
  const max = await mk('Max', '1980-01-01'), eva = await mk('Eva', '1982-01-01'), tim = await mk('Tim', `${y - 8}-01-01`);
  await A(X(`member/${eva}/payer`), 'PUT', { payer_id: max });
  [s, j] = await A(X(`member/${tim}/payer`), 'PUT', { payer_id: eva });
  [s, j] = await A(X('member/' + tim)); ok('7 Kette → Hauptzahler', j.person.payer_id === max, j.person.payer_id);
  // 8) Rückkehr öffnet Beitrag & Abteilung, ohne die Pause nachzuberechnen
  const bk = await mk('Back', '1979-01-01');
  await A(X(`member/${bk}/fees`), 'POST', { fee_id: fG, start_date: '2020-01-01', booked_until: `${y - 3}-12-31` });
  await A(X(`member/${bk}/departments`), 'POST', { department_id: padel, entry_date: '2020-01-01' });
  await A(X(`member/${bk}/exit`), 'POST', { exit_date: `${y - 3}-12-31` });
  [s, j] = await A(X(`member/${bk}/reenter`), 'POST', {}); ok('8 Rückkehr', s === 200, j.error);
  [s, j] = await A(X('member/' + bk)); ok('8 Beitrag und Abteilung wieder offen', !j.fees[0].end_date && !j.departments[0].exit_date, JSON.stringify([j.fees[0], j.departments[0]]));
  j = await prev(); zp = j.positions.filter(p => p.for_member_id === bk); ok('8 Nur laufendes Jahr', zp.length === 2 && zp.every(p => p.period_from === `${y}-01-01`), JSON.stringify(zp.map(p => p.text)));
  // 15) alles abgewählt
  j = await prev(); [s, j] = await A(X('runs'), 'POST', { until: TODAY, skip: j.positions.map(p => p.key) });
  ok('15 Meldung bei allem abgewählt', s === 400 && /abgewählt/.test(j.error) || s === 200, j.error);
  // 11) Zählung je Altersstufe
  const zJ = await fee({ kind: 'zusatz', department_id: padel, name: 'Padel Jugend', cents: 3000, age_max: 18 });
  [s, j] = await A(X('meta')); const cE = j.fees.find(f => f.id === zE).members, cJ = j.fees.find(f => f.id === zJ).members; ok('11 Zählung je Stufe', cJ === 1 && cE >= 4, `${cE}/${cJ}`);
  // 2) Import: Hauptverein + Padel → Padel als Zusatzbeitrag, gebucht bis an der Abteilung
  const csv = fs.readFileSync(S + '/vc_hv.csv');
  [s, j] = await A(X('import/verein-cloud?commit=1'), 'POST', csv, { raw: true }); ok('2 Import', s === 200, JSON.stringify(j).slice(0, 200));
  [s, j] = await A(X('list')); const im = j.find(r => r.name.includes('Import0'));
  [s, j] = await A(X('member/' + im.id)); const mdI = j.departments.find(d => d.name === 'Padel');
  ok('2 Padel als Zusatz (kein Mitgliedsbeitrag)', !j.fees.some(f => /Padel/.test(f.name)) && mdI && mdI.booked_until === '2027-04-30', JSON.stringify({ fees: j.fees.map(f => f.name), md: mdI }));
  [s, j] = await A(X('meta')); ok('2 Importierte Beitragsart ist Zusatz', j.fees.some(f => /Padel Erwachsene ab 19/.test(f.name) && f.kind === 'zusatz'));
  const log = fs.readFileSync(S + '/aud_srv.log', 'utf8'); ok('Keine Fehler im Log', !/TypeError|ReferenceError|SqliteError|is not a function/.test(log), log.split('\n').filter(l => /Error/.test(l)).slice(0, 5).join(' / '));
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK');
  srv.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv && srv.kill(); process.exit(1); });
