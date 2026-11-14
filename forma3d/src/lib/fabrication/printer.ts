/** Volume d'impression (module sans Three.js : importable partout sans alourdir la page). */
export interface PrinterVolume {
  x: number;
  y: number;
  /** Hauteur d'impression maximale. */
  z: number;
}

export const DEFAULT_PRINTER: PrinterVolume = { x: 220, y: 220, z: 250 };

/** Imprimantes courantes et leur volume d'impression (mm, données constructeur ; modifiables en saisie manuelle). */
export interface PrinterPreset {
  id: string;
  name: string;
  volume: PrinterVolume;
}

export const PRINTER_PRESETS: PrinterPreset[] = [
  { id: "bambu-a1", name: "Bambu Lab A1", volume: { x: 256, y: 256, z: 256 } },
  { id: "bambu-p1s", name: "Bambu Lab P1S", volume: { x: 256, y: 256, z: 256 } },
  { id: "bambu-x1", name: "Bambu Lab X1", volume: { x: 256, y: 256, z: 256 } },
  { id: "ender-3-v3", name: "Creality Ender-3 V3", volume: { x: 220, y: 220, z: 250 } },
  { id: "prusa-mk4", name: "Prusa MK4", volume: { x: 250, y: 210, z: 220 } },
  { id: "elegoo-neptune-4", name: "Elegoo Neptune 4", volume: { x: 225, y: 225, z: 265 } },
  { id: "anycubic-kobra-3", name: "Anycubic Kobra 3", volume: { x: 250, y: 250, z: 260 } },
];

export function findPrinterPreset(id: string | null | undefined): PrinterPreset | null {
  return PRINTER_PRESETS.find((p) => p.id === id) ?? null;
}
