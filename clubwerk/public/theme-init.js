/* Vor dem ersten Zeichnen: Hell/Dunkel setzen (kein Aufblitzen) und die Sprache laden. Beide Wahlen liegen nur in diesem Browser. */
(function () {
  var t = null;
  try { t = localStorage.getItem('cw_theme'); } catch (e) { t = null; }
  if (t !== 'dark' && t !== 'light') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  // Sprache: eigene Wahl in diesem Browser, sonst die Vereinssprache (Mitglieder-App: sonst die Sprache des Handys, falls vorhanden)
  var l = null;
  try { l = localStorage.getItem('cw_lang'); } catch (e) { l = null; }
  var me = document.currentScript, base = me && me.src ? me.src.replace(/[^\/]*(\?.*)?$/, '') : '';
  var q = 'l=' + encodeURIComponent(l || 'auto');
  if (!l && document.documentElement.getAttribute('data-lang-auto') === 'browser') q += '&b=' + encodeURIComponent(((navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).join(',')).slice(0, 200));
  document.write('<script src="' + base + 'i18n.js?' + q + '"><\/script>');
})();
