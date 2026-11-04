import { polygonBounds, scalePartBy, type Vec2 } from "./ops";
import type { Design, Part } from "./schema";

/**
 * « Modifie la pièce » sans IA (mode démo, clé absente, visiteur) : quelques consignes simples comprises localement.
 * Exemples : « agrandis le trou de 2 mm », « arrondis les angles », « plus grand de 10 % », « épaissis de 2 mm ».
 * Renvoie null si la consigne n'est pas comprise.
 */
export function applyEditLocally(design: Design, instruction: string, selectedId: string | null): { design: Design; ids: string[]; summary: string } | null {
  const text = instruction.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const num = (re: RegExp) => {
    const m = text.match(re);
    return m ? Number(m[1].replace(",", ".")) : null;
  };
  const targets = selectedId ? design.model.parts.filter((p) => p.id === selectedId) : design.model.parts;
  if (!targets.length) return null;
  const ids = new Set(targets.map((p) => p.id));
  const map = (fn: (p: Part) => Part) => ({ ...design, model: { ...design.model, parts: design.model.parts.map((p) => (ids.has(p.id) ? fn(p) : p)) } });

  // Trous : agrandir / réduire le diamètre de N mm.
  const holeDelta = num(/trou[a-z]*[^0-9]*?(\d+(?:[.,]\d+)?)\s*mm/);
  if (/trou/.test(text) && holeDelta !== null) {
    const sign = /(reduis|retrecis|diminue|plus petit|resserre)/.test(text) ? -1 : 1;
    let changed = 0;
    const next = map((p) => {
      if (!p.holes.length) return p;
      changed++;
      return {
        ...p,
        holes: p.holes.map((ring) => {
          const b = polygonBounds(ring);
          const cx = (b.minX + b.maxX) / 2;
          const cy = (b.minY + b.maxY) / 2;
          const d = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1;
          const k = Math.max(0.1, (d + sign * holeDelta) / d);
          return ring.map((q: Vec2) => ({ x: Math.round((cx + (q.x - cx) * k) * 100) / 100, y: Math.round((cy + (q.y - cy) * k) * 100) / 100 }));
        }),
      };
    });
    return changed ? { design: next, ids: [...ids], summary: `Trous ${sign > 0 ? "agrandis" : "réduits"} de ${holeDelta} mm de diamètre.` } : null;
  }

  // Arrondir les angles (pavés).
  if (/(arrondi|adouci|cong)/.test(text) && /(angle|coin|arete|bord)/.test(text)) {
    const r = num(/(\d+(?:[.,]\d+)?)\s*mm/);
    const next = map((p) => (p.shape === "box" ? { ...p, cornerRadius: Math.min(r ?? Math.min(p.size.x, p.size.y, p.size.z) / 6, Math.min(p.size.x, p.size.y, p.size.z) / 2 - 0.01) } : p));
    return { design: next, ids: [...ids], summary: "Angles arrondis." };
  }

  // Plus grand / plus petit de N %.
  const percent = num(/(\d+(?:[.,]\d+)?)\s*%/);
  if (percent !== null && /(grand|agrandi|petit|reduis|retrecis|augmente|diminue)/.test(text)) {
    const k = /(petit|reduis|retrecis|diminue)/.test(text) ? 1 - percent / 100 : 1 + percent / 100;
    let next = design;
    for (const id of ids) next = scalePartBy(next, id, { x: k, y: k, z: k });
    return { design: next, ids: [...ids], summary: `Taille ${k > 1 ? "augmentée" : "réduite"} de ${percent} %.` };
  }

  // Épaissir de N mm (plus petite dimension d'un pavé, paroi d'un tube, épaisseur d'un profilé).
  const thick = num(/(?:epaissi|plus epais|renforce)[a-z]*[^0-9]*?(\d+(?:[.,]\d+)?)\s*mm/);
  if (thick !== null) {
    const next = map((p) => {
      if (p.shape === "tube" || p.shape === "extrusion") return { ...p, size: { ...p.size, z: p.size.z + thick } };
      if (p.shape !== "box") return p;
      const axis = (["x", "y", "z"] as const).reduce((a, b) => (p.size[b] < p.size[a] ? b : a), "x");
      return { ...p, size: { ...p.size, [axis]: p.size[axis] + thick } };
    });
    return { design: next, ids: [...ids], summary: `Épaisseur augmentée de ${thick} mm.` };
  }
  return null;
}
