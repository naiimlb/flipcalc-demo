"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/Skeleton";
import { addDays, DAY_LONG, DAY_SHORT, formatTime, planForService, serviceDate, weekdayIndex } from "@/lib/service";
import { useAppState, useNowMs } from "@/lib/store";
import { CATEGORY_EMOJI } from "@/lib/types";

export default function WeekPage() {
  const state = useAppState();
  const nowMs = useNowMs();
  if (!state || nowMs === null) return <Skeleton />;

  const current = serviceDate(new Date(nowMs));
  const monday = addDays(current, -weekdayIndex(current));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  return (
    <>
      <Header title="Ma semaine" />
      <p className="-mt-2 mb-4 text-sm font-medium text-mute">
        Chaque jour = un service (19h → 3h). Les tâches 🌙 d&apos;après minuit sont rangées dans le service de la veille.
      </p>
      <div className="space-y-4">
        {days.map((d) => {
          const isToday = d.getTime() === current.getTime();
          const plan = planForService(state.tasks, d);
          return (
            <section
              key={d.getTime()}
              aria-label={DAY_LONG[weekdayIndex(d)]}
              className={`rounded-3xl bg-white p-4 shadow-card ${isToday ? "ring-[3px] ring-pink" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="h-street text-2xl">
                  {DAY_SHORT[weekdayIndex(d)]} <span className="text-pink">{d.getDate()}</span>
                </h2>
                {isToday ? (
                  <span className="rounded-full bg-pink px-3 py-1 text-xs font-extrabold text-white">Ce service</span>
                ) : (
                  <span className="text-sm font-bold text-mute">{plan.length} tâche{plan.length > 1 ? "s" : ""}</span>
                )}
              </div>
              {plan.length === 0 ? (
                <p className="py-1 text-sm text-mute">Rien de prévu.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {plan.map((p) => {
                    const done = isToday && state.done[p.key];
                    return (
                      <li key={p.key}>
                        <Link href={`/tache/${p.task.id}`} className="flex min-h-12 items-center gap-3 py-2">
                          <span className={`w-14 shrink-0 text-base font-extrabold tabular-nums ${done ? "text-mute" : "text-pink-deep"}`}>
                            {formatTime(p.task.time)}
                          </span>
                          <span className={`min-w-0 flex-1 text-[15px] font-semibold leading-snug ${done ? "text-mute line-through" : ""}`}>
                            {p.task.title}
                          </span>
                          {p.afterMidnight && <span aria-label="après minuit" className="text-sm">🌙</span>}
                          <span aria-hidden className="text-base">{done ? "✅" : CATEGORY_EMOJI[p.task.category]}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
