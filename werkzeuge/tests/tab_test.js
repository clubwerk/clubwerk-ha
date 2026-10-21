// Saubere Tablet-Adressen (/plaetze/ statt /x/buchung/) und Start-Reiter.  node tab_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_tab'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3320/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ck = '';
async function A(url, method = 'GET', body) {
  const h = { 'X-Clubwerk': '1', Cookie: ck }; if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  let j = {}; try { j = await r.json(); } catch (e) { /* */ } return [r.status, j];
}
const G = async u => { const r = await fetch(B + u, { redirect: 'manual' }); return [r.status, r.headers.get('location'), await r.text()]; };
let srv;
(async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3320', BEREGNUNG_PORT: '5320', MEMBER_PORT: '5321', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/tab_srv.log', 'w'), fs.openSync(S + '/tab_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j, l, t;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, buchung: true, arbeitseinsatz: true, mitglieder: true } }); ok('Setup', s === 200, JSON.stringify(j));
  [s, j] = await A('api/tablet/nav');
  ok('Leiste: saubere Adressen', JSON.stringify(j.items.map(x => x.href)).includes('"plaetze/"') && j.items.some(x => x.href === 'helferdienste/') && j.items.some(x => x.href === 'mitglied-werden/') && !j.items.some(x => /x\//.test(x.href)), JSON.stringify(j.items.map(x => [x.id, x.href])));
  ok('Vorgabe Start: Verkauf, verweist auf „/“', j.start === 'getraenke' && j.items.find(x => x.id === 'getraenke').href === '', JSON.stringify(j));
  [s, l, t] = await G('plaetze/'); ok('/plaetze/ liefert die Seite mit <base>', s === 200 && t.includes('<base href="../x/buchung/">') && t.includes('data-active="buchung"'), s);
  [s, l] = await G('plaetze'); ok('/plaetze → /plaetze/', s === 302 && l === 'plaetze/', l);
  [s, l] = await G('x/buchung/'); ok('alte Adresse /x/buchung/ leitet um', s === 302 && l === '../../plaetze/', l);
  [s, l, t] = await G('x/buchung/tablet.js'); ok('Dateien unter /x/ weiter erreichbar', s === 200 && t.length > 100, s);
  [s, l, t] = await G('verkauf'); ok('/verkauf liefert den Verkauf', s === 200 && /tablet\.js/.test(t), s);
  [s, l, t] = await G(''); ok('„/“ = Verkauf', s === 200 && /tablet\.js/.test(t) && !t.includes('<base'), s);
  [s, j] = await A('api/admin/settings/tablet-order'); ok('Admin: Start = getraenke', j.start === 'getraenke', JSON.stringify(j.start));
  const order = j.items.map(x => x.key);
  [s, j] = await A('api/admin/settings/tablet-order', 'PUT', { order, start: 'buchung' }); ok('Start auf Plätze gesetzt', s === 200 && j.start === 'buchung', JSON.stringify(j));
  [s, l, t] = await G(''); ok('„/“ zeigt jetzt Plätze direkt (ohne Umleitung)', s === 200 && t.includes('<base href="x/buchung/">'), s + ' ' + l);
  [s, j] = await A('api/tablet/nav'); ok('Leiste: Start buchung, Plätze → „/“, Verkauf → /verkauf', j.start === 'buchung' && j.items.find(x => x.id === 'buchung').href === '' && j.items.find(x => x.id === 'getraenke').href === 'verkauf', JSON.stringify(j.items.map(x => [x.id, x.href])));
  [s, j] = await A('api/admin/settings/tablet-order', 'PUT', { order, start: 'gibtsnicht' }); ok('Unbekannter Start ignoriert', j.start === 'buchung');
  [s, j] = await A('api/admin/extensions/buchung', 'PUT', { active: false });
  [s, l, t] = await G(''); ok('Start-Modul aus: „/“ fällt auf Verkauf zurück', s === 200 && /tablet\.js/.test(t) && !t.includes('<base'), s);
  [s, l] = await G('plaetze/'); ok('Abgeschaltetes Modul: /plaetze/ 404', s === 404, s);
  [s, l] = await G('admin.html'); ok('Hauptseiten unverändert', s === 200);
  srv.kill(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
