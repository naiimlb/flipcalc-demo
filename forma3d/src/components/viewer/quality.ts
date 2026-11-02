export type ViewerQuality = "low" | "high";

/**
 * Niveau de rendu choisi au démarrage : « low » sur téléphone et appareils modestes
 * (moins de facettes, résolution réduite, pas d'anticrénelage matériel, ombres figées).
 * La visionneuse peut en plus descendre en « low » toute seule si l'affichage rame.
 */
export function detectQuality(): ViewerQuality {
  if (typeof window === "undefined") return "high";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const small = Math.min(window.screen.width, window.screen.height) < 768;
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  return (coarse && small) || weak ? "low" : "high";
}
