"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Bandeau discret quand l'appareil est hors ligne. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="status" className="mx-auto mt-2 flex max-w-lg items-center gap-2 rounded-2xl bg-elevated px-4 py-2 text-sm text-muted">
      <Icon name="wifi-off" width={18} height={18} />
      Hors ligne : les versets déjà téléchargés restent disponibles.
    </div>
  );
}
