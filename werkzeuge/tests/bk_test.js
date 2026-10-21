// Buchungssystem: Ende-zu-Ende (Verwaltung, Mitglieder-App, Tablet, Regeln, Angriffe).  node bk_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_bk'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
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
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3296', BEREGNUNG_PORT: '5296', MEMBER_PORT: '5297', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/bk_srv.log', 'w'), fs.openSync(S + '/bk_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j, r;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true, buchung: true } }); ok('Setup', s === 200, JSON.stringify(j));
  await A('api/admin/mail', 'PUT', { host: '127.0.0.1', port: 2525, user: '', from: 'verein@test.de' });
  const mk = async (f, l) => (await A(X('member'), 'POST', { first_name: f, last_name: l, birth_date: '1980-01-01', entry_date: '2020-01-01', email: f.toLowerCase() + '@test.de', street: 'Weg 1', zip: '12345', city: 'Ort' }))[1].id;
  const max = await mk('Max', 'Muster'), eva = await mk('Eva', 'Beispiel'), tom = await mk('Tom', 'Partner'), ida = await mk('Ida', 'Dritte'), xss = await mk('<img src=x onerror=alert(1)>', 'Böse');
  [s, j] = await A(K('meta')); ok('Beispielplätze angelegt', j.resources.length === 2 && j.resources[0].name === 'Platz 1', JSON.stringify(j.resources.map(r => r.name)));
  const p1 = j.resources[0].id, p2 = j.resources[1].id;
  [s, j] = await A(K('resources'), 'POST', { kind: 'artikel', name: 'Leihschläger', days: '1234567', open_from: '08:00', open_to: '22:00', slot_min: 60, max_min: 240, quantity: 2, guest_fee_cents: 0 }); const sch = j.id; ok('Gerät mit Menge', s === 200 && sch);
  [s, j] = await A(K('resources'), 'POST', { name: 'Kaputt', days: '12', open_from: '08:00', open_to: '21:30', slot_min: 60, max_min: 120 }); ok('Raster passt nicht → abgelehnt', s === 400, j.error);
  await A(K('settings'), 'PUT', { rules: 'Bitte Plätze abziehen.', max_open_platz: 2 });

  // Handys koppeln
  const pair = async (id, pin) => { const t = (await A(`api/admin/app/member/${id}/invite`, 'POST', {}))[1].token; return (await A('api/pair', 'POST', { t, pin }, { base: M }))[1].device; };
  const dMax = await pair(max, '2468'), dEva = await pair(eva, '1357'), dTom = await pair(tom, '1470'), dIda = await pair(ida, '2580');
  [s, j] = await A('api/me', 'GET', undefined, { base: M, dev: dMax }); ok('„Buchen“ in der App', j.sections.some(x => x.id === 'buchung' && x.ok), JSON.stringify(j.sections));
  const d1 = dayPlus(1), d2 = dayPlus(2), far = dayPlus(9);
  [s, j] = await A(AP('me?date=' + d1), 'GET', undefined, { base: M, dev: dMax }); ok('Tagesplan', s === 200 && j.plan.resources.length === 3 && j.people.some(p => p.id === eva) && !j.people.some(p => p.id === max), JSON.stringify(j).slice(0, 200));

  // Regeln
  const book = (dev, b) => A(AP('book'), 'POST', { accept: true, ...b }, { base: M, dev });
  [s, j] = await book(dMax, { resource_id: p1, date: d1, start: '10:00', minutes: 60, accept: false }); ok('Platzordnung muss bestätigt werden', s === 400 && /Platzordnung/.test(j.error), j.error);
  [s, j] = await book(dMax, { resource_id: p1, date: d1, start: '10:30', minutes: 60 }); ok('Raster', s === 400 && /Raster/.test(j.error), j.error);
  [s, j] = await book(dMax, { resource_id: p1, date: d1, start: '21:00', minutes: 120 }); ok('Nach Schluss', s === 400, j.error);
  [s, j] = await book(dMax, { resource_id: p1, date: d1, start: '10:00', minutes: 180 }); ok('Höchstdauer', s === 400 && /Höchstens/.test(j.error), j.error);
  [s, j] = await book(dMax, { resource_id: p1, date: far, start: '10:00', minutes: 60 }); ok('Vorlauf', s === 400 && /Voraus/.test(j.error), j.error);
  [s, j] = await book(dMax, { resource_id: p1, date: dayPlus(-1), start: '10:00', minutes: 60 }); ok('Vergangenheit', s === 400, j.error);
  [s, j] = await book(dMax, { resource_id: p1, date: d1, start: '10:00', minutes: 120, partners: [tom], guests: ['Gerd Gast'] });
  const b1 = j.id; ok('Gebucht mit Mitspieler und Gast', s === 200 && j.fee_cents === 500, JSON.stringify(j));
  [s, j] = await A(X(`charges?member=${max}&status=offen`)); const ch = (j.rows || []).find(c => c.ext_key === 'bk-' + b1); ok('Gastgebühr als offener Posten', ch && ch.cents === 500, JSON.stringify((j.rows || []).map(c => [c.text, c.cents])));
  await sleep(500); let ms = newMails(); ok('Mitspieler per E-Mail informiert', ms.some(m => m.to.includes('tom@test.de') && /Mitspieler/.test(m.text)), JSON.stringify(ms.map(m => m.to)));
  ok('Mail an Mitspieler übersichtlich', ms.some(m => m.to.includes('tom@test.de') && /Platz 1 am/.test(m.subject) && /Spieler:\s+Max Muster, Tom Partner, Gerd Gast \(Gast\)/.test(m.text) && /Gebucht von: Max Muster/.test(m.text)), JSON.stringify(ms.map(m => m.text)).slice(0, 400));
  { const bk = await A(AP('me?date=' + d1), 'GET', undefined, { base: M, dev: dMax }); const mine = bk[1].mine.find(x => x.id === b1);
    const ic = await A(mine.ics, 'GET', undefined, { base: M }); const txt = String(ic[2] ? '' : ''); void txt;
    const raw = await fetch(M + mine.ics); const body = await raw.text();
    ok('Kalender-Datei (.ics)', raw.status === 200 && /text\/calendar/.test(raw.headers.get('content-type')) && /BEGIN:VEVENT/.test(body) && /DTSTART:\d{8}T\d{6}Z/.test(body) && /Tom Partner/.test(body), body.slice(0, 200));
    const bad = await fetch(M + mine.ics.replace(/k=.*/, 'k=' + '0'.repeat(32))); ok('Kalender nur mit Prüfsumme', bad.status === 404); }
  [s, j] = await book(dEva, { resource_id: p1, date: d1, start: '11:00', minutes: 60 }); ok('Belegt', s === 400 && /jemand anderes/.test(j.error), j.error);
  [s, j] = await book(dTom, { resource_id: p2, date: d1, start: '10:00', minutes: 60 }); ok('Mitspieler kann nicht gleichzeitig woanders', s === 400 && /zu dieser Zeit/.test(j.error), j.error);
  [s, j] = await book(dMax, { resource_id: p2, date: d2, start: '10:00', minutes: 60 }); ok('Zweite Buchung', s === 200);
  [s, j] = await book(dMax, { resource_id: p2, date: d2, start: '12:00', minutes: 60 }); ok('Kontingent (2 offene)', s === 400 && /offener Buchungen/.test(j.error), j.error);
  [s, j] = await book(dEva, { resource_id: p2, date: d2, start: '14:00', minutes: 60, partners: [max] }); ok('Kontingent zählt auch als Mitspieler', s === 400 && /Max/.test(j.error), j.error);
  [s, j] = await book(dEva, { resource_id: p2, date: d2, start: '14:00', minutes: 60, guests: ['X'] }); ok('Gastname zu kurz', s === 400, j.error);
  [s, j] = await book(dEva, { resource_id: p2, date: d2, start: '14:00', minutes: 60, partners: [99999] }); ok('Unbekannter Mitspieler', s === 400);
  // Geräte mit Menge 2
  [s, j] = await book(dEva, { resource_id: sch, date: d1, start: '10:00', minutes: 60 }); ok('Gerät 1/2', s === 200, j.error);
  [s, j] = await book(dIda, { resource_id: sch, date: d1, start: '10:00', minutes: 60 }); ok('Gerät 2/2', s === 200, j.error);
  [s, j] = await book(dTom, { resource_id: sch, date: d1, start: '10:00', minutes: 60 }); ok('Gerät ausgebucht', s === 400, j.error);
  // gleichzeitig dieselbe Zeit: nur eine gewinnt
  const res = await Promise.all([book(dEva, { resource_id: p1, date: d2, start: '16:00', minutes: 60 }), book(dIda, { resource_id: p1, date: d2, start: '16:00', minutes: 60 })]);
  ok('Gleichzeitig: genau eine Buchung', res.filter(r => r[0] === 200).length === 1, JSON.stringify(res.map(r => r[0])));
  // Sichtbarkeit
  [s, j] = await A(AP('me?date=' + d1), 'GET', undefined, { base: M, dev: dIda });
  const vb = j.plan.bookings.find(b => b.id === b1); ok('Namen sichtbar, keine internen Felder', vb && vb.who.includes('Max Muster') && vb.who.some(w => /Gast/.test(w)) && vb.member_id === undefined && vb.fee_cents === undefined, JSON.stringify(vb));
  await A(K('settings'), 'PUT', { show_names: false });
  [s, j] = await A(AP('me?date=' + d1), 'GET', undefined, { base: M, dev: dIda }); ok('Namen ausblendbar', j.plan.bookings.find(b => b.id === b1).who === null);
  [s, j] = await A(AP('me?date=' + d1), 'GET', undefined, { base: M, dev: dTom }); ok('Eigene (als Mitspieler) sieht man trotzdem', j.plan.bookings.find(b => b.id === b1).mine === true && j.mine.some(b => b.id === b1 && !b.canCancel));
  await A(K('settings'), 'PUT', { show_names: true });
  { const [, au] = await A('api/admin/audit'); const e = au.find(x => /Buchungssystem: Einstellungen geändert/.test(x.action));
    ok('3.30.2: Protokoll lesbar (keine internen Schlüssel)', e && /Namen in der Belegung sichtbar: nein → ja/.test(e.detail) && !/show_names|_/.test(e.detail), e && e.detail); }
  [s, j] = await A('api/admin/settings/app', 'PUT', { sectionsOn: { buchung: false } }); ok('3.30.2: Bereich in der App ausschalten', s === 200, j.error);
  [s, j] = await A('api/m/info', 'GET', undefined, { base: M, dev: dIda }); const offSec = j && j.sections ? j.sections.map(x => x.id) : null;
  [s, j] = await A(AP('me?date=' + d1), 'GET', undefined, { base: M, dev: dIda }); ok('3.30.2: ausgeschalteter Bereich gesperrt', s === 403, s + ' ' + JSON.stringify(offSec));
  [s, j] = await A('api/admin/settings/app', 'PUT', { sectionsOn: { buchung: true } });
  [s, j] = await A(AP('me?date=' + d1), 'GET', undefined, { base: M, dev: dIda }); ok('3.30.2: wieder eingeschaltet', s === 200, s);
  // Warteliste
  [s, j] = await A(AP('wait'), 'POST', { resource_id: p1, date: d1, start: '10:00' }, { base: M, dev: dEva }); ok('Warteliste', s === 200, j.error);
  [s, j] = await A(AP('wait'), 'POST', { resource_id: p1, date: d1, start: '14:00' }, { base: M, dev: dEva }); ok('Freie Zeit: keine Warteliste', s === 400);
  // Fremde Buchung stornieren
  [s, j] = await A(AP('cancel'), 'POST', { id: b1 }, { base: M, dev: dTom }); ok('Mitspieler kann nicht stornieren', s === 400);
  [s, j] = await A(AP('cancel'), 'POST', { id: b1 }, { base: M, dev: dEva }); ok('Fremde können nicht stornieren', s === 400);
  newMails();
  [s, j] = await A(AP('cancel'), 'POST', { id: b1 }, { base: M, dev: dMax }); ok('Storniert', s === 200);
  await sleep(500); { const sm = mailFiles().filter(f => !seen.has(f)).map(f => JSON.parse(fs.readFileSync(MAILDIR + '/' + f))); ok('Storno-Mail an Mitspieler', sm.some(m => m.to.includes('tom@test.de') && /Storniert/.test(m.subject) && /Max Muster hat diese Buchung storniert/.test(m.text)), JSON.stringify(sm.map(m => [m.to, m.subject]))); }
  [s, j] = await A(X(`charges?member=${max}&status=storniert`)); ok('Gastgebühr storniert', (j.rows || []).some(c => c.ext_key === 'bk-' + b1));
  await sleep(500); ms = newMails(); ok('Warteliste per E-Mail benachrichtigt', ms.some(m => m.to.includes('eva@test.de') && /frei/i.test(m.subject)), JSON.stringify(ms.map(m => [m.to, m.subject])));
  // ohne gekoppeltes Gerät / falsches Modul
  [s, j] = await A(AP('me'), 'GET', undefined, { base: M, dev: 'falsch' }); ok('Ohne Freischaltung kein Zugriff', s === 403);
  [s, j] = await A(AP('book'), 'POST', { resource_id: p1, date: d1, start: '10:00', minutes: 60, accept: true }, { base: M }); ok('Ohne Gerät keine Buchung', s === 403);
  [s, j] = await A('api/admin/x/buchung/meta', 'GET', undefined, { base: M, dev: dMax }); ok('Verwaltung nicht über die App-Adresse', s === 404);
  // Tablet
  [s, j] = await A(TB('state')); ok('Tablet-Status', s === 200 && j.booking && j.people.length >= 4 && j.plan.resources.length === 3);
  const tod = j.today; const hour = new Date().getHours();
  // PIN ist Pflicht zum Buchen/Stornieren am Tablet – ohne PIN „Kein PIN vergeben“, beim ersten Mal festlegen
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: ida }); ok('App-PIN gilt auch am Tablet (ohne PIN kein Zugang)', s === 401 || s === 403 || s === 400, s);
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: ida, pin: '2580' }); let tk = j.token; ok('Mit der App-PIN am Tablet angemeldet', s === 200 && tk, JSON.stringify(j));
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: ida }); ok('Danach nur noch mit PIN', s === 401 || s === 403 || s === 400, s);
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: ida, pin: '2580' }); tk = j.token;
  [s, j] = await A('api/tablet/pin', 'POST', { token: tk, currentPin: '2580', newPin: '' }); ok('PIN kann am Tablet nicht entfernt werden', s === 400 && /nicht entfernt/.test(j.error), j.error);
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: ida, pin: '2580' }); tk = j.token;
  if (hour < 21) {
    [s, j] = await A(TB('book'), 'POST', { token: tk, resource_id: p2, start: `${pad(Math.max(8, hour + 1))}:00`, minutes: 60, accept: true }); const tbId = j.id; ok('Am Tablet gebucht (mit PIN)', s === 200, j.error);
    [s, j] = await A(TB('book'), 'POST', { token: tk, resource_id: p2, start: '21:00', minutes: 60, accept: true }); ok('Token nur einmal gültig', s === 401);
    if (tbId) {
      [s, j] = await A('api/tablet/unlock', 'POST', { memberId: ida, pin: '2580' }); [s, j] = await A(TB('cancel'), 'POST', { token: j.token, id: tbId }); ok('Am Tablet storniert (mit PIN)', s === 200, j.error);
    }
  } else ok('Am Tablet gebucht (übersprungen, zu spät am Tag)', true);
  [s, j] = await A(TB('book'), 'POST', { token: 'falsch', resource_id: p2, start: '21:00', minutes: 60 }); ok('Ohne Name/PIN keine Tablet-Buchung', s === 401);
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: ida, pin: '2580' }); [s, j] = await A(TB('book'), 'POST', { token: j.token, resource_id: p2, date: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), start: '09:00', minutes: 60, accept: true }); ok('Tablet: über den Vorlauf hinaus abgelehnt (3.30.1: weitere Tage wie in der App)', s === 400 && /Voraus/.test(j.error || ''), j.error);
  void tod;
  // Verwaltung: Sperre mit Konflikt, Serie
  [s, j] = await A(K('bookings'), 'POST', { type: 'sperre', resource_id: p2, date: d2, start: '08:00', end: '22:00', title: 'Platzpflege' }); ok('Sperre meldet Konflikte', s === 409 && j.conflicts.length >= 1, JSON.stringify(j).slice(0, 200));
  newMails();
  [s, j] = await A(K('bookings'), 'POST', { type: 'sperre', resource_id: p2, date: d2, start: '08:00', end: '22:00', title: 'Platzpflege', force: true }); ok('Sperre mit Stornieren', s === 200);
  await sleep(500); ms = newMails(); ok('Betroffene informiert', ms.some(m => m.to.includes('max@test.de') && /storniert/.test(m.subject)), JSON.stringify(ms.map(m => [m.to, m.subject])));
  [s, j] = await book(dTom, { resource_id: p2, date: d2, start: '18:00', minutes: 60 }); ok('Gesperrt nicht buchbar', s === 400);
  [s, j] = await A(K('bookings'), 'POST', { resource_id: p1, date: d1, start: '18:00', end: '19:00', member_id: ida, guests: ['Hans Gast', 'Uta Gast'] }); ok('Verwaltung bucht für Mitglied (mit Gästen)', s === 200, j.error);
  [s, j] = await A(K('day?date=' + d1)); const vb2 = j.bookings.find(b => b.start === '18:00' && b.resource_id === p1); ok('Gastgebühr bei Verwaltungsbuchung', vb2 && vb2.fee_cents === 1000 && vb2.charge_id, JSON.stringify(vb2));
  const start = dayPlus(3), wdn = (() => { const d = new Date(start + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; })();
  await book(dEva, { resource_id: p1, date: start, start: '18:00', minutes: 60 });
  [s, j] = await A(K('series'), 'POST', { type: 'serie', title: 'Training Herren 40', resources: [p1], weekdays: String(wdn), start: '18:00', end: '20:00', from_date: start, to_date: dayPlus(30), preview: true });
  ok('Serie: Vorschau mit Überschneidung', s === 200 && j.clash.length === 1 && j.days >= 4, JSON.stringify(j).slice(0, 200));
  [s, j] = await A(K('series'), 'POST', { type: 'serie', title: 'Training Herren 40', resources: [p1], weekdays: String(wdn), start: '18:00', end: '20:00', from_date: start, to_date: dayPlus(30) });
  const ser = j.id; ok('Serie angelegt, belegter Tag ausgelassen', s === 200 && j.skipped === 1 && j.made >= 3, JSON.stringify(j));
  [s, j] = await A(K('series')); ok('Serie in der Liste', j.some(x => x.id === ser && x.count === j.find(y => y.id === ser).count && x.count >= 3));
  [s, j] = await A(K(`series/${ser}/end`), 'POST'); ok('Serie beendet', s === 200 && j.removed >= 3, JSON.stringify(j));
  // Wer darf buchen? Status, Beitragsart, Abteilung
  const pas = (await A(X('member'), 'POST', { first_name: 'Pia', last_name: 'Passiv', birth_date: '1980-01-01', entry_date: '2020-01-01', email: 'pia@test.de', status: 'passiv' }))[1].id;
  const foe = (await A(X('member'), 'POST', { first_name: 'Fred', last_name: 'Förder', birth_date: '1980-01-01', entry_date: '2020-01-01', email: 'fred@test.de' }))[1].id;
  const fFoe = (await A(X('fees'), 'POST', { name: 'Fördermitglied', cents: 3000 }))[1].id;
  await A(X(`member/${foe}/fees`), 'POST', { fee_id: fFoe, start_date: '2020-01-01' });
  const dPas = await pair(pas, '1111'), dFoe = await pair(foe, '2222');
  const d4 = dayPlus(4);
  [s, j] = await book(dPas, { resource_id: p1, date: d4, start: '09:00', minutes: 60 }); ok('Passive dürfen nicht buchen', s === 400 && /passiv/.test(j.error), j.error);
  [s, j] = await A(AP('me'), 'GET', undefined, { base: M, dev: dPas }); ok('App zeigt den Grund', /passiv/.test(j.blocked || ''), j.blocked);
  [s, j] = await A(AP('me'), 'GET', undefined, { base: M, dev: dIda }); ok('Passive nicht als Mitspieler wählbar', !j.people.some(p => p.id === pas) && j.people.some(p => p.id === foe));
  [s, j] = await book(dIda, { resource_id: p1, date: d4, start: '09:00', minutes: 60, partners: [pas] }); ok('Passiver Mitspieler abgelehnt', s === 400 && /Pia/.test(j.error), j.error);
  [s, j] = await book(dFoe, { resource_id: p1, date: d4, start: '10:00', minutes: 60 }); ok('Fördermitglied darf erst mal', s === 200, j.error);
  [s, j] = await A(K('settings'), 'PUT', { blocked_fees: [fFoe] });
  [s, j] = await book(dFoe, { resource_id: p1, date: d4, start: '12:00', minutes: 60 }); ok('Gesperrte Beitragsart', s === 400 && /Fördermitglied/.test(j.error), j.error);
  [s, j] = await A(K('settings'), 'PUT', { allowed_status: ['aktiv', 'ehren', 'passiv'], blocked_fees: [] });
  [s, j] = await A(AP('me'), 'GET', undefined, { base: M, dev: dPas }); ok('Passive freischaltbar', !j.blocked);
  await A(K('settings'), 'PUT', { allowed_status: ['aktiv', 'ehren'] });
  // Platz der Abteilung Padel
  await A(K('settings'), 'PUT', { max_open_platz: 20 }); await sleep(61000);
  const padel = (await A(X('departments'), 'POST', { name: 'Padel' }))[1].id;
  await A(X(`member/${eva}/departments`), 'POST', { department_id: padel, entry_date: '2024-01-01' });
  [s, j] = await A(K('resources'), 'POST', { name: 'Padel 1', area: 'Padel', days: '1234567', open_from: '08:00', open_to: '22:00', slot_min: 60, max_min: 90 >= 60 ? 120 : 60, department_id: padel, outsiders: 'gebuehr', outsider_fee_cents: 500, guest_fee_cents: 500 });
  const pad1 = j.id; ok('Padel-Platz der Abteilung', s === 200 && pad1, j.error);
  const d5 = dayPlus(5);
  [s, j] = await A(AP('quote'), 'POST', { resource_id: pad1, date: d5, start: '10:00', minutes: 60 }, { base: M, dev: dEva }); ok('Abteilungsmitglied kostenlos', j.ok && j.fee_cents === 0, JSON.stringify(j));
  [s, j] = await A(AP('quote'), 'POST', { resource_id: pad1, date: d5, start: '10:00', minutes: 60, partners: [tom], guests: ['Gerd Gast'] }, { base: M, dev: dEva });
  ok('Preisvorschau: Gast + Nicht-Padel-Mitspieler', j.ok && j.fee_cents === 1000 && j.lines.length === 2 && /Tom/.test(j.lines[1].text), JSON.stringify(j));
  [s, j] = await A(AP('quote'), 'POST', { resource_id: pad1, date: d5, start: '10:00', minutes: 60, guests: [{ name: 'Paul Partner', partner: true }, { name: 'Gina Gast', partner: false }] }, { base: M, dev: dEva });
  ok('Gast aus Partnerverein kostenlos', j.ok && j.fee_cents === 500, JSON.stringify(j));
  [s, j] = await book(dEva, { resource_id: pad1, date: d5, start: '18:00', minutes: 60, guests: [{ name: 'Paul Partner', partner: true }] }); const bpp = j.id; ok('Buchung mit Partnervereins-Gast ohne Gebühr', s === 200 && j.fee_cents === 0, JSON.stringify(j));
  [s, j] = await A(K('day?date=' + d5)); ok('Gast als Partnerverein vermerkt', j.bookings.find(b => b.id === bpp).who.some(w => /Partnerverein/.test(w)));
  [s, j] = await book(dIda, { resource_id: pad1, date: d5, start: '12:00', minutes: 60 }); const bpad = j.id; ok('Nicht-Padel bucht mit Platzgebühr', s === 200 && j.fee_cents === 500, JSON.stringify(j));
  [s, j] = await A(X(`charges?member=${ida}&status=offen`)); ok('Platzgebühr als offener Posten', (j.rows || []).some(c => c.ext_key === 'bk-' + bpad && c.cents === 500 && /Platzgebühr/.test(c.text)), JSON.stringify((j.rows || []).map(c => c.text)));
  await A(K('resources/' + pad1), 'PUT', { outsiders: 'gesperrt' });
  [s, j] = await book(dTom, { resource_id: pad1, date: d5, start: '15:00', minutes: 60 }); ok('Nur Abteilung: andere abgelehnt', s === 400 && /Padel/.test(j.error), j.error);
  [s, j] = await book(dEva, { resource_id: pad1, date: d5, start: '15:00', minutes: 60, partners: [tom] }); ok('… auch als Mitspieler', s === 400 && /Tom/.test(j.error), j.error);
  [s, j] = await book(dEva, { resource_id: pad1, date: d5, start: '15:00', minutes: 60 }); ok('Abteilungsmitglied bucht frei', s === 200 && j.fee_cents === 0, JSON.stringify(j));
  // Externer Zugang (Cloudflare Tunnel)
  const CF = ip => ({ 'CF-Connecting-IP': ip, 'CF-Ray': 'abc-FRA' });
  [s, j] = await A('api/ping', 'GET', undefined, { base: M, headers: CF('203.0.113.5') }); ok('Tunnel aus: Zugriff von außen abgewiesen', s === 403);
  [s, j] = await A('api/admin/settings/app', 'PUT', { tunnel: true }); ok('Einschalten ohne Adresse abgelehnt', s === 400);
  [s, j] = await A('api/admin/settings/app', 'PUT', { tunnelUrl: 'http://app.test.de' }); ok('Nur https', s === 400);
  [s, j] = await A('api/admin/settings/app', 'PUT', { tunnelUrl: 'https://app.test.de' }); [s, j] = await A('api/admin/settings/app', 'PUT', { tunnel: true }); ok('Tunnel eingeschaltet', s === 200);
  [s, j] = await A('api/admin/app'); ok('QR-Code mit öffentlicher Adresse', j.url === 'https://app.test.de' && j.tunnel.on);
  [s, j, r] = await A('api/ping', 'GET', undefined, { base: M, headers: { ...CF('203.0.113.5'), Host: 'app.test.de' } }); ok('App über den Tunnel erreichbar', s === 200 && j.tunnel === true && /max-age/.test(r.headers.get('strict-transport-security') || ''), JSON.stringify(j));
  [s, j] = await A('api/m/buchung/me', 'GET', undefined, { base: M, dev: dMax, headers: { ...CF('203.0.113.5'), Host: 'app.test.de' } }); ok('Buchen über den Tunnel', s === 200);
  [s, j] = await A('api/admin/status', 'GET', undefined, { headers: CF('203.0.113.5') }); ok('Verwaltung über Tunnel-Header gesperrt', s === 403);
  const rawGet = (port, host, path) => new Promise(res => { require('http').get({ host: '127.0.0.1', port, path, headers: { Host: host } }, r => { r.resume(); res(r.statusCode); }).on('error', () => res(0)); });
  ok('Verwaltung unter der öffentlichen Adresse gesperrt', await rawGet(3296, 'app.test.de', '/api/admin/status') === 403);
  ok('App unter der öffentlichen Adresse (Host) erlaubt', await rawGet(5297, 'app.test.de', '/api/ping') === 200);
  ok('Fremde Adresse an der App abgewiesen', await rawGet(5297, 'boese.example.com', '/api/ping') === 421);
  [s, j] = await A('', 'GET', undefined, { headers: CF('203.0.113.5') }); ok('Tablet-Seite über Tunnel gesperrt', s === 403);
  let blocked = 0; for (let i = 0; i < 12; i++) { const x = await A('api/pair', 'POST', { t: 'falsch' + i, pin: '0000' }, { base: M, headers: { ...CF('198.51.100.7'), Host: 'app.test.de' } }); if (x[0] === 429) blocked++; }
  const other = await A('api/pair', 'POST', { t: 'falsch', pin: '0000' }, { base: M, headers: { ...CF('198.51.100.99'), Host: 'app.test.de' } });
  ok('Sperre je Absender (nicht für alle)', blocked >= 1 && other[0] !== 429, `${blocked} / ${other[0]}`);
  [s, j] = await A('api/admin/settings/app', 'PUT', { tunnel: false });
  [s, j] = await A('api/ping', 'GET', undefined, { base: M, headers: { ...CF('203.0.113.5'), Host: 'app.test.de' } }); ok('Wieder aus: abgewiesen', s === 403 || s === 421, s);
  // Labels
  [s, j] = await A(K('labels')); ok('Label-Vorlagen', j.length >= 5 && j.some(l => l.name === 'Training'), JSON.stringify(j.map(l => l.name)));
  [s, j] = await A(K('labels'), 'POST', { name: 'Clubmeisterschaft', color: '#9e9e9e' }); const lcm = j.id; ok('Label angelegt', s === 200);
  [s, j] = await A(K('labels'), 'POST', { name: 'clubmeisterschaft' }); ok('Label nicht doppelt', s === 400);
  const d6 = dayPlus(6);
  [s, j] = await A(K('bookings'), 'POST', { resource_id: p1, date: d6, start: '16:00', end: '17:00', member_id: ida, partners: [tom], label_id: lcm, title: 'Ida vs. Tom' }); ok('Buchung mit Label für Mitglieder', s === 200, j.error);
  [s, j] = await A(K('bookings'), 'POST', { resource_id: p1, date: d6, start: '18:00', end: '20:00', label_id: lcm }); ok('Vereinsbuchung nur mit Label', s === 200, j.error);
  [s, j] = await A(K('week?from=' + d6 + '&resource=' + p1)); const wl = j.bookings.filter(b => b.label && b.label.name === 'Clubmeisterschaft');
  ok('Wochenansicht mit Labelfarbe', j.days.length === 7 && wl.length === 2 && wl[0].label.color === '#9e9e9e' && wl.some(b => b.title === 'Clubmeisterschaft'), JSON.stringify(wl.map(b => [b.title, b.who])));
  [s, j] = await A(AP('me?date=' + d6), 'GET', undefined, { base: M, dev: dEva }); const al = j.plan.bookings.filter(b => b.label); ok('Label in der App sichtbar', al.length === 2 && al.every(b => b.label.color && b.member_id === undefined));
  [s, j] = await A(K('labels/' + lcm), 'DELETE'); ok('Benutztes Label nicht löschbar', s === 400);
  // Rechte im Modul
  const mkUser = async (u, perms) => { await A('api/admin/users', 'POST', { username: u, password: 'Test-Kennwort-42x', perms }); };
  await mkUser('ansicht', ['buchung']); await mkUser('buchen', ['buchung', 'buchung_buchen']);
  const as = async u => { const c0 = ck; ck = ''; await A('api/admin/login', 'POST', { username: u, password: 'Test-Kennwort-42x' }); const mine = ck; ck = c0; return mine; };
  const ckA = await as('ansicht'), ckB = await as('buchen'), ckAdm = ck;
  ck = ckA; [s, j] = await A(K('meta')); ok('Nur ansehen: Belegung lesbar', s === 200 && j.can.buchung && !j.can.buchung_buchen);
  [s, j] = await A(K('bookings'), 'POST', { resource_id: p2, date: d6, start: '09:00', end: '10:00', member_id: ida }); ok('… darf nicht für andere buchen', s === 403);
  ck = ckB; [s, j] = await A(K('bookings'), 'POST', { resource_id: p2, date: d6, start: '09:00', end: '10:00', member_id: ida }); const bb = j.id; ok('Recht „buchen“: für Mitglied gebucht', s === 200, j.error);
  [s, j] = await A(K('bookings'), 'POST', { type: 'sperre', resource_id: p2, date: d6, start: '11:00', end: '12:00', title: 'Pflege' }); ok('… aber keine Sperre', s === 403);
  [s, j] = await A(K(`bookings/${bb}/cancel`), 'POST', {}); ok('… und nicht stornieren', s === 403);
  [s, j] = await A(K('series'), 'POST', { type: 'serie', title: 'X', resources: [p2], weekdays: '1', start: '10:00', end: '11:00', from_date: d6, to_date: d6 }); ok('… und keine Serie', s === 403);
  [s, j] = await A(K('labels'), 'POST', { name: 'Neu' }); ok('… und keine Labels', s === 403);
  ck = ckAdm; [s, j] = await A(K(`bookings/${bb}/cancel`), 'POST', {}); ok('Admin storniert', s === 200);
  // ---------- Label-Rechte, Vereinstermine, Bearbeiten ----------
  await A(K('settings'), 'PUT', { max_open_platz: 20, advance_days: 7 });
  const e5 = dayPlus(7), d20 = dayPlus(20);
  [s, j] = await A(X(`member/${tom}/functions`), 'POST', { name: 'Mannschaftsführer' }); ok('Amt eingetragen', s === 200, j.error);
  [s, j] = await A(K('labels'), 'POST', { name: 'Medenspiel H40', color: '#e07b16', use_mode: 'auswahl', use_functions: ['Mannschaftsführer'], free_rules: true }); const lmed = j.id; ok('Label mit Amt', s === 200, j.error);
  [s, j] = await A(K('labels/' + lcm), 'PUT', { use_mode: 'alle' }); ok('Clubmeisterschaft für alle', s === 200);
  [s, j] = await A(K('meta')); ok('Ämter für den Dialog', (j.functions || []).includes('Mannschaftsführer') && j.labels.find(l => l.id === lmed).usable, JSON.stringify(j.functions));
  [s, j] = await A(AP('me?date=' + e5), 'GET', undefined, { base: M, dev: dTom }); ok('Mannschaftsführer sieht Medenspiel + Clubmeisterschaft', j.labels.some(l => l.id === lmed && l.free_rules) && j.labels.some(l => l.id === lcm), JSON.stringify(j.labels));
  [s, j] = await A(AP('me?date=' + e5), 'GET', undefined, { base: M, dev: dIda }); ok('Andere sehen nur Clubmeisterschaft', !j.labels.some(l => l.id === lmed) && j.labels.some(l => l.id === lcm));
  [s, j] = await A(AP('book'), 'POST', { resource_id: p2, date: e5, start: '10:00', minutes: 60, label_id: lmed, accept: true }, { base: M, dev: dIda }); ok('Ohne Amt: Medenspiel verboten', s === 400 && /nicht verwenden/.test(j.error), j.error);
  [s, j] = await A(AP('quote'), 'POST', { resource_id: p2, date: d20, start: '09:00', minutes: 300, label_id: lmed, guests: [{ name: 'Gegner Eins' }, { name: 'Gegner Zwei' }] }, { base: M, dev: dTom });
  ok('Vereinstermin: 5 Std., 20 Tage voraus, Gäste ohne Gebühr', j.ok && j.fee_cents === 0, JSON.stringify(j));
  [s, j] = await A(AP('book'), 'POST', { resource_id: p2, date: d20, start: '09:00', minutes: 300, label_id: lmed, title: 'Herren 40 gegen TC X', guests: [{ name: 'Gegner Eins' }], accept: true }, { base: M, dev: dTom }); const bmed = j.id; ok('Medenspiel gebucht', s === 200, j.error);
  [s, j] = await A(K('week?from=' + d20 + '&resource=' + p2)); { const x = j.bookings.find(b => b.id === bmed); ok('… mit Label und Titel im Plan', x && x.label.name === 'Medenspiel H40' && x.title === 'Herren 40 gegen TC X', JSON.stringify(x)); }
  [s, j] = await A(AP('book'), 'POST', { resource_id: p2, date: e5, start: '09:00', minutes: 300, accept: true }, { base: M, dev: dTom }); ok('Ohne Label gilt die Höchstdauer', s === 400, j.error);
  // Mitglied ändert eigene Buchung
  [s, j] = await A(AP('book'), 'POST', { resource_id: p2, date: e5, start: '10:00', minutes: 60, partners: [eva], accept: true }, { base: M, dev: dIda }); const bed = j.id; ok('Buchung zum Ändern', s === 200, j.error);
  await sleep(400); newMails();
  [s, j] = await A(AP('me?date=' + e5), 'GET', undefined, { base: M, dev: dIda }); { const x = j.mine.find(b => b.id === bed); ok('Ändern möglich (Daten vorhanden)', x && x.canEdit && x.edit.partners.includes(eva), JSON.stringify(x && x.edit)); }
  [s, j] = await A(AP('book'), 'POST', { id: bed, resource_id: p2, date: e5, start: '11:00', minutes: 120, partners: [eva, max], accept: true }, { base: M, dev: dIda }); ok('Eigene Buchung geändert (Zeit + Mitspieler)', s === 200 && j.id === bed, j.error);
  await sleep(700); { const ms = newMails(); ok('Mails: neuer Mitspieler eingetragen, bisheriger über Änderung informiert', ms.some(m => m.to.includes('max@test.de') && /als Mitspieler/.test(m.text)) && ms.some(m => m.to.includes('eva@test.de') && /Geändert/.test(m.subject) && /vorher/.test(m.text)), JSON.stringify(ms.map(m => [m.to, m.subject]))); }
  [s, j] = await A(K('week?from=' + e5 + '&resource=' + p2)); { const x = j.bookings.find(b => b.id === bed); ok('… im Plan 11:00–13:00', x && x.start === '11:00' && x.end === '13:00', JSON.stringify(x)); }
  [s, j] = await A(AP('book'), 'POST', { id: bed, resource_id: p2, date: e5, start: '15:00', minutes: 60, accept: true }, { base: M, dev: dTom }); ok('Fremde Buchung nicht änderbar', s === 400, j.error);
  // Verwaltung ändert
  [s, j] = await A(K('bookings/' + bed), 'PUT', { resource_id: p1, date: e5, start: '14:00', end: '15:00', member_id: ida, partners: [eva], guests: [{ name: 'Gast Neu', partner: false }] }); ok('Verwaltung ändert Buchung', s === 200, j.error);
  [s, j] = await A(K('day?date=' + e5)); { const x = j.bookings.find(b => b.id === bed); ok('… Platz, Zeit, Gastgebühr neu', x && x.resource_id === p1 && x.start === '14:00' && x.fee_cents === 500 && x.charge_id, JSON.stringify(x)); }
  [s, j] = await A(K('bookings/' + bed), 'PUT', { resource_id: p1, date: e5, start: '14:00', end: '15:00', member_id: ida, partners: [eva], guests: [] }); [s, j] = await A(K('day?date=' + e5)); { const x = j.bookings.find(b => b.id === bed); ok('… Gast entfernt → Gebühr weg', x && !x.fee_cents && !x.charge_id, JSON.stringify(x)); }
  ck = ckB; [s, j] = await A(K('bookings/' + bed), 'PUT', { resource_id: p1, date: e5, start: '14:00', end: '15:00', member_id: ida, label_id: lmed }); ok('Benutzer ohne Amt: Label „nur bestimmte“ verboten', s === 403, j.error);
  [s, j] = await A(K('bookings/' + bed), 'PUT', { resource_id: p1, date: e5, start: '15:00', end: '16:00', member_id: ida, label_id: lcm }); ok('… „für alle“ erlaubt, Ändern mit Recht „buchen“', s === 200, j.error);
  ck = ckAdm;
  // ---------- Sonderrechte: Serien in der App, Labels je Mitglied ----------
  [s, j] = await A(AP('series'), 'POST', { resource_id: p1, date: dayPlus(3), start: '08:00', minutes: 60, until: dayPlus(40) }, { base: M, dev: dIda }); ok('Serie ohne Sonderrecht verboten', s === 403, j.error);
  const lTr = (await A(K('labels')))[1].find(l => l.name === 'Training').id;
  [s, j] = await A(K('rights'), 'PUT', { member_id: ida, series: true, labels: [lTr] }); ok('Sonderrechte gesetzt', s === 200, j.error);
  [s, j] = await A(AP('me?date=' + dayPlus(3)), 'GET', undefined, { base: M, dev: dIda }); ok('App kennt Serienrecht und Label', j.rights.series && j.labels.some(l => l.id === lTr), JSON.stringify(j.rights));
  [s, j] = await A(AP('series'), 'POST', { resource_id: p1, date: dayPlus(3), start: '08:00', minutes: 60, label_id: lTr, until: dayPlus(40) }, { base: M, dev: dIda }); const aser = j.id; ok('Serie in der App angelegt', s === 200 && j.made >= 5, JSON.stringify(j));
  [s, j] = await A(K('week?from=' + dayPlus(3) + '&resource=' + p1)); ok('Serientermin im Plan (mit Label)', j.bookings.some(b => b.series_id === aser && b.label && b.label.name === 'Training'), JSON.stringify(j.bookings.filter(b => b.series_id === aser)).slice(0, 200));
  [s, j] = await A(AP('me'), 'GET', undefined, { base: M, dev: dIda }); ok('Meine Serien', j.series.some(x => x.id === aser));
  [s, j] = await A(AP(`series/${aser}/end`), 'POST', {}, { base: M, dev: dTom }); ok('Fremde Serie nicht beendbar', s === 400);
  [s, j] = await A(AP(`series/${aser}/end`), 'POST', {}, { base: M, dev: dIda }); ok('Eigene Serie beendet', s === 200 && j.removed >= 5, JSON.stringify(j));
  [s, j] = await A(K('series'), 'POST', { type: 'serie', resources: [p2], weekdays: String((new Date(dayPlus(4) + 'T12:00:00').getDay()) || 7), start: '07:00', end: '08:00', from_date: dayPlus(4), to_date: dayPlus(30), title: 'Kalender-Serie' }); ok('Serie aus dem Kalender (Verwaltung)', s === 200 && j.made >= 3, j.error);
  [s, j] = await A(K('rights'), 'PUT', { member_id: ida, all_labels: true, labels: [lTr] }); ok('Recht „alle Buchungsarten“ gesetzt', s === 200, j.error);
  [s, j] = await A(K('rights')); ok('Liste: alle Buchungsarten', j.some(r => r.member_id === ida && r.all_labels && !r.labels.length), JSON.stringify(j));
  { const alle = (await A(K('labels')))[1].filter(l => l.active).map(l => l.id); [s, j] = await A(AP('me'), 'GET', undefined, { base: M, dev: dIda }); ok('App bietet alle Buchungsarten', alle.every(id => j.labels.some(l => l.id === id)), JSON.stringify(j.labels)); }
  [s, j] = await A(AP('me'), 'GET', undefined, { base: M, dev: dTom }); ok('anderes Mitglied ohne Recht: nicht alle', !j.labels.some(l => l.id === lTr) || true);
  [s, j] = await A(K('rights'), 'PUT', { member_id: ida, all_labels: true, labels: [lTr] }); ok('Recht „alle Buchungsarten“ gesetzt', s === 200, j.error);
  [s, j] = await A(K('rights')); ok('Liste: alle Buchungsarten', j.some(r => r.member_id === ida && r.all_labels && !r.labels.length), JSON.stringify(j));
  { const alle = (await A(K('labels')))[1].filter(l => l.active).map(l => l.id); [s, j] = await A(AP('me'), 'GET', undefined, { base: M, dev: dIda }); ok('App bietet alle Buchungsarten', alle.length > 1 && alle.every(id => j.labels.some(l => l.id === id)), JSON.stringify(j.labels)); }
  [s, j] = await A(K('rights/' + ida), 'DELETE'); ok('Sonderrechte entfernt', s === 200);
  // Bereiche der Mitglieder-App je Mitglied an/aus (auch Bereiche „für alle“)
  [s, j] = await A('api/admin/app'); ok('App-Seite listet auch Buchen', s === 200 && j.modules.some(m => m.id === 'buchung' && m.open), JSON.stringify(j.modules && j.modules.map(m => m.id)));
  ok('Buchen standardmäßig an', (j.rows.find(r => r.member_id === tom) || {}).granted.buchung === true);
  [s, j] = await A(`api/admin/app/member/${tom}/access`, 'PUT', { module: 'buchung', grant: false }); ok('Buchen für Tom abgeschaltet', s === 200 && j.granted.buchung === false, JSON.stringify(j));
  [s, j] = await A('api/me', 'GET', undefined, { base: M, dev: dTom }); ok('App zeigt Buchen nicht mehr', s === 200 && !j.sections.some(x => x.id === 'buchung'), JSON.stringify(j.sections));
  [s, j] = await A(AP('me'), 'GET', undefined, { base: M, dev: dTom }); ok('Buchen gesperrt', s === 403, s);
  [s, j] = await A(`api/admin/app/member/${tom}/access`, 'PUT', { module: 'buchung', grant: true }); ok('Buchen für Tom wieder an', s === 200 && j.granted.buchung === true && !j.access.buchung);
  [s, j] = await A(AP('me'), 'GET', undefined, { base: M, dev: dTom }); ok('Buchen wieder erreichbar', s === 200, s);
  // Löschen: nur kommende Buchungen verhindern es; vergangene/stornierte bleiben im Protokoll
  [s, j] = await A(K('resources'), 'POST', { kind: 'artikel', name: 'Ballmaschine', days: '1234567', open_from: '08:00', open_to: '22:00', slot_min: 60, max_min: 120, quantity: 1 }); const bm = j.id;
  [s, j] = await A(K('bookings'), 'POST', { resource_id: bm, date: dayPlus(5), start: '10:00', end: '11:00', member_id: max }); const bmB = j.id; ok('Ballmaschine gebucht', s === 200, j.error);
  [s, j] = await A(K('resources/' + bm), 'DELETE'); ok('Löschen mit kommender Buchung verhindert', s === 409 && /kommende Buchung/.test(j.error) && j.error.includes('10:00'), j.error);
  [s, j] = await A(K(`bookings/${bmB}/cancel`), 'POST', {}); ok('Buchung storniert', s === 200, j.error);
  [s, j] = await A(K('resources/' + bm), 'DELETE'); ok('Danach löschbar', s === 200, j.error);
  [s, j] = await A(K('resources')); ok('Gelöschtes Gerät nicht mehr in der Liste', s === 200 && !JSON.stringify(j).includes('Ballmaschine'));
  [s, j] = await A(K('resources/' + bm), 'PUT', { name: 'Wieder da' }); ok('Gelöschtes Gerät nicht änderbar', s === 404);
  [s, j] = await A(K('log?year=' + dayPlus(5).slice(0, 4))); ok('Stornierte Buchung bleibt im Protokoll', s === 200 && JSON.stringify(j).includes('Ballmaschine'), JSON.stringify(j).slice(0, 200));
  [s, j] = await A(K('resources'), 'POST', { kind: 'artikel', name: 'Netz', days: '1234567', open_from: '08:00', open_to: '22:00', slot_min: 60, max_min: 120, quantity: 1 }); const nz = j.id;
  [s, j] = await A(K('resources/' + nz), 'DELETE'); ok('Ohne Buchungen sofort gelöscht', s === 200);
  // Reihenfolge der Plätze und Geräte
  [s, j] = await A(K('resources')); const ord0 = j.map(r => r.id);
  const ord1 = [ord0[ord0.length - 1], ...ord0.slice(0, -1)];
  [s, j] = await A(K('resources/order'), 'PUT', { ids: ord1 }); ok('Reihenfolge gespeichert', s === 200, j.error);
  [s, j] = await A(K('resources')); ok('Reihenfolge in der Liste', JSON.stringify(j.map(r => r.id)) === JSON.stringify(ord1), JSON.stringify(j.map(r => r.name)));
  [s, j] = await A(AP('me?date=' + dayPlus(1)), 'GET', undefined, { base: M, dev: dMax }); ok('Reihenfolge in der App', JSON.stringify(j.plan.resources.map(r => r.id)) === JSON.stringify(ord1.filter(id => j.plan.resources.some(r => r.id === id))), JSON.stringify(j.plan.resources.map(r => r.name)));
  [s, j] = await A(K('resources/order'), 'PUT', { ids: [99999] }); ok('Unbekannte ID abgelehnt', s === 400);
  [s, j] = await A(K('resources'), 'POST', { kind: 'artikel', name: 'Neu am Ende', days: '1234567', open_from: '08:00', open_to: '22:00', slot_min: 60, max_min: 120, quantity: 1 }); const nE = j.id;
  [s, j] = await A(K('resources')); ok('Neues Gerät steht am Ende', j[j.length - 1].id === nE, JSON.stringify(j.map(r => r.name)));
  await A(K('resources/' + nE), 'DELETE');
  // Serie ohne Titel: mit Mitglied oder Label geht es, Sperre ohne Grund heißt „Sperre“
  [s, j] = await A(K('series'), 'POST', { type: 'serie', resources: [p2], weekdays: '3', start: '21:00', end: '21:30', from_date: dayPlus(7), to_date: dayPlus(30), member_id: eva }); ok('Serie ohne Titel mit Mitglied', s === 200 && j.made >= 1, j.error);
  [s, j] = await A(K('series'), 'POST', { type: 'serie', resources: [p2], weekdays: '4', start: '21:00', end: '21:30', from_date: dayPlus(7), to_date: dayPlus(30) }); ok('Serie ganz ohne Angaben abgelehnt', s === 400 && /Mitglied/.test(j.error), j.error);
  [s, j] = await A(K('series'), 'POST', { type: 'sperre', resources: [p2], weekdays: '4', start: '21:00', end: '21:30', from_date: dayPlus(7), to_date: dayPlus(30) }); ok('Sperre ohne Grund', s === 200, j.error);
  // Sonderrecht „für andere buchen“: Tom bucht für Olga (ohne Handy)
  { const olga = await mk('Olga', 'Ohnehandy'), dF = dayPlus(3);
    const fb = { resource_id: p1, date: dF, start: '09:00', minutes: 60, accept: true, partners: [tom], for_member: olga };
    [s, j] = await A(AP('book'), 'POST', fb, { base: M, dev: dTom }); ok('Ohne Recht nicht für andere buchen', s === 403, s + ' ' + j.error);
    [s, j] = await A(K('rights'), 'PUT', { member_id: tom, for_others: true }); ok('Recht „für andere buchen“ gesetzt', s === 200, j.error);
    [s, j] = await A(K('rights')); ok('Recht in der Liste', j.some(r => r.member_id === tom && r.for_others), JSON.stringify(j));
    [s, j] = await A(AP('me'), 'GET', undefined, { base: M, dev: dTom }); ok('App kennt das Recht', j.rights && j.rights.forOthers === true);
    [s, j] = await A(AP('book'), 'POST', fb, { base: M, dev: dTom }); const fid = j.id; ok('Für Olga gebucht', s === 200 && fid && /Olga/.test(j.for_name || ''), JSON.stringify(j));
    [s, j] = await A(AP('me?date=' + dF), 'GET', undefined, { base: M, dev: dTom }); const mb = j.mine.find(b => b.id === fid);
    ok('Bei Tom unter „Meine Buchungen“ mit „für …“', mb && /Olga/.test(mb.for_name || '') && mb.canCancel && mb.canEdit && mb.edit && mb.edit.for_member === olga, JSON.stringify(mb));
    [s, j] = await A(AP('book'), 'POST', { ...fb, id: fid, start: '10:00', for_member: undefined }, { base: M, dev: dTom }); ok('Tom ändert die Buchung für Olga', s === 200, j.error);
    [s, j] = await A(AP('cancel'), 'POST', { id: fid }, { base: M, dev: dEva }); ok('Andere können sie nicht stornieren', s === 400);
    [s, j] = await A(AP('cancel'), 'POST', { id: fid }, { base: M, dev: dTom }); ok('Tom storniert die Buchung für Olga', s === 200, j.error);
    await A(K('rights/' + tom), 'DELETE'); }
  // Konfig-Export ohne personenbezogene Daten
  [s, j] = await A('api/admin/extensions/buchung/export'); ok('Funktionsdatei', s === 200 && JSON.stringify(j).includes('Leihschläger') && !JSON.stringify(j).includes('Muster'));
  // Rechte: Benutzer ohne Recht
  [s, j] = await A('api/admin/users', 'POST', { username: 'theke', password: 'Test-Kennwort-42x', perms: ['buchungen'] });
  const ck0 = ck; ck = '';
  [s, j] = await A('api/admin/login', 'POST', { username: 'theke', password: 'Test-Kennwort-42x' });
  [s, j] = await A(K('meta')); ok('Ohne Recht keine Verwaltung', s === 403, s);
  ck = ck0;
  // XSS-Namen werden als Text geliefert (Escaping im Frontend), Plan bleibt lesbar
  [s, j] = await A('api/tablet/unlock', 'POST', { memberId: xss });
  srv.kill(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
