// @ts-check
'use strict';
/* ---------- Pfeffer für PINs (Härtung 46, Entscheidung 16.11.2026) ----------
   PINs haben 4–6 Ziffern, also höchstens 1 Mio. Möglichkeiten. Salt und scrypt bremsen, aber aus einer Kopie der Datenbank
   ließe sich jede PIN in Stunden durchprobieren. Deshalb rechnet auth.hashPin scrypt über HMAC(Pfeffer, PIN). Der Pfeffer
   steht NICHT in der Datenbank, sondern in der Datei pin-pfeffer.key im Datenordner (nur für Clubwerk lesbar, nicht in den
   Sicherungen von Clubwerk; im Home-Assistant-Backup bewusst enthalten – Wiederherstellung des ganzen Systems ohne neue PINs,
   HA verschlüsselt seine Backups; planung/haertung-2026-11.md, Stand B2).
   Warum nicht im Tresor: Tablet-, App- und Tür-PINs müssen nach einem Neustart ohne Anmeldung gehen, der Tresor ist dann
   gesperrt (GEHEIM_AUSSEN, planung/geheimnisse.md).
   Wiederherstellung auf einem neuen Gerät: Die Datenbank kennt die Kennung des Pfeffers (pin_pfeffer_id, kein Geheimnis)
   und – nur bei eingeschaltetem Tresor – eine mit dem Tresor verschlüsselte Kopie (pin_pfeffer_kopie). Fehlt die Datei oder
   passt sie nicht zur Datenbank:
     - Tresor ein  → PINs warten, bis sich ein Admin anmeldet; dann kommt der Pfeffer aus der Kopie zurück (Meldung 423 bis dahin).
     - keine Kopie → neuer Pfeffer, PINs mit dem alten gelten nicht mehr und müssen neu gesetzt werden (Sicherheitswarnung,
                     klare Meldung bei jeder solchen PIN statt „PIN falsch“).
   Zustand: ok | wartet. API: bereit() → Kennung oder null · mix(kennung, pin) · status() · start() */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getSetting, setSetting, audit, DATA_DIR } = require('./db');

const DATEI = path.join(DATA_DIR, 'pin-pfeffer.key');
const kennung = k => crypto.createHash('sha256').update('clubwerk-pin-pfeffer:' + k).digest('hex').slice(0, 12);   // geheim-ok: Kennung des Pfeffers (32 Byte Zufall), keine PIN
let KEY = null, ID = null, zustand = null;   // null = noch nicht geladen
const vault = () => require('./vault');

function lesen() {
  try { const s = fs.readFileSync(DATEI, 'utf8').trim(); return /^[0-9a-f]{64}$/.test(s) ? s : null; } catch (e) { return null; }
}
function schreiben(k) {   // erst vollständig schreiben, dann umbenennen – ein Stromausfall hinterlässt nie eine halbe Datei
  const tmp = DATEI + '.tmp';
  fs.writeFileSync(tmp, k + '\n', { mode: 0o600 });
  fs.renameSync(tmp, DATEI);
}
function nutzen(k) { KEY = k; ID = kennung(k); zustand = 'ok'; setSetting('pin_pfeffer_id', ID); kopieSichern(); }

/** Kopie im Tresor aktuell halten (nur bei eingeschaltetem Tresor; schreiben geht auch gesperrt). Tresor aus → keine Kopie,
 *  sonst stünde der Pfeffer im Klartext neben den Hashes. */
function kopieSichern() {
  try {
    const v = vault();
    if (!v.on()) { if (getSetting('pin_pfeffer_kopie', '')) setSetting('pin_pfeffer_kopie', ''); return; }
    if (getSetting('pin_pfeffer_kopie_id', '') !== ID || !getSetting('pin_pfeffer_kopie', '')) {
      setSetting('pin_pfeffer_kopie', v.encValue(KEY)); setSetting('pin_pfeffer_kopie_id', ID);
    }
  } catch (e) { console.error('PIN-Pfeffer – Kopie im Tresor:', e.message); }
}

/** Pfeffer aus der Tresor-Kopie holen → true, wenn es geklappt hat; 'gesperrt', wenn der Tresor noch zu ist */
function ausKopie(id) {
  const v = vault(), kopie = getSetting('pin_pfeffer_kopie', '');
  if (!v.on() || !kopie || getSetting('pin_pfeffer_kopie_id', '') !== id) return false;
  if (v.locked()) return 'gesperrt';
  let k; try { k = v.decValue(kopie); } catch (e) { return false; }
  if (!/^[0-9a-f]{64}$/.test(String(k)) || kennung(k) !== id) return false;
  const alt = lesen(); if (alt) try { fs.renameSync(DATEI, DATEI + '.alt'); } catch (e) { console.error('PIN-Schlüssel: bisherige Datei nicht als .alt gesichert:', e.message); }
  schreiben(k); nutzen(k);
  audit('system', 'PINs nach Wiederherstellung wieder gültig', 'Schlüssel der PINs aus dem Tresor übernommen');
  return true;
}

/** Kein Weg zurück: neuer Pfeffer. PINs mit dem alten Pfeffer müssen neu gesetzt werden (verify meldet das deutlich). */
function neuBeginnen(altId) {
  const alt = lesen(); if (alt) try { fs.renameSync(DATEI, DATEI + '.alt'); } catch (e) { console.error('PIN-Schlüssel: bisherige Datei nicht als .alt gesichert:', e.message); }
  const k = crypto.randomBytes(32).toString('hex');
  schreiben(k); nutzen(k);
  if (altId) {
    setSetting('pin_pfeffer_verloren', altId);
    audit('system', 'PINs nach Wiederherstellung ungültig', 'Schlüssel der PINs fehlt (Datensicherung auf neuem Gerät ohne Tresor) – PINs müssen neu gesetzt werden');
    try { require('./security').securityAlert('pin.pfeffer', 'Nach einer Wiederherstellung fehlt der Schlüssel der PINs (der Tresor war aus, deshalb gibt es keine Kopie). Die bisherigen PINs gelten nicht mehr: Mitglieder-PINs in der Verwaltung zurücksetzen (das Mitglied legt am Tablet eine neue fest), für die Mitglieder-App einen neuen QR-Code erzeugen, PINs von Mannschaften, Zeiterfassung und Beregnung neu vergeben.'); } catch (e) { console.error('PIN-Pfeffer:', e.message); }
  }
}

let stuendlich = null;
function start() {
  if (!stuendlich) stuendlich = setInterval(() => { if (zustand === 'ok') kopieSichern(); }, 3600000).unref();   // Tresor später ein-/ausgeschaltet
  const id = getSetting('pin_pfeffer_id', ''), k = lesen();
  if (k && (!id || kennung(k) === id)) return nutzen(k);
  if (!id) { const n = crypto.randomBytes(32).toString('hex'); schreiben(n); return nutzen(n); }
  // Die Datenbank wurde mit einem anderen Pfeffer geschrieben (Wiederherstellung) oder die Datei fehlt
  KEY = null; ID = id; zustand = 'wartet';
  const r = ausKopie(id);
  if (r === 'gesperrt') {
    console.log('PINs warten auf das Entsperren des Tresors (Schlüssel der PINs kommt aus der Kopie im Tresor).');
    vault().onUnlock(() => { if (zustand === 'wartet' && ausKopie(ID) !== true) neuBeginnen(ID); });
    return;
  }
  if (r !== true) neuBeginnen(id);
}
const laden = () => { if (zustand === null) start(); };

/** Kennung des aktuellen Pfeffers, wenn er bereit ist (sonst null – dann speichert hashPin vorerst ohne) */
function bereit() { laden(); if (zustand === 'ok') { kopieSichern(); return ID; } return null; }

const fehler = (msg, status) => Object.assign(new Error(msg), { status, cwMeldung: true, pinPfeffer: true });
/** HMAC(Pfeffer, PIN) für die Kennung aus dem gespeicherten Hash */
function mix(id, pin) {
  laden();
  if (zustand === 'ok' && id === ID) return crypto.createHmac('sha256', Buffer.from(KEY, 'hex')).update(String(pin)).digest('hex');
  if (zustand === 'wartet' && id === ID) throw fehler('Die PINs sind nach einer Wiederherstellung noch gesperrt – bitte einmal als Admin in der Verwaltung anmelden.', 423);
  throw fehler('Diese PIN gilt nach einer Wiederherstellung nicht mehr – bitte beim Vorstand eine neue PIN setzen lassen.', 409);
}

/** für die Übersicht und Tests: { zustand, kopie } – nie der Pfeffer selbst */
function status() { laden(); return { zustand, kopie: Boolean(getSetting('pin_pfeffer_kopie', '')), verloren: Boolean(getSetting('pin_pfeffer_verloren', '')) }; }

module.exports = { start, bereit, mix, status };
