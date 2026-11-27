"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/Skeleton";
import { historyStatus, shiftOver } from "@/lib/bilan";
import { addDays, dateKey, formatServiceDate, formatTime, planForService, serviceDate, visiblePlan } from "@/lib/service";
import { useAppState, useNowMs } from "@/lib/store";
import { acceptedTransferKeys } from "@/lib/transfers";
import { isMine, OCC_LABEL, type OccStatus } from "@/lib/types";

const DAYS = 14;
const TONE: Record<OccStatus, string> = {
  todo: "bg-pink-soft text-pink-deep",
  seen: "bg-pink-soft text-pink-deep",
  postponed: "bg-pink-soft text-pink-deep",
  done: "bg-pink text-white",
  declined: "bg-ink text-white",
  handed: "bg-ink text-white",
  abandoned: "bg-ink text-white",
  missed: "border-2 border-pink-deep bg-white text-pink-deep",
};

/** Historique des 14 derniers jours de service : faite, refusée, transmise, abandonnée ou non faite. */
export default function HistoryPage() {
  const state = useAppState();
  const nowMs = useNowMs();
  if (!state || nowMs === null) return <Skeleton />;
  const now = new Date(nowMs);
  const today = serviceDate(now);
  const transferIn = acceptedTransferKeys(state.transfers, state.profile.id);

  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, -i)).map((d) => {
    const plan = visiblePlan(state.tasks, d, state.settings.schedule, transferIn);
    // Un jour de repos n'a pas de tâches, mais une tâche refusée ou abandonnée y reste visible.
    const key = dateKey(d);
    // Pas d'historique avant la création de la tâche ; pour une tâche d'un collègue : seulement les jours où j'ai agi.
    const known = (p: (typeof plan)[number]) =>
      !!state.outcomes[p.key] || !!state.done[p.key] || (isMine(p.task, state.profile.id) && !p.task.transferOnly && (!p.task.createdAt || key >= dateKey(serviceDate(new Date(p.task.createdAt)))));
    const all = (plan.length ? plan : planForService(state.tasks, d, transferIn)).filter(known);
    const over = shiftOver(now, d, state.settings.schedule, state.settings.handover);
    return {
      d,
      rows: all.map((p) => ({ p, status: historyStatus({ done: !!state.done[p.key], outcome: state.outcomes[p.key], over }) })),
    };
  }).filter((x) => x.rows.length > 0);

  return (
    <>
      <Header title="Historique" />
      {days.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-card">
          <p className="text-lg font-extrabold">Rien pour l&apos;instant</p>
          <p className="mt-1 text-sm text-mute">Les {DAYS} derniers jours apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map(({ d, rows }) => {
            const count = (s: OccStatus) => rows.filter((r) => r.status === s).length;
            return (
              <section key={dateKey(d)} aria-label={formatServiceDate(d)}>
                <h2 className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm font-extrabold uppercase tracking-wide">
                  <span>{formatServiceDate(d)}</span>
                  <span className="text-xs font-semibold normal-case text-mute">
                    {count("done")} faite{count("done") > 1 ? "s" : ""}
                    {count("missed") ? ` · ${count("missed")} non faite${count("missed") > 1 ? "s" : ""}` : ""}
                  </span>
                </h2>
                <ul className="space-y-2">
                  {rows.map(({ p, status }) => (
                    <li key={p.key}>
                      <Link href={`/taches/${p.task.id}?j=${dateKey(d)}`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-card">
                        <span className="min-w-0">
                          <span className="text-sm font-extrabold tabular-nums text-pink-deep">{formatTime(p.task.time)}</span>
                          <span className="block truncate text-[16px] font-bold">{p.task.title}</span>
                          {state.outcomes[p.key]?.reason && <span className="block truncate text-[12px] text-mute">{state.outcomes[p.key]!.reason}</span>}
                        </span>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${TONE[status]}`}>{OCC_LABEL[status]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
