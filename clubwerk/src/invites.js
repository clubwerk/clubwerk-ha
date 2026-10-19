'use strict';
/* ---------- Geräte-Einladungen (QR-Code) – gemeinsam für Beregnung, Zugang … ----------
   Ein Admin erzeugt für ein Mitglied eine Einladung (einmal gültig, verfällt standardmäßig nach 24 Stunden).
   Das Mitglied scannt den QR-Code, legt seine PIN für diesen Bereich fest – damit ist genau DIESES Gerät gekoppelt.
   Danach geht es nur mit Geräteschlüssel (liegt nur im Browser des Handys) + PIN.
   Neue Einladung = altes Gerät verliert sofort den Zugang. Jeder Bereich (scope) hat eigene PINs –
   unabhängig von der Getränke-PIN. Gespeichert werden nur Hashes, nie Schlüssel oder PINs im Klartext. */
const crypto = require('crypto');
const { db, getSetting, audit } = require('./db');
const auth = require('./auth');

db.exec(`
CREATE TABLE IF NOT EXISTS member_devices (
  id             INTEGER PRIMARY KEY,
  scope          TEXT NOT NULL,                 -- z. B. 'beregnung', 'zugang'
  member_id      INTEGER NOT NULL REFERENCES members(id),
  invite_hash    TEXT,                          -- sha256 der Einladung (bis eingelöst)
  invite_expires INTEGER,                       -- ms
  token_hash     TEXT,                          -- sha256 des Geräteschlüssels (nach Kopplung)
  pin_hash       TEXT,
  device         TEXT,                          -- Gerätebeschreibung aus dem Browser
  created_by     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  paired_at      TEXT,
  last_used      TEXT,
  failed         INTEGER NOT NULL DEFAULT 0,
  locked_until   INTEGER
);
CREATE INDEX IF NOT EXISTS ix_devices_scope ON member_devices(scope, member_id);
CREATE INDEX IF NOT EXISTS ix_devices_token ON member_devices(scope, token_hash);   -- whoIs bei jedem App-Aufruf
`);
for (const [c, t] of [['failed_total', 'INTEGER NOT NULL DEFAULT 0'], ['blocked_at', 'TEXT'], ['issuer_perms', 'TEXT'], ['transfer_hash', 'TEXT'], ['transfer_expires', 'INTEGER'], ['paired_host', 'TEXT']]) {
  if (!db.prepare('PRAGMA table_info(member_devices)').all().some(x => x.name === c)) db.exec(`ALTER TABLE member_devices ADD COLUMN ${c} ${t}`);
}


/* Gültigkeit einer Einladung in Stunden (Einstellung „app_invite_hours“: 1, 24 oder 168) */
const INVITE_HOURS = [1, 24, 168];
const inviteHours = () => { const h = parseInt(getSetting('app_invite_hours', '24'), 10); return INVITE_HOURS.includes(h) ? h : 24; };
/* PIN-Fehlversuche: je 5 in Folge kurze Sperre (5 Min., ab 10 Fehlern 30 Min.), nach 15 insgesamt ist das Gerät gesperrt */
const LOCK_STREAK = 5, LOCK_LONG_AFTER = 10, BLOCK_AFTER = 15;
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const { nowTs: now } = require('./util');
const SCOPE_RE = /^[a-z0-9_-]{2,30}$/;
function scopeOk(scope) { if (!SCOPE_RE.test(scope)) throw new Error('Ungültiger Bereich.'); }
function deviceLabel(ua) {
  ua = String(ua || '');
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? (ua.match(/Android[^;]*;\s*([^;)]+)/) || [])[1] || 'Android' : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows-PC' : 'Gerät';
  const br = /EdgA?\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return (os + (br ? ' · ' + br : '')).slice(0, 60);
}

/** Einladung erzeugen – ersetzt (sperrt) ein bisher gekoppeltes Gerät dieses Mitglieds in diesem Bereich */
/* issuerPerms: Rechte des Admins, der die Einladung erzeugt hat ('*' = alle). Wird einem Mitglied später ein Bereich mit
   eigenem Recht (z. B. Türen) freigeschaltet, den dieser Admin nicht verwalten durfte, wird das Handy entkoppelt – sonst
   könnte jemand mit wenig Rechten vorab sein eigenes Handy koppeln und später Türzugang „erben“. */
function create(scope, memberId, by, issuerPerms) {
  scopeOk(scope);
  const m = db.prepare("SELECT id, name FROM members WHERE id = ? AND active = 1 AND deleted = 0 AND kind = 'mitglied'").get(memberId);
  if (!m) throw new Error('Mitglied nicht gefunden.');
  const token = crypto.randomBytes(18).toString('base64url');
  db.transaction(() => {
    db.prepare('DELETE FROM member_devices WHERE scope = ? AND member_id = ?').run(scope, m.id);
    db.prepare('INSERT INTO member_devices(scope, member_id, invite_hash, invite_expires, created_by, issuer_perms) VALUES (?,?,?,?,?,?)')
      .run(scope, m.id, sha(token), Date.now() + inviteHours() * 3600000, by || null, issuerPerms === '*' ? '*' : JSON.stringify(issuerPerms || []));
  })();
  const hours = inviteHours();
  return { token, member: m.name, expiresHours: hours, expiresAt: Date.now() + hours * 3600000, allowLink: getSetting('app_invite_link', '0') === '1' };
}

/** Einladung ansehen (vor dem Einlösen: für wen ist sie?) */
function peek(scope, inviteToken) {
  scopeOk(scope);
  const r = db.prepare(`SELECT d.*, m.name FROM member_devices d JOIN members m ON m.id = d.member_id
    WHERE d.scope = ? AND d.invite_hash = ?`).get(scope, sha(inviteToken || ''));
  if (!r) return { error: 'Diese Einladung ist ungültig oder wurde bereits verwendet. Bitte beim Vorstand einen neuen QR-Code holen.' };
  if (r.invite_expires < Date.now()) return { error: 'Diese Einladung ist abgelaufen. Bitte beim Vorstand einen neuen QR-Code holen.' };
  return { member: r.name };
}

/** Einladung einlösen: PIN festlegen, Gerät koppeln → Geräteschlüssel (nur jetzt einmal im Klartext) */
function redeem(scope, inviteToken, pin, userAgent, host) {
  const p = peek(scope, inviteToken);
  if (p.error) throw new Error(p.error);
  if (!/^\d{4,8}$/.test(String(pin || ''))) throw new Error('Die PIN muss aus 4 bis 8 Ziffern bestehen.');
  const device = crypto.randomBytes(24).toString('base64url');
  const r = db.prepare(`UPDATE member_devices SET invite_hash = NULL, invite_expires = NULL, token_hash = ?, pin_hash = ?, device = ?, paired_at = ?, paired_host = ?
    WHERE scope = ? AND invite_hash = ? AND invite_expires >= ?`).run(sha(device), auth.hashSecret(String(pin)), deviceLabel(userAgent), now(), cleanHost(host), scope, sha(inviteToken), Date.now());
  if (!r.changes) throw new Error('Diese Einladung ist ungültig oder wurde bereits verwendet.');
  return { device, member: p.member };
}

/* ---------- Übernahme in die Home-Bildschirm-App (iPhone) ----------
   iOS gibt einer Web-App auf dem Home-Bildschirm einen eigenen, leeren Speicher – die Freischaltung aus Safari kommt dort
   nicht an. Deshalb erzeugt das freigeschaltete Gerät einen einmaligen Übernahme-Code (10 Zeichen, 7 Tage gültig).
   Er wandert in die Startadresse der Home-Bildschirm-App (oder wird von Hand eingetippt). Eingelöst wird er nur zusammen
   mit der PIN; danach gilt ein neuer Geräteschlüssel und der alte (Safari) ist ungültig. */
const TR_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // ohne 0/O, 1/I – gut abzutippen
const TR_DAYS = 7;
const trNorm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function createTransfer(scope, deviceToken) {
  const w = whoIs(scope, deviceToken);
  if (!w) return null;
  const bytes = crypto.randomBytes(10);
  const code = [...bytes].map(b => TR_ALPHA[b % 32]).join('');
  db.prepare('UPDATE member_devices SET transfer_hash = ?, transfer_expires = ? WHERE id = ?').run(sha(code), Date.now() + TR_DAYS * 86400000, w.deviceId);
  return code;
}
/** Adresse, unter der das Handy gekoppelt wurde (z. B. app.verein.de oder 192.168.178.20:5001) – das Handy merkt sich die Kopplung je Adresse */
const cleanHost = h => (/^[A-Za-z0-9.\-\[\]:]{1,120}$/.test(String(h || '')) ? String(h).toLowerCase() : null);
function redeemTransfer(scope, code, pin, userAgent, host) {
  scopeOk(scope);
  const c = trNorm(code);
  if (c.length !== 10) return { error: 'Der Übernahme-Code hat 10 Zeichen.', status: 400 };
  const d = db.prepare(`SELECT d.* FROM member_devices d JOIN members m ON m.id = d.member_id
    WHERE d.scope = ? AND d.transfer_hash = ? AND d.token_hash IS NOT NULL AND m.active = 1 AND m.deleted = 0`).get(scope, sha(c));
  if (!d || !(d.transfer_expires > Date.now())) return { error: 'Dieser Übernahme-Code ist ungültig oder abgelaufen. Bitte die Seite in Safari öffnen (dort steht ein neuer Code) oder beim Vorstand einen neuen QR-Code holen.', status: 400, badCode: true };
  const r = check(scope, null, pin, d);
  if (!r.ok) return r;
  const device = crypto.randomBytes(24).toString('base64url');
  db.prepare('UPDATE member_devices SET token_hash = ?, device = ?, transfer_hash = NULL, transfer_expires = NULL, last_used = ?, paired_host = COALESCE(?, paired_host) WHERE id = ?').run(sha(device), deviceLabel(userAgent), now(), cleanHost(host), d.id);
  return { ok: true, device, member: r.name };
}

/** Gerät erkennen (ohne PIN) → { memberId, name } oder null */
function whoIs(scope, deviceToken) {
  if (!deviceToken || !SCOPE_RE.test(scope)) return null;
  const r = db.prepare(`SELECT d.id, d.member_id, m.name FROM member_devices d JOIN members m ON m.id = d.member_id
    WHERE d.scope = ? AND d.token_hash = ? AND m.active = 1 AND m.deleted = 0`).get(scope, sha(deviceToken));
  return r ? { deviceId: r.id, memberId: r.member_id, name: r.name } : null;
}

/** Gesperrtes Gerät: Protokoll + E-Mail an die eingetragene Adresse (Mitglieder-App → Sicherheit) */
function blockedAlert(scope, member, device, total) {
  audit(null, 'Mitglieder-App: Handy wegen falscher PINs gesperrt', `${member} · ${device || 'Gerät'} · ${total} Fehlversuche`);
  const to = getSetting('security_mail_to', '');
  if (!to) return;
  try {
    const mail = require('./mail');
    if (!mail.ready() || !mail.mailOk(to)) return;
    const club = getSetting('club_name', 'Verein');
    mail.send({ to, subject: `Sicherheitshinweis – Mitglieder-App (${club})`,
      text: `Hallo,\n\nin der Mitglieder-App wurde ${BLOCK_AFTER}-mal hintereinander eine falsche PIN eingegeben.\n\nMitglied: ${member}\nGerät: ${device || 'unbekannt'}\nZeit: ${now()}\n\nDas Handy ist jetzt gesperrt. War es das Mitglied selbst (PIN vergessen), in der Verwaltung unter „Mitglieder-App“ einen neuen QR-Code erzeugen. Sonst bitte nachfragen – eventuell wurde das Handy verloren oder der QR-Code weitergegeben.\n\nAutomatisch versendet von Clubwerk.` })
      .catch(e => console.error('Sicherheits-Mail:', e.message));
  } catch (e) { console.error('Sicherheits-Mail:', e.message); }
}

/** Gerät + PIN prüfen → { ok, name } bzw. { error, status } – je 5 Fehlversuche kurze Sperre, nach 15 ist das Gerät gesperrt */
function check(scope, deviceToken, pin, row, opts = {}) {
  let w, d;
  if (row) { d = row; const m = db.prepare('SELECT name FROM members WHERE id = ?').get(d.member_id); w = { memberId: d.member_id, name: m.name }; }
  else {
    w = whoIs(scope, deviceToken);
    if (!w) return { error: 'Dieses Gerät ist nicht (mehr) freigeschaltet. Bitte beim Vorstand einen neuen QR-Code holen.', status: 403, device: true };
    d = db.prepare('SELECT * FROM member_devices WHERE id = ?').get(w.deviceId);
  }
  if (d.locked_until && d.locked_until > Date.now()) return { error: `Zu viele falsche PINs – bitte ${Math.ceil((d.locked_until - Date.now()) / 60000)} Min. warten.`, status: 429 };
  if (!auth.verifySecret(String(pin || ''), d.pin_hash)) {
    // am gemeinsamen Tablet zählen Fehlversuche NICHT auf das Handy – sonst könnte jemand am Tablet das Handy eines anderen sperren.
    // Das Tablet hat eigene Grenzen (je Mitglied, je Gerät, insgesamt).
    if (opts.shared) return { error: 'Falsche PIN', status: 401, pin: true };
    const n = d.failed + 1, total = (d.failed_total || 0) + 1;
    if (total >= BLOCK_AFTER) {
      db.prepare('UPDATE member_devices SET token_hash = NULL, failed = 0, failed_total = ?, locked_until = NULL, blocked_at = ? WHERE id = ?').run(total, now(), d.id);
      blockedAlert(scope, w.name, d.device, total);
      return { error: `PIN ${total}-mal falsch – dieses Handy ist jetzt gesperrt. Bitte beim Vorstand einen neuen QR-Code holen.`, status: 403, device: true };
    }
    const lock = n >= LOCK_STREAK ? (total >= LOCK_LONG_AFTER ? 30 : 5) : 0;
    db.prepare('UPDATE member_devices SET failed = ?, failed_total = ?, locked_until = ? WHERE id = ?').run(lock ? 0 : n, total, lock ? Date.now() + lock * 60000 : null, d.id);
    return { error: lock ? `PIN ${LOCK_STREAK}-mal falsch – ${lock} Minuten gesperrt. Nach ${BLOCK_AFTER} Fehlversuchen wird das Handy ganz gesperrt.` : 'Falsche PIN', status: lock ? 429 : 401, pin: true };
  }
  if (opts.shared) db.prepare('UPDATE member_devices SET last_used = ? WHERE id = ?').run(now(), d.id);
  else db.prepare('UPDATE member_devices SET failed = 0, failed_total = 0, locked_until = NULL, last_used = ? WHERE id = ?').run(now(), d.id);
  return { ok: true, name: w.name, memberId: w.memberId };
}

/** Am gemeinsamen Tablet: Mitglied wählt sich aus der Liste und gibt seine PIN dieses Bereichs ein (ohne Geräteschlüssel) */
function checkMember(scope, memberId, pin) {
  scopeOk(scope);
  const d = db.prepare(`SELECT d.* FROM member_devices d JOIN members m ON m.id = d.member_id
    WHERE d.scope = ? AND d.member_id = ? AND d.token_hash IS NOT NULL AND m.active = 1 AND m.deleted = 0`).get(scope, memberId);
  if (!d) return { error: 'Für dich ist dieser Bereich nicht freigeschaltet.', status: 403 };
  return check(scope, null, pin, d, { shared: true });
}

/** Übersicht für die Verwaltung */
/** Darf das vorhandene Handy/die offene Einladung einen neuen Bereich mit Recht `perm` bekommen? */
function issuerCovers(scope, memberId, perm) {
  const d = db.prepare('SELECT issuer_perms FROM member_devices WHERE scope = ? AND member_id = ?').get(scope, memberId);
  if (!d || !perm) return true;
  if (d.issuer_perms === '*') return true;
  try { return JSON.parse(d.issuer_perms || '[]').includes(perm); } catch (e) { return false; }
}
function revoke(scope, memberId) {
  scopeOk(scope);
  return db.prepare('DELETE FROM member_devices WHERE scope = ? AND member_id = ?').run(scope, memberId).changes > 0;
}

/** QR-Code als SVG */
async function qrSvg(text) {
  const QR = require('qrcode');
  return QR.toString(String(text).slice(0, 600), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}

module.exports = { inviteHours, INVITE_HOURS, BLOCK_AFTER, create, peek, redeem, whoIs, check, checkMember, revoke, issuerCovers, createTransfer, redeemTransfer, qrSvg };
