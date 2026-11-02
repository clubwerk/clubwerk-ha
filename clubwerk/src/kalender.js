'use strict';
/* ---------- Persönliches Kalender-Abo der Mitglieder-App ----------
   Ein Link je Mitglied (…/api/p/kalender/<id>-<prüfzeichen>.ics), den der Kalender des Handys (iPhone, Android, Outlook) selbst regelmäßig
   abruft – ohne Anmeldung, deshalb ein langes, nicht erratbares Prüfzeichen (HMAC über Mitglied und Zufallswert). „Neuen Link“ macht den
   alten sofort ungültig, „Abo beenden“ löscht ihn. Gilt nur, solange das Mitglied ein gekoppeltes Handy hat.
   Inhalt: die eigenen Termine der Module (Hook calendarEvents(memberId, { from, to }) → [{ uid, date, start, end, end_date, title, place }]) –
   nur Bereiche, die das Mitglied in der App hat; nur Titel, Zeit und Ort, keine Namen anderer, keine Beträge. */
const crypto = require('crypto');
const express = require('express');
const { db, getSetting, setSetting } = require('./db');
const { today, addDays } = require('./util');

db.exec('CREATE TABLE IF NOT EXISTS member_cal (member_id INTEGER NOT NULL PRIMARY KEY REFERENCES members(id), nonce TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime(\'now\',\'localtime\')), fetched_at TEXT)');
const key = () => { let k = getSetting('cal_key', ''); if (!k) { k = crypto.randomBytes(32).toString('hex'); setSetting('cal_key', k); } return k; };
const sig = (id, nonce) => crypto.createHmac('sha256', key()).update(`kal:${id}:${nonce}`).digest('hex').slice(0, 40);
const file = (id, nonce) => `${id}-${sig(id, nonce)}.ics`;
const PATH = 'api/p/kalender/';

const esc = v => String(v || '').replace(/\\/g, '\\\\').replace(/[;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
const fold = l => { const out = []; let s = l; while (Buffer.byteLength(s) > 74) { let n = 74; while (Buffer.byteLength(s.slice(0, n)) > 74) n--; out.push(s.slice(0, n)); s = ' ' + s.slice(n); } out.push(s); return out.join('\r\n'); };
const dt = (d, t) => d.replace(/-/g, '') + (t ? 'T' + t.replace(':', '') + '00' : '');
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';

function ics(events, name) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Clubwerk//Mitglieder-App//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`, `X-WR-TIMEZONE:${TZ}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  for (const e of events) {
    const allDay = !e.start;
    L.push('BEGIN:VEVENT', `UID:${esc(e.uid)}`, `DTSTAMP:${stamp}`);
    if (allDay) { L.push(`DTSTART;VALUE=DATE:${dt(e.date)}`, `DTEND;VALUE=DATE:${dt(addDays(e.end_date || e.date, 1))}`); }
    else {
      L.push(`DTSTART;TZID=${TZ}:${dt(e.date, e.start)}`);
      if (e.end) L.push(`DTEND;TZID=${TZ}:${dt(e.end_date || (e.end > e.start ? e.date : addDays(e.date, 1)), e.end)}`);
    }
    L.push(`SUMMARY:${esc(e.title)}`);
    if (e.place) L.push(`LOCATION:${esc(e.place)}`);
    if (e.note) L.push(`DESCRIPTION:${esc(e.note)}`);
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')), isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const clean = (e, id) => (e && isDay(e.date) && e.title ? { uid: `${id}-${String(e.uid || '').slice(0, 120)}@clubwerk`, date: e.date, start: isTime(e.start) ? e.start : '', end: isTime(e.end) ? e.end : '',
  end_date: isDay(e.end_date) && e.end_date >= e.date ? e.end_date : '', title: String(e.title).slice(0, 200), place: e.place ? String(e.place).slice(0, 200) : '', note: e.note ? String(e.note).slice(0, 500) : '' } : null);

/**
 * h = { api, publicRouter(router), whoIs(req) → { memberId } | null, sections(memberId) → [{ id, hooks }] (freigeschaltete Bereiche), baseUrl(req) → 'https://…', clubName() }
 */
function register(h) {
  // nur mit wirklich gekoppeltem, nicht gesperrtem Handy eines aktiven Mitglieds (wie invites.whoIs) – offene Einladungen zählen nicht
  const hasDevice = id => Boolean(db.prepare(`SELECT 1 FROM member_devices d JOIN members m ON m.id = d.member_id
    WHERE d.scope = 'app' AND d.member_id = ? AND (d.token_hash IS NOT NULL OR d.token2_hash IS NOT NULL) AND m.active = 1 AND m.deleted = 0`).get(id));
  const urlFor = (req, id) => { const r = db.prepare('SELECT nonce FROM member_cal WHERE member_id = ?').get(id); return r ? `${h.baseUrl(req)}/${PATH}${file(id, r.nonce)}` : null; };
  // App (gekoppeltes Handy): Link ansehen, neu erstellen (der alte gilt dann nicht mehr), beenden
  h.api.get('/kalender', (req, res) => { const w = h.whoIs(req); if (!w) return res.status(403).json({ error: 'Dieses Handy ist nicht (mehr) freigeschaltet.' }); res.json({ url: urlFor(req, w.memberId), local: h.localOnly(req) }); });
  h.api.post('/kalender', (req, res) => {
    const w = h.whoIs(req); if (!w) return res.status(403).json({ error: 'Dieses Handy ist nicht (mehr) freigeschaltet.' });
    db.prepare("INSERT INTO member_cal(member_id, nonce) VALUES (?, ?) ON CONFLICT(member_id) DO UPDATE SET nonce = excluded.nonce, created_at = datetime('now','localtime'), fetched_at = NULL").run(w.memberId, crypto.randomBytes(16).toString('hex'));
    res.json({ url: urlFor(req, w.memberId), local: h.localOnly(req) });
  });
  h.api.delete('/kalender', (req, res) => { const w = h.whoIs(req); if (!w) return res.status(403).json({ error: 'Dieses Handy ist nicht (mehr) freigeschaltet.' }); db.prepare('DELETE FROM member_cal WHERE member_id = ?').run(w.memberId); res.json({ ok: true }); });

  // Abruf durch den Kalender (ohne Anmeldung): nur mit gültigem Prüfzeichen, sonst immer dieselbe Antwort
  const r = express.Router();
  r.get('/:f', async (req, res) => {
    const m = /^(\d{1,9})-([0-9a-f]{40})\.ics$/.exec(req.params.f || '');
    const row = m ? db.prepare('SELECT * FROM member_cal WHERE member_id = ?').get(Number(m[1])) : null;
    const ok = row && crypto.timingSafeEqual(Buffer.from(sig(row.member_id, row.nonce)), Buffer.from(m[2])) && hasDevice(row.member_id);
    if (!ok) return res.status(404).json({ error: 'Diesen Kalender gibt es nicht (mehr).' });
    if (require('./vault').locked()) return res.status(503).set('Retry-After', '3600').json({ error: 'Gerade nicht verfügbar.' });
    const id = row.member_id, from = addDays(today(), -28), to = addDays(today(), 366), list = [];
    await Promise.all(h.sections(id).map(async s => {
      try {
        const got = await Promise.race([Promise.resolve().then(() => s.hooks.calendarEvents(id, { from, to })), new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), 5000).unref())]);
        for (const e of Array.isArray(got) ? got.slice(0, 500) : []) { const c = clean(e, s.id); if (c && (c.end_date || c.date) >= from && c.date <= to) list.push(c); }
      } catch (e) { console.error(`Kalender-Abo: ${s.id}:`, e.message); }
    }));
    list.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    db.prepare("UPDATE member_cal SET fetched_at = datetime('now','localtime') WHERE member_id = ?").run(id);
    res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="clubwerk.ics"', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }).send(ics(list, h.clubName()));
  });
  h.publicRouter(r);
}

module.exports = { register, ics };
