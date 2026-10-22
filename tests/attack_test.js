// Angriffstests (2.12): Übernahme, Erraten, Rechte, Module, Erweiterungen, Header. Startet den Server selbst.
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP || require('path').resolve(__dirname, '../clubwerk');
const DATA = S + '/r_atk'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(S + '/evilext/boese/public/admin.js', "window.BOESE='v1';");
const B = 'http://127.0.0.1:3254/', P = 'http://127.0.0.1:5287/';
const JSZip = require(APP + '/node_modules/jszip');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 220) : '')); if (!c) fails++; };
const jar = {}; async function A(who, url, method = 'GET', body, raw, base = B) { const h = { 'X-Clubwerk': '1', Cookie: jar[who] || '' }; if (body !== undefined && !raw) h['Content-Type'] = 'application/json'; if (raw) h['Content-Type'] = raw; const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (sc && /^g(admin|bereg)=/.test(sc) && !/^g\w+=;/.test(sc)) jar[who] = sc.split(';')[0]; const ct = r.headers.get('content-type') || ''; return [r.status, ct.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()), r.headers]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let srv; const log = S + '/atk_srv.log';
async function start(extra = {}) { const env = { ...process.env, DATA_DIR: DATA, PORT: '3254', BEREGNUNG_PORT: '5287', MEMBER_PORT: '5288', EXT_DIR: S + '/evilext', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok', CW_TEST_TABLET_OPEN: '1', ...extra }; delete env.CW_TEST_NO_SETUP_CODE;
  fs.writeFileSync(log, ''); srv = spawn('node', ['src/server.js'], { cwd: APP, env, stdio: ['ignore', fs.openSync(log, 'a'), fs.openSync(log, 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); } }
async function stop() { srv.kill(); await new Promise(r => srv.on('exit', r)); await sleep(300); }
(async () => {
  let s, j, h;
  await start();
  // 1. Erste Einrichtung nur mit Code aus dem Protokoll
  [s, j] = await A('x', 'api/admin/status'); ok('Einrichtung verlangt Code (nicht über Seitenleiste)', j.setupCode === true);
  [s, j] = await A('x', 'api/admin/setup', 'POST', { clubName: 'Angreifer', password: 'attacker123' }); ok('Übernahme ohne Code abgelehnt', s === 403, j.error);
  [s, j] = await A('x', 'api/admin/setup', 'POST', { clubName: 'Angreifer', password: 'attacker123', code: 'AAAA-BBBB' }); ok('Falscher Code abgelehnt', s === 403);
  const code = (fs.readFileSync(log, 'utf8').match(/Einrichtungscode: ([A-Z0-9]{4}-[A-Z0-9]{4})/) || [])[1];
  ok('Code steht im Protokoll', Boolean(code));
  [s, j] = await A('a', 'api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', code: code.toLowerCase(), modules: { getraenke: true, beregnung: true, zugang: true, zeiterfassung: true } }); ok('Einrichtung mit Code', s === 200, j.error);
  [s, j] = await A('x', 'api/admin/setup', 'POST', { password: 'attacker123', code }); ok('Kein zweites Mal', s === 403);
  // 2. Erweiterung im Netzwerkordner läuft nicht ohne Freigabe
  ok('Ungeprüfte Erweiterung wurde NICHT ausgeführt', !fs.existsSync(DATA + '/BOESE_LIEF'));
  [s, j] = await A('a', 'api/admin/extensions'); const bo = j.all.find(x => x.id === 'boese');
  ok('…steht als „nicht freigegeben“ in der Liste, aus', bo && bo.unapproved && !bo.active);
  [s, j] = await A('a', 'api/admin/users', 'POST', { username: 'mallory', name: 'M', password: 'mallory123', perms: ['einstellungen', 'boese_recht'] });
  [s, j] = await A('a', 'api/admin/users'); const mal = j.find(u => u.username === 'mallory');
  ok('Reservierte Rechte nicht vergebbar (auch nicht über Erweiterungen)', mal && !mal.perms.includes('einstellungen') && !mal.perms.includes('boese_recht'), JSON.stringify(mal && mal.perms));
  // 3. Rechte: Mitglieder-App / Türzugang
  [s, j] = await A('a', 'api/admin/members', 'POST', { name: 'Anna Alpha', kind: 'mitglied' }); const anna = j.id;
  await A('a', 'api/admin/x/zugang/config', 'PUT', { wlanOnly: false, header: false, doors: [{ name: 'Tür', type: 'lock', ref: 'lock.t' }, { name: 'Haustür', type: 'impulse', ref: 'switch.haustuer' }] });
  await A('a', `api/admin/app/member/${anna}/access`, 'PUT', { module: 'zugang', grant: true });
  await A('a', 'api/admin/users', 'POST', { username: 'bero', name: 'B', password: 'bero12345', perms: ['beregnung'] });
  await A('a', 'api/admin/users', 'POST', { username: 'kasse', name: 'K', password: 'kasse12345', perms: ['konten'] });
  await A('a', 'api/admin/users', 'POST', { username: 'deinst', name: 'D', password: 'deinst1234', perms: ['deinstallieren', 'beregnung', 'zugang'] });
  await A('a', 'api/admin/users', 'POST', { username: 'nurdeinst', name: 'ND', password: 'nurdeinst12', perms: ['deinstallieren'] });
  await A('a', 'api/admin/users', 'POST', { username: 'wart', name: 'W', password: 'wart123456', perms: ['bestellung'] });
  await A('b', 'api/admin/login', 'POST', { username: 'bero', password: 'bero12345' });
  await A('k', 'api/admin/login', 'POST', { username: 'kasse', password: 'kasse12345' });
  await A('d', 'api/admin/login', 'POST', { username: 'deinst', password: 'deinst1234' });
  await A('nd', 'api/admin/login', 'POST', { username: 'nurdeinst', password: 'nurdeinst12' });
  await A('w', 'api/admin/login', 'POST', { username: 'wart', password: 'wart123456' });
  [s, j] = await A('b', `api/admin/app/member/${anna}/invite`, 'POST', {}); ok('Nur-Beregnung kann Handy eines Mitglieds mit Türzugang NICHT übernehmen', s === 403, j.error);
  [s] = await A('b', `api/admin/app/member/${anna}/device`, 'DELETE'); ok('…und nicht entfernen', s === 403);
  [s] = await A('k', `api/admin/app/member/${anna}/access`, 'PUT', { module: 'zugang', profile: 'immer' }); ok('„Mitglieder“ allein vergibt keinen Türzugang', s === 403);
  [s, j] = await A('a', `api/admin/app/member/${anna}/invite`, 'POST', {}); ok('Admin mit Rechten darf einladen', s === 200);
  { const r = await fetch('http://127.0.0.1:5288/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Clubwerk': '1' }, body: JSON.stringify({ t: j.token, pin: '2468' }) }); ok('Anna koppelt ihr Handy', r.status === 200); }
  // 4. fehlende Rechte nachgerüstet
  [s] = await A('nd', 'api/admin/logo-icon', 'POST', Buffer.from('x'), 'image/png'); ok('Home-Bildschirm-Symbol nur mit „Einstellungen“', s === 403);
  [s] = await A('nd', 'api/admin/members'); ok('Mitgliederliste mit Beträgen nur mit passendem Recht', s === 403);
  [s, j] = await A('b', 'api/admin/settings'); ok('Bestelldaten nur mit „Bestellung“', s === 200 && j.order === undefined && j.tabletPw === undefined);
  // 5. Module: kein Einspielen über laufende Daten, nur unveränderte eigene Sicherungen, keine Geheimnisse
  await A('a', 'api/admin/x/beregnung/config', 'PUT', { pin: '4711', hwKey: 'GEHEIMKEY123' });
  const evil = new JSZip(); evil.file('modul.json', JSON.stringify({ format: 'vereinsheim-modul', module: 'zugang', created: new Date().toISOString(), tables: {}, settings: { ext_zugang_cfg: '{"blockAll":false,"wlanOnly":false}' }, memberAccess: [{ member_id: anna, module: 'zugang', profile: 'immer' }] }));
  const evilBuf = await evil.generateAsync({ type: 'nodebuffer' });
  [s, j] = await A('d', 'api/admin/extensions/zugang/install', 'POST', evilBuf, 'application/zip'); ok('Einspielen bei installiertem Modul abgelehnt', s === 400, j.error);
  [s, j] = await A('d', 'api/admin/extensions/beregnung/backup', 'POST', {}); const bf = j.file;
  [s, j] = await A('d', 'api/admin/extensions/backups/' + bf); const zb = await JSZip.loadAsync(j); const mj = await zb.file('modul.json').async('string');
  ok('Modul-Sicherung ohne PIN-Hash und API-Schlüssel', !/pin_hash|hw_key|GEHEIMKEY/.test(mj) && Boolean(zb.file('signatur.txt')));
  [s] = await A('d', 'api/admin/extensions/beregnung/uninstall', 'POST', { file: bf, confirm: 'Beregnung' }); ok('Deinstalliert', s === 200);
  const tam = await JSZip.loadAsync(j); const data = JSON.parse(mj); data.settings.ext_beregnung_cfg = '{"mode":"open"}'; tam.file('modul.json', JSON.stringify(data));
  [s, j] = await A('a', 'api/admin/extensions/beregnung/install', 'POST', await tam.generateAsync({ type: 'nodebuffer' }), 'application/zip'); ok('Veränderte Sicherung abgelehnt', s === 400 && /verändert/.test(j.error), j.error);
  [s, j] = await A('a', 'api/admin/extensions/beregnung/install', 'POST', { file: bf }); ok('Unveränderte eigene Sicherung wird eingespielt', s === 200, j.error || j.summary);
  // 6. Zugang am Tablet: aus = gibt es nicht; an = Erraten wird gestoppt
  [s] = await A('x', 'api/tablet/x/zugang/members'); ok('Tablet-Türen aus → Mitgliederliste gibt es nicht', s === 404);
  [s] = await A('x', 'api/tablet/x/zugang/door', 'POST', { member: anna, door: 'x', pin: '0000', action: 'auf' }); ok('…Öffnen gibt es nicht', s === 404);
  [s, j] = await A('a', 'api/admin/x/zugang/config'); const door = j.cfg.doors[0].id;
  await A('a', 'api/admin/x/zugang/config', 'PUT', { header: true });
  { const http = require('http');
    const ids = { Anna: anna };
    for (const n of ['Bert', 'Carl', 'Dora']) { [s, j] = await A('a', 'api/admin/members', 'POST', { name: n + ' Test', kind: 'mitglied' }); ids[n] = j.id;
      await A('a', `api/admin/app/member/${j.id}/access`, 'PUT', { module: 'zugang', grant: true });
      [s, j] = await A('a', `api/admin/app/member/${ids[n]}/invite`, 'POST', {});
      await fetch('http://127.0.0.1:5288/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Clubwerk': '1' }, body: JSON.stringify({ t: j.token, pin: '2468' }) }); }
    const f = (ip, who, pin) => new Promise(res => { const body = JSON.stringify({ member: ids[who], door, pin, action: 'auf' });
      const rq = http.request({ host: '127.0.0.1', port: 3254, path: '/api/tablet/x/zugang/door', method: 'POST', localAddress: ip, headers: { 'Content-Type': 'application/json', 'X-Clubwerk': '1', 'X-Forwarded-For': '1.2.3.' + Math.floor(Math.random() * 200), 'Content-Length': Buffer.byteLength(body) } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { if (process.env.DBG) console.log(ip, who, r.statusCode, d); res(r.statusCode); }); }); rq.on('error', () => res(0)); rq.end(body); });
    const st = [];
    for (let i = 0; i < 3; i++) st.push(await f('127.0.0.1', 'Anna', '000' + i));
    ok('3 falsche PINs für einen Namen → dieser Name am Tablet pausiert', (await f('127.0.0.1', 'Anna', '2468')) === 429 && st.every(x => x === 401), st);
    const Db = require(APP + '/node_modules/better-sqlite3'); const dbx = new Db(DATA + '/clubwerk.db', { readonly: true });
    const dv = dbx.prepare("SELECT failed, failed_total, locked_until, token_hash FROM member_devices WHERE member_id = ? AND token_hash IS NOT NULL").get(anna); dbx.close();
    ok('…Annas Handy bleibt davon unberührt (nicht gesperrt, kein Fehlerzähler)', dv && !dv.failed && !dv.failed_total && !dv.locked_until, JSON.stringify(dv));
    await f('127.0.0.1', 'Bert', '1111'); await f('127.0.0.1', 'Bert', '1112');
    ok('5 falsche PINs vom selben Gerät → Gerät pausiert (auch mit gefälschter X-Forwarded-For)', (await f('127.0.0.1', 'Carl', '1113')) === 429);
    for (let i = 0; i < 3; i++) await f('127.0.0.2', 'Carl', '22' + i + '2');
    await f('127.0.0.3', 'Dora', '3331'); await f('127.0.0.3', 'Dora', '3332');
    [s, j] = await A('a', 'api/admin/x/zugang/config');
    ok('10 Fehlversuche insgesamt (verschiedene Geräte und Namen) → Öffnen am Tablet abgeschaltet', j.cfg.header === false, 'header=' + j.cfg.header);
    ok('…danach gibt es die Tablet-Türen nicht mehr', (await f('127.0.0.9', 'Dora', '2468')) === 404); }
  // 7. Beregnungs-Anmeldung öffnet nicht die Verwaltung
  await A('a', 'api/admin/x/beregnung/config', 'PUT', { mode: 'login' });
  await A('a', 'api/admin/users', 'POST', { username: 'platz', name: 'P', password: 'platz12345', perms: ['beregnung_bedienen'] });
  [s] = await A('p', 'api/login', 'POST', { username: 'platz', password: 'platz12345' }, undefined, P); ok('Anmeldung in der Beregnung', s === 200);
  [s] = await A('p', 'api/admin/status', 'GET', undefined, undefined, B); [s, j] = await A('p', 'api/admin/members'); ok('Beregnungs-Sitzung gilt nicht für die Verwaltung', s === 401);
  [s] = await A('q', 'api/login', 'POST', { username: 'platz', password: 'platz12345' }, 'application/json; x', P).catch(() => [0]);
  { const r = await fetch(P + 'api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'platz', password: 'platz12345' }) }); ok('Beregnungs-Anmeldung nur mit Schutz-Kopfzeile (CSRF)', r.status === 403); }
  // 8. Anmeldung: Sperre trifft nur den Angreifer-Absender; Passwortwechsel anderer braucht eigenes Passwort
  for (let i = 0; i < 5; i++) await A('z', 'api/admin/login', 'POST', { username: 'admin', password: 'falsch' + i });
  [s] = await A('z', 'api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' }); ok('Nach 5 Fehlversuchen: dieser Absender gesperrt', s === 401);
  [s, j] = await A('a', 'api/admin/users'); const bid = j.find(u => u.username === 'bero').id;
  [s] = await A('a', `api/admin/users/${bid}/password`, 'POST', { password: 'neu1234567' }); ok('Passwort eines anderen nur mit eigenem Passwort', s === 401);
  // 11. Zweitprüfung: Mitglieder-App-Adresse / Sicherheit nur mit „Einstellungen“
  [s] = await A('k', 'api/admin/settings/app', 'PUT', { url: 'https://evil.example' }); ok('„Mitglieder“ kann die QR-Adresse NICHT umbiegen', s === 403);
  [s] = await A('k', 'api/admin/settings/app', 'PUT', { mailTo: '', allowLink: true, inviteHours: 168 }); ok('…und die Sicherheit nicht abschalten', s === 403);
  [s] = await A('k', 'api/admin/settings/app', 'PUT', { name: 'TCF' }); ok('…den App-Namen schon', s === 200);
  // 12. Handy vorab koppeln und später Türzugang „erben“ geht nicht
  [s, j] = await A('k', 'api/admin/members', 'POST', { name: 'Xaver Vorab', kind: 'mitglied' }); const xav = j.id;
  [s, j] = await A('k', `api/admin/app/member/${xav}/invite`, 'POST', {}); ok('„Mitglieder“ lädt Mitglied ohne Bereiche ein', s === 200, j.error);
  let xdev; { const r = await fetch('http://127.0.0.1:5288/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Clubwerk': '1' }, body: JSON.stringify({ t: j.token, pin: '1357' }) }); xdev = (await r.json()).device; ok('…und koppelt (sein) Handy', r.status === 200 && xdev); }
  [s, j] = await A('a', `api/admin/app/member/${xav}/access`, 'PUT', { module: 'zugang', grant: true }); ok('Türzugang freigeschaltet → Handy wird entkoppelt (neuer QR nötig)', s === 200 && j.reinvite === true, JSON.stringify(j).slice(0, 120));
  { const r = await fetch('http://127.0.0.1:5288/api/m/zugang/status', { headers: { 'X-Clubwerk': '1', 'X-Geraet': xdev } }); ok('…das vorab gekoppelte Handy sieht keine Türen', r.status === 403, r.status); }
  [s, j] = await A('a', `api/admin/app/member/${xav}/invite`, 'POST', {}); { const r = await fetch('http://127.0.0.1:5288/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Clubwerk': '1' }, body: JSON.stringify({ t: j.token, pin: '1357' }) }); ok('Neuer QR vom berechtigten Admin funktioniert', r.status === 200); }
  [s, j] = await A('a', `api/admin/app/member/${xav}/access`, 'PUT', { module: 'beregnung', grant: true }); ok('Weiterer Bereich durch Admin mit allen Rechten → Handy bleibt', s === 200 && !j.reinvite);
  // 13. Sicherungen: Recht des Moduls nötig, keine PIN-Hashes in Tabellen
  [s] = await A('nd', 'api/admin/extensions/zeiterfassung/backup', 'POST', {}); ok('Nur „Deinstallieren“ → keine Sicherung der Zeiterfassung (Löhne, PINs)', s === 403);
  [s] = await A('nd', 'api/admin/extensions/zugang/uninstall', 'POST', { file: 'x', confirm: 'Zugang' }); ok('…und kein Deinstallieren von Zugang', s === 403);
  await A('a', 'api/admin/x/zeiterfassung/staff', 'POST', { name: 'Maria Keller', job: 'Reinigung', pin: '4321', rate: '14,00' });
  [s, j] = await A('a', 'api/admin/extensions/zeiterfassung/backup', 'POST', {}); const zf = j.file;
  [s, j] = await A('a', 'api/admin/extensions/backups/' + zf); { const z = await JSZip.loadAsync(j); const t = await z.file('modul.json').async('string'); ok('Zeiterfassungs-Sicherung ohne PIN-Hash der Personen', /Maria Keller/.test(t) && !/pin_hash/.test(t)); }
  [s] = await A('nd', 'api/admin/extensions/backups/' + zf); ok('…Herunterladen nur mit Recht des Moduls', s === 403);
  [s] = await A('a', 'api/admin/extensions/zeiterfassung/uninstall', 'POST', { file: zf, confirm: 'Zeiterfassung' });
  [s, j] = await A('a', 'api/admin/extensions/zeiterfassung/install', 'POST', { file: zf }); ok('Zeiterfassung wiederhergestellt', s === 200, j.error);
  { const Db = require(APP + '/node_modules/better-sqlite3'); const d2 = new Db(DATA + '/clubwerk.db', { readonly: true }); const st = d2.prepare("SELECT pin_hash FROM staff WHERE name = 'Maria Keller'").get(); d2.close(); ok('…PIN muss neu vergeben werden (unbrauchbarer Platzhalter)', st && st.pin_hash === 'neu-vergeben'); }
  // 14. Ein Gerät gehört genau einem Modul
  [s, j] = await A('a', 'api/admin/x/beregnung/config', 'PUT', { backend: 'ha', plaetze: [{ name: 'Platz 1', zones: [{ ref: 'switch.haustuer', sec: 3600 }] }] }); ok('Türöffner kann NICHT als Beregnungs-Zone eingetragen werden', s === 400 && /Zugang/.test(j.error), j.error);
  [s, j] = await A('a', 'api/admin/x/beregnung/config', 'PUT', { backend: 'ha', plaetze: [{ name: 'Platz 1', zones: [{ ref: 'switch.platz1', sec: 600 }] }] }); ok('Eigene Zone geht', s === 200, j.error);
  [s, j] = await A('a', 'api/admin/x/zugang/config', 'PUT', { doors: [{ name: 'Tür', type: 'lock', ref: 'lock.t' }, { name: 'Platz', type: 'impulse', ref: 'switch.platz1' }] }); ok('…und umgekehrt: Beregnungs-Ventil nicht als Tür', s === 400 && /Beregnung/.test(j.error), j.error);
  // 15. Kontoart „Verein“ (kostenlos) und Bestell-Mail
  [s] = await A('k', `api/admin/members/${anna}`, 'PUT', { kind: 'verein' }); ok('„Mitglieder“ kann kein Konto auf „Verein (kostenlos)“ stellen', s === 403);
  [s] = await A('k', 'api/admin/members', 'POST', { name: 'Gratis', kind: 'verein' }); ok('…und keins anlegen', s === 403);
  [s] = await A('w', 'api/admin/settings/order', 'PUT', { order_email: 'opfer@example.org' }); ok('Getränkewart kann den Empfänger der Bestell-Mail nicht ändern', s === 403);
  [s] = await A('w', 'api/admin/settings/order', 'PUT', { customer_no: '4711' }); ok('…Kundennummer schon', s === 200);
  // 16. Anmeldung: Sperre je Konto über viele Absender
  { const http = require('http');
    const lg = (ip, pw) => new Promise(res => { const body = JSON.stringify({ username: 'wart', password: pw });
      const rq = http.request({ host: '127.0.0.1', port: 3254, path: '/api/admin/login', method: 'POST', localAddress: ip, headers: { 'Content-Type': 'application/json', 'X-Clubwerk': '1', 'Content-Length': Buffer.byteLength(body) } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res([r.statusCode, d])); }); rq.on('error', e => res([0, e.message])); rq.end(body); });
    for (let i = 0; i < 4; i++) for (let k = 0; k < 5; k++) await lg('127.0.1.' + (i + 1), 'falsch' + k);
    const [st, d] = await lg('127.0.1.9', 'wart123456'); ok('20 Fehlversuche von 4 Adressen → Konto pausiert (auch mit richtigem Passwort)', st === 401 && /zu viele Fehlversuche/i.test(d), st + ' ' + d.slice(0, 120)); }
  // 17. Unbekannte Adressen (DNS-Rebinding)
  { const http = require('http');
    const hg = (host, port = 3254, path = '/api/tablet/state') => new Promise(res => { const rq = http.request({ host: '127.0.0.1', port, path, headers: { Host: host } }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }); rq.on('error', () => res(0)); rq.end(); });
    ok('Fremder Name → abgelehnt (Verwaltung/Tablet)', (await hg('attacker.example')) === 421);
    ok('…Mitglieder-App', (await hg('attacker.example', 5288, '/api/me')) === 421);
    ok('…Beregnung', (await hg('attacker.example', 5287, '/api/info')) === 421);
    ok('IP-Adresse geht', (await hg('192.168.1.20:3100')) === 200);
    ok('homeassistant.local geht', (await hg('homeassistant.local:3100')) === 200);
    ok('verein.example.org zunächst nicht', (await hg('verein.example.org')) === 421);
    [s] = await A('a', 'api/admin/settings/hosts', 'PUT', { hosts: 'verein.example.org' });
    ok('…nach Eintrag unter „Weitere Adressen“ schon', s === 200 && (await hg('verein.example.org')) === 200); }
  // 9. Header
  [s, j, h] = await A('a', 'api/admin/status'); ok('Admin-Antworten: no-store, Klick-Fallen-Schutz', h.get('cache-control') === 'no-store' && h.get('x-frame-options') === 'SAMEORIGIN' && /frame-ancestors 'self'/.test(h.get('content-security-policy')));
  { const r = await fetch('http://127.0.0.1:5288/'); ok('Mitglieder-App: nicht einbettbar', r.headers.get('x-frame-options') === 'DENY'); }
  // 10. SVG-Logo mit verstecktem Skript
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a><animate attributeName="href" values="&#x6A;avascript:alert(1)"/><text>x</text></a></svg>';
  [s, j] = await A('a', 'api/admin/logo', 'POST', Buffer.from(svg), 'image/svg+xml'); ok('SVG mit verstecktem Skript abgelehnt', s === 400, j.error);
  [s] = await A('a', 'api/admin/logo', 'POST', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><svg:script>alert(1)</svg:script></svg>'), 'image/svg+xml'); ok('SVG mit Namensraum-Skript abgelehnt', s === 400);
  // 18. Erweiterung aus dem Netzwerkordner: Freigabe genau des angezeigten Stands, läuft aus geschützter Kopie
  [s, j] = await A('a', 'api/admin/extensions'); const bo2 = j.all.find(x => x.id === 'boese');
  [s, j] = await A('a', 'api/admin/extensions/boese/approve', 'POST', { password: 'Test-Kennwort-42', hash: bo2.hash }); ok('Freigabe mit Passwort und Prüfsumme', s === 200, j.error);
  await stop(); await start();
  await A('a', 'api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' });
  await A('a', 'api/admin/extensions/boese', 'PUT', { active: true });
  { const r = await fetch(B + 'x/boese/admin.js'); ok('Freigegebene Erweiterung läuft', r.status === 200 && /v1/.test(await r.text())); }
  fs.writeFileSync(S + '/evilext/boese/public/admin.js', "window.BOESE='BOESARTIG';");
  { const r = await fetch(B + 'x/boese/admin.js'); ok('Nachträglich im Netzwerkordner geänderte Datei wird NICHT ausgeliefert', /v1/.test(await r.text())); }
  await stop(); await start(); await A('a', 'api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' });
  { const r = await fetch(B + 'x/boese/admin.js'); ok('…auch nach Neustart läuft die freigegebene Kopie', /v1/.test(await r.text())); }
  [s, j] = await A('a', 'api/admin/extensions'); ok('…die geänderte Version wartet auf Prüfung', j.all.find(x => x.id === 'boese').pending === true);
  // 19. Getränke ausgeschaltet: keine Umgehung über Großbuchstaben/Schrägstrich
  await A('a', 'api/admin/extensions/getraenke', 'PUT', { active: false });
  for (const u of ['api/tablet/State', 'api/tablet/state/', 'api/tablet//state']) { const r = await fetch(B + u, { headers: { 'X-Clubwerk': '1' } }); ok('Getränke aus: ' + u + ' gesperrt', r.status === 404, r.status); }
  [s] = await A('a', 'api/admin/Articles'); ok('Getränke aus: /api/admin/Articles gesperrt', s === 404, s);
  await stop();
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); try { await stop(); } catch (x) { /* */ } process.exit(1); });
