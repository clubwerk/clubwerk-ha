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
    return { exact: exact, pats: pats, cache: new Map(), wt: new Map(), size: exact.size };
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
            if (sub === null && /\s\d+$/.test(val)) { var nm = /^([\s\S]*?\S)(\s+\d+)$/.exec(val), nh = nm && lookup(d, nm[1], 1, true); if (nh) sub = nh + nm[2]; }   // „Viertelfinale 1“
            if (sub === null && val.indexOf(': ') > 0) {   // „Bezeichnung: Wert“ („Buchungen heute: 6“)
              var lv0 = val.split(': '), lh = lookup(d, lv0[0], 1);
              if (lh !== null) sub = lh + ': ' + lv0.slice(1).join(': ');
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
        d.wt.set(t, p.weight + (/\S\s·\s\S/.test(m.slice(1).join('\u0001')) ? 1000 : 0));   // Gewicht des Musters; ab 1000: ein Platzhalter hat mehrere „·“-Teile verschluckt (translate: Aufzählungen Teil für Teil)
        break;
      }
    }
    if (d.cache.size > 8000) { d.cache.clear(); d.wt.clear(); }
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
    if (r === null && (/[ \u00a0]·[ \u00a0]/.test(m[2]) || (m[2].indexOf(' – ') > 0 && m[2].length < 80 && !/[.!?] \S/.test(m[2])))) {   // „A · B – C“ aus Teilstücken zusammengesetzt: Teil für Teil, wenn kein Muster mit viel festem Text den ganzen Satz kennt
      var parts0 = m[2].split(/[ \u00a0]·[ \u00a0]/.test(m[2]) ? /([ \u00a0]·[ \u00a0])/ : /( – )/), segs = parts0.filter(function (x, i) { return i % 2 === 0; }), gs = false;
      for (var q = 0; q < segs.length; q++) {
        var z = translate(d, segs[q]);
        if (z === segs[q]) {   // der Text steht als Bruchstück mit Trenner im Wörterbuch („· eingetragen als Mitspieler“)
          var zb = lookup(d, '· ' + segs[q], 0, true); if (zb !== null) z = zb.replace(/^·\s*/, '');
          else { var za = lookup(d, segs[q] + ' ·', 0, true); if (za !== null) z = za.replace(/\s*·$/, ''); }
        }
        if (z === segs[q] && segs[q].indexOf(': ') > 0) { var lv = segs[q].split(': '), z1 = translate(d, lv[0]); if (z1 !== lv[0]) z = z1 + ': ' + translate(d, lv.slice(1).join(': ')); }   // „Buchungen heute: 6“
        if (z !== segs[q]) { segs[q] = z; gs = true; }
      }
      if (gs) { var whole = lookup(d, m[2], 0); var wv = d.wt.get(norm(m[2])) || 0; if (whole === null || wv >= 1000 || (wv < 12 && (/[ \u00a0]·[ \u00a0]/.test(m[2]) || m[2].length < 80))) { var ix = 0; r = parts0.map(function (x, i) { return i % 2 === 0 ? segs[ix++] : x; }).join(''); } }
    }
    if (r === null) {   // Trenner „·“ an den Rändern eines Bruchstücks: der Kern hat einen eigenen Text („· Aufstellung noch nicht verschickt“)
      var sm0 = /^(\s*·\s*)([\s\S]*?)(\s*·\s*)?$|^([\s\S]*?)(\s*·\s*)$/.exec(m[2]);
      if (sm0) { var cr = sm0[1] !== undefined ? sm0[2] : sm0[4], ce = lookup(d, cr, 0, true); if (ce !== null) r = (sm0[1] || '') + ce + (sm0[3] || sm0[5] || ''); }
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
    if (r === null && /^\d+(?:[.,]\d+)?\s+\S/.test(m[2])) {   // Zahl davor: „1 Gast“, „4 Schichten“ → Wort übersetzen (auch Mehrzahl: Gäste)
      var nn = /^(\d+(?:[.,]\d+)?)\s+(\S[\s\S]*)$/.exec(m[2]), nw = lookup(d, nn[2], 0, true);
      if (nw !== null) r = nn[1] + ' ' + nw;
    }
    if (r === null && /\S:$/.test(m[2])) { var cl = lookup(d, m[2].slice(0, -1), 0, true); if (cl !== null) r = cl + ':'; }   // „Licht an:“ vor einem Wert
    if (r === null && m[2].indexOf(', ') > 0) {   // Aufzählung: „Spieltage, Plätze, Dienste“
      var its = m[2].split(', '), allI = true;
      for (var w2 = 0; w2 < its.length; w2++) { var ti = lookup(d, its[w2], 0, true); if (ti !== null) its[w2] = ti; else { allI = false; break; } }
      if (allI) r = its.join(', ');   // nur wenn jeder Teil bekannt ist (sonst Satz für Satz weiter unten)
    }
    if (r === null) {   // Bezeichnung mit Zähler: „Termine (1)“, „Viertelfinale 2“ → Bezeichnung übersetzen, Zähler behalten
      var cm = /^([\s\S]*?\S)(\s*\(\d+\)|\s+\d[\d\/.,–-]*)$/.exec(m[2]);
      if (cm) { var cn = lookup(d, cm[1], 0, true); if (cn !== null) r = cn + cm[2]; }
    }
    if (r === null && m[2].indexOf(': ') > 0) {   // „Bezeichnung: Wert“ („Licht an: 0“): Bezeichnung und Wert je für sich
      var kv = m[2].split(': '), kl = lookup(d, kv[0], 0, true);
      if (kl !== null) { var kr = kv.slice(1).join(': '); r = kl + ': ' + (translate(d, kr) || kr); }
    }
    if (r === null) {   // Bruchstück zwischen Markierungen: „· auswärts ·“ → Trenner behalten, Kern übersetzen
      var sm = /^(\s*·\s*)?([\s\S]*?)(\s*·\s*)?$/.exec(m[2]);
      if (sm && (sm[1] || sm[3]) && sm[2]) { var core = translate(d, sm[2]); if (core !== sm[2]) r = (sm[1] || '') + core + (sm[3] || ''); }
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
