// Wiedereintritt und Mitgliedsnummern: Austritt zurücknehmen (noch nicht wirksam) behält die Nummer; Wiedereintritt nach wirksamem Austritt
// bekommt eine neue Nummer, Eintritt heute und eine neue Mandatsreferenz; vergebene Nummern kommen nie wieder. Startet den Server selbst.  node wieder_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_wieder'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3294/', M = 'http://127.0.0.1:5278/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
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
const X = p => 'api/admin/x/mitglieder/' + p, SP = p => 'api/admin/x/spielbetrieb/' + p, K = p => 'api/admin/x/buchung/' + p;
const AP = p => 'api/m/buchung/' + p, W = p => 'api/admin/x/arbeitseinsatz/' + p, BH = p => 'api/admin/x/buchhaltung/' + p;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Datum relativ zu heute (lokale Zeit)
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
let srv;
async function start() {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3294', BEREGNUNG_PORT: '5275', MEMBER_PORT: '5278', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/wieder_srv.log', 'w'), fs.openSync(S + '/wieder_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
const reenter = id => A(X(`member/${id}/reenter`), 'POST', {});
const person = async id => (await A(X('member/' + id)))[1];
(async () => {
  let s, j;
  await start();
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Grün-Weiß Musterstadt', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true } });
  ok('Setup', s === 200, JSON.stringify(j));
  const mk = async (f, l) => { const r = await A(X('member'), 'POST', { first_name: f, last_name: l }); return r[1].id; };
  const a = await mk('Anna', 'Abel'), b = await mk('Bernd', 'Bauer');
  const noA = (await person(a)).person.member_no, noB = (await person(b)).person.member_no;
  ok('Nummern fortlaufend', Number(noB) === Number(noA) + 1, `${noA}, ${noB}`);

  // 1) Austritt noch nicht wirksam (zum Monatsende in der Zukunft) → zurücknehmen, Nummer bleibt
  [s, j] = await A(X(`member/${a}/exit`), 'POST', { exit_date: day(20) }); ok('Austritt in der Zukunft eingetragen', s === 200, JSON.stringify(j));
  [s, j] = await reenter(a); let p = (await person(a)).person;
  ok('Zurückgenommen: gleiche Nummer, kein Austritt', s === 200 && !j.member_no && p.member_no === noA && !p.exit_date, JSON.stringify({ j, no: p.member_no }));

  // 2) Austritt wirksam (gestern) mit SEPA-Mandat → Wiedereintritt: neue Nummer, Eintritt heute, neues Mandat nötig
  [s, j] = await A(X(`member/${b}/bank`), 'PUT', { holder: 'Bernd Bauer', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', mandate_ref: 'TEST-B-1', mandate_date: '2020-01-01', payment: 'lastschrift' });
  let before = (await person(b)).bank || {};
  ok('Mandat vorhanden', Boolean(before.mandate_ref), JSON.stringify(before).slice(0, 200));
  [s, j] = await A(X(`member/${b}/exit`), 'POST', { exit_date: day(-1), force: true }); ok('Austritt gestern', s === 200, JSON.stringify(j));
  [s, j] = await reenter(b); const d = await person(b); p = d.person;
  ok('Wiedereintritt: neue Nummer', s === 200 && j.member_no && j.member_no === p.member_no && Number(p.member_no) > Number(noB), JSON.stringify({ j, no: p.member_no }));
  ok('… Eintritt heute, kein Austritt', p.entry_date === day(0) && !p.exit_date, `${p.entry_date} / ${p.exit_date}`);
  ok('… neue Mandatsreferenz, altes Mandat gilt nicht mehr', d.bank && d.bank.mandate_ref && d.bank.mandate_ref !== before.mandate_ref && !d.bank.mandate_date, JSON.stringify(d.bank).slice(0, 200));
  ok('… alte Nummer im Verlauf', JSON.stringify(d.history || []).includes(noB), JSON.stringify(d.history || []).slice(0, 300));
  [s, j] = await A('api/admin/audit'); ok('… Protokoll', JSON.stringify(j).includes('Wiedereintritt'));

  // 3) Vergebene Nummern kommen nie wieder: höchste Nummer löschen, nächste neue Person bekommt trotzdem eine höhere
  const top = Number(p.member_no);
  const c = await mk('Carla', 'Clever'); const noC = Number((await person(c)).person.member_no);
  ok('Neue Person nach Wiedereintritt: nächste Nummer', noC === top + 1, `${top} → ${noC}`);
  const dc = await person(c); for (const f of dc.fees || []) await A(X('mf/' + f.id), 'DELETE');
  [s, j] = await A('api/admin/members/' + c, 'DELETE'); ok('Person mit höchster Nummer gelöscht', s === 200, JSON.stringify(j));
  const e = await mk('Emil', 'Eder'); const noE = Number((await person(e)).person.member_no);
  ok('Nummer der Gelöschten wird nicht neu vergeben', noE === noC + 1, `${noC} gelöscht → neu ${noE}`);
  [s, j] = await A(X('meta')); ok('Vorschlag „nächste Nummer“ reserviert nichts', String(j.nextNo) === String(noE + 1), j.nextNo);
  [s, j] = await A(X('meta')); ok('… auch beim zweiten Abruf gleich', String(j.nextNo) === String(noE + 1), j.nextNo);

  srv.kill(); console.log(fails ? fails + ' FEHLER' : 'alles ok'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
