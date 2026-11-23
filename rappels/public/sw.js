/* Service worker HB Rappels : hors-ligne simple + notifications (locales et, plus tard, push). */
const CACHE = "hb-rappels-v1";
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Réseau d'abord, cache en secours : l'app s'ouvre même sans connexion. Rien n'est caché en local (dev).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (IS_LOCAL || req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
  );
});

// --- Web Push (branché plus tard, voir docs/PUSH.md) ---
// Payload attendu : { "title": "⏰ Clôture caisse", "body": "02h30 · Caisse", "url": "/", "tag": "<taskId>@<date>" }
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "HB Rappels", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "HB Rappels", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-32.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins[0];
      if (open) return open.focus().then((c) => c.navigate && c.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
