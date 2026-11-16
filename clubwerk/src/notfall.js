'use strict';
/**
 * Notfallmodus: Die Datenbank ist beim Start beschädigt oder der Speicher ist voll. Statt einer Neustart-Schleife ohne Hinweis
 * (jeder Start scheitert gleich) bleibt Clubwerk mit einer Hinweisseite erreichbar.
 *  – Hauptport (Tablet, Verwaltung, Handys): nur der Hinweis, keine Bedienung.
 *  – Seitenleiste von Home Assistant (Ingress, nur Home-Assistant-Admins): zusätzlich „Letzten Schnappschuss übernehmen“ (beschädigte
 *    Datenbank) bzw. „Erneut starten“ (nach dem Freiräumen). Der Schnappschuss wird über die übliche Wiederherstellung beim Start
 *    eingespielt (src/backup.js, die beschädigte Datei bleibt als „vor-wiederherstellung“ erhalten).
 * Ohne Datenbank gibt es weder Anmeldung noch Sprache: Die Seite ist zweisprachig und kommt ohne Skripte aus.
 */
const fs = require('fs');
const crypto = require('crypto');

let aktiv = false;
const { esc } = require('./util');
const normIp = ip => String(ip || '').replace(/^::ffff:(?=\d+\.)/i, '');
const INNEN = new Set(['172.30.32.2', '127.0.0.1', '::1']);   // Supervisor (Ingress) und das Add-on selbst

function art(err) {
  const c = String(err && err.code || ''), m = String(err && err.message || '');
  let frei = 1;
  try { const backup = require('./backup'), st = fs.statfsSync(backup.DATA_DIR); if (st.blocks) frei = st.bavail / st.blocks; } catch (e) { /* Füllstand nicht messbar: keine Warnung */ }
  if (/SQLITE_FULL|ENOSPC/.test(c) || /disk is full|no space/i.test(m) || frei < 0.01) return 'voll';
  if (/SQLITE_(CORRUPT|NOTADB)/.test(c) || /malformed|not a database|beschädigt/i.test(m)) return 'kaputt';
  return 'fehler';
}

/** neuester Schnappschuss, der die Prüfung besteht (Integrität, Tabellen von Clubwerk) */
function schnappschuss() {
  const backup = require('./backup');
  let list = []; try { list = backup.list(); } catch (e) { return null; }
  for (const b of list) {
    if (!/\.db$/.test(b.file) || /vor-wiederherstellung/.test(b.file)) continue;
    if (!backup.validate(require('path').join(backup.BACKUP_DIR, b.file))) return b;
  }
  return null;
}

const TEXT = {
  voll: ['Der Speicher ist voll', 'Clubwerk kann nicht starten, weil der Speicher voll ist. Bitte in Home Assistant Platz schaffen (z. B. alte Backups unter Einstellungen › System › Backups löschen) und Clubwerk dann neu starten.',
    'Storage is full', 'Clubwerk cannot start because the storage is full. Please free up space in Home Assistant (e.g. delete old backups under Settings › System › Backups) and then restart Clubwerk.'],
  kaputt: ['Die Datenbank ist beschädigt', 'Clubwerk kann nicht starten, weil die Datenbank beschädigt ist (oft nach einem Stromausfall). Ein Admin von Home Assistant kann in der Seitenleiste den letzten intakten Schnappschuss übernehmen. Die beschädigte Datei bleibt aufgehoben.',
    'The database is damaged', 'Clubwerk cannot start because the database is damaged (often after a power cut). A Home Assistant admin can restore the latest intact snapshot from the sidebar. The damaged file is kept.'],
  fehler: ['Clubwerk konnte nicht starten', 'Beim Start ist ein Fehler aufgetreten. Einzelheiten stehen im Protokoll des Add-ons in Home Assistant.',
    'Clubwerk could not start', 'An error occurred during start-up. Details are in the add-on log in Home Assistant.'],
};

function seite({ a, innen, snap, token, meldung }) {
  const [tDe, xDe, tEn, xEn] = TEXT[a];
  const knopf = (aktion, de, en) => `<form method="post" action="notfall/${aktion}"><input type="hidden" name="t" value="${token}"><button type="submit">${esc(de)} · <span lang="en">${esc(en)}</span></button></form>`;
  let tun = '';
  if (meldung) tun = `<p class="ok">${esc(meldung)}</p>`;
  else if (innen && a === 'kaputt' && snap) tun = `<p>Letzter intakter Schnappschuss · <span lang="en">Latest intact snapshot</span>: <b>${esc(snap.file)}</b></p>${knopf('schnappschuss', 'Letzten Schnappschuss übernehmen', 'Restore latest snapshot')}`;
  else if (innen && a === 'kaputt') tun = '<p>Kein intakter Schnappschuss gefunden. Bitte ein Backup von Home Assistant zurückspielen. · <span lang="en">No intact snapshot found. Please restore a Home Assistant backup.</span></p>';
  else if (innen) tun = knopf('neustart', 'Erneut starten', 'Restart');
  else tun = '<p>Bitte Clubwerk in Home Assistant über die Seitenleiste öffnen. · <span lang="en">Please open Clubwerk from the Home Assistant sidebar.</span></p>';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clubwerk – Notfallmodus</title>
<style>:root{color-scheme:light dark;--ink:#1a1f1c;--muted:#4a524d;--bg:#f5f6f4;--card:#fff;--brand:#1f6f43;--warn:#9a3412}
@media (prefers-color-scheme:dark){:root{--ink:#eef1ee;--muted:#b9c1bb;--bg:#141815;--card:#1d221e;--brand:#5fc28a;--warn:#fdba74}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}main{max-width:40rem;margin:0 auto;padding:24px 16px}
.k{background:var(--card);border-radius:12px;padding:20px;margin-bottom:16px}h1{font-size:1.3rem;margin:0 0 8px;color:var(--warn)}p{margin:8px 0;overflow-wrap:anywhere}
[lang=en]{color:var(--muted)}button [lang=en]{color:inherit}button{font:inherit;min-height:44px;padding:8px 16px;border-radius:8px;border:0;background:var(--brand);color:var(--bg);cursor:pointer;max-width:100%}.ok{color:var(--brand);font-weight:600}</style></head>
<body><main><div class="k"><h1>${esc(tDe)}</h1><p>${esc(xDe)}</p></div><div class="k" lang="en"><h1>${esc(tEn)}</h1><p>${esc(xEn)}</p></div><div class="k">${tun}</div></main></body></html>`;
}

/** Notfallmodus starten (statt des normalen Servers). err: der Fehler beim Start */
function start(err) {
  if (aktiv) return;
  aktiv = true;
  const a = art(err), token = crypto.randomBytes(18).toString('hex');
  let meldung = '', snap = a === 'kaputt' ? schnappschuss() : null;
  console.error(`NOTFALLMODUS: ${TEXT[a][0]} (${err && err.message ? err.message : err}). Clubwerk zeigt nur eine Hinweisseite – Bedienung über die Seitenleiste von Home Assistant.`);
  const ende = code => setTimeout(() => { try { require('./prozess').ende(); } catch (e) { /* Prozess endet ohnehin */ } process.exit(code); }, 300);
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => ende(0));   // Home Assistant stoppt das Add-on: geordnet, kein Absturz
  const handler = innenPort => (req, res) => {
    const innen = innenPort && INNEN.has(normIp(req.socket.remoteAddress));
    const head = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'SAMEORIGIN', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'self'" };
    const url = String(req.url || '').split('?')[0];
    if (req.method === 'POST' && innen && /\/notfall\/(schnappschuss|neustart)$/.test(url) && !meldung) {
      let body = '';
      req.on('data', d => { if (body.length < 2000) body += d; });
      req.on('end', () => {
        const t = new URLSearchParams(body).get('t') || '';
        const okT = t.length === token.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(token));
        if (!okT) { res.writeHead(403, head); res.end(seite({ a, innen, snap, token, meldung: '' })); return; }
        if (url.endsWith('/schnappschuss')) {
          snap = schnappschuss();
          if (a !== 'kaputt' || !snap) { res.writeHead(409, head); res.end(seite({ a, innen, snap, token, meldung: '' })); return; }
          try { require('./backup').markRestore(snap.file); } catch (e) { console.error('Notfall – Schnappschuss:', e.message); res.writeHead(500, head); res.end(seite({ a, innen, snap, token, meldung: '' })); return; }
          console.error(`Notfall: Schnappschuss ${snap.file} wird übernommen, Clubwerk startet neu.`);
          meldung = `Schnappschuss ${snap.file} wird übernommen. Clubwerk startet neu – bitte die Seite in einer Minute neu laden. · Restoring snapshot, Clubwerk is restarting.`;
        } else meldung = 'Clubwerk startet neu – bitte die Seite in einer Minute neu laden. · Clubwerk is restarting.';
        res.writeHead(200, head); res.end(seite({ a, innen, snap, token, meldung }));
        ende(1);   // Home Assistant startet das Add-on neu (Watchdog); die Wiederherstellung läuft beim Start
      });
      return;
    }
    if (/^\/api\//.test(url)) { res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: TEXT[a][0], notfall: a })); return; }
    res.writeHead(503, head); res.end(seite({ a, innen, snap, token, meldung }));
  };
  const PORT = Number(process.env.PORT || 3100), HOST = process.env.HOST || '0.0.0.0';
  try { require('./tls').listen(handler(false), PORT, HOST, 'Clubwerk (Notfallmodus)'); } catch (e) { console.error('Notfall – Port:', e.message); }
  const IN = process.env.INGRESS_PORT || process.env.INTERNAL_PORT;
  if (IN && String(IN) !== String(PORT)) require('http').createServer(handler(true)).listen(parseInt(IN, 10), process.env.INGRESS_PORT ? '0.0.0.0' : '127.0.0.1');
}

module.exports = { start, art, get aktiv() { return aktiv; } };
