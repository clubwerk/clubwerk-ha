// Eine PIN für App und Verkauf (3.24).  node pin_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs'); const http = require('http');
const S = process.argv[2]; const APP = process.env.CW_APP || require('path').resolve(__dirname, '../clubwerk');
const DATA = S + '/r_pin'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3394/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ck = '';
async function A(url, method = 'GET', body) {
  const h = { 'X-Clubwerk': '1', Cookie: ck }; if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  let j = {}; try { j = await r.json(); } catch (e) { /* */ } return [r.status, j];
}
const MP = 5396;
function M(path, method = 'GET', body, dev) {
  return new Promise((resolve, reject) => {
    const h = { 'X-Clubwerk': '1', Host: '127.0.0.1:' + MP }; if (dev) h['X-Geraet'] = dev;
    const data = body === undefined ? null : JSON.stringify(body); if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const rq = http.request({ host: '127.0.0.1', port: MP, path: '/' + path, method, headers: h }, r => { let b = ''; r.on('data', d => { b += d; }); r.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch (e) { /* */ } resolve([r.statusCode, j]); }); });
    rq.on('error', reject); if (data) rq.write(data); rq.end();
  });
}
const T = async (path, body) => { const r = await fetch(B + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Clubwerk': '1' }, body: JSON.stringify(body) }); let j = {}; try { j = await r.json(); } catch (e) { /* */ } return [r.status, j]; };
let srv;
const start = async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_TABLET_OPEN: '1', CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3394', BEREGNUNG_PORT: '5397', MEMBER_PORT: String(MP), EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/pin_srv.log', 'a'), fs.openSync(S + '/pin_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
};
const stop = async () => { srv.kill(); await sleep(800); };
(async () => {
  await start();
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, buchung: true } }); ok('Setup', s === 200, JSON.stringify(j));
  const mk = async n => (await A('api/admin/members', 'POST', { name: n, kind: 'mitglied' }))[1].id;
  const anna = await mk('Anna Adler'), bernd = await mk('Bernd Becker'), carl = await mk('Carl Conrad'), dora = await mk('Dora Dorn');
  for (const id of [anna, bernd, carl, dora]) await A(`api/admin/app/member/${id}/access`, 'PUT', { module: 'buchung', grant: true });
  const tabletHasPin = async id => { const [, x] = await A('api/admin/members'); const m = (x.rows || x).find(y => y.id === id); return m && m.hasPin; };
  const tabletPin = async (id, pin) => (await T('api/tablet/unlock', { memberId: id, pin }))[0] === 200;
  // 1) ohne PIN im Verkauf: App-PIN wird Verkaufs-PIN
  [s, j] = await A(`api/admin/app/member/${anna}/invite`, 'POST', {}); const tA = j.token;
  [s, j] = await M('api/invite?t=' + tA); ok('Anna: noch keine PIN → neue festlegen', s === 200 && !j.hasPin, JSON.stringify(j));
  [s, j] = await M('api/pair', 'POST', { t: tA, pin: '1234567' }); ok('Neue PIN höchstens 6 Ziffern', s === 400, JSON.stringify(j));
  [s, j] = await M('api/pair', 'POST', { t: tA, pin: '2468' }); const devA = j.device; ok('Anna gekoppelt', s === 200 && devA);
  ok('… PIN gilt jetzt im Verkauf', await tabletHasPin(anna) && await tabletPin(anna, '2468') && !await tabletPin(anna, '1111'));
  // 2) PIN am Tablet ändern → gilt in der App
  [s, j] = await T('api/tablet/unlock', { memberId: anna, pin: '2468' }); const tok = j.token;
  [s, j] = await T('api/tablet/pin', { token: tok, currentPin: '2468', newPin: '9753' }); ok('PIN am Tablet geändert', s === 200, JSON.stringify(j));
  [s, j] = await M('api/verify-pin', 'POST', { pin: '9753' }, devA); ok('… neue PIN gilt in der App', s === 200, JSON.stringify(j));
  [s, j] = await M('api/verify-pin', 'POST', { pin: '2468' }, devA); ok('… alte nicht mehr', s === 401, s);
  // 3) PIN im Verkauf vorhanden → beim Freischalten dieselbe eingeben
  [s, j] = await T('api/tablet/unlock', { memberId: bernd }); [s, j] = await T('api/tablet/pin', { token: j.token, newPin: '1357' }); ok('Bernd: PIN am Tablet', s === 200, JSON.stringify(j));
  [s, j] = await A(`api/admin/app/member/${bernd}/invite`, 'POST', {}); const tB = j.token;
  [s, j] = await M('api/invite?t=' + tB); ok('Bernd: PIN vorhanden → eingeben statt neu', j.hasPin === true, JSON.stringify(j));
  [s, j] = await M('api/pair', 'POST', { t: tB, pin: '0000' }); ok('Falsche PIN: abgelehnt, Versuche gezählt', s === 400 && j.pinWrong && /Noch 4/.test(j.error), JSON.stringify(j));
  [s, j] = await M('api/pair', 'POST', { t: tB, pin: '1357' }); const devB = j.device; ok('Richtige PIN: gekoppelt', s === 200 && devB, JSON.stringify(j));
  [s, j] = await M('api/verify-pin', 'POST', { pin: '1357' }, devB); ok('… App nutzt dieselbe PIN', s === 200);
  ok('… Verkaufs-PIN unverändert', await tabletPin(bernd, '1357'));
  // 4) 5 falsche PINs → Einladung ungültig
  [s, j] = await A(`api/admin/app/member/${bernd}/invite`, 'POST', {}); const tB2 = j.token;
  for (let i = 0; i < 5; i++) [s, j] = await M('api/pair', 'POST', { t: tB2, pin: '000' + i });
  ok('5-mal falsch: Einladung ungültig', s === 400 && /5-mal falsch/.test(j.error), JSON.stringify(j));
  [s, j] = await M('api/pair', 'POST', { t: tB2, pin: '1357' }); ok('… auch mit richtiger PIN nicht mehr', s !== 200, JSON.stringify(j));
  // 5) Altbestand: getrennte PINs (vor 3.24) – direkt in der Datenbank nachstellen
  await sleep(61000);   // Bremse: höchstens 10 Kopplungsversuche pro Minute
  [s, j] = await A(`api/admin/app/member/${carl}/invite`, 'POST', {}); [s, j] = await M('api/pair', 'POST', { t: j.token, pin: '4321' }); const devC = j.device;
  ok('Carl gekoppelt', Boolean(devC), JSON.stringify(j));
  [s, j] = await A(`api/admin/app/member/${dora}/invite`, 'POST', {}); [s, j] = await M('api/pair', 'POST', { t: j.token, pin: '5555' }); const devD = j.device;
  await stop();
  const Db = require(APP + '/node_modules/better-sqlite3'); const d = new Db(DATA + '/clubwerk.db');
  const hash = (await import('crypto')).default; void hash;
  d.prepare('UPDATE members SET pin_hash = NULL WHERE id = ?').run(carl);                       // Carl: App-PIN, im Verkauf keine
  d.prepare("UPDATE members SET pin_hash = (SELECT pin_hash FROM members WHERE id = ?) WHERE id = ?").run(anna, dora);   // Dora: Verkaufs-PIN = 9753 (abweichend)
  d.prepare("UPDATE member_devices SET pin_synced = 0 WHERE member_id IN (?, ?)").run(carl, dora);
  d.prepare("DELETE FROM settings WHERE key = 'pin_sync_324'").run(); d.close();
  await start(); [s, j] = await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' });
  ok('Altbestand Carl: App-PIN beim Start in den Verkauf übernommen', await tabletPin(carl, '4321'));
  ok('Altbestand Dora: vorerst noch die alte Verkaufs-PIN', await tabletPin(dora, '9753'));
  [s, j] = await M('api/verify-pin', 'POST', { pin: '5555' }, devD); ok('Dora öffnet die App mit ihrer App-PIN', s === 200, s + JSON.stringify(j));
  ok('… jetzt gilt die App-PIN auch im Verkauf', await tabletPin(dora, '5555') && !await tabletPin(dora, '9753'));
  // 6) PIN zurücksetzen (Vorstand) bleibt zurückgesetzt, auch nach Neustart
  [s, j] = await A(`api/admin/members/${carl}/reset-pin`, 'POST', {}); await stop(); await start(); await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' });
  ok('Zurückgesetzt bleibt zurückgesetzt', !await tabletHasPin(carl));
  [s, j] = await T('api/tablet/unlock', { memberId: carl }); [s, j] = await T('api/tablet/pin', { token: j.token, newPin: '8642' });
  // Sicherheit: Nach „PIN zurücksetzen“ kann jeder am Tablet eine erste PIN festlegen – sie darf die App-PIN NICHT überschreiben
  // (sonst öffnet ein Fremder mit „seiner“ PIN über die App-PIN Türen). Die App behält ihre PIN, bis das Mitglied neu koppelt.
  [s, j] = await M('api/verify-pin', 'POST', { pin: '8642' }, devC); ok('Erste PIN am Tablet nach Zurücksetzen ändert die App-PIN nicht', s === 401, s + JSON.stringify(j));
  [s, j] = await T('api/tablet/unlock', { memberId: carl, pin: '8642' }); ok('Carl am Tablet mit neuer PIN', s === 200, s + JSON.stringify(j));
  [s, j] = await T('api/tablet/pin', { token: j.token, currentPin: '8642', newPin: '8643' }); ok('… und PIN am Tablet geändert', s === 200, s + JSON.stringify(j));
  [s, j] = await M('api/verify-pin', 'POST', { pin: '8643' }, devC); ok('… auch eine zweite Änderung mit der Tablet-PIN ändert die App-PIN nicht', s === 401, s + JSON.stringify(j));
  [s, j] = await M('api/verify-pin', 'POST', { pin: '4321' }, devC); ok('… die App gilt weiter mit ihrer bisherigen PIN', s === 200, s + JSON.stringify(j));
  const pinNow = await tabletPin(carl, '4321') ? '4321' : '8643';   // Altbestand: die App-PIN wurde beim Öffnen in den Verkauf übernommen
  [s, j] = await A(`api/admin/app/member/${carl}/invite`, 'POST', {}); [s, j] = await M('api/pair', 'POST', { t: j.token, pin: pinNow }); const devC2 = j.device; ok('Carl neu gekoppelt (mit der Tablet-PIN)', s === 200 && devC2, s + JSON.stringify(j));
  [s, j] = await T('api/tablet/unlock', { memberId: carl, pin: pinNow }); [s, j] = await T('api/tablet/pin', { token: j.token, currentPin: pinNow, newPin: '8644' }); ok('PIN am Tablet mit der alten PIN geändert', s === 200, s + JSON.stringify(j));
  [s, j] = await M('api/verify-pin', 'POST', { pin: '8644' }, devC2); ok('… die geänderte PIN gilt in der App', s === 200, s + JSON.stringify(j));
  // 7) lange App-PIN (8 Ziffern, Altbestand) am Tablet eingebbar
  console.log(fails ? `${fails} FEHLER` : 'ALLES OK');
  srv.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); try { srv.kill(); } catch (x) { /* */ } process.exit(1); });
