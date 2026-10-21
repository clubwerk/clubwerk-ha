'use strict';
/* Eingebetteter Link aus der Kopfzeile: externe Seite im Rahmen unter der Kopfzeile */
(() => {
  const $ = id => document.getElementById(id);
  const i = new URLSearchParams(location.search).get('i');
  // Kopfzeile: aktiven Link markieren
  document.querySelector('script[src="nav.js"]').dataset.active = 'link' + i;
  const mark = () => document.querySelectorAll('#topnav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === 'link.html?i=' + i));
  new MutationObserver(mark).observe($('topnav'), { childList: true });
  Promise.all([fetch('api/tablet/nav').then(r => { if (r.status === 401) { location.replace('./'); throw new Error('gesperrt'); } return r.json(); }), fetch('api/branding').then(r => r.json()).catch(() => ({}))]).then(([n, b]) => {
    const item = (n.items || []).find(x => x.id === 'link' + i && x.url);
    if (!item) { $('frame').remove(); document.body.insertAdjacentHTML('beforeend', '<p class="msg">Dieser Link existiert nicht mehr.</p>'); return; }
    document.title = item.label;
    $('frame').src = item.url;
    mark();
  }).catch(() => { document.body.insertAdjacentHTML('beforeend', '<p class="msg">Keine Verbindung zum Server.</p>'); });
})();
