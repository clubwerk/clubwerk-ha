'use strict';
/**
 * PDFs der Mitgliederverwaltung: Beitrittserklärung (mit Unterschriften), SEPA-Mandat, Rechnung/Mahnung, Briefe.
 * Einheitliches, ruhiges Layout: Kopf mit Vereinslogo und Anschrift, feine Linie in Vereinsfarbe, klares Raster
 * (A4, 20 mm Rand links und rechts), Fußzeile mit Verein und Seitenzahl. Briefe passen ins Fenster (DIN 5008, Form B).
 */
const PDFDocument = require('pdfkit');

/* ---------- Raster & Farben ---------- */
const PW = 595.28, PH = 841.89;
const L = 56.7, R = PW - 56.7, W = R - L;          // 20 mm links und rechts
const TOP = 40, BOTTOM = PH - 64, FOOT = PH - 38;  // Inhalt endet über der Fußzeile
const INK = '#1b1f24', MUTED = '#6b7280', SOFT = '#9aa1ab', LINE = '#d5d9df', FAINT = '#f3f4f6';
const DEFAULT_COLOR = /^#[0-9a-f]{6}$/i.test(process.env.CLUB_COLOR || '') ? process.env.CLUB_COLOR : '#1f6b3a';

const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const { deD } = require('../../../src/util');
const fmtIban = v => String(v || '').replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
const mix = (hex, t) => '#' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('');
const todayDe = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };

function collect(doc) {
  return new Promise((resolve, reject) => { const ch = []; doc.on('data', c => ch.push(c)); doc.on('end', () => resolve(Buffer.concat(ch))); doc.on('error', reject); });
}
const imgFromData = d => { const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(d || '')); return m ? Buffer.from(m[1], 'base64') : null; };
const isImg = b => Buffer.isBuffer(b) && b.length > 100 && ((b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) || (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff));

/* ---------- Vereinslogo & Vereinsfarbe (aus den Einstellungen des Kerns) ----------
   PNG/JPG werden direkt eingebettet. Ein SVG- oder WebP-Logo kann PDFKit nicht zeichnen – dafür nimmt Clubwerk das
   PNG-App-Symbol, das die Verwaltung aus dem Logo erzeugt (weißer Grund, quadratisch). Fehlt beides: Kopf ohne Logo. */
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
function newDoc(club, title, opts = {}) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: TOP, bottom: 20, left: L, right: PW - R }, bufferPages: true, autoFirstPage: opts.autoFirstPage !== false, info: { Title: title, Author: club.name || '' } });
  return doc;
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
  const name = String(club.name || '').replace(/\s+(e\.)\s*(V\.)/g, '\u00a0$1\u00a0$2');   // „e. V.“ nie allein in der zweiten Zeile
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
/** Fußzeile auf allen Seiten (Verein · Anschrift, Seitenzahl bei mehreren Seiten) */
function footer(doc, club, { numbers = true } = {}) {
  const range = doc.bufferedPageRange();
  const text = [club.name, club.street, club.city].filter(Boolean).join(' · ') + (club.ci ? `  ·  Gläubiger-ID ${club.ci}` : '');
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const mb = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.moveTo(L, FOOT - 8).lineTo(R, FOOT - 8).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.font('Helvetica').fontSize(7.2).fillColor(SOFT).text(text, L, FOOT, { width: W - 74, height: 9, ellipsis: true });
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

/**
 * Brief-Kopf: Rücksendeangabe und Anschrift im Fensterbereich, rechts ein Infoblock (Datum, Nummern),
 * Betreff fett → y für den Text
 */
function letterHead(doc, club, b, person, name, title, info) {
  head(doc, club, b);
  foldMarks(doc);
  const ret = [club.name, club.street, club.city].filter(Boolean).join(' · ');
  let rs = 6.8; doc.font('Helvetica'); while (rs > 5.2 && doc.fontSize(rs).widthOfString(ret) > 240) rs -= 0.2;   // Rücksendeangabe immer einzeilig
  doc.fontSize(rs).fillColor(SOFT).text(ret, L, 128, { width: 240, height: 9, ellipsis: true });
  doc.moveTo(L, 137).lineTo(L + 240, 137).lineWidth(0.4).strokeColor(LINE).stroke();
  doc.font('Helvetica').fontSize(10.5).fillColor(INK).text([name, person.address_extra, person.street, [person.zip, person.city].filter(Boolean).join(' ')].filter(Boolean).join('\n'), L, 146, { width: 240, lineGap: 1.5 });
  const ix = R - 176;
  let iy = 146;
  for (const [k, v] of info.filter(x => x[1])) {
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(k, ix, iy + 1, { width: 90, lineBreak: false });
    doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(String(v), ix + 90, iy, { width: 86, align: 'right', lineBreak: false });
    iy += 16;
  }
  doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(title, L, 262, { width: W });
  return doc.y + 16;
}

/* ===================================================================== Rechnung / Zahlungserinnerung / Mahnung */
function invoice(club, o) {
  const b = brand(club);
  const doc = newDoc(club, o.no);
  const done = collect(doc);
  const word = o.dunning ? (o.dunning >= 2 ? `${o.dunning}. Mahnung` : 'Zahlungserinnerung') : 'Rechnung';
  const person = o.person || {};
  let y = letterHead(doc, club, b, person, o.name, `${word} ${o.no}`, [['Datum', deD(o.date)], [o.dunning ? 'Zu Rechnung' : 'Rechnungsnummer', o.no], ['Mitgliedsnummer', person.member_no]]);
  doc.font('Helvetica').fontSize(10.5).fillColor(INK);
  const intro = o.dunning ? 'bei der Durchsicht unserer Konten haben wir festgestellt, dass folgende Beträge noch offen sind:' : 'wir berechnen Ihnen:';
  doc.text(`Guten Tag ${o.name},`, L, y, { width: W }); y = doc.y + 6;
  doc.text(intro, L, y, { width: W }); y = doc.y + 14;
  // Tabelle
  const cDue = L + 10, cPos = L + 92, cAmt = R - 10, wPos = cAmt - 96 - cPos;
  const th = () => {
    doc.rect(L, y, W, 22).fill(b.soft);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK);
    doc.text('Fällig', cDue, y + 7, { width: 76, lineBreak: false }); doc.text('Position', cPos, y + 7, { width: wPos, lineBreak: false }); doc.text('Betrag', cAmt - 90, y + 7, { width: 90, align: 'right', lineBreak: false });
    y += 22;
  };
  th();
  doc.font('Helvetica').fontSize(10).fillColor(INK);
  for (const c of o.charges) {
    const h = Math.max(12, doc.heightOfString(c.text, { width: wPos }));
    if (y + h + 16 > BOTTOM) { doc.addPage(); y = headSmall(doc, club, b, `${word} ${o.no}`); th(); doc.font('Helvetica').fontSize(10).fillColor(INK); }
    doc.text(deD(c.due_date), cDue, y + 7, { width: 76 }); doc.text(c.text, cPos, y + 7, { width: wPos }); doc.text(euro(c.cents), cAmt - 90, y + 7, { width: 90, align: 'right' });
    y += h + 14;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
  }
  const total = o.charges.reduce((s, c) => s + c.cents, 0);
  if (y + 70 > BOTTOM) { doc.addPage(); y = headSmall(doc, club, b, `${word} ${o.no}`); }
  doc.moveTo(L, y).lineTo(R, y).lineWidth(1.2).strokeColor(b.color).stroke();
  doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(o.dunning ? 'Offen gesamt' : 'Gesamtbetrag', cPos, y + 9, { width: wPos }); doc.text(euro(total), cAmt - 110, y + 9, { width: 110, align: 'right' });
  y += 40;
  // Zahlungsweg
  doc.font('Helvetica').fontSize(10.5).fillColor(INK);
  if (y + 40 > BOTTOM) { doc.addPage(); y = headSmall(doc, club, b, `${word} ${o.no}`); }
  if (o.payment === 'lastschrift' && o.mandate && o.mandate.mandate_ref && !o.dunning) {
    doc.text(`Der Betrag wird per SEPA-Lastschrift von Ihrem Konto ${fmtIban(o.mandate.iban).replace(/^(.{4}).*(.{4})$/, '$1 •••• •••• $2')} eingezogen (Mandatsreferenz ${o.mandate.mandate_ref}, Gläubiger-ID ${club.ci}).`, L, y, { width: W, lineGap: 1.5 });
    y = doc.y;
  } else {
    doc.text(`Bitte überweisen Sie den Betrag${o.dunning ? ' innerhalb von 14 Tagen' : ''} auf das Konto des Vereins:`, L, y, { width: W }); y = doc.y + 10;
    const rows = [['Empfänger', club.name], ['IBAN', fmtIban(club.iban)], ['BIC', club.bic], ['Bank', club.bank], ['Verwendungszweck', o.no]].filter(r => r[1]);
    const bh = rows.length * 17 + 18;
    if (y + bh > BOTTOM) { doc.addPage(); y = headSmall(doc, club, b, `${word} ${o.no}`); }
    doc.roundedRect(L, y, W, bh, 6).fill(FAINT);
    let ry = y + 10;
    for (const [k, v] of rows) {
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(k, L + 16, ry + 1.5, { width: 110, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(v, L + 130, ry, { width: W - 146, lineBreak: false, ellipsis: true });
      ry += 17;
    }
    y += bh;
  }
  if (club.invoiceText) { y += 16; if (y + 30 > BOTTOM) { doc.addPage(); y = headSmall(doc, club, b, `${word} ${o.no}`); } doc.font('Helvetica').fontSize(8.8).fillColor(MUTED).text(club.invoiceText, L, y, { width: W }); }
  footer(doc, club);
  doc.end();
  return done;
}

/* ===================================================================== Briefe (je Person eine Seite) */
function letters(club, items) {
  const b = brand(club);
  const doc = newDoc(club, 'Briefe', { autoFirstPage: false });
  const done = collect(doc);
  const ds = todayDe();
  if (!items.length) { doc.addPage(); const y = head(doc, club, b); doc.font('Helvetica').fontSize(11).fillColor(INK).text('Alle Empfänger haben eine E-Mail-Adresse – es sind keine Briefe nötig.', L, y + 30, { width: W }); }
  for (const it of items) {
    doc.addPage();
    const p = it.person || {};
    const y = letterHead(doc, club, b, p, it.name, it.title, [['Datum', ds], ['Mitgliedsnummer', p.member_no]]);
    doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(`Guten Tag ${it.name},\n\n${it.body}`, L, y, { width: W, lineGap: 2.5, height: BOTTOM - y, ellipsis: true });
  }
  footer(doc, club, { numbers: false });
  doc.end();
  return done;
}

/* ===================================================================== Beitrittserklärung
   a = { data (Antragsdaten), signed_at, signed_via, sig_member, sig_mandate, sha256 }, feeList = [{ id, name, cents }], s = Einstellungen
   Ohne Daten (persons: [{}]) entsteht das leere Formular zum Ausdrucken. */
function application(club, a, feeList, s) {
  const d = a.data || {};
  const persons = d.persons && d.persons.length ? d.persons : [{}];
  const blank = !persons[0].last_name && !persons[0].first_name;
  const b = brand(club);
  const doc = newDoc(club, 'Beitrittserklärung');
  const done = collect(doc);
  const GAP = 18;
  let y = head(doc, club, b) + 22;
  const ensure = h => { if (y + h > BOTTOM) { doc.addPage(); y = headSmall(doc, club, b, 'Beitrittserklärung'); } };

  doc.font('Helvetica-Bold').fontSize(21).fillColor(INK).text('Beitrittserklärung', L, y, { width: W }); y = doc.y + 4;
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`Hiermit beantrage ich die Mitgliedschaft im ${club.name}.`, L, y, { width: W }); y = doc.y + 14;

  const section = (no, title, need = 60) => {
    ensure(need);
    y += 8;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(b.color).text(`${no}   ${title.toUpperCase()}`, L, y, { width: W, characterSpacing: 0.9, lineBreak: false });
    y += 12;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
    y += 10;
  };
  /** Zeile mit Feldern im 4-Spalten-Raster: [[Bezeichnung, Wert, Spalten]] – alle Zeilen fluchten an denselben Kanten */
  const COL = (W - 3 * GAP) / 4;
  const span = k => k * COL + (k - 1) * GAP;
  const fields = list => {
    doc.font('Helvetica').fontSize(10.5);
    const hs = list.map(f => Math.max(blank ? 16 : 13, doc.heightOfString(String(f[1] || ' '), { width: span(f[2] || 1) })));
    const h = Math.max(...hs);
    ensure(h + 30);
    let x = L;
    for (const f of list) {
      const w = span(f[2] || 1);
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(f[0], x, y, { width: w, lineBreak: false, ellipsis: true });
      doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(String(f[1] || ''), x, y + 12, { width: w });
      doc.moveTo(x, y + 14 + h).lineTo(x + w, y + 14 + h).lineWidth(0.6).strokeColor('#b9bfc7').stroke();
      x += w + GAP;
    }
    y += h + 26;
  };
  const para = (text, size = 8.8, color = INK, gap = 6) => {
    doc.font('Helvetica').fontSize(size);
    const h = doc.heightOfString(text, { width: W, lineGap: 1.2 });
    ensure(h + gap);
    doc.fillColor(color).text(text, L, y, { width: W, lineGap: 1.2 }); y += h + gap;
  };

  // 1 Antragsteller/in
  const p0 = persons[0] || {};
  const GENDER = { m: 'männlich', w: 'weiblich', d: 'divers' };
  section('01', 'Antragsteller/in');
  fields([['Vorname', p0.first_name, 2], ['Nachname', p0.last_name, 2]]);
  fields([['Geburtsdatum', deD(p0.birth_date), 1], ['Geschlecht', GENDER[p0.gender] || '', 1], ['Mitgliedschaft ab', deD(d.entry_date), 2]]);

  // 2 Anschrift & Kontakt
  section('02', 'Anschrift & Kontakt');
  fields([['Straße und Hausnummer', d.street, 4]]);
  fields([['Postleitzahl', d.zip, 1], ['Wohnort', d.city, 3]]);
  fields([['Mobilfunknummer', d.mobile, 2], ['E-Mail-Adresse', d.email, 2]]);

  // 3 Weitere Familienmitglieder
  const others = persons.slice(1);
  const ROLE = { partner: 'Partner/in', kind: 'Kind' };
  if (others.length || blank) {
    section('03', 'Weitere Familienmitglieder', 90);
    // gleiches Raster wie die Felder: Name (2 Spalten, Kontakt klein darunter), Geburtsdatum, Rolle
    const cx = [L, L + span(2) + GAP, L + span(3) + GAP], cw = [span(2), COL, COL];
    const head2 = () => {
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED);
      ['Vorname, Nachname', 'Geburtsdatum', 'Rolle'].forEach((t, i) => doc.text(t, cx[i], y, { width: cw[i], lineBreak: false }));
      y += 14;
    };
    head2();
    const rowsData = others.length ? others.map(p => [`${p.first_name || ''} ${p.last_name || ''}`.trim(), deD(p.birth_date), ROLE[p.role] || '', [p.mobile, p.email].filter(Boolean).join(' · ')]) : [['', '', '', ''], ['', '', '', ''], ['', '', '', '']];
    for (const r of rowsData) {
      doc.font('Helvetica').fontSize(10);
      const nh = doc.heightOfString(r[0] || ' ', { width: cw[0] });
      doc.font('Helvetica').fontSize(8.5);
      const kh = r[3] ? doc.heightOfString(r[3], { width: cw[0] }) + 2 : 0;
      const h = Math.max(blank ? 18 : 13, nh + kh);
      if (y + h + 10 > BOTTOM) { doc.addPage(); y = headSmall(doc, club, b, 'Beitrittserklärung'); head2(); }
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(r[0] || '', cx[0], y, { width: cw[0] });
      if (r[3]) doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(r[3], cx[0], y + nh + 2, { width: cw[0] });
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(r[1] || '', cx[1], y, { width: cw[1], lineBreak: false });
      doc.text(r[2] || '', cx[2], y, { width: cw[2], lineBreak: false });
      y += h + 4;
      doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
      y += 7;
    }
    y += 6;
  }

  // 4 Mitgliedschaft & Beitrag
  section(others.length || blank ? '04' : '03', 'Mitgliedschaft & Beitrag', 80);
  const nSec = others.length || blank ? 4 : 3;
  if (s.due_text) para(s.due_text, 8.8, MUTED, 8);
  for (const f of feeList) {
    const on = String(f.id) === String(d.fee_id);
    doc.font(on ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
    const h = Math.max(12, doc.heightOfString(f.name, { width: W - 26 - 110 }));
    ensure(h + 8);
    box(doc, L, y + 1, on, b.color);
    doc.fillColor(INK).text(f.name, L + 18, y, { width: W - 18 - 110 });
    doc.text(euro(f.cents), R - 110, y, { width: 110, align: 'right' });
    y += h + 8;
  }
  // Abteilungen mit Zusatzbeitrag (je Person)
  if (s.depts && s.depts.length) {
    y += 4;
    ensure(s.dept_lines ? 60 : 80);   // Überschrift nie allein am Seitenende
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text('Abteilungen', L, y, { width: W, continued: false });
    y = doc.y + 1;
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('Zusatzbeitrag je Person, zusätzlich zum Beitrag', L, y, { width: W }); y = doc.y + 7;
    if (s.dept_lines) {
      if (!s.dept_lines.length) { doc.font('Helvetica').fontSize(10).fillColor(INK).text('–', L + 18, y); y = doc.y + 6; }
      for (const t of s.dept_lines) {
        doc.font('Helvetica').fontSize(10);
        const h = Math.max(12, doc.heightOfString(t, { width: W - 18 }));
        ensure(h + 7);
        box(doc, L, y + 1, true, b.color);
        doc.fillColor(INK).text(t, L + 18, y, { width: W - 18 }); y += h + 7;
      }
    } else {
      for (const dep of s.depts) {
        const feeTxt = dep.fees.map(f => `${f.name} ${euro(f.cents)}`).join(' · ');
        doc.font('Helvetica').fontSize(8.5);
        const h = 13 + doc.heightOfString(feeTxt, { width: span(2) - 18 });
        ensure(h + 10);
        box(doc, L, y + 1, false);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(dep.name, L + 18, y, { width: span(2) - 18, lineBreak: false, ellipsis: true });
        doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(feeTxt, L + 18, y + 13, { width: span(2) - 18 });
        const fx = L + span(2) + GAP;
        doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text('für (Name)', fx, y, { width: R - fx, lineBreak: false });
        doc.moveTo(fx, y + 24).lineTo(R, y + 24).lineWidth(0.6).strokeColor('#b9bfc7').stroke();
        y += Math.max(h, 26) + 10;
      }
    }
  }
  if (s.work_text) { y += 2; para(s.work_text, 8.8, MUTED, 8); }

  // 5 Einwilligungen
  if (s.consents && s.consents.length) {
    section(`0${nSec + 1}`, 'Einwilligungen', 70);
    for (const c of s.consents) {
      const on = Boolean(d.consents && d.consents[c.key]);
      doc.font('Helvetica').fontSize(8.6);
      const h = doc.heightOfString(c.text, { width: W - 18, lineGap: 1.2 });
      ensure(h + 8);
      box(doc, L, y + 0.5, on, b.color);
      doc.fillColor(INK).text(c.text, L + 18, y, { width: W - 18, lineGap: 1.2 }); y += h + 8;
    }
  }

  // Unterschrift
  const colW = span(2), cx2 = L + span(2) + GAP;
  const sigBlock = (img, place, cap) => {
    ensure(84);
    y += 10;
    const ly = y + 44;
    doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(place, L, ly - 15, { width: colW, lineBreak: false });
    const buf = imgFromData(img);
    if (buf) { try { doc.image(buf, cx2, y, { fit: [colW, 42], align: 'center', valign: 'bottom' }); } catch (e) { /* ungültiges Bild */ } }
    doc.moveTo(L, ly).lineTo(L + colW, ly).lineWidth(0.7).strokeColor(INK).stroke();
    doc.moveTo(cx2, ly).lineTo(R, ly).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text('Ort, Datum', L, ly + 4, { width: colW });
    doc.text(cap, cx2, ly + 4, { width: colW });
    y = Math.max(doc.y, ly + 14) + 6;
  };
  const place = `${(club.city || '').replace(/^\d{5}\s*/, '')}${a.signed_at ? ', ' + deD(a.signed_at.slice(0, 10)) : ''}`;
  sigBlock(a.sig_member, place, `Unterschrift${d.signer ? ' – ' + d.signer : ''} (bei Minderjährigen: gesetzliche/r Vertreter/in)`);

  // SEPA-Lastschriftmandat – als geschlossener Block (passt er nicht mehr, beginnt er auf der nächsten Seite)
  const legal = `Ich ermächtige den ${club.name}, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die vom ${club.name} auf mein Konto gezogenen Lastschriften einzulösen. Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen.`;
  doc.font('Helvetica').fontSize(8.6);
  const sepaH = 30 + 40 + doc.heightOfString(legal, { width: W, lineGap: 1.2 }) + 10 + 2 * 44 + 90;
  if (y + sepaH > BOTTOM) { doc.addPage(); y = headSmall(doc, club, b, 'Beitrittserklärung'); }
  section(`0${nSec + 2}`, 'SEPA-Lastschriftmandat', 10);
  fields([['Gläubiger-Identifikationsnummer', club.ci || '–', 2], ['Mandatsreferenz', d.mandate_ref || 'wird gesondert mitgeteilt', 2]]);
  para(legal, 8.6, INK, 12);
  fields([['Kontoinhaber/in', d.holder, 2], ['Kreditinstitut', d.bank, 2]]);
  fields([['IBAN', d.iban_shown || fmtIban(d.iban), 3], ['BIC', d.bic, 1]]);
  sigBlock(a.sig_mandate, place, `Unterschrift Kontoinhaber/in${d.holder ? ' – ' + d.holder : ''}`);

  // Nachweis der elektronischen Unterschrift
  if (a.signed_at) {
    const t = `Elektronisch unterschrieben am ${deD(a.signed_at.slice(0, 10))} um ${a.signed_at.slice(11, 16)} Uhr (${a.signed_via === 'online' ? 'online' : 'am Vereinstablet'}). Prüfwert (SHA-256 der Antragsdaten und Unterschriften): ${a.sha256 || ''}`;
    doc.font('Helvetica').fontSize(7.2);
    const h = doc.heightOfString(t, { width: W - 24 });
    ensure(h + 22);
    y += 4;
    doc.roundedRect(L, y, W, h + 14, 5).fill(FAINT);
    doc.fillColor(MUTED).text(t, L + 12, y + 7, { width: W - 24 });
    y += h + 14;
  }
  footer(doc, club);
  doc.end();
  return done;
}

/* ===================================================================== Neues SEPA-Mandat (z. B. Kontowechsel in der Mitglieder-App) */
function mandate(club, o) {
  const b = brand(club);
  const doc = newDoc(club, `SEPA-Lastschriftmandat ${o.mandate_ref || ''}`);
  const done = collect(doc);
  const person = o.person || {};
  let y = letterHead(doc, club, b, person, o.name, 'SEPA-Lastschriftmandat', [['Datum', deD(o.signed_at ? o.signed_at.slice(0, 10) : o.date)], ['Mandatsreferenz', o.mandate_ref], ['Mitgliedsnummer', o.member_no]]);
  const line = (k, v) => {
    doc.font('Helvetica').fontSize(10.5);
    const h = Math.max(13, doc.heightOfString(v || '–', { width: W - 150 }));
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(k, L, y + 1.5, { width: 140, lineBreak: false });
    doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(v || '–', L + 150, y, { width: W - 150 });
    y += h + 6;
    doc.moveTo(L + 150, y - 2).lineTo(R, y - 2).lineWidth(0.4).strokeColor(LINE).stroke();
    y += 4;
  };
  const sub = t => { doc.font('Helvetica-Bold').fontSize(8).fillColor(b.color).text(t.toUpperCase(), L, y, { width: W, characterSpacing: 0.9, lineBreak: false }); y += 16; };
  sub('Zahlungsempfänger');
  line('Verein', [club.name, club.street, club.city].filter(Boolean).join(', '));
  line('Gläubiger-ID', club.ci);
  line('Mandatsreferenz', o.mandate_ref || 'wird mit der Bestätigung mitgeteilt');
  line('Mitglied', `${o.name}${o.member_no ? ' (Nr. ' + o.member_no + ')' : ''}`);
  y += 6;
  doc.font('Helvetica').fontSize(9.3).fillColor(INK).text(`Ich ermächtige den ${club.name}, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die vom ${club.name} auf mein Konto gezogenen Lastschriften einzulösen. Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen. Dieses Mandat ersetzt ein bisheriges Mandat für meine Mitgliedschaft.`, L, y, { width: W, lineGap: 1.5 });
  y = doc.y + 16;
  sub('Zahlungspflichtige/r');
  line('Kontoinhaber/in', o.holder); line('IBAN', fmtIban(o.iban)); line('BIC', o.bic); line('Kreditinstitut', o.bank);
  y += 14;
  const colW = (W - 36) / 2, ly = y + 46;
  const buf = imgFromData(o.signature);
  if (buf) { try { doc.image(buf, L + colW + 36, y, { fit: [colW, 44], align: 'center', valign: 'bottom' }); } catch (e) { /* ungültiges Bild */ } }
  doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(`${(club.city || '').replace(/^\d{5}\s*/, '')}${o.signed_at ? ', ' + deD(o.signed_at.slice(0, 10)) : ''}`, L, ly - 15, { width: colW, lineBreak: false });
  doc.moveTo(L, ly).lineTo(L + colW, ly).lineWidth(0.7).strokeColor(INK).stroke(); doc.moveTo(L + colW + 36, ly).lineTo(R, ly).stroke();
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text('Ort, Datum', L, ly + 4, { width: colW }); doc.text('Unterschrift Kontoinhaber/in', L + colW + 36, ly + 4, { width: colW });
  if (o.signed_at) {
    const t = `Elektronisch unterschrieben am ${deD(o.signed_at.slice(0, 10))} um ${o.signed_at.slice(11, 16)} Uhr in der Mitglieder-App. Prüfwert (SHA-256): ${o.sha256 || ''}`;
    doc.font('Helvetica').fontSize(7.2);
    const h = doc.heightOfString(t, { width: W - 24 });
    const by = ly + 30;
    doc.roundedRect(L, by, W, h + 14, 5).fill(FAINT);
    doc.fillColor(MUTED).text(t, L + 12, by + 7, { width: W - 24 });
  }
  footer(doc, club);
  doc.end();
  return done;
}

/* ===================================================================== Datenauskunft (Art. 15 DSGVO)
   out = Auskunft wie in der Verwaltung (JSON); lesbar als Abschnitte mit „Bezeichnung: Wert“, Listen je Eintrag eine Zeile. Interne Kennungen bleiben weg. */
const AUSK_HEAD = { konto: 'Konto', vereinsdaten: 'Vereinsdaten', bankverbindung: 'Bankverbindung', abteilungen: 'Abteilungen', beitraege: 'Beiträge', zahlergruppe: 'Zahlergruppe',
  familienmitgliedschaft: 'Familienmitgliedschaft', ehrungen: 'Ehrungen', aemter: 'Ämter', gratulationen: 'Gratulationen', forderungen: 'Forderungen', dokumente: 'Dokumente',
  aenderungsverlauf: 'Änderungsverlauf', mitglieder_app: 'Mitglieder-App', getraenke_je_monat: 'Verkauf je Monat' };
const AUSK_KEY = { name: 'Name', first_name: 'Vorname', last_name: 'Nachname', salutation: 'Anrede', title: 'Titel', birth_date: 'Geburtsdatum', gender: 'Geschlecht', street: 'Straße', zip: 'PLZ', city: 'Ort',
  address_extra: 'Adresszusatz', phone: 'Telefon', mobile: 'Handy', email: 'E-Mail', member_no: 'Mitgliedsnummer', entry_date: 'Eintritt', exit_date: 'Austritt', exit_reason: 'Austrittsgrund', notice_date: 'Kündigung',
  status: 'Status', key_no: 'Schlüsselnummer', notes: 'Notizen', payment: 'Zahlungsart', consents: 'Einwilligungen', holder: 'Kontoinhaber', iban: 'IBAN', bic: 'BIC', bank: 'Bank', mandate_ref: 'Mandatsreferenz',
  mandate_date: 'Mandat vom', created_at: 'Angelegt', kind: 'Art', active: 'Aktiv', hat_pin: 'PIN vergeben', text: 'Text', cents: 'Betrag (Cent)', due_date: 'Fällig', paid_at: 'Bezahlt', date: 'Datum',
  start_date: 'Beginn', end_date: 'Ende', from_date: 'Von', to_date: 'Bis', field: 'Feld', old_value: 'Vorher', new_value: 'Nachher', by_user: 'Von', at: 'Zeitpunkt' };
const SKIP = k => k === 'id' || /_id$|_hash$|^token|signature|^sha256|^extra$/.test(k);
const aval = v => (v === true ? 'ja' : v === false ? 'nein' : /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/.test(String(v)) ? deD(v) + (String(v).length > 10 ? ' ' + String(v).slice(11, 16) : '') : String(v));
const alabel = k => AUSK_KEY[k] || (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ');
const flat = o => Object.entries(o).filter(([k, v]) => !SKIP(k) && v != null && v !== '' && !(Array.isArray(v) && !v.length) && typeof v !== 'object').map(([k, v]) => `${alabel(k)}: ${aval(v)}`).join(' · ');
function auskunft(club, out) {
  const b = brand(club);
  const doc = newDoc(club, 'Datenauskunft');
  const done = collect(doc);
  let y = head(doc, club, b) + 24;
  const room = h => { if (y + h > BOTTOM) { doc.addPage(); y = headSmall(doc, club, b, 'Datenauskunft'); } };
  const para = (t, o = {}) => { doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.size || 9.5).fillColor(o.color || INK); const h = doc.heightOfString(t, { width: W - (o.indent || 0), lineGap: 1.5 }); room(h); doc.text(t, L + (o.indent || 0), y, { width: W - (o.indent || 0), lineGap: 1.5 }); y += h + (o.gap == null ? 4 : o.gap); };
  const sub = t => { room(40); y += 8; doc.font('Helvetica-Bold').fontSize(8).fillColor(b.color).text(t.toUpperCase(), L, y, { width: W, characterSpacing: 0.9, lineBreak: false }); y += 16; };
  doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text('Datenauskunft', L, y); y += 26;
  para(`${out.hinweis} Stand: ${aval(out.erstellt)}.`, { color: MUTED });
  const show = (v, indent = 0) => {
    if (v == null || v === '') return;
    if (Array.isArray(v)) { if (!v.length) para('keine Einträge', { color: MUTED, indent }); for (const x of v) para(x && typeof x === 'object' ? flat(x) || '–' : aval(x), { indent, gap: 2 }); return; }
    if (typeof v !== 'object') { para(aval(v), { indent }); return; }
    const simple = flat(v); if (simple) para(simple, { indent });
    for (const [k, w] of Object.entries(v)) if (w && typeof w === 'object' && !SKIP(k) && !(Array.isArray(w) && !w.length)) { para(alabel(k), { bold: true, indent, size: 9, gap: 2 }); show(w, indent + 10); }
  };
  for (const [k, v] of Object.entries(out)) {
    if (['erstellt', 'verein', 'hinweis', 'weitere_bereiche'].includes(k) || v == null || (Array.isArray(v) && !v.length)) continue;
    sub(AUSK_HEAD[k] || alabel(k)); show(v);
  }
  for (const [name, v] of Object.entries(out.weitere_bereiche || {})) { sub(name); show(v); }
  footer(doc, club);
  doc.end();
  return done;
}

module.exports = { invoice, letters, application, mandate, auskunft };
