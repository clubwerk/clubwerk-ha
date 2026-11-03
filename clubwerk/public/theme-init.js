/* Vor dem ersten Zeichnen: Darstellung setzen (kein Aufblitzen) und die Sprache laden. Beide Wahlen liegen nur in diesem Browser.
   Darstellung (cw_theme): 'light', 'dark', 'hc' (Hoher Kontrast) oder nichts = wie das Gerät (hell/dunkel, „Mehr Kontrast“ → Hoher Kontrast).
   Ergebnis: <html data-theme="light|dark"> und bei Hohem Kontrast zusätzlich data-contrast="hoch".
   Am Tablet kann der Verein die Darstellung festlegen (nav.js → CWTheme.tablet); eingebettete Seiten übernehmen sie vom Rahmen. */
(function () {
  var root = document.documentElement;
  var mq = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
  var mine = function () { var t = null; try { t = localStorage.getItem('cw_theme'); } catch (e) { t = null; } return t === 'light' || t === 'dark' || t === 'hc' ? t : 'auto'; };
  var apply = function (t) {
    var dark = t === 'dark' || (t === 'auto' && mq('(prefers-color-scheme: dark)'));
    var hc = t === 'hc' || (t === 'auto' && mq('(prefers-contrast: more)'));
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (hc) root.setAttribute('data-contrast', 'hoch'); else root.removeAttribute('data-contrast');
  };
  var parentTk = function () { try { return window.top !== window && window.parent.document.documentElement.getAttribute('data-tk-theme'); } catch (e) { return null; } };
  var now = function () { return root.getAttribute('data-tk-theme') || parentTk() || mine(); };
  apply(now());
  // „wie das Gerät“: Wechsel am Gerät (z. B. abends dunkel) sofort übernehmen
  if (window.matchMedia) ['(prefers-color-scheme: dark)', '(prefers-contrast: more)'].forEach(function (q) { var m = matchMedia(q); var f = function () { apply(now()); }; if (m.addEventListener) m.addEventListener('change', f); else if (m.addListener) m.addListener(f); });
  window.CWTheme = {
    choice: mine,
    set: function (t) { try { if (t === 'auto') localStorage.removeItem('cw_theme'); else localStorage.setItem('cw_theme', t); } catch (e) { /* privat */ } apply(now()); },
    tablet: function (t) { if (t && t !== 'auto') root.setAttribute('data-tk-theme', t); else root.removeAttribute('data-tk-theme'); apply(now()); },
  };
  // Sprache: eigene Wahl in diesem Browser, sonst die Vereinssprache (Mitglieder-App: sonst die Sprache des Handys, falls vorhanden)
  var l = null;
  try { l = localStorage.getItem('cw_lang'); } catch (e) { l = null; }
  var me = document.currentScript, base = me && me.src ? me.src.replace(/[^\/]*(\?.*)?$/, '') : '';
  var q = 'l=' + encodeURIComponent(l || 'auto');
  if (!l && root.getAttribute('data-lang-auto') === 'browser') q += '&b=' + encodeURIComponent(((navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).join(',')).slice(0, 200));
  document.write('<script src="' + base + 'i18n.js?' + q + '"><\/script>');
})();
/* iPhone/iPad: Cursor in Fenstern an der richtigen Stelle. Liegt ein Eingabefeld in einem festen Fenster (position: fixed – .overlay,
   .vh-sheet, Menüs) und ist die Seite dahinter weit gescrollt, zeichnet Safari beim Aufklappen der Tastatur den blinkenden Cursor
   versetzt, oft deutlich unter dem Feld (WebKit-Fehler 300690/300952, iOS 26; ähnlich schon 176896, iOS 11 – Ursache ist immer der
   Scrollstand der Seite hinter dem festen Fenster). Solange ein solches Feld den Fokus hat, steht die Seite deshalb mit Scrollstand 0
   still (body fest, um den alten Stand nach oben verschoben – sie sieht unverändert aus); danach geht es an derselben Stelle weiter.
   Nur auf Touch-Geräten und nur während der Eingabe – das Öffnen und Schließen der Fenster bleibt ohne Neuzeichnen (style.css). */
(function () {
  if (!window.matchMedia || !matchMedia('(pointer: coarse)').matches) return;
  var y = null;
  var feld = function (e) { return !!e && (e.isContentEditable || e.tagName === 'TEXTAREA' || (e.tagName === 'INPUT' && !/^(checkbox|radio|range|color|file|button|submit|reset|image|hidden|date|time|datetime-local|month|week)$/.test(e.type))); };
  var imFenster = function (e) { for (; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
  var los = function () { if (y === null) return; var s = document.body.style, z = y; y = null; s.position = s.top = s.left = s.right = ''; window.scrollTo(0, z); };
  var noch = function () { if (y === null) return; var a = document.activeElement; if (feld(a) && imFenster(a)) setTimeout(noch, 250); else los(); };   // auch wenn das Fenster samt Feld entfernt wird (kein focusout); Datum/Uhrzeit öffnen eine Auswahl, keine Tastatur
  document.addEventListener('focusin', function (ev) {
    var a = ev.target, sy = window.scrollY;
    if (y !== null || sy < 1 || !document.body || !feld(a) || !imFenster(a)) return;
    var s = document.body.style; y = sy; s.position = 'fixed'; s.top = -sy + 'px'; s.left = s.right = '0';
    setTimeout(noch, 250);
  }, true);
})();
