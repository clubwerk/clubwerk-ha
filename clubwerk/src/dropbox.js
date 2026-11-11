'use strict';
/**
 * Dropbox-Anbindung für die nächtliche Datensicherung (ein Sicherungsziel neben WebDAV/SFTP/FTPS, siehe targets.js).
 *  - Eigene Dropbox-App mit Zugriff nur auf ihren App-Ordner („App folder“)
 *  - Anmeldung per OAuth-Code (kein Passwort in der Verwaltung), gespeichert wird nur das Refresh-Token
 *  - Hochgeladen wird die verschlüsselte Komplettsicherung (Ordner „Komplett“) und optional lesbare Auszüge („Lesbar“);
 *    ältere Dateien räumt der Kern nach Generationen (täglich/wöchentlich/monatlich) auf
 */
const API = process.env.DROPBOX_API || 'https://api.dropboxapi.com';
const CONTENT = process.env.DROPBOX_CONTENT || 'https://content.dropboxapi.com';
const AUTHORIZE = 'https://www.dropbox.com/oauth2/authorize';

let cached = { key: null, token: null, until: 0 };

/** Dropbox-API-Arg darf nur ASCII enthalten → Umlaute als \uXXXX */
const asciiJson = o => JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

function authUrl(appKey) {
  return `${AUTHORIZE}?client_id=${encodeURIComponent(appKey)}&response_type=code&token_access_type=offline`;
}

/** Token und Secrets nie in Meldungen: Dropbox-Zugangstoken beginnen mit „sl.“, dazu lange Zeichenketten ohne Leerzeichen */
const scrub = s => String(s || '').replace(/\bBearer\s+\S+/gi, 'Bearer …').replace(/\bsl\.[\w.-]{8,}/g, 'sl.…').replace(/[\w-]{60,}/g, '…');

/** Tag-Kette aus dem error-Objekt, z. B. {".tag":"path","reason":{".tag":"insufficient_space"}} → ["path","insufficient_space"] */
function tagChain(e, depth = 0) {
  if (!e || typeof e !== 'object' || depth > 4) return [];
  const out = e['.tag'] ? [String(e['.tag'])] : [];
  for (const [k, v] of Object.entries(e)) if (k !== '.tag' && v && typeof v === 'object') { out.push(...tagChain(v, depth + 1)); break; }
  return out;
}

/** Nächster Schritt bei Schreibfehlern: die Häkchen der Dropbox-App (gelten erst nach neuem Verbinden) */
const PERM = 'In der Dropbox-App (dropbox.com/developers/apps) im Reiter Permissions files.content.write, files.content.read und files.metadata.read anhaken, Submit klicken und danach in Clubwerk „Dropbox neu verbinden …“.';

/** Bekannte Fälle in Alltagssprache mit dem nächsten Schritt; sonst null (dann zählt die Zusammenfassung von Dropbox) */
function explain(status, data, tags, what) {
  const has = t => tags.includes(t) || String(data.error_summary || '').includes(t + '/') || data.error === t;
  if (has('missing_scope')) {
    const scope = (data.error && data.error.required_scope) || 'files.content.write';
    return `Der Dropbox-App fehlt die Berechtigung „${scope}“. In der Dropbox-App (dropbox.com/developers/apps) im Reiter Permissions „${scope}“ anhaken und Submit klicken, danach in Clubwerk „Dropbox neu verbinden …“ – erst das neue Verbinden übernimmt die Berechtigung.`;
  }
  if (what === 'Anmeldung' && has('invalid_grant')) return 'Der Code von Dropbox ist falsch oder abgelaufen (er gilt nur kurz und nur einmal). Bitte noch einmal „Bei Dropbox freigeben“ und den neuen Code einfügen.';
  if (has('invalid_access_token') || has('expired_access_token') || has('invalid_grant')) return 'Die Verbindung zu Dropbox gilt nicht mehr (Zugriff in Dropbox entzogen oder App geändert). Bitte in Clubwerk „Dropbox neu verbinden …“.';
  if (has('invalid_client')) return 'App key oder App secret stimmen nicht. Bitte in Clubwerk „Dropbox neu verbinden …“ und die Schlüssel aus dem Reiter Settings der Dropbox-App neu eintragen.';
  if (has('user_suspended')) return 'Das Dropbox-Konto ist gesperrt. Bitte bei Dropbox anmelden und die Sperre klären.';
  if (has('insufficient_space')) return 'Der Speicher in Dropbox ist voll. Bitte in Dropbox Platz schaffen oder den Speicher erweitern.';
  if (has('no_write_permission') || has('team_folder') || has('operation_suppressed')) return `Dropbox erlaubt das Schreiben in diesen Ordner nicht. ${PERM} Außerdem prüfen, ob die Dropbox-App als „App folder“ angelegt ist.`;
  if (has('disallowed_name') || has('malformed_path')) return 'Dropbox lehnt den Datei- oder Ordnernamen ab. Bitte den Ordner in Clubwerk einfacher benennen (z. B. /Clubwerk).';
  if (has('too_many_write_operations') || status === 429) return 'Dropbox ist gerade ausgelastet. Bitte später noch einmal „Testen“; die nächste nächtliche Sicherung versucht es erneut.';
  if (has('email_not_verified') || has('email_unverified')) return 'Die E-Mail-Adresse des Dropbox-Kontos ist nicht bestätigt. Bitte bei Dropbox anmelden, die Bestätigungs-E-Mail anfordern und den Link darin öffnen, dann „Testen“.';
  if (status === 403) return 'Dropbox verweigert diesem Konto den Zugriff (z. B. Einschränkung durch ein Team- oder Firmenkonto). Bitte die Einstellungen des Dropbox-Kontos prüfen.';
  // „other“ kam in der Praxis, als in der Dropbox-App die Häkchen für Dateien fehlten (02.11.2026) – nicht 401 missing_scope
  if (status === 409 && tags[0] === 'other') return `Dropbox hat das Speichern abgelehnt, ohne einen Grund zu nennen. Häufigste Ursache: In der Dropbox-App fehlen Berechtigungen. ${PERM} Hilft das nicht: die E-Mail-Adresse des Dropbox-Kontos bestätigen und freien Speicher prüfen, sonst den Dropbox-Support mit der Request-Id fragen.`;
  if (status >= 500) return 'Dropbox meldet gerade eine Störung. Bitte später noch einmal „Testen“.';
  return null;
}

async function call(url, opts, what) {
  let r;
  try { r = await fetch(url, { ...opts, signal: AbortSignal.timeout(60000) }); }
  catch (e) { throw new Error(`${what}: Dropbox nicht erreichbar (${e.cause ? e.cause.code || e.cause.message : e.message}).`); }
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
  if (!r.ok) {
    data = data && typeof data === 'object' ? data : { raw: String(data) };
    const tags = tagChain(data.error);
    const summary = data.error_summary || data.error_description || (typeof data.error === 'string' ? data.error : '') || data.raw || r.statusText;
    const rid = String(r.headers.get('x-dropbox-request-id') || '').replace(/[^\w-]/g, '').slice(0, 40);
    const hint = explain(r.status, data, tags, what);
    // technische Angaben für die Fehlersuche: HTTP-Status, Zusammenfassung von Dropbox, Request-Id (nie das Token)
    const sum = scrub(summary).replace(/\s+/g, ' ').slice(0, 160);
    const tech = [`HTTP ${r.status}`, hint ? sum : '', rid ? `Request-Id ${rid}` : ''].filter(Boolean).join(', ');
    // Technik zuerst: Protokolleinträge werden gekürzt, Status und Request-Id sollen dort sicher stehen
    const err = new Error(`${what} (Dropbox: ${tech}): ${hint || sum}`);
    err.status = r.status; err.summary = data.error_summary || ''; err.tags = tags; err.requestId = rid;
    throw err;
  }
  return data;
}

/** Einmaligen Code aus dem Browser gegen ein dauerhaftes Refresh-Token tauschen */
async function exchangeCode(appKey, appSecret, code) {
  const body = new URLSearchParams({ code: String(code).trim(), grant_type: 'authorization_code', client_id: appKey, client_secret: appSecret });
  const d = await call(`${API}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 'Anmeldung');
  if (!d.refresh_token) throw new Error('Anmeldung: Dropbox hat kein dauerhaftes Token geliefert.');
  return d.refresh_token;
}

async function accessToken(cfg) {
  const key = cfg.appKey + '|' + cfg.refresh;
  if (cached.key === key && cached.until > Date.now() + 60000) return cached.token;
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cfg.refresh, client_id: cfg.appKey, client_secret: cfg.appSecret });
  const d = await call(`${API}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 'Token');
  cached = { key, token: d.access_token, until: Date.now() + (Number(d.expires_in) || 3600) * 1000 };
  return d.access_token;
}

async function rpc(cfg, path, args, what) {
  const t = await accessToken(cfg);
  return call(`${API}/2/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: args === null ? 'null' : JSON.stringify(args) }, what);
}

async function account(cfg) {
  const d = await rpc(cfg, 'users/get_current_account', null, 'Konto');
  return [d.name && d.name.display_name, d.email].filter(Boolean).join(' · ');
}

async function upload(cfg, path, buffer) {
  if (buffer.length > 140 * 1024 * 1024) throw new Error('Datei zu groß für den einfachen Upload.');
  const t = await accessToken(cfg);
  return call(`${CONTENT}/2/files/upload`, { method: 'POST', headers: {
    Authorization: `Bearer ${t}`, 'Content-Type': 'application/octet-stream',
    'Dropbox-API-Arg': asciiJson({ path, mode: 'overwrite', autorename: false, mute: true }),
  }, body: buffer }, `Upload ${path}`);
}

/** Datei von der Festplatte hochladen – große Dateien in Stücken (Upload-Sitzung), damit auch viele Belege passen */
async function uploadFile(cfg, dpath, file) {
  const fs = require('fs');
  const size = fs.statSync(file).size;
  if (size <= 100 * 1024 * 1024) return upload(cfg, dpath, fs.readFileSync(file));
  const CH = 32 * 1024 * 1024;
  const fd = fs.openSync(file, 'r');
  try {
    const read = (off, len) => { const b = Buffer.alloc(len); const n = fs.readSync(fd, b, 0, len, off); return b.subarray(0, n); };
    const post = async (endpoint, arg, body) => { const t = await accessToken(cfg); return call(`${CONTENT}/2/${endpoint}`, { method: 'POST', headers: {
      Authorization: `Bearer ${t}`, 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': asciiJson(arg) }, body }, `Upload ${dpath}`); };
    const first = read(0, CH);
    const { session_id } = await post('files/upload_session/start', { close: false }, first);
    let off = first.length;
    while (size - off > CH) { const b = read(off, CH); await post('files/upload_session/append_v2', { cursor: { session_id, offset: off }, close: false }, b); off += b.length; }
    const last = read(off, size - off);
    return await post('files/upload_session/finish', { cursor: { session_id, offset: off }, commit: { path: dpath, mode: 'overwrite', autorename: false, mute: true } }, last);
  } finally { fs.closeSync(fd); }
}

/** Datei aus Dropbox auf die Festplatte laden (gestreamt) */
async function downloadFile(cfg, dpath, dest, maxBytes = 4 * 1024 * 1024 * 1024) {
  const fs = require('fs'); const { Readable } = require('stream'); const { pipeline } = require('stream/promises');
  const t = await accessToken(cfg);
  let r;
  try { r = await fetch(`${CONTENT}/2/files/download`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Dropbox-API-Arg': asciiJson({ path: dpath }) }, signal: AbortSignal.timeout(30 * 60000) }); }
  catch (e) { throw new Error(`Herunterladen: Dropbox nicht erreichbar (${e.message}).`); }
  if (!r.ok) throw new Error(`Herunterladen: ${(await r.text()).slice(0, 200)}`);
  let n = 0;
  const guard = new (require('stream').Transform)({ transform(c, e, cb) { n += c.length; if (n > maxBytes) cb(new Error('Datei zu groß.')); else cb(null, c); } });
  await pipeline(Readable.fromWeb(r.body), guard, fs.createWriteStream(dest, { mode: 0o600 }));
  return n;
}

async function listFolder(cfg, folder) {
  let d;
  try { d = await rpc(cfg, 'files/list_folder', { path: folder === '/' ? '' : folder, recursive: false }, 'Ordner lesen'); }
  catch (e) { if (/not_found/.test(e.summary || e.message)) return []; throw e; }
  const out = [...d.entries];
  while (d.has_more) { d = await rpc(cfg, 'files/list_folder/continue', { cursor: d.cursor }, 'Ordner lesen'); out.push(...d.entries); }
  return out;
}

/**
 * Ehrlicher Verbindungstest: eine kleine Testdatei genauso hochladen wie die Sicherung (gleicher Ordner, gleiche Anfrage),
 * in der Liste wiederfinden und wieder löschen. Nur das Konto abzufragen sagte „Verbunden“, obwohl Schreiben scheiterte.
 */
const PROBE = 'clubwerk-verbindungstest.txt';
async function probe(cfg, folder) {
  const dir = `${folder === '/' ? '' : folder}/Komplett`;
  const body = Buffer.from(`Clubwerk-Verbindungstest ${new Date().toISOString()}\n`);
  await upload(cfg, `${dir}/${PROBE}`, body);
  const e = (await listFolder(cfg, dir)).find(x => String(x.name).toLowerCase() === PROBE);
  if (!e) throw new Error('Testdatei: Sie ist nach dem Hochladen in Dropbox nicht zu finden.');
  if (e.size != null && e.size !== body.length) throw new Error('Testdatei: Sie kam in Dropbox unvollständig an.');
  await remove(cfg, e.path_lower || `${dir}/${PROBE}`);
}

async function remove(cfg, path) { return rpc(cfg, 'files/delete_v2', { path }, `Löschen ${path}`); }

async function revoke(cfg) { try { await rpc(cfg, 'auth/token/revoke', null, 'Abmelden'); } catch (e) { /* egal */ } cached = { key: null, token: null, until: 0 }; }

/** Ordnername säubern: führender Schrägstrich, keine doppelten/abschließenden, keine verbotenen Zeichen */
function cleanFolder(f) {
  let s = String(f || '').replace(/\\/g, '/').replace(/[<>:"|?*\u0000-\u001f]/g, '').split('/').map(x => x.trim()).filter(x => x && x !== '.' && x !== '..').join('/');
  return '/' + s.slice(0, 200);
}

module.exports = { authUrl, exchangeCode, account, probe, upload, uploadFile, downloadFile, listFolder, remove, revoke, cleanFolder, asciiJson };
