// Listet deutsche Texte ohne englische Übersetzung → werkzeuge/i18n/ausgabe/fehlend.json (Format für ANLEITUNG-EN.md)
// Aufruf nach extract.js:  node werkzeuge/i18n/fehlend.js        (Rückgabewert 1, wenn etwas fehlt)
// Übersetzungen einspielen:  node werkzeuge/i18n/fehlend.js --einspielen uebersetzung.json
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'clubwerk');
const kat = JSON.parse(fs.readFileSync(path.join(APP, 'sprachen', 'katalog.json'), 'utf8')).strings;
const enF = path.join(APP, 'sprachen', 'en.json'); const en = JSON.parse(fs.readFileSync(enF, 'utf8'));
const keys = Array.isArray(kat) ? kat : Object.keys(kat);
if (process.argv[2] === '--einspielen') {
  const neu = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')); let n = 0;
  const ph = s => (String(s).match(/\{[^}]+\}/g) || []).sort().join();
  for (const [k, v] of Object.entries(neu)) { if (ph(k) !== ph(v)) { console.log('Platzhalter passen nicht:', k, '→', v); process.exit(1); } en.strings[k] = v; n++; }
  fs.writeFileSync(enF, JSON.stringify(en, null, 1) + '\n'); console.log(n, 'Übersetzungen übernommen'); process.exit(0);
}
let quellen = {}; try { quellen = JSON.parse(fs.readFileSync(path.join(__dirname, 'ausgabe', 'katalog-quellen.json'), 'utf8')); } catch (e) { /* ohne Fundstellen */ }
const miss = keys.filter(k => !(k in en.strings)).map(k => ({ k, wo: quellen[k] || [] }));
fs.mkdirSync(path.join(__dirname, 'ausgabe'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'ausgabe', 'fehlend.json'), JSON.stringify(miss, null, 1));
console.log(miss.length ? `${miss.length} Texte ohne Englisch → werkzeuge/i18n/ausgabe/fehlend.json` : 'Alle Texte übersetzt.');
process.exit(miss.length ? 1 : 0);
