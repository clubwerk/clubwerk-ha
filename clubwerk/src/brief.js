'use strict';
/**
 * Gemeinsame Bausteine für Briefe und PDFs (Rechnung, Mahnung, Quittung, Schlüsselprotokoll …):
 * Raster (A4, 20 mm Rand), Kopf mit Vereinslogo und Anschrift, Fußzeile, Falzmarken, Kästchen, Vereinsfarbe und Logo.
 * Die Module bauen darauf ihre eigenen Seiten; Aussehen und Maße sind für alle gleich.
 */
const PDFDocument = require('pdfkit');

/* ---------- Raster & Farben ---------- */
const PW = 595.28, PH = 841.89;
const L = 56.7, R = PW - 56.7, W = R - L;          // 20 mm links und rechts
const TOP = 40, BOTTOM = PH - 64, FOOT = PH - 38;  // Inhalt endet über der Fußzeile
const INK = '#1b1f24', MUTED = '#6b7280', SOFT = '#9aa1ab', LINE = '#d5d9df', FAINT = '#f3f4f6';
const DEFAULT_COLOR = '#1f6b3a';

const { euroText: euro, imageType } = require('./util');   // Cent → „1.234,56 €“ (im PDF immer deutsches Format)
const fmtIban = v => String(v || '').replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
const mix = (hex, t) => '#' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('');
const imgFromData = d => { const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(d || '')); return m ? Buffer.from(m[1], 'base64') : null; };
const isImg = b => Buffer.isBuffer(b) && b.length > 100 && ['png', 'jpg'].includes(imageType(b));

/** Dokument fertig schreiben lassen: Promise mit dem ganzen PDF (vor doc.end() aufrufen) */
function collect(doc) {
  return new Promise((resolve, reject) => { const ch = []; doc.on('data', c => ch.push(c)); doc.on('end', () => resolve(Buffer.concat(ch))); doc.on('error', reject); });
}

/* ---------- Vereinslogo & Vereinsfarbe (aus den Einstellungen des Kerns) ----------
   PNG/JPG werden direkt eingebettet. Ein SVG- oder WebP-Logo kann PDFKit nicht zeichnen – dafür nimmt Clubwerk das
   PNG-App-Symbol, das die Verwaltung aus dem Logo erzeugt (weißer Grund, quadratisch). Fehlt beides: Kopf ohne Logo. */
let core = null;
try { core = require('./db'); } catch (e) { core = null; }
function brand(club = {}) {
  const g = (k, d = '') => { try { return core ? core.getSetting(k, d) : d; } catch (e) { return d; } };
  let color = club.color || g('club_color', '');
  if (!/^#[0-9a-f]{6}$/i.test(color)) color = DEFAULT_COLOR;
  let logo = isImg(club.logo) ? club.logo : null;
  if (!logo && club.logo !== false) {
    const type = g('club_logo_type');
    try {
      if (type === 'png' || type === 'jpg') logo = Buffer.from(g('club_logo'), 'base64');
      else if (type && g('club_logo_png') && g('club_logo_png_ver') === g('club_logo_ver', 'std')) logo = Buffer.from(g('club_logo_png'), 'base64');   // SVG-Logo: vom Browser gezeichnetes PNG
    } catch (e) { logo = null; }
    if (!isImg(logo)) logo = null;
  }
  return { color, soft: mix(color, 0.9), logo };
}

/* ---------- Seiten ---------- */
function newDoc(club, title, opts = {}) {
  return new PDFDocument({ size: 'A4', margins: { top: TOP, bottom: 20, left: L, right: PW - R }, bufferPages: true, autoFirstPage: opts.autoFirstPage !== false, info: { Title: title, Author: club.name || '' } });
}
/** Kopf: Logo + Vereinsname links, Anschrift rechtsbündig, darunter eine feine Linie in Vereinsfarbe → y unter der Linie */
function head(doc, club, b) {
  const H = 46, y0 = TOP;
  let x = L;
  if (b.logo) {
    try {
      const img = doc.openImage(b.logo);
      const k = Math.min(130 / img.width, H / img.height);
      const w = img.width * k, h = img.height * k;
      doc.image(img, L, y0 + (H - h) / 2, { width: w, height: h });
      x = L + w + 14;
    } catch (e) { x = L; }
  }
  const addr = [club.street, club.city].filter(Boolean);
  const nameW = R - x - 170;
  const name = String(club.name || '').replace(/\s+(e\.)\s*(V\.)/g, ' $1 $2');   // „e. V.“ nie allein in der zweiten Zeile
  doc.font('Helvetica-Bold').fontSize(13).fillColor(INK);
  const nh = doc.heightOfString(name, { width: nameW });
  doc.text(name, x, y0 + (H - nh) / 2, { width: nameW });
  if (addr.length) {
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    const ah = doc.heightOfString(addr.join('\n'), { width: 160, lineGap: 1.5 });
    doc.text(addr.join('\n'), R - 160, y0 + (H - ah) / 2, { width: 160, align: 'right', lineGap: 1.5 });
  }
  const ly = y0 + H + 10;
  doc.moveTo(L, ly).lineTo(R, ly).lineWidth(1.4).strokeColor(b.color).stroke();
  return ly + 1;
}
/** schmaler Kopf für Folgeseiten */
function headSmall(doc, club, b, title) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(club.name || '', L, TOP, { width: W / 2, lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(title, L + W / 2, TOP, { width: W / 2, align: 'right', lineBreak: false });
  doc.moveTo(L, TOP + 16).lineTo(R, TOP + 16).lineWidth(0.8).strokeColor(b.color).stroke();
  return TOP + 34;
}
/**
 * Fußzeile auf allen Seiten: Zeile 1 (Standard: Verein · Anschrift), optional eine zweite Zeile, Seitenzahl bei mehreren Seiten.
 * groups: [[erste Seite, Anzahl], …] je Brief (Sammel-PDF zählt je Brief); foot: Höhe der Fußzeile, wenn ein Modul sie tiefer setzt.
 */
function footer(doc, club, { numbers = true, groups = null, line1 = null, line2 = '', foot = FOOT } = {}) {
  const range = doc.bufferedPageRange();
  const text = line1 != null ? line1 : [club.name, club.street, club.city].filter(Boolean).join(' · ');
  for (const [start, count] of groups || [[range.start, range.count]]) for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    const mb = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.moveTo(L, foot - 8).lineTo(R, foot - 8).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.font('Helvetica').fontSize(7.2).fillColor(SOFT).text(text, L, foot, { width: W - 74, height: 9, ellipsis: true });
    if (line2) doc.text(line2, L, foot + 10, { width: W - 74, height: 9, ellipsis: true });
    if (numbers && count > 1) doc.text(`Seite ${i - start + 1} von ${count}`, R - 70, foot, { width: 70, align: 'right', lineBreak: false });
    doc.page.margins.bottom = mb;
  }
}
/** Falz- und Lochmarken am linken Rand (DIN 5008) */
function foldMarks(doc) {
  doc.lineWidth(0.5).strokeColor(SOFT);
  for (const y of [297.64, 595.28]) doc.moveTo(14, y).lineTo(24, y).stroke();
  doc.moveTo(14, PH / 2).lineTo(20, PH / 2).stroke();
}
/** Kästchen (angekreuzt oder leer) */
function box(doc, x, y, on, color = INK) {
  doc.rect(x, y, 9, 9).lineWidth(0.8).strokeColor(on ? color : '#8a919b').stroke();
  if (on) doc.moveTo(x + 1.8, y + 4.6).lineTo(x + 3.9, y + 7).lineTo(x + 7.4, y + 1.9).lineWidth(1.4).strokeColor(color).stroke();
}
/** Brief-Kopf bis zur Rücksendeangabe über dem Anschriftfeld (DIN 5008, Form B); die Anschrift selbst setzt das Modul darunter (y = 146) */
function letterTop(doc, club, b) {
  head(doc, club, b);
  foldMarks(doc);
  const ret = [club.name, club.street, club.city].filter(Boolean).join(' · ');
  let rs = 6.8; doc.font('Helvetica'); while (rs > 5.2 && doc.fontSize(rs).widthOfString(ret) > 240) rs -= 0.2;   // Rücksendeangabe immer einzeilig
  doc.fontSize(rs).fillColor(SOFT).text(ret, L, 128, { width: 240, height: 9, ellipsis: true });
  doc.moveTo(L, 137).lineTo(L + 240, 137).lineWidth(0.4).strokeColor(LINE).stroke();
}

module.exports = { PW, PH, L, R, W, TOP, BOTTOM, FOOT, INK, MUTED, SOFT, LINE, FAINT, euro, fmtIban, mix, imgFromData, isImg, collect, brand, newDoc, head, headSmall, footer, foldMarks, box, letterTop };
