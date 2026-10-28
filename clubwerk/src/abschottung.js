'use strict';
/* ---------- Abschottung der Demo-Kopie (CW_DEMO_KOPIE=1, gestartet von src/demokopie.js) ----------
   Muss als Erstes geladen werden – vor allem, was Verbindungen aufbaut. Danach gilt im ganzen Prozess:
   - Keine Verbindung nach außen: Jede TCP-Verbindung (http, https, fetch, SMTP, Home Assistant, Dropbox, Push …) geht nur
     zu den eigenen Ports auf 127.0.0.1; Unix-Sockets und UDP gibt es nicht.
   - Keine fremden Programme: nur pdftotext und tesseract (Belege lesen), kein tar, kein stty (SMS-Modem) …
   - Gesperrte Änderungen (blocked()): Updates, Sicherungen, Dropbox, Erweiterungen einspielen, Neustart, „Demo beenden und einrichten“. */
const net = require('net');
const cp = require('child_process');
const dgram = require('dgram');

const MSG = 'In der Demo geht nichts nach außen.';
const PORTS = new Set(['PORT', 'MEMBER_PORT', 'BEREGNUNG_PORT'].map(k => Number(process.env[k])).filter(Boolean));
const LOOP = new Set(['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1']);

function target(args) {
  const a = Array.isArray(args[0]) ? args[0] : args;   // net intern: connect([options, cb])
  if (a[0] && typeof a[0] === 'object') return { port: Number(a[0].port), host: a[0].host || 'localhost', path: a[0].path };
  if (typeof a[0] === 'string' && !/^\d+$/.test(a[0])) return { path: a[0] };
  return { port: Number(a[0]), host: typeof a[1] === 'string' ? a[1] : 'localhost' };
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const t = target(args);
  if (!t.path && LOOP.has(String(t.host).toLowerCase()) && PORTS.has(t.port)) return connect.apply(this, args);
  process.nextTick(() => this.destroy(Object.assign(new Error(MSG), { code: 'EDEMO' })));
  return this;
};

const TOOLS = new Set(['pdftotext', 'tesseract']);
const deny = name => { throw Object.assign(new Error(`${MSG} (${name})`), { code: 'EDEMO' }); };
for (const k of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork']) {
  const orig = cp[k];
  cp[k] = function (cmd, ...rest) {
    if ((k === 'execFile' || k === 'execFileSync' || k === 'spawn' || k === 'spawnSync') && TOOLS.has(String(cmd))) return orig.call(this, cmd, ...rest);
    return deny(String(cmd).split(/\s/)[0]);
  };
}
dgram.createSocket = () => deny('UDP');

/* Stirbt Clubwerk (Elternprozess), endet die Kopie mit */
const PARENT = process.ppid;
setInterval(() => { if (process.ppid !== PARENT) process.exit(0); }, 3000).unref();

/* Diese Änderungen gibt es in der Demo-Kopie nicht (Ansehen geht) */
const BLOCKED = /^\/api\/admin\/(update|backups|demo|restart|dropbox|extensions\/upload|extensions\/[^/]+\/(install|uninstall|approve|backup)(\/|$))/;
const blocked = (method, p) => method !== 'GET' && method !== 'HEAD' && (BLOCKED.test(p) || (method === 'DELETE' && /^\/api\/admin\/extensions\//.test(p)));

module.exports = { blocked, MSG };
