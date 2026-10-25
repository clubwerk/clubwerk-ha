'use strict';
/**
 * Komplettsicherung (ab 2.13)
 * Eine einzige, verschlüsselte Datei mit allem, was Clubwerk ausmacht – unabhängig davon, welche Module
 * eingeschaltet sind: Datenbank (alle Module, Benutzer, Einstellungen, Logo), Belege, Artikelbilder und die
 * freigegebenen bzw. hochgeladenen Erweiterungen.
 *
 * Dateiformat .cwbackup (Sicherungen der Vorgängerversion: .vhsicherung mit "VHSICH01"):
 *   "CWSICH01" | Länge des Kopfes (4 Byte) | Kopf (JSON: Schlüsselableitung, IV, Schlüssel-Kennung, Datum)
 *   | verschlüsseltes tar.gz (AES-256-GCM) | Prüfwert (16 Byte)
 * Der Schlüssel wird mit scrypt aus dem Sicherungspasswort abgeleitet. Ohne dieses Passwort lässt sich die Datei
 * nicht lesen – und jede Veränderung fällt beim Entschlüsseln auf.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');

const MAGIC = Buffer.from('CWSICH01');
const MAGIC_ALT = [Buffer.from('VHSICH01')];   // Sicherungen der Vorgängerversion („Vereinsheim“) lassen sich weiter einspielen
const EXT = '.cwbackup';
const KDF = { N: 32768, r: 8, p: 1 };
const DIRS = ['belege', 'artikelbilder', 'erweiterungen', 'erweiterungen-freigegeben', 'mitglieder-dokumente', 'fotos', 'mail-anhaenge'];   // Ordner unter DATA_DIR
const NAME_RE = /^(\d{4}-\d{2}-\d{2})(?:_(\d{6}))?_Clubwerk\.cwbackup$/;
const LEGACY_RE = /^(\d{4}-\d{2}-\d{2})(?:_(\d{6}))?_Vereinsheim\.vhsicherung$/;
const DB_NAME = 'clubwerk.db', DB_ALT = 'vereinsheim.db';

function deriveKey(password, kdf) {
  // Werte stammen aus dem (unverschlüsselten) Kopf der Datei – nur übliche scrypt-Werte zulassen, sonst könnte eine präparierte Datei Rechenzeit/Speicher binden
  const k = kdf || {}, N = Number(k.N), r = Number(k.r), p = Number(k.p), salt = Buffer.from(String(k.salt || ''), 'base64');
  if (!(Number.isInteger(N) && N >= 1024 && N <= 1048576 && (N & (N - 1)) === 0 && Number.isInteger(r) && r >= 1 && r <= 16 && Number.isInteger(p) && p >= 1 && p <= 4 && salt.length >= 8 && salt.length <= 64 && 128 * N * r <= 128 * 1024 * 1024))
    throw new Error('Die Sicherungsdatei hat ungültige Angaben im Kopf.');
  return crypto.scryptSync(String(password), Buffer.from(kdf.salt, 'base64'), 32, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 128 * 1024 * 1024 });
}
const keyId = key => crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
const sha256File = file => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });

/** Neues Sicherungspasswort → { kdf, key } (der Schlüssel wird gespeichert, das Passwort nie) */
function newKey(password) {
  const pw = String(password || '');
  if (pw.length < 10 || pw.length > 200) throw new Error('Das Sicherungspasswort braucht mindestens 10 Zeichen.');
  const kdf = { ...KDF, salt: crypto.randomBytes(16).toString('base64') };
  const key = deriveKey(pw, kdf);
  return { kdf, key: key.toString('hex'), kid: keyId(key) };
}

function readHeader(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const st = fs.fstatSync(fd);
    const pre = Buffer.alloc(12); fs.readSync(fd, pre, 0, 12, 0);
    const mg = pre.subarray(0, 8);
    if (!mg.equals(MAGIC) && !MAGIC_ALT.some(m => mg.equals(m))) throw new Error('Das ist keine Komplettsicherung von Clubwerk (.cwbackup).');
    const len = pre.readUInt32BE(8);
    if (len < 10 || len > 8192) throw new Error('Die Sicherungsdatei ist beschädigt.');
    const hb = Buffer.alloc(len); fs.readSync(fd, hb, 0, len, 12);
    let head; try { head = JSON.parse(hb.toString('utf8')); } catch (e) { throw new Error('Die Sicherungsdatei ist beschädigt.'); }
    const dataStart = 12 + len, dataEnd = st.size - 16;
    if (dataEnd <= dataStart) throw new Error('Die Sicherungsdatei ist unvollständig.');
    const tag = Buffer.alloc(16); fs.readSync(fd, tag, 0, 16, dataEnd);
    if (!head.kdf || !head.iv || head.v !== 1) throw new Error('Die Sicherungsdatei hat ein unbekanntes Format.');
    return { head, dataStart, dataEnd, tag, size: st.size };
  } finally { fs.closeSync(fd); }
}

/**
 * Komplettsicherung erstellen.
 * @param {object} o  { db, dataDir, outDir, key (hex), kdf, appVersion, club, standalone(file) }
 * @returns {{ file, path, size }}
 */
async function create(o) {
  if (!o.key || !o.kdf) throw new Error('Noch kein Sicherungspasswort festgelegt.');
  const key = Buffer.from(o.key, 'hex');
  fs.mkdirSync(o.outDir, { recursive: true, mode: 0o700 });
  const stage = fs.mkdtempSync(path.join(o.dataDir, '.sicherung-'));
  const d = new Date(), name = `${require('./util').fileStamp(d)}_Clubwerk${EXT}`;
  const dest = path.join(o.outDir, name);
  const part = dest + '.part';
  try {
    await o.db.backup(path.join(stage, DB_NAME));
    if (o.standalone) o.standalone(path.join(stage, DB_NAME));
    const dirs = DIRS.filter(x => { try { return fs.statSync(path.join(o.dataDir, x)).isDirectory(); } catch (e) { return false; } });
    const count = dir => { try { return fs.readdirSync(path.join(o.dataDir, dir), { recursive: true, withFileTypes: true }).filter(e => e.isFile()).length; } catch (e) { return 0; } };
    const manifest = { format: 'clubwerk-komplett', v: 1, created: d.toISOString(), app: o.appVersion || '', club: o.club || '',
      db: await sha256File(path.join(stage, DB_NAME)), dirs: Object.fromEntries(dirs.map(x => [x, count(x)])) };
    fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 1));

    const iv = crypto.randomBytes(12);
    const head = Buffer.from(JSON.stringify({ v: 1, alg: 'aes-256-gcm', kdf: o.kdf, iv: iv.toString('base64'), kid: keyId(key), created: manifest.created, app: manifest.app }));
    const pre = Buffer.alloc(12); MAGIC.copy(pre); pre.writeUInt32BE(head.length, 8);
    const out = fs.createWriteStream(part, { mode: 0o600 });
    out.write(Buffer.concat([pre, head]));
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const args = ['-czf', '-', '-C', stage, DB_NAME, 'manifest.json'];
    for (const x of dirs) args.push('-C', o.dataDir, x);
    const tar = spawn('tar', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = ''; tar.stderr.on('data', c => { err += c; });
    // fehlt das Programm (ENOENT) oder lässt es sich nicht starten, darf das nicht als unbehandeltes 'error' den Prozess beenden
    const exited = new Promise((res, rej) => { tar.on('close', res); tar.on('error', e => rej(new Error('tar nicht verfügbar: ' + e.message))); });
    exited.catch(() => {});
    await pipeline(tar.stdout, cipher, out, { end: false });
    const code = await exited;
    if (code !== 0) throw new Error('Packen fehlgeschlagen: ' + String(err).slice(0, 200));
    await new Promise((res, rej) => out.end(cipher.getAuthTag(), e => (e ? rej(e) : res())));
    fs.renameSync(part, dest);
    return { file: name, path: dest, size: fs.statSync(dest).size, manifest };
  } catch (e) {
    try { fs.unlinkSync(part); } catch (x) { /* egal */ }
    throw e;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

/**
 * Entschlüsseln und in einen (neuen, leeren) Ordner entpacken. Erst wenn der Prüfwert stimmt, gilt das Ergebnis.
 * @param {string} file
 * @param {object} o { password?, key? (hex), outDir }
 * @returns {object} manifest
 */
const MAX_ENTRIES = 500000, MAX_BYTES = 50 * 1024 ** 3;
/**
 * Archiv vor dem Entpacken prüfen – mit eigenem Leser der tar-Köpfe (strukturierte Felder: Typ, Name, Größe), nicht über die
 * Textausgabe von „tar -tv“. Erlaubt sind nur normale Dateien und Ordner unter den bekannten Namen; lange Namen (GNU „L“, pax „x“)
 * werden ausgewertet. Wirft bei allem anderen (Verknüpfungen, Geräte, Pfade nach oben, absolute Pfade, zu viele/zu große Einträge).
 */
function checkArchive(tgz) {
  const roots = new Set([DB_NAME, DB_ALT, 'manifest.json', ...DIRS]);
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0), skip = 0, n = 0, bytes = 0, bad = null, ended = false;
    let longName = null, paxName = null, meta = null;   // meta: { kind: 'L'|'x', left, chunks }
    const fail = why => { if (!bad) bad = why; };
    const str = (b, o, l) => { const x = b.subarray(o, o + l); const z = x.indexOf(0); return (z >= 0 ? x.subarray(0, z) : x).toString('utf8'); };
    const num = (b, o, l) => { if (b[o] & 0x80) { fail('ungewöhnliche Größenangabe'); return 0; } const t = str(b, o, l).trim(); if (!/^[0-7]*$/.test(t)) { fail('unlesbarer Eintrag'); return 0; } return t ? parseInt(t, 8) : 0; };
    const pad = x => (512 - (x % 512)) % 512;
    const checkName = (name0, type) => {
      const name = name0.replace(/^\.\//, '').replace(/\/+$/, '');
      if (!name || name === '.') return;   // Wurzel „./“
      if (/[\u0000-\u001f\\]/.test(name)) return fail(`ungültiger Name (${JSON.stringify(name.slice(0, 60))})`);
      if (name.startsWith('/') || name.split('/').some(x => x === '..' || x === '' || x === '.')) return fail(`unerwarteter Pfad (${name.slice(0, 80)})`);
      if (!roots.has(name.split('/')[0])) return fail(`unerwarteter Pfad (${name.slice(0, 80)})`);
      if (type === 'd' && !DIRS.includes(name.split('/')[0])) return fail(`unerwarteter Ordner (${name.slice(0, 80)})`);
    };
    const header = h => {
      if (h.every(x => x === 0)) { ended = true; return 0; }
      // Prüfsumme des Kopfes
      let sum = 0; for (let i = 0; i < 512; i++) sum += (i >= 148 && i < 156) ? 32 : h[i];
      if (num(h, 148, 8) !== sum) { fail('beschädigter Eintrag'); return 0; }
      const type = String.fromCharCode(h[156] || 48), size = num(h, 124, 12);
      if (type === 'L' || type === 'x') { if (size > 64 * 1024) { fail('zu langer Name'); return 0; } meta = { kind: type, left: size, chunks: [] }; return size + pad(size); }
      if (type === 'g') { fail('globaler Zusatzkopf'); return 0; }
      let name = str(h, 0, 100); const magic = str(h, 257, 6);
      if (magic.startsWith('ustar')) { const pre = str(h, 345, 155); if (pre) name = pre + '/' + name; }
      if (paxName != null) name = paxName; else if (longName != null) name = longName;
      paxName = null; longName = null;
      const kind = type === '0' || type === '7' ? '-' : type === '5' ? 'd' : null;
      if (!kind) { fail(`Verknüpfung oder Sonderdatei (${name.slice(0, 80)})`); return 0; }
      checkName(name, kind);
      if (++n > MAX_ENTRIES) fail('zu viele Einträge');
      if ((bytes += size) > MAX_BYTES) fail('zu groß');
      return kind === '-' ? size + pad(size) : 0;
    };
    const metaDone = () => {
      const data = Buffer.concat(meta.chunks).subarray(0, meta.size0);
      if (meta.kind === 'L') longName = str(data, 0, data.length);
      else { // pax: „<len> key=value\n“
        let o = 0; while (o < data.length) { const sp = data.indexOf(32, o); if (sp < 0) { fail('unlesbarer Zusatzkopf'); break; } const len = parseInt(data.subarray(o, sp).toString(), 10); if (!(len > 0)) { fail('unlesbarer Zusatzkopf'); break; }
          const kv = data.subarray(sp + 1, o + len - 1).toString('utf8'); const eq = kv.indexOf('='); const k = kv.slice(0, eq), v = kv.slice(eq + 1);
          if (k === 'path') paxName = v; else if (k === 'linkpath') fail('Verknüpfung'); else if (k === 'size' && !/^\d+$/.test(v)) fail('unlesbarer Zusatzkopf'); else if (k === 'size' && Number(v) > MAX_BYTES) fail('zu groß');
          o += len; }
      }
      meta = null;
    };
    const gz = fs.createReadStream(tgz).pipe(require('zlib').createGunzip());
    gz.on('data', chunk => {
      if (bad || ended) return;
      buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
      while (!bad && !ended) {
        if (meta && meta.left > 0) {   // Inhalt eines Namens-Kopfes sammeln
          const take = Math.min(meta.left, buf.length); if (!take) break;
          meta.chunks.push(buf.subarray(0, take)); buf = buf.subarray(take); meta.left -= take; meta.size0 = (meta.size0 || 0) + take;
          if (meta.left === 0) { skip = pad(meta.size0); metaDone(); }
          continue;
        }
        if (skip) { const t = Math.min(skip, buf.length); buf = buf.subarray(t); skip -= t; if (skip) break; continue; }
        if (buf.length < 512) break;
        const h = buf.subarray(0, 512); buf = buf.subarray(512);
        const s2 = header(h);
        if (meta) { skip = 0; if (meta.left === 0) { meta.size0 = 0; metaDone(); } } else skip = s2;
      }
      if (bad || ended) gz.destroy();
    });
    const done = () => {
      if (bad) return reject(new Error('Die Sicherung enthält ungültige Einträge: ' + bad + '.'));
      if (!ended && (meta || skip || buf.length)) return reject(new Error('Die Sicherung ist unvollständig.'));
      resolve({ entries: n, bytes });
    };
    gz.on('end', done); gz.on('close', () => { if (bad || ended) done(); });
    gz.on('error', e => (bad || ended ? done() : reject(new Error('Die Sicherung lässt sich nicht lesen: ' + e.message))));
  });
}
async function extract(file, o) {
  const { head, dataStart, dataEnd, tag } = readHeader(file);
  let key = null;
  if (o.password) key = deriveKey(o.password, head.kdf);
  else if (o.key) key = Buffer.from(o.key, 'hex');
  if (!key) throw Object.assign(new Error('Bitte das Sicherungspasswort eingeben.'), { needPassword: true });
  if (head.kid && head.kid !== keyId(key)) throw Object.assign(new Error(o.password ? 'Das Sicherungspasswort stimmt nicht.' : 'Diese Sicherung wurde mit einem anderen Sicherungspasswort erstellt – bitte das damalige Passwort eingeben.'), { needPassword: true });
  fs.mkdirSync(o.outDir, { recursive: true, mode: 0o700 });
  if (fs.readdirSync(o.outDir).length) throw new Error('Wiederherstellung nur in einen leeren Ordner.');   // nie bestehende Daten überschreiben
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(head.iv, 'base64'));
  decipher.setAuthTag(tag);
  // Erst vollständig entschlüsseln und den Prüfwert (GCM-Tag) bestätigen – erst danach sieht tar überhaupt ein Byte.
  const payload = path.join(path.dirname(path.resolve(o.outDir)), `.inhalt-${crypto.randomBytes(6).toString('hex')}.tgz`);   // neben dem Zielordner, nicht darin
  try {
    await pipeline(fs.createReadStream(file, { start: dataStart, end: dataEnd - 1 }), decipher, fs.createWriteStream(payload, { mode: 0o600 }));
  } catch (e) {
    try { fs.unlinkSync(payload); } catch (x) { /* */ }
    if (/auth|unable to authenticate/i.test(e.message)) throw new Error('Die Sicherungsdatei wurde verändert oder ist beschädigt.');
    throw new Error('Entschlüsseln fehlgeschlagen: ' + e.message);
  }
  // Inhalt vor dem Entpacken prüfen: nur normale Dateien und Ordner, nur bekannte Namen, keine Pfade nach oben, Größe begrenzt
  try { await checkArchive(payload); } catch (e) { try { fs.unlinkSync(payload); } catch (x) { /* */ } throw e; }
  const tar = spawn('tar', ['-xzf', payload, '-C', o.outDir, '--no-same-owner', '--no-same-permissions'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; tar.stderr.on('data', c => { err += c; });
  const exited = new Promise((res, rej) => { tar.on('close', res); tar.on('error', e => rej(new Error('tar nicht verfügbar: ' + e.message))); });
  let code;
  try { code = await exited; } finally { try { fs.unlinkSync(payload); } catch (x) { /* */ } }
  if (code !== 0) throw new Error('Entpacken fehlgeschlagen: ' + String(err).slice(0, 200));
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(o.outDir, 'manifest.json'), 'utf8')); } catch (e) { throw new Error('In der Sicherung fehlt das Inhaltsverzeichnis.'); }
  if (manifest.format === 'vereinsheim-komplett' && !fs.existsSync(path.join(o.outDir, DB_NAME)) && fs.existsSync(path.join(o.outDir, DB_ALT))) {
    fs.renameSync(path.join(o.outDir, DB_ALT), path.join(o.outDir, DB_NAME));   // Sicherung der Vorgängerversion
  } else if (manifest.format !== 'clubwerk-komplett') throw new Error('Unbekannter Inhalt der Sicherung.');
  if (!fs.existsSync(path.join(o.outDir, DB_NAME)) || await sha256File(path.join(o.outDir, DB_NAME)) !== manifest.db) throw new Error('Die Datenbank in der Sicherung ist unvollständig.');
  // keine Verknüpfungen o. Ä. übernehmen
  for (const e of fs.readdirSync(o.outDir, { recursive: true, withFileTypes: true })) if (e.isSymbolicLink()) throw new Error('Die Sicherung enthält ungültige Einträge.');
  return manifest;
}

/** Aufbewahrung nach Generationen: die neuesten `daily` Tage, je Woche/Monat die jüngste Sicherung. Gibt die zu löschenden Namen zurück. */
function generations(names, { daily = 7, weekly = 4, monthly = 12 } = {}, dateOf = n => (String(n).match(/^(\d{4}-\d{2}-\d{2})/) || [])[1]) {
  const items = names.map(n => ({ n, d: dateOf(n) })).filter(x => x.d).sort((a, b) => (a.n < b.n ? 1 : -1));   // neueste zuerst
  const keep = new Set();   // behaltene Tage – alle Dateien eines behaltenen Tages bleiben
  const week = s => { const d = new Date(s + 'T12:00:00Z'); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return y + '-W' + Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7); };
  const pick = (keyFn, n) => { const seen = new Set(); for (const x of items) { const k = keyFn(x.d); if (seen.has(k)) continue; if (seen.size >= n) break; seen.add(k); keep.add(x.d); } };
  pick(d => d, daily); pick(week, weekly); pick(d => d.slice(0, 7), monthly);
  return items.filter(x => !keep.has(x.d)).map(x => x.n);
}

function list(dir) {
  try {
    return fs.readdirSync(dir).filter(f => validName(f)).map(f => { const st = fs.statSync(path.join(dir, f)); return { file: f, size: st.size, mtime: st.mtime.toISOString() }; })
      .sort((a, b) => (a.file < b.file ? 1 : -1));
  } catch (e) { return []; }
}
const validName = f => NAME_RE.test(String(f || '')) || LEGACY_RE.test(String(f || ''));

module.exports = { checkArchive, MAGIC, EXT, DB_NAME, DIRS, NAME_RE, newKey, deriveKey, keyId, readHeader, create, extract, generations, list, validName, sha256File };
