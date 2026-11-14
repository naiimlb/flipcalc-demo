import { buildPartMeshes, meshesBounds } from "../fabrication/mesh";
import type { Design } from "./schema";

/** Valeurs choisies par l'utilisateur, par identifiant de paramètre. */
export type ParameterValues = Record<string, number>;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Applique les paramètres nommés : chaque effet ajoute facteur × (valeur choisie − valeur d'origine) au champ visé.
 * Calcul local et instantané (aucun appel à l'IA). Les tailles restent ≥ 0,1 mm ; l'encombrement annoncé
 * est recalculé d'après le modèle obtenu.
 */
export function applyParameters(design: Design, values: ParameterValues): Design {
  const changed = design.parametres.filter((p) => values[p.id] !== undefined && clamp(values[p.id], p.min, p.max) !== p.valeur);
  if (!changed.length) return design;
  const next: Design = structuredClone(design);
  const parts = new Map(next.model.parts.map((part) => [part.id, part]));
  for (const p of changed) {
    const delta = clamp(values[p.id], p.min, p.max) - p.valeur;
    for (const e of p.effets) {
      const part = parts.get(e.piece);
      if (!part) continue;
      const [group, axis] = e.champ.split(".") as ["size" | "position", "x" | "y" | "z"];
      part[group][axis] += e.facteur * delta;
      if (group === "size") part.size[axis] = Math.max(0.1, part.size[axis]);
    }
  }
  // Les paramètres partent désormais des nouvelles valeurs.
  next.parametres = next.parametres.map((p) => (values[p.id] === undefined ? p : { ...p, valeur: clamp(values[p.id], p.min, p.max) }));
  const box = meshesBounds(buildPartMeshes(next));
  next.dimensions = {
    ...next.dimensions,
    width: Math.round((box.max.x - box.min.x) * 10) / 10,
    height: Math.round((box.max.y - box.min.y) * 10) / 10,
    depth: Math.round((box.max.z - box.min.z) * 10) / 10,
  };
  return next;
}
