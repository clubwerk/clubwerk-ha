// Signierte Anfragen zwischen Clubwerk und der Buchungsseite (Schnittstelle v1, siehe SCHNITTSTELLE.md).
// Nur Web-Standards (crypto.subtle), damit derselbe Code im Worker und in Node läuft.
const enc = new TextEncoder();
export const VERSION = 'cw-gb-v1';
export const MAX_ABWEICHUNG_S = 300;   // Uhrzeit der Anfrage darf höchstens 5 Minuten abweichen

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const sha256hex = async text => hex(await crypto.subtle.digest('SHA-256', typeof text === 'string' ? enc.encode(text) : text));

/** Schlüssel: 32 Byte als base64url (43 Zeichen), wie Clubwerk ihn erzeugt */
export function schluesselBytes(s) {
  const t = String(s || '').trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(t)) return null;
  const b = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '=');
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
const hmacKey = raw => crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const hmac = async (raw, text) => hex(await crypto.subtle.sign('HMAC', await hmacKey(raw), enc.encode(text)));

/** Zeichenkette, die Clubwerk für eine Anfrage signiert */
export const anfrageText = (methode, pfad, zeit, nonce, bodyHash) => [VERSION, methode.toUpperCase(), pfad, zeit, nonce, bodyHash].join('\n');
/** … und die Buchungsseite für ihre Antwort (bindet die Antwort an die Nonce der Anfrage) */
export const antwortText = (nonce, zeit, bodyHash) => [VERSION + '-antwort', nonce, zeit, bodyHash].join('\n');

/** gleich lange Hex-Texte in konstanter Zeit vergleichen */
export function gleich(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (x.length !== y.length || !x.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

export async function signiereAnfrage(raw, methode, pfad, body, zeit = Math.floor(Date.now() / 1000), nonce = hex(crypto.getRandomValues(new Uint8Array(16)))) {
  const sig = await hmac(raw, anfrageText(methode, pfad, String(zeit), nonce, await sha256hex(body)));
  return { 'X-Clubwerk-Zeit': String(zeit), 'X-Clubwerk-Nonce': nonce, 'X-Clubwerk-Signatur': sig };
}

/** Anfrage prüfen → { ok: true, nonce, zeit } | { ok: false, grund } (Nonce prüft der Aufrufer gegen die Datenbank) */
export async function pruefeAnfrage(raw, methode, pfad, headers, body, jetzt = Date.now()) {
  const zeit = headers.get('x-clubwerk-zeit') || '', nonce = headers.get('x-clubwerk-nonce') || '', sig = headers.get('x-clubwerk-signatur') || '';
  if (!/^\d{9,11}$/.test(zeit) || !/^[0-9a-f]{32}$/.test(nonce) || !/^[0-9a-f]{64}$/.test(sig)) return { ok: false, grund: 'kopf' };
  if (Math.abs(jetzt / 1000 - Number(zeit)) > MAX_ABWEICHUNG_S) return { ok: false, grund: 'zeit' };
  const soll = await hmac(raw, anfrageText(methode, pfad, zeit, nonce, await sha256hex(body)));
  if (!gleich(soll, sig)) return { ok: false, grund: 'signatur' };
  return { ok: true, nonce, zeit: Number(zeit) };
}

export async function signiereAntwort(raw, nonce, body, zeit = Math.floor(Date.now() / 1000)) {
  return { 'X-Clubwerk-Zeit': String(zeit), 'X-Clubwerk-Signatur': await hmac(raw, antwortText(nonce, String(zeit), await sha256hex(body))) };
}
