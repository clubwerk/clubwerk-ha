// Tresor 3.29: Klartext-Suche über die Datenbankdatei (alle als vertraulich eingestuften Felder) + Nachverschlüsseln neuer Felder
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP || require('path').resolve(__dirname, '../clubwerk');
const DATA = S + '/r_vs'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3481/'; const MB = 'http://127.0.0.1:5483/';
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ck = '';
async function A(url, method = 'GET', body, raw) {
  const h = { 'X-Clubwerk': '1', Cookie: ck }; if (body !== undefined && !raw) h['Content-Type'] = 'application/json'; if (raw) Object.assign(h, raw);
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  const ct = r.headers.get('content-type') || ''; let j = {};
  if (/json/.test(ct)) { try { j = await r.json(); } catch (e) { /* */ } } else j = Buffer.from(await r.arrayBuffer());
  return [r.status, j];
}
const X = p => 'api/admin/x/mitglieder/' + p;
let srv;
const startSrv = async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_TABLET_OPEN: '1', CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3481', BEREGNUNG_PORT: '5481', MEMBER_PORT: '5483', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/enc_srv.log', 'a'), fs.openSync(S + '/enc_srv.log', 'a')] });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(200); }
};
const stopSrv = async () => { srv.kill(); await new Promise(r => srv.on('exit', r)); };
const rawDb = () => { const D = require(APP + '/node_modules/better-sqlite3'); return new D(DATA + '/clubwerk.db', { readonly: true }); };
(async () => {
  await startSrv();
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Tresor', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true, spielbetrieb: true } }); ok('Setup', s === 200, j.error);
  const feeId = (await A(X('fees'), 'POST', { name: 'Erwachsene', cents: 12000, interval: 'jahr', kind: 'grund' }))[1].id;
  const nd = (await A(X('member/new-document'), 'POST', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)), { 'Content-Type': 'application/octet-stream', 'X-Filename': 'antrag.pdf' }))[1];
  [s, j] = await A(X('member'), 'POST', { doc_id: nd.doc_id, fee_id: feeId, payment: 'rechnung', first_name: 'Anna', last_name: 'Adler', birth_date: '1985-03-04', street: 'Lindenweg 7', zip: '65599', city: 'Dornburg', email: 'anna@adler.de', mobile: '0170 1234567', notes: 'mag Doppel' }); const anna = j.id; ok('Mitglied angelegt', s === 200 && anna, j.error);
  [s, j] = await A(X(`member/${anna}`), 'PUT', { key_no: 'SCHL-4711', phone: '06436 998877' }); ok('Schlüsselnummer', s === 200, j.error);
  [s, j] = await A(X(`member/${anna}/bank`), 'PUT', { iban: 'DE89370400440532013000', holder: 'Anna Adler', bic: 'COBADEFFXXX' });
  [s, j] = await A('api/admin/x/spielbetrieb/teams', 'POST', { name: 'Herren 30', min_players: 4 }); const T = j.id; ok('Mannschaft', T, JSON.stringify(j));
  [s, j] = await A(`api/admin/x/spielbetrieb/teams/${T}/extern`, 'POST', { first_name: 'Max', last_name: 'Gast', club: 'TC Dehrn', phone: '0171 2223333' }); ok('Gast angelegt', s === 200, JSON.stringify(j));
  // vertrauliche Testwerte (Schutzklasse „Tresor“) – dürfen danach nirgends mehr im Klartext in der Datei stehen
  const SECRET = ['anna@adler.de', 'Lindenweg', '65599', '1985-03-04', '0170 1234567', 'SCHL-4711', '998877', 'DE89370400440532013000', 'COBADEFF', '2223333', 'mag Doppel'];
  const rawHas = () => { const b = Buffer.concat(['clubwerk.db', 'clubwerk.db-wal'].filter(f => fs.existsSync(DATA + '/' + f)).map(f => fs.readFileSync(DATA + '/' + f))); return SECRET.filter(x => b.includes(x) || b.includes(Buffer.from(x, 'utf16le'))); };
  ok('Vorher: Testwerte im Klartext vorhanden (Test greift)', rawHas().length >= 8, rawHas().join(','));
  [s, j] = await A('api/admin/vault/prepare', 'POST', { password: 'Test-Kennwort-42' }); const cc = j.code.replace(/-/g, '');
  [s, j] = await A('api/admin/vault/enable', 'POST', { password: 'Test-Kennwort-42', typed: j.positions.map(p => cc[p - 1]).join(''), deleteOld: true }); ok('Eingeschaltet', s === 200, j.error);
  ok('Datenbankdatei: kein vertraulicher Testwert mehr im Klartext', rawHas().length === 0, rawHas().join(','));
  [s, j] = await A(X(`member/${anna}`)); ok('Verwaltung liest Schlüsselnummer', j.person && j.person.key_no === 'SCHL-4711', JSON.stringify(j.person && j.person.key_no));
  [s, j] = await A('api/admin/x/spielbetrieb/meta');
  ok('Spielbetrieb zeigt Handynummer des Gasts', JSON.stringify(j).includes('2223333'), JSON.stringify(j).slice(0, 200));
  // Feld, das eine ältere Version noch nicht verschlüsselt hat (z. B. Schlüsselnummer vor 3.29) → beim Start nachverschlüsseln
  await stopSrv();
  { const D = require(APP + '/node_modules/better-sqlite3'); const d = new D(DATA + '/clubwerk.db'); d.prepare('UPDATE mv_person SET key_no = ? WHERE member_id = ?').run('ALT-0815', anna); d.close(); }
  ck = ''; await startSrv();
  { const d = rawDb(); const k = d.prepare('SELECT key_no FROM mv_person WHERE member_id = ?').get(anna).key_no; d.close(); ok('Start: Klartext-Rest nachverschlüsselt (auch gesperrt)', /^p1:|^e1:/.test(k), k.slice(0, 6)); }
  ok('… und nicht mehr in der Datei', !fs.readFileSync(DATA + '/clubwerk.db').includes('ALT-0815'));
  [s, j] = await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' });
  [s, j] = await A(X(`member/${anna}`)); ok('Nach Anmeldung lesbar', j.person && j.person.key_no === 'ALT-0815');
  await stopSrv(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
