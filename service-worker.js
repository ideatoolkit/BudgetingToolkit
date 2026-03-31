const CACHE = 'budget-flow-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(resp => resp || fetch(event.request).then(net => {
    const copy = net.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
    return net;
  }).catch(() => caches.match('./index.html'))));
});
