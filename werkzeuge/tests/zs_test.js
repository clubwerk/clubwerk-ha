// Mitgliederverwaltung: API-Ende-zu-Ende. Startet den Server selbst.  node mv_test.js <S>
const { spawn, execFileSync } = require('child_process'); const fs = require('fs'); const zlib = require('zlib');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_zs'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
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
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3282', BEREGNUNG_PORT: '5282', MEMBER_PORT: '5283', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/zs_srv.log', 'w'), fs.openSync(S + '/zs_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
const iso = d => d.toISOString().slice(0, 10);
(async () => {
  let s, j;
  await start();
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true } });
  await A(X('settings'), 'PUT', { creditor_id: 'DE98ZZZ09999999999', club_iban: 'DE02120300000000202051', mandate_prefix: 'TCF', year_start: '05-01' });
  const y = new Date().getFullYear();
  [s, j] = await A(X('departments'), 'POST', { name: 'Padel' }); const padel = j.id;
  const fee = async b => { const r = await A(X('fees'), 'POST', b); return r[1].id || r; };
  const fFam = await fee({ name: 'Familie', cents: 18500, family: 1 });
  const fFrei = await fee({ name: 'Erwachsene (Eintrittsjahr frei)', cents: 10800, prorate: 'frei' });
  const zE = await fee({ kind: 'zusatz', department_id: padel, name: 'Padel Erwachsene', cents: 6000, age_min: 19 });
  const zJ = await fee({ kind: 'zusatz', department_id: padel, name: 'Padel Jugend', cents: 3000, age_max: 18 });
  ok('Zusatzbeiträge angelegt', typeof zE === 'number' && typeof zJ === 'number', JSON.stringify([zE, zJ]));
  [s, j] = await A(X('fees'), 'POST', { kind: 'zusatz', name: 'Ohne Abteilung', cents: 100 }); ok('Zusatz ohne Abteilung abgelehnt', s === 400, j.error);
  [s, j] = await A(X('fees'), 'POST', { kind: 'zusatz', department_id: padel, name: 'Padel Monat', cents: 100, interval: 'monat' }); ok('Anderer Rhythmus abgelehnt', s === 400, j.error);
  const st0 = `${y - 1}-05-01`;
  const mk = async (f, b, extra = {}) => (await A(X('member'), 'POST', { first_name: f, last_name: 'Muster', birth_date: b, entry_date: st0, ...extra }))[1].id;
  const max = await mk('Max', '1980-01-01'), eva = await mk('Eva', '1982-01-01'), paul = await mk('Paul', `${y - 13}-01-01`), tim = await mk('Tim', `${y - 10}-01-01`);
  for (const k of [eva, paul, tim]) await A(X(`member/${k}/payer`), 'PUT', { payer_id: max });
  await A(X(`member/${max}/fees`), 'POST', { fee_id: fFam, start_date: st0, booked_until: `${y + 5}-04-30` });
  [s, j] = await A(X(`member/${max}/fees`), 'POST', { fee_id: zE, start_date: st0 }); ok('Zusatz nicht manuell zuordenbar', s === 400, j.error);
  for (const k of [max, paul]) await A(X(`member/${k}/departments`), 'POST', { department_id: padel, entry_date: `${y}-05-01` > new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) ? `${y - 1}-05-01` : `${y}-05-01` });
  [s, j] = await A(X('member/' + paul)); ok('Zusatz im Mitglied nach Alter', j.departments[0].zusatz && j.departments[0].zusatz.name === 'Padel Jugend', JSON.stringify(j.departments[0]));
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  [s, j] = await A(X('runs/preview'), 'POST', { until: today });
  const zp = j.positions.filter(p => /Padel/.test(p.text));
  ok('Zusatz je Person beim Hauptzahler', zp.length >= 2 && zp.every(p => p.member_id === max) && zp.some(p => p.for_member_id === paul && /Jugend/.test(p.text)) && zp.some(p => p.for_member_id === max && /Erwachsene/.test(p.text)) && !zp.some(p => p.for_member_id === eva || p.for_member_id === tim), JSON.stringify(zp.map(p => [p.text, p.cents])));
  // ohne Geburtsdatum → Erwachsenenstufe mit Hinweis
  const nob = (await A(X('member'), 'POST', { first_name: 'Ohne', last_name: 'Datum', entry_date: st0 }))[1].id;
  await A(X(`member/${nob}/departments`), 'POST', { department_id: padel, entry_date: today });
  [s, j] = await A(X('member/' + nob)); ok('Ohne Geburtsdatum: Erwachsenen-Zusatz angenommen', j.departments[0].zusatz && j.departments[0].zusatz.name === 'Padel Erwachsene' && j.departments[0].zusatz.assumed, JSON.stringify(j.departments[0]));
  [s, j] = await A(X('runs/preview'), 'POST', { until: today }); ok('Ohne Geburtsdatum: Position + Warnung', j.positions.some(p => p.for_member_id === nob && /Erwachsene/.test(p.text)) && j.warnings.some(w => /Geburtsdatum fehlt/.test(w.text)), JSON.stringify(j.warnings));
  [s, j] = await A(X('member/' + nob)); await A(X('md/' + j.departments[0].id), 'DELETE');
  // Befreiung / fester Beitrag
  [s, j] = await A(X('member/' + paul)); const mdP = j.departments[0].id;
  await A(X('md/' + mdP), 'PUT', { fee_free: true });
  [s, j] = await A(X('runs/preview'), 'POST', { until: today }); ok('Befreit → kein Zusatz', !j.positions.some(p => p.for_member_id === paul && /Padel/.test(p.text)));
  await A(X('md/' + mdP), 'PUT', { fee_free: false, fee_id: zE });
  [s, j] = await A(X('runs/preview'), 'POST', { until: today }); ok('Fester Zusatzbeitrag', j.positions.some(p => p.for_member_id === paul && /Padel Erwachsene/.test(p.text)));
  await A(X('md/' + mdP), 'PUT', { fee_id: null });
  // Eintrittsjahr frei
  const neu = await mk('Nora', '1990-01-01', { last_name: 'Neu', entry_date: today });
  await A(X(`member/${neu}/fees`), 'POST', { fee_id: fFrei, start_date: today });
  [s, j] = await A(X('runs/preview'), 'POST', { until: today });
  ok('Eintrittsjahr frei: keine Position, Hinweis', !j.positions.some(p => p.for_member_id === neu) && j.marks.some(m => m.name.includes('Nora')) && j.info.some(i => /beitragsfrei/.test(i)), JSON.stringify({ info: j.info, marks: j.marks }));
  [s, j] = await A(X('runs'), 'POST', { until: today }); const run = j.run; ok('Lauf', s === 200, j.error);
  [s, j] = await A(X('member/' + neu)); ok('Freies Jahr als abgerechnet vermerkt', j.fees[0].booked_until && j.fees[0].booked_until >= today, JSON.stringify(j.fees[0]));
  [s, j] = await A(X('member/' + max)); const mdM = j.departments.find(x => x.department_id === padel); ok('Zusatz abgerechnet bis', Boolean(mdM.booked_until), JSON.stringify(mdM));
  [s, j] = await A(X('runs/preview'), 'POST', { until: today }); ok('Nichts doppelt', j.positions.length === 0 && j.marks.length === 0, JSON.stringify(j.positions.map(p => p.text)));
  [s, j] = await A(X('md/' + mdM.id), 'DELETE'); ok('Abteilung mit Abrechnung nicht löschbar', s === 400);
  [s, j] = await A(X('runs/' + run), 'DELETE'); ok('Lauf zurück', s === 200, j.error);
  [s, j] = await A(X('member/' + neu)); ok('Rücknahme setzt freies Jahr zurück', !j.fees[0].booked_until, JSON.stringify(j.fees[0]));
  [s, j] = await A(X('member/' + max)); ok('Rücknahme setzt Zusatz zurück', !j.departments.find(x => x.department_id === padel).booked_until);
  // Antrag zeigt keine Zusatzbeiträge
  [s, j] = await A('api/tablet/x/mitglieder/antrag/config'); ok('Formular: Zusatz nicht als Mitgliedschaft, aber als Abteilung', !j.fees.some(f => /Padel/.test(f.name)) && j.departments.length === 1 && j.departments[0].fees.length === 2, JSON.stringify(j.departments));
  const png = fs.readFileSync(S + '/sig.txt', 'utf8');
  const appData = { persons: [{ first_name: 'Vater', last_name: 'Antrag', birth_date: '1980-02-02', departments: [padel] }, { first_name: 'Kind', last_name: 'Antrag', birth_date: `${y - 9}-02-02`, role: 'kind' }],
    street: 'Weg 1', zip: '65599', city: 'Dornburg', email: 'vater@test.de', fee_id: fFam, holder: 'Vater Antrag', iban: 'DE89370400440532013000', consents: { daten: true } };
  [s, j] = await A('api/tablet/x/mitglieder/antrag', 'POST', { data: appData, sig_member: png, sig_mandate: png }); ok('Antrag mit Abteilung am Tablet', s === 200, j.error);
  [s, j] = await A(X('applications')); const ap = j.find(a => a.names.includes('Vater')); ok('Abteilung im Antrag gespeichert', ap && ap.data.persons[0].departments[0] === padel && !ap.data.persons[1].departments.length, JSON.stringify(ap && ap.data.persons));
  [s, , , j] = await A(X(`applications/${ap.id}/pdf`)); ok('Antrags-PDF', s === 303 || (j && j.slice(0, 4).toString() === '%PDF'));
  [s, j] = await A(X(`applications/${ap.id}/accept`), 'POST', {}); ok('Angenommen', s === 200, j.error);
  [s, j] = await A(X('member/' + j.member_id)); ok('Vater in Padel mit Zusatzbeitrag', j.departments.length === 1 && j.departments[0].zusatz && j.departments[0].zusatz.name === 'Padel Erwachsene', JSON.stringify(j.departments));
  [s, , , j] = await A(X('applications-blank.pdf')); ok('Leeres Formular mit Abteilungen', s === 200 && j.slice(0, 4).toString() === '%PDF');
  // Familienregeln im Antrag
  const base = { ...appData, persons: appData.persons.map(p => ({ ...p })) };
  [s, j] = await A('api/tablet/x/mitglieder/antrag', 'POST', { data: { ...base, fee_id: fFrei }, sig_member: png, sig_mandate: png }); ok('Mehrere Personen → nur Familienbeitrag', s === 400 && /Familien/.test(j.error), j.error);
  [s, j] = await A('api/tablet/x/mitglieder/antrag', 'POST', { data: { ...base, persons: [base.persons[0]] }, sig_member: png, sig_mandate: png }); ok('Eine Person → kein Familienbeitrag', s === 400 && /Familienmitgliedschaft gilt nur/.test(j.error), j.error);
  [s, j] = await A('api/tablet/x/mitglieder/antrag', 'POST', { data: { ...base, persons: [base.persons[0], { ...base.persons[1], birth_date: `${y - 20}-01-01` }] }, sig_member: png, sig_mandate: png }); ok('Kind über 18 abgelehnt', s === 400 && /bis 18/.test(j.error), j.error);
  [s, j] = await A('api/tablet/x/mitglieder/antrag/config'); ok('Formular kennt Kinder-Höchstalter', j.child_max === 18);
  const log = fs.readFileSync(S + '/zs_srv.log', 'utf8'); ok('Keine Fehler im Log', !/TypeError|ReferenceError|SqliteError|is not a function/.test(log), log.split('\n').filter(l => /Error/.test(l)).slice(0, 5).join(' / '));
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK');
  if (process.env.KEEP) return;
  srv.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv && srv.kill(); process.exit(1); });
