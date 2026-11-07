/* Service worker de Hifz : l'app reste utilisable sans réseau.
 *
 *  - Pages : réseau d'abord (toujours à jour en ligne), copie en cache pour le hors-ligne.
 *  - /_next/static (JS, CSS, polices, noms versionnés) : cache d'abord.
 *  - /quran (texte des sourates) : réseau d'abord, cache en secours (l'app garde aussi
 *    chaque sourate dans IndexedDB après vérification de son empreinte).
 *  - L'audio est géré par l'app elle-même (cache « hifz-audio-v1 »), jamais supprimé ici.
 */
const PAGES = "hifz-pages-v1";
const STATIC = "hifz-static-v1";
const DATA = "hifz-data-v1";
const KEEP = [PAGES, STATIC, DATA, "hifz-audio-v1"];

const SHELL = ["/", "/hifz/programme", "/hifz/programme/ajouter", "/hifz/session", "/hifz/suivi", "/reglages", "/sources", "/connexion", "/mot-de-passe-oublie", "/reinitialiser"];
const ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/icons/favicon-32.png"];

/** Ressources /_next/static référencées par une page HTML. */
function staticRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) refs.add(m[1]);
  return [...refs];
}

async function precache() {
  const pages = await caches.open(PAGES);
  const statics = await caches.open(STATIC);
  const refs = new Set();
  await Promise.all(
    SHELL.map(async (path) => {
      try {
        const res = await fetch(path, { cache: "reload", credentials: "same-origin" });
        if (!res.ok) return;
        const html = await res.clone().text();
        staticRefs(html).forEach((r) => refs.add(r));
        await pages.put(path, res);
      } catch {
        // Hors ligne pendant l'installation : la page sera mise en cache à la prochaine visite.
      }
    }),
  );
  await Promise.all([...refs, ...ASSETS].map((url) => statics.add(url).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("hifz-") && !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function networkFirstPage(request) {
  const url = new URL(request.url);
  const cache = await caches.open(PAGES);
  try {
    const res = await Promise.race([fetch(request), timeout(4000)]);
    if (res.ok && res.type === "basic") {
      const copy = res.clone();
      // Mise en cache des nouvelles ressources statiques de la page.
      copy
        .clone()
        .text()
        .then((html) => caches.open(STATIC).then((c) => Promise.all(staticRefs(html).map((r) => c.match(r).then((hit) => hit || c.add(r).catch(() => {}))))))
        .catch(() => {});
      cache.put(url.pathname, copy);
    }
    return res;
  } catch {
    return (await cache.match(url.pathname)) || (await cache.match("/")) || Response.error();
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, name) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC));
  } else if (url.pathname.startsWith("/quran/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(networkFirst(request, DATA));
  }
  // Le reste (données de navigation internes de Next, etc.) passe par le réseau normalement :
  // hors ligne, Next.js retombe sur une navigation complète, servie par le cache des pages.
});
