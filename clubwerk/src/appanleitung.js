'use strict';
/**
 * Anleitung „Mitglieder-App einrichten“ als PDF (2 Seiten A4), gebaut zur Laufzeit mit pdfkit – Aufbau nach der freigegebenen Vorlage
 * planung/app-anleitung/ (10.11.2026).
 *  - Eingesetzt: Vereinsname, Vereinsfarbe und Logo, die echten Gültigkeiten (E-Mail/Brief, QR-Code), im WLAN-Tipp nur aktive Bereiche, die
 *    nur im Vereins-WLAN gehen (ohne solche entfällt der Tipp), Push-Tipp nur mit freigegebenen Benachrichtigungen, SMS-Schritt nur mit SMS-Bestätigung.
 *  - Beschriftungen in „…“ stehen wörtlich so in der App (app/index.html, app.js, install.js) bzw. in der Einladungs-Mail – Testreihe appanl prüft das.
 *  - Englisch über den Katalog (dieselben Übersetzungen wie die App).
 *  - Bilder: clubwerk/anleitungen/app/<sprache>-<bild>.jpg, entstehen beim Paketbau aus der Demo (werkzeuge/anleitungen/app-bilder.js).
 *  - Je Sprache und Stand zwischengespeichert (nicht je Mitglied neu): Schlüssel aus allen eingesetzten Werten.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getSetting } = require('./db');

const DIR = path.join(__dirname, '..', 'anleitungen', 'app');
const PW = 595.28, PH = 841.89, M = 45, W = PW - 2 * M, GAP = 14, PAD = 16;
const INK = '#17201a', MUTED = '#3d4a41', SOFT = '#5b6a5f', LINE = '#d5ddd7', TINT = '#eef2ef';
const SUBJECT = 'Dein Zugang zur Mitglieder-App – bitte am Handy öffnen';   // Betreff der Einladungs-Mail (src/memberapp.js)
const mix = (hex, t) => '#' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('');
const isImg = b => Buffer.isBuffer(b) && b.length > 100 && ((b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0xff && b[1] === 0xd8));

/** Vereinsfarbe und Logo (wie die anderen PDFs) */
function brand() {
  let color = getSetting('club_color', ''); if (!/^#[0-9a-f]{6}$/i.test(color)) color = '#1f6e3d';
  let logo = null; const type = getSetting('club_logo_type');
  try {
    if (type === 'png' || type === 'jpg') logo = Buffer.from(getSetting('club_logo'), 'base64');
    else if (type && getSetting('club_logo_png') && getSetting('club_logo_png_ver') === getSetting('club_logo_ver', 'std')) logo = Buffer.from(getSetting('club_logo_png'), 'base64');
  } catch (e) { logo = null; }
  return { color, soft: mix(color, 0.88), logo: isImg(logo) ? logo : null };
}
/** Was eingesetzt wird – daraus auch der Schlüssel des Zwischenspeichers */
function facts() {
  const invites = require('./invites'), memberapp = require('./memberapp');
  const mods = memberapp.moduleInfo().filter(m => m.on);
  let push = false; try { push = require('./push').events().some(e => e.on); } catch (e) { push = false; }
  let sms = false; try { sms = require('./sms').ready(); } catch (e) { sms = false; }
  return { club: getSetting('club_name', '') || 'Verein', mailDays: invites.mailDays(), qrHours: invites.inviteHours(), areas: mods.filter(m => m.id !== 'nachrichten').map(m => m.label || m.name),   // Nachrichten nennt der Satz selbst
   
    wlan: mods.filter(m => !m.away).map(m => m.label || m.name), push, sms, tablet: getSetting('tablet_enabled', '1') !== '0' };
}

/* ---------- Texte (Deutsch = Schlüssel des Katalogs; **fett**) ---------- */
function texts(f, T) {
  const list = l => (l.length === 1 ? l[0] : T('{0} und {1}', [l.slice(0, -1).join(', '), l[l.length - 1]]));
  const hours = h => (h === 1 ? T('eine Stunde') : h === 24 ? T('einen Tag') : T('{0} Tage', [Math.round(h / 24)]));
  const areas = f.areas.map(a => T(a)).slice(0, 4);
  const wl = f.wlan.map(a => T(a));
  return {
    title: T('Die Mitglieder-App einrichten – in 3 Minuten'),
    lead: T('Mit der App hast du {0} im Blick und bekommst die Nachrichten von {1} direkt aufs Handy. Du brauchst nur dein Handy und die E-Mail „{2}“ – oder den QR-Code vom Vorstand.', [areas.length ? list(areas) : T('alles Wichtige'), f.club, T(SUBJECT)]),
    s1: { t: T('Einladung am Handy öffnen'), p: T('Öffne die E-Mail **auf deinem Handy** und tippe auf **„App jetzt freischalten“** – oder scanne den QR-Code vom Vorstand mit der Kamera. Auf dem iPhone öffnet sich Safari, auf Android Chrome.'),
      n: T('Am PC geht es nicht. Die Einladung ist nur für dich – bitte nicht weiterleiten. Öffnet sich die Seite in einer anderen App (z. B. der Mail-App), tippe auf „…“ und „In Safari öffnen“ bzw. „Im Browser öffnen“.') },
    s2: { t: T('Persönliche PIN festlegen'), p: (f.sms ? T('Schaltest du von unterwegs frei, kommt zuerst ein Code per SMS – gib ihn ein, wenn die App danach fragt.') + ' ' : '') + T('Wähle eine PIN aus **4 bis 6 Ziffern**, gib sie zweimal ein und tippe auf **„Freischalten“**.') + (f.tablet ? ' ' + T('Merk dir die PIN – sie gilt auch am Tablet im Vereinsheim.') : ' ' + T('Merk dir die PIN – du brauchst sie bei jedem Öffnen.')),
      n: T('Hast du schon eine PIN, gibst du einfach die bekannte ein.') },
    ios3: { t: T('Auf den Home-Bildschirm'), li: [T('Tippe auf **„Code kopieren“** – du brauchst ihn in Schritt 4.'), T('Tippe auf das **Teilen-Symbol** (oben, unten oder im Menü „…“).'), T('**„Zum Home-Bildschirm“**, dann **„Hinzufügen“**.')] },
    and3: { t: T('App installieren'), li: [T('In „Für mich“ erscheint die Karte **„App installieren“**.'), T('Tippe auf **„App installieren“** und im Chrome-Fenster auf **„Installieren“**.'), T('App vom Startbildschirm öffnen – **fertig**, kein Code nötig.')] },
    ios4: { t: T('App öffnen, Code einfügen, PIN eingeben'), p: T('Öffne die neue App **vom Home-Bildschirm** (nicht mehr Safari). Tippe auf **„Übernahme-Code eingeben“**, dann auf **„Einfügen“**, gib deine **PIN** ein und tippe auf **„Übernehmen“**.') },
    andX: { t: T('Kein Knopf „App installieren“ zu sehen?'), p: T('Dann geht es über das Browser-Menü: Tippe auf die drei Punkte oben rechts, wähle **„App installieren“** oder **„Zum Startbildschirm hinzufügen“** und bestätige. Die App zeigt dir diese Schritte dann auch selbst an.') },
    tips: { t: T('Fertig – noch ein paar Tipps'), li: [
      ...(f.push ? [T('**Benachrichtigungen einschalten:** Tippe auf der Startseite „Für mich“ auf **„Einschalten“**, damit du nichts verpasst.')] : []),
      T('**Einladung rechtzeitig nutzen:** Der Link in der E-Mail gilt {0} Tage, ein QR-Code vom Vorstand {1}. Abgelaufen? Einfach beim Vorstand neu holen.', [f.mailDays, hours(f.qrHours)]),
      ...(wl.length ? [T(wl.length === 1 ? '**Manches nur im Vereinsheim:** {0} funktioniert nur im WLAN des Vereins.' : '**Manches nur im Vereinsheim:** {0} funktionieren nur im WLAN des Vereins.', [list(wl)])] : []),
      T('**Fragen oder Probleme?** Melde dich beim Vorstand – oder antworte einfach auf die Einladungs-E-Mail.')] },
    page: n => T('Seite {0} von {1}', [n, 2]),
  };
}

/* ---------- Zeichnen ---------- */
/** Anleitung zeichnen – eigenes Dokument, oder (o.doc) angehängt an ein vorhandenes; o.letter: davor eine Seite Einladungsbrief mit QR-Code */
function make(lang, f, o = {}) {
  const PDFDocument = require('pdfkit');
  const i18n = require('./i18n'), T = (s, v) => { const t = i18n.tr(s, lang); return (v || []).reduce((a, x, i) => a.split(`{${i}}`).join(String(x)), t); };
  const tx = texts(f, T), b = brand();
  const doc = o.doc || new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false, info: { Title: tx.title, Author: f.club } });
  const font = n => path.join(DIR, 'schriften', `jakarta-${n}.ttf`);
  doc.registerFont('R', font('latin-400')); doc.registerFont('B', font('latin-700')); doc.registerFont('ER', font('latin-ext-400')); doc.registerFont('EB', font('latin-ext-700'));
  /** Schrift mit allen Zeichen des Textes (Vereinsnamen mit ő, ł …): Latein, sonst Latein-Erweiterung, sonst Helvetica */
  const fontFor = (s, bold) => {
    const has = n => { doc.font(n); const fk = doc._font && doc._font.font; return !fk || [...String(s)].every(ch => /\s/.test(ch) || fk.hasGlyphForCodePoint(ch.codePointAt(0))); };
    return has(bold ? 'B' : 'R') ? (bold ? 'B' : 'R') : has(bold ? 'EB' : 'ER') ? (bold ? 'EB' : 'ER') : (bold ? 'Helvetica-Bold' : 'Helvetica');
  };
  const img = name => { const p = path.join(DIR, `${lang}-${name}.jpg`); return fs.existsSync(p) ? p : path.join(DIR, `de-${name}.jpg`); };
  const imgSize = p => { try { const o = doc.openImage(p); return [o.width, o.height]; } catch (e) { return null; } };
  /** Absatz mit **fett**: gibt die Unterkante zurück */
  const rich = (s, x, y, w, size, color, o = {}) => {
    const parts = String(s).split('**').filter((p, i, a) => p || i === 0 || i === a.length - 1), lg = o.gap == null ? 2.2 : o.gap;
    doc.fontSize(size).fillColor(color);
    if (parts.length === 1) { doc.font(fontFor(parts[0], false)).text(parts[0], x, y, { width: w, lineGap: lg }); return doc.y; }
    // erster Teil mit Lage und Breite, die übrigen fließen weiter (pdfkit „continued“); fett = ungerade Teile des Originals
    const raw = String(s).split('**');
    raw.forEach((p, i) => { if (!p) return; const last = raw.slice(i + 1).every(q => !q); doc.font(fontFor(p, i % 2 === 1)); if (i === raw.findIndex(q => q)) doc.text(p, x, y, { width: w, lineGap: lg, continued: !last }); else doc.text(p, { continued: !last, lineGap: lg }); });
    return doc.y;
  };
  const bullets = (items, x, y, w, size) => {
    for (const it of items) {
      doc.circle(x + 3, y + size * 0.62, 1.6).fill(INK);
      y = rich(it, x + 12, y, w - 12, size, INK) + 4;
    }
    return y;
  };
  const badge = (no, x, y) => {
    doc.circle(x + 11, y + 11, 11).fill(b.color);
    if (no === '✓') doc.save().lineWidth(2).strokeColor('#ffffff').moveTo(x + 6.5, y + 11.5).lineTo(x + 9.8, y + 14.6).lineTo(x + 15.8, y + 7.8).stroke().restore();
    else doc.font('B').fontSize(11).fillColor('#ffffff').text(no, x, y + 4.6, { width: 22, align: 'center', lineBreak: false });
  };
  const os = (label, x, y) => {
    doc.font('B').fontSize(7.5); const w = doc.widthOfString(label.toUpperCase(), { characterSpacing: 0.6 }) + 12;
    doc.roundedRect(x, y, w, 15, 4).fill(b.soft);
    doc.fillColor(b.color).text(label.toUpperCase(), x + 6, y + 3.8, { characterSpacing: 0.6, lineBreak: false });
    return y + 21;
  };
  const head = (no, title, x, y, w) => {
    if (no) badge(no, x, y);
    const tx0 = no ? x + 30 : x;
    doc.font(fontFor(title, true)).fontSize(12.5).fillColor(INK);
    const h = doc.heightOfString(title, { width: w - (tx0 - x) });
    doc.text(title, tx0, no ? y + 11 - Math.min(h, 16) / 2 - 1 : y, { width: w - (tx0 - x) });
    return Math.max(no ? y + 22 : y, doc.y) + 8;
  };
  const frame = (x, y, w, h) => doc.roundedRect(x, y, w, h, 11).lineWidth(0.8).strokeColor(LINE).stroke();
  /** Bild in einen Kasten (Breite w, Höhe h) einpassen, unten ausgerichtet, waagerecht mittig; mit feinem Rand */
  /** Bildfläche: getönter Kasten in fester Größe (nebeneinanderstehende sind gleich groß), Bild darin mittig eingepasst */
  const panel = (name, x, y, w, h) => {
    doc.roundedRect(x, y, w, h, 9).fill(TINT);
    picture(name, x + 10, y + 10, w - 20, h - 20, true);
  };
  const picture = (name, x, y, w, h, mid) => {
    const p = img(name), s = imgSize(p); if (!s) return;
    const k = Math.min(w / s[0], h / s[1]), iw = s[0] * k, ih = s[1] * k, ix = x + (w - iw) / 2, iy = mid ? y + (h - ih) / 2 : y + h - ih;
    doc.save().roundedRect(ix, iy, iw, ih, 7).clip().image(p, ix, iy, { width: iw, height: ih }).restore();
    doc.roundedRect(ix, iy, iw, ih, 7).lineWidth(0.6).strokeColor(LINE).stroke();
  };
  const footer = n => {
    doc.font(fontFor(f.club)).fontSize(8).fillColor(SOFT).text(`${f.club} · ${tx.page(n)}`, M, PH - 30, { width: W, align: 'center', lineBreak: false });
  };
  const over = [];   // Überlauf (Test): Unterkante je Seite
  let y;
  /* ---- Einladungsbrief (wie „Einladungsbrief drucken“ in der Verwaltung, mit QR-Code) ---- */
  if (o.letter) {
    const l = o.letter;
    doc.addPage({ size: 'A4', margin: 0 });
    y = M + 10;
    if (b.logo) { try { const im = doc.openImage(b.logo); const k = Math.min(160 / im.width, 60 / im.height); doc.image(im, (PW - im.width * k) / 2, y, { width: im.width * k, height: im.height * k }); y += im.height * k + 16; } catch (e) { /* ohne Logo */ } }
    doc.font(fontFor(f.club, true)).fontSize(22).fillColor(INK).text(f.club, M, y, { width: W, align: 'center' }); y = doc.y + 8;
    doc.roundedRect(PW / 2 - 31, y, 62, 3.5, 1.75).fill(b.color); y += 22;
    const who = T('Mitglieder-App für {0}', ['**' + l.name + '**']);
    doc.fontSize(14); const tw = doc.font('B').widthOfString(who.replace(/\*\*/g, ''));
    y = rich(who, Math.max(M, (PW - tw) / 2), y, W, 14, INK) + 18;
    const Q = 200; doc.image(l.qr, (PW - Q) / 2, y, { width: Q, height: Q }); y += Q + 26;
    l.steps.forEach((st, i) => { badge(String(i + 1), M + 40, y - 3); y = rich(T(st), M + 76, y, W - 116, 11, INK) + 10; });
    y += 10;
    rich(T('Gilt einmal und bis {0} Uhr. Persönlich – bitte nicht weitergeben.', [l.until]), M + 40, y, W - 80, 10, MUTED);
    doc.font(fontFor(f.club)).fontSize(8).fillColor(SOFT).text(T('Die Anleitung mit Bildern liegt bei.'), M, PH - 30, { width: W, align: 'center', lineBreak: false });
  }
  /* ---- Seite 1 ---- */
  doc.addPage({ size: 'A4', margin: 0 });
  y = M - 8;
  if (b.logo) { try { const o = doc.openImage(b.logo); const k = Math.min(110 / o.width, 30 / o.height); doc.image(o, M, y, { width: o.width * k, height: o.height * k }); doc.font(fontFor(f.club, true)).fontSize(10).fillColor(SOFT).text(f.club, M + o.width * k + 10, y + 15 - 6, { width: W - o.width * k - 10, lineBreak: false, ellipsis: true }); y += 30 + 14; } catch (e) { /* ohne Logo */ } }
  if (!b.logo) { doc.font(fontFor(f.club, true)).fontSize(10).fillColor(SOFT).text(f.club, M, y, { width: W, lineBreak: false, ellipsis: true }); y += 22; }
  doc.font('B').fontSize(21).fillColor(INK).text(tx.title, M, y, { width: W }); y = doc.y + 6;
  y = rich(tx.lead, M, y, W, 10, MUTED) + 10;
  doc.roundedRect(M, y, 62, 3.5, 1.75).fill(b.color); y += 16;
  // 1: Einladung
  let y0 = y; y = head('1', tx.s1.t, M + PAD, y + PAD, W - 2 * PAD);
  y = rich(tx.s1.p, M + PAD, y, W - 2 * PAD, 10, INK) + 6;
  y = rich(tx.s1.n, M + PAD, y, W - 2 * PAD, 8.8, MUTED) + PAD;
  frame(M, y0, W, y - y0); y += GAP;
  // 2: PIN (Bild rechts)
  y0 = y; const PICW = 150, PICH = 120;
  let yt = head('2', tx.s2.t, M + PAD, y + PAD, W - 3 * PAD - PICW);
  yt = rich(tx.s2.p, M + PAD, yt, W - 3 * PAD - PICW, 10, INK) + 6;
  yt = rich(tx.s2.n, M + PAD, yt, W - 3 * PAD - PICW, 8.8, MUTED);
  let h2 = Math.max(yt - y0 + PAD, PICH + 2 * PAD);
  picture('pin', M + W - PAD - PICW, y0 + (h2 - PICH) / 2, PICW, PICH, true);
  frame(M, y0, W, h2); y = y0 + h2 + GAP;
  // 3: iPhone | Android nebeneinander, Bilder unten auf gleicher Höhe
  const CW = (W - GAP) / 2, xs = [M, M + CW + GAP];
  y0 = y;
  const tops = [['iPhone', tx.ios3, 'ios-install'], ['Android', tx.and3, 'android-install']].map(([o, s], i) => {
    let yy = os(o, xs[i] + PAD, y0 + PAD); yy = head('3', s.t, xs[i] + PAD, yy, CW - 2 * PAD); return bullets(s.li, xs[i] + PAD, yy, CW - 2 * PAD, 9.6);
  });
  const yi = Math.max(...tops) + 6, IMG3 = Math.max(110, PH - 48 - PAD - yi);   // Rest der Seite, beide Flächen gleich groß
  panel('ios-install', xs[0] + PAD, yi, CW - 2 * PAD, IMG3); panel('android-install', xs[1] + PAD, yi, CW - 2 * PAD, IMG3);
  const h3 = yi + IMG3 + PAD - y0; frame(xs[0], y0, CW, h3); frame(xs[1], y0, CW, h3);
  over.push(y0 + h3); footer(1);
  /* ---- Seite 2 ---- */
  doc.addPage({ size: 'A4', margin: 0 });
  y = M;
  // 4: iPhone – App öffnen, Code, PIN (zwei Bilder nebeneinander)
  y0 = y; let yy = os('iPhone', M + PAD, y + PAD); yy = head('4', tx.ios4.t, M + PAD, yy, W - 2 * PAD); yy = rich(tx.ios4.p, M + PAD, yy, W - 2 * PAD, 10, INK) + 10;
  const IMG4 = 210, HW = (W - 2 * PAD - GAP) / 2;
  panel('ios-start', M + PAD, yy, HW, IMG4); panel('ios-code', M + PAD + HW + GAP, yy, HW, IMG4);
  y = yy + IMG4 + PAD; frame(M, y0, W, y - y0); y += GAP;
  // Android ohne Knopf (Bild rechts)
  y0 = y; const PW2 = 160, PH2 = 155;
  yt = os('Android', M + PAD, y + PAD); yt = head(null, tx.andX.t, M + PAD, yt, W - 3 * PAD - PW2); yt = rich(tx.andX.p, M + PAD, yt, W - 3 * PAD - PW2, 10, INK);
  const hA = Math.max(yt - y0 + PAD, PH2 + 2 * PAD); picture('android-menu', M + W - PAD - PW2, y0 + (hA - PH2) / 2, PW2, PH2, true);
  frame(M, y0, W, hA); y = y0 + hA + GAP;
  // Tipps (Bild der Push-Karte rechts, nur mit Push)
  y0 = y; const PW3 = f.push ? 170 : 0, PH3 = 95;
  yt = head('✓', tx.tips.t, M + PAD, y + PAD, W - 2 * PAD - (PW3 ? PAD + PW3 : 0));
  yt = bullets(tx.tips.li, M + PAD, yt + 2, W - 2 * PAD - (PW3 ? PAD + PW3 : 0), 9.6);
  const hT = Math.max(yt - y0 + PAD - 4, PW3 ? PH3 + 2 * PAD : 0);
  if (PW3) picture('push', M + W - PAD - PW3, y0 + (hT - PH3) / 2, PW3, PH3, true);
  frame(M, y0, W, hT); over.push(y0 + hT); footer(2);
  if (!o.doc) doc.end();
  return { doc, over, texts: tx };
}

const cache = new Map();
/** PDF (Buffer) für die Sprache – zwischengespeichert je Stand */
async function pdf(lang = 'de') {
  lang = lang === 'en' ? 'en' : 'de';
  const f = facts(), b = brand();
  const imgs = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(x => /\.jpg$/.test(x)).map(x => x + fs.statSync(path.join(DIR, x)).size).join() : '';
  const key = crypto.createHash('sha256').update(JSON.stringify([lang, f, b.color, b.logo ? b.logo.length + b.logo.subarray(0, 64).toString('hex') : '', imgs])).digest('hex');
  const hit = cache.get(lang); if (hit && hit.key === key) return hit.buf;
  const { doc } = make(lang, f);
  const chunks = []; doc.on('data', c => chunks.push(c));
  const buf = await new Promise((res, rej) => { doc.on('end', () => res(Buffer.concat(chunks))); doc.on('error', rej); });
  cache.set(lang, { key, buf });
  return buf;
}
/** Einladungsbriefe mit QR-Code, hinter jedem Brief die Anleitung (Sammel- und Einzelbrief mit „Anleitung mitdrucken“) → Buffer
 *  list: [{ name, url, expiresAt, steps }] */
async function letters(list, lang = 'de') {
  lang = lang === 'en' ? 'en' : 'de';
  const PDFDocument = require('pdfkit'), QR = require('qrcode'), f = facts();
  const tz = process.env.TZ || 'Europe/Berlin', loc = lang === 'en' ? 'en-GB' : 'de-DE';
  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false, info: { Title: require('./i18n').tr('Einladungsbriefe Mitglieder-App', lang), Author: f.club } });
  const chunks = []; doc.on('data', c => chunks.push(c));
  const done = new Promise((res, rej) => { doc.on('end', () => res(Buffer.concat(chunks))); doc.on('error', rej); });
  for (const l of list) {
    const qr = await QR.toBuffer(String(l.url).slice(0, 600), { type: 'png', margin: 1, errorCorrectionLevel: 'M', width: 600 });
    make(lang, f, { doc, letter: { name: l.name, qr, steps: l.steps, until: new Date(l.expiresAt).toLocaleString(loc, { dateStyle: 'short', timeStyle: 'short', timeZone: tz }) } });
  }
  doc.end();
  return done;
}
/** Für Tests: Texte und Unterkanten ohne PDF */
function preview(lang = 'de') { const r = make(lang === 'en' ? 'en' : 'de', facts()); return { texts: r.texts, over: r.over, page: PH - 40 }; }
const FILE = lang => (lang === 'en' ? 'Member-app-setup.pdf' : 'Mitglieder-App-einrichten.pdf');
/** Sprache für Mails und Briefe: die Vereinssprache bzw. die der Anfrage */
const langNow = () => { try { return require('./i18n').current() === 'en' ? 'en' : 'de'; } catch (e) { return 'de'; } };
module.exports = { pdf, letters, preview, facts, FILE, langNow, SUBJECT };
