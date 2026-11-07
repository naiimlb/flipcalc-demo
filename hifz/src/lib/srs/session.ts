import type { DayKey } from "./dates";
import { isDue, overdueDays } from "./scheduler";
import type { SrsCard } from "./types";

export interface SessionOptions {
  today: DayKey;
  /** Nombre maximum de nouveaux versets par jour. */
  newLimit: number;
  /** Nouveaux versets déjà commencés aujourd'hui (comptent dans la limite). */
  introducedToday: number;
  /** Plafond facultatif de révisions (les plus en retard sont gardées). */
  maxReviews?: number;
}

export interface DailySession {
  /** Versets à réviser, dans l'ordre de récitation (programme puis mushaf). */
  reviews: SrsCard[];
  /** Nouveaux versets à découvrir puis réciter. */
  fresh: SrsCard[];
}

const byRank = (a: SrsCard, b: SrsCard) => a.rank - b.rank;

/**
 * Session du jour : tous les versets dus (ou les `maxReviews` plus en retard), récités dans
 * l'ordre du mushaf pour garder l'enchaînement, puis quelques nouveaux versets dans l'ordre du programme.
 */
export function buildSession(cards: readonly SrsCard[], options: SessionOptions): DailySession {
  const { today, newLimit, introducedToday, maxReviews } = options;
  let reviews = cards.filter((c) => isDue(c, today));
  if (maxReviews !== undefined && reviews.length > maxReviews) {
    reviews = [...reviews]
      .sort((a, b) => overdueDays(b, today) - overdueDays(a, today) || byRank(a, b))
      .slice(0, Math.max(0, maxReviews));
  }
  const remainingNew = Math.max(0, Math.floor(newLimit) - introducedToday);
  const fresh = cards
    .filter((c) => c.state === "new")
    .sort(byRank)
    .slice(0, remainingNew);
  return { reviews: [...reviews].sort(byRank), fresh };
}

/** Nombre de nouveaux versets commencés ce jour-là. */
export function countIntroducedOn(cards: readonly SrsCard[], day: DayKey): number {
  return cards.filter((c) => c.introduced === day).length;
}
