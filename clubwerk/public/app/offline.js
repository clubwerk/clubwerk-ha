'use strict';
/* Hinweisseite „Keine Verbindung“ (offline.html): erneut versuchen auf Knopfdruck und von selbst, sobald das Handy wieder Netz meldet –
   und den Mitgliedsausweis zeigen, wenn die App einen gespeichert hat (ausweis.js).
   Die Übersetzung steht hier, weil das Sprachpaket der App nicht im Zwischenspeicher liegt (Sprache wie in der App: Wahl, sonst Handy). */
(function () {
  var wahl = ''; try { wahl = localStorage.getItem('cw_lang') || ''; } catch (e) { /* privat */ }
  var en = (wahl || navigator.language || 'de').slice(0, 2).toLowerCase() !== 'de';
  var T = en ? { t: 'No connection', d: 'The club cannot be reached right now. Check Wi-Fi or mobile data and then try again.', b: 'Try again', s: 'Trying …', n: 'Still no connection.', c: 'Show membership card', h: 'Hide membership card' }
    : { t: 'Keine Verbindung', d: 'Der Verein ist gerade nicht erreichbar. Prüfe WLAN oder mobile Daten und versuche es dann noch einmal.', b: 'Erneut versuchen', s: 'Wird versucht …', n: 'Noch keine Verbindung.', c: 'Mitgliedsausweis zeigen', h: 'Mitgliedsausweis ausblenden' };
  // Texte der Karte (ausweis.js) – das Sprachpaket der App liegt nicht im Zwischenspeicher
  var KARTE = { 'Nr.': 'No.', 'Mitglied seit {0}': 'Member since {0}', Mitgliedsausweis: 'Membership card', Foto: 'Photo', Status: 'Status', 'Gültig bis': 'Valid until', Live: 'Live',
    'Code abgelaufen': 'Code expired', 'Öffne die App mit Netz, dann kommt ein neuer Code.': 'Open the app with a connection to get a new code.', 'QR-Code des Mitgliedsausweises': 'QR code of the membership card',
    Aktiv: 'Active', Passiv: 'Passive', Ehrenmitglied: 'Honorary member', Ruhend: 'Dormant' };
  var tk = function (x) { return en && KARTE[x] ? KARTE[x] : x; };
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
  // Mitgliedsausweis aus dem Speicher der App: Knopf nur, wenn einer gespeichert ist; die Uhr läuft nur, solange er zu sehen ist
  $('offCard').textContent = T.c;
  var karte = null, stopp = null;
  if (window.CWAusweis) window.CWAusweis.load().then(function (c) { karte = c; if (c) $('offCard').classList.remove('hidden'); });
  $('offCard').addEventListener('click', function () {
    var box = $('offCardBox'), zu = !box.classList.contains('hidden');
    if (stopp) { stopp(); stopp = null; }
    if (zu || !karte) { box.classList.add('hidden'); box.innerHTML = ''; $('offCard').textContent = T.c; return; }
    box.innerHTML = window.CWAusweis.html(karte, tk); box.classList.remove('hidden'); $('offCard').textContent = T.h;
    stopp = window.CWAusweis.clock(box);
  });
  window.addEventListener('online', function () { pause = 3000; nochmal(); });
  spaeter();
})();
