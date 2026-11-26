"use client";

import { useSyncExternalStore } from "react";
import { permission, requestPermission } from "./notify";
import { getSupabase } from "./supabase";

// Web Push : le serveur envoie les rappels même app fermée / téléphone verrouillé (voir docs/NOTIFICATIONS.md).
// iPhone : iOS 16.4 minimum, app ajoutée à l'écran d'accueil et ouverte depuis l'icône.
const flagKey = (uid: string) => `hb-push-on:${uid}`;
const EVENT = "hb-push-change";

export const pushConfigured = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function setFlag(uid: string, on: boolean) {
  try {
    if (on) localStorage.setItem(flagKey(uid), "1");
    else localStorage.removeItem(flagKey(uid));
  } catch {
    /* ignoré */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function isPushOn(uid: string): boolean {
  try {
    return localStorage.getItem(flagKey(uid)) === "1";
  } catch {
    return false;
  }
}

/** true si les rappels de cet appareil sont envoyés par le serveur (le planificateur local se met alors en retrait). */
export function usePushOn(uid: string | undefined): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    () => (uid ? isPushOn(uid) : false),
    () => false,
  );
}

export type PushResult = { ok: true } | { ok: false; message: string };

/** Demande l'autorisation, abonne l'appareil et enregistre l'abonnement dans le compte. */
export async function enablePush(uid: string): Promise<PushResult> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return { ok: false, message: "Les notifications serveur ne sont pas encore configurées." };
  if (!pushSupported()) return { ok: false, message: "Ce navigateur ne gère pas les notifications push. Sur iPhone : iOS 16.4 minimum, et ajoute d'abord l'app à l'écran d'accueil." };
  if (permission() !== "granted" && (await requestPermission()) !== "granted") return { ok: false, message: "Notifications refusées. Autorise-les dans Réglages iPhone → Notifications → HB Rappels." };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
    const j = sub.toJSON();
    if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) return { ok: false, message: "Abonnement incomplet. Réessaie." };
    const { error } = await getSupabase()
      .from("push_subscriptions")
      .upsert({ user_id: uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth_key: j.keys.auth }, { onConflict: "endpoint" });
    if (error) return { ok: false, message: "Impossible d'enregistrer cet appareil. Réessaie." };
    setFlag(uid, true);
    return { ok: true };
  } catch {
    return { ok: false, message: "Activation impossible pour l'instant. Réessaie dans un instant." };
  }
}

/** Désabonne cet appareil et supprime son abonnement du compte (aussi appelé à la déconnexion). */
export async function disablePush(uid: string): Promise<void> {
  try {
    if (pushSupported()) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await getSupabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
    }
  } catch {
    /* au pire, le serveur supprimera l'abonnement à son prochain envoi raté */
  }
  setFlag(uid, false);
}

/** Au lancement : si l'abonnement n'existe plus (permission retirée…), on retire l'indicateur pour reprendre les rappels locaux. */
export async function reconcilePush(uid: string): Promise<void> {
  if (!isPushOn(uid)) return;
  try {
    if (!pushSupported() || permission() !== "granted") return setFlag(uid, false);
    const reg = await navigator.serviceWorker.ready;
    if (!(await reg.pushManager.getSubscription())) setFlag(uid, false);
  } catch {
    /* hors ligne : on ne change rien */
  }
}
