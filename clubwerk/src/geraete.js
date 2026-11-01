'use strict';
/* Geräte in Zugang und Beregnung absichern (Entscheidung Thorsten 01.11.2026, planung/sicherheit-review.md Abschnitt 4 Punkt 1):
   - Wer einer Tür bzw. einem Ventil ein Home-Assistant-Gerät neu zuordnet (neue Tür/Zone oder anderes Gerät), bestätigt mit dem
     eigenen Passwort – in den Einstellungen und beim Funktionsimport.
   - Ohne „alle Rechte“ nur Geräte der gewählten Hersteller-Integration; „Gemischt / anderer Hersteller“ (freie Gerätewahl)
     wählen und dort Geräte zuordnen nur mit allen Rechten.
   Die Sicherheitswarnung an den Vorstand (doorAlert/zoneAlert) bleibt unverändert. */
const ha = require('./ha');

const full = user => Boolean(user && user.role === 'oberadmin');
const fehler = (msg, extra) => Object.assign(new Error(msg), extra);

/** Entitäten einer Integration als Set – null, wenn Home Assistant sie nicht nennt (ältere Version, keine Verbindung, keine Geräte) */
async function integrationSet(integration) {
  if (!integration) return null;
  try { const r = await ha.integrationEntities(integration); return Array.isArray(r) && r.length ? new Set(r) : null; } catch (e) { return null; }
}

/**
 * Prüft eine Änderung, bevor sie gespeichert wird.
 * @param {object} o
 *   changed       Entitäten, die neu einer Tür/Zone zugeordnet werden
 *   vendor        { name, integration, domains?, free } – free: freie Gerätewahl („Gemischt / anderer Hersteller“)
 *   vendorChanged Hersteller wurde umgestellt
 *   user, confirmed (eigenes Passwort bestätigt), dry (Vorschau), info (Import: needPassword wird gesetzt)
 * Wirft einen Fehler mit status 403 (Recht fehlt) bzw. 428 + needPassword (Passwort nötig).
 */
async function pruefen({ changed, vendor, vendorChanged, user, confirmed, dry, info }) {
  if (!full(user)) {
    if (vendor.free && (vendorChanged || changed.length)) {
      throw fehler(`„${vendor.name}“ mit freier Gerätewahl dürfen nur Benutzer mit allen Rechten einrichten. Bitte den Hersteller der Geräte wählen – oder einen Benutzer mit allen Rechten bitten.`, { status: 403 });
    }
    // Vorschau (dry) läuft in einem offenen Sicherungspunkt der Datenbank – dort nicht auf Home Assistant warten (sonst würden gleichzeitige
    // Änderungen anderer Anfragen mit zurückgerollt). Die Integration prüft der echte Import.
    if (changed.length && !dry) {
      const set = await integrationSet(vendor.integration);
      if (!set) throw fehler(`Home Assistant nennt keine Geräte der Integration „${vendor.name}“ – Geräte zuordnen kann gerade nur ein Benutzer mit allen Rechten.`, { status: 403 });
      const fremd = changed.filter(ref => !set.has(ref) || (vendor.domains && !vendor.domains.includes(ref.split('.')[0])));
      if (fremd.length) throw fehler(`„${fremd[0]}“ gehört nicht zur Integration „${vendor.name}“. Andere Geräte darf nur ein Benutzer mit allen Rechten zuordnen.`, { status: 403 });
    }
  }
  if (changed.length && !confirmed) {
    if (dry) { if (info) info.needPassword = true; return; }
    throw fehler('Geräte zuordnen bitte mit deinem Passwort bestätigen.', { status: 428, needPassword: true });
  }
}

/* Falsche Passwörter je Benutzer zählen (gemeinsam für Zugang, Beregnung und Funktionsimport): 10 in 10 Minuten, dann Pause */
const fehlversuche = require('./security').budget({ max: 10, windowMs: 10 * 60000, size: 5000 });
/** Eigenes Passwort aus dem Body (myPassword) prüfen. → { confirmed } – oder null, dann ist die Antwort schon gesendet (falsch/zu viele Versuche). */
function bestaetigt(req, res, ownPwOk) {
  const pw = (req.body || {}).myPassword;
  if (pw === undefined) return { confirmed: false };
  const key = String(req.user.id);
  if (!fehlversuche.left(key)) { res.status(429).json({ error: 'Zu viele falsche Passwörter. Bitte kurz warten.' }); return null; }
  if (!ownPwOk(req, pw)) { fehlversuche.take(key); res.status(401).json({ error: 'Dein Passwort stimmt nicht.', pwWrong: true }); return null; }
  return { confirmed: true };
}

/** Fehler aus pruefen() als Antwort senden (true = gesendet) */
function antwort(res, e) {
  if (e.needPassword) { res.status(428).json({ error: e.message, needPassword: true }); return true; }
  if (e.status === 403) { res.status(403).json({ error: e.message }); return true; }
  return false;
}

module.exports = { full, integrationSet, pruefen, antwort, bestaetigt };
