// Leistungsprüfung mit dem großen Musterverein (500 Mitglieder, 40 Mannschaften, ~6 800 Platzbuchungen, ~21 000 Getränkebuchungen):
// Je Anfrage darf die Zahl der Datenbankabfragen nicht wieder mit der Datenmenge wachsen (früher: Abfrage je Eintrag in einer Schleife).
// Gemessen mit werkzeuge/last/zaehler.js. Grenzen mit Spielraum über dem Stand von 3.34.0 – wer eine reißt, hat eine Schleife eingebaut.
const { spawn, execFileSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const S = process.argv[2]; const APP = process.env.CW_APP; const ROOT = path.join(APP, '..');
const DATA = S + '/r_last', LOG = S + '/last_zaehler.log';
const B = 'http://127.0.0.1:3293/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const jar = {}; async function req(who, url, method = 'GET', body) {
  const h = { 'X-Clubwerk': '1', Cookie: Object.entries(jar[who] || {}).map(([k, v]) => k + '=' + v).join('; ') }; if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); (jar[who] = jar[who] || {})[kv.slice(0, i)] = kv.slice(i + 1); }
  return r.status;
}
const lastRow = url => { const rows = fs.readFileSync(LOG, 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(r => r.url === '/' + url); return rows[rows.length - 1]; };
let srv;
(async () => {
  execFileSync('node', [path.join(ROOT, 'werkzeuge/last/gross.js'), DATA], { stdio: 'ignore' });
  fs.rmSync(LOG, { force: true });
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, DATA_DIR: DATA, PORT: '3293', MEMBER_PORT: '5277', BEREGNUNG_PORT: '5276', CW_TEST_NO_SETUP_CODE: '1',
    EXT_DIR: S + '/none', CW_ZAEHLER_LOG: LOG, NODE_OPTIONS: `--require ${path.join(ROOT, 'werkzeuge/last/zaehler.js')}` }, stdio: ['ignore', fs.openSync(S + '/last_srv.log', 'w'), fs.openSync(S + '/last_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { await fetch(B); break; } catch (e) { await new Promise(r => setTimeout(r, 250)); } }
  ok('Anmeldung Verwaltung', await req('a', 'api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' }) === 200);
  ok('Tablet freigeschaltet', await req('t', 'api/gate/login', 'POST', { password: 'Theke-Abend7' }) === 200);
  const y = new Date().getFullYear(), d = new Date().toISOString().slice(0, 10);
  // [wer, Adresse, höchstens Abfragen] – Stand 3.34.0 in Klammern
  const CHECK = [
    ['a', `api/admin/x/buchung/log?year=${y}&resource=&f=alle&sort=termin&q=`, 150],   // 61   (vorher 25 000)
    ['a', `api/admin/x/buchung/stats?year=${y}&resource=`, 150],                         // 66   (1 150)
    ['a', `api/admin/x/buchung/day?date=${d}`, 200],                                     // 84   (350)
    ['t', `api/tablet/x/buchung/state`, 300],                                            // 123 warm (14 000)
    ['a', 'api/admin/x/spielbetrieb/games?past=0', 200],                                 // 78   (4 100)
    ['a', 'api/admin/x/spielbetrieb/games?past=1', 200],                                 // 78   (5 100)
    ['a', 'api/admin/x/spielbetrieb/dashboard', 200],                                    // 94   (1 200)
    ['a', 'api/admin/x/spielbetrieb/meta', 200],                                         // 86   (620)
    ['a', 'api/admin/app', 1500],                                                        // 663  (8 500) – E-Mail je Mitglied
    ['a', `api/admin/x/arbeitseinsatz/overview?year=${y}`, 10000],                       // 7 400 (26 700) – Familie/Zahler je Mitglied
    ['a', 'api/admin/overview/modules', 12000],                                          // 8 800 (28 100)
  ];
  await req('t', 'api/tablet/x/buchung/state');   // erster Aufruf füllt den Zwischenspeicher der Mitgliederverwaltung
  for (const [who, url, max] of CHECK) {
    const s = await req(who, url); await new Promise(r => setTimeout(r, 50));
    const r = lastRow(url);
    ok(`${url.split('?')[0]}: ${r ? r.q : '?'} Abfragen (höchstens ${max})`, s === 200 && r && r.q <= max, `Status ${s}, ${r ? r.ms + ' ms' : 'keine Messung'}`);
  }
  srv.kill(); console.log(fails ? fails + ' FEHLER' : 'alles ok'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
