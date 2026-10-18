'use strict';
const ExcelJS = require('exceljs');

const EURO = '#,##0.00 "€"';
let GREEN = 'FF1F6B3A';
let HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F2EA' } };
/** Vereinsfarbe übernehmen (Überschriften und Kopfzeilen). */
function setColor(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return;
  const c = hex.slice(1).toUpperCase();
  const soft = [0, 2, 4].map(i => Math.round(parseInt(c.slice(i, i + 2), 16) + (255 - parseInt(c.slice(i, i + 2), 16)) * 0.9)
    .toString(16).padStart(2, '0')).join('').toUpperCase();
  GREEN = 'FF' + c;
  HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + soft } };
}
const KIND_LABEL = { mitglied: 'Mitglied', mannschaft: 'Mannschaft', verein: 'Verein', gast: 'Gast' };
const BOOK_LABEL = { konto: 'Konto', verein: 'Verein (frei)', gast: 'Gast (bar)', event: 'Veranstaltung (bar)' };
function bookLabel(b) {
  if (b.tab_id && b.transferred_at) return 'Konto (von Gäste-Deckel übernommen)';
  if (b.tab_id) return 'Gäste-Deckel – ' + ({ offen: 'offen', bezahlt: b.tab_method === 'karte' ? 'Karte bezahlt' : 'bar bezahlt', abgeschrieben: 'abgeschrieben' }[b.tab_status] || '');
  if (b.transferred_at) return 'Konto (von Veranstaltung übernommen)';
  if (b.kind === 'event' && b.event_guest_id) {
    if (b.pay_method === 'bar') return 'Veranstaltung – bar bezahlt';
    if (b.pay_method === 'karte') return 'Veranstaltung – Karte bezahlt';
    return 'Veranstaltung – offen';
  }
  return BOOK_LABEL[b.kind];
}

function header(ws, row) {
  row.eachCell(c => {
    c.font = { bold: true, color: { argb: GREEN } };
    c.fill = HEAD_FILL;
    c.border = { bottom: { style: 'thin', color: { argb: 'FFB4B2A9' } } };
    c.alignment = { vertical: 'middle', wrapText: true };
  });
  row.height = 20;
}

function title(ws, text, sub, span) {
  ws.mergeCells(1, 1, 1, span);
  ws.getCell(1, 1).value = text;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: GREEN } };
  ws.mergeCells(2, 1, 2, span);
  ws.getCell(2, 1).value = sub;
  ws.getCell(2, 1).font = { color: { argb: 'FF5F5E5A' } };
}

const de = d => d.split('-').reverse().join('.');
const eur = c => (c || 0) / 100;

async function buildWorkbook({ clubName, from, to, balances, asOf, openBookings = [], categories, bookings, shrink, stock, events, tabs = [], color }) {
  setColor(color);
  const wb = new ExcelJS.Workbook();
  wb.creator = clubName;
  wb.created = new Date();
  const range = `Zeitraum ${de(from)} bis ${de(to)}`;

  /* 1) Abrechnung je Konto */
  const ws = wb.addWorksheet('Abrechnung', { views: [{ state: 'frozen', ySplit: 4 }] });
  const span = 3 + categories.length + 1;
  const stand = asOf ? `${de(asOf.slice(0, 10))} ${asOf.slice(11, 16)} Uhr` : '';
  title(ws, `${clubName} – Getränkeabrechnung: offene Beträge`, `Stand ${stand} · alle noch nicht abgerechneten Buchungen je Konto. ` +
    'Nach dem Abbuchen in der Vereinsverwaltung unter „Abrechnung“ als abgerechnet markieren.', span);
  ws.getRow(4).values = ['Konto', 'Typ', ...categories, 'Stück gesamt', 'Betrag'];
  header(ws, ws.getRow(4));
  let r = 5;
  for (const b of balances) {
    const counts = categories.map(c => b.byCategory[c] || 0);
    ws.getRow(r).values = [b.name, KIND_LABEL[b.kind] || b.kind, ...counts, counts.reduce((s, n) => s + n, 0), eur(b.total_cents)];
    r++;
  }
  const sumRow = ws.getRow(r);
  sumRow.getCell(1).value = 'Summe';
  for (let c = 3; c <= span; c++) {
    const col = ws.getColumn(c).letter;
    sumRow.getCell(c).value = r > 5 ? { formula: `SUM(${col}5:${col}${r - 1})` } : 0;
  }
  sumRow.font = { bold: true };
  sumRow.eachCell(c => { c.border = { top: { style: 'thin' } }; });
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 12;
  for (let c = 3; c < span; c++) ws.getColumn(c).width = 11;
  ws.getColumn(span).width = 13;
  ws.getColumn(span).numFmt = EURO;

  /* 1b) Offene Buchungen im Einzelnen (für Rückfragen) */
  const wsO = wb.addWorksheet('Offene Buchungen', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(wsO, 'Offene Buchungen je Konto', `Stand ${stand}`, 6);
  wsO.getRow(4).values = ['Konto', 'Zeitpunkt', 'Artikel', 'Menge', 'Einzelpreis', 'Betrag'];
  header(wsO, wsO.getRow(4));
  openBookings.forEach((b, i) => {
    wsO.getRow(5 + i).values = [b.member, b.created_at, b.article + (b.transferred_at ? ' (Veranstaltung)' : ''), b.qty, eur(b.unit_cents), eur(b.total_cents)];
  });
  [28, 18, 34, 8, 12, 12].forEach((w, i) => { wsO.getColumn(i + 1).width = w; });
  wsO.getColumn(5).numFmt = EURO; wsO.getColumn(6).numFmt = EURO;
  if (openBookings.length) wsO.autoFilter = { from: 'A4', to: `F${4 + openBookings.length}` };

  /* 2) Alle Buchungen */
  const wsB = wb.addWorksheet('Buchungen', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(wsB, 'Alle Buchungen', range, 8);
  wsB.getRow(4).values = ['Zeitpunkt', 'Konto / Veranstaltung', 'Art', 'Artikel', 'Kategorie', 'Menge', 'Listenpreis', 'Berechnet'];
  header(wsB, wsB.getRow(4));
  bookings.forEach((b, i) => {
    wsB.getRow(5 + i).values = [b.created_at, b.member || (b.event ? 'Veranstaltung: ' + b.event : 'Barverkauf'),
      bookLabel(b),
      b.article, b.category, b.qty, eur(b.unit_cents * b.qty), eur(b.total_cents)];
  });
  [18, 28, 18, 30, 14, 8, 12, 12].forEach((w, i) => { wsB.getColumn(i + 1).width = w; });
  wsB.getColumn(7).numFmt = EURO;
  wsB.getColumn(8).numFmt = EURO;
  if (bookings.length) wsB.autoFilter = { from: 'A4', to: `H${4 + bookings.length}` };

  /* 3) Schwund-Abgleich */
  const wsS = wb.addWorksheet('Abgleich Lieferung');
  title(wsS, 'Abgleich Lieferungen gegen Buchungen', `${range} · Einheit: Einzelartikel`, 12);
  wsS.getRow(4).values = ['Artikel', 'Kategorie', 'Geliefert', 'Konto', 'Verein (frei)', 'Gast (bar)', 'Veranstaltung',
    'Bruch', 'Korrektur', 'Offen (ohne Bestandsänderung)', 'Inventur-Differenz', 'Inventur-Fehlbetrag'];
  header(wsS, wsS.getRow(4));
  shrink.forEach((s, i) => {
    wsS.getRow(5 + i).values = [s.name, s.category, s.delivered, s.konto, s.verein, s.gast, s.event,
      s.bruch, s.korrektur, s.open, s.inventur, eur(s.shrink_cents)];
  });
  [30, 14, 10, 9, 11, 10, 13, 8, 10, 16, 12, 14].forEach((w, i) => { wsS.getColumn(i + 1).width = w; });
  wsS.getColumn(12).numFmt = EURO;
  const note = 5 + shrink.length + 1;
  wsS.mergeCells(note, 1, note, 12);
  wsS.getCell(note, 1).value = '„Offen“ = geliefert minus gebucht minus Bruch. Ein Wert über 0 heißt: Ware liegt noch im Lager '
    + 'oder wurde nicht gebucht. Verlässlich ist nur die Inventur-Differenz (gezählter Bestand gegen Soll-Bestand).';
  wsS.getCell(note, 1).alignment = { wrapText: true };
  wsS.getRow(note).height = 32;

  /* 4) Bestand heute */
  const wsL = wb.addWorksheet('Bestand');
  title(wsL, 'Lagerbestand (Soll)', `Stand ${new Date().toLocaleDateString('de-DE')}`, 6);
  wsL.getRow(4).values = ['Artikel', 'Kategorie', 'Bestand Einzelartikel', 'davon volle Gebinde', 'Mindestbestand', 'Hinweis'];
  header(wsL, wsL.getRow(4));
  stock.filter(s => s.track_stock).forEach((s, i) => {
    wsL.getRow(5 + i).values = [s.name, s.category, s.stock, Math.floor(Math.max(0, s.stock) / s.crate_size),
      s.min_stock, s.delivered > 0 && s.stock <= s.min_stock ? 'nachbestellen' : ''];
  });
  [30, 14, 16, 18, 16, 16].forEach((w, i) => { wsL.getColumn(i + 1).width = w; });

  /* 5) Veranstaltungen */
  const wsE = wb.addWorksheet('Veranstaltungen');
  title(wsE, 'Veranstaltungen', range, 7);
  let er = 4;
  if (!events.length) wsE.getCell(er, 1).value = 'Keine Veranstaltungen im Zeitraum.';
  for (const ev of events) {
    wsE.getCell(er, 1).value = `${ev.name} (${de(ev.date)})`;
    wsE.getCell(er, 1).font = { bold: true, size: 13 };
    er++;
    wsE.getRow(er).values = ['Artikel', 'Kategorie', 'Menge', 'Umsatz', 'davon Verein frei (Stk.)'];
    header(wsE, wsE.getRow(er)); er++;
    for (const it of ev.items) { wsE.getRow(er).values = [it.name, it.category, it.qty, eur(it.total_cents), it.free_qty ? it.free_qty + ' Stk.' : '']; er++; }
    wsE.getRow(er).values = ['Umsatz gesamt', '', '', eur(ev.total_cents)]; wsE.getRow(er).font = { bold: true }; er += 2;
    const rows = [['Sofort bar (ohne Namen / Gast)', ev.sale_cents], ['Von der Liste bar bezahlt', ev.bar_cents - ev.sale_cents],
      ['Bar gesamt (Soll in der Kasse)', ev.bar_cents], ['Mit Karte bezahlt', ev.karte_cents],
      ['Auf die Getränkeliste übernommen', ev.transferred_cents], ['Noch offen', ev.open_cents]];
    for (const [l, v] of rows) { wsE.getRow(er).values = [l, '', '', eur(v)]; er++; }
    wsE.getRow(er).values = ['Kasse gezählt', '', '', ev.cash_cents == null ? 'noch offen' : eur(ev.cash_cents)]; er++;
    if (ev.cash_cents != null) { wsE.getRow(er).values = ['Differenz Kasse − Soll', '', '', eur(ev.cash_cents - ev.bar_cents)]; er++; }
    if (ev.guests.length) {
      er++;
      wsE.getRow(er).values = ['Abrechnungsliste', 'Mitglied?', 'Stück', 'Betrag', 'bar', 'Karte', 'übernommen', 'offen'];
      header(wsE, wsE.getRow(er)); er++;
      for (const g of ev.guests) {
        wsE.getRow(er).values = [g.name, g.member_id ? 'ja' : 'nein (frei eingetragen)', g.qty, eur(g.total_cents),
          eur(g.bar_cents), eur(g.karte_cents), eur(g.transferred_cents), eur(g.open_cents)];
        er++;
      }
    }
    er++;
  }
  [34, 22, 10, 14, 12, 12, 13, 12].forEach((w, i) => { wsE.getColumn(i + 1).width = w; });
  [4, 5, 6, 7, 8].forEach(c => { wsE.getColumn(c).numFmt = EURO; });

  /* 6) Gäste-Deckel */
  const wsT = wb.addWorksheet('Gäste-Deckel', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(wsT, 'Gäste-Deckel (Gegner, Gäste)', range, 8);
  wsT.getRow(4).values = ['Deckel', 'geöffnet', 'Status', 'bar', 'Karte', 'übernommen / abgeschrieben', 'offen', 'geschlossen von'];
  header(wsT, wsT.getRow(4));
  const ST = { offen: 'offen', bezahlt: 'bezahlt', uebernommen: 'auf Konto übernommen', abgeschrieben: 'abgeschrieben' };
  tabs.forEach((t, i) => {
    wsT.getRow(5 + i).values = [t.name, t.created_at, ST[t.status] + (t.note ? ' – ' + t.note : ''),
      t.status === 'bezahlt' && t.method === 'bar' ? eur(t.cents) : '', t.status === 'bezahlt' && t.method === 'karte' ? eur(t.cents) : '',
      t.status === 'uebernommen' || t.status === 'abgeschrieben' ? eur(t.status === 'abgeschrieben' ? t.sum_cents : t.cents) : '',
      t.status === 'offen' ? eur(t.open_cents) : '', t.closed_by ? `${t.closed_by} (${t.closed_at})` : ''];
  });
  if (!tabs.length) wsT.getCell(5, 1).value = 'Keine Gäste-Deckel im Zeitraum.';
  else {
    const r = 5 + tabs.length;
    wsT.getRow(r).values = ['Summe', '', '', ...[4, 5, 6, 7].map(c => ({ formula: `SUM(${wsT.getColumn(c).letter}5:${wsT.getColumn(c).letter}${r - 1})` }))];
    wsT.getRow(r).font = { bold: true };
  }
  [30, 18, 34, 11, 11, 16, 11, 26].forEach((w, i) => { wsT.getColumn(i + 1).width = w; });
  [4, 5, 6, 7].forEach(c => { wsT.getColumn(c).numFmt = EURO; });

  return wb;
}

module.exports = { buildWorkbook };
