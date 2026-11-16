'use strict';
/**
 * Lebenszeichen, Abstürze und Notfall beim Start.
 *  – Merker `.clubwerk-laeuft` im Datenordner: liegt er beim Start noch da, wurde Clubwerk nicht geordnet beendet (Stromausfall,
 *    Speicher voll, Hänger, Programmfehler). Dann wird der Absturz gezählt und die Datenbank vor dem Öffnen kurz geprüft (src/db.js).
 *  – Hänger: Ein Wächter-Thread prüft das Lebenszeichen der Ereignisschleife. Bleibt es länger als CW_HAENGER_S Sekunden (Vorgabe 90) aus,
 *    beendet er den Prozess hart; Home Assistant startet das Add-on neu (Watchdog). Die Datenbank verträgt das (WAL, synchronous = FULL).
 *    Der TCP-Watchdog von Home Assistant merkt einen Hänger nicht: Der Port nimmt weiter Verbindungen an.
 *  – Unerwarteter Programmfehler (uncaughtException): danach ist der Zustand des Prozesses ungewiss – geordnet beenden (Datenbank schließen),
 *    Home Assistant startet neu. Vor dem fertigen Start bei kaputter Datenbank oder vollem Speicher stattdessen Notfallmodus (src/notfall.js).
 *  – Häufige Abstürze (3 in 24 Stunden) meldet der Server nach dem Start als Sicherheitswarnung (abstuerzeMelden).
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const MARK = path.join(DATA_DIR, '.clubwerk-laeuft');
const LOG = path.join(DATA_DIR, 'abstuerze.json');
const HAEUFIG = 3, TAG = 86400000;
const HAENGER_S = Math.max(2, Number(process.env.CW_HAENGER_S) || 90);

let unsauber = false, grund = '', beenden = null, bereit = false, gestartet = false;

const liste = () => { try { const a = JSON.parse(fs.readFileSync(LOG, 'utf8')); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
/** Absturz festhalten (synchron, auch kurz vor dem Ende) */
function merken(why) {
  try {
    const a = liste().filter(x => x && Date.now() - Date.parse(x.at) < 7 * TAG);
    a.push({ at: new Date().toISOString(), why: String(why).slice(0, 200) });
    fs.writeFileSync(LOG, JSON.stringify(a.slice(-50)));
  } catch (e) { /* Speicher voll: nichts zu machen */ }
}
/** Abstürze der letzten 24 Stunden */
const letzte = () => liste().filter(x => x && Date.now() - Date.parse(x.at) < TAG && Date.parse(x.at) <= Date.now());

/** Datenbank oder Speicher kaputt? (dann hilft kein Neustart, sondern nur der Notfallmodus) */
const DB_FEHLER = /^(SQLITE_(CORRUPT|NOTADB|FULL|IOERR|CANTOPEN|READONLY)|ENOSPC|EROFS|EIO)/;
const istDbFehler = e => !!e && (DB_FEHLER.test(String(e.code || '')) || /database disk image is malformed|file is not a database|database or disk is full/i.test(String(e.message || '')));

function start() {
  if (gestartet) return;
  gestartet = true;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(MARK)) {
      unsauber = true;
      let m = {}; try { m = JSON.parse(fs.readFileSync(MARK, 'utf8')) || {}; } catch (e) { m = {}; }
      grund = m.why || 'unerwartet beendet (z. B. Stromausfall oder Speicher voll)';
      merken(grund);
      console.error(`Clubwerk wurde zuletzt nicht geordnet beendet: ${grund}. Die Datenbank wird beim Start geprüft.`);
    }
    fs.writeFileSync(MARK, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  } catch (e) { console.error('Start-Merker:', e.message); }

  process.on('uncaughtException', e => {
    console.error('Unerwarteter Fehler:', e && e.stack ? e.stack : e);
    if (!bereit && istDbFehler(e)) { try { require('./notfall').start(e); return; } catch (e2) { console.error('Notfallmodus:', e2.message); } }
    if (beenden && bereit) { merken(`Programmfehler: ${e && e.message ? e.message : e}`); beenden('unerwarteter Fehler', 1); return; }
    merken(`Fehler beim Start: ${e && e.message ? e.message : e}`);
    try { fs.unlinkSync(MARK); } catch (e2) { /* schon gelöscht */ }   // schon gezählt
    process.exit(1);
  });
  /* Abgelehnte Promises (Mail, Push, Hook ohne await) beenden das Add-on nicht – sonst rissen alle laufenden Anfragen ab. Nur protokollieren. */
  process.on('unhandledRejection', e => { console.error('Fehler im Hintergrund (abgefangen):', e && e.stack ? e.stack : e); });
}

/** Server ist gestartet: ab jetzt geordnet beenden statt Notfallmodus, Wächter gegen Hänger starten */
function gestartetMit(shutdown) {
  beenden = shutdown; bereit = true;
  const { Worker } = require('worker_threads');
  const sab = new SharedArrayBuffer(8), beat = new Int32Array(sab);
  const puls = () => Atomics.store(beat, 0, Math.floor(Date.now() / 1000) | 0);
  puls(); setInterval(puls, 1000).unref();
  const code = `
    const { workerData: w } = require('worker_threads'); const fs = require('fs');
    const beat = new Int32Array(w.sab); let alt = Atomics.load(beat, 0), seit = Date.now();
    setInterval(() => {
      const b = Atomics.load(beat, 0);
      if (b !== alt) { alt = b; seit = Date.now(); return; }
      if (Date.now() - seit < w.s * 1000) return;
      const why = 'hing länger als ' + w.s + ' Sekunden (Ereignisschleife blockiert) und wurde neu gestartet';
      try { fs.writeFileSync(w.mark, JSON.stringify({ why })); } catch (e) {}
      try { fs.writeSync(2, 'Clubwerk ' + why + '.\\n'); } catch (e) {}
      process.kill(w.pid, 'SIGKILL');
    }, Math.min(5000, w.s * 250));`;
  try {
    const wk = new Worker(code, { eval: true, workerData: { sab, s: HAENGER_S, mark: MARK, pid: process.pid } });
    wk.unref(); wk.on('error', e => console.error('Wächter:', e.message));
  } catch (e) { console.error('Wächter gegen Hänger nicht gestartet:', e.message); }
}

/** Geordnet beendet: Merker weg */
function ende() { try { fs.unlinkSync(MARK); } catch (e) { /* schon gelöscht */ } }

/** Nach dem Start: häufige Abstürze als Sicherheitswarnung melden */
function abstuerzeMelden(securityAlert) {
  if (!unsauber) return;
  const l = letzte();
  if (l.length < HAEUFIG) return;
  securityAlert('absturz', `Clubwerk wurde in den letzten 24 Stunden ${l.length}-mal unerwartet beendet. Zuletzt: ${grund}. Bitte das Protokoll des Add-ons in Home Assistant ansehen; oft sind es Stromausfälle, voller Speicher oder zu wenig Arbeitsspeicher.`);
}

module.exports = { start, gestartetMit, ende, abstuerzeMelden, istDbFehler, get unsauber() { return unsauber; }, letzte, MARK, HAENGER_S };

/**
 * Integritätsprüfung der ganzen Datenbank (PRAGMA integrity_check) in einem eigenen Thread mit eigener Lese-Verbindung:
 * auf dem Pi dauert sie bei großen Datenbanken viele Sekunden – die Ereignisschleife (Tablet, App) bleibt frei.
 * → Promise<'ok' | Befund (Text)>
 */
function integritaet(file) {
  const { Worker } = require('worker_threads');
  const code = `
    const { workerData: w, parentPort } = require('worker_threads');
    let d; try { d = new (require(w.mod))(w.file, { readonly: true, fileMustExist: true });
      parentPort.postMessage(d.pragma('integrity_check(20)').map(r => r.integrity_check).join(' · ')); }
    catch (e) { parentPort.postMessage('Prüfung nicht möglich: ' + e.message); } finally { try { d && d.close(); } catch (e) {} }`;
  return new Promise(resolve => {
    let w; try { w = new Worker(code, { eval: true, workerData: { file, mod: require.resolve('better-sqlite3') } }); } catch (e) { resolve('Prüfung nicht möglich: ' + e.message); return; }
    w.once('message', m => resolve(String(m)));
    w.once('error', e => resolve('Prüfung nicht möglich: ' + e.message));
    w.once('exit', () => resolve('Prüfung abgebrochen.'));
  });
}
module.exports.integritaet = integritaet;
