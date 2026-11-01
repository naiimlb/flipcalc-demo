import type { RenderMode } from "../viewer/settings";
import type { LengthUnit } from "./format";

export interface StudioViewer {
  email: string;
  displayName: string | null;
  role: "admin" | "user";
}

export interface StudioFeatures {
  exportGlb: boolean;
  exportStl: boolean;
  exportPng: boolean;
  imageUpload: boolean;
  newRequests: boolean;
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
