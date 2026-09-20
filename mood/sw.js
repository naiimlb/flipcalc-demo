/* Mood — cache hors ligne */
const CACHE = 'mood-v1';
const FICHIERS = ['./', './index.html', './css/app.css', './js/data.js', './js/engine.js', './js/app.js',
  './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(function (rep) {
    return rep || fetch(e.request).then(function (net) {
      const copie = net.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
      return net;
    }).catch(function () { return caches.match('./index.html'); });
  }));
});
