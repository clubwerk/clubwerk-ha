'use strict';
/**
 * Google Drive als Sicherungsziel (neben Dropbox, WebDAV, SFTP, FTPS – eingebunden über targets.js).
 *  - Eigene Google-App des Vereins (Google Cloud Console), Client-Typ „Fernseher und Geräte mit begrenzter Eingabe“
 *  - Anmeldung per Geräte-Ablauf: Clubwerk zeigt einen Code, man bestätigt unter google.com/device am Handy oder Rechner,
 *    Clubwerk fragt im Hintergrund nach. Keine Weiterleitung an eine Adresse von Clubwerk nötig (läuft lokal).
 *  - Scope nur drive.file: Clubwerk sieht ausschließlich die Dateien, die es selbst angelegt hat
 *  - Große Dateien als Resumable Upload in Stücken mit Wiederaufnahme, Prüfsumme (md5) danach verglichen
 *  - Ratenbegrenzung (429, 403 userRateLimitExceeded/rateLimitExceeded) und Störungen (5xx) mit Backoff
 * Token, Client-Secret und Gerätecode stehen nie in Meldungen (scrub).
 */
const fs = require('fs');
const crypto = require('crypto');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const OAUTH = process.env.GDRIVE_OAUTH || 'https://oauth2.googleapis.com';
const API = process.env.GDRIVE_API || 'https://www.googleapis.com';
const UPLOAD = process.env.GDRIVE_UPLOAD || API;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const BACKOFF = Math.max(1, Number(process.env.GDRIVE_BACKOFF_MS) || 1000);
const CHUNK = Math.max(1024, Number(process.env.GDRIVE_CHUNK) || 8 * 1024 * 1024);   // Google verlangt ein Vielfaches von 256 KiB (8 MiB); kleiner nur im Test
const TRIES = 6;
const MIN_INTERVAL = Math.max(1, Number(process.env.GDRIVE_MIN_INTERVAL) || 5);   // Sekunden zwischen zwei Nachfragen beim Geräte-Ablauf (Google: 5)
const DEFAULT_FOLDER = '/Clubwerk-Sicherung';
const CLIENT_ID_RE = /^[\w.-]{6,150}\.apps\.googleusercontent\.com$/;
const SECRET_RE = /^[\w-]{10,100}$/;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = (i, retryAfter) => sleep(retryAfter > 0 ? Math.min(retryAfter * 1000, 60000) : BACKOFF * 2 ** i + Math.floor(Math.random() * BACKOFF));
const err = (msg, extra = {}) => Object.assign(new Error(msg), extra);

/** Keine Geheimnisse in Meldungen: Zugangstoken (ya29.), Refresh-Token (1//), Client-Secret (GOCSPX-), Gerätecodes, lange Zeichenketten */
const scrub = s => String(s || '')
  .replace(/\bBearer\s+\S+/gi, 'Bearer …').replace(/\bya29\.[\w.-]+/g, 'ya29.…').replace(/\b1\/\/[\w.-]+/g, '1//…')
  .replace(/GOCSPX-[\w-]+/g, 'GOCSPX-…').replace(/\bAH-[\w-]{8,}/g, 'AH-…').replace(/upload_id=[\w-]+/g, 'upload_id=…').replace(/[\w-]{40,}/g, '…');

/** Nächster Schritt: wo man die Google-App ändert */
const CONSOLE = 'Google Cloud Console (console.cloud.google.com)';
const RECONNECT = 'Danach in Clubwerk beim Ziel „Neu verbinden …“.';

/** Bekannte Fälle in Alltagssprache mit dem nächsten Schritt; sonst null */
function explain(status, data, what, cfg) {
  const e = data && typeof data.error === 'object' ? data.error : {};
  const oauth = typeof data.error === 'string' ? data.error : '';
  const reasons = [...(Array.isArray(e.errors) ? e.errors.map(x => x && x.reason) : []), ...(Array.isArray(e.details) ? e.details.map(x => x && x.reason) : []), e.status].filter(Boolean).map(String);
  const has = r => reasons.includes(r);
  if (oauth === 'invalid_grant') {
    if (what === 'Anmeldung') return 'Der Code ist abgelaufen oder wurde schon benutzt. Bitte noch einmal „Bei Google anmelden“.';
    const age = cfg && cfg.connectedAt ? (Date.now() - Date.parse(cfg.connectedAt)) / 86400000 : null;
    if (age !== null && age >= 6.5 && age < 8.5) return `Die Anmeldung bei Google ist genau eine Woche nach dem Verbinden abgelaufen. Das passiert, wenn die Google-App noch im Status „Testen“ steht – Google lässt die Anmeldung von Testnutzern nach 7 Tagen ablaufen. Bitte in der ${CONSOLE} unter Google Auth Platform › Zielgruppe „App veröffentlichen“ klicken. ${RECONNECT}`;
    return `Die Verbindung zu Google Drive gilt nicht mehr – der Zugriff wurde im Google-Konto entfernt, das Konto geändert, die Verbindung 6 Monate nicht benutzt oder die Google-App steht noch im Status „Testen“ (dann läuft sie nach 7 Tagen ab; in der ${CONSOLE} unter Google Auth Platform › Zielgruppe „App veröffentlichen“). ${RECONNECT}`;
  }
  if (oauth === 'invalid_client' || oauth === 'unauthorized_client') return `Google kennt diese Client-ID nicht, das Client-Secret stimmt nicht oder der Client hat den falschen Typ. In der ${CONSOLE} unter Google Auth Platform › Clients einen Client vom Typ „Fernseher und Geräte mit begrenzter Eingabe“ anlegen und dessen Client-ID und Client-Secret eintragen.`;
  if (oauth === 'access_denied') return 'Die Anmeldung wurde abgelehnt. Entweder wurde bei Google „Abbrechen“ gewählt, oder das Google-Konto ist nicht als Testnutzer eingetragen (Google Auth Platform › Zielgruppe › Testnutzer) – bitte eintragen oder die App veröffentlichen und noch einmal anmelden.';
  if (oauth === 'org_internal') return 'Die Google-App ist auf „Intern“ gestellt und lässt nur Konten der eigenen Organisation zu. Bitte in Google Auth Platform › Zielgruppe den Nutzertyp „Extern“ wählen oder ein Konto der Organisation verwenden.';
  if (oauth === 'admin_policy_enforced') return 'Der Administrator dieses Google-Kontos (Google Workspace) erlaubt den Zugriff nicht. Bitte den Administrator fragen oder ein anderes Google-Konto verwenden.';
  if (oauth === 'invalid_scope') return 'Google lässt die Berechtigung „drive.file“ für diesen Client nicht zu. Bitte einen Client vom Typ „Fernseher und Geräte mit begrenzter Eingabe“ verwenden.';
  if (has('SERVICE_DISABLED') || has('accessNotConfigured')) return `Die Google Drive API ist im Projekt nicht aktiviert. Bitte in der ${CONSOLE} unter APIs und Dienste › Bibliothek „Google Drive API“ suchen und „Aktivieren“ klicken, dann „Testen“.`;
  if (has('storageQuotaExceeded')) return 'Der Speicher im Google-Konto ist voll (Drive, Gmail und Google Fotos teilen sich den Speicher). Bitte unter drive.google.com Platz schaffen oder mehr Speicher buchen; ältere Sicherungen räumt Clubwerk selbst auf, wenn eine Sicherung durchgeht.';
  if (has('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || has('insufficientPermissions') || has('insufficientScopes')) return `Der Verbindung fehlt die Berechtigung für Google Drive (beim Anmelden nicht erlaubt). ${RECONNECT} Beim Anmelden das Häkchen für Google Drive setzen.`;
  if (has('appNotAuthorizedToFile') || has('insufficientFilePermissions')) return 'Clubwerk darf diese Datei nicht ändern – mit „drive.file“ sieht Clubwerk nur Dateien, die es selbst angelegt hat. Bitte den Ordner nicht von Hand in Drive anlegen oder verschieben; Clubwerk legt ihn selbst an.';
  if (has('dailyLimitExceeded')) return `Das Tageskontingent des Google-Projekts ist aufgebraucht. Morgen klappt es wieder; die Grenze steht in der ${CONSOLE} unter APIs und Dienste › Google Drive API › Kontingente.`;
  if (has('domainPolicy')) return 'Der Administrator dieses Google-Kontos erlaubt Clubwerk den Zugriff auf Drive nicht. Bitte den Administrator fragen.';
  if (status === 429 || has('userRateLimitExceeded') || has('rateLimitExceeded') || has('rate_limit_exceeded')) return 'Google bremst gerade (zu viele Anfragen). Clubwerk hat mehrmals mit Pause wiederholt. Bitte später noch einmal „Testen“; die nächste nächtliche Sicherung versucht es erneut.';
  if (status === 401 || has('authError')) return `Google hat die Anmeldung nicht angenommen. ${RECONNECT}`;
  if (status >= 500) return 'Google meldet gerade eine Störung. Clubwerk hat mehrmals wiederholt. Bitte später noch einmal „Testen“.';
  return null;
}
const rateLimited = (status, data) => {
  const e = data && typeof data.error === 'object' ? data.error : {};
  const rs = (Array.isArray(e.errors) ? e.errors : []).map(x => x && x.reason);
  return status === 429 || status >= 500 || (status === 403 && (rs.includes('userRateLimitExceeded') || rs.includes('rateLimitExceeded') || data.error === 'rate_limit_exceeded'));
};

/** Fehlermeldung mit Technik zuerst (Protokolle werden gekürzt): HTTP-Status, Grund von Google, Kennung – nie Token */
function failure(r, data, what, cfg) {
  data = data && typeof data === 'object' ? data : { raw: String(data || '') };
  const e = typeof data.error === 'object' && data.error ? data.error : {};
  const reason = (Array.isArray(e.errors) && e.errors[0] && e.errors[0].reason) || e.status || (typeof data.error === 'string' ? data.error : '');
  const summary = e.message || data.error_description || reason || data.raw || r.statusText || '';
  const rid = String(r.headers.get('x-guploader-uploadid') || r.headers.get('x-goog-request-id') || '').replace(/[^\w-]/g, '').slice(0, 40);
  const hint = explain(r.status, data, what, cfg);
  const sum = scrub(summary).replace(/\s+/g, ' ').slice(0, 160);
  const tech = [`HTTP ${r.status}`, reason ? scrub(reason).slice(0, 40) : '', rid ? `Request-Id ${rid}` : ''].filter(Boolean).join(', ');
  const oauth = typeof data.error === 'string' ? data.error : '';
  return err(`${what} (Google: ${tech}): ${hint || sum}`, { status: r.status, reason: oauth || reason, requestId: rid,
    reconnect: what !== 'Anmeldung' && (oauth === 'invalid_grant' || oauth === 'invalid_client' || oauth === 'unauthorized_client') });
}

/** Nur echte Google-Adressen (bzw. im Test die eingestellten Basis-Adressen) für Weiterleitungen und Upload-Sitzungen */
function googleHost(u) {
  let x; try { x = new URL(String(u || '')); } catch (e) { return false; }
  if ([API, UPLOAD].some(b => { try { return new URL(b).origin === x.origin; } catch (e) { return false; } })) return true;
  return x.protocol === 'https:' && /(^|\.)(googleapis\.com|googleusercontent\.com)$/i.test(x.hostname);
}
async function readJson(r) { const text = await r.text(); try { return JSON.parse(text); } catch (e) { return { raw: text.slice(0, 300) }; } }

/** Eine Anfrage mit Backoff bei Ratenbegrenzung, Störung und Netzfehlern (nur ohne Datenstrom im Körper) */
async function call(url, opts, what, cfg, { tries = TRIES, timeout = 60000, raw = false } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    let r;
    try { r = await fetch(url, { ...opts, redirect: 'manual', signal: AbortSignal.timeout(timeout) }); }
    catch (e) { last = err(`${what}: Google nicht erreichbar (${scrub(e.cause ? e.cause.code || e.cause.message : e.message)}).`); if (i < tries - 1) { await wait(i); continue; } throw last; }
    // Herunterladen: Google darf auf einen Download-Server weiterleiten – nur zu Google-Hosts und ohne Token (fetch bekommt keine Kopfzeilen mit)
    if (raw && r.status >= 300 && r.status < 400 && googleHost(r.headers.get('location'))) {
      try { r = await fetch(r.headers.get('location'), { redirect: 'manual', signal: AbortSignal.timeout(timeout) }); }
      catch (e) { last = err(`${what}: Google nicht erreichbar (${scrub(e.cause ? e.cause.code || e.cause.message : e.message)}).`); if (i < tries - 1) { await wait(i); continue; } throw last; }
    }
    if (r.ok && raw) return r;
    if (r.ok) { const d = r.status === 204 ? {} : await readJson(r); return d; }
    const data = await readJson(r);
    last = failure(r, data, what, cfg);
    if (rateLimited(r.status, data) && i < tries - 1) { await wait(i, Number(r.headers.get('retry-after'))); continue; }
    throw last;
  }
  throw last;
}
const form = o => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });

/* ---------- Anmeldung (Geräte-Ablauf) ---------- */
function checkClient(clientId, clientSecret) {
  if (!CLIENT_ID_RE.test(String(clientId || ''))) throw err('Die Client-ID sieht nicht richtig aus – sie endet auf „.apps.googleusercontent.com“.');
  if (!SECRET_RE.test(String(clientSecret || ''))) throw err('Das Client-Secret sieht nicht richtig aus (es beginnt meist mit „GOCSPX-“).');
}
/** Code bei Google anfordern → { deviceCode, userCode, url, expiresIn, interval } */
async function deviceStart(clientId, clientSecret) {
  checkClient(clientId, clientSecret);
  const d = await call(`${OAUTH}/device/code`, form({ client_id: clientId, scope: SCOPE }), 'Anmeldung', null, { tries: 3 });
  if (!d.device_code || !d.user_code) throw err('Anmeldung: Google hat keinen Code geliefert.');
  const url = /^https:\/\/(www\.)?google\.com\/device\b/.test(String(d.verification_url || '')) ? d.verification_url : 'https://www.google.com/device';
  return { deviceCode: String(d.device_code), userCode: String(d.user_code).slice(0, 20), url, expiresIn: Math.min(1800, Number(d.expires_in) || 1800), interval: Math.max(MIN_INTERVAL, Math.min(60, Number(d.interval) || 5)) };
}
/** Einmal nachfragen → { refresh } oder { pending: true } / { slow: true }; Ablehnung/Ablauf als Fehler mit .final */
async function devicePoll(clientId, clientSecret, deviceCode) {
  let r;
  try { r = await fetch(`${OAUTH}/token`, { ...form({ client_id: clientId, client_secret: clientSecret, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }), signal: AbortSignal.timeout(30000) }); }
  catch (e) { return { pending: true, offline: true }; }   // kurz nicht erreichbar → beim nächsten Mal wieder
  const d = await readJson(r);
  if (r.ok) { if (!d.refresh_token) throw err('Anmeldung: Google hat kein dauerhaftes Token geliefert.', { final: true }); return { refresh: String(d.refresh_token) }; }
  if (d.error === 'authorization_pending') return { pending: true };
  if (d.error === 'slow_down' || d.error === 'rate_limit_exceeded' || r.status === 429) return { slow: true };
  if (d.error === 'expired_token') throw err('Der Code ist abgelaufen, ohne dass die Anmeldung bestätigt wurde. Bitte noch einmal „Bei Google anmelden“.', { final: true, expired: true });
  if (r.status >= 500) return { pending: true };
  throw Object.assign(failure(r, d, 'Anmeldung', null), { final: true, denied: d.error === 'access_denied' });
}

/* ---------- Zugangstoken (im Speicher, nie auf der Platte) ---------- */
const tokens = new Map();   // Hash(clientId|refresh) → { token, until }
const tkey = cfg => crypto.createHash('sha256').update(`${cfg.clientId}|${cfg.refresh}`).digest('hex');
async function accessToken(cfg, fresh = false) {
  if (!cfg || !cfg.refresh) throw err('Google Drive ist nicht verbunden. Bitte beim Ziel „Neu verbinden …“.', { reconnect: true });
  const k = tkey(cfg), c = tokens.get(k);
  if (!fresh && c && c.until > Date.now() + 60000) return c.token;
  const d = await call(`${OAUTH}/token`, form({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: cfg.refresh, grant_type: 'refresh_token' }), 'Token', cfg, { tries: 4 });
  if (!d.access_token) throw err('Token: Google hat kein Zugangstoken geliefert.');
  tokens.set(k, { token: d.access_token, until: Date.now() + (Number(d.expires_in) || 3600) * 1000 });
  return d.access_token;
}
/** Drive-Anfrage mit Token; ein abgelaufenes Zugangstoken (401) wird einmal erneuert */
async function api(cfg, method, path, what, { body, json, raw, timeout } = {}) {
  for (let i = 0; i < 2; i++) {
    const t = await accessToken(cfg, i > 0);
    const headers = { Authorization: `Bearer ${t}` };
    if (json !== undefined) headers['Content-Type'] = 'application/json; charset=UTF-8';
    try { return await call(`${API}${path}`, { method, headers, body: json !== undefined ? JSON.stringify(json) : body }, what, cfg, { raw, timeout }); }
    catch (e) { if (e.status === 401 && i === 0) continue; throw e; }
  }
}

/* ---------- Ordner ---------- */
const q = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function findAll(cfg, query, fields = 'id,name,size,md5Checksum,modifiedTime,mimeType') {
  const out = []; let page = '';
  do {
    const p = new URLSearchParams({ q: query, fields: `nextPageToken,files(${fields})`, pageSize: '1000', spaces: 'drive' });
    if (page) p.set('pageToken', page);
    const d = await api(cfg, 'GET', `/drive/v3/files?${p}`, 'Ordner lesen');
    out.push(...(Array.isArray(d.files) ? d.files : []));
    page = d.nextPageToken || '';
  } while (page && out.length < 20000);
  return out;
}
/** Ordnerkette (/A/B) suchen und bei create anlegen → id oder null. Mit drive.file sieht Clubwerk nur eigene Ordner. */
async function folderId(cfg, path, create, memo = new Map()) {
  let parent = 'root', cur = '';
  for (const part of String(path).split('/').filter(Boolean)) {
    cur += '/' + part;
    if (memo.has(cur)) { parent = memo.get(cur); continue; }
    const hit = (await findAll(cfg, `name = '${q(part)}' and mimeType = '${FOLDER_MIME}' and '${q(parent)}' in parents and trashed = false`, 'id,name,createdTime'))
      .sort((a, b) => String(a.createdTime || '').localeCompare(String(b.createdTime || '')))[0];
    if (hit) parent = hit.id;
    else if (!create) return null;
    else parent = (await api(cfg, 'POST', '/drive/v3/files?fields=id', 'Ordner anlegen', { json: { name: part, mimeType: FOLDER_MIME, parents: [parent] } })).id;
    memo.set(cur, parent);
  }
  return parent;
}
async function listIn(cfg, parent) {
  return (await findAll(cfg, `'${q(parent)}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`))
    .map(f => ({ id: f.id, name: String(f.name), size: f.size != null ? Number(f.size) : null, md5: f.md5Checksum || null, mtime: f.modifiedTime || null }));
}

/* ---------- Hochladen (Resumable Upload) ---------- */
const md5File = file => new Promise((res, rej) => { const h = crypto.createHash('md5'); fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
/** Wie viel ist schon angekommen? Range: bytes=0-N → N+1; ohne Range → 0; fertig → { done } */
function rangeOf(r) { const m = String(r.headers.get('range') || '').match(/bytes=0-(\d+)/); return m ? Number(m[1]) + 1 : 0; }

async function uploadOnce(cfg, parent, name, src, size, label) {
  const t = await accessToken(cfg);
  const start = await call(`${UPLOAD}/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,md5Checksum`, { method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify({ name, parents: [parent] }) }, label, cfg, { raw: true });
  const session = start.headers.get('location');
  if (!session || !googleHost(session)) throw err(`${label}: Google hat keine Upload-Adresse geliefert.`);
  const fd = src.path ? fs.openSync(src.path, 'r') : null;
  const read = (off, len) => { if (!fd) return src.buffer.subarray(off, off + len); const b = Buffer.alloc(len); const n = fs.readSync(fd, b, 0, len, off); return b.subarray(0, n); };
  try {
    let off = 0, fails = 0;
    for (;;) {
      const len = Math.min(CHUNK, size - off);
      const body = read(off, len);
      let r = null, netErr = null;
      try { r = await fetch(session, { method: 'PUT', headers: { 'Content-Length': String(len), 'Content-Range': `bytes ${off}-${off + len - 1}/${size}` }, body, redirect: 'manual', signal: AbortSignal.timeout(10 * 60000) }); }
      catch (e) { netErr = e; }
      if (r && (r.status === 200 || r.status === 201)) return await readJson(r);
      if (r && r.status === 308) { off = rangeOf(r); fails = 0; continue; }
      if (r && r.status === 404) throw err('neu', { restart: true });   // Sitzung abgelaufen → von vorn
      const data = r ? await readJson(r) : {};
      if (r && !rateLimited(r.status, data)) throw failure(r, data, label, cfg);
      // abgebrochen, gebremst oder Störung: warten, nachfragen, wie viel angekommen ist, und dort weitermachen
      if (++fails >= TRIES) throw r ? failure(r, data, label, cfg) : err(`${label}: Die Verbindung zu Google bricht immer wieder ab (${scrub(netErr.cause ? netErr.cause.code || netErr.cause.message : netErr.message)}).`);
      await wait(fails - 1, r ? Number(r.headers.get('retry-after')) : 0);
      let s = null;
      try { s = await fetch(session, { method: 'PUT', headers: { 'Content-Length': '0', 'Content-Range': `bytes */${size}` }, redirect: 'manual', signal: AbortSignal.timeout(60000) }); }
      catch (e) { continue; }   // Nachfrage selbst gescheitert → nächster Versuch ab gleicher Stelle
      if (s.status === 200 || s.status === 201) return await readJson(s);
      if (s.status === 308) off = rangeOf(s);
      else if (s.status === 404) throw err('neu', { restart: true });
    }
  } finally { if (fd !== null) fs.closeSync(fd); }
}
/** Datei (Pfad oder Puffer) in den Ordner parent hochladen, Prüfsumme vergleichen, ältere gleichnamige Dateien entfernen */
async function upload(cfg, parent, name, src) {
  const size = src.path ? fs.statSync(src.path).size : src.buffer.length;
  if (!size) throw err('Leere Datei.');
  const md5 = src.path ? await md5File(src.path) : crypto.createHash('md5').update(src.buffer).digest('hex');
  const before = (await listIn(cfg, parent)).filter(f => f.name === name);
  const label = `Upload ${name}`;
  let f;
  try { f = await uploadOnce(cfg, parent, name, src, size, label); }
  catch (e) { if (!e.restart) throw e; f = await uploadOnce(cfg, parent, name, src, size, label); }
  if (!f || !f.id) throw err(`${label}: Google hat den Upload nicht bestätigt.`);
  if (f.size != null && Number(f.size) !== size) { await removeId(cfg, f.id).catch(() => {}); throw err(`${label}: Die Datei kam unvollständig an (${f.size} statt ${size} Bytes).`); }
  if (!f.md5Checksum || f.md5Checksum !== md5) { await removeId(cfg, f.id).catch(() => {}); throw err(`${label}: Die Prüfsumme bei Google stimmt nicht mit der Datei hier überein – die Datei wurde wieder entfernt. Die nächste Sicherung versucht es erneut.`); }
  for (const old of before) if (old.id !== f.id) await removeId(cfg, old.id).catch(() => {});   // „überschreiben“: erst nach geglücktem Upload
  return { id: f.id, size, md5 };
}

/* ---------- Herunterladen, Löschen ---------- */
async function download(cfg, file, dest, maxBytes = 4 * 1024 ** 3) {
  if (file.size != null && file.size > maxBytes) throw err('Datei zu groß.');
  const r = await api(cfg, 'GET', `/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, 'Herunterladen', { raw: true, timeout: 30 * 60000 });
  const h = crypto.createHash('md5'); let n = 0;
  const guard = new Transform({ transform(c, e, cb) { n += c.length; h.update(c); cb(n > maxBytes ? err('Datei zu groß.') : null, c); } });
  try { await pipeline(Readable.fromWeb(r.body), guard, fs.createWriteStream(dest, { mode: 0o600 })); }
  catch (e) { throw err(`Herunterladen: Die Verbindung zu Google ist abgebrochen (${scrub(e.message)}).`); }
  if (file.md5 && h.digest('hex') !== file.md5) throw err('Herunterladen: Die Prüfsumme der Datei von Google stimmt nicht – die Datei ist beschädigt angekommen.');
  return n;
}
async function removeId(cfg, id) { return api(cfg, 'DELETE', `/drive/v3/files/${encodeURIComponent(id)}`, 'Löschen'); }

async function account(cfg) {
  try { const d = await api(cfg, 'GET', '/drive/v3/about?fields=user(displayName,emailAddress)', 'Konto'); return String((d.user && d.user.emailAddress) || '').slice(0, 120); }
  catch (e) { return ''; }
}
/** Widerruf: Achtung, Google entzieht damit dem ganzen Projekt den Zugriff dieses Kontos */
async function revoke(cfg) {
  try { await fetch(`${OAUTH}/revoke`, { ...form({ token: cfg.refresh }), signal: AbortSignal.timeout(15000) }); } catch (e) { /* egal */ }
  tokens.delete(tkey(cfg));
}

/**
 * Ehrlicher Verbindungstest wie bei Dropbox: Ordner anlegen, Testdatei genauso hochladen wie die Sicherung,
 * wiederfinden, zurücklesen und vergleichen, wieder löschen.
 */
const PROBE = 'clubwerk-verbindungstest.txt';
async function probe(cfg, folder, memo = new Map()) {
  const dir = await folderId(cfg, `${folder}/Komplett`, true, memo);
  const body = Buffer.from(`Clubwerk-Verbindungstest ${new Date().toISOString()}\n`);
  const up = await upload(cfg, dir, PROBE, { buffer: body });
  const f = (await listIn(cfg, dir)).find(x => x.id === up.id);
  if (!f) throw err('Testdatei: Sie ist nach dem Hochladen in Google Drive nicht zu finden.');
  const r = await api(cfg, 'GET', `/drive/v3/files/${encodeURIComponent(f.id)}?alt=media`, 'Testdatei lesen', { raw: true });
  const back = Buffer.from(await r.arrayBuffer());
  await removeId(cfg, f.id);
  if (!back.equals(body)) throw err('Testdatei: Sie kam beim Zurücklesen anders an, als sie hochgeladen wurde.');
}

/** Geheimnis des Ziels (JSON) lesen/schreiben – Client-ID, Client-Secret, Refresh-Token, Zeitpunkt des Verbindens */
function parseSecret(s) { try { const o = JSON.parse(s || '{}'); return o && typeof o === 'object' ? { clientId: String(o.clientId || ''), clientSecret: String(o.clientSecret || ''), refresh: String(o.refresh || ''), connectedAt: String(o.connectedAt || '') } : {}; } catch (e) { return {}; } }
const makeSecret = o => JSON.stringify({ clientId: o.clientId, clientSecret: o.clientSecret, refresh: o.refresh, connectedAt: o.connectedAt || new Date().toISOString() });

module.exports = { MIN_INTERVAL, SCOPE, DEFAULT_FOLDER, scrub, explain, checkClient, deviceStart, devicePoll, accessToken, folderId, listIn, upload, download, removeId, account, revoke, probe, parseSecret, makeSecret, md5File };
