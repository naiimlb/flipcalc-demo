"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Header } from "@/components/Header";
import { ImportLocalCard } from "@/components/ImportLocalCard";
import { Skeleton } from "@/components/Skeleton";
import { TaskRow } from "@/components/TaskRow";
import { TeamBadge } from "@/components/TeamBadge";
import { sampleTasks } from "@/lib/samples";
import { dayPlanFor, formatServiceDate, formatTime, isOutsideService, isServiceLive, planForService, serviceDate, visiblePlan } from "@/lib/service";
import { updateState, useAppState, useNowMs } from "@/lib/store";

export default function TodayPage() {
  const state = useAppState();
  const nowMs = useNowMs();
  const [showAll, setShowAll] = useState(false); // jour de repos : voir quand même les tâches
  if (!state || nowMs === null) return <Skeleton />;

  const now = new Date(nowMs);
  const sDate = serviceDate(now);
  const dp = dayPlanFor(state.settings.schedule, sDate);
  const resting = dp === "R" && !showAll;
  // Uniquement les tâches de mon équipe ce jour-là (planning non indiqué : toutes).
  const plan = dp === "R" ? (showAll ? planForService(state.tasks, sDate) : []) : visiblePlan(state.tasks, sDate, state.settings.schedule);
  const live = isServiceLive(now);
  const doneCount = plan.filter((p) => state.done[p.key]).length;
  const lateCount = plan.filter((p) => !state.done[p.key] && p.at.getTime() < nowMs).length;
  // Anciennes tâches dont l'heure tombe entre 02h et 10h30 : hors des horaires du restaurant.
  const outOfHours = state.tasks.filter((t) => isOutsideService(t.time));
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
      <Header title={`Salut ${state.profile.prenom} 👋`} />

      <ImportLocalCard userId={state.profile.id} />

      <section aria-label="Progression" className="mb-5 rounded-3xl bg-white p-4 shadow-card">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-mute">Journée du {formatServiceDate(sDate)}</p>
            <p className="mt-0.5 text-xs font-semibold text-mute">
              {live ? "🔥 Service en cours · 11h → 2h" : "⏳ Le service démarre à 11h"}
            </p>
          </div>
          <Link href="/planning" aria-label="Mon planning" className="flex min-h-11 items-center">
            {dp && dp !== "-" ? <TeamBadge plan={dp} /> : <span className="rounded-full border-2 border-pink px-3 py-1 text-xs font-extrabold text-pink-deep">Mon planning</span>}
          </Link>
        </div>
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

      {outOfHours.length > 0 && (
        <section role="status" className="mb-5 rounded-3xl bg-pink-soft p-4">
          <p className="text-[15px] font-extrabold text-pink-deep">
            ⚠️ {outOfHours.length} tâche{outOfHours.length > 1 ? "s ont" : " a"} une heure hors des horaires (entre 02h et 10h30)
          </p>
          <p className="mt-1 text-sm text-ink/80">Les horaires sont maintenant 11h → 2h. Corrige l&apos;heure (rien n&apos;est supprimé) :</p>
          <ul className="mt-2 space-y-1">
            {outOfHours.slice(0, 4).map((t) => (
              <li key={t.id}>
                <Link href={`/tache/${t.id}`} className="inline-flex min-h-11 items-center text-[15px] font-bold text-pink-deep underline">
                  {formatTime(t.time)} · {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resting ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-card">
          <p className="text-lg font-extrabold">Tu es de repos aujourd&apos;hui 😴</p>
          <p className="mt-1 text-sm text-mute">Aucune tâche pour toi. Profites-en !</p>
          <button type="button" onClick={() => setShowAll(true)} className="mt-4 min-h-12 rounded-full border-2 border-pink bg-white px-5 text-sm font-extrabold text-pink-deep">
            Voir quand même les tâches
          </button>
        </div>
      ) : plan.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-card">
          <p className="text-lg font-extrabold">Rien de prévu aujourd&apos;hui 😎</p>
          <p className="mt-1 text-sm text-mute">Ajoute ta première tâche pour recevoir un rappel.</p>
          {state.tasks.length === 0 && (
            <button
              type="button"
              onClick={() => updateState((s) => ({ ...s, tasks: [...s.tasks, ...sampleTasks(s.settings.handover)] }))}
              className="mt-4 min-h-12 rounded-full border-2 border-pink bg-white px-5 text-sm font-extrabold text-pink-deep"
            >
              Ajouter les tâches d&apos;exemple
            </button>
          )}
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
