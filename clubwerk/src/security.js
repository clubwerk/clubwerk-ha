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
    mail.send({ to, subject: `Sicherheitshinweis – Clubwerk (${club})`,
      text: `Hallo,\n\n${text}\n\nZeit: ${new Date().toLocaleString('de-DE')}\n\nDetails stehen in der Verwaltung unter „Protokoll“.\n\nAutomatisch versendet von Clubwerk.` })
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
/** Kontingent je Schlüssel und Zeitfenster (z. B. 20 E-Mails je Mitglied und Stunde): take(key, n) → true, wenn n noch ins Fenster passt.
 *  Anders als limiter() ohne Sperr-Eskalation – nach Ablauf des Fensters zählt es einfach von vorn. Begrenzte Größe wie limiter(). */
function budget({ max = 20, windowMs = 3600000, size = 2000 } = {}) {
  const m = new Map();
  return {
    take(key, n = 1) {
      const now = Date.now(); let b = m.get(key);
      if (!b || b.reset < now) { m.delete(key); if (m.size >= size) m.delete(m.keys().next().value); b = { n: 0, reset: now + windowMs }; m.set(key, b); }
      if (b.n + n > max) return false;
      b.n += n; return true;
    },
    left(key) { const b = m.get(key); return !b || b.reset < Date.now() ? max : Math.max(0, max - b.n); },
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
/* Schutz gegen „DNS-Rebinding“: Eine fremde Webseite könnte ihren Namen auf die Adresse von Clubwerk im
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
  if (getSetting('ext_tunnel', '0') === '1') { const t = hostOf(getSetting('ext_tunnel_url', '')); if (t) set.add(t); }
  try { const b = hostOf(JSON.parse(getSetting('ext_beregnung_cfg', '{}')).webappUrl || ''); if (b) set.add(b); } catch (e) { /* */ }
  hostCache = { at: Date.now(), set };
  return set;
}
function hostAllowed(hostHeader) {
  let h = String(hostHeader || '').trim().toLowerCase();
  if (!h) return false;
  if (h.startsWith('[')) { const m = /^\[([0-9a-f:.]+)\](:\d+)?$/.exec(h); return Boolean(m) && require('net').isIPv6(m[1]); }   // gültige IPv6-Adresse
  h = h.replace(/:\d+$/, '').replace(/\.$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h.split('.').every(x => Number(x) <= 255 && !/^0\d/.test(x));   // gültige IPv4-Adresse (keine 999.…, keine führenden Nullen)
  if (!/^[a-z0-9.-]+$/.test(h)) return false;
  if (!h.includes('.') || h === 'localhost' || LOCAL_SUFFIX.test(h)) return true;
  if (/^[0-9a-f]{8}-[a-z0-9_-]+$/.test(h)) return true;              // interner Add-on-Name im Home-Assistant-Netz
  return knownHosts().has(h);
}
function hostGuard({ bypass } = {}) {
  return (req, res, next) => {
    if (hostAllowed(req.headers.host) || (bypass && bypass(req))) return next();
    const h = String(req.headers.host || '').slice(0, 100);
    const msg = `Unbekannte Adresse „${h}“.`;
    if (String(req.path || '').startsWith('/api/')) return res.status(421).json({ error: msg });   // Schnittstelle: immer JSON { error }
    res.status(421).type('text/plain; charset=utf-8').send(`${msg}\n\nAus Sicherheitsgründen antwortet Clubwerk nur unter bekannten Adressen. ` +
      'Bitte über die IP-Adresse oder die Home-Assistant-Seitenleiste öffnen und den Namen unter Einstellungen → Sicherheit → „Weitere Adressen“ eintragen.');
  };
}
const resetHostCache = () => { hostCache.at = 0; };

/* ---------- Nur aus dem eigenen Netz (Verwaltung/Tablet 3100, Beregnungs-Webapp 5000) ----------
   Diese Ports sind nie fürs Internet gedacht. Leitet ein Router sie versehentlich weiter, kommt die Anfrage mit einer
   öffentlichen Absenderadresse an – die wird hier abgewiesen, egal was in den Kopfzeilen steht (geprüft wird die echte
   Socket-Adresse). Erlaubt: Loopback, private IPv4-Netze (10/8, 172.16/12, 192.168/16), CGNAT/VPN (100.64/10, z. B. Tailscale),
   Link-Local, IPv6 ULA (fc00::/7) und Link-Local (fe80::/10). Öffentliche IPv6-Adressen (2000::/3) gelten als „eigenes Netz“
   nur, wenn sie in den eingetragenen Vereinsnetzen stehen – sonst nur aus dem gleichen /64-Präfix wie eine eigene Adresse. */
function v4Int(ip) { const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip); return m && m.slice(1).every(x => +x < 256) ? ((+m[1] << 24) >>> 0) + (+m[2] << 16) + (+m[3] << 8) + +m[4] : null; }
function inV4(ip, cidr) { const [n, b] = cidr.split('/'); const a = v4Int(ip), c = v4Int(n); if (a == null || c == null) return false; const bits = +b; return bits === 0 || (a >>> (32 - bits)) === (c >>> (32 - bits)); }
const normIp = ip => String(ip || '').trim().replace(/^::ffff:(?=\d+\.)/i, '').replace(/%.*$/, '').toLowerCase();
function privateSource(raw) {
  const ip = normIp(raw);
  if (!ip) return false;
  if (v4Int(ip) != null) return ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10', '169.254.0.0/16'].some(c => inV4(ip, c));
  if (ip === '::1') return true;
  return /^f[cd][0-9a-f]{2}:/.test(ip) || /^fe[89ab][0-9a-f]:/.test(ip);
}
function v6Prefix64(ip) {   // die ersten vier Blöcke einer (ggf. verkürzten) IPv6-Adresse
  const [h, t] = ip.split('::'); const a = h ? h.split(':') : [], b = t != null && t ? t.split(':') : [];
  const full = t != null ? [...a, ...Array(8 - a.length - b.length).fill('0'), ...b] : a;
  return full.length === 8 ? full.slice(0, 4).map(x => parseInt(x || '0', 16)).join(':') : null;
}
function ownV6Prefixes() {
  const out = new Set();
  try { for (const l of Object.values(require('os').networkInterfaces())) for (const a of l || []) if (a.family === 'IPv6' && /^[23]/.test(a.address)) { const p = v6Prefix64(a.address.toLowerCase()); if (p) out.add(p); } } catch (e) { /* */ }
  return out;
}
function lanSource(raw, { extra } = {}) {
  const ip = normIp(raw);
  if (!ip) return false;
  if (extra && extra(ip)) return true;
  if (/^127\./.test(ip) || ip === '::1') return true;
  // Sind Vereinsnetze eingetragen, gelten nur diese (plus Seitenleiste/Proxy über „extra“) – nicht mehr jedes private Netz
  let clubList = false;
  try { const ma = require('./memberapp'); clubList = ma.hasClubNets(); if (clubList) return ma.inClubNets(ip); } catch (e) { /* */ }
  if (privateSource(ip)) return true;
  if (/^[23][0-9a-f]{3}:/.test(ip)) {
    try { if (require('./memberapp').inClubNets(ip)) return true; } catch (e) { /* */ }
    const p = v6Prefix64(ip); if (p && ownV6Prefixes().has(p)) return true;
  }
  return false;
}
/** nicht aus dem Internet: private Adresse (auch Gast-WLAN, VPN) oder eine IPv6-Adresse aus dem eigenen Netz dieses Rechners */
function notPublic(raw) {
  const ip = normIp(raw);
  if (!ip) return false;
  if (privateSource(ip)) return true;
  if (/^[23][0-9a-f]{3}:/.test(ip)) { const p = v6Prefix64(ip); if (p && ownV6Prefixes().has(p)) return true; }
  return false;
}
function lanOnly({ label = 'Clubwerk', extra } = {}) {
  return (req, res, next) => {
    const ip = req.socket && req.socket.remoteAddress;
    if (lanSource(ip, { extra })) return next();
    securityAlert(`${label}: Anfrage von öffentlicher Adresse ${normIp(ip)} abgewiesen (${String(req.method)} ${String(req.path || '').slice(0, 80)}). Ist der Port am Router freigegeben? Bitte die Freigabe entfernen.`, `lanonly:${label}`);
    const msg = `${label} ist nur im Vereinsnetz erreichbar.`;
    if (String(req.path || '').startsWith('/api/')) return res.status(403).json({ error: msg });
    res.status(403).type('text/plain; charset=utf-8').send(msg + '\n\nVon unterwegs ist nur die Mitglieder-App über den Cloudflare Tunnel vorgesehen.');
  };
}
/** Antworten komprimieren (gzip/brotli je nach Browser) – Skripte, Stile, JSON, SVG; Bilder/Archive bleiben unverändert */
const compression = require('compression');
const compress = () => compression({ threshold: 1024, level: 6, filter: (req, res) => { const t = String(res.getHeader('Content-Type') || ''); return /^(text\/|application\/(json|javascript|manifest\+json|xml)|image\/svg)/.test(t) || compression.filter(req, res); } });
module.exports = { notPublic, privateSource, lanSource, lanOnly, compress, securityAlert, limiter, budget, hardenHeaders, hostGuard, hostAllowed, resetHostCache };
