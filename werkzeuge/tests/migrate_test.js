// Umzug: Komplettsicherung aus „Vereinsheim“ 2.16.3 → frisches Clubwerk 3.0 → Daten vollständig da
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const S = process.argv[2]; const OLD = S + '/backup-2.16.3-src'; const NEW = process.env.CW_APP;
const D1 = S + '/mig_old', D2 = S + '/mig_new'; for (const d of [D1, D2]) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); }
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 200) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function client(base) {
  let ck = '';
  return async (url, method = 'GET', body, type) => {
    const h = { 'X-Getraenke': '1', 'X-Clubwerk': '1', Cookie: ck }; let b = body;
    if (body !== undefined && !type) { h['Content-Type'] = 'application/json'; b = JSON.stringify(body); } else if (type) h['Content-Type'] = type;
    const r = await fetch(base + url, { method, headers: h, body: b });
    const sc = r.headers.get('set-cookie'); if (sc && /^gadmin=/.test(sc) && !/^gadmin=;/.test(sc)) ck = sc.split(';')[0];
    const ct = r.headers.get('content-type') || '';
    return [r.status, ct.includes('json') ? await r.json().catch(() => ({})) : Buffer.from(await r.arrayBuffer())];
  };
}
function start(app, data, port, extra = {}) {
  const env = { ...process.env, DATA_DIR: data, PORT: String(port), BEREGNUNG_PORT: String(port + 2000), MEMBER_PORT: String(port + 2001), EXT_DIR: S + '/none', VH_TEST_NO_SETUP_CODE: '1', CW_TEST_NO_SETUP_CODE: '1', ...extra };
  return spawn('node', ['src/server.js'], { cwd: app, env, stdio: ['ignore', fs.openSync(S + `/mig_${port}.log`, 'a'), fs.openSync(S + `/mig_${port}.log`, 'a')] });
}
async function wait(base) { for (let i = 0; i < 80; i++) { try { const r = await fetch(base + 'api/branding'); if (r.ok) return; } catch (e) { /* */ } await sleep(250); } throw new Error('Server startet nicht: ' + base); }
const stop = async p => { p.kill('SIGTERM'); await sleep(800); };
(async () => {
  // 1. alte Version mit Daten
  let o = start(OLD, D1, 3271); const B1 = 'http://127.0.0.1:3271/'; await wait(B1); const A1 = client(B1);
  let [s, j] = await A1('api/admin/setup', 'POST', { clubName: 'TC Umzug', password: 'Test-Kennwort-42', modules: { getraenke: true, zeiterfassung: true } });
  ok('alte Version eingerichtet', s === 200, JSON.stringify(j));
  [s, j] = await A1('api/admin/members', 'POST', { name: 'Beispiel, Erika', kind: 'mitglied' }); ok('Mitglied angelegt', s === 200);
  [s, j] = await A1('api/admin/articles', 'POST', { name: 'Umzugsbier 0,33', category: 'Bier', price_cents: 170 }); ok('Artikel angelegt', s === 200);
  [s] = await A1('api/admin/backups/password', 'POST', { password: 'Umzug-Passwort-2026', myPassword: 'Test-Kennwort-42' }); ok('Sicherungspasswort gesetzt', s === 200);
  [s, j] = await A1('api/admin/backups/run', 'POST', {}); ok('Komplettsicherung (alt) erstellt', s === 200, j.msg || j.error);
  [s, j] = await A1('api/admin/backups/status');
  const f = j.local && j.local[0] && j.local[0].file; ok('Datei .vhsicherung', /_Vereinsheim\.vhsicherung$/.test(f || ''), f);
  const [s2, file] = await A1('api/admin/backups/komplett/file/' + f);
  ok('heruntergeladen', s2 === 200 && file.subarray(0, 8).toString() === 'VHSICH01');
  await stop(o);
  // 2. frisches Clubwerk
  let n = start(NEW, D2, 3272); const B2 = 'http://127.0.0.1:3272/'; await wait(B2); const A2 = client(B2);
  [s, j] = await A2('api/admin/setup', 'POST', { clubName: 'Neu', password: 'neues-Pass-123', modules: { getraenke: true } }); ok('Clubwerk eingerichtet', s === 200, JSON.stringify(j));
  [s, j] = await A2('api/admin/backups/komplett/upload', 'POST', file, 'application/octet-stream'); ok('alte Sicherung hochgeladen', s === 200 && j.id, JSON.stringify(j));
  [s, j] = await A2('api/admin/backups/komplett/restore', 'POST', { source: 'upload', file: j.id, password: 'Umzug-Passwort-2026', myPassword: 'neues-Pass-123' }); ok('Wiederherstellung vorgemerkt', s === 200, j.error);
  await stop(n);
  n = start(NEW, D2, 3272); await wait(B2); const A3 = client(B2);
  [s, j] = await A3('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' }); ok('Anmeldung mit altem Passwort (Daten übernommen)', s === 200, JSON.stringify(j));
  [s, j] = await A3('api/admin/settings'); ok('Vereinsname übernommen', j.clubName === 'TC Umzug', j.clubName);
  [s, j] = await A3('api/admin/members'); ok('Mitglied übernommen', JSON.stringify(j).includes('Beispiel, Erika'));
  [s, j] = await A3('api/admin/articles'); ok('Artikel übernommen', JSON.stringify(j).includes('Umzugsbier'));
  ok('Datenbank heißt clubwerk.db', fs.existsSync(D2 + '/clubwerk.db') && !fs.existsSync(D2 + '/getraenke.db'));
  [s, j] = await A3('api/admin/backups/password/check', 'POST', { password: 'Umzug-Passwort-2026' }); ok('Sicherungspasswort übernommen', s === 200 && j.ok !== false, JSON.stringify(j));
  [s, j] = await A3('api/admin/backups/run', 'POST', {}); [s, j] = await A3('api/admin/backups/status');
  ok('neue Sicherung als .cwbackup', /_Clubwerk\.cwbackup$/.test((j.local[0] || {}).file || ''), (j.local[0] || {}).file);
  await stop(n);
  console.log(fails ? fails + ' FEHLER' : 'ALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
