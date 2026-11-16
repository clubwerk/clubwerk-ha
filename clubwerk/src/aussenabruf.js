'use strict';
/* Abruf einer Adresse aus dem Internet, die ein Benutzer eingetragen hat (z. B. Kalender der Vereins-Homepage).
   Schutz gegen Anfragen ins eigene Netz (SSRF): nur https, der Name wird aufgelöst und jede Adresse geprüft –
   private Netze, Loopback, Link-Local, Multicast, Home-Assistant-Supervisor werden abgelehnt. Die Prüfung sitzt im
   Verbindungsaufbau selbst (lookup), gilt also für genau die Adresse, mit der verbunden wird (kein DNS-Rebinding),
   und wiederholt sich bei jeder Weiterleitung. */
const https = require('https'), http = require('http'), net = require('net'), dns = require('dns');

/* getrennte Listen: net.BlockList zählt IPv4-Adressen sonst auch zu ::ffff:0:0/96 */
const V4 = new net.BlockList(), V6 = new net.BlockList();
for (const [a, p] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]]) V4.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 96], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 32], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]]) V6.addSubnet(a, p, 'ipv6');
const NAMEN = /^(localhost|supervisor|homeassistant|hassio)$|\.(localhost|local|internal|lan|home|arpa)$/i;

const fehler = (msg, code) => Object.assign(new Error(msg), { code });
const NICHT_ERLAUBT = 'Die Adresse zeigt ins eigene Netz – erlaubt sind nur öffentliche Adressen im Internet.';

/* Nur zum Testen: genau ein Ziel host:port darf auch per http und im eigenen Netz abgerufen werden. */
const testZiel = () => process.env.CW_TEST_AUSSEN_ERLAUBT || '';

function gesperrt(ip) {
  const t = net.isIP(ip); if (!t) return true;
  return t === 4 ? V4.check(ip, 'ipv4') : V6.check(ip, 'ipv6');
}

function ziel(url) {
  let u; try { u = new URL(url); } catch (e) { throw fehler('Die Adresse ist ungültig.', 'EADRESSE'); }
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  const test = testZiel() && `${host}:${u.port}` === testZiel();
  if (u.protocol !== 'https:' && !(test && u.protocol === 'http:')) throw fehler('Erlaubt sind nur Adressen mit https://.', 'EADRESSE');
  if (u.username || u.password) throw fehler('Die Adresse darf keine Zugangsdaten enthalten.', 'EADRESSE');
  if (!test && (NAMEN.test(host) || !host.includes('.') && !net.isIP(host) || net.isIP(host) && gesperrt(host))) throw fehler(NICHT_ERLAUBT, 'EPRIVAT');
  return { u, host, test };
}

/* Namensauflösung für den Verbindungsaufbau: alle Adressen prüfen, nur erlaubte weitergeben. */
function sichererLookup(host, opts, cb) {
  dns.lookup(host, { ...opts, all: true }, (err, list) => {
    if (err) return cb(err);
    const ok = list.filter(a => !gesperrt(a.address));
    if (!ok.length || ok.length !== list.length) return cb(fehler(NICHT_ERLAUBT, 'EPRIVAT'));
    if (opts && opts.all) return cb(null, ok);
    cb(null, ok[0].address, ok[0].family);
  });
}

function anfrage(url, { headers, timeout, max }) {
  const { u, test } = ziel(url);
  const mod = u.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = mod.request(u, { method: 'GET', headers, lookup: test ? undefined : sichererLookup, agent: false }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve({ weiter: new URL(res.headers.location, u).href }); }
      if (Number(res.headers['content-length']) > max) { res.destroy(); return reject(fehler('zu groß', 'EGROSS')); }
      const parts = []; let n = 0;
      res.on('data', c => { n += c.length; if (n > max) { res.destroy(); reject(fehler('zu groß', 'EGROSS')); } else parts.push(c); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts) }));
      res.on('error', reject);
      res.on('close', () => { if (!res.complete) reject(fehler('Die Verbindung wurde unterbrochen.', 'ETIMEOUT')); });
    });
    const uhr = setTimeout(() => req.destroy(fehler('Zeitüberschreitung', 'ETIMEOUT')), timeout);
    req.on('close', () => clearTimeout(uhr));
    req.on('error', reject);
    req.end();
  });
}

/* Liefert { status, headers, body } (Buffer). Fehler-Codes: EADRESSE, EPRIVAT, EGROSS, ETIMEOUT, EWEITER, sonst Netzwerkfehler. */
async function abrufen(url, { headers = {}, timeout = 15000, max = 2 * 1024 * 1024, weiterleitungen = 5 } = {}) {
  const ende = Date.now() + timeout;
  for (let i = 0; i <= weiterleitungen; i++) {
    const rest = ende - Date.now(); if (rest <= 0) throw fehler('Zeitüberschreitung', 'ETIMEOUT');
    const r = await anfrage(url, { headers, timeout: rest, max });
    if (!r.weiter) return r;
    url = r.weiter;
  }
  throw fehler('Zu viele Weiterleitungen.', 'EWEITER');
}

module.exports = { abrufen, ziel, gesperrt };
