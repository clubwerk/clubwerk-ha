'use strict';
const crypto = require('crypto');
const { db, getSetting, setSetting } = require('./db');

function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifySecret(secret, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  if (String(secret).length > 200) return false;            // überlange Eingaben gar nicht erst rechnen
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(secret), salt, 32);
  const ref = Buffer.from(hash, 'hex');
  return ref.length === test.length && crypto.timingSafeEqual(ref, test);
}

/* ---------- Rechte ---------- */
/** Rechte, die Module auf die eigenen Abteilungen einschränken (nur diese wirken in Rollen „nur eigene Abteilung(en)“) */
const DEPT_PERMS = ['mitglieder', 'email'];

const PERMS = {
  lieferungen: 'Lieferungen & Belege hochladen',
  bestand: 'Bestand, Inventur & Abgleich',
  bestellung: 'Bestellung vorbereiten (Bestellmail)',
  buchungen: 'Buchungen stornieren & nachtragen',
  export: 'Aktuellen Stand ansehen & als Excel exportieren (z. B. Kassenprüfer)',
  abrechnung: 'Abrechnung: Konten als abgerechnet markieren (inkl. Export)',
  veranstaltungen: 'Veranstaltungen verwalten (Liste führen, „hat bezahlt“ abhaken)',
  uebernahme: 'Offene Veranstaltungsbeträge auf die Getränkeliste übernehmen (Kassierer)',
  artikel: 'Artikel & Preise',
  konten: 'Mitglieder anlegen & neue bestätigen',
  email: 'E-Mail an Mitglieder schreiben (Verein → E-Mail)',
  deinstallieren: 'Module deinstallieren und wieder installieren (vorher Pflicht-Sicherung)',
};

/* Rechte abgeschalteter Module zählen nicht (setzt plugins.js) */
let permFilter = () => true;
function setPermFilter(fn) { permFilter = fn; }
const parse = v => { try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } };
/** Rollen eines Benutzers (aus admin_roles) */
function rolesOf(u) {
  const ids = parse(u && u.roles).map(Number).filter(Number.isInteger);
  if (!ids.length) return [];
  return db.prepare(`SELECT * FROM admin_roles WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids).map(r => ({ ...r, perms: parse(r.perms) }));
}
/**
 * Rechte eines Benutzers → { perms, deptOnly }
 *  perms    = alles, was er darf (Einzelrechte + Rollen)
 *  deptOnly = Rechte, die er NUR über Rollen „nur eigene Abteilung(en)“ hat (das Modul schränkt sie auf diese Abteilungen ein)
 */
function permInfo(u) {
  if (!u) return { perms: [], deptOnly: [] };
  if (u.role === 'oberadmin') return { perms: [...Object.keys(PERMS).filter(p => permFilter(p)), 'benutzer', 'einstellungen'], deptOnly: [] };
  const ok = p => PERMS[p] && permFilter(p);
  const full = new Set(parse(u.perms).filter(ok)), scoped = new Set();
  // Rollen „nur eigene Abteilung(en)“ geben nur Rechte, die ein Modul wirklich auf Abteilungen einschränkt – andere würden sonst für alle gelten
  for (const r of rolesOf(u)) for (const p of r.perms.filter(ok)) if (!r.dept_scope) full.add(p); else if (DEPT_PERMS.includes(p)) scoped.add(p);
  return { perms: [...new Set([...full, ...scoped])], deptOnly: [...scoped].filter(p => !full.has(p)) };
}

/** Darf dieser Benutzer das Mitglied verwalten? Volle Rechte „Mitglieder“/„Mitglieder anlegen“ → ja;
 *  „Mitglieder“ nur für eigene Abteilung(en) → nur Mitglieder dieser Abteilungen (fragt die Mitgliederverwaltung). */
function memberAllowed(user, memberId) {
  if (!user) return false;
  const dept = user.deptOnly || [];
  if (user.perms.includes('konten') || (user.perms.includes('mitglieder') && !dept.includes('mitglieder'))) return true;
  if (!dept.includes('mitglieder') || !(user.depts || []).length) return false;
  try { return require('./plugins').withHook('memberInScope').some(p => p.hooks.memberInScope(memberId, user.depts)); } catch (e) { return false; }
}

const DUMMY_HASH = hashSecret(crypto.randomBytes(8).toString('hex'));

/* ---------- Admin-Sitzungen (im Speicher, 8 Stunden) ---------- */
const ADMIN_TTL_MS = 8 * 60 * 60 * 1000;
const ADMIN_MAX_MS = 24 * 60 * 60 * 1000;   // spätestens nach 24 h neu anmelden, auch bei Dauerbetrieb
const sessions = new Map(); // token -> { userId, expiresAt, maxAt }
const FAILS_MAX = 5000;     // Obergrenze, damit erfundene Benutzernamen den Speicher nicht füllen

function adminConfigured() {
  return db.prepare('SELECT COUNT(*) n FROM admin_users').get().n > 0;
}

function createUser({ username, name, password, role = 'admin', perms = [], builtin = false, roles = [], departments = [], memberId = null }) {
  const r = db.prepare('INSERT INTO admin_users(username, name, pw_hash, role, perms, builtin, roles, departments, member_id) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(username, name || username, hashSecret(password), role, JSON.stringify(perms.filter(p => PERMS[p])), builtin ? 1 : 0, JSON.stringify(roles), JSON.stringify(departments), memberId);
  vaultHook('onPassword', Number(r.lastInsertRowid), password);
  return Number(r.lastInsertRowid);
}

/* Tresor (verschlüsselte persönliche Daten): Anmeldung entsperrt ihn, neue Passwörter bekommen eine Schlüsselkopie */
function vaultHook(fn, ...a) { try { require('./vault')[fn](...a); } catch (e) { console.error('Tresor:', e.message); } }
function setPassword(userId, pw) {
  db.prepare('UPDATE admin_users SET pw_hash = ? WHERE id = ?').run(hashSecret(pw), userId);
  vaultHook('onPassword', userId, pw);
  for (const [k, v] of sessions) if (v.userId === userId) sessions.delete(k);
}

/* Sperre je Benutzername UND Absender-Adresse: Ein Angreifer kann sich selbst aussperren, aber nicht den echten Admin
   (der von seinem eigenen Gerät aus weiter hineinkommt). Zusätzlich zählt ein Zähler je Benutzername alle Fehlversuche
   (für die Warnung im Protokoll). */
const userFails = new Map();
// Je Konto über alle Absender: nach je 20 Fehlversuchen Pause (15 Min., dann doppelt …). Gegen Angreifer mit vielen Adressen.
// Über die Home-Assistant-Seitenleiste (trusted) gilt diese Pause nicht – so kann niemand den echten Admin aussperren.
const accountLimit = require('./security').limiter({ per: 20, baseMs: 15 * 60000 });
// Je Benutzername und Absender: nach je 5 Fehlversuchen Pause, die sich verdoppelt (5 Min., 10, 20 … höchstens 24 h)
const ipLimit = require('./security').limiter({ per: 5, baseMs: 5 * 60000, size: FAILS_MAX });
/* Bekannte Geräte: Nach einer erfolgreichen Anmeldung bekommt das Gerät ein signiertes Cookie. Die Pause je Konto (20 Fehlversuche)
   gilt für bekannte Geräte nicht – so kann ein Fremder im WLAN den echten Admin nicht mit falschen Passwörtern aussperren. */
const DEVICE_COOKIE = 'gdev';
function deviceSecret() {
  let k = getSetting('admin_device_secret');
  if (!k) { k = crypto.randomBytes(32).toString('hex'); setSetting('admin_device_secret', k); }
  return k;
}
const deviceSig = (name, rnd) => crypto.createHmac('sha256', deviceSecret()).update('geraet:' + name + ':' + rnd).digest('hex');
function deviceCookie(username, secure) {
  const name = String(username || '').trim().toLowerCase(), rnd = crypto.randomBytes(12).toString('hex');
  return `${DEVICE_COOKIE}=${encodeURIComponent(name)}.${rnd}.${deviceSig(name, rnd)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${365 * 24 * 3600}${secure ? '; Secure' : ''}`;
}
function knownDevice(req, username) {
  const parts = String(parseCookies(req)[DEVICE_COOKIE] || '').split('.'), sig = parts.pop(), rnd = parts.pop(), n = parts.join('.');   // Benutzernamen dürfen Punkte enthalten
  const name = String(username || '').trim().toLowerCase();
  if (!n || !rnd || !sig || n !== name || !/^[0-9a-f]{24}$/.test(rnd) || !/^[0-9a-f]{64}$/.test(sig)) return false;
  return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(deviceSig(name, rnd), 'hex'));
}

function login(username, pw, ip = '', scope = 'admin', { trusted = false, known = false } = {}) {
  const name = String(username || '').trim().toLowerCase();
  const key = name + '|' + String(ip || '');
  const now = Date.now();
  if (ipLimit.blocked(key)) return { ok: false, error: 'Zu viele Fehlversuche. Bitte in ein paar Minuten erneut versuchen.' };
  const accMin = trusted || known ? 0 : accountLimit.blocked(name);
  if (accMin) return { ok: false, error: `Für dieses Konto gab es zu viele Fehlversuche – Anmeldung in ${accMin} Min. wieder möglich (über die Home-Assistant-Seitenleiste sofort).` };
  const u = db.prepare('SELECT * FROM admin_users WHERE username = ? AND active = 1').get(name);
  const ok = verifySecret(pw, u ? u.pw_hash : DUMMY_HASH);   // gleiche Rechenzeit, auch wenn es den Namen nicht gibt
  if (!u || !ok) {
    const { locked } = ipLimit.fail(key);
    const uf = userFails.get(name) || { n: 0, since: now };
    if (now - uf.since > 24 * 3600000) { uf.n = 0; uf.since = now; }
    uf.n++; if (userFails.size > FAILS_MAX) userFails.delete(userFails.keys().next().value); userFails.set(name, uf);
    if (!trusted && !known && u) accountLimit.fail(name);   // nur echte Konten zählen (erfundene Namen füllen sonst die Liste)
    return { ok: false, error: 'Benutzername oder Passwort falsch.', locked, manyFails: uf.n === 25 || uf.n === 100 };
  }
  ipLimit.ok(key); accountLimit.ok(name);
  if (scope === 'admin') vaultHook('onLogin', u.id, pw);
  db.prepare("UPDATE admin_users SET last_login = datetime('now','localtime') WHERE id = ?").run(u.id);
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { userId: u.id, scope, expiresAt: now + ADMIN_TTL_MS, maxAt: now + ADMIN_MAX_MS });
  return { ok: true, token };
}

function logout(token) { sessions.delete(token); }
function dropUserSessions(userId) { for (const [k, v] of sessions) if (v.userId === userId) sessions.delete(k); }

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i <= 0) return;
    const v = p.slice(i + 1).trim();
    try { out[p.slice(0, i).trim()] = decodeURIComponent(v); } catch (e) { out[p.slice(0, i).trim()] = v; }
  });
  return out;
}

/* Sitzungen haben einen Bereich: „admin“ (Verwaltung, Cookie gadmin) oder „beregnung“ (Anmeldung in der Beregnungs-Webapp,
   Cookie gbereg). Eine Anmeldung in der Beregnung öffnet so nie die Verwaltung. */
const COOKIE_OF = { admin: 'gadmin', beregnung: 'gbereg' };
function currentUser(req, scope = 'admin') {
  const token = parseCookies(req)[COOKIE_OF[scope] || 'gadmin'];
  const s = token && sessions.get(token);
  if (!s || s.expiresAt < Date.now() || s.maxAt < Date.now()) { if (s) sessions.delete(token); return null; }
  if ((s.scope || 'admin') !== scope) return null;
  const u = db.prepare('SELECT id, username, name, role, perms, roles, departments, member_id, active, builtin FROM admin_users WHERE id = ?').get(s.userId);
  if (!u || !u.active) { sessions.delete(token); return null; }
  s.expiresAt = Date.now() + ADMIN_TTL_MS;
  const pi = permInfo(u);
  return { ...u, perms: pi.perms, deptOnly: pi.deptOnly, depts: parse(u.departments).map(Number).filter(Number.isInteger), token };
}

function requireAdmin(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Bitte anmelden.' });
  req.user = u;
  next();
}

/** Middleware: mindestens eines der Rechte nötig. */
function need(...perms) {
  return (req, res, next) => {
    if (req.user && perms.some(p => req.user.perms.includes(p))) return next();
    res.status(403).json({ error: 'Dafür fehlt dir die Berechtigung. Bitte an einen Admin mit allen Rechten wenden.' });
  };
}

/* ---------- Tablet-Freigaben (kurzlebig, nach PIN-Prüfung) ---------- */
const TABLET_TTL_MS = 3 * 60 * 1000;
const tabletTokens = new Map(); // token -> { memberId, expiresAt }

function issueTabletToken(memberId) {
  const token = crypto.randomBytes(16).toString('hex');
  tabletTokens.set(token, { memberId, expiresAt: Date.now() + TABLET_TTL_MS });
  return token;
}

function checkTabletToken(token) {
  const t = token && tabletTokens.get(token);
  if (!t || t.expiresAt < Date.now()) {
    if (t) tabletTokens.delete(token);
    return false;
  }
  t.expiresAt = Date.now() + TABLET_TTL_MS;
  return t.memberId;
}

function dropTabletToken(token) { tabletTokens.delete(token); }

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) if (v.expiresAt < now) sessions.delete(k);
  for (const [k, v] of tabletTokens) if (v.expiresAt < now) tabletTokens.delete(k);
}, 60 * 1000).unref();

module.exports = {
  PERMS, DEPT_PERMS, hashSecret, verifySecret, permInfo, setPermFilter, memberAllowed, deviceCookie, knownDevice,
  adminConfigured, createUser, setPassword, login, logout, dropUserSessions, parseCookies, currentUser, requireAdmin, need,
  issueTabletToken, checkTabletToken, dropTabletToken,
};
