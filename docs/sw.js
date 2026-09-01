/* Service worker : l'appli s'ouvre même sans réseau, dans les rayons du magasin. */
const VERSION = 'liste-metro-v1';
const COQUE = [
  './',
  './index.html',
  './logo.jpg',
  './icone-180.png',
  './icone-192.png',
  './icone-512.jpg',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(COQUE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== VERSION).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // La page : on tente le réseau pour avoir la dernière version, le cache si pas de réseau
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(rep => {
          const copie = rep.clone();
          caches.open(VERSION).then(c => c.put('./index.html', copie));
          return rep;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Le reste (images, polices) : cache d'abord, rafraîchi en arrière-plan
  e.respondWith(
    caches.match(req).then(cache => {
      const reseau = fetch(req)
        .then(rep => {
          if (rep && (rep.ok || rep.type === 'opaque')) {
            const copie = rep.clone();
            caches.open(VERSION).then(c => c.put(req, copie));
          }
          return rep;
        })
        .catch(() => cache);
      return cache || reseau;
    })
  );
});
