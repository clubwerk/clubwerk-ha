'use strict';
/**
 * Test-Uhr (nur für Testläufe, in einer Installation nie gesetzt – ohne die Umgebungsvariablen hat diese Datei keine Wirkung).
 *  CW_TEST_UHR = "JJJJ-MM-TT HH:MM|<echte Zeit in ms>": Ab diesem Zeitpunkt zeigt die Uhr des Prozesses die angegebene lokale Zeit und läuft von dort
 *    weiter (auch über einen Neustart, weil die echte Startzeit in der Variable steht).
 *  CW_TEST_UHR_STELLBAR=1: echte Zeit, aber der Server nimmt `POST /api/test/uhr/vor {ms}` an und springt vorwärts – so müssen Tests
 *    Wartezeiten wie „Ratenbegrenzung je Minute“ nicht mehr absitzen (src/server.js, nur wenn diese Variable gesetzt ist).
 * Wirkt auf `new Date()` ohne Argumente und `Date.now()`, also auf jedes Modul, ohne dass es etwas ändern muss; neuer Code fragt trotzdem über
 * `util.jetzt()`/`util.today()`. Nicht erfasst: SQLites datetime('now') und Zeitgeber (setTimeout).
 * Server (src/server.js) und Testreihen (`require('<App>/src/testuhr')`) laden sie, damit beide dieselbe Zeit sehen.
 */
const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})\|(\d+)$/.exec(process.env.CW_TEST_UHR || '');
const stellbar = process.env.CW_TEST_UHR_STELLBAR === '1';
if ((m || stellbar) && !global.__cwTestUhr) {
  const RD = Date;
  const st = { off: m ? new RD(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() - Number(m[6]) : 0 };
  global.__cwTestUhr = st;
  global.Date = new Proxy(RD, {
    construct: (t, a, nt) => Reflect.construct(t, a.length ? a : [RD.now() + st.off], nt),
    apply: () => new RD(RD.now() + st.off).toString(),
    get: (t, k) => (k === 'now' ? () => RD.now() + st.off : Reflect.get(t, k)),
  });
}
const vor = ms => { if (global.__cwTestUhr) global.__cwTestUhr.off += Math.max(0, Math.min(Number(ms) || 0, 86400000)); return Date.now(); };
module.exports = { aktiv: !!global.__cwTestUhr, stellbar, vor };
