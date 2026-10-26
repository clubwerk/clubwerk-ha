'use strict';
/* =====================================================================================================
   Modul „Mängelmelder“
   Mitglieder melden in der Mitglieder-App oder am Tablet (mit PIN) Defekte auf der Anlage: Ort, Beschreibung, bis zu 3 Fotos, „dringend“.
   Vor dem Absenden sieht das Mitglied offene Meldungen zum selben Ort (ohne Namen). „Ja, das ist es“ legt keine neue Meldung an,
   sondern zählt bei der vorhandenen „auch gemeldet“ hoch (je Mitglied einmal) – das Mitglied bekommt dann auch deren Statusmeldungen.
   Die Verwaltung (Recht „maengel“) setzt Status, antwortet dem Melder, schreibt interne Notizen und weist Zuständige zu.
   Fotos liegen verschlüsselt im Tresor (Ordner fotos/maengel), erledigte Meldungen werden nach einer einstellbaren Frist gelöscht.
   ===================================================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { today } = require('../../src/util');

const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f<>]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const STATUS = { neu: 'Neu', arbeit: 'In Arbeit', erledigt: 'Erledigt', abgelehnt: 'Abgelehnt/Doppelt' };
const OPEN = ['neu', 'arbeit'];
const MAX_PHOTOS = 3, PHOTO_MAX = 380 * 1024, THUMB_MAX = 40 * 1024, DAY_MAX = 10;

function activate(ctx) {
  const { db, need, bad, int, audit } = ctx;
  db.exec(`
CREATE TABLE IF NOT EXISTS mg_place (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS mg_report (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER,                                   -- Melder (ohne Fremdschlüssel: beim Löschen des Kontos bleibt die Meldung ohne Namen)
  place TEXT NOT NULL, text TEXT NOT NULL, urgent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'neu',                  -- neu | arbeit | erledigt | abgelehnt
  answer TEXT, note TEXT, assignee INTEGER,            -- Antwort an den Melder, interne Notiz, Zuständige/r (admin_users.id)
  source TEXT NOT NULL DEFAULT 'app',                  -- app | tablet
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), updated_at TEXT, done_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_mg_report_status ON mg_report(status, place);
CREATE TABLE IF NOT EXISTS mg_photo (id INTEGER PRIMARY KEY AUTOINCREMENT, report_id INTEGER NOT NULL, file TEXT NOT NULL, thumb TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE INDEX IF NOT EXISTS ix_mg_photo_report ON mg_photo(report_id);
CREATE TABLE IF NOT EXISTS mg_also (report_id INTEGER NOT NULL, member_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY(report_id, member_id));
`);
  const vault = ctx.require('./vault');
  const { lastFirst } = ctx.require('./db');
  const DIR = path.join(ctx.require('./db').DATA_DIR, 'fotos', 'maengel');   // unter „fotos“: Tresor und Komplettsicherung erfassen den Ordner mit
  const P = need('maengel');
  const S = (k, d) => ctx.getSetting('ext_maengel_' + k, d);
  const SET = (k, v) => ctx.setSetting('ext_maengel_' + k, String(v));
  const cfg = () => ({ keep_months: Math.min(120, Math.max(1, int(S('keep_months', '12')) || 12)), mail_on: S('mail_on', '1') === '1', notify: S('notify', '') });
  const CFG_LABELS = { keep_months: 'Erledigte Meldungen löschen nach (Monaten)', mail_on: ['E-Mail bei neuen Meldungen', 'bool'], notify: 'Weitere E-Mail-Empfänger' };
  const clubName = () => ctx.getSetting('club_name', 'Verein');

  /* ---------- Orte: Plätze aus dem Buchungssystem (wenn aktiv) + eigene Orte ---------- */
  const ownPlaces = () => db.prepare('SELECT name FROM mg_place ORDER BY sort, id').all().map(r => r.name);
  function places() {
    const out = [], seen = new Set();
    const add = n => { const k = String(n || '').trim().toLowerCase(); if (k && !seen.has(k)) { seen.add(k); out.push(String(n).trim()); } };
    for (const r of ctx.callHooksSync('placeNames')) for (const n of (Array.isArray(r.result) ? r.result : [])) add(n);
    ownPlaces().forEach(add);
    return out;
  }
  /** Ort aus der Eingabe: einer aus der Liste oder „Anderer Ort“ als Freitext */
  function placeOf(b) {
    if (b.other) { const t = txt(b.place, 60).replace(/\n/g, ' '); if (t.length < 2) throw new Error('Bitte kurz eintragen, wo das ist.'); return t; }
    const p = places().find(x => x.toLowerCase() === String(b.place || '').trim().toLowerCase());
    if (!p) throw new Error('Bitte einen Ort wählen.');
    return p;
  }

  /* ---------- Fotos ---------- */
  const fileOk = f => /^[0-9]+-[a-f0-9]{12}(-t)?\.jpg$/.test(f);
  function jpeg(dataUrl, max) {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) throw new Error('Bitte ein Foto (JPEG) wählen.');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length < 200 || buf.length > max) throw new Error('Das Foto ist zu groß.');
    // echte JPEG-Datei: Anfang FF D8 FF, Ende FF D9 – nicht nur die Angabe im Kopf
    if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff || buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) throw new Error('Das ist kein gültiges JPEG-Bild.');
    return buf;
  }
  function dropFiles(reportIds) {
    if (!reportIds.length) return;
    const rows = db.prepare(`SELECT file, thumb FROM mg_photo WHERE report_id IN (${reportIds.map(() => '?').join(',')})`).all(...reportIds);
    for (const r of rows) for (const f of [r.file, r.thumb]) if (fileOk(f)) try { fs.unlinkSync(path.join(DIR, f)); } catch (e) { /* schon weg */ }
    db.prepare(`DELETE FROM mg_photo WHERE report_id IN (${reportIds.map(() => '?').join(',')})`).run(...reportIds);
  }
  function sendPhoto(res, ph, thumb) {
    const f = ph && (thumb ? ph.thumb : ph.file);
    if (!f || !fileOk(f)) return res.status(404).end();
    let buf; try { buf = vault.readFile(path.join(DIR, f), { cacheIt: Boolean(thumb) }); } catch (e) { return res.status(e.vaultLocked ? 423 : 404).end(); }   // Tresor gesperrt: kein Bild
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'Content-Security-Policy': "default-src 'none'", 'X-Content-Type-Options': 'nosniff' });
    res.end(buf);
  }
  const photosOf = id => db.prepare('SELECT id FROM mg_photo WHERE report_id = ? ORDER BY id').all(id).map(r => r.id);
  const firstPhoto = id => (db.prepare('SELECT id FROM mg_photo WHERE report_id = ? ORDER BY id LIMIT 1').get(id) || {}).id || null;
  const alsoCount = id => db.prepare('SELECT COUNT(*) n FROM mg_also WHERE report_id = ?').get(id).n;

  /* ---------- Benachrichtigungen ---------- */
  /** Verwaltungsnutzer mit dem Recht „maengel“ (auch alle mit allen Rechten) */
  function handlers() {
    return db.prepare('SELECT * FROM admin_users WHERE active = 1').all().filter(u => ctx.auth.permInfo(u).perms.includes('maengel'));
  }
  async function tellHandlers(r) {
    const ids = handlers().map(u => u.member_id).filter(id => id && id !== r.member_id);   // nicht an den Melder selbst
    const title = `${r.urgent ? 'Dringend: ' : ''}Neue Mängelmeldung – ${r.place}`;
    if (ids.length) ctx.push.send(ids, 'neu', { title, body: r.text.slice(0, 120), url: './#maengel', tag: `maengel-neu-${r.id}` }).catch(() => {});
    const c = cfg();
    if (!c.mail_on || !ctx.mail.ready()) return;
    const to = new Set(c.notify.split(/[,;\s]+/).filter(Boolean));
    if (ctx.isModuleActive('mitglieder')) for (const id of ids) { const a = (await ctx.callHooks('memberAddress', id)).map(x => x.result).find(Boolean); if (a && a.email && !/@clubwerk\.invalid$/i.test(a.email)) to.add(a.email); }
    if (!to.size) return;
    ctx.mail.send({ to: [...to].join(', '), subject: `${title} – ${clubName()}`,
      text: [`${r.urgent ? 'DRINGEND – ' : ''}Neue Meldung im Mängelmelder`, '', `Ort: ${r.place}`, `Beschreibung: ${r.text}`, '', 'Fotos und Bearbeitung in der Verwaltung unter „Mängelmelder“.'].join('\n'),
      card: { heading: 'Neue Mängelmeldung', title: r.place, rows: [['Beschreibung', r.text], ...(r.urgent ? [['Dringend', 'ja']] : [])], after: 'Fotos und Bearbeitung in der Verwaltung unter „Mängelmelder“.' } }).catch(e => console.error('Mängelmelder – Mail:', e.message));
  }
  function tellReporters(r, changed) {
    const ids = [r.member_id, ...db.prepare('SELECT member_id FROM mg_also WHERE report_id = ?').all(r.id).map(x => x.member_id)].filter(Boolean);
    if (!ids.length) return;
    const body = changed.status ? `Status: ${STATUS[r.status]}${r.answer ? ' – ' + r.answer : ''}` : r.answer;
    ctx.push.send(ids, 'status', { title: `Deine Meldung: ${r.place}`, body: String(body || '').slice(0, 140), url: './#maengel', tag: `maengel-${r.id}` }).catch(() => {});
  }
  ctx.hooks.pushEvents = () => [
    { id: 'status', label: 'Mängelmeldung beantwortet', desc: 'Der Verein hat den Status deiner Meldung geändert oder dir geantwortet – auch bei Meldungen, die du mit „Ja, das ist es“ bestätigt hast.', default: true },
    { id: 'neu', label: 'Neue Mängelmeldung', desc: 'Nur für Verwaltungsnutzer mit dem Recht „Mängelmelder“, deren Konto mit einem Mitglied verknüpft ist.', default: true },
  ];

  /* ---------- gemeinsam für Mitglieder-App und Tablet ---------- */
  function createReport(memberId, b, source) {
    const place = placeOf(b);
    const text = txt(b.text, 500);
    if (text.length < 3) throw new Error('Bitte kurz beschreiben, was kaputt ist.');
    const n = db.prepare('SELECT COUNT(*) n FROM mg_report WHERE member_id = ? AND created_at >= ?').get(memberId, today()).n;
    if (n >= DAY_MAX) throw new Error(`Heute sind schon ${DAY_MAX} Meldungen von dir eingegangen – bitte morgen weiter melden.`);
    const id = Number(db.prepare('INSERT INTO mg_report(member_id, place, text, urgent, source) VALUES (?,?,?,?,?)').run(memberId, place, text, b.urgent ? 1 : 0, source).lastInsertRowid);
    const r = db.prepare('SELECT * FROM mg_report WHERE id = ?').get(id);
    audit(source, 'Mängelmelder: neue Meldung', `${place}${r.urgent ? ' (dringend)' : ''}`);
    tellHandlers(r).catch(() => {});
    return { id };
  }
  /** Foto zur eigenen, gerade angelegten Meldung (bis 1 Stunde danach, solange sie neu ist) */
  function addPhoto(memberId, reportId, b) {
    const r = db.prepare('SELECT * FROM mg_report WHERE id = ? AND member_id = ?').get(int(reportId), memberId);
    if (!r) throw Object.assign(new Error('Meldung nicht gefunden.'), { code: 404 });
    if (r.status !== 'neu' || Date.parse(r.created_at.replace(' ', 'T')) < Date.now() - 3600000) throw new Error('Fotos lassen sich nur direkt beim Melden anhängen.');
    if (db.prepare('SELECT COUNT(*) n FROM mg_photo WHERE report_id = ?').get(r.id).n >= MAX_PHOTOS) throw new Error(`Höchstens ${MAX_PHOTOS} Fotos je Meldung.`);
    const full = jpeg(b.data, PHOTO_MAX), small = jpeg(b.thumb, THUMB_MAX);
    fs.mkdirSync(DIR, { recursive: true });
    const base = `${r.id}-${crypto.randomBytes(6).toString('hex')}`;
    vault.writeFile(path.join(DIR, base + '.jpg'), full);   // verschlüsselt, wenn der Tresor eingeschaltet ist
    vault.writeFile(path.join(DIR, base + '-t.jpg'), small);
    const id = Number(db.prepare('INSERT INTO mg_photo(report_id, file, thumb) VALUES (?,?,?)').run(r.id, base + '.jpg', base + '-t.jpg').lastInsertRowid);
    return { id };
  }
  /** offene Meldungen zum selben Ort – ohne Namen */
  function similar(memberId, b) {
    let place; try { place = placeOf(b); } catch (e) { return []; }
    return db.prepare(`SELECT * FROM mg_report WHERE status IN ('neu','arbeit') AND place = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 10`).all(place).map(r => ({
      id: r.id, text: r.text, created_at: r.created_at, status: r.status, photo: firstPhoto(r.id), also: alsoCount(r.id),
      mine: r.member_id === memberId, confirmed: Boolean(db.prepare('SELECT 1 FROM mg_also WHERE report_id = ? AND member_id = ?').get(r.id, memberId)) }));
  }
  /** „Ja, das ist es“: bei der vorhandenen Meldung „auch gemeldet“ hochzählen (je Mitglied einmal) */
  function confirm(memberId, reportId, source) {
    const r = db.prepare("SELECT * FROM mg_report WHERE id = ? AND status IN ('neu','arbeit')").get(int(reportId));
    if (!r) throw Object.assign(new Error('Diese Meldung ist schon erledigt.'), { code: 404 });
    if (r.member_id === memberId) return { ok: true, also: alsoCount(r.id), own: true };
    const added = db.prepare('INSERT OR IGNORE INTO mg_also(report_id, member_id) VALUES (?,?)').run(r.id, memberId).changes;
    if (added) audit(source, 'Mängelmelder: auch gemeldet', r.place);
    return { ok: true, also: alsoCount(r.id) };
  }
  /** Foto für Mitglieder: eigene/bestätigte Meldungen ganz, sonst nur das erste Foto offener Meldungen (für „Ist es das?“) */
  function memberMaySee(memberId, ph) {
    const r = ph && db.prepare('SELECT * FROM mg_report WHERE id = ?').get(ph.report_id);
    if (!r) return false;
    if (r.member_id === memberId || db.prepare('SELECT 1 FROM mg_also WHERE report_id = ? AND member_id = ?').get(r.id, memberId)) return true;
    return OPEN.includes(r.status) && firstPhoto(r.id) === ph.id;
  }
  const photoRow = id => db.prepare('SELECT * FROM mg_photo WHERE id = ?').get(int(id));
  const send = fn => (req, res) => { try { res.json(fn(req)); } catch (e) { bad(res, e.message, e.code || 400); } };

  /* ---------- Mitglieder-App ---------- */
  const M = ctx.member;
  const appBurst = ctx.rateLimitKey('mgapp', 40, 10 * 60000, req => String(req.member.id));
  M.get('/orte', (req, res) => res.json({ places: places() }));
  M.post('/aehnlich', send(req => ({ list: similar(req.member.id, req.body || {}) })));
  M.post('/melden', appBurst, send(req => createReport(req.member.id, req.body || {}, 'app')));
  M.post('/meldung/:id/foto', appBurst, send(req => addPhoto(req.member.id, req.params.id, req.body || {})));
  M.post('/meldung/:id/auch', appBurst, send(req => confirm(req.member.id, req.params.id, 'app')));
  M.get('/meine', (req, res) => {
    const id = req.member.id;
    const rows = db.prepare(`SELECT * FROM mg_report WHERE member_id = ? OR id IN (SELECT report_id FROM mg_also WHERE member_id = ?) ORDER BY created_at DESC, id DESC LIMIT 50`).all(id, id);
    res.json({ list: rows.map(r => ({ id: r.id, place: r.place, text: r.text, urgent: Boolean(r.urgent), status: r.status, answer: r.answer || '', created_at: r.created_at, updated_at: r.updated_at,
      own: r.member_id === id, also: alsoCount(r.id), photos: photosOf(r.id) })) });
  });
  M.get('/foto/:id', (req, res) => { const ph = photoRow(req.params.id); if (!memberMaySee(req.member.id, ph)) return res.status(404).end(); sendPhoto(res, ph, req.query.t === '1'); });

  /* ---------- Tablet (Namen wählen, Mitglieder-PIN über /api/tablet/unlock, dann mit dem Token) ---------- */
  const T = ctx.tablet;
  const tabletMember = b => {
    const mid = ctx.auth.checkTabletToken(b.token);
    if (!mid || typeof mid !== 'number') throw Object.assign(new Error('Sitzung abgelaufen – bitte Namen neu wählen.'), { code: 401 });
    const m = db.prepare("SELECT id, pin_hash FROM members WHERE id = ? AND kind IN ('mitglied','nichtmitglied') AND active = 1 AND deleted = 0").get(mid);
    if (!m || !m.pin_hash) throw Object.assign(new Error('Melden am Tablet geht nur mit PIN.'), { code: 403 });
    return m.id;
  };
  const tabBurst = ctx.rateLimit('mgtab', 60, 10 * 60000);
  T.get('/state', (req, res) => res.json({ places: places(),
    people: db.prepare("SELECT id, name, kind FROM members WHERE kind IN ('mitglied','nichtmitglied') AND active = 1 AND deleted = 0 AND pending = 0 AND pin_hash IS NOT NULL ORDER BY name_key(name, kind)").all().map(p => ({ id: p.id, name: p.name, ln: lastFirst(p.name, p.kind) })) }));
  T.post('/aehnlich', send(req => ({ list: similar(tabletMember(req.body || {}), req.body || {}) })));
  T.post('/melden', tabBurst, send(req => createReport(tabletMember(req.body || {}), req.body || {}, 'tablet')));
  T.post('/foto', tabBurst, send(req => addPhoto(tabletMember(req.body || {}), (req.body || {}).report_id, req.body || {})));
  T.post('/auch', tabBurst, send(req => confirm(tabletMember(req.body || {}), (req.body || {}).report_id, 'tablet')));
  // am Tablet nur das erste Foto offener Meldungen (Vorschau für „Ist es das?“) – hinter dem Tablet-Passwort
  T.get('/foto/:id', (req, res) => { const ph = photoRow(req.params.id); const r = ph && db.prepare('SELECT status FROM mg_report WHERE id = ?').get(ph.report_id);
    if (!r || !OPEN.includes(r.status) || firstPhoto(ph.report_id) !== ph.id) return res.status(404).end(); sendPhoto(res, ph, true); });

  /* ---------- Verwaltung ---------- */
  const A = ctx.admin;
  const userName = id => { const u = id && db.prepare('SELECT name, username FROM admin_users WHERE id = ?').get(id); return u ? (u.name || u.username) : ''; };
  const memberName = id => { const m = id && db.prepare('SELECT name, kind FROM members WHERE id = ?').get(id); return m ? lastFirst(m.name, m.kind) : ''; };
  A.get('/meta', P, (req, res) => res.json({ cfg: cfg(), places: ownPlaces(), bookingPlaces: ctx.isModuleActive('buchung'), status: STATUS,
    handlers: handlers().map(u => ({ id: u.id, name: u.name || u.username })), counts: { offen: db.prepare("SELECT COUNT(*) n FROM mg_report WHERE status IN ('neu','arbeit')").get().n } }));
  A.get('/liste', P, (req, res) => {
    const open = req.query.ansicht !== 'erledigt';
    const rows = db.prepare(`SELECT r.*, (SELECT COUNT(*) FROM mg_also a WHERE a.report_id = r.id) also, (SELECT MIN(id) FROM mg_photo p WHERE p.report_id = r.id) photo, (SELECT COUNT(*) FROM mg_photo p WHERE p.report_id = r.id) photos
      FROM mg_report r WHERE r.status IN (${open ? "'neu','arbeit'" : "'erledigt','abgelehnt'"}) ORDER BY ${open ? 'r.created_at DESC' : 'r.done_at DESC'}, r.id DESC LIMIT 500`).all();
    res.json({ list: rows.map(r => ({ id: r.id, place: r.place, text: r.text, urgent: Boolean(r.urgent), status: r.status, created_at: r.created_at, done_at: r.done_at, also: r.also, photo: r.photo, photos: r.photos,
      reporter: r.member_id ? memberName(r.member_id) : '', assignee: userName(r.assignee), source: r.source })), keep_months: cfg().keep_months });
  });
  A.get('/meldung/:id', P, (req, res) => {
    const r = db.prepare('SELECT * FROM mg_report WHERE id = ?').get(int(req.params.id));
    if (!r) return bad(res, 'Meldung nicht gefunden.', 404);
    res.json({ ...r, urgent: Boolean(r.urgent), reporter: r.member_id ? memberName(r.member_id) : '', photos: photosOf(r.id),
      alsoNames: db.prepare('SELECT m.name, m.kind FROM mg_also a JOIN members m ON m.id = a.member_id WHERE a.report_id = ? ORDER BY name_key(m.name, m.kind)').all(r.id).map(m => lastFirst(m.name, m.kind)) });
  });
  A.put('/meldung/:id', P, (req, res) => {
    const r = db.prepare('SELECT * FROM mg_report WHERE id = ?').get(int(req.params.id));
    if (!r) return bad(res, 'Meldung nicht gefunden.', 404);
    const b = req.body || {};
    const next = { status: b.status === undefined ? r.status : String(b.status), answer: b.answer === undefined ? (r.answer || '') : txt(b.answer, 500), note: b.note === undefined ? (r.note || '') : txt(b.note, 1000),
      assignee: b.assignee === undefined ? r.assignee : (int(b.assignee) || null) };
    if (!STATUS[next.status]) return bad(res, 'Unbekannter Status.');
    if (next.assignee && !handlers().some(u => u.id === next.assignee)) return bad(res, 'Diese Person hat kein Recht für den Mängelmelder.');
    const done = !OPEN.includes(next.status);
    db.prepare(`UPDATE mg_report SET status = ?, answer = ?, note = ?, assignee = ?, updated_at = datetime('now','localtime'),
      done_at = CASE WHEN ? THEN COALESCE(done_at, datetime('now','localtime')) ELSE NULL END WHERE id = ?`)
      .run(next.status, next.answer || null, next.note || null, next.assignee, done ? 1 : 0, r.id);
    const LABELS = { status: 'Status', answer: ['Antwort', 'text'], note: ['Interne Notiz', 'text'], assignee: 'Zuständig' };
    const show = x => ({ status: STATUS[x.status], answer: x.answer || '', note: x.note || '', assignee: userName(x.assignee) });
    const diff = ctx.auditDiff(LABELS, show(r), show(next));
    if (diff) audit(req.user, 'Mängelmelder: Meldung bearbeitet', `${r.place}: ${diff}`);
    const changed = { status: next.status !== r.status, answer: (next.answer || '') !== (r.answer || '') && Boolean(next.answer) };
    if (changed.status || changed.answer) tellReporters({ ...r, ...next }, changed);
    res.json({ ok: true });
  });
  A.delete('/meldung/:id', P, (req, res) => {
    const r = db.prepare('SELECT * FROM mg_report WHERE id = ?').get(int(req.params.id));
    if (!r) return bad(res, 'Meldung nicht gefunden.', 404);
    db.transaction(() => { dropFiles([r.id]); db.prepare('DELETE FROM mg_also WHERE report_id = ?').run(r.id); db.prepare('DELETE FROM mg_report WHERE id = ?').run(r.id); })();
    audit(req.user, 'Mängelmelder: Meldung gelöscht', r.place);
    res.json({ ok: true });
  });
  A.get('/foto/:id', P, (req, res) => sendPhoto(res, photoRow(req.params.id), req.query.t === '1'));
  A.put('/einstellungen', P, (req, res) => {
    const b = req.body || {}, before = cfg();
    if (b.keep_months !== undefined) { const n = int(b.keep_months); if (!(n >= 1 && n <= 120)) return bad(res, 'Bitte eine Frist zwischen 1 und 120 Monaten eintragen.'); SET('keep_months', n); }
    if (b.mail_on !== undefined) SET('mail_on', b.mail_on ? '1' : '0');
    if (b.notify !== undefined) { const l = String(b.notify || '').split(/[,;\s]+/).filter(Boolean); if (l.some(x => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))) return bad(res, 'Bitte gültige E-Mail-Adressen eintragen (mehrere mit Komma).'); SET('notify', l.slice(0, 5).join(', ')); }
    let placesDiff = '';
    if (b.places !== undefined) {
      if (!Array.isArray(b.places)) return bad(res, 'Ungültige Ortsliste.');
      const seen = new Set(), list = b.places.map(x => txt(x, 60).replace(/\n/g, ' ')).filter(x => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase())).slice(0, 100);
      const old = ownPlaces();
      db.transaction(() => { db.prepare('DELETE FROM mg_place').run(); list.forEach((n, i) => db.prepare('INSERT INTO mg_place(name, sort) VALUES (?,?)').run(n, i)); })();
      placesDiff = ctx.auditDiff({ places: ['Orte', 'list'] }, { places: old }, { places: list });
    }
    const diff = [ctx.auditDiff(CFG_LABELS, before, cfg()), placesDiff].filter(Boolean).join(' · ');
    if (diff) audit(req.user, 'Mängelmelder: Einstellungen geändert', diff);
    res.json({ ok: true, cfg: cfg(), places: ownPlaces() });
  });

  /* ---------- Aufbewahrung: erledigte und abgelehnte Meldungen nach der Frist löschen (mit Fotos) ---------- */
  function cleanup() {
    if (!ctx.isActive()) return 0;
    const ids = db.prepare(`SELECT id FROM mg_report WHERE status IN ('erledigt','abgelehnt') AND done_at IS NOT NULL AND done_at < datetime('now','localtime', ?)`).all(`-${cfg().keep_months} months`).map(r => r.id);
    if (!ids.length) return 0;
    const q = ids.map(() => '?').join(',');
    db.transaction(() => { dropFiles(ids); db.prepare(`DELETE FROM mg_also WHERE report_id IN (${q})`).run(...ids); db.prepare(`DELETE FROM mg_report WHERE id IN (${q})`).run(...ids); })();
    audit(null, 'Mängelmelder: Aufbewahrungsfrist', `${ids.length} erledigte ${ids.length === 1 ? 'Meldung' : 'Meldungen'} mit Fotos gelöscht (älter als ${cfg().keep_months} Monate)`);
    return ids.length;
  }
  /** Fotodateien ohne Meldung (Modul deinstalliert, Hochladen abgebrochen) beim Start entfernen – auch bei ausgeschaltetem Modul */
  function dropOrphans() {
    const known = new Set(db.prepare('SELECT file, thumb FROM mg_photo').all().flatMap(r => [r.file, r.thumb]));
    let list = []; try { list = fs.readdirSync(DIR); } catch (e) { return; }
    for (const f of list) if (!known.has(f)) try { fs.unlinkSync(path.join(DIR, f)); } catch (e) { /* weiter */ }
  }
  try { dropOrphans(); } catch (e) { console.error('Mängelmelder – verwaiste Fotos:', e.message); }
  setInterval(() => { try { cleanup(); } catch (e) { console.error('Mängelmelder – Aufräumen:', e.message); } }, process.env.CW_TEST_FAST ? 1500 : 3600000).unref();
  setTimeout(() => { try { cleanup(); } catch (e) { console.error('Mängelmelder – Aufräumen:', e.message); } }, 8000).unref();

  /* ---------- für den Kern ---------- */
  // Konto zusammengeführt: Meldungen und Bestätigungen wandern mit; Konto gelöscht: Meldungen bleiben ohne Namen
  ctx.hooks.memberRemoved = (fromId, intoId) => {
    if (intoId) {
      db.prepare('UPDATE mg_report SET member_id = ? WHERE member_id = ?').run(intoId, fromId);
      db.prepare('UPDATE OR IGNORE mg_also SET member_id = ? WHERE member_id = ?').run(intoId, fromId);
      db.prepare('DELETE FROM mg_also WHERE member_id = ? OR (member_id = ? AND report_id IN (SELECT id FROM mg_report WHERE member_id = ?))').run(fromId, intoId, intoId);
    } else {
      db.prepare('UPDATE mg_report SET member_id = NULL WHERE member_id = ?').run(fromId);
      db.prepare('DELETE FROM mg_also WHERE member_id = ?').run(fromId);
    }
  };
  ctx.hooks.overview = () => {
    const open = db.prepare("SELECT COUNT(*) n FROM mg_report WHERE status IN ('neu','arbeit')").get().n;
    const fresh = db.prepare("SELECT COUNT(*) n FROM mg_report WHERE status = 'neu'").get().n;
    const urgent = db.prepare("SELECT COUNT(*) n FROM mg_report WHERE status IN ('neu','arbeit') AND urgent = 1").get().n;
    return { kpis: [{ l: 'Offene Mängel', v: open }, { l: 'davon neu', v: fresh }],
      alerts: urgent ? [{ level: 'a', text: `${urgent} ${urgent === 1 ? 'dringende Mängelmeldung ist' : 'dringende Mängelmeldungen sind'} offen.`, sec: ['tab_maengel', 'offen'] }] : [] };
  };
}

exports.activate = activate;
