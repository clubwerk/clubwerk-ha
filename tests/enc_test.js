// Tresor 3.21: Einschalten, verschlüsselt auf der Platte, Neustart → gesperrt, Anmeldung → offen, Code, Ausschalten
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP || require('path').resolve(__dirname, '../clubwerk');
const DATA = S + '/r_enc'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3461/'; const MB = 'http://127.0.0.1:5463/';
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ck = '';
async function A(url, method = 'GET', body, raw) {
  const h = { 'X-Clubwerk': '1', Cookie: ck }; if (body !== undefined && !raw) h['Content-Type'] = 'application/json'; if (raw) Object.assign(h, raw);
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  const ct = r.headers.get('content-type') || ''; let j = {};
  if (/json/.test(ct)) { try { j = await r.json(); } catch (e) { /* */ } } else j = Buffer.from(await r.arrayBuffer());
  return [r.status, j];
}
const X = p => 'api/admin/x/mitglieder/' + p;
let srv;
const startSrv = async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_TABLET_OPEN: '1', CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3461', BEREGNUNG_PORT: '5461', MEMBER_PORT: '5463', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/enc_srv.log', 'a'), fs.openSync(S + '/enc_srv.log', 'a')] });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(200); }
};
const stopSrv = async () => { srv.kill(); await new Promise(r => srv.on('exit', r)); };
const rawDb = () => { const D = require(APP + '/node_modules/better-sqlite3'); return new D(DATA + '/clubwerk.db', { readonly: true }); };
(async () => {
  await startSrv();
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Tresor', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true, buchung: true } }); ok('Setup', s === 200, j.error);
  const feeId = (await A(X('fees'), 'POST', { name: 'Erwachsene', cents: 12000, interval: 'jahr', kind: 'grund' }))[1].id;
  const nd = (await A(X('member/new-document'), 'POST', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)), { 'Content-Type': 'application/octet-stream', 'X-Filename': 'antrag.pdf' }))[1];
  [s, j] = await A(X('member'), 'POST', { doc_id: nd.doc_id, fee_id: feeId, payment: 'rechnung', first_name: 'Anna', last_name: 'Adler', birth_date: '1985-03-04', street: 'Lindenweg 7', zip: '65599', city: 'Dornburg', email: 'anna@adler.de', mobile: '0170 1234567', notes: 'mag Doppel' }); const anna = j.id; ok('Mitglied angelegt', s === 200 && anna, j.error);
  [s, j] = await A(X(`member/${anna}/bank`), 'PUT', { iban: 'DE89370400440532013000', holder: 'Anna Adler', bic: 'COBADEFFXXX' }); ok('Bankdaten', s === 200, j.error);
  const pdf = Buffer.from('%PDF-1.4\n% Testdokument Anna Adler Geheimtext\n%%EOF\n');
  [s, j] = await A(X(`member/${anna}/documents?title=Vertrag`), 'POST', pdf, { 'Content-Type': 'application/octet-stream', 'X-Filename': 'vertrag.pdf' }); const docId = j.id; ok('Dokument hochgeladen', s === 200 && docId, JSON.stringify(j));
  [s, j] = await A('api/admin/vault'); ok('Tresor aus', s === 200 && j.on === false && j.may, JSON.stringify(j));
  // Einschalten
  [s, j] = await A('api/admin/vault/prepare', 'POST', { password: 'falsch' }); ok('Vorbereiten: falsches Passwort', s === 401);
  [s, j] = await A('api/admin/vault/prepare', 'POST', { password: 'Test-Kennwort-42' }); const code = j.code, pos = j.positions; ok('Code erzeugt', s === 200 && /^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/.test(code) && pos.length === 3, JSON.stringify(j));
  const cc = code.replace(/-/g, '');
  [s, j] = await A('api/admin/vault/enable', 'POST', { password: 'Test-Kennwort-42', typed: 'XXX' }); ok('Falsche Probe abgelehnt', s === 400);
  [s, j] = await A('api/admin/vault/enable', 'POST', { password: 'Test-Kennwort-42', typed: pos.map(p => cc[p - 1]).join(''), deleteOld: true }); ok('Eingeschaltet', s === 200 && j.ok, JSON.stringify(j));
  { const d = rawDb(); const p = d.prepare('SELECT * FROM mv_person WHERE member_id = ?').get(anna); const b = d.prepare('SELECT * FROM mv_bank WHERE member_id = ?').get(anna);
    ok('Platte: E-Mail, Adresse, Geburtsdatum verschlüsselt', /^e1:/.test(p.email) && /^e1:/.test(p.street) && /^e1:/.test(p.birth_date) && /^e1:/.test(p.notes), JSON.stringify({ e: p.email.slice(0, 8) }));
    ok('Platte: Name bleibt lesbar (Tablet)', p.first_name === 'Anna' && p.last_name === 'Adler');
    ok('Platte: IBAN verschlüsselt', /^e1:/.test(b.iban) && /^e1:/.test(b.holder));
    const hist = d.prepare('SELECT old, new FROM mv_history WHERE member_id = ?').all(anna); ok('Platte: Änderungsverlauf verschlüsselt', hist.every(h => (h.new == null || /^e1:/.test(h.new)) && (h.old == null || /^e1:/.test(h.old))), JSON.stringify(hist.slice(0, 3)));
    d.close();
    const raw = fs.readFileSync(DATA + '/clubwerk.db'); ok('Datenbankdatei enthält keinen Klartext mehr', !raw.includes('anna@adler.de') && !raw.includes('Lindenweg') && !raw.includes('DE89370400440532013000'));
    const files = fs.readdirSync(DATA + '/mitglieder-dokumente'); ok('Dokumente auf der Platte verschlüsselt', files.length === 2 && files.every(f => fs.readFileSync(DATA + '/mitglieder-dokumente/' + f).subarray(0, 4).toString() === 'CWV1'), files.join(','));
    const bks = fs.existsSync(DATA + '/backups') ? fs.readdirSync(DATA + '/backups').filter(f => f.endsWith('.db')) : [];
    ok('Alte Schnappschüsse ersetzt (nur noch verschlüsselte)', bks.every(f => !fs.readFileSync(DATA + '/backups/' + f).includes('anna@adler.de')), bks.join(',')); }
  [s, j] = await A(X(`member/${anna}`)); ok('Verwaltung liest weiter im Klartext', s === 200 && j.person.email === 'anna@adler.de' && j.person.street === 'Lindenweg 7' && j.person.age > 30, JSON.stringify(j.person).slice(0, 200));
  [s, j] = await A(X(`member/${anna}`), 'PUT', { city: 'Musterstadt' }); ok('Ändern geht', s === 200, j.error);
  { const d = rawDb(); const p = d.prepare('SELECT city FROM mv_person WHERE member_id = ?').get(anna); ok('… und landet verschlüsselt auf der Platte', /^e1:/.test(p.city)); d.close(); }
  [s, j] = await A(X('list?status=alle')); ok('Liste mit Ort', s === 200 && j.some(r => r.id === anna), JSON.stringify(j[0]).slice(0, 200));
  [s, j] = await A(X(`documents/${docId}`)); ok('Dokument entschlüsselt abrufbar', s === 200 && Buffer.isBuffer(j) && j.includes('Geheimtext'));
  [s, j] = await A('api/admin/vault'); ok('Status: an, offen, eigener Schlüssel', j.on && !j.locked && j.mine, JSON.stringify(j));
  // Neustart → gesperrt
  await stopSrv(); ck = ''; await startSrv();
  { const r = await fetch(B + 'api/tablet/state'); const t = await r.json(); ok('Gesperrt: Tablet läuft', r.status === 200 && t.members.some(m => m.id === anna), r.status); }
  [s, j] = await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' }); ok('Anmeldung', s === 200);
  [s, j] = await A('api/admin/vault'); ok('Anmeldung hat entsperrt', j.on && !j.locked, JSON.stringify(j));
  [s, j] = await A(X(`member/${anna}`)); ok('Daten nach Neustart wieder da', j.person.email === 'anna@adler.de' && j.person.city === 'Musterstadt', JSON.stringify(j.person).slice(0, 160));
  // zweiter Admin ohne Schlüssel, Neustart, Anmeldung des zweiten → bleibt gesperrt
  [s, j] = await A('api/admin/users', 'POST', { username: 'kasse', name: 'Kasse', password: 'kasse12345', role: 'admin', perms: ['mitglieder'] }); ok('Zweiter Admin angelegt (bekommt Schlüssel)', s === 200, j.error);
  await stopSrv(); ck = ''; await startSrv();
  [s, j] = await A('api/admin/login', 'POST', { username: 'kasse', password: 'kasse12345' });
  [s, j] = await A('api/admin/vault'); ok('Zweiter Admin entsperrt (Schlüssel bei Anlage erzeugt)', !j.locked, JSON.stringify(j));
  // Neustart: gesperrt, Bereich 423, Code öffnet
  await stopSrv(); ck = ''; await startSrv();
  [s, j] = await A('api/admin/users', 'GET'); // ohne Login
  { const D = require(APP + '/node_modules/better-sqlite3'); const d = new D(DATA + '/clubwerk.db'); d.prepare('DELETE FROM vault_wrap WHERE user_id != 0').run(); d.close(); }
  [s, j] = await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' });
  [s, j] = await A('api/admin/vault'); ok('Ohne Schlüsselkopie bleibt der Tresor zu', j.locked && !j.mine, JSON.stringify(j));
  [s, j] = await A(X(`member/${anna}`)); ok('Gesperrt: Mitgliederverwaltung zeigt Sperrhinweis', s === 423 && j.vaultLocked, s);
  [s, j] = await A('api/admin/vault/unlock', 'POST', { code: 'AAAA-BBBB-CCCC-DDDD-EEEE', password: 'Test-Kennwort-42' }); ok('Falscher Code', s === 401);
  [s, j] = await A('api/admin/vault/unlock', 'POST', { code: code.toLowerCase(), password: 'Test-Kennwort-42' }); ok('Wiederherstellungscode öffnet', s === 200, j.error);
  [s, j] = await A(X(`member/${anna}`)); ok('… Daten wieder da', s === 200 && j.person.email === 'anna@adler.de');
  [s, j] = await A('api/admin/vault'); ok('… und der Admin hat wieder einen Schlüssel', j.mine);
  // Ausschalten
  [s, j] = await A('api/admin/vault/disable', 'POST', { password: 'Test-Kennwort-42' }); ok('Ausgeschaltet', s === 200, j.error);
  { const d = rawDb(); const p = d.prepare('SELECT email FROM mv_person WHERE member_id = ?').get(anna); ok('Platte wieder Klartext', p.email === 'anna@adler.de'); d.close(); }
  [s, j] = await A(X(`documents/${docId}`)); ok('Dokument wieder lesbar', s === 200 && j.includes('Geheimtext'));
  await stopSrv(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
