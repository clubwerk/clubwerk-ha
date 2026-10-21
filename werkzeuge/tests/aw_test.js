// Mitgliederverwaltung: API-Ende-zu-Ende. Startet den Server selbst.  node mv_test.js <S>
const { spawn, execFileSync } = require('child_process'); const fs = require('fs'); const zlib = require('zlib');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_aw'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3272/', M = 'http://127.0.0.1:5273/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
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
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3272', BEREGNUNG_PORT: '5272', MEMBER_PORT: '5273', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/aw_srv.log', 'w'), fs.openSync(S + '/aw_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
const iso = d => d.toISOString().slice(0, 10);
(async () => {
  let s, j;
  await start();
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true, arbeitseinsatz: true } });
  ok('Setup', s === 200, JSON.stringify(j));
  const W = p => 'api/admin/x/arbeitseinsatz/' + p;
  const y = new Date().getFullYear(), py = y - 1;
  await A(X('settings'), 'PUT', { creditor_id: 'DE46ZZZ00000387335', club_iban: 'DE02120300000000202051', mandate_prefix: 'TCF' });
  const fee = async b => (await A(X('fees'), 'POST', b))[1].id;
  const fFam = await fee({ name: 'Familie', cents: 18500, family: 1 });
  const fErw = await fee({ name: 'Erwachsene', cents: 10800, age_min: 19 });
  const fUnt = await fee({ name: 'Unterstützend', cents: 3900, work_minutes: 0 });
  const mk = async (f, l, b, extra = {}) => (await A(X('member'), 'POST', { first_name: f, last_name: l, birth_date: b, entry_date: '2020-01-01', email: f.toLowerCase() + '@test.de', ...extra }))[1].id;
  const max = await mk('Max', 'Muster', '1980-01-01'), eva = await mk('Eva', 'Muster', '1982-01-01'), paul = await mk('Paul', 'Muster', '2010-01-01'), kid = await mk('Kim', 'Muster', '2016-01-01');
  const lena = await mk('Lena', 'Single', '1990-01-01'), udo = await mk('Udo', 'Unterst', '1950-01-01');
  for (const k of [eva, paul, kid]) await A(X(`member/${k}/payer`), 'PUT', { payer_id: max });
  await A(X(`member/${max}/fees`), 'POST', { fee_id: fFam, start_date: '2020-01-01', booked_until: `${y}-12-31` });
  await A(X(`member/${lena}/fees`), 'POST', { fee_id: fErw, start_date: '2020-01-01', booked_until: `${y}-12-31` });
  await A(X(`member/${udo}/fees`), 'POST', { fee_id: fUnt, start_date: '2020-01-01', booked_until: `${y}-12-31` });
  [s, j] = await A(W('meta')); ok('Meta', s === 200 && j.cfg.default_minutes === 240 && j.mv, JSON.stringify(j).slice(0, 200));
  [s, j] = await A(W('overview?year=' + py));
  const fam = j.families.find(f => f.head === max), lf = j.families.find(f => f.head === lena);
  ok('Familien-Soll (Kind unter 12 befreit)', fam && fam.target === 720 && fam.members.length === 4, JSON.stringify(fam));
  ok('Unterstützend befreit', !j.families.find(f => f.head === udo) && j.rows.find(r => r.id === udo).why.includes('befreit'), JSON.stringify(j.rows.find(r => r.id === udo)));
  ok('Kind: Begründung', /unter 12/.test(j.rows.find(r => r.id === kid).why));
  [s, j] = await A(W('entries'), 'POST', { member_ids: [max], date: `${py}-06-01`, minutes: 300, text: 'Plätze' }); ok('Nachgetragen', s === 200, j.error);
  await A(W('entries'), 'POST', { member_ids: [lena], date: `${py}-06-01`, minutes: 240, text: 'Theke' });
  [s, j] = await A(W('entries'), 'POST', { member_ids: [lena], date: `${y + 1}-01-01`, minutes: 60 }); ok('Zukunft abgelehnt', s === 400);
  [s, j] = await A(W('overview?year=' + py)); const f2 = j.families.find(f => f.head === max);
  ok('Fehlstunden & Betrag', f2.done === 300 && f2.missing === 420 && f2.cents === 10500 && j.families.find(f => f.head === lena).missing === 0, JSON.stringify(f2));
  [s, j] = await A(W('target'), 'PUT', { member_id: paul, year: py, minutes: 0, note: 'Verletzung' }); ok('Ausnahme', s === 200);
  [s, j] = await A(W('overview?year=' + py)); ok('Ausnahme wirkt', j.families.find(f => f.head === max).target === 480);
  await A(W('target'), 'PUT', { member_id: paul, year: py, minutes: null });
  [s, j] = await A(W('exempt'), 'PUT', { member_id: lena, note: 'Vorstand' }); ok('Mitglied befreit', s === 200);
  [s, j] = await A(W('overview?year=' + py)); const lr = j.rows.find(r => r.id === lena);
  ok('Befreit: kein Soll, Stunden zählen weiter', lr.target === 0 && /befreit: Vorstand/.test(lr.why) && lr.done === 240 && !(j.families.find(f => f.head === lena) || { cents: 0 }).cents, JSON.stringify(lr));
  [s, j] = await A(W('exempt')); ok('Befreiungen gelistet', j.some(x => x.member_id === lena && x.note === 'Vorstand'));
  [s, j] = await A(W('exempt'), 'PUT', { member_id: lena, until: `${py - 1}-12-31` }); [s, j] = await A(W('overview?year=' + py)); ok('Abgelaufene Befreiung wirkt nicht mehr', j.rows.find(r => r.id === lena).target === 240);
  await A(W('exempt/' + lena), 'DELETE');
  await A(W('settings'), 'PUT', { start_year: py });
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  [s, j] = await A(X('runs/preview'), 'POST', { until: today });
  const ap = j.positions.find(p => p.kind === 'arbeitsstunden');
  ok('Arbeitsstunden im Beitragslauf', ap && ap.member_id === max && ap.cents === 10500 && /7:00 h/.test(ap.text) && !j.positions.some(p => p.kind === 'arbeitsstunden' && p.period_to < `${py}-01-01`), JSON.stringify(j.positions));
  [s, j] = await A(X('runs'), 'POST', { until: today }); ok('Lauf', s === 200);
  [s, j] = await A(X('runs/preview'), 'POST', { until: today }); ok('Nicht doppelt', !j.positions.some(p => p.kind === 'arbeitsstunden'));
  [s, j] = await A(X('meta')); ok('Mitglieder-Meta kennt Arbeit', j.arbeit === true);
  // Einsätze
  [s, j] = await A(W('events'), 'POST', { kind: 'arbeit', title: 'Frühjahrsputz', date: today, start: '09:00', end: '12:00', slots: 1, repeat_weeks: 2 }); ok('Einsatz + Wiederholung', s === 200 && j.ids.length === 3, JSON.stringify(j));
  const ev1 = j.ids[0], ev2 = j.ids[1];
  [s, j] = await A(W('events'), 'POST', { title: 'X', date: today, start: '10:00', end: '09:00' }); ok('Ende vor Beginn abgelehnt', s === 400);
  // Tablet
  [s, j] = await A('api/tablet/x/arbeitseinsatz/state'); ok('Tablet-Status', s === 200 && j.events.some(e => e.id === ev1) && j.people.length >= 6, JSON.stringify(j).slice(0, 200));
  // dauerhafter Thekendienst
  [s, j] = await A(W('events')); const th = j.find(e => e.permanent && e.kind === 'theke'); ok('Thekendienst dauerhaft angelegt', th && th.title === 'Thekendienst' && !th.cancelled, JSON.stringify(j.map(e => [e.title, e.permanent])));
  [s, j] = await A('api/tablet/x/arbeitseinsatz/state'); ok('Thekendienst am Tablet wählbar', j.events.some(e => e.id === th.id && e.permanent));
  [s, j] = await A(W(`events/${th.id}/active`), 'POST', { active: false }); [s, j] = await A('api/tablet/x/arbeitseinsatz/state'); ok('Deaktivierter Thekendienst nicht wählbar', !j.events.some(e => e.id === th.id));
  [s, j] = await A(W(`events/${th.id}/active`), 'POST', { active: true });
  [s, j] = await A(W('events'), 'POST', { title: 'Platzpflege', kind: 'arbeit', permanent: true, repeat_weeks: 3 }); ok('Dauerhaft ohne Wiederholung', s === 200 && j.ids.length === 1, JSON.stringify(j)); const pp = j.ids[0];
  [s, j] = await A(W('events?past=1')); ok('Dauerhafte nicht bei Vergangenen', !j.some(e => e.permanent));
  [s, j] = await A(W('events?past=1&perm=1')); ok('… aber zum Nachtragen wählbar', j.some(e => e.id === pp));
  await A(W('events/' + pp), 'DELETE');
  // aktivieren / deaktivieren
  [s, j] = await A(W(`events/${ev1}/active`), 'POST', { active: false }); ok('Einsatz deaktiviert', s === 200 && j.active === false);
  [s, j] = await A('api/tablet/x/arbeitseinsatz/state'); ok('Deaktiviert nicht am Tablet', !j.events.some(e => e.id === ev1));
  [s, j] = await A(W('events')); ok('Deaktiviert in der Liste markiert', j.find(e => e.id === ev1).cancelled === 1);
  [s, j] = await A(W(`events/${ev1}/active`), 'POST', { active: true }); [s, j] = await A('api/tablet/x/arbeitseinsatz/state'); ok('Wieder aktiv am Tablet', j.events.some(e => e.id === ev1));
  [s, j] = await A(W('events'), 'POST', { title: 'Entwurf', date: today, active: false }); const evOff = j.ids[0];
  [s, j] = await A('api/tablet/x/arbeitseinsatz/state'); ok('Inaktiv angelegt', !j.events.some(e => e.id === evOff));
  await A(W('events/' + evOff), 'DELETE');
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: eva }); let tok = j.token;
  [s, j] = await A('api/tablet/x/arbeitseinsatz/start', 'POST', { token: tok, event_id: ev1 }); ok('Eingestempelt', s === 200, j.error);
  [s, j] = await A('api/tablet/x/arbeitseinsatz/start', 'POST', { token: 'falsch', text: 'abc' }); ok('Ohne Sitzung abgelehnt', s === 401);
  [s, j] = await A('api/tablet/x/arbeitseinsatz/state'); ok('Läuft', j.running.some(r => r.member_id === eva));
  // unter 5 Minuten: verworfen
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: lena }); [s, j] = await A('api/tablet/x/arbeitseinsatz/start', 'POST', { token: j.token, text: 'Kurz versehentlich' });
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: lena }); [s, j] = await A('api/tablet/x/arbeitseinsatz/stop', 'POST', { token: j.token });
  ok('Unter 5 Minuten nicht gewertet', s === 200 && j.discarded === true, JSON.stringify(j));
  [s, j] = await A(W('entries')); ok('… und verworfen', !j.some(e => e.text === 'Kurz versehentlich'));
  [s, j] = await A(W('entries'), 'POST', { member_ids: [lena], date: today, minutes: 3, text: 'x' }); ok('Nachtragen unter 5 Min. abgelehnt', s === 400, j.error);
  { const D = require(APP + '/node_modules/better-sqlite3'); const d = new D(DATA + '/clubwerk.db'); d.prepare("UPDATE aw_entry SET in_at = datetime(in_at, '-20 minutes') WHERE status = 'laeuft'").run(); d.close(); }
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: eva }); tok = j.token;
  [s, j] = await A('api/tablet/x/arbeitseinsatz/stop', 'POST', { token: tok }); ok('Ausgestempelt (ohne PIN → prüfen)', s === 200 && j.minutes >= 15 && !j.confirmed, JSON.stringify(j));
  [s, j] = await A(W('entries?status=offen')); const pend = j.filter(e => e.member_id === eva); ok('Zu bestätigen', pend.length === 1 && pend[0].source === 'tablet');
  [s, j] = await A(W('entries/review'), 'POST', { ids: pend.map(e => e.id), approve: true }); ok('Bestätigt', j.count === 1);
  // App
  [s, j] = await A(`api/admin/app/member/${eva}/invite`, 'POST', {}); const t = j.token;
  [s, j] = await A('api/pair', 'POST', { t, pin: '2468' }, { base: M }); const dev = j.device;
  [s, j] = await A('api/me', 'GET', undefined, { base: M, dev }); ok('Dienste + Meine Daten in der App', ['mitglieder', 'arbeitseinsatz'].every(id => j.sections.some(x => x.id === id)), JSON.stringify(j.sections));
  [s, j] = await A('api/m/arbeitseinsatz/me', 'GET', undefined, { base: M, dev }); ok('Meine Stunden (Familie)', s === 200 && j.family && j.target === 720 && j.events.length >= (new Date().getHours() < 12 ? 3 : 2), JSON.stringify(j).slice(0, 300));
  [s, j] = await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: ev2 }, { base: M, dev }); ok('Eingetragen', s === 200);
  [s, j] = await A(W('events'), 'POST', { kind: 'arbeit', title: 'Schon vorbei', date: today, start: '00:00', end: '00:01', slots: 0 }); const evPast = (j.ids || [])[0];
  [s, j] = await A('api/m/arbeitseinsatz/me', 'GET', undefined, { base: M, dev }); ok('Vorbei: nicht mehr in der App', s === 200 && !j.events.some(e => e.id === evPast), JSON.stringify(j.events.map(e => e.title)));
  [s, j] = await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: evPast }, { base: M, dev }); ok('Vorbei: eintragen abgelehnt', s === 400 && /vorbei/.test(j.error), j.error);
  [s, j] = await A('api/m/arbeitseinsatz/me', 'GET', undefined, { base: M, dev }); ok('Dauerhafte nicht in der App', !j.events.some(e => e.permanent));
  [s, j] = await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: th.id }, { base: M, dev }); ok('Für Thekendienst kein Eintragen', s === 400);
  [s, j] = await A(`api/admin/app/member/${lena}/invite`, 'POST', {}); const t2 = j.token;
  [s, j] = await A('api/pair', 'POST', { t: t2, pin: '1357' }, { base: M }); const dev2 = j.device;
  [s, j] = await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: ev2 }, { base: M, dev: dev2 }); ok('Voll', s === 400, j.error);
  [s, j] = await A('api/m/arbeitseinsatz/report', 'POST', { date: today, minutes: 90, text: 'Rasen gemäht' }, { base: M, dev: dev2 }); ok('Stunden gemeldet', s === 200, j.error);
  [s, j] = await A('api/m/arbeitseinsatz/report', 'POST', { date: today, minutes: 90, text: '' }, { base: M, dev: dev2 }); ok('Ohne Text abgelehnt', s === 400);
  [s, j] = await A(W('events/' + ev1 + '/close'), 'POST', { minutes: 180, members: [lena, eva] }); ok('Gutschreiben (Eva übersprungen)', j.count === 1, JSON.stringify(j));
  [s, j] = await A(W('events')); ok('Eventliste', j.find(e => e.id === ev2).signups.length === 1);
  [s, , , j] = await A(W('overview.xlsx?year=' + py)); ok('Excel', s === 200 && j.slice(0, 2).toString() === 'PK');
  [s, j] = await A('api/admin/overview/modules'); ok('Übersichtskarte', s === 200 && JSON.stringify(j).includes('Stunden geleistet'), JSON.stringify(j).slice(0, 300));
  [s, j] = await A('api/admin/extensions/arbeitseinsatz/export'); ok('Funktionsexport', s === 200 && j.data.settings.default_minutes !== undefined, JSON.stringify(j).slice(0, 200));
  // ---------- Dienstpläne ----------
  await A('api/admin/mail', 'PUT', { host: '127.0.0.1', port: 2525, user: '', from: 'verein@test.de' });
  await A(W('settings'), 'PUT', { notify: 'vorstand@test.de', contact: 'Thorsten, 0170 123' });
  const pd = n => new Date(Date.now() + n * 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const k1 = pd(10), k3 = pd(12);
  [s, j] = await A(W('plans'), 'POST', { title: 'Kirmes Test', from_date: k1, to_date: k3, place: 'Zelt', note: 'Bitte pünktlich', counts: true, published: false }); const pl = j.id; ok('Dienstplan angelegt', s === 200, j.error);
  [s, j] = await A(W('plans'), 'POST', { title: 'Zu lang', from_date: k1, to_date: pd(60) }); ok('Höchstens 31 Tage', s === 400);
  [s, j] = await A(W('events'), 'POST', { plan_id: pl, date: pd(11), start: '19:00', end: '23:30', title: 'Theke', slots: 2, note: 'vorher da sein' }); const sTh = j.ids[0]; ok('Schicht angelegt', s === 200, j.error);
  [s, j] = await A(W('events'), 'POST', { plan_id: pl, date: pd(11), start: '19:00', end: '23:30', title: 'Kasse', slots: 1 }); const sKa = j.ids[0];
  [s, j] = await A(W('events'), 'POST', { plan_id: pl, date: k1, start: '16:00', title: 'Zeltaufbau' }); const sZa = j.ids[0]; ok('Schicht ohne Ende und ohne Grenze', s === 200);
  [s, j] = await A(W('events'), 'POST', { plan_id: pl, date: pd(20), start: '10:00', title: 'Falscher Tag' }); ok('Schicht außerhalb der Tage abgelehnt', s === 400, j.error);
  [s, j] = await A('api/m/arbeitseinsatz/me', 'GET', undefined, { base: M, dev }); ok('Entwurf nicht in der App', !j.plans.some(x => x.id === pl));
  [s, j] = await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: sTh }, { base: M, dev }); ok('Entwurf: kein Eintragen', s === 400);
  await A(W('plans/' + pl), 'PUT', { published: true });
  [s, j] = await A('api/m/arbeitseinsatz/me', 'GET', undefined, { base: M, dev }); { const p0 = j.plans.find(x => x.id === pl); ok('Plan in der App mit Schichten', p0 && p0.shifts.length === 3 && p0.note === 'Bitte pünktlich' && j.contact === 'Thorsten, 0170 123', JSON.stringify(p0).slice(0, 200)); ok('Plan-Schichten nicht unter Termine', !j.events.some(e => e.id === sTh)); }
  [s, j] = await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: sTh }, { base: M, dev }); ok('In Schicht eingetragen', s === 200, j.error);
  [s, j] = await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: sKa }, { base: M, dev }); ok('Gleichzeitige Schicht abgelehnt', s === 400 && /schon eingetragen/.test(j.error), j.error);
  [s, j] = await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: sZa }, { base: M, dev }); ok('Unbegrenzte Schicht', s === 200);
  [s, j] = await A(W(`events/${sTh}/extern`), 'POST', { name: 'Gast vom TuS' }); ok('Helfer ohne Mitgliedschaft', s === 200);
  [s, j] = await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: sTh }, { base: M, dev: dev2 }); ok('Mit Externem voll', s === 400 && /voll/.test(j.error), j.error);
  [s, j] = await A(W('plans/' + pl)); { const th = j.shifts.find(e => e.id === sTh); ok('Verwaltung sieht Helfer + Externe', th.taken === 2 && th.helpers.some(x => x.extern && x.name === 'Gast vom TuS') && j.plan.need === 3 && j.plan.filled === 2, JSON.stringify(j.plan)); }
  const before = mails().length;
  [s, j] = await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: sZa, remove: true }, { base: M, dev }); ok('Austragen (mehr als 24 h vorher)', s === 200, j.error);
  await sleep(700); { const ms = mails(); void before; ok('Verwaltung per Mail informiert', ms.some(m => m.to.includes('vorstand@test.de') && /Absage/.test(m.subject) && /ausgetragen/.test(m.text)), JSON.stringify(ms.map(m => [m.to, m.subject]))); }
  [s, j] = await A(W('events'), 'POST', { title: 'Morgen früh', date: pd(1), start: '06:00', end: '08:00', slots: 5, kind: 'arbeit' }); const soon = j.ids[0];
  await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: soon }, { base: M, dev: dev2 });
  [s, j] = await A('api/m/arbeitseinsatz/signup', 'POST', { event_id: soon, remove: true }, { base: M, dev: dev2 }); ok('Unter 24 h: nur über den Kontakt', s === 400 && /Thorsten, 0170 123/.test(j.error), j.error);
  [s, j] = await A(W(`events/${soon}/signup`), 'POST', { member_id: lena, remove: true }); ok('Verwaltung trägt trotzdem aus', s === 200);
  [s, j] = await A(W(`plans/${pl}/copy`), 'POST', { title: 'Kirmes Nächstes Jahr', from_date: pd(375) }); const pl2 = j.id; ok('Als Vorlage kopiert', s === 200, j.error);
  [s, j] = await A(W('plans/' + pl2)); ok('Kopie: Schichten ohne Helfer, Entwurf', j.shifts.length === 3 && j.shifts.every(e => e.taken === 0) && !j.plan.published && j.plan.from_date === pd(375), JSON.stringify(j.plan));
  [s, j] = await A(W(`plans/${pl}/sales`), 'POST', {}); ok('In den Verkauf übernommen', s === 200 && j.id, j.error);
  [s, j] = await A(W(`plans/${pl}/sales`), 'POST', {}); ok('… nur einmal', s === 400);
  [s, j] = await A('api/admin/events'); ok('Veranstaltung im Verkauf', Array.isArray(j) && j.some(e => e.name === 'Kirmes Test'), JSON.stringify(j).slice(0, 200));
  { const r = await fetch(B + W(`plans/${pl}/xlsx`), { headers: { 'X-Clubwerk': '1', Cookie: ck } }); ok('Excel-Export', r.status === 200 && (r.headers.get('content-type') || '').includes('spreadsheet')); }
  await A(W('plans/' + pl), 'PUT', { counts: false });
  [s, j] = await A(W(`events/${sTh}/close`), 'POST', { minutes: 270, members: [eva] }); ok('Zählt nicht → keine Gutschrift', s === 400);
  [s, j] = await A(W('plans/' + pl2), 'DELETE'); ok('Dienstplan gelöscht', s === 200);
  const log = fs.readFileSync(S + '/aw_srv.log', 'utf8'); ok('Keine Fehler im Log', !/TypeError|ReferenceError|SqliteError|is not a function/.test(log), log.split('\n').filter(l => /Error/.test(l)).slice(0, 5).join(' / '));
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK');
  if (process.env.KEEP) return;
  srv.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv && srv.kill(); process.exit(1); });
