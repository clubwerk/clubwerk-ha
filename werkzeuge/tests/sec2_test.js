// Sicherheitsbefunde 3.13.3 (security.md): Ingress-/Tunnel-Vertrauen, Limits je Gerät/Mitglied, Foto-Freischaltung, PIN bei
// Datenänderungen, CSV-Schutz, permLabels, Fehler-Handler.  node sec2_test.js <S>
const { spawn, execFileSync } = require('child_process'); const fs = require('fs'); const http = require('http');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_sec2'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 3330, BPORT = 5330, MPORT = 5331;
const B = `http://127.0.0.1:${PORT}/`, M = `http://127.0.0.1:${MPORT}/`, BW = `http://127.0.0.1:${BPORT}/`;
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ck = '';
async function A(url, method = 'GET', body, { base = B, dev, headers = {} } = {}) {
  const h = { 'X-Clubwerk': '1', Cookie: base === B ? ck : '', ...headers }; if (dev) h['X-Geraet'] = dev;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); if (base === B && sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  const buf = Buffer.from(await r.arrayBuffer()); let j = {}; try { j = JSON.parse(buf.toString()); } catch (e) { /* */ } return [r.status, j, buf.toString()];
}
/* Roh-Anfrage mit frei wählbaren Kopfzeilen (Host, X-Ingress-Path, cf-connecting-ip) */
function RAW(port, path, method = 'GET', body, headers = {}) {
  return new Promise((resolve, reject) => {
    const h = { Host: `127.0.0.1:${port}`, 'X-Clubwerk': '1', ...headers };
    const data = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
    if (data !== null) { h['Content-Type'] = h['Content-Type'] || 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const rq = http.request({ host: '127.0.0.1', port, path: '/' + path, method, headers: h }, r => { let b = ''; r.on('data', d => { b += d; }); r.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch (e) { /* */ } resolve([r.statusCode, j, b]); }); });
    rq.on('error', reject); if (data !== null) rq.write(data); rq.end();
  });
}
const X = p => 'api/admin/x/mitglieder/' + p, K = p => 'api/admin/x/buchung/' + p;
const pad = n => String(n).padStart(2, '0');
const dayPlus = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/* Test-Erweiterung mit kaputter Mitglieder-Route (für den Fehler-Handler) – muss wie jede fremde Erweiterung freigegeben werden */
const EXT = S + '/sec2ext'; fs.rmSync(EXT, { recursive: true, force: true }); fs.mkdirSync(EXT + '/kaputt', { recursive: true });
fs.writeFileSync(EXT + '/kaputt/erweiterung.json', JSON.stringify({ id: 'kaputt', name: 'Kaputt', version: '1.0', mitgliederApp: { label: 'Kaputt', alle: true } }));
fs.writeFileSync(EXT + '/kaputt/server.js', "module.exports = { activate(ctx) { ctx.member.post('/boom', () => { throw new Error('boom'); }); ctx.member.get('/ok', (req, res) => res.json({ ok: true })); } };");

let srv; const LOG = S + '/sec2_srv.log';
const ENV = { ...process.env, CW_TEST_TABLET_OPEN: '1', CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: String(PORT), BEREGNUNG_PORT: String(BPORT), MEMBER_PORT: String(MPORT), EXT_DIR: EXT, HA_URL: 'http://127.0.0.1:9', HA_TOKEN: 'tok', CW_TEST_PUBLIC_IP: '198.51.100.20,' };
delete ENV.TRUSTED_PROXY;
async function start() {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: ENV, stdio: ['ignore', fs.openSync(LOG, 'a'), fs.openSync(LOG, 'a')] });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
async function stop() { srv.kill(); await new Promise(r => srv.on('exit', r)); await sleep(300); }

(async () => {
  fs.writeFileSync(LOG, '');
  let s, j, t;

  /* ===== 1. Unit: fromTunnel / awayReq / PRIVATE_IP (eigener Prozess mit TRUSTED_PROXY und eigenem Datenordner) ===== */
  {
    const UD = S + '/r_sec2u'; fs.rmSync(UD, { recursive: true, force: true }); fs.mkdirSync(UD, { recursive: true });
    const script = `(async () => { const m = require('${APP}/src/memberapp.js');
      const sock = ip => ({ socket: { remoteAddress: ip } });
      const out = {
        proxyEnv: m.fromTunnel('192.168.5.5'), addon: m.fromTunnel('172.30.33.7'), gw32: m.fromTunnel('172.30.32.1'), gw33: m.fromTunnel('::ffff:172.30.33.1'),
        supervisor: m.fromTunnel('172.30.32.2'), lo4: m.fromTunnel('::ffff:127.0.0.1'), lo6: m.fromTunnel('::1'),
        lan: m.fromTunnel('192.168.1.20'), ten: m.fromTunnel('10.0.0.3'), pub: m.fromTunnel('203.0.113.1'), near: m.fromTunnel('172.30.34.1'), empty: m.fromTunnel(''),
        awayPub: m.awayReq(sock('::ffff:203.0.113.9')), awayLan: m.awayReq(sock('::ffff:192.168.178.30')), awayLo: m.awayReq(sock('::1')),
        awayTunnel: m.awayReq({ viaTunnel: true, clubNet: false, ...sock('::ffff:127.0.0.1') }), awayTunnelClub: m.awayReq({ viaTunnel: true, ...sock('::ffff:172.30.33.5') }),
        priv: ['10.1.2.3', '::ffff:192.168.0.1', '172.31.255.1', '169.254.1.1', 'fd00::1', 'fe80::1', '::1', '127.0.0.1'].map(m.PRIVATE_IP), nopriv: ['172.32.0.1', '8.8.8.8', '2001:db8::1', ''].map(m.PRIVATE_IP),
      };
      // Mail-Kontingent (security.budget): 20 je Fenster, Teilmengen, Fenster läuft ab, Größe begrenzt
      const bud = require('${APP}/src/security.js').budget({ max: 20, windowMs: 300, size: 3 });
      out.b1 = bud.take('a', 3) && bud.take('a', 17) && !bud.take('a', 1) && bud.left('a') === 0 && bud.take('b', 20) && !bud.take('b');
      out.bSize = (bud.take('c'), bud.take('d'), bud.left('a') === 20);   // ältester Eintrag (a) verdrängt → wieder frei
      await new Promise(r => setTimeout(r, 350)); out.bReset = bud.take('b', 20) && !bud.take('b');
      require('fs').writeFileSync(process.env.UNIT_OUT, JSON.stringify(out)); process.exit(0); })();`;
    fs.writeFileSync(UD + '/unit.js', script);
    execFileSync('node', [UD + '/unit.js'], { env: { ...process.env, DATA_DIR: UD, TRUSTED_PROXY: '172.30.32.2,192.168.5.5', UNIT_OUT: UD + '/unit.json' }, stdio: 'ignore' });
    const u = JSON.parse(fs.readFileSync(UD + '/unit.json', 'utf8'));
    ok('fromTunnel: eingetragenes Proxy-Add-on (TRUSTED_PROXY) vertraut', u.proxyEnv === true);
    ok('fromTunnel: Add-on-Netz 172.30.33.x und Gateways 172.30.32.1/33.1 vertraut', u.addon && u.gw32 && u.gw33);
    ok('fromTunnel: Supervisor-Adresse zählt (Add-on-Netz /23) – aber nicht als Proxy-Eintrag', u.supervisor === true);
    ok('fromTunnel: Loopback vertraut (Tests)', u.lo4 && u.lo6);
    ok('fromTunnel: cf-Header von 192.168.x / 10.x / öffentlich / 172.30.34.x / leer abgelehnt', u.lan === false && u.ten === false && u.pub === false && u.near === false && u.empty === false, JSON.stringify(u));
    ok('awayReq: öffentliche Socket-Adresse = unterwegs, private/Loopback = WLAN', u.awayPub === true && u.awayLan === false && u.awayLo === false);
    ok('awayReq: über Tunnel immer unterwegs (auch aus dem Add-on-Netz)', u.awayTunnel === true && u.awayTunnelClub === true);
    ok('PRIVATE_IP: private Bereiche inkl. link-local/Loopback', u.priv.every(Boolean) && u.nopriv.every(v => !v), JSON.stringify([u.priv, u.nopriv]));
    ok('security.budget: 20 je Fenster, Teilmengen, Rest 0, getrennte Schlüssel', u.b1 === true, JSON.stringify([u.b1, u.bSize, u.bReset]));
    ok('security.budget: Größe begrenzt (ältester Eintrag fällt heraus)', u.bSize === true);
    ok('security.budget: nach Ablauf des Fensters wieder frei', u.bReset === true);
  }

  await start();
  [s, j] = await A('api/admin/status'); ok('permLabels fehlt ohne Anmeldung', s === 200 && j.permLabels === undefined && j.loggedIn === false, JSON.stringify(j).slice(0, 200));
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true, buchung: true, zugang: true, beregnung: true, arbeitseinsatz: true } }); ok('Setup', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/status'); ok('permLabels nach Anmeldung vorhanden', s === 200 && j.loggedIn && j.permLabels && j.permLabels.konten, JSON.stringify(j.permLabels || {}).slice(0, 100));

  /* ===== 2. Ingress-Vertrauen (Port 3330) ===== */
  [s, j, t] = await RAW(PORT, 'api/tablet/state', 'GET', undefined, { Host: 'evil.example.com', 'X-Ingress-Path': '/api/hassio_ingress/x' });
  ok('X-Ingress-Path von Loopback gilt nicht als Ingress: hostGuard greift bei fremdem Host (421)', s === 421, s + ' ' + t.slice(0, 80));
  [s, j, t] = await RAW(PORT, 'api/tablet/state', 'GET', undefined, { 'X-Ingress-Path': '/api/hassio_ingress/x', 'cf-connecting-ip': '203.0.113.5' });
  ok('cf-Kopfzeile auf dem Verwaltungsport → 403, auch mit X-Ingress-Path', s === 403 && /nicht erreichbar/.test(t), s + ' ' + t.slice(0, 80));
  [s, j, t] = await RAW(PORT, 'api/tablet/state', 'GET', undefined, { 'cf-ray': 'abc' }); ok('cf-ray allein → 403', s === 403);
  [s, j, t] = await RAW(PORT, 'api/gate'); ok('Normale Anfrage im WLAN kommt durch', s === 200 && j.ok === true, s + ' ' + t.slice(0, 80));

  /* ===== 3. Mitglieder anlegen, koppeln ===== */
  const doc = async () => (await fetch(B + X('member/new-document'), { method: 'POST', headers: { 'X-Clubwerk': '1', Cookie: ck, 'Content-Type': 'application/octet-stream', 'X-Filename': 'antrag.pdf' }, body: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)) }).then(r => r.json())).doc_id;
  [s, j] = await A(X('fees'), 'POST', { name: 'Testbeitrag', cents: 1000, interval: 'jahr', kind: 'grund' }); const fee = j.id; ok('Beitrag angelegt', s === 200 && fee, JSON.stringify(j));
  const mk = async (f, l) => { const [st, r] = await A(X('member'), 'POST', { doc_id: await doc(), first_name: f, last_name: l, birth_date: '1980-01-01', entry_date: '2020-01-01', street: 'Weg 1', zip: '12345', city: 'Ort', email: `${f.toLowerCase()}@test.de`, mobile: '0170 1234567', fee_id: fee, payment: 'rechnung' }); if (st !== 200) console.log('Mitglied anlegen:', st, JSON.stringify(r)); return r.id; };
  const max = await mk('Max', 'Muster'), eva = await mk('Eva', 'Beispiel'), tom = await mk('Tom', 'Dritter');
  ok('Drei Mitglieder angelegt', max && eva && tom, [max, eva, tom].join(','));
  for (const id of [max, eva, tom]) { await A(`api/admin/app/member/${id}/access`, 'PUT', { module: 'zugang', grant: true }); await A(`api/admin/app/member/${id}/access`, 'PUT', { module: 'beregnung', grant: true }); }
  const pair = async (id, pin) => { const tk = (await A(`api/admin/app/member/${id}/invite`, 'POST', {}))[1].token; const [st, r] = await A('api/pair', 'POST', { t: tk, pin }, { base: M }); if (st !== 200) console.log('pair', st, JSON.stringify(r)); return r.device; };
  const dMax = await pair(max, '2468'), dEva = await pair(eva, '1357'), dTom = await pair(tom, '9753');
  ok('Handys gekoppelt', dMax && dEva && dTom);

  /* ===== 4. Tunnel: Ablehnung wird gemerkt und in /app geliefert ===== */
  [s, j] = await A('api/ping', 'GET', undefined, { base: M, headers: { 'cf-connecting-ip': '203.0.113.7' } }); ok('cf-Kopfzeile bei ausgeschaltetem Tunnel → 403', s === 403, JSON.stringify(j));
  [s, j] = await A('api/admin/app'); ok('lastReject in /app geliefert (Grund „aus“, IP, Zeit, Host)', j.tunnel && j.tunnel.lastReject && j.tunnel.lastReject.ip === '127.0.0.1' && j.tunnel.lastReject.why === 'aus' && Date.now() - Date.parse(j.tunnel.lastReject.at) < 60000 && /127\.0\.0\.1/.test(j.tunnel.lastReject.host), JSON.stringify(j.tunnel));
  ok('/app liefert eingetragene Proxy-Adressen (hier keine)', Array.isArray(j.tunnel.proxyIps) && j.tunnel.proxyIps.length === 0, JSON.stringify(j.tunnel.proxyIps));
  [s, j] = await A('api/admin/settings/app', 'PUT', { tunnelUrl: 'https://app.tc-test.org' }); [s, j] = await A('api/admin/settings/app', 'PUT', { tunnel: true }); ok('Tunnel an', s === 200, JSON.stringify(j));
  [s, j] = await A('api/ping', 'GET', undefined, { base: M, headers: { 'cf-connecting-ip': '203.0.113.7', Host: 'app.tc-test.org' } }); ok('cf-Kopfzeile von vertrauter Quelle (Loopback) angenommen', s === 200 && j.tunnel === true && j.wlan === false, JSON.stringify(j));
  [s, j] = await A('api/ping', 'GET', undefined, { base: M, headers: { 'cf-connecting-ip': '198.51.100.20', Host: 'app.tc-test.org' } }); ok('… über Tunnel nie als WLAN', s === 200 && j.wlan === false, JSON.stringify(j));
  [s, j] = await A('api/me', 'GET', undefined, { base: M, dev: dMax, headers: { 'cf-connecting-ip': '203.0.113.7', Host: 'app.tc-test.org' } });
  ok('Unterwegs: Türen/Beregnung nur im WLAN, Buchen ja', (j.sections || []).find(x => x.id === 'zugang').wlanOnly === true && (j.sections || []).find(x => x.id === 'buchung').ok === true, JSON.stringify(j.sections));
  [s, j] = await A('api/admin/app'); ok('Erfolgreiche Anfragen überschreiben lastReject nicht', j.tunnel.lastReject && j.tunnel.lastReject.why === 'aus');

  /* ===== 5. Schreib-Limit je Gerät: 60/min, 61. POST → 429 ===== */
  { let last = 0, first429 = 0, codes = {};
    for (let i = 1; i <= 61; i++) { [s] = await A('api/m/buchung/nix', 'POST', { x: i }, { base: M, dev: dMax }); codes[s] = (codes[s] || 0) + 1; if (s === 429 && !first429) first429 = i; last = s; }
    ok('Schreib-Limit je Gerät: 60 POSTs durch (404 Unbekannte Adresse), der 61. → 429', codes[404] === 60 && first429 === 61 && last === 429, JSON.stringify(codes));
    [s, j] = await A('api/m/buchung/me', 'GET', undefined, { base: M, dev: dMax }); ok('GET-Anfragen desselben Geräts nicht gebremst', s === 200, s + ' ' + JSON.stringify(j).slice(0, 80));
    [s] = await A('api/m/buchung/nix', 'POST', { x: 1 }, { base: M, dev: dEva }); ok('Anderes Gerät (gleiche Adresse) nicht betroffen', s === 404, String(s));
  }

  /* ===== 6. Tür-Route 12/min ===== */
  { const codes = {}; let first429 = 0;
    for (let i = 1; i <= 13; i++) { [s, j] = await A('api/m/zugang/door', 'POST', { door: 'gibtsnicht', action: 'auf', pin: '1357' }, { base: M, dev: dEva }); codes[s] = (codes[s] || 0) + 1; if (s === 429 && !first429) first429 = i; }
    ok('/door: 12 Aufrufe je Minute, der 13. → 429', codes[404] === 12 && first429 === 13, JSON.stringify(codes));
  }

  /* ===== 7. Beregnung in der App 10/min ===== */
  { const codes = {};
    for (let i = 1; i <= 11; i++) { [s, j] = await A('api/m/beregnung/run', 'POST', { platz: 99 }, { base: M, dev: dTom }); codes[s] = (codes[s] || 0) + 1; }
    ok('/beregnung/run: 10 je Minute, der 11. → 429', codes[429] === 1 && !codes[200] && Object.values(codes).reduce((a, b) => a + b, 0) === 11, JSON.stringify(codes));
    const c2 = {}; for (let i = 1; i <= 11; i++) { [s, j] = await A('api/m/beregnung/stop', 'POST', { platz: 99 }, { base: M, dev: dTom }); c2[s] = (c2[s] || 0) + 1; }
    ok('/beregnung/stop: eigener Zähler, 11. → 429', c2[429] === 1, JSON.stringify(c2));
  }

  /* ===== 8. Foto nur mit Freischaltung für den Bereich ===== */
  { const jpg = 'data:image/jpeg;base64,' + fs.readFileSync(S + '/ph.jpg').toString('base64');
    [s, j] = await A('api/photo', 'PUT', { data: jpg, use: ['buchung', 'helfer'] }, { base: M, dev: dTom }); ok('Tom lädt Bild hoch (Buchung + Helfer)', s === 200 && j.has, JSON.stringify(j));
    let r = await fetch(M + `api/photo/of/${tom}?u=buchung`, { headers: { 'X-Geraet': dEva } }); ok('Eva (Buchen für alle) sieht es', r.status === 200);
    await A(`api/admin/app/member/${eva}/access`, 'PUT', { module: 'buchung', grant: false });
    r = await fetch(M + `api/photo/of/${tom}?u=buchung`, { headers: { 'X-Geraet': dEva } }); ok('Eva für Buchen gesperrt → Bild 404', r.status === 404);
    r = await fetch(M + `api/photo/of/${tom}?u=helfer`, { headers: { 'X-Geraet': dEva } }); ok('… Helferdienste weiterhin (freigeschaltet) 200', r.status === 200);
    await A(`api/admin/app/member/${eva}/access`, 'PUT', { module: 'buchung', grant: true });
    r = await fetch(M + `api/photo/of/${tom}?u=buchung`, { headers: { 'X-Geraet': dEva } }); ok('… wieder freigeschaltet → 200', r.status === 200);
    await A('api/admin/extensions/arbeitseinsatz', 'PUT', { active: false });
    r = await fetch(M + `api/photo/of/${tom}?u=helfer`, { headers: { 'X-Geraet': dEva } }); ok('Modul Arbeitseinsatz aus → Helfer-Bild 404', r.status === 404);
    await A('api/admin/extensions/arbeitseinsatz', 'PUT', { active: true });
    r = await fetch(M + `api/photo/of/${tom}?u=verkauf`, { headers: { 'X-Geraet': dEva } }); ok('Unbekannter Zweck → 404', r.status === 404);
  }

  /* ===== 9. Meine Daten: E-Mail/Einwilligungen nur mit PIN ===== */
  [s, j] = await A('api/m/mitglieder/change', 'POST', { street: 'Neue Gasse 9' }, { base: M, dev: dEva }); ok('Anschrift ohne PIN weiterhin erlaubt', s === 200 && j.pending === true, s + ' ' + JSON.stringify(j));
  [s, j] = await A('api/m/mitglieder/change', 'POST', { email: 'eva.neu@test.de' }, { base: M, dev: dEva }); ok('E-Mail ohne PIN → 401 mit pin:true', s === 401 && j.pin === true, s + ' ' + JSON.stringify(j));
  [s, j] = await A('api/m/mitglieder/change', 'POST', { email: 'eva.neu@test.de', pin: '0000' }, { base: M, dev: dEva }); ok('E-Mail mit falscher PIN → 401', s === 401 && j.pin === true, s + ' ' + JSON.stringify(j));
  [s, j] = await A('api/m/mitglieder/change', 'POST', { email: 'eva.neu@test.de', pin: '1357' }, { base: M, dev: dEva }); ok('E-Mail mit PIN → gemeldet', s === 200 && j.pending === true, s + ' ' + JSON.stringify(j));
  [s, j] = await A('api/m/mitglieder/change', 'POST', { email: 'eva@test.de' }, { base: M, dev: dEva }); ok('Unveränderte E-Mail (wie hinterlegt) braucht keine PIN → „nichts geändert“', s === 400 && /nichts geändert/.test(j.error), s + ' ' + JSON.stringify(j));
  [s, j] = await A('api/m/mitglieder/me', 'GET', undefined, { base: M, dev: dEva }); const vol = (j.consents || []).find(c => !c.required);
  if (vol) {
    [s, j] = await A('api/m/mitglieder/change', 'POST', { consents: { [vol.key]: !vol.given } }, { base: M, dev: dEva }); ok('Einwilligung ohne PIN → 401 mit pin:true', s === 401 && j.pin === true, s + ' ' + JSON.stringify(j));
    [s, j] = await A('api/m/mitglieder/change', 'POST', { consents: { [vol.key]: !vol.given }, pin: '1357' }, { base: M, dev: dEva }); ok('Einwilligung mit PIN gespeichert', s === 200, s + ' ' + JSON.stringify(j));
  } else ok('(keine freiwillige Einwilligung konfiguriert – Test übersprungen)', true);

  /* ===== 10. Buchung: Limit je Mitglied 10/min, CSV-Schutz ===== */
  [s, j] = await A(K('meta')); const p1 = j.resources[0].id; ok('Platz vorhanden', Boolean(p1));
  { const codes = {}; const d = dayPlus(1);
    for (let i = 1; i <= 11; i++) { [s, j] = await A('api/m/buchung/wait', 'POST', { remove: true, id: 999999 }, { base: M, dev: dTom }); codes[s] = (codes[s] || 0) + 1; }
    ok('Buchen/Stornieren/Warteliste je Mitglied: 10 je Minute, der 11. → 429', codes[200] === 10 && codes[429] === 1, JSON.stringify(codes));
    [s, j] = await A('api/m/buchung/book', 'POST', { resource_id: p1, date: d, start: '10:00', minutes: 60 }, { base: M, dev: dTom }); ok('… zählt auch für /book (gleicher Schlüssel) → 429', s === 429, s + ' ' + JSON.stringify(j));
    [s, j] = await A('api/m/buchung/book', 'POST', { resource_id: p1, date: d, start: '11:00', minutes: 60 }, { base: M, dev: dEva }); ok('Anderes Mitglied darf buchen', s === 200, s + ' ' + JSON.stringify(j));
  }
  [s, j] = await A(K('bookings'), 'POST', { resource_id: p1, date: dayPlus(2), start: '18:00', end: '19:00', member_id: max, guests: ['=HYPERLINK("http://boese.example";"Klick")', 'Normal Gast'] }); ok('Buchung mit formelartigem Gastnamen', s === 200, JSON.stringify(j));
  for (const [i, g] of [['+49 Gast', '19:00'], ['@Gast', '20:00'], ['-Gast', '21:00']].entries()) { [s, j] = await A(K('bookings'), 'POST', { resource_id: p1, date: dayPlus(2), start: g[1], end: `${Number(g[1].slice(0, 2)) + 1}:00`, member_id: max, guests: [g[0]] }); if (s !== 200) console.log('Buchung', i, s, JSON.stringify(j)); }
  { const r = await fetch(B + K('log.csv?year=' + dayPlus(2).slice(0, 4)), { headers: { 'X-Clubwerk': '1', Cookie: ck } }); const csv = await r.text();
    ok('CSV-Export liefert', r.status === 200 && /text\/csv/.test(r.headers.get('content-type')));
    ok('CSV: führendes = + @ - mit Apostroph entschärft', /"'=HYPERLINK\(""http:\/\/boese\.example"";""Klick""\)/.test(csv) && /"'\+49 Gast/.test(csv) && /"'@Gast/.test(csv) && /"'-Gast/.test(csv), csv.split('\n').find(l => /HYPERLINK/.test(l)));
    ok('CSV: normale Zellen unverändert', /Normal Gast/.test(csv) && !/'Normal Gast/.test(csv) && !/"'\d\d\.\d\d\./.test(csv));
  }

  /* ===== 11. Fehler-Handler (Mitglieder-App und Beregnung): 400 bei kaputtem JSON, 413 bei zu groß ===== */
  [s, j, t] = await RAW(MPORT, 'api/pair', 'POST', '{"t": kaputt', {}); ok('Mitglieder-App: ungültiges JSON → 400', s === 400 && j.error === 'Ungültige Anfrage.', s + ' ' + t.slice(0, 80));
  [s, j, t] = await RAW(MPORT, 'api/pair', 'POST', JSON.stringify({ t: 'x'.repeat(20000) }), {}); ok('Mitglieder-App: Body über 10 kB → 413', s === 413 && /zu groß/.test(j.error), s + ' ' + t.slice(0, 80));
  [s, j, t] = await RAW(BPORT, 'api/verify-pin', 'POST', '{"pin": kaputt', {}); ok('Beregnung: ungültiges JSON → 400', s === 400 && j.error === 'Ungültige Anfrage.', s + ' ' + t.slice(0, 80));
  [s, j, t] = await RAW(BPORT, 'api/verify-pin', 'POST', JSON.stringify({ pin: 'x'.repeat(200000) }), {}); ok('Beregnung: zu großer Body → 413', s === 413, s + ' ' + t.slice(0, 80));
  // kaputte Erweiterung freigeben (Hash + Passwort), Neustart, aktivieren → interner Fehler → 500 mit Protokolleintrag
  [s, j] = await A('api/admin/extensions'); const kp = (j.all || []).find(x => x.id === 'kaputt'); ok('Test-Erweiterung gefunden (nicht freigegeben)', kp && kp.unapproved && kp.hash, JSON.stringify(kp || j).slice(0, 200));
  [s, j] = await A('api/admin/extensions/kaputt/approve', 'POST', { password: 'Test-Kennwort-42', hash: kp.hash }); ok('Freigabe', s === 200, JSON.stringify(j));
  await stop(); await start();
  ck = ''; [s, j] = await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' }); ok('Neu angemeldet', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/extensions/kaputt', 'PUT', { active: true }); ok('Test-Erweiterung aktiv', s === 200, JSON.stringify(j));
  [s, j] = await A('api/m/kaputt/ok', 'GET', undefined, { base: M, dev: dMax }); ok('Route der Test-Erweiterung erreichbar', s === 200 && j.ok, s + ' ' + JSON.stringify(j));
  [s, j, t] = await A('api/m/kaputt/boom', 'POST', {}, { base: M, dev: dMax }); ok('Interner Fehler → 500 { error: "Interner Fehler." } ohne Details', s === 500 && j.error === 'Interner Fehler.' && !/boom/.test(t), s + ' ' + t.slice(0, 120));
  await sleep(200); ok('… und im Protokoll gemeldet', /Mitglieder-App:.*boom/s.test(fs.readFileSync(LOG, 'utf8')));
  // nach dem Neustart: lastReject ist weg (nur Speicher), Limits zurückgesetzt
  [s, j] = await A('api/admin/app'); ok('lastReject nur im Speicher (nach Neustart leer)', j.tunnel.lastReject === null, JSON.stringify(j.tunnel));

  await stop(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
