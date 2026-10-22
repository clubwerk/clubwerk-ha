// Sicherheits-Befunde 3.31: jeder Befund aus der Sicherheitsprüfung wird nachgestellt und muss abgewehrt werden.
// Startet den Server selbst (mit eingeschaltetem Tresor).  node sec3_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs'); const zlib = require('zlib'); const http = require('http');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_sec3'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3331/', M = 'http://127.0.0.1:5333/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
const PW = 'Test-Kennwort-42';
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
/** Anfrage von einer bestimmten Absenderadresse (127.0.0.x), z. B. für Sperren je Adresse */
function req(url, { method = 'GET', body, from = '127.0.0.1', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url); const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, localAddress: from, headers: { 'X-Clubwerk': '1', ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}), ...headers } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => { const t = Buffer.concat(chunks).toString(); let j = {}; try { j = JSON.parse(t); } catch (e) { /* */ } resolve([res.statusCode, j, res.headers]); });
    });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
const T = (path, body) => A(path, 'POST', body, { cookie: 'x=1' });
const MA = (path, body, dev) => A(path, body === undefined ? 'GET' : 'POST', body, { base: M, dev });
const day = n => new Date(Date.now() + n * 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
let srv;
async function start() {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', CW_TEST_VAULT: '1', DATA_DIR: DATA, PORT: '3331', BEREGNUNG_PORT: '5331', MEMBER_PORT: '5333', TRUSTED_PROXY: '172.30.32.2,127.0.0.7', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/sec3_srv.log', 'w'), fs.openSync(S + '/sec3_srv.log', 'a')] });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
const login = async (username, password) => { ck = ''; return A('api/admin/login', 'POST', { username, password }); };
(async () => {
  let s, j;
  await start();
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: PW, modules: { getraenke: true, mitglieder: true, buchung: true, beregnung: true } }); ok('Setup (Tresor an)', s === 200, JSON.stringify(j));
  const adminCk = ck;
  const padel = (await A(X('departments'), 'POST', { name: 'Padel' }))[1].id, tennis = (await A(X('departments'), 'POST', { name: 'Tennis' }))[1].id;
  const mk = async (f, l, dep, extra = {}) => { const r = await A(X('member'), 'POST', { first_name: f, last_name: l, birth_date: '1980-01-01', entry_date: '2020-01-01', ...extra }); const id = r[1].id; if (!id) console.log('Anlegen', f, JSON.stringify(r[1])); await A(X(`member/${id}/departments`), 'POST', { department_id: dep, entry_date: '2020-01-01' }); return id; };
  const anna = await mk('Anna', 'Padel', padel), bert = await mk('Bert', 'Tennis', tennis), cora = await mk('Cora', 'Ohneapp', tennis);
  [s, j] = await A(X(`member/${bert}/bank`), 'PUT', { holder: 'Bert Tennis', iban: 'DE89 3704 0044 0532 0130 00', newMandate: true, mandate_date: '2025-08-10' });
  ok('Testmitglieder angelegt (Bert mit Bankverbindung)', anna && bert && cora && s === 200, [anna, bert, cora].join(',') + ' ' + (j.error || ''));

  /* 1) PIN-Übernahme am Tablet: Nach „PIN zurücksetzen“ darf eine erste PIN am Tablet die App-PIN nicht überschreiben */
  [s, j] = await A(`api/admin/app/member/${anna}/invite`, 'POST', {}); [s, j] = await MA('api/pair', { t: j.token, pin: '2468' }); const devA = j.device; ok('Anna koppelt ihr Handy', s === 200 && devA, JSON.stringify(j));
  [s, j] = await A(`api/admin/members/${anna}/reset-pin`, 'POST', {}); ok('Vorstand setzt Annas PIN zurück', s === 200, j.error);
  [s, j] = await T('api/tablet/unlock', { memberId: anna }); [s, j] = await T('api/tablet/pin', { token: j.token, newPin: '9999' }); ok('Fremder legt am Tablet eine erste PIN fest', s === 200, JSON.stringify(j));
  [s, j] = await MA('api/verify-pin', { pin: '9999' }, devA); ok('… die gilt NICHT in Annas App (keine Türen mit fremder PIN)', s === 401, s + JSON.stringify(j));
  [s, j] = await T('api/tablet/unlock', { memberId: anna, pin: '9999' }); [s, j] = await T('api/tablet/pin', { token: j.token, currentPin: '9999', newPin: '9998' });
  [s, j] = await MA('api/verify-pin', { pin: '9998' }, devA); ok('… auch nicht nach einer zweiten Änderung am Tablet', s === 401, s + JSON.stringify(j));
  [s, j] = await MA('api/verify-pin', { pin: '2468' }, devA); ok('Anna öffnet ihre App weiter mit ihrer eigenen PIN', s === 200, s + JSON.stringify(j));

  /* 2) App-Einladung: nur mit Recht „Mitglieder“/„Mitglieder anlegen“, nicht mit einem Modulrecht allein */
  [s, j] = await A('api/admin/users', 'POST', { name: 'Paul Platzwart', password: PW, perms: ['beregnung'] }); const pw1 = j.username; ok('Platzwart (nur Beregnung) angelegt', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/users', 'POST', { name: 'Kai Konten', password: PW, perms: ['konten'] }); const kk = j.username;
  await login(pw1, PW);
  [s, j] = await A(`api/admin/app/member/${cora}/invite`, 'POST', {}); ok('Platzwart kann kein Handy als Mitglied koppeln (QR-Code)', s === 403, s + JSON.stringify(j));
  [s, j] = await A(`api/admin/app/member/${cora}/invite-mail`, 'POST', {}); ok('… auch nicht per Einladungs-Mail', s !== 200, s + JSON.stringify(j));
  [s, j] = await A('api/admin/app/invites', 'POST', { ids: [cora], kind: 'brief' }); ok('… auch nicht per Einladungsbrief', s !== 200 || (j.done || []).length === 0, JSON.stringify(j).slice(0, 200));
  await login(kk, PW);
  [s, j] = await A(`api/admin/app/member/${cora}/invite`, 'POST', {}); ok('Mit Recht „Mitglieder anlegen“ geht der QR-Code', s === 200 && j.token, s + JSON.stringify(j));
  ck = adminCk;

  /* 3) Buchung ändern nur mit Recht „für Mitglieder buchen“ – auch über den Umweg „Umfang“ */
  const K = p => 'api/admin/x/buchung/' + p;
  [s, j] = await A(K('resources')); const res = (j || [])[0];
  [s, j] = await A(K('bookings'), 'POST', { resource_id: res && res.id, date: day(3), start: '10:00', end: '11:00', member_id: bert }); const bk = j.id; ok('Buchung angelegt', s === 200 && bk, JSON.stringify(j));
  [s, j] = await A('api/admin/users', 'POST', { name: 'Lena Leserecht', password: PW, perms: ['buchung'] }); const ll = j.username;
  await login(ll, PW);
  [s, j] = await A(K(`bookings/${bk}`), 'PUT', { resource_id: res.id, date: day(3), start: '12:00', end: '13:00', member_id: bert }); ok('Nur ansehen: Ändern abgelehnt', s === 403, s);
  [s, j] = await A(K(`bookings/${bk}/scope`), 'POST', { scope: 'one', action: 'edit', fields: { start: '07:00', end: '08:00', member_id: anna } }); ok('… auch über „Umfang“ abgelehnt', s === 403, s + JSON.stringify(j));
  ck = adminCk;
  [s, j] = await A(K(`bookings/${bk}/scope`), 'POST', { scope: 'one', action: 'edit', fields: { start: '12:00', end: '13:00' } }); ok('Mit allen Rechten geht das Ändern', s === 200, s + JSON.stringify(j));

  /* 4) „Nur eigene Abteilung(en)“: nur für Rechte, die wirklich eingeschränkt werden */
  [s, j] = await A('api/admin/roles', 'POST', { name: 'Abteilung mit Bank', perms: ['mitglieder', 'mitglieder_bank'], dept_scope: true }); ok('Rolle „eigene Abteilung“ mit Bankrecht abgelehnt', s === 400 && /Bank/.test(j.error), j.error);
  [s, j] = await A('api/admin/roles', 'POST', { name: 'Abteilung', perms: ['mitglieder'], dept_scope: true }); const abt = j.id; ok('Rolle „eigene Abteilung“ mit Mitglieder-Recht', s === 200, j.error);
  [s, j] = await A('api/admin/users', 'POST', { name: 'Doris Abteilung', password: PW, roles: [abt], departments: [padel] }); const da = j.username;
  await login(da, PW);
  [s, j] = await A(`api/admin/members/${bert}/reset-pin`, 'POST', {}); ok('Abteilungsleitung setzt keine PIN außerhalb ihrer Abteilung zurück', s === 403, s + JSON.stringify(j));
  [s, j] = await A(`api/admin/members/${anna}/reset-pin`, 'POST', {}); ok('… in der eigenen Abteilung schon', s === 200, s + JSON.stringify(j));
  [s, j] = await A(`api/admin/app/member/${bert}/invite`, 'POST', {}); ok('… und koppelt kein Handy für fremde Abteilungen', s === 403, s + JSON.stringify(j));
  ck = adminCk;

  /* 5) IBAN im PDF eines Antrags nur mit Recht „Bankdaten“ */
  // (Online-Anträge brauchen die App – geprüft wird die Maskierung am Antrag aus der Verwaltung)
  [s, j] = await A(X('applications'), 'POST', { data: { persons: [{ first_name: 'Ida', last_name: 'Antrag', birth_date: '1990-02-02', departments: [padel] }], email: 'ida@test.de', street: 'Weg 2', zip: '12345', city: 'Ort', iban: 'DE89370400440532013000', holder: 'Ida Antrag', payment: 'lastschrift', fee_id: __fee, consents: { daten: true } } });
  const app1 = j.id;
  if (app1) {
    [s, j] = await A('api/admin/users', 'POST', { name: 'Vera Vorstand', password: PW, perms: ['mitglieder'] }); await login(j.username, PW);
    const r = await fetch(B + X(`applications/${app1}/pdf`), { headers: { 'X-Clubwerk': '1', Cookie: ck } }); const pdfBuf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(S + '/sec3_antrag.pdf', pdfBuf);
    let text = ''; try { text = require('child_process').execFileSync('pdftotext', [S + '/sec3_antrag.pdf', '-']).toString(); } catch (e) { text = pdfBuf.toString('latin1'); }
    ok('Antrag als PDF ohne Bankrecht: IBAN maskiert', r.status === 200 && !/0532\s?0130/.test(text.replace(/\s+/g, ' ')) && /DE89/.test(text), r.status + ' ' + (text.match(/DE89[^\n]*/) || [''])[0]);
    ck = adminCk;
  } else ok('Antrag in der Verwaltung angelegt', false, JSON.stringify(j));

  /* 6) Modul-Sicherung bei eingeschaltetem Tresor: Bankdaten bleiben verschlüsselt */
  [s, j] = await A('api/admin/extensions/mitglieder/backup', 'POST', {}); ok('Modul-Sicherung erstellt', s === 200 && j.file, JSON.stringify(j));
  if (j.file) {
    const r = await fetch(B + 'api/admin/extensions/backups/' + j.file, { headers: { 'X-Clubwerk': '1', Cookie: ck } }); const zipBuf = Buffer.from(await r.arrayBuffer());
    const JSZip = require(APP + '/node_modules/jszip'); const z = await JSZip.loadAsync(zipBuf); const mj = await z.file('modul.json').async('string');
    const data = JSON.parse(mj); const bank = (data.tables.mv_bank || []).find(x => x.member_id === bert);
    ok('… IBAN darin verschlüsselt (kein Klartext in der ZIP-Datei)', !mj.includes('DE89370400440532013000') && bank && /^(e1|p1):/.test(String(bank.iban)), bank ? String(bank.iban).slice(0, 12) : 'keine Bankzeile');
    ok('… Namen und Adressen ebenfalls verschlüsselt', !/"street":"Weg 1"/.test(mj), '');
    // Rundweg: deinstallieren und die Sicherung wieder einspielen – die Daten sind danach wieder lesbar
    const file = j.file;
    [s, j] = await A('api/admin/extensions/mitglieder/uninstall', 'POST', { file, confirm: 'Mitgliederverwaltung' }); ok('Mitgliederverwaltung deinstalliert', s === 200, j.error);
    [s, j] = await A('api/admin/extensions/mitglieder/install', 'POST', { file }); ok('… Sicherung wieder eingespielt', s === 200, j.error || j.summary);
    [s, j] = await A(X(`member/${bert}`)); const jb = JSON.stringify(j);
    ok('… Geburtsdatum und Bankverbindung wieder lesbar', s === 200 && j.person.birth_date === '1980-01-01' && j.bank && /3000/.test(JSON.stringify(j.bank)) && !/"(e1|p1):/.test(jb), JSON.stringify(j.bank));
  }

  /* 7) Anmeldesperre: bekannte Geräte bleiben drin, erfundene Namen heben keine Sperre auf */
  [s, j] = await A('api/admin/users', 'POST', { name: 'Olga Opfer', username: 'olga.opfer', password: PW, perms: ['export'] }); const oo = j.username; ok('Benutzer mit Punkt im Namen angelegt', oo === 'olga.opfer', JSON.stringify(j));
  let [ls, , lh] = await req(B + 'api/admin/login', { method: 'POST', body: { username: oo, password: PW }, from: '127.0.0.20' });
  const gdev = String((lh['set-cookie'] || []).find(c => c.startsWith('gdev=')) || '').split(';')[0]; ok('Anmeldung setzt ein Geräte-Cookie', ls === 200 && gdev, String(lh['set-cookie']));
  for (let ip = 2; ip <= 6; ip++) for (let i = 0; i < 4; i++) await req(B + 'api/admin/login', { method: 'POST', body: { username: oo, password: 'falsch-' + i }, from: '127.0.0.' + ip });
  [s, j] = await req(B + 'api/admin/login', { method: 'POST', body: { username: oo, password: PW }, from: '127.0.0.30' }); ok('Nach 20 Fehlversuchen ist das Konto für fremde Geräte pausiert', s === 401 && /zu viele Fehlversuche/i.test(j.error), j.error);
  [s, j] = await req(B + 'api/admin/login', { method: 'POST', body: { username: oo, password: PW }, from: '127.0.0.31', headers: { Cookie: gdev.replace(/.$/, c => (c === '0' ? '1' : '0')) } }); ok('… ein verändertes Geräte-Cookie hilft nicht', s === 401, j.error);
  [s, j] = await req(B + 'api/admin/login', { method: 'POST', body: { username: oo, password: PW }, from: '127.0.0.30', headers: { Cookie: gdev } }); ok('… vom bekannten Gerät aus geht die Anmeldung', s === 200, j.error);
  {
    process.env.DATA_DIR = S + '/r_sec3_unit'; fs.mkdirSync(process.env.DATA_DIR, { recursive: true });
    const sec = require(APP + '/src/security'); const L = sec.limiter({ per: 2, size: 3 });
    L.fail('opfer'); L.fail('opfer'); for (let i = 0; i < 50; i++) L.fail('erfunden' + i);
    ok('Sperrliste: eine laufende Sperre wird von erfundenen Namen nicht verdrängt', L.blocked('opfer') > 0, L.blocked('opfer'));
  }

  /* 8) Beregnungs-Port und Proxy: nie aus dem Internet */
  [s] = await req('http://127.0.0.1:5331/', { headers: { 'cf-ray': 'abc123' } }); ok('Beregnungs-Webapp über den Tunnel abgewiesen', s === 403, s);
  [s] = await req('http://127.0.0.1:5331/'); ok('… im Vereinsnetz erreichbar', s === 200, s);
  [s] = await req(B + 'api/gate', { from: '127.0.0.7', headers: { 'X-Forwarded-For': '8.8.8.8' } }); ok('Proxy-Add-on mit Absender aus dem Internet abgewiesen', s === 403, s);
  [s] = await req(B + 'api/gate', { from: '127.0.0.7', headers: { 'X-Forwarded-For': '192.168.1.20' } }); ok('… mit Absender aus dem Vereinsnetz erreichbar', s === 200, s);

  /* 9) Push: ein entkoppeltes Handy bekommt keine Nachrichten mehr */
  [s, j] = await MA('api/push/subscribe', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/testgeraet-anna-1234567890', keys: { p256dh: 'B' + 'x'.repeat(80), auth: 'y'.repeat(22) } } }, devA);
  const subOk = s === 200; ok('Anna schaltet Push ein', subOk, s + JSON.stringify(j));
  [s, j] = await A('api/admin/push'); ok('… Abo gespeichert', (j.subscribed || []).some(x => x.id === anna), JSON.stringify(j.subscribed));
  [s, j] = await A(`api/admin/app/member/${anna}/invite`, 'POST', {});
  [s, j] = await A('api/admin/push'); ok('Neuer QR-Code für Anna: altes Handy bekommt keine Push-Nachrichten mehr', !(j.subscribed || []).some(x => x.id === anna), JSON.stringify(j.subscribed));

  /* 10) Lesbare Auszüge sind von Haus aus aus */
  [s, j] = await A('api/admin/backups/status'); ok('Lesbare (unverschlüsselte) Auszüge von Haus aus aus', s === 200 && j.readable === false, JSON.stringify(j.readable));

  console.log(fails ? `${fails} FEHLER` : 'ALLES OK');
  srv.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); try { srv.kill(); } catch (x) { /* */ } process.exit(1); });
