'use strict';
/* Artikelsymbole: gültige Schlüssel (aus public/artikel-icons.js) und automatische Zuordnung nach Name/Kategorie.
   Artikelbilder: im Browser auf 384 × 384 verkleinert und als WebP/PNG hochgeladen, hier nur geprüft und gespeichert. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ICONS = require('../public/artikel-icons.js');

const has = k => ICONS.has(k);

// Reihenfolge zählt: Spezielles vor Allgemeinem („Weizen alkoholfrei“ → alkoholfrei, „Balldose“ → balldose)
const RULES = [
  [/alkoholfrei|\b0[,.]0\b|null komma/, 'alkoholfrei'],
  [/weizen|hefe/, 'weizen'],
  [/radler|alster|diesel/, 'radler'],
  [/\bpils/, 'pils'],
  [/krug|ma(ß|ss)\b|\b0[,.]5\s*l?\s*bier/, 'krug'],
  [/bier|export|helles|lager|kellerbier|bock/, 'flasche'],
  [/weinschorle|riesling|schoppen|weißwein|wei(ß|ss)wein|rotwein/, 'wein'],
  [/wasser|sprudel|selters/, 'wasser'],
  [/schorle|apfel/, 'schorle'],
  [/saft|o-saft|orange|multivitamin/, 'saft'],
  [/eistee|energy|red bull|\bdose\b/, 'dose'],
  [/cola|fanta|sprite|limo|mezzo|spezi|bitter lemon|ginger|tonic|brause/, 'limo'],
  [/sekt|prosecco|secco|hugo|aperol|spritz|cr(é|e)mant/, 'sekt'],
  [/wein|riesling|ros(é|e)\b|schoppen|silvaner|dornfelder|grauburgunder|weinschorle/, 'wein'],
  [/schnaps|kurzer|j(ä|a)ger|korn|lik(ö|o)r|obstler|ouzo|vodka|wodka|whisk|rum\b|gin\b|shot/, 'kurzer'],
  [/latte|cappuccino|milchkaffee|macchiato/, 'latte'],
  [/kaffee|espresso|caf(é|e)\b/, 'kaffee'],
  [/\btee\b|kakao|schokolade hei(ß|ss)|hei(ß|ss)e schoko/, 'tee'],
  [/brat?wurst|w(ü|u)rstchen|hot ?dog|currywurst|wurst/, 'bratwurst'],
  [/brezel|breze|laugen/, 'brezel'],
  [/pommes|fritten/, 'pommes'],
  [/pizza|flammkuchen/, 'pizza'],
  [/waffel/, 'waffel'],
  [/kuchen|torte|muffin|gebäck|geb(ä|a)ck|plätzchen/, 'kuchen'],
  [/br(ö|o)tchen|frikadelle|burger|sandwich|baguette|weck|toast/, 'broetchen'],
  [/essen|steak|schnitzel|teller|gulasch|suppe|salat/, 'besteck'],
  [/chips|flips|n(ü|u)sse|erdn(ü|u)ss|salzstangen|brezeln? ?snack|cracker|popcorn/, 'chips'],
  [/schoko|snickers|mars\b|twix|riegel|kitkat|bounty|duplo|hanuta|kinder/, 'schokolade'],
  [/s(ü|u)(ß|ss)|bonbon|gummi|haribo|lutscher/, 'bonbon'],
  [/\beis\b|magnum|calippo|eis am stiel/, 'eis'],
  [/balldose|b(ä|a)lle|ballrolle|(3|4)er ?dose|dose b(ä|a)lle/, 'balldose'],
  [/tennisball|\bball\b/, 'tennisball'],
  [/griffband|overgrip|\bgrip\b/, 'griffband'],
  [/saite|besait|schl(ä|a)ger/, 'schlaeger'],
  [/gast(spiel|spieler|gebühr)?|platz(gebühr|miete)?|spielgebühr|geb(ü|u)hr/, 'platzgebuehr'],
  [/flutlicht|licht/, 'flutlicht'],
  [/halle|stunde/, 'hallenstunde'],
  [/trikot|shirt|kleidung|polo|m(ü|u)tze|\bcap\b|hoodie|jacke|handtuch/, 'trikot'],
  [/pfand/, 'pfand'],
  [/gutschein|geschenk/, 'gutschein'],
  [/startgeld|betrag|spende|beitrag|turnier|meldegeld/, 'muenze'],
];
const CATEGORY = [
  [/bier/, 'flasche'], [/wein|sekt/, 'wein'], [/schnaps|spirit/, 'kurzer'], [/soft|alkoholfrei|limo|wasser|getr(ä|a)nk/, 'limo'],
  [/kaffee|hei(ß|ss)/, 'kaffee'], [/essen|speise|grill|k(ü|u)che/, 'besteck'], [/snack/, 'chips'], [/s(ü|u)(ß|ss)|eis/, 'bonbon'],
  [/tennis|sport|ball|verein|shop/, 'tennisball'],
];
function guess(name, category) {
  const n = String(name || '').toLowerCase(), c = String(category || '').toLowerCase();
  for (const [re, k] of RULES) if (re.test(n)) return k;
  for (const [re, k] of CATEGORY) if (re.test(c)) return k;
  return null;
}

/* ---------- Bilder ---------- */
const MAX_BYTES = 2 * 1024 * 1024;
function kindOf(buf) {
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const FILE_RE = /^a\d+-[0-9a-f]{12}\.(png|jpg|webp)$/;
function dir(dataDir) { const d = path.join(dataDir, 'artikelbilder'); fs.mkdirSync(d, { recursive: true }); return d; }
/** Bild prüfen und speichern → Dateiname. Wirft Fehler mit verständlichem Text. */
function checkImage(buf) {
  if (!buf || !buf.length) throw new Error('Keine Bilddatei empfangen.');
  if (buf.length > MAX_BYTES) throw new Error('Das Bild ist größer als 2 MB.');
  const k = kindOf(buf);
  if (!k) throw new Error('Bitte ein Bild als PNG, JPG, WebP oder SVG wählen.');
  return k;
}
function saveImage(dataDir, articleId, buf) {
  const k = checkImage(buf);
  const name = `a${Number(articleId)}-${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12)}.${k}`;
  fs.writeFileSync(path.join(dir(dataDir), name), buf);
  return name;
}
function removeImage(dataDir, file) {
  if (file && FILE_RE.test(file)) { try { fs.unlinkSync(path.join(dir(dataDir), file)); } catch (e) { /* schon weg */ } }
}
function imagePath(dataDir, file) {
  if (!FILE_RE.test(String(file || ''))) return null;
  const p = path.join(dir(dataDir), file);
  return fs.existsSync(p) ? p : null;
}
const mimeOf = file => MIME[String(file).split('.').pop()] || 'application/octet-stream';

module.exports = { has, guess, checkImage, saveImage, removeImage, imagePath, mimeOf, MAX_BYTES, FILE_RE };
