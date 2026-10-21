const CACHE = 'getraenke-v4';
const SHELL = ['./', 'index.html', 'style.css', 'tablet.js', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Daten, Belege und Verwaltung nie zwischenspeichern – nur die Oberfläche des Tablets
  if (e.request.method !== 'GET' || url.origin !== location.origin || /\/(api|belege)\//.test(url.pathname) || /admin/.test(url.pathname)) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
