'use strict';
/* Zentraler E-Mail-Versand: ein Postfach für alle Module (Bestellung, Zeiterfassung, Erweiterungen).
   Eingetragen unter Einstellungen → Postfach. Umgebungsvariablen SMTP_* nur als Rückfall. */
const { getSetting, setSetting } = require('./db');

const K = k => 'mail_smtp_' + k;
const geheim = () => require('./geheim');
// Einmalig: Postfach aus der Zeiterfassung (bis 2.4) übernehmen
(function migrate() {
  if (getSetting(K('host'), '') || !getSetting('ext_zeiterfassung_smtp_host', '')) return;
  for (const k of ['host', 'port', 'user', 'pass', 'from']) {
    const v = getSetting('ext_zeiterfassung_smtp_' + k, '');
    if (v) setSetting(K(k), v);
    setSetting('ext_zeiterfassung_smtp_' + k, '');
  }
  console.log('E-Mail-Versand: Postfach aus der Zeiterfassung in die Einstellungen übernommen.');
})();

function config() {
  const g = (k, env) => getSetting(K(k), '') || process.env[env] || '';
  const user = g('user', 'SMTP_USER');
  // Passwort liegt im Tresor (src/geheim.js) – gesperrt nach einem Neustart: Mails warten (parked)
  const num = (k, def, max) => { const n = parseInt(getSetting(K(k), ''), 10); return n > 0 ? Math.min(n, max) : def; };
  return { host: g('host', 'SMTP_HOST'), port: Number(g('port', 'SMTP_PORT')) || 587, user, pass: geheim().get(K('pass'), '') || process.env.SMTP_PASS || '', from: g('from', 'SMTP_FROM') || user,
    perConn: num('perconn', 20, 500), perHour: num('perhour', 0, 100000) };   // Mails je Verbindung (Standard 20) und je Stunde (0 = unbegrenzt)
}
const ready = () => { const s = config(); return Boolean(s.host && s.from); };
const validMails = v => String(v || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
const mailOk = v => validMails(v).length > 0 && validMails(v).every(m => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m));
/** Für die Verwaltung: ohne Passwort */
const publicConfig = () => { const s = config(); return { host: s.host, port: s.port, user: s.user, from: s.from, hasPass: Boolean(s.pass) || geheim().has(K('pass')), passLocked: geheim().locked(K('pass')), ready: ready(),
  perConn: s.perConn, perHour: s.perHour || '', queued: queueInfo() }; };

function save(b) {
  const host = String(b.host || '').trim(), from = String(b.from || '').trim(), user = String(b.user || '').trim();
  const port = parseInt(b.port, 10) || 587;
  if (host && !/^[a-z0-9.-]+$/i.test(host)) throw new Error('Bitte nur den Servernamen eintragen, z. B. mail.gmx.net.');
  if (port < 1 || port > 65535) throw new Error('Ungültiger Port.');
  if (from && !mailOk(from)) throw new Error('Absender bitte als E-Mail-Adresse.');
  for (const [k, v] of [['host', host], ['port', String(port)], ['user', user.slice(0, 200)], ['from', from]]) setSetting(K(k), v);
  if (b.pass !== undefined && b.pass !== '') geheim().set(K('pass'), String(b.pass).slice(0, 300));
  if (b.clearPass) geheim().drop(K('pass'));
  // Drosselung: leer = Standard (je Verbindung) bzw. unbegrenzt (je Stunde)
  for (const [k, f, max] of [['perconn', 'perConn', 500], ['perhour', 'perHour', 100000]]) {
    if (b[f] === undefined) continue;
    const raw = String(b[f]).trim(), n = parseInt(raw, 10);
    if (raw && (!(n >= 1) || n > max || String(n) !== raw)) throw new Error(`Bitte bei „Mails je ${f === 'perConn' ? 'Verbindung' : 'Stunde'}“ eine ganze Zahl von 1 bis ${max} eintragen (oder leer lassen).`);
    setSetting(K(k), raw);
  }
  return `${host}:${port}${user ? ' · ' + user : ''}`;
}

function transport(pool, perConn) {
  const s = config();
  if (!s.host || !s.from) throw new Error('Kein Postfach eingerichtet (Einstellungen → Postfach).');
  const nodemailer = require('nodemailer');
  // 465 = verschlüsselt von Anfang an, 587 = Verschlüsselung (STARTTLS) ist Pflicht – sonst könnte jemand sie unterdrücken und das Passwort mitlesen
  return { s, t: nodemailer.createTransport({ host: s.host, port: s.port, secure: s.port === 465, requireTLS: s.port === 587, auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 30000, ...(pool ? { pool: true, maxConnections: 1, maxMessages: perConn || s.perConn } : {}) }) };
}
/** Absender: immer das Vereinspostfach (sonst landen Mails im Spam), optional mit Anzeigenamen */
const fromOf = (s, fromName) => (fromName ? { name: String(fromName).replace(/[\r\n"<>]/g, ' ').slice(0, 80), address: s.from } : s.from);
function message(s, { to, cc, bcc, replyTo, subject, text, html, attachments, fromName, raw, card, plainOnly }) {
  if (!mailOk(to)) throw new Error('Keine gültige Empfänger-Adresse.');
  // Anhänge aus dem Tresor (verschlüsselte Dokumente) entschlüsselt mitschicken
  if (attachments && attachments.some(a => a && a.path)) {
    const vault = require('./vault');
    attachments = attachments.map(a => (a && a.path ? (() => { const { path: p, ...rest } = a; return { ...rest, content: vault.readFile(p) }; })() : a));
  }
  if (cc && !mailOk(cc)) throw new Error('Ungültige Adresse bei „Kopie an“.');
  if (replyTo && !mailOk(replyTo)) throw new Error('Ungültige Antwortadresse.');
  if (!raw) {   // Systemmails in der Sprache der Anfrage bzw. der Vereinssprache – selbst geschriebene Mails bleiben, wie sie sind
    const i18n = require('./i18n');
    subject = i18n.tr(String(subject || '')); text = i18n.tr(String(text || ''));
    if (card) card = { ...card, heading: card.heading ? i18n.tr(String(card.heading)) : card.heading, title: card.title ? i18n.tr(String(card.title)) : card.title, before: card.before != null ? i18n.tr(String(card.before)) : card.before, after: card.after != null ? i18n.tr(String(card.after)) : card.after,
      rows: (card.rows || []).map(([k, v]) => [i18n.tr(String(k)), v]), steps: card.steps ? card.steps.map(t => i18n.tr(String(t))) : card.steps, button: card.button && card.button !== true ? { ...card.button, label: i18n.tr(String(card.button.label || '')), note: card.button.note ? i18n.tr(String(card.button.note)) : card.button.note } : card.button,
      calendar: card.calendar ? { ...card.calendar, label: i18n.tr(String(card.calendar.label || 'Zu deinem Kalender hinzufügen')) } : card.calendar };
  }
  // Gestaltete HTML-Fassung (Logo, Vereinsfarbe, Infokarte) – die Textfassung bleibt für Mailprogramme ohne HTML
  if (!html && !plainOnly) {
    try { const r = require('./mailtpl').render({ subject, text, card }); html = r.html; attachments = [...(attachments || []), ...r.attachments]; } catch (e) { console.error('E-Mail-Layout:', e.message); }
  }
  return { from: fromOf(s, fromName), to: validMails(to).join(', '), cc: cc ? validMails(cc).join(', ') : undefined, bcc: bcc ? validMails(bcc).join(', ') : undefined,
    replyTo: replyTo || undefined, subject, text, html: html || undefined, attachments };
}

/** send({ to, cc, replyTo, subject, text, html, attachments, fromName, raw, card }) – card = { before, title, rows: [[k, v]], after, button } für die Infokarte im HTML */
/* Tresor gesperrt (nach einem Neustart, bis sich ein Admin anmeldet): Die Adressen der Mitglieder sind dann Platzhalter
   (gesperrt-<id>@clubwerk.invalid), und das Postfach-Passwort liegt ebenfalls im Tresor. Solche Mails warten verschlüsselt
   und gehen nach dem Entsperren raus – ohne Postfach-Passwort (z. B. Weiterleitung im eigenen Netz) nur die mit Platzhaltern. */
function parked(o) {
  const vault = require('./vault');
  if (!vault.on() || !vault.locked()) return false;
  if (!geheim().locked(K('pass')) && !(vault.hasPlaceholder(o.to) || vault.hasPlaceholder(o.cc) || vault.hasPlaceholder(o.bcc))) return false;
  vault.queueMail(o);
  return true;
}
/* ---------- Vorübergehende Fehler (4xx) und Drosselung ----------
   Antwortet der Mailserver mit 4xx (z. B. 451 „Mails per session limit exceeded“, 421, 450, 452), ist das kein Fehlschlag: die Mail wartet und wird
   automatisch nachgeholt (Pausen 1, 5, 15, dann 60 Minuten, höchstens 24 Stunden). 5xx (z. B. unbekannte Adresse) bleibt sofort ein Fehler.
   Einzelmails warten in derselben Tabelle wie die Mails bei gesperrtem Tresor (vault_mail, Spalte due = nächster Versuch). */
const BACKOFF_MIN = [1, 5, 15, 60], GIVE_UP_MS = 24 * 3600 * 1000, HOUR = 3600 * 1000;
const temporary = e => { const c = Number(e && e.responseCode); return c >= 400 && c < 500; };
const limitHit = e => temporary(e) && /limit|too many|exceed|per (session|connection|hour|day)|rate/i.test(String((e && e.response) || (e && e.message) || ''));
/** Wartezeit in Millisekunden vor dem n-ten Wiederholen (n ab 0) */
const backoffMs = n => BACKOFF_MIN[Math.min(n, BACKOFF_MIN.length - 1)] * (Number(process.env.CW_MAIL_BACKOFF_UNIT) || 60000);   // CW_MAIL_BACKOFF_UNIT: nur für Tests
const sentLog = [];   // Zeitpunkte erfolgreicher Sendungen der letzten Stunde (nur im Speicher; nach einem Neustart beginnt die Zählung neu)
const noteSent = () => { sentLog.push(Date.now()); };
/** 0 = darf senden, sonst Millisekunden bis wieder ein Platz in der Stunde frei ist */
function hourWait() {
  const lim = config().perHour; if (!lim) return 0;
  const now = Date.now(); while (sentLog.length && sentLog[0] <= now - HOUR) sentLog.shift();
  return sentLog.length >= lim ? sentLog[0] + HOUR - now + 1000 : 0;
}
const shortErr = e => String((e && e.message) || e || '').replace(/\s+/g, ' ').slice(0, 300);
function defer(o, e, ms, since) { require('./vault').queueMail(o, { due: Date.now() + ms, since: since || Date.now(), error: shortErr(e) }); }
function queueInfo() {
  try { const r = require('./vault').dueInfo(); return r; } catch (e) { return { n: 0, next: null }; }
}

async function send(o) {
  if (!require('./vereinsname').isSet()) throw new Error(require('./vereinsname').MSG);
  if (parked(o)) return { queued: true };
  const { direct, ...rest } = o;   // direct: Fehler sofort melden statt warten (Testmail)
  const wait = direct ? 0 : hourWait();
  if (wait > 0) { defer(rest, 'Stundengrenze erreicht', wait); return { queued: true, waiting: true }; }
  const { s, t } = transport(false);
  try { await t.sendMail(message(s, rest)); noteSent(); }
  catch (e) { if (!direct && temporary(e)) { defer(rest, e, backoffMs(0)); return { queued: true, waiting: true }; } throw e; }
}
/** Viele Mails nacheinander über eine Verbindung: const x = session(); await x.send({…}); x.close(); x.reopen(n) = neue Verbindung mit höchstens n Mails */
function session(perConn) {
  if (!require('./vereinsname').isSet()) throw new Error(require('./vereinsname').MSG);
  let cur = transport(true, perConn); let n = perConn || cur.s.perConn;
  const close = () => { try { cur.t.close(); } catch (e) { /* zu */ } };
  return { get perConn() { return n; },
    send: async o => { if (parked(o)) return { queued: true }; await cur.t.sendMail(message(cur.s, o)); noteSent(); },
    reopen: m => { close(); n = m || n; cur = transport(true, n); }, close };
}

/** Wartende Mails aus der Warteschlange (Tresor entsperrt / Zeit abgelaufen) abarbeiten */
let flushing = false;
async function flushQueue() {
  if (flushing) return 0; flushing = true;
  try {
    const vault = require('./vault');
    return await vault.flushMail(async (o, row) => {
      const wait = hourWait();
      if (wait > 0) return { retry: { ms: wait, error: 'Stundengrenze erreicht', keep: true } };
      const { s, t } = transport(false);
      try { await t.sendMail(message(s, o)); noteSent(); }
      catch (e) { if (temporary(e)) return { retry: { ms: backoffMs(row.tries || 0), error: shortErr(e) } }; throw e; }
    }, { giveUpMs: GIVE_UP_MS });
  } finally { flushing = false; }
}
setInterval(() => { flushQueue().catch(e => console.error('E-Mail-Warteschlange:', e.message)); }, Number(process.env.CW_MAIL_TICK) || 60000).unref();

module.exports = { config, publicConfig, ready, save, send, session, validMails, mailOk, temporary, limitHit, backoffMs, hourWait, flushQueue, GIVE_UP_MS };
