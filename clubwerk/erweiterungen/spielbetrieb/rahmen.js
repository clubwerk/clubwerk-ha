'use strict';
/* =====================================================================================================
   Rahmenterminplan des Verbands (PDF, Kalender mit einer Spalte je Monat) → Termine je Altersklasse.
   Liest die Wörter mit ihrer Lage auf der Seite (pdftotext -bbox) und ordnet jeden Eintrag über Spalte (Monat)
   und Zeile (Tag) einem Datum zu. Erkennt reguläre Spieltage, Zusatz-/Ausweichtage („Z/A“) und Hessenliga („HL …“).
   Ein bloßes „Z/A“ ohne Klassen gilt für alle Klassen, die regulär an diesem Wochentag spielen.
   ===================================================================================================== */
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const MONTHS = { januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };
const WEEKDAYS = new Set(['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unesc = s => String(s).replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e] ?? m)));
const pad = n => String(n).padStart(2, '0');

/** PDF → HTML mit Wortpositionen */
function bbox(buf) {
  return new Promise((resolve, reject) => {
    const file = path.join(os.tmpdir(), `cw-rtp-${crypto.randomBytes(8).toString('hex')}.pdf`);
    fs.writeFileSync(file, buf, { mode: 0o600 });
    execFile('pdftotext', ['-bbox', '-enc', 'UTF-8', file, '-'], { maxBuffer: 20 * 1024 * 1024, timeout: 30000 }, (err, out) => {
      fs.rm(file, { force: true }, () => {});
      if (err) return reject(new Error(err.code === 'ENOENT' ? 'PDF-Werkzeug fehlt (pdftotext).' : 'Die PDF konnte nicht gelesen werden.'));
      resolve(String(out));
    });
  });
}

/** Klassen aus dem Text einer Tageszeile: { reg: [...], za: [...], bareZa } */
function classesOf(text) {
  let t = ` ${text} `;
  const reg = [], za = [];
  const hl = [];
  t = t.replace(/\bHL\s+(Damen\s*\/\s*Herren|[HDU]\d{0,2})(?![\w/])/g, (m, c) => { hl.push('HL ' + c.replace(/\s+/g, '')); return ' '; });
  const i = t.indexOf('Z/A');
  const before = i >= 0 ? t.slice(0, i) : t, after = i >= 0 ? t.slice(i + 3) : '';
  const pick = s => (s.match(/(?<![\w/])[HDU]\d{0,2}(?![\w/])/g) || []);
  reg.push(...hl, ...pick(before));
  za.push(...pick(after));
  return { reg, za, bareZa: i >= 0 && !za.length };
}

/** Wörter der Seiten → { year, classes: { 'H40': { dates: [...], za: [...] } }, notes: { datum: text } } */
function parseBbox(html) {
  const pages = String(html).split(/<page\b/i).slice(1);
  const days = {};   // 'YYYY-MM-DD' → Text der Zeile
  let year = null;
  for (const pg of pages) {
    const W = [];
    const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
    let m; while ((m = re.exec(pg))) W.push({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], t: unesc(m[5]).trim(), yc: (+m[2] + +m[4]) / 2 });
    // Monatsköpfe: „Mai 2027“
    const heads = [];
    for (let i = 0; i < W.length - 1; i++) {
      const mo = MONTHS[W[i].t.toLowerCase()];
      if (mo && /^20\d\d$/.test(W[i + 1].t) && Math.abs(W[i + 1].yc - W[i].yc) < 3) { heads.push({ x: W[i].x0, y: W[i].yc, mo, year: +W[i + 1].t }); }
    }
    if (!heads.length) continue;
    heads.sort((a, b) => a.x - b.x);
    year = year || heads[0].year;
    const yHead = Math.max(...heads.map(h => h.y));
    // Spalten: Tageszahl „01“ unter den Köpfen, von links nach rechts
    const ones = W.filter(w => /^0?1$/.test(w.t) && w.yc > yHead).sort((a, b) => a.yc - b.yc || a.x0 - b.x0);
    if (!ones.length) continue;
    const firstRow = ones.filter(w => Math.abs(w.yc - ones[0].yc) < 3).sort((a, b) => a.x0 - b.x0);
    if (firstRow.length !== heads.length) throw new Error(`Spalten passen nicht zu den Monaten (${firstRow.length} Spalten, ${heads.length} Monate).`);
    firstRow.forEach((c, i) => {
      const xe = i + 1 < firstRow.length ? firstRow[i + 1].x0 : Infinity;
      const h = heads[i];
      for (const d of W.filter(w => /^\d\d?$/.test(w.t) && Math.abs(w.x0 - c.x0) < 4 && w.yc >= c.yc - 2)) {
        const n = +d.t; if (n < 1 || n > 31) continue;
        const iso = `${h.year}-${pad(h.mo)}-${pad(n)}`;
        const dt = new Date(iso + 'T12:00:00Z'); if (dt.getUTCMonth() + 1 !== h.mo) continue;
        const toks = W.filter(w => Math.abs(w.yc - d.yc) < 3.5 && w.x0 > d.x1 && w.x0 < xe - 3).sort((a, b) => a.x0 - b.x0).map(w => w.t);
        if (toks.length && WEEKDAYS.has(toks[0].toLowerCase())) toks.shift();
        days[iso] = toks.join(' ');
      }
    });
  }
  if (!year || !Object.keys(days).length) throw new Error('Kein Kalender erkannt – ist das der Rahmenterminplan als PDF (nicht eingescannt)?');
  return fromDays(days, year);
}

/** { datum: zeilentext } → Klassen mit Terminen */
function fromDays(days, year) {
  const classes = {}, bare = [], notes = {};
  const C = k => (classes[k] = classes[k] || { dates: [], za: [] });
  for (const [d, text] of Object.entries(days).sort()) {
    if (!text) continue;
    const r = classesOf(text);
    r.reg.forEach(k => C(k).dates.push(d));
    r.za.forEach(k => C(k).za.push(d));
    if (r.bareZa) bare.push(d);
    const rest = text.replace(/\bHL\s+(Damen\s*\/\s*Herren|[HDU]\d{0,2})/g, '').replace(/Z\/A/g, '').replace(/(?<![\w/])[HDU]\d{0,2}(?![\w/])/g, '').replace(/[,\s]+/g, ' ').trim();
    if (rest) notes[d] = rest;
  }
  // bloßes „Z/A“: für die Klassen, die regulär an diesem Wochentag spielen (Hessenliga ausgenommen)
  const dow = d => new Date(d + 'T12:00:00Z').getUTCDay();
  for (const d of bare) for (const [k, v] of Object.entries(classes)) if (!k.startsWith('HL ') && v.dates.some(x => dow(x) === dow(d)) && !v.za.includes(d) && !v.dates.includes(d)) v.za.push(d);
  for (const v of Object.values(classes)) { v.dates = [...new Set(v.dates)].sort(); v.za = [...new Set(v.za)].filter(d => !v.dates.includes(d)).sort(); }
  return { year, classes, notes };
}

async function parsePdf(buf) { return parseBbox(await bbox(buf)); }

/** Altersklasse aus Name/Liga erraten: „Herren 40“ → H40, „D00“ → D, „H40 (4er) - KB“ → H40, „Hessenliga …“ → HL … */
function guessClass(name, league) {
  const s = `${name || ''} ${league || ''}`;
  let c = null, m;
  if ((m = s.match(/\b([HD])(\d{2})\b/))) c = m[2] === '00' ? m[1] : m[1] + m[2];
  else if ((m = s.match(/\b(Herren|Damen)\s*(\d{2})\b/i))) c = m[1][0].toUpperCase() + (m[2] === '00' ? '' : m[2]);
  else if ((m = s.match(/\b(Herren|Damen)\b/i))) c = m[1][0].toUpperCase();
  else if ((m = s.match(/\b([HD])\b/))) c = m[1];
  if (c && /hessenliga|\bHL\b/i.test(s)) c = /^[HD]$/.test(c) ? 'HL Damen/Herren' : 'HL ' + c;
  return c;
}

module.exports = { parsePdf, parseBbox, fromDays, classesOf, guessClass };
