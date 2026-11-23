"use client";

import { useSyncExternalStore } from "react";
import { permission, requestPermission } from "@/lib/notify";

function subscribe(cb: () => void) {
  window.addEventListener("hb-permission", cb);
  document.addEventListener("visibilitychange", cb);
  return () => {
    window.removeEventListener("hb-permission", cb);
    document.removeEventListener("visibilitychange", cb);
  };
}

/** "permission|installée|iOS" : chaîne stable pour useSyncExternalStore. */
function snapshot() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return `${permission()}|${standalone}|${ios}`;
}

export function NotifSettings() {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "");
  if (!snap) return null;
  const [perm, standalone, ios] = snap.split("|");
  const needsInstall = ios === "true" && standalone !== "true";

  return (
    <div className="space-y-3">
      {needsInstall && (
        <p className="rounded-2xl bg-pink-soft p-3 text-[13px] font-semibold leading-snug text-pink-deep">
          📲 Sur iPhone, ajoute d&apos;abord l&apos;app à l&apos;écran d&apos;accueil : <b>Partager</b> puis <b>Sur l&apos;écran d&apos;accueil</b>,
          et ouvre-la depuis l&apos;icône. Sinon iOS n&apos;autorise pas les notifications.
        </p>
      )}

      {perm === "granted" ? (
        <p className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-4 text-base font-extrabold text-white">
          ✅ Notifications activées
        </p>
      ) : perm === "denied" ? (
        <p className="rounded-2xl bg-ink p-3 text-sm font-semibold text-white">
          🚫 Notifications refusées. Réactive-les dans Réglages iPhone → Notifications → HB Rappels.
        </p>
      ) : perm === "unsupported" ? (
        <p className="rounded-2xl bg-ink p-3 text-sm font-semibold text-white">
          Ce navigateur ne gère pas les notifications{ios === "true" ? " (iOS 16.4 minimum, app ajoutée à l'écran d'accueil)" : ""}.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void requestPermission()}
          className="min-h-14 w-full rounded-full bg-pink text-lg font-extrabold text-white shadow-pop active:scale-[0.98]"
        >
          🔔 Activer les notifications
        </button>
      )}
    </div>
  );
}
