"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/Skeleton";
import { DAY_LONG, formatMinutes, type DayPlan } from "@/lib/service";
import { updateState, useAppState } from "@/lib/store";

const CHOICES: { value: Exclude<DayPlan, "-">; label: string }[] = [
  { value: "J", label: "☀️ Jour" },
  { value: "S", label: "🌙 Soir" },
  { value: "R", label: "😴 Repos" },
];

/** « Mon planning » : mon équipe pour chaque jour de la semaine. Sert de base à l'écran Aujourd'hui et aux rappels. */
export default function PlanningPage() {
  const state = useAppState();
  if (!state) return <Skeleton />;
  const current = state.settings.schedule && state.settings.schedule.length === 7 ? state.settings.schedule : "-------";

  const set = (day: number, value: DayPlan) =>
    void updateState((s) => {
      const base = s.settings.schedule && s.settings.schedule.length === 7 ? s.settings.schedule : "-------";
      const next = base.slice(0, day) + value + base.slice(day + 1);
      return { ...s, settings: { ...s.settings, schedule: next === "-------" ? null : next } };
    });

  return (
    <>
      <Header title="Mon planning" />
      <p className="-mt-2 mb-4 text-sm font-medium text-mute">
        Choisis ton équipe pour chaque jour. L&apos;écran « Aujourd&apos;hui » et tes rappels ne montrent que les tâches de ton équipe.
        Relève à {formatMinutes(state.settings.handover)} (modifiable dans <Link href="/reglages" className="font-bold text-pink-deep underline">Réglages</Link>).
      </p>
      <ul className="space-y-3">
        {DAY_LONG.map((name, day) => (
          <li key={name} className="rounded-3xl bg-white p-3 shadow-card">
            <p className="mb-2 text-lg font-extrabold capitalize">{name}</p>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={`Équipe du ${name}`}>
              {CHOICES.map((c) => {
                const on = current[day] === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set(day, on ? "-" : c.value)}
                    className={`min-h-12 rounded-2xl border-2 px-1 text-sm font-bold ${on ? "border-pink bg-pink text-white" : "border-line bg-white"}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-center text-xs text-mute">Touche une case choisie pour l&apos;enlever. Un jour sans équipe affiche toutes les tâches.</p>
    </>
  );
}
