import type { DayPlan } from "@/lib/service";

const LABEL: Record<Exclude<DayPlan, "-">, string> = { J: "☀️ Jour", S: "🌙 Soir", R: "😴 Repos" };

/** Pastille de l'équipe du jour (Jour / Soir / Repos). */
export function TeamBadge({ plan }: { plan: DayPlan | null }) {
  if (!plan || plan === "-") return null;
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${plan === "R" ? "bg-line text-mute" : "bg-ink text-white"}`}>
      {LABEL[plan]}
    </span>
  );
}
