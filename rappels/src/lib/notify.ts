"use client";

import type { NotificationContent } from "./notification-text";
import { reminderLabel } from "./service";
import { showToast } from "./toast";

export type { NotificationContent } from "./notification-text";
export { buildNotification, buildSlotNotification } from "./notification-text";

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
 * (Les vrais push, eux, arrivent même app fermée : voir docs/NOTIFICATIONS.md.)
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
