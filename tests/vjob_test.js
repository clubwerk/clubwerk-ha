// Tresor 3.29: Abbruch beim Ein-/Ausschalten, Wiederaufnahme beim Start, kein Datenverlust
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP || require('path').resolve(__dirname, '../clubwerk');
const DATA = S + '/r_vj'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3471/'; const MB = 'http://127.0.0.1:5473/';
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
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_TABLET_OPEN: '1', CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3471', BEREGNUNG_PORT: '5471', MEMBER_PORT: '5473', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/enc_srv.log', 'a'), fs.openSync(S + '/enc_srv.log', 'a')] });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(200); }
};
const stopSrv = async () => { srv.kill(); await new Promise(r => srv.on('exit', r)); };
const rawDb = () => { const D = require(APP + '/node_modules/better-sqlite3'); return new D(DATA + '/clubwerk.db', { readonly: true }); };
(async () => {
  await startSrv();
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Tresor', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true } }); ok('Setup', s === 200, j.error);
  const feeId = (await A(X('fees'), 'POST', { name: 'Erwachsene', cents: 12000, interval: 'jahr', kind: 'grund' }))[1].id;
  const nd = (await A(X('member/new-document'), 'POST', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)), { 'Content-Type': 'application/octet-stream', 'X-Filename': 'antrag.pdf' }))[1];
  [s, j] = await A(X('member'), 'POST', { doc_id: nd.doc_id, fee_id: feeId, payment: 'rechnung', first_name: 'Anna', last_name: 'Adler', birth_date: '1985-03-04', street: 'Lindenweg 7', zip: '65599', city: 'Dornburg', email: 'anna@adler.de', mobile: '0170 1234567', notes: 'mag Doppel' }); const anna = j.id; ok('Mitglied angelegt', s === 200 && anna, j.error);
  const docs = [];
  for (let i = 0; i < 3; i++) { [s, j] = await A(X(`member/${anna}/documents?title=D${i}`), 'POST', Buffer.from(`%PDF-1.4\n% Geheimtext${i}\n%%EOF\n`), { 'Content-Type': 'application/octet-stream', 'X-Filename': `d${i}.pdf` }); docs.push(j.id); }
  ok('3 Dokumente', docs.every(Boolean));
  [s, j] = await A('api/admin/vault/prepare', 'POST', { password: 'Test-Kennwort-42' }); const code = j.code, cc = code.replace(/-/g, '');
  [s, j] = await A('api/admin/vault/enable', 'POST', { password: 'Test-Kennwort-42', typed: j.positions.map(p => cc[p - 1]).join('') }); ok('Eingeschaltet', s === 200, j.error);
  const DD = DATA + '/mitglieder-dokumente'; const fl = () => fs.readdirSync(DD).filter(f => !f.endsWith('.cwtmp'));
  const encd = f => fs.readFileSync(DD + '/' + f).subarray(0, 4).toString() === 'CWV1';
  ok('Alle Dateien verschlüsselt', fl().every(encd), fl().join(','));
  // A) Ausschalten scheitert an einer beschädigten Datei → Tresor bleibt an, nichts verloren
  const victim = fl()[0]; const good = fs.readFileSync(DD + '/' + victim); const bad = Buffer.from(good); bad[bad.length - 1] ^= 0xff; fs.writeFileSync(DD + '/' + victim, bad);
  const lastName = fl().filter(f => !f.startsWith('antrag')).sort().pop();
  [s, j] = await A('api/admin/vault/disable', 'POST', { password: 'Test-Kennwort-42' }); ok('Ausschalten bricht bei beschädigter Datei ab', s !== 200 && /bleibt eingeschaltet/.test(j.error || ''), s + ' ' + j.error);
  [s, j] = await A('api/admin/vault'); ok('… Tresor weiter an und offen', j.on && !j.locked, JSON.stringify(j));
  ok('… alle Dateien wieder verschlüsselt', fl().every(encd), fl().map(f => f + ':' + encd(f)).join(','));
  { const d = rawDb(); const p = d.prepare('SELECT email FROM mv_person WHERE member_id = ?').get(anna); const k = d.prepare("SELECT value FROM settings WHERE key='vault_priv'").get(); const job = d.prepare("SELECT value FROM settings WHERE key='vault_job'").get(); d.close();
    ok('… Datenbank weiter verschlüsselt, Schlüssel vorhanden, kein offener Lauf', /^e1:/.test(p.email) && k && !job, JSON.stringify({ e: p.email.slice(0, 5), k: !!k, job })); }
  fs.writeFileSync(DD + '/' + victim, good);
  [s, j] = await A(X(`documents/${docs[0]}`)); ok('Dokument lesbar', s === 200 && Buffer.isBuffer(j) && j.includes('Geheimtext'));
  // B) Ausschalten wird mittendrin unterbrochen (Neustart): eine Datei schon Klartext, Zwischendatei liegt herum
  await stopSrv();
  { const D = require(APP + '/node_modules/better-sqlite3'); const d = new D(DATA + '/clubwerk.db'); d.prepare("INSERT OR REPLACE INTO settings(key, value) VALUES ('vault_job','dec')").run(); d.close(); }
  fs.writeFileSync(DD + '/' + lastName, Buffer.from('%PDF-1.4\n% Klartext-Rest\n%%EOF\n')); fs.writeFileSync(DD + '/' + lastName + '.cwtmp', 'halb');
  ck = ''; await startSrv();
  ok('Start: Zwischendatei entfernt', !fs.existsSync(DD + '/' + lastName + '.cwtmp'));
  ok('Start: Klartext-Rest wieder verschlüsselt (ohne Passwort)', fl().every(encd), fl().map(f => f + ':' + encd(f)).join(','));
  { const d = rawDb(); const job = d.prepare("SELECT value FROM settings WHERE key='vault_job'").get(); const on = d.prepare("SELECT value FROM settings WHERE key='vault_on'").get(); const a = d.prepare("SELECT action, detail FROM audit_log WHERE action LIKE 'Tresor: unterbrochen%'").get(); d.close();
    ok('Start: Tresor bleibt an, Lauf abgeschlossen, im Protokoll', !job && on && on.value === '1' && a, JSON.stringify({ job, on, a })); }
  [s, j] = await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' });
  [s, j] = await A(X(`member/${anna}`)); ok('Nach Neustart: Daten lesbar', s === 200 && j.person.email === 'anna@adler.de');
  [s, j] = await A(X(`documents/${docs[2]}`)); ok('Nach Neustart: unterbrochene Datei lesbar', s === 200 && Buffer.isBuffer(j) && j.includes('Klartext-Rest'));
  // C) Ausschalten sauber
  [s, j] = await A('api/admin/vault/disable', 'POST', { password: 'Test-Kennwort-42' }); ok('Ausschalten klappt', s === 200, j.error);
  ok('Alle Dateien Klartext', fl().every(f => !encd(f)));
  { const d = rawDb(); const p = d.prepare('SELECT email FROM mv_person WHERE member_id = ?').get(anna); const k = d.prepare("SELECT COUNT(*) n FROM settings WHERE key IN ('vault_priv','vault_pub','vault_job')").get().n; d.close(); ok('DB Klartext, Schlüssel weg', p.email === 'anna@adler.de' && k === 0); }
  // D) Einschalten unterbrochen: vault_job=enc mit Klartext-Datei → beim Start fertig verschlüsselt
  [s, j] = await A('api/admin/vault/prepare', 'POST', { password: 'Test-Kennwort-42' }); const cc2 = j.code.replace(/-/g, '');
  [s, j] = await A('api/admin/vault/enable', 'POST', { password: 'Test-Kennwort-42', typed: j.positions.map(p => cc2[p - 1]).join('') }); ok('Wieder eingeschaltet', s === 200, j.error);
  await stopSrv();
  { const D = require(APP + '/node_modules/better-sqlite3'); const d = new D(DATA + '/clubwerk.db'); d.prepare("INSERT OR REPLACE INTO settings(key, value) VALUES ('vault_job','enc')").run(); d.close(); }
  fs.writeFileSync(DD + '/' + victim, Buffer.from('%PDF-1.4\n% noch Klartext\n%%EOF\n'));
  ck = ''; await startSrv();
  ok('Start: unterbrochenes Einschalten zu Ende geführt', fl().every(encd));
  await stopSrv(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
