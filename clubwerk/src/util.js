'use strict';
/**
 * Gemeinsame kleine Helfer für Kern und Erweiterungen (Datum, Zeit, Geld, HTML).
 * Erweiterungen bekommen sie als `ctx.util`; die mitgelieferten Module binden sie direkt ein (require('../../src/util')).
 *
 * Datums-/Zeitkonvention (siehe ERWEITERUNGEN.md → „Datums-/Zeitformate“):
 *  - Fachliche Zeitpunkte und Tage stehen in der Datenbank in lokaler Zeit ohne Zonenangabe: 'JJJJ-MM-TT' bzw. 'JJJJ-MM-TT HH:MM:SS'
 *    (wie SQLites datetime('now','localtime')). today()/nowTs() liefern genau dieses Format.
 *  - Millisekunden seit 1970 (Date.now()) nur für Zeitgeber und Sperren (z. B. irr_steps, locked_until bei Geräten).
 */
const pad = (n, len = 2) => String(n).padStart(len, '0');
/** heutiges Datum in lokaler Zeit: 'JJJJ-MM-TT' */
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
/** Zeitstempel in lokaler Zeit: 'JJJJ-MM-TT HH:MM:SS' (optional für ein bestimmtes Date-Objekt) */
const nowTs = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
/** Zeitstempel für Dateinamen: 'JJJJ-MM-TT_HHMMSS' (lokale Zeit) */
const fileStamp = (d = new Date()) => nowTs(d).replace(' ', '_').replace(/:/g, '');
/** gültiges Datum 'JJJJ-MM-TT' (Form und Kalender, z. B. kein 2024-13-45)? */
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
/** Tage zu einem Datum 'JJJJ-MM-TT' addieren (negativ = zurück) – kalenderrein, ohne Zeitzonen-/Sommerzeiteffekte */
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Monate zu einem Datum 'JJJJ-MM-TT' addieren (negativ = zurück); fehlt der Tag im Zielmonat, gilt dessen letzter Tag */
const addMonths = (s, n) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(d, last)); return t.toISOString().slice(0, 10); };
/** 'JJJJ-MM-TT…' → 'TT.MM.JJJJ'; leer → ''; alles andere unverändert als Text */
const deD = s => (s == null || s === '' ? '' : /^\d{4}-\d{2}-\d{2}/.test(String(s)) ? `${String(s).slice(8, 10)}.${String(s).slice(5, 7)}.${String(s).slice(0, 4)}` : String(s));
/** Cent → '1.234,56 €' (deutsches Währungsformat) */
const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
/** HTML-Sonderzeichen entschärfen (null/undefined → '') */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** ZIP vor dem Entpacken prüfen (gegen „ZIP-Bomben“ und Pfad-Tricks): angegebene Gesamtgröße und erster unsicherer Pfad */
const zipSize = files => files.reduce((a, f) => a + ((f._data && f._data.uncompressedSize) || 0), 0);
const zipUnsafe = zip => Object.values(zip.files).find(f => f.unsafeOriginalName && f.unsafeOriginalName !== f.name);
/** Entpacken mit Obergrenze: Die Größenangaben im ZIP (zipSize) kann der Ersteller fälschen – deshalb beim Entpacken mitzählen und
 *  abbrechen, sobald das gemeinsame Kontingent aller Dateien (max Bytes) überschritten ist. read(f, 'string'|'nodebuffer') */
function zipBudget(max, msg = 'Das ZIP-Archiv ist zu groß.') {
  let left = max;
  return {
    read: (f, as = 'nodebuffer') => new Promise((resolve, reject) => {
      const parts = []; let done = false;
      const h = f.internalStream('uint8array');
      const stop = e => { if (!done) { done = true; try { h.pause(); } catch (x) { /* */ } reject(e); } };
      h.on('data', d => { if (done) return; left -= d.length; if (left < 0) return stop(Object.assign(new Error(msg), { tooBig: true })); parts.push(Buffer.from(d.buffer, d.byteOffset, d.length)); })
        .on('error', stop)
        .on('end', () => { if (done) return; done = true; const b = Buffer.concat(parts); resolve(as === 'string' ? b.toString('utf8') : b); })
        .resume();
    }),
  };
}
/** Satzende anhängen, außer der Text endet schon auf „.“ (z. B. Vereinsname „… e. V.“) – nie „..“ */
const endDot = s => { const t = String(s == null ? '' : s).replace(/\s+$/, ''); return /[.!?]$/.test(t) ? t : t + '.'; };
module.exports = { endDot, pad, today, nowTs, fileStamp, isDate, addDays, addMonths, deD, euro, esc, zipSize, zipUnsafe, zipBudget };
