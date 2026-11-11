'use strict';
/* ---------- Geheimnisse der Maschine (ab 2026.11, planung/geheimnisse.md) ----------
   Zugangsdaten, mit denen Clubwerk selbst bei anderen Diensten anklopft (Postfach, Dropbox, Sicherungsziele, Hydrawise),
   und der Schlüssel der Komplettsicherung liegen NICHT in „settings“, sondern in der Tabelle „geheimnisse“ – und die
   verschlüsselt der Tresor (vault.SPEC). Entscheidung 08.11.2026: Nach einem Neustart sind sie verschlossen, bis sich
   ein Admin mit Schlüssel anmeldet oder den Wiederherstellungscode eingibt. Bis dahin warten Mails (vault_mail) und die
   Sicherung des Tages (wird nach dem Entsperren nachgeholt). Schreiben geht auch gesperrt (öffentlicher Schlüssel).
   Ist der Tresor aus, stehen die Werte unverschlüsselt in „geheimnisse“ (wie vorher in „settings“) – die Übersicht empfiehlt dann den Tresor.
   Bewusst NICHT hier (müssen nach einem Neustart ohne Anmeldung gehen): tablet_gate_secret, admin_device_secret, cal_key,
   ICS-Schlüssel der Module, push_vapid_priv, ext_mitglieder_form_secret – Begründung in planung/geheimnisse.md.
   Menschliche Passwörter und PINs gehören nicht hierher, sondern nur als Hash (auth.hashSecret).
   API: get(name, fallback) · has(name) · set(name, wert) · drop(name) · locked(name) · wartet() · status() */
const fs = require('fs');
const path = require('path');
const { db, DATA_DIR } = require('./db');

db.exec(`CREATE TABLE IF NOT EXISTS geheimnisse (
  name       TEXT PRIMARY KEY,
  value      TEXT,                     -- verschlüsselt (Tresor: e1/p1), nur bei ausgeschaltetem Tresor Klartext
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
)`);
const vault = () => require('./vault');

/* Katalog: Name (oder Muster mit *) → Bezeichnung für die Verwaltung. Module melden ihre Namen über ctx.geheim an. */
const KATALOG = new Map([
  ['mail_smtp_pass', 'Postfach-Passwort'],
  ['dropbox_app_secret', 'Dropbox: App secret'],
  ['dropbox_refresh', 'Dropbox-Verbindung'],
  ['backup_enc_key', 'Schlüssel der Datensicherung'],
  ['backup_target_*_secret', 'Zugang zu einem Sicherungsziel'],
  ['module_backup_secret', 'Signatur der Modul-Sicherungen'],
  ['ext_beregnung_hw_key', 'Hydrawise-API-Schlüssel'],   // auch ohne aktives Modul umziehen
]);
const glob = n => new RegExp('^' + n.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9_-]+') + '$');
const bekannt = name => [...KATALOG.keys()].some(k => glob(k).test(name));
const label = name => { for (const [k, v] of KATALOG) if (glob(k).test(name)) return v; return name; };
function melden(name, text) { if (/^[a-z0-9_*-]{3,80}$/.test(name)) KATALOG.set(name, String(text || name)); }

const row = name => db.prepare('SELECT value FROM main.geheimnisse WHERE name = ?').get(String(name));
const has = name => { const r = row(name); return Boolean(r && r.value != null && r.value !== ''); };
/** Wert lesen – gesperrter Tresor oder nicht vorhanden → fallback */
function get(name, fallback = '') {
  const r = row(name);
  if (!r || r.value == null || r.value === '') return fallback;
  const v = vault();
  if (!v.isEnc(r.value)) return r.value;
  try { return v.decValue(r.value); } catch (e) { return fallback; }
}
/** vorhanden, aber gerade nicht lesbar (Tresor gesperrt) */
const locked = name => has(name) && get(name, null) === null;
function set(name, value) {
  name = String(name);
  if (!bekannt(name)) throw new Error(`Geheimnis „${name}“ ist nicht im Katalog (src/geheim.js bzw. ctx.geheim.melden).`);
  if (value == null || value === '') return drop(name);
  const v = vault(), s = String(value);
  db.prepare("INSERT INTO main.geheimnisse(name, value, updated_at) VALUES (?, ?, datetime('now','localtime')) ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(name, v.on() ? v.encValue(s) : s);
}
function drop(name) { db.prepare('DELETE FROM main.geheimnisse WHERE name = ?').run(String(name)); }
/** gespeicherte Geheimnisse, die gerade warten (Tresor gesperrt) → [{ name, label }] */
const wartet = () => (vault().locked() ? db.prepare("SELECT name FROM main.geheimnisse WHERE value IS NOT NULL AND value != ''").all().map(r => ({ name: r.name, label: label(r.name) })) : []);
const status = () => ({ locked: vault().locked(), list: db.prepare("SELECT name, updated_at FROM main.geheimnisse WHERE value IS NOT NULL AND value != ''").all().map(r => ({ name: r.name, label: label(r.name), at: r.updated_at })) });

/* ---------- Umzug aus „settings“ (bestehende Installationen, zurückgespielte alte Sicherungen) ----------
   Bei jedem Start (vault.start): Was noch als Klartext in settings steht, wandert (verschlüsselt, auch im gesperrten Zustand)
   in „geheimnisse“ und wird aus settings gelöscht. Danach räumt der Tresor die Datei auf (VACUUM), damit kein Klartext in
   freien Seiten bleibt. Steht ein Wert in settings, ist er der neuere (z. B. nach Zurückgehen auf eine ältere Version). */
function alteZeilen(d) {
  const keys = d.prepare('SELECT key, value FROM settings').all();
  return keys.filter(r => bekannt(r.key));
}
function umziehen() {
  const rows = alteZeilen(db);
  if (!rows.length) return 0;
  const v = vault();
  db.pragma('secure_delete = ON');
  db.transaction(() => {
    for (const r of rows) {
      if (r.value != null && r.value !== '') db.prepare("INSERT INTO main.geheimnisse(name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = datetime('now','localtime')")
        .run(r.key, v.on() ? v.encValue(String(r.value)) : String(r.value));
      db.prepare('DELETE FROM settings WHERE key = ?').run(r.key);
    }
  })();
  console.log(`Geheimnisse: ${rows.length} Einträge aus den Einstellungen in den Tresor übernommen.`);
  return rows.length;
}

/* ---------- Alte Schnappschüsse bereinigen (/data/backups/*.db, auch ha-snapshot.db) ----------
   Schnappschüsse von vor dem Umzug enthalten die Zugangsdaten im Klartext. Gleicher Tresor (gleicher öffentlicher Schlüssel)
   → dort genauso umziehen, Wiederherstellen geht weiter. Anderer oder kein Tresor → Werte entfernen (nach dem Zurückspielen
   neu eintragen). Danach VACUUM. Eine Datei, die nicht klappt, bleibt unverändert und wird gemeldet. */
function schnappschuesse(dir) {
  const out = { bereinigt: [], fehler: [] };
  let files = []; try { files = fs.readdirSync(dir).filter(f => /^[\w.-]+\.db$/.test(f)); } catch (e) { return out; }
  const Database = require('better-sqlite3'), v = vault();
  const pub = require('./db').getSetting('vault_pub', '');
  for (const f of files) {
    const file = path.join(dir, f);
    let d;
    try {
      d = new Database(file, { fileMustExist: true });
      if (!d.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get()) continue;
      const rows = alteZeilen(d);
      if (!rows.length) continue;
      const s = k => { const x = d.prepare('SELECT value FROM settings WHERE key = ?').get(k); return x ? x.value : ''; };
      const gleich = v.on() && pub && s('vault_on') === '1' && s('vault_pub') === pub;
      d.pragma('secure_delete = ON');
      d.transaction(() => {
        if (gleich) d.exec("CREATE TABLE IF NOT EXISTS geheimnisse (name TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')))");
        for (const r of rows) {
          if (gleich && r.value) d.prepare('INSERT INTO geheimnisse(name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value').run(r.key, v.encValue(String(r.value)));
          d.prepare('DELETE FROM settings WHERE key = ?').run(r.key);
        }
      })();
      d.exec('VACUUM');
      d.pragma('journal_mode = DELETE');
      out.bereinigt.push(f);
    } catch (e) { out.fehler.push(`${f}: ${e.message}`); }
    finally { if (d) try { d.close(); } catch (e) { /* zu */ } for (const x of ['-wal', '-shm']) { try { fs.unlinkSync(file + x); } catch (e) { /* keine */ } } }
  }
  if (out.bereinigt.length) console.log(`Geheimnisse: ${out.bereinigt.length} ältere Schnappschüsse bereinigt.`);
  if (out.fehler.length) console.error('Geheimnisse – Schnappschüsse nicht bereinigt:', out.fehler.join(' · '));
  return out;
}

/** Zugriff für ein Modul: Namen bekommen automatisch das Präfix ext_<id>_ */
function fuerModul(id) {
  const n = k => `ext_${id}_${k}`;
  return { get: (k, fb) => get(n(k), fb), has: k => has(n(k)), set: (k, v) => set(n(k), v), drop: k => drop(n(k)), locked: k => locked(n(k)), melden: (k, text) => melden(n(k), text) };
}

module.exports = { get, has, set, drop, locked, wartet, status, umziehen, schnappschuesse, melden, label, bekannt, fuerModul, KATALOG, DATA_DIR };
