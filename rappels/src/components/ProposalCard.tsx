"use client";

import Link from "next/link";
import { formatTime, reminderLabel } from "@/lib/service";
import type { ChatProposal } from "@/lib/chat-store";
import { CATEGORY_EMOJI } from "@/lib/types";

export function ProposalCard({ proposal, onAdd }: { proposal: ChatProposal; onAdd: () => void }) {
  const { task, added } = proposal;
  return (
    <div className="mt-2 rounded-3xl border-2 border-pink bg-white p-3 shadow-card">
      <p className="text-xs font-extrabold uppercase tracking-wide text-pink-deep">📌 Tâche proposée</p>
      <p className="mt-1 text-lg font-extrabold leading-snug">
        <span className="tabular-nums text-pink-deep">{formatTime(task.time)}</span> · {task.title}
      </p>
      <p className="text-[13px] font-medium text-mute">
        {CATEGORY_EMOJI[task.category]} {task.category} · 🔔 {reminderLabel(task.remind)} · juste pour ce service
      </p>
      {added ? (
        <p className="mt-2 flex items-center justify-between text-sm font-extrabold text-pink-deep">
          ✅ Ajoutée à ton planning
          <Link href="/" className="rounded-full border-2 border-pink px-3 py-1.5 text-xs">Voir</Link>
        </p>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 min-h-11 w-full rounded-full bg-pink text-[15px] font-extrabold text-white shadow-pop active:scale-[0.98]"
        >
          Ajouter à mes tâches
        </button>
      )}
    </div>
  );
}
