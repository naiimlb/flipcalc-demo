"use client";

import Link from "next/link";
import { Fragment } from "react";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/Skeleton";
import { TaskRow } from "@/components/TaskRow";
import { formatServiceDate, isServiceLive, planForService, serviceDate } from "@/lib/service";
import { updateState, useAppState, useNowMs } from "@/lib/store";

export default function TodayPage() {
  const state = useAppState();
  const nowMs = useNowMs();
  if (!state || nowMs === null) return <Skeleton />;

  const now = new Date(nowMs);
  const sDate = serviceDate(now);
  const plan = planForService(state.tasks, sDate);
  const live = isServiceLive(now);
  const doneCount = plan.filter((p) => state.done[p.key]).length;
  const lateCount = plan.filter((p) => !state.done[p.key] && p.at.getTime() < nowMs && live).length;
  const percent = plan.length ? Math.round((doneCount / plan.length) * 100) : 0;
  const firstAfterMidnight = plan.findIndex((p) => p.afterMidnight);

  const toggle = (key: string) =>
    updateState((s) => {
      const done = { ...s.done };
      if (done[key]) delete done[key];
      else done[key] = true;
      return { ...s, done };
    });

  return (
    <>
      <Header title={`Salut ${state.role.toLowerCase()} 👋`} />

      <section aria-label="Progression" className="mb-5 rounded-3xl bg-white p-4 shadow-card">
        <p className="text-sm font-bold text-mute">Service du {formatServiceDate(sDate)}</p>
        <p className="mt-0.5 text-xs font-semibold text-mute">
          {live ? "🔥 Service en cours · 19h → 3h" : "⏳ Le service démarre à 19h"}
        </p>
        <div className="mt-3 flex items-end justify-between">
          <p className="h-street text-4xl">
            <span className="text-pink">{doneCount}</span>/{plan.length} <span className="text-2xl">faites</span>
          </p>
          {lateCount > 0 && (
            <span className="rounded-full bg-ink px-3 py-1 text-xs font-extrabold text-white">
              {lateCount} en retard
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={plan.length}
          aria-valuenow={doneCount}
          aria-label={`${doneCount} tâches faites sur ${plan.length}`}
          className="mt-3 h-4 overflow-hidden rounded-full bg-pink-soft"
        >
          <div className="h-full rounded-full bg-pink transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
        {plan.length > 0 && doneCount === plan.length && (
          <p className="mt-3 text-sm font-extrabold text-pink-deep">Service bouclé, bien joué 🔥</p>
        )}
      </section>

      {plan.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-card">
          <p className="text-lg font-extrabold">Rien de prévu ce soir 😎</p>
          <p className="mt-1 text-sm text-mute">Ajoute ta première tâche pour recevoir un rappel.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {plan.map((p, i) => {
            const late = live ? nowMs - p.at.getTime() : 0;
            return (
              <Fragment key={p.key}>
                {i === firstAfterMidnight && (
                  <li aria-hidden className="flex items-center gap-3 pt-2 text-xs font-extrabold uppercase tracking-wide text-mute">
                    <span className="h-px flex-1 bg-line" />🌙 Après minuit
                    <span className="h-px flex-1 bg-line" />
                  </li>
                )}
                <TaskRow planned={p} done={!!state.done[p.key]} lateBy={late} onToggle={() => toggle(p.key)} />
              </Fragment>
            );
          })}
        </ul>
      )}

      <Link
        href="/tache/nouvelle"
        aria-label="Ajouter une tâche"
        className="fixed bottom-24 right-4 z-20 flex size-14 items-center justify-center rounded-full bg-pink text-white shadow-pop active:scale-95"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <span aria-hidden className="text-4xl font-light leading-none">+</span>
      </Link>
    </>
  );
}
