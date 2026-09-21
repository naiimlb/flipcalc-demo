/* =====================================================================
   sw.js — cache de l'app pour un démarrage hors ligne (cuisines, caves)
   ===================================================================== */
const VERSION = 'commande-express-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/ui.js',
  './js/theme.js',
  './js/store.js',
  './js/auth.js',
  './js/cloud.js',
  './js/config.js',
  './js/seed.js',
  './js/message.js',
  './js/screens/auth.js',
  './js/screens/onboarding.js',
  './js/screens/home.js',
  './js/screens/inventory.js',
  './js/screens/order.js',
  './js/screens/history.js',
  './js/screens/products.js',
  './js/screens/suppliers.js',
  './js/screens/settings.js',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map((u) => cache.add(u).catch(() => { /* fichier optionnel */ })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* L'API Supabase ne doit jamais être servie depuis le cache. */
  if (url.hostname.endsWith('.supabase.co')) return;

  /* Navigation : réseau d'abord, puis coquille en cache. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', net.clone());
        return net;
      } catch {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  /* Ressources : cache d'abord, rafraîchies en arrière-plan. */
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const reseau = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        caches.open(VERSION).then((c) => c.put(req, res.clone()));
      }
      return res;
    }).catch(() => null);
    return cached || (await reseau) || Response.error();
  })());
});
