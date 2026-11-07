import type { DayKey } from "./dates";

/** Auto-évaluation après récitation : « Je sais », « Hésitant », « À revoir ». */
export type Grade = "good" | "hard" | "again";

/** nouveau → en cours → acquis. */
export type CardState = "new" | "learning" | "mastered";

/** Fiche de révision d'un verset. */
export interface SrsCard {
  /** Clé du verset, « sourate:verset ». */
  key: string;
  surah: number;
  ayah: number;
  /** Ordre d'introduction des nouveaux versets (programme puis ordre du mushaf). */
  rank: number;
  state: CardState;
  /** Facteur de facilité (SM-2). */
  ease: number;
  /** Intervalle courant, en jours. */
  interval: number;
  /** Réussites consécutives depuis le dernier échec. */
  reps: number;
  /** Nombre d'échecs (« À revoir ») après la première réussite ou non. */
  lapses: number;
  /** Prochaine révision (null tant que le verset est nouveau). */
  due: DayKey | null;
  lastReview: DayKey | null;
  lastGrade: Grade | null;
  /** Jour où le verset a été appris (première évaluation). */
  introduced: DayKey | null;
}

export interface SrsConfig {
  initialEase: number;
  minEase: number;
  maxEase: number;
  /** Variation de facilité par note (SM-2 pour good/hard, pénalité fixe pour again). */
  easeDelta: Record<Grade, number>;
  /** Intervalles des deux premières réussites (good, hard). */
  firstIntervals: { good: [number, number]; hard: [number, number] };
  /** Multiplicateur d'intervalle pour « Hésitant ». */
  hardFactor: number;
  /** Part du retard créditée quand on sait encore (good, hard). */
  lateCredit: { good: number; hard: number };
  /** Intervalle à partir duquel un verset est « acquis ». */
  masteredInterval: number;
  /** Plafond : un verset acquis revient au moins tous les N jours. */
  maxInterval: number;
}
