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
  /** Gar nicht anfassen (Skripte, Eingabefelder, Bearbeitbares) – anders als translate="no", wo nur Zahl und Einheit zusammengehalten werden */
  function hard(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) if (SKIP[e.nodeName] || e.isContentEditable) return true;
    return false;
  }
  /** Fest „deutsch“ geschriebene Daten, Beträge und Dezimalzahlen im Format der Sprache (31.12.2026 → 31/12/2026, 15,00 € → €15.00, 1,5 h → 1.5 h).
   *  Wirkt auf jeden angezeigten Text, auch aus dem Server (Meldungen, Protokoll); nicht in Namen und eigenen Texten (translate="no"). Deutsch bleibt unberührt. */
  var eur = null;
  function fmt(s) {
    if (!state.dict || /^de/i.test(state.locale) || !/\d/.test(s)) return s;
    if (/\d\.\d{1,2}\.\d{4}/.test(s)) s = s.replace(/(^|[^\d.])(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/g, function (m, pre, d, mo, y) {
      return +mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31 ? pre + new Date(+y, mo - 1, +d, 12).toLocaleDateString(state.locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : m;
    });
    if (s.indexOf('€') >= 0) {
      if (!eur) eur = new Intl.NumberFormat(state.locale, { style: 'currency', currency: 'EUR' });
      s = s.replace(/(-?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s?€/g, function (m, neg, i, f) { return eur.format(+((neg ? '-' : '') + i.replace(/\./g, '') + '.' + (f || '0'))); });
    }
    return s.replace(/(\d),(\d{1,2})(?=\s?(?:h|%|km)(?![A-Za-zÄÖÜäöüß]))/g, '$1.$2');
  }
  /** Zahl und Einheit bleiben zusammen: „18:55 Uhr“, „129 von 155 h“, „30 Tage“ brechen nie so um, dass die Einheit allein in der nächsten Zeile steht
   *  (geschütztes Leerzeichen, alle Sprachen, Fund 09.11.2026 – Prüfstand-Regel einheit-allein) */
  var UNIT = /(\d) (?=(?:€|%|h|Uhr|Std\.?|Min\.?|min|km|kg|Jahre|Tage)(?![A-Za-zÄÖÜäöüß\d]))/g;
  function units(s) { return s.indexOf(' ') >= 0 && /\d /.test(s) ? s.replace(UNIT, '$1\u00a0') : s; }
  function doText(n) {
    var v = n.nodeValue;
    if (!v || written.get(n) === v) return;
    var t = units(fmt(tr(v)));
    if (t !== v) { written.set(n, t); n.nodeValue = t; } else written.set(n, v);
  }
  /** Namen und eigene Texte des Vereins (translate="no"): nicht übersetzen, aber Zahl und Einheit zusammenhalten („ab 27 Jahre“, „15 € je Stunde“) */
  function doUnits(n) { var v = n.nodeValue, t = v && units(v); if (t && t !== v) n.nodeValue = t; }
  function unitsIn(root) {
    var w = document.createTreeWalker(root, 5, { acceptNode: function (n) { return n.nodeType === 1 && (SKIP[n.nodeName] || n.isContentEditable) ? 2 : 1; } }), n;
    while ((n = w.nextNode())) if (n.nodeType === 3) doUnits(n);
  }
  function text(n) { var p = n.parentNode; if (!blocked(p)) doText(n); else if (!hard(p)) doUnits(n); }
  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (v && written.get(el) !== a + v) { var t = fmt(tr(v)); if (t !== v) { el.setAttribute(a, t); } }
    }
    if (el.nodeName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value) { var tv = tr(el.value); if (tv !== el.value) el.value = tv; }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { text(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && blocked(root)) { if (!hard(root)) unitsIn(root); return; }
    if (root.nodeType === 1) doAttrs(root);
    var nt = [];
    var w = document.createTreeWalker(root, 5 /* ELEMENT | TEXT */, {
      acceptNode: function (n) {
        if (n.nodeType !== 1) return 1;
        if (SKIP[n.nodeName]) return 2; /* REJECT */
        if (n.getAttribute('translate') === 'no' || (n.classList && n.classList.contains('notranslate'))) { nt.push(n); return 2; }
        return 1;
      }
    });
    var n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
    for (var i = 0; i < nt.length; i++) if (!nt[i].isContentEditable) unitsIn(nt[i]);
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
    if (!state.dict) { watch(); return; }   // Deutsch: nur Zahl und Einheit zusammenhalten (units), sonst nichts zu tun
    // Zahlen und Datumsangaben im Format der Sprache (der Code fragt überall „de-DE“ an)
    var loc = state.locale;
    var swap = function (l) { return (l === 'de-DE' || l === 'de') ? loc : l; };
    ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].forEach(function (fn) {
      var o = Date.prototype[fn]; Date.prototype[fn] = function (l, opt) { return o.call(this, swap(l), opt); };
    });
    ['NumberFormat', 'DateTimeFormat'].forEach(function (n) {   // auch `new Intl.NumberFormat('de-DE', …)` (einmal angelegte Formatierer)
      var O = Intl[n]; var W = function (l, opt) { return new O(swap(l), opt); }; W.prototype = O.prototype; W.supportedLocalesOf = O.supportedLocalesOf; Intl[n] = W;
    });
    var on = Number.prototype.toLocaleString; Number.prototype.toLocaleString = function (l, opt) { return on.call(this, swap(l), opt); };
    var oa = window.alert, oc = window.confirm, op = window.prompt;
    window.alert = function (m) { return oa.call(window, tr(String(m))); };
    window.confirm = function (m) { return oc.call(window, tr(String(m))); };
    window.prompt = function (m, d) { return op.call(window, tr(String(m)), d); };
    watch();
  }
  function watch() {
    walk(document.documentElement);
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.type === 'childList') { for (var j = 0; j < r.addedNodes.length; j++) { var a = r.addedNodes[j]; if (a.nodeType === 3) text(a); else if (a.nodeType === 1) { var pa = a.parentNode && a.parentNode.nodeType === 1 ? a.parentNode : null; if (!blocked(pa)) walk(a); else if (!hard(pa)) unitsIn(a); } } }
        else if (r.type === 'characterData') text(r.target);
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
