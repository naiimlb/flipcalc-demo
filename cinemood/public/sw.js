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

// Change à chaque publication qui touche ce fichier : c'est ce qui force
// les navigateurs déjà installés à jeter l'ancien cache plutôt que de le
// garder indéfiniment. Un simple horodatage suffit, aucune signification
// particulière n'est attachée à la valeur.
const VERSION = 'cinemood-v2-20260922';
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

  // Seuls les fichiers de `/_next/static/` portent un hash de leur
  // contenu dans leur URL : si le fichier change, l'URL change aussi.
  // C'est la SEULE catégorie où « cache d'abord » ne peut jamais servir
  // du périmé — pour tout le reste, la même URL peut légitimement
  // changer de contenu d'un déploiement à l'autre.
  const immuable = url.pathname.startsWith('/_next/static/');

  // Navigation ET transitions internes du routeur (les fetch RSC que
  // `router.push` déclenche vers une page comme `/accueil` ne sont PAS
  // des navigations au sens du Service Worker — leur `mode` n'est pas
  // `navigate`, mais elles portent vers la même sorte d'URL non versionnée
  // qu'une navigation classique). Sans ce cas, la bascule « cache d'abord »
  // ci-dessous s'appliquait à elles : une transition vers `/accueil` mise
  // en cache une fois pouvait resservir cette même réponse indéfiniment,
  // y compris après un déploiement qui change le comportement de la page.
  if (!immuable) {
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

  // Fichiers hashés : cache d'abord, puis réseau — sûr par construction.
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
