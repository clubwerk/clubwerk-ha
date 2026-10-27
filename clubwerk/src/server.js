'use strict';
require('./logtime');   // Zeitstempel im Protokoll
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const backup = require('./backup');
const restoredMsg = backup.applyPendingRestore();   // muss vor dem Öffnen der Datenbank laufen
const demo = require('./demo');
const demoMsg = demo.applyPending(backup.DATA_DIR, backup.DB_FILE);   // Demo einrichten bzw. restlos löschen – ebenfalls vor dem Öffnen
const { db, isPerson, splitPersonName, nameKey, lastFirst, customArticleId, DB_FILE, DATA_DIR, getSetting, setSetting, stockList, lastSettlement, audit, auditDiff, memberRefs, rewireMemberRef } = require('./db');
const util = require('./util');
const { euro } = util;   // Beträge überall gleich: „12,50 €“
const { today, nowTs, isDate, addDays, deD } = util;
const artIcons = require('./articleicons');
const { securityAlert } = require('./security');
/* v2.9: vorhandenen Artikeln einmalig ein passendes Symbol geben (danach frei änderbar) */
if (!getSetting('art_icons_v1')) {
  const upd = db.prepare('UPDATE articles SET icon = ? WHERE id = ?');
  db.transaction(() => { for (const a of db.prepare('SELECT id, name, category FROM articles WHERE custom = 0 AND icon IS NULL').all()) { const k = artIcons.guess(a.name, a.category); if (k) upd.run(k, a.id); } })();
  setSetting('art_icons_v1', '1');
}
const mail = require('./mail');
const modules = require('./modules');
const auth = require('./auth');
const plugins = require('./plugins');
const invoices = require('./invoices');
const dropbox = require('./dropbox');
const fullbackup = require('./fullbackup');
const targets = require('./targets');
const selfupdate = require('./selfupdate');
const APP_VERSION = require('../package.json').version;
const { buildWorkbook } = require('./export');
const { seedIfEmpty } = require('./seed');

const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || '0.0.0.0';
const tls = require('./tls');
// Innerer HTTP-Port: Seitenleiste von Home Assistant (INGRESS_PORT) bzw. bei HTTPS für interne Abrufe
if (process.env.INGRESS_PORT) process.env.INTERNAL_PORT = process.env.INGRESS_PORT;
else if (tls.enabled() && !process.env.INTERNAL_PORT) process.env.INTERNAL_PORT = String(PORT + 99);
const UNDO_WINDOW_MIN = 2;

seedIfEmpty();

/* Notfall: Passwort des Adminkontos vergessen → in Home Assistant unter Add-on → Konfiguration
   „notfall_passwort“ setzen und neu starten. Nur wer Home-Assistant-Admin ist, kommt dorthin. */
(function emergencyPassword() {
  const pw = process.env.EMERGENCY_PW || '';
  if (!pw) return;
  if (pw.length < 8 || pw.length > 200) { console.error('Notfall-Passwort ignoriert: 8 bis 200 Zeichen nötig.'); return; }
  const authM = require('./auth');
  let u = db.prepare('SELECT * FROM admin_users WHERE builtin = 1').get();
  if (!u) { authM.createUser({ username: 'admin', name: 'Adminkonto', password: pw, role: 'oberadmin', builtin: true }); u = { username: 'admin' }; }
  else { db.prepare('UPDATE admin_users SET active = 1 WHERE id = ?').run(u.id); authM.setPassword(u.id, pw); }
  audit('system', 'Notfall-Passwort gesetzt', u.username);
  console.log(`Notfall-Passwort für das Adminkonto „${u.username}“ gesetzt. Bitte die Option „notfall_passwort“ wieder leeren und das Add-on neu starten.`);
})();

const app = express();
app.disable('x-powered-by');
app.use(require('./security').noEncodedBody());   // komprimierte Anfragen nie entpacken
// Nur dem Home-Assistant-Ingress-Proxy (und einem ausdrücklich eingetragenen Proxy-Add-on, Option „proxy_addon_ip“) glauben,
// wer der eigentliche Absender ist. Alle anderen Geräte im WLAN könnten die Kopfzeile X-Forwarded-For fälschen und so die
// Bremse gegen Durchprobieren aushebeln. Das Vertrauen in die Absenderangabe ist NICHT dasselbe wie das Ingress-Vertrauen
// (INGRESS_IPS, nur der Supervisor) – ein Proxy-Add-on reicht Kopfzeilen seiner Clients ungefiltert durch.
const TRUSTED_PROXIES = (process.env.TRUSTED_PROXY || '172.30.32.2').split(',').map(x => x.trim()).filter(Boolean);
app.set('trust proxy', TRUSTED_PROXIES);

/* ---------- Sicherheits-Header ---------- */
/* Verwaltung, Tablet und Beregnung sind nie von außen erreichbar – auch nicht, wenn ein Tunnel versehentlich auf diesen Port zeigt.
   Über den Cloudflare Tunnel wird nur die Mitglieder-App (eigener Port) freigegeben. Diese Sperre steht VOR dem Ingress-Vertrauen
   (hostGuard-Umgehung unten). Ausgenommen bleibt nur echter Ingress – erkannt an der Socket-Adresse des Supervisors, nicht an einer
   Kopfzeile: Ist Home Assistant selbst über Cloudflare erreichbar, reicht der Supervisor die cf-Kopfzeilen des Browsers an das
   Add-on durch, die Seitenleiste muss dann trotzdem funktionieren. */
/* Port 3100 nur aus dem eigenen Netz: eine öffentliche Absenderadresse (Portfreigabe am Router) wird abgewiesen.
   Seitenleiste (Supervisor) und ein eingetragenes Proxy-Add-on kommen aus dem Add-on-Netz und sind damit „eigenes Netz“. */
app.use(require('./security').lanOnly({ label: 'Die Verwaltung und das Tablet', extra: ip => TRUSTED_PROXIES.includes(ip) || INGRESS_IPS.includes(ip) }));
/* Über ein eingetragenes Proxy-Add-on (z. B. NGINX) zählt der echte Absender: kommt er aus dem Internet, wird abgewiesen.
   Die Seitenleiste (Supervisor) bleibt ausgenommen – dort meldet Home Assistant selbst an. */
app.use((req, res, next) => {
  const sock = normIp(req.socket.remoteAddress);
  if (!TRUSTED_PROXIES.includes(sock) || INGRESS_IPS.includes(sock) || require('./security').lanSource(req.ip)) return next();
  const msg = 'Die Verwaltung und das Tablet sind nur im Vereinsnetz erreichbar.';
  if (req.path.startsWith('/api/')) return res.status(403).json({ error: msg });
  res.status(403).type('text/plain; charset=utf-8').send(msg);
});
app.use(require('./security').noTunnel({ msg: 'Die Verwaltung und die Tablet-Seiten sind von außen nicht erreichbar.', bypass: req => viaIngress(req) }));
app.use(require('./security').hostGuard({ bypass: req => viaIngress(req) }));
app.use(require('./security').hardenHeaders({ frame: 'SAMEORIGIN', camera: 'self' }));
app.use(require('./security').compress());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
    `frame-src 'self'${embedOrigins()}`, "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'",
  ].join('; '));
  next();
});

/* ---------- Sprache (Fehlermeldungen, Exporte, E-Mails in der Sprache der Anfrage) ---------- */
const i18n = require('./i18n');
i18n.init({ db, getSetting, setSetting, pluginDirs: () => plugins.dirs() });
app.use(i18n.middleware);
app.get('/i18n.js', (req, res) => {
  const l = typeof req.query.l === 'string' && req.query.l !== 'auto' ? req.query.l : '';
  res.type('application/javascript').set('Cache-Control', 'no-cache').send(i18n.pageScript(i18n.resolve(l, typeof req.query.b === 'string' ? req.query.b : '')));
});

/* ---------- einfache Bremse gegen Durchprobieren (pro IP oder je frei wählbarem Schlüssel) ----------
   Ein Kontingent je Name (security.budget, begrenzte Größe: viele Absenderadressen füllen den Speicher nicht).
   Routen mit demselben Namen teilen sich das Kontingent. */
const budgets = new Map();
/** Bremse je Schlüssel: keyFn(req) liefert z. B. die Mitglieds-ID oder den Hash des Gerätetokens */
function rateLimitKey(key, max, windowMs, keyFn) {
  if (!budgets.has(key)) budgets.set(key, require('./security').budget({ max, windowMs, size: 20000 }));
  const b = budgets.get(key);
  return (req, res, next) => {
    let who = '?';
    try { who = String(keyFn(req) || '?'); } catch (e) { who = '?'; }
    if (!b.take(who)) return res.status(429).json({ error: 'Zu viele Versuche. Bitte kurz warten.' });
    next();
  };
}
/** Bremse je Absenderadresse (req.ip – hinter dem Ingress-Proxy bzw. Proxy-Add-on die echte Adresse, siehe trust proxy) */
const rateLimit = (key, max, windowMs) => rateLimitKey(key, max, windowMs, req => req.ip || '?');

app.use(express.json({ limit: '1mb' }));

/* Admin-Änderungen nur mit eigenem Kopfzeilen-Feld → fremde Webseiten können nichts im Namen eines Admins auslösen */
app.use('/api/admin', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (req.get('X-Clubwerk') !== '1') return res.status(403).json({ error: 'Anfrage abgelehnt.' });
  next();
});

/* ---------- Vereinsfarbe (Berechnung der Abstufungen und des Kontrasts: src/theme.js) ---------- */
const { clubColor } = require('./db');
const { normIp } = require('./security');
const theme = require('./theme');
/* Darstellung am Tablet (Einstellungen › Tablet): wie das Gerät oder vom Verein festgelegt – hell, dunkel, Hoher Kontrast */
const TABLET_THEMES = ['auto', 'light', 'dark', 'hc'];
const tabletTheme = () => { const t = getSetting('tablet_theme', 'auto'); return TABLET_THEMES.includes(t) ? t : 'auto'; };
const clubColor2 = () => { const c = getSetting('club_color2', ''); return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : ''; };
/* ?vorschau=rrggbb[&vorschau2=rrggbb]: dieselbe Berechnung für eine andere Farbe (Design-Prüfstand) – öffentlich wie theme.css selbst */
app.get('/theme.css', (req, res) => {
  const q = k => (typeof req.query[k] === 'string' && /^[0-9a-f]{6}$/i.test(req.query[k]) ? '#' + req.query[k] : null);
  const pv = q('vorschau');
  res.type('text/css').set('Cache-Control', 'no-cache').send(pv ? theme.themeCss(pv, q('vorschau2') || '') : theme.themeCss(clubColor(), clubColor2()));
});
app.get('/icon.svg', (req, res) => {
  // Vereinslogo als Symbol, sofern es ein SVG ist – sonst das Clubwerk-Symbol in Vereinsfarbe
  const l = logoInfo();
  let svg;
  if (l && l.type === 'svg') svg = l.custom ? Buffer.from(getSetting('club_logo', ''), 'base64').toString('utf8') : fs.readFileSync(DEFAULT_LOGO, 'utf8');
  else svg = fs.readFileSync(path.join(__dirname, '..', 'public', 'icon.svg'), 'utf8').replace(/#1f6b3a/gi, clubColor())
    .replace(/#e8f2ea/gi, theme.vars(clubColor(), '', 'light')['brand-soft']);
  res.type('image/svg+xml').set({ 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" }).send(svg);
});

/* ---------- Vereinslogo (liegt in der Datenbank → steckt in jeder Sicherung) ---------- */
const LOGO_TYPES = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const DEFAULT_LOGO = path.join(__dirname, '..', 'public', 'vereinslogo.svg');
function logoInfo() {
  const type = getSetting('club_logo_type');
  if (type && LOGO_TYPES[type]) return { type, ver: getSetting('club_logo_ver', '1'), custom: true };
  if (fs.existsSync(DEFAULT_LOGO)) return { type: 'svg', ver: 'std', custom: false };
  return null;
}
const logoUrl = () => { const l = logoInfo(); return l ? `vereinslogo?v=${encodeURIComponent(l.ver)}` : null; };
/** Erkennt das Bildformat am Inhalt; SVGs werden auf gefährliche Bestandteile geprüft und bereinigt. */
function checkLogo(buf) {
  if (!buf || !buf.length) return { error: 'Keine Datei empfangen.' };
  if (buf.length > 2 * 1024 * 1024) return { error: 'Das Logo ist zu groß (max. 2 MB).' };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: 'png', data: buf };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'jpg', data: buf };
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { type: 'webp', data: buf };
  let s = buf.toString('utf8').replace(/^﻿/, '');
  if (!/<svg[\s>]/i.test(s)) return { error: 'Bitte ein Logo als SVG, PNG, JPG oder WebP hochladen.' };
  if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(s)) return { error: 'SVG mit eingebetteten Definitionen wird nicht angenommen.' };
  if (/<\s*(script|foreignObject|iframe|embed|object|audio|video|handler|listener)\b/i.test(s)) return { error: 'Das SVG enthält Skripte oder eingebettete Inhalte – bitte eine einfache SVG-Datei verwenden.' };
  // auch versteckte Varianten ablehnen: Zeichen-Codes (&#…), Namensräume (svg:script), Animation von Verweisen
  if (/&#|\bscript\b|<\s*[\w-]+:(script|foreignObject|iframe|embed|object|handler|listener)\b|attributeName\s*=\s*["']?\s*(xlink:)?href/i.test(s)) return { error: 'Das SVG enthält Skripte oder versteckte Inhalte – bitte eine einfache SVG-Datei verwenden (oder PNG).' };
  s = s.replace(/<\?xml[^>]*\?>/gi, '').replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')                       // Ereignis-Attribute
    .replace(/\s(?:xlink:)?href\s*=\s*("|')\s*(?!#|data:image\/(?:png|jpe?g|gif|webp);)[^"']*\1/gi, '') // nur interne Verweise
    .replace(/url\(\s*(['"]?)\s*(?!#)[^)]*\)/gi, 'none')                                  // keine externen CSS-Quellen
    .replace(/@import[^;]*;?/gi, '');
  if (/javascript:/i.test(s)) return { error: 'Das SVG enthält Skripte – bitte eine einfache SVG-Datei verwenden.' };
  return { type: 'svg', data: Buffer.from(s.trim(), 'utf8') };
}
app.get('/vereinslogo', (req, res) => {
  const l = logoInfo();
  if (!l) return res.status(404).end();
  const data = l.custom ? Buffer.from(getSetting('club_logo', ''), 'base64') : fs.readFileSync(DEFAULT_LOGO);
  res.set({ 'Content-Type': LOGO_TYPES[l.type], 'Cache-Control': req.query.v ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:", 'Content-Disposition': 'inline' });
  res.send(data);
});
/* Symbol für Home-Bildschirm/Manifest: aus dem Logo erzeugtes PNG, sonst ein PNG/JPG-Logo, sonst das Standard-Symbol */
/* Symbol neu zeichnen, wenn sich Logo, Vereinsfarbe oder die Gestaltung (ICON_DESIGN) ändern */
const ICON_DESIGN = '2';   // 2: Vereinsfarbe als Hintergrund, Logo groß mit schmalem weißem Rahmen
const iconKey = () => `${getSetting('club_logo_ver', 'std')}:${clubColor()}:${ICON_DESIGN}`;
const iconFresh = () => Boolean(getSetting('club_icon', '')) && getSetting('club_icon_ver', '') === iconKey();
app.get('/vereinsicon.png', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  if (iconFresh()) return res.type('image/png').send(Buffer.from(getSetting('club_icon', ''), 'base64'));
  const l = logoInfo();
  if (l && l.custom && (l.type === 'png' || l.type === 'jpg')) return res.type(LOGO_TYPES[l.type]).send(Buffer.from(getSetting('club_logo', ''), 'base64'));
  res.sendFile(path.join(__dirname, '..', 'public', 'icon-512.png'));
});
/* Tablet-Manifest mit dem Namen des Vereins (Whitelabel: auf dem Tablet erscheint der Verein, nicht das Produkt) */
app.get('/manifest.webmanifest', (req, res) => {
  const club = getSetting('club_name', process.env.CLUB_NAME || 'Verein');
  res.set('Cache-Control', 'no-cache').type('application/manifest+json').send(JSON.stringify({
    name: club, short_name: club.length > 14 ? club.slice(0, 14) : club, start_url: './', scope: './', display: 'fullscreen', orientation: 'landscape',
    background_color: '#f6f5f1', theme_color: clubColor(),
    icons: [{ src: 'vereinsicon.png', sizes: '512x512', type: 'image/png' }, { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }] }));
});
app.get('/api/branding', (req, res) => {
  const l = logoInfo();
  res.json({ clubName: getSetting('club_name', process.env.CLUB_NAME || 'Unser Verein'), color: clubColor(), logo: logoUrl(), tabletTheme: tabletTheme(), demo: isDemo() || undefined, iconNeeded: Boolean(l) && (!iconFresh() || (l.type === 'svg' && getSetting('club_logo_png_ver', '') !== getSetting('club_logo_ver', 'std'))) });
});

/* ---------- Betrieb ohne Tablet (Einstellungen › Tablet › „Tablet im Vereinsheim“) ----------
   Ohne Tablet gibt es keine Tablet-Seiten: Sie führen zur Anmeldung der Verwaltung, die Tablet-Schnittstellen antworten 404.
   Fehlt die Einstellung (ältere Installation), läuft das Tablet wie bisher. Ein angemeldeter Benutzer der Verwaltung darf die
   Tablet-Schnittstellen weiter abrufen (Artikel- und Profilbilder in der Verwaltung) – er hat ohnehin mehr Rechte. */
const tabletOn = () => getSetting('tablet_enabled', '1') !== '0';
const isDemo = () => getSetting('demo_mode', '') === '1';
const TABLET_OFF = 'Das Tablet ist ausgeschaltet. Einschalten unter Verwaltung › Einstellungen › Tablet.';
const TABLET_PAGES = /^(|\/(index|verkauf|start|verwaltung|link)(\.html)?|\/x\/[a-z0-9-]+(\/[\w.-]+\.html)?)$/;
const isTabletPage = n => TABLET_PAGES.test(n) || (/^\/[a-z0-9-]+(\/index\.html)?$/.test(n) && plugins.tabletSlugs().has(n.split('/')[1]));
app.use((req, res, next) => {
  if (tabletOn()) return next();
  const n = normPath(req.path);
  if (/^\/api\/(tablet|gate)(\/|$)/.test(n)) return auth.currentUser(req) && n.startsWith('/api/tablet/') ? next() : res.status(404).json({ error: TABLET_OFF, tabletOff: true });
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !isTabletPage(n)) return next();
  res.setHeader('Cache-Control', 'no-cache');
  res.redirect(302, '../'.repeat(Math.max(0, req.path.replace(/\/{2,}/g, '/').split('/').length - 2)) + 'admin.html');   // relativ – funktioniert auch in der Seitenleiste von Home Assistant
});

/* Startseite: der eingestellte Start-Reiter (Einstellungen → Leiste am Tablet) erscheint direkt unter „/“ – ohne Umweg über eine andere Adresse */
app.get(['/', '/index.html'], (req, res, next) => {
  const st = tabletStart();
  if (st && st.id === 'getraenke') return next();
  const page = st && !st.url ? plugins.tabletPage(st.id, `x/${st.id}/`) : null;
  if (page) { res.setHeader('Cache-Control', 'no-cache'); return res.type('html').send(page); }
  if (st && st.href) return res.redirect(302, st.href);
  if (plugins.isActive('getraenke')) return next();
  res.redirect(302, 'start.html');
});
// Verkauf auch unter /verkauf (ohne Schrägstrich am Ende, damit alle relativen Adressen gleich bleiben)
app.get('/verkauf', (req, res, next) => {
  if (!plugins.isActive('getraenke')) return next();
  res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.get('/verkauf/', (req, res) => res.redirect(302, '../verkauf'));

app.use('/app', (req, res) => res.status(404).end());   // Mitglieder-App nur über ihren eigenen Port
// Seiten der Erweiterungen binden die gemeinsamen Stile relativ ein („style.css“) – am Tablet liegen sie zwei Ebenen höher
app.get(/^\/x\/[a-z0-9-]+\/(style|kit|theme)\.css$/, (req, res) => res.redirect(302, '../../' + req.path.split('/').pop()));
app.use(express.static(path.join(__dirname, '..', 'public'), {
  extensions: ['html'],
  setHeaders: (res, file) => {
    if (/\.(html|js|css|webmanifest)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');            // immer kurz nachfragen (ETag → 304), damit Updates sofort greifen
    else if (/\.(woff2?|png|svg|ico)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=604800');   // Schriften/Icons ändern sich praktisch nie: eine Woche
  },
}));

/* ---------- Hilfen ---------- */
/* Verlauf, der beim Löschen eines Kontos erhalten bleibt (Konto wird nur ausgeblendet): diese Kern-Tabellen behandelt der
   Aufrufer selbst (Buchungen bleiben bzw. wandern, Veranstaltungslisten werden zu freien Namen) */
const KEEP_HISTORY = new Set(['bookings', 'member_settlements', 'guest_tabs', 'event_guests']);
/**
 * Alles, was außer dem Mitgliedsdatensatz selbst auf ein Mitglied verweist, umhängen (intoId) oder entfernen (intoId = null):
 *  1. Module zuerst (Hook memberRemoved(fromId, intoId|null), synchron) – sie räumen auf, was keinen Fremdschlüssel hat (Verlauf,
 *     Dokument-Dateien, JSON-Listen) und schreiben ihre eigenen Protokolle.
 *  2. Freischaltungen und gekoppelte Handys der Mitglieder-App erlöschen immer (das Zielkonto wird neu freigeschaltet).
 *  3. Alle übrigen Spalten mit REFERENCES members(id) – auch in Modultabellen – generisch: UPDATE bzw. DELETE; läuft das
 *     Umhängen auf einen UNIQUE/PRIMARY KEY (Zielkonto hat dort schon eine Zeile), fällt die alte Zeile weg.
 * Muss in der Transaktion des Aufrufers laufen. Wirft bei Fehlern (der Aufrufer meldet verständlich mit 400).
 */
function dropMemberExtras(fromId, intoId = null) {
  for (const p of plugins.withHook('memberRemoved')) {
    try { p.hooks.memberRemoved(fromId, intoId); }
    catch (e) { throw new Error(`Modul „${p.meta.name}“: ${e.message}`); }
  }
  db.prepare('DELETE FROM member_devices WHERE member_id = ?').run(fromId);
  db.prepare('DELETE FROM member_access WHERE member_id = ?').run(fromId);
  // Verweise ohne Fremdschlüssel im Kern: Benutzer-Verknüpfung, Empfänger gesendeter Mails
  const linked = intoId && db.prepare('SELECT 1 FROM admin_users WHERE member_id = ?').get(intoId);
  db.prepare('UPDATE admin_users SET member_id = ? WHERE member_id = ?').run(intoId && !linked ? intoId : null, fromId);
  try { db.prepare('UPDATE mail_recipient SET member_id = ? WHERE member_id = ?').run(intoId, fromId); } catch (e) { /* Tabelle gibt es erst nach dem Start des Mailers */ }
  const keep = intoId == null ? keepHistory() : null;
  for (const { table, column } of memberRefs()) {
    if (keep && keep.has(table)) continue;
    rewireMemberRef(table, column, fromId, intoId);
  }
}
/** Tabellen, deren Zeilen beim Löschen als Verlauf bleiben: Kern + Module (Hook historyTables, z. B. bezahlte Forderungen) */
const keepHistory = () => new Set([...KEEP_HISTORY, ...plugins.withHook('historyTables').flatMap(p => { try { return p.hooks.historyTables() || []; } catch (e) { return []; } })]);
/** Nach dem Aufräumen (dropMemberExtras): Bleibt Verlauf übrig, wird das Konto nur als gelöscht markiert (Namen bleiben lesbar), sonst ganz entfernt. → true = markiert */
function removeMemberRow(id) {
  const keep = keepHistory();
  const kept = memberRefs().some(({ table, column }) => keep.has(table) && db.prepare(`SELECT 1 FROM "${table}" WHERE "${column}" = ? LIMIT 1`).get(id));
  if (kept) db.prepare('UPDATE members SET deleted = 1, active = 0, pending = 0, pin_hash = NULL WHERE id = ?').run(id);
  else db.prepare('DELETE FROM members WHERE id = ?').run(id);
  return kept;
}
/** Wodurch hängt ein Mitglied noch im Verein? Lesbare Gründe, leer = darf gelöscht werden. Jedes Modul prüft seine Daten (Hook memberLinks);
 *  Vergangenes (alte Buchungen, Abrechnungen, bezahlte Forderungen) zählt nicht – es bleibt mit dem Namen als Verlauf stehen. */
function memberLinks(id) {
  const out = [];
  const open = memberBalance(id).cents, ev = eventOpen(id);
  if (open) out.push(`Offener Betrag im Verkauf: ${euro(open)}`);
  if (ev) out.push(`Offen auf einer Veranstaltungsliste: ${euro(ev)}`);
  const u = db.prepare('SELECT username FROM admin_users WHERE member_id = ?').get(id);
  if (u) out.push(`Verbunden mit dem Benutzer „${u.username}“ der Verwaltung`);
  return [...out, ...moduleLinks(id)];
}
/** nur die Verknüpfungen in Modulen (Beiträge, Mannschaften, Buchungen …) – ohne offene Beträge im Verkauf */
function moduleLinks(id) {
  const out = [];
  for (const p of plugins.withHook('memberLinks')) {
    try { for (const t of p.hooks.memberLinks(id) || []) out.push(`${t} (${p.meta.name})`); }
    catch (e) { out.push(`${p.meta.name}: Prüfung fehlgeschlagen (${e.message})`); }
  }
  return out;
}
/* Mit Mitgliederverwaltung entsteht ein „Mitglied“ nur dort – mit Beitrag und Zahlungsdaten. Verkaufskonten für Personen ohne
   Mitgliedschaft (Trainer u. ä.) heißen „Kein Mitglied“. */
const mvActive = () => plugins.isActive('mitglieder');
const NEED_MV = 'Mitglieder legst du in der Mitgliederverwaltung an (mit Beitrag und Zahlungsdaten). Für Trainer oder andere ohne Mitgliedschaft bitte „Kein Mitglied“ wählen.';
/** Zusammenführen/Löschen in einer Transaktion; Datenbankfehler (z. B. Fremdschlüssel eines Moduls) werden zur verständlichen Meldung */
function memberTx(fn) {
  try { db.transaction(fn)(); return null; }
  catch (e) {
    console.error('Mitglied entfernen/zusammenführen:', e);
    return /FOREIGN KEY/.test(e.message) ? 'Ein Modul verweist noch auf dieses Konto – das Konto kann nicht entfernt werden. Bitte das Modul aktualisieren oder die Daten dort zuerst entfernen.' : e.message;
  }
}
const int = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const asyncRoute = fn => (req, res) => Promise.resolve(fn(req, res)).catch(err => {
  console.error(err);
  bad(res, 'Interner Fehler – bitte im Add-on-Protokoll nachsehen.', 500);
});
/** Namen: Leerzeichen glätten, keine Steuerzeichen, kein =,+,-,@ am Anfang (Schutz für Excel). */
const cleanName = (v, max = 80) => String(v || '').replace(/[\u0000-\u001f<>{}]/g, '').replace(/\s+/g, ' ').trim()
  .replace(/^[=+\-@]+/, '').slice(0, max);

function defaultRange(q) {
  const last = lastSettlement();
  let from = isDate(q.from) ? q.from : null;
  if (!from) from = last ? addDays(last, 1) : '2000-01-01';   // Tag nach der letzten Gesamtabrechnung
  const to = isDate(q.to) ? q.to : today();
  if (!isDate(q.from) && from > to) from = to;     // heute komplett abgerechnet → Auswertung ab heute
  return { from, to };
}

/** Offene Konto-Buchungen (noch nicht als abgerechnet markiert) */
const OPEN_KONTO = `kind = 'konto' AND cancelled_at IS NULL AND settled_id IS NULL`;
function memberBalance(memberId) {
  return db.prepare(`SELECT COALESCE(SUM(total_cents),0) AS cents, COALESCE(SUM(qty),0) AS items
    FROM bookings WHERE member_id = ? AND ${OPEN_KONTO}`).get(memberId);
}
/** Stand einer Liste: Zeitpunkt + höchste Buchungsnummer. Was danach eingetragen (auch rückdatiert nachgetragen)
 *  oder von einer Veranstaltung übernommen wurde, gehört nicht dazu. */
const maxBookingId = () => db.prepare('SELECT COALESCE(MAX(id),0) n FROM bookings').get().n;
const CUT = p => `${p}id <= ? AND ${p}created_at <= ? AND (${p}transferred_at IS NULL OR ${p}transferred_at <= ?)`;
const isTs = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v);

function validPin(pin) {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin);
}

/* =====================================================================
   Tablet
   ===================================================================== */
/* „Ich bin öfter hier“: Anzahl und Zeitraum stellt ein Admin mit allen Rechten ein */
const topN = () => Math.max(0, Math.min(60, int(getSetting('top_n', '15'), 15)));
const topDays = () => Math.max(1, Math.min(365, int(getSetting('top_days', '30'), 30)));

function activeEvent(withGuests = false) {
  const ev = db.prepare('SELECT id, name, date FROM events WHERE active = 1 AND closed_at IS NULL LIMIT 1').get();
  if (!ev) return null;
  ev.articles = db.prepare(`SELECT a.id, a.name, a.category, ea.price_cents, a.icon, a.image
    FROM event_articles ea JOIN articles a ON a.id = ea.article_id
    WHERE ea.event_id = ? AND a.custom = 0 ORDER BY cat_rank(a.category), de_key(a.category), de_key(a.name)`).all(ev.id);
  if (withGuests) {
    // Für die Namensliste am Tablet: keine Beträge, nur ob jemand schon alles bezahlt hat
    ev.guests = db.prepare(`SELECT g.id, g.name, g.member_id AS memberId, m.kind, m.pin_hash IS NOT NULL AS hasPin,
        (SELECT COUNT(*) FROM bookings b WHERE b.event_guest_id = g.id AND b.cancelled_at IS NULL) AS n,
        (SELECT COUNT(*) FROM bookings b WHERE b.event_guest_id = g.id AND b.cancelled_at IS NULL AND b.kind = 'event'
           AND b.payment_id IS NULL AND b.transferred_at IS NULL) AS openN
      FROM event_guests g LEFT JOIN members m ON m.id = g.member_id
      WHERE g.event_id = ? ORDER BY name_key(g.name, 'mitglied')`).all(ev.id)
      .map(g => ({ id: g.id, name: g.name, memberId: g.memberId, kind: g.kind, paid: g.n > 0 && g.openN === 0, open_cents: guestOpen(g.id) }));
  }
  return ev;
}

/** Offene (noch nicht bezahlte, nicht übernommene) Buchungen eines Namens auf der Veranstaltungsliste */
const OPEN_GUEST = `kind = 'event' AND cancelled_at IS NULL AND payment_id IS NULL AND transferred_at IS NULL`;
function guestOpen(guestId) {
  return db.prepare(`SELECT COALESCE(SUM(total_cents),0) AS cents FROM bookings WHERE event_guest_id = ? AND ${OPEN_GUEST}`).get(guestId).cents;
}
/** Namen auf die Liste der laufenden Veranstaltung setzen (oder vorhandenen Eintrag zurückgeben). */
function addGuest(ev, { memberId, name }, by) {
  if (memberId) {
    const m = db.prepare("SELECT * FROM members WHERE id = ? AND active = 1").get(int(memberId));
    if (!m) throw new Error('Mitglied nicht gefunden.');
    if (!['mitglied', 'nichtmitglied', 'mannschaft'].includes(m.kind)) throw new Error('Dieses Konto kann nicht auf die Liste.');
    const g = db.prepare('SELECT * FROM event_guests WHERE event_id = ? AND member_id = ?').get(ev.id, m.id);
    if (g) return g;
    const id = Number(db.prepare('INSERT INTO event_guests(event_id, name, member_id, created_by) VALUES (?,?,?,?)').run(ev.id, m.name, m.id, by).lastInsertRowid);
    return db.prepare('SELECT * FROM event_guests WHERE id = ?').get(id);
  }
  const n = cleanName(name, 60);
  if (n.length < 2) throw new Error('Bitte einen Namen eingeben.');
  const g = db.prepare('SELECT * FROM event_guests WHERE event_id = ? AND lower(name) = lower(?)').get(ev.id, n);
  if (g) return g;
  // Genau ein aktives Mitglied mit diesem Namen → gleich verknüpfen
  const m = db.prepare("SELECT * FROM members WHERE lower(name) = lower(?) AND active = 1 AND kind IN ('mitglied','nichtmitglied','mannschaft')").all(n);
  if (m.length === 1) return addGuest(ev, { memberId: m[0].id }, by);
  if (db.prepare('SELECT COUNT(*) n FROM event_guests WHERE event_id = ?').get(ev.id).n >= 500) throw new Error('Die Liste ist voll.');
  const id = Number(db.prepare('INSERT INTO event_guests(event_id, name, created_by) VALUES (?,?,?)').run(ev.id, n, by).lastInsertRowid);
  return db.prepare('SELECT * FROM event_guests WHERE id = ?').get(id);
}
function guestResponse(g, ev) {
  const r = { token: auth.issueTabletToken('guest:' + g.id), guest: { id: g.id, name: g.name, memberId: g.member_id },
    event: { id: ev.id, name: ev.name }, private: true, open_cents: guestOpen(g.id) };
  return r;
}

/** „Ich bin öfter hier“: die topN() Mitglieder mit den meisten Buchungen in den letzten topDays() Tagen (Standard 15 aus 30 Tagen). */
function topMembers() {
  return db.prepare(`SELECT b.member_id AS id, SUM(b.qty) AS n
    FROM bookings b JOIN members m ON m.id = b.member_id
    WHERE b.cancelled_at IS NULL AND m.kind IN ('mitglied','nichtmitglied') AND m.active = 1
      AND b.kind IN ('konto','event') AND date(b.created_at) >= date('now','localtime', ?)
    GROUP BY b.member_id ORDER BY n DESC LIMIT ?`).all(`-${topDays()} days`, topN()).map(r => r.id);
}

function eventOpen(memberId) {
  return db.prepare(`SELECT COALESCE(SUM(total_cents),0) AS cents FROM bookings
    WHERE member_id = ? AND event_guest_id IS NOT NULL AND ${OPEN_GUEST}`).get(memberId).cents;
}

/* ---------- Optional: Buchungsseite mit Masterpasswort schützen ----------
   Ist ein Passwort gesetzt, braucht jedes Gerät einmal das Passwort und bekommt dann ein langlebiges Cookie.
   Passwort ändern oder „alle Geräte abmelden“ macht alle bisherigen Freigaben ungültig.
   Ohne Passwort durch: angemeldete Admins am selben Gerät und Aufrufe über die Home-Assistant-Seitenleiste (Ingress). */
const GATE_COOKIE = 'gtablet';
const GATE_MAX_AGE = 400 * 24 * 3600;      // Höchstwert, den Browser für Cookies erlauben
/* Ingress = Seitenleiste von Home Assistant: Anfragen kommen vom Supervisor (172.30.32.2), der die Kopfzeile X-Ingress-Path
   selbst setzt. Nur diese Adresse – ausdrücklich NICHT die Liste der vertrauten Proxys (TRUSTED_PROXY), denn ein Proxy-Add-on
   (Cloudflared, NGINX) reicht X-Ingress-Path seiner Clients ungefiltert durch. Ingress bedeutet im Code HA-Admin-Vertrauen
   (hostGuard, Tablet-Passwort, Ersteinrichtung ohne Code, Login ohne Kontosperre, Update-Upload). */
const INGRESS_IPS = ['172.30.32.2'];
const gateOn = () => Boolean(getSetting('tablet_pw_hash'));
function gateSecret() {
  let k = getSetting('tablet_gate_secret');
  if (!k) { k = crypto.randomBytes(32).toString('hex'); setSetting('tablet_gate_secret', k); }
  return k;
}
const gateVer = () => getSetting('tablet_pw_ver', '1');
const gateSig = ver => crypto.createHmac('sha256', gateSecret()).update('buchungsseite:' + ver).digest('hex');
const viaIngress = req => Boolean(req.get('X-Ingress-Path')) && INGRESS_IPS.includes(normIp(req.socket.remoteAddress));
function gateCookieOk(req) {
  const [ver, sig] = String(auth.parseCookies(req)[GATE_COOKIE] || '').split('.');
  if (!ver || !sig || ver !== gateVer()) return false;
  const a = Buffer.from(sig, 'hex'), b = Buffer.from(gateSig(ver), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/* Das Tablet-Passwort ist Pflicht (Schutz der Mitgliederdaten): Solange keins vergeben ist, bleibt die Buchungsseite für normale
   Geräte gesperrt – nur angemeldete Admins und die Home-Assistant-Seitenleiste kommen herein. (Tests: CW_TEST_TABLET_OPEN=1) */
const gateOpenForTests = () => process.env.CW_TEST_TABLET_OPEN === '1' && !gateOn();
const GATE_UNSET = 'Für das Tablet ist noch kein Passwort vergeben. Bitte in der Verwaltung unter Einstellungen › Tablet › „Passwort für das Tablet“ eins festlegen.';
function tabletPwError(pw) {
  if (pw.length < 8 || pw.length > 200) return 'Das Passwort für das Tablet braucht mindestens 8 Zeichen.';
  if (/^(.)\1+$|^(12345678|123456789|1234567890|87654321|passwort\d*|password\d*|tennis\d*|verein\d*|qwertz\w*|abcdefgh)$/i.test(pw)) return 'Dieses Passwort ist zu leicht zu erraten – bitte ein anderes wählen.';
  return null;
}
const gateOk = req => gateOpenForTests() || (gateOn() && gateCookieOk(req)) || viaIngress(req) || Boolean(auth.currentUser(req));
const gateCookie = req => `${GATE_COOKIE}=${gateVer()}.${gateSig(gateVer())}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${GATE_MAX_AGE}${req.secure ? '; Secure' : ''}`;

app.get('/api/gate', (req, res) => res.json({ on: true, set: gateOn(), ok: gateOk(req) }));
const gateAll = require('./security').limiter({ per: 30, baseMs: 15 * 60000 });   // insgesamt, über alle Geräte
app.post('/api/gate/login', rateLimit('gate', 10, 10 * 60000), (req, res) => {
  if (!gateOn()) return bad(res, GATE_UNSET, 409);
  const wait = gateAll.blocked('all');
  if (wait) return bad(res, `Zu viele falsche Passwörter – bitte in ${wait} Min. erneut versuchen.`, 429);
  const pw = String((req.body || {}).password || '');
  if (!pw || !auth.verifySecret(pw, getSetting('tablet_pw_hash'))) {
    if (gateAll.fail('all').locked) securityAlert('Für die Buchungsseite wurde 30-mal ein falsches Passwort eingegeben. Neue Geräte können sich vorübergehend nicht freischalten; bereits freigeschaltete Tablets funktionieren weiter.', 'gate-all');
    audit(null, 'Buchungsseite: falsches Passwort', req.ip);
    return bad(res, 'Das Passwort stimmt nicht.', 401);
  }
  audit(null, 'Buchungsseite freigeschaltet', `${req.ip} · ${String(req.get('User-Agent') || '').slice(0, 120)}`);
  res.setHeader('Set-Cookie', gateCookie(req));
  res.json({ ok: true });
});
app.use('/api/tablet', (req, res, next) => {
  if (gateOk(req)) return next();
  if (!gateOn()) return res.status(401).json({ error: GATE_UNSET, gate: true, unset: true });
  res.status(401).json({ error: 'Die Buchungsseite ist geschützt – bitte das Passwort eingeben.', gate: true });
});

// Pfad normalisiert prüfen (Groß-/Kleinschreibung, Schrägstrich am Ende) – Express nimmt beide Schreibweisen an
const normPath = p => String(p || '').toLowerCase().replace(/\/+$/, '').replace(/\/{2,}/g, '/');
const DRINK_TABLET = /^\/api\/tablet\/(state|unlock|undo|book|account|pin|member|tab|tab\/pay|event\/guest|logout|artikelbild(\/.*)?)$/;
app.use((req, res, next) => (DRINK_TABLET.test(normPath(req.path)) && !plugins.isActive('getraenke')
  ? res.status(404).json({ error: 'Das Modul „Verkauf“ ist ausgeschaltet.' }) : next()));

/* Profilbilder am Tablet – nur wenn das Mitglied sie für diesen Zweck freigegeben hat (verkauf · buchung · helfer) */
app.get('/api/tablet/photo/:id', (req, res) => {
  const u = String(req.query.u || '');
  if (!['verkauf', 'buchung', 'helfer'].includes(u)) return res.status(404).end();
  require('./photos').send(res, int(req.params.id), u);
});
app.get('/api/tablet/artikelbild/:file', (req, res) => {
  const p = artIcons.imagePath(DATA_DIR, req.params.file);
  if (!p) return res.status(404).end();
  res.setHeader('Content-Type', artIcons.mimeOf(req.params.file));
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(p);
});

app.get('/api/tablet/state', (req, res) => {
  const photos = require('./photos');
  // Profilbild-Kennung gleich mitlesen (photos.version nimmt die Zeile) statt je Mitglied eine eigene Abfrage
  const members = db.prepare(`SELECT id, name, kind, pending, pin_hash IS NOT NULL AS hasPin, photo, photo_use
    FROM members WHERE active = 1 AND deleted = 0 AND kind != 'extern' ORDER BY name_key(name, kind)`).all()   // Gastspieler/innen (Spielbetrieb) haben kein Konto
    .map(({ photo, photo_use, ...m }) => ({ ...m, hasPin: Boolean(m.hasPin), pending: Boolean(m.pending), ph: m.kind === 'mitglied' ? photos.version({ photo, photo_use }, 'verkauf') : null }));
  // Module können Konten in der Namensliste ausblenden (z. B. Angehörige, die über den Hauptzahler buchen)
  const hidden = new Set();
  for (const p of plugins.withHook('tabletMembers')) { try { const r = p.hooks.tabletMembers() || {}; (r.hidden || []).forEach(id => hidden.add(id)); } catch (e) { /* Modul-Fehler blendet nichts aus */ } }
  members.forEach(m => { if (hidden.has(m.id)) m.hidden = true; });
  const stock = new Map(stockList().map(s => [s.id, s]));
  const articles = db.prepare('SELECT id, name, category, price_cents, icon, image FROM articles WHERE active = 1 AND custom = 0 ORDER BY cat_rank(category), de_key(category), de_key(name)').all()
    .map(a => {
      const s = stock.get(a.id);
      return { ...a, soldOut: Boolean(s && s.track_stock && s.delivered > 0 && s.stock <= 0) };
    });
  res.json({
    clubName: getSetting('club_name', process.env.CLUB_NAME || 'Unser Verein'),
    members, articles, top: topN() ? topMembers().filter(id => !hidden.has(id)) : [], topDays: topDays(), event: activeEvent(true), color: clubColor(), logo: logoUrl(),
    tabs: openTabs(),
  });
});

/* Datenschutz: Offene Beträge und Buchungsverlauf gibt es am Tablet nur für Konten mit PIN.
   (Ein Token für ein Konto mit PIN wird nur nach richtiger PIN ausgegeben.) */
const privateOk = m => Boolean(m && m.pin_hash);

function unlockResponse(m) {
  const r = {
    token: auth.issueTabletToken(m.id),
    member: { id: m.id, name: m.name, kind: m.kind, hasPin: Boolean(m.pin_hash), pending: Boolean(m.pending) },
    private: privateOk(m),
  };
  if (r.private) { r.balance = memberBalance(m.id); r.eventOpen_cents = eventOpen(m.id); }
  return r;
}

app.post('/api/tablet/unlock', rateLimit('unlock', 40, 60000), (req, res) => {
  const { memberId, eventId, guestId, tabId, pin } = req.body || {};
  if (tabId) {
    const t = db.prepare("SELECT * FROM guest_tabs WHERE id = ? AND status = 'offen'").get(int(tabId));
    if (!t) return bad(res, 'Dieser Deckel ist schon bezahlt oder geschlossen.', 404);
    return res.json(tabResponse(t));
  }
  if (guestId) {
    const ev = activeEvent();
    const g = ev && db.prepare('SELECT * FROM event_guests WHERE id = ? AND event_id = ?').get(int(guestId), ev.id);
    if (!g) return bad(res, 'Dieser Name steht nicht auf der Liste der laufenden Veranstaltung.', 404);
    return res.json(guestResponse(g, ev));             // Thekenbetrieb: keine PIN
  }
  if (eventId) {
    const ev = activeEvent();
    if (!ev || ev.id !== int(eventId)) return bad(res, 'Diese Veranstaltung ist nicht aktiv.');
    return res.json({ token: auth.issueTabletToken('event:' + ev.id), event: { id: ev.id, name: ev.name } });
  }
  const m = db.prepare('SELECT * FROM members WHERE id = ? AND active = 1').get(int(memberId));
  if (!m) return bad(res, 'Konto nicht gefunden.', 404);
  if (m.kind === 'mannschaft' && !m.pin_hash) return bad(res, 'Für dieses Mannschaftskonto ist noch keine PIN vergeben – bitte an den Vorstand wenden.', 403);
  if (m.pin_hash) {
    const err = checkPin(m, pin);
    if (err) return bad(res, err.msg, err.code);
  }
  res.json(unlockResponse(m));
});

/** PIN prüfen inkl. Sperre nach 5 Fehlversuchen. Die Sperre verdoppelt sich bei jeder weiteren Fehlserie
 *  (5 min, 10, 20, 40 … höchstens 24 h) und steht im Protokoll. Gibt null oder { msg, code } zurück. */
function checkPin(m, pin) {
  if (m.locked_until && m.locked_until > new Date().toISOString()) {
    const until = new Date(m.locked_until).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: process.env.TZ || 'Europe/Berlin' });
    return { msg: `Zu viele falsche PINs – gesperrt bis ${until} Uhr. Der Vorstand kann die PIN zurücksetzen.`, code: 429 };
  }
  if (!auth.verifySecret(String(pin || ''), m.pin_hash)) {
    const fails = m.failed_pins + 1;
    if (fails >= 5) {
      const strikes = (m.pin_strikes || 0) + 1;
      const mins = Math.min(5 * 2 ** (strikes - 1), 24 * 60);
      db.prepare('UPDATE members SET failed_pins = 0, pin_strikes = ?, locked_until = ? WHERE id = ?')
        .run(strikes, new Date(Date.now() + mins * 60000).toISOString(), m.id);
      audit('tablet', 'PIN gesperrt', `${m.name}: 5 falsche PINs, Sperre ${mins >= 60 ? Math.round(mins / 60) + ' h' : mins + ' min'}`);
    } else db.prepare('UPDATE members SET failed_pins = ? WHERE id = ?').run(fails, m.id);
    return { msg: 'PIN falsch.', code: 401 };
  }
  if (m.failed_pins || m.pin_strikes || m.locked_until) db.prepare('UPDATE members SET failed_pins = 0, pin_strikes = 0, locked_until = NULL WHERE id = ?').run(m.id);
  return null;
}

/* Veranstaltung: Namen am Tablet auf die Abrechnungsliste setzen (aus der Mitgliederliste oder frei) */
app.post('/api/tablet/event/guest', rateLimit('guest', 40, 10 * 60000), (req, res) => {
  const ev = activeEvent();
  if (!ev) return bad(res, 'Es läuft gerade keine Veranstaltung.');
  const { memberId, name } = req.body || {};
  let g;
  try { g = addGuest(ev, { memberId, name }, 'tablet'); } catch (e) { return bad(res, e.message); }
  res.json(guestResponse(g, ev));
});

/* ---------- Gäste-Deckel ---------- */
const tabOpen = id => db.prepare('SELECT COALESCE(SUM(total_cents),0) c FROM bookings WHERE tab_id = ? AND cancelled_at IS NULL').get(id).c;
function openTabs() {
  return db.prepare(`SELECT t.id, t.name, t.created_at FROM guest_tabs t WHERE t.status = 'offen' ORDER BY t.created_at`).all()
    .map(t => ({ ...t, open_cents: tabOpen(t.id) }));
}
function tabResponse(t) {
  return { token: auth.issueTabletToken('tab:' + t.id), tab: { id: t.id, name: t.name }, open_cents: tabOpen(t.id) };
}
/* Neuen Deckel öffnen – gibt es schon einen offenen mit diesem Namen, wird der genommen */
app.post('/api/tablet/tab', rateLimit('tab', 30, 10 * 60000), (req, res) => {
  if (activeEvent()) return bad(res, 'Während der Veranstaltung bitte die Veranstaltungsliste nutzen.');
  const name = cleanName((req.body || {}).name, 60);
  if (name.length < 2) return bad(res, 'Bitte einen Namen eingeben, z. B. „Gastmannschaft SV Musterdorf“.');
  let t = db.prepare("SELECT * FROM guest_tabs WHERE status = 'offen' AND lower(name) = lower(?)").get(name);
  if (!t) {
    if (db.prepare("SELECT COUNT(*) n FROM guest_tabs WHERE status = 'offen'").get().n >= 60) return bad(res, 'Zu viele offene Deckel. Bitte erst welche bezahlen lassen.');
    const id = Number(db.prepare("INSERT INTO guest_tabs(name, created_by) VALUES (?, 'tablet')").run(name).lastInsertRowid);
    t = db.prepare('SELECT * FROM guest_tabs WHERE id = ?').get(id);
    audit('tablet', 'Gäste-Deckel geöffnet', name);
  }
  res.json(tabResponse(t));
});
/* Bezahlen am Tablet (Thekenpersonal): Deckel komplett bar oder mit Karte */
app.post('/api/tablet/tab/pay', rateLimit('tabpay', 30, 10 * 60000), (req, res) => {
  const { token, method } = req.body || {};
  const who = auth.checkTabletToken(token);
  if (typeof who !== 'string' || !who.startsWith('tab:')) return bad(res, 'Sitzung abgelaufen. Bitte den Deckel erneut wählen.', 401);
  if (!['bar', 'karte'].includes(method)) return bad(res, 'Bitte bar oder Karte wählen.');
  const t = db.prepare("SELECT * FROM guest_tabs WHERE id = ? AND status = 'offen'").get(int(who.slice(4)));
  if (!t) return bad(res, 'Dieser Deckel ist schon geschlossen.');
  const cents = closeTab(t, { status: 'bezahlt', method, by: 'tablet' });
  auth.dropTabletToken(token);
  res.json({ ok: true, cents, method, name: t.name });
});
/** Deckel schließen (bezahlt / übernommen / abgeschrieben). Leere Deckel werden einfach gelöscht. */
function closeTab(t, { status, method = null, by, memberId = null, note = null }) {
  const cents = tabOpen(t.id);
  db.transaction(() => {
    if (!cents && !db.prepare('SELECT 1 FROM bookings WHERE tab_id = ? AND cancelled_at IS NULL').get(t.id)) {
      db.prepare('UPDATE bookings SET tab_id = NULL WHERE tab_id = ?').run(t.id);
      db.prepare('DELETE FROM guest_tabs WHERE id = ?').run(t.id);
      return;
    }
    db.prepare(`UPDATE guest_tabs SET status = ?, method = ?, cents = ?, member_id = ?, note = ?, closed_at = datetime('now','localtime'), closed_by = ? WHERE id = ?`)
      .run(status, method, cents, memberId, note, by, t.id);
    if (status === 'bezahlt') db.prepare('UPDATE bookings SET paid_cash = 1 WHERE tab_id = ? AND cancelled_at IS NULL').run(t.id);
    if (status === 'uebernommen') db.prepare(`UPDATE bookings SET kind = 'konto', member_id = ?, transferred_at = datetime('now','localtime'), transferred_by = ?
      WHERE tab_id = ? AND cancelled_at IS NULL`).run(memberId, by, t.id);
    if (status === 'abgeschrieben') db.prepare("UPDATE bookings SET kind = 'verein', total_cents = 0 WHERE tab_id = ? AND cancelled_at IS NULL").run(t.id);
  })();
  const what = { bezahlt: method === 'karte' ? 'mit Karte bezahlt' : 'bar bezahlt', uebernommen: 'auf Konto übernommen', abgeschrieben: 'abgeschrieben' }[status];
  audit(by, 'Gäste-Deckel ' + what, `${t.name}: ${euro(cents)}${note ? ' – ' + note : ''}`);
  return cents;
}

/* Neu im Verein: jeder darf sich am Tablet anlegen, ein Admin bestätigt später. */
const NEW_MEMBERS_PER_DAY = 15;   // mehr neue Namen je Tag am Tablet nur über den Vorstand (Schutz vor Unsinn-Einträgen)
app.post('/api/tablet/member', rateLimit('member', 5, 10 * 60000), (req, res) => {
  const name = cleanName((req.body || {}).name, 61);
  if (name.length < 5 || name.split(' ').length < 2) return bad(res, 'Bitte Vor- und Nachnamen eingeben.');
  if (name.length > 60 || /[<>{}]/.test(name)) return bad(res, 'Bitte nur den Namen eingeben.');
  const same = db.prepare("SELECT * FROM members WHERE lower(name) = lower(?) AND deleted = 0 AND kind != 'extern'").get(name);
  if (same && same.active) return bad(res, `„${same.name}“ gibt es schon – bitte in der Namensliste suchen.`);
  if (same && !same.active) return bad(res, 'Dieser Name ist gesperrt. Bitte an den Vorstand wenden.');
  const newToday = db.prepare(`SELECT COUNT(*) n FROM members WHERE pending = 1 AND date(created_at) = date('now','localtime')`).get().n;
  if (newToday >= NEW_MEMBERS_PER_DAY) return bad(res, 'Heute wurden schon viele neue Namen angelegt. Bitte an den Vorstand wenden.', 429);
  const id = Number(db.prepare("INSERT INTO members(name, kind, pending) VALUES (?, 'mitglied', 1)").run(name).lastInsertRowid);
  res.json(unlockResponse(db.prepare('SELECT * FROM members WHERE id = ?').get(id)));
});

// Idempotenz beim Tablet-Buchen: Der Client schickt je Warenkorb-Absenden eine zufällige requestId. Kommt dieselbe ID
// desselben Kontos binnen 2 Minuten erneut (Doppeltipp, Wiederholung bei wackeligem WLAN), wird die erste Antwort
// zurückgegeben statt noch einmal zu buchen. Nur im Speicher – nach einem Neustart ist die Liste leer.
const BOOK_REPLAY_MS = 2 * 60000;
const bookReplay = new Map();                                      // "konto|requestId" -> { at, body }
const replayKey = (who, requestId) => {
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) return null;
  const now = Date.now();
  for (const [k, v] of bookReplay) if (now - v.at > BOOK_REPLAY_MS) bookReplay.delete(k);
  return `${who}|${requestId}`;
};

app.post('/api/tablet/book', rateLimit('book', 120, 60000), (req, res) => {
  // „pay“ aus älteren Tablet-Versionen wird weiter angenommen, aber nicht mehr ausgewertet: ob bar oder angeschrieben,
  // ergibt sich allein aus dem Konto (Deckel, Veranstaltungsliste, Mitglied …)
  const { token, items, requestId } = req.body || {};
  const who = auth.checkTabletToken(token);
  if (!who) return bad(res, 'Sitzung abgelaufen. Bitte Namen erneut wählen.', 401);
  const rkey = replayKey(who, requestId);
  if (rkey && bookReplay.has(rkey)) return res.json(bookReplay.get(rkey).body);   // Wiederholung: Erstergebnis, keine neue Buchung
  if (!Array.isArray(items) || !items.length) return bad(res, 'Keine Artikel gewählt.');
  const ev = activeEvent();

  let member = null, guest = null, tab = null, kind, paidCash = null;
  if (typeof who === 'string' && who.startsWith('tab:')) {
    tab = db.prepare("SELECT * FROM guest_tabs WHERE id = ? AND status = 'offen'").get(int(who.slice(4)));
    if (!tab) return bad(res, 'Dieser Deckel ist schon bezahlt oder geschlossen.', 401);
    if (ev) return bad(res, 'Während der Veranstaltung bitte die Veranstaltungsliste nutzen.');
    kind = 'gast'; paidCash = 0;                          // angeschrieben, bezahlt wird am Ende
  } else if (typeof who === 'string' && who.startsWith('event:')) {
    if (!ev || ev.id !== int(who.slice(6))) return bad(res, 'Die Veranstaltung ist beendet.');
    kind = 'event'; paidCash = 1;                         // Barverkauf ohne Namen
  } else if (typeof who === 'string' && who.startsWith('guest:')) {
    guest = db.prepare('SELECT * FROM event_guests WHERE id = ?').get(int(who.slice(6)));
    if (!guest || !ev || guest.event_id !== ev.id) return bad(res, 'Die Veranstaltung ist beendet.', 401);
    kind = 'event'; paidCash = 0;                         // wird auf der Veranstaltungsliste angeschrieben
  } else {
    member = db.prepare('SELECT * FROM members WHERE id = ? AND active = 1').get(who);
    if (!member) return bad(res, 'Konto nicht gefunden.');
    kind = { mitglied: 'konto', nichtmitglied: 'konto', mannschaft: 'konto', verein: 'verein', gast: 'gast' }[member.kind];
    if (ev && (kind === 'verein' || kind === 'gast')) return bad(res, 'Während der Veranstaltung wird nur auf die Veranstaltungsliste gebucht – für Gäste „Barverkauf ohne Namen“.');
    if (ev && kind === 'konto') {                         // während einer Veranstaltung immer auf deren Liste
      guest = addGuest(ev, { memberId: member.id }, 'tablet');
      kind = 'event'; paidCash = 0;
    }
  }

  // Bei laufender Veranstaltung gelten nur deren Getränke und Preise
  const evPrice = ev ? new Map(ev.articles.map(a => [a.id, a.price_cents])) : null;
  const getArticle = db.prepare('SELECT * FROM articles WHERE id = ?');
  const insB = db.prepare(`INSERT INTO bookings(member_id, article_id, event_id, kind, qty, unit_cents, total_cents, paid_cash, event_guest_id, note, tab_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const ins = { run: (...a) => insB.run(...a, tab ? tab.id : null) };
  const created = [];
  const memberId = member ? member.id : (guest ? guest.member_id : null);
  if (items.length > 30) return bad(res, 'Zu viele Positionen.');
  const tx = db.transaction(() => {
    for (const it of items) {
      if (it && it.custom) {                              // frei eingegebener Betrag
        if (!Number.isInteger(Number(it.cents))) throw new Error('Betrag bitte in ganzen Cent angeben.');   // keine Nachkommastellen stillschweigend abschneiden
        const cents = int(it.cents);
        if (cents < 10 || cents > 50000) throw new Error('Betrag bitte zwischen 0,10 € und 500 €.');
        const note = cleanName(it.note, 60) || null;
        const total = kind === 'verein' ? 0 : cents;
        const r = ins.run(memberId, customArticleId(), ev ? ev.id : null, kind, 1, cents, total, paidCash, guest ? guest.id : null, note);
        created.push({ id: Number(r.lastInsertRowid), name: 'Betrag' + (note ? ' (' + note + ')' : ''), qty: 1, total_cents: total, list_cents: cents });
        continue;
      }
      if (!Number.isInteger(Number(it.qty))) throw new Error('Ungültige Menge.');
      const qty = int(it.qty);
      if (qty < 1 || qty > 99) throw new Error('Ungültige Menge.');
      const a = getArticle.get(int(it.articleId));
      if (!a || a.custom) throw new Error('Artikel nicht verfügbar.');
      let price = a.price_cents;
      if (evPrice) {
        if (!evPrice.has(a.id)) throw new Error(`„${a.name}“ gibt es bei dieser Veranstaltung nicht.`);
        price = evPrice.get(a.id);
      } else if (!a.active) throw new Error('Artikel nicht verfügbar.');
      const total = kind === 'verein' ? 0 : price * qty;
      const r = ins.run(memberId, a.id, ev ? ev.id : null, kind, qty, price, total, paidCash, guest ? guest.id : null, null);
      created.push({ id: Number(r.lastInsertRowid), name: a.name, qty, total_cents: total, list_cents: price * qty });
    }
  });
  try { tx(); } catch (e) { return bad(res, e.message); }

  const resp = { bookings: created, kind, paid_cash: paidCash, event: ev ? ev.name : null,
    total_cents: created.reduce((s, b) => s + b.total_cents, 0) };
  if (tab) {
    resp.tab = { id: tab.id, name: tab.name }; resp.open_cents = tabOpen(tab.id);
  } else if (guest) {
    // Veranstaltungsliste ist exklusiv (nur Buchungen dieser Veranstaltung, nie das Getränkekonto) –
    // das Thekenpersonal muss sie für jeden sehen können, auch ohne PIN
    resp.guest = { id: guest.id, name: guest.name }; resp.private = true; resp.open_cents = guestOpen(guest.id);
  } else if (member) {
    resp.private = privateOk(member);
    if (resp.private) {
      resp.balance = memberBalance(member.id);
      resp.eventOpen_cents = eventOpen(member.id);
    }
  }
  if (rkey) bookReplay.set(rkey, { at: Date.now(), body: resp });
  res.json(resp);
});

app.post('/api/tablet/undo', rateLimit('undo', 60, 60000), (req, res) => {
  const { token, bookingIds } = req.body || {};
  const who = auth.checkTabletToken(token);
  if (!who) return bad(res, 'Sitzung abgelaufen. Rückgängig bitte über den Vorstand.', 401);
  if (!Array.isArray(bookingIds) || !bookingIds.length) return bad(res, 'Nichts zum Zurücknehmen.');
  const ids = bookingIds.map(i => int(i));
  const rows = db.prepare(`SELECT * FROM bookings WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  const limit = new Date(Date.now() - UNDO_WINDOW_MIN * 60000);
  for (const b of rows) {
    if (b.kind === 'event') return bad(res, 'Bei Veranstaltungen storniert nur der Vorstand (Verwaltung → Buchungen).', 403);
    const owners = [b.tab_id ? 'tab:' + b.tab_id : null, b.event_guest_id ? 'guest:' + b.event_guest_id : null, b.member_id, b.member_id === null && !b.event_guest_id && !b.tab_id ? 'event:' + b.event_id : null];
    if (!owners.includes(who)) return bad(res, 'Diese Buchung gehört nicht zu diesem Konto.', 403);
    if (b.tab_id && !db.prepare("SELECT 1 FROM guest_tabs WHERE id = ? AND status = 'offen'").get(b.tab_id)) return bad(res, 'Der Deckel ist schon bezahlt.');
    if (b.payment_id || b.transferred_at) return bad(res, 'Schon bezahlt bzw. übernommen – bitte an den Vorstand wenden.');
    // Abgerechnete Buchungen dürfen am Tablet nicht mehr storniert werden – sonst passen Abrechnung und Buchungen
    // nicht mehr zusammen; eine Gutschrift kann nur die Verwaltung erteilen.
    if (b.settled_id) return bad(res, 'Diese Buchung ist bereits abgerechnet – bitte an den Vorstand wenden.');
    if (new Date(b.created_at.replace(' ', 'T')) < limit) {
      return bad(res, `Rückgängig ist nur ${UNDO_WINDOW_MIN} Minuten lang möglich. Bitte an den Vorstand wenden.`);
    }
  }
  // settled_id IS NULL auch hier: schützt gegen eine Abrechnung zwischen Prüfung und UPDATE
  const upd = db.prepare(`UPDATE bookings SET cancelled_at = datetime('now','localtime'), cancelled_by = 'tablet'
    WHERE id = ? AND cancelled_at IS NULL AND settled_id IS NULL`);
  let cancelled = 0;
  db.transaction(() => rows.forEach(b => { cancelled += upd.run(b.id).changes; }))();   // schon stornierte zählen nicht mit
  if (!cancelled && rows.some(b => !b.cancelled_at)) return bad(res, 'Diese Buchung ist bereits abgerechnet – bitte an den Vorstand wenden.');
  res.json({ ok: true, cancelled });
});

app.get('/api/tablet/account', (req, res) => {
  const who = auth.checkTabletToken(req.query.token);
  if (typeof who === 'string' && who.startsWith('tab:')) {
    const t = db.prepare('SELECT * FROM guest_tabs WHERE id = ?').get(int(who.slice(4)));
    if (!t) return bad(res, 'Sitzung abgelaufen.', 401);
    const rows = db.prepare(`SELECT b.created_at, CASE WHEN a.custom = 1 THEN 'Betrag' || COALESCE(' (' || b.note || ')', '') ELSE COALESCE(b.article_name, a.name) END AS name,
        b.qty, b.total_cents, b.kind FROM bookings b JOIN articles a ON a.id = b.article_id
      WHERE b.tab_id = ? AND b.cancelled_at IS NULL ORDER BY b.created_at DESC LIMIT 200`).all(t.id);
    return res.json({ tab: { id: t.id, name: t.name }, rows, open_cents: tabOpen(t.id) });
  }
  if (typeof who === 'string' && who.startsWith('guest:')) {
    const g = db.prepare('SELECT g.*, e.name AS event FROM event_guests g JOIN events e ON e.id = g.event_id WHERE g.id = ?').get(int(who.slice(6)));
    if (!g) return bad(res, 'Sitzung abgelaufen.', 401);
    const rows = db.prepare(`SELECT b.created_at, CASE WHEN a.custom = 1 THEN 'Betrag' || COALESCE(' (' || b.note || ')', '') ELSE COALESCE(b.article_name, a.name) END AS name,
        b.qty, b.total_cents, b.kind, b.payment_id, b.transferred_at, p.method
      FROM bookings b JOIN articles a ON a.id = b.article_id LEFT JOIN event_payments p ON p.id = b.payment_id
      WHERE b.event_guest_id = ? AND b.cancelled_at IS NULL ORDER BY b.created_at DESC LIMIT 200`).all(g.id);
    return res.json({ guest: { id: g.id, name: g.name }, event: g.event, rows, open_cents: guestOpen(g.id) });
  }
  if (!who || typeof who !== 'number') return bad(res, 'Sitzung abgelaufen.', 401);
  if (!privateOk(db.prepare('SELECT pin_hash FROM members WHERE id = ?').get(who))) return bad(res, 'Konto und Verlauf sind nur mit PIN sichtbar.', 403);
  // Offene Konto-Buchungen (seit der letzten Abrechnung dieses Mitglieds) + sonstige der letzten 60 Tage
  const rows = db.prepare(`SELECT b.created_at, CASE WHEN a.custom = 1 THEN 'Betrag' || COALESCE(' (' || b.note || ')', '') ELSE COALESCE(b.article_name, a.name) END AS name,
      b.qty, b.total_cents, b.kind, b.paid_cash, b.transferred_at, e.name AS event
    FROM bookings b JOIN articles a ON a.id = b.article_id LEFT JOIN events e ON e.id = b.event_id
    WHERE b.member_id = ? AND b.cancelled_at IS NULL
      AND ((b.kind = 'konto' AND b.settled_id IS NULL) OR (b.kind <> 'konto' AND date(b.created_at) >= date('now','localtime','-60 days')))
    ORDER BY b.created_at DESC LIMIT 200`).all(who);
  const last = db.prepare('SELECT MAX(until_at) t FROM member_settlements WHERE member_id = ?').get(who).t;
  res.json({ lastSettled: last, rows, balance: memberBalance(who), eventOpen_cents: eventOpen(who) });
});

app.post('/api/tablet/pin', rateLimit('pin', 20, 60000), (req, res) => {
  const { token, currentPin, newPin } = req.body || {};
  const who = auth.checkTabletToken(token);
  if (!who || typeof who !== 'number') return bad(res, 'Sitzung abgelaufen.', 401);
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(who);
  if (!isPerson(m.kind)) return bad(res, 'Für dieses Konto kann keine PIN gesetzt werden.');
  if (m.pin_hash) {
    const err = checkPin(m, currentPin);                 // zählt in dieselbe Sperre wie das Entsperren
    if (err) return bad(res, err.msg === 'PIN falsch.' ? 'Aktuelle PIN falsch.' : err.msg, err.code);
  }
  // Die PIN ist eine Zentralfunktion (Verkauf, Platzbuchung, Helferdienste) – entfernen kann sie nur der Vorstand (zurücksetzen)
  if (newPin === '' || newPin === null) return bad(res, 'Die PIN kann nicht entfernt werden – sie gilt für Verkauf, Platzbuchung und Helferdienste. Vergessen? Der Vorstand setzt sie zurück.');
  { const e = auth.pinProblem(newPin); if (e) return bad(res, e); }
  db.prepare(`UPDATE members SET pin_hash = ?, failed_pins = 0, pin_strikes = 0, locked_until = NULL,
      pin_changed_at = datetime('now','localtime'), pin_changed_by = 'Mitglied' WHERE id = ?`).run(auth.hashSecret(newPin), m.id);
  // eine PIN für alles: gilt ab sofort auch in der Mitglieder-App
  // nur mit der bisherigen PIN als Nachweis (die erste PIN am Tablet ändert eine vorhandene App-PIN nicht)
  require('./invites').pinToApp(m.id, db.prepare('SELECT pin_hash FROM members WHERE id = ?').get(m.id).pin_hash, m.pin_hash ? String(currentPin) : null);
  audit('tablet', m.pin_hash ? 'PIN geändert' : 'PIN festgelegt', m.name);
  require('./push').send(m.id, 'app.pin', { title: `${getSetting('club_name', 'Verein')}: PIN geändert`, body: 'Deine PIN wurde am Tablet geändert. Warst du das nicht, melde dich bitte beim Vorstand.' }).catch(() => {});
  res.json({ ok: true, hasPin: true });
});

app.post('/api/tablet/logout', (req, res) => {
  auth.dropTabletToken((req.body || {}).token);
  res.json({ ok: true });
});

/* =====================================================================
   Admin – Anmeldung, Benutzer, Rechte
   ===================================================================== */
const cookieOpts = (token, req) => `gadmin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${8 * 3600}${req && req.secure ? '; Secure' : ''}`;
const need = auth.need;
/** Recht ohne Einschränkung auf Abteilungen (z. B. für Modul-Einstellungen) */
const fullPerm = (req, perm) => req.user.perms.includes(perm) && !(req.user.deptOnly || []).includes(perm);
const jarr = v => { try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } };
const cleanUser = u => { const pi = auth.permInfo(u); return { id: u.id, username: u.username, name: u.name, role: u.role, perms: pi.perms, deptOnly: pi.deptOnly,
  extra: jarr(u.perms), roles: jarr(u.roles).map(Number), departments: jarr(u.departments).map(Number), member_id: u.member_id || null,
  active: Boolean(u.active), last_login: u.last_login, builtin: Boolean(u.builtin) }; };
/** Abteilungen (aus der Mitgliederverwaltung, falls aktiv) */
const departmentList = () => { for (const p of plugins.withHook('departments')) { try { return p.hooks.departments() || []; } catch (e) { /* */ } } return []; };
/** Benutzername-Vorschlag: erster Buchstabe Vorname + Nachname (ä → ae …), eindeutig */
function suggestUsername(first, last, exceptId = 0) {
  const t = v => String(v || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  let base = (t(first).slice(0, 1) + t(last)).slice(0, 26);
  if (base.length < 3) base = (base + 'user').slice(0, 26);
  let un = base, n = 1;
  while (db.prepare('SELECT 1 FROM admin_users WHERE username = ? AND id != ?').get(un, exceptId)) un = `${base}${++n}`;
  return un;
}

app.get('/api/admin/status', (req, res) => {
  const u = auth.currentUser(req);
  res.json({ configured: auth.adminConfigured(), loggedIn: Boolean(u), https: tls.enabled(),
    tabletPwMissing: u && auth.adminConfigured() ? tabletOn() && !gateOn() : undefined, tablet: tabletOn(),
    clubNetsMissing: u && auth.adminConfigured() && u.perms.includes('einstellungen') ? !require('./memberapp').hasClubNets() : undefined,
    user: u ? { id: u.id, username: u.username, name: u.name, role: u.role, perms: u.perms, deptOnly: u.deptOnly, depts: u.depts, builtin: Boolean(u.builtin) } : null,
    permLabels: u ? plugins.visiblePerms() : undefined,   // die Rechte verraten die installierten Module – erst nach der Anmeldung
    setupCode: !auth.adminConfigured() && setupNeedsCode(req) ? true : undefined,
    modules: auth.adminConfigured() ? undefined : plugins.list().filter(p => !p.error).map(p => ({ id: p.id, name: p.name, description: p.short || p.description, active: p.active })),
    languages: auth.adminConfigured() ? undefined : i18n.list().map(l => ({ code: l.code, name: l.name })), language: auth.adminConfigured() ? undefined : i18n.clubLang(),
    demo: auth.adminConfigured() ? undefined : demo.freshDb(db), demoMode: isDemo() || undefined,
    demoInfo: isDemo() && u && u.perms.includes('einstellungen') ? JSON.parse(getSetting('demo_info', '{}')) : undefined });
});

const pwOk = p => { const n = String(p || '').length; return n >= 8 && n <= 200; };
const PW_MSG = 'Das Passwort braucht 8 bis 200 Zeichen.';
function validUsername(n) { return /^[a-z0-9._-]{3,30}$/i.test(n); }

/* Erste Einrichtung: Wer vor dem Verein an die frische Installation kommt, darf sie nicht übernehmen können.
   Über die Home-Assistant-Seitenleiste (nur HA-Admins) geht es direkt; von jedem anderen Gerät braucht es den
   Einrichtungscode, der beim Start im Protokoll des Add-ons steht (Einstellungen → Add-ons → Clubwerk → Protokoll). */
let SETUP_CODE = null, setupFails = 0;
function newSetupCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  SETUP_CODE = Array.from(crypto.randomBytes(8), b => A[b % A.length]).join('').replace(/(.{4})/, '$1-');
  console.log(`\n================================================================\n  Erste Einrichtung – Einrichtungscode: ${SETUP_CODE}\n  (nur nötig, wenn die Verwaltung nicht über die Home-Assistant-Seitenleiste geöffnet wird)\n================================================================\n`);
}
if (!auth.adminConfigured() && process.env.CW_TEST_NO_SETUP_CODE !== '1') newSetupCode();
// Wer gerade die Demo beendet hat, braucht keinen Code (Ticket im Browser, eine Stunde gültig – src/demo.js)
const setupNeedsCode = req => Boolean(SETUP_CODE) && !viaIngress(req) && !demo.ticketOk(DATA_DIR, auth.parseCookies(req).csetup);
/** Einrichtungscode prüfen (erste Einrichtung und Demo-Start); false = Antwort schon gesendet */
function setupCodeOk(req, res) {
  if (!setupNeedsCode(req)) return true;
  const given = String((req.body || {}).code || '').trim().toUpperCase().replace(/\s/g, '');
  const want = SETUP_CODE.replace('-', '');
  const g = Buffer.from(given.replace('-', '').padEnd(want.length, ' ').slice(0, 64)), w = Buffer.from(want.padEnd(g.length, ' '));
  if (g.length === w.length && crypto.timingSafeEqual(g, w)) return true;
  if (++setupFails >= 10) { setupFails = 0; newSetupCode(); }   // nach 10 Fehlversuchen gibt es einen neuen Code
  audit(null, 'Erste Einrichtung: falscher Einrichtungscode', req.ip);
  bad(res, 'Der Einrichtungscode stimmt nicht. Er steht im Protokoll des Add-ons (Home Assistant → Einstellungen → Add-ons → Clubwerk → Protokoll).', 403);
  return false;
}
app.post('/api/admin/setup', rateLimit('setup', 10, 60000), (req, res) => {
  if (auth.adminConfigured()) return bad(res, 'Das Adminkonto ist bereits eingerichtet.', 403);
  if (!setupCodeOk(req, res)) return;
  const { password, clubName, tabletPassword, wizard } = req.body || {};
  const club = cleanName(clubName, 60);
  if (clubName !== undefined && club.length < 3) return bad(res, 'Bitte den Namen des Vereins eingeben.');
  // Assistent: Name und Benutzername frei wählbar, Vereinssprache gleich mit – sonst wie bisher fest „Adminkonto“ / „admin“
  const uname = wizard ? String((req.body || {}).username || 'admin').trim().toLowerCase() : 'admin', fullName = (wizard && cleanName((req.body || {}).name, 60)) || 'Adminkonto';
  if (!validUsername(uname)) return bad(res, 'Benutzername: 3 bis 30 Zeichen, nur Buchstaben, Ziffern, Punkt, Strich und Unterstrich.');
  const lang = (req.body || {}).language;
  if (lang !== undefined && !i18n.exists(i18n.normCode(lang))) return bad(res, 'Diese Sprache gibt es nicht.');
  if (!pwOk(password)) return bad(res, PW_MSG);
  if (tabletPassword !== undefined) {
    const tp = String(tabletPassword || ''); const pe = tabletPwError(tp); if (pe) return bad(res, pe);
    if (tp === String(password)) return bad(res, 'Bitte für das Tablet ein anderes Passwort als für das Adminkonto wählen.');
  }
  if (club) setSetting('club_name', club);
  const mods = (req.body || {}).modules;
  if (mods && typeof mods === 'object') for (const p of plugins.list()) if (mods[p.id] !== undefined && !p.error) setSetting(`ext_${p.id}_active`, mods[p.id] ? '1' : '0');
  if (lang !== undefined) setSetting('language', i18n.normCode(lang));
  const adminId = auth.createUser({ username: uname, name: fullName, password: String(password), role: 'oberadmin', builtin: true });
  if (process.env.CW_TEST_VAULT === '1') { const v = require('./vault'); v.prepare(adminId); v.enable(adminId, String(password)); }   // nur Tests: alles mit eingeschaltetem Tresor prüfen
  if (tabletPassword !== undefined) { setSetting('tablet_pw_hash', auth.hashSecret(String(tabletPassword))); setSetting('tablet_pw_at', nowTs()); setSetting('tablet_pw_ver', crypto.randomBytes(6).toString('hex')); }
  if (wizard) require('./einrichtung').begin();
  audit(uname, 'Adminkonto eingerichtet', wizard ? 'mit dem Einrichtungs-Assistenten' : undefined);
  demo.dropTicket(DATA_DIR);
  const r = auth.login(uname, String(password), req.ip);
  res.setHeader('Set-Cookie', [cookieOpts(r.token, req), 'csetup=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0']);
  res.json({ ok: true });
});
/* Demo ausprobieren (nur frische Installation, mit Einrichtungscode bzw. über die Seitenleiste – wie die Ersteinrichtung):
   Markierung anlegen, neu starten; beim Start ersetzt src/demo.js die leere Datenbank durch die Demo. Die zufälligen Passwörter
   bekommt nur, wer die Demo startet (und später angemeldete Admins im Demo-Hinweis). */
app.post('/api/admin/demo/start', rateLimit('setup', 10, 60000), (req, res) => {
  if (auth.adminConfigured() || !demo.freshDb(db)) return bad(res, 'Die Demo gibt es nur auf einer frisch installierten Clubwerk-Instanz.', 403);
  if (!setupCodeOk(req, res)) return;
  const r = demo.markStart(DATA_DIR, auth.hashSecret);
  console.log('Demo wird eingerichtet – Clubwerk startet neu.');
  res.json({ ok: true, restart: true, ...r });
  setTimeout(() => shutdown('Demo starten', 1), 300);
});

app.post('/api/admin/login', rateLimit('login', 15, 5 * 60000), (req, res) => {
  const { username, password } = req.body || {};
  const r = auth.login(String(username || ''), String(password || ''), req.ip, 'admin', { trusted: viaIngress(req), known: auth.knownDevice(req, username) });
  if (!r.ok) {
    audit(String(username || '').slice(0, 30), r.locked ? 'Anmeldung gesperrt (5 Fehlversuche)' : 'Anmeldung fehlgeschlagen', req.ip);
    if (r.manyFails) securityAlert(`Auffällig viele fehlgeschlagene Anmeldungen für „${String(username || '').slice(0, 30)}“ (zuletzt von ${req.ip}). Bitte prüfen, ob jemand versucht, das Passwort zu erraten.`);
    return bad(res, r.error, 401);
  }
  audit(String(username).toLowerCase(), 'Anmeldung', req.ip);
  res.setHeader('Set-Cookie', [cookieOpts(r.token, req), auth.deviceCookie(username, req.secure)]);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  auth.logout(auth.parseCookies(req).gadmin);
  res.setHeader('Set-Cookie', 'gadmin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

const admin = express.Router();
admin.use(auth.requireAdmin);
const DRINK_ADMIN = /^\/(articles|deliveries|upload|beleg|supplier-map|stock|shrinkage|order|settings\/order|events|event-members|tabs|bookings|balances|settle|settle-history|export\.xlsx|abtippliste|categories)(\/|$)/;
admin.use((req, res, next) => (DRINK_ADMIN.test(normPath(req.path)) && !plugins.isActive('getraenke')
  ? res.status(404).json({ error: 'Das Modul „Verkauf“ ist ausgeschaltet.' }) : next()));
/* Tresor gesperrt: Bereiche mit persönlichen Daten (Mitgliederverwaltung, Buchhaltung, E-Mail an Mitglieder) zeigen einen
   Sperrhinweis statt Platzhaltern – und niemand speichert versehentlich leere Felder über echte Daten */
const VAULT_AREAS = /^\/(x\/(mitglieder|buchhaltung)|mail|extensions\/(mitglieder|buchhaltung)\/(export|import))(\/|$)/;
admin.use((req, res, next) => (VAULT_AREAS.test(normPath(req.path)) && require('./vault').locked()
  ? res.status(423).json({ error: 'Die persönlichen Daten sind nach einem Neustart noch verschlossen. Sie öffnen sich, sobald sich ein Admin mit Schlüssel anmeldet – oder mit dem Wiederherstellungscode.', vaultLocked: true }) : next()));
app.use('/api/admin', admin);

/** eigenes Passwort des angemeldeten Benutzers prüfen (Bestätigung heikler Aktionen) */
function ownPwOk(req, pw) { const u = db.prepare('SELECT pw_hash FROM admin_users WHERE id = ?').get(req.user.id); return Boolean(u && pw && auth.verifySecret(String(pw), u.pw_hash)); }
/** nur für Benutzer mit allen Rechten */
const owner = (req, res, next) => (req.user.role === 'oberadmin' ? next() : bad(res, 'Das darf nur ein Benutzer mit allen Rechten.', 403));

admin.post('/password', rateLimit('pwchange', 10, 10 * 60000), (req, res) => {
  const { current, next } = req.body || {};
  const u = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.user.id);
  if (!ownPwOk(req, current)) return bad(res, 'Aktuelles Passwort falsch.', 401);
  if (!pwOk(next)) return bad(res, PW_MSG);
  auth.setPassword(u.id, String(next));
  const r = auth.login(u.username, String(next), req.ip);
  res.setHeader('Set-Cookie', cookieOpts(r.token, req));
  res.json({ ok: true });
});

/* ---------- Benutzerverwaltung (Adminkonto und Benutzer mit allen Rechten) ---------- */
admin.get('/users', need('benutzer'), (req, res) => {
  res.json(db.prepare('SELECT * FROM admin_users ORDER BY builtin DESC, role DESC, username').all().map(cleanUser));
});

/* Rollen, Abteilungen und Mitglieder für den Benutzer-Dialog */
const roleIds = v => (Array.isArray(v) ? [...new Set(v.map(Number))].filter(id => Number.isInteger(id) && db.prepare('SELECT 1 FROM admin_roles WHERE id = ?').get(id)) : null);
const deptIds = v => { if (!Array.isArray(v)) return null; const ok = new Set(departmentList().map(d => d.id)); return [...new Set(v.map(Number))].filter(id => ok.has(id)); };
const memberOk = v => (v ? (db.prepare("SELECT id FROM members WHERE id = ? AND deleted = 0").get(int(v)) || {}).id || null : null);
admin.get('/users/options', need('benutzer'), (req, res) => {
  const linked = new Set(db.prepare('SELECT member_id FROM admin_users WHERE member_id IS NOT NULL').all().map(r => r.member_id));
  res.json({ roles: db.prepare('SELECT * FROM admin_roles ORDER BY sort, name').all().map(r => ({ ...r, perms: jarr(r.perms), dept_scope: Boolean(r.dept_scope),
    users: db.prepare('SELECT username, roles FROM admin_users').all().filter(u => jarr(u.roles).map(Number).includes(r.id)).length })),
    departments: departmentList(), permLabels: plugins.visiblePerms(),
    members: db.prepare("SELECT id, name, first_name, last_name FROM members WHERE kind = 'mitglied' AND deleted = 0 AND active = 1 ORDER BY name_key(name, kind)").all()
      .map(m => { const sp = m.first_name || m.last_name ? { first: m.first_name || '', last: m.last_name || '' } : splitPersonName(m.name);
        return { id: m.id, name: m.name, linked: linked.has(m.id), username: suggestUsername(sp.first, sp.last) }; }) });
});
admin.get('/users/suggest', need('benutzer'), (req, res) => res.json({ username: suggestUsername(req.query.first, req.query.last) }));

/* ---------- Bankkonten des Vereins (zentral, für alle Module) ---------- */
const bank = require('./bank');
const BANK_PERMS = ['einstellungen', 'buchhaltung', 'mitglieder_finanzen'];
const bankManage = req => req.user.role === 'oberadmin' || BANK_PERMS.some(p => fullPerm(req, p));
admin.get('/bank-accounts', (req, res) => {
  const full = bankManage(req);
  if (!full && !req.user.perms.some(p => ['mitglieder', 'buchhaltung'].includes(p))) return bad(res, 'Keine Berechtigung.', 403);
  res.json({ manage: full, departments: departmentList(), rows: bank.list({ all: full }).map(a => (full ? a : { ...a, iban: bank.maskIban(a.iban) })) });
});
admin.post('/bank-accounts', (req, res) => {
  if (!bankManage(req)) return bad(res, 'Bankkonten verwalten dürfen Einstellungen, Buchhaltung oder Beiträge & Einzug.', 403);
  try { const id = bank.save(req.body || {}); audit(req.user, 'Bankkonto angelegt', `${(req.body || {}).name} ${bank.maskIban((req.body || {}).iban)}`); res.json({ id }); } catch (e) { bad(res, e.message); }
});
admin.put('/bank-accounts/:id', (req, res) => {
  if (!bankManage(req)) return bad(res, 'Keine Berechtigung.', 403);
  const cur = bank.get(req.params.id); if (!cur) return bad(res, 'Nicht gefunden.', 404);
  try { bank.save(req.body || {}, cur); audit(req.user, 'Bankkonto geändert', cur.name); res.json({ ok: true }); } catch (e) { bad(res, e.message); }
});
admin.delete('/bank-accounts/:id', (req, res) => {
  if (!bankManage(req)) return bad(res, 'Keine Berechtigung.', 403);
  const cur = bank.get(req.params.id); if (!cur) return bad(res, 'Nicht gefunden.', 404);
  const used = plugins.withHook('bankAccountUsed').map(p => { try { return p.hooks.bankAccountUsed(cur.id); } catch (e) { return null; } }).filter(Boolean);
  if (used.length) return bad(res, `Das Konto wird noch verwendet: ${used.join(', ')}. Stattdessen auf „inaktiv“ setzen.`);
  bank.remove(cur.id); audit(req.user, 'Bankkonto gelöscht', cur.name); res.json({ ok: true });
});
/** Rechte fürs Protokoll mit ihren Namen („Lieferungen & Belege hochladen“), nie als interne Schlüssel */
const permNames = list => (list || []).map(k => auth.PERMS[k] || k).join(', ') || 'keine';
admin.post('/users', need('benutzer'), (req, res) => {
  const { username, name, password, role, perms } = req.body || {};
  const b = req.body || {};
  if (role === 'oberadmin' && !ownerConfirm(req, res)) return;   // „alle Rechte“ vergeben nur mit dem eigenen Passwort
  const memberId = memberOk(b.member_id);
  if (b.member_id && !memberId) return bad(res, 'Mitglied nicht gefunden.');
  if (memberId && db.prepare('SELECT 1 FROM admin_users WHERE member_id = ?').get(memberId)) return bad(res, 'Für dieses Mitglied gibt es schon einen Benutzer.');
  let un = String(username || '').trim().toLowerCase();
  let nm = cleanName(name, 60);
  if (memberId && !un) { const m = db.prepare('SELECT name, first_name, last_name FROM members WHERE id = ?').get(memberId); const sp = m.first_name || m.last_name ? { first: m.first_name, last: m.last_name } : splitPersonName(m.name); un = suggestUsername(sp.first, sp.last); nm = nm || m.name; }
  if (!un && nm) { const sp = splitPersonName(nm); un = suggestUsername(sp.first, sp.last); }   // Regel: erster Buchstabe Vorname + Nachname
  if (!validUsername(un)) return bad(res, 'Benutzername: 3–30 Zeichen, nur Buchstaben, Ziffern, Punkt, Minus.');
  if (db.prepare('SELECT 1 FROM admin_users WHERE username = ?').get(un)) return bad(res, 'Diesen Benutzernamen gibt es schon.');
  if (!pwOk(password)) return bad(res, PW_MSG);
  const roles = roleIds(b.roles) || [], depts = deptIds(b.departments) || [];
  const id = auth.createUser({ username: un, name: nm, password: String(password),
    role: role === 'oberadmin' ? 'oberadmin' : 'admin', perms: Array.isArray(perms) ? perms : [], roles, departments: depts, memberId });
  audit(req.user, 'Admin angelegt', `${un} (${role === 'oberadmin' ? 'alle Rechte' : [roles.map(r => (db.prepare('SELECT name FROM admin_roles WHERE id = ?').get(r) || {}).name).join(', '), Array.isArray(perms) ? permNames(perms) : ''].filter(Boolean).join(' · ')})`);
  res.json({ id, username: un });
});

/* Rollen */
const roleInput = (b, cur = {}) => {
  const name = cleanName(b.name !== undefined ? b.name : cur.name, 40);
  if (name.length < 2) return { error: 'Bitte einen Namen für die Rolle eintragen.' };
  const perms = Array.isArray(b.perms) ? [...new Set(b.perms.filter(p => auth.PERMS[p]))] : jarr(cur.perms);
  const scoped = b.dept_scope !== undefined ? Boolean(b.dept_scope) : Boolean(cur.dept_scope);
  const wide = scoped ? perms.filter(p => !auth.DEPT_PERMS.includes(p)) : [];
  if (wide.length) return { error: `„Nur eigene Abteilung(en)“ gilt nur für die Rechte ${auth.DEPT_PERMS.map(p => '„' + auth.PERMS[p] + '“').join(' und ')}. Diese Rechte würden für alle Mitglieder gelten – bitte in einer eigenen Rolle vergeben: ${permNames(wide)}.` };
  return { v: { name, description: b.description !== undefined ? String(b.description || '').replace(/[<>]/g, '').trim().slice(0, 300) || null : cur.description || null,
    perms: JSON.stringify(perms), dept_scope: b.dept_scope !== undefined ? (b.dept_scope ? 1 : 0) : (cur.dept_scope || 0), sort: b.sort !== undefined ? int(b.sort) : (cur.sort || 0) } };
};
admin.post('/roles', need('benutzer'), (req, res) => {
  const r = roleInput(req.body || {}); if (r.error) return bad(res, r.error);
  if (db.prepare('SELECT 1 FROM admin_roles WHERE name = ?').get(r.v.name)) return bad(res, 'Diese Rolle gibt es schon.');
  const id = Number(db.prepare('INSERT INTO admin_roles(name, description, perms, dept_scope, sort) VALUES (?,?,?,?,?)').run(r.v.name, r.v.description, r.v.perms, r.v.dept_scope, r.v.sort).lastInsertRowid);
  audit(req.user, 'Rolle angelegt', `${r.v.name}: ${permNames(jarr(r.v.perms))}`);
  res.json({ id });
});
admin.put('/roles/:id', need('benutzer'), (req, res) => {
  const cur = db.prepare('SELECT * FROM admin_roles WHERE id = ?').get(int(req.params.id)); if (!cur) return bad(res, 'Nicht gefunden.', 404);
  const r = roleInput(req.body || {}, cur); if (r.error) return bad(res, r.error);
  if (db.prepare('SELECT 1 FROM admin_roles WHERE name = ? AND id != ?').get(r.v.name, cur.id)) return bad(res, 'Diese Rolle gibt es schon.');
  db.prepare('UPDATE admin_roles SET name = ?, description = ?, perms = ?, dept_scope = ?, sort = ? WHERE id = ?').run(r.v.name, r.v.description, r.v.perms, r.v.dept_scope, r.v.sort, cur.id);
  for (const u of db.prepare('SELECT id, roles FROM admin_users').all()) if (jarr(u.roles).map(Number).includes(cur.id)) auth.dropUserSessions(u.id);   // gilt sofort
  audit(req.user, 'Rolle geändert', `${r.v.name}: ${permNames(jarr(r.v.perms))}${r.v.dept_scope ? ' (nur eigene Abteilung)' : ''}`);
  res.json({ ok: true });
});
admin.delete('/roles/:id', need('benutzer'), (req, res) => {
  const cur = db.prepare('SELECT * FROM admin_roles WHERE id = ?').get(int(req.params.id)); if (!cur) return bad(res, 'Nicht gefunden.', 404);
  const users = db.prepare('SELECT username, roles FROM admin_users').all().filter(u => jarr(u.roles).map(Number).includes(cur.id));
  if (users.length) return bad(res, `Die Rolle ist noch vergeben (${users.map(u => u.username).join(', ')}) – zuerst bei den Benutzern entfernen.`);
  db.prepare('DELETE FROM admin_roles WHERE id = ?').run(cur.id);
  audit(req.user, 'Rolle gelöscht', cur.name);
  res.json({ ok: true });
});

admin.put('/users/:id', need('benutzer'), (req, res) => {
  const u = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(int(req.params.id));
  if (!u) return bad(res, 'Nicht gefunden.', 404);
  const b = req.body || {};
  const role = b.role === undefined ? u.role : (b.role === 'oberadmin' ? 'oberadmin' : 'admin');
  const active = b.active === undefined ? u.active : (b.active ? 1 : 0);
  if (u.builtin) {
    if (role !== 'oberadmin' || !active) return bad(res, 'Das Adminkonto behält immer alle Rechte und kann nicht gesperrt werden.');
    if (b.name !== undefined && String(b.name).trim() !== u.name) return bad(res, 'Der Name des Adminkontos ist fest.');
  }
  if (u.id === req.user.id && (role !== 'oberadmin' || !active)) return bad(res, 'Du kannst dich nicht selbst herabstufen oder sperren.');
  if (role === 'oberadmin' && u.role !== 'oberadmin' && !ownerConfirm(req, res)) return;   // auf „alle Rechte“ hochstufen nur mit dem eigenen Passwort
  const perms = Array.isArray(b.perms) ? JSON.stringify(b.perms.filter(p => auth.PERMS[p])) : u.perms;
  const name = u.builtin ? u.name : (b.name !== undefined ? String(b.name).trim().slice(0, 60) : u.name);
  const roles = roleIds(b.roles), depts = deptIds(b.departments);
  let memberId = u.member_id;
  if (b.member_id !== undefined) {
    memberId = memberOk(b.member_id);
    if (b.member_id && !memberId) return bad(res, 'Mitglied nicht gefunden.');
    if (memberId && db.prepare('SELECT 1 FROM admin_users WHERE member_id = ? AND id != ?').get(memberId, u.id)) return bad(res, 'Für dieses Mitglied gibt es schon einen Benutzer.');
  }
  db.prepare('UPDATE admin_users SET name = ?, role = ?, perms = ?, active = ?, roles = ?, departments = ?, member_id = ? WHERE id = ?')
    .run(name, role, perms, active, roles ? JSON.stringify(roles) : u.roles, depts ? JSON.stringify(depts) : u.departments, memberId, u.id);
  auth.dropUserSessions(u.id);   // geänderte Rechte gelten sofort
  if (!active) require('./vault').dropUser(u.id);   // gesperrter Benutzer: seine Schlüsselkopie für den Tresor entfällt
  audit(req.user, 'Admin geändert', `${u.username}: ${role}${active ? '' : ', gesperrt'} ${role === 'admin' ? perms : ''}${roles ? ' Rollen ' + roles.join(',') : ''}`);
  res.json({ ok: true });
});

admin.delete('/users/:id', need('benutzer'), (req, res) => {
  const u = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(int(req.params.id));
  if (!u) return bad(res, 'Nicht gefunden.', 404);
  if (u.builtin) return bad(res, 'Das Adminkonto kann nicht gelöscht werden.');
  if (u.id === req.user.id) return bad(res, 'Du kannst dich nicht selbst löschen.');
  db.prepare('DELETE FROM admin_users WHERE id = ?').run(u.id);
  require('./vault').dropUser(u.id);
  auth.dropUserSessions(u.id);
  audit(req.user, 'Admin gelöscht', u.username);
  res.json({ ok: true });
});

admin.post('/users/:id/password', need('benutzer'), rateLimit('pwreset', 10, 10 * 60000), (req, res) => {
  // mit dem eigenen Passwort bestätigen – eine fremde, offen gelassene Sitzung reicht nicht, um Passwörter zu ändern
  if (!ownPwOk(req, (req.body || {}).myPassword)) return bad(res, 'Dein eigenes Passwort zur Bestätigung stimmt nicht.', 401);
  const pw = String((req.body || {}).password || '');
  if (!pwOk(pw)) return bad(res, PW_MSG);
  const u = db.prepare('SELECT id, username FROM admin_users WHERE id = ?').get(int(req.params.id));
  if (!u) return bad(res, 'Nicht gefunden.', 404);
  auth.setPassword(u.id, pw);
  audit(req.user, 'Passwort neu vergeben', u.username);
  res.json({ ok: true });
});

/* ---------- Einstellungen ---------- */
const ORDER_KEYS = { order_supplier: '', order_email: '', order_cc: '', customer_no: '', delivery_address: '', order_sender: '', order_phone: '' };
const orderSettings = () => Object.fromEntries(Object.entries(ORDER_KEYS).map(([k, d]) => [k, getSetting(k, d)]));

/* Suche nach Datensätzen (Strg/⌘ K, siehe src/suche.js) – als POST, damit Suchbegriffe in keiner Adresse stehen; nie im Protokoll */
admin.post('/suche', (req, res) => res.json(require('./suche').run(req.user, req.body && req.body.q)));

admin.get('/settings', (req, res) => {
  const p = req.user.perms;   // Bestelldaten (Kundennummer, Adresse, Mail des Lieferanten) nur für „Bestellung“/„Einstellungen“
  res.json({ clubName: getSetting('club_name', process.env.CLUB_NAME || 'Unser Verein'), lastSettlement: lastSettlement(),
    order: p.includes('bestellung') || p.includes('einstellungen') ? orderSettings() : undefined, clubColor: clubColor(), clubColor2: clubColor2(), tabletTheme: tabletTheme(), logo: logoUrl(), logoCustom: Boolean((logoInfo() || {}).custom),
    clubStreet: getSetting('club_street', ''), clubCity: getSetting('club_city', ''), clubEmail: getSetting('club_email', ''), clubPhone: getSetting('club_phone', ''),
    topN: topN(), topDays: topDays(), tabletPw: p.includes('einstellungen') ? { on: gateOn(), since: getSetting('tablet_pw_at') } : undefined, tablet: tabletOn(), tabletChosen: getSetting('tablet_enabled', null) !== null,
    allowedHosts: p.includes('einstellungen') ? getSetting('allowed_hosts', '') : undefined });
});
/* Weitere Adressen (Namen), unter denen die Verwaltung erreichbar sein soll – z. B. verein.duckdns.org */
admin.put('/settings/hosts', need('einstellungen'), (req, res) => {
  const list = String((req.body || {}).hosts || '').toLowerCase().split(/[\s,;]+/).map(h => h.trim().replace(/^https?:\/\//, '').replace(/[/:].*$/, '')).filter(Boolean);
  if (list.length > 20 || list.some(h => !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h))) return bad(res, 'Bitte nur Namen wie verein.duckdns.org eintragen (höchstens 20, mit Komma getrennt).');
  setSetting('allowed_hosts', [...new Set(list)].join(', '));
  require('./security').resetHostCache();
  audit(req.user, 'Weitere Adressen geändert', getSetting('allowed_hosts', '') || '–');
  res.json({ ok: true, hosts: getSetting('allowed_hosts', '') });
});
admin.put('/settings/tablet-password', need('einstellungen'), (req, res) => {
  const pw = String((req.body || {}).password || '');
  const pe = tabletPwError(pw); if (pe) return bad(res, pe);
  const first = !gateOn();
  setSetting('tablet_pw_hash', auth.hashSecret(pw));
  setSetting('tablet_pw_at', nowTs());
  setSetting('tablet_pw_ver', crypto.randomBytes(6).toString('hex'));   // bisherige Geräte müssen das neue Passwort eingeben
  audit(req.user, first ? 'Buchungsseite: Passwortschutz eingeschaltet' : 'Buchungsseite: Passwort geändert');
  res.setHeader('Set-Cookie', gateCookie(req));                         // dieses Gerät bleibt freigeschaltet
  res.json({ ok: true });
});
/* Tablet im Vereinsheim ein- oder ausschalten. Einschalten ohne vergebenes Passwort geht nur zusammen mit einem neuen Passwort –
   so ist keine Tablet-Seite auch nur kurz ohne Passwort erreichbar. Ausschalten meldet alle freigeschalteten Geräte ab. */
admin.put('/settings/tablet', need('einstellungen'), (req, res) => {
  const b = req.body || {}, on = Boolean(b.on), pw = String(b.password || ''), was = tabletOn();
  if (on && (pw || !gateOn())) {
    const pe = tabletPwError(pw); if (pe) return bad(res, gateOn() ? pe : 'Zum Einschalten bitte ein Passwort für das Tablet festlegen (mindestens 8 Zeichen).');
    setSetting('tablet_pw_hash', auth.hashSecret(pw)); setSetting('tablet_pw_at', nowTs());
  }
  if (!on || pw) setSetting('tablet_pw_ver', crypto.randomBytes(6).toString('hex'));   // bisherige Freigaben erlöschen
  setSetting('tablet_enabled', on ? '1' : '0');
  const d = auditDiff({ on: ['Tablet im Vereinsheim', 'bool'] }, { on: was }, { on });
  audit(req.user, on ? 'Tablet eingeschaltet' : 'Tablet ausgeschaltet', [d, pw ? 'Passwort für das Tablet neu festgelegt' : ''].filter(Boolean).join(' · '));
  if (on) res.setHeader('Set-Cookie', gateCookie(req));   // dieses Gerät bleibt freigeschaltet
  res.json({ ok: true, tablet: on, pw: gateOn() });
});
admin.post('/settings/tablet-password/logout-all', need('einstellungen'), (req, res) => {
  if (!gateOn()) return bad(res, 'Der Passwortschutz ist nicht eingeschaltet.');
  setSetting('tablet_pw_ver', crypto.randomBytes(6).toString('hex'));
  audit(req.user, 'Buchungsseite: alle Geräte abgemeldet');
  res.json({ ok: true });
});
admin.delete('/settings/tablet-password', need('einstellungen'), (req, res) => bad(res, 'Das Passwort für das Tablet ist Pflicht, solange das Tablet eingeschaltet ist. Es lässt sich nur ändern – ohne Tablet stattdessen das Tablet ausschalten (Einstellungen › Tablet).'));
/* ---------- Tresor: Verschlüsselung der persönlichen Daten ---------- */
const vaultPwLimit = rateLimit('vaultpw', 10, 10 * 60000);
admin.get('/vault', (req, res) => {
  const v = require('./vault');
  res.json({ ...v.status(req.user.id), may: req.user.perms.includes('einstellungen'),
    oldPlain: v.on() ? undefined : (() => { try { return backup.list().length; } catch (e) { return 0; } })() });
});
admin.post('/vault/prepare', need('einstellungen'), vaultPwLimit, (req, res) => {
  if (!ownPwOk(req, (req.body || {}).password)) return bad(res, 'Dein Passwort stimmt nicht.', 401);
  try { res.json(require('./vault').prepare(req.user.id)); } catch (e) { bad(res, e.message); }
});
admin.post('/vault/enable', need('einstellungen'), vaultPwLimit, asyncRoute(async (req, res) => {
  const b = req.body || {}; const vault = require('./vault');
  if (!ownPwOk(req, b.password)) return bad(res, 'Dein Passwort stimmt nicht.', 401);
  try { if (!vault.confirmCode(req.user.id, b.typed)) return bad(res, 'Die Zeichen passen nicht zum Wiederherstellungscode – bitte auf dem Ausdruck nachsehen.'); } catch (e) { return bad(res, e.message); }
  try { await backup.snapshot(db, 'vor-verschluesselung'); } catch (e) { return bad(res, 'Vorher konnte keine Sicherung angelegt werden: ' + e.message); }
  let r; try { r = vault.enable(req.user.id, String(b.password)); } catch (e) { console.error('Tresor einschalten:', e); return bad(res, 'Das Einschalten ist fehlgeschlagen: ' + e.message, 500); }
  // alte, unverschlüsselte Schnappschüsse der Datenbank auf diesem Gerät entfernen (sie enthielten die Daten im Klartext)
  let removed = 0;
  if (b.deleteOld) for (const f of fs.readdirSync(backup.BACKUP_DIR).filter(x => /\.db$/.test(x))) { try { fs.unlinkSync(path.join(backup.BACKUP_DIR, f)); removed++; } catch (e) { /* weiter */ } }
  if (b.deleteOld) try { await backup.snapshot(db, 'verschluesselt'); } catch (e) { /* nächste Nacht */ }
  audit(req.user, 'Tresor eingeschaltet', `${r.files} Dateien verschlüsselt, ${removed} alte Schnappschüsse entfernt, ${r.ms} ms`);
  res.json({ ok: true, ...r, removed });
}));
admin.post('/vault/unlock', vaultPwLimit, (req, res) => {
  const b = req.body || {}; const vault = require('./vault');
  if (!ownPwOk(req, b.password)) return bad(res, 'Dein Passwort stimmt nicht.', 401);
  let ok = false; try { ok = vault.unlockWithCode(b.code); } catch (e) { return bad(res, e.message); }
  if (!ok) { audit(req.user, 'Tresor: falscher Wiederherstellungscode'); return bad(res, 'Der Wiederherstellungscode stimmt nicht.', 401); }
  vault.onPassword(req.user.id, String(b.password));   // ab jetzt öffnet auch die Anmeldung dieses Admins den Tresor
  audit(req.user, 'Tresor mit Wiederherstellungscode geöffnet');
  res.json({ ok: true });
});
admin.post('/vault/new-code', need('einstellungen'), vaultPwLimit, (req, res) => {
  if (!ownPwOk(req, (req.body || {}).password)) return bad(res, 'Dein Passwort stimmt nicht.', 401);
  try { const code = require('./vault').newRecovery(); audit(req.user, 'Tresor: neuer Wiederherstellungscode'); res.json({ code }); } catch (e) { bad(res, e.message, e.status || 400); }
});
admin.post('/vault/disable', need('einstellungen'), vaultPwLimit, (req, res) => {
  if (!ownPwOk(req, (req.body || {}).password)) return bad(res, 'Dein Passwort stimmt nicht.', 401);
  try { require('./vault').disable(); audit(req.user, 'Tresor ausgeschaltet'); res.json({ ok: true }); } catch (e) { bad(res, e.message, e.status || 400); }
});

/* ---------- Sprachen ---------- */
admin.get('/sprachen', (req, res) => {
  res.json({ languages: i18n.list(), club: i18n.clubLang(), canEdit: req.user.perms.includes('einstellungen'), app: APP_VERSION });
});
admin.put('/sprachen/verein', need('einstellungen'), (req, res) => {
  const code = i18n.normCode((req.body || {}).code);
  if (!code || !i18n.exists(code)) return bad(res, 'Diese Sprache gibt es nicht.');
  setSetting('language', code);
  audit(req.user, 'Vereinssprache geändert', code);
  res.json({ ok: true, club: code });
});
admin.get('/sprachen/:code/download', need('einstellungen'), asyncRoute(async (req, res) => {
  const template = req.params.code === 'vorlage';
  const code = template ? 'de' : i18n.normCode(req.params.code);
  if (!code || (!template && !i18n.exists(code))) return bad(res, 'Diese Sprache gibt es nicht.', 404);
  const base = template ? 'Clubwerk_Sprachvorlage' : `Clubwerk_Sprache_${code}`;
  if (req.query.format === 'xlsx') {
    const buf = await i18n.exportXlsx(code, { template, appVersion: APP_VERSION });
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${base}.xlsx"` });
    return res.send(Buffer.from(buf));
  }
  res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${base}.json"` });
  res.send(JSON.stringify(i18n.exportJson(code, { template, appVersion: APP_VERSION }), null, 1));
}));
admin.post('/sprachen/import', need('einstellungen'), rateLimit('langimp', 30, 10 * 60000), express.raw({ type: () => true, limit: '8mb' }), asyncRoute(async (req, res) => {
  let data;
  try { data = await i18n.parseUpload(req.body, decodeURIComponent(String(req.get('X-Filename') || ''))); } catch (e) { return bad(res, e.message); }
  const q = req.query || {};
  let report;
  try { report = i18n.importData(data, { override: { code: q.code, name: q.name, locale: q.locale, dir: q.dir } }); } catch (e) { return bad(res, e.message); }
  audit(req.user, 'Sprache importiert', `${report.name} (${report.code}): ${report.taken} Texte`);
  res.json({ ok: true, report, languages: i18n.list() });
}));
admin.delete('/sprachen/:code', need('einstellungen'), (req, res) => {
  let r;
  try { r = i18n.remove(req.params.code); } catch (e) { return bad(res, e.message); }
  audit(req.user, r.builtinRemains ? 'Sprachanpassungen entfernt' : 'Sprache gelöscht', r.code);
  res.json({ ok: true, ...r, languages: i18n.list(), club: i18n.clubLang() });
});

admin.post('/logo', need('einstellungen'), express.raw({ type: () => true, limit: '3mb' }), (req, res) => {
  const r = checkLogo(req.body);
  if (r.error) return bad(res, r.error);
  setSetting('club_logo', r.data.toString('base64'));
  setSetting('club_logo_type', r.type);
  setSetting('club_logo_ver', String(Date.now()));
  db.prepare("DELETE FROM settings WHERE key IN ('club_icon','club_icon_ver')").run();   // App-Symbol wird aus dem neuen Logo neu erzeugt
  audit(req.user, 'Vereinslogo hochgeladen', r.type.toUpperCase() + ', ' + Math.round(r.data.length / 1024) + ' KB');
  res.json({ ok: true, logo: logoUrl(), type: r.type });
});
/* App-Symbol (PNG, quadratisch) für den Home-Bildschirm – iPhones nehmen dafür kein SVG. Der Browser der Verwaltung
   zeichnet es aus dem Vereinslogo und lädt es hier hoch. */
admin.post('/logo-icon', need('einstellungen'), express.raw({ type: () => true, limit: '1mb' }), (req, res) => {
  const b = req.body;
  if (!b || b.length < 100 || b.readUInt32BE(0) !== 0x89504e47) return bad(res, 'Kein PNG.');
  setSetting('club_icon', b.toString('base64'));
  setSetting('club_icon_ver', iconKey());
  res.json({ ok: true });
});
/* Logo als schlichtes PNG (vom Browser aus dem SVG gezeichnet) – für PDFs und E-Mails; gilt für genau diesen Logo-Stand */
admin.post('/logo-png', need('einstellungen'), express.raw({ type: () => true, limit: '2mb' }), (req, res) => {
  const b = req.body;
  if (!b || b.length < 100 || b.readUInt32BE(0) !== 0x89504e47) return bad(res, 'Kein PNG.');
  setSetting('club_logo_png', b.toString('base64'));
  setSetting('club_logo_png_ver', getSetting('club_logo_ver', 'std'));
  res.json({ ok: true });
});
admin.delete('/logo', need('einstellungen'), (req, res) => {
  db.prepare("DELETE FROM settings WHERE key IN ('club_logo','club_logo_type','club_logo_ver','club_icon','club_icon_ver','club_logo_png','club_logo_png_ver')").run();
  audit(req.user, 'Vereinslogo entfernt');
  res.json({ ok: true, logo: logoUrl() });
});
const ADDRESS_MIRROR = { club_street: ['ext_mitglieder_club_street', 'ext_buchhaltung_street'], club_city: ['ext_mitglieder_club_city', 'ext_buchhaltung_city'], club_phone: ['ext_buchhaltung_phone'], club_email: ['ext_buchhaltung_email'] };
const SETTINGS_LABELS = { club_name: 'Vereinsname', club_color: 'Vereinsfarbe', club_color2: 'Zweitfarbe', tablet_theme: 'Darstellung am Tablet' };
const TABLET_THEME_TXT = { auto: 'wie das Gerät', light: 'hell', dark: 'dunkel', hc: 'Hoher Kontrast' };
admin.put('/settings', need('einstellungen'), (req, res) => {
  const b = req.body || {};
  const look = () => ({ club_name: getSetting('club_name', ''), club_color: clubColor(), club_color2: clubColor2() || '', tablet_theme: TABLET_THEME_TXT[tabletTheme()] });
  const before = look();
  const name = cleanName(b.clubName);
  const color = String(b.clubColor || '').trim();
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) return bad(res, 'Farbe bitte als Hex-Wert, z. B. #1f6b3a.');
  const color2 = b.clubColor2 === undefined ? undefined : String(b.clubColor2 || '').trim();
  if (color2 && !/^#[0-9a-f]{6}$/i.test(color2)) return bad(res, 'Zweitfarbe bitte als Hex-Wert, z. B. #c0262d – oder leer lassen.');
  if (b.tabletTheme !== undefined && !TABLET_THEMES.includes(b.tabletTheme)) return bad(res, 'Unbekannte Darstellung.');
  if (name) setSetting('club_name', name);
  if (color) setSetting('club_color', color.toLowerCase());
  if (color2 !== undefined) setSetting('club_color2', color2.toLowerCase());
  if (b.tabletTheme !== undefined) setSetting('tablet_theme', b.tabletTheme);
  const addr = [];
  for (const [k, key, max] of [['clubStreet', 'club_street', 80], ['clubCity', 'club_city', 80], ['clubPhone', 'club_phone', 40], ['clubEmail', 'club_email', 120]]) {
    if (b[k] === undefined) continue;
    const v = String(b[k] || '').replace(/\s+/g, ' ').trim().slice(0, max);
    if (k === 'clubEmail' && v && !require('./mail').mailOk(v)) return bad(res, 'Bitte eine gültige E-Mail-Adresse für den Verein eintragen.');
    setSetting(key, v); addr.push(key);
    // Module, die ihre Angaben noch selbst führen (Mitglieder, Buchhaltung), lesen weiter ihre eigenen Schlüssel – sie bleiben gleich
    for (const old of ADDRESS_MIRROR[key]) setSetting(old, v);
  }
  if (b.topN !== undefined) { const n = int(b.topN, -1); if (n < 0 || n > 60) return bad(res, '„Ich bin öfter hier“: Anzahl 0–60 (0 = ausblenden).'); setSetting('top_n', String(n)); }
  if (b.topDays !== undefined) { const d = int(b.topDays, 0); if (d < 1 || d > 365) return bad(res, '„Ich bin öfter hier“: Zeitraum 1–365 Tage.'); setSetting('top_days', String(d)); }
  const detail = [auditDiff(SETTINGS_LABELS, before, look()), addr.length && 'Anschrift und Kontakt', b.topN !== undefined && `Öfter hier: ${b.topN} aus ${b.topDays} Tagen`].filter(Boolean).join(' · ');
  if (detail) audit(req.user, 'Einstellungen geändert', detail);
  res.json({ ok: true });
});
/* Empfänger der Bestell-Mail (Lieferant/Kopie) nur mit „Einstellungen“ ändern – sonst ließe sich über das Vereinspostfach
   an beliebige Adressen schreiben (Phishing im Namen des Vereins) */
const ORDER_MAIL_KEYS = ['order_email', 'order_cc'];
const orderMailChange = (req, b) => !req.user.perms.includes('einstellungen') && ORDER_MAIL_KEYS.some(k => b[k] !== undefined && String(b[k]).trim().toLowerCase() !== getSetting(k, '').trim().toLowerCase());
admin.put('/settings/order', need('bestellung'), (req, res) => {
  const b = req.body || {};
  if (orderMailChange(req, b)) return bad(res, 'Die E-Mail-Adresse des Lieferanten darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
  // Adressen schon beim Speichern prüfen (leer ist erlaubt) – nicht erst beim Senden
  for (const k of ORDER_MAIL_KEYS) if (b[k] !== undefined && String(b[k]).trim() && !mail.mailOk(String(b[k]).trim())) return bad(res, k === 'order_email' ? 'Die E-Mail-Adresse des Lieferanten sieht nicht gültig aus.' : 'Die Adresse bei „Kopie an“ sieht nicht gültig aus.');
  for (const k of Object.keys(ORDER_KEYS)) if (b[k] !== undefined) setSetting(k, String(b[k]).trim().slice(0, 200));
  res.json({ ok: true });
});
/* Bestellung direkt über das Vereinspostfach senden */
admin.post('/order/send', need('bestellung'), rateLimit('ordermail', 10, 10 * 60000), async (req, res) => {
  const b = req.body || {};
  const to = String(b.to || '').trim(), cc = String(b.cc || '').trim();
  const subject = String(b.subject || '').trim().slice(0, 200), text = String(b.text || '').slice(0, 20000);
  if (!mail.ready()) return bad(res, 'Noch kein Postfach eingerichtet – Einstellungen → Postfach.');
  if (!mail.mailOk(to)) return bad(res, 'Bitte bei „An“ eine gültige E-Mail-Adresse des Lieferanten eintragen.');
  if (cc && !mail.mailOk(cc)) return bad(res, 'Bitte bei „Kopie an“ eine gültige E-Mail-Adresse eintragen (oder leer lassen).');
  if (!subject || !text.trim()) return bad(res, 'Betreff und Text dürfen nicht leer sein.');
  if (orderMailChange(req, { order_email: to, order_cc: cc })) return bad(res, 'Bestellungen gehen nur an die gespeicherte Adresse des Lieferanten. Eine neue Adresse trägt ein Admin mit dem Recht „Einstellungen“ ein.', 403);
  try {
    await mail.send({ to, cc, subject, text });
    setSetting('order_email', to); setSetting('order_cc', cc);
    setSetting('order_last_sent', `${nowTs()} · ${to}`);
    audit(req.user, 'Bestellung gesendet', `an ${to}${cc ? ', Kopie ' + cc : ''} · ${subject}`);
    res.json({ ok: true, to, cc, at: nowTs() });
  } catch (e) { bad(res, 'Senden fehlgeschlagen: ' + e.message, 502); }
});

/* ---------- Zentraler E-Mail-Versand ---------- */
admin.get('/mail', need('einstellungen'), (req, res) => res.json(mail.publicConfig()));
admin.put('/mail', need('einstellungen'), (req, res) => {
  try { const d = mail.save(req.body || {}); audit(req.user, 'Postfach geändert', d); res.json({ ok: true, ...mail.publicConfig() }); }
  catch (e) { bad(res, e.message); }
});
admin.post('/mail/test', need('einstellungen'), rateLimit('mailtest', 6, 10 * 60000), async (req, res) => {
  const to = String((req.body || {}).to || '').trim();
  try {
    await mail.send({ to, subject: `Test – ${getSetting('club_name', 'Verein')}`, text: 'Diese Testnachricht kommt von Clubwerk. Der E-Mail-Versand funktioniert.' });
    res.json({ ok: true });
  } catch (e) { bad(res, 'Test fehlgeschlagen: ' + e.message, 502); }
});

/* ---------- Mitglieder ---------- */
const KINDS = ['mitglied', 'nichtmitglied', 'mannschaft', 'verein', 'gast'];

admin.get('/members', need('konten', 'buchungen', 'abrechnung', 'export', 'veranstaltungen', 'uebernahme'), (req, res) => {
  const { from, to } = defaultRange(req.query);
  const rows = db.prepare(`SELECT m.id, m.name, m.kind, m.active, m.pending, m.created_at, m.pin_hash IS NOT NULL AS hasPin,
      m.pin_changed_at, m.pin_changed_by, m.locked_until > strftime('%Y-%m-%dT%H:%M:%fZ','now') AS pinLocked,
      MAX(COALESCE((SELECT MAX(created_at) FROM bookings b WHERE b.member_id = m.id AND b.cancelled_at IS NULL), ''),
          COALESCE((SELECT MAX(created_at) FROM event_guests g WHERE g.member_id = m.id), '')) AS last_seen,
      COALESCE((SELECT SUM(total_cents) FROM bookings b WHERE b.member_id = m.id AND b.kind = 'konto'
        AND b.cancelled_at IS NULL AND b.settled_id IS NULL), 0) AS balance_cents,
      (SELECT COUNT(*) FROM bookings b WHERE b.member_id = m.id AND b.cancelled_at IS NULL) AS bookings
    FROM members m WHERE m.deleted = 0 AND m.kind != 'extern' ORDER BY m.pending DESC, m.active DESC,
      CASE m.kind WHEN 'mitglied' THEN 1 WHEN 'nichtmitglied' THEN 2 WHEN 'mannschaft' THEN 3 WHEN 'verein' THEN 4 ELSE 5 END, name_key(m.name, m.kind)`).all();
  res.json({ from, to, seasonStart: seasonStart(), rows: rows.map(r => ({ ...r, last_seen: r.last_seen || null, hasPin: Boolean(r.hasPin), pinLocked: Boolean(r.pinLocked),
    active: Boolean(r.active), pending: Boolean(r.pending), eventOpen_cents: eventOpen(r.id) })) });
});

/* Am Tablet angelegtes Mitglied bestätigen (optional mit korrigiertem Namen) */
admin.post('/members/:id/confirm', need('konten'), (req, res) => {
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(int(req.params.id));
  if (!m) return bad(res, 'Nicht gefunden.', 404);
  const name = cleanName((req.body || {}).name || m.name);
  if (!name) return bad(res, 'Name fehlt.');
  const clash = db.prepare("SELECT id FROM members WHERE lower(name) = lower(?) AND id != ? AND deleted = 0 AND kind != 'extern'").get(name, m.id);
  if (clash) return bad(res, 'Diesen Namen gibt es schon. Bitte stattdessen „Zusammenführen“ wählen.');
  // mit Mitgliederverwaltung: als „Kein Mitglied“ bestätigen – oder mit einem Mitglied aus der Mitgliederverwaltung zusammenführen
  const kind = (req.body || {}).kind === 'nichtmitglied' ? 'nichtmitglied' : 'mitglied';
  if (kind === 'mitglied' && mvActive()) return bad(res, `${NEED_MV} Wer schon Mitglied ist: „Ist schon Mitglied …“ wählen.`);
  db.prepare('UPDATE members SET name = ?, kind = ?, pending = 0 WHERE id = ?').run(name, kind, m.id);
  audit(req.user, kind === 'nichtmitglied' ? 'Neues Konto bestätigt (Kein Mitglied)' : 'Neues Mitglied bestätigt', m.name === name ? name : `${m.name} → ${name}`);
  res.json({ ok: true });
});

/* Doppelt angelegtes Mitglied: Buchungen (und alles, was Module zu diesem Konto gespeichert haben) auf das richtige Konto
   verschieben, Duplikat löschen. Nur zwischen echten Mitglieds-/Mannschaftskonten, die nicht gelöscht sind. */
admin.post('/members/:id/merge', need('konten'), (req, res) => {
  const live = db.prepare("SELECT * FROM members WHERE id = ? AND deleted = 0 AND kind IN ('mitglied','nichtmitglied','mannschaft')");
  const from = live.get(int(req.params.id));
  const into = live.get(int((req.body || {}).intoId));
  if (!from || !into || from.id === into.id) return bad(res, 'Bitte das richtige Zielkonto wählen (ein Mitglied oder eine Mannschaft, nicht gelöscht).');
  let moved = 0;
  const err = memberTx(() => {
    moved = db.prepare('UPDATE bookings SET member_id = ? WHERE member_id = ?').run(into.id, from.id).changes;
    // Einträge auf Veranstaltungslisten mitnehmen; steht das Zielkonto dort schon, werden beide Einträge vereint
    for (const g of db.prepare('SELECT * FROM event_guests WHERE member_id = ?').all(from.id)) {
      const dup = db.prepare('SELECT id FROM event_guests WHERE event_id = ? AND member_id = ?').get(g.event_id, into.id);
      if (dup) {
        db.prepare('UPDATE bookings SET event_guest_id = ? WHERE event_guest_id = ?').run(dup.id, g.id);
        db.prepare('UPDATE event_payments SET guest_id = ? WHERE guest_id = ?').run(dup.id, g.id);
        db.prepare('DELETE FROM event_guests WHERE id = ?').run(g.id);
      } else db.prepare('UPDATE event_guests SET member_id = ?, name = ? WHERE id = ?').run(into.id, into.name, g.id);
    }
    dropMemberExtras(from.id, into.id);
    db.prepare('DELETE FROM members WHERE id = ?').run(from.id);
  });
  if (err) return bad(res, 'Zusammenführen nicht möglich: ' + err);
  audit(req.user, 'Konten zusammengeführt', `${from.name} → ${into.name} (${moved} Buchungen)`);
  res.json({ ok: true, moved });
});

/* Konto löschen: ohne Buchungen endgültig; mit früheren Buchungen verschwindet es aus allen Listen und vom Tablet,
   die alten Buchungen bleiben (Bestand, frühere Abrechnungen). Offene Beträge müssen vorher abgerechnet sein. */
// Löschen dürfen „Konten“ (Verkauf) und „Mitglieder“ mit vollem Recht – nicht Abteilungsleitungen, die nur ihre Abteilung sehen
admin.delete('/members/:id', need('konten', 'mitglieder'), (req, res) => {
  if (!req.user.perms.includes('konten') && (req.user.deptOnly || []).includes('mitglieder')) return bad(res, 'Löschen dürfen nur Benutzer mit vollem Recht „Mitglieder“.', 403);
  const m = db.prepare('SELECT * FROM members WHERE id = ? AND deleted = 0').get(int(req.params.id));
  if (!m) return res.json({ ok: true });
  if (m.kind === 'verein' || m.kind === 'gast') return bad(res, 'Die Sonderkonten „Verein“ und „Gast“ können nicht gelöscht werden – bei Bedarf ausblenden.');
  const links = memberLinks(m.id);
  if (links.length) return res.status(409).json({ error: `${lastFirst(m.name, m.kind)} kann noch nicht gelöscht werden:\n• ${links.join('\n• ')}`, links });
  let kept = false;
  const err = memberTx(() => {
    db.prepare('UPDATE event_guests SET member_id = NULL WHERE member_id = ?').run(m.id);   // bleibt als freier Name stehen
    dropMemberExtras(m.id);   // Module (Mitgliederverwaltung, Buchungen, Helferstunden …) und gekoppelte Geräte räumen auf
    kept = removeMemberRow(m.id);
  });
  if (err) return bad(res, 'Löschen nicht möglich: ' + err);
  audit(req.user, 'Konto gelöscht', m.name + (kept ? ' (frühere Buchungen und Zahlungen bleiben erhalten)' : ''));
  res.json({ ok: true, kept });
});

admin.post('/members', need('konten'), (req, res) => {
  const name = cleanName((req.body || {}).name);
  const kind = (req.body || {}).kind || 'mitglied';
  if (!name) return bad(res, 'Name fehlt.');
  if (!KINDS.includes(kind)) return bad(res, 'Unbekannter Kontotyp.');
  if (kind === 'mitglied' && mvActive()) return bad(res, NEED_MV);
  if ((kind === 'verein' || kind === 'gast') && !req.user.perms.includes('einstellungen')) return bad(res, 'Konten der Art „Verein“ oder „Gast“ darf nur anlegen, wer das Recht „Einstellungen“ hat.', 403);
  if (db.prepare("SELECT 1 FROM members WHERE lower(name) = lower(?) AND deleted = 0 AND kind != 'extern'").get(name)) return bad(res, 'Diesen Namen gibt es schon.');
  const pin = String((req.body || {}).pin || '');
  if (kind === 'mannschaft' && !validPin(pin)) return bad(res, 'Mannschaftskonten brauchen eine PIN (4 bis 6 Ziffern), die der Vorstand vergibt.');
  const r = db.prepare(`INSERT INTO members(name, kind, pin_hash, pin_changed_at, pin_changed_by) VALUES (?,?,?,?,?)`)
    .run(name, kind, kind === 'mannschaft' ? auth.hashSecret(pin) : null, kind === 'mannschaft' ? nowTs() : null, kind === 'mannschaft' ? req.user.username : null);
  audit(req.user, 'Konto angelegt', `${name} (${kind})`);
  res.json({ id: Number(r.lastInsertRowid) });
});

admin.put('/members/:id', need('konten'), (req, res) => {
  const m = db.prepare('SELECT * FROM members WHERE id = ? AND deleted = 0').get(int(req.params.id));   // gelöschte Konten lassen sich nicht „wiederbeleben“
  if (!m) return bad(res, 'Nicht gefunden.', 404);
  const b = req.body || {};
  const name = b.name !== undefined ? cleanName(b.name) : m.name;
  const kind = b.kind !== undefined ? b.kind : m.kind;
  // Art „Verein“ bucht kostenlos – Wechsel von/zu Verein oder Gast nur mit „Einstellungen“ (sonst könnte man sich freie Getränke schalten)
  if (kind !== m.kind && ['verein', 'gast'].some(k => k === kind || k === m.kind) && !req.user.perms.includes('einstellungen'))
    return bad(res, 'Die Art „Verein“ oder „Gast“ darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
  if (!name) return bad(res, 'Name fehlt.');
  if (!KINDS.includes(kind)) return bad(res, 'Unbekannter Kontotyp.');
  if (kind !== m.kind && kind === 'mitglied' && mvActive()) return bad(res, `${NEED_MV} Ein vorhandenes Konto danach mit „Zusammenführen“ auf das neue Mitglied übertragen.`);
  if (kind !== m.kind && m.kind === 'mitglied') {   // Mitgliedsdaten, Beiträge, Mannschaften … würden sonst an einem Nicht-Mitglied hängen
    const links = [...moduleLinks(m.id), ...plugins.withHook('memberKindLock').flatMap(p => { try { return (p.hooks.memberKindLock(m.id) || []).map(t => `${t} (${p.meta.name})`); } catch (e) { return [`${p.meta.name}: Prüfung fehlgeschlagen`]; } })];
    if (links.length) return bad(res, `${lastFirst(m.name, m.kind)} ist noch als Mitglied verknüpft und kann nicht umgewandelt werden:\n• ${links.join('\n• ')}`);
  }
  const active = b.active !== undefined ? (b.active ? 1 : 0) : m.active;
  const pin = b.pin ? String(b.pin) : '';
  if (pin && kind !== 'mannschaft') return bad(res, 'Eine PIN legen Mitglieder am Tablet selbst fest.');
  if (pin && !validPin(pin)) return bad(res, 'Die PIN muss 4 bis 6 Ziffern haben.');
  if (kind === 'mannschaft' && !pin && !m.pin_hash) return bad(res, 'Mannschaftskonten brauchen eine PIN (4 bis 6 Ziffern).');
  db.prepare('UPDATE members SET name = ?, kind = ?, active = ? WHERE id = ?').run(name, kind, active, m.id);
  if (kind !== m.kind) { audit(req.user, 'Kontoart geändert', `${name}: ${m.kind} → ${kind}`); if (kind === 'verein') securityAlert(`Das Konto „${name}“ wurde von ${req.user.name || req.user.username} auf „Verein (kostenfrei)“ umgestellt. Buchungen darauf kosten nichts.`, 'verein-' + m.id); }
  if (pin) db.prepare(`UPDATE members SET pin_hash = ?, failed_pins = 0, pin_strikes = 0, locked_until = NULL, pin_changed_at = datetime('now','localtime'), pin_changed_by = ? WHERE id = ?`)
    .run(auth.hashSecret(pin), req.user.username, m.id);
  audit(req.user, 'Konto geändert', `${m.name}${name !== m.name ? ' → ' + name : ''}${active ? '' : ', ausgeblendet'}${pin ? ', PIN neu vergeben' : ''}`);
  res.json({ ok: true });
});

admin.post('/members/:id/reset-pin', need('konten', 'mitglieder'), (req, res) => {
  if (!auth.memberAllowed(req.user, int(req.params.id))) return bad(res, 'Als Abteilungsadmin kannst du nur Mitglieder deiner Abteilung(en) bearbeiten.', 403);
  const m = db.prepare('SELECT name FROM members WHERE id = ?').get(int(req.params.id));
  db.prepare(`UPDATE members SET pin_hash = NULL, failed_pins = 0, pin_strikes = 0, locked_until = NULL,
      pin_changed_at = datetime('now','localtime'), pin_changed_by = ? WHERE id = ?`).run(req.user.username, int(req.params.id));
  audit(req.user, 'PIN zurückgesetzt', m && m.name);
  res.json({ ok: true });
});

admin.post('/members/import', need('konten'), (req, res) => {
  const text = String((req.body || {}).text || '');
  const kind = KINDS.includes((req.body || {}).kind) ? req.body.kind : 'mitglied';
  if (kind === 'mitglied' && mvActive()) return bad(res, NEED_MV);
  const existing = new Set(db.prepare("SELECT lower(name) n FROM members WHERE deleted = 0 AND kind != 'extern'").all().map(r => r.n));
  const ins = db.prepare('INSERT INTO members(name, kind) VALUES (?,?)');
  let added = 0, skipped = 0;
  db.transaction(() => {
    for (const line of text.split(/\r?\n/)) {
      const name = cleanName(line.replace(/[;\t]+/g, ' '));
      if (!name) continue;
      if (existing.has(name.toLowerCase())) { skipped++; continue; }
      ins.run(name.slice(0, 80), kind); existing.add(name.toLowerCase()); added++;
    }
  })();
  res.json({ added, skipped });
});

/* Saison = Kalenderjahr (wie „Ganze Saison“ in der Verwaltung) */
const seasonStart = () => today().slice(0, 4) + '-01-01';

/* Mitglieder, die diese Saison nicht da waren, entfernen:
   ohne jede Buchung → löschen, mit früheren Buchungen → ausblenden (Abrechnungen bleiben nachvollziehbar).
   Wer noch etwas offen hat, wird übersprungen. */
admin.post('/members/remove-inactive', need('konten'), (req, res) => {
  const ids = Array.isArray((req.body || {}).ids) ? [...new Set(req.body.ids.map(int))].filter(Boolean) : [];
  if (!ids.length) return bad(res, 'Kein Mitglied gewählt.');
  const since = seasonStart();
  let deleted = 0, hidden = 0; const skipped = [];
  const err = memberTx(() => {
    for (const id of ids) {
      const m = db.prepare("SELECT * FROM members WHERE id = ? AND kind IN ('mitglied','nichtmitglied') AND deleted = 0").get(id);
      if (!m) continue;
      const seen = db.prepare(`SELECT (SELECT COUNT(*) FROM bookings WHERE member_id = ? AND cancelled_at IS NULL AND date(created_at) >= ?)
        + (SELECT COUNT(*) FROM event_guests WHERE member_id = ? AND date(created_at) >= ?) n`).get(id, since, id, since).n;
      if (seen) { skipped.push(m.name + ' (war diese Saison da)'); continue; }
      if (memberLinks(id).length) { skipped.push(m.name + ' (noch verknüpft)'); continue; }
      const any = db.prepare('SELECT COUNT(*) n FROM bookings WHERE member_id = ?').get(id).n
        + db.prepare('SELECT COUNT(*) n FROM member_settlements WHERE member_id = ?').get(id).n
        + db.prepare('SELECT COUNT(*) n FROM guest_tabs WHERE member_id = ?').get(id).n;
      if (!any) {
        db.prepare('UPDATE event_guests SET member_id = NULL WHERE member_id = ?').run(id);
        dropMemberExtras(id);
        removeMemberRow(id); deleted++;
      } else { db.prepare('UPDATE members SET active = 0 WHERE id = ?').run(id); hidden++; }
    }
  });
  if (err) return bad(res, 'Entfernen nicht möglich: ' + err);
  audit(req.user, 'Inaktive Mitglieder entfernt', `${deleted} gelöscht, ${hidden} ausgeblendet${skipped.length ? ', übersprungen: ' + skipped.join(', ') : ''}`.slice(0, 500));
  res.json({ ok: true, deleted, hidden, skipped });
});

/* Mitgliederliste als Excel (Spalten „Vorname“ und „Nachname“): erst Vorschau, dann mit commit=1 anlegen */
async function readMemberExcel(buf) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  if (!buf || buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error('Bitte eine Excel-Datei (.xlsx) hochladen. Alte .xls-Dateien vorher in Excel als .xlsx speichern.');
  try { await wb.xlsx.load(buf); } catch (e) { throw new Error('Die Excel-Datei lässt sich nicht lesen.'); }
  const norm = v => String(v || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
  const txt = c => { try { return cleanName(c.text, 40); } catch (e) { return ''; } };
  // Überschriften auch in den anderen Sprachen erkennen (Vorlage aus einer englischen Verwaltung usw.)
  const H = { typ: i18n.aliases(['typ', 'kontotyp', 'art', 'konto'], norm), pin: i18n.aliases(['pin', 'pincode', 'mannschaftspin'], norm),
    vn: i18n.aliases(['vorname', 'vornamen', 'rufname', 'firstname'], norm), nn: i18n.aliases(['nachname', 'familienname', 'name', 'zuname', 'lastname'], norm) };
  const teamWords = new RegExp(['mannschaft', 'team', 'gruppe', ...i18n.aliases(['mannschaft'], norm)].map(w => w.replace(/[^a-z0-9äöüß]/g, '')).filter(Boolean).join('|'));
  for (const ws of wb.worksheets) {
    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      let vn = 0, nn = 0, tc = 0, pc = 0;
      ws.getRow(r).eachCell((c, col) => {
        const h = norm(c.text);
        if (!tc && H.typ.includes(h)) tc = col;
        if (!pc && H.pin.includes(h)) pc = col;
        if (!vn && H.vn.includes(h)) vn = col;
        if (!nn && H.nn.includes(h)) nn = col;
      });
      if (!vn || !nn) continue;
      const out = [];
      for (let i = r + 1; i <= ws.rowCount && out.length < 3000; i++) {
        const row = ws.getRow(i);
        const v = txt(row.getCell(vn)), n = txt(row.getCell(nn));
        if (!v && !n) continue;
        const t = tc ? norm(txt(row.getCell(tc))) : '';
        const pin = pc ? String(row.getCell(pc).text || '').replace(/\D/g, '') : '';
        out.push({ line: i, first: v, last: n, kind: teamWords.test(t) ? 'mannschaft' : /kein|nicht|trainer/.test(t) ? 'nichtmitglied' : 'mitglied', pin });
      }
      return { sheet: ws.name, rows: out };
    }
  }
  throw new Error('Keine Überschriften „Vorname“ und „Nachname“ gefunden. Bitte die erste Zeile so beschriften (Vorlage herunterladen).');
}

admin.post('/members/import-excel', need('konten'), express.raw({ type: () => true, limit: '5mb' }), asyncRoute(async (req, res) => {
  let data;
  try { data = await readMemberExcel(req.body); } catch (e) { return bad(res, e.message); }
  const existing = new Map(db.prepare("SELECT lower(name) n, active FROM members WHERE deleted = 0 AND kind != 'extern'").all().map(r => [r.n, r.active]));
  const seen = new Set();
  const rows = data.rows.map(r => {
    const team = r.kind === 'mannschaft';
    const name = cleanName(`${r.first} ${r.last}`, 80);
    let status = 'neu';
    if (team ? name.length < 2 : (!r.first || !r.last || name.length < 4)) status = 'unvollständig';
    else if (!team && /[0-9@]/.test(name)) status = 'ungültig';
    else if (existing.has(name.toLowerCase())) status = existing.get(name.toLowerCase()) ? 'vorhanden' : 'ausgeblendet';
    else if (seen.has(name.toLowerCase())) status = 'doppelt';
    else if (r.kind === 'mitglied' && mvActive()) status = 'Mitglied: bitte in der Mitgliederverwaltung anlegen';
    seen.add(name.toLowerCase());
    const pinOk = !team || validPin(r.pin);
    return { line: r.line, name, status, kind: r.kind, first: cleanName(r.first, 40), last: cleanName(r.last, 40), pin: team ? r.pin : '', pinMissing: !pinOk };
  });
  const neu = rows.filter(r => r.status === 'neu');
  if (req.query.commit === '1') {
    const ins = db.prepare('INSERT INTO members(name, kind, first_name, last_name, pin_hash, pin_changed_at, pin_changed_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
    db.transaction(() => neu.forEach(r => {
      const team = r.kind === 'mannschaft', pin = team && !r.pinMissing ? auth.hashSecret(r.pin) : null;
      ins.run(r.name, r.kind, team ? null : r.first, team ? null : r.last, pin, pin ? nowTs() : null, pin ? req.user.username : null);
    }))();
    audit(req.user, 'Mitglieder aus Excel importiert', `${neu.length} neu, ${rows.length - neu.length} übersprungen`);
  }
  res.json({ sheet: data.sheet, rows: rows.map(({ pin, ...r }) => r), added: req.query.commit === '1' ? neu.length : 0, newCount: neu.length });
}));

admin.get('/members/import-vorlage.xlsx', need('konten'), asyncRoute(async (req, res) => {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mitglieder');
  ws.columns = [{ header: 'Vorname', key: 'v', width: 22 }, { header: 'Nachname', key: 'n', width: 26 }, { header: 'Typ', key: 't', width: 16 }, { header: 'PIN', key: 'p', width: 10 }];
  ws.getRow(1).font = { bold: true };
  ws.addRow({ v: 'Max', n: 'Mustermann', t: 'Mitglied' });
  ws.addRow({ v: 'Erika', n: 'Musterfrau', t: 'Kein Mitglied' });
  ws.addRow({ v: '', n: 'Herren 1', t: 'Mannschaft', p: '4711' });
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="Mitglieder_Vorlage.xlsx"' });
  await wb.xlsx.write(res);
  res.end();
}));

/* ---------- Artikel ---------- */
function articleFromBody(b, base = {}) {
  const a = {
    name: b.name !== undefined ? cleanName(b.name) : base.name,
    category: b.category !== undefined ? String(b.category).trim().slice(0, 40) || 'Sonstiges' : base.category,
    price_cents: b.price_cents !== undefined ? int(b.price_cents, -1) : base.price_cents,
    crate_size: b.crate_size !== undefined ? int(b.crate_size, 1) : base.crate_size,
    min_stock: b.min_stock !== undefined ? int(b.min_stock, 0) : base.min_stock,
    target_stock: b.target_stock !== undefined ? int(b.target_stock, 0) : (base.target_stock || 0),
    track_stock: b.track_stock !== undefined ? (b.track_stock ? 1 : 0) : base.track_stock,
    active: b.active !== undefined ? (b.active ? 1 : 0) : base.active,
    sort: b.sort !== undefined ? int(b.sort, 100) : base.sort,
    icon: b.icon !== undefined ? (b.icon && artIcons.has(String(b.icon)) ? String(b.icon) : null) : (base.icon === undefined ? null : base.icon),
  };
  if (!a.name) throw new Error('Name fehlt.');
  if (!(a.price_cents >= 0)) throw new Error('Preis ungültig.');
  if (!(a.crate_size >= 1 && a.crate_size <= 100)) throw new Error('Gebindegröße bitte zwischen 1 und 100.');
  if (a.price_cents > 100000) throw new Error('Preis ungültig.');
  return a;
}

admin.get('/articles', (req, res) => res.json(stockList()));

/* Artikelliste als Excel: herunterladen, bearbeiten, wieder einspielen (auch zum Übernehmen von einem anderen Verein) */
const ART_COLS = ['ID', 'Artikel', 'Kategorie', 'Preis', 'Gebinde', 'Bestand führen', 'Mindestbestand', 'Bestellen bis', 'Aktiv'];
admin.get('/articles/export.xlsx', need('artikel'), asyncRoute(async (req, res) => {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Artikel');
  ws.columns = ART_COLS.map((h, i) => ({ header: h, width: [8, 34, 16, 10, 8, 15, 15, 14, 8][i] }));
  ws.getRow(1).font = { bold: true };
  for (const a of db.prepare('SELECT * FROM articles WHERE custom = 0 AND deleted = 0 ORDER BY cat_rank(category), de_key(category), de_key(name)').all()) {
    ws.addRow([a.id, a.name, a.category, a.price_cents / 100, a.crate_size, a.track_stock ? 'ja' : 'nein', a.min_stock, a.target_stock, a.active ? 'ja' : 'nein']);
  }
  ws.getColumn(4).numFmt = '#,##0.00 "€"';
  ws.getColumn(1).font = { color: { argb: 'FF8B958F' } };
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="Artikel.xlsx"' });
  await wb.xlsx.write(res); res.end();
}));
admin.post('/articles/import-excel', need('artikel'), express.raw({ type: () => true, limit: '5mb' }), asyncRoute(async (req, res) => {
  const ExcelJS = require('exceljs');
  const buf = req.body;
  if (!buf || buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) return bad(res, 'Bitte eine Excel-Datei (.xlsx) hochladen.');
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); } catch (e) { return bad(res, 'Die Excel-Datei lässt sich nicht lesen.'); }
  const norm = v => String(v || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
  const want = { id: ['id', 'artikelid'], name: ['artikel', 'name', 'bezeichnung', 'produkt'], cat: ['spalte', 'kategorie', 'gruppe'], price: ['preis', 'vkpreis', 'verkaufspreis'],
    crate: ['gebinde', 'gebindegröße', 'kiste', 'kistengröße', 'flaschenjekiste'], track: ['bestandführen', 'bestand'], min: ['mindestbestand', 'mindest'],
    target: ['bestellenbis'], active: ['aktiv'] };
  for (const k of Object.keys(want)) want[k] = i18n.aliases(want[k], norm);
  let cols = null, ws = null, head = 0;
  for (const w of wb.worksheets) {
    for (let r = 1; r <= Math.min(w.rowCount, 10) && !cols; r++) {
      const c = {};
      w.getRow(r).eachCell((cell, col) => { const h = norm(cell.text); for (const [k, list] of Object.entries(want)) if (!c[k] && list.includes(h)) c[k] = col; });
      if (c.name && c.price) { cols = c; ws = w; head = r; }
    }
    if (cols) break;
  }
  if (!cols) return bad(res, 'Keine Überschriften „Artikel“ und „Preis“ gefunden. Am einfachsten die Artikelliste als Excel herunterladen und als Vorlage nehmen.');
  const txt = (row, k) => (cols[k] ? String(row.getCell(cols[k]).text || '').trim() : '');
  const num = s => { if (String(s).trim() === '') return NaN; const n = Number(String(s).replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const NO = new Set(['nein', 'n', '0', 'false', 'no', ...i18n.aliases(['nein'], v => String(v).toLowerCase().trim())]);
  const yes = (s, d) => (s === '' ? d : !NO.has(String(s).toLowerCase().trim()));
  // Abgleich: zuerst über die ID (nur Artikel, die es hier gibt), sonst über den Namen. Gelöschte Artikel werden nie wiederbelebt –
  // ein gleichnamiger neuer Artikel bekommt eine neue ID. IDs aus der Datei, die es hier nicht gibt, werden nie übernommen.
  const live = db.prepare('SELECT * FROM articles WHERE custom = 0 AND deleted = 0').all();
  const byId = new Map(live.map(a => [a.id, a])), byName = new Map(live.map(a => [a.name.toLowerCase(), a]));
  const FIELDS = ['name', 'category', 'price_cents', 'crate_size', 'track_stock', 'min_stock', 'target_stock', 'active'];
  const rows = []; const seenName = new Set(), seenId = new Set();
  for (let i = head + 1; i <= ws.rowCount && rows.length < 500; i++) {
    const row = ws.getRow(i); const name = cleanName(txt(row, 'name'), 60);
    if (!name) continue;
    const price = num(txt(row, 'price'));
    const fileId = /^\d{1,9}$/.test(txt(row, 'id')) ? Number(txt(row, 'id')) : null;
    const a = { name, category: (txt(row, 'cat') || 'Sonstiges').slice(0, 40), price_cents: Math.round(price * 100),
      crate_size: Math.max(1, Math.min(100, int(txt(row, 'crate'), 1))), track_stock: yes(txt(row, 'track'), true) ? 1 : 0,
      min_stock: Math.max(0, int(txt(row, 'min'), 0)), target_stock: Math.max(0, int(txt(row, 'target'), 0)), active: yes(txt(row, 'active'), true) ? 1 : 0 };
    const e = (fileId && byId.get(fileId)) || byName.get(name.toLowerCase()) || null;
    let status = 'neu', match = null;
    if (!Number.isFinite(price) || price < 0 || price > 1000) status = 'Preis ungültig';
    else if ((e && seenId.has(e.id)) || seenName.has(name.toLowerCase())) status = 'doppelt';
    else if (e) {
      // Name gleich, aber andere ID in der Datei → trotzdem derselbe Artikel (Name ist hier eindeutig)
      const diff = FIELDS.filter(k => e[k] !== a[k]);
      status = diff.length ? 'ändern' : 'unverändert';
      match = fileId === e.id ? 'id' : 'name';
      a.id = e.id;
      if (diff.length) a.current = Object.fromEntries(FIELDS.map(k => [k, e[k]]));
      a.diff = diff;
      // Umbenennen auf einen Namen, den schon ein anderer Artikel trägt, geht nicht
      if (diff.includes('name')) { const o = byName.get(name.toLowerCase()); if (o && o.id !== e.id) { status = 'Name schon vergeben'; } }
      seenId.add(e.id);
    }
    seenName.add(name.toLowerCase());
    rows.push({ line: i, status, match, fileId, ...a });
  }
  const inFile = new Set(rows.filter(r => r.id).map(r => r.id));
  const others = live.filter(a => a.active && !inFile.has(a.id));
  // Entscheidung je Artikel: „take“ = IDs, bei denen die Werte aus der Datei übernommen werden; alle anderen behalten den Bestand
  const take = new Set(String(req.query.take || '').split(',').filter(x => /^\d+$/.test(x)).map(Number));
  if (req.query.commit === '1') {
    if (req.query.hideOthers === '1') { const h = db.prepare('UPDATE articles SET active = 0 WHERE id = ?'); db.transaction(() => others.forEach(a => h.run(a.id)))(); }
    const ins = db.prepare('INSERT INTO articles(name, category, price_cents, crate_size, track_stock, min_stock, target_stock, active, sort, icon) VALUES (?,?,?,?,?,?,?,?,?,?)');
    const upd = db.prepare('UPDATE articles SET name = ?, category = ?, price_cents = ?, crate_size = ?, track_stock = ?, min_stock = ?, target_stock = ?, active = ? WHERE id = ?');
    const setSort = db.prepare('UPDATE articles SET sort = ? WHERE id = ?');
    // Reihenfolge der Datei = Reihenfolge am Tablet
    db.transaction(() => rows.forEach((r, i) => {
      const sort = (i + 1) * 10;
      if (r.status === 'neu') ins.run(r.name, r.category, r.price_cents, r.crate_size, r.track_stock, r.min_stock, r.target_stock, r.active, sort, artIcons.guess(r.name, r.category));
      if (r.status === 'ändern' && take.has(r.id)) upd.run(r.name, r.category, r.price_cents, r.crate_size, r.track_stock, r.min_stock, r.target_stock, r.active, r.id);
      if (r.id && ((r.status === 'ändern' && take.has(r.id)) || r.status === 'unverändert')) setSort.run(sort, r.id);
    }))();
    const taken = rows.filter(r => r.status === 'ändern' && take.has(r.id));
    audit(req.user, 'Artikel aus Excel importiert', `${rows.filter(r => r.status === 'neu').length} neu, ${taken.length} aus der Datei übernommen, ${rows.filter(r => r.status === 'ändern').length - taken.length} unverändert gelassen`);
  }
  res.json({ rows, newCount: rows.filter(r => r.status === 'neu').length, changeCount: rows.filter(r => r.status === 'ändern').length,
    takenCount: req.query.commit === '1' ? rows.filter(r => r.status === 'ändern' && take.has(r.id)).length : undefined, others: others.map(a => a.name) });
}));

admin.post('/articles', need('artikel'), (req, res) => {
  let a;
  try { a = articleFromBody(req.body || {}, { category: 'Sonstiges', price_cents: 0, crate_size: 1, min_stock: 0, track_stock: 1, active: 1, sort: 100 }); }
  catch (e) { return bad(res, e.message); }
  if ((req.body || {}).icon === undefined) a.icon = artIcons.guess(a.name, a.category);
  const r = db.prepare(`INSERT INTO articles(name, category, price_cents, crate_size, min_stock, target_stock, track_stock, active, sort, icon)
    VALUES (@name,@category,@price_cents,@crate_size,@min_stock,@target_stock,@track_stock,@active,@sort,@icon)`).run(a);
  audit(req.user, 'Artikel angelegt', `${a.name} ${euro(a.price_cents)}`);
  res.json({ id: Number(r.lastInsertRowid) });
});

admin.put('/articles/:id', need('artikel'), (req, res) => {
  const base = db.prepare('SELECT * FROM articles WHERE id = ? AND deleted = 0').get(int(req.params.id));   // gelöschte Artikel bleiben gelöscht
  if (!base || base.custom) return bad(res, 'Nicht gefunden.', 404);
  let a;
  try { a = articleFromBody(req.body || {}, base); } catch (e) { return bad(res, e.message); }
  db.prepare(`UPDATE articles SET name=@name, category=@category, price_cents=@price_cents, crate_size=@crate_size,
    min_stock=@min_stock, target_stock=@target_stock, track_stock=@track_stock, active=@active, sort=@sort, icon=@icon WHERE id=@id`).run({ ...a, id: base.id });
  if (base.price_cents !== a.price_cents || base.name !== a.name || base.active !== a.active) {
    audit(req.user, 'Artikel geändert', `${base.name}: ${euro(base.price_cents)} → ${euro(a.price_cents)}${a.active ? '' : ', ausgeblendet'}`);
  }
  res.json({ ok: true });
});

/* Eigenes Artikelbild: kommt im Browser bereits verkleinert (quadratisch, 384 px) als WebP/PNG/JPG an */
admin.put('/articles/:id/image', need('artikel'), express.raw({ type: () => true, limit: artIcons.MAX_BYTES + 1024 }), (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id = ? AND custom = 0 AND deleted = 0').get(int(req.params.id));
  if (!a) return bad(res, 'Nicht gefunden.', 404);
  let file;
  try { file = artIcons.saveImage(DATA_DIR, a.id, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)); } catch (e) { return bad(res, e.message); }
  if (a.image && a.image !== file) artIcons.removeImage(DATA_DIR, a.image);
  db.prepare('UPDATE articles SET image = ? WHERE id = ?').run(file, a.id);
  audit(req.user, 'Artikelbild geändert', a.name);
  res.json({ ok: true, image: file });
});
admin.delete('/articles/:id/image', need('artikel'), (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id = ? AND custom = 0').get(int(req.params.id));
  if (!a) return bad(res, 'Nicht gefunden.', 404);
  if (a.image) { artIcons.removeImage(DATA_DIR, a.image); db.prepare('UPDATE articles SET image = NULL WHERE id = ?').run(a.id); audit(req.user, 'Artikelbild entfernt', a.name); }
  res.json({ ok: true });
});

/* Artikel löschen: nie verkauft/geliefert → endgültig; sonst aus allen Listen und vom Tablet entfernt,
   alte Buchungen und Lieferungen bleiben (Bestand und Abrechnung stimmen weiter). */
admin.delete('/articles/:id', need('artikel'), (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id = ? AND deleted = 0').get(int(req.params.id));
  if (!a) return res.json({ ok: true });
  if (a.custom) return bad(res, 'Dieser Systemartikel kann nicht gelöscht werden.');
  const n = db.prepare('SELECT COUNT(*) n FROM bookings WHERE article_id = ?').get(a.id).n
    + db.prepare('SELECT COUNT(*) n FROM delivery_items WHERE article_id = ?').get(a.id).n
    + db.prepare('SELECT COUNT(*) n FROM stock_moves WHERE article_id = ?').get(a.id).n;
  db.transaction(() => {
    db.prepare('DELETE FROM event_articles WHERE article_id = ?').run(a.id);
    db.prepare('DELETE FROM supplier_map WHERE article_id = ?').run(a.id);
    if (n) db.prepare('UPDATE articles SET deleted = 1, active = 0 WHERE id = ?').run(a.id);
    else db.prepare('DELETE FROM articles WHERE id = ?').run(a.id);
  })();
  if (!n && a.image) artIcons.removeImage(DATA_DIR, a.image);
  audit(req.user, 'Artikel gelöscht', a.name + (n ? ' (frühere Buchungen/Lieferungen bleiben erhalten)' : ''));
  res.json({ ok: true, kept: Boolean(n) });
});

/* Reihenfolge der Kategorien (Tablet, Listen, Exporte); innerhalb einer Kategorie alphabetisch */
const categoryList = () => db.prepare(`SELECT category, COUNT(*) n, SUM(active) act FROM articles WHERE custom = 0 AND deleted = 0
  GROUP BY category ORDER BY cat_rank(category), de_key(category)`).all();
admin.get('/categories', (req, res) => res.json(categoryList()));
admin.put('/categories/order', need('artikel'), (req, res) => {
  const order = Array.isArray((req.body || {}).order) ? req.body.order.map(c => String(c).trim().slice(0, 40)).filter(Boolean) : null;
  if (!order) return bad(res, 'Ungültige Reihenfolge.');
  setSetting('category_order', JSON.stringify([...new Set(order)].slice(0, 100)));
  audit(req.user, 'Reihenfolge der Kategorien geändert', order.join(' · '));
  res.json({ ok: true, categories: categoryList() });
});
/* „Einstellungen übertragen“ des Verkaufs (Verkauf › Einstellungen): nur die Einstellungen, keine Artikel, Konten oder Buchungen */
plugins.get('getraenke').hooks.exportConfig = () => ({ settings: { top_n: String(topN()), top_days: String(topDays()), category_order: getSetting('category_order', '[]') } });
plugins.get('getraenke').hooks.importConfig = d => {
  const x = (d && d.settings) || {};
  const n = int(x.top_n, -1), days = int(x.top_days, 0);
  if (n < 0 || n > 60 || days < 1 || days > 365) throw new Error('Die Datei enthält ungültige Werte für „Gerade oft hier“.');
  let order; try { order = JSON.parse(x.category_order || '[]'); } catch (e) { order = null; }
  if (!Array.isArray(order)) throw new Error('Die Datei enthält keine gültige Reihenfolge der Kategorien.');
  setSetting('top_n', String(n)); setSetting('top_days', String(days));
  setSetting('category_order', JSON.stringify([...new Set(order.map(c => String(c).trim().slice(0, 40)).filter(Boolean))].slice(0, 100)));
  return 'Einstellungen übernommen';
};

/* ---------- Lieferungen ---------- */
admin.get('/deliveries', need('lieferungen'), (req, res) => {
  const list = db.prepare('SELECT * FROM deliveries ORDER BY date DESC, id DESC LIMIT 300').all();
  const items = db.prepare(`SELECT di.*, a.name, a.crate_size FROM delivery_items di JOIN articles a ON a.id = di.article_id
    WHERE di.delivery_id = ?`);
  res.json(list.map(d => {
    const its = items.all(d.id).map(i => ({ ...i, total: i.crates * i.crate_size + i.bottles }));
    return { ...d, items: its, total: its.reduce((s, i) => s + i.total, 0) };
  }));
});

/* Beleg hochladen (PDF, Foto) → wird gespeichert und, falls möglich, ausgelesen. */
const BELEG_DIR = path.join(DATA_DIR, 'belege');
const TRASH_DIR = path.join(BELEG_DIR, 'papierkorb');
fs.mkdirSync(BELEG_DIR, { recursive: true });
const ALLOWED = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/heic': '.heic', 'image/webp': '.webp' };
const fileOk = f => typeof f === 'string' && /^[\w-]+\.(pdf|jpg|png|heic|webp)$/.test(f) && fs.existsSync(path.join(BELEG_DIR, f));
/** Echte Dateisignatur statt nur Dateiendung prüfen. */
function signatureOk(buf, ext) {
  const h = buf.subarray(0, 16);
  if (ext === '.pdf') return buf.subarray(0, 1024).includes('%PDF-');
  if (ext === '.jpg') return h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  if (ext === '.png') return h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === '.webp') return h.subarray(0, 4).toString() === 'RIFF' && h.subarray(8, 12).toString() === 'WEBP';
  if (ext === '.heic') return h.subarray(4, 8).toString() === 'ftyp';
  return false;
}
/* Abgebrochene Uploads (älter als 1 Tag, keiner Lieferung zugeordnet) aufräumen */
/** Belegdateien (ohne Unterordner wie den Papierkorb) */
const belegFiles = () => fs.readdirSync(BELEG_DIR, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name);
function cleanupUploads() {
  const used = new Set(db.prepare('SELECT file FROM deliveries WHERE file IS NOT NULL').all().map(r => r.file));
  for (const f of belegFiles()) {
    const st = fs.statSync(path.join(BELEG_DIR, f));
    if (!used.has(f) && Date.now() - st.mtimeMs > 24 * 3600 * 1000) invoices.removeFile(path.join(BELEG_DIR, f));
  }
}

admin.post('/upload', need('lieferungen'), express.raw({ type: () => true, limit: '25mb' }), asyncRoute(async (req, res) => {
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  let orig = String(req.headers['x-filename'] || 'beleg');
  try { orig = decodeURIComponent(orig); } catch (e) { /* kaputt kodierter Name: so übernehmen */ }
  const ext = ALLOWED[mime] || (/\.pdf$/i.test(orig) ? '.pdf' : null);
  if (!ext) return bad(res, 'Bitte eine PDF-Datei oder ein Foto (JPG, PNG) hochladen.');
  if (!req.body || !req.body.length) return bad(res, 'Die Datei ist leer.');
  if (!signatureOk(req.body, ext)) return bad(res, 'Die Datei passt nicht zu ihrem Typ. Bitte das Original-PDF oder Foto hochladen.');
  const name = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;
  const file = path.join(BELEG_DIR, name);
  fs.writeFileSync(file, req.body);
  let parsed;
  try { parsed = await invoices.readUpload(db, file, ext === '.pdf' ? 'application/pdf' : mime); }
  catch (e) { console.error('Beleg lesen:', e); parsed = { supplier: '', docNo: null, docKind: 'lieferung', lines: [], hasText: false }; }
  res.json({ fileId: name, originalName: cleanName(orig, 120), ...parsed });
}));

admin.delete('/upload/:file', need('lieferungen'), (req, res) => {
  const f = req.params.file;
  const used = db.prepare('SELECT 1 FROM deliveries WHERE file = ?').get(f);
  if (fileOk(f) && !used) invoices.removeFile(path.join(BELEG_DIR, f));
  res.json({ ok: true });
});

admin.get('/beleg/:file', need('lieferungen'), (req, res) => {
  if (!fileOk(req.params.file)) return bad(res, 'Beleg nicht gefunden.', 404);
  res.sendFile(path.join(BELEG_DIR, req.params.file));
});

admin.get('/supplier-map', need('lieferungen','bestellung'), (req, res) => {
  res.json(db.prepare(`SELECT sm.*, a.name AS article FROM supplier_map sm LEFT JOIN articles a ON a.id = sm.article_id
    ORDER BY sm.supplier, sm.art_no`).all());
});
admin.delete('/supplier-map', need('lieferungen'), (req, res) => {
  const { supplier, artNo } = req.body || {};
  db.prepare('DELETE FROM supplier_map WHERE supplier = ? AND art_no = ?').run(String(supplier || ''), String(artNo || ''));
  res.json({ ok: true });
});

/**
 * Lieferung speichern – von Hand oder aus einem ausgelesenen Beleg.
 * items: [{ articleId, crates, bottles, artNo?, text?, ignore?, packSize?, cost_cents? }]
 */
admin.post('/deliveries', need('lieferungen'), (req, res) => {
  const { date, supplier, note, items, fileId, docNo, docKind, total_cents: totalCents, remember } = req.body || {};
  if (!isDate(date)) return bad(res, 'Datum fehlt.');
  const sup = String(supplier || '').trim().slice(0, 80);
  if (!sup) return bad(res, 'Lieferant fehlt.');
  if (fileId && !fileOk(fileId)) return bad(res, 'Der hochgeladene Beleg wurde nicht gefunden. Bitte erneut hochladen.');
  const doc = docNo ? String(docNo).trim().slice(0, 40) : null;
  if (doc && db.prepare('SELECT 1 FROM deliveries WHERE supplier = ? AND doc_no = ?').get(sup, doc)) {
    return bad(res, `Beleg ${doc} von ${sup} ist schon gespeichert. Doppelte Belege würden den Bestand verfälschen.`, 409);
  }
  const all = Array.isArray(items) ? items : [];
  const clean = all
    .filter(i => !i.ignore)
    .map(i => ({ articleId: int(i.articleId), crates: int(i.crates), bottles: int(i.bottles),
      artNo: i.artNo ? String(i.artNo).slice(0, 20) : null, text: i.text ? String(i.text).slice(0, 80) : null,
      cost: i.cost_cents === undefined || i.cost_cents === null ? null : int(i.cost_cents) }));
  if (clean.some(i => !i.articleId && (i.crates || i.bottles))) {
    return bad(res, 'Bitte jeder Position einen Artikel zuordnen oder sie auf „ignorieren“ stellen.');
  }
  const rows = clean.filter(i => i.articleId && (i.crates || i.bottles));
  if (!rows.length) return bad(res, 'Keine Positionen eingetragen.');
  const kind = ['rechnung', 'gutschrift', 'lieferung', 'kassenbon'].includes(docKind) ? docKind : 'lieferung';

  let id;
  try { db.transaction(() => {
    id = Number(db.prepare(`INSERT INTO deliveries(date, supplier, note, doc_no, doc_kind, file, total_cents)
      VALUES (?,?,?,?,?,?,?)`).run(date, sup, note ? String(note).slice(0, 300) : null, doc, kind,
      fileId || null, totalCents === undefined || totalCents === null || totalCents === '' ? null : int(totalCents)).lastInsertRowid);
    const ins = db.prepare(`INSERT INTO delivery_items(delivery_id, article_id, crates, bottles, supplier_art_no, supplier_text, cost_cents)
      VALUES (?,?,?,?,?,?,?)`);
    const artOk = db.prepare('SELECT 1 FROM articles WHERE id = ?');
    rows.forEach(i => {
      if (!artOk.get(i.articleId)) throw new Error('Unbekannter Artikel.');
      if (Math.abs(i.crates) > 1000 || Math.abs(i.bottles) > 10000) throw new Error('Menge unplausibel.');
      ins.run(id, i.articleId, i.crates, i.bottles, i.artNo, i.text, i.cost);
    });
    if (remember !== false) {
      const up = db.prepare(`INSERT INTO supplier_map(supplier, art_no, article_id, pack_size, text) VALUES (?,?,?,?,?)
        ON CONFLICT(supplier, art_no) DO UPDATE SET article_id = excluded.article_id, pack_size = excluded.pack_size, text = excluded.text`);
      for (const i of all) {
        if (!i.artNo || i.single) continue;
        up.run(sup, String(i.artNo).slice(0, 20), i.ignore ? null : int(i.articleId) || null, Math.max(1, int(i.packSize, 1)),
          i.text ? String(i.text).slice(0, 80) : null);
      }
    }
  })(); } catch (e) {
    if (/UNIQUE/.test(e.message)) return bad(res, `Den Beleg ${doc} von ${sup} gibt es schon.`);
    if (/Unbekannter Artikel|unplausibel/.test(e.message)) return bad(res, e.message === 'Unbekannter Artikel.' ? 'Eine Position ist keinem gültigen Artikel zugeordnet. Bitte prüfen.' : 'Eine Menge ist unplausibel (über 1000 Gebinde bzw. 10.000 Stück).');
    throw e;
  }
  audit(req.user, 'Lieferung gespeichert', `${sup} ${date}${doc ? ' Beleg ' + doc : ''} (${rows.length} Positionen)`);
  res.json({ id });
});

admin.delete('/deliveries/:id', need('lieferungen'), (req, res) => {
  const d = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(int(req.params.id));
  if (!d) return res.json({ ok: true });
  db.prepare('DELETE FROM deliveries WHERE id = ?').run(d.id);
  // Beleg nicht sofort vernichten: 90 Tage im Papierkorb (steckt auch in der Komplettsicherung)
  if (d.file && fileOk(d.file)) {
    try { fs.mkdirSync(TRASH_DIR, { recursive: true }); fs.renameSync(path.join(BELEG_DIR, d.file), path.join(TRASH_DIR, d.file)); }
    catch (e) { /* Datei schon weg */ }
  }
  audit(req.user, 'Lieferung gelöscht', `${d.supplier} ${d.date}${d.doc_no ? ' Beleg ' + d.doc_no : ''}`);
  res.json({ ok: true });
});

/* ---------- Bestand ---------- */
admin.get('/stock', (req, res) => res.json(stockList()));

admin.get('/stock/moves', need('bestand'), (req, res) => {
  res.json(db.prepare(`SELECT sm.*, a.name FROM stock_moves sm JOIN articles a ON a.id = sm.article_id
    ORDER BY sm.date DESC, sm.id DESC LIMIT 200`).all());
});

admin.post('/stock/move', need('bestand'), (req, res) => {
  const { articleId, qty, reason, date, note } = req.body || {};
  if (!['bruch', 'korrektur'].includes(reason)) return bad(res, 'Grund ungültig.');
  let q = int(qty);
  if (!q || Math.abs(q) > 10000) return bad(res, 'Menge fehlt oder ist unplausibel.');
  const art = db.prepare('SELECT name FROM articles WHERE id = ?').get(int(articleId));
  if (!art) return bad(res, 'Bitte einen Artikel wählen.');
  if (reason === 'bruch') q = -Math.abs(q);
  audit(req.user, reason === 'bruch' ? 'Bruch gebucht' : 'Bestand korrigiert', `${art.name}: ${q}`);
  db.prepare('INSERT INTO stock_moves(article_id, qty, reason, date, note) VALUES (?,?,?,?,?)')
    .run(int(articleId), q, reason, isDate(date) ? date : today(), note ? String(note).slice(0, 200) : null);
  res.json({ ok: true });
});

admin.post('/stock/inventory', need('bestand'), (req, res) => {
  const { date, counts, force } = req.body || {};
  const d = isDate(date) ? date : today();
  if (d > today()) return bad(res, 'Das Inventurdatum darf nicht in der Zukunft liegen.');
  const current = new Map(stockList().map(s => [s.id, s.stock]));
  // Plausibilität: Tippfehler wie 2400 statt 24 abfangen
  const names = new Map(stockList().map(s => [s.id, s.name]));
  const odd = [];
  for (const c of Array.isArray(counts) ? counts : []) {
    if (c.counted === '' || c.counted === null || c.counted === undefined) continue;
    const id = int(c.articleId), n = Number(c.counted);
    if (!current.has(id)) continue;
    if (!Number.isInteger(n) || n < 0 || n > 20000) return bad(res, `${names.get(id)}: gezählte Menge ungültig (0 bis 20.000 Stück).`);
    const soll = Math.max(0, current.get(id));
    if (Math.abs(n - soll) > Math.max(48, soll * 2)) odd.push(`${names.get(id)}: gezählt ${n}, Soll ${soll}`);
  }
  if (odd.length && !force) return res.status(409).json({ error: 'Ungewöhnlich große Abweichung', confirm: true, odd });
  const ins = db.prepare(`INSERT INTO stock_moves(article_id, qty, reason, date, note) VALUES (?,?, 'inventur', ?, ?)`);
  const result = [];
  db.transaction(() => {
    for (const c of Array.isArray(counts) ? counts : []) {
      if (c.counted === '' || c.counted === null || c.counted === undefined) continue;
      const id = int(c.articleId);
      if (!current.has(id)) continue;
      const diff = int(c.counted) - current.get(id);
      if (diff !== 0) {
        ins.run(id, diff, d, `Inventur: gezählt ${int(c.counted)}, Soll ${current.get(id)}`);
        result.push({ articleId: id, diff });
      }
    }
  })();
  audit(req.user, 'Inventur', `${result.length} Abweichungen`);
  res.json({ ok: true, changes: result });
});

/** Schwundauswertung: Zugänge, Abgänge, Differenzen je Artikel im Zeitraum. */
function shrinkage(from, to) {
  const arts = db.prepare('SELECT id, name, category, price_cents, crate_size, sort FROM articles WHERE custom = 0 ORDER BY cat_rank(category), de_key(category), de_key(name)').all();
  const deliv = db.prepare(`SELECT COALESCE(SUM(di.crates * a.crate_size + di.bottles),0) n FROM delivery_items di
    JOIN deliveries d ON d.id = di.delivery_id JOIN articles a ON a.id = di.article_id
    WHERE di.article_id = ? AND d.date BETWEEN ? AND ?`);
  const book = db.prepare(`SELECT kind, COALESCE(SUM(qty),0) n FROM bookings WHERE article_id = ? AND cancelled_at IS NULL
    AND date(created_at) BETWEEN ? AND ? GROUP BY kind`);
  const moves = db.prepare(`SELECT reason, COALESCE(SUM(qty),0) n FROM stock_moves WHERE article_id = ? AND date BETWEEN ? AND ?
    GROUP BY reason`);
  return arts.map(a => {
    const k = { konto: 0, verein: 0, gast: 0, event: 0 };
    book.all(a.id, from, to).forEach(r => { k[r.kind] = r.n; });
    const m = { bruch: 0, inventur: 0, korrektur: 0 };
    moves.all(a.id, from, to).forEach(r => { m[r.reason] = r.n; });
    const delivered = deliv.get(a.id, from, to).n;
    const booked = k.konto + k.verein + k.gast + k.event;
    return {
      id: a.id, name: a.name, category: a.category, price_cents: a.price_cents,
      delivered, booked, ...k, bruch: m.bruch, inventur: m.inventur, korrektur: m.korrektur,
      open: delivered + m.bruch + m.korrektur - booked,
      shrink_cents: -Math.min(0, m.inventur) * a.price_cents,
    };
  }).filter(r => r.delivered || r.booked || r.bruch || r.inventur || r.korrektur);
}

admin.get('/shrinkage', need('bestand', 'abrechnung', 'export'), (req, res) => {
  const { from, to } = defaultRange(req.query);
  res.json({ from, to, rows: shrinkage(from, to) });
});

/* ---------- Buchungen ---------- */
admin.get('/bookings', need('buchungen'), (req, res) => {
  const { from, to } = defaultRange(req.query);
  const params = [from, to];
  let where = '';
  if (req.query.memberId) { where += ' AND b.member_id = ?'; params.push(int(req.query.memberId)); }
  if (req.query.eventId) { where += ' AND b.event_id = ?'; params.push(int(req.query.eventId)); }
  const rows = db.prepare(`SELECT b.*, ${ARTICLE_LABEL} AS article, COALESCE(m.name, g.name, 'Deckel: ' || t.name) AS member, m.kind AS member_kind, g.name AS guest,
      g.member_id IS NULL AND g.id IS NOT NULL AS manual_guest, e.name AS event, p.method AS pay_method, t.status AS tab_status, t.method AS tab_method
    FROM bookings b JOIN articles a ON a.id = b.article_id
    LEFT JOIN members m ON m.id = b.member_id LEFT JOIN events e ON e.id = b.event_id
    LEFT JOIN event_guests g ON g.id = b.event_guest_id LEFT JOIN event_payments p ON p.id = b.payment_id
    LEFT JOIN guest_tabs t ON t.id = b.tab_id
    WHERE date(b.created_at) BETWEEN ? AND ? ${where}
    ORDER BY b.created_at DESC, b.id DESC LIMIT 1000`).all(...params);
  res.json({ from, to, rows });
});

admin.post('/bookings', need('buchungen'), (req, res) => {
  const { memberId, articleId, qty, date, amount_cents, note } = req.body || {};
  const m = db.prepare('SELECT * FROM members WHERE id = ? AND deleted = 0').get(int(memberId));
  if (m && !m.active) return bad(res, `„${m.name}“ ist ausgeblendet – zum Nachtragen das Konto zuerst wieder einblenden.`);
  const custom = amount_cents !== undefined && amount_cents !== null && amount_cents !== '';
  const a = custom ? db.prepare('SELECT * FROM articles WHERE id = ?').get(customArticleId()) : db.prepare('SELECT * FROM articles WHERE id = ? AND custom = 0').get(int(articleId));
  const q = custom ? 1 : int(qty);
  const unit = custom ? int(amount_cents) : (a ? a.price_cents : 0);
  if (!custom && !Number.isInteger(Number(qty))) return bad(res, 'Konto, Artikel und Menge (1–999) angeben.');   // ganze Stückzahlen
  if (custom && !Number.isInteger(Number(amount_cents))) return bad(res, 'Betrag bitte in ganzen Cent angeben.');
  if (!m || !a || q < 1 || q > 999) return bad(res, 'Konto, Artikel und Menge (1–999) angeben.');
  if (custom && (unit < 10 || unit > 100000)) return bad(res, 'Betrag bitte zwischen 0,10 € und 1.000 €.');
  if (date && !isDate(date)) return bad(res, 'Datum ungültig.');
  if (isDate(date) && date > today()) return bad(res, 'Das Datum darf nicht in der Zukunft liegen.');
  const kind = { mitglied: 'konto', nichtmitglied: 'konto', mannschaft: 'konto', verein: 'verein', gast: 'gast' }[m.kind];
  const total = kind === 'verein' ? 0 : unit * q;
  const ts = isDate(date) ? `${date} 12:00:00` : nowTs();
  const txt = custom ? (cleanName(note, 60) || null) : null;
  const r = db.prepare(`INSERT INTO bookings(member_id, article_id, kind, qty, unit_cents, total_cents, created_at, note)
    VALUES (?,?,?,?,?,?,?,?)`).run(m.id, a.id, kind, q, unit, total, ts, txt);
  audit(req.user, 'Buchung nachgetragen', `${m.name}: ${custom ? 'Betrag ' + euro(unit) + (txt ? ' (' + txt + ')' : '') : q + ' × ' + a.name}${isDate(date) ? ' am ' + date : ''}`);
  res.json({ id: Number(r.lastInsertRowid) });
});

/* Storno einer abgerechneten Buchung: vorher sagen, wo sie abgerechnet ist – und ob sich ein Verkaufs-Einzug der
   Mitgliederverwaltung noch zurücknehmen lässt (dann normales Storno statt Gutschrift) */
const settlementOf = id => {
  const b = db.prepare('SELECT b.id, b.member_id, b.settled_id, s.batch, s.created_at, s.by_user FROM bookings b LEFT JOIN member_settlements s ON s.id = b.settled_id WHERE b.id = ?').get(int(id));
  if (!b || !b.settled_id) return { b, mod: null };
  let mod = null;
  for (const p of plugins.withHook('drinksSettlementInfo')) { try { mod = p.hooks.drinksSettlementInfo({ batch: b.batch, memberId: b.member_id }) || mod; } catch (e) { /* Modul-Fehler: wie ohne Modul */ } }
  return { b, mod };
};
admin.get('/bookings/:id/settlement', need('buchungen'), (req, res) => {
  const { b, mod } = settlementOf(req.params.id);
  if (!b) return bad(res, 'Nicht gefunden.', 404);
  if (!b.settled_id) return res.json({ settled: false });
  res.json({ settled: true, where: mod ? mod.text : `Verkauf › Abrechnung vom ${deD(b.created_at.slice(0, 10))}${b.by_user ? ` (${b.by_user})` : ''}`,
    credit: !mod || mod.billed !== false, undo: mod && mod.undo && req.user.perms.includes('mitglieder_finanzen') ? mod.undo : null });
});
admin.post('/bookings/:id/undo-run', need('buchungen'), (req, res) => {
  if (!req.user.perms.includes('mitglieder_finanzen')) return bad(res, 'Dafür fehlt dir das Recht „Finanzen“ der Mitgliederverwaltung.', 403);
  const { b, mod } = settlementOf(req.params.id);
  if (!b || !mod || !mod.undo) return bad(res, 'Diese Abrechnung lässt sich hier nicht zurücknehmen.');
  for (const p of plugins.withHook('drinksSettlementUndo')) {
    try { p.hooks.drinksSettlementUndo({ batch: b.batch, user: req.user }); } catch (e) { return bad(res, e.message); }
  }
  res.json({ ok: true });
});

admin.post('/bookings/:id/cancel', need('buchungen'), (req, res) => {
  const b = db.prepare(`SELECT b.*, COALESCE(b.article_name, a.name) AS article, a.custom, m.name AS member FROM bookings b JOIN articles a ON a.id = b.article_id
    LEFT JOIN members m ON m.id = b.member_id WHERE b.id = ?`).get(int(req.params.id));
  if (!b) return bad(res, 'Nicht gefunden.', 404);
  if (b.cancelled_at) return bad(res, 'Diese Buchung ist bereits storniert.', 409);
  if (b.payment_id) return bad(res, 'Diese Buchung ist schon bezahlt. Bitte zuerst unter „Veranstaltungen“ die Zahlung zurücknehmen, sonst stimmt die Kasse nicht mehr.');
  if (b.tab_id && b.kind !== 'konto') {
    const t = db.prepare('SELECT status FROM guest_tabs WHERE id = ?').get(b.tab_id);
    if (t && t.status !== 'offen') return bad(res, 'Dieser Gäste-Deckel ist schon geschlossen. Bitte zuerst unter „Gäste-Deckel“ wieder öffnen, sonst stimmt die Kasse nicht mehr.');
  }
  const what = `${b.member || 'Barverkauf'}: ${b.custom ? 'Betrag ' + euro(b.total_cents) : b.qty + ' × ' + b.article} vom ${b.created_at.slice(0, 10)}`;
  if (b.settled_id) {
    // Abgerechnet über ein Modul (z. B. Verkaufs-Einzug der Mitgliederverwaltung), dessen Posten dort schon storniert ist?
    // Dann wurde nichts berechnet: Abrechnung wieder öffnen und normal stornieren statt eine Gutschrift zu buchen.
    const st = db.prepare('SELECT batch, member_id FROM member_settlements WHERE id = ?').get(b.settled_id);
    const notBilled = st && st.batch && plugins.withHook('drinksSettlementBilled').some(p => { try { return p.hooks.drinksSettlementBilled({ batch: st.batch, memberId: st.member_id }) === false; } catch (e) { return false; } });
    const hasCredit = db.prepare('SELECT 1 FROM bookings WHERE credit_for = ? AND cancelled_at IS NULL').get(b.id);
    if (notBilled && hasCredit) return bad(res, 'Der Verkaufs-Posten dazu ist in der Mitgliederverwaltung schon storniert. Bitte zuerst die Gutschrift stornieren – danach lässt sich die Buchung normal stornieren.');
    if (notBilled) { const r = drinks.reopen(st.batch, st.member_id); if (!r.ok) return bad(res, r.error); b.settled_id = null; }
  }
  if (b.settled_id) {
    if (db.prepare('SELECT 1 FROM bookings WHERE credit_for = ? AND cancelled_at IS NULL').get(b.id)) return bad(res, 'Dafür wurde schon eine Gutschrift gebucht.');
    // Schon abgerechnet (in der Vereinsverwaltung abgebucht): nicht mehr ändern, sondern Gutschrift auf die nächste Abrechnung
    if (b.total_cents <= 0) return bad(res, 'Diese Buchung ist schon abgerechnet und kann nicht mehr storniert werden.');
    const note = ('Storno ' + (b.custom ? (b.note || 'Betrag') : b.qty + ' × ' + b.article) + ' vom ' + b.created_at.slice(0, 10)).slice(0, 80);
    db.transaction(() => {
      db.prepare(`INSERT INTO bookings(member_id, article_id, kind, qty, unit_cents, total_cents, note, credit_for) VALUES (?,?,'konto',1,?,?,?,?)`)
        .run(b.member_id, customArticleId(), -b.total_cents, -b.total_cents, note, b.id);
      if (!b.custom) db.prepare(`INSERT INTO stock_moves(article_id, qty, reason, date, note) VALUES (?,?,'korrektur',?,?)`)
        .run(b.article_id, b.qty, today(), 'Storno aus abgerechnetem Zeitraum');
    })();
    audit(req.user, 'Gutschrift (Storno abgerechnet)', `${what}, ${euro(b.total_cents)} für die nächste Abrechnung gutgeschrieben`);
    return res.json({ ok: true, credit: true, message: `Die Buchung ist schon abgerechnet. Deshalb wurde eine Gutschrift über ${euro(b.total_cents)} gebucht – sie wird bei der nächsten Abrechnung abgezogen.` });
  }
  const r = db.prepare(`UPDATE bookings SET cancelled_at = datetime('now','localtime'), cancelled_by = ?
    WHERE id = ? AND cancelled_at IS NULL`).run(req.user.username, b.id);
  if (!r.changes) return bad(res, 'Diese Buchung ist bereits storniert.', 409);   // zwischenzeitlich von jemand anderem
  if (b.credit_for) reverseCreditStock(b.id);
  audit(req.user, 'Buchung storniert', what);
  res.json({ ok: true });
});

/* ---------- Abrechnung / Salden ---------- */
/* Name wie beim Buchen (Spalte article_name); ältere Buchungen ohne Eintrag zeigen den aktuellen Namen */
const ARTICLE_LABEL = `CASE WHEN a.custom = 1 THEN a.name || COALESCE(': ' || b.note, '') ELSE COALESCE(b.article_name, a.name) END`;
/** Offene Beträge je Konto (Stand asOf): alle noch nicht abgerechneten Konto-Buchungen */
function balances(asOf = nowTs(), upTo = maxBookingId()) {
  const rows = db.prepare(`SELECT m.id, m.name, m.kind, a.category, SUM(b.qty) AS qty, SUM(b.total_cents) AS cents, MIN(b.created_at) AS first_at
    FROM bookings b JOIN members m ON m.id = b.member_id JOIN articles a ON a.id = b.article_id
    WHERE b.${OPEN_KONTO.replace(/ AND /g, ' AND b.')} AND ${CUT('b.')}
    GROUP BY m.id, a.category ORDER BY m.kind, name_key(m.name, m.kind)`).all(upTo, asOf, asOf);
  const lastAt = db.prepare('SELECT MAX(until_at) t FROM member_settlements WHERE member_id = ?');
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.id)) map.set(r.id, { id: r.id, name: r.name, kind: r.kind, total_cents: 0, items: 0, byCategory: {}, since: r.first_at });
    const e = map.get(r.id);
    e.byCategory[r.category] = (e.byCategory[r.category] || 0) + r.qty;
    e.total_cents += r.cents; e.items += r.qty;
    if (r.first_at < e.since) e.since = r.first_at;
  }
  return [...map.values()].map(e => ({ ...e, lastSettled: lastAt.get(e.id).t, eventOpen_cents: eventOpen(e.id) }));
}

/* Auswertung Verkauf (Dashboard): Umsatz, Artikel, Verlauf, Anteile, beliebte Zeiten – Vergleich mit dem Vorjahr */
admin.get('/sales-stats', need('abrechnung', 'export'), (req, res) => {
  const t0 = new Date(); const pad2 = n => String(n).padStart(2, '0');
  const today0 = `${t0.getFullYear()}-${pad2(t0.getMonth() + 1)}-${pad2(t0.getDate())}`;
  const y = Math.max(2000, Math.min(2100, parseInt(req.query.year, 10) || t0.getFullYear()));
  const cat = String(req.query.cat || '');
  const load = yy => db.prepare(`SELECT b.*, a.name AS aname, a.category FROM bookings b JOIN articles a ON a.id = b.article_id WHERE b.created_at >= ? AND b.created_at < ? ${cat ? 'AND a.category = ?' : ''}`)
    .all(`${yy}-01-01`, `${yy + 1}-01-01`, ...(cat ? [cat] : []));
  const calc = yy => {
    const all = load(yy), act = all.filter(b => !b.cancelled_at), can = all.filter(b => b.cancelled_at);
    const rev = b => (b.kind === 'verein' ? 0 : b.total_cents);
    const m = f => Array.from({ length: 12 }, (_, i) => act.filter(b => +b.created_at.slice(5, 7) === i + 1).reduce((x, b) => x + f(b), 0));
    return { act, can, revenue: act.reduce((x, b) => x + rev(b), 0), units: act.reduce((x, b) => x + b.qty, 0), count: act.length, cancelled: can.length,
      month: m(rev), monthUnits: m(b => b.qty), monthCount: Array.from({ length: 12 }, (_, i) => act.filter(b => +b.created_at.slice(5, 7) === i + 1).length),
      monthCan: Array.from({ length: 12 }, (_, i) => can.filter(b => +b.created_at.slice(5, 7) === i + 1).length), rev };
  };
  const c = calc(y), p = calc(y - 1);
  const group = (key, nameOf) => { const mp = new Map(); for (const b of c.act) { const k = key(b); const v = mp.get(k) || { name: nameOf(b), units: 0, cents: 0, count: 0 }; v.units += b.qty; v.cents += c.rev(b); v.count++; mp.set(k, v); } return [...mp.values()]; };
  const prevUnits = new Map(); for (const b of p.act) prevUnits.set(b.article_id, (prevUnits.get(b.article_id) || 0) + b.qty);
  const freeId = require('./db').customArticleId();   // „Freier Betrag“ zählt zum Umsatz, aber nicht als Bestseller
  const arts = group(b => b.article_id, b => b.aname).filter(a => a.name);
  const artIds = new Map(); for (const b of c.act) artIds.set(b.aname, b.article_id);
  const top = arts.filter(a => artIds.get(a.name) !== freeId).sort((a, b) => b.units - a.units).slice(0, 10).map(a => ({ ...a, prev: prevUnits.get(artIds.get(a.name)) || 0 }));
  const cats = group(b => b.category || 'Sonstiges', b => b.category || 'Sonstiges').sort((a, b) => b.cents - a.cents || b.units - a.units);
  const KIND = { konto: 'Auf Konto', gast: 'Gast (bar/Karte)', event: 'Veranstaltung', verein: 'Verein (frei)' };
  const kinds = group(b => b.kind, b => KIND[b.kind] || b.kind).sort((a, b) => b.units - a.units);
  const days = {}; for (const b of c.act) { const d = b.created_at.slice(0, 10); days[d] = (days[d] || 0) + b.qty; }
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const b of c.act) { const dt = new Date(b.created_at.replace(' ', 'T')); grid[(dt.getDay() + 6) % 7][dt.getHours()] += b.qty; }
  const usedH = grid.reduce((a, row) => { row.forEach((v, h) => { if (v) { a[0] = Math.min(a[0], h); a[1] = Math.max(a[1], h + 1); } }); return a; }, [24, 0]);
  const pick = x => ({ revenue: x.revenue, units: x.units, count: x.count, cancelled: x.cancelled, month: x.month, monthUnits: x.monthUnits, monthCount: x.monthCount, monthCan: x.monthCan });
  res.json({ year: y, cat, until: y === t0.getFullYear() ? today0 : `${y}-12-31`,
    years: [...new Set([t0.getFullYear(), ...db.prepare("SELECT DISTINCT substr(created_at,1,4) y FROM bookings").all().map(r => +r.y)])].filter(Boolean).sort((a, b) => b - a),
    categories: db.prepare('SELECT DISTINCT category FROM articles ORDER BY category').all().map(r => r.category),
    cur: pick(c), prev: pick(p), top, cats, kinds, days, grid, hours: usedH[0] < usedH[1] ? usedH : [16, 23] });
});

admin.get('/balances', need('abrechnung', 'export'), (req, res) => {
  const asOf = nowTs(), upTo = maxBookingId();
  const list = balances(asOf, upTo);
  const { from, to } = defaultRange(req.query);
  const sums = db.prepare(`SELECT kind, COALESCE(SUM(total_cents),0) cents, COALESCE(SUM(qty),0) qty,
      COALESCE(SUM(unit_cents * qty),0) list_cents
    FROM bookings WHERE cancelled_at IS NULL AND date(created_at) BETWEEN ? AND ? GROUP BY kind`).all(from, to);
  // Hinweis: Was Mitglieder auf Veranstaltungslisten noch offen haben, kommt erst nach der Übernahme auf die Getränkeliste
  const evOpen = db.prepare(`SELECT e.name, SUM(b.total_cents) c FROM bookings b JOIN events e ON e.id = b.event_id
    JOIN event_guests g ON g.id = b.event_guest_id WHERE g.member_id IS NOT NULL AND b.${OPEN_GUEST.replace(/ AND /g, ' AND b.')}
    GROUP BY e.id ORDER BY e.date`).all();
  const categories = db.prepare('SELECT category FROM articles WHERE deleted = 0 OR id IN (SELECT article_id FROM bookings) GROUP BY category ORDER BY cat_rank(category), de_key(category)').all().map(r => r.category);
  // Offene Verkaufs-Posten der Mitgliederverwaltung (z. B. von Hand angelegt oder nach verworfenem Einzug) – damit nichts übersehen wird
  const mvOpen = plugins.withHook('drinksOpenCharges').flatMap(p => { try { return p.hooks.drinksOpenCharges() || []; } catch (e) { return []; } });
  res.json({ asOf, upTo, from, to, categories, rows: list, sums, total_cents: list.reduce((s, r) => s + r.total_cents, 0), eventOpen: evOpen, mvOpen });
});

/* ---------- Abtippliste für die Vereinsverwaltung (ohne Importfunktion) ----------
   Gleicher Stand wie Liste/Export (asOf/upTo), sortiert nach Nachname, mit fertigem Buchungstext. */
/** Vor-/Nachname: eingetragene Felder, wenn sie zum Anzeigenamen passen – sonst Zerlegung wie überall (db.splitPersonName) */
function splitName(m) {
  if (m.first_name && m.last_name && `${m.first_name} ${m.last_name}`.toLowerCase() === String(m.name).toLowerCase())
    return { first: m.first_name, last: m.last_name };
  return splitPersonName(m.name);
}
const BT_DEFAULT = 'Verkauf {von} – {bis}';
function abtippliste(asOf, upTo) {
  const list = balances(asOf, upTo);
  const extra = db.prepare('SELECT first_name, last_name FROM members WHERE id = ?');
  const rows = list.map(r => {
    const person = isPerson(r.kind);
    const nm = person ? splitName({ ...r, ...extra.get(r.id) }) : { first: '', last: r.name };
    return { id: r.id, name: r.name, kind: r.kind, first: nm.first, last: nm.last, cents: r.total_cents, items: r.items, since: r.since };
  });
  rows.sort((a, b) => (isPerson(a.kind) ? 0 : 1) - (isPerson(b.kind) ? 0 : 1) || (nameKey(a.name, a.kind) < nameKey(b.name, b.kind) ? -1 : nameKey(a.name, a.kind) > nameKey(b.name, b.kind) ? 1 : 0));
  const last = lastSettlement();
  const firstOpen = rows.reduce((m, r) => (!m || r.since < m ? r.since : m), '');
  const von = last && last !== '2000-01-01' ? last : firstOpen;
  const tpl = getSetting('buchungstext', BT_DEFAULT) || BT_DEFAULT;
  const text = tpl.replace(/\{von\}/g, deD(von)).replace(/\{bis\}/g, deD(asOf)).replace(/\{verein\}/g, getSetting('club_name', 'Unser Verein'))
    .replace(/\{jahr\}/g, asOf.slice(0, 4));
  return { asOf, upTo, von: von ? von.slice(0, 10) : null, bis: asOf.slice(0, 10), template: tpl, text, rows,
    total_cents: rows.reduce((s, r) => s + r.cents, 0), clubName: getSetting('club_name', 'Unser Verein') };
}
admin.get('/abtippliste', need('abrechnung', 'export'), (req, res) => {
  const fixed = isTs(req.query.asOf) && req.query.asOf <= nowTs() && req.query.upTo !== undefined;
  res.json(abtippliste(fixed ? req.query.asOf : nowTs(), fixed ? Math.min(int(req.query.upTo), maxBookingId()) : maxBookingId()));
});
admin.put('/abtippliste/text', need('abrechnung'), (req, res) => {
  const t = String((req.body || {}).template || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 140);
  setSetting('buchungstext', t || BT_DEFAULT);
  res.json({ ok: true, template: t || BT_DEFAULT });
});

/* Kassierer: nach dem Abbuchen in der Vereinsverwaltung einzelne oder alle Konten als abgerechnet markieren.
   Erfasst werden nur Buchungen bis zum Stand der angezeigten Liste bzw. des Exports (asOf) –
   was danach am Tablet gebucht wurde, bleibt offen für die nächste Abrechnung. */
admin.post('/settle', need('abrechnung'), (req, res) => {
  const b = req.body || {};
  const asOf = isTs(b.asOf) ? b.asOf : null;
  if (!asOf) return bad(res, 'Stand der Liste fehlt – bitte die Seite neu laden.');
  const upTo = int(b.upTo);
  if (asOf > nowTs() || upTo < 0 || upTo > maxBookingId()) return bad(res, 'Ungültiger Stand.');
  const all = !Array.isArray(b.memberIds);
  const ids = all ? null : [...new Set(b.memberIds.map(int))].filter(Boolean);
  if (!all && !ids.length) return bad(res, 'Kein Konto gewählt.');
  const r = drinks.settle(ids, asOf, upTo, req.user.username, b.note ? cleanName(b.note, 100) : null, all ? 'alle-' : 'einzeln-');
  if (!r.batch) return bad(res, 'Es gibt nichts Offenes abzurechnen.');
  const mids = Object.keys(r.perMember).map(Number);
  const names = all ? `${r.members} Konten` : db.prepare(`SELECT group_concat(name, ', ') n FROM members WHERE id IN (${mids.map(() => '?').join(',')})`).get(...mids).n;
  audit(req.user, all ? 'Alle Konten abgerechnet' : 'Konto abgerechnet', `${names}: ${euro(r.cents)} (Stand ${asOf.slice(0, 16)})`);
  res.json({ ok: true, members: r.members, bookings: r.bookings, cents: r.cents, batch: r.batch });
});

/** Abrechnung aus Verkauf › Abrechnung selbst (alle/einzeln) – nicht aus einem Modul oder der alten Stichtags-Abrechnung */
const ownSettle = batch => /^(alle|einzeln)-/.test(batch);
admin.get('/settle-history', need('abrechnung'), (req, res) => {
  const rows = db.prepare(`SELECT s.batch, MIN(s.created_at) created_at, MAX(s.until_at) until_at, MAX(s.by_user) by_user,
      COUNT(*) members, SUM(s.cents) cents, group_concat(m.name, char(31)) names, group_concat(m.kind, char(31)) kinds
    FROM member_settlements s JOIN members m ON m.id = s.member_id
    GROUP BY s.batch ORDER BY MIN(s.id) DESC LIMIT 30`).all();
  const newest = rows.length ? rows[0].batch : null;
  res.json(rows.map(({ kinds, ...r }) => ({ ...r, names: r.members <= 3 ? r.names.split('\x1f').map((n, i) => lastFirst(n, kinds.split('\x1f')[i])).join('; ') : null, undo: r.batch === newest && ownSettle(r.batch) })));
});

/* Getränke für andere Module (Mitgliederverwaltung: Einzug per Lastschrift) – gleiche Regeln wie die Abrechnung oben */
/** Eine Gutschrift auf eine abgerechnete Buchung hat den Bestand zurückgebucht – wird die Gutschrift storniert, gilt die Ware wieder als verkauft */
const CREDIT_STOCK_NOTE = id => `Gutschrift #${id} storniert`;
function reverseCreditStock(creditId) {
  const o = db.prepare('SELECT o.article_id, o.qty, a.custom FROM bookings c JOIN bookings o ON o.id = c.credit_for JOIN articles a ON a.id = o.article_id WHERE c.id = ?').get(creditId);
  if (!o || o.custom || db.prepare("SELECT 1 FROM stock_moves WHERE note = ?").get(CREDIT_STOCK_NOTE(creditId))) return;
  db.prepare("INSERT INTO stock_moves(article_id, qty, reason, date, note) VALUES (?,?,'korrektur',?,?)").run(o.article_id, -o.qty, today(), CREDIT_STOCK_NOTE(creditId));
}
// Nachholen für Gutschriften, die vor 3.39.4 storniert wurden (damals blieb die Bestandskorrektur stehen)
for (const c of db.prepare('SELECT id FROM bookings WHERE credit_for IS NOT NULL AND cancelled_at IS NOT NULL').all()) reverseCreditStock(c.id);

const drinks = {
  active: () => plugins.isActive('getraenke'),
  /** Veranstaltung im Verkauf anlegen (z. B. aus einem Dienstplan) – Artikelliste mit allen aktiven Artikeln zum Normalpreis → id */
  createEvent(name, date, user) {
    const n = cleanName(name, 80); if (!n) throw new Error('Name fehlt.');
    const id = Number(db.prepare('INSERT INTO events(name, date) VALUES (?,?)').run(n, isDate(date) ? date : today()).lastInsertRowid);
    saveEventArticles(id, db.prepare(`SELECT id AS articleId, price_cents FROM articles WHERE active = 1 AND custom = 0 AND deleted = 0 ORDER BY cat_rank(category), de_key(category), de_key(name)`).all());
    audit(user, 'Veranstaltung angelegt', `${n} (aus Dienstplan)`);
    return id;
  },
  event: id => db.prepare('SELECT id, name, date, active, closed_at FROM events WHERE id = ?').get(int(id)) || null,
  /** Verkauf eines Mitglieds je Monat (Datenauskunft) – auch bei ausgeschaltetem Verkauf, die Daten sind ja gespeichert */
  byMonth: id => db.prepare("SELECT substr(created_at,1,7) monat, SUM(qty) anzahl, SUM(total_cents) cents FROM bookings WHERE member_id = ? AND cancelled_at IS NULL GROUP BY monat ORDER BY monat").all(int(id)),
  /** offene Beträge je Konto zum jetzigen Stand → { asOf, upTo, rows: [{ id, name, kind, total_cents, items, since }] } */
  open() { const asOf = nowTs(), upTo = maxBookingId(); return { asOf, upTo, rows: balances(asOf, upTo) }; },
  /** Konten als abgerechnet markieren (nur Buchungen bis asOf/upTo) → { batch, cents, perMember: { id: cents } } */
  /** Konten abrechnen bis zum Stand asOf/upTo – memberIds = null: alle Konten mit offenem Betrag */
  settle(memberIds, asOf, upTo, username, note, prefix = 'modul-') {
    const ids = memberIds === null ? null : [...new Set((memberIds || []).map(int))].filter(Boolean);
    if ((ids && !ids.length) || !isTs(asOf)) return { batch: null, cents: 0, perMember: {}, members: 0, bookings: 0 };
    const batch = prefix + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'), up = Math.min(int(upTo), maxBookingId());
    const open = db.prepare(`SELECT member_id, SUM(total_cents) c, SUM(qty) n FROM bookings
      WHERE ${OPEN_KONTO} AND member_id IS NOT NULL AND ${CUT('')} GROUP BY member_id`).all(up, asOf, asOf).filter(r => !ids || ids.includes(r.member_id));
    const perMember = {}; let cents = 0, bookings = 0;
    db.transaction(() => {
      for (const r of open) {
        const id = Number(db.prepare(`INSERT INTO member_settlements(member_id, cents, items, until_at, batch, by_user, note) VALUES (?,?,?,?,?,?,?)`)
          .run(r.member_id, r.c, r.n, asOf, batch, username || null, note ? String(note).slice(0, 100) : null).lastInsertRowid);
        bookings += db.prepare(`UPDATE bookings SET settled_id = ? WHERE member_id = ? AND ${OPEN_KONTO} AND ${CUT('')}`).run(id, r.member_id, up, asOf, asOf).changes;
        perMember[r.member_id] = r.c; cents += r.c;
      }
    })();
    return { batch: open.length ? batch : null, cents, perMember, members: open.length, bookings };
  },
  /** Abrechnung eines Moduls zurücknehmen (z. B. wenn ein Einzug verworfen wird) – nur solange daraus nichts storniert wurde */
  /** Betrag aufs Verkaufskonto buchen (z. B. Platzgebühr eines Trainers) – bezahlt wird mit dem Verkauf unter Abrechnung → Buchungs-ID */
  charge(memberId, cents, note, user) {
    const m = db.prepare("SELECT * FROM members WHERE id = ? AND deleted = 0 AND active = 1 AND kind IN ('mitglied','nichtmitglied','mannschaft')").get(int(memberId));
    if (!m) throw new Error('Konto nicht gefunden (oder ausgeblendet).');
    const c = int(cents); if (!(c >= 10 && c <= 100000)) throw new Error('Betrag bitte zwischen 0,10 € und 1.000 €.');
    const t = cleanName(note, 60) || null;
    const id = Number(db.prepare("INSERT INTO bookings(member_id, article_id, kind, qty, unit_cents, total_cents, note) VALUES (?,?,'konto',1,?,?,?)").run(m.id, customArticleId(), c, c, t).lastInsertRowid);
    audit(user, 'Buchung nachgetragen', `${m.name}: Betrag ${euro(c)}${t ? ' (' + t + ')' : ''}`);
    return id;
  },
  /** Stand solcher Buchungen → { id: 'offen' | 'abgerechnet' | 'storniert' } */
  chargeStatus: ids => Object.fromEntries((ids || []).length ? db.prepare(`SELECT id, cancelled_at, settled_id FROM bookings WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids.map(int))
    .map(b => [b.id, b.cancelled_at ? 'storniert' : b.settled_id ? 'abgerechnet' : 'offen']) : []),
  /** noch nicht abgerechnete Buchung stornieren → true, sonst Fehler */
  cancelCharge(id, user) {
    const b = db.prepare('SELECT b.*, m.name FROM bookings b LEFT JOIN members m ON m.id = b.member_id WHERE b.id = ?').get(int(id));
    if (!b || b.cancelled_at) return true;
    if (b.settled_id) throw new Error('Schon abgerechnet – bitte unter Verkauf › Buchungen stornieren (das bucht eine Gutschrift).');
    db.prepare("UPDATE bookings SET cancelled_at = datetime('now','localtime'), cancelled_by = ? WHERE id = ?").run(user || 'Modul', b.id);
    audit(user, 'Buchung storniert', `${b.name || ''}: Betrag ${euro(b.total_cents)}${b.note ? ' (' + b.note + ')' : ''}`);
    return true;
  },
  /** Abrechnung eines einzelnen Kontos aus einem Modul-Lauf zurücknehmen (z. B. Verkaufs-Posten in der Mitgliederverwaltung storniert)
   *  → { ok, n } – die Buchungen sind danach wieder offen und lassen sich normal stornieren */
  reopen(batch, memberId) {
    const st = db.prepare('SELECT id FROM member_settlements WHERE batch = ? AND member_id = ?').get(String(batch || ''), int(memberId));
    if (!st) return { ok: true, n: 0 };
    if (db.prepare('SELECT 1 FROM bookings c JOIN bookings o ON o.id = c.credit_for WHERE c.cancelled_at IS NULL AND o.settled_id = ?').get(st.id))
      return { ok: false, error: 'Für diese Verkaufsbuchungen gibt es schon eine Gutschrift unter Verkauf › Buchungen. Bitte die Gutschrift dort zuerst stornieren.' };
    let n = 0;
    db.transaction(() => { n = db.prepare('UPDATE bookings SET settled_id = NULL WHERE settled_id = ?').run(st.id).changes; db.prepare('DELETE FROM member_settlements WHERE id = ?').run(st.id); })();
    return { ok: true, n };
  },
  unsettle(batch) {
    const ids = db.prepare('SELECT id FROM member_settlements WHERE batch = ?').all(String(batch || '')).map(r => r.id);
    if (!ids.length) return { ok: true, n: 0 };
    const q = ids.map(() => '?').join(',');
    const credited = db.prepare(`SELECT COUNT(*) n FROM bookings c JOIN bookings o ON o.id = c.credit_for WHERE c.cancelled_at IS NULL AND o.settled_id IN (${q})`).get(...ids).n;
    if (credited) return { ok: false, error: 'Aus diesem Einzug wurde schon etwas storniert (Gutschrift) – die Buchungen können nicht wieder geöffnet werden.' };
    db.transaction(() => { db.prepare(`UPDATE bookings SET settled_id = NULL WHERE settled_id IN (${q})`).run(...ids); db.prepare(`DELETE FROM member_settlements WHERE id IN (${q})`).run(...ids); })();
    return { ok: true, n: ids.length };
  },
};

/* Fehlklick: nur die jüngste Abrechnung lässt sich zurücknehmen */
admin.delete('/settle/:batch', need('abrechnung'), (req, res) => {
  const batch = String(req.params.batch);
  // Abrechnungen eines Moduls (z. B. Verkaufs-Einzug der Mitgliederverwaltung) nur dort zurücknehmen – sonst blieben dessen Posten
  // bestehen und dieselben Verkäufe würden beim nächsten Lauf noch einmal abgebucht
  if (!ownSettle(batch) && !batch.startsWith('stichtag-')) return bad(res, 'Diese Abrechnung gehört zu einem Verkaufs-Einzug der Mitgliederverwaltung. Bitte dort zurücknehmen (Lauf zurücknehmen) – hier würden die Verkäufe sonst doppelt abgebucht.');
  const newest = db.prepare('SELECT batch FROM member_settlements ORDER BY id DESC LIMIT 1').get();
  if (!newest || newest.batch !== batch || batch.startsWith('stichtag-')) return bad(res, 'Nur die letzte Abrechnung kann zurückgenommen werden.');
  const sum = db.prepare('SELECT SUM(cents) c, COUNT(*) n FROM member_settlements WHERE batch = ?').get(batch);
  if (!drinks.unsettle(batch).ok) return bad(res, 'Seit dieser Abrechnung wurde daraus schon etwas storniert (Gutschrift) – Zurücknehmen ist nicht mehr möglich.');
  audit(req.user, 'Abrechnung zurückgenommen', `${sum.n} Konten, ${euro(sum.c || 0)}`);
  res.json({ ok: true });
});

/* ---------- Gäste-Deckel (Verwaltung) ---------- */
const TAB_VIEW = need('veranstaltungen', 'uebernahme', 'abrechnung', 'export');
function tabRows(where, ...params) {
  const items = db.prepare(`SELECT b.id, b.created_at, b.qty, b.total_cents, b.unit_cents, ${ARTICLE_LABEL} AS article
    FROM bookings b JOIN articles a ON a.id = b.article_id WHERE b.tab_id = ? AND b.cancelled_at IS NULL ORDER BY b.created_at`);
  return db.prepare(`SELECT t.*, m.name AS member, m.kind AS member_kind FROM guest_tabs t LEFT JOIN members m ON m.id = t.member_id WHERE ${where}`).all(...params)
    .map(t => {
      const it = items.all(t.id);
      return { ...t, items: it, open_cents: t.status === 'offen' ? it.reduce((s, x) => s + x.total_cents, 0) : 0,
        sum_cents: t.status === 'offen' || t.status === 'abgeschrieben' ? it.reduce((s, x) => s + x.unit_cents * x.qty, 0) : (t.cents || 0),
        last_at: it.length ? it[it.length - 1].created_at : t.created_at };
    });
}
admin.get('/tabs', TAB_VIEW, (req, res) => {
  const days = Math.min(365, Math.max(1, int(req.query.days, 30)));
  const open = tabRows("t.status = 'offen' ORDER BY t.created_at");
  const closed = tabRows("t.status <> 'offen' AND date(t.closed_at) >= date('now','localtime', ?) ORDER BY t.closed_at DESC", `-${days} days`);
  const today = db.prepare(`SELECT method, COALESCE(SUM(cents),0) c, COUNT(*) n FROM guest_tabs
    WHERE status = 'bezahlt' AND date(closed_at) = date('now','localtime') GROUP BY method`).all();
  res.json({ open, closed, days, today: Object.fromEntries(today.map(r => [r.method, r])) });
});
const getTab = id => db.prepare('SELECT * FROM guest_tabs WHERE id = ?').get(int(id));
admin.post('/tabs/:id/pay', need('veranstaltungen', 'uebernahme'), (req, res) => {
  const t = getTab(req.params.id);
  if (!t || t.status !== 'offen') return bad(res, 'Der Deckel ist nicht mehr offen.');
  const method = (req.body || {}).method;
  if (!['bar', 'karte'].includes(method)) return bad(res, 'Bitte bar oder Karte wählen.');
  res.json({ ok: true, cents: closeTab(t, { status: 'bezahlt', method, by: req.user.username }) });
});
admin.post('/tabs/:id/transfer', need('uebernahme'), (req, res) => {
  const t = getTab(req.params.id);
  if (!t || t.status !== 'offen') return bad(res, 'Der Deckel ist nicht mehr offen.');
  const m = db.prepare("SELECT * FROM members WHERE id = ? AND active = 1 AND kind IN ('mitglied','nichtmitglied','mannschaft')").get(int((req.body || {}).memberId));
  if (!m) return bad(res, 'Bitte ein Mitglied oder eine Mannschaft wählen.');
  res.json({ ok: true, cents: closeTab(t, { status: 'uebernommen', memberId: m.id, by: req.user.username, note: 'auf ' + m.name }) });
});
admin.post('/tabs/:id/writeoff', need('uebernahme'), (req, res) => {
  const t = getTab(req.params.id);
  if (!t || t.status !== 'offen') return bad(res, 'Der Deckel ist nicht mehr offen.');
  const note = cleanName((req.body || {}).note, 120);
  if (note.length < 3) return bad(res, 'Bitte kurz begründen, warum abgeschrieben wird.');
  res.json({ ok: true, cents: closeTab(t, { status: 'abgeschrieben', by: req.user.username, note }) });
});
/* Fehlklick am Tablet: „bezahlt“ zurücknehmen → Deckel wieder offen */
admin.post('/tabs/:id/reopen', need('veranstaltungen', 'uebernahme'), (req, res) => {
  const t = getTab(req.params.id);
  if (!t || t.status !== 'bezahlt') return bad(res, 'Nur bezahlte Deckel lassen sich wieder öffnen.');
  db.transaction(() => {
    db.prepare("UPDATE guest_tabs SET status = 'offen', method = NULL, cents = NULL, closed_at = NULL, closed_by = NULL WHERE id = ?").run(t.id);
    db.prepare('UPDATE bookings SET paid_cash = 0 WHERE tab_id = ? AND cancelled_at IS NULL').run(t.id);
  })();
  audit(req.user, 'Gäste-Deckel wieder geöffnet', `${t.name}: ${euro(t.cents || 0)} ${t.method || ''} zurückgenommen`);
  res.json({ ok: true });
});

/* ---------- Veranstaltungen: eigene Getränkeliste + eigene Abrechnungsliste ---------- */
function eventSummary(id) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!ev) return null;
  ev.articles = db.prepare(`SELECT ea.article_id AS id, a.name, a.category, ea.price_cents
    FROM event_articles ea JOIN articles a ON a.id = ea.article_id WHERE ea.event_id = ? AND a.custom = 0 ORDER BY cat_rank(a.category), de_key(a.category), de_key(a.name)`).all(id);
  ev.items = db.prepare(`SELECT a.name, a.category, a.custom, SUM(b.qty) qty, SUM(b.total_cents) total_cents,
      SUM(CASE WHEN b.kind = 'verein' THEN b.qty ELSE 0 END) free_qty
    FROM bookings b JOIN articles a ON a.id = b.article_id
    WHERE b.event_id = ? AND b.cancelled_at IS NULL GROUP BY a.id ORDER BY cat_rank(a.category), de_key(a.category), de_key(a.name)`).all(id);
  ev.guests = db.prepare(`SELECT g.id, g.name, g.member_id, m.name AS member_name, m.kind AS member_kind, g.created_by, g.created_at,
      COALESCE(SUM(b.qty),0) qty, COALESCE(SUM(b.total_cents),0) total_cents,
      COALESCE(SUM(CASE WHEN b.kind = 'event' AND b.payment_id IS NULL AND b.transferred_at IS NULL THEN b.total_cents END),0) open_cents,
      COALESCE(SUM(CASE WHEN p.method = 'bar' THEN b.total_cents END),0) bar_cents,
      COALESCE(SUM(CASE WHEN p.method = 'karte' THEN b.total_cents END),0) karte_cents,
      COALESCE(SUM(CASE WHEN b.transferred_at IS NOT NULL THEN b.total_cents END),0) transferred_cents,
      COUNT(b.id) n
    FROM event_guests g LEFT JOIN members m ON m.id = g.member_id
    LEFT JOIN bookings b ON b.event_guest_id = g.id AND b.cancelled_at IS NULL
    LEFT JOIN event_payments p ON p.id = b.payment_id
    WHERE g.event_id = ? GROUP BY g.id ORDER BY name_key(g.name, 'mitglied')`).all(id);
  ev.payments = db.prepare(`SELECT p.*, g.name, m.kind AS member_kind FROM event_payments p JOIN event_guests g ON g.id = p.guest_id LEFT JOIN members m ON m.id = g.member_id
    WHERE p.event_id = ? ORDER BY p.at DESC, p.id DESC`).all(id);
  const sale = db.prepare(`SELECT COALESCE(SUM(total_cents),0) c FROM bookings WHERE event_id = ? AND cancelled_at IS NULL
    AND event_guest_id IS NULL AND (kind = 'gast' OR (kind = 'event' AND paid_cash = 1))`).get(id).c;
  const sumG = k => ev.guests.reduce((t, g) => t + g[k], 0);
  ev.sale_cents = sale;                                   // sofort bar (Barverkauf ohne Namen, Gastkonto)
  ev.bar_cents = sale + sumG('bar_cents');                // gehört in die Kasse
  ev.karte_cents = sumG('karte_cents');
  ev.transferred_cents = sumG('transferred_cents');
  ev.open_cents = sumG('open_cents');
  ev.open_member_cents = ev.guests.filter(g => g.member_id).reduce((t, g) => t + g.open_cents, 0);
  ev.open_manual = ev.guests.filter(g => !g.member_id && g.open_cents > 0).map(g => ({ id: g.id, name: g.name, open_cents: g.open_cents }));
  ev.total_cents = ev.items.reduce((t, i) => t + i.total_cents, 0);
  ev.expected_cents = ev.bar_cents;
  return ev;
}
const getEvent = id => db.prepare('SELECT * FROM events WHERE id = ?').get(int(id));
const getGuest = (evId, gid) => db.prepare('SELECT * FROM event_guests WHERE id = ? AND event_id = ?').get(int(gid), int(evId));

admin.get('/events', need('veranstaltungen', 'uebernahme'), (req, res) => {
  const ids = db.prepare('SELECT id FROM events WHERE deleted = 0 ORDER BY date DESC, id DESC LIMIT 100').all();
  res.json(ids.map(r => eventSummary(r.id)));
});

/* Veranstaltung löschen: geht, wenn noch nichts gebucht wurde – oder wenn sie beendet ist und nichts mehr offen ist.
   Mit Buchungen verschwindet sie aus der Liste; Umsatz und Bestand bleiben in den Auswertungen erhalten. */
admin.delete('/events/:id', need('veranstaltungen'), (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted = 0').get(int(req.params.id));
  if (!ev) return res.json({ ok: true });
  if (ev.active) return bad(res, 'Die Veranstaltung ist noch aktiv – bitte zuerst deaktivieren.');
  const booked = db.prepare('SELECT COUNT(*) n FROM bookings WHERE event_id = ? AND cancelled_at IS NULL').get(ev.id).n;
  if (booked) {
    const open = db.prepare(`SELECT COALESCE(SUM(total_cents),0) c FROM bookings WHERE event_id = ? AND event_guest_id IS NOT NULL AND ${OPEN_GUEST}`).get(ev.id).c;
    if (open) return bad(res, `Auf der Liste sind noch ${euro(open)} offen – erst bezahlen lassen oder auf die Konten übernehmen.`);
  }
  db.transaction(() => {
    if (booked) db.prepare('UPDATE events SET deleted = 1 WHERE id = ?').run(ev.id);
    else {
      db.prepare('DELETE FROM bookings WHERE event_id = ?').run(ev.id);   // nur stornierte
      db.prepare('DELETE FROM event_payments WHERE event_id = ?').run(ev.id);
      db.prepare('DELETE FROM event_guests WHERE event_id = ?').run(ev.id);
      db.prepare('DELETE FROM event_articles WHERE event_id = ?').run(ev.id);
      db.prepare('DELETE FROM events WHERE id = ?').run(ev.id);
    }
  })();
  audit(req.user, 'Veranstaltung gelöscht', `${ev.name} (${ev.date})${booked ? ' – Umsätze bleiben in den Auswertungen' : ''}`);
  res.json({ ok: true, kept: Boolean(booked) });
});

/* Namensvorschläge für die Abrechnungsliste (auch ohne Recht „Mitglieder“) */
admin.get('/event-members', need('veranstaltungen', 'uebernahme'), (req, res) => {
  res.json(db.prepare("SELECT id, name, kind FROM members WHERE active = 1 AND kind IN ('mitglied','nichtmitglied','mannschaft') ORDER BY name_key(name, kind)").all());
});

function saveEventArticles(eventId, list) {
  const clean = (Array.isArray(list) ? list : [])
    .map(a => ({ id: int(a.articleId), price: int(a.price_cents, -1) }))
    .filter(a => a.id && a.price >= 0 && a.price <= 100000 && db.prepare('SELECT 1 FROM articles WHERE id = ? AND custom = 0').get(a.id));
  db.transaction(() => {
    db.prepare('DELETE FROM event_articles WHERE event_id = ?').run(eventId);
    const ins = db.prepare('INSERT INTO event_articles(event_id, article_id, price_cents) VALUES (?,?,?)');
    clean.forEach(a => ins.run(eventId, a.id, a.price));
  })();
  return clean.length;
}

admin.post('/events', need('veranstaltungen'), (req, res) => {
  const { name, date, copyFrom } = req.body || {};
  const n = cleanName(name, 80);
  if (!n) return bad(res, 'Name fehlt.');
  const id = Number(db.prepare('INSERT INTO events(name, date) VALUES (?,?)').run(n, isDate(date) ? date : today()).lastInsertRowid);
  // Getränkeliste vorbelegen: von einer früheren Veranstaltung oder alle aktiven Artikel (inkl. Snacks, Bälle) zum Normalpreis
  const src = copyFrom ? db.prepare('SELECT article_id AS articleId, price_cents FROM event_articles WHERE event_id = ?').all(int(copyFrom)) : [];
  saveEventArticles(id, src.length ? src : db.prepare(`SELECT id AS articleId, price_cents FROM articles
    WHERE active = 1 AND custom = 0 AND deleted = 0 ORDER BY cat_rank(category), de_key(category), de_key(name)`).all());
  audit(req.user, 'Veranstaltung angelegt', n);
  res.json({ id });
});

admin.put('/events/:id/articles', need('veranstaltungen'), (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return bad(res, 'Nicht gefunden.', 404);
  if (ev.closed_at) return bad(res, 'Die Veranstaltung ist abgeschlossen.');
  res.json({ ok: true, count: saveEventArticles(ev.id, (req.body || {}).articles) });
});

admin.post('/events/:id/activate', need('veranstaltungen'), (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return bad(res, 'Nicht gefunden.', 404);
  if (ev.closed_at) return bad(res, 'Die Veranstaltung ist bereits abgeschlossen.');
  if (!db.prepare('SELECT COUNT(*) n FROM event_articles WHERE event_id = ?').get(ev.id).n) {
    return bad(res, 'Bitte zuerst festlegen, welche Artikel es gibt.');
  }
  db.transaction(() => {
    db.prepare('UPDATE events SET active = 0').run();
    db.prepare('UPDATE events SET active = 1 WHERE id = ?').run(ev.id);
  })();
  audit(req.user, 'Veranstaltung aktiviert', ev.name);
  res.json({ ok: true });
});

admin.post('/events/:id/deactivate', need('veranstaltungen'), (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return bad(res, 'Nicht gefunden.', 404);
  db.prepare('UPDATE events SET active = 0 WHERE id = ?').run(ev.id);
  audit(req.user, 'Veranstaltung deaktiviert', ev.name);
  res.json({ ok: true });
});

/* Abrechnungsliste: Namen hinzufügen (Mitglied oder frei), umbenennen / Mitglied zuordnen, entfernen */
admin.post('/events/:id/guests', need('veranstaltungen'), (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return bad(res, 'Nicht gefunden.', 404);
  if (ev.closed_at) return bad(res, 'Die Veranstaltung ist abgeschlossen.');
  try {
    const g = addGuest(ev, req.body || {}, req.user.username);
    res.json({ id: g.id });
  } catch (e) { bad(res, e.message); }
});

admin.put('/events/:id/guests/:gid', need('veranstaltungen', 'uebernahme'), (req, res) => {
  const g = getGuest(req.params.id, req.params.gid);
  if (!g) return bad(res, 'Nicht gefunden.', 404);
  const b = req.body || {};
  let memberId = g.member_id, name = g.name;
  if (b.memberId !== undefined) {
    if (b.memberId === null || b.memberId === '') memberId = null;
    else {
      const m = db.prepare("SELECT * FROM members WHERE id = ? AND active = 1 AND kind IN ('mitglied','nichtmitglied','mannschaft')").get(int(b.memberId));
      if (!m) return bad(res, 'Mitglied nicht gefunden.');
      const dup = db.prepare('SELECT * FROM event_guests WHERE event_id = ? AND member_id = ? AND id <> ?').get(g.event_id, m.id, g.id);
      if (dup) {
        // steht schon auf der Liste (z. B. doppelt eingetragen): Einträge zusammenführen
        db.transaction(() => {
          db.prepare('UPDATE bookings SET event_guest_id = ?, member_id = CASE WHEN transferred_at IS NULL THEN ? ELSE member_id END WHERE event_guest_id = ?').run(dup.id, m.id, g.id);
          db.prepare('UPDATE event_payments SET guest_id = ? WHERE guest_id = ?').run(dup.id, g.id);
          db.prepare('DELETE FROM event_guests WHERE id = ?').run(g.id);
        })();
        audit(req.user, 'Veranstaltungsliste zusammengeführt', `${g.name} → ${dup.name}`);
        return res.json({ ok: true, merged: dup.name });
      }
      memberId = m.id;
      if (b.name === undefined) name = m.name;
    }
  }
  if (b.name !== undefined) { name = cleanName(b.name, 60); if (name.length < 2) return bad(res, 'Bitte einen Namen eingeben.'); }
  db.transaction(() => {
    db.prepare('UPDATE event_guests SET name = ?, member_id = ? WHERE id = ?').run(name, memberId, g.id);
    // offene Buchungen gehören dann zum zugeordneten Mitglied
    db.prepare(`UPDATE bookings SET member_id = ? WHERE event_guest_id = ? AND transferred_at IS NULL`).run(memberId, g.id);
  })();
  audit(req.user, 'Veranstaltungsliste geändert', `${g.name} → ${name}${memberId ? ' (Mitglied)' : ''}`);
  res.json({ ok: true });
});

admin.delete('/events/:id/guests/:gid', need('veranstaltungen'), (req, res) => {
  const g = getGuest(req.params.id, req.params.gid);
  if (!g) return bad(res, 'Nicht gefunden.', 404);
  if (db.prepare('SELECT COUNT(*) n FROM bookings WHERE event_guest_id = ? AND cancelled_at IS NULL').get(g.id).n) {
    return bad(res, 'Auf diesem Namen gibt es Buchungen – erst stornieren (unter „Buchungen“), dann entfernen.');
  }
  db.transaction(() => {
    db.prepare('UPDATE bookings SET event_guest_id = NULL WHERE event_guest_id = ?').run(g.id);
    db.prepare('DELETE FROM event_guests WHERE id = ?').run(g.id);
  })();
  res.json({ ok: true });
});

/* „Hat bezahlt“ (bar oder Karte): deckt alle offenen Buchungen dieses Namens */
admin.post('/events/:id/guests/:gid/pay', need('veranstaltungen'), (req, res) => {
  const g = getGuest(req.params.id, req.params.gid);
  if (!g) return bad(res, 'Nicht gefunden.', 404);
  const method = (req.body || {}).method;
  if (!['bar', 'karte'].includes(method)) return bad(res, 'Bitte bar oder Karte wählen.');
  let cents = 0;
  db.transaction(() => {
    cents = guestOpen(g.id);
    if (!cents) return;
    const pid = Number(db.prepare('INSERT INTO event_payments(event_id, guest_id, method, cents, by_user) VALUES (?,?,?,?,?)')
      .run(g.event_id, g.id, method, cents, req.user.username).lastInsertRowid);
    db.prepare(`UPDATE bookings SET payment_id = ? WHERE event_guest_id = ? AND ${OPEN_GUEST}`).run(pid, g.id);
  })();
  if (!cents) return bad(res, 'Bei diesem Namen ist nichts offen.');
  audit(req.user, 'Veranstaltung: hat bezahlt', `${g.name}: ${euro(cents)} ${method === 'bar' ? 'bar' : 'mit Karte'}`);
  res.json({ ok: true, cents });
});

admin.delete('/events/:id/payments/:pid', need('veranstaltungen'), (req, res) => {
  const p = db.prepare('SELECT p.*, g.name FROM event_payments p JOIN event_guests g ON g.id = p.guest_id WHERE p.id = ? AND p.event_id = ?')
    .get(int(req.params.pid), int(req.params.id));
  if (!p) return bad(res, 'Nicht gefunden.', 404);
  db.transaction(() => {
    db.prepare('UPDATE bookings SET payment_id = NULL WHERE payment_id = ?').run(p.id);
    db.prepare('DELETE FROM event_payments WHERE id = ?').run(p.id);
  })();
  audit(req.user, 'Veranstaltung: Zahlung zurückgenommen', `${p.name}: ${euro(p.cents)} ${p.method}`);
  res.json({ ok: true });
});

/* Kassierer: was nicht bezahlt wurde, auf die normale Getränkeliste (Mitgliederkonten) übernehmen */
admin.post('/events/:id/transfer', need('uebernahme'), (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return bad(res, 'Nicht gefunden.', 404);
  const only = Array.isArray((req.body || {}).guestIds) ? req.body.guestIds.map(int) : null;
  let n = 0, cents = 0, people = 0;
  const skipped = [];
  db.transaction(() => {
    const guests = db.prepare('SELECT * FROM event_guests WHERE event_id = ?').all(ev.id).filter(g => !only || only.includes(g.id));
    for (const g of guests) {
      const open = guestOpen(g.id);
      if (!open) continue;
      if (!g.member_id) { skipped.push(g.name); continue; }
      // created_at bleibt der echte Buchungszeitpunkt. Abgerechnet wird die Übernahme trotzdem im nächsten Lauf: die
      // Abrechnung nimmt alle offenen Konto-Buchungen (settled_id IS NULL) und grenzt über transferred_at ab, nicht über created_at.
      const r = db.prepare(`UPDATE bookings SET kind = 'konto', member_id = ?, transferred_at = datetime('now','localtime'), transferred_by = ?
        WHERE event_guest_id = ? AND ${OPEN_GUEST}`).run(g.member_id, req.user.username, g.id);
      n += r.changes; cents += open; people++;
    }
  })();
  audit(req.user, 'Veranstaltung übernommen', `${ev.name}: ${people} Personen, ${euro(cents)} auf die Konten`);
  res.json({ ok: true, transferred: n, people, cents, skipped });
});

admin.post('/events/:id/close', need('veranstaltungen'), (req, res) => {
  const cash = (req.body || {}).cash_cents;
  const ev = getEvent(req.params.id);
  if (!ev) return bad(res, 'Nicht gefunden.', 404);
  const c = cash === '' || cash === undefined || cash === null ? null : int(cash);
  db.prepare(`UPDATE events SET active = 0, closed_at = datetime('now','localtime'), cash_cents = ?, note = ? WHERE id = ?`)
    .run(c, (req.body || {}).note ? String(req.body.note).slice(0, 300) : null, ev.id);
  audit(req.user, 'Veranstaltung abgeschlossen', `${ev.name}${c === null ? '' : ', Kasse ' + euro(c)}`);
  res.json({ ok: true });
});

/* ---------- Bestellung beim Getränkehändler ---------- */
admin.get('/order', need('bestellung'), (req, res) => {
  const settings = orderSettings();
  const artNo = db.prepare(`SELECT art_no, text, pack_size FROM supplier_map WHERE supplier = ? AND article_id = ?
    ORDER BY rowid DESC LIMIT 1`);
  const rows = stockList().filter(s => s.active && s.track_stock).map(s => {
    const target = s.target_stock || s.min_stock * 2;
    const low = s.min_stock > 0 && s.delivered > 0 && s.stock <= s.min_stock;   // nur Artikel, die schon geliefert wurden
    const crates = low ? Math.max(1, Math.ceil((target - s.stock) / s.crate_size)) : 0;
    const map = artNo.get(settings.order_supplier, s.id);
    return { id: s.id, name: s.name, category: s.category, stock: s.stock, min_stock: s.min_stock, target_stock: target,
      crate_size: s.crate_size, low, suggest: crates, art_no: map ? map.art_no : '',
      supplier_text: map && map.text ? map.text.replace(/-?€/g, '').replace(/\s+/g, ' ').trim() : '' };
  });
  res.json({ settings, clubName: getSetting('club_name', process.env.CLUB_NAME || 'Unser Verein'), rows, mailReady: mail.ready(), mayMailSetup: req.user.perms.includes('einstellungen'), lastSent: getSetting('order_last_sent', '') });
});

/* ---------- Export & Sicherung ---------- */
async function buildExport(from, to, asOf = nowTs(), upTo = maxBookingId()) {
  const bookings = db.prepare(`SELECT b.*, ${ARTICLE_LABEL} AS article, COALESCE(b.article_category, a.category) AS category, COALESCE(m.name, g.name, 'Deckel: ' || t.name) AS member, e.name AS event,
      p.method AS pay_method, t.status AS tab_status, t.method AS tab_method
    FROM bookings b JOIN articles a ON a.id = b.article_id
    LEFT JOIN members m ON m.id = b.member_id LEFT JOIN events e ON e.id = b.event_id
    LEFT JOIN event_guests g ON g.id = b.event_guest_id LEFT JOIN event_payments p ON p.id = b.payment_id
    LEFT JOIN guest_tabs t ON t.id = b.tab_id
    WHERE b.cancelled_at IS NULL AND date(b.created_at) BETWEEN ? AND ? ORDER BY b.created_at`).all(from, to);
  const events = db.prepare('SELECT id FROM events WHERE date BETWEEN ? AND ? ORDER BY date').all(from, to).map(r => eventSummary(r.id));
  const tabs = tabRows("date(t.created_at) BETWEEN ? AND ? ORDER BY t.created_at", from, to);
  const categories = db.prepare('SELECT category FROM articles WHERE deleted = 0 OR id IN (SELECT article_id FROM bookings) GROUP BY category ORDER BY cat_rank(category), de_key(category)').all().map(r => r.category);
  const wb = await buildWorkbook({
    clubName: getSetting('club_name', process.env.CLUB_NAME || 'Unser Verein'), from, to, color: clubColor(),
    balances: balances(asOf, upTo), asOf, openBookings: openBookings(asOf, upTo), categories, bookings, shrink: shrinkage(from, to), stock: stockList(), events, tabs,
  });
  return wb;
}

function openBookings(asOf, upTo) {
  return db.prepare(`SELECT b.created_at, b.qty, b.unit_cents, b.total_cents, b.transferred_at, ${ARTICLE_LABEL} AS article, m.name AS member
    FROM bookings b JOIN articles a ON a.id = b.article_id JOIN members m ON m.id = b.member_id
    WHERE b.${OPEN_KONTO.replace(/ AND /g, ' AND b.')} AND ${CUT('b.')} ORDER BY name_key(m.name, m.kind), b.created_at`).all(upTo, asOf, asOf);
}

admin.get('/export.xlsx', need('abrechnung', 'export'), asyncRoute(async (req, res) => {
  const { from, to } = defaultRange(req.query);
  const fixed = isTs(req.query.asOf) && req.query.asOf <= nowTs() && req.query.upTo !== undefined;
  const wb = await buildExport(from, to, fixed ? req.query.asOf : nowTs(), fixed ? Math.min(int(req.query.upTo), maxBookingId()) : maxBookingId());
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="Getraenke_${from}_bis_${to}.xlsx"`);
  audit(req.user, 'Excel exportiert', `${from} bis ${to}`);
  await wb.xlsx.write(res);
  res.end();
}));

/* ---------- Dropbox: täglicher Export (alle Rechte) ---------- */
const dbxCfg = () => ({ appKey: getSetting('dropbox_app_key', ''), appSecret: getSetting('dropbox_app_secret', ''),
  refresh: getSetting('dropbox_refresh', ''), folder: getSetting('dropbox_folder', '/Clubwerk'),
  enabled: getSetting('dropbox_enabled', '1') === '1' });
const dbxReady = c => Boolean(c.appKey && c.appSecret && c.refresh);
/* ---------- Datensicherung (Kern, unabhängig von den Modulen) ----------
   Jede Nacht: verschlüsselte Komplettsicherung (Datenbank aller Module, Belege, Bilder, Erweiterungen) – lokal die
   letzten 3, in Dropbox nach Generationen (täglich/wöchentlich/monatlich). Optional lesbare Auszüge der Module (Excel).
   Monatlich eine Probe-Wiederherstellung, die prüft, ob sich die letzte Sicherung vollständig entschlüsseln lässt. */
const KOMPLETT_DIR = path.join(backup.BACKUP_DIR, 'komplett');
const INCOMING_DIR = path.join(DATA_DIR, '.sicherung-eingang');
const bkKey = () => ({ key: getSetting('backup_enc_key', ''), kdf: (() => { try { return JSON.parse(getSetting('backup_kdf', '')); } catch (e) { return null; } })() });
const bkHasKey = () => Boolean(getSetting('backup_enc_key', '') && bkKey().kdf);
const bkCfg = () => ({ hour: Math.max(0, Math.min(23, int(getSetting('backup_hour', '3'), 3))), daily: Math.max(1, Math.min(60, int(getSetting('backup_daily', '7'), 7))),
  weekly: Math.max(0, Math.min(52, int(getSetting('backup_weekly', '4'), 4))), monthly: Math.max(0, Math.min(120, int(getSetting('backup_monthly', '12'), 12))),
  readable: getSetting('backup_readable', '0') === '1' });   // Standard aus: die Auszüge (Namen, Beträge, Türprotokoll) liegen unverschlüsselt im Ziel
let bkRunning = false;

/** Lesbare Auszüge der aktiven Module: [{ name, buffer }] – jedes Modul liefert seinen eigenen Teil */
async function readableExports() {
  const out = [];
  if (plugins.isActive('getraenke')) {
    const { from, to } = defaultRange({});
    const wb = await buildExport(from, to);
    out.push({ name: 'Getraenke-Stand.xlsx', buffer: Buffer.from(await wb.xlsx.writeBuffer()) });
  }
  for (const p of plugins.withHook('backupExports')) {
    try { for (const f of (await p.hooks.backupExports()) || []) if (f && f.name && f.buffer) out.push({ name: String(f.name).replace(/[^\w.-]/g, '_').slice(0, 80), buffer: Buffer.from(f.buffer) }); }
    catch (e) { console.error(`Sicherung – Auszug ${p.meta.id}:`, e.message); }
  }
  return out;
}

/* ---------- Sicherungsziele: Dropbox + beliebig viele WebDAV/SFTP/FTPS-Ziele ---------- */
const MAX_TARGETS = 6;
const tgList = () => { try { const l = JSON.parse(getSetting('backup_targets', '[]')); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
const tgSave = l => setSetting('backup_targets', JSON.stringify(l));
const tgSecretKey = id => `backup_target_${id}_secret`;
const tgStatus = id => { try { return JSON.parse(getSetting(`backup_target_${id}_status`, '{}')) || {}; } catch (e) { return {}; } };
const tgSetStatus = (id, o) => setSetting(`backup_target_${id}_status`, JSON.stringify({ ...tgStatus(id), ...o, last_try: new Date().toISOString() }));
/** Alle eingeschalteten Ziele (Dropbox zuerst) mit Adapter */
function activeTargets() {
  const out = [];
  const c = dbxCfg();
  if (dbxReady(c) && c.enabled) out.push({ id: 'dropbox', name: 'Dropbox', type: 'dropbox', retention: null, adapter: () => targets.dropboxTarget(c) });
  for (const t of tgList()) if (t.enabled) out.push({ ...t, adapter: () => targets.open(t, getSetting(tgSecretKey(t.id), '')) });
  return out;
}
function targetById(id) {
  if (id === 'dropbox') { const c = dbxCfg(); return dbxReady(c) ? { id, name: 'Dropbox', type: 'dropbox', adapter: () => targets.dropboxTarget(c) } : null; }
  const t = tgList().find(x => x.id === id);
  return t ? { ...t, adapter: () => targets.open(t, getSetting(tgSecretKey(t.id), '')) } : null;
}
/** Übersicht für die Verwaltung – nie mit Zugangsdaten */
function targetsView() {
  const c = dbxCfg();
  const rows = [];
  if (dbxReady(c)) rows.push({ id: 'dropbox', name: 'Dropbox', type: 'dropbox', typeLabel: 'Dropbox', enabled: c.enabled, where: `Apps/…${c.folder}`, account: getSetting('dropbox_account', ''), ...tgStatus('dropbox') });
  for (const t of tgList()) rows.push({ ...targets.publicView(t, getSetting(tgSecretKey(t.id), '')), where: t.type === 'webdav' ? `${t.url}${t.folder}` : `${t.host}:${t.port}${t.folder}`, ...tgStatus(t.id) });
  return rows;
}

async function runBackup(by = 'automatisch') {
  if (!bkHasKey()) throw new Error('Noch kein Sicherungspasswort festgelegt (Datensicherung → Sicherungspasswort).');
  if (bkRunning) throw new Error('Die Sicherung läuft gerade schon.');
  bkRunning = true;
  const day = backup.stamp().slice(0, 10);
  try {
    const k = bkKey();
    const r = await fullbackup.create({ db, dataDir: DATA_DIR, outDir: KOMPLETT_DIR, key: k.key, kdf: k.kdf, appVersion: APP_VERSION, club: getSetting('club_name', ''), standalone: backup.standalone });
    // lokal nur die letzten 3 (alles Weitere steckt im Home-Assistant-Backup bzw. in Dropbox)
    for (const old of fullbackup.list(KOMPLETT_DIR).slice(3)) { try { fs.unlinkSync(path.join(KOMPLETT_DIR, old.file)); } catch (e) { /* egal */ } }
    const parts = [`Komplettsicherung ${r.size >= 1048576 ? (r.size / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(r.size / 1024)) + ' KB'}`];
    const g = bkCfg();
    const list = activeTargets();
    let lesbarFiles = null; const failed = [];
    for (const tg of list) {
      const a = tg.adapter();
      try {
        await a.put('Komplett', `${day}_Clubwerk${fullbackup.EXT}`, { path: r.path });
        let lesbar = 0;
        if (g.readable) { if (!lesbarFiles) lesbarFiles = await readableExports(); for (const f of lesbarFiles) { await a.put('Lesbar', `${day}_${f.name}`, { buffer: f.buffer }); lesbar++; } }
        let removed = 0;
        const ret = tg.retention || g;
        for (const sub of ['Komplett', 'Lesbar']) {
          const files = await a.list(sub);
          const del = new Set(fullbackup.generations(files.map(e => e.name), ret));
          for (const e of files) if (del.has(e.name)) { await a.remove(sub, e.name); removed++; }
        }
        tgSetStatus(tg.id, { last_ok: new Date().toISOString(), last_error: '', msg: `${lesbar ? lesbar + ' lesbare Auszüge, ' : ''}${removed} ältere aufgeräumt` });
        parts.push(`${tg.name} ✓` + (lesbar ? ` (+${lesbar} lesbar)` : ''));
      } catch (e) {
        tgSetStatus(tg.id, { last_error: `${new Date().toISOString()} ${e.message}` });
        failed.push(`${tg.name}: ${e.message}`);
        parts.push(`${tg.name} ✗`);
        securityAlert(`Die Datensicherung konnte nicht nach „${tg.name}“ übertragen werden: ${e.message}`, `backup-target-${tg.id}-${day}`);
      } finally { await a.close(); }
    }
    if (!list.length) parts.push('nur lokal (kein Sicherungsziel eingerichtet)');
    const msg = `${day}: ${parts.join(', ')}`;
    setSetting('backup_last_ok', new Date().toISOString()); setSetting('backup_last_msg', msg); setSetting('backup_last_error', failed.length ? `${new Date().toISOString()} ${failed.join(' · ')}` : ''); setSetting('backup_last_day', day);
    audit(by, 'Datensicherung', msg);
    return msg;
  } catch (e) {
    setSetting('backup_last_error', `${new Date().toISOString()} ${e.message}`);
    securityAlert(`Die Datensicherung ist fehlgeschlagen: ${e.message}`, 'backup-fail-' + day);
    throw e;
  } finally { bkRunning = false; }
}

/** Probe-Wiederherstellung: letzte lokale Sicherung vollständig entschlüsseln, entpacken und prüfen – ohne etwas zu überschreiben */
async function probeBackup() {
  const last = fullbackup.list(KOMPLETT_DIR)[0];
  if (!last) throw new Error('Noch keine Komplettsicherung vorhanden.');
  const tmp = fs.mkdtempSync(path.join(DATA_DIR, '.probe-'));
  try {
    const man = await fullbackup.extract(path.join(KOMPLETT_DIR, last.file), { key: bkKey().key, outDir: tmp });
    const err = backup.validate(path.join(tmp, fullbackup.DB_NAME));
    if (err) throw new Error(err);
    for (const [d, n] of Object.entries(man.dirs || {})) {
      const have = fs.existsSync(path.join(tmp, d)) ? fs.readdirSync(path.join(tmp, d), { recursive: true, withFileTypes: true }).filter(e => e.isFile()).length : 0;
      if (have !== n) throw new Error(`Ordner „${d}“: ${have} statt ${n} Dateien.`);
    }
    const msg = `${last.file}: lesbar und vollständig (${Object.entries(man.dirs || {}).map(([d, n]) => `${n} ${d}`).join(', ') || 'nur Datenbank'})`;
    setSetting('backup_probe_at', new Date().toISOString()); setSetting('backup_probe_ok', '1'); setSetting('backup_probe_msg', msg);
    return msg;
  } catch (e) {
    setSetting('backup_probe_at', new Date().toISOString()); setSetting('backup_probe_ok', '0'); setSetting('backup_probe_msg', e.message);
    securityAlert(`Die Probe-Wiederherstellung der Datensicherung ist fehlgeschlagen: ${e.message}`, 'backup-probe');
    throw e;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

/** Zustand für Übersicht und Seite „Datensicherung“ */
function backupStatus() {
  const lastOk = getSetting('backup_last_ok', '');
  const age = lastOk ? (Date.now() - Date.parse(lastOk)) / 3600000 : Infinity;
  const tv = targetsView();
  const on = tv.filter(t => t.enabled);
  // Ziel gilt als gestört, wenn der letzte Versuch fehlschlug und es seit zwei Tagen (oder noch nie) geklappt hat
  const broken = on.filter(t => t.last_error && (!t.last_ok || Date.now() - Date.parse(t.last_ok) > 48 * 3600000));
  const warn = !bkHasKey() ? 'Noch kein Sicherungspasswort festgelegt – es wird nichts gesichert.'
    : age > 48 ? (lastOk ? 'Seit mehr als zwei Tagen keine erfolgreiche Sicherung.' : 'Noch keine Komplettsicherung erstellt.')
    : broken.length ? `Sicherungsziel ${broken.map(t => `„${t.name}“`).join(', ')} ${broken.length > 1 ? 'sind' : 'ist'} nicht erreichbar – die Sicherung kommt dort nicht an.`
    : getSetting('backup_probe_ok', '') === '0' ? 'Die letzte Probe-Wiederherstellung ist fehlgeschlagen.'
    : !on.length ? 'Kein Sicherungsziel eingerichtet – die Sicherung liegt nur hier auf dem Gerät. Bitte Dropbox, ein NAS oder eine Cloud als Ziel einrichten.' : '';
  return { hasKey: bkHasKey(), pwAt: getSetting('backup_pw_at', ''), ...bkCfg(), dropbox: on.some(t => t.id === 'dropbox'),
    targets: tv, targetsOk: on.length - broken.length, targetsOn: on.length,
    last_ok: lastOk, last_msg: getSetting('backup_last_msg', ''), last_error: getSetting('backup_last_error', ''),
    probe_at: getSetting('backup_probe_at', ''), probe_ok: getSetting('backup_probe_ok', '') === '1', probe_msg: getSetting('backup_probe_msg', ''),
    local: fullbackup.list(KOMPLETT_DIR), warn, warnLevel: !warn ? '' : (!bkHasKey() || (age <= 48 && !broken.length && getSetting('backup_probe_ok', '') !== '0')) ? 'a' : 'r' };
}

/** Nur das Adminkonto/„alle Rechte“ und mit eigenem Passwort bestätigt */
function ownerConfirm(req, res) {
  if (req.user.role !== 'oberadmin') { bad(res, 'Das darf nur ein Benutzer mit allen Rechten.', 403); return false; }
  // bei Datei-Uploads (Rohdaten) kommt das Passwort in der Kopfzeile X-Mein-Passwort (URL-kodiert)
  let pw = (req.body && !Buffer.isBuffer(req.body) && req.body.myPassword) || '';
  if (!pw && req.get('X-Mein-Passwort')) { try { pw = decodeURIComponent(req.get('X-Mein-Passwort')); } catch (e) { pw = ''; } }
  if (!ownPwOk(req, pw)) { bad(res, 'Dein Passwort stimmt nicht.', 401); return false; }
  return true;
}

admin.get('/backups/status', need('einstellungen'), (req, res) => res.json(backupStatus()));
admin.put('/backups/settings', need('einstellungen'), (req, res) => {
  const b = req.body || {};
  const num = (v, lo, hi) => { const n = parseInt(v, 10); if (!(n >= lo && n <= hi)) throw new Error('Ungültiger Wert.'); return String(n); };
  try {
    if (b.hour !== undefined) setSetting('backup_hour', num(b.hour, 0, 23));
    if (b.daily !== undefined) setSetting('backup_daily', num(b.daily, 1, 60));
    if (b.weekly !== undefined) setSetting('backup_weekly', num(b.weekly, 0, 52));
    if (b.monthly !== undefined) setSetting('backup_monthly', num(b.monthly, 0, 120));
  } catch (e) { return bad(res, 'Bitte gültige Zahlen eintragen (Uhrzeit 0–23, Tage 1–60, Wochen 0–52, Monate 0–120).'); }
  if (b.readable !== undefined) setSetting('backup_readable', b.readable ? '1' : '0');
  audit(req.user, 'Datensicherung eingestellt', JSON.stringify(bkCfg()));
  res.json({ ok: true, ...backupStatus() });
});
admin.post('/backups/password', need('einstellungen'), rateLimit('bkpw', 10, 10 * 60000), (req, res) => {
  if (!ownerConfirm(req, res)) return;
  let k; try { k = fullbackup.newKey((req.body || {}).password); } catch (e) { return bad(res, e.message); }
  const had = bkHasKey();
  setSetting('backup_kdf', JSON.stringify(k.kdf)); setSetting('backup_enc_key', k.key); setSetting('backup_pw_at', nowTs());
  audit(req.user, had ? 'Sicherungspasswort geändert' : 'Sicherungspasswort festgelegt', k.kid.slice(0, 8));
  res.json({ ok: true, changed: had });
});
/* Sicherungspasswort prüfen (für das Notfallblatt) – nur „alle Rechte“, gebremst */
admin.post('/backups/password/check', need('einstellungen'), owner, rateLimit('bkcheck', 10, 10 * 60000), (req, res) => {
  const k = bkKey(); if (!k.key || !k.kdf) return bad(res, 'Noch kein Sicherungspasswort festgelegt.');
  let ok = false; try { ok = fullbackup.keyId(fullbackup.deriveKey(String((req.body || {}).password || ''), k.kdf)) === fullbackup.keyId(Buffer.from(k.key, 'hex')); } catch (e) { ok = false; }
  if (!ok) return bad(res, 'Das Sicherungspasswort stimmt nicht.', 401);
  res.json({ ok: true });
});
admin.post('/backups/run', need('einstellungen'), asyncRoute(async (req, res) => {
  try { res.json({ ok: true, msg: await runBackup(req.user.username) }); } catch (e) { bad(res, e.message); }
}));
admin.post('/backups/probe', need('einstellungen'), asyncRoute(async (req, res) => {
  try { res.json({ ok: true, msg: await probeBackup() }); } catch (e) { bad(res, e.message); }
}));
admin.get('/backups/komplett/file/:file', need('einstellungen'), (req, res) => {
  if (!fullbackup.validName(req.params.file) || !fs.existsSync(path.join(KOMPLETT_DIR, req.params.file))) return bad(res, 'Sicherung nicht gefunden.', 404);
  audit(req.user, 'Komplettsicherung heruntergeladen', req.params.file);
  res.download(path.join(KOMPLETT_DIR, req.params.file), req.params.file);
});
/* Sicherungen in Dropbox (für „Wiederherstellen aus Dropbox“) und alte, unverschlüsselte Dateien aus früheren Versionen */
admin.get('/backups/remote', need('einstellungen'), asyncRoute(async (req, res) => {
  const c = dbxCfg();
  if (!dbxReady(c)) return res.json({ connected: false, files: [], legacy: 0 });
  try {
    const files = (await dropbox.listFolder(c, `${c.folder}/Komplett`)).filter(e => e['.tag'] === 'file' && fullbackup.validName(e.name))
      .map(e => ({ file: e.name, size: e.size, mtime: e.server_modified })).sort((a, b) => (a.file < b.file ? 1 : -1));
    let legacy = 0;
    for (const sub of ['Datenbank', 'Excel']) legacy += (await dropbox.listFolder(c, `${c.folder}/${sub}`)).filter(e => e['.tag'] === 'file').length;
    res.json({ connected: true, files, legacy });
  } catch (e) { bad(res, e.message, 502); }
}));
admin.post('/backups/remote/cleanup-legacy', need('einstellungen'), asyncRoute(async (req, res) => {
  if (!ownerConfirm(req, res)) return;
  const c = dbxCfg(); if (!dbxReady(c)) return bad(res, 'Dropbox ist nicht verbunden.');
  let n = 0;
  for (const sub of ['Datenbank', 'Excel']) for (const e of await dropbox.listFolder(c, `${c.folder}/${sub}`)) if (e['.tag'] === 'file') { await dropbox.remove(c, e.path_lower); n++; }
  audit(req.user, 'Alte unverschlüsselte Dropbox-Sicherungen gelöscht', `${n} Dateien`);
  res.json({ ok: true, removed: n });
}));
/* ---------- Sicherungsziele verwalten ----------
   Ansehen und Testen: „Einstellungen“. Anlegen, ändern, ein-/ausschalten, löschen: nur „alle Rechte“ mit eigenem Passwort –
   ein Ziel bekommt jede Nacht die (verschlüsselte) Sicherung, und Abschalten nähme dem Verein die Sicherung außer Haus. */
admin.get('/backups/targets', need('einstellungen'), (req, res) => res.json({ targets: targetsView(), types: targets.TYPES, max: MAX_TARGETS }));
/** Verbindung prüfen – mit gespeicherten oder (beim Anlegen/Bearbeiten) eingegebenen Daten */
admin.post('/backups/targets/test', need('einstellungen'), owner, rateLimit('tgtest', 20, 10 * 60000), asyncRoute(async (req, res) => {
  const b = req.body || {};
  const old = b.id ? tgList().find(x => x.id === b.id) : null;
  let t; try { t = targets.clean({ ...(b.target || {}), allowInsecure: true }, old); } catch (e) { return bad(res, e.message); }
  // Das gespeicherte Passwort nur für denselben Server verwenden – sonst ließe es sich mit einer geänderten Adresse an einen fremden Server schicken
  const same = old && ['type', 'url', 'host', 'port', 'user', 'mode', 'insecure', 'hostKey', 'certFp'].every(k => (t[k] ?? '') === (old[k] ?? ''));
  if (old && !same && !b.secret && t.auth !== 'key') return bad(res, 'Die Adresse oder der Server hat sich geändert – bitte das Passwort für den Test noch einmal eingeben.');
  const secret = b.secret ? String(b.secret) : same ? getSetting(tgSecretKey(old.id), '') : '';
  const a = targets.open(t, secret);
  try { const r = await a.test(); res.json({ ok: true, fingerprint: r.fingerprint || null }); }
  catch (e) { if (e.needConfirm || e.changed) return res.json({ ok: false, needConfirm: true, changed: Boolean(e.changed), fingerprint: e.fingerprint, error: e.message }); bad(res, e.message); }
  finally { await a.close(); }
}));
admin.post('/backups/targets/:id/test', need('einstellungen'), rateLimit('tgtest', 20, 10 * 60000), asyncRoute(async (req, res) => {
  const tg = targetById(String(req.params.id)); if (!tg) return bad(res, 'Sicherungsziel nicht gefunden.', 404);
  const a = tg.adapter();
  try { await a.test(); tgSetStatus(tg.id, { tested: new Date().toISOString(), test_error: '' }); res.json({ ok: true }); }
  catch (e) { tgSetStatus(tg.id, { test_error: e.message }); bad(res, e.message); }
  finally { await a.close(); }
}));
/** Anlegen/Bearbeiten: wird nur gespeichert, wenn die Verbindung klappt (inkl. bestätigtem Fingerabdruck) */
async function saveTarget(req, res, old) {
  if (!ownerConfirm(req, res)) return;
  const b = req.body || {};
  if (!old && tgList().length >= MAX_TARGETS) return bad(res, `Höchstens ${MAX_TARGETS} Sicherungsziele.`);
  let t; try { t = targets.clean(b.target || {}, old); } catch (e) { return res.status(400).json({ error: e.message, needInsecure: Boolean(e.needInsecure) }); }
  const secret = b.secret ? String(b.secret).slice(0, 20000) : old ? getSetting(tgSecretKey(old.id), '') : '';
  if (!secret) return bad(res, t.type === 'sftp' && t.auth === 'key' ? 'Bitte den privaten Schlüssel einfügen.' : 'Bitte das Passwort eintragen.');
  if (t.enabled) {
    const a = targets.open(t, secret);
    try { await a.test(); }
    catch (e) { return res.status(400).json({ error: e.message, needConfirm: Boolean(e.needConfirm || e.changed), fingerprint: e.fingerprint || null }); }
    finally { await a.close(); }
  }
  const list = tgList().filter(x => x.id !== t.id); list.push(t); tgSave(list);
  setSetting(tgSecretKey(t.id), secret);
  audit(req.user, old ? 'Sicherungsziel geändert' : 'Sicherungsziel angelegt', `${t.name} (${targets.TYPES[t.type]}${t.enabled ? '' : ', aus'})`);
  if (old && old.enabled && !t.enabled) securityAlert(`Das Sicherungsziel „${t.name}“ wurde von ${req.user.name || req.user.username} ausgeschaltet.`, 'tg-off-' + t.id);
  res.json({ ok: true, targets: targetsView() });
}
admin.post('/backups/targets', need('einstellungen'), rateLimit('tgsave', 20, 10 * 60000), asyncRoute(async (req, res) => saveTarget(req, res, null)));
admin.put('/backups/targets/:id', need('einstellungen'), rateLimit('tgsave', 20, 10 * 60000), asyncRoute(async (req, res) => {
  const old = tgList().find(x => x.id === String(req.params.id)); if (!old) return bad(res, 'Sicherungsziel nicht gefunden.', 404);
  return saveTarget(req, res, old);
}));
admin.delete('/backups/targets/:id', need('einstellungen'), (req, res) => {
  if (!ownerConfirm(req, res)) return;
  const old = tgList().find(x => x.id === String(req.params.id)); if (!old) return bad(res, 'Sicherungsziel nicht gefunden.', 404);
  tgSave(tgList().filter(x => x.id !== old.id));
  db.prepare('DELETE FROM settings WHERE key IN (?, ?)').run(tgSecretKey(old.id), `backup_target_${old.id}_status`);
  audit(req.user, 'Sicherungsziel entfernt', old.name);
  securityAlert(`Das Sicherungsziel „${old.name}“ wurde von ${req.user.name || req.user.username} entfernt. Die Dateien dort bleiben erhalten.`, 'tg-del-' + old.id);
  res.json({ ok: true, targets: targetsView() });
});
/** Komplettsicherungen auf einem Ziel (für „Wiederherstellen“) */
admin.get('/backups/targets/:id/files', need('einstellungen'), asyncRoute(async (req, res) => {
  const tg = targetById(String(req.params.id)); if (!tg) return bad(res, 'Sicherungsziel nicht gefunden.', 404);
  const a = tg.adapter();
  try { res.json({ files: (await a.list('Komplett')).filter(f => fullbackup.validName(f.name)).map(f => ({ file: f.name, size: f.size, mtime: f.mtime })).sort((x, y) => (x.file < y.file ? 1 : -1)) }); }
  catch (e) { bad(res, e.message, 502); }
  finally { await a.close(); }
}));

/* ---------- Große Uploads (Datenbank, Update-Paket, Modul-Sicherung): gestreamt auf die Platte ----------
   express.raw() würde die ganze Datei (bis 200 MB) im Speicher puffern – auf einem Raspberry Pi mit knapp 1 GB zu viel.
   Hier fließt der Anfragekörper mit Größenwächter direkt in eine Datei (INCOMING_DIR); die Route verarbeitet dann die Datei. */
/** Anfragekörper nach dest streamen → Bytes. Bei Überschreitung von max oder Abbruch wird die Datei entfernt und ein Fehler geworfen. */
async function receiveToFile(req, dest, max) {
  fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
  let n = 0;
  const guard = new (require('stream').Transform)({ transform(c, e, cb) { n += c.length; if (n > max) cb(Object.assign(new Error('Die Datei ist zu groß.'), { tooLarge: true })); else cb(null, c); } });
  try { await require('stream/promises').pipeline(req, guard, fs.createWriteStream(dest, { mode: 0o600 })); }
  catch (e) { try { fs.unlinkSync(dest); } catch (x) { /* egal */ } throw e; }
  return n;
}
/** Middleware: Datei-Upload (alles außer JSON) nach INCOMING_DIR streamen → req.uploadFile, req.uploadSize; JSON-Anfragen laufen wie gewohnt weiter */
const streamUpload = (max, ext = '.bin') => (req, res, next) => {
  if (/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return express.json({ limit: '1mb' })(req, res, next);
  const dest = path.join(INCOMING_DIR, `up_${crypto.randomBytes(12).toString('hex')}${ext}`);
  receiveToFile(req, dest, max).then(n => { req.uploadFile = dest; req.uploadSize = n; next(); })
    .catch(e => bad(res, e.tooLarge ? 'Die Datei ist zu groß.' : 'Hochladen fehlgeschlagen: ' + e.message, e.tooLarge ? 413 : 400));
};
const dropUpload = req => { if (req.uploadFile) { try { fs.unlinkSync(req.uploadFile); } catch (e) { /* schon weg */ } } };
const MB = 1024 * 1024;

/* ---------- Update per ZIP-Upload (nur Seitenleiste von Home Assistant, nur „alle Rechte“, mit Passwort) ---------- */
const UPDATE_DIR = path.join(DATA_DIR, '.update');
const RESERVE_DIR = path.join(DATA_DIR, 'update-reserve');
let staged = null;   // geprüftes, noch nicht übernommenes Paket
let updating = false;
const updGuard = (req, res) => {
  if (req.user.role !== 'oberadmin') { bad(res, 'Updates einspielen darf nur ein Benutzer mit allen Rechten.', 403); return false; }
  if (!viaIngress(req) && process.env.CW_TEST_UPDATE_ANYWHERE !== '1') { bad(res, 'Updates gehen aus Sicherheitsgründen nur über die Home-Assistant-Seitenleiste.', 403); return false; }
  return true;
};
admin.get('/update/status', need('einstellungen'), asyncRoute(async (req, res) => {
  const o = await selfupdate.origin();
  res.json({ current: APP_VERSION, node: process.version, nodeOld: require('./security').nodeOutdated(), addonDir: Boolean(o.dir), origin: o.kind, mounted: o.mounted, supervisorError: o.supervisorError || '', supervisor: Boolean(process.env.SUPERVISOR_TOKEN),
    viaIngress: viaIngress(req) || process.env.CW_TEST_UPDATE_ANYWHERE === '1', owner: req.user.role === 'oberadmin', updating,
    staged: staged ? { version: staged.version, files: staged.files, size: staged.size, depsChanged: staged.depsChanged, changelog: staged.changelog } : null,
    reserves: selfupdate.reserves(RESERVE_DIR), lastError: getSetting('update_last_error', ''), lastOk: getSetting('update_last_ok', '') });
}));
admin.post('/update/upload', need('einstellungen'), rateLimit('updup', 10, 10 * 60000), streamUpload(200 * MB, '.zip'), asyncRoute(async (req, res) => {
  try {
    if (!updGuard(req, res)) return;
    if (!selfupdate.findAddonDir()) return bad(res, 'Diese Installation kommt nicht aus dem Ordner „addons“ (z. B. über GitHub) – Updates bitte über Home Assistant → Einstellungen → Add-ons.');
    if (!req.uploadFile || req.uploadSize < 100) return bad(res, 'Die Datei ist leer.');
    try {
      const info = await selfupdate.inspect(req.uploadFile, path.join(UPDATE_DIR, 'neu'), { currentVersion: APP_VERSION, currentDir: selfupdate.findAddonDir() });
      if (!info.newer) { staged = null; return bad(res, info.same ? `Version ${info.version} ist bereits installiert.` : `Das Paket (${info.version}) ist älter als die installierte Version ${APP_VERSION}. Zurück zu einer früheren Version geht über „Vorherige Version“.`); }
      staged = info;
      audit(req.user, 'Update hochgeladen und geprüft', `${APP_VERSION} → ${info.version} · Prüfsumme ${info.shaShort}`);
      res.json({ ok: true, current: APP_VERSION, ...info });
    } catch (e) { staged = null; bad(res, e.message); }
  } finally { dropUpload(req); }
}));
/** Übernehmen: Sicherung, Ordner tauschen, Home Assistant aktualisieren lassen (im Hintergrund) */
async function applyFolder(req, res, newDir, label) {
  const dir = selfupdate.findAddonDir();
  if (!dir) return bad(res, 'Der Add-on-Ordner wurde nicht gefunden.');
  updating = true;
  try {
    // vorher sichern: Komplettsicherung (falls Sicherungspasswort festgelegt), sonst Datenbank-Schnappschuss
    try { if (bkHasKey()) await runBackup(req.user.username); else await backup.snapshot(db, 'manuell'); }
    catch (e) { updating = false; return bad(res, 'Die Sicherung vor dem Update ist fehlgeschlagen – Update abgebrochen: ' + e.message); }
    const reserve = selfupdate.swap(dir, newDir, RESERVE_DIR, APP_VERSION);
    setSetting('update_last_error', '');
    audit(req.user, label, `${APP_VERSION} → ${selfupdate.yamlField(fs.readFileSync(path.join(dir, 'config.yaml'), 'utf8'), 'version')} (Reserve ${reserve})`);
    securityAlert(`Clubwerk wird von ${req.user.name || req.user.username} aktualisiert (${label}).`, 'update-' + Date.now());
    res.json({ ok: true, reserve, supervisor: Boolean(process.env.SUPERVISOR_TOKEN) });
  } catch (e) { updating = false; return bad(res, 'Update fehlgeschlagen: ' + e.message); }
  // Antwort ist raus – jetzt Home Assistant bitten, neu zu bauen (dabei wird diese Version beendet)
  setTimeout(async () => {
    try { const r = await selfupdate.triggerUpdate(); console.log('Update ausgelöst:', r); setSetting('update_last_ok', new Date().toISOString()); }
    catch (e) { console.error('Update auslösen:', e.message); setSetting('update_last_error', e.message); updating = false; }
  }, 500);
}
admin.post('/update/apply', need('einstellungen'), rateLimit('updapply', 5, 10 * 60000), asyncRoute(async (req, res) => {
  if (!updGuard(req, res) || !ownerConfirm(req, res)) return;
  if (!staged) return bad(res, 'Bitte zuerst das Update-Paket hochladen.');
  if (updating) return bad(res, 'Das Update läuft bereits.');
  staged = null;
  return applyFolder(req, res, path.join(UPDATE_DIR, 'neu'), 'Update eingespielt');
}));
admin.post('/update/rollback', need('einstellungen'), rateLimit('updapply', 5, 10 * 60000), asyncRoute(async (req, res) => {
  if (!updGuard(req, res) || !ownerConfirm(req, res)) return;
  const name = String((req.body || {}).name || '');
  const r = selfupdate.reserves(RESERVE_DIR).find(x => x.name === name);
  if (!r) return bad(res, 'Diese frühere Version gibt es nicht (mehr).');
  // Reserve erst kopieren – beim Tausch wird die aktuelle Version selbst zur Reserve
  const tmp = path.join(UPDATE_DIR, 'zurueck'); fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(path.join(RESERVE_DIR, name), tmp, { recursive: true });
  return applyFolder(req, res, tmp, `Zurück auf Version ${r.version}`);
}));
/* Fehler beim Auslösen nach Neustart zurücksetzen, sobald die neue Version läuft */
if (getSetting('update_running_version', '') !== APP_VERSION) { setSetting('update_running_version', APP_VERSION); setSetting('update_last_error', ''); }
/* Komplettsicherung von einem anderen Gerät hochladen (gestreamt, ohne alles in den Speicher zu laden) */
admin.post('/backups/komplett/upload', need('einstellungen'), owner, asyncRoute(async (req, res) => {
  fs.mkdirSync(INCOMING_DIR, { recursive: true, mode: 0o700 });
  for (const f of fs.readdirSync(INCOMING_DIR)) { try { if (Date.now() - fs.statSync(path.join(INCOMING_DIR, f)).mtimeMs > 6 * 3600000) fs.unlinkSync(path.join(INCOMING_DIR, f)); } catch (e) { /* egal */ } }
  const id = crypto.randomBytes(12).toString('hex');
  const dest = path.join(INCOMING_DIR, `up_${id}${fullbackup.EXT}`);
  let n;
  try { n = await receiveToFile(req, dest, 4 * 1024 * MB); }
  catch (e) { return bad(res, 'Hochladen fehlgeschlagen: ' + e.message, e.tooLarge ? 413 : 400); }
  let h; try { h = fullbackup.readHeader(dest).head; } catch (e) { fs.unlinkSync(dest); return bad(res, e.message); }
  res.json({ ok: true, id, created: h.created, app: h.app, size: n, sameKey: h.kid === (bkHasKey() ? fullbackup.keyId(Buffer.from(bkKey().key, 'hex')) : '') });
}));
/* Wiederherstellen aus einer Komplettsicherung (lokal, aus Dropbox oder hochgeladen) – wirksam beim nächsten Neustart */
admin.post('/backups/komplett/restore', need('einstellungen'), rateLimit('bkrestore', 6, 10 * 60000), asyncRoute(async (req, res) => {
  if (!ownerConfirm(req, res)) return;
  const b = req.body || {};
  let src = null, temp = false;
  try {
    if (b.source === 'local') { if (fullbackup.validName(b.file) && fs.existsSync(path.join(KOMPLETT_DIR, b.file))) src = path.join(KOMPLETT_DIR, b.file); }
    else if (b.source === 'upload') { if (/^[a-f0-9]{24}$/.test(String(b.file || ''))) { src = path.join(INCOMING_DIR, `up_${b.file}${fullbackup.EXT}`); temp = true; if (!fs.existsSync(src)) src = null; } }
    else if (b.source === 'dropbox' || b.source === 'target') {
      const tg = targetById(b.source === 'dropbox' ? 'dropbox' : String(b.target || ''));
      if (!tg) return bad(res, 'Sicherungsziel nicht gefunden.', 404);
      if (fullbackup.validName(b.file)) {
        fs.mkdirSync(INCOMING_DIR, { recursive: true, mode: 0o700 });
        src = path.join(INCOMING_DIR, `dl_${crypto.randomBytes(8).toString('hex')}${fullbackup.EXT}`); temp = true;
        const a = tg.adapter();
        try { await a.get('Komplett', b.file, src); } finally { await a.close(); }
      }
    }
    if (!src) return bad(res, 'Sicherung nicht gefunden.', 404);
    const tmp = fs.mkdtempSync(path.join(DATA_DIR, '.wiederherstellung-'));
    try {
      const pw = String(b.password || '');
      const man = await fullbackup.extract(src, pw ? { password: pw, outDir: tmp } : { key: bkHasKey() ? bkKey().key : null, outDir: tmp });
      const err = backup.validate(path.join(tmp, fullbackup.DB_NAME));
      if (err) throw new Error(err);
      const name = `getraenke_${backup.stamp()}_komplett.db`;
      fs.renameSync(path.join(tmp, fullbackup.DB_NAME), path.join(backup.BACKUP_DIR, name));
      backup.markRestore(name);
      backup.stageDirs(tmp, name, fullbackup.DIRS);
      audit(req.user, 'Wiederherstellung aus Komplettsicherung vorgemerkt', `${b.source}: ${b.file} (Stand ${man.created})`);
      res.json({ ok: true, restart: true, created: man.created, club: man.club, dirs: man.dirs });
    } catch (e) {
      if (e.needPassword) { if (b.source === 'upload') temp = false; return res.status(400).json({ error: e.message, needPassword: true }); }
      throw e;
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  } catch (e) { bad(res, e.message); }
  finally { if (temp && src) { try { fs.unlinkSync(src); } catch (e) { /* egal */ } } }
}));

admin.get('/dropbox', need('einstellungen'), (req, res) => {
  const c = dbxCfg();
  res.json({ appKey: c.appKey, hasSecret: Boolean(c.appSecret), connected: dbxReady(c), folder: c.folder, enabled: c.enabled,
    account: getSetting('dropbox_account', ''), authUrl: c.appKey ? dropbox.authUrl(c.appKey) : null });
});
admin.put('/dropbox', need('einstellungen'), (req, res) => {
  const b = req.body || {};
  if (b.appKey !== undefined) {
    const k = String(b.appKey).trim();
    if (k && !/^[a-z0-9]{8,40}$/i.test(k)) return bad(res, 'Der App key sieht nicht richtig aus.');
    if (k !== getSetting('dropbox_app_key', '')) setSetting('dropbox_refresh', '');   // andere App → neu verbinden
    setSetting('dropbox_app_key', k);
  }
  if (b.appSecret) {
    const sec = String(b.appSecret).trim();
    if (!/^[a-z0-9]{8,40}$/i.test(sec)) return bad(res, 'Das App secret sieht nicht richtig aus.');
    setSetting('dropbox_app_secret', sec);
  }
  if (b.folder !== undefined) setSetting('dropbox_folder', dropbox.cleanFolder(b.folder));
  if (b.enabled !== undefined) {
    if (!b.enabled && getSetting('dropbox_enabled', '1') === '1') securityAlert(`Die nächtliche Sicherung nach Dropbox wurde von ${req.user.name || req.user.username} pausiert.`, 'dbx-off');
    setSetting('dropbox_enabled', b.enabled ? '1' : '0');
  }
  audit(req.user, 'Dropbox-Einstellungen geändert');
  res.json({ ok: true });
});
admin.post('/dropbox/connect', need('einstellungen'), asyncRoute(async (req, res) => {
  const c = dbxCfg();
  if (!c.appKey || !c.appSecret) return bad(res, 'Bitte zuerst App key und App secret speichern.');
  const code = String((req.body || {}).code || '').trim();
  if (!/^[\w-]{10,200}$/.test(code)) return bad(res, 'Bitte den Code aus dem Dropbox-Fenster einfügen.');
  try {
    const refresh = await dropbox.exchangeCode(c.appKey, c.appSecret, code);
    setSetting('dropbox_refresh', refresh);
    let who = '';
    try { who = await dropbox.account({ ...c, refresh }); } catch (e) { /* App ohne Kontoberechtigung – egal */ }
    setSetting('dropbox_account', who);
    audit(req.user, 'Dropbox verbunden', who);
    res.json({ ok: true, account: who });
  } catch (e) { bad(res, e.message); }
}));
admin.post('/dropbox/disconnect', need('einstellungen'), asyncRoute(async (req, res) => {
  const c = dbxCfg();
  if (dbxReady(c)) await dropbox.revoke(c);
  setSetting('dropbox_refresh', ''); setSetting('dropbox_account', '');
  audit(req.user, 'Dropbox getrennt');
  res.json({ ok: true });
}));

/* ---------- Datensicherung (alle Rechte) ---------- */
admin.get('/backups', need('einstellungen'), (req, res) => {
  res.json({ list: backup.list(), pending: backup.pendingRestore(), restored: restoredMsg,
    beleg_count: belegFiles().length });
});

admin.post('/backups', need('einstellungen'), asyncRoute(async (req, res) => {
  const file = await backup.snapshot(db, 'manuell');
  audit(req.user, 'Sicherung erstellt', file);
  res.json({ file });
}));

admin.get('/backups/file/:file', need('einstellungen'), (req, res) => {
  const f = req.params.file;
  if (!backup.safeName(f) || !fs.existsSync(path.join(backup.BACKUP_DIR, f))) return bad(res, 'Nicht gefunden.', 404);
  audit(req.user, 'Sicherung heruntergeladen', f);
  res.download(path.join(backup.BACKUP_DIR, f), f);
});

/* Komplettsicherung: frischer Datenbank-Schnappschuss + alle Belege und Artikelbilder als .tar.gz */
/* (die frühere unverschlüsselte Komplettsicherung als .tar.gz entfällt – ersetzt durch die verschlüsselte Komplettsicherung) */

admin.post('/backups/upload', need('einstellungen'), streamUpload(200 * MB, '.db'), asyncRoute(async (req, res) => {
  try {
    if (!req.uploadFile || req.uploadSize < 100) return bad(res, 'Die Datei ist leer.');
    const err = backup.validate(req.uploadFile);
    if (err) return bad(res, err);
    const name = `getraenke_${backup.stamp()}_hochgeladen.db`;
    fs.mkdirSync(backup.BACKUP_DIR, { recursive: true });
    fs.renameSync(req.uploadFile, path.join(backup.BACKUP_DIR, name));   // gleiche Platte (DATA_DIR) → nur umbenennen
    req.uploadFile = null;
    audit(req.user, 'Sicherung hochgeladen', name);
    res.json({ file: name });
  } finally { dropUpload(req); }
}));

admin.post('/backups/restore', need('einstellungen'), asyncRoute(async (req, res) => {
  if (!ownerConfirm(req, res)) return;   // ersetzt die ganze Datenbank (auch Benutzer und Rechte) – nur mit Passwort
  const f = String((req.body || {}).file || '');
  try { backup.markRestore(f); } catch (e) { return bad(res, e.message); }
  audit(req.user, 'Wiederherstellung vorgemerkt', f);
  res.json({ ok: true });
}));

admin.delete('/backups/restore', need('einstellungen'), (req, res) => {
  backup.cancelRestore();
  audit(req.user, 'Wiederherstellung abgebrochen');
  res.json({ ok: true });
});

/* Neustart: beendet den Prozess, der Watchdog von Home Assistant startet das Add-on neu */
/* Demo beenden und einrichten: alle Beispieldaten restlos löschen (beim Neustart, src/demo.js) – mit eigenem Passwort bestätigt */
admin.post('/demo/ende', need('einstellungen'), owner, rateLimit('demoende', 10, 10 * 60000), (req, res) => {
  if (!isDemo()) return bad(res, 'Das ist keine Demo – hier wird nichts gelöscht.');
  if (!ownPwOk(req, (req.body || {}).password)) return bad(res, 'Dein Passwort stimmt nicht.', 401);
  const ticket = demo.markEnd(DATA_DIR);
  audit(req.user, 'Demo beendet', 'Alle Beispieldaten werden beim Neustart gelöscht');
  res.setHeader('Set-Cookie', `csetup=${ticket}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${req.secure ? '; Secure' : ''}`);
  res.json({ ok: true, restart: true });
  setTimeout(() => shutdown('Demo beenden', 1), 300);
});
admin.post('/restart', need('einstellungen'), (req, res) => {
  audit(req.user, 'Neustart ausgelöst');
  res.json({ ok: true });
  setTimeout(() => shutdown('Neustart über die Verwaltung', 1), 300);
});

admin.get('/audit', need('einstellungen'), (req, res) => {
  res.json(db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 500').all());
});

/* ---------- Kennzahlen für Home Assistant (ohne Namen, nur Summen) ---------- */
/* Nur für Home Assistant selbst (internes Add-on-Netz 172.30.32.0/23 bzw. derselbe Rechner) – nicht für Geräte im WLAN */
// nur Home Assistant selbst (172.30.32.1) und der Supervisor (172.30.32.2) – nicht andere Add-ons (z. B. Cloudflared/NGINX, 172.30.33.x)
const fromHomeAssistant = req => { const ip = normIp(req.socket.remoteAddress); return ip === '172.30.32.1' || ip === '172.30.32.2' || ip === '127.0.0.1' || ip === '::1'; };
app.get('/api/ha/summary', (req, res, next) => (fromHomeAssistant(req) ? next() : res.status(403).json({ error: 'Nur für Home Assistant.' })), (req, res) => {
  const { from } = defaultRange({});
  const sums = {
    open_cents: db.prepare(`SELECT COALESCE(SUM(total_cents),0) c FROM bookings WHERE ${OPEN_KONTO}`).get().c,
    today_items: db.prepare(`SELECT COALESCE(SUM(qty),0) n FROM bookings WHERE cancelled_at IS NULL AND date(created_at) = date('now','localtime')`).get().n,
  };
  const low = stockList().filter(s => s.active && s.track_stock && s.delivered > 0 && s.stock <= s.min_stock);
  const ev = db.prepare('SELECT name FROM events WHERE active = 1 LIMIT 1').get();
  res.json({
    open_eur: sums.open_cents / 100, items_today: sums.today_items, since: from,
    low_stock_count: low.length, low_stock: low.map(s => `${s.name} (${s.stock})`).join(', '),
    event_active: Boolean(ev), event: ev ? ev.name : '',
  });
});

/* ---------- Erweiterungen & eigene Links in der Kopfzeile ---------- */
plugins.load({ app, admin, helpers: { need, rateLimit, rateLimitKey, bad, int, cleanName, nowTs, util, invites: require('./invites'), drinks, asyncRoute, viaIngress } });
i18n.reload();   // Sprachdateien der Erweiterungen
try { require('./ids').ensureAutoincrement(db, DATA_DIR); } catch (e) { console.error('IDs: Umstellung der Erweiterungs-Tabellen fehlgeschlagen –', e.message); }
const memberapp = require('./memberapp');
memberapp.adminRoutes(admin, { bad, need, auth });
require('./mailer').routes(admin, { bad, need });
/* Einrichtungs-Assistent: Schritte und ihr Zustand (src/einrichtung.js) */
require('./einrichtung').routes(admin, { need, bad, checks: {
  tabletOn, tabletPw: gateOn, vaultOn: () => require('./vault').on(), backupKey: bkHasKey, mailReady: () => mail.ready(),
  appModules: () => memberapp.activeModules().length > 0, clubNets: () => memberapp.hasClubNets(), backupDone: () => Boolean(getSetting('backup_last_ok', '')) } });
/* Tresor: Kopie der persönlichen Daten im Arbeitsspeicher anlegen (gesperrt bis zur ersten Admin-Anmeldung) – erst jetzt,
   da alle Module ihre Tabellen angelegt haben */
const vault = require('./vault');
try { vault.start(); } catch (e) { console.error('Tresor beim Start:', e); }
vault.onUnlock(() => vault.flushMail(o => require('./mail').send(o)).then(n => { if (n) audit(null, 'Tresor: wartende E-Mails verschickt', String(n)); }));
memberapp.startPort({ rateLimit, rateLimitKey, memberBalance });

function navLinks() {
  try { const l = JSON.parse(getSetting('nav_links', '[]')); return Array.isArray(l) ? l.map(x => ({ label: x.label, url: x.url })) : []; } catch (e) { return []; }
}
/* Eingebettete Links: nur genau diese Adressen dürfen im Rahmen (iframe) unter der Kopfzeile laufen */
function embedOrigins() {
  try { return [...new Set(navLinks().map(l => new URL(l.url).origin))].map(o => ' ' + o).join(''); } catch (e) { return ''; }
}
/** Leiste am Tablet: Module + Links, in der festgelegten Reihenfolge (Einstellungen → Reihenfolge am Tablet) */
function tabletItems() {
  const items = [...plugins.tabletNav().map(x => ({ ...x, key: x.id })), ...navLinks().map((l, i) => ({ id: 'link' + i, key: 'link:' + l.url, label: l.label, href: 'link.html?i=' + i, url: l.url }))];
  let order = []; try { order = JSON.parse(getSetting('tablet_order', '[]')); } catch (e) { order = []; }
  if (!Array.isArray(order) || !order.length) return items;
  const pos = k => { const i = order.indexOf(k); return i < 0 ? 1000 : i; };
  return items.map((x, i) => ({ x, i })).sort((a, b) => pos(a.x.key) - pos(b.x.key) || a.i - b.i).map(o => o.x);
}
/** Start-Reiter: eingestellt, sonst Verkauf (falls aktiv), sonst der erste in der Leiste */
function tabletStart(items = tabletItems()) {
  const key = getSetting('tablet_start', '');
  return items.find(x => x.key === key) || items.find(x => x.id === 'getraenke') || items[0] || null;
}
// der Start-Reiter verweist auf „/“ (dort erscheint er direkt), alle anderen auf ihre eigene Adresse
app.get('/api/tablet/nav', (req, res) => {
  const items = tabletItems(); const st = tabletStart(items);
  const startHere = st && (st.id === 'getraenke' || (!st.url && plugins.tabletPage(st.id, '')));
  res.json({ items: items.map(x => (startHere && x === st ? { ...x, href: '' } : x)), start: st ? st.id : null });
});
admin.get('/settings/tablet-order', need('einstellungen'), (req, res) => { const items = tabletItems(); const st = tabletStart(items); res.json({ items, start: st ? st.key : null, switches: plugins.tabletSwitches() }); });
/* Schalter „am Tablet zeigen“ eines Moduls (derselbe Schlüssel wie bisher in den Einstellungen des Moduls) */
admin.put('/settings/tablet-show', need('einstellungen'), (req, res) => {
  const id = String((req.body || {}).id || ''), on = Boolean((req.body || {}).on);
  const sw = plugins.tabletSwitches().find(x => x.id === id);
  if (!sw) return bad(res, 'Dieses Modul lässt sich am Tablet nicht ein- oder ausschalten.');
  if (sw.on !== on) { plugins.setTabletSwitch(id, on); audit(req.user, on ? 'Am Tablet gezeigt' : 'Am Tablet ausgeblendet', sw.label); }
  const items = tabletItems(); const st = tabletStart(items);
  res.json({ ok: true, items, start: st ? st.key : null, switches: plugins.tabletSwitches() });
});
admin.put('/settings/tablet-order', need('einstellungen'), (req, res) => {
  const keys = new Set(tabletItems().map(x => x.key));
  const order = (Array.isArray((req.body || {}).order) ? req.body.order : []).map(String).filter(k => keys.has(k)).slice(0, 40);
  setSetting('tablet_order', JSON.stringify(order));
  { const lab = new Map(tabletItems().map(x => [x.key, x.label || x.name || x.key])); audit(req.user, 'Reihenfolge am Tablet geändert', order.map(k => lab.get(k) || k).join(', ')); }
  const start = (req.body || {}).start;
  if (start !== undefined && keys.has(String(start)) && String(start) !== getSetting('tablet_start', '')) {
    setSetting('tablet_start', String(start));
    audit(req.user, 'Start-Reiter am Tablet geändert', (tabletItems().find(x => x.key === String(start)) || {}).label || String(start));
  }
  const items = tabletItems(); const st = tabletStart(items);
  res.json({ ok: true, items, start: st ? st.key : null, switches: plugins.tabletSwitches() });
});
admin.get('/extensions', (req, res) => {
  const all = plugins.list();
  // Jeder Admin bekommt die aktiven Erweiterungen mit Verwaltungsseite (zum Einblenden im Menü); die volle Liste nur mit „Einstellungen“
  res.json({ modules: plugins.activeIds(), appModules: require('./memberapp').activeModules().map(([id]) => id), ui: all.filter(p => p.active && p.adminScript).map(p => ({ id: p.id, name: p.name, version: p.version, verwaltung: p.verwaltung })),
    all: req.user.perms.includes('einstellungen') || req.user.perms.includes('deinstallieren') ? all : undefined, links: navLinks() });
});
/* Übersicht: Kennzahlen und Warnungen der aktiven Module (Hook „overview“) – je Modul höchstens OVERVIEW_TIMEOUT_MS */
const OVERVIEW_TIMEOUT_MS = 6000;
admin.get('/overview/modules', asyncRoute(async (req, res) => {
  const out = [];
  for (const p of plugins.withHook('overview')) {
    const perm = p.meta.verwaltung && p.meta.verwaltung.recht;
    if (perm && !req.user.perms.includes(perm)) continue;
    let timer = null;
    try {
      const o = await Promise.race([p.hooks.overview(req.user), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('Zeitüberschreitung')), OVERVIEW_TIMEOUT_MS); })]);
      if (o) out.push({ id: p.meta.id, name: p.meta.name, page: p.meta.verwaltung ? p.meta.verwaltung.seite || p.meta.id : p.meta.id, kpis: o.kpis || [], alerts: o.alerts || [] });
    } catch (e) { out.push({ id: p.meta.id, name: p.meta.name, page: p.meta.id, kpis: [], alerts: [{ level: 'r', text: 'Status nicht abrufbar: ' + e.message }] }); }
    finally { clearTimeout(timer); }   // der Zeitgeber darf nach einer schnellen Antwort nicht weiterlaufen
  }
  res.json(out);
}));
/* Erweiterung als ZIP einspielen / entfernen (wirkt nach Neustart) */
admin.post('/extensions/upload', need('einstellungen'), express.raw({ type: () => true, limit: '25mb' }), asyncRoute(async (req, res) => {
  if (!ownerConfirm(req, res)) return;   // Erweiterungen laufen als Programmcode im Add-on – wie die Freigabe nur mit Passwort
  try {
    const r = await plugins.installZip(req.body);
    audit(req.user, r.update ? 'Erweiterung aktualisiert' : 'Erweiterung hochgeladen', `${r.name} ${r.version}`);
    res.json({ ok: true, ...r, restart: true });
  } catch (e) { bad(res, e.message); }
}));
/* Erweiterung aus dem Netzwerkordner freigeben: nur das Adminkonto/„alle Rechte“, mit Passwort bestätigt */
admin.post('/extensions/:id/approve', need('einstellungen'), owner, rateLimit('approve', 10, 10 * 60000), (req, res) => {
  if (!ownPwOk(req, (req.body || {}).password)) return bad(res, 'Passwort falsch.', 401);
  try { const r = plugins.approve(String(req.params.id), String((req.body || {}).hash || '')); audit(req.user, 'Erweiterung freigegeben', `${r.name} (${r.hash.slice(0, 12)})`); res.json({ ok: true, restart: true }); }
  catch (e) { bad(res, e.message); }
});
admin.delete('/extensions/:id', need('einstellungen'), owner, (req, res) => {
  try { const n = plugins.removeUploaded(String(req.params.id)); audit(req.user, 'Erweiterung entfernt', n); res.json({ ok: true, restart: true }); }
  catch (e) { bad(res, e.message); }
});
/* ---------- Module deinstallieren / installieren (Recht „deinstallieren“) ----------
   Ablauf: Sicherung erstellen → herunterladen → Modulnamen eintippen → deinstallieren. Installieren optional mit Sicherung. */
/* Deinstallieren/Sichern/Einspielen: „Deinstallieren“ UND das Recht des Moduls selbst (bzw. „Einstellungen“) –
   sonst käme man über eine Sicherung an Daten, die man im Modul gar nicht sehen darf (z. B. Stundenlöhne) */
const modPerm = p => (p.builtin ? 'einstellungen' : p.meta.verwaltung && p.meta.verwaltung.recht) || null;
const findMod = (req, res) => {
  const p = plugins.get(String(req.params.id)); if (!p) { bad(res, 'Modul nicht gefunden.', 404); return null; }
  const perm = modPerm(p);
  if (perm && !fullPerm(req, perm) && !req.user.perms.includes('einstellungen')) { bad(res, `Dafür brauchst du zusätzlich das Recht für „${p.meta.name}“.`, 403); return null; }
  return p;
};
admin.get('/extensions/:id/usage', need('deinstallieren'), (req, res) => {
  const p = findMod(req, res); if (!p) return;
  res.json({ id: p.meta.id, name: p.meta.name, ...modules.usage(p), backups: modules.listBackups(p.meta.id) });
});
admin.post('/extensions/:id/backup', need('deinstallieren'), asyncRoute(async (req, res) => {
  const p = findMod(req, res); if (!p) return;
  const file = await modules.backup(p, req.user);
  audit(req.user, 'Modul-Sicherung erstellt', `${p.meta.name}: ${file}`);
  res.json({ ok: true, file, usage: modules.usage(p) });
}));
admin.get('/extensions/backups/:file', need('deinstallieren'), (req, res) => {
  const f = modules.backupPath(req.params.file);
  if (!f) return bad(res, 'Sicherung nicht gefunden.', 404);
  const p = plugins.get(String(req.params.file).split('_')[0]);
  if (p) { const perm = modPerm(p); if (perm && !fullPerm(req, perm) && !req.user.perms.includes('einstellungen')) return bad(res, `Dafür brauchst du zusätzlich das Recht für „${p.meta.name}“.`, 403); }
  res.download(f, path.basename(f));
});
admin.post('/extensions/:id/uninstall', need('deinstallieren'), (req, res) => {
  const p = findMod(req, res); if (!p) return;
  const b = req.body || {};
  if (modules.isUninstalled(p.meta.id)) return bad(res, 'Das Modul ist schon deinstalliert.');
  const f = modules.backupPath(b.file);
  if (!f || !String(b.file).startsWith(p.meta.id + '_') || Date.now() - fs.statSync(f).mtimeMs > 2 * 3600000)
    return bad(res, 'Zuerst eine aktuelle Sicherung dieses Moduls erstellen und herunterladen.');
  if (String(b.confirm || '').trim().toLocaleLowerCase('de') !== String(p.meta.name).toLocaleLowerCase('de'))
    return bad(res, `Zum Bestätigen bitte genau „${p.meta.name}“ eintippen.`);
  const u = modules.usage(p);
  modules.wipe(p);
  setSetting(`ext_${p.meta.id}_active`, '0');
  modules.setUninstalled(p.meta.id, true);
  audit(req.user, 'Modul deinstalliert', `${p.meta.name} – ${u.total} Datensätze gelöscht, Sicherung ${b.file}`);
  res.json({ ok: true });
});
/* Körper: ZIP der Modul-Sicherung (gestreamt auf die Platte) oder JSON { file } für eine Sicherung aus dem Sicherungsordner */
admin.post('/extensions/:id/install', need('deinstallieren'), streamUpload(100 * MB, '.zip'), asyncRoute(async (req, res) => {
  try {
    const p = findMod(req, res); if (!p) return;
    if (p.error) return bad(res, p.error);
    // Einspielen nur bei deinstalliertem Modul – nie über laufende Daten hinweg
    if (!modules.isUninstalled(p.meta.id)) return bad(res, 'Das Modul ist installiert. Eine Sicherung lässt sich nur nach dem Deinstallieren einspielen.');
    const rr = p.meta.verwaltung && p.meta.verwaltung.recht;
    if (rr && !fullPerm(req, rr) && !req.user.perms.includes('einstellungen')) return bad(res, `Zum Installieren von „${p.meta.name}“ brauchst du zusätzlich das Recht dieses Moduls.`, 403);
    let summary = 'ohne Daten (neu)';
    try {
      if (req.uploadFile && req.uploadSize) summary = await modules.restore(p, req.uploadFile);
      else if (req.body && req.body.file) {
        const f = modules.backupPath(req.body.file);
        if (!f || !String(req.body.file).startsWith(p.meta.id + '_')) return bad(res, 'Sicherung nicht gefunden.');
        summary = await modules.restore(p, f);
      }
    } catch (e) { return bad(res, e.message); }
    modules.setUninstalled(p.meta.id, false);
    setSetting(`ext_${p.meta.id}_active`, '1');
    audit(req.user, 'Modul installiert', `${p.meta.name} – ${summary}`);
    res.json({ ok: true, summary });
  } finally { dropUpload(req); }
}));
/* Funktionsimport/-export: Einstellungen eines Moduls als Datei (ohne PINs, Passwörter, Schlüssel) */
const mayConfig = (req, p) => req.user.perms.includes('einstellungen') || (p.meta.verwaltung && fullPerm(req, p.meta.verwaltung.recht));
admin.get('/extensions/:id/export', async (req, res) => {
  const p = plugins.get(String(req.params.id));
  if (!p || !plugins.isActive(p.meta.id) || typeof p.hooks.exportConfig !== 'function') return bad(res, 'Für dieses Modul gibt es keinen Export.', 404);
  if (!mayConfig(req, p)) return bad(res, 'Dafür fehlt dir die Berechtigung.', 403);
  const data = await p.hooks.exportConfig();
  const body = { format: 'clubwerk-funktion', module: p.meta.id, name: p.meta.name, version: p.meta.version, exported: nowTs(), club: getSetting('club_name', ''), data };
  res.setHeader('Content-Disposition', `attachment; filename="${p.meta.id}-funktion.json"`);
  res.type('application/json').send(JSON.stringify(body, null, 2));
});
admin.post('/extensions/:id/import', express.json({ limit: '2mb' }), async (req, res) => {
  const p = plugins.get(String(req.params.id));
  if (!p || !plugins.isActive(p.meta.id) || typeof p.hooks.importConfig !== 'function') return bad(res, 'Für dieses Modul gibt es keinen Import.', 404);
  if (!mayConfig(req, p)) return bad(res, 'Dafür fehlt dir die Berechtigung.', 403);
  const b = req.body || {};
  if (!['clubwerk-funktion', 'vereinsheim-funktion'].includes(b.format) || !b.data) return bad(res, 'Das ist keine Funktionsdatei von Clubwerk.');
  if (b.module !== p.meta.id) return bad(res, `Diese Datei gehört zum Modul „${b.name || b.module}“, nicht zu „${p.meta.name}“.`);
  try {
    const summary = await p.hooks.importConfig(b.data, { user: req.user });
    audit(req.user, `${p.meta.name}: Funktionsimport`, summary || '');
    res.json({ ok: true, summary });
  } catch (e) { bad(res, e.message); }
});
admin.put('/extensions/:id', need('einstellungen'), (req, res) => {
  try { plugins.setActive(String(req.params.id), Boolean((req.body || {}).active), req.user); res.json({ ok: true }); }
  catch (e) { bad(res, e.message); }
});
admin.put('/settings/links', need('einstellungen'), (req, res) => {
  const raw = Array.isArray((req.body || {}).links) ? req.body.links : null;
  if (!raw) return bad(res, 'Ungültige Liste.');
  if (raw.length > 8) return bad(res, 'Höchstens 8 Links.');
  const out = [];
  for (const l of raw) {
    const label = cleanName(l.label, 30), url = String(l.url || '').trim();
    if (!label && !url) continue;
    if (!label) return bad(res, 'Jeder Link braucht eine Beschriftung.');
    let u; try { u = new URL(url); } catch (e) { return bad(res, `„${label}“: bitte eine vollständige Adresse mit https:// eintragen.`); }
    if (!/^https?:$/.test(u.protocol)) return bad(res, `„${label}“: nur http- und https-Adressen sind erlaubt.`);
    out.push({ label, url: u.href.slice(0, 500) });
  }
  setSetting('nav_links', JSON.stringify(out));
  audit(req.user, 'Links in der Kopfzeile geändert', out.map(l => l.label).join(', ') || '(keine)');
  res.json({ ok: true, links: out });
});

app.use('/api', (req, res) => bad(res, 'Unbekannte Adresse.', 404));

/* Fehler immer als JSON, ohne interne Details */
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err && err.type === 'entity.too.large') return bad(res, 'Die Datei ist zu groß.', 413);
  if (err && err.type === 'entity.parse.failed') return bad(res, 'Ungültige Anfrage.', 400);
  console.error(err);
  bad(res, 'Interner Fehler – bitte im Add-on-Protokoll nachsehen.', 500);
});

/* ---------- Start, nächtliche Sicherung, sauberes Beenden ---------- */
try { cleanupUploads(); } catch (e) { console.error('Aufräumen:', e.message); }
if (restoredMsg) { console.log(restoredMsg); audit('system', 'Wiederherstellung', restoredMsg); }
if (demoMsg) { console.log(demoMsg); audit('system', 'Demo', demoMsg); }

let lastAuto = null, dbxLastTry = 0;
const TRASH_DAYS = 90;   // gelöschte Belege bleiben so lange im Papierkorb
/* Jeder Teil fängt seine Fehler selbst; ein unerwarteter Fehler darf nie als unbehandelte Promise-Ablehnung den Prozess beenden */
async function nightly() {
  try {
    const now = new Date();
    const day = backup.stamp().slice(0, 10);   // lokales Datum
    if (now.getHours() >= 3 && lastAuto !== day) {
      lastAuto = day;
      try {
        const have = backup.list().some(b => b.file.startsWith(`getraenke_${day}_`) && b.file.endsWith('_auto.db'));
        if (!have) console.log('Nächtliche Sicherung:', await backup.snapshot(db, 'auto'));
      } catch (e) { console.error('Nächtliche Sicherung fehlgeschlagen:', e.message); }
    }
    // Belege im Papierkorb endgültig löschen
    try {
      for (const f of fs.existsSync(TRASH_DIR) ? fs.readdirSync(TRASH_DIR) : []) {
        const p = path.join(TRASH_DIR, f);
        if (Date.now() - fs.statSync(p).mtimeMs > TRASH_DAYS * 86400000) fs.unlinkSync(p);
      }
    } catch (e) { console.error('Papierkorb:', e.message); }
    // Komplettsicherung: einmal am Tag ab der eingestellten Uhrzeit, bei Fehler stündlich neuer Versuch; monatlich Probe-Wiederherstellung
    try {
      if (bkHasKey() && now.getHours() >= bkCfg().hour && getSetting('backup_last_day', '') !== day && Date.now() - dbxLastTry > 55 * 60 * 1000) {
        dbxLastTry = Date.now();
        console.log('Datensicherung:', await runBackup());
        const pAt = getSetting('backup_probe_at', '');
        if (!pAt || Date.now() - Date.parse(pAt) > 30 * 86400000) console.log('Probe-Wiederherstellung:', await probeBackup());
      }
    } catch (e) { console.error('Datensicherung fehlgeschlagen:', e.message); }
  } catch (e) { console.error('Nächtliche Aufgaben:', e); }
}
setInterval(nightly, 10 * 60 * 1000).unref();
setTimeout(nightly, 30 * 1000).unref();

/* Hauptport (Tablet, Verwaltung, Handys): mit HTTPS, sobald ein Zertifikat eingerichtet ist */
const server = tls.listen(app, PORT, HOST, 'Clubwerk');
console.log(`Datenbank: ${DB_FILE}`);
/* Innerer Port ohne Verschlüsselung – nur für die Home-Assistant-Seitenleiste (Supervisor) und Abrufe des Programms an sich selbst */
let inner = null;
if (process.env.INTERNAL_PORT && String(process.env.INTERNAL_PORT) !== String(PORT)) {
  const allowed = new Set([...INGRESS_IPS, '127.0.0.1', '::1']);
  inner = require('http').createServer((req, res) => {
    if (!allowed.has(normIp(req.socket.remoteAddress))) { res.writeHead(403); res.end(); return; }
    app(req, res);
  });
  inner.listen(parseInt(process.env.INTERNAL_PORT, 10), process.env.INGRESS_PORT ? '0.0.0.0' : '127.0.0.1');
}

let stopping = false;
async function shutdown(why, code = 0) {
  if (stopping) return;
  stopping = true;
  console.log(`Clubwerk wird beendet (${why}) …`);
  server.close();
  if (inner) inner.close();
  // Module aufräumen lassen (z. B. Türimpulse abschalten) – höchstens 3 Sekunden
  try {
    await Promise.race([Promise.allSettled(plugins.withHook('shutdown').map(p => p.hooks.shutdown())), new Promise(r => setTimeout(r, 3000))]);
  } catch (e) { console.error('Beenden:', e.message); }
  // Datenbank sauber schließen und SOFORT beenden – danach darf kein Zeitgeber mehr auf die Datenbank zugreifen
  try { db.pragma('wal_checkpoint(TRUNCATE)'); db.close(); } catch (e) { console.error(e.message); }
  process.exit(code);
}
/* Ein Fehler in einer Hintergrundaufgabe (Mail, Push, Hook ohne await) darf nie das ganze Add-on beenden – sonst reißen alle
   laufenden Anfragen ab („Load failed“ in der App). Protokollieren und weiterlaufen. */
process.on('unhandledRejection', e => { console.error('Fehler im Hintergrund (abgefangen):', e && e.stack ? e.stack : e); });
process.on('uncaughtException', e => { console.error('Unerwarteter Fehler (abgefangen):', e && e.stack ? e.stack : e); });
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
