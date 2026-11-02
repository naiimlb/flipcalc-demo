/* Service worker de Forma3D : application installable + page hors-ligne.
 *
 * Volontairement minimal : il NE met PAS en cache les pages ni l'API (les données et la version du site
 * restent toujours fraîches, le bouton « Mettre à jour » continue de fonctionner). Il garde seulement :
 *  - la page hors-ligne, servie quand une navigation échoue faute de réseau ;
 *  - les fichiers statiques versionnés de Next (/_next/static/*) et les icônes, pour démarrer plus vite.
 */
const CACHE = "forma3d-static-v1";
const OFFLINE_URL = "/offline.html";
const MAX_ENTRIES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("forma3d-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API, authentification, version : toujours le réseau (aucune mise en cache).
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Navigation : réseau d'abord ; hors-ligne, page de secours.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || new Response("Hors ligne", { status: 503 })),
    );
    return;
  }

  // Fichiers statiques versionnés : cache d'abord (leur nom change à chaque version du site).
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
          trim(cache);
        }
        return response;
      }),
    );
  }
});
