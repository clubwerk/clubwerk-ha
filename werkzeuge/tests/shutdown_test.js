const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const DATA = S + '/r_sd'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA);
const B = 'http://127.0.0.1:3295/'; let ck = ''; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 200) : '')); if (!c) fails++; };
async function A(url, method = 'GET', body) { const h = { 'X-Getraenke': '1', Cookie: ck }; if (body !== undefined) h['Content-Type'] = 'application/json'; const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (sc && /^gadmin=/.test(sc)) ck = sc.split(';')[0]; return [r.status, await r.json().catch(() => ({}))]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let log = '';
  const srv = spawn('node', ['src/server.js'], { cwd: process.env.CW_APP, env: { ...process.env, DATA_DIR: DATA, PORT: '3295', BEREGNUNG_PORT: '5295', MEMBER_PORT: '5296', EXT_DIR: S + '/none', CW_TEST_NO_SETUP_CODE: '1', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok' } });
  srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  const exited = new Promise(r => srv.on('exit', code => r(code)));
  for (let i = 0; i < 40; i++) { try { if ((await fetch(B + 'api/admin/status')).status) break; } catch (e) { /* */ } await sleep(250); }
  await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { zugang: true, beregnung: true } });
  await fetch('http://127.0.0.1:5241/api/_reset', { headers: { Authorization: 'Bearer tok' } }).catch(() => {});
  let [s, j] = await A('api/admin/x/zugang/config', 'PUT', { wlanOnly: false, doors: [{ name: 'Tor', type: 'impulse', ref: 'switch.tor', pulseSec: 30 }] });
  const door = j.cfg.doors[0].id;
  [s, j] = await A(`api/admin/x/zugang/doors/${door}/auf`, 'POST', {}); ok('Türimpuls gestartet (Relais an, 30 s)', s === 200, JSON.stringify(j));
  await sleep(2500);   // Beregnungs-Zeitgeber laufen
  srv.kill('SIGTERM');
  const code = await exited;
  const calls = await (await fetch('http://127.0.0.1:5241/api/_calls', { headers: { Authorization: 'Bearer tok' } })).json();
  ok('Beim Beenden: Türöffner-Relais sofort ausgeschaltet', calls.some(c => c.svc === 'switch.turn_off' && c.e === 'switch.tor'), JSON.stringify(calls.slice(-3)));
  ok('Sauber beendet (Code 0)', code === 0, code);
  ok('Kein Fehler im Protokoll', !/TypeError|not open/.test(log), log.split('\n').filter(l => /Error/.test(l)).join(' | '));
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})();
