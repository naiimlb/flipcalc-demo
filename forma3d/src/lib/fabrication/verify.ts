import type { Design } from "../design/schema";
import { buildPartMeshes, meshesBounds, type PartMesh } from "./mesh";
import { CRITICAL_WALL, MIN_WALL, checkPrintability, partThickness } from "./printability";
import { DEFAULT_PRINTER, type PrinterVolume } from "./printer";

/**
 * Vérifications automatiques après génération : ce que l'on peut contrôler sans trancheur ni IA.
 * Chaque contrôle donne un statut et une phrase claire ; l'ensemble donne un niveau de confiance.
 */

export type CheckStatus = "ok" | "warning" | "error";
export type CheckId = "closed" | "floating" | "walls" | "requested" | "declared" | "printer";

export interface VerifyCheck {
  id: CheckId;
  status: CheckStatus;
  label: string;
  detail: string;
}

export interface VerifyReport {
  checks: VerifyCheck[];
  confidence: "high" | "medium" | "low";
  /** Phrase courte pour l'écran de résultat. */
  summary: string;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");

/* ---------------- Cotes demandées dans le texte ---------------- */

/** Mesures explicites (« 35 mm », « 8 cm », « 1,2 m »), converties en millimètres. Les budgets et masses sont ignorés. */
export function requestedMeasures(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s?(mm|millimètres?|cm|centimètres?|m|mètres?)(?![a-zà-ÿ])/gi;
  for (const match of text.matchAll(re)) {
    const value = Number(match[1].replace(",", "."));
    const unit = match[2].toLowerCase();
    const mm = unit.startsWith("mm") || unit.startsWith("milli") ? value : unit.startsWith("c") ? value * 10 : value * 1000;
    if (mm > 0 && mm <= 5000) out.push(Math.round(mm * 10) / 10);
  }
  return [...new Set(out)];
}

/** Cotes présentes dans la conception : encombrement déclaré, tailles des pièces, encombrement réel. */
function designMeasures(design: Design, bounds: { x: number; y: number; z: number }): number[] {
  const values = [design.dimensions.width, design.dimensions.depth, design.dimensions.height, bounds.x, bounds.y, bounds.z];
  for (const p of design.model.parts) {
    values.push(p.size.x, p.size.y, p.size.z);
    // Tube : diamètre intérieur (diamètre extérieur moins deux parois).
    if (p.shape === "tube" && p.size.z > 0) values.push(p.size.x - 2 * p.size.z);
    // Trous d'extrusion : largeur et hauteur de chaque trou.
    for (const hole of p.holes) {
      const xs = hole.map((h) => h.x);
      const ys = hole.map((h) => h.y);
      values.push(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    }
  }
  return values.filter((v) => Number.isFinite(v) && v > 0);
}

/* ---------------- Maillage fermé ---------------- */

/** Nombre d'arêtes « ouvertes » (partagées par un nombre de triangles différent de 2), triangles dégénérés ignorés. */
export function openEdges(positions: Float32Array): number {
  const key = (i: number) => `${Math.round(positions[i] * 1000)},${Math.round(positions[i + 1] * 1000)},${Math.round(positions[i + 2] * 1000)}`;
  const edges = new Map<string, number>();
  for (let t = 0; t < positions.length; t += 9) {
    const a = key(t), b = key(t + 3), c = key(t + 6);
    if (a === b || b === c || a === c) continue;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const k = u < v ? `${u}|${v}` : `${v}|${u}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const n of edges.values()) if (n !== 2) open++;
  return open;
}

/* ---------------- Pièces reliées ---------------- */

/** Groupes de pièces qui se touchent (boîtes englobantes à 0,5 mm près). */
export function connectedGroups(meshes: PartMesh[], tolerance = 0.5): number[][] {
  const n = meshes.length;
  const parent = meshes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = meshes[i].box.clone().expandByScalar(tolerance);
      if (a.intersectsBox(meshes[j].box)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

/* ---------------- Rapport ---------------- */

export function verifyDesign(design: Design, options: { request?: string; printer?: PrinterVolume } = {}): VerifyReport {
  const printer = options.printer ?? DEFAULT_PRINTER;
  const meshes = buildPartMeshes(design);
  const box = meshesBounds(meshes);
  const bounds = { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z };
  const checks: VerifyCheck[] = [];

  // 1. Pièces fermées (étanches) : un maillage ouvert donne un fichier que le trancheur interprète mal.
  const open = meshes.filter((m) => openEdges(m.positions) > 0);
  checks.push(
    open.length === 0
      ? { id: "closed", status: "ok", label: "Pièces fermées", detail: "Chaque pièce est un volume fermé (étanche)." }
      : { id: "closed", status: "warning", label: "Pièces ouvertes", detail: `À vérifier dans le trancheur : ${open.map((m) => m.part.name).join(", ")}.` },
  );

  // 2. Pièces flottantes : tout doit tenir en un seul bloc.
  const groups = connectedGroups(meshes);
  if (groups.length <= 1) {
    checks.push({ id: "floating", status: "ok", label: "Un seul bloc", detail: "Toutes les pièces se touchent." });
  } else {
    const loose = groups.slice(1).flat().map((i) => meshes[i].part.name);
    checks.push({ id: "floating", status: "error", label: "Pièces flottantes", detail: `Non reliées au reste : ${loose.join(", ")}.` });
  }

  // 3. Parois : 1,2 mm au minimum (buse de 0,4 mm).
  const thin = design.model.parts.map((p) => ({ name: p.name, t: partThickness(p) })).filter((p) => p.t < MIN_WALL);
  checks.push(
    thin.length === 0
      ? { id: "walls", status: "ok", label: "Parois assez épaisses", detail: `${fmt(MIN_WALL)} mm au minimum partout.` }
      : {
          id: "walls",
          status: thin.some((p) => p.t < CRITICAL_WALL) ? "error" : "warning",
          label: "Parois fines",
          detail: thin.map((p) => `${p.name} : ${fmt(p.t)} mm`).join(" · "),
        },
  );

  // 4. Cotes demandées : chaque mesure écrite dans la demande doit se retrouver dans la pièce.
  const asked = options.request ? requestedMeasures(options.request) : [];
  if (asked.length) {
    const have = designMeasures(design, bounds);
    const missing = asked.filter((mm) => !have.some((v) => Math.abs(v - mm) <= Math.max(1, mm * 0.03)));
    checks.push(
      missing.length === 0
        ? { id: "requested", status: "ok", label: "Cotes demandées respectées", detail: asked.map((mm) => `${fmt(mm)} mm`).join(", ") + " : retrouvées dans la pièce." }
        : { id: "requested", status: "warning", label: "Cotes demandées à vérifier", detail: `Non retrouvées telles quelles : ${missing.map((mm) => `${fmt(mm)} mm`).join(", ")}.` },
    );
  }

  // 5. Encombrement annoncé = encombrement réel du modèle (à 5 % ou 2 mm près).
  const declared = [design.dimensions.width, design.dimensions.height, design.dimensions.depth];
  const real = [bounds.x, bounds.y, bounds.z];
  const off = declared.some((d, i) => d > 0 && Math.abs(d - real[i]) > Math.max(2, real[i] * 0.05));
  checks.push(
    off
      ? {
          id: "declared",
          status: "warning",
          label: "Dimensions annoncées approximatives",
          detail: `Annoncé ${fmt(declared[0])} × ${fmt(declared[2])} × ${fmt(declared[1])} mm, modèle réel ${fmt(real[0])} × ${fmt(real[2])} × ${fmt(real[1])} mm (les cotes affichées sont celles du modèle).`,
        }
      : { id: "declared", status: "ok", label: "Dimensions cohérentes", detail: "Les dimensions annoncées correspondent au modèle." },
  );

  // 6. Volume d'impression.
  const report = checkPrintability(design, printer);
  const fitsSomehow = report.orientations.some((o) => o.fits);
  checks.push(
    report.fits
      ? { id: "printer", status: "ok", label: "Tient dans l'imprimante", detail: `Volume ${printer.x} × ${printer.y} × ${printer.z} mm.` }
      : fitsSomehow
        ? { id: "printer", status: "warning", label: "Tient couché", detail: `À imprimer ${report.best.label}.` }
        : { id: "printer", status: "error", label: "Trop grand pour l'imprimante", detail: `Volume ${printer.x} × ${printer.y} × ${printer.z} mm.` },
  );

  const errors = checks.filter((c) => c.status === "error").length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  const confidence = errors > 0 ? "low" : warnings >= 2 ? "medium" : "high";
  const passed = checks.filter((c) => c.status === "ok").length;
  const summary =
    confidence === "high"
      ? `Vérifications : ${passed} sur ${checks.length} réussies.`
      : confidence === "medium"
        ? `Vérifications : ${passed} sur ${checks.length} réussies, quelques points à regarder.`
        : `Vérifications : un problème bloquant à corriger avant d'imprimer.`;
  return { checks, confidence, summary };
}
