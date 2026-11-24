// Tests der Buchungsseite: Abgleich (Signatur, Replay), Reservieren, Zahlung, Storno, Erstattung, Webhooks – gegen die nachgebaute PayPal-Schnittstelle.
//   npm test   (Node 22, ohne weitere Pakete)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { d1 } from './d1.js';
import worker from '../src/index.js';
import { signiereAnfrage, schluesselBytes, antwortText, sha256hex } from '../src/signatur.js';

const require = createRequire(import.meta.url);
const SCHLUESSEL = Buffer.alloc(32, 7).toString('base64url');
const PORT = 5641;
let mock, env, versatz = 0;
const W = 'https://buchen.example.org';
const schema = fs.readFileSync(new URL('../migrations/0001_start.sql', import.meta.url), 'utf8');

before(async () => {
  mock = await require('./paypal-mock.cjs').starten({ port: PORT, kunden: { seite: { secret: 'seite-geheim' }, verein: { secret: 'verein-geheim' } } });
  const datei = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gb-')), 't.db');
  env = { DB: d1(datei, schema), PAYPAL_ENV: 'test', PAYPAL_API_BASE: mock.base, PAYPAL_CLIENT_ID: 'seite', PAYPAL_CLIENT_SECRET: 'seite-geheim', PAYPAL_WEBHOOK_ID: mock.webhookId, CLUBWERK_SCHLUESSEL: SCHLUESSEL, TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET: 'turnstile-geheim', TURNSTILE_VERIFY_URL: `http://127.0.0.1:${PORT}/turnstile/v0/siteverify`, __jetzt: () => Date.now() + versatz };
});
after(() => mock.schliessen());

const rufe = (pfad, init = {}) => worker.fetch(new Request(W + pfad, { redirect: 'manual', ...init }), env, {});
const jrufe = async (pfad, body) => { const r = await rufe(pfad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return [r.status, await r.json()]; };
const tag = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const ab = (d, hm) => Date.parse(`${d}T${hm}:00Z`);
const D1 = tag(3), D2 = tag(4);
const frei = () => [{ platz: 1, datum: D1, zeiten: [['18:00', '19:00', ab(D1, '18:00')], ['19:00', '20:00', ab(D1, '19:00')]] }, { platz: 2, datum: D2, zeiten: [['10:00', '11:00', ab(D2, '10:00')]] }];
async function sync(extra = {}, { roh = null, kopf = null } = {}) {
  const body = roh || JSON.stringify({ v: 1, anzeige: { verein: 'TC Grün-Weiß Musterstadt', farbe: '#1f6f43', homepage: 'https://www.dein-verein.de' }, regeln: { aktiv: true, storno_stunden: 24, halten_min: 10 },
    plaetze: [{ id: 1, name: 'Platz 1', minuten: 60, preis: 1500 }, { id: 2, name: 'Padel', minuten: 60, preis: 2400 }], frei: frei(), ...extra });
  const h = kopf || await signiereAnfrage(schluesselBytes(SCHLUESSEL), 'POST', '/api/v1/sync', body);
  const r = await rufe('/api/v1/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body });
  const text = await r.text();
  return { status: r.status, d: r.status === 200 ? JSON.parse(text) : null, text, r, h };
}
let tsN = 0;
const gast = (o = {}) => ({ turnstile: `mensch-ok-${++tsN}`, platz: 1, datum: D1, beginn: '18:00', vorname: 'Gerda', nachname: 'Gast', email: 'gerda@example.com', telefon: '0170 5550123', zustimmung: true, weg: 'weiterleitung', ...o });
async function buchen(o = {}) {
  const [s, r] = await jrufe('/api/v1/reservieren', gast(o)); assert.equal(s, 200, JSON.stringify(r));
  assert.ok(mock.freigeben(r.order_id));
  const z = await rufe(`/zurueck/${r.ref}?t=${r.t}&token=${r.order_id}&PayerID=X`);
  assert.equal(z.status, 303);
  return r;
}

test('ohne Abgleich: keine Buchung möglich', async () => {
  const r = await rufe('/api/v1/angebot'); const d = await r.json();
  assert.equal(d.offline, true);
  const [s] = await jrufe('/api/v1/reservieren', gast()); assert.equal(s, 503);
});

test('Abgleich: falsche Signatur, Wiederholung und alte Zeit werden abgelehnt', async () => {
  const ok = await sync(); assert.equal(ok.status, 200, ok.text);
  // Antwort ist an die Nonce der Anfrage gebunden und signiert
  const soll = await (async () => { const k = await crypto.subtle.importKey('raw', schluesselBytes(SCHLUESSEL), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(antwortText(ok.h['X-Clubwerk-Nonce'], ok.r.headers.get('x-clubwerk-zeit'), await sha256hex(ok.text)))); return Buffer.from(s).toString('hex'); })();
  assert.equal(ok.r.headers.get('x-clubwerk-signatur'), soll);
  const wieder = await sync({}, { roh: JSON.stringify({ v: 1 }), kopf: null });
  assert.equal(wieder.status, 200);
  const replay = await sync({}, { roh: JSON.stringify({ v: 1 }), kopf: wieder.h }); assert.equal(replay.status, 401, 'gleiche Nonce zweimal');
  const falsch = await sync({}, { roh: JSON.stringify({ v: 1, frei: [] }), kopf: (await signiereAnfrage(schluesselBytes(SCHLUESSEL), 'POST', '/api/v1/sync', JSON.stringify({ v: 1 }))) });
  assert.equal(falsch.status, 401, 'Body verändert');
  const alt = await signiereAnfrage(schluesselBytes(SCHLUESSEL), 'POST', '/api/v1/sync', '{"v":1}', Math.floor(Date.now() / 1000) - 3600);
  assert.equal((await sync({}, { roh: '{"v":1}', kopf: alt })).status, 401, 'eine Stunde alt');
  const fremd = await signiereAnfrage(new Uint8Array(32), 'POST', '/api/v1/sync', '{"v":1}');
  assert.equal((await sync({}, { roh: '{"v":1}', kopf: fremd })).status, 401, 'fremder Schlüssel');
  assert.equal((await sync({}, { roh: '{"v":2}' })).status, 409, 'unbekannte Schnittstelle');
});

test('Angebot zeigt freie Zeiten mit Preis, Seite darf nur auf der Homepage eingebettet werden', async () => {
  await sync();
  const d = await (await rufe('/api/v1/angebot')).json();
  assert.equal(d.offline, false);
  assert.deepEqual(d.tage.map(t => t.datum), [D1, D2]);
  assert.equal(d.tage[0].plaetze[0].zeiten[0].preis, 1500);
  const s = await rufe('/');
  assert.match(s.headers.get('content-security-policy'), /frame-ancestors https:\/\/www\.dein-verein\.de$/);
  assert.match(await s.text(), /TC Grün-Weiß Musterstadt/);
});

test('Reservieren: Pflichtfelder, eine Zeit nur einmal, PayPal-Order mit Buchungsnummer', async () => {
  await sync();
  for (const [k, v] of [['email', 'kein-at'], ['telefon', 'abc'], ['zustimmung', false], ['vorname', '']]) { const [s] = await jrufe('/api/v1/reservieren', gast({ [k]: v })); assert.equal(s, 400, k); }
  const [s, r] = await jrufe('/api/v1/reservieren', gast({ beginn: '19:00' }));
  assert.equal(s, 200);
  assert.match(r.ref, /^G-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const o = mock.daten.orders.get(r.order_id);
  assert.equal(o.purchase_units[0].custom_id, r.ref);
  assert.equal(o.purchase_units[0].amount.value, '15.00');
  assert.ok(mock.aufrufe.some(a => a.pfad === '/v2/checkout/orders' && a.kunde === 'seite'));
  const [s2] = await jrufe('/api/v1/reservieren', gast({ beginn: '19:00', email: 'zweiter@example.com' })); assert.equal(s2, 409, 'gleiche Zeit gehalten');
  // Abbruch gibt die Zeit sofort frei
  assert.equal((await rufe(`/abbruch/${r.ref}?t=${r.t}`)).status, 200);
  const [s3, r3] = await jrufe('/api/v1/reservieren', gast({ beginn: '19:00', email: 'dritter@example.com' })); assert.equal(s3, 200);
  // Reservierung läuft ab → Zeit wieder frei
  versatz = 11 * 60000; await worker.scheduled({}, env, { waitUntil: p => p });
  versatz = 0;
  const v = await sync(); assert.equal(v.d.buchungen.find(b => b.ref === r3.ref).status, 'abgelaufen');
});

test('Bezahlen per Weiterleitung: Capture serverseitig, nur COMPLETED = bezahlt, Abgleich meldet die Buchung bis zur Quittung', async () => {
  await sync();
  const r = await buchen({ platz: 2, datum: D2, beginn: '10:00' });
  const seite = await (await rufe(`/buchung/${r.ref}?t=${r.t}`)).text();
  assert.match(seite, /Bezahlt/);
  assert.match(seite, /Buchung stornieren/);
  const capCall = mock.aufrufe.filter(a => /\/capture$/.test(a.pfad));
  assert.ok(capCall.length >= 1);
  let s = await sync();
  const b = s.d.buchungen.find(x => x.ref === r.ref);
  assert.equal(b.status, 'bezahlt'); assert.equal(b.betrag, 2400); assert.ok(b.capture_id); assert.match(b.link, new RegExp(`/buchung/${r.ref}\\?t=`));
  s = await sync({ quittungen: [{ ref: r.ref, version: b.version, stand: 'eingetragen' }] });
  s = await sync(); assert.ok(!s.d.buchungen.some(x => x.ref === r.ref), 'nach Quittung nicht mehr gemeldet');
  assert.match(await (await rufe(`/buchung/${r.ref}?t=${r.t}`)).text(), /Code fürs Tor ist unterwegs/);
  assert.equal((await rufe(`/buchung/${r.ref}?t=falsch`)).status, 404, 'Link ohne richtiges Token');
  // Zeit ist jetzt belegt
  const [s2] = await jrufe('/api/v1/reservieren', gast({ platz: 2, datum: D2, beginn: '10:00', email: 'x@example.com' })); assert.equal(s2, 409);
  // Storno durch den Gast vor der Frist: Erstattung, danach „erstattet“
  const fd = new FormData(); fd.set('t', r.t);
  const st = await (await rufe(`/buchung/${r.ref}/storno`, { method: 'POST', body: fd })).text();
  assert.match(st, /Storniert/);
  s = await sync(); const e = s.d.buchungen.find(x => x.ref === r.ref);
  assert.equal(e.status, 'erstattet'); assert.ok(e.refund_id);
  assert.equal(mock.daten.captures.get(e.capture_id).status, 'REFUNDED');
});

test('Storno nach der Frist geht nicht; Storno durch den Verein erstattet trotzdem', async () => {
  await sync();
  const r = await buchen({ beginn: '18:00' });
  versatz = 3 * 86400000 - 3600000;   // eine Stunde vor 18:00 an D1 … (grob: Frist 24 h ist vorbei)
  const fd = new FormData(); fd.set('t', r.t);
  assert.match(await (await rufe(`/buchung/${r.ref}/storno`, { method: 'POST', body: fd })).text(), /nur bis 24 Stunden vor Beginn/);
  versatz = 0;
  const s = await sync({ stornos: [{ ref: r.ref, grund: 'Platzsperre (Regen)' }] });
  const e = s.d.buchungen.find(x => x.ref === r.ref);
  assert.equal(e.status, 'erstattet'); assert.equal(e.grund, 'Platzsperre (Regen)');
});

test('Platz in Clubwerk schon vergeben: reserviert → nicht abbuchen; bezahlt → erstatten', async () => {
  await sync();
  const [, r] = await jrufe('/api/v1/reservieren', gast({ beginn: '19:00', email: 'a@example.com' }));
  let s = await sync(); const b = s.d.buchungen.find(x => x.ref === r.ref);
  await sync({ quittungen: [{ ref: r.ref, version: b.version, stand: 'belegt' }] });
  mock.freigeben(r.order_id);
  await rufe(`/zurueck/${r.ref}?t=${r.t}&token=${r.order_id}`);
  assert.ok(!mock.daten.orders.get(r.order_id).purchase_units[0].payments, 'nichts abgebucht');
  assert.match(await (await rufe(`/buchung/${r.ref}?t=${r.t}`)).text(), /inzwischen vergeben/);
});

test('Zahlung vorläufig (PENDING): Platz gehalten, nach Abschluss per Webhook bezahlt; gefälschte Webhooks zählen nicht', async () => {
  await sync({ frei: [{ platz: 2, datum: D2, zeiten: [['12:00', '13:00', ab(D2, '12:00')]] }] });
  mock.einstellen({ capture: 'PENDING' });
  const r = await buchen({ platz: 2, datum: D2, beginn: '12:00' });
  mock.einstellen({ capture: 'COMPLETED' });
  let s = await sync(); let b = s.d.buchungen.find(x => x.ref === r.ref);
  assert.equal(b.status, 'vorlaeufig');
  mock.capture(b.capture_id, { status: 'COMPLETED' });
  const url = 'http://127.0.0.1:1/egal';
  const an = async (falsch) => { const orig = globalThis.fetch; let st = 0;
    globalThis.fetch = async (u, i) => (String(u) === url ? worker.fetch(new Request(W + '/api/v1/webhook', i), env, {}) : orig(u, i));
    try { st = await mock.webhook(url, 'PAYMENT.CAPTURE.COMPLETED', { id: b.capture_id, custom_id: r.ref, status: 'COMPLETED' }, { falsch }); } finally { globalThis.fetch = orig; } return st; };
  const stand = () => env.DB._db.prepare('SELECT status FROM buchung WHERE ref = ?').get(r.ref).status;
  assert.equal(await an('signatur'), 400);
  assert.equal(await an('zert'), 400);
  assert.equal(stand(), 'vorlaeufig', 'gefälschter Webhook stößt nichts an');
  assert.equal(await an(null), 200);
  assert.equal(stand(), 'bezahlt', 'echter Webhook: Stand bei PayPal nachgelesen');
  s = await sync(); b = s.d.buchungen.find(x => x.ref === r.ref);
  assert.equal(b.status, 'bezahlt');
});

test('Karte abgelehnt (INSTRUMENT_DECLINED): Gast kann es noch einmal versuchen', async () => {
  await sync();
  const [, r] = await jrufe('/api/v1/reservieren', gast({ beginn: '19:00', email: 'k@example.com', weg: 'sdk' }));
  mock.freigeben(r.order_id); mock.einstellen({ capture: 'INSTRUMENT_DECLINED' });
  const [s1, a] = await jrufe('/api/v1/bezahlen', { ref: r.ref, t: r.t, order_id: r.order_id });
  assert.equal(s1, 200); assert.equal(a.status, 'nochmal');
  const [, b] = await jrufe('/api/v1/bezahlen', { ref: r.ref, t: r.t, order_id: r.order_id });
  assert.equal(b.status, 'bezahlt');
  const [s3] = await jrufe('/api/v1/bezahlen', { ref: r.ref, t: 'falsch', order_id: r.order_id }); assert.equal(s3, 404);
});

test('Turnstile: ohne, mit falschem oder schon benutztem Token und bei Ausfall keine Reservierung', async () => {
  await sync({ frei: [{ platz: 1, datum: D2, zeiten: [['09:00', '10:00', ab(D2, '09:00')]] }] });
  env.DB._db.exec('DELETE FROM bremse');   // Bremse je Adresse aus den Tests davor
  const [s1, r1] = await jrufe('/api/v1/reservieren', gast({ datum: D2, beginn: '09:00', turnstile: undefined })); assert.equal(s1, 403, JSON.stringify(r1));
  const [s2] = await jrufe('/api/v1/reservieren', gast({ datum: D2, beginn: '09:00', turnstile: 'erfunden' })); assert.equal(s2, 403);
  const tok = 'mensch-ok-einmal';
  const [s3, r3] = await jrufe('/api/v1/reservieren', gast({ datum: D2, beginn: '09:00', turnstile: tok, email: 't1@example.com' })); assert.equal(s3, 200, JSON.stringify(r3));
  await rufe(`/abbruch/${r3.ref}?t=${r3.t}`);
  const [s4] = await jrufe('/api/v1/reservieren', gast({ datum: D2, beginn: '09:00', turnstile: tok, email: 't2@example.com' })); assert.equal(s4, 403, 'Token nur einmal');
  mock.einstellen({ turnstile: 'aus' });
  const [s5, r5] = await jrufe('/api/v1/reservieren', gast({ datum: D2, beginn: '09:00', email: 't3@example.com' })); assert.equal(s5, 503, JSON.stringify(r5));
  mock.einstellen({ turnstile: 'an' });
  const ohne = { ...env, TURNSTILE_SECRET: '' };
  const r6 = await worker.fetch(new Request(W + '/api/v1/reservieren', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gast({ datum: D2, beginn: '09:00' })) }), ohne, {});
  assert.equal(r6.status, 503, 'ohne Schlüssel keine Reservierung');
  const seite = await rufe('/');
  assert.match(seite.headers.get('content-security-policy'), /script-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(await seite.text(), /data-turnstile="1x00000000000000000000AA"/);
});
