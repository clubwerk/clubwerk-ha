// E-Mail (Verein → E-Mail): Ende-zu-Ende (Verwaltung, Mitglieder-App, Tablet, Regeln, Angriffe).  node bk_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_ml'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3306/', M = 'http://127.0.0.1:5307/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
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
const raw = async (url, buf, name, type) => { const r = await fetch(B + url, { method: 'POST', headers: { 'X-Clubwerk': '1', Cookie: ck, 'Content-Type': 'application/octet-stream', 'X-Name': encodeURIComponent(name), 'X-Type': type || '' }, body: buf }); return [r.status, await r.json().catch(() => ({}))]; };
const waitSent = async id => { for (let i = 0; i < 80; i++) { const [, j] = await A('api/admin/mail/messages/' + id); if (j.status && j.status !== 'sendet') return j; await sleep(250); } return null; };
(async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', CW_MAIL_DELAY: '0', DATA_DIR: DATA, PORT: '3306', BEREGNUNG_PORT: '5306', MEMBER_PORT: '5307', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/ml_srv.log', 'w'), fs.openSync(S + '/ml_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true } }); ok('Setup', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/mail/options'); ok('Optionen ohne Postfach', s === 200 && j.ready === false && j.mv === true, JSON.stringify(j).slice(0, 200));
  await A('api/admin/mail', 'PUT', { host: '127.0.0.1', port: 2525, user: '', from: 'verein@test.de' });
  const mk = async (f, l, extra = {}) => (await A(X('member'), 'POST', { first_name: f, last_name: l, birth_date: '1980-01-01', entry_date: '2020-01-01', email: f.toLowerCase() + '@test.de', ...extra }))[1].id;
  const max = await mk('Max', 'Muster'), eva = await mk('Eva', 'Beispiel'), ida = await mk('Ida', 'Passiv'), kid = await mk('Kim', 'Muster', { birth_date: '2015-05-05' });
  await A(X('member/' + kid), 'PUT', { email: null }); await A(X(`member/${kid}/payer`), 'PUT', { payer_id: max });
  await A(X('member/' + ida), 'PUT', { status: 'passiv' });
  const dTen = (await A(X('departments'), 'POST', { name: 'Tennis' }))[1].id, dPad = (await A(X('departments'), 'POST', { name: 'Padel' }))[1].id;
  await A(X(`member/${eva}/departments`), 'POST', { department_id: dTen }); await A(X(`member/${kid}/departments`), 'POST', { department_id: dTen }); await A(X(`member/${max}/departments`), 'POST', { department_id: dPad });
  [s, j] = await A(X(`member/${eva}/functions`), 'POST', { name: 'Trainer' }); ok('Amt eingetragen', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/mail/options'); ok('Gruppen mit Anzahl', j.ready && j.groups.find(g => g.t === 'status' && g.v === 'aktuell').n === 4 && j.groups.some(g => g.t === 'dept' && g.v === dTen && g.n === 2) && j.groups.some(g => g.t === 'func' && g.v === 'Trainer' && g.n === 1), JSON.stringify(j.groups));
  ok('Mitglieder nach Nachname', j.members.map(m => m.name).join('|') === 'Beispiel, Eva|Muster, Kim|Muster, Max|Passiv, Ida', j.members.map(m => m.name).join('|'));
  ok('Kind ohne Adresse über Zahler', j.members.find(m => m.id === kid).viaPayer === true);
  // Absender
  [s, j] = await A('api/admin/mail/me', 'PUT', { name: 'Anna Vorstand', reply_to: 'nicht-gueltig' }); ok('Ungültige Antwortadresse abgelehnt', s === 400);
  [s, j] = await A('api/admin/mail/me', 'PUT', { name: 'Anna Vorstand', reply_to: 'Anna@Privat.de', signature: '<p>Viele Grüße<br><b>Anna</b></p><script>alert(1)</script>' }); ok('Absender gespeichert', s === 200 && j.me.reply_to === 'anna@privat.de' && !j.me.signature.includes('script'), JSON.stringify(j));
  // Entwurf
  [s, j] = await A('api/admin/mail/drafts', 'POST', { subject: 'Saisonstart {verein}', html: '<p>{briefanrede},</p><p>die Saison <b>beginnt</b>! <a href="https://tc.de/plan">Plan</a> <a href="javascript:alert(1)">x</a></p><img src=x onerror=alert(1)><p onclick="x()">Ende</p>', spec: { groups: [{ t: 'dept', v: dTen }], addresses: ['Gast <gast@extern.de>', 'eva@test.de'] } });
  const d1 = j.id; ok('Entwurf angelegt', s === 200 && d1 > 0, JSON.stringify(j));
  [s, j] = await A('api/admin/mail/messages/' + d1); ok('HTML bereinigt', !/script|onerror|onclick|javascript|<img/i.test(j.html) && j.html.includes('<a href="https://tc.de/plan"') && j.html.includes('<b>beginnt</b>'), j.html);
  [s, j] = await raw(`api/admin/mail/drafts/${d1}/files`, Buffer.from('%PDF-1.4 Testinhalt '.repeat(50)), 'Spielplan 2027.pdf', 'application/pdf'); ok('Anhang hochgeladen', s === 200 && j.files.length === 1 && j.file.type === 'application/pdf', JSON.stringify(j));
  const fid = j.file.id;
  [s, j] = await raw(`api/admin/mail/drafts/${d1}/files`, Buffer.from('x'), 'virus.exe', ''); ok('Programme abgelehnt', s === 400, JSON.stringify(j));
  [s, j] = await raw(`api/admin/mail/drafts/${d1}/files`, Buffer.from('{"a":1}'), 'daten.json', 'application/json'); ok('JSON-Datei als Anhang', s === 200 && j.files.length === 2, JSON.stringify(j));
  await A(`api/admin/mail/drafts/${d1}/files/${j.file.id}`, 'DELETE');
  [s, j] = await raw(`api/admin/mail/drafts/${d1}/files`, Buffer.alloc(11 * 1024 * 1024), 'gross.bin', ''); ok('Zu große Datei abgelehnt', s === 413 || s === 400, s);
  [s, j] = await A(`api/admin/mail/drafts/${d1}/preview`, 'POST', {});
  ok('Vorschau: Familie nur einmal, Kind über Zahler, Doppelte entfernt', s === 200 && j.count === 3 && j.rcpt.some(r => r.email === 'max@test.de' && r.via === 'Max Muster') && j.rcpt.filter(r => r.email === 'eva@test.de').length === 1 && j.rcpt.some(r => r.email === 'gast@extern.de'), JSON.stringify(j.rcpt));
  ok('Vorschau personalisiert', j.sample.subject === 'Saisonstart TC Test' && /Hallo Eva/.test(j.sample.html) && j.reply_to === 'anna@privat.de' && /Anna Vorstand · TC Test/.test(j.from), JSON.stringify(j.sample) + j.from);
  [s, j] = await A(`api/admin/mail/drafts/${d1}`, 'PUT', { spec: { groups: [{ t: 'dept', v: dTen }], addresses: ['Gast <gast@extern.de>', 'eva@test.de'], payer: false } });
  [s, j] = await A(`api/admin/mail/drafts/${d1}/preview`, 'POST', {}); ok('Ohne Zahler: Kind ohne E-Mail', j.count === 2 && j.withoutCount === 1 && j.without[0] === 'Kim Muster', JSON.stringify(j));
  [s, j] = await A(`api/admin/mail/drafts/${d1}`, 'PUT', { spec: { groups: [{ t: 'dept', v: dTen }], addresses: ['Gast <gast@extern.de>', 'eva@test.de', 'kaputt@'] } });
  [s, j] = await A(`api/admin/mail/drafts/${d1}/send`, 'POST', {}); ok('Ungültige Adresse blockiert Versand', s === 400 && /Ungültige Adresse/.test(j.error), JSON.stringify(j));
  [s, j] = await A(`api/admin/mail/drafts/${d1}`, 'PUT', { spec: { groups: [{ t: 'dept', v: dTen }], addresses: ['Gast <gast@extern.de>', 'eva@test.de'] } });
  mailFiles().forEach(f => fs.unlinkSync(MAILDIR + '/' + f)); newMails();
  [s, j] = await A(`api/admin/mail/drafts/${d1}/send`, 'POST', {}); ok('Gesendet', s === 200 && j.count === 3, JSON.stringify(j));
  const m1 = await waitSent(d1); ok('Status gesendet', m1 && m1.status === 'gesendet' && m1.sent === 3 && m1.failed === 0 && m1.rcpt.every(r => r.status === 'ok'), JSON.stringify(m1 && { st: m1.status, rc: m1.rcpt }));
  await sleep(300);
  const mails = newMails();
  ok('3 Mails + Kopie an mich', mails.length === 4, mails.map(m => m.to).join(', '));
  const toMax = mails.find(m => /max@test.de/.test(m.to)), copy = mails.find(m => /anna@privat.de/.test(m.to));
  ok('Absendername, Vereinspostfach, Antwort an Absender', toMax && /Anna Vorstand · TC Test/.test(toMax.from) && /verein@test.de/.test(toMax.from) && /anna@privat.de/.test(toMax.reply), toMax && (toMax.from + ' / ' + toMax.reply));
  ok('Kind über den Zahler: Mail an die Eltern, Anrede des Kindes', toMax && /Hallo Kim/.test(toMax.html) && toMax.subject === 'Saisonstart TC Test', toMax && toMax.html.slice(0, 300));
  ok('HTML + Textfassung + Unterschrift', toMax && /<b>beginnt<\/b>/.test(toMax.html) && /Plan \(https:\/\/tc.de\/plan\)/.test(toMax.text) && /Viele Grüße/.test(toMax.text), toMax && toMax.text);
  ok('Anhang in der Mail', toMax && toMax.att.length === 1 && toMax.att[0].f === 'Spielplan 2027.pdf', toMax && JSON.stringify(toMax.att));
  ok('Kopie mit [Kopie]', copy && /^\[Kopie\]/.test(copy.subject), copy && copy.subject);
  const gast = mails.find(m => /gast@extern.de/.test(m.to)); ok('Freie Adresse mit Namen angesprochen', gast && /Hallo Gast/.test(gast.html), gast && gast.html.slice(0, 200));
  [s, j] = await A('api/admin/mail/messages?box=gesendet'); ok('Ordner Gesendet', j.rows.length === 1 && j.rows[0].files === 1 && j.rows[0].total === 3, JSON.stringify(j));
  [s, j] = await A(`api/admin/mail/drafts/${d1}`, 'PUT', { subject: 'neu' }); ok('Gesendete Mail nicht mehr änderbar', s === 404);
  const dl = await fetch(B + `api/admin/mail/messages/${d1}/files/${fid}`, { headers: { Cookie: ck } }); ok('Anhang herunterladen', dl.status === 200 && /attachment/.test(dl.headers.get('content-disposition')), dl.status);
  [s, j] = await A(`api/admin/mail/messages/${d1}/copy`, 'POST', {}); const d2 = j.id; ok('Weiterverwenden', s === 200 && d2 > d1);
  [s, j] = await A('api/admin/mail/messages/' + d2); ok('Kopie mit Anhang und Empfängern', j.status === 'entwurf' && j.files.length === 1 && j.spec.groups.length === 1, JSON.stringify(j).slice(0, 200));
  [s, j] = await A('api/admin/mail/messages?box=entwuerfe'); ok('Ordner Entwürfe', j.rows.length === 1 && j.drafts === 1);
  [s, j] = await A('api/admin/mail/drafts/' + d2, 'DELETE'); ok('Entwurf verworfen', s === 200);
  // Verteiler und Vorlagen
  [s, j] = await A('api/admin/mail/lists', 'POST', { name: 'Trainer', spec: { groups: [{ t: 'func', v: 'Trainer' }], addresses: ['coach@verband.de'] } }); const lT = j.id; ok('Verteiler angelegt', s === 200 && lT > 0, JSON.stringify(j));
  [s, j] = await A('api/admin/mail/lists', 'POST', { name: 'Leer', spec: {} }); ok('Leerer Verteiler abgelehnt', s === 400);
  [s, j] = await A('api/admin/mail/drafts', 'POST', { subject: 'Trainersitzung', html: '<p>Hallo {vorname}</p>', spec: { lists: [lT] }, copy_me: false }); const d3 = j.id;
  [s, j] = await A(`api/admin/mail/drafts/${d3}/preview`, 'POST', {}); ok('Verteiler aufgelöst', j.count === 2 && j.rcpt.some(r => r.email === 'eva@test.de') && j.rcpt.some(r => r.email === 'coach@verband.de'), JSON.stringify(j.rcpt));
  [s, j] = await A('api/admin/mail/templates', 'POST', { name: 'Einladung MV', subject: 'Einladung', html: '<p>{briefanrede}</p>' }); ok('Vorlage angelegt', s === 200);
  [s, j] = await A('api/admin/mail/options'); ok('Vorlagen und Verteiler in den Optionen', j.templates.length === 1 && j.lists.length === 1 && j.lists[0].spec.addresses[0] === 'coach@verband.de');
  // Fehler beim Versand → teilweise, erneut senden
  await A('api/admin/mail', 'PUT', { host: '127.0.0.1', port: 2599, user: '', from: 'verein@test.de' });
  [s, j] = await A(`api/admin/mail/drafts/${d3}/send`, 'POST', {}); ok('Versand gestartet (Server weg)', s === 200);
  let m3 = await waitSent(d3); ok('Teilweise/fehlgeschlagen erkannt', m3 && m3.status === 'teilweise' && m3.failed === 2, JSON.stringify(m3 && { st: m3.status, f: m3.failed, rc: m3.rcpt }));
  await A('api/admin/mail', 'PUT', { host: '127.0.0.1', port: 2525, user: '', from: 'verein@test.de' });
  [s, j] = await A(`api/admin/mail/messages/${d3}/retry`, 'POST', {}); ok('Erneut senden', s === 200 && j.n === 2, JSON.stringify(j));
  m3 = await waitSent(d3); ok('Danach zugestellt', m3 && m3.status === 'gesendet' && m3.sent === 2, JSON.stringify(m3 && { st: m3.status, s: m3.sent }));
  // Rechte: ohne „E-Mail“ nichts, Abteilungs-Rolle nur eigene Abteilung
  [s, j] = await A('api/admin/roles', 'POST', { name: 'Abteilung Mail', perms: ['email'], dept_scope: 1 }); const rid = j.id;
  [s, j] = await A('api/admin/users', 'POST', { username: 'tennis', name: 'Tina Tennis', password: 'Test-Kennwort-42x', roles: [rid], departments: [dTen] }); ok('Abteilungsbenutzer', s === 200, JSON.stringify(j));
  [s, j] = await A('api/admin/users', 'POST', { username: 'theke', name: 'Theo Theke', password: 'Test-Kennwort-42x', perms: ['buchungen'] });
  const ck0 = ck; ck = '';
  await A('api/admin/login', 'POST', { username: 'theke', password: 'Test-Kennwort-42x' });
  [s, j] = await A('api/admin/mail/options'); ok('Ohne Recht „E-Mail“ gesperrt', s === 403, s);
  ck = '';
  await A('api/admin/login', 'POST', { username: 'tennis', password: 'Test-Kennwort-42x' });
  [s, j] = await A('api/admin/mail/options'); ok('Abteilung: nur eigene Gruppe und Mitglieder', s === 200 && j.scoped && j.groups.length === 1 && j.groups[0].v === dTen && j.members.every(m => [eva, kid].includes(m.id)), JSON.stringify(j.groups) + JSON.stringify(j.members));
  [s, j] = await A('api/admin/mail/drafts', 'POST', { subject: 'Alle', html: '<p>Hallo zusammen</p>', spec: { groups: [{ t: 'status', v: 'aktuell' }], members: [max, ida] }, copy_me: false }); const d4 = j.id;
  [s, j] = await A(`api/admin/mail/drafts/${d4}/preview`, 'POST', {}); ok('Abteilung: fremde Mitglieder werden nicht erreicht', j.count === 2 && j.rcpt.every(r => r.email === 'eva@test.de' || r.email === 'max@test.de' && r.via), JSON.stringify(j.rcpt));
  [s, j] = await A('api/admin/mail/messages?box=gesendet'); ok('Abteilung sieht nur eigene gesendete Mails', s === 200 && j.rows.length === 0, JSON.stringify(j.rows.map(r => r.subject)));
  [s, j] = await A('api/admin/mail/messages/' + d1); ok('Fremde Mail nicht lesbar', s === 404);
  [s, j] = await A(`api/admin/mail/drafts/${d3}`, 'DELETE'); ok('Fremden Entwurf nicht löschbar', s === 404);
  ck = ck0;
  [s, j] = await A('api/admin/mail/messages/' + d4); ok('Entwürfe anderer bleiben privat', s === 404);
  // Löschen aus Gesendet
  [s, j] = await A('api/admin/mail/messages/' + d1, 'DELETE'); ok('Aus Gesendet gelöscht', s === 200 && !fs.existsSync(DATA + '/mail-anhaenge/' + d1));
  srv.kill(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
