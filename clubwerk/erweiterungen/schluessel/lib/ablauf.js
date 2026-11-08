'use strict';
/* Ausgabe, Rücknahme, Verlust, Storno, Erinnerung, Übernahme alter Nummern, Tablet-Weg mit Code, Protokolle und Excel. */
const crypto = require('crypto');
const path = require('path');

function register(sh) {
  const { ctx, A, T, P, db, S, SET, cfg, send, fail, txt, one, euro, mailOk, ageAt, memberRow, personName, personBirth, memberInfo, stateOf, emailOf, clubInfo, itemsOf, pieceText, nextNo,
    renderTerms, savePdf, fileOk, hashOf, sigsOf, vault, DIR, pdf, mitgl, hook1, lastFirst, today, nowTs, deD, isDate, sigOk } = sh;
  const { bad, int, audit } = ctx;
  const ar = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => { if (!res.headersSent) bad(res, e.message, e.code || 400); });

  /* ---------- Ansicht ---------- */
  const openItems = items => items.filter(x => x.state === 'ausgegeben');
  function reclaimOf(i, items) {
    if (i.status !== 'ausgegeben' || !openItems(items).length) return { reclaim: false, reclaim_text: '', reason: '' };
    const st = stateOf(i);
    if (st) return { reclaim: true, reason: 'ausgetreten', reclaim_text: st.exit_date && st.exit_date > today() ? ctx.T('tritt zum {0} aus', [deD(st.exit_date)]) : 'ausgetreten' };
    if (i.due && i.due < today()) return { reclaim: true, reason: 'ueberfaellig', reclaim_text: ctx.T('Rückgabe war fällig am {0}', [deD(i.due)]) };
    return { reclaim: false, reclaim_text: '', reason: '' };
  }
  function issueView(i) {
    const items = itemsOf(i.id), ap = db.prepare("SELECT id, no FROM sl_protocol WHERE issue_id = ? AND kind = 'ausgabe' ORDER BY id LIMIT 1").get(i.id);
    return { id: i.id, no: ap ? ap.no : '', protocol: ap ? ap.id : null, status: i.status, person: personName(i), member_id: i.member_id || null, ext: !i.member_id, legacy: Boolean(i.legacy), legacy_no: i.legacy_no || '',
      waiting: i.status === 'wartet', code_expired: i.status === 'wartet' && (i.code_expires || 0) < Date.now(),
      pieces: items.map(x => ({ id: x.id, label: x.label, ident: x.ident, name: x.name, state: x.state, sensitive: Boolean(x.sensitive), type_id: x.type_id })),
      issued_at: i.issued_at, due: i.due || '', deposit_cents: i.deposit_cents, deposit_state: i.deposit_state, cost_cents: i.cost_cents, issued_by: i.issued_by || '', closed_at: i.closed_at || '', ...reclaimOf(i, items) };
  }
  A.get('/issues', P, (req, res) => {
    const f = String(req.query.filter || 'alle');
    let rows = db.prepare(`SELECT * FROM sl_issue WHERE status ${f === 'abgeschlossen' ? "IN ('zurueck','storniert')" : "IN ('wartet','ausgegeben','signiere')"} ORDER BY id DESC LIMIT 1000`).all().map(issueView);
    const all = rows;
    if (f === 'reclaim') rows = rows.filter(r => r.reclaim);
    else if (f === 'befristet') rows = rows.filter(r => r.due);
    else if (f === 'pfand') rows = rows.filter(r => r.deposit_state === 'gehalten');
    rows.sort((a, b) => a.person.localeCompare(b.person, 'de') || a.id - b.id);
    res.json({ list: rows, counts: { alle: all.length, reclaim: all.filter(r => r.reclaim).length, befristet: all.filter(r => r.due).length, pfand: all.filter(r => r.deposit_state === 'gehalten').length } });
  });
  A.get('/issues/:id', P, send(req => { const i = db.prepare('SELECT * FROM sl_issue WHERE id = ?').get(int(req.params.id)); if (!i) throw fail('Nicht gefunden.', 404); return { ...issueView(i), protocols: db.prepare('SELECT id, no, kind, at, status FROM sl_protocol WHERE issue_id = ? ORDER BY id').all(i.id) }; }));
  A.put('/issues/:id', P, (req, res) => bad(res, 'Ein abgeschlossenes Protokoll lässt sich nicht ändern. Bei einem Fehler bitte stornieren und neu ausgeben.'));
  A.get('/meta', P, (req, res) => res.json({ user: (req.user && (req.user.name || req.user.username)) || '', cfg: cfg(), mailReady: ctx.mail.ready(), mitglieder: mitgl(), adoptable: adoptable().length, today: today(), club: ctx.getSetting('club_name', 'Verein'), max: euro(cfg().max_cost_cents), frist: `${Math.round(cfg().keep_ohnepfand / 12)} ${Math.round(cfg().keep_ohnepfand / 12) === 1 ? 'Jahr' : 'Jahre'}`, kinds: sh.KINDS }));
  A.get('/people', P, (req, res) => {
    const q = String(req.query.q || '').trim().replace(/\s+/g, ' ').toLowerCase(); if (q.length < 2) return res.json({ list: [] });
    const like = '%' + q.replace(/[%_\\]/g, m => '\\' + m) + '%';
    res.json({ list: db.prepare("SELECT id, name, kind FROM members WHERE kind IN ('mitglied','nichtmitglied') AND deleted = 0 AND active = 1 AND pending = 0 AND lower(name) LIKE ? ESCAPE '\\' LIMIT 40").all(like)
      .map(m => ({ id: m.id, name: lastFirst(m.name, m.kind), kind: m.kind, minor: ageAt(personBirth({ member_id: m.id }), today()) < 18 })).sort((a, b) => a.name.localeCompare(b.name, 'de')).slice(0, 20) });
  });
  A.get('/protocols', P, (req, res) => {
    const rows = db.prepare(`SELECT p.id, p.no, p.kind, p.at, p.status, p.issue_id, p.file IS NOT NULL AS pdf, i.member_id, i.ext_first, i.ext_last FROM sl_protocol p JOIN sl_issue i ON i.id = p.issue_id ORDER BY p.id DESC LIMIT 1000`).all();
    res.json({ list: rows.map(r => ({ id: r.id, no: r.no, kind: r.kind, at: r.at, status: r.status, cancelled: r.status === 'storniert', issue_id: r.issue_id, pdf: Boolean(r.pdf), person: personName(r) })) });
  });

  /* ---------- Protokoll-PDF und Unterschriften ---------- */
  function sendPdf(res, p) {
    if (!p || !fileOk(p.file)) return res.status(404).json({ error: 'Zu diesem Eintrag gibt es noch kein Protokoll.' });
    let buf; try { buf = vault.readFile(path.join(DIR, p.file)); } catch (e) { return res.status(e.vaultLocked ? 423 : 404).json({ error: e.vaultLocked ? 'Der Tresor ist gesperrt.' : 'Die Datei fehlt.' }); }
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Schluessel-${p.no}.pdf"`, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" }).send(buf);
  }
  A.get('/issues/:id/pdf', P, (req, res) => sendPdf(res, db.prepare("SELECT * FROM sl_protocol WHERE issue_id = ? AND kind = 'ausgabe' ORDER BY id LIMIT 1").get(int(req.params.id))));
  A.get('/protocols/:id/pdf', P, (req, res) => sendPdf(res, db.prepare('SELECT * FROM sl_protocol WHERE id = ?').get(int(req.params.id))));
  const sigsRes = (res, p) => p ? res.json({ no: p.no, sigs: [p.sig_a, p.sig_b, p.sig_c].filter(Boolean) }) : res.status(404).json({ error: 'Nicht gefunden.' });
  A.get('/issues/:id/signatures', P, (req, res) => sigsRes(res, db.prepare("SELECT * FROM sl_protocol WHERE issue_id = ? AND kind = 'ausgabe' ORDER BY id LIMIT 1").get(int(req.params.id))));
  A.get('/protocols/:id/signatures', P, (req, res) => sigsRes(res, db.prepare('SELECT * FROM sl_protocol WHERE id = ?').get(int(req.params.id))));

  /* ---------- E-Mail ---------- */
  async function mailProtocol(i, p, buf, subject, intro) {
    try {
      if (!cfg().mail_on || !ctx.mail.ready()) return false;
      const to = await emailOf(i); if (!to) return false;
      const club = ctx.getSetting('club_name', 'Verein'), cc = cfg().cc;
      await ctx.mail.send({ to, cc: cc || undefined, subject: `${subject} ${p.no} – ${club}`,
        text: [`Guten Tag ${personName(i).split(', ').reverse().join(' ')},`, '', intro, '', `Das Protokoll ${p.no} finden Sie als PDF im Anhang. Bitte bewahren Sie es auf.`, '', 'Viele Grüße', club].join('\n'),
        attachments: [{ filename: `Schluessel-${p.no}.pdf`, content: buf }] });
      return true;
    } catch (e) { console.error('Schlüssel – Mail:', e.message); return false; }
  }

  /* ---------- Ausgabe ---------- */
  function personIn(b) {
    if (b.member_id) {
      const m = memberRow(int(b.member_id));
      if (!m || !['mitglied', 'nichtmitglied'].includes(m.kind)) throw fail('Dieses Konto gibt es nicht.');
      return { member_id: m.id };
    }
    const p = b.person || {}, first = one(p.first_name, 60), last = one(p.last_name, 60), contact = one(p.contact, 120);
    if (first.length < 1 || last.length < 2) throw fail('Bitte Vor- und Nachname der Person eintragen.');
    if (contact.length < 3) throw fail('Bitte einen Kontakt (Telefon oder E-Mail) eintragen.');
    if (p.birth_date && (!isDate(p.birth_date) || p.birth_date > today())) throw fail('Das Geburtsdatum stimmt nicht.');
    return { ext_first: first, ext_last: last, contact, ext_birth: p.birth_date || null };
  }
  /** Ausgabe anlegen: Stücke werden reserviert, Status „wartet“ (Tablet) bzw. „signiere“ (gleich in der Verwaltung) */
  function createIssue(req, status) {
    const b = req.body || {};
    const who = personIn(b);
    const ids = [...new Set((Array.isArray(b.pieces) ? b.pieces : []).map(Number))].filter(n => Number.isInteger(n) && n > 0);
    if (!ids.length) throw fail('Bitte mindestens einen Schlüssel wählen.');
    if (ids.length > 20) throw fail('Höchstens 20 Stück auf einmal.');
    const tpl = db.prepare('SELECT id FROM sl_template WHERE id = ?').get(int(b.template_id)) || db.prepare('SELECT id FROM sl_template ORDER BY sort, id LIMIT 1').get();
    const due = b.due ? String(b.due) : null; if (due && (!isDate(due) || due < today())) throw fail('Das Rückgabedatum muss heute oder später sein.');
    const deposit = int(b.deposit_cents); if (!(deposit >= 0 && deposit <= 100000)) throw fail('Das Pfand muss zwischen 0 und 1000 € liegen.');
    const by = one(b.issued_by, 60) || (req.user && (req.user.name || req.user.username)) || ''; if (by.length < 2) throw fail('Bitte eintragen, wer den Schlüssel ausgibt.');
    const probe = { member_id: who.member_id || null, ext_birth: who.ext_birth || null };
    const minor = ageAt(personBirth(probe), today()) < 18;
    const guardian = one(b.guardian_name, 70);
    if (minor && guardian.length < 3) throw fail('Die Person ist minderjährig – bitte den Namen der erziehungsberechtigten Person eintragen.');
    const code = status === 'wartet' ? String(crypto.randomInt(100000, 1000000)) : null;
    const id = db.transaction(() => {
      for (const pid of ids) { const p = db.prepare('SELECT status FROM sl_piece WHERE id = ?').get(pid); if (!p) throw fail('Dieses Stück gibt es nicht.'); if (p.status !== 'vorraetig') throw fail('Ein gewähltes Stück ist nicht vorrätig.'); }
      const iid = Number(db.prepare(`INSERT INTO sl_issue(member_id, ext_first, ext_last, ext_birth, contact, guardian_name, status, issued_by, due, deposit_cents, template_id, code_hash, code_expires, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(who.member_id || null, who.ext_first || null, who.ext_last || null, who.ext_birth || null, who.contact || null, minor ? guardian : null, status, by, due, deposit, tpl.id,
        code ? codeHash(code) : null, code ? Date.now() + 3 * 3600000 : null, (req.user && (req.user.name || req.user.username)) || null).lastInsertRowid);
      for (const pid of ids) { db.prepare("INSERT INTO sl_issue_piece(issue_id, piece_id, state) VALUES (?,?,'reserviert')").run(iid, pid); db.prepare("UPDATE sl_piece SET status = 'reserviert' WHERE id = ?").run(pid); }
      return iid;
    })();
    return { id, code, minor };
  }
  /* Code für die Unterschrift am Tablet (6 Ziffern, 3 Std.): gesalzen (scrypt) wie PINs, Nachschlagen über die wenigen wartenden Ausgaben (planung/geheimnisse.md) */
  const codeHash = c => ctx.auth.hashSecret('slcode:' + c);
  const issueByCode = code => db.prepare("SELECT * FROM sl_issue WHERE status = 'wartet' AND code_hash IS NOT NULL AND code_expires > ? ORDER BY id DESC LIMIT 200").all(Date.now())
    .find(i => ctx.auth.verifySecret('slcode:' + code, i.code_hash)) || null;
  function release(id) {   // Reservierung aufheben (Fehler oder Abbruch)
    db.prepare("UPDATE sl_piece SET status = 'vorraetig' WHERE status = 'reserviert' AND id IN (SELECT piece_id FROM sl_issue_piece WHERE issue_id = ?)").run(id);
    db.prepare('DELETE FROM sl_issue_piece WHERE issue_id = ?').run(id);
  }

  /** Unterschrift abschließen: Text einfrieren, Prüfwert, PDF einmal bauen, Stücke ausgeben, Protokoll speichern, E-Mail */
  async function finalizeIssue(id, sigs, by, via) {
    const lock = db.prepare("UPDATE sl_issue SET status = 'signiere' WHERE id = ? AND status IN ('wartet','signiere')").run(id);
    if (!lock.changes) throw fail('Diese Ausgabe wartet nicht (mehr) auf eine Unterschrift.');
    try {
      const i = db.prepare('SELECT * FROM sl_issue WHERE id = ?').get(id);
      const tpl = db.prepare('SELECT * FROM sl_template WHERE id = ?').get(i.template_id) || db.prepare('SELECT * FROM sl_template ORDER BY sort, id LIMIT 1').get();
      const terms = renderTerms(tpl.text), at = nowTs(), items = itemsOf(id), person = personName(i), no = nextNo();
      const deposit = i.deposit_cents > 0 ? `${euro(i.deposit_cents)} bar erhalten` : 'kein Pfand';
      const data = { person, issued_by: i.issued_by, due: i.due || '', deposit, items: items.map(x => ({ ident: x.ident, label: x.label, name: x.name, opens: x.opens || '' })), via, guardian: i.guardian_name || '' };
      const sha = hashOf({ no, at, data, terms, sigs });
      const sigList = [{ label: 'Empfänger/in', name: person, png: sigs[0] }, { label: 'Ausgegeben von', name: i.issued_by, png: sigs[1] }];
      if (sigs[2]) sigList.push({ label: 'Erziehungsberechtigte/r', name: i.guardian_name, png: sigs[2] });
      const buf = await pdf.build({ no, at, kind: 'ausgabe', title: 'Schlüsselübergabe', club: clubInfo(), person, contactShown: !i.member_id ? i.contact : '', issuedBy: i.issued_by, items: data.items,
        extra: [['Rückgabe bis', i.due ? deD(i.due) : 'unbefristet, spätestens beim Austritt'], ['Pfand', deposit]], terms, sigs: sigList, sha256: sha });
      const file = savePdf(buf);
      const pid = db.transaction(() => {
        const ids = items.map(x => x.id);
        db.prepare("UPDATE sl_issue SET status = 'ausgegeben', issued_at = ?, code_hash = NULL, code_expires = NULL, deposit_state = ? WHERE id = ?").run(at, i.deposit_cents > 0 ? 'gehalten' : '', id);
        db.prepare(`UPDATE sl_issue_piece SET state = 'ausgegeben' WHERE issue_id = ?`).run(id);
        db.prepare(`UPDATE sl_piece SET status = 'ausgegeben' WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
        return Number(db.prepare("INSERT INTO sl_protocol(no, kind, issue_id, at, terms, data, sig_a, sig_b, sig_c, sha256, file, by_user) VALUES (?, 'ausgabe', ?,?,?,?,?,?,?,?,?,?)")
          .run(no, id, at, terms, JSON.stringify(data), sigs[0], sigs[1], sigs[2] || null, sha, file, by || null).lastInsertRowid);
      })();
      audit(null, 'Schlüssel: Ausgabe', `${person}: ${items.map(pieceText).join(', ')} (${no}, ${via === 'tablet' ? 'am Tablet' : 'in der Verwaltung'})`);
      mailProtocol(i, { no }, buf, 'Schlüsselübergabe', `Sie haben vom ${ctx.getSetting('club_name', 'Verein')} folgende Schlüssel erhalten: ${items.map(pieceText).join(', ')}.`).catch(() => {});
      return { id, no, protocol: pid, sha256: sha };
    } catch (e) {
      const row = db.prepare('SELECT status FROM sl_issue WHERE id = ?').get(id);
      if (row && row.status === 'signiere') db.prepare("UPDATE sl_issue SET status = 'wartet' WHERE id = ?").run(id);
      throw e;
    }
  }
  A.post('/issues', P, send(async req => {
    const b = req.body || {};
    if (b.how === 'tablet') {
      const r = createIssue(req, 'wartet');
      audit(req.user, 'Schlüssel: Übergabe zur Unterschrift ans Tablet', personName(db.prepare('SELECT * FROM sl_issue WHERE id = ?').get(r.id)));
      return { id: r.id, code: r.code, expires_in_min: 180, minor: r.minor };
    }
    // gleich hier: Haken und Unterschriften vorab prüfen, bevor etwas reserviert wird
    if (!b.agreed) throw fail('Bitte bestätigen, dass die Bedingungen gelesen wurden und die Person einverstanden ist.');
    const probe = b.member_id ? { member_id: int(b.member_id) } : { ext_birth: (b.person || {}).birth_date };
    const minor = ageAt(personBirth(probe), today()) < 18;
    const sigs = sigsOf(b, minor);
    const r = createIssue(req, 'signiere');
    try { return await finalizeIssue(r.id, sigs, (req.user && (req.user.name || req.user.username)) || '', 'verwaltung'); }
    catch (e) { release(r.id); db.prepare('DELETE FROM sl_issue WHERE id = ?').run(r.id); throw e; }
  }));
  A.post('/issues/:id/code', P, send(req => {
    const i = db.prepare("SELECT * FROM sl_issue WHERE id = ? AND status = 'wartet'").get(int(req.params.id)); if (!i) throw fail('Diese Ausgabe wartet nicht auf eine Unterschrift.');
    const code = String(crypto.randomInt(100000, 1000000));
    db.prepare('UPDATE sl_issue SET code_hash = ?, code_expires = ? WHERE id = ?').run(codeHash(code), Date.now() + 3 * 3600000, i.id);
    return { code, expires_in_min: 180 };
  }));
  A.delete('/issues/:id', P, send(req => {
    const i = db.prepare("SELECT * FROM sl_issue WHERE id = ? AND status = 'wartet'").get(int(req.params.id)); if (!i) throw fail('Nur Ausgaben, die noch auf die Unterschrift warten, lassen sich verwerfen.');
    db.transaction(() => { release(i.id); db.prepare('DELETE FROM sl_issue WHERE id = ?').run(i.id); })();
    audit(req.user, 'Schlüssel: Übergabe verworfen', personName(i));
    return { ok: true };
  }));

  /* ---------- Rücknahme, Verlust, Storno ---------- */
  function openIssue(req) {
    const i = db.prepare('SELECT * FROM sl_issue WHERE id = ?').get(int(req.params.id)); if (!i) throw fail('Nicht gefunden.', 404);
    if (i.status !== 'ausgegeben') throw fail('Diese Ausgabe ist nicht (mehr) offen.');
    return i;
  }
  const pickPieces = (i, b) => {
    const open = openItems(itemsOf(i.id)), want = Array.isArray(b.piece_ids) ? b.piece_ids.map(Number) : open.map(x => x.id);
    const sel = want.map(id => open.find(x => x.id === id));
    if (!sel.length || sel.some(x => !x)) throw fail('Bitte Stücke wählen, die noch ausgegeben sind.');
    return sel;
  };
  const refProtocol = i => db.prepare("SELECT id, no FROM sl_protocol WHERE issue_id = ? AND kind = 'ausgabe' ORDER BY id LIMIT 1").get(i.id) || {};
  function sigObj(b, key, label, name) { return sigOk(b[key]) ? { label, name, png: b[key] } : null; }
  /** gemeinsamer Abschluss für Rückgabe, Verlust und Storno: PDF bauen, Protokoll speichern */
  async function writeProtocol({ i, kind, title, items, extra, sigs, by, ref, state, close, mailText }) {
    const at = nowTs(), no = nextNo(), person = personName(i);
    const data = { person, kind, items: items.map(x => ({ ident: x.ident, label: x.label, name: x.name })), extra };
    const sha = hashOf({ no, at, data, sigs: sigs.map(s => s.png) });
    const buf = await pdf.build({ no, at, kind, title, club: clubInfo(), person, contactShown: !i.member_id ? i.contact : '', issuedBy: by, items: items.map(x => ({ ident: x.ident, label: x.label, name: x.name, opens: x.opens || '' })), extra, sigs, sha256: sha, refNo: ref.no });
    const file = savePdf(buf);
    const pid = db.transaction(() => {
      state();
      const left = db.prepare("SELECT COUNT(*) n FROM sl_issue_piece WHERE issue_id = ? AND state = 'ausgegeben'").get(i.id).n;
      if (close || !left) db.prepare("UPDATE sl_issue SET status = ?, closed_at = ? WHERE id = ?").run(close || 'zurueck', at, i.id);
      return Number(db.prepare('INSERT INTO sl_protocol(no, kind, issue_id, ref_id, at, data, sig_a, sig_b, sig_c, sha256, file, by_user) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(no, kind, i.id, ref.id || null, at, JSON.stringify(data), sigs[0] ? sigs[0].png : null, sigs[1] ? sigs[1].png : null, null, sha, file, by || null).lastInsertRowid);
    })();
    mailProtocol(i, { no }, buf, title, mailText).catch(() => {});
    return { no, protocol: pid, sha256: sha };
  }
  A.post('/issues/:id/return', P, send(async req => {
    const i = openIssue(req), b = req.body || {}, items = pickPieces(i, b), by = (req.user && (req.user.name || req.user.username)) || '';
    if (!sigOk(b.sig_taker)) throw fail('Bitte die Unterschrift der annehmenden Person leisten.');
    const cond = b.condition === 'beschaedigt' ? 'beschaedigt' : 'ok', note = one(b.note, 200);
    if (cond === 'beschaedigt' && note.length < 3) throw fail('Bitte kurz eintragen, was beschädigt ist.');
    const back = ['zurueck', 'einbehalten'].includes(b.deposit_back) ? b.deposit_back : '';
    const depNote = one(b.deposit_note, 200);
    if (back === 'einbehalten' && depNote.length < 3) throw fail('Bitte eintragen, warum das Pfand einbehalten wird.');
    const sigs = [sigObj(b, 'sig_taker', 'Angenommen von', by), sigObj(b, 'sig_giver', 'Zurückgegeben von', personName(i))].filter(Boolean);
    const extra = [['Zustand', cond === 'ok' ? 'in Ordnung' : `beschädigt: ${note}`]];
    if (i.deposit_cents > 0) extra.push(['Pfand', back === 'zurueck' ? `${euro(i.deposit_cents)} bar zurückgezahlt` : back === 'einbehalten' ? `${euro(i.deposit_cents)} einbehalten: ${depNote}` : `${euro(i.deposit_cents)} – noch nicht erstattet`]);
    const r = await writeProtocol({ i, kind: 'rueckgabe', title: 'Rückgabe', items, extra, sigs, by, ref: refProtocol(i), mailText: `Wir haben folgende Schlüssel von Ihnen zurückerhalten: ${items.map(pieceText).join(', ')}. Vielen Dank.`,
      state() {
        for (const x of items) {
          db.prepare("UPDATE sl_issue_piece SET state = 'zurueck', back_at = ?, cond = ? WHERE issue_id = ? AND piece_id = ?").run(nowTs(), cond, i.id, x.id);
          db.prepare("UPDATE sl_piece SET status = 'vorraetig', note = COALESCE(?, note) WHERE id = ?").run(cond === 'beschaedigt' ? `Rückgabe beschädigt: ${note}` : null, x.id);
        }
        if (back) db.prepare('UPDATE sl_issue SET deposit_state = ? WHERE id = ?').run(back, i.id);
      } });
    audit(req.user, 'Schlüssel: Rücknahme', `${personName(i)}: ${items.map(pieceText).join(', ')} (${r.no})`);
    return r;
  }));
  A.post('/issues/:id/lost', P, send(async req => {
    const i = openIssue(req), b = req.body || {}, items = pickPieces(i, b), by = (req.user && (req.user.name || req.user.username)) || '';
    if (!sigOk(b.sig_taker)) throw fail('Bitte die Unterschrift der annehmenden Person leisten.');
    const date = isDate(b.date) ? b.date : today(); if (date > today()) throw fail('Das Datum liegt in der Zukunft.');
    const circ = txt(b.circumstances, 500); if (circ.length < 3) throw fail('Bitte kurz eintragen, wie es zum Verlust kam.');
    const cost = int(b.cost_cents); if (!(cost >= 0 && cost <= 1000000)) throw fail('Die Kosten liegen zwischen 0 und 10 000 €.');
    const cs = ['bar', 'offen', 'keine'].includes(b.cost_state) ? b.cost_state : 'keine';
    const sigs = [sigObj(b, 'sig_taker', 'Angenommen von', by), sigObj(b, 'sig_person', 'Person', personName(i))].filter(Boolean);
    const extra = [['Datum des Verlusts', deD(date)], ['Umstände', circ], ['Kosten', cs === 'keine' || !cost ? 'keine' : `${euro(cost)} ${cs === 'bar' ? 'bar erhalten' : 'noch offen'}`]];
    const r = await writeProtocol({ i, kind: 'verlust', title: 'Verlustanzeige', items, extra, sigs, by, ref: refProtocol(i), mailText: `Wir haben den Verlust folgender Schlüssel vermerkt: ${items.map(pieceText).join(', ')}.`,
      state() {
        for (const x of items) { db.prepare("UPDATE sl_issue_piece SET state = 'verloren', back_at = ? WHERE issue_id = ? AND piece_id = ?").run(nowTs(), i.id, x.id); db.prepare("UPDATE sl_piece SET status = 'verloren', note = ? WHERE id = ?").run(`Verloren am ${deD(date)}`, x.id); }
        if (cost > 0) db.prepare('UPDATE sl_issue SET cost_cents = cost_cents + ? WHERE id = ?').run(cost, i.id);
      } });
    const sensitive = items.some(x => x.sensitive);
    const what = items.map(pieceText).join(', ');
    ctx.securityAlert(sensitive ? 'verlust_sicher' : 'verlust', `${sensitive ? 'Sicherheitsrelevanter Schlüssel' : 'Schlüssel'} als verloren gemeldet: ${what}, zuletzt bei ${personName(i)}. ${sensitive ? 'Bitte prüfen, ob das Schloss getauscht werden muss.' : ''}`.trim(), { key: `${i.id}:${items.map(x => x.id).join(',')}`, member: i.member_id || undefined });
    audit(req.user, 'Schlüssel: Verlust', `${personName(i)}: ${what} (${r.no})`);
    return r;
  }));
  A.post('/issues/:id/cancel', P, send(async req => {
    const i = openIssue(req), b = req.body || {}, by = (req.user && (req.user.name || req.user.username)) || '';
    const reason = one(b.reason, 200); if (reason.length < 3) throw fail('Bitte einen Grund für die Stornierung eintragen.');
    if (db.prepare("SELECT 1 FROM sl_protocol WHERE issue_id = ? AND kind IN ('rueckgabe','verlust')").get(i.id)) throw fail('Es gibt schon eine Rückgabe oder Verlustanzeige – bitte nicht stornieren, sondern weiterführen.');
    const items = itemsOf(i.id), ref = refProtocol(i);
    const sigs = [sigObj(b, 'sig_taker', 'Storniert von', by)].filter(Boolean);
    const r = await writeProtocol({ i, kind: 'storno', title: 'Stornierung der Ausgabe', items, extra: [['Grund', reason]], sigs, by, ref, close: 'storniert', mailText: `Die Ausgabe ${ref.no || ''} wurde storniert (${reason}).`,
      state() {
        db.prepare("UPDATE sl_issue_piece SET state = 'storniert' WHERE issue_id = ?").run(i.id);
        db.prepare(`UPDATE sl_piece SET status = 'vorraetig' WHERE id IN (${items.map(() => '?').join(',')})`).run(...items.map(x => x.id));
        if (ref.id) db.prepare("UPDATE sl_protocol SET status = 'storniert' WHERE id = ?").run(ref.id);
      } });
    audit(req.user, 'Schlüssel: Ausgabe storniert', `${personName(i)}: ${reason} (${r.no})`);
    return r;
  }));
  A.post('/issues/:id/remind', P, send(async req => {
    const i = openIssue(req), items = openItems(itemsOf(i.id));
    const to = await emailOf(i); if (!to) throw fail('Zu dieser Person gibt es keine E-Mail-Adresse.');
    if (!ctx.mail.ready()) throw fail('Es ist noch kein Postfach eingerichtet (Einstellungen › Postfach).');
    const club = ctx.getSetting('club_name', 'Verein');
    await ctx.mail.send({ to, subject: `Erinnerung: Schlüssel zurückgeben – ${club}`, text: [`Guten Tag ${personName(i).split(', ').reverse().join(' ')},`, '',
      `bitte geben Sie folgende Schlüssel des ${club} zurück: ${items.map(pieceText).join(', ')}.`, i.due ? `Vereinbart war die Rückgabe bis ${deD(i.due)}.` : '', 'Melden Sie sich gern beim Vorstand, wenn Sie Fragen haben.', '', 'Viele Grüße', club].filter(x => x !== '').join('\n') });
    db.prepare('UPDATE sl_issue SET remind_at = ? WHERE id = ?').run(nowTs(), i.id);
    audit(req.user, 'Schlüssel: Erinnerung geschickt', personName(i));
    return { ok: true };
  }));

  /* ---------- alte Schlüsselnummern übernehmen ---------- */
  const adoptable = () => {
    const have = new Set(db.prepare("SELECT member_id || ':' || legacy_no k FROM sl_issue WHERE legacy_no IS NOT NULL").all().map(r => r.k));
    const r = mitgl() ? (ctx.callHooksSync('keyNumbers').map(x => x.result).find(Array.isArray) || []) : [];
    return r.filter(x => x.member_id && x.no && !have.has(`${x.member_id}:${x.no}`));
  };
  A.get('/adopt', P, (req, res) => res.json({ list: adoptable().map(x => ({ member_id: x.member_id, name: x.name, no: x.no, type_id: (db.prepare('SELECT id FROM sl_type WHERE lower(ident) = lower(?)').get(String(x.no)) || {}).id || null })) }));
  A.post('/adopt', P, send(req => {
    const items = Array.isArray((req.body || {}).items) ? req.body.items.slice(0, 500) : [], ok = new Map(adoptable().map(x => [`${x.member_id}:${x.no}`, x]));
    let count = 0;
    db.transaction(() => {
      for (const it of items) {
        const key = `${int(it.member_id)}:${String(it.no)}`; if (!ok.has(key)) continue;
        const t = db.prepare('SELECT id FROM sl_type WHERE id = ?').get(int(it.type_id)); if (!t) throw fail(`Für die Nummer ${it.no} bitte eine Sorte wählen.`);
        let p = db.prepare("SELECT id FROM sl_piece WHERE type_id = ? AND status = 'vorraetig' ORDER BY id LIMIT 1").get(t.id);
        if (!p) {   // der Bestand kannte dieses Stück noch nicht – es wird ergänzt
          const ty = db.prepare('SELECT ident FROM sl_type WHERE id = ?').get(t.id), have = db.prepare('SELECT COUNT(*) n FROM sl_piece WHERE type_id = ?').get(t.id).n;
          p = { id: Number(db.prepare("INSERT INTO sl_piece(type_id, label, note) VALUES (?,?, 'bei der Übernahme ergänzt')").run(t.id, `${ty.ident}-${have + 1}`).lastInsertRowid) };
        }
        const iid = Number(db.prepare("INSERT INTO sl_issue(member_id, status, legacy, legacy_no, issued_by, issued_at, created_by) VALUES (?, 'ausgegeben', 1, ?, 'übernommen', ?, ?)").run(int(it.member_id), String(it.no), nowTs(), (req.user && (req.user.name || req.user.username)) || null).lastInsertRowid);
        db.prepare("INSERT INTO sl_issue_piece(issue_id, piece_id, state) VALUES (?,?, 'ausgegeben')").run(iid, p.id);
        db.prepare("UPDATE sl_piece SET status = 'ausgegeben' WHERE id = ?").run(p.id);
        count++;
      }
    })();
    audit(req.user, 'Schlüssel: Nummern übernommen', `${count} aus der Mitgliederverwaltung`);
    return { count };
  }));
  A.post('/issues/:id/catchup', P, send(async req => {
    const i = db.prepare('SELECT * FROM sl_issue WHERE id = ? AND legacy = 1').get(int(req.params.id)); if (!i) throw fail('Diese Ausgabe ist schon mit Protokoll.');
    const b = req.body || {};
    if (!b.agreed) throw fail('Bitte bestätigen, dass die Bedingungen gelesen wurden und die Person einverstanden ist.');
    const minor = ageAt(personBirth(i), today()) < 18;
    const sigs = sigsOf(b, minor);
    if (b.template_id) db.prepare('UPDATE sl_issue SET template_id = ? WHERE id = ?').run(int(b.template_id), i.id);
    if (b.issued_by) db.prepare('UPDATE sl_issue SET issued_by = ? WHERE id = ?').run(one(b.issued_by, 60), i.id);
    else db.prepare('UPDATE sl_issue SET issued_by = ? WHERE id = ?').run((req.user && (req.user.name || req.user.username)) || '', i.id);
    if (minor) db.prepare('UPDATE sl_issue SET guardian_name = ? WHERE id = ?').run(one(b.guardian_name, 70) || null, i.id);
    db.prepare("UPDATE sl_issue SET status = 'signiere' WHERE id = ?").run(i.id);
    const keepAt = i.issued_at;
    let r;
    try { r = await finalizeIssue(i.id, sigs, (req.user && (req.user.name || req.user.username)) || '', 'verwaltung'); }
    catch (e) { db.prepare("UPDATE sl_issue SET status = 'ausgegeben', issued_at = ? WHERE id = ?").run(keepAt, i.id); throw e; }   // bleibt „ohne Protokoll“
    db.prepare('UPDATE sl_issue SET legacy = 0, issued_at = ? WHERE id = ?').run(keepAt, i.id);   // Datum der Übergabe bleibt
    return r;
  }));

  /* ---------- Tablet: Code, prüfen, unterschreiben ---------- */
  const security = ctx.require('./security');
  const tFails = security.limiter({ per: 8, baseMs: 15 * 60000 }), tAll = security.limiter({ per: 30, baseMs: 15 * 60000 });
  const burst = ctx.rateLimit('sltab', 30, 10 * 60000);
  function byCode(req, res) {
    const ip = req.ip || '?', w = Math.max(tFails.blocked(ip), tAll.blocked('*'));
    if (w) { bad(res, `Zu viele falsche Codes – bitte ${w} Min. warten.`, 429); return null; }
    const code = String((req.body || {}).code || '').replace(/\D/g, '');
    const i = code.length === 6 ? issueByCode(code) : null;
    if (!i) {
      if (tFails.fail(ip).locked) ctx.securityAlert('code', 'Schlüsselübergabe am Tablet: 8-mal ein falscher Code – dieses Tablet ist für die Code-Eingabe vorübergehend gesperrt.', { key: 'tablet' });
      if (tAll.fail('*').locked) ctx.securityAlert('code_alle', 'Schlüsselübergabe am Tablet: 30-mal ein falscher Code – die Code-Eingabe ist für alle Tablets gesperrt.', { key: 'alle' });
      bad(res, 'Der Code stimmt nicht oder ist abgelaufen.', 404); return null;
    }
    tFails.ok(ip);
    return i;
  }
  T.get('/config', (req, res) => res.json({ waiting: db.prepare("SELECT COUNT(*) n FROM sl_issue WHERE status = 'wartet' AND code_expires > ?").get(Date.now()).n, club: ctx.getSetting('club_name', 'Verein') }));
  const tabletView = i => {
    const tpl = db.prepare('SELECT text FROM sl_template WHERE id = ?').get(i.template_id) || db.prepare('SELECT text FROM sl_template ORDER BY sort, id LIMIT 1').get();
    return { id: i.id, person: personName(i), terms: renderTerms(tpl.text), issued_by: i.issued_by, due: i.due || '', deposit_cents: i.deposit_cents, guardian_required: Boolean(i.guardian_name), guardian_name: i.guardian_name || '',
      pieces: itemsOf(i.id).map(x => ({ id: x.id, ident: x.ident, label: x.label, name: x.name, opens: x.opens || '' })), club: ctx.getSetting('club_name', 'Verein') };
  };
  T.post('/open', burst, (req, res) => { const i = byCode(req, res); if (i) res.json(tabletView(i)); });
  T.post('/sign', burst, ar(async (req, res) => {
    const i = byCode(req, res); if (!i) return;
    const b = req.body || {};
    if (!b.agreed) return bad(res, 'Bitte bestätigen, dass Sie die Bedingungen gelesen haben und einverstanden sind.');
    let sigs; try { sigs = sigsOf(b, Boolean(i.guardian_name)); } catch (e) { return bad(res, e.message); }
    res.json(await finalizeIssue(i.id, sigs, i.issued_by, 'tablet'));
  }));

  /* ---------- Excel ---------- */
  const safe = v => typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  A.get('/export.xlsx', P, ar(async (req, res) => {
    const ExcelJS = ctx.require('exceljs'), wb = new ExcelJS.Workbook();
    const rows = db.prepare("SELECT * FROM sl_issue WHERE status IN ('ausgegeben','zurueck','storniert') ORDER BY id").all().map(issueView).sort((a, b) => a.person.localeCompare(b.person, 'de'));
    const w1 = wb.addWorksheet('Ausgaben'); w1.addRow(['Person', 'Schlüssel', 'seit', 'bis', 'Pfand', 'Status', 'Protokoll-Nr.']).font = { bold: true };
    for (const r of rows) w1.addRow([safe(r.person), safe(r.pieces.map(p => `Nr. ${p.ident} ${p.name}`).join('; ')), r.issued_at ? deD(r.issued_at.slice(0, 10)) : '', r.due ? deD(r.due) : '', r.deposit_cents ? r.deposit_cents / 100 : '',
      r.reclaim ? 'zurückfordern' : r.status === 'ausgegeben' ? (r.legacy ? 'übernommen, ohne Protokoll' : 'ausgegeben') : r.status, r.no]);
    const w2 = wb.addWorksheet('Bestand'); w2.addRow(['Kennung', 'Bezeichnung', 'Art', 'gesamt', 'vorrätig', 'ausgegeben', 'verloren', 'gesperrt']).font = { bold: true };
    for (const t of db.prepare('SELECT * FROM sl_type ORDER BY sort, ident').all()) { const c = db.prepare("SELECT status, COUNT(*) n FROM sl_piece WHERE type_id = ? GROUP BY status").all(t.id).reduce((m, r) => (m[r.status] = r.n, m), {});
      w2.addRow([safe(t.ident), safe(t.name), sh.KINDS[t.kind], Object.entries(c).filter(([k]) => k !== 'ausgemustert').reduce((s, [, n]) => s + n, 0), c.vorraetig || 0, (c.ausgegeben || 0) + (c.reserviert || 0), c.verloren || 0, c.gesperrt || 0]); }
    const w3 = wb.addWorksheet('Pfand'); w3.addRow(['Person', 'Schlüssel', 'Betrag in €', 'seit']).font = { bold: true };
    let sum = 0; for (const r of rows.filter(r => r.deposit_state === 'gehalten')) { sum += r.deposit_cents; w3.addRow([safe(r.person), safe(r.pieces.map(p => `Nr. ${p.ident}`).join(', ')), r.deposit_cents / 100, r.issued_at ? deD(r.issued_at.slice(0, 10)) : '']); }
    const sr = w3.addRow(['Summe (so viel Pfand hält der Verein)', '', sum / 100, '']); sr.font = { bold: true };
    for (const w of [w1, w2, w3]) w.columns.forEach(c => { c.width = 26; });
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="Schluessel.xlsx"' });
    await wb.xlsx.write(res); res.end();
  }));

  sh.issueView = issueView; sh.reclaimOf = reclaimOf; sh.openItems = openItems; sh.adoptable = adoptable;
}

module.exports = { register };
