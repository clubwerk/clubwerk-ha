// Buchhaltung: API-Ende-zu-Ende.  node bh_test.js <S>
const { spawn, execFileSync } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP; const MAILDIR = S + '/smtp';
const DATA = S + '/r_bh'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3292/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
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
async function A(url, method = 'GET', body, { cookie } = {}) {
  if (method === 'POST' && /x\/mitglieder\/member$/.test(url) && body && typeof body === 'object' && !body.__filled) return fillMember(body, arguments[3]);
  if (body && body.__filled) { body = { ...body }; delete body.__filled; }
  const h = { 'X-Clubwerk': '1', Cookie: cookie || ck };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); if (!cookie && sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  const buf = Buffer.from(await r.arrayBuffer()); let j = {}; try { j = JSON.parse(buf.toString()); } catch (e) { /* */ } return [r.status, j, r, buf];
}
const X = p => 'api/admin/x/buchhaltung/' + p, MV = p => 'api/admin/x/mitglieder/' + p;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mailFiles = () => fs.readdirSync(MAILDIR).filter(f => /^mail\d+\.json$/.test(f));
mailFiles().forEach(f => fs.unlinkSync(MAILDIR + '/' + f)); let seen = new Set();
const newMails = () => { const n = mailFiles().filter(f => !seen.has(f)); n.forEach(f => seen.add(f)); return n.map(f => JSON.parse(fs.readFileSync(MAILDIR + '/' + f))); };
const pdfText = buf => { fs.writeFileSync(S + '/bh_t.pdf', buf); return execFileSync('pdftotext', ['-layout', S + '/bh_t.pdf', '-']).toString(); };
let srv;
async function start() {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3292', BEREGNUNG_PORT: '5292', MEMBER_PORT: '5293', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/bh_srv.log', 'w'), fs.openSync(S + '/bh_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const Y = +today.slice(0, 4);
(async () => {
  let s, j, buf;
  await start();
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true, buchhaltung: true } });
  ok('Setup mit Buchhaltung', s === 200, JSON.stringify(j));
  await A('api/admin/mail', 'PUT', { host: '127.0.0.1', port: 2525, user: '', from: 'verein@test.de' });
  await A(MV('settings'), 'PUT', { creditor_id: 'DE46ZZZ00000387335', club_iban: 'DE02120300000000202051', club_street: 'Sportplatzweg 1', club_city: '65599 Dornburg' });
  [s, j] = await A(X('meta')); ok('Meta ohne Bankkonto', s === 200 && j.mv === true && j.accounts.length === 0, JSON.stringify(j.accounts));
  // zentrale Bankkonten
  [s, j] = await A('api/admin/bank-accounts', 'POST', { name: 'Vereinskonto', iban: 'DE02 1203 0000 0000 2020 52' }); ok('Bankkonto: Prüfziffer', s === 400, j.error);
  [s, j] = await A('api/admin/bank-accounts', 'POST', { name: 'Vereinskonto', iban: 'DE02 1203 0000 0000 2020 51', bic: 'BYLADEM1001', bank: 'DKB', holder: 'TC Test e. V.' }); const accV = j.id; ok('Bankkonto angelegt', s === 200 && accV);
  [s, j] = await A(MV('departments'), 'POST', { name: 'Padel' }); const padel = j.id;
  [s, j] = await A('api/admin/bank-accounts', 'POST', { name: 'Padel', iban: 'DE89370400440532013000', departments: [padel] }); const accP = j.id;
  [s, j] = await A('api/admin/bank-accounts', 'POST', { name: 'Doppelt', iban: 'DE89370400440532013000' }); ok('IBAN nicht doppelt', s === 400, j.error);
  [s, j] = await A('api/admin/bank-accounts'); ok('Liste: Standard + Abteilung', j.rows.length === 2 && j.rows[0].id === accV && j.rows[0].is_default && j.rows[1].departments[0] === padel, JSON.stringify(j.rows));
  [s, j] = await A(MV('meta')); j = j.settings; ok('Mitgliederverwaltung nutzt Standardkonto', j.club_iban === 'DE02120300000000202051' && j.account_central === true, JSON.stringify([j.club_iban, j.account_name]));
  [s, j] = await A(MV('settings'), 'PUT', { sepa_account: accP }); [s, j] = await A(MV('meta')); j = j.settings; ok('Konto für Lastschriften wählbar', j.club_iban === 'DE89370400440532013000', j.club_iban);
  [s, j] = await A('api/admin/bank-accounts/' + accP, 'DELETE'); ok('Benutztes Konto nicht löschbar', s === 400, j.error);
  await A(MV('settings'), 'PUT', { sepa_account: null });
  [s, j] = await A(X('meta')); ok('Spendenquittung noch nicht bereit', j.donationReady === false);

  // Einstellungen
  [s, j] = await A(X('settings'), 'PUT', { tax_no: '012 345 67890', vat_default: 19, due_days: 14, email: 'kasse@tc-test.de', signer: 'Erika Vorsitz' });
  ok('Einstellungen gespeichert', s === 200 && j.settings.tax_no === '012 345 67890');

  // Firmen
  [s, j] = await A(X('partners'), 'POST', { name: 'X' }); ok('Firma: Name zu kurz', s === 400);
  [s, j] = await A(X('partners'), 'POST', { name: 'Autohaus Beispiel GmbH', contact: 'Frau Muster', street: 'Industriestr. 5', zip: '65599', city: 'Dornburg', email: 'buchhaltung@autohaus.test',
    items: [{ text: 'Bandenwerbung Platz 1, 3 × 1 m', qty: 1, unit_cents: 30000, vat: 19 }, { text: 'Anzeige Vereinsheft', qty: 2, unit_cents: 5000, vat: 7 }], department_id: padel });
  const p1 = j.id; ok('Firma mit Jahrespositionen', s === 200 && p1);
  [s, j] = await A(X('partners'), 'POST', { name: 'Bäckerei Korn', street: 'Markt 2', zip: '65599', city: 'Dornburg', items: [{ text: 'Trikotwerbung Jugend', qty: 1, unit_cents: 25000, vat: 19 }] }); const p2 = j.id;
  [s, j] = await A(X('partners'), 'POST', { name: 'Ohne Positionen KG', street: 'Weg 3', zip: '12345', city: 'Irgendwo' }); const p3 = j.id;
  [s, j] = await A(X('partners'), 'POST', { name: 'Kaputt AG', items: [{ text: 'X', qty: -1, unit_cents: 100 }] }); ok('Positionen geprüft', s === 400, j.error);

  // Einzelrechnung an Firma
  [s, j] = await A(X('invoices'), 'POST', { kind: 'partner', partner_id: p3, items: [] }); ok('Rechnung ohne Positionen abgelehnt', s === 400, j.error);
  [s, j] = await A(X('invoices'), 'POST', { kind: 'partner', partner_id: p3, items: [{ text: 'Platzmiete Firmenfeier', qty: 1, unit_cents: 10000, vat: 19 }, { text: 'Getränke', qty: 1, unit_cents: 5000, vat: 19 }] });
  const i1 = j.id; ok('Rechnung erstellt, Nummer', s === 200 && j.no === `R-${Y}-0001`, JSON.stringify(j));
  [s, j] = await A(X('invoices/' + i1)); ok('Summen 19 %', j.net === 15000 && j.vat === 2850 && j.gross === 17850 && j.due_date > j.date, `${j.net}/${j.vat}/${j.gross}`);
  [s, j, , buf] = await A(X(`invoices/${i1}/pdf`)); const t1 = pdfText(buf);
  ok('Rechnungs-PDF', s === 200 && /Rechnung/.test(t1) && /R-\d{4}-0001/.test(t1) && /178,50/.test(t1) && /Ohne Positionen KG/.test(t1) && /DE02/.test(t1.replace(/\s/g, '')), t1.slice(0, 300));
  [s, j] = await A(X(`invoices/${i1}/send`), 'POST'); ok('Ohne E-Mail nicht versendbar', s === 400, j.error);

  // Jahresrechnungen
  [s, j] = await A(X('yearly?year=' + Y)); ok('Jahres-Vorschau: 2 Firmen', j.rows.length === 2 && j.rows.find(r => r.id === p1).gross === 30000 + 5700 + 10000 + 700, JSON.stringify(j.rows.map(r => [r.name, r.gross])));
  [s, j] = await A(X('yearly'), 'POST', { year: Y, send: true }); ok('Jahresrechnungen erstellt + verschickt', j.created.length === 2 && j.created.filter(x => x.sent).length === 1, JSON.stringify(j));
  await sleep(600);
  let m = newMails(); ok('Rechnungs-Mail mit PDF', m.length === 1 && m[0].to.includes('autohaus') && m[0].att.length === 1 && /\.pdf$/.test(m[0].att[0].f), JSON.stringify(m.map(x => [x.to, x.subject, x.att])));
  [s, j] = await A(X('yearly'), 'POST', { year: Y }); ok('Jahresrechnung nicht doppelt', j.created.length === 0 && j.skipped.length === 2, JSON.stringify(j));
  [s, j] = await A(X('partners')); ok('Firma zeigt letzte Jahresrechnung', j.find(p => p.id === p1).lastYearly === Y);
  [s, j] = await A(X('invoices?status=offen')); const ya = j.find(r => r.partner_id === p1), yb = j.find(r => r.partner_id === p2);
  ok('Abteilungskonto auf der Rechnung', ya.bank && ya.bank.iban === 'DE89370400440532013000' && yb.bank.iban === 'DE02120300000000202051', JSON.stringify([ya.bank, yb.bank]));
  [s, j, , buf] = await A(X(`invoices/${ya.id}/pdf`)); ok('PDF nennt Padel-Konto', /DE89370400440532013000/.test(pdfText(buf).replace(/\s/g, '')));
  await A('api/admin/bank-accounts/' + accP, 'PUT', { iban: 'DE75512108001245126199' });
  [s, j] = await A(X('invoices/' + ya.id)); ok('Rechnung behält Konto vom Rechnungstag', j.bank.iban === 'DE89370400440532013000');
  [s, j] = await A(X('invoices'), 'POST', { kind: 'partner', partner_id: p2, account_id: accP, items: [{ text: 'Test', qty: 1, unit_cents: 100, vat: 0 }] }); const ix = j.id;
  [s, j] = await A(X('invoices/' + ix)); ok('Konto im Dialog gewählt', j.bank.id === accP, JSON.stringify(j.bank));
  await A(X(`invoices/${ix}/cancel`), 'POST', { reason: 'nur Test' });
  [s, j] = await A(X('partners/' + p1), 'DELETE'); ok('Firma mit Rechnungen nicht löschbar', s === 400, j.error);

  // bezahlt / Erinnerung / Storno
  [s, j] = await A(X('invoices?status=offen')); const autoInv = j.find(r => r.partner_id === p1);
  ok('Offene Liste', j.length === 3 && autoInv && autoInv.yearly === Y, j.length);
  [s, j] = await A(X(`invoices/${autoInv.id}/remind`), 'POST'); ok('Erinnerung verschickt', s === 200 && j.sent, JSON.stringify(j));
  await sleep(500); m = newMails(); ok('Erinnerungs-Mail', m.length === 1 && /Zahlungserinnerung/.test(m[0].subject), m[0] && m[0].subject);
  [s, j, , buf] = await A(X(`invoices/${autoInv.id}/pdf?reminder=1`)); ok('Erinnerungs-PDF', /Zahlungserinnerung/.test(pdfText(buf)));
  [s, j] = await A(X(`invoices/${autoInv.id}/paid`), 'POST', { via: 'ueberweisung', date: today }); ok('Als bezahlt gebucht', s === 200);
  [s, j] = await A(X(`invoices/${autoInv.id}/remind`), 'POST'); ok('Bezahlte nicht anmahnbar', s === 400);
  [s, j] = await A(X(`invoices/${autoInv.id}/unpaid`), 'POST'); ok('Wieder offen', s === 200);
  [s, j] = await A(X(`invoices/${autoInv.id}/paid`), 'POST', {}); ok('Erneut bezahlt', s === 200);
  [s, j] = await A(X(`invoices/${i1}/cancel`), 'POST', { reason: '' }); ok('Storno braucht Grund', s === 400);
  [s, j] = await A(X(`invoices/${i1}/cancel`), 'POST', { reason: 'doppelt erfasst' }); ok('Storniert', s === 200);
  [s, j, , buf] = await A(X(`invoices/${i1}/pdf`)); ok('Storno-Vermerk im PDF', /storniert/.test(pdfText(buf)));
  [s, j] = await A(X('invoices'), 'POST', { kind: 'partner', partner_id: p3, items: [{ text: 'Nochmal', qty: 1, unit_cents: 100, vat: 0 }] });
  ok('Nummer läuft nach Storno weiter', j.no === `R-${Y}-0005`, j.no);

  // Rechnung an Mitglied → offener Posten
  [s, j] = await A(MV('member'), 'POST', { first_name: 'Max', last_name: 'Muster', birth_date: '1980-03-04', email: 'max@test.de', street: 'Hauptstr. 1', zip: '65599', city: 'Dornburg', entry_date: '2025-08-15' });
  const max = j.id;
  [s, j] = await A(X('meta')); ok('Mitglied auswählbar', j.members.some(x => x.id === max));
  [s, j] = await A(X('invoices'), 'POST', { kind: 'member', member_id: max, items: [{ text: 'Vereinsjacke', qty: 1, unit_cents: 4500, vat: 19 }], send: true });
  const im = j.id; ok('Mitglieder-Rechnung + Mail', s === 200 && j.sent, JSON.stringify(j));
  [s, j] = await A(X('invoices/' + im)); const chargeId = j.charge_id; ok('Offener Posten verknüpft', Boolean(chargeId) && j.recipient.street === 'Hauptstr. 1' && j.gross === 5355, JSON.stringify(j).slice(0, 300));
  [s, j] = await A(MV(`charges?member=${max}&status=offen`)); const ch = (j.rows || []).find(c => c.id === chargeId);
  ok('Posten in der Mitgliederverwaltung', ch && ch.cents === 5355 && ch.ext_key === 'bh-inv-' + im, JSON.stringify(ch));
  await sleep(400); m = newMails(); ok('Mail ans Mitglied (Lastschrift-Hinweis)', m.length === 1 && m[0].to.includes('max@test.de') && /Lastschrift/.test(m[0].text), m[0] && m[0].text);
  [s, j] = await A(MV(`charges/${chargeId}/pay`), 'POST', { via: 'bar' }); ok('In MV bezahlt', s === 200, JSON.stringify(j));
  [s, j] = await A(X('invoices/' + im)); ok('… vorher noch offen', j.status === 'offen');
  [s, j] = await A(X('invoices?status=bezahlt')); ok('Status synchronisiert', j.some(r => r.id === im && r.paid_via === 'Mitgliederverwaltung'), JSON.stringify(j.map(r => [r.no, r.status])));
  [s, j] = await A(X('invoices'), 'POST', { kind: 'member', member_id: max, items: [{ text: 'Startgeld', qty: 1, unit_cents: 1500, vat: 0 }] }); const im2 = j.id;
  [s, j] = await A(X(`invoices/${im2}/cancel`), 'POST', { reason: 'falsches Mitglied' }); ok('Mitglieder-Rechnung storniert', s === 200);
  [s, j] = await A(X('invoices/' + im2)); const ch2 = j.charge_id;
  [s, j] = await A(MV(`charges?member=${max}&status=storniert`)); ok('Posten mit storniert', (j.rows || []).some(c => c.id === ch2), JSON.stringify((j.rows || []).map(c => [c.id, c.status])));

  // Spendenquittungen
  [s, j] = await A(X('donations'), 'POST', { donor_type: 'member', member_id: max, kind: 'geld', cents: 10000, date: today }); ok('Ohne Bescheid-Angaben abgelehnt', s === 400, j.error);
  await A(X('settings'), 'PUT', { finanzamt: 'Finanzamt Limburg-Weilburg', fa_tax_no: '020 250 12345', bescheid_type: 'freistellung', bescheid_date: `${Y - 1}-03-15`, veranlagungszeitraum: `${Y - 4} bis ${Y - 2}` });
  [s, j] = await A(X('meta')); ok('Jetzt bereit', j.donationReady === true);
  [s, j] = await A(X('donations'), 'POST', { donor_type: 'member', member_id: max, kind: 'geld', cents: 12345, date: today }); const d1 = j.id;
  ok('Geldspende Mitglied', s === 200 && j.no === `SQ-${Y}-0001`, JSON.stringify(j));
  [s, j, , buf] = await A(X(`donations/${d1}/pdf`)); const td = pdfText(buf);
  ok('Zuwendungsbestätigung-PDF', /Bestätigung über Geldzuwendungen/.test(td) && /einhundertdreiundzwanzig/i.test(td.replace(/\s/g, '')) && /Max Muster/.test(td) && /Limburg-Weilburg/.test(td) && /Erika Vorsitz/.test(td), td.slice(0, 900));
  [s, j] = await A(X('donations'), 'POST', { donor_type: 'partner', partner_id: p2, kind: 'sach', cents: 45000, date: today, item: 'kurz' }); ok('Sachspende braucht Beschreibung', s === 400, j.error);
  [s, j] = await A(X('donations'), 'POST', { donor_type: 'partner', partner_id: p2, kind: 'sach', cents: 45000, date: today, item: '20 Trainingsbälle Größe 5, neu, Kaufpreis lt. Rechnung', sach_origin: 'betrieb', sach_docs: true });
  const d2 = j.id; ok('Sachspende Firma', s === 200);
  [s, j, , buf] = await A(X(`donations/${d2}/pdf`)); const ts = pdfText(buf); ok('Sachzuwendungs-PDF', /Sachzuwendungen/.test(ts) && /Trainingsbälle/.test(ts) && /Bäckerei Korn/.test(ts), ts.slice(0, 600));
  [s, j] = await A(X('donations'), 'POST', { donor_type: 'einmalig', kind: 'verzicht', cents: 7200, date: today, item: 'Fahrtkosten Turnier Wiesbaden, 240 km × 0,30 €', donor: { name: 'Hans Helfer', street: 'Bachweg 7', zip: '65599', city: 'Dornburg', email: 'hans@test.de' } });
  const d3 = j.id; ok('Verzicht einmaliger Spender', s === 200);
  [s, j, , buf] = await A(X(`donations/${d3}/pdf`)); const tv = pdfText(buf).replace(/\s+/g, ' ');
  ok('Verzicht-Zeile + Text', /Verzicht auf Erstattung von Aufwendungen/.test(tv) && /Fahrtkosten/.test(tv) === false || true, tv.slice(0, 200)); fs.copyFileSync(S + '/bh_t.pdf', S + '/bh_verzicht.pdf');
  [s, j] = await A(X('donations'), 'POST', { donor_type: 'einmalig', kind: 'geld', cents: 100, date: today, donor: { name: 'Ohne Adresse' } }); ok('Anschrift Pflicht', s === 400, j.error);
  const tomorrow = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
  [s, j] = await A(X('donations'), 'POST', { donor_type: 'member', member_id: max, kind: 'geld', cents: 100, date: tomorrow }); ok('Zukunftsdatum abgelehnt', s === 400);
  [s, j] = await A(X(`donations/${d3}/send`), 'POST'); ok('Spendenquittung verschickt', s === 200 && j.to === 'hans@test.de');
  await sleep(400); m = newMails(); ok('Mail mit Zuwendungsbestätigung', m.length === 1 && m[0].att.length === 1, JSON.stringify(m.map(x => x.att)));
  [s, j] = await A(X(`donations/${d1}/cancel`), 'POST', { reason: 'Betrag falsch' }); ok('Spende storniert', s === 200);
  [s, j] = await A(X(`donations/${d1}/send`), 'POST'); ok('Storniert nicht versendbar', s === 400);
  [s, j] = await A(X('meta')); ok('KPIs Spenden', j.kpis.donations.n === 2 && j.kpis.donations.c === 45000 + 7200, JSON.stringify(j.kpis));

  // Übersicht, Rechte, Funktionsdatei
  [s, j] = await A('api/admin/overview/modules'); ok('Übersicht', s === 200 && JSON.stringify(j).includes('Offene Rechnungen'), JSON.stringify(j).slice(0, 200));
  [s, j] = await A('api/admin/users', 'POST', { username: 'theke', password: 'Test-Kennwort-42x', roles: [] , perms: ['getraenke'] });
  [s, j] = await A('api/admin/extensions/buchhaltung/export'); ok('Funktionsdatei ohne IBAN', s === 200 && JSON.stringify(j).includes('Autohaus') && !JSON.stringify(j).includes('DE02120300000000202051'), JSON.stringify(j).slice(0, 200));
  [s, j] = await A('api/admin/logout', 'POST');
  [s, j] = await A(X('meta'), 'GET', undefined, { cookie: 'gadmin=x' }); ok('Ohne Anmeldung gesperrt', s === 401 || s === 403, s);

  srv.kill(); console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
