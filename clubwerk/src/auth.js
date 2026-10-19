'use strict';
const crypto = require('crypto');
const { db } = require('./db');

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
  for (const r of rolesOf(u)) for (const p of r.perms.filter(ok)) (r.dept_scope ? scoped : full).add(p);
  return { perms: [...new Set([...full, ...scoped])], deptOnly: [...scoped].filter(p => !full.has(p)) };
}

const DUMMY_HASH = hashSecret(crypto.randomBytes(8).toString('hex'));

/* ---------- Admin-Sitzungen (im Speicher, 8 Stunden) ---------- */
const ADMIN_TTL_MS = 8 * 60 * 60 * 1000;
const ADMIN_MAX_MS = 24 * 60 * 60 * 1000;   // spätestens nach 24 h neu anmelden, auch bei Dauerbetrieb
const sessions = new Map(); // token -> { userId, expiresAt, maxAt }
const fails = new Map();    // username -> { count, until, strikes }
const FAILS_MAX = 5000;     // Obergrenze, damit erfundene Benutzernamen den Speicher nicht füllen

function adminConfigured() {
  return db.prepare('SELECT COUNT(*) n FROM admin_users').get().n > 0;
}

function createUser({ username, name, password, role = 'admin', perms = [], builtin = false, roles = [], departments = [], memberId = null }) {
  const r = db.prepare('INSERT INTO admin_users(username, name, pw_hash, role, perms, builtin, roles, departments, member_id) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(username, name || username, hashSecret(password), role, JSON.stringify(perms.filter(p => PERMS[p])), builtin ? 1 : 0, JSON.stringify(roles), JSON.stringify(departments), memberId);
  return Number(r.lastInsertRowid);
}

function setPassword(userId, pw) {
  db.prepare('UPDATE admin_users SET pw_hash = ? WHERE id = ?').run(hashSecret(pw), userId);
  for (const [k, v] of sessions) if (v.userId === userId) sessions.delete(k);
}

/* Sperre je Benutzername UND Absender-Adresse: Ein Angreifer kann sich selbst aussperren, aber nicht den echten Admin
   (der von seinem eigenen Gerät aus weiter hineinkommt). Zusätzlich zählt ein Zähler je Benutzername alle Fehlversuche
   (für die Warnung im Protokoll). */
const userFails = new Map();
// Je Konto über alle Absender: nach je 20 Fehlversuchen Pause (15 Min., dann doppelt …). Gegen Angreifer mit vielen Adressen.
// Über die Home-Assistant-Seitenleiste (trusted) gilt diese Pause nicht – so kann niemand den echten Admin aussperren.
const accountLimit = require('./security').limiter({ per: 20, baseMs: 15 * 60000 });
function login(username, pw, ip = '', scope = 'admin', { trusted = false } = {}) {
  const name = String(username || '').trim().toLowerCase();
  const key = name + '|' + String(ip || '');
  const now = Date.now();
  const f = fails.get(key);
  if (f && f.until > now) return { ok: false, error: 'Zu viele Fehlversuche. Bitte in ein paar Minuten erneut versuchen.' };
  const accMin = trusted ? 0 : accountLimit.blocked(name);
  if (accMin) return { ok: false, error: `Für dieses Konto gab es zu viele Fehlversuche – Anmeldung in ${accMin} Min. wieder möglich (über die Home-Assistant-Seitenleiste sofort).` };
  const u = db.prepare('SELECT * FROM admin_users WHERE username = ? AND active = 1').get(name);
  const ok = verifySecret(pw, u ? u.pw_hash : DUMMY_HASH);   // gleiche Rechenzeit, auch wenn es den Namen nicht gibt
  if (!u || !ok) {
    const strikes = f ? f.strikes || 0 : 0;
    const c = (f ? f.count : 0) + 1;
    if (!f && fails.size >= FAILS_MAX) fails.delete(fails.keys().next().value);
    // Sperre verdoppelt sich bei jeder weiteren Fehlserie: 5 min, 10, 20 … höchstens 24 h
    if (c >= 5) fails.set(key, { count: 0, strikes: strikes + 1, until: now + Math.min(5 * 60000 * 2 ** strikes, 24 * 3600000), last: now });
    else fails.set(key, { count: c, strikes, until: 0, last: now });
    const uf = userFails.get(name) || { n: 0, since: now };
    if (now - uf.since > 24 * 3600000) { uf.n = 0; uf.since = now; }
    uf.n++; if (userFails.size > FAILS_MAX) userFails.delete(userFails.keys().next().value); userFails.set(name, uf);
    if (!trusted) accountLimit.fail(name);
    return { ok: false, error: 'Benutzername oder Passwort falsch.', locked: c >= 5, manyFails: uf.n === 25 || uf.n === 100 };
  }
  fails.delete(key); accountLimit.ok(name);
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
  // Fehlversuche nach 24 h ohne neuen Versuch vergessen
  for (const [k, v] of fails) if (v.until < now && now - (v.last || 0) > 24 * 3600000) fails.delete(k);
}, 60 * 1000).unref();

module.exports = {
  PERMS, hashSecret, verifySecret, permInfo, setPermFilter,
  adminConfigured, createUser, setPassword, login, logout, dropUserSessions, parseCookies, currentUser, requireAdmin, need,
  issueTabletToken, checkTabletToken, dropTabletToken,
};
