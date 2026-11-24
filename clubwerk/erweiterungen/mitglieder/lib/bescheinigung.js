'use strict';
/**
 * Mitgliedsbescheinigung (z. B. für das Bonusprogramm der Krankenkasse):
 *  - Mitglieder-App „Meine Daten“: anfordern (Jahr, optionaler Hinweis); das Oberhaupt einer Familie auch für Familienmitglieder
 *  - Verwaltung › Mitglieder › Anträge › „Änderungen & Meldungen“: Vorschau als PDF, mit Finger/Maus unterschreiben und senden oder ablehnen
 *  - PDF mit Briefkopf, Vereinsstempel (Einstellungen › Mitglieder) und Unterschrift → Dokumente des Mitglieds, E-Mail ans Mitglied
 *    bzw. Oberhaupt (Dokumente gehen ans Oberhaupt), abrufbar in der App, Push „Bescheinigung ist da“
 * Gespeichert wird die Anforderung als Änderungswunsch (mv_change, kind 'bescheinigung', member_id = bescheinigte Person).
 * Unterschreiben darf nur, wer „Mitglieder“ ohne Abteilungs-Einschränkung hat; Abteilungsleitungen sehen Anfragen ihrer Abteilung.
 * Die gezeichnete Unterschrift steht nur im PDF – sie wird nirgends sonst gespeichert.
 */
const pdf = require('./pdf');
const { lastFirst } = require('../../../src/db');   // Namen immer „Nachname, Vorname“

function register(sh) {
  const { C, store, one, uname, ar, personRow, saveDocument } = sh;
  const { S, SET, today, nowTs } = store;
  const { need, bad, int } = C;
  const db = C.db, admin = C.admin, M = C.member;
  const P = need('mitglieder');
  const { sigOk, imageType } = C.util;
  const KIND = 'bescheinigung';
  const STAMP_MAX = 2 * 1024 * 1024;
  const club = () => { const a = C.clubAddress(); return { name: S('creditor_name') || C.getSetting('club_name', 'Verein'), street: a.street, city: a.city, email: a.email, phone: a.phone, web: a.web }; };
  const full = p => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name || '';

  /* ---------- Vereinsstempel (einmal hochladen, kommt auf jede Bescheinigung) ---------- */
  const stamp = () => { const t = S('stamp_type'); if (t !== 'png' && t !== 'jpg') return null; try { const b = Buffer.from(S('stamp'), 'base64'); return imageType(b) === t ? b : null; } catch (e) { return null; } };
  sh.stampInfo = () => ({ stamp: Boolean(stamp()), stamp_ver: S('stamp_ver') || '' });
  admin.get('/stamp', P, (req, res) => {
    const b = stamp(); if (!b) return res.status(404).end();
    res.set({ 'Content-Type': S('stamp_type') === 'jpg' ? 'image/jpeg' : 'image/png', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'", 'X-Content-Type-Options': 'nosniff' }).send(b);
  });
  admin.post('/stamp', P, C.require('express').raw({ type: () => true, limit: STAMP_MAX + 1024 }), (req, res) => {
    const b = Buffer.isBuffer(req.body) ? req.body : null;
    if (!b || !b.length) return bad(res, 'Keine Datei empfangen.');
    if (b.length > STAMP_MAX) return bad(res, 'Das Bild ist zu groß (höchstens 2 MB).');
    const t = imageType(b);
    if (t !== 'png' && t !== 'jpg') return bad(res, 'Bitte den Stempel als PNG oder JPG hochladen (am besten PNG mit durchsichtigem Hintergrund).');
    const had = Boolean(stamp());
    db.transaction(() => { SET('stamp', b.toString('base64')); SET('stamp_type', t); SET('stamp_ver', Date.now().toString(36)); })();
    C.audit(req.user, 'Mitglieder: Einstellungen geändert', had ? 'Vereinsstempel ersetzt' : 'Vereinsstempel hochgeladen');
    res.json({ ok: true, ...sh.stampInfo() });
  });
  admin.delete('/stamp', P, (req, res) => {
    db.transaction(() => { SET('stamp', ''); SET('stamp_type', ''); SET('stamp_ver', ''); })();
    C.audit(req.user, 'Mitglieder: Einstellungen geändert', 'Vereinsstempel entfernt');
    res.json({ ok: true, ...sh.stampInfo() });
  });

  /* ---------- Inhalt: nur, was der Verein kennt ---------- */
  /** Zeitraum der Mitgliedschaft im Jahr → { from, to, whole } oder null (kein Mitglied in diesem Jahr) */
  function spanIn(p, year) {
    const a = `${year}-01-01`, z = `${year}-12-31`, t = today();
    if (!p || !p.entry_date || p.entry_date > z || (p.exit_date && p.exit_date < a) || a > t) return null;
    const from = p.entry_date > a ? p.entry_date : a;
    const to = p.exit_date && p.exit_date < z ? p.exit_date : null;   // null: bis heute bzw. bis Jahresende
    const ended = z < t;   // Jahr vorbei
    return { from, to: to || (ended ? z : null), whole: from === a && !to && ended };
  }
  /** Jahre zur Auswahl in der App: laufendes und voriges, soweit die Person dann Mitglied war */
  const yearsFor = p => { const y = Number(today().slice(0, 4)); return [y, y - 1].filter(x => spanIn(p, x)); };
  function content(id, year) {
    const p = personRow(id); if (!p) return null;
    const span = spanIn(p, year); if (!span) return null;
    const depts = db.prepare(`SELECT DISTINCT d.name FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id
      WHERE md.member_id = ? AND (md.entry_date IS NULL OR md.entry_date <= ?) AND (md.exit_date IS NULL OR md.exit_date >= ?) ORDER BY d.sort, d.name`).all(id, `${year}-12-31`, `${year}-01-01`).map(r => r.name);
    return { person: p, name: full(p), member_no: p.member_no, birth_date: p.birth_date, entry_date: p.entry_date, status: store.STATUS[p.status] || p.status || 'aktiv', departments: depts, year, ...span };
  }
  /** Empfänger der Bescheinigung: bei einer Familienmitgliedschaft das Oberhaupt, sonst die Person selbst */
  const recipientOf = id => store.familyHead(id) || id;
  /** Für wen darf dieses Mitglied anfordern? sich selbst und – als Oberhaupt – die Familienmitglieder */
  function forWhom(id) {
    const ids = [id];
    if (store.familyHead(id) === id) for (const f of store.familyMembers(id)) if (!ids.includes(f.id)) ids.push(f.id);
    return ids.map(personRow).filter(p => p && !p.anonymized_at);
  }

  /* ---------- Mitglieder-App ---------- */
  sh.certificatesFor = id => {
    const E = store.appPerms().edit;
    const people = forWhom(id);
    const ids = people.map(p => p.id);
    const list = db.prepare(`SELECT * FROM mv_change WHERE kind = ? AND member_id IN (${ids.map(() => '?').join(',')}) AND status IN ('offen','übernommen','abgelehnt') ORDER BY id DESC LIMIT 20`).all(KIND, ...ids).map(c => {
      const d = JSON.parse(c.data || '{}'), p = people.find(x => x.id === c.member_id) || {};
      return { id: c.id, year: d.year, name: full(p), me: c.member_id === id, status: c.status === 'übernommen' ? 'fertig' : c.status, reason: c.status === 'abgelehnt' ? c.reason || null : null, created_at: c.created_at, signed_at: d.signed_at || null, pdf: Boolean(d.document_id) };
    });
    return { can: Boolean(E.bescheinigung), people: people.map(p => ({ id: p.id, name: full(p), me: p.id === id, years: yearsFor(p) })).filter(p => p.years.length), list };
  };
  M.post('/bescheinigung', C.rateLimit('mvbesch', 10, 3600000), ar(async (req, res) => {
    if (!store.appPerms().edit.bescheinigung) return bad(res, 'Eine Bescheinigung bitte direkt beim Vorstand anfragen – in der App ist das nicht freigeschaltet.', 403);
    const me = req.member.id, b = req.body || {};
    const who = forWhom(me).find(p => p.id === (b.member_id ? int(b.member_id) : me));
    if (!who) return bad(res, 'Für diese Person kannst du keine Bescheinigung anfordern.', 403);
    const year = int(b.year);
    if (!yearsFor(who).includes(year)) return bad(res, 'Für dieses Jahr kann der Verein keine Mitgliedschaft bescheinigen.');
    if (db.prepare("SELECT 1 FROM mv_change WHERE kind = ? AND member_id = ? AND status = 'offen' AND json_extract(data, '$.year') = ?").get(KIND, who.id, year)) return bad(res, `Die Bescheinigung für ${year} liegt dem Vorstand schon vor.`);
    const note = one(b.note, 120) || null;
    const id = Number(db.prepare('INSERT INTO mv_change(member_id, kind, data) VALUES (?, ?, ?)').run(who.id, KIND, JSON.stringify({ year, note, requested_by: me })).lastInsertRowid);
    store.hist(who.id, 'Mitglieder-App', 'Bescheinigung angefordert', null, String(year));
    const by = personRow(me) || {};
    if (sh.notifyBoard) sh.notifyBoard(`Mitglieder-App: Bescheinigung angefordert von ${full(by)}`, [who.id === me ? `${full(by)} hat in der Mitglieder-App eine Mitgliedsbescheinigung für ${year} angefordert.` : `${full(by)} hat in der Mitglieder-App eine Mitgliedsbescheinigung für ${year} für ${full(who)} angefordert.`, note ? `Hinweis: ${note}` : '', '', 'Bitte in der Verwaltung unter Mitglieder → Anträge unterschreiben und senden.'].filter((l, i) => l || i !== 1)).catch(() => {});
    C.audit(null, 'Mitglieder-App: Bescheinigung angefordert', who.id === me ? `${full(who)} (${year})` : `${full(who)} (${year}), angefordert von ${full(by)}`);
    res.json({ ok: true, id });
  }));
  M.get('/bescheinigung/:id/pdf', (req, res) => {
    const ids = forWhom(req.member.id).map(p => p.id);
    const c = db.prepare("SELECT * FROM mv_change WHERE id = ? AND kind = ? AND status = 'übernommen'").get(int(req.params.id), KIND);
    const d = c ? JSON.parse(c.data || '{}') : {};
    if (!c || !ids.includes(c.member_id) || !d.document_id) return bad(res, 'Nicht gefunden.', 404);
    const doc = db.prepare('SELECT * FROM mv_document WHERE id = ? AND member_id = ?').get(d.document_id, c.member_id);
    const f = doc && sh.docFile(doc);
    if (!f) return bad(res, 'Die Bescheinigung liegt nicht mehr vor – bitte beim Vorstand nachfragen.', 404);
    let buf; try { buf = C.require('./vault').readFile(f); } catch (e) { return bad(res, e.message, e.vaultLocked ? 423 : 500); }
    res.set({ 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(buf);
  });

  /** Datenauskunft (Art. 15 DSGVO): Anforderungen für diese Person – ohne interne Kennungen */
  sh.certificatesOf = id => db.prepare('SELECT * FROM mv_change WHERE kind = ? AND member_id = ? ORDER BY id').all(KIND, id).map(c => {
    const d = JSON.parse(c.data || '{}');
    return { jahr: d.year, hinweis: d.note || null, angefordert: c.created_at, status: c.status === 'übernommen' ? 'unterschrieben' : c.status, unterschrieben_von: d.signer ? [d.signer, d.role].filter(Boolean).join(', ') : null, erledigt: c.reviewed_at || null, grund: c.reason || null };
  });

  /* ---------- Verwaltung ---------- */
  sh.certificateView = (c, user, scoped) => {
    const d = JSON.parse(c.data || '{}');
    const p = personRow(c.member_id) || {}, by = d.requested_by && d.requested_by !== c.member_id ? personRow(d.requested_by) : null, to = personRow(recipientOf(c.member_id)) || {};
    return { year: d.year, note: d.note || null, by: by ? lastFirst(by.name) : null, to: to.id !== p.id ? lastFirst(to.name) : null, mail: Boolean(to.email), canSign: !scoped && user.perms.includes('mitglieder'), stamp: Boolean(stamp()), role: roleFor(user), signer: user.name || user.username };
  };
  const roleKey = user => `cert_role_${int(user.id)}`;
  /** Funktion des Unterschreibenden: zuletzt benutzt, sonst ein laufendes Amt des verknüpften Mitglieds */
  function roleFor(user) {
    const last = S(roleKey(user)); if (last) return last;
    const f = user.member_id ? db.prepare('SELECT name FROM mv_function WHERE member_id = ? AND (to_date IS NULL OR to_date >= ?) ORDER BY from_date DESC LIMIT 1').get(user.member_id, today()) : null;
    return f ? f.name : '';
  }
  const openCert = id => db.prepare("SELECT * FROM mv_change WHERE id = ? AND kind = ?").get(int(id), KIND);
  admin.get('/changes/:id/preview.pdf', P, ar(async (req, res) => {
    const c = openCert(req.params.id); if (!c) return bad(res, 'Nicht gefunden.', 404);
    const x = content(c.member_id, JSON.parse(c.data || '{}').year);
    if (!x) return bad(res, 'Für dieses Jahr lässt sich keine Mitgliedschaft bescheinigen (Eintritt/Austritt prüfen).');
    const buf = await pdf.certificate(club(), { ...x, date: today(), stamp: stamp(), preview: true });
    res.set({ 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(buf);
  }));
  /** Unterschreiben & senden – Aufruf aus POST /changes/:id/accept (lib/memberapp.js) */
  sh.signCertificate = async (req, res, c) => {
    if (req.mvScope) return bad(res, 'Bescheinigungen unterschreibt die Vereinsverwaltung.', 403);
    const b = req.body || {}, d = JSON.parse(c.data || '{}');
    if (!sigOk(b.signature)) return bad(res, 'Bitte unterschreiben.');
    const signer = one(b.signer, 70), role = one(b.role, 60);
    if (signer.length < 3) return bad(res, 'Bitte den Namen des Unterschreibenden eintragen.');
    if (!role) return bad(res, 'Bitte die Funktion eintragen (z. B. 1. Vorsitzende).');
    const st = stamp(); if (!st) return bad(res, 'Bitte zuerst den Vereinsstempel hochladen (Mitglieder › Einstellungen › Bescheinigung).');
    const x = content(c.member_id, d.year); if (!x) return bad(res, 'Für dieses Jahr lässt sich keine Mitgliedschaft bescheinigen (Eintritt/Austritt prüfen).');
    const at = nowTs();
    const buf = await pdf.certificate(club(), { ...x, date: at.slice(0, 10), signature: b.signature, signer, role, stamp: st });
    const fname = `Mitgliedsbescheinigung ${d.year} ${x.name}`.replace(/[^\wäöüÄÖÜß .-]+/g, '_').slice(0, 100) + '.pdf';
    const by = uname(req);
    // Erst prüfen, ob noch offen (zwei gleichzeitige Klicks), dann Dokument und Status in einem Zug
    const docId = db.transaction(() => {
      if (!db.prepare("SELECT 1 FROM mv_change WHERE id = ? AND status = 'offen'").get(c.id)) return null;
      const id = saveDocument(c.member_id, buf, { kind: 'bescheinigung', title: fname, filename: fname, user: by });
      db.prepare("UPDATE mv_change SET status = 'übernommen', reviewed_by = ?, reviewed_at = ?, data = ?, signature = NULL WHERE id = ?").run(by, at, JSON.stringify({ ...d, document_id: id, signer, role, signed_at: at }), c.id);
      return id;
    })();
    if (!docId) return bad(res, 'Diese Anforderung ist schon erledigt.', 404);
    SET(roleKey(req.user), role);
    store.hist(c.member_id, by, 'Bescheinigung', null, `${d.year} unterschrieben (${signer}, ${role})`);
    C.audit(req.user, 'Mitglied: Bescheinigung unterschrieben und gesendet', `${lastFirst(x.person.name)} (${d.year})`);
    const rid = recipientOf(c.member_id), r = personRow(rid) || {};
    let mailed = false;
    if (r.email && C.mail.ready()) {
      try {
        await C.mail.send({ to: r.email, subject: `Mitgliedsbescheinigung ${d.year} – ${club().name}`,
          text: [`Guten Tag ${full(r)},`, '', rid !== c.member_id ? `anbei die Mitgliedsbescheinigung ${d.year} für ${x.name} zur Vorlage bei der Krankenkasse.` : `anbei Ihre Mitgliedsbescheinigung ${d.year} zur Vorlage bei der Krankenkasse.`, 'Sie ist auch in der Mitglieder-App unter „Meine Daten“ abrufbar.', '', 'Viele Grüße', club().name].join('\n'),
          attachments: [{ filename: fname, content: buf, contentType: 'application/pdf' }], log: { art: 'antrag', by: req.user, memberId: rid, name: r.name, via: rid !== c.member_id ? 'Familienoberhaupt' : undefined } });
        mailed = true;
      } catch (e) { console.error('Bescheinigung – E-Mail:', e.message); }
    }
    C.push.send([...new Set([rid, c.member_id])], KIND, { title: 'Deine Mitgliedsbescheinigung ist da', body: 'Du findest sie in der App unter „Meine Daten“.', url: './#mitglieder', tag: `bescheinigung-${c.id}` }).catch(e => console.error('Bescheinigung – Push:', e.message));
    res.json({ ok: true, mailed, document_id: docId });
  };
  /** Ablehnen – Aufruf aus POST /changes/:id/reject: E-Mail an Mitglied bzw. Oberhaupt mit Grund */
  sh.rejectCertificate = async (req, c, reason) => {
    const d = JSON.parse(c.data || '{}'), p = personRow(c.member_id) || {}, rid = recipientOf(c.member_id), r = personRow(rid) || {};
    store.hist(c.member_id, uname(req), 'Bescheinigung abgelehnt', String(d.year), reason || null);
    C.audit(req.user, 'Mitglied: Bescheinigung abgelehnt', `${lastFirst(p.name)} (${d.year})`);
    if ((req.body || {}).notify === false || !r.email || !C.mail.ready()) return false;
    try {
      await C.mail.send({ to: r.email, subject: `Ihre Anfrage: Mitgliedsbescheinigung ${d.year} – ${club().name}`,
        text: [`Guten Tag ${full(r)},`, '', rid !== c.member_id ? `die angeforderte Mitgliedsbescheinigung ${d.year} für ${full(p)} können wir leider nicht ausstellen.` : `die angeforderte Mitgliedsbescheinigung ${d.year} können wir leider nicht ausstellen.`, reason ? `Grund: ${reason}` : 'Bitte sprechen Sie uns kurz an.', '', 'Viele Grüße', club().name].join('\n'),
        log: { art: 'antrag', by: req.user, memberId: rid, name: r.name } });
      return true;
    } catch (e) { console.error('Bescheinigung – E-Mail:', e.message); return false; }
  };

  /* Demo: erledigte Beispiel-Bescheinigungen (Dokument „demob_<n>.pdf“) als echtes PDF anlegen – mit erfundener Unterschrift aus demo/unterschrift.png */
  async function demoCertificates() {
    if (!C.getSetting('demo_build', '') || C.require('./vault').locked()) return;
    const path = require('path'), fs = require('fs');
    const sig = (() => { try { return 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'demo', 'unterschrift.png')).toString('base64'); } catch (e) { return null; } })();
    for (const c of db.prepare("SELECT * FROM mv_change WHERE kind = ? AND status = 'übernommen'").all(KIND)) {
      const d = JSON.parse(c.data || '{}'), doc = d.document_id && db.prepare("SELECT * FROM mv_document WHERE id = ? AND file LIKE 'demob!_%' ESCAPE '!'").get(d.document_id);
      if (!doc) continue;
      const f = path.join(sh.docDir(), path.basename(doc.file));
      if (fs.existsSync(f)) continue;
      const x = content(c.member_id, d.year); if (!x) continue;
      const buf = await pdf.certificate(club(), { ...x, date: String(d.signed_at || c.reviewed_at || today()).slice(0, 10), signature: sig, signer: d.signer, role: d.role, stamp: stamp() });
      fs.mkdirSync(sh.docDir(), { recursive: true, mode: 0o700 });
      C.require('./vault').writeFile(f, buf);
      db.prepare('UPDATE mv_document SET size = ?, sha256 = ? WHERE id = ?').run(buf.length, store.sha256(buf), doc.id);
    }
  }
  const demo = () => demoCertificates().catch(e => console.error('Demo-Bescheinigungen:', e.message));
  demo(); C.require('./vault').onUnlock(demo);

  // Push-Anlass zentral anmelden (Vorstand gibt ihn frei, das Mitglied schaltet nur je Handy) – neben den Gratulationen (lib/congrats.js)
  const before = C.hooks.pushEvents;
  C.hooks.pushEvents = () => [...(typeof before === 'function' ? before() : []), { id: KIND, label: 'Mitgliedsbescheinigung ist da', desc: 'Sobald der Vorstand eine angeforderte Bescheinigung unterschrieben hat – an die Person und bei Familien an das Oberhaupt.', default: true }];
}

module.exports = { register };
