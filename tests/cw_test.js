// Befunde ChatGPT-Prüfung 3.20: Vereinsnetz, PIN Beregnung unterwegs.  node ext_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs'); const http = require('http');
const S = process.argv[2]; const APP = process.env.CW_APP || require('path').resolve(__dirname, '../clubwerk');
const DATA = S + '/r_cw'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3448/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ck = '';
async function A(url, method = 'GET', body) {
  const h = { 'X-Clubwerk': '1', Cookie: ck }; if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  let j = {}; try { j = await r.json(); } catch (e) { /* */ } return [r.status, j];
}
// Mitglieder-App: mit eigenem Host-Header und optional „über den Tunnel“ (cf-connecting-ip)
function M(path, method = 'GET', body, { dev, host = '127.0.0.1:5449', tunnel = false, ip = '203.0.113.7' } = {}) {
  return new Promise((resolve, reject) => {
    const h = { 'X-Clubwerk': '1', Host: host }; if (dev) h['X-Geraet'] = dev; if (tunnel) h['cf-connecting-ip'] = ip;
    const data = body === undefined ? null : JSON.stringify(body); if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const rq = http.request({ host: '127.0.0.1', port: 5449, path: '/' + path, method, headers: h }, r => { let b = ''; r.on('data', d => { b += d; }); r.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch (e) { /* */ } resolve([r.statusCode, j]); }); });
    rq.on('error', reject); if (data) rq.write(data); rq.end();
  });
}
let srv;
(async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3448', BEREGNUNG_PORT: '5448', MEMBER_PORT: '5449', EXT_DIR: S + '/none', HA_URL: 'http://127.0.0.1:8897', HA_TOKEN: 'test' }, stdio: ['ignore', fs.openSync(S + '/ext_srv.log', 'w'), fs.openSync(S + '/ext_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  // Vereinsnetz als Funktion (ohne Server): internes HA-Netz nie, Liste schränkt ein
  { process.env.DATA_DIR = DATA + '_unit'; fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); fs.mkdirSync(process.env.DATA_DIR, { recursive: true });
    const { setSetting } = require(APP + '/src/db'); const ma = require(APP + '/src/memberapp');
    ok('172.30.32.1 (HA-intern) zählt nie', !ma.isClubNet('172.30.32.1') && !ma.isClubNet('::ffff:172.30.33.7'));
    ok('ohne Liste: 192.168.x, 10.x privat = Verein; öffentlich nicht', ma.isClubNet('192.168.10.188') && ma.isClubNet('10.8.0.2') && !ma.isClubNet('89.246.53.82'));
    ok('Loopback zählt immer', ma.isClubNet('127.0.0.1') && ma.isClubNet('::1'));
    setSetting('app_wlan_nets', '192.168.10.0/24, fd00:abcd::/32');
    ok('mit Liste: nur 192.168.10.0/24 und fd00:abcd::/32', ma.isClubNet('192.168.10.5') && !ma.isClubNet('192.168.11.5') && !ma.isClubNet('10.8.0.2') && ma.isClubNet('fd00:abcd::1') && !ma.isClubNet('fd00:abce::1'));
    const pu = require(APP + '/src/push');
    ok('Push: bekannte Dienste erlaubt', ['https://web.push.apple.com/QAbc', 'https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://wns2-par02p.notify.windows.com/w/?token=abc'].every(pu.pushHostOk));
    ok('Push: fremde/interne Ziele abgelehnt', !['https://192.168.10.1/x', 'https://homeassistant.local/x', 'https://fcm.googleapis.com.evil.de/x', 'https://fcm.googleapis.com:8443/x', 'https://a@fcm.googleapis.com/x', 'http://fcm.googleapis.com/x', 'https://evil.de/fcm.googleapis.com'].some(pu.pushHostOk));
    const sec = require(APP + '/src/security');
    setSetting('app_wlan_nets', '');
    ok('Port 3100/5000: Heimnetz erlaubt', ['192.168.10.20', '10.0.0.5', '172.30.32.2', '172.30.33.1', '127.0.0.1', '::1', '::ffff:192.168.178.3', 'fd00::5', 'fe80::1%eth0', '100.101.102.103'].every(x => sec.lanSource(x)));
    ok('Port 3100/5000: öffentliche Absender abgewiesen', !['89.246.53.82', '::ffff:8.8.8.8', '2a02:8070:1:2::5', '172.32.0.1', '100.128.0.1', ''].some(x => sec.lanSource(x)));
    { const mw = sec.lanOnly({ label: 'Test' }); let code = 0, body = null, nexted = false;
      const res = { status(c) { code = c; return this; }, json(b) { body = b; }, type() { return this; }, send(b) { body = b; } };
      mw({ socket: { remoteAddress: '89.246.53.82' }, method: 'GET', path: '/api/tablet/state', headers: { 'x-forwarded-for': '192.168.10.5' } }, res, () => { nexted = true; });
      ok('Öffentliche Adresse mit gefälschtem X-Forwarded-For → 403', !nexted && code === 403 && /Vereinsnetz/.test(body.error), JSON.stringify(body));
      nexted = false; mw({ socket: { remoteAddress: '192.168.10.5' }, method: 'GET', path: '/api/tablet/state', headers: {} }, res, () => { nexted = true; }); ok('Heimnetz → weiter', nexted); }
    setSetting('app_wlan_nets', '192.168.10.0/24, 2a02:8070:1:2::/64');
    ok('Öffentliches IPv6 im eingetragenen Vereinsnetz erlaubt', sec.lanSource('2a02:8070:1:2::5') && !sec.lanSource('2a02:8070:1:3::5'));
    ok('Mit Vereinsnetz: Port 3100/5000 nur noch dieses Netz', sec.lanSource('192.168.10.7') && !sec.lanSource('192.168.11.7') && !sec.lanSource('10.8.0.2') && !sec.lanSource('172.30.33.4') && !sec.lanSource('100.101.102.103') && sec.lanSource('127.0.0.1'));
    ok('… Seitenleiste/Proxy weiter über die Ausnahme', sec.lanSource('172.30.32.2', { extra: ip => ip === '172.30.32.2' }));
    setSetting('tunnel_src', '');
    ok('Tunnel: ohne Festlegung jede Adresse im Add-on-Netz', ma.fromTunnel('172.30.33.5') && ma.fromTunnel('172.30.32.1') && !ma.fromTunnel('192.168.10.5'));
    setSetting('tunnel_src', '172.30.32.1');
    ok('Tunnel: festgelegte Quelle – nur noch diese (auch nicht Proxy/derselbe Rechner)', ma.fromTunnel('172.30.32.1') && !ma.fromTunnel('172.30.33.5') && !ma.fromTunnel('127.0.0.1'));
    ok('Mitglieder-App direkt: privat/Gast-WLAN/VPN ja, öffentlich nein', ['192.168.10.5', '10.8.0.2', '172.30.32.1', '100.101.102.103', 'fd00::5', '::ffff:192.168.1.2'].every(x => sec.notPublic(x)) && !['89.246.53.82', '::ffff:8.8.8.8', '2a02:8070:1:2::5', ''].some(x => sec.notPublic(x)));
    ok('Netz von Home Assistant erkannt', JSON.stringify(ma.netsFromInfo({ interfaces: [{ ipv4: { address: ['192.168.10.188/24'] } }, { ipv4: { address: ['172.30.32.1/23', '8.8.8.8/24'] } }] })) === '["192.168.10.0/24"]');
    setSetting('tunnel_src', '');
    setSetting('app_wlan_nets', '192.168.10.0/24, fd00:abcd::/32');
    const fb = require(APP + '/src/fullbackup');
    { let e1 = ''; try { fb.deriveKey('passwort123', { N: 2 ** 30, r: 8, p: 1, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' }); } catch (e) { e1 = e.message; } ok('Sicherung: überzogene scrypt-Werte im Kopf abgelehnt', /ungültige Angaben/.test(e1), e1);
      let e2 = ''; try { fb.deriveKey('passwort123', { N: 32768, r: 8, p: 1, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' }); } catch (e) { e2 = e.message; } ok('Sicherung: übliche scrypt-Werte gehen', !e2, e2); }
    ok('Netze prüfen', ma.validNets('192.168.10.0/24, 10.0.0.0/8') && !ma.validNets('192.168.10.0/33') && !ma.validNets('hallo')); }
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', tabletPassword: 'Test-Kennwort-42', modules: { getraenke: true, beregnung: true, buchung: true } }); ok('Setup: Tablet-Passwort ≠ Adminpasswort', s === 400, j.error);
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', tabletPassword: '11111111', modules: { getraenke: true, beregnung: true, buchung: true } }); ok('Setup: zu leichtes Tablet-Passwort', s === 400, j.error);
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', tabletPassword: 'Theke-Abend7', modules: { getraenke: true, beregnung: true, buchung: true } }); ok('Setup', s === 200);
  [s, j] = await A('api/admin/status'); ok('Tablet-Passwort aus der Einrichtung gesetzt', j.tabletPwMissing === false, JSON.stringify(j.tabletPwMissing));
  { const r = await fetch(B + 'api/tablet/state'); ok('Tablet ohne Freischaltung gesperrt', r.status === 401);
    const g = await fetch(B + 'api/gate/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'Theke-Abend7' }) }); ok('Tablet mit Passwort aus der Einrichtung freigeschaltet', g.status === 200); }
  [s, j] = await A('api/admin/members', 'POST', { name: 'Max Muster', kind: 'mitglied' }); const max = j.id;
  await A(`api/admin/app/member/${max}/access`, 'PUT', { module: 'beregnung', grant: true });
  [s, j] = await A('api/admin/settings/app', 'PUT', { tunnelUrl: 'https://app.tc-test.org' }); [s, j] = await A('api/admin/settings/app', 'PUT', { tunnel: true });
  [s, j] = await A(`api/admin/app/member/${max}/invite`, 'POST', {});
  [s, j] = await M('api/pair', 'POST', { t: j.token, pin: '2468' }); const dev = j.device;
  { const k = { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) };
    [s, j] = await M('api/push/subscribe', 'POST', { subscription: { endpoint: 'https://intern.example.org/hook', keys: k } }, { dev }); ok('Push-Abo an fremden Server abgelehnt', s === 400, `${s} ${JSON.stringify(j)}`);
    [s, j] = await M('api/push/subscribe', 'POST', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/testabo123', keys: k } }, { dev }); ok('Push-Abo bei Google angenommen', s === 200, `${s} ${JSON.stringify(j)}`); }
  [s, j] = await A('api/admin/settings/app', 'PUT', { url: 'https://lan.tc-test.org:5001' });
  [s, j] = await M('api/me'); ok('/api/me ohne Gerät: keine lokale Adresse', s === 200 && !j.lanUrl, JSON.stringify(j));
  [s, j] = await M('api/me', 'GET', undefined, { dev }); ok('/api/me mit Gerät: lokale Adresse', j.lanUrl === 'https://lan.tc-test.org:5001', JSON.stringify(j.lanUrl));
  [s, j] = await M('api/me', 'GET', undefined, { tunnel: true, ip: 'kein-ip' }); ok('Tunnel: ungültige cf-connecting-ip abgelehnt', s === 400, `${s} ${JSON.stringify(j)}`);
  [s, j] = await A('api/admin/settings/app', 'PUT', { tunnelSrc: 'quatsch' }); ok('Tunnel-Quelle: ungültig abgelehnt', s === 400);
  [s, j] = await A('api/admin/settings/app', 'PUT', { tunnelSrc: '172.30.32.1' }); ok('Tunnel-Quelle festgelegt', s === 200);
  [s, j] = await A('api/admin/app'); ok('Verwaltung zeigt Tunnel-Quelle', j.tunnel.src === '172.30.32.1', JSON.stringify(j.tunnel.src));
  await A('api/admin/settings/app', 'PUT', { tunnelSrc: '' });
  // Vereinsnetze in der Verwaltung
  [s, j] = await A('api/admin/settings/app', 'PUT', { wlanNets: '192.168.10.0/33' }); ok('ungültiges Netz abgelehnt', s === 400, JSON.stringify(j));
  [s, j] = await A('api/admin/settings/app', 'PUT', { wlanNets: '192.168.10.0/24' }); ok('Netz gespeichert', s === 200);
  [s, j] = await A('api/admin/app'); ok('Verwaltung zeigt Netz und eigene Adresse', j.tunnel.wlanNets === '192.168.10.0/24' && j.tunnel.myIp, JSON.stringify(j.tunnel));
  [s, j] = await M('api/ping'); ok('Loopback bleibt Verein (Test/Add-on intern)', j.wlan === true);
  await A('api/admin/settings/app', 'PUT', { wlanNets: '' });
  // Beregnung: im WLAN ohne PIN (nur Fehler „kein Platz“ o. Ä.), unterwegs mit Ausnahme → PIN nötig
  [s, j] = await M('api/m/beregnung/run', 'POST', { platz: 1 }, { dev }); ok('WLAN: kein PIN-Hinweis', s !== 428 && s !== 401, `${s} ${JSON.stringify(j)}`);
  [s, j] = await M('api/m/beregnung/run', 'POST', { platz: 1 }, { dev, host: 'app.tc-test.org', tunnel: true }); ok('unterwegs ohne Ausnahme: gesperrt (403)', s === 403, `${s} ${JSON.stringify(j)}`);
  await A(`api/admin/app/member/${max}/access`, 'PUT', { module: 'beregnung', away: true });
  [s, j] = await M('api/m/beregnung/run', 'POST', { platz: 1 }, { dev, host: 'app.tc-test.org', tunnel: true }); ok('unterwegs mit Ausnahme, ohne PIN → 428 (nachfragen)', s === 428 && j.needPin, `${s} ${JSON.stringify(j)}`);
  [s, j] = await M('api/m/beregnung/run', 'POST', { platz: 1, pin: '1111' }, { dev, host: 'app.tc-test.org', tunnel: true }); ok('falsche PIN → 401', s === 401 && j.pin, `${s} ${JSON.stringify(j)}`);
  [s, j] = await M('api/m/beregnung/run', 'POST', { platz: 1, pin: '2468' }, { dev, host: 'app.tc-test.org', tunnel: true }); ok('richtige PIN → weiter zur Beregnung (kein PIN-Fehler)', s !== 428 && s !== 401 && s !== 403, `${s} ${JSON.stringify(j)}`);
  [s, j] = await M('api/m/beregnung/stop', 'POST', {}, { dev, host: 'app.tc-test.org', tunnel: true }); ok('Stoppen unterwegs ohne PIN möglich', s !== 428 && s !== 401 && s !== 403, `${s} ${JSON.stringify(j)}`);
  srv.kill(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
