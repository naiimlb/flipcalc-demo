import type { MaterialKind } from "@/lib/design/schema";

/* Réglages de la visionneuse, séparés du composant 3D pour ne pas charger Three.js inutilement. */

export type RenderMode = "neon" | "real";
/** Préréglages d'éclairage du rendu réaliste. */
export type LightingPreset = "studio" | "neon" | "day";
/** Fond de la vue 3D : « auto » suit le mode (néon ou studio clair / sombre). */
export type ViewerBackground = "auto" | "night" | "light" | "neon";

export interface ViewerSettings {
  mode: RenderMode;
  wireframe: boolean;
  exploded: boolean;
  autoRotate: boolean;
  showGrid: boolean;
  colorOverride: string | null;
  materialOverride: MaterialKind | null;
  lighting?: LightingPreset;
  background?: ViewerBackground;
  /** Ombres douces au sol (rendu réaliste). */
  shadows?: boolean;
}

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  mode: "neon",
  wireframe: false,
  exploded: false,
  autoRotate: true,
  showGrid: true,
  colorOverride: null,
  materialOverride: null,
  lighting: "studio",
  background: "auto",
  shadows: true,
};

export interface ViewerHandle {
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  /** Cadre la vue sur une pièce (ou sur tout le modèle). */
  frame?(partId: string | null): void;
  capturePng(): Promise<Blob | null>;
  /** Vidéo d'un tour complet (360°) de la caméra autour du modèle. */
  recordTurntable?(seconds: number): Promise<Blob | null>;
}

/** Fonds de la visionneuse (CSS et capture PNG partagent les mêmes couleurs). */
export const VIEWER_BACKGROUNDS: Record<RenderMode, string[]> = {
  neon: ["#5468e8", "#3a2ba6", "#7a45d6"],
  real: ["#f6f7ff", "#e2e4f8", "#d3d6f2"],
};

/** Studio sombre pour le rendu réaliste en mode sombre. */
const REAL_DARK = ["#3a3d5c", "#24263d", "#191a2c"];

const BACKGROUNDS: Record<Exclude<ViewerBackground, "auto">, string[]> = {
  night: ["#1a1d2b", "#0d0f17", "#05060a"],
  light: ["#ffffff", "#eef0f6", "#dfe3ee"],
  neon: VIEWER_BACKGROUNDS.neon,
};

/** Couleurs du fond (dégradé en 3 arrêts), partagées par la vue, la capture PNG et la vidéo 360°. */
export function viewerBackgroundStops(mode: RenderMode, dark = false, background: ViewerBackground = "auto"): string[] {
  if (background !== "auto") return BACKGROUNDS[background];
  return mode === "real" && dark ? REAL_DARK : VIEWER_BACKGROUNDS[mode];
}

export function viewerBackgroundCss(mode: RenderMode, dark = false, background: ViewerBackground = "auto") {
  const [a, b, c] = viewerBackgroundStops(mode, dark, background);
  return `radial-gradient(120% 90% at 25% 10%, ${a} 0%, ${b} 55%, ${c} 100%)`;
}
