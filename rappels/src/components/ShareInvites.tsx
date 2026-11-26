"use client";

import { useState } from "react";
import { respondShare } from "@/lib/sharing";
import { refreshStore, useAppState } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { formatTime } from "@/lib/service";

/** Cartes « Léa t'a partagé une tâche » : accepter (elle entre dans mon planning) ou refuser (elle est masquée). */
export function ShareInvites() {
  const state = useAppState();
  const [busy, setBusy] = useState<string | null>(null);
  const pending = state?.tasks.filter((t) => t.shareStatus === "pending") ?? [];
  if (pending.length === 0) return null;

  async function answer(id: string, accept: boolean) {
    setBusy(id);
    try {
      await respondShare(id, accept);
      await refreshStore(true);
      showToast(accept ? "✅ Tâche acceptée" : "🙈 Tâche masquée", accept ? "Elle est dans ton planning." : "Tu peux la retrouver dans « Mes tâches ».");
    } catch {
      showToast("⚠️ Pas enregistré", "Vérifie ta connexion et réessaie.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Tâches partagées avec toi" className="mb-5 space-y-3">
      {pending.map((t) => (
        <div key={t.id} role="status" className="rounded-3xl border-2 border-pink bg-white p-4 shadow-card">
          <p className="text-[15px] font-extrabold text-pink-deep">👥 {t.sharedBy} t&apos;a partagé une tâche</p>
          <p className="mt-1 text-[17px] font-bold leading-snug">{t.title}</p>
          <p className="text-[13px] font-medium text-mute">À {formatTime(t.time)}{t.shareMode === "one" ? " · le premier qui s'en occupe la prend" : " · chacun la fait"}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button type="button" disabled={busy === t.id} onClick={() => answer(t.id, true)} className="min-h-12 rounded-full bg-pink text-base font-extrabold text-white shadow-pop active:scale-[0.98]">
              Accepter
            </button>
            <button type="button" disabled={busy === t.id} onClick={() => answer(t.id, false)} className="min-h-12 rounded-full border-2 border-line bg-white text-base font-bold">
              Refuser
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
