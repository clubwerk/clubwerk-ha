'use strict';
/* ---------- Geschäftsjahr des Vereins (planung/geschaeftsjahr.md) ----------
   Eine Einstellung im Kern: Monat, in dem das Geschäftsjahr beginnt (1 = Kalenderjahr). Gilt für Kündigungen,
   Jahresauswertungen und DATEV – unabhängig vom Beitragsjahr der Mitgliederverwaltung. Module lesen sie über
   ctx.geschaeftsjahr (nie über Einstellungen eines anderen Moduls). Früher lag nur „Wirtschaftsjahr beginnt im“
   in der Buchführung (gobd_cfg.wj_month); das übernimmt migrate() einmalig.
   Ein Geschäftsjahr heißt nach dem Kalenderjahr, in dem es beginnt: Jahr 2026 bei Beginn Mai = 01.05.2026–30.04.2027 („2026/27“). */
const { getSetting, setSetting } = require('./db');

const KEY = 'fiscal_month';
const clamp = m => Math.min(12, Math.max(1, parseInt(m, 10) || 1));
const pad = n => String(n).padStart(2, '0');

/** Beginnmonat 1–12 */
function month() { return clamp(getSetting(KEY, '1')); }
function set(m) { const v = clamp(m); setSetting(KEY, String(v)); return v; }

/** letzter Tag des Monats `m` (1–12) im Jahr `y` */
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Geschäftsjahr (Startjahr), in dem der Tag `day` (JJJJ-MM-TT) liegt */
function yearOf(day, m = month()) { const y = +day.slice(0, 4), mm = +day.slice(5, 7); return mm >= m ? y : y - 1; }
/** Zeitraum des Geschäftsjahres mit Startjahr `y`: { from, to } (JJJJ-MM-TT) */
function range(y, m = month()) {
  y = +y;
  const ey = m === 1 ? y : y + 1, em = m === 1 ? 12 : m - 1;
  return { from: `${y}-${pad(m)}-01`, to: `${ey}-${pad(em)}-${pad(lastDay(ey, em))}` };
}
/** erster und letzter Tag des Geschäftsjahres, in dem `day` liegt */
const startOf = (day, m = month()) => range(yearOf(day, m), m).from;
const endOf = (day, m = month()) => range(yearOf(day, m), m).to;
/** Anzeige: „2026“ (Kalenderjahr) bzw. „2026/27“ */
function label(y, m = month()) { y = +y; return m === 1 ? String(y) : `${y}/${String(y + 1).slice(2)}`; }
/** Zeitraum als Text „01.05.2026–30.04.2027“ */
function rangeText(y, m = month()) { const r = range(y, m), de = d => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`; return `${de(r.from)}–${de(r.to)}`; }
/** Liste der Geschäftsjahre zu einer Liste von Tagen (absteigend, ohne Doppelte), immer mit dem laufenden */
function yearsOf(days, today, m = month()) {
  const set = new Set([yearOf(today, m)]);
  for (const d of days || []) if (/^\d{4}-\d{2}/.test(String(d || ''))) set.add(yearOf(String(d).length >= 10 ? d : `${String(d).slice(0, 7)}-01`, m));
  return [...set].sort((a, b) => b - a);
}
/** Tag plus n Monate; fehlt der Tag im Zielmonat, gilt dessen letzter (31.01. + 1 Monat = 28./29.02.) */
function addMonths(day, n) {
  const [y, m, d] = day.split('-').map(Number), t = new Date(Date.UTC(y, m - 1 + n, 1)), ty = t.getUTCFullYear(), tm = t.getUTCMonth() + 1;
  return `${ty}-${pad(tm)}-${pad(Math.min(d, lastDay(ty, tm)))}`;
}
/** Frühester Austritt bei Kündigung am Tag `day` mit `months` Monaten Frist: Ende des ersten Geschäftsjahres, das
    frühestens `months` Monate nach dem Eingang endet. Frist 0 → Ende des laufenden Geschäftsjahres (Eingang am letzten
    Tag zählt noch); Frist 3, Geschäftsjahr = Kalenderjahr → Eingang bis 30.09. für den 31.12. An Monatsenden gilt der
    letzte Tag des Monats (Frist 1 zum 28.02. → Eingang bis 31.01.). */
function exitDate(day, months, m = month()) {
  const earliest = addMonths(day, Math.max(0, parseInt(months, 10) || 0));
  for (let y = yearOf(day, m), i = 0; i < 40; y++, i++) { const e = range(y, m).to; if (e >= earliest) return e; }
  return range(yearOf(earliest, m), m).to;
}
/** Kurzinfo für Oberflächen */
const info = () => { const m = month(); return { month: m, calendar: m === 1 }; };

/** Einmalig: „Wirtschaftsjahr beginnt im“ der Buchführung wird das Geschäftsjahr */
function migrate() {
  if (getSetting(KEY, null) !== null) return;
  let wj = 1; try { wj = clamp((JSON.parse(getSetting('gobd_cfg', '{}')) || {}).wj_month); } catch (e) { wj = 1; }
  setSetting(KEY, String(wj));
}

module.exports = { KEY, month, set, yearOf, range, startOf, endOf, label, rangeText, yearsOf, info, migrate, lastDay, addMonths, exitDate };
