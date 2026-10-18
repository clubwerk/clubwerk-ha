/* Clubwerk – Übersetzungskern (Browser und Server)
 * Sprachdateien ordnen jedem deutschen Originaltext eine Übersetzung zu: { "Speichern": "Save", "{0} Artikel": "{0} items" }.
 * Platzhalter {0}, {1} … bzw. {name} stehen für wechselnde Inhalte (Zahlen, Namen) und müssen in der Übersetzung erhalten bleiben.
 * Fehlt eine Übersetzung, bleibt der deutsche Text stehen – es geht also nie etwas kaputt. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CWCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PH = /\{(\d+|[a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  var DW = 'Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Mo|Di|Mi|Do|Fr|Sa|So|Jan|Feb|Mär|Apr|Jun|Jul|Aug|Sep|Okt|Nov|Dez';
  var DATEWORD = new RegExp('(^|[^A-Za-zÄÖÜäöüß])(' + DW + ')(?![A-Za-zÄÖÜäöüß])'), DATEWORD_G = new RegExp('(?<![A-Za-zÄÖÜäöüß])(' + DW + ')(?![A-Za-zÄÖÜäöüß])', 'g');
  var ABBR = /(?:(?:^|[\s(])(?:z|d|u|o|s)\.(?: [A-Za-z]\.)?|\b(?:ca|Nr|bzw|evtl|inkl|max|min|Std|usw|vgl|ggf|bspw|etc|Tel|Str|Kd|Art|Kunden-Nr|Mo|Di|Mi|Do|Fr|Sa|So)\.)$/;
  function norm(s) { return String(s).replace(/[\s ]+/g, ' ').trim(); }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  /** Platzhalter eines Textes, sortiert (zum Vergleich Original ↔ Übersetzung) */
  function placeholders(s) { var m = String(s).match(PH) || []; return m.slice().sort().join(','); }
  /** Hat der Text echte Wörter außerhalb der Platzhalter? (sonst wäre jedes beliebige Feld ein Treffer) */
  function literal(k) { return k.replace(PH, ' ').replace(/[^A-Za-zÄÖÜäöüß]+/g, ''); }

  function compile(strings) {
    var exact = new Map(), pats = [];
    var keys = Object.keys(strings || {});
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], v = strings[k];
      if (typeof v !== 'string' || !v || k.charAt(0) === '_') continue;
      var nk = norm(k);
      if (!nk) continue;
      if (nk.search(PH) < 0) { exact.set(nk, v); continue; }
      if (literal(nk).length < 3) continue;
      var parts = nk.split(PH), names = [], re = '^', longest = '';
      // split mit Gruppe liefert abwechselnd Text, Name, Text …
      for (var j = 0; j < parts.length; j++) {
        if (j % 2 === 0) {
          var lit = parts[j], pre = '', post = '';
          // Leerzeichen direkt an einem Platzhalter sind optional (der eingesetzte Teil kann leer sein)
          // … aber nur an Wortgrenzen (sonst passt „{0} min“ auf „Admin“)
          if (j > 0 && lit.charAt(0) === ' ') { lit = lit.slice(1); pre = '(?: |(?<=^|\\s))'; }
          if (j < parts.length - 1 && lit.charAt(lit.length - 1) === ' ') { lit = lit.slice(0, -1); post = '(?: |(?=\\s|$))'; }
          re += pre + esc(lit) + post;
          if (lit.length > longest.length) longest = lit;
        } else { names.push(parts[j]); re += '([\\s\\S]*?)'; }
      }
      re += '$';
      pats.push({ re: new RegExp(re), names: names, val: v, hint: longest, weight: literal(nk).length });
      exact.set(nk, v);   // auch wörtlich (falls der Text selbst „{0}“ enthält, z. B. in Vorlagen)
    }
    pats.sort(function (a, b) { return b.weight - a.weight; });
    return { exact: exact, pats: pats, cache: new Map(), size: exact.size };
  }

  function fill(str, vars) {
    if (!vars) return str;
    return String(str).replace(PH, function (m, n) { return Object.prototype.hasOwnProperty.call(vars, n) && vars[n] !== undefined && vars[n] !== null ? String(vars[n]) : m; });
  }

  /** Übersetzt einen ganzen Text (bereits normalisiert oder nicht). Gibt null zurück, wenn es keine Übersetzung gibt. */
  function lookup(d, text, depth, exactOnly) {
    if (!d || !d.size) return null;
    var t = norm(text);
    if (!t) return null;
    var hit = d.exact.get(t);
    if (hit !== undefined) return hit;
    if (exactOnly) return null;
    if (d.cache.has(t)) return d.cache.get(t);
    var out = null;
    if (t.length <= 2000) {
      for (var i = 0; i < d.pats.length; i++) {
        var p = d.pats[i];
        if (p.hint && t.indexOf(p.hint) < 0) continue;
        var m = p.re.exec(t);
        if (!m) continue;
        // wenig fester Text, aber sehr langer eingesetzter Teil → vermutlich kein echter Treffer (z. B. „Beregnung {0}“ auf einem ganzen Absatz)
        if (p.weight < 12 && t.length - p.hint.length > 120) continue;
        // ein eingesetzter Teil mit Satzende davor/danach ist meist ein zweiter Satz → lieber Satz für Satz übersetzen
        var multi = false;
        for (var c = 1; c < m.length; c++) if (m[c] && /[.!?] (?=[A-ZÄÖÜ„"(])/.test(m[c]) && !ABBR.test(m[c].split(/[.!?] (?=[A-ZÄÖÜ„"(])/)[0] + '.')) { multi = true; break; }
        if (multi) continue;
        var vars = {};
        for (var j = 0; j < p.names.length; j++) {
          var val = m[j + 1];
          // eingesetzte Teile ggf. selbst übersetzen („Status: {0}“ mit „offen“)
          var sub = null;
          if ((depth || 0) < 1 && val) {
            sub = lookup(d, val, (depth || 0) + 1);
            if (sub === null && DATEWORD.test(val)) {   // Monats-/Tagesnamen in Datumsangaben („Oktober 2026“)
              var sw = val.replace(DATEWORD_G, function (w) { var x = d.exact.get(w); return x !== undefined ? x : w; });
              if (sw !== val) sub = sw;
            }
            if (sub === null && val.indexOf(', ') > 0) {   // Aufzählung („Türen, Beregnung“)
              var items = val.split(', '), hit2 = false;
              for (var q = 0; q < items.length; q++) { var it = d.exact.get(norm(items[q])); if (it !== undefined) { items[q] = it; hit2 = true; } }
              if (hit2) sub = items.join(', ');
            }
          }
          if (sub !== null) { var ws = /^(\s*)[\s\S]*?(\s*)$/.exec(val); sub = ws[1] + sub + ws[2]; }
          vars[p.names[j]] = sub !== null ? sub : val;
        }
        out = fill(p.val, vars);
        break;
      }
    }
    if (d.cache.size > 8000) d.cache.clear();
    d.cache.set(t, out);
    return out;
  }

  /** Text übersetzen, Leerraum am Anfang/Ende erhalten */
  function translate(d, text) {
    if (!d || !d.size || !text) return text;
    var s = String(text), m = s.match(/^([\s ]*)([\s\S]*?)([\s ]*)$/);
    if (!m[2] || !/[A-Za-zÄÖÜäöüß]/.test(m[2])) return s;
    var r = lookup(d, m[2], 0, true);
    if (r === null && m[2].indexOf('\n') >= 0) {   // mehrzeilig (E-Mails, Meldungen, umbrochener Quelltext): Zeile für Zeile
      var lines = m[2].split('\n'), any = false;
      for (var i = 0; i < lines.length; i++) { var x = translate(d, lines[i]); if (x !== lines[i]) { lines[i] = x; any = true; } }
      if (any) r = lines.join('\n');
    }
    if (r === null) r = lookup(d, m[2], 0);
    if (r === null && /[.!?] \S/.test(norm(m[2]))) {   // mehrere Sätze in einem Stück (zusammengesetzte Hinweise): Satz für Satz
      var raw = norm(m[2]).split(/(?<=[.!?]) (?=\S)/), sent = [];
      for (var a = 0; a < raw.length; a++) {   // Abkürzungen („z. B.“, „ca.“, „Nr.“) beenden keinen Satz
        if (sent.length && ABBR.test(sent[sent.length - 1])) sent[sent.length - 1] += ' ' + raw[a]; else sent.push(raw[a]);
      }
      var got = false;
      for (var k = 0; k < sent.length; k++) { var y = lookup(d, sent[k], 0); if (y !== null) { sent[k] = y; got = true; } }
      if (got) r = sent.join(' ');
    }
    return r === null ? s : m[1] + r + m[3];
  }

  var ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
  function decode(s) { return s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, function (m) { return ENT[m]; }); }
  function encode(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /** HTML (z. B. E-Mails) übersetzen: nur Text zwischen den Tags, Ergebnis sicher kodiert */
  function translateHtml(d, html) {
    if (!d || !d.size || !html) return html;
    return String(html).replace(/(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]*>)|([^<]+)/gi, function (m, tag, text) {
      if (tag) {
        return tag.replace(/\s(title|alt|placeholder|aria-label)="([^"]*)"/g, function (a, n, v) { return ' ' + n + '="' + encode(translate(d, decode(v))).replace(/"/g, '&quot;') + '"'; });
      }
      var t = translate(d, decode(text));
      return t === decode(text) ? text : encode(t);
    });
  }

  return { norm: norm, compile: compile, lookup: lookup, translate: translate, translateHtml: translateHtml, fill: fill, placeholders: placeholders, literal: literal, PH: PH };
});
