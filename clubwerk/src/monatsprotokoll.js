'use strict';
/* Monatsprotokoll der Geräte-Module (Zugang, Beregnung, Flutlicht): Monat wählen, Monatsliste, Excel-Auszug zum Herunterladen
   und – auf Wunsch – als lesbarer Auszug des laufenden Monats in der nächtlichen Datensicherung (Hook backupExports). */
const { pad } = require('./util');

/** '2026-12' → '2027-01' */
const nextMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`; };
/** Monat aus der Anfrage (?month=JJJJ-MM) oder def */
const monat = (q, def) => (/^\d{4}-\d{2}$/.test(String(q)) ? String(q) : def);

/**
 * Richtet GET /log und GET /log.xlsx ein.
 * @param {object} o
 *   perm      Rechte-Prüfung (Middleware)
 *   cur()     laufender Monat 'JJJJ-MM'
 *   months()  Monate mit Einträgen, neueste zuerst (der laufende kommt immer dazu)
 *   rows(m)   Einträge des Monats, neueste zuerst
 *   start(cur, months)  Monat ohne Wahl (sonst der laufende)
 *   mehr(m)   weitere Felder für /log; gelesen() wird bei jedem Aufruf von /log ausgeführt
 *   sheet(m), file(m), columns, row(r)  Excel: Blattname, Dateiname, Spalten, Zeile je Eintrag (älteste zuerst)
 *   backup(m) Dateiname in der nächtlichen Sicherung (ohne: keine)
 */
function einrichten(ctx, admin, o) {
  admin.get('/log', o.perm, (req, res) => {
    const months = o.months(), cur = o.cur();
    if (!months.includes(cur)) months.unshift(cur);
    const m = monat(req.query.month, o.start ? o.start(cur, months) : cur);
    if (o.gelesen) o.gelesen();
    res.json({ month: m, months, rows: o.rows(m), ...(o.mehr ? o.mehr(m) : {}) });
  });
  async function xlsx(m) {
    const ExcelJS = ctx.require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(o.sheet(m));
    ws.columns = o.columns;
    ws.getRow(1).font = { bold: true };
    for (const r of o.rows(m).reverse()) ws.addRow(o.row(r));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  if (o.backup) ctx.hooks.backupExports = async () => { const m = o.cur(); return [{ name: o.backup(m), buffer: await xlsx(m) }]; };
  admin.get('/log.xlsx', o.perm, async (req, res) => {
    const m = monat(req.query.month, o.cur());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${o.file(m)}"`);
    res.end(await xlsx(m));
  });
}

module.exports = { nextMonth, monat, einrichten };
