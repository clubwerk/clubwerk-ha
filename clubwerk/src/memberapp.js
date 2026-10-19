'use strict';
/* ---------- Mitglieder-App: EIN QR-Code, EINE PIN, alle freigeschalteten Bereiche ----------
   Läuft auf einem eigenen Port (Standard 5001). Ein Mitglied wird einmal per QR-Code eingeladen, legt seine
   App-PIN fest – damit ist genau dieses Handy gekoppelt (src/invites.js, Bereich „app“).
   Welche Bereiche es nutzen darf (Zugang, Beregnung …), hakt der Admin je Mitglied an (Tabelle member_access).
   Module hängen sich mit einem eigenen Router (ctx.member) und einer Seite public/member.js ein.
   Die Getränke-PIN am Tablet ist davon unabhängig. */
const fs = require('fs');
const path = require('path');
const express = require('express');
const { db, getSetting, setSetting, audit } = require('./db');
const invites = require('./invites');
const tls = require('./tls');
const INTERNAL = () => tls.internalBase();
const SCOPE = 'app';
/* Externer Zugang über einen Cloudflare Tunnel (nur die Mitglieder-App): */
const tunnelOn = () => getSetting('ext_tunnel', '0') === '1';
const tunnelUrl = () => getSetting('ext_tunnel_url', '');
/** Adresse, die im QR-Code landet: mit Tunnel die öffentliche, sonst die im WLAN */
const tunnelHost = () => { try { return tunnelUrl() ? new URL(tunnelUrl()).host.toLowerCase() : ''; } catch (e) { return ''; } };
/** Bereich „von unterwegs“ (über den Tunnel) nutzbar? Einstellung je Bereich, sonst Vorgabe des Moduls (Beregnung, Türen: nein) */
const extCfg = () => { try { const x = JSON.parse(getSetting('app_ext_modules', '{}')); return x && typeof x === 'object' ? x : {}; } catch (e) { return {}; } };
function extAllowed(id) { const c = extCfg(); if (c[id] !== undefined) return Boolean(c[id]); const m = modules.get(id); return m ? m.away !== false : false; }
/* Vereins-WLAN = Anfrage kommt direkt aus dem privaten Netz bei Home Assistant an (nicht über den Tunnel). Die App erreicht
   im Vereinsheim die lokale HTTPS-Adresse (Einstellung „Adresse im Vereins-WLAN“) und nutzt sie dann für alle Aufrufe. */
/** von außen (über den Tunnel oder von einer öffentlichen Absenderadresse)? */
const awayReq = req => Boolean(req.viaTunnel) || !PRIVATE_IP(String(req.socket.remoteAddress || ''));
/** darf dieses Mitglied den Bereich bei dieser Anfrage nutzen? (im WLAN immer; unterwegs, wenn der Bereich oder das Mitglied dafür freigegeben ist) */
/** lokale HTTPS-Adresse der App (nur https ist von der öffentlichen Seite aus erreichbar – Browser blocken http als „Mixed Content“) */
const lanUrl = () => { const u = getSetting('app_url', '').replace(/\/+$/, ''); return /^https:\/\//i.test(u) || (process.env.CW_TEST_LAN_HTTP === '1' && /^http:\/\/(localhost|127\.0\.0\.1)/.test(u)) ? u : ''; };
const originOf = u => { try { return new URL(u).origin; } catch (e) { return ''; } };
const awayOk = (req, id, row) => !awayReq(req) || extAllowed(id) || Boolean(row && row.away);
const WLAN_ONLY = 'Nur im Vereins-WLAN nutzbar – bitte im Vereinsheim öffnen.';
const qrUrl = () => (tunnelOn() && tunnelUrl() ? tunnelUrl() : getSetting('app_url', ''));
/** private Absenderadresse (WLAN, Add-on-Netz, derselbe Rechner, link-local)? */
const PRIVATE_IP = ip => /^(::ffff:)?(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) || ip === '::1' || /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip);
/** von außen? Über den Tunnel und nicht aus dem Vereinsnetz – oder direkt von einer öffentlichen Adresse (versehentliche Portfreigabe am Router:
 *  dann kommt keine cf-Kopfzeile, die Anfrage darf trotzdem nicht als „im WLAN“ gelten) */
/* Der Kopfzeile cf-connecting-ip (echte Absenderadresse hinter Cloudflare) wird nur geglaubt, wenn die Anfrage tatsächlich vom Tunnel kommt.
   Sonst könnte jedes Handy im Vereins-WLAN mit wechselnden Adressen alle Bremsen (Kopplung, Übernahme, Online-Antrag …) aushebeln.
   Vertraute Quellen: das in der Add-on-Konfiguration eingetragene Proxy-Add-on („proxy_addon_ip“, über TRUSTED_PROXY – ohne den Supervisor),
   das Add-on-Netz 172.30.32.0/23 samt Gateway 172.30.32.1/172.30.33.1 (das Cloudflared-Add-on läuft mit host_network und erscheint über
   das Docker-NAT als Gateway-Adresse) und derselbe Rechner (127.0.0.1/::1, Tests). */
const TUNNEL_IPS = (process.env.TRUSTED_PROXY || '').split(',').map(x => x.trim()).filter(x => x && x !== '172.30.32.2');
function fromTunnel(sock) {
  const ip = String(sock || '').replace(/^::ffff:/, '');
  if (!ip) return false;
  if (TUNNEL_IPS.includes(ip)) return true;
  if (/^172\.30\.3[23]\.\d{1,3}$/.test(ip)) return true;
  return ip === '127.0.0.1' || ip === '::1';
}
/** zuletzt abgelehnte Tunnel-Anfrage (nur im Speicher) – damit der Vorstand in der Verwaltung sieht, wenn das Cloudflared-Add-on
 *  von einer anderen Adresse kommt als erwartet, statt dass sich Mitglieder draußen über eine „kaputte“ App wundern */
let lastTunnelReject = null;
const noteTunnelReject = (sock, req, why) => { lastTunnelReject = { ip: String(sock || '').replace(/^::ffff:/, '').slice(0, 45), at: new Date().toISOString(), host: String(req.headers.host || '').slice(0, 100), why }; };

db.exec(`
CREATE TABLE IF NOT EXISTS member_access (
  member_id   INTEGER NOT NULL REFERENCES members(id),
  module      TEXT NOT NULL,
  profile     TEXT,                    -- z. B. Zeitprofil beim Zugang
  valid_until TEXT,                    -- JJJJ-MM-TT einschließlich, NULL = unbegrenzt
  blocked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (member_id, module)
);
`);

const { today } = require('./util');
// 3.14.2: Ausnahme je Mitglied – Bereich auch von unterwegs nutzbar, obwohl er sonst nur im Vereins-WLAN gilt (Platzwart, Privat-Relay)
try { db.exec('ALTER TABLE member_access ADD COLUMN away INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* gibt es schon */ }
// 3.17: zusätzliche Haken je Mitglied und Bereich, die das Modul anbietet (Hook accessOptions().flags), z. B. Buchen → „Gebühren zeigen“ – JSON { fees: true }
try { db.exec('ALTER TABLE member_access ADD COLUMN flags TEXT'); } catch (e) { /* gibt es schon */ }
const parseFlags = v => { try { const x = JSON.parse(v || '{}'); return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; } catch (e) { return {}; } };
const hasFlags = row => Boolean(row && Object.values(parseFlags(row.flags)).some(Boolean));

/* Module, die in der App erscheinen: id -> { name, label, order, dir, router, hooks, isActive } */
const modules = new Map();
function register(id, info) { modules.set(id, info); }
/* Öffentliche Teile von Modulen (ohne Anmeldung, z. B. Online-Mitgliedsantrag) */
const publics = new Map();
function registerPublic(id, info) { publics.set(id, info); }
/** Freischaltung für ein Modul: Module mit „alle“ gelten für jedes gekoppelte Handy (außer ausdrücklich gesperrt) */
function accessFor(memberId, id) {
  const m = modules.get(id);
  if (m && m.open) {
    const r = access.get(memberId, id);
    if (r && r.blocked) return { ok: false, row: r, reason: 'Dieser Bereich ist für dich gesperrt – bitte beim Vorstand melden.' };
    return { ok: true, row: r };
  }
  return access.check(memberId, id);
}
/* Reihenfolge der Bereiche in der App (Reiter) und in der Freischaltungstabelle: Einstellung app_module_order (JSON-Liste von IDs),
   nicht gelistete Bereiche dahinter in der Reihenfolge der Module (order aus erweiterung.json) */
const moduleOrder = () => { try { const x = JSON.parse(getSetting('app_module_order', '[]')); return Array.isArray(x) ? x.map(String) : []; } catch (e) { return []; } };
const push = require('./push');
const activeModules = () => {
  const ord = moduleOrder(), pos = id => { const i = ord.indexOf(id); return i < 0 ? 1e6 : i; };
  return [...modules.entries()].filter(([, m]) => m.isActive()).sort((a, b) => pos(a[0]) - pos(b[0]) || (a[1].order || 50) - (b[1].order || 50));
};
push.setModules(activeModules);

/* ---------- Freischaltungen ---------- */
const access = {
  get: (memberId, module) => db.prepare('SELECT * FROM member_access WHERE member_id = ? AND module = ?').get(memberId, module) || null,
  /** gültig = vorhanden, nicht gesperrt, nicht abgelaufen → { ok, row, reason } */
  check(memberId, module) {
    const r = access.get(memberId, module);
    if (!r) return { ok: false, reason: 'Dieser Bereich ist für dich nicht freigeschaltet.' };
    if (r.blocked) return { ok: false, row: r, reason: 'Dieser Bereich ist für dich gesperrt – bitte beim Vorstand melden.' };
    if (r.valid_until && r.valid_until < today()) return { ok: false, row: r, reason: `Deine Freischaltung war bis ${r.valid_until.split('-').reverse().join('.')} gültig.` };
    return { ok: true, row: r };
  },
  list: module => db.prepare(`SELECT a.*, m.name FROM member_access a JOIN members m ON m.id = a.member_id WHERE a.module = ? AND m.deleted = 0 ORDER BY name_key(m.name, m.kind)`).all(module),
  set(memberId, module, fields = {}) {
    const cur = access.get(memberId, module);
    const f = { profile: cur ? cur.profile : null, valid_until: cur ? cur.valid_until : null, blocked: cur ? cur.blocked : 0, away: cur ? cur.away : 0, flags: cur ? cur.flags : null, ...fields };
    db.prepare(`INSERT INTO member_access(member_id, module, profile, valid_until, blocked, away, flags) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(member_id, module) DO UPDATE SET profile = excluded.profile, valid_until = excluded.valid_until, blocked = excluded.blocked, away = excluded.away, flags = excluded.flags`)
      .run(memberId, module, f.profile ?? null, f.valid_until || null, f.blocked ? 1 : 0, f.away ? 1 : 0, f.flags || null);
  },
  remove: (memberId, module) => db.prepare('DELETE FROM member_access WHERE member_id = ? AND module = ?').run(memberId, module).changes > 0,
};

/** Zustand eines Mitglieds für die Verwaltung */
function memberState(memberId) {
  const dev = db.prepare(`SELECT device, paired_at, last_used, invite_expires, blocked_at, paired_host, invite_hash IS NOT NULL AS invited, token_hash IS NOT NULL AS paired FROM member_devices WHERE scope = ? AND member_id = ?`).get(SCOPE, memberId);
  // gekoppelt unter einer anderen Adresse als der öffentlichen? Dann braucht das Handy einen neuen QR-Code, um auch unterwegs zu funktionieren
  const th = tunnelOn() ? tunnelHost() : '';
  const oldAddress = Boolean(dev && dev.paired && th && (dev.paired_host || '') !== th);
  const acc = db.prepare('SELECT module, profile, valid_until, blocked, away, flags FROM member_access WHERE member_id = ?').all(memberId);
  return {
    device: dev ? { status: dev.paired ? 'gekoppelt' : dev.blocked_at && !dev.invited ? 'gesperrt' : dev.invite_expires >= Date.now() ? 'eingeladen' : 'abgelaufen', label: dev.device, paired_at: dev.paired_at, last_used: dev.last_used, blocked_at: dev.blocked_at, host: dev.paired_host || null, oldAddress } : null,
    access: Object.fromEntries(acc.map(a => [a.module, { profile: a.profile, valid_until: a.valid_until, blocked: Boolean(a.blocked), away: Boolean(a.away), flags: parseFlags(a.flags) }])),
    // je Bereich angehakt? „für alle“-Bereiche gelten, bis sie für dieses Mitglied abgeschaltet werden
    granted: Object.fromEntries(activeModules().map(([id, m]) => { const a = acc.find(x => x.module === id); return [id, m.open ? !(a && a.blocked) : Boolean(a)]; })),
  };
}
const moduleInfo = () => activeModules().map(([id, m]) => {
  let options = null;
  try { options = m.hooks.accessOptions ? m.hooks.accessOptions() : null; } catch (e) { options = null; }
  // Profile nur für eigens freizuschaltende Bereiche; zusätzliche Haken (flags) auch für „für alle“-Bereiche
  return { id, name: m.name, label: m.label, perm: m.perm, open: Boolean(m.open), away: extAllowed(id), options: options ? (m.open ? { flags: options.flags || null } : options) : null };
});

/* ---------- Port der Mitglieder-App ---------- */
function startPort({ rateLimit, rateLimitKey }) {
  const port = parseInt(process.env.MEMBER_PORT || '5001', 10);
  if (!port) return;
  const app = express();
  app.disable('x-powered-by');
  app.use(require('./security').hostGuard());
  app.use(require('./security').hardenHeaders({ frame: 'DENY' }));
  app.use(require('./security').compress());
  // Anfragen über den Tunnel: echte Absender-IP für die Sperren bei Fehlversuchen (sonst teilten sich alle Handys draußen eine IP)
  app.use((req, res, next) => {
    const cf = req.get('cf-connecting-ip');
    if (!cf) return next();
    const sock = String(req.socket.remoteAddress || '');
    if (!tunnelOn()) { noteTunnelReject(sock, req, 'aus'); return res.status(403).json({ error: 'Externer Zugang ist ausgeschaltet.' }); }
    // cf-Kopfzeile von einem Gerät, das nicht der Tunnel ist (z. B. aus dem Vereins-WLAN): nicht glauben, Anfrage ablehnen
    if (!fromTunnel(sock)) { noteTunnelReject(sock, req, 'quelle'); return res.status(403).json({ error: 'Externer Zugang ist ausgeschaltet.' }); }
    const ip = String(cf).trim().slice(0, 45);
    if (/^[0-9a-fA-F:.]+$/.test(ip)) Object.defineProperty(req, 'ip', { value: ip, configurable: true });
    req.viaTunnel = true;
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // Die App darf zusätzlich die lokale Adresse (im Vereinsheim) bzw. die öffentliche Adresse ansprechen
    const own = [originOf(lanUrl()), tunnelOn() ? originOf(tunnelUrl()) : ''].filter(Boolean);
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${own.join(' ')}; frame-src 'self' ${own.join(' ')}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' ${own.join(' ')}`);
    // Die öffentliche App bettet im Vereinsheim die lokale Adresse ein (Inlay) – nur die eigenen Adressen dürfen einbetten
    if (own.length) res.removeHeader('X-Frame-Options');
    // CORS nur zwischen den beiden eigenen Adressen (öffentlich ↔ lokal): die App von app.verein.de ruft im WLAN https://lan…:5001 auf
    const o = req.get('origin');
    if (o && own.includes(o)) {
      res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Geraet, X-Clubwerk'); res.setHeader('Access-Control-Max-Age', '600');
      if (req.method === 'OPTIONS') return res.status(204).end();
    }
    next();
  });
  // Unterschriften (Online-Antrag, neue Bankverbindung) brauchen mehr Platz als die übrigen Anfragen
  app.use(['/api/p', '/api/m/mitglieder', '/api/photo'], express.json({ limit: '600kb' }));
  app.use(express.json({ limit: '10kb' }));
  const relay = (p, t) => async (req, res) => {
    try {
      const r = await fetch(`${INTERNAL()}${p}`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return res.status(404).end();
      const ct = r.headers.get('content-type') || t;
      if (/^image\//.test(ct)) res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");   // Bilder (auch SVG-Logo) nie als Seite mit Skripten
      res.set({ 'Content-Type': ct, 'Cache-Control': /\.(woff2|png)$/.test(p) ? 'public, max-age=604800' : 'no-cache' }).send(Buffer.from(await r.arrayBuffer()));   // Schriften/Icons eine Woche, Rest per ETag
    } catch (e) { res.status(404).end(); }
  };
  for (const [p, t] of [['/style.css', 'text/css'], ['/kit.css', 'text/css'], ['/theme.css', 'text/css'], ['/icon-192.png', 'image/png'], ['/icon-512.png', 'image/png'], ['/fonts/jakarta-latin.woff2', 'font/woff2'], ['/fonts/jakarta-latin-ext.woff2', 'font/woff2'], ['/theme-init.js', 'application/javascript']]) app.get(p, relay(p, t));
  // Sprache: Anfrage samt Wahl (l) und Handy-Sprache (b) an den Hauptserver weiterreichen
  app.get('/i18n.js', (req, res) => relay('/i18n.js?' + new URLSearchParams({ l: String(req.query.l || 'auto').slice(0, 20), b: String(req.query.b || '').slice(0, 200) }), 'application/javascript')(req, res));
  app.get('/logo', relay('/vereinslogo', 'image/png'));
  app.get('/icon.png', relay('/vereinsicon.png', 'image/png'));
  app.get('/manifest.json', (req, res) => {
    const name = getSetting('app_name', 'Verein');
    // mit Übernahme-Code: die Home-Bildschirm-App startet mit #k=…, damit sie die Freischaltung übernehmen kann (iPhone)
    const k = /^[A-Z2-9]{10}$/.test(String(req.query.k || '')) ? String(req.query.k) : '';
    res.set('Cache-Control', 'no-store');
    res.json({ name: `${getSetting('club_name', 'Verein')} – ${name}`, short_name: name, start_url: k ? `./#k=${k}` : './', scope: './', display: 'standalone', background_color: '#f6f5f1', theme_color: getSetting('club_color', '#1f6b3a'),
      icons: [{ src: 'icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' }] });
  });
  // Seiten der Module (public/member.js)
  app.get('/m/:id/:file', (req, res) => {
    const m = modules.get(req.params.id);
    if (!m || !m.isActive() || !m.dir || !/^[a-z0-9_-]+\.js$/.test(req.params.file) || ['admin.js'].includes(req.params.file)) return res.status(404).end();
    const f = path.join(m.dir, 'public', req.params.file);
    if (!fs.existsSync(f)) return res.status(404).end();
    res.type('application/javascript').set('Cache-Control', 'no-cache').sendFile(f);
  });

  const api = express.Router();
  const dev = req => req.get('X-Geraet') || '';
  // Diagnose: ip = so sieht Clubwerk den Absender; wlan = Anfrage kam direkt aus dem Vereinsnetz (nicht über den Tunnel)
  api.get('/ping', (req, res) => res.json({ ok: true, app: 'clubwerk', club: getSetting('club_name', ''), tunnel: Boolean(req.viaTunnel), wlan: !awayReq(req), ip: String(req.ip || '').replace(/^::ffff:/, '') }));
  api.get('/me', (req, res) => {
    const w = invites.whoIs(SCOPE, dev(req));
    const sections = w ? activeModules().filter(([id, m]) => { const a = access.get(w.memberId, id); return m.open ? !(a && a.blocked) : a; }).map(([id, m]) => {
      const c = accessFor(w.memberId, id);
      if (c.ok && !awayOk(req, id, c.row)) return { id, title: m.label || m.name, ok: false, reason: WLAN_ONLY, wlanOnly: true };
      return { id, title: m.label || m.name, ok: c.ok, reason: c.ok ? null : c.reason };
    }) : [];
    res.json({ lanUrl: lanUrl(), wlan: !awayReq(req), club: getSetting('club_name', 'Unser Verein'), appName: getSetting('app_name', 'Verein'), member: w ? w.name : null, sections });
  });
  api.get('/invite', rateLimit('appinv', 30, 60000), (req, res) => {
    const p = invites.peek(SCOPE, String(req.query.t || ''));
    if (p.error) return res.status(410).json(p);
    res.json(p);
  });
  api.post('/pair', rateLimit('apppair', 10, 60000), (req, res) => {
    try {
      const out = invites.redeem(SCOPE, String((req.body || {}).t || ''), (req.body || {}).pin, req.get('user-agent'), req.get('host'));
      audit(null, 'Mitglieder-App: Handy freigeschaltet', out.member);
      res.json({ ok: true, device: out.device, member: out.member });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  /* Übernahme in die Home-Bildschirm-App (siehe invites.js) */
  api.post('/transfer', rateLimit('apptrc', 20, 60000), (req, res) => {
    const code = invites.createTransfer(SCOPE, dev(req));
    if (!code) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    res.json({ code });
  });
  const trFails = require('./security').limiter({ per: 10, baseMs: 15 * 60000 });
  api.post('/transfer/redeem', rateLimit('apptrr', 10, 60000), (req, res) => {
    const ip = req.ip || '';
    const wait = trFails.blocked(ip);
    if (wait) return res.status(429).json({ error: `Zu viele Versuche – bitte in ${wait} Min. erneut versuchen.` });
    const b = req.body || {};
    const r = invites.redeemTransfer(SCOPE, b.code, b.pin, req.get('user-agent'), req.get('host'));
    if (!r.ok) { if (r.badCode) trFails.fail(ip); return res.status(r.status || 400).json({ error: r.error, pin: r.pin, badCode: r.badCode }); }
    trFails.ok(ip);
    audit(null, 'Mitglieder-App: Freischaltung in Home-Bildschirm-App übernommen', r.member);
    res.json({ ok: true, device: r.device, member: r.member });
  });
  /* Lokale Route per Seitenaufruf (Vereinsheim, auch mit iCloud Privat-Relay): Code holen → Seite wechselt auf https://lan… → dort einlösen */
  api.post('/handover', rateLimit('apphoc', 20, 60000), (req, res) => {
    const url = lanUrl();
    if (!url) return res.status(400).json({ error: 'Es ist keine lokale Adresse mit https eingerichtet.' });
    const code = invites.createHandover(SCOPE, dev(req));
    if (!code) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    res.json({ code, url });
  });
  api.post('/handover/redeem', rateLimit('apphor', 10, 60000), (req, res) => {
    if (awayReq(req)) return res.status(403).json({ error: 'Die lokale Adresse lässt sich nur im Vereins-WLAN einlösen.' });
    const ip = req.ip || '';
    const wait = trFails.blocked(ip);
    if (wait) return res.status(429).json({ error: `Zu viele Versuche – bitte in ${wait} Min. erneut versuchen.` });
    const b = req.body || {};
    const r = invites.redeemHandover(SCOPE, b.code, b.pin, req.get('host'));
    if (!r.ok) { if (r.badCode) trFails.fail(ip); return res.status(r.status || 400).json({ error: r.error, pin: r.pin, badCode: r.badCode }); }
    trFails.ok(ip);
    audit(null, 'Mitglieder-App: lokale Route im Vereinsheim übernommen', r.member);
    res.json({ ok: true, device: r.device, member: r.member });
  });
  /* Push-Benachrichtigungen je Handy (Abo im Browser; Anlässe gibt der Vorstand frei) */
  const whoDev = req => { const w = invites.whoIs(SCOPE, dev(req)); return w; };
  const devLabel = req => { const d = db.prepare('SELECT device FROM member_devices WHERE id = ?').get((whoDev(req) || {}).deviceId); return d ? d.device : null; };
  api.post('/push/state', rateLimit('apppst', 60, 60000), (req, res) => {
    const w = whoDev(req); if (!w) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    res.json(push.state(w.memberId, String((req.body || {}).endpoint || '')));
  });
  api.post('/push/subscribe', rateLimit('apppsu', 20, 60000), (req, res) => {
    const w = whoDev(req); if (!w) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    try {
      const st = push.subscribe({ memberId: w.memberId, deviceId: w.deviceId, label: devLabel(req) }, (req.body || {}).subscription, process.env.CW_PUSH_ALLOW_HTTP === '1');
      audit(null, 'Mitglieder-App: Push eingeschaltet', w.name);
      res.json(st);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  api.post('/push/unsubscribe', rateLimit('apppsu', 20, 60000), (req, res) => {
    const w = whoDev(req); if (!w) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    if (push.unsubscribe(w.memberId, (req.body || {}).endpoint)) audit(null, 'Mitglieder-App: Push ausgeschaltet', w.name);
    res.json(push.state(w.memberId, ''));
  });
  api.put('/push/events', rateLimit('apppev', 60, 60000), (req, res) => {
    const w = whoDev(req); if (!w) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    try { res.json(push.setEvents(w.memberId, (req.body || {}).endpoint, (req.body || {}).events)); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  api.post('/push/test', rateLimit('apppte', 5, 60000), async (req, res) => {
    const w = whoDev(req); if (!w) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    const r = await push.send(w.memberId, 'app.test', { title: `${getSetting('club_name', 'Verein')}: Testnachricht`, body: 'Push-Benachrichtigungen funktionieren auf diesem Handy.' }, { endpoint: String((req.body || {}).endpoint || '') });
    res.json({ ok: r.sent > 0, sent: r.sent, skipped: r.skipped || null });
  });
  api.post('/verify-pin', rateLimit('apppin', 20, 60000), (req, res) => {
    const c = invites.check(SCOPE, dev(req), (req.body || {}).pin);
    if (!c.ok) return res.status(c.status).json({ error: c.error, pin: c.pin, device: c.device });
    res.json({ ok: true });
  });
  /* Profilbild: das Mitglied lädt es selbst hoch und bestimmt, wo es erscheint */
  const photos = require('./photos');
  const meOr403 = (req, res) => { const w = invites.whoIs(SCOPE, dev(req)); if (!w) res.status(403).json({ error: 'Dieses Handy ist nicht (mehr) freigeschaltet.', device: true }); return w; };
  const modOn = id => { try { return require('./plugins').isActive(id); } catch (e) { return false; } };
  api.get('/photo', (req, res) => { const w = meOr403(req, res); if (w) res.json(photos.info(w.memberId, modOn)); });
  api.put('/photo', rateLimit('appphoto', 20, 3600000), (req, res) => {
    const w = meOr403(req, res); if (!w) return;
    const b = req.body || {};
    try { if (b.data) photos.save(w.memberId, b.data, b.use, { username: 'app', name: w.name }); else photos.setUse(w.memberId, b.use); res.json(photos.info(w.memberId, modOn)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  api.delete('/photo', (req, res) => { const w = meOr403(req, res); if (!w) return; photos.remove(w.memberId, { username: 'app', name: w.name }); res.json({ ok: true }); });
  api.get('/photo/img', (req, res) => { const w = meOr403(req, res); if (w) photos.send(res, w.memberId, null); });
  api.get('/photo/of/:id', (req, res) => {   // Bilder anderer (Platzbuchung, Helferdienste) – nur gekoppelte Handys, nur mit Freigabe
    const w = meOr403(req, res); if (!w) return;
    // … und nur, wer den Bereich selbst nutzen darf (Modul aktiv, Freischaltung gültig) – der Kreis der Betrachter bleibt so, wie es die App zeigt
    const u = String(req.query.u || ''); const mod = { buchung: 'buchung', helfer: 'arbeitseinsatz' }[u];
    if (!mod || !modOn(mod) || !accessFor(w.memberId, mod).ok) return res.status(404).end();
    photos.send(res, parseInt(req.params.id, 10), u);
  });
  // Schreibende Aufrufe je Gerät bremsen (Schlüssel: Hash des Gerätetokens, nicht die Adresse – draußen teilen sich viele Handys eine Adresse,
  // drinnen könnte ein Gerät die Adresse wechseln). Schützt vor Dauerfeuer auf PIN-prüfende Routen (scrypt kostet Rechenzeit) und Türimpulse.
  const crypto = require('crypto');
  const writeLimit = rateLimitKey('mwrite', 60, 60000, req => crypto.createHash('sha256').update(dev(req)).digest('hex').slice(0, 32));
  // Module: /api/m/<id>/… – nur gekoppeltes Gerät mit Freischaltung für dieses Modul
  api.use('/m/:id', (req, res, next) => {
    const m = modules.get(req.params.id);
    if (!m || !m.isActive()) return res.status(404).json({ error: 'Dieser Bereich ist nicht aktiv.' });
    const w = invites.whoIs(SCOPE, dev(req));
    if (!w) return res.status(403).json({ error: 'Dieses Handy ist nicht (mehr) freigeschaltet. Bitte beim Vorstand einen neuen QR-Code holen.', device: true });
    const c = accessFor(w.memberId, req.params.id);
    if (!c.ok) return res.status(403).json({ error: c.reason, denied: true });
    if (!awayOk(req, req.params.id, c.row)) return res.status(403).json({ error: WLAN_ONLY, denied: true, wlanOnly: true });
    const go = () => {
      req.member = { id: w.memberId, name: w.name, access: c.row ? { ...c.row, flags: parseFlags(c.row.flags) } : null };
      /** PIN prüfen (bei jeder schaltenden Aktion) → true oder Antwort gesendet */
      req.pinOk = () => {
        const r = invites.check(SCOPE, dev(req), (req.body || {}).pin);
        if (r.ok) return true;
        res.status(r.status).json({ error: r.error, pin: r.pin, device: r.device });
        return false;
      };
      m.router(req, res, next);
    };
    if (req.method === 'GET' || req.method === 'HEAD') return go();
    writeLimit(req, res, go);
  });
  // Öffentliche Teile der Module (ohne Anmeldung): API unter /api/p/<id>/…, Seiten unter /p/<id>/ (Ordner public/online des Moduls)
  api.use('/p/:id', rateLimit('apppub', 120, 60000), (req, res, next) => {
    const m = publics.get(req.params.id);
    if (!m || !m.isActive()) return res.status(404).json({ error: 'Dieser Bereich ist nicht aktiv.' });
    m.router(req, res, next);
  });
  app.use('/p/:id', (req, res, next) => {
    const m = publics.get(req.params.id);
    const dir = m && m.isActive() ? path.join(m.dir, 'public', 'online') : null;
    if (!dir || !fs.existsSync(dir)) return res.status(404).end();
    express.static(dir, { index: 'index.html', setHeaders: r => r.setHeader('Cache-Control', 'no-cache') })(req, res, next);
  });
  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Unbekannte Adresse.' }));
  app.use(express.static(path.join(__dirname, '..', 'public', 'app'), { index: 'index.html', setHeaders: r => r.setHeader('Cache-Control', 'no-cache') }));
  /* Fehler immer als JSON, ohne interne Details – echte Programmfehler landen im Protokoll statt als „Ungültige Anfrage“ unterzugehen */
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Die Datei ist zu groß.' });
    if (err && (err.type === 'entity.parse.failed' || (err.status >= 400 && err.status < 500))) return res.status(400).json({ error: 'Ungültige Anfrage.' });
    console.error('Mitglieder-App:', err);
    res.status(500).json({ error: 'Interner Fehler.' });
  });
  const srv = tls.listen(app, port, process.env.HOST || '0.0.0.0', 'Mitglieder-App');
  srv.on('error', e => console.error(`Mitglieder-App: Port ${port} nicht nutzbar (${e.code || e.message}).`));
}

/* ---------- Verwaltung ---------- */
function adminRoutes(admin, { bad, need, auth }) {
  // Profilbild in der Verwaltung ansehen und bei Bedarf entfernen
  /* Push-Benachrichtigungen: welche Anlässe es im Verein gibt (Recht „Einstellungen“), Überblick und Test */
  admin.get('/push', need('konten', 'einstellungen', 'mitglieder'), (req, res) => res.json(push.adminState()));
  admin.put('/push', need('konten', 'einstellungen'), (req, res) => { push.saveAdmin((req.body || {}).events, req.user); res.json(push.adminState()); });
  admin.post('/push/test', need('konten', 'einstellungen'), async (req, res) => {
    const id = parseInt((req.body || {}).memberId, 10);
    const m = db.prepare('SELECT name FROM members WHERE id = ?').get(id);
    if (!m) return bad(res, 'Mitglied nicht gefunden.', 404);
    const r = await push.send(id, 'app.test', { title: `${getSetting('club_name', 'Verein')}: Testnachricht`, body: `Vom Vorstand ausgelöst (${req.user.name || req.user.username || 'Verwaltung'}).` });
    audit(req.user, 'Push-Benachrichtigungen: Testnachricht', `${m.name} – ${r.sent} gesendet${r.skipped ? ' (' + r.skipped + ')' : ''}`);
    res.json({ ok: r.sent > 0, sent: r.sent, skipped: r.skipped || null });
  });
  admin.get('/photo/:id', need('konten', 'mitglieder'), (req, res) => require('./photos').send(res, parseInt(req.params.id, 10), null));
  admin.delete('/photo/:id', need('konten', 'mitglieder'), (req, res) => { require('./photos').remove(parseInt(req.params.id, 10), req.user); res.json({ ok: true }); });
  // Wer darf? „Mitglieder“ (konten) oder das Recht des jeweiligen Moduls
  const permsAll = () => ['konten', ...moduleInfo().filter(m => !m.open).map(m => m.perm).filter(Boolean)];
  // Freischalten für einen Bereich nur mit dem Recht DIESES Bereichs (z. B. Türen nur mit dem Recht „Zugang“) –
  // „Mitglieder“ allein reicht nur für Bereiche ohne eigenes Recht.
  const mayModule = (req, module) => {
    const m = modules.get(module);
    return m && m.perm ? req.user.perms.includes(m.perm) : req.user.perms.includes('konten');
  };
  // QR-Code/Handy eines Mitglieds: nur, wer alle Bereiche verwalten darf, die das Mitglied hat
  // (sonst könnte jemand mit nur „Beregnung“ das Handy eines Mitglieds mit Türzugang übernehmen)
  /** Bereiche des Mitglieds, für die dem Admin das Recht fehlt (leer = darf).
   *  Zählen nur aktive, eigens freigeschaltete Bereiche: „für alle“-Bereiche, gesperrte Freischaltungen und
   *  Einträge abgeschalteter/entfernter Module geben keinen Zugang und blockieren deshalb nichts. */
  const missingFor = (req, memberId) => db.prepare('SELECT module, blocked FROM member_access WHERE member_id = ?').all(memberId)
    .filter(r => { const m = modules.get(r.module); return m && m.isActive() && !m.open && !r.blocked; })
    .filter(r => !mayModule(req, r.module)).map(r => modules.get(r.module).label || modules.get(r.module).name);
  admin.get('/app', (req, res, next) => need(...permsAll())(req, res, next), (req, res) => {
    const ids = db.prepare(`SELECT DISTINCT member_id FROM (SELECT member_id FROM member_devices WHERE scope = ? UNION SELECT member_id FROM member_access)`).all(SCOPE).map(r => r.member_id);
    const rows = ids.map(id => { const m = db.prepare('SELECT id, name, kind, active, deleted FROM members WHERE id = ?').get(id); return m && !m.deleted ? { member_id: id, name: m.name, kind: m.kind, ...memberState(id) } : null; })
      .filter(Boolean).sort((a, b) => require('./db').nameKey(a.name, a.kind).localeCompare(require('./db').nameKey(b.name, b.kind), 'de'));
    const have = new Set(rows.map(r => r.member_id));
    const members = db.prepare("SELECT id, name FROM members WHERE kind = 'mitglied' AND active = 1 AND deleted = 0 AND pending = 0 ORDER BY name_key(name, kind)").all().filter(m => !have.has(m.id));
    res.json({ url: qrUrl(), lanUrl: getSetting('app_url', ''), tunnel: { on: tunnelOn(), url: tunnelUrl(), lanHttps: Boolean(lanUrl()), lastReject: lastTunnelReject, proxyIps: TUNNEL_IPS }, mayExt: req.user.perms.includes('einstellungen'), name: getSetting('app_name', 'Verein'), port: parseInt(process.env.MEMBER_PORT || '5001', 10) || null, https: tls.enabled(), modules: moduleInfo(), rows, members,
      security: { inviteHours: invites.inviteHours(), allowLink: getSetting('app_invite_link', '0') === '1', mailTo: getSetting('security_mail_to', ''), blockAfter: invites.BLOCK_AFTER, mailReady: require('./mail').ready() } });
  });
  admin.get('/app/member/:id', (req, res, next) => need(...permsAll())(req, res, next), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const m = db.prepare('SELECT id, name, kind FROM members WHERE id = ? AND deleted = 0').get(id);
    if (!m) return bad(res, 'Mitglied nicht gefunden.', 404);
    res.json({ member_id: id, name: m.name, kind: m.kind, url: qrUrl(), port: parseInt(process.env.MEMBER_PORT || '5001', 10) || null, https: tls.enabled(), modules: moduleInfo(), ...memberState(id) });
  });
  admin.post('/app/member/:id/invite', (req, res, next) => need(...permsAll())(req, res, next), (req, res) => {
    { const miss = missingFor(req, parseInt(req.params.id, 10)); if (miss.length) return bad(res, `Für einen neuen QR-Code fehlt dir das Recht für: ${miss.join(', ')} – bitte einen Admin mit diesem Recht fragen.`, 403); }
    try {
      const out = invites.create(SCOPE, parseInt(req.params.id, 10), req.user.name || req.user.username, req.user.role === 'oberadmin' ? '*' : req.user.perms);
      audit(req.user, 'Mitglieder-App: QR-Einladung erzeugt', out.member);
      res.json(out);
    } catch (e) { bad(res, e.message); }
  });
  admin.delete('/app/member/:id/device', (req, res, next) => need(...permsAll())(req, res, next), (req, res) => {
    const id = parseInt(req.params.id, 10);
    { const miss = missingFor(req, id); if (miss.length) return bad(res, `Zum Entfernen des Handys fehlt dir das Recht für: ${miss.join(', ')} – bitte einen Admin mit diesem Recht fragen.`, 403); }
    const m = db.prepare('SELECT name FROM members WHERE id = ?').get(id);
    invites.revoke(SCOPE, id); push.removeMember(id);
    audit(req.user, 'Mitglieder-App: Handy entfernt', m ? m.name : String(id));
    res.json({ ok: true });
  });
  /** Ganz aus der App entfernen: Handy und alle Freischaltungen weg – das Mitglied steht danach wieder unter „Mitglied freischalten“ */
  admin.delete('/app/member/:id', (req, res, next) => need(...permsAll())(req, res, next), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const m = db.prepare('SELECT name FROM members WHERE id = ?').get(id);
    if (!m) return bad(res, 'Mitglied nicht gefunden.', 404);
    const miss = missingFor(req, id);
    if (miss.length) return bad(res, `Zum Entfernen aus der App fehlt dir das Recht für: ${miss.join(', ')} – bitte einen Admin mit diesem Recht fragen.`, 403);
    invites.revoke(SCOPE, id); push.removeMember(id);
    const n = db.prepare('DELETE FROM member_access WHERE member_id = ?').run(id).changes;
    audit(req.user, 'Mitglieder-App: aus der App entfernt', `${m.name} (Handy und ${n} Freischaltung(en))`);
    res.json({ ok: true });
  });
  admin.put('/app/member/:id/access', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const mod = modules.get(String(b.module || ''));
    if (!mod || !mod.isActive()) return bad(res, 'Unbekannter Bereich.');
    if (!mayModule(req, b.module)) return bad(res, 'Dafür fehlt dir die Berechtigung.', 403);
    const m = db.prepare("SELECT name FROM members WHERE id = ? AND deleted = 0 AND kind = 'mitglied'").get(id);
    if (!m) return bad(res, 'Mitglied nicht gefunden.', 404);
    if (b.flags !== undefined && b.grant === undefined) {   // zusätzliche Haken des Moduls (z. B. Buchen → „Gebühren zeigen“)
      const cur = access.get(id, b.module);
      if (!mod.open && !cur) return bad(res, 'Zuerst den Bereich freischalten.');
      let opts = null; try { opts = mod.hooks.accessOptions ? mod.hooks.accessOptions() : null; } catch (e) { opts = null; }
      const known = ((opts && opts.flags) || []).map(f => f.id);
      const next = { ...(cur ? parseFlags(cur.flags) : {}) };
      const changed = [];
      for (const [k, v] of Object.entries(b.flags && typeof b.flags === 'object' ? b.flags : {})) { if (!known.includes(k)) return bad(res, 'Unbekannte Einstellung.'); if (v) next[k] = true; else delete next[k]; changed.push(`${((opts.flags.find(f => f.id === k) || {}).label) || k}: ${v ? 'an' : 'aus'}`); }
      const keep = Object.keys(next).length ? JSON.stringify(next) : null;
      if (mod.open && cur && !cur.blocked && !cur.away && !keep) access.remove(id, b.module); else access.set(id, b.module, { flags: keep, blocked: cur ? cur.blocked : 0 });
      audit(req.user, `${mod.name}: ${changed.join(', ') || 'Einstellung geändert'}`, m.name);
      return res.json({ ok: true, ...memberState(id) });
    }
    if (b.away !== undefined && b.grant === undefined) {   // Ausnahme „auch unterwegs“ (nur sinnvoll für Bereiche, die sonst nur im WLAN gelten)
      const cur = access.get(id, b.module);
      if (!mod.open && !cur) return bad(res, 'Zuerst den Bereich freischalten.');
      if (b.away) access.set(id, b.module, { away: 1, blocked: cur ? cur.blocked : 0 });
      else if (mod.open && cur && !cur.blocked && !hasFlags(cur)) access.remove(id, b.module); else access.set(id, b.module, { away: 0 });
      audit(req.user, `${mod.name}: ${b.away ? 'auch von unterwegs nutzbar' : 'nur noch im Vereins-WLAN'}`, m.name);
      return res.json({ ok: true, ...memberState(id) });
    }
    if (mod.open && (b.grant === false || b.grant === true)) {
      // Bereich „für alle“: Haken weg = für dieses Mitglied abgeschaltet, Haken dran = wieder wie alle (eine Ausnahme „unterwegs“ bleibt erhalten)
      if (b.grant) { const cur = access.get(id, b.module); if (cur && (cur.away || hasFlags(cur))) access.set(id, b.module, { blocked: 0 }); else access.remove(id, b.module); } else access.set(id, b.module, { blocked: 1 });
      audit(req.user, `${mod.name}: ${b.grant ? 'in der App freigeschaltet' : 'in der App abgeschaltet'}`, m.name);
      return res.json({ ok: true, reinvite: false, ...memberState(id) });
    }
    if (b.grant === false) {
      access.remove(id, b.module);
      audit(req.user, `${mod.name}: Freischaltung entzogen`, m.name);
      return res.json({ ok: true });
    }
    const fields = {};
    if (b.valid_until !== undefined) { if (b.valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(b.valid_until)) return bad(res, 'Ungültiges Datum.'); fields.valid_until = b.valid_until || null; }
    if (b.blocked !== undefined) fields.blocked = b.blocked ? 1 : 0;
    const opts = mod.hooks.accessOptions ? mod.hooks.accessOptions() : null;
    if (b.profile !== undefined) {
      if (opts && opts.profiles && !opts.profiles.some(p => p.id === b.profile)) return bad(res, 'Unbekanntes Profil.');
      fields.profile = b.profile;
    }
    const isNew = !access.get(id, b.module);
    if (isNew && fields.profile === undefined && opts && opts.defaultProfile) fields.profile = opts.defaultProfile;
    // Handy/Einladung wurde von jemandem erzeugt, der diesen Bereich nicht verwalten darf → entkoppeln, neuer QR-Code nötig
    let reinvite = false;
    if (isNew && mod.perm && !invites.issuerCovers(SCOPE, id, mod.perm)) {
      invites.revoke(SCOPE, id); reinvite = true;
      audit(req.user, 'Mitglieder-App: Handy entkoppelt (neuer Bereich, Einladung von Admin ohne dieses Recht)', m.name);
    }
    access.set(id, b.module, fields);
    audit(req.user, `${mod.name}: ${isNew ? 'freigeschaltet' : 'Freischaltung geändert'}`, m.name);
    res.json({ ok: true, reinvite, ...memberState(id) });
  });
  admin.put('/settings/app', need('konten', 'einstellungen'), (req, res) => {
    const b = req.body || {};
    // Adresse im QR-Code und Sicherheitseinstellungen nur mit „Einstellungen“ – sonst könnte jemand mit „Mitglieder“
    // alle späteren QR-Codes auf eine fremde Seite umleiten und Einladungen abgreifen
    if ((b.url !== undefined || b.inviteHours !== undefined || b.allowLink !== undefined || b.mailTo !== undefined) && !req.user.perms.includes('einstellungen'))
      return bad(res, 'Adresse und Sicherheit der Mitglieder-App darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
    if (b.url !== undefined) { const u = String(b.url || '').trim().replace(/\/+$/, ''); if (u && !/^https?:\/\/[A-Za-z0-9.\-[\]:]+$/.test(u)) return bad(res, 'Bitte eine Adresse wie http://homeassistant.local:5001 eintragen.'); setSetting('app_url', u); }
    if ((b.tunnel !== undefined || b.tunnelUrl !== undefined) && !req.user.perms.includes('einstellungen')) return bad(res, 'Den externen Zugang darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
    if (b.tunnelUrl !== undefined) {
      const u = String(b.tunnelUrl || '').trim().replace(/\/+$/, '');
      if (u && !/^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(u)) return bad(res, 'Bitte die öffentliche Adresse wie https://app.meinverein.de eintragen (mit https, ohne Port).');
      setSetting('ext_tunnel_url', u.toLowerCase());
    }
    if (b.tunnel !== undefined) {
      if (b.tunnel && !tunnelUrl()) return bad(res, 'Bitte zuerst die öffentliche Adresse eintragen.');
      setSetting('ext_tunnel', b.tunnel ? '1' : '0');
      audit(req.user, b.tunnel ? 'Mitglieder-App: externer Zugang eingeschaltet' : 'Mitglieder-App: externer Zugang ausgeschaltet', tunnelUrl());
    }
    require('./security').resetHostCache();
    if (b.name !== undefined) setSetting('app_name', String(b.name || '').trim().slice(0, 20) || 'Verein');
    if (b.extModules !== undefined) {
      if (!req.user.perms.includes('einstellungen')) return bad(res, 'Was von unterwegs nutzbar ist, darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
      const cur = extCfg(), next = { ...cur };
      for (const [k, v] of Object.entries(b.extModules && typeof b.extModules === 'object' ? b.extModules : {})) if (modules.has(k)) next[k] = Boolean(v);
      setSetting('app_ext_modules', JSON.stringify(next));
      audit(req.user, 'Mitglieder-App: von unterwegs nutzbar', activeModules().map(([k, m]) => `${m.label || m.name}: ${extAllowed(k) ? 'ja' : 'nein'}`).join(', '));
    }
    if (b.moduleOrder !== undefined) {   // Reihenfolge der Bereiche in der App
      if (!req.user.perms.includes('einstellungen')) return bad(res, 'Die Reihenfolge der Bereiche darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
      const order = [...new Set((Array.isArray(b.moduleOrder) ? b.moduleOrder : []).map(String).filter(k => modules.has(k)))].slice(0, 40);
      setSetting('app_module_order', JSON.stringify(order));
      audit(req.user, 'Mitglieder-App: Reihenfolge der Bereiche geändert', activeModules().map(([, m]) => m.label || m.name).join(', '));
    }
    if (b.inviteHours !== undefined) { const h = parseInt(b.inviteHours, 10); if (!invites.INVITE_HOURS.includes(h)) return bad(res, 'Ungültige Gültigkeit.'); setSetting('app_invite_hours', String(h)); }
    if (b.allowLink !== undefined) setSetting('app_invite_link', b.allowLink ? '1' : '0');
    if (b.mailTo !== undefined) { const t = String(b.mailTo || '').trim(); if (t && !require('./mail').mailOk(t)) return bad(res, 'Bitte eine gültige E-Mail-Adresse eintragen (mehrere mit Komma).'); setSetting('security_mail_to', t); }
    if (b.inviteHours !== undefined || b.allowLink !== undefined || b.mailTo !== undefined) audit(req.user, 'Mitglieder-App: Sicherheit geändert', `QR ${getSetting('app_invite_hours', '24')} Std., Link ${getSetting('app_invite_link', '0') === '1' ? 'erlaubt' : 'aus'}`);
    res.json({ ok: true });
  });
  /* Externer Zugang prüfen: die öffentliche Adresse von hier aus aufrufen */
  admin.post('/app/tunnel-check', need('einstellungen'), async (req, res) => {
    const u = tunnelUrl(); if (!u) return bad(res, 'Noch keine öffentliche Adresse eingetragen.');
    try {
      const r = await fetch(u + '/api/ping', { signal: AbortSignal.timeout(8000), redirect: 'manual' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.app === 'clubwerk') return res.json({ ok: true, tunnel: Boolean(d.tunnel), on: tunnelOn(), cf: Boolean(r.headers.get('cf-ray')) });
      // 403 bei eingeschaltetem Zugang: Die Anfrage kam an, wurde aber abgelehnt – meist, weil das Cloudflared-Add-on von einer unerwarteten Adresse kommt
      const rj = lastTunnelReject && Date.now() - Date.parse(lastTunnelReject.at) < 60000 ? lastTunnelReject : null;
      const src = rj && rj.why === 'quelle' ? `Die Anfrage kam von der Adresse ${rj.ip}, der Clubwerk nicht traut – kommt sie vom Cloudflared-Add-on, diese Adresse in der Add-on-Konfiguration von Clubwerk unter „proxy_addon_ip“ eintragen.` : '';
      res.json({ ok: false, error: r.status === 403 ? (tunnelOn() ? ['Erreicht, aber die Anfrage wurde abgelehnt.', src].filter(Boolean).join(' ') : 'Erreicht, aber der externe Zugang ist hier noch ausgeschaltet.') : `Die Adresse antwortet, aber nicht mit der Mitglieder-App (HTTP ${r.status}). Zeigt der Tunnel auf den Port der Mitglieder-App?`, lastReject: rj });
    } catch (e) { res.json({ ok: false, error: 'Keine Antwort von außen – Tunnel läuft nicht oder der Name ist bei Cloudflare noch nicht eingerichtet.' }); }
  });
  admin.post('/qr', async (req, res) => {
    const u = String((req.body || {}).url || '');
    if (!/^https?:\/\/[^\s]+$/.test(u) || u.length > 500) return bad(res, 'Ungültige Adresse.');
    res.json({ svg: await invites.qrSvg(u) });
  });
  void auth;
}

module.exports = { register, registerPublic, accessFor, access, startPort, adminRoutes, SCOPE, memberState, moduleInfo, activeModules, fromTunnel, awayReq, PRIVATE_IP };
