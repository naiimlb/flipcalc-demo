import type { MaterialKind } from "@/lib/design/schema";

/* Réglages de la visionneuse, séparés du composant 3D pour ne pas charger Three.js inutilement. */

export type RenderMode = "neon" | "real";

export interface ViewerSettings {
  mode: RenderMode;
  wireframe: boolean;
  exploded: boolean;
  autoRotate: boolean;
  showGrid: boolean;
  colorOverride: string | null;
  materialOverride: MaterialKind | null;
}

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  mode: "neon",
  wireframe: false,
  exploded: false,
  autoRotate: true,
  showGrid: true,
  colorOverride: null,
  materialOverride: null,
};

export interface ViewerHandle {
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  capturePng(): Promise<Blob | null>;
}

/** Fonds de la visionneuse (CSS et capture PNG partagent les mêmes couleurs). */
export const VIEWER_BACKGROUNDS: Record<RenderMode, string[]> = {
  neon: ["#5468e8", "#3a2ba6", "#7a45d6"],
  real: ["#f6f7ff", "#e2e4f8", "#d3d6f2"],
};

/** Studio sombre pour le rendu réaliste en mode sombre. */
const REAL_DARK = ["#3a3d5c", "#24263d", "#191a2c"];

export function viewerBackgroundCss(mode: RenderMode, dark = false) {
  const [a, b, c] = mode === "real" && dark ? REAL_DARK : VIEWER_BACKGROUNDS[mode];
  return `radial-gradient(120% 90% at 25% 10%, ${a} 0%, ${b} 55%, ${c} 100%)`;
}
