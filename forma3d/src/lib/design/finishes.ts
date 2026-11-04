import type { Finish, MaterialKind } from "./schema";

/**
 * Bibliothèque de matières de l'éditeur : aspect réaliste dans la vue 3D, matière d'export associée,
 * couleur proposée. Les noms affichés sont traduits (clé « finish.<id> »).
 */
export interface FinishPreset {
  id: Finish;
  kind: MaterialKind;
  color: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  opacity: number;
}

export const FINISH_PRESETS: Record<Finish, FinishPreset> = {
  pla: { id: "pla", kind: "plastic", color: "#2f6bff", roughness: 0.45, metalness: 0, clearcoat: 0.25, opacity: 1 },
  petg: { id: "petg", kind: "plastic", color: "#3fb8a6", roughness: 0.22, metalness: 0, clearcoat: 0.6, opacity: 0.92 },
  abs: { id: "abs", kind: "plastic", color: "#2a2d36", roughness: 0.6, metalness: 0, clearcoat: 0.1, opacity: 1 },
  resin: { id: "resin", kind: "plastic", color: "#d8dde8", roughness: 0.12, metalness: 0, clearcoat: 0.9, opacity: 0.85 },
  wood: { id: "wood", kind: "wood", color: "#b07a4a", roughness: 0.75, metalness: 0, clearcoat: 0.05, opacity: 1 },
  metal: { id: "metal", kind: "metal", color: "#b9bfcc", roughness: 0.28, metalness: 1, clearcoat: 0, opacity: 1 },
  glass: { id: "glass", kind: "glass", color: "#cfe6ff", roughness: 0.05, metalness: 0, clearcoat: 1, opacity: 0.38 },
  rubber: { id: "rubber", kind: "rubber", color: "#1d1f26", roughness: 0.95, metalness: 0, clearcoat: 0, opacity: 1 },
};
