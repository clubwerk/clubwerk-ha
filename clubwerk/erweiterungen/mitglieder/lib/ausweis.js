'use strict';
/**
 * Digitaler Mitgliedsausweis (planung/mitgliedsausweis.md, Stufe 1)
 *  - Mitglieder-App: „Meine Daten“ › Reiter „Ausweis“ holt die Karte (höchstens einmal am Tag) und speichert sie im Handy –
 *    so geht sie auch ohne Netz (Hinweisseite offline.html). Der QR-Code gilt 30 Tage, danach braucht es wieder Netz.
 *  - QR-Inhalt: CW1.<Inhalt>.<Signatur> (base64url). Inhalt = Kennung des Schlüssels, Seriennummer, interne Mitglieds-ID,
 *    „gültig bis“ und Ablauf des Codes (je JJJJMMTT) – kein Name, kein Geburtsdatum. Signatur Ed25519 (node:crypto).
 *  - Der private Schlüssel liegt im Tresor (ctx.geheim), der öffentliche in den Einstellungen. Nach einem Neustart mit gesperrtem
 *    Tresor gelten ausgestellte Karten weiter (Prüfen braucht nur den öffentlichen Schlüssel); nur neue Karten warten (423).
 *  - Prüfen (Entscheidung 22.11.2026): nur in der Mitglieder-App, von Mitgliedern mit dem Schalter „Ausweise prüfen“ (Verwaltung ›
 *    Mitglieder-App › Mitglied, Bereich „Meine Daten“; Hook accessOptions) – Kamera, kein Eintippen von Nummern, nichts ohne Anmeldung.
 *    Die Verwaltung zeigt den Stand beim Mitglied (Reiter „Ausweis“). Prüfungen werden nicht gespeichert, nur Fehlversuche je Mitglied
 *    gezählt (Sperre); geht auch bei gesperrtem Tresor (nur der öffentliche Schlüssel, Foto dann nicht).
 *  - Sperren / neu ausstellen: die Seriennummer gilt nicht mehr, das Handy holt beim nächsten Öffnen eine neue Karte.
 */
const crypto = require('crypto');
const { lastFirst } = require('../../../src/db');

const CODE_DAYS = 30;                      // so lange gilt ein QR-Code höchstens
const OLD_KEY_DAYS = CODE_DAYS + 1;        // alter öffentlicher Schlüssel nach einem Wechsel: so lange gelten seine Codes noch
const TOKEN_RE = /^CW1\.([A-Za-z0-9_-]{24,80})\.([A-Za-z0-9_-]{86})$/;
const BODY_RE = /^([A-Za-z0-9_-]{8})\.(\d{1,9})\.(\d{1,9})\.(\d{8})\.(\d{8})$/;
const b64u = buf => Buffer.from(buf).toString('base64url');
const ymd = d => d.replace(/-/g, '');
const dmy = s => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

function register(sh) {
  const { C, store, personRow, deD, ar } = sh;
  const { S, SET, today, nowTs } = store;
  const { bad, int, need } = C;
  const db = C.db, admin = C.admin, M = C.member;
  const photos = C.require('./photos');
  const vault = () => C.require('./vault');

  db.exec(`CREATE TABLE IF NOT EXISTS mv_card (
    serial      INTEGER PRIMARY KEY AUTOINCREMENT,              -- Seriennummer; AUTOINCREMENT: nie erneut vergeben (auch nach dem Löschen)
    member_id   INTEGER NOT NULL REFERENCES members(id),
    issued_at   TEXT NOT NULL,
    valid_until TEXT NOT NULL,                                  -- zuletzt ausgegebenes „gültig bis“ (JJJJ-MM-TT)
    revoked_at  TEXT, revoked_by TEXT
  );
  CREATE INDEX IF NOT EXISTS ix_mvcard_member ON mv_card(member_id);`);
  C.geheim.melden('card_key', 'Mitgliedsausweis: Signaturschlüssel');

  /* ---------- Einstellungen ---------- */
  const FIELDS = { depts: 'Abteilungen', age: 'Altersstufe', since: 'Mitglied seit' };
  const cfg = () => {
    let f = {}; try { f = JSON.parse(S('card_fields', '{}')) || {}; } catch (e) { f = {}; }
    return { on: S('card_on', '0') === '1', photo: S('card_photo', 'optional') === 'nie' ? 'nie' : 'optional',
      valid: S('card_valid', 'beitrag') === 'geschaeft' ? 'geschaeft' : 'beitrag', fields: Object.fromEntries(Object.keys(FIELDS).map(k => [k, f[k] !== false])) };
  };
  sh.cardOn = () => cfg().on;
  /** darf dieses Mitglied in der App Ausweise prüfen? (Schalter je Mitglied im Bereich „Meine Daten“) */
  const mayCheck = req => Boolean(cfg().on && req.member && req.member.access && req.member.access.flags && req.member.access.flags.ausweis_pruefen);
  sh.cardCheck = mayCheck;
  C.hooks.accessOptions = () => (cfg().on ? { flags: [{ id: 'ausweis_pruefen', label: 'Ausweise prüfen', title: 'Darf in der App Mitgliedsausweise anderer mit der Kamera prüfen (z. B. Thekendienst, Trainer)' }] } : null);
  C.hooks.photoUseOn = use => use !== 'ausweis' || (cfg().on && cfg().photo !== 'nie');   // Verwendung „Mitgliedsausweis“ beim Profilbild (src/memberapp.js)

  /* ---------- Schlüssel ---------- */
  const kidOf = pubDer => b64u(pubDer.subarray(-32)).slice(0, 8);   // Kennung des Vereins: die ersten 8 Zeichen des öffentlichen Schlüssels
  function currentKey() {
    const pub = S('card_pub');
    return pub ? { kid: S('card_kid'), pub: crypto.createPublicKey({ key: Buffer.from(pub, 'base64'), format: 'der', type: 'spki' }) } : null;
  }
  function oldKeys() { try { const a = JSON.parse(S('card_keys_old', '[]')); return Array.isArray(a) ? a.filter(k => k && k.until >= today()) : []; } catch (e) { return []; } }
  function keyFor(kid) {
    const c = currentKey(); if (c && c.kid === kid) return c.pub;
    const o = oldKeys().find(k => k.kid === kid);
    return o ? crypto.createPublicKey({ key: Buffer.from(o.pub, 'base64'), format: 'der', type: 'spki' }) : null;
  }
  /** neuen Schlüssel erzeugen (beim ersten Ausweis oder „Schlüssel wechseln“) – der alte öffentliche bleibt OLD_KEY_DAYS gemerkt */
  function newKey() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pubDer = publicKey.export({ format: 'der', type: 'spki' });
    const prev = S('card_pub');
    if (prev) SET('card_keys_old', JSON.stringify([...oldKeys(), { kid: S('card_kid'), pub: prev, until: C.util.addDays(today(), OLD_KEY_DAYS) }].slice(-3)));
    C.geheim.set('card_key', privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'));
    SET('card_pub', pubDer.toString('base64')); SET('card_kid', kidOf(pubDer));
  }
  /** privater Schlüssel → KeyObject; null, solange der Tresor gesperrt ist */
  function privateKey() {
    if (!C.geheim.has('card_key') || !S('card_pub')) { if (vault().locked()) return null; newKey(); }
    const v = C.geheim.get('card_key', null);
    return v ? crypto.createPrivateKey({ key: Buffer.from(v, 'base64'), format: 'der', type: 'pkcs8' }) : null;
  }

  /* ---------- Gültigkeit ---------- */
  /** Ende des laufenden Beitragsjahres (bzw. Geschäftsjahres) – bei einem Austritt der Austrittstag, wenn er früher liegt */
  function validUntil(p, day = today()) {
    let end;
    if (cfg().valid === 'geschaeft') end = C.geschaeftsjahr.endOf(day);
    else {
      const md = /^\d{2}-\d{2}$/.test(S('year_start', '01-01')) ? S('year_start', '01-01') : '01-01';
      const y = +day.slice(0, 4), start = `${y}-${md}` <= day ? `${y + 1}-${md}` : `${y}-${md}`;
      end = C.util.addDays(start, -1);
    }
    return p.exit_date && p.exit_date < end ? p.exit_date : end;
  }
  /** Zustand eines Mitglieds für den Ausweis: ok | none | pending | exited */
  function stateOf(p, day = today()) {
    if (!p || !p.member_id || p.kind !== 'mitglied' || p.anonymized_at) return 'none';
    if (p.pending) return 'pending';
    if (store.isExited(p, day)) return 'exited';
    return 'ok';
  }
  const activeCard = id => db.prepare('SELECT * FROM mv_card WHERE member_id = ? AND revoked_at IS NULL ORDER BY serial DESC LIMIT 1').get(id);

  /* ---------- Inhalt der Karte (App, Prüfung) ---------- */
  const STATUS_TXT = { aktiv: 'Aktiv', passiv: 'Passiv', ehren: 'Ehrenmitglied', ruhend: 'Ruhend' };
  function view(p, c) {
    const f = cfg().fields, info = C.hooks.memberInfo(p.id) || {};
    const depts = f.depts ? db.prepare(`SELECT d.name FROM mv_member_department md JOIN mv_department d ON d.id = md.department_id WHERE md.member_id = ?
      AND (md.entry_date IS NULL OR md.entry_date <= ?) AND (md.exit_date IS NULL OR md.exit_date >= ?) AND md.status != 'ausgetreten' ORDER BY d.sort, d.name`).all(p.id, today(), today()).map(r => r.name) : [];
    return { name: lastFirst(p.name, 'mitglied'), no: p.member_no || '', status: STATUS_TXT[p.status] || 'Aktiv',
      since: f.since && p.entry_date ? p.entry_date.slice(0, 4) : '', depts, age: f.age && info.fee ? info.fee.name : '',
      valid_until: c.valid_until, issued_at: c.issued_at.slice(0, 10), serial: c.serial, exit_date: p.exit_date || '' };
  }
  const photoOf = id => {
    if (cfg().photo === 'nie') return null;
    const buf = photos.read(id, 'ausweis');
    return buf ? 'data:image/jpeg;base64,' + buf.toString('base64') : null;
  };

  /* ---------- Code signieren und prüfen ---------- */
  function sign(key, kid, c, exp) {
    const body = b64u(`${kid}.${c.serial}.${c.member_id}.${ymd(c.valid_until)}.${ymd(exp)}`);
    return `CW1.${body}.${b64u(crypto.sign(null, Buffer.from('CW1.' + body), key))}`;
  }
  /** Code lesen und Signatur prüfen → { serial, mid, until, exp } oder null (falsch, verändert, abgeschnitten, fremder Schlüssel) */
  function parse(code) {
    const s = String(code || '').trim();
    if (s.length > 200) return null;
    const m = TOKEN_RE.exec(s); if (!m) return null;
    const b = BODY_RE.exec(Buffer.from(m[1], 'base64url').toString('latin1')); if (!b) return null;
    if (b64u(Buffer.from(m[1], 'base64url')) !== m[1]) return null;   // nur die eine, kanonische Schreibweise
    const key = keyFor(b[1]); if (!key) return null;
    let ok = false; try { ok = crypto.verify(null, Buffer.from('CW1.' + m[1]), key, Buffer.from(m[2], 'base64url')); } catch (e) { ok = false; }
    return ok ? { serial: +b[2], mid: +b[3], until: dmy(b[4]), exp: dmy(b[5]) } : null;
  }
  /** Ergebnis für die Anzeige – nur, was angezeigt wird */
  function check(t, { photo = true } = {}) {
    const day = today();
    const c = db.prepare('SELECT * FROM mv_card WHERE serial = ?').get(t.serial);
    const p = personRow(t.mid);
    const st = stateOf(p, day);
    if (!c || c.member_id !== t.mid || st === 'none') return { result: 'beendet' };   // Konto gelöscht oder anonymisiert
    if (st === 'exited') return { result: 'beendet', name: lastFirst(p.name, 'mitglied'), exit_date: p.exit_date };
    if (c.revoked_at) return { result: 'gesperrt' };
    if (st !== 'ok') return { result: 'ungueltig' };
    const v = view(p, c);
    if (t.exp < day || t.until < day) return { result: 'abgelaufen', name: v.name, valid_until: t.until < day ? t.until : v.valid_until, code_exp: t.exp };
    return { result: 'ok', ...v, valid_until: validUntil(p, day) < t.until ? validUntil(p, day) : t.until, photo: photo ? photoOf(p.id) : null };
  }

  /* ---------- Fehlversuche: Sperre je Gerät, Sicherheitswarnung bei Häufung über alle Geräte ---------- */
  const bremse = C.require('./tabletcode').bremse({
    alarmTablet: () => C.securityAlert('ausweis_faelschung', 'Mitgliedsausweis: Ein Prüfer wurde nach mehreren ungültigen Codes gesperrt – bitte prüfen, wer gefälschte Ausweise vorzeigt.'),
    alarmAlle: () => C.securityAlert('ausweis_faelschung', 'Mitgliedsausweis: über alle Geräte mehr als 30 ungültige Codes in 15 Minuten – bitte prüfen, wer Codes durchprobiert.'),
  });
  function verify(req, res, who) {
    const w = bremse.wartet(who);
    if (w) return bad(res, `Zu viele ungültige Codes – bitte ${w} Min. warten.`, 429);
    const t = parse((req.body || {}).code);
    if (!t) { bremse.falsch(who); return res.json({ result: 'ungueltig' }); }
    bremse.richtig(who);
    res.json(check(t));
  }

  /* ---------- Mitglieder-App ---------- */
  // Tresor gesperrt: die Middleware in lib/memberapp.js antwortet schon mit 423 – die App zeigt dann die gespeicherte Karte weiter
  M.get('/ausweis', ar(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!cfg().on) return res.json({ state: 'off' });
    const p = personRow(req.member.id), st = stateOf(p);
    if (st === 'exited') return res.json({ state: 'exited', exit_date: p.exit_date });
    if (st !== 'ok') return res.json({ state: st });
    const key = privateKey();
    if (!key) return bad(res, 'Dein Ausweis wird erneuert, sobald sich der Vorstand in der Verwaltung angemeldet hat.', 423);
    const day = today(), until = validUntil(p, day);
    let c = activeCard(p.id);
    if (!c) {
      const r = db.prepare('INSERT INTO mv_card(member_id, issued_at, valid_until) VALUES (?, ?, ?)').run(p.id, nowTs(), until);
      c = db.prepare('SELECT * FROM mv_card WHERE serial = ?').get(Number(r.lastInsertRowid));
    } else if (c.valid_until !== until) { db.prepare('UPDATE mv_card SET valid_until = ? WHERE serial = ?').run(until, c.serial); c.valid_until = until; }
    const plus = C.util.addDays(day, CODE_DAYS), exp = plus < until ? plus : until;
    const token = sign(key, S('card_kid'), c, exp);
    const svg = await C.require('qrcode').toString(token, { type: 'svg', margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
    res.json({ state: 'ok', card: { ...view(p, c), club: C.getSetting('club_name', ''), exp, token, qr: svg, photo: photoOf(p.id), fetched: day } });
  }));

  /** Prüfen in der App: nur der signierte Code – keine Nummern-Eingabe (sonst ließen sich Foto und Name beliebiger Mitglieder abrufen) */
  M.post('/ausweis/pruefen', C.rateLimitKey('mvausweis', 120, 10 * 60000, req => 'm' + req.member.id), (req, res) => {
    if (!mayCheck(req)) return bad(res, 'Ausweise prüfen darf nur, wem der Vorstand das in der Verwaltung freigeschaltet hat.', 403);
    verify(req, res, 'app:' + req.member.id);
  });

  /* ---------- Verwaltung ---------- */
  const P = need('mitglieder');
  admin.get('/member/:id/ausweis', P, (req, res) => {
    const id = int(req.params.id), p = personRow(id);
    if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    res.json({ on: cfg().on, state: stateOf(p), photo: photos.version(id, 'ausweis') !== null && cfg().photo !== 'nie',
      cards: db.prepare('SELECT serial, issued_at, valid_until, revoked_at, revoked_by FROM mv_card WHERE member_id = ? ORDER BY serial DESC LIMIT 20').all(id) });
  });
  admin.post('/member/:id/ausweis/sperren', P, (req, res) => {
    const id = int(req.params.id), p = personRow(id);
    if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    const n = db.prepare('UPDATE mv_card SET revoked_at = ?, revoked_by = ? WHERE member_id = ? AND revoked_at IS NULL').run(nowTs(), sh.uname(req), id).changes;
    if (!n) return bad(res, 'Für dieses Mitglied gibt es keinen gültigen Ausweis.');
    store.hist(id, sh.uname(req), 'Mitgliedsausweis', 'gültig', 'gesperrt – neuer Ausweis beim nächsten Öffnen der App');
    C.audit(req.user, 'Mitglieder: Ausweis gesperrt', lastFirst(p.name, 'mitglied'));
    res.json({ ok: true });
  });
  admin.get('/ausweis/settings', P, (req, res) => res.json({ ...cfg(), labels: FIELDS, kid: S('card_kid'), active: db.prepare('SELECT COUNT(*) n FROM mv_card WHERE revoked_at IS NULL').get().n }));
  admin.put('/ausweis/settings', P, (req, res) => {
    const b = req.body || {}, before = cfg();
    const after = { on: b.on === undefined ? before.on : Boolean(b.on),
      photo: b.photo === undefined ? before.photo : b.photo === 'nie' ? 'nie' : 'optional', valid: b.valid === undefined ? before.valid : b.valid === 'geschaeft' ? 'geschaeft' : 'beitrag',
      fields: Object.fromEntries(Object.keys(FIELDS).map(k => [k, b.fields && b.fields[k] !== undefined ? Boolean(b.fields[k]) : before.fields[k]])) };
    SET('card_on', after.on ? '1' : '0'); SET('card_photo', after.photo); SET('card_valid', after.valid); SET('card_fields', JSON.stringify(after.fields));
    const L = { on: ['Mitgliedsausweis', 'bool'], photo: 'Foto auf dem Ausweis', valid: 'Ausweis gültig bis', depts: ['Ausweis zeigt Abteilungen', 'bool'], age: ['Ausweis zeigt Altersstufe', 'bool'], since: ['Ausweis zeigt „Mitglied seit“', 'bool'] };
    const flat = x => ({ on: String(x.on), photo: x.photo === 'nie' ? 'nie' : 'optional', valid: x.valid === 'geschaeft' ? 'Ende des Geschäftsjahres' : 'Ende des Beitragsjahres', depts: String(x.fields.depts), age: String(x.fields.age), since: String(x.fields.since) });
    const diff = C.auditDiff(L, flat(before), flat(after));
    if (diff) C.audit(req.user, 'Mitglieder: Einstellungen geändert', diff);
    res.json({ ok: true });
  });
  /** alle Ausweise sperren – jedes Handy holt beim nächsten Öffnen eine neue Karte */
  admin.post('/ausweis/alle-sperren', P, (req, res) => {
    const n = db.prepare('UPDATE mv_card SET revoked_at = ?, revoked_by = ? WHERE revoked_at IS NULL').run(nowTs(), sh.uname(req)).changes;
    C.audit(req.user, 'Mitglieder: alle Ausweise gesperrt', `${n} Ausweise`);
    res.json({ ok: true, n });
  });
  /** Schlüssel wechseln: neue Kennung; alte Codes gelten bis zu ihrem Ablauf weiter (höchstens 30 Tage) */
  admin.post('/ausweis/schluessel', P, (req, res) => {
    if (vault().locked()) return bad(res, 'Der Tresor ist seit dem Neustart gesperrt – bitte erst entsperren.', 423);
    newKey();
    C.audit(req.user, 'Mitglieder: Schlüssel der Ausweise gewechselt', `neue Kennung ${S('card_kid')}`);
    res.json({ ok: true, kid: S('card_kid') });
  });

  /* ---------- Datenschutz ---------- */
  sh.cardsOf = id => db.prepare('SELECT serial AS seriennummer, issued_at AS ausgestellt, valid_until AS gueltig_bis, revoked_at AS gesperrt FROM mv_card WHERE member_id = ? ORDER BY serial').all(id);
  /** „Für mich“: dauerhafte Zeile „Mitgliedsausweis zeigen“ – nur mit gültigem Ausweis (ausgestellt, nicht gesperrt, Mitglied nicht ausgetreten) */
  /* „gültig bis“ frisch wie auf der Karte – das gespeicherte ist nach einem Jahreswechsel veraltet, bis das Handy die Karte neu holt */
  sh.cardLink = id => { if (!cfg().on) return null; const p = personRow(id), until = activeCard(id) && stateOf(p) === 'ok' && validUntil(p); return until && until >= today() ? { title: 'Mitgliedsausweis zeigen', sub: `gültig bis ${deD(until)}`, focus: 'ausweis', tr: true } : null; };
  sh.cardsForget = id => db.prepare('DELETE FROM mv_card WHERE member_id = ?').run(id);
  C.hooks.privacyRecord = () => (cfg().on ? [{ title: 'Digitaler Mitgliedsausweis', purpose: 'Nachweis der Mitgliedschaft (Art. 6 Abs. 1 b DSGVO)',
    data: 'Seriennummer, Ausstellungsdatum, „gültig bis“; auf dem Handy des Mitglieds: Name, Mitgliedsnummer, Status, Abteilungen, Foto nur mit eigener Wahl. Prüfungen werden nicht gespeichert.',
    persons: 'Mitglieder mit der Mitglieder-App', frist: 'bis zum Anonymisieren oder Löschen des Mitglieds' }] : []);

  // für die Testreihe „ausweis“ und den Demo-Server
  sh.ausweis = { parse, check, validUntil };
}

module.exports = { register, CODE_DAYS };
