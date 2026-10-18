'use strict';
/**
 * Beitragsberechnung (rein rechnerisch, ohne Datenbank)
 *  - Jeder zugeordnete Beitrag merkt sich „gebucht bis“. Ein Beitragslauf bis Datum X erzeugt alle Zeiträume ab dem Tag danach,
 *    die bis X beginnen – nie doppelt.
 *  - Zeiträume richten sich am Beitragsjahr aus (z. B. 01.05.–30.04.). Wer mitten im Jahr eintritt, zahlt bis zum nächsten
 *    Stichtag anteilig (volle Monate, der Eintrittsmonat zählt mit) – oder voll, wenn der Beitrag so eingestellt ist.
 *  - Ab dem Austritts- bzw. Enddatum beginnen keine neuen Zeiträume mehr.
 */
const MONTHS = { jahr: 12, halbjahr: 6, quartal: 3, monat: 1, einmalig: 0 };
const pad = n => String(n).padStart(2, '0');
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const addMonths = (s, n) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`; };
const monthIndex = s => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7)) - 1;

/** nächster Stichtag (Beginn eines Zeitraums) nach dem Tag `from`; yearStart = 'MM-DD', step in Monaten */
function nextAnchor(from, yearStart, step) {
  // erster Stichtag im Jahr vor `from`, dann in Schritten vorwärts
  let a = `${Number(from.slice(0, 4)) - 1}-${yearStart}`;
  while (a <= from) a = addMonths(a, step);
  return a;
}
const isAnchor = (d, yearStart, step) => { let a = `${Number(d.slice(0, 4)) - 1}-${yearStart}`; while (a < d) a = addMonths(a, step); return a === d; };

/** Alter an einem Tag (volle Jahre) */
function ageAt(birth, day) {
  if (!isDate(birth) || !isDate(day)) return null;
  let a = Number(day.slice(0, 4)) - Number(birth.slice(0, 4));
  if (day.slice(5) < birth.slice(5)) a--;
  return a;
}

/**
 * Zeiträume eines zugeordneten Beitrags bis `until`.
 * mf = { start_date, end_date, booked_until, cents, interval, prorate }   prorate: anteilig | voll | frei (Eintrittsjahr frei)   (cents = gültiger Betrag je Zeitraum)
 * limit = Austrittsdatum (oder null); yearStart = 'MM-DD'
 * → [{ from, to, cents, partial, months }]
 */
function periods(mf, until, { limit = null, yearStart = '01-01' } = {}) {
  const out = [];
  if (!isDate(until) || !isDate(mf.start_date)) return out;
  const step = MONTHS[mf.interval];
  const stop = [mf.end_date, limit].filter(isDate).sort()[0] || null;
  if (step === undefined) return out;
  if (step === 0) {   // einmalig (z. B. Aufnahmegebühr)
    if (!mf.booked_until && mf.start_date <= until && (!stop || mf.start_date <= stop)) out.push({ from: mf.start_date, to: mf.start_date, cents: mf.cents, partial: false, months: 0 });
    return out;
  }
  let cur = mf.booked_until ? addDays(mf.booked_until, 1) : mf.start_date;
  if (cur < mf.start_date) cur = mf.start_date;
  for (let guard = 0; guard < 600 && cur <= until && (!stop || cur <= stop); guard++) {
    const next = nextAnchor(cur, yearStart, step);
    const to = addDays(next, -1);
    let cents = mf.cents, partial = false, months = step;
    if (!isAnchor(cur, yearStart, step)) {
      months = Math.max(1, Math.min(step, monthIndex(next) - monthIndex(cur)));
      partial = true;
      if (mf.prorate !== 'voll') cents = Math.round(mf.cents * months / step);
    }
    out.push({ from: cur, to, cents, partial, months });
    cur = next;
  }
  // „Eintrittsjahr frei“: alles im Beitragsjahr des Beginns kostet nichts (wird aber als abgerechnet vermerkt)
  if (mf.prorate === 'frei') {
    const freeEnd = addDays(nextAnchor(mf.start_date, yearStart, 12), -1);
    for (const p of out) if (p.from <= freeEnd) { p.cents = 0; p.free = true; }
  }
  return out;
}

/**
 * Passende Altersstufe aus einer Liste von Beiträgen (age_min/age_max).
 * Ohne Geburtsdatum gilt die Stufe ohne Obergrenze mit dem höchsten Mindestalter (= Erwachsene) – markiert als assumed.
 * → { fee, age, assumed }
 */
function pickByAge(list, birth, day) {
  const age = ageAt(birth, day);
  if (!list || !list.length) return { fee: null, age, assumed: false };
  if (age == null) {
    const open = list.filter(f => f.age_max == null).sort((a, b) => (b.age_min || 0) - (a.age_min || 0));
    return { fee: open[0] || null, age: null, assumed: true };
  }
  return { fee: list.find(f => (f.age_min == null || age >= f.age_min) && (f.age_max == null || age <= f.age_max)) || null, age, assumed: false };
}

const INTERVAL_LABEL ={ jahr: 'jährlich', halbjahr: 'halbjährlich', quartal: 'vierteljährlich', monat: 'monatlich', einmalig: 'einmalig' };
const deD = s => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '');
/** „05/2026–04/2027“ bzw. „Mai 2026“ für Buchungstexte */
function periodText(from, to) {
  if (from === to) return deD(from);
  const a = `${from.slice(5, 7)}/${from.slice(0, 4)}`, b = `${to.slice(5, 7)}/${to.slice(0, 4)}`;
  return a === b ? a : `${a}–${b}`;
}

module.exports = { MONTHS, INTERVAL_LABEL, periods, ageAt, pickByAge, isDate, addDays, addMonths, nextAnchor, periodText, deD };
