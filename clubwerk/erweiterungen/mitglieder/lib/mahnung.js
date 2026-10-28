'use strict';
/**
 * Mahnwesen (Beiträge & Zahlungen › Rechnungen & Mahnungen):
 *  - Stufen einstellbar (Vorgabe: Zahlungserinnerung, 1. und 2. Mahnung, je 14 Tage; Gebühr ab der 1. Mahnung).
 *  - Stufe je Posten (mv_charge.dunning_level/dunned_at): Ein Posten erreicht die nächste Stufe erst, wenn der Abstand seit
 *    Fälligkeit bzw. seiner letzten Stufe um ist. Ein Schreiben fasst alle fälligen offenen Posten eines Zahlers zusammen
 *    (Guthaben wird verrechnet) und nennt je Posten die Stufe; die Überschrift richtet sich nach der höchsten Stufe.
 *  - Gebühr einmal je Schreiben (die der höchsten neu erreichten Stufe), nie für Mahngebühren selbst, und nur, wenn das Schreiben
 *    wirklich rausgeht: Stufe und Gebühr werden erst nach dem Senden der E-Mail bzw. nach „Briefe gedruckt“ gebucht.
 *  - Nie gemahnt: Posten im Einzug, Zahler mit gültigem Lastschrift-Mandat (die Posten kommen in den nächsten Einzug),
 *    Mahnsperre je Zahler oder Posten (Grund, optional bis).
 *  - Mahnhistorie (mv_dunning) am Mitglied und im Protokoll; Liste „Letzte Mahnung ohne Zahlung“ für den Vorstand.
 */
const crypto = require('crypto');
const pdf = require('./pdf');

/** Vorgabe der Stufen (Entscheidung des Vereins: 3 Stufen à 14 Tage, Gebühr ab der 1. Mahnung) – fee = Gebühr der Mahnungen */
const DEFAULT_LEVELS = fee => [
  { title: 'Zahlungserinnerung', days: 14, fee_cents: 0, text: 'sicher haben Sie es nur übersehen: Bei der Durchsicht unserer Konten haben wir festgestellt, dass folgende Beträge noch offen sind. Bitte überweisen Sie {betrag} bis zum {frist}. Falls Sie inzwischen gezahlt haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.' },
  { title: '1. Mahnung', days: 14, fee_cents: fee, text: 'leider konnten wir trotz unserer Zahlungserinnerung noch keinen Zahlungseingang feststellen. Bitte überweisen Sie {betrag} bis zum {frist}. Für diese Mahnung berechnen wir eine Mahngebühr.' },
  { title: '2. Mahnung', days: 14, fee_cents: fee, text: 'trotz Zahlungserinnerung und Mahnung sind folgende Beträge weiterhin offen. Bitte überweisen Sie {betrag} spätestens bis zum {frist}. Dies ist unsere letzte Mahnung – danach entscheidet der Vorstand über das weitere Vorgehen.' },
];

function register(sh) {
  const { C, store, fees, personRow, bankRow, mandateState, one, txt, euro, deD, uname, ar } = sh;
  const { S, today } = store;
  const { need, bad, int, rateLimit } = C;
  const admin = C.admin, db = C.db;
  const PF = need('mitglieder_finanzen');
  const isDate = fees.isDate;
  const fachlich = msg => Object.assign(new Error(msg), { fachlich: true });

  /* ---------- Einstellungen ---------- */
  /** Stufen aus den Einstellungen; ohne eigene Stufen die Vorgabe – eine früher eingestellte „Mahngebühr ab 2. Mahnung“ geht darin auf */
  function levels() {
    try { const r = sh.cleanDunningLevels(JSON.parse(S('dunning_levels', ''))); if (r.levels) return r.levels; } catch (e) { /* Vorgabe */ }
    const old = S('dunning_fee_cents', '');
    return DEFAULT_LEVELS(old === '' ? 250 : Math.max(0, parseInt(old, 10) || 0));
  }
  const deadlineDays = () => Math.max(1, Math.min(60, parseInt(S('dunning_deadline_days', '14'), 10) || 14));
  /** Stufen aus der Verwaltung prüfen → { levels } oder { error } */
  sh.cleanDunningLevels = list => {
    if (!Array.isArray(list) || !list.length || list.length > 5) return { error: 'Bitte 1 bis 5 Mahnstufen einstellen.' };
    const out = list.map(x => ({ title: one(x && x.title, 40), days: int(x && x.days), fee_cents: int(x && x.fee_cents), text: txt(x && x.text, 800) }));
    if (out.some(x => x.title.length < 2)) return { error: 'Jede Mahnstufe braucht eine Bezeichnung.' };
    if (out.some(x => x.days < 1 || x.days > 90)) return { error: 'Der Abstand einer Mahnstufe muss zwischen 1 und 90 Tagen liegen.' };
    if (out.some(x => x.fee_cents < 0 || x.fee_cents > 10000)) return { error: 'Die Mahngebühr darf höchstens 100 € betragen.' };
    if (out.some(x => x.text.length < 10)) return { error: 'Jede Mahnstufe braucht einen Text (mindestens ein Satz).' };
    return { levels: out };
  };
  sh.dunningLevels = levels; sh.dunningDeadline = deadlineDays;

  /* ---------- Mahnlauf berechnen ---------- */
  const blockOn = (reason, until, day) => Boolean(reason) && (!until || until >= day);
  const nameOf = id => (db.prepare('SELECT name FROM members WHERE id = ?').get(id) || {}).name || '?';
  const stageTitle = (L, lv) => (lv > 0 ? L[Math.min(lv, L.length) - 1].title : '');
  /** Wann erreicht ein Posten die nächste Stufe? → Datum oder null (letzte Stufe erreicht) */
  function nextAt(c, L) {
    const k = Math.min(c.dunning_level || 0, L.length);
    if (k >= L.length) return null;
    return fees.addDays(k === 0 ? c.due_date : (c.dunned_at || c.due_date), L[k].days);
  }
  /**
   * Plan für alle Zahler → { due: [Schreiben, die jetzt dran sind], last: [letzte Stufe ohne Zahlung], held: [gesperrt, wäre dran], debit: { n, cents } }
   * Schreiben = { member_id, name, email, via, level, title, items: [{ id, text, due_date, cents, kind, from, level, adv, stage }], net, fee, total, sig }
   */
  function plan(day = today(), only = null) {
    const L = levels(), n = L.length, dl = deadlineDays();
    const rows = db.prepare(`SELECT c.* FROM mv_charge c WHERE c.status = 'offen' AND c.collection_id IS NULL AND c.due_date <= ? ${only ? 'AND c.member_id = ?' : ''} ORDER BY c.member_id, c.due_date, c.id`).all(...(only ? [day, only] : [day]));
    const groups = new Map();
    for (const c of rows) { if (!groups.has(c.member_id)) groups.set(c.member_id, []); groups.get(c.member_id).push(c); }
    const due = [], last = [], held = [], debit = { n: 0, cents: 0 };
    for (const [payer, list] of groups) {
      const p = db.prepare('SELECT * FROM mv_person WHERE member_id = ?').get(payer) || {};
      const items = list.filter(c => !blockOn(c.dunning_block, c.dunning_block_until, day));
      const net = items.reduce((s, c) => s + c.cents, 0);
      if (net <= 0) continue;   // nichts offen oder Guthaben deckt alles
      // Lastschrift mit gültigem Mandat: die Posten kommen in den nächsten Einzug (auch nach der ersten Rücklastschrift) – nicht mahnen
      if ((p.payment || 'lastschrift') === 'lastschrift' && !p.debit_blocked && mandateState(bankRow(payer)).ok) { debit.n++; debit.cents += net; continue; }
      const name = nameOf(payer);
      const its = items.map(c => {
        const from = Math.min(c.dunning_level || 0, n), at = c.cents > 0 ? nextAt(c, L) : null, adv = Boolean(at && at <= day);
        return { id: c.id, text: c.text, due_date: c.due_date, cents: c.cents, kind: c.kind, invoice_no: c.invoice_no, from, level: adv ? from + 1 : from, adv, dunned_at: c.dunned_at };
      });
      const adv = its.filter(i => i.adv);
      if (!adv.length) {
        // letzte Stufe erreicht und Frist um: für den Vorstand
        const fin = its.filter(i => i.cents > 0 && i.from >= n && i.dunned_at && fees.addDays(i.dunned_at, dl) <= day);
        if (fin.length) last.push({ member_id: payer, name, date: fin.map(i => i.dunned_at).sort().pop(), title: L[n - 1].title, cents: fin.reduce((s, i) => s + i.cents, 0), net });
        continue;
      }
      const level = Math.max(...its.map(i => i.level));
      // Gebühr: einmal je Schreiben – die der höchsten neu erreichten Stufe; offene Mahngebühren lösen selbst keine Gebühr aus
      const fee = Math.max(0, ...adv.filter(i => i.kind !== 'mahngebuehr').map(i => L[i.level - 1].fee_cents || 0));
      for (const i of its) i.stage = i.adv ? L[i.level - 1].title : i.level ? `${stageTitle(L, i.level)}${i.dunned_at ? ' vom ' + deD(i.dunned_at) : ''}` : '';
      const sig = crypto.createHash('sha1').update(JSON.stringify([its.map(i => [i.id, i.from, i.level, i.cents]), fee])).digest('hex').slice(0, 16);
      const x = { member_id: payer, name, email: p.email || null, via: p.email ? 'email' : 'brief', payment: sh.payWay(p), level, title: L[level - 1].title, items: its, net, fee, total: net + fee, sig,
        oldest: its.map(i => i.due_date).sort()[0] };
      if (blockOn(p.dunning_block, p.dunning_block_until, day)) held.push({ ...x, block: p.dunning_block, until: p.dunning_block_until }); else due.push(x);
    }
    const byName = (a, b) => C.require('./db').nameKey(a.name, 'mitglied').localeCompare(C.require('./db').nameKey(b.name, 'mitglied'), 'de');
    return { day, levels: L, deadline: fees.addDays(day, dl), deadlineDays: dl, due: due.sort(byName), last: last.sort(byName), held: held.sort(byName), debit };
  }

  /* ---------- Schreiben ---------- */
  const fill = (t, x, deadline) => String(t || '').replace(/\{name\}/g, x.name).replace(/\{betrag\}/g, euro(x.total)).replace(/\{frist\}/g, deD(deadline));
  /** Daten für das PDF (Rechnungsnummer wird bei Bedarf vergeben – Verwendungszweck, Kontoauszug erkennt sie) */
  function letterData(x, pl) {
    const list = db.prepare(`SELECT * FROM mv_charge WHERE id IN (${x.items.map(() => '?').join(',')})`).all(...x.items.map(i => i.id));
    const no = sh.invoiceNo(list);
    const L = pl.levels;
    const charges = x.items.map(i => ({ due_date: i.due_date, text: i.text, cents: i.cents, stage: i.stage }));
    if (x.fee) charges.push({ due_date: pl.day, text: `Mahngebühr (${x.title})`, cents: x.fee, stage: '' });
    return { no, o: { person: personRow(x.member_id) || {}, name: x.name, no, date: pl.day, charges, payment: 'ueberweisung', dunning: { title: x.title, text: fill(L[x.level - 1].text, x, pl.deadline), deadline: pl.deadline } } };
  }
  /** Stufe und Gebühr buchen, Mahnhistorie schreiben – erst wenn das Schreiben raus ist (E-Mail gesendet bzw. Brief gedruckt) */
  function commit(x, pl, no, via, req) {
    const user = uname(req);
    let feeId = null;
    db.transaction(() => {
      for (const i of x.items.filter(y => y.adv))
        db.prepare("UPDATE mv_charge SET dunning_level = ?, dunned_at = ? WHERE id = ? AND status = 'offen' AND collection_id IS NULL AND dunning_level <= ?").run(i.level, pl.day, i.id, i.from);
      if (x.fee) feeId = Number(db.prepare("INSERT INTO mv_charge(member_id, kind, text, cents, due_date, invoice_no, dunning_level, dunned_at, created_by, note) VALUES (?, 'mahngebuehr', ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(x.member_id, `Mahngebühr (${x.title} vom ${deD(pl.day)})`, x.fee, pl.day, no, x.level, pl.day, user, `${via === 'email' ? 'per E-Mail' : 'per Brief'}`).lastInsertRowid);
      db.prepare('INSERT INTO mv_dunning(member_id, date, level, title, cents, fee_cents, fee_id, ref, charges, via, by_user) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(x.member_id, pl.day, x.level, x.title, x.total, x.fee, feeId, no, JSON.stringify(x.items.map(i => ({ id: i.id, text: i.text, cents: i.cents, level: i.level, adv: i.adv }))), via, user);
    })();
    store.hist(x.member_id, user, 'Mahnung', null, `${x.title} über ${euro(x.total)}${x.fee ? ` (Gebühr ${euro(x.fee)})` : ''}, ${via === 'email' ? 'per E-Mail' : 'per Brief'}`);
    C.audit(req.user, via === 'email' ? 'Mahnung per E-Mail versendet' : 'Mahnbrief gedruckt', `${x.name}: ${x.title} über ${euro(x.total)}${x.fee ? `, Mahngebühr ${euro(x.fee)}` : ''}`);
  }
  /** Auswahl aus der Verwaltung gegen den aktuellen Plan prüfen: nur, was dort noch genauso steht → { ok: [Schreiben], changed: [Namen] } */
  function pick(pl, body) {
    const want = (Array.isArray(body.items) ? body.items : []).slice(0, 500).map(x => ({ id: int(x && x.member_id), sig: String((x && x.sig) || '') }));
    const ok = [], changed = [];
    for (const w of want) {
      const x = pl.due.find(d => d.member_id === w.id);
      if (x && x.sig === w.sig) ok.push(x); else changed.push(x ? x.name : nameOf(w.id));
    }
    return { ok, changed };
  }

  admin.get('/dunning', PF, (req, res) => {
    const pl = plan();
    res.json({ ...pl, blocks: blocks(pl.day), mail: C.mail.ready() });
  });
  /** Vorschau eines Schreibens (ändert nichts außer ggf. der Rechnungsnummer) */
  admin.get('/dunning/letter.pdf', PF, ar(async (req, res) => {
    const pl = plan(today(), int(req.query.member));
    const x = pl.due.find(d => d.member_id === int(req.query.member)) || pl.held.find(d => d.member_id === int(req.query.member));
    if (!x) return bad(res, 'Für diesen Zahler ist gerade keine Mahnung fällig.', 404);
    const { no, o } = letterData(x, pl);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Mahnung_${no}.pdf"` }).send(await pdf.invoice(sh.club(), o));
  }));
  /** Sammel-PDF der Briefe (ids = Zahler) – bucht noch nichts; danach „Briefe gedruckt“ */
  admin.get('/dunning/letters.pdf', PF, ar(async (req, res) => {
    const pl = plan(), ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean);
    const list = pl.due.filter(x => ids.includes(x.member_id)).map(x => letterData(x, pl).o);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Mahnbriefe_${pl.day}.pdf"` }).send(await pdf.dunningLetters(sh.club(), list));
  }));
  admin.post('/dunning/printed', PF, (req, res) => {
    const pl = plan(), { ok, changed } = pick(pl, req.body || {});
    for (const x of ok) commit(x, pl, letterData(x, pl).no, 'brief', req);
    res.json({ ok: true, done: ok.length, changed });
  });
  admin.post('/dunning/send', PF, rateLimit('mvdun', 10, 10 * 60000), ar(async (req, res) => {
    if (!C.mail.ready()) return bad(res, 'Kein Postfach eingerichtet (Einstellungen → Postfach).');
    const pl = plan(), { ok, changed } = pick(pl, req.body || {});
    const cl = sh.club();
    let sent = 0; const missing = [], failed = [];
    for (const x of ok) {
      if (!x.email) { missing.push(x.name); continue; }
      const { no, o } = letterData(x, pl);
      try {
        const buf = await pdf.invoice(cl, o);
        await C.mail.send({ to: x.email, subject: `${x.title} ${no} – ${cl.name}`, text: [`Guten Tag ${x.name},`, '', o.dunning.text, '',
          ...o.charges.map(c => `- ${c.text}: ${euro(c.cents)}${c.stage ? ` (${c.stage})` : ''}`), `Offen gesamt: ${euro(x.total)}`, '',
          `Bitte überweisen Sie den Betrag bis zum ${deD(pl.deadline)} auf das Konto des Vereins:`, cl.name, cl.iban ? `IBAN ${String(cl.iban).replace(/(.{4})/g, '$1 ').trim()}` : null, `Verwendungszweck: ${no}`, '',
          'Die Einzelheiten stehen im angehängten PDF.', '', 'Viele Grüße', cl.name].filter(l => l !== null).join('\n'),
          attachments: [{ filename: `${no}.pdf`, content: buf }] });
      } catch (e) { failed.push(`${x.name}: ${e.message}`); continue; }   // nicht raus → keine Stufe, keine Gebühr
      commit(x, pl, no, 'email', req);
      sent++;
      await new Promise(r => setTimeout(r, 150));
    }
    res.json({ ok: true, sent, missing, failed, changed });
  }));

  /* ---------- Mahnsperre ---------- */
  /** aktive Sperren (Zahler und Posten) für die Seite „Rechnungen & Mahnungen“ */
  function blocks(day) {
    const out = db.prepare('SELECT p.member_id, m.name, p.dunning_block AS reason, p.dunning_block_until AS until FROM mv_person p JOIN members m ON m.id = p.member_id WHERE p.dunning_block IS NOT NULL AND (p.dunning_block_until IS NULL OR p.dunning_block_until >= ?)').all(day)
      .map(r => ({ ...r, kind: 'zahler' }));
    for (const r of db.prepare("SELECT c.id AS charge_id, c.member_id, m.name, c.text, c.cents, c.dunning_block AS reason, c.dunning_block_until AS until FROM mv_charge c JOIN members m ON m.id = c.member_id WHERE c.status = 'offen' AND c.dunning_block IS NOT NULL AND (c.dunning_block_until IS NULL OR c.dunning_block_until >= ?)").all(day))
      out.push({ ...r, kind: 'posten' });
    const key = r => C.require('./db').nameKey(r.name, 'mitglied');
    return out.sort((a, b) => key(a).localeCompare(key(b), 'de') || (a.charge_id || 0) - (b.charge_id || 0));
  }
  const blockBody = (req, res) => {
    const b = req.body || {}, reason = one(b.reason, 120), until = b.until ? String(b.until) : null;
    if (reason.length < 3) { bad(res, 'Bitte einen Grund angeben (z. B. „Ratenzahlung vereinbart“).'); return null; }
    if (until && (!isDate(until) || until < today())) { bad(res, 'Das Enddatum der Mahnsperre muss heute oder später sein.'); return null; }
    return { reason, until };
  };
  admin.put('/member/:id/dunning-block', PF, (req, res) => {
    const id = int(req.params.id), p = personRow(id); if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    const v = blockBody(req, res); if (!v) return;
    db.prepare('UPDATE mv_person SET dunning_block = ?, dunning_block_until = ? WHERE member_id = ?').run(v.reason, v.until, id);
    store.hist(id, uname(req), 'Mahnsperre', null, `${v.reason}${v.until ? ` (bis ${deD(v.until)})` : ''}`);
    C.audit(req.user, 'Mahnsperre gesetzt', `${p.name}: ${v.reason}${v.until ? ` bis ${deD(v.until)}` : ''}`);
    res.json({ ok: true });
  });
  admin.delete('/member/:id/dunning-block', PF, (req, res) => {
    const id = int(req.params.id), p = personRow(id); if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    const was = db.prepare('SELECT dunning_block FROM mv_person WHERE member_id = ?').get(id) || {};
    db.prepare('UPDATE mv_person SET dunning_block = NULL, dunning_block_until = NULL WHERE member_id = ?').run(id);
    if (was.dunning_block) { store.hist(id, uname(req), 'Mahnsperre', was.dunning_block, 'aufgehoben'); C.audit(req.user, 'Mahnsperre aufgehoben', `${p.name}: ${was.dunning_block}`); }
    res.json({ ok: true });
  });
  admin.put('/charges/:id/dunning-block', PF, (req, res) => {
    const c = db.prepare('SELECT * FROM mv_charge WHERE id = ?').get(int(req.params.id));
    if (!c) return bad(res, 'Nicht gefunden.', 404);
    if (c.status !== 'offen') return bad(res, 'Nur offene Posten lassen sich sperren.');
    const v = blockBody(req, res); if (!v) return;
    db.prepare('UPDATE mv_charge SET dunning_block = ?, dunning_block_until = ? WHERE id = ?').run(v.reason, v.until, c.id);
    C.audit(req.user, 'Mahnsperre gesetzt', `${nameOf(c.member_id)}: ${c.text} ${euro(c.cents)} – ${v.reason}${v.until ? ` bis ${deD(v.until)}` : ''}`);
    res.json({ ok: true });
  });
  admin.delete('/charges/:id/dunning-block', PF, (req, res) => {
    const c = db.prepare('SELECT * FROM mv_charge WHERE id = ?').get(int(req.params.id));
    if (!c) return bad(res, 'Nicht gefunden.', 404);
    db.prepare('UPDATE mv_charge SET dunning_block = NULL, dunning_block_until = NULL WHERE id = ?').run(c.id);
    if (c.dunning_block) C.audit(req.user, 'Mahnsperre aufgehoben', `${nameOf(c.member_id)}: ${c.text} ${euro(c.cents)}`);
    res.json({ ok: true });
  });

  /* ---------- Ausnahme vom Einzug (nach 2 Rücklastschriften) von Hand aufheben – der Zähler beginnt neu ---------- */
  admin.delete('/member/:id/debit-block', PF, (req, res) => {
    const id = int(req.params.id), p = personRow(id); if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    const was = db.prepare('SELECT debit_blocked, debit_returns FROM mv_person WHERE member_id = ?').get(id) || {};
    if (!was.debit_blocked) return bad(res, 'Dieses Mitglied ist nicht vom Einzug ausgenommen.');
    db.prepare('UPDATE mv_person SET debit_blocked = NULL, debit_returns = 0 WHERE member_id = ?').run(id);
    store.hist(id, uname(req), 'Lastschrift', `ausgenommen seit ${deD(was.debit_blocked)} (${was.debit_returns} Rücklastschriften)`, 'wieder im Einzug');
    C.audit(req.user, 'Lastschrift wieder zugelassen', `${p.name}: nach ${was.debit_returns} Rücklastschriften wieder im Einzug`);
    res.json({ ok: true });
  });

  /* ---------- für andere Teile ---------- */
  const historyOf = id => db.prepare('SELECT id, date, level, title, cents, fee_cents, ref, via, by_user, charges FROM mv_dunning WHERE member_id = ? ORDER BY date DESC, id DESC LIMIT 100').all(id)
    .map(r => ({ ...r, charges: JSON.parse(r.charges || '[]') }));
  /** Mitglied › Zahlung & Familie: Mahnsperre, Ausnahme vom Einzug, Mahnhistorie */
  sh.dunningInfo = id => {
    const p = db.prepare('SELECT dunning_block, dunning_block_until, debit_blocked, debit_returns FROM mv_person WHERE member_id = ?').get(id) || {};
    return { block: blockOn(p.dunning_block, p.dunning_block_until, today()) ? { reason: p.dunning_block, until: p.dunning_block_until } : null,
      debitBlocked: p.debit_blocked || null, debitReturns: p.debit_returns || 0, history: historyOf(id) };
  };
  /** offene Mahngebühren, die dieser Posten ausgelöst hat (Storno-Dialog bietet sie mit an) → [{ id, text, cents, alone }] */
  sh.dunningFeesOf = chargeId => {
    const c = db.prepare('SELECT member_id FROM mv_charge WHERE id = ?').get(chargeId); if (!c) return [];
    const out = [];
    for (const d of db.prepare('SELECT d.charges, d.fee_id FROM mv_dunning d JOIN mv_charge f ON f.id = d.fee_id WHERE d.member_id = ? AND f.status = \'offen\' AND f.collection_id IS NULL').all(c.member_id)) {
      const adv = JSON.parse(d.charges || '[]').filter(x => x.adv && x.cents > 0);
      if (!adv.some(x => x.id === chargeId)) continue;
      const f = db.prepare('SELECT id, text, cents FROM mv_charge WHERE id = ?').get(d.fee_id);
      // allein = kein anderer Posten dieses Schreibens ist noch offen oder bezahlt → die Gebühr gehört nur noch zu diesem
      const others = adv.filter(x => x.id !== chargeId && db.prepare("SELECT 1 FROM mv_charge WHERE id = ? AND status != 'storniert'").get(x.id));
      out.push({ ...f, alone: !others.length });
    }
    return out;
  };
  admin.get('/charges/:id/fees', PF, (req, res) => res.json(sh.dunningFeesOf(int(req.params.id))));
  /** Steht dieser Posten in einem Mahnschreiben? (Kontoauszug: Zuordnung aufheben nur, solange der Rest-Posten nicht gemahnt wurde) */
  sh.inDunning = (chargeId, memberId) => db.prepare('SELECT charges FROM mv_dunning WHERE member_id = ?').all(memberId).some(d => JSON.parse(d.charges || '[]').some(x => x.id === chargeId));
  /** Mitglieder-App „Mein Konto“: letztes Schreiben, solange daraus noch etwas offen ist → { title, date, ref } | null */
  sh.lastDunning = id => {
    const d = db.prepare('SELECT * FROM mv_dunning WHERE member_id = ? ORDER BY date DESC, id DESC LIMIT 1').get(id);
    if (!d) return null;
    const ids = JSON.parse(d.charges || '[]').map(x => x.id).concat(d.fee_id ? [d.fee_id] : []);
    const open = ids.length && db.prepare(`SELECT 1 FROM mv_charge WHERE id IN (${ids.map(() => '?').join(',')}) AND status = 'offen' AND collection_id IS NULL AND cents > 0`).get(...ids);
    return open ? { title: d.title, date: d.date, ref: d.ref } : null;
  };
}

module.exports = { register, DEFAULT_LEVELS };
