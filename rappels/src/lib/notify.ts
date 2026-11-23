"use client";

import { formatTime, reminderLabel } from "./service";
import { showToast } from "./toast";
import type { Task } from "./types";

export type NotificationContent = { title: string; body: string };

/** Texte du push : même format pour l'aperçu, le test et (plus tard) le vrai push serveur. */
export function buildNotification(task: Task, serviceLabel?: string): NotificationContent {
  const lead = task.remind === 0 ? "c'est l'heure !" : `dans ${task.remind} min, prépare-toi !`;
  const where = serviceLabel ? ` · ${serviceLabel}` : "";
  return {
    title: `⏰ ${task.title}`,
    body: `${formatTime(task.time)} · ${task.category}${where} — ${lead}`,
  };
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function permission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export async function requestPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  const result = await Notification.requestPermission();
  window.dispatchEvent(new Event("hb-permission"));
  return result;
}

/**
 * Simulation locale : bandeau dans l'app + notification système si la permission est accordée.
 * (Un vrai push, lui, arrivera même app fermée : voir docs/PUSH.md.)
 */
export async function sendLocalNotification({ title, body }: NotificationContent, tag = "hb-test") {
  showToast(title, body);
  if (permission() !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-32.png",
      data: { url: "/" },
    });
  } catch {
    /* le bandeau dans l'app a déjà été affiché */
  }
}

export { reminderLabel };
