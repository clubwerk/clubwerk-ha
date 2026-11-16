'use strict';
/**
 * Update per ZIP-Upload (ab 2.16)
 * Für die Installation als lokales Add-on (Ordner /addons/clubwerk, per Samba befüllt):
 *   1. ZIP prüfen: Ist es Clubwerk, ist die Version neuer, sind alle Pflichtdateien da, keine
 *      ungültigen Pfade, keine zu großen Dateien.
 *   2. Übernehmen: Der bisherige Ordner wird nach /data/update-reserve/<version> gesichert (die letzten 2 bleiben),
 *      der neue in einen Nachbarordner kopiert und erst dann gegen /addons/clubwerk getauscht (Umbenennen, Platz vorher geprüft).
 *   3. Home Assistant (Supervisor) wird gebeten, den Add-on-Speicher neu einzulesen und das Add-on zu aktualisieren
 *      (= neu zu bauen). Klappt das nicht, zeigt die Verwaltung den Weg über Einstellungen → Add-ons.
 * Bei einer Installation über ein GitHub-Repository gibt es den Ordner nicht – dann kommen Updates über Home Assistant.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const SLUG = 'clubwerk';
const REQUIRED = ['config.yaml', 'Dockerfile', 'run.sh', 'package.json', 'package-lock.json', 'src/server.js', 'public/index.html'];
const MAX_FILES = 3000, MAX_TOTAL = 150 * 1024 * 1024;
const verNum = v => String(v || '0').split('.').map(n => parseInt(n, 10) || 0).slice(0, 3).reduce((a, n) => a * 1000 + n, 0);
const yamlField = (text, key) => { const m = String(text).match(new RegExp(`^${key}:\\s*["']?([^"'\\r\\n#]+?)["']?\\s*(#.*)?$`, 'm')); return m ? m[1].trim() : ''; };

/** Ordner des lokalen Add-ons finden (/addons/<irgendwas>/config.yaml mit slug: clubwerk) */
function findAddonDir(root = process.env.ADDONS_DIR || '/addons') {
  try {
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith('.')) continue;
      const f = path.join(root, d.name, 'config.yaml');
      if (fs.existsSync(f) && yamlField(fs.readFileSync(f, 'utf8'), 'slug') === SLUG) return path.join(root, d.name);
    }
  } catch (e) { /* kein /addons – z. B. Installation über GitHub */ }
  return null;
}

/**
 * ZIP prüfen und in einen leeren Ordner entpacken.
 * Akzeptiert: clubwerk-ha/clubwerk/…, clubwerk/… oder die Add-on-Dateien direkt im ZIP.
 * @returns {{ version, files, size, depsChanged, changelog }}
 */
async function inspect(src, outDir, { currentVersion, currentDir }) {
  const JSZip = require('jszip');
  let zip;
  // src: Pfad der hochgeladenen Datei (gestreamt auf die Platte) oder ein Buffer
  try { zip = await JSZip.loadAsync(Buffer.isBuffer(src) ? src : fs.readFileSync(src)); } catch (e) { throw new Error('Die Datei ist kein gültiges ZIP-Archiv.'); }
  const entries = Object.values(zip.files);
  if (entries.length > MAX_FILES) throw new Error('Das ZIP enthält zu viele Dateien.');
  const { zipSize, zipUnsafe, zipBudget } = require('./util'), unsafe = zipUnsafe(zip);
  if (unsafe) throw new Error(`Ungültiger Pfad im ZIP: ${unsafe.unsafeOriginalName}`);
  if (zipSize(entries) > MAX_TOTAL) throw new Error('Das Paket ist zu groß.');
  // Add-on-Ordner im ZIP finden: der flachste Ordner mit config.yaml + Dockerfile
  const cfgs = entries.filter(f => !f.dir && /(^|\/)config\.yaml$/.test(f.name)).map(f => f.name.slice(0, -'config.yaml'.length))
    .filter(root => zip.file(root + 'Dockerfile')).sort((a, b) => a.length - b.length);
  if (!cfgs.length) throw new Error('Im ZIP fehlt Clubwerk (config.yaml und Dockerfile nicht gefunden).');
  const root = cfgs[0];
  const budget = zipBudget(MAX_TOTAL, 'Das Paket ist zu groß.');   // beim Entpacken mitzählen – die Angaben im ZIP können gefälscht sein
  const cfg = await budget.read(zip.file(root + 'config.yaml'), 'string');
  if (yamlField(cfg, 'slug') !== SLUG) throw new Error('Das ist kein Paket von Clubwerk (anderer Add-on-Name).');
  const version = yamlField(cfg, 'version');
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Im Paket fehlt eine gültige Versionsnummer.');
  for (const r of REQUIRED) if (!zip.file(root + r)) throw new Error(`Das Paket ist unvollständig – es fehlt „${r}“.`);
  // entpacken (nur Dateien unterhalb des Add-on-Ordners, keine Verknüpfungen, keine Steuerzeichen)
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  let total = 0, files = 0;
  for (const f of entries) {
    if (f.dir || !f.name.startsWith(root)) continue;
    const rel = f.name.slice(root.length);
    if (!rel || rel.includes('..') || rel.startsWith('/') || /[\\:\u0000-\u001f]/.test(rel) || /(^|\/)(__MACOSX|\.DS_Store)/.test(rel)) continue;
    if (f.unixPermissions && (f.unixPermissions & 0o170000) === 0o120000) throw new Error(`Das Paket enthält eine Verknüpfung (${rel}) – abgelehnt.`);
    const data = await budget.read(f);
    total += data.length; files++;
    if (total > MAX_TOTAL) throw new Error('Das Paket ist zu groß.');
    const t = path.join(outDir, rel);
    if (!t.startsWith(outDir + path.sep)) throw new Error(`Ungültiger Pfad im ZIP: ${rel}`);
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, data);
  }
  if (fs.existsSync(path.join(outDir, 'run.sh'))) fs.chmodSync(path.join(outDir, 'run.sh'), 0o755);
  // Hinweise für die Anzeige
  let depsChanged = null;
  if (currentDir) {
    try {
      const deps = d => { const p = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')); return JSON.stringify([p.dependencies || {}, p.overrides || {}]); };
      depsChanged = deps(currentDir) !== deps(outDir);
    } catch (e) { depsChanged = null; }
  }
  let changelog = '';
  try {
    const ch = fs.readFileSync(path.join(outDir, 'CHANGELOG.md'), 'utf8');
    // Abschnitte neuer als die installierte Version
    const parts = ch.split(/^## /m).slice(1).filter(p => verNum((p.match(/^\[?(\d+\.\d+\.\d+)/) || [])[1]) > verNum(currentVersion));
    changelog = parts.map(p => '## ' + p.trim()).join('\n\n').slice(0, 6000);
  } catch (e) { /* kein Changelog */ }
  const sha = contentHash(outDir);
  return { version, files, size: total, depsChanged, changelog, sha, shaShort: shortHash(sha), newer: verNum(version) > verNum(currentVersion), same: verNum(version) === verNum(currentVersion) };
}

/**
 * Inhalts-Prüfsumme eines Add-on-Ordners: SHA-256 über alle Dateien (sortierte Pfade + Inhalt), unabhängig davon, wie das ZIP gepackt wurde.
 * Dieselbe Zahl steht für jede Version in PRUEFSUMMEN.md im GitHub-Repository – so lässt sich ein hochgeladenes Paket unabhängig gegenprüfen.
 */
function contentHash(dir) {
  const files = [];
  const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (/(^|\/)(__MACOSX|\.DS_Store|\.git|node_modules)(\/|$)/.test(r)) continue;
    if (e.isDirectory()) walk(path.join(d, e.name), r); else if (e.isFile()) files.push(r);
  } };
  walk(dir, '');
  const h = crypto.createHash('sha256');
  for (const r of files.sort()) h.update(r + '\0' + crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, r))).digest('hex') + '\n');
  return h.digest('hex');
}
/** zum Vorlesen/Vergleichen: die ersten 32 Zeichen in Vierergruppen */
const shortHash = h => String(h || '').slice(0, 32).replace(/(.{4})(?=.)/g, '$1 ');

/** Größe eines Ordners in Bytes */
function dirSize(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += dirSize(p); else if (e.isFile()) n += fs.statSync(p).size;
  }
  return n;
}
/** Alle Dateien eines Ordners auf die Platte zwingen (Stromausfall nach dem Umbenennen darf keine leeren Dateien hinterlassen) */
function syncTree(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) syncTree(p);
    else if (e.isFile()) { const fd = fs.openSync(p, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
  }
  try { const fd = fs.openSync(dir, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } } catch (e) { /* nicht überall möglich */ }
}
const freeBytes = dir => {
  if (process.env.CW_TEST_FREI_ADDONS) return Number(process.env.CW_TEST_FREI_ADDONS);
  try { const st = fs.statfsSync(dir); return st.bavail * st.bsize; } catch (e) { return Infinity; }
};
const LUFT = 20 * 1024 * 1024;
const MB = b => Math.ceil(b / 1e6);
/** Nachbarordner im Add-on-Speicher: .<name>-neu-<zeit> (wird gerade befüllt), .<name>-alt-<zeit> (bisheriger Stand, kurz vor dem Löschen) */
const NACHBAR = /^\.(.+)-(neu|alt)-\d+$/;

/**
 * Bisherigen Ordner sichern und den neuen einsetzen. Gibt den Namen der Reserve zurück.
 * Atomar: Der neue Stand wird vollständig in einen Nachbarordner kopiert und auf die Platte gebracht, erst dann wird umbenannt.
 * Bricht das Kopieren ab (Platte voll, Stromausfall), bleibt der bisherige Ordner unverändert.
 */
function swap(addonDir, newDir, reserveRoot, currentVersion) {
  const parent = path.dirname(addonDir), base = path.basename(addonDir);
  const neuBytes = dirSize(newDir), altBytes = dirSize(addonDir);
  if (freeBytes(parent) < neuBytes + LUFT) throw new Error(`Zu wenig freier Speicher im Add-on-Ordner – nötig sind rund ${MB(neuBytes + LUFT)} MB. Es wurde nichts verändert.`);
  fs.mkdirSync(reserveRoot, { recursive: true, mode: 0o700 });
  if (freeBytes(reserveRoot) < altBytes + LUFT) throw new Error(`Zu wenig freier Speicher für die Reserve der bisherigen Version – nötig sind rund ${MB(altBytes + LUFT)} MB. Es wurde nichts verändert.`);
  const name = `${currentVersion}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  const reserve = path.join(reserveRoot, name);
  try { fs.cpSync(addonDir, reserve, { recursive: true, dereference: false }); }
  catch (e) { fs.rmSync(reserve, { recursive: true, force: true }); throw new Error(`Reserve der bisherigen Version anlegen: ${e.message}`); }
  const t = Date.now(), neu = path.join(parent, `.${base}-neu-${t}`), alt = path.join(parent, `.${base}-alt-${t}`);
  try {
    fs.cpSync(newDir, neu, { recursive: true, dereference: false });
    const st = fs.statSync(addonDir);   // Rechte und Besitzer wie bisher (Samba-Freigabe)
    fs.chmodSync(neu, st.mode & 0o7777);
    try { fs.chownSync(neu, st.uid, st.gid); } catch (e) { /* ohne Rechte dazu: so lassen */ }
    syncTree(neu);
  } catch (e) { fs.rmSync(neu, { recursive: true, force: true }); throw new Error(`Neue Version bereitlegen: ${e.message} – es wurde nichts verändert.`); }
  fs.renameSync(addonDir, alt);
  try { fs.renameSync(neu, addonDir); }
  catch (e) { fs.renameSync(alt, addonDir); fs.rmSync(neu, { recursive: true, force: true }); throw e; }
  try { const fd = fs.openSync(parent, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } } catch (e) { /* nicht überall möglich */ }
  fs.rmSync(alt, { recursive: true, force: true });
  // nur die letzten 2 Reserven behalten
  const all = fs.readdirSync(reserveRoot).filter(n => /^\d+\.\d+\.\d+_/.test(n)).sort((a, b) => fs.statSync(path.join(reserveRoot, b)).mtimeMs - fs.statSync(path.join(reserveRoot, a)).mtimeMs);
  for (const old of all.slice(2)) fs.rmSync(path.join(reserveRoot, old), { recursive: true, force: true });
  return name;
}

/**
 * Beim Start: Reste eines abgebrochenen Tauschs im Add-on-Speicher aufräumen. Fehlt der Add-on-Ordner, weil der Abbruch genau zwischen
 * den beiden Umbenennungen lag, kommt der bisherige Stand (.<name>-alt-…) zurück. Halb befüllte .<name>-neu-… werden gelöscht.
 * @returns {string[]} was getan wurde
 */
function tauschReste(root = process.env.ADDONS_DIR || '/addons') {
  const done = [];
  let names = []; try { names = fs.readdirSync(root); } catch (e) { return done; }
  for (const n of names.sort()) {
    const m = n.match(NACHBAR); if (!m) continue;
    const p = path.join(root, n), ziel = path.join(root, m[1]);
    try { if (yamlField(fs.readFileSync(path.join(p, 'config.yaml'), 'utf8'), 'slug') !== SLUG) continue; } catch (e) { if (m[2] === 'alt') continue; }   // nur eigene Ordner (halb befüllte „neu“ ggf. ohne config.yaml)
    try {
      if (m[2] === 'alt' && !fs.existsSync(ziel)) { fs.renameSync(p, ziel); done.push(`${m[1]} aus ${n} zurückgeholt`); }
      else { fs.rmSync(p, { recursive: true, force: true }); done.push(`${n} entfernt`); }
    } catch (e) { done.push(`${n}: ${e.message}`); }
  }
  return done;
}

function reserves(reserveRoot) {
  try {
    return fs.readdirSync(reserveRoot).filter(n => /^\d+\.\d+\.\d+_/.test(n)).map(n => ({ name: n, version: n.split('_')[0], at: fs.statSync(path.join(reserveRoot, n)).mtime.toISOString() }))
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  } catch (e) { return []; }
}

/* ---------- Home Assistant (Supervisor) ---------- */
const SUP = () => (process.env.SUPERVISOR_URL || 'http://supervisor').replace(/\/$/, '');
async function sup(method, p, body) {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) throw new Error('Keine Verbindung zu Home Assistant (Supervisor).');
  let r;
  try { r = await fetch(SUP() + p, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) }); }
  catch (e) { throw new Error('Home Assistant nicht erreichbar: ' + e.message); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.result === 'error') throw new Error(d.message || `Home Assistant antwortet mit ${r.status}`);
  return d.data || {};
}
/**
 * Supervisor: lokalen Add-on-Speicher neu einlesen und das Add-on aktualisieren (baut neu und startet neu).
 * Läuft im Hintergrund – die laufende Version wird dabei beendet.
 */
async function triggerUpdate() {
  const info = await sup('GET', '/addons/self/info');
  const slug = info.slug || 'self';
  await sup('POST', '/store/reload');
  // neuere Supervisor-Versionen: /store/addons/<slug>/update, ältere: /addons/<slug>/update
  try { await sup('POST', `/store/addons/${slug}/update`, { backup: false }); return { slug, via: 'store' }; }
  catch (e) {
    try { await sup('POST', `/addons/${slug}/update`); return { slug, via: 'addons' }; }
    catch (e2) {
      if (/use update|version/i.test(e2.message)) throw e2;
      await sup('POST', `/addons/${slug}/rebuild`); return { slug, via: 'rebuild' };
    }
  }
}

/** Woher kommt diese Installation? → { kind: 'local'|'repository'|'unknown', mounted, info } */
async function origin() {
  const root = process.env.ADDONS_DIR || '/addons';
  const mounted = fs.existsSync(root);
  let info = null;
  if (process.env.SUPERVISOR_TOKEN) { try { info = await sup('GET', '/addons/self/info'); } catch (e) { info = { error: e.message }; } }
  const repo = info && info.repository;
  const kind = repo === 'local' || (info && /^local_/.test(info.slug || '')) ? 'local' : repo ? 'repository' : findAddonDir(root) ? 'local' : 'unknown';
  return { kind, mounted, dir: findAddonDir(root), slug: info && info.slug, supervisorError: info && info.error };
}

module.exports = { contentHash, shortHash, origin, findAddonDir, inspect, swap, tauschReste, reserves, triggerUpdate, verNum, yamlField };
