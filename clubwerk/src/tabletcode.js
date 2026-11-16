// @ts-check
'use strict';
/* 6-stellige Codes, mit denen am Tablet etwas zur Unterschrift geöffnet wird (Schlüsselübergabe, Beitrittserklärung).
   Gespeichert sind sie gesalzen (scrypt, auth.hashSecret) – das bleibt so. Zwei Bausteine dazu:
   - vorfilter(): Codes, die seit dem Start vergeben wurden, merkt sich der Server nur im Speicher als HMAC mit einem
     Zufallsschlüssel (nichts davon in Datenbank oder Sicherung). Ein falscher Code kostet so kein scrypt, ein richtiger genau eines.
     Nur Codes von vor einem Neustart (höchstens 3 Std. gültig) werden wie bisher der Reihe nach geprüft.
   - bremse(): Sperre je Tablet (Adresse) mit wachsender Dauer. Über alle Tablets zusammen nur eine Sicherheitswarnung, keine Sperre –
     sonst legte ein einziges Gerät mit wechselnden Adressen die Code-Eingabe aller Tablets immer länger lahm. */
const crypto = require('crypto');
const security = require('./security');
const GUELTIG_MS = 3 * 3600000;

function vorfilter() {
  const key = crypto.randomBytes(32), tag = c => crypto.createHmac('sha256', key).update(String(c)).digest('base64');
  const tags = new Map(), ids = new Map();   // Tag → id, id → { tag, bis }
  return {
    merke(id, code) {
      const now = Date.now();
      for (const [i, m] of ids) if (m.bis < now) { ids.delete(i); if (tags.get(m.tag) === i) tags.delete(m.tag); }
      const alt = ids.get(id); if (alt && tags.get(alt.tag) === id) tags.delete(alt.tag);
      const t = tag(code); tags.set(t, id); ids.set(id, { tag: t, bis: now + GUELTIG_MS });
    },
    /** einer(id) → wartende Zeile oder nichts; alle() → wartende Zeilen; pruefe(zeile) → Promise des scrypt-Vergleichs (auth.verifySecret ist asynchron) */
    async finde(code, { einer, alle, pruefe }) {
      const id = tags.get(tag(code));
      if (id !== undefined) { const r = einer(id); return r && await pruefe(r) ? r : null; }
      for (const r of alle()) if (!ids.has(r.id) && await pruefe(r)) return r;
      return null;
    },
  };
}

/** alarmTablet(): ein Tablet ist gesperrt worden; alarmAlle(): über alle Tablets mehr als 30 falsche Codes in 15 Minuten */
function bremse({ alarmTablet, alarmAlle }) {
  const je = security.limiter({ per: 8, baseMs: 15 * 60000 }), alle = security.budget({ max: 30, windowMs: 15 * 60000 });
  let gemeldet = 0;
  return {
    wartet: ip => je.blocked(ip),
    falsch(ip) {
      if (je.fail(ip).locked && alarmTablet) alarmTablet();
      if (!alle.take('*') && Date.now() - gemeldet > 15 * 60000) { gemeldet = Date.now(); alarmAlle(); }
    },
    richtig: ip => je.ok(ip),
  };
}

module.exports = { vorfilter, bremse };
