import type { DailySession, Grade, SrsCard } from "@/lib/srs";

export type ItemKind = "new" | "review" | "retry";

export interface QueueItem {
  key: string;
  surah: number;
  ayah: number;
  kind: ItemKind;
}

export interface QueueState {
  items: QueueItem[];
  index: number;
  /** Notes de la première présentation de chaque verset. */
  results: Record<Grade, number>;
}

const toItem = (c: SrsCard, kind: ItemKind): QueueItem => ({ key: c.key, surah: c.surah, ayah: c.ayah, kind });

/** Révisions d'abord (ordre du mushaf), puis nouveaux versets. */
export function startQueue(session: DailySession): QueueState {
  return {
    items: [...session.reviews.map((c) => toItem(c, "review")), ...session.fresh.map((c) => toItem(c, "new"))],
    index: 0,
    results: { good: 0, hard: 0, again: 0 },
  };
}

export function currentItem(state: QueueState): QueueItem | undefined {
  return state.items[state.index];
}

export function isFinished(state: QueueState): boolean {
  return state.index >= state.items.length;
}

/**
 * Passe au verset suivant. Un verset « À revoir » est reproposé une fois en fin de session
 * (sa prochaine révision reste fixée à demain par l'algorithme).
 */
export function gradeCurrent(state: QueueState, grade: Grade): QueueState {
  const item = currentItem(state);
  if (!item) return state;
  const items = [...state.items];
  const alreadyRetried = items.some((i) => i.key === item.key && i.kind === "retry");
  if (grade === "again" && item.kind !== "retry" && !alreadyRetried) items.push({ ...item, kind: "retry" });
  const results = item.kind === "retry" ? state.results : { ...state.results, [grade]: state.results[grade] + 1 };
  return { items, index: state.index + 1, results };
}
