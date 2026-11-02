import type { Design, Part } from "./schema";

/** Ajustements proposés sur une solution : chacun crée une NOUVELLE version, la précédente est conservée. */
export const VARIANTS = {
  smaller: {
    label: "Plus petit",
    short: "plus compacte",
    goal:
      "Rends la solution nettement plus compacte (environ 20 à 30 % plus petite) tout en gardant sa fonction : réduis l'encombrement, " +
      "garde des épaisseurs de paroi imprimables (1,6 mm minimum) et ajuste masse, coût et durées.",
  },
  stronger: {
    label: "Plus solide",
    short: "renforcée",
    goal:
      "Rends la solution plus solide et durable : parois plus épaisses, nervures ou congés de renfort aux endroits sollicités, " +
      "matière plus résistante si besoin (PETG, ASA, nylon…). Ajuste masse, coût et recommandations (remplissage, nombre de parois).",
  },
  cheaper: {
    label: "Moins cher",
    short: "économique",
    goal:
      "Rends la solution moins chère à fabriquer : moins de matière, pièces plus simples, visserie standard, matière économique (PLA) " +
      "si l'usage le permet. Donne le nouveau coût, plus bas, et ce que l'on perd éventuellement.",
  },
  prettier: {
    label: "Plus esthétique",
    short: "plus élégante",
    goal:
      "Rends la solution plus esthétique sans nuire à sa fonction : formes plus douces (arrondis, chanfreins), proportions harmonieuses, " +
      "couleurs coordonnées, finition conseillée (ponçage, peinture…).",
  },
} as const;

export type VariantId = keyof typeof VARIANTS;
export const VARIANT_IDS = Object.keys(VARIANTS) as VariantId[];

export function isVariantId(value: unknown): value is VariantId {
  return typeof value === "string" && value in VARIANTS;
}

/** Consigne envoyée à l'IA : la conception actuelle (JSON) et l'objectif de la nouvelle version. */
export function variantInstruction(variant: VariantId, base: Design): string {
  const { variante: _ignored, ...rest } = base;
  void _ignored;
  return (
    `Voici la conception actuelle (JSON) :\n<conception_actuelle>\n${JSON.stringify(rest)}\n</conception_actuelle>\n\n` +
    `Objectif de la nouvelle version : ${VARIANTS[variant].goal}\n` +
    "Garde le même problème à résoudre et la même logique de solution ; renvoie l'objet JSON COMPLET de la nouvelle version " +
    "(analyse, dimensions, matières, étapes, coût et modèle 3D mis à jour), dans le même format."
  );
}

/* ---------------- Version calculée sans IA (mode démo, IA indisponible) ---------------- */

function scalePart(part: Part, k: number): Part {
  return {
    ...part,
    size: { x: part.size.x * k, y: part.size.y * k, z: part.size.z * k },
    position: { x: part.position.x * k, y: part.position.y * k, z: part.position.z * k },
    cornerRadius: part.cornerRadius * k,
    profile: part.profile.map((p) => ({ x: p.x * k, y: p.y * k })),
    holes: part.holes.map((ring) => ring.map((p) => ({ x: p.x * k, y: p.y * k }))),
  };
}

function thicken(part: Part): Part {
  const { x, y, z } = part.size;
  const grow = (v: number, min: number) => (v === min ? Math.max(v * 1.35, v + 1) : v);
  if (part.shape === "box") {
    const min = Math.min(x, y, z);
    return { ...part, size: { x: grow(x, min), y: grow(y, min), z: grow(z, min) } };
  }
  if (part.shape === "tube") return { ...part, size: { ...part.size, z: Math.max(z, Math.min(z * 1.4 + 0.5, x / 2 - 0.5)) } };
  if (part.shape === "extrusion") return { ...part, size: { ...part.size, z: z * 1.3 } };
  return part;
}

function scaleCost(design: Design, k: number): Design["cost"] {
  return {
    ...design.cost,
    min: Math.round(design.cost.min * k * 100) / 100,
    max: Math.round(design.cost.max * k * 100) / 100,
    items: design.cost.items.map((i) => ({ ...i, amount: Math.round(i.amount * k * 100) / 100 })),
  };
}

const STRONG = /petg|asa|nylon|abs|alu|acier|ch[eê]ne|h[eê]tre/i;
const PALETTE = ["#5b6ee1", "#7b5ce6", "#f2f2f5", "#22232b", "#c9cdf5"];

/**
 * Version déterministe, calculée localement : utilisée quand l'IA n'est pas disponible.
 * Moins fine qu'une version de l'IA, mais toujours cohérente (dimensions, coût, masse).
 */
export function applyVariantLocally(base: Design, variant: VariantId): Design {
  const design: Design = structuredClone(base);
  const v = VARIANTS[variant];
  design.title = `${base.title.replace(/\s*\((plus compacte|renforcée|économique|plus élégante)\)$/i, "")} (${v.short})`.slice(0, 120);

  if (variant === "smaller") {
    const k = 0.8;
    design.model.parts = design.model.parts.map((p) => scalePart(p, k));
    design.dimensions = {
      ...design.dimensions,
      width: design.dimensions.width * k,
      depth: design.dimensions.depth * k,
      height: design.dimensions.height * k,
      weightGrams: Math.round(design.dimensions.weightGrams * k ** 3),
    };
    design.cost = scaleCost(design, 0.75);
    design.fabrication = design.fabrication.map((f) => ({ ...f, durationMin: Math.max(1, Math.round(f.durationMin * 0.7)) }));
    design.recommendations = ["Version réduite de 20 % : vérifiez que l'objet à ranger ou à tenir y entre toujours.", ...design.recommendations];
  } else if (variant === "stronger") {
    design.model.parts = design.model.parts.map(thicken);
    design.dimensions = { ...design.dimensions, weightGrams: Math.round(design.dimensions.weightGrams * 1.3) };
    design.cost = scaleCost(design, 1.2);
    const strong = design.materiaux_conseilles.findIndex((m) => STRONG.test(m.nom));
    if (strong > 0) {
      const [m] = design.materiaux_conseilles.splice(strong, 1);
      design.materiaux_conseilles.unshift(m);
    }
    design.recommendations = [
      "Parois épaissies d'environ 35 %. Imprimez avec 4 parois et 35 à 40 % de remplissage (gyroïde).",
      ...design.recommendations,
    ];
  } else if (variant === "cheaper") {
    const eco = design.materiaux_conseilles.findIndex((m) => m.alternative_economique);
    if (eco > 0) {
      const [m] = design.materiaux_conseilles.splice(eco, 1);
      design.materiaux_conseilles.unshift(m);
    }
    design.dimensions = { ...design.dimensions, weightGrams: Math.round(design.dimensions.weightGrams * 0.85) }; // remplissage réduit
    design.cost = scaleCost(design, 0.7);
    design.recommendations = [
      "Version économique : 15 % de remplissage, couches de 0,28 mm, matière la moins chère adaptée à l'usage.",
      ...design.recommendations,
    ];
  } else {
    design.model.parts = design.model.parts.map((p, i) => ({
      ...p,
      cornerRadius: p.shape === "box" ? Math.max(p.cornerRadius, Math.min(p.size.x, p.size.y, p.size.z) * 0.2) : p.cornerRadius,
      color: PALETTE[i % PALETTE.length],
    }));
    design.recommendations = [
      "Arêtes adoucies et couleurs coordonnées. Finition : ponçage léger (grain 240 puis 400), apprêt puis peinture satinée.",
      ...design.recommendations,
    ];
  }

  design.analysis = {
    ...design.analysis,
    assumptions: [`Version « ${v.label} » calculée automatiquement à partir de « ${base.title} » (sans IA).`, ...design.analysis.assumptions].slice(0, 12),
  };
  design.variante = { objectif: variant, libelle: v.label, base: base.title };
  return design;
}
