// Sicherung zurückspielen 3.29: präparierte Archive (Verknüpfungen, Pfade nach oben, Sonderdateien …) werden vor dem Entpacken abgelehnt
const fb = require((process.env.CW_APP || require('path').resolve(__dirname, '../clubwerk')) + '/src/fullbackup.js'); const D = process.argv[2] + '/tarx';
const exp = { 'good.tgz': true, 'goodpax.tgz': true };
(async () => { let f = 0; for (const n of require('fs').readdirSync(D).sort()) { let r, e = ''; try { r = await fb.checkArchive(D + '/' + n); } catch (x) { e = x.message; }
  const okExp = Boolean(exp[n]); const pass = okExp === !e; if (!pass) f++; console.log((pass ? '✔ ' : '✘ ') + n + ' → ' + (e || JSON.stringify(r))); }
  console.log(f ? f + ' FEHLER' : 'ALLES OK'); process.exit(f ? 1 : 0); })();
