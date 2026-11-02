'use strict';
/**
 * Kalenderdateien (iCalendar, RFC 5545) lesen – für den Kalender der Vereins-Homepage (Abo-Link).
 * Liefert die Termine in einem Zeitfenster als Ortszeit des Servers (wie alle Zeiten in Clubwerk):
 *   events(text, { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', max }) → [{ uid, date, start, end_date, end, title, place, note }]
 * Kann: Zeitzonen (TZID, UTC „Z“, ohne Angabe = Ortszeit), ganztägige und mehrtägige Termine, DURATION, Serien (RRULE mit
 * FREQ DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY), EXDATE, geänderte Einzeltermine (RECURRENCE-ID),
 * abgesagte Termine (STATUS:CANCELLED) fallen weg. Beschreibungen ohne HTML, gekürzt.
 */

const unfold = t => String(t || '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '');
const unesc = v => String(v || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
const clean = (v, n) => unesc(v).replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, n);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };

/* Wanduhrzeit in einer Zeitzone → Zeitpunkt (ms). Zweimal korrigieren reicht auch an den Umstellungstagen. */
const fmts = new Map();
function offsetMs(tz, t) {
  let f = fmts.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); fmts.set(tz, f); }
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
}
function zoned(y, mo, d, h, mi, tz) {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let t = wall - offsetMs(tz, wall); t = wall - offsetMs(tz, t);
  return t;
}
const LOCAL = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
function toLocal(t) { const d = new Date(t + offsetMs(LOCAL, t)); return { date: ymd(d), time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }; }

/** DTSTART/DTEND usw. → { allDay, date, time } in Ortszeit, oder null */
function when(line) {
  if (!line) return null;
  const m = /^([^:]*):(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z?))?/.exec(line);
  if (!m) return null;
  const [, params, y, mo, d, h, mi, , z] = m;
  if (h === undefined || /VALUE=DATE(?!-)/i.test(params)) return { allDay: true, date: `${y}-${mo}-${d}`, time: '' };
  let tz = (/TZID=("?)([^";:]+)\1/i.exec(params) || [])[2];
  if (tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch (e) { tz = LOCAL; } }   // Windows-Namen u. ä.: wie Ortszeit
  const t = z ? Date.UTC(+y, +mo - 1, +d, +h, +mi) : zoned(+y, +mo, +d, +h, +mi, tz || LOCAL);
  return { allDay: false, t, ...toLocal(t) };
}
function durationMs(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v || '').trim());
  if (!m) return null;
  return (m[1] === '-' ? -1 : 1) * ((+m[2] || 0) * 7 * 864e5 + (+m[3] || 0) * 864e5 + (+m[4] || 0) * 36e5 + (+m[5] || 0) * 6e4 + (+m[6] || 0) * 1e3);
}

/** Eine VEVENT-Komponente in Felder zerlegen (Name → [ganze Zeile ohne Namen], Parameter bleiben dran) */
function fields(block) {
  const f = {};
  for (const line of block.split('\n')) {
    const m = /^([A-Z][A-Z0-9-]*)([;:].*)$/i.exec(line);
    if (!m) continue;
    const k = m[1].toUpperCase(); (f[k] = f[k] || []).push(m[2].replace(/^:/, ':'));
  }
  return f;
}
const val = x => (x ? x.slice(x.indexOf(':') + 1) : '');

const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
/** Beginnzeitpunkte einer Serie (als Datum der Wanduhr + Uhrzeit wie der erste Termin), bis „to“, höchstens limit */
function series(start, rule, to, limit) {
  const r = Object.fromEntries(String(rule).split(';').map(p => p.split('=')).map(([k, v]) => [String(k).toUpperCase(), v || '']));
  const freq = r.FREQ, iv = Math.max(1, parseInt(r.INTERVAL, 10) || 1), count = parseInt(r.COUNT, 10) || 0;
  const until = r.UNTIL ? (/^(\d{4})(\d{2})(\d{2})/.exec(r.UNTIL) || []).slice(1).join('-') : null;
  const byday = r.BYDAY ? r.BYDAY.split(',').map(x => /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(x.trim())).filter(Boolean).map(x => ({ n: x[1] ? +x[1] : 0, wd: DAYS[x[2]] })) : [];
  const bymd = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number).filter(Boolean) : [];
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return [start];
  const out = []; let n = 0;
  const push = d => { if (d < start || (until && d > until)) return true; if (d > to) return false; n++; out.push(d); return !(count && n >= count) && out.length < limit; };
  const sd = new Date(start + 'T12:00:00Z');
  for (let i = 0; i < 5000; i++) {
    let cand = [];
    if (freq === 'DAILY') cand = [addDays(start, i * iv)];
    else if (freq === 'WEEKLY') {
      const wk = addDays(start, i * iv * 7 - ((sd.getUTCDay() + 6) % 7));   // Montag der Woche
      cand = (byday.length ? byday.map(b => (b.wd + 6) % 7) : [(sd.getUTCDay() + 6) % 7]).sort((a, b) => a - b).map(o => addDays(wk, o));
    } else {
      const base = new Date(sd); if (freq === 'MONTHLY') base.setUTCMonth(sd.getUTCMonth() + i * iv, 1); else base.setUTCFullYear(sd.getUTCFullYear() + i * iv, sd.getUTCMonth(), 1);
      const y = base.getUTCFullYear(), m = base.getUTCMonth(), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const months = freq === 'YEARLY' && r.BYMONTH ? r.BYMONTH.split(',').map(x => +x - 1) : [m];
      for (const mm of months) {
        const dimm = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();
        if (bymd.length) cand.push(...bymd.map(x => (x > 0 ? x : dimm + 1 + x)).filter(x => x >= 1 && x <= dimm).map(x => ymd(new Date(Date.UTC(y, mm, x)))));
        else if (byday.length) for (const b of byday) {
          const all = []; for (let x = 1; x <= dimm; x++) if (new Date(Date.UTC(y, mm, x)).getUTCDay() === b.wd) all.push(x);
          const pick = b.n > 0 ? [all[b.n - 1]] : b.n < 0 ? [all[all.length + b.n]] : all;
          cand.push(...pick.filter(Boolean).map(x => ymd(new Date(Date.UTC(y, mm, x)))));
        } else if (sd.getUTCDate() <= (freq === 'YEARLY' ? dimm : dim)) cand.push(ymd(new Date(Date.UTC(y, mm, sd.getUTCDate()))));
      }
      cand.sort();
    }
    for (const d of cand) if (!push(d)) return out;
    if (cand.length && cand[0] > to) return out;
  }
  return out;
}

function events(text, { from, to, max = 300 } = {}) {
  const blocks = unfold(text).split(/\nBEGIN:VEVENT\n|^BEGIN:VEVENT\n/).slice(1).map(b => b.split(/\nEND:VEVENT/)[0]);
  const all = blocks.map(fields), out = [], moved = new Map();
  // geänderte Einzeltermine einer Serie: ersetzen den ursprünglichen Termin (UID + ursprünglicher Beginn)
  for (const f of all) if (f['RECURRENCE-ID']) { const w = when(f['RECURRENCE-ID'][0]); if (w) moved.set(`${val(f.UID && f.UID[0])}|${w.date}`, true); }
  for (const f of all) {
    if (/^CANCELLED$/i.test(val(f.STATUS && f.STATUS[0]).trim()) && !f['RECURRENCE-ID']) continue;
    const s = when(f.DTSTART && f.DTSTART[0]); if (!s) continue;
    let e = when(f.DTEND && f.DTEND[0]);
    const dur = f.DURATION ? durationMs(val(f.DURATION[0])) : null;
    const span = e ? (s.allDay ? Math.round((Date.parse(e.date) - Date.parse(s.date)) / 864e5) : e.t - s.t) : dur != null ? (s.allDay ? Math.round(dur / 864e5) : dur) : (s.allDay ? 1 : 0);
    const uid = val(f.UID && f.UID[0]).trim().slice(0, 200);
    const title = clean(val(f.SUMMARY && f.SUMMARY[0]), 200) || 'Termin', place = clean(val(f.LOCATION && f.LOCATION[0]), 200), note = clean(val(f.DESCRIPTION && f.DESCRIPTION[0]), 1000);
    const ex = new Set((f.EXDATE || []).flatMap(x => { const params = x.slice(0, x.indexOf(':') + 1); return val(x).split(',').map(v => when(params + v)).filter(Boolean).map(w => w.date); }));
    const rule = f.RRULE && !f['RECURRENCE-ID'] ? val(f.RRULE[0]) : null;
    const days = rule ? series(s.date, rule, to, max * 2) : [s.date];
    for (const d of days) {
      if (ex.has(d) || (rule && moved.has(`${uid}|${d}`))) continue;
      if (/^CANCELLED$/i.test(val(f.STATUS && f.STATUS[0]).trim())) continue;
      let ev;
      if (s.allDay) ev = { date: d, start: '', end_date: addDays(d, Math.max(1, span) - 1), end: '' };
      else {
        const t0 = rule ? zoned(+d.slice(0, 4), +d.slice(5, 7), +d.slice(8, 10), +s.time.slice(0, 2), +s.time.slice(3, 5), LOCAL) : s.t;
        const a = toLocal(t0), b = toLocal(t0 + Math.max(0, span));
        ev = { date: a.date, start: a.time, end_date: b.date, end: span > 0 ? b.time : '' };
      }
      if (ev.end_date < from || ev.date > to) continue;
      out.push({ uid, ...ev, title, place, note });
    }
  }
  out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start) || a.title.localeCompare(b.title));
  return out.slice(0, max);
}

module.exports = { events };
