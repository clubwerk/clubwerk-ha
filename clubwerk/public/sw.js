const CACHE = 'getraenke-v4';
const MAX = 200;   // höchstens so viele zwischengespeicherte Antworten (jede Adresse, z. B. mit ?v=…, wäre sonst ein neuer Eintrag)
const SHELL = ['./', 'index.html', 'style.css', 'tablet.js', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
/* Älteste Einträge zuerst entfernen; die Dateien der Oberfläche (SHELL) bleiben */
const begrenzen = c => c.keys().then(ks => {
  const fest = k => SHELL.some(s => new URL(k.url).pathname === new URL(s, self.registration.scope).pathname);
  ks.filter(k => !fest(k)).slice(0, Math.max(0, ks.length - MAX)).forEach(k => c.delete(k));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Daten, Belege und Verwaltung nie zwischenspeichern – nur die Oberfläche des Tablets
  if (e.request.method !== 'GET' || url.origin !== location.origin || /\/(api|belege)\//.test(url.pathname) || /admin/.test(url.pathname)) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy).then(() => begrenzen(c))); }
    return r;
  }).catch(() => caches.match(e.request)));
});
