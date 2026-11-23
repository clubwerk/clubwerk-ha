/* Vorgepackt ausliefern (wie i18n.js): Skripte, Stile und Seiten der Oberflächen einmal mit Brotli in höchster Stufe (und gzip 9) packen und im Speicher
   halten – rund 16 % weniger Bytes als das Packen je Anfrage (security.compress, Stufe 6), und der Server packt nicht bei jedem Abruf neu.
   Gepackt wird im Hintergrund (Thread-Pool von zlib, hält den Server nicht an); bis es fertig ist, packt security.compress wie bisher als Datenstrom.
   ETag aus dem Inhalt: ohne Version (?v=) fragt der Browser nach und bekommt 304, solange sich nichts geändert hat. */
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

const packs = new Map();   // Schlüssel (Datei oder Seite) → { etag, body, br, gz }
const MAX = 200;           // Obergrenze (Seiten mit eingesetztem Vereinsnamen erzeugen neue Fassungen)

/* Immer nur eine Datei gleichzeitig packen: zlib nutzt den Thread-Pool, den auch Dateizugriffe brauchen – nach einem Neustart auf einem
   Raspberry Pi sollen Seiten nicht warten, weil vier große Skripte zugleich gepackt werden */
const warte = []; let laeuft = false;
function weiter() {
  if (laeuft || !warte.length) return;
  laeuft = true;
  warte.shift()().finally(() => { laeuft = false; weiter(); });
}
/** Gepackte Fassung eines Inhalts; neu, sobald sich der Inhalt ändert */
function pack(key, body) {
  const etag = '"' + crypto.createHash('sha1').update(body).digest('base64url').slice(0, 27) + '"';
  let a = packs.get(key);
  if (a && a.etag === etag) return a;
  if (packs.size > MAX) packs.clear();
  a = { etag, body, br: null, gz: null };
  packs.set(key, a);
  const mine = a;
  warte.push(() => new Promise(fertig => zlib.brotliCompress(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length } }, (e, buf) => {
    if (e) console.error('Vorpacken (Brotli):', key, e.message); else mine.br = buf;
    zlib.gzip(body, { level: 9 }, (e2, gz) => { if (e2) console.error('Vorpacken (gzip):', key, e2.message); else mine.gz = gz; fertig(); });
  })));
  weiter();
  return a;
}

/** Inhalt senden: type (z. B. 'application/javascript'), cache: Cache-Control */
function senden(req, res, key, body, type, cache) {
  const a = pack(key, Buffer.isBuffer(body) ? body : Buffer.from(body));
  res.type(type).set({ 'Cache-Control': cache, ETag: a.etag, Vary: 'Accept-Encoding' });
  if (req.fresh) return res.status(304).end();
  const acc = String(req.headers['accept-encoding'] || ''), enc = a.br && /\bbr\b/.test(acc) ? 'br' : a.gz && /\bgzip\b/.test(acc) ? 'gzip' : '';
  if (enc) res.set('Content-Encoding', enc);   // schon gepackt – security.compress lässt die Antwort dann in Ruhe
  return res.send(enc === 'br' ? a.br : enc === 'gzip' ? a.gz : a.body);
}

const files = new Map();   // Datei → { mtime, size, body }
/** Datei vorgepackt senden; liest sie neu, sobald sich ihr Änderungszeitpunkt ändert */
function datei(req, res, file, type, cache) {
  const st = fs.statSync(file);
  let f = files.get(file);
  if (!f || f.mtime !== st.mtimeMs || f.size !== st.size) { f = { mtime: st.mtimeMs, size: st.size, body: fs.readFileSync(file) }; files.set(file, f); }
  return senden(req, res, file, f.body, type, cache);
}

module.exports = { senden, datei };
