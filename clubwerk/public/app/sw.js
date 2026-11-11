/* Service Worker der Mitglieder-App: Push-Benachrichtigungen und der Hinweis „Keine Verbindung“ (planung/leitfaeden-2.md).
   Zwischengespeichert wird NUR die Hinweisseite offline.html mit ihren statischen Dateien – nie API-Antworten, Mitgliederdaten oder die
   App selbst. Alles geht zuerst ans Netz; der Speicher springt nur ein, wenn das Netz scheitert (oder der Tunnel meldet, dass Clubwerk
   nicht antwortet). Je Version (sw.js?v=…) ein eigener Speicher, alte werden beim Aktivieren gelöscht. */
'use strict';
const V = new URL(self.location.href).searchParams.get('v') || '0';
const PREFIX = 'cw-offline-', CACHE = PREFIX + V;
const FILES = ['offline.html', 'offline.js', 'style.css', 'kit.css', 'theme.css', 'theme-init.js', 'fonts/jakarta-latin.woff2', 'fonts/barlow-condensed-600.woff2'];
// Antworten des Tunnels (Cloudflare), wenn Clubwerk selbst nicht erreichbar ist – sonst stünde dort eine fremde Fehlerseite
const GATEWAY = new Set([502, 503, 504, 520, 521, 522, 523, 524, 530]);

self.addEventListener('install', e => {
  self.skipWaiting();
  // jede Datei einzeln und am Browser-Zwischenspeicher vorbei: fehlt eine (z. B. Schrift), bleibt die Seite trotzdem nutzbar
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(FILES.map(f => fetch(new Request(f, { cache: 'reload' })).then(r => (r.ok ? c.put(f, r) : null))))));
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)));   // alte Fassungen weg
  if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});   // Seitenaufruf wartet nicht auf den Start des Workers
  await self.clients.claim();
})()));

const offline = async () => { const c = await caches.open(CACHE); return c.match('offline.html'); };
const fileOf = url => { if (url.origin !== self.location.origin || url.search) return null; return FILES.find(f => url.pathname.endsWith('/' + f)) || null; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        // kein zweiter Versuch hier: scheitert der Aufruf kurz, fragt die Hinweisseite selbst nach 3 s wieder nach (offline.js)
        const r = (await e.preloadResponse) || await fetch(req);
        if (GATEWAY.has(r.status)) return (await offline()) || r;
        return r;
      } catch (err) { return (await offline()) || Response.error(); }
    })());
    return;
  }
  // Dateien der Hinweisseite (ohne ?v=…, also nie die der App): erst Netz; nur eine gute Antwort zählt, sonst aus dem Speicher. Steht die
  // Hinweisseite unter einer Unterseite (z. B. /p/mitglieder/), gibt es dort keine offline.js (404), und der Tunnel antwortet ohne Clubwerk
  // mit 502 – ohne diesen Rückgriff liefe die Seite dann ohne Skript (kein „Erneut versuchen“, kein Nachfassen; Release-Zug 2026.11.35).
  const f = fileOf(new URL(req.url));
  if (f) e.respondWith((async () => {
    const aus = async () => (await caches.open(CACHE)).match(f);
    try { const r = await fetch(req); if (r.ok) return r; return (await aus()) || r; } catch (err) { return (await aus()) || Response.error(); }
  })());
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: e.data ? e.data.text() : '' }; }
  const title = d.title || 'Verein';
  const opts = { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || undefined, data: { url: d.url || '' }, renotify: Boolean(d.tag) };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { if (target && c.url !== target && 'navigate' in c) c.navigate(target).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
