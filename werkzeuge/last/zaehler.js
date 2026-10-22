'use strict';
/* Nur für die Leistungsmessung: wird per NODE_OPTIONS="--require …/zaehler.js" in den Server geladen (Clubwerk selbst bleibt unverändert).
   Schreibt je HTTP-Anfrage eine Zeile JSON nach $CW_ZAEHLER_LOG: { t: Ende (ms), port, m, url, ms: Dauer, q: Datenbankabfragen, qms: Zeit darin }. */
const fs = require('fs'); const http = require('http'); const { AsyncLocalStorage } = require('async_hooks');
const path = require('path');
const LOG = process.env.CW_ZAEHLER_LOG; if (!LOG) return;
const als = new AsyncLocalStorage();
const out = fs.createWriteStream(LOG, { flags: 'a' });

// Anfragen: jede läuft in einem eigenen Kontext, damit Abfragen ihr zugeordnet werden (auch über await hinweg)
const emit = http.Server.prototype.emit;
http.Server.prototype.emit = function (ev, req, res) {
  if (ev !== 'request') return emit.apply(this, arguments);
  const c = { q: 0, qms: 0, t0: process.hrtime.bigint() }, url = req.url;   // Express kürzt req.url in Unter-Routern
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - c.t0) / 1e6;
    out.write(JSON.stringify({ t: Date.now(), port: this.address() && this.address().port, m: req.method, url, ms: +ms.toFixed(2), q: c.q, qms: +c.qms.toFixed(2) }) + '\n');
  });
  return als.run(c, () => emit.apply(this, arguments));
};

// Datenbank: alle ausgeführten Anweisungen zählen (run/get/all/iterate)
const Database = require(require.resolve('better-sqlite3', { paths: [path.join(__dirname, '../../clubwerk')] }));
const probe = new Database(':memory:'); const proto = Object.getPrototypeOf(probe.prepare('SELECT 1')); probe.close();
for (const fn of ['run', 'get', 'all', 'iterate']) {
  const orig = proto[fn];
  proto[fn] = function () {
    const c = als.getStore(); if (!c) return orig.apply(this, arguments);
    const t = process.hrtime.bigint();
    try { return orig.apply(this, arguments); } finally { c.q++; c.qms += Number(process.hrtime.bigint() - t) / 1e6; }
  };
}
