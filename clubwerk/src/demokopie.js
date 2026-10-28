'use strict';
/* ---------- „Demo“-Knopf je Modul: abgeschottete Demo-Kopie ----------
   Start (Recht „Einstellungen“): eigener temporärer Datenordner außerhalb von /data, Datenbank aus Kern + Beispieldaten dieses Moduls
   (src/demo.js), zufällige Zugangsdaten, dann ein eigener Clubwerk-Prozess nur auf 127.0.0.1 mit CW_DEMO_KOPIE=1 (src/abschottung.js:
   nichts nach außen, keine fremden Programme) und einer Umgebung ohne Home-Assistant-Schlüssel, Notfallpasswort oder Erweiterungsordner.
   Erreichbar ist sie nur über diese Weiterleitung unter …/demo/ – also auch über die Seitenleiste (Ingress) – und nur für den Admin,
   der sie gestartet hat (mit seiner echten Anmeldung). Cookies der Kopie heißen im Browser „cwdemo_…“: Die Kopie sieht nie die echte
   Anmeldung, die echte Verwaltung nie die der Kopie. Nur eine Demo zugleich; sie endet nach DEMO_MIN Minuten ohne Anfrage, beim Schließen
   des Tabs (nach kurzer Gnadenfrist, ein Neuladen hält sie am Leben), mit „Demo beenden“ oder wenn Clubwerk stoppt – der Ordner wird gelöscht. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const demo = require('./demo');

const IDLE_MS = Number(process.env.CW_DEMO_MINUTEN || 30) * 60000;
const GRACE_MS = Number(process.env.CW_DEMO_SCHLIESSEN_SEK || 20) * 1000;   // nach dem Schließen des Tabs
const PREFIX = 'clubwerk-demo-';
const COOKIE = 'cwdemo_';
let cur = null;   // { id, module, name, userId, user, dir, proc, port, last, closing, startedAt, cookies, info }

/** Reste einer abgestürzten Demo löschen (beim Start von Clubwerk) – nur Ordner, deren Clubwerk nicht mehr läuft */
function cleanup() {
  const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
  try {
    for (const n of fs.readdirSync(os.tmpdir()).filter(x => x.startsWith(PREFIX))) {
      const d = path.join(os.tmpdir(), n); let owner = 0;
      try { owner = Number(fs.readFileSync(path.join(d, 'clubwerk.pid'), 'utf8')); } catch (e) { /* ohne Kennung: Rest */ }
      if (!owner || owner === process.pid || !alive(owner)) fs.rmSync(d, { recursive: true, force: true });
    }
  } catch (e) { /* kein tmp */ }
}
const freePort = () => new Promise((res, rej) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }).on('error', rej); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Anfrage an die Kopie (Start und Anmeldung) */
function call(port, method, p, body, cookie = '') {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: { Host: `127.0.0.1:${port}`, 'X-Clubwerk': '1', Cookie: cookie, ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, x => {
      x.resume(); x.on('end', () => res({ status: x.statusCode, cookies: (x.headers['set-cookie'] || []).map(c => c.split(';')[0]) }));
    });
    r.on('error', rej); r.setTimeout(5000, () => r.destroy(new Error('Zeitüberschreitung')));
    r.end(data);
  });
}

function stop(why = 'beendet') {
  const c = cur; if (!c) return;
  cur = null;
  clearInterval(c.timer);
  try { c.proc.kill('SIGKILL'); } catch (e) { /* schon weg */ }
  try { fs.rmSync(c.dir, { recursive: true, force: true }); } catch (e) { console.error('Demo: Ordner nicht gelöscht –', e.message); }
  console.log(`Demo-Kopie (${c.name}) ${why} – alle Daten gelöscht.`);
}

async function start({ module, name, user }) {
  if (cur) stop('ersetzt');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));   // 0700, nie unter /data (käme sonst in Sicherungen)
  const c = { module, name, userId: user.id, user: user.username, dir, startedAt: Date.now(), last: Date.now(), closing: 0 };
  cur = c;
  try {
    fs.writeFileSync(path.join(dir, 'clubwerk.pid'), String(process.pid));
    const m = demo.secrets(require('./auth').hashSecret);
    const { db } = demo.build(path.join(dir, 'clubwerk.db'), { modules: [module] });
    demo.seal(db, m);
    db.pragma('journal_mode = DELETE'); db.close();
    fs.mkdirSync(path.join(dir, 'keine-erweiterungen'));
    const [port, mport, bport] = [await freePort(), await freePort(), await freePort()];
    c.port = port; c.info = { admin: m.admin.user, password: m.admin.pw, tablet: m.tablet.pw };
    // Nur, was Clubwerk zum Laufen braucht – kein SUPERVISOR_TOKEN, kein Notfallpasswort, keine Zertifikate, kein Erweiterungsordner
    const env = { PATH: process.env.PATH, TZ: process.env.TZ || '', NODE_ENV: process.env.NODE_ENV || 'production', LANG: process.env.LANG || '',
      DATA_DIR: dir, PORT: String(port), HOST: '127.0.0.1', MEMBER_PORT: String(mport), BEREGNUNG_PORT: String(bport), EXT_DIR: path.join(dir, 'keine-erweiterungen'),
      TRUSTED_PROXY: '127.0.0.2', CW_DEMO_KOPIE: '1', CW_DEMO_MODUL: name, NODE_OPTIONS: '--max-old-space-size=128' };
    c.proc = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env, cwd: path.join(__dirname, '..'), stdio: ['ignore', 'ignore', 'pipe'] });
    c.proc.stderr.on('data', d => { if (cur === c) process.stderr.write(String(d).split('\n').filter(Boolean).map(l => `[Demo] ${l}\n`).join('')); });
    c.proc.on('exit', () => { if (cur === c) stop('beendet sich'); });
    let up = false;
    for (let i = 0; i < 100 && cur === c && !up; i++) { await sleep(150); try { up = (await call(port, 'GET', '/api/admin/status')).status === 200; } catch (e) { /* startet noch */ } }
    if (!up || cur !== c) throw new Error('Die Demo startet nicht.');
    const a = await call(port, 'POST', '/api/admin/login', { username: m.admin.user, password: m.admin.pw });
    const g = await call(port, 'POST', '/api/gate/login', { password: m.tablet.pw });
    if (a.status !== 200) throw new Error('Anmeldung in der Demo fehlgeschlagen.');
    c.cookies = [...a.cookies, ...(g.status === 200 ? g.cookies : [])];
    c.timer = setInterval(() => {
      const now = Date.now();
      if (now - c.last > IDLE_MS) stop(`nach ${Math.round(IDLE_MS / 60000)} Minuten ohne Nutzung beendet`);
      else if (c.closing && c.closing >= c.last && now - c.closing > GRACE_MS) stop('geschlossen');
    }, Math.min(15000, GRACE_MS / 2)).unref();
    return c;
  } catch (e) { stop('abgebrochen'); throw e; }
}

/** Set-Cookie der Kopie für den Browser: Name mit „cwdemo_“, gilt nur auf …/demo/ und darunter nicht für die echte Verwaltung */
const rename = c => COOKIE + c.replace(/;\s*Path=[^;]*/i, '') + '; Path=/';
const browserCookies = c => c.cookies.map(x => `${COOKIE}${x}; HttpOnly; SameSite=Strict; Path=/`);

/** Weiterleitung …/demo/* → Kopie. Läuft vor express.json (Inhalt wird roh durchgereicht). */
function proxy(currentUser) {
  return (req, res) => {
    const c = cur, api = req.url.startsWith('/api/');
    const no = (code, msg) => { res.status(code); return api ? res.json({ error: msg }) : res.type('text/plain; charset=utf-8').send(msg); };
    if (!c || !c.cookies) return no(404, 'Diese Demo ist beendet – alle Daten sind gelöscht. In der Verwaltung unter Einstellungen › Module neu starten.');
    const u = currentUser(req);
    if (!u || u.id !== c.userId || !u.perms.includes('einstellungen')) return no(403, 'Die Demo gehört zu einer anderen Anmeldung. Bitte in der Verwaltung anmelden und dort öffnen.');
    if (!/^\/demo\//.test(req.originalUrl)) return res.redirect(302, 'demo/admin.html');   // …/demo → Verwaltung, …/demo/ ist das Tablet
    if (req.url === '/sw.js') return no(404, 'Kein Offline-Speicher in der Demo.');   // kein Service Worker, der die Demo überdauert
    if (req.url === '/api/demo-kopie/zu' && req.method === 'POST') { c.closing = Date.now(); return res.json({ ok: true }); }
    if (req.url === '/api/demo-kopie/ende' && req.method === 'POST') { stop('beendet'); return res.json({ ok: true }); }
    c.last = Date.now();
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (!/^(host|cookie|connection|accept-encoding|x-forwarded-|x-ingress-|x-real-ip|forwarded|x-hass)/i.test(k)) headers[k] = v;
    headers.host = `127.0.0.1:${c.port}`;
    headers.cookie = String(req.headers.cookie || '').split(';').map(x => x.trim()).filter(x => x.startsWith(COOKIE)).map(x => x.slice(COOKIE.length)).join('; ');
    const up = http.request({ host: '127.0.0.1', port: c.port, method: req.method, path: req.url, headers }, r => {
      const h = { ...r.headers };
      if (h['set-cookie']) h['set-cookie'] = h['set-cookie'].map(rename);
      delete h.connection; delete h['keep-alive'];
      res.writeHead(r.statusCode, h);
      r.pipe(res);
    });
    up.on('error', () => { if (!res.headersSent) no(502, 'Die Demo antwortet nicht (mehr).'); else res.end(); });
    req.pipe(up);
  };
}

const status = user => (cur && cur.cookies ? { running: true, module: cur.module, name: cur.name, mine: Boolean(user && user.id === cur.userId), user: cur.user,
  startedAt: new Date(cur.startedAt).toISOString(), idleMin: Math.round(IDLE_MS / 60000), leftMin: Math.max(0, Math.ceil((cur.last + IDLE_MS - Date.now()) / 60000)) } : { running: false });
/** Speicherbedarf der laufenden Kopie in MB (Linux: /proc), für Protokoll und Test */
function rssMb() {
  try { const m = /VmRSS:\s+(\d+) kB/.exec(fs.readFileSync(`/proc/${cur.proc.pid}/status`, 'utf8')); return m ? Math.round(Number(m[1]) / 1024) : null; } catch (e) { return null; }
}

module.exports = { start, stop, proxy, status, cleanup, browserCookies, rssMb, running: () => Boolean(cur), dir: () => cur && cur.dir, pid: () => cur && cur.proc && cur.proc.pid };
