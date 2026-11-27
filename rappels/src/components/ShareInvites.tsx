"use client";

import { useState } from "react";
import { respondShare } from "@/lib/sharing";
import { pendingIncoming, respondTransfer } from "@/lib/transfers";
import { refreshStore, useAppState } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { formatTime } from "@/lib/service";

/** Cartes « Léa t'a partagé une tâche » : accepter (elle entre dans mon planning) ou refuser (elle est masquée). */
export function ShareInvites() {
  const state = useAppState();
  const [busy, setBusy] = useState<string | null>(null);
  const pending = state?.tasks.filter((t) => t.shareStatus === "pending") ?? [];
  const incoming = state ? pendingIncoming(state.transfers, state.profile.id) : [];
  if (pending.length === 0 && incoming.length === 0) return null;

  async function answerTransfer(id: string, accept: boolean) {
    setBusy(id);
    const r = await respondTransfer(id, accept);
    setBusy(null);
    if (!r.ok) showToast(r.takenBy ? `🙌 ${r.takenBy} l'a déjà prise` : "Plus disponible", r.takenBy ? "Un collègue de l'équipe a accepté avant toi." : "Cette transmission n'est plus en attente.");
    else showToast(accept ? "📥 Tâche acceptée" : "🙈 Tâche refusée", accept ? "Elle est dans ton planning." : "Ton collègue est prévenu.");
  }

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
      {incoming.map((x) => {
        const task = state?.tasks.find((t) => t.id === x.taskId);
        if (!task) return null;
        return (
          <div key={x.id} role="status" className="rounded-3xl border-2 border-pink bg-white p-4 shadow-card">
            <p className="text-[15px] font-extrabold text-pink-deep">📥 {x.fromPrenom} t&apos;a transmis une tâche{x.wholeTeam ? " (à toute l'équipe)" : ""}</p>
            <p className="mt-1 text-[17px] font-bold leading-snug">{task.title}</p>
            <p className="text-[13px] font-medium text-mute">À {formatTime(task.time)} · {x.targetTeam === "soir" ? "équipe Soir" : "équipe Jour"}</p>
            {x.message && <p className="mt-1 text-[15px] leading-snug">« {x.message} »</p>}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" disabled={busy === x.id} onClick={() => answerTransfer(x.id, true)} className="min-h-12 rounded-full bg-pink text-base font-extrabold text-white shadow-pop active:scale-[0.98]">Accepter</button>
              <button type="button" disabled={busy === x.id} onClick={() => answerTransfer(x.id, false)} className="min-h-12 rounded-full border-2 border-line bg-white text-base font-bold">Refuser</button>
            </div>
          </div>
        );
      })}
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
