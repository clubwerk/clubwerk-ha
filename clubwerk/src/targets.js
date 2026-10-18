'use strict';
/**
 * Sicherungsziele (ab 2.14): Wohin die verschlüsselte Komplettsicherung zusätzlich geht.
 *  - Dropbox (eigene App, OAuth – siehe dropbox.js)
 *  - WebDAV  (Nextcloud, ownCloud, MagentaCLOUD, Hetzner Storage Box, Synology/QNAP …)
 *  - SFTP    (verschlüsselt über SSH – NAS, Storage Box, Linux-Server)
 *  - FTPS/FTP (z. B. FRITZ!Box mit USB-Speicher; reines FTP nur mit ausdrücklicher Warnung)
 *
 * Alle Ziele haben dieselbe Schnittstelle: test, put, list, get, remove, close – jeweils für einen Unterordner
 * („Komplett“ bzw. „Lesbar“) unterhalb des eingestellten Ordners.
 *
 * Sicherheit:
 *  - Zugangsdaten liegen getrennt als Geheimnis (backup_target_<id>_secret) und werden nie ausgegeben.
 *  - SFTP: Der Fingerabdruck des Servers wird beim ersten Test angezeigt und muss bestätigt werden; danach wird jede
 *    Verbindung mit einem anderen Schlüssel abgelehnt – BEVOR das Passwort gesendet wird.
 *  - FTPS: genauso mit dem Fingerabdruck des Zertifikats (z. B. selbst signiert bei der FRITZ!Box).
 *  - WebDAV: Umleitungen werden nicht verfolgt (sonst könnte das Passwort an eine andere Adresse gehen).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const TYPES = { webdav: 'WebDAV', sftp: 'SFTP', ftp: 'FTP / FTPS' };
const NAME_OK = /^[\w.-]{1,120}$/;
const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$|^\d{1,3}(\.\d{1,3}){3}$|^\[[0-9a-f:]+\]$/i;
const TIMEOUT = 60000;

function cleanFolder(f) {
  const s = String(f || '').replace(/\\/g, '/').replace(/[<>:"|?*\u0000-\u001f]/g, '').split('/').map(x => x.trim()).filter(x => x && x !== '.' && x !== '..').join('/');
  return '/' + s.slice(0, 200);
}
const joinPath = (...parts) => ('/' + parts.join('/')).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
const sshFingerprint = key => 'SHA256:' + crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
const err = (msg, extra = {}) => Object.assign(new Error(msg), extra);

/** Eingaben aus der Verwaltung prüfen → gespeicherte Form (ohne Geheimnis) */
function clean(b, old = null) {
  const t = { id: old ? old.id : crypto.randomBytes(5).toString('hex'), type: old ? old.type : String(b.type || '') };
  if (!TYPES[t.type]) throw err('Bitte die Art des Ziels wählen.');
  t.name = String(b.name || '').trim().replace(/\s+/g, ' ').slice(0, 40) || TYPES[t.type];
  t.enabled = b.enabled === undefined ? (old ? old.enabled : true) : Boolean(b.enabled);
  t.folder = cleanFolder(b.folder !== undefined ? b.folder : (old ? old.folder : '/Clubwerk'));
  const r = b.retention !== undefined ? b.retention : (old ? old.retention : null);
  if (r && typeof r === 'object') {
    const n = (v, lo, hi) => { const x = parseInt(v, 10); if (!(x >= lo && x <= hi)) throw err('Aufbewahrung: bitte gültige Zahlen.'); return x; };
    t.retention = { daily: n(r.daily, 1, 60), weekly: n(r.weekly, 0, 52), monthly: n(r.monthly, 0, 120) };
  } else t.retention = null;
  const pick = k => (b[k] !== undefined ? b[k] : old ? old[k] : undefined);
  if (t.type === 'webdav') {
    let u; try { u = new URL(String(pick('url') || '').trim()); } catch (e) { throw err('Bitte die WebDAV-Adresse eintragen, z. B. https://cloud.example.de/remote.php/dav/files/verein/'); }
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || u.search || u.hash) throw err('Die WebDAV-Adresse muss mit https:// beginnen und darf keinen Benutzer/Passwort enthalten.');
    t.url = u.origin + u.pathname.replace(/\/+$/, '');
    t.insecure = u.protocol === 'http:';
    if (t.insecure && !b.allowInsecure && !(old && old.insecure && old.url === t.url)) throw err('Ohne https:// geht das Passwort unverschlüsselt durchs Netz. Nur im eigenen Netz und mit ausdrücklicher Bestätigung erlaubt.', { needInsecure: true });
    t.user = String(pick('user') || '').trim().slice(0, 120);
  } else {
    t.host = String(pick('host') || '').trim().toLowerCase();
    if (!HOST_RE.test(t.host)) throw err('Bitte einen gültigen Servernamen oder eine IP-Adresse eintragen.');
    t.user = String(pick('user') || '').trim().slice(0, 120);
    if (!t.user) throw err('Bitte den Benutzernamen eintragen.');
    if (t.type === 'sftp') {
      t.port = Math.max(1, Math.min(65535, parseInt(pick('port'), 10) || 22));
      t.auth = pick('auth') === 'key' ? 'key' : 'password';
      const fp = String(pick('hostKey') || '').trim();
      t.hostKey = /^SHA256:[A-Za-z0-9+/]{43}$/.test(fp) ? fp : '';
      if (old && (old.host !== t.host || old.port !== t.port) && fp === old.hostKey) t.hostKey = '';   // anderer Server → neu bestätigen
    } else {
      t.mode = ['ftps', 'ftps-implicit', 'ftp'].includes(pick('mode')) ? pick('mode') : 'ftps';
      t.port = Math.max(1, Math.min(65535, parseInt(pick('port'), 10) || (t.mode === 'ftps-implicit' ? 990 : 21)));
      const fp = String(pick('certFp') || '').trim().toUpperCase();
      t.certFp = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fp) ? fp : '';
      if (old && (old.host !== t.host || old.port !== t.port) && fp === old.certFp) t.certFp = '';
      t.insecure = t.mode === 'ftp';
      if (t.insecure && !b.allowInsecure && !(old && old.insecure && old.host === t.host)) throw err('Reines FTP überträgt das Passwort unverschlüsselt. Bitte FTPS wählen – oder ausdrücklich bestätigen (nur im eigenen Netz).', { needInsecure: true });
    }
  }
  return t;
}

/* ---------- WebDAV ---------- */
function webdav(t, secret) {
  const auth = 'Basic ' + Buffer.from(`${t.user}:${secret || ''}`).toString('base64');
  const href = p => t.url + p.split('/').map(encodeURIComponent).join('/');
  const req = async (method, p, { headers = {}, body, ok = [200, 201, 204, 207], what = method } = {}) => {
    let r;
    try {
      r = await fetch(href(p), { method, headers: { Authorization: auth, ...headers }, body, redirect: 'manual', duplex: body && typeof body.getReader === 'function' ? 'half' : undefined, signal: AbortSignal.timeout(body ? 30 * 60000 : TIMEOUT) });
    } catch (e) { throw err(`WebDAV nicht erreichbar (${e.cause ? e.cause.code || e.cause.message : e.message}).`); }
    if (r.status >= 300 && r.status < 400) throw err(`Die Adresse leitet weiter${r.headers.get('location') ? ' nach ' + String(r.headers.get('location')).slice(0, 120) : ''} – bitte die endgültige Adresse eintragen.`);
    if (r.status === 401) throw err('WebDAV: Benutzername oder Passwort falsch.');
    if (!ok.includes(r.status)) throw err(`WebDAV ${what}: ${r.status} ${r.statusText}`, { status: r.status });
    return r;
  };
  const mkdirs = async dir => {
    let cur = '';
    for (const part of dir.split('/').filter(Boolean)) {
      cur += '/' + part;
      await req('MKCOL', cur + '/', { ok: [201, 405, 301, 200], what: 'Ordner anlegen' });   // 405 = gibt es schon
    }
  };
  const dirOf = sub => joinPath(t.folder, sub);
  return {
    async test() {
      await mkdirs(dirOf('Komplett'));
      const p = joinPath(dirOf('Komplett'), '.vh-test');
      await req('PUT', p, { body: 'ok', headers: { 'Content-Type': 'text/plain' }, what: 'Testdatei schreiben' });
      await req('DELETE', p, { ok: [200, 204, 404], what: 'Testdatei löschen' });
      return { ok: true };
    },
    async put(sub, name, src) {
      if (!NAME_OK.test(name)) throw err('Ungültiger Dateiname.');
      await mkdirs(dirOf(sub));
      const size = src.path ? fs.statSync(src.path).size : src.buffer.length;
      const body = src.path ? Readable.toWeb(fs.createReadStream(src.path)) : src.buffer;
      await req('PUT', joinPath(dirOf(sub), name), { body, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(size) }, what: 'Hochladen' });
    },
    async list(sub) {
      let r;
      try { r = await req('PROPFIND', dirOf(sub) + '/', { headers: { Depth: '1', 'Content-Type': 'application/xml' }, body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>', ok: [207], what: 'Ordner lesen' }); }
      catch (e) { if (e.status === 404) return []; throw e; }
      const xml = await r.text();
      const out = [];
      for (const block of xml.split(/<(?:[\w-]+:)?response[\s>]/i).slice(1)) {
        const h = (block.match(/<(?:[\w-]+:)?href[^>]*>([^<]*)</i) || [])[1];
        if (!h || /<(?:[\w-]+:)?collection/i.test(block)) continue;
        let name; try { name = decodeURIComponent(h.replace(/\/+$/, '').split('/').pop()); } catch (e) { continue; }
        const size = parseInt((block.match(/<(?:[\w-]+:)?getcontentlength[^>]*>(\d+)</i) || [])[1], 10) || 0;
        const lm = (block.match(/<(?:[\w-]+:)?getlastmodified[^>]*>([^<]*)</i) || [])[1];
        if (NAME_OK.test(name)) out.push({ name, size, mtime: lm ? new Date(lm).toISOString() : null });
      }
      return out;
    },
    async get(sub, name, dest, maxBytes = 4 * 1024 ** 3) {
      if (!NAME_OK.test(name)) throw err('Ungültiger Dateiname.');
      const r = await req('GET', joinPath(dirOf(sub), name), { ok: [200], what: 'Herunterladen' });
      let n = 0;
      const guard = new (require('stream').Transform)({ transform(c, e, cb) { n += c.length; cb(n > maxBytes ? err('Datei zu groß.') : null, c); } });
      await pipeline(Readable.fromWeb(r.body), guard, fs.createWriteStream(dest, { mode: 0o600 }));
      return n;
    },
    async remove(sub, name) { if (NAME_OK.test(name)) await req('DELETE', joinPath(dirOf(sub), name), { ok: [200, 204, 404], what: 'Löschen' }); },
    async close() { /* nichts */ },
  };
}

/* ---------- SFTP ---------- */
function sftp(t, secret) {
  const Client = require('ssh2-sftp-client');
  let c = null, seen = null;
  const connect = async ({ learn = false } = {}) => {
    if (c) return;
    const cl = new Client();
    const cfg = { host: t.host.replace(/^\[|\]$/g, ''), port: t.port, username: t.user, readyTimeout: 20000, retries: 0,
      hostVerifier: key => { seen = sshFingerprint(key); return !learn && Boolean(t.hostKey) && seen === t.hostKey; } };
    if (t.auth === 'key') cfg.privateKey = secret; else cfg.password = secret || '';
    try { await cl.connect(cfg); }
    catch (e) {
      try { await cl.end(); } catch (x) { /* egal */ }
      if (seen && (!t.hostKey || learn)) throw err('Fingerabdruck des Servers bitte prüfen und bestätigen.', { fingerprint: seen, needConfirm: true });
      if (seen && seen !== t.hostKey) throw err(`Der Server meldet sich mit einem ANDEREN Schlüssel (${seen}) als bestätigt. Aus Sicherheitsgründen abgebrochen – falls der Server neu eingerichtet wurde, das Ziel bearbeiten und den neuen Fingerabdruck bestätigen.`, { fingerprint: seen, changed: true });
      if (/authentication/i.test(e.message)) throw err('SFTP: Benutzername, Passwort oder Schlüssel falsch.');
      throw err('SFTP nicht erreichbar: ' + e.message.replace(/^connect: /, '').slice(0, 160));
    }
    c = cl;
  };
  const dirOf = sub => joinPath(t.folder, sub);
  const mk = async dir => { if (!(await c.exists(dir))) await c.mkdir(dir, true); };
  return {
    async test() {
      if (!t.hostKey) { await connect({ learn: true }).catch(e => { throw e; }); }
      await connect(); await mk(dirOf('Komplett'));
      const p = joinPath(dirOf('Komplett'), '.vh-test');
      await c.put(Buffer.from('ok'), p); await c.delete(p, true);
      return { ok: true, fingerprint: seen };
    },
    async put(sub, name, src) {
      if (!NAME_OK.test(name)) throw err('Ungültiger Dateiname.');
      await connect(); await mk(dirOf(sub));
      const tmp = joinPath(dirOf(sub), '.' + name + '.part');
      await c.put(src.path ? fs.createReadStream(src.path) : src.buffer, tmp);
      if (await c.exists(joinPath(dirOf(sub), name))) await c.delete(joinPath(dirOf(sub), name), true);
      await c.rename(tmp, joinPath(dirOf(sub), name));
    },
    async list(sub) {
      await connect();
      if (!(await c.exists(dirOf(sub)))) return [];
      return (await c.list(dirOf(sub))).filter(e => e.type === '-' && NAME_OK.test(e.name)).map(e => ({ name: e.name, size: e.size, mtime: e.modifyTime ? new Date(e.modifyTime).toISOString() : null }));
    },
    async get(sub, name, dest, maxBytes = 4 * 1024 ** 3) {
      if (!NAME_OK.test(name)) throw err('Ungültiger Dateiname.');
      await connect();
      const st = await c.stat(joinPath(dirOf(sub), name));
      if (st.size > maxBytes) throw err('Datei zu groß.');
      await c.get(joinPath(dirOf(sub), name), fs.createWriteStream(dest, { mode: 0o600 }));
      return st.size;
    },
    async remove(sub, name) { if (NAME_OK.test(name)) { await connect(); await c.delete(joinPath(dirOf(sub), name), true); } },
    async close() { if (c) { try { await c.end(); } catch (e) { /* egal */ } c = null; } },
  };
}

/* ---------- FTP / FTPS ---------- */
function ftp(t, secret) {
  const basic = require('basic-ftp');
  let c = null, seen = null;
  const connect = async ({ learn = false } = {}) => {
    if (c) return;
    const cl = new basic.Client(TIMEOUT);
    const host = t.host.replace(/^\[|\]$/g, '');
    const tlsOpt = { rejectUnauthorized: false, servername: /^[\d.]+$|:/.test(host) ? undefined : host };
    try {
      if (t.mode === 'ftps-implicit') await cl.connectImplicitTLS(host, t.port, tlsOpt);
      else { await cl.connect(host, t.port); if (t.mode === 'ftps') await cl.useTLS(tlsOpt); }
      if (t.mode !== 'ftp') {
        // Zertifikat prüfen, BEVOR Benutzer und Passwort gesendet werden
        const cert = cl.ftp.socket.getPeerCertificate && cl.ftp.socket.getPeerCertificate();
        seen = cert && cert.fingerprint256 ? cert.fingerprint256 : null;
        if (!seen) throw err('FTPS: Der Server hat kein Zertifikat gesendet.');
        if (learn || !t.certFp) throw err('Fingerabdruck des Zertifikats bitte prüfen und bestätigen.', { fingerprint: seen, needConfirm: true });
        if (seen !== t.certFp) throw err(`Der Server meldet sich mit einem ANDEREN Zertifikat (${seen.slice(0, 23)}…) als bestätigt. Aus Sicherheitsgründen abgebrochen – falls das Zertifikat erneuert wurde, das Ziel bearbeiten und neu bestätigen.`, { fingerprint: seen, changed: true });
      }
      await cl.login(t.user, secret || '');
      await cl.useDefaultSettings();
    } catch (e) {
      cl.close();
      if (e.needConfirm || e.changed) throw e;
      if (/530|login|password/i.test(e.message)) throw err('FTP: Benutzername oder Passwort falsch.');
      if (/AUTH|TLS|SSL/i.test(e.message) && t.mode === 'ftps') throw err('Der Server unterstützt kein FTPS (AUTH TLS). Bei der FRITZ!Box: FTP-Zugriff erlauben und „verschlüsselt“ aktivieren.');
      throw err('FTP nicht erreichbar: ' + String(e.message).slice(0, 160));
    }
    c = cl;
  };
  const dirOf = sub => joinPath(t.folder, sub);
  const go = async sub => { await c.ensureDir(dirOf(sub)); };   // wechselt auch in den Ordner
  return {
    async test() {
      await connect(); await go('Komplett');
      await c.uploadFrom(Readable.from([Buffer.from('ok')]), '.vh-test'); await c.remove('.vh-test', true);
      return { ok: true, fingerprint: seen };
    },
    async put(sub, name, src) {
      if (!NAME_OK.test(name)) throw err('Ungültiger Dateiname.');
      await connect(); await go(sub);
      await c.uploadFrom(src.path ? src.path : Readable.from([src.buffer]), '.' + name + '.part');
      await c.remove(name, true);
      await c.rename('.' + name + '.part', name);
    },
    async list(sub) {
      await connect();
      try { await c.cd(dirOf(sub)); } catch (e) { return []; }
      return (await c.list()).filter(e => e.isFile && NAME_OK.test(e.name)).map(e => ({ name: e.name, size: e.size, mtime: e.modifiedAt ? e.modifiedAt.toISOString() : null }));
    },
    async get(sub, name, dest, maxBytes = 4 * 1024 ** 3) {
      if (!NAME_OK.test(name)) throw err('Ungültiger Dateiname.');
      await connect(); await c.cd(dirOf(sub));
      const size = await c.size(name).catch(() => 0);
      if (size > maxBytes) throw err('Datei zu groß.');
      await c.downloadTo(fs.createWriteStream(dest, { mode: 0o600 }), name);
      return size;
    },
    async remove(sub, name) { if (NAME_OK.test(name)) { await connect(); await c.cd(dirOf(sub)); await c.remove(name, true); } },
    async close() { if (c) { c.close(); c = null; } },
  };
}

/* ---------- Dropbox (vorhandene Anbindung in dieselbe Form gebracht) ---------- */
function dropboxTarget(cfg) {
  const dropbox = require('./dropbox');
  const dirOf = sub => `${cfg.folder}/${sub}`;
  const known = new Map();   // Dateiname → path_lower aus der letzten Liste (Dropbox unterscheidet Groß/klein nicht)
  return {
    async test() { await dropbox.account(cfg); return { ok: true }; },
    async put(sub, name, src) { if (src.path) await dropbox.uploadFile(cfg, `${dirOf(sub)}/${name}`, src.path); else await dropbox.upload(cfg, `${dirOf(sub)}/${name}`, src.buffer); },
    async list(sub) { return (await dropbox.listFolder(cfg, dirOf(sub))).filter(e => e['.tag'] === 'file').map(e => { if (e.path_lower) known.set(sub + '/' + e.name, e.path_lower); return { name: e.name, size: e.size, mtime: e.server_modified || null }; }); },
    async get(sub, name, dest) { return dropbox.downloadFile(cfg, `${dirOf(sub)}/${name}`, dest); },
    async remove(sub, name) { await dropbox.remove(cfg, known.get(sub + '/' + name) || `${dirOf(sub)}/${name}`); },
    async close() { /* nichts */ },
  };
}

function open(t, secret) {
  if (t.type === 'webdav') return webdav(t, secret);
  if (t.type === 'sftp') return sftp(t, secret);
  if (t.type === 'ftp') return ftp(t, secret);
  throw err('Unbekannte Art des Ziels.');
}
/** Für die Anzeige: nie das Geheimnis, nur ob eins hinterlegt ist */
const publicView = (t, hasSecret) => ({ ...t, hasSecret: Boolean(hasSecret), typeLabel: t.type === 'ftp' ? (t.mode === 'ftp' ? 'FTP' : 'FTPS') : TYPES[t.type] });

module.exports = { TYPES, clean, open, dropboxTarget, publicView, cleanFolder, sshFingerprint };
