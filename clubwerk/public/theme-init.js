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
