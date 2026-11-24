// Buchungsseite für Gäste (Cloudflare Worker + D1). Gäste buchen freie Zeiten, die Clubwerk freigibt, und zahlen mit PayPal oder
// Debit-/Kreditkarte (PayPal Orders v2). Clubwerk ruft diese Seite nur selbst auf (ausgehend, signiert) – die Seite erreicht Clubwerk nie.
// Schnittstelle: SCHNITTSTELLE.md. Einrichtung: README.md.
import { schluesselBytes, pruefeAnfrage, signiereAntwort, gleich, sha256hex } from './signatur.js';
import * as PP from './paypal.js';
import * as SEITE from './seiten.js';

const SCHNITTSTELLE = 1;   // Version der Schnittstelle (SCHNITTSTELLE.md); keine weiteren Exporte – workerd hält sie für Einstiegspunkte
const STILLE_MIN = 10;              // ohne Abgleich seit so vielen Minuten: keine Buchungen (freie Zeiten wären veraltet)
const AKTIV = ['reserviert', 'bezahlt', 'vorlaeufig', 'storno_angefragt', 'erstattung_laeuft', 'erstattung_fehler'];   // belegen die Zeit
const BEZAHLT = ['bezahlt', 'storno_angefragt', 'erstattung_laeuft', 'erstattung_fehler'];

/* ---------------------------------------------------------------- kleine Helfer */
const jetzt = env => (env.__jetzt ? env.__jetzt() : Date.now());   // Tests stellen die Uhr
const json = (d, status = 200, extra = {}) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEITE.apiKopf(), ...extra } });
const fehler = (text, status = 400) => json({ fehler: text }, status);
const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const istDatum = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const istZeit = s => /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(String(s || ''));
const MAIL_RE = /^[^\s@<>,;"]{1,64}@[^\s@<>,;"]{1,180}\.[a-z]{2,}$/i;
const TEL_RE = /^\+?[0-9 ()/-]{6,30}$/;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const neueRef = () => { const b = crypto.getRandomValues(new Uint8Array(8)); return 'G-' + [...b].map(x => ALPHA[x % 32]).join('').replace(/^(.{4})/, '$1-'); };

function db(env) {
  const D = env.DB;
  return {
    eins: (sql, ...a) => D.prepare(sql).bind(...a).first(),
    alle: async (sql, ...a) => (await D.prepare(sql).bind(...a).all()).results || [],
    los: async (sql, ...a) => (await D.prepare(sql).bind(...a).run()).meta || {},
    stmt: (sql, ...a) => D.prepare(sql).bind(...a),
    stapel: list => (list.length ? D.batch(list) : Promise.resolve([])),
  };
}
async function einstellung(env, k, d = null) { const r = await db(env).eins('SELECT v FROM einstellung WHERE k = ?', k); if (!r) return d; try { return JSON.parse(r.v); } catch (e) { return d; } }
const setzeStmt = (env, k, v) => db(env).stmt('INSERT INTO einstellung(k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, JSON.stringify(v));

/** Link für Bestätigung und Storno: HMAC aus dem gemeinsamen Schlüssel und der Buchungsnummer (wird nicht gespeichert) */
async function linkToken(env, ref) {
  const raw = schluesselBytes(env.CLUBWERK_SCHLUESSEL); if (!raw) throw new Error('CLUBWERK_SCHLUESSEL fehlt');
  const k = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('gaeste-link:' + ref)));
  return btoa(String.fromCharCode(...s.subarray(0, 24))).replace(/\+/g, '-').replace(/\//g, '_');
}
async function tokenOk(env, ref, t) { return /^G-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(ref) && gleich(await linkToken(env, ref), String(t || '')); }
const basis = req => new URL(req.url).origin;
const linkVon = async (env, req, ref) => `${basis(req)}/buchung/${ref}?t=${await linkToken(env, ref)}`;

/** Bremse je Absenderadresse: höchstens n Versuche je Fenster */
async function bremse(env, req, art, n, ms) {
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'lokal', k = `${art}:${ip}`, t = jetzt(env);
  const r = await db(env).eins('SELECT n, bis FROM bremse WHERE k = ?', k);
  if (r && r.bis > t) { if (r.n >= n) return false; await db(env).los('UPDATE bremse SET n = n + 1 WHERE k = ?', k); return true; }
  await db(env).los('INSERT INTO bremse(k, n, bis) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = 1, bis = excluded.bis', k, t + ms);
  return true;
}

/** Zustand für die Seite: offline (kein Abgleich), zu (Verein nimmt keine Buchungen), sonst offen */
async function lage(env) {
  const [abgleich, regeln, anzeige, logo] = await Promise.all([einstellung(env, 'abgleich', 0), einstellung(env, 'regeln', {}), einstellung(env, 'anzeige', {}), einstellung(env, 'logo_hash', '')]);
  const offline = !abgleich || jetzt(env) - abgleich > STILLE_MIN * 60000;
  return { offline, zu: !regeln.aktiv, regeln: { storno_stunden: 24, halten_min: 10, waehrung: 'EUR', ...regeln }, anzeige: anzeige || {}, abgleich, logo: Boolean(logo), paypalArt: PP.umgebung(env).art };
}

/* Konflikt: eine andere aktive Buchung desselben Platzes überschneidet die Zeit (reserviert nur, solange gehalten) */
const KONFLIKT = `SELECT 1 FROM buchung o WHERE o.platz = ?1 AND o.datum = ?2 AND o.beginn < ?4 AND o.ende > ?3 AND o.ref != ?5
  AND o.status IN (${AKTIV.map(s => `'${s}'`).join(',')}) AND NOT (o.status = 'reserviert' AND o.halten_bis < ?6) AND COALESCE(o.verein, '') != 'belegt'`;

/* ---------------------------------------------------------------- Angebot und Reservierung */
async function angebot(env) {
  const l = await lage(env);
  const out = { schnittstelle: SCHNITTSTELLE, offline: l.offline, zu: l.zu, verein: l.anzeige.verein || '', regeln: { storno_stunden: l.regeln.storno_stunden, waehrung: l.regeln.waehrung },
    paypal: { client_id: String(env.PAYPAL_CLIENT_ID || ''), art: PP.umgebung(env).art }, turnstile: String(env.TURNSTILE_SITE_KEY || ''), tage: [] };
  if (l.offline || l.zu) return out;
  const t = jetzt(env), D = db(env);
  const plaetze = await D.alle('SELECT * FROM platz ORDER BY sort, name');
  const zeiten = await D.alle('SELECT * FROM zeit WHERE ab > ? ORDER BY datum, beginn', t + 5 * 60000);
  const belegt = await D.alle(`SELECT platz, datum, beginn, ende FROM buchung WHERE ab > ? AND status IN (${AKTIV.map(s => `'${s}'`).join(',')}) AND NOT (status = 'reserviert' AND halten_bis < ?) AND COALESCE(verein, '') != 'belegt'`, t - 24 * 3600000, t);
  const tage = new Map();
  for (const z of zeiten) {
    const p = plaetze.find(x => x.id === z.platz); if (!p) continue;
    if (belegt.some(b => b.platz === z.platz && b.datum === z.datum && b.beginn < z.ende && b.ende > z.beginn)) continue;
    if (!tage.has(z.datum)) tage.set(z.datum, new Map());
    const pm = tage.get(z.datum); if (!pm.has(p.id)) pm.set(p.id, { id: p.id, name: p.name, minuten: p.minuten, zeiten: [] });
    pm.get(p.id).zeiten.push({ beginn: z.beginn, ende: z.ende, preis: p.preis });
  }
  out.tage = [...tage.entries()].map(([datum, pm]) => ({ datum, plaetze: plaetze.filter(p => pm.has(p.id)).map(p => pm.get(p.id)) }));
  return out;
}

/* Cloudflare Turnstile (gegen Massen-Reservierungen, zusätzlich zur Bremse je Adresse): Token serverseitig prüfen.
   Ohne Schlüssel nimmt die Seite keine Reservierungen an; nicht erreichbar oder ungültig → ablehnen. */
const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
function turnstileUrl(env) {
  const u = String(env.TURNSTILE_VERIFY_URL || '');
  return PP.umgebung(env).art === 'test' && /^http:\/\/127\.0\.0\.1:\d+\//.test(u) ? u : TURNSTILE_URL;   // Nachbau nur in den Testreihen
}
async function mensch(env, req, token) {
  const secret = String(env.TURNSTILE_SECRET || '');
  if (!secret || !env.TURNSTILE_SITE_KEY) return 'nicht_eingerichtet';
  if (typeof token !== 'string' || !token || token.length > 2048) return 'fehlt';
  const f = new FormData(); f.set('secret', secret); f.set('response', token);
  const ip = req.headers.get('cf-connecting-ip'); if (ip) f.set('remoteip', ip);
  try {
    const r = await fetch(turnstileUrl(env), { method: 'POST', body: f, signal: AbortSignal.timeout(8000) });
    if (r.status >= 500) return 'unerreichbar';
    const d = await r.json().catch(() => ({}));
    return r.ok && d.success === true && (!d.action || d.action === 'reservieren') ? 'ok' : 'ungueltig';
  } catch (e) { return 'unerreichbar'; }
}
async function reservieren(env, req) {
  if (!await bremse(env, req, 'res', 8, 10 * 60000)) return fehler('Zu viele Versuche. Bitte in ein paar Minuten noch einmal.', 429);
  const b = await req.json().catch(() => ({}));
  const l = await lage(env);
  if (l.offline) return fehler('Die Online-Buchung ist gerade nicht möglich. Bitte später noch einmal versuchen.', 503);
  if (l.zu) return fehler('Der Verein nimmt gerade keine Online-Buchungen an.', 503);
  const m = await mensch(env, req, b.turnstile);
  if (m === 'nicht_eingerichtet') return fehler('Die Online-Buchung ist noch nicht fertig eingerichtet.', 503);
  if (m === 'unerreichbar') return fehler('Die Sicherheitsprüfung ist gerade nicht erreichbar. Bitte gleich noch einmal versuchen.', 503);
  if (m !== 'ok') return fehler('Bitte die Sicherheitsprüfung abschließen und noch einmal versuchen.', 403);
  const vorname = txt(b.vorname, 60), nachname = txt(b.nachname, 60), email = txt(b.email, 160).toLowerCase(), telefon = txt(b.telefon, 30);
  if (!vorname || !nachname) return fehler('Bitte Vor- und Nachnamen angeben.');
  if (!MAIL_RE.test(email)) return fehler('Bitte eine gültige E-Mail-Adresse angeben.');
  if (!TEL_RE.test(telefon)) return fehler('Bitte eine Handynummer angeben (nur Ziffern, Leerzeichen, +).');
  if (b.zustimmung !== true) return fehler('Bitte den Hinweisen zu Datenschutz und Storno zustimmen.');
  const platz = Number(b.platz), datum = String(b.datum || ''), beginn = String(b.beginn || '');
  if (!Number.isInteger(platz) || !istDatum(datum) || !istZeit(beginn)) return fehler('Bitte eine freie Zeit wählen.');
  const D = db(env), t = jetzt(env);
  const z = await D.eins('SELECT z.*, p.name, p.preis FROM zeit z JOIN platz p ON p.id = z.platz WHERE z.platz = ? AND z.datum = ? AND z.beginn = ? AND z.ab > ?', platz, datum, beginn, t + 5 * 60000);
  if (!z) return fehler('Diese Zeit ist nicht mehr frei. Bitte eine andere wählen.', 409);
  const weg = b.weg === 'weiterleitung' || PP.umgebung(env).art === 'test' ? 'weiterleitung' : 'sdk';
  const ref = neueRef(), halten = Math.max(5, Math.min(30, Number(l.regeln.halten_min) || 10));
  // prüfen und eintragen in einer Anweisung: zwei Gäste gleichzeitig bekommen nie dieselbe Zeit
  const r = await D.los(`INSERT INTO buchung(ref, platz, platz_name, datum, beginn, ende, ab, betrag, waehrung, vorname, nachname, email, telefon, status, halten_bis, weg, erstellt)
    SELECT ?5, ?1, ?7, ?2, ?3, ?4, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 'reserviert', ?15, ?16, ?6 WHERE NOT EXISTS (${KONFLIKT})`,
  platz, datum, z.beginn, z.ende, ref, t, z.name, z.ab, z.preis, String(l.regeln.waehrung || 'EUR'), vorname, nachname, email, telefon, t + halten * 60000, weg);
  if (!r.changes) return fehler('Diese Zeit ist gerade reserviert oder vergeben. Bitte eine andere wählen.', 409);
  const tok = await linkToken(env, ref), base = basis(req);
  const pu = [{ reference_id: ref, custom_id: ref, invoice_id: ref, description: `${z.name}, ${SEITE.deD(datum)} ${z.beginn}–${z.ende} Uhr`.slice(0, 127),
    amount: { currency_code: String(l.regeln.waehrung || 'EUR'), value: PP.wert(z.preis) } }];
  const ctx = { brand_name: String(l.anzeige.verein || 'Verein').slice(0, 127), locale: 'de-DE', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' };
  const body = weg === 'weiterleitung'
    ? { intent: 'CAPTURE', purchase_units: pu, payment_source: { paypal: { experience_context: { ...ctx, landing_page: b.karte ? 'GUEST_CHECKOUT' : 'LOGIN',
      return_url: `${base}/zurueck/${ref}?t=${tok}`, cancel_url: `${base}/abbruch/${ref}?t=${tok}` } } } }
    : { intent: 'CAPTURE', purchase_units: pu, application_context: ctx };
  let order;
  try { order = await PP.client(env).order(body, 'ord-' + ref); } catch (e) {
    await D.los("UPDATE buchung SET status = 'abgelehnt', fehler = ?, version = version + 1 WHERE ref = ?", txt(e.message, 200), ref);
    return fehler('PayPal ist gerade nicht erreichbar. Bitte später noch einmal versuchen.', 502);
  }
  await D.los('UPDATE buchung SET order_id = ?, version = version + 1 WHERE ref = ?', order.id, ref);
  const weiter = ((order.links || []).find(x => x.rel === 'payer-action' || x.rel === 'approve') || {}).href || null;
  return json({ ref, t: tok, order_id: order.id, weiter: weg === 'weiterleitung' ? weiter : null, halten_bis: t + halten * 60000 });
}

/* ---------------------------------------------------------------- Zahlung abschließen (Capture serverseitig) */
async function abschliessen(env, ref) {
  const D = db(env), t = jetzt(env);
  const bk = await D.eins('SELECT * FROM buchung WHERE ref = ?', ref);
  if (!bk) return { status: 'unbekannt' };
  if (bk.status !== 'reserviert') return { status: bk.status };
  if (bk.verein === 'belegt') { await D.los("UPDATE buchung SET status = 'abgelehnt', fehler = 'belegt', version = version + 1 WHERE ref = ?", ref); return { status: 'abgelehnt', grund: 'belegt' }; }
  // Zeit abgelaufen? Nur weiter, wenn niemand sonst sie inzwischen hat (sonst wird nichts abgebucht)
  const halt = await D.los(`UPDATE buchung SET halten_bis = ?6 + 600000 WHERE ref = ?5 AND status = 'reserviert' AND NOT EXISTS (${KONFLIKT})`, bk.platz, bk.datum, bk.beginn, bk.ende, ref, t);
  if (!halt.changes) { await D.los("UPDATE buchung SET status = 'abgelaufen', version = version + 1 WHERE ref = ? AND status = 'reserviert'", ref); return { status: 'abgelaufen' }; }
  let order;
  try { order = await PP.client(env).capture(bk.order_id, 'cap-' + ref); } catch (e) {
    if (e instanceof PP.PayPalFehler && e.issue === 'ORDER_ALREADY_CAPTURED') order = await PP.client(env).orderLesen(bk.order_id);
    else if (e instanceof PP.PayPalFehler && e.issue === 'INSTRUMENT_DECLINED') return { status: 'nochmal' };   // Käufer wählt eine andere Zahlart (SDK: actions.restart)
    else { await D.los('UPDATE buchung SET fehler = ? WHERE ref = ?', txt(e.message, 200), ref); return { status: 'fehler' }; }
  }
  const cap = PP.captureAus(order);
  if (!cap) return { status: 'fehler' };
  const passt = cap.custom_id === ref && cap.amount && cap.amount.currency_code === bk.waehrung && PP.cent(cap.amount.value) === bk.betrag;
  const neu = !passt ? 'erstattung_fehler' : cap.status === 'COMPLETED' ? 'bezahlt' : cap.status === 'PENDING' ? 'vorlaeufig' : 'abgelehnt';
  await D.los('UPDATE buchung SET status = ?, capture_id = ?, bezahlt_am = ?, fehler = ?, version = version + 1 WHERE ref = ?', neu, cap.id, neu === 'bezahlt' ? t : null, passt ? null : 'Betrag oder Buchungsnummer der Zahlung passen nicht', ref);
  return { status: neu };
}

/* ---------------------------------------------------------------- Erstattung (Storno durch Gast oder Verein) */
async function erstatten(env, ref, grund) {
  const D = db(env), bk = await D.eins('SELECT * FROM buchung WHERE ref = ?', ref);
  if (!bk || !bk.capture_id || !['bezahlt', 'storno_angefragt'].includes(bk.status)) return bk ? bk.status : 'unbekannt';
  if (bk.status === 'bezahlt') await D.los("UPDATE buchung SET status = 'storno_angefragt', storno_am = COALESCE(storno_am, ?), verein_grund = COALESCE(verein_grund, ?), version = version + 1 WHERE ref = ?", jetzt(env), grund || null, ref);
  try {
    const r = await PP.client(env).erstatten(bk.capture_id, { note_to_payer: `Storno ${ref}`.slice(0, 255) }, 'ref-' + ref);
    const neu = r.status === 'COMPLETED' ? 'erstattet' : r.status === 'PENDING' ? 'erstattung_laeuft' : 'erstattung_fehler';
    await D.los('UPDATE buchung SET status = ?, refund_id = ?, fehler = NULL, version = version + 1 WHERE ref = ?', neu, r.id, ref);
    return neu;
  } catch (e) {
    // bleibt „storno_angefragt“: der nächste Abgleich bzw. der Zeitplan versucht es noch einmal (gleiche PayPal-Request-Id)
    await D.los('UPDATE buchung SET fehler = ? WHERE ref = ?', txt(e.message, 200), ref);
    return 'storno_angefragt';
  }
}

/** Zahlungsstand einer Buchung bei PayPal nachlesen (vorläufig, Erstattung läuft, Webhook) */
async function nachlesen(env, bk) {
  const D = db(env), pp = PP.client(env), t = jetzt(env);
  if (bk.status === 'reserviert' && bk.order_id) {   // Käufer hat freigegeben, aber die Seite geschlossen
    const o = await pp.orderLesen(bk.order_id).catch(() => null);
    if (o && o.status === 'APPROVED') return abschliessen(env, bk.ref);
    if (o && o.status === 'COMPLETED') return abschliessen(env, bk.ref);
    return null;
  }
  if (bk.refund_id && ['erstattung_laeuft', 'erstattung_fehler'].includes(bk.status)) {
    const r = await pp.erstattungLesen(bk.refund_id).catch(() => null);
    if (r && r.status === 'COMPLETED') await D.los("UPDATE buchung SET status = 'erstattet', version = version + 1 WHERE ref = ?", bk.ref);
    if (r && ['FAILED', 'CANCELLED'].includes(r.status) && bk.status !== 'erstattung_fehler') await D.los("UPDATE buchung SET status = 'erstattung_fehler', fehler = 'Erstattung abgelehnt', version = version + 1 WHERE ref = ?", bk.ref);
    return null;
  }
  if (!bk.capture_id) return null;
  const c = await pp.captureLesen(bk.capture_id).catch(() => null);
  if (!c) return null;
  if (c.status === 'COMPLETED' && bk.status === 'vorlaeufig') {
    await D.los("UPDATE buchung SET status = 'bezahlt', bezahlt_am = ?, version = version + 1 WHERE ref = ?", t, bk.ref);
    if (bk.verein_grund || bk.verein === 'belegt') await erstatten(env, bk.ref, bk.verein_grund || 'Platz war inzwischen vergeben');
  } else if (['DECLINED', 'FAILED'].includes(c.status) && ['vorlaeufig', 'bezahlt'].includes(bk.status)) {
    await D.los("UPDATE buchung SET status = 'abgelehnt', version = version + 1 WHERE ref = ?", bk.ref);
  } else if (c.status === 'REFUNDED' && !['erstattet'].includes(bk.status)) {
    await D.los("UPDATE buchung SET status = 'erstattet', storno_am = COALESCE(storno_am, ?), version = version + 1 WHERE ref = ?", t, bk.ref);
  } else if (['PARTIALLY_REFUNDED', 'REVERSED'].includes(c.status) && bk.status !== 'erstattung_fehler') {
    await D.los("UPDATE buchung SET status = 'erstattung_fehler', fehler = ?, version = version + 1 WHERE ref = ?", c.status === 'REVERSED' ? 'Zahlung zurückgebucht (Käuferschutz)' : 'nur teilweise erstattet', bk.ref);
  }
  return null;
}

/* ---------------------------------------------------------------- Pflege: abgelaufene Reservierungen, offene Zahlungen, Löschfristen */
async function pflegen(env, max = 5) {
  const D = db(env), t = jetzt(env);
  // reservierte Zeiten nach Ablauf freigeben; Order vorher noch einmal ansehen (freigegeben → abschließen)
  for (const bk of await D.alle("SELECT * FROM buchung WHERE status = 'reserviert' AND halten_bis < ? LIMIT ?", t, max)) {
    const r = await nachlesen(env, bk).catch(() => null);
    if (!r || r.status === 'reserviert') await D.los("UPDATE buchung SET status = 'abgelaufen', version = version + 1 WHERE ref = ? AND status = 'reserviert'", bk.ref);
  }
  for (const bk of await D.alle("SELECT * FROM buchung WHERE status IN ('vorlaeufig', 'erstattung_laeuft') OR (status = 'erstattung_fehler' AND refund_id IS NOT NULL) ORDER BY erstellt LIMIT ?", max)) await nachlesen(env, bk).catch(() => null);
  for (const bk of await D.alle("SELECT ref, verein_grund FROM buchung WHERE status = 'storno_angefragt' LIMIT ?", max)) await erstatten(env, bk.ref, bk.verein_grund).catch(() => null);
  // Datensparsamkeit: Kontaktdaten 30 Tage nach dem Termin löschen, Buchungen nach 120 Tagen ganz (Clubwerk hat die Belege)
  const tag = ms => new Date(ms).toISOString().slice(0, 10);
  await D.stapel([
    D.stmt("UPDATE buchung SET vorname = '', nachname = '', email = '', telefon = '' WHERE datum < ? AND email != ''", tag(t - 30 * 86400000)),
    D.stmt("UPDATE buchung SET vorname = '', nachname = '', email = '', telefon = '' WHERE status IN ('abgelaufen', 'abgelehnt') AND erstellt < ? AND email != '' AND gemeldet >= version", t - 2 * 86400000),
    D.stmt('DELETE FROM buchung WHERE datum < ? AND gemeldet >= version', tag(t - 120 * 86400000)),
    D.stmt('DELETE FROM nonce WHERE bis < ?', Date.now()), D.stmt('DELETE FROM ereignis WHERE bis < ?', t), D.stmt('DELETE FROM bremse WHERE bis < ?', t),
  ]);
}

/* ---------------------------------------------------------------- Abgleich mit Clubwerk (signiert, nur Clubwerk ruft) */
const MAX_BODY = 1024 * 1024;
async function abgleich(env, req) {
  const raw = schluesselBytes(env.CLUBWERK_SCHLUESSEL);
  if (!raw) return fehler('Buchungsseite nicht eingerichtet (CLUBWERK_SCHLUESSEL).', 503);
  const body = await req.text();
  if (body.length > MAX_BODY) return fehler('zu groß', 413);
  const p = await pruefeAnfrage(raw, 'POST', '/api/v1/sync', req.headers, body, Date.now());   // Signaturzeit: echte Uhr (Testuhr nur für Fachliches)
  if (!p.ok) return fehler('Signatur ungültig', 401);
  const D = db(env), t = jetzt(env);
  const n = await D.los('INSERT OR IGNORE INTO nonce(n, bis) VALUES (?, ?)', p.nonce, Date.now() + 15 * 60000);
  if (!n.changes) return fehler('Anfrage schon verarbeitet', 401);   // Wiederholung (Replay)
  let d; try { d = JSON.parse(body); } catch (e) { return fehler('kein JSON'); }
  if (d.v !== SCHNITTSTELLE) return fehler(`Schnittstelle ${d.v} nicht unterstützt (Buchungsseite: ${SCHNITTSTELLE})`, 409);

  const st = [setzeStmt(env, 'abgleich', t)];
  if (d.anzeige && typeof d.anzeige === 'object') {
    const a = d.anzeige, url = v => { try { const u = new URL(String(v)); return u.protocol === 'https:' ? u.href.slice(0, 300) : ''; } catch (e) { return ''; } };
    const origins = String(a.homepage || '').split(/\s+/).map(v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username ? u.origin : ''; } catch (e) { return ''; } }).filter(Boolean).slice(0, 5);
    st.push(setzeStmt(env, 'anzeige', { verein: txt(a.verein, 80), farbe: /^#[0-9a-f]{6}$/i.test(String(a.farbe)) ? a.farbe : '#1f6f43', homepage: origins, impressum: url(a.impressum), datenschutz: url(a.datenschutz),
      hinweis: String(a.hinweis || '').replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').slice(0, 3000), sprache: a.sprache === 'en' ? 'en' : 'de' }));
    if (typeof a.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.logo) && a.logo.length < 200000) { st.push(setzeStmt(env, 'logo', a.logo)); st.push(setzeStmt(env, 'logo_hash', await sha256hex(a.logo))); }
    if (a.logo === null) { st.push(setzeStmt(env, 'logo', '')); st.push(setzeStmt(env, 'logo_hash', '')); }
  }
  if (d.regeln && typeof d.regeln === 'object') {
    const r = d.regeln, zahl = (v, lo, hi, def) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : def; };
    st.push(setzeStmt(env, 'regeln', { aktiv: r.aktiv === true, storno_stunden: zahl(r.storno_stunden, 0, 720, 24), halten_min: zahl(r.halten_min, 5, 30, 10), waehrung: 'EUR' }));
  }
  if (Array.isArray(d.plaetze) && Array.isArray(d.frei)) {   // freie Zeiten ersetzen
    const plaetze = d.plaetze.slice(0, 40).filter(x => Number.isInteger(x.id) && x.id > 0 && Number.isInteger(x.preis) && x.preis > 0 && x.preis < 100000 && Number.isInteger(x.minuten) && x.minuten >= 15 && x.minuten <= 480);
    st.push(D.stmt('DELETE FROM platz'), D.stmt('DELETE FROM zeit'));
    plaetze.forEach((x, i) => st.push(D.stmt('INSERT INTO platz(id, name, sort, minuten, preis) VALUES (?, ?, ?, ?, ?)', x.id, txt(x.name, 60) || 'Platz', i, x.minuten, x.preis)));
    const ids = new Set(plaetze.map(x => x.id)), rows = [];
    for (const f of d.frei.slice(0, 2000)) {
      if (!ids.has(f.platz) || !istDatum(f.datum) || !Array.isArray(f.zeiten)) continue;
      for (const z of f.zeiten.slice(0, 96)) if (Array.isArray(z) && istZeit(z[0]) && istZeit(z[1]) && z[0] < z[1] && Number.isFinite(z[2])) rows.push([f.platz, f.datum, z[0], z[1], Math.round(z[2])]);
    }
    for (let i = 0; i < rows.length && i < 6000; i += 20) {   // D1: höchstens 100 Platzhalter je Anweisung
      const part = rows.slice(i, i + 20);
      st.push(D.stmt(`INSERT OR IGNORE INTO zeit(platz, datum, beginn, ende, ab) VALUES ${part.map(() => '(?, ?, ?, ?, ?)').join(', ')}`, ...part.flat()));
    }
  }
  await D.stapel(st);

  // Rückmeldungen von Clubwerk
  for (const q of (Array.isArray(d.quittungen) ? d.quittungen : []).slice(0, 500)) {
    if (!q || typeof q.ref !== 'string' || !Number.isInteger(q.version)) continue;
    const stand = ['eingetragen', 'belegt', 'abweichung', 'storniert', 'erledigt', 'vorlaeufig'].includes(q.stand) ? q.stand : null;
    await D.los('UPDATE buchung SET gemeldet = MAX(gemeldet, ?), verein = COALESCE(?, verein) WHERE ref = ?', q.version, stand, q.ref);
    if (stand === 'belegt') {   // Platz in Clubwerk schon vergeben: nicht abbuchen bzw. erstatten
      const bk = await D.eins('SELECT status FROM buchung WHERE ref = ?', q.ref);
      if (bk && bk.status === 'reserviert') await D.los("UPDATE buchung SET status = 'abgelehnt', fehler = 'belegt', version = version + 1 WHERE ref = ?", q.ref);
      else if (bk && bk.status === 'bezahlt') await erstatten(env, q.ref, 'Platz war inzwischen vergeben');
    }
  }
  // Stornos durch den Verein (Verwaltung, Platzsperre): erstatten
  for (const s of (Array.isArray(d.stornos) ? d.stornos : []).slice(0, 100)) {
    if (!s || typeof s.ref !== 'string') continue;
    const grund = txt(s.grund, 200) || 'Storno durch den Verein';
    const bk = await D.eins('SELECT status FROM buchung WHERE ref = ?', s.ref);
    if (!bk) continue;
    if (bk.status === 'reserviert') await D.los("UPDATE buchung SET status = 'abgelaufen', verein_grund = ?, version = version + 1 WHERE ref = ?", grund, s.ref);
    else if (bk.status === 'vorlaeufig') await D.los("UPDATE buchung SET verein_grund = ?, version = version + 1 WHERE ref = ? AND COALESCE(verein_grund, '') != ?", grund, s.ref, grund);   // erstatten, sobald die Zahlung durch ist
    else await erstatten(env, s.ref, grund);
  }
  await pflegen(env).catch(() => null);

  const offen = await D.alle('SELECT * FROM buchung WHERE version > gemeldet ORDER BY erstellt LIMIT 200');
  const antwort = { v: SCHNITTSTELLE, jetzt: jetzt(env), paypal: PP.umgebung(env).art, logo_hash: (await einstellung(env, 'logo_hash', '')) || '',
    buchungen: await Promise.all(offen.map(async b => ({ ref: b.ref, version: b.version, status: b.status, platz: b.platz, datum: b.datum, beginn: b.beginn, ende: b.ende, betrag: b.betrag, waehrung: b.waehrung,
      vorname: b.vorname, nachname: b.nachname, email: b.email, telefon: b.telefon, order_id: b.order_id, capture_id: b.capture_id, refund_id: b.refund_id,
      erstellt: b.erstellt, bezahlt_am: b.bezahlt_am, storno_am: b.storno_am, halten_bis: b.halten_bis, grund: b.verein_grund || null, fehler: b.fehler || null,
      link: BEZAHLT.concat(['vorlaeufig']).includes(b.status) ? await linkVon(env, req, b.ref) : null }))) };
  const text = JSON.stringify(antwort);
  return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEITE.apiKopf(), ...(await signiereAntwort(raw, p.nonce, text)) } });
}

/* ---------------------------------------------------------------- Webhook von PayPal (nur Anstoß – der Stand wird bei PayPal nachgelesen) */
const zertCache = new Map();
async function webhook(env, req) {
  const roh = new Uint8Array(await req.arrayBuffer());
  if (roh.length > 256 * 1024) return fehler('zu groß', 413);
  const holen = async url => { if (zertCache.has(url)) return zertCache.get(url); const r = await fetch(url); if (!r.ok) throw new Error('Zertifikat'); const t = await r.text(); zertCache.set(url, t); return t; };
  if (!await PP.pruefeWebhook(env, req.headers, roh, holen, jetzt(env))) return fehler('Signatur ungültig', 400);
  let ev; try { ev = JSON.parse(new TextDecoder().decode(roh)); } catch (e) { return fehler('kein JSON'); }
  const D = db(env);
  const neu = await D.los('INSERT OR IGNORE INTO ereignis(id, bis) VALUES (?, ?)', String(ev.id || '').slice(0, 80), jetzt(env) + 4 * 86400000);
  if (!neu.changes) return json({ ok: true, doppelt: true });
  const res = ev.resource || {}, typ = String(ev.event_type || '');
  let bk = null;
  if (typ.startsWith('CHECKOUT.ORDER.')) bk = await D.eins('SELECT * FROM buchung WHERE order_id = ?', String(res.id || ''));
  else if (typ.startsWith('PAYMENT.CAPTURE.')) bk = await D.eins('SELECT * FROM buchung WHERE capture_id = ? OR ref = ?', String(res.id || ''), String(res.custom_id || ''));
  // nie dem Inhalt glauben: Stand der eigenen Order bzw. Zahlung bei PayPal nachlesen
  if (bk && (bk.order_id || bk.capture_id)) await nachlesen(env, bk).catch(() => null);
  return json({ ok: true });
}

/* ---------------------------------------------------------------- Seiten für Gäste */
async function seiteBuchung(env, req, ref, t, meldung = '') {
  if (!await tokenOk(env, ref, t)) return SEITE.html(await lage(env), SEITE.fehlerSeite('Diese Buchung gibt es nicht oder der Link ist unvollständig.'), 404);
  let bk = await db(env).eins('SELECT * FROM buchung WHERE ref = ?', ref);
  if (!bk) return SEITE.html(await lage(env), SEITE.fehlerSeite('Diese Buchung ist nicht mehr gespeichert.'), 404);
  if (['vorlaeufig', 'reserviert', 'erstattung_laeuft'].includes(bk.status)) { await nachlesen(env, bk).catch(() => null); bk = await db(env).eins('SELECT * FROM buchung WHERE ref = ?', ref); }
  const l = await lage(env);
  const frist = bk.ab - l.regeln.storno_stunden * 3600000;
  return SEITE.html(l, SEITE.bestaetigung(bk, { token: t, stornoMoeglich: bk.status === 'bezahlt' && jetzt(env) < frist, frist, meldung, stunden: l.regeln.storno_stunden }));
}
async function storno(env, req, ref, form) {
  const t = form.get('t');
  if (!await tokenOk(env, ref, t)) return SEITE.html(await lage(env), SEITE.fehlerSeite('Der Link ist ungültig.'), 404);
  if (!await bremse(env, req, 'sto', 10, 10 * 60000)) return SEITE.html(await lage(env), SEITE.fehlerSeite('Zu viele Versuche. Bitte in ein paar Minuten noch einmal.'), 429);
  const bk = await db(env).eins('SELECT * FROM buchung WHERE ref = ?', ref), l = await lage(env);
  if (!bk || bk.status !== 'bezahlt') return seiteBuchung(env, req, ref, t, 'Diese Buchung lässt sich nicht (mehr) stornieren.');
  if (jetzt(env) >= bk.ab - l.regeln.storno_stunden * 3600000) return seiteBuchung(env, req, ref, t, `Stornieren geht nur bis ${l.regeln.storno_stunden} Stunden vor Beginn. Bitte wende dich an den Verein.`);
  const st = await erstatten(env, ref, 'Storno durch den Gast');
  return seiteBuchung(env, req, ref, t, st === 'erstattet' ? 'Storniert. Das Geld ist erstattet.' : 'Storniert. Die Erstattung läuft – das kann bei PayPal ein paar Minuten dauern.');
}

/* ---------------------------------------------------------------- Weiche */
async function route(req, env) {
  const url = new URL(req.url), p = url.pathname, m = req.method === 'HEAD' ? 'GET' : req.method;
  if (m === 'GET' && p === '/') { const l = await lage(env); return SEITE.html(l, SEITE.buchen(l, env, url), 200, { paypal: l.paypalArt !== 'test' }); }
  if (m === 'GET' && p === '/api/v1/angebot') return json(await angebot(env));
  if (m === 'POST' && p === '/api/v1/reservieren') return reservieren(env, req);
  if (m === 'POST' && p === '/api/v1/bezahlen') {
    if (!await bremse(env, req, 'bez', 20, 10 * 60000)) return fehler('Zu viele Versuche.', 429);
    const b = await req.json().catch(() => ({}));
    if (!await tokenOk(env, String(b.ref || ''), b.t)) return fehler('unbekannte Buchung', 404);
    const bk = await db(env).eins('SELECT order_id FROM buchung WHERE ref = ?', b.ref);
    if (!bk || bk.order_id !== b.order_id) return fehler('unbekannte Zahlung', 404);
    const r = await abschliessen(env, b.ref);
    return json({ ...r, link: await linkVon(env, req, b.ref) });
  }
  if (m === 'POST' && p === '/api/v1/abbrechen') {
    const b = await req.json().catch(() => ({}));
    if (!await tokenOk(env, String(b.ref || ''), b.t)) return fehler('unbekannte Buchung', 404);
    await db(env).los("UPDATE buchung SET status = 'abgelaufen', version = version + 1 WHERE ref = ? AND status = 'reserviert' AND capture_id IS NULL", b.ref);
    return json({ ok: true });
  }
  let x = p.match(/^\/zurueck\/(G-[A-Z0-9]{4}-[A-Z0-9]{4})$/);
  if (m === 'GET' && x) {   // Rückkehr von PayPal (Weiterleitung am Handy): jetzt abbuchen
    const t = url.searchParams.get('t');
    if (!await tokenOk(env, x[1], t)) return SEITE.html(await lage(env), SEITE.fehlerSeite('Der Link ist ungültig.'), 404);
    const bk = await db(env).eins('SELECT order_id FROM buchung WHERE ref = ?', x[1]);
    if (bk && url.searchParams.get('token') === bk.order_id) await abschliessen(env, x[1]);
    return new Response(null, { status: 303, headers: { Location: `/buchung/${x[1]}?t=${encodeURIComponent(t)}`, ...SEITE.apiKopf() } });
  }
  x = p.match(/^\/abbruch\/(G-[A-Z0-9]{4}-[A-Z0-9]{4})$/);
  if (m === 'GET' && x) {
    if (await tokenOk(env, x[1], url.searchParams.get('t'))) await db(env).los("UPDATE buchung SET status = 'abgelaufen', version = version + 1 WHERE ref = ? AND status = 'reserviert' AND capture_id IS NULL", x[1]);
    return SEITE.html(await lage(env), SEITE.fehlerSeite('Die Zahlung wurde abgebrochen. Es wurde nichts abgebucht.', true));
  }
  x = p.match(/^\/buchung\/(G-[A-Z0-9]{4}-[A-Z0-9]{4})$/);
  if (m === 'GET' && x) return seiteBuchung(env, req, x[1], url.searchParams.get('t'));
  x = p.match(/^\/buchung\/(G-[A-Z0-9]{4}-[A-Z0-9]{4})\/storno$/);
  if (m === 'POST' && x) return storno(env, req, x[1], await req.formData().catch(() => new FormData()));
  if (m === 'POST' && p === '/api/v1/sync') return abgleich(env, req);
  if (m === 'POST' && p === '/api/v1/webhook') return webhook(env, req);
  if (m === 'GET' && p === '/logo') {
    const logo = await einstellung(env, 'logo', '');
    const mm = String(logo || '').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!mm) return new Response(null, { status: 404 });
    return new Response(Uint8Array.from(atob(mm[2]), c => c.charCodeAt(0)), { headers: { 'Content-Type': mm[1], 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (m === 'GET' && p === '/api/v1/status') { const l = await lage(env); return json({ schnittstelle: SCHNITTSTELLE, offline: l.offline, zu: l.zu, paypal: PP.umgebung(env).art }); }
  return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Nicht gefunden', { status: 404, headers: SEITE.apiKopf() });
}

export default {
  async fetch(req, env) {
    try { return await route(req, env); } catch (e) {
      console.error('Buchungsseite:', e && e.stack || e);
      return json({ fehler: 'Interner Fehler. Bitte später noch einmal versuchen.' }, 500);
    }
  },
  async scheduled(ev, env, c) { c.waitUntil(pflegen(env, 20)); },
};
