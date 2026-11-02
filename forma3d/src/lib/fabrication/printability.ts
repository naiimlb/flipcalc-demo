import type { Design, Part } from "../design/schema";
import { ORIENTATIONS, buildPartMeshes, meshesBounds, volumeAndArea, type PartMesh } from "./mesh";
import { DEFAULT_PRINTER, type PrinterVolume } from "./printer";

/**
 * Contrôle d'imprimabilité (impression 3D par dépôt de filament) :
 * encombrement par rapport au volume d'impression, épaisseur des parois, porte-à-faux et supports,
 * stabilité, et orientation d'impression conseillée. Ce sont des vérifications géométriques simples :
 * le trancheur (Cura, PrusaSlicer, Bambu Studio…) reste la référence.
 */

export { DEFAULT_PRINTER, type PrinterVolume };

/** Épaisseur de paroi : en dessous, avertissement ; très en dessous, erreur (buse de 0,4 mm). */
export const MIN_WALL = 1.2;
export const CRITICAL_WALL = 0.8;
/** Angle de porte-à-faux toléré sans support, mesuré depuis la verticale. */
export const OVERHANG_ANGLE = 45;

export type IssueLevel = "error" | "warning" | "info";

export interface PrintIssue {
  level: IssueLevel;
  code: "size" | "thin" | "supports" | "stability" | "material" | "floating";
  title: string;
  detail: string;
  fix: string;
  partIds?: string[];
}

export interface OrientationResult {
  id: string;
  label: string;
  size: { width: number; depth: number; height: number };
  fits: boolean;
  overhangArea: number;
  supportsNeeded: boolean;
}

export interface PrintabilityReport {
  size: { width: number; depth: number; height: number };
  fits: boolean;
  /** Facteur d'échelle (≤ 1) pour tenir dans le volume, si l'objet est trop grand. */
  scaleToFit: number | null;
  thinParts: { id: string; name: string; thickness: number }[];
  overhangArea: number;
  overhangRatio: number;
  supportsNeeded: boolean;
  orientations: OrientationResult[];
  best: OrientationResult;
  issues: PrintIssue[];
  verdict: "ok" | "warning" | "error";
}

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
const fmt = (n: number) => round(n, n < 10 ? 1 : 0).toLocaleString("fr-FR");

/** Épaisseur la plus faible d'une pièce, d'après sa forme. */
export function partThickness(part: Part): number {
  const { x, y, z } = part.size;
  switch (part.shape) {
    case "box":
      return Math.min(x, y, z);
    case "cylinder":
    case "cone":
      return Math.min(x, y);
    case "sphere":
    case "capsule":
      return x;
    case "torus":
      return 2 * Math.max(0.25, Math.min(y / 2, x / 4));
    case "tube": {
      const outer = x / 2;
      return Math.min(Math.min(Math.max(z, 0.4), outer * 0.95), y);
    }
    case "extrusion": {
      const depth = Math.max(z, 0.5);
      if (part.profile.length < 3) return Math.min(x, y, z);
      const xs = part.profile.map((p) => p.x);
      const ys = part.profile.map((p) => p.y);
      return Math.min(depth, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    }
  }
}

/** Surface des faces orientées vers le bas à plus de 45° de la verticale, hors plateau et hors appui sur une autre pièce. */
export function overhangArea(meshes: PartMesh[]): { overhang: number; total: number } {
  const threshold = Math.cos((OVERHANG_ANGLE * Math.PI) / 180); // composante verticale de la normale
  let overhang = 0;
  let total = 0;
  for (const mesh of meshes) {
    const p = mesh.positions;
    for (let i = 0; i < p.length; i += 9) {
      const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
      const vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len < 1e-9) continue;
      const area = len / 2;
      total += area;
      if (-ny / len <= threshold) continue; // pas tournée vers le bas (ou pente douce)
      const cy = (p[i + 1] + p[i + 4] + p[i + 7]) / 3;
      if (cy < 0.4) continue; // posée sur le plateau
      const cx = (p[i] + p[i + 3] + p[i + 6]) / 3;
      const cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
      // Appuyée sur le dessus d'une autre pièce juste en dessous.
      const supported = meshes.some(
        (other) =>
          other !== mesh &&
          cx >= other.box.min.x - 0.5 &&
          cx <= other.box.max.x + 0.5 &&
          cz >= other.box.min.z - 0.5 &&
          cz <= other.box.max.z + 0.5 &&
          other.box.max.y >= cy - 1 &&
          other.box.min.y < cy - 0.2,
      );
      if (!supported) overhang += area;
    }
  }
  return { overhang, total };
}

function supportsFor(overhang: number, total: number): boolean {
  return overhang > Math.max(25, total * 0.015);
}

function fitsIn(size: { width: number; depth: number; height: number }, printer: PrinterVolume): boolean {
  if (size.height > printer.z + 0.01) return false;
  return (size.width <= printer.x + 0.01 && size.depth <= printer.y + 0.01) || (size.width <= printer.y + 0.01 && size.depth <= printer.x + 0.01);
}

function evaluate(design: Design, printer: PrinterVolume, orientation: (typeof ORIENTATIONS)[number]): OrientationResult & { meshes: PartMesh[]; total: number } {
  const meshes = buildPartMeshes(design, orientation.matrix());
  const bounds = meshesBounds(meshes);
  const size = { width: bounds.max.x - bounds.min.x, depth: bounds.max.z - bounds.min.z, height: bounds.max.y - bounds.min.y };
  const { overhang, total } = overhangArea(meshes);
  return {
    id: orientation.id,
    label: orientation.label,
    size,
    fits: fitsIn(size, printer),
    overhangArea: overhang,
    supportsNeeded: supportsFor(overhang, total),
    meshes,
    total,
  };
}

export function checkPrintability(design: Design, printer: PrinterVolume = DEFAULT_PRINTER): PrintabilityReport {
  const all = ORIENTATIONS.map((o) => evaluate(design, printer, o));
  const current = all[0];
  // Meilleure orientation : d'abord celle qui tient dans le volume, puis la moins de porte-à-faux (l'originale en cas d'égalité).
  const score = (o: OrientationResult) => o.overhangArea - (o === current ? 1 : 0);
  const best = [...all].sort((a, b) => Number(b.fits) - Number(a.fits) || score(a) - score(b))[0];
  const { size } = current;
  const issues: PrintIssue[] = [];

  // 1. Encombrement.
  const anyFits = all.some((o) => o.fits);
  let scaleToFit: number | null = null;
  if (!current.fits) {
    const dims = [size.width, size.depth, size.height].sort((a, b) => b - a);
    const box = [printer.x, printer.y, printer.z].sort((a, b) => b - a);
    scaleToFit = Math.min(1, ...dims.map((d, i) => box[i] / Math.max(d, 1e-6)));
    const tooBig = `${fmt(size.width)} × ${fmt(size.depth)} × ${fmt(size.height)} mm pour un volume de ${printer.x} × ${printer.y} × ${printer.z} mm.`;
    if (anyFits) {
      const fitting = all.find((o) => o.fits)!;
      issues.push({
        level: "warning",
        code: "size",
        title: "Ne tient pas debout dans l'imprimante",
        detail: tooBig,
        fix: `Imprimez-le ${fitting.label} : il tient alors dans le volume d'impression.`,
      });
    } else {
      issues.push({
        level: "error",
        code: "size",
        title: "Trop grand pour le volume d'impression",
        detail: tooBig,
        fix: `Réduisez l'échelle à ${Math.floor(scaleToFit * 100)} % ou découpez l'objet en plusieurs parties (assemblage par collage, vis ou tenons), ou passez par un service d'impression grand format.`,
      });
    }
  }

  // 2. Parois trop fines.
  const thinParts = design.model.parts
    .map((p) => ({ id: p.id, name: p.name, thickness: partThickness(p) }))
    .filter((p) => p.thickness < MIN_WALL);
  if (thinParts.length) {
    const critical = thinParts.some((p) => p.thickness < CRITICAL_WALL);
    issues.push({
      level: critical ? "error" : "warning",
      code: "thin",
      title: critical ? "Parois trop fines pour être imprimées" : "Parois fines (fragiles)",
      detail: thinParts.map((p) => `${p.name} : ${fmt(p.thickness)} mm`).join(" · "),
      fix: `Épaississez ces pièces à ${fmt(MIN_WALL)} mm au minimum (1,6 mm conseillé, soit 4 passes d'une buse de 0,4 mm).`,
      partIds: thinParts.map((p) => p.id),
    });
  }

  // 3. Porte-à-faux et supports.
  const ratio = current.total > 0 ? current.overhangArea / current.total : 0;
  if (current.supportsNeeded) {
    const gain = current.overhangArea > 0 ? 1 - best.overhangArea / current.overhangArea : 0;
    const betterOrientation = best !== current && best.fits && gain > 0.3;
    issues.push({
      level: "warning",
      code: "supports",
      title: "Supports nécessaires",
      detail: `≈ ${fmt(current.overhangArea / 100)} cm² de surfaces en porte-à-faux (plus de ${OVERHANG_ANGLE}° depuis la verticale), soit ${Math.round(ratio * 100)} % de la surface.`,
      fix: betterOrientation
        ? best.supportsNeeded
          ? `Imprimez-le ${best.label} : ${Math.round(gain * 100)} % de supports en moins. Activez les supports « en arbre » dans le trancheur.`
          : `Imprimez-le ${best.label} : il n'a alors plus besoin de supports.`
        : "Activez les supports dans le trancheur (supports « en arbre » conseillés), ou ajoutez des chanfreins à 45° sous les parties en saillie.",
    });
  }

  // 4. Stabilité : objet haut et étroit.
  const base = Math.min(size.width, size.depth);
  if (base > 0 && size.height / base > 4) {
    issues.push({
      level: "warning",
      code: "stability",
      title: "Risque de basculement pendant l'impression",
      detail: `Hauteur ${fmt(size.height)} mm pour une base de ${fmt(base)} mm.`,
      fix: "Ajoutez une bordure (« brim ») de 5 à 8 mm dans le trancheur, ou imprimez l'objet couché.",
    });
  }

  // 5. Matière conseillée non imprimable.
  const main = design.materiaux_conseilles[0];
  if (main && main.aspect !== "plastic" && main.aspect !== "rubber") {
    issues.push({
      level: "info",
      code: "material",
      title: `Matière conseillée : ${main.nom}`,
      detail: "Ce contrôle ne concerne que l'impression 3D. Avec cette matière, suivez plutôt les étapes de fabrication.",
      fix: "Pour imprimer quand même, choisissez une matière plastique dans l'estimation (PETG ou ASA pour l'extérieur).",
    });
  }

  const verdict = issues.some((i) => i.level === "error") ? "error" : issues.some((i) => i.level === "warning") ? "warning" : "ok";
  const strip = (o: OrientationResult): OrientationResult => ({
    id: o.id,
    label: o.label,
    size: o.size,
    fits: o.fits,
    overhangArea: o.overhangArea,
    supportsNeeded: o.supportsNeeded,
  });
  return {
    size,
    fits: current.fits,
    scaleToFit,
    thinParts,
    overhangArea: current.overhangArea,
    overhangRatio: ratio,
    supportsNeeded: current.supportsNeeded,
    orientations: all.map(strip),
    best: strip(best),
    issues,
    verdict,
  };
}

/** Volume et surface totaux de l'objet (mm³, mm²) : somme des pièces. */
export function designVolume(design: Design): { volume: number; area: number } {
  let volume = 0;
  let area = 0;
  for (const m of buildPartMeshes(design)) {
    const r = volumeAndArea(m.positions);
    volume += r.volume;
    area += r.area;
  }
  return { volume, area };
}
