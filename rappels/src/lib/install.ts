"use client";

import { useSyncExternalStore } from "react";

/** "iphone|standalone" : l'app est-elle installée sur l'écran d'accueil ? (sur iPhone, Safari et l'app installée ne partagent pas leur session) */
function snapshot(): string {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return `${ios}|${standalone}`;
}

export function useInstallState(): { ios: boolean; standalone: boolean } | null {
  const snap = useSyncExternalStore(() => () => {}, snapshot, () => "");
  if (!snap) return null;
  const [ios, standalone] = snap.split("|");
  return { ios: ios === "true", standalone: standalone === "true" };
}
