'use strict';
/**
 * QR-Code für Überweisungen nach dem EPC-Standard (EPC069-12, Version 002) – in Deutschland als „GiroCode“ bekannt.
 * Die Banking-App liest Empfänger, IBAN, Betrag und Verwendungszweck aus dem Code; nichts geht ins Internet.
 *
 *   payload({ name, iban, bic, cents, text }) → Text für den QR-Code oder null (keine gültige IBAN, Betrag ≤ 0)
 *   pdf(doc, text, x, y, size)                → zeichnet den Code als Vektor in ein PDFKit-Dokument
 *   svg(text)                                 → SVG für Verwaltung und App
 */
const qr = () => require('qrcode');   // erst bei Bedarf laden (Speicher der Demo-Kopie)

const MAX_CENTS = 99999999999;   // 999.999.999,99 € – Obergrenze des Standards
const clip = (s, n) => String(s || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

function ibanOk(i) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(i)) return false;
  const r = (i.slice(4) + i.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let m = 0; for (const d of r) m = (m * 10 + Number(d)) % 97;
  return m === 1;
}

function payload({ name, iban, bic, cents, text } = {}) {
  const i = String(iban || '').replace(/\s+/g, '').toUpperCase();
  const c = Math.round(Number(cents));
  const n = clip(name, 70);
  if (!ibanOk(i) || !n || !Number.isFinite(c) || c <= 0 || c > MAX_CENTS) return null;
  const b = String(bic || '').replace(/\s+/g, '').toUpperCase();
  const amount = `EUR${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
  // Reihenfolge laut Standard: Kennung, Version, Zeichensatz (1 = UTF-8), Art, BIC, Name, IBAN, Betrag, Zweck-Code, strukturierte Referenz, Verwendungszweck
  return ['BCD', '002', '1', 'SCT', /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(b) ? b : '', n, i, amount, '', '', clip(String(text || '').replace(/\s*·\s*/g, ' / '), 140)].join('\n');   // „·“ kennt der SEPA-Zeichensatz nicht
}

const matrix = text => qr().create(text, { errorCorrectionLevel: 'M' }).modules;

/** Vektor-Zeichnung: ein Rechteck je dunklem Modul, Ruhezone muss der Aufrufer freihalten */
function pdf(doc, text, x, y, size) {
  const m = matrix(text), n = m.size, s = size / n;
  doc.save().fillColor('#000000');
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m.get(r, c)) doc.rect(x + c * s, y + r * s, s, s);
  doc.fill().restore();
}

const svg = text => qr().toString(text, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });

module.exports = { payload, pdf, svg };
