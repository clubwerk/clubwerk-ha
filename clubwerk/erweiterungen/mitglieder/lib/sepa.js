'use strict';
/**
 * SEPA-Basislastschrift (CORE) als pain.008.001.08 – das Format, das deutsche Banken ab November 2026 verlangen
 * (ältere Versionen wie pain.008.001.02 werden dann nicht mehr angenommen).
 * Dazu: Prüfung von IBAN, BIC und Gläubiger-ID, SEPA-Zeichensatz, Bankarbeitstage (TARGET2).
 */

const IBAN_LEN = { AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28,
  IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27, VA: 22 };

const normIban = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function mod97(s) {
  const digits = s.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let r = 0;
  for (let i = 0; i < digits.length; i += 7) r = Number(String(r) + digits.slice(i, i + 7)) % 97;
  return r;
}
/** IBAN prüfen → { ok, iban (ohne Leerzeichen), error } */
function checkIban(v) {
  const iban = normIban(v);
  if (!iban) return { ok: false, iban, error: 'Bitte eine IBAN eingeben.' };
  const cc = iban.slice(0, 2);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return { ok: false, iban, error: 'Die IBAN beginnt mit zwei Buchstaben und zwei Ziffern (z. B. DE…).' };
  if (!IBAN_LEN[cc]) return { ok: false, iban, error: `IBANs aus „${cc}“ gehören nicht zum SEPA-Raum.` };
  if (iban.length !== IBAN_LEN[cc]) return { ok: false, iban, error: `Eine IBAN aus ${cc} hat ${IBAN_LEN[cc]} Zeichen (eingegeben: ${iban.length}).` };
  if (mod97(iban.slice(4) + iban.slice(0, 4)) !== 1) return { ok: false, iban, error: 'Die IBAN enthält einen Tippfehler (Prüfziffer passt nicht).' };
  return { ok: true, iban };
}
const fmtIban = v => normIban(v).replace(/(.{4})/g, '$1 ').trim();
const maskIban = v => { const i = normIban(v); return i ? `${i.slice(0, 4)} •••• •••• ${i.slice(-4)}` : ''; };
const checkBic = v => { const b = String(v || '').toUpperCase().replace(/\s/g, ''); return { ok: !b || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(b), bic: b }; };
/** Gläubiger-Identifikationsnummer (z. B. DE98ZZZ09999999999) */
function checkCreditorId(v) {
  const ci = String(v || '').toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{3}[A-Z0-9]{1,28}$/.test(ci)) return { ok: false, ci, error: 'Die Gläubiger-ID sieht so aus: DE98ZZZ09999999999.' };
  const check = ci.slice(7) + ci.slice(0, 2) + '00';
  const p = 98 - mod97(check);
  if (String(p).padStart(2, '0') !== ci.slice(2, 4)) return { ok: false, ci, error: 'Die Gläubiger-ID enthält einen Tippfehler (Prüfziffer passt nicht).' };
  return { ok: true, ci };
}
/** Mandatsreferenz: bis 35 Zeichen, nur A–Z a–z 0–9 + ? / - : ( ) . , ' und keine Leerzeichen */
const checkMandateRef = v => { const r = String(v || '').trim(); return { ok: /^[A-Za-z0-9+?/\-:().,']{1,35}$/.test(r), ref: r }; };

/* SEPA-Zeichensatz (Basis-Latein); Umlaute werden umschrieben */
const UML = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss', é: 'e', è: 'e', ê: 'e', á: 'a', à: 'a', â: 'a', ó: 'o', ò: 'o', ô: 'o', í: 'i', ì: 'i', ú: 'u', ù: 'u', ç: 'c', ñ: 'n', '&': '+', '–': '-', '—': '-', '„': '', '“': '', '”': '', '‚': '', '‘': "'", '’': "'", '€': 'EUR', '·': '-', '…': '...' };
function sepaText(v, max) {
  let s = String(v == null ? '' : v).replace(/[^\x00-\x7F]/g, c => (UML[c] !== undefined ? UML[c] : c.normalize('NFD').replace(/[̀-ͯ]/g, '')));
  s = s.replace(/&/g, '+').replace(/[^A-Za-z0-9 +?/\-:().,']/g, ' ').replace(/\s+/g, ' ').trim();
  return max ? s.slice(0, max).trim() : s;
}
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const amount = c => (Math.round(c) / 100).toFixed(2);

/* ---------- Bankarbeitstage (TARGET2: Sa/So, Neujahr, Karfreitag, Ostermontag, 1. Mai, 25./26. Dezember) ---------- */
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
const isoD = d => d.toISOString().slice(0, 10);
const parseD = s => new Date(s + 'T00:00:00Z');
function isBankDay(s) {
  const d = parseD(s), wd = d.getUTCDay();
  if (wd === 0 || wd === 6) return false;
  const md = s.slice(5);
  if (['01-01', '05-01', '12-25', '12-26'].includes(md)) return false;
  const e = easter(d.getUTCFullYear());
  const gf = new Date(e); gf.setUTCDate(e.getUTCDate() - 2);
  const em = new Date(e); em.setUTCDate(e.getUTCDate() + 1);
  return s !== isoD(gf) && s !== isoD(em);
}
function addDays(s, n) { const d = parseD(s); d.setUTCDate(d.getUTCDate() + n); return isoD(d); }
function nextBankDay(s) { let d = s; while (!isBankDay(d)) d = addDays(d, 1); return d; }
function addBankDays(s, n) { let d = s, k = 0; while (k < n) { d = addDays(d, 1); if (isBankDay(d)) k++; } return d; }
/**
 * Frühester Fälligkeitstag: Vorabinformation (Tage, Standard 14) und Einreichung bei der Bank (2 Bankarbeitstage Vorlauf,
 * sicherer Puffer – die Bank selbst verlangt mindestens 1). Fällt der Tag auf ein Wochenende/Feiertag, der nächste Bankarbeitstag.
 */
function earliestCollection(today, prenotifyDays = 14) {
  const byNotice = addDays(today, Math.max(1, prenotifyDays));
  const byBank = addBankDays(today, 2);
  return nextBankDay(byNotice > byBank ? byNotice : byBank);
}

/**
 * pain.008.001.08 erzeugen.
 * o = { msgId, created (ISO), initiator, creditor: { name, iban, bic, ci }, batches: [{ id, seqTp: 'FRST'|'RCUR', date, txs: [{ e2e, cents, mandateId, mandateDate, name, iban, bic, text }] }] }
 */
function buildPain008(o) {
  const all = o.batches.flatMap(b => b.txs);
  const sum = all.reduce((s, t) => s + t.cents, 0);
  const agent = bic => (bic ? `<FinInstnId><BICFI>${xml(bic)}</BICFI></FinInstnId>` : '<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>');
  const cr = o.creditor;
  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">');
  parts.push('<CstmrDrctDbtInitn>');
  parts.push(`<GrpHdr><MsgId>${xml(sepaText(o.msgId, 35).replace(/ /g, '-'))}</MsgId><CreDtTm>${xml(o.created.slice(0, 19))}</CreDtTm><NbOfTxs>${all.length}</NbOfTxs><CtrlSum>${amount(sum)}</CtrlSum>`
    + `<InitgPty><Nm>${xml(sepaText(o.initiator || cr.name, 70))}</Nm></InitgPty></GrpHdr>`);
  for (const b of o.batches) {
    if (!b.txs.length) continue;
    const bs = b.txs.reduce((s, t) => s + t.cents, 0);
    parts.push(`<PmtInf><PmtInfId>${xml(sepaText(b.id, 35).replace(/ /g, '-'))}</PmtInfId><PmtMtd>DD</PmtMtd><BtchBookg>true</BtchBookg><NbOfTxs>${b.txs.length}</NbOfTxs><CtrlSum>${amount(bs)}</CtrlSum>`
      + `<PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>${b.seqTp === 'FRST' ? 'FRST' : 'RCUR'}</SeqTp></PmtTpInf>`
      + `<ReqdColltnDt>${xml(b.date)}</ReqdColltnDt><Cdtr><Nm>${xml(sepaText(cr.name, 70))}</Nm></Cdtr><CdtrAcct><Id><IBAN>${xml(normIban(cr.iban))}</IBAN></Id></CdtrAcct>`
      + `<CdtrAgt>${agent(cr.bic)}</CdtrAgt><ChrgBr>SLEV</ChrgBr>`
      + `<CdtrSchmeId><Id><PrvtId><Othr><Id>${xml(cr.ci)}</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>`);
    for (const t of b.txs) {
      parts.push(`<DrctDbtTxInf><PmtId><EndToEndId>${xml(sepaText(t.e2e, 35).replace(/ /g, '-'))}</EndToEndId></PmtId><InstdAmt Ccy="EUR">${amount(t.cents)}</InstdAmt>`
        + `<DrctDbtTx><MndtRltdInf><MndtId>${xml(t.mandateId)}</MndtId><DtOfSgntr>${xml(t.mandateDate)}</DtOfSgntr></MndtRltdInf></DrctDbtTx>`
        + `<DbtrAgt>${agent(t.bic)}</DbtrAgt><Dbtr><Nm>${xml(sepaText(t.name, 70))}</Nm></Dbtr><DbtrAcct><Id><IBAN>${xml(normIban(t.iban))}</IBAN></Id></DbtrAcct>`
        + `<RmtInf><Ustrd>${xml(sepaText(t.text, 140))}</Ustrd></RmtInf></DrctDbtTxInf>`);
    }
    parts.push('</PmtInf>');
  }
  parts.push('</CstmrDrctDbtInitn></Document>');
  return parts.join('\n');
}

module.exports = { checkIban, checkBic, checkCreditorId, checkMandateRef, normIban, fmtIban, maskIban, sepaText, buildPain008, isBankDay, addDays, addBankDays, nextBankDay, earliestCollection };
