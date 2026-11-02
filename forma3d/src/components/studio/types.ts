import { DEFAULT_PRINTER, type PrinterVolume } from "@/lib/fabrication/printer";
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
  /** Volume d'impression de l'imprimante de l'utilisateur (mm). */
  printer: PrinterVolume;
  /** Réglages d'impression pour l'estimation (matière vide = celle conseillée par l'IA). */
  print: { material: string | null; infill: number; layerHeight: number };
}

export const DEFAULT_PREFS: StudioPrefs = {
  mode: "neon",
  autoRotate: true,
  showGrid: true,
  unit: "mm",
  printer: DEFAULT_PRINTER,
  print: { material: null, infill: 0.2, layerHeight: 0.2 },
};

export type StudioTab = "overview" | "fabrication" | "history" | "settings";
