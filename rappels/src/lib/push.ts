// Squelette pour les vrais Web Push (pas encore branché dans l'interface).
// Voir docs/PUSH.md pour le backend (VAPID + stockage des abonnements + cron).

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Abonne cet appareil au push et renvoie l'abonnement à envoyer au backend (null si indisponible). */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true, // obligatoire sur iOS : chaque push doit afficher une notification
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}
