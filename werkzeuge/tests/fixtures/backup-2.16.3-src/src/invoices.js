'use strict';
/**
 * Rechnungen und Lieferscheine einlesen.
 *  - PDF mit Textebene (Spalten „Art-Nr Artikel …“): Positionen werden automatisch erkannt.
 *  - Lidl-Kassenbon (Screenshot aus Lidl Plus, Foto oder PDF): Text per Bilderkennung (tesseract),
 *    Positionen mit Gegenrechnung Preis × Menge, damit Lesefehler auffallen.
 *  - Sonstige Fotos: werden gespeichert, Positionen trägt man von Hand ein.
 */
const { execFile } = require('child_process');
const fs = require('fs');

const IGNORE_RE = /pauschale|fracht|porto|versand|pfand|leergut|gutschein|rabatt|reiniger|allzweck|sp[üu]lmittel|tüte|tragetasche/i;

function pdfToText(file) {
  return new Promise(resolve => {
    execFile('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], { maxBuffer: 10 * 1024 * 1024, timeout: 20000 },
      (err, stdout) => resolve(err ? '' : stdout));
  });
}

/** Bilderkennung für Fotos/Screenshots. Liefert '' wenn tesseract fehlt oder nichts erkennt. */
let OCR_LANG = null;
function ocrLang() {
  if (OCR_LANG !== null) return Promise.resolve(OCR_LANG);
  return new Promise(resolve => execFile('tesseract', ['--list-langs'], { timeout: 10000 }, (err, out, errOut) => {
    const langs = String(out || '') + String(errOut || '');
    OCR_LANG = err && !langs ? '' : ['deu', 'eng'].filter(l => new RegExp('^' + l + '$', 'm').test(langs)).join('+');
    resolve(OCR_LANG);
  }));
}
async function imageToText(file) {
  const lang = await ocrLang();
  if (!lang) return '';
  return new Promise(resolve => {
    execFile('tesseract', [file, '-', '-l', lang, '--psm', '6'], { maxBuffer: 10 * 1024 * 1024, timeout: 90000 },
      (err, stdout) => resolve(err ? '' : stdout));
  });
}

/** Fotografierte/gescannte PDFs (ohne Textebene): Seiten als Bild rendern und per Bilderkennung lesen.
 *  Schmale, lange Seiten (Kassenbon) werden auf ~1000 px Breite gebracht – damit liest tesseract Bon-Schrift am besten. */
function run(cmd, args, timeout = 60000) {
  return new Promise(resolve => execFile(cmd, args, { maxBuffer: 20 * 1024 * 1024, timeout }, (err, out) => resolve(err ? '' : String(out))));
}
async function scannedPdfToText(file) {
  const info = await run('pdfinfo', [file], 15000);
  const pages = Math.min(5, Number((info.match(/Pages:\s+(\d+)/) || [])[1]) || 1);
  const sz = info.match(/Page size:\s+([\d.]+)\s+x\s+([\d.]+)/);
  const receipt = sz && Number(sz[2]) / Number(sz[1]) > 2;
  const os = require('os'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beleg-'));
  try {
    const args = receipt ? ['-scale-to-x', '1000', '-scale-to-y', '-1'] : ['-r', '300'];
    await run('pdftoppm', [...args, '-gray', '-png', '-f', '1', '-l', String(pages), file, path.join(dir, 'p')], 120000);
    let text = '';
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.png')).sort()) text += await imageToText(path.join(dir, f)) + '\n';
    return text;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const cents = s => Math.round(Number(String(s).replace(/\./g, '').replace(',', '.')) * 100);
const isoDate = (d, m, y) => `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

/** Gebindegröße aus dem Artikeltext, z. B. "20/0,5" → 20, "12x0,7" → 12. */
function packFromText(t) {
  const m = t.match(/\b(\d{1,2})\s*[/x×]\s*0?[,.]\d+/i);
  return m ? Number(m[1]) : 1;
}

function detectSupplier(text) {
  if (/lidl\.de|\bL[iI1l]DL\b|LDL-\d|Lidl/.test(text)) return 'Lidl';
  const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).slice(0, 25);
  // Firmenname: „Getränke …“, „… GmbH/KG/e.K.“, sonst die erste Zeile, die nach Wörtern aussieht (OCR-Rauschen überspringen)
  const firm = lines.find(l => /getr[äa]nke\s+\w{3,}|\b(gmbh|kg|e\.\s?k\.|ohg|ag|markt|handel)\b/i.test(l));
  if (firm) return firm.replace(/[^\wäöüÄÖÜß&.,' -]/g, '').trim().slice(0, 60);
  const first = lines.find(l => (l.match(/[a-zäöüß]{3,}/gi) || []).join('').length >= 6);
  return first ? first.slice(0, 60) : 'Unbekannt';
}

/** Liest Kopf und Positionen aus dem Text einer Rechnung. */
function parseInvoiceText(text) {
  const out = { supplier: detectSupplier(text), docNo: null, docKind: 'rechnung', date: null, deliveryDate: null, total_cents: null, lines: [] };
  if (/^\s*Gutschrift\s*$/mi.test(text)) out.docKind = 'gutschrift';

  let m = text.match(/Rechn(?:ungs)?[.-]?\s*-?Nr\.?\s*:?\s*([\w/-]+)\s+vom\s+(\d{1,2})\.(\d{1,2})\.(\d{2,4})/i);
  if (m) { out.docNo = m[1]; out.date = isoDate(m[2], m[3], m[4]); }
  m = text.match(/LS-?Nr\.?\s*:?\s*([\w/-]+)\s+vom\s+(\d{1,2})\.(\d{1,2})\.(\d{2,4})/i);
  if (m) { out.deliveryDate = isoDate(m[2], m[3], m[4]); if (!out.docNo) out.docNo = 'LS ' + m[1]; }
  if (!out.date) {
    m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) out.date = isoDate(m[1], m[2], m[3]);
  }
  m = text.match(/Rechnungsbetrag:[\s\S]{0,200}?(-?[\d.]+,\d{2})\s*EUR/i) || text.match(/(?:Endsumme|Gesamtbetrag|Summe)\D{0,20}(-?[\d.]+,\d{2})/i);
  if (m) out.total_cents = cents(m[1]);

  // Positionen: nur der Warenblock bis zur Leergutabrechnung
  const lines = text.split('\n');
  let inItems = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/Art-?Nr\.?\s+Artikel/i.test(raw)) { inItems = true; continue; }
    if (/Leergut|Ware:\s|Rechnungsbetrag/i.test(raw)) { if (inItems) break; continue; }
    if (!inItems) continue;
    // "  2144 Musterbr Helles 20/0,33-€       6   16,90  101,40"
    // "3060    E Quelle naturell 12/0,7   -7    0,25   -1,75"   (E = Einzelflaschen, z. B. Bruch)
    const p = raw.match(/^\s*(\d{3,6})\s+(?:([A-Z])\s+)?(.+?)\s{2,}(-?\d+)\s+(-?[\d.]+,\d{2})\s+(-?[\d.]+,\d{2})\s*$/);
    if (!p) continue;
    const [, artNo, flag, name, qty, ep, gp] = p;
    const note = (lines[i + 1] || '').trim();
    const single = flag === 'E';
    out.lines.push({
      artNo,
      text: name.replace(/\s+/g, ' ').trim(),
      qty: Number(qty),
      single,                                  // Menge sind Einzelflaschen statt Kisten
      packSize: packFromText(name),
      unit_cents: cents(ep),
      line_cents: cents(gp),
      note: single && /bruch/i.test(note) ? 'Bruch' : (single ? 'Einzelflaschen' : ''),
    });
  }
  return out;
}


/* ---------- Lidl-Kassenbon ---------- */
const num2 = s => cents(String(s).replace(/[oO]/g, '0').replace(/[^\d,-]/g, ''));
/** Schlüssel für „gemerkte Zuordnung“: Lidl druckt keine Artikelnummern, also der bereinigte Text. */
const textKey = t => 'lidl:' + String(t).toLowerCase().replace(/[^a-zäöüß0-9]/g, '').slice(0, 40);

function parseLidlText(text) {
  const out = { supplier: 'Lidl', docNo: null, docKind: 'kassenbon', date: null, deliveryDate: null, total_cents: null, lines: [], check: null };
  let m = text.match(/(\d{2})\.(\d{2})\.(\d{2,4})\s+\d{1,2}:\d{2}/);
  if (m) out.date = isoDate(m[1], m[2], m[3]);
  m = text.match(/TSE[- ]?Transaktions(?:nummer|nr)\.?\s*:?\s*(\d+)/i);
  if (m) out.docNo = 'TSE ' + m[1];
  else if ((m = text.match(/^\s*(\d{4})\s+(\d{4,7}\/\d{1,3})\s/m))) out.docNo = `${m[1]}-${m[2]}`;
  m = text.match(/zu\s*zahlen\s+(-?\d+[,.]\d{2})/i) || text.match(/\bSumme\s+(-?\d+[,.]\d{2})\s*$/mi);
  if (m) out.total_cents = num2(m[1].replace('.', ','));

  const lines = text.split('\n');
  let started = false;
  for (const raw0 of lines) {
    const raw = raw0.replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    if (/^EUR$/i.test(raw)) { started = true; continue; }
    if (/^-{5,}|zu\s*zahlen|^summe\b|^bar\b|^karte\b|^mwst/i.test(raw)) { if (started || out.lines.length) break; continue; }
    // "Iso Sport Grapefruit 3,69 x 5 18,45 B"
    let p = raw.match(/^(.+?)\s+(-?\d+[,.]\d{2})\s*[x×*]\s*(\d+)\s+(-?[\d,.]+)\s*[A-Z]?$/);
    let name, unit, qty, total;
    if (p) { [, name, unit, qty, total] = p; unit = num2(unit.replace('.', ',')); qty = Number(p[3]); total = num2(total.replace('.', ',')); }
    else {
      // "Allzweckr.Zitronenfr 1,39 B"   oder Rabatt "Preisvorteil -0,50"
      p = raw.match(/^(.+?)\s+(-?\d+[,.]\d{2})\s*[A-Z]?$/);
      if (!p || /^\d/.test(p[1])) { if (out.lines.length && !started) started = true; continue; }
      [, name] = p; qty = 1; unit = num2(p[2].replace('.', ',')); total = unit;
      if (unit < 0 && out.lines.length && /rabatt|vorteil|preisvort|coupon|aktion|lidl\s*plus|nachlass/i.test(name)) {
        const prev = out.lines[out.lines.length - 1];
        prev.line_cents += unit; prev.note = (prev.note ? prev.note + ' · ' : '') + 'Rabatt ' + (unit / 100).toFixed(2).replace('.', ',') + ' €';
        continue;
      }
    }
    started = true;
    name = name.replace(/\s+/g, ' ').trim();
    // Pfandzeile direkt unter einem Getränk: Einwegpfand 0,25 € je Flasche → Flaschen je Packung
    const prev = out.lines[out.lines.length - 1];
    if (/^pfand\b/i.test(name) && prev && !/^pfand/i.test(prev.text) && prev.qty === qty && unit > 0 && unit % 25 === 0 && unit / 25 > 1) {
      prev.packSize = unit / 25;
      prev.packFromDeposit = true;
    }
    const calc = unit * qty;
    let note = '';
    if (total !== calc) { note = 'Betrag nachgerechnet'; total = calc; }
    out.lines.push({ artNo: textKey(name), text: name, qty, single: false, packSize: packFromText(name), unit_cents: unit,
      line_cents: total, note, unitLabel: p && p.length === 5 ? 'Pack' : 'Stk.', noArtNo: true });
  }
  const sum = out.lines.reduce((t, l) => t + l.line_cents, 0);
  if (out.total_cents != null) out.check = { sum_cents: sum, ok: sum === out.total_cents };
  return out;
}

/* ---------- Allgemeiner Leser für unbekannte Lieferanten (Rechnung oder Kassenbon) ----------
   Nimmt nur Positionen sicher, bei denen Menge × Einzelpreis = Gesamtpreis aufgeht. Alles andere wird
   als „bitte prüfen“ markiert statt geraten. Pfand-/Leerkistenzeilen bleiben als (ignorierte) Positionen
   erhalten, damit die Summe gegen die Endsumme geprüft werden kann, und verraten die Flaschen je Kiste. */
const OCR_DIGIT = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', i: '1', '|': '1', ']': '1', '[': '1', '!': '1', Z: '2', z: '2', S: '5', B: '8', g: '9' };
const fixNum = t => String(t).replace(/[OoDQIli|\][!ZzSBg]/g, c => OCR_DIGIT[c]);
/** Betrag aus OCR-Text: "21,99" "21.99" "1.234,50" "21.39" → Cent oder null */
function money(t) {
  let s = fixNum(t).replace(/[^\d,.-]/g, '');
  if (/[.,]\d{3}$/.test(s) && !/[.,]\d{3}[.,]/.test(s)) s = s.slice(0, -1);   // angehängtes Steuerkennzeichen: "22.001" = 22,00 + „1“
  const m = s.match(/^(-?)(\d{1,3}(?:[.,]?\d{3})*|\d+)[,.](\d{2})$/);
  if (!m) return null;
  return (m[1] ? -1 : 1) * (Number(m[2].replace(/[.,]/g, '')) * 100 + Number(m[3]));
}
const STOP_RE = /summ+e\b|nd\s?s\S?m+e|gesamt(betrag|summe)?\b|zu\s*zahlen|rechnungsbetrag|netto|brutto|mwst|kartenzahlung|bar\s*gegeben|^davon\b/i;
const DEPOSIT_RE = /pfand|p[fr]an[dafi]\s?f?\s?l|leergut|leer\s?kiste|kiste\s*leer|r[üu]ckpf|f\s?lasche\s*\d+\s*[x×%]/i;
/** Erstes Wort als Artikelnummer, wenn es nach Korrektur typischer Lesefehler fast nur aus Ziffern besteht */
function artToken(tok) {
  const t = fixNum(tok.replace(/^#/, '')).replace(/[uU]/g, '0').replace(/s/g, '5').replace(/b/g, '6').replace(/[:.]/g, '');
  const digits = (t.match(/\d/g) || []).length;
  return t.length >= 4 && t.length <= 9 && digits / t.length >= 0.7 ? t.replace(/\D/g, '') : '';
}

/** Pfand-/Leerkistenzeile: „Pfandflasche 40x0,08“ → { count: 40, cents: 320 } (Betrag aus der Zeile selbst errechnet) */
function depositInfo(s) {
  const m = fixNum(s).replace(/\s+(?=[.,]\d)/g, '').match(/(\d{1,3})\s*[xX×*%]\s*(\d{1,2})[.,]\s?(\d{2})/);
  return m ? { count: Number(m[1]), cents: Number(m[1]) * (Number(m[2]) * 100 + Number(m[3])) } : null;
}

function parseGenericText(text, supplier) {
  const out = { supplier: supplier || '', docNo: null, docKind: 'rechnung', date: null, deliveryDate: null, total_cents: null, lines: [], check: null };
  let m = text.match(/(?:Rechnung(?:s)?|Rechn|Beleg|Bon|Lieferschein)[\s.-]*(?:Nr|nummer)\.?\s*:?\s*([\w/-]{3,})/i);
  if (m) out.docNo = m[1];
  m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) out.date = isoDate(m[1], m[2], m[3]);
  if (/kassenbon|kartenzahlung|bar\s*gegeben|payback|tse/i.test(text)) out.docKind = 'kassenbon';
  m = text.match(/(?:s[uıi]m+e|nds\S?m+e|Gesamtbetrag|Rechnungsbetrag|zu\s*zahlen)[^\d\n]{0,25}?(-?[\dOoIl]+[.,]\s?\d{2,3})/i);
  if (m) out.total_cents = money(m[1].replace(/\s/g, ''));

  let unparsed = null;          // Artikelzeile mit Nummer, aber ohne lesbaren Betrag
  let pending = null;           // aus einer Zeile "2x 20er KASTEN à 15,99" bzw. "2 KAS."
  for (const raw0 of text.split('\n')) {
    const raw = raw0.replace(/[‚„“”"']/g, '').replace(/\s+/g, ' ').trim();
    if (raw.length < 4) continue;
    if (STOP_RE.test(raw) && out.lines.length) break;
    // Kopfzeile mit Menge und Einzelpreis: "2x 20er KASTEN à 15.99", "4x 12er Kasten a 3,49"
    let h = raw.match(/^([\dIlZi|]{1,3})\s*[xX×%*]\s*(?:([\dZIluU]{1,3})\s*er\b)?.*?\s[aà&@4]\s*([\dOoIl]+[.,]\d{2})\s*$/i)
      || (/kast|kist/i.test(raw) && raw.match(/^([\dIlZi|]{1,3})\s*[xX×%*]\s*(?:([\dZIluU]{1,3})\s*er\b)?.*?\s([\dOoIl]+[.,]\d{2})\s*$/i));
    if (h && /kast|kist|pack|ka\.|fl|stk|tray|er\b/i.test(raw)) {
      const qty = Number(fixNum(h[1])); const unit = money(h[3]);
      const pack = h[2] ? Number(fixNum(h[2]).replace(/[uU]/g, '0')) : 0;
      if (qty > 0 && unit) { pending = { qty, unit, pack: pack >= 2 && pack <= 50 ? pack : 0 }; continue; }
    }
    h = raw.match(/^([\dIlZ]{1,2})\s+[A-Za-z]{0,2}(?:AS|ST|ISTEN|ÄSTEN|ASTEN)\b\.?/i);
    if (h) { pending = { qty: Number(fixNum(h[1])), unit: null, pack: 0 }; continue; }
    // Preisänderung zur vorigen Position: "Senkung von 19.99 auf 11.00 22.00"
    h = raw.match(/(?:senkung|erh[öo]hung|rabatt).*?auf\s+([\dOoIl.,]+)\s+([\dOoIl.,]+)/i);
    if (h && unparsed && pending) {
      // Artikelzeile ohne lesbaren Betrag direkt davor („… Radler 0,50L“), Preis steht erst in der Senkungszeile
      const unit = money(h[1]), total = money(h[2]);
      if (unit && total && pending.qty * unit === total) {
        out.lines.push({ artNo: unparsed.artNo || textKey(unparsed.name), text: unparsed.name, qty: pending.qty, single: false, packSize: pending.pack || packFromText(unparsed.name),
          unit_cents: unit, line_cents: total, note: 'Sonderpreis', checked: true, noArtNo: !unparsed.artNo, unitLabel: 'Kiste' });
        pending = null; unparsed = null; continue;
      }
    }
    if (h && out.lines.length) {
      const last = out.lines[out.lines.length - 1]; const unit = money(h[1]); const total = money(h[2]);
      if (unit && total && last.qty * unit === total) { last.unit_cents = unit; last.line_cents = total; last.checked = true; last.note = 'Sonderpreis'; }
      continue;
    }
    // Position: [Art.-Nr.] Text … [Menge] [Einzelpreis] Gesamt [Steuerkennz.]
    // optionale Positionsnummer („1  4711 Krombacher …“) überspringen
    const pos = raw.match(/^(\d{1,3})\s+(?=\S{4,9}\s)/);
    const line = pos && artToken(raw.slice(pos[0].length).split(' ')[0]) ? raw.slice(pos[0].length) : raw;
    const first = line.split(' ')[0];
    const artNo = artToken(first);
    const rest = artNo ? line.slice(first.length).trim() : line;
    const p = rest.match(/^(.+?)\s+((?:-?[\dOoIl]+\s+)?(?:-?[\dOoIl.,]+[.,]\d{2}\s+)?)(-?[\dOoIl.,]+[.,]\s?\d{2,3})\s*[A-Z1-9|\]I]?$/);
    if (DEPOSIT_RE.test(rest) && (!p || money(p[3].replace(/\s/g, '')) == null)) {
      // Pfandzeile mit unlesbarem Betrag: aus „Anzahl × Pfand“ rechnen (lesbare Beträge haben Vorrang)
      const d = depositInfo(rest);
      const prev = [...out.lines].reverse().find(l => !l.deposit);
      if (d) {
        if (prev && /f\s?lasch|p[fr]an[dafi]/i.test(rest) && !/kiste/i.test(rest) && prev.qty > 0 && d.count % prev.qty === 0 && d.count / prev.qty > 1) {
          prev.packSize = d.count / prev.qty; prev.packFromDeposit = true;
        }
        const nm = rest.replace(/\s+[\dOoIl.,|\]:]+\s*\S?$/, '').trim();
        out.lines.push({ artNo: artNo || textKey(nm), text: nm, qty: 1, single: false, packSize: 1, unit_cents: d.cents, line_cents: d.cents,
          note: 'Pfand nachgerechnet', deposit: true, checked: true, noArtNo: !artNo });
        continue;
      }
    }
    if (!p) { if (artNo && /[a-zäöü]{3,}/i.test(rest) && !DEPOSIT_RE.test(rest)) unparsed = { artNo, name: rest.replace(/\s+[=|\]].*$/, '').trim() }; continue; }
    unparsed = null;
    p.splice(1, 0, null);
    let name = p[2].replace(/^#\S+\s+/, '').replace(/\s+/g, ' ').trim();
    const total = money(p[4].replace(/\s/g, ''));
    if (total == null || !/[a-zäöü]{3,}/i.test(name)) continue;
    const mid = p[3].trim().split(/\s+/).filter(Boolean);
    let qty = 1, unit = null, checked = false;
    if (mid.length === 2) { qty = Number(fixNum(mid[0])); unit = money(mid[1]); }
    else if (mid.length === 1 && /[.,]\d{2}$/.test(mid[0])) unit = money(mid[0]);
    else if (mid.length === 1) qty = Number(fixNum(mid[0]));
    const deposit = DEPOSIT_RE.test(name);
    if (!deposit && pending) {
      qty = pending.qty; unit = pending.unit || (total % pending.qty === 0 ? total / pending.qty : null);
    }
    if (unit && qty > 0 && Math.abs(unit * qty - total) <= 1) checked = true;
    else if (!unit && qty === 1 && artNo && !deposit && !pending) { unit = total; checked = false; }
    if (deposit) {
      // "Pfandflasche 40x0,08" → 40 Flaschen; geteilt durch Kisten der Position darüber = Flaschen je Kiste
      const prev = [...out.lines].reverse().find(l => !l.deposit);
      const b = fixNum(name).match(/(\d{1,3})\s*[xX×*%]\s*\d/);
      if (prev && b && /f\s?lasch|p[fr]an[dafi]/i.test(name) && !/kiste/i.test(name)) {
        const bottles = Number(b[1]);
        if (prev.qty > 0 && bottles % prev.qty === 0 && bottles / prev.qty > 1) { prev.packSize = bottles / prev.qty; prev.packFromDeposit = true; }
      }
      out.lines.push({ artNo: artNo || textKey(name), text: name, qty: 1, single: false, packSize: 1, unit_cents: total, line_cents: total,
        note: '', deposit: true, checked: true, noArtNo: !artNo });
      continue;
    }
    if (!unit) unit = total;
    const usedPending = Boolean(pending);
    out.lines.push({ artNo: artNo || textKey(name), text: name, qty, single: false,
      packSize: (pending && pending.pack) || packFromText(name), unit_cents: unit, line_cents: total,
      note: checked ? '' : 'bitte Menge/Preis prüfen', checked, noArtNo: !artNo, unitLabel: usedPending ? 'Kiste' : 'Stk.' });
    pending = null;
  }
  const sum = out.lines.reduce((t, l) => t + l.line_cents, 0);
  if (out.total_cents != null && out.lines.length) out.check = { sum_cents: sum, ok: Math.abs(sum - out.total_cents) <= 1 };
  return out;
}

/* ---------- Vorschlag: welcher App-Artikel passt? ---------- */
const ALIASES = [
  [/alkfrei|\baf\b/g, 'alkoholfrei'],
  [/coca[- ]?cola/g, 'cola'], [/isosport|iso-sport/g, 'iso sport'], [/apfelschorle/g, 'apfel schorle'], [/wei(ss|ß)bier/g, 'weizen'], [/-€/g, ''],
];
function tokens(s) {
  let t = String(s).toLowerCase();
  for (const [re, rep] of ALIASES) t = t.replace(re, rep);
  t = t.replace(/\d+\s*[/x×]\s*\d*[,.]?\d+/g, ' ').replace(/[^a-zäöüß0-9 ]/g, ' ');
  return new Set(t.split(/\s+/).filter(w => w.length > 1 && !/^\d+$/.test(w)));
}
function score(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach(w => { if (B.has(w)) hit += 1; });
  // "alkoholfrei"/"zero" müssen zusammenpassen, sonst landet Helles alkoholfrei bei Helles
  for (const key of ['alkoholfrei', 'zero', 'radler', 'orange', 'zitrone', 'medium', 'naturell', 'sprudel']) {
    if (A.has(key) !== B.has(key)) hit -= 1;
  }
  return hit / Math.max(A.size, B.size);
}

function suggest(db, supplier, line, articles) {
  const known = db.prepare('SELECT * FROM supplier_map WHERE supplier = ? AND art_no = ?').get(supplier, line.artNo);
  if (known) return { articleId: known.article_id, ignore: known.article_id === null, packSize: line.packFromDeposit ? line.packSize : known.pack_size, source: 'gemerkt' };
  if (line.deposit || IGNORE_RE.test(line.text)) return { articleId: null, ignore: true, packSize: 1, source: 'automatisch' };
  let best = null, bestScore = 0;
  for (const a of articles) {
    const s = score(line.text, a.name);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  if (best && bestScore >= 0.5) {
    return { articleId: best.id, ignore: false, packSize: line.packSize > 1 ? line.packSize : best.crate_size, source: 'vorschlag' };
  }
  return { articleId: null, ignore: false, packSize: line.packSize, source: 'offen' };
}

async function readUpload(db, file, mime) {
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(file);
  const isOcrable = /^image\/(png|jpeg|webp)$/.test(mime) || /\.(png|jpe?g|webp)$/i.test(file);
  let text = isPdf ? await pdfToText(file) : '';
  let ocr = false;
  if (!text.trim() && isOcrable) { text = await imageToText(file); ocr = Boolean(text.trim()); }
  if (!text.trim() && isPdf) { text = await scannedPdfToText(file); ocr = Boolean(text.trim()); }
  const empty = { supplier: '', docNo: null, docKind: 'lieferung', date: null, deliveryDate: null, total_cents: null, lines: [] };
  let parsed = empty;
  if (text.trim()) {
    const sup = detectSupplier(text);
    if (sup === 'Lidl') parsed = parseLidlText(text);
    else {
      // bekanntes Rechnungsformat zuerst, sonst der allgemeine Leser mit Selbstkontrolle (Menge × Preis = Betrag)
      if (!ocr) parsed = parseInvoiceText(text);
      if (!parsed.lines.length) {
        const g = parseGenericText(text, sup === 'Unbekannt' ? '' : sup);
        parsed = { ...g, docNo: parsed.docNo || g.docNo, date: parsed.date || g.date, total_cents: parsed.total_cents ?? g.total_cents };
        if (g.check && parsed.total_cents != null) parsed.check = { sum_cents: g.check.sum_cents, ok: Math.abs(g.check.sum_cents - parsed.total_cents) <= 1 };
      }
    }
  }
  const articles = db.prepare('SELECT id, name, crate_size FROM articles WHERE active = 1 AND deleted = 0 ORDER BY cat_rank(category), de_key(category), de_key(name)').all();
  parsed.lines = parsed.lines.map(l => ({ ...l, ...suggest(db, parsed.supplier, l, articles) }));
  parsed.allChecked = parsed.lines.filter(l => !l.deposit).every(l => l.checked !== false);
  parsed.hasText = Boolean(text.trim());
  parsed.ocr = ocr;
  parsed.isImage = !isPdf;
  if (parsed.docNo) {
    const dup = db.prepare('SELECT id, date FROM deliveries WHERE supplier = ? AND doc_no = ?').get(parsed.supplier, parsed.docNo);
    if (dup) parsed.duplicateOf = dup;
  }
  return parsed;
}

function removeFile(f) { try { fs.unlinkSync(f); } catch (e) { /* schon weg */ } }

module.exports = { readUpload, parseInvoiceText, parseLidlText, parseGenericText, pdfToText, imageToText, removeFile };
