'use strict';
/* Gestaltung der System-E-Mails: ein ruhiges HTML-Layout mit Vereinslogo und Vereinsfarbe.
   Jede Mail behält ihre Textfassung (für Mailprogramme ohne HTML); das HTML wird daraus erzeugt.
   Optional strukturiert: card = { title, rows: [[Bezeichnung, Wert], …], button: { label, url } }.
   Nur Tabellen und Inline-Stile – so sieht es auch in Outlook, Gmail und Apple Mail gleich aus. */
const { getSetting } = require('./db');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = () => { const c = getSetting('club_color', process.env.CLUB_COLOR || '#1f6b3a'); return /^#[0-9a-f]{6}$/i.test(c) ? c : '#1f6b3a'; };
function tint(hex, t) {   // Richtung Weiß mischen (0 = Farbe, 1 = weiß)
  const a = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).map(v => Math.round(v + (255 - v) * t));
  return '#' + a.map(v => v.toString(16).padStart(2, '0')).join('');
}
/** Logo als eingebettetes Bild (PNG/JPG – SVG zeigen viele Mailprogramme nicht) */
function logo() {
  try {
    if (getSetting('club_logo_png', '') && getSetting('club_logo_png_ver', '') === getSetting('club_logo_ver', 'std')) return { content: Buffer.from(getSetting('club_logo_png', ''), 'base64'), contentType: 'image/png', ext: 'png' };
    const t = getSetting('club_logo_type', '');
    if (getSetting('club_logo', '') && /png|jpe?g/i.test(t)) return { content: Buffer.from(getSetting('club_logo', ''), 'base64'), contentType: /png/i.test(t) ? 'image/png' : 'image/jpeg', ext: /png/i.test(t) ? 'png' : 'jpg' };
  } catch (e) { /* ohne Logo */ }
  return null;
}
/** Adresse der Mitglieder-App für „In der App öffnen“ (öffentlich, sonst im WLAN) */
function appUrl() {
  const pub = getSetting('ext_tunnel', '0') === '1' ? getSetting('ext_tunnel_url', '') : '';
  return String(pub || getSetting('app_url', '') || '').replace(/\/+$/, '');
}

/** Klartext → Absätze/Listen; „Hallo …,“ und der Gruß am Ende werden erkannt */
function body(text) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const P = 'margin:0 0 14px;font-size:15px;line-height:1.55;color:#1f2723;';
  return blocks.map((b, i) => {
    const lines = b.split('\n');
    if (lines.every(l => /^\s*[-•·]\s+/.test(l))) return `<ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.55;color:#1f2723;">${lines.map(l => `<li style="margin:0 0 4px;">${esc(l.replace(/^\s*[-•·]\s+/, ''))}</li>`).join('')}</ul>`;
    const last = i === blocks.length - 1 && /^(viele|beste|liebe|freundliche|sportliche|herzliche)?\s*grü(ß|ss)e/i.test(lines[0]);
    if (last) return `<!--SIG--><p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:#5b6660;">${lines.map(esc).join('<br>')}</p>`;
    return `<p style="${P}">${lines.map(esc).join('<br>')}</p>`;
  }).join('');
}

/**
 * render({ subject, text, card }) → { html, attachments }
 * card: { title, rows: [[k, v]], button: { label, url } | true (= Mitglieder-App) }
 */
function render({ subject, text, card, preheader }) {
  const c = color(), soft = tint(c, 0.9), line = tint(c, 0.8), club = getSetting('club_name', 'Verein');
  const lg = logo();
  const att = lg ? [{ filename: `logo.${lg.ext}`, content: lg.content, contentType: lg.contentType, cid: 'vereinslogo@clubwerk', contentDisposition: 'inline' }] : [];
  const initials = club.split(/\s+/).filter(w => /^[A-ZÄÖÜ]/.test(w)).map(w => w[0]).slice(0, 2).join('') || club.slice(0, 2).toUpperCase();
  const head = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:12px;">${lg ? `<img src="cid:vereinslogo@clubwerk" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border-radius:10px;border:0;">`
        : `<div style="width:40px;height:40px;border-radius:10px;background:${c};color:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:40px;text-align:center;">${esc(initials)}</div>`}</td>
      <td style="vertical-align:middle;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;line-height:1.3;color:#1f2723;">${esc(club)}</td></tr></table>`;
  const heading = (card && card.heading) || String(subject || '').replace(new RegExp(`\\s+[–-]\\s+${club.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
  if (card && card.title && card.title === heading) card = { ...card, title: '' };
  let cardHtml = '';
  if (card && (card.title || (card.rows && card.rows.length) || card.calendar)) {
    const rows = (card.rows || []).filter(r => r && r[1] != null && r[1] !== '');
    cardHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;background:${soft};border:1px solid ${line};border-radius:12px;">
      <tr><td style="padding:16px 18px;">
        ${card.title ? `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:700;line-height:1.35;color:#1f2723;margin:0 0 ${rows.length ? 10 : 0}px;">${esc(card.title)}</div>` : ''}
        ${rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.map(([k, v]) => `<tr>
          <td style="padding:4px 12px 4px 0;width:34%;vertical-align:top;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13.5px;font-weight:400;line-height:1.45;color:#5b6660;">${esc(k)}</td>
          <td style="padding:4px 0;vertical-align:top;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14.5px;font-weight:600;line-height:1.45;color:#1f2723;">${esc(v)}</td></tr>`).join('')}</table>` : ''}
        ${card.calendar && /^https:\/\//i.test(String(card.calendar.url || '')) ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 2px;"><tr>
          <td style="border-radius:10px;background:${c};"><a href="${esc(card.calendar.url)}" style="display:inline-block;padding:11px 18px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14.5px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(card.calendar.label || 'Zum Kalender hinzufügen')}</a></td></tr></table>` : ''}
      </td></tr></table>`;
  }
  const btn = card && card.button && card.button !== true ? card.button : null;   // eigener Knopf je Mail (kein pauschales „In der App öffnen“ mehr)
  const btnHtml = btn && /^https?:\/\//i.test(String(btn.url || '')) ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 6px;"><tr>
      <td style="border-radius:10px;background:${c};"><a href="${esc(btn.url)}" style="display:inline-block;padding:12px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(btn.label || 'Öffnen')}</a></td></tr></table>` : '';
  const pre = preheader || (card && card.title) || '';
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f4f3;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(pre)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f4f3;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e8e5;">
    <tr><td style="height:5px;background:${c};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:22px 26px 6px;">${head}</td></tr>
    <tr><td style="padding:14px 26px 22px;"><div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;line-height:1.3;color:#1f2723;margin:0 0 14px;">${esc(heading)}</div>
      <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${(() => { const main = card && (card.before != null || card.after != null) ? body(card.before) + cardHtml + body(card.after) : cardHtml + body(text);
        return main.includes('<!--SIG-->') ? main.replace('<!--SIG-->', btnHtml) : main + btnHtml; })()}</div></td></tr>
    <tr><td style="padding:18px 26px 22px;border-top:1px solid #edf1ef;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:400;line-height:1.5;color:#8a948f;">
      Diese Nachricht wurde automatisch von ${esc(club)} verschickt.</td></tr>
  </table>
</td></tr></table></body></html>`;
  return { html, attachments: att };
}

module.exports = { render, appUrl, esc };
