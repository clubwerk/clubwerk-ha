/* Für die Homepage des Vereins: passt die Höhe des Rahmens mit der Buchungsseite an ihren Inhalt an.
   Einbinden (Adresse der Buchungsseite einsetzen):
     <iframe src="https://buchen.dein-verein.de/" title="Platz buchen" allow="payment" style="width:100%;border:0;min-height:600px"></iframe>
     <script src="https://buchen.dein-verein.de/hoehe.js" async></script> */
(function () {
  var s = document.currentScript, quelle = s ? new URL(s.src).origin : '';
  if (!quelle) return;
  window.addEventListener('message', function (e) {
    if (e.origin !== quelle || !e.data || e.data.typ !== 'cw-gb-hoehe') return;
    var h = Math.max(300, Math.min(6000, e.data.h | 0));
    var rahmen = document.getElementsByTagName('iframe');
    for (var i = 0; i < rahmen.length; i++) if (rahmen[i].contentWindow === e.source) rahmen[i].style.height = h + 'px';
  });
})();
