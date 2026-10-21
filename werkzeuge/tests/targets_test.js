// Sicherungsziele 2.14: WebDAV, SFTP, FTPS gegen echte Testserver (srv/servers.py)
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_tg'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3262/';
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 240) : '')); if (!c) fails++; };
const jar = {}; async function A(who, url, method = 'GET', body) { const h = { 'X-Getraenke': '1', Cookie: jar[who] || '' }; if (body !== undefined) h['Content-Type'] = 'application/json'; const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (sc && /^gadmin=/.test(sc) && !/^gadmin=;/.test(sc)) jar[who] = sc.split(';')[0]; return [r.status, await r.json().catch(() => ({})), r]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let srv;
async function start() { const env = { ...process.env, DATA_DIR: DATA, PORT: '3262', BEREGNUNG_PORT: '5263', MEMBER_PORT: '5264', EXT_DIR: S + '/none', CW_TEST_NO_SETUP_CODE: '1' };
  srv = spawn('node', ['src/server.js'], { cwd: APP, env, stdio: ['ignore', fs.openSync(S + '/tg_srv.log', 'a'), fs.openSync(S + '/tg_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); } }
async function stop() { srv.kill(); await new Promise(r => srv.on('exit', r)); await sleep(300); }
const MY = { myPassword: 'Test-Kennwort-42' };
(async () => {
  await start(); let s, j;
  await A('a', 'api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, zeiterfassung: true } });
  await A('a', 'api/admin/backups/password', 'POST', { password: 'Vereinsheim-Sicher-2026', ...MY });
  await A('a', 'api/admin/backups/run', 'POST', {});
  [s, j] = await A('a', 'api/admin/backups/status'); ok('Ohne Ziel: Hinweis „nur hier auf dem Gerät“', /Kein Sicherungsziel/.test(j.warn) && j.warnLevel === 'a', j.warn);
  await A('a', 'api/admin/users', 'POST', { username: 'kasse', name: 'K', password: 'kasse12345', perms: ['einstellungen'] });
  await A('k', 'api/admin/login', 'POST', { username: 'kasse', password: 'kasse12345' });
  const dav = { type: 'webdav', name: 'Nextcloud', url: 'http://127.0.0.1:8081/remote.php/dav/files/verein', user: 'verein', folder: '/Vereinsheim' };
  [s] = await A('k', 'api/admin/backups/targets', 'POST', { target: dav, secret: 'davpass123', myPassword: 'kasse12345' }); ok('Ziel anlegen nur „alle Rechte“', s === 403);
  [s] = await A('k', 'api/admin/backups/targets/test', 'POST', { target: dav, secret: 'davpass123' }); ok('…auch Testen mit eingegebenen Daten', s === 403);
  [s, j] = await A('a', 'api/admin/backups/targets', 'POST', { target: dav, secret: 'davpass123', myPassword: 'falsch' }); ok('…mit eigenem Passwort', s === 401);
  [s, j] = await A('a', 'api/admin/backups/targets', 'POST', { target: dav, secret: 'davpass123', ...MY }); ok('http:// ohne Bestätigung abgelehnt', s === 400 && j.needInsecure, j.error);
  [s, j] = await A('a', 'api/admin/backups/targets', 'POST', { target: { ...dav, allowInsecure: true }, secret: 'falsch', ...MY }); ok('Falsches Passwort → nicht gespeichert', s === 400 && /Passwort falsch/.test(j.error), j.error);
  [s, j] = await A('a', 'api/admin/backups/targets', 'POST', { target: { ...dav, allowInsecure: true }, secret: 'davpass123', ...MY }); ok('WebDAV angelegt (Verbindung geprüft)', s === 200, j.error);
  // SFTP: Fingerabdruck
  const sf = { type: 'sftp', name: 'NAS', host: '127.0.0.1', port: 2222, user: 'verein', folder: '/Vereinsheim' };
  [s, j] = await A('a', 'api/admin/backups/targets/test', 'POST', { target: sf, secret: 'sftppass123' }); const hk = j.fingerprint;
  ok('SFTP-Test zeigt Fingerabdruck zur Bestätigung', s === 200 && j.needConfirm && /^SHA256:/.test(hk), JSON.stringify(j));
  [s, j] = await A('a', 'api/admin/backups/targets', 'POST', { target: sf, secret: 'sftppass123', ...MY }); ok('…ohne Bestätigung nicht speicherbar', s === 400 && j.needConfirm);
  [s, j] = await A('a', 'api/admin/backups/targets', 'POST', { target: { ...sf, hostKey: hk }, secret: 'sftppass123', ...MY }); ok('SFTP angelegt', s === 200, j.error);
  // FTPS: Zertifikat
  const ft = { type: 'ftp', name: 'FRITZ!Box', mode: 'ftps', host: '127.0.0.1', port: 2121, user: 'verein', folder: '/Vereinsheim', retention: { daily: 2, weekly: 0, monthly: 0 } };
  [s, j] = await A('a', 'api/admin/backups/targets/test', 'POST', { target: ft, secret: 'ftppass123' }); const cf = j.fingerprint;
  ok('FTPS-Test zeigt Zertifikats-Fingerabdruck', j.needConfirm && /^([0-9A-F]{2}:){31}/.test(cf), JSON.stringify(j));
  [s, j] = await A('a', 'api/admin/backups/targets', 'POST', { target: { ...ft, certFp: cf }, secret: 'ftppass123', ...MY }); ok('FTPS angelegt (eigene Aufbewahrung 2 Tage)', s === 200, j.error);
  [s, j] = await A('a', 'api/admin/backups/targets', 'POST', { target: { type: 'ftp', mode: 'ftp', host: '127.0.0.1', port: 2122, user: 'verein' }, secret: 'ftppass123', ...MY }); ok('Reines FTP nur mit Bestätigung', s === 400 && j.needInsecure);
  let r; [s, j, r] = await A('a', 'api/admin/backups/targets'); const txt = JSON.stringify(j);
  ok('Liste ohne Zugangsdaten', s === 200 && j.targets.length === 3 && !/davpass|sftppass|ftppass/.test(txt) && j.targets.every(t => t.hasSecret), txt.slice(0, 200));
  // alte Dateien auf der FRITZ!Box (Aufbewahrung je Ziel)
  const fdir = S + '/srv/ftp/Vereinsheim/Komplett'; fs.mkdirSync(fdir, { recursive: true });
  for (let i = 1; i <= 10; i++) fs.writeFileSync(`${fdir}/2026-0${1 + (i % 8)}-1${i % 10}_Clubwerk.cwbackup`, 'alt');
  [s, j] = await A('a', 'api/admin/backups/run', 'POST', {}); ok('Sicherung an alle drei Ziele', s === 200 && /Nextcloud ✓/.test(j.msg) && /NAS ✓/.test(j.msg) && /FRITZ!Box ✓/.test(j.msg), j.msg || j.error);
  const day = new Date().toLocaleDateString('sv-SE'); const fn = `${day}_Clubwerk.cwbackup`;
  const local = fs.readdirSync(DATA + '/backups/komplett').sort().reverse()[0]; const sz = fs.statSync(DATA + '/backups/komplett/' + local).size;
  for (const [n, d] of [['WebDAV', 'dav'], ['SFTP', 'sftp'], ['FTPS', 'ftp']]) { const f = `${S}/srv/${d}/Vereinsheim/Komplett/${fn}`; ok(`${n}: Komplettsicherung angekommen, vollständig`, fs.existsSync(f) && fs.statSync(f).size === sz, fs.existsSync(f) ? fs.statSync(f).size + ' vs ' + sz : 'fehlt'); }
  ok('Lesbare Auszüge auch auf den Zielen', fs.readdirSync(S + '/srv/sftp/Vereinsheim/Lesbar').some(f => /Getraenke-Stand/.test(f)));
  ok('Aufbewahrung je Ziel: FRITZ!Box behält 2 Tage', fs.readdirSync(fdir).filter(f => f.endsWith('.cwbackup')).length === 2, fs.readdirSync(fdir).join(','));
  ok('Keine halbfertigen Dateien liegen herum', !fs.readdirSync(fdir).some(f => f.endsWith('.part')) && !fs.readdirSync(S + '/srv/sftp/Vereinsheim/Komplett').some(f => f.endsWith('.part')));
  [s, j] = await A('a', 'api/admin/backups/status'); ok('Status: 3 von 3 in Ordnung, keine Warnung', j.targetsOk === 3 && j.targetsOn === 3 && !j.warn, j.warn);
  const nas = j.targets.find(t => t.name === 'NAS');
  [s, j] = await A('a', `api/admin/backups/targets/${nas.id}/files`); ok('Dateien auf dem NAS auflisten', s === 200 && j.files.some(f => f.file === fn), JSON.stringify(j).slice(0, 120));
  [s, j] = await A('a', 'api/admin/backups/komplett/restore', 'POST', { source: 'target', target: nas.id, file: fn, ...MY }); ok('Wiederherstellen vom NAS (SFTP)', s === 200 && j.restart, j.error);
  await A('a', 'api/admin/backups/restore', 'DELETE');
  const dv = (await A('a', 'api/admin/backups/targets'))[1].targets.find(t => t.name === 'Nextcloud');
  [s, j] = await A('a', 'api/admin/backups/komplett/restore', 'POST', { source: 'target', target: dv.id, file: fn, ...MY }); ok('Wiederherstellen von Nextcloud (WebDAV)', s === 200, j.error);
  await A('a', 'api/admin/backups/restore', 'DELETE');
  // Ziel fällt aus: Fehler sichtbar, andere Ziele laufen weiter
  const Db = require(APP + '/node_modules/better-sqlite3'); const d2 = new Db(DATA + '/clubwerk.db');
  const list = JSON.parse(d2.prepare("SELECT value FROM settings WHERE key='backup_targets'").get().value); list.find(t => t.name === 'Nextcloud').url = 'http://127.0.0.1:8099/dav';
  d2.prepare("UPDATE settings SET value=? WHERE key='backup_targets'").run(JSON.stringify(list));
  d2.prepare("UPDATE settings SET value=? WHERE key=?").run(JSON.stringify({ last_ok: '2026-01-01T00:00:00.000Z' }), `backup_target_${dv.id}_status`); d2.close();
  [s, j] = await A('a', 'api/admin/backups/run', 'POST', {}); ok('Ein Ziel nicht erreichbar → andere bekommen die Sicherung trotzdem', s === 200 && /Nextcloud ✗/.test(j.msg) && /NAS ✓/.test(j.msg), j.msg);
  [s, j] = await A('a', 'api/admin/backups/status'); ok('Warnung nennt das gestörte Ziel', /„Nextcloud“/.test(j.warn) && j.warnLevel === 'r' && j.targetsOk === 2, j.warn);
  // Zertifikat ändert sich → Abbruch vor Passwort
  const d3 = new Db(DATA + '/clubwerk.db'); const l3 = JSON.parse(d3.prepare("SELECT value FROM settings WHERE key='backup_targets'").get().value);
  l3.find(t => t.name === 'FRITZ!Box').certFp = Array(32).fill('AB').join(':'); d3.prepare("UPDATE settings SET value=? WHERE key='backup_targets'").run(JSON.stringify(l3)); d3.close();
  const fb = (await A('a', 'api/admin/backups/targets'))[1].targets.find(t => t.name === 'FRITZ!Box');
  [s, j] = await A('a', `api/admin/backups/targets/${fb.id}/test`, 'POST', {}); ok('Anderes Zertifikat → Abbruch (Schutz vor untergeschobenem Server)', s === 400 && /ANDEREN Zertifikat/.test(j.error), j.error);
  // Entfernen
  [s] = await A('k', `api/admin/backups/targets/${fb.id}`, 'DELETE', { myPassword: 'kasse12345' }); ok('Entfernen nur „alle Rechte“', s === 403);
  [s, j] = await A('a', `api/admin/backups/targets/${fb.id}`, 'DELETE', MY); ok('Ziel entfernt', s === 200 && j.targets.length === 2);
  const d4 = new Db(DATA + '/clubwerk.db', { readonly: true }); const left = d4.prepare('SELECT COUNT(*) n FROM settings WHERE key LIKE ?').get(`backup_target_${fb.id}_%`).n; d4.close();
  ok('…mit Zugangsdaten', left === 0);
  // Bearbeiten ohne neues Passwort behält das alte
  [s, j] = await A('a', `api/admin/backups/targets/${nas.id}`, 'PUT', { target: { name: 'NAS Vereinsheim' }, ...MY }); ok('Umbenennen ohne Passwort-Neueingabe', s === 200 && j.targets.some(t => t.name === 'NAS Vereinsheim'), j.error);
  [s, j] = await A('a', `api/admin/backups/targets/${nas.id}`, 'PUT', { target: { host: 'localhost' }, ...MY }); ok('Anderer Server → Fingerabdruck muss neu bestätigt werden', s === 400 && j.needConfirm, j.error);
  await stop();
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); try { await stop(); } catch (x) { /* */ } process.exit(1); });
