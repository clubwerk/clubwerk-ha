// QR-Gültigkeit, Link-Weitergabe, PIN-Eskalation mit Sperre + Mail, HTTPS. Startet den Server selbst.
const { spawn, execSync } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_sec'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
let B = 'http://127.0.0.1:3246/'; let M = 'http://127.0.0.1:5263/';
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 260) : '')); if (!c) fails++; };
let ck = ''; async function A(url, method = 'GET', body, base = B, dev) { const h = { 'X-Clubwerk': '1', Cookie: base === B ? ck : '' }; if (dev) h['X-Geraet'] = dev; if (body !== undefined) h['Content-Type'] = 'application/json'; const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (base === B && sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0]; return [r.status, await r.json().catch(() => ({}))]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const D = require(APP + '/node_modules/better-sqlite3');
const sql = (q, ...a) => { const d = new D(DATA + '/clubwerk.db'); /* seit 3.x heißt die Datenbank clubwerk.db */ const r = d.prepare(q).run(...a); d.close(); return r; };
const lastMail = () => { const f = fs.readdirSync(MAILDIR).filter(f => /^mail\d+\.json$/.test(f)).sort((a, b) => +b.match(/\d+/) - +a.match(/\d+/))[0]; return f ? JSON.parse(fs.readFileSync(MAILDIR + '/' + f)) : null; };
let srv;
async function start(env = {}) {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, DATA_DIR: DATA, PORT: '3246', BEREGNUNG_PORT: '5262', MEMBER_PORT: '5263', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok', EXT_DIR: S + '/none', ...env }, stdio: ['ignore', fs.openSync(S + '/sec_srv.log', 'a'), fs.openSync(S + '/sec_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
async function stop() { srv.kill(); await new Promise(r => srv.on('exit', r)); await sleep(300); }
(async () => {
  let s, j;
  await start();
  await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, beregnung: true, zugang: true } });
  await A('api/admin/mail', 'PUT', { host: '127.0.0.1', port: 2525, from: 'verein@test.de' });
  [s, j] = await A('api/admin/members', 'POST', { name: 'Max Mustermann', kind: 'mitglied' }); const max = j.id;
  await A(`api/admin/app/member/${max}/access`, 'PUT', { module: 'zugang', grant: true });
  [s, j] = await A('api/admin/app'); ok('Standard: 24 Std., kein Link, ohne HTTPS', j.security.inviteHours === 24 && j.security.allowLink === false && j.https === false && j.security.blockAfter === 15, JSON.stringify(j.security));
  [s, j] = await A(`api/admin/app/member/${max}/invite`, 'POST', {}); ok('Einladung 24 Std., Link aus', j.expiresHours === 24 && j.allowLink === false && Math.abs(j.expiresAt - Date.now() - 24 * 3600000) < 60000, JSON.stringify(j));
  [s] = await A('api/admin/settings/app', 'PUT', { inviteHours: 5 }); ok('Ungültige Gültigkeit abgelehnt', s === 400);
  [s] = await A('api/admin/settings/app', 'PUT', { mailTo: 'kaputt' }); ok('Ungültige Warn-Adresse abgelehnt', s === 400);
  [s] = await A('api/admin/settings/app', 'PUT', { inviteHours: 1, allowLink: true, mailTo: 'vorstand@test.de' }); ok('Sicherheit gespeichert', s === 200);
  [s, j] = await A(`api/admin/app/member/${max}/invite`, 'POST', {}); const t = j.token; ok('Einladung 1 Std., Link erlaubt', j.expiresHours === 1 && j.allowLink === true);
  // abgelaufene Einladung
  sql('UPDATE member_devices SET invite_expires = ? WHERE member_id = ?', Date.now() - 1000, max);
  [s, j] = await A('api/pair', 'POST', { t, pin: '2468' }, M); ok('Abgelaufene Einladung abgelehnt', s === 400 && /abgelaufen/.test(j.error), j.error);
  [s, j] = await A(`api/admin/app/member/${max}/invite`, 'POST', {}); const t2 = j.token;
  [s, j] = await A('api/pair', 'POST', { t: t2, pin: '2468' }, M); const dev = j.device; ok('Gekoppelt', s === 200 && dev);
  // PIN-Eskalation
  const wrong = () => A('api/verify-pin', 'POST', { pin: '0000' }, M, dev);
  for (let i = 1; i <= 4; i++) { [s, j] = await wrong(); }
  ok('4 Fehler: noch normal', s === 401 && j.pin);
  [s, j] = await wrong(); ok('5. Fehler: 5 Min. Sperre', s === 429 && /5 Minuten/.test(j.error), j.error);
  [s, j] = await A('api/verify-pin', 'POST', { pin: '2468' }, M, dev); ok('Während Sperre auch richtige PIN gesperrt', s === 429, j.error);
  sql('UPDATE member_devices SET locked_until = NULL WHERE member_id = ?', max);
  for (let i = 6; i <= 9; i++) { [s, j] = await wrong(); }
  [s, j] = await wrong(); ok('10. Fehler: 30 Min. Sperre', s === 429 && /30 Minuten/.test(j.error), j.error);
  sql('UPDATE member_devices SET locked_until = NULL WHERE member_id = ?', max);
  for (let i = 11; i <= 14; i++) { [s, j] = await wrong(); }
  ok('14 Fehler: noch nicht gesperrt', s === 401);
  [s, j] = await wrong(); ok('15. Fehler: Handy gesperrt', s === 403 && j.device && /gesperrt/.test(j.error), j.error);
  [s, j] = await A('api/verify-pin', 'POST', { pin: '2468' }, M, dev); ok('Danach auch mit richtiger PIN kein Zugang', s === 403 && j.device);
  [s, j] = await A('api/m/zugang/doors', 'GET', undefined, M, dev); ok('Bereiche gesperrt', s === 403);
  [s, j] = await A('api/admin/app'); const row = j.rows.find(r => r.member_id === max); ok('Verwaltung zeigt „gesperrt“', row && row.device.status === 'gesperrt', JSON.stringify(row && row.device));
  [s, j] = await A('api/admin/audit'); ok('Protokolleintrag', JSON.stringify(j).includes('wegen falscher PINs gesperrt'));
  await sleep(800); const m = lastMail(); ok('Warn-Mail an Vorstand', m && m.to === 'vorstand@test.de' && /15-mal/.test(m.text) && /Max Mustermann/.test(m.text), m && m.subject);
  await sleep(61000); // Bremse je IP (20/Min.) abwarten
  // Richtige PIN setzt Zähler zurück
  [s, j] = await A(`api/admin/app/member/${max}/invite`, 'POST', {});
  [s, j] = await A('api/pair', 'POST', { t: j.token, pin: '2468' }, M); const dev2 = j.device;
  for (let i = 0; i < 4; i++) await A('api/verify-pin', 'POST', { pin: '0000' }, M, dev2);
  [s] = await A('api/verify-pin', 'POST', { pin: '2468' }, M, dev2); ok('Richtige PIN', s === 200);
  for (let i = 0; i < 4; i++) [s] = await A('api/verify-pin', 'POST', { pin: '0000' }, M, dev2);
  ok('Zähler nach Erfolg zurückgesetzt (4 Fehler → keine Sperre)', s === 401);
  await stop();
  // HTTPS
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${S}/key.pem -out ${S}/cert.pem -days 2 -subj /CN=test 2>/dev/null`);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  await start({ SSL_CERT: S + '/cert.pem', SSL_KEY: S + '/key.pem' });
  { const r = await fetch('http://127.0.0.1:3246/admin.html', { redirect: 'manual' }); ok('Verwaltung: http:// → https:// umgeleitet', r.status === 301 && r.headers.get('location') === 'https://127.0.0.1:3246/admin.html', r.status + ' ' + r.headers.get('location')); }
  B = 'https://127.0.0.1:3246/'; ck = '';
  [s, j] = await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' }); ok('Verwaltung per HTTPS (Anmeldung)', s === 200, JSON.stringify(j));
  { const r = await fetch(B); ok('Tablet-Seite per HTTPS', r.status === 200); }
  { const r = await fetch('http://127.0.0.1:3345/api/admin/status'); ok('Innerer Port nur lokal und unverschlüsselt erreichbar', r.status === 200); }
  M = 'https://127.0.0.1:5263/';
  [s, j] = await A('api/me', 'GET', undefined, M, dev2); ok('Mitglieder-App per HTTPS', s === 200 && j.member === 'Max Mustermann', JSON.stringify(j));
  let plain = 0; try { await fetch('http://127.0.0.1:5263/api/me'); plain = 1; } catch (e) { plain = 0; }
  { const r = await fetch('http://127.0.0.1:5263/api/me', { redirect: 'manual' }); ok('Mitglieder-App: http:// wird umgeleitet', r.status === 301 && /^https:/.test(r.headers.get('location')), r.status); }
  { const r = await fetch('https://127.0.0.1:5263/style.css'); ok('Mitglieder-App lädt Styles über inneren Port', r.status === 200 && (await r.text()).length > 100); }
  void plain;
  try { const r = await fetch('https://127.0.0.1:5262/'); ok('Beregnung per HTTPS', r.status === 200); } catch (e) { ok('Beregnung per HTTPS', false, e.message); }
  [s, j] = await A('api/admin/app'); ok('Verwaltung meldet HTTPS', j.https === true);
  [s, j] = await A('api/admin/status'); ok('Status meldet HTTPS', j.https === true);
  await stop();
  // Home Assistant: Seitenleiste über eigenen inneren Port
  B = 'http://127.0.0.1:3246/';
  await start({ INGRESS_PORT: '8199' });
  { const r = await fetch('http://127.0.0.1:8199/api/admin/status'); ok('Ingress-Port antwortet (von lokal)', r.status === 200); }
  await stop();
  await start({ SSL_CERT: S + '/fehlt.pem', SSL_KEY: S + '/fehlt.pem' });
  let r2; try { r2 = await fetch('http://127.0.0.1:5263/api/me'); } catch (e) { r2 = null; }
  ok('Fehlendes Zertifikat → läuft weiter mit HTTP', r2 && r2.status === 200);
  await stop();
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); try { await stop(); } catch (x) { /* */ } process.exit(1); });
