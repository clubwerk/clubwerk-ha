// Von unterwegs nutzbar je Bereich, Ganz-aus-der-App-entfernen, alte Adresse.  node ext_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs'); const http = require('http');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_ext'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3318/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ck = '';
async function A(url, method = 'GET', body) {
  const h = { 'X-Clubwerk': '1', Cookie: ck }; if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  let j = {}; try { j = await r.json(); } catch (e) { /* */ } return [r.status, j];
}
// Mitglieder-App: mit eigenem Host-Header und optional „über den Tunnel“ (cf-connecting-ip)
function M(path, method = 'GET', body, { dev, host = '127.0.0.1:5319', tunnel = false, ip = '203.0.113.7' } = {}) {
  return new Promise((resolve, reject) => {
    const h = { 'X-Clubwerk': '1', Host: host }; if (dev) h['X-Geraet'] = dev; if (tunnel) h['cf-connecting-ip'] = ip;
    const data = body === undefined ? null : JSON.stringify(body); if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const rq = http.request({ host: '127.0.0.1', port: 5319, path: '/' + path, method, headers: h }, r => { let b = ''; r.on('data', d => { b += d; }); r.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch (e) { /* */ } resolve([r.statusCode, j]); }); });
    rq.on('error', reject); if (data) rq.write(data); rq.end();
  });
}
let srv;
(async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3318', BEREGNUNG_PORT: '5318', MEMBER_PORT: '5319', EXT_DIR: S + '/none', HA_URL: 'http://127.0.0.1:8897', HA_TOKEN: 'test' }, stdio: ['ignore', fs.openSync(S + '/ext_srv.log', 'w'), fs.openSync(S + '/ext_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, beregnung: true, buchung: true } }); ok('Setup', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/members', 'POST', { name: 'Max Muster', kind: 'mitglied' }); const max = j.id;
  [s, j] = await A('api/admin/members', 'POST', { name: 'Eva Alt', kind: 'mitglied' }); const eva = j.id;
  for (const id of [max, eva]) for (const m of ['beregnung', 'buchung']) await A(`api/admin/app/member/${id}/access`, 'PUT', { module: m, grant: true });
  // Eva koppelt im WLAN, bevor der Tunnel eingerichtet ist
  [s, j] = await A(`api/admin/app/member/${eva}/invite`, 'POST', {});
  [s, j] = await M('api/pair', 'POST', { t: j.token, pin: '2468' }); const devE = j.device; ok('Eva gekoppelt (WLAN)', Boolean(devE), JSON.stringify(j));
  [s, j] = await A('api/admin/app'); let mods = j.modules;
  ok('Vorgaben: Buchen unterwegs ja, Beregnung nein', mods.find(m => m.id === 'buchung').away === true && mods.find(m => m.id === 'beregnung').away === false, JSON.stringify(mods.map(m => [m.id, m.away])));
  ok('Ohne Tunnel: keine alte Adresse', !j.rows.find(r => r.member_id === eva).device.oldAddress);
  [s, j] = await A('api/admin/settings/app', 'PUT', { tunnelUrl: 'https://app.tc-test.org' }); [s, j] = await A('api/admin/settings/app', 'PUT', { tunnel: true }); ok('Tunnel an', s === 200, JSON.stringify(j));
  // Max koppelt über die öffentliche Adresse
  [s, j] = await A(`api/admin/app/member/${max}/invite`, 'POST', {});
  [s, j] = await M('api/pair', 'POST', { t: j.token, pin: '1357' }, { host: 'app.tc-test.org', tunnel: true }); const devM = j.device; ok('Max gekoppelt (über Tunnel)', Boolean(devM), JSON.stringify(j));
  [s, j] = await A('api/admin/app');
  ok('Eva: alte Adresse erkannt', j.rows.find(r => r.member_id === eva).device.oldAddress === true, JSON.stringify(j.rows.find(r => r.member_id === eva).device));
  ok('Max: öffentliche Adresse, kein Hinweis', j.rows.find(r => r.member_id === max).device.oldAddress === false && j.rows.find(r => r.member_id === max).device.host === 'app.tc-test.org', JSON.stringify(j.rows.find(r => r.member_id === max).device));
  // unterwegs: Beregnung gesperrt, Buchen erlaubt
  [s, j] = await M('api/me', 'GET', undefined, { dev: devM, host: 'app.tc-test.org', tunnel: true });
  const sec = id => (j.sections || []).find(x => x.id === id) || {};
  ok('Unterwegs: Beregnung nur im WLAN', sec('beregnung').ok === false && sec('beregnung').wlanOnly === true, JSON.stringify(j.sections));
  ok('Unterwegs: Buchen nutzbar', sec('buchung').ok === true);
  [s, j] = await M('api/m/beregnung/status', 'GET', undefined, { dev: devM, host: 'app.tc-test.org', tunnel: true }); ok('Unterwegs: Beregnungs-API 403 wlanOnly', s === 403 && j.wlanOnly === true, JSON.stringify(j));
  [s, j] = await M('api/m/buchung/me', 'GET', undefined, { dev: devM, host: 'app.tc-test.org', tunnel: true }); ok('Unterwegs: Buchungs-API nicht wegen WLAN gesperrt', !j.wlanOnly, s + ' ' + JSON.stringify(j).slice(0, 120));
  [s, j] = await M('api/me', 'GET', undefined, { dev: devM, host: 'app.tc-test.org', tunnel: true, ip: '198.51.100.20' }); ok('Über den Tunnel gilt IMMER „unterwegs“ (auch von der Vereins-IP)', sec('beregnung').wlanOnly === true, JSON.stringify(j.sections));
  ok('/me ohne lokale https-Adresse: lanUrl leer', j.lanUrl === '' && j.wlan === false, JSON.stringify([j.lanUrl, j.wlan]));
  [s, j] = await A('api/admin/settings/app', 'PUT', { url: 'https://lan.tc-test.org:5319' }); ok('Lokale https-Adresse gespeichert', s === 200, JSON.stringify(j));
  [s, j] = await M('api/me', 'GET', undefined, { dev: devM, host: 'app.tc-test.org', tunnel: true }); ok('/me liefert lokale Adresse', j.lanUrl === 'https://lan.tc-test.org:5319', j.lanUrl);
  {
    const pre = await new Promise((resolve, reject) => { const rq = http.request({ host: '127.0.0.1', port: 5319, path: '/api/me', method: 'OPTIONS', headers: { Host: 'lan.tc-test.org:5319', Origin: 'https://app.tc-test.org', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'x-geraet' } }, r => { r.resume(); r.on('end', () => resolve(r)); }); rq.on('error', reject); rq.end(); });
    ok('CORS-Preflight von der öffentlichen Adresse erlaubt', pre.statusCode === 204 && pre.headers['access-control-allow-origin'] === 'https://app.tc-test.org' && /x-geraet/i.test(pre.headers['access-control-allow-headers'] || ''), pre.statusCode + ' ' + JSON.stringify(pre.headers['access-control-allow-origin']));
    const bad = await new Promise((resolve, reject) => { const rq = http.request({ host: '127.0.0.1', port: 5319, path: '/api/me', method: 'OPTIONS', headers: { Host: 'lan.tc-test.org:5319', Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } }, r => { r.resume(); r.on('end', () => resolve(r)); }); rq.on('error', reject); rq.end(); });
    ok('CORS für fremde Herkunft verweigert', !bad.headers['access-control-allow-origin'], JSON.stringify(bad.headers['access-control-allow-origin']));
    const csp = await new Promise((resolve, reject) => { const rq = http.request({ host: '127.0.0.1', port: 5319, path: '/', method: 'GET', headers: { Host: 'app.tc-test.org', 'cf-connecting-ip': '203.0.113.7' } }, r => { r.resume(); r.on('end', () => resolve(r)); }); rq.on('error', reject); rq.end(); });
    ok('CSP erlaubt Verbindungen zur lokalen Adresse', /connect-src 'self' https:\/\/lan\.tc-test\.org:5319/.test(csp.headers['content-security-policy'] || ''), csp.headers['content-security-policy']);
  }
  [s, j] = await M('api/ping', 'GET', undefined, { host: 'lan.tc-test.org:5319' }); ok('Ping lokal: wlan=true', j.wlan === true && j.tunnel === false, JSON.stringify(j));
  [s, j] = await M('api/ping', 'GET', undefined, { host: 'app.tc-test.org', tunnel: true }); ok('Ping über Tunnel: wlan=false', j.wlan === false && j.tunnel === true, JSON.stringify(j));
  [s, j] = await M('api/me', 'GET', undefined, { dev: devM }); ok('Im WLAN: Beregnung nutzbar', (j.sections || []).find(x => x.id === 'beregnung').ok === true, JSON.stringify(j.sections));
  // Ausnahme je Mitglied: Beregnung auch unterwegs
  [s, j] = await A(`api/admin/app/member/${max}/access`, 'PUT', { module: 'beregnung', away: true }); ok('Ausnahme „auch unterwegs“ gesetzt', s === 200 && j.access.beregnung.away === true, JSON.stringify(j.access));
  [s, j] = await M('api/me', 'GET', undefined, { dev: devM, host: 'app.tc-test.org', tunnel: true }); ok('Mit Ausnahme: Beregnung unterwegs nutzbar', sec('beregnung').ok === true, JSON.stringify(j.sections));
  [s, j] = await M('api/m/beregnung/status', 'GET', undefined, { dev: devM, host: 'app.tc-test.org', tunnel: true }); ok('Beregnungs-API mit Ausnahme erlaubt', !j.wlanOnly, s);
  [s, j] = await A(`api/admin/app/member/${max}/access`, 'PUT', { module: 'beregnung', away: false });
  [s, j] = await M('api/me', 'GET', undefined, { dev: devM, host: 'app.tc-test.org', tunnel: true }); ok('Ausnahme entfernt: wieder nur WLAN', sec('beregnung').wlanOnly === true);
  // umschalten
  [s, j] = await A('api/admin/settings/app', 'PUT', { extModules: { beregnung: true, buchung: false, gibtsnicht: true } }); ok('Schalter gespeichert', s === 200, JSON.stringify(j));
  [s, j] = await M('api/me', 'GET', undefined, { dev: devM, host: 'app.tc-test.org', tunnel: true });
  ok('Nach Umschalten: Beregnung unterwegs ja, Buchen nein', sec('beregnung').ok === true && sec('buchung').wlanOnly === true, JSON.stringify(j.sections));
  // Rechte: nur „Einstellungen“ darf umschalten
  [s, j] = await A('api/admin/users', 'POST', { username: 'konto', name: 'Kurt Konto', password: 'Test-Kennwort-42x', perms: ['konten', 'buchung', 'beregnung'] });
  const ck0 = ck; ck = ''; await A('api/admin/login', 'POST', { username: 'konto', password: 'Test-Kennwort-42x' });
  [s, j] = await A('api/admin/settings/app', 'PUT', { extModules: { buchung: true } }); ok('Ohne Einstellungen-Recht verweigert', s === 403, JSON.stringify(j));
  // Ganz aus der App entfernen (mit Bereichsrechten erlaubt)
  [s, j] = await A(`api/admin/app/member/${eva}`, 'DELETE'); ok('Eva ganz aus der App entfernt', s === 200 && j.ok, JSON.stringify(j));
  ck = ck0;
  [s, j] = await A('api/admin/app');
  ok('Eva nicht mehr in der Liste, wieder unter „freischalten“', !j.rows.some(r => r.member_id === eva) && j.members.some(m => m.id === eva), JSON.stringify(j.rows.map(r => r.name)));
  [s, j] = await M('api/me', 'GET', undefined, { dev: devE }); ok('Evas Handy hat keinen Zugang mehr', !j.member, JSON.stringify(j).slice(0, 160));
  // ohne Bereichsrecht: verweigert
  [s, j] = await A('api/admin/users', 'POST', { username: 'nurk', name: 'Nur Konten', password: 'Test-Kennwort-42x', perms: ['konten'] });
  ck = ''; await A('api/admin/login', 'POST', { username: 'nurk', password: 'Test-Kennwort-42x' });
  [s, j] = await A(`api/admin/app/member/${max}`, 'DELETE'); ok('Entfernen ohne Beregnungsrecht verweigert', s === 403 && /Beregnung/.test(j.error), j.error);
  [s, j] = await A(`api/admin/app/member/99999`, 'DELETE'); ok('Unbekanntes Mitglied 404', s === 404, JSON.stringify(j));
  srv.kill(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
