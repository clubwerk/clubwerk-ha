'use strict';
/* ---------- Zeiterfassung für Personal (Reinigung, Hausmeister …) ----------
   Gespeichert werden immer die echten Zeitstempel. Gerundet wird nur die Monatssumme je Person
   auf die Viertelstunde: bis 3 Minuten über einer Viertelstunde ab-, ab 4 Minuten aufrunden.
   Der Stundensatz ist nur in der Verwaltung sichtbar; eine Änderung gilt ab dem Monat, in dem sie eingetragen wird.
   Am 1. jedes Monats (ab 6 Uhr) geht der Monatsnachweis des Vormonats per E-Mail an die Kassiererin. */
let ExcelJS, PDFDocument, db, getSetting, setSetting, audit, auth, ctxRef;

function createTables() {
db.exec(`
CREATE TABLE IF NOT EXISTS staff (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  job        TEXT,
  pin_hash   TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS staff_rates (
  staff_id   INTEGER NOT NULL REFERENCES staff(id),
  from_month TEXT NOT NULL,              -- JJJJ-MM: gilt ab diesem Monat
  cents      INTEGER,                    -- NULL = kein Stundensatz
  PRIMARY KEY (staff_id, from_month)
);
CREATE TABLE IF NOT EXISTS time_entries (
  id         INTEGER PRIMARY KEY,
  staff_id   INTEGER NOT NULL REFERENCES staff(id),
  start_at   TEXT NOT NULL,
  end_at     TEXT,
  manual     INTEGER NOT NULL DEFAULT 0, -- 1 = in der Verwaltung nachgetragen
  note       TEXT,
  orig_start TEXT,                       -- Originalzeiten vor der ersten Korrektur
  orig_end   TEXT,
  edited_by  TEXT,
  edited_at  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_time_staff ON time_entries(staff_id, start_at);
`);
}

const OPEN_LIMIT_MIN = 12 * 60;           // länger eingestempelt = vermutlich vergessen
const { pad, nowTs: localTs } = require('../../src/util');   // gemeinsame Helfer des Kerns (auch als ctx.util)
const toDate = ts => new Date(ts.replace(' ', 'T'));
const minutesBetween = (a, b) => Math.max(0, Math.floor((toDate(b) - toDate(a)) / 60000));
const monthOf = ts => ts.slice(0, 7);
const curMonth = () => localTs().slice(0, 7);
const prevMonth = (m = curMonth()) => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${pad(mo - 1)}`; };
const nextMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`; };
const isMonth = m => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const isTs = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(v) && !Number.isNaN(toDate(v).getTime());
const normTs = v => (v.length === 16 ? v + ':00' : v);
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const monthName = m => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const hm = min => `${Math.floor(min / 60)}:${pad(min % 60)}`;
const euro = c => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const deDay = ts => { const d = toDate(ts); return `${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
const clock = ts => ts.slice(11, 16);

/** Monatsrundung: Rest bis 3 Minuten ab-, ab 4 Minuten auf die nächste Viertelstunde */
function roundMonth(min) {
  const r = min % 15;
  if (r === 0) return min;
  return r <= 3 ? min - r : min - r + 15;
}

function rateFor(staffId, month) {
  // Änderungen gelten ab ihrem Monat; für Monate vor dem ersten Eintrag gilt der erste Satz (z. B. nachgetragene Einsätze)
  const r = db.prepare('SELECT cents FROM staff_rates WHERE staff_id = ? AND from_month <= ? ORDER BY from_month DESC LIMIT 1').get(staffId, month)
    || db.prepare('SELECT cents FROM staff_rates WHERE staff_id = ? ORDER BY from_month LIMIT 1').get(staffId);
  return r ? r.cents : null;
}

function entriesOf(staffId, month) {
  return db.prepare(`SELECT * FROM time_entries WHERE staff_id = ? AND start_at >= ? AND start_at < ? ORDER BY start_at`)
    .all(staffId, month + '-01', nextMonth(month) + '-01');
}

function decorate(e, now = localTs()) {
  const minutes = e.end_at ? minutesBetween(e.start_at, e.end_at) : null;
  const openMin = e.end_at ? null : minutesBetween(e.start_at, now);
  return { ...e, minutes, forgotten: !e.end_at && openMin > OPEN_LIMIT_MIN };
}

function summary(staff, month) {
  const list = entriesOf(staff.id, month).map(e => decorate(e));
  const minutes = list.reduce((s, e) => s + (e.minutes || 0), 0);
  const rounded = roundMonth(minutes);
  const rate = rateFor(staff.id, month);
  return {
    id: staff.id, name: staff.name, job: staff.job, active: Boolean(staff.active),
    count: list.filter(e => e.end_at).length, open: list.filter(e => !e.end_at).length, forgotten: list.filter(e => e.forgotten).length,
    minutes, rounded, rate_cents: rate, amount_cents: rate == null ? null : Math.round(rate * rounded / 60), entries: list,
  };
}

function monthReport(month) {
  const staff = db.prepare('SELECT * FROM staff ORDER BY active DESC, name_key(name, NULL)').all();
  return staff.map(s => summary(s, month)).filter(s => s.active || s.entries.length);
}

/* ---------- PDF: Übersicht + je Person eine Seite zum Unterschreiben ---------- */
function reportPdf(month, onlyId) {
  return new Promise((resolve, reject) => {
    const club = getSetting('club_name', 'Unser Verein');
    const all = monthReport(month);
    const rows = onlyId ? all.filter(s => s.id === onlyId) : all;
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Arbeitszeitnachweis ${monthName(month)}`, Author: club } });
    const chunks = [];
    doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const L = 40, R = 555, W = R - L;
    const head = title => {
      doc.font('Helvetica').fontSize(10).fillColor('#444').text(club, L, 40);
      doc.font('Helvetica-Bold').fontSize(17).fillColor('#111').text(title, L, 54);
      doc.font('Helvetica').fontSize(9).fillColor('#444').text(`erstellt ${localTs().slice(8, 10)}.${localTs().slice(5, 7)}.${localTs().slice(0, 4)}`, L, 60, { width: W, align: 'right' });
      doc.moveTo(L, 80).lineTo(R, 80).lineWidth(1.5).strokeColor('#111').stroke();
      return 92;
    };
    const table = (y, cols, rowsData, opts = {}) => {
      // cols: [{t, w, a}] – Kopfzeile, dann Zeilen
      const rowH = 20;
      let x = L;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#444');
      cols.forEach(c => { doc.text(c.t, x + 4, y + 5, { width: c.w - 8, align: c.a || 'left' }); x += c.w; });
      y += rowH; doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor('#111').stroke();
      rowsData.forEach((r, i) => {
        if (y > 760) { doc.addPage(); y = 50; }
        x = L;
        const bold = opts.boldLast && i === rowsData.length - 1;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#111');
        cols.forEach((c, j) => { doc.text(String(r[j] ?? ''), x + 4, y + 5, { width: c.w - 8, align: c.a || 'left', lineBreak: false, ellipsis: true }); x += c.w; });
        y += rowH;
        doc.moveTo(L, y).lineTo(R, y).lineWidth(bold ? 1 : 0.5).strokeColor(bold ? '#111' : '#bbb').stroke();
      });
      return y;
    };

    // Übersicht (nur beim Gesamtnachweis)
    if (!onlyId) {
      let y = head(`Arbeitszeiten ${monthName(month)} – Übersicht`);
      const sumAmt = rows.reduce((s, r) => s + (r.amount_cents || 0), 0);
      y = table(y + 6, [{ t: 'Name', w: 130 }, { t: 'Tätigkeit', w: 95 }, { t: 'Einsätze', w: 50, a: 'right' }, { t: 'genau', w: 50, a: 'right' },
        { t: 'abgerechnet', w: 70, a: 'right' }, { t: 'Satz €/Std.', w: 65, a: 'right' }, { t: 'Betrag', w: 55, a: 'right' }],
      [...rows.map(r => [r.name, r.job || '', r.count, hm(r.minutes), hm(r.rounded) + ' Std.', r.rate_cents == null ? '–' : euro(r.rate_cents).replace(' €', ''), r.amount_cents == null ? '–' : euro(r.amount_cents)]),
        ['Summe', '', rows.reduce((s, r) => s + r.count, 0), hm(rows.reduce((s, r) => s + r.minutes, 0)), hm(rows.reduce((s, r) => s + r.rounded, 0)) + ' Std.', '', sumAmt ? euro(sumAmt) : '–']], { boldLast: true });
      doc.font('Helvetica').fontSize(8.5).fillColor('#555')
        .text('Gerundet wird je Person die Monatssumme auf die Viertelstunde: bis 3 Minuten über einer Viertelstunde abgerundet, ab 4 Minuten aufgerundet. ', L, y + 10, { width: W });
      const warn = rows.filter(r => r.open);
      if (warn.length) doc.fillColor('#a32d2d').font('Helvetica-Bold')
        .text(`Achtung: ${warn.map(r => r.name).join(', ')} – Einsatz ohne Ende (nicht ausgestempelt). Nicht in der Summe enthalten; bitte in der Verwaltung korrigieren.`, L, doc.y + 6, { width: W });
    }

    rows.forEach((r, i) => {
      if (!onlyId || i > 0) doc.addPage();
      let y = head(`Arbeitszeitnachweis ${monthName(month)}`);
      doc.font('Helvetica').fontSize(10).fillColor('#555').text('Name', L, y).text('Tätigkeit', L + 260, y);
      doc.font('Helvetica-Bold').fillColor('#111').text(r.name, L + 70, y).text(r.job || '–', L + 330, y);
      y += 22;
      const data = r.entries.map(e => [deDay(e.start_at), clock(e.start_at), e.end_at ? clock(e.end_at) + (e.end_at.slice(0, 10) !== e.start_at.slice(0, 10) ? ' (+1)' : '') : '—',
        e.end_at ? hm(e.minutes) : '–', [!e.end_at && 'nicht ausgestempelt', e.manual && 'nachgetragen', e.edited_at && !e.manual && 'korrigiert', e.note].filter(Boolean).join(', ')]);
      data.push(['Summe', '', '', hm(r.minutes), `${r.count} ${r.count === 1 ? 'Einsatz' : 'Einsätze'}`]);
      y = table(y, [{ t: 'Datum', w: 105 }, { t: 'Beginn', w: 55 }, { t: 'Ende', w: 65 }, { t: 'Dauer', w: 55, a: 'right' }, { t: 'Bemerkung', w: W - 280 }], data, { boldLast: true });
      if (y > 640) { doc.addPage(); y = 50; }
      y += 14;
      const box = [['Summe genau', hm(r.minutes) + ' Std.'], ['Abgerechnet (auf Viertelstunde gerundet: bis 3 Min. ab, ab 4 Min. auf)', hm(r.rounded) + ' Std.']];
      if (r.rate_cents != null) box.push(['Stundensatz', euro(r.rate_cents)], ['Betrag', euro(r.amount_cents)]);
      doc.roundedRect(L, y, W, box.length * 18 + 12, 5).lineWidth(0.8).strokeColor('#999').stroke();
      box.forEach(([k, v], j) => {
        doc.font('Helvetica').fontSize(10).fillColor('#444').text(k, L + 12, y + 8 + j * 18, { width: W - 140 });
        doc.font('Helvetica-Bold').fillColor('#111').text(v, R - 130, y + 8 + j * 18, { width: 118, align: 'right' });
      });
      y += box.length * 18 + 70;
      doc.moveTo(L, y).lineTo(L + 220, y).moveTo(R - 220, y).lineTo(R, y).lineWidth(0.8).strokeColor('#111').stroke();
      doc.font('Helvetica').fontSize(8.5).fillColor('#444').text('Datum, Unterschrift Mitarbeiter/in', L, y + 4).text('Datum, Unterschrift Verein', R - 220, y + 4);
    });
    if (!rows.length) { head(`Arbeitszeiten ${monthName(month)}`); doc.font('Helvetica').fontSize(11).text('Keine Einsätze in diesem Monat.', L, 100); }
    doc.end();
  });
}

async function reportXlsx(month) {
  const rows = monthReport(month);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Übersicht');
  ws.columns = [{ header: 'Name', width: 26 }, { header: 'Tätigkeit', width: 20 }, { header: 'Einsätze', width: 10 }, { header: 'Minuten genau', width: 14 },
    { header: 'Stunden genau', width: 14 }, { header: 'Stunden abgerechnet', width: 19 }, { header: 'Stundensatz €', width: 14 }, { header: 'Betrag €', width: 12 }];
  rows.forEach(r => ws.addRow([r.name, r.job || '', r.count, r.minutes, +(r.minutes / 60).toFixed(2), r.rounded / 60, r.rate_cents == null ? null : r.rate_cents / 100, r.amount_cents == null ? null : r.amount_cents / 100]));
  ws.getRow(1).font = { bold: true };
  ['G', 'H'].forEach(c => { ws.getColumn(c).numFmt = '#,##0.00'; });
  const es = wb.addWorksheet('Einsätze');
  es.columns = [{ header: 'Name', width: 26 }, { header: 'Datum', width: 12 }, { header: 'Beginn', width: 9 }, { header: 'Ende', width: 9 }, { header: 'Minuten', width: 10 }, { header: 'Bemerkung', width: 50 }];
  rows.forEach(r => r.entries.forEach(e => es.addRow([r.name, e.start_at.slice(0, 10).split('-').reverse().join('.'), clock(e.start_at), e.end_at ? clock(e.end_at) : '', e.minutes,
    [!e.end_at && 'nicht ausgestempelt', e.manual && 'nachgetragen', e.edited_at && !e.manual && 'korrigiert', e.note].filter(Boolean).join(' · ')])));
  es.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
}

/* ---------- E-Mail ---------- */
// Versand über das zentrale Postfach (Einstellungen → Postfach); hier nur der Empfänger
const mailReady = () => ctxRef.mail.ready();
const mailTo = () => getSetting('zeit_mail_to', '');
const validMails = v => String(v || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
const mailOk = v => validMails(v).length > 0 && validMails(v).every(m => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m));

const sendMail = opts => ctxRef.mail.send(opts);

async function sendReport(month, by) {
  const to = mailTo();
  if (!mailOk(to)) throw new Error('Keine gültige Empfänger-Adresse eingetragen.');
  const rows = monthReport(month);
  const club = getSetting('club_name', 'Unser Verein');
  const lines = rows.map(r => `- ${r.name}${r.job ? ' (' + r.job + ')' : ''}: ${hm(r.rounded)} Std. abgerechnet (genau ${hm(r.minutes)}, ${r.count} ${r.count === 1 ? 'Einsatz' : 'Einsätze'})${r.amount_cents != null ? ' · ' + euro(r.amount_cents) : ''}`);
  const warn = rows.filter(r => r.open);
  const text = [`Hallo,`, ``, `hier die Arbeitszeiten für ${monthName(month)} (${club}):`, ``, ...(lines.length ? lines : ['- keine Einsätze']), ``,
    ...(warn.length ? [`Achtung: Bei ${warn.map(r => r.name).join(', ')} fehlt bei einem Einsatz das Ende (nicht ausgestempelt). Diese Zeit ist nicht enthalten – nach der Korrektur in der Verwaltung kann der Nachweis erneut gesendet werden.`, ``] : []),
    `Gerundet wird je Person die Monatssumme auf die Viertelstunde (bis 3 Minuten ab-, ab 4 Minuten aufgerundet).`,
    `Im Anhang: Monatsnachweis als PDF (Übersicht + je Person eine Seite zum Unterschreiben) und als Excel-Datei.`, ``, `Automatisch versendet von Clubwerk.`].join('\n');
  const [pdf, xlsx] = await Promise.all([reportPdf(month), reportXlsx(month)]);
  await sendMail({ to, subject: `Arbeitszeiten ${monthName(month)} – ${club}`, text,
    attachments: [{ filename: `Arbeitszeiten_${month}.pdf`, content: pdf }, { filename: `Arbeitszeiten_${month}.xlsx`, content: Buffer.from(xlsx) }] });
  setSetting('zeit_mail_sent', month);
  setSetting('zeit_mail_sent_at', localTs());
  setSetting('zeit_mail_error', '');
  audit(by || null, 'Zeiterfassung: Monatsnachweis versendet', `${monthName(month)} an ${to}`);
}

/* Am 1. ab 6 Uhr den Vormonat senden; war die Box aus, holt sie das beim nächsten Start nach. Fehler: stündlich neu versuchen. */
let lastTry = 0;
async function autoSend() {
  try {
    const now = new Date();
    if (!ctxRef.isActive()) return;
    if (now.getDate() === 1 && now.getHours() < 6) return;
    const m = prevMonth();
    if (getSetting('zeit_mail_sent') >= m || !mailReady() || !mailOk(mailTo())) return;
    if (!db.prepare('SELECT 1 FROM staff WHERE created_at < ? LIMIT 1').get(nextMonth(m) + '-01')) return;   // erst ab dem ersten Monat mit Personal
    if (Date.now() - lastTry < 55 * 60000) return;
    lastTry = Date.now();
    await sendReport(m, null);
    console.log(`Zeiterfassung: Monatsnachweis ${m} versendet.`);
  } catch (e) {
    setSetting('zeit_mail_error', `${localTs()}: ${String(e.message || e).slice(0, 300)}`);
    console.error('Zeiterfassung: Versand fehlgeschlagen –', e.message);
  }
}

/* ---------- Routen ---------- */
function activate(ctx) {
  ctxRef = ctx;
  ({ db, getSetting, setSetting, audit, auth } = ctx);
  ExcelJS = ctx.require('exceljs');
  PDFDocument = ctx.require('pdfkit');
  const { need, rateLimit, bad, int, cleanName } = ctx;
  const tablet = ctx.tablet, admin = ctx.admin;
  createTables();
  // Wer schon mit der Zeiterfassung gearbeitet hat (vor den Erweiterungen fest eingebaut), bekommt sie automatisch aktiv
  if (getSetting('ext_zeiterfassung_active') === null && db.prepare('SELECT 1 FROM staff LIMIT 1').get()) setSetting('ext_zeiterfassung_active', '1');
  ctx.hooks.tabletVisible = () => Boolean(db.prepare('SELECT 1 FROM staff WHERE active = 1 LIMIT 1').get());
  // Fehlversuche je Person: kurze Pause (höchstens 1 Std.) – sonst könnte jeder am Tablet eine Kraft tagelang am Einstempeln hindern.
  // Gegen Durchprobieren zählt zusätzlich je Gerät, mit wachsender Sperre bis 24 Std.
  const zlim = ctx.require('./security').limiter({ maxMs: 3600000 });
  const zdev = ctx.require('./security').limiter({ per: 10, baseMs: 15 * 60000 });
  /* Funktionsexport/-import: Personal (Name, Tätigkeit, aktueller Stundensatz) und Versand – ohne PINs, Zeiten und Passwort */
  ctx.hooks.exportConfig = () => {
    return { mailTo: mailTo(),
      staff: db.prepare('SELECT id, name, job FROM staff WHERE active = 1 ORDER BY name_key(name, NULL)').all().map(x => ({ name: x.name, job: x.job || '', rate_cents: rateFor(x.id, curMonth()) })) };
  };
  ctx.hooks.importConfig = data => {
    if (!data || typeof data !== 'object') throw new Error('Leere Funktionsdatei.');
    const notes = [];
    if (typeof data.mailTo === 'string') { const t = data.mailTo.trim().slice(0, 300); if (!t || mailOk(t)) setSetting('zeit_mail_to', t); }
    if (!mailReady()) notes.push('Postfach unter Einstellungen → Postfach einrichten');
    let added = 0;
    for (const x of Array.isArray(data.staff) ? data.staff.slice(0, 50) : []) {
      const name = ctx.cleanName(x.name, 60); if (name.length < 2) continue;
      if (db.prepare('SELECT 1 FROM staff WHERE lower(name) = lower(?)').get(name)) continue;
      // PIN unbekannt → zufällige PIN; der Vorstand vergibt danach unter „Personal verwalten“ die richtige
      const id = Number(db.prepare('INSERT INTO staff(name, job, pin_hash) VALUES (?,?,?)').run(name, ctx.cleanName(x.job, 40) || null, auth.hashSecret(String(ctx.require('crypto').randomInt(100000, 1000000)))).lastInsertRowid);
      if (Number.isInteger(x.rate_cents) && x.rate_cents >= 0) setRate(id, x.rate_cents);
      added++;
    }
    if (added) notes.push(`PINs für ${added} neue Person(en) unter „Personal verwalten“ vergeben`);
    return `${added} ${added === 1 ? 'Person' : 'Personen'} angelegt, Empfänger des Monatsnachweises übernommen${notes.length ? ' – ' + notes.join(', ') : ''}`;
  };
  /* Einrichtungs-Assistent (Verein › Einrichtung): eigene Schritte – zeigen auf die vorhandenen Karten, done prüft die eigenen Daten */
  ctx.hooks.setupSteps = () => [
    { id: 'personal', title: 'Personal', text: 'Wer seine Stunden am Tablet erfasst – mit PIN und Stundensatz.', page: 'zeit-personal', card: [], done: Boolean(ctx.db.prepare('SELECT 1 FROM staff').get()) },
    { id: 'nachweis', title: 'Monatsnachweis', text: 'An wen der Stundennachweis jeden Monat per E-Mail geht.', page: 'zeit-einstellungen', card: ['Monatsnachweis per E-Mail'] },
  ];
  ctx.hooks.overview = async () => {
    const st = staffState();
    const alerts = st.filter(x => x.forgotten).map(x => ({ level: 'a', text: `${x.name} ist seit über 12 Stunden eingestempelt – Ende nachtragen.` }));
    const err = getSetting('zeit_mail_error', '');
    if (err) alerts.push({ level: 'r', text: 'Monatsnachweis nicht verschickt: ' + err });
    if (!mailReady()) alerts.push({ level: 'a', text: 'Noch kein Postfach eingerichtet (Einstellungen → Postfach) – der Monatsnachweis kann nicht verschickt werden.' });
    if (!st.length) return { kpis: [], alerts };
    return { kpis: [{ l: 'Personal', v: st.length }, { l: 'Gerade da', v: st.filter(x => x.in_since && !x.forgotten).map(x => x.name.split(' ')[0]).join(', ') || '–' }], alerts };
  };

  const staffState = () => db.prepare('SELECT id, name, job FROM staff WHERE active = 1 ORDER BY name_key(name, NULL)').all().map(s => {
    const open = db.prepare('SELECT start_at FROM time_entries WHERE staff_id = ? AND end_at IS NULL ORDER BY start_at DESC LIMIT 1').get(s.id);
    const last = db.prepare('SELECT end_at FROM time_entries WHERE staff_id = ? AND end_at IS NOT NULL ORDER BY end_at DESC LIMIT 1').get(s.id);
    return { ...s, ln: ctx.require('./db').lastFirst(s.name), in_since: open ? open.start_at : null, forgotten: Boolean(open && minutesBetween(open.start_at, localTs()) > OPEN_LIMIT_MIN), last_out: last ? last.end_at : null };
  });

  tablet.get('/state', (req, res) => {
    res.json({ clubName: getSetting('club_name', 'Unser Verein'), staff: staffState() });
  });

  tablet.post('/stamp', rateLimit('zeit', 30, 60000), (req, res) => {
    const { staffId, pin } = req.body || {};
    const s = db.prepare('SELECT * FROM staff WHERE id = ? AND active = 1').get(int(staffId));
    if (!s) return bad(res, 'Unbekannte Person.', 404);
    // wachsende Sperre je Person (5 Min., 10, 20 … 24 Std.) – Erraten einer PIN dauert so praktisch ewig
    const dev = String(req.ip || '');
    const w = Math.max(zlim.blocked(s.id), zdev.blocked(dev));
    if (w) return bad(res, `Zu viele falsche PINs – bitte ${w} Min. warten.`, 429);
    if (!auth.verifySecret(String(pin || ''), s.pin_hash)) {
      const d = zdev.fail(dev);
      if (d.locked) { audit(null, 'Zeiterfassung: Gerät gesperrt (falsche PINs)', `${dev} · ${d.minutes} Min.`); ctxRef.require('./security').securityAlert(`Bei der Zeiterfassung wurden an einem Gerät (${dev}) viele falsche PINs eingegeben. Das Gerät ist jetzt ${d.minutes} Minuten gesperrt.`, 'zeit-dev'); }
      const r = zlim.fail(s.id);
      if (r.locked) {
        audit(null, 'Zeiterfassung: PIN gesperrt', `${s.name} · ${r.minutes} Min.`);
        if (r.strikes >= 2) ctxRef.require('./security').securityAlert(`Bei der Zeiterfassung wurde für „${s.name}“ wiederholt eine falsche PIN eingegeben. Die PIN ist jetzt ${r.minutes} Minuten gesperrt.`, 'zeit-' + s.id);
      }
      return bad(res, r.locked ? `PIN mehrfach falsch – ${r.minutes} Minuten gesperrt.` : 'Falsche PIN.', 401);
    }
    zlim.ok(s.id);
    const now = localTs();
    const open = db.prepare('SELECT * FROM time_entries WHERE staff_id = ? AND end_at IS NULL ORDER BY start_at DESC LIMIT 1').get(s.id);
    let action;
    if (open && minutesBetween(open.start_at, now) > OPEN_LIMIT_MIN) {
      // vergessen auszustempeln: den alten Einsatz offen lassen (Verwaltung korrigiert), neu einstempeln
      db.prepare('INSERT INTO time_entries(staff_id, start_at) VALUES (?, ?)').run(s.id, now);
      action = 'in-after-forgotten';
    } else if (open && (toDate(now) - toDate(open.start_at)) < 60000) {
      db.prepare('DELETE FROM time_entries WHERE id = ?').run(open.id);   // versehentlich doppelt getippt
      action = 'undo';
    } else if (open) {
      db.prepare('UPDATE time_entries SET end_at = ? WHERE id = ?').run(now, open.id);
      action = 'out';
    } else {
      db.prepare('INSERT INTO time_entries(staff_id, start_at) VALUES (?, ?)').run(s.id, now);
      action = 'in';
    }
    const m = curMonth();
    const list = entriesOf(s.id, m).map(e => decorate(e, now));
    const today = list.filter(e => e.start_at.slice(0, 10) === now.slice(0, 10) && e.end_at).reduce((a, e) => a + e.minutes, 0);
    res.json({ action, at: now, name: s.name, since: open ? open.start_at : null, today_minutes: today,
      month_minutes: list.reduce((a, e) => a + (e.minutes || 0), 0) });
  });

  /* Verwaltung */
  const Z = need('zeiterfassung');
  const staffRow = s => ({ id: s.id, name: s.name, job: s.job, active: Boolean(s.active), rate_cents: rateFor(s.id, curMonth()),
    rates: db.prepare('SELECT from_month, cents FROM staff_rates WHERE staff_id = ? ORDER BY from_month DESC').all(s.id) });
  const pinOk = p => /^\d{4,6}$/.test(String(p || ''));
  const rateIn = v => {
    if (v === null || v === undefined || String(v).trim() === '') return { cents: null };
    const n = Math.round(Number(String(v).replace(/\./g, '').replace(',', '.')) * 100);
    if (!Number.isFinite(n) || n < 0 || n > 100000) return { error: 'Stundensatz bitte als Betrag, z. B. 14,00.' };
    return { cents: n };
  };
  const setRate = (id, cents) => {
    if (rateFor(id, curMonth()) === cents) return;
    db.prepare('INSERT INTO staff_rates(staff_id, from_month, cents) VALUES (?,?,?) ON CONFLICT(staff_id, from_month) DO UPDATE SET cents = excluded.cents').run(id, curMonth(), cents);
  };

  admin.get('/staff', Z, (req, res) => res.json(db.prepare('SELECT * FROM staff ORDER BY active DESC, name_key(name, NULL)').all().map(staffRow)));
  admin.post('/staff', Z, (req, res) => {
    const b = req.body || {};
    const name = cleanName(b.name, 60), job = cleanName(b.job, 40);
    if (name.length < 2) return bad(res, 'Bitte einen Namen eintragen.');
    if (!pinOk(b.pin)) return bad(res, 'Die PIN braucht 4 bis 6 Ziffern.');
    const r = rateIn(b.rate); if (r.error) return bad(res, r.error);
    const id = Number(db.prepare('INSERT INTO staff(name, job, pin_hash) VALUES (?,?,?)').run(name, job || null, auth.hashSecret(String(b.pin))).lastInsertRowid);
    if (r.cents != null) setRate(id, r.cents);
    audit(req.user, 'Zeiterfassung: Person angelegt', name + (job ? ` (${job})` : ''));
    res.json({ id });
  });
  admin.put('/staff/:id', Z, (req, res) => {
    const s = db.prepare('SELECT * FROM staff WHERE id = ?').get(int(req.params.id));
    if (!s) return bad(res, 'Nicht gefunden.', 404);
    const b = req.body || {};
    const name = b.name !== undefined ? cleanName(b.name, 60) : s.name;
    if (name.length < 2) return bad(res, 'Bitte einen Namen eintragen.');
    const job = b.job !== undefined ? (cleanName(b.job, 40) || null) : s.job;
    if (b.pin && !pinOk(b.pin)) return bad(res, 'Die PIN braucht 4 bis 6 Ziffern.');
    const r = b.rate !== undefined ? rateIn(b.rate) : null; if (r && r.error) return bad(res, r.error);
    db.prepare('UPDATE staff SET name = ?, job = ?, active = ?, pin_hash = ? WHERE id = ?')
      .run(name, job, b.active === undefined ? s.active : (b.active ? 1 : 0), b.pin ? auth.hashSecret(String(b.pin)) : s.pin_hash, s.id);
    if (r) setRate(s.id, r.cents);
    audit(req.user, 'Zeiterfassung: Person geändert', [name, b.pin && 'neue PIN', r && 'Stundensatz ' + (r.cents == null ? 'entfernt' : euro(r.cents)), b.active === false && 'deaktiviert'].filter(Boolean).join(', '));
    res.json({ ok: true });
  });

  admin.get('/month', Z, (req, res) => {
    const m = isMonth(req.query.month) ? req.query.month : curMonth();
    const rows = monthReport(m);
    const months = db.prepare("SELECT DISTINCT substr(start_at,1,7) m FROM time_entries ORDER BY m DESC").all().map(r => r.m);
    if (!months.includes(curMonth())) months.unshift(curMonth());
    res.json({ month: m, monthName: monthName(m), staff: rows, months: [...new Set(months)].sort().reverse(),
      mail: { to: mailTo(), ready: mailReady(), from: ctxRef.mail.config().from, sentMonth: getSetting('zeit_mail_sent'), sentAt: getSetting('zeit_mail_sent_at'), error: getSetting('zeit_mail_error', ''), prev: prevMonth() } });
  });

  const entryBody = (b, needNote) => {
    const start = String(b.start || ''), end = b.end ? String(b.end) : null, note = cleanName(b.note, 120);
    if (!isTs(start)) return { error: 'Beginn fehlt oder ist ungültig.' };
    if (end && !isTs(end)) return { error: 'Ende ist ungültig.' };
    if (end && toDate(normTs(end)) <= toDate(normTs(start))) return { error: 'Das Ende muss nach dem Beginn liegen.' };
    if (end && minutesBetween(normTs(start), normTs(end)) > 24 * 60) return { error: 'Ein Einsatz kann höchstens 24 Stunden dauern.' };
    if (toDate(normTs(start)) > new Date() || (end && toDate(normTs(end)) > new Date(Date.now() + 60000))) return { error: 'Zeiten in der Zukunft sind nicht möglich.' };
    if (needNote && note.length < 3) return { error: 'Bitte kurz begründen (z. B. „vergessen auszustempeln“).' };
    return { start: normTs(start), end: end ? normTs(end) : null, note };
  };
  const overlaps = (staffId, start, end, exceptId = 0) => db.prepare(`SELECT 1 FROM time_entries WHERE staff_id = ? AND id != ?
    AND start_at < ? AND COALESCE(end_at, '9999') > ?`).get(staffId, exceptId, end || '9999', start);

  admin.post('/entries', Z, (req, res) => {
    const b = req.body || {};
    const s = db.prepare('SELECT * FROM staff WHERE id = ?').get(int(b.staffId));
    if (!s) return bad(res, 'Person nicht gefunden.', 404);
    const e = entryBody(b, true); if (e.error) return bad(res, e.error);
    if (!e.end) return bad(res, 'Beim Nachtragen bitte auch das Ende angeben.');
    if (overlaps(s.id, e.start, e.end)) return bad(res, 'Überschneidet sich mit einem anderen Einsatz.');
    db.prepare('INSERT INTO time_entries(staff_id, start_at, end_at, manual, note, edited_by, edited_at) VALUES (?,?,?,1,?,?,?)')
      .run(s.id, e.start, e.end, e.note, req.user.name || req.user.username, localTs());
    audit(req.user, 'Zeiterfassung: Einsatz nachgetragen', `${s.name}: ${e.start.slice(0, 16)} – ${e.end.slice(11, 16)} (${e.note})`);
    res.json({ ok: true });
  });
  admin.put('/entries/:id', Z, (req, res) => {
    const old = db.prepare('SELECT t.*, s.name FROM time_entries t JOIN staff s ON s.id = t.staff_id WHERE t.id = ?').get(int(req.params.id));
    if (!old) return bad(res, 'Nicht gefunden.', 404);
    const e = entryBody(req.body || {}, true); if (e.error) return bad(res, e.error);
    if (overlaps(old.staff_id, e.start, e.end, old.id)) return bad(res, 'Überschneidet sich mit einem anderen Einsatz.');
    db.prepare(`UPDATE time_entries SET start_at = ?, end_at = ?, note = ?, orig_start = COALESCE(orig_start, ?), orig_end = COALESCE(orig_end, ?, ''),
      edited_by = ?, edited_at = ? WHERE id = ?`).run(e.start, e.end, e.note, old.start_at, old.end_at, req.user.name || req.user.username, localTs(), old.id);
    audit(req.user, 'Zeiterfassung: Einsatz korrigiert', `${old.name}: ${old.start_at.slice(0, 16)}–${old.end_at ? old.end_at.slice(11, 16) : 'offen'} → ${e.start.slice(0, 16)}–${e.end ? e.end.slice(11, 16) : 'offen'} (${e.note})`);
    res.json({ ok: true });
  });
  admin.delete('/entries/:id', Z, (req, res) => {
    const old = db.prepare('SELECT t.*, s.name FROM time_entries t JOIN staff s ON s.id = t.staff_id WHERE t.id = ?').get(int(req.params.id));
    if (!old) return bad(res, 'Nicht gefunden.', 404);
    db.prepare('DELETE FROM time_entries WHERE id = ?').run(old.id);
    audit(req.user, 'Zeiterfassung: Einsatz gelöscht', `${old.name}: ${old.start_at.slice(0, 16)}–${old.end_at ? old.end_at.slice(11, 16) : 'offen'}`);
    res.json({ ok: true });
  });

  admin.get('/report.pdf', Z, async (req, res, next) => {
    try {
      const m = isMonth(req.query.month) ? req.query.month : curMonth();
      const pdf = await reportPdf(m, req.query.staff ? int(req.query.staff) : 0);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `${req.query.dl ? 'attachment' : 'inline'}; filename="Arbeitszeiten_${m}.pdf"` }).send(pdf);
    } catch (e) { next(e); }
  });
  // lesbarer Auszug für die nächtliche Datensicherung (Kern): Arbeitszeiten des laufenden Monats
  ctx.hooks.backupExports = async () => { const m = curMonth(); return [{ name: `Arbeitszeiten_${m}.xlsx`, buffer: Buffer.from(await reportXlsx(m)) }]; };
  admin.get('/report.xlsx', Z, async (req, res, next) => {
    try {
      const m = isMonth(req.query.month) ? req.query.month : curMonth();
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="Arbeitszeiten_${m}.xlsx"` })
        .send(Buffer.from(await reportXlsx(m)));
    } catch (e) { next(e); }
  });

  admin.put('/mail', Z, (req, res) => {
    const to = String((req.body || {}).to || '').trim();
    if (to && !mailOk(to)) return bad(res, 'Bitte eine gültige E-Mail-Adresse eintragen (mehrere mit Komma trennen).');
    setSetting('zeit_mail_to', validMails(to).join(', '));
    audit(req.user, 'Zeiterfassung: Empfänger geändert', to || '(leer)');
    res.json({ ok: true });
  });
  admin.post('/mail/send', Z, rateLimit('zeitmail', 6, 10 * 60000), async (req, res) => {
    const m = isMonth((req.body || {}).month) ? req.body.month : prevMonth();
    try { await sendReport(m, req.user); res.json({ ok: true, month: m }); }
    catch (e) { setSetting('zeit_mail_error', `${localTs()}: ${String(e.message).slice(0, 300)}`); bad(res, 'Versand fehlgeschlagen: ' + e.message, 502); }
  });
  admin.post('/mail/test', Z, rateLimit('zeitmail', 6, 10 * 60000), async (req, res) => {
    try {
      if (!mailOk(mailTo())) throw new Error('Keine gültige Empfänger-Adresse eingetragen.');
      await sendMail({ to: mailTo(), subject: `Test – ${getSetting('club_name', 'Verein')}`, text: 'Diese Testnachricht kommt von der Zeiterfassung von Clubwerk. Der Versand funktioniert.' });
      res.json({ ok: true });
    } catch (e) { bad(res, 'Test fehlgeschlagen: ' + e.message, 502); }
  });

  setTimeout(autoSend, 20000).unref();
  setInterval(autoSend, 10 * 60000).unref();
}

module.exports = { activate, roundMonth, monthReport: m => monthReport(m), reportPdf: (m, o) => reportPdf(m, o), prevMonth };
