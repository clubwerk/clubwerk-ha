'use strict';
/* Digitaler Mitgliedsausweis – gemeinsam für die Mitglieder-App (Modul Mitglieder, „Meine Daten“ › Ausweis) und die Hinweisseite
   ohne Netz (offline.html). Liegt darum mit in der Liste der gespeicherten Dateien des Service Workers (sw.js, FILES).
   Die Karte (Inhalt, QR-Code als SVG, Foto, Logo) speichert die App im Gerät (IndexedDB „cw-ausweis“); vom Server kommt sie höchstens
   einmal am Tag neu. „Abmelden“, ein gesperrtes Handy und ein Austritt löschen sie. Gestaltung: kit.css (.mak-*). Ohne Bewegungswunsch steht der Glanzstreifen still,
   die Uhr läuft weiter (Text, keine Bewegung). Kein Name und kein Geburtsdatum im QR-Code – nur eine signierte Seriennummer. */
(function () {
  var DB = 'cw-ausweis', STORE = 'karte', KEY = 'k';
  function open() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('kein Speicher')); return; }
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode), st = t.objectStore(STORE), out = fn(st);
        t.oncomplete = function () { db.close(); res(out && 'result' in out ? out.result : undefined); };
        t.onerror = function () { db.close(); rej(t.error); };
      });
    });
  }
  var save = function (card) { return tx('readwrite', function (s) { s.put(card, KEY); }).catch(function () { /* privat/voll: dann eben ohne Netz nicht */ }); };
  var clear = function () { return tx('readwrite', function (s) { s.delete(KEY); }).catch(function () { /* nichts gespeichert */ }); };
  /* abgemeldet (app.js löscht die Gerätekennung „va_geraet“): keine Karte mehr, die gespeicherte wird gelöscht */
  var paired = function () { try { return !!localStorage.getItem('va_geraet'); } catch (e) { return true; } };
  var load = function () {
    if (!paired()) return clear().then(function () { return null; });
    return tx('readonly', function (s) { return s.get(KEY); }).then(function (c) { return c && c.token ? c : null; }).catch(function () { return null; });
  };

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var deD = function (s) { return s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : ''; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  /** nur eigene SVG des Servers (qrcode): path/rect, keine Skripte – sicherheitshalber alles andere verwerfen */
  var qrOk = function (svg) { return /^<svg[\s>]/.test(String(svg || '')) && !/<(script|foreignObject|iframe|image)\b|\son\w+=|href=/i.test(svg); };
  var ini = function (name) { var p = String(name || '').split(','); var w = ((p[1] || '') + ' ' + (p[0] || '')).trim().split(/\s+/); return ((w[0] || '?')[0] + ((w.length > 1 && w[w.length - 1][0]) || '')).toUpperCase(); };

  /** Karte als HTML. t = Übersetzung (App: Texte übersetzt die Seite selbst; Hinweisseite: eigene kleine Liste) */
  function html(c, t) {
    t = t || function (x) { return x; };
    var expired = c.exp < today() || c.valid_until < today();
    var chips = (c.depts || []).map(function (d) { return '<span class="vh-chip g" translate="no">' + esc(d) + '</span>'; }).join('') + (c.age ? '<span class="vh-chip" translate="no">' + esc(c.age) + '</span>' : '');
    var sub = [c.no ? t('Nr.') + ' ' + esc(c.no) : '', c.since ? esc(t('Mitglied seit {0}').replace('{0}', c.since)) : ''].filter(Boolean).join(' · ');
    /* Tags mit berechneten Attributen über tag(): so bleibt jedes Textstück im Quelltext ein ganzes Tag (Textsammlung für Übersetzungen) */
    var tag = function (n, a) { return '<' + n + Object.keys(a).map(function (k) { return ' ' + k + '="' + esc(a[k]) + '"'; }).join('') + '>'; };
    return tag('div', { class: 'mak-card' + (expired ? ' mak-old' : '') }) +
      '<div class="mak-head"><span class="mak-shine" aria-hidden="true"></span>' + (c.logo ? tag('img', { class: 'mak-logo', src: c.logo, alt: '' }) : '') +
      '<span class="mak-club"><b translate="no">' + esc(c.club) + '</b><span>' + esc(t('Mitgliedsausweis')) + '</span></span></div>' +
      '<div class="mak-body"><div class="mak-who">' +
        (c.photo ? tag('img', { class: 'mak-photo', src: c.photo, alt: t('Foto') }) : '<span class="mak-photo mak-ini" aria-hidden="true">' + esc(ini(c.name)) + '</span>') +
        '<div class="mak-id"><b class="mak-name" translate="no">' + esc(c.name) + '</b>' + (sub ? '<span class="mak-sub">' + sub + '</span>' : '') + (chips ? '<span class="mak-chips">' + chips + '</span>' : '') + '</div></div>' +
        '<div class="vh-rows mak-rows"><div><span>' + esc(t('Status')) + '</span><b>' + esc(t(c.status)) + '</b></div><div><span>' + esc(t('Gültig bis')) + '</span><b>' + deD(c.valid_until) + '</b></div></div>' +
        (expired ? tag('div', { class: ['mak-qr', 'mak-qr-off'].join(' '), role: 'img', 'aria-label': t('Code abgelaufen') }) + '<b>' + esc(t('Code abgelaufen')) + '</b><span>' + esc(t('Öffne die App mit Netz, dann kommt ein neuer Code.')) + '</span></div>'
          : tag('div', { class: 'mak-qr', role: 'img', 'aria-label': t('QR-Code des Mitgliedsausweises') }) + (qrOk(c.qr) ? c.qr : '') + '</div>') +
        '<div class="mak-live" aria-live="off"><span class="mak-dot" aria-hidden="true"></span><span>' + esc(t('Live')) + '</span><b class="mak-clock" translate="no">--:--:--</b><span class="mak-date" translate="no"></span></div>' +
      '</div></div>';
  }
  /** Live-Uhr mit Sekunden in allen Karten unter root – gibt eine Stopp-Funktion zurück */
  function clock(root) {
    var tick = function () {
      var d = new Date(), s = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()), day = '· ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
      var cl = root.querySelectorAll('.mak-clock'), dt = root.querySelectorAll('.mak-date');
      for (var i = 0; i < cl.length; i++) cl[i].textContent = s;
      for (var j = 0; j < dt.length; j++) dt[j].textContent = day;
    };
    tick();
    var id = setInterval(tick, 1000);
    return function () { clearInterval(id); };
  }
  window.CWAusweis = { load: load, save: save, clear: clear, html: html, clock: clock, today: today };
})();
