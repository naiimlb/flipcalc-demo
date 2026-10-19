import { masteryOf, passageKey, type Mastery, type PassageRef, type TajweedError } from "./analyze";
import type { RuleId } from "./rules";

/** Ligne de la table tajweed_sessions. */
export type SessionRow = {
  id: string;
  surah: number;
  verse_start: number;
  verse_end: number;
  word_start: number | null;
  word_end: number | null;
  attempt_number: number;
  correct_words: number;
  total_words: number;
  errors: TajweedError[];
  created_at: string;
};

export const refOfRow = (r: SessionRow): PassageRef => ({
  surah: r.surah,
  verseStart: r.verse_start,
  verseEnd: r.verse_end,
  wordStart: r.word_start,
  wordEnd: r.word_end,
});

export type PassageSummary = {
  key: string;
  ref: PassageRef;
  attempts: number;
  best: number;
  last: number;
  lastAt: string;
  mastery: Mastery;
  /** Scores (0..1) essai après essai, du plus ancien au plus récent. */
  scores: number[];
};

const ratio = (r: SessionRow) => r.correct_words / r.total_words;

/** Regroupe les essais par passage (plus récent d'abord). */
export function summarizePassages(rows: SessionRow[]): PassageSummary[] {
  const byKey = new Map<string, SessionRow[]>();
  for (const r of rows) {
    const key = passageKey(refOfRow(r));
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }
  const out: PassageSummary[] = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const scores = sorted.map(ratio);
    const best = Math.max(...scores);
    const lastRow = sorted[sorted.length - 1];
    out.push({
      key,
      ref: refOfRow(lastRow),
      attempts: sorted.length,
      best,
      last: scores[scores.length - 1],
      lastAt: lastRow.created_at,
      mastery: masteryOf(best),
      scores,
    });
  }
  return out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Règles le plus souvent liées à une erreur (« Tes points faibles »). */
export function weakRules(rows: SessionRow[], limit = 3): { rule: RuleId; count: number }[] {
  const counts = new Map<RuleId, number>();
  for (const r of rows) {
    for (const e of r.errors ?? []) {
      if (e.rule) counts.set(e.rule, (counts.get(e.rule) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([rule, count]) => ({ rule, count }));
}

/** Erreurs corrigées et récurrentes d'un passage, d'après ses essais chronologiques. */
export function errorEvolution(rows: SessionRow[]): { corrected: number[]; recurring: number[] } {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (sorted.length < 2) return { corrected: [], recurring: [] };
  const idx = (r: SessionRow) => new Set((r.errors ?? []).filter((e) => e.type !== "added").map((e) => e.index));
  const last = idx(sorted[sorted.length - 1]);
  const earlier = new Set(sorted.slice(0, -1).flatMap((r) => [...idx(r)]));
  return {
    corrected: [...earlier].filter((i) => !last.has(i)).sort((a, b) => a - b),
    recurring: [...last].filter((i) => earlier.has(i)).sort((a, b) => a - b),
  };
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Série de jours consécutifs d'activité se terminant aujourd'hui (ou hier, pour ne pas
 * casser la série avant la pratique du jour). Calculée dans le fuseau de l'appareil.
 */
export function streakDays(dates: (string | Date)[], now = new Date()): number {
  const days = new Set(dates.map((d) => dayKey(new Date(d))));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
