import type { Design } from "../design/schema";
import { designVolume } from "./printability";

/**
 * Estimation d'impression 3D : matière (g), durée et coût approximatif.
 * Modèle volontairement simple (coque + remplissage, débit moyen d'une imprimante grand public) :
 * ce sont des ordres de grandeur, le trancheur donnera les vraies valeurs.
 */

export interface PrintMaterial {
  id: string;
  label: string;
  /** Masse volumique en g/cm³. */
  density: number;
  /** Prix indicatif de la matière en € par kg (fourchette). */
  pricePerKg: [number, number];
  note: string;
  resin?: boolean;
}

export const PRINT_MATERIALS: PrintMaterial[] = [
  { id: "pla", label: "PLA", density: 1.24, pricePerKg: [18, 26], note: "Facile à imprimer, intérieur uniquement (ramollit vers 55 °C)." },
  { id: "petg", label: "PETG", density: 1.27, pricePerKg: [20, 28], note: "Solide, résiste à l'humidité et un peu à la chaleur." },
  { id: "abs", label: "ABS", density: 1.04, pricePerKg: [20, 28], note: "Résiste à la chaleur ; demande une imprimante fermée." },
  { id: "asa", label: "ASA", density: 1.07, pricePerKg: [25, 38], note: "Pour l'extérieur : résiste aux UV et aux intempéries." },
  { id: "tpu", label: "TPU (souple)", density: 1.21, pricePerKg: [30, 45], note: "Souple et amortissant ; impression lente." },
  { id: "nylon", label: "Nylon (PA)", density: 1.14, pricePerKg: [40, 65], note: "Très résistant à l'usure ; sensible à l'humidité." },
  { id: "resine", label: "Résine (SLA)", density: 1.12, pricePerKg: [30, 50], note: "Détails très fins ; post-traitement (lavage, UV) obligatoire.", resin: true },
];

export interface PrintSettings {
  material: string;
  /** Taux de remplissage, de 0,05 à 1. */
  infill: number;
  /** Hauteur de couche en mm. */
  layerHeight: number;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = { material: "pla", infill: 0.2, layerHeight: 0.2 };

export interface PrintEstimate {
  material: PrintMaterial;
  /** Volume plein de l'objet (cm³). */
  solidVolume: number;
  /** Volume de matière réellement déposée (cm³), supports compris. */
  printedVolume: number;
  massGrams: number;
  minutes: number;
  layers: number;
  cost: { min: number; max: number };
  supportsIncluded: boolean;
}

/** Épaisseur de la coque (parois + dessus/dessous), en mm. */
const SHELL = 1.0;
/** Puissance moyenne d'une imprimante grand public (kW) et prix de l'électricité (€/kWh). */
const POWER_KW = 0.12;
const KWH_PRICE = 0.25;

/** Débit moyen réaliste (mm³/s), accélérations et déplacements compris, selon la hauteur de couche. */
function flowFor(layerHeight: number): number {
  return Math.max(2.5, Math.min(10, layerHeight * 30));
}

export function findPrintMaterial(id: string): PrintMaterial {
  return PRINT_MATERIALS.find((m) => m.id === id) ?? PRINT_MATERIALS[0];
}

/** Matière d'impression correspondant à une matière conseillée par l'IA (« PETG », « PLA+ »…), si elle en est une. */
export function guessPrintMaterial(name: string | undefined | null): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (/r[ée]sine/.test(n)) return "resine";
  if (/petg/.test(n)) return "petg";
  if (/\basa\b/.test(n)) return "asa";
  if (/\babs\b/.test(n)) return "abs";
  if (/tpu|flex/.test(n)) return "tpu";
  if (/nylon|\bpa\b|pa12|pa6/.test(n)) return "nylon";
  if (/pla/.test(n)) return "pla";
  return null;
}

/** Matière d'impression par défaut : la première matière conseillée qui s'imprime, sinon PLA. */
export function defaultPrintMaterial(design: Design | null): string {
  for (const m of design?.materiaux_conseilles ?? []) {
    const id = guessPrintMaterial(m.nom);
    if (id) return id;
  }
  return "pla";
}

export function estimatePrint(
  design: Design,
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS,
  options: { supportsNeeded?: boolean; height?: number } = {},
): PrintEstimate {
  const material = findPrintMaterial(settings.material);
  const infill = Math.min(1, Math.max(0.05, settings.infill));
  const layerHeight = Math.min(0.4, Math.max(0.05, settings.layerHeight));
  const { volume, area } = designVolume(design);

  // Coque pleine + remplissage partiel de l'intérieur ; la résine est imprimée pleine.
  const shell = Math.min(volume, area * SHELL);
  let printed = material.resin ? volume : shell + infill * Math.max(0, volume - shell);
  if (options.supportsNeeded) printed *= 1.12; // supports : environ 12 % de matière en plus
  const height = options.height ?? design.dimensions.height;
  const layers = Math.max(1, Math.ceil(height / layerHeight));

  let seconds: number;
  if (material.resin) {
    // Résine : la durée dépend surtout de la hauteur (≈ 8 s par couche de 0,05 mm).
    seconds = Math.ceil(height / 0.05) * 8 + 10 * 60;
  } else {
    seconds = printed / flowFor(layerHeight) + layers * 2 + 6 * 60; // dépôt + changements de couche + chauffe
  }
  const minutes = Math.max(5, Math.round(seconds / 60));
  const massGrams = (printed / 1000) * material.density;
  const energy = (minutes / 60) * POWER_KW * KWH_PRICE;
  const kg = massGrams / 1000;

  return {
    material,
    solidVolume: volume / 1000,
    printedVolume: printed / 1000,
    massGrams,
    minutes,
    layers,
    cost: { min: kg * material.pricePerKg[0] + energy, max: kg * material.pricePerKg[1] + energy },
    supportsIncluded: Boolean(options.supportsNeeded),
  };
}
