'use strict';
/* HTTPS für alle Ports, die Geräte direkt aufrufen: Verwaltung/Tablet (3100), Beregnung (5000), Mitglieder-App (5001).
   Eingeschaltet über die Add-on-Option „ssl“: Zertifikat und Schlüssel liegen im Home-Assistant-Ordner /ssl
   (z. B. von Let's Encrypt/DuckDNS). Wer den Port noch mit http:// aufruft, wird automatisch auf https:// umgeleitet
   (gleicher Port – das Programm erkennt am ersten Byte, ob verschlüsselt angefragt wird).
   Fehlen die Dateien, laufen die Ports wie bisher mit HTTP.
   Interne Abrufe (Logo, Styles für Mitglieder-App/Beregnung) und die Home-Assistant-Seitenleiste nutzen einen
   unverschlüsselten Port, der nur für den Supervisor bzw. den Rechner selbst erreichbar ist (siehe server.js). */
const fs = require('fs');
const net = require('net');
const http = require('http');
const https = require('https');

let cache;
function creds() {
  if (cache !== undefined) return cache;
  cache = null;
  const cert = process.env.SSL_CERT, key = process.env.SSL_KEY;
  if (!cert || !key) return cache;
  try { cache = { cert: fs.readFileSync(cert), key: fs.readFileSync(key) }; }
  catch (e) { console.error(`HTTPS: Zertifikat nicht lesbar (${e.message}) – die Ports laufen ohne Verschlüsselung.`); }
  return cache;
}
const enabled = () => Boolean(creds());

/** Server starten – mit HTTPS (und Umleitung von http://), wenn ein Zertifikat da ist */
function listen(app, port, host, label) {
  const c = creds();
  if (!c) {
    const srv = http.createServer(app);
    srv.listen(port, host, () => console.log(`${label} auf Port ${port}`));
    return srv;
  }
  const secure = https.createServer(c, app);
  const redirect = http.createServer((req, res) => {
    const hostHdr = String(req.headers.host || '').replace(/[^A-Za-z0-9.\-:[\]]/g, '') || `localhost:${port}`;
    res.writeHead(301, { Location: `https://${hostHdr}${req.url}`, 'Cache-Control': 'no-store' });
    res.end();
  });
  const srv = net.createServer(sock => {
    sock.on('error', () => {});
    // Verbindungen, die nichts senden, nach 10 s schließen (sonst könnte jemand mit vielen leeren Verbindungen alles blockieren)
    sock.setTimeout(10000, () => sock.destroy());
    sock.once('data', buf => {
      sock.setTimeout(0);
      sock.pause();
      sock.unshift(buf);
      (buf[0] === 0x16 ? secure : redirect).emit('connection', sock);   // 0x16 = TLS-Handshake
      process.nextTick(() => sock.resume());
    });
  });
  srv.maxConnections = 500;
  secure.headersTimeout = 20000; secure.requestTimeout = 60000; secure.keepAliveTimeout = 10000;
  srv.listen(port, host, () => console.log(`${label} auf Port ${port} (HTTPS, http:// wird umgeleitet)`));
  return srv;
}

/** Adresse für interne Abrufe des Programms an sich selbst (immer HTTP auf 127.0.0.1) */
function internalBase() {
  const p = process.env.INTERNAL_PORT || process.env.PORT || 3100;
  return `http://127.0.0.1:${p}`;
}
module.exports = { enabled, listen, internalBase };
