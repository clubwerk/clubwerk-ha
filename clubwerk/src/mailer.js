'use strict';
/**
 * Nachrichten (Verein → Nachrichten, früher „E-Mail“)
 * Nachrichten an Mitglieder schreiben wie in einem E-Mail-Programm – Weg wählbar: E-Mail, Mitglieder-App (Postfach „Nachrichten“) und Push-Hinweis.
 * E-Mail: Empfänger aus Gruppen (Status, Abteilungen, Ämter,
 * Beiträge), einzelnen Mitgliedern, freien Adressen und gespeicherten Verteilern; formatierter Text, Anhänge,
 * Entwürfe (automatisch gespeichert), Vorlagen, Gesendet-Ordner mit Zustellstatus je Empfänger.
 * Gesendet wird immer über das Vereinspostfach (Einstellungen → Postfach) – mit dem Namen des Absenders und
 * SEINER Antwortadresse: Jeder im Vorstand schreibt im Namen des Vereins, Antworten landen bei ihm persönlich.
 * App und Push: Beim Senden entsteht je Empfänger eine Zeile in msg_inbox (Empfängerkreis wird festgehalten, spätere Gruppenänderungen ändern nichts);
 * das Mitglied sieht nur seine eigenen Nachrichten (src/nachrichten.js). Nachrichten laufen nach einem Zeitraum ab oder sind angeheftet.
 * Recht „E-Mail“ (Anzeige „Nachrichten schreiben“); mit einer Rolle „nur eigene Abteilung“ nur an Mitglieder der eigenen Abteilungen – auch für App und Push.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { db, DATA_DIR, getSetting, setSetting, audit, nameKey, splitPersonName, lastFirst } = require('./db');
const mail = require('./mail');
const { nowTs: now, today, esc } = require('./util');

/* ---------- kleine Helfer (vor der Rechte-Migration unten, die sie schon beim Laden braucht) ---------- */
const J = (v, d) => { try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };
const one = (v, n) => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
const okMail = m => /^[^@\s<>,;"]+@[^@\s<>,;"]+\.[^@\s<>,;"]+$/.test(m);
const club = () => getSetting('club_name', 'Verein');

const DIR = path.join(DATA_DIR, 'mail-anhaenge');
const MAX_FILE = 10 * 1024 * 1024, MAX_TOTAL = 20 * 1024 * 1024, MAX_FILES = 10, MAX_RCPT = 1500;
const STATUS = { aktuell: 'alle aktuellen Mitglieder', aktiv: 'aktive Mitglieder', passiv: 'passive Mitglieder', ehren: 'Ehrenmitglieder', ruhend: 'ruhende Mitglieder', jugend: 'Kinder & Jugendliche (unter 18)' };

db.exec(`
CREATE TABLE IF NOT EXISTS mail_message (
  id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL DEFAULT '', html TEXT NOT NULL DEFAULT '',
  spec TEXT NOT NULL DEFAULT '{}',                 -- Empfänger: { groups:[{t,v}], members:[id], addresses:[…], lists:[id], payer:1 }
  files TEXT NOT NULL DEFAULT '[]',                -- [{ id, name, size, type }]
  status TEXT NOT NULL DEFAULT 'entwurf',          -- entwurf | sendet | gesendet | teilweise
  copy_me INTEGER NOT NULL DEFAULT 1,
  from_name TEXT, reply_to TEXT, signature_html TEXT,
  user_id INTEGER, user_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), updated_at TEXT, sent_at TEXT,
  total INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS mail_recipient (
  id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL REFERENCES mail_message(id) ON DELETE CASCADE,
  member_id INTEGER, name TEXT, email TEXT NOT NULL, via TEXT,
  status TEXT NOT NULL DEFAULT 'wartet', error TEXT, sent_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_mailrcpt_msg ON mail_recipient(message_id);
CREATE TABLE IF NOT EXISTS mail_list (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, spec TEXT NOT NULL DEFAULT '{}', updated_by TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS mail_template (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '', html TEXT NOT NULL DEFAULT '', updated_by TEXT, updated_at TEXT);
`);
{
  const cols = db.prepare('PRAGMA table_info(mail_message)').all().map(c => c.name);
  for (const [c, t] of [['signature_html', 'TEXT'], ['channels', `TEXT NOT NULL DEFAULT '["mail"]'`], ['keep_months', 'INTEGER'], ['expires_at', 'TEXT'], ['pinned', 'INTEGER NOT NULL DEFAULT 0'], ['app_stats', 'TEXT']])
    if (!cols.includes(c)) db.exec(`ALTER TABLE mail_message ADD COLUMN ${c} ${t}`);
}
/* Postfach in der Mitglieder-App: eine Zeile je Empfänger und Nachricht (read_at = vom Mitglied geöffnet, push = ja/nein) */
db.exec(`
CREATE TABLE IF NOT EXISTS msg_inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL REFERENCES mail_message(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id), read_at TEXT, push TEXT,
  UNIQUE(message_id, member_id)
);
CREATE INDEX IF NOT EXISTS ix_inbox_member ON msg_inbox(member_id, message_id);
`);
// Einmalig (3.10): Wer bisher Rundmails aus der Mitgliederverwaltung schicken durfte, bekommt das neue Recht „E-Mail“.
// Die Markierung wird erst gesetzt, wenn alles ohne Fehler durchlief – sonst beim nächsten Start noch einmal versuchen.
(function migratePerm() {
  if (getSetting('mail_perm_migrated', '')) return;
  if (!db.prepare('SELECT 1 FROM admin_users LIMIT 1').get()) { setSetting('mail_perm_migrated', '1'); return; }   // frische Installation: Rollenvorlagen bleiben wie ausgeliefert
  const add = v => { const a = J(v, []); return Array.isArray(a) && a.includes('mitglieder') && !a.includes('email') ? JSON.stringify([...a, 'email']) : null; };
  try {
    db.transaction(() => {
      for (const r of db.prepare('SELECT id, perms FROM admin_roles').all()) { const n = add(r.perms); if (n) db.prepare('UPDATE admin_roles SET perms = ? WHERE id = ?').run(n, r.id); }
      for (const u of db.prepare('SELECT id, perms FROM admin_users').all()) { const n = add(u.perms); if (n) db.prepare('UPDATE admin_users SET perms = ? WHERE id = ?').run(n, u.id); }
    })();
    setSetting('mail_perm_migrated', '1');
  } catch (e) { console.error('E-Mail: Rechte übernehmen', e.message); }
})();

/* ---------- HTML: nur einfache Formatierung durchlassen ---------- */
const TAGS = new Set(['p', 'br', 'div', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'blockquote', 'hr', 'span']);
const RENAME = { h1: 'h2', h4: 'h3', h5: 'h3', h6: 'h3', strike: 's', del: 's' };
function clean(html) {
  let s = String(html || '').slice(0, 300000);
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|head|title|iframe|object|embed|svg|math|template|noscript|textarea|select)\b[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (m, tag, attrs) => {
    let t = tag.toLowerCase(); t = RENAME[t] || t;
    if (!TAGS.has(t)) return '';
    if (m[1] === '/') return t === 'br' || t === 'hr' ? '' : `</${t}>`;
    if (t === 'a') {
      const h = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const href = h ? (h[2] || h[3] || h[4] || '').replace(/&amp;/g, '&').trim() : '';
      return /^(https?:\/\/|mailto:)/i.test(href) && !/["<>\s]/.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener">` : '<a>';
    }
    return t === 'br' || t === 'hr' ? `<${t}>` : `<${t}>`;
  });
  return s.replace(/<[^>]*$/, '').trim();
}
/** Textfassung für Mailprogramme ohne HTML */
function toText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h2|h3|blockquote)>/gi, '\n\n').replace(/<li>/gi, '• ').replace(/<\/li>/gi, '\n').replace(/<hr>/gi, '\n—\n')
    .replace(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, h, t) => { const tt = t.replace(/<[^>]+>/g, ''); const hh = h.replace(/&amp;/g, '&'); return tt && tt !== hh && 'mailto:' + tt !== hh ? `${tt} (${hh.replace(/^mailto:/, '')})` : hh.replace(/^mailto:/, ''); })
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const sigBlock = sig => (sig ? `<div style="margin-top:20px">${sig}</div>` : '');
const plainLen = html => toText(html).replace(/\s+/g, '').length;
/** Mail-Hülle: schlicht, gut lesbar in allen Programmen */
const wrap = body => `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#ffffff"><div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1d1f1e;max-width:640px;padding:16px">${body}</div></body></html>`;

/* ---------- Empfänger ---------- */
const hasMv = () => {
  try { if (!require('./plugins').isActive('mitglieder')) return false; } catch (e) { return false; }
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'mv_person'").get());
};
const ageAt = (b, day) => { if (!b || !/^\d{4}-\d{2}-\d{2}/.test(b)) return null; let a = Number(day.slice(0, 4)) - Number(b.slice(0, 4)); if (day.slice(5) < b.slice(5, 10)) a--; return a; };
/** alle (nicht anonymisierten) Mitglieder mit Kontakt- und Gruppendaten */
function people() {
  if (!hasMv()) return [];
  const day = today();
  const rows = db.prepare(`SELECT m.id, m.name, m.kind, p.first_name, p.last_name, p.salutation, p.letter_salutation, p.member_no, p.email, p.status, p.birth_date, p.exit_date, p.payer_id,
      (SELECT group_concat(md.department_id) FROM mv_member_department md WHERE md.member_id = m.id AND (md.exit_date IS NULL OR md.exit_date >= ?)) AS depts,
      (SELECT group_concat(mf.fee_id) FROM mv_member_fee mf WHERE mf.member_id = m.id AND (mf.end_date IS NULL OR mf.end_date >= ?)) AS fees,
      (SELECT group_concat(f.name, '|') FROM mv_function f WHERE f.member_id = m.id AND (f.to_date IS NULL OR f.to_date >= ?) AND (f.from_date IS NULL OR f.from_date <= ?)) AS funcs
    FROM members m JOIN mv_person p ON p.member_id = m.id
    WHERE m.kind = 'mitglied' AND m.deleted = 0 AND COALESCE(m.pending, 0) = 0 AND p.anonymized_at IS NULL`).all(day, day, day, day);
  return rows.map(r => ({ ...r, exited: Boolean(r.exit_date && r.exit_date < day), age: ageAt(r.birth_date, day), status: r.status || 'aktiv',
    depts: r.depts ? r.depts.split(',').map(Number) : [], fees: r.fees ? r.fees.split(',').map(Number) : [], funcs: r.funcs ? r.funcs.split('|') : [] }));
}
/** ohne Mitgliederverwaltung: nur Namen – reicht für Nachrichten in der App */
function plainPeople() {
  return db.prepare("SELECT id, name, kind FROM members WHERE kind = 'mitglied' AND deleted = 0 AND COALESCE(pending, 0) = 0").all()
    .map(r => ({ ...r, email: '', status: 'aktiv', age: null, exited: false, depts: [], fees: [], funcs: [], payer_id: null, birth_date: null }));
}
const everyone = () => (hasMv() ? people() : plainPeople());
/** Gruppen anderer Module (z. B. Mannschaften): Hook recipientGroups = () => [{ key, label, members: () => [Mitglieds-IDs] }] */
function hookGroups() {
  const out = [];
  try {
    for (const p of require('./plugins').withHook('recipientGroups')) {
      let list = []; try { list = p.hooks.recipientGroups() || []; } catch (e) { list = []; }
      for (const g of list) if (g && g.key && g.label && typeof g.members === 'function') out.push({ key: String(g.key).slice(0, 60), label: String(g.label).slice(0, 80), members: g.members });
    }
  } catch (e) { /* ohne Module */ }
  return out;
}
const grpSets = () => new Map(hookGroups().map(g => { let ids = []; try { ids = g.members() || []; } catch (e) { ids = []; } return [g.key, new Set(ids.map(Number))]; }));
/** Mitglieder mit gekoppeltem Handy (Mitglieder-App) */
const pairedIds = () => new Set(db.prepare("SELECT DISTINCT member_id FROM member_devices WHERE scope = 'app' AND token_hash IS NOT NULL").all().map(r => r.member_id));
const scopeOf = user => ((user.deptOnly || []).includes('email') ? (user.depts || []) : null);
/** „Name <a@b.de>“ oder „a@b.de“ → { name, email } */
function parseAddr(x) {
  const s = String(x || '').trim(); if (!s) return null;
  const m = /^(.*?)<([^>]+)>$/.exec(s);
  const email = (m ? m[2] : s).trim().toLowerCase(), name = m ? m[1].replace(/["']/g, '').trim() : '';
  return okMail(email) ? { name, email } : { bad: s };
}
function cleanSpec(b, { lists = true } = {}) {
  const x = b && typeof b === 'object' ? b : {};
  const groups = (Array.isArray(x.groups) ? x.groups : []).filter(g => g && ['status', 'dept', 'func', 'fee', 'grp'].includes(g.t)).map(g => ({ t: g.t, v: g.t === 'func' || g.t === 'grp' ? one(g.v, 80) : g.t === 'status' ? (STATUS[g.v] ? g.v : null) : parseInt(g.v, 10) || null })).filter(g => g.v);
  const members = [...new Set((Array.isArray(x.members) ? x.members : []).map(Number).filter(Number.isInteger))].slice(0, MAX_RCPT);
  const addresses = [...new Set((Array.isArray(x.addresses) ? x.addresses : []).map(a => one(a, 200)).filter(Boolean))].slice(0, 500);
  const out = { groups: groups.slice(0, 50), members, addresses, payer: x.payer === false ? false : true };
  if (x.allApp === true) out.allApp = true;   // alle Mitglieder mit gekoppeltem Handy (nur App/Push)
  if (lists) out.lists = [...new Set((Array.isArray(x.lists) ? x.lists : []).map(Number).filter(Number.isInteger))].slice(0, 20);
  return out;
}
const inGroup = (p, g, sets) => {
  if (p.exited) return false;
  if (g.t === 'grp') return Boolean(sets && sets.get(String(g.v)) && sets.get(String(g.v)).has(p.id));
  if (g.t === 'status') return g.v === 'aktuell' ? true : g.v === 'jugend' ? p.age != null && p.age < 18 : p.status === g.v;
  if (g.t === 'dept') return p.depts.includes(g.v);
  if (g.t === 'fee') return p.fees.includes(g.v);
  if (g.t === 'func') return p.funcs.some(f => f.toLowerCase() === String(g.v).toLowerCase());
  return false;
};
/**
 * Empfänger auflösen → { rcpt:[{ member_id, name, email, via, person }], without:[Name], bad:[Adresse] }
 * Eine Adresse bekommt die Mail nur einmal (Familien); ohne eigene E-Mail auf Wunsch an den Zahler (z. B. Eltern).
 */
function resolve(spec, user) {
  const sp = cleanSpec(spec);
  for (const id of sp.lists || []) {   // Verteiler einsetzen
    const l = db.prepare('SELECT spec FROM mail_list WHERE id = ?').get(id); if (!l) continue;
    const ls = cleanSpec(J(l.spec, {}), { lists: false });
    sp.groups.push(...ls.groups); sp.members.push(...ls.members); sp.addresses.push(...ls.addresses);
  }
  const all = everyone(), byId = new Map(all.map(p => [p.id, p]));
  const scope = scopeOf(user);
  const allowed = p => !scope || p.depts.some(d => scope.includes(d));
  const sets = sp.groups.some(g => g.t === 'grp') ? grpSets() : null;
  const chosen = new Map();
  for (const p of all) if (allowed(p) && sp.groups.some(g => inGroup(p, g, sets))) chosen.set(p.id, p);
  for (const id of sp.members) { const p = byId.get(id); if (p && allowed(p)) chosen.set(id, p); }
  // Kreis für die App: gewählte Gruppen und Mitglieder, dazu auf Wunsch alle mit gekoppeltem Handy (nur ohne Abteilungs-Beschränkung)
  const app = new Map(chosen);
  if (sp.allApp && !scope) { const paired = pairedIds(); for (const p of all) if (!p.exited && paired.has(p.id)) app.set(p.id, p); }
  const rcpt = [], seen = new Map(), without = [];
  const add = (email, r) => {
    const k = email.toLowerCase();
    const cur = seen.get(k);
    if (cur) { if (r.person && !r.person.payer_id && cur.person && cur.person.payer_id) Object.assign(cur, r, { email: cur.email }); return; }   // Familie: der Zahler wird angesprochen
    const row = { ...r, email: k }; seen.set(k, row); rcpt.push(row);
  };
  const sorted = [...chosen.values()].sort((a, b) => nameKey(a.name, a.kind).localeCompare(nameKey(b.name, b.kind), 'de'));
  for (const p of sorted) {
    if (p.email && okMail(String(p.email).trim().toLowerCase())) { add(String(p.email).trim(), { member_id: p.id, name: p.name, via: null, person: p }); continue; }
    const payer = p.payer_id && sp.payer !== false ? byId.get(p.payer_id) : null;
    if (payer && payer.email && okMail(String(payer.email).trim().toLowerCase())) add(String(payer.email).trim(), { member_id: p.id, name: p.name, via: payer.name, person: p });
    else without.push(p.name);
  }
  const bad = [];
  for (const a of sp.addresses) {
    const x = parseAddr(a); if (!x) continue;
    if (x.bad) { bad.push(x.bad); continue; }
    const p = all.find(q => q.email && String(q.email).trim().toLowerCase() === x.email);
    add(x.email, p && allowed(p) ? { member_id: p.id, name: p.name, via: null, person: p } : { member_id: null, name: x.name || x.email, via: null, person: null });
  }
  const appRows = [...app.values()].sort((a, b) => nameKey(a.name, a.kind).localeCompare(nameKey(b.name, b.kind), 'de')).map(p => ({ member_id: p.id, name: p.name }));
  return { rcpt, without, bad, app: appRows };
}

/* ---------- Platzhalter ---------- */
const PH = ['vorname', 'nachname', 'name', 'anrede', 'briefanrede', 'mitgliedsnr', 'verein'];
function vars(r) {
  const p = r.person;
  if (!p) return { vorname: '', nachname: '', name: r.name && r.name !== r.email ? r.name : '', anrede: '', briefanrede: r.name && r.name !== r.email ? `Hallo ${r.name.split(/\s+/)[0]}` : 'Guten Tag', mitgliedsnr: '', verein: club() };
  const sp = splitPersonName(p.name);
  const first = p.first_name || sp.first;
  const last = p.last_name || sp.last;
  return { vorname: first || '', nachname: last || '', name: p.name, anrede: p.salutation || '', briefanrede: p.letter_salutation || (first ? `Hallo ${first}` : 'Guten Tag'), mitgliedsnr: p.member_no || '', verein: club() };
}
const fillText = (t, v) => String(t).replace(/\{(vorname|nachname|name|anrede|briefanrede|mitgliedsnr|verein)\}/g, (m, k) => v[k] || '');
const fillHtml = (t, v) => String(t).replace(/\{(vorname|nachname|name|anrede|briefanrede|mitgliedsnr|verein)\}/g, (m, k) => esc(v[k] || ''));

/* ---------- Absender je Benutzer ---------- */
function identity(user) {
  const cur = J(getSetting('mail_id_' + user.id, '{}'), {});
  let memberMail = '';
  try {
    const u = db.prepare('SELECT member_id FROM admin_users WHERE id = ?').get(user.id);
    if (u && u.member_id && hasMv()) { const p = db.prepare('SELECT email FROM mv_person WHERE member_id = ?').get(u.member_id); memberMail = (p && p.email) || ''; }
  } catch (e) { /* ohne Mitgliedsverknüpfung */ }
  return { name: cur.name != null ? cur.name : (user.name || user.username || ''), reply_to: cur.reply_to != null ? cur.reply_to : memberMail, signature: cur.signature || '', set: Boolean(cur.saved) };
}

/* ---------- Anhänge ---------- */
const safeName = n => String(n || 'Datei').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'Datei';
const fileDir = id => path.join(DIR, String(id));
const filePath = (id, f) => path.join(fileDir(id), `${f.id}.bin`);
const BLOCK_EXT = /\.(exe|bat|cmd|com|scr|pif|vbs|vbe|js|jse|wsf|wsh|msi|msp|ps1|jar|lnk|reg|hta|cpl|dll)$/i;
function removeFiles(id) { try { fs.rmSync(fileDir(id), { recursive: true, force: true }); } catch (e) { /* weg */ } }
/** Gesendete Rundmails samt Empfängern und Anhängen, verschickt vor dem Tag `before` (Löschfrist, src/datenschutz.js) */
const oldSent = before => db.prepare("SELECT id FROM mail_message WHERE status IN ('gesendet', 'teilweise') AND pinned = 0 AND NOT EXISTS (SELECT 1 FROM msg_inbox WHERE message_id = mail_message.id) AND COALESCE(sent_at, created_at) < ?").all(before).map(r => r.id);   // was noch in der App steht (angeheftet oder nicht abgelaufen), bleibt
function purgeSent(before) {
  const ids = oldSent(before);
  for (const id of ids) { db.prepare('DELETE FROM mail_recipient WHERE message_id = ?').run(id); db.prepare('DELETE FROM mail_message WHERE id = ?').run(id); removeFiles(id); }
  return ids.length;
}
function copyFiles(from, to) {
  const files = J(db.prepare('SELECT files FROM mail_message WHERE id = ?').get(from).files, []);
  if (!files.length) return [];
  fs.mkdirSync(fileDir(to), { recursive: true });
  return files.filter(f => { try { fs.copyFileSync(filePath(from, f), filePath(to, f)); return true; } catch (e) { return false; } });
}

/* ---------- Versand im Hintergrund ---------- */
const running = new Set();
async function work(id) {
  if (running.has(id)) return; running.add(id);
  let sess = null;
  try {
    const m = db.prepare('SELECT * FROM mail_message WHERE id = ?').get(id); if (!m) return;
    const files = J(m.files, []).map(f => ({ filename: f.name, path: filePath(id, f), contentType: f.type || undefined }));
    const all = new Map(people().map(p => [p.id, p]));
    sess = mail.session();
    const upd = db.prepare("UPDATE mail_recipient SET status = ?, error = ?, sent_at = ? WHERE id = ?");
    for (;;) {
      const r = db.prepare("SELECT * FROM mail_recipient WHERE message_id = ? AND status = 'wartet' ORDER BY id LIMIT 1").get(id);
      if (!r) break;
      const v = r.via === '__kopie' ? vars({ name: m.from_name, email: r.email }) : vars({ ...r, person: r.member_id ? all.get(r.member_id) : null });
      const subject = (r.via === '__kopie' ? '[Kopie] ' : '') + fillText(m.subject, v);
      const body = fillHtml(m.html, v) + sigBlock(m.signature_html);
      try {
        await sess.send({ to: r.email, replyTo: m.reply_to || undefined, fromName: m.from_name ? `${m.from_name} · ${club()}` : club(), subject, html: wrap(body), text: toText(body), attachments: files, raw: true });
        upd.run('ok', null, now(), r.id);
      } catch (e) { upd.run('fehler', String(e.message || e).slice(0, 300), now(), r.id); }
      await new Promise(ok => setTimeout(ok, process.env.CW_MAIL_DELAY != null ? Number(process.env.CW_MAIL_DELAY) : 250));
    }
    const c = db.prepare("SELECT SUM(status = 'ok') AS ok, SUM(status = 'fehler') AS bad FROM mail_recipient WHERE message_id = ? AND COALESCE(via, '') != '__kopie'").get(id);
    db.prepare('UPDATE mail_message SET status = ?, sent = ?, failed = ? WHERE id = ?').run(c.bad ? 'teilweise' : 'gesendet', c.ok || 0, c.bad || 0, id);
  } catch (e) {
    console.error('E-Mail: Versand', id, e.message);
    db.prepare("UPDATE mail_recipient SET status = 'fehler', error = ? WHERE message_id = ? AND status = 'wartet'").run(String(e.message).slice(0, 300), id);
    const c = db.prepare("SELECT SUM(status = 'ok') AS ok, SUM(status = 'fehler') AS bad FROM mail_recipient WHERE message_id = ? AND COALESCE(via, '') != '__kopie'").get(id);
    db.prepare("UPDATE mail_message SET status = 'teilweise', sent = ?, failed = ? WHERE id = ?").run(c.ok || 0, c.bad || 0, id);
  } finally { if (sess) sess.close(); running.delete(id); }
}
// nach einem Neustart angefangene Versände fortsetzen
setTimeout(() => { for (const r of db.prepare("SELECT id FROM mail_message WHERE status = 'sendet'").all()) work(r.id); }, 5000).unref();

/* ---------- Wege (E-Mail, App, Push) und Aufbewahrung in der App ---------- */
const WAYS = ['mail', 'app', 'push'];
/** Wege einer Nachricht: mindestens einer; Push öffnet die Nachricht in der App, braucht sie also */
function cleanChannels(c) {
  let a = Array.isArray(c) ? c : J(c, ['mail']);
  a = WAYS.filter(w => Array.isArray(a) && a.includes(w));
  if (a.includes('push') && !a.includes('app')) a.push('app');
  return WAYS.some(w => a.includes(w)) ? WAYS.filter(w => a.includes(w)) : ['mail'];
}
const KEEP = [1, 3, 6, 12, 24];
const keepDefault = () => { const m = parseInt(getSetting('msg_keep_months', '6'), 10); return KEEP.includes(m) ? m : 6; };
const addMonths = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
/** Ist die Nachricht (noch) in der App sichtbar? */
const inApp = (m, day = today()) => Boolean(m.pinned) || !m.expires_at || m.expires_at >= day;
/** Abgelaufene Nachrichten aus den Postfächern der Mitglieder entfernen; der Gelesen-Stand bleibt als Zahl an der Nachricht */
function cleanupInbox() {
  const day = today();
  const old = db.prepare("SELECT id FROM mail_message WHERE pinned = 0 AND expires_at IS NOT NULL AND expires_at < ? AND EXISTS (SELECT 1 FROM msg_inbox WHERE message_id = mail_message.id)").all(day);
  for (const o of old) {
    const c = db.prepare('SELECT COUNT(*) AS total, SUM(read_at IS NOT NULL) AS opened FROM msg_inbox WHERE message_id = ?').get(o.id);
    db.transaction(() => {
      db.prepare('UPDATE mail_message SET app_stats = ? WHERE id = ?').run(JSON.stringify({ total: c.total, opened: c.opened || 0 }), o.id);
      db.prepare('DELETE FROM msg_inbox WHERE message_id = ?').run(o.id);
    })();
  }
  return old.length;
}
try { cleanupInbox(); } catch (e) { console.error('Nachrichten: Aufräumen', e.message); }
setInterval(() => { try { cleanupInbox(); } catch (e) { /* nächster Versuch */ } }, 6 * 3600 * 1000).unref();

const PUSH_KEY = 'nachrichten.nachricht';
/** Push-Hinweis an alle Empfänger in der App – nur Titel und ein fester Satz, nie der Inhalt; Ergebnis je Mitglied in msg_inbox.push */
async function pushOut(id) {
  const push = require('./push');
  const m = db.prepare('SELECT * FROM mail_message WHERE id = ?').get(id); if (!m) return;
  const rows = db.prepare('SELECT member_id FROM msg_inbox WHERE message_id = ?').all(id);
  const all = new Map(everyone().map(p => [p.id, p]));
  const body = `Neue Nachricht von ${club()}`;
  const upd = db.prepare('UPDATE msg_inbox SET push = ? WHERE message_id = ? AND member_id = ?');
  for (const r of rows) {
    let ok = false;
    try { const v = vars({ name: (all.get(r.member_id) || {}).name || '', email: '', person: all.get(r.member_id) || null }); ok = (await push.send([r.member_id], PUSH_KEY, { title: fillText(m.subject, v), body, url: `./#n=${id}`, tag: `nachricht-${id}` })).sent > 0; } catch (e) { ok = false; }
    upd.run(ok ? 'ja' : 'nein', id, r.member_id);
  }
}

/** App-Zahlen für den Vorstand: nur „geöffnet von insgesamt“ – nie wer (Datenschutz) */
function appStats(m) {
  if (!cleanChannels(m.channels).includes('app')) return null;
  const c = db.prepare('SELECT COUNT(*) AS total, SUM(read_at IS NOT NULL) AS opened, SUM(push = ?) AS pushed FROM msg_inbox WHERE message_id = ?').get('ja', m.id);
  const st = c.total ? { total: c.total, opened: c.opened || 0, pushed: c.pushed || 0, expired: false } : { ...J(m.app_stats, { total: 0, opened: 0 }), pushed: 0, expired: true };
  return { ...st, pinned: Boolean(m.pinned), expires_at: m.expires_at || null };
}
/** Wen hat die Nachricht auf welchem Weg erreicht? Eine Zeile je Person: „E-Mail“, „App“, „Push“ oder „nicht erreichbar“ (ohne Gelesen-Stand) */
function reachOf(m, rcpt) {
  const ch = cleanChannels(m.channels), by = new Map();
  const row = (id, name) => { const k = id ? 'm' + id : 'x' + name; if (!by.has(k)) by.set(k, { name, ways: [], tried: [] }); return by.get(k); };
  const paired = pairedIds();
  for (const r of rcpt) { const x = row(r.member_id, r.name); if (r.status === 'ok') x.ways.push('E-Mail'); else x.tried.push(r.status === 'fehler' ? 'E-Mail fehlgeschlagen' : 'E-Mail wartet'); }
  if (ch.includes('app')) {
    const names = new Map(everyone().map(p => [p.id, p.name]));
    for (const r of db.prepare('SELECT member_id, push FROM msg_inbox WHERE message_id = ?').all(m.id)) {
      const x = row(r.member_id, names.get(r.member_id) || '–');
      if (paired.has(r.member_id)) x.ways.push('App'); else x.tried.push('kein Handy in der App');
      if (r.push === 'ja') x.ways.push('Push');
    }
  }
  return [...by.values()].map(x => ({ name: x.name, ways: x.ways, note: x.tried.join(', '), reached: x.ways.length > 0 }))
    .sort((a, b) => nameKey(a.name, 'mitglied').localeCompare(nameKey(b.name, 'mitglied'), 'de'));
}

/* ---------- Routen ---------- */
function routes(admin, { need, bad }) {
  const P = need('email');
  const mine = (req, m) => m && (m.user_id === req.user.id);
  const draftOf = (req, res) => {
    const m = db.prepare('SELECT * FROM mail_message WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!m || m.status !== 'entwurf' || !mine(req, m)) { bad(res, 'Entwurf nicht gefunden.', 404); return null; }
    return m;
  };
  const seeAll = req => !scopeOf(req.user);
  const visible = (req, m) => m && (m.status === 'entwurf' ? mine(req, m) : seeAll(req) || mine(req, m));
  const out = m => ({ id: m.id, subject: m.subject, html: m.html, spec: cleanSpec(J(m.spec, {})), files: J(m.files, []), status: m.status, copy_me: Boolean(m.copy_me),
    channels: cleanChannels(m.channels), keep_months: m.keep_months || null, pinned: Boolean(m.pinned), expires_at: m.expires_at || null,
    from_name: m.from_name, reply_to: m.reply_to, signature_html: m.signature_html || '', user_name: m.user_name, created_at: m.created_at, updated_at: m.updated_at, sent_at: m.sent_at, total: m.total, sent: m.sent, failed: m.failed });

  admin.get('/mail/options', P, (req, res) => {
    const mv = hasMv(), scope = scopeOf(req.user);
    const ppl = everyone().filter(p => !p.exited && (!scope || p.depts.some(d => scope.includes(d))));
    const hg = scope ? [] : hookGroups(), sets = hg.length ? grpSets() : null;
    const q = sql => { try { return db.prepare(sql).all(); } catch (e) { return []; } };
    const depts = mv ? q('SELECT id, name FROM mv_department WHERE active = 1 ORDER BY sort, name').filter(d => !scope || scope.includes(d.id)) : [];
    const funcs = mv && !scope ? [...new Set(ppl.flatMap(p => p.funcs))].sort((a, b) => a.localeCompare(b, 'de')) : [];
    const fees = mv && !scope ? q("SELECT id, name FROM mv_fee WHERE active = 1 ORDER BY sort, name") : [];
    const count = g => ppl.filter(p => inGroup(p, g, sets)).length;
    const push = require('./push'), paired = pairedIds();
    res.json({
      ready: mail.ready(), from: mail.config().from, club: club(), mv, scoped: Boolean(scope), placeholders: PH,
      app: { all: scope ? null : ppl.filter(p => paired.has(p.id)).length, keepMonths: keepDefault(), keepChoices: KEEP, pushOn: push.enabled(PUSH_KEY) },
      groups: [
        ...(scope ? [] : Object.entries(STATUS).filter(([v]) => mv || v === 'aktuell').map(([v, l]) => ({ t: 'status', v, label: l, n: count({ t: 'status', v }) }))),
        ...hg.map(g => ({ t: 'grp', v: g.key, label: g.label, n: count({ t: 'grp', v: g.key }) })),
        ...depts.map(d => ({ t: 'dept', v: d.id, label: 'Abteilung ' + d.name, n: count({ t: 'dept', v: d.id }) })),
        ...funcs.map(f => ({ t: 'func', v: f, label: 'Amt: ' + f, n: count({ t: 'func', v: f }) })),
        ...fees.map(f => ({ t: 'fee', v: f.id, label: 'Beitrag: ' + f.name, n: count({ t: 'fee', v: f.id }) })),
      ].filter(g => g.n > 0 || g.t === 'status'),
      members: ppl.sort((a, b) => nameKey(a.name, a.kind).localeCompare(nameKey(b.name, b.kind), 'de')).map(p => ({ id: p.id, name: lastFirst(p.name), email: p.email || '', viaPayer: !p.email && Boolean(p.payer_id) })),
      lists: db.prepare('SELECT id, name, spec FROM mail_list ORDER BY name').all().map(l => ({ id: l.id, name: l.name, spec: cleanSpec(J(l.spec, {}), { lists: false }) })),
      templates: db.prepare('SELECT id, name, subject, html FROM mail_template ORDER BY name').all(),
      me: identity(req.user),
    });
  });
  /** Standard-Aufbewahrung in der App (Monate) */
  admin.put('/mail/settings', P, (req, res) => {
    const m = parseInt((req.body || {}).keepMonths, 10);
    if (!KEEP.includes(m)) return bad(res, 'Bitte einen der angebotenen Zeiträume wählen.');
    setSetting('msg_keep_months', String(m));
    audit(req.user, 'Nachrichten: Aufbewahrung in der App geändert', `${m} ${m === 1 ? 'Monat' : 'Monate'}`);
    res.json({ ok: true, keepMonths: m });
  });
  /* Absender je Benutzer */
  admin.put('/mail/me', P, (req, res) => {
    const b = req.body || {};
    const reply = one(b.reply_to, 120).toLowerCase();
    if (reply && !okMail(reply)) return bad(res, 'Die Antwortadresse sieht nicht gültig aus.');
    setSetting('mail_id_' + req.user.id, JSON.stringify({ name: one(b.name, 60), reply_to: reply, signature: clean(b.signature).slice(0, 5000), saved: 1 }));
    res.json({ ok: true, me: identity(req.user) });
  });

  /* Ordner */
  admin.get('/mail/messages', P, (req, res) => {
    const box = req.query.box === 'entwuerfe' ? 'entwuerfe' : 'gesendet';
    const rows = box === 'entwuerfe'
      ? db.prepare("SELECT * FROM mail_message WHERE status = 'entwurf' AND user_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 200").all(req.user.id)
      : db.prepare(`SELECT * FROM mail_message WHERE status != 'entwurf' ${seeAll(req) ? '' : 'AND user_id = ' + Number(req.user.id)} ORDER BY sent_at DESC LIMIT 300`).all();
    res.json({ rows: rows.map(m => ({ id: m.id, subject: m.subject, status: m.status, user_name: m.user_name, from_name: m.from_name, at: m.status === 'entwurf' ? (m.updated_at || m.created_at) : m.sent_at,
      total: m.total, sent: m.sent, failed: m.failed, files: J(m.files, []).length, preview: toText(m.html).slice(0, 140), channels: cleanChannels(m.channels), pinned: Boolean(m.pinned) })),
      drafts: db.prepare("SELECT COUNT(*) AS n FROM mail_message WHERE status = 'entwurf' AND user_id = ?").get(req.user.id).n });
  });
  admin.get('/mail/messages/:id', P, (req, res) => {
    const m = db.prepare('SELECT * FROM mail_message WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!visible(req, m)) return bad(res, 'Nicht gefunden.', 404);
    const rcpt = m.status === 'entwurf' ? [] : db.prepare("SELECT name, email, via, status, error, sent_at, member_id FROM mail_recipient WHERE message_id = ? AND COALESCE(via, '') != '__kopie' ORDER BY id").all(m.id);
    res.json({ ...out(m), rcpt: rcpt.map(({ member_id, ...r }) => r), waiting: rcpt.filter(r => r.status === 'wartet').length, ...(m.status === 'entwurf' ? {} : { reach: reachOf(m, rcpt), app: appStats(m) }) });
  });

  /* Entwürfe */
  const draftFields = b => {
    const f = {};
    if (b.subject !== undefined) f.subject = one(b.subject, 200);
    if (b.html !== undefined) f.html = clean(b.html);
    if (b.spec !== undefined) f.spec = JSON.stringify(cleanSpec(b.spec));
    if (b.copy_me !== undefined) f.copy_me = b.copy_me ? 1 : 0;
    if (b.channels !== undefined) f.channels = JSON.stringify(cleanChannels(b.channels));
    if (b.keep_months !== undefined) f.keep_months = KEEP.includes(parseInt(b.keep_months, 10)) ? parseInt(b.keep_months, 10) : null;
    if (b.pinned !== undefined) f.pinned = b.pinned ? 1 : 0;
    return f;
  };
  admin.post('/mail/drafts', P, (req, res) => {
    const b = req.body || {}, f = draftFields(b);
    const r = db.prepare('INSERT INTO mail_message(subject, html, spec, copy_me, channels, keep_months, pinned, user_id, user_name, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(f.subject || '', f.html || '', f.spec || '{}', f.copy_me == null ? 1 : f.copy_me, f.channels || '["mail"]', f.keep_months || null, f.pinned || 0, req.user.id, req.user.name || req.user.username, now());
    res.json({ ok: true, id: Number(r.lastInsertRowid) });
  });
  admin.put('/mail/drafts/:id', P, (req, res) => {
    const m = draftOf(req, res); if (!m) return;
    const f = draftFields(req.body || {});
    const keys = Object.keys(f);
    if (keys.length) db.prepare(`UPDATE mail_message SET ${keys.map(k => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).run(...keys.map(k => f[k]), now(), m.id);
    res.json({ ok: true });
  });
  admin.delete('/mail/drafts/:id', P, (req, res) => {
    const m = draftOf(req, res); if (!m) return;
    db.prepare('DELETE FROM mail_message WHERE id = ?').run(m.id); removeFiles(m.id);
    res.json({ ok: true });
  });
  /** Gesendete Mail als neuen Entwurf weiterverwenden (z. B. Erinnerung, gleiche Mail an andere) */
  admin.post('/mail/messages/:id/copy', P, (req, res) => {
    const m = db.prepare('SELECT * FROM mail_message WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!visible(req, m)) return bad(res, 'Nicht gefunden.', 404);
    const r = db.prepare('INSERT INTO mail_message(subject, html, spec, copy_me, channels, keep_months, pinned, user_id, user_name, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(m.subject, m.html, req.body && req.body.keepRecipients === false ? '{}' : m.spec, m.copy_me, m.channels, m.keep_months, m.pinned, req.user.id, req.user.name || req.user.username, now());
    const id = Number(r.lastInsertRowid);
    db.prepare('UPDATE mail_message SET files = ? WHERE id = ?').run(JSON.stringify(copyFiles(m.id, id)), id);
    res.json({ ok: true, id });
  });

  /* Anhänge */
  admin.post('/mail/drafts/:id/files', P, express.raw({ type: 'application/octet-stream', limit: MAX_FILE + 1024 }), (req, res) => {
    const m = draftOf(req, res); if (!m) return;
    const files = J(m.files, []);
    let name = 'Datei'; try { name = safeName(decodeURIComponent(String(req.get('X-Name') || 'Datei'))); } catch (e) { name = 'Datei'; }
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!buf.length) return bad(res, 'Die Datei ist leer.');
    if (buf.length > MAX_FILE) return bad(res, 'Eine Datei darf höchstens 10 MB groß sein.');
    if (BLOCK_EXT.test(name)) return bad(res, 'Programme und Skripte können nicht angehängt werden.');
    if (files.length >= MAX_FILES) return bad(res, `Höchstens ${MAX_FILES} Anhänge.`);
    if (files.reduce((s, f) => s + f.size, 0) + buf.length > MAX_TOTAL) return bad(res, 'Alle Anhänge zusammen höchstens 20 MB – viele Postfächer nehmen größere Mails nicht an.');
    // Datei kommt immer als application/octet-stream (sonst würde z. B. eine .json-Datei vorher als Anfrage gelesen), der echte Typ steht in X-Type
    const xt = String(req.get('X-Type') || '').toLowerCase();
    const f = { id: crypto.randomBytes(8).toString('hex'), name, size: buf.length, type: /^[a-z]+\/[a-z0-9.+-]+$/.test(xt) && !/html|javascript|xml/.test(xt) ? xt : 'application/octet-stream' };
    fs.mkdirSync(fileDir(m.id), { recursive: true });
    require('./vault').writeFile(filePath(m.id, f), buf);   // verschlüsselt, wenn der Tresor eingeschaltet ist
    files.push(f);
    db.prepare('UPDATE mail_message SET files = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(files), now(), m.id);
    res.json({ ok: true, file: f, files });
  });
  admin.delete('/mail/drafts/:id/files/:fid', P, (req, res) => {
    const m = draftOf(req, res); if (!m) return;
    const files = J(m.files, []), f = files.find(x => x.id === req.params.fid);
    if (!f) return bad(res, 'Anhang nicht gefunden.', 404);
    try { fs.unlinkSync(filePath(m.id, f)); } catch (e) { /* weg */ }
    db.prepare('UPDATE mail_message SET files = ? WHERE id = ?').run(JSON.stringify(files.filter(x => x.id !== f.id)), m.id);
    res.json({ ok: true });
  });
  admin.get('/mail/messages/:id/files/:fid', P, (req, res) => {
    const m = db.prepare('SELECT * FROM mail_message WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!visible(req, m)) return res.status(404).end();
    const f = J(m.files, []).find(x => x.id === req.params.fid);
    if (!f || !fs.existsSync(filePath(m.id, f))) return res.status(404).end();
    let buf; try { buf = require('./vault').readFile(filePath(m.id, f)); } catch (e) { return e.vaultLocked ? bad(res, e.message, 423) : res.status(404).end(); }
    res.set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(buf);
  });

  /* Vorschau und Versand */
  const check = (req, m) => {
    const errs = [], ch = cleanChannels(m.channels), mailOn = ch.includes('mail'), appOn = ch.includes('app'), spec = cleanSpec(J(m.spec, {}));
    if (one(m.subject, 200).length < 2) errs.push('Bitte einen Betreff eintragen.');
    if (plainLen(m.html) < 5) errs.push('Bitte einen Text schreiben.');
    const r = resolve(spec, req.user);
    if (!(mailOn ? r.rcpt.length : 0) && !(appOn ? r.app.length : 0)) errs.push('Bitte Empfänger wählen.');
    if (mailOn && r.rcpt.length > MAX_RCPT) errs.push(`Höchstens ${MAX_RCPT} Empfänger auf einmal.`);
    if (appOn && r.app.length > MAX_RCPT) errs.push(`Höchstens ${MAX_RCPT} Empfänger auf einmal.`);
    if (mailOn && r.bad.length) errs.push(`Ungültige Adresse: ${r.bad.slice(0, 3).join(', ')}`);
    if (!mailOn && spec.addresses.length) errs.push('Freie Adressen gehen nur per E-Mail – bitte den Weg „E-Mail“ wählen oder die Adressen entfernen.');
    if (spec.allApp && scopeOf(req.user)) errs.push('„Alle Mitglieder der App“ darf nur, wer nicht auf eine Abteilung beschränkt ist.');
    return { r, errs };
  };
  admin.post('/mail/drafts/:id/preview', P, (req, res) => {
    const m = draftOf(req, res); if (!m) return;
    const { r, errs } = check(req, m), me = identity(req.user), ch = cleanChannels(m.channels);
    const mailOn = ch.includes('mail'), first = r.rcpt[0];
    const firstApp = !first && r.app[0] ? { name: r.app[0].name, email: '', person: everyone().find(p => p.id === r.app[0].member_id) || null } : null;   // nur App: Beispiel mit dem ersten Mitglied
    const v = first ? vars(first) : firstApp ? vars(firstApp) : vars({ name: '', email: '' });
    const paired = pairedIds(), subs = new Set(db.prepare('SELECT DISTINCT member_id FROM push_subs').all().map(x => x.member_id));
    const push = require('./push');
    res.json({ count: mailOn ? r.rcpt.length : 0, without: mailOn ? r.without.slice(0, 100) : [], withoutCount: mailOn ? r.without.length : 0, bad: mailOn ? r.bad : [], errors: errs, channels: ch,
      rcpt: mailOn ? r.rcpt.slice(0, 2000).map(x => ({ name: x.name, email: x.email, via: x.via })) : [],
      app: ch.includes('app') ? { count: r.app.length, noDevice: r.app.filter(x => !paired.has(x.member_id)).length, push: ch.includes('push') ? r.app.filter(x => subs.has(x.member_id)).length : null, pushOn: push.enabled(PUSH_KEY),
        keepMonths: m.pinned ? null : (m.keep_months || keepDefault()), pinned: Boolean(m.pinned) } : null,
      from: `${me.name ? me.name + ' · ' : ''}${club()} <${mail.config().from || '–'}>`, reply_to: me.reply_to,
      sample: { to: first ? first.email : '', who: first ? first.email : firstApp ? firstApp.name : '', subject: fillText(m.subject, v), html: fillHtml(m.html, v) + sigBlock(me.signature) }, ready: mailOn ? mail.ready() : true });
  });
  admin.post('/mail/drafts/:id/send', P, (req, res) => {
    const m = draftOf(req, res); if (!m) return;
    const ch = cleanChannels(m.channels), mailOn = ch.includes('mail'), appOn = ch.includes('app');
    if (mailOn && !mail.ready()) return bad(res, 'Kein Postfach eingerichtet (Einstellungen → Postfach).');
    const { r, errs } = check(req, m);
    if (errs.length) return bad(res, errs[0]);
    const me = identity(req.user);
    if (mailOn && m.copy_me && !me.reply_to) return bad(res, 'Für „Kopie an mich“ bitte unter „Mein Konto“ deine E-Mail-Adresse eintragen – oder den Haken entfernen.');
    const sig = me.signature ? clean(me.signature) : '';
    const expires = !appOn || m.pinned ? null : addMonths(today(), m.keep_months || keepDefault());
    const total = mailOn ? r.rcpt.length : r.app.length;
    const tx = db.transaction(() => {
      if (mailOn) {
        const ins = db.prepare('INSERT INTO mail_recipient(message_id, member_id, name, email, via) VALUES (?,?,?,?,?)');
        for (const x of r.rcpt) ins.run(m.id, x.member_id, x.name, x.email, x.via);
        if (m.copy_me) ins.run(m.id, null, me.name || 'Kopie', me.reply_to, '__kopie');
      }
      if (appOn) { const ins = db.prepare('INSERT OR IGNORE INTO msg_inbox(message_id, member_id) VALUES (?,?)'); for (const x of r.app) ins.run(m.id, x.member_id); }
      db.prepare("UPDATE mail_message SET status = ?, sent_at = ?, total = ?, sent = ?, from_name = ?, reply_to = ?, html = ?, user_name = ?, expires_at = ?, pinned = ? WHERE id = ?")
        .run(mailOn ? 'sendet' : 'gesendet', now(), total, mailOn ? 0 : total, me.name || null, me.reply_to || null, m.html, req.user.name || req.user.username, expires, appOn && m.pinned ? 1 : 0, m.id);
    });
    tx();
    // Unterschrift gehört zur gesendeten Mail (spätere Änderungen am Absender ändern sie nicht)
    db.prepare('UPDATE mail_message SET signature_html = ? WHERE id = ?').run(sig || null, m.id);
    const ways = [mailOn && 'E-Mail', appOn && 'App', ch.includes('push') && 'Push'].filter(Boolean).join(', ');
    audit(req.user, 'Nachricht gesendet', `Nr. ${m.id} · ${ways} · ${total} Empfänger${J(m.files, []).length ? `, ${J(m.files, []).length} Anhang/Anhänge` : ''}`);   // ohne Inhalt und Betreff
    if (mailOn) setImmediate(() => work(m.id));
    if (ch.includes('push')) setImmediate(() => pushOut(m.id).catch(e => console.error('Nachrichten: Push', e.message)));
    res.json({ ok: true, count: total, without: mailOn ? r.without.length : 0, app: appOn ? r.app.length : 0 });
  });
  /** Nachricht in der App anheften / lösen oder aus der App nehmen (bei den Mitgliedern verschwindet sie sofort; E-Mails bleiben natürlich) */
  admin.post('/mail/messages/:id/app', P, (req, res) => {
    const m = db.prepare('SELECT * FROM mail_message WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!visible(req, m) || m.status === 'entwurf' || !cleanChannels(m.channels).includes('app')) return bad(res, 'Nicht gefunden.', 404);
    const b = req.body || {};
    if (b.remove) {
      const c = db.prepare('SELECT COUNT(*) AS total, SUM(read_at IS NOT NULL) AS opened FROM msg_inbox WHERE message_id = ?').get(m.id);
      db.transaction(() => {
        if (c.total) db.prepare('UPDATE mail_message SET app_stats = ? WHERE id = ?').run(JSON.stringify({ total: c.total, opened: c.opened || 0 }), m.id);
        db.prepare('UPDATE mail_message SET pinned = 0, expires_at = ? WHERE id = ?').run(addMonths(today(), -1), m.id);
        db.prepare('DELETE FROM msg_inbox WHERE message_id = ?').run(m.id);
      })();
      audit(req.user, 'Nachricht aus der App genommen', `Nr. ${m.id}`);
    } else if (b.pinned !== undefined) {
      if (b.pinned && !db.prepare('SELECT 1 FROM msg_inbox WHERE message_id = ? LIMIT 1').get(m.id)) return bad(res, 'Die Nachricht ist in der App schon abgelaufen oder entfernt.');
      db.prepare('UPDATE mail_message SET pinned = ?, expires_at = ? WHERE id = ?').run(b.pinned ? 1 : 0, b.pinned ? null : addMonths(today(), m.keep_months || keepDefault()), m.id);
      audit(req.user, b.pinned ? 'Nachricht in der App angeheftet' : 'Nachricht in der App gelöst', `Nr. ${m.id}`);
    } else return bad(res, 'Nichts zu tun.');
    res.json({ ok: true, app: appStats(db.prepare('SELECT * FROM mail_message WHERE id = ?').get(m.id)) });
  });
  /** fehlgeschlagene Empfänger noch einmal versuchen */
  admin.post('/mail/messages/:id/retry', P, (req, res) => {
    const m = db.prepare('SELECT * FROM mail_message WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!visible(req, m) || m.status !== 'teilweise') return bad(res, 'Nichts zu wiederholen.');
    if (!mail.ready()) return bad(res, 'Kein Postfach eingerichtet (Einstellungen → Postfach).');
    const n = db.prepare("UPDATE mail_recipient SET status = 'wartet', error = NULL WHERE message_id = ? AND status = 'fehler'").run(m.id).changes;
    db.prepare("UPDATE mail_message SET status = 'sendet' WHERE id = ?").run(m.id);
    audit(req.user, 'E-Mail erneut gesendet', `„${m.subject}“ an ${n} Empfänger`);
    setImmediate(() => work(m.id));
    res.json({ ok: true, n });
  });
  admin.delete('/mail/messages/:id', P, (req, res) => {
    const m = db.prepare('SELECT * FROM mail_message WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!m || m.status === 'entwurf' || m.status === 'sendet' || !(mine(req, m) || req.user.role === 'oberadmin')) return bad(res, 'Löschen kann nur, wer die Mail geschrieben hat.', 403);
    db.prepare('DELETE FROM mail_recipient WHERE message_id = ?').run(m.id);
    db.prepare('DELETE FROM msg_inbox WHERE message_id = ?').run(m.id);
    db.prepare('DELETE FROM mail_message WHERE id = ?').run(m.id); removeFiles(m.id);
    audit(req.user, 'Nachricht aus „Gesendet“ gelöscht', `Nr. ${m.id}`);
    res.json({ ok: true });
  });

  /* Verteiler und Vorlagen (für alle mit dem Recht gemeinsam) */
  const crud = (table, fields, label) => {
    admin.post(`/mail/${table === 'mail_list' ? 'lists' : 'templates'}`, P, (req, res) => {
      const f = fields(req.body || {}); if (f.error) return bad(res, f.error);
      const keys = Object.keys(f);
      const r = db.prepare(`INSERT INTO ${table}(${keys.join(', ')}, updated_by, updated_at) VALUES (${keys.map(() => '?').join(',')},?,?)`).run(...keys.map(k => f[k]), req.user.name || req.user.username, now());
      audit(req.user, `E-Mail: ${label} angelegt`, f.name);
      res.json({ ok: true, id: Number(r.lastInsertRowid) });
    });
    admin.put(`/mail/${table === 'mail_list' ? 'lists' : 'templates'}/:id`, P, (req, res) => {
      const f = fields(req.body || {}); if (f.error) return bad(res, f.error);
      const keys = Object.keys(f);
      const n = db.prepare(`UPDATE ${table} SET ${keys.map(k => k + ' = ?').join(', ')}, updated_by = ?, updated_at = ? WHERE id = ?`).run(...keys.map(k => f[k]), req.user.name || req.user.username, now(), parseInt(req.params.id, 10)).changes;
      if (!n) return bad(res, 'Nicht gefunden.', 404);
      res.json({ ok: true });
    });
    admin.delete(`/mail/${table === 'mail_list' ? 'lists' : 'templates'}/:id`, P, (req, res) => {
      const r = db.prepare(`SELECT name FROM ${table} WHERE id = ?`).get(parseInt(req.params.id, 10));
      if (!r) return bad(res, 'Nicht gefunden.', 404);
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(parseInt(req.params.id, 10));
      audit(req.user, `E-Mail: ${label} gelöscht`, r.name);
      res.json({ ok: true });
    });
  };
  crud('mail_list', b => {
    const name = one(b.name, 60); if (name.length < 2) return { error: 'Bitte einen Namen für den Verteiler eintragen.' };
    const spec = cleanSpec(b.spec, { lists: false });
    if (!spec.groups.length && !spec.members.length && !spec.addresses.length) return { error: 'Der Verteiler ist leer.' };
    const badA = spec.addresses.map(parseAddr).filter(x => x && x.bad);
    if (badA.length) return { error: `Ungültige Adresse: ${badA[0].bad}` };
    return { name, spec: JSON.stringify(spec) };
  }, 'Verteiler');
  crud('mail_template', b => {
    const name = one(b.name, 60); if (name.length < 2) return { error: 'Bitte einen Namen für die Vorlage eintragen.' };
    return { name, subject: one(b.subject, 200), html: clean(b.html) };
  }, 'Vorlage');
}

module.exports = { routes, clean, toText, resolve, DIR, oldSent, purgeSent, cleanChannels, inApp, fillHtml, fillText, vars, filePath, J, PUSH_KEY, everyone, club, sigBlock };
