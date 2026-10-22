// Spielbetrieb: Hinweise beim Zuordnen (keine Sperre) – zu jung für die Altersklasse im Saisonjahr („Herren 40“ im Sommer: wer im Saisonjahr 40 wird),
// Männer bei den Damen. Jugend gemischt: kein Hinweis. Daten (Jahrgang, Geschlecht) aus der Mitgliederverwaltung.  node spalt_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_spalt'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3297/', M = 'http://127.0.0.1:5302/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
let ck = '';
// Neue Mitglieder brauchen vollständige Daten und eine Beitrittserklärung (wie in bkm_test.js); der dabei nötige Beitrag wird wieder entfernt
let __fee = null;
async function fillMember(b) {
  if (!__fee) __fee = (await A(X('fees'), 'POST', { name: 'Anlagebeitrag', cents: 1000, interval: 'jahr', kind: 'grund' }))[1].id;
  const __doc = await fetch(B + X('member/new-document'), { method: 'POST', headers: { 'X-Clubwerk': '1', Cookie: ck, 'Content-Type': 'application/octet-stream', 'X-Filename': 'antrag.pdf' }, body: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)) }).then(r => r.json()).catch(() => ({}));
  const full = { doc_id: __doc.doc_id, birth_date: '1980-01-01', entry_date: '2020-01-01', street: 'Weg 1', zip: '12345', city: 'Musterstadt', email: `x${Math.random().toString(36).slice(2, 8)}@test.de`, mobile: '0170 1234567', fee_id: __fee, payment: 'rechnung', ...b, __filled: true };
  const r = await A(X('member'), 'POST', full);
  if (r[0] === 200 && r[1].id) { const [, d] = await A(X('member/' + r[1].id)); for (const f of (d && d.fees) || []) if (f.fee_id === __fee) await A(X('mf/' + f.id), 'DELETE'); }
  return r;
}
/* A(url, method, body, { cookie }) – cookie: Sitzung eines anderen Benutzers (die Admin-Sitzung bleibt unberührt) */
async function A(url, method = 'GET', body, { cookie, base = B, dev } = {}) {
  if (method === 'POST' && /x\/mitglieder\/member$/.test(url) && body && typeof body === 'object' && !body.__filled) return fillMember(body);
  if (body && body.__filled) { body = { ...body }; delete body.__filled; }
  const h = { 'X-Clubwerk': '1', Cookie: base !== B ? '' : cookie !== undefined ? cookie : ck }; if (dev) h['X-Geraet'] = dev; if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); let got = '';
  if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) { got = sc.split(';')[0]; if (cookie === undefined) ck = got; }
  let j = {}; try { j = JSON.parse(await r.text()); } catch (e) { /* */ } return [r.status, j, got];
}
const X = p => 'api/admin/x/mitglieder/' + p, SP = p => 'api/admin/x/spielbetrieb/' + p;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let srv;
(async () => {
  let s, j;
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3297', BEREGNUNG_PORT: '5301', MEMBER_PORT: '5302', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/spalt_srv.log', 'w'), fs.openSync(S + '/spalt_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Grün-Weiß Musterstadt', password: 'Test-Kennwort-42', modules: { mitglieder: true, spielbetrieb: true } });
  ok('Setup', s === 200, JSON.stringify(j));
  const Y = new Date().getFullYear() + 1;   // Saisonjahr: nächster Sommer
  const mk = async (f, l, birth, gender) => (await A(X('member'), 'POST', { first_name: f, last_name: l, birth_date: birth, gender }))[1].id;
  // wird im Saisonjahr genau 40 (Geburtstag am 31.12.) → passt; wird 39 → Hinweis
  const old = await mk('Max', 'Muster', `${Y - 40}-12-31`, 'm'), young = await mk('Jonas', 'Jung', `${Y - 39}-01-01`, 'm'), eva = await mk('Eva', 'Muster', `${Y - 45}-05-05`, 'w');
  ok('Mitglieder angelegt', old && young && eva, JSON.stringify([old, young, eva]));
  [s, j] = await A(SP('teams'), 'POST', { name: 'Herren 40', min_players: 2, season: `Sommer ${Y}` }); const h40 = j.id;
  [s, j] = await A(SP('teams'), 'POST', { name: 'Damen 40', min_players: 2, season: `Sommer ${Y}`, age_class: 'H40' }); const d40 = j.id;
  [s, j] = await A(SP('teams'), 'POST', { name: 'Junioren U15', min_players: 2 }); const u15 = j.id;
  ok('Mannschaften angelegt', h40 && d40 && u15, JSON.stringify(j));
  [s, j] = await A(SP(`teams/${h40}/players`), 'PUT', { players: [old, young, eva].map((id, i) => ({ id, rank: i + 1 })) }); ok('Zu junger Spieler lässt sich trotzdem zuordnen (nur Hinweis)', s === 200, JSON.stringify(j));
  [s, j] = await A(SP(`teams/${d40}/players`), 'PUT', { players: [eva, old].map((id, i) => ({ id, rank: i + 1 })) }); ok('Mann bei den Damen lässt sich zuordnen (nur Hinweis)', s === 200, JSON.stringify(j));
  [s, j] = await A(SP(`teams/${u15}/players`), 'PUT', { players: [eva, young].map((id, i) => ({ id, rank: i + 1 })) }); ok('Jugend gemischt', s === 200);
  [s, j] = await A(SP('meta'));
  const T = id => j.teams.find(t => t.id === id), P = (t, id) => t.players.find(p => p.id === id) || {};
  const th = T(h40), td = T(d40), tu = T(u15);
  ok('Herren 40: Mindestalter 40 im Saisonjahr', th.need.age === 40 && th.need.year === Y && !th.need.women, JSON.stringify(th.need));
  ok('Damen 40 (Termine der H40): Damen, Mindestalter 40', td.need.women && td.need.age === 40 && td.need.cls === 'D40', JSON.stringify(td.need));
  ok('Jugend: kein Alter, kein Geschlecht', !tu.need.age && !tu.need.women, JSON.stringify(tu.need));
  ok('Jahrgang und Geschlecht der Spieler', P(th, old).y === Y - 40 && P(th, young).y === Y - 39 && P(td, eva).g === 'w' && P(td, old).g === 'm', JSON.stringify(th.players));
  ok('Mitgliederliste mit Jahrgang', (j.members.find(m => m.id === young) || {}).y === Y - 39, JSON.stringify(j.members.slice(0, 2)));
  [s, j] = await A(SP(`teams/${h40}`), 'PUT', { season: `Winter ${Y - 1}/${String(Y).slice(2)}` }); [s, j] = await A(SP('meta'));
  ok('Winter: zweites Jahr zählt („2026/27“ → 2027)', T(h40).need.year === Y, JSON.stringify(T(h40).need));
  // gleiche Regel im Browser (fitHint in admin.js)
  { const src = fs.readFileSync(APP + '/erweiterungen/spielbetrieb/public/admin.js', 'utf8'), body = src.match(/function fitHint\(t, p\) \{[\s\S]*?\n  \}/)[0];
    const fitHint = new Function('st', `${body}; return fitHint;`)({ meta: { mitglieder: true } });
    const th2 = T(h40), td2 = T(d40), tu2 = T(u15);
    ok('Hinweis: zu jung', /erst 39 \(H40\)/.test(fitHint(th2, P(th2, young))), fitHint(th2, P(th2, young)));
    ok('Kein Hinweis: wird im Saisonjahr 40 (Geburtstag egal)', fitHint(th2, P(th2, old)) === '', fitHint(th2, P(th2, old)));
    ok('Hinweis: männlich bei den Damen', /männlich/.test(fitHint(td2, P(td2, old))) && fitHint(td2, P(td2, eva)) === '', fitHint(td2, P(td2, old)));
    ok('Frau bei den Herren: kein Hinweis', fitHint(th2, P(th2, eva)) === '');
    ok('Jugend: kein Hinweis', fitHint(tu2, P(tu2, eva)) === '' && fitHint(tu2, P(tu2, young)) === '');
    ok('Ohne Mitgliederverwaltung: kein Hinweis', new Function('st', `${body}; return fitHint;`)({ meta: { mitglieder: false } })(th2, P(th2, young)) === ''); }
})().catch(e => { console.log('ABBRUCH ' + (e && e.stack || e)); fails++; }).finally(() => { if (srv) srv.kill(); console.log(fails ? `${fails} Fehler` : 'alles ok'); process.exit(fails ? 1 : 0); });
