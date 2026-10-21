/* Hell/Dunkel vor dem ersten Zeichnen setzen (kein Aufblitzen). Wahl liegt nur in diesem Browser. */
(function () {
  var t = null;
  try { t = localStorage.getItem('vh_theme'); } catch (e) { t = null; }
  if (t !== 'dark' && t !== 'light') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
})();
