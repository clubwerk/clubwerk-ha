'use strict';
/* =====================================================================================================
   Platzcode (Teil des Moduls „Plätze“)
   Jede Platzbuchung – auch jeder Termin einer Serie – bekommt einen 6-stelligen Zufallscode für die Codetastatur am Tor.
   Welche Tore er öffnet, steht je Platz (bk_resource.code_doors = Türen aus dem Modul Zugang). Gültig ab „Puffer“ Minuten
   vor Beginn bis zum Ende der Buchung (kein Puffer nach dem Ende). Das Zeitfenster wird bei jeder Prüfung aus der Buchung
   gelesen: Verschieben verschiebt es mit, Storno macht den Code ungültig.
   Geheimnis-Regeln (planung/geheimnisse.md):
     - Der Code selbst liegt im Tresor (bk_code.code, src/vault.js SPEC) – nur Buchende, Mitspieler bzw. eingetragener Trainer
       sehen ihn (App, Mail, Tablet nach dem Buchen), in der Verwaltung nur mit Buchungsrecht und mit Protokolleintrag.
     - Zum Prüfen an der Tastatur dient code_h = Kennung des PIN-Pfeffers + HMAC(Pfeffer, Code). Der Pfeffer liegt nicht in
       der Datenbank (src/pfeffer.js), deshalb hilft eine Kopie der Datenbank nicht beim Durchprobieren der 1 Mio. Codes;
       geprüft wird auch bei gesperrtem Tresor (Tor nach einem Stromausfall), verglichen mit crypto.timingSafeEqual.
     - Nie im Protokoll, Export, in Sicherungen der Module oder in Fehlermeldungen. Abgelaufene Codes werden gelöscht.
   Modul Zugang fragt über den Hook courtCode({ door, code }); beide Module bleiben einzeln nutzbar.
   ===================================================================================================== */
const crypto = require('crypto');
const { today, addDays, deD } = require('../../../src/util');

const RE_CODE = /^\d{6}$/;
const RE_DOOR = /^[a-f0-9]{8}$/;

function activate(ctx, h) {
  const db = ctx.db, { J, resource, S } = h;
  const pf = ctx.require('./pfeffer');
  db.exec(`CREATE TABLE IF NOT EXISTS bk_code (
  booking_id INTEGER NOT NULL PRIMARY KEY REFERENCES bk_booking(id) ON DELETE CASCADE,   -- die Buchung, keine eigene laufende Nummer
  code       TEXT,                          -- 6 Ziffern, im Tresor verschlüsselt (src/vault.js SPEC)
  code_h     TEXT NOT NULL,                 -- Kennung des PIN-Pfeffers : HMAC(Pfeffer, Code) – Prüfung an der Tastatur
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);`);
  ctx.addColumns('bk_resource', { code_doors: "TEXT NOT NULL DEFAULT '[]'" });   // Türen (Modul Zugang), die der Code dieses Platzes öffnet

  /** Puffer vor Beginn in Minuten (Einstellungen, 0–60) */
  const lead = () => { const v = parseInt(S('code_lead_min', '15'), 10); return Number.isFinite(v) ? Math.max(0, Math.min(60, v)) : 15; };
  /** Türen mit Codetastatur aus dem Modul Zugang → [{ id, name, keypad }] (leer ohne Zugang) */
  const doorList = () => { const r = ctx.callHooksSync('codeDoors').find(x => x.id === 'zugang'); return r && Array.isArray(r.result) ? r.result : []; };
  const on = () => ctx.isModuleActive('zugang');
  const doorsOf = r => (r ? J(r.code_doors, []).filter(x => RE_DOOR.test(String(x))) : []);
  /** Braucht diese Buchung einen Code? Platzbuchungen und Serientermine auf Plätzen, denen Tore zugeordnet sind */
  /** … Platzhalter der Gästebuchung (Zahlung läuft/in Prüfung, ext_key „gast-halt:…“) bekommen keinen Code */
  const wants = (b, r = resource(b.resource_id)) => Boolean(on() && b && b.status === 'aktiv' && (b.type === 'buchung' || b.type === 'serie') && !/^gast-halt:/.test(b.ext_key || '') && r && r.kind === 'platz' && doorsOf(r).length);

  /* Codes, die dieser Prozess vergeben hat – damit Mail, App und Tablet sie auch bei gesperrtem Tresor zeigen können
     (die Kopie im Tresor ist dann nicht lesbar). Höchstens 2000, ältere fallen heraus. */
  const neu = new Map();
  const merken = (id, code) => { neu.delete(id); neu.set(id, code); if (neu.size > 2000) neu.delete(neu.keys().next().value); };

  /** Hash zum Nachschlagen: „Kennung:HMAC“ – null, solange der Pfeffer nach einer Wiederherstellung noch wartet */
  const hashOf = (code, id = pf.bereit()) => (id ? `${id}:${pf.mix(id, 'platzcode:' + code)}` : null);
  const gleich = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

  /** Code einer Buchung vergeben (falls noch keiner da) → Code (Text) oder null (kein Code nötig / Pfeffer wartet / Tresor gesperrt) */
  function ensure(b) {
    if (!wants(b)) return null;
    const row = db.prepare('SELECT code FROM bk_code WHERE booking_id = ?').get(b.id);
    if (row) return neu.get(b.id) || (RE_CODE.test(String(row.code || '')) ? row.code : null);
    const id = pf.bereit(); if (!id) return null;
    // keine zwei gleichen Codes an benachbarten Tagen (sonst öffnete ein Code womöglich ein fremdes Tor)
    const taken = db.prepare(`SELECT c.code_h FROM bk_code c JOIN bk_booking b ON b.id = c.booking_id WHERE b.status = 'aktiv' AND b.date BETWEEN ? AND ?`).all(addDays(b.date, -1), addDays(b.date, 1)).map(x => x.code_h);
    for (let i = 0; i < 50; i++) {
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0'), hh = hashOf(code, id);
      if (taken.some(t => gleich(t, hh))) continue;
      db.prepare('INSERT OR IGNORE INTO bk_code(booking_id, code, code_h) VALUES (?,?,?)').run(b.id, code, hh);
      merken(b.id, code);
      return code;
    }
    return null;
  }
  /** neuer Code (Personen oder Platz geändert: wer ausgetragen wurde, kennt den alten) */
  function renew(id) {
    db.prepare('DELETE FROM bk_code WHERE booking_id = ?').run(id); neu.delete(id);
    const b = db.prepare('SELECT * FROM bk_booking WHERE id = ?').get(id);
    return b ? ensure(b) : null;
  }
  const fenster = b => { const st = Date.parse(`${b.date}T${b.start}:00`), en = Date.parse(`${b.date}T${b.end === '24:00' ? '23:59' : b.end}:00`) + (b.end === '24:00' ? 60000 : 0); return { from: st - lead() * 60000, to: en }; };
  const hm = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  /** Anzeige für Berechtigte → { code, from, to, doors } | { pending: true, … } | null (kein Code für diese Buchung) */
  function view(b) {
    if (!wants(b)) return null;
    const r = resource(b.resource_id), f = fenster(b), all = doorList();
    const doors = doorsOf(r).map(id => (all.find(d => d.id === id) || {}).name).filter(Boolean);
    const base = { from: hm(f.from), to: b.end, doors, lead: lead() };
    const code = ensure(b);
    return code ? { code, ...base } : { pending: true, ...base };
  }
  /** Zeile für die Infokarte der Mails */
  function mailRow(b) {
    const v = view(b); if (!v) return null;
    return ['Platzcode', v.code ? `${v.code} (am Tor eintippen, gültig ${v.from}–${v.to} Uhr)` : 'folgt in der Mitglieder-App'];
  }

  /* ---------- Prüfen an der Tastatur (Hook für das Modul Zugang) ----------
     → { ok: true, booking, text, who } | { ok: false, why: 'falsch' | 'zeit' | 'tor' | 'wartet' } – nie der Code selbst */
  ctx.hooks.courtCode = ({ door, code } = {}) => {
    const c = String(code || '');
    if (!RE_DOOR.test(String(door || '')) || !RE_CODE.test(c)) return { ok: false, why: 'falsch' };
    const id = pf.bereit();
    if (!id) return { ok: false, why: 'wartet' };   // Pfeffer wartet nach einer Wiederherstellung aufs Entsperren (Zugang zeigt das an, zählt es nicht als Fehlversuch)
    const hh = hashOf(c, id), now = Date.now(), d0 = today();
    const rows = db.prepare(`SELECT b.*, c.code_h, r.name AS rname, r.code_doors FROM bk_booking b JOIN bk_code c ON c.booking_id = b.id JOIN bk_resource r ON r.id = b.resource_id
      WHERE b.status = 'aktiv' AND b.type IN ('buchung','serie') AND b.date IN (?, ?)`).all(d0, addDays(d0, 1));
    let hit = null;
    for (const b of rows) if (gleich(b.code_h, hh) && !hit) hit = b;   // alle vergleichen, kein früher Ausstieg je Zeile
    if (!hit) return { ok: false, why: 'falsch' };
    const text = `${hit.rname} ${deD(hit.date)} ${hit.start}–${hit.end}`, who = hit.member_id ? h.nameOf(hit.member_id) : (hit.title || 'Verein');
    if (!J(hit.code_doors, []).includes(String(door))) return { ok: false, why: 'tor', booking: hit.id, text, who };
    const f = fenster(hit);
    if (now < f.from || now >= f.to) return { ok: false, why: 'zeit', booking: hit.id, text, who, early: now < f.from };
    return { ok: true, booking: hit.id, text, who };
  };
  /* Codes nachtragen (Serien, Spielplan, Buchungen aus der Verwaltung) und aufräumen: für heute und morgen bekommt jede passende
     Buchung ihren Code, auch wenn ihn noch niemand angesehen hat; abgelaufene und stornierte Codes werden gelöscht. */
  function pflegen() {
    if (!ctx.isActive()) return;
    const id = pf.bereit();
    db.prepare(`DELETE FROM bk_code WHERE booking_id IN (SELECT id FROM bk_booking WHERE status != 'aktiv' OR date < ?)`).run(addDays(today(), -1));
    if (!on() || !id) return;
    const d0 = today();
    for (const b of db.prepare(`SELECT b.* FROM bk_booking b WHERE b.status = 'aktiv' AND b.type IN ('buchung','serie') AND b.date BETWEEN ? AND ? AND NOT EXISTS (SELECT 1 FROM bk_code c WHERE c.booking_id = b.id)`).all(d0, addDays(d0, 1))) ensure(b);
    // nach einer Wiederherstellung mit neuem Pfeffer: lesbare Codes neu einhängen (sonst öffneten sie nicht mehr)
    for (const r of db.prepare('SELECT booking_id, code, code_h FROM bk_code WHERE code_h NOT LIKE ?').all(id + ':%')) {
      if (RE_CODE.test(String(r.code || ''))) db.prepare('UPDATE bk_code SET code_h = ? WHERE booking_id = ?').run(hashOf(r.code, id), r.booking_id);
    }
  }
  setInterval(() => { try { pflegen(); } catch (e) { console.error('Platzcode:', e.message); } }, process.env.CW_TEST_FAST ? 2000 : 5 * 60000).unref();
  setTimeout(() => { try { pflegen(); } catch (e) { console.error('Platzcode:', e.message); } }, 3000).unref();

  /** Tore eines Platzes aus der Eingabe (nur Türen mit Tastatur aus dem Modul Zugang) */
  function doorsInput(v) {
    if (v === undefined) return undefined;
    const ok = new Set(doorList().filter(d => d.keypad).map(d => d.id));
    return JSON.stringify([...new Set((Array.isArray(v) ? v : []).map(String))].filter(x => RE_DOOR.test(x) && ok.has(x)).slice(0, 10));
  }
  const doorNames = json => { const all = doorList(); return J(json, []).map(id => (all.find(d => d.id === id) || { name: id }).name).join(', ') || '–'; };
  return { ensure, renew, view, mailRow, wants, doorList, doorsInput, doorNames, lead, on, pflegen };
}

module.exports = { activate };
