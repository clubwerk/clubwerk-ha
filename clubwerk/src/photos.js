'use strict';
/**
 * Profilbilder der Mitglieder
 * Das Mitglied lädt sein Bild in der Mitglieder-App hoch (im Handy auf 400 × 400 Pixel verkleinert, JPEG) und
 * entscheidet selbst, wo es erscheint: im Verkauf am Tablet, bei der Platzbuchung, bei den Helferdiensten.
 * Die Verwaltung sieht das Bild beim Mitglied und kann es entfernen. Gespeichert wird nur die Bilddatei im Datenordner.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, DATA_DIR, audit } = require('./db');

const DIR = path.join(DATA_DIR, 'fotos');
const MAX = 400 * 1024;
const USES = { verkauf: 'Verkauf am Tablet', buchung: 'Platzbuchung', helfer: 'Helferdienste' };
const MODULE_OF = { verkauf: 'getraenke', buchung: 'buchung', helfer: 'arbeitseinsatz' };

{ const cols = db.prepare('PRAGMA table_info(members)').all().map(c => c.name);
  if (!cols.includes('photo')) db.exec('ALTER TABLE members ADD COLUMN photo TEXT');
  if (!cols.includes('photo_use')) db.exec("ALTER TABLE members ADD COLUMN photo_use TEXT NOT NULL DEFAULT '[]'"); }

const J = v => { try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch (e) { return []; } };
const row = id => db.prepare('SELECT id, name, photo, photo_use FROM members WHERE id = ?').get(Number(id));
const file = r => (r && r.photo && /^[0-9]+-[a-f0-9]{12}\.jpg$/.test(r.photo) ? path.join(DIR, r.photo) : null);

/** Versionskennung fürs Neuladen im Browser, wenn das Bild für diesen Zweck freigegeben ist – sonst null */
function version(id, use) {
  const r = typeof id === 'object' ? id : row(id);
  if (!r || !r.photo) return null;
  if (use && !J(r.photo_use).includes(use)) return null;
  return r.photo.slice(-16, -4);
}
function info(id, isActive) {
  const r = row(id); if (!r) return null;
  return { has: Boolean(r.photo), v: version(r), use: J(r.photo_use), uses: Object.entries(USES).filter(([k]) => !isActive || isActive(MODULE_OF[k])).map(([k, l]) => ({ k, l })) };
}
/** data:image/jpeg;base64,… → speichern (ersetzt ein altes Bild) */
function save(id, dataUrl, use, who) {
  const r = row(id); if (!r) throw new Error('Mitglied nicht gefunden.');
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('Bitte ein Foto (JPEG) wählen.');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 500 || buf.length > MAX) throw new Error('Das Bild ist zu groß.');
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff || buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) throw new Error('Das ist kein gültiges JPEG-Bild.');
  fs.mkdirSync(DIR, { recursive: true });
  const name = `${r.id}-${crypto.randomBytes(6).toString('hex')}.jpg`;
  fs.writeFileSync(path.join(DIR, name), buf, { mode: 0o600 });
  const old = file(r);
  db.prepare('UPDATE members SET photo = ?, photo_use = ? WHERE id = ?').run(name, JSON.stringify(cleanUse(use)), r.id);
  if (old) try { fs.unlinkSync(old); } catch (e) { /* weg */ }
  audit(who || null, 'Profilbild gespeichert', r.name);
}
const cleanUse = use => [...new Set((Array.isArray(use) ? use : []).filter(k => USES[k]))];
function setUse(id, use) { db.prepare('UPDATE members SET photo_use = ? WHERE id = ?').run(JSON.stringify(cleanUse(use)), Number(id)); }
function remove(id, who) {
  const r = row(id); if (!r) return;
  const f = file(r);
  db.prepare("UPDATE members SET photo = NULL WHERE id = ?").run(r.id);
  if (f) try { fs.unlinkSync(f); } catch (e) { /* weg */ }
  audit(who || null, 'Profilbild entfernt', r.name);
}
/** Bild ausliefern (use = Zweck, den das Mitglied freigegeben haben muss; null = Verwaltung/eigenes Bild) */
function send(res, id, use) {
  const r = row(id), f = file(r);
  if (!f || (use && !J(r.photo_use).includes(use)) || !fs.existsSync(f)) return res.status(404).end();
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'Content-Security-Policy': "default-src 'none'", 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(f).pipe(res);
}

module.exports = { USES, MODULE_OF, version, info, save, setUse, remove, send, DIR };
