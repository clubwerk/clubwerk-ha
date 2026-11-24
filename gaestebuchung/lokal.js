// Buchungsseite lokal ohne Cloudflare starten (Tests und Ausprobieren): Node 22, D1 nachgebildet mit node:sqlite.
//   node lokal.js --port 8787 --db ./lokal.db
// Umgebung wie in wrangler.toml/Secrets: PAYPAL_ENV, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, CLUBWERK_SCHLUESSEL,
// für die Testreihen PAYPAL_ENV=test und PAYPAL_API_BASE=http://127.0.0.1:<port>. GB_TEST=1 erlaubt POST /__test/uhr?ms=… (Uhr vorstellen).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { d1 } from './test/d1.js';
import worker from './src/index.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('port', process.env.PORT || 8787)), DB = arg('db', process.env.GB_DB || path.join(HIER, 'lokal.db'));
let versatz = Number(process.env.GB_UHR_VERSATZ_MS || 0);
const env = { ...Object.fromEntries(['PAYPAL_ENV', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID', 'PAYPAL_API_BASE', 'CLUBWERK_SCHLUESSEL', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET', 'TURNSTILE_VERIFY_URL'].map(k => [k, process.env[k] || ''])),
  DB: d1(DB, fs.readFileSync(path.join(HIER, 'migrations', '0001_start.sql'), 'utf8')), __jetzt: () => Date.now() + versatz };
const TYP = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer(async (rq, rs) => {
  try {
    const u = new URL(rq.url, `http://127.0.0.1:${PORT}`);
    if (process.env.GB_TEST === '1' && rq.method === 'POST' && u.pathname === '/__test/uhr') { versatz = Number(u.searchParams.get('ms') || 0); rs.end('ok'); return; }
    if (process.env.GB_TEST === '1' && rq.method === 'POST' && u.pathname === '/__test/pflegen') { await worker.scheduled({}, env, { waitUntil: p => p }); rs.end('ok'); return; }
    const datei = path.join(HIER, 'public', path.normalize(u.pathname).replace(/^([/\\])+/, ''));
    if (rq.method === 'GET' && datei.startsWith(path.join(HIER, 'public') + path.sep) && fs.existsSync(datei) && fs.statSync(datei).isFile() && !datei.endsWith('_headers')) {
      rs.writeHead(200, { 'Content-Type': TYP[path.extname(datei)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }); rs.end(fs.readFileSync(datei)); return;
    }
    const teile = []; for await (const c of rq) teile.push(c);
    const host = rq.headers['x-gb-host'] || `http://127.0.0.1:${PORT}`;   // Tests: so tun, als liefe die Seite unter einer anderen Adresse
    const req = new Request(new URL(rq.url, host), { method: rq.method, headers: Object.entries(rq.headers).filter(([, v]) => typeof v === 'string'), body: ['GET', 'HEAD'].includes(rq.method) ? undefined : Buffer.concat(teile), redirect: 'manual' });
    const r = await worker.fetch(req, env, {});
    const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
    rs.writeHead(r.status, h); rs.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { console.error(e); rs.writeHead(500); rs.end('Fehler'); }
}).listen(PORT, '127.0.0.1', () => console.log(`Buchungsseite lokal: http://127.0.0.1:${PORT}/`));
