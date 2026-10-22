// Name/Kategorie beim Buchen merken. Startet den Server selbst.
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_snap'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3253/';
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 220) : '')); if (!c) fails++; };
let ck = ''; async function A(url, method = 'GET', body) { const h = { 'X-Clubwerk': '1', Cookie: ck }; if (body !== undefined) h['Content-Type'] = 'application/json'; const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0]; return [r.status, await r.json().catch(() => ({}))]; }
const T = async (url, body) => { const r = await fetch(B + url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}); return [r.status, await r.json().catch(() => ({}))]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_TABLET_OPEN: '1', DATA_DIR: DATA, PORT: '3253', BEREGNUNG_PORT: '5285', MEMBER_PORT: '5286', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/snap_srv.log', 'w'), fs.openSync(S + '/snap_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true } });
  [s, j] = await A('api/admin/articles', 'POST', { name: 'Pils 0,33', category: 'Bier', price_cents: 150, track_stock: false }); const art = j.id;
  [s, j] = await A('api/admin/members', 'POST', { name: 'Max Muster', kind: 'mitglied' }); const mem = j.id;
  // am Tablet buchen (mit PIN, damit „Mein Konto“ sichtbar ist)
  [s, j] = await T('api/tablet/unlock', { memberId: mem }); let tok = j.token;
  [s, j] = await T('api/tablet/pin', { token: tok, currentPin: '', newPin: '4711' });
  [s, j] = await T('api/tablet/book', { token: tok, items: [{ articleId: art, qty: 2 }] }); ok('Gebucht', s === 200, JSON.stringify(j).slice(0, 120));
  await A('api/admin/bookings', 'POST', { memberId: mem, articleId: art, qty: 1, date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) });
  // umbenennen + andere Kategorie
  [s] = await A('api/admin/articles/' + art, 'PUT', { name: 'Pils vom Fass 0,4', category: 'Fassbier' });
  [s, j] = await A('api/admin/bookings?from=2000-01-01&to=2100-01-01');
  const rows = (j.rows || j).filter(r => r.article_id === art);
  ok('Verwaltung: Buchungen zeigen den damaligen Namen', rows.length === 2 && rows.every(r => r.article === 'Pils 0,33'), JSON.stringify(rows.map(r => r.article)));
  [s, j] = await T('api/tablet/unlock', { memberId: mem, pin: '4711' }); tok = j.token;
  [s, j] = await T('api/tablet/account?token=' + encodeURIComponent(tok));
  ok('Mein Konto zeigt den damaligen Namen', j.rows && j.rows.some(r => r.name === 'Pils 0,33') && !j.rows.some(r => r.name === 'Pils vom Fass 0,4'), JSON.stringify(j.rows && j.rows.map(r => r.name)));
  [s, j] = await T('api/tablet/book', { token: tok, items: [{ articleId: art, qty: 1 }] });
  [s, j] = await A('api/admin/bookings?from=2000-01-01&to=2100-01-01');
  const all = (j.rows || j).filter(r => r.article_id === art).map(r => r.article);
  ok('Neue Buchung unter dem neuen Namen', all.includes('Pils vom Fass 0,4') && all.filter(x => x === 'Pils 0,33').length === 2, JSON.stringify(all));
  [s, j] = await T('api/tablet/account?token=' + encodeURIComponent(tok));
  ok('Offener Betrag stimmt (über die Artikel-ID)', j.balance && j.balance.cents === 600, JSON.stringify(j.balance));
  srv.kill(); await sleep(300);
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
