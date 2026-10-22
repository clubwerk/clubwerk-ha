// Datensicherung 2.13: verschlüsselte Komplettsicherung, Dropbox, Generationen, Probe, Wiederherstellen
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_bk'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3261/'; const DBX = 'http://127.0.0.1:3298';
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 220) : '')); if (!c) fails++; };
const jar = {}; async function A(who, url, method = 'GET', body, raw) { const h = { 'X-Getraenke': '1', Cookie: jar[who] || '' }; if (body !== undefined && !raw) h['Content-Type'] = 'application/json'; if (raw) h['Content-Type'] = raw; const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (sc && /^gadmin=/.test(sc) && !/^gadmin=;/.test(sc)) jar[who] = sc.split(';')[0]; const ct = r.headers.get('content-type') || ''; return [r.status, ct.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer())]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let srv, dbx;
async function start() { const env = { ...process.env, DATA_DIR: DATA, PORT: '3261', BEREGNUNG_PORT: '5261', MEMBER_PORT: '5262', EXT_DIR: S + '/none', DROPBOX_API: DBX, DROPBOX_CONTENT: DBX, CW_TEST_NO_SETUP_CODE: '1' };
  srv = spawn('node', ['src/server.js'], { cwd: APP, env, stdio: ['ignore', fs.openSync(S + '/bk_srv.log', 'a'), fs.openSync(S + '/bk_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); } }
async function stop() { srv.kill(); await new Promise(r => srv.on('exit', r)); await sleep(300); }
const login = async () => { await A('a', 'api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' }); };
(async () => {
  dbx = spawn('node', [S + '/work/fake_dropbox2.js', '3298'], { stdio: 'ignore' }); await sleep(500);
  await start();
  let s, j;
  [s, j] = await A('a', 'api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, zeiterfassung: true, zugang: true, beregnung: true } }); ok('Einrichtung', s === 200, j.error);
  [s, j] = await A('a', 'api/admin/extensions'); const g = j.all.find(x => x.id === 'getraenke'); ok('Getränke ist ein Modul wie alle (im Paket)', g && g.source === 'mitgeliefert' && j.all.find(x => x.id === 'zugang').source === 'mitgeliefert');
  ok('Module alphabetisch', j.all.map(x => x.name).join() === [...j.all.map(x => x.name)].sort((a, b) => a.localeCompare(b, 'de')).join(), j.all.map(x => x.name).join());
  [s, j] = await A('a', 'api/admin/backups/status'); ok('Ohne Sicherungspasswort: Warnung', s === 200 && !j.hasKey && /Sicherungspasswort/.test(j.warn));
  [s, j] = await A('a', 'api/admin/backups/run', 'POST', {}); ok('…und keine Sicherung', s === 400);
  await A('a', 'api/admin/users', 'POST', { username: 'kasse', name: 'K', password: 'kasse12345', perms: ['einstellungen'] });
  await A('k', 'api/admin/login', 'POST', { username: 'kasse', password: 'kasse12345' });
  [s] = await A('k', 'api/admin/backups/password', 'POST', { password: 'Vereinsheim-Sicher-2026', myPassword: 'kasse12345' }); ok('Sicherungspasswort nur „alle Rechte“', s === 403);
  [s] = await A('a', 'api/admin/backups/password', 'POST', { password: 'Vereinsheim-Sicher-2026', myPassword: 'falsch' }); ok('…mit eigenem Passwort', s === 401);
  [s] = await A('a', 'api/admin/backups/password', 'POST', { password: 'kurz', myPassword: 'Test-Kennwort-42' }); ok('…mindestens 10 Zeichen', s === 400);
  [s, j] = await A('a', 'api/admin/backups/password', 'POST', { password: 'Vereinsheim-Sicher-2026', myPassword: 'Test-Kennwort-42' }); ok('Sicherungspasswort festgelegt', s === 200);
  [s] = await A('a', 'api/admin/backups/password/check', 'POST', { password: 'Vereinsheim-Sicher-2026' }); ok('Prüfen (Notfallblatt): richtig', s === 200);
  [s] = await A('a', 'api/admin/backups/password/check', 'POST', { password: 'anders123456' }); ok('…falsch', s === 401);
  // Daten anlegen
  [s, j] = await A('a', 'api/admin/members', 'POST', { name: 'Anna Geheimname', kind: 'mitglied' });
  fs.mkdirSync(DATA + '/belege/2026', { recursive: true }); fs.writeFileSync(DATA + '/belege/2026/rechnung-1.pdf', '%PDF-1.4 Rechnung Getraenke Woersdoerfer');
  fs.mkdirSync(DATA + '/artikelbilder', { recursive: true }); fs.writeFileSync(DATA + '/artikelbilder/a1.webp', 'BILD');
  await A('a', 'api/admin/x/zeiterfassung/staff', 'POST', { name: 'Maria Keller', job: 'Reinigung', pin: '4321', rate: '14,00' });
  // 1. nur lokal
  [s, j] = await A('a', 'api/admin/backups/run', 'POST', {}); ok('Sicherung ohne Ziel: lokal', s === 200 && /nur lokal/.test(j.msg), j.msg || j.error);
  [s, j] = await A('a', 'api/admin/backups/status'); const f1 = j.local[0];
  ok('Komplettsicherung liegt vor (Hinweis: kein Ziel)', j.local.length === 1 && /_Clubwerk\.cwbackup$/.test(f1.file) && /Kein Sicherungsziel/.test(j.warn), JSON.stringify(j.local) + ' ' + j.warn);
  const raw = fs.readFileSync(DATA + '/backups/komplett/' + f1.file);
  ok('Datei ist verschlüsselt (kein Klartext, Kennung CWSICH01)', raw.subarray(0, 8).toString() === 'CWSICH01' && !raw.includes('Anna') && !raw.includes('Rechnung') && !raw.includes('SQLite'));
  [s, j] = await A('a', 'api/admin/backups/probe', 'POST', {}); ok('Probe-Wiederherstellung', s === 200 && /vollständig/.test(j.msg) && /1 belege/.test(j.msg) && /1 artikelbilder/.test(j.msg), j.msg || j.error);
  [s, j] = await A('a', 'api/admin/backups/komplett/file/' + f1.file); ok('Herunterladen (verschlüsselt)', s === 200 && j.subarray(0, 8).toString() === 'CWSICH01');
  [s] = await A('a', 'api/admin/backup-komplett.tar.gz'); ok('Alte unverschlüsselte Komplettsicherung gibt es nicht mehr', s !== 200, s);
  // 2. Dropbox
  await A('a', 'api/admin/dropbox', 'PUT', { appKey: 'appkey12345', appSecret: 'secretsecret12' });
  [s, j] = await A('a', 'api/admin/dropbox/connect', 'POST', { code: 'GUTERCODE1234567890' }); ok('Dropbox verbunden', s === 200, j.error);
  await fetch(DBX + '/_seed');
  [s, j] = await A('a', 'api/admin/backups/status'); ok('Lesbare Auszüge von Haus aus aus (unverschlüsselt)', s === 200 && j.readable === false, JSON.stringify(j.readable));
  await A('a', 'api/admin/backups/settings', 'PUT', { readable: true });
  [s, j] = await A('a', 'api/admin/backups/run', 'POST', {}); ok('Sicherung mit Dropbox', s === 200 && /Dropbox ✓ \(\+4 lesbar\)/.test(j.msg), j.msg || j.error);
  let files = (await (await fetch(DBX + '/_files')).json()).map(x => x[0]);
  const day = new Date().toLocaleDateString('sv-SE');
  ok('Komplett/heute in Dropbox', files.includes(`/clubwerk/komplett/${day}_clubwerk.cwbackup`), files.filter(f => f.includes('komplett')).slice(-3).join(' '));
  ok('Lesbare Auszüge: Getränke, Arbeitszeiten, Zugang, Beregnung', ['getraenke-stand', 'arbeitszeiten_', 'zugang-protokoll_', 'beregnung-protokoll_'].every(k => files.some(f => f.includes('/lesbar/') && f.includes(k))), files.filter(f => f.includes('lesbar')).join(' '));
  const kompl = files.filter(f => f.includes('/komplett/'));
  ok('Generationen: alte Dropbox-Sicherungen aufgeräumt', kompl.length <= 7 + 4 + 12 && kompl.length < 41, kompl.length);
  [s, j] = await A('a', 'api/admin/backups/remote'); ok('Dropbox-Liste + 2 alte unverschlüsselte Dateien erkannt', s === 200 && j.files.length === kompl.length && j.legacy === 2, JSON.stringify({ n: j.files.length, legacy: j.legacy }));
  [s] = await A('k', 'api/admin/backups/remote/cleanup-legacy', 'POST', { myPassword: 'kasse12345' }); ok('Alte Dateien löschen nur „alle Rechte“', s === 403);
  [s, j] = await A('a', 'api/admin/backups/remote/cleanup-legacy', 'POST', { myPassword: 'Test-Kennwort-42' }); ok('Alte unverschlüsselte Dateien gelöscht', s === 200 && j.removed === 2);
  // 3. Wiederherstellen aus Dropbox (gleiches Passwort → ohne Eingabe)
  await A('a', 'api/admin/members', 'POST', { name: 'Nach Sicherung', kind: 'mitglied' });
  fs.unlinkSync(DATA + '/belege/2026/rechnung-1.pdf'); fs.writeFileSync(DATA + '/belege/neu.pdf', 'neu');
  [s] = await A('k', 'api/admin/backups/komplett/restore', 'POST', { source: 'dropbox', file: `${day}_Clubwerk.cwbackup`, myPassword: 'kasse12345' }); ok('Wiederherstellen nur „alle Rechte“', s === 403);
  [s, j] = await A('a', 'api/admin/backups/komplett/restore', 'POST', { source: 'dropbox', file: `${day}_Clubwerk.cwbackup`, myPassword: 'Test-Kennwort-42' }); ok('Aus Dropbox geprüft und vorgemerkt', s === 200 && j.restart && j.dirs.belege === 1, JSON.stringify(j));
  [s, j] = await A('a', 'api/admin/backups'); ok('Seite zeigt „wird beim Neustart wiederhergestellt“', /_komplett\.db$/.test(j.pending), j.pending);
  await stop(); await start(); await login();
  [s, j] = await A('a', 'api/admin/members'); const names = (j.rows || j).map(m => m.name);
  ok('Nach Neustart: Stand der Sicherung (Anna da, „Nach Sicherung“ weg)', names.includes('Anna Geheimname') && !names.includes('Nach Sicherung'), names.join());
  ok('…Belege zurück', fs.existsSync(DATA + '/belege/2026/rechnung-1.pdf') && !fs.existsSync(DATA + '/belege/neu.pdf'));
  const aside = fs.readdirSync(DATA).find(d => d.startsWith('vor-wiederherstellung_'));
  ok('…bisheriger Stand der Ordner beiseitegelegt', aside && fs.existsSync(path.join(DATA, aside, 'belege/neu.pdf')), aside);
  [s, j] = await A('a', 'api/admin/x/zeiterfassung/staff'); ok('…Zeiterfassung (Module) mit zurück', JSON.stringify(j).includes('Maria Keller'));
  // 4. Passwort ändern: alte Sicherung braucht altes Passwort
  [s, j] = await A('a', 'api/admin/backups/password', 'POST', { password: 'Neues-Passwort-2027', myPassword: 'Test-Kennwort-42' }); ok('Sicherungspasswort geändert', s === 200 && j.changed);
  [s, j] = await A('a', 'api/admin/backups/status'); const old = j.local[j.local.length - 1].file;
  [s, j] = await A('a', 'api/admin/backups/komplett/restore', 'POST', { source: 'local', file: old, myPassword: 'Test-Kennwort-42' }); ok('Alte Sicherung ohne Passwort → nachfragen', s === 400 && j.needPassword, j.error);
  [s, j] = await A('a', 'api/admin/backups/komplett/restore', 'POST', { source: 'local', file: old, password: 'Neues-Passwort-2027', myPassword: 'Test-Kennwort-42' }); ok('…mit falschem Passwort abgelehnt', s === 400 && /stimmt nicht/.test(j.error), j.error);
  [s, j] = await A('a', 'api/admin/backups/komplett/restore', 'POST', { source: 'local', file: old, password: 'Vereinsheim-Sicher-2026', myPassword: 'Test-Kennwort-42' }); ok('…mit dem damaligen Passwort geht es', s === 200, j.error);
  [s] = await A('a', 'api/admin/backups/restore', 'DELETE'); ok('Abbrechen räumt auch die Ordner weg', s === 200 && !fs.existsSync(DATA + '/.restore-dirs'));
  // 5. Hochladen (z. B. nach Neuinstallation) + Manipulation
  const up = fs.readFileSync(DATA + '/backups/komplett/' + old);
  [s, j] = await A('a', 'api/admin/backups/komplett/upload', 'POST', up, 'application/octet-stream'); ok('Komplettsicherung hochgeladen', s === 200 && j.id && j.sameKey === false, JSON.stringify(j));
  const upId = j.id;
  [s, j] = await A('a', 'api/admin/backups/komplett/restore', 'POST', { source: 'upload', file: upId, myPassword: 'Test-Kennwort-42' }); ok('Fremdes Passwort → nachfragen, Datei bleibt', s === 400 && j.needPassword);
  [s, j] = await A('a', 'api/admin/backups/komplett/restore', 'POST', { source: 'upload', file: upId, password: 'Vereinsheim-Sicher-2026', myPassword: 'Test-Kennwort-42' }); ok('…dann mit Passwort wiederhergestellt', s === 200, j.error);
  await A('a', 'api/admin/backups/restore', 'DELETE');
  const bad = Buffer.from(up); bad[bad.length - 500] ^= 0x55;
  [s, j] = await A('a', 'api/admin/backups/komplett/upload', 'POST', bad, 'application/octet-stream');
  [s, j] = await A('a', 'api/admin/backups/komplett/restore', 'POST', { source: 'upload', file: j.id, password: 'Vereinsheim-Sicher-2026', myPassword: 'Test-Kennwort-42' }); ok('Veränderte Datei wird abgelehnt', s === 400 && /verändert|beschädigt/.test(j.error), j.error);
  [s, j] = await A('a', 'api/admin/backups/komplett/upload', 'POST', Buffer.from('kein backup'.repeat(10)), 'application/octet-stream'); ok('Andere Datei wird abgelehnt', s === 400, j.error);
  // 6. Getränke aus: Sicherung läuft trotzdem (ohne Getränke-Auszug)
  await A('a', 'api/admin/extensions/getraenke', 'PUT', { active: false });
  [s, j] = await A('a', 'api/admin/backups/run', 'POST', {}); ok('Getränke ausgeschaltet: Sicherung läuft, 3 lesbare Auszüge', s === 200 && /\+3 lesbar/.test(j.msg), j.msg || j.error);
  [s, j] = await A('a', 'api/admin/backups/settings', 'PUT', { hour: 25 }); ok('Ungültige Uhrzeit abgelehnt', s === 400);
  [s, j] = await A('a', 'api/admin/backups/settings', 'PUT', { hour: 4, daily: 10, weekly: 8, monthly: 24, readable: false }); ok('Zeitplan gespeichert', s === 200 && j.hour === 4 && j.daily === 10 && !j.readable);
  [s, j] = await A('a', 'api/admin/backups/status'); ok('Lokal nur die letzten 3', j.local.length <= 3, j.local.length);
  [s, j] = await A('a', 'api/admin/settings'); ok('Schlüssel nie in Antworten', !JSON.stringify(j).includes('backup_enc_key'));
  await stop(); dbx.kill();
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); try { await stop(); } catch (x) { /* */ } try { dbx.kill(); } catch (x) { /* */ } process.exit(1); });
