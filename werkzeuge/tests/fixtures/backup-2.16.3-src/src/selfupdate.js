'use strict';
/**
 * Update per ZIP-Upload (ab 2.16)
 * Für die Installation als lokales Add-on (Ordner /addons/vereinsheim, per Samba befüllt):
 *   1. ZIP prüfen: Ist es die Vereinsheimverwaltung, ist die Version neuer, sind alle Pflichtdateien da, keine
 *      ungültigen Pfade, keine zu großen Dateien.
 *   2. Übernehmen: Der bisherige Ordner wird nach /data/update-reserve/<version> gesichert (die letzten 2 bleiben),
 *      der neue nach /addons/vereinsheim kopiert.
 *   3. Home Assistant (Supervisor) wird gebeten, den Add-on-Speicher neu einzulesen und das Add-on zu aktualisieren
 *      (= neu zu bauen). Klappt das nicht, zeigt die Verwaltung den Weg über Einstellungen → Add-ons.
 * Bei einer Installation über ein GitHub-Repository gibt es den Ordner nicht – dann kommen Updates über Home Assistant.
 */
const fs = require('fs');
const path = require('path');

const SLUG = 'vereinsheim';
const REQUIRED = ['config.yaml', 'Dockerfile', 'run.sh', 'package.json', 'package-lock.json', 'src/server.js', 'public/index.html'];
const MAX_FILES = 3000, MAX_TOTAL = 150 * 1024 * 1024;
const verNum = v => String(v || '0').split('.').map(n => parseInt(n, 10) || 0).slice(0, 3).reduce((a, n) => a * 1000 + n, 0);
const yamlField = (text, key) => { const m = String(text).match(new RegExp(`^${key}:\\s*["']?([^"'\\r\\n#]+?)["']?\\s*(#.*)?$`, 'm')); return m ? m[1].trim() : ''; };

/** Ordner des lokalen Add-ons finden (/addons/<irgendwas>/config.yaml mit slug: vereinsheim) */
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
 * Akzeptiert: vereinsheim-ha/vereinsheim/…, vereinsheim/… oder die Add-on-Dateien direkt im ZIP.
 * @returns {{ version, files, size, depsChanged, changelog }}
 */
async function inspect(buf, outDir, { currentVersion, currentDir }) {
  const JSZip = require('jszip');
  let zip;
  try { zip = await JSZip.loadAsync(buf); } catch (e) { throw new Error('Die Datei ist kein gültiges ZIP-Archiv.'); }
  const entries = Object.values(zip.files);
  if (entries.length > MAX_FILES) throw new Error('Das ZIP enthält zu viele Dateien.');
  const unsafe = entries.find(f => f.unsafeOriginalName && f.unsafeOriginalName !== f.name);
  if (unsafe) throw new Error(`Ungültiger Pfad im ZIP: ${unsafe.unsafeOriginalName}`);
  if (entries.reduce((a, f) => a + ((f._data && f._data.uncompressedSize) || 0), 0) > MAX_TOTAL) throw new Error('Das Paket ist zu groß.');
  // Add-on-Ordner im ZIP finden: der flachste Ordner mit config.yaml + Dockerfile
  const cfgs = entries.filter(f => !f.dir && /(^|\/)config\.yaml$/.test(f.name)).map(f => f.name.slice(0, -'config.yaml'.length))
    .filter(root => zip.file(root + 'Dockerfile')).sort((a, b) => a.length - b.length);
  if (!cfgs.length) throw new Error('Im ZIP fehlt die Vereinsheimverwaltung (config.yaml und Dockerfile nicht gefunden).');
  const root = cfgs[0];
  const cfg = await zip.file(root + 'config.yaml').async('string');
  if (yamlField(cfg, 'slug') !== SLUG) throw new Error('Das ist kein Paket der Vereinsheimverwaltung (anderer Add-on-Name).');
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
    const data = await f.async('nodebuffer');
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
  return { version, files, size: total, depsChanged, changelog, newer: verNum(version) > verNum(currentVersion), same: verNum(version) === verNum(currentVersion) };
}

/** Bisherigen Ordner sichern und den neuen einsetzen. Gibt den Namen der Reserve zurück. */
function swap(addonDir, newDir, reserveRoot, currentVersion) {
  fs.mkdirSync(reserveRoot, { recursive: true, mode: 0o700 });
  const name = `${currentVersion}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  const reserve = path.join(reserveRoot, name);
  fs.cpSync(addonDir, reserve, { recursive: true, dereference: false });
  // Inhalt ersetzen (der Ordner selbst bleibt – Samba-Freigabe/Rechte bleiben unverändert)
  for (const e of fs.readdirSync(addonDir)) fs.rmSync(path.join(addonDir, e), { recursive: true, force: true });
  fs.cpSync(newDir, addonDir, { recursive: true, dereference: false });
  // nur die letzten 2 Reserven behalten
  const all = fs.readdirSync(reserveRoot).filter(n => /^\d+\.\d+\.\d+_/.test(n)).sort((a, b) => fs.statSync(path.join(reserveRoot, b)).mtimeMs - fs.statSync(path.join(reserveRoot, a)).mtimeMs);
  for (const old of all.slice(2)) fs.rmSync(path.join(reserveRoot, old), { recursive: true, force: true });
  return name;
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

module.exports = { origin, SLUG, findAddonDir, inspect, swap, reserves, triggerUpdate, verNum, yamlField };
