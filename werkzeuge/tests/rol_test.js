// Mitgliederverwaltung: API-Ende-zu-Ende. Startet den Server selbst.  node mv_test.js <S>
const { spawn, execFileSync } = require('child_process'); const fs = require('fs'); const zlib = require('zlib');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_rol'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
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
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3282', BEREGNUNG_PORT: '5282', MEMBER_PORT: '5283', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/rol_srv.log', 'w'), fs.openSync(S + '/rol_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
const TODAY = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
(async () => {
  let s, j;
  await start();
  await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true } });
  const padel = (await A(X('departments'), 'POST', { name: 'Padel' }))[1].id, tennis = (await A(X('departments'), 'POST', { name: 'Tennis' }))[1].id;
  const mk = async (f, l, dep) => { const id = (await A(X('member'), 'POST', { first_name: f, last_name: l, birth_date: '1980-01-01', entry_date: '2020-01-01' }))[1].id; await A(X(`member/${id}/departments`), 'POST', { department_id: dep, entry_date: '2020-01-01' }); return id; };
  const a = await mk('Jürgen', 'Müller', padel), b = await mk('Bea', 'Tennis', tennis);
  [s, j] = await A('api/admin/users/options'); ok('Rollen-Vorlagen', j.roles.length === 5 && j.departments.length === 2, JSON.stringify(j.roles.map(r => r.name)));
  const abt = j.roles.find(r => r.dept_scope).id;
  ok('Benutzername aus Mitglied', j.members.find(m => m.id === a).username === 'jmueller', j.members.find(m => m.id === a).username);
  [s, j] = await A('api/admin/users', 'POST', { member_id: a, password: 'Test-Kennwort-42', roles: [abt], departments: [padel] }); ok('Abteilungsadmin angelegt', s === 200 && j.username === 'jmueller', JSON.stringify(j));
  [s, j] = await A('api/admin/users', 'POST', { name: 'Petra von der Heide', password: 'Test-Kennwort-42', roles: [] }); ok('Manuell: Regel Benutzername', j.username === 'pvonderheide', JSON.stringify(j));
  [s, j] = await A('api/admin/users', 'POST', { member_id: a, password: 'Test-Kennwort-42' }); ok('Mitglied nur einmal', s === 400);
  const adminCk = ck; ck = '';
  [s, j] = await A('api/admin/login', 'POST', { username: 'jmueller', password: 'Test-Kennwort-42' }); ok('Login Abteilungsadmin', s === 200);
  [s, j] = await A('api/admin/status'); ok('Status deptOnly', j.user.deptOnly.includes('mitglieder') && j.user.depts[0] === padel, JSON.stringify(j.user));
  [s, j] = await A(X('list?status=alle')); ok('Liste nur eigene Abteilung', j.length === 1 && j[0].id === a, JSON.stringify(j.map(r => r.name)));
  [s, j] = await A(X('member/' + b)); ok('Fremdes Mitglied gesperrt', s === 403, j.error);
  [s, j] = await A(X('member/' + a), 'PUT', { city: 'Dornburg' }); ok('Stammdaten ändern', s === 200, j.error);
  { const [, cur] = await A(X('member/' + a)); const P = cur.person;
    [s, j] = await A(X('member/' + a), 'PUT', { city: 'Dornburg', member_no: P.member_no || '', status: P.status || 'aktiv', entry_date: P.entry_date, key_no: P.key_no || '', notes: P.notes || '', consents: {} }); ok('Formular mit unveränderten Vereinsfeldern speichert', s === 200, j.error);
    [s, j] = await A(X('member/' + a), 'PUT', { member_no: '999' }); ok('Mitgliedsnummer ändern gesperrt', s === 403 && /Mitgliedsnummer/.test(j.error), j.error);
    [s, j] = await A(X('member/' + a), 'PUT', { payment: 'bar' }); ok('Zahlungsart ändern gesperrt', s === 403, j.error);
    [s, j] = await A(X('member/' + a), 'PUT', { status: 'ehren' }); ok('Status ändern gesperrt', s === 403, j.error);
    [s, j] = await A(X('member/' + a), 'PUT', { consents: { daten: true, homepage: true } }); ok('Einwilligungen setzen gesperrt', s === 403 && /Einwilligungen/.test(j.error), j.error);
    [s, j] = await A(X('meta')); ok('Meta: fremde Abteilung ohne Zahlen', j.depts.find(d => d.id === tennis).members === null && j.depts.find(d => d.id === padel).members >= 1 && j.fees.every(f => f.members === null || f.kind === 'zusatz'), JSON.stringify(j.depts.map(d => [d.name, d.members]))); }
  [s, j] = await A(X('member'), 'POST', { first_name: 'Neu', last_name: 'Padel' }); ok('Neues Mitglied', s === 200, j.error);
  [s, j] = await A(X('member/' + j.id)); ok('… automatisch in Padel', j.departments && j.departments[0].department_id === padel, JSON.stringify(j.departments));
  [s, j] = await A(X('member'), 'POST', { first_name: 'X', last_name: 'Y', department_id: tennis }); ok('Fremde Abteilung beim Anlegen gesperrt', s === 403);
  [s, j] = await A(X('settings'), 'PUT', { mandate_prefix: 'X' }); ok('Einstellungen gesperrt', s === 403);
  [s, j] = await A(X('runs/preview'), 'POST', {}); ok('Beitragslauf gesperrt', s === 403);
  [s, j] = await A(X(`member/${a}/payer`), 'PUT', { payer_id: b }); ok('Zahler ändern gesperrt', s === 403);
  [s, j] = await A(X('export.xlsx')); ok('Export gesperrt', s === 403);
  [s, j] = await A('api/admin/users'); ok('Benutzer gesperrt', s === 403);
  [s, j] = await A('api/admin/overview/modules'); const mo = (j || []).find(x => x.id === 'mitglieder');
  ok('Übersicht nur eigene Abteilung', mo && mo.kpis[0].l === 'Mitglieder deiner Abteilung' && mo.kpis[0].v === 2 && !mo.alerts.some(x => /Gläubiger|SEPA/.test(x.text)), JSON.stringify(mo));
  [s, j] = await A(X('list?status=alle')); ok('Keine Bank-/Beitragshinweise', j.every(r => !r.issues.some(i => /Bank|Mandat|Beitrag/.test(i))), JSON.stringify(j.map(r => r.issues)));
  [s, j] = await A(X(`member/${a}/exit`), 'POST', { exit_date: TODAY }); ok('Austritt eintragen', s === 200, j.error);
  [s, j] = await A(X('member/' + a)); ok('Austritt wartet auf Bestätigung', !j.person.exit_date, JSON.stringify(j.person.exit_date));
  [s, j] = await A(X('member'), 'POST', { first_name: 'Warte', last_name: 'Neu' }); const wn = j.id; ok('Neues Mitglied wartet', j.pending === true, JSON.stringify(j));
  [s, j] = await A('api/tablet/state'); ok('Wartendes Mitglied nicht am Tablet', !j.members.some(m => m.id === wn));
  [s, j] = await A(X('changes')); const myCh = j; ok('Meldungen sichtbar', j.some(c => c.kind === 'austritt') && j.some(c => c.kind === 'eintritt'), JSON.stringify(j.map(c => c.kind)));
  [s, j] = await A(X(`changes/${myCh.find(c => c.kind === 'austritt').id}/accept`), 'POST', {}); ok('Abteilungsleitung kann nicht selbst bestätigen', s === 403);
  [s, j] = await A('api/admin/extensions/mitglieder/export'); ok('Funktionsexport gesperrt', s === 403, s);
  ck = adminCk;
  [s, j] = await A(X('changes')); const all = j;
  [s, j] = await A(X(`changes/${all.find(c => c.kind === 'austritt').id}/accept`), 'POST', {}); ok('Admin bestätigt Austritt', s === 200, j.error);
  [s, j] = await A(X('member/' + a)); ok('Austritt eingetragen', j.person.exit_date === TODAY, j.person.exit_date);
  [s, j] = await A(X(`changes/${all.find(c => c.kind === 'eintritt').id}/accept`), 'POST', {}); ok('Admin bestätigt Eintritt', s === 200, j.error);
  [s, j] = await A('api/tablet/state'); ok('Bestätigtes Mitglied am Tablet', j.members.some(m => m.id === wn));
  await A(X('settings'), 'PUT', { scope_confirm: false });
  // Rolle ändern → Sitzungen gelten sofort neu; Rolle mit Benutzern nicht löschbar
  [s, j] = await A('api/admin/roles/' + abt, 'DELETE'); ok('Vergebene Rolle nicht löschbar', s === 400, j.error);
  [s, j] = await A('api/admin/roles', 'POST', { name: 'Jugendwart', perms: ['mitglieder', 'quatsch'], dept_scope: true }); ok('Rolle anlegen', s === 200);
  [s, j] = await A('api/admin/users/options'); const jw = j.roles.find(r => r.name === 'Jugendwart'); ok('Unbekannte Rechte gefiltert', jw && jw.perms.join() === 'mitglieder', JSON.stringify(jw));
  if (process.env.KEEP) { await A(X('settings'), 'PUT', { scope_confirm: true }); const ak = ck; ck = ''; await A('api/admin/login', 'POST', { username: 'jmueller', password: 'Test-Kennwort-42' }); await A(X('member'), 'POST', { first_name: 'Lena', last_name: 'Neuling' }); ck = ak; await new Promise(r => setTimeout(r, 150000)); }
  const log = fs.readFileSync(S + '/rol_srv.log', 'utf8'); ok('Keine Fehler im Log', !/TypeError|ReferenceError|SqliteError|is not a function/.test(log), log.split('\n').filter(l => /Error/.test(l)).slice(0, 5).join(' / '));
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK');
  srv.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv && srv.kill(); process.exit(1); });
