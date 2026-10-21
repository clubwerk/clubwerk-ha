// Mitgliederverwaltung: API-Ende-zu-Ende. Startet den Server selbst.  node mv_test.js <S>
const { spawn, execFileSync } = require('child_process'); const fs = require('fs'); const zlib = require('zlib');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_age'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
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
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3282', BEREGNUNG_PORT: '5282', MEMBER_PORT: '5283', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/age_srv.log', 'w'), fs.openSync(S + '/age_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
const TODAY = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
(async () => {
  let s, j;
  await start();
  await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true } });
  await A(X('settings'), 'PUT', { year_start: '01-01' });
  const y = +TODAY.slice(0, 4);
  const padel = (await A(X('departments'), 'POST', { name: 'Padel' }))[1].id;
  const fee = async b => (await A(X('fees'), 'POST', b))[1].id;
  const fJ = await fee({ name: 'Jugend', cents: 4000, age_max: 18 }), fE = await fee({ name: 'Erwachsene', cents: 10000, age_min: 19 }), fF = await fee({ name: 'Familie', cents: 18000, family: 1 });
  const zJ = await fee({ kind: 'zusatz', department_id: padel, name: 'Padel Jugend', cents: 2000, age_max: 18 }), zE = await fee({ kind: 'zusatz', department_id: padel, name: 'Padel Erw.', cents: 6000, age_min: 19 });
  const b19 = `${y - 19}-12-31`;   // wird im nächsten Jahr 19
  const mk = async (f, b) => (await A(X('member'), 'POST', { first_name: f, last_name: 'Test', birth_date: b, entry_date: '2020-01-01' }))[1].id;
  const teen = await mk('Teen', b19); await A(X(`member/${teen}/fees`), 'POST', { fee_id: fJ, start_date: '2020-01-01', booked_until: `${y}-12-31` });
  await A(X(`member/${teen}/departments`), 'POST', { department_id: padel, entry_date: `${y}-01-01` });
  const dad = await mk('Papa', '1975-01-01'), kid = await mk('Kind', b19), mom = await mk('Mama', '1977-01-01');
  await A(X(`member/${dad}/fees`), 'POST', { fee_id: fF, start_date: '2020-01-01', booked_until: `${y}-12-31` });
  for (const k of [kid, mom]) await A(X(`member/${k}/payer`), 'PUT', { payer_id: dad });
  [s, j] = await A(X('age-notices')); const kinds = j.map(n => `${n.name}:${n.kind}`).sort();
  ok('Hinweise erkannt', kinds.join() === ['Kind Test:family', 'Teen Test:fee', 'Teen Test:zusatz'].join(), JSON.stringify(kinds));
  ok('Partnerin nicht betroffen', !j.some(n => n.member_id === mom));
  const nFee = j.find(n => n.kind === 'fee'), nZ = j.find(n => n.kind === 'zusatz'), nFam = j.find(n => n.kind === 'family');
  ok('Fälligkeit nächstes Jahr', nFee.due_date === `${y + 1}-01-01` && nFee.to.name === 'Erwachsene', JSON.stringify(nFee));
  // Beitragslauf nächstes Jahr: Zusatz bleibt bei Jugend, solange offen
  [s, j] = await A(X('runs/preview'), 'POST', { until: `${y + 1}-01-01` });
  const zp = j.positions.filter(p => p.for_member_id === teen && /Padel/.test(p.text));
  ok('Offen → bisherige Zusatzstufe', zp.length && zp.every(p => /Padel Jugend/.test(p.text)), JSON.stringify(zp.map(p => p.text)));
  ok('Info im Lauf', j.info.some(i => /Altersstufen/.test(i)), JSON.stringify(j.info));
  // Entscheidungen
  [s, j] = await A(X('age-notices/' + nFee.id), 'POST', { action: 'umstellen' }); ok('Umstellen', s === 200, j.error);
  [s, j] = await A(X('member/' + teen)); ok('Neuer Beitrag ab 01.01.', j.fees.some(f => f.name === 'Erwachsene' && f.start_date === `${y + 1}-01-01`) && j.fees.some(f => f.name === 'Jugend' && f.end_date === `${y}-12-31`), JSON.stringify(j.fees.map(f => [f.name, f.start_date, f.end_date])));
  [s, j] = await A(X('age-notices/' + nZ.id), 'POST', { action: 'belassen' }); ok('Belassen', s === 200);
  [s, j] = await A(X('member/' + teen)); ok('Zusatz fest auf Jugend', j.departments[0].fee_id === zJ, JSON.stringify(j.departments[0]));
  if (nFam) [s, j] = await A(X('age-notices/' + nFam.id), 'POST', { action: 'belassen' });   // Familien-Hinweis gibt es nur, wenn die Familienregeln einen erzeugen
  [s, j] = await A(X('age-notices')); ok('Keine erneuten Hinweise', j.length === 0, JSON.stringify(j.map(n => n.kind)));
  [s, j] = await A(X('age-notices/' + nFee.id), 'POST', { action: 'umstellen' }); ok('Doppelt entscheiden abgelehnt', s === 400);
  const log = fs.readFileSync(S + '/age_srv.log', 'utf8'); ok('Keine Fehler im Log', !/TypeError|ReferenceError|SqliteError|is not a function/.test(log), log.split('\n').filter(l => /Error/.test(l)).slice(0, 5).join(' / '));
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK');
  if (process.env.KEEP) { await A('api/admin/users', 'POST', { name: 'Anna Abteilung', password: 'Test-Kennwort-42', roles: [3], departments: [padel] }); const t2 = await mk('Junior', `${y - 19}-11-30`); await A(X(`member/${t2}/fees`), 'POST', { fee_id: fJ, start_date: '2020-01-01' }); await A(X('age-notices')); return; }
  srv.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv && srv.kill(); process.exit(1); });
