/**
 * Répétition espacée verset par verset : SM-2 adapté à trois boutons.
 *
 *  - « Je sais » (good, q=5)     : facilité +0,10 ; intervalles 1 j, 3 j, puis intervalle × facilité.
 *  - « Hésitant » (hard, q=3)    : facilité −0,14 ; intervalles 1 j, 2 j, puis intervalle × 1,2.
 *  - « À revoir » (again)        : facilité −0,20 (plancher 1,3), retour à demain, série remise à zéro
 *                                  (sans pénalité si le verset n'avait encore jamais été réussi).
 *
 * Retards : si le verset est su malgré le retard, une partie des jours de retard est créditée
 * (moitié pour « Je sais », quart pour « Hésitant ») : on n'est pas pénalisé d'être revenu tard.
 * Révision en avance : l'intervalle ne diminue jamais, et la série n'est pas augmentée.
 * Même jour : une seule révision compte ; une nouvelle note le même jour ne peut que rapprocher
 * la révision suivante (un « À revoir » après une réussite), jamais l'éloigner ni pénaliser deux fois.
 *
 * Un verset est « acquis » dès que son intervalle atteint 21 jours ; un échec le repasse « en cours ».
 * Tout est déterministe (pas d'aléa) et la date du jour est passée en paramètre.
 */
import { addDays, diffDays, type DayKey } from "./dates";
import type { Grade, SrsCard, SrsConfig } from "./types";

export const DEFAULT_SRS_CONFIG: SrsConfig = {
  initialEase: 2.5,
  minEase: 1.3,
  maxEase: 3.0,
  easeDelta: { good: 0.1, hard: -0.14, again: -0.2 },
  firstIntervals: { good: [1, 3], hard: [1, 2] },
  hardFactor: 1.2,
  lateCredit: { good: 0.5, hard: 0.25 },
  masteredInterval: 21,
  maxInterval: 180,
};

export function createCard(surah: number, ayah: number, rank: number, config: SrsConfig = DEFAULT_SRS_CONFIG): SrsCard {
  return {
    key: `${surah}:${ayah}`,
    surah,
    ayah,
    rank,
    state: "new",
    ease: config.initialEase,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: null,
    lastReview: null,
    lastGrade: null,
    introduced: null,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function clampEase(ease: number, config: SrsConfig): number {
  return round2(Math.min(config.maxEase, Math.max(config.minEase, ease)));
}

function stateFor(interval: number, config: SrsConfig): SrsCard["state"] {
  return interval >= config.masteredInterval ? "mastered" : "learning";
}

/**
 * Échec : retour à demain et série remise à zéro. La facilité n'est pénalisée (et l'échec compté)
 * que pour un verset déjà appris : rater la toute première récitation fait partie de l'apprentissage.
 */
function lapse(card: SrsCard, today: DayKey, config: SrsConfig): SrsCard {
  const learned = card.reps > 0 || card.lapses > 0;
  return {
    ...card,
    state: "learning",
    ease: learned ? clampEase(card.ease + config.easeDelta.again, config) : card.ease,
    interval: 1,
    reps: 0,
    lapses: learned ? card.lapses + 1 : card.lapses,
    due: addDays(today, 1),
    lastReview: today,
    lastGrade: "again",
    introduced: card.introduced ?? today,
  };
}

/** Intervalle (en jours) après une réussite, pour une base donnée. */
function successInterval(
  grade: "good" | "hard",
  reps: number,
  base: number,
  ease: number,
  config: SrsConfig,
): number {
  if (reps < 2) return config.firstIntervals[grade][reps]!;
  const hard = Math.max(Math.round(base * config.hardFactor), Math.ceil(base) + 1);
  if (grade === "hard") return hard;
  return Math.max(Math.round(base * ease), hard + 1);
}

/**
 * Calcule la nouvelle fiche après une auto-évaluation.
 * Fonction pure : `card` n'est pas modifiée.
 */
export function schedule(card: SrsCard, grade: Grade, today: DayKey, config: SrsConfig = DEFAULT_SRS_CONFIG): SrsCard {
  // Même jour : une seule révision compte.
  if (card.lastReview === today) {
    if (grade !== "again") return card;
    return card.lastGrade === "again" ? card : lapse(card, today, config);
  }

  if (grade === "again") return lapse(card, today, config);

  const ease = clampEase(card.ease + config.easeDelta[grade], config);

  // Révision en avance (avant la date prévue) : on garde au moins l'intervalle actuel.
  if (card.due && card.lastReview && diffDays(today, card.due) > 0) {
    const elapsed = Math.max(1, diffDays(card.lastReview, today));
    const factor = grade === "good" ? card.ease : config.hardFactor;
    const interval = Math.min(config.maxInterval, Math.max(card.interval, Math.round(elapsed * factor)));
    return {
      ...card,
      interval,
      state: stateFor(interval, config),
      due: addDays(today, interval),
      lastReview: today,
      lastGrade: grade,
    };
  }

  const daysLate = card.due ? Math.max(0, diffDays(card.due, today)) : 0;
  const base = card.interval + daysLate * config.lateCredit[grade];
  const interval = Math.min(config.maxInterval, successInterval(grade, card.reps, base, ease, config));

  return {
    ...card,
    state: stateFor(interval, config),
    ease,
    interval,
    reps: card.reps + 1,
    due: addDays(today, interval),
    lastReview: today,
    lastGrade: grade,
    introduced: card.introduced ?? today,
  };
}

/** Le verset est-il à réviser ce jour-là ? */
export function isDue(card: SrsCard, today: DayKey): boolean {
  return card.state !== "new" && card.due !== null && diffDays(card.due, today) >= 0;
}

/** Jours de retard (0 si à jour ou pas encore dû). */
export function overdueDays(card: SrsCard, today: DayKey): number {
  return card.due ? Math.max(0, diffDays(card.due, today)) : 0;
}
