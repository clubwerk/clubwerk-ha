'use strict';
/* Flutlicht – Rechenregeln ohne Datenbank und ohne eigene Uhr (die Uhrzeit kommt immer als Argument):
   Sonnenuntergang, Dunkelheit, Nachtruhe, Saison, Sperrtage, Automatik aus Buchungen und Lichtgeld.
   Zeiten sind lokale Zeitstempel „JJJJ-MM-TT HH:MM:SS“ (wie überall in Clubwerk) bzw. Date-Objekte in lokaler Zeit.
   Die Testreihe fl prüft diese Regeln direkt. */
const pad = n => String(n).padStart(2, '0');
const ts = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const dayOf = d => ts(d).slice(0, 10);
const hm = d => ts(d).slice(11, 16);
/** „JJJJ-MM-TT[ HH:MM[:SS]]“ → Date (lokal) oder null */
function parse(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) : null;
}
const toMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
/** Tag + „HH:MM“ → Date; „24:00“ ist Mitternacht am Ende des Tages */
function at(day, hhmm) { const d = parse(day); const m = toMin(hhmm); d.setHours(0, m, 0, 0); return d; }
const addMin = (d, n) => new Date(d.getTime() + n * 60000);
const NIGHT_END = 6 * 60;   // Nachtruhe endet um 6 Uhr

/* ---------- Sonnenuntergang (Sonnenaufgangsgleichung wie bei der NOAA, lokal gerechnet, ohne Internet) ---------- */
const RAD = Math.PI / 180;
/** Sonnenuntergang am Tag `day` am Ort lat/lon → Date; null, wenn die Sonne an dem Tag nicht untergeht bzw. nicht aufgeht */
function sunset(day, lat, lon) {
  const d = parse(day);
  const jd = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12) / 86400000 + 2440587.5;   // Julianisches Datum, Mittag UTC
  const n = Math.round(jd - 2451545.0 + 0.0008);
  const jstar = n - lon / 360;
  const M = ((357.5291 + 0.98560028 * jstar) % 360 + 360) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545.0 + jstar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const decl = Math.asin(Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD));
  const cosw = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
  if (cosw > 1 || cosw < -1) return null;
  const set = transit + Math.acos(cosw) / RAD / 360;
  return new Date(Math.round((set - 2440587.5) * 86400000 / 60000) * 60000);   // auf die Minute
}

/* ---------- Tage: Nachtruhe, Saison, Sperrtage ---------- */
/** Beginn der Nachtruhe am Abend von `day` (Einstellung je Wochentag, So = 0) */
const quietStart = (cfg, day) => at(day, cfg.quiet[parse(day).getDay()]);
/** gilt gerade Nachtruhe? Ab der eingestellten Uhrzeit bis 6 Uhr morgens */
function isQuiet(cfg, now) {
  const t = now.getHours() * 60 + now.getMinutes();
  return t < NIGHT_END || t >= toMin(cfg.quiet[now.getDay()]);
}
/** Saison „MM-TT“ bis „MM-TT“ (auch über den Jahreswechsel); ohne Saison immer */
function inSeason(cfg, day) {
  if (!cfg.season) return true;
  const md = day.slice(5);
  const { from, to } = cfg.season;
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}
const blockedOn = (cfg, day) => (cfg.blockDays || []).find(b => b.from <= day && day <= (b.to || b.from)) || null;

/** Darf ein Mitglied (App, Tablet) bzw. die Automatik jetzt schalten? → null oder Grund in Alltagssprache */
function memberBlock(cfg, now, darkFrom) {
  const day = dayOf(now);
  if (!inSeason(cfg, day)) return 'Außerhalb der Saison bleibt das Licht aus.';
  const b = blockedOn(cfg, day);
  if (b) return `Heute bleibt das Licht aus${b.note ? ': ' + b.note : ''}.`;
  if (isQuiet(cfg, now)) return 'Nachtruhe – das Licht bleibt bis morgen aus.';
  if (!darkFrom) return 'Heute wird es nicht dunkel.';
  if (now < darkFrom) return `Es ist noch hell – Licht geht ab ${hm(darkFrom)} Uhr.`;
  return null;
}

/* ---------- Automatik: Buchungen → gewünschte Anforderungen ---------- */
/** Wer für eine Buchung Lichtgeld zahlt: nur Einzelbuchungen von Personen (Serien, Vereins- und Turnierbuchungen sind frei) */
const bookingPays = b => b.kind === 'buchung' && Boolean(b.member_id);
/**
 * Gewünschte Anforderungen der Automatik für einen Tag.
 * lights: [{ id, court: { src, id } | null, pre, post }], bookings: [{ id, resource_id, date, start, end, kind, member_id }] (Quelle src)
 * → [{ light, booking, src, start, end, bookStart, bookEnd, pays, member_id }] (Date-Objekte)
 */
function autoClaims(cfg, lights, bookings, src, day, darkFrom) {
  if (!darkFrom || !inSeason(cfg, day) || blockedOn(cfg, day)) return [];
  const quiet = quietStart(cfg, day), out = [];
  for (const l of lights) {
    if (!l.court || l.court.src !== src) continue;
    for (const b of bookings) {
      if (b.resource_id !== l.court.id || b.date !== day) continue;
      const bs = at(day, b.start), be = at(day, b.end);
      if (be <= darkFrom) continue;   // vor der Dunkelheit vorbei
      const start = new Date(Math.max(addMin(bs, -(l.pre || 0)).getTime(), darkFrom.getTime()));
      const end = new Date(Math.min(addMin(be, l.post || 0).getTime(), quiet.getTime()));
      if (start >= end) continue;
      out.push({ light: l.id, booking: b.id, src, start, end, bookStart: bs, bookEnd: be, pays: bookingPays(b), member_id: b.member_id || null });
    }
  }
  return out;
}

/* ---------- Lichtgeld ---------- */
/**
 * Lichtgeld einer beendeten Anforderung → { quarters, cents }.
 * c: { source, pays, start, planned_end, ended_at, book_start, book_end, booking_gone_at, fee_rate, fee_from } (Zeitstempel als Text)
 * Bezahlt wird die Zeit ab „Lichtgeld ab“ bis zum Ende (höchstens bis zum geplanten Ende – ein Neustart verlängert nichts);
 * bei der Automatik nur die gebuchte Zeit (Vorlauf und Nachlauf frei) und nur bis zum Storno der Buchung.
 * Je angefangene Viertelstunde der Betrag, der beim Einschalten galt.
 */
function fee(c) {
  if (!c.pays || !c.fee_rate) return { quarters: 0, cents: 0 };
  let s = parse(c.start), e = parse(c.ended_at && c.ended_at < c.planned_end ? c.ended_at : c.planned_end);
  if (c.source === 'auto') {
    s = new Date(Math.max(s, parse(c.book_start)));
    e = new Date(Math.min(e, parse(c.book_end), c.booking_gone_at ? parse(c.booking_gone_at) : Infinity));
  }
  const evening = s.getHours() * 60 + s.getMinutes() < NIGHT_END ? dayOf(addMin(s, -24 * 60)) : dayOf(s);
  s = new Date(Math.max(s, at(evening, c.fee_from || '00:00')));
  const sec = Math.round((e - s) / 1000);
  if (sec <= 0) return { quarters: 0, cents: 0 };
  const quarters = Math.ceil(sec / 900);
  return { quarters, cents: quarters * c.fee_rate };
}

module.exports = { ts, dayOf, hm, parse, toMin, at, addMin, sunset, quietStart, isQuiet, inSeason, blockedOn, memberBlock, bookingPays, autoClaims, fee, NIGHT_END };
