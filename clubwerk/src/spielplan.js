'use strict';
/* Spielplan-Import (Kern – genutzt vom Buchungssystem und vom Spielbetrieb) – reine Lesefunktionen, ohne Datenbank.
   Quellen:
   - eingefügte Tabelle von der Verbandsseite (nuLiga „Begegnungen“, aber auch andere Tabellen, durch Tabulator getrennt)
   - CSV (Semikolon/Komma) oder Excel (.xlsx, erstes Blatt) mit Datum, Uhrzeit, Heim, Gast
   - Kalenderdatei (.ics), z. B. „Spielplan exportieren“ bei fussball.de oder nuLiga
   Ergebnis: Spiele { date, start, league, team, size, home, guest, venue } – ob Heimspiel, entscheidet der Aufrufer mit dem Vereinsnamen. */

const DATE_RE = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/;
const TIME_RE = /(?:^|\D)([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*Uhr)?(?:\D|$)/;
const WEEKDAY_RE = /^(mo|di|mi|do|fr|sa|so)\.?$/i;
const SCORE_RE = /^\d+\s*:\s*\d+$/;
const NOISE_RE = /^(anzeigen|zurückgezogen|gast\s*-\s*w\.?\s*o\.?|heim\s*-\s*w\.?\s*o\.?|w\.?\s*o\.?|spielfrei|abgesagt|verlegt|nicht angetreten|-|–|\[routenplan\]|routenplan|spielbericht|info|zum spiel)$/i;
const LEAGUE_RE = /\(\s*\d+\s*er\s*\)|\b(KA|KB|KC|KK|KL|BL|BZ|BOL|BK|VL|HL|OL|RL|LL|GL)\b|liga|klasse|staffel|pokal|junior|jugend|senioren|herren|damen|mixed|freizeit/i;
const pad = n => String(n).padStart(2, '0');
const clean = s => String(s == null ? '' : s).replace(/[​-‍﻿]/g, '').replace(/\[Routenplan\]/gi, '').replace(/\s+/g, ' ').trim();
const norm = s => clean(s).toLowerCase().replace(/[^a-z0-9äöüß]+/g, '');

function parseDate(s) {
  const m = String(s).match(DATE_RE); if (!m) return null;
  let y = +m[3]; if (y < 100) y += 2000;
  const d = `${y}-${pad(m[2])}-${pad(m[1])}`;
  return Number.isNaN(Date.parse(d + 'T12:00:00Z')) ? null : d;
}
function parseTime(s) { const m = String(s).replace(DATE_RE, ' ').match(TIME_RE); return m ? `${pad(m[1])}:${m[2]}` : null; }

/** „H30 (6er) - KA“ → { team: 'H30', size: 6 }; „Herren | Kreisliga B“ → { team: 'Herren', size: null } */
function teamOf(league) {
  const l = clean(league); if (!l) return { team: '', size: null };
  const size = (l.match(/\(\s*(\d+)\s*er\s*\)/i) || [])[1];
  const team = clean(l.split(/\s+[-–|]\s+|\s*\|\s*/)[0].replace(/\(\s*\d+\s*er\s*\)/i, '')) || l;
  return { team, size: size ? +size : null };
}

/* ---------- Tabellen (eingefügt, CSV, Excel) ---------- */
function splitRows(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim());
  // Trennzeichen: Tabulator (eingefügt aus dem Browser/Excel), sonst Semikolon, sonst Komma
  const tabs = lines.filter(l => l.includes('\t')).length, semi = lines.filter(l => l.includes(';')).length;
  const sep = tabs >= lines.length / 3 ? '\t' : semi >= lines.length / 3 ? ';' : ',';
  return lines.map(l => (sep === '\t' ? l.split('\t') : csvSplit(l, sep)).map(clean));
}
function csvSplit(line, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out;
}

/** Zeilen → Spiele. Spaltenköpfe werden genutzt, wenn vorhanden; sonst (z. B. nuLiga mit eigener Wochentagsspalte) nach Inhalt. */
function fromRows(rows) {
  const games = [], skipped = [];
  let header = null;
  const hi = rows.findIndex(r => r.some(c => /^datum/i.test(c)) && r.some(c => /heim/i.test(c)) && r.some(c => /gast/i.test(c)));
  if (hi >= 0) {
    const h = rows[hi].map(c => c.toLowerCase());
    const col = re => h.findIndex(c => re.test(c));
    header = { date: col(/^datum/), time: col(/^(zeit|uhrzeit|beginn|anstoß|anstoss)/), venue: col(/spielort|^ort|platz|halle/), league: col(/liga|staffel|wettbewerb|mannschaft|klasse|altersklasse/), home: col(/heim/), guest: col(/gast/), width: h.length };
  }
  let lastDate = null, lastTime = null;
  rows.forEach((cells, i) => {
    if (i <= hi) return;
    let date = null, time = null, venue = '', league = '', home = '', guest = '';
    if (header && cells.length === header.width && header.home >= 0 && header.guest >= 0) {   // passt zum Kopf
      date = parseDate(cells[header.date] || ''); time = parseTime(cells[header.date] || '') || (header.time >= 0 ? parseTime(cells[header.time] || '') : null);
      venue = header.venue >= 0 ? cells[header.venue] : ''; league = header.league >= 0 ? cells[header.league] : '';
      home = cells[header.home]; guest = cells[header.guest];
    } else {   // nach Inhalt: Datum/Uhrzeit, dann die Textzellen [Spielort] [Liga] Heim Gast
      const di = cells.findIndex(c => DATE_RE.test(c));
      if (di >= 0) { date = parseDate(cells[di]); time = parseTime(cells[di]) || parseTime(cells[di + 1] || ''); }
      const texts = cells.map((c, k) => ({ c, k })).filter(({ c, k }) => c && k !== di && !WEEKDAY_RE.test(c) && !SCORE_RE.test(c) && !NOISE_RE.test(c) && !DATE_RE.test(c) && !/^([01]?\d|2[0-3])[:.][0-5]\d(\s*Uhr)?$/i.test(c));
      if (texts.length < 2) { if (cells.some(Boolean)) skipped.push({ row: i + 1, why: 'keine zwei Mannschaften erkannt', text: cells.filter(Boolean).join(' · ').slice(0, 120) }); return; }
      guest = texts[texts.length - 1].c; home = texts[texts.length - 2].c;
      const rest = texts.slice(0, -2);
      const li = rest.findIndex(x => LEAGUE_RE.test(x.c));
      if (li >= 0) { league = rest[li].c; venue = rest.slice(0, li).map(x => x.c).join(' '); }
      else if (rest.length) { league = rest[rest.length - 1].c; venue = rest.slice(0, -1).map(x => x.c).join(' '); }
    }
    if (!home || !guest) return;
    if (!date) { if (!lastDate) { skipped.push({ row: i + 1, why: 'kein Datum', text: [home, guest].join(' – ') }); return; } date = lastDate; time = time || lastTime; }   // Folgezeile: gleicher Tag/gleiche Zeit wie darüber
    lastDate = date; lastTime = time || lastTime;
    if (/spielfrei/i.test(guest) || /spielfrei/i.test(home)) return;
    const t = teamOf(league);
    games.push({ date, start: time, league: clean(league), team: t.team, size: t.size, home: clean(home), guest: clean(guest), venue: clean(venue) });
  });
  return { games, skipped };
}

/* ---------- Kalenderdatei (.ics) ---------- */
function icsUnfold(text) { return String(text || '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, ''); }
function icsValue(v) { return String(v || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim(); }
function icsTime(line) {
  const v = (line.split(':').pop() || '').trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?(\d{2})?(Z)?$/); if (!m) return null;
  if (m[7] === 'Z' && m[4]) {   // UTC → deutsche Ortszeit
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    const f = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).reduce((a, p) => ({ ...a, [p.type]: p.value }), {});
    return { date: `${f.year}-${f.month}-${f.day}`, time: `${f.hour === '24' ? '00' : f.hour}:${f.minute}` };
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : null };
}
function fromIcs(text) {
  const games = [], skipped = [];
  const ev = icsUnfold(text).split('BEGIN:VEVENT').slice(1).map(b => b.split('END:VEVENT')[0]);
  ev.forEach((b, i) => {
    const get = k => { const l = b.split('\n').find(x => new RegExp(`^${k}[;:]`, 'i').test(x)); return l || ''; };
    const st = icsTime(get('DTSTART')), en = icsTime(get('DTEND'));
    const summary = icsValue(get('SUMMARY').replace(/^SUMMARY[^:]*:/i, '')), loc = icsValue(get('LOCATION').replace(/^LOCATION[^:]*:/i, '')), cat = icsValue(get('CATEGORIES').replace(/^CATEGORIES[^:]*:/i, ''));
    if (!st) { skipped.push({ row: i + 1, why: 'kein Datum', text: summary.slice(0, 120) }); return; }
    // „H30: TC A - TC B“, „Herren | Kreisliga B: A - B“, „A - B (Herren)“, „A : B“
    let league = cat, s = summary;
    const pre = s.match(/^([^:]{1,60}):\s+(.+)$/); if (pre && / [-–:] /.test(pre[2])) { league = league || pre[1]; s = pre[2]; }
    const post = s.match(/^(.+?)\s*\(([^)]{1,60})\)\s*$/); if (post && / [-–:] /.test(post[1]) && !/\d+\s*er/i.test(post[2])) { league = league || post[2]; s = post[1]; }
    const parts = s.split(/\s+[-–]\s+|\s+:\s+/);
    if (parts.length < 2) { skipped.push({ row: i + 1, why: 'keine zwei Mannschaften erkannt', text: summary.slice(0, 120) }); return; }
    const home = clean(parts[0]), guest = clean(parts.slice(1).join(' - '));
    if (/spielfrei/i.test(home + guest)) return;
    const t = teamOf(league);
    const minutes = en && en.time && st.time && en.date === st.date ? Math.max(0, (+en.time.slice(0, 2) * 60 + +en.time.slice(3)) - (+st.time.slice(0, 2) * 60 + +st.time.slice(3))) : null;
    games.push({ date: st.date, start: st.time, minutes, league: clean(league), team: t.team, size: t.size, home, guest, venue: clean(loc) });
  });
  return { games, skipped };
}

/** Excel (.xlsx) → Zeilen (erstes Blatt, Zellen als Text) */
async function xlsxRows(buf, ExcelJS) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  const ws = wb.worksheets[0]; if (!ws) return [];
  const rows = [];
  ws.eachRow({ includeEmpty: false }, row => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (c, n) => {
      let v = c.value;
      if (v instanceof Date) { const d = v; v = `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}${d.getUTCHours() || d.getUTCMinutes() ? ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : ''}`; }
      else if (v && typeof v === 'object') v = v.text || v.result || (v.richText ? v.richText.map(x => x.text).join('') : '');
      cells[n - 1] = clean(v);
    });
    rows.push(Array.from(cells, x => x || ''));
  });
  return rows;
}

/** Häufigste Mannschaft = eigener Verein (in einem Vereinsspielplan steht er in jeder Zeile) */
function guessClub(games) {
  const n = new Map();
  for (const g of games) for (const t of [g.home, g.guest]) { const k = clubKey(t); if (k) n.set(k, { name: clubName(t), c: ((n.get(k) || {}).c || 0) + 1 }); }
  const best = [...n.values()].sort((a, b) => b.c - a.c)[0];
  return best && best.c >= Math.max(2, games.length * 0.6) ? best.name : '';
}
/** „TC Frickhofen II“ → „TC Frickhofen“ (Mannschaftsnummer und Zusätze weg) */
const clubName = t => clean(t).replace(/\s+(I{1,3}|IV|V|VI{0,3}|\d+)$/i, '').replace(/\s*\((x|\d+)\)$/i, '').trim();
const clubKey = t => norm(clubName(t));
/** Heimspiel: Spielort nennt den Verein (nuLiga trägt ihn ein, wenn ein Gastspiel bei euch stattfindet), sonst Heimmannschaft ist der Verein.
    Ein Spielort ohne Vereinsnamen (Adresse, „Sportplatz …“) ändert daran nichts. */
function isHomeGame(g, club) {
  const ck = norm(club); if (!ck) return false;
  const has = s => { const k = norm(s); return Boolean(k) && k.includes(ck); };
  return has(g.venue) || has(g.home);
}

module.exports = { splitRows, fromRows, fromIcs, xlsxRows, guessClub, isHomeGame, teamOf, norm, clubName, parseDate, parseTime };
