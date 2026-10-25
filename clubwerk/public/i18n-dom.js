/* Clubwerk – Übersetzung der Oberfläche im Browser
 * Übersetzt alle sichtbaren Texte (auch später eingefügte) anhand der Sprachdatei. Bereiche mit translate="no" oder
 * class="notranslate" (Namen, Artikel, eigene Texte des Vereins) bleiben unverändert.
 * Für Programmcode: T('Text {0}', [wert]) bzw. T('Text {name}', { name }) und CWI18N.lang / CWI18N.setLang(code). */
(function () {
  'use strict';
  var Core = window.CWCore;
  var state = { lang: 'de', locale: 'de-DE', dir: 'ltr', dict: null, langs: [], club: 'de' };
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, svg: 1, SVG: 1, TEMPLATE: 1 };
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-tip', 'data-label'];
  var written = new WeakMap();

  function T(text, vars) {
    if (vars && Array.isArray(vars)) { var o = {}; for (var i = 0; i < vars.length; i++) o[i] = vars[i]; vars = o; }
    var src = String(text == null ? '' : text);
    var hit = state.dict ? state.dict.exact.get(Core.norm(src)) : undefined;
    return Core.fill(hit !== undefined ? hit : src, vars);
  }
  function tr(s) { return state.dict ? Core.translate(state.dict, s) : s; }
  /** Deutscher Originaltext zu einem (übersetzten) Text – für Code, der angezeigte Texte auswertet */
  var rev = null;
  function orig(s) {
    var t = Core.norm(s || '');
    if (!state.dict) return t;
    if (!rev) { rev = new Map(); state.dict.exact.forEach(function (v, k) { var n = Core.norm(v); if (!rev.has(n)) rev.set(n, k); }); }
    return rev.get(t) || t;
  }

  function blocked(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (SKIP[e.nodeName] || e.getAttribute('translate') === 'no' || (e.classList && e.classList.contains('notranslate')) || e.isContentEditable) return true;
    }
    return false;
  }
  function doText(n) {
    var v = n.nodeValue;
    if (!v || written.get(n) === v) return;
    var t = tr(v);
    if (t !== v) { written.set(n, t); n.nodeValue = t; } else written.set(n, v);
  }
  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (v && written.get(el) !== a + v) { var t = tr(v); if (t !== v) { el.setAttribute(a, t); } }
    }
    if (el.nodeName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value) { var tv = tr(el.value); if (tv !== el.value) el.value = tv; }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!blocked(root.parentNode)) doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && blocked(root)) return;
    if (root.nodeType === 1) doAttrs(root);
    var w = document.createTreeWalker(root, 5 /* ELEMENT | TEXT */, {
      acceptNode: function (n) {
        if (n.nodeType === 1) return (SKIP[n.nodeName] || n.getAttribute('translate') === 'no' || (n.classList && n.classList.contains('notranslate'))) ? 2 /* REJECT */ : 1;
        return 1;
      }
    });
    var n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }

  function start(cfg) {
    state.lang = cfg.lang || 'de'; state.locale = cfg.locale || state.lang; state.dir = cfg.dir || 'ltr';
    state.langs = cfg.langs || []; state.club = cfg.club || 'de';
    state.dict = cfg.strings && Object.keys(cfg.strings).length ? Core.compile(cfg.strings) : null;
    var html = document.documentElement;
    html.setAttribute('lang', state.lang); if (state.dir === 'rtl') html.setAttribute('dir', 'rtl');
    try { document.cookie = 'cw_lang=' + encodeURIComponent(state.lang) + ';path=/;max-age=31536000;SameSite=Lax'; } catch (e) { /* egal */ }
    // Anfragen an den eigenen Server tragen die Sprache mit (Fehlermeldungen, Exporte)
    if (window.fetch && !window.fetch.__cw) {
      var of = window.fetch;
      var nf = function (input, init) {
        try {
          var url = typeof input === 'string' ? input : (input && input.url) || '';
          if (!/^[a-z]+:\/\//i.test(url) || url.indexOf(location.origin) === 0) {
            init = init || {};
            var h = init.headers;
            if (h && typeof Headers !== 'undefined' && h instanceof Headers) h.set('X-Lang', state.lang);
            else if (Array.isArray(h)) h.push(['X-Lang', state.lang]);
            else { var c = {}; if (h) for (var k in h) c[k] = h[k]; c['X-Lang'] = state.lang; init.headers = c; }
          }
        } catch (e) { /* Anfrage trotzdem senden */ }
        return of.call(this, input, init);
      };
      nf.__cw = true; window.fetch = nf;
    }
    if (!state.dict) return;
    // Zahlen und Datumsangaben im Format der Sprache (der Code fragt überall „de-DE“ an)
    var loc = state.locale;
    var swap = function (l) { return (l === 'de-DE' || l === 'de') ? loc : l; };
    ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].forEach(function (fn) {
      var o = Date.prototype[fn]; Date.prototype[fn] = function (l, opt) { return o.call(this, swap(l), opt); };
    });
    var on = Number.prototype.toLocaleString; Number.prototype.toLocaleString = function (l, opt) { return on.call(this, swap(l), opt); };
    var oa = window.alert, oc = window.confirm, op = window.prompt;
    window.alert = function (m) { return oa.call(window, tr(String(m))); };
    window.confirm = function (m) { return oc.call(window, tr(String(m))); };
    window.prompt = function (m, d) { return op.call(window, tr(String(m)), d); };
    walk(document.documentElement);
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.type === 'childList') { for (var j = 0; j < r.addedNodes.length; j++) { var a = r.addedNodes[j]; if (a.nodeType === 3) { if (!blocked(a.parentNode)) doText(a); } else if (a.nodeType === 1 && !blocked(a.parentNode && a.parentNode.nodeType === 1 ? a.parentNode : null)) walk(a); } }
        else if (r.type === 'characterData') { if (!blocked(r.target.parentNode)) doText(r.target); }
        else if (r.type === 'attributes') { if (!blocked(r.target)) doAttrs(r.target); }
      }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  /** Sprache für diesen Browser wählen ('' = Vereinssprache) und Seite neu laden */
  function setLang(code) {
    try { if (code) localStorage.setItem('cw_lang', code); else localStorage.removeItem('cw_lang'); } catch (e) { /* egal */ }
    location.reload();
  }
  function chosen() { try { return localStorage.getItem('cw_lang') || ''; } catch (e) { return ''; } }

  window.T = T;
  window.CWI18N = {
    start: start, T: T, tr: tr, orig: orig, setLang: setLang, chosen: chosen, walk: walk,
    get lang() { return state.lang; }, get locale() { return state.locale; }, get langs() { return state.langs; }, get club() { return state.club; }
  };
})();
