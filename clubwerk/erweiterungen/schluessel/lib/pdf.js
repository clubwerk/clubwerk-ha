'use strict';
/**
 * PDF der Schlüsselübergabe, Rückgabe, Verlustanzeige und Stornierung – im Stil der Beitrittserklärung (Kopf mit Logo, Linie in Vereinsfarbe,
 * nummerierte Abschnitte, Unterschriften, Prüfwert). Wird beim Unterschreiben einmal gebaut und nie neu erzeugt.
 */
const PDFDocument = require('pdfkit');
const { deD } = require('../../../src/util');

const PW = 595.28, PH = 841.89, L = 56.7, R = PW - 56.7, W = R - L, TOP = 40, BOTTOM = PH - 64, FOOT = PH - 38;
const INK = '#1b1f24', MUTED = '#6b7280', SOFT = '#9aa1ab', LINE = '#d5d9df';
const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const mix = (hex, t) => '#' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('');
const isImg = b => Buffer.isBuffer(b) && b.length > 100 && ((b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0xff && b[1] === 0xd8));
const imgFromData = d => { const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(d || '')); return m ? Buffer.from(m[1], 'base64') : null; };

let core = null; try { core = require('../../../src/db'); } catch (e) { core = null; }
function brand() {
  const g = (k, d = '') => { try { return core ? core.getSetting(k, d) : d; } catch (e) { return d; } };
  let color = g('club_color', ''); if (!/^#[0-9a-f]{6}$/i.test(color)) color = '#1f6b3a';
  let logo = null; const type = g('club_logo_type');
  try {
    if (type === 'png' || type === 'jpg') logo = Buffer.from(g('club_logo'), 'base64');
    else if (type && g('club_logo_png') && g('club_logo_png_ver') === g('club_logo_ver', 'std')) logo = Buffer.from(g('club_logo_png'), 'base64');
  } catch (e) { logo = null; }
  return { color, soft: mix(color, 0.9), logo: isImg(logo) ? logo : null };
}
function head(doc, club, b) {
  const H = 46, y0 = TOP; let x = L;
  if (b.logo) { try { const img = doc.openImage(b.logo); const k = Math.min(130 / img.width, H / img.height); doc.image(img, L, y0 + (H - img.height * k) / 2, { width: img.width * k, height: img.height * k }); x = L + img.width * k + 14; } catch (e) { x = L; } }
  const addr = [club.street, club.city].filter(Boolean);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(INK);
  const name = String(club.name || '').replace(/\s+(e\.)\s*(V\.)/g, ' $1 $2');
  const nh = doc.heightOfString(name, { width: R - x - 170 });
  doc.text(name, x, y0 + (H - nh) / 2, { width: R - x - 170 });
  if (addr.length) { doc.font('Helvetica').fontSize(8.5).fillColor(MUTED); const ah = doc.heightOfString(addr.join('\n'), { width: 160, lineGap: 1.5 }); doc.text(addr.join('\n'), R - 160, y0 + (H - ah) / 2, { width: 160, align: 'right', lineGap: 1.5 }); }
  const ly = y0 + H + 10; doc.moveTo(L, ly).lineTo(R, ly).lineWidth(1.4).strokeColor(b.color).stroke();
  return ly + 1;
}
function footer(doc, club) {
  const range = doc.bufferedPageRange(), text = [club.name, club.street, club.city].filter(Boolean).join(' · ');
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i); const mb = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.moveTo(L, FOOT - 8).lineTo(R, FOOT - 8).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.font('Helvetica').fontSize(7.2).fillColor(SOFT).text(text, L, FOOT, { width: W - 74, height: 9, ellipsis: true });
    if (range.count > 1) doc.text(`Seite ${i - range.start + 1} von ${range.count}`, R - 70, FOOT, { width: 70, align: 'right', lineBreak: false });
    doc.page.margins.bottom = mb;
  }
}
/** „Nr. 07“ bzw. „Nr. 07, Stück 2“ (Einzelnummer des Exemplars) */
const itemNo = it => { const l = String(it.label || ''), id = String(it.ident); return !l || l === id ? `Nr. ${id}` : `Nr. ${id}, Stück ${l.startsWith(id + '-') ? l.slice(id.length + 1) : l}`; };
const need = (doc, y, h, club, b) => { if (y + h <= BOTTOM) return y; doc.addPage(); return head(doc, club, b) + 18; };
function section(doc, y, no, title, b) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(b.color).text(no, L, y, { width: 22, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(title, L + 24, y - 0.5, { width: W - 24, lineBreak: false });
  return y + 20;
}
function rows(doc, y, list, club, b) {
  for (const [k, v] of list) {
    doc.font('Helvetica').fontSize(9.5);
    const h = Math.max(14, doc.heightOfString(String(v || '–'), { width: W - 150 }) + 3);
    y = need(doc, y, h, club, b);
    doc.fillColor(MUTED).text(k, L + 24, y, { width: 120, lineBreak: false });
    doc.fillColor(INK).text(String(v || '–'), L + 150, y, { width: W - 150 });
    y += h;
  }
  return y + 8;
}

/**
 * kind: ausgabe | rueckgabe | verlust | storno
 * p: { no, at, kind, title, club, person, contactShown, issuedBy, receiver, items:[{ident,name,label,opens}], due, deposit (Text), terms (Text),
 *      extra: [[Beschriftung, Wert]], sigs: [{ label, name, png }], sha256, refNo }
 */
async function build(p) {
  const b = brand(), club = p.club || {};
  const doc = new PDFDocument({ size: 'A4', margins: { top: TOP, bottom: 20, left: L, right: PW - R }, bufferPages: true, info: { Title: `${p.title} ${p.no}`, Author: club.name || '' } });
  const done = new Promise((res, rej) => { const ch = []; doc.on('data', c => ch.push(c)); doc.on('end', () => res(Buffer.concat(ch))); doc.on('error', rej); });
  let y = head(doc, club, b) + 22;
  doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text(p.title, L, y, { width: W - 130 });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Nr. ${p.no}`, R - 120, y + 4, { width: 120, align: 'right' });
  y += 28;
  doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(`${deD(p.at.slice(0, 10))}, ${p.at.slice(11, 16)} Uhr${p.refNo ? ` · gehört zu ${p.refNo}` : ''}`, L, y); y += 24;

  y = section(doc, y, '01', 'Personen', b);
  y = rows(doc, y, [[p.kind === 'ausgabe' ? 'Empfänger/in' : 'Person', p.person], ...(p.contactShown ? [['Kontakt', p.contactShown]] : []), [p.kind === 'ausgabe' ? 'Ausgegeben von' : 'Angenommen von', p.issuedBy]], club, b);

  y = need(doc, y, 60, club, b);
  y = section(doc, y, '02', p.kind === 'verlust' ? 'Verlorene Schlüssel' : p.kind === 'rueckgabe' ? 'Zurückgegebene Schlüssel' : 'Schlüssel', b);
  for (const it of p.items) {
    y = need(doc, y, 30, club, b);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text(itemNo(it), L + 24, y, { width: 110, lineBreak: false });
    doc.font('Helvetica').fontSize(9.5).text(it.name, L + 140, y, { width: W - 140 });
    y += 14;
    if (it.opens) { doc.fillColor(MUTED).fontSize(8.5).text(`schließt: ${it.opens}`, L + 140, y, { width: W - 140 }); y += 13; }
    y += 3;
  }
  y += 6;
  if (p.extra && p.extra.length) { y = need(doc, y, 40, club, b); y = section(doc, y, '03', 'Angaben', b); y = rows(doc, y, p.extra, club, b); }

  if (p.terms) {
    y = need(doc, y, 60, club, b);
    y = section(doc, y, p.extra && p.extra.length ? '04' : '03', 'Bedingungen', b);
    doc.font('Helvetica').fontSize(9.2).fillColor(INK);
    for (const para of String(p.terms).split('\n').filter(Boolean)) {
      const h = doc.heightOfString(para, { width: W - 24, lineGap: 1.5 }) + 5;
      y = need(doc, y, h, club, b);
      doc.fillColor(INK).text(para, L + 24, y, { width: W - 24, lineGap: 1.5 }); y += h;
    }
    y += 8;
  }

  y = need(doc, y, 140, club, b);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text('Unterschriften', L, y); y += 20;
  const cw = (W - 24) / 2; let col = 0, rowTop = y;
  for (const s of p.sigs) {
    if (col === 0) { rowTop = need(doc, rowTop, 100, club, b); }
    const x = L + col * (cw + 24);
    const img = imgFromData(s.png);
    if (img) { try { doc.image(doc.openImage(img), x, rowTop, { fit: [cw, 56], align: 'left', valign: 'bottom' }); } catch (e) { /* ohne Bild */ } }
    doc.moveTo(x, rowTop + 60).lineTo(x + cw, rowTop + 60).lineWidth(0.6).strokeColor(MUTED).stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(`${s.label}${s.name ? ': ' + s.name : ''}`, x, rowTop + 64, { width: cw });
    if (col === 1) { rowTop += 90; col = 0; } else col = 1;
  }
  if (col === 1) rowTop += 90;
  y = rowTop + 6;
  y = need(doc, y, 36, club, b);
  doc.font('Helvetica').fontSize(7.5).fillColor(SOFT).text(`Prüfwert (SHA-256): ${p.sha256}`, L, y, { width: W });
  doc.text('Elektronisch unterschrieben; das Protokoll wird bei der Unterschrift einmal erzeugt und nicht mehr verändert.', L, y + 11, { width: W });
  footer(doc, club);
  doc.end();
  return done;
}
module.exports = { build, euro, itemNo };
