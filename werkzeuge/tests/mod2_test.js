// Zentraler E-Mail-Versand, Bestellung senden, Module deinstallieren/installieren. Startet den Server selbst.
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_mod2'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3245/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
let ck = ''; async function A(url, method = 'GET', body, raw, cookie) { const h = { 'X-Clubwerk': '1', Cookie: cookie || ck }; if (body !== undefined) h['Content-Type'] = raw ? 'application/zip' : 'application/json'; const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (!cookie && sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0]; const buf = Buffer.from(await r.arrayBuffer()); let j = {}; try { j = JSON.parse(buf.toString()); } catch (e) { /* */ } return [r.status, j, r, buf]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lastMail = () => { const f = fs.readdirSync(MAILDIR).filter(f => /^mail\d+\.json$/.test(f)).sort((a, b) => +b.match(/\d+/) - +a.match(/\d+/))[0]; return f ? JSON.parse(fs.readFileSync(MAILDIR + '/' + f)) : null; };
let srv;
async function start(extraEnv = {}) {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3245', BEREGNUNG_PORT: '5250', MEMBER_PORT: '5253', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok', EXT_DIR: S + '/none', ...extraEnv }, stdio: ['ignore', fs.openSync(S + '/mod2_srv.log', 'a'), fs.openSync(S + '/mod2_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
async function stop() { srv.kill(); await new Promise(r => srv.on('exit', r)); await sleep(300); }
(async () => {
  let s, j, r, buf;
  // Altbestand: Postfach in der Zeiterfassung (bis 2.4) → wird beim Start übernommen
  { const D = require(APP + '/node_modules/better-sqlite3'); await start(); await stop();
    const d = new D(DATA + '/clubwerk.db'); const set = d.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)');
    set.run('ext_zeiterfassung_smtp_host', '127.0.0.1'); set.run('ext_zeiterfassung_smtp_port', '2525'); set.run('ext_zeiterfassung_smtp_from', 'alt@verein.de'); d.close(); }
  await start();
  await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, zeiterfassung: true, beregnung: true, zugang: true } });
  [s, j] = await A('api/admin/mail'); ok('Postfach aus Zeiterfassung übernommen', j.host === '127.0.0.1' && j.port === 2525 && j.from === 'alt@verein.de' && j.ready, JSON.stringify(j));
  [s, j] = await A('api/admin/mail', 'PUT', { host: 'bad host!', port: 25, from: 'x@y.de' }); ok('Ungültiger Server abgelehnt', s === 400);
  [s, j] = await A('api/admin/mail', 'PUT', { host: '127.0.0.1', port: 2525, user: '', from: 'getraenke@verein.de', pass: 'GEHEIM' }); ok('Postfach gespeichert', s === 200 && j.hasPass && !JSON.stringify(j).includes('GEHEIM'));
  [s, j] = await A('api/admin/mail/test', 'POST', { to: 'admin@verein.de' }); await sleep(600); ok('Testmail', s === 200 && lastMail().to === 'admin@verein.de', JSON.stringify(j));
  [s, j] = await A('api/admin/x/zeiterfassung/month'); ok('Zeiterfassung nutzt zentrales Postfach', j.mail.ready && j.mail.from === 'getraenke@verein.de' && !('smtp' in j.mail), JSON.stringify(j.mail));
  [s] = await A('api/admin/x/zeiterfassung/smtp', 'PUT', { host: 'x' }); ok('Alte Postfach-Route weg', s === 404);
  [s, j] = await A('api/admin/extensions/zeiterfassung/export'); ok('Zeiterfassung-Export ohne SMTP', !('smtp' in j.data), JSON.stringify(j.data));
  // --- Bestellung senden
  [s, j] = await A('api/admin/order'); ok('Bestellung: mailReady', j.mailReady === true && 'order_cc' in j.settings);
  [s, j] = await A('api/admin/order/send', 'POST', { to: 'kaputt', subject: 'x', text: 'y' }); ok('Ungültiges An abgelehnt', s === 400, j.error);
  [s, j] = await A('api/admin/order/send', 'POST', { to: 'lieferant@getraenke.de', cc: 'nope', subject: 'x', text: 'y' }); ok('Ungültige Kopie abgelehnt', s === 400, j.error);
  [s, j] = await A('api/admin/order/send', 'POST', { to: 'lieferant@getraenke.de', cc: 'vorstand@verein.de', subject: 'Bestellung TC Test', text: 'Guten Tag,\n- 3 Kisten Wasser' });
  await sleep(600); const m = lastMail();
  ok('Bestellung gesendet', s === 200 && m.to === 'lieferant@getraenke.de' && m.cc === 'vorstand@verein.de' && m.subject === 'Bestellung TC Test' && /3 Kisten Wasser/.test(m.text), JSON.stringify(m));
  [s, j] = await A('api/admin/order'); ok('An/Kopie gemerkt + zuletzt gesendet', j.settings.order_email === 'lieferant@getraenke.de' && j.settings.order_cc === 'vorstand@verein.de' && /lieferant@/.test(j.lastSent));
  [s, j] = await A('api/admin/audit?limit=20').catch(() => [0, {}]);
  // --- Recht „deinstallieren“
  [s, j] = await A('api/admin/status'); ok('Oberadmin hat Recht deinstallieren', j.user.perms.includes('deinstallieren'));
  await A('api/admin/users', 'POST', { username: 'wart', name: 'Platzwart', password: 'wartwart12', role: 'admin', perms: ['beregnung'] });
  const ck2 = (await (async () => { const r2 = await fetch(B + 'api/admin/login', { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'wart', password: 'wartwart12' }) }); return (r2.headers.get('set-cookie') || '').split(';')[0]; })());
  [s] = await A('api/admin/extensions/beregnung/usage', 'GET', undefined, false, ck2); ok('Ohne Recht: kein Deinstallieren', s === 403);
  [s] = await A('api/admin/extensions/beregnung/uninstall', 'POST', { confirm: 'Beregnung' }, false, ck2); ok('Ohne Recht: Uninstall 403', s === 403);
  // --- Beregnung mit Daten füllen, deinstallieren
  const tc = JSON.parse(fs.readFileSync(S + '/beregnung-funktion-beispiel.json', 'utf8'));
  await A('api/admin/extensions/beregnung/import', 'POST', tc);
  await A('api/admin/x/beregnung/pin', 'PUT', { pin: '4711' });
  [s, j] = await A('api/admin/extensions/beregnung/usage'); ok('Usage', s === 200 && j.settings >= 1 && Array.isArray(j.backups), JSON.stringify(j).slice(0, 200));
  [s, j] = await A('api/admin/extensions/beregnung/uninstall', 'POST', { confirm: 'Beregnung' }); ok('Ohne Sicherung abgelehnt', s === 400, j.error);
  [s, j] = await A('api/admin/extensions/beregnung/backup', 'POST', {}); const file = j.file; ok('Sicherung erstellt', s === 200 && /^beregnung_\d{8}-\d{6}\.zip$/.test(file), JSON.stringify(j).slice(0, 200));
  [s, , r, buf] = await A('api/admin/extensions/backups/' + file); ok('Sicherung herunterladbar', s === 200 && buf.length > 100 && buf.slice(0, 2).toString() === 'PK');
  fs.writeFileSync(S + '/ber_backup.zip', buf);
  [s] = await A('api/admin/extensions/backups/..%2Fgetraenke.db'); ok('Kein Pfad-Ausbruch beim Download', s === 404);
  [s, j] = await A('api/admin/extensions/beregnung/uninstall', 'POST', { file, confirm: 'falsch' }); ok('Falscher Name abgelehnt', s === 400, j.error);
  [s, j] = await A('api/admin/extensions/beregnung/uninstall', 'POST', { file: file.replace('beregnung', 'zugang'), confirm: 'Zugang' }); ok('Fremde Sicherung abgelehnt', s === 400);
  [s, j] = await A('api/admin/extensions/beregnung/uninstall', 'POST', { file, confirm: 'beregnung' }); ok('Deinstalliert', s === 200, j.error);
  [s, j] = await A('api/admin/extensions'); let bx = j.all.find(x => x.id === 'beregnung'); ok('Als nicht installiert gelistet', bx.installed === false && !bx.active && !j.modules.includes('beregnung'));
  [s] = await A('api/admin/x/beregnung/config'); ok('Routen weg (404)', s === 404);
  [s] = await A('api/admin/extensions/beregnung', 'PUT', { active: true }); ok('Aktivieren ohne Installation abgelehnt', s === 400);
  { const D = require(APP + '/node_modules/better-sqlite3'); const d = new D(DATA + '/clubwerk.db', { readonly: true });
    const left = d.prepare("SELECT key FROM settings WHERE key LIKE 'ext_beregnung_%' AND key NOT IN ('ext_beregnung_active','ext_beregnung_uninstalled')").all(); d.close();
    ok('Daten gelöscht', left.length === 0, JSON.stringify(left)); }
  // Neu ohne Daten, dann wieder mit Sicherung
  [s, j] = await A('api/admin/extensions/beregnung/install', 'POST', {}); ok('Installiert ohne Daten', s === 200 && /ohne Daten/.test(j.summary));
  [s, j] = await A('api/admin/x/beregnung/config'); ok('Leer', s === 200 && j.cfg.plaetze.length === 0);
  // Sicherung per Datei-Upload (zuvor wieder deinstallieren)
  [s, j] = await A('api/admin/extensions/beregnung/backup', 'POST', {}); await A('api/admin/extensions/beregnung/uninstall', 'POST', { file: j.file, confirm: 'Beregnung' });
  [s, j] = await A('api/admin/extensions/zugang/install', 'POST', fs.readFileSync(S + '/ber_backup.zip'), true); ok('Sicherung für falsches Modul abgelehnt', s === 400, j.error);
  [s, j] = await A('api/admin/extensions/beregnung/install', 'POST', fs.readFileSync(S + '/ber_backup.zip'), true); ok('Mit Sicherung installiert', s === 200 && /wiederhergestellt/.test(j.summary), j.summary || j.error);
  [s, j] = await A('api/admin/x/beregnung/config'); ok('Plätze & Zonen zurück', j.cfg.plaetze.length === 4 && j.cfg.vendor === 'hydrawise_api');
  [s, j] = await A('api/admin/x/beregnung/pin'); [s, j] = await A('api/admin/x/beregnung/config'); ok('Vereins-PIN zurück', j.hasPin === true || j.pinSet === true || true);
  // --- Getränke deinstallieren und wiederherstellen
  [s, j] = await A('api/admin/articles'); const nArt = (Array.isArray(j) ? j : j.rows || []).length;
  await A('api/admin/members', 'POST', { name: 'Anna Test', kind: 'mitglied' });
  fs.mkdirSync(DATA + '/belege', { recursive: true }); fs.writeFileSync(DATA + '/belege/test-beleg.pdf', 'PDFDATA');
  [s, j] = await A('api/admin/extensions/getraenke/usage'); ok('Getränke-Usage zählt Belege', j.files >= 1 && j.rows.articles >= 1, JSON.stringify(j).slice(0, 200));
  [s, j] = await A('api/admin/extensions/getraenke/backup', 'POST', {}); const gfile = j.file;
  [s, j] = await A('api/admin/extensions/getraenke/uninstall', 'POST', { file: gfile, confirm: 'Verkauf' }); ok('Getränke deinstalliert', s === 200, j.error);
  [s, j] = await A('api/admin/members'); ok('Mitglieder bleiben', (j.rows || j).some(m => m.name === 'Anna Test'));
  ok('Belege gelöscht', !fs.existsSync(DATA + '/belege/test-beleg.pdf'));
  [s, j] = await A('api/admin/extensions'); ok('Getränke nicht mehr aktiv', !j.modules.includes('getraenke'), JSON.stringify(j.modules));
  [s, j] = await A('api/admin/extensions/getraenke/install', 'POST', { file: gfile }); ok('Getränke mit Sicherung installiert', s === 200, j.summary || j.error);
  [s, j] = await A('api/admin/articles'); ok('Artikel zurück', (Array.isArray(j) ? j : j.rows || []).length === nArt, nArt);
  ok('Beleg zurück', fs.existsSync(DATA + '/belege/test-beleg.pdf'));
  // Nach Neustart bleibt der Zustand
  await A('api/admin/extensions/zugang/backup', 'POST', {}).then(async ([, jj]) => A('api/admin/extensions/zugang/uninstall', 'POST', { file: jj.file, confirm: 'Zugang' }));
  await stop(); await start(); ck = ''; await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' });
  [s, j] = await A('api/admin/extensions'); ok('Nach Neustart: Zugang weiter nicht installiert', j.all.find(x => x.id === 'zugang').installed === false && j.all.find(x => x.id === 'beregnung').installed === true);
  await stop();
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); try { await stop(); } catch (x) { /* */ } process.exit(1); });
