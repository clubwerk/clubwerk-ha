// Mitglied sicher löschen: DELETE api/admin/members/:id löscht nur, wenn nichts mehr am Mitglied hängt (sonst 409 mit lesbaren Gründen),
// remove-inactive überspringt verknüpfte Mitglieder, Abteilungsleitungen dürfen nicht löschen. Startet den Server selbst.  node mdel_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_mdel'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3287/', M = 'http://127.0.0.1:5280/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
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
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3287', BEREGNUNG_PORT: '5279', MEMBER_PORT: '5280', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/mdel_srv.log', 'w'), fs.openSync(S + '/mdel_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
const del = id => A('api/admin/members/' + id, 'DELETE');
(async () => {
  let s, j;
  await start();
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Grün-Weiß Musterstadt', password: 'Test-Kennwort-42', modules: { getraenke: true, mitglieder: true, spielbetrieb: true, buchung: true, arbeitseinsatz: true, buchhaltung: true } });
  ok('Setup mit allen Modulen', s === 200, JSON.stringify(j));
  // Gibt es das Konto noch (nicht gelöscht)? – über die Mitgliederverwaltung (404, sobald das Konto weg ist)
  const alive = async id => { const [st, d] = await A(X('member/' + id)); return st === 200 && d && d.person && !d.person.deleted; };
  const mk = async (f, l, extra = {}) => { const r = await A(X('member'), 'POST', { first_name: f, last_name: l, ...extra }); if (!r[1].id) console.log('Anlegen fehlgeschlagen', f, l, JSON.stringify(r[1])); return r[1].id; };
  const has = (links, re) => (links || []).some(t => re.test(t));
  const blocked = async (name, id, re, n = 0) => {   // 409 mit passendem Grund, Mitglied danach noch da
    const [st, d] = await del(id);
    ok(name, st === 409 && Array.isArray(d.links) && has(d.links, re) && (!n || d.links.length === n), `${st} ${JSON.stringify(d)}`);
    ok(name + ' – Mitglied noch da', await alive(id));
    return d;
  };
  const deletable = async (name, id) => {
    const [st, d] = await del(id);
    ok(name, st === 200 && d.ok, `${st} ${JSON.stringify(d)}`);
    ok(name + ' – danach weg', !(await alive(id)));
  };

  /* ---------- 1. Sauberes Mitglied ---------- */
  {
    const id = await mk('Sabine', 'Sauber');
    ok('Mitglied angelegt', Boolean(id));
    await deletable('Ohne Verknüpfung löschbar (200)', id);
    [s, j] = await A('api/admin/members'); ok('… nicht mehr in der Kontenliste', s === 200 && Array.isArray(j.rows) && !j.rows.some(m => m.id === id), s);
  }

  /* ---------- 2. Beitrag zugeordnet → erst nach Ende löschbar ---------- */
  const fErw = (await A(X('fees'), 'POST', { name: 'Erwachsene', cents: 12000, interval: 'jahr', kind: 'grund' }))[1].id;
  {
    const id = await mk('Bernd', 'Beitrag');
    [s, j] = await A(X(`member/${id}/fees`), 'POST', { fee_id: fErw, start_date: '2020-01-01' }); ok('Beitrag zugeordnet', s === 200, j.error);
    const d = await blocked('Beitrag sperrt (409 „Beitrag zugeordnet“)', id, /^Beitrag zugeordnet: Erwachsene \(Mitgliederverwaltung\)$/, 1);
    ok('Fehlertext mit „Nachname, Vorname“', /^Beitrag, Bernd kann noch nicht gelöscht werden/.test(d.error || ''), d.error);
    [s, j] = await A(X('member/' + id)); const mf = (j.fees || []).find(f => f.fee_id === fErw);
    [s, j] = await A(X('mf/' + mf.id), 'PUT', { end_date: day(0) }); ok('Beitrag endet heute', s === 200, j.error);
    await blocked('Beitrag mit Ende heute sperrt noch', id, /^Beitrag zugeordnet/);
    [s, j] = await A(X('mf/' + mf.id), 'PUT', { end_date: day(-1) }); ok('Beitrag endete gestern', s === 200, j.error);
    await deletable('Beendeter Beitrag sperrt nicht mehr', id);
  }

  /* ---------- 3. Zahler und Familie ---------- */
  {
    const dad = await mk('Peter', 'Zahler'), kid = await mk('Kai', 'Zahler', { birth_date: '2012-05-05' });
    [s, j] = await A(X(`member/${kid}/payer`), 'PUT', { payer_id: dad }); ok('Zahler eingetragen', s === 200, j.error);
    await blocked('Hauptzahler: „Zahlt für“', dad, /^Zahlt für: Zahler, Kai \(Mitgliederverwaltung\)$/, 1);
    await blocked('Angehöriger: „Zahlt über“', kid, /^Zahlt über: Zahler, Peter \(Mitgliederverwaltung\)$/, 1);
    await A(X(`member/${kid}/payer`), 'PUT', { payer_id: null });
    await deletable('Zahler gelöst → Angehöriger löschbar', kid);
    await deletable('… und der frühere Hauptzahler auch', dad);

    const fFam = (await A(X('fees'), 'POST', { name: 'Familie', cents: 20000, interval: 'jahr', kind: 'grund', family: 1 }))[1].id;
    const head = await mk('Frida', 'Familie'), part = await mk('Fritz', 'Familie');
    [s, j] = await A(X(`member/${head}/fees`), 'POST', { fee_id: fFam, start_date: '2020-01-01' }); ok('Familienbeitrag zugeordnet', s === 200, j.error);
    [s, j] = await A(X(`member/${part}/family`), 'PUT', { family_of: head }); ok('Partner in der Familie', s === 200, j.error);
    let d = await blocked('Oberhaupt: „Familie“', head, /^Familie: Familie, Fritz \(Mitgliederverwaltung\)$/);
    ok('Oberhaupt: auch „Zahlt für“ und Beitrag', has(d.links, /^Zahlt für: Familie, Fritz/) && has(d.links, /^Beitrag zugeordnet: Familie/), JSON.stringify(d.links));
    d = await blocked('Familienmitglied: „Gehört zur Familie von“', part, /^Gehört zur Familie von: Familie, Frida \(Mitgliederverwaltung\)$/);
    ok('Familienmitglied: auch „Zahlt über“', has(d.links, /^Zahlt über: Familie, Frida/), JSON.stringify(d.links));
    [s, j] = await A(X(`member/${part}/family`), 'PUT', { family_of: null }); ok('Aus der Familie gelöst', s === 200, j.error);
    await deletable('Gelöstes Familienmitglied löschbar', part);
  }

  /* ---------- 4. Spielbetrieb ---------- */
  {
    const id = await mk('Sven', 'Spieler'), cap = await mk('Carl', 'Kapitän');
    [s, j] = await A(SP('teams'), 'POST', { name: 'Herren 30', league: 'Bezirksliga', min_players: 2, captain_id: cap }); const team = j.id; ok('Mannschaft angelegt', s === 200 && team, JSON.stringify(j));
    [s, j] = await A(SP(`teams/${team}/players`), 'PUT', { players: [id] }); ok('In der Meldeliste', s === 200, JSON.stringify(j).slice(0, 200));
    await blocked('Meldeliste sperrt („Spielt in“)', id, /^Spielt in: Herren 30 \(Spielbetrieb\)$/, 1);
    await blocked('Mannschaftsführer sperrt', cap, /^Mannschaftsführer\/Stellvertreter: Herren 30 \(Spielbetrieb\)$/);
    [s, j] = await A(SP(`teams/${team}/players`), 'PUT', { players: [] }); ok('Aus der Meldeliste genommen', s === 200, JSON.stringify(j).slice(0, 200));
    await deletable('Nicht mehr gemeldet → löschbar', id);
  }

  /* ---------- 5. Kommende Platzbuchung (auch als Mitspieler) ---------- */
  {
    const bk = await mk('Bea', 'Bucher'), mit = await mk('Max', 'Mitspieler');
    [s, j] = await A(K('meta')); const p1 = ((j.resources || [])[0] || {}).id; ok('Plätze vorhanden', Boolean(p1), JSON.stringify(j).slice(0, 200));
    [s, j] = await A(K('bookings'), 'POST', { resource_id: p1, date: day(3), start: '10:00', end: '11:00', member_id: bk, partners: [mit] }); const bid = j.id;
    ok('Platz für Bea mit Max gebucht', s === 200 && bid, JSON.stringify(j));
    await blocked('Bucherin: „kommende Buchung“', bk, /^1 kommende Buchung \(Buchungssystem\)$/, 1);
    await blocked('Mitspieler: „kommende Buchung“', mit, /^1 kommende Buchung \(Buchungssystem\)$/, 1);
    [s, j] = await A(K(`bookings/${bid}/cancel`), 'POST', {}); ok('Buchung storniert', s === 200, j.error);
    await deletable('Stornierte Buchung sperrt nicht (Mitspieler)', mit);
    await deletable('Stornierte Buchung sperrt nicht (Bucherin)', bk);
  }

  /* ---------- 6. Offener Betrag im Verkauf (Tablet) ---------- */
  {
    const id = await mk('Theo', 'Theke');
    [s, j] = await A('api/tablet/state'); const art = (j.articles || []).find(a => a.price_cents > 0 && !a.custom); ok('Artikel am Tablet', s === 200 && art, s);
    [s, j] = await A('api/tablet/unlock', 'POST', { memberId: id }); ok('Theo am Tablet', s === 200 && j.token, JSON.stringify(j).slice(0, 200));
    [s, j] = await A('api/tablet/book', 'POST', { token: j.token, items: [{ articleId: art.id, qty: 2 }] }); ok('Theo bucht 2 Artikel', s === 200, JSON.stringify(j).slice(0, 200));
    const eur = (2 * art.price_cents / 100).toFixed(2).replace('.', ',');
    await blocked('Offener Betrag sperrt', id, new RegExp(`^Offener Betrag im Verkauf: ${eur}\\s€$`), 1);
  }

  /* ---------- 7. Offene Forderung sperrt, bezahlte nicht ---------- */
  {
    const id = await mk('Olga', 'Offen');
    [s, j] = await A(X('charges'), 'POST', { member_id: id, text: 'Aufnahmegebühr', cents: 2500, due_date: day(0), kind: 'aufnahme' }); const ch = j.id; ok('Forderung angelegt', s === 200 && ch, JSON.stringify(j));
    await blocked('Offene Forderung sperrt', id, /^1 offene Forderung \(Mitgliederverwaltung\)$/, 1);
    [s, j] = await A(X(`charges/${ch}/pay`), 'POST', { via: 'bar' }); ok('Forderung bezahlt', s === 200, JSON.stringify(j));
    await deletable('Bezahlte Forderung sperrt nicht', id);
    [s, j] = await A(X('charges?status=bezahlt'));
    ok('Bezahlte Forderung bleibt als Verlauf erhalten', (j.rows || []).some(r => r.id === ch), JSON.stringify((j.rows || []).map(r => [r.id, r.text])));
    [s, j] = await A(X(`charges?member=${id}&status=alle`));
    ok('… auch über den Mitgliederfilter der Forderungsliste', s === 200 && (j.rows || []).some(r => r.id === ch && r.status === 'bezahlt'), `${s} ${JSON.stringify(j).slice(0, 300)}`);
  }

  /* ---------- 8. Mehrere Gründe gleichzeitig ---------- */
  {
    const id = await mk('Moritz', 'Mehrfach');
    await A(X(`member/${id}/fees`), 'POST', { fee_id: fErw, start_date: '2020-01-01' });
    const dep = (await A(X('departments'), 'POST', { name: 'Tennis' }))[1].id;
    await A(X(`member/${id}/departments`), 'POST', { department_id: dep, entry_date: '2020-01-01' });
    await A(X(`member/${id}/functions`), 'POST', { name: 'Kassenwart', from_date: '2022-01-01' });
    await A(X(`member/${id}/honors`), 'POST', { name: 'Silberne Ehrennadel', date: '2023-05-01' });
    [s, j] = await A(SP('teams'), 'POST', { name: 'Herren 50', min_players: 2, vice_id: id }); const t2 = j.id;
    await A(SP(`teams/${t2}/players`), 'PUT', { players: [id] });
    const [, km] = await A(K('meta')); const p2 = (km.resources[1] || km.resources[0]).id;
    [s, j] = await A(K('bookings'), 'POST', { resource_id: p2, date: day(5), start: '15:00', end: '16:00', member_id: id }); ok('Buchung für Moritz', s === 200, j.error);
    await A(X('charges'), 'POST', { member_id: id, text: 'Startgeld', cents: 1500, due_date: day(0) });
    [s, j] = await A(W('events'), 'POST', { kind: 'arbeit', title: 'Frühjahrsputz', date: day(7), start: '09:00', end: '12:00', slots: 5 }); const ev = (j.ids || [])[0]; ok('Einsatz angelegt', s === 200 && ev, JSON.stringify(j));
    [s, j] = await A(W(`events/${ev}/signup`), 'POST', { member_id: id }); ok('Für den Einsatz eingetragen', s === 200, j.error);
    [s, j] = await A(BH('invoices'), 'POST', { kind: 'member', member_id: id, items: [{ text: 'Vereinsjacke', qty: 1, unit_cents: 4500, vat: 19 }] }); ok('Rechnung angelegt', s === 200 && j.id, JSON.stringify(j));
    [s, j] = await A('api/admin/users', 'POST', { member_id: id, password: 'Test-Kennwort-42', roles: [] }); const uname = j.username; ok('Benutzer mit Mitglied verbunden', s === 200 && uname, JSON.stringify(j));
    const [st, d] = await del(id); const L = d.links || [];
    ok('Mehrere Gründe: 409', st === 409, st);
    const want = {
      'Beitrag': /^Beitrag zugeordnet: Erwachsene \(Mitgliederverwaltung\)$/, 'Abteilung': /^Abteilung: Tennis \(Mitgliederverwaltung\)$/,
      'Amt': /^Amt: Kassenwart \(Mitgliederverwaltung\)$/, 'Ehrung': /^Ehrung: Silberne Ehrennadel \(Mitgliederverwaltung\)$/,
      'Forderungen': /^2 offene Forderungen \(Mitgliederverwaltung\)$/,   // Startgeld + Rechnung der Buchhaltung (als offener Posten)
      'Spielt in': /^Spielt in: Herren 50 \(Spielbetrieb\)$/, 'Stellvertreter': /^Mannschaftsführer\/Stellvertreter: Herren 50 \(Spielbetrieb\)$/,
      'Buchung': /^1 kommende Buchung \(Buchungssystem\)$/, 'Einsatz': /^Für 1 kommenden Einsatz eingetragen \(Helferdienste\)$/,
      'Rechnung': /^1 offene Rechnung \(Buchhaltung\)$/, 'Benutzer': new RegExp(`^Verbunden mit dem Benutzer „${uname}“ der Verwaltung$`),
    };
    for (const [k, re] of Object.entries(want)) ok(`Mehrere Gründe: ${k}`, has(L, re), JSON.stringify(L));
    ok('Mehrere Gründe: keine Prüfung fehlgeschlagen', !has(L, /Prüfung fehlgeschlagen/) && L.length === Object.keys(want).length, JSON.stringify(L));
    ok('Fehlertext listet alle Gründe', L.every(t => (d.error || '').includes('• ' + t)), d.error);
    ok('Mehrere Gründe – Mitglied noch da', await alive(id));
  }

  /* ---------- 8b. Helferdienste: nicht bestätigte Stundenmeldung ---------- */
  {
    const id = await mk('Hanna', 'Helferin');
    [s, j] = await A('api/tablet/unlock', 'POST', { memberId: id }); const tk = j.token;
    [s, j] = await A('api/tablet/x/arbeitseinsatz/start', 'POST', { token: tk, text: 'Hecke schneiden' }); ok('Hanna stempelt am Tablet ein', s === 200, JSON.stringify(j));
    await blocked('Laufender Einsatz sperrt', id, /^1 noch nicht bestätigte Stundenmeldung \(Helferdienste\)$/, 1);
    [s, j] = await A(W(`entries?member=${id}&status=alle`)); const en = (Array.isArray(j) ? j : [])[0] || {};
    [s, j] = await A(W(`entries/${en.id}/stop`), 'POST', {}); ok('Verwaltung stempelt aus', s === 200, JSON.stringify(j));
    [s, j] = await A(W(`entries?member=${id}&status=alle`)); ok('Stundenmeldung offen', Array.isArray(j) && j.length === 1 && j[0].status === 'offen', JSON.stringify(j).slice(0, 200));
    await blocked('Offene Stundenmeldung sperrt', id, /^1 noch nicht bestätigte Stundenmeldung \(Helferdienste\)$/, 1);
    [s, j] = await A(W('entries/review'), 'POST', { ids: [en.id], approve: true }); ok('Stunden bestätigt', s === 200 && j.count === 1, JSON.stringify(j));
    await deletable('Bestätigte Stunden sperren nicht', id);
  }

  /* ---------- 8c. Buchungssystem: laufende Serie und Warteliste ---------- */
  {
    const [, km] = await A(K('meta')); const p1 = km.resources[0].id;
    const id = await mk('Selma', 'Serie');
    const from = day(2), wd = (() => { const d = new Date(from + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; })();
    [s, j] = await A(K('series'), 'POST', { type: 'serie', title: 'Training Selma', resources: [p1], weekdays: String(wd), start: '19:00', end: '20:00', from_date: from, to_date: day(30), member_id: id }); const ser = j.id;
    ok('Serie für Selma angelegt', s === 200 && ser && j.made >= 4, JSON.stringify(j));
    const d = await blocked('Laufende Serie sperrt', id, /^1 laufende Serie \(Buchungssystem\)$/);
    ok('… dazu die Serientermine als kommende Buchungen', has(d.links, /^\d+ kommende Buchungen \(Buchungssystem\)$/) && d.links.length === 2, JSON.stringify(d.links));
    [s, j] = await A(K(`series/${ser}/end`), 'POST', {}); ok('Serie beendet', s === 200, JSON.stringify(j));
    await deletable('Beendete Serie sperrt nicht', id);

    const own = await mk('Otto', 'Belegt'), wt = await mk('Wanda', 'Warte');
    [s, j] = await A(K('bookings'), 'POST', { resource_id: p1, date: day(4), start: '12:00', end: '13:00', member_id: own }); const bOwn = j.id; ok('Platz für Otto belegt', s === 200 && bOwn, JSON.stringify(j));
    [s, j] = await A(`api/admin/app/member/${wt}/invite`, 'POST', {}); const t = j.token; ok('App-Einladung für Wanda', s === 200 && t, JSON.stringify(j));
    [s, j] = await A('api/pair', 'POST', { t, pin: '2468' }, { base: M }); const dev = j.device; ok('Wandas Handy gekoppelt', s === 200 && dev, JSON.stringify(j));
    [s, j] = await A(AP('wait'), 'POST', { resource_id: p1, date: day(4), start: '12:00' }, { base: M, dev }); ok('Wanda auf der Warteliste', s === 200, JSON.stringify(j));
    await blocked('Warteliste sperrt', wt, /^Auf der Warteliste \(Buchungssystem\)$/, 1);
    await A(K(`bookings/${bOwn}/cancel`), 'POST', {});
  }

  /* ---------- 9. remove-inactive überspringt verknüpfte Mitglieder ---------- */
  {
    const linked = await mk('Ina', 'Inaktiv'), free = await mk('Udo', 'Unbenutzt');
    await A(X(`member/${linked}/fees`), 'POST', { fee_id: fErw, start_date: '2020-01-01' });
    [s, j] = await A('api/admin/members/remove-inactive', 'POST', { ids: [linked, free] });
    ok('remove-inactive: freies Mitglied gelöscht', s === 200 && j.deleted === 1, JSON.stringify(j));
    ok('remove-inactive: verknüpftes übersprungen („noch verknüpft“)', (j.skipped || []).some(t => /Inaktiv/.test(t) && /\(noch verknüpft\)/.test(t)), JSON.stringify(j.skipped));
    ok('remove-inactive: verknüpftes Mitglied noch da', await alive(linked));
    ok('remove-inactive: freies Mitglied weg', !(await alive(free)));
  }

  /* ---------- 10. Rechte: Abteilungsleitung darf nicht löschen, volles „Mitglieder“ schon ---------- */
  {
    const dep = (await A(X('departments'), 'POST', { name: 'Padel' }))[1].id;
    const a = await mk('Alma', 'Abteilung'), b = await mk('Bodo', 'Abteilung');
    for (const m of [a, b]) await A(X(`member/${m}/departments`), 'POST', { department_id: dep, entry_date: '2020-01-01' });
    [s, j] = await A('api/admin/roles', 'POST', { name: 'Padel-Leitung', perms: ['mitglieder'], dept_scope: true }); const rScoped = j.id; ok('Rolle „nur eigene Abteilung“', s === 200 && rScoped, JSON.stringify(j));
    [s, j] = await A('api/admin/roles', 'POST', { name: 'Mitgliederpflege', perms: ['mitglieder'] }); const rFull = j.id; ok('Rolle mit vollem Recht „Mitglieder“', s === 200 && rFull, JSON.stringify(j));
    [s, j] = await A('api/admin/users', 'POST', { name: 'Dora Leitung', password: 'Test-Kennwort-42', roles: [rScoped], departments: [dep] }); const uS = j.username; ok('Abteilungsleitung angelegt', s === 200 && uS, JSON.stringify(j));
    [s, j] = await A('api/admin/users', 'POST', { name: 'Volker Voll', password: 'Test-Kennwort-42', roles: [rFull] }); const uF = j.username; ok('Benutzer mit vollem Recht angelegt', s === 200 && uF, JSON.stringify(j));
    let ckS, ckF;
    [s, j, ckS] = await A('api/admin/login', 'POST', { username: uS, password: 'Test-Kennwort-42' }, { cookie: '' }); ok('Login Abteilungsleitung', s === 200 && ckS, s);
    [s, j] = await A(X('member/' + a), 'GET', undefined, { cookie: ckS }); ok('Abteilungsleitung sieht das eigene Mitglied', s === 200, s + ' ' + j.error);
    [s, j] = await A('api/admin/members/' + a, 'DELETE', undefined, { cookie: ckS }); ok('Abteilungsleitung: Löschen 403', s === 403, `${s} ${JSON.stringify(j)}`);
    ok('Abteilungsleitung: Mitglied noch da', await alive(a));
    [s, j, ckF] = await A('api/admin/login', 'POST', { username: uF, password: 'Test-Kennwort-42' }, { cookie: '' }); ok('Login volles „Mitglieder“', s === 200 && ckF, s);
    [s, j] = await A('api/admin/members/' + b, 'DELETE', undefined, { cookie: ckF });
    ok('Volles „Mitglieder“: darf löschen, Abteilung sperrt (409)', s === 409 && has(j.links, /^Abteilung: Padel \(Mitgliederverwaltung\)$/), `${s} ${JSON.stringify(j)}`);
    [s, j] = await A(X('member/' + b)); const md = (j.departments || [])[0];
    [s, j] = await A(X('md/' + md.id), 'PUT', { exit_date: day(-1) }); ok('Austritt aus der Abteilung (gestern)', s === 200, j.error);
    [s, j] = await A('api/admin/members/' + b, 'DELETE', undefined, { cookie: ckF }); ok('Volles „Mitglieder“: nach Austritt gelöscht', s === 200 && j.ok, `${s} ${JSON.stringify(j)}`);
    ok('… danach weg', !(await alive(b)));
  }

  const log = fs.readFileSync(S + '/mdel_srv.log', 'utf8');
  ok('Keine Fehler im Serverprotokoll', !/TypeError|ReferenceError|SqliteError|is not a function|FOREIGN KEY/.test(log), log.split('\n').filter(l => /Error|FOREIGN/.test(l)).slice(0, 5).join(' / '));
})().catch(e => { console.log('ABBRUCH ' + (e && e.stack || e)); fails++; }).finally(() => { if (srv) srv.kill(); console.log(fails ? `${fails} Fehler` : 'alles ok'); process.exit(fails ? 1 : 0); });
