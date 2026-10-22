// Artikelsymbole + Artikelbilder. Startet den Server selbst.
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_art'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3251/';
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 200) : '')); if (!c) fails++; };
let ck = ''; async function A(url, method = 'GET', body, raw) { const h = { 'X-Clubwerk': '1', Cookie: ck }; if (body !== undefined && !raw) h['Content-Type'] = 'application/json'; if (raw) h['Content-Type'] = raw; const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0]; return [r.status, await r.json().catch(() => ({}))]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_TABLET_OPEN: '1', DATA_DIR: DATA, PORT: '3251', BEREGNUNG_PORT: '5281', MEMBER_PORT: '5282', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/art_srv.log', 'w'), fs.openSync(S + '/art_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true } });
  [s, j] = await A('api/admin/articles'); ok('Vorhandene Artikel haben Symbole', j.length > 5 && j.filter(a => a.icon).length >= j.length - 1, j.map(a => a.name + ':' + a.icon).join(', '));
  [s, j] = await A('api/admin/articles', 'POST', { name: 'Bratwurst', category: 'Essen', price_cents: 300 }); const id = j.id;
  [s, j] = await A('api/admin/articles'); let a = j.find(x => x.id === id); ok('Neuer Artikel bekommt passendes Symbol', a.icon === 'bratwurst', a.icon);
  [s] = await A('api/admin/articles/' + id, 'PUT', { icon: 'brezel' }); [s, j] = await A('api/admin/articles'); a = j.find(x => x.id === id); ok('Symbol ändern', a.icon === 'brezel');
  [s] = await A('api/admin/articles/' + id, 'PUT', { icon: '<script>' }); [s, j] = await A('api/admin/articles'); a = j.find(x => x.id === id); ok('Unbekanntes Symbol → keins', a.icon === null);
  [s] = await A('api/admin/articles/' + id, 'PUT', { name: 'Bratwurst groß' }); [s, j] = await A('api/admin/articles'); a = j.find(x => x.id === id); ok('Andere Änderung lässt Symbol in Ruhe', a.icon === null && a.name === 'Bratwurst groß');
  [s, j] = await A(`api/admin/articles/${id}/image`, 'PUT', Buffer.from('<svg onload="alert(1)"></svg>'), 'image/svg+xml'); ok('SVG-Text direkt abgelehnt (nur verkleinerte Bilder)', s === 400, j.error);
  [s, j] = await A(`api/admin/articles/${id}/image`, 'PUT', Buffer.from('GIF89a....'), 'image/gif'); ok('Falsches Format abgelehnt', s === 400 && /PNG/.test(j.error), j.error);
  [s, j] = await A(`api/admin/articles/${id}/image`, 'PUT', Buffer.concat([PNG, Buffer.alloc(2.2 * 1024 * 1024)]), 'image/png'); ok('Über 2 MB abgelehnt', s === 400 || s === 413, s + ' ' + j.error);
  [s, j] = await A(`api/admin/articles/${id}/image`, 'PUT', PNG, 'image/png'); const file = j.image; ok('PNG gespeichert', s === 200 && /^a\d+-[0-9a-f]{12}\.png$/.test(file), JSON.stringify(j));
  { const r = await fetch(B + 'api/tablet/artikelbild/' + file); ok('Tablet lädt Bild', r.status === 200 && r.headers.get('content-type') === 'image/png' && r.headers.get('x-content-type-options') === 'nosniff'); }
  { const r = await fetch(B + 'api/tablet/artikelbild/..%2Fgetraenke.db'); ok('Kein Zugriff auf andere Dateien', r.status === 404); }
  [s, j] = await (async () => { const r = await fetch(B + 'api/tablet/state'); return [r.status, await r.json()]; })(); a = j.articles.find(x => x.id === id); ok('Tablet-Liste enthält Bild und Symbol', a && a.image === file && 'icon' in a);
  ok('Datei liegt im Datenordner', fs.existsSync(DATA + '/artikelbilder/' + file));
  [s] = await A(`api/admin/articles/${id}/image`, 'DELETE'); [s, j] = await A('api/admin/articles'); a = j.find(x => x.id === id); ok('Bild entfernt', a.image === null && !fs.existsSync(DATA + '/artikelbilder/' + file));
  const [s9] = await (async () => { const r = await fetch(B + `api/admin/articles/${id}/image`, { method: 'PUT', body: PNG, headers: { 'Content-Type': 'image/png' } }); return [r.status]; })(); ok('Ohne Anmeldung/Kopfzeile kein Upload', s9 === 401 || s9 === 403, s9);
  // Passwortschutz der Buchungsseite gilt auch für Bilder
  [s, j] = await A(`api/admin/articles/${id}/image`, 'PUT', PNG, 'image/png'); const f2 = j.image;
  await A('api/admin/settings/tablet-password', 'PUT', { password: 'tablet123' });
  { const r = await fetch(B + 'api/tablet/artikelbild/' + f2); ok('Bild hinter dem Passwortschutz der Buchungsseite', r.status === 401, r.status); }
  srv.kill(); await sleep(300);
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
