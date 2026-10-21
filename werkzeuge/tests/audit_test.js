// Fachaudit Bereiche 6–9: Getränkebuchungen, Abrechnung, SEPA, Platzbuchung.  node audit_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_audit'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3370/', MB = 'http://127.0.0.1:5371/'; let fails = 0, n = 0;
const ok = (id, name, c, x = '') => { n++; console.log(`${c ? '✔' : '✘'} ${id} ${name}${x ? '  ' + String(x).slice(0, 300) : ''}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ck = '';
async function A(url, method = 'GET', body, { base = B, dev, raw, headers = {} } = {}) {
  const h = { 'X-Clubwerk': '1', Cookie: base === B ? ck : '', ...headers }; if (dev) h['X-Geraet'] = dev;
  if (body !== undefined) h['Content-Type'] = raw ? 'application/octet-stream' : 'application/json';
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('json')) return [r.status, await r.json()];
  return [r.status, {}, Buffer.from(await r.arrayBuffer())];
}
const T = (url, body) => A(url, 'POST', body);   // Tablet (ohne Cookie nötig, Cookie stört nicht)
const X = p => 'api/admin/x/mitglieder/' + p, K = p => 'api/admin/x/buchung/' + p, AP = p => 'api/m/buchung/' + p;
const pad = v => String(v).padStart(2, '0');
const dayPlus = k => { const d = new Date(); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const mod97 = s => { const d = s.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55)); let r = 0; for (let i = 0; i < d.length; i += 7) r = Number(String(r) + d.slice(i, i + 7)) % 97; return r; };
const ibanOk = i => mod97(i.slice(4) + i.slice(0, 4)) === 1;
const tags = (xml, t) => [...xml.matchAll(new RegExp(`<${t}(?: [^>]*)?>([^<]*)</${t}>`, 'g'))].map(m => m[1]);

let fee = null;
async function newMember(b) {
  const doc = (await A(X('member/new-document'), 'POST', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(4)), { raw: true, headers: { 'X-Filename': 'antrag.pdf' } }))[1];
  const full = { doc_id: doc.doc_id, last_name: 'Test', birth_date: '1980-01-01', street: 'Weg 1', zip: '12345', city: 'Ort', mobile: '0170 1234567', fee_id: fee,
    email: `${b.first_name.toLowerCase()}${Math.random().toString(36).slice(2, 6)}@test.de`, payment: b.iban ? 'lastschrift' : 'rechnung', ...b };
  return A(X('member'), 'POST', full);
}
const unlock = async (id, pin) => (await T('api/tablet/unlock', pin ? { memberId: id, pin } : { memberId: id }))[1];
const balanceOf = async id => { const [, j] = await A('api/admin/balances'); const r = j.rows.find(x => x.id === id); return r ? r.total_cents : 0; };
const bookingsOf = async (memberId, from = '2000-01-01') => (await A(`api/admin/bookings?from=${from}&to=${dayPlus(0)}&memberId=${memberId}`))[1].rows;

let srv;
(async () => {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3370', BEREGNUNG_PORT: '5370', MEMBER_PORT: '5371', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/audit_srv.log', 'w'), fs.openSync(S + '/audit_srv.log', 'a')] });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) break; } catch (e) { /* */ } await sleep(250); }
  let s, j;
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Audit', password: 'Test-Kennwort-42', modules: { getraenke: true, buchung: true, mitglieder: true } }); ok('S0', 'Setup', s === 200, JSON.stringify(j));
  [s, j] = await A(X('settings'), 'PUT', { creditor_id: 'DE98ZZZ09999999999', club_iban: 'DE02120300000000202051', club_bic: 'BYLADEM1001', mandate_prefix: 'TCA', creditor_name: 'TC Audit & Söhne e.V.' }); ok('S1', 'SEPA-Einstellungen', s === 200, j.error);
  [s, j] = await A(X('fees'), 'POST', { name: 'Erwachsene', cents: 12000, interval: 'jahr', kind: 'grund' }); fee = j.id; ok('S2', 'Beitragsart', s === 200 && fee, j.error);
  [s, j] = await newMember({ first_name: 'Anna', last_name: 'Alpha' }); const anna = j.id; ok('S3', 'Mitglied Anna (Rechnung)', s === 200 && anna, j.error);
  [s, j] = await newMember({ first_name: 'Bernd', last_name: 'Beta', iban: 'DE89 3704 0044 0532 0130 00', holder: 'Bernd & Söhne <Beta> "Ü"', mandate_date: '2025-01-10' }); const bernd = j.id; ok('S4', 'Mitglied Bernd (Lastschrift, Sonderzeichen im Kontoinhaber)', s === 200 && bernd, j.error);
  [s, j] = await newMember({ first_name: 'Carla', last_name: 'Gamma', payment: 'lastschrift' }); ok('S5a', 'Neues Mitglied Lastschrift ohne IBAN abgelehnt', s === 400, j.error);
  [s, j] = await newMember({ first_name: 'Carla', last_name: 'Gamma' }); const carla = j.id; ok('S5', 'Mitglied Carla', s === 200 && carla, j.error);
  [s, j] = await A(X(`member/${carla}`), 'PUT', { payment: 'lastschrift' }); ok('S5b', 'Carla auf Lastschrift umgestellt (ohne Mandat)', s === 200, j.error);
  [s, j] = await A('api/admin/articles', 'POST', { name: 'Audit-Wasser', category: 'Alkoholfrei', price_cents: 250 }); const artA = j.id;
  [s, j] = await A('api/admin/articles', 'POST', { name: 'Audit-Bier', category: 'Bier', price_cents: 333 }); const artB = j.id; ok('S6', 'Artikel angelegt', artA && artB);
  // PINs setzen (für Kontoansicht am Tablet)
  for (const [id, pin] of [[anna, '1111'], [bernd, '2222'], [carla, '3333']]) { const u = await unlock(id); await T('api/tablet/pin', { token: u.token, newPin: pin }); }

  /* ================================================================= 6 Getränkebuchungen */
  const book = async (id, pin, items) => { const u = await unlock(id, pin); return T('api/tablet/book', { token: u.token, items }); };
  [s, j] = await book(anna, '1111', [{ articleId: artA, qty: 3 }, { articleId: artB, qty: 2 }, { custom: true, cents: 199, note: 'Chips & Co <x>' }]);
  const exp1 = 3 * 250 + 2 * 333 + 199;
  ok('T6.01', 'Mehrfachbuchung: Summe selbst nachgerechnet', s === 200 && j.total_cents === exp1 && j.bookings.length === 3, `${s} ${j.total_cents} vs ${exp1}`);
  ok('T6.02', 'Saldo (Verwaltung) = Buchungssumme', (await balanceOf(anna)) === exp1, await balanceOf(anna));
  let ids1 = j.bookings.map(b => b.id);
  for (const [q, items] of [['qty 0', [{ articleId: artA, qty: 0 }]], ['qty 100', [{ articleId: artA, qty: 100 }]], ['qty -1', [{ articleId: artA, qty: -1 }]], ['qty abc', [{ articleId: artA, qty: 'abc' }]], ['qty 1e9', [{ articleId: artA, qty: 1e9 }]],
    ['custom 5 ct', [{ custom: true, cents: 5 }]], ['custom 50001', [{ custom: true, cents: 50001 }]], ['custom -500', [{ custom: true, cents: -500 }]], ['custom leer', [{ custom: true }]], ['Artikel 999999', [{ articleId: 999999, qty: 1 }]], ['leer', []]]) {
    [s, j] = await book(anna, '1111', items); ok('T6.03', `Ungültig abgelehnt: ${q}`, s === 400, `${s} ${j.error || ''}`);
  }
  const before = await balanceOf(anna);
  [s, j] = await book(anna, '1111', [{ articleId: artA, qty: 1 }, { articleId: 999999, qty: 1 }]);
  ok('T6.04', 'Gemischte Anfrage (gültig+ungültig): nichts gebucht (Transaktion)', s === 400 && (await balanceOf(anna)) === before, `${s} ${await balanceOf(anna)} vs ${before}`);
  [s, j] = await book(anna, '1111', Array.from({ length: 31 }, () => ({ articleId: artA, qty: 1 })));
  ok('T6.05', '31 Positionen abgelehnt', s === 400 && (await balanceOf(anna)) === before, s);
  [s, j] = await book(anna, '1111', [{ articleId: artA, qty: 2.9 }, { custom: true, cents: 199.99 }]);
  ok('T6.06', 'Nachkommastellen (qty 2.9, cents 199.99) werden abgewiesen, nichts gebucht', s === 400 && (await balanceOf(anna)) === before, `${s} ${j.error || j.total_cents}`);
  [s, j] = await book(anna, '1111', [{ articleId: artA, qty: 2 }, { custom: true, cents: 199 }]);
  ok('T6.06b', 'Ganzzahlige Menge/Betrag weiter buchbar', s === 200 && j.total_cents === 2 * 250 + 199, `${s} ${j.total_cents}`);
  ids1 = ids1.concat(j.bookings.map(b => b.id));
  // Doppelanfrage (Doppeltipp): zwei identische Buchungen gleichzeitig
  { const u = await unlock(bernd, '2222'); const b0 = await balanceOf(bernd);
    const reqId = 'req' + Math.random().toString(36).slice(2, 14);
    const rs = await Promise.all([0, 1].map(() => T('api/tablet/book', { token: u.token, items: [{ articleId: artA, qty: 1 }], requestId: reqId })));
    const okN = rs.filter(r => r[0] === 200).length;
    ok('T6.07', 'Doppelanfrage mit gleicher requestId: beide Antworten ok, aber nur einmal gebucht', okN === 2 && rs[0][1].bookings[0].id === rs[1][1].bookings[0].id && (await balanceOf(bernd)) === b0 + 250, `${okN} ok, Saldo ${await balanceOf(bernd)} vs ${b0 + 250}`);
    { const [s3, j3] = await T('api/tablet/book', { token: u.token, items: [{ articleId: artA, qty: 1 }], requestId: reqId });
      ok('T6.07b', 'Spätere Wiederholung derselben requestId liefert das Erstergebnis', s3 === 200 && j3.bookings[0].id === rs[0][1].bookings[0].id && (await balanceOf(bernd)) === b0 + 250, `${s3} ${JSON.stringify(j3.bookings)}`); }
    { const [s3] = await T('api/tablet/book', { token: u.token, items: [{ articleId: artA, qty: 1 }], requestId: 'req' + Math.random().toString(36).slice(2, 14) });
      ok('T6.07c', 'Neue requestId bucht erneut', s3 === 200 && (await balanceOf(bernd)) === b0 + 500, `${s3} Saldo ${await balanceOf(bernd)}`); }
    // Undo durch Tablet: eigene Buchungen
    const bid = rs[1][1].bookings[0].id;
    [s, j] = await T('api/tablet/undo', { token: u.token, bookingIds: [bid] }); ok('T6.08', 'Tablet-Storno eigene Buchung', s === 200 && j.cancelled === 1 && (await balanceOf(bernd)) === b0 + 250, `${s} ${JSON.stringify(j)}`);
    [s, j] = await T('api/tablet/undo', { token: u.token, bookingIds: [bid] }); ok('T6.09', 'Zweites Storno derselben Buchung: 0 storniert (idempotent)', s === 200 && j.cancelled === 0, JSON.stringify(j));
    [s, j] = await T('api/tablet/undo', { token: u.token, bookingIds: [ids1[0]] }); ok('T6.10', 'Fremde Buchung am Tablet stornieren → 403', s === 403, `${s} ${j.error}`);
    const rows = await bookingsOf(bernd); const c = rows.find(r => r.id === bid);
    ok('T6.11', 'Storno nachvollziehbar (cancelled_at/by gesetzt)', c && c.cancelled_at && c.cancelled_by === 'tablet', JSON.stringify(c && [c.cancelled_at, c.cancelled_by]));
  }
  // Verwaltung: Storno + Doppelstorno
  [s, j] = await A(`api/admin/bookings/${ids1[1]}/cancel`, 'POST', {}); ok('T6.12', 'Verwaltung storniert', s === 200);
  [s, j] = await A(`api/admin/bookings/${ids1[1]}/cancel`, 'POST', {}); ok('T6.13', 'Doppelstorno → 409', s === 409, s);
  // Konsistenz Einzelbuchungen ↔ Salden ↔ Gesamtsumme
  { const [, bal] = await A('api/admin/balances'); const all = (await A(`api/admin/bookings?from=2000-01-01&to=${dayPlus(0)}`))[1].rows;
    const mine = {}; for (const r of all) if (r.kind === 'konto' && !r.cancelled_at && !r.settled_id) mine[r.member_id] = (mine[r.member_id] || 0) + r.total_cents;
    const same = bal.rows.every(r => mine[r.id] === r.total_cents) && Object.keys(mine).every(id => bal.rows.some(r => r.id === Number(id)));
    const tot = Object.values(mine).reduce((a, b) => a + b, 0);
    ok('T6.14', 'Salden je Konto = Summe Einzelbuchungen; Gesamtsumme stimmt', same && tot === bal.total_cents, `${tot} vs ${bal.total_cents}`);
    ok('T6.15', 'Einzelbuchung: total = unit × qty', all.every(r => r.total_cents === r.unit_cents * r.qty || r.kind === 'verein'), JSON.stringify(all.filter(r => r.total_cents !== r.unit_cents * r.qty).map(r => [r.id, r.unit_cents, r.qty, r.total_cents])));
  }
  // Deckel
  [s, j] = await T('api/tablet/tab', { name: 'Gastmannschaft SV Audit' }); const tabTok = j.token, tabId = j.tab.id; ok('T6.16', 'Deckel geöffnet', s === 200 && tabId);
  [s, j] = await T('api/tablet/book', { token: tabTok, items: [{ articleId: artA, qty: 2 }, { articleId: artB, qty: 1 }] }); ok('T6.17', 'Deckel-Buchung offen = 833', s === 200 && j.open_cents === 833 && j.kind === 'gast', JSON.stringify([s, j.open_cents, j.kind]));
  [s, j] = await T('api/tablet/tab/pay', { token: tabTok, method: 'bar' }); ok('T6.18', 'Deckel bar bezahlt = 833', s === 200 && j.cents === 833, JSON.stringify(j));
  [s, j] = await T('api/tablet/book', { token: tabTok, items: [{ articleId: artA, qty: 1 }] }); ok('T6.19', 'Nach Bezahlen keine Buchung mehr auf dem Deckel', s === 401, s);
  [s, j] = await A(`api/admin/tabs/${tabId}/reopen`, 'POST', {}); ok('T6.20', 'Deckel wieder geöffnet', s === 200);
  [s, j] = await A(`api/admin/tabs/${tabId}/transfer`, 'POST', { memberId: anna }); const a0 = await balanceOf(anna);
  ok('T6.21', 'Deckel auf Anna übernommen: Saldo +833', s === 200 && j.cents === 833 && a0 === before + 2 * 250 + 199 - (2 * 333) + 833, `${s} ${j.cents} Saldo ${a0}`);
  { const rows = await bookingsOf(anna); const tb = rows.filter(r => r.tab_id === tabId);
    ok('T6.22', 'Übernommene Deckelbuchungen: kind=konto, transferred_at gesetzt', tb.length === 2 && tb.every(r => r.kind === 'konto' && r.transferred_at && r.member_id === anna), JSON.stringify(tb.map(r => [r.kind, r.transferred_at])));
    const u = await unlock(anna, '1111');
    [s, j] = await T('api/tablet/undo', { token: u.token, bookingIds: tb.map(r => r.id) }); ok('T6.23', 'Übernommene Deckelbuchung am Tablet nicht stornierbar', s === 400, `${s} ${j.error}`); }
  // Veranstaltung
  [s, j] = await A('api/admin/events', 'POST', { name: 'Audit-Fest', date: dayPlus(0) }); const ev = j.id;
  [s, j] = await A(`api/admin/events/${ev}/articles`, 'PUT', { articles: [{ articleId: artA, price_cents: 300 }] });
  [s, j] = await A(`api/admin/events/${ev}/activate`, 'POST', {}); ok('T6.24', 'Veranstaltung aktiv', s === 200);
  [s, j] = await book(bernd, '2222', [{ articleId: artA, qty: 2 }]); ok('T6.25', 'Während Veranstaltung: Mitglied → Liste, Veranstaltungspreis 300', s === 200 && j.kind === 'event' && j.total_cents === 600 && j.guest, JSON.stringify([s, j.kind, j.total_cents]));
  const b1 = await balanceOf(bernd);
  [s, j] = await book(bernd, '2222', [{ articleId: artB, qty: 1 }]); ok('T6.26', 'Artikel nicht in Veranstaltungsliste → abgelehnt', s === 400, j.error);
  [s, j] = await A('api/admin/events'); let E = j.find(x => x.id === ev); const gB = E.guests.find(g => g.member_id === bernd);
  ok('T6.27', 'Veranstaltung: offen bei Bernd = 600, Gesamt = 600', gB && gB.open_cents === 600 && E.total_cents === 600 && E.open_cents === 600, JSON.stringify([gB && gB.open_cents, E.total_cents]));
  [s, j] = await book(bernd, '2222', [{ articleId: artA, qty: 1 }]);
  [s, j] = await A(`api/admin/events/${ev}/guests/${gB.id}/pay`, 'POST', { method: 'karte' }); ok('T6.28', 'Hat bezahlt (Karte) = 900', s === 200 && j.cents === 900, JSON.stringify(j));
  [s, j] = await A(`api/admin/events/${ev}/guests/${gB.id}/pay`, 'POST', { method: 'karte' }); ok('T6.29', 'Zweites „hat bezahlt“ → nichts offen', s === 400, j.error);
  [s, j] = await book(bernd, '2222', [{ articleId: artA, qty: 1 }]);
  [s, j] = await A(`api/admin/events/${ev}/transfer`, 'POST', {}); ok('T6.30', 'Übernahme offener 300 auf Konto', s === 200 && j.cents === 300 && j.transferred === 1, JSON.stringify(j));
  ok('T6.31', 'Saldo Bernd nach Übernahme +300', (await balanceOf(bernd)) === b1 + 300, `${await balanceOf(bernd)} vs ${b1 + 300}`);
  [s, j] = await A('api/admin/events'); E = j.find(x => x.id === ev);
  ok('T6.32', 'Veranstaltungs-Summen: karte 900, übernommen 300, offen 0, gesamt 1200', E.karte_cents === 900 && E.transferred_cents === 300 && E.open_cents === 0 && E.total_cents === 1200, JSON.stringify([E.karte_cents, E.transferred_cents, E.open_cents, E.total_cents]));
  [s, j] = await A(`api/admin/events/${ev}/close`, 'POST', { cash_cents: 0 }); ok('T6.33', 'Veranstaltung geschlossen', s === 200);
  [s, j] = await A(`api/admin/events/${ev}/guests/${gB.id}/pay`, 'POST', { method: 'bar' }); ok('T6.34', 'Nach Abschluss: „hat bezahlt“ wird abgelehnt (nichts offen)', s === 400, `${s} ${j.error}`);
  [s, j] = await A(`api/admin/events/${ev}/articles`, 'PUT', { articles: [] }); ok('T6.35', 'Nach Abschluss: Artikelliste nicht änderbar', s === 400, s);

  /* ================================================================= 7 Abrechnung (Verkauf) */
  { const [, bal] = await A('api/admin/balances'); const mySum = bal.rows.reduce((a, r) => a + r.total_cents, 0);
    const rs = await Promise.all([0, 1].map(() => A('api/admin/settle', 'POST', { asOf: bal.asOf, upTo: bal.upTo })));
    const okR = rs.filter(r => r[0] === 200);
    ok('T7.01', 'Abrechnungslauf zweimal gleichzeitig: genau einer erfolgreich', okR.length === 1, rs.map(r => r[0] + ' ' + JSON.stringify(r[1])).join(' | '));
    ok('T7.02', 'Abgerechnete Cents = selbst summierte Salden', okR[0] && okR[0][1].cents === mySum, `${okR[0] && okR[0][1].cents} vs ${mySum}`);
    const batch = okR[0] && okR[0][1].batch;
    [s, j] = await A('api/admin/settle', 'POST', { asOf: bal.asOf, upTo: bal.upTo }); ok('T7.03', 'Erneuter Lauf gleicher Stand → nichts Offenes', s === 400, j.error);
    [s, j] = await A('api/admin/balances'); ok('T7.04', 'Nach Lauf: alle Salden 0', j.rows.length === 0 && j.total_cents === 0, JSON.stringify(j.rows.map(r => [r.name, r.total_cents])));
    const all = (await A(`api/admin/bookings?from=2000-01-01&to=${dayPlus(0)}`))[1].rows.filter(r => r.kind === 'konto' && !r.cancelled_at);
    ok('T7.05', 'Jede offene Konto-Buchung genau einmal abgerechnet (settled_id gesetzt)', all.every(r => r.settled_id) , JSON.stringify(all.filter(r => !r.settled_id).map(r => r.id)));
    [s, j] = await A('api/admin/settle-history'); const h = j.find(r => r.batch === batch);
    ok('T7.06', 'Historie: Summe = Lauf, Rücknahme nur für jüngsten', h && h.cents === mySum && h.undo === true, JSON.stringify(h));
    // Buchung nach dem Stand: wird nicht mit altem Stand abgerechnet
    [s, j] = await book(anna, '1111', [{ articleId: artA, qty: 4 }]); const late = j.bookings[0].id;
    [s, j] = await A('api/admin/settle', 'POST', { asOf: bal.asOf, upTo: bal.upTo }); ok('T7.07', 'Buchung nach Stand: alter Stand rechnet sie nicht ab', s === 400 && (await balanceOf(anna)) === 1000, `${s} ${await balanceOf(anna)}`);
    [s, j] = await A('api/admin/settle', 'POST', { asOf: '2099-01-01 00:00:00', upTo: 99999999 }); ok('T7.08', 'Zukünftiger Stand abgelehnt', s === 400, j.error);
    // Storno einer abgerechneten Buchung → Gutschrift
    const settled = all.find(r => r.member_id === anna && r.total_cents > 0);
    [s, j] = await A(`api/admin/bookings/${settled.id}/cancel`, 'POST', {}); ok('T7.09', 'Storno abgerechneter Buchung → Gutschrift statt Storno', s === 200 && j.credit === true, JSON.stringify(j));
    ok('T7.10', 'Gutschrift mindert Saldo um genau den Betrag', (await balanceOf(anna)) === 1000 - settled.total_cents, `${await balanceOf(anna)} vs ${1000 - settled.total_cents}`);
    [s, j] = await A(`api/admin/bookings/${settled.id}/cancel`, 'POST', {}); ok('T7.11', 'Zweite Gutschrift verhindert', s === 400, j.error);
    [s, j] = await A(`api/admin/settle/${batch}`, 'DELETE'); ok('T7.12', 'Rücknahme nach Gutschrift blockiert', s === 400, j.error);
    // Tablet-Storno einer gerade abgerechneten Buchung (Fenster 2 Minuten)
    const [, bal2] = await A('api/admin/balances');
    [s, j] = await A('api/admin/settle', 'POST', { asOf: bal2.asOf, upTo: bal2.upTo, memberIds: [anna] }); const batch2 = j.batch; const settledCents = j.cents;
    ok('T7.13', 'Einzelabrechnung Anna', s === 200 && j.members === 1, JSON.stringify(j));
    const u = await unlock(anna, '1111');
    [s, j] = await T('api/tablet/undo', { token: u.token, bookingIds: [late] });
    const rowLate = (await bookingsOf(anna)).find(r => r.id === late);
    ok('T7.14', 'Tablet-Storno einer abgerechneten Buchung wird abgelehnt', s === 400 && !rowLate.cancelled_at, `${s} ${JSON.stringify(j)} settled_id=${rowLate.settled_id} cancelled=${rowLate.cancelled_at}`);
    [s, j] = await A('api/admin/settle-history'); const h2 = j.find(r => r.batch === batch2);
    const firstBatchIds = new Set(all.map(r => r.id));   // in Lauf 1 abgerechnet – der Rest mit settled_id gehört zu Lauf 2 (Zeitstempel können in derselben Sekunde liegen)
    const stillSettled = (await bookingsOf(anna)).filter(r => r.settled_id && !r.cancelled_at && r.kind === 'konto' && !firstBatchIds.has(r.id)).reduce((a, r) => a + r.total_cents, 0);
    ok('T7.15', 'Abrechnungsbetrag = Summe der (nicht stornierten) abgerechneten Buchungen', h2 && h2.cents === settledCents && stillSettled === settledCents, `Lauf ${settledCents}, Buchungen ${stillSettled}`);
    [s, j] = await A(`api/admin/settle/${batch}`, 'DELETE'); ok('T7.16', 'Ältere Abrechnung nicht rücknehmbar', s === 400, j.error);
    [s, j] = await A(`api/admin/settle/${batch2}`, 'DELETE'); ok('T7.17', 'Jüngste Abrechnung zurückgenommen', s === 200, j.error);
    ok('T7.18', 'Nach Rücknahme: Saldo wieder offen', (await balanceOf(anna)) === settledCents, `${await balanceOf(anna)} vs ${settledCents}`);
  }

  /* ================================================================= 7b Beitragslauf + Getränke (Mitgliederverwaltung) */
  let runId, chargeSum;
  { [s, j] = await A(X('runs/preview'), 'POST', { until: dayPlus(0), drinks: true });
    const pv = j; const my = pv.positions.reduce((a, p) => a + p.cents, 0);
    ok('T7.19', 'Vorschau: 3 Beiträge + Getränkeposition(en), Summe selbst gerechnet', pv.positions.filter(p => p.kind === 'beitrag').length === 3 && pv.positions.some(p => p.kind === 'getraenke') && my === pv.totals.cents, JSON.stringify(pv.positions.map(p => [p.kind, p.payer_name, p.cents])));
    const drinkPos = pv.positions.filter(p => p.kind === 'getraenke'); const [, bal] = await A('api/admin/balances');
    ok('T7.20', 'Getränkepositionen = offene Salden', drinkPos.every(p => (bal.rows.find(r => r.id === p.drinks_member) || {}).total_cents === p.cents), JSON.stringify(drinkPos.map(p => [p.for_name, p.cents])));
    const rs = await Promise.all([0, 1].map(() => A(X('runs'), 'POST', { until: dayPlus(0), drinks: true })));
    const okR = rs.filter(r => r[0] === 200);
    [s, j] = await A(X('charges?status=offen'));
    ok('T7.21', 'Beitragslauf zweimal gleichzeitig: Posten nicht doppelt', j.sum === my, `${okR.length} Läufe ok, offen ${j.sum} vs ${my} (${j.rows.length} Posten)`);
    runId = okR[0] && okR[0][1].run; chargeSum = my;
    [s, j] = await A(X('runs/preview'), 'POST', { until: dayPlus(0), drinks: true }); ok('T7.22', 'Nach Lauf: Vorschau leer', j.positions.length === 0, j.positions.map(p => p.text).join('|'));
    [s, j] = await A('api/admin/balances'); ok('T7.23', 'Getränke durch Beitragslauf abgerechnet (Salden 0)', j.total_cents === 0, j.total_cents);
    [s, j] = await A(X('runs')); const r = j.find(x => x.id === runId); ok('T7.24', 'Lauf in Historie, rücknehmbar', r && r.cents === my && r.undo === true, JSON.stringify(r));
    if (okR.length > 1) { for (const x of okR.slice(1)) await A(X('runs/' + x[1].run), 'DELETE'); }
    [s, j] = await A(X('runs/' + runId), 'DELETE'); ok('T7.25', 'Lauf zurückgenommen', s === 200, j.error);
    [s, j] = await A(X('runs/preview'), 'POST', { until: dayPlus(0), drinks: true }); ok('T7.26', 'Nach Rücknahme alles wieder offen (inkl. Getränke)', j.totals.cents === my, `${j.totals.cents} vs ${my}`);
    [s, j] = await book(bernd, '2222', [{ articleId: artA, qty: 1 }]); const bNew = j.bookings[0].id;
    [s, j] = await A(X('runs'), 'POST', { until: dayPlus(0), drinks: true }); runId = j.run; ok('T7.27', 'Lauf erneut (inkl. neuer Getränkebuchung 250)', s === 200 && j.cents === my + 250, JSON.stringify(j));
    // Änderung nach dem Lauf: Getränke-Buchung storniert → Gutschrift, Posten bleibt
    [s, j] = await A(`api/admin/bookings/${bNew}/cancel`, 'POST', {}); ok('T7.28', 'Storno nach Lauf → Gutschrift für nächste Abrechnung', s === 200 && j.credit, JSON.stringify(j));
    [s, j] = await A(X('runs/' + runId), 'DELETE'); ok('T7.29', 'Lauf mit Gutschrift aus seinem Einzug nicht mehr rücknehmbar', s === 400, j.error);
    [s, j] = await A(X('charges?status=offen')); ok('T7.30', 'Posten des Laufs unverändert offen (Gutschrift kommt erst beim nächsten Lauf)', j.sum === my + 250 && j.rows.some(r => r.kind === 'getraenke' && r.member_id === bernd && r.cents === 250), `${j.sum} ${JSON.stringify(j.rows.map(r => [r.kind, r.member_id, r.cents]))}`);
  }

  /* ================================================================= 8 SEPA */
  let coll, xml;
  { [s, j] = await A(X('collections/preview'), 'POST', { date: dayPlus(0) });
    const plan = j;
    ok('T8.01', 'Plan: Bernd einziehbar, Anna Rechnung (other), Carla ohne Mandat (problem)', plan.ok.length === 1 && plan.ok[0].member_id === bernd && plan.other.some(x => x.member_id === anna) && plan.problems.some(x => x.member_id === carla), JSON.stringify({ ok: plan.ok.map(x => x.name), o: plan.other.map(x => x.name), p: plan.problems.map(x => [x.name, x.reason]) }));
    [s, j] = await A(X('collections'), 'POST', { date: dayPlus(0) }); ok('T8.02', 'Zu früh / Vorabinfo → 409 oder Nicht-Bankarbeitstag → 400', s === 409 || s === 400, `${s} ${j.error}`);
    const earliest = plan.earliest;
    [s, j] = await A(X('collections'), 'POST', { date: earliest, skip: [bernd] }); ok('T8.03', 'Nur ausgewählte: alle abgewählt → keine Datei', s === 400, j.error);
    const expectCents = plan.ok[0].cents;
    [s, j] = await A(X('collections'), 'POST', { date: earliest }); coll = j.id; ok('T8.04', 'Einzug erstellt', s === 200 && coll, j.error);
    let buf; [s, , buf] = await A(X(`collections/${coll}/xml`)); xml = buf.toString('utf8');
    ok('T8.05', 'XML geliefert, pain.008.001.08 (nicht .02 – Hinweis)', s === 200 && /xmlns="urn:iso:std:iso:20022:tech:xsd:pain\.008\.001\.08"/.test(xml), xml.slice(0, 120));
    // Wohlgeformtheit (einfach): Tags balanciert, keine rohen & < in Textknoten
    const open = [...xml.matchAll(/<([A-Za-z]\w*)(?:\s[^>]*)?>/g)].filter(m => !m[0].endsWith('/>')).map(m => m[1]), close = [...xml.matchAll(/<\/([A-Za-z][\w]*)>/g)].map(m => m[1]);
    const texts = [...xml.matchAll(/>([^<]+)</g)].map(m => m[1]);
    ok('T8.06', 'Wohlgeformt (Tags balanciert, keine rohen & oder < im Text)', open.length === close.length && open.every(t => close.includes(t)) && texts.every(t => !/&(?!amp;|lt;|gt;|quot;|apos;)|</.test(t)), `${open.length}/${close.length}`);
    const nb = tags(xml, 'NbOfTxs').map(Number), cs = tags(xml, 'CtrlSum'), amts = tags(xml, 'InstdAmt');
    const sumAmt = amts.reduce((a, v) => a + Math.round(Number(v) * 100), 0);
    ok('T8.07', 'GrpHdr NbOfTxs = Summe PmtInf = Anzahl Transaktionen', nb[0] === amts.length && nb.slice(1).reduce((a, b) => a + b, 0) === nb[0], JSON.stringify(nb));
    ok('T8.08', 'GrpHdr CtrlSum = Summe InstdAmt = erwarteter Betrag (2 Nachkommastellen)', cs[0] === (expectCents / 100).toFixed(2) && sumAmt === expectCents && cs.every(v => /^\d+\.\d{2}$/.test(v)), JSON.stringify([cs, expectCents]));
    ok('T8.09', 'Alle Beträge > 0 und Format n.nn', amts.every(v => /^\d+\.\d{2}$/.test(v) && Number(v) > 0), JSON.stringify(amts));
    const ibans = tags(xml, 'IBAN');
    ok('T8.10', 'IBANs im XML prüfsummenrichtig (eigene mod97), ohne Leerzeichen', ibans.length === 2 && ibans.every(i => /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(i) && ibanOk(i)), JSON.stringify(ibans));
    const ci = tags(xml, 'Id').filter(v => /^[A-Z]{2}\d{2}[A-Z0-9]{3}/.test(v));
    ok('T8.11', 'Gläubiger-ID im CdtrSchmeId, Schema SEPA', ci.includes('DE98ZZZ09999999999') && /<CdtrSchmeId><Id><PrvtId><Othr><Id>DE98ZZZ09999999999<\/Id><SchmeNm><Prtry>SEPA<\/Prtry>/.test(xml), JSON.stringify(ci));
    const [, mb] = await A(X(`member/${bernd}`)); const bank = mb.bank || {};
    ok('T8.12', 'Mandatsreferenz und Unterschriftsdatum wie im Mitglied', tags(xml, 'MndtId')[0] === bank.mandate_ref && tags(xml, 'DtOfSgntr')[0] === '2025-01-10' && /^[A-Za-z0-9+?/\-:().,']{1,35}$/.test(bank.mandate_ref || ''), JSON.stringify([tags(xml, 'MndtId'), tags(xml, 'DtOfSgntr'), bank.mandate_ref]));
    ok('T8.13', 'SeqTp FRST bei erstmaliger Nutzung, Fälligkeit = gewählter Bankarbeitstag', tags(xml, 'SeqTp')[0] === 'FRST' && tags(xml, 'ReqdColltnDt')[0] === earliest, JSON.stringify([tags(xml, 'SeqTp'), tags(xml, 'ReqdColltnDt'), earliest]));
    const nm = tags(xml, 'Nm');
    ok('T8.14', 'Sonderzeichen: & → +, < > " entfernt/umschrieben, Umlaute transliteriert, ≤ 70 Zeichen', nm.every(v => v.length <= 70 && !/[<>"&äöüÄÖÜß]/.test(v)) && nm.some(v => /Bernd \+ Soehne/.test(v)) && nm.some(v => /TC Audit \+ Soehne/.test(v)), JSON.stringify(nm));
    const us = tags(xml, 'Ustrd'), e2e = tags(xml, 'EndToEndId'), msg = tags(xml, 'MsgId');
    ok('T8.15', 'Verwendungszweck ≤ 140 Z. SEPA-Zeichensatz; EndToEndId eindeutig ≤ 35; MsgId ≤ 35', us.every(v => v.length <= 140 && /^[A-Za-z0-9 +?/\-:().,'&;]*$/.test(v)) && new Set(e2e).size === e2e.length && e2e.every(v => v.length <= 35) && msg[0].length <= 35, JSON.stringify([us, e2e, msg]));
    const order = ['MsgId', 'CreDtTm', 'NbOfTxs', 'CtrlSum', 'InitgPty'].map(t => xml.indexOf('<' + t));
    ok('T8.16', 'GrpHdr-Reihenfolge laut Schema', order.every((v, i) => i === 0 || v > order[i - 1]) && /<PmtInfId>.*<PmtMtd>DD<\/PmtMtd><BtchBookg>.*<NbOfTxs>.*<CtrlSum>.*<PmtTpInf>.*<ReqdColltnDt>.*<Cdtr>.*<CdtrAcct>.*<CdtrAgt>.*<ChrgBr>SLEV<\/ChrgBr><CdtrSchmeId>/.test(xml.replace(/\n/g, '')), JSON.stringify(order));
    ok('T8.17', 'DrctDbtTxInf-Reihenfolge: PmtId, InstdAmt, DrctDbtTx, DbtrAgt, Dbtr, DbtrAcct, RmtInf', /<DrctDbtTxInf><PmtId>.*<\/PmtId><InstdAmt Ccy="EUR">.*<DrctDbtTx>.*<\/DrctDbtTx><DbtrAgt>.*<Dbtr>.*<DbtrAcct>.*<RmtInf>/.test(xml.replace(/\n/g, '')));
    // Doppelte Einreichung
    [s, j] = await A(X('collections'), 'POST', { date: earliest }); ok('T8.18', 'Zweiter Einzug gleicher Posten: nichts fällig', s === 400, j.error);
    [s, j] = await A(X('charges?status=eingezogen')); ok('T8.19', 'Posten im Einzug markiert (eingezogen, collection_id)', j.rows.length === plan.ok[0].count && j.rows.every(r => r.collection_id === coll), JSON.stringify(j.rows.map(r => [r.text, r.status, r.collection_id])));
    // Geheimnisse in Logs
    const [, audit] = await A('api/admin/audit'); const auditS = JSON.stringify(audit); const log = fs.readFileSync(S + '/audit_srv.log', 'utf8');
    ok('T8.20', 'Keine volle IBAN im Audit-Protokoll und Serverlog', !/DE89370400440532013000|DE02120300000000202051/.test(auditS) && !/DE89370400440532013000/.test(log), auditS.match(/DE\d{20}/g) || '');
    // Verwerfen: Posten wieder offen, Mandatsstand zurück
    [s, j] = await A(X(`collections/${coll}`), 'DELETE'); ok('T8.21', 'Einzug verworfen', s === 200, j.error);
    [s, j] = await A(X('charges?status=offen')); ok('T8.22', 'Posten wieder offen', j.rows.filter(r => r.member_id === bernd).length === plan.ok[0].count, j.rows.length);
    [s, j] = await A(X('collections/preview'), 'POST', { date: earliest }); ok('T8.23', 'Nach Verwerfen wieder FRST (mandate_first_used zurückgesetzt)', j.ok[0] && j.ok[0].seq === 'FRST', JSON.stringify(j.ok.map(x => x.seq)));
    { const [s2, , b2] = await A(X(`collections/${coll}/xml`)); ok('T8.24', 'Verworfener Einzug liefert keine Datei mehr (erwartet 404/410)', s2 !== 200, `${s2} Länge ${b2 ? b2.length : 0}`); }
    // IBAN-/Gläubiger-Prüfung
    [s, j] = await A(X(`member/${carla}/bank`), 'PUT', { holder: 'Carla Gamma', iban: 'DE89370400440532013001', mandate_ref: 'X1', mandate_date: '2025-01-01' }); ok('T8.25', 'Falsche IBAN-Prüfziffer abgelehnt', s === 400, j.error);
    [s, j] = await A(X(`member/${carla}/bank`), 'PUT', { holder: 'Carla Gamma', iban: 'DE89370400440532013000', mandate_ref: 'ÄÖ Ref', mandate_date: '2025-01-01' }); ok('T8.26', 'Mandatsreferenz mit Umlaut/Leerzeichen abgelehnt', s === 400, j.error);
    [s, j] = await A(X(`member/${carla}/bank`), 'PUT', { holder: 'Carla Gamma', iban: 'DE89370400440532013000', mandate_ref: 'C-1', mandate_date: '2099-01-01' }); ok('T8.27', 'Mandatsdatum in der Zukunft wird abgelehnt', s === 400, `${s} ${j.error || 'akzeptiert'}`);
    [s, j] = await A(X('settings'), 'PUT', { creditor_id: 'DE98ZZZ09999999998' }); ok('T8.28', 'Falsche Gläubiger-ID-Prüfziffer abgelehnt', s === 400, j.error);
  }

  /* ================================================================= 9 Platzbuchung */
  { [s, j] = await A(K('resources'), 'POST', { name: 'Platz 1', days: '1234567', open_from: '08:00', open_to: '22:00', slot_min: 60, max_min: 120 }); const p1 = j.id; ok('T9.01', 'Platz angelegt', s === 200 && p1, j.error);
    await A(K('settings'), 'PUT', { max_open_platz: 2, cancel_before_min: 0, advance_days: 7 });
    for (const id of [anna, bernd, carla]) await A(`api/admin/app/member/${id}/access`, 'PUT', { module: 'buchung', grant: true });
    const pair = async (id, pin) => { const t = (await A(`api/admin/app/member/${id}/invite`, 'POST', {}))[1].token; return (await A('api/pair', 'POST', { t, pin }, { base: MB }))[1].device; };
    const dA = await pair(anna, '1111'), dB = await pair(bernd, '2222'), dC = await pair(carla, '3333'); ok('T9.02', 'Handys gekoppelt', dA && dB && dC);
    const bk = (dev, b) => A(AP('book'), 'POST', { accept: true, ...b }, { base: MB, dev });
    const d1 = dayPlus(1), d2 = dayPlus(2);
    const rs = await Promise.all([bk(dA, { resource_id: p1, date: d1, start: '10:00', minutes: 60 }), bk(dB, { resource_id: p1, date: d1, start: '10:00', minutes: 60 }), bk(dC, { resource_id: p1, date: d1, start: '10:00', minutes: 60 })]);
    ok('T9.03', 'Drei gleichzeitige Buchungen derselben Zeit: genau eine erfolgreich', rs.filter(r => r[0] === 200).length === 1, rs.map(r => r[0] + ' ' + (r[1].error || r[1].id)).join(' | '));
    const winner = rs.findIndex(r => r[0] === 200); const wdev = [dA, dB, dC][winner]; const wid = rs[winner][1].id;
    const rs2 = await Promise.all([0, 1].map(() => bk(dA, { resource_id: p1, date: d2, start: '09:00', minutes: 60 })));
    ok('T9.04', 'Doppeltipp desselben Mitglieds: genau eine Buchung', rs2.filter(r => r[0] === 200).length === 1, rs2.map(r => r[0] + ' ' + (r[1].error || '')).join(' | '));
    [s, j] = await bk(dB, { resource_id: p1, date: d1, start: '10:30', minutes: 60 }); ok('T9.05', 'Außerhalb Raster (10:30) abgelehnt', s === 400, j.error);
    [s, j] = await bk(dB, { resource_id: p1, date: d1, start: '07:00', minutes: 60 }); ok('T9.06', 'Vor Öffnung abgelehnt', s === 400, j.error);
    [s, j] = await bk(dB, { resource_id: p1, date: d1, start: '21:00', minutes: 120 }); ok('T9.07', 'Über Schluss hinaus abgelehnt', s === 400, j.error);
    [s, j] = await bk(dB, { resource_id: p1, date: d1, start: '12:00', minutes: 180 }); ok('T9.08', 'Länger als Höchstdauer abgelehnt', s === 400, j.error);
    [s, j] = await bk(dB, { resource_id: p1, date: dayPlus(-1), start: '12:00', minutes: 60 }); ok('T9.09', 'Vergangener Tag abgelehnt', s === 400, j.error);
    [s, j] = await bk(dB, { resource_id: p1, date: dayPlus(8), start: '12:00', minutes: 60 }); ok('T9.10', 'Zu weit im Voraus abgelehnt', s === 400, j.error);
    [s, j] = await bk(dC, { resource_id: p1, date: d1, start: '11:00', minutes: 60, partners: [anna, bernd, carla, anna] }); ok('T9.11', 'Zu viele Mitspieler / Mitspieler zur Zeit belegt abgelehnt', s === 400, j.error);
    [s, j] = await bk(dC, { resource_id: p1, date: d1, start: '12:00', minutes: 0 }); ok('T9.12', 'Dauer 0 abgelehnt', s === 400, j.error);
    [s, j] = await bk(dC, { resource_id: p1, date: d1, start: '12:00', minutes: -60 }); ok('T9.13', 'Negative Dauer abgelehnt', s === 400, j.error);
    [s, j] = await bk(dC, { resource_id: 9999, date: d1, start: '12:00', minutes: 60 }); ok('T9.14', 'Unbekannter Platz abgelehnt', s === 400, j.error);
    [s, j] = await bk(dC, { resource_id: p1, date: d1, start: '12:00', minutes: 60, accept: false }); ok('T9.15', 'Ohne Platzordnung: keine Regel gesetzt → erlaubt (rules leer)', s === 200, j.error);
    const cid = j.id;
    // Limit offener Buchungen (2)
    [s, j] = await bk(dC, { resource_id: p1, date: d2, start: '12:00', minutes: 60 }); const cid2 = j.id; ok('T9.16', 'Zweite Buchung Carla ok', s === 200, j.error);
    [s, j] = await bk(dC, { resource_id: p1, date: d2, start: '14:00', minutes: 60 }); ok('T9.17', 'Dritte offene Buchung abgelehnt (Limit 2 serverseitig)', s === 400 && /höchste Zahl/.test(j.error || ''), j.error);
    console.log('… warte 61 s (Ratenlimit je Mitglied 10/min)'); await sleep(61000);
    // fremde Buchung stornieren / ändern
    const other = wdev === dC ? dA : dC;
    [s, j] = await A(AP('cancel'), 'POST', { id: wid }, { base: MB, dev: other }); ok('T9.18', 'Fremde Buchung stornieren abgelehnt', s === 400, j.error);
    [s, j] = await A(AP('book'), 'POST', { id: wid, resource_id: p1, date: d1, start: '15:00', minutes: 60, accept: true }, { base: MB, dev: other }); ok('T9.19', 'Fremde Buchung ändern abgelehnt', s === 400, j.error);
    const [, plan] = await A(AP('me?date=' + d1), 'GET', undefined, { base: MB, dev: dA });
    ok('T9.20', 'Fremde Buchung weiterhin aktiv', plan.plan.bookings.some(b => b.id === wid), JSON.stringify(plan.plan.bookings.map(b => [b.id, b.start])));
    // Ändern in belegte Zeit
    [s, j] = await A(AP('book'), 'POST', { id: cid, resource_id: p1, date: d1, start: '10:00', minutes: 60, accept: true }, { base: MB, dev: dC }); ok('T9.21', 'Verschieben in belegte Zeit abgelehnt', s === 400, j.error);
    [s, j] = await A(AP('book'), 'POST', { id: cid, resource_id: p1, date: d1, start: '16:00', minutes: 60, accept: true }, { base: MB, dev: dC }); ok('T9.22', 'Verschieben in freie Zeit ok, gleiche ID', s === 200 && j.id === cid, JSON.stringify(j));
    const [, pl2] = await A(AP('me?date=' + d1), 'GET', undefined, { base: MB, dev: dC });
    ok('T9.23', 'Nach Verschieben: 12:00 frei, 16:00 belegt (keine Doppelung)', !pl2.plan.bookings.some(b => b.start === '12:00') && pl2.plan.bookings.filter(b => b.id === cid).length === 1, JSON.stringify(pl2.plan.bookings.map(b => [b.id, b.start])));
    // Storno & Neubuchung
    [s, j] = await A(AP('cancel'), 'POST', { id: wid }, { base: MB, dev: wdev }); ok('T9.24', 'Eigene Buchung storniert', s === 200, j.error);
    [s, j] = await A(AP('cancel'), 'POST', { id: wid }, { base: MB, dev: wdev }); ok('T9.25', 'Doppelstorno abgelehnt', s === 400, j.error);
    [s, j] = await bk(dB, { resource_id: p1, date: d1, start: '10:00', minutes: 60 }); ok('T9.26', 'Freigewordene Zeit neu buchbar', s === 200, j.error);
    const [, all] = await A(K(`bookings?from=${d1}&to=${d2}&all=1`));
    const act = all.filter(b => b.status === 'aktiv');
    const overl = act.some(a => act.some(b => a.id !== b.id && a.resource_id === b.resource_id && a.date === b.date && a.start < b.end && b.start < a.end));
    ok('T9.27', 'Keine überlappenden aktiven Buchungen in der DB', !overl && act.length === 4, `${act.length} aktiv`);
    [s, j] = await A(K(`bookings/${cid2}/cancel`), 'POST', { reason: 'Test' }); ok('T9.28', 'Verwaltung storniert mit Grund', s === 200);
    const [, log] = await A(K('log?f=storniert')); const lr = log.rows.find(r => r.id === cid2);
    ok('T9.29', 'Storno nachvollziehbar (Grund, Wer)', lr && lr.cancel_reason === 'Test' && lr.cancelled_by, JSON.stringify(lr && [lr.cancel_reason, lr.cancelled_by]));
    // Admin-Buchung in belegte Zeit
    [s, j] = await A(K('bookings'), 'POST', { resource_id: p1, date: d1, start: '10:00', end: '11:00', title: 'Training' }); ok('T9.30', 'Verwaltung: belegte Zeit abgelehnt', s === 400, j.error);
    [s, j] = await A(K('bookings'), 'POST', { resource_id: p1, date: d1, start: '10:00', end: '12:00', type: 'sperre', title: 'Platzpflege' }); ok('T9.31', 'Sperre über Buchung → 409 mit Konflikten', s === 409 && j.conflicts && j.conflicts.length === 1, `${s} ${JSON.stringify(j).slice(0, 150)}`);
    [s, j] = await A(K('bookings'), 'POST', { resource_id: p1, date: d1, start: '10:00', end: '12:00', type: 'sperre', title: 'Platzpflege', force: true }); ok('T9.32', 'Sperre erzwungen storniert Buchung', s === 200);
    const [, all2] = await A(K(`bookings?from=${d1}&to=${d1}&all=1`));
    ok('T9.33', 'Nach Sperre: betroffene Buchung storniert, Sperre aktiv', all2.some(b => b.type === 'sperre' && b.status === 'aktiv') && !all2.some(b => b.type === 'buchung' && b.status === 'aktiv' && b.start === '10:00'), JSON.stringify(all2.map(b => [b.type, b.start, b.status])));
    [s, j] = await bk(dA, { resource_id: p1, date: d1, start: '11:00', minutes: 60 }); ok('T9.34', 'Mitglied kann in gesperrte Zeit nicht buchen', s === 400, j.error);
  }

  console.log(`\n${n} Prüfungen, ${fails} fehlgeschlagen`);
  srv.kill(); await sleep(300); process.exit(0);
})().catch(e => { console.error('ABBRUCH', e); try { srv.kill(); } catch (x) { /* */ } process.exit(1); });
