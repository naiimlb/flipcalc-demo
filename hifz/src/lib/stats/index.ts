import { addDays, diffDays, type DayKey } from "@/lib/srs/dates";
import type { CardState, SrsCard } from "@/lib/srs/types";

export interface Streak {
  /** Jours consécutifs avec au moins une révision, jusqu'à aujourd'hui (ou hier si rien encore aujourd'hui). */
  current: number;
  best: number;
  activeToday: boolean;
}

export function computeStreak(activeDays: Iterable<DayKey>, today: DayKey): Streak {
  const days = new Set(activeDays);
  const activeToday = days.has(today);
  let current = 0;
  let cursor = activeToday ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let previous: DayKey | null = null;
  for (const day of [...days].filter((d) => diffDays(d, today) >= 0).sort()) {
    run = previous !== null && diffDays(previous, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return { current, best: Math.max(best, current), activeToday };
}

export interface DayActivity {
  day: DayKey;
  count: number;
}

/** Révisions par jour sur les `span` derniers jours (du plus ancien à aujourd'hui). */
export function dailyActivity(reviewDays: Iterable<DayKey>, today: DayKey, span = 30): DayActivity[] {
  const counts = new Map<DayKey, number>();
  for (const d of reviewDays) counts.set(d, (counts.get(d) ?? 0) + 1);
  return Array.from({ length: span }, (_, i) => {
    const day = addDays(today, i - span + 1);
    return { day, count: counts.get(day) ?? 0 };
  });
}

/** Part des jours actifs sur la période (0 à 1). */
export function regularity(activity: readonly DayActivity[]): number {
  if (activity.length === 0) return 0;
  return activity.filter((a) => a.count > 0).length / activity.length;
}

export type StateTotals = Record<CardState, number> & { total: number };

export function stateTotals(cards: readonly SrsCard[]): StateTotals {
  const totals: StateTotals = { new: 0, learning: 0, mastered: 0, total: cards.length };
  for (const c of cards) totals[c.state]++;
  return totals;
}

export interface SurahProgress extends StateTotals {
  surah: number;
  /** Part des versets acquis (0 à 1). */
  ratio: number;
}

/** Progression par sourate, dans l'ordre du mushaf. */
export function surahProgress(cards: readonly SrsCard[]): SurahProgress[] {
  const bySurah = new Map<number, SrsCard[]>();
  for (const c of cards) bySurah.set(c.surah, [...(bySurah.get(c.surah) ?? []), c]);
  return [...bySurah.entries()]
    .sort(([a], [b]) => a - b)
    .map(([surah, list]) => {
      const t = stateTotals(list);
      return { surah, ...t, ratio: t.total ? t.mastered / t.total : 0 };
    });
}
