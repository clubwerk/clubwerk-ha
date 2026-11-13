'use strict';
/* =====================================================================================================
   Fahrgemeinschaften – gemeinsamer Baustein für Module (erst Spielbetrieb › Auswärtsspiele, später Termine)
   „Ich fahre, 3 Plätze frei“ und „Ich brauche eine Mitfahrt“ zu einem Bezug (ref_type + ref_id, z. B. ein Auswärtsspiel).
   Das Modul, dem der Bezug gehört, übergibt bind({ refType, context, tell, audit }); context(refId) liefert null (gibt es nicht / hier
   keine Fahrgemeinschaften) oder { title, when, date, place, depart, locked, can(id), lead(id) }:
     can  = nimmt teil (Aufstellung, Zusage) – nur Teilnehmende und lead (Mannschaftsführer) sehen und nutzen die Fahrten,
     lead = darf für andere eintragen (z. B. Kinder ohne Handy), locked = Text, warum nichts mehr geändert werden kann (abgesagt, vorbei).
   Keine Kontaktdaten, kein Chat; Abfahrtsort ist freier Text. Push nur über zentrale Anlässe des Moduls
   (events() liefert sie für hooks.pushEvents). Löschfrist, Auskunft und Zusammenführen: due/purge/dataOf bzw. der Kern (REFERENCES members).
   ===================================================================================================== */
const { db, splitPersonName, auditDiff } = require('./db');
const { today } = require('./util');

const DIRS = ['hin', 'rueck', 'beide'];
const DIR_TEXT = { hin: 'Hinfahrt', rueck: 'Rückfahrt', beide: 'Hin- und Rückfahrt' };
const MAX_SEATS = 8, MAX_OPEN = 3;
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const int = v => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
const err = (msg, status = 400) => Object.assign(new Error(msg), { status });
const overlap = (a, b) => a === 'beide' || b === 'beide' || a === b;
const qs = a => a.map(() => '?').join(',');
const short = n => { const x = splitPersonName(n); return x.first ? `${x.first} ${String(x.last || '')[0] || ''}.` : x.last; };
const lf = (name, kind) => require('./db').lastFirst(name, kind);

let ready = false;
function init() {
  if (ready) return;
  db.exec(`
CREATE TABLE IF NOT EXISTS fz_ride (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ref_type TEXT NOT NULL, ref_id INTEGER NOT NULL, ref_date TEXT NOT NULL,
  driver_id INTEGER NOT NULL REFERENCES members(id), dir TEXT NOT NULL DEFAULT 'hin', depart TEXT NOT NULL, place TEXT NOT NULL,
  seats INTEGER NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_fz_ride_ref ON fz_ride(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS ix_fz_ride_driver ON fz_ride(driver_id);
CREATE TABLE IF NOT EXISTS fz_seat (
  ride_id INTEGER NOT NULL REFERENCES fz_ride(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id),
  persons INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY (ride_id, member_id)
);
CREATE INDEX IF NOT EXISTS ix_fz_seat_member ON fz_seat(member_id);
CREATE TABLE IF NOT EXISTS fz_request (
  ref_type TEXT NOT NULL, ref_id INTEGER NOT NULL, ref_date TEXT NOT NULL, member_id INTEGER NOT NULL REFERENCES members(id),
  persons INTEGER NOT NULL DEFAULT 1, dir TEXT NOT NULL DEFAULT 'beide', created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (ref_type, ref_id, member_id)
);
CREATE INDEX IF NOT EXISTS ix_fz_request_member ON fz_request(member_id);
`);
  ready = true;
}

/** Push-Anlässe für hooks.pushEvents des Moduls (nur zentral freigegeben, kein Schalter je Anlass in der App) */
const events = () => [
  { id: 'fahrt_eintrag', label: 'Fahrgemeinschaft: Jemand fährt mit dir', desc: 'An den Fahrer: Jemand hat sich in seine Fahrt eingetragen oder sich wieder ausgetragen.', default: true },
  { id: 'fahrt_aenderung', label: 'Fahrgemeinschaft: Fahrt geändert', desc: 'An Mitfahrende: Die Fahrt wurde geändert oder abgesagt, oder du wurdest eingetragen bzw. mitgenommen.', default: true },
];

function bind({ refType, context, tell, audit }) {
  init();
  const nameOf = id => (db.prepare('SELECT name FROM members WHERE id = ?').get(id) || {}).name || '';
  const ctxOf = refId => { const i = context(int(refId)); if (!i) throw err('Dazu gibt es keine Fahrgemeinschaften.', 404); return i; };
  const rideRow = id => { const r = db.prepare('SELECT * FROM fz_ride WHERE id = ? AND ref_type = ?').get(int(id), refType); if (!r) throw err('Fahrt nicht gefunden.', 404); return r; };
  const seatsOf = rideId => db.prepare('SELECT member_id, persons FROM fz_seat WHERE ride_id = ?').all(rideId);
  const taken = rideId => seatsOf(rideId).reduce((n, s) => n + s.persons, 0);
  const elig = (info, id) => Boolean(id) && Boolean(info.can(id) || info.lead(id));
  const manage = (actor, ride, info) => actor.admin || Boolean(actor.id && (actor.id === ride.driver_id || info.lead(actor.id)));
  const live = info => !info.locked;
  const by = actor => (actor.admin ? actor.name : nameOf(actor.id));
  const logAs = (actor, action, text) => audit(actor.admin ? actor.user : null, `Fahrgemeinschaft: ${action}`, actor.admin ? text : `${by(actor)}: ${text}`);

  /** Wen betrifft eine Eintragung: man selbst – Mannschaftsführer und Verwaltung auch andere Teilnehmende (Kinder ohne Handy) */
  function person(info, actor, b) {
    const id = b.member_id ? int(b.member_id) : actor.id;
    if (!id) throw err('Bitte eine Person wählen.');
    if (id !== actor.id && !(actor.admin || (actor.id && info.lead(actor.id)))) throw err('Das darfst du nur für dich selbst.', 403);
    if (!elig(info, id)) throw err('Diese Person nimmt an diesem Termin nicht teil.');
    return id;
  }
  const persons = b => Math.max(1, Math.min(MAX_SEATS, int(b.persons) || 1));
  /** Fährt oder sitzt die Person in diesem Bezug schon in einer Fahrt, die sich mit dir überschneidet? → Text oder '' */
  function clash(refId, mid, dir, exceptRide = 0) {
    const mine = db.prepare('SELECT r.id, r.dir, r.depart, m.name FROM fz_ride r JOIN members m ON m.id = r.driver_id WHERE r.ref_type = ? AND r.ref_id = ? AND r.driver_id = ?').all(refType, refId, mid)
      .find(r => r.id !== exceptRide && overlap(r.dir, dir));
    if (mine) return 'Du fährst hier schon selbst – bitte erst die eigene Fahrt absagen.';
    const seat = db.prepare('SELECT r.id, r.dir, m.name FROM fz_seat s JOIN fz_ride r ON r.id = s.ride_id JOIN members m ON m.id = r.driver_id WHERE r.ref_type = ? AND r.ref_id = ? AND s.member_id = ?').all(refType, refId, mid)
      .find(r => r.id !== exceptRide && overlap(r.dir, dir));
    return seat ? `Du fährst schon bei ${short(seat.name)} mit – bitte dort erst austragen.` : '';
  }
  const rideLine = (r, info) => `${info.title}, ${info.when} · Abfahrt ${r.depart} Uhr, ${r.place}`;

  /* ---------- Ansicht: eine Anfrage je Tabelle für alle Bezüge zusammen ---------- */
  /** items: [{ refId, info }] → Map refId → Ansicht (null: darf der Betrachter nicht sehen) */
  function views(items, actor) {
    const out = new Map(), seen = [];
    for (const { refId, info } of items) {
      if (!info || !(actor.admin || elig(info, actor.id))) { out.set(refId, null); continue; }
      seen.push({ refId, info });
    }
    if (!seen.length) return out;
    const ids = seen.map(x => x.refId);
    const rides = db.prepare(`SELECT r.*, m.name AS dname, m.kind AS dkind FROM fz_ride r JOIN members m ON m.id = r.driver_id WHERE r.ref_type = ? AND r.ref_id IN (${qs(ids)}) ORDER BY r.depart, r.id`).all(refType, ...ids);
    const seats = rides.length ? db.prepare(`SELECT s.ride_id, s.member_id, s.persons, m.name, m.kind FROM fz_seat s JOIN fz_ride r ON r.id = s.ride_id JOIN members m ON m.id = s.member_id
      WHERE r.ref_type = ? AND r.ref_id IN (${qs(ids)}) ORDER BY name_key(m.name, m.kind)`).all(refType, ...ids) : [];
    const reqs = db.prepare(`SELECT q.ref_id, q.member_id, q.persons, q.dir, m.name, m.kind FROM fz_request q JOIN members m ON m.id = q.member_id
      WHERE q.ref_type = ? AND q.ref_id IN (${qs(ids)}) ORDER BY name_key(m.name, m.kind)`).all(refType, ...ids);
    for (const { refId, info } of seen) {
      const mine = actor.id || 0;
      const rs = rides.filter(r => r.ref_id === refId).map(r => {
        const ps = seats.filter(s => s.ride_id === r.id).map(s => ({ id: s.member_id, ln: lf(s.name, s.kind), persons: s.persons, mine: s.member_id === mine }));
        const used = ps.reduce((n, p) => n + p.persons, 0);
        return { id: r.id, driver: { id: r.driver_id, ln: lf(r.dname, r.dkind) }, mine: r.driver_id === mine, dir: r.dir, depart: r.depart, place: r.place, seats: r.seats, free: Math.max(0, r.seats - used), note: r.note || '',
          passengers: ps, joined: ps.some(p => p.mine) };
      });
      const ws = reqs.filter(q => q.ref_id === refId).map(q => ({ id: q.member_id, ln: lf(q.name, q.kind), persons: q.persons, dir: q.dir, mine: q.member_id === mine }));
      const manageAll = Boolean(actor.admin || (mine && info.lead(mine)));
      out.set(refId, { locked: info.locked || '', place: info.place || '', depart: info.depart || '', manage: manageAll, canOffer: !info.locked && Boolean(mine) && elig(info, mine),
        rides: rs, wants: ws, mineRide: rs.some(r => r.mine), mineSeat: rs.some(r => r.joined), mineWant: ws.some(w => w.mine) });
    }
    return out;
  }
  const view = (refId, actor) => views([{ refId, info: context(refId) }], actor).get(refId);

  /* ---------- Handlungen (alle prüfen Rechte und Grenzen selbst; die Datenbank arbeitet synchron, eine Transaktion macht Plätze atomar) ---------- */
  function offer(refId, actor, b) {
    const info = ctxOf(refId);
    if (!live(info)) throw err(info.locked, 409);
    if (!actor.id) throw err('Fahrten bietet ein Mitglied selbst in der App an.');
    if (!elig(info, actor.id)) throw err('Nur Teilnehmende können eine Fahrt anbieten.', 403);
    const dir = DIRS.includes(b.dir) ? b.dir : '', depart = isTime(b.depart) ? b.depart : '', place = txt(b.place, 60) || txt(info.place, 60), seats = int(b.seats), note = txt(b.note, 140);
    if (!dir) throw err('Bitte Hinfahrt, Rückfahrt oder beides wählen.');
    if (!depart) throw err('Bitte die Abfahrtszeit eintragen.');
    if (!place) throw err('Bitte einen Treffpunkt nennen (nicht deine Wohnadresse).');
    if (seats < 1 || seats > MAX_SEATS) throw err(`Freie Plätze: 1 bis ${MAX_SEATS}.`);
    if (db.prepare('SELECT COUNT(*) n FROM fz_ride WHERE driver_id = ? AND ref_date >= ?').get(actor.id, today()).n >= MAX_OPEN) throw err(`Du hast schon ${MAX_OPEN} Fahrten angeboten – bitte erst eine absagen.`, 409);
    const c = clash(int(refId), actor.id, dir);
    if (c) throw err(c, 409);
    const id = db.transaction(() => {
      db.prepare('DELETE FROM fz_request WHERE ref_type = ? AND ref_id = ? AND member_id = ?').run(refType, int(refId), actor.id);
      return Number(db.prepare('INSERT INTO fz_ride(ref_type, ref_id, ref_date, driver_id, dir, depart, place, seats, note) VALUES (?,?,?,?,?,?,?,?,?)').run(refType, int(refId), info.date, actor.id, dir, depart, place, seats, note || null).lastInsertRowid);
    })();
    logAs(actor, 'Fahrt angeboten', `${info.title}, ${info.when}: ${DIR_TEXT[dir]}, ${depart} Uhr, ${seats} freie Plätze`);
    return id;
  }

  function update(rideId, actor, b) {
    const r = rideRow(rideId), info = ctxOf(r.ref_id);
    if (!manage(actor, r, info)) throw err('Das ist nicht deine Fahrt.', 403);
    if (!live(info)) throw err(info.locked, 409);
    const next = { dir: b.dir === undefined ? r.dir : (DIRS.includes(b.dir) ? b.dir : ''), depart: b.depart === undefined ? r.depart : (isTime(b.depart) ? b.depart : ''),
      place: b.place === undefined ? r.place : txt(b.place, 60), seats: b.seats === undefined ? r.seats : int(b.seats), note: b.note === undefined ? (r.note || '') : txt(b.note, 140) };
    if (!next.dir) throw err('Bitte Hinfahrt, Rückfahrt oder beides wählen.');
    if (!next.depart) throw err('Bitte die Abfahrtszeit eintragen.');
    if (!next.place) throw err('Bitte einen Treffpunkt nennen.');
    if (next.seats < 1 || next.seats > MAX_SEATS) throw err(`Freie Plätze: 1 bis ${MAX_SEATS}.`);
    if (next.seats < taken(r.id)) throw err(`Es sind schon ${taken(r.id)} Plätze vergeben – weniger geht nicht.`, 409);
    if (next.dir !== r.dir) for (const s of seatsOf(r.id)) { const c = clash(r.ref_id, s.member_id, next.dir, r.id); if (c) throw err('Die Fahrtrichtung passt nicht mehr zu den Mitfahrenden.', 409); }
    db.prepare('UPDATE fz_ride SET dir = ?, depart = ?, place = ?, seats = ?, note = ? WHERE id = ?').run(next.dir, next.depart, next.place, next.seats, next.note || null, r.id);
    const diff = auditDiff({ dir: ['Richtung', 'text'], depart: 'Abfahrt', place: 'Abfahrtsort', seats: 'Freie Plätze', note: ['Hinweis', 'text'] }, { dir: r.dir, depart: r.depart, place: r.place, seats: r.seats, note: r.note || '' }, next);
    if (!diff) return;
    logAs(actor, 'Fahrt geändert', `${info.title}, ${info.when} (${short(nameOf(r.driver_id))}): ${diff}`);
    if (next.dir !== r.dir || next.depart !== r.depart || next.place !== r.place) {
      const ids = seatsOf(r.id).map(s => s.member_id).filter(id => id !== actor.id);
      if (ids.length) tell(ids, 'fahrt_aenderung', { title: 'Fahrt geändert', body: `${short(nameOf(r.driver_id))} fährt jetzt um ${next.depart} Uhr ab ${next.place} (${DIR_TEXT[next.dir]}) – ${info.title}.` });
    }
  }

  function cancel(rideId, actor) {
    const r = rideRow(rideId), info = ctxOf(r.ref_id);
    if (!manage(actor, r, info)) throw err('Das ist nicht deine Fahrt.', 403);
    const ids = seatsOf(r.id).map(s => s.member_id).filter(id => id !== actor.id);
    db.prepare('DELETE FROM fz_ride WHERE id = ?').run(r.id);   // Mitfahrende fallen über ON DELETE CASCADE mit weg
    logAs(actor, 'Fahrt abgesagt', `${info.title}, ${info.when} (${short(nameOf(r.driver_id))}), ${ids.length} Mitfahrende`);
    if (ids.length && live(info)) tell(ids, 'fahrt_aenderung', { title: 'Fahrt abgesagt', body: `${short(nameOf(r.driver_id))} fährt nicht mehr (${rideLine(r, info)}). Bitte neu eintragen.` });
  }

  /** Platz belegen (ruft join und take; in der Transaktion des Aufrufers) */
  function seatOn(r, mid, n) {
    const own = (db.prepare('SELECT persons FROM fz_seat WHERE ride_id = ? AND member_id = ?').get(r.id, mid) || {}).persons || 0;
    const free = r.seats - taken(r.id) + own;
    if (n > free) throw err(free <= 0 ? 'Auf dieser Fahrt ist kein Platz mehr frei.' : free === 1 ? 'Auf dieser Fahrt ist nur noch 1 Platz frei.' : `Auf dieser Fahrt sind nur noch ${free} Plätze frei.`, 409);
    db.prepare('INSERT INTO fz_seat(ride_id, member_id, persons) VALUES (?,?,?) ON CONFLICT(ride_id, member_id) DO UPDATE SET persons = excluded.persons').run(r.id, mid, n);
    db.prepare('DELETE FROM fz_request WHERE ref_type = ? AND ref_id = ? AND member_id = ?').run(refType, r.ref_id, mid);
  }
  const plus = n => (n > 1 ? ` (+${n - 1})` : '');

  function join(rideId, actor, b) {
    const r = rideRow(rideId), info = ctxOf(r.ref_id);
    if (!live(info)) throw err(info.locked, 409);
    const mid = person(info, actor, b), n = persons(b);
    if (mid === r.driver_id) throw err('Du fährst selbst.');
    const c = clash(r.ref_id, mid, r.dir, r.id);
    if (c) throw err(c, 409);
    db.transaction(() => seatOn(r, mid, n))();
    logAs(actor, 'Mitfahrt eingetragen', `${lf(nameOf(mid))}${plus(n)} bei ${short(nameOf(r.driver_id))} – ${info.title}, ${info.when}`);
    if (mid !== r.driver_id && actor.id !== r.driver_id) tell([r.driver_id], 'fahrt_eintrag', { title: 'Jemand fährt mit dir', body: `${short(nameOf(mid))}${plus(n)} fährt bei dir mit (${rideLine(r, info)}).` });
    if (mid !== actor.id) tell([mid], 'fahrt_aenderung', { title: 'Du fährst mit', body: `Du wurdest bei ${short(nameOf(r.driver_id))} eingetragen (${rideLine(r, info)}).` });
  }

  function leave(rideId, actor, b) {
    const r = rideRow(rideId), info = ctxOf(r.ref_id);
    const mid = b.member_id ? int(b.member_id) : actor.id;
    if (!(mid === actor.id || manage(actor, r, info))) throw err('Das darfst du nicht.', 403);
    if (!db.prepare('DELETE FROM fz_seat WHERE ride_id = ? AND member_id = ?').run(r.id, mid).changes) return;
    logAs(actor, 'Mitfahrt ausgetragen', `${lf(nameOf(mid))} bei ${short(nameOf(r.driver_id))} – ${info.title}, ${info.when}`);
    if (!live(info)) return;
    if (mid === actor.id) { if (actor.id !== r.driver_id) tell([r.driver_id], 'fahrt_eintrag', { title: 'Mitfahrt zurückgenommen', body: `${short(nameOf(mid))} fährt doch nicht bei dir mit (${rideLine(r, info)}).` }); }
    else tell([mid], 'fahrt_aenderung', { title: 'Aus der Fahrt ausgetragen', body: `Du wurdest bei ${short(nameOf(r.driver_id))} ausgetragen (${rideLine(r, info)}).` });
  }

  function want(refId, actor, b) {
    const info = ctxOf(refId);
    if (!live(info)) throw err(info.locked, 409);
    const mid = person(info, actor, b), n = persons(b), dir = DIRS.includes(b.dir) ? b.dir : 'beide';
    const c = clash(int(refId), mid, dir);
    if (c) throw err(c, 409);
    db.prepare(`INSERT INTO fz_request(ref_type, ref_id, ref_date, member_id, persons, dir) VALUES (?,?,?,?,?,?)
      ON CONFLICT(ref_type, ref_id, member_id) DO UPDATE SET persons = excluded.persons, dir = excluded.dir`).run(refType, int(refId), info.date, mid, n, dir);
    logAs(actor, 'Mitfahrt gesucht', `${lf(nameOf(mid))}${plus(n)} – ${info.title}, ${info.when}`);
  }

  function unwant(refId, actor, b) {
    const info = ctxOf(refId), mid = b.member_id ? int(b.member_id) : actor.id;
    if (mid !== actor.id && !(actor.admin || (actor.id && info.lead(actor.id)))) throw err('Das darfst du nicht.', 403);
    if (db.prepare('DELETE FROM fz_request WHERE ref_type = ? AND ref_id = ? AND member_id = ?').run(refType, int(refId), mid).changes)
      logAs(actor, 'Mitfahrgesuch zurückgenommen', `${lf(nameOf(mid))} – ${info.title}, ${info.when}`);
  }

  /** Der Fahrer nimmt jemanden mit, der eine Mitfahrt sucht */
  function take(rideId, actor, b) {
    const r = rideRow(rideId), info = ctxOf(r.ref_id), mid = int(b.member_id);
    if (!manage(actor, r, info)) throw err('Das ist nicht deine Fahrt.', 403);
    if (!live(info)) throw err(info.locked, 409);
    const q = db.prepare('SELECT * FROM fz_request WHERE ref_type = ? AND ref_id = ? AND member_id = ?').get(refType, r.ref_id, mid);
    if (!q) throw err('Das Gesuch gibt es nicht mehr.', 404);
    if (!overlap(q.dir, r.dir)) throw err('Das Gesuch passt nicht zur Richtung dieser Fahrt.', 409);
    const c = clash(r.ref_id, mid, r.dir, r.id);
    if (c) throw err(c, 409);
    db.transaction(() => seatOn(r, mid, q.persons))();
    logAs(actor, 'Mitgenommen', `${lf(nameOf(mid))}${plus(q.persons)} bei ${short(nameOf(r.driver_id))} – ${info.title}, ${info.when}`);
    if (mid !== actor.id) tell([mid], 'fahrt_aenderung', { title: 'Du wirst mitgenommen', body: `${short(nameOf(r.driver_id))} nimmt dich mit (${rideLine(r, info)}).` });
  }

  /** Wer für einen Termin absagt (nicht mehr dabei ist), verschwindet aus Fahrten und Gesuchen */
  function withdraw(refId, mid) {
    refId = int(refId);
    for (const r of db.prepare('SELECT * FROM fz_ride WHERE ref_type = ? AND ref_id = ? AND driver_id = ?').all(refType, refId, mid)) cancel(r.id, { id: mid, lead: false });
    db.prepare('DELETE FROM fz_seat WHERE member_id = ? AND ride_id IN (SELECT id FROM fz_ride WHERE ref_type = ? AND ref_id = ?)').run(mid, refType, refId);
    db.prepare('DELETE FROM fz_request WHERE ref_type = ? AND ref_id = ? AND member_id = ?').run(refType, refId, mid);
  }
  /** Bezug gelöscht (z. B. Spieltag): Fahrten, Mitfahrten und Gesuche entfernen */
  function dropRef(refId) {
    db.prepare('DELETE FROM fz_ride WHERE ref_type = ? AND ref_id = ?').run(refType, int(refId));
    db.prepare('DELETE FROM fz_request WHERE ref_type = ? AND ref_id = ?').run(refType, int(refId));
  }

  /** Termin verlegt: Löschfrist und Zählung folgen dem neuen Tag */
  function touch(refId, date) {
    db.prepare('UPDATE fz_ride SET ref_date = ? WHERE ref_type = ? AND ref_id = ?').run(date, refType, int(refId));
    db.prepare('UPDATE fz_request SET ref_date = ? WHERE ref_type = ? AND ref_id = ?').run(date, refType, int(refId));
  }

  /* ---------- Löschfrist, Auskunft ---------- */
  const due = cut => db.prepare('SELECT (SELECT COUNT(*) FROM fz_ride WHERE ref_type = ? AND ref_date < ?) + (SELECT COUNT(*) FROM fz_request WHERE ref_type = ? AND ref_date < ?) n').get(refType, cut, refType, cut).n;
  const purge = cut => db.transaction(() => {
    const a = db.prepare('DELETE FROM fz_ride WHERE ref_type = ? AND ref_date < ?').run(refType, cut).changes;
    const b = db.prepare('DELETE FROM fz_request WHERE ref_type = ? AND ref_date < ?').run(refType, cut).changes;
    return a + b;
  })();
  /** alles, was zur Person gespeichert ist (titleOf(refId) → „Herren 40 bei TC … “) */
  function dataOf(mid, titleOf) {
    const t = id => { try { return titleOf(id) || ''; } catch (e) { return ''; } };
    const driven = db.prepare('SELECT * FROM fz_ride WHERE ref_type = ? AND driver_id = ? ORDER BY ref_date').all(refType, mid).map(r => ({ Termin: t(r.ref_id), Datum: r.ref_date, Richtung: DIR_TEXT[r.dir], Abfahrt: r.depart, Abfahrtsort: r.place, 'Freie Plätze': r.seats, Hinweis: r.note || '' }));
    const rode = db.prepare('SELECT r.*, s.persons FROM fz_seat s JOIN fz_ride r ON r.id = s.ride_id WHERE r.ref_type = ? AND s.member_id = ? ORDER BY r.ref_date').all(refType, mid).map(r => ({ Termin: t(r.ref_id), Datum: r.ref_date, Personen: r.persons, Abfahrt: r.depart, Abfahrtsort: r.place }));
    const wanted = db.prepare('SELECT * FROM fz_request WHERE ref_type = ? AND member_id = ? ORDER BY ref_date').all(refType, mid).map(q => ({ Termin: t(q.ref_id), Datum: q.ref_date, Personen: q.persons, Richtung: DIR_TEXT[q.dir] }));
    return { fahrten: driven, mitfahrten: rode, mitfahrgesuche: wanted };
  }

  /* ---------- Routen: Mitglieder-App (M) und Verwaltung (admin) ---------- */
  const fail = (res, e) => (e.status ? res.status(e.status).json({ error: e.message }) : res.status(400).json({ error: e.message }));
  /** Mitglieder-App: M.post('/ride/<handlung>'), Antwort ist die frische Ansicht des Bezugs. limit = Bremse (ctx.rateLimitKey) */
  function mountMember(M, limit) {
    const run = (name, fn, refOf) => M.post(`/ride/${name}`, limit, (req, res) => {
      try {
        const b = req.body || {}, refId = refOf(b);
        const info = ctxOf(refId), me = req.member.id;
        if (!elig(info, me)) throw err('Fahrgemeinschaften sehen nur Teilnehmende dieses Termins.', 403);
        const actor = { id: me, lead: Boolean(info.lead(me)), name: req.member.name };
        const out = fn(refId, actor, b);
        res.json({ ok: true, id: out || undefined, rides: view(int(refId), actor) });
      } catch (e) { fail(res, e); }
    });
    const rideRef = b => rideRow(b.ride_id).ref_id, direct = b => int(b.ref_id);
    run('offer', (ref, a, b) => offer(ref, a, b), direct);
    run('want', (ref, a, b) => want(ref, a, b), direct);
    run('unwant', (ref, a, b) => unwant(ref, a, b), direct);
    run('update', (ref, a, b) => update(b.ride_id, a, b), rideRef);
    run('cancel', (ref, a, b) => cancel(b.ride_id, a), rideRef);
    run('join', (ref, a, b) => join(b.ride_id, a, b), rideRef);
    run('leave', (ref, a, b) => leave(b.ride_id, a, b), rideRef);
    run('take', (ref, a, b) => take(b.ride_id, a, b), rideRef);
  }
  /** Verwaltung: admin.get('/rides/:ref') und admin.post('/rides/:ref/<handlung>') mit dem Recht des Moduls (need); Fahrten anbieten nur Mitglieder selbst */
  function mountAdmin(admin, P) {
    const actorOf = req => ({ admin: true, id: null, name: req.user ? req.user.name || req.user.username : 'Verwaltung', user: req.user });
    admin.get('/rides/:ref', P, (req, res) => { try { ctxOf(req.params.ref); res.json(view(int(req.params.ref), actorOf(req))); } catch (e) { fail(res, e); } });
    const acts = { update: (a, b) => update(b.ride_id, a, b), cancel: (a, b) => cancel(b.ride_id, a), join: (a, b) => join(b.ride_id, a, b), leave: (a, b) => leave(b.ride_id, a, b),
      take: (a, b) => take(b.ride_id, a, b), want: (a, b, ref) => want(ref, a, b), unwant: (a, b, ref) => unwant(ref, a, b) };
    for (const [name, fn] of Object.entries(acts)) admin.post(`/rides/:ref/${name}`, P, (req, res) => {
      try {
        const ref = int(req.params.ref), b = req.body || {};
        ctxOf(ref);
        if (b.ride_id && rideRow(b.ride_id).ref_id !== ref) throw err('Fahrt nicht gefunden.', 404);
        fn(actorOf(req), b, ref);
        res.json(view(ref, actorOf(req)));
      } catch (e) { fail(res, e); }
    });
  }

  return { views, view, offer, update, cancel, join, leave, want, unwant, take, withdraw, dropRef, touch, due, purge, dataOf, mountMember, mountAdmin, events };
}

module.exports = { init, bind, events, DIRS, DIR_TEXT, MAX_SEATS, MAX_OPEN };
