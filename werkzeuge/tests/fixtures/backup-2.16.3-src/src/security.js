'use strict';
/* Sicherheitswarnungen: immer ins Protokoll, zusätzlich per E-Mail an die Adresse unter
   „Mitglieder-App → Sicherheit“ (security_mail_to) – höchstens eine Mail je Anlass und Stunde. */
const { getSetting, audit } = require('./db');
const lastSent = new Map();

function securityAlert(text, key = text) {
  try { audit(null, 'Sicherheitswarnung', String(text).slice(0, 400)); } catch (e) { /* Protokoll nicht verfügbar */ }
  const to = getSetting('security_mail_to', '');
  if (!to) return;
  const now = Date.now();
  if (lastSent.has(key) && now - lastSent.get(key) < 3600000) return;
  lastSent.set(key, now);
  if (lastSent.size > 500) lastSent.delete(lastSent.keys().next().value);
  try {
    const mail = require('./mail');
    if (!mail.ready() || !mail.mailOk(to)) return;
    const club = getSetting('club_name', 'Verein');
    mail.send({ to, subject: `Sicherheitshinweis – Vereinsheimverwaltung (${club})`,
      text: `Hallo,\n\n${text}\n\nZeit: ${new Date().toLocaleString('de-DE')}\n\nDetails stehen in der Verwaltung unter „Protokoll“.\n\nAutomatisch versendet von der Vereinsheimverwaltung.` })
      .catch(e => console.error('Sicherheits-Mail:', e.message));
  } catch (e) { console.error('Sicherheits-Mail:', e.message); }
}
/** Fehlversuche mit wachsender Sperre: je 5 Fehler eine Pause, die sich jedes Mal verdoppelt (5 Min., 10, 20 … höchstens 24 Std.).
 *  Begrenzte Größe (älteste Einträge fallen heraus), damit niemand den Speicher füllen kann. */
function limiter({ per = 5, baseMs = 5 * 60000, maxMs = 24 * 3600000, size = 2000 } = {}) {
  const m = new Map();
  return {
    blocked(key) { const f = m.get(key); return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 60000) : 0; },
    fail(key) {
      const now = Date.now(); const f = m.get(key) || { n: 0, strikes: 0, until: 0 };
      f.n++; let locked = false;
      if (f.n >= per) { f.until = now + Math.min(baseMs * 2 ** f.strikes, maxMs); f.strikes++; f.n = 0; locked = true; }
      if (!m.has(key) && m.size >= size) m.delete(m.keys().next().value);
      m.set(key, f);
      return { locked, strikes: f.strikes, minutes: locked ? Math.ceil((f.until - now) / 60000) : 0 };
    },
    ok(key) { m.delete(key); },
  };
}
/** Gemeinsame Sicherheits-Header für alle Ports (Verwaltung/Tablet, Mitglieder-App, Beregnung) */
function hardenHeaders({ frame = 'SAMEORIGIN' } = {}) {
  return (req, res, next) => {
    res.setHeader('X-Frame-Options', frame);   // Schutz gegen Einbetten in fremde Seiten (Klick-Fallen) – zusätzlich zu frame-ancestors
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (!res.getHeader('Permissions-Policy')) res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    // HTTPS: Browser merken sich einen Tag lang, nur noch verschlüsselt zu verbinden (ohne Subdomains – Home Assistant selbst bleibt unberührt)
    if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=86400');
    // Antworten der Schnittstellen (Konten, Beträge, Namen) nie im Browser- oder Proxy-Zwischenspeicher ablegen
    if (/^\/api\//i.test(req.path)) res.setHeader('Cache-Control', 'no-store');
    next();
  };
}
/* Schutz gegen „DNS-Rebinding“: Eine fremde Webseite könnte ihren Namen auf die Adresse der Vereinsheimverwaltung im
   WLAN umbiegen und so aus dem Browser eines Mitglieds heraus Anfragen stellen. Deshalb werden nur Anfragen an bekannte
   Adressen beantwortet: IP-Adressen, Namen ohne Punkt (homeassistant), lokale Endungen (.local, .fritz.box …), die Namen
   aus dem HTTPS-Zertifikat, die eingetragenen App-Adressen und „Weitere Adressen“ (Einstellungen → Sicherheit). */
const LOCAL_SUFFIX = /\.(local|lan|home|internal|intern|localdomain|home\.arpa|fritz\.box|box|speedport\.ip|localhost)$/;
let hostCache = { at: 0, set: new Set() };
function certNames() {
  try {
    const f = process.env.SSL_CERT; if (!f) return [];
    const x = new (require('crypto').X509Certificate)(require('fs').readFileSync(f));
    return String(x.subjectAltName || '').split(',').map(t => t.trim()).filter(t => t.startsWith('DNS:')).map(t => t.slice(4).toLowerCase());
  } catch (e) { return []; }
}
const hostOf = u => { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ''; } };
function knownHosts() {
  if (Date.now() - hostCache.at < 30000) return hostCache.set;
  const set = new Set(certNames());
  for (const h of String(process.env.ALLOWED_HOSTS || '').split(/[\s,]+/)) if (h) set.add(h.toLowerCase());
  for (const h of String(getSetting('allowed_hosts', '')).split(/[\s,]+/)) if (h) set.add(h.toLowerCase());
  const a = hostOf(getSetting('app_url', '')); if (a) set.add(a);
  try { const b = hostOf(JSON.parse(getSetting('ext_beregnung_cfg', '{}')).webappUrl || ''); if (b) set.add(b); } catch (e) { /* */ }
  hostCache = { at: Date.now(), set };
  return set;
}
function hostAllowed(hostHeader) {
  let h = String(hostHeader || '').trim().toLowerCase();
  if (!h) return false;
  if (h.startsWith('[')) return /^\[[0-9a-f:.]+\](:\d+)?$/.test(h);   // IPv6-Adresse
  h = h.replace(/:\d+$/, '').replace(/\.$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;            // IPv4-Adresse
  if (!/^[a-z0-9.-]+$/.test(h)) return false;
  if (!h.includes('.') || h === 'localhost' || LOCAL_SUFFIX.test(h)) return true;
  if (/^[0-9a-f]{8}-[a-z0-9_-]+$/.test(h)) return true;              // interner Add-on-Name im Home-Assistant-Netz
  return knownHosts().has(h);
}
function hostGuard({ bypass } = {}) {
  return (req, res, next) => {
    if (hostAllowed(req.headers.host) || (bypass && bypass(req))) return next();
    const h = String(req.headers.host || '').slice(0, 100);
    res.status(421).type('text/plain; charset=utf-8').send(`Unbekannte Adresse „${h}“.\n\nAus Sicherheitsgründen antwortet die Vereinsheimverwaltung nur unter bekannten Adressen. ` +
      'Bitte über die IP-Adresse oder die Home-Assistant-Seitenleiste öffnen und den Namen unter Einstellungen → Sicherheit → „Weitere Adressen“ eintragen.');
  };
}
const resetHostCache = () => { hostCache.at = 0; };
module.exports = { securityAlert, limiter, hardenHeaders, hostGuard, hostAllowed, resetHostCache };
