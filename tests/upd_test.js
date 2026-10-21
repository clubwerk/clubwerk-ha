// Update 3.29: Inhalts-Prüfsumme – unabhängig vom Packen, ändert sich bei jeder Änderung
const fs = require('fs'), path = require('path'); const S = process.argv[2]; const APP = process.env.CW_APP || require('path').resolve(__dirname, '../clubwerk');
const JSZip = require(APP + '/node_modules/jszip'); const u = require(APP + '/src/selfupdate.js');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + x : '')); if (!c) fails++; };
const SRC = APP;
const files = []; const walk = (d, r) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const rr = r ? r + '/' + e.name : e.name; if (e.name === 'node_modules' || e.name === '.git') continue; if (e.isDirectory()) walk(path.join(d, e.name), rr); else if (e.isFile()) files.push(rr); } }; walk(SRC, '');
const build = async (order, prefix, level, patch) => { const z = new JSZip(); for (const f of order) { let b = fs.readFileSync(path.join(SRC, f)); if (f === 'config.yaml') b = Buffer.from(b.toString().replace(/^version: .*$/m, 'version: "99.0.0"')); if (patch && f === patch) b = Buffer.concat([b, Buffer.from('\n// x')]); z.file(prefix + f, b); } return z.generateAsync({ type: 'nodebuffer', compression: level ? 'DEFLATE' : 'STORE', compressionOptions: { level: level || 1 } }); };
(async () => {
  const a = await u.inspect(await build(files, 'clubwerk-ha/clubwerk/', 9), S + '/upd_a', { currentVersion: '3.0.0' });
  const b = await u.inspect(await build([...files].reverse(), 'clubwerk/', 0), S + '/upd_b', { currentVersion: '3.0.0' });
  ok('Prüfsumme vorhanden', /^[0-9a-f]{64}$/.test(a.sha) && /^([0-9a-f]{4} ){7}[0-9a-f]{4}$/.test(a.shaShort), a.shaShort);
  ok('Gleicher Inhalt, anders gepackt → gleiche Prüfsumme', a.sha === b.sha);
  ok('… entspricht dem Ordner', a.sha === u.contentHash(S + '/upd_a'));
  const c = await u.inspect(await build(files, 'clubwerk/', 9, 'src/server.js'), S + '/upd_c', { currentVersion: '3.0.0' });
  ok('Ein Zeichen geändert → andere Prüfsumme', c.sha !== a.sha);
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
