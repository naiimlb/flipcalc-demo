/** Étapes affichées pendant une tâche Meshy : Analyse → Génération → Texturage → Prêt. */
export type MeshyStatus = "pending" | "running" | "succeeded" | "failed";

export const MESHY_STAGE_KEYS = ["meshy.stage.analyze", "meshy.stage.generate", "meshy.stage.texture", "meshy.stage.ready"] as const;

/**
 * Étape en cours (0 à 3) d'après l'action Meshy et son état.
 * - tâche encore en file d'attente (0 %) : Analyse (contrôle de la demande, du solde et de la file) ;
 * - nouveau modèle, simplification, mise à l'échelle, réparation : Génération ;
 * - texture et retexturage : Texturage ;
 * - tâche réussie : Prêt.
 */
export function meshyStageIndex(kind: string | undefined, status: MeshyStatus, progress = 0): 0 | 1 | 2 | 3 {
  if (status === "succeeded") return 3;
  if (status === "pending" && progress <= 0) return 0;
  if (kind === "refine" || kind === "retexture") return 2;
  return 1;
}

/** Pourcentage borné pour la barre d'avancement. */
export function clampProgress(progress: number): number {
  return Number.isFinite(progress) ? Math.min(100, Math.max(0, Math.round(progress))) : 0;
}
