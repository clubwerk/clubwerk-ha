// Beregnung in der Mitglieder-App: ohne PIN starten, einzelnen Platz stoppen, Warteschlange rückt nach.  node berapp_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs'); const http = require('http');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_ba'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3316/', M = 'http://127.0.0.1:5317/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// simuliertes Home Assistant
const st = { 'switch.p1v': 'off', 'switch.p1h': 'off', 'switch.p2': 'off' }; const calls = [];
const ha = http.createServer((req, res) => { let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
  if (req.method === 'GET' && req.url === '/states') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(Object.entries(st).map(([k, v]) => ({ entity_id: k, state: v, attributes: { friendly_name: k } })))); }
  if (req.method === 'POST') { const e = JSON.parse(b || '{}').entity_id; calls.push(req.url + ' ' + e); if (/turn_on/.test(req.url)) st[e] = 'on'; if (/turn_off/.test(req.url)) st[e] = 'off'; res.setHeader('Content-Type', 'application/json'); return res.end('[]'); }
  res.statusCode = 404; res.end('{}'); }); }).listen(8899);
let ck = '';
async function A(url, method = 'GET', body, { base = B, dev } = {}) {
  const h = { 'X-Clubwerk': '1', Cookie: base === B ? ck : '' }; if (dev) h['X-Geraet'] = dev; if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (base === B && sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  let j = {}; try { j = await r.json(); } catch (e) { /* */ } return [r.status, j];
}
let srv;
(async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3316', BEREGNUNG_PORT: '5316', MEMBER_PORT: '5317', EXT_DIR: S + '/none', HA_URL: 'http://127.0.0.1:8899', HA_TOKEN: 'test' }, stdio: ['ignore', fs.openSync(S + '/ba_srv.log', 'w'), fs.openSync(S + '/ba_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, beregnung: true } }); ok('Setup', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/x/beregnung/config', 'PUT', { backend: 'ha', mode: 'app', plaetze: [{ name: 'Platz 1', zones: [{ ref: 'switch.p1v', label: 'Vorne', sec: 60 }, { ref: 'switch.p1h', label: 'Hinten', sec: 60 }] }, { name: 'Platz 2', zones: [{ ref: 'switch.p2', sec: 60 }] }] });
  ok('Plätze eingerichtet', s === 200, JSON.stringify(j).slice(0, 200));
  [s, j] = await A('api/admin/members', 'POST', { name: 'Max Muster', kind: 'mitglied' }); const max = j.id;
  [s, j] = await A(`api/admin/app/member/${max}/access`, 'PUT', { module: 'beregnung', grant: true }); ok('Beregnung freigeschaltet', s === 200, JSON.stringify(j).slice(0, 200));
  [s, j] = await A(`api/admin/app/member/${max}/invite`, 'POST', {}); const t = j.token;
  [s, j] = await A('api/pair', 'POST', { t, pin: '2468' }, { base: M }); const dev = j.device; ok('Handy gekoppelt', Boolean(dev), JSON.stringify(j));
  [s, j] = await A('api/m/beregnung/run', 'POST', { platz: 0 }, { base: M, dev }); ok('Starten ohne PIN', s === 200 && j.ok, JSON.stringify(j));
  [s, j] = await A('api/m/beregnung/run', 'POST', { platz: 1 }, { base: M, dev }); ok('Platz 2 eingereiht', s === 200 && j.waitSec > 60, JSON.stringify(j));
  await sleep(2500);
  [s, j] = await A('api/m/beregnung/status', 'GET', undefined, { base: M, dev });
  ok('Platz 1 läuft, Platz 2 wartet', j.plaetze[0].state === 'run' && j.plaetze[1].state === 'wait', JSON.stringify(j.plaetze.map(p => p.state)));
  ok('Vorne eingeschaltet', st['switch.p1v'] === 'on', JSON.stringify(st));
  [s, j] = await A('api/m/beregnung/stop', 'POST', { platz: 0 }, { base: M, dev }); ok('Platz 1 gestoppt (ohne PIN)', s === 200 && j.ok, JSON.stringify(j));
  ok('Zonen von Platz 1 aus', st['switch.p1v'] === 'off' && st['switch.p1h'] === 'off' && calls.some(c => /turn_off switch.p1h/.test(c)), JSON.stringify(calls));
  await sleep(2500);
  [s, j] = await A('api/m/beregnung/status', 'GET', undefined, { base: M, dev });
  ok('Platz 2 rückt nach und läuft', j.plaetze[0].state === 'idle' && j.plaetze[1].state === 'run' && st['switch.p2'] === 'on', JSON.stringify({ p: j.plaetze.map(p => p.state), st }));
  [s, j] = await A('api/m/beregnung/stop', 'POST', { platz: 9 }, { base: M, dev }); ok('Unbekannter Platz abgelehnt', s === 400, JSON.stringify(j));
  [s, j] = await A('api/m/beregnung/stop', 'POST', {}, { base: M, dev }); ok('Alle Zonen aus', s === 200 && st['switch.p2'] === 'off', JSON.stringify(st));
  // Tablet/eigene Webapp: einzelnen Platz stoppen (gleiche Seite, gleicher Knopf)
  [s, j] = await A('api/admin/x/beregnung/config', 'PUT', { mode: 'pin', stopFree: true, header: true }); ok('Webapp-Modus PIN, Stoppen frei', s === 200, JSON.stringify(j).slice(0, 120));
  [s, j] = await A('api/m/beregnung/run', 'POST', { platz: 0 }, { base: M, dev }); await sleep(1500);
  ok('Platz 1 läuft wieder', st['switch.p1v'] === 'on', JSON.stringify(st));
  [s, j] = await A('api/tablet/x/beregnung/stop', 'POST', { platz: 0 }); ok('Tablet: Platz 1 einzeln gestoppt', s === 200 && j.ok && st['switch.p1v'] === 'off', JSON.stringify(j));
  [s, j] = await A('api/tablet/x/beregnung/stop', 'POST', { platz: 7 }); ok('Tablet: unbekannter Platz abgelehnt', s === 400, JSON.stringify(j));
  // Rechte: Admin nur mit „Mitglieder“ darf ein Handy entfernen, aber keinen neuen QR-Code für jemanden mit Beregnung erzeugen
  [s, j] = await A('api/admin/users', 'POST', { username: 'konto', name: 'Kurt Konto', password: 'Test-Kennwort-42x', perms: ['konten'] }); ok('Admin nur mit Konten', s === 200, JSON.stringify(j));
  const ck0 = ck; ck = ''; await A('api/admin/login', 'POST', { username: 'konto', password: 'Test-Kennwort-42x' });
  [s, j] = await A(`api/admin/app/member/${max}/invite`, 'POST', {}); ok('Neuer QR-Code ohne Beregnungsrecht verweigert (mit Bereichsname)', s === 403 && /Beregnung/.test(j.error), j.error);
  [s, j] = await A(`api/admin/app/member/${max}/device`, 'DELETE'); ok('Handy entfernen ohne Beregnungsrecht verweigert (mit Bereichsname)', s === 403 && /Beregnung/.test(j.error), j.error);
  ck = ck0;
  // Modul ausschalten, während ein Platz läuft: die Zone muss ausgehen (Hook „deactivate“ → Alles stoppen), nichts bleibt offen
  [s, j] = await A('api/m/beregnung/run', 'POST', { platz: 0 }, { base: M, dev }); await sleep(1500);
  ok('Platz 1 läuft wieder', st['switch.p1v'] === 'on', JSON.stringify(st));
  [s, j] = await A('api/admin/extensions/beregnung', 'PUT', { active: false }); ok('Modul ausgeschaltet', s === 200, JSON.stringify(j));
  await sleep(1500);
  ok('Nach dem Ausschalten: alle Zonen aus', st['switch.p1v'] === 'off' && st['switch.p1h'] === 'off' && st['switch.p2'] === 'off', JSON.stringify(st));
  [s, j] = await A('api/m/beregnung/status', 'GET', undefined, { base: M, dev }); ok('Beregnungs-API des ausgeschalteten Moduls antwortet 404', s === 404, s);
  // Einträge abgeschalteter Module blockieren nicht
  [s, j] = await A(`api/admin/app/member/${max}/invite`, 'POST', {}); ok('Admin: QR-Code auch nach Abschalten eines Moduls', s === 200 && j.token, JSON.stringify(j).slice(0, 200));
  // Protokoll: Stopp durch das System
  [s, j] = await A('api/admin/extensions/beregnung', 'PUT', { active: true });
  [s, j] = await A('api/admin/x/beregnung/log'); ok('Protokoll: Stopp „System (Modul ausgeschaltet)“', s === 200 && j.rows.some(r => r.action === 'stop' && /Modul ausgeschaltet/.test(r.who || '')), JSON.stringify((j.rows || []).slice(0, 3)));
  srv.kill(); ha.close(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
