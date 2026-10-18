'use strict';
/* Zentraler E-Mail-Versand: ein Postfach für alle Module (Bestellung, Zeiterfassung, Erweiterungen).
   Eingetragen unter Einstellungen → E-Mail-Versand. Umgebungsvariablen SMTP_* nur als Rückfall. */
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

/** send({ to, cc, replyTo, subject, text, attachments }) */
async function send({ to, cc, replyTo, subject, text, attachments }) {
  const s = config();
  if (!s.host || !s.from) throw new Error('Kein Postfach eingerichtet (Einstellungen → E-Mail-Versand).');
  if (!mailOk(to)) throw new Error('Keine gültige Empfänger-Adresse.');
  if (cc && !mailOk(cc)) throw new Error('Ungültige Adresse bei „Kopie an“.');
  const nodemailer = require('nodemailer');
  // 465 = verschlüsselt von Anfang an, 587 = Verschlüsselung (STARTTLS) ist Pflicht – sonst könnte jemand sie unterdrücken und das Passwort mitlesen
  const t = nodemailer.createTransport({ host: s.host, port: s.port, secure: s.port === 465, requireTLS: s.port === 587, auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 30000 });
  // in der Sprache der Anfrage bzw. der Vereinssprache (Hintergrundaufgaben)
  const i18n = require('./i18n');
  subject = i18n.tr(String(subject || '')); text = i18n.tr(String(text || ''));
  await t.sendMail({ from: s.from, to: validMails(to).join(', '), cc: cc ? validMails(cc).join(', ') : undefined, replyTo: replyTo || undefined, subject, text, attachments });
}

module.exports = { config, publicConfig, ready, save, send, validMails, mailOk };
