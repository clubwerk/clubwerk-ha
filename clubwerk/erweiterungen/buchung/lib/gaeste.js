'use strict';
/* =====================================================================================================
   Gästebuchung mit PayPal (Teil des Moduls „Plätze“, planung/gaestebuchung.md)
   Nichtmitglieder buchen auf einer eigenen Buchungsseite außerhalb (Cloudflare Worker, Ordner gaestebuchung/ im Repository) und
   zahlen dort mit PayPal oder Karte. Clubwerk bleibt von außen unerreichbar: Es ruft die Buchungsseite nur selbst auf (jede Minute,
   HMAC-signiert mit Zeit und Nonce, Antwort ebenfalls signiert), schickt die freien Zeiten der freigegebenen Plätze und holt neue
   Buchungen und Stornos ab (Schnittstelle: gaestebuchung/SCHNITTSTELLE.md).
   Jede Zahlung prüft Clubwerk selbst bei PayPal – mit einer eigenen PayPal-App, nur lesend benutzt (GET Capture/Refund, Transaction
   Search): Status COMPLETED, Betrag, Währung, Buchungsnummer (custom_id), Order. Erst dann steht die Buchung im Platzplan, bekommt
   einen Platzcode (lib/platzcode.js) und der Gast eine Bestätigung. Storno erst nach geprüfter Erstattung (REFUNDED) austragen.
   Geheimnisse (planung/geheimnisse.md): gemeinsamer Schlüssel und PayPal-Secret im Tresor (ctx.geheim). Gesperrt: Abgleich wartet
   sichtbar (Verwaltung, Antwort 423), die Buchungsseite nimmt nach 10 Minuten ohne Abgleich nichts mehr an.
   Kontaktdaten der Gäste: Tresor-Spalten (src/vault.js SPEC), nie im Protokoll; Löschfrist unter Einstellungen › Datenschutz.
   ===================================================================================================== */
const crypto = require('crypto');
const { today, addDays, deD, euro, nowTs, isDate } = require('../../../src/util');

const VERSION = 1;
const PP_BASIS = { sandbox: 'https://api-m.sandbox.paypal.com', live: 'https://api-m.paypal.com' };
const RE_REF = /^G-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const RE_ID = /^[A-Z0-9]{5,40}$/;
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(String(s || ''));
const ALT = 'Gastbuchung';                       // Titel im Platzplan (bezahlt)
const HALT = 'Gastbuchung (Zahlung läuft)';      // Platzhalter, solange der Gast bei PayPal ist
const PRUEF = 'Gastbuchung (Zahlung in Prüfung)';

/* ---------- Signatur (wie gaestebuchung/src/signatur.js) ---------- */
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const hmac = (key, t) => crypto.createHmac('sha256', key).update(t).digest('hex');
const gleich = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); };
const keyBytes = s => (/^[A-Za-z0-9_-]{43}$/.test(String(s || '')) ? Buffer.from(String(s), 'base64url') : null);

function activate(ctx, h) {
  const db = ctx.db, { J, txt, resource, resources, free, tm, hhmm, isoDow, WD, pc, S, SET } = h;
  const G = ctx.geheim;
  G.melden('gast_schluessel', 'Gästebuchung: gemeinsamer Schlüssel mit der Buchungsseite');
  G.melden('gast_pp_secret', 'Gästebuchung: PayPal-Secret (App „Clubwerk Prüfung“, nur lesend benutzt)');
  db.exec(`
CREATE TABLE IF NOT EXISTS bk_gast (
  id INTEGER PRIMARY KEY, ref TEXT NOT NULL UNIQUE, booking_id INTEGER, resource_id INTEGER NOT NULL, date TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
  first_name TEXT, last_name TEXT, email TEXT, phone TEXT,          -- Gast (Tresor, src/vault.js SPEC)
  amount_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'EUR', fee_cents INTEGER NOT NULL DEFAULT 0,
  refunded_cents INTEGER NOT NULL DEFAULT 0, fee_back_cents INTEGER NOT NULL DEFAULT 0,
  order_id TEXT, capture_id TEXT, refund_id TEXT,
  status TEXT NOT NULL DEFAULT 'reserviert',   -- reserviert | vorlaeufig | bezahlt | storno | storniert | abgelaufen | abgelehnt | belegt | pruefen
  remote TEXT, version INTEGER NOT NULL DEFAULT 0, acked INTEGER NOT NULL DEFAULT 0, stand TEXT,
  paid_at TEXT, cancelled_at TEXT, cancel_reason TEXT, cancel_by TEXT, problem TEXT, problem_at TEXT, mailed TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), updated_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_bk_gast_date ON bk_gast(date);
CREATE INDEX IF NOT EXISTS ix_bk_gast_cap ON bk_gast(capture_id);
CREATE TABLE IF NOT EXISTS bk_gast_diff (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL, ref TEXT, capture_id TEXT, text TEXT NOT NULL, found_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  done_at TEXT, done_by TEXT, UNIQUE(kind, capture_id, ref)
);`);
  ctx.addColumns('bk_resource', {
    guest_on: 'INTEGER NOT NULL DEFAULT 0',          // für Gäste (Externe) buchbar
    guest_days: "TEXT NOT NULL DEFAULT '1234567'", guest_from: "TEXT NOT NULL DEFAULT '08:00'", guest_to: "TEXT NOT NULL DEFAULT '22:00'",
    guest_price_cents: 'INTEGER NOT NULL DEFAULT 1500',   // je Stunde
    guest_min: 'INTEGER NOT NULL DEFAULT 60',        // Dauer einer Gastbuchung
    guest_ahead: 'INTEGER NOT NULL DEFAULT 7',       // Vorlauf: so viele Tage im Voraus buchbar
    guest_price_prev: 'INTEGER', guest_price_changed: 'TEXT' });   // alter Preis (Zahlungen kurz nach einer Preisänderung)

  const DEF = { gast_on: '0', gast_url: '', gast_env: 'sandbox', gast_pp_client: '', gast_homepage: '', gast_impressum: '', gast_datenschutz: '', gast_hinweis: '',
    gast_storno_h: '24', gast_halten_min: '10', gast_logo: '1' };
  const n = (k, lo, hi) => { const v = parseInt(S(k, DEF[k]), 10); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : parseInt(DEF[k], 10); };
  const cfg = () => ({ on: S('gast_on', '0') === '1', url: S('gast_url', ''), env: S('gast_env', 'sandbox') === 'live' ? 'live' : 'sandbox', pp_client: S('gast_pp_client', ''),
    homepage: S('gast_homepage', ''), impressum: S('gast_impressum', ''), datenschutz: S('gast_datenschutz', ''), hinweis: S('gast_hinweis', ''),
    storno_h: n('gast_storno_h', 0, 720), halten_min: n('gast_halten_min', 5, 30), logo: S('gast_logo', '1') === '1',
    has_key: G.has('gast_schluessel'), has_pp: G.has('gast_pp_secret') });
  const testHttp = () => process.env.CW_TEST_GAST_HTTP === '1';
  /** Adresse der Buchungsseite: nur https (Tests: http://127.0.0.1) */
  const urlOk = u => { try { const x = new URL(u); return (x.protocol === 'https:' || (testHttp() && x.protocol === 'http:' && x.hostname === '127.0.0.1')) && !x.username && !x.password && x.pathname === '/' && !x.search; } catch (e) { return false; } };
  const ppBasis = env => (/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.CW_TEST_PAYPAL_BASE || '') ? process.env.CW_TEST_PAYPAL_BASE : PP_BASIS[env]);

  /* ---------- Zustand des Abgleichs (nur im Speicher; letzte Zeiten in den Einstellungen) ---------- */
  const lage = { busy: null, error: '', state: '', at: 0 };
  const jetztMs = () => (ctx.util.jetzt ? ctx.util.jetzt().getTime() : Date.now());
  const demo = () => Boolean(ctx.getSetting('demo_build', ''));   // Beispieldaten: nie nach außen verbinden
  const stand = () => {
    if (demo()) return 'demo';
    const c = cfg();
    if (G.locked('gast_schluessel') || G.locked('gast_pp_secret')) return 'gesperrt';   // auch ausgeschaltet: sichtbar, dass etwas wartet
    if (!c.on) return 'aus';
    if (!c.url || !c.has_key) return 'einrichten';
    if (!c.pp_client || !c.has_pp) return 'paypal';
    return lage.state || (S('gast_last_ok', '') ? 'verbunden' : 'neu');
  };

  /* ---------- PayPal: nur lesend (GET), eigene App ---------- */
  let ppToken = null;
  async function pp(pfad) {
    const c = cfg(), base = ppBasis(c.env);
    if (G.locked('gast_pp_secret')) throw Object.assign(new Error('Der Tresor ist gesperrt – das PayPal-Secret ist verschlossen, bis sich ein Admin anmeldet.'), { status: 423 });
    const secret = G.get('gast_pp_secret', '');
    if (!c.pp_client || !secret) throw new Error('PayPal-Zugang für die Prüfung fehlt (Plätze › Gäste › Einrichten).');
    const key = `${c.env}:${c.pp_client}`;
    if (!ppToken || ppToken.key !== key || ppToken.bis < Date.now() + 60000) {
      const r = await fetch(base + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${c.pp_client}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(15000) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.access_token) throw new Error(r.status === 401 ? 'PayPal lehnt den Zugang ab – Client-ID oder Secret der App „Clubwerk Prüfung“ prüfen.' : `PayPal antwortet ${r.status}.`);
      ppToken = { key, token: d.access_token, bis: Date.now() + (Number(d.expires_in) || 300) * 1000 };
    }
    const r = await fetch(base + pfad, { headers: { Authorization: 'Bearer ' + ppToken.token, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });   // nur GET – Clubwerk bucht nie ab und erstattet nie
    const d = await r.json().catch(() => ({}));
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`PayPal antwortet ${r.status}${d && d.name ? ` (${d.name})` : ''}.`);
    return d;
  }
  const cent = v => (/^\d{1,7}(\.\d{1,2})?$/.test(String(v)) ? Math.round(Number(v) * 100) : NaN);

  /* ---------- Plätze und freie Zeiten ---------- */
  const guestCourts = () => resources().filter(r => r.kind === 'platz' && r.guest_on);
  const priceOf = r => Math.round((r.guest_price_cents || 0) * (r.guest_min || 60) / 60);
  /** Beträge, die für diesen Platz gelten: aktueller Preis, kurz nach einer Änderung auch der alte (Gast hatte die Seite noch offen) */
  const prices = r => { const out = [priceOf(r)]; if (r.guest_price_prev != null && r.guest_price_changed && Date.now() - Date.parse(r.guest_price_changed.replace(' ', 'T')) < 24 * 3600000) out.push(Math.round(r.guest_price_prev * (r.guest_min || 60) / 60)); return out; };
  function freieZeiten() {
    const now = jetztMs(), out = [], courts = [];
    for (const r of guestCourts()) {
      const dur = Math.max(15, r.guest_min || 60), step = dur, price = priceOf(r);
      if (!(price > 0)) continue;
      courts.push({ id: r.id, name: r.name, minuten: dur, preis: price });
      const o = tm(r.open_from), c = tm(r.open_to === '24:00' ? '24:00' : r.open_to), gf = tm(r.guest_from), gt = tm(r.guest_to);
      const lo = Math.max(o, gf == null ? o : gf), hi = Math.min(c, gt == null ? c : gt);
      for (let i = 0; i < Math.max(1, Math.min(60, r.guest_ahead || 7)); i++) {
        const d = addDays(today(), i), dow = String(isoDow(d));
        if (!String(r.days).includes(dow) || !String(r.guest_days || '').includes(dow)) continue;
        const zeiten = [];
        for (let s = o + Math.ceil(Math.max(0, lo - o) / r.slot_min) * r.slot_min; s + dur <= hi; s += step) {
          const ab = new Date(`${d}T${hhmm(s)}:00`).getTime();
          if (ab < now + 30 * 60000 || !free(r, d, s, s + dur)) continue;
          zeiten.push([hhmm(s), hhmm(s + dur), ab]);
        }
        if (zeiten.length) out.push({ platz: r.id, datum: d, zeiten });
      }
    }
    return { plaetze: courts, frei: out };
  }

  /* ---------- Gastbuchung im Platzplan ---------- */
  const row = ref => db.prepare('SELECT * FROM bk_gast WHERE ref = ?').get(ref);
  const bookingOf = g => (g && g.booking_id ? db.prepare('SELECT * FROM bk_booking WHERE id = ?').get(g.booking_id) : null);
  const nameOf = g => [g.last_name, g.first_name].filter(Boolean).join(', ') || 'Gast';
  /** Platzhalter bzw. Buchung eintragen → bk_booking.id oder null (Zeit belegt) */
  function eintragen(g, kind) {
    const r = resource(g.resource_id); if (!r || r.deleted) return null;
    const b = bookingOf(g), ext = kind === 'fest' ? `gast:${g.ref}` : `gast-halt:${g.ref}`, title = kind === 'fest' ? ALT : kind === 'pruef' ? PRUEF : HALT;
    if (b && b.status === 'aktiv') { db.prepare('UPDATE bk_booking SET ext_key = ?, title = ? WHERE id = ?').run(ext, title, b.id); return b.id; }
    if (!free(r, g.date, tm(g.start), tm(g.end))) return null;
    return Number(db.prepare(`INSERT INTO bk_booking(resource_id, date, start, end, type, member_id, title, note, status, source, created_by, ext_key) VALUES (?,?,?,?, 'buchung', NULL, ?, ?, 'aktiv', 'gast', 'Gästebuchung', ?)`)
      .run(g.resource_id, g.date, g.start, g.end, title, `Buchungsnummer ${g.ref}`, ext).lastInsertRowid);
  }
  const austragen = (g, grund) => { const b = bookingOf(g); if (b && b.status === 'aktiv') db.prepare("UPDATE bk_booking SET status = 'storniert', cancelled_at = ?, cancelled_by = 'Online', cancel_reason = ? WHERE id = ?").run(nowTs(), txt(grund, 160), b.id); };   // „Online“: von der Gästebuchung selbst ausgetragen (stornosAusPlan überspringt sie)

  /* ---------- Mails an den Gast (über das Postfach des Vereins) ---------- */
  const club = () => ctx.getSetting('club_name', 'Verein');
  const whenOf = g => `${WD[isoDow(g.date)]}, ${deD(g.date)} · ${g.start}–${g.end} Uhr`;
  async function mail(g, art, extra = {}) {
    if (!ctx.mail.ready() || !g.email) return false;
    const r = resource(g.resource_id) || { name: 'Platz' }, hi = `Hallo ${g.first_name || ''},`.replace(' ,', ','), c = club();
    const rows = [['Platz', r.name], ['Wann', whenOf(g)], ['Buchungsnummer', g.ref], ['Betrag', euro(g.amount_cents)]];
    let subject, heading, intro, outro, button = null;
    if (art === 'bestaetigt') {
      const b = bookingOf(g), code = b ? pc.mailRow(b) : null;
      if (code) rows.push(code);
      const f = new Date(new Date(`${g.date}T${g.start}:00`).getTime() - cfg().storno_h * 3600000), p2 = x => String(x).padStart(2, '0');
      subject = `Buchung bestätigt: ${r.name} am ${deD(g.date)}`; heading = 'Deine Platzbuchung'; intro = 'Danke für deine Buchung. Sie ist bezahlt und eingetragen:';
      outro = `Stornieren mit Erstattung geht bis ${deD(`${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())}`)} um ${p2(f.getHours())}:${p2(f.getMinutes())} Uhr über den Link unten.`;
      if (extra.link) button = { label: 'Buchung ansehen oder stornieren', url: extra.link };
    } else if (art === 'belegt') {
      subject = `Nicht gebucht: ${r.name} am ${deD(g.date)}`; heading = 'Platz leider vergeben'; intro = 'Leider war der Platz zu dieser Zeit inzwischen vergeben. Dein Geld wird vollständig erstattet:'; outro = 'Die Erstattung siehst du in deinem PayPal-Konto bzw. auf deiner Karte.';
    } else {
      subject = `Storniert: ${r.name} am ${deD(g.date)}`; heading = 'Buchung storniert';
      intro = g.cancel_by === 'gast' ? 'Deine Buchung ist storniert und das Geld erstattet:' : `Der Verein hat deine Buchung storniert${g.cancel_reason ? ` (Grund: ${g.cancel_reason})` : ''}. Das Geld ist erstattet:`;
      outro = 'Die Erstattung siehst du in deinem PayPal-Konto bzw. auf deiner Karte.';
    }
    const text = [hi, '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', outro, ...(button ? ['', `${button.label}: ${button.url}`] : []), '', 'Viele Grüße', c].join('\n');
    try {
      await ctx.mail.send({ to: g.email, subject: `${subject} – ${c}`, text, card: { heading, before: [hi, '', intro].join('\n'), title: `${r.name} · ${whenOf(g)}`, rows, after: [outro, '', 'Viele Grüße', c].join('\n'), button } });
      db.prepare('UPDATE bk_gast SET mailed = ? WHERE id = ?').run(`${art} ${nowTs()}`, g.id);
      return true;
    } catch (e) { console.error('Gästebuchung: Mail nicht versendet:', e.message); return false; }
  }

  /** Link für Bestätigung und Storno: nur auf die eingetragene Buchungsseite (eine übernommene Seite soll keine fremde Adresse in die Mail des Vereins setzen) */
  const linkOk = (l, ref) => { try { const u = new URL(String(l)), c = new URL(cfg().url); return u.origin === c.origin && u.pathname === `/buchung/${ref}` && /^\?t=[A-Za-z0-9_-]{20,64}$/.test(u.search) && !u.hash ? u.href : null; } catch (e) { return null; } };

  /* ---------- Zahlung selbst bei PayPal prüfen ---------- */
  async function pruefen(g, b) {
    if (!RE_ID.test(String(b.capture_id || ''))) return { problem: 'Keine gültige Zahlungsnummer von der Buchungsseite.' };
    const c = await pp(`/v2/payments/captures/${b.capture_id}`);
    if (!c) return { problem: `Zahlung ${b.capture_id} gibt es bei PayPal nicht (falsches Konto oder gefälscht).` };
    const r = resource(g.resource_id), betrag = cent(c.amount && c.amount.value), probs = [];
    if (c.custom_id !== g.ref) probs.push('Buchungsnummer der Zahlung passt nicht');
    if (!c.amount || c.amount.currency_code !== 'EUR') probs.push('Währung ist nicht Euro');
    if (b.betrag !== g.amount_cents) probs.push(`Betrag geändert: Buchungsseite meldet jetzt ${euro(b.betrag)} statt zuvor ${euro(g.amount_cents)}`);   // Betrag darf sich nach der ersten Meldung nicht ändern
    else if (betrag !== b.betrag) probs.push(`Betrag bei PayPal ${Number.isFinite(betrag) ? euro(betrag) : '?'} statt ${euro(b.betrag)}`);
    else if (!g.price_ok && r && !prices(r).includes(betrag)) probs.push(`Betrag ${euro(betrag)} passt nicht zum Preis des Platzes (${euro(priceOf(r))})`);
    const oid = c.supplementary_data && c.supplementary_data.related_ids && c.supplementary_data.related_ids.order_id;
    if (oid && b.order_id && oid !== b.order_id) probs.push('Zahlung gehört zu einer anderen Order');
    const fee = cent(c.seller_receivable_breakdown && c.seller_receivable_breakdown.paypal_fee && c.seller_receivable_breakdown.paypal_fee.value);
    return { status: c.status, fee: Number.isFinite(fee) ? fee : 0, problem: probs.length ? probs.join('; ') + '.' : null };
  }
  async function pruefeErstattung(g, b) {
    const c = await pp(`/v2/payments/captures/${g.capture_id || b.capture_id}`);
    if (!c) return { problem: 'Zahlung bei PayPal nicht gefunden.' };
    if (c.status === 'PARTIALLY_REFUNDED') return { problem: 'Bei PayPal nur teilweise erstattet.' };
    if (c.status !== 'REFUNDED') return { warten: true };
    let back = g.amount_cents, feeBack = 0;
    if (RE_ID.test(String(b.refund_id || ''))) {
      const rf = await pp(`/v2/payments/refunds/${b.refund_id}`);
      if (rf && rf.status === 'COMPLETED') { back = cent(rf.amount && rf.amount.value); const f = cent(rf.seller_payable_breakdown && rf.seller_payable_breakdown.paypal_fee && rf.seller_payable_breakdown.paypal_fee.value); feeBack = Number.isFinite(f) ? f : 0; }
      if (!Number.isFinite(back)) back = g.amount_cents;
    }
    return { back, feeBack };
  }

  /* ---------- eine Buchung der Buchungsseite verarbeiten ---------- */
  const setz = (id, f) => { const k = Object.keys(f); db.prepare(`UPDATE bk_gast SET ${k.map(x => `${x} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...k.map(x => f[x]), nowTs(), id); };
  const quitt = (g, stand) => setz(g.id, { stand, acked: 0 });   // acked: wird mit der nächsten Anfrage bestätigt
  const problem = (g, text) => { if (g.problem !== text) { setz(g.id, { problem: text, problem_at: nowTs() }); ctx.audit({ username: 'system', name: 'Gästebuchung' }, 'Plätze: Gastbuchung – Abweichung', `${g.ref}: ${text}`); } };
  async function verarbeiten(b) {
    if (!b || !RE_REF.test(String(b.ref || '')) || !Number.isInteger(b.version)) return;
    // erst mit der Quittung gilt die gemeldete Version als verarbeitet: bricht die Verarbeitung ab (PayPal gestört, Tresor gesperrt),
    // meldet die Buchungsseite die Buchung beim nächsten Abgleich wieder
    const quitt = (x, stand) => setz(x.id, { stand, acked: 0, version: Math.max(x.version, b.version) });
    const r = resource(b.platz);
    if (!r || !isDate(b.datum) || !isTime(b.beginn) || !isTime(b.ende) || !Number.isInteger(b.betrag)) return;
    // nur Zeiten, die Clubwerk so anbietet: Dauer des Platzes, im Gastfenster, an einem Gast-Wochentag (sonst könnte eine fremde Buchungsseite länger buchen)
    const dow = String(isoDow(b.datum)), s0 = tm(b.beginn), e0 = tm(b.ende);
    if (!(r.kind === 'platz' && e0 - s0 === (r.guest_min || 60) && s0 >= Math.max(tm(r.open_from), tm(r.guest_from)) && e0 <= Math.min(tm(r.open_to), tm(r.guest_to)) && String(r.days).includes(dow) && String(r.guest_days || '').includes(dow))) {
      const alt = row(b.ref); if (alt) problem(alt, 'Buchungsseite meldet eine Zeit, die Clubwerk so nicht anbietet.'); return;
    }
    let g = row(b.ref);
    if (!g) {
      db.prepare(`INSERT INTO bk_gast(ref, resource_id, date, start, end, first_name, last_name, email, phone, amount_cents, order_id, status, remote, version) VALUES (?,?,?,?,?,?,?,?,?,?,?, 'reserviert', ?, ?)`)
        .run(b.ref, r.id, b.datum, b.beginn, b.ende, txt(b.vorname, 60), txt(b.nachname, 60), txt(b.email, 160).toLowerCase(), txt(b.telefon, 30), b.betrag, RE_ID.test(String(b.order_id || '')) ? b.order_id : null, b.status, 0);
      g = row(b.ref);
    }
    if (g.resource_id !== r.id || g.date !== b.datum || g.start !== b.beginn || g.end !== b.ende) return problem(g, 'Buchungsseite meldet andere Zeit oder anderen Platz als zuvor.');
    setz(g.id, { remote: String(b.status).slice(0, 30), order_id: g.order_id || (RE_ID.test(String(b.order_id || '')) ? b.order_id : null),
      capture_id: g.capture_id || (RE_ID.test(String(b.capture_id || '')) ? b.capture_id : null), refund_id: RE_ID.test(String(b.refund_id || '')) ? b.refund_id : g.refund_id,
      ...(b.email && !g.email && b.email.length < 160 ? { email: txt(b.email, 160).toLowerCase() } : {}) });
    g = row(b.ref);
    const lokal = g.status;
    if (b.status === 'reserviert') {
      if (['reserviert', 'belegt'].includes(lokal) && !bookingOf(g)) {
        const id = eintragen(g, 'halt');
        if (id) { setz(g.id, { booking_id: id, status: 'reserviert' }); quitt(g, 'vorlaeufig'); } else { setz(g.id, { status: 'belegt' }); quitt(g, 'belegt'); }
      } else quitt(g, lokal === 'belegt' ? 'belegt' : 'vorlaeufig');
      return;
    }
    if (['abgelaufen', 'abgelehnt'].includes(b.status)) {
      if (['reserviert', 'vorlaeufig', 'belegt', 'storno'].includes(lokal)) { austragen(g, 'Zahlung nicht abgeschlossen'); setz(g.id, { status: lokal === 'belegt' ? 'belegt' : b.status }); }
      else if (lokal === 'bezahlt') problem(g, 'Buchungsseite meldet „nicht bezahlt“, Clubwerk hatte die Zahlung geprüft.');
      quitt(g, 'erledigt'); return;
    }
    if (['vorlaeufig', 'bezahlt', 'storno_angefragt', 'erstattung_laeuft', 'erstattung_fehler'].includes(b.status) && ['reserviert', 'vorlaeufig', 'belegt', 'pruefen', 'storno'].includes(lokal)) {
      const p = await pruefen(g, b);   // wirft bei Netzproblemen → nächster Abgleich
      g = row(b.ref); if (g.status !== lokal) return;   // inzwischen geändert (z. B. Storno durch den Verein): nächster Abgleich mit frischem Stand
      if (p.problem) { const id = lokal === 'storno' ? null : eintragen(g, 'pruef'); setz(g.id, { booking_id: id || g.booking_id, status: lokal === 'storno' ? 'storno' : 'pruefen' }); problem(g, p.problem); quitt(g, 'abweichung'); return; }   // Platz bleibt gehalten, der Verein klärt
      if (p.status === 'PENDING') {
        if (lokal === 'storno') { quitt(g, 'storniert'); return; }   // vom Verein storniert: Buchungsseite erstattet, sobald die Zahlung durch ist
        const id = eintragen(g, 'pruef');
        if (id) { setz(g.id, { booking_id: id, status: 'vorlaeufig' }); quitt(g, 'vorlaeufig'); } else { setz(g.id, { status: 'belegt' }); quitt(g, 'belegt'); }
        return;
      }
      if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(p.status) && lokal !== 'storno') {   // schon erstattet: nie eintragen (sonst Platz und Code ohne Geld)
        if (bookingOf(g)) austragen(g, 'Zahlung bei PayPal erstattet');
        setz(g.id, { status: 'pruefen' }); problem(row(b.ref), 'Zahlung ist bei PayPal schon erstattet – nicht eingetragen.'); quitt(row(b.ref), 'abweichung'); return;
      }
      if (['COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(p.status)) {
        if (lokal === 'storno') { setz(g.id, { fee_cents: p.fee, paid_at: g.paid_at || nowTs() }); quitt(g, 'storniert'); }   // vom Verein schon storniert: nicht mehr eintragen
        else {
          const id = eintragen(g, 'fest');
          if (!id) { setz(g.id, { status: 'belegt', fee_cents: p.fee, paid_at: nowTs() }); g = row(b.ref); quitt(g, 'belegt'); await mail(g, 'belegt'); return; }
          setz(g.id, { booking_id: id, status: 'bezahlt', fee_cents: p.fee, paid_at: g.paid_at || nowTs(), problem: null });
          g = row(b.ref);
          const bk = bookingOf(g); if (bk) pc.ensure(bk);   // Platzcode fürs Tor
          ctx.audit({ username: 'system', name: 'Gästebuchung' }, 'Plätze: Gastbuchung bezahlt', `${g.ref}: ${(r || {}).name} ${deD(g.date)} ${g.start}–${g.end}, ${euro(g.amount_cents)}`);
          if (!/^bestaetigt/.test(g.mailed || '')) await mail(g, 'bestaetigt', { link: linkOk(b.link, g.ref) });
          quitt(row(b.ref), 'eingetragen');
        }
        g = row(b.ref);
      } else if (['DECLINED', 'FAILED'].includes(p.status)) { austragen(g, 'Zahlung abgelehnt'); setz(g.id, { status: 'abgelehnt' }); quitt(g, 'erledigt'); return; }
      else return;   // anderer Zwischenstand: beim nächsten Abgleich wieder
    }
    if (b.status === 'erstattet' && ['bezahlt', 'storno', 'belegt', 'pruefen'].includes(g.status)) {
      const e = await pruefeErstattung(g, b);
      const st0 = g.status; g = row(b.ref); if (g.status !== st0) return;   // inzwischen geändert: nächster Abgleich
      if (e.problem) { problem(g, e.problem); quitt(g, 'abweichung'); return; }
      if (e.warten) return;
      const grund = g.cancel_reason || (b.grund ? txt(b.grund, 160) : '') || 'Storno durch den Gast';
      austragen(g, grund);   // Platz frei, Platzcode ungültig (lib/platzcode.js räumt stornierte Codes weg)
      const vorher = g.status;
      setz(g.id, { status: vorher === 'belegt' ? 'belegt' : 'storniert', refunded_cents: e.back, fee_back_cents: e.feeBack, cancelled_at: g.cancelled_at || nowTs(), cancel_reason: grund, cancel_by: g.cancel_by || (b.grund === 'Storno durch den Gast' || !b.grund ? 'gast' : 'verein') });
      g = row(b.ref);
      ctx.audit({ username: 'system', name: 'Gästebuchung' }, 'Plätze: Gastbuchung storniert', `${g.ref}: erstattet ${euro(e.back)} (${grund})`);
      if (vorher !== 'belegt' && !/^storno/.test(g.mailed || '')) await mail(g, 'storno');
      quitt(g, 'storniert'); return;
    }
    if (b.status === 'erstattung_fehler') { problem(row(b.ref), b.fehler ? `Buchungsseite: ${txt(b.fehler, 160)}` : 'Erstattung bei PayPal fehlgeschlagen.'); quitt(row(b.ref), 'abweichung'); return; }
    quitt(row(b.ref), row(b.ref).stand || 'vorlaeufig');
  }

  /* Stornos aus dem Platzplan (Verwaltung, Sperre, Turnier …): jede Gastbuchung, deren Eintrag storniert wurde, wird erstattet */
  function stornosAusPlan() {
    for (const g of db.prepare(`SELECT g.*, b.cancel_reason AS breason FROM bk_gast g JOIN bk_booking b ON b.id = g.booking_id WHERE g.status IN ('reserviert','vorlaeufig','bezahlt','pruefen') AND b.status = 'storniert' AND b.cancelled_by != 'Online'`).all())
      setz(g.id, { status: 'storno', cancel_reason: txt(g.breason, 160) || 'Storno durch den Verein', cancel_by: 'verein' });
  }

  /* Platzhalter „Zahlung läuft“ verfällt nach einer Stunde auch ohne Meldung der Buchungsseite (dort höchstens 30 + 10 Minuten gehalten):
     eine ausgefallene oder übernommene Buchungsseite soll Plätze nicht dauerhaft blockieren. Kommt die Zahlung doch noch, wird neu eingetragen
     oder – falls inzwischen vergeben – „belegt“ gemeldet und erstattet. */
  function halteAbgelaufen() {
    for (const g of db.prepare("SELECT * FROM bk_gast WHERE status = 'reserviert' AND booking_id IS NOT NULL AND created_at < datetime('now','localtime','-60 minutes')").all()) austragen(g, 'Zahlung nicht abgeschlossen');
  }

  /* ---------- Abgleich (ausgehend, signiert) ---------- */
  function anzeige() {
    const c = cfg(), a = { verein: club(), farbe: ctx.require('./db').clubColor(), homepage: c.homepage, impressum: c.impressum, datenschutz: c.datenschutz, hinweis: c.hinweis };
    const icon = c.logo ? ctx.getSetting('club_icon', '') : '';   // Vereinslogo als PNG (Kern, src/logo.js)
    const logo = icon && icon.length < 140000 ? `data:image/png;base64,${icon}` : null;
    const hash = logo ? sha(logo) : '';
    if (hash !== S('gast_logo_hash', '')) a.logo = logo;   // nur bei Änderung schicken
    return a;
  }
  async function abgleichen(grund = 'zeit') {
    // läuft schon einer, danach genau einen mit frischem Stand (Änderungen von eben, z. B. ein freigegebener Platz, kämen sonst erst in einer Minute an)
    if (lage.busy) { lage.nochmal = lage.nochmal || lage.busy.catch(() => null).then(() => { lage.nochmal = null; return abgleichen(grund); }); return lage.nochmal; }
    lage.busy = (async () => {
      const c = cfg();
      try {
        if (demo()) return { state: 'demo' };
        if (!ctx.isActive() || !c.on) { lage.state = ''; return { state: 'aus' }; }
        if (!c.url || !c.has_key) { lage.state = ''; return { state: 'einrichten' }; }
        halteAbgelaufen();
        if (G.locked('gast_schluessel')) {
          lage.state = 'gesperrt';
          // einmal je Neustart: dem Vorstand sagen, dass die Online-Buchung bis zur Anmeldung pausiert (Push sofort, Mail nach dem Entsperren)
          if (!lage.gewarnt) { lage.gewarnt = true; ctx.securityAlert('gast_gesperrt', 'Die Gästebuchung pausiert seit dem Neustart: Gäste können online gerade nicht buchen. Bitte in der Verwaltung anmelden (entsperrt den Tresor), dann läuft sie von selbst weiter.'); }
          return { state: 'gesperrt' };
        }
        lage.gewarnt = false;
        const key = keyBytes(G.get('gast_schluessel', '')); if (!key) { lage.state = 'einrichten'; return { state: 'einrichten' }; }
        stornosAusPlan();
        const offen = db.prepare('SELECT ref, version, stand FROM bk_gast WHERE stand IS NOT NULL AND (acked = 0 OR acked < version) ORDER BY id LIMIT 500').all();
        const stornos = db.prepare("SELECT ref, cancel_reason FROM bk_gast WHERE status = 'storno' AND COALESCE(remote, '') NOT IN ('storno_angefragt', 'erstattung_laeuft', 'erstattet', 'abgelaufen', 'abgelehnt') ORDER BY id LIMIT 100").all();
        const body = JSON.stringify({ v: VERSION, anzeige: anzeige(), regeln: { aktiv: c.on && !G.locked('gast_pp_secret') && Boolean(c.pp_client), storno_stunden: c.storno_h, halten_min: c.halten_min }, ...freieZeiten(),
          quittungen: offen.map(x => ({ ref: x.ref, version: x.version, stand: x.stand })), stornos: stornos.map(x => ({ ref: x.ref, grund: x.cancel_reason || 'Storno durch den Verein' })) });
        const zeit = String(Math.floor(Date.now() / 1000)), nonce = crypto.randomBytes(16).toString('hex'), pfad = '/api/v1/sync';
        const sig = hmac(key, ['cw-gb-v1', 'POST', pfad, zeit, nonce, sha(body)].join('\n'));
        let r;
        try { r = await fetch(new URL(pfad, c.url), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Clubwerk-Zeit': zeit, 'X-Clubwerk-Nonce': nonce, 'X-Clubwerk-Signatur': sig }, body, redirect: 'error', signal: AbortSignal.timeout(20000) }); }
        catch (e) { throw Object.assign(new Error('Keine Verbindung zur Buchungsseite (Internet?).'), { state: 'offline' }); }
        const text = await r.text();
        if (text.length > 4 * 1024 * 1024) throw Object.assign(new Error('Antwort der Buchungsseite zu groß.'), { state: 'fehler' });
        const az = r.headers.get('x-clubwerk-zeit') || '', as = r.headers.get('x-clubwerk-signatur') || '';
        const echt = /^\d{9,11}$/.test(az) && Math.abs(Date.now() / 1000 - Number(az)) < 300 && gleich(hmac(key, ['cw-gb-v1-antwort', nonce, az, sha(text)].join('\n')), as);
        if (!echt) {
          const msg = r.status === 401 ? 'Die Buchungsseite lehnt die Signatur ab – stimmt der gemeinsame Schlüssel (CLUBWERK_SCHLUESSEL) überein?' : r.status === 409 ? 'Schnittstelle passt nicht – Buchungsseite und Clubwerk auf denselben Stand bringen.' : r.status === 503 ? 'Die Buchungsseite ist noch nicht eingerichtet (CLUBWERK_SCHLUESSEL fehlt).' : `Die Buchungsseite antwortet nicht wie erwartet (${r.status}).`;
          throw Object.assign(new Error(msg), { state: r.status === 409 ? 'schnittstelle' : r.status === 401 ? 'signatur' : 'fehler' });
        }
        const d = JSON.parse(text);
        if (d.v !== VERSION) throw Object.assign(new Error('Schnittstelle passt nicht.'), { state: 'schnittstelle' });
        const wenv = d.paypal === 'test' && process.env.CW_TEST_PAYPAL_BASE ? 'sandbox' : d.paypal;   // Testreihen: nachgebaute Sandbox
        if (wenv !== c.env) throw Object.assign(new Error(`Die Buchungsseite läuft mit PayPal „${d.paypal}“, Clubwerk prüft in „${c.env}“ – bitte gleich einstellen.`), { state: 'umgebung' });
        for (const x of offen) db.prepare('UPDATE bk_gast SET acked = MAX(acked, ?) WHERE ref = ?').run(x.version, x.ref);
        if (typeof d.logo_hash === 'string') SET('gast_logo_hash', d.logo_hash.slice(0, 64));
        let fehler = null;
        for (const b of (Array.isArray(d.buchungen) ? d.buchungen : []).slice(0, 200)) {
          try { await verarbeiten(b); } catch (e) { fehler = e; if (e.status === 423) break; }
        }
        SET('gast_last_ok', nowTs()); lage.state = 'verbunden'; lage.error = fehler ? fehler.message : '';
        if (fehler && fehler.status === 423) lage.state = 'gesperrt';
        return { state: lage.state, error: lage.error || null };
      } catch (e) {
        lage.state = e.state || 'fehler'; lage.error = e.message; SET('gast_last_error', `${nowTs()} ${String(e.message).slice(0, 200)}`);
        return { state: lage.state, error: e.message };
      } finally { lage.at = Date.now(); }
    })();
    try { return await lage.busy; } finally { lage.busy = null; }
  }
  const takt = process.env.CW_TEST_FAST ? 1500 : 60000;
  setInterval(() => { abgleichen().catch(e => console.error('Gästebuchung:', e.message)); }, takt).unref();
  require('../../../src/vault').onUnlock(() => { abgleichen('entsperrt').catch(() => {}); });

  const toLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
  /* ---------- Täglicher Abgleich mit PayPal (Transaction Search, nur lesend) ----------
     PayPal zeigt Zahlungen dort bis zu 3 Stunden verzögert; geprüft werden die letzten 3 Tage. */
  const diff = (kind, ref, capture, text) => db.prepare('INSERT OR IGNORE INTO bk_gast_diff(kind, ref, capture_id, text) VALUES (?,?,?,?)').run(kind, ref || '', capture || '', text);
  async function tagesabgleich() {
    const c = cfg(); if (demo() || !ctx.isActive() || !c.on || !c.pp_client || !G.has('gast_pp_secret') || G.locked('gast_pp_secret')) return null;
    const bis = new Date(Date.now()), von = new Date(bis.getTime() - 3 * 86400000), iso = d => d.toISOString().replace(/\.\d{3}Z$/, '+0000');
    const liste = [];
    for (let page = 1; page <= 10; page++) {
      const d = await pp(`/v1/reporting/transactions?start_date=${encodeURIComponent(iso(von))}&end_date=${encodeURIComponent(iso(bis))}&fields=transaction_info&page_size=500&page=${page}`);
      if (!d) break;
      liste.push(...(d.transaction_details || []).map(x => x.transaction_info || {}));
      if (!d.total_pages || page >= d.total_pages) break;
    }
    let n = 0;
    const caps = liste.filter(t => t.transaction_event_code === 'T0006' || /^T00/.test(String(t.transaction_event_code || '')));
    const refunds = liste.filter(t => /^T11/.test(String(t.transaction_event_code || '')));
    for (const t of caps) {
      if (!RE_REF.test(String(t.custom_field || ''))) continue;   // nur Zahlungen der Buchungsseite
      const g = db.prepare('SELECT * FROM bk_gast WHERE capture_id = ? OR ref = ?').get(String(t.transaction_id || ''), t.custom_field);
      const betrag = cent(String((t.transaction_amount || {}).value || ''));
      if (!g) { n++; diff('fremd', t.custom_field, t.transaction_id, `Zahlung ${t.transaction_id} über ${Number.isFinite(betrag) ? euro(betrag) : '?'} (${t.custom_field}) ist bei PayPal, aber in Clubwerk gibt es keine Gastbuchung dazu.`); continue; }
      if (Number.isFinite(betrag) && betrag !== g.amount_cents) { n++; diff('betrag', g.ref, t.transaction_id, `${g.ref}: Betrag bei PayPal ${euro(betrag)}, in Clubwerk ${euro(g.amount_cents)}.`); }
      if (t.transaction_status === 'S' && ['reserviert', 'abgelaufen', 'abgelehnt'].includes(g.status)) { n++; diff('unverbucht', g.ref, t.transaction_id, `${g.ref}: bei PayPal bezahlt, in Clubwerk ${g.status === 'reserviert' ? 'noch nicht eingetragen' : 'nicht gebucht'}.`); }
    }
    for (const t of refunds) {
      const g = db.prepare('SELECT * FROM bk_gast WHERE capture_id = ? OR ref = ?').get(String(t.paypal_reference_id || ''), String(t.custom_field || ''));
      if (g && g.status === 'bezahlt') { n++; diff('erstattet', g.ref, g.capture_id, `${g.ref}: bei PayPal erstattet, in Clubwerk noch gebucht.`); }
    }
    const alt = new Date(bis.getTime() - 3 * 3600000);   // jünger als 3 Stunden: PayPal zeigt sie evtl. noch nicht
    for (const g of db.prepare("SELECT * FROM bk_gast WHERE status = 'bezahlt' AND paid_at >= ? AND paid_at <= ?").all(toLocal(von), toLocal(alt))) {
      if (!caps.some(t => t.transaction_id === g.capture_id)) { n++; diff('fehlt', g.ref, g.capture_id, `${g.ref}: in Clubwerk bezahlt, bei PayPal nicht in der Liste der Zahlungen.`); }
    }
    SET('gast_tag', JSON.stringify({ at: nowTs(), geprueft: caps.length, erstattungen: refunds.length, funde: n }));
    return { geprueft: caps.length, funde: n };
  }
  setInterval(() => {
    const tag = today(), h = new Date().getHours();
    if (h < 4 || S('gast_tag_am', '') === tag) return;
    SET('gast_tag_am', tag);
    tagesabgleich().catch(e => { SET('gast_tag', JSON.stringify({ at: nowTs(), fehler: String(e.message).slice(0, 200) })); });
  }, process.env.CW_TEST_FAST ? 5000 : 10 * 60000).unref();

  /* ---------- Verwaltung (Reiter „Gäste“) ---------- */
  const admin = ctx.admin, need = ctx.need, bad = ctx.bad, int = ctx.int;
  const PV = need(...h.ALL), PG = need('buchung_gaeste');
  const ar = fn => ctx.asyncRoute(fn);
  const view = (g, full = false) => {
    const r = resource(g.resource_id) || { name: '?' };
    const out = { id: g.id, ref: g.ref, name: nameOf(g), resource: r.name, resource_id: g.resource_id, date: g.date, start: g.start, end: g.end, amount_cents: g.amount_cents, fee_cents: g.fee_cents,
      refunded_cents: g.refunded_cents, status: g.status, remote: g.remote, problem: g.problem, paid_at: g.paid_at, cancelled_at: g.cancelled_at, cancel_reason: g.cancel_reason, created_at: g.created_at, has_code: false };
    const b = bookingOf(g); if (b && b.status === 'aktiv' && g.status === 'bezahlt') out.has_code = pc.wants(b);
    if (full) Object.assign(out, { email: g.email, phone: g.phone, order_id: g.order_id, capture_id: g.capture_id, refund_id: g.refund_id, fee_back_cents: g.fee_back_cents, mailed: g.mailed, booking_id: g.booking_id, stand: g.stand });
    return out;
  };
  const courtView = r => ({ id: r.id, name: r.name, guest_on: Boolean(r.guest_on), guest_days: r.guest_days, guest_from: r.guest_from, guest_to: r.guest_to, guest_price_cents: r.guest_price_cents, guest_min: r.guest_min, guest_ahead: r.guest_ahead,
    open_from: r.open_from, open_to: r.open_to, days: r.days, slot_min: r.slot_min, price: priceOf(r) });
  function uebersicht(filter) {
    const w = filter === 'kommend' ? "WHERE g.date >= ? AND g.status IN ('reserviert','vorlaeufig','bezahlt','pruefen','storno')" : filter === 'storniert' ? "WHERE g.status IN ('storniert','belegt')" : filter === 'abweichung' ? "WHERE g.problem IS NOT NULL AND g.status != 'storniert'" : "WHERE g.status NOT IN ('abgelaufen','abgelehnt') OR g.date >= ?";
    const args = /\?/.test(w) ? [today()] : [];
    return db.prepare(`SELECT g.* FROM bk_gast g ${w} ORDER BY g.date ${filter === 'kommend' ? 'ASC' : 'DESC'}, g.start LIMIT 500`).all(...args);
  }
  admin.get('/gaeste', PV, (req, res) => {
    const c = cfg(), f = ['kommend', 'alle', 'storniert', 'abweichung'].includes(req.query.f) ? req.query.f : 'kommend';
    const m = today().slice(0, 7);
    const monat = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount_cents - refunded_cents), 0) c, COALESCE(SUM(fee_cents - fee_back_cents), 0) f FROM bk_gast WHERE status IN ('bezahlt','storniert','storno') AND paid_at LIKE ?").get(m + '%');
    const diffs = db.prepare('SELECT * FROM bk_gast_diff WHERE done_at IS NULL ORDER BY id DESC LIMIT 100').all();
    const probs = db.prepare("SELECT * FROM bk_gast WHERE problem IS NOT NULL AND status NOT IN ('storniert') ORDER BY id DESC LIMIT 100").all();
    const st = stand();
    res.json({ cfg: { ...c, url: c.url }, state: st, error: lage.error || null, last_ok: S('gast_last_ok', '') || null, last_error: S('gast_last_error', '') || null, tag: J(S('gast_tag', ''), null),
      can: { gaeste: req.user.perms.includes('buchung_gaeste') }, courts: resources().filter(r => r.kind === 'platz').map(courtView),
      list: uebersicht(f).map(g => view(g)), filter: f, counts: { kommend: db.prepare("SELECT COUNT(*) n FROM bk_gast WHERE date >= ? AND status IN ('reserviert','vorlaeufig','bezahlt','pruefen','storno')").get(today()).n,
        abweichung: probs.length + diffs.length },
      month: { count: monat.n, cents: monat.c, fee: monat.f }, diffs, problems: probs.map(g => view(g)),
      queue: st === 'gesperrt' ? { stornos: db.prepare("SELECT COUNT(*) n FROM bk_gast WHERE status = 'storno'").get().n, quittungen: db.prepare('SELECT COUNT(*) n FROM bk_gast WHERE stand IS NOT NULL AND acked < version').get().n } : null });
  });
  admin.get('/gaeste/:id', PG, (req, res) => {
    const g = db.prepare('SELECT * FROM bk_gast WHERE id = ?').get(int(req.params.id));
    if (!g) return bad(res, 'Diese Gastbuchung gibt es nicht.', 404);
    ctx.audit(req.user, 'Plätze: Gastbuchung angesehen', `${g.ref}`);
    res.json(view(g, true));
  });
  const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').trim().slice(0, max);
  admin.put('/gaeste/einstellungen', PG, (req, res) => {
    const b = req.body || {}, alt = cfg(), out = {};
    if (b.url !== undefined) { const u = String(b.url || '').trim().replace(/\/?$/, '/'); if (b.url && !urlOk(u)) return bad(res, 'Adresse der Buchungsseite: bitte nur die https-Adresse, z. B. https://buchen.dein-verein.de/'); out.gast_url = b.url ? u : ''; }
    if (b.homepage !== undefined) { const list = String(b.homepage || '').split(/[\s,]+/).filter(Boolean); for (const x of list) { try { const u = new URL(x); if (u.protocol !== 'https:') throw new Error(); } catch (e) { return bad(res, 'Homepage: bitte https-Adressen, z. B. https://www.dein-verein.de'); } } out.gast_homepage = list.map(x => new URL(x).origin).slice(0, 5).join(' '); }
    for (const k of ['impressum', 'datenschutz']) if (b[k] !== undefined) { const v = String(b[k] || '').trim(); if (v) { try { if (new URL(v).protocol !== 'https:') throw new Error(); } catch (e) { return bad(res, `${k === 'impressum' ? 'Impressum' : 'Datenschutz'}: bitte eine https-Adresse.`); } } out['gast_' + k] = v.slice(0, 300); }
    if (b.hinweis !== undefined) out.gast_hinweis = text(b.hinweis, 3000);
    if (b.storno_h !== undefined) { const v = int(b.storno_h); if (!(v >= 0 && v <= 720)) return bad(res, 'Stornofrist: 0 bis 720 Stunden.'); out.gast_storno_h = String(v); }
    if (b.halten_min !== undefined) { const v = int(b.halten_min); if (!(v >= 5 && v <= 30)) return bad(res, 'Reservierung während der Zahlung: 5 bis 30 Minuten.'); out.gast_halten_min = String(v); }
    if (b.env !== undefined) out.gast_env = b.env === 'live' ? 'live' : 'sandbox';
    if (b.pp_client !== undefined) { const v = String(b.pp_client || '').trim(); if (v && !/^[A-Za-z0-9_-]{10,100}$/.test(v)) return bad(res, 'PayPal-Client-ID: nur Buchstaben, Ziffern, - und _.'); out.gast_pp_client = v; }
    if (b.logo !== undefined) out.gast_logo = b.logo ? '1' : '0';
    if (b.on !== undefined) out.gast_on = b.on ? '1' : '0';
    if (b.pp_secret !== undefined && b.pp_secret !== '') {
      if (G.locked('gast_pp_secret')) return res.status(423).json({ error: 'Der Tresor ist gesperrt – bitte erst entsperren (neu anmelden).' });
      if (!/^[A-Za-z0-9_-]{10,120}$/.test(String(b.pp_secret))) return bad(res, 'PayPal-Secret: bitte so einfügen, wie PayPal es anzeigt.');
    }
    const neu = { ...alt, ...Object.fromEntries(Object.entries(out).map(([k, v]) => [k.slice(5), v])) };
    if ((out.gast_on === '1' || (alt.on && out.gast_on !== '0')) && !(neu.url)) return bad(res, 'Zum Einschalten fehlt die Adresse der Buchungsseite.');
    for (const [k, v] of Object.entries(out)) SET(k, v);
    if (b.pp_secret) { G.set('gast_pp_secret', String(b.pp_secret)); ppToken = null; }
    if (out.gast_env && out.gast_env !== alt.env) ppToken = null;
    const geaendert = Object.keys(out).map(k => k.slice(5)).filter(k => String(alt[k] ?? '') !== String(neu[k] ?? '')).concat(b.pp_secret ? ['PayPal-Secret'] : []);
    if (geaendert.length) ctx.audit(req.user, 'Plätze: Gästebuchung eingerichtet', geaendert.map(k => ({ on: 'eingeschaltet', url: 'Adresse', env: `PayPal ${neu.env === 'live' ? 'Live' : 'Sandbox'}`, pp_client: 'PayPal-Client-ID', homepage: 'Homepage', impressum: 'Impressum', datenschutz: 'Datenschutz', hinweis: 'Hinweistext', storno_h: `Stornofrist ${neu.storno_h} Std.`, halten_min: `Reservierung ${neu.halten_min} Min.`, logo: 'Logo' }[k] || k)).join(', '));
    if (out.gast_env === 'live' && alt.env !== 'live') ctx.securityAlert('gast_live', `Die Gästebuchung wurde auf PayPal Live (echtes Geld) umgestellt (von ${ctx.userName(req)}). War das so geplant?`);
    lage.state = ''; abgleichen('einstellungen').catch(() => {});
    res.json({ ok: true, cfg: cfg() });
  });
  /* gemeinsamer Schlüssel: nur mit eigenem Passwort, einmal angezeigt, danach nur „ist eingetragen“ */
  const GR = require('../../../src/geraete');
  admin.post('/gaeste/schluessel', PG, ar(async (req, res) => {
    if (G.locked('gast_schluessel')) return res.status(423).json({ error: 'Der Tresor ist gesperrt – bitte erst entsperren (neu anmelden).' });
    const pw = await GR.bestaetigt(req, res, ctx.ownPwOk); if (!pw) return;
    if (!pw.confirmed) return res.status(428).json({ error: 'Bitte zur Bestätigung dein eigenes Passwort eingeben.', needPassword: true });
    const k = crypto.randomBytes(32).toString('base64url');
    G.set('gast_schluessel', k);
    ctx.audit(req.user, 'Plätze: Gästebuchung – neuer gemeinsamer Schlüssel', 'Schlüssel erzeugt (Wert nicht im Protokoll)');
    ctx.securityAlert('gast_schluessel', `Für die Gästebuchung wurde ein neuer gemeinsamer Schlüssel erzeugt (von ${ctx.userName(req)}). Die Buchungsseite braucht ihn, sonst ruht die Gästebuchung. War das so geplant?`);
    res.json({ ok: true, key: k });   // nur jetzt – zum Eintragen per „npx wrangler secret put CLUBWERK_SCHLUESSEL“
  }));
  admin.post('/gaeste/abgleich', PG, ar(async (req, res) => {
    if (G.locked('gast_schluessel') || G.locked('gast_pp_secret')) return res.status(423).json({ error: 'Der Tresor ist seit dem Neustart gesperrt – der Abgleich wartet, bis sich ein Admin anmeldet.', state: 'gesperrt' });
    const r = await abgleichen('hand');
    res.json({ ...r, last_ok: S('gast_last_ok', '') || null });
  }));
  admin.post('/gaeste/paypal-test', PG, ar(async (req, res) => {
    if (G.locked('gast_pp_secret')) return res.status(423).json({ error: 'Der Tresor ist gesperrt – bitte erst entsperren (neu anmelden).' });
    try { const r = await tagesabgleich(); res.json({ ok: true, ...(r || {}) }); } catch (e) { bad(res, e.message); }
  }));
  admin.put('/gaeste/platz/:id', PG, (req, res) => {
    const r = resource(req.params.id); if (!r || r.deleted || r.kind !== 'platz') return bad(res, 'Diesen Platz gibt es nicht.', 404);
    const b = req.body || {}, v = {};
    if (b.guest_on !== undefined) v.guest_on = b.guest_on ? 1 : 0;
    if (b.guest_days !== undefined) { const d = [...new Set(String(b.guest_days).replace(/[^1-7]/g, '').split(''))].sort().join(''); if (!d) return bad(res, 'Bitte mindestens einen Wochentag wählen.'); v.guest_days = d; }
    for (const k of ['guest_from', 'guest_to']) if (b[k] !== undefined) { if (!isTime(b[k])) return bad(res, 'Bitte Uhrzeiten wie 08:00 eingeben.'); v[k] = b[k]; }
    if ((v.guest_from || r.guest_from) >= (v.guest_to || r.guest_to)) return bad(res, 'Das Zeitfenster für Gäste muss vor seinem Ende beginnen.');
    if (b.guest_price_cents !== undefined) { const c = int(b.guest_price_cents); if (!(c >= 100 && c <= 50000)) return bad(res, 'Preis je Stunde: 1 € bis 500 €.'); v.guest_price_cents = c; if (c !== r.guest_price_cents) { v.guest_price_prev = r.guest_price_cents; v.guest_price_changed = nowTs(); } }
    if (b.guest_min !== undefined) { const m = int(b.guest_min); if (!(m >= 30 && m <= 240 && m % r.slot_min === 0)) return bad(res, `Dauer: 30 bis 240 Minuten im ${r.slot_min}-Minuten-Raster des Platzes.`); v.guest_min = m; }
    if (b.guest_ahead !== undefined) { const a = int(b.guest_ahead); if (!(a >= 1 && a <= 60)) return bad(res, 'Vorlauf: 1 bis 60 Tage.'); v.guest_ahead = a; }
    const k = Object.keys(v); if (!k.length) return res.json({ ok: true });
    db.prepare(`UPDATE bk_resource SET ${k.map(x => `${x} = ?`).join(', ')} WHERE id = ?`).run(...k.map(x => v[x]), r.id);
    const n2 = resource(r.id);
    ctx.audit(req.user, 'Plätze: Gästebuchung je Platz', `${r.name}: ${n2.guest_on ? `für Gäste buchbar, ${n2.guest_from}–${n2.guest_to}, ${euro(n2.guest_price_cents)}/Std., ${n2.guest_min} Min., ${n2.guest_ahead} Tage Vorlauf` : 'nicht für Gäste'}`);
    abgleichen('platz').catch(() => {});
    res.json({ ok: true, court: courtView(n2) });
  });
  /* Storno durch den Verein: Eintrag austragen lassen, Buchungsseite erstattet, Clubwerk prüft die Erstattung und schreibt dem Gast */
  admin.post('/gaeste/:id/storno', PG, ar(async (req, res) => {
    const g = db.prepare('SELECT * FROM bk_gast WHERE id = ?').get(int(req.params.id));
    if (!g || !['reserviert', 'vorlaeufig', 'bezahlt', 'pruefen'].includes(g.status)) return bad(res, 'Diese Gastbuchung lässt sich nicht (mehr) stornieren.');
    const grund = txt((req.body || {}).grund, 160) || 'Storno durch den Verein';
    const b = bookingOf(g);
    if (b && b.status === 'aktiv') await h.cancel(b, ctx.userName(req), grund);
    setz(g.id, { status: 'storno', cancel_reason: grund, cancel_by: 'verein' });
    ctx.audit(req.user, 'Plätze: Gastbuchung storniert (Erstattung angestoßen)', `${g.ref}: ${grund}`);
    const r = await abgleichen('storno');
    res.json({ ok: true, state: r.state });
  }));
  /* Abweichung „Betrag passt nicht zum Platzpreis“ (z. B. Preis geändert): nach Prüfung von Hand trotzdem eintragen */
  admin.post('/gaeste/:id/eintragen', PG, ar(async (req, res) => {
    const g = db.prepare('SELECT * FROM bk_gast WHERE id = ?').get(int(req.params.id));
    if (!g || g.status !== 'pruefen') return bad(res, 'Nur Gastbuchungen „bitte prüfen“ lassen sich von Hand eintragen.');
    const p = await pruefen({ ...g, price_ok: true }, { capture_id: g.capture_id, betrag: g.amount_cents, order_id: g.order_id }).catch(e => ({ problem: e.message }));
    if (p.problem || p.status !== 'COMPLETED') return bad(res, p.problem || 'Die Zahlung ist bei PayPal nicht abgeschlossen.');
    if (row(g.ref).status !== 'pruefen') return bad(res, 'Diese Gastbuchung hat sich inzwischen geändert – bitte neu laden.');
    const id = eintragen(g, 'fest'); if (!id) return bad(res, 'Die Zeit ist inzwischen belegt – bitte stornieren (der Gast bekommt sein Geld zurück).');
    setz(g.id, { booking_id: id, status: 'bezahlt', fee_cents: p.fee, paid_at: g.paid_at || nowTs(), problem: null });
    const bk = bookingOf(row(g.ref)); if (bk) pc.ensure(bk);
    ctx.audit(req.user, 'Plätze: Gastbuchung von Hand eingetragen', `${g.ref} (Abweichung geprüft: ${g.problem || ''})`);
    await mail(row(g.ref), 'bestaetigt');
    quitt(row(g.ref), 'eingetragen');
    res.json({ ok: true });
  }));
  admin.post('/gaeste/abweichung/:id/erledigt', PG, (req, res) => {
    const kind = String((req.body || {}).art || 'diff');
    if (kind === 'buchung') {
      const g = db.prepare('SELECT * FROM bk_gast WHERE id = ?').get(int(req.params.id)); if (!g) return bad(res, 'Nicht gefunden.', 404);
      setz(g.id, { problem: null }); ctx.audit(req.user, 'Plätze: Abweichung Gastbuchung erledigt', `${g.ref}: ${g.problem || ''}`);
    } else {
      const d = db.prepare('SELECT * FROM bk_gast_diff WHERE id = ? AND done_at IS NULL').get(int(req.params.id)); if (!d) return bad(res, 'Nicht gefunden.', 404);
      db.prepare('UPDATE bk_gast_diff SET done_at = ?, done_by = ? WHERE id = ?').run(nowTs(), ctx.userName(req), d.id);
      ctx.audit(req.user, 'Plätze: Abweichung PayPal-Abgleich erledigt', d.text);
    }
    res.json({ ok: true });
  });

  /* ---------- Hooks für das Modul ---------- */
  const gobdKeys = () => [{ key: 'bk.gast', label: 'Gastbuchungen (PayPal)', sphere: 'zweck' }, { key: 'bk.gast_gebuehr', label: 'PayPal-Gebühren (Gastbuchungen)', sphere: 'zweck', art: 'ausgabe' }];
  /** GoBD (src/gobd.js): Einnahme am Tag der Zahlung, Gebühr als Ausgabe; Erstattung als eigene Buchung am Tag des Stornos */
  const gobdPaid = g => {
    if (!g.paid_at || !['bezahlt', 'storniert', 'storno', 'belegt'].includes(g.status) || !g.amount_cents) return [];
    const out = [{ cents: g.amount_cents, via: 'paypal', key: 'bk.gast', text: `Gastbuchung ${g.ref}`, doc: g.ref, date: g.paid_at }];
    if (g.fee_cents) out.push({ cents: -g.fee_cents, via: 'paypal', key: 'bk.gast_gebuehr', text: `PayPal-Gebühr ${g.ref}`, doc: g.ref, date: g.paid_at });
    if (g.refunded_cents) {
      out.push({ cents: -g.refunded_cents, via: 'paypal', key: 'bk.gast', text: `Erstattung ${g.ref}`, doc: g.ref, date: g.cancelled_at || g.paid_at });
      if (g.fee_back_cents) out.push({ cents: g.fee_back_cents, via: 'paypal', key: 'bk.gast_gebuehr', text: `PayPal-Gebühr erstattet ${g.ref}`, doc: g.ref, date: g.cancelled_at || g.paid_at });
    }
    return out;
  };
  const overview = () => {
    const c = cfg(); if (!c.on) return null;
    const st = stand(), probs = db.prepare("SELECT COUNT(*) n FROM bk_gast WHERE problem IS NOT NULL AND status != 'storniert'").get().n + db.prepare('SELECT COUNT(*) n FROM bk_gast_diff WHERE done_at IS NULL').get().n;
    const alerts = [];
    if (probs) alerts.push({ level: 'r', text: ctx.T(probs === 1 ? 'Gästebuchung: eine Abweichung bei PayPal-Zahlungen.' : 'Gästebuchung: {0} Abweichungen bei PayPal-Zahlungen.', [probs]), link: 'Ansehen' });
    if (['offline', 'fehler', 'signatur', 'schnittstelle', 'umgebung'].includes(st)) alerts.push({ level: 'a', text: ctx.T('Gästebuchung: keine Verbindung zur Buchungsseite.'), link: 'Ansehen' });
    if (st === 'gesperrt') alerts.push({ level: 'a', text: ctx.T('Gästebuchung wartet auf das Entsperren des Tresors.'), link: 'Ansehen' });
    return alerts;
  };
  /* Datenschutz: Kontaktdaten der Gäste löschen (Name bleibt für die Buchhaltung als „Gast“, Beträge und Nummern bleiben) */
  const retention = () => [{ id: 'gaeste', label: 'Gastbuchungen (Kontaktdaten)', text: 'Name, E-Mail und Handynummer von Gästen, die online gebucht haben. Buchungsnummer und Beträge bleiben für die Buchhaltung.',
    unit: 'monate', value: n2('gast_frist_monate'), def: 6, min: 1, max: 24,
    due: cut => db.prepare("SELECT COUNT(*) n FROM bk_gast WHERE date < ? AND (email != '' OR first_name != '' OR phone != '')").get(cut).n,
    purge: cut => db.prepare("UPDATE bk_gast SET first_name = '', last_name = 'Gast', email = '', phone = '' WHERE date < ? AND (email != '' OR first_name != '' OR phone != '')").run(cut).changes,
    set: v => SET('gast_frist_monate', String(v)) }];
  function n2(k) { const v = parseInt(S(k, '6'), 10); return Number.isFinite(v) ? Math.max(1, Math.min(24, v)) : 6; }
  const privacy = () => ({ title: 'Gästebuchung (PayPal)', purpose: 'Platzbuchung durch Gäste über die Buchungsseite, Zahlung mit PayPal oder Karte, Bestätigung mit Platzcode', data: 'Vor- und Nachname, E-Mail, Handynummer, gebuchte Zeit, Betrag, PayPal-Zahlungsnummern', persons: 'Gäste (keine Mitglieder)', frist: `Kontaktdaten ${n2('gast_frist_monate')} Monate nach dem Termin, auf der Buchungsseite 30 Tage; Beträge 10 Jahre (Buchhaltung)` });
  const exportSettings = () => Object.fromEntries(['gast_url', 'gast_env', 'gast_homepage', 'gast_impressum', 'gast_datenschutz', 'gast_hinweis', 'gast_storno_h', 'gast_halten_min', 'gast_logo'].map(k => [k, S(k, DEF[k])]));
  const importSettings = s => { for (const k of Object.keys(exportSettings())) if (typeof (s || {})[k] === 'string') { if (k === 'gast_url' && s[k] && !urlOk(s[k])) continue; SET(k, s[k].slice(0, 3000)); } };
  /** Funktionsimport: Gästebuchung je Platz übernehmen (nur gültige Werte) */
  function importCourt(id, x) {
    const r = resource(id); if (!r || r.kind !== 'platz' || !x || typeof x !== 'object') return;
    const v = {};
    if (x.guest_on !== undefined) v.guest_on = x.guest_on ? 1 : 0;
    if (typeof x.guest_days === 'string' && /^[1-7]{1,7}$/.test(x.guest_days)) v.guest_days = x.guest_days;
    for (const k of ['guest_from', 'guest_to']) if (isTime(x[k])) v[k] = x[k];
    if (Number.isInteger(x.guest_price_cents) && x.guest_price_cents >= 100 && x.guest_price_cents <= 50000) v.guest_price_cents = x.guest_price_cents;
    if (Number.isInteger(x.guest_min) && x.guest_min >= 30 && x.guest_min <= 240 && x.guest_min % r.slot_min === 0) v.guest_min = x.guest_min;
    if (Number.isInteger(x.guest_ahead) && x.guest_ahead >= 1 && x.guest_ahead <= 60) v.guest_ahead = x.guest_ahead;
    if ((v.guest_from || r.guest_from) >= (v.guest_to || r.guest_to)) { delete v.guest_from; delete v.guest_to; }
    const k = Object.keys(v); if (k.length) db.prepare(`UPDATE bk_resource SET ${k.map(y => `${y} = ?`).join(', ')} WHERE id = ?`).run(...k.map(y => v[y]), id);
  }
  /** Für die Belegung: ist das eine Gastbuchung (nicht in der Verwaltung ändern)? */
  const isGuest = b => /^gast(-halt)?:/.test((b && b.ext_key) || '');
  return { abgleichen, tagesabgleich, gobdKeys, gobdPaid, overview, retention, privacy, exportSettings, importSettings, importCourt, isGuest, freieZeiten, cfg, stand };
}

module.exports = { activate };
