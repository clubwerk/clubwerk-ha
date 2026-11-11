'use strict';
/* Hinweisseite „Keine Verbindung“ (offline.html): erneut versuchen auf Knopfdruck und von selbst, sobald das Handy wieder Netz meldet.
   Die Übersetzung steht hier, weil das Sprachpaket der App nicht im Zwischenspeicher liegt (Sprache wie in der App: Wahl, sonst Handy). */
(function () {
  var wahl = ''; try { wahl = localStorage.getItem('cw_lang') || ''; } catch (e) { /* privat */ }
  var en = (wahl || navigator.language || 'de').slice(0, 2).toLowerCase() !== 'de';
  var T = en ? { t: 'No connection', d: 'The club cannot be reached right now. Check Wi-Fi or mobile data and then try again.', b: 'Try again', s: 'Trying …', n: 'Still no connection.' }
    : { t: 'Keine Verbindung', d: 'Der Verein ist gerade nicht erreichbar. Prüfe WLAN oder mobile Daten und versuche es dann noch einmal.', b: 'Erneut versuchen', s: 'Wird versucht …', n: 'Noch keine Verbindung.' };
  var $ = function (id) { return document.getElementById(id); };
  document.documentElement.lang = en ? 'en' : 'de';
  document.title = T.t; $('offT').textContent = T.t; $('offD').textContent = T.d; $('offRetry').textContent = T.b;
  var laeuft = false, pause = 3000, zeit = null;
  // Antwortet der Verein (noch) nicht – etwa gleich nach „online“, während eines Neustarts oder wenn der Browser sein Netz falsch meldet
  // (navigator.onLine ist nicht verlässlich) –, von selbst wieder nachfragen: nach 3, 6, 12, 24 s, dann alle 30 s. Je eine kleine
  // HEAD-Anfrage an die eigene Adresse; ohne Netz scheitert sie sofort, ohne Datenverkehr.
  var spaeter = function () { clearTimeout(zeit); zeit = setTimeout(nochmal, pause); pause = Math.min(pause * 2, 30000); };
  var nochmal = function () {
    if (laeuft) return; laeuft = true; clearTimeout(zeit); $('offRetry').textContent = T.s; $('offRetry').disabled = true;
    // erst leise prüfen, dann neu laden – so bleibt die Seite stehen, solange der Verein nicht antwortet
    fetch(location.href, { cache: 'no-store', method: 'HEAD' }).then(function (r) {
      if (r.ok || r.status < 500) { location.reload(); return; }
      throw new Error(String(r.status));
    }).catch(function () { laeuft = false; $('offRetry').disabled = false; $('offRetry').textContent = T.b; $('offD').textContent = T.n + ' ' + T.d; spaeter(); });
  };
  $('offRetry').addEventListener('click', nochmal);
  window.addEventListener('online', function () { pause = 3000; nochmal(); });
  spaeter();
})();
