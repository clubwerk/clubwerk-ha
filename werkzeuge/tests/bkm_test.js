// Buchungssystem und Verwaltungs-Übersicht: Nachtests zu behobenen Fehlern.  node bkm_test.js <S>
// 1. „Für dich gebucht“ und Mitspieler-Mail mit Eckdaten-Zeilen (summaryRows) und Knopf „Zu deinem Kalender hinzufügen“ (kein Anhang)
// 2. Änderung einer Buchung: Push auch bei ausgeschalteter Mitspieler-Mail, Änderungs-Mail an den Bucher
// 3. Übersicht der Verwaltung: offene Beträge (Konten und Veranstaltung) nach Buchungen am Tablet
// 4. Tablet nur mit Tablet-Anmeldung (CW_TEST_TABLET_OPEN=1 öffnet das Tablet nur, solange kein Passwort gesetzt ist)
const { spawn } = require('child_process'); const fs = require('fs'); const crypto = require('crypto');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_bkm'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3286/', M = 'http://127.0.0.1:5290/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
let ck = '';
// Neue Mitglieder brauchen seit 3.9 vollständige Daten (wie in bk_test.js)
let __fee = null;
async function fillMember(b) {
  if (!__fee) { const [, m] = await A('api/admin/x/mitglieder/meta'); const f = ((m && m.fees) || []).find(x => x.active && x.kind !== 'zusatz' && x.age_min == null && x.age_max == null);
    __fee = f ? f.id : (await A('api/admin/x/mitglieder/fees', 'POST', { name: 'Testbeitrag', cents: 1000, interval: 'jahr', kind: 'grund' }))[1].id; }
  const __doc = await fetch(B + 'api/admin/x/mitglieder/member/new-document', { method: 'POST', headers: { 'X-Clubwerk': '1', Cookie: ck, 'Content-Type': 'application/octet-stream', 'X-Filename': 'antrag.pdf' }, body: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)) }).then(r => r.json()).catch(() => ({}));
  const full = { doc_id: __doc.doc_id, last_name: 'Test', birth_date: '1980-01-01', street: 'Weg 1', zip: '12345', city: 'Ort', email: `x${Math.random().toString(36).slice(2, 6)}@test.de`, mobile: '0170 1234567', fee_id: __fee, payment: 'rechnung', ...b, __filled: true };
  return A('api/admin/x/mitglieder/member', 'POST', full);
}
/* A(url, method, body, { base, dev, jar }) – jar: eigene Cookie-Dose (Tablet ohne Admin-Anmeldung); ohne jar gilt die Admin-Sitzung */
async function A(url, method = 'GET', body, { base = B, dev, jar } = {}) {
  if (method === 'POST' && /x\/mitglieder\/member$/.test(url) && body && typeof body === 'object' && !body.__filled) return fillMember(body);
  if (body && body.__filled) { body = { ...body }; delete body.__filled; }
  const h = { 'X-Clubwerk': '1', Cookie: base !== B ? '' : jar ? Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ') : ck }; if (dev) h['X-Geraet'] = dev;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const i = kv.indexOf('='); if (jar) jar[kv.slice(0, i)] = kv.slice(i + 1); else if (base === B && kv.startsWith('gadmin=') && kv !== 'gadmin=') ck = kv; }
  const buf = Buffer.from(await r.arrayBuffer()); let j = {}; try { j = JSON.parse(buf.toString()); } catch (e) { /* */ } return [r.status, j, r];
}
const X = p => 'api/admin/x/mitglieder/' + p, K = p => 'api/admin/x/buchung/' + p, AP = p => 'api/m/buchung/' + p, TB = p => 'api/tablet/x/buchung/' + p;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mailFiles = () => fs.readdirSync(MAILDIR).filter(f => /^mail\d+\.json$/.test(f));
const seen = new Set(mailFiles());
const newMails = () => { const n = mailFiles().filter(f => !seen.has(f)); n.forEach(f => seen.add(f)); return n.map(f => JSON.parse(fs.readFileSync(MAILDIR + '/' + f))); };
const pad = n => String(n).padStart(2, '0');
const dayPlus = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const deD = s => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Zeile der Infokarte in der HTML-Mail: <td>Bezeichnung</td><td>Wert</td> */
const cardRow = (html, k, v) => new RegExp(`>${esc(k)}</td>\\s*<td[^>]*>${v instanceof RegExp ? v.source : esc(v)}</td>`).test(html);

/* Push ohne Datenverkehr nach außen: Ein Vorlader im Testserver beantwortet Anfragen an den Push-Dienst
   (fcm.googleapis.com) selbst mit 201 und schreibt sie mit. Der Produktivcode bleibt unverändert. */
const PUSHLOG = S + '/bkm_push.log', STUB = S + '/bkm_push_stub.js'; fs.writeFileSync(PUSHLOG, '');
fs.writeFileSync(STUB, `const https = require('https'), fs = require('fs'), { EventEmitter } = require('events'), { PassThrough } = require('stream');
const orig = https.request;
https.request = function (o, cb) {
  const host = typeof o === 'string' ? new URL(o).hostname : (o && (o.hostname || o.host));
  if (host !== 'fcm.googleapis.com') return orig.apply(this, arguments);
  const rq = new EventEmitter(); rq.write = () => true; rq.destroy = () => rq; rq.setTimeout = () => rq;
  rq.end = () => { fs.appendFileSync(${JSON.stringify(PUSHLOG)}, (o.path || '') + '\\n'); setImmediate(() => { const res = new PassThrough(); res.statusCode = 201; if (cb) cb(res); res.end(); }); return rq; };
  return rq;
};
`);
const pushHits = () => fs.readFileSync(PUSHLOG, 'utf8').split('\n').filter(Boolean);
const fakeSub = name => { const e = crypto.createECDH('prime256v1'); e.generateKeys();
  return { endpoint: `https://fcm.googleapis.com/fcm/send/bkm-${name}-${crypto.randomBytes(6).toString('hex')}`, keys: { p256dh: e.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } }; };

let srv;
(async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${STUB}`.trim(), CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3286', BEREGNUNG_PORT: '5298', MEMBER_PORT: '5290', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/bkm_srv.log', 'w'), fs.openSync(S + '/bkm_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Grün-Weiß Musterstadt', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true, buchung: true } }); ok('Setup', s === 200, JSON.stringify(j));
  await A('api/admin/mail', 'PUT', { host: '127.0.0.1', port: 2525, user: '', from: 'verein@test.de' });
  const mk = async (f, l) => { const r = await A(X('member'), 'POST', { first_name: f, last_name: l, birth_date: '1980-01-01', entry_date: '2020-01-01', email: f.toLowerCase() + '.bkm@test.de' }); return r[1].id; };
  const max = await mk('Max', 'Muster'), tom = await mk('Tom', 'Partner'), ida = await mk('Ida', 'Dritte'), olga = await mk('Olga', 'Ohnehandy');
  ok('Mitglieder angelegt', [max, tom, ida, olga].every(Boolean), JSON.stringify([max, tom, ida, olga]));
  [s, j] = await A(K('meta')); const p1 = j.resources[0].id, p2 = j.resources[1].id, p1n = j.resources[0].name;
  await A(K('settings'), 'PUT', { max_open_platz: 0 });
  const pair = async (id, pin) => { const t = (await A(`api/admin/app/member/${id}/invite`, 'POST', {}))[1].token; return (await A('api/pair', 'POST', { t, pin }, { base: M }))[1].device; };
  const dMax = await pair(max, '2468'), dTom = await pair(tom, '1234'), dIda = await pair(ida, '5678');
  ok('Handys gekoppelt', dMax && dTom && dIda);
  await sleep(800); newMails();   // Mails „Mitglieder-App freigeschaltet“ abräumen
  const book = (dev, b) => A(AP('book'), 'POST', { accept: true, ...b }, { base: M, dev });

  /* ---------- 1. „Für dich gebucht“ und Mitspieler-Mail: Eckdaten-Zeilen und Kalenderanhang ---------- */
  {
    const dF = dayPlus(2);
    [s, j] = await A(K('rights'), 'PUT', { member_id: tom, for_others: true }); ok('Recht „für andere buchen“ für Tom', s === 200, j.error);
    [s, j] = await A('api/admin/settings/app', 'PUT', { url: 'https://app.dein-verein.test' }); ok('Adresse der Mitglieder-App eingetragen', s === 200, JSON.stringify(j));
    newMails();
    [s, j] = await book(dTom, { resource_id: p1, date: dF, start: '09:00', minutes: 60, partners: [ida], for_member: olga }); const fid = j.id;
    ok('Tom bucht für Olga mit Ida als Mitspielerin', s === 200 && fid, JSON.stringify(j));
    await sleep(800); const ms = newMails().filter(m => !/freigeschaltet/.test(m.subject));
    const wann = new RegExp(`\\w\\w, ${esc(deD(dF))} · 09:00–10:00 Uhr`);
    const fo = ms.find(m => m.to.includes('olga.bkm@test.de') && /Für dich gebucht/.test(m.subject));
    ok('„Für dich gebucht“-Mail an Olga', fo, JSON.stringify(ms.map(m => [m.to, m.subject])));
    ok('… Textfassung mit Eckdaten (Platz, Wann, Gebucht von)', fo && new RegExp(`Platz: ${esc(p1n)}`).test(fo.text) && wann.test(fo.text) && /Gebucht von: Olga Ohnehandy/.test(fo.text), fo && fo.text);
    ok('… Infokarte mit Zeilen „Platz“ und „Wann“ (summaryRows statt Textzeilen)', fo && cardRow(fo.html, 'Platz', p1n) && cardRow(fo.html, 'Wann', wann) && cardRow(fo.html, 'Spieler', /Olga Ohnehandy, Ida Dritte/),
      fo && (fo.html.match(/<table role="presentation" width="100%"[\s\S]*?<\/table>/) || [''])[0].replace(/style="[^"]*"/g, '').slice(0, 400));
    ok('… keine zerlegten Zeilen (Bezeichnung = ein Buchstabe)', fo && !/>P<\/td>\s*<td[^>]*>l<\/td>/.test(fo.html));
    ok('… kein .ics-Anhang', fo && !fo.att.some(a => /\.ics$/.test(a.f)), JSON.stringify(fo && fo.att));
    const calUrl = fo && (fo.html.match(/href="(https:\/\/app\.dein-verein\.test\/api\/p\/buchung\/ics\/\d+\?k=[0-9a-f]{32})"[^>]*>Zu deinem Kalender hinzufügen</) || [])[1];
    ok('… Knopf „Zu deinem Kalender hinzufügen“ auf die .ics-Adresse der App', calUrl, fo && (fo.html.match(/<a [^>]*>[^<]*Kalender[^<]*</) || [''])[0]);
    { const r = calUrl ? await fetch(M + calUrl.replace(/^https:\/\/[^/]+\//, '')) : null, body = r ? await r.text() : '';
      ok('… Link liefert einen gültigen Termin', /BEGIN:VCALENDAR/.test(body) && /BEGIN:VEVENT/.test(body) && /DTSTART:\d{8}T\d{6}Z/.test(body) && /Olga Ohnehandy/.test(body), body.slice(0, 200)); }
    ok('… Textfassung mit dem Kalender-Link', fo && calUrl && fo.text.includes(calUrl.replace(/&amp;/g, '&')));
    const fi = ms.find(m => m.to.includes('ida.bkm@test.de') && /Platz/.test(m.subject));
    ok('Mitspielerin Ida bekommt die Mitspieler-Mail', fi && /als Mitspieler/.test(fi.text), JSON.stringify(ms.map(m => [m.to, m.subject])));
    ok('… mit Eckdaten-Zeilen und Kalender-Knopf', fi && cardRow(fi.html, 'Platz', p1n) && cardRow(fi.html, 'Wann', wann) && /Zu deinem Kalender hinzufügen</.test(fi.html) && !fi.att.some(a => /\.ics$/.test(a.f)), fi && JSON.stringify(fi.att));
    ok('Tom (bucht selbst) bekommt keine Mitspieler-Mail', !ms.some(m => m.to.includes('tom.bkm@test.de')), JSON.stringify(ms.map(m => m.to)));
    await A(AP('cancel'), 'POST', { id: fid }, { base: M, dev: dTom });
    await A(K('rights/' + tom), 'DELETE');
    await sleep(400); newMails();
  }

  /* ---------- 2. Änderung: Push auch bei ausgeschalteter Mitspieler-Mail ---------- */
  {
    for (const [dev, n] of [[dMax, 'max'], [dTom, 'tom']]) { [s, j] = await A('api/push/subscribe', 'POST', { subscription: fakeSub(n) }, { base: M, dev }); ok(`Push-Abo (${n})`, s === 200 && j.subscribed === true, JSON.stringify(j).slice(0, 200)); }
    [s, j] = await A(K('settings'), 'PUT', { notify_partners: false }); ok('Mitspieler-Mail ausgeschaltet', s === 200 && j.settings && j.settings.notify_partners === false, JSON.stringify(j.settings || j));
    const dC = dayPlus(3);
    [s, j] = await book(dMax, { resource_id: p2, date: dC, start: '10:00', minutes: 60, partners: [tom] }); const bid = j.id; ok('Max bucht mit Tom', s === 200 && bid, j.error);
    await sleep(800); newMails(); const h0 = pushHits().length;
    [s, j] = await A('api/admin/push'); const before = (j.recent || []).length;
    [s, j] = await book(dMax, { id: bid, resource_id: p2, date: dC, start: '12:00', minutes: 60, partners: [tom] }); ok('Max verschiebt die Buchung (App)', s === 200 && j.id === bid, j.error);
    await sleep(1000);
    [s, j] = await A('api/admin/push'); const rec = (j.recent || []).slice(0, Math.max(0, (j.recent || []).length - before));
    ok('Push „Geändert“ an Tom trotz ausgeschalteter Mail (mailChange bricht nicht mehr ab)', rec.some(r => r.event === 'buchung.aenderung' && r.member === 'Tom Partner' && r.ok === 1 && /^Geändert:/.test(r.title)) && pushHits().length > h0,
      JSON.stringify((j.recent || []).slice(0, 4)));
    let ms = newMails(); ok('… aber keine Mail (Einstellung gilt weiter für E-Mails)', !ms.length, JSON.stringify(ms.map(m => [m.to, m.subject])));
    // Verwaltung ändert: Bucher (toBooker) und Mitspieler bekommen Push
    [s, j] = await A('api/admin/push'); const before2 = (j.recent || []).length;
    [s, j] = await A(K('bookings/' + bid), 'PUT', { resource_id: p2, date: dC, start: '14:00', end: '15:00', member_id: max, partners: [tom], guests: [] }); ok('Verwaltung verschiebt die Buchung', s === 200, j.error);
    await sleep(1000);
    [s, j] = await A('api/admin/push'); const rec2 = (j.recent || []).slice(0, Math.max(0, (j.recent || []).length - before2));
    ok('… Push „Geändert“ an Bucher Max und an Tom', ['Max Muster', 'Tom Partner'].every(n => rec2.some(r => r.event === 'buchung.aenderung' && r.member === n && r.ok === 1)), JSON.stringify(rec2));
    ms = newMails(); ok('… ohne Mail', !ms.length, JSON.stringify(ms.map(m => [m.to, m.subject])));
    // Mail wieder an: Änderung durch die Verwaltung → Änderungs-Mail an den Bucher
    await A(K('settings'), 'PUT', { notify_partners: true });
    [s, j] = await A(K('bookings/' + bid), 'PUT', { resource_id: p2, date: dC, start: '16:00', end: '17:00', member_id: max, partners: [tom], guests: [] }); ok('Verwaltung verschiebt erneut (Mail an)', s === 200, j.error);
    await sleep(900); ms = newMails();
    const mm = ms.find(m => m.to.includes('max.bkm@test.de'));
    ok('Änderungs-Mail an den Bucher', mm && /Geändert/.test(mm.subject) && /Der Verein hat die Buchung geändert/.test(mm.text) && /vorher:/.test(mm.text), JSON.stringify(ms.map(m => [m.to, m.subject])));
    ok('… mit neuer Zeit in den Eckdaten', mm && cardRow(mm.html, 'Wann', new RegExp(`\\w\\w, ${esc(deD(dC))} · 16:00–17:00 Uhr`)));
    ok('Änderungs-Mail an den Mitspieler', ms.some(m => m.to.includes('tom.bkm@test.de') && /Geändert/.test(m.subject)), JSON.stringify(ms.map(m => [m.to, m.subject])));
    await A(K(`bookings/${bid}/cancel`), 'POST', {}); await sleep(400); newMails();
  }

  /* ---------- 4. Tablet nur mit Tablet-Anmeldung ---------- */
  const TJ = {};   // Cookie-Dose des Tablets (keine Admin-Sitzung)
  const T = (url, body, jar = TJ) => A(url, body === undefined ? 'GET' : 'POST', body, { jar });
  {
    [s, j] = await T('api/tablet/state', undefined, {}); ok('Ohne Tablet-Passwort nur im Testbetrieb offen (CW_TEST_TABLET_OPEN=1)', s === 200, s);
    [s, j] = await A('api/admin/settings/tablet-password', 'PUT', { password: 'Theke-Abend7' }); ok('Tablet-Passwort gesetzt', s === 200, j.error);
    [s, j] = await T('api/tablet/state', undefined, {}); ok('Danach: Tablet ohne Anmeldung gesperrt – trotz Testschalter', s === 401 && j.gate === true, s + ' ' + JSON.stringify(j));
    [s, j] = await T(TB('state'), undefined, {}); ok('Buchungssystem am Tablet ohne Anmeldung gesperrt', s === 401, s);
    [s, j] = await T('api/tablet/unlock', { memberId: ida, pin: '5678' }, {}); ok('Name/PIN ohne Tablet-Anmeldung gesperrt', s === 401, s);
    [s, j] = await T('api/gate/login', { password: 'falsch-falsch' }); ok('Falsches Tablet-Passwort abgelehnt', s === 401, s);
    [s, j] = await T('api/gate/login', { password: 'Theke-Abend7' }); ok('Tablet angemeldet', s === 200 && TJ.gtablet, JSON.stringify(Object.keys(TJ)));
    [s, j] = await T(TB('state')); ok('Buchungssystem am Tablet mit Anmeldung', s === 200 && j.plan && j.plan.resources.length >= 2, s);
    [s, j] = await T('api/tablet/unlock', { memberId: ida, pin: '5678' }); const tk = j.token; ok('Ida meldet sich mit PIN an', s === 200 && tk, JSON.stringify(j).slice(0, 200));
    const dT = dayPlus(1);
    [s, j] = await T(TB('book'), { token: tk, resource_id: p1, date: dT, start: '11:00', minutes: 60, accept: true }, {}); ok('Buchen mit gültigem Mitglieds-Token, aber ohne Tablet-Anmeldung → gesperrt', s === 401, s + ' ' + JSON.stringify(j));
    [s, j] = await T('api/tablet/unlock', { memberId: ida, pin: '5678' }); const tk2 = j.token;
    [s, j] = await T(TB('book'), { token: tk2, resource_id: p1, date: dT, start: '11:00', minutes: 60, accept: true }); const tbId = j.id; ok('Buchen mit Tablet-Anmeldung', s === 200 && tbId, JSON.stringify(j));
    [s, j] = await T(TB('book'), { token: 'falsch', resource_id: p1, date: dT, start: '13:00', minutes: 60, accept: true }); ok('… aber nicht ohne Mitglieds-Token', s === 401, s);
    [s, j] = await A(K('day?date=' + dT)); ok('Tablet-Buchung im Plan', (j.bookings || []).some(b => b.id === tbId && b.member_id === ida), JSON.stringify((j.bookings || []).map(b => [b.id, b.member_id])));
    [s, j] = await A('api/admin/settings/tablet-password/logout-all', 'POST', {}); [s, j] = await T(TB('state')); ok('Alle Tablets abgemeldet → wieder gesperrt', s === 401, s);
    await T('api/gate/login', { password: 'Theke-Abend7' });
  }

  /* ---------- 3. Übersicht: offene Beträge nach Buchungen im Verkauf ---------- */
  {
    [s, j] = await T('api/tablet/state'); let art = (j.articles || []).find(a => a.price_cents > 0 && !a.custom);
    ok('Artikel am Tablet', s === 200 && art, JSON.stringify((j.articles || []).slice(0, 2)));
    [s, j] = await A('api/admin/balances'); const bal0 = j.total_cents || 0;
    [s, j] = await T('api/tablet/unlock', { memberId: max, pin: '2468' }); ok('Max am Tablet (Verkauf)', s === 200 && j.token, JSON.stringify(j).slice(0, 200));
    [s, j] = await T('api/tablet/book', { token: j.token, items: [{ articleId: art.id, qty: 3 }] }); ok('Max bucht 3 Artikel aufs Konto', s === 200, JSON.stringify(j).slice(0, 200));
    [s, j] = await A('api/admin/balances'); ok('Übersicht „Offen auf Konten“ (balances.total_cents) stimmt', s === 200 && j.total_cents === bal0 + 3 * art.price_cents, `${j.total_cents} statt ${bal0 + 3 * art.price_cents}`);
    // Veranstaltung: Mitglied und frei eingetragener Name schreiben an
    [s, j] = await A('api/admin/events', 'POST', { name: 'Sommerfest', date: dayPlus(0) }); const ev = j.id; ok('Veranstaltung angelegt', s === 200 && ev, j.error);
    [s, j] = await A(`api/admin/events/${ev}/activate`, 'POST', {}); ok('Veranstaltung aktiv', s === 200, j.error);
    [s, j] = await T('api/tablet/state'); const eart = j.event && j.event.articles && j.event.articles.find(a => a.price_cents > 0);
    ok('Tablet sieht die Veranstaltung', eart, JSON.stringify(j.event || {}).slice(0, 200));
    [s, j] = await T('api/tablet/event/guest', { memberId: tom }); const tT = j.token; ok('Tom auf der Liste', s === 200 && tT, JSON.stringify(j).slice(0, 200));
    [s, j] = await T('api/tablet/book', { token: tT, items: [{ articleId: eart.id, qty: 2 }] }); ok('Tom schreibt an', s === 200 && j.open_cents === 2 * eart.price_cents, JSON.stringify(j).slice(0, 200));
    [s, j] = await T('api/tablet/event/guest', { name: 'Gerd Gastmann' }); const tG = j.token; ok('Frei eingetragener Gast', s === 200 && tG && j.guest.memberId === null, JSON.stringify(j).slice(0, 200));
    [s, j] = await T('api/tablet/book', { token: tG, items: [{ articleId: eart.id, qty: 1 }] }); ok('Gast schreibt an', s === 200, JSON.stringify(j).slice(0, 200));
    [s, j] = await A('api/admin/events'); let E = (Array.isArray(j) ? j : []).find(x => x.id === ev);
    ok('Übersicht: laufende Veranstaltung „angeschrieben“ (open_cents) = Summe aller Namen', E && E.active && E.open_cents === 3 * eart.price_cents, E && `${E.open_cents} statt ${3 * eart.price_cents}`);
    ok('Übersicht: open_member_cents nur für Mitglieder', E && E.open_member_cents === 2 * eart.price_cents, E && `${E.open_member_cents} statt ${2 * eart.price_cents}`);
    [s, j] = await A(`api/admin/events/${ev}/deactivate`, 'POST', {}); ok('Veranstaltung beendet', s === 200, j.error);
    [s, j] = await A('api/admin/events'); E = (Array.isArray(j) ? j : []).find(x => x.id === ev);
    ok('Übersicht: beendete Veranstaltung meldet offenen Mitgliederbetrag (> 0)', E && !E.active && E.open_member_cents === 2 * eart.price_cents, E && JSON.stringify({ active: E.active, open_member_cents: E.open_member_cents }));
    // Verwaltung liest genau diese Felder (früher credit_cents / open_credit_cents, die es nicht gibt)
    const src = fs.readFileSync(APP + '/public/admin.js', 'utf8'), ov = (src.match(/RENDER\.uebersicht = async[\s\S]*?drinksCard = modCard/) || [''])[0];
    ok('admin.js (Übersicht) liest open_cents und open_member_cents', /active\.open_cents/.test(ov) && /e\.open_member_cents/.test(ov), ov.length);
    ok('admin.js (Übersicht) liest keine nicht vorhandenen Felder', ov && !/credit_cents/.test(ov) && E && !('credit_cents' in E) && !('open_credit_cents' in E));
  }

  srv.kill(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ABBRUCH', e); if (srv) srv.kill(); process.exit(1); });
