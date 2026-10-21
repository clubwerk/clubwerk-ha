// Erweiterung hochladen + Funktionsimport/-export. Startet den Server selbst (inkl. Neustarts).
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const S = process.argv[2]; const APP = process.env.CW_APP;
const JSZip = require(APP + '/node_modules/jszip');
const DATA = S + '/r_func'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3240/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
let ck = ''; async function A(url, method = 'GET', body, raw) { const h = { 'X-Getraenke': '1', Cookie: ck }; if (body !== undefined) h['Content-Type'] = raw ? 'application/zip' : 'application/json'; const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0]; const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) { /* */ } return [r.status, j, r, t]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let srv;
async function start() {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3240', BEREGNUNG_PORT: '5240', MEMBER_PORT: '5243', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok', HYDRAWISE_BASE: 'http://127.0.0.1:5242', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/func_srv.log', 'a'), fs.openSync(S + '/func_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
async function stop() { srv.kill(); await new Promise(r => srv.on('exit', r)); await sleep(300); }
async function zipDir(dir, prefix = '') { const z = new JSZip(); const add = (d, p) => { for (const f of fs.readdirSync(d)) { const full = path.join(d, f); if (fs.statSync(full).isDirectory()) add(full, p + f + '/'); else z.file(p + f, fs.readFileSync(full)); } }; add(dir, prefix); return z.generateAsync({ type: 'nodebuffer' }); }
(async () => {
  let s, j, t;
  await start();
  await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, zeiterfassung: true, beregnung: true, zugang: true } });
  [s, j] = await A('api/admin/extensions'); ok('configIO in Liste', ['beregnung', 'zugang', 'zeiterfassung'].every(id => j.all.find(x => x.id === id).configIO) && !j.all.find(x => x.id === 'getraenke').configIO, JSON.stringify(j.all.map(x => [x.id, x.configIO])));
  // --- Beregnung: TC-Datei importieren
  const tc = JSON.parse(fs.readFileSync(S + '/beregnung-funktion-beispiel.json', 'utf8'));
  [s, j] = await A('api/admin/extensions/zugang/import', 'POST', tc); ok('Falsches Modul abgelehnt', s === 400, j.error);
  [s, j] = await A('api/admin/extensions/beregnung/import', 'POST', { format: 'x', module: 'beregnung', data: {} }); ok('Falsches Format abgelehnt', s === 400, j.error);
  [s, j] = await A('api/admin/extensions/beregnung/import', 'POST', tc); ok('TC-Beregnung importiert', s === 200 && /4 Plätze mit 6 Zonen/.test(j.summary) && /API-Key/.test(j.summary) && /Vereins-PIN/.test(j.summary), j.summary || j.error);
  [s, j] = await A('api/admin/x/beregnung/config'); const c = j.cfg;
  ok('Hydrawise direkt', c.vendor === 'hydrawise_api' && c.backend === 'hydrawise', c.vendor);
  ok('Plätze & Zonen wie am Pi', JSON.stringify(c.plaetze.map(p => [p.name, p.zones.map(z => z.ref + ':' + z.label + ':' + z.sec)])) === JSON.stringify([['Platz 1', ['1:Vorne:120', '2:Hinten:120']], ['Platz 2', ['3:Vorne:120', '4:Hinten:120']], ['Platz 3', ['5::180']], ['Platz 4', ['6::180']]]), JSON.stringify(c.plaetze));
  ok('Name & Modus', c.appName === 'Beregnung' && c.subtitle === 'Bewässerungssteuerung' && c.mode === 'pin' && c.stopFree === false);
  // Export
  [s, j, , t] = await A('api/admin/extensions/beregnung/export');
  ok('Export als Datei', s === 200 && j.format === 'clubwerk-funktion' && j.module === 'beregnung' && j.club === 'TC Test' && j.data.plaetze.length === 4 && !('backend' in j.data), t.slice(0, 120));
  await A('api/admin/x/beregnung/pin', 'PUT', { pin: '4711' });
  await A('api/admin/x/beregnung/hwkey', 'PUT', { key: 'test-key-xyz' }).catch(() => {});
  [s, j, , t] = await A('api/admin/extensions/beregnung/export'); ok('Keine PIN/Key im Export', !/4711|test-key-xyz|pin_hash|hw_key/i.test(t));
  // Roundtrip: ändern, dann Export zurückspielen
  const exp = j;
  await A('api/admin/x/beregnung/config', 'PUT', { plaetze: [{ name: 'Nur einer', zones: [{ ref: '9', sec: 60 }] }] });
  [s, j] = await A('api/admin/extensions/beregnung/import', 'POST', exp); ok('Roundtrip-Import', s === 200 && /4 Plätze/.test(j.summary) && !/Vereins-PIN/.test(j.summary), j.summary || j.error);
  [s, j] = await A('api/admin/x/beregnung/pin'); // PIN unverändert?
  [s, j] = await A('api/info', 'GET'); // egal
  // ungültige Daten → nichts geändert
  [s, j] = await A('api/admin/extensions/beregnung/import', 'POST', { ...exp, data: { plaetze: [{ name: 'X', zones: [{ ref: 'abc', sec: 5 }] }] } }); ok('Ungültige Zonen abgelehnt', s === 400, j.error);
  [s, j] = await A('api/admin/x/beregnung/config'); ok('Nach Fehler unverändert', j.cfg.plaetze.length === 4);
  // --- Zugang
  await A('api/admin/x/zugang/config', 'PUT', { doors: [{ name: 'Haustür', type: 'lock', ref: 'lock.haustuer' }, { name: 'Tor', type: 'impulse', ref: 'switch.tor_relais', pulseSec: 1 }], wlanOnly: true });
  [s, j] = await A('api/admin/extensions/zugang/export'); const zexp = j; ok('Zugang-Export', s === 200 && j.data.doors.length === 2 && Array.isArray(j.data.profiles), JSON.stringify(j.data).slice(0, 200));
  await A('api/admin/x/zugang/config', 'PUT', { doors: [], wlanOnly: false });
  [s, j] = await A('api/admin/extensions/zugang/import', 'POST', zexp); ok('Zugang-Import', s === 200 && /2 Türen/.test(j.summary), j.summary || j.error);
  [s, j] = await A('api/admin/x/zugang/config'); ok('Türen wieder da', j.cfg.doors.length === 2 && j.cfg.wlanOnly === true);
  // --- Zeiterfassung
  await A('api/admin/x/zeiterfassung/smtp', 'PUT', { host: 'smtp.example.org', port: 587, user: 'u', from: 'a@b.de', pass: 'GEHEIMPASS' });
  await A('api/admin/x/zeiterfassung/staff', 'POST', { name: 'Maria Keller', job: 'Reinigung', pin: '9876', rate: '14,00' });
  [s, j, , t] = await A('api/admin/extensions/zeiterfassung/export'); const zeexp = j;
  ok('Zeiterfassung-Export ohne Passwort/PIN', s === 200 && j.data.staff.some(x => x.name === 'Maria Keller') && !/GEHEIMPASS|9876/.test(t), t.slice(0, 300));
  [s, j] = await A('api/admin/extensions/zeiterfassung/import', 'POST', { ...zeexp, data: { ...zeexp.data, staff: [...zeexp.data.staff, { name: 'Neu Person', job: 'Theke', rate_cents: 1200 }] } });
  ok('Zeiterfassung-Import', s === 200 && /1/.test(j.summary), j.summary || j.error);
  // --- Rechte: Export für deaktiviertes Modul
  [s] = await A('api/admin/extensions/getraenke/export'); ok('Modul ohne Export → 404', s === 404);
  // --- ZIP hochladen
  [s, j] = await A('api/admin/extensions/upload', 'POST', await zipDir(APP + '/vorlage-erweiterung/beispiel', 'beispiel/'), true);
  ok('Beispiel hochgeladen', s === 200 && j.id === 'beispiel' && j.restart && !j.update, JSON.stringify(j));
  ok('liegt in DATA_DIR/erweiterungen', fs.existsSync(DATA + '/erweiterungen/beispiel/erweiterung.json'));
  [s, j] = await A('api/admin/extensions/upload', 'POST', await zipDir(APP + '/vorlage-erweiterung/beispiel'), true); ok('Nochmal (ohne Unterordner) = Update', s === 200 && j.update, JSON.stringify(j));
  const bad = new JSZip(); bad.file('erweiterung.json', JSON.stringify({ id: 'beregnung', name: 'Fake', version: '9.9.9' })); bad.file('server.js', '');
  [s, j] = await A('api/admin/extensions/upload', 'POST', await bad.generateAsync({ type: 'nodebuffer' }), true); ok('Mitgeliefertes Modul nicht überschreibbar', s === 400, j.error);
  const trav = new JSZip(); trav.file('erweiterung.json', JSON.stringify({ id: 'boese', name: 'Böse', version: '1.0.0' })); trav.file('../../evil.js', 'x');
  [s, j] = await A('api/admin/extensions/upload', 'POST', await trav.generateAsync({ type: 'nodebuffer' }), true); ok('Pfad-Ausbruch abgelehnt', s === 400 && !fs.existsSync(DATA + '/evil.js') && !fs.existsSync(DATA + '/erweiterungen/boese'), j.error);
  [s, j] = await A('api/admin/extensions/upload', 'POST', Buffer.from('kein zip'), true); ok('Kein ZIP abgelehnt', s === 400, j.error);
  const noj = new JSZip(); noj.file('readme.txt', 'x'); [s, j] = await A('api/admin/extensions/upload', 'POST', await noj.generateAsync({ type: 'nodebuffer' }), true); ok('ZIP ohne erweiterung.json abgelehnt', s === 400, j.error);
  // Neustart → geladen
  await stop(); await start(); ck = ''; await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' });
  [s, j] = await A('api/admin/extensions'); const bx = j.all && j.all.find(x => x.id === 'beispiel');
  ok('Nach Neustart geladen', bx && bx.source === 'hochgeladen' && !bx.error, JSON.stringify(bx));
  [s] = await A('api/admin/extensions/beispiel', 'PUT', { active: true }); ok('Aktivierbar', s === 200);
  [s, j] = await A('api/admin/x/beregnung/config'); ok('Import überlebt Neustart', j.cfg.plaetze.length === 4);
  [s, j] = await A('api/admin/extensions/beregnung', 'DELETE'); ok('Mitgeliefertes nicht löschbar', s === 400, j.error);
  [s, j] = await A('api/admin/extensions/beispiel', 'DELETE'); ok('Hochgeladenes entfernt', s === 200 && !fs.existsSync(DATA + '/erweiterungen/beispiel'));
  await stop(); await start(); ck = ''; await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' });
  [s, j] = await A('api/admin/extensions'); ok('Nach Neustart weg', !j.all.some(x => x.id === 'beispiel'));
  await stop();
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); try { await stop(); } catch (x) { /* */ } process.exit(1); });
