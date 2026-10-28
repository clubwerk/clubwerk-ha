'use strict';
/**
 * Kontoauszug (Kern: src/kontoauszug.js): Bankbuchungen den offenen Posten und Einzügen zuordnen.
 * Gebucht wird nur über dieselben Funktionen wie von Hand (money.js: payCharge, debitPaid, debitReturn) – alles synchron
 * in der Transaktion des Kerns. Schlüssel der Vorschläge:
 *   c:<id,id…>   diese offenen Posten (älteste zuerst; Rest bleibt offen, Mehrbetrag wird Guthaben)
 *   p:<Zahler>   alle offenen Posten des Zahlers (älteste zuerst)
 *   l:<id,id…>   schon von Hand bezahlt – nur verknüpfen, nichts buchen
 *   k:<Einzug>:<FRST|RCUR|ALL>   Lastschrift-Gutschrift → „Zahlung erfolgt“
 *   kl:<Einzug>  Einzug schon als bezahlt gebucht – nur verknüpfen
 *   r:<Einzug>:<Zahler>   Rücklastschrift wie von Hand (Posten wieder offen, Gebühr, Mandat ggf. sperren)
 *   rl:<Einzug>:<Zahler>  Rücklastschrift schon von Hand erfasst – nur verknüpfen
 */
function register(sh) {
  const { C, store, euro, deD } = sh;
  const { S, today } = store;
  const db = C.db;
  const fachlich = msg => Object.assign(new Error(msg), { fachlich: true });
  const lastFirst = (n, k) => C.require('./db').lastFirst(n, k);
  const payerName = id => (db.prepare('SELECT name FROM members WHERE id = ?').get(id) || {}).name || '?';
  const who = id => lastFirst(payerName(id), 'mitglied');
  const VIA = 'kontoauszug';

  /* Rückgabegründe (SEPA-Rückgabecodes) – sperren: Mandat beim Zahler sperren (vorgeschlagen, änderbar) */
  const CODES = { AC01: ['IBAN fehlerhaft', true], AC04: ['Konto erloschen', true], AC06: ['Konto gesperrt', true], AG01: ['Lastschrift auf diesem Konto nicht erlaubt', true],
    AM04: ['Deckung unzureichend', false], AM05: ['doppelte Einreichung', false], MD01: ['kein gültiges Mandat', true], MD06: ['Erstattung auf Verlangen des Zahlers', false],
    MD07: ['Zahler verstorben', true], MS02: ['Widerspruch des Zahlers', false], MS03: ['Grund nicht angegeben', false], SL01: ['Sperre der Bank des Zahlers', false],
    BE05: ['Gläubiger unbekannt', false], RR01: ['regulatorische Gründe', false], RR02: ['regulatorische Gründe', false], RR03: ['regulatorische Gründe', false], RR04: ['regulatorische Gründe', false] };
  const reasonOf = code => (CODES[code] ? `${CODES[code][0]} (${code})` : code ? `Rückgabegrund ${code}` : 'Rücklastschrift');

  const ids = s => [...new Set(String(s || '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 200);
  const chargesByIds = list => (list.length ? db.prepare(`SELECT * FROM mv_charge WHERE id IN (${list.map(() => '?').join(',')}) ORDER BY due_date, id`).all(...list) : []);
  const openOf = payer => db.prepare("SELECT * FROM mv_charge WHERE member_id = ? AND status = 'offen' AND collection_id IS NULL ORDER BY due_date, id").all(payer);
  const texts = list => { const u = [...new Set(list.map(c => c.text))]; const t = u.slice(0, 3).join(', '); return u.length > 3 ? `${t} u. a.` : t; };
  const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  /** Nummer steht im Verwendungszweck (Trennzeichen und Leerzeichen dürfen fehlen oder anders sein) – nicht als Teil einer längeren Nummer */
  const hasNo = (purpose, no) => {
    const n = norm(no); if (n.length < 4) return false;
    return new RegExp(`(?<![A-Z0-9])${[...n].join('[\\s./_-]*')}(?![0-9])`).test(String(purpose || '').toUpperCase());
  };
  const nameTokens = s => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/).filter(x => x.length >= 2 && !['und', 'u', 'herr', 'frau', 'familie', 'fam', 'dr'].includes(x));

  /* ---------- Einzüge: Lastschriften je Sequenz aus der SEPA-Datei ---------- */
  function batches(k) {
    const out = { ALL: { payers: [], cents: 0 } };
    for (const pm of String(k.xml || '').split('<PmtInf>').slice(1)) {
      const seq = (/<SeqTp>(\w+)<\/SeqTp>/.exec(pm) || [])[1] || 'ALL';
      const sum = Math.round(Number((/<CtrlSum>([\d.]+)<\/CtrlSum>/.exec(pm) || [])[1] || 0) * 100);
      const payers = [...pm.matchAll(/<EndToEndId>CW\d+-(\d+)<\/EndToEndId>/g)].map(m => Number(m[1]));
      out[seq] = { payers, cents: sum };
      out.ALL.payers.push(...payers); out.ALL.cents += sum;
    }
    return out;
  }
  const collOf = id => db.prepare('SELECT * FROM mv_collection WHERE id = ?').get(id);
  /** Einzug + Sequenz aus Sammlerreferenz, Verwendungszweck oder End-to-End-Referenz */
  function collRef(e) {
    for (const s of [e.batch_ref, e.purpose]) {
      const m = /CW\d{12}-(\d+)(?:-(FRST|RCUR))?/.exec(String(s || ''));
      if (m) return { id: Number(m[1]), seq: m[2] || 'ALL' };
    }
    const m = /^CW(\d+)-\d+$/.exec(String(e.e2e || ''));
    return m ? { id: Number(m[1]), seq: 'ALL' } : null;
  }
  const seqText = s => (s === 'FRST' ? 'Erstlastschriften' : s === 'RCUR' ? 'Folgelastschriften' : 'alle Lastschriften');

  /* ---------- Vorschläge ---------- */
  C.hooks.paymentPerm = () => 'mitglieder_finanzen';
  C.hooks.paymentCandidates = entries => {
    const out = [];
    const ibanMap = new Map();
    for (const b of db.prepare('SELECT member_id, iban, holder FROM mv_bank WHERE iban IS NOT NULL').all()) {
      const i = String(b.iban || '').replace(/\s+/g, '').toUpperCase(); if (!i) continue;
      if (!ibanMap.has(i)) ibanMap.set(i, new Set()); ibanMap.get(i).add(store.payerOf(b.member_id));
    }
    // Rechnungen der Buchhaltung an Mitglieder: Posten „Rechnung <Nr>: …“ (gebucht wird nur hier, die Rechnung zieht nach)
    const bhCharges = db.prepare("SELECT * FROM mv_charge WHERE ext_key LIKE 'bh-inv-%' AND status IN ('offen','bezahlt')").all()
      .map(c => ({ c, no: (/^Rechnung (\S+):/.exec(c.text) || [])[1] })).filter(x => x.no);
    let openPayers = null;   // für den Namensvergleich, nur bei Bedarf
    for (const e of entries) {
      const add = (key, label, cents, level, note = '', opts) => out.push({ entry: e.id, key, label, cents, level, note, opts });
      if (e.kind === 'ruecklastschrift') {
        const m = /CW(\d+)-(\d+)/.exec(String(e.e2e || '')) || /CW(\d+)-(\d+)/.exec(String(e.purpose || ''));
        if (!m) continue;
        const k = collOf(Number(m[1])), payer = Number(m[2]);
        if (!k || k.status === 'verworfen') continue;
        const list = db.prepare("SELECT * FROM mv_charge WHERE collection_id = ? AND member_id = ? AND status IN ('eingezogen','bezahlt')").all(k.id, payer);
        const orig = e.orig_cents != null ? e.orig_cents : Math.abs(e.cents);
        if (list.length) {
          const sum = list.reduce((s, c) => s + c.cents, 0);
          const fee = e.fee_cents > 0 ? e.fee_cents : parseInt(S('return_fee_cents', '0'), 10) || 0;
          const revoke = Boolean(CODES[e.ret_code] && CODES[e.ret_code][1]);
          add(`r:${k.id}:${payer}`, `${who(payer)}: Rücklastschrift aus dem Einzug vom ${deD(k.collection_date)} – ${reasonOf(e.ret_code)}`, Math.abs(e.cents),
            sum === orig && e.sure ? 'sicher' : 'wahrscheinlich', sum === orig ? `Posten wieder offen${fee ? `, Gebühr ${euro(fee)}` : ''}${revoke ? ', Mandat sperren' : ''}` : `Betrag weicht ab: im Einzug ${euro(sum)}`, { fee, revoke });
        } else if (db.prepare('SELECT 1 FROM mv_charge WHERE member_id = ? AND note LIKE ?').get(payer, `Rücklastschrift Einzug ${k.id}:%`))
          add(`rl:${k.id}:${payer}`, `${who(payer)}: Rücklastschrift aus dem Einzug vom ${deD(k.collection_date)} ist schon erfasst`, Math.abs(e.cents), 'sicher', 'nur verknüpfen, nichts buchen');
        continue;
      }
      if (e.cents <= 0) continue;
      // Lastschrift-Gutschrift des Vereins (Sammler)
      const cr = collRef(e);
      if (cr) {
        const k = collOf(cr.id);
        if (k && k.status !== 'verworfen') {
          const b = batches(k)[cr.seq] || batches(k).ALL;
          const inColl = b.payers.length ? db.prepare(`SELECT * FROM mv_charge WHERE collection_id = ? AND status = 'eingezogen' AND member_id IN (${b.payers.map(() => '?').join(',')})`).all(k.id, ...b.payers) : [];
          const cur = inColl.reduce((s, c) => s + c.cents, 0);
          if (inColl.length) add(`k:${k.id}:${cr.seq}`, `Lastschrift-Einzug vom ${deD(k.collection_date)} (${seqText(cr.seq)}): Zahlung erfolgt`, Math.min(e.cents, cur),
            e.sure && (e.cents === cur || e.cents === b.cents) ? 'sicher' : 'wahrscheinlich', e.cents === cur || e.cents === b.cents ? `${inColl.length} Posten von ${new Set(inColl.map(c => c.member_id)).size} Zahlern` : `Betrag weicht ab: im Einzug ${euro(cur)}`);
          else add(`kl:${k.id}`, `Lastschrift-Einzug vom ${deD(k.collection_date)} ist schon als bezahlt gebucht`, e.cents, 'sicher', 'nur verknüpfen, nichts buchen');
          continue;
        }
      }
      const seenPayers = new Set();
      // Rechnungsnummer im Verwendungszweck: RE-JJJJ-NNNN (Mitglieder) und Rechnungen der Buchhaltung an Mitglieder
      const nos = new Set([...norm(e.purpose).matchAll(/RE(\d{4})(\d{4,6})(?!\d)/g)].map(m => `RE-${m[1]}-${m[2]}`));
      const groups = [];
      for (const no of nos) groups.push({ no, list: db.prepare("SELECT * FROM mv_charge WHERE invoice_no = ? AND status IN ('offen','bezahlt') ORDER BY due_date, id").all(no) });
      for (const x of bhCharges) if (hasNo(e.purpose, x.no)) groups.push({ list: [x.c] });   // Text des Postens nennt die Rechnung schon
      for (const g of groups) {
        const open = g.list.filter(c => c.status === 'offen' && !c.collection_id), paid = g.list.filter(c => c.status === 'bezahlt' && c.paid_via !== VIA);
        if (open.length) {
          const payer = open[0].member_id, sum = open.reduce((s, c) => s + c.cents, 0);
          seenPayers.add(payer);
          add(`c:${open.map(c => c.id).join(',')}`, `${who(payer)}: ${g.no ? `Rechnung ${g.no} – ` : ''}${texts(open)}`, e.cents, sum === e.cents ? 'sicher' : 'wahrscheinlich',
            sum === e.cents ? '' : e.cents < sum ? `Teilzahlung – offen ${euro(sum)}, Rest bleibt offen` : `Überzahlung – offen ${euro(sum)}, Mehrbetrag wird Guthaben`);
        } else if (paid.length) {
          seenPayers.add(paid[0].member_id);
          add(`l:${paid.map(c => c.id).join(',')}`, `${who(paid[0].member_id)}: ${g.no ? `Rechnung ${g.no}` : texts(paid)} ist schon bezahlt (am ${deD(paid[paid.length - 1].paid_at)}, von Hand)`, Math.min(e.cents, paid.reduce((s, c) => s + c.cents, 0)), 'sicher', 'nur verknüpfen, nichts buchen');
        }
      }
      // IBAN des Zahlers aus der Mitgliederverwaltung
      const iban = String(e.iban || '').replace(/\s+/g, '').toUpperCase();
      for (const payer of ibanMap.get(iban) || []) {
        if (seenPayers.has(payer)) continue;
        const open = openOf(payer), sum = open.reduce((s, c) => s + c.cents, 0);
        if (sum <= 0) continue;
        seenPayers.add(payer);
        const single = open.filter(c => c.cents === e.cents);
        if (sum === e.cents) add(`p:${payer}`, `${who(payer)}: ${texts(open)}`, e.cents, 'wahrscheinlich', 'IBAN und Betrag passen');
        else if (single.length === 1) add(`c:${single[0].id}`, `${who(payer)}: ${single[0].text}`, e.cents, 'wahrscheinlich', 'IBAN und Betrag passen');
        else add(`p:${payer}`, `${who(payer)}: ${texts(open)}`, e.cents, 'vielleicht', e.cents < sum ? `IBAN passt – offen ${euro(sum)}, Rest bleibt offen` : `IBAN passt – offen ${euro(sum)}, Mehrbetrag wird Guthaben`);
      }
      if (seenPayers.size) continue;
      // Name ähnlich und Betrag passt
      const et = nameTokens(e.name);
      if (et.length < 2) continue;
      if (!openPayers) {
        openPayers = db.prepare(`SELECT c.member_id, m.name, SUM(c.cents) cents, (SELECT holder FROM mv_bank b WHERE b.member_id = c.member_id) holder
          FROM mv_charge c JOIN members m ON m.id = c.member_id WHERE c.status = 'offen' AND c.collection_id IS NULL GROUP BY c.member_id HAVING SUM(c.cents) > 0`).all()
          .map(r => ({ ...r, toks: [nameTokens(r.name), nameTokens(r.holder)].filter(t => t.length >= 2) }));
      }
      for (const r of openPayers) {
        if (r.cents !== e.cents || !r.toks.some(t => t.every(x => et.includes(x)))) continue;
        add(`p:${r.member_id}`, `${who(r.member_id)}: ${texts(openOf(r.member_id))}`, e.cents, 'vielleicht', 'Name ähnlich und Betrag passt');
      }
    }
    return out;
  };

  /** Von Hand zuordnen: Zahler mit offenem Betrag und Lastschriften der letzten 13 Monate (für Rücklastschriften) */
  C.hooks.paymentTargets = () => {
    const out = db.prepare(`SELECT c.member_id, m.name, SUM(c.cents) cents, COUNT(*) n FROM mv_charge c JOIN members m ON m.id = c.member_id
      WHERE c.status = 'offen' AND c.collection_id IS NULL GROUP BY c.member_id HAVING SUM(c.cents) > 0 ORDER BY name_key(m.name, m.kind)`).all()
      .map(r => ({ key: `p:${r.member_id}`, label: lastFirst(r.name, 'mitglied'), sub: `${r.n} ${r.n === 1 ? 'offener Posten' : 'offene Posten'}`, cents: r.cents, kind: 'zahlung' }));
    const since = C.util.addDays(today(), -400);
    for (const r of db.prepare(`SELECT c.collection_id, c.member_id, m.name, SUM(c.cents) cents, k.collection_date FROM mv_charge c JOIN members m ON m.id = c.member_id JOIN mv_collection k ON k.id = c.collection_id
      WHERE c.status IN ('eingezogen','bezahlt') AND k.status != 'verworfen' AND k.collection_date >= ? GROUP BY c.collection_id, c.member_id ORDER BY k.collection_date DESC, name_key(m.name, m.kind)`).all(since))
      out.push({ key: `r:${r.collection_id}:${r.member_id}`, label: lastFirst(r.name, 'mitglied'), sub: `Lastschrift vom ${deD(r.collection_date)}`, cents: r.cents, kind: 'ruecklastschrift' });
    return out;
  };

  /* ---------- Buchen ---------- */
  /** Betrag auf Posten verteilen: Gutschriften verrechnen, dann älteste zuerst; Rest bleibt offen, Mehrbetrag wird Guthaben */
  function allocate(list, amount, { date, user, payer }) {
    const credits = list.filter(c => c.cents < 0), debts = list.filter(c => c.cents > 0);
    const acts = [];
    let avail = amount;
    if (debts.length) for (const c of credits) {
      db.prepare("UPDATE mv_charge SET status = 'bezahlt', paid_at = ?, paid_via = 'verrechnet' WHERE id = ? AND status = 'offen'").run(date, c.id);
      acts.push({ t: 'net', id: c.id }); avail -= c.cents;
    }
    const paid = [];
    for (const c of debts) {
      if (avail <= 0) break;
      const pay = Math.min(avail, c.cents);
      const r = sh.payCharge(c, { paid: pay, date, via: VIA, user });
      acts.push({ t: 'pay', id: c.id, cents: c.cents, rest: r.rest, restDun: r.rest ? c.dunning_level : null });
      paid.push({ c, pay }); avail -= pay;
    }
    let credit = 0;
    if (avail > 0) {   // Überzahlung: Mehrbetrag als Gutschrift (Minus-Posten) – wie die Regel bei der Zahlung von Hand
      credit = avail;
      const id = Number(db.prepare("INSERT INTO mv_charge(member_id, for_member_id, kind, text, cents, due_date, created_by, note) VALUES (?,?, 'sonstiges', ?, ?, ?, ?, ?)")
        .run(payer, payer, `Guthaben aus Überzahlung vom ${deD(date)}`, -credit, date, user, 'Kontoauszug: Mehrbetrag einer Überweisung').lastInsertRowid);
      acts.push({ t: 'credit', id, cents: -credit });
    }
    const part = paid.find(x => x.pay < x.c.cents);
    return { acts, label: `${who(payer)}: ${texts(paid.map(x => x.c)) || 'Guthaben'}${part ? ' (Teilzahlung, Rest bleibt offen)' : ''}${credit ? `, Guthaben ${euro(credit)}` : ''}` };
  }

  C.hooks.applyPayment = (key, { entry: e, opts, user }) => {
    const [t, a, b] = String(key).split(':');
    const date = e.booking_date;
    if (t === 'r' || t === 'rl') {
      if (e.kind !== 'ruecklastschrift') throw fachlich('Das ist keine Rücklastschrift.');
      const k = collOf(Number(a)), payer = Number(b);
      if (!k || k.status === 'verworfen') throw fachlich('Diesen Einzug gibt es nicht mehr.');
      if (t === 'rl') return { cents: Math.abs(e.cents), label: `${who(payer)}: Rücklastschrift aus dem Einzug vom ${deD(k.collection_date)} (schon erfasst, verknüpft)`, ref: { link: true } };
      const fee = Number.isInteger(Number(opts.fee)) && Number(opts.fee) >= 0 ? Number(opts.fee) : (e.fee_cents > 0 ? e.fee_cents : parseInt(S('return_fee_cents', '0'), 10) || 0);
      const reason = reasonOf(e.ret_code);
      const r = sh.debitReturn(k, payer, { fee, reason, revoke: Boolean(opts.revoke), user });
      return { cents: Math.abs(e.cents), label: `${who(payer)}: Rücklastschrift ${euro(r.cents)} aus dem Einzug vom ${deD(k.collection_date)} – ${reason}${fee ? `, Gebühr ${euro(fee)}` : ''}${opts.revoke ? ', Mandat gesperrt' : ''}`,
        ref: { k: k.id, payer, charges: r.charges, feeId: r.feeId, revoked: r.revoked, note: `Rücklastschrift Einzug ${k.id}: ${reason}` } };
    }
    if (e.kind !== 'eingang' || e.cents <= 0) throw fachlich('Das ist kein Zahlungseingang.');
    if (t === 'kl') return { cents: e.cents, label: `Lastschrift-Einzug vom ${deD((collOf(Number(a)) || {}).collection_date)} (schon gebucht, verknüpft)`, ref: { link: true } };
    if (t === 'k') {
      const k = collOf(Number(a));
      if (!k || k.status === 'verworfen') throw fachlich('Diesen Einzug gibt es nicht mehr.');
      const bt = batches(k)[b] || batches(k).ALL;
      const list = bt.payers.length ? db.prepare(`SELECT id FROM mv_charge WHERE collection_id = ? AND status = 'eingezogen' AND member_id IN (${bt.payers.map(() => '?').join(',')})`).all(k.id, ...bt.payers).map(r => r.id) : [];
      if (!list.length) throw fachlich('In diesem Einzug ist nichts mehr „im Einzug“.');
      const prevStatus = k.status;
      const r = sh.debitPaid(list, date);
      return { cents: Math.min(e.cents, r.cents), label: `Lastschrift-Einzug vom ${deD(k.collection_date)} (${seqText(b)}): ${r.n} Posten bezahlt`, ref: { k: k.id, ids: r.ids, date, prevStatus } };
    }
    if (t === 'l') {
      const list = chargesByIds(ids(a));
      if (!list.length || list.some(c => c.status !== 'bezahlt')) throw fachlich('Diese Posten sind nicht (mehr) bezahlt.');
      return { cents: Math.min(e.cents, list.reduce((s, c) => s + c.cents, 0)), label: `${who(list[0].member_id)}: ${texts(list)} (schon bezahlt, verknüpft)`, ref: { link: true } };
    }
    let list, payer;
    if (t === 'p') { payer = Number(a); list = openOf(payer); }
    else if (t === 'c') {
      list = chargesByIds(ids(a));
      if (!list.length) throw fachlich('Diese Posten gibt es nicht mehr.');
      payer = list[0].member_id;
      if (list.some(c => c.member_id !== payer)) throw fachlich('Die Posten gehören zu verschiedenen Zahlern.');
      if (list.some(c => c.status !== 'offen' || c.collection_id)) throw fachlich('Mindestens einer der Posten ist nicht mehr offen – bitte die Liste neu laden.');
    } else throw fachlich('Unbekannte Zuordnung.');
    if (!list.length || list.reduce((s, c) => s + c.cents, 0) <= 0) throw fachlich('Für diesen Zahler ist nichts offen.');
    const r = allocate(list, e.cents, { date, user, payer });
    return { cents: e.cents, label: r.label, ref: { acts: r.acts, date } };
  };

  /* ---------- Zuordnung aufheben: nur, solange danach nichts anderes passiert ist ---------- */
  const one = id => db.prepare('SELECT * FROM mv_charge WHERE id = ?').get(id);
  const changed = (c, why) => fachlich(`„${c ? c.text : 'Posten'}“ wurde inzwischen ${why} – bitte das zuerst zurücknehmen.`);
  const stateWord = c => (!c ? 'gelöscht' : c.status === 'storniert' ? 'storniert' : c.status === 'eingezogen' || c.collection_id ? 'eingezogen' : c.status === 'bezahlt' ? 'bezahlt' : 'geändert');
  C.hooks.undoPayment = (key, ref, { user }) => {
    if (!ref || ref.link) return true;
    if (ref.acts) {
      for (const x of [...ref.acts].reverse()) {
        const c = one(x.id);
        if (x.t === 'credit') {
          if (!c || c.status !== 'offen' || c.collection_id || c.cents !== x.cents) throw changed(c, c && c.status === 'offen' ? 'geändert' : `verrechnet oder ${stateWord(c)}`);
          db.prepare('DELETE FROM mv_charge WHERE id = ?').run(c.id);
        } else if (x.t === 'pay') {
          if (!c || c.status !== 'bezahlt' || c.paid_via !== VIA || c.paid_at !== ref.date) throw changed(c, stateWord(c));
          if (x.rest) {
            const r = one(x.rest);
            if (!r || r.status !== 'offen' || r.collection_id || r.cents !== x.cents - c.cents || r.dunning_level !== x.restDun) throw changed(r, r && r.dunning_level !== x.restDun ? 'gemahnt' : stateWord(r));
            db.prepare('DELETE FROM mv_charge WHERE id = ?').run(r.id);
          }
          db.prepare("UPDATE mv_charge SET status = 'offen', cents = ?, paid_at = NULL, paid_via = NULL WHERE id = ?").run(x.cents, c.id);
        } else if (x.t === 'net') {
          if (!c || c.status !== 'bezahlt' || c.paid_via !== 'verrechnet' || c.paid_at !== ref.date) throw changed(c, stateWord(c));
          db.prepare("UPDATE mv_charge SET status = 'offen', paid_at = NULL, paid_via = NULL WHERE id = ?").run(c.id);
        }
      }
      return true;
    }
    if (ref.ids) {   // Lastschrift-Gutschrift: Posten wieder „im Einzug“
      for (const id of ref.ids) { const c = one(id); if (!c || c.status !== 'bezahlt' || c.paid_via !== 'lastschrift' || c.paid_at !== ref.date || c.collection_id !== ref.k) throw changed(c, c && c.status === 'offen' ? 'als Rücklastschrift gebucht' : stateWord(c)); }
      for (const id of ref.ids) db.prepare("UPDATE mv_charge SET status = 'eingezogen', paid_at = NULL, paid_via = NULL WHERE id = ?").run(id);
      if (ref.prevStatus === 'erstellt') db.prepare("UPDATE mv_collection SET status = 'erstellt', booked_at = NULL WHERE id = ? AND status = 'gebucht'").run(ref.k);
      return true;
    }
    if (ref.charges) {   // Rücklastschrift: Posten zurück in den Einzug, Gebühr weg, Mandat wie vorher
      for (const x of ref.charges) { const c = one(x.id); if (!c || c.status !== 'offen' || c.collection_id || c.note !== ref.note) throw changed(c, c && c.status === 'offen' ? 'geändert' : stateWord(c)); }
      if (ref.feeId) { const f = one(ref.feeId); if (f && (f.status !== 'offen' || f.collection_id)) throw changed(f, stateWord(f)); if (f) db.prepare('DELETE FROM mv_charge WHERE id = ?').run(f.id); }
      for (const x of ref.charges) db.prepare('UPDATE mv_charge SET status = ?, collection_id = ?, paid_at = ?, paid_via = ?, note = ?, returns = MAX(returns - 1, 0) WHERE id = ?').run(x.status, x.collection_id, x.paid_at, x.paid_via, x.note, x.id);
      if (ref.revoked !== undefined) db.prepare('UPDATE mv_bank SET mandate_revoked = ? WHERE member_id = ?').run(ref.revoked, ref.payer);
      sh.collectionRecount(ref.k);
      store.hist(ref.payer, user, 'Rücklastschrift', null, 'zurückgenommen (Kontoauszug)');
      return true;
    }
    return true;
  };

  /** Storno eines per Kontoauszug bezahlten Postens: das Geld darf nicht still verschwinden (Guthaben oder zurücküberwiesen) */
  sh.paidByStatement = c => c.status === 'bezahlt' && c.paid_via === VIA;
}

module.exports = { register };
