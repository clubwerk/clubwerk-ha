'use strict';
/**
 * Tresor – Verschlüsselung der persönlichen Daten auf der Festplatte (3.21)
 *
 * Grundidee: Auf der Festplatte stehen Adressen, Kontaktdaten, Geburtsdaten, Bankdaten, Unterschriften, Anträge, Dokumente
 * und Fotos nur verschlüsselt. Im laufenden Betrieb liegt eine entschlüsselte Kopie der betroffenen Tabellen ausschließlich
 * im Arbeitsspeicher (TEMP-Tabellen gleichen Namens, temp_store = MEMORY). SQLite sucht Tabellen zuerst im TEMP-Schema –
 * deshalb lesen und schreiben alle bestehenden Programmteile unverändert weiter; Trigger schreiben jede Änderung sofort
 * verschlüsselt in die echte Tabelle zurück.
 *
 * Schlüssel:
 *  - Datenschlüssel (DK, 32 Byte) – verschlüsselt Felder und Dateien (AES-256-GCM, schnell).
 *  - Schlüsselpaar (X25519): Der öffentliche Schlüssel liegt offen in den Einstellungen. Damit kann Clubwerk auch im
 *    gesperrten Zustand neue Daten verschlüsseln (Online-Antrag, Änderungswünsche aus der App). Der geheime Schlüssel ist
 *    mit dem DK verschlüsselt.
 *  - Der DK ist je Admin mit dessen Passwort verschlossen (scrypt) und zusätzlich mit dem Wiederherstellungscode.
 *    Nach einem Neustart ist der Tresor gesperrt, bis sich ein Admin anmeldet (oder der Code eingegeben wird).
 *
 * Gesperrt: Die TEMP-Tabellen enthalten Platzhalter (E-Mail → gesperrt-<id>@clubwerk.invalid, sonst leer). Der Betrieb
 * (Tablet, Buchungen, Türen, Beregnung) läuft weiter; E-Mails an Platzhalter-Adressen warten in einer Warteschlange.
 *
 * Formate:  Feld   „e1:“ + base64(iv12 | tag16 | daten)                      – mit DK
 *                  „p1:“ + base64(epub32 | iv12 | tag16 | daten)             – mit öffentlichem Schlüssel
 *           Datei  „CWV1“ + Modus(1 = DK, 2 = öffentlich) + [epub32] + iv12 + tag16 + daten
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db, getSetting, setSetting, audit, DATA_DIR } = require('./db');

db.pragma('temp_store = MEMORY');   // TEMP-Tabellen nie in eine temporäre Datei auf der Platte
db.exec(`
CREATE TABLE IF NOT EXISTS vault_wrap (
  user_id    INTEGER PRIMARY KEY,      -- admin_users.id; 0 = Wiederherstellungscode
  salt       TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS vault_mail (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  data       TEXT NOT NULL,            -- verschlüsselte Mail (p1/e1), wartet auf das Entsperren
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  tries      INTEGER NOT NULL DEFAULT 0
);`);

/* ---------- Was verschlüsselt wird ---------- */
const PH_MAIL = "CASE WHEN {c} IS NULL THEN NULL ELSE 'gesperrt-' || {k} || '@clubwerk.invalid' END";
const PH_JSON = "CASE WHEN {c} IS NULL THEN NULL ELSE '{}' END";
const SPEC = [
  { t: 'mv_person', k: 'member_id', c: ['birth_date', 'street', 'zip', 'city', 'country', 'address_extra', 'phone', 'mobile', 'email', 'key_no', 'notes', 'extra'], ph: { email: PH_MAIL, extra: PH_JSON } },
  { t: 'mv_bank', k: 'member_id', c: ['holder', 'iban', 'bic', 'bank'] },
  { t: 'mv_application', k: 'id', c: ['data', 'sig_member', 'sig_mandate'], ph: { data: PH_JSON } },
  { t: 'mv_change', k: 'id', c: ['data', 'signature'], ph: { data: PH_JSON } },
  { t: 'mv_history', k: 'id', c: ['old', 'new'] },
  { t: 'mv_collection', k: 'id', c: ['xml'] },
  { t: 'mail_recipient', k: 'id', c: ['email'] },
  { t: 'bh_partner', k: 'id', c: ['contact', 'street', 'zip', 'city', 'email', 'phone', 'note'] },
  { t: 'sp_extern', k: 'member_id', c: ['phone'] },        // Gastspieler/innen (Spielbetrieb)
  { t: 'aw_extern', k: 'id', c: ['note'] },                // externe Helfer (Arbeitsdienst)
  { t: 'bh_invoice', k: 'id', c: ['recipient'] },
  { t: 'bh_donation', k: 'id', c: ['donor'] },
];
const FILE_DIRS = ['mitglieder-dokumente', 'fotos', 'mail-anhaenge'];
const PLACEHOLDER_RE = /^gesperrt-(\d+)@clubwerk\.invalid$/i;

/* ---------- Zustand (nur im Speicher) ---------- */
let DK = null;          // Datenschlüssel – nur nach dem Entsperren
let PRIV = null;        // geheimer X25519-Schlüssel (KeyObject)
let PUB = null;         // öffentlicher X25519-Schlüssel (KeyObject)
let built = null;       // 'offen' | 'gesperrt' | null – Zustand der TEMP-Kopie
// Merker statt Datenbankabfrage: die SQL-Funktionen unten dürfen die Verbindung nicht selbst benutzen
let ON = getSetting('vault_on', '0') === '1';
const on = () => ON;
const locked = () => on() && !DK;

/* ---------- Grundbausteine ---------- */
const b64 = b => Buffer.from(b).toString('base64');
function gcmEnc(key, buf) {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const out = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), out]);
}
function gcmDec(key, buf) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12)); d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}
const kdfPw = (pw, salt, N = 32768) => crypto.scryptSync(String(pw), salt, 32, { N, r: 8, p: 1, maxmem: 96 * 1024 * 1024 });
function pubKey() {
  if (PUB) return PUB;
  const x = getSetting('vault_pub', ''); if (!x) return null;
  PUB = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'X25519', x }, format: 'jwk' });
  return PUB;
}
/** gemeinsamer Schlüssel für die Variante „öffentlich“: X25519 + HKDF */
const shared = (priv, pub, epubRaw) => Buffer.from(crypto.hkdfSync('sha256', crypto.diffieHellman({ privateKey: priv, publicKey: pub }), epubRaw, 'clubwerk-tresor-v1', 32));
const rawPub = k => Buffer.from(k.export({ format: 'jwk' }).x, 'base64url');
const pubFromRaw = raw => crypto.createPublicKey({ key: { kty: 'OKP', crv: 'X25519', x: Buffer.from(raw).toString('base64url') }, format: 'jwk' });
function sealPub(buf) {   // mit dem öffentlichen Schlüssel – braucht kein Geheimnis
  const pub = pubKey(); if (!pub) throw new Error('Tresor nicht eingerichtet.');
  const e = crypto.generateKeyPairSync('x25519'); const er = rawPub(e.publicKey);
  return Buffer.concat([er, gcmEnc(shared(e.privateKey, pub, er), buf)]);
}
function openPub(buf) {
  if (!PRIV) throw lockedErr();
  const er = buf.subarray(0, 32);
  return gcmDec(shared(PRIV, pubFromRaw(er), er), buf.subarray(32));
}
const lockedErr = () => Object.assign(new Error('Die persönlichen Daten sind gesperrt – bitte als Admin anmelden.'), { vaultLocked: true, status: 423 });

/* ---------- Felder ---------- */
function encValue(v) {
  if (v == null) return v;
  const s = Buffer.isBuffer(v) ? v : Buffer.from(String(v), 'utf8');
  return DK ? 'e1:' + b64(gcmEnc(DK, s)) : 'p1:' + b64(sealPub(s));
}
function decValue(v) {
  if (typeof v !== 'string' || v.length < 4 || v[2] !== ':') return v;
  const p = v.slice(0, 3);
  if (p === 'e1:') { if (!DK) throw lockedErr(); return gcmDec(DK, Buffer.from(v.slice(3), 'base64')).toString('utf8'); }
  if (p === 'p1:') return openPub(Buffer.from(v.slice(3), 'base64')).toString('utf8');
  return v;
}
const isEnc = v => typeof v === 'string' && (v.startsWith('e1:') || v.startsWith('p1:'));
db.function('cw_enc', { deterministic: false }, v => (ON ? encValue(v) : v));
db.function('cw_dec', { deterministic: true }, v => { try { return decValue(v); } catch (e) { return null; } });
db.function('cw_reenc', { deterministic: false }, v => { try { return DK ? encValue(decValue(v)) : v; } catch (e) { return v; } });   // bei Fehler unverändert lassen
db.function('cw_plain', { deterministic: true }, v => { try { return decValue(v); } catch (e) { return v; } });       // beim Ausschalten: bei Fehler unverändert
db.function('cw_isenc', { deterministic: true }, v => (isEnc(v) ? 1 : 0));

/* ---------- Dateien ---------- */
const MAGIC = Buffer.from('CWV1');
const isEncFile = buf => buf.length > 33 && buf.subarray(0, 4).equals(MAGIC);
function encFile(buf) {
  if (DK) return Buffer.concat([MAGIC, Buffer.from([1]), gcmEnc(DK, buf)]);
  return Buffer.concat([MAGIC, Buffer.from([2]), sealPub(buf)]);
}
function decFile(buf) {
  if (!isEncFile(buf)) return buf;
  const mode = buf[4], body = buf.subarray(5);
  if (mode === 1) { if (!DK) throw lockedErr(); return gcmDec(DK, body); }
  if (mode === 2) return openPub(body);
  throw new Error('Unbekanntes Dateiformat.');
}
/** Datei schreiben – bei eingeschaltetem Tresor verschlüsselt */
function writeFile(file, buf, opts = { mode: 0o600 }) { fs.writeFileSync(file, on() ? encFile(Buffer.from(buf)) : buf, opts); cacheDrop(file); }
/** Datei lesen – entschlüsselt (wirft vaultLocked, wenn gesperrt) */
const cache = new Map(); let cacheBytes = 0; const CACHE_MAX = 24 * 1024 * 1024;
function cacheDrop(file) { const c = cache.get(file); if (c) { cacheBytes -= c.length; cache.delete(file); } }
function readFile(file, { cacheIt = false } = {}) {
  if (cacheIt && cache.has(file)) { const b = cache.get(file); cache.delete(file); cache.set(file, b); return b; }
  const raw = fs.readFileSync(file);
  const out = decFile(raw);
  if (cacheIt && isEncFile(raw) && out.length < 2 * 1024 * 1024) {
    cache.set(file, out); cacheBytes += out.length;
    while (cacheBytes > CACHE_MAX && cache.size) { const [k, v] = cache.entries().next().value; cache.delete(k); cacheBytes -= v.length; }
  }
  return out;
}

/* ---------- Schlüssel ---------- */
function wrapFor(userId, secret, N) {
  const salt = crypto.randomBytes(16);
  db.prepare('INSERT INTO vault_wrap(user_id, salt, data) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET salt = excluded.salt, data = excluded.data, created_at = datetime(\'now\',\'localtime\')')
    .run(userId, b64(salt), b64(gcmEnc(kdfPw(secret, salt, N), DK)));
}
function tryUnwrap(userId, secret, N) {
  const w = db.prepare('SELECT * FROM vault_wrap WHERE user_id = ?').get(userId);
  if (!w) return null;
  try { return gcmDec(kdfPw(secret, Buffer.from(w.salt, 'base64'), N), Buffer.from(w.data, 'base64')); } catch (e) { return null; }
}
const RC_N = 16384;   // Wiederherstellungscode: 100 Bit Zufall – schwächeres scrypt genügt
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const s = Array.from(crypto.randomBytes(20), b => A[b % 32]).join('');
  return s.match(/.{4}/g).join('-');
}
function useKey(dk) {
  const priv = gcmDec(dk, Buffer.from(getSetting('vault_priv', ''), 'base64'));   // prüft zugleich, ob der Schlüssel stimmt
  DK = dk; PRIV = crypto.createPrivateKey({ key: priv, format: 'der', type: 'pkcs8' }); pubKey();
}

/* ---------- TEMP-Kopie (Arbeitsspeicher) ---------- */
const q = n => `"${String(n).replace(/"/g, '""')}"`;
const mainHas = t => Boolean(db.prepare("SELECT 1 FROM main.sqlite_master WHERE type = 'table' AND name = ?").get(t));
/** alle verschlüsselten Spalten, die es in der Datenbank gerade gibt → [[tabelle, spalte], …] */
const encColumns = () => SPEC.filter(s => mainHas(s.t)).flatMap(s => {
  const cols = db.prepare(`PRAGMA main.table_info(${q(s.t)})`).all().map(c => c.name);
  return s.c.filter(x => cols.includes(x)).map(c => [s.t, c]);
});
/** Datenbankdatei verdichten, damit alte Klartext-Seiten wirklich verschwinden */
function compact() { try { db.pragma('wal_checkpoint(TRUNCATE)'); db.exec('VACUUM'); db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { console.error('Tresor – Aufräumen:', e.message); } }
function dropShadow() {
  for (const r of db.prepare("SELECT name FROM temp.sqlite_master WHERE type = 'trigger' AND name LIKE 'vt_%'").all()) db.exec(`DROP TRIGGER IF EXISTS temp.${q(r.name)}`);
  for (const s of SPEC) db.exec(`DROP TABLE IF EXISTS temp.${q(s.t)}`);
  built = null;
}
function buildOne(s, open) {
  const cols = db.prepare(`PRAGMA main.table_info(${q(s.t)})`).all();
  const enc = new Set(s.c.filter(c => cols.some(x => x.name === c)));
  if (!enc.size) return;
  const ddlMain = db.prepare("SELECT sql FROM main.sqlite_master WHERE type = 'table' AND name = ?").get(s.t).sql;
  const auto = /AUTOINCREMENT/i.test(ddlMain);
  const pkCols = cols.filter(c => c.pk).sort((a, b) => a.pk - b.pk);
  const intPk = pkCols.length === 1 && /^INTEGER$/i.test(pkCols[0].type);
  const defs = cols.map(c => {
    let d = `${q(c.name)} ${c.type || ''}`;
    if (intPk && c.pk) d += ' PRIMARY KEY' + (auto ? ' AUTOINCREMENT' : '');
    if (c.notnull && !enc.has(c.name) && !c.pk) d += ' NOT NULL';
    if (c.dflt_value != null) d += ` DEFAULT (${c.dflt_value})`;
    return d;
  });
  if (!intPk && pkCols.length) defs.push(`PRIMARY KEY (${pkCols.map(c => q(c.name)).join(', ')})`);
  db.exec(`CREATE TEMP TABLE ${q(s.t)} (${defs.join(', ')})`);
  for (const ix of db.prepare(`PRAGMA main.index_list(${q(s.t)})`).all()) {
    if (!ix.unique || ix.origin === 'pk' || ix.partial) continue;
    const ic = db.prepare(`PRAGMA main.index_info(${q(ix.name)})`).all().map(x => x.name).filter(Boolean);
    if (ic.length) db.exec(`CREATE UNIQUE INDEX temp.${q('vx_' + ix.name)} ON ${q(s.t)} (${ic.map(q).join(', ')})`);
  }
  for (const ix of db.prepare(`PRAGMA main.index_list(${q(s.t)})`).all()) {   // normale Indizes – für schnelle Abfragen auch in der Kopie
    if (ix.unique || ix.partial) continue;
    const ic = db.prepare(`PRAGMA main.index_info(${q(ix.name)})`).all().map(x => x.name).filter(Boolean);
    if (ic.length) db.exec(`CREATE INDEX temp.${q('vi_' + ix.name)} ON ${q(s.t)} (${ic.map(q).join(', ')})`);
  }
  if (auto) {
    db.prepare("DELETE FROM temp.sqlite_sequence WHERE name = ?").run(s.t);
    const seq = db.prepare("SELECT seq FROM main.sqlite_sequence WHERE name = ?").get(s.t);
    if (seq) db.prepare('INSERT INTO temp.sqlite_sequence(name, seq) VALUES (?, ?)').run(s.t, seq.seq);
  }
  const names = cols.map(c => c.name);
  const sel = names.map(n => {
    if (!enc.has(n)) return q(n);
    if (open) return `cw_dec(${q(n)})`;
    const ph = ((s.ph || {})[n] || 'NULL').replace(/\{c\}/g, q(n)).replace(/\{k\}/g, q(s.k));
    return `CASE WHEN cw_isenc(${q(n)}) = 1 THEN ${ph} ELSE ${q(n)} END`;
  });
  db.exec(`INSERT INTO temp.${q(s.t)} (${names.map(q).join(', ')}) SELECT ${sel.join(', ')} FROM main.${q(s.t)}`);
  const key = q(s.k);
  const vals = names.map(n => (enc.has(n) ? `cw_enc(NEW.${q(n)})` : `NEW.${q(n)}`));
  const sets = names.map(n => (enc.has(n) ? `${q(n)} = CASE WHEN NEW.${q(n)} IS OLD.${q(n)} THEN ${q(n)} ELSE cw_enc(NEW.${q(n)}) END` : `${q(n)} = NEW.${q(n)}`));
  db.exec(`CREATE TEMP TRIGGER ${q('vt_' + s.t + '_i')} AFTER INSERT ON temp.${q(s.t)} BEGIN
      INSERT INTO main.${q(s.t)} (${names.map(q).join(', ')}) VALUES (${vals.join(', ')})
      ON CONFLICT(${key}) DO UPDATE SET ${names.filter(n => n !== s.k).map(n => `${q(n)} = excluded.${q(n)}`).join(', ')}; END;
    CREATE TEMP TRIGGER ${q('vt_' + s.t + '_u')} AFTER UPDATE ON temp.${q(s.t)} BEGIN
      UPDATE main.${q(s.t)} SET ${sets.join(', ')} WHERE ${key} = OLD.${key}; END;
    CREATE TEMP TRIGGER ${q('vt_' + s.t + '_d')} AFTER DELETE ON temp.${q(s.t)} BEGIN
      DELETE FROM main.${q(s.t)} WHERE ${key} = OLD.${key}; END;`);
  // Löscht die Datenbank Zeilen über ON DELETE CASCADE in der echten Tabelle, muss die Kopie mitziehen
  for (const fk of db.prepare(`PRAGMA main.foreign_key_list(${q(s.t)})`).all()) {
    if (String(fk.on_delete).toUpperCase() !== 'CASCADE') continue;
    db.exec(`CREATE TEMP TRIGGER ${q(`vt_${s.t}_c${fk.id}`)} AFTER DELETE ON main.${q(fk.table)} BEGIN
      DELETE FROM temp.${q(s.t)} WHERE ${q(fk.from)} = OLD.${q(fk.to || 'id')}; END;`);
  }
}
/** TEMP-Kopie neu aufbauen (offen = entschlüsselt, sonst Platzhalter) */
function rebuild() {
  if (!on() && built === null) return;
  const t0 = Date.now();
  db.transaction(() => {
    dropShadow();
    if (!on()) return;
    if (DK) {   // im gesperrten Zustand angenommene Daten (p1) auf den schnellen Schlüssel umstellen
      for (const [t, c] of encColumns()) db.exec(`UPDATE main.${q(t)} SET ${q(c)} = cw_reenc(${q(c)}) WHERE substr(${q(c)}, 1, 3) = 'p1:'`);
    }
    for (const s of SPEC) if (mainHas(s.t)) buildOne(s, Boolean(DK));
    built = DK ? 'offen' : 'gesperrt';
  })();
  const ms = Date.now() - t0;
  if (ms > 1500) console.log(`Tresor: Kopie im Arbeitsspeicher in ${ms} ms aufgebaut.`);
}
/** vor Änderungen am Tabellenaufbau (Module einschalten) die Kopie entfernen, danach neu aufbauen */
function suspend(fn) {
  const was = built; if (was) dropShadow();
  try { return fn(); } finally { if (was || on()) rebuild(); }
}

/* ---------- Entsperren ---------- */
let afterUnlock = [];
const onUnlock = fn => { afterUnlock.push(fn); };
function unlocked(dk, why) {
  useKey(dk);
  rebuild();
  audit(null, 'Tresor entsperrt', why);
  for (const fn of afterUnlock) { try { const r = fn(); if (r && r.catch) r.catch(e => console.error('Tresor:', e.message)); } catch (e) { console.error('Tresor:', e.message); } }
}
/** Bei der Anmeldung eines Admins: Tresor öffnen bzw. dessen Schlüsselkopie anlegen */
function onLogin(userId, password) {
  if (!on()) return;
  try {
    if (!DK) { const dk = tryUnwrap(userId, password); if (dk) unlocked(dk, `Anmeldung (Benutzer ${userId})`); return; }
    if (!db.prepare('SELECT 1 FROM vault_wrap WHERE user_id = ?').get(userId)) wrapFor(userId, password);
  } catch (e) { console.error('Tresor bei der Anmeldung:', e.message); }
}
/** Passwort geändert / Benutzer angelegt: Schlüsselkopie für das neue Passwort */
function onPassword(userId, password) {
  if (!on() || !userId) return;
  try { if (DK) wrapFor(userId, password); else db.prepare('DELETE FROM vault_wrap WHERE user_id = ?').run(userId); } catch (e) { console.error('Tresor:', e.message); }
}
const dropUser = userId => { if (userId) db.prepare('DELETE FROM vault_wrap WHERE user_id = ?').run(userId); };
function unlockWithCode(code) {
  if (!on()) throw new Error('Der Tresor ist nicht eingeschaltet.');
  if (DK) return true;
  const dk = tryUnwrap(0, normCode(code), RC_N);
  if (!dk) return false;
  unlocked(dk, 'Wiederherstellungscode');
  return true;
}

/* ---------- Einschalten / Ausschalten ---------- */
let pending = null;   // vorbereitet, noch nicht gespeichert: { dk, code, userId, at }
function prepare(userId) {
  if (on()) throw new Error('Der Tresor ist schon eingeschaltet.');
  const pos = []; while (pos.length < 3) { const p = 1 + crypto.randomInt(20); if (!pos.includes(p)) pos.push(p); }
  pos.sort((a, b) => a - b);
  pending = { dk: crypto.randomBytes(32), code: newCode(), userId, at: Date.now(), pos };
  return { code: pending.code, positions: pos };
}
/** Probe: Hat der Admin den Code richtig abgeschrieben? (3 Zeichen an zufälligen Stellen) */
function confirmCode(userId, typed) {
  if (!pending || pending.userId !== userId || Date.now() - pending.at > 30 * 60000) throw new Error('Bitte noch einmal von vorne beginnen.');
  const c = normCode(pending.code);
  return normCode(typed) === pending.pos.map(p => c[p - 1]).join('');
}
/** alle Dateien in den Tresor-Ordnern (rekursiv) */
function fileList() {
  const out = [];
  for (const d of FILE_DIRS) {
    const walk = dir => { let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const e of list) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.isFile()) out.push(p); } };
    walk(path.join(DATA_DIR, d));
  }
  return out;
}
/** Reste eines abgebrochenen Laufs (halb geschriebene .cwtmp-Dateien) entfernen */
function dropTemps() { let n = 0; for (const p of fileList()) if (p.endsWith('.cwtmp')) { try { fs.unlinkSync(p); n++; } catch (e) { /* weiter */ } } return n; }
/** genug Platz für den Umbau? (größte Datei als Zwischenkopie + Puffer) */
function checkSpace(files) {
  let biggest = 0; for (const p of files) { try { biggest = Math.max(biggest, fs.statSync(p).size); } catch (e) { /* weiter */ } }
  let free = Infinity; try { const st = fs.statfsSync(DATA_DIR); free = st.bavail * st.bsize; } catch (e) { /* ältere Node-Version: nicht prüfbar */ }
  const need = biggest * 2 + 20 * 1024 * 1024;
  if (free < need) throw new Error(`Zu wenig freier Speicher (frei ${Math.round(free / 1048576)} MB, nötig etwa ${Math.round(need / 1048576)} MB). Bitte erst Platz schaffen – es wurde nichts verändert.`);
}
/** jede Datei einzeln umwandeln: in eine Zwischendatei schreiben, prüfen, dann atomar ersetzen. Bricht beim ersten Fehler ab. */
const encIfPlain = raw => (isEncFile(raw) ? raw : encFile(raw));
function encryptFiles(fn, check) {
  let n = 0;
  for (const p of fileList()) {
    if (p.endsWith('.cwtmp')) continue;
    const raw = fs.readFileSync(p); const out = fn(raw);
    if (!out || out === raw) continue;
    if (check && !check(out, raw)) throw new Error(`Prüfung fehlgeschlagen: ${path.basename(p)}`);
    const tmp = p + '.cwtmp';
    fs.writeFileSync(tmp, out, { mode: 0o600 });
    if (fs.statSync(tmp).size !== out.length) { try { fs.unlinkSync(tmp); } catch (e) { /* */ } throw new Error(`Schreiben fehlgeschlagen: ${path.basename(p)}`); }
    fs.renameSync(tmp, p); n++;
  }
  cache.clear(); cacheBytes = 0;
  return n;
}
/* Ablauf-Merker „vault_job“ (enc/dec): läuft gerade ein Umbau der Dateien? Bricht der Lauf ab (Neustart, Stromausfall, voller Speicher),
   erkennt start() das und stellt einen sicheren Zustand her: Der Tresor bleibt dann EINGESCHALTET und alle Dateien werden (mit dem
   öffentlichen Schlüssel, ohne Passwort) wieder verschlüsselt. Die Schlüssel werden erst gelöscht, wenn alle Dateien lesbar entschlüsselt sind. */
const setJob = j => (j ? setSetting('vault_job', j) : db.prepare("DELETE FROM settings WHERE key = 'vault_job'").run());
function resumeJob() {
  const job = getSetting('vault_job', '');
  const temps = dropTemps();
  if (!job) { if (temps) console.log(`Tresor: ${temps} Zwischendateien entfernt.`); return null; }
  if (!ON) { setJob(null); return null; }
  const n = encryptFiles(encIfPlain);
  setJob(null);
  const msg = job === 'dec' ? 'Das Ausschalten des Tresors wurde unterbrochen – der Tresor bleibt eingeschaltet, alle Dateien sind wieder verschlüsselt.' : 'Das Einschalten des Tresors wurde unterbrochen und jetzt zu Ende geführt.';
  console.log(`Tresor: ${msg} (${n} Dateien)`);
  try { audit(null, 'Tresor: unterbrochenen Lauf abgeschlossen', `${msg} (${n} Dateien)`); } catch (e) { /* */ }
  return { job, files: n };
}
/** Einschalten: Schlüssel speichern, vorhandene Daten verschlüsseln, alte Reste aus der Datei entfernen */
function enable(userId, password) {
  if (!pending || pending.userId !== userId) throw new Error('Bitte noch einmal von vorne beginnen.');
  const { dk, code } = pending;
  dropTemps(); checkSpace(fileList());
  const kp = crypto.generateKeyPairSync('x25519');
  const t0 = Date.now();
  db.transaction(() => {
    setSetting('vault_pub', kp.publicKey.export({ format: 'jwk' }).x);
    setSetting('vault_priv', b64(gcmEnc(dk, kp.privateKey.export({ format: 'der', type: 'pkcs8' }))));
    PUB = null; useKey(dk);
    db.prepare('DELETE FROM vault_wrap').run();
    wrapFor(0, normCode(code), RC_N);
    wrapFor(userId, password);
    setSetting('vault_on', '1'); setSetting('vault_since', new Date().toISOString()); ON = true;
    setJob('enc');
    for (const [t, c] of encColumns()) db.exec(`UPDATE main.${q(t)} SET ${q(c)} = cw_enc(${q(c)}) WHERE ${q(c)} IS NOT NULL AND cw_isenc(${q(c)}) = 0`);
  })();
  const files = encryptFiles(encIfPlain, out => isEncFile(out));
  setJob(null);
  purge();
  rebuild();
  pending = null;
  return { ms: Date.now() - t0, files };
}
/** Klartext-Reste aus der Datenbankdatei entfernen (freie Seiten, Protokolldatei) */
function purge() {
  const was = built; if (was) dropShadow();
  compact();
  if (was) rebuild();
}
function newRecovery() {
  if (!DK) throw lockedErr();
  const code = newCode(); wrapFor(0, normCode(code), RC_N); setSetting('vault_code_at', new Date().toISOString());
  return code;
}
function disable() {
  if (!on()) return;
  if (!DK) throw lockedErr();
  dropTemps();
  const list = fileList(); checkSpace(list);
  // 1. Dateien entschlüsseln – Schlüssel bleiben dabei erhalten. Jede Datei wird vor dem Ersetzen vollständig entschlüsselt (GCM prüft die Echtheit).
  setJob('dec');
  let files;
  try { files = encryptFiles(raw => (isEncFile(raw) ? decFile(raw) : raw)); }
  catch (e) {
    // zurück in den sicheren Zustand: alles wieder verschlüsseln, Tresor bleibt an
    try { encryptFiles(encIfPlain); setJob(null); } catch (e2) { console.error('Tresor – Rückweg:', e2.message); }
    throw new Error(`Ausschalten abgebrochen, der Tresor bleibt eingeschaltet: ${e.message}`);
  }
  // 2. Datenbank entschlüsseln und erst dann die Schlüssel löschen – alles in einer Transaktion
  dropShadow();
  try {
    db.transaction(() => {
      for (const [t, c] of encColumns()) {
        db.exec(`UPDATE main.${q(t)} SET ${q(c)} = cw_plain(${q(c)}) WHERE cw_isenc(${q(c)}) = 1`);
        const left = db.prepare(`SELECT COUNT(*) n FROM main.${q(t)} WHERE cw_isenc(${q(c)}) = 1`).get().n;
        if (left) throw new Error(`${left} Einträge in ${t}.${c} ließen sich nicht entschlüsseln`);
      }
      setSetting('vault_on', '0'); ON = false;
      db.prepare("DELETE FROM settings WHERE key IN ('vault_pub','vault_priv','vault_since','vault_code_at','vault_job')").run();
      db.prepare('DELETE FROM vault_wrap').run();
    })();
  } catch (e) {
    ON = true;
    try { encryptFiles(encIfPlain); setJob(null); } catch (e2) { console.error('Tresor – Rückweg:', e2.message); }
    rebuild();
    throw new Error(`Ausschalten abgebrochen, der Tresor bleibt eingeschaltet: ${e.message}`);
  }
  DK = null; PRIV = null; PUB = null; built = null;
  return { files };
}

/* ---------- Status ---------- */
function status(userId) {
  return { on: on(), locked: locked(), since: getSetting('vault_since', '') || null, codeAt: getSetting('vault_code_at', '') || getSetting('vault_since', '') || null,
    mine: userId ? Boolean(db.prepare('SELECT 1 FROM vault_wrap WHERE user_id = ?').get(userId)) : false,
    waitingMails: db.prepare('SELECT COUNT(*) n FROM vault_mail').get().n };
}
/** Felder, die erst mit einer neueren Version in die Liste kamen (oder Module, die später eingeschaltet wurden): beim Start nachverschlüsseln */
function upgradeSpec() {
  let n = 0;
  db.transaction(() => {
    for (const [t, c] of encColumns()) n += db.prepare(`UPDATE main.${q(t)} SET ${q(c)} = cw_enc(${q(c)}) WHERE ${q(c)} IS NOT NULL AND ${q(c)} != '' AND cw_isenc(${q(c)}) = 0`).run().changes;
  })();
  if (n) { console.log(`Tresor: ${n} weitere Einträge verschlüsselt.`); compact(); }
  return n;
}
/** beim Start: Kopie (gesperrt) anlegen – nachdem alle Module ihre Tabellen angelegt haben */
function start() { ON = getSetting('vault_on', '0') === '1'; if (ON) { pubKey(); try { upgradeSpec(); } catch (e) { console.error('Tresor – Nachverschlüsseln:', e.message); } rebuild(); } try { resumeJob(); } catch (e) { console.error('Tresor – unterbrochener Lauf:', e.message); } }

/* ---------- Mail-Warteschlange (Platzhalter-Adressen im gesperrten Zustand) ---------- */
const hasPlaceholder = v => (Array.isArray(v) ? v : String(v || '').split(/[,;]\s*/)).some(x => PLACEHOLDER_RE.test(String(x).trim()));
function queueMail(o) {
  const att = (o.attachments || []).map(a => {
    if (a.path) {   // Datei im Tresor ist gesperrt nicht lesbar – dann den Pfad merken und beim Versand entschlüsseln
      try { return { filename: a.filename, contentType: a.contentType, cid: a.cid, contentDisposition: a.contentDisposition, content: b64(readFile(a.path)), b64: true }; } catch (e) { return { filename: a.filename, contentType: a.contentType, path: a.path }; }
    }
    return a.content != null ? { ...a, content: b64(Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content))), b64: true } : a;
  }).filter(Boolean);
  const payload = Buffer.from(JSON.stringify({ ...o, attachments: att }));
  db.prepare('INSERT INTO vault_mail(data) VALUES (?)').run(encValue(payload));
}
const resolveAddr = v => {
  const one = x => { const m = PLACEHOLDER_RE.exec(String(x).trim()); if (!m) return String(x).trim(); const r = db.prepare('SELECT email FROM mv_person WHERE member_id = ?').get(Number(m[1])); return r && r.email && !PLACEHOLDER_RE.test(r.email) ? r.email : null; };
  return (Array.isArray(v) ? v : String(v || '').split(/[,;]\s*/)).filter(Boolean).map(one).filter(Boolean).join(', ');
};
async function flushMail(send) {
  if (!DK) return 0;
  let n = 0;
  for (const r of db.prepare('SELECT * FROM vault_mail ORDER BY id').all()) {
    let o; try { o = JSON.parse(decValue(r.data)); } catch (e) { db.prepare('DELETE FROM vault_mail WHERE id = ?').run(r.id); continue; }
    o.attachments = (o.attachments || []).map(a => (a.b64 ? { ...a, content: Buffer.from(a.content, 'base64'), b64: undefined } : a.path ? (() => { try { return { filename: a.filename, contentType: a.contentType, content: readFile(a.path) }; } catch (e) { return null; } })() : a)).filter(Boolean);
    o.to = resolveAddr(o.to); if (o.cc) o.cc = resolveAddr(o.cc) || undefined; if (o.bcc) o.bcc = resolveAddr(o.bcc) || undefined;
    if (!o.to) { db.prepare('DELETE FROM vault_mail WHERE id = ?').run(r.id); continue; }
    try { await send(o); db.prepare('DELETE FROM vault_mail WHERE id = ?').run(r.id); n++; }
    catch (e) { db.prepare('UPDATE vault_mail SET tries = tries + 1 WHERE id = ?').run(r.id); if (r.tries >= 5) db.prepare('DELETE FROM vault_mail WHERE id = ?').run(r.id); console.error('Tresor – wartende Mail:', e.message); }
  }
  return n;
}

module.exports = { SPEC, FILE_DIRS, on, locked, status, start, rebuild, suspend, onLogin, onPassword, dropUser, unlockWithCode, onUnlock,
  prepare, confirmCode, enable, disable, newRecovery, purge, writeFile, readFile, isEncFile, encValue, decValue, isEnc,
  hasPlaceholder, queueMail, flushMail, PLACEHOLDER_RE, lockedErr, _test: { lock: () => { DK = null; PRIV = null; rebuild(); } } };
