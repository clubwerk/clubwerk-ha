// Buchungssystem: Ende-zu-Ende (Verwaltung, Mitglieder-App, Tablet, Regeln, Angriffe).  node bk_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_ph'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3296/', M = 'http://127.0.0.1:5297/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
let ck = '';
// Neue Mitglieder brauchen seit 3.9 vollständige Daten – Testwerte ergänzen und danach wieder auf den Stand der Testdaten zurücksetzen
let __fee = null;
async function fillMember(b, opts) {
  if (!__fee) { const [, m] = await A('api/admin/x/mitglieder/meta', 'GET', undefined, opts); const f = ((m && m.fees) || []).find(x => x.active && x.kind !== 'zusatz' && x.age_min == null && x.age_max == null);
    __fee = f ? f.id : (await A('api/admin/x/mitglieder/fees', 'POST', { name: 'Testbeitrag', cents: 1000, interval: 'jahr', kind: 'grund' }, opts))[1].id; }
  // seit 3.10: unterschriebene Beitrittserklärung gehört dazu
  const __doc = await fetch(B + 'api/admin/x/mitglieder/member/new-document', { method: 'POST', headers: { 'X-Clubwerk': '1', Cookie: (opts && opts.cookie) || ck, 'Content-Type': 'application/octet-stream', 'X-Filename': 'antrag.pdf' }, body: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)) }).then(r => r.json()).catch(() => ({}));
  const full = { doc_id: __doc.doc_id, ...(b.iban ? { holder: `${b.first_name || 'Test'} ${b.last_name || 'Test'}` } : {}), last_name: 'Test', birth_date: '1980-01-01', street: 'Weg 1', zip: '12345', city: 'Ort', email: `${String(b.first_name || 'x').toLowerCase().replace(/[^a-z]/g, '') || 'x'}${Math.random().toString(36).slice(2, 6)}@test.de`, mobile: '0170 1234567', fee_id: __fee, payment: b.iban ? 'lastschrift' : 'rechnung', ...b, __filled: true };
  const r = await A('api/admin/x/mitglieder/member', 'POST', full, opts);
  if (r[0] === 200 && r[1].id && !r[1].pending) {
    const id = r[1].id, back = {};
    if (b.payment === undefined && !b.iban) back.payment = 'lastschrift';
    if (b.birth_date === undefined) back.birth_date = null;
    for (const k of ['street', 'zip', 'city', 'mobile']) if (b[k] === undefined) back[k] = null;
    if (Object.keys(back).length) await A(`api/admin/x/mitglieder/member/${id}`, 'PUT', back, opts);
    if (b.fee_id === undefined) { const [, d] = await A(`api/admin/x/mitglieder/member/${id}`, 'GET', undefined, opts); for (const f of (d && d.fees) || []) if (f.fee_id === __fee) await A(`api/admin/x/mitglieder/mf/${f.id}`, 'DELETE', undefined, opts); }
  }
  return r;
}
async function A(url, method = 'GET', body, { base = B, dev, headers = {} } = {}) {
  if (method === 'POST' && /x\/mitglieder\/member$/.test(url) && body && typeof body === 'object' && !body.__filled) return fillMember(body, arguments[3]);
  if (body && body.__filled) { body = { ...body }; delete body.__filled; }
  const h = { 'X-Clubwerk': '1', Cookie: base === B ? ck : '', ...headers }; if (dev) h['X-Geraet'] = dev;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); if (base === B && sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  const buf = Buffer.from(await r.arrayBuffer()); let j = {}; try { j = JSON.parse(buf.toString()); } catch (e) { /* */ } return [r.status, j, r];
}
const X = p => 'api/admin/x/mitglieder/' + p, K = p => 'api/admin/x/buchung/' + p, AP = p => 'api/m/buchung/' + p, TB = p => 'api/tablet/x/buchung/' + p;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mailFiles = () => fs.readdirSync(MAILDIR).filter(f => /^mail\d+\.json$/.test(f));
mailFiles().forEach(f => fs.unlinkSync(MAILDIR + '/' + f)); const seen = new Set();
const newMails = () => { const n = mailFiles().filter(f => !seen.has(f)); n.forEach(f => seen.add(f)); return n.map(f => JSON.parse(fs.readFileSync(MAILDIR + '/' + f))); };
let srv;
const pad = n => String(n).padStart(2, '0');
const dayPlus = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
(async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_TABLET_OPEN: '1', CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3296', BEREGNUNG_PORT: '5296', MEMBER_PORT: '5297', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/ph_srv.log', 'w'), fs.openSync(S + '/ph_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true, buchung: true, arbeitseinsatz: true } }); ok('Setup', s === 200, JSON.stringify(j));
  const mk = async (f, l) => (await A(X('member'), 'POST', { first_name: f, last_name: l, birth_date: '1980-01-01', entry_date: '2020-01-01', email: f.toLowerCase() + '@test.de' }))[1].id;
  const max = await mk('Max', 'Muster'), eva = await mk('Eva', 'Beispiel');
  const pair = async (id, pin) => { const t = (await A(`api/admin/app/member/${id}/invite`, 'POST', {}))[1].token; return (await A('api/pair', 'POST', { t, pin }, { base: M }))[1].device; };
  const dMax = await pair(max, '2468'), dEva = await pair(eva, '1357');
  const jpg = 'data:image/jpeg;base64,' + fs.readFileSync(S + '/ph.jpg').toString('base64');
  [s, j] = await A('api/photo', 'GET', undefined, { base: M, dev: dMax }); ok('Profilbild-Info', s === 200 && !j.has && j.uses.some(u => u.k === 'verkauf') && j.uses.some(u => u.k === 'buchung'), JSON.stringify(j));
  [s, j] = await A('api/photo', 'PUT', { data: 'data:image/png;base64,iVBORw0KGgo=' }, { base: M, dev: dMax }); ok('Kein JPEG abgelehnt', s === 400);
  [s, j] = await A('api/photo', 'PUT', { data: jpg, use: ['buchung', 'boese'] }, { base: M, dev: dMax }); ok('Hochgeladen', s === 200 && j.has && j.use.join() === 'buchung', JSON.stringify(j));
  let r = await fetch(M + 'api/photo/img', { headers: { 'X-Geraet': dMax } }); ok('Eigenes Bild', r.status === 200 && r.headers.get('content-type') === 'image/jpeg');
  r = await fetch(M + `api/photo/of/${max}?u=buchung`, { headers: { 'X-Geraet': dEva } }); ok('Andere sehen es bei der Buchung', r.status === 200);
  r = await fetch(M + `api/photo/of/${max}?u=helfer`, { headers: { 'X-Geraet': dEva } }); ok('… nicht bei Helferdiensten (nicht freigegeben)', r.status === 404);
  r = await fetch(M + `api/photo/of/${max}?u=buchung`); ok('Ohne gekoppeltes Handy nicht', r.status === 403);
  r = await fetch(B + `api/tablet/photo/${max}?u=verkauf`); ok('Tablet Verkauf: nicht freigegeben', r.status === 404);
  r = await fetch(B + `api/tablet/photo/${max}?u=buchung`); ok('Tablet Buchung: freigegeben', r.status === 200);
  [s, j] = await A('api/tablet/state'); { const m = (j.members || []).find(x => x.id === max); ok('Verkaufs-Tablet ohne Bild (nicht freigegeben)', m && !m.ph); }
  [s, j] = await A('api/photo', 'PUT', { use: ['buchung', 'verkauf'] }, { base: M, dev: dMax }); ok('Freigabe geändert', j.use.length === 2);
  [s, j] = await A('api/tablet/state'); { const m = (j.members || []).find(x => x.id === max); ok('Verkaufs-Tablet mit Bild', m && m.ph); }
  r = await fetch(B + `api/admin/photo/${max}`, { headers: { 'X-Clubwerk': '1', Cookie: ck } }); ok('Verwaltung sieht Bild', r.status === 200);
  r = await fetch(B + `api/admin/photo/${max}`); ok('Ohne Anmeldung nicht', r.status === 401);
  [s, j] = await A(X(`member/${max}`)); ok('Bild beim Mitglied', j.person && j.person.photo, JSON.stringify(j.person && j.person.photo));
  [s, j] = await A(`api/admin/photo/${max}`, 'DELETE'); ok('Verwaltung entfernt Bild', s === 200);
  [s, j] = await A('api/photo', 'GET', undefined, { base: M, dev: dMax }); ok('Weg', !j.has);
  ok('Keine Datei mehr', fs.readdirSync(DATA + '/fotos').length === 0);
  srv.kill(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
