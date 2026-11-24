// PayPal REST (Orders v2, Payments v2) und eigene Prüfung der Webhook-Signatur.
// Quellen: developer.paypal.com/api/orders/v2, /api/payments/v2, /api/rest/reference/idempotency, /api/rest/webhooks/rest
const BASIS = { sandbox: 'https://api-m.sandbox.paypal.com', live: 'https://api-m.paypal.com' };
/* Zertifikate für Webhooks nur von diesen Adressen (cert_url im Kopf paypal-cert-url) */
const ZERT_HOSTS = { sandbox: ['api.sandbox.paypal.com', 'api-m.sandbox.paypal.com'], live: ['api.paypal.com', 'api-m.paypal.com'] };

export function umgebung(env) {
  const art = String(env.PAYPAL_ENV || 'sandbox');
  if (art === 'test') {   // nur für die Testreihen: nachgebaute PayPal-Schnittstelle unter http://127.0.0.1
    const b = String(env.PAYPAL_API_BASE || '');
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(b)) throw new Error('PAYPAL_ENV=test nur mit PAYPAL_API_BASE=http://127.0.0.1:<port>');
    return { art, basis: b, zertHosts: ['127.0.0.1'], zertSchema: 'http:' };
  }
  if (!BASIS[art]) throw new Error('PAYPAL_ENV muss sandbox oder live sein');
  return { art, basis: BASIS[art], zertHosts: ZERT_HOSTS[art], zertSchema: 'https:' };
}

let tokenCache = null;   // { key, token, bis } – je Worker-Instanz
export class PayPalFehler extends Error {
  constructor(status, daten) { super(`PayPal ${status}: ${(daten && (daten.name || daten.error)) || ''} ${(daten && (daten.message || daten.error_description)) || ''}`.trim()); this.status = status; this.daten = daten; }
  get issue() { const d = this.daten && this.daten.details; return (d && d[0] && d[0].issue) || (this.daten && this.daten.name) || ''; }
}

export function client(env, fetcher = fetch) {
  const u = umgebung(env);
  const id = String(env.PAYPAL_CLIENT_ID || ''), secret = String(env.PAYPAL_CLIENT_SECRET || '');
  async function token() {
    const key = id + ':' + u.basis;
    if (tokenCache && tokenCache.key === key && tokenCache.bis > Date.now() + 60000) return tokenCache.token;
    if (!id || !secret) throw new Error('PayPal-Zugang fehlt (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)');
    const r = await fetcher(u.basis + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.access_token) throw new PayPalFehler(r.status, d);
    tokenCache = { key, token: d.access_token, bis: Date.now() + (Number(d.expires_in) || 300) * 1000 };
    return d.access_token;
  }
  async function rufe(methode, pfad, body, { requestId } = {}) {
    const h = { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json', Prefer: 'return=representation' };
    if (requestId) h['PayPal-Request-Id'] = requestId;   // gleiche Id = gleiche Antwort, kein zweites Mal (Idempotenz)
    const r = await fetcher(u.basis + pfad, { method: methode, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new PayPalFehler(r.status, d);
    return d;
  }
  return {
    art: u.art,
    order: (body, requestId) => rufe('POST', '/v2/checkout/orders', body, { requestId }),
    orderLesen: id2 => rufe('GET', `/v2/checkout/orders/${encodeURIComponent(id2)}`),
    capture: (orderId, requestId) => rufe('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, { requestId }),
    captureLesen: id2 => rufe('GET', `/v2/payments/captures/${encodeURIComponent(id2)}`),
    erstatten: (captureId, body, requestId) => rufe('POST', `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, body, { requestId }),
    erstattungLesen: id2 => rufe('GET', `/v2/payments/refunds/${encodeURIComponent(id2)}`),
  };
}

/** Betrag in Cent → PayPal-Text „15.00“ */
export const wert = cents => (Math.round(cents) / 100).toFixed(2);
/** PayPal-Text „15.00“ → Cent (ungültig → NaN) */
export const cent = v => (/^\d{1,7}(\.\d{1,2})?$/.test(String(v)) ? Math.round(Number(v) * 100) : NaN);
/** erste Zahlung (Capture) einer Order */
export const captureAus = order => (((order && order.purchase_units) || [])[0] || {}).payments?.captures?.[0] || null;

/* ---------- Webhook-Signatur selbst prüfen ----------
   Zeichenkette: transmission_id | transmission_time | webhook_id | CRC32(roher Body, dezimal), Signatur SHA256withRSA mit dem
   öffentlichen Schlüssel aus dem Zertifikat unter cert_url (nur PayPal-Adressen). Der Inhalt des Webhooks wird trotzdem nie
   geglaubt: Die Buchungsseite liest Order bzw. Zahlung danach selbst bei PayPal nach. */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/* kleiner DER-Leser: genau genug, um aus einem X.509-Zertifikat den öffentlichen Schlüssel (SubjectPublicKeyInfo) und die Gültigkeit zu holen */
function tlv(b, i) {
  const tag = b[i]; let len = b[i + 1], o = i + 2;
  if (len & 0x80) { const n = len & 0x7f; if (n < 1 || n > 4) throw new Error('DER'); len = 0; for (let k = 0; k < n; k++) len = (len << 8) | b[o + k]; o += n; }
  if (o + len > b.length) throw new Error('DER');
  return { tag, start: i, inhalt: o, ende: o + len };
}
const kinder = (b, t) => { const out = []; for (let i = t.inhalt; i < t.ende;) { const k = tlv(b, i); out.push(k); i = k.ende; } return out; };
function zeitAus(b, t) {
  const s = new TextDecoder().decode(b.subarray(t.inhalt, t.ende));
  const m = t.tag === 0x17 ? s.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/) : s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) throw new Error('Zeit');
  const y = t.tag === 0x17 ? (Number(m[1]) < 50 ? 2000 : 1900) + Number(m[1]) : Number(m[1]);
  return Date.UTC(y, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
}
export function zertifikat(pem) {
  const b64 = String(pem).match(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/);
  if (!b64) throw new Error('kein Zertifikat');
  const der = Uint8Array.from(atob(b64[1].replace(/\s+/g, '')), c => c.charCodeAt(0));
  const cert = tlv(der, 0), [tbs] = kinder(der, cert), f = kinder(der, tbs);
  const off = f[0].tag === 0xa0 ? 1 : 0;   // [0] Version ist optional
  const validity = kinder(der, f[off + 3]), spki = f[off + 5];
  return { spki: der.slice(spki.start, spki.ende), von: zeitAus(der, validity[0]), bis: zeitAus(der, validity[1]) };
}

/** Webhook prüfen → true/false. holen(url) liefert den Zertifikatstext (eigener Cache beim Aufrufer). */
export async function pruefeWebhook(env, headers, rohBytes, holen, jetzt = Date.now()) {
  const u = umgebung(env), webhookId = String(env.PAYPAL_WEBHOOK_ID || '');
  const tid = headers.get('paypal-transmission-id') || '', zeit = headers.get('paypal-transmission-time') || '', sig = headers.get('paypal-transmission-sig') || '';
  const certUrl = headers.get('paypal-cert-url') || '', algo = headers.get('paypal-auth-algo') || '';
  if (!webhookId || !tid || !zeit || !sig || algo !== 'SHA256withRSA') return false;
  const t = Date.parse(zeit); if (!Number.isFinite(t) || Math.abs(jetzt - t) > 24 * 3600 * 1000) return false;   // PayPal wiederholt bis zu 3 Tage, ältere sind sinnlos
  let url; try { url = new URL(certUrl); } catch (e) { return false; }
  if (url.protocol !== u.zertSchema || !u.zertHosts.includes(url.hostname) || !url.pathname.startsWith('/v1/notifications/certs/')) return false;
  let z; try { z = zertifikat(await holen(url.href)); } catch (e) { return false; }
  if (jetzt < z.von || jetzt > z.bis) return false;
  const key = await crypto.subtle.importKey('spki', z.spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const text = `${tid}|${zeit}|${webhookId}|${crc32(rohBytes)}`;
  let sigBytes; try { sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0)); } catch (e) { return false; }
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sigBytes, new TextEncoder().encode(text));
}
