'use strict';
/* ---------- Geräte-Einladungen (QR-Code) – gemeinsam für Beregnung, Zugang … ----------
   Ein Admin erzeugt für ein Mitglied eine Einladung (einmal gültig, verfällt standardmäßig nach 24 Stunden).
   Das Mitglied scannt den QR-Code, legt seine PIN für diesen Bereich fest – damit ist genau DIESES Gerät gekoppelt.
   Danach geht es nur mit Geräteschlüssel (liegt nur im Browser des Handys) + PIN.
   Neue Einladung = altes Gerät verliert sofort den Zugang. Jeder Bereich (scope) hat eigene PINs –
   unabhängig von der Getränke-PIN. Gespeichert werden nur Hashes, nie Schlüssel oder PINs im Klartext. */
const crypto = require('crypto');
const { db, getSetting, setSetting, audit } = require('./db');
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
for (const [c, t] of [['failed_total', 'INTEGER NOT NULL DEFAULT 0'], ['blocked_at', 'TEXT'], ['issuer_perms', 'TEXT'], ['transfer_hash', 'TEXT'], ['transfer_expires', 'INTEGER'], ['paired_host', 'TEXT'], ['token2_hash', 'TEXT'], ['handover_hash', 'TEXT'], ['handover_expires', 'INTEGER'],
  // 3.24: Einladung per Mail/Brief, „schon benutzt“ erkennen, gestufte Freischaltung (remote), zweiter Faktor per SMS
  ['invite_kind', 'TEXT'], ['used_hash', 'TEXT'], ['used_at', 'TEXT'], ['used_alerted', 'INTEGER NOT NULL DEFAULT 0'], ['remote', 'INTEGER NOT NULL DEFAULT 0'], ['verified', 'TEXT'],
  ['otp_hash', 'TEXT'], ['otp_expires', 'INTEGER'], ['otp_tries', 'INTEGER NOT NULL DEFAULT 0'], ['otp_day', 'TEXT'], ['otp_count', 'INTEGER NOT NULL DEFAULT 0'], ['otp_last', 'INTEGER'],
  // 3.24: eine PIN für App und Verkauf – pin_synced = alte, getrennt vergebene PINs einmalig abgeglichen
  ['pin_synced', 'INTEGER NOT NULL DEFAULT 0']]) {
  if (!db.prepare('PRAGMA table_info(member_devices)').all().some(x => x.name === c)) db.exec(`ALTER TABLE member_devices ADD COLUMN ${c} ${t}`);
}
db.exec('CREATE INDEX IF NOT EXISTS ix_devices_token2 ON member_devices(scope, token2_hash)');


/* Gültigkeit einer Einladung in Stunden (Einstellung „app_invite_hours“: 1, 24 oder 168) */
const INVITE_HOURS = [1, 24, 168];
const inviteHours = () => { const h = parseInt(getSetting('app_invite_hours', '24'), 10); return INVITE_HOURS.includes(h) ? h : 24; };
/* Einladungen per E-Mail oder Brief: eigene Gültigkeit in Tagen (Einstellung „app_invite_mail_days“: 2, 7 oder 14) */
const MAIL_DAYS = [2, 7, 14];
const mailDays = () => { const d = parseInt(getSetting('app_invite_mail_days', '7'), 10); return MAIL_DAYS.includes(d) ? d : 7; };
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

/** Push-Abos entkoppelter oder gesperrter Handys entfernen – sonst bekäme ein verlorenes Handy weiter Nachrichten des Mitglieds */
function dropPush(deviceIds) {
  if (!deviceIds.length) return;
  try { const push = require('./push'); for (const id of deviceIds) push.removeDevice(id); } catch (e) { /* Push nicht verfügbar */ }
}
const deviceIdsOf = (scope, memberId) => db.prepare('SELECT id FROM member_devices WHERE scope = ? AND member_id = ?').all(scope, memberId).map(r => r.id);

/** Einladung erzeugen – ersetzt (sperrt) ein bisher gekoppeltes Gerät dieses Mitglieds in diesem Bereich */
/* issuerPerms: Rechte des Admins, der die Einladung erzeugt hat ('*' = alle). Wird einem Mitglied später ein Bereich mit
   eigenem Recht (z. B. Türen) freigeschaltet, den dieser Admin nicht verwalten durfte, wird das Handy entkoppelt – sonst
   könnte jemand mit wenig Rechten vorab sein eigenes Handy koppeln und später Türzugang „erben“. */
function create(scope, memberId, by, issuerPerms, { kind = 'qr' } = {}) {
  scopeOk(scope);
  const hours = kind === 'qr' ? inviteHours() : mailDays() * 24;
  const m = db.prepare("SELECT id, name FROM members WHERE id = ? AND active = 1 AND deleted = 0 AND kind IN ('mitglied','nichtmitglied')").get(memberId);
  if (!m) throw new Error('Mitglied nicht gefunden.');
  const token = crypto.randomBytes(18).toString('base64url');
  dropPush(deviceIdsOf(scope, m.id));
  db.transaction(() => {
    db.prepare('DELETE FROM member_devices WHERE scope = ? AND member_id = ?').run(scope, m.id);
    db.prepare('INSERT INTO member_devices(scope, member_id, invite_hash, invite_expires, created_by, issuer_perms, invite_kind) VALUES (?,?,?,?,?,?,?)')
      .run(scope, m.id, sha(token), Date.now() + hours * 3600000, by || null, issuerPerms === '*' ? '*' : JSON.stringify(issuerPerms || []), ['mail', 'brief'].includes(kind) ? kind : 'qr');
  })();
  return { token, memberId: m.id, member: m.name, kind, expiresHours: hours, expiresAt: Date.now() + hours * 3600000, allowLink: getSetting('app_invite_link', '0') === '1' };
}

/** Einladung ansehen (vor dem Einlösen: für wen ist sie?) */
function peek(scope, inviteToken) {
  scopeOk(scope);
  const r = db.prepare(`SELECT d.*, m.name FROM member_devices d JOIN members m ON m.id = d.member_id
    WHERE d.scope = ? AND d.invite_hash = ?`).get(scope, sha(inviteToken || ''));
  if (!r) {
    // schon eingelöst? Dann war jemand schneller (oder das Mitglied selbst auf einem anderen Gerät) – melden
    const u = inviteToken ? db.prepare(`SELECT d.*, m.name FROM member_devices d JOIN members m ON m.id = d.member_id WHERE d.scope = ? AND d.used_hash = ?`).get(scope, sha(inviteToken)) : null;
    if (u) return { error: `Diese Einladung wurde bereits am ${String(u.used_at || '').slice(0, 16).replace(/^(\d{4})-(\d\d)-(\d\d)/, '$3.$2.$1')} Uhr auf einem Gerät (${u.device || 'unbekannt'}) eingelöst. Warst du das nicht, melde dich bitte sofort beim Vorstand.`, used: true, deviceId: u.id, memberId: u.member_id, member: u.name, alerted: Boolean(u.used_alerted), usedDevice: u.device };
    return { error: 'Diese Einladung ist ungültig oder wurde bereits verwendet. Bitte beim Vorstand einen neuen QR-Code holen.' };
  }
  if (r.invite_expires < Date.now()) return { error: 'Diese Einladung ist abgelaufen. Bitte beim Vorstand eine neue Einladung holen.' };
  const mp = scope === 'app' ? db.prepare('SELECT pin_hash FROM members WHERE id = ?').get(r.member_id) : null;
  return { member: r.name, memberId: r.member_id, kind: r.invite_kind || 'qr', deviceId: r.id, hasPin: Boolean(mp && mp.pin_hash) };
}

/** Einladung einlösen: PIN festlegen, Gerät koppeln → Geräteschlüssel (nur jetzt einmal im Klartext) */
/* remote: gekoppelt von unterwegs ohne zweiten Faktor → Türen/Beregnung erst nach dem ersten Besuch im Vereins-WLAN
   (oder Freigabe durch den Vorstand). verified: 'sms', wenn der SMS-Code stimmte. */
function redeem(scope, inviteToken, pin, userAgent, host, { remote = false, verified = null } = {}) {
  const p = peek(scope, inviteToken);
  if (p.error) throw new Error(p.error);
  /* Eine PIN für alles: Hat das Mitglied schon eine (Verkauf am Tablet), gilt sie auch hier und muss stimmen –
     wer nur die Einladung hat, kennt sie nicht. Nach 5 falschen Eingaben ist die Einladung verbraucht. */
  let pinHash;
  if (p.hasPin) {
    const m = db.prepare('SELECT pin_hash FROM members WHERE id = ?').get(p.memberId);
    if (!auth.verifySecret(String(pin || ''), m.pin_hash)) {
      const d = db.prepare('SELECT failed FROM member_devices WHERE id = ?').get(p.deviceId), n = (d ? d.failed : 0) + 1;
      if (n >= 5) { db.prepare('UPDATE member_devices SET invite_hash = NULL, invite_expires = NULL, failed = 0 WHERE id = ?').run(p.deviceId); audit(null, 'Mitglieder-App: Einladung nach 5 falschen PINs ungültig', p.member); throw new Error('PIN 5-mal falsch – diese Einladung gilt nicht mehr. Bitte beim Vorstand eine neue holen (er kann auch die PIN zurücksetzen).'); }
      db.prepare('UPDATE member_devices SET failed = ? WHERE id = ?').run(n, p.deviceId);
      const e = new Error(`Die PIN stimmt nicht – es ist dieselbe wie im Verkauf am Tablet. Noch ${5 - n} ${(5 - n) === 1 ? 'Versuch' : 'Versuche'}.`); e.pin = true; throw e;
    }
    pinHash = m.pin_hash;
  } else {
    const bad = auth.pinProblem(String(pin || ''));
    if (bad) throw new Error(bad);
    pinHash = auth.hashSecret(String(pin));
  }
  const device = crypto.randomBytes(24).toString('base64url');
  const r = db.prepare(`UPDATE member_devices SET invite_hash = NULL, invite_expires = NULL, token_hash = ?, token2_hash = NULL, handover_hash = NULL, pin_hash = ?, device = ?, paired_at = ?, paired_host = ?,
      used_hash = ?, used_at = ?, used_alerted = 0, remote = ?, verified = ?, otp_hash = NULL, otp_expires = NULL, otp_tries = 0
    WHERE scope = ? AND invite_hash = ? AND invite_expires >= ?`).run(sha(device), pinHash, deviceLabel(userAgent), now(), cleanHost(host), sha(inviteToken), now(), remote ? 1 : 0, verified, scope, sha(inviteToken), Date.now());
  if (!r.changes) throw new Error('Diese Einladung ist ungültig oder wurde bereits verwendet.');
  db.prepare('UPDATE member_devices SET failed = 0, pin_synced = 1 WHERE id = ?').run(p.deviceId);
  if (scope === 'app' && !p.hasPin) setMemberPin(p.memberId, pinHash, 'Mitglieder-App');   // neue PIN gilt ab jetzt auch im Verkauf
  return { device, member: p.member, memberId: p.memberId, deviceId: p.deviceId, kind: p.kind };
}

/* ---------- Zweiter Faktor per SMS (nur beim Einlösen einer Einladung von unterwegs) ----------
   6 Ziffern, 10 Minuten gültig, 5 Versuche je Code; je Mitglied höchstens 3 SMS am Tag und 60 Sekunden Abstand. */
const OTP_MIN = 10, OTP_TRIES = 5, OTP_PER_DAY = 3, OTP_GAP = 60000;
/** neuen Code für die offene Einladung erzeugen → { code } oder { error, status } (Code nur jetzt im Klartext) */
function otpCreate(scope, inviteToken) {
  const p = peek(scope, inviteToken); if (p.error) return { error: p.error, status: 410 };
  const d = db.prepare('SELECT * FROM member_devices WHERE id = ?').get(p.deviceId);
  const day = now().slice(0, 10), count = d.otp_day === day ? d.otp_count : 0;
  if (d.otp_last && Date.now() - d.otp_last < OTP_GAP) return { error: `Bitte ${Math.ceil((OTP_GAP - (Date.now() - d.otp_last)) / 1000)} Sekunden warten, dann geht eine neue SMS.`, status: 429 };
  if (count >= OTP_PER_DAY) return { error: `Heute wurden schon ${OTP_PER_DAY} SMS verschickt – bitte morgen noch einmal oder beim Vorstand melden.`, status: 429 };
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  db.prepare('UPDATE member_devices SET otp_hash = ?, otp_expires = ?, otp_tries = 0, otp_day = ?, otp_count = ?, otp_last = ? WHERE id = ?').run(sha(`${d.id}:${code}`), Date.now() + OTP_MIN * 60000, day, count + 1, Date.now(), d.id);
  return { code, memberId: d.member_id, minutes: OTP_MIN };
}
/** Code prüfen (vor dem Einlösen) → { ok } oder { error, status } */
function otpCheck(scope, inviteToken, code) {
  const p = peek(scope, inviteToken); if (p.error) return { error: p.error, status: 410 };
  const d = db.prepare('SELECT * FROM member_devices WHERE id = ?').get(p.deviceId);
  if (!d.otp_hash || !(d.otp_expires > Date.now())) return { error: 'Der SMS-Code ist abgelaufen – bitte einen neuen anfordern.', status: 400, otp: true };
  if (!/^\d{6}$/.test(String(code || '').trim())) return { error: 'Bitte die 6 Ziffern aus der SMS eingeben.', status: 400, otp: true };
  const a = Buffer.from(sha(`${d.id}:${String(code).trim()}`)), b = Buffer.from(d.otp_hash);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return { ok: true };
  const t = d.otp_tries + 1;
  if (t >= OTP_TRIES) { db.prepare('UPDATE member_devices SET otp_hash = NULL, otp_expires = NULL, otp_tries = 0 WHERE id = ?').run(d.id); return { error: `Code ${OTP_TRIES}-mal falsch – bitte einen neuen anfordern.`, status: 400, otp: true }; }
  db.prepare('UPDATE member_devices SET otp_tries = ? WHERE id = ?').run(t, d.id);
  return { error: 'Der Code stimmt nicht.', status: 400, otp: true };
}
/* ---------- Eine PIN für Mitglieder-App und Verkauf ---------- */
/** PIN (Hash) als Verkaufs-PIN übernehmen */
function setMemberPin(memberId, hash, by) {
  db.prepare(`UPDATE members SET pin_hash = ?, failed_pins = 0, pin_strikes = 0, locked_until = NULL, pin_changed_at = datetime('now','localtime'), pin_changed_by = ? WHERE id = ? AND kind IN ('mitglied','nichtmitglied')`).run(hash, by, memberId);
}
/** neue Verkaufs-PIN auch in der App (gekoppeltes Handy) setzen – nur auf Geräten, deren PIN die bisherige war.
 *  Wer die alte App-PIN nicht kennt (z. B. erste PIN am Tablet nach „PIN zurücksetzen“), ändert die App-PIN nicht –
 *  sonst könnte jeder am Tablet die PIN eines Mitglieds mit App festlegen und damit dessen Türen öffnen. */
function pinToApp(memberId, hash, oldPin) {
  if (!oldPin) return false;
  const upd = db.prepare('UPDATE member_devices SET pin_hash = ?, pin_synced = 1, failed = 0, locked_until = NULL WHERE id = ?');
  let n = 0;
  for (const d of db.prepare("SELECT id, pin_hash FROM member_devices WHERE scope = 'app' AND member_id = ? AND token_hash IS NOT NULL").all(memberId))
    if (d.pin_hash && auth.verifySecret(String(oldPin), d.pin_hash)) n += upd.run(hash, d.id).changes;
  return n > 0;
}
/** einmalig beim Start: App-PIN vorhanden, im Verkauf keine → übernehmen */
function syncPinsOnce() {
  const rows = db.prepare(`SELECT d.member_id, d.pin_hash FROM member_devices d JOIN members m ON m.id = d.member_id
    WHERE d.scope = 'app' AND d.token_hash IS NOT NULL AND d.pin_hash IS NOT NULL AND m.pin_hash IS NULL AND m.kind IN ('mitglied','nichtmitglied') AND m.deleted = 0`).all();
  for (const r of rows) setMemberPin(r.member_id, r.pin_hash, 'Mitglieder-App');
  if (rows.length) audit(null, 'PIN aus der Mitglieder-App in den Verkauf übernommen', `${rows.length} ${rows.length === 1 ? 'Mitglied' : 'Mitglieder'}`);
}
/** Gerät war im Vereins-WLAN (oder der Vorstand gibt es frei) → volle Freischaltung */
function trust(deviceId) { return db.prepare('UPDATE member_devices SET remote = 0 WHERE id = ? AND remote = 1').run(deviceId).changes > 0; }
/** „schon benutzt“-Warnung nur einmal je Einladung */
function markAlerted(deviceId) { return db.prepare('UPDATE member_devices SET used_alerted = 1 WHERE id = ? AND used_alerted = 0').run(deviceId).changes > 0; }

/* ---------- Übernahme in die Home-Bildschirm-App (iPhone) ----------
   iOS gibt einer Web-App auf dem Home-Bildschirm einen eigenen, leeren Speicher – die Freischaltung aus Safari kommt dort
   nicht an. Deshalb erzeugt das freigeschaltete Gerät einen einmaligen Übernahme-Code (10 Zeichen, 7 Tage gültig).
   Er wandert in die Startadresse der Home-Bildschirm-App (oder wird von Hand eingetippt). Eingelöst wird er nur zusammen
   mit der PIN; danach gilt ein neuer Geräteschlüssel und der alte (Safari) ist ungültig. */
const TR_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // ohne 0/O, 1/I – gut abzutippen
const TR_DAYS = 7;
const trNorm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const newTrCode = () => [...crypto.randomBytes(10)].map(b => TR_ALPHA[b % 32]).join('');   // 10 Zeichen, 50 Bit
function createTransfer(scope, deviceToken) {
  const w = whoIs(scope, deviceToken);
  if (!w) return null;
  const code = newTrCode();
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

/* Übergabe an die lokale Adresse (Vereinsheim): Die App unter der öffentlichen Adresse wechselt per Seitenaufruf auf
   https://lan…:5001 und nimmt die Kopplung mit – über einen einmaligen Code (60 s), der nur mit der PIN und nur aus dem
   Vereinsnetz eingelöst werden kann. Der Code gibt dem zweiten Speicherort (andere Adresse = anderer Browser-Speicher)
   einen eigenen Geräteschlüssel (token2_hash) für dasselbe Gerät; der erste Schlüssel bleibt gültig. */
const HANDOVER_MS = 60000;
function createHandover(scope, deviceToken) {
  const w = whoIs(scope, deviceToken);
  if (!w) return null;
  const code = newTrCode();
  db.prepare('UPDATE member_devices SET handover_hash = ?, handover_expires = ? WHERE id = ?').run(sha(code), Date.now() + HANDOVER_MS, w.deviceId);
  return code;
}
function redeemHandover(scope, code, pin, host) {
  scopeOk(scope);
  const c = trNorm(code);
  if (c.length !== 10) return { error: 'Der Code hat 10 Zeichen.', status: 400, badCode: true };
  const d = db.prepare(`SELECT d.* FROM member_devices d JOIN members m ON m.id = d.member_id
    WHERE d.scope = ? AND d.handover_hash = ? AND d.token_hash IS NOT NULL AND m.active = 1 AND m.deleted = 0`).get(scope, sha(c));
  if (!d || !(d.handover_expires > Date.now())) return { error: 'Dieser Code ist abgelaufen – bitte in der App erneut „Im Vereinsheim lokal öffnen“ antippen.', status: 410, badCode: true };
  const r = check(scope, null, pin, d);
  if (!r.ok) return r;
  const device = crypto.randomBytes(24).toString('base64url');
  db.prepare('UPDATE member_devices SET token2_hash = ?, handover_hash = NULL, handover_expires = NULL, last_used = ?, paired_host = COALESCE(paired_host, ?) WHERE id = ?').run(sha(device), now(), cleanHost(host), d.id);
  return { ok: true, device, member: r.name };
}

/** Gerät erkennen (ohne PIN) → { memberId, name } oder null */
function whoIs(scope, deviceToken) {
  if (!deviceToken || !SCOPE_RE.test(scope)) return null;
  const r = db.prepare(`SELECT d.id, d.member_id, d.remote, d.last_used, m.name FROM member_devices d JOIN members m ON m.id = d.member_id
    WHERE d.scope = ? AND (d.token_hash = ? OR d.token2_hash = ?) AND m.active = 1 AND m.deleted = 0`).get(scope, sha(deviceToken), sha(deviceToken));
  // „zuletzt benutzt“: jede Nutzung zählt, nicht nur die PIN-Eingabe (die App bleibt angemeldet) – höchstens alle 10 Minuten geschrieben
  if (r && (!r.last_used || r.last_used < now(new Date(Date.now() - 600000)))) db.prepare('UPDATE member_devices SET last_used = ? WHERE id = ?').run(now(), r.id);
  return r ? { deviceId: r.id, memberId: r.member_id, name: r.name, remote: Boolean(r.remote) } : null;
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
      db.prepare('UPDATE member_devices SET token_hash = NULL, token2_hash = NULL, handover_hash = NULL, failed = 0, failed_total = ?, locked_until = NULL, blocked_at = ? WHERE id = ?').run(total, now(), d.id);
      dropPush([d.id]);
      blockedAlert(scope, w.name, d.device, total);
      return { error: `PIN ${total}-mal falsch – dieses Handy ist jetzt gesperrt. Bitte beim Vorstand einen neuen QR-Code holen.`, status: 403, device: true };
    }
    const lock = n >= LOCK_STREAK ? (total >= LOCK_LONG_AFTER ? 30 : 5) : 0;
    db.prepare('UPDATE member_devices SET failed = ?, failed_total = ?, locked_until = ? WHERE id = ?').run(lock ? 0 : n, total, lock ? Date.now() + lock * 60000 : null, d.id);
    return { error: lock ? `PIN ${LOCK_STREAK}-mal falsch – ${lock} Minuten gesperrt. Nach ${BLOCK_AFTER} Fehlversuchen wird das Handy ganz gesperrt.` : 'Falsche PIN', status: lock ? 429 : 401, pin: true };
  }
  if (opts.shared) db.prepare('UPDATE member_devices SET last_used = ? WHERE id = ?').run(now(), d.id);
  else db.prepare('UPDATE member_devices SET failed = 0, failed_total = 0, locked_until = NULL, last_used = ? WHERE id = ?').run(now(), d.id);
  if (scope === 'app' && !d.pin_synced && !opts.shared) {   // vor 3.24 getrennt vergeben: die App-PIN gilt ab jetzt auch im Verkauf
    const m = db.prepare('SELECT pin_hash, kind FROM members WHERE id = ?').get(d.member_id);
    if (m && (m.kind === 'mitglied' || m.kind === 'nichtmitglied') && (!m.pin_hash || !auth.verifySecret(String(pin), m.pin_hash))) { setMemberPin(d.member_id, d.pin_hash, 'Mitglieder-App'); audit(null, 'PIN aus der Mitglieder-App in den Verkauf übernommen', w.name); }
    db.prepare('UPDATE member_devices SET pin_synced = 1 WHERE id = ?').run(d.id);
  }
  return { ok: true, name: w.name, memberId: w.memberId };
}

/** PIN in der App ändern: alte PIN zählt in dieselbe Sperre wie jede PIN-Eingabe auf dem Handy (check).
 *  Die neue PIN gilt für dieses Handy und – eine PIN für alles – auch am Tablet. → wie check(), bei Erfolg mit deviceId */
function changePin(scope, deviceToken, oldPin, newPin) {
  const bad = auth.pinProblem(newPin);   // zuerst: eine ungültige neue PIN kostet keinen Fehlversuch
  if (bad) return { error: bad, status: 400 };
  if (String(oldPin || '') === newPin) return { error: 'Die neue PIN ist dieselbe wie die bisherige.', status: 400 };
  const r = check(scope, deviceToken, oldPin);
  if (!r.ok) return r;
  const w = whoIs(scope, deviceToken), hash = auth.hashSecret(newPin);
  db.prepare('UPDATE member_devices SET pin_hash = ?, pin_synced = 1 WHERE id = ?').run(hash, w.deviceId);
  if (scope === 'app') setMemberPin(w.memberId, hash, 'Mitglieder-App');
  return { ...r, deviceId: w.deviceId };
}
/** Abmelden in der App: nur dieses Handy entkoppeln (wie „Handy entfernen“ in der Verwaltung) → { memberId, name } oder null */
function unpair(scope, deviceToken) {
  const w = whoIs(scope, deviceToken);
  if (!w) return null;
  dropPush([w.deviceId]);
  db.prepare('DELETE FROM member_devices WHERE id = ?').run(w.deviceId);
  return w;
}

/** Am gemeinsamen Tablet: Mitglied wählt sich aus der Liste und gibt seine PIN dieses Bereichs ein (ohne Geräteschlüssel) */
function checkMember(scope, memberId, pin) {
  scopeOk(scope);
  const d = db.prepare(`SELECT d.* FROM member_devices d JOIN members m ON m.id = d.member_id
    WHERE d.scope = ? AND d.member_id = ? AND d.token_hash IS NOT NULL AND m.active = 1 AND m.deleted = 0`).get(scope, memberId);
  if (!d) return { error: 'Für dich ist dieser Bereich nicht freigeschaltet.', status: 403 };
  return check(scope, null, pin, d, { shared: true });
}

/** Darf das vorhandene Handy/die offene Einladung einen neuen Bereich mit Recht `perm` bekommen? */
function issuerCovers(scope, memberId, perm) {
  const d = db.prepare('SELECT issuer_perms FROM member_devices WHERE scope = ? AND member_id = ?').get(scope, memberId);
  if (!d || !perm) return true;
  if (d.issuer_perms === '*') return true;
  try { return JSON.parse(d.issuer_perms || '[]').includes(perm); } catch (e) { return false; }
}
function revoke(scope, memberId) {
  scopeOk(scope);
  dropPush(deviceIdsOf(scope, memberId));
  return db.prepare('DELETE FROM member_devices WHERE scope = ? AND member_id = ?').run(scope, memberId).changes > 0;
}

/** QR-Code als SVG */
async function qrSvg(text) {
  const QR = require('qrcode');
  return QR.toString(String(text).slice(0, 600), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}

/* einmalig mit 3.24: bisher getrennte PINs zusammenführen (nicht bei jedem Start – sonst käme nach „PIN zurücksetzen“ die alte zurück) */
try { if (getSetting('pin_sync_324', '0') !== '1') { syncPinsOnce(); setSetting('pin_sync_324', '1'); } } catch (e) { console.error('PIN-Abgleich:', e.message); }

module.exports = { setMemberPin, pinToApp, syncPinsOnce, inviteHours, INVITE_HOURS, mailDays, MAIL_DAYS, otpCreate, otpCheck, trust, markAlerted, OTP_PER_DAY, BLOCK_AFTER, create, peek, redeem, whoIs, check, changePin, unpair, checkMember, revoke, issuerCovers, createTransfer, redeemTransfer, createHandover, redeemHandover, qrSvg };
