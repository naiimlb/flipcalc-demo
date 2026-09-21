/* =====================================================================
   sw.js — Service worker de CinéMood.
   ---------------------------------------------------------------------
   Objectif modeste et sûr :
     • l'app s'ouvre instantanément, même en 4G faible ;
     • un écran « hors ligne » propre plutôt que l'erreur de Safari ;
     • JAMAIS de mise en cache des routes /api : les recommandations
       doivent rester fraîches, et rien de personnel ne doit traîner
       dans un cache.
   ===================================================================== */

const VERSION = 'cinemood-v1';
const COQUILLE = [
  '/',
  '/manifest.webmanifest',
  '/icons/icone.svg',
  '/icons/icone-192.png',
];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(COQUILLE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  // Rien de dynamique ni de personnel en cache.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigation : réseau d'abord, cache en secours.
  if (requete.mode === 'navigate') {
    evenement.respondWith(
      fetch(requete)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(VERSION).then((cache) => cache.put(requete, copie));
          return reponse;
        })
        .catch(() => caches.match(requete).then((c) => c || caches.match('/'))),
    );
    return;
  }

  // Ressources statiques : cache d'abord, puis réseau.
  evenement.respondWith(
    caches.match(requete).then(
      (enCache) =>
        enCache ||
        fetch(requete).then((reponse) => {
          if (reponse.ok && reponse.type === 'basic') {
            const copie = reponse.clone();
            caches.open(VERSION).then((cache) => cache.put(requete, copie));
          }
          return reponse;
        }),
    ),
  );
});
