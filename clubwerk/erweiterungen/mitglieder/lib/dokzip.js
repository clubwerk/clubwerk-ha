'use strict';
/**
 * Dokumente als ZIP (planung/dokumente-zip.md, Entscheidungen 11.11.2026)
 *  - Je Mitglied: GET member/:id/documents.zip – Recht „Dokumente“, Protokolleintrag.
 *  - Gesammelt (alle bzw. die in der Liste gefilterten Mitglieder): POST documents/zip mit dry (Vorschau) bzw. eigenem Passwort
 *    → Einmal-Ticket (2 Minuten, nur für diesen Benutzer) → GET documents.zip?t=… lädt herunter. Protokolleintrag mit Anzahl
 *    und Filter (keine Inhalte) und Sicherheitswarnung an den Vorstand. Höchstens 10 gesammelte Exporte je Benutzer und Stunde.
 *  - Inhalt: alles, was am Mitglied unter „Dokumente“ steht – auch Dokumente anderer Module (Hook memberDocuments mit read()).
 *    Ein Ordner je „Nachname, Vorname“ (bei Gleichnamigen mit Mitgliedsnummer), dazu „Übersicht.xlsx“.
 *  - Gestreamt: Datei für Datei lesen (Tresor entschlüsselt), nie alles im Speicher; Abbruch des Browsers beendet die Arbeit.
 *  - Namen im ZIP sind selbst gebaut und bereinigt (keine Pfadtrenner, kein „..“) – Zip-Slip ist ausgeschlossen. Gelesen wird nur
 *    im Dokumentenordner (path.basename) bzw. über die read()-Funktion des Moduls.
 *  - Abteilungsleitungen („nur eigene Abteilung(en)“) exportieren nur Mitglieder ihrer Abteilungen.
 */
const path = require('path');
const crypto = require('crypto');

const TOTAL_MAX = 2 * 1024 * 1024 * 1024;   // 2 GB je ZIP – darüber bitte filtern (z. B. nach Abteilung)
const TICKET_MS = 2 * 60000;
const IDS_MAX = 20000;

/** Namensteil im ZIP: keine Steuerzeichen, keine Pfadtrenner oder für Windows verbotenen Zeichen, kein „..“, keine Punkte/Leerzeichen am Rand. Umlaute bleiben. */
function cleanPart(v, max = 80) {
  const s = String(v == null ? '' : v).normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f<>:"/\\|?*]+/g, '_')
    .replace(/\.{2,}/g, '.').replace(/\s+/g, ' ')
    .replace(/^[\s._]+|[\s.]+$/g, '').slice(0, max).replace(/[\s.]+$/g, '');
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s) ? `_${s}` : s;
}

function register(sh) {
  const { C, store, one, uname, ar, listRows, inScope } = sh;
  const { today } = store;
  const { need, bad, int } = C;
  const db = C.db, admin = C.admin;
  const PD = need('mitglieder_dokumente');
  const G = C.require('./geraete');   // eigenes Passwort bestätigen, falsche Versuche je Benutzer gebremst
  const vault = C.require('./vault');
  const { lastFirst } = C.require('./db');
  const security = C.require('./security');
  const quota = security.budget({ max: 10, windowMs: 3600000, size: 2000 });
  const tickets = new Map();   // sha256(Ticket) → { user, ids, filter, until }
  const KIND = sh.DOC_KIND;

  /** Dokumente eines Mitglieds wie im Reiter „Dokumente“: eigene (mv_document) und die anderer Module, je mit read() */
  function docsOf(id, perms) {
    const own = db.prepare('SELECT id, kind, title, file, mime, size, created_at FROM mv_document WHERE member_id = ? ORDER BY created_at, id').all(id)
      .map(d => ({ title: d.title, kind: KIND[d.kind] || d.kind, origin: 'Mitglieder', created_at: d.created_at, size: d.size,
        ext: (path.extname(d.file).slice(1).toLowerCase().match(/^[a-z0-9]{1,5}$/) || [''])[0],
        read: () => vault.readFile(path.join(sh.docDir(), path.basename(d.file))) }));
    return [...own, ...sh.otherDocuments(id, perms, true).map(x => ({ title: x.title, kind: x.kind_label || 'Protokoll', origin: x.origin || x.source, created_at: x.created_at, size: 0, ext: x.ext || 'pdf', read: x.read }))]
      .filter(d => typeof d.read === 'function');
  }

  /** Mitglieder (id, Name, Nr.) in Listenreihenfolge, eingeschränkt auf erlaubte und – bei Abteilungsleitungen – eigene Abteilungen */
  function membersFor(req, ids) {
    const want = ids ? new Set(ids) : null;
    return listRows({ status: 'alle' }).filter(r => (!want || want.has(r.id)) && (!req.mvScope || r.dept_ids.some(d => req.mvScope.includes(d))))
      .map(r => ({ id: r.id, name: lastFirst(r.name, 'mitglied'), no: r.member_no || '' }));
  }

  /** Ordnernamen: „Nachname, Vorname“, bei Gleichnamigen mit Mitgliedsnummer (ohne Nummer mit laufender Zahl) */
  function folders(list) {
    const count = new Map();
    for (const m of list) { const k = (cleanPart(m.name, 80) || 'Mitglied').toLowerCase(); count.set(k, (count.get(k) || 0) + 1); }
    const used = new Set();
    for (const m of list) {
      const base = cleanPart(m.name, 80) || 'Mitglied';
      let f = count.get(base.toLowerCase()) > 1 && m.no ? cleanPart(C.T('{0} (Nr. {1})', [base, cleanPart(m.no, 20)]), 100) : base;
      for (let i = 2; used.has(f.toLowerCase()); i++) f = `${base} (${i})`;
      used.add(f.toLowerCase()); m.folder = f;
    }
    return list;
  }

  /** Vorschau: Anzahl Dokumente und Größe (eigene Dokumente aus der Tabelle, die anderer Module über den Hook) */
  function preview(list, perms) {
    let docs = 0, bytes = 0, withDocs = 0;
    const own = new Map(db.prepare('SELECT member_id, COUNT(*) n, COALESCE(SUM(size), 0) b FROM mv_document WHERE member_id IN (SELECT value FROM json_each(?)) GROUP BY member_id')
      .all(JSON.stringify(list.map(m => m.id))).map(r => [r.member_id, r]));
    for (const m of list) {
      const o = own.get(m.id), n = (o ? o.n : 0) + sh.otherDocuments(m.id, perms).length;
      docs += n; bytes += o ? o.b : 0; if (n) withDocs++;
    }
    return { members: list.length, withDocs, docs, bytes };
  }

  const safe = v => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);
  const deD = d => (/^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? String(d).slice(0, 10).split('-').reverse().join('.') : '');

  /** ZIP schreiben (gestreamt). list: Mitglieder mit folder. → { docs, missing } */
  async function writeZip(req, res, list, zipName) {
    const archiver = C.require('archiver');
    const ExcelJS = C.require('exceljs');
    const archive = archiver('zip', { zlib: { level: 6 } });
    let aborted = false;
    req.on('close', () => { if (!res.writableFinished) { aborted = true; archive.abort(); } });
    archive.on('warning', e => console.error('Dokumente-ZIP:', e.message));
    archive.on('error', e => { console.error('Dokumente-ZIP:', e.message); aborted = true; res.destroy(); });
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="Dokumente.zip"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    archive.pipe(res);
    const rows = []; let docs = 0, missing = 0;
    for (const m of list) {
      if (aborted) break;
      const used = new Set();
      for (const d of docsOf(m.id, req.user.perms)) {
        if (aborted) break;
        const ext = d.ext ? `.${d.ext}` : '';
        let title = cleanPart(d.title, 90) || 'Dokument';
        if (ext && title.toLowerCase().endsWith(ext)) title = title.slice(0, -ext.length).replace(/[\s.]+$/, '') || 'Dokument';
        const stem = `${String(d.created_at || '').slice(0, 10)} ${title}`.trim();
        let file = stem + ext;
        for (let i = 2; used.has(file.toLowerCase()); i++) file = `${stem} (${i})${ext}`;
        used.add(file.toLowerCase());
        let buf = null, note = '';
        try { buf = d.read(); } catch (e) { note = e.vaultLocked ? 'Tresor gesperrt' : 'Datei fehlt'; }
        if (buf && buf.length) {
          const entry = new Promise(r => archive.once('entry', r));
          archive.append(buf, { name: `${m.folder}/${file}`, date: new Date() });
          buf = null;
          await entry;   // Datei für Datei – der Browser gibt das Tempo vor
          docs++;
        } else { missing++; note = note || 'Datei fehlt'; }
        rows.push([m.name, m.no, d.title, d.kind, deD(d.created_at), d.size ? Math.max(1, Math.round(d.size / 1024)) : '', d.origin, note ? '' : `${m.folder}/${file}`, note]);
      }
    }
    if (aborted) return { docs, missing, aborted };
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Dokumente');
    ws.columns = [{ header: 'Mitglied', width: 28 }, { header: 'Nr.', width: 10 }, { header: 'Dokument', width: 40 }, { header: 'Art', width: 18 }, { header: 'Datum', width: 12 },
      { header: 'Größe (KB)', width: 11 }, { header: 'Herkunft', width: 14 }, { header: 'Datei im ZIP', width: 60 }, { header: 'Hinweis', width: 18 }];
    for (const r of rows) ws.addRow(r.map(safe));
    ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }];
    archive.append(Buffer.from(await wb.xlsx.writeBuffer()), { name: cleanPart(C.T('Übersicht.xlsx'), 40) || 'Übersicht.xlsx', date: new Date() });
    await archive.finalize();
    return { docs, missing };
  }

  /** Fehler mitten im Download: Antwort abbrechen (die Kopfzeilen sind schon gesendet) statt eine zweite Antwort zu versuchen */
  async function streamZip(req, res, list, zipName) {
    try { return await writeZip(req, res, list, zipName); } catch (e) {
      console.error('Dokumente-ZIP:', e);
      if (!res.headersSent) bad(res, 'Das ZIP konnte nicht erstellt werden – bitte im Add-on-Protokoll nachsehen.', 500); else res.destroy();
      return { docs: 0, aborted: true };
    }
  }
  const lockedAnswer = res => { if (!vault.locked()) return false; bad(res, 'Die persönlichen Daten sind gesperrt – bitte als Admin anmelden.', 423); return true; };

  /* ---------- je Mitglied ---------- */
  admin.get('/member/:id/documents.zip', PD, ar(async (req, res) => {
    const id = int(req.params.id);
    const m = membersFor(req, [id])[0];
    if (!m) return bad(res, 'Mitglied nicht gefunden.', 404);
    if (lockedAnswer(res)) return;
    const n = docsOf(id, req.user.perms).length;
    if (!n) return bad(res, 'Zu diesem Mitglied gibt es keine Dokumente.', 404);
    if (req.query.pruefen) return res.json({ docs: n });
    folders([m]);
    C.audit(req.user, 'Mitglied: Dokumente als ZIP heruntergeladen', `${m.name}: ${n} ${n === 1 ? 'Dokument' : 'Dokumente'}`);
    await streamZip(req, res, [m], C.T('Dokumente {0} {1}.zip', [m.folder, today()]));
  }));

  /* ---------- gesammelt ---------- */
  const filterText = (f = {}) => {
    const st = { aktuell: 'aktuelle Mitglieder', hinweis: 'mit Hinweis', ausgetreten: 'ausgetreten', alle: 'alle' }[f.status] || 'alle';
    const dept = f.dept ? (db.prepare('SELECT name FROM mv_department WHERE id = ?').get(int(f.dept)) || {}).name : null;
    const fee = f.fee ? (db.prepare('SELECT name FROM mv_fee WHERE id = ?').get(int(f.fee)) || {}).name : null;
    return [st, dept && `Abteilung ${dept}`, fee && `Beitrag ${fee}`, f.q && `Suche „${one(f.q, 40)}“`].filter(Boolean).join(' · ');
  };
  admin.post('/documents/zip', PD, (req, res) => {
    const b = req.body || {};
    const ids = Array.isArray(b.ids) ? [...new Set(b.ids.slice(0, IDS_MAX).map(Number).filter(n => Number.isInteger(n) && n > 0))] : null;
    if (ids && !ids.length) return bad(res, 'Keine Mitglieder ausgewählt.');
    const list = membersFor(req, ids);
    const pv = preview(list, req.user.perms);
    const filter = filterText(b.filter || {});
    if (b.dry) return res.json({ ...pv, filter, max: TOTAL_MAX });
    if (!pv.docs) return bad(res, 'Bei diesen Mitgliedern gibt es keine Dokumente.');
    if (pv.bytes > TOTAL_MAX) return bad(res, 'Das wären mehr als 2 GB – bitte die Liste eingrenzen (z. B. nach Abteilung) und in mehreren Teilen exportieren.');
    if (lockedAnswer(res)) return;
    const pw = G.bestaetigt(req, res, C.ownPwOk); if (!pw) return;
    if (!pw.confirmed) return res.status(428).json({ error: 'Bitte mit deinem Passwort bestätigen.', needPassword: true });
    if (!quota.take(String(req.user.id))) return res.status(429).json({ error: 'Schon 10 gesammelte Exporte in der letzten Stunde – bitte später noch einmal.' });
    const now = Date.now();
    for (const [k, t] of tickets) if (t.until < now) tickets.delete(k);
    if (tickets.size > 50) tickets.delete(tickets.keys().next().value);
    const t = crypto.randomBytes(24).toString('base64url');
    tickets.set(crypto.createHash('sha256').update(t).digest('hex'), { user: req.user.id, ids: list.map(m => m.id), filter, until: now + TICKET_MS });
    res.json({ ...pv, filter, url: `api/admin/x/mitglieder/documents.zip?t=${t}` });
  });
  admin.get('/documents.zip', PD, ar(async (req, res) => {
    const key = crypto.createHash('sha256').update(String(req.query.t || '')).digest('hex');
    const t = tickets.get(key);
    tickets.delete(key);   // nur einmal gültig
    if (!t || t.until < Date.now() || t.user !== req.user.id) return bad(res, 'Der Download-Link ist abgelaufen – bitte den Export noch einmal starten.', 410);
    if (lockedAnswer(res)) return;
    const list = folders(membersFor(req, t.ids));   // Rechte und Abteilungen noch einmal prüfen
    const who = req.user.name || req.user.username;
    const pv = preview(list, req.user.perms);
    const what = `${pv.withDocs} ${pv.withDocs === 1 ? 'Mitglied' : 'Mitglieder'} mit ${pv.docs} ${pv.docs === 1 ? 'Dokument' : 'Dokumenten'} (Auswahl: ${list.length} · ${t.filter})`;
    C.audit(req.user, 'Mitglieder: Dokumente gesammelt exportiert', what);
    C.securityAlert('dokumente_zip', `${who} hat Dokumente gesammelt als ZIP exportiert: ${what}.`, { key: String(req.user.id) });
    const r = await streamZip(req, res, list, C.T('Dokumente Mitglieder {0}.zip', [today()]));
    if (r.aborted) C.audit(req.user, 'Mitglieder: Dokumente-Export abgebrochen', `nach ${r.docs} ${r.docs === 1 ? 'Dokument' : 'Dokumenten'}`);
  }));

}

module.exports = { register, cleanPart };
