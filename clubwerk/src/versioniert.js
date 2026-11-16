/* Versionierte Adressen für Tablet und Verwaltung (wie die Mitglieder-App): Oberflächen-Dateien und Schriften bekommen beim
   Ausliefern der Seite „?v=<Version>“ und werden dann ein Jahr unveränderlich zwischengespeichert – kein Nachfragen mehr je
   Seitenwechsel. Nach einem Update hat die Seite eine neue Version, damit neue Adressen. Ohne „?v=“ bleibt alles beim Alten (ETag). */
const fs = require('fs');
const VERSION = require('../package.json').version;
const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Kern-Dateien, die jede Seite gleich lädt (Skripte und Stile liegen im Ordner public/, Module binden sie relativ ein) */
const KERN = '(?:theme-init|nav|tablet|names|i18n-core|i18n-dom|artikel-icons|mail|kontoauszug|unterschrift|einrichtung|admin)\\.js|style\\.css|kit\\.css|fonts/[\\w-]+\\.woff2';
const RE_HTML = new RegExp(`((?:src|href)=")((?:\\.\\./|\\./)*(?:${KERN}))(")`, 'g');
const RE_CSS = /url\((fonts\/[\w-]+\.woff2)\)/g;

/** Adressen der Kern-Dateien in einer HTML-Seite mit der Version versehen */
const html = s => s.replace(RE_HTML, (m, a, f, z) => `${a}${f}?v=${VERSION}${z}`);
/** Schrift-Adressen in style.css (nur für versionierte Abrufe, damit Vorladen und Stil dieselbe Adresse nutzen) */
const css = s => s.replace(RE_CSS, (m, f) => `url(${f}?v=${VERSION})`);
/** Kommt die Anfrage mit der aktuellen Version? */
const passt = req => typeof req.query.v === 'string' && req.query.v === VERSION;

const cache = new Map();   // Datei → { mtime, text }
/** Datei gelesen und umgeschrieben, bis sich ihr Änderungszeitpunkt ändert */
function umgeschrieben(file, fn) {
  const m = fs.statSync(file).mtimeMs, c = cache.get(file);
  if (c && c.mtime === m) return c.text;
  const text = fn(fs.readFileSync(file, 'utf8'));
  cache.set(file, { mtime: m, text });
  return text;
}
module.exports = { VERSION, IMMUTABLE, html, css, passt, umgeschrieben };
