'use strict';
/* Bankkonten des Vereins – zentral für alle Module (Buchhaltung, Mitgliederverwaltung …).
   Mehrere Konten möglich, eins ist das Standardkonto; Konten lassen sich optional Abteilungen zuordnen
   (z. B. eigenes Konto der Padel-Abteilung → deren Rechnungen nennen dieses Konto). */
const { db, getSetting } = require('./db');

db.exec(`CREATE TABLE IF NOT EXISTS bank_accounts (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, holder TEXT, iban TEXT NOT NULL, bic TEXT, bank TEXT,
  departments TEXT NOT NULL DEFAULT '[]', is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
)`);

const normIban = v => String(v || '').replace(/\s+/g, '').toUpperCase();
function ibanOk(v) {
  const i = normIban(v);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(i)) return false;
  if (i.startsWith('DE') && i.length !== 22) return false;
  const r = (i.slice(4) + i.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let m = 0; for (const d of r) m = (m * 10 + Number(d)) % 97;
  return m === 1;
}
const bicOk = v => !v || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(v).replace(/\s+/g, '').toUpperCase());
const fmtIban = v => normIban(v).replace(/(.{4})/g, '$1 ').trim();
const maskIban = v => { const i = normIban(v); return i ? `${i.slice(0, 4)} •••• •••• ${i.slice(-4)}` : ''; };
const jarr = v => { try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x.map(Number).filter(Number.isInteger) : []; } catch (e) { return []; } };
const view = r => (r ? { ...r, departments: jarr(r.departments), is_default: Boolean(r.is_default), active: Boolean(r.active) } : null);

const list = ({ all = false } = {}) => db.prepare(`SELECT * FROM bank_accounts ${all ? '' : 'WHERE active = 1'} ORDER BY is_default DESC, sort, name COLLATE NOCASE`).all().map(view);
const get = id => view(db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(Number(id)));
const def = () => view(db.prepare('SELECT * FROM bank_accounts WHERE active = 1 ORDER BY is_default DESC, sort, id LIMIT 1').get());
/** Konto für eine Abteilung (zugeordnetes Konto, sonst Standardkonto) */
function forDepartment(deptId) {
  const d = Number(deptId);
  if (d) { const hit = list().find(a => a.departments.includes(d)); if (hit) return hit; }
  return def();
}
/** Konto auswählen: ausdrücklich gewählt → Abteilung → Standard */
const pick = ({ id, department } = {}) => (id && get(id) && get(id).active ? get(id) : forDepartment(department));

/** Eingabe prüfen → { v } oder { error } */
function clean(b, cur = {}) {
  const g = k => (b[k] !== undefined ? b[k] : cur[k]);
  const t = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  const v = { name: t(g('name'), 60), holder: t(g('holder'), 70) || null, iban: normIban(g('iban')), bic: String(g('bic') || '').replace(/\s+/g, '').toUpperCase() || null, bank: t(g('bank'), 70) || null,
    departments: JSON.stringify(Array.isArray(g('departments')) ? [...new Set(g('departments').map(Number).filter(Number.isInteger))] : jarr(g('departments'))),
    active: g('active') === undefined ? 1 : (g('active') ? 1 : 0), sort: Number.isInteger(Number(g('sort'))) ? Number(g('sort')) : 100 };
  if (v.name.length < 2) return { error: 'Bitte eine Bezeichnung eintragen (z. B. „Vereinskonto“ oder „Padel“).' };
  if (!ibanOk(v.iban)) return { error: 'Die IBAN ist nicht gültig (Prüfziffer).' };
  if (!bicOk(v.bic)) return { error: 'Der BIC hat 8 oder 11 Zeichen.' };
  const dup = db.prepare('SELECT name FROM bank_accounts WHERE iban = ? AND id != ?').get(v.iban, cur.id || 0);
  if (dup) return { error: `Diese IBAN ist schon als „${dup.name}“ angelegt.` };
  return { v };
}
function save(b, cur) {
  const r = clean(b, cur || {}); if (r.error) throw new Error(r.error);
  const k = Object.keys(r.v);
  let id;
  db.transaction(() => {
    if (cur) { db.prepare(`UPDATE bank_accounts SET ${k.map(x => `${x} = ?`).join(', ')} WHERE id = ?`).run(...k.map(x => r.v[x]), cur.id); id = cur.id; }
    else id = Number(db.prepare(`INSERT INTO bank_accounts(${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map(x => r.v[x])).lastInsertRowid);
    if (b.is_default || !db.prepare('SELECT 1 FROM bank_accounts WHERE is_default = 1 AND active = 1 AND id != ?').get(id)) {
      if (r.v.active) { db.prepare('UPDATE bank_accounts SET is_default = 0').run(); db.prepare('UPDATE bank_accounts SET is_default = 1 WHERE id = ?').run(id); }
    }
    if (!r.v.active) db.prepare('UPDATE bank_accounts SET is_default = 0 WHERE id = ?').run(id);
    // kein Standardkonto mehr (z. B. nach Deaktivieren) → erstes aktives wird Standard
    if (!db.prepare('SELECT 1 FROM bank_accounts WHERE is_default = 1').get()) { const f = db.prepare('SELECT id FROM bank_accounts WHERE active = 1 ORDER BY sort, id LIMIT 1').get(); if (f) db.prepare('UPDATE bank_accounts SET is_default = 1 WHERE id = ?').run(f.id); }
  })();
  return id;
}
function remove(id) {
  const cur = get(id); if (!cur) return false;
  db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(cur.id);
  if (cur.is_default) { const f = db.prepare('SELECT id FROM bank_accounts WHERE active = 1 ORDER BY sort, id LIMIT 1').get(); if (f) db.prepare('UPDATE bank_accounts SET is_default = 1 WHERE id = ?').run(f.id); }
  return true;
}
/** Einmalig: bisher in den Modulen eingetragene Konten übernehmen (Mitgliederverwaltung, Buchhaltung) */
function migrateLegacy() {
  if (db.prepare('SELECT COUNT(*) n FROM bank_accounts').get().n) return;
  const add = (name, iban, bic, bank, holder) => {
    if (!ibanOk(iban) || db.prepare('SELECT 1 FROM bank_accounts WHERE iban = ?').get(normIban(iban))) return;
    try { save({ name, iban, bic: bicOk(bic) ? bic : null, bank, holder }); } catch (e) { /* ungültig: auslassen */ }
  };
  add('Vereinskonto', getSetting('ext_mitglieder_club_iban', ''), getSetting('ext_mitglieder_club_bic', ''), getSetting('ext_mitglieder_club_bank', ''), getSetting('ext_mitglieder_creditor_name', '') || getSetting('club_name', ''));
  add('Konto Buchhaltung', getSetting('ext_buchhaltung_iban', ''), getSetting('ext_buchhaltung_bic', ''), getSetting('ext_buchhaltung_bank', ''), getSetting('club_name', ''));
}
migrateLegacy();

module.exports = { list, get, def, forDepartment, pick, save, remove, clean, ibanOk, bicOk, normIban, fmtIban, maskIban };
