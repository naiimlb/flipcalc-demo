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
  // Rendu réaliste par défaut ; le rendu néon reste une option.
  mode: "real",
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
// Fonds unis et neutres (gris clair / anthracite) ; seul le rendu néon, en option, garde un fond coloré.
export const VIEWER_BACKGROUNDS: Record<RenderMode, string[]> = {
  neon: ["#5468e8", "#3a2ba6", "#7a45d6"],
  real: ["#e9ebef", "#e9ebef", "#e9ebef"],
};

/** Anthracite pour le rendu réaliste en thème sombre. */
const REAL_DARK = ["#1c1d21", "#1c1d21", "#1c1d21"];

const BACKGROUNDS: Record<Exclude<ViewerBackground, "auto">, string[]> = {
  night: ["#141518", "#141518", "#141518"],
  light: ["#f3f4f6", "#f3f4f6", "#f3f4f6"],
  neon: VIEWER_BACKGROUNDS.neon,
};

/** Couleurs du fond (dégradé en 3 arrêts), partagées par la vue, la capture PNG et la vidéo 360°. */
export function viewerBackgroundStops(mode: RenderMode, dark = false, background: ViewerBackground = "auto"): string[] {
  if (background !== "auto") return BACKGROUNDS[background];
  return mode === "real" && dark ? REAL_DARK : VIEWER_BACKGROUNDS[mode];
}

export function viewerBackgroundCss(mode: RenderMode, dark = false, background: ViewerBackground = "auto") {
  const [a, b, c] = viewerBackgroundStops(mode, dark, background);
  if (a === b && b === c) return a;
  return `radial-gradient(120% 90% at 25% 10%, ${a} 0%, ${b} 55%, ${c} 100%)`;
}
