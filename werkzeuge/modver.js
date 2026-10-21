// Modul-Versionen prüfen: geänderte Module brauchen eine neue Versionsnummer.
// node werkzeuge/modver.js check clubwerk   → vergleicht mit werkzeuge/modulstand.json (Stand des letzten Release)
// node werkzeuge/modver.js save clubwerk    → speichert den Stand (nach dem Release, Datei mit committen)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [, , mode, root] = process.argv; const BASE = path.join(__dirname, 'modulstand.json');   // Stand des letzten Release (im Repository)
const VERKAUF = ['public/tablet.js', 'public/index.html', 'public/artikel-icons.js', 'src/articleicons.js'];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]).sort();
function units(r) {
  const out = {}, pk = JSON.parse(fs.readFileSync(path.join(r, 'package.json')));
  const h = crypto.createHash('sha1'); for (const f of VERKAUF) h.update(f + '\0' + fs.readFileSync(path.join(r, f)));
  out.verkauf = { version: pk.verkaufVersion || pk.version, hash: h.digest('hex') };
  for (const id of fs.readdirSync(path.join(r, 'erweiterungen')).sort()) {
    const d = path.join(r, 'erweiterungen', id); if (!fs.existsSync(path.join(d, 'erweiterung.json'))) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(d, 'erweiterung.json'))); const hh = crypto.createHash('sha1');
    for (const f of walk(d)) { let c = fs.readFileSync(f); if (f.endsWith('erweiterung.json')) c = Buffer.from(JSON.stringify({ ...meta, version: '' })); hh.update(path.relative(d, f) + '\0' + c); }
    out[id] = { version: meta.version, hash: hh.digest('hex') };
  }
  return out;
}
const cur = units(root);
if (mode === 'save') { fs.writeFileSync(BASE, JSON.stringify(cur, null, 1)); console.log('Modulstand gespeichert:', Object.entries(cur).map(([k, v]) => k + ' ' + v.version).join(', ')); process.exit(0); }
const old = JSON.parse(fs.readFileSync(BASE)); let bad = 0;
for (const [k, v] of Object.entries(cur)) {
  const o = old[k]; if (!o) { console.log(`neu: ${k} ${v.version}`); continue; }
  if (o.hash !== v.hash && o.version === v.version) { console.log(`ABBRUCH: ${k} geändert, Version aber noch ${v.version}`); bad++; }
  else if (o.hash !== v.hash) console.log(`geändert: ${k} ${o.version} → ${v.version}`);
  else if (o.version !== v.version) console.log(`nur Nummer geändert: ${k} ${o.version} → ${v.version}`);
}
process.exit(bad ? 1 : 0);
