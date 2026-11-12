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
  // Ersatz, falls die Sprachdatei nicht lädt (Netz, Server ausgelastet): Platzhalter füllen, Text bleibt Deutsch – Modul-Skripte rufen T() direkt auf und
  // stürzten sonst ab („T is not defined“, Fund Wackler-Jagd 11.11.2026, Mitglieder-App englisch). i18n.js ersetzt ihn durch die echte Übersetzung.
  if (!window.T) window.T = function (t, v) { if (v && Array.isArray(v)) { var o = {}; for (var i = 0; i < v.length; i++) o[i] = v[i]; v = o; } return String(t == null ? '' : t).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] !== undefined ? v[k] : m; }); };
  document.write('<script src="' + base + 'i18n.js?' + q + '"><\/script>');
})();

/* Planblöcke (Belegungs- und Zeitpläne: .bk-blk, .bkm-blk, .tl-plan .blk): nur ganze Zeilen zeigen. Was nicht mehr ganz in den Block passt, wird ausgeblendet
   statt unten angeschnitten; ein langer Titel endet an einer Zeilengrenze. Kein „…“ – der volle Text steht beim Antippen (02.11.2026, „Julia F.“ halb sichtbar). */
(function () {
  var SEL = '.bk-blk, .bkm-blk, .tl-plan .blk';
  var fit = function (b) {
    var kids = [].slice.call(b.children); if (!kids.length || !b.clientHeight) return;
    kids.forEach(function (k) { k.style.display = ''; k.style.maxHeight = ''; k.style.overflow = ''; k.removeAttribute('data-zeilen'); });
    var cs = getComputedStyle(b), innen = b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), oben = b.getBoundingClientRect().top + b.clientTop + parseFloat(cs.paddingTop);
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect(); if (r.bottom - oben <= innen + 0.5) continue;
      var lh = parseFloat(getComputedStyle(kids[i]).lineHeight) || 15, n = Math.floor((innen - (r.top - oben)) / lh + 0.01);
      if (n >= 1 || i === 0) { kids[i].style.maxHeight = Math.max(1, n) * lh + 'px'; kids[i].style.overflow = 'hidden'; kids[i].setAttribute('data-zeilen', Math.max(1, n)); i++; }
      for (; i < kids.length; i++) kids[i].style.display = 'none';
    }
  };
  var plan = 0, alle = function () { plan = 0; document.querySelectorAll(SEL).forEach(fit); };
  var los = function () { if (!plan) plan = requestAnimationFrame(alle); };
  var start = function () { new MutationObserver(los).observe(document.body, { childList: true, subtree: true }); addEventListener('resize', los); los(); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

/* Barrierefreiheit für Screenreader (WCAG 1.3.1, 4.1.2, 4.1.3; planung/leitfaeden.md) – ändert nichts am Aussehen:
   - Reiter: Knöpfe in einer Reiterleiste ([role=tablist]) sind Reiter (role=tab); der Knopf mit „on“ ist ausgewählt (aria-selected).
     Knöpfe, deren Auswahl ein Modul selbst pflegt (aria-selected von Anfang an gesetzt), bleiben unberührt.
   - Überschriften: Ebenen springen nicht (Seitentitel Ebene 1, Kartenüberschrift h3 → Ebene 2). Nur die angesagte Ebene (aria-level)
     ändert sich, nie das Element oder sein Stil; die erste Überschrift einer Seite bleibt, wie sie ist. */
(function () {
  var vis = function (e) { return !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length); };
  var reiter = function () {
    document.querySelectorAll('[role="tablist"] > button').forEach(function (b) {
      if (!b.hasAttribute('role')) b.setAttribute('role', 'tab');
      if (b.hasAttribute('aria-selected') && !b.hasAttribute('data-cw-sel')) return;
      var s = b.classList.contains('on') ? 'true' : 'false';
      if (b.getAttribute('aria-selected') !== s) { b.setAttribute('aria-selected', s); b.setAttribute('data-cw-sel', ''); }
    });
  };
  var ebenen = function () {
    var prev = 0;
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]').forEach(function (h) {
      var eigen = h.getAttribute('data-cw-ebene'), nat = eigen ? Number(eigen) : Number(h.getAttribute('aria-level')) || Number(h.tagName.slice(1)) || 2;
      if (!vis(h)) return;
      var lv = prev && nat > prev + 1 ? prev + 1 : nat;
      if (lv !== nat) { if (h.getAttribute('aria-level') !== String(lv)) h.setAttribute('aria-level', String(lv)); if (!eigen) h.setAttribute('data-cw-ebene', String(nat)); }
      else if (eigen) { if (/^H[1-6]$/.test(h.tagName) && Number(h.tagName.slice(1)) === nat) h.removeAttribute('aria-level'); else h.setAttribute('aria-level', String(nat)); h.removeAttribute('data-cw-ebene'); }
      prev = lv;
    });
  };
  // Kurzmeldungen („Gespeichert.“, Fehler) werden angesagt, ohne den Fokus zu verschieben (WCAG 4.1.3)
  var meldung = function () { var t = document.getElementById('toast'); if (t && !t.hasAttribute('role')) { t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); } };
  // Fenster und Blätter (Tablet, Mitglieder-App, Module) sind für Screenreader Dialoge mit ihrer Überschrift als Name (WCAG 4.1.2);
  // die Verwaltung setzt das schon im HTML und führt zusätzlich den Fokus (admin.js)
  var fenster = function () {
    document.querySelectorAll('.overlay > .dialog, .vh-sheet > .vh-box').forEach(function (d, i) {
      if (!d.hasAttribute('role')) { d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); }
      if (!vis(d)) return;
      var h = d.querySelector('h1, h2, h3'); if (!h) return;
      if (!h.id) h.id = 'cwDlgT' + i;
      if (d.getAttribute('aria-labelledby') !== h.id) d.setAttribute('aria-labelledby', h.id);
    });
  };
  var plan = 0, alle = function () { plan = 0; meldung(); reiter(); fenster(); ebenen(); };
  var los = function () { if (!plan) plan = requestAnimationFrame(alle); };
  var start = function () { new MutationObserver(los).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] }); los(); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.CWA11y = { jetzt: alle };   // Tests/Prüfstand: sofort anwenden statt aufs nächste Bild zu warten
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

/* Dateiauswahl per Skript (CWPick.file). Das Dateifeld hängt unsichtbar im DOM und wird festgehalten, bis „change“ oder „cancel“ kam.
   Ein losgelöstes <input type=file> (createElement + click, ohne es einzuhängen) verliert in iOS-Safari/WebKit während des langen
   Dateiauswahl-Dialogs sein „change“: das Element wird aufgeräumt, die Auswahl kommt nie an – kein Fehler, keine Meldung (Fehler 07.11.2026,
   Mitglied › Dokumente am iPhone). Darum nie `createElement('input')` mit type=file selbst bauen, immer hier durch (Regel in sicherheit-regeln.js).
   CWPick.file(accept, { multiple, capture }) → Promise<File|null> (mit multiple: Liste); null bzw. [] bei Abbruch. */
(function () {
  var offen = [];   // Verweis, solange der Dialog offen ist
  window.CWPick = {
    file: function (accept, o) {
      o = o || {};
      return new Promise(function (res) {
        var i = document.createElement('input'), fertig = false;
        i.type = 'file'; if (accept) i.accept = accept; if (o.multiple) i.multiple = true; if (o.capture) i.setAttribute('capture', o.capture);
        i.setAttribute('aria-hidden', 'true'); i.tabIndex = -1;
        i.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
        var ende = function () {
          if (fertig) return; fertig = true;
          var l = [].slice.call(i.files || []);
          setTimeout(function () { var k = offen.indexOf(i); if (k >= 0) offen.splice(k, 1); if (i.parentNode) i.parentNode.removeChild(i); }, 0);
          res(o.multiple ? l : (l[0] || null));
        };
        i.addEventListener('change', ende); i.addEventListener('cancel', ende);
        offen.push(i); (document.body || document.documentElement).appendChild(i);
        i.click();
      });
    },
  };
})();

/* Trennpunkt „·“ nie am Zeilenanfang (Regel punkt-zeilenanfang, Fund 09.11.2026: „Kinder und Jugendliche / · 60,00 €“).
   Zentral für alle Oberflächen: Das Leerzeichen vor jedem „·“ in sichtbarem Text wird ein festes (U+00A0), so bricht eine Zeile nur nach
   dem Punkt um – „Name ·“ / „60,00 €“. Gilt für Text, den Seiten später einsetzen (MutationObserver), nie für Eingabefelder, Code oder
   Skripte. Die Übersetzung erkennt den Trenner mit festem Leerzeichen genauso (i18n-core.js). */
(function () {
  var RE = /[ \t\n\r]+·(?=[\s\u00a0]|$)/g, SKIP = /^(SCRIPT|STYLE|TEXTAREA|PRE|CODE|OPTION|TITLE)$/;
  var fix = function (n) {
    var v = n.nodeValue; if (!v || v.indexOf('·') < 0 || !RE.test(v)) return; RE.lastIndex = 0;
    var p = n.parentNode; if (!p || p.nodeType !== 1 || SKIP.test(p.tagName) || p.isContentEditable) return;
    var w = v.replace(RE, ' ·'); if (w !== v) n.nodeValue = w;
  };
  var walk = function (root) {
    if (root.nodeType === 3) { fix(root); return; }
    if (root.nodeType !== 1 || SKIP.test(root.tagName)) return;
    var it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n; while ((n = it.nextNode())) fix(n);
  };
  var start = function () {
    walk(document.body);
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.type === 'characterData') fix(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  // Kopieren: das feste Leerzeichen vor „·“ nie in die Zwischenablage – dort steht wieder ein normales
  document.addEventListener('copy', function (ev) {
    var sel = window.getSelection && window.getSelection(), t = sel ? String(sel) : '';
    if (!t || t.indexOf('\u00a0·') < 0 || !ev.clipboardData) return;
    var a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;   // Eingaben bleiben, wie sie sind
    ev.clipboardData.setData('text/plain', t.replace(/\u00a0·/g, ' ·')); ev.preventDefault();
  });
})();
/* Zähler an Schaltflächen („Anträge 3“, „Gäste-Deckel 1“): der Name nennt die Zahl getrennt („Anträge, 3“) statt „Anträge3“ – für alle Oberflächen (planung/ui-review.md Punkt 14, Regel knopf-name-zaehler) */
(function () {
  var q = 0;
  function run() {
    q = 0;
    var bs = document.querySelectorAll('button:not([aria-label]), a[href]:not([aria-label]), [role=tab]:not([aria-label]), [data-cwc]');
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i], last = b.lastElementChild;
      if (!last || last.children.length || typeof last.className !== 'string' || !/badge|cnt|count|zaehler|num/i.test(last.className) || !/^\d{1,4}$/.test(last.textContent.trim())) continue;
      var n = last.textContent.trim(), all = b.textContent, lab = all.slice(0, all.lastIndexOf(n)).replace(/\s+/g, ' ').trim();
      if (!lab) continue;
      last.setAttribute('aria-hidden', 'true'); b.setAttribute('data-cwc', '1'); b.setAttribute('aria-label', lab + ', ' + n);
    }
  }
  function sched() { if (!q) q = requestAnimationFrame(run); }
  function start() { new MutationObserver(sched).observe(document.documentElement, { childList: true, subtree: true, characterData: true }); sched(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* Hinweis vor einer Zeitgrenze (WCAG 2.2.1 „Zeitbegrenzung anpassbar“, planung/leitfaeden-2.md): Wo am Tablet eine Abmeldung oder ein
   Zurück-zum-Start nach einer Zeit ohne Eingabe Eingaben verwirft, erscheint vorher ein Fenster mit Countdown und einem Knopf zum Bleiben.
   Rolle alertdialog (wird beim Öffnen angesagt), Fokus auf dem Knopf, danach zurück an die vorige Stelle. Jede Eingabe zählt wie der Knopf:
   Die aufrufende Seite misst die Zeit selbst und schließt den Hinweis bei Eingabe (CWZeit.weg), der Knopf ruft zusätzlich o.weiter auf.
   CWZeit.hinweis({ titel, text, knopf, ende: Zeitpunkt in ms, weiter }) · CWZeit.weg() · CWZeit.offen() */
(function () {
  var box = null, iv = null, zurueck = null;
  var weg = function () {
    clearInterval(iv); iv = null; if (!box) return;
    var hatte = box.contains(document.activeElement);
    box.parentNode && box.parentNode.removeChild(box); box = null;
    if (hatte && zurueck && zurueck.isConnected && zurueck.focus) zurueck.focus({ preventScroll: true });
    zurueck = null;
  };
  window.CWZeit = {
    hinweis: function (o) {
      weg();
      zurueck = document.activeElement;
      var rest = function () { return Math.max(0, Math.ceil((o.ende - Date.now()) / 1000)); };
      box = document.createElement('div'); box.className = 'cw-zeit';
      box.innerHTML = '<div class="cw-zeit-k" role="alertdialog" aria-modal="true" aria-labelledby="cwZeitT" aria-describedby="cwZeitD">'
        + '<div class="cw-zeit-n" aria-hidden="true"></div><h2 id="cwZeitT"></h2><p id="cwZeitD"></p><button type="button" class="cw-zeit-b"></button></div>';
      var n = box.querySelector('.cw-zeit-n'), b = box.querySelector('button');
      box.querySelector('h2').textContent = o.titel; box.querySelector('p').textContent = o.text; b.textContent = o.knopf;
      n.textContent = rest();
      b.addEventListener('click', function () { weg(); if (o.weiter) o.weiter(); });
      document.body.appendChild(box);
      b.focus({ preventScroll: true });
      iv = setInterval(function () { if (box) n.textContent = rest(); }, 250);
    },
    weg: weg,
    offen: function () { return Boolean(box); },
  };
})();

/* Überblenden zwischen Seiten (style.css: @view-transition): Wird ein Seitenwechsel abgebrochen (z. B. Tablet kehrt zum Start zurück, während schon neu geladen wird),
   verwirft der Browser die Überblendung und meldet das als unbehandelten Skriptfehler „Transition was skipped“. Das ist gewollt – hier auffangen (Fund Wackler-Jagd 11.11.2026, Testreihe zeithin). */
(function () {
  var still = function (e) { var t = e.viewTransition; if (t) ['ready', 'finished', 'updateCallbackDone'].forEach(function (k) { if (t[k] && t[k].catch) t[k].catch(function () {}); }); };
  window.addEventListener('pageswap', still); window.addEventListener('pagereveal', still);
})();

/* Verwaltung im Tablet-Rahmen (verwaltung.html bettet …/tadmin/admin.html ein; der Prüfstand setzt window.__cwTabRahmen): <html class="tabrahmen">.
   Dort gilt die Tablet-Form der Verwaltung (Listen statt Tabellen) bis 1399 px Breite statt nur bis 1279 px – echte Tablets haben 1024, 1180, 1280
   oder 1366 px – und die Vereinskarte der Seitenleiste entfällt (die Tablet-Kopfzeile zeigt den Verein schon; planung/tablet-aufraeumen.md). */
(function () {
  if (!(/\/tadmin\//.test(location.pathname) || window.__cwTabRahmen)) return;
  document.documentElement.classList.add('tabrahmen');
  var weiter = function (rs) {
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      if (r.media && /^\(min-width:\s*701px\)\s*and\s*\(max-width:\s*1279px\)$/.test(r.media.mediaText)) r.media.mediaText = '(min-width: 701px) and (max-width: 1399px)';
      else if (r.cssRules && !r.media) weiter(r.cssRules);
    }
  };
  var alle = function () { [].forEach.call(document.styleSheets, function (b) { try { weiter(b.cssRules); } catch (e) { /* fremde Datei */ } }); };
  document.addEventListener('DOMContentLoaded', alle);
  // Module hängen ihr Stylesheet erst beim ersten Öffnen ihrer Seite an: auch das bekommt die weitere Tablet-Form
  new MutationObserver(function (ms) { ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.tagName === 'STYLE' && n.sheet) { try { weiter(n.sheet.cssRules); } catch (e) { /* leer */ } } }); }); }).observe(document.documentElement, { childList: true, subtree: true });
})();

/* Zoom-Sperre für Tablet-Seiten (Baustein CWZoom; Wunsch 11.11.2026: „Auf dem Tablet sollte man nirgends zoomen können, nur in der Verwaltung“;
   WCAG 1.4.4 bewusst zugunsten des gemeinsamen Theken-Tablets abgewogen, planung/tablet-aufraeumen.md). nav.js ruft CWZoom.sperren() auf allen Tablet-Seiten auf
   (außer der Verwaltung), Tablet › Beregnung selbst. Viewport ohne Zoom, dazu Abfangen der Pinch-Gesten (iPad-Safari ignoriert user-scalable=no) und kein
   Doppeltipp-Zoom (touch-action; touchend wird bewusst nicht abgefangen, das schluckte schnelle Doppeltipps auf Knöpfen). */
(function () {
  window.CWZoom = {
    sperren: function () {
      var vp = document.querySelector('meta[name="viewport"]');
      if (vp) vp.setAttribute('content', vp.getAttribute('content').replace(/,?\s*(maximum-scale|minimum-scale|user-scalable)\s*=\s*[^,]*/g, '') + [',', 'maximum-scale=1,', 'user-scalable=no'].join(' '));
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
      document.documentElement.style.touchAction = 'manipulation';
    },
  };
})();

/* Blätter (.vh-sheet: Tablet-Seiten der Module, Mitglieder-App, Beregnungs-Webapp) blenden weich ein und aus wie die Fenster (.overlay).
   Ausblenden: Das Blatt ist sofort zu (ein Tipp trifft nie eine verblassende Ebene), nur die Abdunklung klingt kurz nach
   (Aussehen in kit.css, .cw-blatt-aus). Egal, wie die Seite das Blatt schließt (Klasse „show“ entfällt). */
(function () {
  var start = function () {
    var glow = document.createElement('div'); glow.className = 'cw-blatt-aus'; glow.setAttribute('aria-hidden', 'true'); document.body.appendChild(glow);
    glow.addEventListener('animationend', function () { glow.classList.remove('an'); });
    new MutationObserver(function (recs) {
      recs.forEach(function (r) {
        var e = r.target;
        if (!e.classList || !e.classList.contains('vh-sheet') || e.classList.contains('show') || !/(^|\s)show(\s|$)/.test(r.oldValue || '')) return;
        glow.style.background = getComputedStyle(e).backgroundColor;
        glow.classList.remove('an'); void glow.offsetWidth; glow.classList.add('an');
      });
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
