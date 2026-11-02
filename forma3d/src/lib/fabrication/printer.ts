/** Volume d'impression (module sans Three.js : importable partout sans alourdir la page). */
export interface PrinterVolume {
  x: number;
  y: number;
  /** Hauteur d'impression maximale. */
  z: number;
}

export const DEFAULT_PRINTER: PrinterVolume = { x: 220, y: 220, z: 250 };
