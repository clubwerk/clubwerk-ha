'use strict';
/* Zentraler E-Mail-Versand: ein Postfach für alle Module (Bestellung, Zeiterfassung, Erweiterungen).
   Eingetragen unter Einstellungen → Postfach. Umgebungsvariablen SMTP_* nur als Rückfall. */
const { getSetting, setSetting } = require('./db');

const K = k => 'mail_smtp_' + k;
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
  return { host: g('host', 'SMTP_HOST'), port: Number(g('port', 'SMTP_PORT')) || 587, user, pass: g('pass', 'SMTP_PASS'), from: g('from', 'SMTP_FROM') || user };
}
const ready = () => { const s = config(); return Boolean(s.host && s.from); };
const validMails = v => String(v || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
const mailOk = v => validMails(v).length > 0 && validMails(v).every(m => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m));
/** Für die Verwaltung: ohne Passwort */
const publicConfig = () => { const s = config(); return { host: s.host, port: s.port, user: s.user, from: s.from, hasPass: Boolean(s.pass), ready: ready() }; };

function save(b) {
  const host = String(b.host || '').trim(), from = String(b.from || '').trim(), user = String(b.user || '').trim();
  const port = parseInt(b.port, 10) || 587;
  if (host && !/^[a-z0-9.-]+$/i.test(host)) throw new Error('Bitte nur den Servernamen eintragen, z. B. mail.gmx.net.');
  if (port < 1 || port > 65535) throw new Error('Ungültiger Port.');
  if (from && !mailOk(from)) throw new Error('Absender bitte als E-Mail-Adresse.');
  for (const [k, v] of [['host', host], ['port', String(port)], ['user', user.slice(0, 200)], ['from', from]]) setSetting(K(k), v);
  if (b.pass !== undefined && b.pass !== '') setSetting(K('pass'), String(b.pass).slice(0, 300));
  if (b.clearPass) setSetting(K('pass'), '');
  return `${host}:${port}${user ? ' · ' + user : ''}`;
}

function transport(pool) {
  const s = config();
  if (!s.host || !s.from) throw new Error('Kein Postfach eingerichtet (Einstellungen → Postfach).');
  const nodemailer = require('nodemailer');
  // 465 = verschlüsselt von Anfang an, 587 = Verschlüsselung (STARTTLS) ist Pflicht – sonst könnte jemand sie unterdrücken und das Passwort mitlesen
  return { s, t: nodemailer.createTransport({ host: s.host, port: s.port, secure: s.port === 465, requireTLS: s.port === 587, auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 30000, ...(pool ? { pool: true, maxConnections: 1, maxMessages: 50 } : {}) }) };
}
/** Absender: immer das Vereinspostfach (sonst landen Mails im Spam), optional mit Anzeigenamen */
const fromOf = (s, fromName) => (fromName ? { name: String(fromName).replace(/[\r\n"<>]/g, ' ').slice(0, 80), address: s.from } : s.from);
function message(s, { to, cc, bcc, replyTo, subject, text, html, attachments, fromName, raw, card, plainOnly }) {
  if (!mailOk(to)) throw new Error('Keine gültige Empfänger-Adresse.');
  if (cc && !mailOk(cc)) throw new Error('Ungültige Adresse bei „Kopie an“.');
  if (replyTo && !mailOk(replyTo)) throw new Error('Ungültige Antwortadresse.');
  if (!raw) {   // Systemmails in der Sprache der Anfrage bzw. der Vereinssprache – selbst geschriebene Mails bleiben, wie sie sind
    const i18n = require('./i18n');
    subject = i18n.tr(String(subject || '')); text = i18n.tr(String(text || ''));
    if (card) card = { ...card, heading: card.heading ? i18n.tr(String(card.heading)) : card.heading, title: card.title ? i18n.tr(String(card.title)) : card.title, before: card.before != null ? i18n.tr(String(card.before)) : card.before, after: card.after != null ? i18n.tr(String(card.after)) : card.after,
      rows: (card.rows || []).map(([k, v]) => [i18n.tr(String(k)), v]), button: card.button && card.button !== true ? { ...card.button, label: i18n.tr(String(card.button.label || '')) } : card.button };
  }
  // Gestaltete HTML-Fassung (Logo, Vereinsfarbe, Infokarte) – die Textfassung bleibt für Mailprogramme ohne HTML
  if (!html && !plainOnly) {
    try { const r = require('./mailtpl').render({ subject, text, card }); html = r.html; attachments = [...(attachments || []), ...r.attachments]; } catch (e) { console.error('E-Mail-Layout:', e.message); }
  }
  return { from: fromOf(s, fromName), to: validMails(to).join(', '), cc: cc ? validMails(cc).join(', ') : undefined, bcc: bcc ? validMails(bcc).join(', ') : undefined,
    replyTo: replyTo || undefined, subject, text, html: html || undefined, attachments };
}

/** send({ to, cc, replyTo, subject, text, html, attachments, fromName, raw, card }) – card = { before, title, rows: [[k, v]], after, button } für die Infokarte im HTML */
async function send(o) {
  const { s, t } = transport(false);
  await t.sendMail(message(s, o));
}
/** Viele Mails nacheinander über eine Verbindung: const x = session(); await x.send({…}); x.close() */
function session() {
  const { s, t } = transport(true);
  return { send: o => t.sendMail(message(s, o)), close: () => { try { t.close(); } catch (e) { /* zu */ } } };
}

module.exports = { config, publicConfig, ready, save, send, session, validMails, mailOk };
