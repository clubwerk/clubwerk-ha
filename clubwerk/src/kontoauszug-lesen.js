'use strict';
/* ---------- Kontoauszug lesen: CAMT (XML, auch als ZIP), Sparkassen-„CSV-CAMT“ und allgemeines CSV mit Spaltenzuordnung ----------
   Ergebnis je Datei: { format, iban, from, to, entries: [Buchung] } – nur gebuchte Umsätze, keine Vormerkungen.
   Buchung: { date, valDate, cents (+ Eingang, − Abbuchung), name, iban, purpose, e2e, batch, bankRef, mandate,
              ret: { code, origCents, feeCents } | null, sure (Referenzfelder vorhanden – CAMT bzw. CSV-CAMT) }
   XML wird mit einem eigenen kleinen Leser gelesen: DOCTYPE und Entitäten werden abgelehnt (keine externen Entitäten, keine „XML-Bomben“). */
const JSZip = require('jszip');
const { zipSize, zipUnsafe } = require('./util');

const fail = msg => Object.assign(new Error(msg), { fachlich: true });

/* ---------- XML ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unent = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()]));
/** XML in einen Baum { n: Name ohne Namensraum, a: Attribute, c: Kinder, t: Text } */
function parseXml(src) {
  if (/<!DOCTYPE|<!ENTITY/i.test(src)) throw fail('Die Datei enthält eine DOCTYPE-Angabe – so etwas liefern Banken nicht. Bitte die Originaldatei aus dem Online-Banking verwenden.');
  const root = { n: '#', a: {}, c: [], t: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m, pos = 0;
  while ((m = re.exec(src))) {
    if (m.index !== pos) throw fail('Die XML-Datei ist beschädigt.');
    pos = re.lastIndex;
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.t += m[1];
    else if (m[2]) {
      const name = m[2].replace(/^.*:/, '');
      if (stack.length < 2 || top.n !== name) throw fail('Die XML-Datei ist beschädigt.');
      stack.pop();
    } else if (m[3]) {
      const el = { n: m[3].replace(/^.*:/, ''), a: {}, c: [], t: '' };
      for (const x of m[4].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) el.a[x[1].replace(/^.*:/, '')] = unent(x[2] !== undefined ? x[2] : x[3]);
      top.c.push(el);
      if (!m[5]) { stack.push(el); if (stack.length > 60) throw fail('Die XML-Datei ist zu tief verschachtelt.'); }
    } else if (m[6] !== undefined) top.t += unent(m[6]);
  }
  if (pos !== src.length || stack.length !== 1) throw fail('Die XML-Datei ist unvollständig.');
  return root;
}
/** Kind (Pfad mit „/“) → erstes Element */
const el = (node, path) => { let n = node; for (const p of path.split('/')) { n = n && n.c.find(x => x.n === p); if (!n) return null; } return n; };
const els = (node, name) => (node ? node.c.filter(x => x.n === name) : []);
const tx = (node, path) => { const n = path ? el(node, path) : node; return n ? n.t.trim() : ''; };
const cents = v => { const n = Number(String(v || '').trim()); return Number.isFinite(n) ? Math.round(n * 100) : null; };
const dateOf = node => (tx(node, 'Dt') || tx(node, 'DtTm')).slice(0, 10);
const normIban = v => String(v || '').replace(/\s+/g, '').toUpperCase();
/** Name einer Partei: camt V08 Dbtr/Pty/Nm, ältere Versionen Dbtr/Nm */
const partyName = n => (n ? tx(n, 'Pty/Nm') || tx(n, 'Nm') : '');

const RETURN_RE = /R(?:UE|Ü)CKLASTSCHRIFT|RETOURE|LASTSCHRIFT\s*R(?:UE|Ü)CK/i;
const OUR_E2E = /^CW\d+-\d+$/;

function camtEntries(stmt, out) {
  for (const ntry of els(stmt, 'Ntry')) {
    const sts = tx(ntry, 'Sts/Cd') || tx(ntry, 'Sts');
    if (sts && sts !== 'BOOK') { out.pending++; continue; }
    if (tx(ntry, 'RvslInd') === 'true') { out.skipped++; continue; }   // Storno einer Buchung durch die Bank: nicht abgleichen
    const amt = el(ntry, 'Amt');
    if (amt && amt.a.Ccy && amt.a.Ccy !== 'EUR') { out.skipped++; continue; }
    const credit = tx(ntry, 'CdtDbtInd') === 'CRDT';
    const total = cents(tx(ntry, 'Amt'));
    if (total == null) continue;
    const base = { date: dateOf(el(ntry, 'BookgDt') || { c: [] }), valDate: dateOf(el(ntry, 'ValDt') || { c: [] }), bankRef: tx(ntry, 'AcctSvcrRef') || tx(ntry, 'NtryRef'),
      info: tx(ntry, 'AddtlNtryInf'), sub: tx(ntry, 'BkTxCd/Domn/Fmly/SubFmlyCd'), prop: tx(ntry, 'BkTxCd/Prtry/Cd') };
    const dtls = els(ntry, 'NtryDtls');
    const txs = dtls.flatMap(d => els(d, 'TxDtls'));
    const batch = dtls.map(d => tx(d, 'Btch/PmtInfId') || tx(d, 'Btch/MsgId')).find(Boolean) || '';
    const one = (t, i, amount) => {
      const rp = el(t, 'RltdPties') || { c: [] };
      const ret = el(t, 'RtrInf');
      const e2e = tx(t, 'Refs/EndToEndId');
      const instd = cents(tx(t, 'AmtDtls/InstdAmt/Amt')), txAmt = cents(tx(t, 'AmtDtls/TxAmt/Amt'));
      const chrgs = el(t, 'Chrgs');
      let fee = chrgs ? (cents(tx(chrgs, 'TtlChrgsAndTaxAmt')) ?? els(chrgs, 'Rcrd').reduce((s, r) => s + (cents(tx(r, 'Amt')) || 0), 0)) : 0;
      const isReturn = !credit && (Boolean(ret) || OUR_E2E.test(e2e) || base.sub === 'UPDD' || RETURN_RE.test(base.info));
      let orig = null;
      if (isReturn) {
        orig = instd != null ? instd : txAmt != null && txAmt !== amount ? txAmt : fee ? amount - fee : amount;
        if (!fee && orig < amount) fee = amount - orig;
      }
      const purpose = [...els(el(t, 'RmtInf'), 'Ustrd').map(u => u.t.trim()), tx(t, 'RmtInf/Strd/CdtrRefInf/Ref')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      // Gegenpartei: bei Eingängen der Zahler, bei Rücklastschriften der ursprüngliche Zahler der Lastschrift (Dbtr), sonst der Empfänger
      const sides = credit || isReturn ? ['Dbtr', 'Cdtr'] : ['Cdtr', 'Dbtr'];
      const side = sides.find(x => partyName(el(rp, x)) || tx(rp, `${x}Acct/Id/IBAN`)) || sides[0];
      return { ...base, cents: credit ? amount : -amount, name: partyName(el(rp, side)) || partyName(el(rp, side === 'Dbtr' ? 'UltmtDbtr' : 'UltmtCdtr')),
        iban: normIban(tx(rp, `${side}Acct/Id/IBAN`)), purpose: purpose || base.info, e2e: e2e === 'NOTPROVIDED' ? '' : e2e,
        batch: tx(t, 'Refs/PmtInfId') || batch, mandate: tx(t, 'Refs/MndtId'), txRef: tx(t, 'Refs/AcctSvcrRef') || (txs.length > 1 ? String(i) : ''),
        ret: isReturn ? { code: tx(ret || { c: [] }, 'Rsn/Cd') || tx(ret || { c: [] }, 'Rsn/Prtry'), origCents: orig, feeCents: fee || 0 } : null, sure: true };
    };
    // Lastschrift-Sammler des Vereins (eine Gutschrift für alle Lastschriften einer SEPA-Datei) bleibt eine Buchung
    const ourBatch = credit && (/CW\d{12}-\d+/.test(batch) || txs.some(t => /CW\d{12}-\d+/.test(tx(t, 'Refs/PmtInfId')) || OUR_E2E.test(tx(t, 'Refs/EndToEndId'))));
    let list;
    if (!txs.length) list = [{ ...base, cents: credit ? total : -total, name: '', iban: '', purpose: base.info, e2e: '', batch, mandate: '', txRef: '',
      ret: !credit && (base.sub === 'UPDD' || RETURN_RE.test(base.info)) ? { code: '', origCents: total, feeCents: 0 } : null, sure: true }];
    else if (ourBatch || txs.length === 1) {
      const e = one(txs[0], 0, total);
      list = [ourBatch ? { ...e, batch: batch || tx(txs[0], 'Refs/PmtInfId') || tx(txs[0], 'Refs/MsgId'), e2e: txs.length === 1 ? e.e2e : '', name: txs.length === 1 ? e.name : '', iban: txs.length === 1 ? e.iban : '', purpose: txs.length === 1 ? e.purpose : base.info, ret: null, txRef: '' } : e];
    } else {
      // mehrere Umsätze in einer Buchung (z. B. Sammel-Rücklastschrift): je Umsatz eine Buchung, sofern Beträge angegeben sind
      const parts = txs.map(t => cents(tx(t, 'Amt')) ?? cents(tx(t, 'AmtDtls/TxAmt/Amt')));
      if (parts.some(p => p == null)) list = [{ ...one(txs[0], 0, total), name: '', iban: '', e2e: '', txRef: '' }];
      else list = txs.map((t, i) => one(t, i, parts[i]));
    }
    for (const e of list) {
      if (e.cents < 0 && !e.ret) { out.debits++; continue; }   // Abbuchungen (Lieferanten, Strom …) zeigt und speichert Clubwerk nicht
      out.entries.push(e);
    }
  }
}
function readCamt(text) {
  const doc = parseXml(text);
  const d = doc.c.find(x => x.n === 'Document');
  const body = d && d.c.find(x => /^BkToCstmr/.test(x.n));
  if (!body) throw fail('Das ist keine CAMT-Datei (camt.052, camt.053 oder camt.054).');
  const ns = (text.match(/xmlns(?::\w+)?="urn:iso:std:iso:20022:tech:xsd:(camt\.\d{3}\.\d{3}\.\d{2})"/) || [])[1] || '';
  const out = { format: ns ? ns.replace(/^(camt\.\d{3})\.001\.(\d{2})$/, '$1 V$2') : 'CAMT', accounts: [] };
  for (const stmt of body.c.filter(x => ['Stmt', 'Rpt', 'Ntfctn'].includes(x.n))) {
    const r = { iban: normIban(tx(stmt, 'Acct/Id/IBAN')), from: (tx(stmt, 'FrToDt/FrDtTm') || '').slice(0, 10), to: (tx(stmt, 'FrToDt/ToDtTm') || '').slice(0, 10), entries: [], pending: 0, debits: 0, skipped: 0 };
    camtEntries(stmt, r);
    out.accounts.push(r);
  }
  if (!out.accounts.length) throw fail('In der CAMT-Datei steht kein Kontoauszug.');
  return out;
}

/* ---------- CSV ---------- */
function decode(buf) {
  let s;
  try { s = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) {
    try { s = new TextDecoder('windows-1252').decode(buf); } catch (e2) { s = buf.toString('latin1'); }
  }
  return s.replace(/^﻿/, '');
}
/** CSV mit ; , oder Tab, Felder in Anführungszeichen dürfen Zeilenumbrüche und "" enthalten */
function parseCsv(text) {
  const first = text.split(/\r?\n/).slice(0, 20).join('\n');
  const sep = [';', '\t', ','].map(c => [c, (first.match(new RegExp(c === '\t' ? '\t' : `\\${c}`, 'g')) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
    if (ch === '"' && f === '') q = true;
    else if (ch === sep) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x.trim() !== '')) rows.push(row.map(x => x.trim())); row = []; }
    else f += ch;
    if (rows.length > 20000) throw fail('Die Datei hat zu viele Zeilen.');
  }
  row.push(f); if (row.some(x => x.trim() !== '')) rows.push(row.map(x => x.trim()));
  return rows;
}
const hkey = h => String(h || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
/** Betrag „1.234,56“, „-12,50“, „1,234.56“ → Cent */
function amount(v) {
  let s = String(v || '').replace(/[\s€]|EUR/g, '');
  if (!s) return null;
  const neg = /^-|-$/.test(s) || /^\(.*\)$/.test(s); s = s.replace(/[-+()]/g, '');
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})*(\.\d+)?$|^\d+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else return null;
  const n = Math.round(Number(s) * 100);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
/** Datum „24.10.2026“, „24.10.26“, „2026-10-24“ → JJJJ-MM-TT */
function dateDe(v) {
  const s = String(v || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(s);
  if (!m) return '';
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/* Sparkassen-„CSV-CAMT“ (V2 und V8): Spalten werden über ihren Namen gefunden, nicht über die Position – so stört es nicht,
   wenn eine Version zusätzliche Spalten hat. Erkannt an „Auftragskonto“, „Buchungstag“, „Kundenreferenz (End-to-End)“ und „Betrag“. */
const SPK = { konto: 'auftragskonto', tag: 'buchungstag', valuta: 'valutadatum', text: 'buchungstext', zweck: 'verwendungszweck', mandat: 'mandatsreferenz',
  e2e: 'kundenreferenzendtoend', sammler: 'sammlerreferenz', ursprung: 'lastschriftursprungsbetrag', auslagen: 'auslagenersatzruecklastschrift',
  name: 'beguenstigterzahlungspflichtiger', iban: 'kontonummeriban', betrag: 'betrag', waehrung: 'waehrung', info: 'info' };
function spkHeader(row) {
  const keys = row.map(hkey);
  if (!['konto', 'tag', 'e2e', 'betrag'].every(k => keys.includes(SPK[k]))) return null;
  return Object.fromEntries(Object.entries(SPK).map(([k, h]) => [k, keys.indexOf(h)]));
}
function readSpk(rows, map) {
  const out = { format: 'Sparkasse CSV-CAMT', accounts: [] };
  const acc = new Map();
  const g = (r, k) => (map[k] >= 0 ? String(r[map[k]] || '').trim() : '');
  for (const r of rows.slice(1)) {
    const iban = normIban(g(r, 'konto'));
    if (!iban) continue;
    if (!acc.has(iban)) acc.set(iban, { iban, from: '', to: '', entries: [], pending: 0, debits: 0, skipped: 0 });
    const a = acc.get(iban);
    if (/vorgemerkt/i.test(g(r, 'info'))) { a.pending++; continue; }
    const c = amount(g(r, 'betrag')), date = dateDe(g(r, 'tag'));
    if (c == null || !date) { a.skipped++; continue; }
    if (g(r, 'waehrung') && g(r, 'waehrung').toUpperCase() !== 'EUR') { a.skipped++; continue; }
    const e2e = g(r, 'e2e'), text = g(r, 'text');
    const isReturn = c < 0 && (OUR_E2E.test(e2e) || RETURN_RE.test(text) || Boolean(g(r, 'auslagen')));
    if (c < 0 && !isReturn) { a.debits++; continue; }
    const fee = Math.abs(amount(g(r, 'auslagen')) || 0), orig = amount(g(r, 'ursprung'));
    a.entries.push({ date, valDate: dateDe(g(r, 'valuta')), cents: c, name: g(r, 'name'), iban: normIban(g(r, 'iban')), purpose: g(r, 'zweck').replace(/\s+/g, ' '),
      e2e: e2e === 'NOTPROVIDED' ? '' : e2e, batch: g(r, 'sammler'), mandate: g(r, 'mandat'), bankRef: '', info: text, txRef: '',
      ret: isReturn ? { code: '', origCents: orig != null ? Math.abs(orig) : Math.abs(c) - fee, feeCents: fee || (orig != null ? Math.max(0, Math.abs(c) - Math.abs(orig)) : 0) } : null, sure: true });
    if (!a.from || date < a.from) a.from = date;
    if (!a.to || date > a.to) a.to = date;
  }
  out.accounts = [...acc.values()];
  if (!out.accounts.length) throw fail('In der Datei stehen keine Umsätze.');
  return out;
}

/* Allgemeines CSV: Kopfzeile suchen (erste Zeile mit mindestens drei Spaltennamen, darunter etwas mit „Datum“/„Betrag“), Spalten vorschlagen */
const GUESS = {
  date: ['buchungstag', 'buchungsdatum', 'datum', 'buchung', 'date', 'valuta', 'wertstellung'],
  amount: ['betrag', 'umsatz', 'betrageur', 'betragineur', 'amount', 'betrage'],
  name: ['beguenstigterzahlungspflichtiger', 'zahlungspflichtiger', 'auftraggeberempfaenger', 'auftraggeber', 'empfaenger', 'name', 'gegenkonto', 'beguenstigter', 'zahlungsbeteiligter', 'auftraggeberbeguenstigter'],
  iban: ['iban', 'kontonummeriban', 'ibanauftraggeber', 'gegenkontoiban', 'kontonummer', 'ibanzahlungsbeteiligter'],
  purpose: ['verwendungszweck', 'zweck', 'buchungstext', 'beschreibung', 'text', 'reference', 'vorgang'],
  sh: ['sollhaben', 'sh', 'soll', 'kennzeichen'],
};
function headerRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const k = rows[i].map(hkey);
    if (rows[i].filter(Boolean).length >= 3 && k.some(x => GUESS.date.some(g => x.startsWith(g))) && k.some(x => GUESS.amount.some(g => x.startsWith(g)))) return i;
  }
  return -1;
}
function guessMap(header) {
  const k = header.map(hkey), used = new Set(), map = {};
  for (const [f, list] of Object.entries(GUESS)) {
    let hit = -1;
    for (const g of list) { hit = k.findIndex((x, i) => !used.has(i) && x === g); if (hit >= 0) break; }
    if (hit < 0) for (const g of list) { hit = k.findIndex((x, i) => !used.has(i) && x.startsWith(g)); if (hit >= 0) break; }
    map[f] = hit; if (hit >= 0) used.add(hit);
  }
  if (map.sh >= 0 && hkey(header[map.sh]) === 'soll') map.sh = -1;
  return map;
}
/** Kopfzeile + Beispielzeilen für die Spaltenzuordnung */
function csvLayout(rows) {
  const h = headerRow(rows);
  if (h < 0) throw fail('In der CSV-Datei wurde keine Kopfzeile mit „Datum“ und „Betrag“ gefunden.');
  const header = rows[h];
  return { header, headerAt: h, sample: rows.slice(h + 1, h + 6).map(r => header.map((x, i) => r[i] || '')), guess: guessMap(header), sig: header.map(hkey).join('|') };
}
function readCsvMapped(rows, map, iban) {
  const lay = csvLayout(rows);
  const n = v => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < lay.header.length ? Number(v) : -1);
  const m = { date: n(map.date), amount: n(map.amount), name: n(map.name), iban: n(map.iban), purpose: n(map.purpose), sh: n(map.sh) };
  if (m.date < 0 || m.amount < 0) throw fail('Bitte mindestens die Spalten für Datum und Betrag wählen.');
  const a = { iban, from: '', to: '', entries: [], pending: 0, debits: 0, skipped: 0 };
  const g = (r, k) => (m[k] >= 0 ? String(r[m[k]] || '').trim() : '');
  for (const r of rows.slice(lay.headerAt + 1)) {
    let c = amount(g(r, 'amount')); const date = dateDe(g(r, 'date'));
    if (c == null || !date) { a.skipped++; continue; }
    if (m.sh >= 0 && /^s/i.test(g(r, 'sh'))) c = -Math.abs(c);
    const purpose = g(r, 'purpose').replace(/\s+/g, ' ');
    const e2e = (/(?:EREF\+|End-?to-?End[^:]*:\s*)(\S+)/i.exec(purpose) || [])[1] || '';
    const isReturn = c < 0 && (RETURN_RE.test(purpose) || OUR_E2E.test(e2e));
    if (c < 0 && !isReturn) { a.debits++; continue; }
    a.entries.push({ date, valDate: '', cents: c, name: g(r, 'name'), iban: normIban(g(r, 'iban')), purpose, e2e: e2e === 'NOTPROVIDED' ? '' : e2e, batch: '', mandate: '', bankRef: '', info: '', txRef: '',
      ret: isReturn ? { code: '', origCents: Math.abs(c), feeCents: 0 } : null, sure: false });
    if (!a.from || date < a.from) a.from = date;
    if (!a.to || date > a.to) a.to = date;
  }
  return { format: 'CSV', accounts: [a], sig: lay.sig };
}

/* ---------- Einstieg ---------- */
const MAX_FILES = 200, MAX_UNZIPPED = 30 * 1024 * 1024;
/** Datei lesen → { kind: 'camt' | 'spk' | 'csv', results: [{ name, format, accounts }] } bzw. bei allgemeinem CSV ohne map: { kind: 'csv', layout } */
async function read(buf, { name = '', csv } = {}) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw fail('Die Datei ist leer.');
  if (buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    let zip; try { zip = await JSZip.loadAsync(buf); } catch (e) { throw fail('Das ZIP-Archiv lässt sich nicht öffnen.'); }
    if (zipUnsafe(zip)) throw fail('Ungültiger Dateiname im ZIP-Archiv.');
    const files = Object.values(zip.files).filter(f => !f.dir && /\.xml$/i.test(f.name) && !/(^|\/)(__MACOSX|\.)/.test(f.name));
    if (!files.length) throw fail('Im ZIP-Archiv ist keine CAMT-Datei (XML).');
    if (files.length > MAX_FILES || zipSize(files) > MAX_UNZIPPED) throw fail('Das ZIP-Archiv ist zu groß.');
    const results = [];
    for (const f of files) results.push({ name: f.name.replace(/^.*\//, ''), ...readCamt(decode(await f.async('nodebuffer'))) });
    return { kind: 'camt', results };
  }
  const text = decode(buf);
  if (/^\s*</.test(text)) return { kind: 'camt', results: [{ name, ...readCamt(text) }] };
  const rows = parseCsv(text);
  if (!rows.length) throw fail('Die Datei ist leer.');
  const spk = spkHeader(rows[0]);
  if (spk) return { kind: 'spk', results: [{ name, ...readSpk(rows, spk) }] };
  if (!csv || !csv.map) return { kind: 'csv', layout: csvLayout(rows) };
  return { kind: 'csv', results: [{ name, ...readCsvMapped(rows, csv.map, csv.iban) }] };
}

module.exports = { read, parseXml, parseCsv, amount, dateDe, normIban };
