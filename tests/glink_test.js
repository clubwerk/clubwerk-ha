// Gastlinks 3.29: verfallen nach 12 Monaten ohne Nutzung oder ohne Mannschaft; Teilen erzeugt dann einen neuen
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP || require('path').resolve(__dirname, '../clubwerk');
const DATA = S + '/r_gl'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3491/'; const MB = 'http://127.0.0.1:5493/';
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
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_TABLET_OPEN: '1', CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3491', BEREGNUNG_PORT: '5491', MEMBER_PORT: '5493', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/enc_srv.log', 'a'), fs.openSync(S + '/enc_srv.log', 'a')] });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(200); }
};
const stopSrv = async () => { srv.kill(); await new Promise(r => srv.on('exit', r)); };
const rawDb = () => { const D = require(APP + '/node_modules/better-sqlite3'); return new D(DATA + '/clubwerk.db', { readonly: true }); };
(async () => {
  await startSrv();
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Link', password: 'Test-Kennwort-42', modules: { getraenke: true, spielbetrieb: true } }); ok('Setup', s === 200, j.error);
  await A('api/admin/settings/app', 'PUT', { url: 'http://127.0.0.1:5493' });
  [s, j] = await A('api/admin/x/spielbetrieb/teams', 'POST', { name: 'Herren 30', min_players: 4 }); const T = j.id;
  [s, j] = await A(`api/admin/x/spielbetrieb/teams/${T}/extern`, 'POST', { first_name: 'Max', last_name: 'Gast' }); const gid = j.id; const link1 = j.link || (j.players.find(p => p.ext) || {}).link; ok('Gast mit Link', /#t=/.test(link1 || ''), JSON.stringify(j).slice(0, 200));
  const tok = l => l.split('#t=')[1];
  const G = async t => (await fetch(MB + 'api/p/spielbetrieb/g/' + t)).status;
  ok('Link gilt', await G(tok(link1)) === 200);
  [s, j] = await A(`api/admin/x/spielbetrieb/teams/${T}/players`, 'PUT', { players: [] }); ok('Aus der Mannschaft genommen', s === 200, j.error);
  ok('… Link gilt nicht mehr', await G(tok(link1)) === 404);
  [s, j] = await A(`api/admin/x/spielbetrieb/teams/${T}/players`, 'PUT', { players: [{ id: gid, rank: 1 }] });
  ok('Wieder in der Mannschaft → Link gilt wieder', await G(tok(link1)) === 200);
  { const D = require(APP + '/node_modules/better-sqlite3'); const d = new D(DATA + '/clubwerk.db'); d.prepare("UPDATE sp_extern SET last_seen = datetime('now','localtime','-400 days')").run(); d.close(); }
  ok('13 Monate nicht benutzt → Link abgelaufen', await G(tok(link1)) === 404);
  [s, j] = await A('api/admin/x/spielbetrieb/meta'); const link2 = (JSON.stringify(j).match(/"link":"([^"]+)"/) || [])[1];
  ok('Beim Teilen: neuer Link', link2 && tok(link2) !== tok(link1), link2);
  ok('… der neue gilt', await G(tok(link2)) === 200);
  ok('… der alte bleibt ungültig', await G(tok(link1)) === 404);
  await stopSrv(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
