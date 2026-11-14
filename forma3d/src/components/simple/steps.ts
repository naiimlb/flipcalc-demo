import type { StreamProgress } from "@/lib/design/partial-json";

/** Les 4 étapes montrées pendant la génération, en langage courant. */
export const GENERATION_STEPS = [
  "J'analyse votre besoin",
  "Je dimensionne la pièce",
  "Je construis le modèle 3D",
  "Je vérifie qu'elle est imprimable",
] as const;

/** Étape en cours (0 à 3) selon l'avancement diffusé par le serveur. */
export function currentStep(progress: StreamProgress | null): number {
  if (!progress) return 0;
  if (progress.stage === "saving") return 3;
  if (progress.stage === "writing") {
    if (progress.done.includes("model")) return 3;
    if (progress.done.includes("dimensions")) return 2;
    if (progress.done.includes("analysis") || progress.done.includes("solution")) return 1;
  }
  return 0;
}

/** « 1 min 05 » ou « 42 s ». */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
}
