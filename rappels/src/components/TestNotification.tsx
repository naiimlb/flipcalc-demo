"use client";

import { useState } from "react";
import { buildNotification, sendLocalNotification } from "@/lib/notify";
import type { Task } from "@/lib/types";

/** Bouton « Tester la notification » : bandeau dans l'app + notif système si autorisée. */
export function TestNotification({ task }: { task: Task | undefined }) {
  const [waiting, setWaiting] = useState(false);

  function run() {
    if (!task || waiting) return;
    setWaiting(true);
    // 5 s pour pouvoir verrouiller l'iPhone ou quitter l'app et voir la vraie notification.
    setTimeout(() => {
      void sendLocalNotification(buildNotification(task, "test"));
      setWaiting(false);
    }, 5_000);
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={!task || waiting}
        className="min-h-14 w-full rounded-full bg-pink text-lg font-extrabold text-white shadow-pop active:scale-[0.98] disabled:opacity-60"
      >
        {waiting ? "Ça arrive dans 5 s… 🔔" : "Tester la notification"}
      </button>
      <p className="mt-2 text-center text-xs font-medium text-mute">
        Envoyée dans 5 s : verrouille ton iPhone ou quitte l&apos;app pour la voir comme en vrai.
      </p>
    </div>
  );
}
