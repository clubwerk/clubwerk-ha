'use strict';
/**
 * PDFs der Buchhaltung: Rechnung (auch Zahlungserinnerung, Stornorechnung) und Zuwendungsbestätigung
 * („Spendenquittung“) nach amtlichem Muster.
 *
 * Gestaltung wie in der Mitgliederverwaltung: Kopf mit Vereinslogo und Anschrift, feine Linie in Vereinsfarbe,
 * A4 mit 20 mm Rand links und rechts, Fußzeile mit Verein und Seitenzahl. Rechnungen passen ins Fensterkuvert
 * (DIN 5008, Form B, mit Falz- und Lochmarken).
 *
 * Zuwendungsbestätigung: Wortlaut nach den amtlichen Mustern des BMF (BMF-Schreiben vom 07.11.2013,
 * BStBl I 2013 S. 1333, geändert durch BMF-Schreiben vom 26.03.2014, BStBl I 2014 S. 791) für Körperschaften
 * im Sinne des § 5 Abs. 1 Nr. 9 KStG – Geldzuwendung (auch Verzicht auf Erstattung von Aufwendungen) und Sachzuwendung.
 * Nicht zutreffende Passagen werden weggelassen, Reihenfolge und Wortlaut bleiben unverändert; die Bestätigung
 * passt immer auf eine Seite.
 *
 * Exporte:
 *   invoice(club, inv)    → Promise<Buffer>
 *   donation(club, d)     → Promise<Buffer>
 *   amountInWords(cents)  → „einhundertdreiundzwanzig Euro und fünfundvierzig Cent“
 */
const PDFDocument = require('pdfkit');

/* ---------- Raster & Farben ---------- */
const PW = 595.28, PH = 841.89;
const L = 56.7, R = PW - 56.7, W = R - L;          // 20 mm links und rechts
const TOP = 40, BOTTOM = PH - 70, FOOT = PH - 44;  // Inhalt endet über der (zweizeiligen) Fußzeile
const INK = '#1b1f24', MUTED = '#6b7280', SOFT = '#9aa1ab', LINE = '#d5d9df', FAINT = '#f3f4f6';
const DEFAULT_COLOR = /^#[0-9a-f]{6}$/i.test(process.env.CLUB_COLOR || '') ? process.env.CLUB_COLOR : '#1f6b3a';

const euro = c => (Math.round(c || 0) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const { deD, today: todayIso } = require('../../../src/util');   // 'JJJJ-MM-TT' → 'TT.MM.JJJJ', anderes unverändert
const fmtIban = v => String(v || '').replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
const mix = (hex, t) => '#' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('');
const qtyFmt = q => Number(q == null ? 1 : q).toLocaleString('de-DE', { maximumFractionDigits: 3 });
const pct = v => `${Number(v || 0).toLocaleString('de-DE')} %`;
const keepEV = s => String(s || '').replace(/\s+(e\.)\s*(V\.)/g, ' $1 $2');   // „e. V.“ nie allein in der nächsten Zeile

function collect(doc) {
  return new Promise((resolve, reject) => { const ch = []; doc.on('data', c => ch.push(c)); doc.on('end', () => resolve(Buffer.concat(ch))); doc.on('error', reject); });
}
const isImg = b => Buffer.isBuffer(b) && b.length > 100 && ((b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) || (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff));

/* ---------- Vereinslogo & Vereinsfarbe (aus den Einstellungen des Kerns) ---------- */
let core = null;
try { core = require('../../../src/db'); } catch (e) { core = null; }
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

/* ---------- gemeinsame Bausteine ---------- */
function newDoc(club, title) {
  return new PDFDocument({ size: 'A4', margins: { top: TOP, bottom: 20, left: L, right: PW - R }, bufferPages: true, info: { Title: title, Author: club.name || '' } });
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
  const name = keepEV(club.name);
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
/** Fußzeile auf allen Seiten: Verein · Anschrift, darunter Kontakt/Steuernummer/Freitext; Seitenzahl bei mehreren Seiten */
function footer(doc, club, { numbers = true, tax = true } = {}) {
  const range = doc.bufferedPageRange();
  const l1 = [club.name, club.street, club.city].filter(Boolean).join(' · ');
  const l2 = [club.phone && `Tel. ${club.phone}`, club.email, tax && club.tax_no && `St.-Nr. ${club.tax_no}`, tax && club.vat_id && `USt-IdNr. ${club.vat_id}`, club.footer].filter(Boolean).join(' · ');
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const mb = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.moveTo(L, FOOT - 8).lineTo(R, FOOT - 8).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.font('Helvetica').fontSize(7.2).fillColor(SOFT);
    doc.text(l1, L, FOOT, { width: W - 74, height: 9, ellipsis: true, lineBreak: false });
    if (l2) doc.text(l2, L, FOOT + 10, { width: W - 74, height: 9, ellipsis: true, lineBreak: false });
    if (numbers && range.count > 1) doc.text(`Seite ${i - range.start + 1} von ${range.count}`, R - 70, FOOT, { width: 70, align: 'right', lineBreak: false });
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
/** Anschriftzeilen eines Empfängers (DIN 5008: Name, z. Hd., Straße, PLZ Ort, Land in Großbuchstaben) */
function addressLines(p = {}) {
  const country = String(p.country || '').trim();
  const foreign = country && !/^(de|deu|deutschland|germany)$/i.test(country);
  return [p.name, p.contact && (/^(z\.\s?hd\.?|c\/o|attn)/i.test(p.contact) ? p.contact : `z. Hd. ${p.contact}`), p.street,
    [p.zip, p.city].filter(Boolean).join(' '), foreign && country.toUpperCase()].filter(Boolean);
}
/** Leistungszeitraum: String, ISO-Datum, „von..bis“ oder {from, to} */
function periodText(p) {
  if (!p) return '';
  if (typeof p === 'object') return [deD(p.from), deD(p.to)].filter(Boolean).join(' – ');
  const m = /^(\d{4}-\d{2}-\d{2})\s*(?:\.\.|–|-|bis)\s*(\d{4}-\d{2}-\d{2})$/.exec(String(p).trim());
  return m ? `${deD(m[1])} – ${deD(m[2])}` : deD(String(p));
}

/**
 * Brief-Kopf im Fensterbereich: Rücksendeangabe, Anschrift, rechts Infoblock, Betreff → y für den Text
 */
function letterHead(doc, club, b, lines, title, info) {
  head(doc, club, b);
  foldMarks(doc);
  const ret = [club.name, club.street, club.city].filter(Boolean).join(' · ');
  let rs = 6.8; doc.font('Helvetica'); while (rs > 5.2 && doc.fontSize(rs).widthOfString(ret) > 240) rs -= 0.2;
  doc.fontSize(rs).fillColor(SOFT).text(ret, L, 128, { width: 240, height: 9, ellipsis: true });
  doc.moveTo(L, 137).lineTo(L + 240, 137).lineWidth(0.4).strokeColor(LINE).stroke();
  doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(lines.slice(0, 6).join('\n'), L, 146, { width: 240, lineGap: 1.5, height: 100, ellipsis: true });
  const IW = 200, ix = R - IW, lw = 92;
  let iy = 146;
  for (const [k, v] of info.filter(x => x[1])) {
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(k, ix, iy + 1, { width: lw, lineBreak: false });
    doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(String(v), ix + lw, iy, { width: IW - lw, align: 'right', lineBreak: false, height: 12, ellipsis: true });
    iy += 16;
  }
  doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(title, L, Math.max(262, iy + 14), { width: W });
  return doc.y + 16;
}

/* ===================================================================== Rechnung */
/**
 * inv = { no, date, due_date, period, title, recipient{name,contact,street,zip,city,country}, customer_no,
 *         items[{text, qty, unit_cents, vat}], small_business, prices_gross, intro, note, payment_text,
 *         direct_debit, mandate_ref, ref_no, ref_date, greeting, closing }
 * Einzelpreise sind netto (prices_gross: true → brutto); USt wird je Steuersatz auf die Summe gerechnet.
 */
function invoice(club = {}, inv = {}) {
  const b = brand(club);
  const title = inv.title || 'Rechnung';
  const isReminder = /erinnerung|mahnung/i.test(title);
  const isStorno = /storno|gutschrift/i.test(title);
  const label = `${title} ${inv.no || ''}`.trim();
  const doc = newDoc(club, label);
  const done = collect(doc);
  const vatOn = !inv.small_business;
  const items = (inv.items || []).map((it, i) => {
    const qty = it.qty == null || it.qty === '' ? 1 : Number(it.qty);
    const unit = Math.round(Number(it.unit_cents) || 0);
    const vat = vatOn ? Number(it.vat) || 0 : 0;
    return { pos: i + 1, text: String(it.text || ''), qty, unit, vat, amount: Math.round(qty * unit) };
  });

  // Summen je Steuersatz
  const rates = {};
  for (const it of items) rates[it.vat] = (rates[it.vat] || 0) + it.amount;
  let net = 0, gross = 0; const vatRows = [];
  for (const r of Object.keys(rates).map(Number).sort((a, b2) => a - b2)) {
    const base = rates[r];
    let n, t;
    if (inv.prices_gross) { t = Math.round(base * r / (100 + r)); n = base - t; } else { n = base; t = Math.round(base * r / 100); }
    net += n; gross += n + t;
    if (vatOn && r > 0) vatRows.push([r, n, t]);
  }

  const lines = addressLines(inv.recipient || {});
  const info = [['Datum', deD(inv.date || todayIso())],
    [isReminder ? 'Zu Rechnung' : isStorno ? 'Stornorechnung' : 'Rechnungsnummer', inv.no],
    [isStorno && inv.ref_no ? 'Zu Rechnung' : '', isStorno ? inv.ref_no : ''],
    ['Kundennummer', inv.customer_no],
    ['Leistungszeitraum', periodText(inv.period)],
    [isReminder ? 'Fällig seit' : 'Fällig am', isStorno ? '' : deD(inv.due_date)],
    [club.vat_id ? 'USt-IdNr.' : 'Steuernummer', club.vat_id || club.tax_no]];
  let y = letterHead(doc, club, b, lines, isReminder ? `${title} zur Rechnung ${inv.no || ''}`.trim() : label, info);

  // Anrede und Einleitung
  const contact = inv.recipient && inv.recipient.contact ? String(inv.recipient.contact).replace(/^(z\.\s?hd\.?\s*)/i, '') : '';
  const greeting = inv.greeting || (contact ? `Guten Tag ${contact},` : 'Sehr geehrte Damen und Herren,');
  const intro = inv.intro || (
    /^2\./.test(title) ? 'leider konnten wir zu der folgenden Rechnung bis heute keinen Zahlungseingang feststellen. Wir bitten Sie, den offenen Betrag nun umgehend zu begleichen.'
      : isReminder ? 'sicher ist es Ihrer Aufmerksamkeit entgangen, dass die folgende Rechnung noch nicht beglichen ist. Wir bitten um Ausgleich des offenen Betrags.'
        : isStorno ? `hiermit stornieren wir ${inv.ref_no ? `die Rechnung ${inv.ref_no}${inv.ref_date ? ` vom ${deD(inv.ref_date)}` : ''}` : 'die folgenden Positionen'}:`
          : 'für die folgenden Leistungen stellen wir Ihnen in Rechnung:');
  doc.font('Helvetica').fontSize(10.5).fillColor(INK);
  doc.text(greeting, L, y, { width: W }); y = doc.y + 6;
  doc.text(intro, L, y, { width: W, lineGap: 1.5 }); y = doc.y + 14;

  // Tabelle: Pos. | Beschreibung | Menge | Einzelpreis | (USt) | Betrag
  const P = 8;                                          // Innenabstand links/rechts
  const wPos = 30, wQty = 46, wUnit = 76, wVat = vatOn ? 42 : 0, wAmt = 80;
  const xPos = L + P, xDesc = xPos + wPos;
  const xAmt = R - P - wAmt, xVat = xAmt - wVat, xUnit = xVat - wUnit, xQty = xUnit - wQty;
  const wDesc = xQty - 12 - xDesc;
  const newPage = () => { doc.addPage(); y = headSmall(doc, club, b, label); };
  const th = () => {
    doc.rect(L, y, W, 22).fill(b.soft);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK);
    const o = { lineBreak: false };
    doc.text('Pos.', xPos, y + 7, { ...o, width: wPos });
    doc.text('Beschreibung', xDesc, y + 7, { ...o, width: wDesc });
    doc.text('Menge', xQty, y + 7, { ...o, width: wQty, align: 'right' });
    doc.text(vatOn ? (inv.prices_gross ? 'Einzelpreis brutto' : 'Einzelpreis netto') : 'Einzelpreis', xUnit - 20, y + 7, { ...o, width: wUnit + 20, align: 'right' });
    if (vatOn) doc.text('USt', xVat, y + 7, { ...o, width: wVat, align: 'right' });
    doc.text('Betrag', xAmt, y + 7, { ...o, width: wAmt, align: 'right' });
    y += 22;
  };
  th();
  for (const it of items) {
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    const h = Math.max(12, doc.heightOfString(it.text || ' ', { width: wDesc, lineGap: 1 }));
    if (y + h + 14 > BOTTOM) { newPage(); th(); doc.font('Helvetica').fontSize(10).fillColor(INK); }
    const ty = y + 7, o = { lineBreak: false };
    doc.fillColor(MUTED).text(String(it.pos), xPos, ty, { ...o, width: wPos });
    doc.fillColor(INK).text(it.text, xDesc, ty, { width: wDesc, lineGap: 1 });
    doc.text(qtyFmt(it.qty), xQty, ty, { ...o, width: wQty, align: 'right' });
    doc.text(euro(it.unit), xUnit, ty, { ...o, width: wUnit, align: 'right' });
    if (vatOn) doc.text(pct(it.vat), xVat, ty, { ...o, width: wVat, align: 'right' });
    doc.text(euro(it.amount), xAmt, ty, { ...o, width: wAmt, align: 'right' });
    y += h + 14;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
  }

  // Summen, rechtsbündig unter den Betragsspalten
  const sumRows = [];
  if (vatOn) {
    sumRows.push(['Summe netto', net]);
    for (const [r, n, t] of vatRows) sumRows.push([vatRows.length > 1 || n !== net ? `zzgl. USt ${pct(r)} auf ${euro(n)}` : `zzgl. USt ${pct(r)}`, t]);
  }
  const sumH = sumRows.length * 17 + 40;
  if (y + sumH > BOTTOM) newPage();
  y += 10;
  const xLab = R - 300;
  for (const [k, v] of sumRows) {
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(k, xLab, y, { width: xAmt - xLab - 8, align: 'right', lineBreak: false });
    doc.fillColor(INK).text(euro(v), xAmt, y, { width: wAmt, align: 'right', lineBreak: false });
    y += 17;
  }
  doc.moveTo(xLab, y).lineTo(R, y).lineWidth(1.2).strokeColor(b.color).stroke();
  const total = vatOn ? gross : net;
  const totLabel = isReminder ? 'Offener Betrag' : vatOn ? 'Gesamtbetrag brutto' : 'Gesamtbetrag';
  doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(totLabel, xLab, y + 8, { width: xAmt - xLab - 8, align: 'right', lineBreak: false });
  doc.text(euro(total), xAmt - 30, y + 8, { width: wAmt + 30, align: 'right', lineBreak: false });
  y += 36;

  const para = (text, { size = 10.5, color = INK, gap = 12 } = {}) => {
    if (!text) return;
    doc.font('Helvetica').fontSize(size);
    const h = doc.heightOfString(text, { width: W, lineGap: 1.5 });
    if (y + h > BOTTOM) newPage();
    doc.fillColor(color).text(text, L, y, { width: W, lineGap: 1.5 }); y = doc.y + gap;
  };
  if (inv.small_business) para('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', { size: 9.5, color: MUTED });

  // Zahlungsweg
  if (inv.direct_debit) {
    para(inv.payment_text || `Der Betrag wird per SEPA-Lastschrift eingezogen.${inv.mandate_ref ? ` Mandatsreferenz ${inv.mandate_ref}${club.ci ? `, Gläubiger-ID ${club.ci}` : ''}.` : ''}`);
  } else if (total < 0) {
    para(inv.payment_text || `Den Betrag von ${euro(-total)} erstatten wir Ihnen auf Ihr Konto.`);
  } else {
    const due = inv.due_date ? deD(inv.due_date) : '';
    const nRows = [club.name, club.iban, club.bic, club.bank, inv.no].filter(Boolean).length;
    if (y + 40 + nRows * 17 + 18 > BOTTOM) newPage();          // Zahlungstext und Kontokasten bleiben zusammen
    para(inv.payment_text || (isReminder
      ? `Bitte überweisen Sie den offenen Betrag von ${euro(total)} innerhalb von 14 Tagen unter Angabe der Rechnungsnummer ${inv.no} auf folgendes Konto:`
      : `Bitte überweisen Sie den Betrag von ${euro(total)}${due ? ` bis zum ${due}` : ''} unter Angabe der Rechnungsnummer ${inv.no} auf folgendes Konto:`), { gap: 10 });
    const rows = [['Empfänger', club.holder || club.name], ['IBAN', fmtIban(club.iban)], ['BIC', club.bic], ['Bank', club.bank], ['Verwendungszweck', [inv.no, inv.customer_no && `Kd.-Nr. ${inv.customer_no}`].filter(Boolean).join(' · ')]].filter(r => r[1]);
    const bh = rows.length * 17 + 18;
    if (y + bh > BOTTOM) newPage();
    doc.roundedRect(L, y, W, bh, 6).fill(FAINT);
    let ry = y + 10;
    for (const [k, v] of rows) {
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(k, L + 16, ry + 1.5, { width: 110, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(v, L + 130, ry, { width: W - 146, lineBreak: false, ellipsis: true });
      ry += 17;
    }
    y += bh + 14;
  }
  if (isReminder) para('Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.', { size: 9.5, color: MUTED });
  para(inv.note, { size: 9.5, color: MUTED });
  if (inv.closing !== false) {
    y += 4;
    para(`${inv.closing || 'Mit freundlichen Grüßen'}\n${club.name || ''}`, { gap: 0 });
  }
  footer(doc, club);
  doc.end();
  return done;
}

/* ===================================================================== Zahl in Worten */
const ONES = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf',
  'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
function under100(n) { if (n < 20) return ONES[n]; const u = n % 10, t = TENS[Math.floor(n / 10)]; return u ? `${ONES[u]}und${t}` : t; }
function under1000(n) { const h = Math.floor(n / 100), r = n % 100; return (h ? `${ONES[h]}hundert` : '') + under100(r); }
/** ganze Zahl 0 … 999.999.999 in Worten; 1 → „ein“ (vor „Euro“), sonst endendes „ein“ → „eins“ (101 → „einhunderteins“) */
function intWords(n) {
  if (n === 0) return 'null';
  if (n === 1) return 'ein';
  const mio = Math.floor(n / 1e6), tsd = Math.floor((n % 1e6) / 1000), rest = n % 1000;
  const parts = [];
  if (mio) parts.push(mio === 1 ? 'eine Million' : `${under1000(mio).replace(/ein$/, 'eine')} Millionen`);
  let tail = '';
  if (tsd) tail += `${under1000(tsd)}tausend`;
  if (rest) tail += (!tsd && rest === 1) ? 'ein' : under1000(rest).replace(/ein$/, 'eins');   // „elf Millionen ein Euro“
  if (tail) parts.push(tail);
  return parts.join(' ');
}
/** Betrag in Cent → deutsche Worte, z. B. 12345 → „einhundertdreiundzwanzig Euro und fünfundvierzig Cent“ */
function amountInWords(cents) {
  let c = Math.round(Number(cents) || 0);
  const neg = c < 0; c = Math.abs(c);
  if (c > 99999999999) throw new RangeError('Betrag zu groß (höchstens 999.999.999,99 €)');
  const e = Math.floor(c / 100), ct = c % 100;
  let s;
  if (e === 0 && ct) s = `${intWords(ct)} Cent`;
  else s = `${intWords(e)} Euro` + (ct ? ` und ${intWords(ct)} Cent` : '');
  return (neg ? 'minus ' : '') + s;
}

/* ===================================================================== Zuwendungsbestätigung */
/**
 * club zusätzlich: finanzamt, fa_tax_no, bescheid_type ('freistellung'|'feststellung'), bescheid_date,
 *                  veranlagungszeitraum, zwecke, signer, signer_role, place, fees_deductible
 * d = { no, kind 'geld'|'sach'|'verzicht', donor{name, street, zip, city}, cents, date, item,
 *       sach_origin 'betrieb'|'privat'|'unbekannt', sach_docs, issue_date }
 */
function donation(club = {}, d = {}) {
  const b = brand(club);
  const sach = d.kind === 'sach';
  const verzicht = d.kind === 'verzicht';
  const doc = newDoc(club, `Zuwendungsbestätigung ${d.no || ''}`.trim());
  const done = collect(doc);
  const zwecke = String(club.zwecke || '').trim() || '(Angabe des begünstigten Zwecks / der begünstigten Zwecke)';
  const fa = club.finanzamt || '……………', faNo = club.fa_tax_no || club.tax_no || '……………';
  const bDate = club.bescheid_date ? deD(club.bescheid_date) : '……………';

  // Layout zweimal versuchen: normal, und – falls es nicht auf eine Seite passt – etwas kompakter
  const render = (doc, k) => {
    const fs = 9.6 * k, gap = 11 * k, lab = 7.4;
    let y = head(doc, club, b);
    if (d.no) doc.font('Helvetica').fontSize(7.4).fillColor(SOFT).text(`Nr. ${d.no}`, R - 160, TOP - 16, { width: 160, align: 'right', lineBreak: false });

    // Feld: Beschriftung klein, Inhalt in einem fein umrandeten Kasten
    const field = (x, w, label, value, { bold = true, min = 0, size = fs + 0.6 } = {}) => {
      doc.font('Helvetica').fontSize(lab).fillColor(MUTED).text(label, x, y, { width: w, lineBreak: false, height: 9, ellipsis: true });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
      const h = Math.max(min, doc.heightOfString(value || ' ', { width: w - 16, lineGap: 1.2 }) + 12);
      return { h, draw: (hh) => {
        doc.roundedRect(x, y + 11, w, hh, 3).lineWidth(0.6).strokeColor(LINE).stroke();
        doc.fillColor(INK).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).text(value || '', x + 8, y + 11 + 6.5, { width: w - 16, lineGap: 1.2 });
      } };
    };
    const row = (cells) => {           // gleich hohe Kästen nebeneinander
      const fs2 = cells.map(c => field(...c));
      const hh = Math.max(...fs2.map(f => f.h));
      fs2.forEach(f => f.draw(hh));
      y += 11 + hh + gap;
    };

    y += 12 * k;
    row([[L, W, 'Aussteller (Bezeichnung und Anschrift der steuerbegünstigten Einrichtung)', [club.name, [club.street, club.city].filter(Boolean).join(', ')].filter(Boolean).join('\n'), { bold: false }]]);

    doc.font('Helvetica-Bold').fontSize(13.5 * Math.min(1, k + 0.05)).fillColor(INK).text(sach ? 'Bestätigung über Sachzuwendungen' : 'Bestätigung über Geldzuwendungen', L, y, { width: W });
    y = doc.y + 3;
    doc.font('Helvetica').fontSize(8.6).fillColor(MUTED).text('im Sinne des § 10b des Einkommensteuergesetzes an eine der in § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes bezeichneten Körperschaften, Personenvereinigungen oder Vermögensmassen', L, y, { width: W, lineGap: 1 });
    y = doc.y + 12 * k;

    const dn = d.donor || {};
    row([[L, W, 'Name und Anschrift des Zuwendenden', [dn.name, [dn.street, [dn.zip, dn.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join('\n'), { bold: false }]]);

    const wNum = 150, wDate = 96, g = 10, wWords = W - wNum - wDate - 2 * g;
    const pre = sach ? 'Wert der Zuwendung' : 'Betrag der Zuwendung';
    row([[L, wNum, `${pre} – in Ziffern –`, `${euro(d.cents).replace(' €', '')} €`],
      [L + wNum + g, wWords, '– in Buchstaben –', amountInWords(d.cents), { bold: false }],
      [R - wDate, wDate, 'Tag der Zuwendung', deD(d.date)]]);

    const check = (on, text, { size = fs, indent = 16 } = {}) => {
      doc.font('Helvetica').fontSize(size);
      const h = doc.heightOfString(text, { width: W - indent, lineGap: 1.3 });
      box(doc, L, y + 1, on, b.color);
      doc.fillColor(INK).text(text, L + indent, y, { width: W - indent, lineGap: 1.3 });
      y += h + gap * 0.8;
    };
    /** Satz mit hervorgehobenen Einsetzungen: parts = ['Text', {v:'Wert'}, …] */
    const rich = (parts, { x = L, w = W, size = fs } = {}) => {
      doc.fontSize(size).fillColor(INK);
      parts.forEach((p, i) => {
        const last = i === parts.length - 1;
        const isV = typeof p === 'object';
        doc.font(isV ? 'Helvetica-Bold' : 'Helvetica');
        if (i === 0) doc.text(isV ? p.v : p, x, y, { width: w, lineGap: 1.3, continued: !last });
        else doc.text(isV ? p.v : p, { continued: !last });
      });
      y = doc.y + gap;
    };

    if (sach) {
      row([[L, W, 'Genaue Bezeichnung der Sachzuwendung mit Alter, Zustand, Kaufpreis usw.', d.item || '', { bold: false, min: 34 }]]);
      const o = d.sach_origin;
      check(o === 'betrieb', 'Die Sachzuwendung stammt nach den Angaben des Zuwendenden aus dem Betriebsvermögen. Die Zuwendung wurde nach dem Wert der Entnahme (ggf. mit dem niedrigeren gemeinen Wert) und nach der Umsatzsteuer, die auf die Entnahme entfällt, bewertet.');
      check(o === 'privat', 'Die Sachzuwendung stammt nach den Angaben des Zuwendenden aus dem Privatvermögen.');
      check(o !== 'betrieb' && o !== 'privat', 'Der Zuwendende hat trotz Aufforderung keine Angaben zur Herkunft der Sachzuwendung gemacht.');
      check(!!d.sach_docs, 'Geeignete Unterlagen, die zur Wertermittlung gedient haben, z. B. Rechnung, Gutachten, liegen vor.');
      y += gap * 0.3;
    } else {
      doc.font('Helvetica').fontSize(fs).fillColor(INK).text('Es handelt sich um den Verzicht auf Erstattung von Aufwendungen', L, y, { width: W - 120, lineBreak: false });
      const jx = R - 104;
      box(doc, jx, y + 0.5, verzicht, b.color); doc.fillColor(INK).text('Ja', jx + 14, y, { lineBreak: false });
      box(doc, jx + 52, y + 0.5, !verzicht, b.color); doc.fillColor(INK).text('Nein', jx + 66, y, { lineBreak: false });
      y += fs + gap * 1.4;
    }

    // Steuerbegünstigung: Freistellungsbescheid oder Feststellung nach § 60a AO
    doc.moveTo(L, y - gap * 0.4).lineTo(R, y - gap * 0.4).lineWidth(0.5).strokeColor(LINE).stroke();
    y += gap * 0.4;
    const by = y;
    box(doc, L, y + 1, true, b.color);
    const ind = { x: L + 16, w: W - 16 };
    if (club.bescheid_type === 'feststellung') {
      rich(['Die Einhaltung der satzungsmäßigen Voraussetzungen nach den §§ 51, 59, 60 und 61 AO wurde vom Finanzamt ', { v: fa },
        ', StNr. ', { v: faNo }, ', mit Bescheid vom ', { v: bDate }, ' nach § 60a AO gesondert festgestellt. Wir fördern nach unserer Satzung ', { v: zwecke }, '.'], ind);
    } else {
      rich(['Wir sind wegen Förderung ', { v: zwecke }, ' nach dem Freistellungsbescheid bzw. nach der Anlage zum Körperschaftsteuerbescheid des Finanzamtes ',
        { v: fa }, ', StNr. ', { v: faNo }, ', vom ', { v: bDate }, ' für den letzten Veranlagungszeitraum ', { v: club.veranlagungszeitraum || '……………' },
        ' nach § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes von der Körperschaftsteuer und nach § 3 Nr. 6 des Gewerbesteuergesetzes von der Gewerbesteuer befreit.'], ind);
    }
    void by;
    rich(['Es wird bestätigt, dass die Zuwendung nur zur Förderung ', { v: zwecke }, ' verwendet wird.']);

    // Mitgliedsbeitrag: nur bei Einrichtungen, deren Beiträge nicht abziehbar sind (z. B. Sportvereine) – nicht bei Sachzuwendungen
    if (!sach && !club.fees_deductible) {
      doc.font('Helvetica-Oblique').fontSize(fs - 1).fillColor(MUTED).text('Nur für steuerbegünstigte Einrichtungen, bei denen die Mitgliedsbeiträge steuerlich nicht abziehbar sind:', L, y, { width: W });
      y = doc.y + 4;
      check(true, 'Es wird bestätigt, dass es sich nicht um einen Mitgliedsbeitrag handelt, dessen Abzug nach § 10b Abs. 1 des Einkommensteuergesetzes ausgeschlossen ist.');
    }
    return y;
  };

  // Unterschrift und Hinweis stehen unten auf der Seite; Abstand zum Text mindestens 30 pt
  const hint = 'Wer vorsätzlich oder grob fahrlässig eine unrichtige Zuwendungsbestätigung erstellt oder veranlasst, dass Zuwendungen nicht zu den in der Zuwendungsbestätigung angegebenen steuerbegünstigten Zwecken verwendet werden, haftet für die entgangene Steuer (§ 10b Abs. 4 EStG, § 9 Abs. 3 KStG, § 9 Nr. 5 GewStG).\n'
    + 'Diese Bestätigung wird nicht als Nachweis für die steuerliche Berücksichtigung der Zuwendung anerkannt, wenn das Datum des Freistellungsbescheides länger als 5 Jahre bzw. das Datum der Feststellung der Einhaltung der satzungsmäßigen Voraussetzungen nach § 60a Abs. 1 AO länger als 3 Jahre seit Ausstellung des Bescheides zurückliegt (§ 63 Abs. 5 AO).';
  doc.font('Helvetica').fontSize(7.2);
  const hintH = doc.heightOfString(hint, { width: W, lineGap: 1 }) + 20;
  const signH = 64;
  const hintY = BOTTOM + 6 - hintH;
  const signY = hintY - 14 - signH;

  let k = 1;
  for (const kk of [1, 0.93, 0.86, 0.8]) {        // passt es nicht auf eine Seite, etwas kompakter setzen
    k = kk;
    const probe = newDoc(club, 'probe');
    const yy = render(probe, k);
    probe.end();
    if (yy + 20 <= signY) break;
  }
  render(doc, k);

  // Ort, Datum und Unterschrift
  const place = [club.place || String(club.city || '').replace(/^\d{5}\s*/, ''), deD(d.issue_date || todayIso())].filter(Boolean).join(', ');
  const sy = signY + 26;
  doc.font('Helvetica').fontSize(10).fillColor(INK).text(place, L, sy - 14, { width: 200, lineBreak: false });
  doc.moveTo(L, sy).lineTo(L + 200, sy).moveTo(L + 230, sy).lineTo(R, sy).lineWidth(0.6).strokeColor(INK).stroke();
  doc.font('Helvetica').fontSize(lab()).fillColor(MUTED).text('Ort, Datum', L, sy + 4, { width: 200, lineBreak: false });
  doc.text('Unterschrift des Zuwendungsempfängers', L + 230, sy + 4, { width: R - L - 230, lineBreak: false });
  if (club.signer) doc.font('Helvetica').fontSize(9).fillColor(INK).text([club.signer, club.signer_role].filter(Boolean).join(', '), L + 230, sy + 15, { width: R - L - 230, lineBreak: false, ellipsis: true });

  // Hinweis
  doc.moveTo(L, hintY).lineTo(R, hintY).lineWidth(0.5).strokeColor(LINE).stroke();
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(MUTED).text('Hinweis:', L, hintY + 6, { width: W });
  doc.font('Helvetica').fontSize(7.2).fillColor(MUTED).text(hint, L, doc.y + 1, { width: W, lineGap: 1 });

  footer(doc, club, { numbers: false, tax: false });
  doc.end();
  return done;
  function lab() { return 7.4; }
}

module.exports = { invoice, donation, amountInWords, euro };
