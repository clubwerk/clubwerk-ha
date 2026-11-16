'use strict';
/* Geräte in Zugang und Beregnung absichern (Entscheidung 01.11.2026, planung/sicherheit-review.md Abschnitt 4 Punkt 1):
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
async function bestaetigt(req, res, ownPwOk) {
  const pw = (req.body || {}).myPassword;
  if (pw === undefined) return { confirmed: false };
  const key = String(req.user.id);
  if (!fehlversuche.left(key)) { res.status(429).json({ error: 'Zu viele falsche Passwörter. Bitte kurz warten.' }); return null; }
  if (!(await ownPwOk(req, pw))) { fehlversuche.take(key); res.status(401).json({ error: 'Dein Passwort stimmt nicht.', pwWrong: true }); return null; }
  return { confirmed: true };
}

/** Fehler aus pruefen() als Antwort senden (true = gesendet) */
function antwort(res, e) {
  if (e.needPassword) { res.status(428).json({ error: e.message, needPassword: true }); return true; }
  if (e.status === 403) { res.status(403).json({ error: e.message }); return true; }
  return false;
}

/* Vereinstablet (Zugang, Flutlicht): Name wählen + App-PIN. Falsche PINs werden je Mitglied (3 in 15 Min.), je Gerät/Adresse
   (5 in 15 Min. → je 30 Min. Pause) und insgesamt gezählt – nie auf das Handy des Mitglieds. Nach 10 Fehlversuchen innerhalb von
   24 Stunden – egal bei welchem Mitglied – ruft der Zähler sperren(name) auf (das Modul schaltet das Tablet ab und warnt den Vorstand).
   Jedes Modul hat seine eigene Zählung. */
function tabletPin({ texte, pruefen, name, sperren }) {
  const T_FAILS = { ip: new Map(), member: new Map(), all: [] };
  const tFail = (map, key, max) => {
    const now = Date.now(); const f = map.get(key) || { times: [], until: 0 };
    f.times = f.times.filter(t => now - t < 15 * 60000); f.times.push(now);
    if (f.times.length >= max) { f.until = now + 30 * 60000; f.times = []; }
    if (map.size > 1000) map.delete(map.keys().next().value);
    map.set(key, f);
  };
  const tBlocked = (map, key) => { const f = map.get(key); return Boolean(f && f.until > Date.now()); };
  function tabletFail(ip, who, memberId) {
    const now = Date.now();
    tFail(T_FAILS.ip, ip, 5);              // je Gerät: 5 in 15 Min. → 30 Min. Pause
    tFail(T_FAILS.member, memberId, 3);    // je Mitglied am Tablet: 3 in 15 Min. → 30 Min. Pause (Handy bleibt unberührt)
    T_FAILS.all = T_FAILS.all.filter(t => now - t < 24 * 3600000); T_FAILS.all.push(now);
    if (T_FAILS.all.length >= 10) { T_FAILS.all = []; sperren(who); }
  }
  /** PIN prüfen → Ergebnis von pruefen(id, pin) – oder null, dann ist die Antwort schon gesendet (gesperrt/falsch) */
  return async (req, res, id, pin) => {
    const ip = req.ip || req.socket.remoteAddress || '';
    if (tBlocked(T_FAILS.ip, ip)) { res.status(429).json({ error: texte.ip }); return null; }
    if (tBlocked(T_FAILS.member, id)) { res.status(429).json({ error: texte.member }); return null; }
    const chk = await pruefen(id, pin);
    if (!chk.ok) {
      if (chk.pin || chk.status === 401) tabletFail(ip, name(id), id);
      res.status(chk.status).json({ error: chk.error, pin: chk.pin }); return null;
    }
    return chk;
  };
}

module.exports = { full, integrationSet, pruefen, antwort, bestaetigt, tabletPin };
