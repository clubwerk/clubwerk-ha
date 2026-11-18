'use strict';
const DEMO_KOPIE = process.env.CW_DEMO_KOPIE === '1';
if (DEMO_KOPIE || process.env.CW_LESEKOPIE === '1') require('./abschottung');   // Demo-Kopie und Lesekopie der Teil-Wiederherstellung: nichts nach außen – vor allem anderen laden (src/demokopie.js, src/teilsicherung.js)
require('./testuhr');   // Test-Uhr (nur mit CW_TEST_UHR, sonst ohne Wirkung)
require('./logtime');   // Zeitstempel im Protokoll
const prozess = require('./prozess');
prozess.start();   // Merker „läuft“, Abstürze zählen, Notfallmodus bei kaputter Datenbank oder vollem Speicher – vor dem Öffnen der Datenbank
if (process.env.CW_TEST_ROUTEN) require('./routen');   // nur Tests: merkt sich die Pfade aller Adressen (Testreihe rmatrix) – vor dem ersten Router
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const backup = require('./backup');
const restoredMsg = backup.applyPendingRestore();   // muss vor dem Öffnen der Datenbank laufen
// Version gewechselt (Update, auch über Home Assistant, oder zurück)? Bisherigen Stand als „vor-update“ aufheben – vor den Umbauten der neuen Version
const updMsg = DEMO_KOPIE || process.env.CW_LESEKOPIE === '1' ? null : (() => { try { backup.aufraeumen(); return backup.vorUpdate(require('../package.json').version); } catch (e) { return { fehler: e.message }; } })();
const demo = require('./demo');
const demoMsg = demo.applyPending(backup.DATA_DIR, backup.DB_FILE);   // Demo einrichten bzw. restlos löschen – ebenfalls vor dem Öffnen
const { db, splitPersonName, lastFirst, DB_FILE, DATA_DIR, getSetting, getJsonSetting, isObj, setSetting, stockList, lastSettlement, audit, auditDiff, memberRefs, rewireMemberRef } = require('./db');
const seitenleiste = require('./seitenleiste');
const util = require('./util');
const { euro } = util;   // Beträge überall gleich: „12,50 €“
const { today, nowTs, isDate, addDays } = util;
const { securityAlert } = require('./security');
const mail = require('./mail');
const modules = require('./modules');
const auth = require('./auth');
const plugins = require('./plugins');
require('./geheim');   // legt die Tabelle der Geheimnisse an – früh laden wie bisher
const APP_VERSION = require('../package.json').version;
const versioniert = require('./versioniert');
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
try { require('./pfeffer').start(); } catch (e) { console.error('PIN-Schlüssel:', e.message); }   // PINs mit Pfeffer: Datei laden bzw. nach Wiederherstellung aus dem Tresor holen (src/pfeffer.js)
(async function emergencyPassword() {
  const pw = process.env.EMERGENCY_PW || '';
  if (!pw) return;
  if (pw.length < 8 || pw.length > 200) { console.error('Notfall-Passwort ignoriert: 8 bis 200 Zeichen nötig.'); return; }
  const authM = require('./auth');
  let u = db.prepare('SELECT * FROM admin_users WHERE builtin = 1').get();
  if (!u) { await authM.createUser({ username: 'admin', name: 'Adminkonto', password: pw, role: 'oberadmin', builtin: true }); u = { username: 'admin' }; }
  else { db.prepare('UPDATE admin_users SET active = 1 WHERE id = ?').run(u.id); await authM.setPassword(u.id, pw); }
  audit('system', 'Notfall-Passwort gesetzt', u.username);
  require('./security').securityAlert('notfall', `Beim Start wurde das Notfall-Passwort für „${u.username}“ gesetzt (Home Assistant › Add-on › Konfiguration). Wart ihr das nicht, hat jemand Zugriff auf Home Assistant.`);
  console.log(`Notfall-Passwort für das Adminkonto „${u.username}“ gesetzt. Bitte die Option „notfall_passwort“ wieder leeren und das Add-on neu starten.`);
})().catch(e => console.error('Notfall-Passwort:', e.message));

const app = express();
app.disable('x-powered-by');
/* Verwaltung am Tablet (verwaltung.html bettet …/tadmin/admin.html ein): derselbe Inhalt unter eigenem Pfad, damit alle relativen
   Anfragen dort (auch Downloads) die eigene Tablet-Sitzung tragen (Cookie gtadm, src/auth.js) – nie die von admin.html */
app.use((req, res, next) => {
  if (req.url.startsWith('/tadmin/')) { req.url = req.originalUrl = req.url.slice(7); req.cwTablet = true; }
  next();
});
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
if (process.env.CW_TEST_PROZESS === '1') app.use((req, res, next) => {   // nur Testläufe (Testreihe strom): Hänger und Absturz nachstellen, keine Route (rmatrix)
  if (req.method !== 'POST') return next();
  if (req.path === '/api/test/haenger') { res.json({ ok: true }); setTimeout(() => { for (;;) { /* Ereignisschleife blockiert */ } }, 50); return; }   // pause-ok: Antwort erst senden
  if (req.path === '/api/test/absturz') { res.json({ ok: true }); setTimeout(() => { throw new Error('Testabsturz'); }, 50); return; }   // pause-ok: Antwort erst senden
  next();
});
if (require('./testuhr').stellbar) app.use((req, res, next) => (req.method === 'POST' && req.path === '/api/test/uhr/vor' ? res.json({ jetzt: require('./testuhr').vor(req.query.ms) }) : next()));   // nur Testläufe (CW_TEST_UHR_STELLBAR=1), nach Tunnel- und Host-Prüfung, keine Route (rmatrix): Uhr vorstellen statt Wartezeiten absitzen
app.use(require('./security').hardenHeaders({ frame: 'SAMEORIGIN', camera: 'self' }));
app.use(require('./security').compress());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
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
app.use(require('./gobd').middleware);   // Änderungsjournal: wer hat geändert (src/gobd.js)
app.use(require('./db').settingCache);   // Einstellungen je Leseanfrage nur einmal lesen (src/db.js)
app.get('/i18n.js', i18n.sendPage);   // Mitglieder-App liefert dasselbe direkt (memberapp.js), ohne Umweg über HTTP

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

/* „Demo“-Knopf je Modul: abgeschottete Demo-Kopie unter …/demo/ (src/demokopie.js) – vor express.json, der Inhalt geht roh weiter */
const demokopie = require('./demokopie');
if (!DEMO_KOPIE) { demokopie.cleanup(); app.use('/demo', demokopie.proxy(req => auth.currentUser(req))); }

app.use((req, res, next) => /^\/api\/admin\/extensions\/[^/]+\/import$/.test(req.path) ? next() : express.json({ limit: '1mb' })(req, res, next));   // Funktionsimport hat sein eigenes, größeres Limit (Artikelbilder)

/* Admin-Änderungen nur mit eigenem Kopfzeilen-Feld → fremde Webseiten können nichts im Namen eines Admins auslösen */
app.use('/api/admin', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (req.get('X-Clubwerk') !== '1') return res.status(403).json({ error: 'Anfrage abgelehnt.' });
  next();
});
/* In der Demo-Kopie gibt es keine Updates, Sicherungen, Erweiterungen zum Einspielen und keinen Neustart */
if (DEMO_KOPIE) app.use((req, res, next) => (require('./abschottung').blocked(req.method, req.path) ? res.status(403).json({ error: 'In der Demo nicht möglich.' }) : next()));

const { clubColor } = require('./db');
const { normIp } = require('./security');

const isDemo = () => getSetting('demo_mode', '') === '1';
const { checkLogo, clubColor2, iconKey, logoInfo, logoUrl, TABLET_THEMES, tabletTheme } = require('./logo')({
  app, isDemo
});

/* ---------- Betrieb ohne Tablet (Einstellungen › Tablet › „Tablet im Vereinsheim“) ----------
   Ohne Tablet gibt es keine Tablet-Seiten: Sie führen zur Anmeldung der Verwaltung, die Tablet-Schnittstellen antworten 404.
   Fehlt die Einstellung (ältere Installation), läuft das Tablet wie bisher. Ein angemeldeter Benutzer der Verwaltung darf die
   Tablet-Schnittstellen weiter abrufen (Artikel- und Profilbilder in der Verwaltung) – er hat ohnehin mehr Rechte. */
const tabletOn = () => getSetting('tablet_enabled', '1') !== '0';
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
  res.setHeader('Cache-Control', 'no-cache'); res.type('html').send(versioniert.umgeschrieben(path.join(__dirname, '..', 'public', 'index.html'), versioniert.html));
});
app.get('/verkauf/', (req, res) => res.redirect(302, '../verkauf'));

app.use('/app', (req, res) => res.status(404).end());   // Mitglieder-App nur über ihren eigenen Port
// Seiten der Erweiterungen binden die gemeinsamen Stile relativ ein („style.css“) – am Tablet liegen sie zwei Ebenen höher
app.get(/^\/x\/[a-z0-9-]+\/((style|kit|theme)\.css|theme-init\.js)$/, (req, res) => res.redirect(302, '../../' + req.path.split('/').pop()));   // theme-init.js: Beregnung bindet es relativ ein (eigene Webapp) – am Tablet fehlte es (404, 02.11.2026)
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
/* Seiten und Stile mit Version ausliefern: Kern-Dateien bekommen „?v=<Version>“ (src/versioniert.js), versionierte Abrufe
   werden ein Jahr unveränderlich gehalten – Tablet und Verwaltung fragen so nicht mehr bei jedem Seitenwechsel nach */
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const m = req.path === '/' ? ['', 'index', 'html'] : /^\/([\w-]+)(?:\.(html|css))?$/.exec(req.path);
  if (!m) return next();
  const istCss = m[2] === 'css';
  if (istCss ? !versioniert.passt(req) || m[1] === 'theme' : m[2] !== 'html' && m[1] !== 'index' && !/^(start|verwaltung|link|admin)$/.test(m[1] || '')) return next();
  const f = path.join(PUBLIC_DIR, m[1] + (istCss ? '.css' : '.html'));
  if (!fs.existsSync(f)) return next();
  res.setHeader('Cache-Control', istCss ? versioniert.IMMUTABLE : 'no-cache');
  res.type(istCss ? 'css' : 'html').send(versioniert.umgeschrieben(f, istCss ? versioniert.css : versioniert.html));
});
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders: (res, file) => {
    const fest = versioniert.passt(res.req);
    if (/\.(html|js|css|webmanifest)$/.test(file)) res.setHeader('Cache-Control', fest && /\.(js|css)$/.test(file) ? versioniert.IMMUTABLE : 'no-cache');   // ohne Version immer kurz nachfragen (ETag → 304), damit Updates sofort greifen
    else if (/\.(woff2?|png|svg|ico)$/.test(file)) res.setHeader('Cache-Control', fest ? versioniert.IMMUTABLE : 'public, max-age=604800');   // Schriften/Icons ändern sich praktisch nie: eine Woche, mit Version ein Jahr
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
  try { db.prepare('UPDATE mail_recipient SET member_id = ? WHERE member_id = ?').run(intoId, fromId); db.prepare('UPDATE mail_message SET member_id = ? WHERE member_id = ?').run(intoId, fromId); } catch (e) { if (!/no such table/.test(e.message)) throw e; }   // Tabelle gibt es erst nach dem Start des Mailers
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
  const kept = memberRefs().some(({ table, column }) => keep.has(table) && db.prepare(`SELECT 1 FROM ${util.qid(table)} WHERE ${util.qid(column)} = ? LIMIT 1`).get(id));   // Namen aus dem Schema: maskiert
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
/** Falsches Passwort bei einer Bestätigung (eigenes Passwort, Sicherungspasswort, Wiederherstellungscode): 401 mit pwWrong –
    die Verwaltung bleibt angemeldet und zeigt nur die Meldung (ohne pwWrong hieße 401 „Sitzung abgelaufen“ → Anmeldeseite) */
const pwBad = (res, msg) => res.status(401).json({ error: msg, pwWrong: true });
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
app.post('/api/gate/login', rateLimit('gate', 10, 10 * 60000), (req, res) => auth.nacheinander('gate', async () => {
  if (!gateOn()) return bad(res, GATE_UNSET, 409);
  const wait = gateAll.blocked('all');
  if (wait) return bad(res, `Zu viele falsche Passwörter – bitte in ${wait} Min. erneut versuchen.`, 429);
  const pw = String((req.body || {}).password || '');
  if (!pw || !(await auth.verifySecret(pw, getSetting('tablet_pw_hash')))) {
    if (gateAll.fail('all').locked) securityAlert('tablet.passwort', 'Für die Buchungsseite wurde 30-mal ein falsches Passwort eingegeben. Neue Geräte können sich vorübergehend nicht freischalten; bereits freigeschaltete Tablets funktionieren weiter.');
    audit(null, 'Buchungsseite: falsches Passwort', req.ip);
    return bad(res, 'Das Passwort stimmt nicht.', 401);
  }
  audit(null, 'Buchungsseite freigeschaltet', `${req.ip} · ${String(req.get('User-Agent') || '').slice(0, 120)}`);
  res.setHeader('Set-Cookie', gateCookie(req));
  res.json({ ok: true });
}));
app.use('/api/tablet', (req, res, next) => {
  if (gateOk(req)) return next();
  if (!gateOn()) return res.status(401).json({ error: GATE_UNSET, gate: true, unset: true });
  res.status(401).json({ error: 'Die Buchungsseite ist geschützt – bitte das Passwort eingeben.', gate: true });
});

// Pfad normalisiert prüfen (Groß-/Kleinschreibung, Schrägstrich am Ende) – Express nimmt beide Schreibweisen an
const normPath = p => String(p || '').toLowerCase().replace(/\/+$/, '').replace(/\/{2,}/g, '/');

const { addGuest, closeTab, eventOpen, eventOpenAll, guestOpen, nurAnschreiben, NUR_ANSCHREIBEN_MSG, OPEN_GUEST, topDays, topN } = require('./tablet-api')({
  app, bad, cleanName, int, logoUrl, memberBalance, normPath, rateLimit, UNDO_WINDOW_MIN
});

/* =====================================================================
   Admin – Anmeldung, Benutzer, Rechte
   ===================================================================== */
const cookieOpts = (token, req) => `${auth.sessionCookie(req)}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${req.cwTablet ? 4 * 3600 : 8 * 3600}${req.secure ? '; Secure' : ''}`;
const need = auth.need;
/** Recht ohne Einschränkung auf Abteilungen (z. B. für Modul-Einstellungen) */
const fullPerm = (req, perm) => req.user.perms.includes(perm) && !(req.user.deptOnly || []).includes(perm);
const jarr = v => { try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } };
const cleanUser = u => { const pi = auth.permInfo(u); return { id: u.id, username: u.username, name: u.name, role: u.role, perms: pi.perms, deptOnly: pi.deptOnly,
  extra: jarr(u.perms), roles: jarr(u.roles).map(Number), departments: jarr(u.departments).map(Number), member_id: u.member_id || null,
  active: Boolean(u.active), last_login: u.last_login, builtin: Boolean(u.builtin) }; };
/** Abteilungen (aus der Mitgliederverwaltung, falls aktiv) */
const departmentList = () => { for (const p of plugins.withHook('departments')) { try { return p.hooks.departments() || []; } catch (e) { console.error(`Modul ${p.meta.id}: Abteilungen nicht lesbar:`, e.message); } } return []; };
/** Benutzername-Vorschlag: erster Buchstabe Vorname + Nachname (ä → ae …), eindeutig */
function suggestUsername(first, last, exceptId = 0, taken = null) {   // taken: vergebene Namen (klein geschrieben, ohne exceptId) – für Listen, statt je Vorschlag abzufragen
  const t = v => String(v || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  let base = (t(first).slice(0, 1) + t(last)).slice(0, 26);
  if (base.length < 3) base = (base + 'user').slice(0, 26);
  let un = base, n = 1;
  while (taken ? taken.has(un) : db.prepare('SELECT 1 FROM admin_users WHERE username = ? AND id != ?').get(un, exceptId)) un = `${base}${++n}`;
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
    demoInfo: isDemo() && u && u.perms.includes('einstellungen') ? getJsonSetting('demo_info', {}) : undefined,
    demoCopy: DEMO_KOPIE ? { module: process.env.CW_DEMO_MODUL || '', minutes: Number(process.env.CW_DEMO_MINUTEN || 30) } : undefined });
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
app.post('/api/admin/setup', rateLimit('setup', 10, 60000), async (req, res) => {
  if (auth.adminConfigured()) return bad(res, 'Das Adminkonto ist bereits eingerichtet.', 403);
  if (!setupCodeOk(req, res)) return;
  const { password, clubName, tabletPassword, wizard } = req.body || {};
  const club = cleanName(clubName, 60);
  if ((clubName !== undefined || wizard) && club.length < 3) return bad(res, 'Bitte den Namen des Vereins eingeben.');   // der Einrichtungs-Assistent verlangt den Vereinsnamen (Pflicht)
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
  require('./gobd').ensure();   // Änderungsjournal: Tabellen der eingeschalteten Module erfassen
  if (lang !== undefined) setSetting('language', i18n.normCode(lang));
  const adminId = await auth.createUser({ username: uname, name: fullName, password: String(password), role: 'oberadmin', builtin: true });
  if (process.env.CW_TEST_VAULT === '1') { const v = require('./vault'); v.prepare(adminId); v.enable(adminId, String(password)); }   // nur Tests: alles mit eingeschaltetem Tresor prüfen
  if (tabletPassword !== undefined) { setSetting('tablet_pw_hash', await auth.hashSecret(String(tabletPassword))); setSetting('tablet_pw_at', nowTs()); setSetting('tablet_pw_ver', crypto.randomBytes(6).toString('hex')); }
  if (wizard) require('./einrichtung').begin();
  audit(uname, 'Adminkonto eingerichtet', wizard ? 'mit dem Einrichtungs-Assistenten' : undefined);
  demo.dropTicket(DATA_DIR);
  const r = await auth.login(uname, String(password), req.ip, 'admin', { tablet: Boolean(req.cwTablet) });
  res.setHeader('Set-Cookie', [cookieOpts(r.token, req), 'csetup=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0']);
  res.json({ ok: true });
});
/* Demo ausprobieren (nur frische Installation, mit Einrichtungscode bzw. über die Seitenleiste – wie die Ersteinrichtung):
   Markierung anlegen, neu starten; beim Start ersetzt src/demo.js die leere Datenbank durch die Demo. Die zufälligen Passwörter
   bekommt nur, wer die Demo startet (und später angemeldete Admins im Demo-Hinweis). */
app.post('/api/admin/demo/start', rateLimit('setup', 10, 60000), async (req, res) => {
  if (auth.adminConfigured() || !demo.freshDb(db)) return bad(res, 'Die Demo gibt es nur auf einer frisch installierten Clubwerk-Instanz.', 403);
  if (!setupCodeOk(req, res)) return;
  const r = await demo.markStart(DATA_DIR, auth.hashSecret);
  console.log('Demo wird eingerichtet – Clubwerk startet neu.');
  res.json({ ok: true, restart: true, ...r });
  setTimeout(() => shutdown('Demo starten', 1), 300);
});

app.post('/api/admin/login', rateLimit('login', 15, 5 * 60000), async (req, res) => {
  const { username, password } = req.body || {};
  const known = auth.knownDevice(req, username);
  const before = db.prepare('SELECT last_login FROM admin_users WHERE username = ? AND active = 1').get(String(username || '').trim().toLowerCase());
  const r = await auth.login(String(username || ''), String(password || ''), req.ip, 'admin', { trusted: viaIngress(req), known, tablet: Boolean(req.cwTablet) });
  if (!r.ok) {
    audit(String(username || '').slice(0, 30), r.locked ? 'Anmeldung gesperrt (5 Fehlversuche)' : 'Anmeldung fehlgeschlagen', req.ip);
    if (r.manyFails) securityAlert('login.viele', `Auffällig viele fehlgeschlagene Anmeldungen für „${String(username || '').slice(0, 30)}“ (zuletzt von ${req.ip}). Bitte prüfen, ob jemand versucht, das Passwort zu erraten.`, { key: String(username || '').trim().toLowerCase().slice(0, 30) });
    return bad(res, r.error, 401);
  }
  audit(String(username).toLowerCase(), 'Anmeldung', req.ip);
  // Neues Gerät (kein Gerätecookie dieses Kontos): Warnung in der Tagesmail – nicht über die Seitenleiste und nicht bei der allerersten Anmeldung.
  // Geräte, die sich schon einmal angemeldet haben, tragen das Cookie bereits und gelten als bekannt.
  if (!known && !viaIngress(req) && before && before.last_login && !DEMO_KOPIE) securityAlert('login.geraet', `„${String(username).toLowerCase()}“ hat sich von einem neuen Gerät angemeldet (Adresse ${req.ip}). Warst du das nicht, bitte sofort das Passwort ändern.`, { key: String(username).toLowerCase() + '|' + req.ip });
  res.setHeader('Set-Cookie', [cookieOpts(r.token, req), auth.deviceCookie(username, req.secure)]);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  auth.logout(auth.parseCookies(req)[auth.sessionCookie(req)]);   // am Tablet nur die Tablet-Sitzung, admin.html bleibt angemeldet
  res.setHeader('Set-Cookie', `${auth.sessionCookie(req)}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

const admin = express.Router();
admin.use(auth.requireAdmin);
const DRINK_ADMIN = /^\/(articles|deliveries|upload|beleg|supplier-map|stock|shrinkage|order|settings\/order|events|event-members|tabs|bookings|balances|settle|settle-history|export\.xlsx|abtippliste|categories)(\/|$)/;
admin.use((req, res, next) => (DRINK_ADMIN.test(normPath(req.path)) && !plugins.isActive('getraenke')
  ? res.status(404).json({ error: 'Das Modul „Verkauf“ ist ausgeschaltet.' }) : next()));
/* Tresor gesperrt: Bereiche mit persönlichen Daten (Mitgliederverwaltung, Buchhaltung, E-Mail an Mitglieder) zeigen einen
   Sperrhinweis statt Platzhaltern – und niemand speichert versehentlich leere Felder über echte Daten */
const VAULT_AREAS = /^\/(x\/(mitglieder|buchhaltung)|mail|kontoauszug\/(entries|targets|assign-safe|upload)|extensions\/(mitglieder|buchhaltung)\/(export|import))(\/|$)/;
admin.use((req, res, next) => (VAULT_AREAS.test(normPath(req.path)) && require('./vault').locked()
  ? res.status(423).json({ error: 'Die persönlichen Daten sind nach einem Neustart noch verschlossen. Sie öffnen sich, sobald sich ein Admin mit Schlüssel anmeldet – oder mit dem Wiederherstellungscode.', vaultLocked: true }) : next()));
app.use('/api/admin', admin);

/** eigenes Passwort des angemeldeten Benutzers prüfen (Bestätigung heikler Aktionen) */
async function ownPwOk(req, pw) { const u = db.prepare('SELECT pw_hash FROM admin_users WHERE id = ?').get(req.user.id); return Boolean(u && pw && await auth.verifySecret(String(pw), u.pw_hash)); }
/** nur für Benutzer mit allen Rechten */
const owner = (req, res, next) => (req.user.role === 'oberadmin' ? next() : bad(res, 'Das darf nur ein Benutzer mit allen Rechten.', 403));

admin.post('/password', rateLimit('pwchange', 10, 10 * 60000), async (req, res) => {
  const { current, next } = req.body || {};
  const u = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.user.id);
  if (!await ownPwOk(req, current)) return pwBad(res, 'Aktuelles Passwort falsch.');
  if (!pwOk(next)) return bad(res, PW_MSG);
  await auth.setPassword(u.id, String(next));
  audit(req.user, 'Eigenes Passwort geändert', u.username);
  securityAlert('benutzer.passwort', `„${u.username}“ hat das eigene Passwort geändert (Adresse ${req.ip}). Warst du es nicht, bitte sofort ein neues Passwort vergeben.`, { key: u.username });
  const r = await auth.login(u.username, String(next), req.ip, 'admin', { tablet: Boolean(req.cwTablet) });
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
  const taken = new Set(db.prepare('SELECT username FROM admin_users').all().map(r => String(r.username).toLowerCase()));   // Benutzernamen: NOCASE
  res.json({ roles: db.prepare('SELECT * FROM admin_roles ORDER BY sort, name').all().map(r => ({ ...r, perms: jarr(r.perms), dept_scope: Boolean(r.dept_scope),
    users: db.prepare('SELECT username, roles FROM admin_users').all().filter(u => jarr(u.roles).map(Number).includes(r.id)).length })),
    departments: departmentList(), permLabels: plugins.visiblePerms(),
    members: db.prepare("SELECT id, name, first_name, last_name FROM members WHERE kind = 'mitglied' AND deleted = 0 AND active = 1 ORDER BY name_key(name, kind)").all()
      .map(m => { const sp = m.first_name || m.last_name ? { first: m.first_name || '', last: m.last_name || '' } : splitPersonName(m.name);
        return { id: m.id, name: m.name, linked: linked.has(m.id), username: suggestUsername(sp.first, sp.last, 0, taken) }; }) });
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
admin.post('/users', need('benutzer'), async (req, res) => {
  const { username, name, password, role, perms } = req.body || {};
  const b = req.body || {};
  if (role === 'oberadmin' && !await ownerConfirm(req, res)) return;   // „alle Rechte“ vergeben nur mit dem eigenen Passwort
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
  const id = await auth.createUser({ username: un, name: nm, password: String(password),
    role: role === 'oberadmin' ? 'oberadmin' : 'admin', perms: Array.isArray(perms) ? perms : [], roles, departments: depts, memberId });
  audit(req.user, 'Admin angelegt', `${un} (${role === 'oberadmin' ? 'alle Rechte' : [roles.map(r => (db.prepare('SELECT name FROM admin_roles WHERE id = ?').get(r) || {}).name).join(', '), Array.isArray(perms) ? permNames(perms) : ''].filter(Boolean).join(' · ')})`);
  securityAlert(role === 'oberadmin' ? 'benutzer.alle' : 'benutzer.rechte', `Neuer Benutzer der Verwaltung „${un}“${role === 'oberadmin' ? ' mit allen Rechten' : ''}, angelegt von ${req.user.name || req.user.username}.`, { key: un });
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
  securityAlert('benutzer.rechte', `Rolle „${r.v.name}“ angelegt von ${req.user.name || req.user.username}: ${permNames(jarr(r.v.perms)) || 'keine Rechte'}.`, { key: 'rolle-' + id });
  res.json({ id });
});
admin.put('/roles/:id', need('benutzer'), (req, res) => {
  const cur = db.prepare('SELECT * FROM admin_roles WHERE id = ?').get(int(req.params.id)); if (!cur) return bad(res, 'Nicht gefunden.', 404);
  const r = roleInput(req.body || {}, cur); if (r.error) return bad(res, r.error);
  if (db.prepare('SELECT 1 FROM admin_roles WHERE name = ? AND id != ?').get(r.v.name, cur.id)) return bad(res, 'Diese Rolle gibt es schon.');
  db.prepare('UPDATE admin_roles SET name = ?, description = ?, perms = ?, dept_scope = ?, sort = ? WHERE id = ?').run(r.v.name, r.v.description, r.v.perms, r.v.dept_scope, r.v.sort, cur.id);
  for (const u of db.prepare('SELECT id, roles FROM admin_users').all()) if (jarr(u.roles).map(Number).includes(cur.id)) auth.dropUserSessions(u.id);   // gilt sofort
  audit(req.user, 'Rolle geändert', `${r.v.name}: ${permNames(jarr(r.v.perms))}${r.v.dept_scope ? ' (nur eigene Abteilung)' : ''}`);
  if (r.v.perms !== cur.perms) securityAlert('benutzer.rechte', `Rechte der Rolle „${r.v.name}“ geändert von ${req.user.name || req.user.username}: ${permNames(jarr(r.v.perms)) || 'keine Rechte'}.`, { key: 'rolle-' + cur.id });
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

admin.put('/users/:id', need('benutzer'), async (req, res) => {
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
  if (role === 'oberadmin' && u.role !== 'oberadmin' && !await ownerConfirm(req, res)) return;   // auf „alle Rechte“ hochstufen nur mit dem eigenen Passwort
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
  if (role === 'oberadmin' && u.role !== 'oberadmin') securityAlert('benutzer.alle', `„${u.username}“ hat von ${req.user.name || req.user.username} alle Rechte bekommen.`, { key: u.username });
  else if (role !== u.role || perms !== u.perms || active !== u.active || (roles && JSON.stringify(roles) !== (u.roles || '[]'))) securityAlert('benutzer.rechte', `Rechte von „${u.username}“ geändert von ${req.user.name || req.user.username}${active ? '' : ' (gesperrt)'}.`, { key: u.username });
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
  securityAlert('benutzer.rechte', `Benutzer „${u.username}“ gelöscht von ${req.user.name || req.user.username}.`, { key: u.username });
  res.json({ ok: true });
});

admin.post('/users/:id/password', need('benutzer'), rateLimit('pwreset', 10, 10 * 60000), async (req, res) => {
  // mit dem eigenen Passwort bestätigen – eine fremde, offen gelassene Sitzung reicht nicht, um Passwörter zu ändern
  if (!await ownPwOk(req, (req.body || {}).myPassword)) return pwBad(res, 'Dein eigenes Passwort zur Bestätigung stimmt nicht.');
  const pw = String((req.body || {}).password || '');
  if (!pwOk(pw)) return bad(res, PW_MSG);
  const u = db.prepare('SELECT id, username FROM admin_users WHERE id = ?').get(int(req.params.id));
  if (!u) return bad(res, 'Nicht gefunden.', 404);
  await auth.setPassword(u.id, pw);
  audit(req.user, 'Passwort neu vergeben', u.username);
  securityAlert('benutzer.passwort', `Das Passwort von „${u.username}“ wurde von ${req.user.name || req.user.username} neu vergeben.`, { key: u.username });
  res.json({ ok: true });
});

/* ---------- Einstellungen ---------- */
const ORDER_KEYS = { order_supplier: '', order_email: '', order_cc: '', customer_no: '', delivery_address: '', order_sender: '', order_phone: '' };
const orderSettings = () => Object.fromEntries(Object.entries(ORDER_KEYS).map(([k, d]) => [k, getSetting(k, d)]));

/* Suche nach Datensätzen (Strg/⌘ K, siehe src/suche.js) – als POST, damit Suchbegriffe in keiner Adresse stehen; nie im Protokoll */
admin.post('/suche', (req, res) => res.json(require('./suche').run(req.user, req.body && req.body.q)));

admin.get('/settings', (req, res) => {
  const p = req.user.perms;   // Bestelldaten (Kundennummer, Adresse, Mail des Lieferanten) nur für „Bestellung“/„Einstellungen“
  res.json({ clubName: getSetting('club_name', process.env.CLUB_NAME || 'Unser Verein'), clubNameSet: require('./vereinsname').isSet(), lastSettlement: lastSettlement(),
    order: p.includes('bestellung') || p.includes('einstellungen') ? orderSettings() : undefined, clubColor: clubColor(), clubColor2: clubColor2(), tabletTheme: tabletTheme(), logo: logoUrl(), logoCustom: Boolean((logoInfo() || {}).custom),
    clubStreet: getSetting('club_street', ''), clubCity: getSetting('club_city', ''), clubEmail: getSetting('club_email', ''), clubPhone: getSetting('club_phone', ''), fiscalMonth: require('./geschaeftsjahr').month(),
    topN: topN(), topDays: topDays(), nurAnschreiben: nurAnschreiben(), tabletPw: p.includes('einstellungen') ? { on: gateOn(), since: getSetting('tablet_pw_at') } : undefined, tablet: tabletOn(), tabletChosen: getSetting('tablet_enabled', null) !== null,
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
admin.put('/settings/tablet-password', need('einstellungen'), async (req, res) => {
  const pw = String((req.body || {}).password || '');
  const pe = tabletPwError(pw); if (pe) return bad(res, pe);
  const first = !gateOn();
  setSetting('tablet_pw_hash', await auth.hashSecret(pw));
  setSetting('tablet_pw_at', nowTs());
  setSetting('tablet_pw_ver', crypto.randomBytes(6).toString('hex'));   // bisherige Geräte müssen das neue Passwort eingeben
  audit(req.user, first ? 'Buchungsseite: Passwortschutz eingeschaltet' : 'Buchungsseite: Passwort geändert');
  res.setHeader('Set-Cookie', gateCookie(req));                         // dieses Gerät bleibt freigeschaltet
  res.json({ ok: true });
});
/* Tablet im Vereinsheim ein- oder ausschalten. Einschalten ohne vergebenes Passwort geht nur zusammen mit einem neuen Passwort –
   so ist keine Tablet-Seite auch nur kurz ohne Passwort erreichbar. Ausschalten meldet alle freigeschalteten Geräte ab. */
admin.put('/settings/tablet', need('einstellungen'), async (req, res) => {
  const b = req.body || {}, on = Boolean(b.on), pw = String(b.password || ''), was = tabletOn();
  if (on && (pw || !gateOn())) {
    const pe = tabletPwError(pw); if (pe) return bad(res, gateOn() ? pe : 'Zum Einschalten bitte ein Passwort für das Tablet festlegen (mindestens 8 Zeichen).');
    setSetting('tablet_pw_hash', await auth.hashSecret(pw)); setSetting('tablet_pw_at', nowTs());
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
admin.post('/vault/prepare', need('einstellungen'), vaultPwLimit, async (req, res) => {
  if (!await ownPwOk(req, (req.body || {}).password)) return pwBad(res, 'Dein Passwort stimmt nicht.');
  try { res.json(require('./vault').prepare(req.user.id)); } catch (e) { bad(res, e.message); }
});
admin.post('/vault/enable', need('einstellungen'), vaultPwLimit, asyncRoute(async (req, res) => {
  const b = req.body || {}; const vault = require('./vault');
  if (!await ownPwOk(req, b.password)) return pwBad(res, 'Dein Passwort stimmt nicht.');
  try { if (!vault.confirmCode(req.user.id, b.typed)) return bad(res, 'Die Zeichen passen nicht zum Wiederherstellungscode – bitte auf dem Ausdruck nachsehen.'); } catch (e) { return bad(res, e.message); }
  try { await backup.snapshot(db, 'vor-verschluesselung'); } catch (e) { return bad(res, 'Vorher konnte keine Sicherung angelegt werden: ' + e.message); }
  let r; try { r = vault.enable(req.user.id, String(b.password)); } catch (e) { console.error('Tresor einschalten:', e); return bad(res, 'Das Einschalten ist fehlgeschlagen: ' + e.message, 500); }
  // alte, unverschlüsselte Schnappschüsse der Datenbank auf diesem Gerät entfernen (sie enthielten die Daten im Klartext)
  let removed = 0;
  if (b.deleteOld) for (const f of fs.readdirSync(backup.BACKUP_DIR).filter(x => /\.db$/.test(x))) { try { fs.unlinkSync(path.join(backup.BACKUP_DIR, f)); removed++; } catch (e) { /* nicht löschbar: bleibt liegen, zählt nicht mit */ } }
  if (b.deleteOld) try { await backup.snapshot(db, 'verschluesselt'); } catch (e) { console.error('Sicherung: neue verschlüsselte Sicherung fehlgeschlagen (nächste Nacht):', e.message); }
  audit(req.user, 'Tresor eingeschaltet', `${r.files} Dateien verschlüsselt, ${removed} alte Schnappschüsse entfernt, ${r.ms} ms`);
  res.json({ ok: true, ...r, removed });
}));
admin.post('/vault/unlock', vaultPwLimit, async (req, res) => {
  const b = req.body || {}; const vault = require('./vault');
  if (!await ownPwOk(req, b.password)) return pwBad(res, 'Dein Passwort stimmt nicht.');
  let ok = false; try { ok = vault.unlockWithCode(b.code); } catch (e) { return bad(res, e.message); }
  if (!ok) { audit(req.user, 'Tresor: falscher Wiederherstellungscode'); securityAlert('tresor.code', `Beim Tresor wurde von ${req.user.name || req.user.username} ein falscher Wiederherstellungscode eingegeben.`, { key: 'falsch' }); return pwBad(res, 'Der Wiederherstellungscode stimmt nicht.'); }
  vault.onPassword(req.user.id, String(b.password));   // ab jetzt öffnet auch die Anmeldung dieses Admins den Tresor
  audit(req.user, 'Tresor mit Wiederherstellungscode geöffnet');
  securityAlert('tresor.code', `Der Tresor wurde von ${req.user.name || req.user.username} mit dem Wiederherstellungscode geöffnet.`, { key: 'offen' });
  res.json({ ok: true });
});
admin.post('/vault/new-code', need('einstellungen'), vaultPwLimit, async (req, res) => {
  if (!await ownPwOk(req, (req.body || {}).password)) return pwBad(res, 'Dein Passwort stimmt nicht.');
  try { const code = require('./vault').newRecovery(); audit(req.user, 'Tresor: neuer Wiederherstellungscode'); securityAlert('tresor.neu', `Für den Tresor wurde von ${req.user.name || req.user.username} ein neuer Wiederherstellungscode erzeugt.`); res.json({ code }); } catch (e) { bad(res, e.message, e.status || 400); }
});
admin.post('/vault/disable', need('einstellungen'), vaultPwLimit, async (req, res) => {
  if (!await ownPwOk(req, (req.body || {}).password)) return pwBad(res, 'Dein Passwort stimmt nicht.');
  try { require('./vault').disable(); audit(req.user, 'Tresor ausgeschaltet'); securityAlert('tresor.aus', `Die Verschlüsselung der persönlichen Daten (Tresor) wurde von ${req.user.name || req.user.username} ausgeschaltet.`); res.json({ ok: true }); } catch (e) { bad(res, e.message, e.status || 400); }
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
  db.prepare("DELETE FROM settings WHERE key IN ('club_icon','club_icon_ver','club_icon_mask','club_icon_mask_ver')").run();   // App-Symbol wird aus dem neuen Logo neu erzeugt
  audit(req.user, 'Vereinslogo hochgeladen', r.type.toUpperCase() + ', ' + Math.round(r.data.length / 1024) + ' KB');
  res.json({ ok: true, logo: logoUrl(), type: r.type });
});
/* App-Symbol (PNG, quadratisch) für den Home-Bildschirm – iPhones nehmen dafür kein SVG. Der Browser der Verwaltung
   zeichnet es aus dem Vereinslogo und lädt es hier hoch. */
admin.post('/logo-icon', need('einstellungen'), express.raw({ type: () => true, limit: '1mb' }), (req, res) => {
  const b = req.body;
  if (!b || b.length < 100 || util.imageType(b) !== 'png') return bad(res, 'Kein PNG.');
  const mask = req.query.art === 'maskable';   // rundes Symbol für Android (maskable)
  setSetting(mask ? 'club_icon_mask' : 'club_icon', b.toString('base64'));
  setSetting(mask ? 'club_icon_mask_ver' : 'club_icon_ver', iconKey());
  res.json({ ok: true });
});
/* Logo als schlichtes PNG (vom Browser aus dem SVG gezeichnet) – für PDFs und E-Mails; gilt für genau diesen Logo-Stand */
admin.post('/logo-png', need('einstellungen'), express.raw({ type: () => true, limit: '2mb' }), (req, res) => {
  const b = req.body;
  if (!b || b.length < 100 || util.imageType(b) !== 'png') return bad(res, 'Kein PNG.');
  setSetting('club_logo_png', b.toString('base64'));
  setSetting('club_logo_png_ver', getSetting('club_logo_ver', 'std'));
  res.json({ ok: true });
});
admin.delete('/logo', need('einstellungen'), (req, res) => {
  db.prepare("DELETE FROM settings WHERE key IN ('club_logo','club_logo_type','club_logo_ver','club_icon','club_icon_ver','club_icon_mask','club_icon_mask_ver','club_logo_png','club_logo_png_ver')").run();
  audit(req.user, 'Vereinslogo entfernt');
  res.json({ ok: true, logo: logoUrl() });
});
const SETTINGS_LABELS = { club_name: 'Vereinsname', club_color: 'Vereinsfarbe', club_color2: 'Zweitfarbe', tablet_theme: 'Darstellung am Tablet', nur_anschreiben: ['Nur anschreiben (ohne Bar- und Kartenwege)', 'bool'] };
const TABLET_THEME_TXT = { auto: 'wie das Gerät', light: 'hell', dark: 'dunkel', hc: 'Hoher Kontrast' };
admin.put('/settings', need('einstellungen'), (req, res) => {
  const b = req.body || {};
  const look = () => ({ club_name: getSetting('club_name', ''), club_color: clubColor(), club_color2: clubColor2() || '', tablet_theme: TABLET_THEME_TXT[tabletTheme()], nur_anschreiben: nurAnschreiben() });
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
  if (b.nurAnschreiben !== undefined) setSetting('nur_anschreiben', b.nurAnschreiben === true || b.nurAnschreiben === '1' ? '1' : '0');
  const addr = [];
  for (const [k, key, max] of [['clubStreet', 'club_street', 80], ['clubCity', 'club_city', 80], ['clubPhone', 'club_phone', 40], ['clubEmail', 'club_email', 120]]) {
    if (b[k] === undefined) continue;
    const v = String(b[k] || '').replace(/\s+/g, ' ').trim().slice(0, max);
    if (k === 'clubEmail' && v && !require('./mail').mailOk(v)) return bad(res, 'Bitte eine gültige E-Mail-Adresse für den Verein eintragen.');
    setSetting(key, v); addr.push(key);
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
    await mail.send({ direct: true, to, cc, subject, text, log: { art: 'bestellung', by: req.user, name: getSetting('order_supplier', '') } });
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
    await mail.send({ direct: true, to, subject: `Test – ${getSetting('club_name', 'Verein')}`, text: 'Diese Testnachricht kommt von Clubwerk. Der E-Mail-Versand funktioniert.' });
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
  const evOpen = eventOpenAll();
  res.json({ from, to, seasonStart: seasonStart(), rows: rows.map(r => ({ ...r, last_seen: r.last_seen || null, hasPin: Boolean(r.hasPin), pinLocked: Boolean(r.pinLocked),
    active: Boolean(r.active), pending: Boolean(r.pending), eventOpen_cents: evOpen(r.id) })) });
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

admin.post('/members', need('konten'), async (req, res) => {
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
    .run(name, kind, kind === 'mannschaft' ? await auth.hashPin(pin) : null, kind === 'mannschaft' ? nowTs() : null, kind === 'mannschaft' ? req.user.username : null);
  audit(req.user, 'Konto angelegt', `${name} (${kind})`);
  res.json({ id: Number(r.lastInsertRowid) });
});

admin.put('/members/:id', need('konten'), async (req, res) => {
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
  if (kind !== m.kind) { audit(req.user, 'Kontoart geändert', `${name}: ${m.kind} → ${kind}`); if (kind === 'verein') securityAlert('konto.verein', `Das Konto „${name}“ wurde von ${req.user.name || req.user.username} auf „Verein (kostenfrei)“ umgestellt. Buchungen darauf kosten nichts.`, { key: m.id }); }
  if (pin) db.prepare(`UPDATE members SET pin_hash = ?, failed_pins = 0, pin_strikes = 0, locked_until = NULL, pin_changed_at = datetime('now','localtime'), pin_changed_by = ? WHERE id = ?`)
    .run(await auth.hashPin(pin), req.user.username, m.id);
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

/* Saison = Kalenderjahr (Spielsaison für „lange nicht gebucht“ – bewusst nicht das Geschäftsjahr, planung/geschaeftsjahr.md) */
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
  const norm = v => String(v || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
  const txt = c => { try { return cleanName(c.text, 40); } catch (e) { return ''; } };
  // Überschriften auch in den anderen Sprachen erkennen (Vorlage aus einer englischen Verwaltung usw.)
  const H = { typ: i18n.aliases(['typ', 'kontotyp', 'art', 'konto'], norm), pin: i18n.aliases(['pin', 'pincode', 'mannschaftspin'], norm),
    vn: i18n.aliases(['vorname', 'vornamen', 'rufname', 'firstname'], norm), nn: i18n.aliases(['nachname', 'familienname', 'name', 'zuname', 'lastname'], norm) };
  const teamWords = new RegExp(['mannschaft', 'team', 'gruppe', ...i18n.aliases(['mannschaft'], norm)].map(w => w.replace(/[^a-z0-9äöüß]/g, '')).filter(Boolean).join('|'));
  const found = await util.readSheet(buf, { want: { tc: H.typ, pc: H.pin, vn: H.vn, nn: H.nn }, norm, rows: 15, ok: c => c.vn && c.nn,
    notXlsx: 'Bitte eine Excel-Datei (.xlsx) hochladen. Alte .xls-Dateien vorher in Excel als .xlsx speichern.' });
  if (found) {
    const { ws, cols: { vn, nn, tc, pc } } = found;
    const out = [];
    for (let i = found.head + 1; i <= ws.rowCount && out.length < 3000; i++) {
      const row = ws.getRow(i);
      const v = txt(row.getCell(vn)), n = txt(row.getCell(nn));
      if (!v && !n) continue;
      const t = tc ? norm(txt(row.getCell(tc))) : '';
      const pin = pc ? String(row.getCell(pc).text || '').replace(/\D/g, '') : '';
      out.push({ line: i, first: v, last: n, kind: teamWords.test(t) ? 'mannschaft' : /kein|nicht|trainer/.test(t) ? 'nichtmitglied' : 'mitglied', pin });
    }
    return { sheet: ws.name, rows: out };
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
    for (const r of neu) if (r.kind === 'mannschaft' && !r.pinMissing) r.pinHash = await auth.hashPin(r.pin);   // vorher – die Transaktion läuft ohne await
    db.transaction(() => neu.forEach(r => {
      const team = r.kind === 'mannschaft', pin = team && !r.pinMissing ? r.pinHash : null;
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

const { belegFiles, buildExport, cleanupUploads, drinks, TRASH_DIR } = require('./verkauf')({
  addGuest, admin, asyncRoute, bad, cleanName, closeTab, CUT, defaultRange, eventOpenAll, guestOpen, int, isTs, maxBookingId, need, nurAnschreiben, NUR_ANSCHREIBEN_MSG, OPEN_GUEST,
  OPEN_KONTO, orderSettings, topDays, topN
});

const { bkCfg, bkHasKey, bkRunning, bkWartet, dropUpload, MB, ownerConfirm, probeBackup, runBackup, streamUpload } = require('./sicherung-routen')({
  admin, asyncRoute, bad, belegFiles, buildExport, defaultRange, DEMO_KOPIE, int, need, owner, ownPwOk, pwBad, rateLimit, restoredMsg, updMsg,
  viaIngress
});

/* Neustart: beendet den Prozess, der Watchdog von Home Assistant startet das Add-on neu */
/* Demo beenden und einrichten: alle Beispieldaten restlos löschen (beim Neustart, src/demo.js) – mit eigenem Passwort bestätigt */
admin.post('/demo/ende', need('einstellungen'), owner, rateLimit('demoende', 10, 10 * 60000), async (req, res) => {
  if (!isDemo()) return bad(res, 'Das ist keine Demo – hier wird nichts gelöscht.');
  if (!await ownPwOk(req, (req.body || {}).password)) return pwBad(res, 'Dein Passwort stimmt nicht.');
  const ticket = demo.markEnd(DATA_DIR);
  audit(req.user, 'Demo beendet', 'Alle Beispieldaten werden beim Neustart gelöscht');
  res.setHeader('Set-Cookie', `csetup=${ticket}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${req.secure ? '; Secure' : ''}`);
  res.json({ ok: true, restart: true });
  setTimeout(() => shutdown('Demo beenden', 1), 300);
});
/* „Demo“-Knopf je Modul (src/demokopie.js): nur eine zugleich, nur für den, der sie gestartet hat, Ende nach 30 Minuten ohne Nutzung */
admin.get('/demo-kopie', need('einstellungen'), (req, res) => res.json({ ...demokopie.status(req.user), modules: DEMO_KOPIE ? [] : demo.withData() }));
admin.post('/demo-kopie', need('einstellungen'), rateLimit('demokopie', 30, 10 * 60000), asyncRoute(async (req, res) => {
  const id = String((req.body || {}).module || ''), p = plugins.get(id);
  if (!p || !demo.withData().includes(id)) return bad(res, 'Für dieses Modul gibt es keine Demo.');
  const st = demokopie.status(req.user);
  if (st.running && !st.mine && !(req.body || {}).replace) return res.status(409).json({ error: `Es läuft schon eine Demo (${st.name}, gestartet von ${st.user}). Es gibt nur eine zugleich – sie endet ${st.leftMin} Minuten nach der letzten Nutzung.`, demo: st });
  let c;
  try { c = await demokopie.start({ module: id, name: p.meta.name, user: req.user }); } catch (e) { return bad(res, e.message, 500); }
  audit(req.user, 'Demo gestartet', `${p.meta.name}${st.running ? ` (vorherige Demo ${st.name} beendet)` : ''}`);
  console.log(`Demo-Kopie (${p.meta.name}) gestartet – ${demokopie.rssMb() || '?'} MB Arbeitsspeicher.`);
  res.setHeader('Set-Cookie', demokopie.browserCookies(c, req.secure));
  res.json({ ok: true, url: 'demo/admin.html', ...demokopie.status(req.user) });
}));
admin.delete('/demo-kopie', need('einstellungen'), (req, res) => {
  const st = demokopie.status(req.user);
  if (st.running) { demokopie.stop(`beendet von ${req.user.username}`); audit(req.user, 'Demo beendet', st.name); }
  res.json({ ok: true });
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
plugins.load({ app, admin, helpers: { need, rateLimit, rateLimitKey, bad, ownPwOk, int, cleanName, nowTs, util, invites: require('./invites'), drinks, asyncRoute, viaIngress } });
i18n.reload();   // Sprachdateien der Erweiterungen
try { require('./ids').ensureAutoincrement(db, DATA_DIR); } catch (e) { console.error('IDs: Umstellung der Erweiterungs-Tabellen fehlgeschlagen –', e.message); }
/* GoBD: Änderungsjournal für Geld und Belege (Trigger erst jetzt – alle Module und Tabellenumbauten sind geladen), Buchführung und Exporte */
try { require('./geschaeftsjahr').migrate(); } catch (e) { console.error('Geschäftsjahr:', e.message); }   // übernimmt „Wirtschaftsjahr“ der Buchführung
try { require('./gobd').install(); } catch (e) { console.error('GoBD: Änderungsjournal nicht eingerichtet –', e.message); }
require('./gobd').routes(admin, { need, bad, asyncRoute });
const memberapp = require('./memberapp');
memberapp.adminRoutes(admin, { bad, need, auth, ownPwOk });
require('./mailer').routes(admin, { bad, need });
/* Kontoauszug einlesen und abgleichen (src/kontoauszug.js) – Tabellen vor dem Tresor anlegen */
require('./kontoauszug').routes(admin, { need, bad, int, asyncRoute, rateLimit, express });
/* Datenschutz: Löschfristen aller Module, Löschlauf, Hinweis der Mitglieder-App, Verzeichnis (src/datenschutz.js) */
require('./datenschutz').routes(admin, { need, bad });
/* Datenqualität: Prüfungen von Kern und Modulen (src/datenqualitaet.js, Hook healthChecks) */
require('./datenqualitaet').routes(admin, { need, rateLimit, asyncRoute });
/* Sicherheitswarnungen (src/security.js): Liste, „Erledigt“, Testwarnung, zusätzliche Adressen – Einstellungen › Sicherheit */
admin.get('/security/alerts', need('sicherheit'), (req, res) => {
  const sec = require('./security'), c = sec.openCounts();
  res.json({ counts: { r: c.r || 0, a: c.a || 0 }, uhr: require('./uhr').status(), list: req.query.counts ? undefined : sec.listAlerts({ open: req.query.all !== '1' }),
    recipients: req.query.counts ? undefined : sec.recipients().map(r => ({ name: r.name, push: r.push, mail: Boolean(r.mail), linked: Boolean(r.member_id) })),
    extra: req.user.perms.includes('einstellungen') ? sec.extraAddresses().join(', ') : undefined, mayEdit: req.user.perms.includes('einstellungen'),
    mailReady: require('./mail').ready(), pushOn: require('./push').enabled('app.sicherheit') });
});
admin.post('/security/alerts/:id/done', need('sicherheit'), (req, res) => {
  const id = req.params.id === 'alle' ? 'alle' : parseInt(req.params.id, 10);
  if (id !== 'alle' && !Number.isInteger(id)) return bad(res, 'Unbekannte Warnung.', 404);
  const n = require('./security').done(id, req.user);
  if (!n && id !== 'alle') return bad(res, 'Diese Warnung ist schon erledigt.', 404);
  res.json({ ok: true, n });
});
admin.post('/security/test', need('sicherheit'), rateLimit('sectest', 5, 10 * 60000), (req, res) => {
  securityAlert('test', `Testwarnung, ausgelöst von ${req.user.name || req.user.username}. So kommen Sicherheitswarnungen an – per Push, E-Mail und hier in der Liste.`, { key: String(Date.now()) });
  res.json({ ok: true });
});
admin.put('/security/settings', need('einstellungen'), (req, res) => {
  const t = String((req.body || {}).extra || '').trim().slice(0, 500);
  if (t && !require('./mail').mailOk(t.replace(/[;\s]+/g, ','))) return bad(res, 'Bitte gültige E-Mail-Adressen eintragen (mehrere mit Komma).');
  const before = getSetting('security_mail_to', ''), after = t.split(/[,;\s]+/).filter(Boolean).join(', ');
  if (before === after) return res.json({ ok: true });
  setSetting('security_mail_to', after);
  audit(req.user, 'Sicherheitswarnungen: zusätzliche Adressen geändert', `${before || '–'} → ${after || '–'}`);
  securityAlert('empfaenger', `Die zusätzlichen Adressen für Sicherheitswarnungen wurden von ${req.user.name || req.user.username} geändert: vorher ${before || '–'}, jetzt ${after || '–'}.`);
  res.json({ ok: true });
});
/* Einrichtungs-Assistent: Schritte und ihr Zustand (src/einrichtung.js) */
require('./einrichtung').routes(admin, { need, bad, checks: {
  tabletOn, tabletPw: gateOn, https: () => tls.enabled(), vaultOn: () => require('./vault').on(), backupKey: bkHasKey, mailReady: () => mail.ready(),
  appModules: () => memberapp.activeModules().filter(([id]) => id !== 'nachrichten').length > 0, clubNets: () => memberapp.hasClubNets(), backupDone: () => Boolean(getSetting('backup_last_ok', '')) } });
/* Tresor: Kopie der persönlichen Daten im Arbeitsspeicher anlegen (gesperrt bis zur ersten Admin-Anmeldung) – erst jetzt,
   da alle Module ihre Tabellen angelegt haben */
const vault = require('./vault');
try { vault.start(); } catch (e) { console.error('Tresor beim Start:', e); }
/* Ältere Schnappschüsse (von vor dem Umzug der Zugangsdaten in den Tresor) enthalten sie noch im Klartext – bereinigen (src/geheim.js) */
if (!DEMO_KOPIE && process.env.CW_LESEKOPIE !== '1') { try { require('./geheim').schnappschuesse(backup.BACKUP_DIR); } catch (e) { console.error('Geheimnisse – Schnappschüsse:', e.message); } }
/* Lesekopie der Teil-Wiederherstellung (src/teilsicherung.js): Datenbank ist auf dem heutigen Stand, alle Module geladen – Export abliefern und enden, ohne Ports zu öffnen */
if (process.env.CW_LESEKOPIE === '1') return require('./teilsicherung').lesekopie({ plugins, db, vault, getSetting });
vault.onUnlock(() => require('./mail').flushQueue().then(n => { if (n) audit(null, 'Tresor: wartende E-Mails verschickt', String(n)); }));
memberapp.startPort({ rateLimit, rateLimitKey, memberBalance });

function navLinks() {
  return getJsonSetting('nav_links', [], Array.isArray).filter(isObj).map(x => ({ label: x.label, url: x.url }));
}
/* Eingebettete Links: nur genau diese Adressen dürfen im Rahmen (iframe) unter der Kopfzeile laufen */
function embedOrigins() {
  try { return [...new Set(navLinks().map(l => new URL(l.url).origin))].map(o => ' ' + o).join(''); } catch (e) { return ''; }
}
/** Leiste am Tablet: Module + Links, in der festgelegten Reihenfolge (Einstellungen → Reihenfolge am Tablet) */
function tabletItems() {
  const items = [...plugins.tabletNav().map(x => ({ ...x, key: x.id })), ...navLinks().map((l, i) => ({ id: 'link' + i, key: 'link:' + l.url, label: l.label, href: 'link.html?i=' + i, url: l.url }))];
  const order = getJsonSetting('tablet_order', [], Array.isArray);
  if (!order.length) return items;
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
/* Seitenleiste der Verwaltung: Namen, Reihenfolge und Zuordnung der Menüeinträge für den ganzen Verein (src/seitenleiste.js) */
const navLayout = () => seitenleiste.lesen(getSetting('club_nav', ''));
admin.get('/settings/nav-layout', need('einstellungen'), (req, res) => res.json(navLayout()));
admin.put('/settings/nav-layout', need('einstellungen'), (req, res) => {
  let neu; try { neu = seitenleiste.pruefen(req.body); } catch (e) { return bad(res, e.message); }
  const vor = navLayout();
  if (JSON.stringify(vor) !== JSON.stringify(neu)) {
    if (seitenleiste.leer(neu)) db.prepare("DELETE FROM settings WHERE key = 'club_nav'").run(); else setSetting('club_nav', JSON.stringify(neu));
    audit(req.user, 'Seitenleiste geändert', seitenleiste.aenderung(auditDiff, vor, neu, (req.body || {}).labels, (req.body || {}).ausgang));
  }
  res.json(neu);
});
admin.delete('/settings/nav-layout', need('einstellungen'), (req, res) => {
  if (getSetting('club_nav', '')) { db.prepare("DELETE FROM settings WHERE key = 'club_nav'").run(); audit(req.user, 'Seitenleiste auf Standard zurückgesetzt', null); }
  res.json(navLayout());
});
/* Anleitungen als PDF (werkzeuge/anleitungen/bauen.js erzeugt sie beim Bauen des Pakets; je Modul im Modulordner, Kern und Verkauf unter anleitungen/) */
const anleitungDatei = (id, l, ext) => {
  if (!/^[a-z0-9-]+$/.test(String(id))) return null;
  if (id === 'getraenke') id = 'verkauf';   // der Verkauf heißt intern „getraenke“
  const dir = ['kern', 'verkauf'].includes(id) ? path.join(__dirname, '..', 'anleitungen', id) : path.join(__dirname, '..', 'erweiterungen', id);
  const f = path.join(dir, `ANLEITUNG.${String(l).startsWith('en') ? 'en' : 'de'}.${ext}`);
  return fs.existsSync(f) ? f : null;
};
admin.get('/anleitung/:id', (req, res) => {
  const f = anleitungDatei(req.params.id, req.query.l, 'pdf');
  if (!f) return res.status(404).json({ error: 'Für dieses Modul gibt es keine Anleitung.' });
  res.type('application/pdf').set('Content-Disposition', `inline; filename="clubwerk-anleitung-${req.params.id}.pdf"`).sendFile(f);
});
/** Seitenzahl je Abschnitt (Anker) – damit „?“ an die Stelle des aktuellen Reiters springt */
admin.get('/anleitung/:id/seiten', (req, res) => {
  const f = anleitungDatei(req.params.id, req.query.l, 'json');
  res.json(f ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
});
admin.get('/extensions', (req, res) => {
  const all = plugins.list();
  // Jeder Admin bekommt die aktiven Erweiterungen mit Verwaltungsseite (zum Einblenden im Menü); die volle Liste nur mit „Einstellungen“
  const hidden = [];   // Seiten und Funktionen, die ein Modul gerade ausblendet (z. B. Arbeitsstunden abgeschaltet)
  for (const p of plugins.withHook('adminHidden')) { try { hidden.push(...(p.hooks.adminHidden() || [])); } catch (e) { console.error(`Modul ${p.meta.id}: ausgeblendete Seiten nicht lesbar:`, e.message); } }
  res.json({ navLayout: navLayout(), nurAnschreiben: nurAnschreiben(), hidden, modules: plugins.activeIds(), appModules: require('./memberapp').activeModules().map(([id]) => id), ui: all.filter(p => p.active && p.adminScript).map(p => ({ id: p.id, name: p.name, version: p.version, verwaltung: p.verwaltung, scripts: p.scripts })),
    all: req.user.perms.includes('einstellungen') || req.user.perms.includes('deinstallieren') ? all.map(p => ({ ...p, demo: !DEMO_KOPIE && demo.withData().includes(p.id) || undefined, anleitung: Boolean(anleitungDatei(p.id, 'de', 'pdf')) || undefined })) : undefined, links: navLinks() });
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
  if (!await ownerConfirm(req, res)) return;   // Erweiterungen laufen als Programmcode im Add-on – wie die Freigabe nur mit Passwort
  try {
    const r = await plugins.installZip(req.body);
    audit(req.user, r.update ? 'Erweiterung aktualisiert' : 'Erweiterung hochgeladen', `${r.name} ${r.version}`);
    securityAlert('erweiterung', `Erweiterung „${r.name} ${r.version}“ ${r.update ? 'aktualisiert' : 'hochgeladen'} von ${req.user.name || req.user.username}. Erweiterungen laufen als Programmcode im Add-on.`, { key: r.name });
    res.json({ ok: true, ...r, restart: true });
  } catch (e) { bad(res, e.message); }
}));
/* Erweiterung aus dem Netzwerkordner freigeben: nur das Adminkonto/„alle Rechte“, mit Passwort bestätigt */
admin.post('/extensions/:id/approve', need('einstellungen'), owner, rateLimit('approve', 10, 10 * 60000), async (req, res) => {
  if (!await ownPwOk(req, (req.body || {}).password)) return pwBad(res, 'Passwort falsch.');
  try { const r = plugins.approve(String(req.params.id), String((req.body || {}).hash || '')); audit(req.user, 'Erweiterung freigegeben', `${r.name} (${r.hash.slice(0, 12)})`); securityAlert('erweiterung', `Erweiterung „${r.name}“ freigegeben von ${req.user.name || req.user.username}. Sie läuft nach dem Neustart als Programmcode im Add-on.`, { key: r.name }); res.json({ ok: true, restart: true }); }
  catch (e) { bad(res, e.message); }
});
admin.delete('/extensions/:id', need('einstellungen'), owner, (req, res) => {
  try { const n = plugins.removeUploaded(String(req.params.id)); audit(req.user, 'Erweiterung entfernt', n); securityAlert('erweiterung.entfernt', `Erweiterung „${n}“ entfernt von ${req.user.name || req.user.username}.`); res.json({ ok: true, restart: true }); }
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
admin.post('/extensions/:id/import', express.json({ limit: '24mb' }), async (req, res) => {
  const p = plugins.get(String(req.params.id));
  if (!p || !plugins.isActive(p.meta.id) || typeof p.hooks.importConfig !== 'function') return bad(res, 'Für dieses Modul gibt es keinen Import.', 404);
  if (!mayConfig(req, p)) return bad(res, 'Dafür fehlt dir die Berechtigung.', 403);
  const b = req.body || {};
  // eigenes Passwort (Zugang, Beregnung: Geräte neu zuordnen) – falsche Versuche je Benutzer gebremst (src/geraete.js)
  const pw = await require('./geraete').bestaetigt(req, res, ownPwOk); if (!pw) return;
  if (b.format !== 'clubwerk-funktion' || !b.data) return bad(res, 'Das ist keine Funktionsdatei von Clubwerk.');
  if (b.module !== p.meta.id) return bad(res, `Diese Datei gehört zum Modul „${b.name || b.module}“, nicht zu „${p.meta.name}“.`);
  /* dry: Vorschau „x neu, y aktualisiert“ – der Import läuft in einem Sicherungspunkt, der danach verworfen wird (auch für die Teil-Wiederherstellung nutzbar) */
  const dry = b.dry === true;
  if (dry) db.exec('SAVEPOINT cw_dry');
  try {
    const info = { user: req.user, dry, confirmed: pw.confirmed };   // confirmed: Passwort oben geprüft; needPassword setzt das Modul in der Vorschau
    const summary = await p.hooks.importConfig(b.data, info);
    if (!dry) audit(req.user, `${p.meta.name}: Funktionsimport`, summary || '');
    res.json({ ok: true, summary, dry, needPassword: Boolean(info.needPassword) });
  } catch (e) { if (e.needPassword) res.status(428).json({ error: e.message, needPassword: true }); else bad(res, e.message, e.status === 403 ? 403 : 400); }
  finally { if (dry) db.exec('ROLLBACK TO cw_dry; RELEASE cw_dry'); }
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
  if (err && err.cwMeldung) return bad(res, err.message, err.status || 400);   // gewollte Meldung (z. B. PINs nach Wiederherstellung, src/pfeffer.js)
  console.error(err);
  bad(res, 'Interner Fehler – bitte im Add-on-Protokoll nachsehen.', 500);
});

/* ---------- Start, nächtliche Sicherung, sauberes Beenden ---------- */
try { cleanupUploads(); } catch (e) { console.error('Aufräumen:', e.message); }
require('./uhr').pruefen(securityAlert);   // Uhr gegen den neuesten Eintrag der Datenbank (Pi ohne Batterie-Uhr): sonst Geldläufe und Geräte-Automatik sperren
require('./datenschutz').start();   // Löschfristen: gleich nach dem Start (auch nach dem Zurückspielen einer Sicherung), dann täglich
if (restoredMsg) { console.log(restoredMsg); audit('system', 'Wiederherstellung', restoredMsg); }
if (demoMsg) { console.log(demoMsg); audit('system', 'Demo', demoMsg); }

let lastAuto = null, autoTry = 0, dbxLastTry = 0;
const START_AT = Date.now();
/** Tresor seit dem Neustart gesperrt: was wartet? (für die Warnung an den Vorstand – sie kommt per Push, Mails warten ja selbst) */
function tresorWartetText() {
  const st = require('./vault').status(), h = Math.max(1, Math.floor((Date.now() - START_AT) / 3600000));
  const was = [st.waitingMails ? `${st.waitingMails} E-Mail${st.waitingMails === 1 ? '' : 's'}` : '', bkHasKey() ? 'die Datensicherung außer Haus' : '', ...(st.wartet || []).filter(w => !/Datensicherung|Postfach/.test(w))].filter(Boolean);
  return `Der Tresor ist seit ${h} Stunde${h === 1 ? '' : 'n'} gesperrt (Neustart am ${new Date(START_AT).toLocaleString('de-DE')}).${was.length ? ` Bis sich ein Admin anmeldet (oder der Wiederherstellungscode eingegeben wird), warten: ${was.join(', ')}.` : ' Bitte als Admin anmelden.'}`;
}
const TRASH_DAYS = 11 * 366;   // gelöschte Lieferbelege bleiben so lange im Papierkorb: 10 Jahre Aufbewahrung ab Ende des Jahres (GoBD, § 147 AO)
/* Jeder Teil fängt seine Fehler selbst; ein unerwarteter Fehler darf nie als unbehandelte Promise-Ablehnung den Prozess beenden */
/* Komplettsicherung des Tages fällig? (ab der eingestellten Uhrzeit, noch nicht gelaufen) */
const bkFaellig = (now, day) => bkHasKey() && now.getHours() >= bkCfg().hour && getSetting('backup_last_day', '') !== day;
async function bkTag(now) {
  dbxLastTry = Date.now();
  console.log('Datensicherung:', await runBackup());
  // Probe-Wiederherstellung sonntags (bzw. nachgeholt, wenn die letzte über eine Woche her ist)
  const pAt = getSetting('backup_probe_at', '');
  if (now.getDay() === 0 || !pAt || Date.now() - Date.parse(pAt) > 7.5 * 86400000) console.log('Probe-Wiederherstellung:', await probeBackup());
}
/* Nach dem Entsperren: die wartende Sicherung des Tages gleich nachholen (nicht erst beim nächsten Durchlauf in bis zu 10 Minuten) */
vault.onUnlock(() => {
  if (DEMO_KOPIE) return;
  const now = new Date(), day = backup.stamp().slice(0, 10);
  if (!bkFaellig(now, day) || bkRunning()) return;
  setTimeout(() => bkTag(now).catch(e => console.error('Datensicherung (nachgeholt):', e.message)), 2000).unref();
});
/* Statistiken für den Abfrageplaner (SQLite-Doku zu PRAGMA optimize, planung/leitfaeden.md): nach dem Start einmal mit Grenze (0x10002 –
   untersucht nur Tabellen, bei denen es sich lohnt, kurz), danach stündlich und vor dem Beenden; meist tut es nichts. */
let optimizedAt = 0;
function dbOptimize() {
  if (Date.now() - optimizedAt < 3600000) return;
  try { db.pragma(optimizedAt ? 'optimize' : 'optimize=0x10002'); } catch (e) { console.error('Datenbank optimieren:', e.message); }
  optimizedAt = Date.now();
}
async function nightly() {
  dbOptimize();
  if (DEMO_KOPIE) return;   // keine Sicherungen in der Demo-Kopie
  try {
    const now = new Date();
    const day = backup.stamp().slice(0, 10);   // lokales Datum
    // Nächtlicher Schnappschuss: als erledigt gilt der Tag erst nach Erfolg (sonst stündlich neuer Versuch); vorher aufräumen, auch wenn es zuletzt nicht klappte
    if (now.getHours() >= 3 && lastAuto !== day && Date.now() - autoTry > 55 * 60 * 1000) {
      autoTry = Date.now();
      try {
        backup.aufraeumen();
        const have = backup.list().some(b => backup.stampOf(b.file).startsWith(`${day}_`) && b.file.endsWith('_auto.db'));   // auch alte getraenke_…
        if (!have) console.log('Nächtliche Sicherung:', await backup.snapshot(db, 'auto'));
        lastAuto = day;
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
      // Tresor seit über 2 Stunden gesperrt (Neustart, niemand hat sich angemeldet): einmal am Tag Bescheid geben, auch ohne fällige Sicherung
      if (require('./vault').locked() && Date.now() - START_AT >= 2 * 3600000 && getSetting('backup_wartet_day', '') !== day) {
        setSetting('backup_wartet_day', day); securityAlert('tresor.wartet', tresorWartetText());
      }
      if (bkFaellig(now, day) && bkWartet()) {   // Tresor gesperrt: einmal am Tag Bescheid geben, nach dem Entsperren nachholen (vault.onUnlock oben)
        if (getSetting('backup_wartet_day', '') !== day) { setSetting('backup_wartet_day', day); securityAlert('tresor.wartet', tresorWartetText()); }
      } else if (bkFaellig(now, day) && Date.now() - dbxLastTry > 55 * 60 * 1000) await bkTag(now);
    } catch (e) { console.error('Datensicherung fehlgeschlagen:', e.message); }
    // Integritätsprüfung der Datenbank: einmal pro Woche nachts (3–6 Uhr), in einem eigenen Thread (src/prozess.js)
    try {
      const at = getSetting('db_check_at', '');
      if ((now.getHours() >= 3 && now.getHours() < 6 || process.env.CW_TEST_DBCHECK === '1') && (!at || Date.now() - Date.parse(at) > 6.5 * 86400000 || Date.parse(at) > Date.now())) {
        setSetting('db_check_at', new Date().toISOString());
        const r = await prozess.integritaet(DB_FILE);
        setSetting('db_check_result', r.slice(0, 500));
        if (r === 'ok') console.log('Datenbank geprüft: in Ordnung.');
        else if (/^Prüfung (nicht möglich|abgebrochen)/.test(r)) console.error('Datenbank-Prüfung:', r);
        else { console.error('Datenbank-Prüfung:', r); securityAlert('datenbank', `Die wöchentliche Prüfung hat Fehler in der Datenbank gefunden: ${r.slice(0, 300)}. Bitte eine aktuelle Sicherung aufheben und den letzten intakten Schnappschuss unter Datensicherung zurückspielen.`); }
      }
    } catch (e) { console.error('Datenbank-Prüfung:', e.message); }
    try { require('./gobd').anchorDaily(); } catch (e) { console.error('GoBD-Anker:', e.message); }   // Kopf des Änderungsjournals täglich außerhalb der Datenbank festhalten
    // Datenqualität: einmal am Tag ab der Uhrzeit der Sicherung (Ergebnis unter Einstellungen › Datenqualität und in der Übersicht)
    try {
      if (now.getHours() >= bkCfg().hour && getSetting('dq_day', '') !== day) {
        setSetting('dq_day', day);
        const dq = require('./datenqualitaet'), red = r => new Set(dq.funde(r).filter(c => c.level === 'r').map(c => `${c.module || ''}:${c.id}`));
        const vorher = red(dq.stand()), r = await dq.pruefen(), neu = dq.funde(r).filter(c => c.level === 'r' && !vorher.has(`${c.module || ''}:${c.id}`));
        if (neu.length) securityAlert('datenqualitaet', `Die tägliche Prüfung hat neue Fehler in den Daten gefunden: ${neu.map(c => `${c.title} (${c.count})`).join(' · ')}. Bitte unter Einstellungen › Datenqualität ansehen.`);
      }
    } catch (e) { console.error('Datenqualität:', e.message); }
    // Sicherheit & Betrieb: Speicher (nach jedem Start und täglich), Alter der Sicherung (täglich), Tagesmail um 7 Uhr
    try {
      if (!secStartChecked || getSetting('sec_check_day', '') !== day) {
        if (getSetting('sec_check_day', '') !== day) {
          setSetting('sec_check_day', day);
          const lastOk = getSetting('backup_last_ok', '');
          if (bkHasKey() && lastOk && Date.now() - Date.parse(lastOk) > 48 * 3600000) securityAlert('sicherung.alt', `Seit ${new Date(lastOk).toLocaleString('de-DE')} gibt es keine erfolgreiche Datensicherung. Bitte unter Einstellungen › Datensicherung nachsehen.`);
        }
        secStartChecked = true;
        speicherPruefen();
      }
      if (now.getHours() >= 7 && getSetting('sec_digest_day', '') !== day) { setSetting('sec_digest_day', day); require('./security').digest(); }
    } catch (e) { console.error('Sicherheit & Betrieb:', e.message); }
  } catch (e) { console.error('Nächtliche Aufgaben:', e); }
}
let secStartChecked = false;
/** Freier Speicher im Datenordner: unter 15 % gelb, unter 5 % rot */
function speicherPruefen() {
  let st; try { st = fs.statfsSync(DATA_DIR); } catch (e) { return; }
  if (st.blocks && st.bavail / st.blocks < 0.15) { try { backup.aufraeumen(); st = fs.statfsSync(DATA_DIR); } catch (e) { /* weiter mit dem gemessenen Stand */ } }   // erst aufräumen, dann warnen
  const frei = st.bavail / st.blocks, gb = st.bavail * st.bsize / 1e9;
  if (!st.blocks || frei >= 0.15) return;
  securityAlert(frei < 0.05 ? 'speicher' : 'speicher.knapp', `Der Speicher von Clubwerk ist ${frei < 0.05 ? 'fast voll' : 'knapp'}: noch ${Math.round(frei * 100)} % frei (${gb.toLocaleString('de-DE', { maximumFractionDigits: 1 })} GB). Alte Sicherungen und Schnappschüsse belegen oft viel Platz.`);
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
  demokopie.stop('mit Clubwerk beendet');
  // Module aufräumen lassen (z. B. Türimpulse abschalten) – höchstens 3 Sekunden
  try {
    await Promise.race([Promise.allSettled(plugins.withHook('shutdown').map(p => p.hooks.shutdown())), new Promise(r => setTimeout(r, 3000))]);
  } catch (e) { console.error('Beenden:', e.message); }
  // Datenbank sauber schließen und SOFORT beenden – danach darf kein Zeitgeber mehr auf die Datenbank zugreifen
  try { db.pragma('optimize'); db.pragma('wal_checkpoint(TRUNCATE)'); db.close(); } catch (e) { console.error(e.message); }
  prozess.ende();   // geordnet beendet: beim nächsten Start kein Absturz
  process.exit(code);
}
/* Abgelehnte Promises im Hintergrund werden nur protokolliert, ein unerwarteter Fehler beendet geordnet (src/prozess.js);
   ab hier wacht ein eigener Thread über Hänger der Ereignisschleife. Häufige Abstürze → Sicherheitswarnung. */
prozess.gestartetMit(shutdown);
prozess.abstuerzeMelden(securityAlert);
process.on('exit', () => demokopie.stop('mit Clubwerk beendet'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
