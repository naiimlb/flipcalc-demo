/* Service worker HB Rappels : hors-ligne simple + notifications (locales et, plus tard, push). */
const CACHE = "hb-rappels-v3";
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

// --- Web Push (envoyé par le planificateur du serveur, voir docs/NOTIFICATIONS.md) ---
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
      renotify: !!data.tag, // une répétition remplace la précédente mais sonne quand même
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-32.png",
      data: { url: data.url || "/" },
    }),
  );
});

// Toucher une notification ouvre la tâche : app fermée (nouvelle fenêtre), en arrière-plan ou déjà ouverte (on réutilise
// la fenêtre, sans rechargement). Le lien est du type /taches/<id>?j=<journée>. Si la page connectée ne répond pas
// (ancienne version de l'app), on la fait naviguer directement.
const OPEN_ACK_MS = 800;

function safePath(raw) {
  try {
    const u = new URL(raw || "/", self.location.origin);
    return u.origin === self.location.origin ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}

async function openOrFocus(path) {
  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const win = wins.find((w) => w.visibilityState === "visible") || wins[0];
  if (!win) return self.clients.openWindow(path);
  try {
    await win.focus();
  } catch {
    /* iOS peut refuser le focus : on continue */
  }
  const ack = await new Promise((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(false), OPEN_ACK_MS);
    ch.port1.onmessage = () => (clearTimeout(timer), resolve(true));
    try {
      win.postMessage({ type: "hb-open", url: path }, [ch.port2]);
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });
  if (!ack && typeof win.navigate === "function") {
    try {
      await win.navigate(path);
      return;
    } catch {
      /* fenêtre non pilotable : on en ouvre une nouvelle */
    }
  }
  if (!ack) return self.clients.openWindow(path);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(openOrFocus(path));
});
