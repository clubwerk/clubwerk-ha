'use strict';
/**
 * Excel-Ausgabe für alle Exporte (Erweiterungen: ctx.xlsx): Mappe, Blatt mit fetter Kopfzeile, Versand als Download.
 * Die Übersetzung der Texte macht der Kern beim Schreiben (src/i18n.js), hier ist nichts dafür nötig.
 *
 *   const wb = xlsx.book();
 *   const ws = xlsx.sheet(wb, 'Mitglieder', [{ header: 'Name', width: 28 }, …], rows, { freeze: true });   // rows: Listen oder Objekte (mit key)
 *   ws.addRow([…]).font = { bold: true };                                                                   // weitere Zeilen und Formate wie in exceljs
 *   await xlsx.send(res, 'Mitglieder.xlsx', wb);                                                            // oder: const buf = await xlsx.buffer(wb);
 */
const ExcelJS = require('exceljs');

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const book = () => new ExcelJS.Workbook();

/** Blatt mit Spalten ([{ header, key?, width }]); gibt es Spaltenköpfe, ist die erste Zeile fett (freeze: und bleibt beim Scrollen stehen) */
function sheet(wb, name, columns, rows = [], { freeze = false } = {}) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns;
  if (columns.some(c => c.header)) ws.getRow(1).font = { bold: true };
  if (freeze) ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const r of rows) ws.addRow(r);
  return ws;
}

/** Text so schützen, dass Excel ihn nie als Formel ausführt (Zeilen, die mit = + - @ beginnen) */
const safe = v => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);

const buffer = async wb => Buffer.from(await wb.xlsx.writeBuffer());
/** Mappe als Download senden */
async function send(res, filename, wb) {
  res.set({ 'Content-Type': MIME, 'Content-Disposition': `attachment; filename="${filename}"` }).send(await buffer(wb));
}

module.exports = { MIME, book, sheet, safe, buffer, send };
