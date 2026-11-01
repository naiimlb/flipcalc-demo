import type { RenderMode } from "../viewer/settings";
import type { LengthUnit } from "./format";

export interface StudioViewer {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: "admin" | "user";
  units: LengthUnit;
  favoriteMaterials: string[];
}

export interface StudioFeatures {
  exportGlb: boolean;
  exportStl: boolean;
  exportPng: boolean;
  imageUpload: boolean;
  newRequests: boolean;
  /** Essai sans compte autorisé. */
  guestTrial: boolean;
  /** Mode Dev visible (admin + réglage activé). */
  devMode: boolean;
}

export interface StudioPrefs {
  mode: RenderMode;
  autoRotate: boolean;
  showGrid: boolean;
  unit: LengthUnit;
}

export const DEFAULT_PREFS: StudioPrefs = { mode: "neon", autoRotate: true, showGrid: true, unit: "mm" };

export type StudioTab = "overview" | "history" | "settings";
