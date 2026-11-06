'use strict';
/* =====================================================================================================
   Modul „Schlüssel“ (Stufe 1, planung/schluessel.md)
   Bestand (Sorte mit mehreren Stück), Ausgabe mit Unterschrift beider Seiten (Verwaltung auf jedem Gerät oder Vereinstablet mit 6-stelligem Code),
   eingefrorene Bedingungen, PDF einmal gebaut (Tresor, Prüfwert), Rücknahme, Verlust, Storno mit eigenem Protokoll, Sicherheitswarnung bei Verlust.
   Pfand und Kosten werden nur quittiert (kein offener Posten – das kommt in Stufe 2).
   ===================================================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const konfigio = require('../../src/konfigio');
const { today, nowTs, deD, isDate, sigOk } = require('../../src/util');
const pdf = require('./lib/pdf');

const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f<>]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const one = (v, max) => txt(v, max).replace(/\n/g, ' ');
const KINDS = { schluessel: 'Schlüssel', transponder: 'Transponder/Chip', karte: 'Karte', sonstiges: 'Sonstiges' };
const PIECE_FREE = ['vorraetig', 'gesperrt', 'ausgemustert'];
const DEFAULT_TERMS = [
  '1. Der Schlüssel bleibt Eigentum des {Verein}. Er ist nur für mich bestimmt und für Vereinszwecke zu nutzen.',
  '2. Ich gebe ihn nicht an andere weiter und lasse ihn nicht nachmachen. Ich bewahre ihn sorgfältig auf und kennzeichne ihn nicht mit der Anschrift des Vereins.',
  '3. Einen Verlust oder Diebstahl melde ich unverzüglich dem Vorstand.',
  '4. Bei Verlust aus eigenem Verschulden trage ich die Kosten für Ersatz und, wenn die Sicherheit es verlangt, für den Umbau der Schließanlage – höchstens {Höchstbetrag}.',
  '5. Ich gebe den Schlüssel bei Austritt, Ende meiner Aufgabe oder auf Verlangen des Vorstands unverzüglich zurück. Ein Pfand wird bei vollständiger Rückgabe erstattet.',
  '6. Meine Angaben speichert der Verein für die Dauer der Ausgabe und danach höchstens {Frist} (Datenschutzhinweis des Vereins).',
].join('\n');

function activate(ctx) {
  const { db, need, bad, int, audit } = ctx;
  db.exec(`
CREATE TABLE IF NOT EXISTS sl_type (id INTEGER PRIMARY KEY AUTOINCREMENT, ident TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'schluessel', opens TEXT, deposit_cents INTEGER NOT NULL DEFAULT 0,
  sensitive INTEGER NOT NULL DEFAULT 0, note TEXT, sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS sl_piece (id INTEGER PRIMARY KEY AUTOINCREMENT, type_id INTEGER NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'vorraetig', note TEXT);   -- vorraetig | reserviert | ausgegeben | verloren | gesperrt | ausgemustert
CREATE INDEX IF NOT EXISTS ix_sl_piece_type ON sl_piece(type_id, status);
CREATE TABLE IF NOT EXISTS sl_template (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, text TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sl_issue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER,                                  -- Konto (ohne Fremdschlüssel: Zusammenführen/Löschen regelt der Hook memberRemoved)
  ext_first TEXT, ext_last TEXT, ext_birth TEXT, contact TEXT,   -- Person ohne Clubwerk-Konto (im Tresor)
  guardian_name TEXT,
  status TEXT NOT NULL DEFAULT 'wartet',              -- wartet | ausgegeben | zurueck | storniert
  legacy INTEGER NOT NULL DEFAULT 0, legacy_no TEXT,  -- übernommen aus der Mitgliederverwaltung, noch ohne Protokoll
  issued_by TEXT, issued_at TEXT, due TEXT,
  deposit_cents INTEGER NOT NULL DEFAULT 0, deposit_state TEXT NOT NULL DEFAULT '',   -- '' | gehalten | zurueck | einbehalten
  cost_cents INTEGER NOT NULL DEFAULT 0,
  template_id INTEGER, code_hash TEXT, code_expires INTEGER, closed_at TEXT, remind_at TEXT, created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE INDEX IF NOT EXISTS ix_sl_issue_member ON sl_issue(member_id, status);
CREATE TABLE IF NOT EXISTS sl_issue_piece (issue_id INTEGER NOT NULL, piece_id INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'reserviert', back_at TEXT, cond TEXT, PRIMARY KEY(issue_id, piece_id));   -- reserviert | ausgegeben | zurueck | verloren | storniert
CREATE TABLE IF NOT EXISTS sl_protocol (
  id INTEGER PRIMARY KEY AUTOINCREMENT, no TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,   -- ausgabe | rueckgabe | verlust | storno
  issue_id INTEGER NOT NULL, ref_id INTEGER, at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'gueltig',   -- gueltig | storniert
  terms TEXT, data TEXT NOT NULL DEFAULT '{}', sig_a TEXT, sig_b TEXT, sig_c TEXT, sha256 TEXT NOT NULL, file TEXT, by_user TEXT);
CREATE INDEX IF NOT EXISTS ix_sl_protocol_issue ON sl_protocol(issue_id);
`);
  const vault = ctx.require('./vault');
  const { lastFirst } = ctx.require('./db');
  const DIR = path.join(ctx.require('./db').DATA_DIR, 'belege', 'schluessel');
  const P = need('schluessel');
  const A = ctx.admin, T = ctx.tablet;
  const S = (k, d) => ctx.getSetting('ext_schluessel_' + k, d);
  const SET = (k, v) => ctx.setSetting('ext_schluessel_' + k, String(v));
  const clubName = () => ctx.getSetting('club_name', 'Verein');
  const mitgl = () => ctx.isModuleActive('mitglieder');
  const hook1 = (name, ...a) => { const r = ctx.callHooksSync(name, ...a).map(x => x.result).find(x => x != null); return r; };
  const cfg = () => ({ max_cost_cents: Math.min(1000000, Math.max(0, int(S('max_cost_cents', '5000')))), keep_ohnepfand: Math.min(120, Math.max(12, int(S('keep_ohnepfand', '36')) || 36)),
    keep_mitpfand: Math.min(120, Math.max(12, int(S('keep_mitpfand', '120')) || 120)), mail_on: S('mail_on', '1') === '1', cc: S('cc', '') });
  const CFG_LABELS = { max_cost_cents: ['Höchstbetrag bei Verlust', 'euro'], keep_ohnepfand: 'Aufbewahrung ohne Pfand (Monate)', keep_mitpfand: 'Aufbewahrung mit Pfand oder Kosten (Monate)', mail_on: ['E-Mail mit PDF an die Person', 'bool'], cc: 'Kopie an' };
  const euro = c => ((c || 0) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const mailOk = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || ''));
  const ageAt = (birth, on) => { const b = String(birth || '').split('-').map(Number), o = String(on).split('-').map(Number); if (b.length < 3) return 99; let a = o[0] - b[0]; if (o[1] < b[1] || (o[1] === b[1] && o[2] < b[2])) a--; return a; };
  const send = fn => async (req, res) => { try { res.json(await fn(req, res)); } catch (e) { if (!res.headersSent) bad(res, e.message, e.code || 400); } };
  const fail = (msg, code) => Object.assign(new Error(msg), code ? { code } : {});

  if (!db.prepare('SELECT 1 FROM sl_template LIMIT 1').get()) db.prepare('INSERT INTO sl_template(name, text, sort) VALUES (?,?,0)').run('Standard', DEFAULT_TERMS);

  /* ---------- Hilfen: Personen, Stücke, Nummern ---------- */
  const memberRow = id => id ? db.prepare('SELECT id, name, kind FROM members WHERE id = ? AND deleted = 0').get(id) : null;
  const personName = i => { if (i.member_id) { const m = db.prepare('SELECT name, kind FROM members WHERE id = ?').get(i.member_id); return m ? lastFirst(m.name, m.kind) : 'Gelöschtes Konto'; } return `${i.ext_last || ''}, ${i.ext_first || ''}`.replace(/^, |, $/g, '') || 'Unbekannt'; };
  const personBirth = i => { if (i.member_id) { const r = mitgl() ? hook1('memberInfo', i.member_id) : null; return r && r.birth_date || ''; } return i.ext_birth || ''; };
  const memberInfo = id => (mitgl() && id ? hook1('memberInfo', id) : null) || null;
  const stateOf = i => { if (!i.member_id) return null; const r = memberInfo(i.member_id); return r && (r.status === 'ausgetreten' || r.exit_date) ? r : null; };
  async function emailOf(i) {
    if (i.member_id) { if (!mitgl()) return ''; const a = (await ctx.callHooks('memberAddress', i.member_id)).map(x => x.result).find(Boolean); return a && mailOk(a.email) && !/@clubwerk\.invalid$/i.test(a.email) ? a.email : ''; }
    return mailOk(i.contact) ? i.contact : '';
  }
  const clubInfo = () => { const c = (mitgl() && hook1('clubInfo')) || {}; return { name: clubName(), street: c.street || '', city: c.city || '' }; };
  const itemsOf = issueId => db.prepare(`SELECT ip.piece_id AS id, ip.state, ip.back_at, ip.cond, p.label, p.status AS pstatus, t.id AS type_id, t.ident, t.name, t.kind, t.opens, t.sensitive FROM sl_issue_piece ip
    JOIN sl_piece p ON p.id = ip.piece_id JOIN sl_type t ON t.id = p.type_id WHERE ip.issue_id = ? ORDER BY t.sort, t.ident, p.label`).all(issueId);
  const pieceText = it => `${pdf.itemNo(it)} ${it.name}`;
  function nextNo() {
    const y = today().slice(0, 4), key = 'cnt_' + y;
    const n = Math.max(int(S(key, '0')), (db.prepare("SELECT MAX(CAST(substr(no, 8) AS INTEGER)) n FROM sl_protocol WHERE no LIKE ?").get(`S-${y}-%`).n || 0)) + 1;
    SET(key, n);
    return `S-${y}-${String(n).padStart(3, '0')}`;
  }
  const renderTerms = text => String(text || '').replace(/\{Verein\}/g, clubName()).replace(/\{Höchstbetrag\}/g, euro(cfg().max_cost_cents))
    .replace(/\{Frist\}/g, `${Math.round(cfg().keep_ohnepfand / 12)} ${Math.round(cfg().keep_ohnepfand / 12) === 1 ? 'Jahr' : 'Jahre'}`);
  function savePdf(buf) {
    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
    const file = `sl-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}.pdf`;
    vault.writeFile(path.join(DIR, file), buf);
    return file;
  }
  const fileOk = f => /^sl-[a-z0-9]+-[a-f0-9]{10}\.pdf$/.test(String(f || ''));
  const dropFile = f => { if (fileOk(f)) try { fs.unlinkSync(path.join(DIR, f)); } catch (e) { /* schon weg */ } };
  const hashOf = o => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
  const sigsOf = (b, need3) => {
    if (!sigOk(b.sig_receiver)) throw fail('Bitte die Unterschrift der Empfängerin / des Empfängers leisten.');
    if (!sigOk(b.sig_giver)) throw fail('Bitte die Unterschrift der ausgebenden Person leisten.');
    if (need3 && !sigOk(b.sig_guardian)) throw fail('Bitte die Unterschrift der/des Erziehungsberechtigten leisten.');
    return [b.sig_receiver, b.sig_giver, need3 ? b.sig_guardian : null];
  };

  /* ---------- Bestand ---------- */
  const typeRow = t => { const c = db.prepare("SELECT status, COUNT(*) n FROM sl_piece WHERE type_id = ? GROUP BY status").all(t.id).reduce((m, r) => (m[r.status] = r.n, m), {});
    const total = Object.entries(c).filter(([k]) => k !== 'ausgemustert').reduce((s, [, n]) => s + n, 0);
    return { id: t.id, ident: t.ident, name: t.name, kind: t.kind, kind_label: KINDS[t.kind], opens: t.opens || '', deposit_cents: t.deposit_cents, sensitive: Boolean(t.sensitive), note: t.note || '',
      total, free: c.vorraetig || 0, out: (c.ausgegeben || 0) + (c.reserviert || 0), lost: c.verloren || 0, locked: c.gesperrt || 0, retired: c.ausgemustert || 0 }; };
  const TYPE_LABELS = { ident: 'Kennung', name: 'Bezeichnung', kind: 'Art', opens: 'Schließt', deposit_cents: ['Pfand', 'euro'], sensitive: ['Sicherheitsrelevant', 'bool'], note: ['Notiz', 'text'] };
  function typeInput(b, cur) {
    const v = { ident: b.ident === undefined ? (cur && cur.ident) : one(b.ident, 20), name: b.name === undefined ? (cur && cur.name) : one(b.name, 80), kind: b.kind === undefined ? (cur ? cur.kind : 'schluessel') : String(b.kind),
      opens: b.opens === undefined ? (cur ? cur.opens : '') : one(b.opens, 200), deposit_cents: b.deposit_cents === undefined ? (cur ? cur.deposit_cents : 0) : int(b.deposit_cents),
      sensitive: b.sensitive === undefined ? (cur ? cur.sensitive : 0) : (b.sensitive ? 1 : 0), note: b.note === undefined ? (cur ? cur.note : '') : txt(b.note, 500) };
    if (!v.ident) throw fail('Bitte eine Kennung eintragen (z. B. 08 oder T-14).');
    if (!v.name || v.name.length < 2) throw fail('Bitte eine Bezeichnung eintragen.');
    if (!KINDS[v.kind]) throw fail('Unbekannte Art.');
    if (!(v.deposit_cents >= 0 && v.deposit_cents <= 100000)) throw fail('Das Pfand muss zwischen 0 und 1000 € liegen.');
    if (db.prepare('SELECT 1 FROM sl_type WHERE lower(ident) = lower(?) AND id != ?').get(v.ident, cur ? cur.id : 0)) throw fail(`Die Kennung „${v.ident}“ gibt es schon.`);
    return v;
  }
  A.get('/types', P, (req, res) => res.json({ list: db.prepare('SELECT * FROM sl_type ORDER BY sort, ident COLLATE NOCASE').all().map(typeRow) }));
  A.post('/types', P, send(req => {
    const b = req.body || {}, v = typeInput(b, null), count = Math.min(200, Math.max(1, int(b.count) || 1));
    const labels = Array.isArray(b.labels) ? b.labels.map(x => one(x, 20)) : [];
    const id = db.transaction(() => {
      const tid = Number(db.prepare('INSERT INTO sl_type(ident, name, kind, opens, deposit_cents, sensitive, note, sort) VALUES (?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sort), 0) + 1 FROM sl_type))').run(v.ident, v.name, v.kind, v.opens || null, v.deposit_cents, v.sensitive, v.note || null).lastInsertRowid);
      for (let n = 1; n <= count; n++) db.prepare('INSERT INTO sl_piece(type_id, label) VALUES (?,?)').run(tid, labels[n - 1] || (count === 1 ? v.ident : `${v.ident}-${n}`));
      return tid;
    })();
    audit(req.user, 'Schlüssel: Sorte angelegt', `Nr. ${v.ident} ${v.name} (${count} Stück)`);
    return { id };
  }));
  A.put('/types/:id', P, send(req => {
    const cur = db.prepare('SELECT * FROM sl_type WHERE id = ?').get(int(req.params.id)); if (!cur) throw fail('Sorte nicht gefunden.', 404);
    const v = typeInput(req.body || {}, cur);
    db.prepare('UPDATE sl_type SET ident = ?, name = ?, kind = ?, opens = ?, deposit_cents = ?, sensitive = ?, note = ? WHERE id = ?').run(v.ident, v.name, v.kind, v.opens || null, v.deposit_cents, v.sensitive, v.note || null, cur.id);
    const diff = ctx.auditDiff(TYPE_LABELS, { ...cur, kind: KINDS[cur.kind] }, { ...v, kind: KINDS[v.kind] });
    if (diff) audit(req.user, 'Schlüssel: Sorte geändert', `Nr. ${v.ident} ${v.name}: ${diff}`);
    return { ok: true };
  }));
  A.delete('/types/:id', P, send(req => {
    const t = db.prepare('SELECT * FROM sl_type WHERE id = ?').get(int(req.params.id)); if (!t) return { ok: true };
    if (db.prepare('SELECT 1 FROM sl_issue_piece ip JOIN sl_piece p ON p.id = ip.piece_id WHERE p.type_id = ?').get(t.id)) throw fail('Zu dieser Sorte gibt es Protokolle – sie lässt sich nur noch ausmustern (alle Stück ausmustern), nicht löschen.');
    db.transaction(() => { db.prepare('DELETE FROM sl_piece WHERE type_id = ?').run(t.id); db.prepare('DELETE FROM sl_type WHERE id = ?').run(t.id); })();
    audit(req.user, 'Schlüssel: Sorte gelöscht', `Nr. ${t.ident} ${t.name}`);
    return { ok: true };
  }));
  A.get('/pieces', P, (req, res) => {
    const tid = int(req.query.type);
    res.json({ list: db.prepare('SELECT * FROM sl_piece WHERE type_id = ? ORDER BY id').all(tid).map(p => ({ id: p.id, label: p.label, status: p.status, note: p.note || '' })) });
  });
  A.post('/types/:id/pieces', P, send(req => {
    const t = db.prepare('SELECT * FROM sl_type WHERE id = ?').get(int(req.params.id)); if (!t) throw fail('Sorte nicht gefunden.', 404);
    const n = int((req.body || {}).count); if (!(n >= 1 && n <= 100)) throw fail('Bitte 1 bis 100 Stück eintragen.');
    const have = db.prepare('SELECT COUNT(*) n FROM sl_piece WHERE type_id = ?').get(t.id).n;
    db.transaction(() => { for (let i = 1; i <= n; i++) db.prepare('INSERT INTO sl_piece(type_id, label) VALUES (?,?)').run(t.id, `${t.ident}-${have + i}`); })();
    audit(req.user, 'Schlüssel: Stück ergänzt', `Nr. ${t.ident} ${t.name}: ${n} Stück`);
    return { ok: true };
  }));
  A.put('/pieces/:id', P, send(req => {
    const p = db.prepare('SELECT * FROM sl_piece WHERE id = ?').get(int(req.params.id)); if (!p) throw fail('Stück nicht gefunden.', 404);
    const b = req.body || {};
    if (b.status !== undefined) {
      if (!PIECE_FREE.includes(String(b.status))) throw fail('Das Stück kann nur auf „vorrätig“, „gesperrt“ oder „ausgemustert“ gesetzt werden.');
      if (!PIECE_FREE.includes(p.status) && p.status !== 'verloren') throw fail('Das Stück ist ausgegeben – bitte erst zurücknehmen.');
    }
    const label = b.label === undefined ? p.label : one(b.label, 20); if (!label) throw fail('Bitte eine Nummer eintragen.');
    db.prepare('UPDATE sl_piece SET label = ?, status = ?, note = ? WHERE id = ?').run(label, b.status === undefined ? p.status : String(b.status), b.note === undefined ? p.note : (txt(b.note, 200) || null), p.id);
    const t = db.prepare('SELECT ident, name FROM sl_type WHERE id = ?').get(p.type_id);
    if (b.status !== undefined && b.status !== p.status) audit(req.user, 'Schlüssel: Stück geändert', `Nr. ${t.ident} ${t.name} (${label}): ${p.status} → ${b.status}`);
    return { ok: true };
  }));

  /* ---------- Bedingungsvorlagen und Einstellungen ---------- */
  const tplIn = b => { const name = one(b.name, 60), text = txt(b.text, 6000); if (name.length < 2) throw fail('Bitte einen Namen für die Vorlage eintragen.'); if (text.length < 10) throw fail('Bitte den Text der Bedingungen eintragen.'); return { name, text }; };
  A.get('/templates', P, (req, res) => res.json({ list: db.prepare('SELECT id, name, text FROM sl_template ORDER BY sort, id').all(), placeholders: ['{Verein}', '{Höchstbetrag}', '{Frist}'] }));
  A.post('/templates', P, send(req => { const v = tplIn(req.body || {}); const id = Number(db.prepare('INSERT INTO sl_template(name, text, sort) VALUES (?,?,(SELECT COALESCE(MAX(sort), 0) + 1 FROM sl_template))').run(v.name, v.text).lastInsertRowid); audit(req.user, 'Schlüssel: Vorlage angelegt', v.name); return { id }; }));
  A.put('/templates/:id', P, send(req => {
    const cur = db.prepare('SELECT * FROM sl_template WHERE id = ?').get(int(req.params.id)); if (!cur) throw fail('Vorlage nicht gefunden.', 404);
    const v = tplIn(req.body || {}); db.prepare('UPDATE sl_template SET name = ?, text = ? WHERE id = ?').run(v.name, v.text, cur.id);
    const diff = ctx.auditDiff({ name: 'Name', text: ['Text', 'text'] }, cur, v); if (diff) audit(req.user, 'Schlüssel: Vorlage geändert', `${v.name}: ${diff}`);
    return { ok: true };
  }));
  A.delete('/templates/:id', P, send(req => {
    if (db.prepare('SELECT COUNT(*) n FROM sl_template').get().n <= 1) throw fail('Mindestens eine Vorlage muss bleiben.');
    const t = db.prepare('SELECT * FROM sl_template WHERE id = ?').get(int(req.params.id)); if (!t) return { ok: true };
    db.prepare('DELETE FROM sl_template WHERE id = ?').run(t.id); audit(req.user, 'Schlüssel: Vorlage gelöscht', t.name); return { ok: true };
  }));
  A.get('/settings', P, (req, res) => res.json({ cfg: cfg(), mailReady: ctx.mail.ready(), mitglieder: mitgl() }));
  A.put('/settings', P, send(req => {
    const b = req.body || {}, before = cfg();
    if (b.max_cost_cents !== undefined) { const n = int(b.max_cost_cents); if (!(n >= 0 && n <= 1000000)) throw fail('Der Höchstbetrag muss zwischen 0 und 10 000 € liegen.'); SET('max_cost_cents', n); }
    for (const k of ['keep_ohnepfand', 'keep_mitpfand']) if (b[k] !== undefined) { const n = int(b[k]); if (!(n >= 12 && n <= 120)) throw fail('Die Aufbewahrung liegt zwischen 12 und 120 Monaten (1 bis 10 Jahre).'); SET(k, n); }
    if (b.mail_on !== undefined) SET('mail_on', b.mail_on ? '1' : '0');
    if (b.cc !== undefined) { const c = String(b.cc || '').trim(); if (c && !mailOk(c)) throw fail('Bitte eine gültige E-Mail-Adresse für die Kopie eintragen.'); SET('cc', c); }
    const diff = ctx.auditDiff(CFG_LABELS, before, cfg()); if (diff) audit(req.user, 'Schlüssel: Einstellungen geändert', diff);
    return { ok: true, cfg: cfg() };
  }));

  const sh = { ctx, A, T, P, db, S, SET, cfg, send, fail, txt, one, euro, mailOk, ageAt, memberRow, personName, personBirth, memberInfo, stateOf, emailOf, clubInfo, itemsOf, pieceText, nextNo,
    renderTerms, savePdf, fileOk, dropFile, hashOf, sigsOf, vault, DIR, pdf, mitgl, hook1, KINDS, lastFirst, today, nowTs, deD, isDate, sigOk, int };
  require('./lib/ablauf').register(sh);
  require('./lib/hooks').register(sh);
}

exports.activate = activate;
